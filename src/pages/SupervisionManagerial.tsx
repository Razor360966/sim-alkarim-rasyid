import React, { useState, useMemo, useEffect } from "react";
import {
  useManagerialSupervisions,
  useSupervisionInstruments,
  useSupervisionResult,
  useSaveSupervisionResult
} from "../hooks/useSupervision";
import { useTeachers } from "../hooks/useTeachers";
import { useAcademicYears } from "../hooks/academicYear.hook";
import { useSemesters } from "../hooks/semester.hook";
import { useAuth } from "../contexts/AuthContext";
import { Dialog } from "../components/Dialog";
import { Loading } from "../components/Loading";
import {
  Shield,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  AlertTriangle,
  UserCheck,
  FileText,
  CheckCircle,
  X,
  PlusCircle,
  ArrowRight,
  Award,
  CheckCircle2,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { ManagerialSupervision, SupervisionStatus, SupervisionInstrument, SupervisionIndicator } from "../types";

export default function SupervisionManagerial() {
  const { user } = useAuth();

  // Access Control Checks
  const userRoles = user?.roles || [user?.role || ""];
  const isAdmin = userRoles.includes("admin");
  const isKepalaSekolah = userRoles.includes("kepala sekolah");
  const isWakilKepalaSekolah = userRoles.includes("wakil kepala sekolah");
  const isKetuaYayasan = userRoles.includes("ketua yayasan");
  const isMusrif = userRoles.includes("musrif") || user?.role === "musrif";

  const canEdit = isAdmin || isKepalaSekolah || isWakilKepalaSekolah;
  const isReadOnly = isKetuaYayasan && !isAdmin && !isKepalaSekolah && !isWakilKepalaSekolah;
  const hasAccess = isAdmin || isKepalaSekolah || isWakilKepalaSekolah || isKetuaYayasan || isMusrif;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterSupervisorId, setFilterSupervisorId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // RTL States
  const [isEditingRtl, setIsEditingRtl] = useState(false);
  const [rtlTextForm, setRtlTextForm] = useState("");
  const [rtlStatusForm, setRtlStatusForm] = useState<"Belum Dilaksanakan" | "Sedang Dilaksanakan" | "Sudah Dilaksanakan">("Belum Dilaksanakan");
  const [rtlNotesForm, setRtlNotesForm] = useState("");

  // Filter query parameters based on role access
  const supervisionsFilter = useMemo(() => {
    const f: any = {
      academicYearId: filterYear || undefined,
      semesterId: filterSem || undefined,
      supervisorId: filterSupervisorId || undefined,
      status: filterStatus || undefined
    };
    const isStrictMusrif = isMusrif && !isAdmin && !isKepalaSekolah && !isWakilKepalaSekolah;
    if (isStrictMusrif) {
      f.staffId = user?.teacherId || "NO_TEACHER_LINK";
    }
    return f;
  }, [isMusrif, isAdmin, isKepalaSekolah, isWakilKepalaSekolah, user, filterYear, filterSem, filterSupervisorId, filterStatus]);

  // Queries
  const {
    supervisions,
    isLoading: isLoadingSupervisions,
    createSupervision,
    isCreating,
    updateSupervision,
    isUpdating,
    deleteSupervision
  } = useManagerialSupervisions(supervisionsFilter);

  const { teachers, isLoading: isLoadingTeachers } = useTeachers();
  const { academicYears, isLoading: isLoadingYears } = useAcademicYears();
  const { semesters, isLoading: isLoadingSemesters } = useSemesters();

  // Load all Managerial instruments
  const { instruments = [] } = useSupervisionInstruments({ type: "Manajerial" });

  // Active elements
  const activeYear = useMemo(() => academicYears.find(y => y.isActive), [academicYears]);
  const activeSemester = useMemo(() => semesters.find(s => s.isActive), [semesters]);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSupervision, setSelectedSupervision] = useState<ManagerialSupervision | null>(null);

  // Assessment Dialog & Form States
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<SupervisionInstrument | null>(null);
  const [scoresMap, setScoresMap] = useState<Record<string, number>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [overallNotes, setOverallNotes] = useState("");

  // Load supervision result for the details or assessment modals
  const [resultTargetId, setResultTargetId] = useState<string>("");
  const { result: detailResult, isLoading: isLoadingDetailResult } = useSupervisionResult(resultTargetId);
  const { saveResult, isSaving: isSavingResult } = useSaveSupervisionResult();

  // Form States for Scheduling
  const [formData, setFormData] = useState({
    teacherId: "",
    supervisorId: "",
    academicYearId: "",
    semesterId: "",
    date: "",
    status: "Belum Dijadwalkan" as SupervisionStatus,
    notes: ""
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Search / Client-side filtering on names
  const filteredSupervisions = useMemo(() => {
    return supervisions.filter(item => {
      const matchSearch =
        item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supervisorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [supervisions, searchQuery]);

  // Stats Card data
  const stats = useMemo(() => {
    return {
      total: supervisions.length,
      completed: supervisions.filter(s => s.status === "Selesai").length,
      scheduled: supervisions.filter(s => s.status === "Terjadwal" || s.status === "Sedang Berlangsung").length,
      pending: supervisions.filter(s => s.status === "Belum Dijadwalkan").length
    };
  }, [supervisions]);

  const resetForm = () => {
    setFormData({
      teacherId: "",
      supervisorId: "",
      academicYearId: activeYear?.id || (academicYears[0]?.id || ""),
      semesterId: activeSemester?.id || (semesters[0]?.id || ""),
      date: new Date().toISOString().split("T")[0],
      status: "Belum Dijadwalkan" as SupervisionStatus,
      notes: ""
    });
    setFormErrors({});
  };

  const handleOpenCreate = () => {
    if (isReadOnly) return;
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (sup: ManagerialSupervision) => {
    if (isReadOnly) return;
    setSelectedSupervision(sup);
    setFormData({
      teacherId: sup.teacherId,
      supervisorId: sup.supervisorId,
      academicYearId: sup.academicYearId,
      semesterId: sup.semesterId,
      date: sup.date || "",
      status: sup.status,
      notes: sup.notes || ""
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  const handleOpenDetail = (sup: ManagerialSupervision) => {
    setSelectedSupervision(sup);
    setRtlTextForm(sup.rtlText || "");
    setRtlStatusForm(sup.rtlStatus || "Belum Dilaksanakan");
    setRtlNotesForm(sup.rtlNotes || "");
    setIsEditingRtl(false);
    setResultTargetId(sup.id); // Load the specific result
    setIsDetailOpen(true);
  };

  const handleSaveRtl = async () => {
    if (!selectedSupervision) return;
    try {
      await updateSupervision({
        id: selectedSupervision.id,
        data: {
          rtlText: rtlTextForm,
          rtlStatus: rtlStatusForm,
          rtlNotes: rtlNotesForm
        }
      });
      setSelectedSupervision(prev => prev ? {
        ...prev,
        rtlText: rtlTextForm,
        rtlStatus: rtlStatusForm,
        rtlNotes: rtlNotesForm
      } : null);
      setIsEditingRtl(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenDelete = (sup: ManagerialSupervision) => {
    if (isReadOnly) return;
    setSelectedSupervision(sup);
    setIsDeleteOpen(true);
  };

  // Open assessment form
  const handleOpenAssessment = (sup: ManagerialSupervision) => {
    setSelectedSupervision(sup);
    setResultTargetId(sup.id); // Trigger loading existing result
    setSelectedInstrument(null);
    setScoresMap({});
    setNotesMap({});
    setOverallNotes("");
    setIsAssessmentOpen(true);
  };

  // Prepopulate if result exists
  useEffect(() => {
    if (isAssessmentOpen && detailResult && selectedSupervision && detailResult.supervisionId === selectedSupervision.id) {
      const inst = instruments.find(i => i.id === detailResult.instrumentId);
      if (inst) {
        setSelectedInstrument(inst);
      }
      const newScores: Record<string, number> = {};
      const newNotes: Record<string, string> = {};
      detailResult.scores.forEach(s => {
        newScores[s.indicatorId] = s.score;
        newNotes[s.indicatorId] = s.notes || "";
      });
      setScoresMap(newScores);
      setNotesMap(newNotes);
      setOverallNotes(detailResult.notes || "");
    }
  }, [detailResult, isAssessmentOpen, selectedSupervision, instruments]);

  // Compute live assessment scores
  const activeIndicators = useMemo(() => {
    if (!selectedInstrument || !selectedInstrument.indicators) return [];
    return selectedInstrument.indicators.filter(ind => ind.isActive);
  }, [selectedInstrument]);

  const calculatedTotalScore = useMemo(() => {
    if (activeIndicators.length === 0) return 0;
    let sumWeighted = 0;
    activeIndicators.forEach(ind => {
      const score = scoresMap[ind.id];
      if (score !== undefined) {
        sumWeighted += (score / ind.maxScore) * ind.weight;
      }
    });
    return sumWeighted;
  }, [activeIndicators, scoresMap]);

  const isAssessmentComplete = useMemo(() => {
    if (activeIndicators.length === 0) return false;
    return activeIndicators.every(ind => scoresMap[ind.id] !== undefined);
  }, [activeIndicators, scoresMap]);

  // Save assessment results
  const handleSaveAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervision || !selectedInstrument || !isAssessmentComplete) return;

    const scoresList = activeIndicators.map(ind => ({
      indicatorId: ind.id,
      indicatorName: ind.name,
      scoringType: ind.scoringType,
      score: scoresMap[ind.id] || 0,
      maxScore: ind.maxScore,
      weight: ind.weight,
      weightedScore: Number(((scoresMap[ind.id] || 0) / ind.maxScore * ind.weight).toFixed(2)),
      notes: notesMap[ind.id] || ""
    }));

    try {
      await saveResult({
        supervisionId: selectedSupervision.id,
        supervisionType: "Manajerial",
        teacherId: selectedSupervision.teacherId,
        teacherName: selectedSupervision.teacherName,
        supervisorId: selectedSupervision.supervisorId,
        supervisorName: selectedSupervision.supervisorName,
        academicYearId: selectedSupervision.academicYearId,
        academicYear: selectedSupervision.academicYear,
        semesterId: selectedSupervision.semesterId,
        semester: selectedSupervision.semester,
        instrumentId: selectedInstrument.id,
        instrumentName: selectedInstrument.name,
        scores: scoresList,
        totalScore: Number(calculatedTotalScore.toFixed(2)),
        notes: overallNotes,
        date: selectedSupervision.date || new Date().toISOString().split("T")[0]
      });
      setIsAssessmentOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.teacherId) errors.teacherId = "SDM yang disupervisi wajib dipilih.";
    if (!formData.supervisorId) errors.supervisorId = "Supervisor wajib dipilih.";
    if (!formData.academicYearId) errors.academicYearId = "Tahun Pelajaran wajib dipilih.";
    if (!formData.semesterId) errors.semesterId = "Semester wajib dipilih.";
    if (!formData.date) errors.date = "Tanggal supervisi wajib dipilih.";
    if (!formData.status) errors.status = "Status wajib dipilih.";

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const teacher = teachers.find(t => t.id === formData.teacherId);
    const supervisor = teachers.find(t => t.id === formData.supervisorId);
    const year = academicYears.find(y => y.id === formData.academicYearId);
    const sem = semesters.find(s => s.id === formData.semesterId);

    try {
      await createSupervision({
        teacherId: formData.teacherId,
        teacherName: teacher?.name || "",
        supervisorId: formData.supervisorId,
        supervisorName: supervisor?.name || "",
        academicYearId: formData.academicYearId,
        academicYear: year?.year || year?.name || "",
        semesterId: formData.semesterId,
        semester: sem?.name || "",
        date: formData.date,
        status: formData.status,
        notes: formData.notes
      });
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupervision) return;
    if (!validateForm()) return;

    const teacher = teachers.find(t => t.id === formData.teacherId);
    const supervisor = teachers.find(t => t.id === formData.supervisorId);
    const year = academicYears.find(y => y.id === formData.academicYearId);
    const sem = semesters.find(s => s.id === formData.semesterId);

    try {
      await updateSupervision({
        id: selectedSupervision.id,
        data: {
          teacherId: formData.teacherId,
          teacherName: teacher?.name || selectedSupervision.teacherName,
          supervisorId: formData.supervisorId,
          supervisorName: supervisor?.name || selectedSupervision.supervisorName,
          academicYearId: formData.academicYearId,
          academicYear: year?.year || year?.name || selectedSupervision.academicYear,
          semesterId: formData.semesterId,
          semester: sem?.name || selectedSupervision.semester,
          date: formData.date,
          status: formData.status,
          notes: formData.notes
        }
      });
      setIsEditOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSupervision) return;
    try {
      await deleteSupervision(selectedSupervision.id);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: SupervisionStatus) => {
    switch (status) {
      case "Selesai":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50">● Selesai</span>;
      case "Terjadwal":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50">● Terjadwal</span>;
      case "Sedang Berlangsung":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50">● Berlangsung</span>;
      case "Belum Dijadwalkan":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">● Belum Dijadwalkan</span>;
      case "Ditunda":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50">● Ditunda</span>;
      default:
        return null;
    }
  };

  const isGlobalLoading = isLoadingSupervisions || isLoadingTeachers || isLoadingYears || isLoadingSemesters;

  if (isGlobalLoading) {
    return <Loading label="Memuat modul supervisi manajerial..." />;
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="h-16 w-16 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center text-rose-600 mb-4 border border-rose-100 dark:border-rose-900/30">
          <Shield className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Akses Ditolak</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 max-w-md leading-relaxed">
          Halaman ini khusus untuk Musrif, Kepala Sekolah, Wakil Kepala Sekolah, dan Yayasan. Akun Anda tidak memiliki hak akses untuk membuka halaman ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Shield className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Supervisi Manajerial
            </h1>
          </div>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">
            Penjadwalan, pemantauan, dan penilaian hasil supervisi manajerial untuk Wakil Kepala Sekolah, Musrif, dan Tenaga Kependidikan.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-md shadow-blue-500/10 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Jadwalkan Supervisi Manajerial
          </button>
        )}
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Kegiatan</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Selesai</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.completed}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 dark:text-amber-400">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Terjadwal/Aktif</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.scheduled}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-600 dark:text-slate-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Belum Dijadwalkan</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari SDM yang disupervisi atau supervisor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Tahun Pelajaran */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua TP</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.year || y.name}</option>
            ))}
          </select>

          {/* Semester */}
          <select
            value={filterSem}
            onChange={(e) => setFilterSem(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Semester</option>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Supervisor */}
          <select
            value={filterSupervisorId}
            onChange={(e) => setFilterSupervisorId(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Supervisor</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Belum Dijadwalkan">Belum Dijadwalkan</option>
            <option value="Terjadwal">Terjadwal</option>
            <option value="Sedang Berlangsung">Sedang Berlangsung</option>
            <option value="Selesai">Selesai</option>
            <option value="Ditunda">Ditunda</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredSupervisions.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-slate-300 dark:text-zinc-700 mb-4 animate-pulse" />
            <h3 className="text-md font-bold text-slate-800 dark:text-zinc-200">Belum ada data supervisi manajerial</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Silakan jadwalkan atau tambahkan supervisi manajerial menggunakan tombol di kanan atas.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">SDM Disupervisi</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Supervisor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tahun / Smt</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Skor Akhir</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {filteredSupervisions.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-zinc-100 text-sm">{item.teacherName}</div>
                      <div className="text-[10px] text-slate-400 font-medium">ID: {item.teacherId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 dark:text-zinc-300 font-medium">{item.supervisorName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 dark:text-zinc-300 font-semibold">{item.academicYear}</div>
                      <div className="text-[10px] text-blue-500 font-bold">{item.semester}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                        {item.date ? new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {item.status === "Selesai" ? (
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                            item.score && item.score >= 85
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.score && item.score >= 70
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {item.score !== undefined ? Number(item.score).toFixed(1) : "-"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum dinilai</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 rounded-lg transition"
                          title="Lihat Rincian & Lembar Nilai"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {canEdit && (
                          <button
                            onClick={() => handleOpenAssessment(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold cursor-pointer transition shadow-sm"
                            title="Lakukan Penilaian / Scoring"
                          >
                            <Award className="h-3.5 w-3.5" />
                            <span>Penilaian</span>
                          </button>
                        )}

                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 rounded-lg transition"
                              title="Ubah Jadwal"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(item)}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 rounded-lg transition"
                              title="Hapus"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Jadwalkan Supervisi Manajerial" size="lg">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">SDM yang Disupervisi *</label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Pilih SDM...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({(t as any).role || "Staf"})</option>
                ))}
              </select>
              {formErrors.teacherId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.teacherId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Supervisor Penilai *</label>
              <select
                value={formData.supervisorId}
                onChange={(e) => setFormData(prev => ({ ...prev, supervisorId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Pilih Supervisor...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {formErrors.supervisorId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.supervisorId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tahun Pelajaran *</label>
              <select
                value={formData.academicYearId}
                onChange={(e) => setFormData(prev => ({ ...prev, academicYearId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.year || y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Semester *</label>
              <select
                value={formData.semesterId}
                onChange={(e) => setFormData(prev => ({ ...prev, semesterId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Rencana Observasi *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {formErrors.date && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status Penjadwalan *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as SupervisionStatus }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Belum Dijadwalkan">Belum Dijadwalkan</option>
                <option value="Terjadwal">Terjadwal</option>
                <option value="Sedang Berlangsung">Sedang Berlangsung</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditunda">Ditunda</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Tambahan</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Berikan rincian unit kerja, target capaian, atau catatan pra-observasi..."
              className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {isCreating ? "Menyimpan..." : "Simpan Jadwal"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Ubah Penjadwalan Supervisi" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">SDM yang Disupervisi *</label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Pilih SDM...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({(t as any).role || "Staf"})</option>
                ))}
              </select>
              {formErrors.teacherId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.teacherId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Supervisor Penilai *</label>
              <select
                value={formData.supervisorId}
                onChange={(e) => setFormData(prev => ({ ...prev, supervisorId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Pilih Supervisor...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {formErrors.supervisorId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.supervisorId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tahun Pelajaran *</label>
              <select
                value={formData.academicYearId}
                onChange={(e) => setFormData(prev => ({ ...prev, academicYearId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>{y.year || y.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Semester *</label>
              <select
                value={formData.semesterId}
                onChange={(e) => setFormData(prev => ({ ...prev, semesterId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                {semesters.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Supervisi *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {formErrors.date && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status *</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as SupervisionStatus }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Belum Dijadwalkan">Belum Dijadwalkan</option>
                <option value="Terjadwal">Terjadwal</option>
                <option value="Sedang Berlangsung">Sedang Berlangsung</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditunda">Ditunda</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Hasil Observasi</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Berikan catatan kualitatif hasil observasi kinerja..."
              className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {isUpdating ? "Memproses..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* ASSESSMENT INPUT FORM DIALOG (SUPERVISI MANAJERIAL) */}
      <Dialog
        isOpen={isAssessmentOpen}
        onClose={() => setIsAssessmentOpen(false)}
        title={`Lembar Penilaian Kinerja Manajerial - ${selectedSupervision?.teacherName}`}
        size="lg"
      >
        <form onSubmit={handleSaveAssessment} className="space-y-4">
          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-150 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold text-blue-800 dark:text-blue-200">Panduan Supervisor:</p>
            <p>Pilih instrumen di bawah ini, lalu lakukan penilaian untuk setiap indikator yang tercantum. Nilai akhir dihitung secara otomatis berdasarkan bobot tiap indikator.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pilih Master Instrumen Penilaian *</label>
            <select
              value={selectedInstrument?.id || ""}
              onChange={(e) => {
                const inst = instruments.find(i => i.id === e.target.value);
                setSelectedInstrument(inst || null);
                // Reset answers map
                setScoresMap({});
                setNotesMap({});
              }}
              className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
            >
              <option value="">-- Pilih Instrumen Standar --</option>
              {instruments.filter(i => i.isActive).map(i => (
                <option key={i.id} value={i.id}>{i.code} - {i.name}</option>
              ))}
            </select>
          </div>

          {selectedInstrument && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-800">
                <span className="text-xs text-slate-500 font-bold">PROGRES PENILAIAN:</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${isAssessmentComplete ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {isAssessmentComplete ? "Lengkap (Siap Simpan)" : "Belum Lengkap"}
                  </span>
                  <span className="text-sm font-mono font-extrabold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-200">
                    Skor: {calculatedTotalScore.toFixed(1)} / 100
                  </span>
                </div>
              </div>

              {/* INDIKATOR SCORING LIST */}
              <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                {activeIndicators.map((ind, idx) => (
                  <div key={ind.id || idx} className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                            {idx + 1}. {ind.name}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-600 border border-blue-100">
                            Bobot: {ind.weight}%
                          </span>
                        </div>
                        {ind.description && (
                          <p className="text-[11px] text-slate-400 font-semibold leading-normal">
                            {ind.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-dashed border-slate-100">
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">SKOR PENILAIAN *</span>
                      
                      {/* Interactive score selection buttons */}
                      {ind.scoringType === "yes-no" ? (
                        <div className="flex gap-2">
                          {[
                            { label: "Ya (100%)", value: 1 },
                            { label: "Tidak (0%)", value: 0 }
                          ].map(opt => (
                            <button
                              type="button"
                              key={opt.value}
                              onClick={() => setScoresMap(prev => ({ ...prev, [ind.id]: opt.value }))}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                scoresMap[ind.id] === opt.value
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : ind.scoringType === "percentage" ? (
                        <div className="flex items-center gap-3 w-full sm:w-1/2">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={scoresMap[ind.id] || 0}
                            onChange={(e) => setScoresMap(prev => ({ ...prev, [ind.id]: Number(e.target.value) }))}
                            className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-150 rounded-lg appearance-none"
                          />
                          <span className="w-12 text-center font-mono font-bold text-xs bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-700">
                            {scoresMap[ind.id] || 0}%
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          {Array.from({ length: ind.maxScore }, (_, i) => i + 1).map(val => (
                            <button
                              type="button"
                              key={val}
                              onClick={() => setScoresMap(prev => ({ ...prev, [ind.id]: val }))}
                              className={`h-8 w-8 rounded-full text-xs font-bold flex items-center justify-center transition cursor-pointer border ${
                                scoresMap[ind.id] === val
                                  ? "bg-blue-600 text-white border-blue-600"
                                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                              }`}
                            >
                              {val}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Catatan sub-indikator */}
                    <div>
                      <input
                        type="text"
                        placeholder="Catatan khusus atau temuan indikator ini..."
                        value={notesMap[ind.id] || ""}
                        onChange={(e) => setNotesMap(prev => ({ ...prev, [ind.id]: e.target.value }))}
                        className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950 text-[11px] focus:ring-1 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* OVERALL NOTES */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500">Rencana Tindak Lanjut (RTL) / Rekomendasi Umum</label>
                <textarea
                  value={overallNotes}
                  onChange={(e) => setOverallNotes(e.target.value)}
                  placeholder="Berikan arahan perbaikan, apresiasi, atau kesepakatan tindak lanjut..."
                  rows={2.5}
                  className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsAssessmentOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isSavingResult || !selectedInstrument || !isAssessmentComplete}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold disabled:cursor-not-allowed cursor-pointer transition shadow-sm"
            >
              {isSavingResult ? "Menyimpan..." : "Simpan Hasil Penilaian"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* DETAIL MODAL */}
      <Dialog isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detail Kegiatan & Hasil Supervisi Manajerial" size="lg">
        {selectedSupervision && (
          <div className="space-y-5">
            <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SDM DISUPERVISI</span>
                  <span className="text-base font-bold text-slate-800 dark:text-zinc-100">{selectedSupervision.teacherName}</span>
                </div>
                {getStatusBadge(selectedSupervision.status)}
              </div>

              <hr className="border-slate-200 dark:border-zinc-800" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SUPERVISOR</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedSupervision.supervisorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TANGGAL SUPERVISI</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    {selectedSupervision.date ? new Date(selectedSupervision.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TAHUN PELAJARAN</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedSupervision.academicYear}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SEMESTER</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedSupervision.semester}</span>
                </div>
              </div>
            </div>

            {/* DETAILED SCORECARD FROM FIREBASE RESULT */}
            {selectedSupervision.status === "Selesai" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hasil Penilaian Detil ({selectedSupervision.instrumentName})</h4>
                  <span className="text-sm font-mono font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                    Skor Akhir: {selectedSupervision.score !== undefined ? Number(selectedSupervision.score).toFixed(1) : "-"} / 100
                  </span>
                </div>

                {isLoadingDetailResult ? (
                  <Loading label="Memuat lembar penilaian..." />
                ) : detailResult ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {detailResult.scores.map((s, idx) => {
                      const pct = (s.score / s.maxScore) * 100;
                      return (
                        <div key={idx} className="p-3 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl flex flex-col md:flex-row justify-between gap-3 shadow-2xs">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{idx + 1}. {s.indicatorName}</span>
                            {s.notes && <p className="text-[11px] text-slate-400 italic font-semibold">Temuan: {s.notes}</p>}
                          </div>
                          <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                            {/* mini progress bar */}
                            <div className="w-24 bg-slate-100 rounded-full h-1.5 dark:bg-zinc-800">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-zinc-300">
                              {s.score} / {s.maxScore} ({pct.toFixed(0)}%)
                            </span>
                            <span className="text-xs font-semibold text-slate-400 shrink-0">
                              Sumbangan: {((s.score / s.maxScore) * s.weight).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">Rincian indikator tidak ditemukan pada server.</p>
                )}
              </div>
            )}

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">CATATAN & REKOMENDASI OBSERVASI KINERJA</span>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap min-h-[100px]">
                {selectedSupervision.notes || "Tidak ada catatan."}
              </div>
            </div>

            {selectedSupervision.status === "Selesai" && (
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">RENCANA TINDAK LANJUT (RTL)</span>
                  {!isEditingRtl && (canEdit || isMusrif) && (
                    <button
                      onClick={() => setIsEditingRtl(true)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 rounded-lg transition cursor-pointer"
                    >
                      Kelola RTL
                    </button>
                  )}
                </div>

                {isEditingRtl ? (
                  <div className="space-y-3 bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rencana Tindak Lanjut *</label>
                      <textarea
                        value={rtlTextForm}
                        onChange={(e) => setRtlTextForm(e.target.value)}
                        placeholder="Tuliskan rencana aksi perbaikan, target penyelesaian, dll..."
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-white"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status Pelaksanaan RTL</label>
                        <select
                          value={rtlStatusForm}
                          onChange={(e) => setRtlStatusForm(e.target.value as any)}
                          className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-blue-500/20 cursor-pointer text-slate-800 dark:text-white"
                        >
                          <option value="Belum Dilaksanakan">Belum Dilaksanakan</option>
                          <option value="Sedang Dilaksanakan">Sedang Dilaksanakan</option>
                          <option value="Sudah Dilaksanakan">Sudah Dilaksanakan</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Catatan Pelaksanaan RTL</label>
                        <textarea
                          value={rtlNotesForm}
                          onChange={(e) => setRtlNotesForm(e.target.value)}
                          placeholder="Hasil pelaksanaan RTL, kendala, atau pencapaian..."
                          rows={1}
                          className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setIsEditingRtl(false)}
                        className="px-3 py-1.5 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRtl}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        Simpan RTL
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">PROGRAM RTL</span>
                        <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed font-semibold">
                          {selectedSupervision.rtlText || "Belum ada rencana tindak lanjut."}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">CATATAN PELAKSANAAN RTL</span>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed italic">
                          {selectedSupervision.rtlNotes || "Belum ada catatan pelaksanaan RTL."}
                        </p>
                      </div>
                    </div>
                    <div className="border-l border-slate-200 dark:border-zinc-800 pl-4 space-y-2">
                      <span className="text-[10px] text-slate-400 font-bold block">STATUS PELAKSANAAN</span>
                      <div className="pt-1">
                        {selectedSupervision.rtlStatus === "Sudah Dilaksanakan" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ● Sudah Dilaksanakan
                          </span>
                        ) : selectedSupervision.rtlStatus === "Sedang Dilaksanakan" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            ● Sedang Dilaksanakan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            ● Belum Dilaksanakan
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Hapus Kegiatan Supervisi" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-250 dark:border-rose-900/50">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <p className="text-xs font-semibold">
              Apakah Anda yakin ingin menghapus jadwal supervisi untuk staf <strong>{selectedSupervision?.teacherName}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Hapus Permanen
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
