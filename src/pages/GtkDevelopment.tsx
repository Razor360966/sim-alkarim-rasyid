import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, Edit, Trash, Check, X, Search, Filter, Download, Printer, 
  BookOpen, Clock, Calendar, Award, AlertCircle, Settings, CheckCircle, 
  XCircle, HelpCircle, ExternalLink, ChevronDown, Sparkles, ChevronRight,
  User, Activity, PieChart as PieIcon, LineChart as LineIcon, BarChart2
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { gtkDevelopmentService } from "../services/gtkDevelopmentService";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { userService } from "../services/user.service";
import { GtkDevelopmentActivity, MutabaahIndicator, MutabaahLog } from "../types";
import { exportToExcel } from "../utils/exportUtils";
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line 
} from "recharts";

export default function GtkDevelopment() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Tab from Query Parameter, default is 'dashboard'
  const activeTab = searchParams.get("tab") || "dashboard";
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // --- COMPONENT LOCAL STATES ---
  const [selectedGtkFilter, setSelectedGtkFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>("ALL");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("ALL");
  const [startDateFilter, setStartDateFilter] = useState<string>("");
  const [endDateFilter, setEndDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<GtkDevelopmentActivity | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validatingActivity, setValidatingActivity] = useState<GtkDevelopmentActivity | null>(null);
  const [validationNotes, setValidationNotes] = useState("");

  // Mutaba'ah Harian Entry States
  const [showMutabaahModal, setShowMutabaahModal] = useState(false);
  const [mutabaahDate, setMutabaahDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [mutabaahValues, setMutabaahValues] = useState<{ [key: string]: 'Terlaksana' | 'Belum Terlaksana' | 'Tidak Berlaku' }>({});

  // Admin Indicators Manager States
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [newIndicatorName, setNewIndicatorName] = useState("");

  // --- QUERY MASTER DATA ---
  const { data: academicYears = [] } = useQuery({
    queryKey: ["academicYearsList"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["semestersList"],
    queryFn: () => semesterService.getSemesters()
  });

  const { data: users = [] } = useQuery({
    queryKey: ["usersList"],
    queryFn: () => userService.getUsers()
  });

  // Active Settings (Year & Semester)
  const activeYear = useMemo(() => academicYears.find(y => y.isActive) || null, [academicYears]);
  const activeSemester = useMemo(() => semesters.find(s => s.isActive) || null, [semesters]);

  // Set default filters once year/semester loads
  useEffect(() => {
    if (activeYear) {
      setSelectedYearFilter(activeYear.id);
    }
    if (activeSemester) {
      setSelectedSemesterFilter(activeSemester.id);
    }
  }, [activeYear, activeSemester]);

  // Determine user permission context
  const isAdmin = currentUser?.role === "admin";
  const isKepsek = currentUser?.role === "kepala sekolah" || currentUser?.role === "pimpinan";
  const isWakasek = currentUser?.role === "wakil kepala sekolah";
  const isGuruOrStaff = currentUser?.role === "guru" || currentUser?.role === "tata usaha" || currentUser?.role === "operator" || currentUser?.role === "musrif";

  // Enforce filter for guru/staff
  const finalGtkFilter = isGuruOrStaff ? currentUser?.uid : selectedGtkFilter;

  // --- QUERY GTK DATA ---
  const { data: activities = [], isLoading: isLoadingActivities } = useQuery({
    queryKey: ["gtkActivities"],
    queryFn: () => gtkDevelopmentService.getActivities()
  });

  const { data: indicators = [], isLoading: isLoadingIndicators } = useQuery({
    queryKey: ["mutabaahIndicators"],
    queryFn: () => gtkDevelopmentService.getMutabaahIndicators()
  });

  const { data: mutabaahLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["mutabaahLogs"],
    queryFn: () => gtkDevelopmentService.getMutabaahLogs()
  });

  // --- MUTATIONS ---
  const createActivityMutation = useMutation({
    mutationFn: (data: Omit<GtkDevelopmentActivity, "id" | "createdAt" | "updatedAt">) => gtkDevelopmentService.createActivity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gtkActivities"] });
      toast("Data pengembangan diri berhasil ditambahkan!", "success");
      setShowAddEditModal(false);
    },
    onError: (err: any) => {
      toast("Gagal menambahkan data: " + err.message, "error");
    }
  });

  const updateActivityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GtkDevelopmentActivity> }) => gtkDevelopmentService.updateActivity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gtkActivities"] });
      toast("Data pengembangan diri berhasil diperbarui!", "success");
      setShowAddEditModal(false);
      setEditingActivity(null);
    },
    onError: (err: any) => {
      toast("Gagal memperbarui data: " + err.message, "error");
    }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (id: string) => gtkDevelopmentService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gtkActivities"] });
      toast("Data pengembangan diri berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      toast("Gagal menghapus data: " + err.message, "error");
    }
  });

  const validateActivityMutation = useMutation({
    mutationFn: ({ id, isValidated, notes }: { id: string; isValidated: boolean; notes: string }) => 
      gtkDevelopmentService.validateActivity(id, isValidated, notes, currentUser?.uid || "system"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gtkActivities"] });
      toast("Validasi berhasil disimpan!", "success");
      setShowValidationModal(false);
      setValidatingActivity(null);
      setValidationNotes("");
    },
    onError: (err: any) => {
      toast("Gagal menyimpan validasi: " + err.message, "error");
    }
  });

  const saveMutabaahMutation = useMutation({
    mutationFn: (data: { date: string; indicators: { [key: string]: 'Terlaksana' | 'Belum Terlaksana' | 'Tidak Berlaku' } }) => {
      if (!activeYear || !activeSemester) throw new Error("Tahun ajaran atau semester aktif belum ditentukan.");
      return gtkDevelopmentService.saveMutabaahLog(
        data.date,
        currentUser?.uid || "",
        currentUser?.displayName || "Guru",
        activeYear.id,
        activeSemester.id,
        data.indicators
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahLogs"] });
      toast("Log Mutaba'ah Ruhiyah berhasil disimpan!", "success");
      setShowMutabaahModal(false);
    },
    onError: (err: any) => {
      toast("Gagal menyimpan log: " + err.message, "error");
    }
  });

  const createIndicatorMutation = useMutation({
    mutationFn: (name: string) => gtkDevelopmentService.createMutabaahIndicator(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahIndicators"] });
      toast("Indikator baru berhasil ditambahkan!", "success");
      setNewIndicatorName("");
    },
    onError: (err: any) => {
      toast("Gagal menambahkan indikator: " + err.message, "error");
    }
  });

  const updateIndicatorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MutabaahIndicator> }) => gtkDevelopmentService.updateMutabaahIndicator(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahIndicators"] });
    }
  });

  const deleteIndicatorMutation = useMutation({
    mutationFn: (id: string) => gtkDevelopmentService.deleteMutabaahIndicator(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahIndicators"] });
      toast("Indikator berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      toast("Gagal menghapus indikator: " + err.message, "error");
    }
  });

  // --- SUBMIT HANDLERS ---
  const handleSaveActivity = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeYear || !activeSemester) {
      toast("Error: Tahun Pelajaran atau Semester Aktif tidak tersedia!", "error");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const date = formData.get("date") as string;
    const type = formData.get("type") as string;
    const title = formData.get("title") as string;
    const organizer = formData.get("organizer") as string;
    const category = formData.get("category") as string;
    const status = formData.get("status") as GtkDevelopmentActivity["status"];
    const location = formData.get("location") as string;
    const hoursVal = formData.get("hours") as string;
    const certificateNumber = formData.get("certificateNumber") as string;
    const evidenceLink = formData.get("evidenceLink") as string;
    const notes = formData.get("notes") as string;

    const hours = hoursVal ? parseInt(hoursVal) : undefined;

    const payload = {
      date,
      academicYearId: activeYear.id,
      academicYearName: activeYear.name,
      semesterId: activeSemester.id,
      semesterName: activeSemester.name,
      gtkId: editingActivity ? editingActivity.gtkId : (currentUser?.uid || ""),
      gtkName: editingActivity ? editingActivity.gtkName : (currentUser?.displayName || "Guru"),
      gtkRole: editingActivity ? editingActivity.gtkRole : (currentUser?.role || "guru"),
      type,
      title,
      organizer,
      category,
      status,
      location: location || undefined,
      hours: hours || undefined,
      certificateNumber: certificateNumber || undefined,
      evidenceLink: evidenceLink || undefined,
      notes: notes || undefined
    };

    if (editingActivity) {
      updateActivityMutation.mutate({ id: editingActivity.id, data: payload });
    } else {
      createActivityMutation.mutate(payload);
    }
  };

  const handleOpenMutabaahEntry = () => {
    // Fill current date values if they exist
    const logForDate = mutabaahLogs.find(l => l.date === mutabaahDate && l.gtkId === currentUser?.uid);
    const initialValues: any = {};
    indicators.forEach(ind => {
      initialValues[ind.id] = logForDate?.indicators?.[ind.id] || 'Belum Terlaksana';
    });
    setMutabaahValues(initialValues);
    setShowMutabaahModal(true);
  };

  // Keep values synced when date changes in Mutaba'ah Modal
  useEffect(() => {
    if (showMutabaahModal) {
      const logForDate = mutabaahLogs.find(l => l.date === mutabaahDate && l.gtkId === currentUser?.uid);
      const updatedValues: any = {};
      indicators.forEach(ind => {
        updatedValues[ind.id] = logForDate?.indicators?.[ind.id] || 'Belum Terlaksana';
      });
      setMutabaahValues(updatedValues);
    }
  }, [mutabaahDate, showMutabaahModal, mutabaahLogs, indicators, currentUser]);

  const handleSaveMutabaah = () => {
    saveMutabaahMutation.mutate({
      date: mutabaahDate,
      indicators: mutabaahValues
    });
  };

  // --- FILTERED DATA SETS ---
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      // 1. GTK Filter
      if (finalGtkFilter !== "ALL" && act.gtkId !== finalGtkFilter) return false;
      // 2. Type Filter
      if (selectedTypeFilter !== "ALL" && act.type !== selectedTypeFilter) return false;
      // 3. Category Filter
      if (selectedCategoryFilter !== "ALL" && act.category !== selectedCategoryFilter) return false;
      // 4. Status Filter
      if (selectedStatusFilter !== "ALL" && act.status !== selectedStatusFilter) return false;
      // 5. Year Filter
      if (selectedYearFilter !== "ALL" && act.academicYearId !== selectedYearFilter) return false;
      // 6. Semester Filter
      if (selectedSemesterFilter !== "ALL" && act.semesterId !== selectedSemesterFilter) return false;
      // 7. Date Range
      if (startDateFilter && act.date < startDateFilter) return false;
      if (endDateFilter && act.date > endDateFilter) return false;
      // 8. Search query (Title, GTK Name, Organizer)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = act.title.toLowerCase().includes(query);
        const matchesGtk = act.gtkName.toLowerCase().includes(query);
        const matchesOrg = act.organizer.toLowerCase().includes(query);
        if (!matchesTitle && !matchesGtk && !matchesOrg) return false;
      }
      return true;
    });
  }, [activities, finalGtkFilter, selectedTypeFilter, selectedCategoryFilter, selectedStatusFilter, selectedYearFilter, selectedSemesterFilter, startDateFilter, endDateFilter, searchQuery]);

  // Filter logs for stats
  const filteredLogs = useMemo(() => {
    return mutabaahLogs.filter(log => {
      if (finalGtkFilter !== "ALL" && log.gtkId !== finalGtkFilter) return false;
      if (selectedYearFilter !== "ALL" && log.academicYearId !== selectedYearFilter) return false;
      if (selectedSemesterFilter !== "ALL" && log.semesterId !== selectedSemesterFilter) return false;
      return true;
    });
  }, [mutabaahLogs, finalGtkFilter, selectedYearFilter, selectedSemesterFilter]);

  // --- STATS COMPUTATIONS ---
  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    const currentYearStr = new Date().getFullYear().toString();

    // Activities in current month
    const thisMonthActivities = filteredActivities.filter(a => a.date.startsWith(currentMonth));
    // Activities in current semester
    const thisSemesterActivities = filteredActivities.filter(a => activeSemester ? a.semesterId === activeSemester.id : false);
    // Activities in current year
    const thisYearActivities = filteredActivities.filter(a => activeYear ? a.academicYearId === activeYear.id : false);

    // Active GTK counts
    const activeGtkIds = new Set(filteredActivities.map(a => a.gtkId));

    // Most popular types
    const typeCounts: { [key: string]: number } = {};
    filteredActivities.forEach(a => {
      typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
    });
    const popularTypes = Object.entries(typeCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Categories Distribution
    const catCounts: { [key: string]: number } = {};
    filteredActivities.forEach(a => {
      catCounts[a.category] = (catCounts[a.category] || 0) + 1;
    });
    const categoryDistribution = Object.entries(catCounts).map(([name, value]) => ({ name, value }));

    // JP Totals & Certificates
    const totalJp = filteredActivities.reduce((acc, curr) => acc + (curr.hours || 0), 0);
    const totalCertificates = filteredActivities.filter(a => a.certificateNumber).length;

    // MoM Activity Progress Graph Data
    const monthMap: { [key: string]: number } = {};
    filteredActivities.forEach(a => {
      const mon = a.date.substring(0, 7); // e.g. "2026-06"
      monthMap[mon] = (monthMap[mon] || 0) + 1;
    });
    const monthlyProgressData = Object.entries(monthMap)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      thisMonthCount: thisMonthActivities.length,
      thisSemesterCount: thisSemesterActivities.length,
      thisYearCount: thisYearActivities.length,
      activeGtkCount: activeGtkIds.size,
      popularTypes,
      categoryDistribution,
      totalJp,
      totalCertificates,
      monthlyProgressData
    };
  }, [filteredActivities, activeSemester, activeYear]);

  // Mutaba'ah Stats (Calculate compliance % / stats)
  const mutabaahStats = useMemo(() => {
    let totalTerlaksana = 0;
    let totalItems = 0;

    filteredLogs.forEach(log => {
      Object.entries(log.indicators).forEach(([indId, status]) => {
        // Only count active indicators
        const ind = indicators.find(i => i.id === indId);
        if (ind && ind.isActive) {
          if (status === 'Terlaksana') {
            totalTerlaksana++;
            totalItems++;
          } else if (status === 'Belum Terlaksana') {
            totalItems++;
          }
        }
      });
    });

    const complianceRate = totalItems > 0 ? Math.round((totalTerlaksana / totalItems) * 100) : 0;

    return {
      totalTerlaksana,
      totalItems,
      complianceRate
    };
  }, [filteredLogs, indicators]);

  // --- EXPORT TO EXCEL ---
  const handleExportExcel = () => {
    const dataToExport = filteredActivities.map((act, index) => ({
      "No": index + 1,
      "Tanggal": act.date,
      "Nama GTK": act.gtkName,
      "Peran GTK": act.gtkRole.toUpperCase(),
      "Jenis Pengembangan": act.type,
      "Nama Kegiatan": act.title,
      "Penyelenggara": act.organizer,
      "Kategori": act.category,
      "Status": act.status,
      "Tempat": act.location || "-",
      "JP": act.hours || 0,
      "Nomor Sertifikat": act.certificateNumber || "-",
      "Link Bukti": act.evidenceLink || "-",
      "Catatan": act.notes || "-",
      "Validasi": act.isValidated ? "Disetujui" : "Pending/Belum"
    }));

    exportToExcel(dataToExport, "Laporan_Pengembangan_Diri_GTK", "Pengembangan Diri");
    toast("Laporan Excel berhasil diunduh!", "success");
  };

  // --- EXPORT TO PRINT ---
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* Visual Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 p-6 rounded-3xl border border-slate-800 shadow-xl print:hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Award className="h-44 w-44 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full uppercase tracking-wider">
                GTK Module
              </span>
              <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Pusat Pengembangan Diri & Mutaba'ah GTK
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Pencatatan kompetensi, pelatihan, sertifikasi, serta evaluasi diri spiritualitas pendidik secara berkala.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {isGuruOrStaff && (
              <button
                onClick={handleOpenMutabaahEntry}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-md shadow-emerald-950/20"
              >
                <Activity className="h-3.5 w-3.5" />
                Isi Mutaba'ah
              </button>
            )}
            
            {(isAdmin || isGuruOrStaff) && (
              <button
                onClick={() => {
                  setEditingActivity(null);
                  setShowAddEditModal(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-105 cursor-pointer shadow-md shadow-blue-950/20"
              >
                <Plus className="h-4 w-4" />
                Tambah Kegiatan
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setShowIndicatorModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" />
                Kelola Mutaba'ah
              </button>
            )}
          </div>
        </div>

        {/* Info pill active state */}
        <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-slate-800/60 text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Clock className="h-4 w-4 text-indigo-400" />
            <span className="font-semibold text-slate-400">Tahun Pelajaran:</span>
            <span className="text-white font-bold">{activeYear ? activeYear.name : "Memuat..."}</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-800"></div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Calendar className="h-4 w-4 text-indigo-400" />
            <span className="font-semibold text-slate-400">Semester:</span>
            <span className="text-white font-bold">{activeSemester ? activeSemester.name : "Memuat..."}</span>
          </div>
          <div className="h-3 w-[1px] bg-slate-800"></div>
          <div className="text-amber-400 font-medium">
            * Seluruh input otomatis terhubung dengan Tahun Pelajaran & Semester Aktif ini.
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Buttons */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto gap-2 p-1 bg-white dark:bg-zinc-900/40 rounded-2xl print:hidden">
        {[
          { id: "dashboard", label: "Dashboard", icon: PieIcon },
          { id: "data", label: "Data Pengembangan Diri", icon: BookOpen },
          { id: "monthly", label: "Rekap Bulanan", icon: Calendar },
          { id: "semester", label: "Rekap Semester", icon: LineIcon },
          { id: "yearly", label: "Rekap Tahunan", icon: Award }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive 
                  ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-950 shadow-md" 
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* --- FILTER CONTROL BAR (Applicable for multiple tabs) --- */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-4 rounded-2xl shadow-xs space-y-4 print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
          <Filter className="h-4 w-4 text-indigo-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">Filter Pencarian & Laporan</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* GTK Selector (Only for Admin/Kepsek) */}
          {(isAdmin || isKepsek || isWakasek) ? (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Pilih GTK (Guru / Staf)</label>
              <select
                value={selectedGtkFilter}
                onChange={e => setSelectedGtkFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
              >
                <option value="ALL">Semua GTK</option>
                {users.map(u => (
                  <option key={u.userId} value={u.userId}>{u.name || u.email}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Profil GTK</label>
              <div className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300">
                {currentUser?.displayName}
              </div>
            </div>
          )}

          {/* Jenis Pengembangan */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Jenis Pengembangan</label>
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">Semua Jenis</option>
              {[
                "Workshop", "Seminar", "Webinar", "Diklat", "Pelatihan", "In House Training (IHT)", 
                "MGMP", "Lesson Study", "Pelatihan Kurikulum", "Pelatihan Deep Learning", 
                "Pelatihan Artificial Intelligence (AI)", "Pelatihan Teknologi Informasi", 
                "Pelatihan Asesmen", "Penelitian Tindakan Kelas", "Menjadi Narasumber", 
                "Menjadi Peserta", "Menulis Artikel", "Menulis Buku", "Menyusun Modul Ajar", 
                "Membuat Media Pembelajaran", "Belajar Mandiri", "Studi Banding", 
                "Pelatihan Kepemimpinan", "Kegiatan Pengembangan Profesional lainnya"
              ].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Kategori Pengembangan */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Kategori</label>
            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">Semua Kategori</option>
              {["Internal Sekolah", "Dinas Pendidikan", "Kementerian Agama", "MGMP", "Organisasi Profesi", "Perguruan Tinggi", "Lembaga Swasta", "Mandiri", "Lainnya"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Kegiatan */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Status</label>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">Semua Status</option>
              <option value="Direncanakan">Direncanakan</option>
              <option value="Sedang Berlangsung">Sedang Berlangsung</option>
              <option value="Selesai">Selesai</option>
            </select>
          </div>

          {/* Academic Year Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Tahun Pelajaran</label>
            <select
              value={selectedYearFilter}
              onChange={e => setSelectedYearFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">Semua Tahun Pelajaran</option>
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Semester</label>
            <select
              value={selectedSemesterFilter}
              onChange={e => setSelectedSemesterFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">Semua Semester</option>
              {semesters.filter(s => selectedYearFilter === "ALL" || s.academicYearId === selectedYearFilter).map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.academicYearName})</option>
              ))}
            </select>
          </div>

          {/* Date Range Start */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Rentang Tanggal Mulai</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={e => setStartDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Date Range End */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Rentang Tanggal Selesai</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={e => setEndDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Quick Search */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan nama kegiatan, penyelenggara, atau nama GTK..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              Cetak PDF
            </button>
          </div>
        </div>
      </div>

      {/* --- RENDER TAB CONTENT --- */}

      {/* 1. DASHBOARD TAB */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          
          {/* Top Info Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Activities Month */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Kegiatan Bulan Ini</span>
                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.thisMonthCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Bulan Berjalan</div>
              </div>
            </div>

            {/* Card 2: Activities Semester */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Kegiatan Semester Ini</span>
                <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <BookOpen className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.thisSemesterCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Semester Aktif</div>
              </div>
            </div>

            {/* Card 3: Activities Year */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">Kegiatan Tahun Ini</span>
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Award className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.thisYearCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Satu Tahun Ajaran</div>
              </div>
            </div>

            {/* Card 4: Active GTK */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400">GTK Aktif Terlibat</span>
                <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <User className="h-4 w-4" />
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{stats.activeGtkCount}</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Jumlah GTK Terdaftar: {users.length}</div>
              </div>
            </div>
          </div>

          {/* Graphical Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart: MoM activity */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <LineIcon className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Tren Perkembangan Kegiatan</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Jumlah Kegiatan / Bulan</span>
              </div>
              
              <div className="h-64">
                {stats.monthlyProgressData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.monthlyProgressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                      <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} />
                      <Tooltip contentStyle={{ fontSize: 11, fontWeight: 600, borderRadius: 12 }} />
                      <Line type="monotone" dataKey="count" name="Kegiatan" stroke="#6366f1" strokeWidth={3} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                    <Activity className="h-10 w-10 text-slate-300 animate-pulse mb-2" />
                    Belum ada data untuk digambarkan secara grafis.
                  </div>
                )}
              </div>
            </div>

            {/* Chart: Categories Distribution */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <PieIcon className="h-5 w-5 text-teal-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Distribusi Kategori</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Kategori Kegiatan</span>
              </div>

              <div className="h-64 relative flex flex-col justify-between">
                {stats.categoryDistribution.length > 0 ? (
                  <>
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stats.categoryDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stats.categoryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][index % 6]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 11, fontWeight: 600, borderRadius: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Legends list */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 border-t border-slate-50 dark:border-zinc-850 pt-2">
                      {stats.categoryDistribution.slice(0, 4).map((entry, index) => (
                        <div key={entry.name} className="flex items-center gap-1 truncate">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: ["#6366f1", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"][index % 6] }}></span>
                          <span className="truncate">{entry.name} ({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                    <Activity className="h-10 w-10 text-slate-300 animate-pulse mb-2" />
                    Belum ada data distribusi.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mutaba'ah Ruhiyah Overview Summary */}
          <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-zinc-900/40 dark:to-zinc-950/20 p-6 rounded-3xl border border-indigo-100 dark:border-zinc-850 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-indigo-100 dark:bg-zinc-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Activity className="h-4 w-4" />
                </div>
                <h3 className="font-extrabold text-slate-800 dark:text-zinc-200">Indeks Kepatuhan Mutaba'ah Ruhiyah Guru</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xl font-medium">
                Indeks persentase keterlaksanaan amalan sunnah harian pendidik (shalat berjamaah, dhuha, tilawah, muraja'ah, dll) yang terekam pada periode ini.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-indigo-100/50 dark:border-zinc-800 shadow-md">
              <div className="relative h-16 w-16 flex items-center justify-center bg-indigo-50 dark:bg-zinc-800 rounded-full text-lg font-black text-indigo-700 dark:text-indigo-400">
                {mutabaahStats.complianceRate}%
              </div>
              <div>
                <div className="text-xs font-black uppercase text-slate-400">Amalan Terlaksana</div>
                <div className="text-lg font-extrabold text-slate-800 dark:text-zinc-200">
                  {mutabaahStats.totalTerlaksana} <span className="text-xs font-semibold text-slate-400">/ {mutabaahStats.totalItems} amalan</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2. DATA PENGEMBANGAN DIRI TAB */}
      {activeTab === "data" && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-150 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Daftar Log Aktivitas Pengembangan Diri</h3>
              <p className="text-xs text-slate-500">Mencatat, menyunting, dan menyetujui seluruh aktivitas peningkatan kompetensi.</p>
            </div>
            
            {isGuruOrStaff && (
              <button
                onClick={() => {
                  setEditingActivity(null);
                  setShowAddEditModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Tambah Kegiatan
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 dark:border-zinc-800 text-[10px] font-black uppercase text-slate-400">
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Nama GTK</th>
                  <th className="p-3">Jenis & Kategori</th>
                  <th className="p-3">Nama Kegiatan & Penyelenggara</th>
                  <th className="p-3 text-center">JP</th>
                  <th className="p-3 text-center">Validasi</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 text-xs">
                {isLoadingActivities ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">Memuat data pengembangan diri...</td>
                  </tr>
                ) : filteredActivities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">Tidak ada log kegiatan yang cocok dengan filter.</td>
                  </tr>
                ) : (
                  filteredActivities.map(act => (
                    <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/20 font-medium">
                      <td className="p-3 whitespace-nowrap text-slate-500 dark:text-zinc-400">
                        {act.date}
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-zinc-200">{act.gtkName}</div>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">{act.gtkRole}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-700 dark:text-zinc-300">{act.type}</div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.5 text-[8px] font-black uppercase rounded-md bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                          {act.category}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-zinc-200">{act.title}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Penyelenggara: {act.organizer}</div>
                        {act.evidenceLink && (
                          <a 
                            href={act.evidenceLink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-blue-600 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Bukti Dukung
                          </a>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold text-slate-700 dark:text-zinc-300">
                        {act.hours || "-"}
                      </td>
                      <td className="p-3 text-center">
                        {act.isValidated ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-full text-[10px] font-bold border border-emerald-200 dark:border-emerald-900/50">
                            <Check className="h-3 w-3" />
                            Disetujui
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-full text-[10px] font-bold border border-amber-200 dark:border-amber-900/50">
                            <Clock className="h-3 w-3" />
                            Pending
                          </div>
                        )}
                        {act.validationNotes && (
                          <div className="text-[10px] text-slate-400 italic max-w-xs mt-0.5 text-center mx-auto">{act.validationNotes}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center items-center gap-1">
                          {/* Validate (Only for Kepsek or Admin) */}
                          {(isKepsek || isAdmin) && (
                            <button
                              onClick={() => {
                                setValidatingActivity(act);
                                setValidationNotes(act.validationNotes || "");
                                setShowValidationModal(true);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg cursor-pointer transition-colors"
                              title="Validasi Kepala Sekolah"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}

                          {/* Edit / Delete: Admin, or Guru if same account and not validated */}
                          {(isAdmin || (isGuruOrStaff && act.gtkId === currentUser?.uid && !act.isValidated)) && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingActivity(act);
                                  setShowAddEditModal(true);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg cursor-pointer transition-colors"
                                title="Ubah"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm("Apakah Anda yakin ingin menghapus log kegiatan ini?")) {
                                    deleteActivityMutation.mutate(act.id);
                                  }
                                }}
                                className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer transition-colors"
                                title="Hapus"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. REKAP BULANAN TAB */}
      {activeTab === "monthly" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Monthly Recap statistics & Indicators status */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-6">
            <div className="border-b border-slate-150 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Rekapitulasi Amalan Mutaba'ah Ruhiyah Bulanan</h3>
              <p className="text-xs text-slate-500">Persentase keberhasilan pelaksanaan indikator spiritualitas guru bulan berjalan.</p>
            </div>

            {/* Compliance Stats Bar */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-950/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-850">
              <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{mutabaahStats.complianceRate}%</div>
              <div className="flex-1 space-y-1">
                <div className="h-2.5 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-500" style={{ width: `${mutabaahStats.complianceRate}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                  <span>Persentase Keberhasilan</span>
                  <span>{mutabaahStats.totalTerlaksana} Terlaksana dari {mutabaahStats.totalItems} target amalan harian</span>
                </div>
              </div>
            </div>

            {/* Displaying detailed compliance rate per indicator */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400">Analisis Keterlaksanaan per Amalan</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {indicators.filter(ind => ind.isActive).map(ind => {
                  const logsWithThisInd = filteredLogs.filter(log => log.indicators?.[ind.id]);
                  const terlaksanaCount = logsWithThisInd.filter(log => log.indicators[ind.id] === 'Terlaksana').length;
                  const validCount = logsWithThisInd.filter(log => log.indicators[ind.id] !== 'Tidak Berlaku').length;
                  const pct = validCount > 0 ? Math.round((terlaksanaCount / validCount) * 100) : 0;

                  return (
                    <div key={ind.id} className="bg-slate-50/50 dark:bg-zinc-950/10 p-3 rounded-xl border border-slate-150 dark:border-zinc-850 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-extrabold text-slate-800 dark:text-zinc-200">{ind.name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{terlaksanaCount} Hari Terlaksana</div>
                      </div>
                      <div className={`px-2 py-1 rounded-lg text-xs font-black ${pct >= 75 ? 'bg-emerald-50 text-emerald-700' : pct >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        {pct}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick Stats sidebar for monthly activities */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-6">
            <div className="border-b border-slate-150 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Aktivitas Bulan Ini</h3>
              <p className="text-xs text-slate-500">Rekap cepat bulan berjalan.</p>
            </div>

            <div className="space-y-4 divide-y divide-slate-100 dark:divide-zinc-800">
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total Kegiatan</span>
                <span className="text-base font-black text-slate-800 dark:text-white">{stats.thisMonthCount}</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total Jam Pelatihan (JP)</span>
                <span className="text-base font-black text-slate-800 dark:text-white">{stats.totalJp} JP</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Sertifikat Diperoleh</span>
                <span className="text-base font-black text-slate-800 dark:text-white">{stats.totalCertificates}</span>
              </div>
            </div>

            {/* Quick Motivator Info */}
            <div className="bg-blue-50/50 dark:bg-blue-950/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 font-medium">
              Aktivitas pengembangan diri terdokumentasi akan ditarik ke dalam Rapor Kinerja SDM pada akhir semester. Pastikan seluruh berkas pendukung divalidasi oleh Kepala Sekolah.
            </div>
          </div>
        </div>
      )}

      {/* 4. REKAP SEMESTER TAB */}
      {activeTab === "semester" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-4">
            <div className="border-b border-slate-150 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Kinerja Pengembangan Diri Semester Aktif</h3>
              <p className="text-xs text-slate-500">Evaluasi kumulatif keterlibatan GTK pada Semester {activeSemester?.name}.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Semester Stats Summary */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400">Rangkuman Indikator</h4>
                <div className="bg-slate-50 dark:bg-zinc-950/40 p-4 rounded-2xl border border-slate-200 dark:border-zinc-850 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Kegiatan Berjalan</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{stats.thisSemesterCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Total JP Pelatihan</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{stats.totalJp} JP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Sertifikat Terkumpul</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">{stats.totalCertificates}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-600 dark:text-zinc-400">Kepatuhan Ruhiyah</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{mutabaahStats.complianceRate}%</span>
                  </div>
                </div>
              </div>

              {/* Chart: Category distribution Recharts */}
              <div className="md:col-span-2 space-y-4">
                <h4 className="text-xs font-black uppercase text-slate-400">Kontribusi Kategori Pelatihan</h4>
                <div className="h-44">
                  {stats.categoryDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.categoryDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight={600} />
                        <YAxis stroke="#94a3b8" fontSize={9} fontWeight={600} />
                        <Tooltip contentStyle={{ fontSize: 10, borderRadius: 12 }} />
                        <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Jumlah" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                      Belum ada data visualisasi semester.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 5. REKAP TAHUNAN TAB */}
      {activeTab === "yearly" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-850 shadow-xs space-y-4">
            <div className="border-b border-slate-150 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Laporan Tahunan Pengembangan Diri GTK</h3>
              <p className="text-xs text-slate-500">Grafik akumulasi dan analisis keaktifan tahunan guru di SMP Alkarim Rasyid.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-zinc-950/40 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase">Total Kegiatan Setahun</div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.thisYearCount}</div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">Tahun Pelajaran: {activeYear?.name}</div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/40 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase">Total JP Setahun</div>
                <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">{stats.totalJp} JP</div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">Akumulasi Jam</div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/40 p-5 rounded-2xl border border-slate-200 dark:border-zinc-850 text-center">
                <div className="text-xs font-bold text-slate-400 uppercase">Indeks Mutaba'ah Rata-Rata</div>
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{mutabaahStats.complianceRate}%</div>
                <div className="text-[10px] text-slate-400 mt-1 font-semibold">Keterlaksanaan Spiritual</div>
              </div>
            </div>

            {/* Comparison Semester-on-Semester */}
            <div className="bg-slate-50/50 dark:bg-zinc-950/10 p-5 rounded-3xl border border-slate-150 dark:border-zinc-850 space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400">Perbandingan Antar Semester</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="text-xs font-extrabold text-slate-800 dark:text-zinc-200">Semester Ganjil (S1)</div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Jumlah Kegiatan:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {activities.filter(a => semesters.find(s => s.id === a.semesterId)?.code === "S1").length}
                    </span>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="text-xs font-extrabold text-slate-800 dark:text-zinc-200">Semester Genap (S2)</div>
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>Jumlah Kegiatan:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {activities.filter(a => semesters.find(s => s.id === a.semesterId)?.code === "S2").length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS SECTION
          ========================================================================= */}

      {/* 1. ADD / EDIT ACTIVITY MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-black text-base text-slate-900 dark:text-white">
                {editingActivity ? "Edit Kegiatan Pengembangan Diri" : "Tambah Kegiatan Pengembangan Diri"}
              </h3>
              <button onClick={() => setShowAddEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveActivity} className="space-y-4 text-xs font-bold text-slate-700 dark:text-zinc-300">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Tanggal Kegiatan <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={editingActivity ? editingActivity.date : new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Status Kegiatan */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Status <span className="text-rose-500">*</span></label>
                  <select
                    name="status"
                    required
                    defaultValue={editingActivity ? editingActivity.status : "Selesai"}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="Direncanakan">Direncanakan</option>
                    <option value="Sedang Berlangsung">Sedang Berlangsung</option>
                    <option value="Selesai">Selesai</option>
                  </select>
                </div>

                {/* Jenis Pengembangan */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Jenis Pengembangan <span className="text-rose-500">*</span></label>
                  <select
                    name="type"
                    required
                    defaultValue={editingActivity ? editingActivity.type : "Workshop"}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  >
                    {[
                      "Workshop", "Seminar", "Webinar", "Diklat", "Pelatihan", "In House Training (IHT)", 
                      "MGMP", "Lesson Study", "Pelatihan Kurikulum", "Pelatihan Deep Learning", 
                      "Pelatihan Artificial Intelligence (AI)", "Pelatihan Teknologi Informasi", 
                      "Pelatihan Asesmen", "Penelitian Tindakan Kelas", "Menjadi Narasumber", 
                      "Menjadi Peserta", "Menulis Artikel", "Menulis Buku", "Menyusun Modul Ajar", 
                      "Membuat Media Pembelajaran", "Belajar Mandiri", "Studi Banding", 
                      "Pelatihan Kepemimpinan", "Kegiatan Pengembangan Profesional lainnya"
                    ].map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                {/* Nama Kegiatan */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Nama Kegiatan <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Contoh: Implementasi Deep Learning dalam Pembelajaran"
                    defaultValue={editingActivity ? editingActivity.title : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Penyelenggara */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Penyelenggara <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    name="organizer"
                    required
                    placeholder="Contoh: Dinas Pendidikan"
                    defaultValue={editingActivity ? editingActivity.organizer : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Kategori Pengembangan */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Kategori <span className="text-rose-500">*</span></label>
                  <select
                    name="category"
                    required
                    defaultValue={editingActivity ? editingActivity.category : "Internal Sekolah"}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  >
                    {["Internal Sekolah", "Dinas Pendidikan", "Kementerian Agama", "MGMP", "Organisasi Profesi", "Perguruan Tinggi", "Lembaga Swasta", "Mandiri", "Lainnya"].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Tempat */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Tempat</label>
                  <input
                    type="text"
                    name="location"
                    placeholder="Contoh: Aula Sekolah / Online via Zoom"
                    defaultValue={editingActivity ? editingActivity.location : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Jumlah JP */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Jumlah JP</label>
                  <input
                    type="number"
                    name="hours"
                    placeholder="Contoh: 32"
                    defaultValue={editingActivity ? editingActivity.hours : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Nomor Sertifikat */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Nomor Sertifikat</label>
                  <input
                    type="text"
                    name="certificateNumber"
                    placeholder="Contoh: 120/DIK/2026"
                    defaultValue={editingActivity ? editingActivity.certificateNumber : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Link Bukti Dukung */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-500">Link Bukti Dukung</label>
                  <input
                    type="url"
                    name="evidenceLink"
                    placeholder="Google Drive, OneDrive, Photos link"
                    defaultValue={editingActivity ? editingActivity.evidenceLink : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                {/* Catatan */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-500">Catatan Tambahan</label>
                  <textarea
                    name="notes"
                    placeholder="Tulis ringkasan singkat hasil kegiatan atau materi yang diperoleh"
                    rows={3}
                    defaultValue={editingActivity ? editingActivity.notes : ""}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                  ></textarea>
                </div>

              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-200 rounded-xl font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={createActivityMutation.isPending || updateActivityMutation.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all cursor-pointer shadow-md"
                >
                  {(createActivityMutation.isPending || updateActivityMutation.isPending) ? "Menyimpan..." : "Simpan Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. VALIDATION DIALOG MODAL (FOR KEPSEK) */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-black text-sm text-slate-800 dark:text-zinc-200">Validasi Kepala Sekolah</h3>
              <button onClick={() => setShowValidationModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-850 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-200 dark:border-zinc-850 space-y-1">
                <div className="font-bold text-slate-500 uppercase text-[10px]">Kegiatan GTK</div>
                <div className="font-extrabold text-slate-800 dark:text-zinc-100">{validatingActivity?.title}</div>
                <div className="text-[10px] text-slate-400">Pengusul: {validatingActivity?.gtkName}</div>
              </div>

              <div className="space-y-1 font-bold">
                <label className="text-[10px] font-black uppercase text-slate-500">Catatan / Feedback Kepala Sekolah</label>
                <textarea
                  value={validationNotes}
                  onChange={e => setValidationNotes(e.target.value)}
                  placeholder="Tulis catatan persetujuan atau catatan perbaikan..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-zinc-200"
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-zinc-800 pt-3 text-xs font-bold">
              <button
                onClick={() => validateActivityMutation.mutate({ id: validatingActivity?.id || "", isValidated: false, notes: validationNotes })}
                className="px-4 py-2 border border-rose-600 text-rose-600 rounded-xl cursor-pointer"
              >
                Tolak / Perbaikan
              </button>
              <button
                onClick={() => validateActivityMutation.mutate({ id: validatingActivity?.id || "", isValidated: true, notes: validationNotes })}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl cursor-pointer shadow-md shadow-emerald-950/20"
              >
                Setujui / Validasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MUTABA'AH ENTRY MODAL */}
      {showMutabaahModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-4.5 w-4.5 text-emerald-600" />
                <h3 className="font-black text-base text-slate-900 dark:text-white">Isi Log Mutaba'ah Ruhiyah</h3>
              </div>
              <button onClick={() => setShowMutabaahModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-850 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-700 dark:text-zinc-300">
              {/* Date Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500">Pilih Tanggal Evaluasi</label>
                <input
                  type="date"
                  value={mutabaahDate}
                  onChange={e => setMutabaahDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {/* Indicator List */}
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {indicators.filter(ind => ind.isActive).map(ind => (
                  <div key={ind.id} className="p-3 bg-slate-50 dark:bg-zinc-950/40 border border-slate-150 dark:border-zinc-800 rounded-xl space-y-2">
                    <div className="font-extrabold text-slate-800 dark:text-zinc-200">{ind.name}</div>
                    
                    <div className="flex gap-4">
                      {['Terlaksana', 'Belum Terlaksana', 'Tidak Berlaku'].map(status => (
                        <label key={status} className="flex items-center gap-1.5 cursor-pointer text-[11px]">
                          <input
                            type="radio"
                            name={`ind_${ind.id}`}
                            checked={mutabaahValues[ind.id] === status}
                            onChange={() => setMutabaahValues({ ...mutabaahValues, [ind.id]: status as any })}
                            className="text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                          />
                          <span>{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
                <button
                  onClick={() => setShowMutabaahModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 rounded-xl"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveMutabaah}
                  disabled={saveMutabaahMutation.isPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md cursor-pointer"
                >
                  {saveMutabaahMutation.isPending ? "Menyimpan..." : "Simpan Evaluasi"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MANAGE MUTABA'AH INDICATORS MODAL (ADMIN ONLY) */}
      {showIndicatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 w-full max-w-lg space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-black text-base text-slate-900 dark:text-white">Kelola Indikator Mutaba'ah Ruhiyah</h3>
              <button onClick={() => setShowIndicatorModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-850 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-bold text-slate-700 dark:text-zinc-300">
              {/* Add New Indicator Form */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tambahkan amalan harian baru..."
                  value={newIndicatorName}
                  onChange={e => setNewIndicatorName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:border-indigo-500 text-slate-800 dark:text-zinc-200"
                />
                <button
                  onClick={() => {
                    if (newIndicatorName.trim()) {
                      createIndicatorMutation.mutate(newIndicatorName.trim());
                    }
                  }}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Indicator Lists */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {isLoadingIndicators ? (
                  <div className="p-4 text-center text-slate-400">Memuat indikator...</div>
                ) : (
                  indicators.map(ind => (
                    <div key={ind.id} className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-zinc-950/10 border border-slate-150 dark:border-zinc-800 rounded-xl">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ind.isActive}
                          onChange={e => updateIndicatorMutation.mutate({ id: ind.id, data: { isActive: e.target.checked } })}
                          className="text-indigo-600 focus:ring-indigo-500 h-4 w-4 rounded-md cursor-pointer"
                        />
                        <span className={`text-xs font-bold ${ind.isActive ? 'text-slate-800 dark:text-zinc-100' : 'text-slate-400 line-through'}`}>
                          {ind.name}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (confirm("Hapus indikator ini permanen dari sistem? Logs lama amalan ini akan tetap tersimpan.")) {
                            deleteIndicatorMutation.mutate(ind.id);
                          }
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Hapus Indikator"
                      >
                        <Trash className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end border-t border-slate-100 dark:border-zinc-800 pt-3">
                <button
                  onClick={() => setShowIndicatorModal(false)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-zinc-900 rounded-xl shadow-md"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
