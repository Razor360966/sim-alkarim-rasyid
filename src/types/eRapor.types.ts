export type ERaporAssessmentStatus = "BELUM_LENGKAP" | "LENGKAP";
export type ERaporClassVerificationStatus = "DRAFT" | "TERVERIFIKASI" | "LOCKED";
export type ERaporGradeChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ERaporTp {
  id?: string;
  academicYearId: string;
  semesterId: string;
  gradeLevel: string; // e.g. "VII", "VIII", "IX"
  subjectId: string;
  subjectName?: string;
  code: string; // e.g. "TP 1", "TP 2"
  title: string; // Description or objective text
  order: number;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface ERaporAssessmentTpItem {
  tpId: string;
  tpCode: string;
  tpTitle?: string;
  score: number | null;
}

export interface ERaporAssessment {
  id?: string; // `${academicYearId}_${semesterId}_${classId}_${subjectId}_${studentId}`
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  studentName: string;
  studentNis?: string;
  studentNisn?: string;
  teacherId: string;
  tpScores: ERaporAssessmentTpItem[];
  utsScore: number | null;
  sasScore: number | null;
  tpAverage: number | null;
  finalScore: number | null;
  status: ERaporAssessmentStatus;
  description?: string; // Capaian kompetensi (auto or manual edit)
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ERaporPondokAssessment {
  id?: string; // `${academicYearId}_${semesterId}_${classId}_${subjectId}_${studentId}`
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  studentId: string;
  studentName: string;
  studentNis?: string;
  teacherId: string;
  score: number | null; // 0 - 100
  finalScore?: number | null; // Alias for score compatibility
  ketercapaian: string; // Deskripsi ketercapaian santri
  notes?: string;
  status: ERaporAssessmentStatus;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ERaporExtracurricular {
  id?: string;
  name: string; // e.g. "Pramuka", "Tahfidz", "Panahan", "Paskibra"
  pembinaId: string;
  pembinaName: string;
  category?: string;
  active: boolean;
  createdAt?: string;
  createdBy?: string;
}

export interface ERaporExtracurricularAssessment {
  id?: string; // `${academicYearId}_${semesterId}_${extracurricularId}_${studentId}`
  academicYearId: string;
  semesterId: string;
  classId: string;
  className?: string;
  extracurricularId: string;
  extracurricularName: string;
  pembinaId: string;
  pembinaName: string;
  studentId: string;
  studentName: string;
  studentNis?: string;
  participationStatus: "Aktif" | "Cukup Aktif" | "Kurang Aktif";
  progress: string; // Kemajuan siswa (mandatory)
  notes?: string; // Catatan pembina
  grade?: string; // e.g. "A / Sangat Baik", "B / Baik"
  status: ERaporAssessmentStatus;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ERaporClassVerification {
  id?: string; // `${academicYearId}_${semesterId}_${classId}`
  academicYearId: string;
  semesterId: string;
  classId: string;
  className: string;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  status: ERaporClassVerificationStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ERaporGradeChangeRequest {
  id?: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  studentId: string;
  studentName?: string;
  teacherId: string;
  teacherName: string;
  reason: string;
  requestedAt: string;
  status: ERaporGradeChangeStatus;
  processedBy?: string;
  processedAt?: string;
  notes?: string;
}

export interface ERaporAuditLog {
  id?: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  studentName?: string;
  teacherId: string;
  teacherName: string;
  field: string;
  oldValue: any;
  newValue: any;
  reason?: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
}

export interface ERaporPaperConfig {
  paperSize: "A4" | "F4";
  orientation: "portrait" | "landscape";
}

export interface ERaporLegerConfig {
  maxSemesters: number; // e.g. 5, 6 or custom
  presetType: "5" | "6" | "CUSTOM";
  customSemesterCount?: number;
}

export interface ERaporReportHeaderConfig {
  logoUrl?: string;
  institutionName?: string;
  subTitle?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface ERaporSettingsConfig {
  tpWeight: number; // default 60
  utsWeight: number; // default 20
  sasWeight: number; // default 20
  isOpen: boolean; // true = grading period active
  startDate?: string;
  endDate?: string;
  notes?: string;

  // Leger Settings
  legerConfig?: ERaporLegerConfig;

  // Print settings
  generalReport?: ERaporPaperConfig;
  pesantrenReport?: ERaporPaperConfig;
  headmasterName?: string;
  headmasterSignatureUrl?: string;
  generalReportHeader?: ERaporReportHeaderConfig;
  pesantrenReportHeader?: ERaporReportHeaderConfig;

  updatedAt?: string;
  updatedBy?: string;
}

export interface ERaporHistoricalAssessment {
  id?: string; // `${academicYearId}_${semesterId}_${classId}_${subjectId}_${studentId}`
  academicYearId: string;
  semesterId: string;
  semesterSequence: number; // 1, 2, 3...
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  studentId: string;
  studentName?: string;
  score: number;
  source: "HISTORICAL";
  enteredBy: string;
  enteredByName: string;
  enteredAt: string;
  updatedAt?: string;
  updatedBy?: string;
  reason?: string;
}

export interface ERaporHistoricalAuditLog {
  id?: string;
  studentId: string;
  studentName?: string;
  subjectId: string;
  subjectName?: string;
  semesterId: string;
  semesterSequence: number;
  oldScore: number | null;
  newScore: number;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  reason?: string;
}

export interface ERaporLegerSemesterScore {
  score: number | null;
  source: "ERAPOR" | "HISTORICAL" | "NONE";
  academicYearId?: string;
  semesterId?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ERaporLegerEntry {
  studentId: string;
  studentName: string;
  studentNis?: string;
  studentNisn?: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName: string;
  subjectGroup?: string;
  subjectType?: "UMUM" | "PONDOK" | "KEPESANTRENAN";
  semesterScores: {
    [sequence: number]: ERaporLegerSemesterScore;
  };
}

export interface ERaporLegerSemesterColumn {
  sequence: number; // 1, 2, 3, 4, 5, 6
  label: string; // "Sem 1", "Sem 2"...
  subLabel?: string; // e.g. "Kelas VII Ganjil"
  academicYearId?: string;
  semesterId?: string;
  academicYearName?: string;
  semesterName?: string;
}

export interface ERaporSubjectCompleteness {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  totalStudents: number;
  completedStudents: number;
  tpFilledCount: number;
  tpTotalCount: number;
  utsFilledCount: number;
  sasFilledCount: number;
  isComplete: boolean;
  statusText: "LENGKAP" | "BELUM_LENGKAP";
}

export interface ERaporStudentCompleteness {
  studentId: string;
  studentName: string;
  studentNis?: string;
  tpScores: { code: string; isFilled: boolean; score: number | null }[];
  utsFilled: boolean;
  utsScore: number | null;
  sasFilled: boolean;
  sasScore: number | null;
  tpAverage: number | null;
  finalScore: number | null;
  isComplete: boolean;
}

export interface ERaporExecutiveDrilldownItem {
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  studentId?: string;
  studentName?: string;
  missingParts: string[]; // e.g. ["TP 3", "SAS"]
}
