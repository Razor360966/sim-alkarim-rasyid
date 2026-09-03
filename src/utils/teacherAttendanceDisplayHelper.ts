import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";

export interface AttendanceStatusDisplay {
  /**
   * Concept A: Status Presensi (Kondisi guru saat scan)
   * e.g. "HADIR", "TERLAMBAT 5 MENIT", "TERLAMBAT >15 MENIT — MENUNGGU VALIDASI", "TERLAMBAT >15 MENIT — DISETUJUI", "TIDAK HADIR"
   */
  statusLabel: string;

  /**
   * Concept B: Perhitungan Kehadiran (Menjelaskan apakah JP tersebut masuk ke jumlah JP hadir)
   * e.g. "1 JP", "0 JP", "0 JP (Terkunci)"
   */
  hadirJpText: string;
  hadirJpValue: number; // 0 or 1

  /**
   * Status category for color badges & visual hierarchy
   */
  category: 
    | "HADIR" 
    | "TERLAMBAT_TOLERANSI" 
    | "TERLAMBAT_PENDING" 
    | "TERLAMBAT_APPROVED" 
    | "TERLAMBAT_REJECTED" 
    | "TIDAK_HADIR" 
    | "SUBSTITUTION" 
    | "REPLACED" 
    | "EXCHANGE" 
    | "OTHER";

  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeFullClass: string;

  isLate: boolean;
  lateMinutes?: number;
  isPendingLateValidation: boolean;
}

/**
 * Standard Attendance Status Formatter
 * Adheres strictly to SIMAK Attendance Rules:
 * - lateMinutes <= 0 => HADIR (Hadir: 1 JP)
 * - lateMinutes > 0 && lateMinutes <= 15 => TERLAMBAT X MENIT (Hadir: 1 JP)
 * - lateMinutes > 15 && pending => TERLAMBAT X MENIT — MENUNGGU VALIDASI (Hadir: 0 JP Terkunci)
 * - lateMinutes > 15 && approved => TERLAMBAT X MENIT — DISETUJUI (Hadir: 1 JP)
 * - lateMinutes > 15 && rejected => TIDAK HADIR (Hadir: 0 JP)
 * - missed / expired sebelum scan => TIDAK HADIR (Hadir: 0 JP)
 * 
 * Separation of concerns:
 * Does NOT set status to HADIR just because hadirJP === 1.
 */
