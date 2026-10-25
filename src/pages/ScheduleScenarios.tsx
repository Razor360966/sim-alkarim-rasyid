import React, { useState } from "react";
import { 
  GitBranch, 
  Plus, 
  Copy, 
  Trash2, 
  Calendar, 
  Clock, 
  Layers, 
  Search, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  BookOpen, 
  ArrowRight, 
  FileText, 
  GitCompare, 
  Printer, 
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Info,
  Check,
  X
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scenarioService } from "../services/scenario.service";
import { academicYearService } from "../services/academicYear.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { teacherService } from "../services/teacherService";
import { lessonPeriodService } from "../services/lessonPeriod.service";
import { 
  ScheduleScenario, 
  ScenarioStatus, 
  ScenarioCurriculumMatrix, 
  ScenarioSchedule, 
  ScenarioApplyResult,
  ScenarioSyncPreviewResult,
  Class, 
  Teacher, 
  LessonPeriod,
  AcademicYear,
  Semester
} from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { ScenarioCurriculumEditor } from "../components/ScenarioCurriculumEditor";
import { ScenarioScheduleEditor } from "../components/ScenarioScheduleEditor";
import { ScenarioComparisonView } from "../components/ScenarioComparisonView";
import { ScenarioPrintModal } from "../components/ScenarioPrintModal";
import { ScenarioApplyModal } from "../components/ScenarioApplyModal";
import { ScenarioSyncModal } from "../components/ScenarioSyncModal";

