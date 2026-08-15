import { Student } from "../types";

export interface StudentBiodataCompletenessResult {
  studentId: string;
  studentName: string;
  totalFields: number;
  filledFields: number;
  percentage: number; // 0 - 100
  status: "LENGKAP" | "SEBAGIAN" | "BELUM";
  statusLabel: string;
  statusBadgeColor: string;
  missingFields: string[];
}

/**
 * Real-time calculation of student biodata completeness.
 * Checks core required fields for e-Rapor print readiness.
 */
export function calculateStudentBiodataCompleteness(
  student: Student
): StudentBiodataCompletenessResult {
  const missing: string[] = [];
  let filled = 0;
  
  // Define required fields to check
  const requiredChecks = [
    { key: "name", label: "Nama Lengkap", val: student.name },
    { key: "nis", label: "NIS", val: student.nis },
    { key: "nisn", label: "NISN", val: student.nisn },
    { key: "gender", label: "Jenis Kelamin", val: student.gender },
    { key: "birthPlace", label: "Tempat Lahir", val: student.birthPlace },
    { key: "birthDate", label: "Tanggal Lahir", val: student.birthDate },
    { key: "address", label: "Alamat Jalan", val: student.address },
    {
      key: "parents",
      label: "Nama Orang Tua / Wali",
      val: student.fatherName || student.motherName || student.guardianName
    },
    { key: "parentPhone", label: "Kontak Orang Tua/Wali", val: student.parentPhone },
    { key: "city", label: "Kabupaten / Kota", val: student.city || student.district || student.province }
  ];

  requiredChecks.forEach((check) => {
    if (check.val && String(check.val).trim().length > 0) {
      filled++;
    } else {
      missing.push(check.label);
    }
  });

  const total = requiredChecks.length;
  const percentage = Math.round((filled / total) * 100);

  let status: "LENGKAP" | "SEBAGIAN" | "BELUM" = "BELUM";
  let statusLabel = "Belum Lengkap";
  let statusBadgeColor = "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-300";

  if (percentage === 100) {
    status = "LENGKAP";
    statusLabel = "Lengkap";
    statusBadgeColor = "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-300";
  } else if (percentage >= 50) {
    status = "SEBAGIAN";
    statusLabel = "Sebagian Lengkap";
    statusBadgeColor = "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-300";
  }

  return {
    studentId: student.id,
    studentName: student.name,
    totalFields: total,
    filledFields: filled,
    percentage,
    status,
    statusLabel,
    statusBadgeColor,
    missingFields: missing
  };
}
