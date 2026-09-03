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
import { db, auth, handleFirestoreError, OperationType } from "../firebase/config";
import { 
  TeacherTeachingAttendance, 
  AttendanceDailyStats, 
  TeacherAttendanceSummary,
  AttendanceTeachingStatus,
  TeacherAttendanceAuditLog,
  ScheduleExchangeRecord,
  LeadershipMonitoringStats
} from "../types/teacherTeachingAttendance.types";
import { scheduleService, resolveTeacherForScheduleDate } from "./schedule.service";
import { academicPlanningService } from "./academicPlanning.service";
import { lessonPeriodService } from "./lessonPeriod.service";
import { classService } from "./classService";
import { schoolSettingsService, DEFAULT_TEACHING_ATTENDANCE_SETTINGS } from "./schoolSettings.service";
import { SchoolSettings } from "../types";
import { academicYearService } from "./academicYearService";
import { semesterService } from "./semester.service";
import { teacherHalaqahAttendanceService } from "./teacherHalaqahAttendance.service";

const COLLECTION_NAME = "teacher_teaching_attendances";
const AUDIT_LOGS_COLLECTION = "teacher_attendance_audit_logs";
const SCHEDULE_EXCHANGES_COLLECTION = "schedule_exchanges";

/**
 * Recursively removes all `undefined` values from an object or array.
 * Firestore will throw "Unsupported field value: undefined" if any property is undefined.
 */
export function sanitizeFirestorePayload<T extends Record<string, any>>(data: T): T {
  if (data === null || typeof data !== "object") {
    return data;
  }

  const cleaned: Record<string, any> = {};

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (val === undefined) {
      continue;
    }
    if (val !== null && typeof val === "object" && !(val instanceof Date)) {
      if (Array.isArray(val)) {
        cleaned[key] = val.map(item =>
          item !== null && typeof item === "object" ? sanitizeFirestorePayload(item) : item
        );
      } else {
        cleaned[key] = sanitizeFirestorePayload(val);
      }
    } else {
      cleaned[key] = val;
    }
  }

  return cleaned as T;
}

/**
 * Resolves Firebase Authentication UID safely with multiple fallbacks
 */
export function resolveUserId(providedUserId?: string | null, currentUserObj?: any): string {
  if (providedUserId && typeof providedUserId === "string" && providedUserId.trim() !== "" && providedUserId !== "undefined") {
    return providedUserId.trim();
  }
  if (currentUserObj) {
    const fromObj = currentUserObj.uid || currentUserObj.userId || currentUserObj.id;
    if (fromObj && typeof fromObj === "string" && fromObj.trim() !== "" && fromObj !== "undefined") {
      return fromObj.trim();
    }
  }
  const authUid = auth?.currentUser?.uid;
  if (authUid && typeof authUid === "string" && authUid.trim() !== "") {
    return authUid.trim();
  }
  return "";
}

export function getIndonesianDayName(dateStr: string): string {
  if (!dateStr) return "Senin";
  // Add T00:00:00 to prevent local timezone shift
  const date = new Date(dateStr + "T00:00:00");
  const dayIndex = date.getDay();
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[dayIndex] || "Senin";
}

// Helper to normalize teacher names for fuzzy matching (stripping titles like Drs, Ir, M.Pd, etc.)
export function normalizeTeacherName(name?: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/(drs\.|dr\.|dra\.|ir\.|h\.|hj\.|m\.pd|s\.pd|s\.ag|m\.ag|s\.kom|m\.kom|s\.t|m\.t|s\.si|m\.si|lcm|lch|lc|m\.a|s\.h|m\.h|ph\.d)/gi, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Helper to normalize class names (converting Roman numerals like VII -> 7, IX -> 9, removing 'Kelas')
export function normalizeClassName(clsName?: string): string {
  if (!clsName) return "";
  let clean = clsName.toLowerCase().replace(/kelas\s*/gi, "").trim();
  clean = clean
    .replace(/\bviii\b/gi, "8")
    .replace(/\bvii\b/gi, "7")
    .replace(/\bxii\b/gi, "12")
    .replace(/\bxi\b/gi, "11")
    .replace(/\bix\b/gi, "9")
    .replace(/\bx\b/gi, "10")
    .replace(/\bvi\b/gi, "6")
    .replace(/viii/gi, "8")
    .replace(/vii/gi, "7")
    .replace(/xii/gi, "12")
    .replace(/xi/gi, "11")
    .replace(/ix/gi, "9")
    .replace(/x/gi, "10")
    .replace(/vi/gi, "6")
    .replace(/[^a-z0-9]/g, "");
  return clean;
}

export function isClassMatching(itemClassName?: string, targetClassName?: string): boolean {
  if (!itemClassName || !targetClassName) return false;

  const normItem = normalizeClassName(itemClassName);
  const normTarget = normalizeClassName(targetClassName);

  if (!normItem || !normTarget) return false;

  // 1. Exact match (e.g. "7a" === "7a" or "7" === "7")
  if (normItem === normTarget) return true;

  // 2. Grade-level match if target or item is a pure grade number (e.g. target "7" vs item "7a")
  const isTargetPureGrade = /^[0-9]+$/.test(normTarget);
  const isItemPureGrade = /^[0-9]+$/.test(normItem);

  if (isTargetPureGrade) {
    if (normItem.startsWith(normTarget)) {
      const rest = normItem.slice(normTarget.length);
      if (!/^[0-9]/.test(rest)) {
        return true;
      }
    }
  }

  if (isItemPureGrade) {
    if (normTarget.startsWith(normItem)) {
      const rest = normTarget.slice(normItem.length);
      if (!/^[0-9]/.test(rest)) {
        return true;
      }
    }
  }

  return false;
}

export function getTodayDateStr(timeZone = "Asia/Jakarta"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date());
  } catch (e) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
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

export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

export function calculateDurationInMinutes(startStr: string, endStr: string): number {
  const startM = parseTimeToMinutes(startStr);
  const endM = parseTimeToMinutes(endStr);
  return Math.max(0, endM - startM);
}