export function getAttendanceStatusDisplay(item: Partial<TeacherTeachingAttendance>): AttendanceStatusDisplay {
  // 1. Check if session was missed / expired before scan or marked Tidak Hadir / Alpa
  if (
    item.status === "Tidak Hadir" ||
    (item as any).status === "Alpa" ||
    item.lockReason === "SESI TERLEWAT SEBELUM SCAN PERTAMA"
  ) {
    return {
      statusLabel: "TIDAK HADIR",
      hadirJpText: "0 JP",
      hadirJpValue: 0,
      category: "TIDAK_HADIR",
      badgeBg: "bg-rose-100 dark:bg-rose-950",
      badgeText: "text-rose-800 dark:text-rose-300",
      badgeBorder: "border-rose-300 dark:border-rose-800",
      badgeFullClass: "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
      isLate: false,
      isPendingLateValidation: false
    };
  }

  // 2. Keterlambatan > 15 Menit evaluation
  const isLateOver15 = !!item.requiresLateValidation || (item.lateMinutes !== undefined && item.lateMinutes > 15);
  const currentValidationStatus = item.attendanceStatus || (
    item.requiresLateValidation
      ? (item.lateValidationStatus === "APPROVED" ? "Approved" : item.lateValidationStatus === "REJECTED" ? "Rejected" : "Pending")
      : undefined
  );

  if (isLateOver15) {
    const minutesLabel = item.lateMinutes && item.lateMinutes > 0 ? `${item.lateMinutes} MENIT` : ">15 MENIT";

    // Subcase 2a: Validasi Disetujui (Approved)
    if (currentValidationStatus === "Approved" || item.lateValidationStatus === "APPROVED") {
      return {
        statusLabel: `TERLAMBAT ${minutesLabel} — DISETUJUI`,
        hadirJpText: "1 JP",
        hadirJpValue: 1,
        category: "TERLAMBAT_APPROVED",
        badgeBg: "bg-emerald-100 dark:bg-emerald-950",
        badgeText: "text-emerald-800 dark:text-emerald-300",
        badgeBorder: "border-emerald-300 dark:border-emerald-800",
        badgeFullClass: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
        isLate: true,
        lateMinutes: item.lateMinutes,
        isPendingLateValidation: false
      };
    }

    // Subcase 2b: Validasi Ditolak (Rejected)
    if (currentValidationStatus === "Rejected" || item.lateValidationStatus === "REJECTED") {
      return {
        statusLabel: "TIDAK HADIR (VALIDASI DITOLAK)",
        hadirJpText: "0 JP",
        hadirJpValue: 0,
        category: "TERLAMBAT_REJECTED",
        badgeBg: "bg-rose-100 dark:bg-rose-950",
        badgeText: "text-rose-800 dark:text-rose-300",
        badgeBorder: "border-rose-300 dark:border-rose-800",
        badgeFullClass: "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
        isLate: true,
        lateMinutes: item.lateMinutes,
        isPendingLateValidation: false
      };
    }

    // Subcase 2c: Menunggu Validasi (Pending / Default for >15 min)
    return {
      statusLabel: `TERLAMBAT ${minutesLabel} — MENUNGGU VALIDASI`,
      hadirJpText: "0 JP (Terkunci)",
      hadirJpValue: 0,
      category: "TERLAMBAT_PENDING",
      badgeBg: "bg-rose-100 dark:bg-rose-950",
      badgeText: "text-rose-800 dark:text-rose-300",
      badgeBorder: "border-rose-300 dark:border-rose-800",
      badgeFullClass: "bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
      isLate: true,
      lateMinutes: item.lateMinutes,
      isPendingLateValidation: true
    };
  }

  // 3. Keterlambatan normal <= 15 Menit (Toleransi)
  if (
    (item.lateMinutes !== undefined && item.lateMinutes > 0 && item.lateMinutes <= 15) ||
    (item.status === "Terlambat" && !item.requiresLateValidation)
  ) {
    const minutesLabel = item.lateMinutes && item.lateMinutes > 0 ? `${item.lateMinutes} MENIT` : "≤15 MENIT";
    return {
      statusLabel: `TERLAMBAT ${minutesLabel}`,
      hadirJpText: "1 JP",
      hadirJpValue: 1,
      category: "TERLAMBAT_TOLERANSI",
      badgeBg: "bg-amber-100 dark:bg-amber-950",
      badgeText: "text-amber-800 dark:text-amber-300",
      badgeBorder: "border-amber-300 dark:border-amber-800",
      badgeFullClass: "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
      isLate: true,
      lateMinutes: item.lateMinutes,
      isPendingLateValidation: false
    };
  }

  // 4. Hadir Tepat Waktu (lateMinutes <= 0)
  if (
    item.status === "Hadir Mengajar" ||
    (item.checkInTime && (!item.lateMinutes || item.lateMinutes <= 0))
  ) {
    return {
      statusLabel: "HADIR",
      hadirJpText: "1 JP",
      hadirJpValue: 1,
      category: "HADIR",
      badgeBg: "bg-emerald-100 dark:bg-emerald-950",
      badgeText: "text-emerald-800 dark:text-emerald-300",
      badgeBorder: "border-emerald-300 dark:border-emerald-800",
      badgeFullClass: "bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
      isLate: false,
      lateMinutes: 0,
      isPendingLateValidation: false
    };
  }

  // 5. Belum Terkonfirmasi (Subsequent multi-JP block awaiting check-out)
  if (item.status === "Belum Terkonfirmasi") {
    return {
      statusLabel: "BELUM TERKONFIRMASI",
      hadirJpText: "-",
      hadirJpValue: 0,
      category: "OTHER",
      badgeBg: "bg-orange-100 dark:bg-orange-950",
      badgeText: "text-orange-800 dark:text-orange-300",
      badgeBorder: "border-orange-300 dark:border-orange-800",
      badgeFullClass: "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
      isLate: false,
      isPendingLateValidation: false
    };
  }

  // 6. Guru Pengganti / Menggantikan
  if (item.isSubstitution) {
    return {
      statusLabel: "MENGGANTIKAN GURU LAIN",
      hadirJpText: "1 JP (Pengganti)",
      hadirJpValue: 1,
      category: "SUBSTITUTION",
      badgeBg: "bg-purple-100 dark:bg-purple-950",
      badgeText: "text-purple-800 dark:text-purple-300",
      badgeBorder: "border-purple-300 dark:border-purple-800",
      badgeFullClass: "bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
      isLate: false,
      isPendingLateValidation: false
    };
  }

  // 7. Sesi Digantikan Guru Lain
  if (item.status === "Digantikan Guru Lain" || item.isReplaced) {
    return {
      statusLabel: "DIGANTIKAN GURU LAIN",
      hadirJpText: "0 JP",
      hadirJpValue: 0,
      category: "REPLACED",
      badgeBg: "bg-orange-100 dark:bg-orange-950",
      badgeText: "text-orange-800 dark:text-orange-300",
      badgeBorder: "border-orange-300 dark:border-orange-800",
      badgeFullClass: "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
      isLate: false,
      isPendingLateValidation: false
    };
  }

  // 8. Tukar Jadwal
  if (item.status === "Tukar Jadwal") {
    return {
      statusLabel: "TUKAR JADWAL",
      hadirJpText: "1 JP",
      hadirJpValue: 1,
      category: "EXCHANGE",
      badgeBg: "bg-indigo-100 dark:bg-indigo-950",
      badgeText: "text-indigo-800 dark:text-indigo-300",
      badgeBorder: "border-indigo-300 dark:border-indigo-800",
      badgeFullClass: "bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
      isLate: false,
      isPendingLateValidation: false
    };
  }

  // 9. Berhalangan (Izin, Sakit, Tugas Dinas)
  if (item.status === "Izin" || item.status === "Sakit" || item.status === "Tugas Dinas") {
    const isTugas = item.status === "Tugas Dinas";
    return {
      statusLabel: item.status.toUpperCase(),
      hadirJpText: isTugas ? "1 JP" : "0 JP",
      hadirJpValue: isTugas ? 1 : 0,
      category: "OTHER",
      badgeBg: isTugas ? "bg-blue-100 dark:bg-blue-950" : "bg-yellow-100 dark:bg-yellow-950",
      badgeText: isTugas ? "text-blue-800 dark:text-blue-300" : "text-yellow-800 dark:text-yellow-300",
      badgeBorder: isTugas ? "border-blue-300 dark:border-blue-800" : "border-yellow-300 dark:border-yellow-800",
      badgeFullClass: isTugas 
        ? "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800" 
        : "bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
      isLate: false,
      isPendingLateValidation: false
    };
  }

  // 10. Default / Fallback
  return {
    statusLabel: (item.status || "BELUM DIVERIFIKASI").toUpperCase(),
    hadirJpText: "-",
    hadirJpValue: 0,
    category: "OTHER",
    badgeBg: "bg-slate-100 dark:bg-zinc-800",
    badgeText: "text-slate-700 dark:text-zinc-300",
    badgeBorder: "border-slate-300 dark:border-zinc-700",
    badgeFullClass: "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
    isLate: false,
    isPendingLateValidation: false
  };
}
