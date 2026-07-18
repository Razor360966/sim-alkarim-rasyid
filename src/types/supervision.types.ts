export type SupervisionStatus =
  | "Belum Dijadwalkan"
  | "Terjadwal"
  | "Sedang Berlangsung"
  | "Selesai"
  | "Ditunda";

export type SupervisionType = "Akademik" | "Manajerial";

export interface AcademicSupervision {
  id: string; // Firestore doc id
  teacherId: string; // SDM / Guru yang disupervisi
  teacherName: string; // Nama Guru
  supervisorId: string; // ID Supervisor
  supervisorName: string; // Nama Supervisor
  semesterId: string; // ID Semester
  semester: string; // e.g., "Ganjil" / "Genap"
  academicYearId: string; // ID Tahun Pelajaran
  academicYear: string; // e.g., "2025/2026"
  status: SupervisionStatus;
  date: string; // YYYY-MM-DD
  notes: string; // Catatan supervisi
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  createdBy: string; // Creator userId
  updatedBy: string; // Updator userId
  isDeleted?: boolean;
  score?: number; // Calculated score (cached)
  instrumentId?: string; // Evaluated with instrument
  instrumentName?: string;
  rtlText?: string;
  rtlStatus?: "Belum Dilaksanakan" | "Sedang Dilaksanakan" | "Sudah Dilaksanakan";
  rtlNotes?: string;
}

export interface ManagerialSupervision {
  id: string; // Firestore doc id
  teacherId: string; // SDM yang disupervisi
  teacherName: string; // Nama SDM
  staffId?: string; // Backward compatibility
  staffName?: string; // Backward compatibility
  staffType?: string; // e.g., "guru", "musrif", "tata usaha", "operator", "tendik"
  supervisorId: string; // ID Supervisor
  supervisorName: string; // Nama Supervisor
  semesterId: string; // ID Semester
  semester: string;
  academicYearId: string; // ID Tahun Pelajaran
  academicYear: string;
  status: SupervisionStatus;
  notes: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted?: boolean;
  score?: number; // Calculated score (cached)
  instrumentId?: string; // Evaluated with instrument
  instrumentName?: string;
  rtlText?: string;
  rtlStatus?: "Belum Dilaksanakan" | "Sedang Dilaksanakan" | "Sudah Dilaksanakan";
  rtlNotes?: string;
}

export interface SupervisionSchedule {
  id: string; // Firestore doc id
  date: string; // YYYY-MM-DD
  time?: string; // e.g., "08:00 - 09:30"
  supervisorId: string;
  supervisorName: string;
  teacherId: string; // Peserta (SDM/Guru)
  teacherName: string; // Nama Peserta
  participantId?: string; // Backward compatibility
  participantName?: string; // Backward compatibility
  academicYearId: string;
  academicYear: string;
  semesterId: string;
  semester: string;
  type: SupervisionType; // Jenis Supervisi: Akademik / Manajerial
  status: SupervisionStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted?: boolean;
}

export interface SupervisionIndicator {
  id: string;
  name: string;
  description: string;
  weight: number; // 0-100%
  scoringType: "1-4" | "1-5" | "percentage" | "yes-no";
  maxScore: number; // e.g. 4, 5, 100, 1
  isActive: boolean;
  focus?: string; // Fokus Penilaian
  order?: number; // Urutan
}

export interface SupervisionInstrument {
  id: string; // Firestore doc id
  code: string; // Kode instrumen (e.g. INST-001)
  name: string; // Nama Instrumen
  type: SupervisionType; // Jenis Supervisi: Akademik / Manajerial
  targetSdmType?: "Guru" | "Wakil Kepala Sekolah" | "Guru Halaqoh" | "Tenaga Kependidikan"; // Target group
  indicators: SupervisionIndicator[]; // Flexible indicators
  aspects: string[]; // Keep for backward compatibility/quick aspects representation
  description?: string; // Description/bobot/kriteria
  category?: string; // Optional category
  weight?: number; // Optional weight
  isActive?: boolean; // Optional active status
  academicYear?: string; // Tahun Berlaku
  version?: string; // Versi Template (e.g. "1.0")
  rubricType?: "1-4" | "1-5" | "percentage" | "yes-no" | "custom";
  rubricLevels?: { score: number; label: string; }[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted?: boolean;
}

export interface SupervisionResult {
  id: string; // Firestore doc id
  supervisionId: string; // Academic or Managerial supervision document ID
  supervisionType: SupervisionType;
  teacherId: string;
  teacherName: string;
  supervisorId: string;
  supervisorName: string;
  instrumentId: string;
  instrumentName: string;
  instrumentVersion?: string; // Track version used during evaluation
  academicYearId: string;
  academicYear: string;
  semesterId: string;
  semester: string;
  date: string;
  scores: {
    indicatorId: string;
    indicatorName: string;
    scoringType: "1-4" | "1-5" | "percentage" | "yes-no";
    weight: number;
    maxScore: number;
    score: number; // Given score
    weightedScore: number; // Calculated weighted score
    notes?: string;
  }[];
  totalScore: number; // Calculated total score 0-100
  notes?: string;
  rtlText?: string;
  rtlStatus?: "Belum Dilaksanakan" | "Sedang Dilaksanakan" | "Sudah Dilaksanakan";
  rtlNotes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isDeleted?: boolean;
}
