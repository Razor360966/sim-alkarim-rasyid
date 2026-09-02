import React, { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { studentService } from "../services/studentService";
import { classService } from "../services/classService";
import { academicYearService } from "../services/academicYearService";
import { Student, Class, AcademicYear } from "../types";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import * as XLSX from "xlsx";
import { FormInput, FormSelect } from "../components/FormInput";
import { DataTable, Column } from "../components/DataTable";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { sortClasses, compareClassNames, getGradeLevelWeight } from "../utils/classSorter";
import { isStudentActive } from "../utils/studentHelper";
import { 
  Users, 
  Plus, 
  Edit2, 
  Trash2, 
  FileDown, 
  TableProperties, 
  Upload, 
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Download,
  Filter,
  Layers,
  RotateCcw,
  Building2,
  Calendar,
  Sparkles
} from "lucide-react";

const studentSchema = z.object({
  nis: z.string().optional().or(z.literal("")),
  nisn: z.string().optional().or(z.literal("")),
  name: z.string().min(3, { message: "Nama lengkap minimal 3 karakter" }),
  gender: z.enum(["L", "P"], { message: "Pilih jenis kelamin" }),
  birthPlace: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")).refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), { message: "Format tanggal lahir YYYY-MM-DD" }),
  address: z.string().optional().or(z.literal("")),
  status: z.enum(["Aktif", "Lulus", "Pindah", "Keluar"], { message: "Pilih status siswa" }),
  classId: z.string().min(1, { message: "Pilih kelas / jenjang" }),
  academicYearId: z.string().min(1, { message: "Pilih tahun ajaran" })
});

type StudentFormValues = any;

/**
 * Helper to normalize grade level from Class object.
 * Priority: class.gradeLevel ("VII" | "VIII" | "IX") -> class.grade -> class.name fallback.
 */
function getNormalizedGradeLevel(cls?: Class | null): string {
  if (!cls) return "";
  
  const gl = (cls.gradeLevel || "").toString().trim().toUpperCase();
  if (gl === "VII" || gl === "7") return "VII";
  if (gl === "VIII" || gl === "8") return "VIII";
  if (gl === "IX" || gl === "9") return "IX";
  if (gl) return gl;

  const g = (cls.grade || "").toString().trim().toUpperCase();
  if (g === "7" || g === "VII") return "VII";
  if (g === "8" || g === "VIII") return "VIII";
  if (g === "9" || g === "IX") return "IX";
  if (g) return g;

  const name = (cls.name || "").toString().toUpperCase();
  if (name.includes("VIII") || name.includes(" 8") || name.startsWith("8")) return "VIII";
  if (name.includes("VII") || name.includes(" 7") || name.startsWith("7")) return "VII";
  if (name.includes("IX") || name.includes(" 9") || name.startsWith("9")) return "IX";

  return "";
}

/**
 * Helper to get user-friendly label for grade level
 */
function getGradeLabel(gradeLevel: string): string {
  if (gradeLevel === "VII") return "Kelas VII";
  if (gradeLevel === "VIII") return "Kelas VIII";
  if (gradeLevel === "IX") return "Kelas IX";
  if (gradeLevel === "NO_CLASS") return "Tanpa Kelas";
  return `Kelas ${gradeLevel}`;
}

export const Students: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // Import State
  const [importData, setImportData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importClassId, setImportClassId] = useState("");
  const [dragActive, setDragActive] = useState(false);

  // Queries
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: studentService.getStudents
  });

  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: classService.getClasses
  });

  const { data: academicYears = [], isLoading: isLoadingYears } = useQuery({
    queryKey: ["academicYears"],
    queryFn: academicYearService.getAcademicYears
  });

  const isLoading = isLoadingStudents || isLoadingClasses || isLoadingYears;

  const activeYear = useMemo(() => academicYears.find((y) => y.isActive), [academicYears]);

  // Filtering States
  const [filterAcademicYearId, setFilterAcademicYearId] = useState<string>("ACTIVE");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("ALL"); // "ALL" | "VII" | "VIII" | "IX" | "NO_CLASS"
  const [filterClassId, setFilterClassId] = useState<string>("ALL"); // "ALL" | class.id
  const [filterStatus, setFilterStatus] = useState<string>("ALL"); // "ALL" | "Aktif" | "Lulus" | "Pindah" | "Keluar"

  // Effective Academic Year ID
  const effectiveAcademicYearId = useMemo(() => {
    if (filterAcademicYearId === "ACTIVE") {
      return activeYear?.id || "";
    }
    return filterAcademicYearId;
  }, [filterAcademicYearId, activeYear]);

  // Map of classes by ID for fast lookup
  const classMap = useMemo(() => {
    const map = new Map<string, Class>();
    classes.forEach((c) => {
      map.set(c.id, c);
      if (c.classId && c.classId !== c.id) {
        map.set(c.classId, c);
      }
    });
    return map;
  }, [classes]);

  // Available grade levels dynamically derived from classes master
  const availableGradeLevels = useMemo(() => {
    const levelsSet = new Set<string>();
    classes.forEach((c) => {
      const gl = getNormalizedGradeLevel(c);
      if (gl) levelsSet.add(gl);
    });
    // Ensure default SMP standard levels exist in list
    ["VII", "VIII", "IX"].forEach((lvl) => levelsSet.add(lvl));

    return Array.from(levelsSet).sort((a, b) => {
      const wA = getGradeLevelWeight(a);
      const wB = getGradeLevelWeight(b);
      if (wA !== wB) return wA - wB;
      return a.localeCompare(b);
    });
  }, [classes]);

  // Rombel dropdown options filtered by selected Grade Level & Academic Year
  const availableClassesForFilter = useMemo(() => {
    let list = [...classes];

    // Filter by selected Grade Level if specific level chosen
    if (filterGradeLevel !== "ALL" && filterGradeLevel !== "NO_CLASS") {
      list = list.filter((c) => getNormalizedGradeLevel(c) === filterGradeLevel);
    }

    return sortClasses(list);
  }, [classes, filterGradeLevel]);

  // Handle Changing Grade Level
  const handleGradeLevelChange = (newGradeLevel: string) => {
    setFilterGradeLevel(newGradeLevel);
    if (newGradeLevel === "ALL" || newGradeLevel === "NO_CLASS") {
      setFilterClassId("ALL");
    } else {
      // If currently selected rombel does not belong to the newly selected grade level, reset to "ALL"
      if (filterClassId !== "ALL") {
        const selectedCls = classMap.get(filterClassId);
        if (!selectedCls || getNormalizedGradeLevel(selectedCls) !== newGradeLevel) {
          setFilterClassId("ALL");
        }
      }
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilterAcademicYearId("ACTIVE");
    setFilterGradeLevel("ALL");
    setFilterClassId("ALL");
    setFilterStatus("ALL");
  };

  const isFilterActive = 
    filterAcademicYearId !== "ACTIVE" || 
    filterGradeLevel !== "ALL" || 
    filterClassId !== "ALL" || 
    filterStatus !== "ALL";

  // Filtered Students List
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // 1. Filter by Academic Year
      if (effectiveAcademicYearId && effectiveAcademicYearId !== "ALL") {
        if (student.academicYearId && student.academicYearId !== effectiveAcademicYearId) {
          return false;
        }
      }

      // 2. Filter by Status
      if (filterStatus !== "ALL") {
        if (student.status !== filterStatus) {
          return false;
        }
      }

      // 3. Filter by Grade Level
      const cls = student.classId ? classMap.get(student.classId) : null;
      const studentGradeLevel = getNormalizedGradeLevel(cls);

      if (filterGradeLevel === "NO_CLASS") {
        if (student.classId && cls) return false;
      } else if (filterGradeLevel !== "ALL") {
        if (studentGradeLevel !== filterGradeLevel) {
          return false;
        }
      }

      // 4. Filter by Specific Rombel (Class ID)
      if (filterClassId !== "ALL") {
        if (student.classId !== filterClassId) {
          return false;
        }
      }

      return true;
    });
  }, [students, classMap, effectiveAcademicYearId, filterStatus, filterGradeLevel, filterClassId]);

  // Sorted Students List: 1. Grade/Class, 2. Alphabetical Name, 3. NISN/NIS
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      const classA = a.classId ? classMap.get(a.classId) : null;
      const classB = b.classId ? classMap.get(b.classId) : null;

      // Handle students without classes (place at the bottom)
      if (classA && !classB) return -1;
      if (!classA && classB) return 1;
      if (!classA && !classB) {
        const stdNameA = a.name || "";
        const stdNameB = b.name || "";
        if (stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" }) !== 0) {
          return stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" });
        }
        return (a.nisn || a.nis || "").localeCompare(b.nisn || b.nis || "", "id", { numeric: true });
      }

      // Compare class names using standard hierarchy (VII -> VIII -> IX, A -> B -> C)
      const compClass = compareClassNames(classA?.name || "", classB?.name || "");
      if (compClass !== 0) {
        return compClass;
      }

      // Alphabetical by student name
      const stdNameA = a.name || "";
      const stdNameB = b.name || "";
      if (stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" }) !== 0) {
        return stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" });
      }

      // NISN / NIS fallback
      return (a.nisn || a.nis || "").localeCompare(b.nisn || b.nis || "", "id", { numeric: true });
    });
  }, [filteredStudents, classMap]);

  // Filter Summary Details & Stats
  const filterSummary = useMemo(() => {
    const total = sortedStudents.length;
    const activeCount = sortedStudents.filter(isStudentActive).length;
    const inactiveCount = sortedStudents.filter((s) => !isStudentActive(s)).length;
    const maleCount = sortedStudents.filter((s) => s.gender === "L" && (filterStatus !== "ALL" || isStudentActive(s))).length;
    const femaleCount = sortedStudents.filter((s) => s.gender === "P" && (filterStatus !== "ALL" || isStudentActive(s))).length;

    // Count unique rombel among filtered students
    const rombelSet = new Set<string>();
    sortedStudents.forEach((s) => {
      if (s.classId && classMap.has(s.classId)) {
        rombelSet.add(s.classId);
      }
    });
    const uniqueRombelCount = rombelSet.size;

    let title = "Semua Tingkat & Rombel";
    let subtitle = `Menampilkan ${activeCount} siswa aktif ${inactiveCount > 0 ? `(+${inactiveCount} nonaktif/riwayat)` : ""} dari ${uniqueRombelCount} rombel`;

    const selectedClassObj = filterClassId !== "ALL" ? classMap.get(filterClassId) : null;

    if (filterGradeLevel !== "ALL" && filterGradeLevel !== "NO_CLASS") {
      const gradeLabel = getGradeLabel(filterGradeLevel);
      if (filterClassId === "ALL") {
        title = `${gradeLabel} — Semua Rombel`;
        subtitle = `Menampilkan ${activeCount} siswa aktif dari ${uniqueRombelCount} rombel tingkat ${filterGradeLevel}`;
      } else {
        title = `${gradeLabel} • ${selectedClassObj?.name || filterClassId}`;
        subtitle = `Menampilkan ${activeCount} siswa aktif${selectedClassObj?.homeroomTeacherName ? ` (Wali Kelas: ${selectedClassObj.homeroomTeacherName})` : ""}`;
      }
    } else if (filterGradeLevel === "NO_CLASS") {
      title = "Siswa Tanpa Kelas";
      subtitle = `Menampilkan ${activeCount} siswa aktif yang belum ditempatkan pada rombongan belajar`;
    } else if (filterClassId !== "ALL") {
      title = `Rombel: ${selectedClassObj?.name || filterClassId}`;
      subtitle = `Menampilkan ${activeCount} siswa aktif${selectedClassObj?.homeroomTeacherName ? ` (Wali Kelas: ${selectedClassObj.homeroomTeacherName})` : ""}`;
    }

    const selectedYearObj = academicYears.find((y) => y.id === effectiveAcademicYearId);
    const yearLabel = selectedYearObj
      ? `${selectedYearObj.year} (${selectedYearObj.semester})`
      : effectiveAcademicYearId === "ALL"
      ? "Semua Tahun Ajaran"
      : "Tahun Ajaran Aktif";

    return {
      total,
      activeCount,
      inactiveCount,
      maleCount,
      femaleCount,
      uniqueRombelCount,
      title,
      subtitle,
      yearLabel
    };
  }, [sortedStudents, classMap, filterGradeLevel, filterClassId, filterStatus, effectiveAcademicYearId, academicYears]);

  // Forms
  const createForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: { nis: "", nisn: "", name: "", gender: "L", birthPlace: "", birthDate: "", address: "", status: "Aktif", classId: "", academicYearId: "" }
  });

  const editForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema)
  });

  const handleCreateOpen = () => {
    const yearId = effectiveAcademicYearId && effectiveAcademicYearId !== "ALL" ? effectiveAcademicYearId : (activeYear?.id || "");
    if (!yearId) {
      toast("Harap aktifkan salah satu Tahun Ajaran terlebih dahulu!", "warning");
      return;
    }
    createForm.reset({
      nis: "",
      nisn: "",
      name: "",
      gender: "L",
      birthPlace: "",
      birthDate: "",
      address: "",
      status: "Aktif",
      classId: filterClassId !== "ALL" ? filterClassId : "",
      academicYearId: yearId
    });
    setIsCreateOpen(true);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: studentService.createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast("Data Siswa berhasil didaftarkan!", "success");
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal mendaftarkan data siswa", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Student> }) =>
      studentService.updateStudent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast("Data Siswa berhasil diperbarui!", "success");
      setIsEditOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal memperbarui profil siswa", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: studentService.deleteStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast("Data Siswa berhasil dihapus!", "success");
      setIsDeleteOpen(false);
    },
    onError: (err) => {
      console.error(err);
      toast("Gagal menghapus siswa", "error");
    }
  });

  const importMutation = useMutation({
    mutationFn: studentService.importStudents,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast(`Berhasil mengimpor ${importData.length} data Siswa!`, "success");
      setIsImportOpen(false);
      setImportData([]);
      setImportClassId("");
    },
    onError: (err) => {
      console.error(err);
      toast("Terjadi kesalahan saat mengimpor data", "error");
    },
    onSettled: () => {
      setImportLoading(false);
    }
  });

  // Event handlers
  const handleCreateSubmit = (data: StudentFormValues) => {
    createMutation.mutate(data);
  };

  const handleEditOpen = (student: Student) => {
    setSelectedStudent(student);
    editForm.reset({
      nis: student.nis,
      nisn: student.nisn,
      name: student.name,
      gender: student.gender,
      birthPlace: student.birthPlace,
      birthDate: student.birthDate,
      address: student.address,
      status: student.status,
      classId: student.classId || "",
      academicYearId: student.academicYearId
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = (data: StudentFormValues) => {
    if (selectedStudent) {
      updateMutation.mutate({ id: selectedStudent.id, data });
    }
  };

  const handleDeleteOpen = (student: Student) => {
    setSelectedStudent(student);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedStudent) {
      deleteMutation.mutate(selectedStudent.id);
    }
  };

  // Excel parsing logic
  const parseExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet) as any[];

        // Map and validate columns
        const mapped = rawJson.map((row) => ({
          nis: String(row.NIS || row.nis || "").trim(),
          nisn: String(row.NISN || row.nisn || "").trim(),
          name: String(row.Nama || row.nama || row["Nama Lengkap"] || "").trim(),
          gender: String(row["Jenis Kelamin"] || row.gender || row.JK || "L").toUpperCase().startsWith("P") ? "P" : "L",
          birthPlace: String(row["Tempat Lahir"] || row.birthPlace || "Jakarta").trim(),
          birthDate: String(row["Tanggal Lahir"] || row.birthDate || "2012-01-01").trim(),
          address: String(row.Alamat || row.address || "Jl. Alkarim").trim()
        })).filter(r => r.name && r.nis);

        if (mapped.length === 0) {
          toast("Spreadsheet kosong atau tidak memiliki kolom NIS / Nama", "error");
          return;
        }

        setImportData(mapped);
        toast(`Berhasil membaca ${mapped.length} baris data siswa dari Excel!`, "info");
      } catch (err) {
        console.error(err);
        toast("Gagal membaca file Excel. Pastikan format tabel benar.", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseExcelFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = () => {
    if (importData.length === 0) return;
    const yearId = effectiveAcademicYearId && effectiveAcademicYearId !== "ALL" ? effectiveAcademicYearId : (activeYear?.id || "");
    if (!yearId) {
      toast("Tidak ada Tahun Ajaran aktif", "error");
      return;
    }

    setImportLoading(true);
    
    const formattedStudents = importData.map((std) => ({
      ...std,
      status: "Aktif" as const,
      classId: importClassId || "",
      academicYearId: yearId
    }));

    importMutation.mutate(formattedStudents);
  };

  // Downloads / Exports respecting current filters
  const handleExportExcel = () => {
    const formatted = sortedStudents.map((s, idx) => {
      const cls = s.classId ? classMap.get(s.classId) : null;
      const tp = academicYears.find((y) => y.id === s.academicYearId);
      const grade = getNormalizedGradeLevel(cls);
      return {
        "No": idx + 1,
        "NIS": s.nis,
        "NISN": s.nisn,
        "Nama Lengkap": s.name,
        "JK": s.gender === "L" ? "Laki-laki" : "Perempuan",
        "Tingkat": grade || "-",
        "Rombel (Kelas)": cls ? cls.name : "Tanpa Kelas",
        "Wali Kelas": cls?.homeroomTeacherName || cls?.waliKelasName || "-",
        "Tahun Pelajaran": tp ? `${tp.year} (${tp.semester})` : "-",
        "Status Keaktifan": s.status,
        "Tempat Lahir": s.birthPlace || "-",
        "Tanggal Lahir": s.birthDate || "-",
        "Alamat Tinggal": s.address || "-"
      };
    });

    const filePrefix = filterGradeLevel !== "ALL" 
      ? `Daftar_Siswa_Kelas_${filterGradeLevel}_${filterClassId !== "ALL" ? (classMap.get(filterClassId)?.name || filterClassId) : "Semua_Rombel"}`
      : `Daftar_Siswa_Semua_Kelas`;

    exportToExcel(formatted, `${filePrefix}_SMP_Alkarim`, "Daftar Siswa");
    toast(`Excel berhasil diunduh (${formatted.length} siswa)!`, "success");
  };

  const handleExportPDF = () => {
    const headers = ["No", "NIS", "Nama Lengkap", "JK", "Tingkat", "Rombel", "Status"];
    const rows = sortedStudents.map((s, idx) => {
      const cls = s.classId ? classMap.get(s.classId) : null;
      const grade = getNormalizedGradeLevel(cls);
      return [
        String(idx + 1),
        s.nis || "-",
        s.name,
        s.gender === "L" ? "L" : "P",
        grade || "-",
        cls ? cls.name : "Tanpa Kelas",
        s.status
      ];
    });

    const pdfTitle = `DAFTAR SISWA - ${filterSummary.title.toUpperCase()} (${filterSummary.yearLabel.toUpperCase()})`;
    const filePrefix = filterGradeLevel !== "ALL" 
      ? `Daftar_Siswa_Kelas_${filterGradeLevel}`
      : `Daftar_Siswa_Semua_Kelas`;

    exportToPDF(pdfTitle, headers, rows, `${filePrefix}_SMP_Alkarim`);
    toast(`PDF berhasil diunduh (${rows.length} siswa)!`, "success");
  };

  // Helper download template excel
  const handleDownloadTemplate = () => {
    const headers = [
      { "NIS": "12001", "NISN": "0123456789", "Nama Lengkap": "Rahmat Ramadhan", "Jenis Kelamin": "L", "Tempat Lahir": "Padang", "Tanggal Lahir": "2012-05-14", "Alamat": "Jl. Kemerdekaan No. 12" },
      { "NIS": "12002", "NISN": "0123456790", "Nama Lengkap": "Annisa Fitri", "Jenis Kelamin": "P", "Tempat Lahir": "Jakarta", "Tanggal Lahir": "2012-11-20", "Alamat": "Kompleks Griya Alkarim" }
    ];
    exportToExcel(headers, "Template_Import_Siswa_SMP_Alkarim", "Template Siswa");
    toast("Template Excel berhasil diunduh!", "success");
  };

  // Completeness calculation helper
  const getCompleteness = (student: Student) => {
    const optionalFields = [
      student.nis,
      student.nisn,
      student.birthPlace,
      student.birthDate,
      student.address
    ];
    const filledOptional = optionalFields.filter(val => val && val.trim() !== "").length;
    const totalFields = 8;
    const actualFilledTotal = 3 + filledOptional;
    const percentage = Math.round((actualFilledTotal / totalFields) * 100);
    return {
      isComplete: filledOptional === 5,
      percentage,
      filledOptional,
      totalOptional: 5
    };
  };

  // Columns definition
  const columns: Column<Student>[] = [
    {
      header: "No",
      accessor: (_item, index) => (
        <span className="font-mono text-xs text-gray-500 dark:text-zinc-400 font-semibold">
          {index !== undefined ? index + 1 : "-"}
        </span>
      ),
      className: "w-12 text-center"
    },
    { 
      header: "Nama Lengkap", 
      accessor: (item) => {
        const { isComplete, percentage } = getCompleteness(item);
        return (
          <div className="flex flex-col gap-1 py-0.5">
            <span className="font-extrabold text-gray-900 dark:text-zinc-100">{item.name}</span>
            {!isComplete && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 w-fit">
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                Data Belum Lengkap ({percentage}%)
              </span>
            )}
          </div>
        );
      }, 
      sortable: true,
      sortKey: "name"
    },
    { 
      header: "NIS", 
      accessor: (item) => item.nis ? (
        <span className="font-mono text-gray-800 dark:text-zinc-200 font-bold">{item.nis}</span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-zinc-600 italic font-medium">Kosong</span>
      ), 
      sortable: true, 
      sortKey: "nis" 
    },
    { 
      header: "NISN", 
      accessor: (item) => item.nisn ? (
        <span className="font-mono text-gray-800 dark:text-zinc-200 font-bold">{item.nisn}</span>
      ) : (
        <span className="text-xs text-gray-400 dark:text-zinc-600 italic font-medium">Kosong</span>
      ), 
      sortable: true, 
      sortKey: "nisn" 
    },
    { 
      header: "Gender", 
      accessor: (item) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
          item.gender === "L" 
            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40"
            : "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-400 border border-pink-200/50 dark:border-pink-900/40"
        }`}>
          {item.gender === "L" ? "L (Laki-laki)" : "P (Perempuan)"}
        </span>
      ), 
      sortable: true, 
      sortKey: "gender" 
    },
    {
      header: "Rombel (Kelas)",
      accessor: (item) => {
        const clsObj = item.classId ? classMap.get(item.classId) : null;
        if (!clsObj) {
          return (
            <span className="inline-flex items-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold border border-amber-200/50 dark:border-amber-900/30">
              Tanpa Kelas
            </span>
          );
        }
        const grade = getNormalizedGradeLevel(clsObj);
        return (
          <div className="flex items-center gap-1.5">
            {grade && (
              <span className="px-1.5 py-0.5 text-[10px] font-extrabold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40 rounded-md">
                Tk. {grade}
              </span>
            )}
            <span className="font-bold text-gray-800 dark:text-zinc-200">{clsObj.name}</span>
          </div>
        );
      },
      sortable: true,
      sortKey: "classId"
    },
    {
      header: "Status",
      accessor: (item) => {
        const bgClasses = { 
          Aktif: "bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40", 
          Lulus: "bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40", 
          Pindah: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40", 
          Keluar: "bg-rose-50 text-rose-700 border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40" 
        };
        return (
          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${bgClasses[item.status] || "bg-gray-50 text-gray-700"}`}>
            {item.status}
          </span>
        );
      },
      sortable: true,
      sortKey: "status"
    }
  ];

  if (isLoading) {
    return <Loading variant="full" text="Memuat daftar induk siswa..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-zinc-850 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Daftar Induk Siswa (Siswa)
          </h1>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Kelola profil lengkap murid, filter berjenjang tingkat & rombel, serta status kelulusan/keaktifan akademik
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 border border-gray-200 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800 text-gray-600 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <Upload className="h-4 w-4 text-emerald-500" />
            Impor dari Excel
          </button>
          
          <button
            onClick={handleCreateOpen}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Murid Baru
          </button>
        </div>
      </div>

      {/* Advanced Filter Bento Card */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-150 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-2 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-extrabold text-gray-700 dark:text-zinc-300 uppercase tracking-wider">
              Filter Tingkat, Rombel & Tahun Ajaran
            </h3>
          </div>

          {/* Quick Tingkat Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 mr-1 hidden md:inline">
              Pintas Tingkat:
            </span>
            <button
              type="button"
              onClick={() => handleGradeLevelChange("ALL")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                filterGradeLevel === "ALL"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Semua Tingkat
            </button>
            {availableGradeLevels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => handleGradeLevelChange(lvl)}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  filterGradeLevel === lvl
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {getGradeLabel(lvl)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleGradeLevelChange("NO_CLASS")}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                filterGradeLevel === "NO_CLASS"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Tanpa Kelas
            </button>
          </div>
        </div>

        {/* 4-Dropdown Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
          
          {/* 1. Tahun Ajaran */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-gray-400" />
              Tahun Ajaran
            </label>
            <select
              value={filterAcademicYearId}
              onChange={(e) => setFilterAcademicYearId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 font-medium transition-all"
            >
              {activeYear && (
                <option value="ACTIVE">
                  ⭐ {activeYear.year} ({activeYear.semester}) — Aktif
                </option>
              )}
              <option value="ALL">Semua Tahun Ajaran</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year} ({y.semester}) {y.isActive ? " (Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Tingkat Kelas */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-gray-400" />
              Tingkat Kelas
            </label>
            <select
              value={filterGradeLevel}
              onChange={(e) => handleGradeLevelChange(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 font-medium transition-all"
            >
              <option value="ALL">Semua Tingkat</option>
              {availableGradeLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {getGradeLabel(lvl)}
                </option>
              ))}
              <option value="NO_CLASS">Tanpa Kelas / Belum Ditempatkan</option>
            </select>
          </div>

          {/* 3. Rombel (Kelas) */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              Rombongan Belajar (Rombel)
            </label>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              disabled={filterGradeLevel === "NO_CLASS"}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 font-medium transition-all disabled:opacity-50"
            >
              <option value="ALL">
                {filterGradeLevel !== "ALL" && filterGradeLevel !== "NO_CLASS"
                  ? `Semua Rombel Tingkat ${filterGradeLevel} (${availableClassesForFilter.length} Rombel)`
                  : "Semua Rombel"}
              </option>
              {availableClassesForFilter.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.homeroomTeacherName ? `(Wali: ${c.homeroomTeacherName})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Status Siswa */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
                Status Keaktifan
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 font-medium transition-all"
              >
                <option value="ALL">Semua Status</option>
                <option value="Aktif">Aktif</option>
                <option value="Lulus">Lulus</option>
                <option value="Pindah">Pindah</option>
                <option value="Keluar">Keluar</option>
              </select>
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 rounded-xl border border-gray-200 dark:border-zinc-800 transition-colors cursor-pointer shrink-0"
                title="Reset Semua Filter"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary & Active Filter Results Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-900 border border-blue-100 dark:border-zinc-800 rounded-2xl">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider bg-blue-600 text-white rounded-md">
              {filterGradeLevel !== "ALL" ? getGradeLabel(filterGradeLevel) : "Semua Tingkat"}
            </span>
            <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100">
              {filterSummary.title}
            </h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-zinc-400">
            {filterSummary.subtitle} • <span className="font-semibold text-blue-700 dark:text-blue-300">{filterSummary.yearLabel}</span>
          </p>
        </div>

        {/* Quick Stat Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-700 dark:text-zinc-200 shadow-2xs">
            {filterStatus === "ALL" ? (
              <>Total Siswa: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{filterSummary.activeCount}</span> <span className="text-[10px] text-gray-400 font-normal">Aktif</span></>
            ) : (
              <>Total ({filterStatus}): <span className="text-blue-600 dark:text-blue-400 font-extrabold">{filterSummary.total}</span> Siswa</>
            )}
          </div>
          {filterStatus === "ALL" && filterSummary.inactiveCount > 0 && (
            <div className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-400">
              Riwayat / Nonaktif: <span className="font-extrabold">{filterSummary.inactiveCount}</span>
            </div>
          )}
          <div className="px-2.5 py-1 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300">
            L: {filterSummary.maleCount}
          </div>
          <div className="px-2.5 py-1 bg-pink-50/80 dark:bg-pink-950/40 border border-pink-200/60 dark:border-pink-900/40 rounded-xl text-xs font-bold text-pink-700 dark:text-pink-300">
            P: {filterSummary.femaleCount}
          </div>
          <div className="px-2.5 py-1 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300">
            {filterSummary.uniqueRombelCount} Rombel
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs">
        <DataTable
          data={sortedStudents}
          columns={columns}
          rowKey={(s) => s.id}
          searchKeys={["name", "nis", "nisn"]}
          searchPlaceholder={`Cari di ${filterSummary.title} (Nama, NIS, NISN)...`}
          emptyStateText={`Tidak ada data siswa ditemukan untuk kriteria filter "${filterSummary.title}"`}
          rightHeaderActions={
            <div className="flex items-center gap-1.5 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1 bg-gray-50/50 dark:bg-zinc-900">
              <button
                onClick={handleExportExcel}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-zinc-800 text-gray-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor Hasil Filter ke Excel"
              >
                <TableProperties className="h-4 w-4" />
              </button>
              <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-800" />
              <button
                onClick={handleExportPDF}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-zinc-800 text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor Hasil Filter ke PDF"
              >
                <FileDown className="h-4 w-4" />
              </button>
            </div>
          }
          actions={(item) => (
            <>
              <button
                onClick={() => handleEditOpen(item)}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Edit data murid"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteOpen(item)}
                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Hapus data murid"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        />
      </div>

      {/* Reusable Create Dialog */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Daftarkan Murid Baru"
        size="lg"
      >
        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nama Lengkap Siswa"
              placeholder="E.g., Rahmat Ramadhan"
              required
              register={createForm.register("name")}
              error={createForm.formState.errors.name?.message}
            />
            <FormSelect
              label="Jenis Kelamin"
              options={[
                { value: "L", label: "Laki-laki (L)" },
                { value: "P", label: "Perempuan (P)" }
              ]}
              required
              register={createForm.register("gender")}
              error={createForm.formState.errors.gender?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nomor Induk Siswa (NIS) (Opsional)"
              placeholder="Contoh: 12024"
              register={createForm.register("nis")}
              error={createForm.formState.errors.nis?.message}
            />
            <FormInput
              label="NISN (10 Digit) (Opsional)"
              placeholder="Contoh: 0123456789"
              register={createForm.register("nisn")}
              error={createForm.formState.errors.nisn?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Tempat Lahir (Opsional)"
              placeholder="E.g., Padang"
              register={createForm.register("birthPlace")}
              error={createForm.formState.errors.birthPlace?.message}
            />
            <FormInput
              label="Tanggal Lahir (Opsional)"
              type="date"
              register={createForm.register("birthDate")}
              error={createForm.formState.errors.birthDate?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormSelect
              label="Rombongan Belajar (Kelas)"
              options={classes.map((c) => {
                const gr = getNormalizedGradeLevel(c);
                return { value: c.id, label: `${c.name} ${gr ? `(Tk. ${gr})` : ""}` };
              })}
              placeholder="-- Pilih Rombel --"
              required
              register={createForm.register("classId")}
              error={createForm.formState.errors.classId?.message}
            />
            <FormSelect
              label="Status Keaktifan"
              options={[
                { value: "Aktif", label: "Aktif Sekolah" },
                { value: "Lulus", label: "Lulus Pendidikan" },
                { value: "Pindah", label: "Pindah Sekolah" },
                { value: "Keluar", label: "Keluar Sesi" }
              ]}
              required
              register={createForm.register("status")}
              error={createForm.formState.errors.status?.message}
            />
            <FormSelect
              label="Tahun Ajaran Terdaftar"
              options={academicYears.map((y) => ({ value: y.id, label: `${y.year} (${y.semester}) ${y.isActive ? "⭐" : ""}` }))}
              required
              register={createForm.register("academicYearId")}
              error={createForm.formState.errors.academicYearId?.message}
            />
          </div>

          <FormInput
            label="Alamat Tempat Tinggal Lengkap (Opsional)"
            placeholder="E.g., Jl. Kemerdekaan No. 12, RT 02/RW 03, Padang"
            register={createForm.register("address")}
            error={createForm.formState.errors.address?.message}
          />

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
              {createMutation.isPending ? "Menyimpan..." : "Daftarkan Siswa"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Reusable Edit Dialog */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Profil Murid"
        size="lg"
      >
        <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nama Lengkap Siswa"
              placeholder="E.g., Rahmat Ramadhan"
              required
              register={editForm.register("name")}
              error={editForm.formState.errors.name?.message}
            />
            <FormSelect
              label="Jenis Kelamin"
              options={[
                { value: "L", label: "Laki-laki (L)" },
                { value: "P", label: "Perempuan (P)" }
              ]}
              required
              register={editForm.register("gender")}
              error={editForm.formState.errors.gender?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nomor Induk Siswa (NIS) (Opsional)"
              placeholder="Contoh: 12024"
              register={editForm.register("nis")}
              error={editForm.formState.errors.nis?.message}
            />
            <FormInput
              label="NISN (10 Digit) (Opsional)"
              placeholder="Contoh: 0123456789"
              register={editForm.register("nisn")}
              error={editForm.formState.errors.nisn?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Tempat Lahir (Opsional)"
              placeholder="E.g., Padang"
              register={editForm.register("birthPlace")}
              error={editForm.formState.errors.birthPlace?.message}
            />
            <FormInput
              label="Tanggal Lahir (Opsional)"
              type="date"
              register={editForm.register("birthDate")}
              error={editForm.formState.errors.birthDate?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormSelect
              label="Rombongan Belajar (Kelas)"
              options={classes.map((c) => {
                const gr = getNormalizedGradeLevel(c);
                return { value: c.id, label: `${c.name} ${gr ? `(Tk. ${gr})` : ""}` };
              })}
              placeholder="-- Pilih Rombel --"
              required
              register={editForm.register("classId")}
              error={editForm.formState.errors.classId?.message}
            />
            <FormSelect
              label="Status Keaktifan"
              options={[
                { value: "Aktif", label: "Aktif Sekolah" },
                { value: "Lulus", label: "Lulus Pendidikan" },
                { value: "Pindah", label: "Pindah Sekolah" },
                { value: "Keluar", label: "Keluar Sesi" }
              ]}
              required
              register={editForm.register("status")}
              error={editForm.formState.errors.status?.message}
            />
            <FormSelect
              label="Tahun Ajaran Terdaftar"
              options={academicYears.map((y) => ({ value: y.id, label: `${y.year} (${y.semester}) ${y.isActive ? "⭐" : ""}` }))}
              required
              register={editForm.register("academicYearId")}
              error={editForm.formState.errors.academicYearId?.message}
            />
          </div>

          <FormInput
            label="Alamat Tempat Tinggal Lengkap (Opsional)"
            placeholder="E.g., Jl. Kemerdekaan No. 12, RT 02/RW 03, Padang"
            register={editForm.register("address")}
            error={editForm.formState.errors.address?.message}
          />

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

      {/* Reusable Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus Data Siswa"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
            Apakah Anda yakin ingin menghapus data murid bernama <strong className="text-gray-900 dark:text-white">{selectedStudent?.name}</strong>? Tindakan ini bersifat permanen dan seluruh riwayat keaktifan murid akan terhapus dari sistem.
          </p>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Murid"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Reusable Excel Import Dialog */}
      <Dialog
        isOpen={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          setImportData([]);
          setImportClassId("");
        }}
        title="Impor Murid Baru secara Massal"
        size="lg"
      >
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-blue-800 dark:text-blue-300">Gunakan Template Standard</p>
                <p className="text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">Pastikan header kolom spreadsheet Excel Anda berisi: <strong>NIS, NISN, Nama Lengkap, Jenis Kelamin, Tempat Lahir, Tanggal Lahir (YYYY-MM-DD), Alamat</strong>.</p>
              </div>
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Unduh Template
            </button>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              dragActive 
                ? "border-blue-500 bg-blue-50/20" 
                : "border-gray-200 dark:border-zinc-800 hover:bg-gray-50/30"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileChange}
            />
            
            <FileSpreadsheet className="h-10 w-10 text-emerald-500 mb-3" />
            
            <p className="text-sm font-bold text-gray-800 dark:text-zinc-200">
              Seret & letakkan file spreadsheet di sini, atau klik untuk memilih
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Mendukung format file .xlsx, .xls, .csv
            </p>
          </div>

          {/* Class assignment for imported students */}
          {importData.length > 0 && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  {importData.length} baris murid siap diimpor ke sistem.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-1.5 block">
                    Masukkan Semua Murid ke Kelas (Opsional)
                  </label>
                  <select
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 dark:border-zinc-800 dark:bg-zinc-900 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    value={importClassId}
                    onChange={(e) => setImportClassId(e.target.value)}
                  >
                    <option value="">Masukkan sebagai Tanpa Kelas</option>
                    {classes.map((c) => {
                      const gr = getNormalizedGradeLevel(c);
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name} {gr ? `(Tk. ${gr})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Data review preview table */}
              <div className="border border-gray-100 dark:border-zinc-800 rounded-xl overflow-hidden max-h-[160px] overflow-y-auto bg-white dark:bg-zinc-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 text-gray-500">
                    <tr>
                      <th className="p-2">NIS</th>
                      <th className="p-2">Nama</th>
                      <th className="p-2">Gender</th>
                      <th className="p-2">Lahir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-zinc-850">
                    {importData.slice(0, 5).map((row, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono">{row.nis}</td>
                        <td className="p-2 font-semibold text-gray-800 dark:text-zinc-200">{row.name}</td>
                        <td className="p-2">{row.gender === "L" ? "Laki-laki" : "Perempuan"}</td>
                        <td className="p-2">{row.birthPlace}, {row.birthDate}</td>
                      </tr>
                    ))}
                    {importData.length > 5 && (
                      <tr>
                        <td colSpan={4} className="p-2 text-center text-gray-400">
                          ... dan {importData.length - 5} murid lainnya ...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setIsImportOpen(false);
                setImportData([]);
                setImportClassId("");
              }}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleImportSubmit}
              disabled={importData.length === 0 || importLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {importLoading ? "Mengimpor..." : "Lakukan Impor"}
            </button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};

export default Students;

