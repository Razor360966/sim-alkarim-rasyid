import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { subjectService } from "../services/subjectService";
import { teacherService } from "../services/teacherService";
import { CurriculumMatrix, Subject, Teacher } from "../types";
import { Loading } from "../components/Loading";
import { Dialog } from "../components/Dialog";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Search, 
  ChevronDown, 
  Check, 
  X, 
  AlertCircle, 
  School, 
  FileDown, 
  TableProperties, 
  Save, 
  HelpCircle,
  AlertTriangle
} from "lucide-react";

// ==========================================
// Custom Searchable Teacher Dropdown Component
// ==========================================
interface TeacherDropdownProps {
  currentTeacherId: string;
  currentTeacherName: string;
  teachers: Teacher[];
  onSelect: (id: string, name: string) => void;
  disabled?: boolean;
}

const TeacherDropdown: React.FC<TeacherDropdownProps> = ({
  currentTeacherId,
  currentTeacherName,
  teachers,
  onSelect,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const query = searchQuery.toLowerCase().trim();
    return teachers.filter(t => {
      const fullName = `${t.frontTitle ? t.frontTitle + " " : ""}${t.name || ""}${t.backTitle ? ", " + t.backTitle : ""}`.toLowerCase();
      const nick = (t.nickName || "").toLowerCase();
      const niy = (t.niy || "").toLowerCase();
      return fullName.includes(query) || nick.includes(query) || niy.includes(query);
    });
  }, [teachers, searchQuery]);

  const displayName = useMemo(() => {
    if (!currentTeacherId) return "";
    const found = teachers.find(t => t.id === currentTeacherId);
    if (found) {
      return `${found.frontTitle ? found.frontTitle + " " : ""}${found.name}${found.backTitle ? ", " + found.backTitle : ""}`;
    }
    return currentTeacherName || "Guru tidak ditemukan";
  }, [currentTeacherId, currentTeacherName, teachers]);

  const handleSelect = (t: Teacher) => {
    const nameWithTitles = `${t.frontTitle ? t.frontTitle + " " : ""}${t.name}${t.backTitle ? ", " + t.backTitle : ""}`;
    onSelect(t.id, nameWithTitles);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-zinc-900 border rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer ${
          !currentTeacherId 
            ? "border-amber-300 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/5 hover:border-amber-400" 
            : "border-gray-200 dark:border-zinc-850 text-gray-700 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-750"
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        <span className="truncate flex items-center gap-1.5">
          {!currentTeacherId && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
          {displayName || <span className="italic text-gray-400 dark:text-zinc-500 font-normal">Pilih Guru Pengampu...</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 dark:text-zinc-500 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 left-0 mt-1.5 bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-60">
          <div className="p-2 border-b border-gray-100 dark:border-zinc-850 shrink-0 flex items-center gap-1.5 bg-gray-50/50 dark:bg-zinc-900/50">
            <Search className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500 shrink-0" />
            <input
              type="text"
              placeholder="Cari guru pengampu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 outline-none p-0.5 text-xs text-gray-800 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 font-medium focus:ring-0"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {filteredTeachers.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400 dark:text-zinc-500 italic">
                Guru tidak ditemukan
              </div>
            ) : (
              filteredTeachers.map((t) => {
                const fullName = `${t.frontTitle ? t.frontTitle + " " : ""}${t.name}${t.backTitle ? ", " + t.backTitle : ""}`;
                const isSelected = t.id === currentTeacherId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelect(t)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/25 text-blue-600 dark:text-blue-400"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-850/50 text-gray-700 dark:text-zinc-300"
                    }`}
                  >
                    <div className="truncate">
                      <div>{fullName}</div>
                      <div className="text-[10px] text-gray-400 dark:text-zinc-500 font-medium mt-0.5">NIY: {t.niy} {t.nickName ? `• "${t.nickName}"` : ""}</div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};


const DEFAULT_EMPTY_ARRAY: any[] = [];

// ==========================================
// Main Page Component: CurriculumMatrix
// ==========================================
export const CurriculumMatrixPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CurriculumMatrix | null>(null);
  const [newSubjectId, setNewSubjectId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  // Queries
  const { data: matrixItems = DEFAULT_EMPTY_ARRAY, isLoading: isLoadingMatrix } = useQuery({
    queryKey: ["curriculum_matrix"],
    queryFn: curriculumMatrixService.getCurriculumMatrix
  });

  const { data: subjects = DEFAULT_EMPTY_ARRAY, isLoading: isLoadingSubjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: subjectService.getSubjects
  });

  const { data: teachers = DEFAULT_EMPTY_ARRAY, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: teacherService.getTeachers
  });

  const isLoading = isLoadingMatrix || isLoadingSubjects || isLoadingTeachers;

  // Keep a local copy of matrix data for rapid and optimistic updates / rollback
  const [localMatrix, setLocalMatrix] = useState<CurriculumMatrix[]>([]);

  // Keep local state in sync when query data loads/updates
  useEffect(() => {
    if (matrixItems) {
      setLocalMatrix(matrixItems);
    }
  }, [matrixItems]);

  // Mutations
  const addSubjectMutation = useMutation({
    mutationFn: ({ subId, subName }: { subId: string; subName: string }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.addSubjectToCurriculum(
        subId,
        subName,
        "",
        "",
        user.uid,
        user.displayName || user.email || "Admin"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curriculum_matrix"] });
      toast("Mata pelajaran ditambahkan ke struktur kurikulum!", "success");
      setNewSubjectId("");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menambahkan mata pelajaran", "error");
    }
  });

  const updateJPMutation = useMutation({
    mutationFn: ({ 
      id, 
      grades, 
      subjectName 
    }: { 
      id: string; 
      grades: { jp_vii?: number; jp_viii?: number; jp_ix?: number }; 
      subjectName: string;
    }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.updateJP(
        id,
        grades,
        user.uid,
        user.displayName || user.email || "Admin",
        subjectName
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<CurriculumMatrix[]>(["curriculum_matrix"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                ...variables.grades,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        );
      });
      setLocalMatrix((prev) =>
        prev.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                ...variables.grades,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        )
      );
    },
    onError: (err: any, variables) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui JP", "error");
      // Rollback local state
      if (matrixItems) {
        setLocalMatrix(matrixItems);
      }
    }
  });

  const assignTeacherMutation = useMutation({
    mutationFn: ({ 
      id, 
      teacherId, 
      teacherName, 
      subjectName 
    }: { 
      id: string; 
      teacherId: string; 
      teacherName: string; 
      subjectName: string;
    }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.assignTeacher(
        id,
        teacherId,
        teacherName,
        user.uid,
        user.displayName || user.email || "Admin",
        subjectName
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<CurriculumMatrix[]>(["curriculum_matrix"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                teacherId: variables.teacherId,
                teacherName: variables.teacherName,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        );
      });
      setLocalMatrix((prev) =>
        prev.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                teacherId: variables.teacherId,
                teacherName: variables.teacherName,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        )
      );
      toast("Guru pengampu berhasil ditugaskan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menugaskan guru pengampu", "error");
      // Rollback local state
      if (matrixItems) {
        setLocalMatrix(matrixItems);
      }
    }
  });

  const assignTeacherForGradeMutation = useMutation({
    mutationFn: ({ 
      id, 
      grade, 
      teacherId, 
      teacherName, 
      subjectName 
    }: { 
      id: string; 
      grade: "vii" | "viii" | "ix"; 
      teacherId: string; 
      teacherName: string; 
      subjectName: string;
    }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.assignTeacherForGrade(
        id,
        grade,
        teacherId,
        teacherName,
        user.uid,
        user.displayName || user.email || "Admin",
        subjectName
      );
    },
    onSuccess: (_data, variables) => {
      const fieldId = `teacherId_${variables.grade}` as const;
      const fieldName = `teacherName_${variables.grade}` as const;
      queryClient.setQueryData<CurriculumMatrix[]>(["curriculum_matrix"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                [fieldId]: variables.teacherId,
                [fieldName]: variables.teacherName,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        );
      });
      setLocalMatrix((prev) =>
        prev.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                [fieldId]: variables.teacherId,
                [fieldName]: variables.teacherName,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        )
      );
      toast(`Guru Kelas ${variables.grade.toUpperCase()} berhasil ditugaskan!`, "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menugaskan guru pengampu jenjang", "error");
      if (matrixItems) {
        setLocalMatrix(matrixItems);
      }
    }
  });

  const toggleDifferentTeachersMutation = useMutation({
    mutationFn: ({ 
      id, 
      useDifferentTeachers, 
      subjectName 
    }: { 
      id: string; 
      useDifferentTeachers: boolean; 
      subjectName: string;
    }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.toggleDifferentTeachers(
        id,
        useDifferentTeachers,
        user.uid,
        user.displayName || user.email || "Admin",
        subjectName
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<CurriculumMatrix[]>(["curriculum_matrix"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                useDifferentTeachers: variables.useDifferentTeachers,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        );
      });
      setLocalMatrix((prev) =>
        prev.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                useDifferentTeachers: variables.useDifferentTeachers,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        )
      );
      toast(variables.useDifferentTeachers ? "Opsi guru berbeda tiap jenjang diaktifkan!" : "Opsi guru berbeda tiap jenjang dinonaktifkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mengubah metode guru", "error");
      if (matrixItems) {
        setLocalMatrix(matrixItems);
      }
    }
  });

  const removeSubjectMutation = useMutation({
    mutationFn: ({ id, subjectName }: { id: string; subjectName: string }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.removeSubjectFromCurriculum(
        id,
        subjectName,
        user.uid,
        user.displayName || user.email || "Admin"
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["curriculum_matrix"] });
      toast("Mapel berhasil dihapus dari kurikulum!", "success");
      setIsDeleteOpen(false);
      setSelectedItem(null);
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus data", "error");
    }
  });

  // Calculate remaining subjects that haven't been added to curriculum_matrix
  const availableSubjects = useMemo(() => {
    const addedSubjectIds = new Set(matrixItems.map(m => m.subjectId));
    return subjects.filter(s => !addedSubjectIds.has(s.id));
  }, [subjects, matrixItems]);

  // Handle Add Form Submission
  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectId) {
      toast("Silakan pilih mata pelajaran terlebih dahulu!", "warning");
      return;
    }

    const selectedSub = subjects.find(s => s.id === newSubjectId);
    if (selectedSub) {
      addSubjectMutation.mutate({ subId: selectedSub.id, subName: selectedSub.name });
    }
  };

  // Inline JP editing with instant auto-save on blur or enter key
  const handleJPChange = (id: string, gradeKey: "jp_vii" | "jp_viii" | "jp_ix", valStr: string, subjectName: string) => {
    // If empty or invalid, fallback to 0
    let numericValue = parseInt(valStr, 10);
    if (isNaN(numericValue) || numericValue < 0) {
      numericValue = 0;
    }

    // Compare against the original query result, not optimistic local state.
    const originalItem = matrixItems.find(m => m.id === id);
    if (originalItem && originalItem[gradeKey] === numericValue) {
      return; // No change compared to persisted data, skip database call
    }

    // Optimistically update local state for zero-latency feel
    setLocalMatrix(prev =>
      prev.map(m => (m.id === id ? { ...m, [gradeKey]: numericValue } : m))
    );

    // Call mutation to update Firestore
    updateJPMutation.mutate({
      id,
      grades: { [gradeKey]: numericValue },
      subjectName
    });
  };

  const updateOrderMutation = useMutation({
    mutationFn: ({ 
      id, 
      order, 
      subjectName 
    }: { 
      id: string; 
      order: number; 
      subjectName: string;
    }) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi!");
      return curriculumMatrixService.updateOrder(
        id,
        order,
        user.uid,
        user.displayName || user.email || "Admin",
        subjectName
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<CurriculumMatrix[]>(["curriculum_matrix"], (old) => {
        if (!old) return old;
        return old.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                order: variables.order,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        );
      });
      setLocalMatrix((prev) =>
        prev.map((item) =>
          item.id === variables.id
            ? {
                ...item,
                order: variables.order,
                updatedAt: new Date().toISOString(),
                updatedBy: user?.uid || item.updatedBy
              }
            : item
        )
      );
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui urutan", "error");
      if (matrixItems) {
        setLocalMatrix(matrixItems);
      }
    }
  });

  const handleOrderChange = (id: string, valStr: string, subjectName: string) => {
    let numericValue = parseInt(valStr, 10);
    if (isNaN(numericValue) || numericValue < 0) {
      numericValue = 0;
    }

    const originalItem = matrixItems.find(m => m.id === id);
    if (originalItem && originalItem.order === numericValue) {
      return; 
    }

    setLocalMatrix(prev =>
      prev.map(m => (m.id === id ? { ...m, order: numericValue } : m))
    );

    updateOrderMutation.mutate({
      id,
      order: numericValue,
      subjectName
    });
  };

  // Handle Teacher Select Dropdown
  const handleTeacherSelect = (id: string, teacherId: string, teacherName: string, subjectName: string) => {
    // Optimistically update
    setLocalMatrix(prev =>
      prev.map(m => (m.id === id ? { ...m, teacherId, teacherName } : m))
    );

    // Call mutation
    assignTeacherMutation.mutate({
      id,
      teacherId,
      teacherName,
      subjectName
    });
  };

  const handleTeacherForGradeSelect = (
    id: string, 
    grade: "vii" | "viii" | "ix", 
    teacherId: string, 
    teacherName: string, 
    subjectName: string
  ) => {
    const fieldId = `teacherId_${grade}`;
    const fieldName = `teacherName_${grade}`;
    setLocalMatrix(prev =>
      prev.map(m => (m.id === id ? { ...m, [fieldId]: teacherId, [fieldName]: teacherName } : m))
    );
    assignTeacherForGradeMutation.mutate({ id, grade, teacherId, teacherName, subjectName });
  };

  const handleDifferentTeachersToggle = (id: string, useDifferentTeachers: boolean, subjectName: string) => {
    setLocalMatrix(prev =>
      prev.map(m => (m.id === id ? { ...m, useDifferentTeachers } : m))
    );
    toggleDifferentTeachersMutation.mutate({ id, useDifferentTeachers, subjectName });
  };

  // Delete Confirm Action
  const handleDeleteOpen = (item: CurriculumMatrix) => {
    setSelectedItem(item);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedItem) {
      removeSubjectMutation.mutate({ id: selectedItem.id, subjectName: selectedItem.subjectName });
    }
  };

  // Helper to determine the category of a matrix item
  const getCategory = (item: CurriculumMatrix, subjectsList: Subject[]) => {
    const subjectDetail = subjectsList.find(s => s.id === item.subjectId);
    return subjectDetail?.group === "B" ? "Kepesantrenan" : "Umum";
  };

  // Filter local matrix by search input
  const filteredLocalMatrix = useMemo(() => {
    if (!searchKeyword.trim()) return localMatrix;
    const query = searchKeyword.toLowerCase().trim();
    return localMatrix.filter(item => {
      const subjectDetail = subjects.find(s => s.id === item.subjectId);
      const code = subjectDetail ? (subjectDetail.code || "").toLowerCase() : "";

      return (
        item.subjectName.toLowerCase().includes(query) ||
        code.includes(query) ||
        (item.teacherName || "").toLowerCase().includes(query)
      );
    });
  }, [localMatrix, searchKeyword, subjects]);

  // General subjects (Group A and Group C, meaning group !== "B")
  const umumMatrix = useMemo(() => {
    return filteredLocalMatrix
      .filter((item) => {
        const subjectDetail = subjects.find(s => s.id === item.subjectId);
        return !subjectDetail || subjectDetail.group !== "B";
      })
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 0;
        const orderB = typeof b.order === "number" ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.subjectName.localeCompare(b.subjectName);
      });
  }, [filteredLocalMatrix, subjects]);

  // Kepesantrenan subjects (Group B, meaning group === "B")
  const kepesantrenanMatrix = useMemo(() => {
    return filteredLocalMatrix
      .filter((item) => {
        const subjectDetail = subjects.find(s => s.id === item.subjectId);
        return subjectDetail && subjectDetail.group === "B";
      })
      .sort((a, b) => {
        const orderA = typeof a.order === "number" ? a.order : 0;
        const orderB = typeof b.order === "number" ? b.order : 0;
        if (orderA !== orderB) return orderA - orderB;
        return a.subjectName.localeCompare(b.subjectName);
      });
  }, [filteredLocalMatrix, subjects]);

  // Totals calculations for Umum
  const totalJP_umum = useMemo(() => {
    return umumMatrix.reduce(
      (acc, curr) => {
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [umumMatrix]);

  // Totals calculations for Kepesantrenan
  const totalJP_kepesantrenan = useMemo(() => {
    return kepesantrenanMatrix.reduce(
      (acc, curr) => {
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [kepesantrenanMatrix]);

  // Combined totals
  const totalJP = useMemo(() => {
    return filteredLocalMatrix.reduce(
      (acc, curr) => {
        acc.vii += curr.jp_vii || 0;
        acc.viii += curr.jp_viii || 0;
        acc.ix += curr.jp_ix || 0;
        return acc;
      },
      { vii: 0, viii: 0, ix: 0 }
    );
  }, [filteredLocalMatrix]);

  // Export to Excel Handler
  const handleExportExcel = () => {
    const sortedAllItems = [...filteredLocalMatrix].sort((a, b) => {
      const catA = getCategory(a, subjects);
      const catB = getCategory(b, subjects);
      if (catA !== catB) {
        return catA === "Umum" ? -1 : 1;
      }
      const orderA = typeof a.order === "number" ? a.order : 0;
      const orderB = typeof b.order === "number" ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.subjectName.localeCompare(b.subjectName);
    });

    const formatted = sortedAllItems.map((item, index) => {
      const subjectDetail = subjects.find(s => s.id === item.subjectId);
      const category = getCategory(item, subjects);
      return {
        "No": index + 1,
        "Kategori": category,
        "Urutan": typeof item.order === "number" ? item.order : 0,
        "Kode Mata Pelajaran": subjectDetail ? subjectDetail.code : "-",
        "Nama Mata Pelajaran": item.subjectName,
        "JP Kelas VII": item.jp_vii,
        "JP Kelas VIII": item.jp_viii,
        "JP Kelas IX": item.jp_ix,
        "Total JP Mapel": item.jp_vii + item.jp_viii + item.jp_ix,
        "Guru Pengampu": item.teacherName || "Belum Ditentukan"
      };
    });

    // Add totals row at the end
    formatted.push({
      "No": "TOTAL",
      "Kategori": "",
      "Urutan": "",
      "Kode Mata Pelajaran": "",
      "Nama Mata Pelajaran": "Total JP / Minggu",
      "JP Kelas VII": totalJP.vii,
      "JP Kelas VIII": totalJP.viii,
      "JP Kelas IX": totalJP.ix,
      "Total JP Mapel": totalJP.vii + totalJP.viii + totalJP.ix,
      "Guru Pengampu": ""
    } as any);

    exportToExcel(formatted, "Struktur_Kurikulum_SMP_Alkarim", "Matriks Kurikulum");
    toast("Excel berhasil diunduh!", "success");
  };

  // Export to PDF Handler
  const handleExportPDF = () => {
    const sortedAllItems = [...filteredLocalMatrix].sort((a, b) => {
      const catA = getCategory(a, subjects);
      const catB = getCategory(b, subjects);
      if (catA !== catB) {
        return catA === "Umum" ? -1 : 1;
      }
      const orderA = typeof a.order === "number" ? a.order : 0;
      const orderB = typeof b.order === "number" ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.subjectName.localeCompare(b.subjectName);
    });

    const headers = ["No", "Kategori", "Urut", "Mata Pelajaran", "VII JP", "VIII JP", "IX JP", "Guru Pengampu"];
    const rows = sortedAllItems.map((item, index) => {
      const subjectDetail = subjects.find(s => s.id === item.subjectId);
      const label = subjectDetail ? `[${subjectDetail.code}] ${item.subjectName}` : item.subjectName;
      const category = getCategory(item, subjects);
      return [
        String(index + 1),
        category,
        String(typeof item.order === "number" ? item.order : 0),
        label,
        `${item.jp_vii} JP`,
        `${item.jp_viii} JP`,
        `${item.jp_ix} JP`,
        item.teacherName || "-"
      ];
    });

    // Add totals row
    rows.push([
      "T",
      "Total",
      "",
      "Total JP / Minggu",
      `${totalJP.vii} JP`,
      `${totalJP.viii} JP`,
      `${totalJP.ix} JP`,
      "-"
    ]);

    exportToPDF("STRUKTUR MATRIKS KURIKULUM (JP)", headers, rows, "Struktur_Kurikulum_SMP_Alkarim");
    toast("PDF berhasil diunduh!", "success");
  };

  if (isLoading) {
    return <Loading variant="full" text="Memuat struktur kurikulum SMP..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans w-full">
      
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 dark:border-zinc-850 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2.5">
            <School className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Struktur Kurikulum (Matrix View)
          </h1>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Lihat, edit JP, dan pasang guru pengampu untuk seluruh mata pelajaran secara langsung dalam satu tabel matriks terintegrasi.
          </p>
        </div>
        
        {/* Export Buttons */}
        <div className="flex items-center gap-2 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1.5 bg-white dark:bg-zinc-900 shadow-xs">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
            title="Ekspor ke Excel"
          >
            <TableProperties className="h-4 w-4" />
            <span>Excel</span>
          </button>
          <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-800" />
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Ekspor ke PDF"
          >
            <FileDown className="h-4 w-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* UNIFIED MATRIX TABLE */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full max-h-[650px] scrollbar-thin">
          <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
            <colgroup><col className="w-[8%]" /><col className="w-[32%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[12%]" /><col className="w-[18%]" /><col className="w-[6%]" /></colgroup>
            <thead className="sticky top-0 z-20 shadow-xs">
              <tr className="bg-slate-900 dark:bg-zinc-950 text-white text-[11px] font-bold uppercase tracking-wider border-b border-slate-800">
                <th className="px-3 py-3.5 text-center">Urutan</th>
                <th className="px-5 py-3.5 text-left">Nama Mata Pelajaran (Master)</th>
                <th className="px-3 py-3.5 text-center">VII ({totalJP.vii} JP)</th>
                <th className="px-3 py-3.5 text-center">VIII ({totalJP.viii} JP)</th>
                <th className="px-3 py-3.5 text-center">IX ({totalJP.ix} JP)</th>
                <th className="px-5 py-3.5 text-left">Guru Pengampu</th>
                <th className="px-4 py-3.5 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-zinc-850/70 text-xs font-semibold text-gray-700 dark:text-zinc-300">
              {filteredLocalMatrix.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="max-w-md mx-auto flex flex-col items-center justify-center space-y-3">
                      <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-zinc-900 flex items-center justify-center text-slate-400 dark:text-zinc-600">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="text-sm font-bold text-gray-800 dark:text-zinc-200">
                        Belum Ada Struktur Kurikulum
                      </div>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 leading-relaxed font-medium">
                        {searchKeyword 
                          ? "Silakan periksa kembali kata kunci pencarian Anda." 
                          : "Gunakan panel di bawah untuk menambahkan mata pelajaran ke struktur."
                        }
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {/* CATEGORY SUB-HEADER: KEPESANTRENAN */}
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

                  {kepesantrenanMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-6 text-center text-gray-400 dark:text-zinc-500 italic font-medium">
                        Tidak ada mata pelajaran kepesantrenan
                      </td>
                    </tr>
                  ) : (
                    kepesantrenanMatrix.map((item) => {
                      const subjectDetail = subjects.find(s => s.id === item.subjectId);
                      const groupColors = { 
                        A: "text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400", 
                        B: "text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400", 
                        C: "text-purple-700 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400" 
                      };
                      const groupLabels = { A: "A (Umum)", B: "B (Kepesantrenan)", C: "C (Mulok)" };

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.order === 0 ? "" : item.order}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, order: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleOrderChange(item.id, e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1 pr-4">
                              <span className="font-extrabold text-gray-800 dark:text-zinc-100 truncate">{item.subjectName}</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-tight">
                                  {subjectDetail ? subjectDetail.code : "N/A"}
                                </span>
                                <span className="text-[10px] text-gray-400">•</span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md ${subjectDetail ? groupColors[subjectDetail.group] : "bg-gray-100 text-gray-500"}`}>
                                  Grup {subjectDetail ? groupLabels[subjectDetail.group] : "N/A"}
                                </span>
                                {subjectDetail && (
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

                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.jp_vii === 0 ? "" : item.jp_vii}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, jp_vii: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleJPChange(item.id, "jp_vii", e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.jp_viii === 0 ? "" : item.jp_viii}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, jp_viii: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleJPChange(item.id, "jp_viii", e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.jp_ix === 0 ? "" : item.jp_ix}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, jp_ix: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleJPChange(item.id, "jp_ix", e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="w-full space-y-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <input
                                  type="checkbox"
                                  id={`diff-teachers-${item.id}`}
                                  checked={!!item.useDifferentTeachers}
                                  onChange={(e) => handleDifferentTeachersToggle(item.id, e.target.checked, item.subjectName)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label
                                  htmlFor={`diff-teachers-${item.id}`}
                                  className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 cursor-pointer select-none"
                                >
                                  Guru Berbeda Tiap Jenjang
                                </label>
                              </div>

                              {!item.useDifferentTeachers ? (
                                <TeacherDropdown
                                  currentTeacherId={item.teacherId}
                                  currentTeacherName={item.teacherName}
                                  teachers={teachers}
                                  onSelect={(tId, tName) => handleTeacherSelect(item.id, tId, tName, item.subjectName)}
                                />
                              ) : (
                                <div className="space-y-1.5 border border-dashed border-gray-200 dark:border-zinc-850 p-2 rounded-xl bg-gray-50/50 dark:bg-zinc-950/10">
                                  {(item.jp_vii ?? 0) > 0 && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Kelas VII</span>
                                      <TeacherDropdown
                                        currentTeacherId={item.teacherId_vii || ""}
                                        currentTeacherName={item.teacherName_vii || ""}
                                        teachers={teachers}
                                        onSelect={(tId, tName) => handleTeacherForGradeSelect(item.id, "vii", tId, tName, item.subjectName)}
                                      />
                                    </div>
                                  )}
                                  {(item.jp_viii ?? 0) > 0 && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">Kelas VIII</span>
                                      <TeacherDropdown
                                        currentTeacherId={item.teacherId_viii || ""}
                                        currentTeacherName={item.teacherName_viii || ""}
                                        teachers={teachers}
                                        onSelect={(tId, tName) => handleTeacherForGradeSelect(item.id, "viii", tId, tName, item.subjectName)}
                                      />
                                    </div>
                                  )}
                                  {(item.jp_ix ?? 0) > 0 && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400">Kelas IX</span>
                                      <TeacherDropdown
                                        currentTeacherId={item.teacherId_ix || ""}
                                        currentTeacherName={item.teacherName_ix || ""}
                                        teachers={teachers}
                                        onSelect={(tId, tName) => handleTeacherForGradeSelect(item.id, "ix", tId, tName, item.subjectName)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteOpen(item)}
                              className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-zinc-850 rounded-xl transition-all cursor-pointer"
                              title="Hapus dari struktur kurikulum"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {/* CATEGORY SUB-HEADER: UMUM */}
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

                  {umumMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-6 text-center text-gray-400 dark:text-zinc-500 italic font-medium">
                        Tidak ada mata pelajaran umum
                      </td>
                    </tr>
                  ) : (
                    umumMatrix.map((item) => {
                      const subjectDetail = subjects.find(s => s.id === item.subjectId);
                      const groupColors = { 
                        A: "text-blue-700 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400", 
                        B: "text-amber-700 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400", 
                        C: "text-purple-700 bg-purple-50 dark:bg-purple-950/20 dark:text-purple-400" 
                      };
                      const groupLabels = { A: "A (Umum)", B: "B (Kepesantrenan)", C: "C (Mulok)" };

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.order === 0 ? "" : item.order}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, order: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleOrderChange(item.id, e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1 pr-4">
                              <span className="font-extrabold text-gray-800 dark:text-zinc-100 truncate">{item.subjectName}</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-tight">
                                  {subjectDetail ? subjectDetail.code : "N/A"}
                                </span>
                                <span className="text-[10px] text-gray-400">•</span>
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-md ${subjectDetail ? groupColors[subjectDetail.group] : "bg-gray-100 text-gray-500"}`}>
                                  Grup {subjectDetail ? groupLabels[subjectDetail.group] : "N/A"}
                                </span>
                                {subjectDetail && (
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

                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.jp_vii === 0 ? "" : item.jp_vii}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, jp_vii: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleJPChange(item.id, "jp_vii", e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.jp_viii === 0 ? "" : item.jp_viii}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, jp_viii: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleJPChange(item.id, "jp_viii", e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-3 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="number"
                                min="0"
                                placeholder="0"
                                value={item.jp_ix === 0 ? "" : item.jp_ix}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setLocalMatrix(prev =>
                                    prev.map(m => (m.id === item.id ? { ...m, jp_ix: val === "" ? 0 : parseInt(val, 10) } : m))
                                  );
                                }}
                                onBlur={(e) => handleJPChange(item.id, "jp_ix", e.target.value, item.subjectName)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="w-16 bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-gray-800 dark:text-zinc-100 focus:outline-none"
                              />
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <div className="w-full space-y-2">
                              <div className="flex items-center gap-1.5 mb-1">
                                <input
                                  type="checkbox"
                                  id={`diff-teachers-${item.id}`}
                                  checked={!!item.useDifferentTeachers}
                                  onChange={(e) => handleDifferentTeachersToggle(item.id, e.target.checked, item.subjectName)}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <label
                                  htmlFor={`diff-teachers-${item.id}`}
                                  className="text-[10px] font-bold text-gray-500 dark:text-zinc-400 cursor-pointer select-none"
                                >
                                  Guru Berbeda Tiap Jenjang
                                </label>
                              </div>

                              {!item.useDifferentTeachers ? (
                                <TeacherDropdown
                                  currentTeacherId={item.teacherId}
                                  currentTeacherName={item.teacherName}
                                  teachers={teachers}
                                  onSelect={(tId, tName) => handleTeacherSelect(item.id, tId, tName, item.subjectName)}
                                />
                              ) : (
                                <div className="space-y-1.5 border border-dashed border-gray-200 dark:border-zinc-850 p-2 rounded-xl bg-gray-50/50 dark:bg-zinc-950/10">
                                  {(item.jp_vii ?? 0) > 0 && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-black uppercase text-blue-600 dark:text-blue-400">Kelas VII</span>
                                      <TeacherDropdown
                                        currentTeacherId={item.teacherId_vii || ""}
                                        currentTeacherName={item.teacherName_vii || ""}
                                        teachers={teachers}
                                        onSelect={(tId, tName) => handleTeacherForGradeSelect(item.id, "vii", tId, tName, item.subjectName)}
                                      />
                                    </div>
                                  )}
                                  {(item.jp_viii ?? 0) > 0 && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">Kelas VIII</span>
                                      <TeacherDropdown
                                        currentTeacherId={item.teacherId_viii || ""}
                                        currentTeacherName={item.teacherName_viii || ""}
                                        teachers={teachers}
                                        onSelect={(tId, tName) => handleTeacherForGradeSelect(item.id, "viii", tId, tName, item.subjectName)}
                                      />
                                    </div>
                                  )}
                                  {(item.jp_ix ?? 0) > 0 && (
                                    <div className="space-y-0.5">
                                      <span className="text-[9px] font-black uppercase text-purple-600 dark:text-purple-400">Kelas IX</span>
                                      <TeacherDropdown
                                        currentTeacherId={item.teacherId_ix || ""}
                                        currentTeacherName={item.teacherName_ix || ""}
                                        teachers={teachers}
                                        onSelect={(tId, tName) => handleTeacherForGradeSelect(item.id, "ix", tId, tName, item.subjectName)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteOpen(item)}
                              className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-zinc-850 rounded-xl transition-all cursor-pointer"
                              title="Hapus dari struktur kurikulum"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Control Actions Grid: Add Subject Form and Quick Search */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form: Add Subject to Matrix */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800/80 shadow-xs">
          <h3 className="text-xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-3.5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-500" />
            Tambahkan Mata Pelajaran ke Struktur
          </h3>
          <form onSubmit={handleAddSubject} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <select
                value={newSubjectId}
                onChange={(e) => setNewSubjectId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">-- Pilih Mata Pelajaran Master --</option>
                {availableSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name} (Kelompok {s.group} • KKM {s.kkm})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={addSubjectMutation.isPending || !newSubjectId}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-gray-400 dark:disabled:text-zinc-600 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Tambahkan</span>
            </button>
          </form>
          {availableSubjects.length === 0 && subjects.length > 0 && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2.5">
              ✓ Semua mata pelajaran master sudah terpasang di matriks kurikulum.
            </p>
          )}
          {subjects.length === 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-2.5">
              ⚠️ Belum ada mata pelajaran di Master Data. Silakan buat di menu Mata Pelajaran terlebih dahulu.
            </p>
          )}
        </div>

        {/* Quick Search Filtering */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800/80 shadow-xs flex flex-col justify-center">
          <h3 className="text-xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Search className="h-4 w-4 text-gray-400" />
            Saring Matriks Kurikulum
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Cari berdasarkan nama mapel, kode, atau guru..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl pl-9 pr-8 py-2.5 text-xs font-semibold text-gray-700 dark:text-zinc-300 placeholder-gray-450 dark:placeholder-zinc-550 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-400 dark:text-zinc-500" />
            {searchKeyword && (
              <button
                onClick={() => setSearchKeyword("")}
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER INSTRUCTIONS */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 border border-gray-100 dark:border-zinc-800 rounded-2xl flex items-start gap-2 text-[10px] text-gray-400 dark:text-zinc-500">
        <HelpCircle className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
        <div className="space-y-1 font-medium leading-relaxed">
          <p className="font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Petunjuk Penggunaan Cepat:</p>
          <p>1. Untuk merubah Urutan: Klik langsung kolom angka di kolom <strong>Urutan</strong>, masukkan angka urutan baru, lalu tekan <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-zinc-800 rounded font-mono text-[9px]">Enter</kbd> atau klik di luar sel untuk menyimpan secara otomatis.</p>
          <p>2. Untuk merubah JP: Klik langsung kolom angka (VII, VIII, IX), ubah angkanya, lalu tekan <kbd className="px-1 py-0.5 bg-gray-200 dark:bg-zinc-800 rounded font-mono text-[9px]">Enter</kbd> atau klik di luar sel untuk menyimpan secara otomatis.</p>
          <p>3. Untuk menugaskan Guru Pengampu: Klik dropdown guru pengampu pada baris bersangkutan, gunakan kotak pencarian untuk mencari nama atau NIY guru, dan pilih untuk mengaitkan.</p>
          <p>4. Mata pelajaran yang belum terisi guru pengampu akan menampilkan indikasi peringatan warna kuning (⚠️).</p>
        </div>
      </div>

      {/* Delete/Remove Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedItem(null);
        }}
        title="Hapus dari Matriks Kurikulum"
        size="sm"
      >
        <div className="space-y-4 font-sans">
          <div className="flex items-center gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-amber-800 dark:text-amber-400">
            <AlertCircle className="h-6 w-6 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-xs font-semibold leading-relaxed">
              Tindakan ini hanya menghapus mata pelajaran dari struktur kurikulum nyata (JP & Guru pengampu). 
              Master mata pelajaran akan tetap tersimpan aman di database.
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed font-semibold">
            Apakah Anda yakin ingin melepas Mata Pelajaran <strong className="text-gray-900 dark:text-white">"{selectedItem?.subjectName}"</strong> dari matriks kurikulum?
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => {
                setIsDeleteOpen(false);
                setSelectedItem(null);
              }}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={removeSubjectMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {removeSubjectMutation.isPending ? "Melepas..." : "Ya, Lepas Mapel"}
            </button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};

export default CurriculumMatrixPage;
