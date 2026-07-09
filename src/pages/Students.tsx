import React, { useState, useRef, useMemo } from "react";
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
  Download
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

  const activeYear = academicYears.find((y) => y.isActive);

  // Sorting students: 1. By Class Name, 2. Alphabetical (Name), 3. NISN/NIS
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      // 1. Class sorting
      const classA = classes.find((c) => c.id === a.classId);
      const classB = classes.find((c) => c.id === b.classId);

      // Handle "Tanpa Kelas" (empty classId or class not found)
      // We sort students with classes first, then without classes at the bottom
      if (classA && !classB) return -1;
      if (!classA && classB) return 1;
      if (!classA && !classB) {
        // Both are "Tanpa Kelas", sort by name then NISN/NIS
        const stdNameA = a.name || "";
        const stdNameB = b.name || "";
        if (stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" }) !== 0) {
          return stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" });
        }
        const nisnA = a.nisn || a.nis || "";
        const nisnB = b.nisn || b.nis || "";
        return nisnA.localeCompare(nisnB, "id", { numeric: true });
      }

      // Both have classes, compare by class name (e.g. "Kelas 7A", "Kelas 8B")
      const nameA = classA?.name || "";
      const nameB = classB?.name || "";
      
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB, "id", { numeric: true, sensitivity: "base" });
      }

      // 2. Alphabetical (Name) sorting within the same class
      const stdNameA = a.name || "";
      const stdNameB = b.name || "";
      if (stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" }) !== 0) {
        return stdNameA.localeCompare(stdNameB, "id", { sensitivity: "base" });
      }

      // 3. NISN/NIS sorting as fallback
      const idA = a.nisn || a.nis || "";
      const idB = b.nisn || b.nis || "";
      return idA.localeCompare(idB, "id", { numeric: true });
    });
  }, [students, classes]);

  // Forms
  const createForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: { nis: "", nisn: "", name: "", gender: "L", birthPlace: "", birthDate: "", address: "", status: "Aktif", classId: "", academicYearId: "" }
  });

  const editForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema)
  });

  const handleCreateOpen = () => {
    if (!activeYear) {
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
      classId: "",
      academicYearId: activeYear.id
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
    if (!activeYear) {
      toast("Tidak ada Tahun Ajaran aktif", "error");
      return;
    }

    setImportLoading(true);
    
    const formattedStudents = importData.map((std) => ({
      ...std,
      status: "Aktif" as const,
      classId: importClassId || "",
      academicYearId: activeYear.id
    }));

    importMutation.mutate(formattedStudents);
  };

  // Downloads / Exports
  const handleExportExcel = () => {
    const formatted = sortedStudents.map((s) => {
      const cls = classes.find((c) => c.id === s.classId);
      const tp = academicYears.find((y) => y.id === s.academicYearId);
      return {
        "NIS": s.nis,
        "NISN": s.nisn,
        "Nama Lengkap": s.name,
        "JK": s.gender === "L" ? "Laki-laki" : "Perempuan",
        "Tempat Lahir": s.birthPlace,
        "Tanggal Lahir": s.birthDate,
        "Kelas": cls ? cls.name : "Tanpa Kelas",
        "Tahun Pelajaran": tp ? tp.year : "-",
        "Status Keaktifan": s.status,
        "Alamat Tinggal": s.address
      };
    });
    exportToExcel(formatted, "Daftar_Siswa_SMP_Alkarim", "Daftar Siswa");
    toast("Excel berhasil diunduh!", "success");
  };

  const handleExportPDF = () => {
    const headers = ["NIS", "Nama Lengkap", "Gender", "Kelas", "Status", "Alamat"];
    const rows = sortedStudents.map((s) => {
      const cls = classes.find((c) => c.id === s.classId);
      return [
        s.nis,
        s.name,
        s.gender,
        cls ? cls.name : "Tanpa Kelas",
        s.status,
        s.address
      ];
    });
    exportToPDF("DAFTAR INDUK SISWA", headers, rows, "Daftar_Siswa_SMP_Alkarim");
    toast("PDF berhasil diunduh!", "success");
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
    const totalFields = 8; // name, gender, classId + 5 optional fields
    const filledTotal = 3 + (student.classId ? 1 : 0) + (student.name ? 1 : 0) + (student.gender ? 1 : 0) - 3 + filledOptional;
    // Simple 8-field calculation: name, gender, classId (mandatory) + 5 optional
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
      header: "Nama Lengkap", 
      accessor: (item) => {
        const { isComplete, percentage } = getCompleteness(item);
        return (
          <div className="flex flex-col gap-1.5 py-1">
            <span className="font-extrabold text-gray-900 dark:text-zinc-100">{item.name}</span>
            {!isComplete && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 w-fit">
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                ⚠️ Data Belum Lengkap ({percentage}%)
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
      accessor: (item) => item.nis ? <span className="font-mono text-gray-800 dark:text-zinc-200 font-bold">{item.nis}</span> : <span className="text-xs text-gray-400 dark:text-zinc-600 italic font-medium">Kosong</span>, 
      sortable: true, 
      sortKey: "nis" 
    },
    { 
      header: "NISN", 
      accessor: (item) => item.nisn ? <span className="font-mono text-gray-800 dark:text-zinc-200 font-bold">{item.nisn}</span> : <span className="text-xs text-gray-400 dark:text-zinc-600 italic font-medium">Kosong</span>, 
      sortable: true, 
      sortKey: "nisn" 
    },
    { header: "Gender", accessor: (item) => item.gender === "L" ? "Laki-laki" : "Perempuan", sortable: true, sortKey: "gender" },
    {
      header: "Rombel (Kelas)",
      accessor: (item) => {
        const clsObj = classes.find((c) => c.id === item.classId);
        return clsObj ? (
          <span className="font-semibold text-gray-800 dark:text-zinc-200">{clsObj.name}</span>
        ) : (
          <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 px-2 py-0.5 rounded-md font-bold">Tanpa Kelas</span>
        );
      },
      sortable: true,
      sortKey: "classId"
    },
    {
      header: "Status",
      accessor: (item) => {
        const bgClasses = { Aktif: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400", Lulus: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400", Pindah: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400", Keluar: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400" };
        return (
          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${bgClasses[item.status]}`}>
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
            Kelola profil lengkap murid, pembagian kelas, serta status kelulusan/keaktifan akademik
          </p>
        </div>
        
        <div className="flex gap-2">
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

      {/* Main Table Card */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs">
        <DataTable
          data={sortedStudents}
          columns={columns}
          rowKey={(s) => s.id}
          searchKeys={["name", "nis", "nisn"]}
          searchPlaceholder="Cari berdasarkan NIS, NISN, atau Nama Siswa..."
          rightHeaderActions={
            <div className="flex items-center gap-1.5 border border-gray-200 dark:border-zinc-800 rounded-xl px-2 py-1 bg-gray-50/50 dark:bg-zinc-900">
              <button
                onClick={handleExportExcel}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-zinc-800 text-gray-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor ke Excel"
              >
                <TableProperties className="h-4 w-4" />
              </button>
              <div className="w-[1px] h-4 bg-gray-200 dark:bg-zinc-800" />
              <button
                onClick={handleExportPDF}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-zinc-800 text-gray-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Ekspor ke PDF"
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
                title="Edit data"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDeleteOpen(item)}
                className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                title="Hapus data"
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
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
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
              options={academicYears.map((y) => ({ value: y.id, label: `${y.year} (${y.semester})` }))}
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
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
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
              options={classes.map((c) => ({ value: c.id, label: c.name }))}
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
              options={academicYears.map((y) => ({ value: y.id, label: `${y.year} (${y.semester})` }))}
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
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
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
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-3.5 py-2 border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 rounded-xl text-xs font-bold transition-all flex-shrink-0"
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
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
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
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={handleImportSubmit}
              disabled={importData.length === 0 || importLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
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
