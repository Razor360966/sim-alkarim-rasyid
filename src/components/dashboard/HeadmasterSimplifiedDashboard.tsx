import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { teacherService } from "../../services/teacherService";
import { studentService } from "../../services/studentService";
import { classService } from "../../services/classService";
import { academicPlanningService } from "../../services/academicPlanning.service";
import { executiveMutabaahService } from "../../services/executiveMutabaahService";
import { supervisionService } from "../../services/supervision.service";
import { academicYearService } from "../../services/academicYearService";
import { semesterService } from "../../services/semester.service";
import { teacherTeachingAttendanceService, getLessonPeriodTimeRange } from "../../services/teacherTeachingAttendance.service";
import { lessonPeriodService } from "../../services/lessonPeriod.service";
import { scheduleService } from "../../services/schedule.service";
import { curriculumPlanningService } from "../../services/curriculumPlanning.service";
import { lessonPlanService } from "../../services/lessonPlan.service";
import { teachingJournalService } from "../../services/teachingJournalService";
import { getCanonicalActiveTeachers } from "../../utils/teacherFilterHelper";
import { TeacherTeachingAttendance, AnnualProgram, SemesterProgram, LessonPlan, TeachingJournal } from "../../types";
import { Dialog } from "../Dialog";
import { Loading } from "../Loading";
import {
  Users,
  GraduationCap,
  School,
  CheckCircle2,
  FileCheck2,
  Clock,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  Search,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Eye,
  ArrowRight,
  BookOpen,
  Filter,
  Calendar,
  UserCheck,
  UserX,
  Repeat
} from "lucide-react";

export type PeriodPreset = "today" | "yesterday" | "7days" | "this_month" | "last_month" | "semester" | "custom";

