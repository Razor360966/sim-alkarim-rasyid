import { teacherService } from "./teacherService";
import { curriculumPlanningService } from "./curriculumPlanning.service";
import { lessonPlanService } from "./lessonPlan.service";
import { teachingJournalService } from "./teachingJournalService";
import { teacherTeachingAttendanceService } from "./teacherTeachingAttendance.service";
import { scheduleService } from "./schedule.service";
import { schoolSettingsService, DEFAULT_JOURNAL_TIMELINESS_RULES } from "./schoolSettings.service";
import { teacherDisciplineService } from "./teacherDiscipline.service";
import { TeachingJournal, Teacher, TeacherTeachingAttendance, JournalTimelinessRules } from "../types";

export interface ComplianceFilters {
  academicYearId?: string;
  academicYearName?: string;
  semesterId?: string;
  semesterName?: string;
  startDate?: string;
  endDate?: string;
  teacherId?: string;
  subjectId?: string;
  classId?: string;
  month?: string; // "YYYY-MM"
}

export interface ComponentCompliance {
  name: string;
  target: number;
  actual: number;
  missing: number;
  percentage: number;
  status: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Pembinaan" | "Pembinaan Khusus";
}

export interface TeacherComplianceRanking {
  teacherId: string;
  teacherName: string;
  niy?: string;

  // KPI Administrasi Guru
  protaScore: number;
  prosemScore: number;
  modulScore: number;
  jurnalKelengkapanScore: number;
  jurnalKetepatanScore: number | null; // null if expected sessions = 0 (N/A)
  adminTotalScore: number;

  // KPI Disiplin Mengajar Guru
  disciplineScore: number;
  attendanceRate: number;
  onTimeCheckInRate: number;
  onTimeCheckOutRate: number;
  lateCount: number;
  alphaCount: number;
  izinCount: number;

  // Total Combined Metrics
  onTimeRate: number | null; // Legacy field alias for backward compatibility
  totalScore: number;
  category: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Pembinaan" | "Pembinaan Khusus";
  visualStatus: string; // "🟢 Sangat Disiplin", "🟢 Disiplin", "🟡 Cukup", "🟠 Kurang", "🔴 Perlu Pembinaan", "⚪ N/A"

  // Quantities
  expectedSessionsCount: number;
  actualJournalsCount: number;
  missingJournalCount: number;
  lateJournalCount: number;
}

export interface MissingJournalDetail {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string;
  dayName?: string;
  className: string;
  subjectName: string;
  period: string;
  timeSlot?: string;
  sessionStatus: string;
  complianceStatus: "Belum Mengisi" | "Terlambat";
  attendanceId?: string;

  // Timeliness details
  checkOutTime?: string;
  submissionTime?: string;
  delayMinutes?: number;
  delayHoursDisplay?: string;
  timelinessCategory?: string;
  timelinessScore?: number;
}

export interface MonthlyTrendItem {
  monthName: string;
  monthKey: string; // "2026-08"
  expectedSessions: number;
  actualJournals: number;
  missingJournals: number;
  complianceRate: number;
  onTimeRate: number | null;
}

export interface ComplianceSummary {
  prota: ComponentCompliance;
  prosem: ComponentCompliance;
  modulAjar: ComponentCompliance;
  jurnalMengajar: ComponentCompliance;
  overallPercentage: number;
  totalExpectedSessions: number;
  totalActualJournals: number;
  totalMissingJournals: number;
  totalOnTimeJournals: number;
  totalLateJournals: number;
  onTimePercentage: number | null;
  onTimeStatus: string;

  // Discipline overview
  avgDisciplineScore: number;
  avgAttendanceRate: number;
  avgCheckInOnTimeRate: number;
  avgCheckOutOnTimeRate: number;
}

