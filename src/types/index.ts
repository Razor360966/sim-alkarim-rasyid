import { Gender } from "./teacher";
export * from "./teacher";
export * from "./academicYear.types";
export * from "./semester.types";
export * from "./user.types";
export * from "./mutabaah.types";
export * from "./schoolSettings.types";
export * from "./lessonPeriod.types";
export * from "./schedule.types";


export interface Class {
  id: string; // maps to Firestore Document ID
  classId: string; // maps to Firestore Document ID
  code: string; // Unique, e.g. "7A", "8B"
  name: string; // e.g. "Kelas 7A", "Kelas 8B"
  grades?: ("7" | "8" | "9")[]; // Legacy field (kept for backwards compatibility)
  grade?: "7" | "8" | "9"; // Legacy field used by older dashboards/services
  gradeLevel: "VII" | "VIII" | "IX"; // VII / VIII / IX
  roomCode?: string; // optional
  capacity: number;
  waliKelasId: string; // references Teacher.id (Legacy field)
  waliKelasName?: string; // cached (Legacy field)
  homeroomTeacherId: string; // teacherId dari collection teachers
  homeroomTeacherName: string; // nama guru wali kelas
  academicYearId: string; // references AcademicYear.id (Legacy field)
  academicYear: string; // contoh: 2025/2026
  status: "Aktif" | "Nonaktif";
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  name: string;
  gender: Gender;
  birthPlace: string;
  birthDate: string; // YYYY-MM-DD
  address: string;
  status: "Aktif" | "Lulus" | "Pindah" | "Keluar";
  classId?: string; // References Class.id
  className?: string; // cached
  academicYearId: string; // References AcademicYear.id
  createdAt: string;
}

export interface Subject {
  id: string;
  code: string; // Unique code, e.g., "MAPEL01"
  name: string; // e.g. "Matematika", "Bahasa Indonesia"
  group: "A" | "B" | "C"; // Group A (Wajib), Group B (Pilihan), Group C (Muatan Lokal)
  kkm: number; // Kriteria Ketuntasan Minimal, e.g., 75
  grades: ("7" | "8" | "9")[];
  grade?: "7" | "8" | "9" | "Semua"; // Legacy field for existing Firestore documents
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  userId?: string;
  email: string;
  username?: string;
  phoneNumber?: string;
  displayName: string;
  name?: string;
  role: string; // admin, guru, pimpinan, kepala sekolah, wakil kepala sekolah, musrif, tata usaha, operator, ketua yayasan
  roles?: string[]; // Multiple roles support
  status?: "Aktif" | "Nonaktif" | "Menunggu Aktivasi" | "Ditangguhkan";
  teacherId?: string | null;
  teacherName?: string | null;
  permissions?: string[];
  lastLogin?: string | null;
  requirePasswordChange?: boolean;
  createdAt: string;

  // Mandatory Profile Fields for Teachers / Musrifs
  nuptk?: string;
  niy?: string;
  tempatLahir?: string;
  tanggalLahir?: string;
  sertifikasi?: "Sudah" | "Belum" | "";
  gender?: Gender;
  haidStatus?: "Normal" | "Haid";
}

export interface CurriculumMatrix {
  id: string; // references Firestore doc id
  curriculumId: string; // same as id
  subjectId: string;
  subjectName: string;
  jp_vii: number;
  jp_viii: number;
  jp_ix: number;
  teacherId: string;
  teacherName: string;
  teacherId_vii?: string;
  teacherName_vii?: string;
  teacherId_viii?: string;
  teacherName_viii?: string;
  teacherId_ix?: string;
  teacherName_ix?: string;
  useDifferentTeachers?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  order?: number;
}

export * from "./academicPlanning.types";
export * from "./curriculumPlanning.types";
export * from "./teachingJournal.types";
export * from "./musrifJournal.types";
export * from "./gtkDevelopment.types";
export * from "./supervision.types";
export * from "./lessonPlan.types";
