import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../contexts/AuthContext";
import { teacherService } from "../../services/teacherService";
import { studentService } from "../../services/studentService";
import { classService } from "../../services/classService";
import { academicPlanningService } from "../../services/academicPlanning.service";
import { adminComplianceEngineService } from "../../services/adminComplianceEngine.service";
import { executiveMutabaahService } from "../../services/executiveMutabaahService";
import { supervisionService } from "../../services/supervision.service";
import { academicYearService } from "../../services/academicYearService";
import { semesterService } from "../../services/semester.service";
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
  TrendingUp,
  RefreshCw,
  Eye,
  ArrowRight,
  BookOpen
} from "lucide-react";

export const HeadmasterSimplifiedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active Year and Semester queries
  const { data: activeYear } = useQuery({
    queryKey: ["activeAcademicYear"],
    queryFn: () => academicYearService.getActiveAcademicYear()
  });

  const { data: activeSemester } = useQuery({
    queryKey: ["activeSemester"],
    queryFn: () => semesterService.getActiveSemester()
  });

  const ayId = activeYear?.id;
  const semId = activeSemester?.id;

  // Master Data Queries
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

  // Kaldik / Calendar Days Query
  const { data: calendarDays = [], isLoading: isKaldikLoading, refetch: refetchKaldik } = useQuery({
    queryKey: ["academicCalendarDaysDashboard", ayId, semId],
    queryFn: () => academicPlanningService.getCalendarDays(ayId, semId)
  });

  // Compliance / Discipline / Administration Queries
  const { data: complianceSummary, isLoading: isComplianceLoading, refetch: refetchCompliance } = useQuery({
    queryKey: ["adminComplianceHeadmasterSummary", ayId, semId],
    queryFn: () => adminComplianceEngineService.calculateComplianceSummary({
      academicYearId: ayId,
      semesterId: semId
    })
  });

  const { data: teacherRankings = [], isLoading: isRankingsLoading, refetch: refetchRankings } = useQuery({
    queryKey: ["adminComplianceHeadmasterRankings", ayId, semId],
    queryFn: () => adminComplianceEngineService.calculateTeacherAdministrationScore({
      academicYearId: ayId,
      semesterId: semId
    })
  });

  // Mutabaah Report Query
  const { data: mutabaahData, isLoading: isMutabaahLoading, refetch: refetchMutabaah } = useQuery({
    queryKey: ["executiveMutabaahReportDashboard", ayId, semId],
    queryFn: () => executiveMutabaahService.getExecutiveReport({
      academicYearId: ayId,
      semesterId: semId
    })
  });

  // Supervision Query
  const { data: supervisions = [], isLoading: isSupervisionLoading, refetch: refetchSupervision } = useQuery({
    queryKey: ["supervisionsDashboard", ayId, semId],
    queryFn: () => supervisionService.getAcademicSupervisions({
      academicYearId: ayId,
      semesterId: semId
    })
  });

  // Modal State Management
  const [activeModal, setActiveModal] = useState<
    "teachers" | "students" | "classes" | "mutabaah" | "administrasi" | "kbm" | "kaldikDetail" | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKaldikEvent, setSelectedKaldikEvent] = useState<any | null>(null);

  // Filtered Active Entities
  const activeTeachers = useMemo(() => {
    return teachers.filter(t => !t.isDeleted && t.status !== "Nonaktif");
  }, [teachers]);

  const activeStudents = useMemo(() => {
    return students.filter(s => s.status === "Aktif" || !s.status);
  }, [students]);

  const activeClasses = useMemo(() => {
    return classes.filter(c => !c.isDeleted);
  }, [classes]);

  // Discipline Calculations
  const mutabaahPercentage = useMemo(() => {
    if (!mutabaahData?.summary) return 0;
    return mutabaahData.summary.fillRatePercentage || 0;
  }, [mutabaahData]);

  const administrasiStats = useMemo(() => {
    if (!complianceSummary) {
      return {
        overall: 0,
        prota: 0,
        prosem: 0,
        jurnal: 0
      };
    }
    const protaPct = complianceSummary.prota?.percentage || 0;
    const prosemPct = complianceSummary.prosem?.percentage || 0;
    const jurnalPct = complianceSummary.jurnalMengajar?.percentage || 0;
    const overall = Math.round((protaPct + prosemPct + jurnalPct) / 3);
    return {
      overall,
      prota: protaPct,
      prosem: prosemPct,
      jurnal: jurnalPct
    };
  }, [complianceSummary]);

  const kbmAttendanceStats = useMemo(() => {
    if (teacherRankings.length === 0) {
      return {
        tepatWaktuPct: 0,
        terlambatPct: 0,
        tidakHadirPct: 0,
        totalSessions: 0
      };
    }

    let totalExpected = 0;
    let totalLate = 0;
    let totalAlpha = 0;

    teacherRankings.forEach(r => {
      totalExpected += r.expectedSessionsCount || 0;
      totalLate += r.lateCount || 0;
      totalAlpha += r.alphaCount || 0;
    });

    if (totalExpected === 0) {
      return {
        tepatWaktuPct: 100,
        terlambatPct: 0,
        tidakHadirPct: 0,
        totalSessions: 0
      };
    }

    const terlambatPct = Math.round((totalLate / totalExpected) * 100);
    const tidakHadirPct = Math.round((totalAlpha / totalExpected) * 100);
    const tepatWaktuPct = Math.max(0, 100 - (terlambatPct + tidakHadirPct));

    return {
      tepatWaktuPct,
      terlambatPct,
      tidakHadirPct,
      totalSessions: totalExpected
    };
  }, [teacherRankings]);

  // Upcoming Kaldik Events
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, []);

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

    // Sort ascending by date
    eventsList.sort((a, b) => a.date.localeCompare(b.date));
    return eventsList.slice(0, 4);
  }, [calendarDays, todayStr]);

  // Refresh all dashboard metrics
  const handleRefreshAll = () => {
    refetchTeachers();
    refetchStudents();
    refetchClasses();
    refetchKaldik();
    refetchCompliance();
    refetchRankings();
    refetchMutabaah();
    refetchSupervision();
  };

  const isDataLoading = isTeachersLoading || isStudentsLoading || isClassesLoading || isComplianceLoading;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Greeting */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Dashboard Kepala Sekolah
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              Pimpinan Satuan Pendidikan
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Ringkasan data operasional, kedisiplinan guru, dan supervisi pembelajaran SMP Al-Karim Rasyid.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* ========================================================================= */}
      {/* 1. DATA UTAMA (3 KARTU BESAR, PALING MENONJOL, CLICKABLE)                 */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            Data Utama Sekolah
          </h2>
          <span className="text-[11px] text-slate-400">Klik kartu untuk rincian data</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Guru Aktif */}
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveModal("teachers");
            }}
            className="text-left bg-gradient-to-br from-white to-blue-50/40 dark:from-zinc-900 dark:to-blue-950/20 border-2 border-blue-200/80 dark:border-blue-900/60 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Guru Aktif
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {isTeachersLoading ? "..." : activeTeachers.length}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Tenaga Pendidik Terdaftar</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                Rincian <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>

          {/* Card 2: Siswa Aktif */}
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveModal("students");
            }}
            className="text-left bg-gradient-to-br from-white to-emerald-50/40 dark:from-zinc-900 dark:to-emerald-950/20 border-2 border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Siswa Aktif
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {isStudentsLoading ? "..." : activeStudents.length}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Peserta Didik Aktif</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                Rincian <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>

          {/* Card 3: Rombel Aktif */}
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveModal("classes");
            }}
            className="text-left bg-gradient-to-br from-white to-purple-50/40 dark:from-zinc-900 dark:to-purple-950/20 border-2 border-purple-200/80 dark:border-purple-900/60 rounded-2xl p-6 shadow-xs hover:shadow-md hover:border-purple-500 dark:hover:border-purple-500 transition-all cursor-pointer group relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                Rombel Aktif
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <School className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              {isClassesLoading ? "..." : activeClasses.length}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 font-medium">
              <span>Rombongan Belajar</span>
              <span className="text-purple-600 dark:text-purple-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-0.5">
                Rincian <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. KEDISIPLINAN GURU (HANYA 3 INDIKATOR, CLICKABLE)                       */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Kedisiplinan Guru
          </h2>
          <span className="text-[11px] text-slate-400">Klik indikator untuk melihat evaluasi per guru</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Indikator 1: Mutabaah Guru */}
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveModal("mutabaah");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Mutabaah Guru
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {mutabaahPercentage}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, mutabaahPercentage))}%` }}
              />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {mutabaahPercentage}%
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Tingkat Kepatuhan Pengisian</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold group-hover:translate-x-0.5 transition-transform">
                Detail →
              </span>
            </div>
          </button>

          {/* Indikator 2: Administrasi Guru */}
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveModal("administrasi");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Administrasi Guru
              </span>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {administrasiStats.overall}%
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, administrasiStats.overall))}%` }}
              />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {administrasiStats.overall}%
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Prota, Prosem & Jurnal Mengajar</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:translate-x-0.5 transition-transform">
                Detail →
              </span>
            </div>
          </button>

          {/* Indikator 3: Kehadiran Mengajar (KBM) */}
          <button
            onClick={() => {
              setSearchQuery("");
              setActiveModal("kbm");
            }}
            className="text-left bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-amber-500 dark:hover:border-amber-500 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Kehadiran Mengajar (KBM)
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {kbmAttendanceStats.tepatWaktuPct}% Tepat Waktu
              </span>
            </div>
            {/* Multi-color progress bar */}
            <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 mb-3 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-2"
                style={{ width: `${kbmAttendanceStats.tepatWaktuPct}%` }}
                title={`Tepat Waktu: ${kbmAttendanceStats.tepatWaktuPct}%`}
              />
              <div
                className="bg-amber-500 h-2"
                style={{ width: `${kbmAttendanceStats.terlambatPct}%` }}
                title={`Terlambat: ${kbmAttendanceStats.terlambatPct}%`}
              />
              <div
                className="bg-rose-500 h-2"
                style={{ width: `${kbmAttendanceStats.tidakHadirPct}%` }}
                title={`Tidak Hadir: ${kbmAttendanceStats.tidakHadirPct}%`}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                Hadir: {kbmAttendanceStats.tepatWaktuPct}%
              </div>
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Terlambat: {kbmAttendanceStats.terlambatPct}%
              </div>
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                Alpha: {kbmAttendanceStats.tidakHadirPct}%
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Sesi KBM Terlaksana</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold group-hover:translate-x-0.5 transition-transform">
                Detail →
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. KEGIATAN TERDEKAT & SUPERVISI PEMBELAJARAN (2-COLUMN GRID)              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Kegiatan Terdekat sesuai Kaldik */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Kegiatan Terdekat
                  </h3>
                  <p className="text-[11px] text-slate-400">Berdasarkan Kalender Akademik Resmi</p>
                </div>
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
                <div className="py-8 text-center text-xs text-slate-400">
                  Belum ada agenda kegiatan terdekat pada Kalender Akademik.
                </div>
              ) : (
                upcomingEvents.map((ev, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedKaldikEvent(ev);
                      setActiveModal("kaldikDetail");
                    }}
                    className="w-full text-left py-3 px-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-center py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg shrink-0">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">
                          {ev.dayName ? ev.dayName.substring(0, 3) : "HARI"}
                        </span>
                        <span className="block text-xs font-black text-slate-800 dark:text-zinc-200">
                          {ev.date ? ev.date.split("-")[2] : "-"}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {ev.title}
                        </h4>
                        <span className="text-[10px] text-slate-400">
                          {ev.date} • {ev.category || "Agenda Sekolah"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Prioritas kegiatan terdekat dari hari ini ({todayStr})</span>
            <span className="font-semibold text-slate-600 dark:text-zinc-300">SMP Al-Karim Rasyid</span>
          </div>
        </div>

        {/* Supervisi Pembelajaran */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Supervisi Pembelajaran
                  </h3>
                  <p className="text-[11px] text-slate-400">Penilaian & Pemantauan Mutu Mengajar</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                Tahun Aktif
              </span>
            </div>

            <div className="py-4 space-y-4">
              <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                Supervisi akademik berkala memastikan implementasi Kurikulum Merdeka dan mutu pengajaran guru berjalan sesuai standar mutu sekolah.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-150 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Supervisi Terjadwal</span>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                    {supervisions.length} Sesi
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-150 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Selesai Dinilai</span>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {supervisions.filter(s => s.status === "Selesai").length} Sesi
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-3">
            <button
              onClick={() => navigate("/supervision-academic")}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Lihat Supervisi Pembelajaran</span>
            </button>
            <button
              onClick={() => navigate("/supervision-instruments")}
              className="py-2.5 px-3 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Instrumen Penilaian"
            >
              Instrumen
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. MODALS FOR CLICKABLE METRICS                                            */}
      {/* ========================================================================= */}

      {/* Modal 1: Daftar Guru Aktif */}
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
              placeholder="Cari nama guru / NIY / NUPTK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Guru</th>
                  <th className="px-3 py-2">NIY / NUPTK</th>
                  <th className="px-3 py-2">Jenis Kelamin</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {activeTeachers
                  .filter(t => 
                    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (t.niy && t.niy.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((t, idx) => (
                    <tr key={t.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{t.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{t.niy || t.nuptk || "-"}</td>
                      <td className="px-3 py-2.5 text-slate-500">{t.gender || "-"}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
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

      {/* Modal 2: Daftar Siswa Aktif */}
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
              placeholder="Cari nama siswa / NISN / kelas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
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
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {activeStudents
                  .filter(s => 
                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (s.nisn && s.nisn.includes(searchQuery)) ||
                    (s.className && s.className.toLowerCase().includes(searchQuery.toLowerCase()))
                  )
                  .map((s, idx) => (
                    <tr key={s.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{s.name}</td>
                      <td className="px-3 py-2.5 text-slate-500">{s.nisn || "-"}</td>
                      <td className="px-3 py-2.5 font-medium text-blue-600">{s.className || "-"}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
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

      {/* Modal 3: Daftar Rombel */}
      <Dialog
        isOpen={activeModal === "classes"}
        onClose={() => setActiveModal(null)}
        title={`Daftar Rombongan Belajar (${activeClasses.length} Rombel)`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Rombel</th>
                  <th className="px-3 py-2">Tingkat / Jenjang</th>
                  <th className="px-3 py-2">Wali Kelas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {activeClasses.map((c, idx) => (
                  <tr key={c.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{c.name}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-zinc-300">{c.grade || c.level || "-"}</td>
                    <td className="px-3 py-2.5 font-medium text-emerald-600">{c.homeroomTeacherName || c.waliKelasName || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      {/* Modal 4: Detail Mutabaah Guru */}
      <Dialog
        isOpen={activeModal === "mutabaah"}
        onClose={() => setActiveModal(null)}
        title="Detail Pengisian Mutabaah Guru"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs">
            <span className="font-semibold text-emerald-800 dark:text-emerald-300">
              Tingkat Pengisian: <strong>{mutabaahPercentage}%</strong>
            </span>
            <span className="text-slate-500 dark:text-zinc-400">
              {mutabaahData?.summary?.filledCount || 0} Terisi dari {mutabaahData?.summary?.totalTeachers || activeTeachers.length} Guru
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Guru</th>
                  <th className="px-3 py-2">Status Pengisian</th>
                  <th className="px-3 py-2">Waktu Pengisian</th>
                  <th className="px-3 py-2">Kelengkapan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {(mutabaahData?.records || []).length === 0 ? (
                  activeTeachers.map((t, idx) => (
                    <tr key={t.id || idx}>
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold">{t.name}</td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Belum Ada Entri
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-400">-</td>
                      <td className="px-3 py-2.5 text-slate-400">0%</td>
                    </tr>
                  ))
                ) : (
                  (mutabaahData?.records || [])
                    .filter(r => r.teacherName.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                        <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{r.teacherName}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === "Lengkap"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : r.status === "Terlambat"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 dark:text-zinc-300 font-mono">
                          {r.submissionTime || "-"}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-zinc-200">
                          {r.completenessPercentage || 0}%
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      {/* Modal 5: Detail Administrasi Guru */}
      <Dialog
        isOpen={activeModal === "administrasi"}
        onClose={() => setActiveModal(null)}
        title="Detail Administrasi Guru (Prota, Prosem, Jurnal)"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-center">
            <div>
              <span className="text-slate-500 block">Prota</span>
              <strong className="text-blue-700 dark:text-blue-300 text-sm">{administrasiStats.prota}%</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Prosem</span>
              <strong className="text-blue-700 dark:text-blue-300 text-sm">{administrasiStats.prosem}%</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Jurnal Mengajar</span>
              <strong className="text-blue-700 dark:text-blue-300 text-sm">{administrasiStats.jurnal}%</strong>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Guru</th>
                  <th className="px-3 py-2 text-center">Status Prota</th>
                  <th className="px-3 py-2 text-center">Status Prosem</th>
                  <th className="px-3 py-2 text-center">Jurnal Mengajar</th>
                  <th className="px-3 py-2 text-center">Total Skor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {(teacherRankings || [])
                  .filter(r => r.teacherName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((r, idx) => (
                    <tr key={r.teacherId || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{r.teacherName}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.protaScore >= 100 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                            <XCircle className="w-3.5 h-3.5" /> Belum
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {r.prosemScore >= 100 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-500 font-semibold">
                            <XCircle className="w-3.5 h-3.5" /> Belum
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-zinc-300">
                        {r.actualJournalsCount || 0} / {r.expectedSessionsCount || 0} Sesi
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-blue-600">
                        {r.adminTotalScore || 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      {/* Modal 6: Detail Kehadiran KBM */}
      <Dialog
        isOpen={activeModal === "kbm"}
        onClose={() => setActiveModal(null)}
        title="Detail Kehadiran Mengajar (KBM) Per Guru"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900 text-xs">
            <span className="font-semibold text-amber-900 dark:text-amber-300">
              Tingkat Ketepatan Waktu KBM: <strong>{kbmAttendanceStats.tepatWaktuPct}%</strong>
            </span>
            <span className="text-slate-500 dark:text-zinc-400">
              Total Beban Sesi: {kbmAttendanceStats.totalSessions} Sesi
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800 text-slate-500 font-bold uppercase sticky top-0 border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 text-center w-10">No</th>
                  <th className="px-3 py-2">Nama Guru</th>
                  <th className="px-3 py-2 text-center">Beban Sesi</th>
                  <th className="px-3 py-2 text-center">Tepat Waktu</th>
                  <th className="px-3 py-2 text-center">Terlambat</th>
                  <th className="px-3 py-2 text-center">Alpha / Kosong</th>
                  <th className="px-3 py-2 text-center">Tingkat Hadir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {(teacherRankings || [])
                  .filter(r => r.teacherName.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((r, idx) => (
                    <tr key={r.teacherId || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <td className="px-3 py-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900 dark:text-zinc-100">{r.teacherName}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700 dark:text-zinc-300">
                        {r.expectedSessionsCount || 0}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-emerald-600">
                        {Math.max(0, (r.expectedSessionsCount || 0) - (r.lateCount || 0) - (r.alphaCount || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-amber-600">
                        {r.lateCount || 0}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-rose-600">
                        {r.alphaCount || 0}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black text-slate-900 dark:text-white">
                        {r.attendanceRate || 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </Dialog>

      {/* Modal 7: Detail Event Kaldik */}
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
