import React, { useState, useEffect } from "react";
import { 
  UserCheck, 
  Lock, 
  User, 
  Clock, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  BookOpen, 
  School, 
  Printer, 
  ArrowRight, 
  LogOut, 
  Loader2,
  RefreshCw,
  HelpCircle
} from "lucide-react";
import { teacherTeachingAttendanceService } from "../services/teacherTeachingAttendance.service";
import { useSchoolIdentity } from "../contexts/SchoolIdentityContext";
import { OfficeBarcodeModal } from "../components/OfficeBarcodeModal";
import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";

interface VerifiedTeacher {
  teacherId: string;
  teacherName: string;
  niy: string;
  userId: string;
  userName: string;
  email: string;
  role: string;
}

interface AssistedSession {
  sessionKey: string;
  scheduleId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  jpLabel: string;
  startStr: string;
  endStr: string;
  startM: number;
  endM: number;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInType?: string;
  method?: string;
  notes?: string;
  items: TeacherTeachingAttendance[];
}

export const AssistedCheckIn: React.FC = () => {
  const { identity } = useSchoolIdentity();

  // Authentication State
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [verifiedTeacher, setVerifiedTeacher] = useState<VerifiedTeacher | null>(null);

  // Sessions State
  const [sessions, setSessions] = useState<AssistedSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [isKbmDisabled, setIsKbmDisabled] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // Check-In Action State
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    teacherName: string;
    subjectName: string;
    className: string;
    scheduleTime: string;
    checkInTime: string;
    method: string;
    status: string;
    action: "CHECK_IN" | "CHECK_OUT";
  } | null>(null);

  // Barcode Print Modal State
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Live Clock
  const [currentTimeStr, setCurrentTimeStr] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      try {
        const timeFmt = new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        }).format(now);
        setCurrentTimeStr(`${timeFmt} WIB`);

        const dateFmt = new Intl.DateTimeFormat("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric"
        }).format(now);
        setCurrentDateStr(dateFmt);
      } catch (e) {
        setCurrentTimeStr(now.toLocaleTimeString("id-ID"));
        setCurrentDateStr(now.toLocaleDateString("id-ID"));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load Sessions when Teacher is Verified
  const loadSessionsForTeacher = async (teacherId: string) => {
    setLoadingSessions(true);
    setActionError(null);
    try {
      const result = await teacherTeachingAttendanceService.getTeacherAssistedSessions(teacherId);
      setIsKbmDisabled(result.isKbmDisabled);
      setLockReason(result.lockReason || null);
      setSessions(result.sessions);

      // Auto-select first available session if none selected
      if (result.sessions.length > 0) {
        const pendingSession = result.sessions.find(s => !s.checkInTime);
        if (pendingSession) {
          setSelectedScheduleId(pendingSession.scheduleId);
        } else {
          setSelectedScheduleId(result.sessions[0].scheduleId);
        }
      } else {
        setSelectedScheduleId(null);
      }
    } catch (err: any) {
      console.error("Failed to load sessions:", err);
      setActionError("Gagal memuat jadwal mengajar. Silakan coba lagi.");
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsVerifying(true);
    setSuccessResult(null);

    try {
      const res = await teacherTeachingAttendanceService.verifyTeacherCredentials(
        identifier,
        password
      );

      if (!res.success || !res.teacher) {
        setAuthError(res.message || "Verifikasi identitas gagal. Periksa username dan password.");
        return;
      }

      setVerifiedTeacher(res.teacher);
      setPassword(""); // Clear sensitive password immediately from memory
      await loadSessionsForTeacher(res.teacher.teacherId);
    } catch (err: any) {
      console.error("Verification error:", err);
      setAuthError(err.message || "Terjadi kesalahan pada sistem verifikasi.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetTeacher = () => {
    setVerifiedTeacher(null);
    setSessions([]);
    setSelectedScheduleId(null);
    setSuccessResult(null);
    setAuthError(null);
    setActionError(null);
    setPassword("");
    setIdentifier("");
  };

  const handleExecuteCheckIn = async (actionType: "CHECK_IN" | "CHECK_OUT" = "CHECK_IN") => {
    if (!verifiedTeacher || !selectedScheduleId) return;

    const selectedSession = sessions.find(s => s.scheduleId === selectedScheduleId);
    if (!selectedSession) return;

    setSubmittingAction(true);
    setActionError(null);

    try {
      const res = await teacherTeachingAttendanceService.processAssistedCheckIn({
        teacherId: verifiedTeacher.teacherId,
        teacherName: verifiedTeacher.teacherName,
        scheduleId: selectedScheduleId,
        verifiedUserId: verifiedTeacher.userId,
        verifiedUserName: verifiedTeacher.userName,
        action: actionType
      });

      if (!res.success) {
        setActionError(res.message);
        return;
      }

      // Success
      setSuccessResult({
        teacherName: verifiedTeacher.teacherName,
        subjectName: selectedSession.subjectName,
        className: selectedSession.className,
        scheduleTime: `${selectedSession.startStr} - ${selectedSession.endStr} WIB (${selectedSession.jpLabel})`,
        checkInTime: res.record?.checkInTime || currentTimeStr,
        method: "Check-in Dibantu",
        status: res.record?.status || "Hadir Mengajar",
        action: res.action === "CHECK_OUT" ? "CHECK_OUT" : "CHECK_IN"
      });

      // Reload sessions to refresh status
      await loadSessionsForTeacher(verifiedTeacher.teacherId);
    } catch (err: any) {
      console.error("Check-in error:", err);
      setActionError(err.message || "Gagal memproses absensi. Silakan ulangi.");
    } finally {
      setSubmittingAction(false);
    }
  };

  const selectedSession = sessions.find(s => s.scheduleId === selectedScheduleId);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 flex flex-col justify-between">
      {/* Top Bar / Header Kiosk */}
      <header className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 px-4 py-3 sm:px-8 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white">
                {identity.fullName || identity.schoolName || "SMP IT AL-KARIM RASYID"}
              </h1>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                TERMINAL KANTOR — ASSISTED CHECK-IN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Clock Badge */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                {currentTimeStr}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                {currentDateStr}
              </span>
            </div>

            {/* Print Barcode Button */}
            <button
              onClick={() => setShowBarcodeModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-700 transition-colors"
              title="Cetak Barcode Kantor"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden md:inline">Cetak Barcode Kantor</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 md:py-8 space-y-6">
        {/* Page Title & Subtext */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold uppercase tracking-wider mb-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>METODE: CHECK-IN DIBANTU</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            ASSISTED CHECK-IN
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
            Digunakan untuk guru yang tidak membawa HP. Verifikasi identitas akun Anda untuk mengakses jadwal dan melakukan check-in resmi.
          </p>
        </div>

        {/* STEP 1: IDENTIFIKASI GURU */}
        {!verifiedTeacher ? (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Identifikasi Akun Guru
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Masukkan Username / Email dan Kata Sandi akun SIMAK Anda
                </p>
              </div>
            </div>

            {authError && (
              <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-2.5 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Email atau Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Contoh: ustadz_ahmad atau email@sekolah.sch.id"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi akun SIMAK"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Memverifikasi Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Verifikasi Identitas Guru</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 text-center">
              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                Keamanan Terjamin: Sistem menggunakan autentikasi terisolasi dan tidak menyimpan kata sandi Anda di terminal.
              </p>
            </div>
          </div>
        ) : (
          /* STEP 2: GURU TERVERIFIKASI & SESI MENGAJAR */
          <div className="space-y-6">
            {/* Identity Verified Card */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Selamat datang,
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {verifiedTeacher.teacherName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                    {verifiedTeacher.niy && <span>NIY: {verifiedTeacher.niy}</span>}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      Terverifikasi
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleResetTeacher}
                className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xs transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Ganti Guru / Selesai</span>
              </button>
            </div>

            {/* Success Result Banner */}
            {successResult && (
              <div className="bg-emerald-600 text-white rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold">
                      {successResult.action === "CHECK_OUT" ? "Check-Out Berhasil!" : "Check-In Berhasil!"}
                    </h4>
                    <p className="text-xs text-emerald-100">
                      Absensi telah tercatat resmi di sistem SIMAK dengan metode Check-in Dibantu.
                    </p>
                  </div>
                </div>

                <div className="bg-white/10 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-emerald-200 text-[10px] uppercase font-bold">Guru</div>
                    <div className="font-semibold">{successResult.teacherName}</div>
                  </div>
                  <div>
                    <div className="text-emerald-200 text-[10px] uppercase font-bold">Mapel & Kelas</div>
                    <div className="font-semibold">{successResult.subjectName} ({successResult.className})</div>
                  </div>
                  <div>
                    <div className="text-emerald-200 text-[10px] uppercase font-bold">Waktu Absen</div>
                    <div className="font-semibold">{successResult.checkInTime} WIB</div>
                  </div>
                  <div>
                    <div className="text-emerald-200 text-[10px] uppercase font-bold">Status Kehadiran</div>
                    <div className="font-semibold">{successResult.status}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {actionError && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div>
                  <div className="font-bold">Gagal Melakukan Absensi:</div>
                  <div>{actionError}</div>
                </div>
              </div>
            )}

            {/* Kaldik Blocking Notice */}
            {isKbmDisabled && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div>
                  <div className="font-bold">KBM Ditiadakan Hari Ini</div>
                  <div>{lockReason || "Berdasarkan Kalender Akademik, hari ini tidak ada kegiatan KBM."}</div>
                </div>
              </div>
            )}

            {/* Sessions Table Card */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Jadwal Mengajar Hari Ini ({currentDateStr || "Hari Ini"})</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Pilih sesi yang ingin Anda check-in
                  </p>
                </div>

                <button
                  onClick={() => loadSessionsForTeacher(verifiedTeacher.teacherId)}
                  disabled={loadingSessions}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Segarkan Jadwal"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSessions ? "animate-spin text-emerald-600" : ""}`} />
                </button>
              </div>

              {loadingSessions ? (
                <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>Memuat jadwal mengajar...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="py-10 text-center text-slate-500 dark:text-zinc-400 text-xs">
                  <p className="font-semibold text-slate-700 dark:text-zinc-200">
                    Tidak ada jadwal mengajar yang ditemukan untuk hari ini.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pastikan jadwal mengajar Anda di semester & tahun ajaran aktif telah terdaftar.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Pilih</th>
                        <th className="py-2.5 px-3">Jam</th>
                        <th className="py-2.5 px-3">Mapel</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">JP</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
                      {sessions.map((sess) => {
                        const isSelected = selectedScheduleId === sess.scheduleId;
                        const isCheckedIn = !!sess.checkInTime;
                        const isCheckedOut = !!sess.checkOutTime;

                        return (
                          <tr
                            key={sess.sessionKey}
                            onClick={() => setSelectedScheduleId(sess.scheduleId)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-emerald-50/80 dark:bg-emerald-950/40 font-semibold"
                                : "hover:bg-slate-50 dark:hover:bg-zinc-800/40"
                            }`}
                          >
                            <td className="py-3 px-3">
                              <input
                                type="radio"
                                name="selectedSession"
                                checked={isSelected}
                                onChange={() => setSelectedScheduleId(sess.scheduleId)}
                                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                              />
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                              {sess.startStr} - {sess.endStr}
                            </td>
                            <td className="py-3 px-3 text-slate-900 dark:text-white font-bold">
                              {sess.subjectName}
                            </td>
                            <td className="py-3 px-3 text-slate-700 dark:text-zinc-300">
                              {sess.className}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-semibold text-[11px]">
                                {sess.jpLabel}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {isCheckedOut ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                                  ✓ Selesai ({sess.checkOutTime})
                                </span>
                              ) : isCheckedIn ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                                  Check-in: {sess.checkInTime}
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                  {sess.status || "Belum Absen"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Action Buttons */}
              {selectedSession && !isKbmDisabled && (
                <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 dark:text-zinc-400 text-center sm:text-left">
                    Sesi terpilih: <strong>{selectedSession.subjectName}</strong> di kelas <strong>{selectedSession.className}</strong> ({selectedSession.jpLabel})
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* If not checked in: Show CHECK-IN button */}
                    {!selectedSession.checkInTime && (
                      <button
                        onClick={() => handleExecuteCheckIn("CHECK_IN")}
                        disabled={submittingAction}
                        className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submittingAction ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menyimpan Absensi...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>CHECK-IN SEKARANG</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* If checked in but not checked out: Show CHECK-OUT button */}
                    {selectedSession.checkInTime && !selectedSession.checkOutTime && (
                      <button
                        onClick={() => handleExecuteCheckIn("CHECK_OUT")}
                        disabled={submittingAction}
                        className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {submittingAction ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Menyimpan Check-Out...</span>
                          </>
                        ) : (
                          <>
                            <LogOut className="w-4 h-4" />
                            <span>CHECK-OUT SEKARANG</span>
                          </>
                        )}
                      </button>
                    )}

                    {/* If both completed */}
                    {selectedSession.checkInTime && selectedSession.checkOutTime && (
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                        Sesi Selesai (Tidak Dapat Diubah)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500 dark:text-zinc-500 shrink-0">
        <p>© {new Date().getFullYear()} {identity.schoolName || "SIMAK SMP IT AL-KARIM RASYID"} • Sistem Absensi Mengajar Guru</p>
      </footer>

      {/* Office Barcode Modal */}
      <OfficeBarcodeModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
      />
    </div>
  );
};

export default AssistedCheckIn;
