import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc,
  updateDoc,
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
  TeacherAttendanceAuditLog,
  ScheduleExchangeRecord,
  LeadershipMonitoringStats
} from "../types/teacherTeachingAttendance.types";
import { scheduleService } from "./schedule.service";
import { academicPlanningService } from "./academicPlanning.service";
import { lessonPeriodService } from "./lessonPeriod.service";
import { classService } from "./classService";
import { schoolSettingsService } from "./schoolSettings.service";

const COLLECTION_NAME = "teacher_teaching_attendances";
const AUDIT_LOGS_COLLECTION = "teacher_attendance_audit_logs";
const SCHEDULE_EXCHANGES_COLLECTION = "schedule_exchanges";

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

// Helper to parse JP count string into numeric count (e.g., "JP 1-3" -> 3, "2 JP" -> 2, "JP 1" -> 1)
export function parseJPCount(jpStr?: string): number {
  if (!jpStr) return 1;
  const str = String(jpStr).trim();
  const rangeMatch = str.match(/(?:JP\s*)?(\d+)\s*[–-]\s*(\d+)/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (!isNaN(start) && !isNaN(end) && end >= start) {
      return (end - start) + 1;
    }
  }
  const countMatch = str.match(/(\d+)\s*JP/i);
  if (countMatch) {
    return parseInt(countMatch[1], 10) || 1;
  }
  return 1;
}

function createEmptySummary(teacherId: string, teacherName: string): TeacherAttendanceSummary {
  return {
    teacherId,
    teacherName,
    totalEncounters: 0,
    totalJP: 0,
    executedEncounters: 0,
    executedJP: 0,
    hadir: 0,
    hadirJP: 0,
    terlambat: 0,
    terlambatJP: 0,
    izin: 0,
    izinJP: 0,
    sakit: 0,
    sakitJP: 0,
    tugas: 0,
    tugasJP: 0,
    tidakHadir: 0,
    tidakHadirJP: 0,
    diganti: 0,
    digantiJP: 0,
    tukarJadwal: 0,
    tukarJadwalJP: 0,
    tukarJadwalMasuk: 0,
    tukarJadwalMasukJP: 0,
    kbmDitiadakan: 0,
    kbmDitiadakanJP: 0,
    percentage: 0
  };
}

