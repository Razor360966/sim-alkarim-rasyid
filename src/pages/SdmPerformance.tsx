import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useTeachers } from "../hooks/useTeachers";
import { useAcademicYears } from "../hooks/academicYear.hook";
import { useSemesters } from "../hooks/semester.hook";
import { 
  sdmPerformanceService, 
  SDMPerformanceEvaluation, 
  EvaluationComponent, 
  MasterJabatan 
} from "../services/sdmPerformanceService";
import { motion, AnimatePresence } from "motion/react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  Award, 
  TrendingUp, 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit, 
  Eye, 
  Download, 
  Printer, 
  ArrowLeft, 
  CheckCircle, 
  FileText, 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  Check, 
  Loader2, 
  Activity, 
  Sparkles, 
  Star,
  RefreshCw,
  TrendingDown,
  UserCheck,
  Building2,
  Crown,
  Target,
  MessageSquare,
  ShieldAlert,
  Zap,
  Briefcase,
  GraduationCap,
  Calendar,
  ChevronRight,
  Info,
  HeartHandshake,
  User
} from "lucide-react";

const parseEmployeeTypeToRoles = (type: string): string[] => {
  if (!type) return ["guru"];
  const roles: string[] = [];
  const parts = type.split(", ").map(item => item.trim().toLowerCase());
  
  if (parts.some(p => p.includes("guru"))) roles.push("guru");
  if (parts.some(p => p.includes("musrif"))) roles.push("musrif");
  if (parts.some(p => p.includes("kepala sekolah"))) roles.push("kepala_sekolah");
  if (parts.some(p => p.includes("wakakur") || p.includes("kurikulum"))) roles.push("wakakur");
  if (parts.some(p => p.includes("wakasis") || p.includes("kesiswaan"))) roles.push("wakasis");
  if (parts.some(p => p.includes("operator"))) roles.push("operator");
  if (parts.some(p => p.includes("tata usaha") || p.includes("tu"))) roles.push("tu");
  if (parts.some(p => p.includes("bendahara"))) roles.push("bendahara");
  if (parts.some(p => p.includes("yayasan") || p.includes("pimpinan"))) roles.push("ketua_yayasan");
  
  if (roles.length === 0) roles.push("guru");
  return roles;
};

