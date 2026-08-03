import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Award,
  Filter,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  AlertTriangle,
  Info,
  Users,
  BookOpen
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line
} from "recharts";
import {
  adminComplianceEngineService,
  ComplianceFilters,
  ComplianceSummary,
  TeacherComplianceRanking,
  MissingJournalDetail,
  MonthlyTrendItem
} from "../../services/adminComplianceEngine.service";
import { academicYearService } from "../../services/academicYearService";
import { semesterService } from "../../services/semester.service";
import { teacherService } from "../../services/teacherService";
import { classService } from "../../services/classService";
import { subjectService } from "../../services/subjectService";

export const ExecutiveComplianceDashboard: React.FC = () => {
  // Filter States
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("ALL");
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");

  // Search in Ranking Table
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Drilldown Modal
  const [drilldownModal, setDrilldownModal] = useState<{
    isOpen: boolean;
    title: string;
    items: MissingJournalDetail[];
  }>({
    isOpen: false,
    title: "",
    items: []
  });

  // Reference Queries
  const { data: academicYears = [] } = useQuery({
    queryKey: ["complianceAcademicYears"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["complianceSemesters"],
    queryFn: () => semesterService.getSemesters()
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["complianceTeachers"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["complianceClasses"],
    queryFn: () => classService.getClasses()
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["complianceSubjects"],
    queryFn: () => subjectService.getSubjects()
  });

  // Active Year & Semester Resolution
  const activeAcademicYear = useMemo(() => {
    return academicYears.find(a => a.status === "Aktif") || academicYears[0];
  }, [academicYears]);

  const activeSemester = useMemo(() => {
    return semesters.find(s => s.isActive) || semesters[0];
  }, [semesters]);

  const effectiveAcademicYearId = selectedAcademicYear || activeAcademicYear?.id || "";
  const effectiveSemesterId = selectedSemester || activeSemester?.id || "";

  // Compiled Filter Object
  const filters: ComplianceFilters = useMemo(() => ({
    academicYearId: effectiveAcademicYearId,
    semesterId: effectiveSemesterId,
    month: selectedMonth || undefined,
    teacherId: selectedTeacher,
    classId: selectedClass,
    subjectId: selectedSubject
  }), [effectiveAcademicYearId, effectiveSemesterId, selectedMonth, selectedTeacher, selectedClass, selectedSubject]);

  // Main Compliance Queries
  const { 
    data: complianceSummary, 
    isLoading: isLoadingSummary,
    refetch: refetchSummary 
  } = useQuery<ComplianceSummary>({
    queryKey: ["complianceSummary", filters],
    queryFn: () => adminComplianceEngineService.calculateComplianceSummary(filters)
  });

  const { 
    data: teacherRankings = [], 
    isLoading: isLoadingRankings 
  } = useQuery<TeacherComplianceRanking[]>({
    queryKey: ["teacherComplianceRankings", filters],
    queryFn: () => adminComplianceEngineService.calculateTeacherAdministrationScore(filters)
  });

  const { 
    data: monthlyTrend = [] 
  } = useQuery<MonthlyTrendItem[]>({
    queryKey: ["complianceMonthlyTrend", filters],
    queryFn: () => adminComplianceEngineService.calculateMonthlyTrend(filters)
  });

  const { 
    data: comparisonDetails 
  } = useQuery({
    queryKey: ["complianceComparisonDetails", filters],
    queryFn: () => adminComplianceEngineService.compareExpectedVsActual(filters)
  });

  // Filtered Teacher Rankings for Search
  const filteredRankings = useMemo(() => {
    if (!searchQuery.trim()) return teacherRankings;
    const q = searchQuery.toLowerCase();
    return teacherRankings.filter(r => 
      r.teacherName.toLowerCase().includes(q) || 
      (r.niy && r.niy.toLowerCase().includes(q))
    );
  }, [teacherRankings, searchQuery]);

  // System Recommendations
  const recommendations = useMemo(() => {
    if (!complianceSummary) return [];
    return adminComplianceEngineService.generateSystemRecommendations(complianceSummary, teacherRankings);
  }, [complianceSummary, teacherRankings]);

  // Status Badge Helper
  const getBadgeClass = (category: string) => {
    switch (category) {
      case "Sangat Baik":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40";
      case "Baik":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/40";
      case "Cukup":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/40";
      case "Perlu Pembinaan":
        return "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200 dark:border-orange-800/40";
      default:
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/40";
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION HEADER & FILTERS */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-indigo-200 dark:border-indigo-900/40 p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-900/30">
                SSOT Executive Engine
              </span>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Teaching Session SSOT
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-white mt-1.5">
              Analisis Kepatuhan Administrasi Guru
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Evaluasi riil berbasis perbandingan <strong className="text-indigo-600 dark:text-indigo-400">Expected vs Actual</strong> dari Prota, Prosem, Modul Ajar, dan Sesi Mengajar.
            </p>
          </div>

          <button
            onClick={() => refetchSummary()}
            className="self-start md:self-auto px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-indigo-200 dark:border-indigo-800 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kalkulasi Ulang</span>
          </button>
        </div>

        {/* CONTROLS & FILTER ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tahun Ajaran</label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-semibold text-slate-700 dark:text-zinc-200"
            >
              <option value="">Semua / Aktif</option>
              {academicYears.map(ay => (
                <option key={ay.id} value={ay.id}>{ay.name || ay.year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-semibold text-slate-700 dark:text-zinc-200"
            >
              <option value="">Semua Semester</option>
              {semesters.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bulan Periode</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-semibold text-slate-700 dark:text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pilih Guru</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-semibold text-slate-700 dark:text-zinc-200"
            >
              <option value="ALL">Semua Guru ({teachers.length})</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pilih Kelas</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-semibold text-slate-700 dark:text-zinc-200"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mata Pelajaran</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-2 font-semibold text-slate-700 dark:text-zinc-200"
            >
              <option value="ALL">Semua Mapel</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* OVERALL COMPLIANCE SCORE & 4 COMPONENT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* OVERALL CARD */}
        <div className="bg-gradient-to-br from-indigo-700 via-indigo-800 to-blue-900 text-white rounded-3xl p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-extrabold uppercase text-indigo-200 bg-white/10 px-2 py-0.5 rounded-md">
              Skor Total
            </span>
            <Shield className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="text-3xl font-black">{complianceSummary?.overallPercentage ?? 0}%</div>
            <p className="text-[11px] text-indigo-200 mt-0.5">Rata-rata Kepatuhan Administrasi</p>
          </div>
          <div className="pt-2 border-t border-white/10 text-[10px] font-medium text-indigo-100/80 flex justify-between">
            <span>Sesi Mengajar Target:</span>
            <span className="font-extrabold">{complianceSummary?.totalExpectedSessions ?? 0} Sesi</span>
          </div>
        </div>

        {/* 1. PROTA */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-700 dark:text-zinc-200">1. Program Tahunan (Prota)</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeClass(complianceSummary?.prota.status || "")}`}>
              {complianceSummary?.prota.percentage}%
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Target / Actual:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {complianceSummary?.prota.actual ?? 0} / {complianceSummary?.prota.target ?? 0}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                style={{ width: `${complianceSummary?.prota.percentage ?? 0}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            Belum Membuat: <strong className="text-rose-600">{complianceSummary?.prota.missing ?? 0} Prota</strong>
          </div>
        </div>

        {/* 2. PROSEM */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-700 dark:text-zinc-200">2. Program Semester (Prosem)</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeClass(complianceSummary?.prosem.status || "")}`}>
              {complianceSummary?.prosem.percentage}%
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Target / Actual:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {complianceSummary?.prosem.actual ?? 0} / {complianceSummary?.prosem.target ?? 0}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500" 
                style={{ width: `${complianceSummary?.prosem.percentage ?? 0}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            Belum Membuat: <strong className="text-rose-600">{complianceSummary?.prosem.missing ?? 0} Prosem</strong>
          </div>
        </div>

        {/* 3. MODUL AJAR */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-700 dark:text-zinc-200">3. Modul Ajar / RPP</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeClass(complianceSummary?.modulAjar.status || "")}`}>
              {complianceSummary?.modulAjar.percentage}%
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Target / Actual:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {complianceSummary?.modulAjar.actual ?? 0} / {complianceSummary?.modulAjar.target ?? 0}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-600 rounded-full transition-all duration-500" 
                style={{ width: `${complianceSummary?.modulAjar.percentage ?? 0}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] text-slate-400 font-medium">
            Belum Membuat: <strong className="text-rose-600">{complianceSummary?.modulAjar.missing ?? 0} Modul</strong>
          </div>
        </div>

        {/* 4. JURNAL MENGAJAR (SSOT) */}
        <div 
          onClick={() => {
            if (comparisonDetails && comparisonDetails.missingJournals.length > 0) {
              setDrilldownModal({
                isOpen: true,
                title: "Daftar Sesi Mengajar Belum Diisi Jurnal",
                items: comparisonDetails.missingJournals
              });
            }
          }}
          className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs space-y-3 flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition-all group"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-700 dark:text-zinc-200">4. Jurnal Mengajar (SSOT)</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getBadgeClass(complianceSummary?.jurnalMengajar.status || "")}`}>
              {complianceSummary?.jurnalMengajar.percentage}%
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Target Sesi / Isi:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {complianceSummary?.jurnalMengajar.actual ?? 0} / {complianceSummary?.jurnalMengajar.target ?? 0}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                style={{ width: `${complianceSummary?.jurnalMengajar.percentage ?? 0}%` }}
              />
            </div>
          </div>
          <div className="text-[10px] font-bold text-rose-600 flex items-center justify-between">
            <span>⚠️ Belum Terisi: {complianceSummary?.jurnalMengajar.missing ?? 0} Sesi</span>
            <span className="text-indigo-600 text-[9px] group-hover:underline">Drilldown &rarr;</span>
          </div>
        </div>
      </div>

      {/* SYSTEM RECOMMENDATIONS & ON-TIME INDICATOR PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECOMMENDATIONS */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-600" />
            <h3 className="font-black text-slate-800 dark:text-white text-sm">Rekomendasi & Temuan Kepala Sekolah</h3>
          </div>
          
          <div className="space-y-2.5">
            {recommendations.length > 0 ? (
              recommendations.map((rec, idx) => (
                <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs font-medium text-slate-700 dark:text-zinc-300 flex items-start gap-2.5">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>{rec}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">Belum ada temuan signifikan.</p>
            )}
          </div>
        </div>

        {/* ON-TIME FILLING STATS */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-slate-800 dark:text-white text-sm">Indikator Ketepatan Waktu Jurnal</h3>
            </div>
            <p className="text-[11px] text-slate-400">Pengisian jurnal idealnya diisi &le; 24 jam setelah sesi mengajar.</p>
          </div>

          <div className="space-y-3 bg-amber-50/40 dark:bg-zinc-950/40 p-4 rounded-2xl border border-amber-100 dark:border-zinc-800">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-500 font-medium">Rasio Tepat Waktu</span>
              <span className="text-2xl font-black text-amber-600">{complianceSummary?.onTimePercentage ?? 100}%</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-slate-100 dark:border-zinc-800 flex justify-between">
                <span className="text-slate-500">Tepat Waktu:</span>
                <span className="font-bold text-emerald-600">{complianceSummary?.totalOnTimeJournals ?? 0}</span>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-slate-100 dark:border-zinc-800 flex justify-between">
                <span className="text-slate-500">Terlambat (&gt;24j):</span>
                <span className="font-bold text-rose-600">{complianceSummary?.totalLateJournals ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MONTHLY TREND CHART */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm">Grafik Tren Kepatuhan Administrasi Bulanan</h3>
            <p className="text-[11px] text-slate-400">Membandingkan Target Sesi vs Jurnal Terisi vs Belum Terisi per Bulan</p>
          </div>
          <TrendingUp className="w-5 h-5 text-indigo-600" />
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="monthName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="expectedSessions" name="Target Sesi" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="actualJournals" name="Jurnal Terisi" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              <Bar dataKey="missingJournals" name="Belum Terisi" fill="#e11d48" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* RANKING & KPI TABEL ADMINISTRASI GURU */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm">Ranking KPI Kepatuhan Administrasi Guru</h3>
            <p className="text-[11px] text-slate-400">Peringkat skor administrasi gabungan Prota (20%), Prosem (20%), Modul (20%), Jurnal (20%), Ketepatan Waktu (20%)</p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs w-48"
            />
          </div>
        </div>

        {/* RANKING TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400 bg-slate-50/50 dark:bg-zinc-800/30">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Nama Guru</th>
                <th className="py-3 px-3 text-center">Prota</th>
                <th className="py-3 px-3 text-center">Prosem</th>
                <th className="py-3 px-3 text-center">Modul</th>
                <th className="py-3 px-3 text-center">Jurnal SSOT</th>
                <th className="py-3 px-3 text-center">Tepat Waktu</th>
                <th className="py-3 px-3 text-center">Total Skor</th>
                <th className="py-3 px-3 text-center">Kategori</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs font-medium">
              {filteredRankings.length > 0 ? (
                filteredRankings.map((r, idx) => (
                  <tr key={r.teacherId} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 dark:text-zinc-200">{r.teacherName}</div>
                      {r.niy && <div className="text-[10px] text-slate-400">NIY/NIP: {r.niy}</div>}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-zinc-300">{r.protaScore}%</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-zinc-300">{r.prosemScore}%</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-zinc-300">{r.modulScore}%</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-zinc-300">{r.jurnalScore}%</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-700 dark:text-zinc-300">{r.onTimeRate}%</td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{r.totalScore}</span>
                      <span className="text-[10px] text-slate-400">/100</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md border ${getBadgeClass(r.category)}`}>
                        {r.category}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-xs text-slate-400">
                    Tidak ada data guru yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRILLDOWN MODAL */}
      {drilldownModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm">{drilldownModal.title}</h3>
                <p className="text-[11px] text-slate-400">Rincian detail sesi mengajar yang belum terisi jurnalnya.</p>
              </div>
              <button
                onClick={() => setDrilldownModal({ isOpen: false, title: "", items: [] })}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {drilldownModal.items.length > 0 ? (
                drilldownModal.items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-zinc-200">{item.teacherName}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {item.date} | Kelas {item.className} | {item.subjectName} ({item.period})
                      </div>
                    </div>
                    <span className="text-[10px] font-black uppercase text-rose-700 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-md">
                      {item.complianceStatus}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-slate-400 py-6">Tidak ada item drilldown.</p>
              )}
            </div>

            <button
              onClick={() => setDrilldownModal({ isOpen: false, title: "", items: [] })}
              className="w-full py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
            >
              Tutup Rincian
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