export const teacherTeachingAttendanceService = {
  // Check Kaldik to see if date is blocked for KBM
  async checkKaldikStatus(dateStr: string, academicYearId?: string, semesterId?: string): Promise<{ isKbmDisabled: boolean; lockReason?: string }> {
    try {
      const dayName = getIndonesianDayName(dateStr);
      let activeDays = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];
      try {
        const settings = await schoolSettingsService.getSettings();
        if (settings && settings.activeDays && settings.activeDays.length > 0) {
          activeDays = settings.activeDays;
        }
      } catch (err) {
        // Fallback
      }

      const isWeekendOff = !activeDays.some(ad => ad.toLowerCase() === dayName.toLowerCase());

      const calendarDays = await academicPlanningService.getCalendarDays(academicYearId, semesterId);
      const dayData = calendarDays.find(d => d.date === dateStr);

      if (isWeekendOff) {
        const hasEffectiveOverride = dayData?.events?.some(e => e.isEffectiveDay === true || e.categoryName?.toLowerCase().includes("kbm"));
        if (!hasEffectiveOverride) {
          return { isKbmDisabled: true, lockReason: `Hari Libur Akhir Pekan (${dayName})` };
        }
      }

      if (!dayData || !dayData.events || dayData.events.length === 0) {
        return { isKbmDisabled: false };
      }

      // Check for non-effective day or special events
      const blockingEvent = dayData.events.find(e => {
        const cat = (e.categoryName || "").toLowerCase();
        const title = (e.title || "").toLowerCase();

        // Never block if event explicitly refers to Awal KBM / Hari Pertama / Pembelajaran
        if (
          title.includes("awal kbm") ||
          title.includes("hari pertama") ||
          title.includes("pembelajaran") ||
          title.includes("awal semester") ||
          cat.includes("awal kbm") ||
          cat.includes("kbm")
        ) {
          return false;
        }

        if (e.isEffectiveDay === false) return true;

        return (
          cat.includes("libur") ||
          cat.includes("ujian") ||
          cat.includes("class meeting") ||
          cat.includes("tidak efektif") ||
          title.includes("libur") ||
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
        status: kaldikInfo.isKbmDisabled ? "KBM Ditiadakan" : "Belum Diverifikasi",
        notes: kaldikInfo.isKbmDisabled ? (kaldikInfo.lockReason || "KBM Ditiadakan") : ""
      };
    });

    // Sort by Grade Level VII -> VIII -> IX, then Class Name, then Sequence
    const gradeOrder: Record<string, number> = { "VII": 7, "VIII": 8, "IX": 9 };
    const getGradeWeight = (className: string, gradeLevel?: string) => {
      if (gradeLevel && gradeOrder[gradeLevel]) return gradeOrder[gradeLevel];
      if (className.startsWith("VII") || className.startsWith("7")) return 7;
      if (className.startsWith("VIII") || className.startsWith("8")) return 8;
      if (className.startsWith("IX") || className.startsWith("9")) return 9;
      return 99;
    };

    items.sort((a, b) => {
      const gA = getGradeWeight(a.className, a.gradeLevel);
      const gB = getGradeWeight(b.className, b.gradeLevel);
      if (gA !== gB) return gA - gB;
      const clsComp = a.className.localeCompare(b.className, "id", { numeric: true });
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

  // Save Schedule Exchange ("Tukar Jadwal") across same or different dates
  async saveScheduleExchange(
    record: Omit<ScheduleExchangeRecord, "id" | "createdAt" | "createdByUserId" | "createdByUserName"> & { dateB?: string },
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      const targetDateB = record.dateB || record.date;
      const colRef = collection(db, SCHEDULE_EXCHANGES_COLLECTION);
      const newExchange: ScheduleExchangeRecord = {
        date: record.date || "",
        dateB: targetDateB,
        teacherAId: record.teacherAId || "",
        teacherAName: record.teacherAName || "",
        scheduleAId: record.scheduleAId || "",
        subjectAName: record.subjectAName || "",
        classAName: record.classAName || "",
        jpA: record.jpA || "",
        teacherBId: record.teacherBId || "",
        teacherBName: record.teacherBName || "",
        scheduleBId: record.scheduleBId || "",
        subjectBName: record.subjectBName || "",
        classBName: record.classBName || "",
        jpB: record.jpB || "",
        reason: record.reason || "",
        createdAt: now,
        createdByUserId: userId || "",
        createdByUserName: userName || ""
      };
      await addDoc(colRef, newExchange);

      // Fetch existing attendances for target date A to apply swapped status
      const { items: itemsA } = await this.getAttendanceForDate(record.date, "", "");
      const itemA = itemsA.find(i => i.scheduleId === record.scheduleAId);
      if (itemA) {
        itemA.status = "Tukar Jadwal";
        itemA.exchangedWithTeacherId = record.teacherBId;
        itemA.exchangedWithTeacherName = record.teacherBName;
        itemA.exchangedScheduleId = record.scheduleBId || "";
        itemA.notes = `Tukar Jadwal dengan ${record.teacherBName}${record.date !== targetDateB ? ` (Tgl ${targetDateB})` : ''}: ${record.reason}`;
      }
      await this.saveAttendanceForDate(
        record.date,
        itemsA,
        userId,
        userName,
        `Tukar Jadwal: ${record.reason}`
      );

      // If Sesi B on Date B was selected, fetch and update Date B
      if (record.scheduleBId) {
        const { items: itemsB } = await this.getAttendanceForDate(targetDateB, "", "");
        const itemB = itemsB.find(i => i.scheduleId === record.scheduleBId);
        if (itemB) {
          itemB.status = "Tukar Jadwal";
          itemB.exchangedWithTeacherId = record.teacherAId;
          itemB.exchangedWithTeacherName = record.teacherAName;
          itemB.exchangedScheduleId = record.scheduleAId;
          itemB.notes = `Tukar Jadwal dengan ${record.teacherAName}${record.date !== targetDateB ? ` (Tgl ${record.date})` : ''}: ${record.reason}`;
          await this.saveAttendanceForDate(
            targetDateB,
            itemsB,
            userId,
            userName,
            `Tukar Jadwal: ${record.reason}`
          );
        }
      }

      await logActivity(
        userId,
        userName,
        "Schedule Exchange",
        `Pertukaran jadwal antara ${record.teacherAName} (${record.date}) dan ${record.teacherBName} (${targetDateB})`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, SCHEDULE_EXCHANGES_COLLECTION);
    }
  },

  // Get Schedule Exchanges
  async getScheduleExchanges(startDate?: string, endDate?: string): Promise<ScheduleExchangeRecord[]> {
    try {
      const colRef = collection(db, SCHEDULE_EXCHANGES_COLLECTION);
      const snap = await getDocs(colRef);
      const items: ScheduleExchangeRecord[] = [];
      snap.forEach(d => {
        const data = d.data() as ScheduleExchangeRecord;
        if (startDate && data.date < startDate) return;
        if (endDate && data.date > endDate) return;
        items.push({ id: d.id, ...data });
      });
      items.sort((a, b) => b.date.localeCompare(a.date));
      return items;
    } catch (error) {
      console.error("Failed to fetch schedule exchanges:", error);
      return [];
    }
  },

  // Delete / Cancel Schedule Exchange and restore original schedules
  async deleteScheduleExchange(exchangeId: string, userId: string, userName: string): Promise<void> {
    try {
      const exchangeRef = doc(db, SCHEDULE_EXCHANGES_COLLECTION, exchangeId);
      const exchangeSnap = await getDoc(exchangeRef);
      if (!exchangeSnap.exists()) {
        throw new Error("Data tukar jadwal tidak ditemukan");
      }

      const exchange = exchangeSnap.data() as ScheduleExchangeRecord;
      const targetDateA = exchange.date;
      const targetDateB = exchange.dateB || exchange.date;

      // Revert Sesi A on Date A
      if (targetDateA && exchange.scheduleAId) {
        const { items: itemsA } = await this.getAttendanceForDate(targetDateA, "", "");
        const itemA = itemsA.find(i => i.scheduleId === exchange.scheduleAId);
        if (itemA) {
          itemA.status = "Hadir Mengajar";
          delete itemA.exchangedWithTeacherId;
          delete itemA.exchangedWithTeacherName;
          delete itemA.exchangedScheduleId;
          if (itemA.notes && itemA.notes.includes("Tukar Jadwal")) {
            itemA.notes = "";
          }
          await this.saveAttendanceForDate(
            targetDateA,
            itemsA,
            userId,
            userName,
            `Pembatalan Tukar Jadwal (Dikembalikan ke semula)`
          );
        }
      }

      // Revert Sesi B on Date B (if exists)
      if (targetDateB && exchange.scheduleBId) {
        const { items: itemsB } = await this.getAttendanceForDate(targetDateB, "", "");
        const itemB = itemsB.find(i => i.scheduleId === exchange.scheduleBId);
        if (itemB) {
          itemB.status = "Hadir Mengajar";
          delete itemB.exchangedWithTeacherId;
          delete itemB.exchangedWithTeacherName;
          delete itemB.exchangedScheduleId;
          if (itemB.notes && itemB.notes.includes("Tukar Jadwal")) {
            itemB.notes = "";
          }
          await this.saveAttendanceForDate(
            targetDateB,
            itemsB,
            userId,
            userName,
            `Pembatalan Tukar Jadwal (Dikembalikan ke semula)`
          );
        }
      }

      // Delete exchange document
      await deleteDoc(exchangeRef);

      await logActivity(
        userId,
        userName,
        "Cancel Schedule Exchange",
        `Membatalkan/Menghapus tukar jadwal antara ${exchange.teacherAName} (${targetDateA}) dan ${exchange.teacherBName} (${targetDateB})`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, SCHEDULE_EXCHANGES_COLLECTION);
    }
  },

  // Update Schedule Exchange reason / notes
  async updateScheduleExchange(
    exchangeId: string,
    newReason: string,
    userId: string,
    userName: string
  ): Promise<void> {
    try {
      const exchangeRef = doc(db, SCHEDULE_EXCHANGES_COLLECTION, exchangeId);
      const exchangeSnap = await getDoc(exchangeRef);
      if (!exchangeSnap.exists()) {
        throw new Error("Data tukar jadwal tidak ditemukan");
      }

      const exchange = exchangeSnap.data() as ScheduleExchangeRecord;
      const targetDateA = exchange.date;
      const targetDateB = exchange.dateB || exchange.date;

      await updateDoc(exchangeRef, {
        reason: newReason
      });

      // Update notes on Attendance A
      if (targetDateA && exchange.scheduleAId) {
        const { items: itemsA } = await this.getAttendanceForDate(targetDateA, "", "");
        const itemA = itemsA.find(i => i.scheduleId === exchange.scheduleAId);
        if (itemA) {
          itemA.notes = `Tukar Jadwal dengan ${exchange.teacherBName}${targetDateA !== targetDateB ? ` (Tgl ${targetDateB})` : ''}: ${newReason}`;
          await this.saveAttendanceForDate(
            targetDateA,
            itemsA,
            userId,
            userName,
            `Edit Alasan Tukar Jadwal: ${newReason}`
          );
        }
      }

      // Update notes on Attendance B
      if (targetDateB && exchange.scheduleBId) {
        const { items: itemsB } = await this.getAttendanceForDate(targetDateB, "", "");
        const itemB = itemsB.find(i => i.scheduleId === exchange.scheduleBId);
        if (itemB) {
          itemB.notes = `Tukar Jadwal dengan ${exchange.teacherAName}${targetDateA !== targetDateB ? ` (Tgl ${targetDateA})` : ''}: ${newReason}`;
          await this.saveAttendanceForDate(
            targetDateB,
            itemsB,
            userId,
            userName,
            `Edit Alasan Tukar Jadwal: ${newReason}`
          );
        }
      }

      await logActivity(
        userId,
        userName,
        "Update Schedule Exchange",
        `Memperbarui catatan/alasan tukar jadwal ID ${exchangeId}`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, SCHEDULE_EXCHANGES_COLLECTION);
    }
  },

  // Save/Update single session attendance with Audit Logging
  async saveSingleSessionAttendance(
    dateStr: string,
    item: TeacherTeachingAttendance,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const todayStr = new Date().toISOString().split("T")[0];
      const isPastDate = dateStr < todayStr;

      const docId = item.id || `${dateStr}_${item.scheduleId}`;
      const ref = doc(db, COLLECTION_NAME, docId);

      const existingSnap = await getDoc(ref);
      const existingData = existingSnap.exists() ? existingSnap.data() : null;

      const isSusulan = isPastDate || (existingData && existingData.recordedByUserId !== userId);
      const previousStatus = existingData ? existingData.status : "Belum Diverifikasi";

      const payload: any = {};
      Object.keys({
        ...item,
        id: docId,
        date: dateStr,
        isInputSusulan: isSusulan ? true : (item.isInputSusulan || false),
        recordedByUserId: userId,
        recordedByUserName: userName,
        updatedAt: timestamp,
        createdAt: item.createdAt || timestamp
      }).forEach(key => {
        const val = (item as any)[key];
        if (val !== undefined) payload[key] = val;
      });
      payload.id = docId;
      payload.date = dateStr;
      payload.isInputSusulan = isSusulan ? true : (item.isInputSusulan || false);
      payload.recordedByUserId = userId;
      payload.recordedByUserName = userName;
      payload.updatedAt = timestamp;
      payload.createdAt = item.createdAt || timestamp;

      await setDoc(ref, payload, { merge: true });

      // Record audit log if past date or status changed
      if (isPastDate || (existingData && previousStatus !== item.status)) {
        const auditColRef = collection(db, AUDIT_LOGS_COLLECTION);
        const auditLog: TeacherAttendanceAuditLog = {
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
          reason: reason || (isPastDate ? "Input / Koreksi Susulan Sesi Tanggal Lampau" : "Perubahan Status Absensi Sesi"),
          isLateInput: isPastDate
        };
        await addDoc(auditColRef, auditLog);
      }

      await logActivity(userId, userName, "Save Single Session Attendance", `Menyimpan absensi sesi ${item.teacherName} - ${item.subjectName} (${item.className}) tanggal ${dateStr}`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
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
        const previousStatus = existingData ? existingData.status : "Belum Diverifikasi";

        const payload: any = {};
        Object.keys({
          ...item,
          id: docId,
          date: dateStr,
          isInputSusulan: isSusulan ? true : (item.isInputSusulan || false),
          recordedByUserId: userId,
          recordedByUserName: userName,
          updatedAt: timestamp,
          createdAt: item.createdAt || timestamp
        }).forEach(key => {
          const val = (item as any)[key];
          if (val !== undefined) payload[key] = val;
        });
        payload.id = docId;
        payload.date = dateStr;
        payload.isInputSusulan = isSusulan ? true : (item.isInputSusulan || false);
        payload.recordedByUserId = userId;
        payload.recordedByUserName = userName;
        payload.updatedAt = timestamp;
        payload.createdAt = item.createdAt || timestamp;

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

        const unsubmitted = items.filter(item => !item.recordedByUserId || item.status === "Belum Diverifikasi").length;
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
    let terlambatCount = 0;
    let izinCount = 0;
    let sakitCount = 0;
    let tugasCount = 0;
    let tidakHadirCount = 0;
    let digantiCount = 0;
    let tukarJadwalCount = 0;
    let kbmDitiadakanCount = 0;
    let belumDiverifikasiCount = 0;

    items.forEach(i => {
      switch (i.status) {
        case "Hadir Mengajar":
          hadirCount++;
          break;
        case "Terlambat":
          terlambatCount++;
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
        case "Digantikan Guru Lain":
          digantiCount++;
          break;
        case "Tukar Jadwal":
          tukarJadwalCount++;
          break;
        case "KBM Ditiadakan":
          kbmDitiadakanCount++;
          break;
        case "Belum Diverifikasi":
        default:
          belumDiverifikasiCount++;
          break;
      }
    });

    const effectiveTotal = totalScheduledEncounters - kbmDitiadakanCount;
    const attendancePercentage = effectiveTotal > 0 
      ? Math.round(((hadirCount + terlambatCount + digantiCount + tukarJadwalCount) / effectiveTotal) * 100) 
      : (totalScheduledEncounters > 0 && isKbmDisabled ? 100 : 0);

    return {
      date: dateStr,
      day: dayName,
      totalScheduledEncounters,
      totalUniqueTeachersScheduled: uniqueTeachers.size,
      hadirCount,
      terlambatCount,
      izinCount,
      sakitCount,
      tugasCount,
      tidakHadirCount,
      digantiCount,
      tukarJadwalCount,
      kbmDitiadakanCount,
      belumDiverifikasiCount,
      attendancePercentage
    };
  },

  // Leadership Monitoring Metrics for Headmaster/Yayasan Dashboard
  async getLeadershipMonitoringStats(academicYearId?: string, semesterId?: string): Promise<LeadershipMonitoringStats> {
    try {
      const { rawRecords } = await this.getAttendanceRecap({ academicYearId, semesterId });
      
      let totalSubstitutionsSemester = 0;
      let totalExchangesSemester = 0;
      let totalValid = 0;
      let totalExecuted = 0;

      const subCountMap = new Map<string, { teacherName: string; count: number }>();
      const absentCountMap = new Map<string, { teacherName: string; count: number }>();

      rawRecords.forEach(rec => {
        if (rec.status === "KBM Ditiadakan") return;

        totalValid++;

        if (rec.status === "Digantikan Guru Lain") {
          totalSubstitutionsSemester++;
          totalExecuted++;
          if (rec.substituteTeacherId && rec.substituteTeacherName) {
            const existing = subCountMap.get(rec.substituteTeacherId) || { teacherName: rec.substituteTeacherName, count: 0 };
            existing.count++;
            subCountMap.set(rec.substituteTeacherId, existing);
          }
          const absent = absentCountMap.get(rec.teacherId) || { teacherName: rec.teacherName, count: 0 };
          absent.count++;
          absentCountMap.set(rec.teacherId, absent);
        } else if (rec.status === "Tukar Jadwal") {
          totalExchangesSemester++;
          totalExecuted++;
        } else if (rec.status === "Hadir Mengajar" || rec.status === "Terlambat") {
          totalExecuted++;
        } else if (rec.status === "Izin" || rec.status === "Sakit" || rec.status === "Tugas Dinas" || rec.status === "Tidak Hadir") {
          const absent = absentCountMap.get(rec.teacherId) || { teacherName: rec.teacherName, count: 0 };
          absent.count++;
          absentCountMap.set(rec.teacherId, absent);
        }
      });

      const kbmExecutionPercentage = totalValid > 0 ? Math.round((totalExecuted / totalValid) * 100) : 100;

      const topSubstituteTeachers = Array.from(subCountMap.entries())
        .map(([teacherId, val]) => ({ teacherId, teacherName: val.teacherName, count: val.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const topAbsentTeachers = Array.from(absentCountMap.entries())
        .map(([teacherId, val]) => ({ teacherId, teacherName: val.teacherName, count: val.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalSubstitutionsSemester,
        totalExchangesSemester,
        kbmExecutionPercentage,
        topSubstituteTeachers,
        topAbsentTeachers
      };
    } catch (error) {
      console.error("Error calculating leadership monitoring stats:", error);
      return {
        totalSubstitutionsSemester: 0,
        totalExchangesSemester: 0,
        kbmExecutionPercentage: 100,
        topSubstituteTeachers: [],
        topAbsentTeachers: []
      };
    }
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

      // Group by teacher with JP & Pertemuan calculations
      const map = new Map<string, TeacherAttendanceSummary>();

      rawRecords.forEach(rec => {
        const tId = rec.teacherId;
        const tName = rec.teacherName || "Guru";
        const recJP = parseJPCount(rec.jp);

        if (!map.has(tId)) {
          map.set(tId, createEmptySummary(tId, tName));
        }

        const sum = map.get(tId)!;
        sum.totalEncounters++;
        sum.totalJP += recJP;

        switch (rec.status) {
          case "Hadir Mengajar":
            sum.hadir++;
            sum.hadirJP += recJP;
            sum.executedEncounters++;
            sum.executedJP += recJP;
            break;

          case "Terlambat":
            sum.terlambat++;
            sum.terlambatJP += recJP;
            sum.executedEncounters++;
            sum.executedJP += recJP;
            break;

          case "Izin":
            sum.izin++;
            sum.izinJP += recJP;
            break;

          case "Sakit":
            sum.sakit++;
            sum.sakitJP += recJP;
            break;

          case "Tugas Dinas":
            sum.tugas++;
            sum.tugasJP += recJP;
            break;

          case "Tidak Hadir":
            sum.tidakHadir++;
            sum.tidakHadirJP += recJP;
            break;

          case "Digantikan Guru Lain":
            sum.diganti++;
            sum.digantiJP += recJP;
            // Substitute teacher actually executed this session
            if (rec.substituteTeacherId) {
              const subId = rec.substituteTeacherId;
              const subName = rec.substituteTeacherName || "Guru Pengganti";
              if (!map.has(subId)) {
                map.set(subId, createEmptySummary(subId, subName));
              }
              const subSum = map.get(subId)!;
              subSum.executedEncounters++;
              subSum.executedJP += recJP;
              subSum.hadir++;
              subSum.hadirJP += recJP;
            }
            break;

          case "Tukar Jadwal":
            sum.tukarJadwal++;
            sum.tukarJadwalJP += recJP;
            // Original teacher exchanged this slot out -> 0 executed JP for original teacher.
            // Credit teacher who took over (exchangedWithTeacherId)!
            if (rec.exchangedWithTeacherId) {
              const exId = rec.exchangedWithTeacherId;
              const exName = rec.exchangedWithTeacherName || "Guru Penukar";
              if (!map.has(exId)) {
                map.set(exId, createEmptySummary(exId, exName));
              }
              const exSum = map.get(exId)!;
              exSum.executedEncounters++;
              exSum.executedJP += recJP;
              exSum.tukarJadwalMasuk++;
              exSum.tukarJadwalMasukJP += recJP;
            }
            break;

          case "KBM Ditiadakan":
            sum.kbmDitiadakan++;
            sum.kbmDitiadakanJP += recJP;
            break;
        }
      });

      // Calculate percentage for each teacher based on executed JP vs total effective JP
      const summaries: TeacherAttendanceSummary[] = Array.from(map.values()).map(sum => {
        const effectiveJP = sum.totalJP - sum.kbmDitiadakanJP;
        const percentage = effectiveJP > 0
          ? Math.min(100, Math.round((sum.executedJP / effectiveJP) * 100))
          : (sum.totalJP > 0 && sum.executedJP > 0 ? 100 : 0);
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
