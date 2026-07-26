import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  writeBatch, 
  query, 
  where,
  addDoc,
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { 
  TeacherTeachingAttendance, 
  AttendanceDailyStats, 
  TeacherAttendanceSummary,
  AttendanceTeachingStatus,
  TeacherAttendanceAuditLog
} from "../types/teacherTeachingAttendance.types";
import { scheduleService } from "./schedule.service";
import { academicPlanningService } from "./academicPlanning.service";
import { lessonPeriodService } from "./lessonPeriod.service";
import { classService } from "./classService";

const COLLECTION_NAME = "teacher_teaching_attendances";
const AUDIT_LOGS_COLLECTION = "teacher_attendance_audit_logs";

export function getIndonesianDayName(dateStr: string): string {
  if (!dateStr) return "Senin";
  // Add T00:00:00 to prevent local timezone shift
  const date = new Date(dateStr + "T00:00:00");
  const dayIndex = date.getDay();
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[dayIndex] || "Senin";
}

async function logActivity(userId: string, userName: string, action: string, description: string) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
}

export const teacherTeachingAttendanceService = {
  // Check Kaldik to see if date is blocked for KBM
  async checkKaldikStatus(dateStr: string, academicYearId?: string, semesterId?: string): Promise<{ isKbmDisabled: boolean; lockReason?: string }> {
    try {
      const calendarDays = await academicPlanningService.getCalendarDays(academicYearId, semesterId);
      const dayData = calendarDays.find(d => d.date === dateStr);
      if (!dayData || !dayData.events || dayData.events.length === 0) {
        return { isKbmDisabled: false };
      }

      // Check for non-effective day or special events
      const blockingEvent = dayData.events.find(e => {
        if (e.isEffectiveDay === false) return true;
        if (e.affectsKbm === true) return true;
        const cat = (e.categoryName || "").toLowerCase();
        const title = (e.title || "").toLowerCase();
        return (
          cat.includes("libur") ||
          cat.includes("ujian") ||
          cat.includes("mpls") ||
          cat.includes("class meeting") ||
          cat.includes("tidak efektif") ||
          title.includes("libur") ||
          title.includes("mpls") ||
          title.includes("class meeting") ||
          title.includes("ujian") ||
          title.includes("anbk")
        );
      });

      if (blockingEvent) {
        return {
          isKbmDisabled: true,
          lockReason: blockingEvent.title || blockingEvent.categoryName || "Kegiatan Non-KBM Kalender Akademik"
        };
      }

      return { isKbmDisabled: false };
    } catch (err) {
      console.warn("Error checking kaldik status for attendance:", err);
      return { isKbmDisabled: false };
    }
  },

  // Get attendance entries for a specific date derived from schedules
  async getAttendanceForDate(
    dateStr: string,
    academicYearId: string,
    semesterId: string
  ): Promise<{
    date: string;
    day: string;
    items: TeacherTeachingAttendance[];
    isKbmDisabled: boolean;
    lockReason?: string;
  }> {
    const dayName = getIndonesianDayName(dateStr);

    // 1. Check Kaldik status
    const kaldikInfo = await this.checkKaldikStatus(dateStr, academicYearId, semesterId);

    // 2. Load schedules for active AY, Semester, and Day
    const allSchedules = await scheduleService.getSchedules();
    const activeSchedules = allSchedules.filter(s => {
      const matchesAy = !academicYearId || s.academicYearId === academicYearId;
      const matchesSem = !semesterId || s.semesterId === semesterId;
      const matchesDay = (s.day || "").trim().toLowerCase() === dayName.toLowerCase();
      const hasTeacher = !!s.teacherId && s.teacherId !== "none" && s.teacherId !== "";
      return matchesAy && matchesSem && matchesDay && hasTeacher;
    });

    // Load lesson periods & classes for supplementary fields like time & roomCode
    const [lessonPeriods, classes] = await Promise.all([
      lessonPeriodService.getLessonPeriods(),
      classService.getClasses()
    ]);

    const periodMap = new Map(lessonPeriods.map(p => [p.id, p]));
    const classMap = new Map(classes.map(c => [c.id || c.classId, c]));

    // 3. Load saved attendances for this date from Firestore
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where("date", "==", dateStr));
    const snap = await getDocs(q);
    const existingRecords = new Map<string, TeacherTeachingAttendance>();
    snap.forEach(d => {
      const data = d.data() as TeacherTeachingAttendance;
      const recordId = d.id;
      existingRecords.set(data.scheduleId || recordId, { ...data, id: recordId });
    });

    // 4. Merge schedule items with existing attendance records
    const items: TeacherTeachingAttendance[] = activeSchedules.map(sch => {
      const existing = existingRecords.get(sch.id!);
      const period = periodMap.get(sch.lessonPeriodId);
      const cls = classMap.get(sch.classId);

      const timeSlot = period ? `${period.startTime} - ${period.endTime}` : "";
      const roomName = cls?.roomCode || cls?.name || "";

      if (existing) {
        return {
          ...existing,
          scheduleId: sch.id!,
          teacherId: sch.teacherId,
          teacherName: sch.teacherName,
          subjectId: sch.subjectId,
          subjectName: sch.subjectName,
          classId: sch.classId,
          className: sch.className,
          gradeLevel: cls?.gradeLevel || "",
          lessonPeriodId: sch.lessonPeriodId,
          sequence: sch.sequence || 0,
          jp: sch.jp || (period ? period.title : "JP"),
          roomName: existing.roomName || roomName,
          timeSlot: existing.timeSlot || timeSlot,
          academicYearId: sch.academicYearId || academicYearId,
          semesterId: sch.semesterId || semesterId,
          day: dayName,
          date: dateStr
        };
      }

      // Default item if not saved yet
      return {
        date: dateStr,
        day: dayName,
        academicYearId: sch.academicYearId || academicYearId,
        semesterId: sch.semesterId || semesterId,
        scheduleId: sch.id!,
        teacherId: sch.teacherId,
        teacherName: sch.teacherName,
        subjectId: sch.subjectId,
        subjectName: sch.subjectName,
        classId: sch.classId,
        className: sch.className,
        gradeLevel: cls?.gradeLevel || "",
        lessonPeriodId: sch.lessonPeriodId,
        sequence: sch.sequence || 0,
        jp: sch.jp || (period ? period.title : "JP"),
        roomName,
        timeSlot,
        status: kaldikInfo.isKbmDisabled ? "KBM Ditiadakan" : "Hadir Mengajar",
        notes: kaldikInfo.isKbmDisabled ? (kaldikInfo.lockReason || "KBM Ditiadakan") : ""
      };
    });

    // Sort by class and sequence
    items.sort((a, b) => {
      const clsComp = a.className.localeCompare(b.className);
      if (clsComp !== 0) return clsComp;
      return a.sequence - b.sequence;
    });

    return {
      date: dateStr,
      day: dayName,
      items,
      isKbmDisabled: kaldikInfo.isKbmDisabled,
      lockReason: kaldikInfo.lockReason
    };
  },

  // Save/Update daily attendance batch with Audit Logging for Back-dating
  async saveAttendanceForDate(
    dateStr: string,
    items: TeacherTeachingAttendance[],
    userId: string,
    userName: string,
    reason?: string
  ): Promise<void> {
    try {
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();
      const todayStr = new Date().toISOString().split("T")[0];
      const isPastDate = dateStr < todayStr;

      // Fetch existing snapshot to compare previous values for audit log
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, where("date", "==", dateStr));
      const existingSnap = await getDocs(q);
      const existingMap = new Map<string, any>();
      existingSnap.forEach(d => existingMap.set(d.id, d.data()));

      const auditLogs: TeacherAttendanceAuditLog[] = [];

      items.forEach(item => {
        const docId = item.id || `${dateStr}_${item.scheduleId}`;
        const ref = doc(db, COLLECTION_NAME, docId);
        const existingData = existingMap.get(docId);

        const isSusulan = isPastDate || (existingData && existingData.recordedByUserId !== userId);
        const previousStatus = existingData ? existingData.status : "Belum Diisi";

        const payload: TeacherTeachingAttendance = {
          ...item,
          id: docId,
          date: dateStr,
          isInputSusulan: isSusulan ? true : (item.isInputSusulan || false),
          recordedByUserId: userId,
          recordedByUserName: userName,
          updatedAt: timestamp,
          createdAt: item.createdAt || timestamp
        };

        batch.set(ref, payload, { merge: true });

        // Record audit log if past date or status changed
        if (isPastDate || (existingData && previousStatus !== item.status)) {
          auditLogs.push({
            attendanceDate: dateStr,
            inputTimestamp: timestamp,
            userId,
            userName,
            scheduleId: item.scheduleId,
            teacherName: item.teacherName,
            className: item.className,
            subjectName: item.subjectName,
            jp: item.jp,
            previousStatus,
            newStatus: item.status,
            reason: reason || (isPastDate ? "Input / Koreksi Susulan Tanggal Lampau" : "Perubahan Status Absensi"),
            isLateInput: isPastDate
          });
        }
      });

      await batch.commit();

      if (auditLogs.length > 0) {
        const auditColRef = collection(db, AUDIT_LOGS_COLLECTION);
        const auditPromises = auditLogs.map(log => addDoc(auditColRef, log));
        await Promise.all(auditPromises);
      }

      await logActivity(userId, userName, "Save Attendance", `Menyimpan ${items.length} data absensi mengajar tanggal ${dateStr}${isPastDate ? ' (Input Susulan)' : ''}`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  // Get Audit Logs for Back-dating inputs
  async getAuditLogs(startDate?: string, endDate?: string): Promise<TeacherAttendanceAuditLog[]> {
    try {
      const colRef = collection(db, AUDIT_LOGS_COLLECTION);
      const snap = await getDocs(colRef);
      const items: TeacherAttendanceAuditLog[] = [];
      snap.forEach(d => {
        const data = d.data() as TeacherAttendanceAuditLog;
        if (startDate && data.attendanceDate < startDate) return;
        if (endDate && data.attendanceDate > endDate) return;
        items.push({ id: d.id, ...data });
      });
      items.sort((a, b) => b.inputTimestamp.localeCompare(a.inputTimestamp));
      return items;
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      return [];
    }
  },

  // Get list of dates in active semester up to today with incomplete attendance
  async getIncompleteAttendanceDates(
    academicYearId: string,
    semesterId: string,
    limitDays: number = 30
  ): Promise<{ date: string; day: string; missingCount: number; totalCount: number }[]> {
    try {
      const today = new Date();
      const results: { date: string; day: string; missingCount: number; totalCount: number }[] = [];

      for (let i = 1; i <= limitDays; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];

        const kaldik = await this.checkKaldikStatus(dateStr, academicYearId, semesterId);
        if (kaldik.isKbmDisabled) continue;

        const dayName = getIndonesianDayName(dateStr);
        const { items } = await this.getAttendanceForDate(dateStr, academicYearId, semesterId);
        if (items.length === 0) continue;

        const unsubmitted = items.filter(item => !item.recordedByUserId).length;
        if (unsubmitted > 0) {
          results.push({
            date: dateStr,
            day: dayName,
            missingCount: unsubmitted,
            totalCount: items.length
          });
        }
      }

      return results;
    } catch (error) {
      console.error("Failed to check incomplete attendance dates:", error);
      return [];
    }
  },

  // Daily statistics for Wakakur/Kepala Sekolah dashboard
  async getDailyStats(dateStr: string, academicYearId?: string, semesterId?: string): Promise<AttendanceDailyStats> {
    const dayName = getIndonesianDayName(dateStr);
    const { items, isKbmDisabled } = await this.getAttendanceForDate(dateStr, academicYearId || "", semesterId || "");

    const totalScheduledEncounters = items.length;
    const uniqueTeachers = new Set(items.map(i => i.teacherId));

    let hadirCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let tugasCount = 0;
    let tidakHadirCount = 0;
    let digantiCount = 0;
    let kbmDitiadakanCount = 0;
    let pendingCount = 0;

    items.forEach(i => {
      if (!i.id) {
        pendingCount++;
      }
      switch (i.status) {
        case "Hadir Mengajar":
          hadirCount++;
          break;
        case "Izin":
          izinCount++;
          break;
        case "Sakit":
          sakitCount++;
          break;
        case "Tugas Dinas":
          tugasCount++;
          break;
        case "Tidak Hadir":
          tidakHadirCount++;
          break;
        case "Diganti Guru Lain":
          digantiCount++;
          break;
        case "KBM Ditiadakan":
          kbmDitiadakanCount++;
          break;
      }
    });

    const effectiveTotal = totalScheduledEncounters - kbmDitiadakanCount;
    const attendancePercentage = effectiveTotal > 0 
      ? Math.round(((hadirCount + digantiCount) / effectiveTotal) * 100) 
      : (totalScheduledEncounters > 0 && isKbmDisabled ? 100 : 0);

    return {
      date: dateStr,
      day: dayName,
      totalScheduledEncounters,
      totalUniqueTeachersScheduled: uniqueTeachers.size,
      hadirCount,
      izinCount,
      sakitCount,
      tugasCount,
      tidakHadirCount,
      digantiCount,
      kbmDitiadakanCount,
      pendingCount,
      attendancePercentage
    };
  },

  // Get aggregated attendance summary for Rekap
  async getAttendanceRecap(filters: {
    academicYearId?: string;
    semesterId?: string;
    startDate?: string;
    endDate?: string;
    teacherId?: string;
    subjectId?: string;
    classId?: string;
    gradeLevel?: string;
  }): Promise<{
    summaries: TeacherAttendanceSummary[];
    rawRecords: TeacherTeachingAttendance[];
  }> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let q = query(colRef);

      if (filters.academicYearId) {
        q = query(q, where("academicYearId", "==", filters.academicYearId));
      }

      const snap = await getDocs(q);
      const rawRecords: TeacherTeachingAttendance[] = [];

      snap.forEach(d => {
        const data = d.data() as TeacherTeachingAttendance;
        // Client side filtering for date range, semester, etc.
        let match = true;
        if (filters.semesterId && data.semesterId && data.semesterId !== filters.semesterId) match = false;
        if (filters.startDate && data.date < filters.startDate) match = false;
        if (filters.endDate && data.date > filters.endDate) match = false;
        if (filters.teacherId && data.teacherId !== filters.teacherId && data.substituteTeacherId !== filters.teacherId) match = false;
        if (filters.subjectId && data.subjectId !== filters.subjectId) match = false;
        if (filters.classId && data.classId !== filters.classId) match = false;
        if (filters.gradeLevel && data.gradeLevel !== filters.gradeLevel) match = false;

        if (match) {
          rawRecords.push({ id: d.id, ...data });
        }
      });

      // Group by teacher
      const map = new Map<string, TeacherAttendanceSummary>();

      rawRecords.forEach(rec => {
        const tId = rec.teacherId;
        const tName = rec.teacherName || "Guru";

        if (!map.has(tId)) {
          map.set(tId, {
            teacherId: tId,
            teacherName: tName,
            totalEncounters: 0,
            hadir: 0,
            izin: 0,
            sakit: 0,
            tugas: 0,
            tidakHadir: 0,
            diganti: 0,
            kbmDitiadakan: 0,
            percentage: 0
          });
        }

        const sum = map.get(tId)!;
        sum.totalEncounters++;

        switch (rec.status) {
          case "Hadir Mengajar":
            sum.hadir++;
            break;
          case "Izin":
            sum.izin++;
            break;
          case "Sakit":
            sum.sakit++;
            break;
          case "Tugas Dinas":
            sum.tugas++;
            break;
          case "Tidak Hadir":
            sum.tidakHadir++;
            break;
          case "Diganti Guru Lain":
            sum.diganti++;
            break;
          case "KBM Ditiadakan":
            sum.kbmDitiadakan++;
            break;
        }
      });

      // Calculate percentage for each teacher
      const summaries: TeacherAttendanceSummary[] = Array.from(map.values()).map(sum => {
        const effective = sum.totalEncounters - sum.kbmDitiadakan;
        const percentage = effective > 0 ? Math.round(((sum.hadir + sum.diganti) / effective) * 100) : 0;
        return { ...sum, percentage };
      });

      summaries.sort((a, b) => b.percentage - a.percentage || a.teacherName.localeCompare(b.teacherName));

      return { summaries, rawRecords };
    } catch (error) {
      console.error("Error fetching attendance recap:", error);
      return { summaries: [], rawRecords: [] };
    }
  },

  // Get full timeline history for a specific teacher
  async getTeacherHistory(
    teacherId: string,
    filters?: { academicYearId?: string; semesterId?: string; startDate?: string; endDate?: string }
  ): Promise<TeacherTeachingAttendance[]> {
    const { rawRecords } = await this.getAttendanceRecap({
      ...filters,
      teacherId
    });

    rawRecords.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.sequence - b.sequence;
    });

    return rawRecords;
  }
};
