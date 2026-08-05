import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { 
  QrCode, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  School, 
  User, 
  RefreshCw, 
  LogOut, 
  Printer, 
  History, 
  Sparkles,
  FlaskConical,
  Info,
  Check,
  ChevronRight,
  Users
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { teacherTeachingAttendanceService, getTodayDateStr } from "../services/teacherTeachingAttendance.service";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { Class } from "../types";
import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";
import { ClassQrCardsModal } from "../components/ClassQrCardsModal";

// Synthesize pleasant chime sound on success scan
const playAudioFeedback = (type: "success_checkin" | "success_checkout" | "error") => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "success_checkin") {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc2.frequency.setValueAtTime(659.25, now + 0.1); // E5

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } else if (type === "success_checkout") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } else {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now); // A3
      osc.frequency.setValueAtTime(164.81, now + 0.15); // E3

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (err) {
    // Audio context play error ignored
  }
};

export const TeachingQrCheckInPage: React.FC = () => {
  const { user } = useAuth();
  const [activeAyId, setActiveAyId] = useState<string>("");
  const [activeSemId, setActiveSemId] = useState<string>("");

  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDateStr, setCurrentDateStr] = useState<string>("");
  const [currentDayName, setCurrentDayName] = useState<string>("");

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<{
    type: "success" | "error" | "info";
    action?: "CHECK_IN" | "CHECK_OUT";
    message: string;
    record?: TeacherTeachingAttendance;
  } | null>(null);

  const [processing, setProcessing] = useState<boolean>(false);
  const [todaySchedules, setTodaySchedules] = useState<TeacherTeachingAttendance[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedManualClass, setSelectedManualClass] = useState<string>("");
  const [isClassQrModalOpen, setIsClassQrModalOpen] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-reader-container";

  // Check roles for Wakakur / Admin capabilities
  const isWakakurOrAdmin = user && (
    user.role === "admin" ||
    user.role === "wakil kepala sekolah" ||
    user.role === "kepala sekolah" ||
    user.role === "pimpinan" ||
    user.role === "operator" ||
    (user.roles && (
      user.roles.includes("admin") ||
      user.roles.includes("wakil kepala sekolah") ||
      user.roles.includes("kepala sekolah") ||
      user.roles.includes("pimpinan") ||
      user.roles.includes("wakakur")
    ))
  );

  // Live Time Updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      try {
        setCurrentTime(now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setCurrentDateStr(now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "long", year: "numeric" }));
        setCurrentDayName(now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long" }));
      } catch (e) {
        setCurrentTime(now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
        setCurrentDateStr(now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }));
        setCurrentDayName(now.toLocaleDateString("id-ID", { weekday: "long" }));
      }
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const initData = async () => {
      try {
        const [ays, sems, classList] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters(),
          classService.getClasses()
        ]);
        const activeAy = ays.find(a => a.isActive);
        const activeSem = sems.find(s => s.isActive);
        
        const ayId = activeAy?.id || "";
        const semId = activeSem?.id || "";
        setActiveAyId(ayId);
        setActiveSemId(semId);
        setClasses(classList);

        await fetchTodaySchedules(ayId, semId);
      } catch (err) {
        console.error("Error initializing QR Checkin page:", err);
      }
    };

    initData();
  }, [user]);

  const fetchTodaySchedules = async (ayId: string, semId: string) => {
    if (!user) return;
    const todayStr = getTodayDateStr();
    try {
      const { items } = await teacherTeachingAttendanceService.getAttendanceForDate(todayStr, ayId, semId);
      const teacherNameClean = (user.name || "").toLowerCase().trim();
      const teacherId = user.teacherId || user.id;

      const myItems = items.filter(item => {
        const matchesId = (item.teacherId && item.teacherId === teacherId) || (item.substituteTeacherId && item.substituteTeacherId === teacherId);
        const matchesName = (item.teacherName || "").toLowerCase().trim() === teacherNameClean || (item.substituteTeacherName || "").toLowerCase().trim() === teacherNameClean;
        return matchesId || matchesName;
      });

      setTodaySchedules(myItems);
    } catch (err) {
      console.error("Error fetching today's teacher schedules:", err);
    }
  };

  // Stop Camera Scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn("Failed stopping scanner:", err);
      }
    }
    setIsScanning(false);
  };

  // Process Scanned QR Content
  const handleScanContent = async (scannedContent: string) => {
    if (!user || processing) return;
    setProcessing(true);

    try {
      const userUid = user.uid || user.userId || "";
      const userName = user.displayName || user.name || "Guru";

      const res = await teacherTeachingAttendanceService.processQrCheckIn({
        scannedContent,
        currentUser: {
          id: userUid,
          uid: userUid,
          name: userName,
          teacherId: user.teacherId || "",
          role: user.role || ""
        },
        academicYearId: activeAyId,
        semesterId: activeSemId
      });

      if (res.success) {
        playAudioFeedback(res.action === "CHECK_OUT" ? "success_checkout" : "success_checkin");
        setScanResult({
          type: "success",
          action: res.action,
          message: res.message,
          record: res.record
        });
      } else {
        playAudioFeedback("error");
        setScanResult({
          type: "error",
          message: res.message
        });
      }

      // Refresh today's schedules
      await fetchTodaySchedules(activeAyId, activeSemId);
    } catch (err: any) {
      playAudioFeedback("error");
      setScanResult({
        type: "error",
        message: err?.message || "Terjadi kesalahan saat memproses data absensi QR."
      });
    } finally {
      setProcessing(false);
    }
  };

  // Start Camera QR Scanner
  const startScanner = async () => {
    setScanResult(null);
    setIsScanning(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(scannerContainerId);
      }

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          // On QR Code detected!
          if (processing) return;
          stopScanner();
          handleScanContent(decodedText);
        },
        () => {
          // Frame error ignored
        }
      );
    } catch (err) {
      console.error("Camera start error:", err);
      setIsScanning(false);
      setScanResult({
        type: "error",
        message: "Gagal mengakses kamera. Pastikan izin kamera telah diberikan atau gunakan pilihan simulasi kelas di bawah."
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-indigo-400" />
                Teaching Check-in Modul
              </span>
              <span className="text-xs text-slate-300 font-medium">
                Mandiri Guru
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Scan QR Check-In Mengajar
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Scan QR Code statis kelas yang terpasang di ruang kelas/meja guru untuk konfirmasi <strong>Check In</strong> saat mulai mengajar dan <strong>Check Out</strong> saat pembelajaran selesai.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isWakakurOrAdmin && (
              <>
                <Link
                  to="/teaching-qr-simulation"
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center gap-2"
                >
                  <FlaskConical className="w-4 h-4 text-amber-200 animate-pulse" />
                  <span>Mode Simulasi (Sandbox)</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsClassQrModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak QR Code Kelas</span>
                </button>
              </>
            )}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl flex items-center gap-3">
              <Clock className="w-5 h-5 text-indigo-400 animate-pulse" />
              <div className="text-right">
                <div className="text-lg font-black tracking-wider text-white font-mono">{currentTime}</div>
                <div className="text-[10px] text-slate-300 font-medium">{currentDayName}, {currentDateStr}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: QR Scanner & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-zinc-800 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">Pemindai QR Code Kamera</h2>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Arahkan kamera HP / Laptop ke stiker QR kelas</p>
                </div>
              </div>

              {!isScanning ? (
                <button
                  type="button"
                  onClick={startScanner}
                  disabled={processing}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Scan</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopScanner}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Tutup Kamera</span>
                </button>
              )}
            </div>

            {/* Camera Viewport Container */}
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 min-h-[280px] flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-zinc-700">
              <div id={scannerContainerId} className="w-full h-full overflow-hidden" />

              {!isScanning && (
                <div className="p-8 text-center space-y-3 z-10">
                  <div className="w-16 h-16 bg-slate-800/80 text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                    <QrCode className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Kamera Belum Aktif</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Klik tombol <strong>"Buka Kamera Scan"</strong> untuk memulai pemindaian QR Code kelas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startScanner}
                    className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Aktifkan Kamera</span>
                  </button>
                </div>
              )}
            </div>

            {/* Manual QR Simulation for Testing */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-850 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Simulasi Scan QR Kelas (Pengujian / Alt):
                </span>
                <span className="text-[10px] text-slate-400">Gunakan jika tanpa kamera</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={selectedManualClass}
                  onChange={(e) => setSelectedManualClass(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-200 shadow-xs"
                >
                  <option value="">-- Pilih Kelas untuk Simulasi QR --</option>
                  {classes.map(c => (
                    <option
                      key={c.id || c.name}
                      value={JSON.stringify({
                        type: "SCHOOL_CLASS_QR",
                        classId: c.id,
                        className: c.name,
                        roomCode: c.roomCode || ""
                      })}
                    >
                      {c.name} {c.roomCode ? `(${c.roomCode})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedManualClass) {
                      handleScanContent(selectedManualClass);
                    }
                  }}
                  disabled={!selectedManualClass || processing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{processing ? "Memproses..." : "Proses QR"}</span>
                </button>
              </div>
            </div>

            {/* Scan Result Feedback Alert Box */}
            {scanResult && (
              <div className={`p-5 rounded-2xl border transition-all animate-fade-in ${
                scanResult.type === "success"
                  ? scanResult.action === "CHECK_OUT"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                    : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    scanResult.type === "success"
                      ? scanResult.action === "CHECK_OUT" ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white"
                  }`}>
                    {scanResult.type === "success" ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black uppercase tracking-wider text-xs">
                        {scanResult.type === "success"
                          ? scanResult.action === "CHECK_OUT" ? "BERHASIL CHECK OUT" : "BERHASIL CHECK IN"
                          : "GAGAL VALIDASI CHECK-IN / CHECK-OUT"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold leading-relaxed">
                      {scanResult.message}
                    </p>
                    {scanResult.record && (
                      <div className="mt-2 text-[11px] pt-2 border-t border-black/10 dark:border-white/10 grid grid-cols-2 gap-2">
                        <div><span className="opacity-70">Guru:</span> <strong>{scanResult.record.teacherName}</strong></div>
                        <div><span className="opacity-70">Kelas:</span> <strong>{scanResult.record.className}</strong></div>
                        <div><span className="opacity-70">Sesi:</span> <strong>{scanResult.record.jp} ({scanResult.record.subjectName})</strong></div>
                        <div><span className="opacity-70">Check-In:</span> <strong>{scanResult.record.checkInTime || "-"}</strong></div>
                        <div><span className="opacity-70">Check-Out:</span> <strong>{scanResult.record.checkOutTime || "-"}</strong></div>
                        <div><span className="opacity-70">Durasi:</span> <strong>{scanResult.record.teachingDurationMinutes || 0} Menit</strong></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Today's Schedule & Realtime Attendance Log (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* User Status Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center font-black text-lg shadow-inner">
                {user?.name?.charAt(0) || "G"}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{user?.name}</h3>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200/50">
                  {user?.role || "Guru"}
                </span>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-zinc-850 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span>Jadwal Mengajar Hari Ini ({currentDayName}):</span>
                <strong className="text-slate-900 dark:text-zinc-100 font-extrabold">{todaySchedules.length} Sesi</strong>
              </div>
            </div>
          </div>

          {/* Today's Schedules List */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-md border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600" />
                Jadwal & Status Check-In Hari Ini
              </h3>
              <button
                onClick={() => fetchTodaySchedules(activeAyId, activeSemId)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Refresh Jadwal"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {todaySchedules.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
                Anda tidak memiliki jadwal mengajar terdaftar pada hari ini ({currentDayName}).
              </div>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {todaySchedules.map((sch, idx) => {
                  const hasCheckedOut = !!sch.checkOutTime;
                  const isBelumTerkonfirmasi = sch.status === "Belum Terkonfirmasi";
                  const hasCheckedIn = !!sch.checkInTime && !isBelumTerkonfirmasi;

                  return (
                    <div
                      key={sch.scheduleId || idx}
                      className={`p-4 rounded-2xl border transition-all text-xs space-y-2.5 ${
                        hasCheckedOut
                          ? "bg-slate-50 dark:bg-zinc-850/60 border-slate-200 dark:border-zinc-800"
                          : hasCheckedIn
                            ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60"
                            : isBelumTerkonfirmasi
                              ? "bg-orange-50/60 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/60"
                              : "bg-white dark:bg-zinc-850 border-slate-200 dark:border-zinc-750"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white dark:bg-zinc-100 dark:text-slate-900 text-[10px] font-black rounded-lg uppercase">
                            Kelas {sch.className}
                          </span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{sch.jp}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full uppercase ${
                          hasCheckedOut
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300"
                            : hasCheckedIn
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                              : isBelumTerkonfirmasi
                                ? "bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 border border-orange-300"
                                : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300"
                        }`}>
                          {hasCheckedOut
                            ? "Selesai (Checked Out)"
                            : hasCheckedIn
                              ? "Sedang Mengajar"
                              : isBelumTerkonfirmasi
                                ? "Belum Terkonfirmasi"
                                : "Belum Check In"}
                        </span>
                      </div>

                      <div className="font-extrabold text-slate-800 dark:text-zinc-200 text-sm">
                        {sch.subjectName}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Waktu: <strong>{sch.timeSlot || "07:30 - 08:15"}</strong></span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          {sch.checkInTime && <span>IN: <strong>{sch.checkInTime}</strong></span>}
                          {sch.checkOutTime && <span>OUT: <strong>{sch.checkOutTime}</strong></span>}
                        </div>
                      </div>

                      {sch.teachingDurationMinutes && sch.teachingDurationMinutes > 0 && (
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold text-right">
                          Durasi Mengajar: {sch.teachingDurationMinutes} Menit
                        </div>
                      )}

                      <div className="pt-1 text-right">
                        <Link
                          to={`/student-attendance`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg transition-colors"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Absensi Siswa Kelas Ini
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Class QR Cards Modal */}
      <ClassQrCardsModal
        isOpen={isClassQrModalOpen}
        onClose={() => setIsClassQrModalOpen(false)}
      />
    </div>
  );
};

export default TeachingQrCheckInPage;
