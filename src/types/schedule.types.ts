export interface TeacherAssignment {
  id?: string;
  academicYearId?: string;
  semesterId?: string;
  subjectId?: string;
  subjectName?: string;
  classId?: string;
  className?: string;
  gradeLevel?: "VII" | "VIII" | "IX";
  teacherId: string;
  teacherName: string;
  effectiveFrom?: string | null; // YYYY-MM-DD
  effectiveUntil?: string | null; // YYYY-MM-DD or null/undefined (active indefinitely)
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdByName?: string;
  notes?: string;
  isActive?: boolean;
}

export interface Schedule {
  id?: string; // Firestore Document ID
  academicYearId: string;
  semesterId: string;
  classId: string;
  className: string;
  day: string;
  lessonPeriodId: string;
  sequence: number;
  jp: string; // e.g. "JP 1", "JP 2" (retrieved from LessonPeriod.title)
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  teacherAssignments?: TeacherAssignment[]; // Effective-dated teacher assignments
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isLocked: boolean;
}
