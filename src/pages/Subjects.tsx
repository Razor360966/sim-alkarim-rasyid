import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subjectService } from "../services/subjectService";
import { Subject, SubjectLearningType, SubjectReportDisplay } from "../types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { FormInput, FormSelect } from "../components/FormInput";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  FileDown,
  TableProperties,
  AlertTriangle,
  Layers,
  Shield,
  Eye,
  EyeOff,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Search,
  Lock,
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Power
} from "lucide-react";
import {
  getSubjectCategoryType,
  getSubjectGroupType,
  isSubjectClassified,
  getSubjectLearningType,
  getSubjectReportDisplay
} from "../utils/subjectHelper";

const gradeOptions = [
  { value: "7", label: "VII" },
  { value: "8", label: "VIII" },
  { value: "9", label: "IX" }
] as const;

const subjectSchema = z.object({
  code: z.string().min(2, { message: "Kode mapel minimal 2 karakter" }),
  name: z.string().min(3, { message: "Nama mapel minimal 3 karakter" }),
  subjectType: z.enum(["UMUM", "KEPESANTRENAN"], { message: "Pilih kelompok e-Rapor" }),
  group: z.enum(["A", "B", "C"], { message: "Pilih kelompok kurikulum" }),
  categoryType: z.enum(["umum_pai", "diniyah_pondok"]).optional(),
  learningType: z.enum(["REGULER", "BLOK"]).default("REGULER"),
  reportDisplay: z.enum(["TAMPIL_RAPOR", "TIDAK_TAMPIL_RAPOR"]).default("TAMPIL_RAPOR"),
  kkm: z.coerce.number().min(0).max(100, { message: "KKM bernilai 0 - 100" }),
  grades: z.array(z.enum(["7", "8", "9"])).min(1, { message: "Pilih peruntukan kelas" })
});

type SubjectFormValues = z.infer<typeof subjectSchema>;

const defaultSubjectValues: SubjectFormValues = {
  code: "",
  name: "",
  subjectType: "UMUM",
  group: "A",
  categoryType: "umum_pai",
  learningType: "REGULER",
  reportDisplay: "TAMPIL_RAPOR",
  kkm: 75,
  grades: ["7", "8", "9"]
};

const normalizeGrades = (subject: Subject): SubjectFormValues["grades"] => {
  if (Array.isArray(subject.grades) && subject.grades.length > 0) {
    return subject.grades;
  }

  if (subject.grade === "Semua") {
    return ["7", "8", "9"];
  }

  if (subject.grade === "7" || subject.grade === "8" || subject.grade === "9") {
    return [subject.grade];
  }

  return ["7", "8", "9"];
};

const formatGrades = (subject: Subject) => {
  const grades = normalizeGrades(subject);
  if (grades.length === 3) return "Semua Tingkat (VII, VIII, IX)";

  const romanGrades: Record<(typeof grades)[number], string> = {
    "7": "VII",
    "8": "VIII",
    "9": "IX"
  };

  return grades.map((grade) => `Kelas ${romanGrades[grade]}`).join(", ");
};