// Timeliness Evaluation Engine Helper
export function evaluateSessionTimeliness(
  session: TeacherTeachingAttendance,
  matchedJournal: TeachingJournal | undefined,
  rules: JournalTimelinessRules
): {
  score: number;
  category: string;
  statusLabel: string;
  isFilled: boolean;
  isLate: boolean;
  delayMinutes: number;
  delayHoursDisplay: string;
  submissionTimeStr?: string;
  checkOutTimeStr?: string;
} {
  if (!matchedJournal) {
    return {
      score: rules.unfilledJournalScore ?? 0,
      category: "Belum Mengisi",
      statusLabel: "🔴 Belum Mengisi",
      isFilled: false,
      isLate: true,
      delayMinutes: 0,
      delayHoursDisplay: "-"
    };
  }

  const sessionDateStr = session.date || new Date().toISOString().slice(0, 10);
  const refTime = session.checkOutTime || session.checkInTime || "08:00";
  const refTimestamp = new Date(`${sessionDateStr}T${refTime.length === 5 ? refTime + ":00" : refTime}`).getTime();

  const subTime = matchedJournal.createdAt 
    ? new Date(matchedJournal.createdAt).getTime() 
    : new Date(`${sessionDateStr}T23:59:59`).getTime();

  const diffMs = subTime - refTimestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  const delayHoursDisplay = diffMinutes > 0 ? (diffMinutes / 60).toFixed(1) + " jam" : "0 jam";

  const subDateStr = matchedJournal.createdAt ? new Date(matchedJournal.createdAt).toISOString().slice(0, 10) : sessionDateStr;
  const isSameDay = subDateStr === sessionDateStr || diffMinutes <= 16 * 60;

  let score = 0;
  let category = "";
  let statusLabel = "";
  let isLate = false;

  const veryOnTimeMins = rules.veryOnTimeMinutes ?? 60;

  if (diffMinutes <= veryOnTimeMins) {
    score = rules.veryOnTimeScore ?? 100;
    category = "Sangat Tepat Waktu";
    statusLabel = "🟢 Sangat Disiplin";
    isLate = false;
  } else if (isSameDay) {
    score = rules.sameDayScore ?? 90;
    category = "Tepat Waktu Hari Sama";
    statusLabel = "🟢 Disiplin";
    isLate = false;
  } else if (diffMinutes <= 24 * 60) {
    score = rules.oneDayLateScore ?? 70;
    category = "Terlambat Ringan (1 Hari)";
    statusLabel = "🟡 Cukup";
    isLate = true;
  } else if (diffMinutes <= 3 * 24 * 60) {
    score = rules.twoToThreeDaysLateScore ?? 40;
    category = "Terlambat Sedang (2-3 Hari)";
    statusLabel = "🟠 Kurang";
    isLate = true;
  } else {
    score = rules.moreThanThreeDaysLateScore ?? 0;
    category = "Sangat Terlambat (>3 Hari)";
    statusLabel = "🔴 Perlu Pembinaan";
    isLate = true;
  }

  return {
    score,
    category,
    statusLabel,
    isFilled: true,
    isLate,
    delayMinutes: diffMinutes,
    delayHoursDisplay,
    submissionTimeStr: matchedJournal.createdAt ? new Date(matchedJournal.createdAt).toLocaleString("id-ID") : sessionDateStr,
    checkOutTimeStr: session.checkOutTime ? `${session.date} ${session.checkOutTime}` : sessionDateStr
  };
}

export function getComplianceVisualBadge(score: number | null, expectedSessions: number): string {
  if (expectedSessions === 0 || score === null) return "⚪ N/A (Belum Ada Sesi)";
  if (score >= 95) return "🟢 Sangat Disiplin";
  if (score >= 85) return "🟢 Disiplin";
  if (score >= 70) return "🟡 Cukup";
  if (score >= 50) return "🟠 Kurang";
  return "🔴 Perlu Pembinaan";
}

