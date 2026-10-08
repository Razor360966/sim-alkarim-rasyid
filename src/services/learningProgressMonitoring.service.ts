/**
 * learningProgressMonitoring.service.ts
 * 
 * Service for Weekly Learning Progress Monitoring
 * SIMAK SMP ALKARIM RASYID
 * 
 * Pipeline:
 * Prota -> Prosem -> Jadwal Operasional Pondok -> Jurnal Mengajar -> Monitoring Progres
 * 
 * Strictly READ-ONLY. Does NOT mutate schedules, journals, prota, or prosem.
 * Timezone: Asia/Jakarta.
 * Operational School Week: Sabtu s/d Kamis (Jumat Libur).
 */

import { curriculumPlanningService } from "./curriculumPlanning.service";
import { scheduleService, resolveTeacherForScheduleDate } from "./schedule.service";
import { teachingJournalService } from "./teachingJournalService";
import { teacherAssignmentService } from "./teacherAssignment.service";
import {
  LearningProgressItem,
  LearningProgressStatus,
  LearningProgressSummary,
  SchoolWeekPeriod,
  WeeklyCumulativeRow,
  MaterialProgressStatus,
  SubtopicProgressBreakdown,
  TopicMaterialProgressItem,
  CalculateMaterialProgressParams,
  MaterialProgressResult,
  ExecutiveProgressSummary
} from "../types/learningProgressMonitoring.types";
import { SemesterProgram, PromesMeetingEntry, AnnualProgram, ProtaTopic } from "../types/curriculumPlanning.types";
import { Schedule, TeacherAssignment } from "../types/schedule.types";
import { TeachingJournal } from "../types/teachingJournal.types";

/**
 * Format Date to YYYY-MM-DD in Asia/Jakarta timezone
 */
export function formatDateJakarta(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

/**
 * Parse YYYY-MM-DD string into a local Date object without UTC drift
 */
export function parseDateString(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // midday to avoid daylight/boundary shift
}

/**
 * Format YYYY-MM-DD to Indonesian short display
 */
export function formatIndonesianDateShort(dateStr: string): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
  ];
  return `${String(d).padStart(2, "0")} ${months[m - 1]} ${y}`;
}

/**
 * Generate operational school weeks (Sabtu - Kamis, Jumat Libur)
 * between two dates inclusive.
 */
export function generateSchoolWeeks(
  startDateStr: string,
  endDateStr: string,
  todayStr: string = formatDateJakarta(new Date())
): SchoolWeekPeriod[] {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) {
    return [];
  }

  const weeks: SchoolWeekPeriod[] = [];
  let currentDate = parseDateString(startDateStr);
  const endLimit = parseDateString(endDateStr);

  let weekIndex = 1;

  while (currentDate <= endLimit) {
    // Current day of week: 0=Sun, 1=Mon, ..., 4=Thu, 5=Fri, 6=Sat
    const currentDayOfWeek = currentDate.getDay();

    // If currentDate is Friday (5), skip to Saturday (holiday)
    if (currentDayOfWeek === 5) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Determine start of this week segment
    const weekStartStr = formatDateJakarta(currentDate);

    // This week segment ends on either:
    // 1. The coming Thursday (day 4)
    // 2. The endLimit date, whichever comes first
    let tempDate = new Date(currentDate.getTime());
    let daysCount = 0;

    while (tempDate <= endLimit) {
      const dow = tempDate.getDay();
      if (dow !== 5) {
        daysCount++;
      }
      if (dow === 4) {
        // Reached Thursday
        break;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }

    const weekEndStr = formatDateJakarta(tempDate);

    const isCurrentWeek = todayStr >= weekStartStr && todayStr <= weekEndStr;

    weeks.push({
      weekNumber: weekIndex,
      label: `Pekan ${weekIndex} (${formatIndonesianDateShort(weekStartStr)} - ${formatIndonesianDateShort(weekEndStr)})`,
      startDate: weekStartStr,
      endDate: weekEndStr,
      isCurrentWeek,
      totalDays: daysCount
    });

    weekIndex++;

    // Advance currentDate to the day after tempDate
    tempDate.setDate(tempDate.getDate() + 1);
    currentDate = tempDate;
  }

  return weeks;
}

/**
 * Generate school weeks for a specific month (YYYY-MM)
 */
export function getSchoolWeeksForMonth(
  monthKey: string, // "YYYY-MM"
  todayStr: string = formatDateJakarta(new Date())
): SchoolWeekPeriod[] {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  const startDay = "01";
  const lastDayNum = new Date(year, month, 0).getDate();
  const endDay = String(lastDayNum).padStart(2, "0");

  const startStr = `${year}-${String(month).padStart(2, "0")}-${startDay}`;
  const endStr = `${year}-${String(month).padStart(2, "0")}-${endDay}`;

  return generateSchoolWeeks(startStr, endStr, todayStr);
}

/**
 * Core Learning Progress Calculation Engine
 */
