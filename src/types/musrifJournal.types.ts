export interface HalaqahGroup {
  id: string;
  musrifId: string;
  musrifName: string;
  groupName: string;
  location: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isLocked?: boolean;
}

export interface HalaqahGroupMember {
  id: string;
  groupId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  createdAt: string;
  updatedAt: string;
}

export interface AsramaGroup {
  id: string;
  musrifId: string;
  musrifName: string;
  groupName: string;
  location: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  isLocked?: boolean;
}

export interface AsramaGroupMember {
  id: string;
  groupId: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  createdAt: string;
  updatedAt: string;
}

export interface MusrifJournal {
  id: string;
  musrifId: string;
  musrifName: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  groupId: string;
  groupName: string;
  date: string; // YYYY-MM-DD
  dayName: string; // e.g., "Senin"
  startTime: string;
  endTime: string;
  activityType: "Tahsin" | "Tahfidz" | "Muraja'ah" | "Setoran Hafalan" | "Tasmi" | "Pembinaan Akhlak" | "Pendampingan" | "Lainnya";
  entryType?: "Harian" | "Mingguan";
  generalNotes: string;
  supportingLink: string;
  status: "Draft" | "Selesai";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface MusrifJournalDetail {
  id: string;
  journalId: string;
  studentId: string;
  studentName: string;
  attendance: "Hadir" | "Sakit" | "Izin" | "Alpha";
  memorizationTarget: string;
  memorizationAchievement: string;
  tajwid: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
  makhraj: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
  fluency: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
  behavior: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
  notes: string;
  followUp: string;
  createdAt: string;
  updatedAt: string;

  // NEW FIELDS FOR DETAILED MONITORING (BAGIAN 7)
  tahsinMakhraj?: string;
  tahsinTajwid?: string;
  tahsinFluency?: string;
  tahsinNotes?: string;

  tahfizhSurah?: string;
  tahfizhAyat?: string;
  tahfizhHalaman?: string;
  tahfizhNewMemorization?: string;
  tahfizhMurajaah?: string;
  tahfizhFluency?: string;
  tahfizhNotes?: string;

  adabDiscipline?: string;
  adabNeatness?: string;
  adabPoliteness?: string;
  adabHonesty?: string;
  adabResponsibility?: string;
  adabCooperation?: string;
  adabNotes?: string;

  asramaCleanliness?: string;
  asramaWorship?: string;
  asramaAttendance?: string;
  asramaDiscipline?: string;
  asramaSocialInteraction?: string;
  asramaNotes?: string;

  specialIssues?: string;
}
