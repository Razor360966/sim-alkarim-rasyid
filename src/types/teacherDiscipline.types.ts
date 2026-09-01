export type DisciplineCategory = 
  | "Sangat Disiplin" 
  | "Disiplin" 
  | "Cukup Disiplin" 
  | "Perlu Pembinaan" 
  | "Pembinaan Khusus";

export interface DisciplineWeightsConfig {
  adminWeight: number; // e.g. 40 (%)
  mutabaahWeight: number; // e.g. 20 (%)
  attendanceWeight: number; // e.g. 40 (%)
  latePenaltyFactor: number; // e.g. 0.25 (25% penalty factor)
  protaWeight: number; // e.g. 25 (%)
  prosemWeight: number; // e.g. 25 (%)
  modulWeight: number; // e.g. 25 (%)
  jurnalWeight: number; // e.g. 25 (%)
}

export const DEFAULT_DISCIPLINE_CONFIG: DisciplineWeightsConfig = {
  adminWeight: 40,
  mutabaahWeight: 20,
  attendanceWeight: 40,
  latePenaltyFactor: 0.25,
  protaWeight: 25,
  prosemWeight: 25,
  modulWeight: 25,
  jurnalWeight: 25
};

export interface ProtaDisciplineDetail {
  target: number; // 1 per unique subject
  actual: number; // 1 if exists and valid
  percentage: number; // 0 or 100
  status: "Lengkap" | "Belum Lengkap" | "Belum Dibuat";
  documentId?: string;
  topicCount: number;
  topics: string[];
  effectiveJpYear?: number;
  lastUpdated?: string;
}

export interface ProsemDisciplineDetail {
  target: number; // 1 per unique subject
  actual: number; // 1 if exists and valid
  percentage: number; // 0 or 100
  status: "Lengkap" | "Belum Lengkap" | "Belum Dibuat";
  documentId?: string;
  meetingsCount: number;
  allocatedJp: number;
  effectiveWeeksCount?: number;
  lastUpdated?: string;
}

export interface ModulAjarItem {
  id: string;
  title: string;
  classId: string;
  className: string;
  link: string;
  description?: string;
  createdAt: string;
  status: "Valid" | "Perlu Tautan";
}

export interface ModulAjarDisciplineDetail {
  targetMeetings: number; // Real meetings target in period
  actualValid: number; // Valid lesson plans count
  percentage: number; // (actualValid / targetMeetings) * 100 (capped at 100)
  items: ModulAjarItem[];
}

export interface JurnalMengajarItem {
  id: string;
  date: string;
  classId: string;
  className: string;
  jp: number | string;
  material: string;
  status: "Disetujui" | "Diajukan" | "Draft" | "Belum Diisi" | string;
  notes?: string;
}

export interface JurnalMengajarDisciplineDetail {
  targetJp: number; // Total real scheduled JP in period
  actualFilledJp: number; // Total JP with filled journal
  percentage: number; // (actualFilledJp / targetJp) * 100 (capped at 100)
  items: JurnalMengajarItem[];
}

export interface SubjectDisciplineDetail {
  subjectId: string;
  subjectName: string;
  classNames: string[];
  weeklyJp: number;
  periodTargetJp: number;
  realizedJp: number;
  prota: ProtaDisciplineDetail;
  prosem: ProsemDisciplineDetail;
  modulAjar: ModulAjarDisciplineDetail;
  jurnalMengajar: JurnalMengajarDisciplineDetail;
  subjectAdminScore: number; // Average of Prota, Prosem, Modul, Jurnal
}

export interface MutabaahDailyRecord {
  date: string;
  dayName: string;
  status: "Lengkap" | "Belum Lengkap" | "Belum Mengisi" | "Terlambat";
  compliancePercentage: number;
  filledCount: number;
  totalIndicators: number;
  userHaidStatus?: "Normal" | "Haid";
}

export interface MutabaahDisciplineDetail {
  mandatoryDays: number;
  filledDays: number;
  fullDays: number;
  partialDays: number;
  unfilledDays: number;
  lateDays: number;
  avgCompletenessPercentage: number;
  mutabaahScore: number;
  dailyRecords: MutabaahDailyRecord[];
}

export interface AttendanceSessionItem {
  id: string;
  date: string;
  day: string;
  scheduleId: string;
  timeSlot: string;
  jp: string;
  jpCount: number;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  lateMinutes: number;
  substituteTeacherName?: string;
  originalTeacherName?: string;
  isSubstitution: boolean;
  isReplaced: boolean;
  notes?: string;
}