export const HeadmasterSimplifiedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // 1. Current Date Strings
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

  // 2. Active Year & Semester queries
  const { data: activeYear } = useQuery({
    queryKey: ["activeAcademicYear"],
    queryFn: () => academicYearService.getActiveAcademicYear()
  });

  const { data: activeSemester } = useQuery({
    queryKey: ["activeSemester"],
    queryFn: () => semesterService.getActiveSemester()
  });

  const ayId = activeYear?.id || "";
  const semId = activeSemester?.id || "";

  // 3. Global Period Filter State
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("today");
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Resolved Period Range
  const resolvedDateRange = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = d.getMonth();

    if (periodPreset === "today") {
      return {
        startDate: todayStr,
        endDate: todayStr,
        label: `Hari Ini (${todayStr})`,
        isSingleDate: true
      };
    }
    if (periodPreset === "yesterday") {
      return {
        startDate: yesterdayStr,
        endDate: yesterdayStr,
        label: `Kemarin (${yesterdayStr})`,
        isSingleDate: true
      };
    }
    if (periodPreset === "7days") {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      const start = `${d7.getFullYear()}-${String(d7.getMonth() + 1).padStart(2, "0")}-${String(d7.getDate()).padStart(2, "0")}`;
      return {
        startDate: start,
        endDate: todayStr,
        label: `7 Hari Terakhir (${start} s/d ${todayStr})`,
        isSingleDate: false
      };
    }
    if (periodPreset === "this_month") {
      const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
      return {
        startDate: start,
        endDate: todayStr,
        label: `Bulan Ini (${start} s/d ${todayStr})`,
        isSingleDate: false
      };
    }
    if (periodPreset === "last_month") {
      const prevMonthLastDate = new Date(y, m, 0);
      const prevMonthYear = prevMonthLastDate.getFullYear();
      const prevMonthNum = prevMonthLastDate.getMonth() + 1;
      const start = `${prevMonthYear}-${String(prevMonthNum).padStart(2, "0")}-01`;
      const end = `${prevMonthYear}-${String(prevMonthNum).padStart(2, "0")}-${String(prevMonthLastDate.getDate()).padStart(2, "0")}`;
      return {
        startDate: start,
        endDate: end,
        label: `Bulan Lalu (${start} s/d ${end})`,
        isSingleDate: false
      };
    }
    if (periodPreset === "semester") {
      const start = activeSemester?.startDate || `${y}-07-01`;
      const end = activeSemester?.endDate || `${y}-12-31`;
      return {
        startDate: start,
        endDate: end,
        label: `${activeSemester?.name || "Semester Aktif"} (${start} s/d ${end})`,
        isSingleDate: false
      };
    }
    // Custom
    const start = customStartDate || todayStr;
    const end = customEndDate || todayStr;
    const isSingle = start === end;
    return {
      startDate: start,
      endDate: end,
      label: isSingle ? `Tanggal: ${start}` : `Periode: ${start} s/d ${end}`,
      isSingleDate: isSingle
    };
  }, [periodPreset, todayStr, yesterdayStr, customStartDate, customEndDate, activeSemester]);

  // 4. Master Data Queries
  const { data: teachers = [], isLoading: isTeachersLoading, refetch: refetchTeachers } = useQuery({
    queryKey: ["teachersListDashboard"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: students = [], isLoading: isStudentsLoading, refetch: refetchStudents } = useQuery({
    queryKey: ["studentsListDashboard"],
    queryFn: () => studentService.getStudents()
  });

  const { data: classes = [], isLoading: isClassesLoading, refetch: refetchClasses } = useQuery({
    queryKey: ["classesListDashboard"],
    queryFn: () => classService.getClasses()
  });

  const { data: schedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ["schedulesDashboard", ayId, semId],
    queryFn: () => scheduleService.getSchedules(ayId, semId)
  });

  // Kaldik / Calendar Days Query
  const { data: calendarDays = [], refetch: refetchKaldik } = useQuery({
    queryKey: ["academicCalendarDaysDashboard", ayId, semId],
    queryFn: () => academicPlanningService.getCalendarDays(ayId, semId)
  });

  // Master Lesson Periods Query (for dynamic time slots and accurate session completion evaluation)
  const { data: lessonPeriods = [], refetch: refetchLessonPeriods } = useQuery({
    queryKey: ["lessonPeriodsDashboard"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  // Current real-time clock ticker (auto updates every 30 seconds for live session status evaluation)
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = useMemo(() => {
    return currentTime.getHours() * 60 + currentTime.getMinutes();
  }, [currentTime]);

  // 5. ATTENDANCE SSOT QUERY (Following Active Period)
  const { data: attendanceData, isLoading: isAttendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: [
      "headmasterTeachingAttendance",
      resolvedDateRange.startDate,
      resolvedDateRange.endDate,
      resolvedDateRange.isSingleDate,
      ayId,
      semId
    ],
    queryFn: async () => {
      if (resolvedDateRange.isSingleDate) {
        const res = await teacherTeachingAttendanceService.getAttendanceForDate(
          resolvedDateRange.startDate,
          ayId,
          semId
        );
        return {
          sessions: res.items || [],
          isKbmDisabled: res.isKbmDisabled,
          lockReason: res.lockReason
        };
      } else {
        const res = await teacherTeachingAttendanceService.getAttendanceRecap({
          academicYearId: ayId,
          semesterId: semId,
          startDate: resolvedDateRange.startDate,
          endDate: resolvedDateRange.endDate
        });
        return {
          sessions: res.rawRecords || [],
          isKbmDisabled: false,
          lockReason: undefined
        };
      }
    }
  });

  const attendanceSessions = useMemo<TeacherTeachingAttendance[]>(() => {
    return attendanceData?.sessions || [];
  }, [attendanceData]);

  // 6. ADMINISTRATION SSOT QUERIES (Prota, Prosem, Modul Ajar, Jurnal)
  const { data: protaList = [], refetch: refetchProta } = useQuery({
    queryKey: ["headmasterAllProta", ayId],
    queryFn: () => curriculumPlanningService.getAllAnnualPrograms()
  });

  const { data: prosemList = [], refetch: refetchProsem } = useQuery({
    queryKey: ["headmasterAllProsem", ayId, semId],
    queryFn: () => curriculumPlanningService.getAllSemesterPrograms()
  });

  const { data: modulList = [], refetch: refetchModul } = useQuery({
    queryKey: ["headmasterAllModul", ayId, semId],
    queryFn: () => lessonPlanService.getLessonPlans({ academicYearId: ayId, semesterId: semId })
  });

  const { data: journalsList = [], refetch: refetchJournals } = useQuery({
    queryKey: ["headmasterAllJournals", ayId, semId, resolvedDateRange.startDate, resolvedDateRange.endDate],
    queryFn: () => teachingJournalService.getAll(ayId, semId)
  });

  // 7. MUTABAAH SSOT QUERY (Following Active Period)
  const { data: mutabaahData, isLoading: isMutabaahLoading, refetch: refetchMutabaah } = useQuery({
    queryKey: [
      "headmasterMutabaahReport",
      ayId,
      semId,
      resolvedDateRange.startDate,
      resolvedDateRange.endDate
    ],
    queryFn: () =>
      executiveMutabaahService.getExecutiveReport({
        academicYearId: ayId,
        semesterId: semId,
        startDate: resolvedDateRange.startDate,
        endDate: resolvedDateRange.endDate
      })
  });

  // 8. Supervision Query
  const { data: supervisions = [], refetch: refetchSupervision } = useQuery({
    queryKey: ["supervisionsDashboard", ayId, semId],
    queryFn: () =>
      supervisionService.getAcademicSupervisions({
        academicYearId: ayId,
        semesterId: semId
      })
  });

  // Canonical Active Teachers
  const activeTeachers = useMemo(() => {
    return getCanonicalActiveTeachers(teachers);
  }, [teachers]);

  const activeStudents = useMemo(() => {
    return students.filter(s => s.status === "Aktif" || !s.status);
  }, [students]);

  const activeClasses = useMemo(() => {
    return classes.filter(c => !c.isDeleted);
  }, [classes]);

  // Method helper to resolve check-in method label
  const getCheckInMethod = (session: TeacherTeachingAttendance): string => {
    if (session.status === "Digantikan Guru Lain" || session.isReplaced) {
      return session.substituteTeacherName ? `Digantikan (${session.substituteTeacherName})` : "Digantikan";
    }
    if (!session.checkInTime) {
      if (session.status === "KBM Ditiadakan") return "KBM Ditiadakan";
      if (["Izin", "Sakit", "Tugas Dinas"].includes(session.status)) return session.status;
      return "—";
    }
    const t = session.checkInType;
    if (t === "Manual Wakakur" || t === "Manual Admin") {
      return "Check-in Dibantu";
    }
    if (
      session.notes?.toLowerCase().includes("dibantu") ||
      (session as any).method?.toLowerCase().includes("dibantu")
    ) {
      return "Check-in Dibantu";
    }
    if (t === "Scan QR" || !t) {
      return "QR Mandiri";
    }
    if (t === "Auto") {
      return "Otomatis";
    }
    return t;
  };

  /**
   * Helper to determine if an attendance session should be counted as "Tidak Hadir" in agregasi.
   *
   * Sesuai aturan SIMAK:
   * 1. Status ketidakhadiran eksplisit ("Tidak Hadir", "Izin", "Sakit", "Tugas Dinas") SELALU dihitung Tidak Hadir.
   * 2. Status "Belum Diverifikasi" / "Belum Terkonfirmasi":
   *    - Untuk tanggal lampau (sessionDate < todayStr): DIHITUNG sebagai Tidak Hadir (perilaku histori preserved).
   *    - Untuk tanggal mendatang (sessionDate > todayStr): TIDAK dihitung sebagai Tidak Hadir.
   *    - Untuk hari ini (sessionDate === todayStr):
   *      * Jika sesi belum selesai (currentMinutes < endM): TIDAK dihitung sebagai Tidak Hadir.
   *      * Jika sesi sudah selesai (currentMinutes >= endM): DIHITUNG sebagai Tidak Hadir.
   */
  const isSessionTidakHadir = (
    session: TeacherTeachingAttendance,
    todayDateStr: string,
    currMinutes: number,
    lessonPeriodsList: Array<{ id?: string; sequence?: number; startTime?: string; endTime?: string }>
  ): boolean => {
    const st = session.status;

    // 1. Ketidakhadiran eksplisit selalu dihitung Tidak Hadir
    if (["Tidak Hadir", "Izin", "Sakit", "Tugas Dinas"].includes(st)) {
      return true;
    }

    // 2. Status Belum Diverifikasi / Belum Terkonfirmasi
    if (st === "Belum Diverifikasi" || st === "Belum Terkonfirmasi") {
      const sessionDate = session.date || todayDateStr;

      // Tanggal lampau: sesi sudah lewat di hari sebelumnya, tetap dihitung Tidak Hadir
      if (sessionDate < todayDateStr) {
        return true;
      }

      // Tanggal mendatang: belum berlangsung, tidak dihitung Tidak Hadir
      if (sessionDate > todayDateStr) {
        return false;
      }

      // Tanggal hari ini: evaluasi apakah jam sesi sudah selesai
      const timeRange = getLessonPeriodTimeRange({
        timeSlot: session.timeSlot,
        sequence: session.sequence,
        lessonPeriodId: session.lessonPeriodId,
        lessonPeriods: lessonPeriodsList
      });

      // Sesi hanya dihitung Tidak Hadir jika waktu sekarang sudah melewati jam selesai sesi (currMinutes >= timeRange.endM)
      return currMinutes >= timeRange.endM;
    }

    return false;
  };

  // =========================================================================
  // SECTION 1: RINGKASAN KEHADIRAN STATS (ALL 6 STATS CLICKABLE)
  // =========================================================================
  const kbmSummary = useMemo(() => {
    const totalSessions = attendanceSessions.length;
    const scheduledTeacherIds = new Set(attendanceSessions.map(s => s.teacherId).filter(Boolean));
    const totalTeachersScheduled = scheduledTeacherIds.size;

    let hadirCount = 0;
    let tepatWaktuCount = 0;
    let terlambatCount = 0;
    let tidakHadirCount = 0;
    let digantikanCount = 0;

    attendanceSessions.forEach(s => {
      const st = s.status;
      if (st === "Hadir Mengajar") {
        hadirCount++;
        tepatWaktuCount++;
      } else if (st === "Terlambat") {
        hadirCount++;
        terlambatCount++;
      } else if (st === "Digantikan Guru Lain" || st === "Tukar Jadwal" || s.isReplaced) {
        digantikanCount++;
      } else if (isSessionTidakHadir(s, todayStr, currentMinutes, lessonPeriods)) {
        tidakHadirCount++;
      }
    });

    return {
      totalTeachersScheduled,
      totalSessions,
      hadirCount,
      tepatWaktuCount,
      terlambatCount,
      tidakHadirCount,
      digantikanCount
    };
  }, [attendanceSessions, todayStr, currentMinutes, lessonPeriods]);

  // =========================================================================
  // SECTION 2: REKAP GURU KEHADIRAN (TABLE WITH SAFE ZERO-DIVISION)
  // =========================================================================
  const teacherAttendanceRecap = useMemo(() => {
    return activeTeachers.map(t => {
      const teacherSessions = attendanceSessions.filter(s => s.teacherId === t.id);
      const bebanSesi = teacherSessions.length;
      let hadir = 0;
      let tepatWaktu = 0;
      let terlambat = 0;
      let tidakHadir = 0;
      let digantikan = 0;

      teacherSessions.forEach(s => {
        const st = s.status;
        if (st === "Hadir Mengajar") {
          hadir++;
          tepatWaktu++;
        } else if (st === "Terlambat") {
          hadir++;
          terlambat++;
        } else if (st === "Digantikan Guru Lain" || st === "Tukar Jadwal" || s.isReplaced) {
          digantikan++;
        } else if (isSessionTidakHadir(s, todayStr, currentMinutes, lessonPeriods)) {
          tidakHadir++;
        }
      });

      // Strict Zero-Division Rule: 0 beban sesi = "—" (NOT 100%)
      const tingkatHadirText = bebanSesi > 0 ? `${Math.round((hadir / bebanSesi) * 100)}%` : "—";
      const tingkatHadirValue = bebanSesi > 0 ? Math.round((hadir / bebanSesi) * 100) : null;

      return {
        teacher: t,
        bebanSesi,
        hadir,
        tepatWaktu,
        terlambat,
        tidakHadir,
        digantikan,
        tingkatHadirText,
        tingkatHadirValue,
        sessions: teacherSessions
      };
    });
  }, [activeTeachers, attendanceSessions, todayStr, currentMinutes, lessonPeriods]);

  // =========================================================================
  // SECTION 3: REKAP ADMINISTRASI GURU (PROTA, PROSEM, MODUL, JURNAL)
  // =========================================================================
  const teacherAdminRecap = useMemo(() => {
    return activeTeachers.map(t => {
      // Find teaching obligations from schedules
      const teacherSchedules = schedules.filter(s => s.teacherId === t.id);
      const uniquePairKeys = new Set(
        teacherSchedules.filter(s => s.classId && s.subjectId).map(s => `${s.classId}_${s.subjectId}`)
      );
      const targetObligationCount = uniquePairKeys.size;

      // Filter Prota for this teacher
      const teacherProta = protaList.filter(p => p.teacherId === t.id && (!ayId || p.academicYearId === ayId));
      // Filter Prosem for this teacher
      const teacherProsem = prosemList.filter(
        p => p.teacherId === t.id && (!ayId || p.academicYearId === ayId) && (!semId || p.semesterId === semId)
      );
      // Filter Modul Ajar for this teacher
      const teacherModul = modulList.filter(
        m => m.teacherId === t.id && (!ayId || m.academicYearId === ayId) && (!semId || m.semesterId === semId)
      );
      // Filter Journals for this teacher within active period
      const teacherJournals = journalsList.filter(j => {
        const matchTeacher = j.teacherId === t.id;
        const matchAy = !ayId || j.academicYearId === ayId;
        const matchSem = !semId || j.semesterId === semId;
        const matchStart = !resolvedDateRange.startDate || (j.date && j.date >= resolvedDateRange.startDate);
        const matchEnd = !resolvedDateRange.endDate || (j.date && j.date <= resolvedDateRange.endDate);
        return matchTeacher && matchAy && matchSem && matchStart && matchEnd;
      });

      // Status evaluations
      let protaText = "Belum";
      let protaStatusColor = "rose";
      if (targetObligationCount === 0) {
        protaText = teacherProta.length > 0 ? "Lengkap" : "—";
        protaStatusColor = teacherProta.length > 0 ? "emerald" : "slate";
      } else if (teacherProta.length >= targetObligationCount) {
        protaText = "Lengkap";
        protaStatusColor = "emerald";
      } else if (teacherProta.length > 0) {
        protaText = `${teacherProta.length}/${targetObligationCount}`;
        protaStatusColor = "amber";
      }

      let prosemText = "Belum";
      let prosemStatusColor = "rose";
      if (targetObligationCount === 0) {
        prosemText = teacherProsem.length > 0 ? "Lengkap" : "—";
        prosemStatusColor = teacherProsem.length > 0 ? "emerald" : "slate";
      } else if (teacherProsem.length >= targetObligationCount) {
        prosemText = "Lengkap";
        prosemStatusColor = "emerald";
      } else if (teacherProsem.length > 0) {
        prosemText = `${teacherProsem.length}/${targetObligationCount}`;
        prosemStatusColor = "amber";
      }

      let modulText = "Belum";
      let modulStatusColor = "rose";
      if (targetObligationCount === 0) {
        modulText = teacherModul.length > 0 ? `${teacherModul.length} Modul` : "—";
        modulStatusColor = teacherModul.length > 0 ? "blue" : "slate";
      } else if (teacherModul.length > 0) {
        modulText = `${teacherModul.length} Modul`;
        modulStatusColor = "blue";
      }

      // Teaching sessions load in active period for comparison
      const teacherSessions = attendanceSessions.filter(s => s.teacherId === t.id);
      const bebanSesi = teacherSessions.length;
      let jurnalText = "—";
      if (bebanSesi > 0) {
        jurnalText = `${teacherJournals.length} / ${bebanSesi} Sesi`;
      } else if (teacherJournals.length > 0) {
        jurnalText = `${teacherJournals.length} Terisi`;
      }

      // Summary Status
      let overallStatus = "Belum Lengkap";
      let overallColor = "rose";
      if (targetObligationCount === 0 && bebanSesi === 0) {
        overallStatus = "Tidak Ada Beban";
        overallColor = "slate";
      } else if (
        (targetObligationCount === 0 || teacherProta.length >= targetObligationCount) &&
        (targetObligationCount === 0 || teacherProsem.length >= targetObligationCount) &&
        teacherModul.length > 0 &&
        (bebanSesi === 0 || teacherJournals.length >= bebanSesi)
      ) {
        overallStatus = "Lengkap";
        overallColor = "emerald";
      } else if (teacherProta.length > 0 || teacherProsem.length > 0 || teacherJournals.length > 0) {
        overallStatus = "Proses";
        overallColor = "amber";
      }

      return {
        teacher: t,
        targetObligationCount,
        protaText,
        protaStatusColor,
        protaList: teacherProta,
        prosemText,
        prosemStatusColor,
        prosemList: teacherProsem,
        modulText,
        modulStatusColor,
        modulList: teacherModul,
        jurnalText,
        journals: teacherJournals,
        overallStatus,
        overallColor
      };
    });
  }, [activeTeachers, schedules, protaList, prosemList, modulList, journalsList, ayId, semId, resolvedDateRange, attendanceSessions]);

  // =========================================================================
  // SECTION 4: REKAP MUTABAAH GURU (TARGET, TERISI, BELUM, PERSENTASE)
  // =========================================================================
  const teacherMutabaahRecap = useMemo(() => {
    const records = mutabaahData?.records || [];
    return activeTeachers.map(t => {
      const tRecords = records.filter(
        r =>
          r.userId === t.id ||
          (r.teacherName && r.teacherName.toLowerCase() === t.name.toLowerCase()) ||
          (t.niy && r.niy === t.niy)
      );

      const targetDays = tRecords.length;
      let terisiCount = 0;
      let belumCount = 0;

      tRecords.forEach(r => {
        if (r.status === "Lengkap" || r.status === "Terlambat" || r.status === "Belum Lengkap") {
          terisiCount++;
        } else {
          belumCount++;
        }
      });

      const persentaseText = targetDays > 0 ? `${Math.round((terisiCount / targetDays) * 100)}%` : "—";

      return {
        teacher: t,
        target: targetDays,
        terisi: terisiCount,
        belum: belumCount,
        persentaseText,
        records: tRecords
      };
    });
  }, [activeTeachers, mutabaahData]);

  // =========================================================================
  // MODAL / DRILL-DOWN STATES (READ-ONLY VERIFICATION)
  // =========================================================================
  const [activeModal, setActiveModal] = useState<
    "teachers" | "students" | "classes" | "kaldikDetail" | null
  >(null);

  // Drill-down 1: Ringkasan Sesi Kehadiran (when clicking any of the 6 summary cards)
  const [drillDownSummaryMetric, setDrillDownSummaryMetric] = useState<
    "guru_terjadwal" | "hadir" | "tepat_waktu" | "terlambat" | "tidak_hadir" | "digantikan" | null
  >(null);

  // Drill-down 2: Guru Kehadiran Detail (when clicking a teacher row in Section 2)
  const [drillDownTeacherAttendance, setDrillDownTeacherAttendance] = useState<any | null>(null);

  // Drill-down 3: Guru Administrasi Detail (when clicking a teacher row in Section 3)
  const [drillDownTeacherAdmin, setDrillDownTeacherAdmin] = useState<any | null>(null);

  // Drill-down 4: Guru Mutabaah Detail (when clicking a teacher row in Section 4)
  const [drillDownTeacherMutabaah, setDrillDownTeacherMutabaah] = useState<any | null>(null);

  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [selectedKaldikEvent, setSelectedKaldikEvent] = useState<any | null>(null);

  // Filtered sessions for Summary Card Drill-down
  const summaryDrillDownSessions = useMemo(() => {
    if (!drillDownSummaryMetric) return [];
    let list = attendanceSessions;
    if (drillDownSummaryMetric === "hadir") {
      list = attendanceSessions.filter(s => s.status === "Hadir Mengajar" || s.status === "Terlambat");
    } else if (drillDownSummaryMetric === "tepat_waktu") {
      list = attendanceSessions.filter(s => s.status === "Hadir Mengajar");
    } else if (drillDownSummaryMetric === "terlambat") {
      list = attendanceSessions.filter(s => s.status === "Terlambat");
    } else if (drillDownSummaryMetric === "tidak_hadir") {
      list = attendanceSessions.filter(s =>
        isSessionTidakHadir(s, todayStr, currentMinutes, lessonPeriods)
      );
    } else if (drillDownSummaryMetric === "digantikan") {
      list = attendanceSessions.filter(s => s.status === "Digantikan Guru Lain" || s.status === "Tukar Jadwal" || s.isReplaced);
    }

    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.toLowerCase();
      list = list.filter(
        s =>
          (s.teacherName && s.teacherName.toLowerCase().includes(q)) ||
          (s.subjectName && s.subjectName.toLowerCase().includes(q)) ||
          (s.className && s.className.toLowerCase().includes(q)) ||
          (s.jp && s.jp.toLowerCase().includes(q))
      );
    }
    return list;
  }, [drillDownSummaryMetric, attendanceSessions, modalSearchQuery, todayStr, currentMinutes, lessonPeriods]);

  // Kaldik upcoming events
  const upcomingEvents = useMemo(() => {
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const eventsList: Array<{
      date: string;
      dayName: string;
      title: string;
      category?: string;
      description?: string;
      isEffectiveDay?: boolean;
    }> = [];

    calendarDays.forEach(day => {
      if (day.date >= todayStr) {
        const dObj = new Date(day.date);
        const dayName = isNaN(dObj.getTime()) ? "-" : dayNames[dObj.getDay()];

        if (day.events && day.events.length > 0) {
          day.events.forEach(ev => {
            eventsList.push({
              date: day.date,
              dayName,
              title: ev.title || "Kegiatan Sekolah",
              category: ev.categoryId || "Akademik",
              description: ev.description || "",
              isEffectiveDay: true
            });
          });
        }
      }
    });

    eventsList.sort((a, b) => a.date.localeCompare(b.date));
    return eventsList.slice(0, 4);
  }, [calendarDays, todayStr]);

  // Refresh handler
  const handleRefreshAll = () => {
    setCurrentTime(new Date());
    refetchTeachers();
    refetchStudents();
    refetchClasses();
    refetchSchedules();
    refetchLessonPeriods();
    refetchAttendance();
    refetchProta();
    refetchProsem();
    refetchModul();
    refetchJournals();
    refetchMutabaah();
    refetchKaldik();
    refetchSupervision();
  };

  const isDataLoading = isTeachersLoading || isAttendanceLoading || isMutabaahLoading;

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================================= */}
      {/* HEADER: TITLE + GLOBAL PERIOD FILTER                                      */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Dashboard Kepala Sekolah
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                Pimpinan Satuan Pendidikan • Read-Only
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Monitoring operasional terpadu: Kehadiran Mengajar (KBM), Administrasi Guru, dan Mutabaah.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefreshAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-all cursor-pointer shadow-xs"
              title="Muat Ulang Data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan Data</span>
            </button>
          </div>
        </div>

        {/* Global Period Selector Controls */}
        <div className="pt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-500" />
              Periode:
            </span>
            {(
              [
                { id: "today", label: "Hari Ini" },
                { id: "yesterday", label: "Kemarin" },
                { id: "7days", label: "7 Hari" },
                { id: "this_month", label: "Bulan Ini" },
                { id: "last_month", label: "Bulan Lalu" },
                { id: "semester", label: "Semester" },
                { id: "custom", label: "Custom" }
              ] as const
            ).map(p => (
              <button
                key={p.id}
                onClick={() => setPeriodPreset(p.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodPreset === p.id
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs if Custom is selected */}
          {periodPreset === "custom" && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
              />
              <span className="text-slate-400">s/d</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
              />
            </div>
          )}

          {/* Active Period Label */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            <Calendar className="w-3.5 h-3.5" />
            <span>{resolvedDateRange.label}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: RINGKASAN KEHADIRAN MENGAJAR (6 CLICKABLE CARDS)               */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h2 className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              Section 1 — Ringkasan Kehadiran Mengajar
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Berdasarkan Jadwal Operasional & Rekaman Check-in QR Aktual ({resolvedDateRange.label})
            </p>
          </div>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
            Klik angka untuk membuka daftar sesi
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Card 1: Guru Terjadwal */}
          <button
            onClick={() => {
              setModalSearchQuery("");
              setDrillDownSummaryMetric("guru_terjadwal");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-blue-500 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase block">
              Guru Terjadwal
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1 group-hover:text-blue-600 transition-colors">
              {kbmSummary.totalTeachersScheduled}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {kbmSummary.totalSessions} Sesi Mengajar
            </span>
          </button>

          {/* Card 2: Hadir */}
          <button
            onClick={() => {
              setModalSearchQuery("");
              setDrillDownSummaryMetric("hadir");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 hover:border-emerald-500 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group bg-gradient-to-br from-white to-emerald-50/20 dark:from-zinc-900 dark:to-emerald-950/10"
          >
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase block">
              Hadir
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {kbmSummary.hadirCount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Sesi Terlaksana</span>
          </button>

          {/* Card 3: Tepat Waktu */}
          <button
            onClick={() => {
              setModalSearchQuery("");
              setDrillDownSummaryMetric("tepat_waktu");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/60 hover:border-blue-500 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase block">
              Tepat Waktu
            </span>
            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
              {kbmSummary.tepatWaktuCount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Check-in Standar</span>
          </button>

          {/* Card 4: Terlambat */}
          <button
            onClick={() => {
              setModalSearchQuery("");
              setDrillDownSummaryMetric("terlambat");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-900/60 hover:border-amber-500 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase block">
              Terlambat
            </span>
            <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {kbmSummary.terlambatCount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Info Monitoring</span>
          </button>

          {/* Card 5: Tidak Hadir */}
          <button
            onClick={() => {
              setModalSearchQuery("");
              setDrillDownSummaryMetric("tidak_hadir");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 hover:border-rose-500 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase block">
              Tidak Hadir
            </span>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {kbmSummary.tidakHadirCount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Alpha / Izin / Sakit</span>
          </button>

          {/* Card 6: Digantikan */}
          <button
            onClick={() => {
              setModalSearchQuery("");
              setDrillDownSummaryMetric("digantikan");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-900/60 hover:border-purple-500 rounded-2xl p-4 shadow-xs transition-all cursor-pointer group"
          >
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase block">
              Digantikan
            </span>
            <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
              {kbmSummary.digantikanCount}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Guru Pengganti</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: REKAP GURU KEHADIRAN (TABLE WITH CLICKABLE TEACHER ROWS)       */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-500" />
              Section 2 — Rekap Kehadiran Mengajar Per Guru
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Klik nama guru untuk membuka drill-down bukti sesi mengajar dan metode check-in.
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            {activeTeachers.length} Guru Aktif Terdaftar
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2.5 text-center w-10">No</th>
                <th className="px-3 py-2.5">Guru</th>
                <th className="px-3 py-2.5 text-center">Beban Sesi</th>
                <th className="px-3 py-2.5 text-center">Hadir</th>
                <th className="px-3 py-2.5 text-center">Tepat Waktu</th>
                <th className="px-3 py-2.5 text-center">Terlambat</th>
                <th className="px-3 py-2.5 text-center">Tidak Hadir</th>
                <th className="px-3 py-2.5 text-center">Tingkat Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {teacherAttendanceRecap.map((row, idx) => (
                <tr
                  key={row.teacher.id || idx}
                  onClick={() => {
                    setModalSearchQuery("");
                    setDrillDownTeacherAttendance(row);
                  }}
                  className="hover:bg-blue-50/60 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">
                    <div className="flex items-center justify-between">
                      <span>{row.teacher.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-zinc-300">
                    {row.bebanSesi}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-emerald-600">
                    {row.hadir}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-blue-600">
                    {row.tepatWaktu}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-amber-600">
                    {row.terlambat}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-rose-600">
                    {row.tidakHadir}
                  </td>
                  <td className="px-3 py-2.5 text-center font-black">
                    {row.bebanSesi === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={
                          row.tingkatHadirValue! >= 90
                            ? "text-emerald-600"
                            : row.tingkatHadirValue! >= 75
                            ? "text-blue-600"
                            : "text-rose-600"
                        }
                      >
                        {row.tingkatHadirText}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: ADMINISTRASI GURU (PROTA, PROSEM, MODUL AJAR, JURNAL)           */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-blue-500" />
              Section 3 — Administrasi Guru
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Kelengkapan dokumen kurikulum dan keterisian jurnal mengajar (Klik nama guru untuk verifikasi rincian dokumen).
            </p>
          </div>
          <span className="text-[11px] text-slate-400">Read-Only Audit</span>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2.5 text-center w-10">No</th>
                <th className="px-3 py-2.5">Guru</th>
                <th className="px-3 py-2.5 text-center">Prota</th>
                <th className="px-3 py-2.5 text-center">Prosem</th>
                <th className="px-3 py-2.5 text-center">Modul Ajar</th>
                <th className="px-3 py-2.5 text-center">Jurnal</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {teacherAdminRecap.map((row, idx) => (
                <tr
                  key={row.teacher.id || idx}
                  onClick={() => {
                    setModalSearchQuery("");
                    setDrillDownTeacherAdmin(row);
                  }}
                  className="hover:bg-blue-50/60 dark:hover:bg-blue-950/20 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">
                    <div className="flex items-center justify-between">
                      <span>{row.teacher.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.protaStatusColor === "emerald"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : row.protaStatusColor === "amber"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : row.protaStatusColor === "slate"
                          ? "text-slate-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {row.protaText}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.prosemStatusColor === "emerald"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : row.prosemStatusColor === "amber"
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : row.prosemStatusColor === "slate"
                          ? "text-slate-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {row.prosemText}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.modulStatusColor === "blue"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                          : row.modulStatusColor === "slate"
                          ? "text-slate-400"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}
                    >
                      {row.modulText}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-zinc-300">
                    {row.jurnalText}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.overallColor === "emerald"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : row.overallColor === "amber"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                          : row.overallColor === "slate"
                          ? "text-slate-400"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                      }`}
                    >
                      {row.overallStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: MUTABAAH GURU (TARGET, TERISI, BELUM, PERSENTASE)               */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Section 4 — Mutabaah Yaumiyah Guru
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Kepatuhan pengisian mutabaah harian pada periode terpilih ({resolvedDateRange.label}).
            </p>
          </div>
          <span className="text-[11px] text-slate-400">
            Rata-rata: {mutabaahData?.summary?.fillRatePercentage || 0}% Terisi
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2.5 text-center w-10">No</th>
                <th className="px-3 py-2.5">Guru</th>
                <th className="px-3 py-2.5 text-center">Target (Hari)</th>
                <th className="px-3 py-2.5 text-center">Terisi</th>
                <th className="px-3 py-2.5 text-center">Belum</th>
                <th className="px-3 py-2.5 text-center">Persentase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {teacherMutabaahRecap.map((row, idx) => (
                <tr
                  key={row.teacher.id || idx}
                  onClick={() => {
                    setModalSearchQuery("");
                    setDrillDownTeacherMutabaah(row);
                  }}
                  className="hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">
                    <div className="flex items-center justify-between">
                      <span>{row.teacher.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-zinc-300">
                    {row.target}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-emerald-600">
                    {row.terisi}
                  </td>
                  <td className="px-3 py-2.5 text-center font-bold text-rose-600">
                    {row.belum}
                  </td>
                  <td className="px-3 py-2.5 text-center font-black">
                    {row.target === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={
                          row.terisi === row.target
                            ? "text-emerald-600"
                            : row.terisi > 0
                            ? "text-amber-600"
                            : "text-rose-600"
                        }
                      >
                        {row.persentaseText}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: DATA UTAMA SEKOLAH & KALDIK / SUPERVISI                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Guru Aktif */}
        <button
          onClick={() => {
            setModalSearchQuery("");
            setActiveModal("teachers");
          }}
          className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-blue-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Guru Aktif
            </span>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {activeTeachers.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">Lihat Master Guru →</span>
        </button>

        {/* Siswa Aktif */}
        <button
          onClick={() => {
            setModalSearchQuery("");
            setActiveModal("students");
          }}
          className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Siswa Aktif
            </span>
            <GraduationCap className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {activeStudents.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">Lihat Master Siswa →</span>
        </button>

        {/* Rombel Aktif */}
        <button
          onClick={() => {
            setModalSearchQuery("");
            setActiveModal("classes");
          }}
          className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-purple-500 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
              Rombel Aktif
            </span>
            <School className="w-5 h-5 text-purple-500" />
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {activeClasses.length}
          </div>
          <span className="text-[11px] text-slate-400 mt-2 block">Lihat Rombongan Belajar →</span>
        </button>
      </div>

      {/* Kaldik & Supervisi Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kaldik */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Kegiatan Terdekat (Kaldik)
              </h3>
            </div>
            <button
              onClick={() => navigate("/academic-calendar")}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Lihat Kaldik <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-zinc-800 mt-2">
            {upcomingEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Belum ada agenda kegiatan terdekat pada Kalender Akademik.
              </div>
            ) : (
              upcomingEvents.map((ev, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedKaldikEvent(ev);
                    setActiveModal("kaldikDetail");
                  }}
                  className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-xl transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 text-center py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg shrink-0">
                      <span className="block text-[9px] font-bold text-slate-400 uppercase">
                        {ev.dayName ? ev.dayName.substring(0, 3) : "HARI"}
                      </span>
                      <span className="block text-xs font-black text-slate-800 dark:text-zinc-200">
                        {ev.date ? ev.date.split("-")[2] : "-"}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                        {ev.title}
                      </h4>
                      <span className="text-[10px] text-slate-400">{ev.date}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Supervisi Pembelajaran */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Supervisi Pembelajaran
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-600">Semester Aktif</span>
            </div>

            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-100 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Supervisi Terjadwal</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {supervisions.length} Sesi
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-100 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Selesai Dinilai</span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {supervisions.filter(s => s.status === "Selesai").length} Sesi
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={() => navigate("/supervision-academic")}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Buka Menu Supervisi Akademik</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DRILL-DOWN MODAL 1: RINGKASAN KEHADIRAN (CLICK ANY OF THE 6 CARDS)         */}
      {/* ========================================================================= */}
      {drillDownSummaryMetric && (
        <Dialog
          isOpen={!!drillDownSummaryMetric}
          onClose={() => setDrillDownSummaryMetric(null)}
          title={`Detail Sesi Mengajar: ${
            drillDownSummaryMetric === "guru_terjadwal"
              ? "Semua Sesi Guru Terjadwal"
              : drillDownSummaryMetric === "hadir"
              ? "Sesi Hadir"
              : drillDownSummaryMetric === "tepat_waktu"
              ? "Sesi Tepat Waktu"
              : drillDownSummaryMetric === "terlambat"
              ? "Sesi Terlambat"
              : drillDownSummaryMetric === "tidak_hadir"
              ? "Sesi Tidak Hadir"
              : "Sesi Digantikan Guru Lain"
          } (${summaryDrillDownSessions.length} Sesi)`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-900 text-xs">
              <div>
                <span className="font-bold text-blue-900 dark:text-blue-200">
                  Periode Aktif: {resolvedDateRange.label}
                </span>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                  Daftar sesi operasional yang membentuk angka ringkasan ini.
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 font-mono font-bold text-blue-700 dark:text-blue-300">
                READ-ONLY VERIFIKASI
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari guru / mapel / kelas / JP..."
                value={modalSearchQuery}
                onChange={e => setModalSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-3 py-2.5">Guru</th>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">Mapel</th>
                    <th className="px-3 py-2.5">Kelas</th>
                    <th className="px-3 py-2.5">JP</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Check-in</th>
                    <th className="px-3 py-2.5">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {summaryDrillDownSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                        Belum ada data sesi mengajar pada kategori dan periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    summaryDrillDownSessions.map((sess, idx) => (
                      <tr key={sess.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2 font-bold text-slate-900 dark:text-zinc-100">
                          {sess.teacherName || "—"}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-zinc-400 font-mono text-[11px]">
                          {sess.date}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-zinc-300">
                          {sess.subjectName || "—"}
                        </td>
                        <td className="px-3 py-2 font-medium text-blue-600">
                          {sess.className || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px]">
                          {sess.jp || "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sess.status === "Hadir Mengajar"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : sess.status === "Terlambat"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : sess.status === "Digantikan Guru Lain" || sess.isReplaced
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                                : sess.status === "Belum Diverifikasi" || sess.status === "Belum Terkonfirmasi"
                                ? "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-slate-700 dark:text-zinc-300">
                          {sess.checkInTime || "—"}
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-500 dark:text-zinc-400">
                          {getCheckInMethod(sess)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* DRILL-DOWN MODAL 2: DETAIL KEHADIRAN GURU (CLICK ROW IN SECTION 2)         */}
      {/* ========================================================================= */}
      {drillDownTeacherAttendance && (
        <Dialog
          isOpen={!!drillDownTeacherAttendance}
          onClose={() => setDrillDownTeacherAttendance(null)}
          title={`Detail Kehadiran Guru: ${drillDownTeacherAttendance.teacher.name}`}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-zinc-800/80 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Periode</span>
                <strong className="text-slate-800 dark:text-zinc-200">{resolvedDateRange.label}</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Beban Sesi</span>
                <strong className="text-blue-600 text-sm">{drillDownTeacherAttendance.bebanSesi} Sesi</strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Hadir / Tepat Waktu</span>
                <strong className="text-emerald-600 text-sm">
                  {drillDownTeacherAttendance.hadir} Hadir ({drillDownTeacherAttendance.tepatWaktu} Tepat)
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Tingkat Hadir</span>
                <strong className="text-slate-900 dark:text-white text-sm">
                  {drillDownTeacherAttendance.tingkatHadirText}
                </strong>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5">Mapel</th>
                    <th className="px-3 py-2.5">Kelas</th>
                    <th className="px-3 py-2.5">JP</th>
                    <th className="px-3 py-2.5">Jam</th>
                    <th className="px-3 py-2.5 text-center">Check-in</th>
                    <th className="px-3 py-2.5 text-center">Check-out</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5">Metode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {drillDownTeacherAttendance.sessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                        Belum ada sesi mengajar yang terjadwal untuk guru ini pada periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    drillDownTeacherAttendance.sessions.map((sess: TeacherTeachingAttendance, idx: number) => (
                      <tr key={sess.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 dark:text-zinc-300">
                          {sess.date}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-zinc-200">
                          {sess.subjectName || "—"}
                        </td>
                        <td className="px-3 py-2.5 font-medium text-blue-600">
                          {sess.className || "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">
                          {sess.jp || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 font-mono text-[11px]">
                          {sess.timeSlot || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {sess.checkInTime || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-zinc-400">
                          {sess.checkOutTime || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sess.status === "Hadir Mengajar"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : sess.status === "Terlambat"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : sess.status === "Digantikan Guru Lain" || sess.isReplaced
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                                : sess.status === "Belum Diverifikasi" || sess.status === "Belum Terkonfirmasi"
                                ? "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-slate-500 dark:text-zinc-400">
                          {getCheckInMethod(sess)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* DRILL-DOWN MODAL 3: DETAIL ADMINISTRASI GURU (CLICK ROW IN SECTION 3)     */}
      {/* ========================================================================= */}
      {drillDownTeacherAdmin && (
        <Dialog
          isOpen={!!drillDownTeacherAdmin}
          onClose={() => setDrillDownTeacherAdmin(null)}
          title={`Detail Administrasi Guru: ${drillDownTeacherAdmin.teacher.name}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-5">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-900 text-xs flex items-center justify-between">
              <div>
                <span className="font-bold text-blue-900 dark:text-blue-200">
                  Guru: {drillDownTeacherAdmin.teacher.name} (NIY: {drillDownTeacherAdmin.teacher.niy || "—"})
                </span>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Target Mapel/Kelas yang Diampu: {drillDownTeacherAdmin.targetObligationCount} Kombinasi
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                READ-ONLY VERIFIKASI
              </span>
            </div>

            {/* Sub-section A: Prota */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                1. Program Tahunan (Prota) — {drillDownTeacherAdmin.protaList.length} Dokumen
              </h4>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="px-3 py-2">Mata Pelajaran</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2 text-center">Tahun Ajaran</th>
                      <th className="px-3 py-2 text-center">Jumlah Topik</th>
                      <th className="px-3 py-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {drillDownTeacherAdmin.protaList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-slate-400 text-xs">
                          Belum ada dokumen Prota yang dibuat.
                        </td>
                      </tr>
                    ) : (
                      drillDownTeacherAdmin.protaList.map((p: AnnualProgram, idx: number) => (
                        <tr key={p.id || idx}>
                          <td className="px-3 py-2 font-bold">{p.subjectName || "—"}</td>
                          <td className="px-3 py-2">{p.className || "—"}</td>
                          <td className="px-3 py-2 text-center font-mono">{p.academicYearName || "—"}</td>
                          <td className="px-3 py-2 text-center font-bold text-blue-600">
                            {p.topics?.length || 0} Topik
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                              Lengkap
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-section B: Prosem */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
                2. Program Semester (Prosem) — {drillDownTeacherAdmin.prosemList.length} Dokumen
              </h4>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase">
                    <tr>
                      <th className="px-3 py-2">Mata Pelajaran</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2 text-center">Semester</th>
                      <th className="px-3 py-2 text-center">Efektif JP</th>
                      <th className="px-3 py-2 text-center">Pertemuan / Alokasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {drillDownTeacherAdmin.prosemList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-slate-400 text-xs">
                          Belum ada dokumen Prosem yang dibuat.
                        </td>
                      </tr>
                    ) : (
                      drillDownTeacherAdmin.prosemList.map((p: SemesterProgram, idx: number) => (
                        <tr key={p.id || idx}>
                          <td className="px-3 py-2 font-bold">{p.subjectName || "—"}</td>
                          <td className="px-3 py-2">{p.className || "—"}</td>
                          <td className="px-3 py-2 text-center font-mono">{p.semesterName || "—"}</td>
                          <td className="px-3 py-2 text-center font-bold text-emerald-600">
                            {p.effectiveJpSemester || 0} JP
                          </td>
                          <td className="px-3 py-2 text-center">
                            {p.meetings?.length || p.allocations?.length || 0} Terjadwal
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-section C: Modul Ajar */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-purple-600" />
                3. Modul Ajar — {drillDownTeacherAdmin.modulList.length} Modul
              </h4>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Judul Modul</th>
                      <th className="px-3 py-2">Mata Pelajaran</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2 text-center">Tautan Dokumen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {drillDownTeacherAdmin.modulList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-slate-400 text-xs">
                          Belum ada Modul Ajar yang diunggah.
                        </td>
                      </tr>
                    ) : (
                      drillDownTeacherAdmin.modulList.map((m: LessonPlan, idx: number) => (
                        <tr key={m.id || idx}>
                          <td className="px-3 py-2 font-bold text-slate-800 dark:text-zinc-200">{m.title}</td>
                          <td className="px-3 py-2">{m.subjectName || "—"}</td>
                          <td className="px-3 py-2">{m.className || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            {m.link ? (
                              <a
                                href={m.link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1"
                              >
                                Lihat Dokumen <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sub-section D: Jurnal Mengajar */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                4. Jurnal Mengajar ({resolvedDateRange.label}) — {drillDownTeacherAdmin.journals.length} Entri
              </h4>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Kelas</th>
                      <th className="px-3 py-2">Mata Pelajaran</th>
                      <th className="px-3 py-2">Materi Pembelajaran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {drillDownTeacherAdmin.journals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-3 text-center text-slate-400 text-xs">
                          Belum ada jurnal mengajar yang diisi pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      drillDownTeacherAdmin.journals.map((j: TeachingJournal, idx: number) => (
                        <tr key={j.id || idx}>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{j.date}</td>
                          <td className="px-3 py-2 font-medium text-blue-600">{j.className || "—"}</td>
                          <td className="px-3 py-2">{j.subjectName || "—"}</td>
                          <td className="px-3 py-2 text-slate-800 dark:text-zinc-200">
                            {j.material || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* DRILL-DOWN MODAL 4: DETAIL MUTABAAH GURU (CLICK ROW IN SECTION 4)         */}
      {/* ========================================================================= */}
      {drillDownTeacherMutabaah && (
        <Dialog
          isOpen={!!drillDownTeacherMutabaah}
          onClose={() => setDrillDownTeacherMutabaah(null)}
          title={`Detail Mutabaah Guru: ${drillDownTeacherMutabaah.teacher.name}`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 text-xs">
              <div>
                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                  Guru: {drillDownTeacherMutabaah.teacher.name}
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Periode: {resolvedDateRange.label} • Terisi: {drillDownTeacherMutabaah.terisi} dari {drillDownTeacherMutabaah.target} Hari ({drillDownTeacherMutabaah.persentaseText})
                </p>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 font-mono font-bold text-emerald-700 dark:text-emerald-300">
                READ-ONLY VERIFIKASI
              </span>
            </div>

            <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="px-3 py-2.5">Tanggal</th>
                    <th className="px-3 py-2.5 text-center">Status Pengisian</th>
                    <th className="px-3 py-2.5 text-center">Waktu Submit</th>
                    <th className="px-3 py-2.5 text-center">Kelengkapan Indikator</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {drillDownTeacherMutabaah.records.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                        Belum ada rekaman kewajiban mutabaah pada periode yang dipilih.
                      </td>
                    </tr>
                  ) : (
                    drillDownTeacherMutabaah.records.map((rec: any, idx: number) => (
                      <tr key={rec.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-slate-800 dark:text-zinc-200">
                          {rec.date}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === "Lengkap"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : rec.status === "Terlambat"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : rec.status === "Belum Lengkap"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-600 dark:text-zinc-300">
                          {rec.submissionTime || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-800 dark:text-zinc-200">
                          {rec.completenessPercentage ? `${rec.completenessPercentage}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* OTHER MODALS (MASTER GURU, SISWA, ROMBEL, KALDIK DETAIL)                   */}
      {/* ========================================================================= */}
      <Dialog
        isOpen={activeModal === "teachers"}
        onClose={() => setActiveModal(null)}
        title={`Daftar Guru Aktif (${activeTeachers.length} Guru)`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama guru / NIY..."
              value={modalSearchQuery}
              onChange={e => setModalSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
            />
          </div>
          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Guru</th>
                  <th className="px-3 py-2">NIY</th>
                  <th className="px-3 py-2">Gender</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {activeTeachers
                  .filter(t => t.name.toLowerCase().includes(modalSearchQuery.toLowerCase()))
                  .map((t, idx) => (
                    <tr key={t.id || idx}>
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{t.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{t.niy || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-500">{t.gender || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Aktif
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={activeModal === "students"}
        onClose={() => setActiveModal(null)}
        title={`Daftar Siswa Aktif (${activeStudents.length} Siswa)`}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama siswa / NISN..."
              value={modalSearchQuery}
              onChange={e => setModalSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
            />
          </div>
          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Siswa</th>
                  <th className="px-3 py-2">NISN</th>
                  <th className="px-3 py-2">Kelas</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {activeStudents
                  .filter(s => s.name.toLowerCase().includes(modalSearchQuery.toLowerCase()))
                  .map((s, idx) => (
                    <tr key={s.id || idx}>
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{s.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{s.nisn || "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-blue-600">{s.className || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Aktif
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      <Dialog
        isOpen={activeModal === "classes"}
        onClose={() => setActiveModal(null)}
        title={`Daftar Rombel Aktif (${activeClasses.length} Rombel)`}
        maxWidth="max-w-2xl"
      >
        <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2 text-center w-10">No</th>
                <th className="px-3 py-2">Nama Rombel</th>
                <th className="px-3 py-2">Tingkat</th>
                <th className="px-3 py-2">Wali Kelas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {activeClasses.map((c, idx) => (
                <tr key={c.id || idx}>
                  <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{c.name}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-zinc-300">{c.grade || c.level || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-emerald-600">
                    {c.homeroomTeacherName || c.waliKelasName || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Dialog>

      {selectedKaldikEvent && (
        <Dialog
          isOpen={activeModal === "kaldikDetail"}
          onClose={() => setActiveModal(null)}
          title="Rincian Agenda Kegiatan Sekolah"
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900 space-y-1">
              <span className="text-[10px] font-bold text-blue-600 uppercase">
                {selectedKaldikEvent.category || "Agenda Kaldik"}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {selectedKaldikEvent.title}
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                Tanggal: <strong>{selectedKaldikEvent.date}</strong> ({selectedKaldikEvent.dayName})
              </p>
            </div>
            {selectedKaldikEvent.description && (
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Deskripsi / Catatan</span>
                <p className="text-xs text-slate-700 dark:text-zinc-300 mt-1 leading-relaxed">
                  {selectedKaldikEvent.description}
                </p>
              </div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => {
                  setActiveModal(null);
                  navigate("/academic-calendar");
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Buka Kalender Akademik</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
