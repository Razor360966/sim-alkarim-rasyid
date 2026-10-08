/**
 * halaqahRoleHelper.ts
 *
 * SSOT Helper for Guru Halaqoh & Musrif Role Authorization
 * SIMAK SMP ALKARIM RASYID (HALAQOH-RECAP-2.2)
 *
 * Business Rules:
 * 1. Guru Halaqoh adalah akun yang memiliki minimal salah satu role: Musrif ATAU Guru Halaqoh.
 * 2. Musrif = Guru Halaqoh.
 * 3. Guru Halaqoh = Guru Halaqoh.
 * 4. Musrif + Guru Halaqoh = Guru Halaqoh (Deduplikasi).
 * 5. Jika akun tidak memiliki kedua role tersebut (e.g. hanya "guru", "staff", atau roles: []):
 *    -> Akses absensi Halaqoh DITOLAK (DENY).
 *    -> Tidak boleh membuat attendance record baru.
 *    -> Tidak muncul sebagai Guru Halaqoh AKTIF.
 * 6. Historical immutability: record absensi lama tetap ada, pencabutan role tidak menghapus histori.
 */

export function normalizeHalaqohRole(role?: string): string {
  if (!role) return "";
  return role.toLowerCase().trim().replace(/_/g, " ");
}

/**
 * Checks if a given role or list of roles grants Guru Halaqoh / Musrif authority.
 * Strict RBAC: Must contain "musrif" or "guru halaqoh".
 */
export function isGuruHalaqohOrMusrif(role?: string, roles?: string[]): boolean {
  const normRole = normalizeHalaqohRole(role);
  const normRoles = (roles || []).map(normalizeHalaqohRole);

  const isHalaqoh = (r: string) => r === "musrif" || r === "guru halaqoh";

  return isHalaqoh(normRole) || normRoles.some(isHalaqoh);
}

export const HALAQOH_AUTH_DENIED_MESSAGE =
  "Akun Anda tidak memiliki role Guru Halaqoh/Musrif sehingga tidak memiliki akses untuk melakukan absensi Halaqoh.";
