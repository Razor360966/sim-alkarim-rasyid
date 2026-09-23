import { Teacher } from "../types/teacher";
import { UserSystem } from "../types/user.types";

/**
 * Standardized status check for Teachers & SDM.
 * Returns true if active, false if soft-deleted or inactive.
 */
export function isEntityActiveStatus(status: any, isDeleted?: boolean): boolean {
  if (isDeleted === true) return false;
  if (status === false) return false;
  if (typeof status === "string") {
    const s = status.toLowerCase().trim().replace(/[-\s_]/g, "");
    if (
      s === "nonaktif" ||
      s === "pensiun" ||
      s === "cuti" ||
      s === "ditangguhkan" ||
      s === "keluar" ||
      s === "pindah" ||
      s === "inactive" ||
      s === "disabled"
    ) {
      return false;
    }
  }
  return true; // "Aktif", true, or default undefined
}

/**
 * Checks if a teacher profile represents a genuine teaching Teacher (Guru),
 * rather than pure administrative / support staff (Tata Usaha, Operator, Satpam, Staff Kebersihan, Yayasan).
 */
export function isRealGuru(teacher: Teacher, matchedUser?: UserSystem | null): boolean {
  if (!isEntityActiveStatus(teacher.status, teacher.isDeleted)) {
    return false;
  }

  // 1. Cross-check with matched User account if present
  if (matchedUser) {
    if (matchedUser.isDeleted || !isEntityActiveStatus(matchedUser.status)) {
      return false;
    }
    const userRoles = (matchedUser.roles || [matchedUser.role || ""]).map((r) =>
      (r || "").toLowerCase().trim()
    );

    // Ketua Yayasan is strictly a foundation leader, never a teaching master guru
    if (userRoles.some((r) => r.includes("yayasan"))) {
      return false;
    }

    // Pure administrative / operator / TU without teaching role
    const isPureAdminOrOperatorOrTu = userRoles.every((r) =>
      r === "admin" ||
      r === "superadmin" ||
      r === "operator" ||
      r === "tata usaha" ||
      r === "tu" ||
      r === "staff"
    );

    const hasTeachingRoleInUser = userRoles.some(
      (r) =>
        r.includes("guru") ||
        r.includes("pengajar") ||
        r.includes("pendidik") ||
        r.includes("halaqoh")
    );

    if (isPureAdminOrOperatorOrTu && !hasTeachingRoleInUser) {
      // If they have no assigned subjects, they are not a guru
      if (!teacher.subjectIds || teacher.subjectIds.length === 0) {
        return false;
      }
    }
  }

  // 2. Check employeeType (Jenis PTK) in teacher record
  if (teacher.employeeType) {
    const et = teacher.employeeType.toLowerCase().trim();
    // Exclude explicit non-teaching PTK if they don't contain "guru", "pendidik", or "pengajar"
    const nonTeachingTypes = [
      "tata usaha",
      "tu",
      "operator",
      "satpam",
      "keamanan",
      "kebersihan",
      "cleaning",
      "driver",
      "tendik",
      "tenaga kependidikan",
      "staff",
      "yayasan"
    ];
    const isExplicitNonTeaching = nonTeachingTypes.some(
      (nt) => et === nt || et.startsWith(nt + " ") || et.endsWith(" " + nt)
    );
    const containsTeachingWord =
      et.includes("guru") ||
      et.includes("pendidik") ||
      et.includes("pengajar") ||
      et.includes("halaqoh");

    if (isExplicitNonTeaching && !containsTeachingWord) {
      if (!teacher.subjectIds || teacher.subjectIds.length === 0) {
        return false;
      }
    }
  }

  // 3. Check jabatans / roles in teacher record if present
  const jabatans = ((teacher as any).jabatans || (teacher as any).roles || []) as string[];
  if (Array.isArray(jabatans) && jabatans.length > 0) {
    const normalizedJabs = jabatans.map((j) => (j || "").toLowerCase().trim());
    const hasGuruJabatan = normalizedJabs.some(
      (j) => j.includes("guru") || j.includes("halaqoh") || j.includes("pendidik")
    );
    const isPureNonGuruJab = normalizedJabs.every(
      (j) => j === "tu" || j === "operator" || j === "staff" || j === "yayasan"
    );
    if (isPureNonGuruJab && !hasGuruJabatan) {
      if (!teacher.subjectIds || teacher.subjectIds.length === 0) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Deduplicates active teachers so 1 human teacher = 1 canonical record.
 * Deduplicates by:
 * 1. NIY (if valid non-empty)
 * 2. NUPTK (if valid non-empty)
 * 3. Email (if valid non-empty)
 * 4. Normalized clean Name
 */
export function getCanonicalActiveTeachers(
  allTeachers: Teacher[],
  allUsers: UserSystem[] = []
): Teacher[] {
  // Map users by various keys for fast lookup
  const userByTeacherId = new Map<string, UserSystem>();
  const userByEmail = new Map<string, UserSystem>();
  const userByName = new Map<string, UserSystem>();

  allUsers.forEach((u) => {
    if (u.teacherId) userByTeacherId.set(u.teacherId, u);
    if (u.email) userByEmail.set(u.email.toLowerCase().trim(), u);
    if (u.name) userByName.set(u.name.toLowerCase().trim().replace(/[^a-z0-9]/g, ""), u);
  });

  const seenKeys = new Set<string>();
  const canonicalTeachers: Teacher[] = [];

  for (const t of allTeachers) {
    // Find matched user
    const matchedUser =
      (t.id && userByTeacherId.get(t.id)) ||
      (t.teacherId && userByTeacherId.get(t.teacherId)) ||
      (t.email && userByEmail.get(t.email.toLowerCase().trim())) ||
      (t.name && userByName.get(t.name.toLowerCase().trim().replace(/[^a-z0-9]/g, "")));

    if (!isRealGuru(t, matchedUser)) {
      continue;
    }

    // Generate deduplication fingerprint
    const cleanNiy = (t.niy || "").trim();
    const cleanNuptk = (t.nuptk || "").trim();
    const cleanEmail = (t.email || "").toLowerCase().trim();
    const cleanName = (t.name || "").toLowerCase().trim().replace(/[^a-z0-9]/g, "");

    // Check if we've already included this teacher
    if (cleanNiy && cleanNiy !== "-" && seenKeys.has(`niy:${cleanNiy}`)) continue;
    if (cleanNuptk && cleanNuptk !== "-" && seenKeys.has(`nuptk:${cleanNuptk}`)) continue;
    if (cleanEmail && cleanEmail !== "-" && seenKeys.has(`email:${cleanEmail}`)) continue;
    if (cleanName && seenKeys.has(`name:${cleanName}`)) continue;

    // Record keys
    if (cleanNiy && cleanNiy !== "-") seenKeys.add(`niy:${cleanNiy}`);
    if (cleanNuptk && cleanNuptk !== "-") seenKeys.add(`nuptk:${cleanNuptk}`);
    if (cleanEmail && cleanEmail !== "-") seenKeys.add(`email:${cleanEmail}`);
    if (cleanName) seenKeys.add(`name:${cleanName}`);

    canonicalTeachers.push(t);
  }

  return canonicalTeachers;
}
