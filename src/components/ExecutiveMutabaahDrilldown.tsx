import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  TrendingUp,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Printer,
  Download,
  X,
  Lock,
  Eye,
  FileText,
  CalendarDays,
  ChevronRight,
  Heart,
  Check,
  AlertTriangle,
  Info
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import {
  executiveMutabaahService,
  ExecutiveMutabaahFilter,
  ExecutiveMutabaahRecord,
  ExecutiveMutabaahReport
} from "../services/executiveMutabaahService";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { mutabaahService } from "../services/mutabaahService";
import { SdmMutabaahIndicator, SdmMutabaahEntry } from "../types/mutabaah.types";

interface ExecutiveMutabaahDrilldownProps {
  initialStatusFilter?: string; // e.g. "Belum Mengisi", "Terlambat", "Lengkap"
  onClose?: () => void;
  isModal?: boolean;
}

export const ExecutiveMutabaahDrilldown: React.FC<ExecutiveMutabaahDrilldownProps> = ({
  initialStatusFilter,
  onClose,
  isModal = false
}) => {
  // Get Today's Date String YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  }, []);

  // Filter States
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("ALL");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter || "ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Selected Detail Record for Read-Only Modal
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<ExecutiveMutabaahRecord | null>(null);

  // Reference Queries
  const { data: academicYears = [] } = useQuery({
    queryKey: ["execMutabaahAcademicYears"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["execMutabaahSemesters"],
    queryFn: () => semesterService.getSemesters()
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["execMutabaahTeachers"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["execMutabaahSubjects"],
    queryFn: () => subjectService.getSubjects()
  });

  const { data: indicators = [] } = useQuery<SdmMutabaahIndicator[]>({
    queryKey: ["execMutabaahIndicators"],
    queryFn: () => mutabaahService.getIndicators()
  });

  // Filter object compiled for service
  const filterObj: ExecutiveMutabaahFilter = useMemo(() => ({
    academicYearId: selectedAcademicYear,
    semesterId: selectedSemester,
    startDate,
    endDate,
    teacherId: selectedTeacher,
    subjectId: selectedSubject,
    role: selectedRole,
    status: selectedStatus,
    searchQuery
  }), [
    selectedAcademicYear,
    selectedSemester,
    startDate,
    endDate,
    selectedTeacher,
    selectedSubject,
    selectedRole,
    selectedStatus,
    searchQuery
  ]);

  // Main Report Query
  const {
    data: report,
    isLoading,
    refetch
  } = useQuery<ExecutiveMutabaahReport>({
    queryKey: ["executiveMutabaahReport", filterObj],
    queryFn: () => executiveMutabaahService.getExecutiveReport(filterObj)
  });

  const summary = report?.summary;
  const records = report?.records || [];
  const stats = report?.stats;

  // Pagination calculation
  const totalPages = Math.ceil(records.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [records, currentPage]);

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Lengkap":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
      case "Belum Lengkap":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800";
      case "Terlambat":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800";
      case "Belum Mengisi":
      default:
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    }
  };

  // CSV Export Helper
  const exportToCsv = () => {
    if (!records || records.length === 0) return;

    const headers = [
      "No",
      "Nama Guru",
      "NIY/NIP",
      "Mata Pelajaran",
      "Jabatan",
      "Tanggal",
      "Status Pengisian",
      "Jam Pengisian",
      "Persentase Kelengkapan (%)",
      "Skor Mutabaah"
    ];

    const rows = records.map((r, i) => [
      i + 1,
      `"${r.teacherName}"`,
      `"${r.niy || "-"}"`,
      `"${r.subjectName}"`,
      `"${r.role}"`,
      `"${r.date}"`,
      `"${r.status}"`,
      `"${r.submissionTime}"`,
      r.completenessPercentage,
      r.mutabaahScore
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Mutabaah_Guru_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`space-y-6 ${isModal ? "p-2" : ""}`}>
      {/* EXECUTIVE HEADER BANNER & READ-ONLY GUARD */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/50 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-300 bg-white/10 px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1">
                <Shield className="w-3 h-3 text-indigo-400" /> Executive Drilldown
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1">
                <Lock className="w-3 h-3 text-amber-300" /> Mode Baca Saja (Read Only)
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-white">
              Executive Drilldown Mutabaah Guru
            </h2>
            <p className="text-xs text-slate-300">
              Pemantauan Kepatuhan Mutabaah Harian Asatidz & Ustadzah (Kepala Sekolah, Ketua Yayasan & Waka Kurikulum).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportToCsv}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PDF</span>
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* COMPREHENSIVE FILTER CONTROLS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tahun Ajaran</label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            >
              <option value="">Semua Tahun Ajaran</option>
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
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            >
              <option value="">Semua Semester</option>
              {semesters.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dari Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pilih Guru</label>
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            >
              <option value="ALL">Semua Guru ({teachers.length})</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Mata Pelajaran</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            >
              <option value="ALL">Semua Mapel</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status Pengisian</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-slate-800 text-white border border-slate-700 rounded-xl p-2 font-semibold"
            >
              <option value="ALL">Semua Status</option>
              <option value="Lengkap">Lengkap</option>
              <option value="Belum Lengkap">Belum Lengkap</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Belum Mengisi">Belum Mengisi</option>
            </select>
          </div>
        </div>
      </div>

      {/* MONITORING KEPATUHAN SUMMARY CARDS (CLICKABLE DRILLDOWN) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Guru */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-slate-400">Jumlah Guru</span>
          <div className="text-2xl font-black text-slate-800 dark:text-white">
            {summary?.totalTeachers ?? 0}
          </div>
          <p className="text-[10px] text-slate-400">Total Terdaftar</p>
        </div>

        {/* Sudah Mengisi */}
        <div
          onClick={() => setSelectedStatus("Lengkap")}
          className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 p-4 rounded-2xl shadow-2xs space-y-1 cursor-pointer hover:bg-emerald-100/60 transition-all group"
        >
          <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Sudah Mengisi</span>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {summary?.filledCount ?? 0}
          </div>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold group-hover:underline">Klik Filter &rarr;</p>
        </div>

        {/* Belum Mengisi */}
        <div
          onClick={() => setSelectedStatus("Belum Mengisi")}
          className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-2xl shadow-2xs space-y-1 cursor-pointer hover:bg-rose-100/60 transition-all group"
        >
          <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400">Belum Mengisi</span>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
            {summary?.unfilledCount ?? 0}
          </div>
          <p className="text-[10px] text-rose-600 dark:text-rose-400 font-bold group-hover:underline">Klik Filter &rarr;</p>
        </div>

        {/* Persentase Keterisian */}
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[10px] font-black uppercase text-indigo-100">Keterisian</span>
          <div className="text-2xl font-black">
            {summary?.fillRatePercentage ?? 0}%
          </div>
          <p className="text-[10px] text-indigo-100">Rata-rata Periode</p>
        </div>

        {/* Guru Terlambat */}
        <div
          onClick={() => setSelectedStatus("Terlambat")}
          className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 p-4 rounded-2xl shadow-2xs space-y-1 cursor-pointer hover:bg-purple-100/60 transition-all group"
        >
          <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400">Terlambat Mengisi</span>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
            {summary?.lateCount ?? 0}
          </div>
          <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold group-hover:underline">Klik Filter &rarr;</p>
        </div>

        {/* Guru Konsisten */}
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 p-4 rounded-2xl shadow-2xs space-y-1">
          <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Guru Konsisten</span>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
            {summary?.consistentCount ?? 0}
          </div>
          <p className="text-[10px] text-amber-600 dark:text-amber-400">Konsistensi &ge;90%</p>
        </div>
      </div>

      {/* STATISTIK WIDGETS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TOP 10 GURU PALING DISIPLIN */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-slate-800 dark:text-white text-xs">Top 10 Guru Paling Disiplin</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">Rank</span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {stats?.topDisciplinedTeachers && stats.topDisciplinedTeachers.length > 0 ? (
              stats.topDisciplinedTeachers.map((t, idx) => (
                <div key={t.userId} className="p-2.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                      idx === 0 ? "bg-amber-500 text-white" : idx === 1 ? "bg-slate-300 text-slate-800" : idx === 2 ? "bg-amber-700 text-white" : "bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}>
                      {idx + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white">{t.teacherName}</div>
                      <div className="text-[10px] text-slate-400">{t.subjectName}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-emerald-600">{t.avgPercentage}%</div>
                    <div className="text-[9px] text-slate-400">{t.totalFilled} hari terisi</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Belum ada data kedisiplinan guru.</p>
            )}
          </div>
        </div>

        {/* GURU BELUM MENGISI HARI INI */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              <h3 className="font-black text-slate-800 dark:text-white text-xs">Guru Belum Mengisi Hari Ini</h3>
            </div>
            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
              {stats?.unfilledTodayTeachers?.length ?? 0} Guru
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {stats?.unfilledTodayTeachers && stats.unfilledTodayTeachers.length > 0 ? (
              stats.unfilledTodayTeachers.map((t) => (
                <div key={t.userId} className="p-2.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">{t.teacherName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">{t.role} • {t.subjectName}</div>
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-md">
                    Belum Mengisi
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-emerald-600 font-bold text-center py-6">Alhamdulillah! Seluruh guru telah mengisi Mutabaah hari ini.</p>
            )}
          </div>
        </div>

        {/* GURU TERLAMBAT MENGISI */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-500" />
              <h3 className="font-black text-slate-800 dark:text-white text-xs">Guru Terlambat Mengisi</h3>
            </div>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
              {stats?.lateTeachers?.length ?? 0} Catatan
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {stats?.lateTeachers && stats.lateTeachers.length > 0 ? (
              stats.lateTeachers.map((t, idx) => (
                <div key={idx} className="p-2.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-white">{t.teacherName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{t.date} • Jam {t.submissionTime}</div>
                  </div>
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-md">
                    {t.completenessPercentage}%
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">Tidak ada catatan pengisian terlambat pada periode ini.</p>
            )}
          </div>
        </div>
      </div>

      {/* TREND GRAPH CHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DAILY TREND */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-xs">Persentase Pengisian per Hari</h3>
              <p className="text-[10px] text-slate-400">Tingkat kepatuhan harian pada rentang tanggal terpilih</p>
            </div>
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.dailyTrend || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", fontSize: "11px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="percentage" name="Kepatuhan (%)" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {(stats?.dailyTrend || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.percentage >= 80 ? "#10b981" : entry.percentage >= 50 ? "#f59e0b" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* MONTHLY TREND */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-slate-800 dark:text-white text-xs">Persentase Pengisian per Bulan</h3>
              <p className="text-[10px] text-slate-400">Perbandingan rata-rata pengisian bulanan</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.monthlyTrend || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", fontSize: "11px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                />
                <Bar dataKey="percentage" name="Kepatuhan (%)" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TABLE RINGKASAN REKAPITULASI MUTABAAH */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-150 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-slate-800 dark:text-white text-sm">
              Tabel Rincian Mutabaah Guru (Executive View)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Menampilkan {records.length} data laporan mutabaah sesuai filter yang dipilih.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari guru, mapel, tanggal..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs w-60"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 font-black uppercase text-slate-400 bg-slate-50/60 dark:bg-zinc-800/40 text-[10px]">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Nama Guru</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4">Jabatan</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4 text-center">Status Pengisian</th>
                <th className="py-3 px-4 text-center">Jam Pengisian</th>
                <th className="py-3 px-4 text-center">Kelengkapan</th>
                <th className="py-3 px-4 text-center">Skor</th>
                <th className="py-3 px-4 text-center">Aksi (Read Only)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Memuat data Mutabaah Guru...
                  </td>
                </tr>
              ) : paginatedRecords.length > 0 ? (
                paginatedRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-400">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 dark:text-white">{r.teacherName}</div>
                      <div className="text-[10px] text-slate-400">NIY: {r.niy}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 font-semibold">{r.subjectName}</td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400">{r.role}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-zinc-300">{r.date}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-1 rounded-md font-bold text-[10px] border ${getStatusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-zinc-300">
                      {r.submissionTime}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="font-bold text-slate-800 dark:text-white">{r.completenessPercentage}%</div>
                      <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full mx-auto overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${r.completenessPercentage}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      {r.mutabaahScore}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {r.rawEntry ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDetailRecord(r)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 dark:text-indigo-300 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat Detail</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Belum Mengisi</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Tidak ada data mutabaah ditemukan untuk kriteria filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="p-4 border-t border-slate-150 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
          <div>
            Menampilkan {records.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} - {Math.min(currentPage * pageSize, records.length)} dari {records.length} data
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              Sebelumnya
            </button>
            <span className="font-bold text-slate-700 dark:text-zinc-200">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* DETAIL MUTABAAH READ-ONLY MODAL */}
      {selectedDetailRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">Detail Mutabaah Harian Guru</h3>
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                    🔒 Read Only Mode
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Guru: <strong className="text-white">{selectedDetailRecord.teacherName}</strong> | Tanggal: <strong className="text-white font-mono">{selectedDetailRecord.date}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Profile & Score Card */}
              <div className="bg-slate-50 dark:bg-zinc-800/70 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-700 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Mata Pelajaran</span>
                  <div className="font-bold text-slate-800 dark:text-white mt-0.5">{selectedDetailRecord.subjectName}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Jam Pengisian</span>
                  <div className="font-bold text-slate-800 dark:text-white mt-0.5 font-mono">{selectedDetailRecord.submissionTime}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Status Pengisian</span>
                  <div className="mt-0.5">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${getStatusBadge(selectedDetailRecord.status)}`}>
                      {selectedDetailRecord.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Persentase</span>
                  <div className="font-black text-indigo-600 dark:text-indigo-400 text-sm mt-0.5">
                    {selectedDetailRecord.completenessPercentage}%
                  </div>
                </div>
              </div>

              {/* Mutabaah Values Rendered Grouped by Category */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-800 dark:text-white text-xs border-b border-slate-200 dark:border-zinc-800 pb-2 flex items-center justify-between">
                  <span>Isi Mutabaah Guru</span>
                  <span className="text-[10px] font-normal text-slate-400">Format Isian Sesuai Indikator Aktif</span>
                </h4>

                {(() => {
                  const values = selectedDetailRecord.rawEntry?.values || {};
                  
                  // Group indicators by category
                  const categories = Array.from(new Set(indicators.map(i => i.category || "Ibadah Wajib")));

                  return categories.map(cat => {
                    const catIndicators = indicators.filter(i => (i.category || "Ibadah Wajib") === cat && i.isActive);
                    if (catIndicators.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-2">
                        <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                          {cat}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {catIndicators.map(ind => {
                            const val = values[ind.id];
                            const isFilled = val !== undefined && val !== null && val !== false && val !== "";

                            let displayVal = "-";
                            if (ind.inputType === "boolean") {
                              displayVal = val ? "✅ Ya / Dilaksanakan" : "❌ Tidak";
                            } else if (ind.inputType === "prayers_5" && typeof val === "object") {
                              const subPrayers = ["Subuh", "Dzuhur", "Ashar", "Maghrib", "Isya"];
                              const count = subPrayers.filter(p => val[p] === true).length;
                              displayVal = `${count}/5 Waktu (${subPrayers.filter(p => val[p]).join(", ") || "Belum"})`;
                            } else if (val !== undefined && val !== null) {
                              displayVal = `${val} ${ind.unit || ""}`;
                            }

                            return (
                              <div
                                key={ind.id}
                                className={`p-3 rounded-xl border flex items-center justify-between ${
                                  isFilled
                                    ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/30"
                                    : "bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-800 text-slate-400"
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-zinc-200 text-xs">{ind.name}</div>
                                  <div className="text-[10px] text-slate-400">Target: {ind.target} {ind.unit}</div>
                                </div>
                                <div className="text-right font-extrabold text-xs text-indigo-700 dark:text-indigo-300">
                                  {displayVal}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* History / Modification Log if any */}
              {selectedDetailRecord.rawEntry?.history && selectedDetailRecord.rawEntry.history.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <h4 className="font-bold text-slate-800 dark:text-white text-xs">Riwayat Perubahan Isian</h4>
                  <div className="space-y-1 text-[11px] text-slate-500">
                    {selectedDetailRecord.rawEntry.history.map((h, i) => (
                      <div key={i} className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg flex justify-between">
                        <span>Diperbarui oleh <strong>{h.updatedBy}</strong></span>
                        <span className="font-mono text-[10px]">{h.timestamp}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-500" /> Mode hanya baca untuk Kepala Sekolah / Yayasan.
              </span>
              <button
                type="button"
                onClick={() => setSelectedDetailRecord(null)}
                className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
