/**
 * halaqohRecap.service.ts
 *
 * Read-Only Service & Aggregator untuk Rekap Pertemuan & Absensi Guru Halaqoh
 * SIMAK SMP ALKARIM RASYID
 *
 * HALAQOH-RECAP-1:
 * Aturan Mutlak:
 * 1. 1 Pertemuan = 1 sesi Halaqoh yang terjadwal/tercatat sebagai session.
 * 2. Status: HADIR_LENGKAP, CHECK_IN_SAJA, TIDAK_HADIR, TIDAK_ADA_SESI.
 * 3. CHECK_IN_SAJA bukan HADIR_LENGKAP (tidak dihitung dalam persentase kehadiran lengkap).
 * 4. Periode: WEEKLY (Sabtu-Jumat), MONTHLY (1-akhir bulan), CUSTOM (inclusive).
 * 5. Timezone: Asia/Jakarta (anti-UTC date shift).
 * 6. Deduplikasi: multi scan / multi attendance dalam 1 sesi dihitung tepat 1 pertemuan.
 * 7. Historical Immutability: rekap historis berdasarkan record snapshot.
 * 8. Zero-Mutation: sama sekali tidak melakukan write/set/add/update/delete ke Firestore.
 * 9. Bebas N+1 query: semua data diambil dalam satu batch paralel Promise.all.
 */

import {
  HalaqohRecapPeriodMode,
  HalaqohAttendanceStatus,
  HalaqohRecapParams,
  HalaqohRecapPeriod,
  HalaqohRecapTeacherSummary,
  HalaqohRecapMeeting,
  HalaqohRecapOverallSummary,
  HalaqohRecapResult
} from "../types/halaqohRecap.types";
import {
  HalaqahSchedule,
  TeacherHalaqahAttendance
} from "../types/halaqahAttendance.types";
import { HalaqahGroup } from "../types";
import { halaqahGroupService } from "./halaqahGroupService";
import { teacherHalaqahAttendanceService } from "./teacherHalaqahAttendance.service";
import { userService } from "./user.service";
import { isGuruHalaqohOrMusrif } from "../utils/halaqahRoleHelper";

// ============================================================================
// DATE & TIME HELPERS (TIMEZONE-SAFE: ASIA/JAKARTA)
// ============================================================================

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Jakarta timezone.
 */
