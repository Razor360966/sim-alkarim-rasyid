export interface AcademicReference {
  id: string;
  category: string; // "Kategori Event" | "Status Hari" | "Jenis Hari" | "Jenis Penilaian" | "Jenis Jurnal" | "Status Pembelajaran" | "Jenis Kegiatan Akademik" | "Jenis Libur" | "Jenis Asesmen" | "Kategori Kalender"
  code: string;      // UNIQUE within category
  name: string;      // Display name
  createdAt: string;
}

export interface AcademicEvent {
  id: string;
  title: string;
  categoryId: string; // references an AcademicReference ID (from "Kategori Event" or "Kategori Kalender")
  categoryName?: string; // cached for convenience
  statusId: string; // references an AcademicReference ID (from "Status Hari")
  statusName?: string; // cached for convenience
  description: string;
  priority: "Tinggi" | "Sedang" | "Rendah";
  isEffectiveDay: boolean;
  reduceLesson: boolean;
  specialLessonDuration: number; // in minutes
  affectsAcademicPlanning: boolean;
  affectsScheduler: boolean;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  isRange?: boolean;
  sasaran?: string;
  pelaksana?: string;
}

export interface AcademicCalendarDay {
  id: string; // YYYY-MM-DD
  date: string; // YYYY-MM-DD
  events: AcademicEvent[];
  academicYearId?: string; // linked to academic year for easier query
  semesterId?: string; // linked to semester for easier query
}

export interface EffectiveWeeksAnalysis {
  academicYearId: string;
  semesterId: string;
  totalWeeks: number;
  effectiveWeeks: number;
  ineffectiveWeeks: number;
  details: {
    month: string; // "Juli", "Agustus", etc.
    totalWeeks: number;
    effectiveWeeks: number;
    ineffectiveWeeks: number;
    notes: string;
  }[];
  manualWeeksConfigured?: boolean;
  assessmentWeeks?: number;
  pasPatWeeks?: number;
  projectWeeks?: number;
  otherWeeks?: number;
}

export interface EffectiveDaysAnalysis {
  academicYearId: string;
  semesterId: string;
  learningDays: number;
  holidayDays: number;
  assessmentDays: number;
  activityDays: number;
  details: {
    date: string;
    dayName: string;
    type: "Hari Pembelajaran" | "Hari Libur" | "Hari Asesmen" | "Hari Kegiatan" | "Hari Tidak Aktif (Weekend)";
    isEffective: boolean;
    events: string[];
  }[];
}

export interface EffectiveJpAnalysis {
  academicYearId: string;
  semesterId: string;
  effectiveJpHalfYear: number;
  effectiveJpFullYear: number;
  byGrade: {
    gradeLevel: "VII" | "VIII" | "IX";
    totalWeeklyJp: number;
    effectiveJpSemester: number;
    effectiveJpYear: number;
  }[];
  bySubject: {
    subjectId: string;
    subjectName: string;
    weeklyJpVii: number;
    weeklyJpViii: number;
    weeklyJpIx: number;
    effectiveSemesterGanjil: number;
    effectiveSemesterGenap: number;
    effectiveTahunan: number;
  }[];
}
