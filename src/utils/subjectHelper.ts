import { Subject, SubjectLearningType, SubjectReportDisplay } from "../types";

export type SubjectCategoryType = "umum_pai" | "diniyah_pondok";
export type SubjectGroupType = "UMUM" | "KEPESANTRENAN" | "UNCLASSIFIED";

export function getSubjectCategoryType(subject?: Subject | null): SubjectCategoryType {
  if (!subject) return "umum_pai";
  if (subject.categoryType === "diniyah_pondok") return "diniyah_pondok";
  if (subject.categoryType === "umum_pai") return "umum_pai";

  const groupType = getSubjectGroupType(subject);
  if (groupType === "KEPESANTRENAN") {
    return "diniyah_pondok";
  }

  return "umum_pai";
}

/**
 * Single Source of Truth helper to classify a subject into "UMUM" or "KEPESANTRENAN"
 */
export function getSubjectGroupType(subject?: Subject | null): SubjectGroupType {
  if (!subject) return "UNCLASSIFIED";

  // 1. Explicit subjectType field
  const st = (subject.subjectType || "").toString().trim().toUpperCase();
  if (st === "KEPESANTRENAN" || st === "PONDOK") return "KEPESANTRENAN";
  if (st === "UMUM") return "UMUM";

  // 2. Group field
  const grp = (subject.group || "").toString().trim().toUpperCase();
  if (grp === "KEPESANTRENAN" || grp === "B") return "KEPESANTRENAN";
  if (grp === "UMUM" || grp === "A" || grp === "C") return "UMUM";
  if (grp.includes("KEPESANTRENAN") || grp.includes("PONDOK") || grp.includes("DINIYAH")) {
    return "KEPESANTRENAN";
  }

  // 3. Category type
  if (subject.categoryType === "diniyah_pondok") return "KEPESANTRENAN";
  if (subject.categoryType === "umum_pai") return "UMUM";

  // 4. Keyword fallback for legacy records
  const nameLower = (subject.name || "").toLowerCase();
  const codeLower = (subject.code || "").toLowerCase();
  const diniyahKeywords = [
    "diniyah", "pondok", "pesantren", "tahfidz", "kitab", "fiqh", "fikih",
    "nahwu", "shorof", "hadits", "hadis", "aqidah", "akhlak", "tajwid",
    "lughah", "sorof", "syariah", "tahsin", "imrithi", "jurumiyah", "alfiyah", "safinah", "halaqah"
  ];

  if (diniyahKeywords.some(kw => nameLower.includes(kw) || codeLower.includes(kw))) {
    return "KEPESANTRENAN";
  }

  // Check if completely unclassified
  if (!subject.group && !subject.subjectType && !subject.categoryType) {
    return "UNCLASSIFIED";
  }

  return "UMUM";
}

export function isSubjectClassified(subject?: Subject | null): boolean {
  if (!subject) return false;
  if (subject.subjectType === "UMUM" || subject.subjectType === "KEPESANTRENAN" || subject.subjectType === "PONDOK") return true;
  if (subject.group === "A" || subject.group === "B" || subject.group === "C" || subject.group === "UMUM" || subject.group === "KEPESANTRENAN") return true;
  if (subject.categoryType === "umum_pai" || subject.categoryType === "diniyah_pondok") return true;
  return false;
}

/**
 * Helper to get Learning Type: "REGULER" (default) or "BLOK"
 */
export function getSubjectLearningType(subject?: Subject | null): SubjectLearningType {
  if (!subject) return "REGULER";
  if (subject.learningType === "BLOK") return "BLOK";
  return "REGULER";
}

/**
 * Helper to get Report Display Status: "TAMPIL_RAPOR" (default) or "TIDAK_TAMPIL_RAPOR"
 */
export function getSubjectReportDisplay(subject?: Subject | null): SubjectReportDisplay {
  if (!subject) return "TAMPIL_RAPOR";
  if (subject.reportDisplay === "TIDAK_TAMPIL_RAPOR") return "TIDAK_TAMPIL_RAPOR";
  return "TAMPIL_RAPOR";
}

/**
 * Returns true if the subject should be displayed in report cards (e-Rapor)
 */
export function isSubjectReportVisible(subject?: Subject | null): boolean {
  return getSubjectReportDisplay(subject) === "TAMPIL_RAPOR";
}

/**
 * Standard subject abbreviations dictionary for Leger
 */
const STANDARD_SUBJECT_ABBREVIATIONS: Record<string, string> = {
  "matematika": "MTK",
  "ilmu pengetahuan alam": "IPA",
  "ipa": "IPA",
  "ilmu pengetahuan sosial": "IPS",
  "ips": "IPS",
  "bahasa indonesia": "B.IND",
  "bahasa inggris": "B.ING",
  "bahasa arab": "B.ARB",
  "pendidikan agama islam": "PAI",
  "pendidikan agama islam dan budi pekerti": "PAI",
  "pai": "PAI",
  "pendidikan pancasila": "PPKn",
  "pendidikan pancasila dan kewarganegaraan": "PPKn",
  "ppkn": "PPKn",
  "pkn": "PPKn",
  "pendidikan jasmani, olahraga, dan kesehatan": "PJOK",
  "pendidikan jasmani dan kesehatan": "PJOK",
  "penjasorkes": "PJOK",
  "pjok": "PJOK",
  "informatika": "INF",
  "teknologi informasi dan komunikasi": "TIK",
  "tik": "INF",
  "prakarya": "PRAK",
  "prakarya dan kewirausahaan": "PRAK",
  "pkwu": "PRAK",
  "seni budaya": "SBK",
  "seni rupa": "SR",
  "seni musik": "SM",
  "seni tari": "ST",
  "tahfidz": "THFDZ",
  "tahfidzul qur'an": "THFDZ",
  "tahfidz al-qur'an": "THFDZ",
  "tahsin": "THSN",
  "fiqih": "FIQIH",
  "fikih": "FIQIH",
  "aqidah akhlak": "AQIDAH",
  "akidah akhlak": "AQIDAH",
  "qur'an hadits": "Q.HADITS",
  "al-qur'an hadits": "Q.HADITS",
  "hadits": "HADITS",
  "sejarah kebudayaan islam": "SKI",
  "ski": "SKI",
  "nahwu": "NAHWU",
  "shorof": "SHOROF",
  "sharaf": "SHOROF",
  "sorof": "SHOROF",
  "tajwid": "TAJWID",
  "bimbingan konseling": "BK"
};

/**
 * Get display short name for Subject in Leger matrix
 */
export function getSubjectShortName(subject?: (Partial<Subject> & { name?: string; shortName?: string; singkatan?: string }) | null): string {
  if (!subject) return "-";
  if (subject.shortName && subject.shortName.trim() !== "") {
    return subject.shortName.trim();
  }
  if (subject.singkatan && subject.singkatan.trim() !== "") {
    return subject.singkatan.trim();
  }

  const name = (subject.name || "").trim();
  if (!name) return "-";

  const lower = name.toLowerCase().replace(/['"`]/g, "").trim();
  if (STANDARD_SUBJECT_ABBREVIATIONS[lower]) {
    return STANDARD_SUBJECT_ABBREVIATIONS[lower];
  }

  // Check substring match for common subjects
  for (const [key, abbr] of Object.entries(STANDARD_SUBJECT_ABBREVIATIONS)) {
    if (lower === key || lower.startsWith(key + " ") || lower.endsWith(" " + key)) {
      return abbr;
    }
  }

  // If no match found, use exact name without arbitrary truncations as requested
  return name;
}


