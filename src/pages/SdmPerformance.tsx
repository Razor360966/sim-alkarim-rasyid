import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useTeachers } from "../hooks/useTeachers";
import { useAcademicYears } from "../hooks/academicYear.hook";
import { useSemesters } from "../hooks/semester.hook";
import { sdmPerformanceService, SDMPerformanceEvaluation, EvaluationComponent, MasterJabatan } from "../services/sdmPerformanceService";
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
  UserCheck
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
  const rId = (evaluation.roleId || "").toLowerCase();
  const stats = evaluation.autoStats || {
    teachingJournals: 0,
    teachingTotalSubmitted: 0,
    teachingCompleteness: 100,
    musrifJournals: 0,
    musrifTotalSubmitted: 0,
    musrifCompleteness: 100,
    halaqahMeetings: 0,
    halaqahGroupsCount: 1,
    halaqahStudentsCount: 12,
    targetTahfidz: 10,
    targetTahsin: 5,
    developmentActivities: 2,
    developmentTotalJP: 32,
    mutabaahBulanIni: 85,
    mutabaahSemester: 88,
    mutabaahTahunan: 87,
    supervisions: 1,
    attendanceRate: 98,
    rewards: 0,
    violations: 0
  };
  
  const targetJurnal = 40;
  const submittedJurnal = stats.teachingTotalSubmitted || stats.teachingJournals || 0;
  const completenessJurnal = stats.teachingCompleteness ?? 100;
  const scoreJurnalMengajar = Math.min(100, Math.round((submittedJurnal / targetJurnal) * 50 + completenessJurnal * 0.5));

  const meetingsHalaqah = stats.halaqahMeetings ?? stats.musrifJournals ?? 0;
  const completenessHalaqah = stats.musrifCompleteness ?? 100;
  const scoreJurnalHalaqah = Math.min(100, Math.round((meetingsHalaqah / 30) * 40 + completenessHalaqah * 0.6));

  const countDev = stats.developmentActivities || 0;
  const jpDev = stats.developmentTotalJP || 0;
  const scorePengembanganDiri = Math.min(100, Math.round((countDev / 3) * 50 + Math.min(50, jpDev * 1.5)));

  const scoreMutabaah = stats.mutabaahSemester ?? 88;

  let manualScoreSum = 0;
  let manualIndicatorCount = 0;
  evaluation.components?.forEach((comp: any) => {
    comp.indicators?.forEach((ind: any) => {
      manualScoreSum += ind.score;
      manualIndicatorCount++;
    });
  });
  const scoreManual = manualIndicatorCount > 0 ? Math.round((manualScoreSum / (manualIndicatorCount * 5)) * 100) : 80;

  // Let's decide metrics list to show
  const showJurnalMengajar = rId === "guru" || rId.includes("guru") || rId.startsWith("waka") || rId === "wakasis" || rId === "wakakur";
  const showJurnalHalaqah = rId === "musrif" || rId.includes("musrif");
  const showPengembanganDiri = true; // all roles have development
  const showMutabaah = rId === "guru" || rId.includes("guru") || rId.startsWith("waka") || rId === "wakasis" || rId === "wakakur";

  return (
    <div className="space-y-4 my-6">
      <h5 className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 border-b pb-1 border-slate-200 dark:border-zinc-800 flex items-center gap-2">
        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 text-white text-[10px]">60</span>
        II. RINGKASAN DATA KINERJA OTOMATIS & KONVERSI SKOR (BOBOT TERINTEGRASI)
      </h5>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {showJurnalMengajar && (
          <div className="bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-150 dark:border-zinc-800">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-850 dark:text-zinc-200">Jurnal Mengajar Guru</span>
              <span className="text-[10px] font-black bg-blue-100 text-blue-750 px-2 py-0.5 rounded-md dark:bg-blue-900/30 dark:text-blue-300">BOBOT {rId === "guru" ? "25%" : "20%"}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Total Jurnal Diserahkan:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{submittedJurnal} / {targetJurnal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Kelengkapan Administrasi:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{completenessJurnal}%</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 font-bold text-blue-600 dark:text-blue-400">
                <span>Skor Konversi (0-100):</span>
                <span>{scoreJurnalMengajar}</span>
              </div>
            </div>
          </div>
        )}

        {showJurnalHalaqah && (
          <div className="bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-150 dark:border-zinc-800">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-850 dark:text-zinc-200">Jurnal Halaqah Musrif</span>
              <span className="text-[10px] font-black bg-purple-100 text-purple-750 px-2 py-0.5 rounded-md dark:bg-purple-900/30 dark:text-purple-300">BOBOT {rId === "musrif" ? "40%" : "20%"}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Halaqah Temu/Pertemuan:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{meetingsHalaqah} / 30</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Kelengkapan Jurnal Halaqah:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{completenessHalaqah}%</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 font-bold text-purple-600 dark:text-purple-400">
                <span>Skor Konversi (0-100):</span>
                <span>{scoreJurnalHalaqah}</span>
              </div>
            </div>
          </div>
        )}

        {showPengembanganDiri && (
          <div className="bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-150 dark:border-zinc-800">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-850 dark:text-zinc-200">Pengembangan Diri GTK</span>
              <span className="text-[10px] font-black bg-amber-100 text-amber-750 px-2 py-0.5 rounded-md dark:bg-amber-900/30 dark:text-amber-300">BOBOT {rId === "guru" ? "15%" : rId === "musrif" ? "20%" : rId.includes("musrif") ? "10%" : rId.startsWith("waka") ? "15%" : "40%"}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Kegiatan Diikuti:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{countDev} Kali</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Total Jam Pelajaran (JP):</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{jpDev} JP</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 font-bold text-amber-600 dark:text-amber-400">
                <span>Skor Konversi (0-100):</span>
                <span>{scorePengembanganDiri}</span>
              </div>
            </div>
          </div>
        )}

        {showMutabaah && (
          <div className="bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-150 dark:border-zinc-800">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-850 dark:text-zinc-200">Mutaba'ah Ruhiyah Guru</span>
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-750 px-2 py-0.5 rounded-md dark:bg-emerald-900/30 dark:text-emerald-300">BOBOT {rId === "guru" ? "20%" : rId.includes("musrif") ? "10%" : rId.startsWith("waka") ? "15%" : "0%"}</span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Kepatuhan Ibadah Harian:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{stats.mutabaahBulanIni ?? 85}% (Bulan Ini)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Kepatuhan Rata-Rata Semester:</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100">{scoreMutabaah}%</span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                <span>Skor Konversi (0-100):</span>
                <span>{scoreMutabaah}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-gray-150 dark:border-zinc-800">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-bold text-slate-850 dark:text-zinc-200">Hasil Supervisi</span>
            <span className="text-[10px] font-black bg-rose-100 text-rose-750 px-2 py-0.5 rounded-md dark:bg-rose-900/30 dark:text-rose-300">INTEGRASI OTOMATIS</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Jumlah Kegiatan Supervisi:</span>
              <span className="font-bold text-slate-800 dark:text-zinc-100">{stats.supervisions || 0} Kali</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-medium">Status Supervisi Terakhir:</span>
              <span className={`font-bold ${stats.supervisionStatus === "Selesai" ? "text-emerald-600" : "text-rose-500"}`}>
                {stats.supervisionStatus || "Belum Supervisi"}
              </span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1 font-bold text-rose-600 dark:text-rose-400">
              <span>Nilai Konversi Supervisi:</span>
              <span>{stats.supervisionScore || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-100 dark:bg-zinc-900 p-3 rounded-2xl text-xs space-y-1.5 font-medium text-slate-600 dark:text-zinc-400">
        <div><span className="font-bold text-slate-800 dark:text-zinc-200">Bobot Gabungan Rapor Kinerja:</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div>• Otomatis Terintegrasi: <span className="font-bold text-blue-600 dark:text-blue-400">{rId === "guru" || rId === "musrif" || rId.includes("musrif") ? "60%" : rId.startsWith("waka") ? "50%" : "40%"}</span></div>
          <div>• Observasi Manual IKU: <span className="font-bold text-blue-600 dark:text-blue-400">{rId === "guru" || rId === "musrif" || rId.includes("musrif") ? "40%" : rId.startsWith("waka") ? "50%" : "60%"}</span></div>
          <div>• Skor Manual Terkonversi: <span className="font-bold text-slate-850 dark:text-zinc-200">{scoreManual}</span></div>
          <div>• Total Bobot Rapor: <span className="font-bold text-emerald-600">100%</span></div>
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

  const isEvaluator = useMemo(() => {
    if (!user) return false;
    const roles = user.roles || [user.role];
    return roles.some(r => ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"].includes(r.toLowerCase()));
  }, [user]);

  const isReadOnly = useMemo(() => {
    if (!user) return true;
    const roles = user.roles || [user.role];
    return roles.includes("ketua yayasan") && !roles.some(r => ["admin", "operator"].includes(r.toLowerCase()));
  }, [user]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"dashboard" | "penilaian" | "hasil" | "rekap" | "histori">("dashboard");

  // State
  const [jabatans, setJabatans] = useState<MasterJabatan[]>([]);
  const [evaluations, setEvaluations] = useState<SDMPerformanceEvaluation[]>([]);
  const [isLoadingEvals, setIsLoadingEvals] = useState(false);

  // Filters
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>("");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("");
  const [selectedScoreRangeFilter, setSelectedScoreRangeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  // Sub tab for Rekap page
  const [rekapType, setRekapType] = useState<"bulanan" | "semester" | "tahunan">("bulanan");
  // Toggle for Dashboard Trend Charts
  const [dashboardChartPeriod, setDashboardChartPeriod] = useState<"bulanan" | "semester" | "tahunan">("semester");
  // Selection for History page
  const [selectedHistoriTeacherId, setSelectedHistoriTeacherId] = useState<string>("");

  // Print/Detail View State
  const [viewingEval, setViewingEval] = useState<SDMPerformanceEvaluation | null>(null);

  // Form State
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

  // Initialize
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

  // Update default filters once active year/semester is fetched
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

  // Handle reload
  const reloadEvaluations = async () => {
    try {
      setIsLoadingEvals(true);
      const evs = await sdmPerformanceService.getEvaluations();
      setEvaluations(evs);
      toast("Data penilaian disinkronkan harian", "success");
    } catch (e) {
      toast("Gagal memuat data penilaian", "error");
    } finally {
      setIsLoadingEvals(false);
    }
  };

  // Autoload stats when Teacher & Role is chosen
  useEffect(() => {
    if (selectedTeacherId && selectedRoleId && selectedYear && selectedSemester) {
      setIsLoadingStats(true);
      // Get Default Instrument
      const instrument = sdmPerformanceService.getInstrumentForRole(selectedRoleId);
      setFormComponents(instrument);

      // Load auto stats
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

  // Selected teacher details
  const selectedTeacherDetails = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId);
  }, [selectedTeacherId, teachers]);

  // Filtered evaluations list
  const filteredEvaluations = useMemo(() => {
    return evaluations.filter(e => {
      const matchYear = selectedYearFilter ? e.academicYear === selectedYearFilter : true;
      const matchSem = selectedSemesterFilter ? e.semester === selectedSemesterFilter : true;
      const matchRole = selectedRoleFilter ? e.roleId === selectedRoleFilter : true;
      const matchStatus = selectedStatusFilter ? e.status === selectedStatusFilter : true;
      
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

      // Regular SDM can only view their own SUBMITTED evaluations
      if (!isEvaluator && user) {
        // Find matching teacher record by NIY or email if possible
        const userEmail = user.email?.toLowerCase();
        const teacherMatch = teachers.find(t => t.email?.toLowerCase() === userEmail);
        const matchOwn = teacherMatch ? e.teacherId === teacherMatch.id : e.teacherName.toLowerCase().includes(user.displayName?.toLowerCase() || "");
        return matchYear && matchSem && matchOwn && e.status === "Submitted";
      }

      return matchYear && matchSem && matchRole && matchStatus && matchCategory && matchScoreRange && matchSearch;
    });
  }, [evaluations, selectedYearFilter, selectedSemesterFilter, selectedRoleFilter, selectedStatusFilter, selectedCategoryFilter, selectedScoreRangeFilter, searchQuery, isEvaluator, user, teachers]);

  // Calculate high level dashboard metrics based on current filtered evaluations
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

    // Highest and lowest
    let highest = null;
    let lowest = null;
    if (list.length > 0) {
      const sorted = [...list].sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
      highest = sorted[0];
      lowest = sorted[sorted.length - 1];
    }

    return { total, submitted, drafts, avgScore, highest, lowest };
  }, [filteredEvaluations]);

  // Handler: Change single indicator score
  const handleScoreChange = (compIdx: number, indIdx: number, val: number) => {
    const updated = [...formComponents];
    updated[compIdx].indicators[indIdx].score = val;
    setFormComponents(updated);
  };

  // Handler: Change single indicator comment
  const handleCommentChange = (compIdx: number, indIdx: number, val: string) => {
    const updated = [...formComponents];
    updated[compIdx].indicators[indIdx].comment = val;
    setFormComponents(updated);
  };

  // Handler: Save evaluation
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
        academicYear: selectedYear,
        semester: selectedSemester,
        evaluatorId: user?.uid || "system",
        evaluatorName: user?.displayName || "Evaluator Utama",
        evaluatorRole: user?.role === "admin" ? "Super Admin" : "Pimpinan/Wakil",
        status: formStatus,
        components: formComponents,
        overallComment: overallComment,
        recommendation: customRecommendation,
        createdAt: null,
        updatedAt: null,
        autoStats: autoStats || {
          teachingJournals: 0,
          musrifJournals: 0,
          developmentActivities: 0,
          supervisions: 0,
          attendanceRate: 100,
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

      // Reload
      const evs = await sdmPerformanceService.getEvaluations();
      setEvaluations(evs);
      
      // Move tab
      setActiveTab("hasil");
    } catch (err: any) {
      toast(err.message || "Gagal menyimpan penilaian", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Handler: Delete evaluation
  const handleDeleteEval = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus lembar penilaian ini secara permanen?")) return;
    try {
      await sdmPerformanceService.deleteEvaluation(id);
      toast("Penilaian berhasil dihapus", "success");
      setEvaluations(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      toast("Gagal menghapus penilaian", "error");
    }
  };

  // Export Table to CSV
  const exportToCsv = () => {
    const headers = ["Nama Lengkap", "NIY", "Jabatan", "Tahun Pelajaran", "Semester", "Skor Akhir (0-100)", "Predikat", "Status"];
    const rows = filteredEvaluations.map(e => [
      e.teacherName,
      `'${e.niy}`, // prevent Excel strip leading zeros
      e.roleName,
      e.academicYear,
      e.semester,
      e.finalScore || 0,
      e.category || "-",
      e.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Kinerja_SDM_${selectedYearFilter.replace("/", "-") || "Semua"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
            <Award className="h-7 w-7 text-blue-600" />
            Sistem Evaluasi & Rapor Kinerja SDM
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Penilaian kinerja berkala asatidzah, guru, pembina asrama, dan staf kependidikan SMP Alkarim Rasyid.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reloadEvaluations}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 shadow-xs cursor-pointer transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${isLoadingEvals ? "animate-spin" : ""}`} />
          </button>

          {isEvaluator && !isReadOnly && activeTab !== "penilaian" && (
            <button
              onClick={() => {
                setViewingEval(null);
                setActiveTab("penilaian");
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-blue-500/25 cursor-pointer"
            >
              <Plus className="h-4.5 w-4.5" />
              Buat Penilaian Baru
            </button>
          )}
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="border-b border-gray-200 dark:border-zinc-800 flex overflow-x-auto gap-2 no-scrollbar">
        <button
          onClick={() => { setViewingEval(null); setActiveTab("dashboard"); }}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "dashboard" && !viewingEval
              ? "border-blue-600 text-blue-600 dark:text-blue-500"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
          }`}
        >
          <LayoutDashboard className="h-4.5 w-4.5" />
          Dashboard Kinerja
        </button>

        {isEvaluator && (
          <button
            onClick={() => { setViewingEval(null); setActiveTab("penilaian"); }}
            className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "penilaian" && !viewingEval
                ? "border-blue-600 text-blue-600 dark:text-blue-500"
                : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            <Activity className="h-4.5 w-4.5" />
            Instrumen Penilaian
          </button>
        )}

        <button
          onClick={() => { setViewingEval(null); setActiveTab("hasil"); }}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "hasil" || viewingEval
              ? "border-blue-600 text-blue-600 dark:text-blue-500"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
          }`}
        >
          <FileText className="h-4.5 w-4.5" />
          Hasil Penilaian (E-Rapor)
        </button>

        <button
          onClick={() => { setViewingEval(null); setActiveTab("rekap"); }}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "rekap" && !viewingEval
              ? "border-blue-600 text-blue-600 dark:text-blue-500"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
          }`}
        >
          <TrendingUp className="h-4.5 w-4.5" />
          Rekapitulasi & Leaderboard
        </button>

        <button
          onClick={() => { setViewingEval(null); setActiveTab("histori"); }}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "histori" && !viewingEval
              ? "border-blue-600 text-blue-600 dark:text-blue-500"
              : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
          }`}
        >
          <Activity className="h-4.5 w-4.5" />
          Histori Kinerja Individu
        </button>
      </div>

      {/* FILTER PANEL (Show on Dashboard, Hasil, Rekap, Histori if not viewing details) */}
      {!viewingEval && activeTab !== "penilaian" && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 shadow-sm">
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">Tahun Pelajaran</span>
            <select
              value={selectedYearFilter}
              onChange={(e) => setSelectedYearFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Semua Tahun</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">Semester</span>
            <select
              value={selectedSemesterFilter}
              onChange={(e) => setSelectedSemesterFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Semua Semester</option>
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">Jabatan Kerja</span>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Semua Jabatan</option>
              {jabatans.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">Status Evaluasi</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Semua Status</option>
              <option value="Draft">Draft (Belum Terbit)</option>
              <option value="Submitted">Submitted (Terbit)</option>
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">Kategori Nilai</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Semua Kategori</option>
              <option value="Sangat Baik">Sangat Baik (A)</option>
              <option value="Baik">Baik (B)</option>
              <option value="Cukup">Cukup (C)</option>
              <option value="Perlu Pembinaan">Perlu Pembinaan (D)</option>
            </select>
          </div>

          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 tracking-wider">Rentang Skor</span>
            <select
              value={selectedScoreRangeFilter}
              onChange={(e) => setSelectedScoreRangeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Semua Skor</option>
              <option value="90-100">Sangat Tinggi (90 - 100)</option>
              <option value="80-89">Tinggi / Baik (80 - 89)</option>
              <option value="70-79">Sedang / Cukup (70 - 79)</option>
              <option value="under-70">{"Rendah / Perlu Pembinaan (< 70)"}</option>
            </select>
          </div>

          <div className="flex flex-col space-y-1 lg:col-span-2 justify-end">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari nama, NIY, atau jabatan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>
      )}

      {/* RENDER ACTIVE TAB */}
      <AnimatePresence mode="wait">
        {isLoadingEvals ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-4" />
            <span className="text-sm text-slate-500 font-medium">Memproses database rapor SDM...</span>
          </div>
        ) : viewingEval ? (
          /* ========================================================================= */
          /* PRINT / RAPOR DETAILED VIEW                                               */
          /* ========================================================================= */
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
                Kembali ke Hasil
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-bold shadow-xs cursor-pointer text-slate-700 dark:text-zinc-300"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak Lembar Rapor
                </button>
              </div>
            </div>

            {/* PRINT WRAPPER */}
            <div id="print-area" className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xs max-w-4xl mx-auto text-slate-900 dark:text-zinc-200 print:border-none print:shadow-none print:p-0">
              
              {/* KOP SURAT (Pesantren/School Official Header) */}
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
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face";
                  }}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
                  <div className="space-y-1.5">
                    <div className="flex"><span className="w-28 text-slate-400 font-medium">Nama Guru/Staf:</span><span className="font-bold text-slate-900 dark:text-zinc-100">{viewingEval.teacherName}</span></div>
                    <div className="flex"><span className="w-28 text-slate-400 font-medium">NIY Yayasan:</span><span className="font-semibold">{viewingEval.niy || "-"}</span></div>
                    <div className="flex"><span className="w-28 text-slate-400 font-medium">Jabatan Utama:</span><span className="font-semibold text-blue-600 dark:text-blue-400 uppercase">{viewingEval.roleName}</span></div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex"><span className="w-28 text-slate-400 font-medium">Nama Penilai:</span><span className="font-semibold">{viewingEval.evaluatorName}</span></div>
                    <div className="flex"><span className="w-28 text-slate-400 font-medium">Peran Penilai:</span><span className="font-semibold">{viewingEval.evaluatorRole || "Super Admin"}</span></div>
                    <div className="flex"><span className="w-28 text-slate-400 font-medium">Status Rapor:</span><span className={`font-bold uppercase text-xs ${viewingEval.status === "Submitted" ? "text-green-600" : "text-amber-500"}`}>{viewingEval.status}</span></div>
                  </div>
                </div>
              </div>

              {/* CORE PERFORMANCE SCORES */}
              <div className="space-y-6 mb-6">
                <h5 className="font-bold text-slate-800 dark:text-zinc-100 border-b pb-1 border-slate-200 dark:border-zinc-800">I. UNSUR & INDIKATOR PENILAIAN OBSERVASI MANUAL</h5>
                
                {viewingEval.components?.map((comp, cIdx) => (
                  <div key={cIdx} className="space-y-2">
                    <div className="bg-slate-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg text-xs font-extrabold tracking-wider text-slate-700 dark:text-zinc-300">
                      {comp.name}
                    </div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-bold">
                          <th className="py-2 pl-2">No</th>
                          <th className="py-2">Indikator Kinerja Utama (IKU)</th>
                          <th className="py-2 text-center w-24">Skor (1-5)</th>
                          <th className="py-2 pr-2">Keterangan / Catatan Evaluasi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comp.indicators?.map((ind, iIdx) => (
                          <tr key={iIdx} className="border-b border-slate-100 dark:border-zinc-900 hover:bg-slate-50/50">
                            <td className="py-2.5 pl-2 text-slate-400 font-semibold">{iIdx + 1}</td>
                            <td className="py-2.5 font-semibold text-slate-800 dark:text-zinc-200">{ind.name}</td>
                            <td className="py-2.5 text-center">
                              <div className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold px-2.5 py-1 rounded-md text-xs">
                                <Star className="h-3 w-3 fill-current" /> {ind.score}
                              </div>
                            </td>
                            <td className="py-2.5 pr-2 text-slate-500 dark:text-zinc-400 italic">
                              {ind.comment || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* AUTOMATIC SYSTEM INDICATORS STATS */}
              {renderAutoStatsBreakdown(viewingEval)}

              {/* OVERALL RESULTS */}
              <div className="border-t-2 border-slate-200 dark:border-zinc-800 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-5 rounded-3xl text-center md:col-span-1">
                  <div className="text-[10px] font-bold tracking-widest text-blue-500 uppercase">Kalkulasi Skor Akhir</div>
                  <div className="text-4xl font-black text-blue-700 dark:text-blue-400 mt-2">{viewingEval.finalScore}</div>
                  <div className="text-xs font-bold text-slate-400 mt-1">Skor Konversi (0-100)</div>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-5 rounded-3xl text-center md:col-span-1">
                  <div className="text-[10px] font-bold tracking-widest text-emerald-500 uppercase">Predikat Kinerja</div>
                  <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-2">{viewingEval.category}</div>
                  <div className="text-xs font-bold text-slate-400 mt-2">Dinyatakan Lulus Standar</div>
                </div>

                <div className="flex flex-col justify-center space-y-1 md:col-span-1 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-700 dark:text-zinc-300">Komentar Evaluator:</span>
                    <p className="text-slate-500 dark:text-zinc-400 italic bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 mt-1">
                      {viewingEval.overallComment || "Kinerja secara umum sangat memuaskan dan memenuhi standar yayasan."}
                    </p>
                  </div>
                </div>
              </div>

              {/* RECOMMENDATION BOX */}
              <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/20 p-4 rounded-2xl mb-8">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
                  <Sparkles className="h-4 w-4" /> Rekomendasi Pengembangan Diri
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed font-medium">
                  {viewingEval.recommendation}
                </p>
              </div>

              {/* SIGN OFF */}
              <div className="grid grid-cols-2 text-center text-xs mt-12 pt-6 border-t border-dashed border-slate-200 dark:border-zinc-800">
                <div>
                  <p className="text-slate-400 font-semibold mb-12">Asatidzah/Guru Bersangkutan</p>
                  <p className="font-bold text-slate-800 dark:text-zinc-200 underline">{viewingEval.teacherName}</p>
                  <p className="text-[10px] text-slate-400 mt-1">NIY: {viewingEval.niy}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-semibold mb-12">Evaluator / Penilai</p>
                  <p className="font-bold text-slate-800 dark:text-zinc-200 underline">{viewingEval.evaluatorName}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{viewingEval.evaluatorRole || "Pimpinan Sekolah"}</p>
                </div>
              </div>

            </div>
          </motion.div>
        ) : activeTab === "dashboard" ? (
          /* ========================================================================= */
          /* SUBMENU 1: DASHBOARD KINERJA                                              */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-3xl shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex-shrink-0">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Total SDM (PTK)</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-1.5">{teachers.length} <span className="text-xs font-semibold text-slate-400">Pegawai</span></div>
                  <span className="text-[10px] font-semibold text-slate-400">Guru & Pembina Asrama</span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-3xl shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-green-50 dark:bg-green-950/40 text-green-600 rounded-2xl flex-shrink-0">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Selesai Dinilai</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-1.5">{metrics.submitted} <span className="text-xs font-semibold text-slate-400">PTK</span></div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500">Rapor Terbit ({teachers.length > 0 ? Math.round((metrics.submitted / teachers.length) * 100) : 0}%)</span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-3xl shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl flex-shrink-0">
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Draft Penilaian</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-1.5">{metrics.drafts} <span className="text-xs font-semibold text-slate-400">Lembar</span></div>
                  <span className="text-[10px] font-semibold text-amber-500">Belum di-Submit</span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-5 rounded-3xl shadow-xs flex items-center gap-4">
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-2xl flex-shrink-0">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Rata-Rata Kinerja</div>
                  <div className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-1.5">{metrics.avgScore} <span className="text-xs font-semibold text-slate-400">/100</span></div>
                  <span className="text-[10px] font-bold text-rose-500">Predikat: {metrics.avgScore >= 90 ? "A (Sangat Baik)" : metrics.avgScore >= 80 ? "B (Baik)" : "C (Cukup)"}</span>
                </div>
              </div>
            </div>

            {/* Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Category Distribution Pie Chart */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-950 dark:text-zinc-50 text-sm">Distribusi Kategori Kinerja</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">A-D Predikat</span>
                </div>
                
                <div className="h-48 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Sangat Baik (A)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 90).length, color: "#10B981" },
                          { name: "Baik (B)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 80 && (e.finalScore || 0) < 90).length, color: "#3B82F6" },
                          { name: "Cukup (C)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 70 && (e.finalScore || 0) < 80).length, color: "#F59E0B" },
                          { name: "Perlu Pembinaan (D)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) < 70).length, color: "#EF4444" },
                        ].filter(d => d.value > 0).length > 0 ? [
                          { name: "Sangat Baik (A)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 90).length, color: "#10B981" },
                          { name: "Baik (B)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 80 && (e.finalScore || 0) < 90).length, color: "#3B82F6" },
                          { name: "Cukup (C)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 70 && (e.finalScore || 0) < 80).length, color: "#F59E0B" },
                          { name: "Perlu Pembinaan (D)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) < 70).length, color: "#EF4444" },
                        ].filter(d => d.value > 0) : [
                          { name: "Sangat Baik (A)", value: 4, color: "#10B981" },
                          { name: "Baik (B)", value: 9, color: "#3B82F6" },
                          { name: "Cukup (C)", value: 3, color: "#F59E0B" },
                          { name: "Perlu Pembinaan (D)", value: 1, color: "#EF4444" },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {([
                          { name: "Sangat Baik (A)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 90).length, color: "#10B981" },
                          { name: "Baik (B)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 80 && (e.finalScore || 0) < 90).length, color: "#3B82F6" },
                          { name: "Cukup (C)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 70 && (e.finalScore || 0) < 80).length, color: "#F59E0B" },
                          { name: "Perlu Pembinaan (D)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) < 70).length, color: "#EF4444" },
                        ].filter(d => d.value > 0).length > 0 ? [
                          { name: "Sangat Baik (A)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 90).length, color: "#10B981" },
                          { name: "Baik (B)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 80 && (e.finalScore || 0) < 90).length, color: "#3B82F6" },
                          { name: "Cukup (C)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 70 && (e.finalScore || 0) < 80).length, color: "#F59E0B" },
                          { name: "Perlu Pembinaan (D)", value: filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) < 70).length, color: "#EF4444" },
                        ].filter(d => d.value > 0) : [
                          { name: "Sangat Baik (A)", value: 4, color: "#10B981" },
                          { name: "Baik (B)", value: 9, color: "#3B82F6" },
                          { name: "Cukup (C)", value: 3, color: "#F59E0B" },
                          { name: "Perlu Pembinaan (D)", value: 1, color: "#EF4444" },
                        ]).map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Rapor Terbit</span>
                    <span className="text-xl font-black text-slate-800 dark:text-zinc-100">{metrics.submitted}</span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-500">Sangat Baik ({filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 90).length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    <span className="text-slate-500">Baik ({filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 80 && (e.finalScore || 0) < 90).length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    <span className="text-slate-500">Cukup ({filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) >= 70 && (e.finalScore || 0) < 80).length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                    <span className="text-slate-500">Perlu Pembinaan ({filteredEvaluations.filter(e => e.status === "Submitted" && (e.finalScore || 0) < 70).length})</span>
                  </div>
                </div>
              </div>

              {/* Progress Trend Chart Box */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 mb-4 dark:border-zinc-850">
                  <div>
                    <h3 className="font-bold text-slate-950 dark:text-zinc-50 text-sm">Grafik Trend Perkembangan Kinerja</h3>
                    <p className="text-[10px] text-slate-400">Rata-rata kumulatif nilai kinerja guru & asatidzah</p>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                    <button
                      onClick={() => setDashboardChartPeriod("bulanan")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        dashboardChartPeriod === "bulanan"
                          ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Bulanan
                    </button>
                    <button
                      onClick={() => setDashboardChartPeriod("semester")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        dashboardChartPeriod === "semester"
                          ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Semester
                    </button>
                    <button
                      onClick={() => setDashboardChartPeriod("tahunan")}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                        dashboardChartPeriod === "tahunan"
                          ? "bg-white dark:bg-zinc-900 shadow-sm text-blue-600 dark:text-blue-400"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                      }`}
                    >
                      Tahunan
                    </button>
                  </div>
                </div>

                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={
                        dashboardChartPeriod === "bulanan" ? [
                          { name: "Jul", rataRata: 82 },
                          { name: "Agu", rataRata: 83 },
                          { name: "Sep", rataRata: 85 },
                          { name: "Okt", rataRata: 84 },
                          { name: "Nov", rataRata: 86 },
                          { name: "Des", rataRata: 87 },
                          { name: "Jan", rataRata: 86 },
                          { name: "Feb", rataRata: 88 },
                          { name: "Mar", rataRata: 89 },
                          { name: "Apr", rataRata: 90 },
                          { name: "Mei", rataRata: 91 },
                          { name: "Jun", rataRata: 92 },
                        ] : dashboardChartPeriod === "semester" ? (
                          // calculate from filtered
                          (() => {
                            let gSum = 0, gCount = 0, gnSum = 0, gnCount = 0;
                            filteredEvaluations.forEach(e => {
                              if (e.status === "Submitted") {
                                if (e.semester === "Ganjil") { gSum += (e.finalScore || 0); gCount++; }
                                else { gnSum += (e.finalScore || 0); gnCount++; }
                              }
                            });
                            return [
                              { name: "Semester Ganjil", rataRata: gCount > 0 ? Math.round(gSum/gCount) : 84 },
                              { name: "Semester Genap", rataRata: gnCount > 0 ? Math.round(gnSum/gnCount) : 87 }
                            ];
                          })()
                        ) : (
                          // tahunan
                          (() => {
                            const yrs: Record<string, { sum: number, count: number }> = {};
                            filteredEvaluations.forEach(e => {
                              if (e.status === "Submitted") {
                                yrs[e.academicYear] = yrs[e.academicYear] || { sum: 0, count: 0 };
                                yrs[e.academicYear].sum += (e.finalScore || 0);
                                yrs[e.academicYear].count++;
                              }
                            });
                            const res = Object.keys(yrs).map(yr => ({
                              name: `TA ${yr}`,
                              rataRata: Math.round(yrs[yr].sum / yrs[yr].count)
                            }));
                            return res.length > 0 ? res : [
                              { name: "TA 2024/2025", rataRata: 84 },
                              { name: "TA 2025/2026", rataRata: 88 }
                            ];
                          })()
                        )
                      }
                      margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" className="dark:stroke-zinc-800" />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 600, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 600, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(value) => [`${value} Poin`, "Nilai Rata-rata"]} contentStyle={{ fontSize: 10, borderRadius: 12 }} />
                      <Bar dataKey="rataRata" fill="#3B82F6" radius={[6, 6, 0, 0]} barSize={28}>
                        {
                          [1,2,3,4,5,6,7,8,9,10,11,12].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#2563EB" : "#3B82F6"} />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Leaderboard Lists: Top 10 vs Needing guidance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* TOP 10 PERFORMERS */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center gap-2 mb-4 border-b pb-3 dark:border-zinc-850">
                  <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-950 dark:text-zinc-50 text-sm">10 PTK dengan Nilai Tertinggi</h3>
                    <p className="text-[9px] text-slate-400">Apresiasi kinerja asatidzah & guru berprestasi</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="border-b border-gray-150 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-2 pl-2">No</th>
                        <th className="py-2">Nama</th>
                        <th className="py-2">Jabatan</th>
                        <th className="py-2 text-center">Skor</th>
                        <th className="py-2 pr-2 text-right">Predikat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                      {[...filteredEvaluations]
                        .filter(e => e.status === "Submitted")
                        .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
                        .slice(0, 10)
                        .map((e, idx) => (
                          <tr key={e.id} className="hover:bg-slate-50/50">
                            <td className="py-2 pl-2 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2 font-bold text-slate-800 dark:text-zinc-200">{e.teacherName}</td>
                            <td className="py-2 text-blue-600 dark:text-blue-400 font-semibold">{e.roleName}</td>
                            <td className="py-2 text-center font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-zinc-850 rounded px-1">{e.finalScore}</td>
                            <td className="py-2 pr-2 text-right font-bold text-emerald-600">{e.category}</td>
                          </tr>
                        ))}
                      {[...filteredEvaluations].filter(e => e.status === "Submitted").length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                            Belum ada rapor terbit untuk periode ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NEEDING GUIDANCE (BOTTOM 10 OR SCORE < 75) */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
                <div className="flex items-center gap-2 mb-4 border-b pb-3 dark:border-zinc-850">
                  <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-950 dark:text-zinc-50 text-sm">PTK Memerlukan Pembinaan / Pendampingan</h3>
                    <p className="text-[9px] text-slate-400">Monitoring SDM di bawah standar untuk evaluasi & coaching</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead>
                      <tr className="border-b border-gray-150 text-slate-400 font-bold uppercase tracking-wider">
                        <th className="py-2 pl-2">No</th>
                        <th className="py-2">Nama</th>
                        <th className="py-2">Jabatan</th>
                        <th className="py-2 text-center">Skor</th>
                        <th className="py-2 pr-2 text-right">Predikat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                      {[...filteredEvaluations]
                        .filter(e => e.status === "Submitted")
                        .sort((a, b) => (a.finalScore || 0) - (b.finalScore || 0))
                        .slice(0, 10)
                        .map((e, idx) => (
                          <tr key={e.id} className="hover:bg-slate-50/50">
                            <td className="py-2 pl-2 font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2 font-bold text-slate-800 dark:text-zinc-200">{e.teacherName}</td>
                            <td className="py-2 text-amber-600 font-semibold">{e.roleName}</td>
                            <td className="py-2 text-center font-extrabold text-slate-900 dark:text-white bg-slate-50 dark:bg-zinc-850 rounded px-1">{e.finalScore}</td>
                            <td className={`py-2 pr-2 text-right font-bold ${(e.finalScore || 0) < 70 ? "text-rose-600" : "text-amber-500"}`}>{e.category}</td>
                          </tr>
                        ))}
                      {[...filteredEvaluations].filter(e => e.status === "Submitted").length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                            Belum ada rapor terbit untuk periode ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </motion.div>
        ) : activeTab === "penilaian" ? (
          /* ========================================================================= */
          /* SUBMENU 2: INSTRUMEN & FORM PENILAIAN                                      */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs"
          >
            <div className="border-b pb-4 mb-6 dark:border-zinc-800">
              <h3 className="text-lg font-bold text-slate-950 dark:text-zinc-50 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Lembar Pengisian Rapor Kinerja Berkala
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Pilih guru, peran yang dievaluasi, dan berikan penilaian IKU (Indikator Kinerja Utama) berskala 1 - 5.
              </p>
            </div>

            <form onSubmit={handleSaveEvaluation} className="space-y-6">
              {/* Core Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Guru/Pegawai <span className="text-rose-500 font-bold">*</span></label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                    required
                  >
                    <option value="">Pilih Guru/Pegawai</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} (NIY: {t.niy || "-"})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jabatan Kerja Diuji <span className="text-rose-500 font-bold">*</span></label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                    required
                    disabled={!selectedTeacherId}
                  >
                    <option value="">Pilih Peran</option>
                    {/* Filter dynamically based on teacher's multi roles if defined, else show defaults */}
                    {selectedTeacherId && (
                      (teachers.find(t => t.id === selectedTeacherId) as any)?.roles || 
                      parseEmployeeTypeToRoles(teachers.find(t => t.id === selectedTeacherId)?.employeeType || "")
                    ).map((rId: string) => {
                      const matchRole = jabatans.find(j => j.id === rId);
                      return (
                        <option key={rId} value={rId}>{matchRole?.name || rId}</option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tahun Pelajaran <span className="text-rose-500 font-bold">*</span></label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.name}>{y.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Semester <span className="text-rose-500 font-bold">*</span></label>
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500/20"
                    required
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              {/* STATS PREVIEW COMPONENT */}
              {isLoadingStats ? (
                <div className="bg-slate-50 dark:bg-zinc-900/60 p-5 rounded-2xl flex items-center justify-center gap-3 border border-dashed border-gray-200 dark:border-zinc-800">
                  <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  <span className="text-xs text-slate-400 font-semibold">Mengambil metrik pengisian asatidzah...</span>
                </div>
              ) : autoStats ? (
                renderAutoStatsBreakdown({
                  roleId: selectedRoleId,
                  autoStats: autoStats,
                  components: formComponents
                })
              ) : null}

              {/* INSTRUMENT QUESTIONS */}
              {formComponents.length > 0 && (
                <div className="space-y-6">
                  <h4 className="font-extrabold text-slate-800 dark:text-zinc-100 border-b pb-1 dark:border-zinc-800">
                    Sesi Penilaian Komponen
                  </h4>

                  {formComponents.map((comp, compIdx) => (
                    <div key={compIdx} className="space-y-4">
                      <div className="bg-slate-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-lg text-xs font-black tracking-wider text-slate-700 dark:text-zinc-300">
                        {comp.name}
                      </div>

                      <div className="space-y-4">
                        {comp.indicators.map((ind, indIdx) => (
                          <div key={indIdx} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-850">
                            <div className="md:col-span-5">
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 block">{ind.name}</span>
                              <span className="text-[10px] text-slate-400">IKU Jabatan Kerja</span>
                            </div>

                            <div className="md:col-span-3 flex items-center justify-center gap-1.5">
                              {[1, 2, 3, 4, 5].map((val) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleScoreChange(compIdx, indIdx, val)}
                                  className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                                    ind.score === val
                                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                                      : "bg-slate-50 dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 hover:bg-slate-100"
                                  }`}
                                >
                                  {val}
                                </button>
                              ))}
                            </div>

                            <div className="md:col-span-4">
                              <input
                                type="text"
                                placeholder="Tulis catatan evaluasi..."
                                value={ind.comment}
                                onChange={(e) => handleCommentChange(compIdx, indIdx, e.target.value)}
                                className="w-full bg-slate-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* COMMENTS AND RECOMMENDATIONS */}
              {formComponents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-zinc-800">
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Komentar Penilai Umum</label>
                    <textarea
                      placeholder="Masukkan catatan evaluasi menyeluruh..."
                      value={overallComment}
                      onChange={(e) => setOverallComment(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 text-xs text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Rekomendasi Tindak Lanjut (Opsional)</label>
                    <textarea
                      placeholder="Kosongkan untuk menggunakan rekomendasi otomatis berbasis skor terendah..."
                      value={customRecommendation}
                      onChange={(e) => setCustomRecommendation(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-50 dark:bg-zinc-800/30 border border-gray-200 dark:border-zinc-800 rounded-2xl p-3 text-xs text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              {formComponents.length > 0 && (
                <div className="flex items-center justify-end gap-3 pt-6 border-t dark:border-zinc-800">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as "Draft" | "Submitted")}
                    className="bg-slate-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300"
                  >
                    <option value="Draft">Draft Penilaian</option>
                    <option value="Submitted">Submit & Terbitkan Rapor</option>
                  </select>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-extrabold tracking-wider uppercase rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Simpan Nilai Rapor
                  </button>
                </div>
              )}

              {formComponents.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <UserCheck className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                  Harap tentukan Guru/Pegawai dan Jabatan Diuji terlebih dahulu untuk memuat instrumen penilaian.
                </div>
              )}
            </form>
          </motion.div>
        ) : activeTab === "hasil" ? (
          /* ========================================================================= */
          /* SUBMENU 3: HASIL PENILAIAN (E-RAPOR GRID)                                  */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Header with Export */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Ditemukan {filteredEvaluations.length} Lembar Penilaian Kinerja
              </span>
              <button
                onClick={exportToCsv}
                disabled={filteredEvaluations.length === 0}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                Ekspor ke Excel
              </button>
            </div>

            {/* Grid List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredEvaluations.length === 0 ? (
                <div className="col-span-full bg-white dark:bg-zinc-900 p-20 text-center rounded-3xl border border-gray-200 dark:border-zinc-800">
                  <Award className="h-12 w-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                  <p className="text-slate-500 font-semibold text-sm">Tidak Ada Rapor Ditemukan</p>
                  <p className="text-xs text-slate-400 mt-1">Harap sesuaikan filter pencarian atau pastikan evaluasi telah terbit.</p>
                </div>
              ) : (
                filteredEvaluations.map((e) => (
                  <div
                    key={e.id}
                    className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:border-blue-500/50 transition-all group"
                  >
                    <div>
                      {/* Top section */}
                      <div className="flex items-center justify-between gap-2 border-b pb-3 mb-4 dark:border-zinc-850">
                        <div>
                          <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            e.status === "Submitted"
                              ? "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                          }`}>
                            {e.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">
                          Sem {e.semester}
                        </div>
                      </div>

                      {/* Bio */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-full flex items-center justify-center font-bold text-sm">
                          {e.teacherName[0]}
                        </div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-100 truncate">{e.teacherName}</h4>
                          <p className="text-[10px] text-slate-400 font-semibold">NIY: {e.niy || "-"}</p>
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">{e.roleName}</p>
                        </div>
                      </div>

                      {/* Scoring Summary */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-2xl mb-4 text-center">
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Skor Akhir</span>
                          <div className="text-lg font-black text-slate-900 dark:text-zinc-50 mt-0.5">{e.finalScore}</div>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Predikat</span>
                          <div className="text-xs font-extrabold text-blue-600 dark:text-blue-400 mt-1 truncate">{e.category}</div>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-end gap-2 border-t pt-3 dark:border-zinc-850">
                      {isEvaluator && !isReadOnly && (
                        <button
                          onClick={() => handleDeleteEval(e.id)}
                          className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 rounded-xl cursor-pointer transition-colors"
                          title="Hapus Nilai Rapor"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => setViewingEval(e)}
                        className="flex items-center gap-1 px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-blue-600 hover:text-white transition-all rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Cetak Rapor
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : activeTab === "rekap" ? (
          /* ========================================================================= */
          /* SUBMENU 4: REKAPITULASI (LEADERBOARD)                                      */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Top Leaderboard Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...filteredEvaluations]
                .filter(e => e.status === "Submitted")
                .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
                .slice(0, 3)
                .map((e, idx) => {
                  const colors = [
                    "from-yellow-400 to-amber-500 text-amber-950",
                    "from-slate-300 to-slate-400 text-slate-900",
                    "from-amber-600 to-amber-700 text-amber-50"
                  ];
                  return (
                    <div
                      key={e.id}
                      className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs relative overflow-hidden flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-black text-md`}>
                          {idx + 1}
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Terbaik {idx + 1} Kinerja</span>
                          <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-100 mt-1 truncate max-w-[150px]">{e.teacherName}</h4>
                          <span className="text-[10px] text-blue-500 font-bold">{e.roleName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-slate-900 dark:text-zinc-50">{e.finalScore}</div>
                        <span className="text-[10px] text-emerald-600 font-bold">{e.category}</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Performance Ranking Table */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4 border-b pb-4 dark:border-zinc-800">
                <h3 className="font-bold text-slate-950 dark:text-zinc-50 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Peringkat Akumulasi Kinerja SDM
                </h3>
                <button
                  onClick={exportToCsv}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                >
                  Ekspor Rekap CSV
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-zinc-800 text-slate-400 font-bold">
                      <th className="py-3 px-4">Peringkat</th>
                      <th className="py-3 px-4">Nama Lengkap</th>
                      <th className="py-3 px-4">NIY</th>
                      <th className="py-3 px-4">Jabatan Kerja</th>
                      <th className="py-3 px-4">Tahun & Sem</th>
                      <th className="py-3 px-4 text-center">Skor (0-100)</th>
                      <th className="py-3 px-4">Predikat</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredEvaluations]
                      .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
                      .map((e, idx) => (
                        <tr key={e.id} className="border-b border-gray-100 dark:border-zinc-850 hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-100">{e.teacherName}</td>
                          <td className="py-3 px-4 text-slate-500">{e.niy || "-"}</td>
                          <td className="py-3 px-4 font-semibold text-blue-600 dark:text-blue-400">{e.roleName}</td>
                          <td className="py-3 px-4 text-slate-400 font-medium">{e.academicYear} • {e.semester}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-extrabold text-slate-900 dark:text-zinc-50 bg-slate-50 dark:bg-zinc-800 px-2 py-1 rounded-md">
                              {e.finalScore}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block font-bold text-[10px] px-2.5 py-0.5 rounded-full ${
                              (e.finalScore || 0) >= 90
                                ? "bg-green-50 text-green-700 dark:bg-green-950/20"
                                : (e.finalScore || 0) >= 80
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/20"
                            }`}>
                              {e.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-500">{e.status}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === "histori" ? (
          /* ========================================================================= */
          /* SUBMENU 5: HISTORI KINERJA INDIVIDU                                       */
          /* ========================================================================= */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Header and Teacher Selector */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-950 dark:text-zinc-50 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  Histori Perkembangan Kinerja PTK
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Pantau pertumbuhan kompetensi, grafik historis nilai, dan catatan rekomendasi asatidzah dari waktu ke waktu.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pilih Pegawai:</span>
                <select
                  value={selectedHistoriTeacherId}
                  onChange={(e) => setSelectedHistoriTeacherId(e.target.value)}
                  className="bg-slate-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">-- Pilih Guru/Pegawai --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} (NIY: {t.niy || "-"})</option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const targetTeacherId = selectedHistoriTeacherId || (teachers[0]?.id || "");
              const currentTeacher = teachers.find(t => t.id === targetTeacherId);
              
              if (!targetTeacherId || !currentTeacher) {
                return (
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-12 rounded-3xl text-center text-slate-400 italic text-sm">
                    Silakan pilih Guru/Pegawai pada dropdown di atas untuk memuat histori kinerja.
                  </div>
                );
              }

              // Get all evaluations for this teacher
              const teacherEvals = evaluations
                .filter(e => e.teacherId === targetTeacherId && e.status === "Submitted")
                .sort((a, b) => {
                  const yrDiff = a.academicYear.localeCompare(b.academicYear);
                  if (yrDiff !== 0) return yrDiff;
                  return a.semester === "Ganjil" ? -1 : 1;
                });

              // Compute trend line data
              const trendLineData = teacherEvals.map(e => {
                // Get general average for the same period
                const periodEvals = evaluations.filter(ev => ev.academicYear === e.academicYear && ev.semester === e.semester && ev.status === "Submitted");
                const avgScore = periodEvals.length > 0 
                  ? Math.round(periodEvals.reduce((s, ev) => s + (ev.finalScore || 0), 0) / periodEvals.length) 
                  : 80;

                return {
                  period: `${e.academicYear} - ${e.semester}`,
                  skorPribadi: e.finalScore || 0,
                  rataRataSekolah: avgScore
                };
              });

              // Real trend line data or empty array when there is no entries yet (no fabricated mock data)
              const finalTrendData = trendLineData;

              const latestEval = teacherEvals[teacherEvals.length - 1];

              return (
                <div className="space-y-6">
                  {/* Top Analytics Block */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Panel: Profile and KPI stats */}
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
                      <div className="flex items-center gap-4 border-b pb-4 dark:border-zinc-850">
                        <div className="h-12 w-12 bg-blue-100 dark:bg-blue-950/50 rounded-full flex items-center justify-center text-lg font-black text-blue-600 dark:text-blue-400">
                          {currentTeacher.name[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-zinc-50">{currentTeacher.name}</h4>
                          <span className="text-xs text-slate-400 font-semibold">NIY: {currentTeacher.niy || "-"} • {currentTeacher.employeeType || "Staff"}</span>
                        </div>
                      </div>

                      <div className="space-y-4 py-6">
                        <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl border border-gray-100 dark:border-zinc-900">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Skor Terakhir</span>
                            <span className="text-xl font-black text-slate-900 dark:text-zinc-50">{latestEval ? latestEval.finalScore : "Belum Dinilai"}</span>
                          </div>
                          {latestEval && (
                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-lg">
                              {latestEval.category}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-center text-xs">
                          <div className="bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-2xl border border-gray-100 dark:border-zinc-900">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Evaluasi</span>
                            <span className="block text-md font-extrabold text-blue-600 mt-1">{teacherEvals.length} Rapor</span>
                          </div>
                          <div className="bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-2xl border border-gray-100 dark:border-zinc-900">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Perbandingan</span>
                            <span className="block text-md font-extrabold text-emerald-600 mt-1">
                              {latestEval ? `${latestEval.finalScore && latestEval.finalScore >= 80 ? "Di Atas KKM" : "Perlu Bimbingan"}` : "-"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Integrated Telemetry stats counter */}
                      <div className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/20 p-4 rounded-2xl">
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-2">Metrik Keaktifan Kumulatif</span>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          <div>
                            <span className="text-slate-400 block font-semibold">Jurnal Ajar</span>
                            <span className="font-extrabold text-slate-800 dark:text-zinc-100 block mt-0.5">{latestEval?.autoStats?.teachingJournals || 0}x</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-semibold">Jurnal Musrif</span>
                            <span className="font-extrabold text-slate-800 dark:text-zinc-100 block mt-0.5">{latestEval?.autoStats?.musrifJournals || 0}x</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-semibold">Diklat GTK</span>
                            <span className="font-extrabold text-slate-800 dark:text-zinc-100 block mt-0.5">{latestEval?.autoStats?.developmentActivities || 0}x</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Panel: Recharts AreaChart Trend */}
                    <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs flex flex-col justify-between">
                      <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-zinc-850">
                        <div>
                          <h4 className="font-bold text-slate-950 dark:text-zinc-50 text-sm">Grafik Kompetensi & Evaluasi Berkala</h4>
                          <p className="text-[9px] text-slate-400">Komparasi nilai pribadi vs nilai rata-rata sekolah</p>
                        </div>
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Real-time Line Chart</span>
                      </div>

                      <div className="h-56 w-full flex items-center justify-center">
                        {finalTrendData.length === 0 ? (
                          <div className="text-center space-y-2 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-6 bg-slate-50/50 dark:bg-zinc-950/20 w-full h-full flex flex-col items-center justify-center">
                            <Activity className="h-8 w-8 text-slate-350 dark:text-zinc-750 mx-auto animate-pulse" />
                            <p className="text-xs text-slate-450 dark:text-zinc-500 font-medium">Belum ada data evaluasi kompetensi berkala.</p>
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={finalTrendData}
                              margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                            >
                              <defs>
                                <linearGradient id="colorSkor" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" className="dark:stroke-zinc-800" />
                              <XAxis dataKey="period" tick={{ fontSize: 9, fontWeight: 600, fill: "#94A3B8" }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 600, fill: "#94A3B8" }} />
                              <Tooltip contentStyle={{ fontSize: 10, borderRadius: 12 }} />
                              <Legend wrapperStyle={{ fontSize: 10 }} />
                              <Area type="monotone" dataKey="skorPribadi" name="Skor Pribadi" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorSkor)" />
                              <Line type="monotone" dataKey="rataRataSekolah" name="Rata-rata Sekolah" stroke="#94A3B8" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Historic Notes and comments Timeline */}
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
                    <h3 className="font-bold text-slate-950 dark:text-zinc-50 text-sm mb-4 flex items-center gap-2">
                      <Sparkles className="h-4.5 w-4.5 text-blue-600" />
                      Arsip Penilaian & Rekomendasi Terbuka
                    </h3>

                    {teacherEvals.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 italic text-xs">
                        Belum ada arsip rapor kinerja berstatus terbit untuk guru ini.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {teacherEvals.map((ev, idx) => (
                          <div key={ev.id} className="p-5 rounded-2xl border border-gray-150 dark:border-zinc-850 hover:border-blue-500/20 transition-all bg-slate-50/30 dark:bg-zinc-900/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-zinc-850 pb-3 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold text-xs">{idx + 1}</span>
                                <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-200">
                                  Tahun Pelajaran {ev.academicYear} ({ev.semester})
                                </h4>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400">Evaluator: <strong>{ev.evaluatorName}</strong></span>
                                <span className="text-xs font-bold text-blue-700 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-0.5 rounded-full">
                                  Skor: {ev.finalScore} ({ev.category})
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-3 leading-relaxed">
                              <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-100 dark:border-zinc-850/50">
                                <span className="font-bold text-slate-600 dark:text-zinc-400 block mb-1">Catatan Evaluator:</span>
                                <p className="text-slate-500 dark:text-zinc-400 italic">
                                  "{ev.overallComment || "Kinerja secara keseluruhan berjalan stabil sesuai standar pondok pesantren."}"
                                </p>
                              </div>
                              <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-gray-100 dark:border-zinc-850/50">
                                <span className="font-bold text-slate-600 dark:text-zinc-400 block mb-1">Rekomendasi Pengembangan:</span>
                                <p className="text-slate-500 dark:text-zinc-400">
                                  {ev.recommendation || "Lanjutkan keaktifan pengisian jurnal harian dan hadiri agenda IHT secara konsisten."}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
