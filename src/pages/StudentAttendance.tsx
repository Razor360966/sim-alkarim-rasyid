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
  RefreshCw, 
  Filter, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  Check, 
  UserCheck, 
  UserX,
  History,
  Clock
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { studentAttendanceService } from "../services/studentAttendanceService";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { getTodayDateStr, getIndonesianDayName } from "../services/teacherTeachingAttendance.service";
import { Class, Subject, Student } from "../types";
import { ClassStudentAttendanceRecord, StudentAttendanceItem, StudentAttendanceStatus } from "../types/studentAttendance.types";

export const StudentAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const todayStr = getTodayDateStr();

  // Tabs
  const [activeTab, setActiveTab] = useState<"input" | "rekap">("input");

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

  // History / Rekap State
  const [rekapStartDate, setRekapStartDate] = useState<string>(todayStr);
  const [rekapEndDate, setRekapEndDate] = useState<string>(todayStr);
  const [rekapClassId, setRekapClassId] = useState<string>("");
  const [historyRecords, setHistoryRecords] = useState<ClassStudentAttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ClassStudentAttendanceRecord | null>(null);

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
      }
    } catch (err) {
      console.error("Error loading master data:", err);
      showToast("Gagal memuat data kelas & mata pelajaran.", "error");
    } finally {
      setLoadingMaster(false);
    }
  };

  // Load students and existing record whenever date, classId, or subjectId changes
  useEffect(() => {
    if (activeTab === "input" && selectedClassId) {
      loadClassAttendance();
    }
  }, [selectedDate, selectedClassId, selectedSubjectId, activeTab]);

  const loadClassAttendance = async () => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    try {
      // 1. Fetch class students
      const fetchedStudents = await studentAttendanceService.getStudentsByClass(selectedClassId);

      // 2. Fetch existing attendance record if available
      const existingRecord = await studentAttendanceService.getAttendanceRecord(
        selectedDate,
        selectedClassId,
        selectedSubjectId
      );

      if (existingRecord && existingRecord.students && existingRecord.students.length > 0) {
        setGeneralNotes(existingRecord.notes || "");
        
        // Map fetched students with saved attendance
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
        // Default ALL students to "Hadir"
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

  // Load history records for Rekap
  useEffect(() => {
    if (activeTab === "rekap") {
      loadHistory();
    }
  }, [activeTab, rekapStartDate, rekapEndDate, rekapClassId]);

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
      showToast("Gagal memuat riwayat absensi siswa.", "error");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Handlers for Checklist status toggles
  const handleToggleSakit = (studentId: string, checked: boolean) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return {
          ...item,
          status: checked ? "Sakit" : "Hadir"
        };
      }
      return item;
    }));
  };

  const handleToggleIzin = (studentId: string, checked: boolean) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return {
          ...item,
          status: checked ? "Izin" : "Hadir"
        };
      }
      return item;
    }));
  };

  const handleToggleAlpha = (studentId: string, checked: boolean) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return {
          ...item,
          status: checked ? "Alpha" : "Hadir"
        };
      }
      return item;
    }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, note };
      }
      return item;
    }));
  };

  const handleResetAllHadir = () => {
    setAttendanceList(prev => prev.map(item => ({
      ...item,
      status: "Hadir",
      note: ""
    })));
    showToast("Semua siswa dikembalikan ke status Hadir.", "info");
  };

  // Selected Class & Subject Objects
  const activeClassObj = useMemo(() => classes.find(c => c.id === selectedClassId), [classes, selectedClassId]);
  const activeSubjectObj = useMemo(() => subjects.find(s => s.id === selectedSubjectId), [subjects, selectedSubjectId]);

  // Live Summary
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

  // Filtered student list for input form
  const filteredList = useMemo(() => {
    return attendanceList.filter(item => 
      (item.studentName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nis || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [attendanceList, searchQuery]);

  // Save Attendance Record
  const handleSaveAttendance = async () => {
    if (!user) {
      showToast("Sesi pengguna tidak valid.", "error");
      return;
    }
    if (!selectedClassId) {
      showToast("Silakan pilih kelas terlebih dahulu.", "error");
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
          notes: generalNotes
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

  // Delete Record in Rekap
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

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
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
            Sistem Absensi Siswa
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola dan catat kehadiran siswa/santri per kelas & mata pelajaran dengan cepat.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab("input")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "input"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Input Absensi
          </button>
          <button
            onClick={() => setActiveTab("rekap")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === "rekap"
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            Rekap & Riwayat
          </button>
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

          {/* Checklist Rules Info Banner */}
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200 shadow-xs">
            <Info className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Prinsip Pengisian Absensi Cepat</h4>
              <p className="mt-0.5 leading-relaxed">
                Guru cukup menceklis siswa yang <strong>Sakit</strong> atau <strong>Izin</strong> (atau Alpha). Apabila siswa <strong>tidak terceklis</strong> Sakit/Izin, maka siswa tersebut secara otomatis tercatat <strong>Hadir Masuk</strong>.
              </p>
            </div>
          </div>

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
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:hover:bg-emerald-900 rounded-xl transition-colors shrink-0"
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
                        
                        {/* Interactive Checklist Box for Sakit / Izin / Alpha */}
                        <div className="flex items-center gap-3 bg-white/90 dark:bg-slate-900/90 p-2 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                          {/* Sakit Checkbox */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-amber-700 dark:text-amber-400 hover:opacity-80">
                            <input 
                              type="checkbox"
                              checked={isSakit}
                              onChange={(e) => handleToggleSakit(st.studentId, e.target.checked)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 accent-amber-600 cursor-pointer"
                            />
                            <span>Sakit</span>
                          </label>

                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>

                          {/* Izin Checkbox */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-blue-700 dark:text-blue-400 hover:opacity-80">
                            <input 
                              type="checkbox"
                              checked={isIzin}
                              onChange={(e) => handleToggleIzin(st.studentId, e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                            />
                            <span>Izin</span>
                          </label>

                          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>

                          {/* Alpha Checkbox */}
                          <label className="flex items-center gap-1.5 cursor-pointer select-none font-medium text-rose-700 dark:text-rose-400 hover:opacity-80">
                            <input 
                              type="checkbox"
                              checked={isAlpha}
                              onChange={(e) => handleToggleAlpha(st.studentId, e.target.checked)}
                              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 accent-rose-600 cursor-pointer"
                            />
                            <span>Alpha</span>
                          </label>
                        </div>

                        {/* Status Badge */}
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

                        {/* Reason / Note input if not Hadir */}
                        {!isHadir && (
                          <input 
                            type="text"
                            placeholder="Catatan/Alasan..."
                            value={st.note || ""}
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
                disabled={saving || loadingStudents || attendanceList.length === 0}
                className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
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

      {/* TAB 2: REKAP & RIWAYAT */}
      {activeTab === "rekap" && (
        <div className="space-y-6">
          
          {/* History Filters */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" />
              Filter Riwayat Absensi
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Dari Tanggal
                </label>
                <input 
                  type="date"
                  value={rekapStartDate}
                  onChange={(e) => setRekapStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Sampai Tanggal
                </label>
                <input 
                  type="date"
                  value={rekapEndDate}
                  onChange={(e) => setRekapEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Filter Kelas
                </label>
                <select
                  value={rekapClassId}
                  onChange={(e) => setRekapClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  <option value="">Semua Kelas</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>Kelas {c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Records Table */}
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

      {/* Detail Modal for Rekap */}
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
