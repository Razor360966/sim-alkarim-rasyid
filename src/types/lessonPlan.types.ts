export interface LessonPlan {
  id: string; // Firestore document ID
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  title: string;
  link: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}
