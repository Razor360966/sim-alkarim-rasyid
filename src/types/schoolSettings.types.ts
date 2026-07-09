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
  schoolHours?: {
    startTime: string;
    endTime: string;
  };
  lessonPeriod?: number;
}
