import React, { useState, useMemo } from "react";
import { useSemesters } from "../hooks/semester.hook";
import { useAcademicYears } from "../hooks/academicYear.hook";
import { Semester } from "../types";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { useAuth } from "../contexts/AuthContext";
import { 
  CalendarDays, 
  CalendarRange,
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Search, 
  AlertTriangle,
  Play,
  Activity,
  Info,
  Check
} from "lucide-react";

export const Semesters: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const {
    semesters,
    isLoading: isLoadingSemesters,
    createSemester,
    isCreating,
    updateSemester,
    isUpdating,
    deleteSemester,
    isDeleting,
    setActiveSemester,
    isSettingActive
  } = useSemesters();

  const {
    academicYears,
    isLoading: isLoadingYears
  } = useAcademicYears();

  const isAdmin = user?.role === "admin";

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSemester, setSelectedSemester] = useState<Semester | null>(null);

  // Search and Filter States
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterAcademicYear, setFilterAcademicYear] = useState<string>("Semua");

  // Form State & Inline Validation Errors
  const [formData, setFormData] = useState({
    academicYearId: "",
    name: "Semester 1",
    code: "S1",
    startDate: "",
    endDate: "",
    isActive: false
  });

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Form field reset helper
  const resetForm = () => {
    setFormData({
      academicYearId: "",
      name: "Semester 1",
      code: "S1",
      startDate: "",
      endDate: "",
      isActive: false
    });
    setFormErrors({});
    setServerError(null);
  };

  // Open Create Dialog
  const handleCreateOpen = () => {
    resetForm();
    // Default to first academic year if available
    const activeAY = academicYears.find(ay => ay.isActive);
    const defaultAY = activeAY || (academicYears.length > 0 ? academicYears[0] : null);
    
    setFormData({
      academicYearId: defaultAY ? defaultAY.id : "",
      name: "Semester 1",
      code: "S1",
      startDate: "",
      endDate: "",
      isActive: false
    });
    setIsCreateOpen(true);
  };

  // Open Edit Dialog
  const handleEditOpen = (sem: Semester) => {
    setSelectedSemester(sem);
    setFormData({
      academicYearId: sem.academicYearId || "",
      name: sem.name || "Semester 1",
      code: sem.code || "S1",
      startDate: sem.startDate || "",
      endDate: sem.endDate || "",
      isActive: sem.isActive
    });
    setFormErrors({});
    setServerError(null);
    setIsEditOpen(true);
  };

  // Open Detail Dialog
  const handleDetailOpen = (sem: Semester) => {
    setSelectedSemester(sem);
    setIsDetailOpen(true);
  };

  // Open Delete Dialog
  const handleDeleteOpen = (sem: Semester) => {
    if (sem.isActive) {
      toast("Semester yang sedang aktif tidak boleh dihapus!", "error");
      return;
    }
    setSelectedSemester(sem);
    setIsDeleteOpen(true);
  };

  // On Name Change, Auto set Code
  const handleNameChange = (nameVal: string) => {
    const codeVal = nameVal === "Semester 1" ? "S1" : "S2";
    setFormData(prev => ({
      ...prev,
      name: nameVal,
      code: codeVal
    }));
  };

  // Validate form inline
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};

    if (!formData.academicYearId) {
      errors.academicYearId = "Tahun Pelajaran wajib dipilih!";
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
    setServerError(null);
    if (!validateForm()) return;

    try {
      await createSemester(formData);
      setIsCreateOpen(false);
    } catch (err: any) {
      setServerError(err.message || "Gagal menyimpan semester.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!selectedSemester) return;
    if (!validateForm()) return;

    try {
      await updateSemester({
        id: selectedSemester.id,
        data: formData
      });
      setIsEditOpen(false);
    } catch (err: any) {
      setServerError(err.message || "Gagal memperbarui semester.");
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedSemester) return;
    try {
      await deleteSemester(selectedSemester.id);
      setIsDeleteOpen(false);
    } catch (err: any) {
      toast(err.message || "Gagal menghapus semester.", "error");
    }
  };

  const handleSetSemesterActive = async (sem: Semester) => {
    try {
      await setActiveSemester(sem.id);
    } catch (err: any) {
      toast(err.message || "Gagal mengaktifkan semester.", "error");
    }
  };

  // Filter & Search Logic
  const filteredSemesters = useMemo(() => {
    return semesters.filter((sem) => {
      // 1. Search keyword
      const keyword = searchKeyword.toLowerCase().trim();
      const matchSearch = 
        sem.name.toLowerCase().includes(keyword) ||
        sem.code.toLowerCase().includes(keyword) ||
        sem.academicYearName.toLowerCase().includes(keyword);

      // 2. Filter Academic Year
      const matchAY = 
        filterAcademicYear === "Semua" || 
        sem.academicYearId === filterAcademicYear;

      return matchSearch && matchAY;
    });
  }, [semesters, searchKeyword, filterAcademicYear]);

  // Loading indicator for main screen
  const isMainLoading = isLoadingSemesters || isLoadingYears;

  return (
    <div className="space-y-6">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-zinc-800 rounded-xl text-blue-600 dark:text-blue-400">
            <CalendarRange className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Master Data Semester</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Kelola data Semester 1 & 2 per Tahun Pelajaran, tanggal aktif, dan periode pembelajaran.</p>
          </div>
        </div>
        
        {isAdmin && (
          <button
            onClick={handleCreateOpen}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-blue-500/10 cursor-pointer transition-all"
          >
            <Plus className="h-4.5 w-4.5" />
            Tambah Semester
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Cari semester atau tahun pelajaran..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Dropdown Academic Year */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 whitespace-nowrap">Tahun Pelajaran:</span>
            <select
              value={filterAcademicYear}
              onChange={(e) => setFilterAcademicYear(e.target.value)}
              className="w-full sm:w-48 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-medium"
            >
              <option value="Semua">Semua Tahun Pelajaran</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.name || ay.year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs overflow-hidden">
        {isMainLoading ? (
          <div className="py-20">
            <Loading variant="full" text="Menghubungkan ke database & memuat data..." />
          </div>
        ) : filteredSemesters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 rounded-full mb-4">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200">Tidak Ada Data Semester</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mt-1">
              {searchKeyword || filterAcademicYear !== "Semua" 
                ? "Tidak ada data semester yang cocok dengan kriteria pencarian dan filter Anda." 
                : "Belum ada semester yang terdaftar dalam sistem. Silakan tambahkan semester baru."}
            </p>
            {(searchKeyword || filterAcademicYear !== "Semua") && (
              <button
                onClick={() => {
                  setSearchKeyword("");
                  setFilterAcademicYear("Semua");
                }}
                className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Atur Ulang Pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-100 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider w-16 text-center">No</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tahun Pelajaran</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Semester</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Kode</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tanggal Mulai</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tanggal Selesai</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider w-36 text-center">Status Aktif</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider w-40 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredSemesters.map((sem, index) => {
                  return (
                    <tr 
                      key={sem.id} 
                      className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/30 transition-colors"
                    >
                      <td className="px-6 py-4 text-center font-medium text-xs text-slate-500 dark:text-zinc-400">{index + 1}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {sem.academicYearName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-slate-800 dark:text-zinc-300">
                          {sem.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 font-mono text-[11px] font-bold bg-slate-100 dark:bg-zinc-800 rounded-md text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/50">
                          {sem.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                        {sem.startDate ? new Date(sem.startDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600 dark:text-zinc-300 font-medium">
                        {sem.endDate ? new Date(sem.endDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {sem.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-400 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            AKTIF
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-zinc-800 border border-slate-100 dark:border-zinc-700 rounded-full text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            NONAKTIF
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Set Active Button */}
                          {isAdmin && !sem.isActive && (
                            <button
                              onClick={() => handleSetSemesterActive(sem)}
                              disabled={isSettingActive}
                              title="Set Semester ini Aktif"
                              className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                            >
                              <Play className="h-4 w-4 fill-current" />
                            </button>
                          )}
                          
                          {/* Detail Button */}
                          <button
                            onClick={() => handleDetailOpen(sem)}
                            title="Detail Semester"
                            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {/* Edit Button */}
                          {isAdmin && (
                            <button
                              onClick={() => handleEditOpen(sem)}
                              title="Edit Data"
                              className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950/20 rounded-lg cursor-pointer transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteOpen(sem)}
                              title="Hapus Data"
                              className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Semester Baru"
        size="md"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {serverError && (
            <div className="flex gap-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-3.5 rounded-xl text-rose-800 dark:text-rose-400 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Academic Year Relational Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tahun Pelajaran *</label>
            <select
              value={formData.academicYearId}
              onChange={(e) => setFormData(prev => ({ ...prev, academicYearId: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-medium"
            >
              <option value="">-- Pilih Tahun Pelajaran --</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.name || ay.year} {ay.isActive ? "(Aktif)" : "(Nonaktif)"}</option>
              ))}
            </select>
            {formErrors.academicYearId && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{formErrors.academicYearId}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Semester Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Semester *</label>
              <select
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-medium"
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
              </select>
            </div>

            {/* Code readonly */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Kode Semester</label>
              <input
                type="text"
                value={formData.code}
                readOnly
                className="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs outline-none font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tanggal Mulai *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              {formErrors.startDate && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{formErrors.startDate}</span>
              )}
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tanggal Selesai *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              {formErrors.endDate && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{formErrors.endDate}</span>
              )}
            </div>
          </div>

          {/* Is Active Checkbox */}
          <div className="flex items-center gap-2.5 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4.5 w-4.5 text-blue-600 border-slate-300 rounded-lg focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="isActive" className="text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
              Set semester ini aktif langsung (akan otomatis menonaktifkan semester lain di tahun ajaran yang sama)
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-65"
            >
              {isCreating && <Loading variant="inline" text="" />}
              Simpan Semester
            </button>
          </div>
        </form>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Edit Data Semester"
        size="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          {serverError && (
            <div className="flex gap-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-3.5 rounded-xl text-rose-800 dark:text-rose-400 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Academic Year Relational Dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tahun Pelajaran *</label>
            <select
              value={formData.academicYearId}
              onChange={(e) => setFormData(prev => ({ ...prev, academicYearId: e.target.value }))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-medium"
            >
              <option value="">-- Pilih Tahun Pelajaran --</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.name || ay.year} {ay.isActive ? "(Aktif)" : "(Nonaktif)"}</option>
              ))}
            </select>
            {formErrors.academicYearId && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{formErrors.academicYearId}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Semester Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Semester *</label>
              <select
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none cursor-pointer font-medium"
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
              </select>
            </div>

            {/* Code readonly */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Kode Semester</label>
              <input
                type="text"
                value={formData.code}
                readOnly
                className="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs outline-none font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tanggal Mulai *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              {formErrors.startDate && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{formErrors.startDate}</span>
              )}
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tanggal Selesai *</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
              {formErrors.endDate && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">{formErrors.endDate}</span>
              )}
            </div>
          </div>

          {/* Is Active Checkbox */}
          <div className="flex items-center gap-2.5 pt-2">
            <input
              type="checkbox"
              id="isActiveEdit"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="h-4.5 w-4.5 text-blue-600 border-slate-300 rounded-lg focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="isActiveEdit" className="text-xs font-semibold text-slate-700 dark:text-zinc-300 cursor-pointer select-none">
              Set semester ini aktif langsung (menonaktifkan semester lain di tahun ajaran yang sama)
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Batalkan
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors disabled:opacity-65"
            >
              {isUpdating && <Loading variant="inline" text="" />}
              Perbarui Data
            </button>
          </div>
        </form>
      </Dialog>

      {/* DETAIL MODAL */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Detail Informasi Semester"
        size="md"
      >
        {selectedSemester && (
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/80">
              <div className="p-2.5 bg-blue-50 dark:bg-zinc-900 rounded-lg text-blue-600 dark:text-blue-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Tahun Pelajaran</h4>
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-50">{selectedSemester.academicYearName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Semester</span>
                <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 mt-0.5">{selectedSemester.name}</p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Kode Semester</span>
                <p className="text-sm font-mono font-bold text-slate-800 dark:text-zinc-200 mt-0.5">{selectedSemester.code}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Tanggal Mulai</span>
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-1">
                  {selectedSemester.startDate ? new Date(selectedSemester.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Tanggal Selesai</span>
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-1">
                  {selectedSemester.endDate ? new Date(selectedSemester.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Status Aktif</span>
                <p className="mt-1">
                  {selectedSemester.isActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      AKTIF
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-zinc-850 border border-slate-200 rounded-full text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      NONAKTIF
                    </span>
                  )}
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Diperbarui Pada</span>
                <p className="text-[11px] font-medium text-slate-600 dark:text-zinc-400 mt-1">
                  {selectedSemester.updatedAt ? new Date(selectedSemester.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide">Log Entri & Perubahan</span>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-zinc-400 font-medium pt-1">
                <div>Pembuat: <span className="font-semibold text-slate-700 dark:text-zinc-200">{selectedSemester.createdBy || "-"}</span></div>
                <div>Pengubah: <span className="font-semibold text-slate-700 dark:text-zinc-200">{selectedSemester.updatedBy || "-"}</span></div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* CONFIRM DELETE MODAL */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus Semester"
        size="sm"
      >
        {selectedSemester && (
          <div className="space-y-4">
            <div className="flex gap-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-4 rounded-xl text-rose-800 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Konfirmasi Penghapusan Data</p>
                <p className="font-medium opacity-90">
                  Apakah Anda yakin ingin menghapus semester <span className="font-bold">"{selectedSemester.name}"</span> pada tahun pelajaran <span className="font-bold">"{selectedSemester.academicYearName}"</span>? Tindakan ini menggunakan Soft Delete dan tidak merusak integritas data historis.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-750 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                {isDeleting && <Loading variant="inline" text="" />}
                Ya, Hapus Data
              </button>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default Semesters;
