/**
 * Centralized Grade Level & Class Identifier Helpers
 * Standardized across Auto Scheduler, ScheduleHelper, and Validation Diagnostics.
 */

export type ValidGradeLevel = "VII" | "VIII" | "IX";
export type NormalizedGradeLevel = ValidGradeLevel | "INVALID_GRADE_LEVEL";

/**
 * Checks if a string is strictly an exact recognized grade token or alias.
 * Prevents random document IDs or strings containing accidental digits (e.g. 7 or 8)
 * from being mistakenly treated as grade indicators.
 */
export function isExactGradeToken(str?: string | null): boolean {
  if (!str) return false;
  const s = String(str).trim().toUpperCase();
  return (
    s === "VII" || s === "VIII" || s === "IX" ||
    s === "7" || s === "8" || s === "9" ||
    s === "KELAS VII" || s === "KELAS VIII" || s === "KELAS IX" ||
    s === "KELAS 7" || s === "KELAS 8" || s === "KELAS 9" ||
    s === "KLS VII" || s === "KLS VIII" || s === "KLS IX" ||
    s === "KLS 7" || s === "KLS 8" || s === "KLS 9"
  );
}

/**
 * Safely normalize grade levels:
 * - "VII", "7", "vii", "kelas 7", "kelas vii" -> "VII"
 * - "VIII", "8", "viii", "kelas 8", "kelas viii" -> "VIII"
 * - "IX", "9", "ix", "kelas 9", "kelas ix" -> "IX"
 * 
 * CRITICAL: Never silently fall back to "IX" or any default.
 * If grade level cannot be determined, returns "INVALID_GRADE_LEVEL".
 * Never detects grade level from accidental numbers inside long document IDs.
 */