export function formatMinutesToTime(totalM: number): string {
  const h = Math.floor(totalM / 60) % 24;
  const m = totalM % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function validateCheckInWindow(timeSlot?: string, sequence?: number, currentM?: number): {
  isValid: boolean;
  isLate: boolean;
  isTooEarly: boolean;
  startM: number;
  endM: number;
  startStr: string;
  endStr: string;
} {
  const m = currentM !== undefined ? currentM : 0;
  let startM = 0;
  let endM = 0;
  let startStr = "07:30";
  let endStr = "08:15";

  if (timeSlot && timeSlot.includes("-")) {
    const parts = timeSlot.split("-").map(s => s.trim());
    startStr = parts[0];
    endStr = parts[1];
    startM = parseTimeToMinutes(startStr);
    endM = parseTimeToMinutes(endStr);
  } else {
    const seq = sequence || 1;
    startM = 450 + (seq - 1) * 45;
    endM = startM + 45;
    startStr = formatMinutesToTime(startM);
    endStr = formatMinutesToTime(endM);
  }

  const earliestCheckInM = startM - 15;
  const latestValidM = endM + 60;

  const isTooEarly = m < earliestCheckInM;
  const isValid = m >= earliestCheckInM && m <= latestValidM;
  const isLate = m > startM + 15;

  return { isValid, isLate, isTooEarly, startM, endM, startStr, endStr };
}

export interface LessonPeriodTimeRangeResult {
  startStr: string;
  endStr: string;
  startM: number;
  endM: number;
  timeRange: string;
  timeSlot: string;
  durationMinutes: number;
}

export function getLessonPeriodTimeRange(
  input?: any
): LessonPeriodTimeRangeResult {
  let timeSlotStr: string | undefined;
  let sequenceNum: number | undefined;
  let lessonPeriodIds: string[] = [];
  let lessonPeriodsList: Array<{ id?: string; sequence?: number; startTime?: string; endTime?: string }> = [];

  if (typeof input === "string") {
    if (input.includes("-") && /\d+:\d+/.test(input)) {
      timeSlotStr = input;
    } else {
      lessonPeriodIds = [input];
    }
  } else if (Array.isArray(input)) {
    if (input.every(item => typeof item === "string" && item.includes("-") && /\d+:\d+/.test(item))) {
      const first = input[0].split("-")[0].trim();
      const last = input[input.length - 1].split("-").pop()?.trim() || first;
      timeSlotStr = `${first} - ${last}`;
    } else {
      lessonPeriodIds = input.map(String);
    }
  } else if (input && typeof input === "object") {
    timeSlotStr = input.timeSlot;
    sequenceNum = typeof input.sequence === "number" ? input.sequence : undefined;
    if (input.lessonPeriodId) {
      lessonPeriodIds = [String(input.lessonPeriodId)];
    } else if (Array.isArray(input.lessonPeriodIds)) {
      lessonPeriodIds = input.lessonPeriodIds.map(String);
    }
    if (Array.isArray(input.lessonPeriods)) {
      lessonPeriodsList = input.lessonPeriods;
    }
  }

  if (lessonPeriodsList.length > 0 && lessonPeriodIds.length > 0) {
    const matched = lessonPeriodsList.filter(
      p => p.id && lessonPeriodIds.includes(p.id)
    );
    if (matched.length > 0) {
      matched.sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
      const first = matched[0];
      const last = matched[matched.length - 1];
      const startStr = first.startTime || "07:30";
      const endStr = last.endTime || "08:15";
      const startM = parseTimeToMinutes(startStr);
      const endM = parseTimeToMinutes(endStr);
      const range = `${startStr} - ${endStr}`;
      return {
        startStr,
        endStr,
        startM,
        endM,
        timeRange: range,
        timeSlot: range,
        durationMinutes: Math.max(0, endM - startM)
      };
    }
  }

  if (timeSlotStr && timeSlotStr.includes("-")) {
    const rawSlots = timeSlotStr.split(",").map(s => s.trim()).filter(Boolean);
    const firstPart = rawSlots[0].split("-")[0].trim();
    const lastPart = rawSlots[rawSlots.length - 1].split("-").pop()?.trim() || firstPart;
    const startM = parseTimeToMinutes(firstPart);
    const endM = parseTimeToMinutes(lastPart);
    const range = `${firstPart} - ${lastPart}`;
    return {
      startStr: firstPart,
      endStr: lastPart,
      startM,
      endM,
      timeRange: range,
      timeSlot: range,
      durationMinutes: Math.max(0, endM - startM)
    };
  }

  const seq = sequenceNum || 1;
  const startM = 450 + (seq - 1) * 45;
  const endM = startM + 45;
  const startStr = formatMinutesToTime(startM);
  const endStr = formatMinutesToTime(endM);
  const range = `${startStr} - ${endStr}`;

  return {
    startStr,
    endStr,
    startM,
    endM,
    timeRange: range,
    timeSlot: range,
    durationMinutes: 45
  };
}

function createEmptySummary(teacherId: string, teacherName: string): TeacherAttendanceSummary {
  return {
    teacherId,
    teacherName,
    jmlJp: 0,
    hadirJP: 0,
    menggantikanJP: 0,
    digantikanJP: 0,
    tidakHadirJP: 0,
    terlambatJP: 0,
    totalJP: 0,
    kehadiranPercentage: 0,
    isBalanced: true,
    isTotalConsistent: true,
    isLateValid: true,
    totalEncounters: 0,
    executedEncounters: 0,
    executedJP: 0,
    hadir: 0,
    terlambat: 0,
    izin: 0,
    izinJP: 0,
    sakit: 0,
    sakitJP: 0,
    tugas: 0,
    tugasJP: 0,
    tidakHadir: 0,
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

export interface DistinctTeacherKpiSummary {
  totalSessions: number;
  totalUniqueTeachers: number;
  hadirUniqueTeachers: number;
  terlambatUniqueTeachers: number;
  izinUniqueTeachers: number;
  sakitUniqueTeachers: number;
  tugasUniqueTeachers: number;
  digantiUniqueTeachers: number;
  tukarJadwalUniqueTeachers: number;
  tidakHadirUniqueTeachers: number;
  averageLateMinutes: number;
  topLateTeacher: { teacherId: string; teacherName: string; count: number } | null;
  topAbsentTeacher: { teacherId: string; teacherName: string; count: number } | null;
}

export function summarizeDistinctTeacherKpis(
  records: Array<Pick<TeacherTeachingAttendance, "teacherId" | "teacherName" | "status" | "checkInTime" | "timeSlot" | "sequence">>
): DistinctTeacherKpiSummary {
  const validRecords = (records || []).filter((record) => !!record && !!record.teacherId) as Array<
    Pick<TeacherTeachingAttendance, "teacherId" | "teacherName" | "status" | "checkInTime" | "timeSlot" | "sequence">
  >;

  const uniqueTeacherIds = new Set(validRecords.map(record => record.teacherId));
  const hadirSet = new Set<string>();
  const terlambatSet = new Set<string>();
  const izinSet = new Set<string>();
  const sakitSet = new Set<string>();
  const tugasSet = new Set<string>();
  const digantiSet = new Set<string>();
  const tukarJadwalSet = new Set<string>();
  const tidakHadirSet = new Set<string>();

  const lateCounts = new Map<string, { teacherName: string; count: number }>();
  const absentCounts = new Map<string, { teacherName: string; count: number }>();
  const lateMinutes: number[] = [];

  validRecords.forEach(record => {
    const teacherId = record.teacherId;
    const teacherName = record.teacherName || "Guru";

    if (record.status === "Hadir Mengajar" || record.status === "Terlambat") {
      hadirSet.add(teacherId);
    }

    if (record.status === "Terlambat") {
      terlambatSet.add(teacherId);
      const existing = lateCounts.get(teacherId) || { teacherName, count: 0 };
      existing.count += 1;
      lateCounts.set(teacherId, existing);

      const startMinutes = record.timeSlot ? getLessonPeriodTimeRange({ timeSlot: record.timeSlot, sequence: record.sequence || 1 }).startM : 0;
      const scanMinutes = record.checkInTime ? parseTimeToMinutes(record.checkInTime) : null;
      const lateMinutesValue = scanMinutes !== null && startMinutes > 0 ? Math.max(0, scanMinutes - startMinutes) : 15;
      lateMinutes.push(lateMinutesValue);
    }

    if (record.status === "Izin") izinSet.add(teacherId);
    if (record.status === "Sakit") sakitSet.add(teacherId);
    if (record.status === "Tugas Dinas") tugasSet.add(teacherId);
    if (record.status === "Digantikan Guru Lain") digantiSet.add(teacherId);
    if (record.status === "Tukar Jadwal") tukarJadwalSet.add(teacherId);
    if (record.status === "Tidak Hadir") {
      tidakHadirSet.add(teacherId);
      const existing = absentCounts.get(teacherId) || { teacherName, count: 0 };
      existing.count += 1;
      absentCounts.set(teacherId, existing);
    }
  });

  const topLateTeacher = Array.from(lateCounts.entries())
    .map(([teacherId, value]) => ({ teacherId, teacherName: value.teacherName, count: value.count }))
    .sort((a, b) => b.count - a.count || a.teacherName.localeCompare(b.teacherName, "id"))
    .at(0) || null;

  const topAbsentTeacher = Array.from(absentCounts.entries())
    .map(([teacherId, value]) => ({ teacherId, teacherName: value.teacherName, count: value.count }))
    .sort((a, b) => b.count - a.count || a.teacherName.localeCompare(b.teacherName, "id"))
    .at(0) || null;

  return {
    totalSessions: validRecords.length,
    totalUniqueTeachers: uniqueTeacherIds.size,
    hadirUniqueTeachers: hadirSet.size,
    terlambatUniqueTeachers: terlambatSet.size,
    izinUniqueTeachers: izinSet.size,
    sakitUniqueTeachers: sakitSet.size,
    tugasUniqueTeachers: tugasSet.size,
    digantiUniqueTeachers: digantiSet.size,
    tukarJadwalUniqueTeachers: tukarJadwalSet.size,
    tidakHadirUniqueTeachers: tidakHadirSet.size,
    averageLateMinutes: lateMinutes.length > 0 ? Math.round(lateMinutes.reduce((sum, value) => sum + value, 0) / lateMinutes.length) : 0,
    topLateTeacher,
    topAbsentTeacher
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
    semesterId: string,
    isSimulation?: boolean
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
      const resolved = resolveTeacherForScheduleDate(s, dateStr);
      const hasTeacher = !!resolved.teacherId && resolved.teacherId !== "none" && resolved.teacherId !== "";
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
    const targetCollectionName = isSimulation ? "teacher_teaching_attendances_simulation" : COLLECTION_NAME;
    const colRef = collection(db, targetCollectionName);
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
      const resolvedTeacher = resolveTeacherForScheduleDate(sch, dateStr);

      // Find period for dayName
      const dayPeriods = lessonPeriods.filter(p => (p.day || "").trim().toLowerCase() === dayName.toLowerCase());
      
      let period = dayPeriods.find(p => p.id === sch.lessonPeriodId);
      if (!period && sch.sequence) {
        period = dayPeriods.find(p => p.sequence === sch.sequence);
      }
      if (!period && sch.jp) {
        const cleanJp = sch.jp.replace(/^jp\s*/i, "").trim();
        period = dayPeriods.find(p => p.title.toLowerCase() === sch.jp.trim().toLowerCase() || String(p.sequence) === cleanJp);
      }
      if (!period) {
        period = periodMap.get(sch.lessonPeriodId);
      }

      const cls = classMap.get(sch.classId);

      const seq = period?.sequence || sch.sequence || 1;
      const timeSlot = period ? `${period.startTime} - ${period.endTime}` : "";
      const roomName = cls?.roomCode || cls?.name || "";

      // Ensure JP naming conforms to Lesson Period structure (e.g. "JP 1", "JP 2")
      let formattedJp = period?.title;
      if (!formattedJp) {
        if (sch.jp && sch.jp !== "JP" && sch.jp.trim()) {
          formattedJp = sch.jp.trim();
        } else {
          formattedJp = `JP ${seq}`;
        }
      }

      if (/^\d+$/.test(formattedJp)) {
        formattedJp = `JP ${formattedJp}`;
      } else if (/^jp\s*\d+/i.test(formattedJp)) {
        formattedJp = formattedJp.replace(/^jp\s*/i, "JP ");
      }

      if (existing) {
        return {
          ...existing,
          scheduleId: sch.id!,
          // IMMUTABILITY: Keep saved teacher if already recorded in Firestore, otherwise fallback to date-resolved teacher
          teacherId: existing.teacherId || resolvedTeacher.teacherId,
          teacherName: existing.teacherName || resolvedTeacher.teacherName,
          subjectId: existing.subjectId || sch.subjectId,
          subjectName: existing.subjectName || sch.subjectName,
          classId: sch.classId,
          className: sch.className,
          gradeLevel: cls?.gradeLevel || "",
          lessonPeriodId: sch.lessonPeriodId,
          sequence: seq,
          jp: formattedJp,
          roomName: existing.roomName || roomName,
          timeSlot: timeSlot || existing.timeSlot,
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
        teacherId: resolvedTeacher.teacherId,
        teacherName: resolvedTeacher.teacherName,
        subjectId: sch.subjectId,
        subjectName: sch.subjectName,
        classId: sch.classId,
        className: sch.className,
        gradeLevel: cls?.gradeLevel || "",
        lessonPeriodId: sch.lessonPeriodId,
        sequence: seq,
        jp: formattedJp,
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

    // Spanning JP Resolution: If a teacher checked in & out in a class spanning multiple JPs of the same subject
    // (e.g. CheckIn JP 1, CheckOut JP 2), propagate attendance ONLY to contiguous JPs not separated by break/gap.
    const teacherClassSessionsMap = new Map<string, TeacherTeachingAttendance[]>();
    items.forEach(it => {
      if (it.teacherId && it.classId && it.subjectId) {
        const key = `${it.teacherId}_${it.classId}_${it.subjectId}`;
        if (!teacherClassSessionsMap.has(key)) {
          teacherClassSessionsMap.set(key, []);
        }
        teacherClassSessionsMap.get(key)!.push(it);
      }
    });

    let schoolSettingsForSpanning: any = null;
    try {
      schoolSettingsForSpanning = await schoolSettingsService.getSettings();
    } catch (e) {
      // Fallback
    }
    const spanningBreakTimes = schoolSettingsForSpanning?.breakTimes || [];

    teacherClassSessionsMap.forEach((allClassTeacherItems) => {
      // Sort items by sequence
      allClassTeacherItems.sort((a, b) => a.sequence - b.sequence);

      // Subdivide into session groups separated by break or gap >= 10 mins
      const sessionGroups: TeacherTeachingAttendance[][] = [];
      let curGroup: TeacherTeachingAttendance[] = [];

      for (let i = 0; i < allClassTeacherItems.length; i++) {
        const item = allClassTeacherItems[i];
        const range = getLessonPeriodTimeRange({ timeSlot: item.timeSlot, sequence: item.sequence || (i + 1) });

        if (curGroup.length === 0) {
          curGroup.push(item);
        } else {
          const prevItem = curGroup[curGroup.length - 1];
          const prevRange = getLessonPeriodTimeRange({ timeSlot: prevItem.timeSlot, sequence: prevItem.sequence || i });

          const isSeparatedByBreak = spanningBreakTimes.some((b: any) => {
            const bStartM = parseTimeToMinutes(b.start);
            const bEndM = parseTimeToMinutes(b.end || b.start);
            return prevRange.endM <= bStartM && range.startM >= bEndM;
          }) || (range.startM - prevRange.endM >= 10);

          if (isSeparatedByBreak) {
            sessionGroups.push(curGroup);
            curGroup = [item];
          } else {
            curGroup.push(item);
          }
        }
      }
      if (curGroup.length > 0) {
        sessionGroups.push(curGroup);
      }

      // Propagate attendance strictly WITHIN each session group only
      sessionGroups.forEach(subGroup => {
        const checkedRecords = subGroup.filter(s => s.checkInTime && s.checkOutTime);
        if (checkedRecords.length === 0) return;

        checkedRecords.forEach((masterRec) => {
          const masterInM = parseTimeToMinutes(masterRec.checkInTime);
          const masterOutM = parseTimeToMinutes(masterRec.checkOutTime);
          if (masterInM <= 0 || masterOutM <= 0 || masterOutM <= masterInM) return;

          subGroup.forEach((targetRec) => {
            let targetStartM = 0;
            let targetEndM = 0;
            if (targetRec.timeSlot && targetRec.timeSlot.includes("-")) {
              const [s, e] = targetRec.timeSlot.split("-").map(x => x.trim());
              targetStartM = parseTimeToMinutes(s);
              targetEndM = parseTimeToMinutes(e);
            } else {
              targetStartM = 450 + (targetRec.sequence - 1) * 45;
              targetEndM = targetStartM + 45;
            }

            if (masterInM <= targetEndM - 10 && masterOutM >= targetStartM + 10) {
              targetRec.checkInTime = masterRec.checkInTime;
              targetRec.checkOutTime = masterRec.checkOutTime;
              targetRec.checkInLogs = masterRec.checkInLogs;
              targetRec.checkInType = masterRec.checkInType || "Scan QR";
              targetRec.status = masterRec.status === "Terlambat" ? "Terlambat" : "Hadir Mengajar";
              targetRec.teachingDurationMinutes = masterRec.teachingDurationMinutes;

              const evalRes = this.evaluateAttendanceApprovalStatus(targetRec);
              if (!targetRec.validatedByUserId) {
                targetRec.attendanceStatus = evalRes.attendanceStatus;
                targetRec.approvalType = evalRes.approvalType;
                targetRec.pendingReason = evalRes.pendingReason;
              }
            }
          });
        });
      });
    });

    // Evaluate dynamic runtime status for unconfirmed vs unstarted sessions
    const now = new Date();
    let defaultTimeStr = "";
    try {
      defaultTimeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    } catch (e) {
      defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    const currentM = parseTimeToMinutes(defaultTimeStr);

    let todayStr = "";
    try {
      todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
    } catch (e) {
      todayStr = now.toISOString().split("T")[0];
    }

    items.forEach(it => {
      // Do not modify items that already have a check-in or explicit non-teaching statuses
      if (it.checkInTime || it.status === "KBM Ditiadakan" || it.status === "Izin" || it.status === "Sakit" || it.status === "Tugas Dinas" || it.status === "Digantikan Guru Lain" || it.status === "Tukar Jadwal" || it.status === "Hadir Mengajar" || it.status === "Terlambat" || it.status === "Tidak Hadir") {
        return;
      }

      let startM = 0;
      if (it.timeSlot && it.timeSlot.includes("-")) {
        const s = it.timeSlot.split("-")[0].trim();
        startM = parseTimeToMinutes(s);
      } else {
        startM = 450 + (it.sequence - 1) * 45;
      }

      if (dateStr > todayStr) {
        it.status = "Belum Dimulai";
      } else if (dateStr === todayStr) {
        if (currentM < startM - 15) {
          it.status = "Belum Dimulai";
        } else {
          if (it.status === "Belum Diverifikasi" || !it.status || it.status === "Belum Dimulai") {
            it.status = "Belum Terkonfirmasi";
          }
        }
      } else {
        if (it.status === "Belum Diverifikasi" || !it.status || it.status === "Belum Dimulai") {
          it.status = "Belum Terkonfirmasi";
        }
      }
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
      const resolvedUid = resolveUserId(userId);

      if (!resolvedUid) {
        throw new Error("Gagal menyimpan Tukar Jadwal: Identitas Pengguna (createdByUserId / Firebase Auth UID) tidak ditemukan.");
      }

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
        createdByUserId: resolvedUid,
        createdByUserName: userName || auth?.currentUser?.displayName || "Pengguna"
      };
      await addDoc(colRef, sanitizeFirestorePayload(newExchange));

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
        resolvedUid,
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
            resolvedUid,
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

  // Save/Update single session attendance with Audit Logging and Status Evaluation
  async saveSingleSessionAttendance(
    dateStr: string,
    item: TeacherTeachingAttendance,
    userId: string,
    userName: string,
    reason?: string,
    isSimulation?: boolean
  ): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const todayStr = getTodayDateStr();
      const isPastDate = dateStr < todayStr;

      const docId = item.id || `${dateStr}_${item.scheduleId}`;
      const targetCollectionName = isSimulation ? "teacher_teaching_attendances_simulation" : COLLECTION_NAME;
      const ref = doc(db, targetCollectionName, docId);

      const existingSnap = await getDoc(ref);
      const existingData = existingSnap.exists() ? existingSnap.data() : null;

      const resolvedUid = resolveUserId(userId);

      // Validate recordedByUserId before proceeding to prevent Firestore undefined error
      if (!resolvedUid) {
        console.error("[Firestore Save Error] recordedByUserId is empty or undefined!", {
          providedUserId: userId,
          authCurrentUser: auth?.currentUser,
          item
        });
        throw new Error("Gagal menyimpan absensi: Identitas Pengguna (recordedByUserId / Firebase Auth UID) tidak ditemukan. Silakan login ulang.");
      }

      const isSusulan = isPastDate || (existingData && existingData.recordedByUserId !== resolvedUid);
      const previousStatus = existingData ? existingData.status : "Belum Diverifikasi";

      let schoolSettings: SchoolSettings | undefined;
      try {
        schoolSettings = await schoolSettingsService.getSettings();
      } catch (err) {
        // Fallback
      }

      // Evaluate approval status automatically
      const evalResult = this.evaluateAttendanceApprovalStatus(item, schoolSettings);
      const isManuallyValidated = !!item.validatedByUserId;
      const finalAttendanceStatus = isManuallyValidated ? (item.attendanceStatus || evalResult.attendanceStatus) : evalResult.attendanceStatus;
      const finalPendingReason = isManuallyValidated ? (item.pendingReason || "") : evalResult.pendingReason;
      const finalApprovalType = isManuallyValidated ? (item.approvalType || evalResult.approvalType) : evalResult.approvalType;

      const rawPayload: any = {
        ...item,
        id: docId,
        date: dateStr,
        attendanceStatus: finalAttendanceStatus,
        pendingReason: finalPendingReason,
        approvalType: finalApprovalType,
        isInputSusulan: isSusulan ? true : (item.isInputSusulan || false),
        recordedByUserId: resolvedUid,
        recordedByUserName: userName || auth?.currentUser?.displayName || "Pengguna",
        updatedAt: timestamp,
        createdAt: item.createdAt || timestamp
      };

      const payload = sanitizeFirestorePayload(rawPayload);

      // Detailed audit logging before calling setDoc
      console.log("==================================================");
      console.log("[Firestore Save Audit] Saving Single Session Attendance");
      console.log("[Firestore Save Audit] Passed userId parameter:", userId);
      console.log("[Firestore Save Audit] Final recordedByUserId:", payload.recordedByUserId);
      console.log("[Firestore Save Audit] Final attendanceStatus:", payload.attendanceStatus);
      console.log("[Firestore Save Audit] Final approvalType:", payload.approvalType);
      console.log("==================================================");

      await setDoc(ref, payload, { merge: true });

      // Record audit log if past date or status changed
      if (isPastDate || (existingData && previousStatus !== item.status)) {
        const targetAuditCol = isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION;
        const auditColRef = collection(db, targetAuditCol);
        const rawAuditLog: TeacherAttendanceAuditLog = {
          attendanceDate: dateStr,
          inputTimestamp: timestamp,
          userId: resolvedUid,
          userName: userName || auth?.currentUser?.displayName || "Pengguna",
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
        await addDoc(auditColRef, sanitizeFirestorePayload(rawAuditLog));
      }

      await logActivity(resolvedUid, userName, "Save Single Session Attendance", `Menyimpan absensi sesi ${item.teacherName} - ${item.subjectName} (${item.className}) tanggal ${dateStr}`);
    } catch (error) {
      console.error("Error saving single session attendance:", error);
      throw error;
    }
  },

  // Helper to evaluate approval status (Approved vs Pending)
  evaluateAttendanceApprovalStatus(
    item: TeacherTeachingAttendance,
    schoolSettings?: SchoolSettings
  ): {
    attendanceStatus: "Pending" | "Approved" | "Rejected";
    pendingReason?: string;
    approvalType: "Automatic" | "Manual";
  } {
    const tas = schoolSettings?.teachingAttendanceSettings || DEFAULT_TEACHING_ATTENDANCE_SETTINGS;
    const conds = tas.pendingValidationConditions || DEFAULT_TEACHING_ATTENDANCE_SETTINGS.pendingValidationConditions;

    // If already manually validated by Waka/Admin/Kepsek, preserve manual decision
    if (item.validatedByUserId && (item.attendanceStatus === "Approved" || item.attendanceStatus === "Rejected")) {
      return {
        attendanceStatus: item.attendanceStatus,
        pendingReason: item.pendingReason || "",
        approvalType: "Manual"
      };
    }

    // Specific Rule: Keterlambatan > 15 Menit dari Jadwal Dimulai
    if (item.requiresLateValidation) {
      if (item.attendanceStatus === "Approved") {
        return {
          attendanceStatus: "Approved",
          pendingReason: "",
          approvalType: "Manual"
        };
      }
      if (item.attendanceStatus === "Rejected") {
        return {
          attendanceStatus: "Rejected",
          pendingReason: item.validationNote || "Ditolak Validasi Keterlambatan",
          approvalType: "Manual"
        };
      }
      return {
        attendanceStatus: "Pending",
        pendingReason: "TERLAMBAT >15 MENIT — MENUNGGU VALIDASI",
        approvalType: "Manual"
      };
    }

    if (!item.checkInTime) {
      return { attendanceStatus: "Pending", pendingReason: "Belum Melakukan Check-in", approvalType: "Manual" };
    }

    if (!item.checkOutTime) {
      return { attendanceStatus: "Pending", pendingReason: "Belum Melakukan Check-out", approvalType: "Manual" };
    }

    // Check approval method
    if (tas.approvalMethod === "manual") {
      return {
        attendanceStatus: "Pending",
        pendingReason: "Memerlukan Validasi Manual Waka Kurikulum (Kebijakan Manual Approval)",
        approvalType: "Manual"
      };
    }

    const pendingReasons: string[] = [];

    if (item.isManualCheckOut && conds.lupaCheckOut) {
      pendingReasons.push(item.manualCheckOutReason ? `Check-out Manual Wakakur: ${item.manualCheckOutReason}` : "Check-out Manual Wakakur");
    }

    if (item.status !== "Hadir Mengajar" && item.status !== "Terlambat") {
      pendingReasons.push(`Status Kehadiran Khusus (${item.status})`);
    }

    if (item.checkInType && item.checkInType !== "Scan QR" && conds.inputManual) {
      pendingReasons.push(`Input Non-QR (${item.checkInType})`);
    }

    let startM = 0;
    let endM = 0;
    if (item.timeSlot && item.timeSlot.includes("-")) {
      const [s, e] = item.timeSlot.split("-").map(x => x.trim());
      startM = parseTimeToMinutes(s);
      endM = parseTimeToMinutes(e);
    } else {
      startM = 450 + (item.sequence - 1) * 45;
      endM = startM + 45;
    }

    const checkInM = parseTimeToMinutes(item.checkInTime);
    const checkOutM = parseTimeToMinutes(item.checkOutTime);

    const checkInTol = tas.checkInToleranceMinutes ?? 15;
    const checkOutTol = tas.checkOutToleranceMinutes ?? 15;

    // Tolerance Check-In
    if (checkInM < startM - checkInTol) {
      if (conds.checkInTerlaluAwal) {
        pendingReasons.push(`Check-in terlalu awal (${item.checkInTime}, jam mulai ${formatMinutesToTime(startM)}, tol: ${checkInTol}m)`);
      }
    } else if (checkInM > startM + checkInTol) {
      if (conds.checkInTerlambat) {
        pendingReasons.push(`Terlambat Check-in (${item.checkInTime}, jam mulai ${formatMinutesToTime(startM)}, tol: ${checkInTol}m)`);
      }
    }

    // Tolerance Check-Out
    if (checkOutM < endM - checkOutTol) {
      if (conds.checkOutTerlaluAwal) {
        pendingReasons.push(`Check-out terlalu cepat (${item.checkOutTime}, jam selesai ${formatMinutesToTime(endM)}, tol: ${checkOutTol}m)`);
      }
    } else if (checkOutM > endM + checkOutTol) {
      if (conds.checkOutTerlambat) {
        pendingReasons.push(`Check-out terlambat (${item.checkOutTime}, jam selesai ${formatMinutesToTime(endM)}, tol: ${checkOutTol}m)`);
      }
    }

    // Teaching Duration Check
    const expectedDuration = endM - startM;
    const actualDuration = item.teachingDurationMinutes || (checkOutM - checkInM);
    const minPercent = tas.minTeachingDurationPercent ?? 80;
    const minRequiredMinutes = Math.floor(expectedDuration * (minPercent / 100));

    if (expectedDuration > 0 && actualDuration < minRequiredMinutes && conds.durasiTidakSesuai) {
      pendingReasons.push(`Durasi mengajar tidak sesuai (${actualDuration} mnt dari estimasi ${expectedDuration} mnt, min ${minPercent}%)`);
    }

    if (tas.approvalMethod === "automatic" && pendingReasons.length === 0) {
      return {
        attendanceStatus: "Approved",
        pendingReason: "",
        approvalType: "Automatic"
      };
    }

    if (pendingReasons.length > 0) {
      return {
        attendanceStatus: "Pending",
        pendingReason: pendingReasons.join("; "),
        approvalType: "Manual"
      };
    }

    return {
      attendanceStatus: "Approved",
      pendingReason: "",
      approvalType: "Automatic"
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
      const todayStr = getTodayDateStr();
      const isPastDate = dateStr < todayStr;

      const resolvedUid = resolveUserId(userId);

      if (!resolvedUid) {
        console.error("[Firestore Save Batch Error] recordedByUserId is empty or undefined!", {
          providedUserId: userId,
          authCurrentUser: auth?.currentUser
        });
        throw new Error("Gagal menyimpan absensi batch: Identitas Pengguna (recordedByUserId / Firebase Auth UID) tidak ditemukan. Silakan login ulang.");
      }

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

        const isSusulan = isPastDate || (existingData && existingData.recordedByUserId !== resolvedUid);
        const previousStatus = existingData ? existingData.status : "Belum Diverifikasi";

        const rawPayload: any = {
          ...item,
          id: docId,
          date: dateStr,
          isInputSusulan: isSusulan ? true : (item.isInputSusulan || false),
          recordedByUserId: resolvedUid,
          recordedByUserName: userName || auth?.currentUser?.displayName || "Pengguna",
          updatedAt: timestamp,
          createdAt: item.createdAt || timestamp
        };

        const payload = sanitizeFirestorePayload(rawPayload);

        console.log(`[Firestore Batch Audit] Preparing docId: ${docId}, recordedByUserId: ${payload.recordedByUserId}`);

        batch.set(ref, payload, { merge: true });

        // Record audit log if past date or status changed
        if (isPastDate || (existingData && previousStatus !== item.status)) {
          auditLogs.push(sanitizeFirestorePayload({
            attendanceDate: dateStr,
            inputTimestamp: timestamp,
            userId: resolvedUid,
            userName: userName || auth?.currentUser?.displayName || "Pengguna",
            scheduleId: item.scheduleId,
            teacherName: item.teacherName,
            className: item.className,
            subjectName: item.subjectName,
            jp: item.jp,
            previousStatus,
            newStatus: item.status,
            reason: reason || (isPastDate ? "Input / Koreksi Susulan Tanggal Lampau" : "Perubahan Status Absensi"),
            isLateInput: isPastDate
          }));
        }
      });

      console.log("==================================================");
      console.log("[Firestore Batch Commit Audit]");
      console.log("[Firestore Batch Commit Audit] Total items:", items.length);
      console.log("[Firestore Batch Commit Audit] auth.currentUser:", auth?.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null);
      console.log("[Firestore Batch Commit Audit] Resolved recordedByUserId:", resolvedUid);
      console.log("==================================================");

      await batch.commit();

      if (auditLogs.length > 0) {
        const auditColRef = collection(db, AUDIT_LOGS_COLLECTION);
        const auditPromises = auditLogs.map(log => addDoc(auditColRef, log));
        await Promise.all(auditPromises);
      }

      await logActivity(resolvedUid, userName, "Save Attendance", `Menyimpan ${items.length} data absensi mengajar tanggal ${dateStr}${isPastDate ? ' (Input Susulan)' : ''}`);
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
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${day}`;

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
    let belumTerkonfirmasiCount = 0;

    items.forEach(i => {
      switch (i.status) {
        case "Hadir Mengajar":
          hadirCount++;
          break;
        case "Terlambat":
          terlambatCount++;
          break;
        case "Belum Terkonfirmasi":
          belumTerkonfirmasiCount++;
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

  getDistinctTeacherKpiSummary(records: TeacherTeachingAttendance[] = []): DistinctTeacherKpiSummary {
    return summarizeDistinctTeacherKpis(records);
  },

  // Get all attendance records matching filters
  async getAllAttendances(filters: {
    academicYearId?: string;
    semesterId?: string;
    startDate?: string;
    endDate?: string;
    teacherId?: string;
    subjectId?: string;
    classId?: string;
    gradeLevel?: string;
  } = {}): Promise<TeacherTeachingAttendance[]> {
    const recap = await this.getAttendanceRecap(filters);
    return recap.rawRecords;
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

      // Group by teacher with definitive JP & Pertemuan calculations (Anti-Double Counting & Zero Contamination)
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

        switch (rec.status) {
          case "Hadir Mengajar":
            sum.jmlJp += recJP;
            sum.hadirJP += recJP;
            sum.hadir++;
            sum.executedEncounters++;
            sum.executedJP += recJP;
            break;

          case "Terlambat":
            sum.jmlJp += recJP;
            sum.terlambat++;
            sum.terlambatJP += recJP;

            {
              // Keterlambatan >15 Menit: Evaluasi status validasi
              const isLateOver15 = !!rec.requiresLateValidation || (rec.lateMinutes !== undefined && rec.lateMinutes > 15);
              const isLatePending = isLateOver15 && (rec.attendanceStatus === "Pending" || (!rec.validatedByUserId && rec.lateValidationStatus === "PENDING"));
              const isLateRejected = isLateOver15 && (rec.attendanceStatus === "Rejected" || rec.lateValidationStatus === "REJECTED");

              if (isLatePending) {
                // Terkunci untuk perhitungan kehadiran (Kehadiran = 0 sementara sampai divalidasi)
                // Tidak masuk hadirJP
              } else if (isLateRejected) {
                // Validasi ditolak -> masuk ke tidakHadirJP (tidak dihitung hadir)
                sum.tidakHadirJP += recJP;
                sum.tidakHadir++;
              } else {
                // Validasi diterima (Approved) ATAU keterlambatan normal <= 15 menit:
                sum.hadirJP += recJP;
                sum.hadir++;
                sum.executedEncounters++;
                sum.executedJP += recJP;
              }
            }
            break;

          case "Izin":
            sum.jmlJp += recJP;
            sum.tidakHadirJP += recJP;
            sum.tidakHadir++;
            sum.izin++;
            sum.izinJP += recJP;
            break;

          case "Sakit":
            sum.jmlJp += recJP;
            sum.tidakHadirJP += recJP;
            sum.tidakHadir++;
            sum.sakit++;
            sum.sakitJP += recJP;
            break;

          case "Tugas Dinas":
            sum.jmlJp += recJP;
            sum.tidakHadirJP += recJP;
            sum.tidakHadir++;
            sum.tugas++;
            sum.tugasJP += recJP;
            break;

          case "Tidak Hadir":
          case "Belum Terkonfirmasi":
          case "Belum Diverifikasi":
            sum.jmlJp += recJP;
            sum.tidakHadirJP += recJP;
            sum.tidakHadir++;
            break;

          case "Digantikan Guru Lain":
            sum.jmlJp += recJP; // Tetap menjadi bagian dari JML JP jadwal asli guru
            sum.digantikanJP += recJP; // Masuk ke Digantikan (JP) guru asli
            sum.diganti++;
            sum.digantiJP += recJP;
            // PENTING: JP yang digantikan TIDAK masuk ke Kehadiran guru asal (zero contamination)

            // Guru Pengganti (Sisi Penerima Penggantian):
            if (rec.substituteTeacherId) {
              const subId = rec.substituteTeacherId;
              const subName = rec.substituteTeacherName || "Guru Pengganti";
              if (!map.has(subId)) {
                map.set(subId, createEmptySummary(subId, subName));
              }
              const subSum = map.get(subId)!;
              subSum.menggantikanJP += recJP; // Masuk ke Menggantikan (JP) guru pengganti
              subSum.executedEncounters++;
              subSum.executedJP += recJP;
              // PENTING: JP pengganti TIDAK masuk ke JML JP atau Kehadiran guru pengganti!
            }
            break;

          case "Tukar Jadwal":
            sum.jmlJp += recJP;
            sum.digantikanJP += recJP;
            sum.tukarJadwal++;
            sum.tukarJadwalJP += recJP;

            // Guru Penukar yang mengambil alih sesi ini:
            if (rec.exchangedWithTeacherId) {
              const exId = rec.exchangedWithTeacherId;
              const exName = rec.exchangedWithTeacherName || "Guru Penukar";
              if (!map.has(exId)) {
                map.set(exId, createEmptySummary(exId, exName));
              }
              const exSum = map.get(exId)!;
              exSum.menggantikanJP += recJP;
              exSum.tukarJadwalMasuk++;
              exSum.tukarJadwalMasukJP += recJP;
              exSum.executedEncounters++;
              exSum.executedJP += recJP;
            }
            break;

          case "KBM Ditiadakan":
            sum.kbmDitiadakan++;
            sum.kbmDitiadakanJP += recJP;
            break;
        }
      });

      // Calculate final balanced metrics & audit validations
      const summaries: TeacherAttendanceSummary[] = Array.from(map.values()).map(sum => {
        // Formula Total JP: Kehadiran (JP) + Menggantikan (JP)
        const totalJP = sum.hadirJP + sum.menggantikanJP;

        // Persentase Kehadiran: (Kehadiran / JML JP) * 100
        const kehadiranPercentage = sum.jmlJp > 0
          ? Math.min(100, Math.round((sum.hadirJP / sum.jmlJp) * 100))
          : (totalJP > 0 ? 100 : 0);

        // Audit Validations
        const isBalanced = sum.jmlJp === (sum.hadirJP + sum.digantikanJP + sum.tidakHadirJP);
        const isTotalConsistent = totalJP === (sum.hadirJP + sum.menggantikanJP);
        const isLateValid = sum.terlambatJP <= sum.hadirJP;

        return {
          ...sum,
          totalJP,
          kehadiranPercentage,
          percentage: kehadiranPercentage,
          isBalanced,
          isTotalConsistent,
          isLateValid
        };
      });

      // Sort by total JP and attendance percentage
      summaries.sort((a, b) => b.totalJP - a.totalJP || b.kehadiranPercentage - a.kehadiranPercentage || a.teacherName.localeCompare(b.teacherName));

      return { summaries, rawRecords };
    } catch (error) {
      console.error("Error fetching attendance recap:", error);
      return { summaries: [], rawRecords: [] };
    }
  },

  // Process Teaching Check-in & Check-out via Static Class QR Code
  async processQrCheckIn(params: {
    scannedContent: string;
    currentUser: { id?: string; uid?: string; userId?: string; name: string; teacherId?: string; role?: string };
    academicYearId?: string;
    semesterId?: string;
    customTimeStr?: string; // Optional override for testing or exact time
    isSimulation?: boolean;
  }): Promise<{
    success: boolean;
    action?: "CHECK_IN" | "CHECK_OUT" | "DUPLICATE_SCAN" | "IGNORED_DOUBLE_SCAN";
    message: string;
    isAlreadyCompleted?: boolean;
    isDuplicateScan?: boolean;
    record?: TeacherTeachingAttendance;
    requiresLateValidation?: boolean;
    isLateOver15?: boolean;
    lateMinutes?: number;
  }> {
    try {
      const currentUserId = resolveUserId(params.currentUser?.uid || (params.currentUser as any)?.userId || params.currentUser?.id, params.currentUser);

      console.log("==================================================");
      console.log("[QR Audit Step 1] Inisiasi Scan QR Check-In / Check-Out", params.isSimulation ? "(MODE SIMULASI)" : "(MODE PRODUKSI)");
      console.log("[QR Audit Step 1] User Current:", params.currentUser);
      console.log("[QR Audit Step 1] auth.currentUser:", auth?.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null);
      console.log("[QR Audit Step 1] Resolved currentUserId (Firebase Auth UID):", currentUserId);
      console.log("[QR Audit Step 1] Raw Scanned Content:", params.scannedContent);
      console.log("[QR Audit Step 1] Context AY:", params.academicYearId, "Semester:", params.semesterId);

      if (!currentUserId) {
        console.warn("[QR Audit Step 1 FAILED] User session invalid or missing Firebase Auth UID");
        return {
          success: false,
          message: "Sesi pengguna tidak valid (Firebase Auth UID tidak ditemukan). Silakan login ulang."
        };
      }

      if (!params.scannedContent || !params.scannedContent.trim()) {
        console.warn("[QR Audit Step 1 FAILED] Scanned QR content is empty");
        return {
          success: false,
          message: "QR Code tidak valid atau data QR kosong."
        };
      }

      const todayStr = getTodayDateStr();
      const now = new Date();
      let defaultTimeStr = "";
      try {
        defaultTimeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      } catch (e) {
        defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      }
      const currentTimeStr = params.customTimeStr || defaultTimeStr;
      const currentM = parseTimeToMinutes(currentTimeStr);

      console.log("[QR Audit Step 1] Waktu transaksi:", todayStr, currentTimeStr, `(${currentM} menit)`);

      // 2. Academic Year & Semester Validation
      let ayId = params.academicYearId || "";
      let semId = params.semesterId || "";

      if (!ayId || !semId) {
        console.log("[QR Audit Step 2] AcademicYearId / SemesterId not provided, looking up active ones...");
        try {
          const [ays, sems] = await Promise.all([
            academicYearService.getAcademicYears(),
            semesterService.getSemesters()
          ]);
          const activeAy = ays.find(a => a.isActive);
          const activeSem = sems.find(s => s.isActive);
          if (activeAy) ayId = activeAy.id;
          if (activeSem) semId = activeSem.id;
        } catch (e) {
          console.error("[QR Audit Step 2] Failed looking up active academic year/semester:", e);
        }
      }

      console.log("[QR Audit Step 2] Resolved Active Academic Year ID:", ayId, "Semester ID:", semId);

      if (!ayId || !semId) {
        console.warn("[QR Audit Step 2 FAILED] Active Academic Year or Semester is not set in system");
        return {
          success: false,
          message: "Tahun Ajaran atau Semester aktif belum dikonfigurasi dalam sistem."
        };
      }

      // 3. Parse scanned QR content
      let rawContent = params.scannedContent.trim();
      let parsedJson: any = null;
      let targetClassIdentifier = rawContent;

      try {
        if ((rawContent.startsWith("{") && rawContent.endsWith("}")) || rawContent.includes("SCHOOL_CLASS_QR") || rawContent.toLowerCase().includes("halaqah")) {
          parsedJson = JSON.parse(rawContent);
          targetClassIdentifier = parsedJson.className || parsedJson.classId || parsedJson.code || targetClassIdentifier;
        }
      } catch (err) {
        console.log("[QR Audit Step 3] Scanned content is plain text, not JSON");
      }

      // Check if session type is "halaqah"
      if (parsedJson?.type === "halaqah" || rawContent.toLowerCase().startsWith("halaqah_qr:")) {
        console.log("[Attendance Engine] Session type 'halaqah' detected. Delegation to teacherHalaqahAttendanceService...");
        const halaqahRes = await teacherHalaqahAttendanceService.processQrCheckIn(params);
        return {
          success: halaqahRes.success,
          action: halaqahRes.action,
          message: halaqahRes.message,
          record: halaqahRes.record as any
        };
      }

      if (targetClassIdentifier.toUpperCase().startsWith("CLASS_QR:")) {
        targetClassIdentifier = targetClassIdentifier.substring(9).trim();
      }

      const cleanTarget = targetClassIdentifier.toLowerCase().replace(/[^a-z0-9]/g, "");
      const normTargetClass = normalizeClassName(targetClassIdentifier);

      console.log("[QR Audit Step 3] QR Content Parsed:", {
        rawContent,
        parsedJson,
        targetClassIdentifier,
        cleanTarget,
        normTargetClass
      });

      // 4. Fetch Master Classes to Verify Class Existence
      const classes = await classService.getClasses();
      const matchedClass = classes.find(c => {
        if (parsedJson?.classId && (c.id === parsedJson.classId || (c as any).classId === parsedJson.classId)) {
          return true;
        }
        const cNameClean = (c.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const cCodeClean = (c.code || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const cIdClean = (c.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const cRoomClean = (c.roomCode || "").toLowerCase().replace(/[^a-z0-9]/g, "");

        if (
          cNameClean === cleanTarget ||
          cCodeClean === cleanTarget ||
          cIdClean === cleanTarget ||
          (cRoomClean && cRoomClean === cleanTarget)
        ) {
          return true;
        }

        return isClassMatching(c.name, targetClassIdentifier);
      });

      const targetClassName = matchedClass?.name || parsedJson?.className || targetClassIdentifier;

      console.log("[QR Audit Step 4] Master Class Match Result:", matchedClass ? `Found: ${matchedClass.name} (ID: ${matchedClass.id})` : `Not explicitly matched in master classes, using string: '${targetClassName}'`);

      // 5. Fetch Today's Attendance Schedules & Check Kaldik Status
      const { items, isKbmDisabled, lockReason } = await this.getAttendanceForDate(
        todayStr,
        ayId,
        semId,
        params.isSimulation
      );

      console.log("[QR Audit Step 5] Today's Schedules Count:", items.length, "Kaldik Disabled:", isKbmDisabled);

      if (isKbmDisabled) {
        console.warn("[QR Audit Step 5 FAILED] KBM Disabled by Kalender Akademik:", lockReason);
        return {
          success: false,
          message: `Check-in tidak dapat dilakukan: ${lockReason || "KBM Ditiadakan Hari Ini"}.`
        };
      }

      if (items.length === 0) {
        console.warn("[QR Audit Step 5 FAILED] No schedules found for today (Day:", getIndonesianDayName(todayStr), ")");
        return {
          success: false,
          message: `Tidak ada jadwal pelajaran master yang terdaftar untuk hari ${getIndonesianDayName(todayStr)}.`
        };
      }

      // 6. Filter Today's Schedules for Logged-In Teacher
      const currentTeacherName = (params.currentUser.name || "").trim();
      const currentTeacherNameNorm = normalizeTeacherName(currentTeacherName);
      const currentTeacherId = params.currentUser.teacherId || params.currentUser.id;

      console.log("[QR Audit Step 6] Matching Teacher Schedule for:", {
        currentTeacherName,
        currentTeacherNameNorm,
        currentTeacherId,
        userId: params.currentUser.id
      });

      const teacherTodayItems = items.filter(item => {
        const itemTeacherId = item.teacherId || "";
        const itemSubTeacherId = item.substituteTeacherId || "";
        const matchesId =
          itemTeacherId === currentTeacherId ||
          itemSubTeacherId === currentTeacherId ||
          itemTeacherId === params.currentUser.id ||
          itemSubTeacherId === params.currentUser.id;

        const itemTeacherNameNorm = normalizeTeacherName(item.teacherName);
        const itemSubTeacherNameNorm = normalizeTeacherName(item.substituteTeacherName);

        const matchesName =
          (itemTeacherNameNorm && (itemTeacherNameNorm === currentTeacherNameNorm || itemTeacherNameNorm.includes(currentTeacherNameNorm) || currentTeacherNameNorm.includes(itemTeacherNameNorm))) ||
          (itemSubTeacherNameNorm && (itemSubTeacherNameNorm === currentTeacherNameNorm || itemSubTeacherNameNorm.includes(currentTeacherNameNorm) || currentTeacherNameNorm.includes(itemSubTeacherNameNorm)));

        return matchesId || matchesName;
      });

      console.log("[QR Audit Step 6] Teacher's Today Schedules Count:", teacherTodayItems.length);

      if (teacherTodayItems.length === 0) {
        console.warn("[QR Audit Step 6 FAILED] Teacher has no schedules today:", currentTeacherName);
        return {
          success: false,
          message: `Akun Anda (${currentTeacherName}) tidak memiliki jadwal mengajar terdaftar pada hari ${getIndonesianDayName(todayStr)}.`
        };
      }

      // 7. Validate Teacher Schedule in the SCANNED Class
      const classTeacherItems = teacherTodayItems.filter(item => {
        if (matchedClass) {
          if (item.classId === matchedClass.id || (matchedClass as any).classId === item.classId) return true;
          if (item.className && matchedClass.name && isClassMatching(item.className, matchedClass.name)) return true;
          return false;
        }
        if (parsedJson?.classId && item.classId === parsedJson.classId) return true;

        return isClassMatching(item.className, targetClassIdentifier);
      });

      console.log("[QR Audit Step 7] Scanned Class Schedule Count for Teacher:", classTeacherItems.length, "in Class:", targetClassName);

      if (classTeacherItems.length === 0) {
        const qrClassId = parsedJson?.classId || "N/A (QR Plaintext/Non-JSON)";
        const firestoreClassName = matchedClass?.name || targetClassName || "N/A";
        console.log("==================================================");
        console.log("[AUDIT TEMPORER LOGGING QR ABSENSI GURU - DITOLAK: TIDAK ADA JADWAL]");
        console.log("* QR Payload                         :", rawContent);
        console.log("* classId dari QR                    :", qrClassId);
        console.log("* Nama kelas dari Firestore          :", firestoreClassName);
        console.log("* classId dari jadwal guru           : N/A (Guru tidak mengajar di kelas ini)");
        console.log("* Nama kelas dari jadwal             : N/A (Guru tidak mengajar di kelas ini)");
        console.log("* classId yang akhirnya disimpan ke Firestore: N/A (Data tidak diubah)");
        console.log("==================================================");

        console.warn("[QR Audit Step 7 FAILED] Teacher has no schedule in class:", targetClassName);
        return {
          success: false,
          message: `QR Code kelas ${targetClassName} dipindai, tetapi Anda (${currentTeacherName}) tidak memiliki jadwal mengajar di kelas ${targetClassName} pada hari ${getIndonesianDayName(todayStr)}.`
        };
      }

      // 8. Session Selection (Break-aware Session Grouping)
      let schoolSettings: any = null;
      try {
        schoolSettings = await schoolSettingsService.getSettings();
      } catch (e) {
        console.warn("[QR Audit Step 8] Failed to load school settings:", e);
      }
      const breakTimes = schoolSettings?.breakTimes || [];

      // Group classTeacherItems into Sessions (Break Time Exception)
      // If two JPs are separated by official school break time (or >= 10 mins gap), they form 2 DIFFERENT sessions.
      // If contiguous without break, they form 1 SESSION.
      classTeacherItems.sort((a, b) => a.sequence - b.sequence);

      interface SessionGroup {
        sessionKey: string;
        items: TeacherTeachingAttendance[];
        jpLabel: string;
        subjectName: string;
        className: string;
        startM: number;
        endM: number;
        startStr: string;
        endStr: string;
        checkInTime?: string;
        checkOutTime?: string;
        status?: string;
        isLateUnlocked?: boolean;
        lateUnlockReason?: string;
      }

      const sessionGroups: SessionGroup[] = [];
      let currentGroupItems: TeacherTeachingAttendance[] = [];

      for (let i = 0; i < classTeacherItems.length; i++) {
        const item = classTeacherItems[i];
        const range = getLessonPeriodTimeRange({ timeSlot: item.timeSlot, sequence: item.sequence || (i + 1) });

        if (currentGroupItems.length === 0) {
          currentGroupItems.push(item);
        } else {
          const prevItem = currentGroupItems[currentGroupItems.length - 1];
          const prevRange = getLessonPeriodTimeRange({ timeSlot: prevItem.timeSlot, sequence: prevItem.sequence || i });

          const isSeparatedByBreak = breakTimes.some((b: any) => {
            const bStartM = parseTimeToMinutes(b.start);
            const bEndM = parseTimeToMinutes(b.end || b.start);
            return prevRange.endM <= bStartM && range.startM >= bEndM;
          }) || (range.startM - prevRange.endM >= 10) || (item.subjectId !== prevItem.subjectId);

          if (isSeparatedByBreak) {
            sessionGroups.push(buildSessionGroup(currentGroupItems));
            currentGroupItems = [item];
          } else {
            currentGroupItems.push(item);
          }
        }
      }

      if (currentGroupItems.length > 0) {
        sessionGroups.push(buildSessionGroup(currentGroupItems));
      }

      function buildSessionGroup(groupItems: TeacherTeachingAttendance[]): SessionGroup {
        const first = groupItems[0];
        const last = groupItems[groupItems.length - 1];

        const firstRange = getLessonPeriodTimeRange({ timeSlot: first.timeSlot, sequence: first.sequence || 1 });
        const lastRange = getLessonPeriodTimeRange({ timeSlot: last.timeSlot, sequence: last.sequence || groupItems.length });

        let jpLabel = first.jp || `JP ${first.sequence}`;
        if (groupItems.length > 1) {
          const firstSeq = first.sequence;
          const lastSeq = last.sequence;
          jpLabel = `JP ${firstSeq}-${lastSeq}`;
        }

        const checkInTime = groupItems.find(it => it.checkInTime)?.checkInTime;
        const checkOutTime = groupItems.find(it => it.checkOutTime)?.checkOutTime;
        const status = groupItems.find(it => it.status)?.status;
        const isLateUnlocked = groupItems.some(it => (it as any).isLateUnlocked);
        const lateUnlockReason = groupItems.find(it => (it as any).lateUnlockReason)?.lateUnlockReason;

        return {
          sessionKey: `${first.teacherId}_${todayStr}_${first.classId}_${first.subjectId}_${first.sequence}`,
          items: groupItems,
          jpLabel,
          subjectName: first.subjectName,
          className: first.className,
          startM: firstRange.startM,
          endM: lastRange.endM,
          startStr: firstRange.startStr,
          endStr: lastRange.endStr,
          checkInTime,
          checkOutTime,
          status,
          isLateUnlocked,
          lateUnlockReason
        };
      }

      // 8. Determine State Machine Action for Scanned Session Group
      // Active group that has checked in but NOT checked out yet -> Action is CHECK_OUT
      // CRITICAL: If current time has reached or entered the scheduled start of a SUBSEQUENT unstarted session group,
      // prioritize CHECK_IN to the new session rather than checking out of an expired old session!
      const activeCheckInGroup = sessionGroups.find(g => {
        if (!g.checkInTime || g.checkOutTime) return false;

        const gIndex = sessionGroups.findIndex(sg => sg.sessionKey === g.sessionKey);
        const nextGroup = (gIndex >= 0 && gIndex + 1 < sessionGroups.length) ? sessionGroups[gIndex + 1] : null;

        if (nextGroup && !nextGroup.checkInTime && currentM >= nextGroup.startM) {
          // Current time is at or past next group's startM -> next group should be processed for CHECK_IN
          return false;
        }

        return true;
      });

      let targetGroup: SessionGroup | null = null;
      let action: "CHECK_IN" | "CHECK_OUT" = "CHECK_IN";

      if (activeCheckInGroup) {
        targetGroup = activeCheckInGroup;
        action = "CHECK_OUT";
      } else {
        action = "CHECK_IN";

        // Session-aware targetGroup resolution for CHECK_IN:
        // Rule A: Exclude sessions that are already completed (both checkInTime AND checkOutTime exist)
        const openGroups = sessionGroups.filter(g => !(g.checkInTime && g.checkOutTime));

        if (openGroups.length > 0) {
          // Rule B: Calculate effective tolerance window for each session group.
          // Effective end of tolerance must NOT swallow the start time of the next session group.
          const groupsWithWindows = openGroups.map(g => {
            const originalIndex = sessionGroups.findIndex(sg => sg.sessionKey === g.sessionKey);
            const nextGroup = (originalIndex >= 0 && originalIndex + 1 < sessionGroups.length) 
              ? sessionGroups[originalIndex + 1] 
              : null;
            
            const rawToleranceEndM = g.endM + 60;
            // Cap effective tolerance end before next session startM if a next session exists
            const effectiveToleranceEndM = nextGroup 
              ? Math.min(rawToleranceEndM, nextGroup.startM) 
              : rawToleranceEndM;
            
            const windowStartM = g.startM - 15;
            const inWindow = (currentM >= windowStartM && currentM <= effectiveToleranceEndM);
            const distanceToStart = Math.abs(currentM - g.startM);

            return {
              group: g,
              windowStartM,
              effectiveToleranceEndM,
              inWindow,
              distanceToStart
            };
          });

          // Rule C: Prioritize open sessions whose active/tolerance window contains currentM
          const inWindowCandidates = groupsWithWindows.filter(w => w.inWindow);

          if (inWindowCandidates.length > 0) {
            // Sort by:
            // 1. Closest distance to startM (smallest distance first)
            // 2. Unstarted sessions (!checkInTime) preferred over partial
            inWindowCandidates.sort((a, b) => {
              if (a.distanceToStart !== b.distanceToStart) {
                return a.distanceToStart - b.distanceToStart;
              }
              const aStarted = Boolean(a.group.checkInTime);
              const bStarted = Boolean(b.group.checkInTime);
              if (aStarted !== bStarted) {
                return aStarted ? 1 : -1;
              }
              return a.group.startM - b.group.startM;
            });
            targetGroup = inWindowCandidates[0].group;
          } else {
            // Rule D: If outside tolerance windows (e.g. too early before first window or late after last window):
            // Pick open group with closest start time to current time
            groupsWithWindows.sort((a, b) => a.distanceToStart - b.distanceToStart);
            targetGroup = groupsWithWindows[0].group;
          }
        } else {
          // If all sessions for today are already completed, pick the last completed session
          // This will lead to the "Sesi mengajar sudah selesai" message in Rule 1
          targetGroup = sessionGroups[sessionGroups.length - 1];
        }
      }

      // [Attendance Session Resolution] Debug Logging
      console.log("[Attendance Session Resolution]", {
        currentTime: currentTimeStr,
        currentMinutes: currentM,
        sessionGroups: sessionGroups.map((g, idx) => {
          const nextG = (idx + 1 < sessionGroups.length) ? sessionGroups[idx + 1] : null;
          const effectiveEnd = nextG ? Math.min(g.endM + 60, nextG.startM) : (g.endM + 60);
          return {
            sessionIndex: idx + 1,
            jpLabel: g.jpLabel,
            time: `${g.startStr}–${g.endStr}`,
            startM: g.startM,
            endM: g.endM,
            effectiveToleranceEndM: effectiveEnd,
            status: (g.checkInTime && g.checkOutTime) ? "COMPLETED" : (g.checkInTime ? "CHECKED_IN" : "NOT_STARTED"),
            checkInTime: g.checkInTime,
            checkOutTime: g.checkOutTime
          };
        }),
        activeCheckInGroup: activeCheckInGroup ? activeCheckInGroup.jpLabel : null,
        selectedTarget: targetGroup ? targetGroup.jpLabel : null,
        action
      });

      if (!targetGroup) {
        return {
          success: false,
          message: `Sesi jadwal mengajar di kelas ${targetClassName} tidak dapat ditentukan.`
        };
      }

      // If target group is already fully checked out today
      if (action === "CHECK_IN" && targetGroup.checkInTime && targetGroup.checkOutTime) {
        return {
          success: false,
          isAlreadyCompleted: true,
          message: `Sesi mengajar di kelas ${targetClassName} (${targetGroup.jpLabel}) sudah selesai.\n\nCheck-In: ${targetGroup.checkInTime} WIB\nCheck-Out: ${targetGroup.checkOutTime} WIB`
        };
      }

      // --- CHECK OUT FLOW ---
      if (action === "CHECK_OUT") {
        const checkInTimeStr = targetGroup.checkInTime || currentTimeStr;
        const checkInM = parseTimeToMinutes(checkInTimeStr);
        const timeDiffMinutes = Math.max(0, currentM - checkInM);
        const durationMinutes = calculateDurationInMinutes(checkInTimeStr, currentTimeStr);
        const firstItem = targetGroup.items[0];

        // 1. Check Cooldown & Double Scan Protection
        const cooldownSeconds = schoolSettings?.teachingAttendanceSettings?.qrScanCooldownSeconds ?? 60;
        let secondsSinceCheckIn = timeDiffMinutes * 60;
        if (firstItem.updatedAt) {
          const lastUpdatedMs = new Date(firstItem.updatedAt).getTime();
          if (!isNaN(lastUpdatedMs)) {
            secondsSinceCheckIn = Math.floor((Date.now() - lastUpdatedMs) / 1000);
          }
        }

        const formattedCheckIn = checkInTimeStr.replace(":", ".");
        const isPendingLateGroup = Boolean(
          firstItem.requiresLateValidation && 
          (firstItem.attendanceStatus === "Pending" || firstItem.lateValidationStatus === "PENDING" || (firstItem as any).checkInLocked)
        );

        // If time elapsed is less than cooldown or within same minute -> DUPLICATE SCAN
        if (secondsSinceCheckIn < cooldownSeconds || timeDiffMinutes < 1) {
          // Log Ignored Double Scan in Audit Trail
          const auditColRef = collection(db, params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION);
          await addDoc(auditColRef, sanitizeFirestorePayload({
            attendanceDate: todayStr,
            inputTimestamp: new Date().toISOString(),
            userId: currentUserId,
            userName: params.currentUser.name || "Guru",
            userRole: params.currentUser.role || "guru",
            action: "IGNORED_DOUBLE_SCAN",
            scheduleId: firstItem.scheduleId,
            teacherId: firstItem.teacherId,
            teacherName: firstItem.teacherName,
            classId: firstItem.classId,
            className: firstItem.className,
            jp: targetGroup.jpLabel,
            subjectName: firstItem.subjectName,
            status: firstItem.status,
            scanTime: currentTimeStr,
            changesDescription: isPendingLateGroup 
              ? `Ignored Double Scan: Sesi (${targetGroup.jpLabel}) terkunci & menunggu validasi.`
              : `Ignored Double Scan: Scan ulang diabaikan.`
          }));

          const duplicateMsg = isPendingLateGroup
            ? `🔒 JP SUDAH TERKUNCI\n\nSesi ini (${targetGroup.jpLabel}) sudah memiliki Check-in pada pukul ${formattedCheckIn} WIB dan sedang menunggu validasi Kepala Sekolah/Waka Kurikulum karena keterlambatan >15 menit.\nScan ulang tidak diperbolehkan.`
            : `Scan terdeteksi kembali.\nCheck-in Anda sudah tercatat pukul ${formattedCheckIn} WIB.\nCheck-out dilakukan setelah pembelajaran selesai.`;

          return {
            success: true,
            isDuplicateScan: true,
            action: "DUPLICATE_SCAN",
            message: duplicateMsg,
            record: firstItem,
            requiresLateValidation: isPendingLateGroup,
            isLateOver15: isPendingLateGroup
          };
        }

        // 2. Validate Check-Out Conditions:
        // Must meet either: (a) >= 50% of total session duration elapsed OR (b) entered last JP of session
        const sessionStartM = targetGroup.startM;
        const sessionEndM = targetGroup.endM;
        const sessionTotalDurationM = sessionEndM > sessionStartM ? (sessionEndM - sessionStartM) : (40 * targetGroup.items.length);
        const minDurationM = Math.max(1, Math.ceil(sessionTotalDurationM * 0.5));

        const lastItem = targetGroup.items[targetGroup.items.length - 1];
        const lastJpRange = getLessonPeriodTimeRange({ timeSlot: lastItem.timeSlot, sequence: lastItem.sequence });
        const isLastJpEntered = currentM >= lastJpRange.startM;
        const is50PercentPassed = durationMinutes >= minDurationM || (currentM - sessionStartM) >= minDurationM;

        if (!is50PercentPassed && !isLastJpEntered) {
          const duplicateMsg = isPendingLateGroup
            ? `🔒 JP SUDAH TERKUNCI\n\nSesi ini (${targetGroup.jpLabel}) sudah memiliki Check-in pada pukul ${formattedCheckIn} WIB dan sedang menunggu validasi Kepala Sekolah/Waka Kurikulum karena keterlambatan >15 menit.\nScan ulang tidak diperbolehkan.`
            : `Scan terdeteksi kembali.\nCheck-in Anda sudah tercatat pukul ${formattedCheckIn} WIB.\nCheck-out dilakukan setelah pembelajaran selesai.`;

          return {
            success: true,
            isDuplicateScan: true,
            action: "DUPLICATE_SCAN",
            message: duplicateMsg,
            record: firstItem,
            requiresLateValidation: isPendingLateGroup,
            isLateOver15: isPendingLateGroup
          };
        }

        const firstItemStatus = targetGroup.items[0].status;

        for (const item of targetGroup.items) {
          item.checkOutTime = currentTimeStr;
          item.teachingDurationMinutes = durationMinutes;
          
          // Subsequent JPs in multi-JP session change from Belum Terkonfirmasi to HADIR (or Terlambat)
          if (item.status === "Belum Terkonfirmasi" || !item.status) {
            item.status = firstItemStatus === "Terlambat" ? "Terlambat" : "Hadir Mengajar";
          }
          item.updatedAt = new Date().toISOString();

          if (matchedClass?.id) {
            item.classId = matchedClass.id;
            item.className = matchedClass.name;
          }

          if (!item.checkInLogs || item.checkInLogs.length === 0) {
            item.checkInLogs = [{ checkIn: checkInTimeStr, checkOut: currentTimeStr, durationMinutes }];
          } else {
            const activeLog = item.checkInLogs.find(l => !l.checkOut);
            if (activeLog) {
              activeLog.checkOut = currentTimeStr;
              activeLog.durationMinutes = durationMinutes;
            } else {
              item.checkInLogs[item.checkInLogs.length - 1].checkOut = currentTimeStr;
              item.checkInLogs[item.checkInLogs.length - 1].durationMinutes = durationMinutes;
            }
          }

          await this.saveSingleSessionAttendance(
            todayStr,
            item,
            currentUserId,
            params.currentUser.name || "Guru",
            `QR Code CHECK_OUT: ${currentTimeStr}`,
            params.isSimulation
          );
        }

        const auditColRef = collection(db, params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION);
        await addDoc(auditColRef, sanitizeFirestorePayload({
          attendanceDate: todayStr,
          inputTimestamp: new Date().toISOString(),
          userId: currentUserId,
          userName: params.currentUser.name || "Guru",
          scheduleId: targetGroup.items[0].scheduleId,
          teacherId: targetGroup.items[0].teacherId,
          teacherName: targetGroup.items[0].teacherName,
          classId: targetGroup.items[0].classId,
          className: targetGroup.items[0].className,
          subjectId: targetGroup.items[0].subjectId,
          subjectName: targetGroup.items[0].subjectName,
          jp: targetGroup.jpLabel,
          scanTime: `${currentTimeStr} WIB`,
          previousStatus: "CHECK-IN",
          newStatus: "SELESAI",
          action: "CHECK_OUT",
          reason: `Check-Out QR Berhasil (${durationMinutes} menit)`,
          validationResult: "Sukses",
          isLateInput: false
        }));

        const returnMsg = `CHECK OUT Berhasil di Kelas ${targetGroup.className} (${targetGroup.jpLabel} - ${targetGroup.subjectName}). Durasi mengajar: ${durationMinutes} menit. Seluruh JP terkonfirmasi HADIR.`;

        return {
          success: true,
          action: "CHECK_OUT",
          message: returnMsg,
          record: targetGroup.items[0]
        };
      }

      // --- CHECK IN FLOW ---

      // Rule 1: Duplicate Scan Check / Already Completed Session
      if (targetGroup.checkInTime && targetGroup.checkOutTime) {
        const completedMsg = `Sesi mengajar ini telah selesai.\n\nCheck-in :\n${targetGroup.checkInTime}\n\nCheck-out :\n${targetGroup.checkOutTime}\n\nData sudah tersimpan dan tidak dapat dipindai kembali.`;

        const auditColRef = collection(db, params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION);
        await addDoc(auditColRef, sanitizeFirestorePayload({
          attendanceDate: todayStr,
          inputTimestamp: new Date().toISOString(),
          userId: currentUserId,
          userName: params.currentUser.name || "Guru",
          scheduleId: targetGroup.items[0].scheduleId,
          teacherId: targetGroup.items[0].teacherId,
          teacherName: targetGroup.items[0].teacherName,
          classId: targetGroup.items[0].classId,
          className: targetGroup.items[0].className,
          subjectId: targetGroup.items[0].subjectId,
          subjectName: targetGroup.items[0].subjectName,
          jp: targetGroup.jpLabel,
          scanTime: `${currentTimeStr} WIB`,
          previousStatus: "SELESAI",
          newStatus: "SELESAI",
          action: "REJECTED_COMPLETED",
          reason: "Percobaan scan ulang pada sesi mengajar yang sudah selesai",
          validationResult: "Ditolak - Sesi Selesai",
          isLateInput: false
        }));

        return {
          success: false,
          message: completedMsg
        };
      }

      // Rule 2: Validate Check-In Time Window for Target Session Group
      if (currentM < targetGroup.startM - 15) {
        const earlyMsg = `Terlalu awal. Check-In untuk mapel ${targetGroup.subjectName} (${targetGroup.jpLabel}) di kelas ${targetClassName} baru dapat dilakukan 15 menit sebelum jam ${targetGroup.startStr} (mulai ${formatMinutesToTime(targetGroup.startM - 15)} WIB).`;
        return {
          success: false,
          message: earlyMsg
        };
      }

      // Rule 3: Evaluate expired vs active JPs ONLY for the scanned targetGroup session
      if (!targetGroup.checkInTime && currentM >= targetGroup.endM + 60) {
        const missedLabels: string[] = [];
        for (const item of targetGroup.items) {
          item.status = "Tidak Hadir";
          item.updatedAt = new Date().toISOString();
          if (matchedClass?.id) {
            item.classId = matchedClass.id;
            item.className = matchedClass.name;
          }
          await this.saveSingleSessionAttendance(
            todayStr,
            item,
            currentUserId,
            params.currentUser.name || "Guru",
            `Sesi Selesai - Tidak Hadir: ${currentTimeStr}`,
            params.isSimulation
          );
          missedLabels.push(item.jp || `JP ${item.sequence}`);
        }

        const auditColRef = collection(db, params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION);
        await addDoc(auditColRef, sanitizeFirestorePayload({
          attendanceDate: todayStr,
          inputTimestamp: new Date().toISOString(),
          userId: currentUserId,
          userName: params.currentUser.name || "Guru",
          scheduleId: targetGroup.items[0].scheduleId,
          teacherId: targetGroup.items[0].teacherId,
          teacherName: targetGroup.items[0].teacherName,
          classId: targetGroup.items[0].classId,
          className: targetGroup.items[0].className,
          subjectId: targetGroup.items[0].subjectId,
          subjectName: targetGroup.items[0].subjectName,
          jp: missedLabels.join(", "),
          scanTime: `${currentTimeStr} WIB`,
          previousStatus: "BELUM ABSEN",
          newStatus: "TIDAK HADIR",
          action: "REJECTED_EXPIRED",
          reason: `Sesi mengajar ${targetGroup.subjectName} (${targetGroup.jpLabel}) di kelas ${targetClassName} telah berakhir sebelum scan QR.`,
          validationResult: "Tercatat Tidak Hadir",
          isLateInput: false
        }));

        return {
          success: false,
          message: `Sesi mengajar ${targetGroup.subjectName} (${targetGroup.jpLabel}) di kelas ${targetClassName} untuk hari ini telah selesai (${targetGroup.endStr} WIB).\n\nStatus JP (${missedLabels.join(", ")}) tercatat TIDAK HADIR karena pemindaian dilakukan setelah sesi berakhir.`
        };
      }

      // Perform Per-JP Attendance Evaluation ONLY for targetGroup.items
      const missedJpList: string[] = [];
      const activeJpList: { label: string; status: AttendanceTeachingStatus; isPendingLate?: boolean; lateMinutes?: number }[] = [];

      for (const item of targetGroup.items) {
        const itemRange = getLessonPeriodTimeRange({ timeSlot: item.timeSlot, sequence: item.sequence });
        const jpLabel = item.jp || `JP ${item.sequence}`;
        const itemStartM = itemRange.startM;
        const itemEndM = itemRange.endM;

        if (item.checkInTime && item.status !== "Belum Terkonfirmasi" && item.status !== "Belum Diverifikasi") {
          if (item.status === "Tidak Hadir") {
            missedJpList.push(jpLabel);
          } else if (item.status === "Terlambat" || item.status === "Hadir Mengajar") {
            const isPendingLate = item.requiresLateValidation && (item.attendanceStatus === "Pending" || item.lateValidationStatus === "PENDING");
            activeJpList.push({ label: jpLabel, status: item.status as AttendanceTeachingStatus, isPendingLate, lateMinutes: item.lateMinutes || 0 });
          }
          continue;
        }

        if (currentM >= itemEndM) {
          // JP ended before scan -> TIDAK HADIR
          item.status = "Tidak Hadir";
          item.attendanceStatus = "Approved";
          item.approvalType = "Automatic";
          item.requiresLateValidation = false;
          item.checkInLocked = true;
          item.isLateLocked = false;
          item.lockReason = "SESI TERLEWAT SEBELUM SCAN PERTAMA";
          item.scheduleStartTime = itemRange.startStr;
          item.scheduleEndTime = itemRange.endStr;
          item.updatedAt = new Date().toISOString();
          if (matchedClass?.id) {
            item.classId = matchedClass.id;
            item.className = matchedClass.name;
          }
          await this.saveSingleSessionAttendance(
            todayStr,
            item,
            currentUserId,
            params.currentUser.name || "Guru",
            `Auto Missed JP (${jpLabel}): Scan dilakukan pada ${currentTimeStr} setelah ${itemRange.endStr} WIB`,
            params.isSimulation
          );
          missedJpList.push(jpLabel);
        } else {
          // Scan occurs before JP ends -> Check-In for this JP
          const lateMinutes = currentM > itemStartM ? (currentM - itemStartM) : 0;
          const isLateOver15 = currentM > (itemStartM + 15);
          const isPunctualOrNormalLate = !isLateOver15;

          item.checkInTime = currentTimeStr;
          item.checkInType = "Scan QR";
          item.scheduleStartTime = itemRange.startStr;
          item.scheduleEndTime = itemRange.endStr;
          item.lateMinutes = lateMinutes;
          item.updatedAt = new Date().toISOString();

          if (matchedClass?.id) {
            item.classId = matchedClass.id;
            item.className = matchedClass.name;
          }

          if (isLateOver15) {
            // KONDISI B: Terlambat > 15 Menit -> Status TERLAMBAT >15 MENIT — MENUNGGU VALIDASI
            // JP dikunci untuk perhitungan kehadiran (Kehadiran = 0 sementara sampai divalidasi)
            item.status = "Terlambat";
            item.attendanceStatus = "Pending";
            item.approvalType = "Manual";
            item.requiresLateValidation = true;
            item.lateValidationStatus = "PENDING";
            item.checkInLocked = true;
            item.isLateLocked = true;
            item.lockReason = "TERLAMBAT >15 MENIT — MENUNGGU VALIDASI";
            item.pendingReason = "TERLAMBAT >15 MENIT — MENUNGGU VALIDASI";
            item.notes = `Terlambat scan ${lateMinutes} menit (Jadwal: ${itemRange.startStr} WIB, Scan: ${currentTimeStr} WIB). Menunggu validasi Kepala Sekolah / Waka Kurikulum.`;

            activeJpList.push({ label: jpLabel, status: "Terlambat", isPendingLate: true, lateMinutes });
          } else {
            // KONDISI A: Tepat Waktu atau Keterlambatan normal <= 15 Menit
            const activeStatus: AttendanceTeachingStatus = (currentM > itemStartM) ? "Terlambat" : "Hadir Mengajar";
            item.status = activeStatus;
            item.attendanceStatus = "Approved";
            item.approvalType = "Automatic";
            item.requiresLateValidation = false;
            item.lateValidationStatus = "APPROVED";
            item.checkInLocked = false;
            item.isLateLocked = false;
            item.lockReason = "";
            item.pendingReason = "";
            if (lateMinutes > 0) {
              item.notes = `Scan terlambat ${lateMinutes} menit (Toleransi <=15 Menit).`;
            }

            activeJpList.push({ label: jpLabel, status: activeStatus, isPendingLate: false, lateMinutes });
          }

          if (!item.checkInLogs) item.checkInLogs = [];
          item.checkInLogs.push({ checkIn: currentTimeStr });

          await this.saveSingleSessionAttendance(
            todayStr,
            item,
            currentUserId,
            params.currentUser.name || "Guru",
            `QR Code CHECK_IN (${jpLabel}): ${currentTimeStr}`,
            params.isSimulation
          );
        }
      }

      const hasPendingLate = activeJpList.some(a => a.isPendingLate);
      const primaryActive = activeJpList[0];
      const mainStatus = primaryActive ? primaryActive.status : "Terlambat";

      const auditColRef = collection(db, params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION);
      await addDoc(auditColRef, sanitizeFirestorePayload({
        attendanceDate: todayStr,
        inputTimestamp: new Date().toISOString(),
        userId: currentUserId,
        userName: params.currentUser.name || "Guru",
        scheduleId: targetGroup.items[0].scheduleId,
        teacherId: targetGroup.items[0].teacherId,
        teacherName: targetGroup.items[0].teacherName,
        classId: targetGroup.items[0].classId,
        className: targetGroup.items[0].className,
        subjectId: targetGroup.items[0].subjectId,
        subjectName: targetGroup.items[0].subjectName,
        jp: targetGroup.jpLabel,
        scanTime: `${currentTimeStr} WIB`,
        previousStatus: "BELUM ABSEN",
        newStatus: mainStatus,
        action: "CHECK_IN",
        reason: hasPendingLate 
          ? "Check-In Terlambat >15 Menit (Menunggu Validasi Pimpinan/Wakakur)" 
          : (mainStatus === "Terlambat" ? "Check-In Terlambat Normal (<=15 Menit)" : "Check-In Tepat Waktu"),
        validationResult: hasPendingLate ? "Menunggu Validasi" : "Sukses",
        isLateInput: hasPendingLate || mainStatus === "Terlambat"
      }));

      const statusLines: string[] = [];
      if (missedJpList.length > 0) {
        statusLines.push(`• ${missedJpList.join(", ")}: TIDAK HADIR (Terlewat)`);
      }
      if (activeJpList.length > 0) {
        activeJpList.forEach(a => {
          if (a.isPendingLate) {
            statusLines.push(`• ${a.label}: TERLAMBAT >15 MENIT — MENUNGGU VALIDASI (+${a.lateMinutes} menit, Kehadiran sementara = 0)`);
          } else if (a.status === "Terlambat") {
            statusLines.push(`• ${a.label}: TERLAMBAT (Toleransi <=15 Menit, +${a.lateMinutes} menit)`);
          } else {
            statusLines.push(`• ${a.label}: HADIR (Tepat Waktu)`);
          }
        });
      }

      const checkInSuccessMsg = hasPendingLate
        ? `⚠️ SCAN TERCATAT — MENUNGGU VALIDASI (TERLAMBAT >15 MENIT)\nKelas ${targetClassName} (${targetGroup.subjectName} - ${targetGroup.jpLabel})\n\nDetail Status Sesi:\n${statusLines.join("\n")}\n\nPerhatian: Sesi yang terlambat >15 menit dikunci untuk perhitungan kehadiran (0 JP) sampai divalidasi oleh Kepala Sekolah / Waka Kurikulum. Sesi JP selanjutnya tetap terbuka.`
        : `CHECK IN Berhasil di Kelas ${targetClassName} (${targetGroup.subjectName} - ${targetGroup.jpLabel}).\n\nDetail Status Sesi:\n${statusLines.join("\n")}`;

      return {
        success: true,
        action: "CHECK_IN",
        message: checkInSuccessMsg,
        record: targetGroup.items[0],
        requiresLateValidation: hasPendingLate,
        isLateOver15: hasPendingLate,
        lateMinutes: primaryActive?.lateMinutes || 0
      };
    } catch (error: any) {
      console.error("[QR Audit ERROR] Exception in processQrCheckIn:", error);
      return {
        success: false,
        message: `Gagal memproses QR Code: ${error?.message || "Terjadi kesalahan internal server."}`
      };
    }
  },

  // Unlock Locked Session by Wakakur / Admin
  async unlockLateCheckIn(params: {
    scheduleId: string;
    dateStr?: string;
    reason: string;
    validatorUserId: string;
    validatorUserName: string;
    isSimulation?: boolean;
  }): Promise<void> {
    const resolvedUid = resolveUserId(params.validatorUserId);
    if (!resolvedUid) {
      throw new Error("Gagal membuka kunci sesi: Identitas Pengguna tidak ditemukan.");
    }

    const targetDate = params.dateStr || getTodayDateStr();
    const { items } = await this.getAttendanceForDate(targetDate, "", "", params.isSimulation);
    const item = items.find(i => i.scheduleId === params.scheduleId);
    if (!item) {
      throw new Error("Sesi jadwal mengajar tidak ditemukan.");
    }

    const docId = item.id || `${targetDate}_${params.scheduleId}`;
    const targetColName = params.isSimulation ? "teacher_teaching_attendances_simulation" : COLLECTION_NAME;
    const docRef = doc(db, targetColName, docId);
    const snap = await getDoc(docRef);

    const now = new Date().toISOString();
    const updates: Partial<TeacherTeachingAttendance> = {
      status: "Terlambat",
      attendanceStatus: "Approved",
      lateValidationStatus: "APPROVED",
      requiresLateValidation: false,
      checkInLocked: false,
      isLateLocked: false,
      lockReason: "",
      pendingReason: "",
      validatedBy: params.validatorUserName,
      validatedByUserId: resolvedUid,
      validatedAt: now,
      validationNote: `Validasi Check-in Terlambat Wakakur: ${params.reason}`,
      updatedAt: now
    };
    (updates as any).isLateUnlocked = true;
    (updates as any).lateUnlockedByUserId = resolvedUid;
    (updates as any).lateUnlockedByUserName = params.validatorUserName;
    (updates as any).lateUnlockedAt = now;
    (updates as any).lateUnlockReason = params.reason;

    if (snap.exists()) {
      await updateDoc(docRef, sanitizeFirestorePayload(updates));
    } else {
      await setDoc(docRef, sanitizeFirestorePayload({
        ...item,
        ...updates,
        date: targetDate,
        scheduleId: params.scheduleId,
        createdAt: now
      }), { merge: true });
    }

    const targetAuditCol = params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION;
    const auditColRef = collection(db, targetAuditCol);
    await addDoc(auditColRef, sanitizeFirestorePayload({
      attendanceDate: targetDate,
      inputTimestamp: now,
      userId: resolvedUid,
      userName: params.validatorUserName,
      scheduleId: params.scheduleId,
      teacherId: item.teacherId,
      teacherName: item.teacherName,
      classId: item.classId,
      className: item.className,
      subjectId: item.subjectId,
      subjectName: item.subjectName,
      jp: item.jp,
      scanTime: `${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())} WIB`,
      previousStatus: item.status || "DIKUNCI",
      newStatus: "Terlambat (Unlocked)",
      action: "UNLOCK_WAKAKUR",
      reason: `Validasi Check-in Terlambat Wakakur: ${params.reason}`,
      validationResult: "Diizinkan Scan QR Check-in oleh Wakakur",
      isLateInput: true
    }));
  },

  // Completely wipe simulation collections without affecting production
  async resetSimulationData(): Promise<void> {
    try {
      // 1. Delete teacher_teaching_attendances_simulation
      const simColRef = collection(db, "teacher_teaching_attendances_simulation");
      const simSnap = await getDocs(simColRef);
      const deletePromises: Promise<void>[] = [];
      simSnap.forEach(docSnap => {
        deletePromises.push(deleteDoc(doc(db, "teacher_teaching_attendances_simulation", docSnap.id)));
      });

      // 2. Delete teacher_attendance_audit_logs_simulation
      const auditColRef = collection(db, "teacher_attendance_audit_logs_simulation");
      const auditSnap = await getDocs(auditColRef);
      auditSnap.forEach(docSnap => {
        deletePromises.push(deleteDoc(doc(db, "teacher_attendance_audit_logs_simulation", docSnap.id)));
      });

      await Promise.all(deletePromises);
      console.log("[SIMULATION RESET] Successfully wiped simulation records.");
    } catch (error) {
      console.error("[SIMULATION RESET ERROR]", error);
      throw error;
    }
  },

  // Fetch simulation audit logs
  async getSimulationAuditLogs(): Promise<TeacherAttendanceAuditLog[]> {
    try {
      const auditColRef = collection(db, "teacher_attendance_audit_logs_simulation");
      const snap = await getDocs(auditColRef);
      const logs: TeacherAttendanceAuditLog[] = [];
      snap.forEach(d => {
        logs.push({ id: d.id, ...d.data() } as TeacherAttendanceAuditLog);
      });
      logs.sort((a, b) => (b.inputTimestamp || "").localeCompare(a.inputTimestamp || ""));
      return logs;
    } catch (error) {
      console.error("Error fetching simulation audit logs:", error);
      return [];
    }
  },

  // Validate Attendance (Approve / Reject) by Kepala Sekolah / Wakakur / Admin
  async validateAttendance(params: {
    attendanceId: string;
    dateStr?: string;
    status: "Approved" | "Rejected";
    validationNote?: string;
    validatorUserId: string;
    validatorUserName: string;
    validatorRole?: string;
    isSimulation?: boolean;
  }): Promise<void> {
    const resolvedUid = resolveUserId(params.validatorUserId);
    if (!resolvedUid) {
      throw new Error("Gagal memvalidasi absensi: Identitas Pengguna (Firebase Auth UID) tidak ditemukan.");
    }

    const targetCollection = params.isSimulation ? "teacher_teaching_attendances_simulation" : COLLECTION_NAME;
    const docRef = doc(db, targetCollection, params.attendanceId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error("Data absensi tidak ditemukan.");
    }

    const now = new Date().toISOString();
    const validatorRoleName = params.validatorRole || "Waka Kurikulum";
    const isApproved = params.status === "Approved";
    const updates: Partial<TeacherTeachingAttendance> = {
      attendanceStatus: params.status,
      lateValidationStatus: isApproved ? "APPROVED" : "REJECTED",
      requiresLateValidation: false,
      checkInLocked: !isApproved,
      isLateLocked: !isApproved,
      lockReason: isApproved ? "" : "VALIDASI DITOLAK — TIDAK HADIR",
      pendingReason: isApproved ? "" : `Ditolak oleh ${validatorRoleName}`,
      status: isApproved ? (snap.data()?.status || "Terlambat") : "Tidak Hadir",
      validatedBy: params.validatorUserName,
      validatedByUserId: resolvedUid,
      validatedByRole: validatorRoleName,
      validatedAt: now,
      validationNote: params.validationNote || (isApproved ? `Disetujui oleh ${validatorRoleName}` : `Ditolak oleh ${validatorRoleName}`),
      approvalType: "Manual",
      updatedAt: now
    };

    await updateDoc(docRef, sanitizeFirestorePayload(updates));

    const data = snap.data();
    const auditColRef = collection(db, params.isSimulation ? "teacher_attendance_audit_logs_simulation" : AUDIT_LOGS_COLLECTION);
    await addDoc(auditColRef, sanitizeFirestorePayload({
      attendanceDate: params.dateStr || data.date,
      inputTimestamp: now,
      userId: resolvedUid,
      userName: params.validatorUserName,
      scheduleId: data.scheduleId,
      teacherId: data.teacherId,
      teacherName: data.teacherName,
      classId: data.classId,
      className: data.className,
      subjectName: data.subjectName,
      jp: data.jp,
      previousStatus: data.attendanceStatus || "Pending",
      newStatus: params.status === "Approved" ? (data.status || "Hadir Mengajar") : "DITOLAK",
      reason: `Validasi ${validatorRoleName}: ${params.status} (${params.validationNote || "-"})`,
      validationResult: params.status === "Approved" ? "Diterima / Hadir" : "Ditolak",
      isLateInput: false
    }));
  },

  // Get Validation Statistics
  async getAttendanceValidationStats(
    dateStr?: string,
    academicYearId?: string,
    semesterId?: string
  ): Promise<{
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    automaticApprovalCount: number;
    manualApprovalCount: number;
    latePendingCount: number;
    totalCount: number;
  }> {
    const targetDate = dateStr || getTodayDateStr();
    const { items } = await this.getAttendanceForDate(targetDate, academicYearId || "", semesterId || "");

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let automaticApprovalCount = 0;
    let manualApprovalCount = 0;
    let latePendingCount = 0;

    items.forEach(item => {
      if (item.status === "KBM Ditiadakan") return;

      const evalRes = this.evaluateAttendanceApprovalStatus(item);
      const status = item.attendanceStatus || evalRes.attendanceStatus;
      const type = item.approvalType || evalRes.approvalType;

      const isLatePending = !!item.requiresLateValidation && status === "Pending";
      if (isLatePending) {
        latePendingCount++;
      }

      if (status === "Approved") {
        approvedCount++;
        if (type === "Automatic") automaticApprovalCount++;
        else manualApprovalCount++;
      } else if (status === "Rejected") {
        rejectedCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      automaticApprovalCount,
      manualApprovalCount,
      latePendingCount,
      totalCount: items.length
    };
  },

  // Perform Manual Check Out by Wakakur / Admin
  async performManualCheckOut(params: {
    dateStr: string;
    scheduleId: string;
    manualCheckOutTime: string; // e.g. "08:15"
    userId: string;
    userName: string;
    reason: string;
  }): Promise<void> {
    const resolvedUid = resolveUserId(params.userId);

    if (!resolvedUid) {
      console.error("[Manual Check Out Error] userId is empty or undefined!", {
        paramsUserId: params.userId,
        authCurrentUser: auth?.currentUser
      });
      throw new Error("Gagal melakukan Check Out Manual: Identitas pengguna (Firebase Auth UID) tidak ditemukan. Silakan login ulang.");
    }

    const { items } = await this.getAttendanceForDate(params.dateStr, "", "");
    const item = items.find(i => i.scheduleId === params.scheduleId);
    if (!item) {
      throw new Error("Sesi jadwal mengajar tidak ditemukan.");
    }

    let breakTimes: any[] = [];
    try {
      const schoolSettings = await schoolSettingsService.getSettings();
      breakTimes = schoolSettings?.breakTimes || [];
    } catch (e) {
      breakTimes = [];
    }

    const teacherClassSubjectItems = items
      .filter(i =>
        i.teacherId === item.teacherId &&
        i.classId === item.classId &&
        i.subjectId === item.subjectId
      )
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    // Group into contiguous session groups separated by break (gap >= 10 mins or school break times)
    const sessionGroups: TeacherTeachingAttendance[][] = [];
    let currentGroup: TeacherTeachingAttendance[] = [];

    for (let i = 0; i < teacherClassSubjectItems.length; i++) {
      const it = teacherClassSubjectItems[i];
      const range = getLessonPeriodTimeRange({ timeSlot: it.timeSlot, sequence: it.sequence || (i + 1) });

      if (currentGroup.length === 0) {
        currentGroup.push(it);
      } else {
        const prevIt = currentGroup[currentGroup.length - 1];
        const prevRange = getLessonPeriodTimeRange({ timeSlot: prevIt.timeSlot, sequence: prevIt.sequence || i });

        const isSeparatedByBreak = breakTimes.some((b: any) => {
          const bStartM = parseTimeToMinutes(b.start);
          const bEndM = parseTimeToMinutes(b.end || b.start);
          return prevRange.endM <= bStartM && range.startM >= bEndM;
        }) || (range.startM - prevRange.endM >= 10);

        if (isSeparatedByBreak) {
          sessionGroups.push(currentGroup);
          currentGroup = [it];
        } else {
          currentGroup.push(it);
        }
      }
    }

    if (currentGroup.length > 0) {
      sessionGroups.push(currentGroup);
    }

    // Find the specific session group containing the target scheduleId
    const targetSessionGroup = sessionGroups.find(grp => grp.some(gItem => gItem.scheduleId === params.scheduleId)) || [item];

    for (const sessionItem of targetSessionGroup) {
      const checkInStr = sessionItem.checkInTime || "07:30";
      const duration = calculateDurationInMinutes(checkInStr, params.manualCheckOutTime);

      sessionItem.checkOutTime = params.manualCheckOutTime;
      sessionItem.isManualCheckOut = true;
      sessionItem.manualCheckOutByUserId = resolvedUid;
      sessionItem.manualCheckOutByUserName = params.userName;
      sessionItem.manualCheckOutTime = new Date().toISOString();
      sessionItem.manualCheckOutReason = params.reason;
      sessionItem.teachingDurationMinutes = duration;
      sessionItem.notes = `${sessionItem.notes ? sessionItem.notes + " | " : ""}Check Out Manual oleh ${params.userName}: ${params.reason}`;

      if (sessionItem.status === "Belum Terkonfirmasi" || !sessionItem.status) {
        sessionItem.status = "Hadir Mengajar";
      }

      if (!sessionItem.checkInLogs || sessionItem.checkInLogs.length === 0) {
        sessionItem.checkInLogs = [{ checkIn: checkInStr, checkOut: params.manualCheckOutTime, durationMinutes: duration, note: params.reason }];
      } else {
        const last = sessionItem.checkInLogs[sessionItem.checkInLogs.length - 1];
        last.checkOut = params.manualCheckOutTime;
        last.durationMinutes = duration;
        last.note = params.reason;
      }

      await this.saveSingleSessionAttendance(
        params.dateStr,
        sessionItem,
        resolvedUid,
        params.userName,
        `Check Out Manual: ${params.reason}`
      );
    }
  },

  // Get QR Check-In Monitoring Indicators for Wakakur Dashboard
  async getQrMonitoringStats(dateStr: string, academicYearId?: string, semesterId?: string): Promise<{
    belumCheckIn: TeacherTeachingAttendance[];
    belumCheckOut: TeacherTeachingAttendance[];
    terlambatCheckIn: TeacherTeachingAttendance[];
    lupaCheckOut: TeacherTeachingAttendance[];
    totalCheckInQrCount: number;
  }> {
    const { items } = await this.getAttendanceForDate(dateStr, academicYearId || "", semesterId || "");
    const now = new Date();
    let defaultTimeStr = "";
    try {
      defaultTimeStr = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    } catch (e) {
      defaultTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    const currentM = parseTimeToMinutes(defaultTimeStr);

    const belumCheckIn: TeacherTeachingAttendance[] = [];
    const belumCheckOut: TeacherTeachingAttendance[] = [];
    const terlambatCheckIn: TeacherTeachingAttendance[] = [];
    const lupaCheckOut: TeacherTeachingAttendance[] = [];
    let totalCheckInQrCount = 0;

    items.forEach(item => {
      if (item.status === "KBM Ditiadakan" || item.status === "Izin" || item.status === "Sakit" || item.status === "Tidak Hadir") {
        return;
      }

      let startM = 0;
      let endM = 0;
      if (item.timeSlot && item.timeSlot.includes("-")) {
        const [s, e] = item.timeSlot.split("-").map(x => x.trim());
        startM = parseTimeToMinutes(s);
        endM = parseTimeToMinutes(e);
      } else {
        startM = 450 + (item.sequence - 1) * 45;
        endM = startM + 45;
      }

      if (item.checkInTime) {
        totalCheckInQrCount++;
      }

      // 1. Belum Check In: Schedule period has started (or current time > startM) but no checkInTime recorded
      if (!item.checkInTime && currentM >= startM) {
        belumCheckIn.push(item);
      }

      // 2. Belum Check Out: Checked-in, schedule period ended (current time > endM), but no checkOutTime or status is Belum Terkonfirmasi
      if (item.checkInTime && (!item.checkOutTime || item.status === "Belum Terkonfirmasi") && currentM > endM) {
        belumCheckOut.push(item);
      }

      // 3. Terlambat Check In
      if (item.status === "Terlambat" || (item.checkInTime && parseTimeToMinutes(item.checkInTime) > startM + 15)) {
        terlambatCheckIn.push(item);
      }

      // 4. Lupa Check Out (Checked in, period ended > 60 mins ago without checkOutTime or Belum Terkonfirmasi, or manual checkout performed)
      if (item.isManualCheckOut || (item.checkInTime && (!item.checkOutTime || item.status === "Belum Terkonfirmasi") && currentM > endM + 60)) {
        lupaCheckOut.push(item);
      }
    });

    return {
      belumCheckIn,
      belumCheckOut,
      terlambatCheckIn,
      lupaCheckOut,
      totalCheckInQrCount
    };
  },

  // Get full timeline history for a specific teacher (Bidirectional: Original Schedule & Substitutions)
  async getTeacherHistory(
    teacherId: string,
    filters?: { academicYearId?: string; semesterId?: string; startDate?: string; endDate?: string }
  ): Promise<TeacherTeachingAttendance[]> {
    const { rawRecords } = await this.getAttendanceRecap({
      ...filters,
      teacherId
    });

    const mapped = rawRecords.map(rec => {
      const isSub = (rec.substituteTeacherId === teacherId && rec.teacherId !== teacherId);
      const isExchangedIn = (rec.exchangedWithTeacherId === teacherId && rec.teacherId !== teacherId);
      const isReplaced = (rec.teacherId === teacherId && rec.status === "Digantikan Guru Lain");
      const isExchangedOut = (rec.teacherId === teacherId && rec.status === "Tukar Jadwal");

      return {
        ...rec,
        isSubstitution: isSub || isExchangedIn,
        isReplaced: isReplaced || isExchangedOut,
        originalTeacherId: rec.teacherId,
        originalTeacherName: rec.teacherName,
        replacementId: rec.replacementId || (rec.id ? `REP-${rec.id}` : undefined)
      };
    });

    mapped.sort((a, b) => {
      const dateComp = b.date.localeCompare(a.date);
      if (dateComp !== 0) return dateComp;
      return a.sequence - b.sequence;
    });

    return mapped;
  },

  // Calculate Executive Indicators and JP Summaries from Attendance Records
  getExecutiveTeachingAnalytics(records: TeacherTeachingAttendance[]) {
    let jpHadir = 0;
    let jpBelumTerkonfirmasi = 0;
    let jpTerlambat = 0;
    let jpAlpa = 0;
    let jpDikunci = 0;

    const teacherMap: Record<string, {
      teacherId: string;
      teacherName: string;
      total: number;
      hadir: number;
      unconfirmed: number;
      terlambat: number;
      dikunci: number;
    }> = {};

    const classMap: Record<string, {
      classId: string;
      className: string;
      total: number;
      terlambat: number;
    }> = {};

    const subjectMap: Record<string, {
      subjectId: string;
      subjectName: string;
      total: number;
      hadir: number;
    }> = {};

    records.forEach(item => {
      const isLocked = (item.status as string) === "DIKUNCI" || (item as any).isLocked || (item.notes && item.notes.toLowerCase().includes("dikunci"));
      
      if (item.status === "Hadir Mengajar") {
        jpHadir++;
      } else if (item.status === "Belum Terkonfirmasi") {
        jpBelumTerkonfirmasi++;
      } else if (item.status === "Terlambat") {
        jpTerlambat++;
      } else if (item.status === "Tidak Hadir") {
        jpAlpa++;
      } else if (isLocked) {
        jpDikunci++;
      }

      // Teacher stats
      if (item.teacherId) {
        if (!teacherMap[item.teacherId]) {
          teacherMap[item.teacherId] = {
            teacherId: item.teacherId,
            teacherName: item.teacherName || "Guru",
            total: 0,
            hadir: 0,
            unconfirmed: 0,
            terlambat: 0,
            dikunci: 0
          };
        }
        const t = teacherMap[item.teacherId];
        t.total++;
        if (item.status === "Hadir Mengajar") t.hadir++;
        if (item.status === "Belum Terkonfirmasi") t.unconfirmed++;
        if (item.status === "Terlambat") t.terlambat++;
        if (isLocked) t.dikunci++;
      }

      // Class stats
      if (item.classId || item.className) {
        const cKey = item.classId || item.className;
        if (!classMap[cKey]) {
          classMap[cKey] = {
            classId: item.classId || cKey,
            className: item.className || cKey,
            total: 0,
            terlambat: 0
          };
        }
        classMap[cKey].total++;
        if (item.status === "Terlambat") classMap[cKey].terlambat++;
      }

      // Subject stats
      if (item.subjectId || item.subjectName) {
        const sKey = item.subjectId || item.subjectName;
        if (!subjectMap[sKey]) {
          subjectMap[sKey] = {
            subjectId: item.subjectId || sKey,
            subjectName: item.subjectName || sKey,
            total: 0,
            hadir: 0
          };
        }
        subjectMap[sKey].total++;
        if (item.status === "Hadir Mengajar") subjectMap[sKey].hadir++;
      }
    });

    const teacherList = Object.values(teacherMap);

    const topUnconfirmedTeachers = [...teacherList]
      .filter(t => t.unconfirmed > 0)
      .sort((a, b) => b.unconfirmed - a.unconfirmed)
      .slice(0, 5);

    const mostDisciplinedTeachers = [...teacherList]
      .filter(t => t.total > 0)
      .map(t => ({
        ...t,
        percentage: Math.round((t.hadir / t.total) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage || b.hadir - a.hadir)
      .slice(0, 5);

    const mostLateTeachers = [...teacherList]
      .filter(t => t.terlambat > 0)
      .sort((a, b) => b.terlambat - a.terlambat)
      .slice(0, 5);

    const mostLockedTeachers = [...teacherList]
      .filter(t => t.dikunci > 0)
      .sort((a, b) => b.dikunci - a.dikunci)
      .slice(0, 5);

    const topLateClasses = Object.values(classMap)
      .filter(c => c.total > 0 && c.terlambat > 0)
      .map(c => ({
        ...c,
        percentage: Math.round((c.terlambat / c.total) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage || b.terlambat - a.terlambat)
      .slice(0, 5);

    const topDisciplinedSubjects = Object.values(subjectMap)
      .filter(s => s.total > 0)
      .map(s => ({
        ...s,
        percentage: Math.round((s.hadir / s.total) * 100)
      }))
      .sort((a, b) => b.percentage - a.percentage || b.hadir - a.hadir)
      .slice(0, 5);

    return {
      summary: {
        totalJP: records.length,
        jpHadir,
        jpBelumTerkonfirmasi,
        jpTerlambat,
        jpAlpa,
        jpDikunci
      },
      topUnconfirmedTeachers,
      mostDisciplinedTeachers,
      mostLateTeachers,
      mostLockedTeachers,
      topLateClasses,
      topDisciplinedSubjects
    };
  },

  // Alias for processQrCheckOut (calls processQrCheckIn which dynamically handles both check-in and check-out)
  async processQrCheckOut(params: {
    scannedContent: string;
    currentUser: { id?: string; uid?: string; userId?: string; name: string; teacherId?: string; role?: string };
    academicYearId?: string;
    semesterId?: string;
    customTimeStr?: string;
  }) {
    return this.processQrCheckIn(params);
  },

  // Audit function to identify premature / contaminated attendance records created by past bugs
  async auditContaminatedAttendances(dateStr?: string, isSimulation?: boolean): Promise<TeacherTeachingAttendance[]> {
    const targetColName = isSimulation ? "teacher_teaching_attendances_simulation" : COLLECTION_NAME;
    const colRef = collection(db, targetColName);

    let q;
    if (dateStr) {
      q = query(colRef, where("date", "==", dateStr));
    } else {
      q = query(colRef);
    }

    const snap = await getDocs(q);
    const contaminated: TeacherTeachingAttendance[] = [];

    snap.forEach(docSnap => {
      const data = docSnap.data() as TeacherTeachingAttendance;
      const docId = docSnap.id;

      // Contaminated pattern:
      // - no checkInTime AND no checkOutTime
      // - status is "Belum Terkonfirmasi"
      // - not manually validated
      if (!data.checkInTime && !data.checkOutTime && data.status === "Belum Terkonfirmasi" && !data.validatedByUserId) {
        contaminated.push({ ...data, id: docId });
      }
    });

    return contaminated;
  },

  // Cleanup function to remove specific contaminated record IDs safely
  async cleanupContaminatedAttendances(
    docIds: string[],
    resolvedUid: string,
    userName: string,
    isSimulation?: boolean
  ): Promise<{ deletedCount: number }> {
    if (!docIds || docIds.length === 0) return { deletedCount: 0 };

    const targetColName = isSimulation ? "teacher_teaching_attendances_simulation" : COLLECTION_NAME;

    let deletedCount = 0;
    for (let i = 0; i < docIds.length; i += 400) {
      const batchIds = docIds.slice(i, i + 400);
      const batch = writeBatch(db);

      batchIds.forEach(id => {
        const docRef = doc(db, targetColName, id);
        batch.delete(docRef);
      });

      await batch.commit();
      deletedCount += batchIds.length;
    }

    await logActivity(
      resolvedUid,
      userName,
      "Cleanup Contaminated Attendance Data",
      `Membersihkan ${deletedCount} record absensi mengajar prematur/terkontaminasi.`
    );

    return { deletedCount };
  },

  validateCheckInWindow,
  getLessonPeriodTimeRange,
  parseTimeToMinutes,
  calculateDurationInMinutes,
  formatMinutesToTime
};

export function evaluateAttendanceApprovalStatus(
  item: TeacherTeachingAttendance,
  schoolSettings?: SchoolSettings
) {
  return teacherTeachingAttendanceService.evaluateAttendanceApprovalStatus(item, schoolSettings);
}

