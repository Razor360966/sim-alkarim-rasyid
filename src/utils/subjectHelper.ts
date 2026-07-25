import { Subject } from "../types";

export type SubjectCategoryType = "umum_pai" | "diniyah_pondok";

export function getSubjectCategoryType(subject?: Subject | null): SubjectCategoryType {
  if (!subject) return "umum_pai";
  if (subject.categoryType === "diniyah_pondok") return "diniyah_pondok";
  if (subject.categoryType === "umum_pai") return "umum_pai";

  // Group B is "Kelompok B (Kepesantrenan)" -> Diniyah/Pondok
  if (subject.group === "B") {
    return "diniyah_pondok";
  }

  // Check keywords in subject name or code
  const nameLower = (subject.name || "").toLowerCase();
  const codeLower = (subject.code || "").toLowerCase();
  const diniyahKeywords = [
    "diniyah", "pondok", "pesantren", "tahfidz", "kitab", "fiqh", "fikih",
    "nahwu", "shorof", "hadits", "hadis", "aqidah", "akhlak", "tajwid",
    "lughah", "sorof", "syariah", "tahsin", "imrithi", "jurumiyah", "alfiyah", "safinah", "halaqah"
  ];

  if (diniyahKeywords.some(kw => nameLower.includes(kw) || codeLower.includes(kw))) {
    return "diniyah_pondok";
  }

  return "umum_pai";
}
