export interface StudentAttendance {
  hadir: number;
  sakit: number;
  izin: number;
  alpha: number;
  total: number;
}

export interface TeachingJournal {
  id: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  date: string; // YYYY-MM-DD
  dayName: string; // e.g. "Senin"
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  lessonPeriodIds: string[];
  lessonPeriods: string; // formatted string of periods, e.g., "JP 1, JP 2"
  startTime: string;
  endTime: string;
  totalJP: number;
  material: string;
  learningObjectives: string;
  learningActivities: string;
  learningMethod: string;
  learningMedia: string;
  assessment: string;
  reflection: string;
  followUp: string;
  studentAttendance: StudentAttendance;
  supportingLink: string;
  status: "Draft" | "Diajukan" | "Disetujui" | "Ditolak";
  verificationComment?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