export function normalizeGradeLevel(grade?: string | number | null): NormalizedGradeLevel {
  if (grade === null || grade === undefined) return "INVALID_GRADE_LEVEL";
  const s = String(grade).trim().toUpperCase();
  if (!s) return "INVALID_GRADE_LEVEL";

  // Reject strings longer than 20 characters unless explicitly prefixed with KELAS / KLS
  if (s.length > 20 && !/^(?:KELAS|KLS)\b/.test(s)) {
    return "INVALID_GRADE_LEVEL";
  }

  // Reject alphanumeric random IDs (contains both numbers and letters without space/hyphen/dot, length > 4)
  // e.g. "7aB8cDeF", "c_vii_8abc", "cls7abc8"
  if (s.length > 4 && /^[A-Z0-9_]{6,}$/.test(s) && !/^(?:KELAS|KLS)\b/.test(s)) {
    if (s.includes("_") || (/\d/.test(s) && /[A-Z]/.test(s) && s.length > 5)) {
      return "INVALID_GRADE_LEVEL";
    }
  }

  // 1. Exact standard strings
  if (s === "VIII" || s === "8" || s === "KELAS 8" || s === "KELAS VIII" || s === "KLS 8" || s === "KLS VIII") return "VIII";
  if (s === "VII" || s === "7" || s === "KELAS 7" || s === "KELAS VII" || s === "KLS 7" || s === "KLS VII") return "VII";
  if (s === "IX" || s === "9" || s === "KELAS 9" || s === "KELAS IX" || s === "KLS 9" || s === "KLS IX") return "IX";

  // 2. Class names with section rombel (e.g. "Kelas 8A", "8-A", "VIII A", "VIII-B", "Kelas 7A", "7-A", "VII A", "IX A")
  // Check Grade VIII first so "VIII" is never matched by "VII"
  if (
    /^(?:KELAS\s+|KLS\s+)?VIII(?:[\s\-./_]+[A-Z0-9]+|[A-Z])?$/i.test(s) ||
    /^(?:KELAS\s+|KLS\s+)?8(?:[\s\-./_]+[A-Z0-9]+|[A-Z])?$/i.test(s)
  ) {
    return "VIII";
  }

  // Check Grade VII
  if (
    /^(?:KELAS\s+|KLS\s+)?VII(?:[\s\-./_]+[A-Z0-9]+|[A-Z])?$/i.test(s) ||
    /^(?:KELAS\s+|KLS\s+)?7(?:[\s\-./_]+[A-Z0-9]+|[A-Z])?$/i.test(s)
  ) {
    return "VII";
  }

  // Check Grade IX
  if (
    /^(?:KELAS\s+|KLS\s+)?IX(?:[\s\-./_]+[A-Z0-9]+|[A-Z])?$/i.test(s) ||
    /^(?:KELAS\s+|KLS\s+)?9(?:[\s\-./_]+[A-Z0-9]+|[A-Z])?$/i.test(s)
  ) {
    return "IX";
  }

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
    // 1. Direct ID match takes absolute precedence
    const byId = classes.find(c => c.id === cleanCls || c.classId === cleanCls);
    if (byId) return byId.id || byId.classId || cleanCls;

    // 2. Direct Name match
    const byName = classes.find(c => c.name && c.name.toLowerCase().trim() === cleanCls.toLowerCase());
    if (byName) return byName.id || byName.classId || cleanCls;

    // 3. Short grade token fallback ("VII", "VIII", "IX", "7", "8", "9") ONLY if unambiguous single class in grade
    if (isExactGradeToken(cleanCls)) {
      const normGrade = normalizeGradeLevel(cleanCls);
      if (normGrade !== "INVALID_GRADE_LEVEL") {
        const byGrade = classes.filter(c => {
          const g = normalizeGradeLevel(c.gradeLevel) !== "INVALID_GRADE_LEVEL"
            ? normalizeGradeLevel(c.gradeLevel)
            : normalizeGradeLevel(c.name);
          return g === normGrade;
        });
        if (byGrade.length === 1) {
          return byGrade[0].id || byGrade[0].classId || cleanCls;
        }
      }
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
  let d = (item.day || "").trim().toLowerCase();
  if (d === "ahad") d = "minggu";
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
  const dayA = (a.day || "").trim().toLowerCase();
  const dayB = (b.day || "").trim().toLowerCase();
  const normDayA = dayA === "ahad" ? "minggu" : dayA;
  const normDayB = dayB === "ahad" ? "minggu" : dayB;
  if (normDayA !== normDayB) return false;
  if (a.academicYearId && b.academicYearId && a.academicYearId !== b.academicYearId) return false;
  if (a.semesterId && b.semesterId && a.semesterId !== b.semesterId) return false;
  return isClassMatch(a.classId, b.classId, classes);
}

/**
 * Checks if a given class ID or schedule matches a class entity,
 * providing backwards compatibility for legacy schedules where cls.classId or cls.id was stored.
 *
 * INVARIANT:
 * - Direct ID match takes absolute precedence.
 * - If both classes are known entities in directory, they match IF AND ONLY IF they are the exact same class entity.
 * - Classes across different grade levels (e.g. VII vs VIII vs IX) MUST NEVER MATCH.
 * - IDs containing accidental digits (e.g. Firestore IDs with 7 or 8) MUST NEVER be treated as grade matches.
 */
export function isClassMatch(
  classIdA: string | undefined | null,
  classEntityOrIdB: string | { id?: string; classId?: string; name?: string; gradeLevel?: string } | undefined | null,
  classes?: { id?: string; classId?: string; name?: string; gradeLevel?: string }[]
): boolean {
  if (!classIdA || !classEntityOrIdB) return false;

  const idB = typeof classEntityOrIdB === "string" ? classEntityOrIdB : (classEntityOrIdB.id || classEntityOrIdB.classId || "");
  const nameB = typeof classEntityOrIdB === "string" ? "" : (classEntityOrIdB.name || "");
  const gradeB = typeof classEntityOrIdB === "string" ? "" : (classEntityOrIdB.gradeLevel || "");

  // 1. Direct ID check
  if (classIdA === idB) return true;
  if (classIdA.toLowerCase().trim() === idB.toLowerCase().trim()) return true;

  // 2. Direct Name check
  if (nameB && classIdA.toLowerCase().trim() === nameB.toLowerCase().trim()) return true;

  // 3. Entity resolution via classes directory
  if (classes && classes.length > 0) {
    const target = classes.find(c => 
      c.id === idB || 
      c.classId === idB || 
      (c.name && nameB && c.name.toLowerCase().trim() === nameB.toLowerCase().trim()) ||
      (c.name && c.name.toLowerCase().trim() === idB.toLowerCase().trim())
    );

    const source = classes.find(c => 
      c.id === classIdA || 
      c.classId === classIdA || 
      (c.name && c.name.toLowerCase().trim() === classIdA.toLowerCase().trim())
    );

    // If both source and target are known distinct classes in directory, do NOT match across classes
    if (target && source) {
      const sameId = (target.id && source.id && target.id === source.id) ||
                     (target.classId && source.classId && target.classId === source.classId);
      const sameName = Boolean(target.name && source.name && target.name.toLowerCase().trim() === source.name.toLowerCase().trim());
      return sameId || sameName;
    }

    if (target) {
      if (classIdA === target.id || (target.classId && classIdA === target.classId)) return true;
      if (target.name && classIdA.toLowerCase().trim() === target.name.toLowerCase().trim()) return true;

      // Legacy literal grade tokens (e.g. "VII", "VIII", "IX", "7", "8", "9") only if unique class in grade
      const isLiteralGradeToken = isExactGradeToken(classIdA);
      const normGradeA = normalizeGradeLevel(classIdA);
      if (isLiteralGradeToken && normGradeA !== "INVALID_GRADE_LEVEL") {
        const targetGrade = normalizeGradeLevel(target.gradeLevel) !== "INVALID_GRADE_LEVEL" 
          ? normalizeGradeLevel(target.gradeLevel) 
          : normalizeGradeLevel(target.name);

        if (targetGrade === normGradeA) {
          const matchingGradeClasses = classes.filter(c => {
            const g = normalizeGradeLevel(c.gradeLevel) !== "INVALID_GRADE_LEVEL" 
              ? normalizeGradeLevel(c.gradeLevel) 
              : normalizeGradeLevel(c.name);
            return g === normGradeA;
          });
          if (matchingGradeClasses.length === 1 && (target.id === matchingGradeClasses[0].id || target.classId === matchingGradeClasses[0].classId)) {
            return true;
          }
        }
      }
    }

    if (source) {
      if (idB === source.id || (source.classId && idB === source.classId)) return true;
      if (source.name && idB.toLowerCase().trim() === source.name.toLowerCase().trim()) return true;

      const normGradeB = normalizeGradeLevel(gradeB || idB);
      const isLiteralGradeToken = isExactGradeToken(idB) || (nameB && isExactGradeToken(nameB));
      if (isLiteralGradeToken && normGradeB !== "INVALID_GRADE_LEVEL") {
        const sourceGrade = normalizeGradeLevel(source.gradeLevel) !== "INVALID_GRADE_LEVEL" 
          ? normalizeGradeLevel(source.gradeLevel) 
          : normalizeGradeLevel(source.name);

        if (sourceGrade === normGradeB) {
          const matchingGradeClasses = classes.filter(c => {
            const g = normalizeGradeLevel(c.gradeLevel) !== "INVALID_GRADE_LEVEL" 
              ? normalizeGradeLevel(c.gradeLevel) 
              : normalizeGradeLevel(c.name);
            return g === normGradeB;
          });
          if (matchingGradeClasses.length === 1 && (source.id === matchingGradeClasses[0].id || source.classId === matchingGradeClasses[0].classId)) {
            return true;
          }
        }
      }
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
