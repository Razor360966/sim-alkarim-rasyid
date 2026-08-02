export type StudentAttendanceStatus = "Hadir" | "Sakit" | "Izin" | "Alpha";

export interface StudentAttendanceItem {
  studentId: string;
  studentName: string;
  nis?: string;
  gender?: string;
  status: StudentAttendanceStatus;
  note?: string;
  teacherId?: string;
  subjectId?: string;
  classId?: string;
  scheduleId?: string;
  lessonPeriod?: number;
  date?: string;
  teachingAttendanceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClassStudentAttendanceRecord {
  id?: string;
  date: string; // YYYY-MM-DD
  classId: string;
  className: string;
  subjectId?: string;
  subjectName?: string;
  scheduleId?: string;
  journalId?: string;
  lessonPeriod?: number;
  teachingAttendanceId?: string;
  teacherId: string;
  teacherName: string;
  academicYearId?: string;
  semesterId?: string;
  students: StudentAttendanceItem[];
  summary: {
    hadir: number;
    sakit: number;
    izin: number;
    alpha: number;
    total: number;
  };
  isLocked?: boolean;
  lockedReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface SessionLockStatus {
  canInput: boolean;
  isLocked: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  teachingAttendanceId?: string;
  reason: string;
}

export interface StudentAttendanceAuditLog {
  id?: string;
  recordId: string;
  date: string;
  className: string;
  subjectName?: string;
  teacherName: string;
  userId: string;
  userName: string;
  userRole?: string;
  timestamp: string;
  reason: string;
  oldSummary?: { hadir: number; sakit: number; izin: number; alpha: number; total: number };
  newSummary: { hadir: number; sakit: number; izin: number; alpha: number; total: number };
}

export interface StudentSubjectRecapItem {
  subjectId: string;
  subjectName: string;
  teacherName: string;
  totalSessions: number;
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  percentage: number;
}

export interface StudentOverallRecap {
  studentId: string;
  studentName: string;
  nis?: string;
  className: string;
  subjects: StudentSubjectRecapItem[];
  overallPercentage: number;
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
}

export interface HomeroomClassDetailRecap {
  studentId: string;
  studentName: string;
  nis?: string;
  bySubject: {
    [subjectName: string]: {
      hadir: number;
      sakit: number;
      izin: number;
      alpha: number;
      total: number;
      percentage: number;
    };
  };
  totalHadir: number;
  totalSakit: number;
  totalIzin: number;
  totalAlpha: number;
  totalSessions: number;
  overallPercentage: number;
}

export interface HeadmasterOverviewStats {
  bySubject: { subjectName: string; totalSessions: number; attendancePct: number; hadir: number; sakit: number; izin: number; alpha: number }[];
  byTeacher: { teacherName: string; totalSessions: number; attendancePct: number; hadir: number; sakit: number; izin: number; alpha: number }[];
  byClass: { className: string; totalSessions: number; attendancePct: number; hadir: number; sakit: number; izin: number; alpha: number }[];
  overallPercentage: number;
  totalSessions: number;
}