export function getTodayDateStr(): string {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Formats a Date object as YYYY-MM-DD string using UTC values to avoid local shift.
 */
function formatDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns Indonesian day name for a given YYYY-MM-DD string.
 * Uses Date.UTC to guarantee identical results regardless of execution timezone.
 */
export function getIndonesianDayName(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[date.getUTCDay()] || "Senin";
}

/**
 * Calculates start and end dates for a period according to boarding school rules:
 * - WEEKLY: Saturday (Sabtu) to Friday (Jumat). Jumat is the weekly holiday.
 * - MONTHLY: 1st of month to the last day of that month.
 * - CUSTOM: startDate to endDate inclusive.
 */
export function calculateHalaqohPeriod(params: {
  periodMode: HalaqohRecapPeriodMode;
  referenceDate?: string;
  startDate?: string;
  endDate?: string;
}): { startDate: string; endDate: string } {
  const ref = params.referenceDate || getTodayDateStr();

  if (params.periodMode === "WEEKLY") {
    const [y, m, d] = ref.split("-").map(Number);
    const refDate = new Date(Date.UTC(y, m - 1, d));
    const dayOfWeek = refDate.getUTCDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

    // Saturday is day 6.
    // Days since last Saturday:
    // Sat (6) -> 0
    // Sun (0) -> 1
    // Mon (1) -> 2
    // Tue (2) -> 3
    // Wed (3) -> 4
    // Thu (4) -> 5
    // Fri (5) -> 6
    const diffToSaturday = (dayOfWeek + 1) % 7;

    const start = new Date(refDate);
    start.setUTCDate(refDate.getUTCDate() - diffToSaturday);

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6); // Saturday + 6 days = Friday!

    return {
      startDate: formatDateToYmd(start),
      endDate: formatDateToYmd(end)
    };
  }

  if (params.periodMode === "MONTHLY") {
    const [y, m] = ref.split("-").map(Number);
    const startStr = `${y}-${String(m).padStart(2, "0")}-01`;

    // Last day of month
    const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const endStr = `${y}-${String(m).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

    return {
      startDate: startStr,
      endDate: endStr
    };
  }

  // CUSTOM mode
  const start = params.startDate || ref;
  const end = params.endDate || start;

  if (start > end) {
    return { startDate: end, endDate: start };
  }

  return {
    startDate: start,
    endDate: end
  };
}

/**
 * Generates an array of all dates from startDate to endDate inclusive (YYYY-MM-DD).
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = endDate.split("-").map(Number);

  const current = new Date(Date.UTC(y1, m1 - 1, d1));
  const last = new Date(Date.UTC(y2, m2 - 1, d2));

  while (current <= last) {
    dates.push(formatDateToYmd(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Checks whether an attendance record has a valid check-in.
 */
export function isValidCheckIn(record: TeacherHalaqahAttendance): boolean {
  if (!record.checkInTime || record.checkInTime === "-" || record.checkInTime.trim() === "") {
    return false;
  }
  if (record.status?.toLowerCase().includes("tidak hadir")) {
    return false;
  }
  return true;
}

/**
 * Checks whether an attendance record has a valid check-out.
 */
export function isValidCheckOut(record: TeacherHalaqahAttendance): boolean {
  if (!record.checkOutTime || record.checkOutTime === "-" || record.checkOutTime.trim() === "") {
    return false;
  }
  return true;
}

// ============================================================================
// PURE RECAP AGGREGATOR FUNCTION (ZERO FIRESTORE WRITES / IMMUTABLE)
// ============================================================================

export interface AggregateHalaqohRecapParams {
  period: HalaqohRecapPeriod;
  dates: string[];
  groups: HalaqahGroup[];
  activeDays: string[];
  attendanceRecords: TeacherHalaqahAttendance[];
  schedules?: HalaqahSchedule[];
  options?: {
    teacherId?: string;
    halaqohGroupId?: string;
  };
}

/**
 * Pure function that aggregates halaqoh meetings and attendance records
 * into teacher summaries and individual meeting details.
 */
export function aggregateHalaqohRecap(params: AggregateHalaqohRecapParams): HalaqohRecapResult {
  const { period, dates, groups, activeDays, attendanceRecords, schedules = [], options } = params;

  const targetGroupId = options?.halaqohGroupId?.trim();
  const targetTeacherId = options?.teacherId?.trim();

  // 1. Filter groups if group filter is specified
  const effectiveGroups = targetGroupId
    ? groups.filter((g) => g.id === targetGroupId)
    : groups;

  // 2. Index attendance records by `${date}_${groupId}`
  // Multiple records for the same session are grouped together for deduplication
  const attendanceMap = new Map<string, TeacherHalaqahAttendance[]>();
  for (const rec of attendanceRecords) {
    if (targetGroupId && rec.groupId !== targetGroupId) continue;

    const key = `${rec.date}_${rec.groupId}`;
    const list = attendanceMap.get(key) || [];
    list.push(rec);
    attendanceMap.set(key, list);
  }

  // 3. Index schedule overrides by `${groupId}_${day.toLowerCase()}`
  const scheduleMap = new Map<string, HalaqahSchedule>();
  for (const s of schedules) {
    if (targetGroupId && s.groupId !== targetGroupId) continue;
    const key = `${s.groupId}_${(s.day || "").toLowerCase()}`;
    scheduleMap.set(key, s);
  }

  const activeDaysLower = activeDays.map((d) => d.toLowerCase());
  const meetingsMap = new Map<string, HalaqohRecapMeeting>();

  // 4. Iterate dates and groups to discover all scheduled and recorded meetings
  for (const dateStr of dates) {
    const dayName = getIndonesianDayName(dateStr);
    const dayNameLower = dayName.toLowerCase();
    const isDefaultActiveDay = activeDaysLower.includes(dayNameLower);

    for (const group of effectiveGroups) {
      const meetingId = `${dateStr}_${group.id}`;
      const sched = scheduleMap.get(`${group.id}_${dayNameLower}`);
      const recordsForMeeting = attendanceMap.get(meetingId) || [];

      // Determine if a session was scheduled on this day:
      // A. If a schedule entry exists and isActive is explicitly false -> NOT scheduled
      // B. If a schedule entry exists and isActive is true -> scheduled
      // C. Otherwise -> follows activeDays (Sabtu s/d Kamis)
      // D. Exception: If an attendance record exists, that meeting took place regardless of active days!
      let isScheduled = false;
      if (sched) {
        isScheduled = sched.isActive !== false;
      } else {
        isScheduled = isDefaultActiveDay;
      }

      const meetingTookPlaceOrScheduled = isScheduled || recordsForMeeting.length > 0;

      // Rule 4: TIDAK_ADA_SESI must not be counted as absent or scheduled
      if (!meetingTookPlaceOrScheduled) {
        continue;
      }

      // Rule 10: Historical Immutability
      // If attendance record exists, teacher is strictly taken from the record's snapshot.
      let meetingTeacherId = "";
      let meetingTeacherName = "";

      if (recordsForMeeting.length > 0) {
        const primaryRec = recordsForMeeting[0];
        meetingTeacherId = primaryRec.teacherId || group.musrifId || "GURU_HALAQAH";
        meetingTeacherName = primaryRec.teacherName || group.musrifName || "Ustadz Pembimbing";
      } else {
        meetingTeacherId = sched?.teacherId || group.musrifId || "GURU_HALAQAH";
        meetingTeacherName = sched?.teacherName || group.musrifName || "Ustadz Pembimbing";
      }

      // If teacher filter is set, check whether this meeting matches the teacher
      if (targetTeacherId && meetingTeacherId !== targetTeacherId) {
        continue;
      }

      // Rule 4 & 9: Determine attendance status and deduplicate multiple scans
      let status: HalaqohAttendanceStatus = "TIDAK_HADIR";
      let checkInTime: string | null = null;
      let checkOutTime: string | null = null;
      let durationMinutes: number | null = null;

      if (recordsForMeeting.length > 0) {
        const hasCheckIn = recordsForMeeting.some((r) => isValidCheckIn(r));
        const hasCheckOut = recordsForMeeting.some((r) => isValidCheckOut(r));

        if (hasCheckIn && hasCheckOut) {
          status = "HADIR_LENGKAP";
        } else if (hasCheckIn && !hasCheckOut) {
          status = "CHECK_IN_SAJA";
        } else {
          status = "TIDAK_HADIR";
        }

        const validCheckInRec = recordsForMeeting.find((r) => isValidCheckIn(r));
        const validCheckOutRec = recordsForMeeting.find((r) => isValidCheckOut(r));

        checkInTime = validCheckInRec?.checkInTime || null;
        checkOutTime = validCheckOutRec?.checkOutTime || null;
        durationMinutes =
          validCheckOutRec?.duration ?? (validCheckInRec?.duration ?? null);
      } else {
        status = "TIDAK_HADIR";
      }

      const meeting: HalaqohRecapMeeting = {
        meetingId,
        date: dateStr,
        dayName,
        teacherId: meetingTeacherId,
        teacherName: meetingTeacherName,
        halaqohGroupId: group.id,
        halaqohGroupName: group.groupName || `Kelompok ${group.id}`,
        scheduledStartTime: sched?.startTime || recordsForMeeting[0]?.scheduledStartTime,
        scheduledEndTime: sched?.endTime || recordsForMeeting[0]?.scheduledEndTime,
        checkInTime,
        checkOutTime,
        durationMinutes,
        status
      };

      meetingsMap.set(meetingId, meeting);
    }
  }

  // 5. Handle any orphan attendance records within range that belong to unlisted groups
  for (const rec of attendanceRecords) {
    if (rec.date < period.startDate || rec.date > period.endDate) continue;
    if (targetGroupId && rec.groupId !== targetGroupId) continue;
    if (targetTeacherId && rec.teacherId !== targetTeacherId) continue;

    const meetingId = `${rec.date}_${rec.groupId}`;
    if (!meetingsMap.has(meetingId)) {
      const recordsForMeeting = attendanceMap.get(meetingId) || [rec];
      const hasCheckIn = recordsForMeeting.some((r) => isValidCheckIn(r));
      const hasCheckOut = recordsForMeeting.some((r) => isValidCheckOut(r));

      let status: HalaqohAttendanceStatus = "TIDAK_HADIR";
      if (hasCheckIn && hasCheckOut) {
        status = "HADIR_LENGKAP";
      } else if (hasCheckIn && !hasCheckOut) {
        status = "CHECK_IN_SAJA";
      }

      const validCheckInRec = recordsForMeeting.find((r) => isValidCheckIn(r));
      const validCheckOutRec = recordsForMeeting.find((r) => isValidCheckOut(r));

      meetingsMap.set(meetingId, {
        meetingId,
        date: rec.date,
        dayName: rec.dayName || getIndonesianDayName(rec.date),
        teacherId: rec.teacherId || "GURU_HALAQAH",
        teacherName: rec.teacherName || "Ustadz Pembimbing",
        halaqohGroupId: rec.groupId,
        halaqohGroupName: rec.groupName || `Kelompok ${rec.groupId}`,
        scheduledStartTime: rec.scheduledStartTime,
        scheduledEndTime: rec.scheduledEndTime,
        checkInTime: validCheckInRec?.checkInTime || null,
        checkOutTime: validCheckOutRec?.checkOutTime || null,
        durationMinutes: validCheckOutRec?.duration ?? (validCheckInRec?.duration ?? null),
        status
      });
    }
  }

  const allMeetings = Array.from(meetingsMap.values());

  // 6. Aggregate meetings per Teacher
  const teacherMap = new Map<
    string,
    {
      teacherId: string;
      teacherName: string;
      totalScheduledMeetings: number;
      totalPresentComplete: number;
      totalCheckInOnly: number;
      totalAbsent: number;
    }
  >();

  // Pre-seed teacher if specific teacher requested
  if (targetTeacherId) {
    const matchedGroup = groups.find((g) => g.musrifId === targetTeacherId);
    const fallbackName = matchedGroup?.musrifName || "Guru Halaqoh";
    teacherMap.set(targetTeacherId, {
      teacherId: targetTeacherId,
      teacherName: fallbackName,
      totalScheduledMeetings: 0,
      totalPresentComplete: 0,
      totalCheckInOnly: 0,
      totalAbsent: 0
    });
  } else {
    // Pre-seed all musrifs from active groups so teachers with zero meetings still appear
    for (const g of effectiveGroups) {
      if (g.musrifId) {
        if (!teacherMap.has(g.musrifId)) {
          teacherMap.set(g.musrifId, {
            teacherId: g.musrifId,
            teacherName: g.musrifName || "Ustadz Pembimbing",
            totalScheduledMeetings: 0,
            totalPresentComplete: 0,
            totalCheckInOnly: 0,
            totalAbsent: 0
          });
        }
      }
    }
  }

  for (const m of allMeetings) {
    let entry = teacherMap.get(m.teacherId);
    if (!entry) {
      entry = {
        teacherId: m.teacherId,
        teacherName: m.teacherName,
        totalScheduledMeetings: 0,
        totalPresentComplete: 0,
        totalCheckInOnly: 0,
        totalAbsent: 0
      };
      teacherMap.set(m.teacherId, entry);
    }

    entry.totalScheduledMeetings++;
    if (m.status === "HADIR_LENGKAP") {
      entry.totalPresentComplete++;
    } else if (m.status === "CHECK_IN_SAJA") {
      entry.totalCheckInOnly++;
    } else if (m.status === "TIDAK_HADIR") {
      entry.totalAbsent++;
    }
  }

  // 7. Calculate percentages (Rule 8: null if totalScheduledMeetings === 0)
  const teacherSummaries: HalaqohRecapTeacherSummary[] = Array.from(teacherMap.values()).map(
    (t) => {
      const percentage =
        t.totalScheduledMeetings > 0
          ? Number(((t.totalPresentComplete / t.totalScheduledMeetings) * 100).toFixed(2))
          : null;

      return {
        ...t,
        attendancePercentage: percentage
      };
    }
  );

  // 8. Overall Summary across all meetings
  let totalScheduled = 0;
  let totalComplete = 0;
  let totalCheckInOnly = 0;
  let totalAbsent = 0;

  for (const s of teacherSummaries) {
    totalScheduled += s.totalScheduledMeetings;
    totalComplete += s.totalPresentComplete;
    totalCheckInOnly += s.totalCheckInOnly;
    totalAbsent += s.totalAbsent;
  }

  const overallPercentage =
    totalScheduled > 0
      ? Number(((totalComplete / totalScheduled) * 100).toFixed(2))
      : null;

  const overallSummary: HalaqohRecapOverallSummary = {
    totalScheduledMeetings: totalScheduled,
    totalPresentComplete: totalComplete,
    totalCheckInOnly: totalCheckInOnly,
    totalAbsent: totalAbsent,
    attendancePercentage: overallPercentage
  };

  // Sort meetings: descending date, then groupName
  allMeetings.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    return a.halaqohGroupName.localeCompare(b.halaqohGroupName);
  });

  // Sort teacher summaries: alphabetical teacherName
  teacherSummaries.sort((a, b) => a.teacherName.localeCompare(b.teacherName));

  return {
    period,
    teacherSummaries,
    meetings: allMeetings,
    overallSummary
  };
}

// ============================================================================
// SERVICE OBJECT (READ-ONLY CONSUMER)
// ============================================================================

export const halaqohRecapService = {
  /**
   * Retrieves teacher halaqoh attendance & meetings recap for the specified period.
   * Fetches all required Firestore data in parallel without N+1 queries.
   * Completely read-only (zero mutation).
   */
  async getHalaqohRecap(params: HalaqohRecapParams): Promise<HalaqohRecapResult> {
    const { startDate, endDate } = calculateHalaqohPeriod({
      periodMode: params.periodMode,
      referenceDate: params.referenceDate,
      startDate: params.startDate,
      endDate: params.endDate
    });

    const period: HalaqohRecapPeriod = {
      mode: params.periodMode,
      startDate,
      endDate,
      referenceDate: params.referenceDate,
      academicYearId: params.academicYearId,
      semesterId: params.semesterId
    };

    const dates = generateDateRange(startDate, endDate);

    // Parallel batch fetch from SSOT Firestore collections (Zero N+1)
    const [groups, activeDays, attendanceRecords, schedules] = await Promise.all([
      halaqahGroupService.getGroups(params.teacherId),
      teacherHalaqahAttendanceService.getActiveSchoolDays(),
      teacherHalaqahAttendanceService.getAttendanceForDateRange(
        startDate,
        endDate,
        params.academicYearId,
        params.semesterId
      ),
      teacherHalaqahAttendanceService.getSchedules({
        academicYearId: params.academicYearId,
        semesterId: params.semesterId
      })
    ]);

    return aggregateHalaqohRecap({
      period,
      dates,
      groups,
      activeDays,
      attendanceRecords,
      schedules,
      options: {
        teacherId: params.teacherId,
        halaqohGroupId: params.halaqohGroupId
      }
    });
  },

  /**
   * Retrieves list of active halaqoh groups and authorized teachers for UI filter selectors.
   * Business Rules (HALAQOH-RECAP-2.2):
   * 1. Guru Halaqoh AKTIF harus memiliki minimal salah satu role: Musrif ATAU Guru Halaqoh.
   * 2. Akun yang role-nya dicabut atau hanya memiliki role lain (e.g. Guru umum) TIDAK muncul.
   * 3. Guru dengan multiple role (Musrif + Guru Halaqoh) dideduplikasi (muncul tepat 1 kali).
   * 4. Relasi canonical: teacherId || userId || id.
   */
  async getFilterOptions(): Promise<{
    teachers: { id: string; name: string }[];
    groups: { id: string; name: string }[];
  }> {
    const [groups, allUsers] = await Promise.all([
      halaqahGroupService.getGroups(),
      userService.getUsers().catch(() => [])
    ]);

    const teacherMap = new Map<string, string>();
    const groupsList: { id: string; name: string }[] = [];

    // Filter active accounts possessing canonical Musrif or Guru Halaqoh role
    const activeHalaqohUsers = allUsers.filter((u) => {
      if (u.isDeleted) return false;
      if (u.status && u.status !== "Aktif") return false;
      return isGuruHalaqohOrMusrif(u.role, u.roles);
    });

    for (const u of activeHalaqohUsers) {
      const canonicalId = u.teacherId || u.userId || u.id;
      const displayName = u.name || u.teacherName || "Guru Halaqoh";
      if (canonicalId && !teacherMap.has(canonicalId)) {
        teacherMap.set(canonicalId, displayName);
      }
    }

    // Fallback: If no users were returned (e.g. offline/mock environment),
    // extract assigned musrifs from active groups
    if (teacherMap.size === 0) {
      for (const g of groups) {
        if (g.musrifId && g.musrifName && !teacherMap.has(g.musrifId)) {
          teacherMap.set(g.musrifId, g.musrifName);
        }
      }
    }

    for (const g of groups) {
      if (g.id && g.groupName) {
        groupsList.push({ id: g.id, name: g.groupName });
      }
    }

    const teachers = Array.from(teacherMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    groupsList.sort((a, b) => a.name.localeCompare(b.name));

    return { teachers, groups: groupsList };
  }
};
