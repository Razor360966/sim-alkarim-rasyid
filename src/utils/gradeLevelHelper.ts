/**
 * Centralized Grade Level & Class Identifier Helpers
 * Standardized across Auto Scheduler, ScheduleHelper, and Validation Diagnostics.
 */

export type ValidGradeLevel = "VII" | "VIII" | "IX";
export type NormalizedGradeLevel = ValidGradeLevel | "INVALID_GRADE_LEVEL";

/**
 * Safely normalize grade levels:
 * - "VII", "7", "vii", "kelas 7", "kelas vii" -> "VII"
 * - "VIII", "8", "viii", "kelas 8", "kelas viii" -> "VIII"
 * - "IX", "9", "ix", "kelas 9", "kelas ix" -> "IX"
 * 
 * CRITICAL: Never silently fall back to "IX" or any default.
 * If grade level cannot be determined, returns "INVALID_GRADE_LEVEL".
 */
export function normalizeGradeLevel(grade?: string | number | null): NormalizedGradeLevel {
  if (grade === null || grade === undefined) return "INVALID_GRADE_LEVEL";
  const s = String(grade).trim().toUpperCase();
  if (!s) return "INVALID_GRADE_LEVEL";

  // Exact standard strings
  if (s === "VII" || s === "7" || s === "KELAS 7" || s === "KELAS VII") return "VII";
  if (s === "VIII" || s === "8" || s === "KELAS 8" || s === "KELAS VIII") return "VIII";
  if (s === "IX" || s === "9" || s === "KELAS 9" || s === "KELAS IX") return "IX";

  // Check VIII before VII because "VIII" contains substring "VII"
  if (/\bVIII\b/.test(s) || /\b8\b/.test(s)) return "VIII";
  if (/\bVII\b/.test(s) || /\b7\b/.test(s)) return "VII";
  if (/\bIX\b/.test(s) || /\b9\b/.test(s)) return "IX";

  // Substring fallback with careful ordering
  if (s.includes("VIII") || s.includes("8")) return "VIII";
  if (s.includes("VII") || s.includes("7")) return "VII";
  if (s.includes("IX") || s.includes("9")) return "IX";

  return "INVALID_GRADE_LEVEL";
}

export function isValidGradeLevel(grade?: string | number | null): grade is ValidGradeLevel {
  return normalizeGradeLevel(grade) !== "INVALID_GRADE_LEVEL";
}

/**
 * Extract Target JP from CurriculumMatrix based on class grade level.
 * Never defaults to jp_ix when grade level is unknown.
 */
export function getTargetJPFromMatrix(
  matrixItem: { jp_vii?: number; jp_viii?: number; jp_ix?: number } | undefined | null,
  gradeLevel?: string | number | null
): number | "INVALID_GRADE_LEVEL" {
  if (!matrixItem) return 0;
  const norm = normalizeGradeLevel(gradeLevel);
  if (norm === "VII") return typeof matrixItem.jp_vii === "number" ? matrixItem.jp_vii : 0;
  if (norm === "VIII") return typeof matrixItem.jp_viii === "number" ? matrixItem.jp_viii : 0;
  if (norm === "IX") return typeof matrixItem.jp_ix === "number" ? matrixItem.jp_ix : 0;
  return "INVALID_GRADE_LEVEL";
}

/**
 * Returns canonical class ID for newly created schedules and standardized identity.
 */
export function getCanonicalClassId(
  cls: { id?: string; classId?: string; name?: string; gradeLevel?: string } | string | undefined | null,
  classes?: { id?: string; classId?: string; name?: string; gradeLevel?: string }[]
): string {
  if (!cls) return "";
  if (typeof cls === "object") {
    return cls.id || cls.classId || "";
  }
  const cleanCls = String(cls).trim();
  if (classes && classes.length > 0) {
    const found = classes.find(c => 
      c.id === cleanCls || 
      c.classId === cleanCls || 
      (c.name && c.name.toLowerCase().trim() === cleanCls.toLowerCase()) ||
      (c.gradeLevel && cleanCls.toUpperCase() === c.gradeLevel.toUpperCase())
    );
    if (found) {
      return found.id || found.classId || cleanCls;
    }
  }
  return cleanCls;
}

/**
 * Generates a canonical slot key representing a single unique KBM slot:
 * Format: academicYearId_semesterId_canonicalClassId_day_sequence
 * 
 * Invariant: One real KBM slot cannot have more than one schedule.
 */
