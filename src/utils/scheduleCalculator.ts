import { SchoolSettings, BreakTime, RoutineActivity, DailyStructure, DailyActivity } from "../types";

export interface TimelineBlock {
  type: "assembly" | "special" | "jp" | "break" | "gap" | "end";
  name: string;
  start: string; // HH:MM
  end: string; // HH:MM
  duration: number; // minutes
  jpNumber?: number; // index of JP (1, 2, 3...)
}

// Helper to convert "HH:MM" to minutes since midnight
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

// Helper to convert minutes since midnight back to "HH:MM"
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const hStr = hours.toString().padStart(2, "0");
  const mStr = mins.toString().padStart(2, "0");
  return `${hStr}:${mStr}`;
}

const ALL_DAYS = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

/**
 * Generate default daily structure for all days if not yet configured in Firestore.
 * Supports legacy routineActivities & breakTimes migration cleanly.
 */
export function getDefaultDailyStructures(settings?: Partial<SchoolSettings>): DailyStructure[] {
  const existingRoutines = settings?.routineActivities || [];
  const existingBreaks = settings?.breakTimes || [];

  return ALL_DAYS.map((day) => {
    // If legacy routineActivities exist, map them
    const matchingRoutines = existingRoutines.filter((r) =>
      r.days.some((d) => d.toLowerCase() === day.toLowerCase() || d === "Semua Hari Aktif" || d === "Semua")
    );

    const activities: DailyActivity[] = [];
    let order = 1;

    if (matchingRoutines.length > 0) {
      // Map existing routines
      matchingRoutines.forEach((r) => {
        const start = r.startTime || "07:00";
        const duration = r.duration || 10;
        const end = r.autoEndTime || minutesToTime(timeToMinutes(start) + duration);
        let actType = "KEGIATAN_SEKOLAH";
        const lowerName = r.name.toLowerCase();
        if (lowerName.includes("apel")) actType = "APEL";
        else if (lowerName.includes("upacara")) actType = "UPACARA";
        else if (lowerName.includes("halaqoh") || lowerName.includes("tahfidz") || lowerName.includes("qur'an")) actType = "HALAQOH";
        else if (lowerName.includes("senam")) actType = "SENAM";
        else if (lowerName.includes("sholat") || lowerName.includes("dhuha") || lowerName.includes("dzikir")) actType = "IBADAH";

        activities.push({
          id: r.id || `act-${day.toLowerCase()}-${order}`,
          name: r.name,
          type: actType,
          isActive: r.enabled !== false,
          startTime: start,
          endTime: end,
          durationMinutes: duration,
          order: order++
        });
      });
    } else {
      // Clean default activities per day
      if (day === "Senin") {
        activities.push({
          id: `act-${day.toLowerCase()}-1`,
          name: "Upacara Bendera",
          type: "UPACARA",
          isActive: true,
          startTime: "07:00",
          endTime: "08:00",
          durationMinutes: 60,
          order: order++
        });
        activities.push({
          id: `act-${day.toLowerCase()}-2`,
          name: "Sholat Dhuha",
          type: "IBADAH",
          isActive: true,
          startTime: "08:00",
          endTime: "08:30",
          durationMinutes: 30,
          order: order++
        });
        activities.push({
          id: `act-${day.toLowerCase()}-3`,
          name: "Apel Pagi",
          type: "APEL",
          isActive: false,
          startTime: "07:00",
          endTime: "07:10",
          durationMinutes: 10,
          order: order++
        });
        activities.push({
          id: `act-${day.toLowerCase()}-4`,
          name: "Halaqoh Al-Qur'an",
          type: "HALAQOH",
          isActive: false,
          startTime: "07:10",
          endTime: "07:40",
          durationMinutes: 30,
          order: order++
        });
      } else if (day === "Jumat") {
        activities.push({
          id: `act-${day.toLowerCase()}-1`,
          name: "Senam Pagi",
          type: "SENAM",
          isActive: true,
          startTime: "07:00",
          endTime: "07:40",
          durationMinutes: 40,
          order: order++
        });
      } else {
        activities.push({
          id: `act-${day.toLowerCase()}-1`,
          name: "Apel Pagi",
          type: "APEL",
          isActive: true,
          startTime: "07:00",
          endTime: "07:10",
          durationMinutes: 10,
          order: order++
        });
        activities.push({
          id: `act-${day.toLowerCase()}-2`,
          name: "Halaqoh Al-Qur'an",
          type: "HALAQOH",
          isActive: true,
          startTime: "07:10",
          endTime: "07:40",
          durationMinutes: 30,
          order: order++
        });
      }
    }

    // Map existing break times or sensible defaults
    if (existingBreaks.length > 0) {
      existingBreaks.forEach((b) => {
        activities.push({
          id: b.id || `break-${day.toLowerCase()}-${order}`,
          name: b.name,
          type: "ISTIRAHAT",
          isActive: true,
          startTime: b.start,
          endTime: b.end || minutesToTime(timeToMinutes(b.start) + b.duration),
          durationMinutes: b.duration,
          order: order++
        });
      });
    } else {
      activities.push({
        id: `break-${day.toLowerCase()}-1`,
        name: "Istirahat 1",
        type: "ISTIRAHAT",
        isActive: true,
        startTime: day === "Senin" ? "09:50" : "09:40",
        endTime: day === "Senin" ? "10:20" : "10:10",
        durationMinutes: 30,
        order: order++
      });
      activities.push({
        id: `break-${day.toLowerCase()}-2`,
        name: "Istirahat 2 / Dzuhur",
        type: "ISTIRAHAT",
        isActive: true,
        startTime: "12:00",
        endTime: "12:40",
        durationMinutes: 40,
        order: order++
      });
    }

    return {
      day,
      isActive: (settings?.activeDays || ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"]).includes(day),
      activities
    };
  });
}

interface InternalFixedBlock {
  id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  type: "assembly" | "special" | "break";
}

/**
 * Automatically generates the daily schedule blocks based on school settings and selected day.
 * Fully dynamic: respects admin's daily structure configurations with zero hardcoded activity assumptions.
 */
export function generateDailySchedule(settings: SchoolSettings, day: string): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  // Support custom school hours from schoolHours or fallback
  const startMins = timeToMinutes(settings.schoolHours?.startTime || settings.startTime || "07:00");
  const endMins = timeToMinutes(settings.schoolHours?.endTime || settings.endTime || "14:00");
  const jpDuration = settings.lessonPeriod || settings.jpDuration || 40;

  let currentTime = startMins;
  const fixedBlocks: InternalFixedBlock[] = [];

  // 1. PRIMARY SOURCE OF TRUTH: settings.dailyStructures
  const dayStructure = settings.dailyStructures?.find(
    (ds) => ds.day.toLowerCase() === day.toLowerCase()
  );

  if (dayStructure) {
    // If the day is explicitly marked as non-active/holiday
    if (dayStructure.isActive === false) {
      return [
        {
          type: "end",
          name: "Hari Libur / Non-Aktif",
          start: minutesToTime(startMins),
          end: minutesToTime(endMins),
          duration: Math.max(0, endMins - startMins)
        }
      ];
    }

    // Only include activities that are active (isActive !== false)
    const activeActivities = (dayStructure.activities || []).filter((a) => a.isActive !== false);

    activeActivities.forEach((act) => {
      const actStart = timeToMinutes(act.startTime || "07:00");
      let actDuration = act.durationMinutes;
      if (!actDuration && act.endTime) {
        actDuration = Math.max(0, timeToMinutes(act.endTime) - actStart);
      }
      if (!actDuration) {
        actDuration = 10;
      }
      const actEnd = act.endTime ? timeToMinutes(act.endTime) : actStart + actDuration;

      let blockType: "assembly" | "special" | "break" = "special";
      const typeUpper = (act.type || "").toUpperCase();
      if (typeUpper === "ISTIRAHAT") {
        blockType = "break";
      } else if (typeUpper === "APEL" || typeUpper === "UPACARA" || typeUpper === "SENAM") {
        blockType = "assembly";
      }

      fixedBlocks.push({
        id: act.id,
        name: act.name,
        start: actStart,
        end: actEnd,
        duration: actDuration,
        type: blockType
      });
    });
  } else {
    // 2. BACKWARDS COMPATIBILITY FALLBACK: routineActivities & breakTimes
    const routines = settings.routineActivities || [];
    const activeDayRoutines = routines.filter(
      (r) =>
        r.enabled &&
        r.days.some(
          (d) =>
            d.toLowerCase() === day.toLowerCase() ||
            d === "Semua Hari Aktif" ||
            d === "Semua"
        )
    );

    activeDayRoutines.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    let routineTracker = startMins;
    activeDayRoutines.forEach((r) => {
      let rStart = timeToMinutes(r.startTime);
      if (rStart < routineTracker) {
        rStart = routineTracker;
      }
      let rDuration = r.duration;
      if (!rDuration && r.autoEndTime) {
        rDuration = Math.max(0, timeToMinutes(r.autoEndTime) - rStart);
      }
      if (!rDuration) {
        rDuration = 10;
      }
      const rEnd = rStart + rDuration;
      routineTracker = rEnd;

      fixedBlocks.push({
        id: r.id,
        name: r.name,
        start: rStart,
        end: rEnd,
        duration: rDuration,
        type: "assembly"
      });
    });

    (settings.breakTimes || []).forEach((b) => {
      const bStart = timeToMinutes(b.start);
      fixedBlocks.push({
        id: b.id,
        name: b.name,
        start: bStart,
        end: bStart + b.duration,
        duration: b.duration,
        type: "break"
      });
    });
  }

  // Sort fixed blocks chronologically by start time
  fixedBlocks.sort((a, b) => a.start - b.start);

  let jpIndex = 1;

  // Sequentially calculate timeline blocks from startMins to endMins
  while (currentTime < endMins) {
    // A. Check if there is an active fixed block covering currentTime
    const currentFixed = fixedBlocks.find((fb) => currentTime >= fb.start && currentTime < fb.end);

    if (currentFixed) {
      blocks.push({
        type: currentFixed.type,
        name: currentFixed.name,
        start: minutesToTime(currentFixed.start),
        end: minutesToTime(currentFixed.end),
        duration: currentFixed.duration
      });
      currentTime = currentFixed.end;
      continue;
    }

    // B. Find next fixed block starting after currentTime
    const nextFixed = fixedBlocks.find((fb) => fb.start > currentTime);

    if (nextFixed) {
      // Check if we can fit a full JP before the next fixed block
      if (currentTime + jpDuration <= nextFixed.start) {
        blocks.push({
          type: "jp",
          name: `JP ${jpIndex}`,
          start: minutesToTime(currentTime),
          end: minutesToTime(currentTime + jpDuration),
          duration: jpDuration,
          jpNumber: jpIndex
        });
        jpIndex++;
        currentTime += jpDuration;
      } else {
        // Gap / Transition block
        const gapDuration = nextFixed.start - currentTime;
        blocks.push({
          type: "gap",
          name: "Jeda Perpindahan",
          start: minutesToTime(currentTime),
          end: minutesToTime(nextFixed.start),
          duration: gapDuration
        });
        currentTime = nextFixed.start;
      }
    } else {
      // No more fixed blocks after currentTime. Fit JP until endMins
      if (currentTime + jpDuration <= endMins) {
        blocks.push({
          type: "jp",
          name: `JP ${jpIndex}`,
          start: minutesToTime(currentTime),
          end: minutesToTime(currentTime + jpDuration),
          duration: jpDuration,
          jpNumber: jpIndex
        });
        jpIndex++;
        currentTime += jpDuration;
      } else {
        const remaining = endMins - currentTime;
        if (remaining > 0) {
          blocks.push({
            type: "end",
            name: "Selesai Kegiatan",
            start: minutesToTime(currentTime),
            end: minutesToTime(endMins),
            duration: remaining
          });
        }
        currentTime = endMins;
      }
    }
  }

  return blocks;
}
