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
  | "Belum Diverifikasi"
  | "Belum Dimulai";

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

  // Replacement & Substitution Synchronization
  replacementId?: string; // Unique transaction identifier (e.g. REP-YYYYMMDD-XXXX)
  originalTeacherId?: string;
  originalTeacherName?: string;
  isSubstitution?: boolean; // true when this item represents a substitute teacher teaching
  isReplaced?: boolean; // true when original teacher was replaced
  replacementNote?: string;

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

  // Wakakur Late Unlock & >15 Min Validation fields
  isLateUnlocked?: boolean;
  lateUnlockedByUserId?: string;
  lateUnlockedByUserName?: string;
  lateUnlockedAt?: string;
  lateUnlockReason?: string;
  
  // Late > 15 minutes validation & per-JP locking fields
  lateMinutes?: number;
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  requiresLateValidation?: boolean;
  lateValidationStatus?: "PENDING" | "APPROVED" | "REJECTED";
  checkInLocked?: boolean;
  isLateLocked?: boolean;
  lockReason?: string;
  validatedByRole?: string;
  lateStatusLabel?: string;
  teacherNiy?: string;

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

  // --- DEFINITIVE JP METRICS (SESUAI ATURAN MUTLAK) ---
  jmlJp: number; // JML JP: Total JP dari JADWAL ASLI guru pada rentang tanggal yang dipilih
  hadirJP: number; // Kehadiran (JP): Jadwal asli guru yang benar-benar diajar sendiri (Hadir / Terlambat)
  menggantikanJP: number; // Menggantikan (JP): Mengajar jadwal guru lain sebagai pengganti resmi
  digantikanJP: number; // Digantikan (JP): Jadwal asli guru yang diajar guru pengganti resmi
  tidakHadirJP: number; // Tidak Hadir (JP): Jadwal asli guru yang tidak hadir & tanpa pengganti
  terlambatJP: number; // Terlambat (JP): Metrik informasi murni (tidak mengubah Kehadiran/Total JP)
  totalJP: number; // Total JP: Kehadiran (JP) + Menggantikan (JP)
  kehadiranPercentage: number; // Persentase Kehadiran: (hadirJP / jmlJp) * 100

  // --- VALIDASI NERACA & INTEGRITAS MATEMATIS ---
  isBalanced: boolean; // CHECK A: jmlJp === hadirJP + digantikanJP + tidakHadirJP
  isTotalConsistent: boolean; // CHECK B: totalJP === hadirJP + menggantikanJP
  isLateValid: boolean; // CHECK C: terlambatJP <= hadirJP

  // Compatibility fields for existing SIMAK modules (RTH, Dashboard, Rekap JP, etc.)
  totalEncounters: number; // Scheduled Meetings
  executedEncounters: number; // Taught / Executed Meetings (taking exchanges into account)
  executedJP: number; // Taught / Executed JP (taking exchanges into account)
  hadir: number;
  terlambat: number;
  izin: number;
  izinJP: number;
  sakit: number;
  sakitJP: number;
  tugas: number;
  tugasJP: number;
  tidakHadir: number;
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
