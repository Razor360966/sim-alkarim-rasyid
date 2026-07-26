export interface ProtaSubTopic {
  id: string;
  title: string;
  jp: number;
  description: string;
}

export interface ProtaTopic {
  id: string;
  title: string;
  jp: number;
  semester: "Ganjil" | "Genap" | "Ganjil & Genap";
  description: string;
  order: number;
  subtopics?: ProtaSubTopic[];
}

export interface AnnualProgram {
  id: string; // Document ID: academicYearId_classId_subjectId
  academicYearId: string;
  academicYearName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  effectiveJpYear: number;
  topics: ProtaTopic[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface PromesAllocation {
  id: string; // unique combination of topicId_weekKey or subtopicId_weekKey
  topicId: string;
  subtopicId?: string; // empty if allocated to main topic
  weekKey: string; // e.g., "Juli 2025_w0"
  jp: number;
}

export interface PromesMeetingEntry {
  id: string; // e.g., "meeting_2026-07-25" or doc key
  meetingNo: number; // 1, 2, 3...
  date: string; // YYYY-MM-DD
  dayName: string; // "Sabtu", "Senin", etc.
  jpSlot?: string; // e.g. "JP 1-2"
  jpCount: number; // e.g. 2
  status: "KBM" | "HOLIDAY" | "AGENDA_CANCEL" | "INEFFECTIVE_WEEK" | "CUSTOM";
  statusLabel?: string; // e.g. "Hari Pembelajaran Normal (KBM)", "Libur Nasional", "MPLS", etc.
  topicId?: string;
  topicTitle?: string;
  subtopicId?: string;
  subtopicTitle?: string;
  tp?: string; // Tujuan Pembelajaran
  modulAjarId?: string;
  modulAjarStatus?: "TERSEDIA" | "BELUM_DIBUAT";
  journalStatus?: "BELUM_MENGAJAR" | "SUDAH_MENGAJAR" | "TERVERIFIKASI";
  notes?: string;

  // Schedule Adjustment fields
  isAdjusted?: boolean;
  originalDate?: string;
  adjustmentReason?: string;
  adjustedByUserName?: string;
  adjustedAt?: string;
}

export interface SemesterProgram {
  id: string; // Document ID: academicYearId_semesterId_classId_subjectId
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string; // e.g. "Ganjil" or "Genap"
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  effectiveJpSemester: number;
  effectiveWeeksCount: number;
  allocations?: PromesAllocation[]; // legacy week-based allocations
  meetings?: PromesMeetingEntry[]; // real teaching schedule meeting allocations
  isManualWeeks?: boolean;
  customWeeksConfig?: {
    month: string;
    totalWeeks: number;
    effectiveWeeks: number;
    notes?: string;
  }[];
  protaLastSyncedAt?: string; // used to check if sync is needed
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CurriculumActivityLog {
  id?: string;
  userId: string;
  userName: string;
  action: string; // e.g., "ADD_PROTA", "UPDATE_PROTA", "DELETE_PROTA", "SYNC_PROMES", etc.
  collection: string; // e.g., "annual_programs", "semester_programs"
  description: string;
  createdAt: any;
}
