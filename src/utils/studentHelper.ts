import { Student } from "../types";

/**
 * Check if a student record is considered ACTIVE.
 * Returns true if student status is "Aktif" or "AKTIF" or not explicitly set to an inactive status.
 * Returns false if student status is "Tidak Aktif", "Nonaktif", "Lulus", "Pindah", "Keluar", "Mutasi", etc.
 */
export function isStudentActive(student?: Student | Partial<Student> | null): boolean {
  if (!student) return false;
  
  // If status is not provided at all, fallback to active (for backwards compatibility)
  if (student.status === undefined || student.status === null || (student.status as unknown) === "") {
    return true;
  }

  const normalized = String(student.status).trim().toUpperCase();
  
  // Check for explicit active status
  if (normalized === "AKTIF" || normalized === "ACTIVE") {
    return true;
  }

  // Check for explicit inactive / non-active status
  if (
    normalized === "TIDAK AKTIF" ||
    normalized === "NONAKTIF" ||
    normalized === "NON-AKTIF" ||
    normalized === "NON AKTIF" ||
    normalized === "LULUS" ||
    normalized === "PINDAH" ||
    normalized === "KELUAR" ||
    normalized === "MUTASI" ||
    normalized === "ALUMNI" ||
    normalized === "INACTIVE"
  ) {
    return false;
  }

  // If status is any other non-Aktif string, consider it non-active
  return false;
}

/**
 * Filter students list to only include active students.
 */
export function getActiveStudents<T extends Student | Partial<Student>>(students: T[]): T[] {
  if (!Array.isArray(students)) return [];
  return students.filter(isStudentActive);
}

/**
 * Filter students list to only include inactive students (Lulus, Pindah, Keluar, Tidak Aktif).
 */
export function getInactiveStudents<T extends Student | Partial<Student>>(students: T[]): T[] {
  if (!Array.isArray(students)) return [];
  return students.filter((s) => !isStudentActive(s));
}

/**
 * Get total count of active students.
 * Concept: Total Siswa = jumlah siswa dengan status "AKTIF"
 */
export function countActiveStudents(students: (Student | Partial<Student>)[]): number {
  if (!Array.isArray(students)) return 0;
  return students.filter(isStudentActive).length;
}

/**
 * Get count of active students in a specific class.
 */
export function countActiveStudentsInClass(
  students: (Student | Partial<Student>)[],
  classId: string
): number {
  if (!Array.isArray(students) || !classId) return 0;
  return students.filter((s) => s.classId === classId && isStudentActive(s)).length;
}
