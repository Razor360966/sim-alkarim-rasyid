import { Schedule } from "../types";

export interface ScheduleMeeting {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  day: string;
  lessonPeriodIds: string[];
  scheduleIds: string[];
  jpRangeStr: string;
  totalJP: number;
  startTime: string;
  endTime: string;
  jpLabel: string;
}

/**
 * Consolidates individual JP schedule slots for the same teacher + subject + class on a given day
 * into single "Pertemuan" (Meeting) records with JP range and total JP duration.
 *
 * Example:
 * IPA Class VII on Saturday JP 1, JP 2, JP 3
 * => 1 Meeting: "Pertemuan ke-X: IPA (VII) - JP 1–3 (3 JP)"
 */
export function consolidateSchedulesToMeetings(schedules: Schedule[]): ScheduleMeeting[] {
  if (!schedules || schedules.length === 0) return [];

  // Group by key: teacherId + classId + subjectId + day
  const groups: Record<string, Schedule[]> = {};
  schedules.forEach((s) => {
    const key = `${s.teacherId}_${s.classId}_${s.subjectId}_${(s.day || "").toLowerCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  const meetings: ScheduleMeeting[] = [];

  Object.values(groups).forEach((group) => {
    // Sort by JP or startTime
    group.sort((a, b) => {
      const jpA = parseInt(String(a.jp || "").replace(/\D/g, "")) || (a.sequence || 0);
      const jpB = parseInt(String(b.jp || "").replace(/\D/g, "")) || (b.sequence || 0);
      if (jpA !== jpB) return jpA - jpB;
      const startA = (a as any).startTime || "";
      const startB = (b as any).startTime || "";
      return startA.localeCompare(startB);
    });

    // Group consecutive JPs
    let currentChunk: Schedule[] = [];

    group.forEach((sched) => {
      if (currentChunk.length === 0) {
        currentChunk.push(sched);
      } else {
        const lastSched = currentChunk[currentChunk.length - 1];
        const lastJp = parseInt(String(lastSched.jp || "").replace(/\D/g, "")) || (lastSched.sequence || 0);
        const currJp = parseInt(String(sched.jp || "").replace(/\D/g, "")) || (sched.sequence || 0);

        if (currJp > 0 && lastJp > 0 && currJp === lastJp + 1) {
          currentChunk.push(sched);
        } else if (currJp === lastJp && currJp > 0) {
          currentChunk.push(sched);
        } else {
          pushChunk(currentChunk);
          currentChunk = [sched];
        }
      }
    });

    if (currentChunk.length > 0) {
      pushChunk(currentChunk);
    }
  });

  function pushChunk(chunk: Schedule[]) {
    const first = chunk[0];
    const last = chunk[chunk.length - 1];

    const jpNumbers = chunk
      .map((s) => parseInt(String(s.jp || "").replace(/\D/g, "")))
      .filter((n) => !isNaN(n) && n > 0);

    let jpRangeStr = "";
    if (jpNumbers.length > 0) {
      const minJp = Math.min(...jpNumbers);
      const maxJp = Math.max(...jpNumbers);
      jpRangeStr = minJp === maxJp ? `JP ${minJp}` : `JP ${minJp}–${maxJp}`;
    } else {
      jpRangeStr = first.jp || "JP";
    }

    const totalJP = chunk.length;

    meetings.push({
      id: chunk.map((c) => c.id).join("__"),
      teacherId: first.teacherId,
      teacherName: first.teacherName,
      classId: first.classId,
      className: first.className,
      subjectId: first.subjectId,
      subjectName: first.subjectName,
      day: first.day,
      lessonPeriodIds: chunk.map((c) => c.lessonPeriodId).filter(Boolean) as string[],
      scheduleIds: chunk.map((c) => c.id),
      jpRangeStr,
      totalJP,
      startTime: (first as any).startTime || "07:00",
      endTime: (last as any).endTime || "08:20",
      jpLabel: `${jpRangeStr} (${totalJP} JP)`
    });
  }

  return meetings;
}
