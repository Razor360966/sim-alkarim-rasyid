import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Printer, 
  X, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Building2,
  Users,
  Grid,
  Filter,
  LayoutGrid,
  Table as TableIcon
} from "lucide-react";
import { 
  ScheduleScenario, 
  ScenarioCurriculumMatrix, 
  ScenarioSchedule, 
  ScenarioSubject,
  Class, 
  Teacher, 
  LessonPeriod, 
  LessonPeriodType,
  ScenarioConflict,
  SchoolSettings,
  SchoolAgenda,
  RoutineActivity
} from "../types";
import { isClassMatch, normalizeGradeLevel } from "../utils/gradeLevelHelper";
import { toValidGradeLevel } from "../services/scenario.service";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { schoolAgendaService } from "../services/schoolAgenda.service";
import { generateDailySchedule, getDefaultDailyStructures, timeToMinutes } from "../utils/scheduleCalculator";

interface Props {
  scenario: ScheduleScenario;
  curriculums: ScenarioCurriculumMatrix[];
  schedules: ScenarioSchedule[];
  classes: Class[];
  teachers: Teacher[];
  periods: LessonPeriod[];
  conflicts: ScenarioConflict[];
  subjects?: ScenarioSubject[];
  schoolSettings?: SchoolSettings;
  activeAgendas?: SchoolAgenda[];
  onClose: () => void;
}

// Canonical school days in operational order (Islamic boarding school: Saturday to Thursday)
const CANONICAL_DAYS = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export const normalizeDay = (day?: string): string => {
  if (!day) return "";
  const trimmed = day.trim().toLowerCase();
  const map: Record<string, string> = {
    sabtu: "Sabtu",
    minggu: "Minggu",
    senin: "Senin",
    selasa: "Selasa",
    rabu: "Rabu",
    kamis: "Kamis",
    jumat: "Jumat"
  };
  if (map[trimmed]) return map[trimmed];
  return day.trim().charAt(0).toUpperCase() + day.trim().slice(1);
};

/**
 * Cleanly format time slots as HH.MM–HH.MM (e.g. 07.00–07.10, 07.30–08.10)
 */
export const formatTimeSlot = (startTime?: string, endTime?: string): string => {
  if (!startTime && !endTime) return "-";
  const clean = (t?: string) => {
    if (!t) return "";
    const trimmed = t.trim();
    if (trimmed.includes(":")) {
      const parts = trimmed.split(":");
      return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}`;
    }
    if (trimmed.includes(".")) {
      const parts = trimmed.split(".");
      return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}`;
    }
    return trimmed;
  };

  const start = clean(startTime);
  const end = clean(endTime);
  if (start && end) return `${start}–${end}`;
  return start || end || "-";
};

export interface ResolvedDaySlot {
  sequence: number;
  title: string;
  timeRange: string;
  isBreak: boolean;
  isRoutine?: boolean;
  jpDisplay?: string;
  schedule?: ScenarioSchedule;
}

/**
 * Helper to dynamically resolve the complete, authentic daily period structure for any day.
 * Ensures Apel Pagi, Halaqoh Qur'an, breaks, and KBM hours strictly match school operations.
 */
export function resolveCompleteDayPeriods(
  dayName: string,
  rawPeriods: LessonPeriod[],
  settings?: SchoolSettings | null,
  agendas: SchoolAgenda[] = []
): LessonPeriod[] {
  const normDay = normalizeDay(dayName).toLowerCase();

  // 1. Check if rawPeriods already has routine activities and lesson periods specifically for this day
  const existingForDay = rawPeriods.filter((p) => p.day && normalizeDay(p.day).toLowerCase() === normDay);
  const hasExistingRoutine = existingForDay.some((p) => 
    p.type === LessonPeriodType.ROUTINE || 
    /apel|upacara|halaqah|halaqoh|tahfidz|senam|sholat|dhuha/i.test(p.title || "")
  );

  if (existingForDay.length > 0 && hasExistingRoutine) {
    return [...existingForDay].sort((a, b) => {
      const startDiff = timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      if (startDiff !== 0) return startDiff;
      return a.sequence - b.sequence;
    });
  }

  // 2. Otherwise, use the core calculation engine generateDailySchedule with active settings and active agendas
  const dayAgendas = (agendas || []).filter(
    (a) => a.day && normalizeDay(a.day).toLowerCase() === normDay && a.active !== false
  );
  const mappedAgendas: RoutineActivity[] = dayAgendas.map((a) => ({
    id: a.id || `agenda-${normDay}-${a.name}`,
    name: a.name,
    enabled: a.active !== false,
    days: [a.day],
    startTime: a.startTime,
    duration: a.duration || (timeToMinutes(a.endTime) - timeToMinutes(a.startTime)) || 10,
    autoEndTime: a.endTime,
    priority: 3,
    description: a.notes,
    agendaType: a.agendaType
  }));

  // Build dailyStructures with dayAgendas overlaid
  let baseStructures = settings?.dailyStructures ? [...settings.dailyStructures] : getDefaultDailyStructures(settings || undefined);
  if (dayAgendas.length > 0) {
    baseStructures = baseStructures.map((ds) => {
      if (ds.day.toLowerCase() !== normDay) return ds;
      const acts = [...(ds.activities || [])];
      dayAgendas.forEach((da) => {
        const daLower = da.name.toLowerCase();
        const existingIdx = acts.findIndex(
          (a) => a.name.toLowerCase() === daLower || (da.agendaType && a.type === da.agendaType)
        );
        if (existingIdx >= 0) {
          acts[existingIdx] = {
            ...acts[existingIdx],
            name: da.name,
            startTime: da.startTime,
            endTime: da.endTime,
            isActive: da.active !== false,
            durationMinutes: timeToMinutes(da.endTime) - timeToMinutes(da.startTime)
          };
        } else {
          acts.push({
            id: da.id || `act-${normDay}-${da.name}`,
            name: da.name,
            type: da.agendaType || "KEGIATAN_SEKOLAH",
            startTime: da.startTime,
            endTime: da.endTime,
            isActive: da.active !== false,
            durationMinutes: timeToMinutes(da.endTime) - timeToMinutes(da.startTime),
            order: acts.length + 1
          });
        }
      });
      return { ...ds, activities: acts };
    });
  }

  const mergedSettings: SchoolSettings = {
    ...(settings || {
      settingId: "school_settings_doc",
      startTime: "07:00",
      endTime: "14:00",
      activeDays: CANONICAL_DAYS,
      jpDuration: 40,
      lessonPeriod: 40,
      dailyStructures: baseStructures,
      routineActivities: [],
      breakTimes: [],
      morningAssembly: {
        enabled: true,
        start: "07:00",
        duration: 10,
        end: "07:10"
      },
      specialActivities: [],
      jpStructure: [],
      schoolHours: {
        startTime: "07:00",
        endTime: "14:00"
      }
    }),
    dailyStructures: baseStructures,
    routineActivities: [
      ...(settings?.routineActivities || []),
      ...mappedAgendas
    ]
  };

  const blocks = generateDailySchedule(mergedSettings, dayName);
  
  let dailySeq = 1;
  let jpSeq = 1;
  const computedPeriods: LessonPeriod[] = [];

  for (const block of blocks) {
    if (block.type === "gap" || block.type === "end") continue;

    let type: LessonPeriodType = LessonPeriodType.LESSON;
    let instructional = false;
    let jpNumber: number | undefined = undefined;

    if (block.type === "assembly" || block.type === "special") {
      type = LessonPeriodType.ROUTINE;
    } else if (block.type === "break") {
      type = LessonPeriodType.BREAK;
    } else if (block.type === "jp") {
      type = LessonPeriodType.LESSON;
      instructional = true;
      jpNumber = block.jpNumber || jpSeq++;
    }

    computedPeriods.push({
      day: dayName,
      sequence: dailySeq++,
      periodCode: `${dayName.substring(0, 3).toUpperCase()}-${type}-${jpNumber || dailySeq}`,
      type,
      title: block.name,
      startTime: block.start,
      endTime: block.end,
      duration: block.duration,
      instructional,
      generatedAt: new Date().toISOString(),
      ...(jpNumber ? { jpNumber } : {})
    } as any);
  }

  // Link existing database IDs if available for lesson periods
  if (existingForDay.length > 0) {
    const existingLessons = existingForDay.filter((p) => p.type === LessonPeriodType.LESSON || p.instructional);
    let lIdx = 0;
    computedPeriods.forEach((cp) => {
      if (cp.instructional && existingLessons[lIdx]) {
        cp.id = existingLessons[lIdx].id;
        lIdx++;
      }
    });
  }

  return computedPeriods;
}

