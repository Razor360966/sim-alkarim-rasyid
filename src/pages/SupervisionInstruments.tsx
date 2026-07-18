import React, { useState, useMemo } from "react";
import { useSupervisionInstruments } from "../hooks/useSupervision";
import { useAuth } from "../contexts/AuthContext";
import { Dialog } from "../components/Dialog";
import { Loading } from "../components/Loading";
import {
  FileCheck,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  FileText,
  ListPlus,
  Trash,
  PlusCircle,
  Award,
  ChevronRight,
  BookOpen,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  Copy
} from "lucide-react";
import { SupervisionInstrument, SupervisionIndicator, SupervisionType } from "../types";
import { supervisionService } from "../services/supervision.service";

export default function SupervisionInstruments() {
  const { user } = useAuth();

  // Access Control Checks
  const userRoles = user?.roles || [user?.role || ""];
  const isAdmin = userRoles.includes("admin");
  const isKepalaSekolah = userRoles.includes("kepala sekolah");
  const isWakilKepalaSekolah = userRoles.includes("wakil kepala sekolah");
  const isKetuaYayasan = userRoles.includes("ketua yayasan");

  const canEdit = isAdmin || isKepalaSekolah || isWakilKepalaSekolah;
  const isReadOnly = isKetuaYayasan && !isAdmin && !isKepalaSekolah && !isWakilKepalaSekolah;

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");

  // Queries
  const {
    instruments,
    isLoading: isLoadingInstruments,
    createInstrument,
    isCreating,
    updateInstrument,
    isUpdating,
    deleteInstrument
  } = useSupervisionInstruments({
    type: (filterType as SupervisionType) || undefined
  });

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<SupervisionInstrument | null>(null);
  const [isUsedInSupervision, setIsUsedInSupervision] = useState(false);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);

  // Form States
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "Akademik" as SupervisionType,
    targetSdmType: "Guru" as "Guru" | "Wakil Kepala Sekolah" | "Guru Halaqoh" | "Tenaga Kependidikan",
    description: "",
    category: "",
    academicYear: "2025/2026",
    version: "1.0",
    rubricType: "1-4" as "1-4" | "1-5" | "percentage" | "yes-no" | "custom",
    rubricLevels: [
      { score: 1, label: "Belum Terlihat" },
      { score: 2, label: "Mulai Berkembang" },
      { score: 3, label: "Sudah Berjalan" },
      { score: 4, label: "Sangat Inspiratif" }
    ] as { score: number; label: string; }[]
  });
  const [indicators, setIndicators] = useState<SupervisionIndicator[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Indicator Editor Sub-modal State
  const [isIndicatorOpen, setIsIndicatorOpen] = useState(false);
  const [editingIndicatorIndex, setEditingIndicatorIndex] = useState<number | null>(null);
  const [indicatorFormData, setIndicatorFormData] = useState({
    name: "",
    description: "",
    weight: 20,
    scoringType: "1-5" as "1-4" | "1-5" | "percentage" | "yes-no",
    maxScore: 5,
    isActive: true,
    focus: ""
  });
  const [indicatorErrors, setIndicatorErrors] = useState<Record<string, string>>({});

  // Search filter
  const filteredInstruments = useMemo(() => {
    return instruments.filter(item => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [instruments, searchQuery]);

  // Calculate total weight of active indicators
  const totalWeight = useMemo(() => {
    return indicators.reduce((sum, ind) => sum + (ind.isActive ? ind.weight : 0), 0);
  }, [indicators]);

  const isWeight100 = totalWeight === 100;

  // Reset form helper
  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      type: "Akademik",
      targetSdmType: "Guru",
      description: "",
      category: "Perencanaan Pembelajaran",
      academicYear: "2025/2026",
      version: "1.0",
      rubricType: "1-4",
      rubricLevels: [
        { score: 1, label: "Belum Terlihat" },
        { score: 2, label: "Mulai Berkembang" },
        { score: 3, label: "Sudah Berjalan" },
        { score: 4, label: "Sangat Inspiratif" }
      ]
    });
    setIndicators([
      { id: "ind_1", name: "Kesesuaian Rencana dengan Kurikulum", description: "RPP/Modul ajar sesuai standar kompetensi", weight: 40, scoringType: "1-5", maxScore: 5, isActive: true, focus: "Aspek Kurikulum", order: 1 },
      { id: "ind_2", name: "Pengorganisasian Materi Belajar", description: "Struktur materi sistematis", weight: 30, scoringType: "1-4", maxScore: 4, isActive: true, focus: "Materi Ajar", order: 2 },
      { id: "ind_3", name: "Skenario Pembelajaran", description: "Langkah pembelajaran runtut", weight: 30, scoringType: "yes-no", maxScore: 1, isActive: true, focus: "Langkah KBM", order: 3 }
    ]);
    setFormErrors({});
  };

  const handleOpenCreate = () => {
    if (isReadOnly) return;
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (inst: SupervisionInstrument) => {
    if (isReadOnly) return;
    setSelectedInstrument(inst);
    setFormData({
      code: inst.code,
      name: inst.name,
      type: inst.type,
      targetSdmType: inst.targetSdmType || "Guru",
      description: inst.description || "",
      category: inst.category || "",
      academicYear: inst.academicYear || "2025/2026",
      version: inst.version || "1.0",
      rubricType: inst.rubricType || (inst.type === "Akademik" ? "1-4" : "1-5"),
      rubricLevels: inst.rubricLevels || (inst.type === "Akademik" ? [
        { score: 1, label: "Belum Terlihat" },
        { score: 2, label: "Mulai Berkembang" },
        { score: 3, label: "Sudah Berjalan" },
        { score: 4, label: "Sangat Inspiratif" }
      ] : [
        { score: 1, label: "Sangat Kurang" },
        { score: 2, label: "Kurang" },
        { score: 3, label: "Cukup" },
        { score: 4, label: "Baik" },
        { score: 5, label: "Sangat Baik" }
      ])
    });
    setIndicators(inst.indicators || []);
    setFormErrors({});
    setIsEditOpen(true);
  };

  const handleOpenDetail = (inst: SupervisionInstrument) => {
    setSelectedInstrument(inst);
    setIsDetailOpen(true);
  };

  const handleOpenDelete = async (inst: SupervisionInstrument) => {
    if (isReadOnly) return;
    setSelectedInstrument(inst);
    setIsCheckingUsage(true);
    try {
      const isUsed = await supervisionService.isInstrumentUsed(inst.id);
      setIsUsedInSupervision(isUsed);
    } catch (err) {
      console.error(err);
      setIsUsedInSupervision(false);
    } finally {
      setIsCheckingUsage(false);
      setIsDeleteOpen(true);
    }
  };

  // Toggle active helper
  const handleToggleActive = async (inst: SupervisionInstrument) => {
    if (isReadOnly) return;
    try {
      await updateInstrument({
        id: inst.id,
        data: {
          isActive: !inst.isActive
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Duplication helper
  const handleDuplicate = async (inst: SupervisionInstrument) => {
    if (isReadOnly) return;
    try {
      const nextVersion = inst.version ? (parseFloat(inst.version) + 1.0).toFixed(1) : "2.0";
      await createInstrument({
        code: `${inst.code}-REV`,
        name: `${inst.name} (Revisi v${nextVersion})`,
        type: inst.type,
        targetSdmType: inst.targetSdmType || "Guru",
        description: `Salinan revisi dari ${inst.name} (asli v${inst.version || "1.0"})`,
        category: inst.category || "",
        academicYear: inst.academicYear || "2025/2026",
        version: nextVersion,
        rubricType: inst.rubricType || (inst.type === "Akademik" ? "1-4" : "1-5"),
        rubricLevels: inst.rubricLevels || (inst.type === "Akademik" ? [
          { score: 1, label: "Belum Terlihat" },
          { score: 2, label: "Mulai Berkembang" },
          { score: 3, label: "Sudah Berjalan" },
          { score: 4, label: "Sangat Inspiratif" }
        ] : [
          { score: 1, label: "Sangat Kurang" },
          { score: 2, label: "Kurang" },
          { score: 3, label: "Cukup" },
          { score: 4, label: "Baik" },
          { score: 5, label: "Sangat Baik" }
        ]),
        indicators: inst.indicators || [],
        aspects: inst.aspects || [],
        isActive: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Rubric Level Helper Functions
  const handleRubricTypeChange = (type: "1-4" | "1-5" | "percentage" | "yes-no" | "custom") => {
    let levels: { score: number; label: string; }[] = [];
    if (type === "1-4") {
      levels = [
        { score: 1, label: "Belum Terlihat" },
        { score: 2, label: "Mulai Berkembang" },
        { score: 3, label: "Sudah Berjalan" },
        { score: 4, label: "Sangat Inspiratif" }
      ];
    } else if (type === "1-5") {
      levels = [
        { score: 1, label: "Sangat Kurang" },
        { score: 2, label: "Kurang" },
        { score: 3, label: "Cukup" },
        { score: 4, label: "Baik" },
        { score: 5, label: "Sangat Baik" }
      ];
    } else if (type === "yes-no") {
      levels = [
        { score: 0, label: "Tidak" },
        { score: 1, label: "Ya" }
      ];
    } else if (type === "percentage") {
      levels = [
        { score: 0, label: "Persentase Pencapaian" }
      ];
    } else {
      levels = [
        { score: 1, label: "Level Baru" }
      ];
    }
    setFormData(prev => ({
      ...prev,
      rubricType: type,
      rubricLevels: levels
    }));
  };

  const handleEditRubricLevel = (index: number, newLabel: string) => {
    setFormData(prev => {
      const newLevels = [...prev.rubricLevels];
      newLevels[index] = { ...newLevels[index], label: newLabel };
      return { ...prev, rubricLevels: newLevels };
    });
  };

  const handleAddCustomLevel = () => {
    setFormData(prev => {
      const nextScore = prev.rubricLevels.length > 0 ? Math.max(...prev.rubricLevels.map(l => l.score)) + 1 : 1;
      return {
        ...prev,
        rubricLevels: [...prev.rubricLevels, { score: nextScore, label: `Level ${nextScore}` }]
      };
    });
  };

  const handleRemoveCustomLevel = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rubricLevels: prev.rubricLevels.filter((_, idx) => idx !== index)
    }));
  };

  // Reordering indicators
  const moveIndicator = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= indicators.length) return;

    const newIndicators = [...indicators];
    const temp = newIndicators[index];
    newIndicators[index] = newIndicators[targetIndex];
    newIndicators[targetIndex] = temp;
    setIndicators(newIndicators);
  };

  // Open sub-modal to add an indicator
  const handleOpenAddIndicator = () => {
    setEditingIndicatorIndex(null);
    setIndicatorFormData({
      name: "",
      description: "",
      weight: 20,
      scoringType: "1-5",
      maxScore: 5,
      isActive: true
    });
    setIndicatorErrors({});
    setIsIndicatorOpen(true);
  };

  // Open sub-modal to edit an indicator
  const handleOpenEditIndicator = (index: number) => {
    setEditingIndicatorIndex(index);
    const ind = indicators[index];
    setIndicatorFormData({
      name: ind.name,
      description: ind.description || "",
      weight: ind.weight,
      scoringType: ind.scoringType,
      maxScore: ind.maxScore,
      isActive: ind.isActive
    });
    setIndicatorErrors({});
    setIsIndicatorOpen(true);
  };

  // Remove an indicator
  const handleRemoveIndicator = (index: number) => {
    setIndicators(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save/Update Indicator to current template indicators array
  const handleSaveIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!indicatorFormData.name.trim()) errors.name = "Nama Indikator wajib diisi.";
    if (indicatorFormData.weight <= 0 || indicatorFormData.weight > 100) errors.weight = "Bobot harus di antara 1% - 100%.";

    if (Object.keys(errors).length > 0) {
      setIndicatorErrors(errors);
      return;
    }

    // Determine max score based on scoring type
    let derivedMaxScore = 5;
    if (indicatorFormData.scoringType === "1-4") derivedMaxScore = 4;
    else if (indicatorFormData.scoringType === "1-5") derivedMaxScore = 5;
    else if (indicatorFormData.scoringType === "percentage") derivedMaxScore = 100;
    else if (indicatorFormData.scoringType === "yes-no") derivedMaxScore = 1;

    const savedIndicator: SupervisionIndicator = {
      id: editingIndicatorIndex !== null ? indicators[editingIndicatorIndex].id : "ind_" + Date.now(),
      name: indicatorFormData.name.trim(),
      description: indicatorFormData.description.trim(),
      weight: Number(indicatorFormData.weight),
      scoringType: indicatorFormData.scoringType,
      maxScore: derivedMaxScore,
      isActive: indicatorFormData.isActive,
      focus: indicatorFormData.focus.trim() || undefined,
      order: editingIndicatorIndex !== null ? (indicators[editingIndicatorIndex].order || editingIndicatorIndex + 1) : indicators.length + 1
    };

    if (editingIndicatorIndex !== null) {
      setIndicators(prev => {
        const next = [...prev];
        next[editingIndicatorIndex] = savedIndicator;
        return next;
      });
    } else {
      setIndicators(prev => [...prev, savedIndicator]);
    }

    setIsIndicatorOpen(false);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) errors.code = "Kode instrumen wajib diisi.";
    if (!formData.name.trim()) errors.name = "Nama instrumen wajib diisi.";
    if (formData.type === "Manajerial" && !formData.targetSdmType) {
      errors.targetSdmType = "Target SDM untuk supervisi manajerial wajib dipilih.";
    }
    if (indicators.length === 0) {
      errors.indicators = "Minimal wajib memiliki 1 indikator penilaian.";
    } else if (!isWeight100) {
      errors.indicators = `Total bobot indikator aktif harus tepat 100%. Sekarang: ${totalWeight}%.`;
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createInstrument({
        code: formData.code.trim(),
        name: formData.name.trim(),
        type: formData.type,
        targetSdmType: formData.type === "Akademik" ? "Guru" : formData.targetSdmType,
        description: formData.description.trim(),
        category: formData.category.trim() || (formData.type === "Akademik" ? "Perencanaan Pembelajaran" : "Manajerial"),
        indicators: indicators.map((ind, idx) => ({ ...ind, order: idx + 1 })),
        aspects: indicators.map(ind => ind.name), // keep aspects in sync for backward compatibility
        isActive: true,
        academicYear: formData.academicYear.trim(),
        version: formData.version.trim() || "1.0",
        rubricType: formData.rubricType,
        rubricLevels: formData.rubricLevels
      });
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstrument) return;
    if (!validateForm()) return;

    try {
      await updateInstrument({
        id: selectedInstrument.id,
        data: {
          code: formData.code.trim(),
          name: formData.name.trim(),
          type: formData.type,
          targetSdmType: formData.type === "Akademik" ? "Guru" : formData.targetSdmType,
          description: formData.description.trim(),
          category: formData.category.trim(),
          indicators: indicators.map((ind, idx) => ({ ...ind, order: idx + 1 })),
          aspects: indicators.map(ind => ind.name), // keep aspects in sync for backward compatibility
          academicYear: formData.academicYear.trim(),
          version: formData.version.trim() || "1.0",
          rubricType: formData.rubricType,
          rubricLevels: formData.rubricLevels
        }
      });
      setIsEditOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedInstrument) return;
    try {
      await deleteInstrument(selectedInstrument.id);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoadingInstruments) {
    return <Loading label="Memuat master instrumen..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <FileCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Instrumen Supervisi
            </h1>
          </div>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">
            Konfigurasi template instrumen penilaian, rincian indikator, jenis skor, dan pembobotan persentase.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-md shadow-blue-500/10 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Master Instrumen
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan kode atau nama instrumen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
          />
        </div>
        <div className="sm:w-48">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Jenis</option>
            <option value="Akademik">Akademik (Guru)</option>
            <option value="Manajerial">Manajerial</option>
          </select>
        </div>
      </div>

      {/* Main List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredInstruments.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-12 text-center">
            <FileCheck className="h-12 w-12 mx-auto text-slate-300 dark:text-zinc-700 mb-4 animate-pulse" />
            <h3 className="text-md font-bold text-slate-800 dark:text-zinc-200">Belum ada instrumen supervisi</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Silakan tambahkan master instrumen baru dengan menekan tombol Tambah Master Instrumen di kanan atas.
            </p>
          </div>
        ) : (
          filteredInstruments.map((item) => {
            const instIndicators = item.indicators || [];
            const instTotalWeight = instIndicators.reduce((sum, ind) => sum + (ind.isActive ? ind.weight : 0), 0);
            const isInstValid = instTotalWeight === 100;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:border-blue-500/30 transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex px-2 py-0.5 rounded-sm text-[9px] font-bold tracking-wide uppercase bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          {item.code}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-150 dark:bg-zinc-850 dark:text-zinc-300">
                          v{item.version || "1.0"}
                        </span>
                        <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-150 dark:bg-zinc-850 dark:text-zinc-300">
                          {item.academicYear || "2025/2026"}
                        </span>
                        {item.targetSdmType && (
                          <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300">
                            Untuk: {item.targetSdmType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50 mt-1.5">
                        {item.name}
                      </h3>
                    </div>

                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold shrink-0 ${
                      item.type === "Akademik"
                        ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                        : "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-300"
                    }`}>
                      {item.type}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {item.description || "Tidak ada rincian deskripsi."}
                  </p>

                  {/* Indicator Summary Info */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      <ListPlus className="h-4 w-4 text-blue-500" />
                      <span>{instIndicators.length} Indikator Penilaian</span>
                    </div>

                    {isInstValid ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="h-3 w-3" /> Bobot 100% (Siap)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="Bobot belum mencapai 100%, tidak dapat digunakan">
                        <AlertTriangle className="h-3 w-3" /> Bobot {instTotalWeight}% (Peringatan)
                      </span>
                    )}
                  </div>

                  {/* Indicator bullet preview */}
                  <div className="mt-3 space-y-1 bg-slate-50/50 dark:bg-zinc-950/40 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                    {instIndicators.slice(0, 3).map((ind, idx) => (
                      <div key={ind.id || idx} className="flex items-center justify-between gap-3 text-[11px] text-slate-600 dark:text-zinc-400">
                        <div className="flex items-center gap-1.5 truncate">
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium">{ind.name}</span>
                        </div>
                        <span className="font-mono text-[10px] shrink-0 font-bold bg-slate-200/50 dark:bg-zinc-800 px-1 py-0.2 rounded text-slate-500">
                          {ind.weight}% ({ind.scoringType})
                        </span>
                      </div>
                    ))}
                    {instIndicators.length > 3 && (
                      <div className="text-[10px] text-blue-500 font-semibold pl-4 pt-1">
                        + {instIndicators.length - 3} indikator lainnya
                      </div>
                    )}
                    {instIndicators.length === 0 && (
                      <div className="text-[11px] text-slate-400 text-center py-1 font-medium italic">
                        Belum ada indikator yang dibuat
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800/60">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    disabled={isReadOnly}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer ${
                      item.isActive
                        ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    }`}
                    title={item.isActive ? "Status Aktif - Klik untuk Nonaktifkan" : "Status Nonaktif - Klik untuk Aktifkan"}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? "bg-emerald-600 animate-pulse" : "bg-slate-400"}`} />
                    {item.isActive ? "Aktif" : "Nonaktif"}
                  </button>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenDetail(item)}
                      className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 rounded-lg transition"
                      title="Lihat Detail"
                    >
                      <Eye className="h-4.5 w-4.5" />
                    </button>

                    {canEdit && (
                      <>
                        <button
                          onClick={() => handleDuplicate(item)}
                          className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 rounded-lg transition"
                          title="Duplikasi Template"
                        >
                          <Copy className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 rounded-lg transition"
                          title="Edit Master"
                        >
                          <Edit2 className="h-4.5 w-4.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(item)}
                          className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 rounded-lg transition"
                          title="Hapus Master"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE / EDIT MASTER INSTRUMEN DIALOG */}
      <Dialog
        isOpen={isCreateOpen || isEditOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setIsEditOpen(false);
        }}
        title={isCreateOpen ? "Tambah Master Instrumen Supervisi" : "Ubah Master Instrumen Supervisi"}
        size="lg"
      >
        <form onSubmit={isCreateOpen ? handleCreateSubmit : handleEditSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Kode Instrumen *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Misal: INST-AK-01"
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {formErrors.code && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.code}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Instrumen Penilaian *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Misal: Perencanaan Pembelajaran"
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {formErrors.name && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Supervisi *</label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const val = e.target.value as SupervisionType;
                  setFormData(prev => ({
                    ...prev,
                    type: val,
                    targetSdmType: val === "Akademik" ? "Guru" : "Wakil Kepala Sekolah"
                  }));
                }}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="Akademik">Akademik</option>
                <option value="Manajerial">Manajerial</option>
              </select>
            </div>

            {formData.type === "Manajerial" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Target SDM (Manajerial) *</label>
                <select
                  value={formData.targetSdmType}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetSdmType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="Wakil Kepala Sekolah">Wakil Kepala Sekolah</option>
                  <option value="Guru Halaqoh">Guru Halaqoh</option>
                  <option value="Tenaga Kependidikan">Tenaga Kependidikan</option>
                </select>
                {formErrors.targetSdmType && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.targetSdmType}</p>}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Kategori Akademik</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="Misal: Perencanaan Pembelajaran"
                  className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Deskripsi Ringkas</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Rincian perihal instrumen..."
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          {/* DYNAMIC SYSTEM CONFIGURATION SECTION */}
          <div className="bg-slate-100/50 dark:bg-zinc-950/30 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wide">Konfigurasi & Rubrik Penilaian</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tahun Berlaku *</label>
                <input
                  type="text"
                  value={formData.academicYear}
                  onChange={(e) => setFormData(prev => ({ ...prev, academicYear: e.target.value }))}
                  placeholder="Misal: 2025/2026"
                  className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Versi Template *</label>
                <input
                  type="text"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="Misal: 1.0"
                  className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Skala Rubrik *</label>
                <select
                  value={formData.rubricType}
                  onChange={(e) => handleRubricTypeChange(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  <option value="1-4">Skala 1-4 (Akademik Default)</option>
                  <option value="1-5">Skala 1-5 (Manajerial Default)</option>
                  <option value="yes-no">Ya / Tidak (Yes/No)</option>
                  <option value="percentage">Persentase (0-100%)</option>
                  <option value="custom">Kustom Rubrik Bertingkat</option>
                </select>
              </div>
            </div>

            {/* LEVEL LABELS EDITOR */}
            {["1-4", "1-5", "yes-no", "custom"].includes(formData.rubricType) && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Detail Label Tingkatan Rubrik:</span>
                  {formData.rubricType === "custom" && (
                    <button
                      type="button"
                      onClick={handleAddCustomLevel}
                      className="px-2 py-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded-md font-bold hover:bg-blue-100 transition cursor-pointer"
                    >
                      + Tambah Level
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {formData.rubricLevels.map((lvl, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800">
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 w-6 h-6 flex items-center justify-center rounded-sm shrink-0">
                        {lvl.score}
                      </span>
                      <input
                        type="text"
                        value={lvl.label}
                        onChange={(e) => handleEditRubricLevel(index, e.target.value)}
                        placeholder={`Label untuk nilai ${lvl.score}`}
                        className="flex-1 px-2 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                      {formData.rubricType === "custom" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomLevel(index)}
                          className="text-rose-500 hover:text-rose-600 p-1 rounded-md transition"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Indicators Builder section */}
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 bg-slate-50/50 dark:bg-zinc-950/20 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">Indikator Penilaian & Pembobotan *</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Seluruh bobot indikator aktif wajib bernilai tepat 100%.</p>
              </div>

              <button
                type="button"
                onClick={handleOpenAddIndicator}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-bold cursor-pointer transition"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Indikator
              </button>
            </div>

            {/* WEIGHT VALIDATION WARNING BANNER */}
            <div className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
              isWeight100 
                ? "bg-emerald-50 text-emerald-800 border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50" 
                : "bg-amber-50 text-amber-800 border-amber-250 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50"
            }`}>
              {isWeight100 ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div className="text-xs font-semibold">
                {isWeight100 ? (
                  <span>Total bobot indikator aktif: <strong>100%</strong>. Siap disimpan!</span>
                ) : (
                  <span>Total bobot indikator aktif: <strong>{totalWeight}%</strong>. Bobot wajib bernilai <strong>100%</strong> agar instrumen ini dapat disimpan dan digunakan.</span>
                )}
              </div>
            </div>

            {formErrors.indicators && (
              <p className="text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-200">
                {formErrors.indicators}
              </p>
            )}

            {/* List of Indicators with drag-like up/down ordering */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {indicators.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-400 bg-white dark:bg-zinc-950">
                  Belum ada indikator yang ditambahkan. Silakan klik tombol Tambah Indikator.
                </div>
              ) : (
                indicators.map((ind, idx) => (
                  <div
                    key={ind.id || idx}
                    className={`flex items-start justify-between gap-3 p-3 bg-white dark:bg-zinc-950 border rounded-xl shadow-2xs transition-all ${
                      ind.isActive 
                        ? "border-slate-200 dark:border-zinc-800" 
                        : "border-slate-100 dark:border-zinc-900 opacity-60 bg-slate-50/50"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                          {idx + 1}. {ind.name}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-500">
                          {ind.scoringType}
                        </span>
                        {!ind.isActive && (
                          <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-rose-50 text-rose-600 border border-rose-200">
                            Nonaktif
                          </span>
                        )}
                      </div>
                      {ind.description && (
                        <p className="text-[11px] text-slate-400 leading-normal line-clamp-1">
                          {ind.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Weight badge */}
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300 px-2 py-0.5 rounded">
                        Bobot: {ind.weight}%
                      </span>

                      {/* Reordering and Actions */}
                      <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                        <button
                          type="button"
                          onClick={() => moveIndicator(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 hover:bg-slate-50 text-slate-500 hover:text-slate-700 disabled:opacity-30 rounded-lg transition"
                          title="Pindahkan Keatas"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveIndicator(idx, "down")}
                          disabled={idx === indicators.length - 1}
                          className="p-1 hover:bg-slate-50 text-slate-500 hover:text-slate-700 disabled:opacity-30 rounded-lg transition"
                          title="Pindahkan Kebawah"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditIndicator(idx)}
                          className="p-1 hover:bg-amber-50 text-amber-600 rounded-lg transition ml-1"
                          title="Ubah"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveIndicator(idx)}
                          className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                          title="Hapus"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Submit/Save buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setIsEditOpen(false);
              }}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isCreating || isUpdating || !isWeight100}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-zinc-850 disabled:text-slate-400 dark:disabled:text-zinc-500 text-white rounded-xl text-xs font-semibold cursor-pointer disabled:cursor-not-allowed transition"
            >
              {isCreating || isUpdating ? "Menyimpan..." : isEditOpen ? "Simpan Perubahan" : "Simpan Master"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* SINGLE INDICATOR FORM SUB-DIALOG */}
      <Dialog
        isOpen={isIndicatorOpen}
        onClose={() => setIsIndicatorOpen(false)}
        title={editingIndicatorIndex !== null ? "Ubah Indikator Penilaian" : "Tambah Indikator Penilaian"}
        size="sm"
      >
        <form onSubmit={handleSaveIndicator} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Indikator *</label>
            <input
              type="text"
              value={indicatorFormData.name}
              onChange={(e) => setIndicatorFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Contoh: Ketepatan waktu menyampaikan materi"
              className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
            />
            {indicatorErrors.name && <p className="text-[11px] text-rose-500 mt-0.5">{indicatorErrors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Fokus Penilaian (Aspek Fokus)</label>
            <input
              type="text"
              value={indicatorFormData.focus}
              onChange={(e) => setIndicatorFormData(prev => ({ ...prev, focus: e.target.value }))}
              placeholder="Contoh: Langkah Pembelajaran / Pengelolaan Kelas"
              className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Deskripsi / Kriteria Indikator</label>
            <textarea
              value={indicatorFormData.description}
              onChange={(e) => setIndicatorFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Berikan pedoman singkat kriteria penilaian untuk supervisor..."
              rows={2}
              className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Bobot (%) *</label>
              <input
                type="number"
                value={indicatorFormData.weight}
                onChange={(e) => setIndicatorFormData(prev => ({ ...prev, weight: Math.max(1, Math.min(100, Number(e.target.value))) }))}
                placeholder="Misal: 25"
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {indicatorErrors.weight && <p className="text-[11px] text-rose-500 mt-0.5">{indicatorErrors.weight}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Penilaian</label>
              <select
                value={indicatorFormData.scoringType}
                onChange={(e) => setIndicatorFormData(prev => ({ ...prev, scoringType: e.target.value as any }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="1-4">Skor 1 - 4</option>
                <option value="1-5">Skor 1 - 5</option>
                <option value="percentage">Persentase (0-100%)</option>
                <option value="yes-no">Ya / Tidak</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="indIsActive"
              checked={indicatorFormData.isActive}
              onChange={(e) => setIndicatorFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="rounded text-blue-600 focus:ring-blue-500/20 cursor-pointer"
            />
            <label htmlFor="indIsActive" className="text-xs font-semibold text-slate-600 cursor-pointer select-none">Indikator Aktif (Digunakan dalam penilaian)</label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsIndicatorOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold"
            >
              Batalkan
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
            >
              Simpan Indikator
            </button>
          </div>
        </form>
      </Dialog>

      {/* DETAIL MODAL */}
      <Dialog isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detail Master Instrumen Supervisi" size="md">
        {selectedInstrument && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-zinc-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {selectedInstrument.code}
                    </span>
                    <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-blue-50 text-blue-750 border border-blue-200">
                      v{selectedInstrument.version || "1.0"}
                    </span>
                    <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-emerald-50 text-emerald-750 border border-emerald-200">
                      {selectedInstrument.academicYear || "2025/2026"}
                    </span>
                    {selectedInstrument.targetSdmType && (
                      <span className="inline-flex px-1.5 py-0.5 rounded border border-indigo-200 text-[9px] font-bold bg-indigo-50 text-indigo-700">
                        {selectedInstrument.targetSdmType}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-zinc-100 block mt-1.5">{selectedInstrument.name}</span>
                </div>

                <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                  selectedInstrument.type === "Akademik"
                    ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                    : "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-300"
                }`}>
                  {selectedInstrument.type}
                </span>
              </div>

              <hr className="border-slate-200 dark:border-zinc-800" />

              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">DESKRIPSI MASTER</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedInstrument.description || "Tidak ada deskripsi rincian."}</span>
              </div>

              {selectedInstrument.rubricLevels && selectedInstrument.rubricLevels.length > 0 && (
                <>
                  <hr className="border-slate-200 dark:border-zinc-800" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">TINGKATAN RUBRIK ({selectedInstrument.rubricType || "Skala"})</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {selectedInstrument.rubricLevels.map((lvl, index) => (
                        <div key={index} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400 bg-white/50 dark:bg-zinc-900/50 p-1.5 rounded-lg border border-slate-200/50 dark:border-zinc-800">
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-450 bg-blue-50 dark:bg-blue-950/30 px-1 rounded-sm shrink-0">{lvl.score}</span>
                          <span className="truncate">{lvl.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">DAFTAR INDIKATOR & KRITERIA PENILAIAN</span>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(selectedInstrument.indicators || []).map((ind, idx) => (
                  <div key={ind.id || idx} className="p-3 bg-slate-50 dark:bg-zinc-950 p-4 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-1.5">
                        <span className="inline-flex shrink-0 items-center justify-center h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="text-xs text-slate-800 dark:text-zinc-200 font-bold leading-normal">{ind.name}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded shrink-0">
                        Bobot {ind.weight}%
                      </span>
                    </div>
                    {ind.description && (
                      <p className="text-[11px] text-slate-400 pl-5 leading-normal">
                        {ind.description}
                      </p>
                    )}
                    <div className="text-[9px] text-slate-400 pl-5 font-semibold space-y-0.5">
                      <div>Skema: {ind.scoringType === "percentage" ? "Persentase (0-100%)" : ind.scoringType === "yes-no" ? "Ya / Tidak" : `Skor ${ind.scoringType}`} | Max: {ind.maxScore}</div>
                      {ind.focus && (
                        <div className="text-indigo-650 dark:text-indigo-400">
                          Fokus: <strong>{ind.focus}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(!selectedInstrument.indicators || selectedInstrument.indicators.length === 0) && (
                  <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">Belum ada rincian indikator.</p>
                )}
              </div>
            </div>

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
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Hapus Master Instrumen" size="sm">
        {isCheckingUsage ? (
          <div className="py-6 text-center text-xs text-slate-400 font-medium">Memverifikasi status penggunaan instrumen...</div>
        ) : isUsedInSupervision ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-250 dark:border-amber-900/50">
              <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
              <div className="text-xs font-semibold space-y-1.5">
                <p>
                  Instrumen <strong>{selectedInstrument?.name}</strong> tidak dapat dihapus secara permanen karena sudah digunakan dalam pelaksanaan supervisi aktif.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-normal">
                  Untuk menjaga integritas dan riwayat data supervisi guru, Anda disarankan untuk menonaktifkan (mengarsipkan) instrumen ini agar tidak dapat dipilih lagi dalam supervisi mendatang.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (selectedInstrument) {
                    await handleToggleActive(selectedInstrument);
                    setIsDeleteOpen(false);
                  }
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                Arsipkan Saja (Nonaktifkan)
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-250 dark:border-rose-900/50">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <p className="text-xs font-semibold">
                Apakah Anda yakin ingin menghapus master instrumen <strong>{selectedInstrument?.name}</strong>? Data instrumen yang belum pernah digunakan ini akan dihapus secara permanen.
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
        )}
      </Dialog>
    </div>
  );
}
