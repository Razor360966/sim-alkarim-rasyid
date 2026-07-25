import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { teacherTeachingAttendanceService, getIndonesianDayName } from "../services/teacherTeachingAttendance.service";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { classService } from "../services/classService";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { 
  TeacherTeachingAttendance, 
  AttendanceTeachingStatus, 
  TeacherAttendanceSummary 
} from "../types/teacherTeachingAttendance.types";
import { Teacher } from "../types";
import { Loading } from "../components/Loading";
import { 
  ClipboardList, 
  Calendar, 
  Search, 
  Save, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  ChevronRight, 
  X, 
  Info,
  Filter,
  BarChart2,
  CalendarDays,
  Sparkles,
  ShieldAlert
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export const TeacherTeachingAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isWakakurOrAdmin = user && (
    user.role === "admin" || 
    user.role === "wakil kepala sekolah" || 
    user.role === "operator" ||
    (user.roles && (
      user.roles.includes("admin") || 
      user.roles.includes("wakil kepala sekolah") || 
      user.roles.includes("wakakur")
    ))
  );

  // Default date = today's YYYY-MM-DD
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<"input" | "rekap">("input");

  // Load Master Data (Academic Years, Semesters, Teachers, Subjects, Classes)
  const { data: academicYears = [] } = useQuery({
    queryKey: ["academicYears"],
    queryFn: academicYearService.getAcademicYears
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["semesters"],
    queryFn: semesterService.getSemesters
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: teacherService.getTeachers
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: subjectService.getSubjects
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: classService.getClasses
  });

  // Selected or Active Academic Year & Semester
  const activeAy = academicYears.find(y => y.isActive) || academicYears[0];
  const [selectedAyId, setSelectedAyId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  useEffect(() => {
    if (activeAy?.id && !selectedAyId) {
      setSelectedAyId(activeAy.id);
    }
  }, [activeAy, selectedAyId]);

  const availableSemesters = useMemo(() => {
    if (!selectedAyId) return semesters;
    return semesters.filter(s => s.academicYearId === selectedAyId);
  }, [semesters, selectedAyId]);

  const activeSem = availableSemesters.find(s => s.isActive) || availableSemesters[0];

  useEffect(() => {
    if (activeSem?.id && !selectedSemesterId) {
      setSelectedSemesterId(activeSem.id);
    }
  }, [activeSem, selectedSemesterId]);

  // --- TAB 1: INPUT ABSENSI ---
  const dayName = getIndonesianDayName(selectedDate);

  const { data: dailyAttendanceData, isLoading: isLoadingAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ["teacherTeachingAttendance", selectedDate, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getAttendanceForDate(selectedDate, selectedAyId, selectedSemesterId),
    enabled: !!selectedDate
  });

  const [localAttendanceItems, setLocalAttendanceItems] = useState<TeacherTeachingAttendance[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    if (dailyAttendanceData?.items) {
      setLocalAttendanceItems(dailyAttendanceData.items);
      setIsDirty(false);
    }
  }, [dailyAttendanceData]);

  // Handle local changes
  const handleStatusChange = (index: number, newStatus: AttendanceTeachingStatus) => {
    setLocalAttendanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        status: newStatus,
        substituteTeacherId: newStatus === "Diganti Guru Lain" ? copy[index].substituteTeacherId : "",
        substituteTeacherName: newStatus === "Diganti Guru Lain" ? copy[index].substituteTeacherName : ""
      };
      return copy;
    });
    setIsDirty(true);
  };

  const handleSubstituteChange = (index: number, subTeacherId: string) => {
    const subTeacher = teachers.find(t => t.id === subTeacherId);
    setLocalAttendanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        substituteTeacherId: subTeacherId,
        substituteTeacherName: subTeacher ? subTeacher.name : ""
      };
      return copy;
    });
    setIsDirty(true);
  };

  const handleNotesChange = (index: number, newNotes: string) => {
    setLocalAttendanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        notes: newNotes
      };
      return copy;
    });
    setIsDirty(true);
  };

  // Mutation to save attendance
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Pengguna belum diautentikasi");
      await teacherTeachingAttendanceService.saveAttendanceForDate(
        selectedDate,
        localAttendanceItems,
        user.uid,
        user.displayName || user.name || "Wakakur"
      );
    },
    onSuccess: () => {
      toast("Absensi mengajar guru berhasil disimpan!", "success");
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
      queryClient.invalidateQueries({ queryKey: ["teacherDailyStats"] });
    },
    onError: (err: any) => {
      toast("Gagal menyimpan absensi: " + err.message, "error");
    }
  });

  // Calculate local daily summary stats
  const stats = useMemo(() => {
    const total = localAttendanceItems.length;
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let tugas = 0;
    let tidakHadir = 0;
    let diganti = 0;
    let kbmDitiadakan = 0;

    localAttendanceItems.forEach(item => {
      switch (item.status) {
        case "Hadir Mengajar": hadir++; break;
        case "Izin": izin++; break;
        case "Sakit": sakit++; break;
        case "Tugas Dinas": tugas++; break;
        case "Tidak Hadir": tidakHadir++; break;
        case "Diganti Guru Lain": diganti++; break;
        case "KBM Ditiadakan": kbmDitiadakan++; break;
      }
    });

    const effectiveTotal = total - kbmDitiadakan;
    const percentage = effectiveTotal > 0 ? Math.round(((hadir + diganti) / effectiveTotal) * 100) : (total > 0 && dailyAttendanceData?.isKbmDisabled ? 100 : 0);

    return {
      total,
      hadir,
      izin,
      sakit,
      tugas,
      tidakHadir,
      diganti,
      kbmDitiadakan,
      percentage
    };
  }, [localAttendanceItems, dailyAttendanceData]);

  // Filtered rows for input table
  const filteredInputItems = useMemo(() => {
    return localAttendanceItems.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
      const matchSearch = 
        item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.substituteTeacherName && item.substituteTeacherName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [localAttendanceItems, searchQuery, statusFilter]);

  // --- TAB 2: REKAP ABSENSI ---
  const [rekapPeriodType, setRekapPeriodType] = useState<"mingguan" | "bulanan" | "semester" | "tahunan" | "custom">("semester");
  const [rekapStartDate, setRekapStartDate] = useState<string>("");
  const [rekapEndDate, setRekapEndDate] = useState<string>("");
  const [filterTeacherId, setFilterTeacherId] = useState<string>("");
  const [filterSubjectId, setFilterSubjectId] = useState<string>("");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("");
  const [filterClassId, setFilterClassId] = useState<string>("");

  // Update date range defaults when period type changes
  useEffect(() => {
    const now = new Date();
    if (rekapPeriodType === "mingguan") {
      const first = now.getDate() - now.getDay() + 1; // Monday
      const last = first + 6;
      const monday = new Date(now.setDate(first)).toISOString().split("T")[0];
      const sunday = new Date(now.setDate(last)).toISOString().split("T")[0];
      setRekapStartDate(monday);
      setRekapEndDate(sunday);
    } else if (rekapPeriodType === "bulanan") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      setRekapStartDate(`${y}-${m}-01`);
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setRekapEndDate(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    } else if (rekapPeriodType === "semester" || rekapPeriodType === "tahunan") {
      setRekapStartDate("");
      setRekapEndDate("");
    }
  }, [rekapPeriodType]);

  const { data: rekapData, isLoading: isLoadingRekap } = useQuery({
    queryKey: ["teacherAttendanceRecap", selectedAyId, selectedSemesterId, rekapStartDate, rekapEndDate, filterTeacherId, filterSubjectId, filterGradeLevel, filterClassId],
    queryFn: () => teacherTeachingAttendanceService.getAttendanceRecap({
      academicYearId: selectedAyId,
      semesterId: rekapPeriodType === "tahunan" ? undefined : selectedSemesterId,
      startDate: rekapStartDate || undefined,
      endDate: rekapEndDate || undefined,
      teacherId: filterTeacherId || undefined,
      subjectId: filterSubjectId || undefined,
      gradeLevel: filterGradeLevel || undefined,
      classId: filterClassId || undefined
    })
  });

  // Modal Detail History
  const [detailTeacher, setDetailTeacher] = useState<{ id: string; name: string } | null>(null);
  
  const { data: teacherHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["teacherHistory", detailTeacher?.id, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getTeacherHistory(detailTeacher!.id, {
      academicYearId: selectedAyId,
      semesterId: selectedSemesterId
    }),
    enabled: !!detailTeacher?.id
  });

  // --- EXPORT FUNCTIONS ---
  const handleExportInputExcel = () => {
    const dataToExport = localAttendanceItems.map((item, idx) => ({
      No: idx + 1,
      Tanggal: item.date,
      Hari: item.day,
      "Nama Guru": item.teacherName,
      "Mata Pelajaran": item.subjectName,
      Kelas: item.className,
      "No. JP / Jam": `${item.jp} (${item.timeSlot || "-"})`,
      Ruangan: item.roomName || "-",
      Status: item.status,
      "Guru Pengganti": item.substituteTeacherName || "-",
      Catatan: item.notes || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Absensi_Mengajar");
    XLSX.writeFile(workbook, `Absensi_Mengajar_${selectedDate}.xlsx`);
  };

  const handleExportInputPdf = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text(`REKAP ABSENSI MENGAJAR GURU - ${selectedDate} (${dayName})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Tahun Pelajaran: ${activeAy?.name || "-"} | Semester: ${activeSem?.name || "-"}`, 14, 22);

    let startY = 30;
    doc.setFontSize(9);
    doc.text("No  |  Nama Guru  |  Mapel  |  Kelas  |  JP  |  Status  |  Guru Pengganti  |  Catatan", 14, startY);
    doc.line(14, startY + 2, 280, startY + 2);
    startY += 8;

    localAttendanceItems.forEach((item, idx) => {
      if (startY > 180) {
        doc.addPage();
        startY = 15;
      }
      const line = `${idx + 1}.  ${item.teacherName}  |  ${item.subjectName}  |  ${item.className}  |  ${item.jp}  |  ${item.status}  |  ${item.substituteTeacherName || "-"}  |  ${item.notes || "-"}`;
      doc.text(line, 14, startY);
      startY += 6;
    });

    doc.save(`Absensi_Mengajar_${selectedDate}.pdf`);
  };

  const handleExportRekapExcel = () => {
    if (!rekapData?.summaries) return;
    const dataToExport = rekapData.summaries.map((s, idx) => ({
      No: idx + 1,
      "Nama Guru": s.teacherName,
      "Hadir Mengajar": s.hadir,
      Izin: s.izin,
      Sakit: s.sakit,
      "Tugas Dinas": s.tugas,
      "Tidak Hadir": s.tidakHadir,
      "Diganti Guru Lain": s.diganti,
      "KBM Ditiadakan": s.kbmDitiadakan,
      "Total Sesi": s.totalEncounters,
      "Persentase Kehadiran (%)": `${s.percentage}%`
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap_Kehadiran_Guru");
    XLSX.writeFile(workbook, `Rekap_Absensi_Mengajar_Guru.xlsx`);
  };

  const handleExportRekapPdf = () => {
    if (!rekapData?.summaries) return;
    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text(`REKAPITULASI KEHADIRAN MENGAJAR GURU`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Tahun Pelajaran: ${activeAy?.name || "-"} | Semester: ${activeSem?.name || "-"}`, 14, 22);

    let startY = 30;
    doc.setFontSize(9);
    doc.text("No  |  Nama Guru  |  Hadir  |  Izin  |  Sakit  |  Tugas  |  Alpa  |  Diganti  |  Persentase", 14, startY);
    doc.line(14, startY + 2, 280, startY + 2);
    startY += 8;

    rekapData.summaries.forEach((s, idx) => {
      if (startY > 180) {
        doc.addPage();
        startY = 15;
      }
      const line = `${idx + 1}.  ${s.teacherName}  |  ${s.hadir}  |  ${s.izin}  |  ${s.sakit}  |  ${s.tugas}  |  ${s.tidakHadir}  |  ${s.diganti}  |  ${s.percentage}%`;
      doc.text(line, 14, startY);
      startY += 6;
    });

    doc.save(`Rekap_Absensi_Mengajar_Guru.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 dark:from-zinc-900 dark:to-zinc-950 text-white p-6 rounded-2xl shadow-lg border border-blue-800/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs font-semibold tracking-wide border border-blue-400/30 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              Monitoring Pembelajaran
            </span>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-md text-xs font-semibold tracking-wide border border-emerald-400/30">
              Wakakur
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Absensi Mengajar Guru
          </h1>
          <p className="text-sm text-blue-100/80 max-w-2xl">
            Sistem pencatatan dan rekapitilasi kehadiran guru berbasis Jadwal Pelajaran dan Kalender Akademik secara real-time.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "input" && (
            <>
              <button
                onClick={handleExportInputExcel}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Export Excel
              </button>
              <button
                onClick={handleExportInputPdf}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                Export PDF
              </button>
              {isWakakurOrAdmin && (
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || dailyAttendanceData?.isKbmDisabled}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                    isDirty
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-300"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "Memproses..." : isDirty ? "Simpan Perubahan *" : "Simpan Absensi"}
                </button>
              )}
            </>
          )}

          {activeTab === "rekap" && (
            <>
              <button
                onClick={handleExportRekapExcel}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Export Excel Rekap
              </button>
              <button
                onClick={handleExportRekapPdf}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                Export PDF Rekap
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("input")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "input"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Input Absensi Mengajar
          </button>
          <button
            onClick={() => setActiveTab("rekap")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rekap"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Rekap Absensi Mengajar
          </button>
        </div>

        {/* Academic Year & Semester Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-zinc-700">
            <span className="font-semibold text-slate-500 dark:text-zinc-400">T.A:</span>
            <select
              value={selectedAyId}
              onChange={(e) => setSelectedAyId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id} className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">
                  {y.name} {y.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-zinc-700">
            <span className="font-semibold text-slate-500 dark:text-zinc-400">Sem:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
            >
              {availableSemesters.map(s => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">
                  {s.name} {s.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: INPUT ABSENSI MENGAJAR                             */}
      {/* ========================================================= */}
      {activeTab === "input" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Pilih Tanggal Mengajar
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3.5 py-2 pl-9 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Hari Active</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{dayName}</div>
                </div>
                <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Sesi Mengajar</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">{stats.total} Sesi</div>
                </div>
              </div>
            </div>

            {/* Quick Search & Status Filter */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Guru / Mapel / Kelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="Hadir Mengajar">Hadir Mengajar</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
                <option value="Tugas Dinas">Tugas Dinas</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
                <option value="Diganti Guru Lain">Diganti Guru Lain</option>
                <option value="KBM Ditiadakan">KBM Ditiadakan</option>
              </select>
            </div>
          </div>

          {/* Kaldik Lock Banner */}
          {dailyAttendanceData?.isKbmDisabled && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex items-center gap-3.5 text-amber-900 dark:text-amber-200 shadow-xs">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold">Hari ini tidak terdapat kegiatan belajar mengajar</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Agenda Kalender Akademik: <span className="font-semibold underline">{dailyAttendanceData.lockReason}</span>. Input absensi dikunci secara otomatis oleh sistem.
                </p>
              </div>
            </div>
          )}

          {/* Daily Stats Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sesi</span>
              <div className="text-xl font-extrabold text-slate-800 dark:text-zinc-100">{stats.total}</div>
              <p className="text-[10px] text-slate-400">Jadwal hari {dayName}</p>
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Hadir</span>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{stats.hadir}</div>
              <p className="text-[10px] text-emerald-600/80">Sesuai Jadwal</p>
            </div>

            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-200/60 dark:border-blue-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Izin / Sakit / Tugas</span>
              <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300">{stats.izin + stats.sakit + stats.tugas}</div>
              <p className="text-[10px] text-blue-600/80">Terpencatatkan</p>
            </div>

            <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-200/60 dark:border-rose-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Tidak Hadir</span>
              <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300">{stats.tidakHadir}</div>
              <p className="text-[10px] text-rose-600/80">Tanpa Keterangan</p>
            </div>

            <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-200/60 dark:border-purple-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Diganti</span>
              <div className="text-xl font-extrabold text-purple-700 dark:text-purple-300">{stats.diganti}</div>
              <p className="text-[10px] text-purple-600/80">Guru Pengganti</p>
            </div>

            <div className="bg-slate-100 dark:bg-zinc-800 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">KBM Ditiadakan</span>
              <div className="text-xl font-extrabold text-slate-700 dark:text-zinc-200">{stats.kbmDitiadakan}</div>
              <p className="text-[10px] text-slate-400">Kalender / Agenda</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
              <span className="text-[10px] font-bold text-indigo-100 uppercase">Kehadiran Hari Ini</span>
              <div className="text-xl font-extrabold">{stats.percentage}%</div>
              <p className="text-[10px] text-indigo-100/80">Rasio Pelaksanaan</p>
            </div>
          </div>

          {/* Input Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
            {isLoadingAttendance ? (
              <div className="p-12 text-center">
                <Loading />
                <p className="text-xs text-slate-400 mt-2">Memuat jadwal mengajar hari {dayName}...</p>
              </div>
            ) : filteredInputItems.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">Tidak Ada Jadwal Mengajar</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tidak ditemukan sesi mengajar pada hari {dayName} ({selectedDate}) sesuai filter pencarian atau belum ada Jadwal Pelajaran dipublikasi.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">No</th>
                      <th className="py-3.5 px-4">Guru Utama</th>
                      <th className="py-3.5 px-4">Mata Pelajaran</th>
                      <th className="py-3.5 px-4">Kelas</th>
                      <th className="py-3.5 px-4">Jam / JP</th>
                      <th className="py-3.5 px-4">Ruangan</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Status Kehadiran</th>
                      <th className="py-3.5 px-4 min-w-[200px]">Catatan / Terlambat / Pengganti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60 font-medium text-slate-800 dark:text-zinc-200">
                    {filteredInputItems.map(({ item, originalIndex }, displayIdx) => (
                      <tr key={item.scheduleId || displayIdx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">{displayIdx + 1}</td>
                        
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">{item.teacherName}</div>
                          <div className="text-[10px] text-slate-400">Jadwal Asli</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 dark:text-zinc-200">{item.subjectName}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md font-bold text-[11px] border border-blue-200/50 dark:border-blue-900/30">
                            {item.className}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-700 dark:text-zinc-300">{item.jp}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.timeSlot || "Sesuai Sesi"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                          {item.roomName || "-"}
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={item.status}
                            disabled={!isWakakurOrAdmin || dailyAttendanceData?.isKbmDisabled}
                            onChange={(e) => handleStatusChange(originalIndex, e.target.value as AttendanceTeachingStatus)}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border focus:ring-2 focus:outline-hidden cursor-pointer ${
                              item.status === "Hadir Mengajar"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : item.status === "Diganti Guru Lain"
                                ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : item.status === "Tidak Hadir"
                                ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                : item.status === "KBM Ditiadakan"
                                ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                : "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                            }`}
                          >
                            <option value="Hadir Mengajar">Hadir Mengajar</option>
                            <option value="Izin">Izin</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Tugas Dinas">Tugas Dinas</option>
                            <option value="Tidak Hadir">Tidak Hadir</option>
                            <option value="Diganti Guru Lain">Diganti Guru Lain</option>
                            <option value="KBM Ditiadakan">KBM Ditiadakan</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4 space-y-1.5">
                          {item.status === "Diganti Guru Lain" && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                                Pilih Guru Pengganti:
                              </label>
                              <select
                                value={item.substituteTeacherId || ""}
                                onChange={(e) => handleSubstituteChange(originalIndex, e.target.value)}
                                className="w-full px-2.5 py-1 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg text-xs font-semibold text-purple-900 dark:text-purple-200 focus:ring-1 focus:ring-purple-500 cursor-pointer"
                              >
                                <option value="">-- Pilih Guru Pengganti --</option>
                                {teachers.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="Catatan (Terlambat 10m, dll)..."
                            value={item.notes || ""}
                            disabled={!isWakakurOrAdmin || dailyAttendanceData?.isKbmDisabled}
                            onChange={(e) => handleNotesChange(originalIndex, e.target.value)}
                            className="w-full px-2.5 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-800 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: REKAP ABSENSI MENGAJAR                             */}
      {/* ========================================================= */}
      {activeTab === "rekap" && (
        <div className="space-y-6">
          {/* Rekap Filter Bar */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Filter Rekapitulasi Kehadiran Guru</h3>
              </div>

              {/* Periode Selector */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
                {(["mingguan", "bulanan", "semester", "tahunan"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setRekapPeriodType(p)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                      rekapPeriodType === p
                        ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Guru</label>
                <select
                  value={filterTeacherId}
                  onChange={(e) => setFilterTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Guru</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Mapel</label>
                <select
                  value={filterSubjectId}
                  onChange={(e) => setFilterSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Mapel</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jenjang Target</label>
                <select
                  value={filterGradeLevel}
                  onChange={(e) => setFilterGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Jenjang</option>
                  <option value="VII">Jenjang VII</option>
                  <option value="VIII">Jenjang VIII</option>
                  <option value="IX">Jenjang IX</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Rombel / Kelas</label>
                <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Rombel</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setFilterTeacherId("");
                    setFilterSubjectId("");
                    setFilterGradeLevel("");
                    setFilterClassId("");
                  }}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* Summary Rekap Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
            {isLoadingRekap ? (
              <div className="p-12 text-center">
                <Loading />
                <p className="text-xs text-slate-400 mt-2">Menghitung rekapitulasi kehadiran guru...</p>
              </div>
            ) : !rekapData?.summaries || rekapData.summaries.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <BarChart2 className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">Belum Ada Data Rekap</h3>
                <p className="text-xs text-slate-400">Belum ada catatan absensi terdata untuk filter yang dipilih.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">No</th>
                      <th className="py-3.5 px-4">Nama Guru</th>
                      <th className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">Hadir</th>
                      <th className="py-3.5 px-4 text-center text-blue-600 dark:text-blue-400">Izin</th>
                      <th className="py-3.5 px-4 text-center text-amber-600 dark:text-amber-400">Sakit</th>
                      <th className="py-3.5 px-4 text-center text-indigo-600 dark:text-indigo-400">Tugas</th>
                      <th className="py-3.5 px-4 text-center text-rose-600 dark:text-rose-400">Alpa</th>
                      <th className="py-3.5 px-4 text-center text-purple-600 dark:text-purple-400">Diganti</th>
                      <th className="py-3.5 px-4 text-center">Total Sesi</th>
                      <th className="py-3.5 px-4 text-center">Persentase</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60 font-medium text-slate-800 dark:text-zinc-200">
                    {rekapData.summaries.map((s, idx) => (
                      <tr key={s.teacherId || idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-zinc-100">
                          {s.teacherName}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{s.hadir}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-blue-600 dark:text-blue-400">{s.izin}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-amber-600 dark:text-amber-400">{s.sakit}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-indigo-600 dark:text-indigo-400">{s.tugas}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-rose-600 dark:text-rose-400">{s.tidakHadir}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-purple-600 dark:text-purple-400">{s.diganti}</td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700 dark:text-zinc-300">{s.totalEncounters}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                            s.percentage >= 90
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : s.percentage >= 75
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                          }`}>
                            {s.percentage}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setDetailTeacher({ id: s.teacherId, name: s.teacherName })}
                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-all border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            Riwayat
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail History Modal */}
      {detailTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Riwayat Absensi Mengajar</h3>
                <p className="text-xs text-slate-300">Guru: <span className="font-semibold text-white">{detailTeacher.name}</span></p>
              </div>
              <button
                onClick={() => setDetailTeacher(null)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-300" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingHistory ? (
                <div className="p-12 text-center">
                  <Loading />
                </div>
              ) : teacherHistory.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  Belum ada catatan riwayat absensi untuk guru ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Hari</th>
                        <th className="py-2.5 px-3">Mata Pelajaran</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">JP</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Catatan / Pengganti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60">
                      {teacherHistory.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-zinc-200">{item.date}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">{item.day}</td>
                          <td className="py-2.5 px-3 font-semibold">{item.subjectName}</td>
                          <td className="py-2.5 px-3">{item.className}</td>
                          <td className="py-2.5 px-3 font-bold">{item.jp}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              item.status === "Hadir Mengajar"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.status === "Diganti Guru Lain"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                            {item.substituteTeacherName ? `Pengganti: ${item.substituteTeacherName}` : item.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setDetailTeacher(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-800 dark:text-zinc-100 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherTeachingAttendancePage;
