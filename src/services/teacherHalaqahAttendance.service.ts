import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  deleteDoc,
  updateDoc,
  query, 
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { 
  HalaqahSchedule, 
  TeacherHalaqahAttendance, 
  HalaqahAttendanceWidgetStats 
} from "../types/halaqahAttendance.types";
import { halaqahGroupService } from "./halaqahGroupService";
import { schoolAgendaService } from "./schoolAgenda.service";
import { schoolSettingsService } from "./schoolSettings.service";

const HALAQAH_ATTENDANCE_COLLECTION = "teacher_halaqah_attendances";
const HALAQAH_SCHEDULES_COLLECTION = "halaqah_schedules";

// Date & Time Helpers
export const getTodayDateStr = (): string => {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const year = parts.find(p => p.type === "year")?.value;
    const month = parts.find(p => p.type === "month")?.value;
    const day = parts.find(p => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  } catch (e) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
};

export const getIndonesianDayName = (dateStr?: string): string => {
  const dateObj = dateStr ? new Date(dateStr) : new Date();
  try {
    const dayName = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long"
    }).format(dateObj);
    return dayName.charAt(0).toUpperCase() + dayName.slice(1).toLowerCase();
  } catch (e) {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return days[dateObj.getDay()] || "Senin";
  }
};

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
};

// Default fallback times per day according to school routine schedule if not found in school_agendas
const DEFAULT_HALAQAH_AGENDA_TIMES: Record<string, { startTime: string; endTime: string }> = {
  "Sabtu": { startTime: "07:10", endTime: "08:20" },
  "Minggu": { startTime: "07:10", endTime: "08:15" },
  "Senin": { startTime: "07:50", endTime: "08:20" },
  "Selasa": { startTime: "07:10", endTime: "08:20" },
  "Rabu": { startTime: "07:10", endTime: "08:20" },
  "Kamis": { startTime: "07:10", endTime: "08:20" },
  "Jumat": { startTime: "07:10", endTime: "08:20" }
};

