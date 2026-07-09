import React, { useState, useMemo } from "react";
import { useSupervisionSchedules } from "../hooks/useSupervision";
import { useTeachers } from "../hooks/useTeachers";
import { useAcademicYears } from "../hooks/academicYear.hook";
import { useSemesters } from "../hooks/semester.hook";
import { useAuth } from "../contexts/AuthContext";
import { Dialog } from "../components/Dialog";
import { Loading } from "../components/Loading";
import {
  Calendar,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  UserCheck,
  FileText,
  CheckCircle,
  X,
  Grid,
  TrendingUp,
  Bookmark
} from "lucide-react";
import { SupervisionSchedule, SupervisionStatus, SupervisionType } from "../types";

export default function SupervisionSchedules() {
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
  const [filterYear, setFilterYear] = useState("");
  const [filterSem, setFilterSem] = useState("");
  const [filterSupervisorId, setFilterSupervisorId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Queries
  const {
    schedules,
    isLoading: isLoadingSchedules,
    createSchedule,
    isCreating,
    updateSchedule,
    isUpdating,
    deleteSchedule
  } = useSupervisionSchedules({
    academicYearId: filterYear || undefined,
    semesterId: filterSem || undefined,
    supervisorId: filterSupervisorId || undefined,
    type: (filterType as SupervisionType) || undefined,
    status: (filterStatus as SupervisionStatus) || undefined
  });

  const { teachers, isLoading: isLoadingTeachers } = useTeachers();
  const { academicYears, isLoading: isLoadingYears } = useAcademicYears();
  const { semesters, isLoading: isLoadingSemesters } = useSemesters();

  // Active elements
  const activeYear = useMemo(() => academicYears.find(y => y.isActive), [academicYears]);
  const activeSemester = useMemo(() => semesters.find(s => s.isActive), [semesters]);

  // Dialog States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<SupervisionSchedule | null>(null);

  // Form States
  const [formData, setFormData] = useState({
    teacherId: "",
    supervisorId: "",
    academicYearId: "",
    semesterId: "",
    type: "Akademik" as SupervisionType,
    date: "",
    status: "Belum Dijadwalkan" as SupervisionStatus,
    notes: ""
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Search filter
  const filteredSchedules = useMemo(() => {
    return schedules.filter(item => {
      const matchSearch =
        item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.supervisorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [schedules, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: schedules.length,
      academic: schedules.filter(s => s.type === "Akademik").length,
      managerial: schedules.filter(s => s.type === "Manajerial").length,
      scheduled: schedules.filter(s => s.status === "Terjadwal" || s.status === "Sedang Berlangsung").length
    };
  }, [schedules]);

  const resetForm = () => {
    setFormData({
      teacherId: "",
      supervisorId: "",
      academicYearId: activeYear?.id || (academicYears[0]?.id || ""),
      semesterId: activeSemester?.id || (semesters[0]?.id || ""),
      type: "Akademik" as SupervisionType,
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

  const handleOpenEdit = (sch: SupervisionSchedule) => {
    if (isReadOnly) return;
    setSelectedSchedule(sch);
    setFormData({
      teacherId: sch.teacherId,
      supervisorId: sch.supervisorId,
      academicYearId: sch.academicYearId,
      semesterId: sch.semesterId,
      type: sch.type,
      date: sch.date || "",
      status: sch.status,
      notes: sch.notes || ""
    });
    setFormErrors({});
    setIsEditOpen(true);
  };

  const handleOpenDetail = (sch: SupervisionSchedule) => {
    setSelectedSchedule(sch);
    setIsDetailOpen(true);
  };

  const handleOpenDelete = (sch: SupervisionSchedule) => {
    if (isReadOnly) return;
    setSelectedSchedule(sch);
    setIsDeleteOpen(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.teacherId) errors.teacherId = "SDM yang disupervisi wajib dipilih.";
    if (!formData.supervisorId) errors.supervisorId = "Supervisor wajib dipilih.";
    if (!formData.academicYearId) errors.academicYearId = "Tahun Pelajaran wajib dipilih.";
    if (!formData.semesterId) errors.semesterId = "Semester wajib dipilih.";
    if (!formData.type) errors.type = "Jenis supervisi wajib dipilih.";
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
      await createSchedule({
        teacherId: formData.teacherId,
        teacherName: teacher?.name || "",
        supervisorId: formData.supervisorId,
        supervisorName: supervisor?.name || "",
        academicYearId: formData.academicYearId,
        academicYear: year?.year || year?.name || "",
        semesterId: formData.semesterId,
        semester: sem?.name || "",
        type: formData.type,
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
    if (!selectedSchedule) return;
    if (!validateForm()) return;

    const teacher = teachers.find(t => t.id === formData.teacherId);
    const supervisor = teachers.find(t => t.id === formData.supervisorId);
    const year = academicYears.find(y => y.id === formData.academicYearId);
    const sem = semesters.find(s => s.id === formData.semesterId);

    try {
      await updateSchedule({
        id: selectedSchedule.id,
        data: {
          teacherId: formData.teacherId,
          teacherName: teacher?.name || selectedSchedule.teacherName,
          supervisorId: formData.supervisorId,
          supervisorName: supervisor?.name || selectedSchedule.supervisorName,
          academicYearId: formData.academicYearId,
          academicYear: year?.year || year?.name || selectedSchedule.academicYear,
          semesterId: formData.semesterId,
          semester: sem?.name || selectedSchedule.semester,
          type: formData.type,
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
    if (!selectedSchedule) return;
    try {
      await deleteSchedule(selectedSchedule.id);
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

  const isGlobalLoading = isLoadingSchedules || isLoadingTeachers || isLoadingYears || isLoadingSemesters;

  if (isGlobalLoading) {
    return <Loading label="Memuat modul jadwal supervisi..." />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Calendar className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Jadwal Supervisi
            </h1>
          </div>
          <p className="text-slate-500 dark:text-zinc-400 text-sm mt-1">
            Agenda master jadwal supervisi akademik dan manajerial sdm dalam lingkup madrasah/sekolah.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-xl transition shadow-md shadow-blue-500/10 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Buat Jadwal Baru
          </button>
        )}
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-blue-600 dark:text-blue-400">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Total Jadwal</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-teal-50 dark:bg-teal-950/30 rounded-xl text-teal-600 dark:text-teal-400">
            <Grid className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Supervisi Akademik</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.academic}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Supervisi Manajerial</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.managerial}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl text-amber-600 dark:text-amber-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block">Terjadwal/Aktif</span>
            <span className="text-2xl font-bold text-slate-800 dark:text-zinc-100">{stats.scheduled}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari sdm/guru atau nama supervisor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {/* TP */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="px-2 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua TP</option>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.year || y.name}</option>
            ))}
          </select>

          {/* Smt */}
          <select
            value={filterSem}
            onChange={(e) => setFilterSem(e.target.value)}
            className="px-2 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Smt</option>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Supervisor */}
          <select
            value={filterSupervisorId}
            onChange={(e) => setFilterSupervisorId(e.target.value)}
            className="px-2 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Supervisor</option>
            {teachers.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Jenis */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-2 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
          >
            <option value="">Semua Jenis</option>
            <option value="Akademik">Akademik</option>
            <option value="Manajerial">Manajerial</option>
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-250 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden cursor-pointer"
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

      {/* Table Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
        {filteredSchedules.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-slate-300 dark:text-zinc-700 mb-4 animate-pulse" />
            <h3 className="text-md font-bold text-slate-800 dark:text-zinc-200">Belum ada jadwal supervisi</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Silakan buat entri agenda jadwal supervisi baru lewat tombol di bagian atas halaman.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800">
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">SDM Disupervisi</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Supervisor</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tahun/Smt</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Jenis</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {filteredSchedules.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 dark:text-zinc-100 text-sm">{item.teacherName}</div>
                      <div className="text-[10px] text-slate-400">ID: {item.teacherId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 dark:text-zinc-300">{item.supervisorName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-700 dark:text-zinc-300">{item.academicYear}</div>
                      <div className="text-[10px] text-indigo-500 font-semibold">{item.semester}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                        item.type === "Akademik"
                          ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                          : "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-300"
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                        {item.date ? new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(item)}
                          className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-600 rounded-lg transition"
                          title="Lihat Rincian"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600 rounded-lg transition"
                              title="Ubah Data"
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
      <Dialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Buat Agenda Jadwal Supervisi Baru" size="lg">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">SDM yang Disupervisi *</label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Pilih Staf/Guru...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {formErrors.teacherId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.teacherId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Supervisor *</label>
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
              {formErrors.academicYearId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.academicYearId}</p>}
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
              {formErrors.semesterId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.semesterId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Supervisi *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as SupervisionType }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Akademik">Akademik</option>
                <option value="Manajerial">Manajerial</option>
              </select>
              {formErrors.type && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.type}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Kegiatan *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {formErrors.date && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status Kegiatan *</label>
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
              {formErrors.status && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.status}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Tambahan / Agenda Deskripsi</label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Tulis instruksi khusus, pokok-pokok agenda supervisi, atau link/referensi eksternal..."
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
              {isCreating ? "Menyimpan..." : "Simpan Agenda"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Ubah Agenda Jadwal Supervisi" size="lg">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">SDM yang Disupervisi *</label>
              <select
                value={formData.teacherId}
                onChange={(e) => setFormData(prev => ({ ...prev, teacherId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Pilih Staf/Guru...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {formErrors.teacherId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.teacherId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Supervisor *</label>
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
              {formErrors.academicYearId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.academicYearId}</p>}
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
              {formErrors.semesterId && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.semesterId}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Jenis Supervisi *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as SupervisionType }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="Akademik">Akademik</option>
                <option value="Manajerial">Manajerial</option>
              </select>
              {formErrors.type && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.type}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tanggal Kegiatan *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-250 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 text-sm focus:ring-2 focus:ring-blue-500/20"
              />
              {formErrors.date && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.date}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Status Kegiatan *</label>
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
              {formErrors.status && <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.status}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Catatan Tambahan / Agenda Deskripsi</label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Berikan deskripsi detail agenda atau instruksi..."
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

      {/* DETAIL MODAL */}
      <Dialog isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title="Detail Agenda Jadwal Supervisi" size="md">
        {selectedSchedule && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SDM DISUPERVISI</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">{selectedSchedule.teacherName}</span>
                </div>
                {getStatusBadge(selectedSchedule.status)}
              </div>

              <hr className="border-slate-200 dark:border-zinc-800" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SUPERVISOR</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedSchedule.supervisorName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">JENIS SUPERVISI</span>
                  <span className={`inline-flex px-1.5 py-0.5 rounded-sm text-[10px] font-bold ${
                    selectedSchedule.type === "Akademik"
                      ? "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300"
                      : "bg-teal-50 text-teal-600 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-300"
                  }`}>
                    {selectedSchedule.type}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TANGGAL KEGIATAN</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    {selectedSchedule.date ? new Date(selectedSchedule.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TANGGAL MASTER AGENDA</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    {selectedSchedule.createdAt ? new Date(selectedSchedule.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">TAHUN PELAJARAN</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedSchedule.academicYear}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">SEMESTER</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">{selectedSchedule.semester}</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">CATATAN / POKOK AGENDA</span>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-sm text-slate-700 dark:text-zinc-300 whitespace-pre-wrap min-h-[100px]">
                {selectedSchedule.notes || "Tidak ada catatan agenda khusus."}
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
      <Dialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Hapus Agenda Jadwal Supervisi" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-250 dark:border-rose-900/50">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <p className="text-xs font-semibold">
              Apakah Anda yakin ingin menghapus jadwal supervisi untuk <strong>{selectedSchedule?.teacherName}</strong>? Tindakan ini bersifat permanen.
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
