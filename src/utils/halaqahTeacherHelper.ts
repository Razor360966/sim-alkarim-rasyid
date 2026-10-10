/**
 * halaqahTeacherHelper.ts
 *
 * SSOT Helper for Canonical Guru Halaqoh & Musrif Identity Resolution
 * SIMAK SMP ALKARIM RASYID (HALAQOH-RECAP-2.3)
 *
 * Rules:
 * 1. Identitas guru HARUS berdasarkan ID, BUKAN nama (Set of names dilarang).
 * 2. Prioritas identitas canonical:
 *    Priority 1: teacherId yang valid
 *    Priority 2: userId yang valid
 *    Priority 3: id akun
 * 3. Akun/orang yang sama dengan multiple record (linked via teacherId, email, atau account id)
 *    dideduplikasi menjadi 1 orang dengan canonical ID.
 * 4. Dua orang berbeda dengan nama yang sama (tetapi ID berbeda) TETAP dianggap 2 orang berbeda.
 * 5. Akun yang TIDAK memiliki role Musrif atau Guru Halaqoh TIDAK BOLEH muncul.
 * 6. Akun tidak aktif / isDeleted TIDAK BOLEH muncul.
 */

import { UserSystem } from "../types/user.types";
import { Teacher } from "../types/teacher";
import { HalaqahGroup } from "../types/musrifJournal.types";
import { isGuruHalaqohOrMusrif } from "./halaqahRoleHelper";

export interface CanonicalTeacherOption {
  id: string; // Canonical ID
  name: string; // Display Name
  email?: string;
}

export interface TeacherIdentityResolver {
  canonicalTeachers: CanonicalTeacherOption[];
  resolveCanonicalId: (rawId: string) => string;
  isAuthorizedHalaqohTeacher: (idOrEmail: string) => boolean;
  getDisplayName: (id: string) => string | undefined;
}

/**
 * Checks if a string is a valid non-empty, non-sentinel ID.
 */
export function isValidId(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "null" || trimmed === "undefined") {
    return false;
  }
  return true;
}

/**
 * Resolves the primary canonical ID from a single user object.
 * Strictly respects priority: teacherId > userId > id.
 */
export function getPrimaryCanonicalId(u: Partial<UserSystem>): string {
  if (isValidId(u.teacherId)) return u.teacherId!.trim();
  if (isValidId(u.userId)) return u.userId!.trim();
  if (isValidId(u.id)) return u.id!.trim();
  return "";
}

/**
 * Builds a comprehensive canonical teacher resolver from user accounts,
 * teacher records, and group assignments.
 *
 * Rules (HALAQOH-RECAP-2.4):
 * 1. Identitas guru HARUS berdasarkan ID, BUKAN nama (Set of names dilarang).
 * 2. Prioritas identitas canonical:
 *    Priority 1: teacherId yang valid (dari teachers atau users.teacherId)
 *    Priority 2: userId yang valid
 *    Priority 3: id akun user
 * 3. Mapping account-to-teacher divalidasi berdasarkan data real:
 *    - Direct link: u.teacherId === t.id
 *    - Reverse link: t.userId === u.id || t.userId === u.userId
 *    - Email match: u.email === t.email
 *    - NIY match: u.niy === t.niy
 *    - NUPTK match: u.nuptk === t.nuptk
 *    - Phone match: u.phoneNumber === t.phone
 * 4. Akun dengan multiple role (Musrif + Guru Halaqoh) tetap 1 akun & 1 guru.
 * 5. Dua orang berbeda dengan nama sama TETAP dianggap 2 orang berbeda (ID berbeda).
 * 6. Akun yang TIDAK memiliki role Musrif atau Guru Halaqoh TIDAK BOLEH masuk daftar guru aktif.
 * 7. Akun tidak aktif / isDeleted TIDAK BOLEH masuk daftar guru aktif.
 */