export const teacherHalaqahAttendanceService = {
  // Helper: Fetch SSOT time for Halaqah from school_agendas
  async getHalaqahAgendaTimeForDay(dayName: string): Promise<{ startTime: string; endTime: string; name: string }> {
    try {
      const agendas = await schoolAgendaService.getActiveAgendas();
      const matchedAgenda = agendas.find(a => 
        a.active !== false &&
        (a.day || "").toLowerCase() === dayName.toLowerCase() &&
        ((a.name || "").toLowerCase().includes("halaq") || (a.agendaType || "").toLowerCase().includes("halaq"))
      );

      if (matchedAgenda && matchedAgenda.startTime && matchedAgenda.endTime) {
        return {
          startTime: matchedAgenda.startTime,
          endTime: matchedAgenda.endTime,
          name: matchedAgenda.name || "HALAQOH QUR'AN"
        };
      }
    } catch (err) {
      console.warn("[Halaqah Service] Error getting active school agendas:", err);
    }

    // Fallback to default school routine time
    const fallback = DEFAULT_HALAQAH_AGENDA_TIMES[dayName] || { startTime: "07:10", endTime: "08:20" };
    return {
      startTime: fallback.startTime,
      endTime: fallback.endTime,
      name: "HALAQOH QUR'AN"
    };
  },

  // Helper: Get Active Days from schoolSettings
  async getActiveSchoolDays(): Promise<string[]> {
    try {
      const settings = await schoolSettingsService.getSettings();
      if (settings?.activeDays && Array.isArray(settings.activeDays) && settings.activeDays.length > 0) {
        return settings.activeDays;
      }
    } catch (e) {
      console.warn("[Halaqah Service] Error getting school settings activeDays:", e);
    }
    return ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];
  },

  // =========================================================================
  // 1. MASTER JADWAL HALAQAH
  // =========================================================================
  
  async getSchedules(params?: { academicYearId?: string; semesterId?: string }): Promise<HalaqahSchedule[]> {
    try {
      const groups = await halaqahGroupService.getGroups();
      const activeDays = await this.getActiveSchoolDays();
      const now = new Date().toISOString();

      // Read existing saved overrides in halaqah_schedules collection if any
      const colRef = collection(db, HALAQAH_SCHEDULES_COLLECTION);
      const querySnapshot = await getDocs(colRef);
      const existingOverrides = new Map<string, HalaqahSchedule>();
      
      querySnapshot.forEach((docSnap) => {
        existingOverrides.set(docSnap.id, {
          id: docSnap.id,
          ...docSnap.data()
        } as HalaqahSchedule);
      });

      const items: HalaqahSchedule[] = [];

      // Generate dynamic schedules for ALL master groups and active days
      for (const group of groups) {
        for (const day of activeDays) {
          const scheduleId = `SCH_${group.id}_${day}`;
          const existing = existingOverrides.get(scheduleId);
          const agendaTime = await this.getHalaqahAgendaTimeForDay(day);

          const schedule: HalaqahSchedule = {
            id: scheduleId,
            day,
            startTime: existing?.startTime || agendaTime.startTime,
            endTime: existing?.endTime || agendaTime.endTime,
            groupId: group.id,
            groupName: group.groupName || `Group ${group.id}`,
            teacherId: group.musrifId || existing?.teacherId || "GURU_HALAQAH",
            teacherName: group.musrifName || existing?.teacherName || "Ustadz Pembimbing",
            academicYearId: params?.academicYearId || existing?.academicYearId || "AY_ACTIVE",
            semesterId: params?.semesterId || existing?.semesterId || "SEM_ACTIVE",
            isActive: existing?.isActive !== undefined ? existing.isActive : true,
            createdAt: existing?.createdAt || now,
            updatedAt: now
          };

          items.push(schedule);
        }
      }

      return items;
    } catch (error) {
      console.warn("[Halaqah Service] Error fetching schedules, auto-seeding dynamic defaults:", error);
      return [];
    }
  },

  async saveSchedule(schedule: Partial<HalaqahSchedule> & { id?: string }): Promise<HalaqahSchedule> {
    const colRef = collection(db, HALAQAH_SCHEDULES_COLLECTION);
    const docId = schedule.id || doc(colRef).id;
    const docRef = doc(db, HALAQAH_SCHEDULES_COLLECTION, docId);
    const now = new Date().toISOString();

    const fullSchedule: HalaqahSchedule = {
      id: docId,
      day: schedule.day || "Senin",
      startTime: schedule.startTime || "07:10",
      endTime: schedule.endTime || "08:20",
      groupId: schedule.groupId || "",
      groupName: schedule.groupName || "",
      teacherId: schedule.teacherId || "",
      teacherName: schedule.teacherName || "",
      academicYearId: schedule.academicYearId || "AY_ACTIVE",
      semesterId: schedule.semesterId || "SEM_ACTIVE",
      isActive: schedule.isActive !== undefined ? schedule.isActive : true,
      createdAt: schedule.createdAt || now,
      updatedAt: now
    };

    try {
      await setDoc(docRef, fullSchedule);
      return fullSchedule;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${HALAQAH_SCHEDULES_COLLECTION}/${docId}`);
    }
  },

  async deleteSchedule(scheduleId: string): Promise<void> {
    const docRef = doc(db, HALAQAH_SCHEDULES_COLLECTION, scheduleId);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${HALAQAH_SCHEDULES_COLLECTION}/${scheduleId}`);
    }
  },

  // =========================================================================
  // 2. PROCESS QR CHECK-IN / CHECK-OUT ENGINE
  // =========================================================================

  async processQrCheckIn(params: {
    scannedContent: string;
    currentUser: {
      id?: string;
      uid?: string;
      teacherId?: string;
      name: string;
      role?: string;
      roles?: string[];
    };
    customTimeStr?: string;
    academicYearId?: string;
    semesterId?: string;
  }): Promise<{
    success: boolean;
    action?: "CHECK_IN" | "CHECK_OUT";
    message: string;
    isAlreadyCompleted?: boolean;
    groupId?: string;
    groupName?: string;
    shouldOpenJournal?: boolean;
    record?: TeacherHalaqahAttendance;
  }> {
    try {
      const rawContent = params.scannedContent.trim();
      let parsedJson: any = null;
      let targetGroupId = "";

      // Step 1. Parse QR content
      try {
        if ((rawContent.startsWith("{") && rawContent.endsWith("}")) || rawContent.includes("halaqah")) {
          parsedJson = JSON.parse(rawContent);
          targetGroupId = parsedJson.groupId || parsedJson.id || targetGroupId;
        }
      } catch (e) {
        // Plain text fallback
      }

      if (!targetGroupId) {
        if (rawContent.toLowerCase().startsWith("halaqah_qr:")) {
          targetGroupId = rawContent.substring(11).trim();
        } else {
          targetGroupId = rawContent;
        }
      }

      // Step 2. Verify Master Group Halaqah (All 4 groups fetched from SSOT)
      const groups = await halaqahGroupService.getGroups();
      const matchedGroup = groups.find(g => 
        g.id.toLowerCase() === targetGroupId.toLowerCase() ||
        (g.groupName && g.groupName.toLowerCase() === targetGroupId.toLowerCase()) ||
        (parsedJson?.groupName && g.groupName.toLowerCase() === parsedJson.groupName.toLowerCase())
      );

      if (!matchedGroup) {
        return {
          success: false,
          message: `QR Code Halaqah tidak mengenali Group ID '${targetGroupId}'. Pastikan QR yang dipindai adalah QR Group Halaqah yang sah.`
        };
      }

      const groupId = matchedGroup.id;
      const groupName = matchedGroup.groupName;

      // Step 3. Date & Time context
      const todayStr = getTodayDateStr();
      const currentDayName = getIndonesianDayName(todayStr);

      const now = new Date();
      let defaultTimeStr = "";
      try {
        defaultTimeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      } catch (e) {
        defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }
      const currentTimeStr = params.customTimeStr || defaultTimeStr;
      const currentM = parseTimeToMinutes(currentTimeStr);

      // Step 4. Validate Master Schedule (Using SSOT School Agenda Time)
      const agendaTime = await this.getHalaqahAgendaTimeForDay(currentDayName);
      const scheduledStartTime = agendaTime.startTime;
      const scheduledEndTime = agendaTime.endTime;

      // Step 5. Validate Teacher Assignment
      const userTeacherId = params.currentUser.teacherId || params.currentUser.id || params.currentUser.uid || "";
      const userNameNorm = (params.currentUser.name || "").toLowerCase().trim();

      const groupMusrifId = matchedGroup.musrifId || "";
      const groupMusrifName = (matchedGroup.musrifName || "").toLowerCase().trim();

      const isAdminOrPimpinan = 
        params.currentUser.role === "admin" ||
        params.currentUser.role === "wakil kepala sekolah" ||
        params.currentUser.role === "kepala sekolah" ||
        params.currentUser.role === "pimpinan" ||
        (params.currentUser.roles && (
          params.currentUser.roles.includes("admin") ||
          params.currentUser.roles.includes("wakil kepala sekolah") ||
          params.currentUser.roles.includes("wakakur")
        ));

      const isTeacherAssigned = 
        groupMusrifId === userTeacherId ||
        (groupMusrifName && groupMusrifName === userNameNorm) ||
        isAdminOrPimpinan;

      if (!isTeacherAssigned) {
        return {
          success: false,
          message: `Ditolak: Anda (${params.currentUser.name}) bukan Guru Pembimbing resmi untuk ${groupName}.\n\nPembimbing Resmi: ${matchedGroup.musrifName || "Ustadz Pembimbing"}.`
        };
      }

      // Step 6. Check Existing Attendance in Firestore (teacher_halaqah_attendances)
      const attendancesCol = collection(db, HALAQAH_ATTENDANCE_COLLECTION);
      const q = query(
        attendancesCol, 
        where("groupId", "==", groupId),
        where("date", "==", todayStr)
      );

      const snapshot = await getDocs(q);
      const existingRecords: TeacherHalaqahAttendance[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as TeacherHalaqahAttendance;
        existingRecords.push({ id: docSnap.id, ...data });
      });

      const existingRecord = existingRecords.length > 0 ? existingRecords[0] : null;

      if (existingRecord) {
        // Case A: Already Checked Out
        if (existingRecord.checkOutTime) {
          return {
            success: false,
            isAlreadyCompleted: true,
            groupId,
            groupName,
            message: `Absensi Halaqah hari ini sudah selesai.\n\nCheck In:\n${existingRecord.checkInTime} WIB\n\nCheck Out:\n${existingRecord.checkOutTime} WIB`
          };
        }

        // Case B: Has Check In, evaluating Check Out or Double Scan
        const checkInM = parseTimeToMinutes(existingRecord.checkInTime);
        const durationM = Math.max(0, currentM - checkInM);

        let secondsSinceCheckIn = durationM * 60;
        if (existingRecord.updatedAt || (existingRecord as any).createdAt) {
          const lastMs = new Date(existingRecord.updatedAt || (existingRecord as any).createdAt).getTime();
          if (!isNaN(lastMs)) {
            secondsSinceCheckIn = Math.floor((Date.now() - lastMs) / 1000);
          }
        }

        // DOUBLE SCAN PROTECTION RULE:
        // Scan within short duration (e.g., < 60 seconds or duration < 1 min) MUST NOT perform check-out!
        if (secondsSinceCheckIn < 60 || durationM < 1) {
          const formattedCheckIn = existingRecord.checkInTime.replace(":", ".");
          return {
            success: true,
            action: "CHECK_IN",
            isAlreadyCompleted: false,
            groupId,
            groupName,
            message: `Scan terdeteksi kembali.\nCheck-in Anda sudah tercatat pukul ${formattedCheckIn}.\nCheck-out dilakukan setelah pembelajaran selesai.`,
            record: existingRecord
          };
        }

        // Proceed to CHECK-OUT
        const updatedDocRef = doc(db, HALAQAH_ATTENDANCE_COLLECTION, existingRecord.id);
        const updateData: Partial<TeacherHalaqahAttendance> = {
          checkOutTime: currentTimeStr,
          duration: durationM,
          status: "Selesai Membimbing",
          updatedAt: new Date().toISOString()
        };

        await updateDoc(updatedDocRef, updateData);

        const updatedRecord: TeacherHalaqahAttendance = {
          ...existingRecord,
          ...updateData
        };

        return {
          success: true,
          action: "CHECK_OUT",
          groupId,
          groupName,
          message: `CHECK-OUT BERHASIL\n\n${groupName}\nPembimbing: ${params.currentUser.name}\nCheck-out: ${currentTimeStr} WIB\nDurasi: ${durationM} menit`,
          record: updatedRecord
        };
      }

      // Step 7. Check In Case
      const startM = parseTimeToMinutes(scheduledStartTime);
      const isLate = currentM > (startM + 15);
      const initialStatus = isLate ? "Terlambat" : "Tepat Waktu";

      const newDocRef = doc(collection(db, HALAQAH_ATTENDANCE_COLLECTION));
      const nowIso = new Date().toISOString();

      const newRecord: TeacherHalaqahAttendance = {
        id: newDocRef.id,
        teacherId: userTeacherId || matchedGroup.musrifId || "GURU_HALAQAH",
        teacherName: params.currentUser.name || matchedGroup.musrifName || "Ustadz Pembimbing",
        groupId,
        groupName,
        date: todayStr,
        dayName: currentDayName,
        checkInTime: currentTimeStr,
        checkOutTime: "",
        duration: 0,
        status: initialStatus,
        academicYearId: params.academicYearId || "AY_ACTIVE",
        semesterId: params.semesterId || "SEM_ACTIVE",
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(newDocRef, newRecord);

      return {
        success: true,
        action: "CHECK_IN",
        groupId,
        groupName,
        message: `CHECK-IN BERHASIL\n\n${groupName}\nPembimbing: ${params.currentUser.name}\nWaktu Check-in: ${currentTimeStr} WIB (${initialStatus})\nJadwal Resmi: ${scheduledStartTime} - ${scheduledEndTime} WIB`,
        record: newRecord
      };

    } catch (error: any) {
      console.error("Error in processQrCheckIn for Halaqah:", error);
      return {
        success: false,
        message: `Terjadi kesalahan sistem saat memproses absensi Halaqah: ${error?.message || "Internal server error"}`
      };
    }
  },

  // Manual Check-In / Check-Out
  async recordManualAttendance(params: {
    groupId: string;
    groupName: string;
    teacherId: string;
    teacherName: string;
    date: string;
    checkInTime: string;
    checkOutTime?: string;
    status?: string;
    academicYearId?: string;
    semesterId?: string;
  }): Promise<TeacherHalaqahAttendance> {
    const todayStr = params.date || getTodayDateStr();
    const dayName = getIndonesianDayName(todayStr);

    const checkInM = parseTimeToMinutes(params.checkInTime);
    const checkOutM = params.checkOutTime ? parseTimeToMinutes(params.checkOutTime) : 0;
    const durationM = checkOutM > checkInM ? checkOutM - checkInM : 0;

    const attendancesCol = collection(db, HALAQAH_ATTENDANCE_COLLECTION);
    const q = query(
      attendancesCol,
      where("groupId", "==", params.groupId),
      where("date", "==", todayStr)
    );

    const snapshot = await getDocs(q);
    const nowIso = new Date().toISOString();

    if (!snapshot.empty) {
      const existingDoc = snapshot.docs[0];
      const docRef = doc(db, HALAQAH_ATTENDANCE_COLLECTION, existingDoc.id);
      
      const updateData: Partial<TeacherHalaqahAttendance> = {
        teacherId: params.teacherId,
        teacherName: params.teacherName,
        checkInTime: params.checkInTime,
        checkOutTime: params.checkOutTime || "",
        duration: durationM,
        status: params.status || (params.checkOutTime ? "Selesai Membimbing" : "Hadir (Manual)"),
        updatedAt: nowIso
      };

      await updateDoc(docRef, updateData);
      return { id: existingDoc.id, ...existingDoc.data(), ...updateData } as TeacherHalaqahAttendance;
    } else {
      const newDocRef = doc(collection(db, HALAQAH_ATTENDANCE_COLLECTION));
      const newRecord: TeacherHalaqahAttendance = {
        id: newDocRef.id,
        teacherId: params.teacherId,
        teacherName: params.teacherName,
        groupId: params.groupId,
        groupName: params.groupName,
        date: todayStr,
        dayName,
        checkInTime: params.checkInTime,
        checkOutTime: params.checkOutTime || "",
        duration: durationM,
        status: params.status || (params.checkOutTime ? "Selesai Membimbing" : "Hadir (Manual)"),
        academicYearId: params.academicYearId || "AY_ACTIVE",
        semesterId: params.semesterId || "SEM_ACTIVE",
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(newDocRef, newRecord);
      return newRecord;
    }
  },

  // =========================================================================
  // 3. DAILY OVERVIEW & REKAP
  // =========================================================================

  async getDailyHalaqahOverview(dateStr: string, academicYearId?: string, semesterId?: string): Promise<{
    date: string;
    dayName: string;
    isSchoolDay: boolean;
    isLibur: boolean;
    agendaName: string;
    startTime: string;
    endTime: string;
    sessionStatus: "Belum Dimulai" | "Sedang Berlangsung" | "Selesai" | "Libur Sekolah";
    groups: Array<{
      groupId: string;
      groupName: string;
      category?: string;
      room?: string;
      musrifId: string;
      musrifName: string;
      startTime: string;
      endTime: string;
      checkInTime: string;
      checkOutTime: string;
      duration: number;
      status: string;
      attendanceRecord?: TeacherHalaqahAttendance;
    }>;
  }> {
    const dayName = getIndonesianDayName(dateStr);
    const activeDays = await this.getActiveSchoolDays();
    const isSchoolDay = activeDays.map(d => d.toLowerCase()).includes(dayName.toLowerCase());

    const agenda = await this.getHalaqahAgendaTimeForDay(dayName);
    const groupsMaster = await halaqahGroupService.getGroups();
    const actualRecords = await this.getAttendanceForDate(dateStr, academicYearId, semesterId);

    const actualMap = new Map<string, TeacherHalaqahAttendance>();
    actualRecords.forEach(r => actualMap.set(r.groupId, r));

    // Session status logic
    const todayStr = getTodayDateStr();
    let sessionStatus: "Belum Dimulai" | "Sedang Berlangsung" | "Selesai" | "Libur Sekolah" = "Belum Dimulai";

    if (!isSchoolDay) {
      sessionStatus = "Libur Sekolah";
    } else {
      const now = new Date();
      let nowTimeStr = "";
      try {
        nowTimeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      } catch (e) {
        nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }

      const nowM = parseTimeToMinutes(nowTimeStr);
      const startM = parseTimeToMinutes(agenda.startTime);
      const endM = parseTimeToMinutes(agenda.endTime);

      if (dateStr < todayStr) {
        sessionStatus = "Selesai";
      } else if (dateStr > todayStr) {
        sessionStatus = "Belum Dimulai";
      } else {
        if (nowM < startM) sessionStatus = "Belum Dimulai";
        else if (nowM >= startM && nowM <= endM + 30) sessionStatus = "Sedang Berlangsung";
        else sessionStatus = "Selesai";
      }
    }

    const groupsList = groupsMaster.map(g => {
      const actual = actualMap.get(g.id);
      let status = "Belum Check-in";

      if (!isSchoolDay) {
        status = "Libur";
      } else if (actual) {
        if (actual.checkOutTime) {
          status = "Selesai Membimbing";
        } else if (actual.checkInTime) {
          status = "Sedang Membimbing";
        } else {
          status = actual.status || "Hadir";
        }
      } else {
        if (dateStr < todayStr) {
          status = "Tidak Hadir";
        } else if (sessionStatus === "Selesai") {
          status = "Tidak Hadir";
        } else {
          status = "Belum Check-in";
        }
      }

      return {
        groupId: g.id,
        groupName: g.groupName || `Kelompok ${g.id}`,
        category: g.category || "tahfidz",
        room: g.room || "Ruang Halaqah",
        musrifId: g.musrifId || "GURU_HALAQAH",
        musrifName: g.musrifName || "Ustadz Pembimbing",
        startTime: agenda.startTime,
        endTime: agenda.endTime,
        checkInTime: actual?.checkInTime || "-",
        checkOutTime: actual?.checkOutTime || "-",
        duration: actual?.duration || 0,
        status,
        attendanceRecord: actual
      };
    });

    return {
      date: dateStr,
      dayName,
      isSchoolDay,
      isLibur: !isSchoolDay,
      agendaName: agenda.name,
      startTime: agenda.startTime,
      endTime: agenda.endTime,
      sessionStatus,
      groups: groupsList
    };
  },

  async getAttendanceForDate(dateStr: string, academicYearId?: string, semesterId?: string): Promise<TeacherHalaqahAttendance[]> {
    try {
      const colRef = collection(db, HALAQAH_ATTENDANCE_COLLECTION);
      const q = query(colRef, where("date", "==", dateStr));
      const querySnapshot = await getDocs(q);
      const items: TeacherHalaqahAttendance[] = [];

      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as TeacherHalaqahAttendance);
      });

      return items;
    } catch (error) {
      console.error("Error fetching Halaqah attendance for date:", error);
      return [];
    }
  },

  async getAttendanceForDateRange(startDate: string, endDate: string, academicYearId?: string, semesterId?: string): Promise<TeacherHalaqahAttendance[]> {
    try {
      const colRef = collection(db, HALAQAH_ATTENDANCE_COLLECTION);
      const q = query(
        colRef,
        where("date", ">=", startDate),
        where("date", "<=", endDate)
      );
      const querySnapshot = await getDocs(q);
      const items: TeacherHalaqahAttendance[] = [];

      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as TeacherHalaqahAttendance);
      });

      return items;
    } catch (error) {
      console.error("Error fetching Halaqah attendance range:", error);
      try {
        const colRef = collection(db, HALAQAH_ATTENDANCE_COLLECTION);
        const querySnapshot = await getDocs(colRef);
        const items: TeacherHalaqahAttendance[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data() as TeacherHalaqahAttendance;
          if (data.date && data.date >= startDate && data.date <= endDate) {
            items.push({ id: docSnap.id, ...data });
          }
        });
        return items;
      } catch (err) {
        return [];
      }
    }
  },

  async getHalaqahWidgetStats(todayStr: string, academicYearId?: string, semesterId?: string): Promise<HalaqahAttendanceWidgetStats> {
    try {
      const overview = await this.getDailyHalaqahOverview(todayStr, academicYearId, semesterId);
      const groups = overview.groups;

      const totalTeachers = groups.length;
      let alreadyCheckedIn = 0;
      let currentlyMentoring = 0;
      let alreadyCheckedOut = 0;
      let notYetAttended = 0;

      const records: TeacherHalaqahAttendance[] = [];

      groups.forEach(g => {
        if (g.attendanceRecord) {
          records.push(g.attendanceRecord);
          if (g.checkOutTime && g.checkOutTime !== "-") {
            alreadyCheckedOut++;
            alreadyCheckedIn++;
          } else if (g.checkInTime && g.checkInTime !== "-") {
            currentlyMentoring++;
            alreadyCheckedIn++;
          }
        } else {
          notYetAttended++;
        }
      });

      const attendancePercentage = totalTeachers > 0 
        ? Math.round((alreadyCheckedIn / totalTeachers) * 100)
        : 0;

      return {
        date: todayStr,
        totalTeachers,
        alreadyCheckedIn,
        currentlyMentoring,
        alreadyCheckedOut,
        notYetAttended,
        attendancePercentage,
        records
      };
    } catch (error) {
      console.error("Error fetching widget stats for Halaqah:", error);
      return {
        date: todayStr,
        totalTeachers: 0,
        alreadyCheckedIn: 0,
        currentlyMentoring: 0,
        alreadyCheckedOut: 0,
        notYetAttended: 0,
        attendancePercentage: 0,
        records: []
      };
    }
  },

  async getHalaqahAttendanceRecap(params: {
    startDate: string;
    endDate: string;
    academicYearId?: string;
    semesterId?: string;
  }): Promise<{
    records: Array<TeacherHalaqahAttendance & { startTime?: string; endTime?: string; isExpectedMissing?: boolean }>;
    summaries: Array<{
      teacherId: string;
      teacherName: string;
      totalExpected: number;
      totalActual: number;
      hadir: number;
      tepatWaktu: number;
      terlambat: number;
      susulan: number;
      tidakHadir: number;
      belumCheckOut: number;
      percentage: number;
    }>;
    overallStats: {
      totalExpected: number;
      totalActual: number;
      totalHadir: number;
      totalTerlambat: number;
      totalSusulan: number;
      totalTidakHadir: number;
      totalBelumCheckOut: number;
      attendancePercentage: number;
    };
  }> {
    const { startDate, endDate, academicYearId, semesterId } = params;

    try {
      const [actualRecords, groups, activeDays] = await Promise.all([
        this.getAttendanceForDateRange(startDate, endDate, academicYearId, semesterId),
        halaqahGroupService.getGroups(),
        this.getActiveSchoolDays()
      ]);

      const activeDaysLower = activeDays.map(d => d.toLowerCase());

      // Generate date array from startDate to endDate
      const dates: string[] = [];
      const curr = new Date(startDate);
      const last = new Date(endDate);

      while (curr <= last) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, "0");
        const d = String(curr.getDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
        curr.setDate(curr.getDate() + 1);
      }

      const actualMap = new Map<string, TeacherHalaqahAttendance>();
      actualRecords.forEach(rec => {
        const key1 = `${rec.date}_${rec.groupId}_${rec.teacherId}`;
        const key2 = `${rec.date}_${rec.groupId}`;
        actualMap.set(key1, rec);
        if (!actualMap.has(key2)) {
          actualMap.set(key2, rec);
        }
      });

      const todayStr = getTodayDateStr();
      const combinedRecords: Array<TeacherHalaqahAttendance & { startTime?: string; endTime?: string; isExpectedMissing?: boolean }> = [];
      
      const teacherMap = new Map<string, {
        teacherId: string;
        teacherName: string;
        totalExpected: number;
        totalActual: number;
        hadir: number;
        tepatWaktu: number;
        terlambat: number;
        susulan: number;
        tidakHadir: number;
        belumCheckOut: number;
      }>();

      const getTeacherEntry = (tId: string, tName: string) => {
        const id = tId || tName;
        if (!teacherMap.has(id)) {
          teacherMap.set(id, {
            teacherId: id,
            teacherName: tName || "Ust. Pembimbing",
            totalExpected: 0,
            totalActual: 0,
            hadir: 0,
            tepatWaktu: 0,
            terlambat: 0,
            susulan: 0,
            tidakHadir: 0,
            belumCheckOut: 0
          });
        }
        return teacherMap.get(id)!;
      };

      groups.forEach(g => {
        if (g.musrifId || g.musrifName) {
          getTeacherEntry(g.musrifId || g.musrifName, g.musrifName || "Ust. Pembimbing");
        }
      });

      // Iterate through dates
      for (const dateStr of dates) {
        const dayName = getIndonesianDayName(dateStr);
        // Only skip if day is NOT in activeDays (e.g., Friday)
        if (!activeDaysLower.includes(dayName.toLowerCase())) continue;

        const agenda = await this.getHalaqahAgendaTimeForDay(dayName);

        for (const group of groups) {
          const tId = group.musrifId || "GURU_HALAQAH";
          const tName = group.musrifName || "Ust. Pembimbing";
          const entry = getTeacherEntry(tId, tName);

          entry.totalExpected++;

          const key1 = `${dateStr}_${group.id}_${tId}`;
          const key2 = `${dateStr}_${group.id}`;
          const actual = actualMap.get(key1) || actualMap.get(key2);

          if (actual) {
            entry.totalActual++;
            const startM = parseTimeToMinutes(agenda.startTime || "07:10");
            const checkInM = parseTimeToMinutes(actual.checkInTime || "00:00");

            let computedStatus = actual.status || "Hadir";

            if (actual.checkOutTime) {
              if (checkInM > startM + 15) {
                entry.terlambat++;
                computedStatus = "Terlambat";
              } else {
                entry.tepatWaktu++;
                computedStatus = "Tepat Waktu";
              }
              entry.hadir++;
            } else if (actual.checkInTime) {
              entry.belumCheckOut++;
              computedStatus = "Belum Check-out";
              entry.hadir++;
            }

            if (actual.status?.toLowerCase().includes("susulan")) {
              entry.susulan++;
            }

            combinedRecords.push({
              ...actual,
              teacherId: tId,
              teacherName: tName,
              startTime: agenda.startTime,
              endTime: agenda.endTime,
              status: computedStatus,
              isExpectedMissing: false
            });
          } else {
            if (dateStr <= todayStr) {
              entry.tidakHadir++;
            }
            combinedRecords.push({
              id: `EXPECTED_MISSING_${dateStr}_${group.id}`,
              teacherId: tId,
              teacherName: tName,
              groupId: group.id,
              groupName: group.groupName || `Group ${group.id}`,
              date: dateStr,
              dayName,
              checkInTime: "-",
              checkOutTime: "-",
              duration: 0,
              status: dateStr <= todayStr ? "Tidak Hadir" : "Belum Dilaksanakan",
              academicYearId: academicYearId || "AY_ACTIVE",
              semesterId: semesterId || "SEM_ACTIVE",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              startTime: agenda.startTime,
              endTime: agenda.endTime,
              isExpectedMissing: true
            });
          }
        }
      }

      const summaries = Array.from(teacherMap.values()).map(entry => {
        const percentage = entry.totalExpected > 0 
          ? Math.min(100, Math.round((entry.hadir / entry.totalExpected) * 100 * 100) / 100)
          : (entry.totalActual > 0 ? 100 : 0);

        return {
          ...entry,
          percentage
        };
      });

      let totalExpected = 0;
      let totalActual = 0;
      let totalHadir = 0;
      let totalTerlambat = 0;
      let totalSusulan = 0;
      let totalTidakHadir = 0;
      let totalBelumCheckOut = 0;

      summaries.forEach(s => {
        totalExpected += s.totalExpected;
        totalActual += s.totalActual;
        totalHadir += s.hadir;
        totalTerlambat += s.terlambat;
        totalSusulan += s.susulan;
        totalTidakHadir += s.tidakHadir;
        totalBelumCheckOut += s.belumCheckOut;
      });

      const attendancePercentage = totalExpected > 0 
        ? Math.min(100, Math.round((totalHadir / totalExpected) * 100 * 100) / 100)
        : (totalActual > 0 ? 100 : 0);

      return {
        records: combinedRecords.sort((a, b) => b.date.localeCompare(a.date)),
        summaries: summaries.sort((a, b) => a.teacherName.localeCompare(b.teacherName)),
        overallStats: {
          totalExpected,
          totalActual,
          totalHadir,
          totalTerlambat,
          totalSusulan,
          totalTidakHadir,
          totalBelumCheckOut,
          attendancePercentage
        }
      };
    } catch (error) {
      console.error("Error generating Halaqah attendance recap:", error);
      return {
        records: [],
        summaries: [],
        overallStats: {
          totalExpected: 0,
          totalActual: 0,
          totalHadir: 0,
          totalTerlambat: 0,
          totalSusulan: 0,
          totalTidakHadir: 0,
          totalBelumCheckOut: 0,
          attendancePercentage: 0
        }
      };
    }
  }
};
