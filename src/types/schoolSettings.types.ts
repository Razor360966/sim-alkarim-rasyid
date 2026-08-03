export interface MorningAssembly {
  enabled: boolean;
  start: string; // e.g. "07:00"
  duration: number; // FIXED 10
  end: string; // auto "07:10"
}

export interface RoutineActivity {
  id: string;
  name: string;
  enabled: boolean;
  days: string[];
  startTime: string;
  duration: number;
  autoEndTime: string;
  priority: number;
  description?: string;
  agendaType?: string;
}

export interface SpecialActivity {
  name: string; // e.g. "Upacara" / "Senam"
  day: string; // e.g. "Senin" / "Jumat"
  enabled: boolean;
  start: string; // e.g. "07:10"
  duration: number; // FIXED 40
  end: string; // auto calculated
}

export interface BreakTime {
  id: string;
  name: string; // e.g. "Istirahat 1"
  start: string; // e.g. "09:50"
  duration: number; // minutes, e.g. 20
  end: string; // auto calculated
}

export interface SchoolAgenda {
  id?: string;
  name: string;
  agendaType: string; // "Apel Pagi" | "Upacara Bendera" | "Senam Pagi" | custom
  day: string; // e.g. "Senin"
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  duration?: number; // in minutes
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface JournalTimelinessRules {
  veryOnTimeMinutes: number; // e.g. 60 (<= 60 menit setelah QR Check-out)
  veryOnTimeScore: number; // e.g. 100
  sameDayScore: number; // e.g. 90 (<= 23:59 WIB hari yang sama)
  oneDayLateScore: number; // e.g. 70 (1 hari)
  twoToThreeDaysLateScore: number; // e.g. 40 (2-3 hari)
  moreThanThreeDaysLateScore: number; // e.g. 0 (> 3 hari)
  unfilledJournalScore: number; // e.g. 0 (Belum mengisi)
}

export interface TeachingAttendanceSettings {
  checkInToleranceMinutes: number; // 5, 10, 15, 20, 30
  checkOutToleranceMinutes: number; // 5, 10, 15, 20, 30
  approvalMethod: "automatic" | "manual" | "hybrid";
  pendingValidationConditions: {
    checkInTerlambat: boolean;
    checkOutTerlambat: boolean;
    checkInTerlaluAwal: boolean;
    checkOutTerlaluAwal: boolean;
    durasiTidakSesuai: boolean;
    inputManual: boolean;
    lupaCheckOut: boolean;
    jadwalTidakSesuai: boolean;
    scanDILuarToleransi: boolean;
    scanBerulang: boolean;
  };
  repeatScanRule: "never_allowed" | "allowed_across_break" | "always_allowed";
  useBreakTimesFromSettings: boolean;
  qrRules: {
    activeScheduleOnly: boolean;
    matchingClassOnly: boolean;
    matchingDayOnly: boolean;
    activeSemesterOnly: boolean;
  };
  minTeachingDurationPercent: number; // e.g. 80
  notifications: {
    checkInSuccess: boolean;
    checkOutSuccess: boolean;
    pendingValidation: boolean;
    approval: boolean;
    rejection: boolean;
  };
  journalTimelinessRules?: JournalTimelinessRules;
}

export interface SchoolSettings {
  settingId: string; // "settings"
  activeDays: string[]; // e.g. ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
  startTime: string; // default "07:00"
  endTime: string; // default "15:00"
  jpDuration: number; // FIXED 40
  morningAssembly: MorningAssembly;
  specialActivities: SpecialActivity[];
  breakTimes: BreakTime[];
  routineActivities?: RoutineActivity[];
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  jpStructure?: any[];
  requiresJpAdjustmentApproval?: boolean;
  schoolHours?: {
    startTime: string;
    endTime: string;
  };
  lessonPeriod?: number;
  teachingAttendanceSettings?: TeachingAttendanceSettings;
}
