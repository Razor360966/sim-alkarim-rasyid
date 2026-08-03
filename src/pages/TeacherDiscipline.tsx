import React, { useState, useEffect, useMemo } from "react";
import { 
  Award, 
  BookOpen, 
  Calendar, 
  CalendarDays, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Filter, 
  Grid, 
  Info, 
  AlertTriangle, 
  Printer, 
  RefreshCw, 
  Search, 
  Shield, 
  TrendingDown, 
  TrendingUp, 
  User, 
  Users, 
  XCircle, 
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { classService } from "../services/classService";
import { 
  teacherDisciplineService, 
  TeacherDisciplineMetric, 
  SchoolDisciplineSummary, 
  DisciplineHistoryRecord, 
  SystemDisciplineRecommendation,
  getDisciplineCategory 
} from "../services/teacherDiscipline.service";
import { AcademicYear, Semester, Teacher, Subject, Class } from "../types";
import * as XLSX from "xlsx";

export const TeacherDisciplinePage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();

  // Role permissions
  const userRole = (activeRole || user?.role || "").toLowerCase();
  const isIndividualTeacher = userRole === "guru" && user?.teacherId;
  const canManage = ["admin", "kepala sekolah", "wakil kepala sekolah", "pimpinan", "operator", "ketua yayasan"].includes(userRole);

  // Filter States
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(isIndividualTeacher && user?.teacherId ? user.teacherId : "ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tab State
  const [activeTab, setActiveTab] = useState<"kpi" | "table" | "charts" | "rankings" | "history" | "recommendations">("kpi");

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSnapshotting, setIsSnapshotting] = useState<boolean>(false);

  // Data States
  const [metrics, setMetrics] = useState<TeacherDisciplineMetric[]>([]);
  const [summary, setSummary] = useState<SchoolDisciplineSummary>({
    totalTeachers: 0,
    sangatDisiplinCount: 0,
    disiplinCount: 0,
    cukupDisiplinCount: 0,
    perluPembinaanCount: 0,
    pembinaanKhususCount: 0,
    avgSchoolDisciplineScore: 100,
    schoolDisciplinePercentage: 100,
    avgAttendanceRate: 100,
    avgOnTimeCheckInRate: 100,
    avgOnTimeCheckOutRate: 100,
    totalIncompleteCheckouts: 0,
    totalLateIncidents: 0
  });
  const [recommendations, setRecommendations] = useState<SystemDisciplineRecommendation[]>([]);
  const [histories, setHistories] = useState<DisciplineHistoryRecord[]>([]);

  // Modal State
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [selectedTeacherDetail, setSelectedTeacherDetail] = useState<TeacherDisciplineMetric | null>(null);

  // Initial Data Fetch
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        setIsLoading(true);
        const [aYears, tList, sList, cList] = await Promise.all([
          academicYearService.getAcademicYears(),
          teacherService.getTeachers(),
          subjectService.getSubjects(),
          classService.getClasses()
        ]);

        setAcademicYears(aYears);
        setTeachers(tList);
        setSubjects(sList);
        setClasses(cList);

        const activeAY = aYears.find(a => a.isActive) || aYears[0];
        if (activeAY) {
          setSelectedYearId(activeAY.id);
          const semList = await semesterService.getSemesters();
          setSemesters(semList);
          const activeSem = semList.find(s => s.isActive) || semList[0];
          if (activeSem) {
            setSelectedSemesterId(activeSem.id);
          }
        }
      } catch (err) {
        console.error("Error fetching master data:", err);
        toast("Gagal memuat data referensi kedisiplinan", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMasterData();
  }, []);

  // When selected academic year changes, load semesters
  useEffect(() => {
    if (selectedYearId) {
      semesterService.getSemesters().then(semList => {
        setSemesters(semList);
        if (semList.length > 0 && !semList.some(s => s.id === selectedSemesterId)) {
          const activeSem = semList.find(s => s.isActive) || semList[0];
          setSelectedSemesterId(activeSem.id);
        }
      });
    }
  }, [selectedYearId]);

  // Load Discipline Data based on filters
  const loadDisciplineData = async () => {
    try {
      setIsLoading(true);
      const activeAY = academicYears.find(a => a.id === selectedYearId);
      const activeSem = semesters.find(s => s.id === selectedSemesterId);

      const res = await teacherDisciplineService.getDisciplineMetrics({
        academicYearId: selectedYearId,
        academicYearName: activeAY?.name || activeAY?.year,
        semesterId: selectedSemesterId,
        semesterName: activeSem?.name,
        monthStr: selectedMonth,
        teacherId: isIndividualTeacher && user?.teacherId ? user.teacherId : selectedTeacherId,
        subjectId: selectedSubjectId,
        classId: selectedClassId
      });

      setMetrics(res.metrics);
      setSummary(res.summary);
      setRecommendations(res.recommendations);

      // Load History
      const historyData = await teacherDisciplineService.getDisciplineHistory(isIndividualTeacher && user?.teacherId ? user.teacherId : selectedTeacherId);
      setHistories(historyData);
    } catch (err) {
      console.error("Error loading discipline data:", err);
      toast("Gagal memuat analisis kedisiplinan", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedYearId && selectedSemesterId) {
      loadDisciplineData();
    }
  }, [selectedYearId, selectedSemesterId, selectedMonth, selectedTeacherId, selectedSubjectId, selectedClassId]);

  // Filtered metrics for display
  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      const matchSearch = m.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) || (m.niy && m.niy.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchCategory = selectedCategory === "ALL" || m.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [metrics, searchQuery, selectedCategory]);

  // Handle Save History Snapshot
  const handleSaveSnapshot = async () => {
    try {
      setIsSnapshotting(true);
      const activeAY = academicYears.find(a => a.id === selectedYearId);
      const activeSem = semesters.find(s => s.id === selectedSemesterId);

      for (const m of metrics) {
        await teacherDisciplineService.saveDisciplineSnapshot({
          teacherId: m.teacherId,
          teacherName: m.teacherName,
          academicYearId: selectedYearId,
          academicYearName: activeAY?.name || activeAY?.year || "2025/2026",
          semesterId: selectedSemesterId,
          semesterName: activeSem?.name || "Ganjil",
          monthStr: selectedMonth !== "ALL" ? selectedMonth : new Date().toISOString().slice(0, 7),
          periodType: selectedMonth !== "ALL" ? "monthly" : "semester",
          disciplineScore: m.disciplineScore,
          category: m.category,
          attendancePercentage: m.attendancePercentage,
          checkInOnTimePercentage: m.checkInOnTimePercentage,
          checkOutOnTimePercentage: m.checkOutOnTimePercentage,
          totalTerlambat: m.totalTerlambat,
          totalAlpha: m.totalAlpha,
          totalIncompleteCheckout: m.totalIncompleteCheckout,
          avgLateMinutes: m.avgLateMinutes,
          trendStatus: m.trendStatus || "Stabil"
        });
      }

      toast("Riwayat kedisiplinan berhasil disimpan permanen ke database!", "success");
      const updatedHistories = await teacherDisciplineService.getDisciplineHistory(selectedTeacherId);
      setHistories(updatedHistories);
    } catch (err) {
      console.error("Error saving discipline snapshot:", err);
      toast("Gagal menyimpan riwayat kedisiplinan", "error");
    } finally {
      setIsSnapshotting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const activeAY = academicYears.find(a => a.id === selectedYearId);
      const activeSem = semesters.find(s => s.id === selectedSemesterId);

      const excelData = filteredMetrics.map((m, idx) => ({
        "No": idx + 1,
        "Nama Guru": m.teacherName,
        "NIY / NUPTK": m.niy || "-",
        "Target Session": m.totalScheduledSessions,
        "Realisasi Session": m.totalRealizedSessions,
        "Hadir": m.totalHadir,
        "Terlambat": m.totalTerlambat,
        "Alpha": m.totalAlpha,
        "Izin / Sakit": m.totalIzin,
        "Tugas Dinas": m.totalTugasDinas,
        "Check-out Tidak Lengkap": m.totalIncompleteCheckout,
        "Rata-rata Keterlambatan (Menit)": m.avgLateMinutes,
        "Kehadiran (%)": `${m.attendancePercentage}%`,
        "Ketepatan Check-in (%)": `${m.checkInOnTimePercentage}%`,
        "Ketepatan Check-out (%)": `${m.checkOutOnTimePercentage}%`,
        "Skor Kedisiplinan": m.disciplineScore,
        "Kategori": m.category,
        "Tren": m.trendStatus || "Stabil"
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Kedisiplinan Guru");

      const fileName = `Laporan_Kedisiplinan_Guru_${(activeAY?.name || "TA").replace("/", "-")}_${activeSem?.name || "Sem"}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast("Laporan kedisiplinan berhasil diunduh (Excel)", "success");
    } catch (err) {
      console.error("Excel export error:", err);
      toast("Gagal mengunduh berkas Excel", "error");
    }
  };

  // Category Colors
  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "Sangat Disiplin":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "Disiplin":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800";
      case "Cukup Disiplin":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "Perlu Pembinaan":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "Pembinaan Khusus":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300";
    }
  };

  // Chart Data Preparation
  const categoryPieData = [
    { name: "Sangat Disiplin", value: summary.sangatDisiplinCount, color: "#10b981" },
    { name: "Disiplin", value: summary.disiplinCount, color: "#6366f1" },
    { name: "Cukup Disiplin", value: summary.cukupDisiplinCount, color: "#f59e0b" },
    { name: "Perlu Pembinaan", value: summary.perluPembinaanCount, color: "#f97316" },
    { name: "Pembinaan Khusus", value: summary.pembinaanKhususCount, color: "#f43f5e" }
  ].filter(d => d.value > 0);

  const top10Disciplined = [...metrics].sort((a, b) => b.disciplineScore - a.disciplineScore).slice(0, 10);
  const top10Late = [...metrics].sort((a, b) => b.totalTerlambat - a.totalTerlambat).slice(0, 10);
  const top10IncompleteCheckout = [...metrics].sort((a, b) => b.totalIncompleteCheckout - a.totalIncompleteCheckout).slice(0, 10);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.25),transparent_70%)] pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold mb-3 border border-indigo-500/30">
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>Analisis Otomatis QR Check-in / Check-out</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Kedisiplinan Guru & Staf
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-2xl">
              Evaluasi objektif berdasarkan persentase kehadiran, ketepatan waktu check-in, check-out, dan kelengkapan sesi mengajar tanpa penilaian manual.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              Laporan Rapat Bulanan Guru
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            {canManage && (
              <button
                onClick={handleSaveSnapshot}
                disabled={isSnapshotting}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isSnapshotting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Award className="h-4 w-4" />}
                Simpan Snapshot Histori
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Global Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
          <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          <span>Filter Global Kedisiplinan:</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* Academic Year */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Tahun Ajaran
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>
                  {ay.name || ay.year} {ay.status === "Aktif" ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Semester
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === "Aktif" ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Bulan
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Bulan</option>
              <option value="2026-07">Juli 2026</option>
              <option value="2026-08">Agustus 2026</option>
              <option value="2026-09">September 2026</option>
              <option value="2026-10">Oktober 2026</option>
              <option value="2026-11">November 2026</option>
              <option value="2026-12">Desember 2026</option>
              <option value="2027-01">Januari 2027</option>
              <option value="2027-02">Februari 2027</option>
              <option value="2027-03">Maret 2027</option>
              <option value="2027-04">April 2027</option>
              <option value="2027-05">Mei 2027</option>
              <option value="2027-06">Juni 2027</option>
            </select>
          </div>

          {/* Teacher */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Guru / Staf
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isIndividualTeacher}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            >
              {!isIndividualTeacher && <option value="ALL">Semua Guru ({teachers.length})</option>}
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Mapel</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Kelas
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-zinc-500 block mb-1">
              Kategori
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Sangat Disiplin">Sangat Disiplin (96-100)</option>
              <option value="Disiplin">Disiplin (86-95)</option>
              <option value="Cukup Disiplin">Cukup Disiplin (76-85)</option>
              <option value="Perlu Pembinaan">Perlu Pembinaan (61-75)</option>
              <option value="Pembinaan Khusus">Pembinaan Khusus (≤60)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        {[
          { id: "kpi", label: "Ringkasan KPI Sekolah", icon: Shield },
          { id: "table", label: "Matriks Kedisiplinan Guru", icon: Users },
          { id: "charts", label: "Grafik & Analisis Tren", icon: TrendingUp },
          { id: "rankings", label: "Peringkat & Kategori", icon: Award },
          { id: "history", label: "Riwayat Lintas Waktu", icon: CalendarDays },
          { id: "recommendations", label: "Rekomendasi Otomatis Sistem", icon: AlertTriangle, count: recommendations.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
            Menganalisis data kedisiplinan guru berdasarkan QR Check-in/Check-out...
          </p>
        </div>
      ) : (
        <div>
          {/* TAB 1: KPI RINGKASAN */}
          {activeTab === "kpi" && (
            <div className="space-y-6">
              {/* Executive Metrics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Total Guru Dievaluasi
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white mt-1">
                    {summary.totalTeachers}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-1">
                    <Users className="h-3 w-3 text-indigo-500" />
                    <span>Aktif Mengajar</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Skor Kedisiplinan
                  </div>
                  <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                    {summary.avgSchoolDisciplineScore}%
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>Kategori: {getDisciplineCategory(summary.avgSchoolDisciplineScore)}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Persentase Kehadiran
                  </div>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {summary.avgAttendanceRate}%
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                    Hadir & Tugas Dinas
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Ketepatan Check-in
                  </div>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {summary.avgOnTimeCheckInRate}%
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                    Tepat Waktu
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Ketepatan Check-out
                  </div>
                  <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
                    {summary.avgOnTimeCheckOutRate}%
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                    Check-out Lengkap
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Check-out Tidak Lengkap
                  </div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                    {summary.totalIncompleteCheckouts}
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    <span>Lupa Scan Check-out</span>
                  </div>
                </div>
              </div>

              {/* Discipline Category Breakdown Badges */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                      Distribusi Kategori Kedisiplinan Sekolah
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Berdasarkan pembobotan: Kehadiran (40%), Ketepatan Check-in (30%), Ketepatan Check-out (20%), Kelengkapan Session (10%).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Sangat Disiplin</span>
                      <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">96-100</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-2">
                      {summary.sangatDisiplinCount} Guru
                    </div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                      {summary.totalTeachers > 0 ? Math.round((summary.sangatDisiplinCount / summary.totalTeachers) * 100) : 0}% dari populasi
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Disiplin</span>
                      <span className="text-xs font-black text-indigo-700 dark:text-indigo-400">86-95</span>
                    </div>
                    <div className="text-2xl font-black text-indigo-900 dark:text-indigo-200 mt-2">
                      {summary.disiplinCount} Guru
                    </div>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1">
                      {summary.totalTeachers > 0 ? Math.round((summary.disiplinCount / summary.totalTeachers) * 100) : 0}% dari populasi
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">Cukup Disiplin</span>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">76-85</span>
                    </div>
                    <div className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-2">
                      {summary.cukupDisiplinCount} Guru
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                      {summary.totalTeachers > 0 ? Math.round((summary.cukupDisiplinCount / summary.totalTeachers) * 100) : 0}% dari populasi
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-800 dark:text-orange-300">Perlu Pembinaan</span>
                      <span className="text-xs font-black text-orange-700 dark:text-orange-400">61-75</span>
                    </div>
                    <div className="text-2xl font-black text-orange-900 dark:text-orange-200 mt-2">
                      {summary.perluPembinaanCount} Guru
                    </div>
                    <div className="text-[10px] text-orange-600 dark:text-orange-400 mt-1">
                      {summary.totalTeachers > 0 ? Math.round((summary.perluPembinaanCount / summary.totalTeachers) * 100) : 0}% dari populasi
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-800 dark:text-rose-300">Pembinaan Khusus</span>
                      <span className="text-xs font-black text-rose-700 dark:text-rose-400">≤60</span>
                    </div>
                    <div className="text-2xl font-black text-rose-900 dark:text-rose-200 mt-2">
                      {summary.pembinaanKhususCount} Guru
                    </div>
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                      {summary.totalTeachers > 0 ? Math.round((summary.pembinaanKhususCount / summary.totalTeachers) * 100) : 0}% dari populasi
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIKS TABEL DETAIL */}
          {activeTab === "table" && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:w-80">
                  <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama guru atau NIY..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full text-xs pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                  Menampilkan <span className="font-bold text-slate-800 dark:text-white">{filteredMetrics.length}</span> dari {metrics.length} guru
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-3 px-3 text-center">No</th>
                        <th className="py-3 px-4">Nama Guru & NIY</th>
                        <th className="py-3 px-3 text-center">Jadwal Sesi</th>
                        <th className="py-3 px-3 text-center">Hadir</th>
                        <th className="py-3 px-3 text-center">Terlambat</th>
                        <th className="py-3 px-3 text-center">Alpha</th>
                        <th className="py-3 px-3 text-center">Izin/Dinas</th>
                        <th className="py-3 px-3 text-center">Lupa Check-out</th>
                        <th className="py-3 px-3 text-center">Rata2 Telat</th>
                        <th className="py-3 px-3 text-center">% Kehadiran</th>
                        <th className="py-3 px-3 text-center">% Check-in</th>
                        <th className="py-3 px-3 text-center">% Check-out</th>
                        <th className="py-3 px-3 text-center">Skor Disiplin</th>
                        <th className="py-3 px-4 text-center">Kategori</th>
                        <th className="py-3 px-3 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-slate-700 dark:text-zinc-300">
                      {filteredMetrics.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs font-semibold">
                            Tidak ada data kedisiplinan guru yang sesuai dengan filter.
                          </td>
                        </tr>
                      ) : (
                        filteredMetrics.map((m, idx) => (
                          <tr key={m.teacherId} className="hover:bg-slate-50/70 dark:hover:bg-zinc-850/50 transition-colors">
                            <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-800 dark:text-white">{m.teacherName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">NIY: {m.niy || "-"}</div>
                            </td>
                            <td className="py-3 px-3 text-center font-bold">{m.totalScheduledSessions}</td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{m.totalHadir}</td>
                            <td className="py-3 px-3 text-center font-bold text-amber-600 dark:text-amber-400">{m.totalTerlambat}</td>
                            <td className="py-3 px-3 text-center font-bold text-rose-600 dark:text-rose-400">{m.totalAlpha}</td>
                            <td className="py-3 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{m.totalIzin + m.totalTugasDinas}</td>
                            <td className="py-3 px-3 text-center font-bold text-orange-600 dark:text-orange-400">{m.totalIncompleteCheckout}</td>
                            <td className="py-3 px-3 text-center font-medium">{m.avgLateMinutes} mnt</td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600">{m.attendancePercentage}%</td>
                            <td className="py-3 px-3 text-center font-bold text-blue-600">{m.checkInOnTimePercentage}%</td>
                            <td className="py-3 px-3 text-center font-bold text-purple-600">{m.checkOutOnTimePercentage}%</td>
                            <td className="py-3 px-3 text-center">
                              <div className="font-black text-sm text-indigo-600 dark:text-indigo-400">{m.disciplineScore}%</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${getCategoryBadgeClass(m.category)}`}>
                                {m.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => setSelectedTeacherDetail(m)}
                                className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300 hover:bg-indigo-100 transition-all cursor-pointer"
                                title="Lihat Detail Analisis"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GRAFIK & ANALISIS TREN */}
          {activeTab === "charts" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Pie Chart */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-indigo-600" />
                  <span>Komposisi Kategori Kedisiplinan Guru</span>
                </h3>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {categoryPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Disciplined Bar Chart */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <BarChart className="h-4 w-4 text-emerald-600" />
                  <span>Skor Kedisiplinan Guru Tertinggi (Top 10)</span>
                </h3>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={top10Disciplined} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="teacherName" type="category" width={110} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="disciplineScore" fill="#10b981" radius={[0, 4, 4, 0]} name="Skor Disiplin (%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PERINGKAT & RANKINGS */}
          {activeTab === "rankings" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Top 10 Most Disciplined */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <Award className="h-4 w-4" />
                  <span>Top 10 Guru Paling Disiplin</span>
                </div>
                <div className="space-y-2">
                  {top10Disciplined.map((m, idx) => (
                    <div key={m.teacherId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-slate-800 dark:text-white">{m.teacherName}</div>
                          <div className="text-[10px] text-slate-400">Hadir: {m.attendancePercentage}% | Check-in: {m.checkInOnTimePercentage}%</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">{m.disciplineScore}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top 10 Most Late */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
                  <Clock className="h-4 w-4" />
                  <span>Keterlambatan Terbanyak</span>
                </div>
                <div className="space-y-2">
                  {top10Late.filter(m => m.totalTerlambat > 0).map((m, idx) => (
                    <div key={m.teacherId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-slate-800 dark:text-white">{m.teacherName}</div>
                          <div className="text-[10px] text-slate-400">Rata-rata telat: {m.avgLateMinutes} menit</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-amber-600 dark:text-amber-400">{m.totalTerlambat} Kali</span>
                    </div>
                  ))}
                  {top10Late.filter(m => m.totalTerlambat > 0).length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">Tidak ada guru yang terlambat.</div>
                  )}
                </div>
              </div>

              {/* Top 10 Incomplete Checkouts */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Check-out Tidak Lengkap Terbanyak</span>
                </div>
                <div className="space-y-2">
                  {top10IncompleteCheckout.filter(m => m.totalIncompleteCheckout > 0).map((m, idx) => (
                    <div key={m.teacherId} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-black text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs text-slate-800 dark:text-white">{m.teacherName}</div>
                          <div className="text-[10px] text-slate-400">Sesi tanpa check-out</div>
                        </div>
                      </div>
                      <span className="font-black text-xs text-orange-600 dark:text-orange-400">{m.totalIncompleteCheckout} Kali</span>
                    </div>
                  ))}
                  {top10IncompleteCheckout.filter(m => m.totalIncompleteCheckout > 0).length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">Semua guru melengkapi scan check-out.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RIWAYAT LINTAS WAKTU */}
          {activeTab === "history" && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                    Histori Kedisiplinan Guru Permanen
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Memantau perkembangan kedisiplinan guru dari bulan ke bulan, semester ke semester, hingga tahun ajaran.
                  </p>
                </div>

                {canManage && (
                  <button
                    onClick={handleSaveSnapshot}
                    disabled={isSnapshotting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSnapshotting ? "Menyimpan..." : "Bekukan / Simpan Snapshot Periode Ini"}
                  </button>
                )}
              </div>

              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Nama Guru</th>
                        <th className="py-3 px-3 text-center">Tahun Ajaran / Sem</th>
                        <th className="py-3 px-3 text-center">Periode Bulan</th>
                        <th className="py-3 px-3 text-center">Skor Disiplin</th>
                        <th className="py-3 px-3 text-center">Kehadiran</th>
                        <th className="py-3 px-3 text-center">Terlambat</th>
                        <th className="py-3 px-3 text-center">Tanpa Check-out</th>
                        <th className="py-3 px-3 text-center">Kategori</th>
                        <th className="py-3 px-3 text-center">Tren</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {histories.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 text-xs font-semibold">
                            Belum ada snapshot histori yang dibekukan. Klik tombol "Simpan Snapshot Histori" di atas untuk membekukan data periode aktif.
                          </td>
                        </tr>
                      ) : (
                        histories.map((h, idx) => (
                          <tr key={h.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-800 dark:text-white">{h.teacherName}</td>
                            <td className="py-3 px-3 text-center font-medium">{h.academicYearName} ({h.semesterName})</td>
                            <td className="py-3 px-3 text-center font-mono text-[10px]">{h.monthStr || "Full"}</td>
                            <td className="py-3 px-3 text-center font-black text-indigo-600">{h.disciplineScore}%</td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-600">{h.attendancePercentage}%</td>
                            <td className="py-3 px-3 text-center font-bold text-amber-600">{h.totalTerlambat} Kali</td>
                            <td className="py-3 px-3 text-center font-bold text-orange-600">{h.totalIncompleteCheckout} Kali</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(h.category)}`}>
                                {h.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold">
                              {h.trendStatus === "Meningkat" && (
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px]">
                                  <TrendingUp className="h-3.5 w-3.5" /> Meningkat
                                </span>
                              )}
                              {h.trendStatus === "Menurun" && (
                                <span className="inline-flex items-center gap-1 text-rose-600 text-[10px]">
                                  <TrendingDown className="h-3.5 w-3.5" /> Menurun
                                </span>
                              )}
                              {h.trendStatus === "Stabil" && (
                                <span className="inline-flex items-center gap-1 text-slate-500 text-[10px]">
                                  Stabil
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: REKOMENDASI OTOMATIS SISTEM */}
          {activeTab === "recommendations" && (
            <div className="space-y-3">
              <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>Analisis Rekomendasi Berbasis Data Sistem</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Otomatis dihasilkan dari kalkulasi QR Check-in/Check-out tanpa penilaian subjektif.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {recommendations.map((rec) => {
                  let badgeBg = "bg-slate-100 text-slate-800 border-slate-200";
                  let Icon = Info;
                  if (rec.type === "success") {
                    badgeBg = "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
                    Icon = CheckCircle2;
                  } else if (rec.type === "warning") {
                    badgeBg = "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
                    Icon = AlertTriangle;
                  } else if (rec.type === "danger") {
                    badgeBg = "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
                    Icon = AlertCircle;
                  }

                  return (
                    <div key={rec.id} className={`p-4 rounded-2xl border ${badgeBg} space-y-1.5 shadow-sm`}>
                      <div className="flex items-center gap-2 font-bold text-xs">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{rec.title}</span>
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">{rec.message}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: LAPORAN RAPAT BULANAN GURU */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 bg-indigo-900 text-white flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5 text-indigo-300" />
                  <span className="font-bold text-sm">Laporan Kedisiplinan Guru — Rapat Bulanan</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Cetak / Simpan PDF
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all cursor-pointer text-slate-300 hover:text-white"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="p-8 overflow-y-auto space-y-6 text-slate-800 dark:text-zinc-100 print:p-0 print:overflow-visible">
                {/* Header Document */}
                <div className="border-b-2 border-indigo-900 pb-4 text-center">
                  <h2 className="text-xl font-black uppercase tracking-wide">SIMAK SMP ALKARIM RASYID</h2>
                  <h3 className="text-sm font-bold text-indigo-800 dark:text-indigo-400 mt-0.5">
                    LAPORAN ANALISIS KEDISIPLINAN GURU & STAF (RAPAT BULANAN)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Periode Evaluasi: {selectedMonth !== "ALL" ? selectedMonth : "Semester Aktif"} | Tahun Ajaran: {academicYears.find(a => a.id === selectedYearId)?.name || "2025/2026"}
                  </p>
                </div>

                {/* Summary Box */}
                <div className="grid grid-cols-4 gap-4 text-center border p-4 rounded-xl bg-slate-50 dark:bg-zinc-850">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Total Guru</div>
                    <div className="text-lg font-black text-slate-800 dark:text-white">{summary.totalTeachers}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Rata-rata Disiplin</div>
                    <div className="text-lg font-black text-indigo-600">{summary.avgSchoolDisciplineScore}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Kehadiran Mengajar</div>
                    <div className="text-lg font-black text-emerald-600">{summary.avgAttendanceRate}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Guru Sangat Disiplin</div>
                    <div className="text-lg font-black text-blue-600">{summary.sangatDisiplinCount}</div>
                  </div>
                </div>

                {/* Top Teachers */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-indigo-900 dark:text-indigo-300 mb-2">
                    1. Guru Teladan Kedisiplinan (Skor ≥ 95%)
                  </h4>
                  <table className="w-full text-xs text-left border border-slate-200 dark:border-zinc-800">
                    <thead className="bg-slate-100 dark:bg-zinc-800 font-bold">
                      <tr>
                        <th className="p-2 border">No</th>
                        <th className="p-2 border">Nama Guru</th>
                        <th className="p-2 border text-center">Kehadiran</th>
                        <th className="p-2 border text-center">Tepat Check-in</th>
                        <th className="p-2 border text-center">Skor Disiplin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.filter(m => m.disciplineScore >= 95).map((m, i) => (
                        <tr key={m.teacherId}>
                          <td className="p-2 border text-center">{i + 1}</td>
                          <td className="p-2 border font-bold">{m.teacherName}</td>
                          <td className="p-2 border text-center">{m.attendancePercentage}%</td>
                          <td className="p-2 border text-center">{m.checkInOnTimePercentage}%</td>
                          <td className="p-2 border text-center font-black text-emerald-600">{m.disciplineScore}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Needs Coaching */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-rose-900 dark:text-rose-400 mb-2">
                    2. Guru Perlu Pembinaan & Perhatian Khusus (Skor ≤ 75%)
                  </h4>
                  <table className="w-full text-xs text-left border border-slate-200 dark:border-zinc-800">
                    <thead className="bg-rose-50 dark:bg-rose-950/40 font-bold text-rose-900 dark:text-rose-300">
                      <tr>
                        <th className="p-2 border">No</th>
                        <th className="p-2 border">Nama Guru</th>
                        <th className="p-2 border text-center">Terlambat</th>
                        <th className="p-2 border text-center">Lupa Check-out</th>
                        <th className="p-2 border text-center">Skor Disiplin</th>
                        <th className="p-2 border">Rekomendasi Tindakan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.filter(m => m.disciplineScore <= 75).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-3 text-center text-slate-400">Tidak ada guru dalam kategori pembinaan khusus.</td>
                        </tr>
                      ) : (
                        metrics.filter(m => m.disciplineScore <= 75).map((m, i) => (
                          <tr key={m.teacherId}>
                            <td className="p-2 border text-center">{i + 1}</td>
                            <td className="p-2 border font-bold">{m.teacherName}</td>
                            <td className="p-2 border text-center font-bold text-amber-600">{m.totalTerlambat} Kali</td>
                            <td className="p-2 border text-center font-bold text-orange-600">{m.totalIncompleteCheckout} Kali</td>
                            <td className="p-2 border text-center font-black text-rose-600">{m.disciplineScore}%</td>
                            <td className="p-2 border text-slate-600">Sesi coaching Waka Kurikulum & Kepala Sekolah</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* System Recommendations */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-indigo-900 dark:text-indigo-300 mb-2">
                    3. Catatan & Rekomendasi Kepala Sekolah
                  </h4>
                  <div className="border border-slate-200 dark:border-zinc-800 p-4 rounded-xl space-y-2 text-xs">
                    {recommendations.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-start gap-2">
                        <span className="font-bold text-indigo-600">•</span>
                        <span>{r.message}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Signatures */}
                <div className="pt-8 grid grid-cols-2 text-center text-xs">
                  <div>
                    <p>Mengetahui,</p>
                    <p className="font-bold mt-1">Kepala Sekolah SMP Alkarim Rasyid</p>
                    <div className="h-16" />
                    <p className="font-bold underline">Ustadz M. Farhan, M.Pd</p>
                  </div>
                  <div>
                    <p>Dibuat Oleh,</p>
                    <p className="font-bold mt-1">Waka Bidang Kurikulum</p>
                    <div className="h-16" />
                    <p className="font-bold underline">Ustadz Ahmad Dahlan, S.Pd</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: TEACHER DETAIL */}
      <AnimatePresence>
        {selectedTeacherDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">
                    Rincian Kedisiplinan: {selectedTeacherDetail.teacherName}
                  </h3>
                  <p className="text-[10px] text-slate-400">NIY: {selectedTeacherDetail.niy || "-"}</p>
                </div>
                <button
                  onClick={() => setSelectedTeacherDetail(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                >
                  <XCircle className="h-5 w-5 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">Skor Disiplin</div>
                  <div className="text-xl font-black text-indigo-600">{selectedTeacherDetail.disciplineScore}%</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">Kategori</div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeClass(selectedTeacherDetail.category)}`}>
                    {selectedTeacherDetail.category}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">Total Sesi Terjadwal</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-white">{selectedTeacherDetail.totalScheduledSessions} Sesi</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">Kehadiran Mengajar</div>
                  <div className="text-sm font-bold text-emerald-600">{selectedTeacherDetail.attendancePercentage}% ({selectedTeacherDetail.totalHadir} Hadir)</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">Total Keterlambatan</div>
                  <div className="text-sm font-bold text-amber-600">{selectedTeacherDetail.totalTerlambat} Kali ({selectedTeacherDetail.avgLateMinutes} mnt/telat)</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">Lupa Check-out</div>
                  <div className="text-sm font-bold text-orange-600">{selectedTeacherDetail.totalIncompleteCheckout} Kali</div>
                </div>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={() => setSelectedTeacherDetail(null)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TeacherDisciplinePage;