export const ScenarioPrintModal: React.FC<Props> = ({
  scenario,
  curriculums,
  schedules,
  classes,
  teachers,
  periods,
  conflicts,
  subjects = [],
  schoolSettings: propSchoolSettings,
  activeAgendas: propActiveAgendas,
  onClose
}) => {
  // Query active school settings and active school agendas from Firestore
  const { data: fetchedSettings } = useQuery({
    queryKey: ["schoolSettings"],
    queryFn: () => schoolSettingsService.getSettings(),
    enabled: !propSchoolSettings
  });

  const { data: fetchedAgendas = [] } = useQuery({
    queryKey: ["active_school_agendas"],
    queryFn: () => schoolAgendaService.getActiveAgendas(),
    enabled: !propActiveAgendas
  });

  const schoolSettings = propSchoolSettings || fetchedSettings;
  const activeAgendas = propActiveAgendas || fetchedAgendas;
  // View mode switcher:
  // - "CLASS_SCHEDULE": Jadwal Per Rombel (Semua Hari KBM)
  // - "GENERAL_SCHEDULE": Jadwal Gabungan Umum (Matriks Seluruh Rombel VII–IX)
  // - "CURRICULUM_MATRIX": Struktur Kurikulum & Ringkasan Alokasi JP
  const [printView, setPrintView] = useState<"CLASS_SCHEDULE" | "GENERAL_SCHEDULE" | "CURRICULUM_MATRIX">("CLASS_SCHEDULE");

  // Format layout for CLASS_SCHEDULE:
  // - "DETAILED_PER_DAY": Tabel rinci per hari (JP, Waktu, Mapel, Guru) — Sangat aman cetak portrait multi-halaman
  // - "WEEKLY_MATRIX": Matriks Mingguan 6 Hari Horizontal — Rekomendasi cetak landscape
  const [classScheduleFormat, setClassScheduleFormat] = useState<"DETAILED_PER_DAY" | "WEEKLY_MATRIX">("DETAILED_PER_DAY");

  // Filter rombel for CLASS_SCHEDULE view ("ALL" or specific classId)
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");

  // Filter day for GENERAL_SCHEDULE view ("ALL" or specific day)
  const [selectedDay, setSelectedDay] = useState<string>("ALL");

  // Lifecycle to isolate print media and cleanly hide parent layout during print
  useEffect(() => {
    document.body.classList.add("scenario-print-active");

    const handleBeforePrint = () => {
      document.body.classList.add("scenario-print-active");
    };

    const handleAfterPrint = () => {
      document.body.classList.add("scenario-print-active");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("scenario-print-active");
    };
  }, [onClose]);

  const handlePrint = () => {
    document.body.classList.add("scenario-print-active");
    window.print();
  };

  // Sort and filter active valid classes (VII, VIII, IX)
  const sortedClasses = useMemo(() => {
    const valid = classes.filter((c) => {
      const g = toValidGradeLevel(c.gradeLevel || c.name);
      return g === "VII" || g === "VIII" || g === "IX";
    });
    return [...valid].sort((a, b) => {
      const gOrder: Record<string, number> = { VII: 1, VIII: 2, IX: 3 };
      const gA = gOrder[toValidGradeLevel(a.gradeLevel || a.name)] || 99;
      const gB = gOrder[toValidGradeLevel(b.gradeLevel || b.name)] || 99;
      if (gA !== gB) return gA - gB;
      return (a.name || "").localeCompare(b.name || "", "id");
    });
  }, [classes]);

  // Target classes to print
  const targetClasses = useMemo(() => {
    if (selectedClassId === "ALL") return sortedClasses;
    return sortedClasses.filter((c) => c.id === selectedClassId);
  }, [selectedClassId, sortedClasses]);

  // All distinct operational days present in school settings, scenario schedules, or periods (canonical order)
  const availableDays = useMemo(() => {
    const daySet = new Set<string>();
    if (schoolSettings?.activeDays && schoolSettings.activeDays.length > 0) {
      schoolSettings.activeDays.forEach((d) => daySet.add(normalizeDay(d)));
    }
    periods.forEach((p) => {
      if (p.day) daySet.add(normalizeDay(p.day));
    });
    schedules.forEach((s) => {
      if (s.day) daySet.add(normalizeDay(s.day));
    });

    if (daySet.size === 0) {
      return ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];
    }

    // Filter canonical days in operational order
    const ordered = CANONICAL_DAYS.filter((cd) =>
      Array.from(daySet).some((d) => d.toLowerCase() === cd.toLowerCase())
    );

    // If there are other custom days not in CANONICAL_DAYS, append them
    const others = Array.from(daySet).filter(
      (d) => !CANONICAL_DAYS.some((cd) => cd.toLowerCase() === d.toLowerCase())
    );

    return [...ordered, ...others];
  }, [periods, schedules, schoolSettings?.activeDays]);

  // Target days for general matrix
  const targetDays = useMemo(() => {
    if (selectedDay === "ALL") return availableDays;
    return availableDays.filter((d) => d.toLowerCase() === selectedDay.toLowerCase());
  }, [selectedDay, availableDays]);

  // Distinct periods sorted by sequence
  const sortedPeriods = useMemo(() => {
    // Generate a reference day (Senin or first available) to get full chronological layout
    const refDay = availableDays[0] || "Senin";
    const refPeriods = resolveCompleteDayPeriods(refDay, periods, schoolSettings, activeAgendas);
    return refPeriods;
  }, [availableDays, periods, schoolSettings, activeAgendas]);

  // Grade columns for Master Timetable (JADWAL MATA PELAJARAN INDUK: KELAS VII, KELAS VIII, KELAS IX)
  const masterGradeColumns = useMemo(() => {
    const grades: ("VII" | "VIII" | "IX")[] = ["VII", "VIII", "IX"];

    // Check if sortedClasses has multiple rombels per grade (e.g. 7A, 7B)
    const hasMultipleRombel = grades.some(
      (g) => sortedClasses.filter((c) => toValidGradeLevel(c.gradeLevel || c.name) === g).length > 1
    );

    if (hasMultipleRombel) {
      return sortedClasses.map((cls) => {
        const nameUpper = cls.name.trim().toUpperCase();
        return {
          key: cls.id,
          label: nameUpper.startsWith("KELAS") ? nameUpper : `KELAS ${nameUpper}`,
          grade: toValidGradeLevel(cls.gradeLevel || cls.name) as "VII" | "VIII" | "IX",
          classObj: cls
        };
      });
    }

    return grades.map((g) => {
      const cls = sortedClasses.find((c) => toValidGradeLevel(c.gradeLevel || c.name) === g);
      return {
        key: g,
        label: `KELAS ${g}`,
        grade: g,
        classObj: cls
      };
    });
  }, [sortedClasses]);

  // Helper to find schedule slot strictly from shadow schedules (case-insensitive day and sequence/jp)
  const findScheduleSlot = (cls: Class, day: string, period: LessonPeriod, jpNumber?: number) => {
    const normDay = normalizeDay(day).toLowerCase();
    return schedules.find((s) => {
      const matchesClass = s.classId === cls.id || isClassMatch(s.classId, cls, classes);
      const matchesDay = normalizeDay(s.day).toLowerCase() === normDay;
      if (!matchesClass || !matchesDay) return false;

      // 1. Match by exact lessonPeriodId
      if (period.id && s.lessonPeriodId === period.id) return true;
      // 2. Match by exact period sequence
      if (s.sequence === period.sequence) return true;
      // 3. Match by instructional jpNumber (e.g. s.sequence === 1 for JP 1 or s.jp === 'JP 1')
      if (jpNumber !== undefined) {
        if (s.sequence === jpNumber) return true;
        if (s.jp && (s.jp === `JP ${jpNumber}` || s.jp === String(jpNumber) || s.jp === `JP${jpNumber}`)) return true;
      }
      return false;
    });
  };

  // Resolve all slot rows for a specific class and day
  const getResolvedDaySlots = (cls: Class, day: string): ResolvedDaySlot[] => {
    const dayPeriods = resolveCompleteDayPeriods(day, periods, schoolSettings, activeAgendas);

    let jpCounter = 1;
    return dayPeriods.map((period) => {
      const periodTitle = period.title || (period as any)?.name || "";
      const isRoutine = period.type === LessonPeriodType.ROUTINE || 
        /apel|upacara|halaqah|halaqoh|tahfidz|senam|sholat|dhuha|dzuhur|snack|briefing/i.test(periodTitle);
      const isExplicitBreak = period.type === LessonPeriodType.BREAK || 
        Boolean((period as any).isBreak) || 
        /istirahat|rehat|snack|break/i.test(periodTitle);
      const isShared = isRoutine || isExplicitBreak;

      let jpNumber: number | undefined = undefined;
      let schedule: ScenarioSchedule | undefined = undefined;

      if (!isShared) {
        jpNumber = (period as any).jpNumber || jpCounter++;
        schedule = findScheduleSlot(cls, day, period, jpNumber);
      }

      const timeRange = formatTimeSlot(period.startTime, period.endTime);
      const title = periodTitle || (isExplicitBreak ? "ISTIRAHAT" : `JP ${jpNumber || period.sequence}`);
      const jpDisplay = isShared ? "-" : String(jpNumber || period.sequence);

      return {
        sequence: period.sequence,
        title,
        timeRange,
        isBreak: isExplicitBreak,
        isRoutine,
        jpDisplay,
        schedule
      };
    });
  };

  // Helper to find schedule slot for master table column
  const findMasterSlot = (
    col: (typeof masterGradeColumns)[number],
    day: string,
    period: LessonPeriod,
    jpNumber?: number
  ) => {
    const normDay = normalizeDay(day).toLowerCase();
    if (col.classObj) {
      const direct = findScheduleSlot(col.classObj, day, period, jpNumber);
      if (direct) return direct;
    }
    return schedules.find((s) => {
      if (!s.day || normalizeDay(s.day).toLowerCase() !== normDay) return false;
      if (col.classObj) {
        if (!isClassMatch(s.classId, col.classObj, classes)) return false;
      } else {
        const schedGrade = normalizeGradeLevel(s.className || s.classId);
        if (schedGrade !== col.grade) return false;
      }

      if (period.id && s.lessonPeriodId === period.id) return true;
      if (s.sequence === period.sequence) return true;
      if (jpNumber !== undefined) {
        if (s.sequence === jpNumber) return true;
        if (s.jp && (s.jp === `JP ${jpNumber}` || s.jp === String(jpNumber) || s.jp === `JP${jpNumber}`)) return true;
      }
      return false;
    });
  };

  const getSharedStyle = (title: string, isBreak: boolean) => {
    const t = title.toLowerCase();
    if (isBreak || /istirahat|snack|makan|rehat/i.test(t)) {
      return {
        bg: "bg-amber-50/70",
        text: "text-amber-900"
      };
    }
    if (/apel|upacara|briefing|upacara bendera/i.test(t)) {
      return {
        bg: "bg-sky-50/70",
        text: "text-sky-900"
      };
    }
    if (/halaqah|halaqoh|tahfidz|qur'?an|sholat|dhuha|dzuhur|ashar|doa/i.test(t)) {
      return {
        bg: "bg-emerald-50/70",
        text: "text-emerald-900"
      };
    }
    if (/senam|olahraga/i.test(t)) {
      return {
        bg: "bg-indigo-50/70",
        text: "text-indigo-900"
      };
    }
    return {
      bg: "bg-slate-100/70",
      text: "text-slate-800"
    };
  };

  // Resolve all rows for a given day in the master timetable
  const getMasterDayRows = (dayName: string) => {
    const dayPeriods = resolveCompleteDayPeriods(dayName, periods, schoolSettings, activeAgendas);

    let jpCounter = 1;
    return dayPeriods.map((period) => {
      const periodTitle = period.title || (period as any)?.name || "";
      const isRoutine = period.type === LessonPeriodType.ROUTINE || 
        /apel|upacara|halaqah|halaqoh|tahfidz|senam|sholat|dhuha|dzuhur|snack|briefing/i.test(periodTitle);
      const isExplicitBreak = period.type === LessonPeriodType.BREAK || 
        Boolean((period as any).isBreak) || 
        /istirahat|rehat|snack|break/i.test(periodTitle);
      const isSharedActivity = isRoutine || isExplicitBreak;

      const timeRange = formatTimeSlot(period.startTime, period.endTime);
      const title = periodTitle || (isExplicitBreak ? "ISTIRAHAT" : "AGENDA");
      const sharedStyle = getSharedStyle(title, isExplicitBreak);

      let jpNumber: number | undefined = undefined;
      const slots: Record<string, ScenarioSchedule | undefined> = {};

      if (!isSharedActivity) {
        jpNumber = (period as any).jpNumber || jpCounter++;
        masterGradeColumns.forEach((col) => {
          slots[col.key] = findMasterSlot(col, dayName, period, jpNumber);
        });
      }

      const jpDisplay = isSharedActivity ? "-" : String(jpNumber || period.sequence);

      return {
        sequence: period.sequence,
        period,
        timeRange,
        jpDisplay,
        isSharedActivity,
        sharedStyle,
        title,
        slots
      };
    });
  };

  // Helper to determine whether an item belongs to Pesantren (Group B) or Umum (Group A / C)
  // Strictly follows ScenarioCurriculumEditor.tsx logic
  const isPesantrenItem = (item: ScenarioCurriculumMatrix): boolean => {
    const detail = subjects.find((s) => s.id === item.subjectId || s.originalSubjectId === item.subjectId);
    if (detail?.group) {
      return detail.group === "B";
    }
    return (
      item.subjectGroup === "B" || 
      (item as any).subjectType === "KEPESANTRENAN" || 
      (item as any).subjectType === "PONDOK"
    );
  };

  // Partition Curriculums:
  // Group A: MATA PELAJARAN UMUM (Group A & Group C)
  const umumCurriculums = useMemo(() => {
    return curriculums
      .filter((item) => !isPesantrenItem(item))
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 0;
        const orderB = typeof b.order === "number" ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.subjectName || "").localeCompare(b.subjectName || "", "id");
      });
  }, [curriculums, subjects]);

  // Group B: MATA PELAJARAN PESANTREN (Group B)
  const pesantrenCurriculums = useMemo(() => {
    return curriculums
      .filter((item) => isPesantrenItem(item))
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 0;
        const orderB = typeof b.order === "number" ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.subjectName || "").localeCompare(b.subjectName || "", "id");
      });
  }, [curriculums, subjects]);

  // Subtotal calculations for Umum (active items only)
  const subtotalUmum = useMemo(() => {
    return umumCurriculums.reduce(
      (acc, curr) => {
        if (!curr.isActiveInScenario) return acc;
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [umumCurriculums]);

  // Subtotal calculations for Pesantren (active items only)
  const subtotalPesantren = useMemo(() => {
    return pesantrenCurriculums.reduce(
      (acc, curr) => {
        if (!curr.isActiveInScenario) return acc;
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [pesantrenCurriculums]);

  // Grand total calculations (A + B)
  const grandTotal = useMemo(() => {
    const vii = subtotalUmum.vii + subtotalPesantren.vii;
    const viii = subtotalUmum.viii + subtotalPesantren.viii;
    const ix = subtotalUmum.ix + subtotalPesantren.ix;
    return {
      vii,
      viii,
      ix,
      total: vii + viii + ix
    };
  }, [subtotalUmum, subtotalPesantren]);

  const totalVii = grandTotal.vii;
  const totalViii = grandTotal.viii;
  const totalIx = grandTotal.ix;

  const isLandscape = (printView === "CLASS_SCHEDULE" && classScheduleFormat === "WEEKLY_MATRIX") || printView === "GENERAL_SCHEDULE";

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="scenario-print-portal-root"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-6 print:p-0 print:bg-white print:overflow-visible print:static"
    >
      
      {/* Scoped Dynamic Print CSS Rules strictly for Scenario Print Modal */}
      <style>{`
        @media print {
          @page {
            size: ${isLandscape ? "A4 landscape" : "A4 portrait"};
            margin: 8mm 10mm;
          }

          /* 1. Sembunyikan seluruh UI web/aplikasi (di dalam #root) saat mode cetak skenario aktif */
          body.scenario-print-active > #root,
          body.scenario-print-active header,
          body.scenario-print-active aside,
          body.scenario-print-active footer,
          body.scenario-print-active nav,
          body.scenario-print-active main {
            display: none !important;
          }

          /* 2. Format Body & Viewport */
          html, body.scenario-print-active {
            background: white !important;
            color: #0f172a !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* 3. Sembunyikan kontrol toolbar, filter, dan tombol cetak */
          .no-print,
          .scenario-no-print,
          body.scenario-print-active .no-print,
          body.scenario-print-active .scenario-no-print {
            display: none !important;
          }

          /* 4. Lepaskan modal overlay menjadi kontainer dokumen cetak biasa */
          body.scenario-print-active #scenario-print-portal-root,
          #scenario-print-portal-root {
            position: static !important;
            display: block !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          /* 5. Kontainer dokumen cetak utama */
          body.scenario-print-active #scenario-printable-sheet,
          #scenario-printable-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            background: white !important;
            display: block !important;
          }

          .print-page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-overflow-visible {
            overflow: visible !important;
          }
        }
      `}</style>

      {/* Top Floating Control Toolbar (Hidden during Print) */}
      <div className={`w-full ${isLandscape ? "max-w-6xl" : "max-w-5xl"} bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden no-print scenario-no-print`}>
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setPrintView("CLASS_SCHEDULE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              printView === "CLASS_SCHEDULE"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal Per Rombel</span>
          </button>

          <button
            type="button"
            onClick={() => setPrintView("GENERAL_SCHEDULE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              printView === "GENERAL_SCHEDULE"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Jadwal Gabungan (VII–IX)</span>
          </button>

          <button
            type="button"
            onClick={() => setPrintView("CURRICULUM_MATRIX")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              printView === "CURRICULUM_MATRIX"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Struktur Kurikulum & JP</span>
          </button>
        </div>

        {/* Center / Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {printView === "CLASS_SCHEDULE" && (
            <>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 font-medium">Pilih Rombel:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="ALL">Semua Rombel ({sortedClasses.length} Kelas)</option>
                  {sortedClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Kelas {cls.name} ({cls.gradeLevel})
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Toggle: Detailed Per Day vs Weekly Matrix */}
              <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setClassScheduleFormat("DETAILED_PER_DAY")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    classScheduleFormat === "DETAILED_PER_DAY"
                      ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                  title="Format Rinci Semua Hari: Kolom JP, Waktu, Mapel, Guru per hari (Sangat rapi di A4 portrait)"
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Rinci Per Hari</span>
                </button>
                <button
                  type="button"
                  onClick={() => setClassScheduleFormat("WEEKLY_MATRIX")}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                    classScheduleFormat === "WEEKLY_MATRIX"
                      ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                  title="Format Matriks Mingguan 6 Hari Horizontal (Landscape)"
                >
                  <TableIcon className="w-3 h-3" />
                  <span>Matriks Mingguan</span>
                </button>
              </div>
            </>
          )}

          {printView === "GENERAL_SCHEDULE" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Pilih Hari:</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
              >
                <option value="ALL">Semua Hari KBM ({availableDays.length} Hari)</option>
                {availableDays.map((d) => (
                  <option key={d} value={d}>
                    Hari {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Print & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Wrapper */}
      <div
        id="scenario-printable-sheet"
        className={`w-full ${isLandscape ? "max-w-6xl" : "max-w-5xl"} bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 print:shadow-none print:p-0 print:max-w-none print:w-full print:rounded-none relative font-sans print:overflow-visible`}
      >
        
        {/* BIG BACKGROUND WATERMARK FOR PRINT & PDF */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none rotate-[-30deg]">
          <span className="text-6xl sm:text-7xl font-black uppercase text-center tracking-widest leading-relaxed">
            DOKUMEN RANCANGAN<br />BUKAN JADWAL OPERASIONAL
          </span>
        </div>

        {/* =========================================================================
            VIEW 1: JADWAL PER ROMBEL (SEMUA HARI KBM)
           ========================================================================= */}
        {printView === "CLASS_SCHEDULE" && (
          <div className="space-y-12">
            {targetClasses.map((cls, classIdx) => {
              const classGrade = toValidGradeLevel(cls.gradeLevel || cls.name);
              const homeroomTeacher = cls.homeroomTeacherName || "-";

              // Check if class has ANY saved schedules in the active scenario
              const classSchedules = schedules.filter((s) => {
                return s.classId === cls.id || isClassMatch(s.classId, cls, classes);
              });
              const hasAnySavedSchedule = classSchedules.length > 0;

              // Identify all days that have saved schedules for this class
              const classDaysWithSchedules = availableDays.filter((d) => {
                const normD = d.toLowerCase();
                return classSchedules.some((s) => normalizeDay(s.day).toLowerCase() === normD);
              });

              // Days to display: all days with saved schedules, or all operational days if none saved yet
              const daysToRender = classDaysWithSchedules.length > 0 ? classDaysWithSchedules : availableDays;

              return (
                <div
                  key={cls.id}
                  className={`space-y-6 ${classIdx < targetClasses.length - 1 ? "print-page-break mb-8 pb-8" : ""}`}
                >
                  {/* Warning Strip */}
                  <div className="border border-amber-400 bg-amber-50/90 rounded-lg p-2 text-center print:border-amber-500">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                      ⚠️ DOKUMEN RANCANGAN JADWAL BAYANGAN — BUKAN JADWAL OPERASIONAL RESMI
                    </span>
                  </div>

                  {/* Letterhead Header */}
                  <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                    <div>
                      <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                        SMP ALKARIM RASYID
                      </h1>
                      <h2 className="text-xs sm:text-sm font-bold text-emerald-800 leading-tight">
                        PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA
                      </h2>
                      <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                        JADWAL BAYANGAN PELAJARAN: KELAS {cls.name} ({classGrade}) — SEMUA HARI KBM
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        Tahun Ajaran: {scenario.academicYearName} • Semester: {scenario.semesterName} • Wali Kelas: {homeroomTeacher} • Total Sesi: {classSchedules.length} JP
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-white mb-0.5">
                        RANCANGAN: {scenario.name}
                      </span>
                      <p className="text-[10px] text-slate-600">
                        Status: <strong>{scenario.status}</strong>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Penyusun: {scenario.createdByName}
                      </p>
                    </div>
                  </div>

                  {/* Empty state check if no schedules exist at all */}
                  {!hasAnySavedSchedule && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-900 text-xs text-center space-y-1">
                      <p className="font-bold">Belum ada jadwal bayangan yang tersimpan untuk Kelas {cls.name} ({classGrade}).</p>
                      <p className="text-[11px] text-amber-700">Slot di bawah menampilkan struktur sesi jam pelajaran default tanpa penugasan mapel.</p>
                    </div>
                  )}

                  {/* FORMAT A: DETAILED PER DAY (Default, highly readable, immune to horizontal clipping) */}
                  {classScheduleFormat === "DETAILED_PER_DAY" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
                      {daysToRender.map((dayName) => {
                        const slots = getResolvedDaySlots(cls, dayName);
                        const filledSlotsCount = slots.filter((sl) => sl.schedule && !sl.isBreak).length;

                        return (
                          <div
                            key={dayName}
                            className="border border-slate-800 rounded-lg overflow-hidden bg-white print-avoid-break flex flex-col"
                          >
                            {/* Day Header Banner */}
                            <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                              <div className="flex items-center gap-1.5 uppercase tracking-wide">
                                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                <span>HARI {dayName}</span>
                              </div>
                              <span className="text-[10px] font-medium text-slate-300">
                                {filledSlotsCount} JP Terisi
                              </span>
                            </div>

                            {/* Day Table */}
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-100 border-b border-slate-800 text-slate-800 text-[11px]">
                                  <th className="py-1 px-1.5 text-center font-bold w-10 border-r border-slate-300">JP</th>
                                  <th className="py-1 px-1.5 text-center font-bold w-24 border-r border-slate-300">Waktu</th>
                                  <th className="py-1 px-2 text-left font-bold border-r border-slate-300">Mata Pelajaran</th>
                                  <th className="py-1 px-2 text-left font-bold">Guru Pengampu</th>
                                </tr>
                              </thead>
                              <tbody>
                                {slots.map((slot) => {
                                  if (slot.isBreak || slot.isRoutine) {
                                    const style = getSharedStyle(slot.title, slot.isBreak);
                                    return (
                                      <tr key={`${slot.title}-${slot.sequence}-${slot.timeRange}`} className={`border-b border-slate-200 ${style.bg}`}>
                                        <td className="py-1 px-1.5 text-center font-mono text-[10px] text-slate-500 border-r border-slate-200">
                                          -
                                        </td>
                                        <td className="py-1 px-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-200">
                                          {slot.timeRange}
                                        </td>
                                        <td
                                          colSpan={2}
                                          className={`py-1 px-2 text-center font-bold text-[10.5px] tracking-wider uppercase ${style.text}`}
                                        >
                                          {slot.title}
                                        </td>
                                      </tr>
                                    );
                                  }

                                  const hasMapel = Boolean(slot.schedule?.subjectName);

                                  return (
                                    <tr
                                      key={slot.sequence}
                                      className={`border-b border-slate-200 ${
                                        hasMapel ? "bg-white" : "bg-slate-50/40"
                                      }`}
                                    >
                                      <td className="py-1 px-1.5 text-center font-bold text-[10.5px] text-slate-800 border-r border-slate-200">
                                        {slot.jpDisplay || slot.sequence}
                                      </td>
                                      <td className="py-1 px-1.5 text-center font-mono text-[10px] text-slate-600 border-r border-slate-200">
                                        {slot.timeRange}
                                      </td>
                                      <td className="py-1 px-2 font-semibold text-[11px] text-slate-900 border-r border-slate-200 leading-tight">
                                        {hasMapel ? (
                                          slot.schedule!.subjectName
                                        ) : (
                                          <span className="text-slate-300 italic font-normal">-</span>
                                        )}
                                      </td>
                                      <td className="py-1 px-2 text-[10.5px] text-emerald-800 font-medium leading-tight">
                                        {hasMapel && slot.schedule!.teacherName ? (
                                          slot.schedule!.teacherName
                                        ) : (
                                          <span className="text-slate-300 italic font-normal">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* FORMAT B: WEEKLY MATRIX (Horizontal 6-Day Cross-Table, suited for Landscape) */}
                  {classScheduleFormat === "WEEKLY_MATRIX" && (
                    <div className="overflow-x-auto print-overflow-visible">
                      <table className="w-full text-xs border-collapse border border-slate-800">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-800 text-slate-900">
                            <th className="border border-slate-800 py-1.5 px-2 text-center w-10 font-bold">JP</th>
                            <th className="border border-slate-800 py-1.5 px-2 text-center w-24 font-bold">Waktu</th>
                            {daysToRender.map((d) => (
                              <th key={d} className="border border-slate-800 py-1.5 px-2 text-center font-bold min-w-[110px]">
                                {d}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPeriods.map((period) => {
                            const isRoutine = period.type === LessonPeriodType.ROUTINE || 
                              /apel|upacara|halaqah|halaqoh|tahfidz|senam|sholat|dhuha/i.test(period.title || "");
                            const isBreak = period.type === LessonPeriodType.BREAK || 
                              Boolean((period as any).isBreak) || 
                              /istirahat|rehat|break/i.test(period.title || "");
                            const isShared = isBreak || isRoutine;
                            const timeRange = formatTimeSlot(period.startTime, period.endTime);
                            const style = getSharedStyle(period.title, isBreak);

                            if (isShared) {
                              return (
                                <tr key={period.id || period.sequence} className={`${style.bg} border-b border-slate-800`}>
                                  <td className="border border-slate-800 py-1 px-2 text-center font-bold text-slate-500">
                                    -
                                  </td>
                                  <td className="border border-slate-800 py-1 px-2 text-center font-mono text-[10.5px] text-slate-600">
                                    {timeRange}
                                  </td>
                                  <td
                                    colSpan={daysToRender.length}
                                    className={`border border-slate-800 py-1 px-2 text-center font-bold uppercase tracking-wider text-[10.5px] ${style.text}`}
                                  >
                                    {period.title || (isBreak ? "ISTIRAHAT" : "AGENDA")}
                                  </td>
                                </tr>
                              );
                            }

                            const jpNumber = (period as any).jpNumber || period.sequence;

                            return (
                              <tr key={period.id || period.sequence} className="border-b border-slate-800">
                                <td className="border border-slate-800 py-1.5 px-2 text-center font-bold text-[11px]">
                                  {jpNumber}
                                </td>
                                <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10px] text-slate-700">
                                  {timeRange}
                                </td>

                                {daysToRender.map((d) => {
                                  const slot = findScheduleSlot(cls, d, period, jpNumber);
                                  return (
                                    <td
                                      key={d}
                                      className={`border border-slate-800 p-1.5 text-center align-middle ${
                                        slot ? "bg-white" : "bg-slate-50/50"
                                      }`}
                                    >
                                      {slot ? (
                                        <div className="space-y-0.5">
                                          <div className="font-bold text-slate-900 leading-tight">
                                            {slot.subjectName}
                                          </div>
                                          <div className="text-[9.5px] text-emerald-800 font-medium leading-tight">
                                            {slot.teacherName || "-"}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className="text-slate-300 italic text-[11px]">-</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Formal 3-Column Signatures */}
                  <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
                    <div>
                      <p className="font-semibold text-slate-700">Wakakur / Tim Kurikulum,</p>
                      <div className="h-16" />
                      <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
                      <div className="h-16" />
                      <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
                      <div className="h-16" />
                      <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================================
            VIEW 2: JADWAL MATA PELAJARAN INDUK (GABUNGAN SEMUA KELAS VII–IX)
            Format Master Timetable:
            | Hari | Waktu | JP | KELAS VII | KELAS VIII | KELAS IX |
            - Kolom Hari dengan vertical rowspan untuk seluruh baris pada hari tersebut
            - Satu tabel master berkelanjutan untuk seluruh hari KBM
            - Tepat satu blok tanda tangan di bagian paling bawah
           ========================================================================= */}
        {printView === "GENERAL_SCHEDULE" && (
          <div className="space-y-4">
            {/* Warning Strip */}
            <div className="border border-amber-400 bg-amber-50/90 rounded-lg p-2 text-center print:border-amber-500">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                ⚠️ DOKUMEN RANCANGAN JADWAL BAYANGAN — BUKAN JADWAL OPERASIONAL RESMI
              </span>
            </div>

            {/* Header: Jadwal Mata Pelajaran Induk */}
            <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
              <div>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                  JADWAL MATA PELAJARAN INDUK
                </h1>
                <h2 className="text-xs sm:text-sm font-bold text-emerald-800 leading-tight mt-0.5">
                  SMP ALKARIM RASYID — PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA
                </h2>
                <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                  TAHUN AJARAN: {scenario.academicYearName} • SEMESTER: {scenario.semesterName}
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-slate-900 text-white mb-0.5">
                  RANCANGAN: {scenario.name}
                </span>
                <p className="text-[10px] text-slate-600">
                  Status: <strong className="text-slate-900 uppercase">{scenario.status}</strong>
                </p>
              </div>
            </div>

            {/* Master Timetable Table */}
            <div className="overflow-x-auto print-overflow-visible">
              <table className="w-full text-[11px] border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-900 text-slate-900">
                    <th className="border border-slate-800 py-2 px-2 text-center w-24 font-extrabold uppercase text-[11px] tracking-wider">
                      Hari
                    </th>
                    <th className="border border-slate-800 py-2 px-2 text-center w-28 font-extrabold uppercase text-[11px] tracking-wider">
                      Waktu
                    </th>
                    <th className="border border-slate-800 py-2 px-1 text-center w-12 font-extrabold uppercase text-[11px] tracking-wider">
                      JP
                    </th>
                    {masterGradeColumns.map((col) => (
                      <th
                        key={col.key}
                        className="border border-slate-800 py-2 px-3 text-center font-extrabold uppercase text-[11px] tracking-wider min-w-[130px]"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {targetDays.map((dayName, dayIndex) => {
                    const dayRows = getMasterDayRows(dayName);
                    const isLastDay = dayIndex === targetDays.length - 1;

                    if (dayRows.length === 0) {
                      return (
                        <tr key={dayName} className="border-b border-slate-800">
                          <td className="border border-slate-800 py-2 px-2 text-center font-bold uppercase text-slate-900 bg-slate-100/70">
                            {dayName}
                          </td>
                          <td
                            colSpan={2 + masterGradeColumns.length}
                            className="border border-slate-800 py-2 px-4 text-center text-slate-400 italic text-xs"
                          >
                            Tidak ada jadwal untuk hari {dayName}
                          </td>
                        </tr>
                      );
                    }

                    return dayRows.map((row, rowIdx) => {
                      const isDayFirstRow = rowIdx === 0;
                      const isDayLastRow = rowIdx === dayRows.length - 1;

                      return (
                        <tr
                          key={`${dayName}-${row.sequence}-${rowIdx}`}
                          className={`border-b ${isDayLastRow && !isLastDay ? "border-b-2 border-slate-900" : "border-slate-800"} ${
                            row.isSharedActivity ? row.sharedStyle.bg : "hover:bg-slate-50/50"
                          }`}
                        >
                          {/* Column 1: Hari (Vertical Rowspan spanning all rows of the day) */}
                          {isDayFirstRow && (
                            <td
                              rowSpan={dayRows.length}
                              className="border border-slate-800 bg-slate-100/90 font-black text-center align-middle uppercase tracking-wider text-xs px-2 text-slate-900 w-24 select-none"
                            >
                              {dayName}
                            </td>
                          )}

                          {/* Column 2: Waktu (Clean dynamic range e.g. 07.00–07.10) */}
                          <td className="border border-slate-800 py-1 px-1.5 text-center font-mono text-[10px] sm:text-[10.5px] text-slate-700 whitespace-nowrap">
                            {row.timeRange}
                          </td>

                          {/* Column 3: JP (Lesson Period number or '-' for shared routines/breaks) */}
                          <td className="border border-slate-800 py-1 px-1 text-center font-bold text-[11px] text-slate-800">
                            {row.jpDisplay}
                          </td>

                          {/* Columns 4..N: Classes or Horizontal Merged Shared Activity */}
                          {row.isSharedActivity ? (
                            <td
                              colSpan={masterGradeColumns.length}
                              className={`border border-slate-800 py-1.5 px-3 text-center font-bold uppercase tracking-wider text-[11px] ${row.sharedStyle.text}`}
                            >
                              {row.title}
                            </td>
                          ) : (
                            masterGradeColumns.map((col) => {
                              const slot = row.slots[col.key];
                              return (
                                <td
                                  key={col.key}
                                  className={`border border-slate-800 p-1.5 text-center align-middle ${
                                    slot ? "bg-white" : "bg-slate-50/30"
                                  }`}
                                >
                                  {slot ? (
                                    <div className="space-y-0.5">
                                      <div className="font-bold text-slate-900 text-[11px] leading-tight">
                                        {slot.subjectName}
                                      </div>
                                      <div className="text-[9.5px] text-emerald-800 font-medium leading-tight">
                                        {slot.teacherName || "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 italic text-[11px]">-</span>
                                  )}
                                </td>
                              );
                            })
                          )}
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>

            {/* Single Master Signature Block at bottom of timetable */}
            <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
              <div>
                <p className="font-semibold text-slate-700">Wakakur / Tim Kurikulum,</p>
                <div className="h-16" />
                <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
                <div className="h-16" />
                <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
                <div className="h-16" />
                <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: STRUKTUR KURIKULUM & DISTRIBUSI ALOKASI JP
            Group A: Mata Pelajaran Umum (Group A / C)
            Group B: Mata Pelajaran Pesantren (Group B)
            Desain hemat halaman: muat 1 halaman A4 portrait secara efisien & profesional
           ========================================================================= */}
        {printView === "CURRICULUM_MATRIX" && (
          <div className="space-y-3 print-avoid-break">
            {/* Warning Strip */}
            <div className="border border-amber-400 bg-amber-50/90 rounded-md py-1 px-3 text-center print:border-amber-500">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                ⚠️ DOKUMEN RANCANGAN STRUKTUR KURIKULUM & ALOKASI JP — BUKAN JADWAL OPERASIONAL RESMI
              </span>
            </div>

            {/* Letterhead Header */}
            <div className="border-b-2 border-slate-900 pb-2 flex items-start justify-between">
              <div>
                <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                  SMP ALKARIM RASYID
                </h1>
                <h2 className="text-xs sm:text-sm font-bold text-emerald-800 leading-tight">
                  PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA
                </h2>
                <p className="text-xs font-bold text-slate-800 mt-0.5 uppercase">
                  STRUKTUR KURIKULUM & DISTRIBUSI ALOKASI JP (SIMULASI PERENCANAAN)
                </p>
                <p className="text-[10.5px] text-slate-600 mt-0.5">
                  Tahun Ajaran: {scenario.academicYearName} • Semester: {scenario.semesterName} • Beban KBM: VII ({grandTotal.vii} JP) • VIII ({grandTotal.viii} JP) • IX ({grandTotal.ix} JP)
                </p>
              </div>

              <div className="text-right">
                <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-white mb-0.5">
                  RANCANGAN: {scenario.name}
                </span>
                <p className="text-[10px] text-slate-600">
                  Status: <strong>{scenario.status}</strong>
                </p>
                <p className="text-[10px] text-slate-500">
                  Penyusun: {scenario.createdByName}
                </p>
              </div>
            </div>

            {/* Compact Scenario Overview & Summary Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900">Rancangan:</span>
                <span className="text-slate-700">{scenario.name}</span>
                {scenario.description && (
                  <span className="text-slate-500 italic text-[11px]">({scenario.description})</span>
                )}
              </div>
              <div className="flex items-center gap-2 font-bold text-[10.5px]">
                <span className="text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Umum: {subtotalUmum.vii + subtotalUmum.viii + subtotalUmum.ix} JP
                </span>
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Pesantren: {subtotalPesantren.vii + subtotalPesantren.viii + subtotalPesantren.ix} JP
                </span>
                <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  Total: {grandTotal.total} JP / pekan
                </span>
              </div>
            </div>

            {/* Unified Partitioned Curriculum Matrix Table */}
            <div className="overflow-x-auto print-overflow-visible">
              <table className="w-full text-xs border-collapse border border-slate-700">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-700 text-slate-900 text-[10.5px]">
                    <th className="border border-slate-700 py-1 px-1.5 text-center w-8 font-bold">No</th>
                    <th className="border border-slate-700 py-1 px-2 text-left font-bold">Mata Pelajaran</th>
                    <th className="border border-slate-700 py-1 px-1.5 text-center w-10 font-bold">Kel.</th>
                    <th className="border border-slate-700 py-1 px-1.5 text-center w-12 font-bold">VII</th>
                    <th className="border border-slate-700 py-1 px-1.5 text-center w-12 font-bold">VIII</th>
                    <th className="border border-slate-700 py-1 px-1.5 text-center w-12 font-bold">IX</th>
                    <th className="border border-slate-700 py-1 px-1.5 text-center w-14 font-bold">Total</th>
                    <th className="border border-slate-700 py-1 px-2 text-left font-bold">Guru Pengampu / Status</th>
                  </tr>
                </thead>
                <tbody>
                  {/* =================================================================
                      SECTION A: STRUKTUR KURIKULUM MATA PELAJARAN UMUM
                     ================================================================= */}
                  <tr className="bg-slate-800 text-white font-bold border-y border-slate-800">
                    <td colSpan={8} className="py-1 px-2 text-[11px] uppercase tracking-wider">
                      A. STRUKTUR KURIKULUM MATA PELAJARAN UMUM ({umumCurriculums.length} Mapel)
                    </td>
                  </tr>

                  {umumCurriculums.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-300 py-2 text-center text-slate-400 italic">
                        Tidak ada mata pelajaran Umum pada rancangan ini.
                      </td>
                    </tr>
                  ) : (
                    umumCurriculums.map((item, idx) => {
                      const totalItem = (item.jp_vii || 0) + (item.jp_viii || 0) + (item.jp_ix || 0);
                      const isZeroJp = totalItem === 0;

                      let teacherDisplay: React.ReactNode = "-";
                      if (item.useDifferentTeachers) {
                        teacherDisplay = (
                          <span className="text-[9.5px] leading-tight">
                            VII: {item.teacherName_vii || "-"} | VIII: {item.teacherName_viii || "-"} | IX: {item.teacherName_ix || "-"}
                          </span>
                        );
                      } else if (item.teacherName) {
                        teacherDisplay = item.teacherName;
                      }

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-300 text-[10.5px] ${
                            !item.isActiveInScenario
                              ? "opacity-50 line-through bg-slate-50/70"
                              : isZeroJp
                              ? "bg-slate-50/40"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center font-bold text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-2 font-semibold text-slate-900">
                            {item.subjectName}
                            {item.isCustomSubject && (
                              <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                Mapel Baru
                              </span>
                            )}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center font-bold text-blue-800">
                            {item.subjectGroup || "A"}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center">{item.jp_vii ?? 0}</td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center">{item.jp_viii ?? 0}</td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center">{item.jp_ix ?? 0}</td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center font-bold text-slate-900 bg-slate-50/60">
                            {totalItem}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-2 text-[10px] text-slate-700 truncate max-w-[200px]">
                            {!item.isActiveInScenario ? (
                              <span className="text-slate-400 italic">Dinonaktifkan</span>
                            ) : (
                              teacherDisplay
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* SUBTOTAL UMUM */}
                  <tr className="bg-slate-100 font-bold border-t border-b border-slate-700 text-[10.5px]">
                    <td colSpan={3} className="border border-slate-400 py-1 px-2 text-right text-slate-800">
                      Subtotal JP Mapel Umum:
                    </td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center text-slate-900">{subtotalUmum.vii}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center text-slate-900">{subtotalUmum.viii}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center text-slate-900">{subtotalUmum.ix}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center font-black text-slate-900 bg-slate-200/50">
                      {subtotalUmum.vii + subtotalUmum.viii + subtotalUmum.ix}
                    </td>
                    <td className="border border-slate-400 py-1 px-2 text-[10px] text-slate-500 font-normal italic">
                      Subtotal Alokasi KBM Umum
                    </td>
                  </tr>

                  {/* =================================================================
                      SECTION B: STRUKTUR KURIKULUM MATA PELAJARAN PESANTREN
                     ================================================================= */}
                  <tr className="bg-slate-800 text-white font-bold border-y border-slate-800">
                    <td colSpan={8} className="py-1 px-2 text-[11px] uppercase tracking-wider">
                      B. STRUKTUR KURIKULUM MATA PELAJARAN PESANTREN ({pesantrenCurriculums.length} Mapel)
                    </td>
                  </tr>

                  {pesantrenCurriculums.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-300 py-2 text-center text-slate-400 italic">
                        Tidak ada mata pelajaran Pesantren pada rancangan ini.
                      </td>
                    </tr>
                  ) : (
                    pesantrenCurriculums.map((item, idx) => {
                      const totalItem = (item.jp_vii || 0) + (item.jp_viii || 0) + (item.jp_ix || 0);
                      const isZeroJp = totalItem === 0;

                      let teacherDisplay: React.ReactNode = "-";
                      if (item.useDifferentTeachers) {
                        teacherDisplay = (
                          <span className="text-[9.5px] leading-tight">
                            VII: {item.teacherName_vii || "-"} | VIII: {item.teacherName_viii || "-"} | IX: {item.teacherName_ix || "-"}
                          </span>
                        );
                      } else if (item.teacherName) {
                        teacherDisplay = item.teacherName;
                      }

                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-slate-300 text-[10.5px] ${
                            !item.isActiveInScenario
                              ? "opacity-50 line-through bg-slate-50/70"
                              : isZeroJp
                              ? "bg-slate-50/40"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center font-bold text-slate-700">
                            {idx + 1}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-2 font-semibold text-slate-900">
                            {item.subjectName}
                            {item.isCustomSubject && (
                              <span className="ml-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                                Mapel Baru
                              </span>
                            )}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center font-bold text-amber-800">
                            {item.subjectGroup || "B"}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center">{item.jp_vii ?? 0}</td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center">{item.jp_viii ?? 0}</td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center">{item.jp_ix ?? 0}</td>
                          <td className="border border-slate-300 py-0.5 px-1.5 text-center font-bold text-slate-900 bg-slate-50/60">
                            {totalItem}
                          </td>
                          <td className="border border-slate-300 py-0.5 px-2 text-[10px] text-slate-700 truncate max-w-[200px]">
                            {!item.isActiveInScenario ? (
                              <span className="text-slate-400 italic">Dinonaktifkan</span>
                            ) : (
                              teacherDisplay
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* SUBTOTAL PESANTREN */}
                  <tr className="bg-slate-100 font-bold border-t border-b border-slate-700 text-[10.5px]">
                    <td colSpan={3} className="border border-slate-400 py-1 px-2 text-right text-slate-800">
                      Subtotal JP Mapel Pesantren:
                    </td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center text-slate-900">{subtotalPesantren.vii}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center text-slate-900">{subtotalPesantren.viii}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center text-slate-900">{subtotalPesantren.ix}</td>
                    <td className="border border-slate-400 py-1 px-1.5 text-center font-black text-slate-900 bg-slate-200/50">
                      {subtotalPesantren.vii + subtotalPesantren.viii + subtotalPesantren.ix}
                    </td>
                    <td className="border border-slate-400 py-1 px-2 text-[10px] text-slate-500 font-normal italic">
                      Subtotal Alokasi KBM Diniyah
                    </td>
                  </tr>

                  {/* GRAND TOTAL (A + B) */}
                  <tr className="bg-slate-200/95 font-black border-t-2 border-slate-900 text-slate-900 text-[11px]">
                    <td colSpan={3} className="border border-slate-600 py-1.5 px-2 text-right uppercase">
                      TOTAL ALOKASI JP KESELURUHAN (A + B):
                    </td>
                    <td className="border border-slate-600 py-1.5 px-1.5 text-center">{grandTotal.vii}</td>
                    <td className="border border-slate-600 py-1.5 px-1.5 text-center">{grandTotal.viii}</td>
                    <td className="border border-slate-600 py-1.5 px-1.5 text-center">{grandTotal.ix}</td>
                    <td className="border border-slate-600 py-1.5 px-1.5 text-center font-extrabold text-emerald-900 bg-emerald-100/60">
                      {grandTotal.total}
                    </td>
                    <td className="border border-slate-600 py-1.5 px-2 text-[10px] font-bold text-emerald-800">
                      JP / Pekan Terpenuhi
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Validation & Conflict Notes (Compact) */}
            <div className="text-[10.5px]">
              {conflicts.length === 0 ? (
                <div className="text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>Validasi Analisis: Distribusi JP terpenuhi sesuai rancangan tanpa tabrakan guru/rombel.</span>
                </div>
              ) : (
                <div className="p-1.5 border border-amber-200 bg-amber-50/80 text-amber-900 rounded space-y-0.5">
                  <span className="font-bold">Catatan Analisis ({conflicts.length} catatan konflik):</span>
                  {conflicts.slice(0, 2).map((cf, idx) => (
                    <div key={idx} className="text-[10px] text-amber-800 truncate">
                      • {cf.title}: {cf.description}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signature Box (Compact for 1-Page Fit) */}
            <div className="pt-3 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-[11px] print-avoid-break">
              <div>
                <p className="font-semibold text-slate-700">Wakakur / Tim Kurikulum,</p>
                <div className="h-10 sm:h-12" />
                <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
                <div className="h-10 sm:h-12" />
                <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
                <div className="h-10 sm:h-12" />
                <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
