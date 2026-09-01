import React, { useState, useEffect, useMemo } from "react";
import { 
  Award, 
  BookOpen, 
  Calendar, 
  CalendarDays, 
  CheckCircle2, 
  ChevronDown,
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
  AlertCircle,
  Settings,
  HelpCircle,
  Check,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Layers,
  Sparkles,
  Percent,
  Calculator,
  UserCheck,
  UserX,
  Repeat
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { classService } from "../services/classService";
import { 
  teacherDisciplineService, 
  getDisciplineCategory 
} from "../services/teacherDiscipline.service";
import { 
  TeacherDisciplineMetric, 
  SchoolDisciplineSummary, 
  SystemDisciplineRecommendation,
  DisciplineWeightsConfig,
  DEFAULT_DISCIPLINE_CONFIG,
  SubjectDisciplineDetail,
  DisciplineCategory
} from "../types/teacherDiscipline.types";
import { AcademicYear, Semester, Teacher, Subject, Class } from "../types";

const CATEGORY_COLORS: Record<DisciplineCategory, string> = {
  "Sangat Disiplin": "#10b981", // Emerald
  "Disiplin": "#3b82f6",       // Blue
  "Cukup Disiplin": "#f59e0b",   // Amber
  "Perlu Pembinaan": "#f97316", // Orange
  "Pembinaan Khusus": "#ef4444" // Red
};

export const TeacherDisciplinePage: React.FC = () => {
  const { user, activeRole } = useAuth();
  const { toast } = useToast();

  // Permissions
  const userRole = (activeRole || user?.role || "").toLowerCase();
  const isIndividualTeacher = userRole === "guru" && !!user?.teacherId;
  const canManage = ["admin", "kepala sekolah", "wakil kepala sekolah", "pimpinan", "operator", "ketua yayasan"].includes(userRole);

  // Master Data States
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Filter States
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  
  // Date Range (Defaults to current month)
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState<string>(firstDayOfMonth);
  const [endDate, setEndDate] = useState<string>(lastDayOfMonth);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(isIndividualTeacher && user?.teacherId ? user.teacherId : "ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<"kpi" | "table" | "charts" | "recommendations">("kpi");
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);

  // Config & Calculation States
  const [disciplineConfig, setDisciplineConfig] = useState<DisciplineWeightsConfig>(DEFAULT_DISCIPLINE_CONFIG);
  const [tempConfig, setTempConfig] = useState<DisciplineWeightsConfig>(DEFAULT_DISCIPLINE_CONFIG);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);

  // Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Data States
  const [metrics, setMetrics] = useState<TeacherDisciplineMetric[]>([]);
  const [summary, setSummary] = useState<SchoolDisciplineSummary>({
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
  });
  const [recommendations, setRecommendations] = useState<SystemDisciplineRecommendation[]>([]);

  // Drilldown Modal States
  const [drilldownPillar, setDrilldownPillar] = useState<
    | "admin"
    | "mutabaah"
    | "attendance"
    | "auditTrail"
    | "prota"
    | "prosem"
    | "modul"
    | "jurnal"
    | null
  >(null);
  const [drilldownTargetTeacherId, setDrilldownTargetTeacherId] = useState<string | "ALL">("ALL");
  const [drilldownSelectedSubjectId, setDrilldownSelectedSubjectId] = useState<string | null>(null);
  const [drilldownSelectedComponent, setDrilldownSelectedComponent] = useState<"prota" | "prosem" | "modul" | "jurnal" | null>(null);
  const [drilldownSearchQuery, setDrilldownSearchQuery] = useState<string>("");

  // Initial Master Data Fetch
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [yearsData, semsData, teachersData, subjectsData, classesData, savedConfig] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters(),
          teacherService.getTeachers(),
          subjectService.getSubjects(),
          classService.getClasses(),
          teacherDisciplineService.getDisciplineConfig()
        ]);

        setAcademicYears(yearsData);
        setSemesters(semsData);
        setTeachers(teachersData);
        setSubjects(subjectsData);
        setClasses(classesData);
        setDisciplineConfig(savedConfig);
        setTempConfig(savedConfig);

        const activeYear = yearsData.find(y => y.isActive) || yearsData[0];
        const activeSem = semsData.find(s => s.isActive) || semsData[0];

        if (activeYear?.id) setSelectedYearId(activeYear.id);
        if (activeSem?.id) setSelectedSemesterId(activeSem.id);
      } catch (err) {
        console.error("Error loading master data:", err);
        toast("Gagal memuat data master", "error");
      }
    };
    fetchMasterData();
  }, []);

  // Recalculate Metrics when filters or config change
  const loadDisciplineData = async () => {
    if (!startDate || !endDate) return;
    setIsLoading(true);
    try {
      const activeYear = academicYears.find(y => y.id === selectedYearId);
      const activeSem = semesters.find(s => s.id === selectedSemesterId);

      const res = await teacherDisciplineService.getDisciplineMetrics({
        academicYearId: selectedYearId || undefined,
        academicYearName: activeYear?.name,
        semesterId: selectedSemesterId || undefined,
        semesterName: activeSem?.name,
        startDate,
        endDate,
        teacherId: selectedTeacherId,
        subjectId: selectedSubjectId,
        config: disciplineConfig
      });

      setMetrics(res.metrics);
      setSummary(res.summary);
      setRecommendations(res.recommendations);
    } catch (error) {
      console.error("Error calculating discipline metrics:", error);
      toast("Terjadi kesalahan saat menghitung kedisiplinan guru", "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (academicYears.length > 0) {
      loadDisciplineData();
    }
  }, [
    selectedYearId, 
    selectedSemesterId, 
    startDate, 
    endDate, 
    selectedTeacherId, 
    selectedSubjectId, 
    disciplineConfig
  ]);

  // Filtered metrics for UI rendering
  const filteredMetrics = useMemo(() => {
    return metrics.filter(m => {
      // Filter by Subject
      if (selectedSubjectId !== "ALL") {
        const hasSub = m.subjects.some(s => s.subjectId === selectedSubjectId);
        if (!hasSub) return false;
      }
      // Filter by Category
      if (selectedCategory !== "ALL" && m.category !== selectedCategory) {
        return false;
      }
      // Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = m.teacherName.toLowerCase().includes(query);
        const matchNiy = (m.niy || "").toLowerCase().includes(query);
        const matchSubject = m.subjects.some(s => s.subjectName.toLowerCase().includes(query));
        return matchName || matchNiy || matchSubject;
      }
      return true;
    });
  }, [metrics, selectedCategory, searchQuery, selectedSubjectId]);

  // Helper for single teacher view if selected
  const activeFocusMetric = useMemo(() => {
    if (selectedTeacherId !== "ALL") {
      return metrics.find(m => m.teacherId === selectedTeacherId) || null;
    }
    return null;
  }, [metrics, selectedTeacherId]);

  // Quick Date Range Setters
  const setDatePreset = (preset: "thisMonth" | "last30Days" | "thisSemester" | "lastMonth") => {
    const today = new Date();
    if (preset === "thisMonth") {
      setStartDate(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]);
      setEndDate(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0]);
    } else if (preset === "lastMonth") {
      setStartDate(new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0]);
      setEndDate(new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0]);
    } else if (preset === "last30Days") {
      const past30 = new Date(today);
      past30.setDate(today.getDate() - 30);
      setStartDate(past30.toISOString().split("T")[0]);
      setEndDate(today.toISOString().split("T")[0]);
    } else if (preset === "thisSemester") {
      const sem = semesters.find(s => s.id === selectedSemesterId);
      if (sem?.startDate && sem?.endDate) {
        setStartDate(sem.startDate);
        setEndDate(sem.endDate);
      } else {
        // Fallback 6 months
        const past6m = new Date(today);
        past6m.setMonth(today.getMonth() - 5);
        setStartDate(past6m.toISOString().split("T")[0]);
        setEndDate(today.toISOString().split("T")[0]);
      }
    }
  };

  // Save Config Handler
  const handleSaveConfig = async () => {
    const totalWeight = tempConfig.adminWeight + tempConfig.mutabaahWeight + tempConfig.attendanceWeight;
    if (totalWeight !== 100) {
      toast(`Total bobot 3 pilar harus tepat 100%! (Saat ini: ${totalWeight}%)`, "error");
      return;
    }
    const totalAdminWeight = tempConfig.protaWeight + tempConfig.prosemWeight + tempConfig.modulWeight + tempConfig.jurnalWeight;
    if (totalAdminWeight !== 100) {
      toast(`Total bobot 4 komponen Administrasi harus tepat 100%! (Saat ini: ${totalAdminWeight}%)`, "error");
      return;
    }

    try {
      await teacherDisciplineService.saveDisciplineConfig(tempConfig);
      setDisciplineConfig(tempConfig);
      setShowConfigModal(false);
      toast("Konfigurasi bobot & penalti berhasil disimpan", "success");
    } catch (err) {
      toast("Gagal menyimpan konfigurasi", "error");
    }
  };

  // Export to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Rekap Disiplin Guru
      const summaryRows = filteredMetrics.map((m, idx) => ({
        "No": idx + 1,
        "Nama Guru": m.teacherName,
        "NIY/NUPTK": m.niy,
        "Mata Pelajaran": m.subjects.map(s => s.subjectName).join(", ") || "Umum",
        "Total Target JP": m.attendance.jmlJp,
        "Kehadiran (JP)": m.attendance.kehadiranJp,
        "Terlambat (JP)": m.attendance.terlambatJp,
        "Menggantikan (JP)": m.attendance.menggantikanJp,
        "Digantikan (JP)": m.attendance.digantikanJp,
        "Skor Administrasi (%)": m.administrationScore,
        "Skor Mutabaah (%)": m.mutabaahScore,
        "Skor Kehadiran Disiplin (%)": m.attendanceScore,
        "Nilai Akhir Kedisiplinan (%)": m.finalDisciplineScore,
        "Kategori": m.category,
        "Status Tren": m.trendStatus || "Stabil"
      }));
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Rekap Kedisiplinan");

      // Sheet 2: Rincian Multi-Mapel Guru
      const mapelRows: any[] = [];
      filteredMetrics.forEach(m => {
        m.subjects.forEach(s => {
          mapelRows.push({
            "Nama Guru": m.teacherName,
            "Mata Pelajaran": s.subjectName,
            "Kelas": s.classNames.join(", "),
            "Target JP Periode": s.periodTargetJp,
            "JP Terisi Jurnal": s.realizedJp,
            "Prota (%)": s.prota.percentage,
            "Prosem (%)": s.prosem.percentage,
            "Modul Ajar (%)": s.modulAjar.percentage,
            "Jurnal Mengajar (%)": s.jurnalMengajar.percentage,
            "Nilai Administrasi Mapel (%)": s.subjectAdminScore
          });
        });
      });
      const wsMapel = XLSX.utils.json_to_sheet(mapelRows);
      XLSX.utils.book_append_sheet(wb, wsMapel, "Rincian Multi-Mapel");

      XLSX.writeFile(wb, `Laporan_Kedisiplinan_Guru_${startDate}_sd_${endDate}.xlsx`);
      toast("Laporan Excel berhasil diunduh", "success");
    } catch (error) {
      console.error("Export Excel error:", error);
      toast("Gagal mengekspor data Excel", "error");
    }
  };

  // Export to PDF (.pdf)
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF("landscape", "mm", "a4");
      const activeYear = academicYears.find(y => y.id === selectedYearId);
      const activeSem = semesters.find(s => s.id === selectedSemesterId);

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("LAPORAN EVALUASI KEDISIPLINAN GURU & GTK", 148, 16, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Tahun Ajaran: ${activeYear?.name || "-"} | Semester: ${activeSem?.name || "-"} | Periode: ${startDate} s/d ${endDate}`, 148, 23, { align: "center" });
      doc.text(`Prinsip Penilaian: Pemenuhan Kewajiban Riil & Proporsi JP (Bobot Admin ${disciplineConfig.adminWeight}%, Mutabaah ${disciplineConfig.mutabaahWeight}%, Kehadiran ${disciplineConfig.attendanceWeight}%)`, 148, 28, { align: "center" });

      doc.setDrawColor(200, 200, 200);
      doc.line(14, 32, 283, 32);

      // Table Header
      let y = 38;
      doc.setFillColor(240, 243, 246);
      doc.rect(14, y, 269, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("No", 16, y + 5.5);
      doc.text("Nama Guru", 26, y + 5.5);
      doc.text("Mapel / JP", 90, y + 5.5);
      doc.text("JML JP", 140, y + 5.5, { align: "right" });
      doc.text("Administrasi", 175, y + 5.5, { align: "right" });
      doc.text("Mutabaah", 205, y + 5.5, { align: "right" });
      doc.text("Kehadiran Disiplin", 245, y + 5.5, { align: "right" });
      doc.text("Nilai Akhir", 278, y + 5.5, { align: "right" });

      y += 10;
      doc.setFont("helvetica", "normal");

      filteredMetrics.forEach((m, idx) => {
        if (y > 185) {
          doc.addPage();
          y = 20;
        }

        const mapelSummary = m.subjects.map(s => s.subjectName).join(", ");
        const truncatedMapel = mapelSummary.length > 25 ? mapelSummary.substring(0, 23) + "..." : mapelSummary;

        doc.text(String(idx + 1), 16, y);
        doc.text(m.teacherName.length > 28 ? m.teacherName.substring(0, 26) + "..." : m.teacherName, 26, y);
        doc.text(truncatedMapel || "Umum", 90, y);
        doc.text(`${m.attendance.jmlJp} JP`, 140, y, { align: "right" });
        doc.text(`${m.administrationScore}%`, 175, y, { align: "right" });
        doc.text(`${m.mutabaahScore}%`, 205, y, { align: "right" });
        doc.text(`${m.attendanceScore}%`, 245, y, { align: "right" });
        
        doc.setFont("helvetica", "bold");
        doc.text(`${m.finalDisciplineScore}% (${m.category})`, 278, y, { align: "right" });
        doc.setFont("helvetica", "normal");

        y += 7;
      });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Dicetak pada: ${new Date().toLocaleString("id-ID")}`, 14, 200);

      doc.save(`Laporan_Kedisiplinan_Guru_${startDate}_sd_${endDate}.pdf`);
      toast("Laporan PDF berhasil dibuat", "success");
    } catch (error) {
      console.error("Export PDF error:", error);
      toast("Gagal membuat dokumen PDF", "error");
    }
  };

  // Open Drilldown Helper
  const handleOpenDrilldown = (
    pillar: "admin" | "mutabaah" | "attendance" | "auditTrail" | "prota" | "prosem" | "modul" | "jurnal",
    teacherId?: string | "ALL",
    subjectId?: string,
    component?: "prota" | "prosem" | "modul" | "jurnal"
  ) => {
    setDrilldownPillar(pillar);
    setDrilldownSearchQuery("");
    
    if (teacherId !== undefined) {
      setDrilldownTargetTeacherId(teacherId);
    } else if (selectedTeacherId !== "ALL") {
      setDrilldownTargetTeacherId(selectedTeacherId);
    } else {
      setDrilldownTargetTeacherId("ALL");
    }

    setDrilldownSelectedSubjectId(subjectId || null);
    setDrilldownSelectedComponent(component || (["prota", "prosem", "modul", "jurnal"].includes(pillar) ? (pillar as any) : null));
  };

  // Resolved single teacher if drilling down on a specific teacher
  const currentDrilldownTeacher = useMemo(() => {
    if (drilldownTargetTeacherId === "ALL") return null;
    return metrics.find(m => m.teacherId === drilldownTargetTeacherId) || null;
  }, [metrics, drilldownTargetTeacherId]);

  // Filtered teachers list inside drilldown modal
  const drilldownFilteredTeachers = useMemo(() => {
    return filteredMetrics.filter(m => {
      if (!drilldownSearchQuery.trim()) return true;
      const q = drilldownSearchQuery.toLowerCase();
      const matchName = m.teacherName.toLowerCase().includes(q);
      const matchNiy = (m.niy || "").toLowerCase().includes(q);
      const matchSub = m.subjects.some(s => s.subjectName.toLowerCase().includes(q));
      return matchName || matchNiy || matchSub;
    });
  }, [filteredMetrics, drilldownSearchQuery]);

  // Data for Charts
  const chartPillarsData = useMemo(() => {
    return filteredMetrics.slice(0, 10).map(m => ({
      name: m.teacherName.split(" ")[0] || m.teacherName,
      fullName: m.teacherName,
      Administrasi: m.administrationScore,
      Mutabaah: m.mutabaahScore,
      "Kehadiran Disiplin": m.attendanceScore,
      "Nilai Akhir": m.finalDisciplineScore,
      raw: m
    }));
  }, [filteredMetrics]);

  const chartAttendanceData = useMemo(() => {
    return filteredMetrics.slice(0, 10).map(m => ({
      name: m.teacherName.split(" ")[0] || m.teacherName,
      fullName: m.teacherName,
      "Hadir Tepat Waktu (JP)": Math.max(0, m.attendance.kehadiranJp - m.attendance.terlambatJp),
      "Terlambat (JP)": m.attendance.terlambatJp,
      "Menggantikan (JP)": m.attendance.menggantikanJp,
      "Digantikan (JP)": m.attendance.digantikanJp,
      "Tidak Hadir (JP)": m.attendance.tidakHadirJp,
      raw: m
    }));
  }, [filteredMetrics]);

  const chartCategoryPieData = useMemo(() => {
    return [
      { name: "Sangat Disiplin", value: summary.sangatDisiplinCount, color: CATEGORY_COLORS["Sangat Disiplin"] },
      { name: "Disiplin", value: summary.disiplinCount, color: CATEGORY_COLORS["Disiplin"] },
      { name: "Cukup Disiplin", value: summary.cukupDisiplinCount, color: CATEGORY_COLORS["Cukup Disiplin"] },
      { name: "Perlu Pembinaan", value: summary.perluPembinaanCount, color: CATEGORY_COLORS["Perlu Pembinaan"] },
      { name: "Pembinaan Khusus", value: summary.pembinaanKhususCount, color: CATEGORY_COLORS["Pembinaan Khusus"] }
    ].filter(item => item.value > 0);
  }, [summary]);

  const chartAdminComponentsData = useMemo(() => {
    return [
      { name: "Prota", value: summary.avgProtaScore, full: 100 },
      { name: "Prosem", value: summary.avgProsemScore, full: 100 },
      { name: "Modul Ajar", value: summary.avgModulScore, full: 100 },
      { name: "Jurnal Mengajar", value: summary.avgJurnalScore, full: 100 }
    ];
  }, [summary]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER & CONTROL PANEL                                     */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/50">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Kedisiplinan Guru
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Proporsi JP & Realistis
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                Sistem Evaluasi 3 Pilar: Administrasi Multi-Mapel, Mutabaah Harian, dan Kehadiran Mengajar
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              onClick={() => setShowConfigModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition"
              title="Atur Bobot & Penalti Keterlambatan"
            >
              <Settings className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              Bobot & Penalti
            </button>
          )}

          <button
            onClick={() => {
              setIsRefreshing(true);
              loadDisciplineData();
            }}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-emerald-500" : "text-slate-500"}`} />
            Refresh
          </button>

          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER BAR & PERIOD PRESETS                                */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Tahun Ajaran */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
              Tahun Ajaran
            </label>
            <select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.name} {y.isActive ? "(Aktif)" : ""}</option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
              Semester
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {semesters.map(s => (
                <option key={s.id} value={s.id}>{s.name} {s.isActive ? "(Aktif)" : ""}</option>
              ))}
            </select>
          </div>

          {/* Tanggal Mulai */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Tanggal Akhir */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          {/* Guru Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 mb-1">
              Filter Guru
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={isIndividualTeacher}
              className="w-full text-xs font-medium bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-60"
            >
              {!isIndividualTeacher && <option value="ALL">Semua Guru ({teachers.length})</option>}
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Presets & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 mr-1">Preset Periode:</span>
            <button
              onClick={() => setDatePreset("thisMonth")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setDatePreset("lastMonth")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => setDatePreset("last30Days")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
            >
              30 Hari Terakhir
            </button>
            <button
              onClick={() => setDatePreset("thisSemester")}
              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition"
            >
              Semester Ini
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari guru atau mapel..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-8 pr-3 py-1.5 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Sangat Disiplin">Sangat Disiplin</option>
              <option value="Disiplin">Disiplin</option>
              <option value="Cukup Disiplin">Cukup Disiplin</option>
              <option value="Perlu Pembinaan">Perlu Pembinaan</option>
              <option value="Pembinaan Khusus">Pembinaan Khusus</option>
            </select>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. 4 INTERACTIVE KPI CARDS                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: ADMINISTRASI */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleOpenDrilldown("admin", selectedTeacherId)}
          className="cursor-pointer bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600 shadow-sm transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Bobot: {disciplineConfig.adminWeight}%
            </span>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              1. Administrasi Guru
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
              {activeFocusMetric ? activeFocusMetric.administrationScore : summary.avgAdministrationScore}%
              <span className="text-xs font-normal text-slate-400">
                {activeFocusMetric ? activeFocusMetric.teacherName : `Rata-rata ${filteredMetrics.length} Guru`}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px] grid grid-cols-2 gap-1 text-slate-600 dark:text-zinc-400">
            <div>Prota: <strong className="text-slate-800 dark:text-zinc-200">{summary.avgProtaScore}%</strong></div>
            <div>Prosem: <strong className="text-slate-800 dark:text-zinc-200">{summary.avgProsemScore}%</strong></div>
            <div>Modul: <strong className="text-slate-800 dark:text-zinc-200">{summary.avgModulScore}%</strong></div>
            <div>Jurnal: <strong className="text-slate-800 dark:text-zinc-200">{summary.avgJurnalScore}%</strong></div>
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-semibold group-hover:underline">
            {selectedTeacherId === "ALL" ? `Klik untuk detail seluruh (${filteredMetrics.length}) guru` : `Klik untuk detail mapel ${activeFocusMetric?.teacherName || ""}`} <ChevronRight className="w-3 h-3" />
          </div>
        </motion.div>

        {/* KPI 2: MUTABAAH */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleOpenDrilldown("mutabaah", selectedTeacherId)}
          className="cursor-pointer bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-600 shadow-sm transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
              Bobot: {disciplineConfig.mutabaahWeight}%
            </span>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              2. Mutabaah Yaumiyah
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
              {activeFocusMetric ? activeFocusMetric.mutabaahScore : summary.avgMutabaahScore}%
              <span className="text-xs font-normal text-slate-400">
                {activeFocusMetric ? activeFocusMetric.teacherName : `Rata-rata ${filteredMetrics.length} Guru`}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px] flex justify-between text-slate-600 dark:text-zinc-400">
            <span>Evaluasi Hari Wajib:</span>
            <strong className="text-slate-800 dark:text-zinc-200">
              {activeFocusMetric ? `${activeFocusMetric.mutabaah.filledDays} / ${activeFocusMetric.mutabaah.mandatoryDays} Hari` : "Berdasarkan Hari Aktif"}
            </strong>
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1 font-semibold group-hover:underline">
            {selectedTeacherId === "ALL" ? `Klik untuk log mutabaah seluruh guru` : `Klik untuk log harian ${activeFocusMetric?.teacherName || ""}`} <ChevronRight className="w-3 h-3" />
          </div>
        </motion.div>

        {/* KPI 3: KEHADIRAN DISIPLIN */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleOpenDrilldown("attendance", selectedTeacherId)}
          className="cursor-pointer bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600 shadow-sm transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
              <Clock className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              Bobot: {disciplineConfig.attendanceWeight}%
            </span>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              3. Kehadiran Mengajar
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5 flex items-baseline gap-1.5">
              {activeFocusMetric ? activeFocusMetric.attendanceScore : summary.avgAttendanceDisciplineScore}%
              <span className="text-xs font-normal text-slate-400">
                {activeFocusMetric ? activeFocusMetric.teacherName : `Rata-rata ${filteredMetrics.length} Guru`}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 text-[11px] grid grid-cols-2 gap-1 text-slate-600 dark:text-zinc-400">
            <div>JML JP: <strong className="text-slate-800 dark:text-zinc-200">{summary.totalScheduledJp} JP</strong></div>
            <div>Hadir: <strong className="text-emerald-600 dark:text-emerald-400">{summary.totalKehadiranJp} JP</strong></div>
            <div>Terlambat: <strong className="text-rose-600 dark:text-rose-400">{summary.totalTerlambatJp} JP</strong></div>
            <div>Ganti: <strong className="text-blue-600 dark:text-blue-400">{summary.totalMenggantikanJp} JP</strong></div>
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold group-hover:underline">
            {selectedTeacherId === "ALL" ? `Klik untuk detail kehadiran seluruh guru` : `Klik untuk detail sesi ${activeFocusMetric?.teacherName || ""}`} <ChevronRight className="w-3 h-3" />
          </div>
        </motion.div>

        {/* KPI 4: NILAI AKHIR KEDISIPLINAN */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => handleOpenDrilldown("auditTrail", selectedTeacherId)}
          className="cursor-pointer bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 rounded-2xl shadow-md transition space-y-3 group"
        >
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
              Total 100%
            </span>
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              Nilai Akhir Kedisiplinan
            </div>
            <div className="text-3xl font-black text-white mt-0.5 flex items-baseline gap-2">
              {activeFocusMetric ? activeFocusMetric.finalDisciplineScore : summary.avgSchoolDisciplineScore}%
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/20 text-white">
                {activeFocusMetric ? activeFocusMetric.category : getDisciplineCategory(summary.avgSchoolDisciplineScore)}
              </span>
            </div>
          </div>
          <div className="pt-2 border-t border-white/20 text-[11px] text-emerald-100 flex justify-between">
            <span>Evaluasi Guru:</span>
            <strong className="text-white">
              {activeFocusMetric ? activeFocusMetric.teacherName : `${filteredMetrics.length} Guru Aktif`}
            </strong>
          </div>
          <div className="text-[10px] text-emerald-100 flex items-center gap-1 font-semibold group-hover:underline">
            Klik untuk audit formula perhitungan <ChevronRight className="w-3 h-3" />
          </div>
        </motion.div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TABS NAVIGATION                                            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("kpi")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === "kpi"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          Daftar Rekap Guru & Multi-Mapel
        </button>

        <button
          onClick={() => setActiveTab("charts")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === "charts"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
          }`}
        >
          <Grid className="w-4 h-4" />
          Grafik Visual Analitik
        </button>

        <button
          onClick={() => setActiveTab("recommendations")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition flex items-center gap-2 ${
            activeTab === "recommendations"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Rekomendasi Pembinaan ({recommendations.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB CONTENT 1: DAFTAR REKAP GURU (MULTI-MAPEL TABLE)       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "kpi" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                Tabel Evaluasi Kedisiplinan Guru
                <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                  (Menampilkan {filteredMetrics.length} Guru)
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Klik pada nama guru untuk melihat rincian per mapel atau klik nilai untuk drilldown audit trail
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Keterangan:</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Sangat Disiplin (≥96%)
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                Cukup Disiplin (76-85%)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 dark:bg-zinc-800/60 text-slate-700 dark:text-zinc-300 font-bold border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Guru & Mapel Diampu</th>
                  <th className="py-3 px-4 text-center">JML JP</th>
                  <th className="py-3 px-4 text-center">
                    Administrasi ({disciplineConfig.adminWeight}%)
                  </th>
                  <th className="py-3 px-4 text-center">
                    Mutabaah ({disciplineConfig.mutabaahWeight}%)
                  </th>
                  <th className="py-3 px-4 text-center">
                    Kehadiran ({disciplineConfig.attendanceWeight}%)
                  </th>
                  <th className="py-3 px-4 text-center">Nilai Akhir</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80 font-medium">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Memuat dan menghitung kedisiplinan guru berbasis proporsi JP...
                    </td>
                  </tr>
                ) : filteredMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-zinc-500">
                      Tidak ada data guru yang sesuai dengan kriteria filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredMetrics.map((m, idx) => {
                    const isExpanded = expandedTeacherId === m.teacherId;
                    const catColor = CATEGORY_COLORS[m.category];

                    return (
                      <React.Fragment key={m.teacherId}>
                        <tr 
                          className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition ${
                            isExpanded ? "bg-emerald-50/30 dark:bg-emerald-950/20" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center text-slate-400 dark:text-zinc-500 font-bold">
                            {idx + 1}
                          </td>

                          {/* Guru & Subjects Summary */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => setExpandedTeacherId(isExpanded ? null : m.teacherId)}
                                className="p-1 text-slate-400 hover:text-emerald-600 transition"
                                title="Buka/Tutup Rincian Multi-Mapel"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {m.teacherName}
                                  {m.trendStatus === "Meningkat" && (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" title="Skor Meningkat" />
                                  )}
                                  {m.trendStatus === "Menurun" && (
                                    <TrendingDown className="w-3.5 h-3.5 text-rose-500" title="Skor Menurun" />
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                                  <span>NIY: {m.niy || "-"}</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                    {m.subjects.length} Mapel ({m.subjects.map(s => s.subjectName).join(", ") || "Umum"})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* JML JP */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="font-bold text-slate-800 dark:text-zinc-200">
                              {m.attendance.jmlJp} JP
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {m.attendance.kehadiranJp} Hadir
                            </div>
                          </td>

                          {/* 1. Administrasi Score (Clickable) */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenDrilldown("admin", m.teacherId)}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800/50 transition inline-flex items-center gap-1"
                              title="Klik untuk detail Administrasi Multi-Mapel"
                            >
                              {m.administrationScore}%
                              <ChevronRight className="w-3 h-3 text-blue-400" />
                            </button>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Rata-rata {m.subjects.length} Mapel
                            </div>
                          </td>

                          {/* 2. Mutabaah Score (Clickable) */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenDrilldown("mutabaah", m.teacherId)}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800/50 transition inline-flex items-center gap-1"
                              title="Klik untuk detail Mutabaah Harian"
                            >
                              {m.mutabaahScore}%
                              <ChevronRight className="w-3 h-3 text-purple-400" />
                            </button>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {m.mutabaah.filledDays}/{m.mutabaah.mandatoryDays} Hari
                            </div>
                          </td>

                          {/* 3. Kehadiran Disiplin Score (Clickable) */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleOpenDrilldown("attendance", m.teacherId)}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/50 transition inline-flex items-center gap-1"
                              title="Klik untuk detail Sesi Kehadiran & Penalti Keterlambatan"
                            >
                              {m.attendanceScore}%
                              <ChevronRight className="w-3 h-3 text-amber-400" />
                            </button>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {m.attendance.terlambatJp > 0 ? (
                                <span className="text-rose-500 font-semibold">
                                  Terlambat {m.attendance.terlambatJp} JP (-{m.attendance.penaltiKeterlambatan}%)
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">Tepat Waktu</span>
                              )}
                            </div>
                          </td>

                          {/* Final Discipline Score & Category */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="font-black text-sm text-slate-900 dark:text-white">
                              {m.finalDisciplineScore}%
                            </div>
                            <span 
                              className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border mt-0.5"
                              style={{ 
                                backgroundColor: `${catColor}15`, 
                                color: catColor, 
                                borderColor: `${catColor}40` 
                              }}
                            >
                              {m.category}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenDrilldown("auditTrail", m.teacherId)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-zinc-300 hover:text-emerald-600 transition"
                                title="Lihat Audit Trail Formula Lengkap"
                              >
                                <Calculator className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setExpandedTeacherId(isExpanded ? null : m.teacherId)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 transition"
                                title="Lihat Sub-Mapel"
                              >
                                <Layers className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expandable Multi-Subject Tree Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-zinc-900/90">
                            <td colSpan={8} className="p-4 pl-12">
                              <div className="bg-white dark:bg-zinc-850 p-4 rounded-xl border border-slate-200 dark:border-zinc-750 shadow-inner space-y-3">
                                <div className="flex items-center justify-between">
                                   <div className="font-bold text-xs text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-emerald-600" />
                                    Rincian Pemenuhan Kewajiban per Mata Pelajaran ({m.subjects.length} Mapel)
                                  </div>
                                  <span className="text-[11px] text-slate-500">
                                    Aturan Multi-Mapel: Nilai Administrasi = Rerata Skor masing-masing Mapel
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {m.subjects.map(sub => (
                                    <div 
                                      key={sub.subjectId}
                                      className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 space-y-2.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <span className="font-black text-xs text-slate-900 dark:text-white">
                                            {sub.subjectName}
                                          </span>
                                          <span className="text-[10px] text-slate-500 block">
                                            Kelas: {sub.classNames.join(", ") || "-"} • Target: {sub.periodTargetJp} JP
                                          </span>
                                        </div>
                                        <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                                          Skor: {sub.subjectAdminScore}%
                                        </span>
                                      </div>

                                      {/* 4 Components */}
                                      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                                        <button
                                          onClick={() => handleOpenDrilldown("prota", m.teacherId, sub.subjectId, "prota")}
                                          className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-blue-400 transition"
                                        >
                                          <div className="text-slate-400 font-semibold">Prota</div>
                                          <div className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                                            {sub.prota.percentage}%
                                          </div>
                                        </button>

                                        <button
                                          onClick={() => handleOpenDrilldown("prosem", m.teacherId, sub.subjectId, "prosem")}
                                          className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-blue-400 transition"
                                        >
                                          <div className="text-slate-400 font-semibold">Prosem</div>
                                          <div className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                                            {sub.prosem.percentage}%
                                          </div>
                                        </button>

                                        <button
                                          onClick={() => handleOpenDrilldown("modul", m.teacherId, sub.subjectId, "modul")}
                                          className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-blue-400 transition"
                                        >
                                          <div className="text-slate-400 font-semibold">Modul</div>
                                          <div className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                                            {sub.modulAjar.percentage}%
                                          </div>
                                        </button>

                                        <button
                                          onClick={() => handleOpenDrilldown("jurnal", m.teacherId, sub.subjectId, "jurnal")}
                                          className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 hover:border-blue-400 transition"
                                        >
                                          <div className="text-slate-400 font-semibold">Jurnal</div>
                                          <div className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                                            {sub.jurnalMengajar.percentage}%
                                          </div>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB CONTENT 2: GRAFIK VISUAL ANALITIK (RECHARTS)           */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "charts" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Perbandingan 3 Pilar Guru */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  1. Perbandingan 3 Pilar Kedisiplinan Guru
                </h3>
                <p className="text-[11px] text-slate-500">
                  Perbandingan skor Administrasi, Mutabaah, dan Kehadiran per Guru
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartPillarsData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis domain={[0, 100]} fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Administrasi" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Mutabaah" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Kehadiran Disiplin" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Nilai Akhir" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Proporsi Kehadiran vs Keterlambatan JP */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  2. Proporsi Kehadiran vs Keterlambatan (JP)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Evaluasi proporsi Jam Pelajaran tepat waktu, terlambat, dan penggantian
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartAttendanceData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" fontSize={10} />
                  <YAxis fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Hadir Tepat Waktu (JP)" stackId="a" fill="#10b981" />
                  <Bar dataKey="Terlambat (JP)" stackId="a" fill="#ef4444" />
                  <Bar dataKey="Menggantikan (JP)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Digantikan (JP)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Distribusi Kategori Disiplin (Pie Chart) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  3. Distribusi Kategori Kedisiplinan Sekolah
                </h3>
                <p className="text-[11px] text-slate-500">
                  Persentase guru dalam masing-masing predikat disiplin
                </p>
              </div>
            </div>
            <div className="h-72 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartCategoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {chartCategoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Kelengkapan Komponen Administrasi (Radar/Bar) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  4. Kelengkapan 4 Pilar Administrasi Guru
                </h3>
                <p className="text-[11px] text-slate-500">
                  Rata-rata capaian Prota, Prosem, Modul Ajar, dan Jurnal Mengajar
                </p>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartAdminComponentsData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis type="number" domain={[0, 100]} fontSize={10} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={110} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#18181b", borderRadius: "12px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. TAB CONTENT 3: REKOMENDASI PEMBINAAN                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Rekomendasi Tindak Lanjut & Pembinaan Berbasis AI Logic
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Analisis otomatis terhadap indikator keterlambatan, kelengkapan administrasi, dan tren disiplin
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recommendations.map(rec => {
              const typeStyles = {
                success: "border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200",
                warning: "border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200",
                danger: "border-rose-200 bg-rose-50/60 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200",
                info: "border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200"
              }[rec.type] || "border-slate-200 bg-slate-50 text-slate-900";

              return (
                <div 
                  key={rec.id}
                  className={`p-4 rounded-2xl border shadow-sm space-y-2 ${typeStyles}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      {rec.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      {rec.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                      {rec.type === "danger" && <AlertCircle className="w-4 h-4 text-rose-600" />}
                      {rec.type === "info" && <Info className="w-4 h-4 text-blue-600" />}
                      {rec.title}
                    </span>
                    {rec.teacherName && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/70 dark:bg-zinc-800">
                        {rec.teacherName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {rec.message}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL CONFIGURATION (ADMIN BOBOT & PENALTI)               */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {showConfigModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-xl w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Konfigurasi Bobot & Penalti Kedisiplinan
                  </h3>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* 3 Pillars Weights */}
              <div className="space-y-3">
                <div className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                  1. Pembobotan 3 Pilar Kedisiplinan (Total Wajib 100%)
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Administrasi (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempConfig.adminWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, adminWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mutabaah (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempConfig.mutabaahWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, mutabaahWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kehadiran (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tempConfig.attendanceWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, attendanceWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-right font-bold text-slate-600 dark:text-zinc-400">
                  Total Bobot: <span className={tempConfig.adminWeight + tempConfig.mutabaahWeight + tempConfig.attendanceWeight === 100 ? "text-emerald-600" : "text-rose-600"}>
                    {tempConfig.adminWeight + tempConfig.mutabaahWeight + tempConfig.attendanceWeight}%
                  </span>
                </div>
              </div>

              {/* Late Penalty Factor */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <div className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                  2. Faktor Pengurang / Penalti Keterlambatan
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Faktor Penalti</label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={tempConfig.latePenaltyFactor}
                      onChange={(e) => setTempConfig({ ...tempConfig, latePenaltyFactor: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2"
                    />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400 pt-4 leading-relaxed">
                    Setara dengan penalti <strong>{Math.round(tempConfig.latePenaltyFactor * 100)}%</strong> dari rasio Jam Pelajaran terlambat.
                    <br />
                    <em>Contoh: Terlambat 10% JP = Pengurangan nilai {Math.round(10 * tempConfig.latePenaltyFactor * 10) / 10}%.</em>
                  </div>
                </div>
              </div>

              {/* 4 Admin Components Weights */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                <div className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                  3. Bobot Komponen Administrasi (Total Wajib 100%)
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Prota (%)</label>
                    <input
                      type="number"
                      value={tempConfig.protaWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, protaWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Prosem (%)</label>
                    <input
                      type="number"
                      value={tempConfig.prosemWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, prosemWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Modul (%)</label>
                    <input
                      type="number"
                      value={tempConfig.modulWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, modulWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">Jurnal (%)</label>
                    <input
                      type="number"
                      value={tempConfig.jurnalWeight}
                      onChange={(e) => setTempConfig({ ...tempConfig, jurnalWeight: Number(e.target.value) })}
                      className="w-full text-xs font-bold bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-2 py-1.5"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveConfig}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                >
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------- */}
      {/* 9. DRILLDOWN MODAL (ALL COMPONENTS & ALL/SINGLE TEACHERS)     */}
      {/* ------------------------------------------------------------- */}
      <AnimatePresence>
        {drilldownPillar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-5xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
                <div className="space-y-1">
                  {/* Breadcrumb Navigation */}
                  <div className="flex items-center gap-2 text-xs">
                    {drilldownTargetTeacherId === "ALL" ? (
                      <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Mode: Rekap Seluruh Guru ({drilldownFilteredTeachers.length} Guru)
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setDrilldownTargetTeacherId("ALL");
                            setDrilldownSelectedSubjectId(null);
                            setDrilldownSelectedComponent(null);
                          }}
                          className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Daftar Semua Guru
                        </button>
                        <span className="text-slate-400">/</span>
                        <span className="font-bold text-slate-800 dark:text-zinc-200">
                          {currentDrilldownTeacher?.teacherName || "Detail Guru"}
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    {drilldownPillar === "admin" && (
                      <><BookOpen className="w-5 h-5 text-blue-600" /> Detail Pilar 1: Administrasi Multi-Mapel</>
                    )}
                    {drilldownPillar === "mutabaah" && (
                      <><Sparkles className="w-5 h-5 text-purple-600" /> Detail Pilar 2: Mutabaah Yaumiyah Guru</>
                    )}
                    {drilldownPillar === "attendance" && (
                      <><Clock className="w-5 h-5 text-amber-600" /> Detail Pilar 3: Kehadiran Mengajar & Penalti Keterlambatan</>
                    )}
                    {drilldownPillar === "auditTrail" && (
                      <><Calculator className="w-5 h-5 text-emerald-600" /> Audit Formula & Transparansi Perhitungan Nilai Akhir</>
                    )}
                    {drilldownPillar === "prota" && (
                      <><FileText className="w-5 h-5 text-blue-600" /> Dokumen Program Tahunan (Prota)</>
                    )}
                    {drilldownPillar === "prosem" && (
                      <><Calendar className="w-5 h-5 text-indigo-600" /> Dokumen Program Semester (Prosem)</>
                    )}
                    {drilldownPillar === "modul" && (
                      <><Layers className="w-5 h-5 text-emerald-600" /> Dokumen Modul Ajar / RPP</>
                    )}
                    {drilldownPillar === "jurnal" && (
                      <><CheckCircle2 className="w-5 h-5 text-teal-600" /> Jurnal Mengajar & Realisasi JP</>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Periode: {startDate} s/d {endDate} • Tahun Ajaran: {academicYears.find(y => y.id === selectedYearId)?.name || "-"} ({semesters.find(s => s.id === selectedSemesterId)?.name || "-"})
                  </p>
                </div>

                {/* Right controls: Teacher Switcher & Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Quick Teacher Switcher inside modal */}
                  <select
                    value={drilldownTargetTeacherId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDrilldownTargetTeacherId(val);
                      setDrilldownSelectedSubjectId(null);
                      setDrilldownSelectedComponent(null);
                    }}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 outline-none"
                  >
                    <option value="ALL">Semua Guru ({metrics.length})</option>
                    {metrics.map(m => (
                      <option key={m.teacherId} value={m.teacherId}>
                        {m.teacherName}
                      </option>
                    ))}
                  </select>

                  {/* Pillar Quick Switch Tabs */}
                  <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-xl text-[11px] font-bold">
                    <button
                      onClick={() => {
                        setDrilldownPillar("admin");
                        setDrilldownSelectedComponent(null);
                      }}
                      className={`px-2 py-1 rounded-lg transition ${
                        drilldownPillar === "admin" || ["prota", "prosem", "modul", "jurnal"].includes(drilldownPillar || "")
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                      }`}
                    >
                      Admin
                    </button>
                    <button
                      onClick={() => {
                        setDrilldownPillar("mutabaah");
                        setDrilldownSelectedComponent(null);
                      }}
                      className={`px-2 py-1 rounded-lg transition ${
                        drilldownPillar === "mutabaah"
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                      }`}
                    >
                      Mutabaah
                    </button>
                    <button
                      onClick={() => {
                        setDrilldownPillar("attendance");
                        setDrilldownSelectedComponent(null);
                      }}
                      className={`px-2 py-1 rounded-lg transition ${
                        drilldownPillar === "attendance"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                      }`}
                    >
                      Kehadiran
                    </button>
                    <button
                      onClick={() => {
                        setDrilldownPillar("auditTrail");
                        setDrilldownSelectedComponent(null);
                      }}
                      className={`px-2 py-1 rounded-lg transition ${
                        drilldownPillar === "auditTrail"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                      }`}
                    >
                      Audit
                    </button>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => {
                      setDrilldownPillar(null);
                      setDrilldownTargetTeacherId("ALL");
                      setDrilldownSelectedSubjectId(null);
                      setDrilldownSelectedComponent(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* VIEW A: ALL TEACHERS DRILLDOWN (WHEN TARGET = ALL)       */}
              {/* ========================================================= */}
              {drilldownTargetTeacherId === "ALL" && (
                <div className="space-y-4">
                  {/* Search inside modal */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama guru / mapel di drilldown..."
                        value={drilldownSearchQuery}
                        onChange={(e) => setDrilldownSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-xs text-slate-500">
                      Menampilkan {drilldownFilteredTeachers.length} dari {filteredMetrics.length} Guru
                    </span>
                  </div>

                  {/* 1. ALL TEACHERS: ADMINISTRASI MULTI-MAPEL */}
                  {(drilldownPillar === "admin" || ["prota", "prosem", "modul", "jurnal"].includes(drilldownPillar || "")) && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="text-blue-900 dark:text-blue-200">
                          <strong>Aturan Perhitungan Multi-Mapel:</strong> Nilai Administrasi Guru merupakan rata-rata skor dari setiap mata pelajaran yang diampu.
                        </div>
                        <div className="font-black text-blue-700 dark:text-blue-300">
                          Rerata Sekolah: {summary.avgAdministrationScore}% (Prota: {summary.avgProtaScore}%, Prosem: {summary.avgProsemScore}%, Modul: {summary.avgModulScore}%, Jurnal: {summary.avgJurnalScore}%)
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[60vh] border border-slate-200 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3">No</th>
                              <th className="py-2.5 px-3">Guru</th>
                              <th className="py-2.5 px-3">Rincian Mapel & Kelas</th>
                              <th className="py-2.5 px-3 text-center">Prota</th>
                              <th className="py-2.5 px-3 text-center">Prosem</th>
                              <th className="py-2.5 px-3 text-center">Modul</th>
                              <th className="py-2.5 px-3 text-center">Jurnal</th>
                              <th className="py-2.5 px-3 text-center">Nilai Administrasi</th>
                              <th className="py-2.5 px-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                            {drilldownFilteredTeachers.map((t, idx) => (
                              <tr key={t.teacherId} className="hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
                                <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 dark:text-white">{t.teacherName}</div>
                                  <div className="text-[10px] text-slate-500">NIY: {t.niy || "-"} • {t.subjects.length} Mapel</div>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="space-y-1">
                                    {t.subjects.map(s => (
                                      <div key={s.subjectId} className="text-[11px] flex items-center justify-between gap-2">
                                        <span className="font-medium text-slate-800 dark:text-zinc-200">{s.subjectName}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">({s.classNames.join(", ") || "-"}) • {s.periodTargetJp} JP</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center font-semibold">
                                  {t.subjects.map(s => (
                                    <div key={s.subjectId} className="text-[11px]">{s.prota.percentage}%</div>
                                  ))}
                                </td>
                                <td className="py-3 px-3 text-center font-semibold">
                                  {t.subjects.map(s => (
                                    <div key={s.subjectId} className="text-[11px]">{s.prosem.percentage}%</div>
                                  ))}
                                </td>
                                <td className="py-3 px-3 text-center font-semibold">
                                  {t.subjects.map(s => (
                                    <div key={s.subjectId} className="text-[11px]">{s.modulAjar.percentage}%</div>
                                  ))}
                                </td>
                                <td className="py-3 px-3 text-center font-semibold">
                                  {t.subjects.map(s => (
                                    <div key={s.subjectId} className="text-[11px]">{s.jurnalMengajar.percentage}%</div>
                                  ))}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-black text-sm text-blue-600 dark:text-blue-400">
                                    {t.administrationScore}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => {
                                      setDrilldownTargetTeacherId(t.teacherId);
                                      if (t.subjects.length > 0) {
                                        setDrilldownSelectedSubjectId(t.subjects[0].subjectId);
                                      }
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 transition"
                                  >
                                    Lihat Dokumen
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 2. ALL TEACHERS: MUTABAAH YAUMIYAH */}
                  {drilldownPillar === "mutabaah" && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="text-purple-900 dark:text-purple-200">
                          <strong>Evaluasi Mutabaah:</strong> Mengukur persentase kepatuhan dan kelengkapan pengisian ibadah yaumiyah guru selama hari aktif.
                        </div>
                        <div className="font-black text-purple-700 dark:text-purple-300">
                          Rerata Mutabaah Sekolah: {summary.avgMutabaahScore}%
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[60vh] border border-slate-200 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3">No</th>
                              <th className="py-2.5 px-3">Guru</th>
                              <th className="py-2.5 px-3 text-center">Hari Wajib</th>
                              <th className="py-2.5 px-3 text-center">Hari Terisi</th>
                              <th className="py-2.5 px-3 text-center">Lengkap (100%)</th>
                              <th className="py-2.5 px-3 text-center">Belum Lengkap</th>
                              <th className="py-2.5 px-3 text-center">Belum Mengisi</th>
                              <th className="py-2.5 px-3 text-center">Nilai Mutabaah</th>
                              <th className="py-2.5 px-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                            {drilldownFilteredTeachers.map((t, idx) => (
                              <tr key={t.teacherId} className="hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
                                <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 dark:text-white">{t.teacherName}</div>
                                  <div className="text-[10px] text-slate-500">NIY: {t.niy || "-"}</div>
                                </td>
                                <td className="py-3 px-3 text-center font-mono">{t.mutabaah.mandatoryDays} Hari</td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-purple-700 dark:text-purple-300">{t.mutabaah.filledDays} Hari</td>
                                <td className="py-3 px-3 text-center font-mono text-emerald-600 font-semibold">{t.mutabaah.completeDays} Hari</td>
                                <td className="py-3 px-3 text-center font-mono text-amber-600 font-semibold">{t.mutabaah.partialDays} Hari</td>
                                <td className="py-3 px-3 text-center font-mono text-rose-600 font-semibold">{t.mutabaah.emptyDays} Hari</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-black text-sm text-purple-600 dark:text-purple-400">
                                    {t.mutabaahScore}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => setDrilldownTargetTeacherId(t.teacherId)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition"
                                  >
                                    Log Harian
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. ALL TEACHERS: KEHADIRAN MENGAJAR & PENALTI */}
                  {drilldownPillar === "attendance" && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="text-amber-900 dark:text-amber-200">
                          <strong>SSOT Jadwal Asli Operasional:</strong> JML JP dihitung dari jadwal operasional guru. Keterlambatan check-in mengurangi nilai dengan penalti proporsional ({disciplineConfig.latePenaltyRate}% per menit).
                        </div>
                        <div className="font-black text-amber-700 dark:text-amber-300">
                          Rerata Kehadiran Disiplin: {summary.avgAttendanceDisciplineScore}%
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[60vh] border border-slate-200 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3">No</th>
                              <th className="py-2.5 px-3">Guru</th>
                              <th className="py-2.5 px-3 text-center">JML JP (Target)</th>
                              <th className="py-2.5 px-3 text-center">Hadir (JP)</th>
                              <th className="py-2.5 px-3 text-center">Terlambat (JP) & Penalti</th>
                              <th className="py-2.5 px-3 text-center">Menggantikan (JP)</th>
                              <th className="py-2.5 px-3 text-center">Digantikan (JP)</th>
                              <th className="py-2.5 px-3 text-center">Nilai Kehadiran</th>
                              <th className="py-2.5 px-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                            {drilldownFilteredTeachers.map((t, idx) => (
                              <tr key={t.teacherId} className="hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
                                <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                <td className="py-3 px-3">
                                  <div className="font-bold text-slate-900 dark:text-white">{t.teacherName}</div>
                                  <div className="text-[10px] text-slate-500">NIY: {t.niy || "-"}</div>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold">{t.attendance.jmlJp} JP</td>
                                <td className="py-3 px-3 text-center font-mono text-emerald-600 font-semibold">{t.attendance.kehadiranJp} JP</td>
                                <td className="py-3 px-3 text-center">
                                  {t.attendance.terlambatJp > 0 ? (
                                    <span className="font-mono text-rose-600 font-bold">
                                      {t.attendance.terlambatJp} JP (-{t.attendance.penaltiKeterlambatan}%)
                                    </span>
                                  ) : (
                                    <span className="text-emerald-600 font-semibold text-[11px]">Tepat Waktu</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center font-mono text-blue-600 font-semibold">{t.attendance.menggantikanJp} JP</td>
                                <td className="py-3 px-3 text-center font-mono text-amber-600 font-semibold">{t.attendance.digantikanJp} JP</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="font-black text-sm text-amber-600 dark:text-amber-400">
                                    {t.attendanceScore}%
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => setDrilldownTargetTeacherId(t.teacherId)}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 transition"
                                  >
                                    Log Sesi
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 4. ALL TEACHERS: AUDIT TRAIL FORMULA */}
                  {drilldownPillar === "auditTrail" && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="text-emerald-900 dark:text-emerald-200">
                          <strong>Formula Nilai Akhir:</strong> ({disciplineConfig.adminWeight}% × Administrasi) + ({disciplineConfig.mutabaahWeight}% × Mutabaah) + ({disciplineConfig.attendanceWeight}% × Kehadiran Disiplin).
                        </div>
                        <div className="font-black text-emerald-700 dark:text-emerald-300">
                          Rerata Nilai Akhir Sekolah: {summary.avgSchoolDisciplineScore}%
                        </div>
                      </div>

                      <div className="overflow-x-auto max-h-[60vh] border border-slate-200 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-bold sticky top-0 z-10">
                            <tr>
                              <th className="py-2.5 px-3">No</th>
                              <th className="py-2.5 px-3">Guru</th>
                              <th className="py-2.5 px-3 text-center">Admin ({disciplineConfig.adminWeight}%)</th>
                              <th className="py-2.5 px-3 text-center">Mutabaah ({disciplineConfig.mutabaahWeight}%)</th>
                              <th className="py-2.5 px-3 text-center">Kehadiran ({disciplineConfig.attendanceWeight}%)</th>
                              <th className="py-2.5 px-3 text-center">Nilai Akhir</th>
                              <th className="py-2.5 px-3 text-center">Predikat</th>
                              <th className="py-2.5 px-3 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                            {drilldownFilteredTeachers.map((t, idx) => {
                              const catColor = CATEGORY_COLORS[t.category] || "#64748b";
                              return (
                                <tr key={t.teacherId} className="hover:bg-slate-50 dark:hover:bg-zinc-850 transition">
                                  <td className="py-3 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-3 px-3">
                                    <div className="font-bold text-slate-900 dark:text-white">{t.teacherName}</div>
                                    <div className="text-[10px] text-slate-500">NIY: {t.niy || "-"}</div>
                                  </td>
                                  <td className="py-3 px-3 text-center font-bold text-blue-600">{t.administrationScore}%</td>
                                  <td className="py-3 px-3 text-center font-bold text-purple-600">{t.mutabaahScore}%</td>
                                  <td className="py-3 px-3 text-center font-bold text-amber-600">{t.attendanceScore}%</td>
                                  <td className="py-3 px-3 text-center font-black text-sm text-slate-900 dark:text-white">
                                    {t.finalDisciplineScore}%
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <span 
                                      className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border"
                                      style={{ 
                                        backgroundColor: `${catColor}15`, 
                                        color: catColor, 
                                        borderColor: `${catColor}40` 
                                      }}
                                    >
                                      {t.category}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <button
                                      onClick={() => setDrilldownTargetTeacherId(t.teacherId)}
                                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 transition"
                                    >
                                      Audit Formula
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* VIEW B: SINGLE TEACHER DRILLDOWN (WHEN TARGET = GURU ID)  */}
              {/* ========================================================= */}
              {drilldownTargetTeacherId !== "ALL" && currentDrilldownTeacher && (
                <div className="space-y-4">
                  {/* Teacher Info Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-base">
                        {currentDrilldownTeacher.teacherName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                          {currentDrilldownTeacher.teacherName}
                          <span 
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md border"
                            style={{ 
                              backgroundColor: `${CATEGORY_COLORS[currentDrilldownTeacher.category]}15`, 
                              color: CATEGORY_COLORS[currentDrilldownTeacher.category], 
                              borderColor: `${CATEGORY_COLORS[currentDrilldownTeacher.category]}40` 
                            }}
                          >
                            {currentDrilldownTeacher.category}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                          NIY: {currentDrilldownTeacher.niy || "-"} • {currentDrilldownTeacher.subjects.length} Mapel Diampu • Target: {currentDrilldownTeacher.attendance.jmlJp} JP
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Nilai Kedisiplinan</div>
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                          {currentDrilldownTeacher.finalDisciplineScore}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 1. SINGLE TEACHER: ADMINISTRASI & SUB-MAPEL */}
                  {(drilldownPillar === "admin" || ["prota", "prosem", "modul", "jurnal"].includes(drilldownPillar || "")) && (
                    <div className="space-y-4">
                      {/* Subject selector tabs if teacher has multiple subjects */}
                      {currentDrilldownTeacher.subjects.length > 1 && (
                        <div className="flex flex-wrap gap-2">
                          {currentDrilldownTeacher.subjects.map(s => {
                            const isSelected = (drilldownSelectedSubjectId || currentDrilldownTeacher.subjects[0]?.subjectId) === s.subjectId;
                            return (
                              <button
                                key={s.subjectId}
                                onClick={() => setDrilldownSelectedSubjectId(s.subjectId)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                  isSelected 
                                    ? "bg-blue-600 text-white shadow-xs" 
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200"
                                }`}
                              >
                                <span>{s.subjectName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? "bg-blue-700 text-white" : "bg-slate-200 dark:bg-zinc-700"}`}>
                                  {s.subjectAdminScore}%
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Active Subject Detail */}
                      {(() => {
                        const activeSubject = currentDrilldownTeacher.subjects.find(s => s.subjectId === (drilldownSelectedSubjectId || currentDrilldownTeacher.subjects[0]?.subjectId)) || currentDrilldownTeacher.subjects[0];
                        if (!activeSubject) {
                          return (
                            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-zinc-800 rounded-xl">
                              Tidak ada data mata pelajaran untuk guru ini.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-4">
                            {/* 4 Cards for 4 Components */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                              <button
                                onClick={() => setDrilldownSelectedComponent(drilldownSelectedComponent === "prota" ? null : "prota")}
                                className={`p-3 rounded-xl border transition text-left ${
                                  drilldownSelectedComponent === "prota"
                                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 ring-2 ring-blue-400/30"
                                    : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-blue-300"
                                }`}
                              >
                                <div className="text-slate-400 text-[10px] font-bold">1. PROTA</div>
                                <div className="font-black text-base text-slate-800 dark:text-zinc-100">{activeSubject.prota.percentage}%</div>
                                <div className="text-[10px] text-emerald-600 font-semibold">{activeSubject.prota.status} • {activeSubject.prota.topicCount} Topik</div>
                              </button>

                              <button
                                onClick={() => setDrilldownSelectedComponent(drilldownSelectedComponent === "prosem" ? null : "prosem")}
                                className={`p-3 rounded-xl border transition text-left ${
                                  drilldownSelectedComponent === "prosem"
                                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 ring-2 ring-blue-400/30"
                                    : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-blue-300"
                                }`}
                              >
                                <div className="text-slate-400 text-[10px] font-bold">2. PROSEM</div>
                                <div className="font-black text-base text-slate-800 dark:text-zinc-100">{activeSubject.prosem.percentage}%</div>
                                <div className="text-[10px] text-emerald-600 font-semibold">{activeSubject.prosem.status} • {activeSubject.prosem.meetingsCount} Pertemuan</div>
                              </button>

                              <button
                                onClick={() => setDrilldownSelectedComponent(drilldownSelectedComponent === "modul" ? null : "modul")}
                                className={`p-3 rounded-xl border transition text-left ${
                                  drilldownSelectedComponent === "modul"
                                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 ring-2 ring-blue-400/30"
                                    : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-blue-300"
                                }`}
                              >
                                <div className="text-slate-400 text-[10px] font-bold">3. MODUL AJAR</div>
                                <div className="font-black text-base text-slate-800 dark:text-zinc-100">{activeSubject.modulAjar.percentage}%</div>
                                <div className="text-[10px] text-slate-500">{activeSubject.modulAjar.actualValid}/{activeSubject.modulAjar.targetMeetings} Pertemuan</div>
                              </button>

                              <button
                                onClick={() => setDrilldownSelectedComponent(drilldownSelectedComponent === "jurnal" ? null : "jurnal")}
                                className={`p-3 rounded-xl border transition text-left ${
                                  drilldownSelectedComponent === "jurnal"
                                    ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 ring-2 ring-blue-400/30"
                                    : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-blue-300"
                                }`}
                              >
                                <div className="text-slate-400 text-[10px] font-bold">4. JURNAL MENGAJAR</div>
                                <div className="font-black text-base text-slate-800 dark:text-zinc-100">{activeSubject.jurnalMengajar.percentage}%</div>
                                <div className="text-[10px] text-slate-500">{activeSubject.jurnalMengajar.actualFilledJp}/{activeSubject.jurnalMengajar.targetJp} JP Terisi</div>
                              </button>
                            </div>

                            {/* Deep Detail: Prota */}
                            {(drilldownSelectedComponent === "prota" || drilldownPillar === "prota") && (
                              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 space-y-2 text-xs">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                                  <span>Rincian Dokumen Prota: {activeSubject.subjectName}</span>
                                  <span className="text-emerald-600 font-bold">{activeSubject.prota.status}</span>
                                </div>
                                <div className="text-slate-500">Jumlah Topik Terdaftar: <strong>{activeSubject.prota.topicCount} Topik</strong></div>
                                {activeSubject.prota.topics.length > 0 && (
                                  <div className="pt-2 border-t border-slate-200 dark:border-zinc-700">
                                    <div className="text-slate-500 mb-1">Daftar Topik Silabus:</div>
                                    <ul className="list-disc pl-5 space-y-0.5 text-slate-700 dark:text-zinc-300 font-medium">
                                      {activeSubject.prota.topics.map((t, i) => (
                                        <li key={i}>{t}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Deep Detail: Prosem */}
                            {(drilldownSelectedComponent === "prosem" || drilldownPillar === "prosem") && (
                              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 space-y-2 text-xs">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                                  <span>Rincian Dokumen Prosem: {activeSubject.subjectName}</span>
                                  <span className="text-emerald-600 font-bold">{activeSubject.prosem.status}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-zinc-300">
                                  <div>Jumlah Pertemuan Terencana: <strong>{activeSubject.prosem.meetingsCount} Pertemuan</strong></div>
                                  <div>Alokasi Jam Pelajaran: <strong>{activeSubject.prosem.allocatedJp} JP</strong></div>
                                </div>
                              </div>
                            )}

                            {/* Deep Detail: Modul Ajar */}
                            {(drilldownSelectedComponent === "modul" || drilldownPillar === "modul") && (
                              <div className="space-y-2">
                                <div className="font-bold text-xs text-slate-800 dark:text-zinc-200 flex justify-between items-center">
                                  <span>Daftar Modul Ajar ({activeSubject.modulAjar.items.length} Dokumen Terdaftar)</span>
                                  <span className="text-blue-600 font-semibold">{activeSubject.modulAjar.actualValid}/{activeSubject.modulAjar.targetMeetings} Pertemuan Valid</span>
                                </div>
                                <div className="overflow-x-auto max-h-52 border border-slate-200 dark:border-zinc-800 rounded-xl">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold sticky top-0">
                                      <tr>
                                        <th className="py-2 px-3">Judul Modul</th>
                                        <th className="py-2 px-3">Kelas</th>
                                        <th className="py-2 px-3">Tautan Dokumen</th>
                                        <th className="py-2 px-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                      {activeSubject.modulAjar.items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                          <td className="py-2 px-3 font-semibold">{item.title}</td>
                                          <td className="py-2 px-3">{item.className}</td>
                                          <td className="py-2 px-3 font-mono">
                                            {item.link ? (
                                              <a 
                                                href={item.link} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline flex items-center gap-1"
                                              >
                                                Buka Dokumen <ExternalLink className="w-3 h-3" />
                                              </a>
                                            ) : (
                                              <span className="text-slate-400">Tidak ada tautan</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                              item.status === "Valid" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Deep Detail: Jurnal Mengajar */}
                            {(drilldownSelectedComponent === "jurnal" || drilldownPillar === "jurnal") && (
                              <div className="space-y-2">
                                <div className="font-bold text-xs text-slate-800 dark:text-zinc-200 flex justify-between items-center">
                                  <span>Log Jurnal Mengajar ({activeSubject.jurnalMengajar.items.length} Entri Tercatat)</span>
                                  <span className="text-teal-600 font-semibold">{activeSubject.jurnalMengajar.actualFilledJp}/{activeSubject.jurnalMengajar.targetJp} JP Terpenuhi</span>
                                </div>
                                <div className="overflow-x-auto max-h-52 border border-slate-200 dark:border-zinc-800 rounded-xl">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold sticky top-0">
                                      <tr>
                                        <th className="py-2 px-3">Tanggal</th>
                                        <th className="py-2 px-3">Kelas</th>
                                        <th className="py-2 px-3">JP</th>
                                        <th className="py-2 px-3">Materi / Bahasan</th>
                                        <th className="py-2 px-3 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                      {activeSubject.jurnalMengajar.items.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                          <td className="py-2 px-3 font-mono">{item.date}</td>
                                          <td className="py-2 px-3">{item.className}</td>
                                          <td className="py-2 px-3 font-bold">{item.jp} JP</td>
                                          <td className="py-2 px-3">{item.material || "-"}</td>
                                          <td className="py-2 px-3 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                              item.status === "Disetujui" ? "bg-emerald-100 text-emerald-700" :
                                              item.status === "Diajukan" ? "bg-blue-100 text-blue-700" :
                                              "bg-amber-100 text-amber-700"
                                            }`}>
                                              {item.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* 2. SINGLE TEACHER: MUTABAAH YAUMIYAH */}
                  {drilldownPillar === "mutabaah" && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-950/40 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800">
                        <div>
                          <div className="font-bold text-xs text-purple-900 dark:text-purple-200">
                            Ringkasan Mutabaah Yaumiyah
                          </div>
                          <div className="text-[11px] text-purple-700 dark:text-purple-300">
                            {currentDrilldownTeacher.mutabaah.filledDays} Hari Terisi dari {currentDrilldownTeacher.mutabaah.mandatoryDays} Hari Aktif Sekolah ({currentDrilldownTeacher.mutabaah.completeDays} Lengkap, {currentDrilldownTeacher.mutabaah.partialDays} Belum Lengkap, {currentDrilldownTeacher.mutabaah.emptyDays} Belum Mengisi)
                          </div>
                        </div>
                        <span className="text-base font-black text-purple-700 dark:text-purple-300">
                          Skor: {currentDrilldownTeacher.mutabaahScore}%
                        </span>
                      </div>

                      <div className="overflow-x-auto max-h-72 border border-slate-200 dark:border-zinc-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold sticky top-0">
                            <tr>
                              <th className="py-2 px-3">Tanggal</th>
                              <th className="py-2 px-3">Hari</th>
                              <th className="py-2 px-3 text-center">Status</th>
                              <th className="py-2 px-3 text-right">Kelengkapan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                            {currentDrilldownTeacher.mutabaah.dailyRecords.map(rec => (
                              <tr key={rec.date} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                <td className="py-2 px-3 font-mono">{rec.date}</td>
                                <td className="py-2 px-3">{rec.dayName}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    rec.status === "Lengkap" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
                                    rec.status === "Belum Lengkap" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
                                    "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                                  }`}>
                                    {rec.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-bold">
                                  {rec.compliancePercentage}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 3. SINGLE TEACHER: KEHADIRAN & PENALTI */}
                  {drilldownPillar === "attendance" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                          <div className="text-slate-400 text-[10px] font-bold">JML JP (Target SSOT)</div>
                          <div className="font-black text-sm text-slate-800 dark:text-zinc-100">
                            {currentDrilldownTeacher.attendance.jmlJp} JP
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                          <div className="text-slate-400 text-[10px] font-bold">Kehadiran (Hadir/Telat)</div>
                          <div className="font-black text-sm text-emerald-600">
                            {currentDrilldownTeacher.attendance.kehadiranJp} JP
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                          <div className="text-slate-400 text-[10px] font-bold">Terlambat (Penalti)</div>
                          <div className="font-black text-sm text-rose-600">
                            {currentDrilldownTeacher.attendance.terlambatJp} JP (-{currentDrilldownTeacher.attendance.penaltiKeterlambatan}%)
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                          <div className="text-slate-400 text-[10px] font-bold">Nilai Disiplin</div>
                          <div className="font-black text-sm text-amber-600">
                            {currentDrilldownTeacher.attendanceScore}%
                          </div>
                        </div>
                      </div>

                      {/* Sesi Keterlambatan if any */}
                      {currentDrilldownTeacher.attendance.terlambatSessions.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-bold text-xs text-rose-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            Daftar Sesi Terlambat ({currentDrilldownTeacher.attendance.terlambatSessions.length} Sesi)
                          </div>
                          <div className="overflow-x-auto max-h-48 border border-rose-200 dark:border-rose-900 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-bold sticky top-0">
                                <tr>
                                  <th className="py-2 px-3">Tanggal</th>
                                  <th className="py-2 px-3">Mapel</th>
                                  <th className="py-2 px-3">Kelas</th>
                                  <th className="py-2 px-3">Jam Jadwal</th>
                                  <th className="py-2 px-3">Jam Check-In</th>
                                  <th className="py-2 px-3 text-right">Keterlambatan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                {currentDrilldownTeacher.attendance.terlambatSessions.map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                    <td className="py-1.5 px-3 font-mono">{s.date}</td>
                                    <td className="py-1.5 px-3 font-semibold">{s.subjectName}</td>
                                    <td className="py-1.5 px-3">{s.className}</td>
                                    <td className="py-1.5 px-3 font-mono">{s.scheduledTime}</td>
                                    <td className="py-1.5 px-3 font-mono text-rose-600 font-bold">{s.checkInTime}</td>
                                    <td className="py-1.5 px-3 text-right text-rose-600 font-bold">+{s.lateMinutes} mnt</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sesi Menggantikan if any */}
                      {currentDrilldownTeacher.attendance.menggantikanSessions.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-bold text-xs text-blue-600 flex items-center gap-1.5">
                            <Repeat className="w-4 h-4" />
                            Sesi Menggantikan Guru Lain ({currentDrilldownTeacher.attendance.menggantikanSessions.length} Sesi, Total {currentDrilldownTeacher.attendance.menggantikanJp} JP)
                          </div>
                          <div className="overflow-x-auto max-h-40 border border-blue-200 dark:border-blue-900 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-bold sticky top-0">
                                <tr>
                                  <th className="py-2 px-3">Tanggal</th>
                                  <th className="py-2 px-3">Mapel</th>
                                  <th className="py-2 px-3">Kelas</th>
                                  <th className="py-2 px-3">Guru Digantikan</th>
                                  <th className="py-2 px-3 text-right">JP</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                {currentDrilldownTeacher.attendance.menggantikanSessions.map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                    <td className="py-1.5 px-3 font-mono">{s.date}</td>
                                    <td className="py-1.5 px-3 font-semibold">{s.subjectName}</td>
                                    <td className="py-1.5 px-3">{s.className}</td>
                                    <td className="py-1.5 px-3 text-blue-600 font-bold">{s.replacedTeacherName}</td>
                                    <td className="py-1.5 px-3 text-right font-bold">{s.jpCount} JP</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Sesi Digantikan if any */}
                      {currentDrilldownTeacher.attendance.digantikanSessions.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-bold text-xs text-amber-600 flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4" />
                            Sesi Jadwal Digantikan oleh Guru Lain ({currentDrilldownTeacher.attendance.digantikanSessions.length} Sesi, Total {currentDrilldownTeacher.attendance.digantikanJp} JP)
                          </div>
                          <div className="overflow-x-auto max-h-40 border border-amber-200 dark:border-amber-900 rounded-xl">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold sticky top-0">
                                <tr>
                                  <th className="py-2 px-3">Tanggal</th>
                                  <th className="py-2 px-3">Mapel</th>
                                  <th className="py-2 px-3">Kelas</th>
                                  <th className="py-2 px-3">Guru Pengganti</th>
                                  <th className="py-2 px-3 text-right">JP</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                {currentDrilldownTeacher.attendance.digantikanSessions.map((s, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                    <td className="py-1.5 px-3 font-mono">{s.date}</td>
                                    <td className="py-1.5 px-3 font-semibold">{s.subjectName}</td>
                                    <td className="py-1.5 px-3">{s.className}</td>
                                    <td className="py-1.5 px-3 text-emerald-600 font-bold">{s.substituteTeacherName}</td>
                                    <td className="py-1.5 px-3 text-right font-bold">{s.jpCount} JP</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. SINGLE TEACHER: AUDIT TRAIL FORMULA */}
                  {drilldownPillar === "auditTrail" && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 space-y-2">
                        <div className="font-black text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-emerald-600" />
                          Formula & Perhitungan Nilai Akhir Kedisiplinan
                        </div>
                        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-mono bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          {currentDrilldownTeacher.auditTrail.finalFormula}
                        </p>
                      </div>

                      <div className="space-y-3">
                        {/* Pilar 1 */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1.5 text-xs">
                          <div className="font-bold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                            <span>1. Pilar Administrasi Guru ({disciplineConfig.adminWeight}%)</span>
                            <span className="font-black">{currentDrilldownTeacher.administrationScore}%</span>
                          </div>
                          <p className="font-mono text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200 dark:border-zinc-700">
                            {currentDrilldownTeacher.auditTrail.adminFormula}
                          </p>
                        </div>

                        {/* Pilar 2 */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1.5 text-xs">
                          <div className="font-bold text-purple-600 dark:text-purple-400 flex items-center justify-between">
                            <span>2. Pilar Mutabaah Yaumiyah ({disciplineConfig.mutabaahWeight}%)</span>
                            <span className="font-black">{currentDrilldownTeacher.mutabaahScore}%</span>
                          </div>
                          <p className="font-mono text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200 dark:border-zinc-700">
                            {currentDrilldownTeacher.auditTrail.mutabaahFormula}
                          </p>
                        </div>

                        {/* Pilar 3 */}
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 space-y-1.5 text-xs">
                          <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                            <span>3. Pilar Kehadiran Mengajar ({disciplineConfig.attendanceWeight}%)</span>
                            <span className="font-black">{currentDrilldownTeacher.attendanceScore}%</span>
                          </div>
                          <p className="font-mono text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200 dark:border-zinc-700">
                            {currentDrilldownTeacher.auditTrail.attendanceFormula}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                <div className="text-[11px] text-slate-500">
                  {drilldownTargetTeacherId === "ALL" 
                    ? `Menampilkan seluruh ${drilldownFilteredTeachers.length} guru pada pilar ${drilldownPillar}` 
                    : `Menampilkan data detail ${currentDrilldownTeacher?.teacherName}`}
                </div>
                <button
                  onClick={() => {
                    setDrilldownPillar(null);
                    setDrilldownTargetTeacherId("ALL");
                    setDrilldownSelectedSubjectId(null);
                    setDrilldownSelectedComponent(null);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 transition"
                >
                  Tutup Detail
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
