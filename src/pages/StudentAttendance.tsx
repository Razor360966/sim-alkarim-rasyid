import React, { useState, useEffect, useMemo } from "react";
import { 
  ClipboardList, 
  Calendar as CalendarIcon, 
  Users, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Save, 
  Loader2, 
  Info, 
  Filter, 
  FileSpreadsheet, 
  FileText,
  Trash2, 
  Eye, 
  Check, 
  UserX,
  History,
  Lock,
  GraduationCap,
  Award,
  ShieldAlert,
  Download
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { studentAttendanceService } from "../services/studentAttendanceService";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { getTodayDateStr, getIndonesianDayName } from "../services/teacherTeachingAttendance.service";
import { exportToExcel, exportToPDF } from "../utils/exportUtils";
import { Class, Subject, Student } from "../types";
import { 
  ClassStudentAttendanceRecord, 
  StudentAttendanceItem, 
  StudentOverallRecap, 
  HomeroomClassDetailRecap, 
  HeadmasterOverviewStats,
  StudentAttendanceAuditLog
} from "../types/studentAttendance.types";

export const StudentAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const todayStr = getTodayDateStr();

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<"input" | "history" | "rekap_siswa" | "rekap_walikelas" | "rekap_kepsek" | "audit_trail">("input");

  // Filters for Input Form
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Master Data
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingMaster, setLoadingMaster] = useState<boolean>(true);

  // Attendance Form State
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [attendanceList, setAttendanceList] = useState<StudentAttendanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [generalNotes, setGeneralNotes] = useState<string>("");

  // Lock status
  const [sessionLock, setSessionLock] = useState<{
    canInput: boolean;
    isLocked: boolean;
    reason: string;
  }>({ canInput: true, isLocked: false, reason: "" });

  // History State
  const [rekapStartDate, setRekapStartDate] = useState<string>(todayStr);
  const [rekapEndDate, setRekapEndDate] = useState<string>(todayStr);
  const [rekapClassId, setRekapClassId] = useState<string>("");
  const [historyRecords, setHistoryRecords] = useState<ClassStudentAttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ClassStudentAttendanceRecord | null>(null);

  // Rekap Per Siswa State
  const [studentRecaps, setStudentRecaps] = useState<StudentOverallRecap[]>([]);
  const [loadingStudentRecaps, setLoadingStudentRecaps] = useState<boolean>(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentOverallRecap | null>(null);

  // Rekap Wali Kelas State
  const [homeroomClassId, setHomeroomClassId] = useState<string>("");
  const [homeroomRecaps, setHomeroomRecaps] = useState<HomeroomClassDetailRecap[]>([]);
  const [loadingHomeroom, setLoadingHomeroom] = useState<boolean>(false);

  // Rekap Kepala Sekolah State
  const [headmasterStats, setHeadmasterStats] = useState<HeadmasterOverviewStats | null>(null);
  const [loadingHeadmaster, setLoadingHeadmaster] = useState<boolean>(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<StudentAttendanceAuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState<boolean>(false);

  const isPrivileged = user?.role === "admin" || user?.role === "wakakur" || user?.role === "kepala_sekolah";

  // Load Master Classes & Subjects
  useEffect(() => {
    loadMasterData();
  }, []);

  const loadMasterData = async () => {
    setLoadingMaster(true);
    try {
      const [clsList, sbjList] = await Promise.all([
        classService.getClasses(),
        subjectService.getSubjects()
      ]);
      setClasses(clsList);
      setSubjects(sbjList);

      if (clsList.length > 0) {
        setSelectedClassId(clsList[0].id);
        setHomeroomClassId(clsList[0].id);
      }
    } catch (err) {
      console.error("Error loading master data:", err);
      showToast("Gagal memuat data kelas & mata pelajaran.", "error");
    } finally {
      setLoadingMaster(false);
    }
  };

  // Load students and session lock whenever date, classId, or subjectId changes
  useEffect(() => {
    if (activeTab === "input" && selectedClassId) {
      loadClassAttendance();
    }
  }, [selectedDate, selectedClassId, selectedSubjectId, activeTab]);

  const loadClassAttendance = async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    try {
      // 1. Check QR Check-in lock
      const lockRes = await studentAttendanceService.checkTeachingSessionLock(
        selectedDate,
        user?.teacherId || user?.id,
        selectedClassId,
        selectedSubjectId,
        undefined,
        isPrivileged
      );
      setSessionLock(lockRes);

      // 2. Fetch class students
      const fetchedStudents = await studentAttendanceService.getStudentsByClass(selectedClassId);

      // 3. Fetch existing attendance record if available
      const existingRecord = await studentAttendanceService.getAttendanceRecord(
        selectedDate,
        selectedClassId,
        selectedSubjectId
      );

      if (existingRecord && existingRecord.students && existingRecord.students.length > 0) {
        setGeneralNotes(existingRecord.notes || "");
        
        const mappedList: StudentAttendanceItem[] = fetchedStudents.map(st => {
          const found = existingRecord.students.find(s => s.studentId === st.id || s.nis === st.nis);
          return {
            studentId: st.id,
            studentName: st.name,
            nis: st.nis || "",
            gender: st.gender || "",
            status: found ? found.status : "Hadir",
            note: found ? (found.note || "") : ""
          };
        });
        setAttendanceList(mappedList);
      } else {
        const defaultList: StudentAttendanceItem[] = fetchedStudents.map(st => ({
          studentId: st.id,
          studentName: st.name,
          nis: st.nis || "",
          gender: st.gender || "",
          status: "Hadir",
          note: ""
        }));
        setAttendanceList(defaultList);
        setGeneralNotes("");
      }
    } catch (err) {
      console.error("Error loading class attendance:", err);
      showToast("Gagal memuat absensi siswa kelas ini.", "error");
    } finally {
      setLoadingStudents(false);
    }
  };

  // Tab trigger fetchers
  useEffect(() => {
    if (activeTab === "history") loadHistory();
    else if (activeTab === "rekap_siswa") loadStudentRecaps();
    else if (activeTab === "rekap_walikelas") loadHomeroomRecaps();
    else if (activeTab === "rekap_kepsek") loadHeadmasterStats();
    else if (activeTab === "audit_trail") loadAuditLogs();
  }, [activeTab, rekapStartDate, rekapEndDate, rekapClassId, homeroomClassId]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const records = await studentAttendanceService.getAttendanceHistory({
        startDate: rekapStartDate,
        endDate: rekapEndDate,
        classId: rekapClassId || undefined,
        teacherId: user?.role === "guru" ? (user.teacherId || user.id) : undefined
      });
      setHistoryRecords(records);
    } catch (err) {
      console.error("Error loading history:", err);
      showToast("Gagal memuat riwayat absensi.", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadStudentRecaps = async () => {
    setLoadingStudentRecaps(true);
    try {
      const res = await studentAttendanceService.getStudentHistoryRecap(rekapClassId || undefined);
      setStudentRecaps(res);
    } catch (err) {
      console.error("Error loading student recaps:", err);
    } finally {
      setLoadingStudentRecaps(false);
    }
  };

  const loadHomeroomRecaps = async () => {
    if (!homeroomClassId) return;
    setLoadingHomeroom(true);
    try {
      const res = await studentAttendanceService.getHomeroomClassRecap(homeroomClassId);
      setHomeroomRecaps(res);
    } catch (err) {
      console.error("Error loading homeroom recaps:", err);
    } finally {
      setLoadingHomeroom(false);
    }
  };

  const loadHeadmasterStats = async () => {
    setLoadingHeadmaster(true);
    try {
      const res = await studentAttendanceService.getHeadmasterOverviewStats();
      setHeadmasterStats(res);
    } catch (err) {
      console.error("Error loading headmaster stats:", err);
    } finally {
      setLoadingHeadmaster(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const res = await studentAttendanceService.getAuditLogs();
      setAuditLogs(res);
    } catch (err) {
      console.error("Error loading audit logs:", err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  // Status Toggles
  const handleToggleSakit = (studentId: string, checked: boolean) => {
    setAttendanceList(prev => prev.map(item => item.studentId === studentId ? { ...item, status: checked ? "Sakit" : "Hadir" } : item));
  };

  const handleToggleIzin = (studentId: string, checked: boolean) => {
    setAttendanceList(prev => prev.map(item => item.studentId === studentId ? { ...item, status: checked ? "Izin" : "Hadir" } : item));
  };

  const handleToggleAlpha = (studentId: string, checked: boolean) => {
    setAttendanceList(prev => prev.map(item => item.studentId === studentId ? { ...item, status: checked ? "Alpha" : "Hadir" } : item));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceList(prev => prev.map(item => item.studentId === studentId ? { ...item, note } : item));
  };

  const handleResetAllHadir = () => {
    setAttendanceList(prev => prev.map(item => ({ ...item, status: "Hadir", note: "" })));
    showToast("Semua siswa dikembalikan ke status Hadir.", "info");
  };

  const activeClassObj = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  const activeSubjectObj = useMemo(() => subjects.find(s => s.id === selectedSubjectId), [subjects, selectedSubjectId]);

  const summary = useMemo(() => {
    let hadir = 0, sakit = 0, izin = 0, alpha = 0;
    attendanceList.forEach(item => {
      if (item.status === "Sakit") sakit++;
      else if (item.status === "Izin") izin++;
      else if (item.status === "Alpha") alpha++;
      else hadir++;
    });
    return { hadir, sakit, izin, alpha, total: attendanceList.length };
  }, [attendanceList]);

  const filteredList = useMemo(() => {
    return attendanceList.filter(item => 
      (item.studentName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nis || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [attendanceList, searchQuery]);

  const handleSaveAttendance = async () => {
    if (!user) {
      showToast("Sesi pengguna tidak valid.", "error");
      return;
    }
    if (!selectedClassId) {
      showToast("Silakan pilih kelas terlebih dahulu.", "error");
      return;
    }

    if (!sessionLock.canInput) {
      showToast(sessionLock.reason || "Pengisian absensi terkunci. Anda harus QR Check-In di kelas terlebih dahulu.", "error");
      return;
    }

    setSaving(true);
    try {
      const className = activeClassObj?.name || selectedClassId;
      const subjectName = activeSubjectObj?.name || "";

      await studentAttendanceService.saveStudentAttendance(
        {
          date: selectedDate,
          classId: selectedClassId,
          className,
          subjectId: selectedSubjectId || "",
          subjectName,
          teacherId: user.teacherId || user.id,
          teacherName: user.name,
          students: attendanceList,
          summary,
          notes: generalNotes,
          isLocked: sessionLock.isLocked,
          lockedReason: sessionLock.reason
        },
        user.id,
        user.name
      );

      showToast(`Absensi siswa kelas ${className} tanggal ${selectedDate} berhasil disimpan!`, "success");
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      showToast(err?.message || "Gagal menyimpan absensi siswa.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteHistoryRecord = async (id: string, className: string, date: string) => {
    if (!user) return;
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data absensi siswa kelas ${className} tanggal ${date}?`)) {
      return;
    }
    try {
      await studentAttendanceService.deleteAttendanceRecord(id, user.id, user.name);
      showToast("Data absensi berhasil dihapus.", "success");
      loadHistory();
    } catch (err: any) {
      console.error("Error deleting history:", err);
      showToast("Gagal menghapus data absensi.", "error");
    }
  };

  // Export functions
  const exportHistoryExcel = () => {
    const data = historyRecords.map(r => ({
      Tanggal: r.date,
      Kelas: `Kelas ${r.className}`,
      MataPelajaran: r.subjectName || "Umum",
      GuruPengampu: r.teacherName,
      Hadir: r.summary?.hadir || 0,
      Sakit: r.summary?.sakit || 0,
      Izin: r.summary?.izin || 0,
      Alpha: r.summary?.alpha || 0,
      TotalSiswa: r.summary?.total || 0
    }));
    exportToExcel(data, `Rekap_Absensi_Siswa_${rekapStartDate}_to_${rekapEndDate}`);
  };

  const exportHistoryPDF = () => {
    const headers = ["Tanggal", "Kelas", "Mata Pelajaran", "Guru", "Hadir", "Sakit", "Izin", "Alpha"];
    const rows = historyRecords.map(r => [
      r.date,
      `Kelas ${r.className}`,
      r.subjectName || "Umum",
      r.teacherName,
      String(r.summary?.hadir || 0),
      String(r.summary?.sakit || 0),
      String(r.summary?.izin || 0),
      String(r.summary?.alpha || 0)
    ]);
    exportToPDF("REKAP PRESENSI SISWA PER MAPEL", headers, rows, `Laporan_Absensi_Siswa_${todayStr}`);
  };

  const exportStudentRecapExcel = () => {
    const data = studentRecaps.map(sr => ({
      NIS: sr.nis,
      NamaSiswa: sr.studentName,
      Kelas: sr.className,
      KehadiranTotalPct: `${sr.overallPercentage}%`,
      TotalHadir: sr.totalHadir,
      TotalSakit: sr.totalSakit,
      TotalIzin: sr.totalIzin,
      TotalAlpha: sr.totalAlpha,
      DetailMataPelajaran: sr.subjects.map(s => `${s.subjectName}: ${s.percentage}%`).join("; ")
    }));
    exportToExcel(data, `Rekap_Kehadiran_Per_Siswa_${todayStr}`);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              Presensi Siswa / Santri
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              📅 {getIndonesianDayName(todayStr)}, {todayStr}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Sistem Absensi Sesi Pembelajaran
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Presensi berbasis Sesi Mengajar (Guru, Mapel, Kelas, JP). Terkunci otomatis setelah QR Check-Out.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab("input")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "input"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Input Absensi
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Riwayat Sesi
          </button>

          <button
            onClick={() => setActiveTab("rekap_siswa")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "rekap_siswa"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Per Siswa (% Mapel)
          </button>

          <button
            onClick={() => setActiveTab("rekap_walikelas")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "rekap_walikelas"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Users className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Wali Kelas
          </button>

          <button
            onClick={() => setActiveTab("rekap_kepsek")}
            className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === "rekap_kepsek"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Kepala Sekolah
          </button>

          {isPrivileged && (
            <button
              onClick={() => setActiveTab("audit_trail")}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                activeTab === "audit_trail"
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Audit Trail
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: INPUT ABSENSI */}
      {activeTab === "input" && (
        <div className="space-y-6">
          
          {/* Controls Bar: Date, Class, Subject */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-emerald-600" />
              Pilih Sesi Mengajar & Kelas
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Date Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tanggal Presensi
                </label>
                <div className="relative">
                  <CalendarIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  />
                </div>
              </div>

              {/* Class Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kelas / Santri
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    disabled={loadingMaster}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        Kelas {c.name} {c.roomCode ? `(${c.roomCode})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subject Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mata Pelajaran (Opsional)
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    disabled={loadingMaster}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  >
                    <option value="">-- Semua / Umum --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || "Mapel"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Session Lock Warning Banner */}
          {sessionLock.isLocked && !sessionLock.canInput ? (
            <div className="p-4 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">🔒 Absensi Siswa Terkunci</h4>
                <p className="mt-0.5 leading-relaxed">
                  {sessionLock.reason} Guru pengampu wajib melakukan <strong>QR Check-In</strong> di kelas terlebih dahulu agar form pengisian absensi siswa terbuka.
                </p>
              </div>
            </div>
          ) : sessionLock.isLocked && isPrivileged ? (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-start gap-3 text-xs text-blue-900 dark:text-blue-200 shadow-sm">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Mode Akses Waka Kurikulum / Admin</h4>
                <p className="mt-0.5 leading-relaxed">
                  Sesi mengajar ini telah di-Check-Out. Anda diizinkan melakukan koreksi data dengan wewenang khusus.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Prinsip Pengisian Absensi Cepat</h4>
                <p className="mt-0.5 leading-relaxed">
                  Secara otomatis seluruh siswa berstatus <strong>Hadir</strong>. Anda cukup menceklis siswa yang <strong>Sakit</strong>, <strong>Izin</strong>, atau <strong>Alpha</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Live Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Siswa</div>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">{summary.total}</div>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">🟢 Hadir (Masuk)</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.hadir}</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 shadow-xs">
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">🟡 Sakit</div>
              <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.sakit}</div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-xs">
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">🔵 Izin</div>
              <div className="text-xl font-bold text-blue-700 dark:text-blue-300 mt-1">{summary.izin}</div>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">🔴 Alpha</div>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">{summary.alpha}</div>
            </div>
          </div>

          {/* Main Student Checklist Table Container */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            
            {/* Header & Search */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Users className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Daftar Siswa Kelas {activeClassObj?.name || ""} ({filteredList.length} Siswa)
                </h3>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari siswa..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleResetAllHadir}
                  disabled={sessionLock.isLocked && !sessionLock.canInput}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 rounded-xl transition-colors shrink-0 disabled:opacity-50"
                >
                  Reset All Hadir
                </button>
              </div>
            </div>

            {/* Student List */}
            <div className="p-4 sm:p-6 space-y-2.5">
              {loadingStudents ? (
                <div className="py-16 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
                  <p className="text-xs">Memuat daftar siswa kelas...</p>
                </div>
              ) : filteredList.length === 0 ? (
                <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <UserX className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum Ada Siswa</p>
                  <p className="text-xs text-slate-500">
                    {!selectedClassId 
                      ? "Pilih kelas terlebih dahulu pada filter di atas." 
                      : `Tidak ada siswa terdaftar pada kelas ${activeClassObj?.name || ""}.`}
                  </p>
                </div>
              ) : (
                filteredList.map((st, index) => {
                  const isSakit = st.status === "Sakit";
                  const isIzin = st.status === "Izin";
                  const isAlpha = st.status === "Alpha";
                  const isHadir = st.status === "Hadir";

                  return (
                    <div 
                      key={st.studentId}
                      className={`p-3.5 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        isSakit 
                          ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60" 
                          : isIzin 
                          ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60"
                          : isAlpha 
                          ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                          : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
                      }`}
                    >
                      {/* Left: Index & Student Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 ${
                          isSakit 
                            ? "bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200" 
                            : isIzin 
                            ? "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                            : isAlpha 
                            ? "bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200"
                            : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                        }`}>
                          {index + 1}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {st.studentName}
                            </span>
                            {st.gender && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                                {st.gender === "L" ? "L" : st.gender === "P" ? "P" : st.gender}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            NIS: {st.nis || "-"}
                          </p>
                        </div>
                      </div>

                      {/* Right: Checkbox Toggles & Status */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
                        
                        <div className="flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 p-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-amber-700 dark:text-amber-400 hover:opacity-80">
                            <input 
                              type="checkbox"
                              checked={isSakit}
                              disabled={sessionLock.isLocked && !sessionLock.canInput}
                              onChange={(e) => handleToggleSakit(st.studentId, e.target.checked)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                            />
                            <span>Sakit</span>
                          </label>

                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>

                          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-blue-700 dark:text-blue-400 hover:opacity-80">
                            <input 
                              type="checkbox"
                              checked={isIzin}
                              disabled={sessionLock.isLocked && !sessionLock.canInput}
                              onChange={(e) => handleToggleIzin(st.studentId, e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                            />
                            <span>Izin</span>
                          </label>

                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>

                          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-rose-700 dark:text-rose-400 hover:opacity-80">
                            <input 
                              type="checkbox"
                              checked={isAlpha}
                              disabled={sessionLock.isLocked && !sessionLock.canInput}
                              onChange={(e) => handleToggleAlpha(st.studentId, e.target.checked)}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                            />
                            <span>Alpha</span>
                          </label>
                        </div>

                        <div>
                          {isHadir && (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Hadir
                            </span>
                          )}
                          {isSakit && (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
                              🤒 Sakit
                            </span>
                          )}
                          {isIzin && (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
                              ✉️ Izin
                            </span>
                          )}
                          {isAlpha && (
                            <span className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200 flex items-center gap-1">
                              ❌ Alpha
                            </span>
                          )}
                        </div>

                        {!isHadir && (
                          <input 
                            type="text"
                            placeholder="Catatan/Alasan..."
                            value={st.note || ""}
                            disabled={sessionLock.isLocked && !sessionLock.canInput}
                            onChange={(e) => handleNoteChange(st.studentId, e.target.value)}
                            className="w-full sm:w-44 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* General Notes */}
              <div className="pt-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Catatan Umum Keterangan Kelas (Opsional)
                </label>
                <input 
                  type="text" 
                  placeholder="Ketik catatan tambahan jika ada..."
                  value={generalNotes}
                  disabled={sessionLock.isLocked && !sessionLock.canInput}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {/* Bottom Save Action */}
            <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Siswa Masuk: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{summary.hadir}</strong> dari {summary.total} Siswa
              </div>

              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={saving || loadingStudents || attendanceList.length === 0 || (sessionLock.isLocked && !sessionLock.canInput)}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan Absensi...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Data Absensi Siswa
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: RIWAYAT SESI */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                Filter Riwayat Sesi Presensi
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportHistoryExcel}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl flex items-center gap-1.5 hover:bg-emerald-200"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Export Excel
                </button>
                <button
                  onClick={exportHistoryPDF}
                  className="px-3 py-1.5 text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 rounded-xl flex items-center gap-1.5 hover:bg-rose-200"
                >
                  <FileText className="w-4 h-4 text-rose-600" />
                  Cetak PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dari Tanggal</label>
                <input 
                  type="date"
                  value={rekapStartDate}
                  onChange={(e) => setRekapStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Sampai Tanggal</label>
                <input 
                  type="date"
                  value={rekapEndDate}
                  onChange={(e) => setRekapEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Filter Kelas</label>
                <select
                  value={rekapClassId}
                  onChange={(e) => setRekapClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100"
                >
                  <option value="">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                Daftar Riwayat Presensi Siswa ({historyRecords.length} Catatan)
              </h3>
            </div>

            <div className="p-4 sm:p-6">
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="text-xs">Memuat riwayat absensi...</p>
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <ClipboardList className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Belum Ada Riwayat Absensi</p>
                  <p className="text-xs text-slate-500">Silakan ubah rentang tanggal atau input absensi baru.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4">Kelas</th>
                        <th className="py-3 px-4">Mata Pelajaran</th>
                        <th className="py-3 px-4">Guru Pengampu</th>
                        <th className="py-3 px-4 text-center">Hadir</th>
                        <th className="py-3 px-4 text-center">Sakit</th>
                        <th className="py-3 px-4 text-center">Izin</th>
                        <th className="py-3 px-4 text-center">Alpha</th>
                        <th className="py-3 px-4 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {historyRecords.map((rec) => (
                        <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                            {rec.date}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                            Kelas {rec.className}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {rec.subjectName || "Umum / General"}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {rec.teacherName}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {rec.summary?.hadir || 0}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400">
                            {rec.summary?.sakit || 0}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-blue-600 dark:text-blue-400">
                            {rec.summary?.izin || 0}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-rose-600 dark:text-rose-400">
                            {rec.summary?.alpha || 0}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => setSelectedHistoryItem(rec)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors"
                                title="Lihat Detail Siswa"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteHistoryRecord(rec.id!, rec.className, rec.date)}
                                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                title="Hapus Data Absensi"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REKAP PER SISWA (PERSENTASE MAPEL) */}
      {activeTab === "rekap_siswa" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-600" />
                Rekap Kehadiran Siswa Per Mata Pelajaran (%)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan tingkat persentase kehadiran tiap siswa pada masing-masing mata pelajaran.
              </p>
            </div>

            <button
              onClick={exportStudentRecapExcel}
              className="px-4 py-2 text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-xl flex items-center gap-2 hover:bg-emerald-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Export Excel Rekap Siswa
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5">
            {loadingStudentRecaps ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500 mb-2" />
                <p className="text-xs">Membuat statistik rekap per siswa...</p>
              </div>
            ) : studentRecaps.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-sm font-semibold">Belum Ada Data Rekap Siswa</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {studentRecaps.map((sr) => (
                  <div key={sr.studentId} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{sr.studentName}</h4>
                        <p className="text-xs text-slate-500">NIS: {sr.nis} — Kelas {sr.className}</p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-xl ${
                        sr.overallPercentage >= 85 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        Total {sr.overallPercentage}%
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Persentase Per Mapel:</div>
                      {sr.subjects.map(sbj => (
                        <div key={sbj.subjectId} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[160px]">{sbj.subjectName}</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{sbj.percentage}% ({sbj.hadir}/{sbj.totalSessions} Sesi)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REKAP WALI KELAS */}
      {activeTab === "rekap_walikelas" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-600" />
                Laporan Kehadiran Wali Kelas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Rincian kehadiran siswa bimbingan per mata pelajaran, guru, dan JP untuk semester berjalan.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={homeroomClassId}
                onChange={(e) => setHomeroomClassId(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>Kelas {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5">
            {loadingHomeroom ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
                <p className="text-xs">Memuat laporan wali kelas...</p>
              </div>
            ) : homeroomRecaps.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-sm font-semibold">Belum Ada Catatan Absensi untuk Kelas Ini</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Nama Siswa</th>
                      <th className="py-3 px-4">NIS</th>
                      <th className="py-3 px-4 text-center">Total Sesi</th>
                      <th className="py-3 px-4 text-center">Hadir</th>
                      <th className="py-3 px-4 text-center">Sakit</th>
                      <th className="py-3 px-4 text-center">Izin</th>
                      <th className="py-3 px-4 text-center">Alpha</th>
                      <th className="py-3 px-4 text-center">% Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {homeroomRecaps.map(hr => (
                      <tr key={hr.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{hr.studentName}</td>
                        <td className="py-3 px-4 text-slate-500">{hr.nis}</td>
                        <td className="py-3 px-4 text-center font-semibold">{hr.totalSessions}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{hr.totalHadir}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-600">{hr.totalSakit}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-600">{hr.totalIzin}</td>
                        <td className="py-3 px-4 text-center font-bold text-rose-600">{hr.totalAlpha}</td>
                        <td className="py-3 px-4 text-center font-bold text-purple-600">{hr.overallPercentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: REKAP KEPALA SEKOLAH */}
      {activeTab === "rekap_kepsek" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" />
              Executive Dashboard Kepala Sekolah — Sesi Kehadiran Siswa
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Ringkasan kehadiran siswa secara menyeluruh per mata pelajaran, guru, dan kelas.
            </p>
          </div>

          {loadingHeadmaster ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
              <p className="text-xs">Memuat executive overview...</p>
            </div>
          ) : headmasterStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* By Subject */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Ringkasan Per Mata Pelajaran
                </h4>
                <div className="space-y-2">
                  {headmasterStats.bySubject.map((item, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{item.subjectName}</span>
                      <span className="font-bold text-indigo-600">{item.attendancePct}% Kehadiran</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Teacher */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Ringkasan Per Guru Pengampu
                </h4>
                <div className="space-y-2">
                  {headmasterStats.byTeacher.map((item, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{item.teacherName}</span>
                      <span className="font-bold text-emerald-600">{item.attendancePct}% Kehadiran</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Class */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Ringkasan Per Kelas
                </h4>
                <div className="space-y-2">
                  {headmasterStats.byClass.map((item, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{item.className}</span>
                      <span className="font-bold text-purple-600">{item.attendancePct}% Kehadiran</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL LOGS */}
      {activeTab === "audit_trail" && isPrivileged && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Audit Trail Log — Perubahan Absensi Terkunci
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan riwayat lengkap pengeditan data absensi siswa yang dilakukan oleh Admin / Waka Kurikulum setelah sesi di Check-Out.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5">
            {loadingAuditLogs ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-500 mb-2" />
                <p className="text-xs">Memuat audit trail log...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-sm font-semibold">Belum Ada Catatan Audit Trail Log</p>
                <p className="text-xs text-slate-500">Seluruh absensi siswa masih murni hasil input guru pengampu.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Waktu Edit</th>
                      <th className="py-3 px-4">Editor (Pengubah)</th>
                      <th className="py-3 px-4">Kelas & Mapel</th>
                      <th className="py-3 px-4">Tanggal Presensi</th>
                      <th className="py-3 px-4">Alasan Audit Trail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {auditLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {log.userName} <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 font-normal">({log.userRole})</span>
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                          Kelas {log.className} — {log.subjectName || "Umum"}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{log.date}</td>
                        <td className="py-3 px-4 font-semibold text-rose-700 dark:text-rose-400 italic">"{log.reason}"</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal for History */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Detail Absensi Siswa Kelas {selectedHistoryItem.className}
                </h3>
                <p className="text-xs text-slate-500">
                  Tanggal: {selectedHistoryItem.date} — {selectedHistoryItem.subjectName || "Umum"}
                </p>
              </div>
              <button 
                onClick={() => setSelectedHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {selectedHistoryItem.students?.map((s, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{s.studentName}</span>
                    {s.nis && <span className="text-slate-400 ml-2">({s.nis})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      s.status === "Sakit" ? "bg-amber-100 text-amber-800" :
                      s.status === "Izin" ? "bg-blue-100 text-blue-800" :
                      s.status === "Alpha" ? "bg-rose-100 text-rose-800" :
                      "bg-emerald-100 text-emerald-800"
                    }`}>
                      {s.status}
                    </span>
                    {s.note && <span className="text-slate-500 italic">"{s.note}"</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 text-right">
              <button
                onClick={() => setSelectedHistoryItem(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-200 rounded-xl"
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