export interface MenggantikanSessionItem {
  id: string;
  date: string;
  day: string;
  timeSlot: string;
  jp: string;
  jpCount: number;
  className: string;
  subjectName: string;
  replacedTeacherName: string;
  checkInTime?: string;
  notes?: string;
}

export interface DigantikanSessionItem {
  id: string;
  date: string;
  day: string;
  timeSlot: string;
  jp: string;
  jpCount: number;
  className: string;
  subjectName: string;
  substituteTeacherName: string;
  reason?: string;
}

export interface TerlambatSessionItem {
  id: string;
  date: string;
  day: string;
  timeSlot: string;
  jp: string;
  jpCount: number;
  className: string;
  subjectName: string;
  checkInTime: string;
  scheduledTime: string;
  lateMinutes: number;
}

export interface AttendanceDisciplineDetail {
  jmlJp: number; // Denominator: Total original scheduled JP
  kehadiranJp: number; // Realized attendance JP (Hadir + Terlambat)
  terlambatJp: number;
  terlambatSessionsCount: number;
  totalLateMinutes: number;
  avgLateMinutes: number;
  menggantikanJp: number; // Subbing others (does not increase JML JP)
  digantikanJp: number; // Subbed by others (in JML JP, not Kehadiran, no late penalty)
  tidakHadirJp: number;
  izinSakitJp: number;
  tugasDinasJp: number;
  kehadiranDasarPercentage: number; // (kehadiranJp / jmlJp) * 100
  rasioKeterlambatan: number; // terlambatJp / jmlJp
  penaltiKeterlambatan: number; // rasio * latePenaltyFactor * 100
  nilaiKehadiranDisiplin: number; // Math.max(0, Math.min(100, kehadiranDasar - penalti))
  attendanceSessions: AttendanceSessionItem[];
  menggantikanSessions: MenggantikanSessionItem[];
  digantikanSessions: DigantikanSessionItem[];
  terlambatSessions: TerlambatSessionItem[];
}

export interface TeacherDisciplineAuditTrail {
  adminFormula: string;
  adminContribution: number;
  mutabaahFormula: string;
  mutabaahContribution: number;
  attendanceFormula: string;
  attendanceContribution: number;
  penaltyFormula: string;
  finalFormula: string;
}

export interface TeacherDisciplineMetric {
  teacherId: string;
  teacherName: string;
  niy?: string;
  gender?: string;
  role: string;
  
  // Multi-Subject Administration Breakdown
  subjects: SubjectDisciplineDetail[];
  totalJpScheduled: number;
  
  // Pillar 1: Administrasi
  administrationScore: number;
  
  // Pillar 2: Mutabaah
  mutabaah: MutabaahDisciplineDetail;
  mutabaahScore: number;
  
  // Pillar 3: Kehadiran Disiplin
  attendance: AttendanceDisciplineDetail;
  attendanceScore: number;
  
  // Final Score & Ranking
  finalDisciplineScore: number;
  category: DisciplineCategory;

  // Backward-compatible properties for older services
  disciplineScore: number;
  attendancePercentage: number;
  checkInOnTimePercentage: number;
  checkOutOnTimePercentage: number;
  
  // Trend
  previousScore?: number;
  trendStatus?: "Meningkat" | "Stabil" | "Menurun";
  
  // Detailed Audit Trail
  auditTrail: TeacherDisciplineAuditTrail;
}

export interface SchoolDisciplineSummary {
  totalTeachers: number;
  avgSchoolDisciplineScore: number;
  avgAdministrationScore: number;
  avgMutabaahScore: number;
  avgAttendanceDisciplineScore: number;
  
  // Category Counts
  sangatDisiplinCount: number;
  disiplinCount: number;
  cukupDisiplinCount: number;
  perluPembinaanCount: number;
  pembinaanKhususCount: number;
  
  // Aggregated JP & Sessions
  totalScheduledJp: number;
  totalKehadiranJp: number;
  totalTerlambatJp: number;
  totalMenggantikanJp: number;
  totalDigantikanJp: number;
  totalLateIncidents: number;
  
  // Admin Component Averages
  avgProtaScore: number;
  avgProsemScore: number;
  avgModulScore: number;
  avgJurnalScore: number;
}

export interface SystemDisciplineRecommendation {
  id: string;
  type: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
  teacherId?: string;
  teacherName?: string;
}

export interface DisciplineHistoryRecord {
  id?: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  startDate: string;
  endDate: string;
  periodLabel: string;
  
  finalDisciplineScore: number;
  administrationScore: number;
  mutabaahScore: number;
  attendanceScore: number;
  category: DisciplineCategory;
  
  totalJp: number;
  totalTerlambatJp: number;
  trendStatus: "Meningkat" | "Stabil" | "Menurun";
  createdAt?: any;
}
