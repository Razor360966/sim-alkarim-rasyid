import { 
  ScenarioSchedule, 
  ScenarioCurriculumMatrix, 
  Class 
} from "../types";
import { isClassMatch } from "./gradeLevelHelper";
import { toValidGradeLevel } from "../services/scenario.service";

/**
 * Calculates the JP count represented by a schedule slot.
 * Handles single JP, explicit jpCount, and ranged titles like "JP 1-2", "1–2", etc.
 */
export function getScheduleSlotJpCount(
  slot?: { jp?: string; sequence?: number; jpCount?: number } | null
): number {
  if (!slot) return 1;
  if (typeof (slot as any).jpCount === "number" && (slot as any).jpCount > 0) {
    return (slot as any).jpCount;
  }
  if (slot.jp) {
    const match = slot.jp.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = parseInt(match[2], 10);
      if (!isNaN(start) && !isNaN(end) && end >= start) {
        return Math.max(1, end - start + 1);
      }
    }
  }
  return 1;
}

/**
 * Robust matcher between a schedule slot and a scenario curriculum item.
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
  // Empty or unassigned slots do not match any curriculum
  if (!slot.subjectId && (!slotSubName || slotSubName === "Kosong" || slotSubName === "Belum Ditugaskan")) {
    return false;
  }

  const slotSubId = slot.subjectId?.trim();
  const curSubId = cur.subjectId?.trim();
  const curDocId = cur.id?.trim();
  const curOrigId = cur.originalCurriculumId?.trim();

  // 1. Stable ID check (primary & authoritative)
  if (slotSubId) {
    if (curSubId && slotSubId === curSubId) return true;
    if (curDocId && slotSubId === curDocId) return true;
    if (curOrigId && slotSubId === curOrigId) return true;
    // If the slot has a specific subjectId and it did NOT match any of cur's IDs,
    // do NOT fall back to fuzzy/name match to prevent collision of similar subjects.
    return false;
  }

  // 2. Exact Case-Insensitive Name Match Fallback ONLY when slot.subjectId is missing (legacy)
  if (slotSubName && cur.subjectName) {
    return slotSubName.toLowerCase() === cur.subjectName.trim().toLowerCase();
  }

  return false;
}

/**
 * Returns the allocated JP for a specific grade level ("VII" | "VIII" | "IX")
 * from the Shadow Curriculum Matrix.
 */
export function getCurriculumJpForGrade(
  cur: ScenarioCurriculumMatrix,
  grade: "VII" | "VIII" | "IX"
): number {
  if (grade === "VII") return Number(cur.jp_vii) || 0;
  if (grade === "VIII") return Number(cur.jp_viii) || 0;
  if (grade === "IX") return Number(cur.jp_ix) || 0;
  return 0;
}

export interface AvailableSubjectOption {
  curriculumId: string;
  subjectId: string;
  subjectName: string;
  subjectGroup?: string;
  isCustomSubject?: boolean;
  allocatedJp: number;
  scheduledJpInOtherSlots: number;
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
 * - If remaining JP > 0: subject is offered with "sisa X JP".
 * - If remaining JP === 0: subject is hidden from options (unless currently in slot).
 * - Isolated per class and grade level (VII, VIII, IX).
 */
export function calculateAvailableSubjectsForSlot(params: {
  curriculums: ScenarioCurriculumMatrix[];
  schedules: ScenarioSchedule[];
  classes: Class[];
  targetClassId: string;
  targetClassName: string;
  currentSlot: {
    slotId?: string;
    day: string;
    sequence: number;
    subjectId?: string;
    subjectName?: string;
    jp?: string;
  };
}): AvailableSubjectOption[] {
  const {
    curriculums,
    schedules,
    classes,
    targetClassId,
    targetClassName,
    currentSlot
  } = params;

  // 1. Identify target class & grade level
  const targetClass = classes.find((c) => isClassMatch(c.id, targetClassId, classes));
  const targetGrade = toValidGradeLevel(
    targetClass?.gradeLevel || targetClass?.name || targetClassName
  );

  // 2. Identify all existing schedules for this specific class
  const classSchedules = schedules.filter((s) =>
    isClassMatch(s.classId, targetClassId, classes)
  );

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
      .reduce((sum, s) => sum + getScheduleSlotJpCount(s), 0);

    const remainingJp = allocatedJp - scheduledJpInOtherSlots;
    const totalWithCurrent = scheduledJpInOtherSlots + (isCurrentlyInSlot ? getScheduleSlotJpCount(currentSlot) : 0);
    const isOverAllocated = totalWithCurrent > allocatedJp;

    // Rule: Jika sisa JP sudah 0, mapel tidak ditampilkan lagi dalam daftar pilihan.
    // Namun jika mapel tersebut adalah mapel yang sedang ada di slot ini, tetap tampilkan agar
    // pengguna dapat melihat dan mempertahankannya / menukarnya dengan jelas.
    if (remainingJp <= 0 && !isCurrentlyInSlot) {
      continue;
    }

    // Label formatting:
    let label = `${cur.subjectName}`;
    if (cur.isCustomSubject) {
      label += " (Mapel Baru)";
    } else if (cur.subjectGroup) {
      label += ` (Kel. ${cur.subjectGroup})`;
    }

    if (remainingJp > 0) {
      label += ` — sisa ${remainingJp} JP`;
    } else if (remainingJp === 0) {
      label += ` — alokasi penuh (0 JP tersisa)`;
    } else {
      label += ` — alokasi berlebih (+${Math.abs(remainingJp)} JP)`;
    }

    options.push({
      curriculumId: cur.id,
      subjectId: cur.subjectId || cur.id,
      subjectName: cur.subjectName,
      subjectGroup: cur.subjectGroup,
      isCustomSubject: cur.isCustomSubject,
      allocatedJp,
      scheduledJpInOtherSlots,
      remainingJp,
      isCurrentlyInSlot,
      isOverAllocated,
      label
    });
  }

  // Sort options: available remaining JP first, then alphabetically by subject name
  return options.sort((a, b) => {
    // If one has remaining JP and another doesn't
    if (a.remainingJp > 0 && b.remainingJp <= 0) return -1;
    if (a.remainingJp <= 0 && b.remainingJp > 0) return 1;
    return a.subjectName.localeCompare(b.subjectName, "id");
  });
}
