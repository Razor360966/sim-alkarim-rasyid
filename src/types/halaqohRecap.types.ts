/**
 * halaqohRecap.types.ts
 *
 * Types for Rekap Pertemuan & Absensi Guru Halaqoh
 * SIMAK SMP ALKARIM RASYID
 *
 * HALAQOH-RECAP-1: Service Read-Only Rekap Kehadiran Guru Halaqoh
 */

export type HalaqohRecapPeriodMode = "WEEKLY" | "MONTHLY" | "CUSTOM";

export type HalaqohAttendanceStatus =
  | "HADIR_LENGKAP"
  | "CHECK_IN_SAJA"
  | "TIDAK_HADIR"
  | "TIDAK_ADA_SESI";

export interface HalaqohRecapTeacherSummary {
  teacherId: string;
  teacherName: string;
  totalScheduledMeetings: number;
  totalPresentComplete: number; // HADIR_LENGKAP
  totalCheckInOnly: number; // CHECK_IN_SAJA
  totalAbsent: number; // TIDAK_HADIR
  attendancePercentage: number | null; // null if totalScheduledMeetings === 0
}

export interface HalaqohRecapMeeting {
  meetingId: string; // canonical unique session ID, e.g. `${date}_${groupId}`
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Sabtu", "Senin"
  teacherId: string;
  teacherName: string;
  halaqohGroupId: string;
  halaqohGroupName: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  durationMinutes: number | null;
  status: HalaqohAttendanceStatus;
}

export interface HalaqohRecapPeriod {
  mode: HalaqohRecapPeriodMode;
  startDate: string; // YYYY-MM-DD (inclusive)
  endDate: string; // YYYY-MM-DD (inclusive)
  referenceDate?: string;
  academicYearId?: string;
  semesterId?: string;
}

export interface HalaqohRecapOverallSummary {
  totalScheduledMeetings: number;
  totalPresentComplete: number;
  totalCheckInOnly: number;
  totalAbsent: number;
  attendancePercentage: number | null;
}

export interface HalaqohRecapResult {
  period: HalaqohRecapPeriod;
  teacherSummaries: HalaqohRecapTeacherSummary[];
  meetings: HalaqohRecapMeeting[];
  overallSummary: HalaqohRecapOverallSummary;
}

export interface HalaqohRecapParams {
  academicYearId?: string;
  semesterId?: string;
  periodMode: HalaqohRecapPeriodMode;
  referenceDate?: string; // Used for WEEKLY and MONTHLY (defaults to today if empty)
  startDate?: string; // Used for CUSTOM
  endDate?: string; // Used for CUSTOM
  teacherId?: string; // Optional: filter for a specific teacher
  halaqohGroupId?: string; // Optional: filter for a specific group
}
