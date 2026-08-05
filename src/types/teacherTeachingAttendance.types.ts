export type AttendanceTeachingStatus =
  | "Hadir Mengajar"
  | "Terlambat"
  | "Belum Terkonfirmasi"
  | "Izin"
  | "Sakit"
  | "Tugas Dinas"
  | "Digantikan Guru Lain"
  | "Tukar Jadwal"
  | "Tidak Hadir"
  | "KBM Ditiadakan"
  | "Belum Diverifikasi";

export type AttendanceApprovalStatus = "Pending" | "Approved" | "Rejected";
export type AttendanceApprovalType = "Automatic" | "Manual";

export interface TeacherTeachingAttendance {
  id?: string; // Firestore Document ID (usually `${date}_${scheduleId}`)
  date: string; // YYYY-MM-DD
  day: string; // e.g. "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"
  academicYearId: string;
  semesterId: string;

  // Schedule information
  scheduleId: string;
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  gradeLevel?: "VII" | "VIII" | "IX" | string;
  lessonPeriodId: string;
  sequence: number;
  jp: string; // e.g. "JP 1", "JP 1–2"
  roomName?: string;
  timeSlot?: string; // e.g. "07:30 - 08:15"

  // Attendance status
  status: AttendanceTeachingStatus;
  substituteTeacherId?: string;
  substituteTeacherName?: string;
  exchangedWithTeacherId?: string;
  exchangedWithTeacherName?: string;
  exchangedScheduleId?: string;
  notes?: string;

  // Validation & Approval fields
  attendanceStatus?: AttendanceApprovalStatus; // "Pending" | "Approved" | "Rejected"
  pendingReason?: string;
  validatedBy?: string;
  validatedByUserId?: string;
  validatedAt?: string;
  validationNote?: string;
  approvalType?: AttendanceApprovalType; // "Automatic" | "Manual"

  // QR Teaching Check-in & Check-out Data
  checkInTime?: string; // e.g. "07:32:10"
  checkOutTime?: string; // e.g. "08:14:45"
  teachingDurationMinutes?: number;
  checkInType?: "Scan QR" | "Manual Wakakur" | "Manual Admin" | "Auto";
  checkInLogs?: { checkIn: string; checkOut?: string; durationMinutes?: number; note?: string }[];
  isManualCheckOut?: boolean;
  manualCheckOutByUserId?: string;
  manualCheckOutByUserName?: string;
  manualCheckOutTime?: string;
  manualCheckOutReason?: string;

  // Wakakur Late Unlock fields
  isLateUnlocked?: boolean;
  lateUnlockedByUserId?: string;
  lateUnlockedByUserName?: string;
  lateUnlockedAt?: string;
  lateUnlockReason?: string;

  recordedByUserId?: string;
  recordedByUserName?: string;
  isInputSusulan?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleExchangeRecord {
  id?: string;
  date: string; // Date A (YYYY-MM-DD)
  dateB?: string; // Date B (YYYY-MM-DD) for cross-date exchange
  teacherAId: string;
  teacherAName: string;
  scheduleAId: string;
  subjectAName: string;
  classAName: string;
  jpA: string;

  teacherBId: string;
  teacherBName: string;
  scheduleBId?: string;
  subjectBName?: string;
  classBName?: string;
  jpB?: string;

  reason: string;
  createdAt: string;
  createdByUserId: string;
  createdByUserName: string;
}

export interface TeacherAttendanceAuditLog {
  id?: string;
  attendanceDate: string; // YYYY-MM-DD
  inputTimestamp: string; // ISO string
  userId: string;
  userName: string;
  scheduleId: string;
  teacherName: string;
  className: string;
  subjectName: string;
  jp?: string;
  previousStatus: AttendanceTeachingStatus | string;
  newStatus: AttendanceTeachingStatus;
  reason?: string;
  isLateInput: boolean;
}

export interface AttendanceDailyStats {
  date: string;
  day: string;
  totalScheduledEncounters: number;
  totalUniqueTeachersScheduled: number;
  hadirCount: number;
  terlambatCount: number;
  izinCount: number;
  sakitCount: number;
  tugasCount: number;
  tidakHadirCount: number;
  digantiCount: number;
  tukarJadwalCount: number;
  kbmDitiadakanCount: number;
  belumDiverifikasiCount: number;
  attendancePercentage: number;
}

export interface TeacherAttendanceSummary {
  teacherId: string;
  teacherName: string;
  totalEncounters: number; // Scheduled Meetings
  totalJP: number; // Scheduled JP
  executedEncounters: number; // Taught / Executed Meetings (taking exchanges into account)
  executedJP: number; // Taught / Executed JP (taking exchanges into account)
  hadir: number;
  hadirJP: number;
  terlambat: number;
  terlambatJP: number;
  izin: number;
  izinJP: number;
  sakit: number;
  sakitJP: number;
  tugas: number;
  tugasJP: number;
  tidakHadir: number;
  tidakHadirJP: number;
  diganti: number;
  digantiJP: number;
  tukarJadwal: number;
  tukarJadwalJP: number;
  tukarJadwalMasuk: number;
  tukarJadwalMasukJP: number;
  kbmDitiadakan: number;
  kbmDitiadakanJP: number;
  percentage: number;
}

export interface LeadershipMonitoringStats {
  totalSubstitutionsSemester: number;
  totalExchangesSemester: number;
  kbmExecutionPercentage: number;
  topSubstituteTeachers: { teacherId: string; teacherName: string; count: number }[];
  topAbsentTeachers: { teacherId: string; teacherName: string; count: number }[];
}
