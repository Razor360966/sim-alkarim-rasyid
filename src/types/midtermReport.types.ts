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
}

export interface MidtermReportHeaderConfig {
  institutionName?: string;
  subTitle?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface MidtermPrintSettings {
  customHeader?: MidtermReportHeaderConfig;
  headmasterName?: string;
  headmasterTitle?: string; // e.g. "Kepala Sekolah / Kepala Madrasah"
  headmasterNipNiy?: string;
  headmasterSignatureUrl?: string; // Base64 dataUrl or image URL
  schoolStampUrl?: string; // Base64 dataUrl or image URL
  // Mapping tanda tangan wali kelas per kelas (key: classId atau homeroomTeacherId)
  homeroomSignatures?: Record<string, string>;
  updatedAt?: string;
  updatedBy?: string;
}

