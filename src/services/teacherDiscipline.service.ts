import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  query, 
  where,
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { teacherTeachingAttendanceService } from "./teacherTeachingAttendance.service";
import { teacherService } from "./teacherService";
import { scheduleService, resolveTeacherForScheduleDate } from "./schedule.service";
import { lessonPeriodService } from "./lessonPeriod.service";
import { schoolSettingsService } from "./schoolSettings.service";
import { curriculumPlanningService } from "./curriculumPlanning.service";
import { lessonPlanService } from "./lessonPlan.service";
import { teachingJournalService } from "./teachingJournalService";
import { mutabaahService } from "./mutabaahService";
import { userService } from "./user.service";
import { 
  DisciplineCategory,
  DisciplineWeightsConfig,
  DEFAULT_DISCIPLINE_CONFIG,
  TeacherDisciplineMetric,
  SchoolDisciplineSummary,
  SystemDisciplineRecommendation,
  DisciplineHistoryRecord,
  SubjectDisciplineDetail,
  ProtaDisciplineDetail,
  ProsemDisciplineDetail,
  ModulAjarDisciplineDetail,
  JurnalMengajarDisciplineDetail,
  MutabaahDisciplineDetail,
  AttendanceDisciplineDetail,
  AttendanceSessionItem,
  MenggantikanSessionItem,
  DigantikanSessionItem,
  TerlambatSessionItem
} from "../types/teacherDiscipline.types";
import { Schedule, LessonPeriod, TeacherTeachingAttendance } from "../types";

const DISCIPLINE_HISTORY_COLLECTION = "teacher_discipline_histories";
const DISCIPLINE_CONFIG_COLLECTION = "school_settings";
const DISCIPLINE_CONFIG_DOC = "teacher_discipline_config";

export const getDisciplineCategory = (score: number): DisciplineCategory => {
  if (score >= 96) return "Sangat Disiplin";
  if (score >= 86) return "Disiplin";
  if (score >= 76) return "Cukup Disiplin";
  if (score >= 61) return "Perlu Pembinaan";
  return "Pembinaan Khusus";
};

// Day mapper from JS Date to Indonesian Day Name
export const getIndonesianDayName = (dateStr: string): string => {
  const date = new Date(dateStr);
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[date.getDay()] || "Senin";
};

export const parseJpCount = (jpStr?: string, sequence?: number): number => {
  if (!jpStr) return 1;
  const match = jpStr.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) {
    const start = parseInt(match[1], 10);
    const end = parseInt(match[2], 10);
    return Math.max(1, end - start + 1);
  }
  return 1;
};