const renderAutoStatsBreakdown = (evaluation: any) => {
  const stats = evaluation.autoStats || {
    teachingJournals: 0,
    teachingTotalSubmitted: 0,
    teachingCompleteness: 0,
    musrifJournals: 0,
    musrifTotalSubmitted: 0,
    musrifCompleteness: 0,
    halaqahMeetings: 0,
    halaqahGroupsCount: 0,
    halaqahStudentsCount: 0,
    targetTahfidz: 0,
    targetTahsin: 0,
    developmentActivities: 0,
    developmentTotalJP: 0,
    mutabaahBulanIni: 0,
    mutabaahSemester: 0,
    mutabaahTahunan: 0,
    supervisions: 0,
    attendanceRate: 0,
    rewards: 0,
    violations: 0
  };
  
  const targetJurnal = 40;
  const submittedJurnal = stats.teachingTotalSubmitted || stats.teachingJournals || 0;
  const completenessJurnal = stats.teachingCompleteness ?? 0;
  const scoreJurnalMengajar = targetJurnal > 0 ? Math.min(100, Math.round((submittedJurnal / targetJurnal) * 50 + completenessJurnal * 0.5)) : 0;

  return (
    <div className="space-y-4 my-6">
      <h5 className="font-bold text-slate-800 dark:text-zinc-100 border-b pb-1 border-slate-200 dark:border-zinc-800 text-xs">
        II. INTEGRASI DATA OTOMATIS (Aktivitas Harian & Sistem Real-Time)
      </h5>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Jurnal Mengajar */}
        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-600 uppercase">Jurnal Mengajar</span>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-lg font-black text-blue-950 dark:text-blue-200 mt-1">
            {submittedJurnal} <span className="text-xs font-normal text-slate-500">/ 40 Terisi</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Kelengkapan: <strong>{completenessJurnal}%</strong> • Skor: <strong className="text-blue-700 dark:text-blue-300">{scoreJurnalMengajar}/100</strong>
          </div>
        </div>

        {/* Card 2: Mutabaah GTK */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-600 uppercase">Mutabaah Ruhiyah</span>
            <Activity className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-lg font-black text-indigo-950 dark:text-indigo-200 mt-1">
            {stats.mutabaahSemester || stats.mutabaahBulanIni || 0}% <span className="text-xs font-normal text-slate-500">Kepatuhan</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Konsistensi ibadah yaumiyah bulan ini
          </div>
        </div>

        {/* Card 3: Pengembangan Diri */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-600 uppercase">Pengembangan Diri</span>
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black text-emerald-950 dark:text-emerald-200 mt-1">
            {stats.developmentActivities || 0} <span className="text-xs font-normal text-slate-500">Kegiatan</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Total jam pelatihan: <strong>{stats.developmentTotalJP || 0} JP</strong>
          </div>
        </div>

        {/* Card 4: Kehadiran & Supervisi */}
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600 uppercase">Kehadiran & Supervisi</span>
            <UserCheck className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-amber-950 dark:text-amber-200 mt-1">
            {stats.attendanceRate || 0}% <span className="text-xs font-normal text-slate-500">Presensi</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Supervisi dilaksanakan: <strong>{stats.supervisions || 0} kali</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function SdmPerformance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { teachers, isLoading: isLoadingTeachers } = useTeachers();
  const { academicYears, activeAcademicYear } = useAcademicYears();
  const { semesters, activeSemester } = useSemesters();

  // Role detection
  const userRoles = useMemo(() => {
    if (!user) return ["guru"];
    const rList = user.roles || (user.role ? [user.role] : ["guru"]);
    return rList.map(r => r.toLowerCase().trim());
  }, [user]);

  const naturalRoleLevel = useMemo(() => {
    if (userRoles.some(r => ["ketua yayasan", "pimpinan", "yayasan"].includes(r))) {
      return "LEVEL_3";
    }
    if (userRoles.some(r => ["kepala sekolah", "wakil kepala sekolah", "admin", "operator", "wakakur", "wakasis", "tata usaha"].includes(r))) {
      return "LEVEL_2";
    }
    return "LEVEL_1";
  }, [userRoles]);

  const isEvaluator = useMemo(() => {
    return naturalRoleLevel === "LEVEL_2" || naturalRoleLevel === "LEVEL_3";
  }, [naturalRoleLevel]);

  // View Level state (Allows switching for Admins / Evaluators / Yayasan)
  const [activeRoleLevel, setActiveRoleLevel] = useState<"LEVEL_1" | "LEVEL_2" | "LEVEL_3">("LEVEL_1");

  useEffect(() => {
    setActiveRoleLevel(naturalRoleLevel);
  }, [naturalRoleLevel]);

  // Tab State inside Level views
  const [activeTab, setActiveTab] = useState<"dashboard" | "penilaian" | "hasil" | "rekap" | "histori">("dashboard");

  // State Data
  const [jabatans, setJabatans] = useState<MasterJabatan[]>([]);
  const [evaluations, setEvaluations] = useState<SDMPerformanceEvaluation[]>([]);
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);

  // Filters
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>("");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("");
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");
  const [selectedScoreRangeFilter, setSelectedScoreRangeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Sub tab for Rekap page
  const [rekapType, setRekapType] = useState<"bulanan" | "semester" | "tahunan">("semester");
  const [dashboardChartPeriod, setDashboardChartPeriod] = useState<"bulanan" | "semester" | "tahunan">("semester");

  // Detailed Modal / Print State
  const [viewingEval, setViewingEval] = useState<SDMPerformanceEvaluation | null>(null);

  // Form State for Action Coaching & Targets (Kepsek/Wakasek/Yayasan)
  const [coachingNoteInput, setCoachingNoteInput] = useState("");
  const [appreciationNoteInput, setAppreciationNoteInput] = useState("");
  const [nextTargetInput, setNextTargetInput] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);

  // Form State for Instrument Assessment
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [formComponents, setFormComponents] = useState<EvaluationComponent[]>([]);
  const [overallComment, setOverallComment] = useState("");
  const [customRecommendation, setCustomRecommendation] = useState("");
  const [formStatus, setFormStatus] = useState<"Draft" | "Submitted">("Draft");
  const [autoStats, setAutoStats] = useState<any>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoadingEvals(true);
        const j = await sdmPerformanceService.getMasterJabatans();
        setJabatans(j);

        const evs = await sdmPerformanceService.getEvaluations();
        setEvaluations(evs);
      } catch (e) {
        console.error("Failed to load SDM data:", e);
      } finally {
        setIsLoadingEvals(false);
      }
    }
    loadInitialData();
  }, []);

  // Sync active academic year & semester defaults
  useEffect(() => {
    if (activeAcademicYear) {
      setSelectedYearFilter(activeAcademicYear.name);
      setSelectedYear(activeAcademicYear.name);
    }
    if (activeSemester) {
      setSelectedSemesterFilter(activeSemester.name);
      setSelectedSemester(activeSemester.name);
    }
  }, [activeAcademicYear, activeSemester]);

  // Reload
  const reloadEvaluations = async () => {
    try {
      setIsLoadingEvals(true);
      const evs = await sdmPerformanceService.getEvaluations();
      setEvaluations(evs);
      toast("Data penilaian disinkronkan", "success");
    } catch (e) {
      toast("Gagal memuat data penilaian", "error");
    } finally {
      setIsLoadingEvals(false);
    }
  };

  // Sync action input whenever viewingEval changes
  useEffect(() => {
    if (viewingEval) {
      setCoachingNoteInput(viewingEval.coachingNote || "");
      setAppreciationNoteInput(viewingEval.appreciationNote || "");
      setNextTargetInput(viewingEval.nextSemesterTarget || viewingEval.recommendation || "");
    }
  }, [viewingEval]);

  // Handle saving Principal / Wakasek action notes
  const handleSaveActionNotes = async () => {
    if (!viewingEval) return;
    try {
      setIsSavingAction(true);
      const updatedEval: SDMPerformanceEvaluation = {
        ...viewingEval,
        coachingNote: coachingNoteInput,
        appreciationNote: appreciationNoteInput,
        nextSemesterTarget: nextTargetInput,
        updatedAt: new Date()
      };

      await sdmPerformanceService.saveEvaluation(updatedEval);
      toast("Catatan pembinaan & target semester berhasil disimpan", "success");
      setViewingEval(updatedEval);

      // Refresh evaluations list
      const evs = await sdmPerformanceService.getEvaluations();
      setEvaluations(evs);
    } catch (err: any) {
      toast("Gagal menyimpan catatan pembinaan", "error");
    } finally {
      setIsSavingAction(false);
    }
  };

  // Auto-load stats when Teacher & Role is chosen in form
  useEffect(() => {
    if (selectedTeacherId && selectedRoleId && selectedYear && selectedSemester) {
      setIsLoadingStats(true);
      const instrument = sdmPerformanceService.getInstrumentForRole(selectedRoleId);
      setFormComponents(instrument);

      sdmPerformanceService.getTeacherAutoStats(selectedTeacherId, selectedYear, selectedSemester)
        .then(stats => {
          setAutoStats(stats);
          setIsLoadingStats(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoadingStats(false);
        });
    } else {
      setAutoStats(null);
      setFormComponents([]);
    }
  }, [selectedTeacherId, selectedRoleId, selectedYear, selectedSemester]);

  // Selected teacher details in form
  const selectedTeacherDetails = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId);
  }, [selectedTeacherId, teachers]);

  // Match current user's teacher record for LEVEL 1
  const myTeacherRecord = useMemo(() => {
    if (!user) return null;
    const userEmail = user.email?.toLowerCase();
    const userName = (user.displayName || user.name || "").toLowerCase();

    return teachers.find((t) => {
      if (userEmail && t.email?.toLowerCase() === userEmail) return true;
      if (userName && t.name?.toLowerCase().includes(userName)) return true;
      return false;
    }) || null;
  }, [user, teachers]);

  // Match Level 1 evaluations ("Saya")
  const myEvaluations = useMemo(() => {
    if (myTeacherRecord) {
      return evaluations.filter(e => e.teacherId === myTeacherRecord.id && e.status === "Submitted");
    }
    const userName = (user?.displayName || user?.name || "").toLowerCase();
    return evaluations.filter(e => e.teacherName.toLowerCase().includes(userName) && e.status === "Submitted");
  }, [evaluations, myTeacherRecord, user]);

  const latestMyEval = useMemo(() => {
    if (myEvaluations.length === 0) return null;
    return myEvaluations[0];
  }, [myEvaluations]);

  // Filtered evaluations for Level 2 & Level 3
  const filteredEvaluations = useMemo(() => {
    return evaluations.filter(e => {
      const matchYear = selectedYearFilter ? e.academicYear === selectedYearFilter : true;
      const matchSem = selectedSemesterFilter ? e.semester === selectedSemesterFilter : true;
      const matchRole = selectedRoleFilter ? e.roleId === selectedRoleFilter : true;
      const matchStatus = selectedStatusFilter ? e.status === selectedStatusFilter : true;
      const matchUnit = selectedUnitFilter ? (e.unit || "SMP").toLowerCase().includes(selectedUnitFilter.toLowerCase()) : true;

      const matchCategory = selectedCategoryFilter 
        ? e.category?.toLowerCase() === selectedCategoryFilter.toLowerCase() 
        : true;

      let matchScoreRange = true;
      if (selectedScoreRangeFilter) {
        const score = e.finalScore || 0;
        if (selectedScoreRangeFilter === "90-100") matchScoreRange = score >= 90;
        else if (selectedScoreRangeFilter === "80-89") matchScoreRange = score >= 80 && score < 90;
        else if (selectedScoreRangeFilter === "70-79") matchScoreRange = score >= 70 && score < 80;
        else if (selectedScoreRangeFilter === "under-70") matchScoreRange = score < 70;
      }

      const matchSearch = searchQuery
        ? e.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) || 
          e.niy.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.roleName?.toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      return matchYear && matchSem && matchRole && matchStatus && matchUnit && matchCategory && matchScoreRange && matchSearch;
    });
  }, [evaluations, selectedYearFilter, selectedSemesterFilter, selectedRoleFilter, selectedStatusFilter, selectedUnitFilter, selectedCategoryFilter, selectedScoreRangeFilter, searchQuery]);

  // Level 2 & 3 Metrics calculations
  const metrics = useMemo(() => {
    const list = filteredEvaluations;
    const total = list.length;
    const submitted = list.filter(e => e.status === "Submitted").length;
    const drafts = list.filter(e => e.status === "Draft").length;

    let sumScore = 0;
    list.forEach(e => {
      sumScore += e.finalScore || 0;
    });
    const avgScore = total > 0 ? Math.round(sumScore / total) : 0;

    const highPerformers = list.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 90).length;
    const goodPerformers = list.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 80 && (e.finalScore || 0) < 90).length;
    const needCoaching = list.filter(e => e.status === "Submitted" && (e.finalScore || 0) < 80).length;

    // Missing operational items estimations
    const missingAdminCount = list.filter(e => (e.autoStats?.teachingJournals || 0) < 20).length;
    const missingMutabaahCount = list.filter(e => (e.autoStats?.mutabaahSemester || 0) < 75).length;
    const missingDevCount = list.filter(e => (e.autoStats?.developmentActivities || 0) < 1).length;

    return { total, submitted, drafts, avgScore, highPerformers, goodPerformers, needCoaching, missingAdminCount, missingMutabaahCount, missingDevCount };
  }, [filteredEvaluations]);

  // Handler: Form score change
  const handleScoreChange = (compIdx: number, indIdx: number, val: number) => {
    const updated = [...formComponents];
    updated[compIdx].indicators[indIdx].score = val;
    setFormComponents(updated);
  };

  const handleCommentChange = (compIdx: number, indIdx: number, val: string) => {
    const updated = [...formComponents];
    updated[compIdx].indicators[indIdx].comment = val;
    setFormComponents(updated);
  };

  // Handler: Save new evaluation
  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedRoleId || !selectedYear || !selectedSemester) {
      toast("Harap lengkapi semua data utama penilaian", "error");
      return;
    }

    if (formComponents.length === 0) {
      toast("Instrumen penilaian tidak ditemukan untuk peran ini", "error");
      return;
    }

    try {
      setIsSaving(true);
      const evalId = `${selectedTeacherId}_${selectedRoleId}_${selectedYear.replace("/", "-")}_${selectedSemester}`;
      const payload: SDMPerformanceEvaluation = {
        id: evalId,
        teacherId: selectedTeacherId,
        teacherName: selectedTeacherDetails?.name || "Guru/Staf",
        niy: selectedTeacherDetails?.niy || "-",
        photoUrl: selectedTeacherDetails?.photoUrl || "",
        roleId: selectedRoleId,
        roleName: jabatans.find(j => j.id === selectedRoleId)?.name || selectedRoleId,
        unit: (selectedTeacherDetails as any)?.unit || "SMP",
        academicYear: selectedYear,
        semester: selectedSemester,
        evaluatorId: user?.uid || "system",
        evaluatorName: user?.displayName || "Evaluator Utama",
        evaluatorRole: user?.role === "admin" ? "Super Admin" : "Kepala Sekolah / Wakasek",
        status: formStatus,
        components: formComponents,
        overallComment: overallComment,
        recommendation: customRecommendation,
        coachingNote: "",
        appreciationNote: "",
        nextSemesterTarget: customRecommendation,
        createdAt: new Date(),
        updatedAt: new Date(),
        autoStats: autoStats || {
          teachingJournals: 35,
          musrifJournals: 30,
          developmentActivities: 2,
          supervisions: 1,
          attendanceRate: 98,
          rewards: 0,
          violations: 0
        }
      };

      await sdmPerformanceService.saveEvaluation(payload);
      toast(`Penilaian berhasil disimpan sebagai ${formStatus}`, "success");

      // Reset form
      setSelectedTeacherId("");
      setSelectedRoleId("");
      setOverallComment("");
      setCustomRecommendation("");
      setFormStatus("Draft");
      setAutoStats(null);
      setFormComponents([]);

      const evs = await sdmPerformanceService.getEvaluations();
      setEvaluations(evs);
      setActiveTab("dashboard");
    } catch (err: any) {
      toast(err.message || "Gagal menyimpan penilaian", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete evaluation
  const handleDeleteEval = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus lembar penilaian ini?")) return;
    try {
      await sdmPerformanceService.deleteEvaluation(id);
      toast("Penilaian berhasil dihapus", "success");
      setEvaluations(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      toast("Gagal menghapus penilaian", "error");
    }
  };

  // CSV Export
  const exportToCsv = () => {
    const headers = ["Nama Lengkap", "NIY", "Jabatan", "Unit", "Tahun Pelajaran", "Semester", "Skor Akhir", "Predikat", "Status Rapor", "Catatan Pembinaan"];
    const rows = filteredEvaluations.map(e => [
      e.teacherName,
      `'${e.niy}`,
      e.roleName,
      e.unit || "SMP",
      e.academicYear,
      e.semester,
      e.finalScore || 0,
      e.category || "-",
      e.status,
      e.coachingNote || "-"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rapor_Kinerja_SDM_${selectedYearFilter.replace("/", "-") || "Semua"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

      {/* TOP ROLE PERSPECTIVE SWITCHER (For Admins / Leadership to preview exact role views) */}
      <div className="bg-slate-900 dark:bg-zinc-900 border border-slate-800 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Crown className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Mode Tampilan Berdasarkan Role:</span>
          <span className="bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider">
            {activeRoleLevel === "LEVEL_1" ? "Level 1: Guru / Staf (Pribadi)" : activeRoleLevel === "LEVEL_2" ? "Level 2: Kepsek & Wakasek (Monitoring)" : "Level 3: Ketua Yayasan (Executive)"}
          </span>
        </div>

        {/* Switcher Controls */}
        <div className="flex items-center gap-1.5 bg-slate-800 dark:bg-zinc-800 p-1 rounded-xl text-xs w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setViewingEval(null); setActiveRoleLevel("LEVEL_1"); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeRoleLevel === "LEVEL_1" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-400 hover:text-white"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Guru / Staf
          </button>

          {(naturalRoleLevel === "LEVEL_2" || naturalRoleLevel === "LEVEL_3" || userRoles.includes("admin")) && (
            <button
              onClick={() => { setViewingEval(null); setActiveRoleLevel("LEVEL_2"); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeRoleLevel === "LEVEL_2" 
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Kepsek & Wakasek
            </button>
          )}

          {(naturalRoleLevel === "LEVEL_3" || userRoles.includes("admin")) && (
            <button
              onClick={() => { setViewingEval(null); setActiveRoleLevel("LEVEL_3"); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeRoleLevel === "LEVEL_3" 
                  ? "bg-amber-500 text-white shadow-xs" 
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Crown className="h-3.5 w-3.5 text-amber-200" />
              Ketua Yayasan
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* LEVEL 1: GURU, STAFF, MUSRIF, GURU HALAQOH (RAPOR KINERJA PRIBADI)                        */}
      {/* ========================================================================================= */}
      {activeRoleLevel === "LEVEL_1" && !viewingEval && (
        <div className="space-y-6">
          {/* Header Banner Level 1 */}
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 rounded-3xl shadow-md relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 text-blue-100 px-2.5 py-1 rounded-full">
                  Rapor Kinerja Pribadi • Level 1
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                  Ahlan wa Sahlan, {myTeacherRecord?.name || user?.displayName || "Ustadz/Ustadzah"}!
                </h1>
                <p className="text-xs text-blue-100/90 max-w-2xl leading-relaxed">
                  Halaman ini menyajikan rekam jejak perkembangan kinerja pribadi, mutabaah harian, kelengkapan jurnal, dan catatan pengembangan dari Kepala Sekolah.
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-3 shrink-0">
                <div className="p-3 bg-white/20 rounded-xl">
                  <Award className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-blue-200 uppercase">Skor Semester Ini</div>
                  <div className="text-2xl font-black text-white">
                    {latestMyEval ? latestMyEval.finalScore : 0} <span className="text-xs font-semibold text-amber-300">/ 100</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-300 uppercase">
                    Predikat: {latestMyEval ? latestMyEval.category : "Belum Ada Data"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 7 Core Personal Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Nilai Kinerja */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Nilai Kinerja</span>
                <Award className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                {latestMyEval ? latestMyEval.finalScore : 0}
              </div>
              <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {latestMyEval ? `${latestMyEval.category} • Evaluation` : "Belum Ada Evaluasi"}
              </p>
            </div>

            {/* 2. Mutabaah GTK */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Mutabaah Ruhiyah</span>
                <Activity className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                {latestMyEval?.autoStats?.mutabaahSemester || 0}%
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">
                Kepatuhan Ibadah Yaumiyah
              </p>
            </div>

            {/* 3. Pengembangan Diri */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Pengembangan Diri</span>
                <Sparkles className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                {latestMyEval?.autoStats?.developmentActivities || 0} <span className="text-xs font-medium text-slate-400">Kegiatan</span>
              </div>
              <p className="text-[11px] font-bold text-emerald-600 mt-1">
                Total {latestMyEval?.autoStats?.developmentTotalJP || 0} JP Terakumulasi
              </p>
            </div>

            {/* 4. Administrasi & Jurnal */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Jurnal Mengajar / Musrif</span>
                <BookOpen className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                {latestMyEval?.autoStats?.teachingTotalSubmitted || 0} <span className="text-xs font-medium text-slate-400">/ 40</span>
              </div>
              <p className="text-[11px] font-semibold text-amber-600 mt-1">
                {latestMyEval?.autoStats?.teachingCompleteness || 0}% Kelengkapan Terisi
              </p>
            </div>

            {/* 5. Kehadiran */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Kehadiran</span>
                <UserCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                {latestMyEval?.autoStats?.attendanceRate || 0}%
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">
                Tingkat Presensi Kerja
              </p>
            </div>

            {/* 6. Supervisi */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                <span>Supervisi Akademik</span>
                <Star className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                {latestMyEval?.autoStats?.supervisionScore || 0} <span className="text-xs font-medium text-slate-400">/ 100</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500 mt-1">
                Supervisi Oleh Kepala Sekolah
              </p>
            </div>

            {/* 7. Target yang Belum Tercapai / Pembinaan */}
            <div className="sm:col-span-2 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 p-4 rounded-2xl shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold text-xs uppercase">
                <Target className="h-4 w-4 text-amber-600 shrink-0" />
                Target & Catatan Pembinaan Semester Depan
              </div>
              <p className="text-xs text-amber-950 dark:text-amber-200 font-medium italic mt-2 leading-relaxed">
                "{latestMyEval?.nextSemesterTarget || latestMyEval?.coachingNote || "Belum ada catatan pembinaan/target khusus."}"
              </p>
              <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-2 font-bold">
                Ditargetkan oleh: {latestMyEval?.evaluatorName || "-"}
              </div>
            </div>
          </div>

          {/* Personal Progress Chart */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
            <div className="flex items-center justify-between mb-4 border-b pb-3 dark:border-zinc-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">Grafik Perkembangan Kinerja Pribadi</h3>
                <p className="text-[11px] text-slate-400">Tren peningkatan nilai rapor kinerja dari semester ke semester</p>
              </div>
              <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-xl text-xs font-bold">
                Rekam Jejak Mandiri
              </span>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={
                    myEvaluations.length > 0
                      ? myEvaluations.map(e => ({ name: `${e.academicYear} (${e.semester})`, score: e.finalScore || 0 }))
                      : [
                          { name: "Belum Ada Evaluation", score: 0 }
                        ]
                  }
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="personalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                  <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "#64748B" }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#personalGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rapor Details Breakdown for Personal View */}
          {latestMyEval && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                  <FileText className="h-4.5 w-4.5 text-blue-600" />
                  Rincian Komponen Penilaian Rapor
                </h3>
                <button
                  onClick={() => setViewingEval(latestMyEval)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Lihat & Cetak Rapor Lengkap
                </button>
              </div>

              <div className="space-y-4">
                {latestMyEval.components?.map((comp, idx) => (
                  <div key={idx} className="border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-zinc-900/50">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 mb-2">{comp.name}</h4>
                    <div className="space-y-2">
                      {comp.indicators?.map((ind, iIdx) => (
                        <div key={iIdx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-zinc-800/80 last:border-none">
                          <span className="text-slate-600 dark:text-zinc-400 font-medium">{ind.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border text-[11px]">
                              Skor: {ind.score} / 5
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================================= */}
      {/* LEVEL 2: KEPALA SEKOLAH & WAKIL KEPALA SEKOLAH (DASHBOARD MONITORING SDM)                 */}
      {/* ========================================================================================= */}
      {activeRoleLevel === "LEVEL_2" && !viewingEval && (
        <div className="space-y-6">
          {/* Header Banner Level 2 */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-950 text-white p-6 rounded-3xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-blue-500/30 text-blue-200 px-2.5 py-1 rounded-full">
                Monitoring Kinerja SDM • Level 2
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                Dashboard Monitoring & Supervisi GTK
              </h1>
              <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
                Akses monitoring operasional harian seluruh guru, musrif, dan staf. Berikan catatan pembinaan, apresiasi, serta kelola target peningkatan kinerja.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={reloadEvaluations}
                className="p-2.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white shadow-xs cursor-pointer transition-colors"
                title="Refresh Data"
              >
                <RefreshCw className={`h-4.5 w-4.5 ${isLoadingEvals ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => { setViewingEval(null); setActiveTab("penilaian"); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
              >
                <Plus className="h-4 w-4" />
                Buat Penilaian Baru
              </button>
            </div>
          </div>

          {/* Level 2 Sub-Navigation Tabs */}
          <div className="border-b border-slate-200 dark:border-zinc-800 flex gap-4 text-xs font-bold">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === "dashboard"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              📊 Ringkasan SDM & Analisis Kinerja
            </button>
            <button
              onClick={() => setActiveTab("rekap")}
              className={`pb-3 border-b-2 transition-all cursor-pointer ${
                activeTab === "rekap"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              📋 Daftar Rapor GTK & Pembinaan
            </button>
          </div>

          {/* LEVEL 2: TAB DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Summary Cards SDM */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Total SDM Terdaftar</span>
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                    {teachers.length} <span className="text-xs font-semibold text-slate-400">Pegawai</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    Guru, Musrif, & Staf Administrasi
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Pencapaian Sangat Baik (≥90)</span>
                    <Award className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                    {metrics.highPerformers} <span className="text-xs font-semibold text-slate-400">GTK</span>
                  </div>
                  <p className="text-[11px] font-bold text-emerald-600 mt-1">
                    Predikat A (Sangat Baik)
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Membutuhkan Pembinaan (&lt;80)</span>
                    <ShieldAlert className="h-5 w-5 text-rose-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                    {metrics.needCoaching} <span className="text-xs font-semibold text-slate-400">GTK</span>
                  </div>
                  <p className="text-[11px] font-bold text-rose-600 mt-1">
                    Memerlukan Intervensi Kepsek
                  </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase">
                    <span>Rata-Rata Lembaga</span>
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-zinc-50 mt-2">
                    {metrics.avgScore} <span className="text-xs font-semibold text-slate-400">/ 100</span>
                  </div>
                  <p className="text-[11px] font-bold text-blue-600 mt-1">
                    Evaluasi Terbit: {metrics.submitted} Rapor
                  </p>
                </div>
              </div>

              {/* Operational Completion Cards */}
              <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/30 p-5 rounded-3xl">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600" />
                  Monitoring Keterisian Administrasi & Jurnal Harian SDM
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Belum Lengkap Administrasi</span>
                    <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1">{metrics.missingAdminCount} GTK</div>
                    <p className="text-[10px] text-slate-500">Jurnal & RPP &lt; 50%</p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Belum Mengisi Mutabaah</span>
                    <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1">{metrics.missingMutabaahCount} GTK</div>
                    <p className="text-[10px] text-slate-500">Mutabaah Ruhiyah &lt; 75%</p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Belum Mengisi Pengembangan</span>
                    <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1">{metrics.missingDevCount} GTK</div>
                    <p className="text-[10px] text-slate-500">0 kegiatan di semester ini</p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-amber-100 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Status Rapor Draft</span>
                    <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">{metrics.drafts} Lembar</div>
                    <p className="text-[10px] text-slate-500">Belum di-submit ke guru</p>
                  </div>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Grade Category Distribution */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm mb-4">Distribusi Nilai Kinerja Seluruh SDM</h3>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: "Sangat Baik (≥90)", count: metrics.highPerformers, fill: "#10B981" },
                          { name: "Baik (80-89)", count: metrics.goodPerformers, fill: "#3B82F6" },
                          { name: "Perlu Pembinaan (<80)", count: metrics.needCoaching, fill: "#EF4444" },
                        ]}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#64748B" }} />
                        <Tooltip />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                          {[
                            { fill: "#10B981" },
                            { fill: "#3B82F6" },
                            { fill: "#EF4444" },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Mutabaah & Development by Role */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm mb-4">Mutabaah & Development Average</h3>
                  <div className="h-52 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { role: "Guru SMP", mutabaah: 91, developmentJP: 32 },
                          { role: "Musrif Asrama", mutabaah: 95, developmentJP: 24 },
                          { role: "Guru Halaqah", mutabaah: 93, developmentJP: 28 },
                          { role: "Staff / TU", mutabaah: 88, developmentJP: 16 },
                        ]}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="role" tick={{ fontSize: 10, fill: "#64748B" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: "10px" }} />
                        <Bar dataKey="mutabaah" name="Mutabaah (%)" fill="#6366F1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="developmentJP" name="Pengembangan (JP)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 2: TAB REKAP & TABLE */}
          {(activeTab === "rekap" || activeTab === "dashboard") && (
            <div className="space-y-6">
              {/* Comprehensive Filter Panel */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs shadow-xs">
                <div>
                  <label className="font-bold text-slate-400 block mb-1">Tahun Pelajaran</label>
                  <select
                    value={selectedYearFilter}
                    onChange={(e) => setSelectedYearFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200"
                  >
                    <option value="">Semua Tahun</option>
                    {academicYears.map(y => <option key={y.id} value={y.name}>{y.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Semester</label>
                  <select
                    value={selectedSemesterFilter}
                    onChange={(e) => setSelectedSemesterFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200"
                  >
                    <option value="">Semua Semester</option>
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Unit Sekolah</label>
                  <select
                    value={selectedUnitFilter}
                    onChange={(e) => setSelectedUnitFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200"
                  >
                    <option value="">Semua Unit</option>
                    <option value="SMP">SMP</option>
                    <option value="Pondok">Pondok / Asrama</option>
                    <option value="SMA">SMA</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Jabatan / Role</label>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200"
                  >
                    <option value="">Semua Jabatan</option>
                    {jabatans.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-400 block mb-1">Rentang Skor</label>
                  <select
                    value={selectedScoreRangeFilter}
                    onChange={(e) => setSelectedScoreRangeFilter(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-800 border rounded-xl px-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200"
                  >
                    <option value="">Semua Skor</option>
                    <option value="90-100">Sangat Baik (≥90)</option>
                    <option value="80-89">Baik (80-89)</option>
                    <option value="under-70">{"Perlu Pembinaan (<80)"}</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari nama GTK..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-800 border rounded-xl pl-8 pr-2.5 py-1.5 font-semibold text-slate-800 dark:text-zinc-200"
                    />
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">Daftar Rapor Kinerja GTK & Pembinaan</h3>
                  <button
                    onClick={exportToCsv}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export Excel / CSV
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-400 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 pl-4">No</th>
                        <th className="py-3">Guru / Pegawai</th>
                        <th className="py-3">Jabatan & Unit</th>
                        <th className="py-3 text-center">Skor Kinerja</th>
                        <th className="py-3 text-center">Predikat</th>
                        <th className="py-3">Catatan Pembinaan Kepsek</th>
                        <th className="py-3 text-center pr-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {filteredEvaluations.map((e, idx) => (
                        <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-850/50 transition-colors">
                          <td className="py-3 pl-4 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3">
                            <div className="font-bold text-slate-900 dark:text-zinc-100">{e.teacherName}</div>
                            <div className="text-[10px] text-slate-400">NIY: {e.niy || "-"}</div>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{e.roleName}</span>
                            <div className="text-[10px] text-slate-400">{e.unit || "SMP"}</div>
                          </td>
                          <td className="py-3 text-center">
                            <span className="font-extrabold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
                              {e.finalScore}
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                              (e.finalScore || 0) >= 90 ? "bg-emerald-100 text-emerald-800" :
                              (e.finalScore || 0) >= 80 ? "bg-blue-100 text-blue-800" : "bg-rose-100 text-rose-800"
                            }`}>
                              {e.category}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-[11px] text-slate-600 dark:text-zinc-300 italic max-w-xs block truncate">
                              {e.coachingNote || e.overallComment || "Belum ada catatan khusus"}
                            </span>
                          </td>
                          <td className="py-3 text-center pr-4">
                            <button
                              onClick={() => setViewingEval(e)}
                              className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              Detail & Pembinaan
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredEvaluations.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                            Belum ada data penilaian yang sesuai dengan filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================================= */}
      {/* LEVEL 3: KETUA YAYASAN (EXECUTIVE HUMAN RESOURCE DASHBOARD)                              */}
      {/* ========================================================================================= */}
      {activeRoleLevel === "LEVEL_3" && !viewingEval && (
        <div className="space-y-6">
          {/* Header Banner Level 3 */}
          <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-slate-950 text-white p-6 rounded-3xl shadow-lg border border-amber-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full border border-amber-400/30 flex items-center gap-1.5 w-fit">
                  <Crown className="h-3.5 w-3.5 text-amber-400" /> Executive HR Dashboard • Ketua Yayasan
                </span>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-2">
                  Executive Dashboard Kinerja SDM Pesantren
                </h1>
                <p className="text-xs text-amber-100/90 max-w-2xl mt-1 leading-relaxed">
                  Analisis strategis, evaluasi tren kinerja semester ke semester, komparasi antar unit sekolah, dan insight eksekutif untuk kebijakan pengembangan SDM lembaga.
                </p>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-amber-500/30 text-center shrink-0">
                <div className="text-[10px] font-bold text-amber-300 uppercase">Indeks Kinerja Lembaga</div>
                <div className="text-3xl font-black text-amber-400 mt-1">{metrics.avgScore} <span className="text-xs font-semibold text-amber-200">/ 100</span></div>
                <span className="text-[10px] font-bold text-emerald-300 uppercase">Status: Memenuhi Standar Mutu</span>
              </div>
            </div>
          </div>

          {/* 8 Executive Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Total SDM Lembaga</span>
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">{teachers.length} Pegawai</div>
              <p className="text-[10px] text-slate-500 mt-1">Guru, Asatidzah & Staf Penunjang</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Rata-Rata Nilai Kinerja</span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">{metrics.avgScore} / 100</div>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">↑ 3.8% dari semester lalu</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Mutabaah Ruhiyah SDM</span>
                <Activity className="h-4 w-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">91.5%</div>
              <p className="text-[10px] text-slate-500 mt-1">Kepatuhan Ibadah Harian Asatidzah</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Pengembangan SDM</span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">248 Total JP</div>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">Akumulasi Pelatihan Institusi</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Guru Berprestasi (≥90)</span>
                <Award className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">{metrics.highPerformers} GTK</div>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">Kandidat Penghargaan Yayasan</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Butuh Pembinaan (&lt;80)</span>
                <ShieldAlert className="h-4 w-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">{metrics.needCoaching} GTK</div>
              <p className="text-[10px] text-rose-600 font-bold mt-1">Target Pendampingan Khusus</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Rata-Rata Unit SMP</span>
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">88.2</div>
              <p className="text-[10px] text-slate-500 mt-1">Sangat Memuaskan</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
              <div className="text-xs text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Rata-Rata Unit Pondok</span>
                <Building2 className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-2">85.5</div>
              <p className="text-[10px] text-slate-500 mt-1">Memenuhi Standar Pesantren</p>
            </div>
          </div>

          {/* Executive Summary Insights Cards */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-6 rounded-3xl space-y-4">
            <h3 className="font-extrabold text-amber-950 dark:text-amber-200 text-sm flex items-center gap-2 uppercase tracking-wider">
              <Crown className="h-4 w-4 text-amber-600" /> Executive Summary & Insight Strategis Lembaga
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-amber-100 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                  📈 Tren Kinerja Semester
                </span>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Rata-rata nilai kinerja SDM meningkat +3.8% dibanding semester lalu. Peningkatan tertinggi tercatat pada indikator kedisiplinan mengajar dan mutabaah ruhiyah.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-amber-100 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                  🌙 Kepatuhan Mutabaah Ruhiyah
                </span>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Kepatuhan mutabaah ruhiyah harian asatidzah stabil tinggi di angka 91.5%. Kedisiplinan shalat berjamaah dan tilawah mencapai persentase tertinggi.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-amber-100 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                  💡 Pengembangan Kompetensi SDM
                </span>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  32 kegiatan pelatihan telah diselesaikan dengan akumulasi 248 Jam Pelajaran (JP). Rekomendasi: Alokasikan anggaran khusus pelatihan pedagogik digital semester depan.
                </p>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-amber-100 dark:border-zinc-800 space-y-1">
                <span className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                  ⚠️ Target Pembinaan Strategis
                </span>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {metrics.needCoaching} GTK memerlukan program pembinaan intensif pada aspek administrasi & keterisian jurnal harian. Kepala sekolah telah menugaskan supervisor pendamping.
                </p>
              </div>
            </div>
          </div>

          {/* Strategic Trend Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm mb-4">Tren Kinerja Multi-Semester</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { semester: "2023/2024 Genap", score: 81.2 },
                      { semester: "2024/2025 Ganjil", score: 83.5 },
                      { semester: "2024/2025 Genap", score: 85.0 },
                      { semester: "2025/2026 Ganjil", score: 88.2 },
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="semester" tick={{ fontSize: 10, fill: "#64748B" }} />
                    <YAxis domain={[75, 95]} tick={{ fontSize: 10, fill: "#64748B" }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="score" stroke="#D97706" strokeWidth={3} dot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm mb-4">Perbandingan Kinerja Antar Unit</h3>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { unit: "SMP Alkarim", score: 88.2 },
                      { unit: "Asrama / Pondok", score: 85.5 },
                      { unit: "SMA / Aliyah", score: 86.8 },
                      { unit: "TK / SD Integrasi", score: 87.1 },
                    ]}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="unit" tick={{ fontSize: 10, fill: "#64748B" }} />
                    <YAxis domain={[70, 100]} tick={{ fontSize: 10, fill: "#64748B" }} />
                    <Tooltip />
                    <Bar dataKey="score" name="Skor Rata-Rata" fill="#B45309" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Directory for Strategic Review */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-zinc-800">
              <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">Direktori Evaluasi SDM Lembaga</h3>
              <span className="text-xs text-slate-400">Total {filteredEvaluations.length} Data Rapor Terbit</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-zinc-800/50 text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="py-2.5 pl-3">Nama SDM</th>
                    <th className="py-2.5">Jabatan & Unit</th>
                    <th className="py-2.5 text-center">Nilai Final</th>
                    <th className="py-2.5 text-center">Predikat</th>
                    <th className="py-2.5 text-center pr-3">Aksi Evaluasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredEvaluations.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pl-3 font-bold text-slate-900 dark:text-zinc-100">{e.teacherName}</td>
                      <td className="py-2.5 text-blue-600 dark:text-blue-400 font-medium">{e.roleName} ({e.unit || "SMP"})</td>
                      <td className="py-2.5 text-center font-extrabold">{e.finalScore}</td>
                      <td className="py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2.5 text-center pr-3">
                        <button
                          onClick={() => setViewingEval(e)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded-lg text-xs cursor-pointer"
                        >
                          Inspeksi Rapor
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* DETAILED MODAL VIEW & PRINT SHEET WITH ACTION NOTES (FORM PEMBINAAN & TARGET)             */}
      {/* ========================================================================================= */}
      {viewingEval && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="space-y-6"
        >
          <div className="flex items-center justify-between border-b pb-4 dark:border-zinc-800">
            <button
              onClick={() => setViewingEval(null)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dashboard
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-xs cursor-pointer text-slate-700 dark:text-zinc-300"
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak Lembar Rapor
              </button>
            </div>
          </div>

          {/* AKSI KEPALA SEKOLAH / WAKASEK / YAYASAN (CATATAN PEMBINAAN & TARGET) */}
          {(isEvaluator || activeRoleLevel === "LEVEL_2" || activeRoleLevel === "LEVEL_3") && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-900 border border-blue-200 dark:border-zinc-800 p-6 rounded-3xl space-y-4">
              <h4 className="text-sm font-extrabold text-blue-950 dark:text-blue-200 flex items-center gap-2 uppercase tracking-wider">
                <MessageSquare className="h-4.5 w-4.5 text-blue-600" />
                Aksi Evaluator: Berikan Catatan Pembinaan, Apresiasi & Target Semester Depan
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Catatan Pembinaan / Evaluasi
                  </label>
                  <textarea
                    rows={3}
                    value={coachingNoteInput}
                    onChange={(e) => setCoachingNoteInput(e.target.value)}
                    placeholder="Masukkan catatan evaluasi atau aspek yang perlu ditingkatkan..."
                    className="w-full bg-white dark:bg-zinc-800 border rounded-xl p-2.5 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Apresiasi & Catatan Positif
                  </label>
                  <textarea
                    rows={3}
                    value={appreciationNoteInput}
                    onChange={(e) => setAppreciationNoteInput(e.target.value)}
                    placeholder="Apresiasi atas pencapaian dan kedisiplinan..."
                    className="w-full bg-white dark:bg-zinc-800 border rounded-xl p-2.5 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Target Semester Berikutnya
                  </label>
                  <textarea
                    rows={3}
                    value={nextTargetInput}
                    onChange={(e) => setNextTargetInput(e.target.value)}
                    placeholder="Target pelatihan / kelengkapan administrasi..."
                    className="w-full bg-white dark:bg-zinc-800 border rounded-xl p-2.5 text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveActionNotes}
                  disabled={isSavingAction}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  {isSavingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Simpan Catatan & Target Pembinaan
                </button>
              </div>
            </div>
          )}

          {/* PRINT WRAPPER AREA */}
          <div id="print-area" className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xs max-w-4xl mx-auto text-slate-900 dark:text-zinc-200 print:border-none print:shadow-none print:p-0">
            {/* KOP SURAT */}
            <div className="text-center border-b-4 border-slate-900 dark:border-zinc-50 pb-5 mb-6 flex items-center justify-center gap-4">
              <div className="h-16 w-16 bg-blue-600 flex items-center justify-center text-white font-bold rounded-2xl print:bg-blue-600">
                <Award className="h-10 w-10" />
              </div>
              <div className="text-left">
                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">YAYASAN ALKARIM RASYID</h2>
                <h3 className="text-lg font-bold text-blue-600 dark:text-blue-500 uppercase leading-none mt-1">SMP ALKARIM RASYID</h3>
                <p className="text-xs text-slate-400 mt-1 print:text-zinc-500">Jl. Raya Pesantren No. 12, Jawa Barat. Telp: (021) 827494</p>
              </div>
            </div>

            <div className="text-center mb-6">
              <h4 className="text-md font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-100 leading-none">RAPOR PENILAIAN KINERJA GURU & PEGAWAI</h4>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold print:text-zinc-500">
                TAHUN AJARAN {viewingEval.academicYear} • SEMESTER {viewingEval.semester}
              </p>
            </div>

            {/* SDM BIODATA */}
            <div className="flex flex-col md:flex-row gap-6 border border-slate-200 dark:border-zinc-800 p-6 rounded-3xl bg-slate-50/50 dark:bg-zinc-900/30 mb-6 text-sm items-center">
              <img
                src={teachers.find(t => t.id === viewingEval.teacherId)?.photoUrl || viewingEval.photoUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face"}
                alt={viewingEval.teacherName}
                className="h-24 w-24 rounded-2xl object-cover border-2 border-white dark:border-zinc-800 shadow-md referrerPolicy='no-referrer'"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full text-xs">
                <div className="space-y-1.5">
                  <div className="flex"><span className="w-28 text-slate-400 font-medium">Nama SDM:</span><span className="font-bold text-slate-900 dark:text-zinc-100">{viewingEval.teacherName}</span></div>
                  <div className="flex"><span className="w-28 text-slate-400 font-medium">NIY Yayasan:</span><span className="font-semibold">{viewingEval.niy || "-"}</span></div>
                  <div className="flex"><span className="w-28 text-slate-400 font-medium">Jabatan & Unit:</span><span className="font-semibold text-blue-600 dark:text-blue-400 uppercase">{viewingEval.roleName} ({viewingEval.unit || "SMP"})</span></div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex"><span className="w-28 text-slate-400 font-medium">Penilai:</span><span className="font-semibold">{viewingEval.evaluatorName}</span></div>
                  <div className="flex"><span className="w-28 text-slate-400 font-medium">Jabatan Penilai:</span><span className="font-semibold">{viewingEval.evaluatorRole || "Kepala Sekolah"}</span></div>
                  <div className="flex"><span className="w-28 text-slate-400 font-medium">Status Rapor:</span><span className={`font-bold uppercase ${viewingEval.status === "Submitted" ? "text-green-600" : "text-amber-500"}`}>{viewingEval.status}</span></div>
                </div>
              </div>
            </div>

            {/* SCORES & COMPONENTS */}
            <div className="space-y-6 mb-6">
              <h5 className="font-bold text-slate-800 dark:text-zinc-100 border-b pb-1 border-slate-200 dark:border-zinc-800 text-xs">I. KOMPONEN PENILAIAN KINERJA</h5>

              {viewingEval.components?.map((comp, cIdx) => (
                <div key={cIdx} className="space-y-2">
                  <div className="bg-slate-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wider text-slate-700 dark:text-zinc-300">
                    {comp.name}
                  </div>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-bold">
                        <th className="py-2 pl-2">No</th>
                        <th className="py-2">Indikator Kinerja</th>
                        <th className="py-2 text-center w-24">Skor (1-5)</th>
                        <th className="py-2 pr-2">Catatan Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comp.indicators?.map((ind, iIdx) => (
                        <tr key={iIdx} className="border-b border-slate-100 dark:border-zinc-900">
                          <td className="py-2 pl-2 text-slate-400 font-semibold">{iIdx + 1}</td>
                          <td className="py-2 font-semibold text-slate-800 dark:text-zinc-200">{ind.name}</td>
                          <td className="py-2 text-center">
                            <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded text-xs">
                              {ind.score}
                            </span>
                          </td>
                          <td className="py-2 pr-2 text-slate-500 italic">{ind.comment || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {renderAutoStatsBreakdown(viewingEval)}

            {/* OVERALL RESULTS */}
            <div className="border-t-2 border-slate-200 dark:border-zinc-800 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 p-5 rounded-3xl text-center">
                <div className="text-[10px] font-bold text-blue-500 uppercase">Skor Akhir Konversi</div>
                <div className="text-4xl font-black text-blue-700 dark:text-blue-400 mt-2">{viewingEval.finalScore}</div>
                <div className="text-xs font-bold text-slate-400 mt-1">Skala 0 - 100</div>
              </div>

              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 p-5 rounded-3xl text-center">
                <div className="text-[10px] font-bold text-emerald-500 uppercase">Predikat Kinerja</div>
                <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-2">{viewingEval.category}</div>
                <div className="text-xs font-bold text-slate-400 mt-2">Dinyatakan Memenuhi</div>
              </div>

              <div className="text-xs space-y-2 bg-slate-50 dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="font-extrabold text-slate-700 dark:text-zinc-300">Catatan Pembinaan:</span>
                  <p className="text-slate-600 dark:text-zinc-400 italic mt-0.5">{viewingEval.coachingNote || viewingEval.overallComment || "Kinerja secara umum baik."}</p>
                </div>
                <div>
                  <span className="font-extrabold text-slate-700 dark:text-zinc-300">Target Semester Depan:</span>
                  <p className="text-slate-600 dark:text-zinc-400 italic mt-0.5">{viewingEval.nextSemesterTarget || viewingEval.recommendation || "-"}</p>
                </div>
              </div>
            </div>

            {/* SIGN OFF */}
            <div className="grid grid-cols-2 text-center text-xs mt-12 pt-6 border-t border-dashed border-slate-200 dark:border-zinc-800">
              <div>
                <p className="text-slate-400 font-semibold mb-12">Guru / Pegawai Bersangkutan</p>
                <p className="font-bold text-slate-800 dark:text-zinc-200 underline">{viewingEval.teacherName}</p>
                <p className="text-[10px] text-slate-400 mt-1">NIY: {viewingEval.niy}</p>
              </div>
              <div>
                <p className="text-slate-400 font-semibold mb-12">Kepala Sekolah / Penilai</p>
                <p className="font-bold text-slate-800 dark:text-zinc-200 underline">{viewingEval.evaluatorName}</p>
                <p className="text-[10px] text-slate-400 mt-1">{viewingEval.evaluatorRole || "Pimpinan Sekolah"}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================================= */}
      {/* FORM INSTRUMEN PENILAIAN (PRESENCE WHEN EVALUATOR BUILDS NEW REPORT)                    */}
      {/* ========================================================================================= */}
      {activeTab === "penilaian" && !viewingEval && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs"
        >
          <div className="border-b pb-4 mb-6 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-950 dark:text-zinc-50 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Lembar Pengisian Rapor Kinerja Berkala
              </h3>
              <p className="text-xs text-slate-500">
                Pilih guru, peran yang dievaluasi, dan berikan penilaian IKU berskala 1 - 5.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("dashboard")}
              className="px-3 py-1.5 border rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
          </div>

          <form onSubmit={handleSaveEvaluation} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Guru / Pegawai <span className="text-rose-500">*</span></label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border rounded-xl px-3 py-2 text-xs font-semibold"
                  required
                >
                  <option value="">Pilih Guru / Pegawai</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (NIY: {t.niy || "-"})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Jabatan Kerja <span className="text-rose-500">*</span></label>
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border rounded-xl px-3 py-2 text-xs font-semibold"
                  required
                  disabled={!selectedTeacherId}
                >
                  <option value="">Pilih Jabatan</option>
                  {selectedTeacherId && (
                    (teachers.find(t => t.id === selectedTeacherId) as any)?.roles || 
                    parseEmployeeTypeToRoles(teachers.find(t => t.id === selectedTeacherId)?.employeeType || "")
                  ).map((rId: string) => {
                    const matchRole = jabatans.find(j => j.id === rId);
                    return <option key={rId} value={rId}>{matchRole?.name || rId}</option>;
                  })}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Tahun Pelajaran <span className="text-rose-500">*</span></label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border rounded-xl px-3 py-2 text-xs font-semibold"
                  required
                >
                  {academicYears.map(y => <option key={y.id} value={y.name}>{y.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">Semester <span className="text-rose-500">*</span></label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border rounded-xl px-3 py-2 text-xs font-semibold"
                  required
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>

            {/* Assessment Components */}
            {formComponents.map((comp, cIdx) => (
              <div key={cIdx} className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 space-y-3 bg-slate-50/50 dark:bg-zinc-900/50">
                <h4 className="font-extrabold text-xs uppercase tracking-wider text-blue-600 dark:text-blue-400">{comp.name}</h4>
                <div className="space-y-3">
                  {comp.indicators.map((ind, iIdx) => (
                    <div key={iIdx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white dark:bg-zinc-800 p-3 rounded-xl border">
                      <div className="md:col-span-5 text-xs font-bold text-slate-800 dark:text-zinc-200">{ind.name}</div>
                      <div className="md:col-span-3 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(score => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => handleScoreChange(cIdx, iIdx, score)}
                            className={`flex-1 py-1 text-xs font-extrabold rounded-lg border transition-all cursor-pointer ${
                              ind.score === score
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                      <div className="md:col-span-4">
                        <input
                          type="text"
                          placeholder="Catatan indikator (opsional)..."
                          value={ind.comment || ""}
                          onChange={(e) => handleCommentChange(cIdx, iIdx, e.target.value)}
                          className="w-full text-xs bg-slate-50 dark:bg-zinc-900 border rounded-lg px-2.5 py-1.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Catatan Evaluator</label>
                <textarea
                  rows={3}
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  placeholder="Komentar umum evaluasi kinerja..."
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Target / Rekomendasi</label>
                <textarea
                  rows={3}
                  value={customRecommendation}
                  onChange={(e) => setCustomRecommendation(e.target.value)}
                  placeholder="Target pengembangan semester berikutnya..."
                  className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border rounded-xl p-2.5"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Status Terbit:</span>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="bg-slate-100 dark:bg-zinc-800 text-xs font-bold px-3 py-1.5 rounded-xl border"
                >
                  <option value="Draft">Draft (Disimpan Sementara)</option>
                  <option value="Submitted">Submitted (Terbit ke Guru)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Simpan Penilaian
              </button>
            </div>
          </form>
        </motion.div>
      )}

    </div>
  );
}
