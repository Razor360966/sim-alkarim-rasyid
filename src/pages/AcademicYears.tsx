import React, { useState, useMemo } from "react";
import { useAcademicYears } from "../hooks/academicYear.hook";
import { AcademicYear } from "../types";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { 
  Calendar, 
  CalendarRange,
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Search, 
  ChevronRight, 
  AlertTriangle,
  Play,
  Activity,
  Info
} from "lucide-react";

export const AcademicYears: React.FC = () => {
  const { toast } = useToast();
  const {
    academicYears,
    isLoading,
    refetch,
    createAcademicYear,
    isCreating,
    updateAcademicYear,
    isUpdating,
    deleteAcademicYear,
    isDeleting,
    setActiveAcademicYear,
    isSettingActive
  } = useAcademicYears();

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState<AcademicYear | null>(null);

  // Search and Filter States
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterActiveStatus, setFilterActiveStatus] = useState<string>("Semua");

  // Form State & Inline Validation Errors
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    isActive: false,
    semester: "Ganjil" as "Ganjil" | "Genap"
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Form field reset helper
  const resetForm = () => {
    setFormData({
      name: "",
      startDate: "",
      endDate: "",
      isActive: false,
      semester: "Ganjil"
    });
    setFormErrors({});
  };

  // Open Create Dialog
  const handleCreateOpen = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  // Open Edit Dialog
  const handleEditOpen = (year: AcademicYear) => {
    setSelectedYear(year);
    setFormData({
      name: year.name || year.year || "",
      startDate: year.startDate || "",
      endDate: year.endDate || "",
      isActive: year.isActive,
      semester: year.semester || "Ganjil"
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  // Open Detail Dialog
  const handleDetailOpen = (year: AcademicYear) => {
    setSelectedYear(year);
    setIsDetailOpen(true);
  };

  // Open Delete Dialog
  const handleDeleteOpen = (year: AcademicYear) => {
    if (year.isActive) {
      toast("Tahun pelajaran yang sedang aktif tidak boleh dihapus!", "error");
      return;
    }
    setSelectedYear(year);
    setIsDeleteOpen(true);
  };

  // Validate form inline
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    const yearName = formData.name.trim();
    if (!yearName) {
      errors.name = "Tahun pelajaran wajib diisi!";
    } else {
      const formatRegex = /^\d{4}\/\d{4}$/;
      if (!formatRegex.test(yearName)) {
        errors.name = "Format harus YYYY/YYYY (contoh: 2025/2026)";
      }
    }

    if (!formData.startDate) {
      errors.startDate = "Tanggal mulai wajib ditentukan!";
    }
    if (!formData.endDate) {
      errors.endDate = "Tanggal selesai wajib ditentukan!";
    }

    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (start >= end) {
        errors.endDate = "Tanggal selesai harus setelah tanggal mulai!";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handlers for mutations
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createAcademicYear(formData);
      setIsCreateOpen(false);
      resetForm();
    } catch (err: any) {
      console.error(err);
      // Toast message is handled inside the hook, but let's handle specialized unique name errors if needed
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (selectedYear) {
      try {
        await updateAcademicYear({
          id: selectedYear.id,
          data: formData
        });
        setIsEditOpen(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (selectedYear) {
      try {
        await deleteAcademicYear(selectedYear.id);
        setIsDeleteOpen(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSetActive = async (year: AcademicYear) => {
    try {
      await setActiveAcademicYear(year.id);
    } catch (err) {
      console.error(err);
    }
  };

  // Local Search & Multi-Faceted Filters
  const filteredYears = useMemo(() => {
    return academicYears.filter((year) => {
      // 1. Search by name (case-insensitive)
      const matchesSearch = (year.name || year.year || "").toLowerCase().includes(searchKeyword.toLowerCase());

      // 2. Filter by active status
      const matchesActive = 
        filterActiveStatus === "Semua" || 
        (filterActiveStatus === "Aktif" && year.isActive) ||
        (filterActiveStatus === "Nonaktif" && !year.isActive);

      return matchesSearch && matchesActive;
    });
  }, [academicYears, searchKeyword, filterActiveStatus]);

  // Date formatting helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (isLoading) {
    return <Loading variant="full" text="Memuat modul Tahun Pelajaran..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col space-y-1">
        <nav className="flex items-center text-xs text-gray-500 dark:text-zinc-400 gap-1.5">
          <span className="hover:text-blue-600 transition-colors cursor-default">Master Data</span>
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-semibold text-gray-800 dark:text-zinc-200">Tahun Pelajaran</span>
        </nav>
        
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarRange className="h-7 w-7 text-blue-600 dark:text-blue-500" />
              Tahun Pelajaran
            </h1>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
              Atur, definisikan periode, dan kelola tahun pelajaran serta semester aktif di SMP ALKARIM RASYID
            </p>
          </div>
          
          <button
            onClick={handleCreateOpen}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Tahun Pelajaran
          </button>
        </div>
      </div>

      {/* Info Warning banner about Active Year requirement */}
      {!academicYears.some((y) => y.isActive) && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-2xl">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">Tidak Ada Tahun Pelajaran Aktif!</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
              Sistem membutuhkan <strong>satu</strong> tahun pelajaran aktif agar modul akademik lainnya (kelas, struktur kurikulum matrix, jadwal pelajaran, dsb) dapat berjalan. Silakan pilih salah satu tahun pelajaran di bawah dan klik tombol <strong>Aktifkan</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search Bento Box */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-150 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-xs font-extrabold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
          Penyaringan & Pencarian Tahun Pelajaran
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
              Cari Berdasarkan Nama
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Cari tahun pelajaran (contoh: 2025/2026)..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all placeholder-gray-400"
              />
            </div>
          </div>

          {/* Filter Status Aktif */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 dark:text-zinc-400 mb-1">
              Status Keaktifan
            </label>
            <select
              value={filterActiveStatus}
              onChange={(e) => setFilterActiveStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all"
            >
              <option value="Semua">Semua Status</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </div>

        </div>

        <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-zinc-850">
          <div className="text-xs text-gray-500 dark:text-zinc-400">
            Menampilkan <strong className="text-blue-600 dark:text-blue-400">{filteredYears.length}</strong> tahun pelajaran dari total {academicYears.length}.
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
                <th className="px-5 py-4">Tahun Pelajaran</th>
                <th className="px-5 py-4">Semester Default</th>
                <th className="px-5 py-4">Tanggal Mulai</th>
                <th className="px-5 py-4">Tanggal Selesai</th>
                <th className="px-5 py-4 text-center">Status Aktif</th>
                <th className="px-5 py-4 text-center pr-6">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-850">
              {filteredYears.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400 dark:text-zinc-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Calendar className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
                      <p className="text-sm font-semibold">Tidak Ada Data Tahun Pelajaran</p>
                      <p className="text-xs text-gray-400 max-w-xs">
                        Gunakan tombol di atas untuk menambahkan tahun pelajaran atau sesuaikan pencarian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredYears.map((year, index) => {
                  return (
                    <tr 
                      key={year.id} 
                      className="hover:bg-gray-50/60 dark:hover:bg-zinc-950/40 text-gray-700 dark:text-zinc-300 transition-colors"
                    >
                      {/* No */}
                      <td className="px-5 py-4 text-center font-mono font-medium text-gray-400">
                        {index + 1}
                      </td>

                      {/* Name / Year */}
                      <td className="px-5 py-4">
                        <span className="font-bold text-gray-900 dark:text-white block text-sm">
                          {year.name || year.year}
                        </span>
                      </td>

                      {/* Semester */}
                      <td className="px-5 py-4 font-semibold text-gray-650 dark:text-zinc-350">
                        Semester {year.semester || "Ganjil"}
                      </td>

                      {/* Start Date */}
                      <td className="px-5 py-4">
                        <span className="font-medium text-gray-600 dark:text-zinc-400">
                          {formatDate(year.startDate)}
                        </span>
                      </td>

                      {/* End Date */}
                      <td className="px-5 py-4">
                        <span className="font-medium text-gray-600 dark:text-zinc-400">
                          {formatDate(year.endDate)}
                        </span>
                      </td>

                      {/* Status Aktif */}
                      <td className="px-5 py-4 text-center">
                        {year.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-extrabold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" />
                            Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-100 dark:bg-zinc-850 text-gray-600 dark:text-zinc-400 rounded-full text-[10px] font-extrabold">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-zinc-500" />
                            Nonaktif
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-5 py-4 text-center pr-6">
                        <div className="flex justify-center items-center gap-1.5">
                          
                          {/* Set Active action (high contrast action) */}
                          {!year.isActive && (
                            <button
                              onClick={() => handleSetActive(year)}
                              disabled={isSettingActive}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-600 dark:bg-blue-950/20 dark:hover:bg-blue-500 text-blue-700 hover:text-white dark:text-blue-400 dark:hover:text-white rounded-lg text-xs font-extrabold shadow-2xs hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                              title="Set Aktifkan Tahun Pelajaran Ini"
                            >
                              <Play className="h-3 w-3 fill-current" />
                              <span>Aktifkan</span>
                            </button>
                          )}

                          {/* Detail Action */}
                          <button
                            onClick={() => handleDetailOpen(year)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="Detail Lengkap"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit Action */}
                          <button
                            onClick={() => handleEditOpen(year)}
                            className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                            title="Edit Data"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Action */}
                          {!year.isActive && (
                            <button
                              onClick={() => handleDeleteOpen(year)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                              title="Hapus Soft Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}

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
      {/* 1. Modal Dialog: TAMBAH TAHUN PELAJARAN */}
      {/* ================================================== */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Tahun Pelajaran Baru"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-1">
          
          {/* Nama Tahun Pelajaran */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
              Nama Tahun Pelajaran <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="E.g., 2025/2026, 2026/2027"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                formErrors.name ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
              } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
            />
            {formErrors.name ? (
              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                {formErrors.name}
              </span>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">
                Harus berupa rentang tahun dengan format YYYY/YYYY (contoh: 2025/2026)
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Tanggal Mulai */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.startDate ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.startDate && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.startDate}
                </span>
              )}
            </div>

            {/* Tanggal Selesai */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tanggal Selesai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.endDate ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.endDate && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.endDate}
                </span>
              )}
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Semester (for backward compatibility) */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Semester Default <span className="text-gray-400 text-[10px] font-normal">(Kompatibilitas)</span>
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>

            {/* Checkbox Set Active */}
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isActiveCreate"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="isActiveCreate" className="text-xs font-bold text-gray-700 dark:text-zinc-300 cursor-pointer">
                Set sebagai Tahun Pelajaran Aktif
              </label>
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
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
            >
              {isCreating ? "Menyimpan..." : "Simpan Data"}
            </button>
          </div>

        </form>
      </Dialog>

      {/* ================================================== */}
      {/* 2. Modal Dialog: EDIT TAHUN PELAJARAN */}
      {/* ================================================== */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Tahun Pelajaran: ${selectedYear?.name || ""}`}
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4 pt-1">
          
          {/* Nama Tahun Pelajaran */}
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
              Nama Tahun Pelajaran <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="E.g., 2025/2026, 2026/2027"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                formErrors.name ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
              } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
            />
            {formErrors.name ? (
              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                {formErrors.name}
              </span>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">
                Format harus berformat YYYY/YYYY (contoh: 2025/2026)
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Tanggal Mulai */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tanggal Mulai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.startDate ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.startDate && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.startDate}
                </span>
              )}
            </div>

            {/* Tanggal Selesai */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Tanggal Selesai <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className={`w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border ${
                  formErrors.endDate ? "border-rose-500 focus:ring-rose-500/10" : "border-gray-200 dark:border-zinc-850"
                } rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all`}
              />
              {formErrors.endDate && (
                <span className="text-[10px] text-rose-500 font-bold block mt-1">
                  {formErrors.endDate}
                </span>
              )}
            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Semester (for backward compatibility) */}
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-zinc-400 mb-1.5">
                Semester Default <span className="text-gray-400 text-[10px] font-normal">(Kompatibilitas)</span>
              </label>
              <select
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value as any })}
                className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-850 rounded-xl focus:outline-hidden focus:ring-2"
              >
                <option value="Ganjil">Semester Ganjil</option>
                <option value="Genap">Semester Genap</option>
              </select>
            </div>

            {/* Checkbox Set Active */}
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isActiveEdit"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                disabled={selectedYear?.isActive} // Cannot deactivate from here if it is already active
              />
              <label htmlFor="isActiveEdit" className="text-xs font-bold text-gray-700 dark:text-zinc-300 cursor-pointer">
                Set sebagai Tahun Pelajaran Aktif
              </label>
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
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
            >
              {isUpdating ? "Memperbarui..." : "Simpan Perubahan"}
            </button>
          </div>

        </form>
      </Dialog>

      {/* ================================================== */}
      {/* 3. Modal Dialog: DETAIL LENGKAP TAHUN PELAJARAN */}
      {/* ================================================== */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Informasi Detail Tahun Pelajaran: ${selectedYear?.name || ""}`}
        size="md"
      >
        {selectedYear && (
          <div className="space-y-5 pt-2">
            
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-zinc-950 rounded-2xl border border-gray-200 dark:border-zinc-850">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <CalendarRange className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Tahun Pelajaran {selectedYear.name || selectedYear.year}
                </h4>
                <p className="text-xs text-gray-400 font-mono">
                  ID: {selectedYear.id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              
              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850 col-span-2">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Periode Akademik Aktif
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-2">
                  <span>{formatDate(selectedYear.startDate)}</span>
                  <span className="text-gray-400">s/d</span>
                  <span>{formatDate(selectedYear.endDate)}</span>
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Semester Default
                </span>
                <span className="text-xs font-bold text-gray-800 dark:text-zinc-200">
                  Semester {selectedYear.semester || "Ganjil"}
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Status Sistem
                </span>
                {selectedYear.isActive ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-0.5 animate-pulse">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Aktif Saat Ini
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
                  Petugas Pembuat
                </span>
                <span className="text-xs font-semibold text-gray-750 dark:text-zinc-300">
                  {selectedYear.createdBy || "System"}
                </span>
              </div>

              <div className="bg-gray-50/50 dark:bg-zinc-950/40 p-3 rounded-xl border border-gray-100 dark:border-zinc-850">
                <span className="block text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                  Tanggal Pembuatan
                </span>
                <span className="text-xs font-medium text-gray-750 dark:text-zinc-350">
                  {selectedYear.createdAt ? formatDate(selectedYear.createdAt) : "-"}
                </span>
              </div>

            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Tutup Detail
              </button>
            </div>

          </div>
        )}
      </Dialog>

      {/* ================================================== */}
      {/* 4. Modal Dialog: KONFIRMASI SOFT DELETE */}
      {/* ================================================== */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Konfirmasi Hapus Tahun Pelajaran"
        size="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              Tindakan ini akan melakukan <strong>Soft Delete</strong> pada data tahun ajaran. Data tidak akan dihapus permanen, namun tidak akan dapat diakses oleh sistem atau digunakan oleh modul lainnya.
            </p>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
            Apakah Anda yakin ingin menghapus Tahun Pelajaran <strong className="text-gray-900 dark:text-white">{selectedYear?.name || selectedYear?.year}</strong>?
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
              disabled={isDeleting}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus Data"}
            </button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};

export default AcademicYears;
