import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { classService } from "./classService";
import { academicYearService } from "./academicYear.service";
import { Class, AcademicYear, Teacher, UserProfile } from "../types";

export interface HomeroomStatus {
  isHomeroomTeacher: boolean;
  assignedClasses: Class[];
  activeAcademicYear: AcademicYear | null;
  canonicalTeacherId: string | null;
  isLoading?: boolean;
}

/**
 * Checks if a class matches the active academic year.
 * Compares both academicYear (e.g., "2025/2026") and academicYearId (e.g., doc ID).
 */
export function isClassInActiveAcademicYear(
  cls: Class,
  activeYear: AcademicYear | null
): boolean {
  if (!activeYear) return true; // If no active year is set, allow active classes
  const yearName = (activeYear.year || activeYear.name || "").trim().toLowerCase();
  const yearId = (activeYear.id || activeYear.academicYearId || "").trim().toLowerCase();

  const classYear = (cls.academicYear || "").trim().toLowerCase();
  const classYearId = (cls.academicYearId || "").trim().toLowerCase();

  // If class does not specify an academic year, consider it valid if class status is Aktif
  if (!classYear && !classYearId) return true;

  if (yearName && (classYear === yearName || classYearId === yearName)) return true;
  if (yearId && (classYear === yearId || classYearId === yearId)) return true;

  return false;
}

/**
 * Resolves the canonical teacher ID from a UserProfile.
 * Looks up by user.teacherId, or queries the teachers collection by email if needed.
 */
export async function resolveCanonicalTeacherId(
  user: UserProfile | null
): Promise<string | null> {
  if (!user) return null;

  if (user.teacherId && user.teacherId.trim() !== "") {
    return user.teacherId.trim();
  }

  // Fallback: search teachers collection by email
  if (user.email) {
    try {
      const teachersRef = collection(db, "teachers");
      const q = query(
        teachersRef,
        where("email", "==", user.email.toLowerCase().trim()),
        where("isDeleted", "==", false)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }
    } catch (err) {
      console.error("[homeroomService] Error resolving teacher by email:", err);
    }
  }

  return null;
}

/**
 * Collects all candidate identity keys for the teacher/user to ensure robust canonical matching.
 * Never uses display names as identity keys.
 */
export function getTeacherIdentityCandidates(
  user: UserProfile | null,
  canonicalTeacherId?: string | null
): Set<string> {
  const ids = new Set<string>();
  if (!user) return ids;

  if (canonicalTeacherId && canonicalTeacherId.trim() !== "") {
    ids.add(canonicalTeacherId.trim());
  }
  if (user.teacherId && user.teacherId.trim() !== "") {
    ids.add(user.teacherId.trim());
  }
  if (user.uid && user.uid.trim() !== "") {
    ids.add(user.uid.trim());
  }
  if (user.userId && user.userId.trim() !== "") {
    ids.add(user.userId.trim());
  }

  return ids;
}

/**
 * Evaluates whether a given class assigns the user as homeroom teacher.
 * Validates canonical identity keys against homeroomTeacherId and waliKelasId.
 * Does NOT rely on display names.
 */
export function isAssignedHomeroomClass(
  cls: Class,
  candidateIds: Set<string>
): boolean {
  if (candidateIds.size === 0) return false;

  const hrId = cls.homeroomTeacherId?.trim();
  const wkId = cls.waliKelasId?.trim();

  if (hrId && candidateIds.has(hrId)) return true;
  if (wkId && candidateIds.has(wkId)) return true;

  return false;
}

export const homeroomService = {
  /**
   * Fetches the current homeroom status for a user against active academic year and active classes.
   */
  async getHomeroomStatus(user: UserProfile | null): Promise<HomeroomStatus> {
    if (!user) {
      return {
        isHomeroomTeacher: false,
        assignedClasses: [],
        activeAcademicYear: null,
        canonicalTeacherId: null
      };
    }

    try {
      const [canonicalTeacherId, activeAcademicYear, allClasses] = await Promise.all([
        resolveCanonicalTeacherId(user),
        academicYearService.getActiveAcademicYear(),
        classService.getClasses()
      ]);

      const candidateIds = getTeacherIdentityCandidates(user, canonicalTeacherId);

      // Filter classes:
      // 1. Must be active and not soft-deleted
      // 2. Must match the active academic year
      // 3. Must match canonical teacher identity keys (homeroomTeacherId / waliKelasId)
      const activeClasses = allClasses.filter(
        (c) => c.status === "Aktif" && !c.isDeleted
      );

      const assignedClasses = activeClasses.filter((c) => {
        if (!isClassInActiveAcademicYear(c, activeAcademicYear)) {
          return false;
        }
        return isAssignedHomeroomClass(c, candidateIds);
      });

      return {
        isHomeroomTeacher: assignedClasses.length > 0,
        assignedClasses,
        activeAcademicYear,
        canonicalTeacherId
      };
    } catch (error) {
      console.error("[homeroomService] Error getting homeroom status:", error);
      return {
        isHomeroomTeacher: false,
        assignedClasses: [],
        activeAcademicYear: null,
        canonicalTeacherId: null
      };
    }
  },

  /**
   * Synchronously filters preloaded classes to find assigned homeroom classes for a user.
   */
  filterAssignedClassesSync(
    user: UserProfile | null,
    classes: Class[],
    activeYear: AcademicYear | null,
    canonicalTeacherId?: string | null
  ): Class[] {
    if (!user || classes.length === 0) return [];
    const candidateIds = getTeacherIdentityCandidates(user, canonicalTeacherId);

    return classes.filter((c) => {
      if (c.isDeleted || c.status !== "Aktif") return false;
      if (!isClassInActiveAcademicYear(c, activeYear)) return false;
      return isAssignedHomeroomClass(c, candidateIds);
    });
  }
};
