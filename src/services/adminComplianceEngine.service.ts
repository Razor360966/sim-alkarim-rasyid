import { teacherService } from "./teacherService";
import { curriculumPlanningService } from "./curriculumPlanning.service";
import { lessonPlanService } from "./lessonPlan.service";
import { teachingJournalService } from "./teachingJournalService";
import { teacherTeachingAttendanceService } from "./teacherTeachingAttendance.service";
import { scheduleService } from "./schedule.service";
import { academicPlanningService } from "./academicPlanning.service";
import { classService } from "./classService";
import { subjectService } from "./subjectService";
import { TeachingJournal, AnnualProgram, SemesterProgram, LessonPlan, Schedule, Teacher, TeacherTeachingAttendance } from "../types";

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
  protaScore: number;
  prosemScore: number;
  modulScore: number;
  jurnalScore: number;
  onTimeRate: number;
  totalScore: number;
  category: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Pembinaan" | "Pembinaan Khusus";
  missingJournalCount: number;
  lateJournalCount: number;
}

export interface MissingJournalDetail {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string;
  className: string;
  subjectName: string;
  period: string;
  timeSlot?: string;
  sessionStatus: string;
  complianceStatus: "Belum Mengisi" | "Terlambat";
  attendanceId?: string;
  delayHours?: number;
}

export interface MonthlyTrendItem {
  monthName: string;
  monthKey: string; // "2026-08"
  expectedSessions: number;
  actualJournals: number;
  missingJournals: number;
  complianceRate: number;
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
  onTimePercentage: number;
}

