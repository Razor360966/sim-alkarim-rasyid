import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { classService } from "../services/classService";
import { teacherService } from "../services/teacherService";
import { academicYearService } from "../services/academicYearService";
import { Class, Teacher, AcademicYear } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { 
  DoorClosed, 
  Plus, 
  Edit2, 
  Trash2, 
  FileDown, 
  TableProperties, 
  Eye, 
  ChevronRight, 
  Search, 
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  RefreshCw,
  Users
} from "lucide-react";

export const Classes: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  // Current logged in user details for activity logs
  const currentUserId = user?.uid || "system";
  const currentUserName = user?.displayName || user?.email || "Admin";

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);

  // Search and Filter States
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("Semua");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>("Semua");

  // Form State & Custom Errors for Add/Edit
  const [formData, setFormData] = useState({
    name: "",
    gradeLevel: "VII" as "VII" | "VIII" | "IX",
    roomCode: "",
    capacity: 32,
    homeroomTeacherId: "",
    academicYear: "",
    status: "Aktif" as "Aktif" | "Nonaktif"
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Queries
  const { data: classes = [], isLoading: isLoadingClasses, refetch: refetchClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: classService.getClasses
  });

  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: teacherService.getTeachers
  });

  const { data: academicYears = [], isLoading: isLoadingYears } = useQuery({
    queryKey: ["academicYears"],
    queryFn: academicYearService.getAcademicYears
  });

  const isLoading = isLoadingClasses || isLoadingTeachers || isLoadingYears;

  const activeYear = academicYears.find((y) => y.isActive);

  // Determine available teachers (not currently homeroom teachers, or currently assigned to selected class)
  const getAvailableTeachers = (currentWaliKelasId?: string) => {
    return teachers.filter((t) => !t.isWaliKelas || t.id === currentWaliKelasId);
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: any) => classService.createClass(data, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast("Kelas berhasil dibuat!", "success");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal membuat kelas baru", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, oldWaliKelasId, data }: { id: string; oldWaliKelasId: string; data: any }) =>
      classService.updateClass(id, oldWaliKelasId, data, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast("Kelas berhasil diperbarui!", "success");
      setIsEditOpen(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui kelas", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, waliKelasId }: { id: string; waliKelasId: string }) =>
      classService.deleteClass(id, waliKelasId, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast("Kelas berhasil dihapus (Soft Delete)!", "success");
      setIsDeleteOpen(false);
    },
    onError: (err: any) => {
      console.error(err);
      toast("Gagal menghapus kelas", "error");
    }
  });

  // Reset form helper
  const resetForm = () => {
    setFormData({
      name: "",
      gradeLevel: "VII",
      roomCode: "",
      capacity: 32,
      homeroomTeacherId: "",
      academicYear: activeYear ? activeYear.year : "",
      status: "Aktif"
    });
    setFormErrors({});
  };

  // Open Create Dialog
  const handleCreateOpen = () => {
    if (teachers.length === 0) {
      toast("Tambahkan data guru terlebih dahulu sebelum membuat kelas!", "warning");
      return;
    }
    
    setFormData({
      name: "",
      gradeLevel: "VII",
      roomCode: "",
      capacity: 32,
      homeroomTeacherId: "",
      academicYear: activeYear ? activeYear.year : academicYears[0]?.year || "",
      status: "Aktif"
    });
    setFormErrors({});
    setIsCreateOpen(true);
  };

  // Open Edit Dialog
  const handleEditOpen = (cls: Class) => {
    setSelectedClass(cls);
    setFormData({
      name: cls.name,
      gradeLevel: cls.gradeLevel || "VII",
      roomCode: cls.roomCode || "",
      capacity: cls.capacity,
      homeroomTeacherId: cls.homeroomTeacherId || cls.waliKelasId || "",
      academicYear: cls.academicYear || cls.academicYearId || "",
      status: cls.status || "Aktif"
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  // Open Detail Dialog
  const handleDetailOpen = (cls: Class) => {
    setSelectedClass(cls);
    setIsDetailOpen(true);
  };

  // Open Delete Dialog
  const handleDeleteOpen = (cls: Class) => {
    setSelectedClass(cls);
    setIsDeleteOpen(true);
  };

  // Validate form inline
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      errors.name = "Nama kelas wajib diisi!";
    }
    if (!formData.gradeLevel) {
      errors.gradeLevel = "Tingkat kelas wajib dipilih!";
    }
    if (!formData.homeroomTeacherId) {
      errors.homeroomTeacherId = "Wali kelas wajib dipilih!";
    }
    if (!formData.academicYear) {
      errors.academicYear = "Tahun ajaran wajib diisi!";
    }
    if (formData.capacity < 1) {
      errors.capacity = "Kapasitas kelas minimal 1 siswa!";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handlers
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    // Get selected teacher's name
    const teacher = teachers.find((t) => t.id === formData.homeroomTeacherId);
    const teacherName = teacher ? teacher.name : "Belum Ditentukan";

    createMutation.mutate({
      ...formData,
      homeroomTeacherName: teacherName
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (selectedClass) {
      const teacher = teachers.find((t) => t.id === formData.homeroomTeacherId);
      const teacherName = teacher ? teacher.name : "Belum Ditentukan";

      updateMutation.mutate({
        id: selectedClass.id,
        oldWaliKelasId: selectedClass.homeroomTeacherId || selectedClass.waliKelasId || "",
        data: {
          ...formData,
          homeroomTeacherName: teacherName
        }
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedClass) {
      deleteMutation.mutate({
        id: selectedClass.id,
        waliKelasId: selectedClass.homeroomTeacherId || selectedClass.waliKelasId || ""
      });
    }
  };

  // Local Search & Multi-Faceted Filter Logic
  const filteredClasses = useMemo(() => {
    const rawFiltered = classes.filter((cls) => {
      // 1. Search by name (case-insensitive)
      const matchesSearch = cls.name.toLowerCase().includes(searchKeyword.toLowerCase());
      
      // 2. Filter by grade level
      const matchesGrade = filterGradeLevel === "Semua" || cls.gradeLevel === filterGradeLevel;

      // 3. Filter by status
      const matchesStatus = filterStatus === "Semua" || cls.status === filterStatus;

      // 4. Filter by academic year
      const matchesYear = filterAcademicYear === "Semua" || cls.academicYear === filterAcademicYear;

      return matchesSearch && matchesGrade && matchesStatus && matchesYear;
    });

    const gradeOrder: Record<string, number> = { "VII": 1, "VIII": 2, "IX": 3 };
    return [...rawFiltered].sort((a, b) => {
      const orderA = gradeOrder[a.gradeLevel] || 99;
      const orderB = gradeOrder[b.gradeLevel] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes, searchKeyword, filterGradeLevel, filterStatus, filterAcademicYear]);

  // Extract unique academic years for the select dropdown filter
  const uniqueYearsFilter = useMemo(() => {
    const yearsSet = new Set<string>();
    classes.forEach((c) => {
      if (c.academicYear) yearsSet.add(c.academicYear);
    });
    return Array.from(yearsSet).sort();
  }, [classes]);

  // Excel and PDF Export actions
  const handleExportExcel = () => {
    const formatted = filteredClasses.map((c, idx) => {
      return {
        "No": idx + 1,
        "Nama Kelas": c.name,
        "Tingkat": c.gradeLevel,
        "Ruangan": c.roomCode || "-",
        "Kapasitas": `${c.capacity} Siswa`,
        "Wali Kelas": c.homeroomTeacherName || c.waliKelasName || "Belum Ditunjuk",
        "Tahun Pelajaran": c.academicYear || "-",
        "Status": c.status || "Aktif"
      };
    });
    exportToExcel(formatted, "Daftar_Kelas_SMP_Alkarim", "Data Kelas");
    toast("Excel berhasil diunduh!", "success");
  };

  const handleExportPDF = () => {
    const headers = ["No", "Nama Kelas", "Tingkat", "Wali Kelas", "Kapasitas", "Tahun Ajaran", "Status"];
    const rows = filteredClasses.map((c, idx) => {
      return [
        String(idx + 1),
        c.name,
        c.gradeLevel || "-",
        c.homeroomTeacherName || c.waliKelasName || "Belum Ditunjuk",
        `${c.capacity} Siswa`,
        c.academicYear || "-",
        c.status || "Aktif"
      ];
    });
    exportToPDF("SMP ALKARIM RASYID - DAFTAR KELAS & WALI KELAS", headers, rows, "Daftar_Kelas_SMP_Alkarim");
    toast("PDF berhasil diunduh!", "success");
  };

  if (isLoading) {
    return <Loading variant="full" text="Memuat modul Master Data Kelas..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col space-y-1">
        <nav className="flex items-center text-xs text-gray-500 dark:text-zinc-400 gap-1.5">
          <span className="hover:text-blue-600 transition-colors cursor-default">Master Data</span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-semibold text-gray-800 dark:text-zinc-200">Kelas</span>
        </nav>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <DoorClosed className="h-7 w-7 text-blue-600 dark:text-blue-500" />
              Master Data Kelas
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
              Kelola rombongan belajar, kapasitas kelas, tahun ajaran aktif, dan penunjukan Guru Wali Kelas
            </p>
          </div>
          
          <button
            onClick={handleCreateOpen}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Kelas Baru
          </button>
        </div>
      </div>

      {/* WARNING banner if no teachers are registered */}
      {teachers.length === 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Data Guru Belum Tersedia!</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
              Wali kelas wajib dipilih dari data guru. Silakan tambahkan data guru terlebih dahulu pada menu <strong>Master Data → Guru</strong> sebelum menambahkan kelas.
            </p>
          </div>
        </div>
      )}

      {/* Advanced Filters & Search Bento Box */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-150 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
          Pencarian & Penyaringan Kelas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Search Input */}
          <div className="relative">
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
              Cari Nama Kelas
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Contoh: VII A, VIII B..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all placeholder-gray-400"
              />
            </div>
          </div>

          {/* Filter Grade Level */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
              Tingkat Kelas
            </label>
            <select
              value={filterGradeLevel}
              onChange={(e) => setFilterGradeLevel(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
            >
              <option value="Semua">Semua Tingkat</option>
              <option value="VII">VII (Tujuh)</option>
              <option value="VIII">VIII (Delapan)</option>
              <option value="IX">IX (Sembilan)</option>
            </select>
          </div>

          {/* Filter Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
              Status Kelas
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>

          {/* Filter Academic Year */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
              Tahun Ajaran
            </label>
            <select
              value={filterAcademicYear}
              onChange={(e) => setFilterAcademicYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
            >
              <option value="Semua">Semua Tahun Ajaran</option>
              {uniqueYearsFilter.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Filters Summary & Data Export Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-center pt-3 border-t border-gray-100 dark:border-zinc-850 gap-3">
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            Ditemukan <strong className="text-blue-600 dark:text-blue-400">{filteredClasses.length}</strong> kelas dari total {classes.length} kelas aktif.
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={refetchClasses}
              className="p-2 hover:bg-gray-150 dark:hover:bg-zinc-800 text-gray-500 hover:text-blue-600 rounded-xl transition-all cursor-pointer border border-gray-200 dark:border-zinc-850"
              title="Segarkan data"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            
            <button
              onClick={handleExportExcel}
              disabled={filteredClasses.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-zinc-850 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-gray-600 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              title="Ekspor ke Excel"
            >
              <TableProperties className="h-3.5 w-3.5" />
              <span>Unduh Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={filteredClasses.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-zinc-850 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-gray-600 hover:text-rose-600 dark:text-zinc-300 dark:hover:text-rose-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40"
              title="Ekspor ke PDF"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Unduh PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-150 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/75 dark:bg-zinc-950 border-b border-gray-200 dark:border-zinc-850 text-gray-500 dark:text-zinc-400 font-extrabold uppercase tracking-wider">
                <th className="px-5 py-4 text-center w-12">No</th>
                <th className="px-5 py-4">Nama Kelas</th>
                <th className="px-5 py-4 text-center">Tingkat</th>
                <th className="px-5 py-4">Wali Kelas</th>
                <th className="px-5 py-4 text-center">Kapasitas</th>
                <th className="px-5 py-4">Tahun Ajaran</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right pr-6">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-850">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-400 dark:text-zinc-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <DoorClosed className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
                      <p className="text-sm font-semibold">Tidak Ada Data Kelas Ditemukan</p>
                      <p className="text-xs text-gray-400 max-w-xs">
                        Silakan sesuaikan filter pencarian atau buat kelas baru menggunakan tombol di kanan atas.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls, index) => {
                  return (
                    <tr 
                      key={cls.id} 
                      className="hover:bg-gray-50/60 dark:hover:bg-zinc-950/40 text-gray-700 dark:text-zinc-300 transition-colors"
                    >
                      {/* No Row */}
                      <td className="px-5 py-4 text-center font-mono font-medium text-gray-400">
                        {index + 1}
                      </td>

                      {/* Class Name */}
                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-900 dark:text-white block">
                          {cls.name}
                        </span>
                        {cls.roomCode && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            Ruang: {cls.roomCode}
                          </span>
                        )}
                      </td>

                      {/* Grade Level */}
                      <td className="px-5 py-4 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 rounded-full font-bold text-[10px]">
                          Tingkat {cls.gradeLevel || cls.grade}
                        </span>
                      </td>

                      {/* Wali Kelas */}
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900 dark:text-zinc-100 block">
                          {cls.homeroomTeacherName || cls.waliKelasName || "Belum Ditunjuk"}
                        </span>
                      </td>

                      {/* Capacity */}
                      <td className="px-5 py-4 text-center font-mono">
                        <span className="text-gray-900 dark:text-white font-semibold">
                          {cls.capacity}
                        </span>
                        <span className="text-gray-400 dark:text-zinc-500 text-[10px] ml-1">Siswa</span>
                      </td>

                      {/* Academic Year */}
                      <td className="px-5 py-4">
                        <span className="font-medium text-gray-600 dark:text-zinc-400">
                          {cls.academicYear || "-"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 text-center">
                        {cls.status === "Aktif" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-extrabold">
                            <span className="w-1 h-1 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 rounded-full text-[10px] font-extrabold">
                            <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-zinc-500" />
                            Nonaktif
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right pr-6">
                        <div className="flex justify-end items-center gap-1">
                          
                          {/* Detail Action */}
                          <button
                            onClick={() => handleDetailOpen(cls)}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="Detail Kelas"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Edit Action */}
                          <button
                            onClick={() => handleEditOpen(cls)}
                            className="p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="Edit Kelas"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Delete Action */}
                          <button
                            onClick={() => handleDeleteOpen(cls)}
                            className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="Hapus Kelas"
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
      </div>

      {/* ================================================== */}
      {/* 1. Modal Dialog: TAMBAH KELAS BARU */}
      {/* ================================================== */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Rombongan Belajar (Kelas) Baru"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-1">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nama Kelas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Nama Kelas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="E.g., VII A, VIII B, IX C"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.name ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.name && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.name}
                </span>
              )}
            </div>

            {/* Tingkat Kelas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tingkat <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gradeLevel}
                onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="VII">VII (Tujuh)</option>
                <option value="VIII">VIII (Delapan)</option>
                <option value="IX">IX (Sembilan)</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Ruangan (roomCode) */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Kode Ruang Kelas <span className="text-gray-400 text-[10px] font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="E.g., R-201, LAB-1"
                value={formData.roomCode}
                onChange={(e) => setFormData({ ...formData, roomCode: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
              />
            </div>

            {/* Kapasitas Kelas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Kapasitas Belajar (Siswa) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="32"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.capacity ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.capacity && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.capacity}
                </span>
              )}
            </div>

          </div>

          {/* Wali Kelas Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
              Guru Wali Kelas <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.homeroomTeacherId}
              onChange={(e) => setFormData({ ...formData, homeroomTeacherId: e.target.value })}
              className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                formErrors.homeroomTeacherId ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
              } rounded-xl focus:outline-hidden focus:ring-2`}
            >
              <option value="">-- Pilih Guru Wali Kelas --</option>
              {getAvailableTeachers().map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.nip ? `(NIP: ${t.nip})` : "(Belum Ada NIP)"}
                </option>
              ))}
            </select>
            {formErrors.homeroomTeacherId && (
              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                {formErrors.homeroomTeacherId}
              </span>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              Hanya menampilkan guru yang belum ditunjuk menjadi Wali Kelas di kelas aktif mana pun.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Tahun Ajaran */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tahun Ajaran <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="">-- Pilih Tahun Ajaran --</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.year}>
                    {ay.year} {ay.isActive ? "(Aktif)" : ""}
                  </option>
                ))}
              </select>
              {formErrors.academicYear && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.academicYear}
                </span>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Status Kelas <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-850 mt-4">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
            >
              {createMutation.isPending ? "Menyimpan..." : "Simpan Kelas"}
            </button>
          </div>

        </form>
      </Dialog>

      {/* ================================================== */}
      {/* 2. Modal Dialog: EDIT DATA KELAS */}
      {/* ================================================== */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Data Rombongan Belajar: ${selectedClass?.name || ""}`}
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Nama Kelas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Nama Kelas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="E.g., VII A, VIII B, IX C"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.name ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.name && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.name}
                </span>
              )}
            </div>

            {/* Tingkat Kelas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tingkat <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.gradeLevel}
                onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="VII">VII (Tujuh)</option>
                <option value="VIII">VIII (Delapan)</option>
                <option value="IX">IX (Sembilan)</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Ruangan (roomCode) */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Kode Ruang Kelas <span className="text-gray-400 text-[10px] font-normal">(Opsional)</span>
              </label>
              <input
                type="text"
                placeholder="E.g., R-201, LAB-1"
                value={formData.roomCode}
                onChange={(e) => setFormData({ ...formData, roomCode: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
              />
            </div>

            {/* Kapasitas Kelas */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Kapasitas Belajar (Siswa) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="32"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.capacity ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.capacity && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.capacity}
                </span>
              )}
            </div>

          </div>

          {/* Wali Kelas Selection */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
              Guru Wali Kelas <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.homeroomTeacherId}
              onChange={(e) => setFormData({ ...formData, homeroomTeacherId: e.target.value })}
              className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                formErrors.homeroomTeacherId ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
              } rounded-xl focus:outline-hidden focus:ring-2`}
            >
              <option value="">-- Pilih Guru Wali Kelas --</option>
              {getAvailableTeachers(selectedClass?.homeroomTeacherId || selectedClass?.waliKelasId).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.nip ? `(NIP: ${t.nip})` : "(Belum Ada NIP)"}
                </option>
              ))}
            </select>
            {formErrors.homeroomTeacherId && (
              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                {formErrors.homeroomTeacherId}
              </span>
            )}
            <p className="text-[10px] text-gray-400 mt-1">
              Menampilkan guru yang belum ditunjuk menjadi Wali Kelas di kelas aktif mana pun, ditambah wali kelas petahana saat ini.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Tahun Ajaran */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tahun Ajaran <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.academicYear}
                onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="">-- Pilih Tahun Ajaran --</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.year}>
                    {ay.year} {ay.isActive ? "(Aktif)" : ""}
                  </option>
                ))}
              </select>
              {formErrors.academicYear && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.academicYear}
                </span>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Status Kelas <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="Aktif">Aktif</option>
                <option value="Nonaktif">Nonaktif</option>
              </select>
            </div>

          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-850 mt-4">
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
            >
              {updateMutation.isPending ? "Memperbarui..." : "Simpan Perubahan"}
            </button>
          </div>

        </form>
      </Dialog>

      {/* ================================================== */}
      {/* 3. Modal Dialog: DETAIL LENGKAP KELAS */}
      {/* ================================================== */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Informasi Detail Kelas: ${selectedClass?.name || ""}`}
        size="md"
      >
        {selectedClass && (
          <div className="space-y-5 pt-2">
            
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-zinc-950 rounded-2xl border border-gray-200 dark:border-zinc-850">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <DoorClosed className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  {selectedClass.name}
                </h4>
                <p className="text-xs text-gray-400 font-mono">
                  ID: {selectedClass.id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              
              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Tingkat Kelas
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                  Tingkat {selectedClass.gradeLevel || selectedClass.grade}
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Kode Ruangan
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 font-mono">
                  {selectedClass.roomCode || "-"}
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Kapasitas Belajar
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 font-mono">
                  {selectedClass.capacity} Siswa
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Tahun Pelajaran
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                  {selectedClass.academicYear || "-"}
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Status Aktif
                </span>
                {selectedClass.status === "Aktif" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-0.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-gray-500 dark:text-zinc-400 text-xs font-bold mt-0.5">
                    <XCircle className="h-3.5 w-3.5" />
                    Nonaktif
                  </span>
                )}
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Tanggal Pembuatan
                </span>
                <span className="text-xs font-medium text-gray-750 dark:text-zinc-350">
                  {selectedClass.createdAt ? new Date(selectedClass.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  }) : "-"}
                </span>
              </div>

            </div>

            <div className="bg-blue-50/50 dark:bg-zinc-950/40 p-4 rounded-xl border border-blue-100 dark:border-zinc-850">
              <span className="block text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                Informasi Wali Kelas
              </span>
              <p className="text-xs font-bold text-gray-900 dark:text-white">
                {selectedClass.homeroomTeacherName || selectedClass.waliKelasName || "Belum Ditunjuk"}
              </p>
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                Guru wali kelas bertanggung jawab penuh atas bimbingan rombongan belajar, penilaian kinerja, serta penyusunan buku rapor bagi kelas ini.
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>

          </div>
        )}
      </Dialog>

      {/* ================================================== */}
      {/* 4. Modal Dialog: HAPUS KELAS (SOFT DELETE) */}
      {/* ================================================== */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Konfirmasi Hapus Kelas"
        size="sm"
      >
        {selectedClass && (
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/30">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">
                Tindakan ini tidak dapat dibatalkan secara langsung!
              </p>
            </div>

            <p className="text-xs text-gray-650 dark:text-zinc-350 leading-relaxed">
              Apakah Anda benar-benar ingin menghapus kelas <strong className="text-gray-900 dark:text-white">"{selectedClass.name}"</strong>?
            </p>
            
            <ul className="text-[10.5px] text-gray-400 dark:text-zinc-500 list-disc pl-4 space-y-1">
              <li>Kelas ini akan diarsipkan (Soft Delete).</li>
              <li>Guru wali kelas ({selectedClass.homeroomTeacherName || selectedClass.waliKelasName || "Belum Ditunjuk"}) akan dibebastugaskan dari jabatan wali kelas ini.</li>
              <li>Struktur Kurikulum Matrix, Jadwal Pelajaran, dan Jurnal Harian akan terpengaruh.</li>
            </ul>

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
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Menghapus..." : "Ya, Hapus Kelas"}
              </button>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default Classes;
