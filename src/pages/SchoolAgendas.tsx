import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  Clock, 
  Plus, 
  Edit, 
  Trash2, 
  Info, 
  AlertTriangle, 
  CheckCircle,
  Search,
  Filter,
  X,
  FileText,
  ShieldCheck,
  Power,
  PowerOff
} from "lucide-react";
import { useSchoolAgendas } from "../hooks/schoolAgenda.hook";
import { useSchoolSettings } from "../hooks/schoolSettings.hook";
import { useAuth } from "../contexts/AuthContext";
import Dialog from "../components/Dialog";

const PRESET_TYPES = ["Apel Pagi", "Upacara Bendera", "Senam Pagi"];

const DAYS_OF_WEEK = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

export const SchoolAgendas: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSchoolSettings();
  const { agendas, addAgenda, updateAgenda, deleteAgenda, isSaving, isDeleting } = useSchoolAgendas();

  // User permission check (admin, operator, tata usaha)
  const canEdit = useMemo(() => {
    if (!user) return false;
    const roles = user.roles || [user.role];
    return roles.some(r => ["admin", "operator", "tata usaha"].includes(r.toLowerCase()));
  }, [user]);

  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDay, setFilterDay] = useState("Semua");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);

  // Form State
  const [agendaName, setAgendaName] = useState("");
  const [selectedType, setSelectedType] = useState(PRESET_TYPES[0]);
  const [customType, setCustomType] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(["Senin"]);
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("07:30");
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Edit Mode Flag
  const isEditMode = selectedAgendaId !== null;

  // Reset Form
  const resetForm = () => {
    setAgendaName("");
    setSelectedType(PRESET_TYPES[0]);
    setCustomType("");
    setSelectedDays(["Senin"]);
    setStartTime("07:00");
    setEndTime("07:30");
    setIsActive(true);
    setNotes("");
    setValidationError(null);
    setSelectedAgendaId(null);
  };

  // Open Add Dialog
  const handleOpenAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEdit = (agenda: any) => {
    resetForm();
    setSelectedAgendaId(agenda.id);
    setAgendaName(agenda.name);
    
    if (PRESET_TYPES.includes(agenda.agendaType)) {
      setSelectedType(agenda.agendaType);
      setCustomType("");
    } else {
      setSelectedType("Kustom...");
      setCustomType(agenda.agendaType);
    }
    
    setSelectedDays([agenda.day]);
    setStartTime(agenda.startTime);
    setEndTime(agenda.endTime);
    setIsActive(agenda.active);
    setNotes(agenda.notes || "");
    setIsFormOpen(true);
  };

  // Open Delete Confirm Dialog
  const handleOpenDeleteConfirm = (id: string) => {
    setSelectedAgendaId(id);
    setIsDeleteConfirmOpen(true);
  };

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const typeToSave = selectedType === "Kustom..." ? customType.trim() : selectedType;
    if (!typeToSave) {
      setValidationError("Jenis Agenda kustom harus diisi!");
      return;
    }

    if (!agendaName.trim()) {
      setValidationError("Nama Agenda harus diisi!");
      return;
    }

    if (selectedDays.length === 0) {
      setValidationError("Pilih minimal satu hari pelaksanaan!");
      return;
    }

    try {
      if (isEditMode && selectedAgendaId) {
        const payload = {
          name: agendaName.trim(),
          agendaType: typeToSave,
          day: selectedDays[0],
          startTime,
          endTime,
          active: isActive,
          notes: notes.trim() || ""
        };
        await updateAgenda(selectedAgendaId, payload);

        // If extra days are selected, save them as separate agendas
        if (selectedDays.length > 1) {
          for (let i = 1; i < selectedDays.length; i++) {
            const extraPayload = {
              name: agendaName.trim(),
              agendaType: typeToSave,
              day: selectedDays[i],
              startTime,
              endTime,
              active: isActive,
              notes: notes.trim() || ""
            };
            await addAgenda(extraPayload);
          }
        }
      } else {
        for (const day of selectedDays) {
          const payload = {
            name: agendaName.trim(),
            agendaType: typeToSave,
            day,
            startTime,
            endTime,
            active: isActive,
            notes: notes.trim() || ""
          };
          await addAgenda(payload);
        }
      }
      setIsFormOpen(false);
      resetForm();
    } catch (err: any) {
      setValidationError(err.message || "Gagal menyimpan agenda.");
    }
  };

  // Handle Delete Confirm
  const handleDeleteSubmit = async () => {
    if (!selectedAgendaId) return;
    try {
      await deleteAgenda(selectedAgendaId);
      setIsDeleteConfirmOpen(false);
      setSelectedAgendaId(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Quick toggle active state directly in row
  const handleToggleActive = async (agenda: any) => {
    if (!canEdit) return;
    try {
      await updateAgenda(agenda.id, { active: !agenda.active });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Filtered Agendas List
  const filteredAgendas = useMemo(() => {
    return agendas.filter((agenda) => {
      const matchesSearch = 
        agenda.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agenda.agendaType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (agenda.notes || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDay = filterDay === "Semua" || agenda.day.toLowerCase() === filterDay.toLowerCase();
      
      return matchesSearch && matchesDay;
    });
  }, [agendas, searchTerm, filterDay]);

  // Display school hours boundary information safely
  const schoolHoursInfo = useMemo(() => {
    if (!settings) return "07:00 - 14:00";
    const start = settings.schoolHours?.startTime || settings.startTime || "07:00";
    const end = settings.schoolHours?.endTime || settings.endTime || "14:00";
    return `${start} - ${end}`;
  }, [settings]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" id="school-agendas-page">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" id="agendas-header-section">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
            <Calendar className="h-4 w-4" />
            <span>Pengaturan Sekolah</span>
            <span>&bull;</span>
            <span>Agenda Rutin</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            Agenda Rutin Sekolah
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            Kelola agenda rutin tetap (misalnya Upacara, Kajian, Sholat Bersama) yang berada di luar Jam Pelajaran (JP). Sistem akan otomatis menggeser sisa Lesson Period pada hari tersebut tanpa membuat celah kosong.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer self-start md:self-auto"
            id="btn-tambah-agenda"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Agenda Rutin</span>
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50/50 dark:bg-amber-950/15 border border-amber-100 dark:border-amber-900/30 rounded-2xl p-4 flex gap-3 text-xs text-amber-800 dark:text-amber-400 leading-relaxed" id="agendas-info-banner">
        <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold uppercase tracking-wider text-[10px]">Bagaimana Auto-Adjustment Bekerja?</p>
          <p className="text-gray-600 dark:text-zinc-300 font-medium">
            Setiap kali agenda rutin yang <span className="text-blue-600 dark:text-blue-400 font-bold">Aktif</span> disimpan, diubah, atau dihapus, sistem akan mengotomatisasi pembaruan pada koleksi <span className="font-mono bg-amber-100/50 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px]">lesson_periods</span>.
            Waktu istirahat (Break Time) tetap dipertahankan pada jam tetapnya, dan JP yang tersisa akan melewati waktu istirahat secara dinamis tanpa mengubah durasi 1 JP mengajar.
          </p>
        </div>
      </div>

      {/* Toolbar Filters */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between" id="agendas-toolbar">
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-zinc-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cari agenda rutin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 w-full bg-gray-50 focus:bg-white dark:bg-zinc-850 dark:focus:bg-zinc-800 border border-transparent focus:border-gray-200 dark:focus:border-zinc-700 rounded-xl text-xs text-gray-700 dark:text-zinc-200 focus:outline-hidden transition-all"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto self-start sm:self-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterDay("Semua")}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
              filterDay === "Semua"
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30"
                : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-600 dark:text-zinc-300"
            }`}
          >
            Semua Hari
          </button>
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              onClick={() => setFilterDay(day)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                filterDay.toLowerCase() === day.toLowerCase()
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30"
                  : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-600 dark:text-zinc-300"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / Grid */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs overflow-hidden" id="agendas-table-container">
        <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-850 flex justify-between items-center bg-gray-50/20 dark:bg-zinc-900/10">
          <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
            Daftar Kegiatan Rutin Tetap ({filteredAgendas.length})
          </span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-zinc-500">
            Jam Sekolah: {schoolHoursInfo}
          </span>
        </div>

        {filteredAgendas.length === 0 ? (
          <div className="p-16 text-center" id="empty-agendas-state">
            <Calendar className="h-10 w-10 text-gray-350 dark:text-zinc-600 mx-auto mb-3 stroke-[1.5]" />
            <p className="text-xs font-bold text-gray-700 dark:text-zinc-300">Tidak ada agenda rutin ditemukan</p>
            <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
              {searchTerm || filterDay !== "Semua" 
                ? "Cobalah untuk mengubah kata kunci pencarian atau memilih filter hari lainnya."
                : "Silakan tambahkan agenda rutin tetap sekolah yang diinginkan dengan menekan tombol di kanan atas."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="agendas-list-table">
              <thead>
                <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/30 text-gray-400 dark:text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-6">Hari</th>
                  <th className="py-3.5 px-6">Jenis Agenda</th>
                  <th className="py-3.5 px-6">Nama Kegiatan</th>
                  <th className="py-3.5 px-6 text-center">Waktu Mulai</th>
                  <th className="py-3.5 px-6 text-center">Waktu Selesai</th>
                  <th className="py-3.5 px-6 text-center">Durasi</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  <th className="py-3.5 px-6">Catatan</th>
                  {canEdit && <th className="py-3.5 px-6 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-850">
                {filteredAgendas.map((agenda) => {
                  const presetColor = PRESET_TYPES.includes(agenda.agendaType)
                    ? "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                    : "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30";

                  return (
                    <tr 
                      key={agenda.id} 
                      className="hover:bg-gray-50/30 dark:hover:bg-zinc-900/20 transition-colors text-xs text-gray-600 dark:text-zinc-300 font-medium"
                    >
                      <td className="py-4 px-6 font-bold text-gray-900 dark:text-white">{agenda.day}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide border ${presetColor}`}>
                          {agenda.agendaType}
                        </span>
                      </td>
                      <td className="py-4 px-6 font-bold text-gray-800 dark:text-zinc-200">{agenda.name}</td>
                      <td className="py-4 px-6 text-center font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50/10 dark:bg-blue-950/5">
                        {agenda.startTime}
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50/10 dark:bg-amber-950/5">
                        {agenda.endTime}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="font-semibold text-gray-800 dark:text-zinc-200">{agenda.duration}</span>
                        <span className="text-[10px] text-gray-400 dark:text-zinc-500 ml-1">Min</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {canEdit ? (
                          <button
                            onClick={() => handleToggleActive(agenda)}
                            title={agenda.active ? "Klik untuk Nonaktifkan" : "Klik untuk Aktifkan"}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                              agenda.active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/30"
                                : "bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700"
                            }`}
                          >
                            {agenda.active ? (
                              <>
                                <Power className="h-3 w-3" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <PowerOff className="h-3 w-3" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            agenda.active
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : "bg-gray-100 text-gray-400 border-gray-200 dark:bg-zinc-800 dark:text-zinc-500"
                          }`}>
                            {agenda.active ? "Aktif" : "Nonaktif"}
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate text-gray-500 dark:text-zinc-400" title={agenda.notes}>
                        {agenda.notes ? (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                            <span className="truncate">{agenda.notes}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 dark:text-zinc-600 font-light italic">Tidak ada catatan</span>
                        )}
                      </td>
                      
                      {canEdit && (
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEdit(agenda)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              title="Edit Agenda"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenDeleteConfirm(agenda.id)}
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors cursor-pointer"
                              title="Hapus Agenda"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Dialog for Add/Edit */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={isEditMode ? "Ubah Agenda Rutin" : "Tambah Agenda Rutin"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4" id="agenda-form">
          {validationError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 text-xs rounded-xl flex gap-2 items-center">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Agenda Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Nama Kegiatan Rutin
            </label>
            <input
              type="text"
              placeholder="Contoh: Sholat Dhuha Bersama, Upacara Bendera, dll."
              value={agendaName}
              onChange={(e) => setAgendaName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs text-gray-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Agenda Type Select */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Jenis Agenda
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs text-gray-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
              >
                {PRESET_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
                <option value="Kustom...">Kustom...</option>
              </select>
            </div>
          </div>

          {/* Day Checkboxes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">
              Hari Pelaksanaan <span className="text-rose-500 font-bold">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-gray-50/50 dark:bg-zinc-950/20 p-3 rounded-2xl border border-gray-100 dark:border-zinc-850">
              {DAYS_OF_WEEK.map((d) => {
                const isChecked = selectedDays.includes(d);
                return (
                  <label
                    key={d}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer select-none ${
                      isChecked
                        ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 text-blue-700 dark:text-blue-400"
                        : "bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDays([...selectedDays, d]);
                        } else {
                          setSelectedDays(selectedDays.filter((day) => day !== d));
                        }
                      }}
                      className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    {d}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Custom Type Input (Revealed only if Kustom... is selected) */}
          {selectedType === "Kustom..." && (
            <div className="space-y-1 animate-fadeIn">
              <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Masukkan Jenis Agenda Baru
              </label>
              <input
                type="text"
                placeholder="Misal: Sholat Berjamaah, Kajian Kitab"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs text-gray-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Time */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Jam Mulai
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs text-gray-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                required
              />
            </div>

            {/* End Time */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Jam Selesai
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs text-gray-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Active Status checkbox */}
          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="active-checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="active-checkbox" className="text-xs font-semibold text-gray-700 dark:text-zinc-300 cursor-pointer select-none">
              Agenda ini Aktif (Akan otomatis menyesuaikan Lesson Period)
            </label>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              Catatan (Opsional)
            </label>
            <textarea
              placeholder="Tulis instruksi atau catatan singkat untuk kegiatan rutin ini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-850 border border-gray-100 dark:border-zinc-800 rounded-xl text-xs text-gray-800 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-all resize-none"
            />
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-850 mt-4">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-450 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
            >
              {isSaving ? "Menyimpan..." : isEditMode ? "Simpan Perubahan" : "Simpan Agenda"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Hapus Agenda Rutin?"
        size="sm"
      >
        <div className="space-y-4" id="delete-confirmation-dialog">
          <div className="flex gap-3 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider">Konfirmasi Penghapusan</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                Apakah Anda yakin ingin menghapus agenda rutin ini? Tindakan ini akan secara otomatis memperbarui kembali lesson periods pada hari bersangkutan ke struktur semula.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleDeleteSubmit}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default SchoolAgendas;