export const adminComplianceEngineService = {
  // 1. Fetch SSOT Teaching Sessions (Teacher Teaching Attendances)
  async calculateExpectedTeachingSessions(filters: ComplianceFilters = {}): Promise<TeacherTeachingAttendance[]> {
    try {
      // Get all recorded teaching sessions from SSOT collection
      let sessions = await teacherTeachingAttendanceService.getAllAttendances({
        academicYearId: filters.academicYearId,
        semesterId: filters.semesterId,
        startDate: filters.startDate,
        endDate: filters.endDate,
        teacherId: filters.teacherId && filters.teacherId !== "ALL" ? filters.teacherId : undefined,
        subjectId: filters.subjectId && filters.subjectId !== "ALL" ? filters.subjectId : undefined,
        classId: filters.classId && filters.classId !== "ALL" ? filters.classId : undefined
      });

      // Filter by month if specified
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

      // Client-side filtering
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

  // 3. Compare Expected Teaching Sessions vs Actual Journals
  async compareExpectedVsActual(filters: ComplianceFilters = {}) {
    const sessions = await this.calculateExpectedTeachingSessions(filters);
    const journals = await this.calculateActualJournals(filters);

    // Filter sessions where teacher was responsible (e.g., Hadir, or default session)
    // Sessions where teacher was absent/izin/dinas are handled per their recorded session status
    const expectedSessions = sessions.filter(s => 
      !s.status || s.status === "Hadir" || s.status === "Guru Pengganti"
    );

    const filledJournalMap = new Map<string, TeachingJournal>();
    journals.forEach(j => {
      // Match key: teacherId + classId + subjectId + date
      const key = `${j.teacherId}_${j.classId}_${j.subjectId}_${j.date}`;
      filledJournalMap.set(key, j);
    });

    let onTimeCount = 0;
    let lateCount = 0;
    const missingJournals: MissingJournalDetail[] = [];

    expectedSessions.forEach(session => {
      const key = `${session.teacherId}_${session.classId}_${session.subjectId}_${session.date}`;
      const matchedJournal = filledJournalMap.get(key) || journals.find(j => 
        j.teacherId === session.teacherId && 
        j.date === session.date && 
        (j.classId === session.classId || j.subjectId === session.subjectId)
      );

      if (matchedJournal) {
        // Evaluate if filled on time (filled within 24 hours of session date/time)
        const sessionTime = new Date(`${session.date}T${session.checkInTime || "08:00"}:00`).getTime();
        const journalCreatedTime = matchedJournal.createdAt ? new Date(matchedJournal.createdAt).getTime() : sessionTime;
        const diffHours = (journalCreatedTime - sessionTime) / (1000 * 60 * 60);

        if (diffHours <= 24) {
          onTimeCount++;
        } else {
          lateCount++;
        }
      } else {
        missingJournals.push({
          id: `missing_${session.id || Math.random().toString(36).substring(2)}`,
          teacherId: session.teacherId,
          teacherName: session.teacherName || "Guru",
          date: session.date,
          className: session.className || "Kelas",
          subjectName: session.subjectName || "Mata Pelajaran",
          period: session.period || "Sesi Mengajar",
          timeSlot: session.checkInTime ? `${session.checkInTime} - ${session.checkOutTime || ""}` : undefined,
          sessionStatus: session.status || "Hadir",
          complianceStatus: "Belum Mengisi",
          attendanceId: session.id
        });
      }
    });

    return {
      expectedCount: expectedSessions.length,
      actualCount: Math.min(journals.length, expectedSessions.length),
      totalFilledJournals: journals.length,
      onTimeCount,
      lateCount,
      missingCount: missingJournals.length,
      missingJournals
    };
  },

  // 4. Calculate Full Compliance Summary (Prota, Prosem, Modul Ajar, Jurnal Mengajar)
  async calculateComplianceSummary(filters: ComplianceFilters = {}): Promise<ComplianceSummary> {
    try {
      const [allTeachers, allSchedules, protaList, promesList, lessonPlanList, comparison] = await Promise.all([
        teacherService.getTeachers(),
        scheduleService.getSchedules(filters.academicYearId, filters.semesterId),
        curriculumPlanningService.getAllAnnualPrograms(),
        curriculumPlanningService.getAllSemesterPrograms(),
        lessonPlanService.getLessonPlans({
          academicYearId: filters.academicYearId,
          semesterId: filters.semesterId
        }),
        this.compareExpectedVsActual(filters)
      ]);

      let teachers = allTeachers.filter(t => t.isDeleted !== true);
      if (filters.teacherId && filters.teacherId !== "ALL") {
        teachers = teachers.filter(t => t.id === filters.teacherId);
      }

      // Filter schedules
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

      // Unique Teaching Assignment Pairs: (classId + subjectId)
      const assignmentPairs = new Set<string>();
      schedules.forEach(s => {
        if (s.classId && s.subjectId) {
          assignmentPairs.add(`${s.classId}_${s.subjectId}`);
        }
      });

      // Target Prota & Prosem = Number of teaching assignment pairs (or active teachers count if schedules empty)
      const protaTarget = Math.max(assignmentPairs.size, teachers.length > 0 ? teachers.length : 1);
      const promesTarget = Math.max(assignmentPairs.size, teachers.length > 0 ? teachers.length : 1);

      // Actual Prota
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

      // Actual Prosem
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

      // Modul Ajar Target (based on TP count in Prota/Promes or fallback 2 modules per assignment pair)
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

      // Actual Modul Ajar
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

      // Calculate Percentages and Status
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

      // Jurnal Mengajar Compliance
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

      const totalFilled = comparison.onTimeCount + comparison.lateCount;
      const onTimePct = totalFilled > 0 ? Math.round((comparison.onTimeCount / totalFilled) * 100) : 100;

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
        onTimePercentage: onTimePct
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
        onTimePercentage: 100
      };
    }
  },

  // 5. Calculate Teacher Administration Score & Rankings
  async calculateTeacherAdministrationScore(filters: ComplianceFilters = {}): Promise<TeacherComplianceRanking[]> {
    try {
      const [allTeachers, allSchedules, protaList, promesList, lessonPlanList, sessions, journals] = await Promise.all([
        teacherService.getTeachers(),
        scheduleService.getSchedules(filters.academicYearId, filters.semesterId),
        curriculumPlanningService.getAllAnnualPrograms(),
        curriculumPlanningService.getAllSemesterPrograms(),
        lessonPlanService.getLessonPlans({ academicYearId: filters.academicYearId, semesterId: filters.semesterId }),
        this.calculateExpectedTeachingSessions(filters),
        this.calculateActualJournals(filters)
      ]);

      const activeTeachers = allTeachers.filter(t => t.isDeleted !== true);

      const rankings: TeacherComplianceRanking[] = activeTeachers.map(teacher => {
        // Teacher's assigned schedules
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
        const teacherSessions = sessions.filter(s => s.teacherId === teacher.id);
        const teacherJournals = journals.filter(j => j.teacherId === teacher.id);

        const expectedCount = Math.max(1, teacherSessions.length);
        const actualJurnalCount = Math.min(teacherJournals.length, expectedCount);
        const missingCount = Math.max(0, teacherSessions.length - teacherJournals.length);

        const jurnalScore = teacherSessions.length > 0 
          ? Math.min(100, Math.round((actualJurnalCount / expectedCount) * 100))
          : (teacherJournals.length > 0 ? 100 : 80);

        // Calculate On-Time Rate
        let onTimeJournals = 0;
        let lateJournals = 0;
        teacherJournals.forEach(j => {
          const matchedSession = teacherSessions.find(s => s.date === j.date);
          const sessionTime = matchedSession ? new Date(`${matchedSession.date}T${matchedSession.checkInTime || "08:00"}:00`).getTime() : new Date(j.date).getTime();
          const createdTime = j.createdAt ? new Date(j.createdAt).getTime() : sessionTime;
          const diffHours = (createdTime - sessionTime) / (1000 * 60 * 60);

          if (diffHours <= 24) onTimeJournals++;
          else lateJournals++;
        });

        const onTimeRate = teacherJournals.length > 0 ? Math.round((onTimeJournals / teacherJournals.length) * 100) : 100;

        // Weighted Total Administration Score:
        // Prota 20%, Prosem 20%, Modul 20%, Jurnal 20%, On-time Rate 20%
        const totalScore = Math.round(
          protaScore * 0.20 + 
          prosemScore * 0.20 + 
          modulScore * 0.20 + 
          jurnalScore * 0.20 + 
          onTimeRate * 0.20
        );

        let category: TeacherComplianceRanking["category"] = "Pembinaan Khusus";
        if (totalScore >= 90) category = "Sangat Baik";
        else if (totalScore >= 80) category = "Baik";
        else if (totalScore >= 70) category = "Cukup";
        else if (totalScore >= 60) category = "Perlu Pembinaan";

        return {
          teacherId: teacher.id,
          teacherName: teacher.name,
          niy: teacher.niy || teacher.nip,
          protaScore,
          prosemScore,
          modulScore,
          jurnalScore,
          onTimeRate,
          totalScore,
          category,
          missingJournalCount: missingCount,
          lateJournalCount: lateJournals
        };
      });

      // Sort by totalScore desc
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
      const [sessions, journals] = await Promise.all([
        this.calculateExpectedTeachingSessions(filters),
        this.calculateActualJournals(filters)
      ]);

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
      const currentYear = new Date().getFullYear();

      // Initialize last 6 months
      const trendMap = new Map<string, { expected: number; actual: number }>();
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const key = `${y}-${m}`;
        trendMap.set(key, { expected: 0, actual: 0 });
      }

      sessions.forEach(s => {
        if (s.date && s.date.length >= 7) {
          const key = s.date.substring(0, 7);
          if (trendMap.has(key)) {
            trendMap.get(key)!.expected++;
          }
        }
      });

      journals.forEach(j => {
        if (j.date && j.date.length >= 7) {
          const key = j.date.substring(0, 7);
          if (trendMap.has(key)) {
            trendMap.get(key)!.actual++;
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

        trendItems.push({
          monthName,
          monthKey: key,
          expectedSessions: expected,
          actualJournals: actual,
          missingJournals: missing,
          complianceRate: pct
        });
      });

      return trendItems;
    } catch (error) {
      console.error("Error calculating monthly trend:", error);
      return [];
    }
  },

  // 7. Get System Recommendations (Data-driven Insights for Principal)
  generateSystemRecommendations(
    summary: ComplianceSummary,
    rankings: TeacherComplianceRanking[]
  ): string[] {
    const recommendations: string[] = [];

    // Overall compliance insight
    if (summary.overallPercentage >= 90) {
      recommendations.push(
        `Kepatuhan administrasi guru secara keseluruhan berada pada tingkat SANGAT BAIK (${summary.overallPercentage}%). Pertahankan konsistensi ini!`
      );
    } else if (summary.overallPercentage < 70) {
      recommendations.push(
        `Tingkat kepatuhan administrasi guru membutuhkan perhatian khusus (${summary.overallPercentage}%). Diperlukan pembinaan langsung bagi guru yang memiliki persentase di bawah 70%.`
      );
    }

    // Missing journals alert
    if (summary.totalMissingJournals > 0) {
      recommendations.push(
        `Terdapat ${summary.totalMissingJournals} sesi mengajar yang belum diisi jurnalnya oleh guru. Lakukan pemeriksaan pada menu Drilldown.`
      );
    }

    // Top performers
    const topPerformers = rankings.filter(r => r.totalScore === 100);
    if (topPerformers.length > 0) {
      const names = topPerformers.slice(0, 3).map(r => r.teacherName).join(", ");
      recommendations.push(
        `Apresiasi khusus untuk guru dengan kepatuhan 100%: ${names}.`
      );
    }

    // Teachers needing coaching
    const coachingNeeded = rankings.filter(r => r.category === "Perlu Pembinaan" || r.category === "Pembinaan Khusus");
    if (coachingNeeded.length > 0) {
      const names = coachingNeeded.slice(0, 3).map(r => `${r.teacherName} (${r.totalScore}%)`).join(", ");
      recommendations.push(
        `Diperlukan pendampingan administrasi untuk: ${names}.`
      );
    }

    // Late journals warning
    if (summary.totalLateJournals > 3) {
      recommendations.push(
        `Terdeteksi ${summary.totalLateJournals} kali pengisian jurnal terlambat (lebih dari 24 jam setelah sesi mengajar). Imbau guru untuk mengisi segera setelah QR Check-out.`
      );
    }

    return recommendations;
  }
};