export const teacherDisciplineService = {
  /**
   * Get custom weights and late penalty factor from Firestore or fallback to default
   */
  async getDisciplineConfig(): Promise<DisciplineWeightsConfig> {
    try {
      const docRef = doc(db, DISCIPLINE_CONFIG_COLLECTION, DISCIPLINE_CONFIG_DOC);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          adminWeight: data.adminWeight ?? DEFAULT_DISCIPLINE_CONFIG.adminWeight,
          mutabaahWeight: data.mutabaahWeight ?? DEFAULT_DISCIPLINE_CONFIG.mutabaahWeight,
          attendanceWeight: data.attendanceWeight ?? DEFAULT_DISCIPLINE_CONFIG.attendanceWeight,
          latePenaltyFactor: data.latePenaltyFactor ?? DEFAULT_DISCIPLINE_CONFIG.latePenaltyFactor,
          protaWeight: data.protaWeight ?? DEFAULT_DISCIPLINE_CONFIG.protaWeight,
          prosemWeight: data.prosemWeight ?? DEFAULT_DISCIPLINE_CONFIG.prosemWeight,
          modulWeight: data.modulWeight ?? DEFAULT_DISCIPLINE_CONFIG.modulWeight,
          jurnalWeight: data.jurnalWeight ?? DEFAULT_DISCIPLINE_CONFIG.jurnalWeight,
        };
      }
      return DEFAULT_DISCIPLINE_CONFIG;
    } catch (error) {
      console.warn("Could not load custom discipline config, using default:", error);
      return DEFAULT_DISCIPLINE_CONFIG;
    }
  },

  /**
   * Save custom discipline configuration
   */
  async saveDisciplineConfig(config: DisciplineWeightsConfig): Promise<void> {
    try {
      const docRef = doc(db, DISCIPLINE_CONFIG_COLLECTION, DISCIPLINE_CONFIG_DOC);
      await setDoc(docRef, {
        ...config,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${DISCIPLINE_CONFIG_COLLECTION}/${DISCIPLINE_CONFIG_DOC}`);
    }
  },

  /**
   * Main calculation engine: 3 Pillars with Multi-Subject & Real JP Rules
   */
  async getDisciplineMetrics(filters?: {
    academicYearId?: string;
    academicYearName?: string;
    semesterId?: string;
    semesterName?: string;
    startDate?: string; // YYYY-MM-DD (optional, defaults to current month)
    endDate?: string;   // YYYY-MM-DD (optional, defaults to current month)
    teacherId?: string;
    subjectId?: string;
    classId?: string;
    config?: DisciplineWeightsConfig;
  }): Promise<{
    metrics: TeacherDisciplineMetric[];
    summary: SchoolDisciplineSummary;
    recommendations: SystemDisciplineRecommendation[];
    config: DisciplineWeightsConfig;
  }> {
    try {
      const config = filters?.config || await this.getDisciplineConfig();

      const now = new Date();
      const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const startDate = filters?.startDate || defaultStart;
      const endDate = filters?.endDate || defaultEnd;

      // 1. Fetch all dependencies concurrently
      const [
        allTeachers,
        allUsers,
        allSchedules,
        allPeriods,
        allAttendances,
        allProtas,
        allPromes,
        allLessonPlans,
        allJournals,
        allMutabaahEntries,
        allIndicators,
        schoolSettings,
        historySnap
      ] = await Promise.all([
        teacherService.getTeachers(),
        userService.getUsers(),
        scheduleService.getSchedules(filters?.academicYearId, filters?.semesterId),
        lessonPeriodService.getLessonPeriods(),
        teacherTeachingAttendanceService.getAllAttendances({
          academicYearId: filters?.academicYearId,
          semesterId: filters?.semesterId,
        }),
        curriculumPlanningService.getAllAnnualPrograms(),
        curriculumPlanningService.getAllSemesterPrograms(),
        lessonPlanService.getLessonPlans({
          academicYearId: filters?.academicYearId,
          semesterId: filters?.semesterId,
        }),
        teachingJournalService.getAll(filters?.academicYearId, filters?.semesterId),
        mutabaahService.getAllEntries(),
        mutabaahService.getIndicators(),
        schoolSettingsService.getSettings(),
        getDocs(collection(db, DISCIPLINE_HISTORY_COLLECTION))
      ]);

      const pastHistories: DisciplineHistoryRecord[] = [];
      historySnap.forEach(d => pastHistories.push({ id: d.id, ...d.data() } as DisciplineHistoryRecord));

      // Active days configuration
      const activeDays = (schoolSettings?.activeDays && schoolSettings.activeDays.length > 0)
        ? schoolSettings.activeDays
        : ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];

      // 2. Generate calendar day list in date range [startDate, endDate]
      const calendarDates: Array<{ dateStr: string; dayName: string; isActiveDay: boolean }> = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Safe guard loop up to 366 days
      let current = new Date(start);
      let loopCount = 0;
      while (current <= end && loopCount < 370) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, "0");
        const d = String(current.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${d}`;
        const dayName = getIndonesianDayName(dateStr);
        const isActiveDay = activeDays.some(ad => ad.toLowerCase() === dayName.toLowerCase());
        
        calendarDates.push({ dateStr, dayName, isActiveDay });
        current.setDate(current.getDate() + 1);
        loopCount++;
      }

      const activeDatesCount = calendarDates.filter(c => c.isActiveDay).length;

      // 3. Filter teachers
      let targetTeachers = allTeachers;
      if (filters?.teacherId && filters.teacherId !== "ALL") {
        targetTeachers = allTeachers.filter(t => t.id === filters.teacherId);
      }

      // Filter attendances within date range
      const inRangeAttendances = allAttendances.filter(a => {
        if (!a.date) return false;
        return a.date >= startDate && a.date <= endDate;
      });

      // Filter journals within date range
      const inRangeJournals = allJournals.filter(j => {
        if (!j.date) return true;
        return j.date >= startDate && j.date <= endDate;
      });

      // Filter Mutabaah entries within date range
      const inRangeMutabaah = allMutabaahEntries.filter(m => {
        if (!m.date) return false;
        return m.date >= startDate && m.date <= endDate;
      });

      // Active Indicators count for Mutabaah
      const activeIndicators = allIndicators.filter(i => i.isActive && !i.isArchived);

      // Period lookup map: lessonPeriodId -> LessonPeriod
      const periodMap = new Map<string, LessonPeriod>();
      allPeriods.forEach(p => {
        if (p.id) periodMap.set(p.id, p);
      });

      // 4. Calculate metrics for each teacher
      const metrics: TeacherDisciplineMetric[] = [];

      for (const teacher of targetTeachers) {
        // Teacher's Operational Schedules (including effective-dated assignments)
        const teacherSchedules = allSchedules.filter(s => {
          if (s.teacherId === teacher.id) return true;
          if (Array.isArray(s.teacherAssignments) && s.teacherAssignments.some(a => a.teacherId === teacher.id)) return true;
          return calendarDates.some(cd => resolveTeacherForScheduleDate(s, cd.dateStr).teacherId === teacher.id);
        });
        
        // Subject grouping for Multi-Subject evaluation
        const subjectMap = new Map<string, {
          subjectId: string;
          subjectName: string;
          schedules: Schedule[];
          classes: Set<string>;
        }>();

        teacherSchedules.forEach(s => {
          if (!subjectMap.has(s.subjectId)) {
            subjectMap.set(s.subjectId, {
              subjectId: s.subjectId,
              subjectName: s.subjectName || "Mata Pelajaran",
              schedules: [],
              classes: new Set()
            });
          }
          const grp = subjectMap.get(s.subjectId)!;
          grp.schedules.push(s);
          if (s.className) grp.classes.add(s.className);
        });

        // -------------------------------------------------------------
        // PILAR 1: ADMINISTRASI (Multi-Subject Breakdown)
        // -------------------------------------------------------------
        const subjectsDetail: SubjectDisciplineDetail[] = [];

        // If teacher has no schedule assigned, we still check if they have created Prota/Prosem/Modul/Jurnal
        if (subjectMap.size === 0) {
          // Check for any documents authored by this teacher
          const teacherProtas = allProtas.filter(p => p.createdBy === teacher.id || p.teacherId === teacher.id);
          const teacherPromes = allPromes.filter(p => p.createdBy === teacher.id || p.teacherId === teacher.id);
          const teacherLessonPlans = allLessonPlans.filter(p => p.teacherId === teacher.id);
          const teacherJournals = inRangeJournals.filter(j => j.teacherId === teacher.id);

          const protaScore = teacherProtas.length > 0 ? 100 : 0;
          const prosemScore = teacherPromes.length > 0 ? 100 : 0;
          const modulScore = teacherLessonPlans.length > 0 ? 100 : 0;
          const jurnalScore = teacherJournals.length > 0 ? 100 : 0;

          const defaultAdminScore = Math.round(
            (protaScore * (config.protaWeight / 100)) +
            (prosemScore * (config.prosemWeight / 100)) +
            (modulScore * (config.modulWeight / 100)) +
            (jurnalScore * (config.jurnalWeight / 100))
          );

          subjectsDetail.push({
            subjectId: "GENERAL",
            subjectName: "Administrasi Umum / Tugas Mengajar",
            classNames: ["Semua Kelas"],
            weeklyJp: 0,
            periodTargetJp: 0,
            realizedJp: 0,
            prota: {
              target: 1,
              actual: teacherProtas.length > 0 ? 1 : 0,
              percentage: protaScore,
              status: protaScore === 100 ? "Lengkap" : "Belum Dibuat",
              topicCount: teacherProtas[0]?.topics?.length || 0,
              topics: teacherProtas[0]?.topics?.map(t => t.title) || []
            },
            prosem: {
              target: 1,
              actual: teacherPromes.length > 0 ? 1 : 0,
              percentage: prosemScore,
              status: prosemScore === 100 ? "Lengkap" : "Belum Dibuat",
              meetingsCount: teacherPromes[0]?.meetings?.length || 0,
              allocatedJp: teacherPromes[0]?.effectiveJpSemester || 0
            },
            modulAjar: {
              targetMeetings: 1,
              actualValid: teacherLessonPlans.filter(lp => !!lp.link).length,
              percentage: modulScore,
              items: teacherLessonPlans.map(lp => ({
                id: lp.id || "",
                title: lp.title,
                classId: lp.classId,
                className: lp.className || "Kelas",
                link: lp.link || "",
                description: lp.description,
                createdAt: lp.createdAt || "",
                status: lp.link ? "Valid" : "Perlu Tautan"
              }))
            },
            jurnalMengajar: {
              targetJp: Math.max(1, teacherJournals.length),
              actualFilledJp: teacherJournals.length,
              percentage: jurnalScore,
              items: teacherJournals.map(j => ({
                id: j.id || "",
                date: j.date,
                classId: j.classId,
                className: j.className || "Kelas",
                jp: j.totalJP || 1,
                material: j.material || "",
                status: j.status || "Diajukan",
                notes: (j as any).notes
              }))
            },
            subjectAdminScore: defaultAdminScore
          });
        } else {
          // Process each unique subject
          for (const [subId, subData] of subjectMap.entries()) {
            const subSchedules = subData.schedules;
            
            // Calculate total scheduled JP per week for this subject
            let weeklyJp = 0;
            subSchedules.forEach(s => {
              weeklyJp += parseJpCount(s.jp, s.sequence);
            });

            // Calculate target JP in the calendar date range (only when teacher was active on that date)
            let periodTargetJp = 0;
            let targetMeetings = 0;
            
            calendarDates.forEach(cd => {
              if (cd.isActiveDay) {
                const daySchedules = allSchedules.filter(s => {
                  if (s.subjectId !== subId) return false;
                  if (s.day.toLowerCase() !== cd.dayName.toLowerCase()) return false;
                  const resolved = resolveTeacherForScheduleDate(s, cd.dateStr);
                  return resolved.teacherId === teacher.id;
                });
                daySchedules.forEach(s => {
                  periodTargetJp += parseJpCount(s.jp, s.sequence);
                  targetMeetings += 1;
                });
              }
            });

            // If period target is 0, fallback to weekly JP or at least 1
            if (periodTargetJp === 0) periodTargetJp = Math.max(weeklyJp, 1);
            if (targetMeetings === 0) targetMeetings = Math.max(subSchedules.length, 1);

            // 1. PROTA: 1 per unique subject
            const matchingProtas = allProtas.filter(p => 
              (p.subjectId === subId) &&
              (p.createdBy === teacher.id || p.teacherId === teacher.id || !p.teacherId)
            );
            const protaDoc = matchingProtas[0];
            const protaValid = !!protaDoc && Array.isArray(protaDoc.topics) && protaDoc.topics.length > 0;
            const protaPercentage = protaValid ? 100 : 0;
            const protaDetail: ProtaDisciplineDetail = {
              target: 1,
              actual: protaValid ? 1 : 0,
              percentage: protaPercentage,
              status: protaValid ? "Lengkap" : (matchingProtas.length > 0 ? "Belum Lengkap" : "Belum Dibuat"),
              documentId: protaDoc?.id,
              topicCount: protaDoc?.topics?.length || 0,
              topics: protaDoc?.topics?.map(t => t.title) || [],
              effectiveJpYear: protaDoc?.effectiveJpYear,
              lastUpdated: protaDoc?.updatedAt
            };

            // 2. PROSEM: 1 per unique subject
            const matchingPromes = allPromes.filter(p => 
              (p.subjectId === subId) &&
              (p.createdBy === teacher.id || p.teacherId === teacher.id || !p.teacherId)
            );
            const promesDoc = matchingPromes[0];
            const promesValid = !!promesDoc && ((promesDoc.meetings && promesDoc.meetings.length > 0) || (promesDoc.effectiveJpSemester && promesDoc.effectiveJpSemester > 0));
            const promesPercentage = promesValid ? 100 : 0;
            const prosemDetail: ProsemDisciplineDetail = {
              target: 1,
              actual: promesValid ? 1 : 0,
              percentage: promesPercentage,
              status: promesValid ? "Lengkap" : (matchingPromes.length > 0 ? "Belum Lengkap" : "Belum Dibuat"),
              documentId: promesDoc?.id,
              meetingsCount: promesDoc?.meetings?.length || 0,
              allocatedJp: promesDoc?.effectiveJpSemester || 0,
              effectiveWeeksCount: promesDoc?.effectiveWeeksCount,
              lastUpdated: promesDoc?.updatedAt
            };

            // 3. MODUL AJAR: Real meetings in period vs valid uploaded plans
            const matchingLessonPlans = allLessonPlans.filter(lp => 
              lp.teacherId === teacher.id && 
              lp.subjectId === subId
            );
            const validLessonPlans = matchingLessonPlans.filter(lp => !!lp.link && lp.link.trim() !== "");
            const modulPercentage = Math.min(100, Math.round((validLessonPlans.length / targetMeetings) * 100));
            const modulDetail: ModulAjarDisciplineDetail = {
              targetMeetings,
              actualValid: validLessonPlans.length,
              percentage: modulPercentage,
              items: matchingLessonPlans.map(lp => ({
                id: lp.id || "",
                title: lp.title,
                classId: lp.classId,
                className: lp.className || "Kelas",
                link: lp.link || "",
                description: lp.description,
                createdAt: lp.createdAt || "",
                status: (lp.link && lp.link.trim() !== "") ? "Valid" : "Perlu Tautan"
              }))
            };

            // 4. JURNAL MENGAJAR: Real scheduled JP in period vs JP with filled journal
            const matchingJournals = inRangeJournals.filter(j => 
              j.teacherId === teacher.id && 
              j.subjectId === subId
            );
            let filledJournalJp = 0;
            matchingJournals.forEach(j => {
              if (j.status !== "Draft" && (j.status as string) !== "Belum Diisi") {
                filledJournalJp += (typeof j.totalJP === "number" ? j.totalJP : parseInt(String(j.totalJP || 1), 10));
              } else if (j.material && j.material.trim().length > 3) {
                filledJournalJp += (typeof j.totalJP === "number" ? j.totalJP : 1);
              }
            });
            const jurnalPercentage = Math.min(100, Math.round((filledJournalJp / periodTargetJp) * 100));
            const jurnalDetail: JurnalMengajarDisciplineDetail = {
              targetJp: periodTargetJp,
              actualFilledJp: filledJournalJp,
              percentage: jurnalPercentage,
              items: matchingJournals.map(j => ({
                id: j.id || "",
                date: j.date,
                classId: j.classId,
                className: j.className || "Kelas",
                jp: j.totalJP || 1,
                material: j.material || "",
                status: j.status || "Diajukan",
                notes: (j as any).notes
              }))
            };

            // Calculate Subject Admin Score
            const subjectAdminScore = Math.round(
              (protaPercentage * (config.protaWeight / 100)) +
              (promesPercentage * (config.prosemWeight / 100)) +
              (modulPercentage * (config.modulWeight / 100)) +
              (jurnalPercentage * (config.jurnalWeight / 100))
            );

            subjectsDetail.push({
              subjectId: subId,
              subjectName: subData.subjectName,
              classNames: Array.from(subData.classes),
              weeklyJp,
              periodTargetJp,
              realizedJp: filledJournalJp,
              prota: protaDetail,
              prosem: prosemDetail,
              modulAjar: modulDetail,
              jurnalMengajar: jurnalDetail,
              subjectAdminScore
            });
          }
        }

        // Multi-Subject Rule: Teacher Administration Score = simple average of all subjects taught
        const totalAdminScore = subjectsDetail.reduce((sum, s) => sum + s.subjectAdminScore, 0);
        const administrationScore = subjectsDetail.length > 0
          ? Math.round(totalAdminScore / subjectsDetail.length)
          : 100;

        // Total Scheduled JP across all subjects
        const totalJpScheduled = subjectsDetail.reduce((sum, s) => sum + s.periodTargetJp, 0);

        // -------------------------------------------------------------
        // PILAR 2: MUTABAAH (Unified Identity Resolution)
        // -------------------------------------------------------------
        const teacherAliases = new Set<string>();
        if (teacher.id) teacherAliases.add(teacher.id);
        if (teacher.teacherId) teacherAliases.add(teacher.teacherId);
        if ((teacher as any).userId) teacherAliases.add((teacher as any).userId);

        // Find linked users by teacherId, email, or exact name
        const matchingUsers = allUsers.filter(u => 
          (u.teacherId && (u.teacherId === teacher.id || u.teacherId === teacher.teacherId)) || 
          (teacher.email && u.email && u.email.toLowerCase() === teacher.email.toLowerCase()) ||
          (teacher.name && u.name && u.name.toLowerCase().trim() === teacher.name.toLowerCase().trim())
        );

        matchingUsers.forEach(u => {
          if (u.userId) teacherAliases.add(u.userId);
          if (u.id) teacherAliases.add(u.id);
        });

        const teacherNameLower = (teacher.name || "").toLowerCase().trim();

        const teacherMutabaahEntries = inRangeMutabaah.filter(m => {
          if (m.userId && teacherAliases.has(m.userId)) return true;
          if ((m as any).teacherId && teacherAliases.has((m as any).teacherId)) return true;
          if (teacherNameLower && m.userName && m.userName.toLowerCase().trim() === teacherNameLower) return true;
          return false;
        });

        const mutabaahByDate = new Map<string, typeof teacherMutabaahEntries[0]>();
        teacherMutabaahEntries.forEach(m => {
          if (m.date) mutabaahByDate.set(m.date, m);
        });

        let filledDaysCount = 0;
        let fullDaysCount = 0;
        let partialDaysCount = 0;
        let unfilledDaysCount = 0;
        let lateDaysCount = 0;
        let sumCompleteness = 0;

        const mutabaahDailyRecords = calendarDates.map(cd => {
          const entry = mutabaahByDate.get(cd.dateStr);
          let status: "Lengkap" | "Belum Lengkap" | "Belum Mengisi" | "Terlambat" = "Belum Mengisi";
          let compPercent = 0;
          let filledCount = 0;

          if (entry) {
            compPercent = typeof entry.compliancePercentage === "number" ? entry.compliancePercentage : 0;
            const values = entry.values || {};
            filledCount = Object.keys(values).filter(k => values[k] !== undefined && values[k] !== null && values[k] !== false && values[k] !== "").length;

            if (compPercent >= 99 || (activeIndicators.length > 0 && filledCount >= activeIndicators.length)) {
              status = "Lengkap";
              fullDaysCount++;
            } else if (compPercent > 0 || filledCount > 0) {
              status = "Belum Lengkap";
              partialDaysCount++;
            } else {
              status = "Belum Mengisi";
              unfilledDaysCount++;
            }
            filledDaysCount++;
            sumCompleteness += compPercent;
          } else {
            status = "Belum Mengisi";
            unfilledDaysCount++;
          }

          return {
            date: cd.dateStr,
            dayName: cd.dayName,
            status,
            compliancePercentage: compPercent,
            filledCount,
            totalIndicators: activeIndicators.length,
            userHaidStatus: entry?.userHaidStatus
          };
        });

        // Mandatory days denominator = active school days in range or calendar days
        const mandatoryMutabaahDays = Math.max(activeDatesCount, 1);
        const avgCompletenessPercentage = filledDaysCount > 0
          ? Math.round(sumCompleteness / filledDaysCount)
          : 0;
        
        // Mutabaah Score (0-100): Calculated based on active mandatory days
        const mutabaahScore = mandatoryMutabaahDays > 0
          ? Math.min(100, Math.max(0, Math.round(sumCompleteness / mandatoryMutabaahDays)))
          : (filledDaysCount > 0 ? avgCompletenessPercentage : 0);

        const mutabaahDetail: MutabaahDisciplineDetail = {
          mandatoryDays: mandatoryMutabaahDays,
          filledDays: filledDaysCount,
          fullDays: fullDaysCount,
          partialDays: partialDaysCount,
          unfilledDays: unfilledDaysCount,
          lateDays: lateDaysCount,
          avgCompletenessPercentage,
          mutabaahScore,
          dailyRecords: mutabaahDailyRecords
        };

        // -------------------------------------------------------------
        // PILAR 3: KEHADIRAN MENGAJAR & DISIPLIN
        // -------------------------------------------------------------
        // A. Filter teacher's original schedule attendances vs substituting attendances
        const teacherAttendances = inRangeAttendances.filter(a => a.teacherId === teacher.id);
        const substituteAttendances = inRangeAttendances.filter(a => 
          a.substituteTeacherId === teacher.id || 
          (a.isSubstitution && a.substituteTeacherId === teacher.id)
        );

        let jmlJp = 0; // Denominator
        let kehadiranJp = 0; // Realized JP (Hadir + Terlambat on original schedule)
        let terlambatJp = 0;
        let terlambatSessionsCount = 0;
        let totalLateMinutes = 0;
        let digantikanJp = 0;
        let menggantikanJp = 0;
        let tidakHadirJp = 0;
        let izinSakitJp = 0;
        let tugasDinasJp = 0;

        const attendanceSessions: AttendanceSessionItem[] = [];
        const terlambatSessions: TerlambatSessionItem[] = [];
        const digantikanSessions: DigantikanSessionItem[] = [];
        const menggantikanSessions: MenggantikanSessionItem[] = [];

        // 1. Process original schedule attendances
        teacherAttendances.forEach(att => {
          const jpCount = parseJpCount(att.jp, att.sequence);
          jmlJp += jpCount; // Always part of JML JP

          const status = att.status;
          let sessionLateMinutes = 0;

          // Check if replaced
          if (status === "Digantikan Guru Lain" || att.isReplaced || att.substituteTeacherId) {
            digantikanJp += jpCount;
            digantikanSessions.push({
              id: att.id || `${att.date}_${att.scheduleId}`,
              date: att.date,
              day: att.day || getIndonesianDayName(att.date),
              timeSlot: att.timeSlot || "07:30 - 08:15",
              jp: att.jp || `JP ${att.sequence}`,
              jpCount,
              className: att.className || "Kelas",
              subjectName: att.subjectName || "Mapel",
              substituteTeacherName: att.substituteTeacherName || "Guru Pengganti",
              reason: att.notes || att.replacementNote || "Delegasi Resmi Penggantian"
            });
          } else if (status === "Hadir Mengajar") {
            kehadiranJp += jpCount;
          } else if (status === "Terlambat") {
            kehadiranJp += jpCount; // Kehadiran includes Terlambat
            terlambatJp += jpCount;
            terlambatSessionsCount++;

            // Calculate late minutes if check-in time and time slot exist
            if (att.checkInTime && att.timeSlot) {
              const startSlot = att.timeSlot.split("-")[0]?.trim();
              if (startSlot) {
                const [schedH, schedM] = startSlot.split(":").map(Number);
                const [checkH, checkM] = att.checkInTime.split(":").map(Number);
                if (!isNaN(schedH) && !isNaN(checkH)) {
                  const schedMinutes = schedH * 60 + schedM;
                  const checkMinutes = checkH * 60 + checkM;
                  sessionLateMinutes = Math.max(1, checkMinutes - schedMinutes);
                }
              }
            }
            if (sessionLateMinutes === 0) sessionLateMinutes = 15; // default estimate
            totalLateMinutes += sessionLateMinutes;

            terlambatSessions.push({
              id: att.id || `${att.date}_${att.scheduleId}`,
              date: att.date,
              day: att.day || getIndonesianDayName(att.date),
              timeSlot: att.timeSlot || "07:30 - 08:15",
              jp: att.jp || `JP ${att.sequence}`,
              jpCount,
              className: att.className || "Kelas",
              subjectName: att.subjectName || "Mapel",
              checkInTime: att.checkInTime || "Terlambat",
              scheduledTime: att.timeSlot?.split("-")[0]?.trim() || "07:30",
              lateMinutes: sessionLateMinutes
            });
          } else if (status === "Tidak Hadir") {
            tidakHadirJp += jpCount;
          } else if (status === "Izin" || status === "Sakit") {
            izinSakitJp += jpCount;
          } else if (status === "Tugas Dinas") {
            tugasDinasJp += jpCount;
            kehadiranJp += jpCount; // Tugas Dinas counts as official presence
          }

          attendanceSessions.push({
            id: att.id || `${att.date}_${att.scheduleId}`,
            date: att.date,
            day: att.day || getIndonesianDayName(att.date),
            scheduleId: att.scheduleId,
            timeSlot: att.timeSlot || "07:30 - 08:15",
            jp: att.jp || `JP ${att.sequence}`,
            jpCount,
            classId: att.classId,
            className: att.className || "Kelas",
            subjectId: att.subjectId,
            subjectName: att.subjectName || "Mapel",
            status: att.status,
            checkInTime: att.checkInTime,
            checkOutTime: att.checkOutTime || att.manualCheckOutTime,
            lateMinutes: sessionLateMinutes,
            substituteTeacherName: att.substituteTeacherName,
            originalTeacherName: att.originalTeacherName,
            isSubstitution: false,
            isReplaced: !!(status === "Digantikan Guru Lain" || att.isReplaced || att.substituteTeacherId),
            notes: att.notes
          });
        });

        // 2. Process substitute attendances (Menggantikan Guru Lain)
        substituteAttendances.forEach(subAtt => {
          // Verify it's not teacher's own schedule
          if (subAtt.teacherId !== teacher.id) {
            const jpCount = parseJpCount(subAtt.jp, subAtt.sequence);
            menggantikanJp += jpCount;

            menggantikanSessions.push({
              id: subAtt.id || `sub_${subAtt.date}_${subAtt.scheduleId}`,
              date: subAtt.date,
              day: subAtt.day || getIndonesianDayName(subAtt.date),
              timeSlot: subAtt.timeSlot || "07:30 - 08:15",
              jp: subAtt.jp || `JP ${subAtt.sequence}`,
              jpCount,
              className: subAtt.className || "Kelas",
              subjectName: subAtt.subjectName || "Mapel",
              replacedTeacherName: subAtt.teacherName || subAtt.originalTeacherName || "Guru Asli",
              checkInTime: subAtt.checkInTime,
              notes: subAtt.notes || subAtt.replacementNote
            });
          }
        });

        // If JML JP is 0 (no attendance recorded yet), calculate expected JP from schedule
        if (jmlJp === 0) {
          jmlJp = totalJpScheduled > 0 ? totalJpScheduled : 1;
          kehadiranJp = jmlJp; // Default perfect until attendance logged
        }

        // Attendance Calculations
        const kehadiranDasarPercentage = Math.min(100, Math.round((kehadiranJp / jmlJp) * 1000) / 10);
        const rasioKeterlambatan = jmlJp > 0 ? (terlambatJp / jmlJp) : 0;
        const penaltiKeterlambatan = Math.round(rasioKeterlambatan * config.latePenaltyFactor * 1000) / 10;
        const rawAttendanceDiscipline = kehadiranDasarPercentage - penaltiKeterlambatan;
        const nilaiKehadiranDisiplin = Math.max(0, Math.min(100, Math.round(rawAttendanceDiscipline * 10) / 10));

        const avgLateMinutes = terlambatSessionsCount > 0 ? Math.round(totalLateMinutes / terlambatSessionsCount) : 0;

        const attendanceDetail: AttendanceDisciplineDetail = {
          jmlJp,
          kehadiranJp,
          terlambatJp,
          terlambatSessionsCount,
          totalLateMinutes,
          avgLateMinutes,
          menggantikanJp,
          digantikanJp,
          tidakHadirJp,
          izinSakitJp,
          tugasDinasJp,
          kehadiranDasarPercentage,
          rasioKeterlambatan: Math.round(rasioKeterlambatan * 1000) / 10,
          penaltiKeterlambatan,
          nilaiKehadiranDisiplin,
          attendanceSessions,
          menggantikanSessions,
          digantikanSessions,
          terlambatSessions
        };

        // -------------------------------------------------------------
        // FINAL DISCIPLINE SCORE (3 PILARS)
        // -------------------------------------------------------------
        const adminContribution = Math.round(administrationScore * (config.adminWeight / 100) * 10) / 10;
        const mutabaahContribution = Math.round(mutabaahScore * (config.mutabaahWeight / 100) * 10) / 10;
        const attendanceContribution = Math.round(nilaiKehadiranDisiplin * (config.attendanceWeight / 100) * 10) / 10;

        const finalDisciplineScore = Math.min(100, Math.max(0,
          Math.round((adminContribution + mutabaahContribution + attendanceContribution) * 10) / 10
        ));

        const category = getDisciplineCategory(finalDisciplineScore);

        // Historical Trend
        const teacherPast = pastHistories
          .filter(h => h.teacherId === teacher.id)
          .sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));

        const previousScore = teacherPast.length > 0 ? teacherPast[0].finalDisciplineScore : undefined;
        let trendStatus: "Meningkat" | "Stabil" | "Menurun" = "Stabil";
        if (previousScore !== undefined) {
          if (finalDisciplineScore - previousScore >= 2) trendStatus = "Meningkat";
          else if (previousScore - finalDisciplineScore >= 2) trendStatus = "Menurun";
        }

        // Audit Trail Formulas
        const auditTrail = {
          adminFormula: `Rata-rata ${subjectsDetail.length} Mapel = (${subjectsDetail.map(s => `${s.subjectName}: ${s.subjectAdminScore}%`).join(" + ")}) / ${subjectsDetail.length} = ${administrationScore}%`,
          adminContribution,
          mutabaahFormula: `Skor Kelengkapan (${avgCompletenessPercentage}%) pada ${mandatoryMutabaahDays} Hari Wajib = ${mutabaahScore}%`,
          mutabaahContribution,
          attendanceFormula: `Kehadiran Dasar (${kehadiranJp}/${jmlJp} JP × 100 = ${kehadiranDasarPercentage}%) - Penalti Terlambat (${terlambatJp}/${jmlJp} JP × ${Math.round(config.latePenaltyFactor * 100)}% = ${penaltiKeterlambatan}%) = ${nilaiKehadiranDisiplin}%`,
          attendanceContribution,
          penaltyFormula: `Rasio Terlambat (${terlambatJp}/${jmlJp} = ${(rasioKeterlambatan * 100).toFixed(1)}%) × Faktor Penalti (${Math.round(config.latePenaltyFactor * 100)}%) = ${penaltiKeterlambatan}%`,
          finalFormula: `(${administrationScore}% × ${config.adminWeight}%) + (${mutabaahScore}% × ${config.mutabaahWeight}%) + (${nilaiKehadiranDisiplin}% × ${config.attendanceWeight}%) = ${finalDisciplineScore}%`
        };

        metrics.push({
          teacherId: teacher.id,
          teacherName: teacher.name,
          niy: teacher.niy || teacher.nuptk || "-",
          gender: teacher.gender,
          role: (teacher as any).role || "Guru",
          subjects: subjectsDetail,
          totalJpScheduled,
          administrationScore,
          mutabaah: mutabaahDetail,
          mutabaahScore,
          attendance: attendanceDetail,
          attendanceScore: nilaiKehadiranDisiplin,
          finalDisciplineScore,
          category,
          disciplineScore: finalDisciplineScore,
          attendancePercentage: kehadiranDasarPercentage,
          checkInOnTimePercentage: Math.max(0, Math.round((100 - (rasioKeterlambatan || 0) * 100) * 10) / 10),
          checkOutOnTimePercentage: 100,
          previousScore,
          trendStatus,
          auditTrail
        });
      }

      // Sort by final score descending
      metrics.sort((a, b) => b.finalDisciplineScore - a.finalDisciplineScore);

      // 5. School Discipline Summary
      let sangatDisiplinCount = 0;
      let disiplinCount = 0;
      let cukupDisiplinCount = 0;
      let perluPembinaanCount = 0;
      let pembinaanKhususCount = 0;
      let sumFinal = 0;
      let sumAdmin = 0;
      let sumMutabaah = 0;
      let sumAttendance = 0;
      let totalScheduledJp = 0;
      let totalKehadiranJp = 0;
      let totalTerlambatJp = 0;
      let totalMenggantikanJp = 0;
      let totalDigantikanJp = 0;
      let totalLateIncidents = 0;
      let sumProta = 0;
      let sumProsem = 0;
      let sumModul = 0;
      let sumJurnal = 0;
      let totalSubjectCount = 0;

      metrics.forEach(m => {
        sumFinal += m.finalDisciplineScore;
        sumAdmin += m.administrationScore;
        sumMutabaah += m.mutabaahScore;
        sumAttendance += m.attendanceScore;

        totalScheduledJp += m.attendance.jmlJp;
        totalKehadiranJp += m.attendance.kehadiranJp;
        totalTerlambatJp += m.attendance.terlambatJp;
        totalMenggantikanJp += m.attendance.menggantikanJp;
        totalDigantikanJp += m.attendance.digantikanJp;
        totalLateIncidents += m.attendance.terlambatSessionsCount;

        m.subjects.forEach(s => {
          sumProta += s.prota.percentage;
          sumProsem += s.prosem.percentage;
          sumModul += s.modulAjar.percentage;
          sumJurnal += s.jurnalMengajar.percentage;
          totalSubjectCount++;
        });

        if (m.category === "Sangat Disiplin") sangatDisiplinCount++;
        else if (m.category === "Disiplin") disiplinCount++;
        else if (m.category === "Cukup Disiplin") cukupDisiplinCount++;
        else if (m.category === "Perlu Pembinaan") perluPembinaanCount++;
        else if (m.category === "Pembinaan Khusus") pembinaanKhususCount++;
      });

      const totalTeachers = metrics.length;
      const avgSchoolDisciplineScore = totalTeachers > 0 ? Math.round((sumFinal / totalTeachers) * 10) / 10 : 100;
      const avgAdministrationScore = totalTeachers > 0 ? Math.round((sumAdmin / totalTeachers) * 10) / 10 : 100;
      const avgMutabaahScore = totalTeachers > 0 ? Math.round((sumMutabaah / totalTeachers) * 10) / 10 : 100;
      const avgAttendanceDisciplineScore = totalTeachers > 0 ? Math.round((sumAttendance / totalTeachers) * 10) / 10 : 100;

      const summary: SchoolDisciplineSummary = {
        totalTeachers,
        avgSchoolDisciplineScore,
        avgAdministrationScore,
        avgMutabaahScore,
        avgAttendanceDisciplineScore,
        sangatDisiplinCount,
        disiplinCount,
        cukupDisiplinCount,
        perluPembinaanCount,
        pembinaanKhususCount,
        totalScheduledJp,
        totalKehadiranJp,
        totalTerlambatJp,
        totalMenggantikanJp,
        totalDigantikanJp,
        totalLateIncidents,
        avgProtaScore: totalSubjectCount > 0 ? Math.round(sumProta / totalSubjectCount) : 100,
        avgProsemScore: totalSubjectCount > 0 ? Math.round(sumProsem / totalSubjectCount) : 100,
        avgModulScore: totalSubjectCount > 0 ? Math.round(sumModul / totalSubjectCount) : 100,
        avgJurnalScore: totalSubjectCount > 0 ? Math.round(sumJurnal / totalSubjectCount) : 100
      };

      // 6. System Discipline Recommendations
      const recommendations: SystemDisciplineRecommendation[] = [];

      metrics.forEach(m => {
        if (m.trendStatus === "Meningkat" && m.finalDisciplineScore >= 90) {
          recommendations.push({
            id: `rec_inc_${m.teacherId}`,
            type: "success",
            title: "Peningkatan Kedisiplinan Positif",
            message: `${m.teacherName} mencatatkan kenaikan skor kedisiplinan ke ${m.finalDisciplineScore}% (${m.category}) pada periode evaluasi ini.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.attendance.terlambatSessionsCount >= 3) {
          recommendations.push({
            id: `rec_late_${m.teacherId}`,
            type: "warning",
            title: "Tingkat Keterlambatan Perlu Perhatian",
            message: `${m.teacherName} tercatat terlambat sebanyak ${m.attendance.terlambatSessionsCount} sesi (${m.attendance.terlambatJp} JP, penalti -${m.attendance.penaltiKeterlambatan}%).`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.administrationScore < 70) {
          recommendations.push({
            id: `rec_adm_${m.teacherId}`,
            type: "warning",
            title: "Kelengkapan Administrasi Belum Optimal",
            message: `${m.teacherName} memiliki skor Administrasi ${m.administrationScore}%. Perlu pendampingan untuk kelengkapan Prota/Prosem/Modul/Jurnal.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.category === "Pembinaan Khusus" || m.category === "Perlu Pembinaan") {
          recommendations.push({
            id: `rec_pemb_${m.teacherId}`,
            type: "danger",
            title: "Rekomendasi Pembinaan Kedisiplinan",
            message: `${m.teacherName} masuk dalam kategori ${m.category} (Skor: ${m.finalDisciplineScore}%). Direkomendasikan untuk sesi pembinaan oleh Waka Kurikulum & Kepala Sekolah.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.finalDisciplineScore >= 98 && m.attendance.jmlJp >= 10) {
          recommendations.push({
            id: `rec_star_${m.teacherId}`,
            type: "success",
            title: "Kandidat GTK Teladan Kedisiplinan",
            message: `${m.teacherName} meraih skor luar biasa ${m.finalDisciplineScore}% dengan pemenuhan 3 pilar disiplin yang sempurna.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }
      });

      if (recommendations.length === 0) {
        recommendations.push({
          id: "rec_default",
          type: "info",
          title: "Kedisiplinan Sekolah Berjalan Baik",
          message: `Rata-rata kedisiplinan guru berada di kategori ${getDisciplineCategory(avgSchoolDisciplineScore)} (${avgSchoolDisciplineScore}%).`
        });
      }

      return { metrics, summary, recommendations, config };
    } catch (error) {
      console.error("Error calculating comprehensive discipline metrics:", error);
      return {
        metrics: [],
        summary: {
          totalTeachers: 0,
          avgSchoolDisciplineScore: 100,
          avgAdministrationScore: 100,
          avgMutabaahScore: 100,
          avgAttendanceDisciplineScore: 100,
          sangatDisiplinCount: 0,
          disiplinCount: 0,
          cukupDisiplinCount: 0,
          perluPembinaanCount: 0,
          pembinaanKhususCount: 0,
          totalScheduledJp: 0,
          totalKehadiranJp: 0,
          totalTerlambatJp: 0,
          totalMenggantikanJp: 0,
          totalDigantikanJp: 0,
          totalLateIncidents: 0,
          avgProtaScore: 100,
          avgProsemScore: 100,
          avgModulScore: 100,
          avgJurnalScore: 100
        },
        recommendations: [],
        config: DEFAULT_DISCIPLINE_CONFIG
      };
    }
  },

  /**
   * Save permanent historical snapshot of discipline
   */
  async saveDisciplineSnapshot(snapshotData: Omit<DisciplineHistoryRecord, "id" | "createdAt">): Promise<void> {
    try {
      const colRef = collection(db, DISCIPLINE_HISTORY_COLLECTION);
      const customId = `${snapshotData.teacherId}_${snapshotData.academicYearId}_${snapshotData.semesterId}_${snapshotData.startDate}_${snapshotData.endDate}`;
      const docRef = doc(colRef, customId);
      await setDoc(docRef, {
        ...snapshotData,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, DISCIPLINE_HISTORY_COLLECTION);
    }
  },

  /**
   * Get all past discipline history records
   */
  async getDisciplineHistories(academicYearId?: string, semesterId?: string): Promise<DisciplineHistoryRecord[]> {
    try {
      const colRef = collection(db, DISCIPLINE_HISTORY_COLLECTION);
      let q = query(colRef);
      if (academicYearId) {
        q = query(colRef, where("academicYearId", "==", academicYearId));
      }
      const snap = await getDocs(q);
      const list: DisciplineHistoryRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (!semesterId || data.semesterId === semesterId) {
          list.push({ id: d.id, ...data } as DisciplineHistoryRecord);
        }
      });
      return list;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, DISCIPLINE_HISTORY_COLLECTION);
    }
  }
};
