export interface Semester {
  id: string; // Document ID (for React / compatibility)
  semesterId: string; // Firestore Document ID
  academicYearId: string; // Relasi ke academic_years
  academicYearName: string; // Nama / tahun ajaran dari academic_years

  name: string; // e.g. "Semester 1" atau "Semester 2"
  code: string; // e.g. "S1" atau "S2"

  startDate: string; // YYYY-MM-DD string format
  endDate: string; // YYYY-MM-DD string format

  isActive: boolean;

  createdAt: string; // timestamp string format
  updatedAt: string; // timestamp string format
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;

  // Weeks Configuration fields
  manualWeeksConfigured?: boolean;
  totalWeeks?: number;
  effectiveWeeks?: number;
  ineffectiveWeeks?: number;
  assessmentWeeks?: number;
  pasPatWeeks?: number;
  projectWeeks?: number;
  otherWeeks?: number;
  details?: {
    month: string;
    totalWeeks: number;
    effectiveWeeks: number;
    effectiveWeeksByGrade?: Record<string, number>;
    notes?: string;
  }[];
}
