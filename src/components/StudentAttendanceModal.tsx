import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  UserCheck, 
  UserX, 
  UserMinus, 
  FileText, 
  Save, 
  Loader2,
  Info,
  Check
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { studentAttendanceService } from "../services/studentAttendanceService";
import { Student } from "../types";
import { StudentAttendanceItem, StudentAttendanceStatus } from "../types/studentAttendance.types";

interface StudentAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  className: string;
  date: string; // YYYY-MM-DD
  subjectId?: string;
  subjectName?: string;
  scheduleId?: string;
  journalId?: string;
  onSaveSuccess?: (summary: { hadir: number; sakit: number; izin: number; alpha: number; total: number }, students: StudentAttendanceItem[]) => void;
}

export const StudentAttendanceModal: React.FC<StudentAttendanceModalProps> = ({
  isOpen,
  onClose,
  classId,
  className,
  date,
  subjectId,
  subjectName,
  scheduleId,
  journalId,
  onSaveSuccess
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceList, setAttendanceList] = useState<StudentAttendanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [generalNotes, setGeneralNotes] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("semua");

  useEffect(() => {
    if (isOpen && classId) {
      loadData();
    }
  }, [isOpen, classId, date, subjectId, journalId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch class students
      const fetchedStudents = await studentAttendanceService.getStudentsByClass(classId);
      setStudents(fetchedStudents);

      // 2. Fetch existing attendance record if available
      const existingRecord = await studentAttendanceService.getAttendanceRecord(
        date, 
        classId, 
        subjectId, 
        journalId
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
            status: found ? found.status : "Hadir", // Default to Hadir if not saved
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
      console.error("Error loading attendance data:", err);
      showToast("Gagal memuat daftar siswa.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Toggle checklist for Sakit
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

  // Toggle checklist for Izin
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

  // Toggle checklist for Alpha
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

  // Direct status change
  const handleSetStatus = (studentId: string, status: StudentAttendanceStatus) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, status };
      }
      return item;
    }));
  };

  // Update note/reason
  const handleNoteChange = (studentId: string, note: string) => {
    setAttendanceList(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, note };
      }
      return item;
    }));
  };

  // Reset all students to Hadir
  const handleResetAllHadir = () => {
    setAttendanceList(prev => prev.map(item => ({
      ...item,
      status: "Hadir",
      note: ""
    })));
    showToast("Semua siswa dikembalikan ke status Hadir.", "info");
  };

  // Calculate live summary
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

  // Filtered list
  const filteredList = useMemo(() => {
    return attendanceList.filter(item => {
      const matchesSearch = 
        (item.studentName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.nis || "").toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterStatus === "semua") return matchesSearch;
      if (filterStatus === "non-hadir") return matchesSearch && item.status !== "Hadir";
      return matchesSearch && item.status.toLowerCase() === filterStatus.toLowerCase();
    });
  }, [attendanceList, searchQuery, filterStatus]);

  // Save attendance
  const handleSave = async () => {
    if (!user) {
      showToast("Sesi pengguna tidak valid.", "error");
      return;
    }
    setSaving(true);
    try {
      const record = await studentAttendanceService.saveStudentAttendance(
        {
          date,
          classId,
          className,
          subjectId: subjectId || "",
          subjectName: subjectName || "",
          scheduleId: scheduleId || "",
          journalId: journalId || "",
          teacherId: user.teacherId || user.id,
          teacherName: user.name,
          students: attendanceList,
          summary,
          notes: generalNotes
        },
        user.id,
        user.name
      );

      showToast(`Absensi siswa kelas ${className} berhasil disimpan!`, "success");
      if (onSaveSuccess) {
        onSaveSuccess(summary, attendanceList);
      }
      onClose();
    } catch (err: any) {
      console.error("Error saving student attendance:", err);
      showToast(err?.message || "Gagal menyimpan absensi siswa.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Absensi Siswa / Santri
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                📅 {date}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              Kelas {className} {subjectName ? `— ${subjectName}` : ""}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tandai kehadiran siswa untuk sesi mengajar ini.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner & Summary */}
        <div className="px-4 sm:px-6 pt-4 pb-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 space-y-3">
          
          {/* Main instruction banner fulfilling prompt */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
            <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Kemudahan Absensi:</span> Secara otomatis, seluruh siswa berstatus <strong className="underline">Hadir</strong>. Anda cukup menceklis kolom <strong className="text-amber-700 dark:text-amber-400">Sakit</strong> atau <strong className="text-blue-700 dark:text-blue-400">Izin</strong> untuk siswa yang tidak masuk. Siswa yang tidak terceklis otomatis dianggap <strong className="text-emerald-700 dark:text-emerald-400">Hadir</strong>.
            </div>
          </div>

          {/* Live Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-semibold">
            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Siswa</div>
              <div className="text-lg font-bold mt-0.5">{summary.total}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Hadir</div>
              <div className="text-lg font-bold mt-0.5">{summary.hadir}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <div className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider">Sakit</div>
              <div className="text-lg font-bold mt-0.5">{summary.sakit}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-wider">Izin</div>
              <div className="text-lg font-bold mt-0.5">{summary.izin}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase tracking-wider">Alpha</div>
              <div className="text-lg font-bold mt-0.5">{summary.alpha}</div>
            </div>
          </div>

          {/* Search & Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pb-2">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Cari nama atau NIS siswa..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setFilterStatus("semua")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filterStatus === "semua" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-600 dark:text-slate-400"}`}
                >
                  Semua ({attendanceList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus("non-hadir")}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${filterStatus === "non-hadir" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs" : "text-slate-600 dark:text-slate-400"}`}
                >
                  Sakit/Izin/Alpha ({summary.sakit + summary.izin + summary.alpha})
                </button>
              </div>

              <button
                type="button"
                onClick={handleResetAllHadir}
                className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 rounded-xl transition-colors shrink-0"
              >
                Reset (Hadir Semua)
              </button>
            </div>
          </div>
        </div>

        {/* Content Body - Student Checklist List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
              <p className="text-xs">Memuat data siswa kelas {className}...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <UserX className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tidak Ada Siswa Ditemukan</p>
              <p className="text-xs text-slate-500">
                {students.length === 0 
                  ? `Belum ada siswa terdaftar di Kelas ${className}.` 
                  : "Coba ubah kata kunci pencarian atau filter status."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredList.map((st, index) => {
                const isSakit = st.status === "Sakit";
                const isIzin = st.status === "Izin";
                const isAlpha = st.status === "Alpha";
                const isHadir = st.status === "Hadir";

                return (
                  <div 
                    key={st.studentId}
                    className={`p-3 rounded-2xl border transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      isSakit 
                        ? "bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60" 
                        : isIzin 
                        ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/60"
                        : isAlpha 
                        ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60"
                        : "bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  >
                    {/* Student Info */}
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
                          <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">
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

                    {/* Controls & Status Checks */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
                      
                      {/* Checkboxes for Sakit and Izin */}
                      <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 p-1.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
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

                      {/* Explicit Status Badge */}
                      <div className="flex items-center gap-1">
                        {isHadir && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> Hadir
                          </span>
                        )}
                        {isSakit && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
                            🤒 Sakit
                          </span>
                        )}
                        {isIzin && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200 flex items-center gap-1">
                            ✉️ Izin
                          </span>
                        )}
                        {isAlpha && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-xl bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200 flex items-center gap-1">
                            ❌ Alpha
                          </span>
                        )}
                      </div>

                      {/* Optional Reason / Note Input if not Hadir */}
                      {!isHadir && (
                        <input 
                          type="text"
                          placeholder="Alasan / Catatan (opsional)..."
                          value={st.note || ""}
                          onChange={(e) => handleNoteChange(st.studentId, e.target.value)}
                          className="w-full sm:w-44 px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Optional Catatan Umum */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Catatan Khusus Sesi Ini (Opsional)
            </label>
            <input 
              type="text" 
              placeholder="Contoh: Pembelajaran berjalan lancar, 2 siswa izin kegiatan lomba OSIS."
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Hadir: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{summary.hadir}</strong> / {summary.total} Siswa
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || students.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Absensi Siswa
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
