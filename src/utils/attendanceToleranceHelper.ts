/**
 * attendanceToleranceHelper.ts
 * 
 * Single Source of Truth (SSOT) for Attendance Lateness and Tolerance Calculations.
 * SMP ALKARIM RASYID - SIMAK Attendance System.
 * 
 * Core Logic:
 * Jam Masuk Resmi + Toleransi Keterlambatan = Batas Akhir Toleransi
 * - Check-in <= Batas Akhir Toleransi -> TIDAK TERLAMBAT (Hadir Tepat Waktu)
 * - Check-in > Batas Akhir Toleransi  -> TERLAMBAT
 * 
 * Actual late duration (lateMinutes):
 * If Late: lateMinutes = Check-in - Jam Masuk Resmi (aktual durasi dari jam masuk)
 * If Not Late: lateMinutes = 0
 */

export interface LateEvaluationResult {
  isLate: boolean;
  lateMinutes: number;
  officialStartM: number;
  checkInM: number;
  toleranceMinutes: number;
  cutoffM: number;
  cutoffTimeStr: string;
  notes?: string;
}

/**
 * Parse time string ("HH:MM", "HH:MM:SS", or ISO date string) or number into minutes from midnight (WIB).
 */
export function parseTimeToMinutes(time: string | number | undefined | null): number {
  if (time === undefined || time === null) return 0;
  if (typeof time === "number") return time;

  const str = String(time).trim();
  if (!str) return 0;

  // Handle ISO string or date string (extract time part or parse)
  if (str.includes("T")) {
    try {
      const d = new Date(str);
      // Format to WIB hour & minute
      const timeParts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).format(d).split(":");
      return parseInt(timeParts[0], 10) * 60 + parseInt(timeParts[1], 10);
    } catch {
      // fallback to regex matching
    }
  }

  // Handle "HH:MM" or "HH:MM:SS"
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }

  return 0;
}

/**
 * Format minutes from midnight into 24-hour "HH:MM" format.
 */
export function formatMinutesToTime(minutes: number): string {
  const normalized = Math.max(0, Math.floor(minutes));
  const h = Math.floor(normalized / 60) % 24;
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Core function to evaluate whether a check-in is late.
 * 
 * @param checkInTime - Time of check-in ("07:05", "07:11", or minute number)
 * @param officialStartTime - Official schedule start time ("07:00", or minute number)
 * @param toleranceMinutes - Tolerance allowed in minutes (integer >= 0)
 * @returns boolean - true if checkInTime > (officialStartTime + toleranceMinutes)
 */
export function isLate(
  checkInTime: string | number,
  officialStartTime: string | number,
  toleranceMinutes: number
): boolean {
  const checkInM = parseTimeToMinutes(checkInTime);
  const startM = parseTimeToMinutes(officialStartTime);
  const tol = Math.max(0, Math.floor(Number(toleranceMinutes) || 0));
  const cutoffM = startM + tol;

  return checkInM > cutoffM;
}

/**
 * Full calculation of lateness status, actual late duration, and cutoff times.
 * 
 * Example 1:
 * Jam masuk = 07:00, Check-in = 07:05, Toleransi = 10 menit
 * Batas = 07:10 -> isLate = false, lateMinutes = 0
 * 
 * Example 2:
 * Jam masuk = 07:00, Check-in = 07:17, Toleransi = 10 menit
 * Batas = 07:10 -> isLate = true, lateMinutes = 17 (actual lateness from 07:00)
 */
export function evaluateLateness(
  checkInTime: string | number,
  officialStartTime: string | number,
  toleranceMinutes: number
): LateEvaluationResult {
  const checkInM = parseTimeToMinutes(checkInTime);
  const startM = parseTimeToMinutes(officialStartTime);
  const tol = Math.max(0, Math.floor(Number(toleranceMinutes) || 0));
  const cutoffM = startM + tol;

  const late = checkInM > cutoffM;
  // Actual late duration from official start time
  const lateMinutes = late ? Math.max(1, checkInM - startM) : 0;

  return {
    isLate: late,
    lateMinutes,
    officialStartM: startM,
    checkInM,
    toleranceMinutes: tol,
    cutoffM,
    cutoffTimeStr: formatMinutesToTime(cutoffM),
    notes: late
      ? `Terlambat ${lateMinutes} menit (Batas toleransi: ${formatMinutesToTime(cutoffM)} WIB)`
      : (checkInM > startM ? `Dalam batas toleransi (+${checkInM - startM} mnt dari jam masuk)` : "Tepat Waktu")
  };
}

/**
 * Validate and sanitize custom tolerance minutes input.
 * Rules:
 * - Must be an integer
 * - Must be >= 0 (no negative values)
 * - If empty/NaN, safely returns default value (default: 15)
 */
export function validateToleranceMinutes(
  input: any,
  defaultValue = 15
): { isValid: boolean; value: number; error?: string } {
  if (input === "" || input === null || input === undefined) {
    return {
      isValid: false,
      value: defaultValue,
      error: "Toleransi tidak boleh kosong. Gunakan angka >= 0."
    };
  }

  const num = Number(input);
  if (isNaN(num)) {
    return {
      isValid: false,
      value: defaultValue,
      error: "Toleransi keterlambatan harus berupa angka."
    };
  }

  if (num < 0) {
    return {
      isValid: false,
      value: defaultValue,
      error: "Toleransi keterlambatan tidak boleh bernilai negatif (minimal 0 menit)."
    };
  }

  const integerVal = Math.floor(num);
  return {
    isValid: true,
    value: integerVal
  };
}

/**
 * Helper to safely extract effective late tolerance minutes from SchoolSettings or TeachingAttendanceSettings.
 * Checks lateToleranceMinutes -> checkInToleranceMinutes -> default 15.
 */
export function getEffectiveLateTolerance(settings?: any): number {
  if (!settings) return 15;
  const tas = settings.teachingAttendanceSettings || settings;
  if (typeof tas.lateToleranceMinutes === "number" && tas.lateToleranceMinutes >= 0) {
    return Math.floor(tas.lateToleranceMinutes);
  }
  if (typeof tas.checkInToleranceMinutes === "number" && tas.checkInToleranceMinutes >= 0) {
    return Math.floor(tas.checkInToleranceMinutes);
  }
  return 15;
}