export function getCanonicalSlotKey(
  item: {
    academicYearId?: string | null;
    semesterId?: string | null;
    classId?: string | null;
    day?: string | null;
    sequence?: number | null;
  },
  classes?: { id?: string; classId?: string; name?: string; gradeLevel?: string }[]
): string {
  const ay = (item.academicYearId || "").trim();
  const sem = (item.semesterId || "").trim();
  const cid = getCanonicalClassId(item.classId, classes);
  const d = (item.day || "").trim().toLowerCase();
  const seq = item.sequence || 0;
  return `${ay}__${sem}__${cid}__${d}__${seq}`;
}

/**
 * Checks if two schedule objects represent the exact same KBM slot in time and class.
 */
export function isSameSlot(
  a: { academicYearId?: string | null; semesterId?: string | null; classId?: string | null; day?: string | null; sequence?: number | null },
  b: { academicYearId?: string | null; semesterId?: string | null; classId?: string | null; day?: string | null; sequence?: number | null },
  classes?: { id?: string; classId?: string; name?: string; gradeLevel?: string }[]
): boolean {
  if (!a || !b) return false;
  if ((a.sequence || 0) !== (b.sequence || 0)) return false;
  if ((a.day || "").trim().toLowerCase() !== (b.day || "").trim().toLowerCase()) return false;
  if (a.academicYearId && b.academicYearId && a.academicYearId !== b.academicYearId) return false;
  if (a.semesterId && b.semesterId && a.semesterId !== b.semesterId) return false;
  return isClassMatch(a.classId, b.classId, classes);
}

/**
 * Checks if a given class ID or schedule matches a class entity,
 * providing backwards compatibility for legacy schedules where cls.classId or cls.id was stored.
 */
export function isClassMatch(
  classIdA: string | undefined | null,
  classEntityOrIdB: string | { id?: string; classId?: string; name?: string; gradeLevel?: string } | undefined | null,
  classes?: { id?: string; classId?: string; name?: string; gradeLevel?: string }[]
): boolean {
  if (!classIdA || !classEntityOrIdB) return false;

  // Direct string comparison
  if (typeof classEntityOrIdB === "string") {
    if (classIdA === classEntityOrIdB) return true;
    if (classIdA.toLowerCase().trim() === classEntityOrIdB.toLowerCase().trim()) return true;

    // Cross-match via classes array if available
    if (classes && classes.length > 0) {
      const target = classes.find(c => 
        c.id === classEntityOrIdB || 
        c.classId === classEntityOrIdB || 
        (c.name && c.name.toLowerCase().trim() === classEntityOrIdB.toLowerCase().trim())
      );
      if (target) {
        if (classIdA === target.id || (target.classId && classIdA === target.classId)) return true;
        if (target.name && classIdA.toLowerCase().trim() === target.name.toLowerCase().trim()) return true;
      }

      const source = classes.find(c => 
        c.id === classIdA || 
        c.classId === classIdA || 
        (c.name && c.name.toLowerCase().trim() === classIdA.toLowerCase().trim())
      );
      if (source) {
        if (source.id === classEntityOrIdB || (source.classId && source.classId === classEntityOrIdB)) return true;
        if (target && (source.id === target.id || (source.classId && target.classId && source.classId === target.classId))) return true;
      }
    }
    return false;
  }

  // classEntityOrIdB is an object { id, classId, name, gradeLevel }
  if (classIdA === classEntityOrIdB.id || (classEntityOrIdB.classId && classIdA === classEntityOrIdB.classId)) {
    return true;
  }
  if (classEntityOrIdB.name && classIdA.toLowerCase().trim() === classEntityOrIdB.name.toLowerCase().trim()) {
    return true;
  }
  if (classEntityOrIdB.gradeLevel && classIdA.toUpperCase().trim() === classEntityOrIdB.gradeLevel.toUpperCase().trim()) {
    return true;
  }

  // Cross-match via classes list for object entity
  if (classes && classes.length > 0) {
    const source = classes.find(c => 
      c.id === classIdA || 
      c.classId === classIdA || 
      (c.name && c.name.toLowerCase().trim() === classIdA.toLowerCase().trim())
    );
    if (source) {
      if (classEntityOrIdB.id && source.id === classEntityOrIdB.id) return true;
      if (classEntityOrIdB.classId && source.classId && source.classId === classEntityOrIdB.classId) return true;
      if (classEntityOrIdB.name && source.name && source.name.toLowerCase().trim() === classEntityOrIdB.name.toLowerCase().trim()) return true;
    }
  }

  return false;
}

