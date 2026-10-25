import { 
  ScenarioSchedule, 
  ScenarioCurriculumMatrix, 
  Class,
  LessonPeriod
} from "../types";
import { isClassMatch } from "./gradeLevelHelper";
import { toValidGradeLevel, safeNormalizeGrade } from "../services/scenario.service";

/**
 * Deduplicates schedule records for a class, day, and sequence.
 * Guarantees that no duplicate Firestore records for the same slot key
 * are double-counted or linger in memory.
 */
export function deduplicateSchedules(schedules: ScenarioSchedule[]): ScenarioSchedule[] {
  const map = new Map<string, ScenarioSchedule>();
  for (const s of schedules) {
    if (!s.classId || !s.day || s.sequence === undefined || s.sequence === null) {
      map.set(s.id || `sch_${Math.random()}`, s);
      continue;
    }
    const key = `${(s.classId || "").trim().toLowerCase()}__${(s.day || "").trim().toLowerCase()}__${s.sequence}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
    } else {
      // Prioritize active subject assignment over empty slot
      const existingHasSubject = Boolean(
        existing.subjectId &&
        existing.subjectName &&
        existing.subjectName !== "Kosong" &&
        existing.subjectName !== "Belum Ditugaskan"
      );
      const currentHasSubject = Boolean(
        s.subjectId &&
        s.subjectName &&
        s.subjectName !== "Kosong" &&
        s.subjectName !== "Belum Ditugaskan"
      );

      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
      const currentTime = new Date(s.updatedAt || s.createdAt || 0).getTime();

      if (currentHasSubject && !existingHasSubject) {
        map.set(key, s);
      } else if (!currentHasSubject && existingHasSubject) {
        // Keep existing active assignment
      } else if (currentTime >= existingTime) {
        map.set(key, s);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Calculates the JP count represented by a schedule slot.
 * Handles single JP, explicit jpCount, ranged titles (e.g. "JP 1-2", "1–2"),
 * explicit duration/JP titles (e.g. "2 JP"), and LessonPeriod duration.
 */
export function getScheduleSlotJpCount(
  slot?: { jp?: string; sequence?: number; jpCount?: number; lessonPeriodId?: string; day?: string; duration?: number } | null,
  periods?: LessonPeriod[]
): number {
  if (!slot) return 1;

  // 1. Explicit numeric jpCount on schedule
  if (typeof (slot as any).jpCount === "number" && (slot as any).jpCount > 0) {
    return (slot as any).jpCount;
  }

  // Helper to extract JP from text string (e.g. "JP 1-2", "1–2", "2 JP", "JP 3-4")
  const parseTextJp = (text?: string): number | null => {
    if (!text) return null;
    // Ranged JP: "JP 1-2", "1 - 2", "1–2"
    const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return Math.max(1, end - start + 1);
      }
    }
    // Explicit count: "2 JP", "3JP", "2 Jam Pelajaran", "2 Jam"
    const countMatch = text.match(/(\d+)\s*(?:JP|Jam)/i);
    if (countMatch) {
      const count = parseInt(countMatch[1], 10);
      if (!isNaN(count) && count > 0) {
        return count;
      }
    }
    return null;
  };

  // 2. Check slot.jp string
  const parsedFromSlotJp = parseTextJp(slot.jp);
  if (parsedFromSlotJp !== null) {
    return parsedFromSlotJp;
  }

  // 3. Check explicit slot duration in minutes (standard JP is 40-45 minutes)
  const slotDuration = typeof slot.duration === "number" ? slot.duration : (slot as any).durationMinutes;
  if (typeof slotDuration === "number" && slotDuration >= 70) {
    return Math.max(1, Math.round(slotDuration / 40));
  }

  // 4. Check corresponding LessonPeriod if periods provided
  if (periods && periods.length > 0) {
    const matchedPeriod = periods.find((p) => {
      if (slot.lessonPeriodId && p.id && slot.lessonPeriodId === p.id) return true;
      if (
        slot.day &&
        slot.sequence !== undefined &&
        p.day.toLowerCase() === slot.day.toLowerCase() &&
        p.sequence === slot.sequence
      ) {
        return true;
      }
      return false;
    });

    if (matchedPeriod) {
      const parsedFromPeriodTitle = parseTextJp(matchedPeriod.title);
      if (parsedFromPeriodTitle !== null) {
        return parsedFromPeriodTitle;
      }
      if (typeof matchedPeriod.duration === "number" && matchedPeriod.duration >= 70) {
        return Math.max(1, Math.round(matchedPeriod.duration / 40));
      }
    }
  }

  return 1;
}

/**
 * Robust matcher between a schedule slot and a scenario curriculum item.
 * Strictly guarantees that any slot with empty subject, "Kosong", or "Belum Ditugaskan"
 * is NEVER matched to any curriculum.
 * Prioritizes stable ID matching (subjectId, doc id, originalCurriculumId).
 * Only falls back to exact normalized name when slot has no subjectId (legacy data),
 * strictly preventing confusion between subjects with similar names.
 */
export function isSlotMatchingCurriculum(
  slot: { subjectId?: string; subjectName?: string } | null | undefined,
  cur: { id?: string; subjectId?: string; originalCurriculumId?: string; subjectName?: string } | null | undefined
): boolean {
  if (!slot || !cur) return false;

  const slotSubName = slot.subjectName?.trim() || "";
  const slotSubId = slot.subjectId?.trim() || "";

  // 1. Any slot that is marked as empty or unassigned MUST be ignored
  if (
    !slotSubId ||
    slotSubId.toLowerCase() === "kosong" ||
    slotSubId.toLowerCase() === "belum ditugaskan" ||
    !slotSubName ||
    slotSubName.toLowerCase() === "kosong" ||
    slotSubName.toLowerCase() === "belum ditugaskan"
  ) {
    return false;
  }

  const curSubId = cur.subjectId?.trim();
  const curDocId = cur.id?.trim();
  const curOrigId = cur.originalCurriculumId?.trim();

  // 2. Stable ID check (primary & authoritative)
  if (slotSubId) {
    if (curSubId && slotSubId === curSubId) return true;
    if (curDocId && slotSubId === curDocId) return true;
    if (curOrigId && slotSubId === curOrigId) return true;
    // If the slot has a specific subjectId and it did NOT match any of cur's IDs,
    // do NOT fall back to fuzzy/name match to prevent collision of similar subjects.
    return false;
  }

  // 3. Exact Case-Insensitive Name Match Fallback ONLY when slot.subjectId is missing (legacy)
  if (slotSubName && cur.subjectName) {
    return slotSubName.toLowerCase() === cur.subjectName.trim().toLowerCase();
  }

  return false;
}

/**
 * Returns the allocated JP for a specific grade level ("VII" | "VIII" | "IX")
 * from the Shadow Curriculum Matrix.
 * Handles multiple case variations (jp_viii, jp_VIII, jpViii, jp_8), string conversions,
 * and safe grade level normalization.
 */
export function getCurriculumJpForGrade(
  cur: ScenarioCurriculumMatrix | any,
  grade: "VII" | "VIII" | "IX" | string
): number {
  if (!cur) return 0;
  const normGrade = safeNormalizeGrade(grade) || "VII";
  if (normGrade === "VII") {
    const val = cur.jp_vii ?? cur.jp_VII ?? cur.jpVii ?? cur.jp_7 ?? cur.jp7;
    return typeof val === "number" ? val : Number(val) || 0;
  }
  if (normGrade === "VIII") {
    const val = cur.jp_viii ?? cur.jp_VIII ?? cur.jpViii ?? cur.jp_8 ?? cur.jp8;
    return typeof val === "number" ? val : Number(val) || 0;
  }
  if (normGrade === "IX") {
    const val = cur.jp_ix ?? cur.jp_IX ?? cur.jpIx ?? cur.jp_9 ?? cur.jp9;
    return typeof val === "number" ? val : Number(val) || 0;
  }
  return 0;
}

export interface AvailableSubjectOption {
  curriculumId: string;
  subjectId: string;
  subjectName: string;
  subjectGroup?: string;
  category: "Umum" | "Kepesantrenan" | "Khusus";
  isCustomSubject?: boolean;
  allocatedJp: number;
  scheduledJpInOtherSlots: number;
  totalScheduledInClass: number;
  remainingJp: number;
  isCurrentlyInSlot: boolean;
  isOverAllocated: boolean;
  label: string;
}

/**
 * Calculates available subjects for a specific slot being edited in Jadwal Bayangan.
 * 
 * Rules applied:
 * - Based strictly on Shadow Curriculum Matrix (Struktur Kurikulum Bayangan).
 * - Excludes the slot being edited from already placed JP so current subject or replacements
 *   can be evaluated without counting the active slot against quota.
 * - Subjects with allocated JP <= 0 or invalid are not offered (unless already in slot).
 * - If remaining JP > 0: subject is offered with clear "sisa X JP (target Y JP)".
 * - If remaining JP === 0: subject is hidden from options (unless currently in slot).
 * - Isolated per class and grade level (VII, VIII, IX).
 * - Categorizes subjects into Umum (A/C) and Kepesantrenan (B) with robust grade level detection.
 */
export function calculateAvailableSubjectsForSlot(params: {
  curriculums: ScenarioCurriculumMatrix[];
  schedules: ScenarioSchedule[];
  classes: Class[];
  periods?: LessonPeriod[];
  targetClassId: string;
  targetClassName: string;
  currentSlot: {
    slotId?: string;
    day: string;
    sequence: number;
    subjectId?: string;
    subjectName?: string;
    jp?: string;
    gradeLevel?: string;
  };
}): AvailableSubjectOption[] {
  const {
    curriculums,
    schedules,
    classes,
    periods,
    targetClassId,
    targetClassName,
    currentSlot
  } = params;

  // 1. Identify target class & grade level with comprehensive multi-criteria lookup
  const targetClass = classes.find(
    (c) =>
      c.id === targetClassId ||
      c.classId === targetClassId ||
      isClassMatch(c.id, targetClassId, classes) ||
      (targetClassName && c.name && c.name.toLowerCase().trim() === targetClassName.toLowerCase().trim())
  );

  const rawGradeCandidate =
    currentSlot.gradeLevel ||
    targetClass?.gradeLevel ||
    targetClass?.name ||
    targetClassName ||
    targetClassId;

  const targetGrade = toValidGradeLevel(rawGradeCandidate, "VII");

  // 2. Identify all existing schedules for this specific class and deduplicate them
  const rawClassSchedules = schedules.filter((s) =>
    isClassMatch(s.classId, targetClassId, classes)
  );
  const classSchedules = deduplicateSchedules(rawClassSchedules);

  // 3. Exclude the slot currently being edited
  const otherClassSchedules = classSchedules.filter((s) => {
    if (currentSlot.slotId && s.id === currentSlot.slotId) return false;
    if (
      s.day.toLowerCase() === currentSlot.day.toLowerCase() &&
      s.sequence === currentSlot.sequence
    ) {
      return false;
    }
    return true;
  });

  const options: AvailableSubjectOption[] = [];

  // 4. Iterate over active curriculum subjects
  const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);

  for (const cur of activeCurriculums) {
    const allocatedJp = getCurriculumJpForGrade(cur, targetGrade);
    const isCurrentlyInSlot = isSlotMatchingCurriculum(currentSlot, cur);

    // Rule: Mapel dengan alokasi 0 JP atau alokasi yang tidak valid tidak boleh
    // ditawarkan untuk dimasukkan ke slot (kecuali slot ini memang sudah berisi mapel itu sebelumnya).
    if (allocatedJp <= 0 && !isCurrentlyInSlot) {
      continue;
    }

    // Calculate total JP already scheduled for this subject in other slots of this class
    const scheduledJpInOtherSlots = otherClassSchedules
      .filter((s) => isSlotMatchingCurriculum(s, cur))
      .reduce((sum, s) => sum + getScheduleSlotJpCount(s, periods), 0);

    const remainingJp = allocatedJp - scheduledJpInOtherSlots;
    const currentSlotJp = isCurrentlyInSlot ? getScheduleSlotJpCount(currentSlot, periods) : 0;
    const totalScheduledInClass = scheduledJpInOtherSlots + currentSlotJp;
    const isOverAllocated = totalScheduledInClass > allocatedJp;

    // Rule: Jika sisa JP sudah 0, mapel tidak ditampilkan lagi dalam daftar pilihan.
    // Namun jika mapel tersebut adalah mapel yang sedang ada di slot ini, tetap tampilkan agar
    // pengguna dapat melihat dan mempertahankannya / menukarnya dengan jelas.
    if (remainingJp <= 0 && !isCurrentlyInSlot) {
      continue;
    }

    // Category determination: Group B is Kepesantrenan, A/C is Umum, isCustomSubject is Khusus
    const category: "Umum" | "Kepesantrenan" | "Khusus" = cur.isCustomSubject
      ? "Khusus"
      : cur.subjectGroup === "B"
      ? "Kepesantrenan"
      : "Umum";

    // Transparent and unambiguous label formatting
    const categoryTag = cur.isCustomSubject
      ? "Mapel Baru"
      : cur.subjectGroup === "B"
      ? "Kel. B - Pesantren"
      : `Kel. ${cur.subjectGroup || "A"} - Umum`;

    let label = `${cur.subjectName} (${categoryTag})`;

    if (remainingJp > 0) {
      if (scheduledJpInOtherSlots === 0) {
        label += ` — sisa ${remainingJp} JP (Belum Terjadwal / Alokasi ${allocatedJp} JP)`;
      } else {
        label += ` — sisa ${remainingJp} JP (Terjadwal ${scheduledJpInOtherSlots} dari ${allocatedJp} JP)`;
      }
    } else if (remainingJp === 0) {
      label += ` — alokasi penuh (${allocatedJp} JP Terjadwal)`;
    } else {
      label += ` — alokasi berlebih (+${Math.abs(remainingJp)} JP dari Target ${allocatedJp} JP)`;
    }

    options.push({
      curriculumId: cur.id,
      subjectId: cur.subjectId || cur.id,
      subjectName: cur.subjectName,
      subjectGroup: cur.subjectGroup,
      category,
      isCustomSubject: cur.isCustomSubject,
      allocatedJp,
      scheduledJpInOtherSlots,
      totalScheduledInClass,
      remainingJp,
      isCurrentlyInSlot,
      isOverAllocated,
      label
    });
  }

  // Sort options: available remaining JP first, then by category (Umum then Kepesantrenan then Khusus), then alphabetically
  return options.sort((a, b) => {
    // If one has remaining JP and another doesn't
    if (a.remainingJp > 0 && b.remainingJp <= 0) return -1;
    if (a.remainingJp <= 0 && b.remainingJp > 0) return 1;

    // Group order: Umum (0), Kepesantrenan (1), Khusus (2)
    const catOrder: Record<string, number> = { Umum: 0, Kepesantrenan: 1, Khusus: 2 };
    const orderDiff = (catOrder[a.category] ?? 0) - (catOrder[b.category] ?? 0);
    if (orderDiff !== 0) return orderDiff;

    return a.subjectName.localeCompare(b.subjectName, "id");
  });
}
