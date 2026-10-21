/**
 * midtermReport.types.ts
 * 
 * Type definitions for Rapor Bayangan / Rapor Tengah Semester
 * SIMAK SMP ALKARIM RASYID
 * 
 * RAPOR-1: Read-Only Adapter untuk Nilai UTS (Tanpa Rekalkulasi)
 */

export type MidtermReportType = "UMUM" | "PONDOK" | "TERPADU";

export type MidtermScoreStatus =
  | "TERISI"
  | "BELUM_DIISI"
  | "TIDAK_ADA_UTS";

export interface MidtermReportScore {
  studentId: string;
  subjectId: string;
  subjectName: string;
  subjectType: "UMUM" | "PONDOK";
  score: number | null;
  status: MidtermScoreStatus;
}

export interface MidtermReportSubject {
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  subjectType: "UMUM" | "PONDOK";
  group?: string;
  kkm?: number;
  hasUts?: boolean;
}

export interface MidtermReportStudent {
  studentId: string;
  studentName: string;
  nis?: string;
  nisn?: string;
  scores: MidtermReportScore[];
}

export interface MidtermReportContext {
  academicYearId: string;
  semesterId: string;
  classId: string;
  className: string;
  gradeLevel?: string;
  reportType: MidtermReportType;

  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  homeroomTeacherNiy?: string;

  subjects: MidtermReportSubject[];
  umumSubjects?: MidtermReportSubject[];
  pondokSubjects?: MidtermReportSubject[];
  students: MidtermReportStudent[];

  generatedAt: string;
}

export interface GetMidtermReportParams {
  academicYearId: string;
  semesterId: string;
  classId: string;
  reportType: MidtermReportType;
  excludedSubjectIds?: string[];
}

export interface MidtermReportHeaderConfig {
  institutionName?: string;
  subTitle?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  accreditationText?: string;
  schoolLogoUrl?: string;
  pesantrenLogoUrl?: string;
}

export interface MidtermHomeroomTeacherIdentity {
  name?: string; // Nama lengkap beserta gelar
  niy?: string;  // NIY wali kelas (string, preserving leading zeros)
  signatureUrl?: string; // Tanda tangan wali kelas per rombel (Base64 DataURL)
}

export interface MidtermPrintSettings {
  customHeader?: MidtermReportHeaderConfig;
  reportCity?: string; // e.g. "Solok"
  reportDate?: string; // e.g. "18 Oktober 2026"
  schoolLogoUrl?: string; // Base64 dataUrl or image URL
  pesantrenLogoUrl?: string; // Base64 dataUrl or image URL
  accreditationText?: string; // e.g. "Terakreditasi A"
  headmasterName?: string;
  headmasterTitle?: string; // e.g. "Kepala Sekolah / Kepala Madrasah"
  headmasterNipNiy?: string;
  headmasterSignatureUrl?: string; // Base64 dataUrl or image URL
  schoolStampUrl?: string; // Base64 dataUrl or image URL
  // Pengaturan identitas & tanda tangan wali kelas per rombel (dikelola berdasarkan ID rombel kanonis)
  homeroomTeachers?: Record<string, MidtermHomeroomTeacherIdentity>;
  // Backward compatibility for previously saved data
  homeroomSignatures?: Record<string, string>;
  // Daftar ID mapel yang dinonaktifkan khusus dari lingkup Rapor Tengah Semester (RTS)
  excludedSubjectIds?: string[];
  updatedAt?: string;
  updatedBy?: string;
}


