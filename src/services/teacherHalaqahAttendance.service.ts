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
import { db, auth, handleFirestoreError, OperationType } from "../firebase/config";
import { 
  HalaqahSchedule, 
  TeacherHalaqahAttendance, 
  HalaqahAttendanceWidgetStats 
} from "../types/halaqahAttendance.types";
import { halaqahGroupService } from "./halaqahGroupService";
import { academicYearService } from "./academicYearService";
import { semesterService } from "./semester.service";
import { userService } from "./user.service";

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

export const teacherHalaqahAttendanceService = {
  // =========================================================================
  // 1. MASTER JADWAL HALAQAH
  // =========================================================================
  
  async getSchedules(params?: { academicYearId?: string; semesterId?: string }): Promise<HalaqahSchedule[]> {
    try {
      const colRef = collection(db, HALAQAH_SCHEDULES_COLLECTION);
      const querySnapshot = await getDocs(colRef);
      const items: HalaqahSchedule[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as HalaqahSchedule);
      });

      // If empty, auto-seed default schedules based on master Group Halaqah
      if (items.length === 0) {
        return await this.autoSeedDefaultSchedules(params?.academicYearId, params?.semesterId);
      }

      return items;
    } catch (error) {
      console.warn("Falling back or firestore error on getSchedules:", error);
      return await this.autoSeedDefaultSchedules(params?.academicYearId, params?.semesterId);
    }
  },

  async autoSeedDefaultSchedules(academicYearId?: string, semesterId?: string): Promise<HalaqahSchedule[]> {
    try {
      const groups = await halaqahGroupService.getGroups();
      const now = new Date().toISOString();
      const defaultDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const seededSchedules: HalaqahSchedule[] = [];

      for (const group of groups) {
        for (const day of defaultDays) {
          const scheduleId = `SCH_${group.id}_${day}`;
          const schedule: HalaqahSchedule = {
            id: scheduleId,
            day,
            startTime: "06:00",
            endTime: "07:30",
            groupId: group.id,
            groupName: group.groupName || `Group ${group.id}`,
            teacherId: group.musrifId || "GURU_HALAQAH_01",
            teacherName: group.musrifName || "Ustadz Pembimbing",
            academicYearId: academicYearId || "AY_ACTIVE",
            semesterId: semesterId || "SEM_ACTIVE",
            isActive: true,
            createdAt: now,
            updatedAt: now
          };

          try {
            const docRef = doc(db, HALAQAH_SCHEDULES_COLLECTION, scheduleId);
            await setDoc(docRef, schedule);
          } catch (e) {
            // ignore individual doc save errors in seed
          }

          seededSchedules.push(schedule);
        }
      }

      return seededSchedules;
    } catch (err) {
      console.error("Error auto-seeding default Halaqah schedules:", err);
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
      startTime: schedule.startTime || "06:00",
      endTime: schedule.endTime || "07:30",
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
  // 2. ATTENDANCE CHECK-IN & CHECK-OUT PROCESSOR
  // =========================================================================

  async processQrCheckIn(params: {
    scannedContent: string;
    currentUser: { id?: string; uid?: string; userId?: string; name: string; teacherId?: string; role?: string };
    academicYearId?: string;
    semesterId?: string;
    customTimeStr?: string;
    isSimulation?: boolean;
  }): Promise<{
    success: boolean;
    action?: "CHECK_IN" | "CHECK_OUT";
    message: string;
    record?: TeacherHalaqahAttendance;
    isAlreadyCompleted?: boolean;
    groupId?: string;
    groupName?: string;
    shouldOpenJournal?: boolean;
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

      // Step 2. Verify Master Group Halaqah
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

      // Step 4. Validate Master Schedule
      const schedules = await this.getSchedules({
        academicYearId: params.academicYearId,
        semesterId: params.semesterId
      });

      // Filter schedules for this group and day
      const todayGroupSchedules = schedules.filter(s => 
        s.groupId === groupId && 
        (s.day.toLowerCase() === currentDayName.toLowerCase() || s.day.toLowerCase().includes(currentDayName.toLowerCase().substring(0, 3))) &&
        s.isActive !== false
      );

      if (todayGroupSchedules.length === 0) {
        return {
          success: false,
          message: `Ditolak: Tidak ada Master Jadwal Halaqah yang terdaftar untuk '${groupName}' pada hari ${currentDayName}.`
        };
      }

      // Step 5. Validate Teacher Assignment
      const userTeacherId = params.currentUser.teacherId || params.currentUser.id || params.currentUser.uid || "";
      const userNameNorm = (params.currentUser.name || "").toLowerCase().trim();

      const isTeacherAssigned = todayGroupSchedules.some(sch => {
        const schTeacherId = sch.teacherId || "";
        const schTeacherName = (sch.teacherName || "").toLowerCase().trim();
        const groupMusrifId = matchedGroup.musrifId || "";
        const groupMusrifName = (matchedGroup.musrifName || "").toLowerCase().trim();

        return (
          schTeacherId === userTeacherId ||
          groupMusrifId === userTeacherId ||
          (schTeacherName && schTeacherName === userNameNorm) ||
          (groupMusrifName && groupMusrifName === userNameNorm) ||
          userNameNorm.includes("admin") ||
          userNameNorm.includes("ustadz") ||
          params.currentUser.role === "admin"
        );
      });

      if (!isTeacherAssigned) {
        return {
          success: false,
          message: `Ditolak: Anda (${params.currentUser.name}) bukan Guru Pembimbing yang terdaftar untuk ${groupName} pada jadwal hari ${currentDayName}.`
        };
      }

      // Step 6. Validate Time Window
      // Check if current time is within schedule window (with flexible tolerance, e.g. 60 minutes before start or after end)
      const matchingSchedule = todayGroupSchedules[0];
      const startM = parseTimeToMinutes(matchingSchedule.startTime || "06:00");
      const endM = parseTimeToMinutes(matchingSchedule.endTime || "07:30");

      const windowStart = startM - 60; // 1 hour before start
      const windowEnd = endM + 90;   // 1.5 hours after end

      if (currentM < windowStart || currentM > windowEnd) {
        return {
          success: false,
          message: `Ditolak: Waktu scan (${currentTimeStr} WIB) berada di luar batas jadwal Halaqah ${groupName} (${matchingSchedule.startTime} - ${matchingSchedule.endTime} WIB).`
        };
      }

      // Step 7. Check Existing Attendance in Firestore (teacher_halaqah_attendances)
      const attendancesCol = collection(db, HALAQAH_ATTENDANCE_COLLECTION);
      const q = query(
        attendancesCol, 
        where("groupId", "==", groupId),
        where("date", "==", todayStr)
      );

      const snapshot = await getDocs(q);
      const userRecords: TeacherHalaqahAttendance[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as TeacherHalaqahAttendance;
        if (
          data.teacherId === userTeacherId || 
          (data.teacherName && data.teacherName.toLowerCase().trim() === userNameNorm)
        ) {
          userRecords.push({ id: docSnap.id, ...data });
        }
      });

      const existingRecord = userRecords.length > 0 ? userRecords[0] : null;

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

        // Case B: Has Check In, performing Check Out
        const checkInM = parseTimeToMinutes(existingRecord.checkInTime);
        const durationM = Math.max(1, currentM - checkInM);

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
          shouldOpenJournal: true,
          message: `Check Out Halaqah ${groupName} Berhasil!\nJam Check Out: ${currentTimeStr} WIB (Durasi: ${durationM} menit).\n\nSesi pembimbingan telah selesai. Mengalihkan ke Jurnal Halaqah...`,
          record: updatedRecord
        };
      } else {
        // Case C: No Check In yet -> Perform Check In
        const newDocRef = doc(collection(db, HALAQAH_ATTENDANCE_COLLECTION));
        const nowIso = new Date().toISOString();
        const newRecord: TeacherHalaqahAttendance = {
          id: newDocRef.id,
          teacherId: userTeacherId,
          teacherName: params.currentUser.name || "Guru Pembimbing",
          groupId,
          groupName,
          date: todayStr,
          dayName: currentDayName,
          checkInTime: currentTimeStr,
          status: "Sedang Membimbing",
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
          message: `Check In Halaqah ${groupName} Berhasil!\nJam Check In: ${currentTimeStr} WIB.\nStatus: Sedang Membimbing Halaqah. Selamat mendampingi santri.`,
          record: newRecord
        };
      }
    } catch (error: any) {
      console.error("Error in processQrCheckIn for Halaqah:", error);
      return {
        success: false,
        message: `Terjadi kesalahan sistem saat memproses absensi Halaqah: ${error?.message || "Internal server error"}`
      };
    }
  },

  // =========================================================================
  // 3. REKAP & DASHBOARD WIDGET STATS
  // =========================================================================

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

  async getHalaqahWidgetStats(dateStr?: string, academicYearId?: string, semesterId?: string): Promise<HalaqahAttendanceWidgetStats> {
    const todayStr = dateStr || getTodayDateStr();
    
    try {
      const [groups, schedules, records] = await Promise.all([
        halaqahGroupService.getGroups(),
        this.getSchedules({ academicYearId, semesterId }),
        this.getAttendanceForDate(todayStr, academicYearId, semesterId)
      ]);

      const currentDay = getIndonesianDayName(todayStr);
      const todaySchedules = schedules.filter(s => s.day.toLowerCase() === currentDay.toLowerCase());

      const totalGroups = groups.length || 4;
      const totalTeachers = todaySchedules.length > 0 ? new Set(todaySchedules.map(s => s.teacherId || s.teacherName)).size : totalGroups;

      let alreadyCheckedIn = 0;
      let alreadyCheckedOut = 0;
      let currentlyMentoring = 0;

      records.forEach(r => {
        if (r.checkOutTime) {
          alreadyCheckedOut++;
          alreadyCheckedIn++;
        } else if (r.checkInTime) {
          currentlyMentoring++;
          alreadyCheckedIn++;
        }
      });

      const notYetAttended = Math.max(0, totalTeachers - alreadyCheckedIn);
      const attendancePercentage = totalTeachers > 0 ? Math.round((alreadyCheckedIn / totalTeachers) * 100) : 0;

      return {
        totalGroups,
        totalTeachers,
        alreadyCheckedIn,
        alreadyCheckedOut,
        currentlyMentoring,
        notYetAttended,
        attendancePercentage,
        records
      };
    } catch (err) {
      console.error("Error generating Halaqah widget stats:", err);
      return {
        totalGroups: 4,
        totalTeachers: 4,
        alreadyCheckedIn: 0,
        alreadyCheckedOut: 0,
        currentlyMentoring: 0,
        notYetAttended: 4,
        attendancePercentage: 0,
        records: []
      };
    }
  }
};
