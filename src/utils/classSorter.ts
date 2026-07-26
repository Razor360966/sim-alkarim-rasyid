/**
 * Utility for global standard class sorting across AI Studio App.
 * Standard Order: VII -> VIII -> IX
 * Rombel Order: VII A, VII B, VII C, VIII A, VIII B, VIII C, IX A, IX B, IX C
 */

export const GRADE_LEVEL_ORDER: Record<string, number> = {
  "VII": 1,
  "7": 1,
  "VIII": 2,
  "8": 2,
  "IX": 3,
  "9": 3,
};

export function getGradeLevelWeight(grade: string | undefined | null): number {
  if (!grade) return 99;
  const cleanGrade = grade.toString().trim().toUpperCase();
  if (GRADE_LEVEL_ORDER[cleanGrade] !== undefined) {
    return GRADE_LEVEL_ORDER[cleanGrade];
  }
  if (cleanGrade.startsWith("VIII") || cleanGrade.includes("8")) return 2;
  if (cleanGrade.startsWith("VII") || cleanGrade.includes("7")) return 1;
  if (cleanGrade.startsWith("IX") || cleanGrade.includes("9")) return 3;
  
  return 99;
}

export function compareClassNames(nameA: string, nameB: string): number {
  const strA = (nameA || "").trim().toUpperCase();
  const strB = (nameB || "").trim().toUpperCase();

  const weightA = getGradeLevelWeight(strA);
  const weightB = getGradeLevelWeight(strB);

  if (weightA !== weightB) {
    return weightA - weightB;
  }

  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortClasses<T>(items: T[], getNameOrGrade?: (item: T) => string): T[] {
  if (!items || !Array.isArray(items)) return [];
  
  return [...items].sort((a, b) => {
    const valA = getNameOrGrade ? getNameOrGrade(a) : (a as any)?.name || (a as any)?.gradeLevel || (a as any)?.grade || String(a);
    const valB = getNameOrGrade ? getNameOrGrade(b) : (b as any)?.name || (b as any)?.gradeLevel || (b as any)?.grade || String(b);
    return compareClassNames(valA, valB);
  });
}
