import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { 
  CalendarDays, Plus, Edit, Trash2, RefreshCw, Download, 
  Printer, Filter, Search, BookOpen, Clock, CheckCircle2, 
  XCircle, ChevronDown, Calendar, AlertCircle, Info, FileText
} from "lucide-react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { useAuth } from "../contexts/AuthContext";
import { AcademicEvent, AcademicReference } from "../types/academicPlanning.types";
import { Semester } from "../types/semester.types";
import * as XLSX from "xlsx";

export default function AnnualActivityTimeline() {
  const { user } = useAuth();
  
  // Permissions: Admin, Pimpinan, Kepala Sekolah, Waka, TU, Operator can modify
  const canEdit = user && ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata house", "tata usaha", "operator"].some(r => user.roles?.includes(r));

  // States
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AcademicEvent[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [currentSemester, setCurrentSemester] = useState<Semester | null>(null);
  const [references, setReferences] = useState<AcademicReference[]>([]);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [filterEffectiveness, setFilterEffectiveness] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Custom delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    eventId: string | null;
  }>({
    isOpen: false,
    eventId: null
  });
  
  // Form State
  const [form, setForm] = useState({
    title: "",
    categoryId: "EVENT_KEGIATAN",
    statusId: "STATUS_EFEKTIF",
    description: "",
    priority: "Sedang" as "Tinggi" | "Sedang" | "Rendah",
    isEffectiveDay: true,
    reduceLesson: false,
    specialLessonDuration: 40,
    affectsAcademicPlanning: true,
    affectsScheduler: true,
    isRange: false,
    startDate: "",
    endDate: "",
    sasaran: "Semua Siswa",
    pelaksana: "Sekolah"
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Preset options for Sasaran and Pelaksana
  const targetPresets = ["Semua Siswa", "Kelas VII", "Kelas VIII", "Kelas IX", "Guru & Staf", "Wali Murid", "Panitia"];
  const organizerPresets = ["Sekolah", "Waka Kurikulum", "Waka Kesiswaan", "Panitia Kegiatan", "OSIS", "Guru PKn", "BK"];

  // Default Categories & Statuses (in case references are empty)
  const eventCategories = [
    { id: "EVENT_KBM", name: "Kegiatan Belajar Mengajar (KBM)" },
    { id: "EVENT_ASESMEN", name: "Asesmen/Ujian" },
    { id: "EVENT_LIBUR", name: "Libur Sekolah" },
    { id: "EVENT_KEGIATAN", name: "Kegiatan Sekolah" },
    { id: "EVENT_WORKSHOP", name: "Workshop/Rapat" }
  ];

  const dayStatuses = [
    { id: "STATUS_EFEKTIF", name: "Hari Efektif KBM" },
    { id: "STATUS_TIDAK_EFEKTIF", name: "Hari Tidak Efektif KBM" }
  ];

  // Load basic data
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [sems, refs] = await Promise.all([
        semesterService.getSemesters(),
        academicPlanningService.getReferences()
      ]);

      setSemesters(sems);
      setReferences(refs);

      // Find active semester
      const active = sems.find(s => s.isActive);
      if (active) {
        setSelectedSemesterId(active.id);
        setCurrentSemester(active);
        // Set default dates for form based on active semester
        setForm(prev => ({
          ...prev,
          startDate: active.startDate,
          endDate: active.startDate
        }));
      } else if (sems.length > 0) {
        setSelectedSemesterId(sems[0].id);
        setCurrentSemester(sems[0]);
        setForm(prev => ({
          ...prev,
          startDate: sems[0].startDate,
          endDate: sems[0].startDate
        }));
      }
    } catch (error: any) {
      showToast("Gagal memuat referensi & semester: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Fetch events when semester changes
  const fetchEvents = async () => {
    if (!currentSemester) return;
    try {
      setLoading(true);
      const data = await academicPlanningService.getCalendarEvents(
        currentSemester.academicYearId,
        currentSemester.id
      );
      setEvents(data);
    } catch (error: any) {
      showToast("Gagal memuat agenda: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [currentSemester]);

  // Handle semester selection change
  const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const semId = e.target.value;
    setSelectedSemesterId(semId);
    const sem = semesters.find(s => s.id === semId);
    if (sem) {
      setCurrentSemester(sem);
    }
  };

  // Date utilities
  const formatDateIndonesian = (dateStr?: string) => {
    if (!dateStr) return "";
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    
    const options: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
    return dateObj.toLocaleDateString("id-ID", options);
  };

  const formatEventDates = (startDate?: string, endDate?: string, isRange?: boolean) => {
    if (!startDate) return "";
    if (!isRange || !endDate || startDate === endDate) {
      return formatDateIndonesian(startDate);
    }
    
    const startObj = new Date(startDate);
    const endObj = new Date(endDate);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
      return `${startDate} - ${endDate}`;
    }
    
    const days = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    const startDayName = days[startObj.getDay()];
    const endDayName = days[endObj.getDay()];
    const startDayNum = startObj.getDate();
    const endDayNum = endObj.getDate();
    const startMonthName = months[startObj.getMonth()];
    const endMonthName = months[endObj.getMonth()];
    const startYear = startObj.getFullYear();
    const endYear = endObj.getFullYear();
    
    if (startMonthName === endMonthName && startYear === endYear) {
      return `${startDayName}-${endDayName}, ${startDayNum}-${endDayNum} ${startMonthName} ${startYear}`;
    } else if (startYear === endYear) {
      return `${startDayName}, ${startDayNum} ${startMonthName} - ${endDayName}, ${endDayNum} ${endMonthName} ${startYear}`;
    } else {
      return `${startDayName}, ${startDayNum} ${startMonthName} ${startYear} - ${endDayName}, ${endDayNum} ${endMonthName} ${endYear}`;
    }
  };

  // Filter logic
  const filteredEvents = events.filter((evt) => {
    // Search filter
    if (searchTerm && !evt.title.toLowerCase().includes(searchTerm.toLowerCase()) && !evt.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Month filter
    if (filterMonth && evt.startDate) {
      const startObj = new Date(evt.startDate);
      const eventMonth = startObj.getMonth() + 1; // 1-indexed
      if (eventMonth !== Number(filterMonth)) {
        return false;
      }
    }

    // Category filter
    if (filterCategory && evt.categoryId !== filterCategory) {
      return false;
    }

    // Target/Sasaran filter
    if (filterTarget) {
      const targetStr = evt.sasaran || "Semua Siswa";
      if (!targetStr.toLowerCase().includes(filterTarget.toLowerCase())) {
        return false;
      }
    }

    // Effectiveness filter
    if (filterEffectiveness) {
      const isEff = evt.isEffectiveDay !== false;
      if (filterEffectiveness === "efektif" && !isEff) return false;
      if (filterEffectiveness === "tidak_efektif" && isEff) return false;
    }

    return true;
  });

  // Sort chronologically
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    return (a.startDate || "").localeCompare(b.startDate || "");
  });

  // Calculate JP Hours for rendering
  const getJPHours = (evt: AcademicEvent) => {
    if (evt.categoryId === "EVENT_LIBUR" || evt.isEffectiveDay === false) return "-";
    if (evt.reduceLesson) {
      return `Jam Khusus (${evt.specialLessonDuration} Menit)`;
    }
    return "Normal";
  };

  // CRUD actions
  const handleOpenAddModal = () => {
    setEditingEventId(null);
    setForm({
      title: "",
      categoryId: "EVENT_KEGIATAN",
      statusId: "STATUS_EFEKTIF",
      description: "",
      priority: "Sedang",
      isEffectiveDay: true,
      reduceLesson: false,
      specialLessonDuration: 40,
      affectsAcademicPlanning: true,
      affectsScheduler: true,
      isRange: false,
      startDate: currentSemester?.startDate || "",
      endDate: currentSemester?.startDate || "",
      sasaran: "Semua Siswa",
      pelaksana: "Sekolah"
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (evt: AcademicEvent) => {
    setEditingEventId(evt.id);
    setForm({
      title: evt.title,
      categoryId: evt.categoryId,
      statusId: evt.statusId,
      description: evt.description || "",
      priority: evt.priority || "Sedang",
      isEffectiveDay: evt.isEffectiveDay !== false,
      reduceLesson: !!evt.reduceLesson,
      specialLessonDuration: evt.specialLessonDuration || 40,
      affectsAcademicPlanning: evt.affectsAcademicPlanning !== false,
      affectsScheduler: evt.affectsScheduler !== false,
      isRange: evt.isRange || false,
      startDate: evt.startDate || "",
      endDate: evt.endDate || evt.startDate || "",
      sasaran: evt.sasaran || "Semua Siswa",
      pelaksana: evt.pelaksana || "Sekolah"
    });
    setIsModalOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setDeleteConfirmation({
      isOpen: true,
      eventId
    });
  };

  const handleDeleteEventConfirmed = async () => {
    const eventId = deleteConfirmation.eventId;
    if (!eventId) return;

    // DEBUG LOGS (Sesuai instruksi)
    console.log("Delete ID:", eventId);
    console.log("Collection:", "academic_calendar");

    try {
      setLoading(true);
      await academicPlanningService.deleteCalendarEvent(
        eventId,
        user?.uid || "system",
        user?.displayName || "System"
      );

      console.log("Delete Success");

      // STEP 3: Update state React langsung (tanpa reload / menunggu refresh lambat)
      setEvents(prevEvents => prevEvents.filter(evt => evt.id !== eventId));

      // Panggil sinkronisasi database di background
      fetchEvents();

      // NOTIFIKASI SUKSES (Toast Hijau)
      showToast("Agenda berhasil dihapus.", "success");

      // Reset form & state
      setEditingEventId(null);
      setDeleteConfirmation({ isOpen: false, eventId: null });
    } catch (error: any) {
      console.error(error);
      // NOTIFIKASI GAGAL (Toast Merah dengan detail error)
      showToast("Gagal menghapus agenda. Detail: " + (error.message || error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Judul kegiatan wajib diisi", "error");
      return;
    }
    if (!form.startDate) {
      showToast("Tanggal mulai wajib diisi", "error");
      return;
    }

    try {
      setLoading(true);
      
      const mappedCat = references.find(r => r.id === form.categoryId) || eventCategories.find(c => c.id === form.categoryId);
      const mappedStatus = references.find(r => r.id === form.statusId) || dayStatuses.find(s => s.id === form.statusId);

      const payload: AcademicEvent = {
        id: editingEventId || `evt-${Date.now()}`,
        title: form.title,
        categoryId: form.categoryId,
        categoryName: mappedCat?.name || "Kegiatan Sekolah",
        statusId: form.statusId,
        statusName: mappedStatus?.name || "Hari Efektif KBM",
        description: form.description,
        priority: form.priority,
        isEffectiveDay: form.isEffectiveDay,
        reduceLesson: form.reduceLesson,
        specialLessonDuration: Number(form.specialLessonDuration || 40),
        affectsAcademicPlanning: form.affectsAcademicPlanning,
        affectsScheduler: form.affectsScheduler,
        createdAt: new Date().toISOString(),
        isRange: form.isRange,
        startDate: form.startDate,
        endDate: form.isRange ? form.endDate : form.startDate,
        sasaran: form.sasaran,
        pelaksana: form.pelaksana
      };

      await academicPlanningService.saveCalendarEvent(
        payload,
        currentSemester?.academicYearId || "",
        currentSemester?.id || "",
        user?.uid || "system",
        user?.displayName || "System"
      );

      showToast(editingEventId ? "Detail kegiatan berhasil diubah!" : "Kegiatan baru berhasil ditambahkan!", "success");
      setEditingEventId(null);
      setIsModalOpen(false);
      fetchEvents();
    } catch (error: any) {
      showToast("Gagal menyimpan kegiatan: " + error.message, "error");
      setLoading(false);
    }
  };

  // EXPORT TO EXCEL
  const handleExportExcel = () => {
    try {
      const dataToExport = sortedEvents.map((evt, index) => ({
        "No": index + 1,
        "Hari & Tanggal": formatEventDates(evt.startDate, evt.endDate, evt.isRange),
        "Uraian Kegiatan": evt.title,
        "Sasaran/Peserta": evt.sasaran || "Semua Siswa",
        "Pelaksana/PJ": evt.pelaksana || "Sekolah",
        "Keterangan/Status": evt.isEffectiveDay ? "Hari Efektif KBM" : "Libur Sekolah",
        "Waktu JP": getJPHours(evt),
        "Deskripsi": evt.description || ""
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Uraian Kegiatan Tahunan");
      
      const fileName = `Uraian_Kegiatan_Tahunan_${currentSemester?.academicYearName.replace("/", "_")}_${currentSemester?.code}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast("Download Excel berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal ekspor Excel: " + error.message, "error");
    }
  };

  // PRINT DIRECT
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold animate-bounce transition-all ${
          toast.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50" 
            : toast.type === "error"
            ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50"
            : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50"
        }`}>
          {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
          {toast.message}
        </div>
      )}

      {/* Screen view elements to be hidden during print */}
      <div className="print:hidden space-y-6">
        
        {/* Breadcrumb & Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5">
              <Link to="/" className="hover:text-blue-600 transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-slate-800 dark:text-zinc-200">Perencanaan Akademik</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-50 tracking-tight flex items-center gap-2.5">
              <CalendarDays className="h-7 w-7 text-blue-600 dark:text-blue-500" />
              URAIAN KEGIATAN TAHUNAN
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Pusat informasi dan koordinasi seluruh kegiatan akademik selama satu tahun ajaran.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSemesterId}
              onChange={handleSemesterChange}
              className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold rounded-xl shadow-xs outline-none focus:border-blue-500 cursor-pointer text-slate-800 dark:text-zinc-200 transition-all"
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.academicYearName} - {sem.name} {sem.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>

            <button
              onClick={fetchEvents}
              title="Refresh Data"
              className="p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters and Actions Box */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
          
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <Filter className="h-4 w-4 text-slate-400" />
            <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Saring & Cari Kegiatan</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama kegiatan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
              />
            </div>

            {/* Month Filter */}
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs rounded-xl outline-none focus:border-blue-500 text-slate-600 dark:text-zinc-300 transition-all"
            >
              <option value="">Semua Bulan</option>
              <option value="7">Juli</option>
              <option value="8">Agustus</option>
              <option value="9">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
              <option value="1">Januari</option>
              <option value="2">Februari</option>
              <option value="3">Maret</option>
              <option value="4">April</option>
              <option value="5">Mei</option>
              <option value="6">Juni</option>
            </select>

            {/* Category Filter */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs rounded-xl outline-none focus:border-blue-500 text-slate-600 dark:text-zinc-300 transition-all"
            >
              <option value="">Semua Kategori</option>
              {references.length > 0 ? (
                references.filter(r => r.category === "Kategori Event" || r.category === "Kategori Kalender").map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))
              ) : (
                eventCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))
              )}
            </select>

            {/* Target/Sasaran Filter */}
            <select
              value={filterTarget}
              onChange={(e) => setFilterTarget(e.target.value)}
              className="px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs rounded-xl outline-none focus:border-blue-500 text-slate-600 dark:text-zinc-300 transition-all"
            >
              <option value="">Semua Sasaran</option>
              {targetPresets.map(tp => (
                <option key={tp} value={tp}>{tp}</option>
              ))}
            </select>

            {/* Effectiveness Filter */}
            <select
              value={filterEffectiveness}
              onChange={(e) => setFilterEffectiveness(e.target.value)}
              className="px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs rounded-xl outline-none focus:border-blue-500 text-slate-600 dark:text-zinc-300 transition-all"
            >
              <option value="">Semua Status</option>
              <option value="efektif">Hari Efektif KBM</option>
              <option value="tidak_efektif">Hari Tidak Efektif / Libur</option>
            </select>
          </div>

          {/* Quick Buttons for Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              {(searchTerm || filterMonth || filterCategory || filterTarget || filterEffectiveness) && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setFilterMonth("");
                    setFilterCategory("");
                    setFilterTarget("");
                    setFilterEffectiveness("");
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <div className="text-[11px] text-slate-500 font-medium">
                Menampilkan <span className="font-bold text-blue-600">{sortedEvents.length}</span> dari {events.length} total agenda semester.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" /> Cetak / PDF
              </button>
              
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/45 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Ekspor Excel
              </button>

              {canEdit && (
                <button
                  onClick={handleOpenAddModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/10 hover:shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Kegiatan
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table View Container */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs overflow-hidden print:border-none print:shadow-none print:p-0">
        
        {/* Printable Header - Only shown during printing */}
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-5">
          <h1 className="text-xl font-bold tracking-tight text-black">URAIAN KEGIATAN TAHUNAN</h1>
          <h2 className="text-sm font-semibold text-slate-800 mt-1">TAHUN PELAJARAN {currentSemester?.academicYearName} ({currentSemester?.name})</h2>
          <p className="text-[10px] text-slate-500 mt-1">Sistem Perencanaan & Administrasi Akademik Sekolah Terpadu</p>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-3" />
            <p className="text-xs font-semibold text-slate-500">Memuat data uraian kegiatan...</p>
          </div>
        ) : sortedEvents.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl print:border-none">
            <Calendar className="h-10 w-10 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">Tidak Ada Kegiatan Ditemukan</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Belum ada kegiatan akademik untuk filter ini. Silakan buat agenda baru di atas atau sinkronisasi dengan Kalender Akademik.
            </p>
            {canEdit && (
              <button
                onClick={handleOpenAddModal}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Tambah Kegiatan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/40 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] print:bg-slate-100 print:text-black">
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3 w-1/4">Hari / Tanggal</th>
                  <th className="p-3 w-1/4">Uraian Kegiatan</th>
                  <th className="p-3">Sasaran / Peserta</th>
                  <th className="p-3">Pelaksana / PJ</th>
                  <th className="p-3">Keterangan / Status</th>
                  <th className="p-3">Waktu JP</th>
                  <th className="p-3 text-center print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-slate-700 dark:text-zinc-300">
                {sortedEvents.map((evt, idx) => {
                  const isLibur = !evt.isEffectiveDay;
                  return (
                    <tr 
                      key={evt.id} 
                      className={`hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors ${
                        isLibur ? "bg-rose-50/10 dark:bg-rose-950/5" : ""
                      } print:break-inside-avoid print:bg-transparent`}
                    >
                      <td className="p-3 text-center font-bold text-slate-400 dark:text-zinc-500 print:text-black">{idx + 1}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-zinc-100 print:text-black">
                        {formatEventDates(evt.startDate, evt.endDate, evt.isRange)}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-zinc-50 print:text-black">{evt.title}</div>
                        {evt.description && (
                          <div className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 print:text-slate-600">{evt.description}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 print:bg-transparent print:p-0 print:font-semibold print:text-black">
                          {evt.sasaran || "Semua Siswa"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-slate-600 dark:text-zinc-400 print:text-black">
                          {evt.pelaksana || "Sekolah"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[10px] ${
                          evt.isEffectiveDay 
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" 
                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                        } print:bg-transparent print:p-0 print:text-black`}>
                          {evt.isEffectiveDay ? "Hari Efektif KBM" : "Libur / Tidak Efektif"}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-500 dark:text-zinc-400 print:text-black">
                        {getJPHours(evt)}
                      </td>
                      <td className="p-3 text-center print:hidden">
                        {canEdit ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(evt)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-md transition-all cursor-pointer"
                              title="Ubah Detail"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(evt.id)}
                              className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-all cursor-pointer"
                              title="Hapus"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Printable Footer - Only shown during printing */}
        <div className="hidden print:flex items-center justify-between border-t border-slate-300 pt-8 mt-12 text-[10px] text-slate-500">
          <div>Dicetak otomatis pada {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</div>
          <div className="text-right">
            <p className="font-bold text-black mb-12">Mengetahui, Kepala Sekolah</p>
            <p className="font-bold text-black border-b border-black inline-block px-4 pb-0.5">M. Sulaiman, M.Pd.</p>
            <p>NIP. 198203112009021003</p>
          </div>
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-150 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-950/40">
              <h3 className="font-black text-slate-900 dark:text-zinc-50 text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                {editingEventId ? "UBAH DETAIL KEGIATAN" : "TAMBAH KEGIATAN BARU"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-all cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              
              {/* Title */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Nama Kegiatan/Event <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Rapat Koordinasi Guru Awal Tahun"
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                />
              </div>

              {/* Range Toggle */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50/60 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-800 rounded-xl">
                <div>
                  <label className="font-bold text-slate-800 dark:text-zinc-200">Gunakan Rentang Tanggal</label>
                  <p className="text-[10px] text-slate-400 mt-0.5">Aktifkan jika kegiatan berlangsung lebih dari satu hari.</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.isRange}
                  onChange={(e) => setForm(prev => ({ ...prev, isRange: e.target.checked }))}
                  className="h-4 w-4 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    {form.isRange ? "Tanggal Mulai" : "Tanggal Kegiatan"} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value, endDate: prev.isRange ? prev.endDate : e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                  />
                </div>
                
                {form.isRange && (
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Tanggal Selesai <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={form.endDate}
                      onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Target & PJ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Sasaran / Peserta</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="targets"
                      value={form.sasaran}
                      onChange={(e) => setForm(prev => ({ ...prev, sasaran: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                    />
                    <datalist id="targets">
                      {targetPresets.map(t => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Pelaksana / PJ</label>
                  <div className="relative">
                    <input
                      type="text"
                      list="organizers"
                      value={form.pelaksana}
                      onChange={(e) => setForm(prev => ({ ...prev, pelaksana: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                    />
                    <datalist id="organizers">
                      {organizerPresets.map(o => <option key={o} value={o} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Category & Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Kategori Kegiatan</label>
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all cursor-pointer"
                  >
                    {references.length > 0 ? (
                      references.filter(r => r.category === "Kategori Event" || r.category === "Kategori Kalender").map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    ) : (
                      eventCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Status Hari Efektif</label>
                  <select
                    value={form.statusId}
                    onChange={(e) => {
                      const id = e.target.value;
                      const isEff = id === "STATUS_EFEKTIF";
                      setForm(prev => ({ 
                        ...prev, 
                        statusId: id,
                        isEffectiveDay: isEff,
                        // If ineffective/holiday, automatically force reduceLesson to false
                        reduceLesson: isEff ? prev.reduceLesson : false
                      }));
                    }}
                    className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all cursor-pointer"
                  >
                    {references.length > 0 ? (
                      references.filter(r => r.category === "Status Hari").map(stat => (
                        <option key={stat.id} value={stat.id}>{stat.name}</option>
                      ))
                    ) : (
                      dayStatuses.map(stat => (
                        <option key={stat.id} value={stat.id}>{stat.name}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* JP configuration - only relevant if effective */}
              {form.isEffectiveDay && (
                <div className="p-3 bg-blue-50/20 dark:bg-blue-950/10 border border-blue-150 dark:border-blue-900/30 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-slate-800 dark:text-zinc-200">Gunakan Jam Pelajaran Khusus</label>
                      <p className="text-[10px] text-slate-400 mt-0.5">Aktifkan jika kegiatan memotong atau mengurangi jam normal (e.g. 35 menit per JP).</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={form.reduceLesson}
                      onChange={(e) => setForm(prev => ({ ...prev, reduceLesson: e.target.checked }))}
                      className="h-4 w-4 accent-blue-600 cursor-pointer"
                    />
                  </div>

                  {form.reduceLesson && (
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Durasi JP Khusus (Menit)</label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={form.specialLessonDuration}
                        onChange={(e) => setForm(prev => ({ ...prev, specialLessonDuration: Number(e.target.value) }))}
                        className="w-24 px-3 py-1.5 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Deskripsi / Keterangan</label>
                <textarea
                  placeholder="Ketik detail rincian atau keterangan kegiatan..."
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50/50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl outline-none focus:border-blue-500 text-slate-800 dark:text-zinc-200 transition-all"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Prioritas Pelaksanaan</label>
                <div className="flex gap-3">
                  {["Rendah", "Sedang", "Tinggi"].map((p) => (
                    <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="priority"
                        value={p}
                        checked={form.priority === p}
                        onChange={() => setForm(prev => ({ ...prev, priority: p as any }))}
                        className="accent-blue-600 h-3.5 w-3.5"
                      />
                      <span className="font-medium text-slate-700 dark:text-zinc-300">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-150 dark:border-zinc-800 mt-5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-bold rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer"
                >
                  Simpan Kegiatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION DIALOG MODAL */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 h-10 w-10 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">
                  Hapus Agenda
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                  Apakah Anda yakin ingin menghapus agenda ini secara permanen?{"\n\n"}Data yang dihapus tidak dapat dikembalikan.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 mt-6 border-t border-slate-100 dark:border-zinc-850 pt-4 text-xs">
              <button
                type="button"
                onClick={() => setDeleteConfirmation({ isOpen: false, eventId: null })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 font-bold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteEventConfirmed}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer"
              >
                Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