export const learningProgressMonitoringService = {
  /**
   * Determine descriptive learning progress status based on planned target,
   * schedules, and journal realization.
   */
  evaluateStatus(params: {
    targetJP: number;
    realizedJP: number;
    hasProsemTarget: boolean;
    hasSchedules: boolean;
    hasJournals: boolean;
    endDate?: string;
    todayStr?: string;
  }): { status: LearningProgressStatus; notes: string } {
    const { targetJP, realizedJP, hasProsemTarget, hasSchedules, hasJournals, endDate } = params;
    const todayStr = params.todayStr || formatDateJakarta(new Date());

    // Case 1: Prosem target missing, but schedule and journal exist
    if (!hasProsemTarget && (hasSchedules || hasJournals)) {
      return {
        status: "TIDAK ADA TARGET",
        notes: "Jadwal dan/atau Jurnal tersedia, namun target Prosem belum ditemukan pada periode ini."
      };
    }

    // Case 2: Prosem target exists, but no schedules on this period
    if (hasProsemTarget && !hasSchedules && targetJP > 0 && !hasJournals) {
      return {
        status: "TIDAK ADA JADWAL",
        notes: "Target teralokasi di Prosem namun jadwal operasional KBM tidak aktif pada periode ini."
      };
    }

    // Case 3 & 7: Target was planned, but realization is 0
    if (targetJP > 0 && realizedJP === 0) {
      // Periksa apakah periode masih berjalan atau sudah selesai:
      // Menggunakan kalender operasional sekolah & perbandingan leksikografis Asia/Jakarta (YYYY-MM-DD)
      const isPeriodPassed = !!endDate && todayStr > endDate;

      if (isPeriodPassed) {
        return {
          status: "TERTINGGAL",
          notes: `Target ${targetJP} JP pada periode yang telah selesai belum terealisasi.`
        };
      }

      return {
        status: "BELUM ADA JURNAL",
        notes: `Terdapat target dan jadwal KBM (${targetJP} JP), namun belum ada catatan jurnal pembelajaran untuk pekan yang sedang berjalan.`
      };
    }

    // Case 4: Realization exceeds planned target
    if (targetJP > 0 && realizedJP > targetJP) {
      return {
        status: "LEBIH CEPAT",
        notes: `Realisasi (${realizedJP} JP) melampaui target periode (${targetJP} JP). Catatan: Status ini membuktikan volume JP melebihi target alokasi periode.`
      };
    }

    // Case 5: Realization perfectly meets planned target
    if (targetJP > 0 && realizedJP === targetJP) {
      return {
        status: "SESUAI RENCANA",
        notes: `Target ${targetJP} JP terpenuhi 100% sesuai alokasi rencana pembelajaran.`
      };
    }

    // Case 6: Partial progress
    if (targetJP > 0 && realizedJP > 0 && realizedJP < targetJP) {
      return {
        status: "SEBAGIAN",
        notes: `Terealisasi ${realizedJP} dari ${targetJP} JP (${Math.round((realizedJP / targetJP) * 100)}%).`
      };
    }

    // Default neutral status
    return {
      status: hasJournals ? "SESUAI RENCANA" : "TIDAK ADA TARGET",
      notes: "Tidak ada target khusus untuk periode ini."
    };
  },

  /**
   * Fetch and calculate complete learning progress monitoring dataset
   * Efficient: 1 batch fetch of Prosem, Schedules, Journals, and TeacherAssignments.
   */
  async getLearningProgress(params: {
    academicYearId: string;
    semesterId: string;
    startDate: string;
    endDate: string;
    periodLabel: string;
    isCumulative?: boolean;
    cumulativeStartDate?: string;
  }): Promise<{
    items: LearningProgressItem[];
    summary: LearningProgressSummary;
  }> {
    const {
      academicYearId,
      semesterId,
      startDate,
      endDate,
      periodLabel,
      isCumulative = false,
      cumulativeStartDate = startDate
    } = params;

    // 1. Batch fetch dependencies using existing services (READ-ONLY)
    const [allProsems, allSchedules, allJournals, allAssignments] = await Promise.all([
      curriculumPlanningService.getAllSemesterPrograms(),
      scheduleService.getSchedules(academicYearId, semesterId),
      teachingJournalService.getAll(academicYearId, semesterId),
      teacherAssignmentService.getTeacherAssignmentsByPeriod(academicYearId, semesterId)
    ]);

    // Filter data for academic year & semester
    const filteredProsems = allProsems.filter(
      p => p.academicYearId === academicYearId && p.semesterId === semesterId
    );

    const filteredSchedules = allSchedules.filter(
      s => s.academicYearId === academicYearId && (!s.semesterId || s.semesterId === semesterId)
    );

    const filteredJournals = allJournals.filter(
      j => j.academicYearId === academicYearId && j.semesterId === semesterId
    );

    // 2. Index Prosem by classId_subjectId
    const prosemMap = new Map<string, SemesterProgram>();
    filteredProsems.forEach(p => {
      const key = `${p.classId}_${p.subjectId}`;
      prosemMap.set(key, p);
    });

    // 3. Collect distinct Class + Subject + Teacher pairs from Schedules and Prosems
    interface KeyInfo {
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
    }

    const uniquePairsMap = new Map<string, KeyInfo>();

    // From schedules (primary operational SSOT)
    filteredSchedules.forEach(sched => {
      if (!sched.classId || !sched.subjectId) return;

      // Resolve effective teacher for the period start date
      const resolved = resolveTeacherForScheduleDate(sched, startDate, allAssignments);
      const teacherId = resolved.teacherId || sched.teacherId;
      const teacherName = resolved.teacherName || sched.teacherName;

      const pairKey = `${sched.classId}_${sched.subjectId}`;
      if (!uniquePairsMap.has(pairKey)) {
        uniquePairsMap.set(pairKey, {
          classId: sched.classId,
          className: sched.className,
          subjectId: sched.subjectId,
          subjectName: sched.subjectName,
          teacherId,
          teacherName
        });
      }
    });

    // From Prosems (in case a subject is planned in Prosem but schedule is not yet created)
    filteredProsems.forEach(p => {
      const pairKey = `${p.classId}_${p.subjectId}`;
      if (!uniquePairsMap.has(pairKey)) {
        uniquePairsMap.set(pairKey, {
          classId: p.classId,
          className: p.className,
          subjectId: p.subjectId,
          subjectName: p.subjectName,
          teacherId: p.teacherId,
          teacherName: p.teacherName
        });
      }
    });

    // 4. Calculate metrics for each unique pair
    const items: LearningProgressItem[] = [];

    uniquePairsMap.forEach((info, pairKey) => {
      const { classId, className, subjectId, subjectName, teacherId, teacherName } = info;

      const prosem = prosemMap.get(pairKey);

      // A. Extract Prosem meetings within target period
      const matchedMeetings: PromesMeetingEntry[] = [];
      let targetJP = 0;
      let hasProsemTarget = false;
      const targetTitles: string[] = [];
      const targetLearningObjectives: string[] = [];

      if (prosem && Array.isArray(prosem.meetings) && prosem.meetings.length > 0) {
        prosem.meetings.forEach(m => {
          if (!m.date) return;
          // Filter meetings within date range
          const effectiveStart = isCumulative ? cumulativeStartDate : startDate;
          if (m.date >= effectiveStart && m.date <= endDate) {
            if (m.status === "KBM") {
              matchedMeetings.push(m);
              targetJP += Number(m.jpCount || 0);
              hasProsemTarget = true;
              if (m.topicTitle && !targetTitles.includes(m.topicTitle)) {
                targetTitles.push(m.topicTitle);
              }
              if (m.subtopicTitle && !targetTitles.includes(m.subtopicTitle)) {
                targetTitles.push(m.subtopicTitle);
              }
              if (m.tp && !targetLearningObjectives.includes(m.tp)) {
                targetLearningObjectives.push(m.tp);
              }
            }
          }
        });
      }

      // Fallback: If Prosem has no meetings array, but has legacy allocations or weekly JP:
      // Check schedules weekly load
      const relevantSchedules = filteredSchedules.filter(
        s => s.classId === classId && s.subjectId === subjectId
      );
      const scheduledJP = relevantSchedules.length; // 1 slot = 1 JP
      const hasSchedules = relevantSchedules.length > 0;

      // If prosem meetings were empty, but prosem exists with topics and schedules exist
      if (targetJP === 0 && prosem && hasSchedules && !isCumulative) {
        // Approximate planned target from weekly schedule load
        // But mark clearly if meeting details aren't populated
        if (prosem.effectiveJpSemester && prosem.effectiveWeeksCount) {
          const estimatedWeeklyJp = Math.round(prosem.effectiveJpSemester / prosem.effectiveWeeksCount);
          if (estimatedWeeklyJp > 0) {
            targetJP = estimatedWeeklyJp;
            hasProsemTarget = true;
          }
        }
      }

      // B. Extract Journals within period (Realisasi Aktual)
      const effectiveStart = isCumulative ? cumulativeStartDate : startDate;
      const matchedJournals = filteredJournals.filter(j => {
        if (j.classId !== classId || j.subjectId !== subjectId) return false;
        if (!j.date || j.date < effectiveStart || j.date > endDate) return false;
        return true;
      });

      let realizedJP = 0;
      matchedJournals.forEach(j => {
        realizedJP += Number(j.totalJP || 0);
      });
      const hasJournals = matchedJournals.length > 0;

      // C. Evaluation & Status
      const differenceJP = realizedJP - targetJP;
      const rawProgressPercentage = targetJP > 0
        ? Math.round((realizedJP / targetJP) * 100)
        : (realizedJP > 0 ? 100 : 0);
      const progressPercentage = rawProgressPercentage; // Unclamped raw percentage (e.g. 250% when realized=10 and target=4)

      const evalResult = this.evaluateStatus({
        targetJP,
        realizedJP,
        hasProsemTarget,
        hasSchedules,
        hasJournals,
        endDate,
        todayStr: formatDateJakarta(new Date())
      });

      const itemId = `${academicYearId}_${semesterId}_${classId}_${subjectId}_${teacherId}`;

      items.push({
        id: itemId,
        academicYearId,
        semesterId,
        teacherId,
        teacherName,
        subjectId,
        subjectName,
        classId,
        className,
        periodLabel,
        startDate: effectiveStart,
        endDate,
        isCumulative,
        targetJP,
        realizedJP,
        differenceJP,
        progressPercentage,
        rawProgressPercentage,
        status: evalResult.status,
        statusNotes: evalResult.notes,
        hasProsemTarget,
        targetTitles,
        targetLearningObjectives,
        prosemMeetings: matchedMeetings,
        hasSchedules,
        scheduledJP,
        schedules: relevantSchedules,
        hasJournals,
        journals: matchedJournals,
        cumulativeTargetJP: targetJP,
        cumulativeRealizedJP: realizedJP,
        cumulativeDifferenceJP: differenceJP,
        cumulativeProgressPercentage: progressPercentage
      });
    });

    // Sort items by class name, then subject name, then teacher name
    items.sort((a, b) => {
      const cls = a.className.localeCompare(b.className);
      if (cls !== 0) return cls;
      const subj = a.subjectName.localeCompare(b.subjectName);
      if (subj !== 0) return subj;
      return a.teacherName.localeCompare(b.teacherName);
    });

    // 5. Aggregate Summary Metrics
    let sesuaiRencanaCount = 0;
    let lebihCepatCount = 0;
    let sebagianCount = 0;
    let tertinggalCount = 0;
    let belumAdaJurnalCount = 0;
    let tidakAdaTargetCount = 0;
    let tidakAdaJadwalCount = 0;
    let totalTargetJP = 0;
    let totalRealizedJP = 0;

    items.forEach(it => {
      totalTargetJP += it.targetJP;
      totalRealizedJP += it.realizedJP;

      switch (it.status) {
        case "SESUAI RENCANA":
          sesuaiRencanaCount++;
          break;
        case "LEBIH CEPAT":
          lebihCepatCount++;
          break;
        case "SEBAGIAN":
          sebagianCount++;
          break;
        case "TERTINGGAL":
          tertinggalCount++;
          break;
        case "BELUM ADA JURNAL":
          belumAdaJurnalCount++;
          break;
        case "TIDAK ADA TARGET":
          tidakAdaTargetCount++;
          break;
        case "TIDAK ADA JADWAL":
          tidakAdaJadwalCount++;
          break;
      }
    });

    const overallPercentage = totalTargetJP > 0
      ? Math.round((totalRealizedJP / totalTargetJP) * 100)
      : (totalRealizedJP > 0 ? 100 : 0);

    const summary: LearningProgressSummary = {
      totalItems: items.length,
      sesuaiRencanaCount,
      lebihCepatCount,
      sebagianCount,
      tertinggalCount,
      belumAdaJurnalCount,
      tidakAdaTargetCount,
      tidakAdaJadwalCount,
      totalTargetJP,
      totalRealizedJP,
      overallPercentage
    };

    return { items, summary };
  },

  /**
   * Calculate weekly cumulative progression breakdown for a specific item
   * (e.g. for drilldown modal or cumulative timeline analysis)
   */
  async getCumulativeBreakdown(params: {
    academicYearId: string;
    semesterId: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    weeks: SchoolWeekPeriod[];
  }): Promise<WeeklyCumulativeRow[]> {
    const { academicYearId, semesterId, classId, subjectId, weeks } = params;

    const [allProsems, allJournals] = await Promise.all([
      curriculumPlanningService.getAllSemesterPrograms(),
      teachingJournalService.getAll(academicYearId, semesterId)
    ]);

    const prosem = allProsems.find(
      p => p.academicYearId === academicYearId &&
           p.semesterId === semesterId &&
           p.classId === classId &&
           p.subjectId === subjectId
    );

    const journals = allJournals.filter(
      j => j.academicYearId === academicYearId &&
           j.semesterId === semesterId &&
           j.classId === classId &&
           j.subjectId === subjectId
    );

    let cumulativeTarget = 0;
    let cumulativeRealized = 0;

    const rows: WeeklyCumulativeRow[] = [];

    weeks.forEach(w => {
      // Planned JP for this week from Prosem meetings
      let weekTarget = 0;
      if (prosem && Array.isArray(prosem.meetings)) {
        prosem.meetings.forEach(m => {
          if (m.status === "KBM" && m.date >= w.startDate && m.date <= w.endDate) {
            weekTarget += Number(m.jpCount || 0);
          }
        });
      }

      // Realized JP from Journals
      let weekRealized = 0;
      journals.forEach(j => {
        if (j.date >= w.startDate && j.date <= w.endDate) {
          weekRealized += Number(j.totalJP || 0);
        }
      });

      cumulativeTarget += weekTarget;
      cumulativeRealized += weekRealized;

      const progressPct = cumulativeTarget > 0
        ? Math.round((cumulativeRealized / cumulativeTarget) * 100)
        : (cumulativeRealized > 0 ? 100 : 0);

      rows.push({
        weekNumber: w.weekNumber,
        weekLabel: w.label,
        startDate: w.startDate,
        endDate: w.endDate,
        targetJP: weekTarget,
        realizedJP: weekRealized,
        cumulativeTargetJP: cumulativeTarget,
        cumulativeRealizedJP: cumulativeRealized,
        cumulativeProgressPercentage: progressPct
      });
    });

    return rows;
  },

  /**
   * Batch fetches Protas, Prosems, and Journals, then calculates Material Progress (Phase 3B).
   * Strictly READ-ONLY. No Firestore writes, no side effects.
   */
  async getMaterialProgress(params: {
    academicYearId: string;
    semesterId: string;
    startDate: string;
    endDate: string;
    mode?: "weekly" | "cumulative";
    classId?: string;
    subjectId?: string;
    todayStr?: string;
  }): Promise<MaterialProgressResult> {
    const {
      academicYearId,
      semesterId,
      startDate,
      endDate,
      mode = "weekly",
      classId,
      subjectId,
      todayStr = formatDateJakarta(new Date())
    } = params;

    const [allProtas, allProsems, allJournals, allSchedules] = await Promise.all([
      curriculumPlanningService.getAllAnnualPrograms(),
      curriculumPlanningService.getAllSemesterPrograms(),
      teachingJournalService.getAll(academicYearId, semesterId),
      scheduleService.getSchedules(academicYearId, semesterId)
    ]);

    return this.calculateMaterialProgress({
      academicYearId,
      semesterId,
      classId,
      subjectId,
      startDate,
      endDate,
      mode,
      protas: allProtas,
      prosems: allProsems,
      journals: allJournals,
      schedules: allSchedules,
      todayStr
    });
  },

  /**
   * Aggregates topic items into Executive Overview metrics for Wakakur and Kepala Sekolah (Phase 3C-1).
   * Pure in-memory aggregation. 100% consistent with displayed rows. Zero mutations.
   */
  aggregateExecutiveSummary(topicItems: TopicMaterialProgressItem[]): ExecutiveProgressSummary {
    const classSubjectSet = new Set<string>();
    let totalTargetJP = 0;
    let totalRealizedJP = 0;
    let completedCount = 0;
    let inProgressCount = 0;
    let noJournalCount = 0;
    let delayedCount = 0;
    let unstartedCount = 0;
    let outOfProsemCount = 0;

    topicItems.forEach(item => {
      classSubjectSet.add(`${item.classId}_${item.subjectId}`);
      totalTargetJP += Number(item.targetJP || 0);
      totalRealizedJP += Number(item.realizedJP || 0);

      switch (item.status) {
        case "SELESAI":
          completedCount++;
          break;
        case "SEDANG_BERJALAN":
          inProgressCount++;
          break;
        case "BELUM_ADA_JURNAL":
          noJournalCount++;
          break;
        case "TERTINGGAL":
          delayedCount++;
          break;
        case "BELUM_DIMULAI":
          unstartedCount++;
          break;
        case "DI_LUAR_RENCANA":
          outOfProsemCount++;
          break;
      }
    });

    return {
      monitoredClassSubjectCount: classSubjectSet.size,
      totalTargetJP,
      totalRealizedJP,
      completedCount,
      inProgressCount,
      noJournalCount,
      delayedCount,
      unstartedCount,
      outOfProsemCount,
      totalTopics: topicItems.length
    };
  },

  /**
   * Pure calculation engine for Learning Material Progress (Phase 3A)
   * Evaluates Prota topics against Prosem scheduled KBM meetings and Teaching Journals with topicId.
   * Strictly READ-ONLY. No Firestore writes, no side effects, immutable input handling.
   */
  calculateMaterialProgress(params: CalculateMaterialProgressParams): MaterialProgressResult {
    const {
      academicYearId,
      semesterId,
      classId,
      subjectId,
      startDate,
      endDate,
      mode = "weekly",
      todayStr = formatDateJakarta(new Date())
    } = params;

    // 1. Defensive copies of arrays to guarantee input immutability
    const journalsList = [...(params.journals || [])];
    const protasList = params.prota ? [params.prota] : [...(params.protas || [])];
    const prosemsList = params.prosem ? [params.prosem] : [...(params.prosems || [])];
    const schedulesList = [...(params.schedules || [])];

    // Filter protas, prosems, & schedules by academicYearId & semesterId (and optional classId, subjectId)
    const filteredProtas = protasList.filter(p => {
      if (p.academicYearId !== academicYearId) return false;
      if (classId && p.classId !== classId) return false;
      if (subjectId && p.subjectId !== subjectId) return false;
      return true;
    });

    const filteredProsems = prosemsList.filter(p => {
      if (p.academicYearId !== academicYearId) return false;
      if (p.semesterId && p.semesterId !== semesterId) return false;
      if (classId && p.classId !== classId) return false;
      if (subjectId && p.subjectId !== subjectId) return false;
      return true;
    });

    const filteredSchedules = schedulesList.filter(s => {
      if (s.academicYearId !== academicYearId) return false;
      if (s.semesterId && s.semesterId !== semesterId) return false;
      if (classId && s.classId !== classId) return false;
      if (subjectId && s.subjectId !== subjectId) return false;
      return true;
    });

    const schedulesByContext = new Map<string, Schedule[]>();
    filteredSchedules.forEach(s => {
      const key = `${s.classId}_${s.subjectId}`;
      if (!schedulesByContext.has(key)) {
        schedulesByContext.set(key, []);
      }
      schedulesByContext.get(key)!.push(s);
    });

    // 2. Filter Journals by academicYearId, semesterId, classId, subjectId, and Date Boundary
    // Date boundary:
    // weekly: startDate <= j.date && j.date <= endDate
    // cumulative: j.date <= endDate
    const filteredJournals = journalsList.filter(j => {
      if (j.academicYearId !== academicYearId) return false;
      if (j.semesterId !== semesterId) return false;
      if (classId && j.classId !== classId) return false;
      if (subjectId && j.subjectId !== subjectId) return false;
      if (!j.date) return false;

      if (mode === "weekly") {
        return j.date >= startDate && j.date <= endDate;
      } else {
        // cumulative
        return j.date <= endDate;
      }
    });

    // 3. Separate journals into linked (PROSEM_TOPIC or legacy with topicId), OUT_OF_PROSEM, and unlinked (legacy without topicId)
    const linkedJournalsByTopic = new Map<string, TeachingJournal[]>();
    const outOfProsemJournals: TeachingJournal[] = [];
    let outOfProsemJP = 0;
    const unlinkedJournals: TeachingJournal[] = [];
    let unlinkedJP = 0;

    filteredJournals.forEach(j => {
      const topicId = j.topicId?.trim();
      const source = j.journalSource;

      if (source === "OUT_OF_PROSEM") {
        outOfProsemJournals.push(j);
        outOfProsemJP += Number(j.totalJP || 0);
      } else if (source === "PROSEM_TOPIC" && topicId && topicId !== "OUT_OF_PROSEM") {
        const key = `${j.classId}_${j.subjectId}_${topicId}`;
        if (!linkedJournalsByTopic.has(key)) {
          linkedJournalsByTopic.set(key, []);
        }
        linkedJournalsByTopic.get(key)!.push(j);
      } else if (!source && topicId && topicId !== "OUT_OF_PROSEM") {
        // Backward-compatibility: legacy journal that already had a valid topicId attached
        const key = `${j.classId}_${j.subjectId}_${topicId}`;
        if (!linkedJournalsByTopic.has(key)) {
          linkedJournalsByTopic.set(key, []);
        }
        linkedJournalsByTopic.get(key)!.push(j);
      } else {
        // Pure legacy or unlinked journal (!source && !topicId)
        unlinkedJournals.push(j);
        unlinkedJP += Number(j.totalJP || 0);
      }
    });

    // 4. Map Prota Topics and Prosem Meetings per context (classId_subjectId)
    interface ContextTopicMeta {
      contextKey: string; // classId_subjectId_topicId
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      teacherId?: string;
      teacherName?: string;
      topicId: string;
      topicTitle: string;
      topicOrder: number;
      protaTopic: ProtaTopic | null;
      plannedMeetings: PromesMeetingEntry[];
      targetJP: number;
      weeklyTargetJP?: number;
      semesterTargetJP: number;
      semesterMeetings: PromesMeetingEntry[];
      plannedStartDate?: string;
      plannedEndDate?: string;
      semesterStartDate?: string;
      semesterEndDate?: string;
    }

    const contextTopicsMap = new Map<string, ContextTopicMeta>();
    const unmappedMeetingTargets: { topicId: string; meetingCount: number; targetJP: number }[] = [];

    // Index Prosem by classId_subjectId
    const prosemMap = new Map<string, SemesterProgram>();
    filteredProsems.forEach(p => {
      prosemMap.set(`${p.classId}_${p.subjectId}`, p);
    });

    // Populate topics from Prota
    filteredProtas.forEach(prota => {
      const prosem = prosemMap.get(`${prota.classId}_${prota.subjectId}`);
      const semesterName = prosem?.semesterName || "";
      const isGenap = semesterName.toLowerCase().includes("genap") || semesterName.includes("2");

      const topics = prota.topics || [];
      topics.forEach(t => {
        // Check semester applicability if specified
        if (t.semester && t.semester !== "Ganjil & Genap") {
          const isTopicGenap = t.semester === "Genap" || t.semester.toLowerCase().includes("genap");
          if (isGenap !== isTopicGenap) return;
        }

        const contextKey = `${prota.classId}_${prota.subjectId}_${t.id}`;
        contextTopicsMap.set(contextKey, {
          contextKey,
          classId: prota.classId,
          className: prota.className || prota.classId,
          subjectId: prota.subjectId,
          subjectName: prota.subjectName || prota.subjectId,
          teacherId: prosem?.teacherId,
          teacherName: prosem?.teacherName,
          topicId: t.id,
          topicTitle: t.title,
          topicOrder: t.order || 0,
          protaTopic: t,
          plannedMeetings: [],
          targetJP: 0,
          semesterTargetJP: 0,
          semesterMeetings: []
        });
      });
    });

    // Extract KBM meetings from Prosem and match against Prota topics
    filteredProsems.forEach(prosem => {
      const meetings = prosem.meetings || [];
      meetings.forEach(m => {
        if (m.status !== "KBM" || !m.topicId) return;

        const contextKey = `${prosem.classId}_${prosem.subjectId}_${m.topicId}`;
        const meta = contextTopicsMap.get(contextKey);

        if (meta) {
          // Accumulate semester-level planning
          meta.semesterMeetings.push(m);
          meta.semesterTargetJP += Number(m.jpCount || 0);
          if (!meta.semesterStartDate || m.date < meta.semesterStartDate) {
            meta.semesterStartDate = m.date;
          }
          if (!meta.semesterEndDate || m.date > meta.semesterEndDate) {
            meta.semesterEndDate = m.date;
          }

          // Date boundary filter for active evaluation period
          let inPeriod = false;
          if (mode === "weekly") {
            inPeriod = (m.date >= startDate && m.date <= endDate);
          } else {
            // cumulative
            inPeriod = (m.date <= endDate);
          }

          if (inPeriod) {
            meta.plannedMeetings.push(m);
            meta.targetJP += Number(m.jpCount || 0);

            if (!meta.plannedStartDate || m.date < meta.plannedStartDate) {
              meta.plannedStartDate = m.date;
            }
            if (!meta.plannedEndDate || m.date > meta.plannedEndDate) {
              meta.plannedEndDate = m.date;
            }
          }
        } else {
          // Meeting has a topicId not found in Prota!
          // Locked Decision 16: Do NOT invent fake topics or match by title.
          const existing = unmappedMeetingTargets.find(u => u.topicId === m.topicId);
          if (existing) {
            existing.meetingCount++;
            existing.targetJP += Number(m.jpCount || 0);
          } else {
            unmappedMeetingTargets.push({
              topicId: m.topicId,
              meetingCount: 1,
              targetJP: Number(m.jpCount || 0)
            });
          }
        }
      });
    });

    // Check if there are journals with topicIds that are not yet in contextTopicsMap (e.g. out-of-prosem or custom topicId)
    linkedJournalsByTopic.forEach((journals, contextKey) => {
      if (!contextTopicsMap.has(contextKey)) {
        const first = journals[0];
        contextTopicsMap.set(contextKey, {
          contextKey,
          classId: first.classId,
          className: first.className || first.classId,
          subjectId: first.subjectId,
          subjectName: first.subjectName || first.subjectId,
          topicId: first.topicId!,
          topicTitle: first.material || `Topik ${first.topicId}`,
          topicOrder: 999,
          protaTopic: null,
          plannedMeetings: [],
          targetJP: 0,
          semesterTargetJP: 0,
          semesterMeetings: []
        });
      }
    });

    // 5. Compute Metrics for each Topic Item
    const topicItems: TopicMaterialProgressItem[] = [];

    contextTopicsMap.forEach(meta => {
      const {
        contextKey,
        classId,
        className,
        subjectId,
        subjectName,
        topicId,
        topicTitle,
        topicOrder,
        protaTopic,
        plannedMeetings,
        targetJP,
        semesterTargetJP,
        semesterMeetings,
        plannedStartDate,
        plannedEndDate,
        semesterStartDate,
        semesterEndDate
      } = meta;

      const journals = linkedJournalsByTopic.get(contextKey) || [];
      const journalCount = journals.length;

      // Realized JP is actual sum of totalJP (NEVER capped, Locked Decision C)
      let realizedJP = 0;
      journals.forEach(j => {
        realizedJP += Number(j.totalJP || 0);
      });

      const differenceJP = realizedJP - targetJP;

      // Progress percentages (Locked Decision D)
      let rawProgressPercentage = 0;
      if (targetJP > 0) {
        rawProgressPercentage = Math.round((realizedJP / targetJP) * 100);
      } else {
        // Zero target in evaluated period
        rawProgressPercentage = 0;
      }
      const progressPercentage = Math.min(100, rawProgressPercentage);

      // Status determination (Locked Decision 11 & Phase 3A Remediation)
      let status: MaterialProgressStatus = "BELUM_DIMULAI";
      let statusNotes = "";

      if (semesterTargetJP === 0 && targetJP === 0 && realizedJP === 0) {
        status = "BELUM_DIMULAI";
        statusNotes = "Belum ada alokasi target pertemuan Prosem pada semester ini";
      } else if (semesterTargetJP === 0 && targetJP === 0 && realizedJP > 0) {
        // Genuinely out of prosem for the whole semester
        status = "DI_LUAR_RENCANA";
        statusNotes = `Realisasi ${realizedJP} JP tanpa target alokasi Prosem pada semester ini`;
      } else if (semesterTargetJP > 0 && targetJP === 0) {
        // Topic is planned in the semester, but not allocated in this evaluated period (e.g. weekly mode)
        if (realizedJP > 0) {
          // Taught out of schedule / different week
          status = "SEDANG_BERJALAN";
          statusNotes = `Diajarkan di luar pekan alokasi rencana (${realizedJP} JP terealisasi, Target semester: ${semesterTargetJP} JP)`;
        } else {
          // realizedJP === 0 and targetJP === 0 for this week
          const semStart = semesterStartDate || plannedStartDate;
          const semEnd = semesterEndDate || plannedEndDate;
          if (semStart && todayStr < semStart) {
            status = "BELUM_DIMULAI";
            statusNotes = `Jadwal materi semester direncanakan mulai ${semStart}`;
          } else if (semEnd && todayStr > semEnd) {
            status = "BELUM_DIMULAI";
            statusNotes = `Tidak ada alokasi pada pekan ini (Jadwal semester telah berlalu pada ${semEnd})`;
          } else {
            status = "BELUM_DIMULAI";
            statusNotes = `Tidak ada alokasi target pada pekan ini (Jadwal semester: ${semStart || '-'} s/d ${semEnd || '-'})`;
          }
        }
      } else if (targetJP > 0 && realizedJP >= targetJP) {
        status = "SELESAI";
        statusNotes = realizedJP > targetJP
          ? `Tuntas melampaui target (+${realizedJP - targetJP} JP pengayaan)`
          : `Tuntas 100% (${realizedJP}/${targetJP} JP)`;
      } else if (targetJP > 0 && realizedJP > 0 && realizedJP < targetJP) {
        status = "SEDANG_BERJALAN";
        statusNotes = `Sedang berjalan: ${realizedJP} dari ${targetJP} JP (${progressPercentage}%)`;
      } else if (targetJP > 0 && realizedJP === 0) {
        // Time-aware checks: compare today with planned start and effective period end
        const effectiveEnd = endDate || plannedEndDate;
        if (plannedStartDate && todayStr < plannedStartDate) {
          status = "BELUM_DIMULAI";
          statusNotes = `Target materi terjadwal mulai ${plannedStartDate}`;
        } else if (effectiveEnd && todayStr > effectiveEnd) {
          status = "TERTINGGAL";
          statusNotes = `Periode target telah berakhir (${effectiveEnd}), realisasi masih 0 JP`;
        } else {
          status = "BELUM_ADA_JURNAL";
          statusNotes = "Periode sedang berjalan, belum ada jurnal terisi";
        }
      }

      // Subtopics progress breakdown (Locked Decision 12 - informational only)
      const subtopicsProgress: SubtopicProgressBreakdown[] = [];
      if (protaTopic && Array.isArray(protaTopic.subtopics) && protaTopic.subtopics.length > 0) {
        protaTopic.subtopics.forEach(st => {
          let stTargetJP = 0;
          plannedMeetings.forEach(m => {
            if (m.subtopicId === st.id) {
              stTargetJP += Number(m.jpCount || 0);
            }
          });
          // If meetings did not specify subtopicId, use nominal st.jp from Prota
          if (stTargetJP === 0 && st.jp) {
            stTargetJP = st.jp;
          }

          let stRealizedJP = 0;
          journals.forEach(j => {
            if (j.subtopicId === st.id) {
              stRealizedJP += Number(j.totalJP || 0);
            }
          });

          subtopicsProgress.push({
            subtopicId: st.id,
            subtopicTitle: st.title,
            targetJP: stTargetJP,
            realizedJP: stRealizedJP,
            isCompleted: stRealizedJP >= stTargetJP && stTargetJP > 0
          });
        });
      }

      const contextSchedules = schedulesByContext.get(`${classId}_${subjectId}`) || [];
      let scheduledJP = 0;
      contextSchedules.forEach(s => {
        scheduledJP += Number((s as any).jpCount || 1);
      });

      const itemId = `${academicYearId}_${semesterId}_${classId}_${subjectId}_${topicId}`;

      topicItems.push({
        id: itemId,
        academicYearId,
        semesterId,
        classId,
        className,
        subjectId,
        subjectName,
        teacherId: meta.teacherId,
        teacherName: meta.teacherName,
        topicId,
        topicTitle,
        topicOrder,
        targetJP,
        weeklyTargetJP: mode === "weekly" ? targetJP : undefined,
        semesterTargetJP,
        realizedJP,
        differenceJP,
        rawProgressPercentage,
        progressPercentage,
        status,
        statusNotes,
        plannedStartDate,
        plannedEndDate,
        semesterStartDate,
        semesterEndDate,
        plannedMeetings,
        meetingCount: plannedMeetings.length,
        semesterMeetingCount: semesterMeetings.length,
        journals,
        journalCount,
        subtopicsProgress,
        schedules: contextSchedules,
        scheduledJP
      });
    });

    // Sort topic items: by class, subject, topicOrder, topicTitle
    topicItems.sort((a, b) => {
      const cls = (a.className || "").localeCompare(b.className || "");
      if (cls !== 0) return cls;
      const subj = (a.subjectName || "").localeCompare(b.subjectName || "");
      if (subj !== 0) return subj;
      const ord = (a.topicOrder || 0) - (b.topicOrder || 0);
      if (ord !== 0) return ord;
      return a.topicTitle.localeCompare(b.topicTitle);
    });

    // Summary counts
    let totalPlannedTopics = 0;
    let completedTopicsCount = 0;
    let inProgressTopicsCount = 0;
    let unstartedTopicsCount = 0;
    let delayedTopicsCount = 0;

    topicItems.forEach(item => {
      if (item.targetJP > 0 || (item.semesterTargetJP || 0) > 0) {
        totalPlannedTopics++;
      }
      switch (item.status) {
        case "SELESAI":
          completedTopicsCount++;
          break;
        case "SEDANG_BERJALAN":
          inProgressTopicsCount++;
          break;
        case "BELUM_DIMULAI":
        case "BELUM_ADA_JURNAL":
          unstartedTopicsCount++;
          break;
        case "TERTINGGAL":
          delayedTopicsCount++;
          break;
      }
    });

    const overallMaterialCompletionRate = totalPlannedTopics > 0
      ? Math.round((completedTopicsCount / totalPlannedTopics) * 100)
      : (completedTopicsCount > 0 ? 100 : 0);

    return {
      topicItems,
      unlinkedJournals,
      unlinkedJP,
      outOfProsemJournals,
      outOfProsemJP,
      totalPlannedTopics,
      completedTopicsCount,
      inProgressTopicsCount,
      unstartedTopicsCount,
      delayedTopicsCount,
      overallMaterialCompletionRate,
      unmappedMeetingTargets
    };
  }
};