/**
 * Check if a schedule belongs to a class entity or matches a given class ID.
 */
export function isScheduleForClass(
  schedule: { classId?: string | null } | undefined | null,
  classEntityOrId: string | { id?: string; classId?: string; name?: string; gradeLevel?: string } | undefined | null,
  classes?: { id?: string; classId?: string; name?: string; gradeLevel?: string }[]
): boolean {
  if (!schedule?.classId) return false;
  return isClassMatch(schedule.classId, classEntityOrId, classes);
}

/**
 * Generate composite requirement key for scoping:
 * academicYearId_semesterId_subjectId_classId
 */
export function getScheduleRequirementKey(
  academicYearId: string | undefined | null,
  semesterId: string | undefined | null,
  subjectId: string,
  classId: string
): string {
  return `${academicYearId || ""}_${semesterId || ""}_${subjectId}_${classId}`;
}

/**
 * Count scheduled JPs strictly within scope:
 * academicYearId (mandatory match when provided in context),
 * semesterId (mandatory match when provided in context),
 * classId (supporting both canonical & legacy), and subjectId.
 *
 * IMPORTANT: This is a WEEKLY JP counter (not daily). Do not filter by day.
 */
export function countScheduledJP(
  schedules: { 
    academicYearId?: string; 
    semesterId?: string; 
    classId: string; 
    subjectId: string;
  }[],
  params: {
    academicYearId?: string | null;
    semesterId?: string | null;
    classId: string;
    subjectId: string;
    classEntity?: { id?: string; classId?: string };
    classes?: { id?: string; classId?: string }[];
  }
): number {
  return schedules.filter((s) => {
    if (s.subjectId !== params.subjectId) return false;

    // Match class ID (support legacy and canonical with optional class directory)
    const matchesClass = params.classEntity
      ? isClassMatch(s.classId, params.classEntity, params.classes)
      : isClassMatch(s.classId, params.classId, params.classes);
    if (!matchesClass) return false;

    // Academic year scoping: match if schedule has it
    if (params.academicYearId && s.academicYearId) {
      if (s.academicYearId !== params.academicYearId) {
        return false;
      }
    }

    // Semester scoping: match if schedule has it
    if (params.semesterId && s.semesterId) {
      if (s.semesterId !== params.semesterId) {
        return false;
      }
    }

    return true;
  }).length;
}

export interface JPFulfillmentStatus {
  targetJP: number;
  scheduledJP: number;
  remainingJP: number;
  isFulfilled: boolean;
  isValidGrade: boolean;
  statusLabel: string;
}

/**
 * Computes exact JP fulfillment metrics without assumptions.
 */
export function computeJPFulfillment(params: {
  matrixItem: { jp_vii?: number; jp_viii?: number; jp_ix?: number } | undefined | null;
  gradeLevel?: string | number | null;
  scheduledJP: number;
}): JPFulfillmentStatus {
  const target = getTargetJPFromMatrix(params.matrixItem, params.gradeLevel);
  if (target === "INVALID_GRADE_LEVEL") {
    return {
      targetJP: 0,
      scheduledJP: params.scheduledJP,
      remainingJP: 0,
      isFulfilled: false,
      isValidGrade: false,
      statusLabel: "Jenjang Kelas Tidak Valid"
    };
  }

  const remaining = Math.max(0, target - params.scheduledJP);
  const isFulfilled = params.scheduledJP >= target;

  return {
    targetJP: target,
    scheduledJP: params.scheduledJP,
    remainingJP: remaining,
    isFulfilled,
    isValidGrade: true,
    statusLabel: isFulfilled
      ? "JP Terpenuhi"
      : `Kurang ${remaining} JP (${params.scheduledJP}/${target} JP)`
  };
}

/**
 * Checks if adding one or more sequences to existing sequences on the same day
 * preserves a single contiguous session (i.e. no non-contiguous gap).
 */
export function formsContiguousSession(
  existingSequences: number[],
  newSequences: number | number[]
): boolean {
  if (existingSequences.length === 0) return true;
  const toAdd = Array.isArray(newSequences) ? newSequences : [newSequences];
  const combined = Array.from(new Set([...existingSequences, ...toAdd])).sort((a, b) => a - b);
  
  // Verify all elements in combined are consecutive
  for (let i = 1; i < combined.length; i++) {
    if (combined[i] !== combined[i - 1] + 1) {
      return false;
    }
  }
  return true;
}
