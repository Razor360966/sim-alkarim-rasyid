export type StudentAttendanceStatus = "Hadir" | "Sakit" | "Izin" | "Alpha";

export interface StudentAttendanceItem {
  studentId: string;
  studentName: string;
  nis?: string;
  gender?: string;
  status: StudentAttendanceStatus;
  note?: string;
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
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
