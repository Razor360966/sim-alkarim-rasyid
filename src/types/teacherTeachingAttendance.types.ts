export type AttendanceTeachingStatus =
  | "Hadir Mengajar"
  | "Izin"
  | "Sakit"
  | "Tugas Dinas"
  | "Tidak Hadir"
  | "Diganti Guru Lain"
  | "KBM Ditiadakan";

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
  notes?: string;

  recordedByUserId?: string;
  recordedByUserName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceDailyStats {
  date: string;
  day: string;
  totalScheduledEncounters: number;
  totalUniqueTeachersScheduled: number;
  hadirCount: number;
  izinCount: number;
  sakitCount: number;
  tugasCount: number;
  tidakHadirCount: number;
  digantiCount: number;
  kbmDitiadakanCount: number;
  pendingCount: number; // Slots not yet submitted
  attendancePercentage: number; // (hadir + diganti) / (total - kbmDitiadakan) * 100
}

export interface TeacherAttendanceSummary {
  teacherId: string;
  teacherName: string;
  totalEncounters: number;
  hadir: number;
  izin: number;
  sakit: number;
  tugas: number;
  tidakHadir: number;
  diganti: number;
  kbmDitiadakan: number;
  percentage: number;
}
