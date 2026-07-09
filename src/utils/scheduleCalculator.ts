import { SchoolSettings, BreakTime, RoutineActivity } from "../types";

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

/**
 * Automatically generates the daily schedule blocks based on school settings and selected day.
 */
export function generateDailySchedule(settings: SchoolSettings, day: string): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  
  // Support custom school hours from schoolHours or fallback
  const startMins = timeToMinutes(settings.schoolHours?.startTime || settings.startTime || "07:00");
  const endMins = timeToMinutes(settings.schoolHours?.endTime || settings.endTime || "14:00");
  
  let currentTime = startMins;

  // Let's check for active routine activities for this specific day
  const routines = settings.routineActivities || [];
  
  // Find all active routine activities on this day
  const activeDayRoutines = routines.filter(r => 
    r.enabled && 
    r.days.some(d => 
      d.toLowerCase() === day.toLowerCase() || 
      d === "Semua Hari Aktif" || 
      d === "Semua"
    )
  );

  // Semua kegiatan tetap digunakan.
// Apel Pagi tidak pernah dihapus.
const finalDayRoutines = [...activeDayRoutines];

  // Create unified "fixed blocks" list combining routine activities and break times
  interface FixedBlock {
    id: string;
    name: string;
    start: number;
    end: number;
    duration: number;
    type: "assembly" | "special" | "break";
  }

  const fixedBlocks: FixedBlock[] = [];

  // 1. Add final day routines
  finalDayRoutines.forEach(r => {
    const rStart = timeToMinutes(r.startTime);
    let rDuration = r.duration;
    if (!rDuration && r.autoEndTime) {
      rDuration = Math.max(0, timeToMinutes(r.autoEndTime) - rStart);
    }
    if (!rDuration) {
      rDuration = 10;
    }

    fixedBlocks.push({
      id: r.id,
      name: r.name,
      start: rStart,
      end: rStart + rDuration,
      duration: rDuration,
      type: "assembly"
    });
  });

  // 2. Add break times
  (settings.breakTimes || []).forEach(b => {
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

  // Sort fixed blocks chronologically by start time
  fixedBlocks.sort((a, b) => a.start - b.start);

  let jpIndex = 1;
  const jpDuration = settings.lessonPeriod || settings.jpDuration || 40;

  // Sequentially calculate timeline blocks from startMins to endMins
  while (currentTime < endMins) {
    // A. Check if there is an active fixed block covering the currentTime
    const currentFixed = fixedBlocks.find(fb => currentTime >= fb.start && currentTime < fb.end);
    
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

    // B. Find the next fixed block starting after currentTime
    const nextFixed = fixedBlocks.find(fb => fb.start > currentTime);

    if (nextFixed) {
      // Check if we can fit a full JP before the next fixed block starts
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
        // We cannot fit a full JP. Output a gap/transition block
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
      // No more fixed blocks after currentTime. Check if we can fit a JP before school day ends
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
        // Remaining time to end of school hours is placed as End block
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