export const adminComplianceEngineService = {
  // 1. Fetch SSOT Teaching Sessions (Teacher Teaching Attendances)
  async calculateExpectedTeachingSessions(filters: ComplianceFilters = {}): Promise<TeacherTeachingAttendance[]> {
    try {
      let sessions = await teacherTeachingAttendanceService.getAllAttendances({
        academicYearId: filters.academicYearId,
        semesterId: filters.semesterId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        teacherId: filters.teacherId && filters.teacherId !== "ALL" ? filters.teacherId : undefined,
        subjectId: filters.subjectId && filters.subjectId !== "ALL" ? filters.subjectId : undefined,
        classId: filters.classId && filters.classId !== "ALL" ? filters.classId : undefined
      });

      if (filters.month) {
        sessions = sessions.filter(s => s.date && s.date.startsWith(filters.month!));
      }

      return sessions;
    } catch (error) {
      console.error("Error calculating expected teaching sessions:", error);
      return [];
    }
  },

  // 2. Fetch Actual Teaching Journals
  async calculateActualJournals(filters: ComplianceFilters = {}): Promise<TeachingJournal[]> {
    try {
      let journals = await teachingJournalService.getAll(filters.academicYearId, filters.semesterId);

      if (filters.teacherId && filters.teacherId !== "ALL") {
        journals = journals.filter(j => j.teacherId === filters.teacherId);
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        journals = journals.filter(j => j.subjectId === filters.subjectId);
      }
      if (filters.classId && filters.classId !== "ALL") {
        journals = journals.filter(j => j.classId === filters.classId);
      }
      if (filters.startDate) {
        journals = journals.filter(j => j.date >= filters.startDate!);
      }
      if (filters.endDate) {
        journals = journals.filter(j => j.date <= filters.endDate!);
      }
      if (filters.month) {
        journals = journals.filter(j => j.date && j.date.startsWith(filters.month!));
      }

      return journals;
    } catch (error) {
      console.error("Error calculating actual journals:", error);
      return [];
    }
  },

  // 3. Compare Expected Teaching Sessions vs Actual Journals with Timeliness Engine
  async compareExpectedVsActual(filters: ComplianceFilters = {}) {
    const sessions = await this.calculateExpectedTeachingSessions(filters);
    const journals = await this.calculateActualJournals(filters);
    const settings = await schoolSettingsService.getSettings();
    const rules = settings.teachingAttendanceSettings?.journalTimelinessRules || DEFAULT_JOURNAL_TIMELINESS_RULES;

    // Filter sessions where teacher was assigned/present (Hadir / Guru Pengganti / default session)
    const expectedSessions = sessions.filter(s => 
      !s.status || s.status === "Hadir" || s.status === "Guru Pengganti"
    );

    const filledJournalMap = new Map<string, TeachingJournal>();
    journals.forEach(j => {
      const key = `${j.teacherId}_${j.classId}_${j.subjectId}_${j.date}`;
      filledJournalMap.set(key, j);
    });

    let onTimeCount = 0;
    let lateCount = 0;
    let totalTimelinessScoreSum = 0;
    const missingJournals: MissingJournalDetail[] = [];
    const lateJournals: MissingJournalDetail[] = [];

    expectedSessions.forEach(session => {
      const key = `${session.teacherId}_${session.classId}_${session.subjectId}_${session.date}`;
      const matchedJournal = filledJournalMap.get(key) || journals.find(j => 
        j.teacherId === session.teacherId && 
        j.date === session.date && 
        (j.classId === session.classId || j.subjectId === session.subjectId)
      );

      const evalResult = evaluateSessionTimeliness(session, matchedJournal, rules);
      totalTimelinessScoreSum += evalResult.score;

      const dayName = session.date ? new Date(session.date).toLocaleDateString("id-ID", { weekday: "long" }) : "";

      if (matchedJournal) {
        if (!evalResult.isLate) {
          onTimeCount++;
        } else {
          lateCount++;
          lateJournals.push({
            id: `late_${session.id || Math.random().toString(36).substring(2)}`,
            teacherId: session.teacherId,
            teacherName: session.teacherName || "Guru",
            date: session.date,
            dayName,
            className: session.className || "Kelas",
            subjectName: session.subjectName || "Mata Pelajaran",
            period: session.period || "Sesi Mengajar",
            timeSlot: session.checkInTime ? `${session.checkInTime} - ${session.checkOutTime || ""}` : undefined,
            sessionStatus: session.status || "Hadir",
            complianceStatus: "Terlambat",
            attendanceId: session.id,
            checkOutTime: evalResult.checkOutTimeStr,
            submissionTime: evalResult.submissionTimeStr,
            delayMinutes: evalResult.delayMinutes,
            delayHoursDisplay: evalResult.delayHoursDisplay,
            timelinessCategory: evalResult.category,
            timelinessScore: evalResult.score
          });
        }
      } else {
        missingJournals.push({
          id: `missing_${session.id || Math.random().toString(36).substring(2)}`,
          teacherId: session.teacherId,
          teacherName: session.teacherName || "Guru",
          date: session.date,
          dayName,
          className: session.className || "Kelas",
          subjectName: session.subjectName || "Mata Pelajaran",
          period: session.period || "Sesi Mengajar",
          timeSlot: session.checkInTime ? `${session.checkInTime} - ${session.checkOutTime || ""}` : undefined,
          sessionStatus: session.status || "Hadir",
          complianceStatus: "Belum Mengisi",
          attendanceId: session.id,
          timelinessCategory: "Belum Mengisi",
          timelinessScore: rules.unfilledJournalScore ?? 0
        });
      }
    });

    const expectedCount = expectedSessions.length;
    const actualCount = Math.min(journals.length, expectedCount);
    const missingCount = missingJournals.length;

    // RULE 2: If expected sessions === 0, score = null (N/A)
    const averageTimelinessScore = expectedCount > 0 
      ? Math.round(totalTimelinessScoreSum / expectedCount) 
      : null;

    const timelinessStatus = getComplianceVisualBadge(averageTimelinessScore, expectedCount);

    return {
      expectedCount,
      actualCount,
      totalFilledJournals: journals.length,
      onTimeCount,
      lateCount,
      missingCount,
      averageTimelinessScore,
      timelinessStatus,
      missingJournals,
      lateJournals
    };
  },

  // 4. Calculate Full Compliance Summary (Prota, Prosem, Modul Ajar, Jurnal Mengajar + Disiplin)
  async calculateComplianceSummary(filters: ComplianceFilters = {}): Promise<ComplianceSummary> {
    try {
      const [allTeachers, allSchedules, protaList, promesList, lessonPlanList, comparison, disciplineMetrics] = await Promise.all([
        teacherService.getTeachers(),
        scheduleService.getSchedules(filters.academicYearId, filters.semesterId),
        curriculumPlanningService.getAllAnnualPrograms(),
        curriculumPlanningService.getAllSemesterPrograms(),
        lessonPlanService.getLessonPlans({
          academicYearId: filters.academicYearId,
          semesterId: filters.semesterId
        }),
        this.compareExpectedVsActual(filters),
        teacherDisciplineService.getDisciplineMetrics(filters)
      ]);

      let teachers = allTeachers.filter(t => t.isDeleted !== true);
      if (filters.teacherId && filters.teacherId !== "ALL") {
        teachers = teachers.filter(t => t.id === filters.teacherId);
      }

      let schedules = allSchedules;
      if (filters.teacherId && filters.teacherId !== "ALL") {
        schedules = schedules.filter(s => s.teacherId === filters.teacherId);
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        schedules = schedules.filter(s => s.subjectId === filters.subjectId);
      }
      if (filters.classId && filters.classId !== "ALL") {
        schedules = schedules.filter(s => s.classId === filters.classId);
      }

      const assignmentPairs = new Set<string>();
      schedules.forEach(s => {
        if (s.classId && s.subjectId) {
          assignmentPairs.add(`${s.classId}_${s.subjectId}`);
        }
      });

      const protaTarget = Math.max(assignmentPairs.size, teachers.length > 0 ? teachers.length : 1);
      const promesTarget = Math.max(assignmentPairs.size, teachers.length > 0 ? teachers.length : 1);

      let filteredProta = protaList;
      if (filters.academicYearId) {
        filteredProta = filteredProta.filter(p => p.academicYearId === filters.academicYearId);
      }
      if (filters.teacherId && filters.teacherId !== "ALL") {
        filteredProta = filteredProta.filter(p => p.createdBy === filters.teacherId);
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        filteredProta = filteredProta.filter(p => p.subjectId === filters.subjectId);
      }
      if (filters.classId && filters.classId !== "ALL") {
        filteredProta = filteredProta.filter(p => p.classId === filters.classId);
      }
      const actualProtaCount = filteredProta.length;

      let filteredPromes = promesList;
      if (filters.academicYearId) {
        filteredPromes = filteredPromes.filter(p => p.academicYearId === filters.academicYearId);
      }
      if (filters.semesterId) {
        filteredPromes = filteredPromes.filter(p => p.semesterId === filters.semesterId);
      }
      if (filters.teacherId && filters.teacherId !== "ALL") {
        filteredPromes = filteredPromes.filter(p => p.createdBy === filters.teacherId);
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        filteredPromes = filteredPromes.filter(p => p.subjectId === filters.subjectId);
      }
      if (filters.classId && filters.classId !== "ALL") {
        filteredPromes = filteredPromes.filter(p => p.classId === filters.classId);
      }
      const actualPromesCount = filteredPromes.length;

      let modulTargetCount = 0;
      filteredProta.forEach(pr => {
        if (pr.topics && pr.topics.length > 0) {
          modulTargetCount += pr.topics.reduce((acc, top) => acc + (top.subtopics?.length || 1), 0);
        } else {
          modulTargetCount += 2;
        }
      });
      if (modulTargetCount === 0) {
        modulTargetCount = protaTarget * 2;
      }

      let filteredModul = lessonPlanList;
      if (filters.teacherId && filters.teacherId !== "ALL") {
        filteredModul = filteredModul.filter(m => m.teacherId === filters.teacherId || m.createdBy === filters.teacherId);
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        filteredModul = filteredModul.filter(m => m.subjectId === filters.subjectId);
      }
      if (filters.classId && filters.classId !== "ALL") {
        filteredModul = filteredModul.filter(m => m.classId === filters.classId);
      }
      const actualModulCount = filteredModul.length;

      const calcComp = (name: string, target: number, actual: number): ComponentCompliance => {
        const safeTarget = Math.max(1, target);
        const validActual = Math.min(actual, safeTarget);
        const pct = Math.min(100, Math.round((validActual / safeTarget) * 100));
        const missing = Math.max(0, safeTarget - validActual);

        let status: ComponentCompliance["status"] = "Pembinaan Khusus";
        if (pct >= 90) status = "Sangat Baik";
        else if (pct >= 80) status = "Baik";
        else if (pct >= 70) status = "Cukup";
        else if (pct >= 60) status = "Perlu Pembinaan";

        return {
          name,
          target: safeTarget,
          actual: validActual,
          missing,
          percentage: pct,
          status
        };
      };

      const protaComp = calcComp("Prota", protaTarget, actualProtaCount);
      const prosemComp = calcComp("Prosem", promesTarget, actualPromesCount);
      const modulComp = calcComp("Modul Ajar", modulTargetCount, actualModulCount);

      const jTarget = Math.max(0, comparison.expectedCount);
      const jActual = Math.min(comparison.actualCount, jTarget);
      const jMissing = comparison.missingCount;
      const jPct = jTarget > 0 ? Math.min(100, Math.round((jActual / jTarget) * 100)) : 100;

      let jStatus: ComponentCompliance["status"] = "Sangat Baik";
      if (jPct < 60) jStatus = "Pembinaan Khusus";
      else if (jPct < 70) jStatus = "Perlu Pembinaan";
      else if (jPct < 80) jStatus = "Cukup";
      else if (jPct < 90) jStatus = "Baik";

      const jurnalComp: ComponentCompliance = {
        name: "Jurnal Mengajar",
        target: jTarget,
        actual: jActual,
        missing: jMissing,
        percentage: jPct,
        status: jStatus
      };

      const overallPct = Math.round(
        (protaComp.percentage + prosemComp.percentage + modulComp.percentage + jurnalComp.percentage) / 4
      );

      // Discipline metrics calculation
      const metricsList = disciplineMetrics.metrics || [];
      let totalDisciplineScore = 0;
      let totalAttRate = 0;
      let totalCheckInRate = 0;
      let totalCheckOutRate = 0;
      const dCount = Math.max(1, metricsList.length);

      metricsList.forEach(m => {
        totalDisciplineScore += m.disciplineScore;
        totalAttRate += m.attendancePercentage;
        totalCheckInRate += m.checkInOnTimePercentage;
        totalCheckOutRate += m.checkOutOnTimePercentage;
      });

      return {
        prota: protaComp,
        prosem: prosemComp,
        modulAjar: modulComp,
        jurnalMengajar: jurnalComp,
        overallPercentage: overallPct,
        totalExpectedSessions: comparison.expectedCount,
        totalActualJournals: comparison.actualCount,
        totalMissingJournals: comparison.missingCount,
        totalOnTimeJournals: comparison.onTimeCount,
        totalLateJournals: comparison.lateCount,
        onTimePercentage: comparison.averageTimelinessScore,
        onTimeStatus: comparison.timelinessStatus,
        avgDisciplineScore: Math.round(totalDisciplineScore / dCount),
        avgAttendanceRate: Math.round(totalAttRate / dCount),
        avgCheckInOnTimeRate: Math.round(totalCheckInRate / dCount),
        avgCheckOutOnTimeRate: Math.round(totalCheckOutRate / dCount)
      };
    } catch (error) {
      console.error("Error calculating compliance summary:", error);
      return {
        prota: { name: "Prota", target: 0, actual: 0, missing: 0, percentage: 0, status: "Pembinaan Khusus" },
        prosem: { name: "Prosem", target: 0, actual: 0, missing: 0, percentage: 0, status: "Pembinaan Khusus" },
        modulAjar: { name: "Modul Ajar", target: 0, actual: 0, missing: 0, percentage: 0, status: "Pembinaan Khusus" },
        jurnalMengajar: { name: "Jurnal Mengajar", target: 0, actual: 0, missing: 0, percentage: 0, status: "Pembinaan Khusus" },
        overallPercentage: 0,
        totalExpectedSessions: 0,
        totalActualJournals: 0,
        totalMissingJournals: 0,
        totalOnTimeJournals: 0,
        totalLateJournals: 0,
        onTimePercentage: null,
        onTimeStatus: "⚪ N/A (Belum Ada Sesi)",
        avgDisciplineScore: 100,
        avgAttendanceRate: 100,
        avgCheckInOnTimeRate: 100,
        avgCheckOutOnTimeRate: 100
      };
    }
  },

  // 5. Calculate Teacher Administration Score & Discipline Rankings (SEPARATED KPI)
  async calculateTeacherAdministrationScore(filters: ComplianceFilters = {}): Promise<TeacherComplianceRanking[]> {
    try {
      const [allTeachers, allSchedules, protaList, promesList, lessonPlanList, sessions, journals, settings, disciplineMetrics] = await Promise.all([
        teacherService.getTeachers(),
        scheduleService.getSchedules(filters.academicYearId, filters.semesterId),
        curriculumPlanningService.getAllAnnualPrograms(),
        curriculumPlanningService.getAllSemesterPrograms(),
        lessonPlanService.getLessonPlans({ academicYearId: filters.academicYearId, semesterId: filters.semesterId }),
        this.calculateExpectedTeachingSessions(filters),
        this.calculateActualJournals(filters),
        schoolSettingsService.getSettings(),
        teacherDisciplineService.getDisciplineMetrics(filters)
      ]);

      const rules = settings.teachingAttendanceSettings?.journalTimelinessRules || DEFAULT_JOURNAL_TIMELINESS_RULES;
      const activeTeachers = allTeachers.filter(t => t.isDeleted !== true);

      const discMap = new Map<string, any>();
      (disciplineMetrics.metrics || []).forEach(m => discMap.set(m.teacherId, m));

      const rankings: TeacherComplianceRanking[] = activeTeachers.map(teacher => {
        const teacherScheds = allSchedules.filter(s => s.teacherId === teacher.id);
        const assignmentCount = Math.max(1, new Set(teacherScheds.map(s => `${s.classId}_${s.subjectId}`)).size);

        // Prota Score
        const teacherProta = protaList.filter(p => p.createdBy === teacher.id || p.teacherId === teacher.id);
        const protaScore = Math.min(100, Math.round((teacherProta.length / assignmentCount) * 100));

        // Prosem Score
        const teacherPromes = promesList.filter(p => p.createdBy === teacher.id || p.teacherId === teacher.id);
        const prosemScore = Math.min(100, Math.round((teacherPromes.length / assignmentCount) * 100));

        // Modul Ajar Score
        const teacherModuls = lessonPlanList.filter(m => m.teacherId === teacher.id || m.createdBy === teacher.id);
        const modulScore = Math.min(100, Math.round((teacherModuls.length / (assignmentCount * 2)) * 100));

        // Sessions & Journals for this teacher
        const teacherSessions = sessions.filter(s => s.teacherId === teacher.id && (!s.status || s.status === "Hadir" || s.status === "Guru Pengganti"));
        const teacherJournals = journals.filter(j => j.teacherId === teacher.id);

        const expectedSessionsCount = teacherSessions.length;
        const actualJournalsCount = Math.min(teacherJournals.length, expectedSessionsCount);
        const missingJournalCount = Math.max(0, expectedSessionsCount - teacherJournals.length);

        // Jurnal Kelengkapan Score
        const jurnalKelengkapanScore = expectedSessionsCount > 0 
          ? Math.min(100, Math.round((actualJournalsCount / expectedSessionsCount) * 100))
          : (teacherJournals.length > 0 ? 100 : 80);

        // Jurnal Ketepatan Score (Tepat Waktu based on QR check-out)
        let jurnalKetepatanScore: number | null = null;
        let lateJournalCount = 0;

        if (expectedSessionsCount > 0) {
          let sumTimelinessScores = 0;
          teacherSessions.forEach(sess => {
            const matchedJournal = teacherJournals.find(j => j.date === sess.date && (j.classId === sess.classId || j.subjectId === sess.subjectId));
            const evalResult = evaluateSessionTimeliness(sess, matchedJournal, rules);
            sumTimelinessScores += evalResult.score;
            if (evalResult.isLate) lateJournalCount++;
          });
          jurnalKetepatanScore = Math.round(sumTimelinessScores / expectedSessionsCount);
        } else {
          // If expected sessions = 0, score is N/A (null)
          jurnalKetepatanScore = null;
        }

        // Weighted Administration Total Score
        // Prota 20%, Prosem 20%, Modul 20%, Kelengkapan Jurnal 20%, Ketepatan Jurnal 20%
        const timelinessComponent = jurnalKetepatanScore !== null ? jurnalKetepatanScore : jurnalKelengkapanScore;
        const adminTotalScore = Math.round(
          protaScore * 0.20 + 
          prosemScore * 0.20 + 
          modulScore * 0.20 + 
          jurnalKelengkapanScore * 0.20 + 
          timelinessComponent * 0.20
        );

        // Disiplin Mengajar Metrics
        const discMetric = discMap.get(teacher.id) || {};
        const disciplineScore = discMetric.disciplineScore ?? 100;
        const attendanceRate = discMetric.attendancePercentage ?? 100;
        const onTimeCheckInRate = discMetric.checkInOnTimePercentage ?? 100;
        const onTimeCheckOutRate = discMetric.checkOutOnTimePercentage ?? 100;
        const lateCount = discMetric.totalTerlambat ?? 0;
        const alphaCount = discMetric.totalAlpha ?? 0;
        const izinCount = discMetric.totalIzin ?? 0;

        // Total Combined Score (50% Administrasi, 50% Disiplin)
        const totalScore = Math.round((adminTotalScore * 0.5) + (disciplineScore * 0.5));

        let category: TeacherComplianceRanking["category"] = "Pembinaan Khusus";
        if (totalScore >= 90) category = "Sangat Baik";
        else if (totalScore >= 80) category = "Baik";
        else if (totalScore >= 70) category = "Cukup";
        else if (totalScore >= 60) category = "Perlu Pembinaan";

        const visualStatus = getComplianceVisualBadge(jurnalKetepatanScore, expectedSessionsCount);

        return {
          teacherId: teacher.id,
          teacherName: teacher.name,
          niy: teacher.niy || teacher.nip,
          protaScore,
          prosemScore,
          modulScore,
          jurnalKelengkapanScore,
          jurnalKetepatanScore,
          adminTotalScore,

          disciplineScore,
          attendanceRate,
          onTimeCheckInRate,
          onTimeCheckOutRate,
          lateCount,
          alphaCount,
          izinCount,

          onTimeRate: jurnalKetepatanScore,
          totalScore,
          category,
          visualStatus,

          expectedSessionsCount,
          actualJournalsCount,
          missingJournalCount,
          lateJournalCount
        };
      });

      rankings.sort((a, b) => b.totalScore - a.totalScore);
      return rankings;
    } catch (error) {
      console.error("Error calculating teacher administration scores:", error);
      return [];
    }
  },

  // 6. Calculate Monthly Trend
  async calculateMonthlyTrend(filters: ComplianceFilters = {}): Promise<MonthlyTrendItem[]> {
    try {
      const [sessions, journals, settings] = await Promise.all([
        this.calculateExpectedTeachingSessions(filters),
        this.calculateActualJournals(filters),
        schoolSettingsService.getSettings()
      ]);

      const rules = settings.teachingAttendanceSettings?.journalTimelinessRules || DEFAULT_JOURNAL_TIMELINESS_RULES;

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
      const trendMap = new Map<string, { expected: number; actual: number; timelinessScoreSum: number }>();
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const key = `${y}-${m}`;
        trendMap.set(key, { expected: 0, actual: 0, timelinessScoreSum: 0 });
      }

      const filledMap = new Map<string, TeachingJournal>();
      journals.forEach(j => {
        filledMap.set(`${j.teacherId}_${j.classId}_${j.subjectId}_${j.date}`, j);
      });

      sessions.forEach(s => {
        if (s.date && s.date.length >= 7) {
          const key = s.date.substring(0, 7);
          if (trendMap.has(key)) {
            const entry = trendMap.get(key)!;
            entry.expected++;

            const matchedJ = filledMap.get(`${s.teacherId}_${s.classId}_${s.subjectId}_${s.date}`);
            if (matchedJ) entry.actual++;

            const evalRes = evaluateSessionTimeliness(s, matchedJ, rules);
            entry.timelinessScoreSum += evalRes.score;
          }
        }
      });

      const trendItems: MonthlyTrendItem[] = [];
      trendMap.forEach((val, key) => {
        const [yStr, mStr] = key.split("-");
        const mIdx = parseInt(mStr, 10) - 1;
        const monthName = `${monthNames[mIdx]} ${yStr}`;

        const expected = val.expected;
        const actual = Math.min(val.actual, expected > 0 ? expected : val.actual);
        const missing = Math.max(0, expected - actual);
        const pct = expected > 0 ? Math.min(100, Math.round((actual / expected) * 100)) : (actual > 0 ? 100 : 0);
        const onTimeRate = expected > 0 ? Math.round(val.timelinessScoreSum / expected) : null;

        trendItems.push({
          monthName,
          monthKey: key,
          expectedSessions: expected,
          actualJournals: actual,
          missingJournals: missing,
          complianceRate: pct,
          onTimeRate
        });
      });

      return trendItems;
    } catch (error) {
      console.error("Error calculating monthly trend:", error);
      return [];
    }
  },

  // 7. Get System Recommendations & Monthly Reports Highlights
  generateSystemRecommendations(
    summary: ComplianceSummary,
    rankings: TeacherComplianceRanking[]
  ): string[] {
    const recommendations: string[] = [];

    if (summary.overallPercentage >= 90) {
      recommendations.push(
        `Kepatuhan administrasi guru secara keseluruhan berada pada tingkat SANGAT BAIK (${summary.overallPercentage}%). Pertahankan konsistensi ini!`
      );
    } else if (summary.overallPercentage < 70) {
      recommendations.push(
        `Tingkat kepatuhan administrasi guru membutuhkan perhatian khusus (${summary.overallPercentage}%). Diperlukan pembinaan langsung bagi guru yang berada di bawah target.`
      );
    }

    if (summary.totalMissingJournals > 0) {
      recommendations.push(
        `Terdeteksi ${summary.totalMissingJournals} sesi mengajar yang BELUM diisi jurnalnya. Nilai ketepatan waktu disesuaikan menjadi 0 poin untuk sesi tersebut.`
      );
    }

    const topPerformers = rankings.filter(r => r.totalScore >= 95);
    if (topPerformers.length > 0) {
      const names = topPerformers.slice(0, 3).map(r => r.teacherName).join(", ");
      recommendations.push(
        `Apresiasi Guru Terdisiplin & Administrasi Terbaik: ${names}.`
      );
    }

    const coachingNeeded = rankings.filter(r => r.category === "Perlu Pembinaan" || r.category === "Pembinaan Khusus");
    if (coachingNeeded.length > 0) {
      const names = coachingNeeded.slice(0, 3).map(r => `${r.teacherName} (Skor: ${r.totalScore})`).join(", ");
      recommendations.push(
        `Guru Perlu Pembinaan / Pendampingan: ${names}.`
      );
    }

    if (summary.totalLateJournals > 0) {
      recommendations.push(
        `Terdapat ${summary.totalLateJournals} jurnal diisi terlambat setelah sesi QR Check-out selesai.`
      );
    }

    return recommendations;
  },

  // 8. Get Distinct Teacher KPI Summary
  async getDistinctTeacherKpiSummary(filters: ComplianceFilters = {}) {
    const [summary, rankings] = await Promise.all([
      this.calculateComplianceSummary(filters),
      this.calculateTeacherAdministrationScore(filters)
    ]);
    return Object.assign([...rankings], {
      summary,
      rankings,
      teachers: rankings,
      items: rankings,
      totalTeachers: rankings.length
    });
  }
};

export const getDistinctTeacherKpiSummary = (filters?: ComplianceFilters) =>
  adminComplianceEngineService.getDistinctTeacherKpiSummary(filters);

