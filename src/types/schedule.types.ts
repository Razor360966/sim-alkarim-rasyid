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
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isLocked: boolean;
}
