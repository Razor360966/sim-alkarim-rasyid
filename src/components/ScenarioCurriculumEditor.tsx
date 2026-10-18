import React, { useState, useMemo } from "react";
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  AlertCircle, 
  BookOpen, 
  ArrowUpDown, 
  Sparkles,
  Layers,
  HelpCircle,
  Search,
  Edit2,
  UserCheck,
  RefreshCw,
  RotateCcw
} from "lucide-react";
import { ScenarioCurriculumMatrix, ScenarioSubject, Teacher } from "../types";
import { ScenarioTeacherSelect, formatTeacherDisplayName } from "./ScenarioTeacherSelect";

interface Props {
  curriculums: ScenarioCurriculumMatrix[];
  subjects?: ScenarioSubject[];
  teachers?: Teacher[];
  isLoadingTeachers?: boolean;
  isErrorTeachers?: boolean;
  onRetryTeachers?: () => void;
  onUpdateItem: (item: ScenarioCurriculumMatrix) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onAddCustomSubject?: (data: any) => Promise<void>;
  onDeleteZeroJpItems?: (itemIds: string[]) => Promise<void>;
  onSyncTeachersToSchedules?: () => void | Promise<void>;
  onSyncCurriculumToSchedules?: () => void | Promise<void>;
  onRealignFromOperational?: () => Promise<void>;
  isReadOnly?: boolean;
}