export function buildTeacherIdentityResolver(
  allUsers: UserSystem[] = [],
  allTeachers: Partial<Teacher>[] = [],
  groups: HalaqahGroup[] = []
): TeacherIdentityResolver {
  // 1. Filter only active, non-deleted users possessing active Musrif or Guru Halaqoh role
  const activeHalaqohUsers = allUsers.filter((u) => {
    if (u.isDeleted === true) return false;
    if (u.status && u.status.toLowerCase().trim() !== "aktif") return false;
    return isGuruHalaqohOrMusrif(u.role, u.roles);
  });

  // Filter active teachers
  const activeTeachers = allTeachers.filter((t) => t.isDeleted !== true);

  const emailToCanonicalId = new Map<string, string>();
  const idToCanonicalId = new Map<string, string>();
  const canonicalMap = new Map<string, { id: string; name: string; email?: string }>();

  // 2. Link each active halaqoh user to teacher record via verified mappings
  for (const u of activeHalaqohUsers) {
    const uTeacherId = isValidId(u.teacherId) ? u.teacherId!.trim() : "";
    const uUserId = isValidId(u.userId) ? u.userId!.trim() : "";
    const uId = isValidId(u.id) ? u.id!.trim() : "";
    const uEmail = u.email ? u.email.toLowerCase().trim() : "";
    const uNiy = u.niy ? u.niy.trim() : "";
    const uNuptk = u.nuptk ? u.nuptk.trim() : "";
    const uPhone = u.phoneNumber ? u.phoneNumber.trim() : "";

    // Find linked teacher in activeTeachers
    const linkedTeacher = activeTeachers.find((t) => {
      const tId = isValidId(t.id) ? t.id!.trim() : "";
      const tTeacherId = isValidId(t.teacherId) ? t.teacherId!.trim() : "";
      const tUserId = isValidId((t as any).userId) ? (t as any).userId!.trim() : "";
      const tEmail = t.email ? t.email.toLowerCase().trim() : "";
      const tNiy = t.niy ? t.niy.trim() : "";
      const tNuptk = t.nuptk ? t.nuptk.trim() : "";
      const tPhone = t.phone ? t.phone.trim() : "";

      // Condition 1: Direct teacherId match
      if (uTeacherId && (tId === uTeacherId || tTeacherId === uTeacherId)) return true;
      // Condition 2: Reverse userId match
      if (tUserId && (tUserId === uId || tUserId === uUserId)) return true;
      // Condition 3: Verified email match
      if (uEmail && tEmail && uEmail === tEmail) return true;
      // Condition 4: NIY match
      if (uNiy && tNiy && uNiy === tNiy) return true;
      // Condition 5: NUPTK match
      if (uNuptk && tNuptk && uNuptk === tNuptk) return true;
      // Condition 6: Phone match (normalized digits)
      const cleanDigits = (p?: string) => (p ? p.replace(/[^0-9]/g, "") : "");
      const uDigits = cleanDigits(uPhone);
      const tDigits = cleanDigits(tPhone);
      if (uDigits && tDigits && uDigits === tDigits) return true;

      return false;
    });

    const effectiveTeacherId =
      uTeacherId ||
      (linkedTeacher ? (isValidId(linkedTeacher.id) ? linkedTeacher.id!.trim() : linkedTeacher.teacherId?.trim() || "") : "");

    // Determine canonical ID strictly by priority:
    // Priority 1: teacherId
    // Priority 2: userId
    // Priority 3: id
    let canonicalId =
      (effectiveTeacherId && idToCanonicalId.get(effectiveTeacherId)) ||
      (uUserId && idToCanonicalId.get(uUserId)) ||
      (uId && idToCanonicalId.get(uId)) ||
      (uEmail && emailToCanonicalId.get(uEmail)) ||
      "";

    if (!canonicalId) {
      canonicalId = effectiveTeacherId || uUserId || uId;
    }

    if (!canonicalId) continue;

    // Register all aliases of this user to canonical ID
    idToCanonicalId.set(canonicalId, canonicalId);
    if (effectiveTeacherId) idToCanonicalId.set(effectiveTeacherId, canonicalId);
    if (uTeacherId) idToCanonicalId.set(uTeacherId, canonicalId);
    if (uUserId) idToCanonicalId.set(uUserId, canonicalId);
    if (uId) idToCanonicalId.set(uId, canonicalId);
    if (uEmail) emailToCanonicalId.set(uEmail, canonicalId);

    // Register teacher record aliases if linked
    if (linkedTeacher) {
      if (isValidId(linkedTeacher.id)) idToCanonicalId.set(linkedTeacher.id!.trim(), canonicalId);
      if (isValidId(linkedTeacher.teacherId)) idToCanonicalId.set(linkedTeacher.teacherId!.trim(), canonicalId);
      if (isValidId((linkedTeacher as any).userId)) idToCanonicalId.set((linkedTeacher as any).userId!.trim(), canonicalId);
      if (linkedTeacher.email) emailToCanonicalId.set(linkedTeacher.email.toLowerCase().trim(), canonicalId);
    }

    // Determine display name with official titles if available
    let displayName = "Guru Halaqoh";
    if (linkedTeacher) {
      const front = linkedTeacher.frontTitle ? linkedTeacher.frontTitle.trim() + " " : "";
      const back = linkedTeacher.backTitle ? ", " + linkedTeacher.backTitle.trim() : "";
      const rawName = linkedTeacher.name ? linkedTeacher.name.trim() : "";
      if (rawName) {
        displayName = (rawName.includes(back.trim()) || !back)
          ? `${front}${rawName}`.trim()
          : `${front}${rawName}${back}`.trim();
      }
    }
    if (displayName === "Guru Halaqoh") {
      displayName = u.name?.trim() || u.teacherName?.trim() || "Guru Halaqoh";
    }

    const existing = canonicalMap.get(canonicalId);
    if (!existing) {
      canonicalMap.set(canonicalId, {
        id: canonicalId,
        name: displayName,
        email: uEmail || linkedTeacher?.email || undefined
      });
    } else {
      if (existing.name === "Guru Halaqoh" && displayName !== "Guru Halaqoh") {
        existing.name = displayName;
      }
    }
  }

  // 3. Register groups aliases
  for (const g of groups) {
    if (isValidId(g.musrifId)) {
      const trimmedMusrifId = g.musrifId.trim();
      const resolved = idToCanonicalId.get(trimmedMusrifId);
      if (resolved) {
        idToCanonicalId.set(trimmedMusrifId, resolved);
      }
    }
  }

  const canonicalTeachers = Array.from(canonicalMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const resolveCanonicalId = (rawId: string): string => {
    if (!rawId) return "";
    const trimmed = rawId.trim();
    return idToCanonicalId.get(trimmed) || trimmed;
  };

  const isAuthorizedHalaqohTeacher = (idOrEmail: string): boolean => {
    if (!idOrEmail) return false;
    const trimmed = idOrEmail.trim();
    const cleanEmail = trimmed.toLowerCase();
    const resolved = idToCanonicalId.get(trimmed) || emailToCanonicalId.get(cleanEmail);
    return !!resolved && canonicalMap.has(resolved);
  };

  const getDisplayName = (id: string): string | undefined => {
    if (!id) return undefined;
    const canonicalId = resolveCanonicalId(id);
    return canonicalMap.get(canonicalId)?.name;
  };

  return {
    canonicalTeachers,
    resolveCanonicalId,
    isAuthorizedHalaqohTeacher,
    getDisplayName
  };
}