export default function ScheduleScenariosPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Active view state
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"curriculum" | "schedule" | "compare">("curriculum");

  // Filters & Search for Dashboard
  const [searchTerm, setSearchTerm] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState<ScheduleScenario | null>(null);
  const [showStatusModal, setShowStatusModal] = useState<ScheduleScenario | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState<ScheduleScenario | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPreview, setSyncPreview] = useState<ScenarioSyncPreviewResult | null>(null);
  const [isLoadingSyncPreview, setIsLoadingSyncPreview] = useState(false);
  const [isApplyingSync, setIsApplyingSync] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    academicYearId: "",
    academicYearName: "",
    semesterId: "",
    semesterName: "",
    consultationNotes: ""
  });
  const [dupName, setDupName] = useState("");
  const [statusForm, setStatusForm] = useState({
    status: "Diajukan" as ScenarioStatus,
    notes: "",
    reason: ""
  });

  // Helper to normalize and check role
  const checkRoleMatches = (r?: string | null, targetRoles: string[] = []): boolean => {
    if (!r) return false;
    const clean = r.toLowerCase().trim().replace(/_/g, " ");
    return targetRoles.some(t => {
      const cleanTarget = t.toLowerCase().trim().replace(/_/g, " ");
      return clean === cleanTarget;
    });
  };

  const CURRICULUM_ADMIN_ROLES = [
    "admin",
    "operator",
    "wakil kepala sekolah",
    "wakakur",
    "wakakurikulum",
    "waka kurikulum",
    "kurikulum",
    "kepala sekolah",
    "tata usaha"
  ];

  const LEADERSHIP_ROLES = [
    "kepala sekolah",
    "pimpinan",
    "ketua yayasan",
    "yayasan"
  ];

  // Check RBAC permission for editing
  const isCurriculumOrAdmin = 
    checkRoleMatches(user?.role, CURRICULUM_ADMIN_ROLES) ||
    Boolean(user?.roles && user.roles.some((r) => checkRoleMatches(r, CURRICULUM_ADMIN_ROLES)));

  const isLeadership = 
    checkRoleMatches(user?.role, LEADERSHIP_ROLES) ||
    Boolean(user?.roles && user.roles.some((r) => checkRoleMatches(r, LEADERSHIP_ROLES)));

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------
  const { data: scenarios = [], isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["schedule_scenarios"],
    queryFn: () => scenarioService.getScenarios()
  });

  const { data: academicYears = [] } = useQuery({
    queryKey: ["academic_years"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => semesterService.getSemesters()
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classService.getClasses()
  });

  const { 
    data: teachers = [],
    isLoading: isLoadingTeachers,
    isError: isErrorTeachers,
    refetch: refetchTeachers
  } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: periods = [] } = useQuery({
    queryKey: ["lesson_periods"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  // Active Scenario Detail Queries
  const { data: activeScenario } = useQuery({
    queryKey: ["scenario", activeScenarioId],
    queryFn: () => (activeScenarioId ? scenarioService.getScenarioById(activeScenarioId) : null),
    enabled: Boolean(activeScenarioId)
  });

  const { data: activeCurriculums = [], refetch: refetchCurriculums } = useQuery({
    queryKey: ["scenario_curriculums", activeScenarioId],
    queryFn: () => (activeScenarioId ? scenarioService.getScenarioCurriculums(activeScenarioId) : []),
    enabled: Boolean(activeScenarioId)
  });

  const { data: activeSchedules = [], refetch: refetchSchedules } = useQuery({
    queryKey: ["scenario_schedules", activeScenarioId],
    queryFn: () => (activeScenarioId ? scenarioService.getScenarioSchedules(activeScenarioId) : []),
    enabled: Boolean(activeScenarioId)
  });

  const { data: activeSubjects = [] } = useQuery({
    queryKey: ["scenario_subjects", activeScenarioId],
    queryFn: () => (activeScenarioId ? scenarioService.getScenarioSubjects(activeScenarioId) : []),
    enabled: Boolean(activeScenarioId)
  });

  // Calculate conflicts for active scenario
  const activeConflicts = React.useMemo(() => {
    if (!activeScenarioId) return [];
    return scenarioService.detectConflicts(activeSchedules, activeCurriculums, classes, periods);
  }, [activeScenarioId, activeSchedules, activeCurriculums, classes, periods]);

  const parseErrorMessage = (err: any): string => {
    if (!err) return "Terjadi kesalahan tidak diketahui.";
    const rawMsg = err.message || (typeof err === "string" ? err : "");
    if (rawMsg) {
      // Check if rawMsg is stringified FirestoreErrorInfo
      if (rawMsg.startsWith("{") && rawMsg.endsWith("}")) {
        try {
          const parsed = JSON.parse(rawMsg);
          if (parsed.error) {
            if (parsed.error.includes("Missing or insufficient permissions")) {
              return "Akses ditolak: Anda tidak memiliki wewenang untuk membuat rancangan jadwal bayangan.";
            }
            return parsed.error;
          }
        } catch {
          // ignore json parse error
        }
      }
      if (rawMsg.includes("Missing or insufficient permissions") || rawMsg.includes("permission-denied")) {
        return "Akses ditolak: Akun Anda tidak memiliki hak akses kurikulum/admin untuk membuat jadwal bayangan.";
      }
      return rawMsg;
    }
    return "Gagal memproses operasi rancangan jadwal bayangan.";
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => scenarioService.createScenarioFromSnapshot(data),
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      showToast("Rancangan Jadwal Bayangan berhasil dibuat dari snapshot operasional", "success");
      setShowCreateModal(false);
      setActiveScenarioId(newId);
    },
    onError: (err: any) => {
      showToast(parseErrorMessage(err), "error");
    }
  });

  const duplicateMutation = useMutation({
    mutationFn: (data: any) => scenarioService.duplicateScenario(data),
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      showToast("Rancangan berhasil diduplikasi menjadi alternatif baru", "success");
      setShowDuplicateModal(null);
      setActiveScenarioId(newId);
    },
    onError: (err: any) => {
      showToast(parseErrorMessage(err), "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scenarioService.deleteScenario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      showToast("Rancangan dan seluruh data simulasinya telah dihapus", "info");
      if (activeScenarioId) setActiveScenarioId(null);
    },
    onError: (err: any) => {
      showToast(parseErrorMessage(err), "error");
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: (params: any) => scenarioService.updateScenarioStatus(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
      showToast("Status rancangan berhasil diperbarui", "success");
      setShowStatusModal(null);
    },
    onError: (err: any) => {
      showToast(parseErrorMessage(err), "error");
    }
  });

  const publishMutation = useMutation({
    mutationFn: (scId: string) => {
      if (!user) throw new Error("Sesi login Anda tidak valid.");
      return scenarioService.publishScenarioLiveSchedule({
        scenarioId: scId,
        user: { uid: user.uid, displayName: user.displayName }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      showToast("Jadwal operasional resmi SIMAK berhasil dipublikasikan!", "success");
    },
    onError: (err: any) => {
      showToast(parseErrorMessage(err), "error");
    }
  });

  // Handlers for Curriculum
  const handleDeleteZeroJp = async (itemIds: string[]) => {
    if (!user || !activeScenarioId) return;
    const res = await scenarioService.removeZeroJpCurriculumItems({
      scenarioId: activeScenarioId,
      curriculumItemIds: itemIds,
      user: { uid: user.uid, displayName: user.displayName }
    });
    refetchCurriculums();
    queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
    showToast(`Berhasil membersihkan ${res.deletedCount} mapel tanpa alokasi JP dari rancangan`, "success");
  };

  const handleUpdateCurriculumItem = async (item: ScenarioCurriculumMatrix) => {
    if (!user) return;
    try {
      await scenarioService.updateScenarioCurriculumItem(item, {
        uid: user.uid,
        displayName: user.displayName
      });
      await refetchCurriculums();
      await refetchSchedules();
      queryClient.invalidateQueries({ queryKey: ["scenario_curriculums", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
      showToast("Data mapel dan guru pengampu berhasil disimpan di rancangan", "success");
    } catch (err: any) {
      showToast(parseErrorMessage(err), "error");
      throw err;
    }
  };

  const handleOpenSyncModal = async () => {
    if (!activeScenarioId) return;
    setIsLoadingSyncPreview(true);
    try {
      const preview = await scenarioService.previewScenarioCurriculumSync({
        scenarioId: activeScenarioId
      });
      setSyncPreview(preview);
      setShowSyncModal(true);
    } catch (err: any) {
      showToast(parseErrorMessage(err), "error");
    } finally {
      setIsLoadingSyncPreview(false);
    }
  };

  const handleApplySync = async () => {
    if (!user || !activeScenarioId) return;
    setIsApplyingSync(true);
    try {
      const res = await scenarioService.syncScenarioCurriculumToSchedules({
        scenarioId: activeScenarioId,
        user: { uid: user.uid, displayName: user.displayName },
        preview: syncPreview || undefined
      });
      await refetchSchedules();
      await refetchCurriculums();
      queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_curriculums", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
      setShowSyncModal(false);
      showToast(
        `Sinkronisasi berhasil diterapkan: ${res.freedSlotsCount} slot dikosongkan, ${res.addedSlotsCount} slot ditambahkan, ${res.syncedTeachersCount} penugasan guru diselaraskan.`,
        "success"
      );
    } catch (err: any) {
      showToast(parseErrorMessage(err), "error");
    } finally {
      setIsApplyingSync(false);
    }
  };

  const handleRealignFromOperational = async () => {
    if (!user || !activeScenarioId) return;
    try {
      const res = await scenarioService.realignScenarioTeachersFromOperational({
        scenarioId: activeScenarioId,
        user: { uid: user.uid, displayName: user.displayName }
      });
      await refetchCurriculums();
      await refetchSchedules();
      queryClient.invalidateQueries({ queryKey: ["scenario_curriculums", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
      showToast(`Berhasil menyelaraskan ${res.updatedSubjectsCount} mapel dan ${res.updatedSchedulesCount} slot jadwal dari data asli`, "success");
    } catch (err: any) {
      showToast(parseErrorMessage(err), "error");
    }
  };

  const handleToggleSubjectActive = async (id: string, isActive: boolean) => {
    if (!user) return;
    await scenarioService.toggleSubjectActiveInScenario(id, isActive, {
      uid: user.uid,
      displayName: user.displayName
    });
    refetchCurriculums();
    queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
    showToast(isActive ? "Mata pelajaran diaktifkan di rancangan" : "Mata pelajaran dinonaktifkan dari rancangan", "info");
  };

  const handleAddCustomSubject = async (data: any) => {
    if (!user || !activeScenarioId) return;
    await scenarioService.addCustomSubjectToScenario({
      scenarioId: activeScenarioId,
      ...data,
      user: { uid: user.uid, displayName: user.displayName }
    });
    refetchCurriculums();
    queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
    showToast("Mata pelajaran khusus simulasi berhasil ditambahkan", "success");
  };

  // Handlers for Schedule
  const handleSaveSlot = async (slot: any) => {
    if (!user || !activeScenarioId) return;
    await scenarioService.saveScenarioScheduleSlot(slot, {
      uid: user.uid,
      displayName: user.displayName
    });
    await refetchSchedules();
    await queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
    await queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
    showToast("Slot jadwal simulasi berhasil disimpan", "success");
  };

  const handleClearSlot = async (
    slotId: string,
    context?: { classId: string; day: string; sequence: number }
  ) => {
    if (!user || !activeScenarioId) return;
    await scenarioService.clearScenarioScheduleSlot(
      slotId,
      activeScenarioId,
      {
        uid: user.uid,
        displayName: user.displayName
      },
      context
    );
    await refetchSchedules();
    await queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
    await queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
    showToast("Slot jadwal simulasi dikosongkan", "info");
  };

  const handleClearAllSchedules = async (scope: { classId?: string; className?: string }) => {
    if (!user || !activeScenarioId) throw new Error("Sesi login Anda tidak valid.");
    const res = await scenarioService.clearAllScenarioSchedules({
      scenarioId: activeScenarioId,
      classId: scope.classId,
      user: {
        uid: user.uid,
        displayName: user.displayName
      }
    });
    await refetchSchedules();
    await queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
    await queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
    await queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
    return res;
  };

  const handleMoveOrSwapSlot = async (data: any) => {
    if (!user || !activeScenarioId) return;
    try {
      await scenarioService.moveOrSwapScenarioScheduleSlot({
        scenarioId: activeScenarioId,
        ...data,
        user: {
          uid: user.uid,
          displayName: user.displayName
        }
      });
      await refetchSchedules();
      queryClient.invalidateQueries({ queryKey: ["scenario_schedules", activeScenarioId] });
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });

      const srcSubject = data.sourceSlot?.schedule?.subjectName || "Mata Pelajaran";
      const targetExisting = data.targetSlot?.existingSchedule;
      const hasTarget = Boolean(
        targetExisting &&
        targetExisting.subjectId &&
        targetExisting.subjectName !== "Kosong" &&
        targetExisting.subjectName !== "Belum Ditugaskan"
      );

      if (hasTarget) {
        showToast(`Berhasil menukar slot ${srcSubject} dengan ${targetExisting.subjectName} di kelas ${data.targetSlot.className}!`, "success");
      } else {
        showToast(`Berhasil memindahkan ${srcSubject} ke Kelas ${data.targetSlot.className} pada ${data.targetSlot.day} ${data.targetSlot.jp || `JP ${data.targetSlot.sequence}`}!`, "success");
      }
    } catch (err: any) {
      console.error("Gagal memindahkan slot jadwal bayangan:", err);
      showToast(parseErrorMessage(err) || "Gagal memindahkan slot jadwal bayangan. Data sebelumnya dipertahankan.", "error");
      throw err;
    }
  };


  // Filtered Scenarios
  const filteredScenarios = scenarios.filter((sc) => {
    const matchesSearch =
      sc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sc.description && sc.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesYear = !filterYear || sc.academicYearId === filterYear;
    const matchesStatus = !filterStatus || sc.status === filterStatus;
    return matchesSearch && matchesYear && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* SECTION BANNER: NON-OPERATIONAL DISCLAIMER */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-300 dark:border-amber-800/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs mt-0.5">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-extrabold text-amber-900 dark:text-amber-200 text-base sm:text-lg">
              Jadwal Bayangan (Simulasi Perencanaan Kurikulum dan Jadwal)
            </h2>
            <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-300/90 mt-0.5 max-w-3xl leading-relaxed">
              Modul ini merupakan ruang kerja simulasi terisolasi untuk menyusun dan membandingkan alternatif kurikulum, distribusi JP, dan jadwal. 
              <strong> Seluruh data rancangan disimpan terpisah dan TIDAK mengubah jadwal operasional sekolah.</strong>
            </p>
          </div>
        </div>

        {/* Global Action */}
        {!activeScenarioId && isCurriculumOrAdmin && (
          <button
            onClick={() => {
              const activeAy = academicYears.find((y) => y.isActive) || academicYears[0];
              const yearSemesters = activeAy ? semesters.filter((s) => s.academicYearId === activeAy.id) : semesters;
              const activeSem = (yearSemesters.length > 0 ? (yearSemesters.find((s) => s.isActive) || yearSemesters[0]) : null) || semesters.find((s) => s.isActive) || semesters[0];
              setCreateForm({
                name: "",
                description: "",
                academicYearId: activeAy?.id || "",
                academicYearName: activeAy?.name || activeAy?.year || "",
                semesterId: activeSem?.id || "",
                semesterName: activeSem?.name || "",
                consultationNotes: ""
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Buat Rancangan Baru
          </button>
        )}
      </div>

      {/* VIEW A: SCENARIO DASHBOARD (LIST) */}
      {!activeScenarioId && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Cari nama atau deskripsi rancangan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="text-xs sm:text-sm font-semibold border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Semua Tahun Ajaran</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>
                    {ay.year}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-xs sm:text-sm font-semibold border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
              >
                <option value="">Semua Status</option>
                <option value="Draft">Draft</option>
                <option value="Diajukan">Diajukan</option>
                <option value="Perlu Revisi">Perlu Revisi</option>
                <option value="Disetujui">Disetujui</option>
                <option value="Ditolak">Ditolak</option>
              </select>
            </div>
          </div>

          {/* Scenario Cards Grid */}
          {isLoadingScenarios ? (
            <div className="p-12 text-center text-slate-500">Memuat daftar rancangan...</div>
          ) : filteredScenarios.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-800 rounded-2xl p-12 text-center space-y-3">
              <GitBranch className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="font-bold text-slate-800 dark:text-white text-base">
                Belum Ada Rancangan Jadwal Bayangan
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Buat rancangan pertama untuk mensimulasikan penambahan JP, mapel baru, atau alternatif pembagian jam mengajar tanpa memengaruhi jadwal aktif.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredScenarios.map((sc) => {
                const metrics = sc.summaryMetrics;
                const statusColor =
                  sc.status === "Disetujui"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : sc.status === "Diterapkan"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    : sc.status === "Diajukan"
                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                    : sc.status === "Perlu Revisi"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : sc.status === "Ditolak"
                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                    : "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300";

                return (
                  <div
                    key={sc.id}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${statusColor}`}>
                          {sc.status}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {sc.academicYearName} • {sc.semesterName}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug line-clamp-2">
                        {sc.name}
                      </h3>
                      {sc.description && (
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                          {sc.description}
                        </p>
                      )}

                      {/* Snapshot Metrics */}
                      <div className="grid grid-cols-3 gap-2 my-4 bg-slate-50 dark:bg-zinc-850 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 text-center text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px] block">VII</span>
                          <strong className="text-slate-800 dark:text-zinc-200 font-bold">{metrics?.totalJpVii || 0} JP</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">VIII</span>
                          <strong className="text-slate-800 dark:text-zinc-200 font-bold">{metrics?.totalJpVIII || 0} JP</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] block">IX</span>
                          <strong className="text-slate-800 dark:text-zinc-200 font-bold">{metrics?.totalJpIX || 0} JP</strong>
                        </div>
                      </div>

                      {/* Small Summary Chips */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mb-4">
                        <span>Penyusun: <strong>{sc.createdByName}</strong></span>
                        <span>•</span>
                        <span>{new Date(sc.createdAt).toLocaleDateString("id-ID")}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        {/* Duplicate Button */}
                        <button
                          onClick={() => {
                            setShowDuplicateModal(sc);
                            setDupName(`Alternatif - ${sc.name}`);
                          }}
                          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Duplikasi Rancangan"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {/* Status Change Button (Leadership & Staff) */}
                        <button
                          onClick={() => {
                            setShowStatusModal(sc);
                            setStatusForm({
                              status: sc.status,
                              notes: "",
                              reason: ""
                            });
                          }}
                          className="p-2 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Ubah Status & Catatan Konsultasi"
                        >
                          <Clock className="w-4 h-4" />
                        </button>

                        {/* Delete Button (Staff/Admin) */}
                        {isCurriculumOrAdmin && (
                          <button
                            onClick={() => {
                              if (confirm(`Hapus rancangan "${sc.name}" dan seluruh simulasi di dalamnya?`)) {
                                deleteMutation.mutate(sc.id);
                              }
                            }}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Hapus Rancangan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Quick Apply Button on Card if Approved */}
                        {isCurriculumOrAdmin && (sc.status === "Disetujui" || sc.status === "Diterapkan") && (
                          <button
                            onClick={() => setShowApplyModal(sc)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-lg text-xs font-bold transition-colors border border-emerald-200 dark:border-emerald-800"
                            title="Terapkan Massal ke Jadwal Operasional"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Terapkan</span>
                          </button>
                        )}

                        {/* Open Details Button */}
                        <button
                          onClick={() => setActiveScenarioId(sc.id)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                        >
                          <span>Buka</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW B: ACTIVE SCENARIO WORKBENCH */}
      {activeScenarioId && activeScenario && (
        <div className="space-y-6">
          {/* Breadcrumb & Scenario Header Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <button
                  onClick={() => setActiveScenarioId(null)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-2"
                >
                  ← Kembali ke Daftar Jadwal Bayangan
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {activeScenario.name}
                  </h2>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    activeScenario.status === "Disetujui"
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : activeScenario.status === "Diterapkan"
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                      : activeScenario.status === "Diajukan"
                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                      : activeScenario.status === "Perlu Revisi"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : activeScenario.status === "Ditolak"
                      ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}>
                    {activeScenario.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Tahun Ajaran: {activeScenario.academicYearName} • {activeScenario.semesterName} • Penyusun: {activeScenario.createdByName}
                </p>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Bahan Rapat & Cetak
                </button>

                <button
                  onClick={() => {
                    setShowStatusModal(activeScenario);
                    setStatusForm({
                      status: activeScenario.status,
                      notes: "",
                      reason: ""
                    });
                  }}
                  className="flex items-center gap-1.5 bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                >
                  <Clock className="w-4 h-4" />
                  Status Persetujuan
                </button>

                {isCurriculumOrAdmin && (
                  <button
                    onClick={() => setShowApplyModal(activeScenario)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors shadow-xs"
                    title="Terapkan seluruh jadwal dan struktur kurikulum ke jadwal operasional SIMAK"
                  >
                    <Sparkles className="w-4 h-4" />
                    Terapkan ke Jadwal Operasional
                  </button>
                )}
              </div>
            </div>

            {/* WORKFLOW & APPROVAL STATUS BANNER */}
            <div className={`mt-4 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              activeScenario.status === "Disetujui"
                ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                : activeScenario.status === "Diterapkan"
                ? "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800"
                : activeScenario.status === "Diajukan"
                ? "bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-800"
                : activeScenario.status === "Perlu Revisi"
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                : activeScenario.status === "Ditolak"
                ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-800"
                : "bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700"
            }`}>
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg mt-0.5 ${
                  activeScenario.status === "Disetujui"
                    ? "bg-emerald-500 text-white"
                    : activeScenario.status === "Diterapkan"
                    ? "bg-purple-600 text-white"
                    : activeScenario.status === "Diajukan"
                    ? "bg-sky-500 text-white"
                    : "bg-slate-400 text-white"
                }`}>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                      Alur Persetujuan & Penerapan: {activeScenario.status}
                    </span>
                    {activeScenario.isPublished && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Dipublikasikan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5 leading-relaxed">
                    {activeScenario.status === "Draft" && "Rancangan masih dalam tahap penyusunan. Klik Ajukan untuk meminta tinjauan Pimpinan."}
                    {activeScenario.status === "Diajukan" && "Rancangan telah diajukan dan sedang menunggu persetujuan Kepala Sekolah / Waka Kurikulum."}
                    {activeScenario.status === "Disetujui" && (
                      <>Disetujui oleh <strong>{activeScenario.approvedByName || "Pimpinan"}</strong> pada {activeScenario.approvedAt ? new Date(activeScenario.approvedAt).toLocaleDateString("id-ID") : "hari ini"}. Siap diterapkan secara massal ke jadwal operasional.</>
                    )}
                    {activeScenario.status === "Diterapkan" && (
                      <>Telah diterapkan massal ke jadwal operasional SIMAK oleh <strong>{activeScenario.appliedByName || "Operator"}</strong> ({activeScenario.appliedSummary?.totalApplied || 0} slot, {activeScenario.appliedSummary?.emptySlots || 0} slot kosong dipertahankan).</>
                    )}
                    {activeScenario.status === "Perlu Revisi" && "Rancangan memerlukan revisi berdasarkan hasil rapat/konsultasi."}
                    {activeScenario.status === "Ditolak" && "Rancangan tidak disetujui untuk digunakan."}
                  </p>
                </div>
              </div>

              {/* Action buttons inside workflow banner */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {activeScenario.status === "Draft" && isCurriculumOrAdmin && (
                  <button
                    onClick={() => {
                      if (!user) return;
                      updateStatusMutation.mutate({
                        scenarioId: activeScenario.id,
                        status: "Diajukan",
                        notes: "Diajukan untuk tinjauan dan persetujuan pimpinan",
                        user: { uid: user.uid, displayName: user.displayName }
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Ajukan Persetujuan
                  </button>
                )}

                {activeScenario.status === "Diajukan" && (isLeadership || isCurriculumOrAdmin) && (
                  <button
                    onClick={() => {
                      if (!user) return;
                      updateStatusMutation.mutate({
                        scenarioId: activeScenario.id,
                        status: "Disetujui",
                        notes: "Disetujui untuk rencana jadwal operasional",
                        user: { uid: user.uid, displayName: user.displayName }
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Setujui Rancangan
                  </button>
                )}

                {(activeScenario.status === "Disetujui" || activeScenario.status === "Diterapkan") && isCurriculumOrAdmin && (
                  <button
                    onClick={() => setShowApplyModal(activeScenario)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Terapkan Massal ke Live
                  </button>
                )}

                {activeScenario.status === "Diterapkan" && !activeScenario.isPublished && isCurriculumOrAdmin && (
                  <button
                    onClick={() => publishMutation.mutate(activeScenario.id)}
                    disabled={publishMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {publishMutation.isPending ? "Mempublikasikan..." : "Publikasikan Jadwal Live"}
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800 mt-6 gap-6">
              <button
                onClick={() => setActiveTab("curriculum")}
                className={`flex items-center gap-2 py-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === "curriculum"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Struktur Kurikulum & JP
              </button>

              <button
                onClick={() => setActiveTab("schedule")}
                className={`flex items-center gap-2 py-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === "schedule"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                }`}
              >
                <Calendar className="w-4 h-4" />
                Jadwal Bayangan
                {activeConflicts.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                    {activeConflicts.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("compare")}
                className={`flex items-center gap-2 py-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === "compare"
                    ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400"
                }`}
              >
                <GitCompare className="w-4 h-4" />
                Perbandingan Sebelum & Sesudah
              </button>
            </div>
          </div>

          {/* TAB CONTENT */}
          {activeTab === "curriculum" && (
            <ScenarioCurriculumEditor
              curriculums={activeCurriculums}
              subjects={activeSubjects}
              teachers={teachers}
              isLoadingTeachers={isLoadingTeachers}
              isErrorTeachers={isErrorTeachers}
              onRetryTeachers={() => refetchTeachers()}
              onUpdateItem={handleUpdateCurriculumItem}
              onToggleActive={handleToggleSubjectActive}
              onAddCustomSubject={handleAddCustomSubject}
              onDeleteZeroJpItems={handleDeleteZeroJp}
              onSyncTeachersToSchedules={handleOpenSyncModal}
              onSyncCurriculumToSchedules={handleOpenSyncModal}
              onRealignFromOperational={handleRealignFromOperational}
              isReadOnly={!isCurriculumOrAdmin}
            />
          )}

          {activeTab === "schedule" && (
            <ScenarioScheduleEditor
              scenarioId={activeScenarioId}
              schedules={activeSchedules}
              curriculums={activeCurriculums}
              classes={classes}
              teachers={teachers}
              isLoadingTeachers={isLoadingTeachers}
              isErrorTeachers={isErrorTeachers}
              onRetryTeachers={() => refetchTeachers()}
              periods={periods}
              conflicts={activeConflicts}
              onSaveSlot={handleSaveSlot}
              onClearSlot={handleClearSlot}
              onClearAllSchedules={handleClearAllSchedules}
              onMoveOrSwapSlot={handleMoveOrSwapSlot}
              onSyncCurriculumToSchedules={handleOpenSyncModal}
              isReadOnly={!isCurriculumOrAdmin}
            />

          )}

          {activeTab === "compare" && (
            <ScenarioComparisonView
              scenario={activeScenario}
              curriculums={activeCurriculums}
              conflicts={activeConflicts}
            />
          )}
        </div>
      )}

      {/* MODAL 1: CREATE SCENARIO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                Buat Rancangan Jadwal Bayangan Baru
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Sistem akan membuat <strong>salinan snapshot terisolasi</strong> dari master kurikulum dan jadwal operasional SIMAK saat ini. Perubahan berikutnya tidak akan memengaruhi jadwal asli.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!user) {
                  showToast("Sesi login Anda tidak valid.", "error");
                  return;
                }
                if (!createForm.name.trim()) {
                  showToast("Nama rancangan jadwal bayangan wajib diisi.", "error");
                  return;
                }
                if (!createForm.academicYearId) {
                  showToast("Tahun ajaran sumber belum dipilih atau data master belum tersedia.", "error");
                  return;
                }
                if (!createForm.semesterId) {
                  showToast("Semester sumber belum dipilih atau data master belum tersedia.", "error");
                  return;
                }
                createMutation.mutate({
                  ...createForm,
                  name: createForm.name.trim(),
                  user: { uid: user.uid, displayName: user.displayName, role: user.role }
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Nama Rancangan
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Simulasi Penambahan JP IPA & Riset"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Deskripsi / Tujuan Perubahan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat maksud dan latar belakang simulasi..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Tahun Ajaran Sumber
                  </label>
                  <select
                    value={createForm.academicYearId}
                    onChange={(e) => {
                      const ay = academicYears.find((y) => y.id === e.target.value);
                      setCreateForm({
                        ...createForm,
                        academicYearId: e.target.value,
                        academicYearName: ay?.year || ""
                      });
                    }}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                  >
                    {academicYears.length === 0 ? (
                      <option value="">Memuat / belum ada tahun ajaran...</option>
                    ) : (
                      academicYears.map((ay) => (
                        <option key={ay.id} value={ay.id}>
                          {ay.year}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Semester Sumber
                  </label>
                  <select
                    value={createForm.semesterId}
                    onChange={(e) => {
                      const sem = semesters.find((s) => s.id === e.target.value);
                      setCreateForm({
                        ...createForm,
                        semesterId: e.target.value,
                        semesterName: sem?.name || ""
                      });
                    }}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                  >
                    {semesters.length === 0 ? (
                      <option value="">Memuat / belum ada semester...</option>
                    ) : (
                      semesters.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Catatan Bahan Konsultasi
                </label>
                <textarea
                  rows={2}
                  placeholder="Poin-poin penting untuk dibahas bersama Kepala Sekolah & Mudir..."
                  value={createForm.consultationNotes}
                  onChange={(e) => setCreateForm({ ...createForm, consultationNotes: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  {createMutation.isPending ? "Mengambil Snapshot & Menyalin..." : "Buat Snapshot Rancangan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DUPLICATE SCENARIO */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Duplikasi Menjadi Alternatif Baru
              </h3>
              <button onClick={() => setShowDuplicateModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Duplikasi akan membuat salinan terpisah (Alternatif B, C, dst.) sehingga Anda dapat mencoba variasi jadwal lain tanpa mengubah rancangan awal.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                Nama Alternatif Baru
              </label>
              <input
                type="text"
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
                className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={duplicateMutation.isPending || !dupName.trim()}
                onClick={() => {
                  if (!user) return;
                  duplicateMutation.mutate({
                    sourceScenarioId: showDuplicateModal.id,
                    newScenarioName: dupName.trim(),
                    user: { uid: user.uid, displayName: user.displayName, role: user.role }
                  });
                }}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
              >
                {duplicateMutation.isPending ? "Menduplikasi..." : "Duplikasi Alternatif"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: STATUS & APPROVAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Status Konsultasi & Persetujuan
              </h3>
              <button onClick={() => setShowStatusModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
              ⚠️ Status <strong>Disetujui</strong> hanya mencatat kesepakatan pimpinan dan <strong>tidak akan</strong> otomatis mengubah database operasional.
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Status Rancangan
                </label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value as any })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white font-semibold"
                >
                  <option value="Draft">Draft (Dalam Penyusunan)</option>
                  <option value="Diajukan">Diajukan (Siap Ditinjau Pimpinan)</option>
                  <option value="Perlu Revisi">Perlu Revisi (Masukan dari Rapat)</option>
                  <option value="Disetujui">Disetujui (Disepakati untuk Rencana)</option>
                  <option value="Ditolak">Ditolak (Tidak Digunakan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Catatan Rapat / Konsultasi
                </label>
                <textarea
                  rows={2}
                  placeholder="Catatan hasil diskusi bersama Kepala Sekolah atau Pimpinan..."
                  value={statusForm.notes}
                  onChange={(e) => setStatusForm({ ...statusForm, notes: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                />
              </div>

              {(statusForm.status === "Perlu Revisi" || statusForm.status === "Ditolak") && (
                <div>
                  <label className="block text-xs font-bold text-rose-700 dark:text-rose-400 uppercase mb-1">
                    Alasan Revisi / Penolakan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Beban JP Guru IPA terlalu tinggi"
                    value={statusForm.reason}
                    onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })}
                    className="w-full text-sm border border-rose-300 dark:border-rose-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={updateStatusMutation.isPending}
                onClick={() => {
                  if (!user) return;
                  updateStatusMutation.mutate({
                    scenarioId: showStatusModal.id,
                    status: statusForm.status,
                    notes: statusForm.notes,
                    reason: statusForm.reason,
                    user: { uid: user.uid, displayName: user.displayName }
                  });
                }}
                className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
              >
                {updateStatusMutation.isPending ? "Menyimpan..." : "Simpan Status"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PRINT MATERIALS */}
      {showPrintModal && activeScenario && (
        <ScenarioPrintModal
          scenario={activeScenario}
          curriculums={activeCurriculums}
          schedules={activeSchedules}
          classes={classes}
          teachers={teachers}
          periods={periods}
          conflicts={activeConflicts}
          subjects={activeSubjects}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* MODAL 5: MASS APPLY LIVE SCHEDULE */}
      {showApplyModal && (
        <ScenarioApplyModal
          scenario={showApplyModal}
          classes={classes}
          isOpen={Boolean(showApplyModal)}
          onClose={() => setShowApplyModal(null)}
          onApplySuccess={(result) => {
            queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
            if (activeScenarioId) {
              queryClient.invalidateQueries({ queryKey: ["scenario", activeScenarioId] });
            }
            queryClient.invalidateQueries({ queryKey: ["schedules"] });
            queryClient.invalidateQueries({ queryKey: ["curriculum_matrix"] });
          }}
          user={user ? { uid: user.uid, displayName: user.displayName, role: user.role } : null}
        />
      )}

      {/* MODAL 6: SYNC CURRICULUM TO SCHEDULE PREVIEW & CONFIRMATION */}
      {showSyncModal && syncPreview && (
        <ScenarioSyncModal
          preview={syncPreview}
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onApply={handleApplySync}
          isApplying={isApplyingSync}
        />
      )}
    </div>
  );
}