export const ScenarioCurriculumEditor: React.FC<Props> = ({
  curriculums,
  subjects = [],
  teachers = [],
  isLoadingTeachers = false,
  isErrorTeachers = false,
  onRetryTeachers,
  onUpdateItem,
  onToggleActive,
  onAddCustomSubject,
  onDeleteZeroJpItems,
  onSyncTeachersToSchedules,
  onSyncCurriculumToSchedules,
  onRealignFromOperational,
  isReadOnly = false
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRealigning, setIsRealigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showZeroJpModal, setShowZeroJpModal] = useState(false);
  const [selectedZeroJpIds, setSelectedZeroJpIds] = useState<string[]>([]);
  const [isDeletingZeroJp, setIsDeletingZeroJp] = useState(false);

  // Edit Subject Name & Teacher Modal
  const [editingItem, setEditingItem] = useState<ScenarioCurriculumMatrix | null>(null);
  const [editForm, setEditForm] = useState({
    subjectName: "",
    teacherName: "",
    teacherId: "",
    useDifferentTeachers: false,
    teacherId_vii: "",
    teacherName_vii: "",
    teacherId_viii: "",
    teacherName_viii: "",
    teacherId_ix: "",
    teacherName_ix: ""
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add Custom Subject Form
  const [addForm, setAddForm] = useState({
    name: "",
    code: "",
    group: "A" as "A" | "B" | "C",
    kkm: 75,
    jp_vii: 2,
    jp_viii: 2,
    jp_ix: 2,
    teacherName: "",
    teacherId: ""
  });
  const [isAdding, setIsAdding] = useState(false);

  // Helper to determine the category of a matrix item
  // Follows CurriculumMatrix.tsx strictly: group "B" is Kepesantrenan, else Umum
  const getItemCategory = (item: ScenarioCurriculumMatrix): "Kepesantrenan" | "Umum" => {
    const subjectDetail = subjects.find((s) => s.id === item.subjectId || s.originalSubjectId === item.subjectId);
    if (subjectDetail) {
      return subjectDetail.group === "B" ? "Kepesantrenan" : "Umum";
    }
    return item.subjectGroup === "B" ? "Kepesantrenan" : "Umum";
  };

  // Helper to get resolved Subject display name
  const getSubjectDisplayName = (item: ScenarioCurriculumMatrix): string => {
    const detail = subjects.find((s) => s.id === item.subjectId || s.originalSubjectId === item.subjectId);
    return item.subjectName || detail?.name || "Mata Pelajaran";
  };

  // Filtered matrix by search keyword
  const filteredCurriculums = useMemo(() => {
    if (!searchTerm.trim()) return curriculums;
    const query = searchTerm.toLowerCase().trim();
    return curriculums.filter((item) => {
      const detail = subjects.find((s) => s.id === item.subjectId || s.originalSubjectId === item.subjectId);
      const code = (detail?.code || "").toLowerCase();
      const displayName = getSubjectDisplayName(item).toLowerCase();
      const teacher = (item.teacherName || "").toLowerCase();

      return (
        displayName.includes(query) ||
        code.includes(query) ||
        teacher.includes(query)
      );
    });
  }, [curriculums, searchTerm, subjects]);

  // Kepesantrenan partition (Group B)
  const kepesantrenanMatrix = useMemo(() => {
    return filteredCurriculums
      .filter((item) => getItemCategory(item) === "Kepesantrenan")
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 0;
        const orderB = typeof b.order === "number" ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return getSubjectDisplayName(a).localeCompare(getSubjectDisplayName(b));
      });
  }, [filteredCurriculums, subjects]);

  // Umum partition (Group A and Group C)
  const umumMatrix = useMemo(() => {
    return filteredCurriculums
      .filter((item) => getItemCategory(item) === "Umum")
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 0;
        const orderB = typeof b.order === "number" ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return getSubjectDisplayName(a).localeCompare(getSubjectDisplayName(b));
      });
  }, [filteredCurriculums, subjects]);

  // Totals calculations for Kepesantrenan (Active in scenario only)
  const totalJP_kepesantrenan = useMemo(() => {
    return kepesantrenanMatrix.reduce(
      (acc, curr) => {
        if (!curr.isActiveInScenario) return acc;
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [kepesantrenanMatrix]);

  // Totals calculations for Umum (Active in scenario only)
  const totalJP_umum = useMemo(() => {
    return umumMatrix.reduce(
      (acc, curr) => {
        if (!curr.isActiveInScenario) return acc;
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [umumMatrix]);

  // Overall totals
  const totalJP = useMemo(() => {
    return {
      vii: totalJP_kepesantrenan.vii + totalJP_umum.vii,
      viii: totalJP_kepesantrenan.viii + totalJP_umum.viii,
      ix: totalJP_kepesantrenan.ix + totalJP_umum.ix
    };
  }, [totalJP_kepesantrenan, totalJP_umum]);

  // Scan items with JP 0 in VII, VIII, and IX
  const zeroJpItems = useMemo(() => {
    return curriculums.filter(
      (c) => (c.jp_vii || 0) === 0 && (c.jp_viii || 0) === 0 && (c.jp_ix || 0) === 0
    );
  }, [curriculums]);

  // Handler for JP Input Blur
  const handleJPChange = (item: ScenarioCurriculumMatrix, field: "jp_vii" | "jp_viii" | "jp_ix", valStr: string) => {
    if (isReadOnly) return;
    const num = valStr === "" ? 0 : Math.max(0, parseInt(valStr, 10) || 0);
    if (item[field] === num) return;
    onUpdateItem({
      ...item,
      [field]: num
    });
  };

  // Handler for Order Input Blur
  const handleOrderChange = (item: ScenarioCurriculumMatrix, valStr: string) => {
    if (isReadOnly) return;
    const num = valStr === "" ? 0 : parseInt(valStr, 10) || 0;
    if (item.order === num) return;
    onUpdateItem({
      ...item,
      order: num
    });
  };

  // Open Edit Modal
  const handleOpenEdit = (item: ScenarioCurriculumMatrix) => {
    const resolveInitialId = (id?: string, name?: string) => {
      let tId = id || "";
      if (!tId && name && teachers.length > 0) {
        const match = teachers.find(
          (t) =>
            formatTeacherDisplayName(t).toLowerCase() === name.trim().toLowerCase() ||
            (t.name || "").toLowerCase().trim() === name.trim().toLowerCase()
        );
        if (match) tId = match.id || match.teacherId || "";
      }
      return tId;
    };

    const initialTeacherId = resolveInitialId(item.teacherId, item.teacherName);
    const initialViiId = resolveInitialId(item.teacherId_vii, item.teacherName_vii) || (item.useDifferentTeachers ? "" : initialTeacherId);
    const initialViiiId = resolveInitialId(item.teacherId_viii, item.teacherName_viii) || (item.useDifferentTeachers ? "" : initialTeacherId);
    const initialIxId = resolveInitialId(item.teacherId_ix, item.teacherName_ix) || (item.useDifferentTeachers ? "" : initialTeacherId);

    setEditingItem(item);
    setEditForm({
      subjectName: item.subjectName || "",
      teacherName: item.teacherName || "",
      teacherId: initialTeacherId,
      useDifferentTeachers: Boolean(item.useDifferentTeachers),
      teacherId_vii: initialViiId,
      teacherName_vii: item.teacherName_vii || (item.useDifferentTeachers ? "" : item.teacherName || ""),
      teacherId_viii: initialViiiId,
      teacherName_viii: item.teacherName_viii || (item.useDifferentTeachers ? "" : item.teacherName || ""),
      teacherId_ix: initialIxId,
      teacherName_ix: item.teacherName_ix || (item.useDifferentTeachers ? "" : item.teacherName || "")
    });
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingItem || isReadOnly) return;
    setIsSavingEdit(true);
    try {
      const isDiff = Boolean(editForm.useDifferentTeachers);
      const primaryId = isDiff
        ? (editForm.teacherId_vii || editForm.teacherId_viii || editForm.teacherId_ix || editForm.teacherId.trim())
        : editForm.teacherId.trim();
      const primaryName = isDiff
        ? (editForm.teacherName_vii || editForm.teacherName_viii || editForm.teacherName_ix || editForm.teacherName.trim())
        : editForm.teacherName.trim();

      await onUpdateItem({
        ...editingItem,
        subjectName: editForm.subjectName.trim() || editingItem.subjectName,
        teacherName: primaryName,
        teacherId: primaryId,
        useDifferentTeachers: isDiff,
        teacherId_vii: isDiff ? editForm.teacherId_vii.trim() : primaryId,
        teacherName_vii: isDiff ? editForm.teacherName_vii.trim() : primaryName,
        teacherId_viii: isDiff ? editForm.teacherId_viii.trim() : primaryId,
        teacherName_viii: isDiff ? editForm.teacherName_viii.trim() : primaryName,
        teacherId_ix: isDiff ? editForm.teacherId_ix.trim() : primaryId,
        teacherName_ix: isDiff ? editForm.teacherName_ix.trim() : primaryName
      });
      setEditingItem(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Execute Zero JP Deletion
  const handleExecuteDeleteZeroJp = async () => {
    if (selectedZeroJpIds.length === 0 || isReadOnly) return;
    setIsDeletingZeroJp(true);
    try {
      if (onDeleteZeroJpItems) {
        await onDeleteZeroJpItems(selectedZeroJpIds);
      } else {
        // Fallback: toggle active to false or update JP
        for (const id of selectedZeroJpIds) {
          await onToggleActive(id, false);
        }
      }
      setShowZeroJpModal(false);
      setSelectedZeroJpIds([]);
    } finally {
      setIsDeletingZeroJp(false);
    }
  };

  const handleSyncTeachers = async () => {
    const fn = onSyncCurriculumToSchedules || onSyncTeachersToSchedules;
    if (!fn || isReadOnly || isSyncing) return;
    setIsSyncing(true);
    try {
      await fn();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRealignFromOperational = async () => {
    if (!onRealignFromOperational || isReadOnly || isRealigning) return;
    if (!window.confirm("Sesuaikan penugasan guru di rancangan ini mengikuti data operasional asli? Penugasan guru yang sudah diubah secara manual di rancangan ini akan diperbarui.")) {
      return;
    }
    setIsRealigning(true);
    try {
      await onRealignFromOperational();
    } finally {
      setIsRealigning(false);
    }
  };

  // Render Table Rows for a list of items
  const renderRows = (items: ScenarioCurriculumMatrix[]) => {
    if (items.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="px-6 py-6 text-center text-gray-400 dark:text-zinc-500 italic font-medium">
            Tidak ada mata pelajaran pada kelompok ini.
          </td>
        </tr>
      );
    }

    return items.map((item) => {
      const subjectDetail = subjects.find((s) => s.id === item.subjectId || s.originalSubjectId === item.subjectId);
      const isKepesantrenan = getItemCategory(item) === "Kepesantrenan";
      const groupCode = isKepesantrenan ? "B" : item.subjectGroup || "A";
      const groupColors = { 
        A: "text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400", 
        B: "text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400", 
        C: "text-purple-700 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400" 
      };
      const groupLabels = { A: "A (Umum)", B: "B (Kepesantrenan)", C: "C (Mulok)" };
      const isZeroJp = (item.jp_vii || 0) === 0 && (item.jp_viii || 0) === 0 && (item.jp_ix || 0) === 0;

      return (
        <tr 
          key={item.id} 
          className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors ${
            !item.isActiveInScenario ? "opacity-50 bg-slate-50/60 dark:bg-zinc-900/40" : ""
          }`}
        >
          {/* 1. Urutan */}
          <td className="px-3 py-4 text-center">
            <div className="flex items-center justify-center">
              <input
                type="number"
                min="0"
                disabled={isReadOnly}
                defaultValue={item.order === 0 ? "" : item.order || ""}
                onBlur={(e) => handleOrderChange(item, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-14 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-1.5 py-1 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none disabled:bg-transparent"
              />
            </div>
          </td>

          {/* 2. Nama Mata Pelajaran */}
          <td className="px-5 py-4">
            <div className="flex flex-col gap-1 pr-4">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-gray-800 dark:text-zinc-100 truncate">
                  {getSubjectDisplayName(item)}
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                    title="Edit nama mapel & guru pengampu"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {item.isCustomSubject && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Simulasi Baru
                  </span>
                )}
                {isZeroJp && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                    0 JP
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-tight">
                  {subjectDetail ? subjectDetail.code : "SIM"}
                </span>
                <span className="text-[10px] text-gray-400">•</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md ${groupColors[groupCode as keyof typeof groupColors] || groupColors.A}`}>
                  Grup {groupLabels[groupCode as keyof typeof groupLabels] || "Umum"}
                </span>
                {subjectDetail?.kkm && (
                  <>
                    <span className="text-[10px] text-gray-400">•</span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                      KKM {subjectDetail.kkm}
                    </span>
                  </>
                )}
              </div>
            </div>
          </td>

          {/* 3. VII JP */}
          <td className="px-3 py-4 text-center">
            <div className="flex items-center justify-center">
              <input
                type="number"
                min="0"
                disabled={isReadOnly}
                defaultValue={item.jp_vii === 0 ? "" : item.jp_vii}
                onBlur={(e) => handleJPChange(item, "jp_vii", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-14 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-1.5 py-1 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none disabled:bg-transparent"
              />
            </div>
          </td>

          {/* 4. VIII JP */}
          <td className="px-3 py-4 text-center">
            <div className="flex items-center justify-center">
              <input
                type="number"
                min="0"
                disabled={isReadOnly}
                defaultValue={item.jp_viii === 0 ? "" : item.jp_viii}
                onBlur={(e) => handleJPChange(item, "jp_viii", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-14 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-1.5 py-1 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none disabled:bg-transparent"
              />
            </div>
          </td>

          {/* 5. IX JP */}
          <td className="px-3 py-4 text-center">
            <div className="flex items-center justify-center">
              <input
                type="number"
                min="0"
                disabled={isReadOnly}
                defaultValue={item.jp_ix === 0 ? "" : item.jp_ix}
                onBlur={(e) => handleJPChange(item, "jp_ix", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="w-14 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-1.5 py-1 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none disabled:bg-transparent"
              />
            </div>
          </td>

          {/* 6. Guru Pengampu */}
          <td className="px-5 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                {item.useDifferentTeachers ? (
                  <div className="space-y-1 text-xs">
                    {(item.jp_vii ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 shrink-0">
                          VII
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                          {item.teacherName_vii || <span className="text-slate-400 italic">Belum Ditugaskan</span>}
                        </span>
                      </div>
                    )}
                    {(item.jp_viii ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                          VIII
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                          {item.teacherName_viii || <span className="text-slate-400 italic">Belum Ditugaskan</span>}
                        </span>
                      </div>
                    )}
                    {(item.jp_ix ?? 0) > 0 && (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shrink-0">
                          IX
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate">
                          {item.teacherName_ix || <span className="text-slate-400 italic">Belum Ditugaskan</span>}
                        </span>
                      </div>
                    )}
                  </div>
                ) : item.teacherName ? (
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block truncate">
                    {item.teacherName}
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-[11px]">
                    Belum Ditugaskan
                  </span>
                )}
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => handleOpenEdit(item)}
                  className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                  title="Ubah nama mapel atau guru pengampu"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>

          {/* 7. Aksi */}
          <td className="px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => onToggleActive(item.id, !item.isActiveInScenario)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    item.isActiveInScenario
                      ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold"
                  }`}
                  title={item.isActiveInScenario ? "Nonaktifkan dari simulasi" : "Aktifkan kembali di simulasi"}
                >
                  {item.isActiveInScenario ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              )}
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="space-y-4">
      {/* Action Bar & Stats Banner */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Cari mapel atau guru di rancangan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Realign Teachers from Operational Source */}
          {!isReadOnly && onRealignFromOperational && (
            <button
              type="button"
              onClick={handleRealignFromOperational}
              disabled={isRealigning}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50 rounded-xl transition-colors border border-amber-200 dark:border-amber-900"
              title="Perbarui penugasan guru rancangan ini mengikuti data operasional asli"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRealigning ? "animate-spin" : ""}`} />
              <span>Sesuaikan Guru dari Asli</span>
            </button>
          )}

          {/* Sync Structure (JP & Teachers) from Shadow Curriculum to Shadow Schedule */}
          {!isReadOnly && (onSyncCurriculumToSchedules || onSyncTeachersToSchedules) && (
            <button
              type="button"
              onClick={handleSyncTeachers}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50 rounded-xl transition-colors border border-blue-200 dark:border-blue-900"
              title="Sinkronkan alokasi JP dan penugasan guru dari Struktur Kurikulum Bayangan ke seluruh slot Jadwal Bayangan (dengan Pratinjau)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>Sinkronkan Struktur ke Jadwal</span>
            </button>
          )}

          {/* Zero JP Scan & Cleanup Button */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setSelectedZeroJpIds(zeroJpItems.map((c) => c.id));
                setShowZeroJpModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50 rounded-xl transition-colors border border-rose-200 dark:border-rose-900"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Mapel Tanpa Alokasi JP ({zeroJpItems.length})</span>
            </button>
          )}

          {/* Add Custom Subject Button */}
          {!isReadOnly && onAddCustomSubject && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Mapel Simulasi</span>
            </button>
          )}
        </div>
      </div>

      {/* UNIFIED MATRIX TABLE MATCHING MAIN CURRICULUM */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full max-h-[650px] scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[32%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[18%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-slate-900 dark:bg-zinc-950 text-white text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                <th className="px-3 py-3.5 text-center">Urutan</th>
                <th className="px-5 py-3.5 text-left">Nama Mata Pelajaran (Rancangan)</th>
                <th className="px-3 py-3.5 text-center">VII ({totalJP.vii} JP)</th>
                <th className="px-3 py-3.5 text-center">VIII ({totalJP.viii} JP)</th>
                <th className="px-3 py-3.5 text-center">IX ({totalJP.ix} JP)</th>
                <th className="px-5 py-3.5 text-left">Guru Pengampu</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-zinc-850/70 text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {filteredCurriculums.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-zinc-900 flex items-center justify-center text-slate-400 dark:text-zinc-600">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                        Belum Ada Struktur Kurikulum di Rancangan
                      </div>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed font-medium">
                        {searchTerm 
                          ? "Silakan periksa kembali kata kunci pencarian Anda." 
                          : "Gunakan tombol Tambah Mapel Simulasi di atas untuk memulai."
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {/* CATEGORY SUB-HEADER: KEPESANTRENAN (GROUP B) */}
                  <tr className="bg-amber-50/60 dark:bg-amber-950/20 border-y border-amber-100/50 dark:border-amber-900/30">
                    <td colSpan={7} className="px-5 py-3 text-xs font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse"></span>
                          <span>Mata Pelajaran Kepesantrenan ({kepesantrenanMatrix.length} Mapel)</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          <span>VII: {totalJP_kepesantrenan.vii} JP</span>
                          <span>•</span>
                          <span>VIII: {totalJP_kepesantrenan.viii} JP</span>
                          <span>•</span>
                          <span>IX: {totalJP_kepesantrenan.ix} JP</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {renderRows(kepesantrenanMatrix)}

                  {/* CATEGORY SUB-HEADER: UMUM (GROUP A & C) */}
                  <tr className="bg-blue-50/60 dark:bg-blue-950/20 border-y border-blue-100/50 dark:border-blue-900/30">
                    <td colSpan={7} className="px-5 py-3 text-xs font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 animate-pulse"></span>
                          <span>Mata Pelajaran Umum ({umumMatrix.length} Mapel)</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                          <span>VII: {totalJP_umum.vii} JP</span>
                          <span>•</span>
                          <span>VIII: {totalJP_umum.viii} JP</span>
                          <span>•</span>
                          <span>IX: {totalJP_umum.ix} JP</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {renderRows(umumMatrix)}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDIT MAPEL & GURU */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <span>Edit Mapel & Guru Pengampu</span>
              </h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Perubahan hanya berlaku pada data bayangan/simulasi ini dan tidak mengubah master mata pelajaran operasional.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Nama Mata Pelajaran
                </label>
                <input
                  type="text"
                  value={editForm.subjectName}
                  onChange={(e) => setEditForm({ ...editForm, subjectName: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white font-semibold"
                />
              </div>

              {/* Toggle Guru Berbeda Tiap Jenjang */}
              <div className="pt-1 pb-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.useDifferentTeachers}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setEditForm((prev) => ({
                        ...prev,
                        useDifferentTeachers: checked,
                        teacherId_vii: prev.teacherId_vii || prev.teacherId,
                        teacherName_vii: prev.teacherName_vii || prev.teacherName,
                        teacherId_viii: prev.teacherId_viii || prev.teacherId,
                        teacherName_viii: prev.teacherName_viii || prev.teacherName,
                        teacherId_ix: prev.teacherId_ix || prev.teacherId,
                        teacherName_ix: prev.teacherName_ix || prev.teacherName
                      }));
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                    Guru Pengampu Berbeda Tiap Jenjang (VII, VIII, IX)
                  </span>
                </label>
              </div>

              {!editForm.useDifferentTeachers ? (
                <div>
                  <ScenarioTeacherSelect
                    label="Guru Pengampu (Semua Jenjang)"
                    currentTeacherId={editForm.teacherId}
                    currentTeacherName={editForm.teacherName}
                    teachers={teachers}
                    isLoading={isLoadingTeachers}
                    isError={isErrorTeachers}
                    onRetry={onRetryTeachers}
                    onSelect={(teacherId, teacherName) => {
                      setEditForm((prev) => ({
                        ...prev,
                        teacherId,
                        teacherName,
                        teacherId_vii: teacherId,
                        teacherName_vii: teacherName,
                        teacherId_viii: teacherId,
                        teacherName_viii: teacherName,
                        teacherId_ix: teacherId,
                        teacherName_ix: teacherName
                      }));
                    }}
                    disabled={isSavingEdit}
                    showClearOption={true}
                    placeholder="Pilih atau cari guru dari database master..."
                  />
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-zinc-850/60 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Penugasan Guru Spesifik Jenjang
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-400 block mb-1">
                      Kelas VII (Alokasi: {editingItem.jp_vii || 0} JP)
                    </span>
                    <ScenarioTeacherSelect
                      currentTeacherId={editForm.teacherId_vii}
                      currentTeacherName={editForm.teacherName_vii}
                      teachers={teachers}
                      isLoading={isLoadingTeachers}
                      isError={isErrorTeachers}
                      onRetry={onRetryTeachers}
                      onSelect={(teacherId, teacherName) => {
                        setEditForm((prev) => ({
                          ...prev,
                          teacherId_vii: teacherId,
                          teacherName_vii: teacherName
                        }));
                      }}
                      disabled={isSavingEdit}
                      showClearOption={true}
                      placeholder="Pilih guru untuk Kelas VII..."
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 block mb-1">
                      Kelas VIII (Alokasi: {editingItem.jp_viii || 0} JP)
                    </span>
                    <ScenarioTeacherSelect
                      currentTeacherId={editForm.teacherId_viii}
                      currentTeacherName={editForm.teacherName_viii}
                      teachers={teachers}
                      isLoading={isLoadingTeachers}
                      isError={isErrorTeachers}
                      onRetry={onRetryTeachers}
                      onSelect={(teacherId, teacherName) => {
                        setEditForm((prev) => ({
                          ...prev,
                          teacherId_viii: teacherId,
                          teacherName_viii: teacherName
                        }));
                      }}
                      disabled={isSavingEdit}
                      showClearOption={true}
                      placeholder="Pilih guru untuk Kelas VIII..."
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-purple-600 dark:text-purple-400 block mb-1">
                      Kelas IX (Alokasi: {editingItem.jp_ix || 0} JP)
                    </span>
                    <ScenarioTeacherSelect
                      currentTeacherId={editForm.teacherId_ix}
                      currentTeacherName={editForm.teacherName_ix}
                      teachers={teachers}
                      isLoading={isLoadingTeachers}
                      isError={isErrorTeachers}
                      onRetry={onRetryTeachers}
                      onSelect={(teacherId, teacherName) => {
                        setEditForm((prev) => ({
                          ...prev,
                          teacherId_ix: teacherId,
                          teacherName_ix: teacherName
                        }));
                      }}
                      disabled={isSavingEdit}
                      showClearOption={true}
                      placeholder="Pilih guru untuk Kelas IX..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSavingEdit || !editForm.subjectName.trim()}
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs transition-colors"
              >
                {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: HAPUS MAPEL TANPA ALOKASI JP (JP 0) */}
      {showZeroJpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Konfirmasi Hapus Mapel Tanpa Alokasi JP (0 JP)</span>
              </h3>
              <button onClick={() => setShowZeroJpModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Ditemukan <strong>{zeroJpItems.length} mata pelajaran</strong> di rancangan ini yang memiliki 0 JP di seluruh kelas (VII, VIII, IX). Pilih mapel yang ingin dibersihkan dari simulasi:
            </p>

            {zeroJpItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 italic">
                Tidak ada mata pelajaran dengan alokasi 0 JP.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl divide-y divide-slate-100 dark:divide-zinc-800">
                {zeroJpItems.map((item) => {
                  const isChecked = selectedZeroJpIds.includes(item.id);
                  const cat = getItemCategory(item);
                  return (
                    <label
                      key={item.id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedZeroJpIds([...selectedZeroJpIds, item.id]);
                            } else {
                              setSelectedZeroJpIds(selectedZeroJpIds.filter((id) => id !== item.id));
                            }
                          }}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <span className="font-bold text-slate-800 dark:text-zinc-200 block">
                            {getSubjectDisplayName(item)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Kelompok: {cat} • Guru: {item.teacherName || "Belum Ditugaskan"}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
                        0 JP
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedZeroJpIds(zeroJpItems.map((c) => c.id))}
                  className="text-[11px] font-bold text-emerald-600 hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedZeroJpIds([])}
                  className="text-[11px] font-bold text-slate-500 hover:underline"
                >
                  Batal Pilih
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowZeroJpModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={selectedZeroJpIds.length === 0 || isDeletingZeroJp}
                  onClick={handleExecuteDeleteZeroJp}
                  className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-colors disabled:opacity-40"
                >
                  {isDeletingZeroJp ? "Menghapus..." : `Hapus (${selectedZeroJpIds.length}) Mapel`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TAMBAH MAPEL SIMULASI */}
      {showAddModal && onAddCustomSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Tambah Mata Pelajaran Simulasi</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Nama Mata Pelajaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Robotika & Coding"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Kode Singkat
                  </label>
                  <input
                    type="text"
                    placeholder="ROB"
                    value={addForm.code}
                    onChange={(e) => setAddForm({ ...addForm, code: e.target.value.toUpperCase() })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Kelompok
                  </label>
                  <select
                    value={addForm.group}
                    onChange={(e) => setAddForm({ ...addForm, group: e.target.value as any })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white"
                  >
                    <option value="A">A (Umum)</option>
                    <option value="B">B (Kepesantrenan)</option>
                    <option value="C">C (Muatan Lokal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    JP VII
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.jp_vii}
                    onChange={(e) => setAddForm({ ...addForm, jp_vii: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    JP VIII
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.jp_viii}
                    onChange={(e) => setAddForm({ ...addForm, jp_viii: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    JP IX
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.jp_ix}
                    onChange={(e) => setAddForm({ ...addForm, jp_ix: parseInt(e.target.value, 10) || 0 })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white text-center"
                  />
                </div>
              </div>

              <div>
                <ScenarioTeacherSelect
                  label="Guru Pengampu (Opsional)"
                  currentTeacherId={addForm.teacherId}
                  currentTeacherName={addForm.teacherName}
                  teachers={teachers}
                  isLoading={isLoadingTeachers}
                  isError={isErrorTeachers}
                  onRetry={onRetryTeachers}
                  onSelect={(teacherId, teacherName) => {
                    setAddForm((prev) => ({
                      ...prev,
                      teacherId,
                      teacherName
                    }));
                  }}
                  disabled={isAdding}
                  showClearOption={true}
                  placeholder="Pilih guru pengampu dari master SIMAK..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isAdding || !addForm.name.trim()}
                onClick={async () => {
                  setIsAdding(true);
                  try {
                    await onAddCustomSubject(addForm);
                    setShowAddModal(false);
                    setAddForm({
                      name: "",
                      code: "",
                      group: "A",
                      kkm: 75,
                      jp_vii: 2,
                      jp_viii: 2,
                      jp_ix: 2,
                      teacherName: "",
                      teacherId: ""
                    });
                  } finally {
                    setIsAdding(false);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
              >
                {isAdding ? "Menambahkan..." : "Tambah ke Simulasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