const GradeCheckboxes: React.FC<{
  register: ReturnType<typeof useForm<SubjectFormValues>>["register"];
  error?: string;
}> = ({ register, error }) => (
  <div className="space-y-2">
    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
      Diberikan Untuk Tingkat Kelas <span className="text-rose-500 font-bold">*</span>
    </label>
    <div className="flex flex-wrap gap-3">
      {gradeOptions.map((option) => (
        <label
          key={option.value}
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <input
            type="checkbox"
            value={option.value}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            {...register("grades")}
          />
          {option.label}
        </label>
      ))}
    </div>
    {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
  </div>
);

export const Subjects: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTabFilter, setActiveTabFilter] = useState<"ALL" | "UMUM" | "KEPESANTRENAN" | "UNCLASSIFIED">("ALL");
  const [learningTypeFilter, setLearningTypeFilter] = useState<"ALL" | "REGULER" | "BLOK">("ALL");
  const [reportDisplayFilter, setReportDisplayFilter] = useState<"ALL" | "TAMPIL_RAPOR" | "TIDAK_TAMPIL_RAPOR">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [usageCheck, setUsageCheck] = useState<{
    loading: boolean;
    inUse: boolean;
    reasons: string[];
  }>({ loading: false, inUse: false, reasons: [] });

  // Sorting & Pagination States
  const [sortField, setSortField] = useState<keyof Subject | "groupType" | "learningType" | "reportDisplay" | "categoryType">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: subjectService.getSubjects
  });

  const createForm = useForm<any>({
    resolver: zodResolver(subjectSchema),
    defaultValues: defaultSubjectValues
  });

  const editForm = useForm<any>({
    resolver: zodResolver(subjectSchema),
    defaultValues: defaultSubjectValues
  });

  const createMutation = useMutation({
    mutationFn: subjectService.createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast("Mata Pelajaran berhasil ditambahkan!", "success");
      setIsCreateOpen(false);
      createForm.reset(defaultSubjectValues);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal menambahkan data", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Subject> }) =>
      subjectService.updateSubject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast("Mata Pelajaran berhasil diperbarui!", "success");
      setIsEditOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal memperbarui data", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      subjectService.deleteSubject(id, force),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      if (res.deactivated) {
        toast(res.message, "info");
      } else {
        toast(res.message, "success");
      }
      setIsDeleteOpen(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast("Gagal memproses penghapusan: " + (err?.message || ""), "error");
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      if (activate) {
        await subjectService.activateSubject(id);
      } else {
        await subjectService.deactivateSubject(id);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      toast(`Mata pelajaran berhasil ${variables.activate ? "diaktifkan" : "dinonaktifkan"}!`, "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast("Gagal mengubah status mata pelajaran: " + (err?.message || ""), "error");
    }
  });

  const handleCreateOpen = () => {
    createForm.reset(defaultSubjectValues);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = (data: SubjectFormValues) => {
    const payload: Omit<Subject, "id" | "createdAt"> = {
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      subjectType: data.subjectType,
      group: data.subjectType === "KEPESANTRENAN" ? "B" : data.group,
      categoryType: data.subjectType === "KEPESANTRENAN" ? "diniyah_pondok" : "umum_pai",
      learningType: data.learningType as SubjectLearningType,
      reportDisplay: data.reportDisplay as SubjectReportDisplay,
      kkm: data.kkm,
      grades: data.grades
    };
    createMutation.mutate(payload);
  };

  const handleEditOpen = (subject: Subject) => {
    setSelectedSubject(subject);
    const grpType = getSubjectGroupType(subject);
    const resolvedSubjectType: "UMUM" | "KEPESANTRENAN" = grpType === "KEPESANTRENAN" ? "KEPESANTRENAN" : "UMUM";

    editForm.reset({
      code: subject.code,
      name: subject.name,
      subjectType: resolvedSubjectType,
      group: subject.group || (resolvedSubjectType === "KEPESANTRENAN" ? "B" : "A"),
      categoryType: getSubjectCategoryType(subject),
      learningType: getSubjectLearningType(subject),
      reportDisplay: getSubjectReportDisplay(subject),
      kkm: subject.kkm,
      grades: normalizeGrades(subject)
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (data: SubjectFormValues) => {
    if (selectedSubject) {
      const payload: Partial<Subject> = {
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
        subjectType: data.subjectType,
        group: data.subjectType === "KEPESANTRENAN" ? "B" : data.group,
        categoryType: data.subjectType === "KEPESANTRENAN" ? "diniyah_pondok" : "umum_pai",
        learningType: data.learningType as SubjectLearningType,
        reportDisplay: data.reportDisplay as SubjectReportDisplay,
        kkm: data.kkm,
        grades: data.grades
      };
      updateMutation.mutate({ id: selectedSubject.id, data: payload });
    }
  };

  const handleDeleteOpen = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDeleteOpen(true);
    setUsageCheck({ loading: true, inUse: false, reasons: [] });
    subjectService.checkSubjectUsage(subject.id).then((res) => {
      setUsageCheck({ loading: false, inUse: res.inUse, reasons: res.reasons });
    });
  };

  const handleDeleteConfirm = (force: boolean = false) => {
    if (selectedSubject) {
      deleteMutation.mutate({ id: selectedSubject.id, force });
    }
  };

  // Quick horizontal scroll handlers
  const handleScrollLeft = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  // Group statistics & Unclassified warning check
  const countAll = subjects.length;
  const countUmum = useMemo(() => subjects.filter((s) => getSubjectGroupType(s) === "UMUM").length, [subjects]);
  const countKepesantrenan = useMemo(() => subjects.filter((s) => getSubjectGroupType(s) === "KEPESANTRENAN").length, [subjects]);
  const unclassifiedSubjects = useMemo(
    () => subjects.filter((s) => getSubjectGroupType(s) === "UNCLASSIFIED" || !isSubjectClassified(s)),
    [subjects]
  );

  // Filtered dataset
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = s.code?.toLowerCase().includes(q);
        const nameMatch = s.name?.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch) return false;
      }

      // 1. Kelompok e-Rapor Tab Filter
      if (activeTabFilter === "UMUM" && getSubjectGroupType(s) !== "UMUM") return false;
      if (activeTabFilter === "KEPESANTRENAN" && getSubjectGroupType(s) !== "KEPESANTRENAN") return false;
      if (activeTabFilter === "UNCLASSIFIED" && getSubjectGroupType(s) !== "UNCLASSIFIED" && isSubjectClassified(s)) return false;

      // 2. Jenis Pembelajaran Filter
      const lType = getSubjectLearningType(s);
      if (learningTypeFilter !== "ALL" && lType !== learningTypeFilter) return false;

      // 3. Tampil di Rapor Filter
      const rDisplay = getSubjectReportDisplay(s);
      if (reportDisplayFilter !== "ALL" && rDisplay !== reportDisplayFilter) return false;

      // 4. Status Aktif / Nonaktif Filter
      if (statusFilter === "ACTIVE" && s.isActive === false) return false;
      if (statusFilter === "INACTIVE" && s.isActive !== false) return false;

      return true;
    });
  }, [subjects, searchQuery, activeTabFilter, learningTypeFilter, reportDisplayFilter, statusFilter]);

  // Sorted dataset
  const sortedSubjects = useMemo(() => {
    const list = [...filteredSubjects];
    list.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";

      if (sortField === "code") {
        valA = a.code || "";
        valB = b.code || "";
      } else if (sortField === "name") {
        valA = a.name || "";
        valB = b.name || "";
      } else if (sortField === "groupType") {
        valA = getSubjectGroupType(a);
        valB = getSubjectGroupType(b);
      } else if (sortField === "learningType") {
        valA = getSubjectLearningType(a);
        valB = getSubjectLearningType(b);
      } else if (sortField === "reportDisplay") {
        valA = getSubjectReportDisplay(a);
        valB = getSubjectReportDisplay(b);
      } else if (sortField === "kkm") {
        valA = a.kkm || 0;
        valB = b.kkm || 0;
      } else if (sortField === "categoryType") {
        valA = getSubjectCategoryType(a);
        valB = getSubjectCategoryType(b);
      } else if (sortField === "group") {
        valA = a.group || "";
        valB = b.group || "";
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      return sortDirection === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    return list;
  }, [filteredSubjects, sortField, sortDirection]);

  // Pagination calculation
  const totalItems = sortedSubjects.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const adjustedCurrentPage = currentPage > totalPages ? totalPages : currentPage;
  const startIndex = (adjustedCurrentPage - 1) * itemsPerPage;
  const paginatedSubjects = useMemo(() => {
    return sortedSubjects.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedSubjects, startIndex, itemsPerPage]);

  const startEntry = totalItems === 0 ? 0 : startIndex + 1;
  const endEntry = Math.min(startIndex + itemsPerPage, totalItems);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleExportExcel = () => {
    const formatted = sortedSubjects.map((subject, idx) => ({
      "No": idx + 1,
      "Kode Mapel": subject.code,
      "Nama Mapel": subject.name,
      "Kelompok Rapor": getSubjectGroupType(subject) === "KEPESANTRENAN" ? "KEPESANTRENAN" : "UMUM",
      "Jenis Pembelajaran": getSubjectLearningType(subject) === "BLOK" ? "BLOK" : "REGULER",
      "Tampil di Rapor": getSubjectReportDisplay(subject) === "TIDAK_TAMPIL_RAPOR" ? "TIDAK" : "YA (TAMPIL)",
      "Kelompok Kurikulum":
        subject.group === "A"
          ? "Group A (Wajib Umum)"
          : subject.group === "B"
          ? "Group B (Kepesantrenan)"
          : "Group C (Muatan Lokal)",
      "KKM": subject.kkm,
      "Syarat Jurnal": getSubjectCategoryType(subject) === "diniyah_pondok" ? "Diniyah (Langsung)" : "Wajib Prota & Prosem",
      "Peruntukan Tingkat": formatGrades(subject)
    }));
    exportToExcel(formatted, "Daftar_Mata_Pelajaran_SMP_Alkarim", "Mata Pelajaran");
    toast("Excel berhasil diunduh!", "success");
  };

  const handleExportPDF = () => {
    const headers = ["No", "Kode", "Nama Mata Pelajaran", "Kelompok", "Jenis", "Tampil Rapor", "KKM", "Tingkat"];
    const rows = sortedSubjects.map((subject, idx) => [
      String(idx + 1),
      subject.code,
      subject.name,
      getSubjectGroupType(subject) === "KEPESANTRENAN" ? "KEPESANTRENAN" : "UMUM",
      getSubjectLearningType(subject) === "BLOK" ? "BLOK" : "REGULER",
      getSubjectReportDisplay(subject) === "TIDAK_TAMPIL_RAPOR" ? "TIDAK" : "YA",
      String(subject.kkm),
      formatGrades(subject)
    ]);
    exportToPDF("DAFTAR MATA PELAJARAN", headers, rows, "Daftar_Mata_Pelajaran_SMP_Alkarim");
    toast("PDF berhasil diunduh!", "success");
  };

  if (isLoading) {
    return <Loading variant="full" text="Memuat daftar mata pelajaran SSOT..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-zinc-850 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Master Mata Pelajaran (SSOT Kurikulum)
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Single Source of Truth pengelompokan mata pelajaran, jenis pembelajaran (Reguler/Blok), dan status tampil di e-Rapor.
          </p>
        </div>
        <button
          onClick={handleCreateOpen}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Mata Pelajaran
        </button>
      </div>

      {/* Warning Banner if any Unclassified Subject exists */}
      {unclassifiedSubjects.length > 0 && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="font-bold block">Peringatan Kelompok Mata Pelajaran:</span>
              Terdapat <strong>{unclassifiedSubjects.length} mata pelajaran</strong> yang belum memiliki kelompok valid. Silakan tentukan kelompoknya (UMUM atau KEPESANTRENAN) pada Master Mata Pelajaran.
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTabFilter("UNCLASSIFIED");
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shrink-0 cursor-pointer"
          >
            Lihat Mapel
          </button>
        </div>
      )}

      {/* Main Table Container Card */}
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs space-y-4">
        {/* Top Level Kelompok Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 dark:border-zinc-800 pb-3">
          <button
            onClick={() => {
              setActiveTabFilter("ALL");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTabFilter === "ALL"
                ? "bg-slate-800 text-white shadow-xs dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700"
            }`}
          >
            <Layers className="w-4 h-4" />
            Semua Mata Pelajaran ({countAll})
          </button>
          <button
            onClick={() => {
              setActiveTabFilter("UMUM");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTabFilter === "UMUM"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Mata Pelajaran UMUM ({countUmum})
          </button>
          <button
            onClick={() => {
              setActiveTabFilter("KEPESANTRENAN");
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTabFilter === "KEPESANTRENAN"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            }`}
          >
            <Shield className="w-4 h-4" />
            Mata Pelajaran KEPESANTRENAN ({countKepesantrenan})
          </button>

          {unclassifiedSubjects.length > 0 && (
            <button
              onClick={() => {
                setActiveTabFilter("UNCLASSIFIED");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                activeTabFilter === "UNCLASSIFIED"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Perlu Dikelompokkan ({unclassifiedSubjects.length})
            </button>
          )}
        </div>

        {/* Sub-Filters Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kode atau nama mapel..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800 dark:text-zinc-200 placeholder-slate-400"
              />
            </div>

            {/* Filter Jenis Pembelajaran */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600 dark:text-zinc-400">Jenis:</span>
              <select
                value={learningTypeFilter}
                onChange={(e) => {
                  setLearningTypeFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer"
              >
                <option value="ALL">Semua Jenis (Reguler & Blok)</option>
                <option value="REGULER">Hanya Reguler</option>
                <option value="BLOK">Hanya Blok</option>
              </select>
            </div>

            {/* Filter Tampil di Rapor */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600 dark:text-zinc-400">Rapor:</span>
              <select
                value={reportDisplayFilter}
                onChange={(e) => {
                  setReportDisplayFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer"
              >
                <option value="ALL">Semua Rapor (Tampil & Tidak)</option>
                <option value="TAMPIL_RAPOR">Hanya Tampil di Rapor</option>
                <option value="TIDAK_TAMPIL_RAPOR">Hanya Tidak Tampil</option>
              </select>
            </div>

            {/* Filter Status Aktif */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-600 dark:text-zinc-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="p-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200 cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">Hanya Aktif</option>
                <option value="INACTIVE">Hanya Nonaktif</option>
              </select>
            </div>

            {(learningTypeFilter !== "ALL" || reportDisplayFilter !== "ALL" || statusFilter !== "ALL" || searchQuery) && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setLearningTypeFilter("ALL");
                  setReportDisplayFilter("ALL");
                  setStatusFilter("ALL");
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 cursor-pointer transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Right Action Tools: Panning Controls & Export */}
          <div className="flex items-center gap-2">
            {/* Quick horizontal scroll helpers for trackpad/mouse users */}
            <div className="hidden sm:flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-xl px-2 py-1 text-[11px] text-slate-500 dark:text-zinc-400">
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-500 shrink-0 mr-0.5" />
              <span>Geser Tabel:</span>
              <button
                onClick={handleScrollLeft}
                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer"
                title="Geser ke kiri"
              >
                ◀ Kiri
              </button>
              <button
                onClick={handleScrollRight}
                className="px-1.5 py-0.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer"
                title="Geser ke kanan"
              >
                Kanan ▶
              </button>
            </div>

            {/* Export Buttons */}
            <div className="flex items-center gap-1 border border-slate-200 dark:border-zinc-750 rounded-xl px-1.5 py-1 bg-white dark:bg-zinc-900">
              <button
                onClick={handleExportExcel}
                className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor ke Excel"
              >
                <TableProperties className="h-4 w-4" />
              </button>
              <div className="w-[1px] h-4 bg-slate-200 dark:border-zinc-800" />
              <button
                onClick={handleExportPDF}
                className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor ke PDF"
              >
                <FileDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Informative Sticky Hint Badge */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 px-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
              <Lock className="w-3 h-3" />
              Frozen Columns Aktif:
            </span>
            <span>Kolom <strong>No</strong>, <strong>Kode</strong>, & <strong>Nama Mapel</strong> terkunci di kiri. Kolom <strong>Aksi</strong> terkunci di kanan.</span>
          </div>
          <div>
            Menampilkan <strong>{startEntry}-{endEntry}</strong> dari {totalItems} mata pelajaran
          </div>
        </div>

        {/* SPREADSHEET TABLE CONTAINER WITH STICKY HEADERS & FROZEN COLUMNS */}
        <div
          ref={tableContainerRef}
          className="relative overflow-x-auto overflow-y-auto max-h-[600px] border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs bg-white dark:bg-zinc-900 scrollbar-thin"
        >
          <table className="w-full text-left text-xs border-collapse min-w-[1250px]">
            {/* Table Header (Sticky Top) */}
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 font-bold select-none">
                {/* 1. Sticky Frozen No */}
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 w-[54px] min-w-[54px] max-w-[54px] px-3 py-3.5 text-center bg-slate-100 dark:bg-zinc-850 border-r border-slate-200 dark:border-zinc-800"
                >
                  No
                </th>

                {/* 2. Sticky Frozen Kode Mapel */}
                <th
                  scope="col"
                  onClick={() => handleSort("code")}
                  className="sticky left-[54px] top-0 z-30 w-[110px] min-w-[110px] max-w-[110px] px-3.5 py-3.5 bg-slate-100 dark:bg-zinc-850 border-r border-slate-200 dark:border-zinc-800 cursor-pointer hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Kode</span>
                    {sortField === "code" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 3. Sticky Frozen Nama Mapel with Right Shadow Border */}
                <th
                  scope="col"
                  onClick={() => handleSort("name")}
                  className="sticky left-[164px] top-0 z-30 min-w-[240px] max-w-[280px] px-4 py-3.5 bg-slate-100 dark:bg-zinc-850 border-r-2 border-slate-300 dark:border-zinc-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] cursor-pointer hover:bg-slate-200/70 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Nama Mata Pelajaran</span>
                    {sortField === "name" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 4. Kelompok e-Rapor (SSOT) */}
                <th
                  scope="col"
                  onClick={() => handleSort("groupType")}
                  className="min-w-[160px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Kelompok e-Rapor</span>
                    {sortField === "groupType" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 5. Jenis Pembelajaran */}
                <th
                  scope="col"
                  onClick={() => handleSort("learningType")}
                  className="min-w-[140px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Jenis Pembelajaran</span>
                    {sortField === "learningType" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 6. Tampil di Rapor */}
                <th
                  scope="col"
                  onClick={() => handleSort("reportDisplay")}
                  className="min-w-[140px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Tampil di Rapor</span>
                    {sortField === "reportDisplay" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 7. Kelompok Kurikulum */}
                <th
                  scope="col"
                  onClick={() => handleSort("group")}
                  className="min-w-[130px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Kurikulum</span>
                    {sortField === "group" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 8. KKM */}
                <th
                  scope="col"
                  onClick={() => handleSort("kkm")}
                  className="min-w-[80px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>KKM</span>
                    {sortField === "kkm" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 9. Syarat Jurnal Guru */}
                <th
                  scope="col"
                  onClick={() => handleSort("categoryType")}
                  className="min-w-[160px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Syarat Jurnal Guru</span>
                    {sortField === "categoryType" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> : <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                    ) : (
                      <div className="flex flex-col -space-y-1 opacity-30">
                        <ChevronUp className="w-2 h-2" />
                        <ChevronDown className="w-2 h-2" />
                      </div>
                    )}
                  </div>
                </th>

                {/* 10. Peruntukan Kelas Tingkat */}
                <th scope="col" className="min-w-[170px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900">
                  Kelas Tingkat
                </th>

                {/* 11. Status */}
                <th scope="col" className="min-w-[100px] px-4 py-3.5 bg-slate-50 dark:bg-zinc-900 text-center">
                  Status
                </th>

                {/* 12. Sticky Frozen Column: Aksi on Right */}
                <th
                  scope="col"
                  className="sticky right-0 top-0 z-30 w-[112px] min-w-[112px] max-w-[112px] px-3 py-3.5 text-center bg-slate-100 dark:bg-zinc-850 border-l-2 border-slate-300 dark:border-zinc-700 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)]"
                >
                  Aksi
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {paginatedSubjects.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-500 dark:text-zinc-400">
                    <p className="text-sm font-semibold">Tidak ada mata pelajaran ditemukan</p>
                    <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau reset filter di atas.</p>
                  </td>
                </tr>
              ) : (
                paginatedSubjects.map((item, idx) => {
                  const rowNumber = startIndex + idx + 1;
                  const groupType = getSubjectGroupType(item);
                  const learningType = getSubjectLearningType(item);
                  const reportDisplay = getSubjectReportDisplay(item);
                  const categoryType = getSubjectCategoryType(item);

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-blue-50/40 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* 1. Sticky Frozen No */}
                      <td className="sticky left-0 z-10 w-[54px] min-w-[54px] max-w-[54px] px-3 py-3 text-center font-mono font-semibold text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 group-hover:bg-blue-50/80 dark:group-hover:bg-zinc-850 border-r border-slate-200/80 dark:border-zinc-800 transition-colors">
                        {rowNumber}
                      </td>

                      {/* 2. Sticky Frozen Kode Mapel */}
                      <td className="sticky left-[54px] z-10 w-[110px] min-w-[110px] max-w-[110px] px-3.5 py-3 bg-white dark:bg-zinc-900 group-hover:bg-blue-50/80 dark:group-hover:bg-zinc-850 border-r border-slate-200/80 dark:border-zinc-800 transition-colors">
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
                          {item.code}
                        </span>
                      </td>

                      {/* 3. Sticky Frozen Nama Mapel with Right Shadow Border */}
                      <td className="sticky left-[164px] z-10 min-w-[240px] max-w-[280px] px-4 py-3 bg-white dark:bg-zinc-900 group-hover:bg-blue-50/80 dark:group-hover:bg-zinc-850 border-r-2 border-slate-300 dark:border-zinc-700 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] transition-colors">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={item.name}>
                          {item.name}
                        </div>
                      </td>

                      {/* 4. Kelompok e-Rapor (SSOT) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {groupType === "KEPESANTRENAN" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            KEPESANTRENAN
                          </span>
                        ) : groupType === "UMUM" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <BookOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            UMUM
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                            BELUM DISET
                          </span>
                        )}
                      </td>

                      {/* 5. Jenis Pembelajaran */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {learningType === "BLOK" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Clock className="w-3.5 h-3.5 text-purple-500" />
                            BLOK (Modular)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                            REGULER
                          </span>
                        )}
                      </td>

                      {/* 6. Tampil di Rapor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {reportDisplay === "TIDAK_TAMPIL_RAPOR" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="Tidak dicetak pada lembar Rapor">
                            <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                            Tidak Tampil
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <Eye className="w-3.5 h-3.5 text-emerald-500" />
                            Tampil di Rapor
                          </span>
                        )}
                      </td>

                      {/* 7. Kelompok Kurikulum */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-zinc-300 font-semibold">
                        {item.group === "A" ? (
                          <span className="text-blue-700 dark:text-blue-400">Group A (Wajib)</span>
                        ) : item.group === "B" ? (
                          <span className="text-amber-700 dark:text-amber-400">Group B (Pondok)</span>
                        ) : (
                          <span className="text-slate-600 dark:text-zinc-400">Group C (Mulok)</span>
                        )}
                      </td>

                      {/* 8. KKM */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                        {item.kkm}
                      </td>

                      {/* 9. Syarat Jurnal Guru */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {categoryType === "diniyah_pondok" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md">
                            Diniyah (Langsung)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md">
                            Wajib Prota & Prosem
                          </span>
                        )}
                      </td>

                      {/* 10. Kelas Tingkat */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-zinc-400 text-xs">
                        {formatGrades(item)}
                      </td>

                      {/* 11. Status */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        {item.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-300 dark:border-zinc-750 rounded-full">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Nonaktif
                          </span>
                        )}
                      </td>

                      {/* 12. Sticky Frozen Column: Aksi on Right with Left Shadow Border */}
                      <td className="sticky right-0 z-10 w-[112px] min-w-[112px] max-w-[112px] px-2 py-3 text-center bg-white dark:bg-zinc-900 group-hover:bg-blue-50/80 dark:group-hover:bg-zinc-850 border-l-2 border-slate-300 dark:border-zinc-700 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.08)] dark:shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.4)] transition-colors">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleStatusMutation.mutate({ id: item.id, activate: item.isActive === false })}
                            disabled={toggleStatusMutation.isPending}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              item.isActive === false
                                ? "text-emerald-600 hover:bg-emerald-100/70 dark:hover:bg-emerald-950/60 dark:text-emerald-400"
                                : "text-slate-400 hover:text-amber-600 hover:bg-amber-100/70 dark:hover:bg-amber-950/60 dark:hover:text-amber-400"
                            }`}
                            title={item.isActive === false ? `Aktifkan Mapel: ${item.name}` : `Nonaktifkan Mapel: ${item.name}`}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditOpen(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-100/70 dark:hover:bg-blue-950/60 dark:hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                            title={`Edit Mapel: ${item.name}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOpen(item)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-100/70 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title={`Hapus Mapel: ${item.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Rows-Per-Page Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center text-xs text-slate-500 dark:text-zinc-400 pt-2">
          <div className="flex items-center gap-3">
            <span>
              Menampilkan <strong>{startEntry}</strong>-<strong>{endEntry}</strong> dari <strong>{totalItems}</strong> Mapel
            </span>
            <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-zinc-800 pl-3">
              <span>Per halaman:</span>
              <select
                className="px-2 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {[10, 15, 25, 50, 100].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} Baris
                  </option>
                ))}
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={adjustedCurrentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Halaman sebelumnya"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  totalPages > 5 &&
                  page !== 1 &&
                  page !== totalPages &&
                  Math.abs(page - adjustedCurrentPage) > 1
                ) {
                  if (page === 2 || page === totalPages - 1) {
                    return <span key={page} className="px-1 text-slate-400">...</span>;
                  }
                  return null;
                }

                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[30px] h-7 flex items-center justify-center rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                      adjustedCurrentPage === page
                        ? "bg-blue-600 border-blue-600 text-white dark:bg-blue-500 dark:border-blue-500"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={adjustedCurrentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors cursor-pointer"
                title="Halaman berikutnya"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </div>
      </div>

      {/* Modal Tambah Mapel */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Mata Pelajaran Baru"
        size="md"
      >
        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Kode Mata Pelajaran"
              placeholder="E.g., MAPEL-IND"
              required
              register={createForm.register("code")}
              error={createForm.formState.errors.code?.message}
            />
            <FormInput
              label="Nama Mata Pelajaran"
              placeholder="E.g., Bahasa Indonesia"
              required
              register={createForm.register("name")}
              error={createForm.formState.errors.name?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Kelompok e-Rapor (SSOT)"
              options={[
                { value: "UMUM", label: "Mata Pelajaran UMUM" },
                { value: "KEPESANTRENAN", label: "Mata Pelajaran KEPESANTRENAN" }
              ]}
              required
              register={createForm.register("subjectType")}
              error={createForm.formState.errors.subjectType?.message}
            />
            <FormSelect
              label="Kelompok Kurikulum (Group)"
              options={[
                { value: "A", label: "Group A (Wajib Umum)" },
                { value: "B", label: "Group B (Kepesantrenan)" },
                { value: "C", label: "Group C (Muatan Lokal)" }
              ]}
              required
              register={createForm.register("group")}
              error={createForm.formState.errors.group?.message}
            />
          </div>

          {/* Configurations: Jenis Pembelajaran & Status Tampil di Rapor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <FormSelect
              label="Jenis Pembelajaran"
              options={[
                { value: "REGULER", label: "REGULER (Rutin sepanjang semester)" },
                { value: "BLOK", label: "BLOK (Periode tertentu / modular)" }
              ]}
              required
              register={createForm.register("learningType")}
              error={createForm.formState.errors.learningType?.message}
            />
            <FormSelect
              label="Status Tampil di Rapor"
              options={[
                { value: "TAMPIL_RAPOR", label: "TAMPIL RAPOR (Muncul pada cetakan rapor)" },
                { value: "TIDAK_TAMPIL_RAPOR", label: "TIDAK TAMPIL (Hanya jadwal / internal)" }
              ]}
              required
              register={createForm.register("reportDisplay")}
              error={createForm.formState.errors.reportDisplay?.message}
            />
          </div>

          <div>
            <FormInput
              label="KKM Kelulusan"
              type="number"
              placeholder="75"
              required
              register={createForm.register("kkm")}
              error={createForm.formState.errors.kkm?.message}
            />
          </div>

          <GradeCheckboxes register={createForm.register} error={createForm.formState.errors.grades?.message} />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan Mapel"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Modal Edit Mapel */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Mata Pelajaran"
        size="md"
      >
        {/* Context Banner: Display which subject is being edited */}
        {selectedSubject && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-zinc-400 block font-medium">Sedang Mengedit Konfigurasi:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                [{selectedSubject.code}] {selectedSubject.name}
              </span>
            </div>
          </div>
        )}

        <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Kode Mata Pelajaran"
              placeholder="E.g., MAPEL-IND"
              required
              register={editForm.register("code")}
              error={editForm.formState.errors.code?.message}
            />
            <FormInput
              label="Nama Mata Pelajaran"
              placeholder="E.g., Bahasa Indonesia"
              required
              register={editForm.register("name")}
              error={editForm.formState.errors.name?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Kelompok e-Rapor (SSOT)"
              options={[
                { value: "UMUM", label: "Mata Pelajaran UMUM" },
                { value: "KEPESANTRENAN", label: "Mata Pelajaran KEPESANTRENAN" }
              ]}
              required
              register={editForm.register("subjectType")}
              error={editForm.formState.errors.subjectType?.message}
            />
            <FormSelect
              label="Kelompok Kurikulum (Group)"
              options={[
                { value: "A", label: "Group A (Wajib Umum)" },
                { value: "B", label: "Group B (Kepesantrenan)" },
                { value: "C", label: "Group C (Muatan Lokal)" }
              ]}
              required
              register={editForm.register("group")}
              error={editForm.formState.errors.group?.message}
            />
          </div>

          {/* Configurations: Jenis Pembelajaran & Status Tampil di Rapor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <FormSelect
              label="Jenis Pembelajaran"
              options={[
                { value: "REGULER", label: "REGULER (Rutin sepanjang semester)" },
                { value: "BLOK", label: "BLOK (Periode tertentu / modular)" }
              ]}
              required
              register={editForm.register("learningType")}
              error={editForm.formState.errors.learningType?.message}
            />
            <FormSelect
              label="Status Tampil di Rapor"
              options={[
                { value: "TAMPIL_RAPOR", label: "TAMPIL RAPOR (Muncul pada cetakan rapor)" },
                { value: "TIDAK_TAMPIL_RAPOR", label: "TIDAK TAMPIL (Hanya jadwal / internal)" }
              ]}
              required
              register={editForm.register("reportDisplay")}
              error={editForm.formState.errors.reportDisplay?.message}
            />
          </div>

          <div>
            <FormInput
              label="KKM Kelulusan"
              type="number"
              placeholder="75"
              required
              register={editForm.register("kkm")}
              error={editForm.formState.errors.kkm?.message}
            />
          </div>

          <GradeCheckboxes register={editForm.register} error={editForm.formState.errors.grades?.message} />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {updateMutation.isPending ? "Memperbarui..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Modal Delete */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus / Nonaktifkan Mata Pelajaran"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-zinc-300 leading-relaxed">
            Anda memilih mata pelajaran{" "}
            <strong className="text-gray-900 dark:text-white font-bold">
              {selectedSubject?.name} ({selectedSubject?.code})
            </strong>
            .
          </p>

          {usageCheck.loading ? (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <span>Memeriksa keterikatan data mapel pada jadwal, kurikulum, modul ajar, dan e-rapor...</span>
            </div>
          ) : usageCheck.inUse ? (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Mata Pelajaran Sedang Digunakan</span>
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                Mata pelajaran ini memiliki relasi aktif di:{" "}
                <strong>{usageCheck.reasons.join(", ")}</strong>.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400/80 leading-relaxed">
                Untuk melindungi keutuhan riwayat nilai siswa dan jadwal sebelumnya, sistem merekomendasikan <strong>Nonaktifkan (Soft-Delete)</strong> agar mapel tidak muncul di pilihan baru tanpa merusak data lampau.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Mata pelajaran ini belum terikat pada jadwal, kurikulum, ataupun rapor. Aman dihapus secara permanen.</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>

            {usageCheck.inUse ? (
              <>
                <button
                  type="button"
                  onClick={() => handleDeleteConfirm(true)}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Hapus permanen dokumen dari database (tidak disarankan)"
                >
                  {deleteMutation.isPending ? "Memproses..." : "Hapus Paksa"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteConfirm(false)}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Power className="w-3.5 h-3.5" />
                  {deleteMutation.isPending ? "Memproses..." : "Nonaktifkan Mapel (Aman)"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Permanen"}
              </button>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Subjects;
