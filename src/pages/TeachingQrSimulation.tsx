import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { 
  FlaskConical, 
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
  Trash2, 
  History, 
  Sparkles,
  Info,
  Check,
  ChevronRight,
  Shield,
  ShieldAlert,
  Play,
  Key,
  Unlock,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { teacherTeachingAttendanceService, getTodayDateStr, getIndonesianDayName } from "../services/teacherTeachingAttendance.service";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { userService } from "../services/user.service";
import { Class, UserSystem } from "../types";
import { TeacherTeachingAttendance, TeacherAttendanceAuditLog } from "../types/teacherTeachingAttendance.types";

export const TeachingQrSimulationPage: React.FC = () => {
  const { user } = useAuth();

  // Role Access Restriction: Admin & Wakakur
  const isAuthorized = user && (
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

  const [activeAyId, setActiveAyId] = useState<string>("");
  const [activeSemId, setActiveSemId] = useState<string>("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<UserSystem[]>([]);

  // Simulation Clock Settings
  const [useCustomTime, setUseCustomTime] = useState<boolean>(false);
  const [customTime, setCustomTime] = useState<string>("07:30");
  const [realtimeClock, setRealtimeClock] = useState<string>("");

  // Target Test Teacher & Class
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [manualQrCode, setManualQrCode] = useState<string>("");

  // Scanner State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "simulation-qr-reader";

  // Data & Dashboard State
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [todaySimulationItems, setTodaySimulationItems] = useState<TeacherTeachingAttendance[]>([]);
  const [auditLogs, setAuditLogs] = useState<TeacherAttendanceAuditLog[]>([]);

  // Feedback State
  const [scanResult, setScanResult] = useState<{
    type: "success" | "error" | "info";
    action?: "CHECK_IN" | "CHECK_OUT";
    message: string;
    record?: TeacherTeachingAttendance;
  } | null>(null);

  // Wakakur Unlock Modal State
  const [unlockModalItem, setUnlockModalItem] = useState<TeacherTeachingAttendance | null>(null);
  const [unlockReason, setUnlockReason] = useState<string>("");

  const todayStr = getTodayDateStr();
  const todayDayName = getIndonesianDayName(todayStr);

  // Live Clock Interval
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setRealtimeClock(now.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial Load Context & Reference Data
  useEffect(() => {
    if (!isAuthorized) return;
    loadMasterData();
  }, [isAuthorized]);

  // Load Simulation Data Whenever Teacher / Time / Context Changes
  useEffect(() => {
    if (!isAuthorized) return;
    fetchSimulationData();
  }, [isAuthorized, activeAyId, activeSemId]);

  const loadMasterData = async () => {
    try {
      setLoading(true);
      const [ays, sems, classList, userList] = await Promise.all([
        academicYearService.getAcademicYears(),
        semesterService.getSemesters(),
        classService.getClasses(),
        userService.getUsers()
      ]);

      const activeAy = ays.find(a => a.isActive);
      const activeSem = sems.find(s => s.isActive);

      if (activeAy) setActiveAyId(activeAy.id);
      if (activeSem) setActiveSemId(activeSem.id);

      setClasses(classList);

      // Filter teachers/GTK
      const teacherUsers = userList.filter(u => {
        const r = (u.role || u.roles?.[0] || "").toLowerCase();
        return r.includes("guru") || r.includes("wakil") || r.includes("kepala") || r.includes("musrif");
      });
      setTeachers(teacherUsers);

      if (teacherUsers.length > 0 && user) {
        const foundSelf = teacherUsers.find(t => t.id === user.id || t.userId === user.id);
        setSelectedTeacherId(foundSelf ? foundSelf.id : teacherUsers[0].id);
      }
      if (classList.length > 0) {
        setSelectedClassId(classList[0].id);
      }
    } catch (err) {
      console.error("Error loading master simulation data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSimulationData = async () => {
    try {
      const [{ items }, logs] = await Promise.all([
        teacherTeachingAttendanceService.getAttendanceForDate(todayStr, activeAyId, activeSemId, true),
        teacherTeachingAttendanceService.getSimulationAuditLogs()
      ]);
      setTodaySimulationItems(items);
      setAuditLogs(logs);
    } catch (err) {
      console.error("Error fetching simulation data:", err);
    }
  };

  // Resolve Effective Teacher for Test
  const getTestUserObj = () => {
    const selected = teachers.find(t => t.id === selectedTeacherId || t.userId === selectedTeacherId);
    if (selected) {
      return {
        id: selected.id || selected.userId || "",
        uid: selected.userId || selected.id || "",
        userId: selected.id || selected.userId || "",
        name: selected.name,
        teacherId: selected.id || selected.userId || "",
        role: selected.role || selected.roles?.[0] || "Guru"
      };
    }
    return {
      id: user?.id || "",
      uid: user?.id || "",
      userId: user?.id || "",
      name: user?.name || "Guru Tester",
      role: user?.role || "Guru"
    };
  };

  // Execute QR Scan in Simulation Mode
  const handleProcessSimulationQr = async (scannedString: string) => {
    if (!scannedString || !scannedString.trim()) return;

    setProcessing(true);
    setScanResult(null);

    const effectiveTime = useCustomTime ? customTime : undefined;
    const testUser = getTestUserObj();

    try {
      const res = await teacherTeachingAttendanceService.processQrCheckIn({
        scannedContent: scannedString.trim(),
        currentUser: testUser,
        academicYearId: activeAyId,
        semesterId: activeSemId,
        customTimeStr: effectiveTime,
        isSimulation: true // EXPLICIT SIMULATION FLAG
      });

      if (res.success) {
        setScanResult({
          type: "success",
          action: res.action,
          message: res.message,
          record: res.record
        });
      } else {
        setScanResult({
          type: "error",
          message: res.message
        });
      }

      // Refresh Simulation Records & Audit Logs
      await fetchSimulationData();
    } catch (err: any) {
      setScanResult({
        type: "error",
        message: err?.message || "Terjadi kesalahan sistem saat memproses simulasi QR."
      });
    } finally {
      setProcessing(false);
    }
  };

  // Camera QR Scanner Toggle
  const startCameraScanner = async () => {
    setIsScanning(true);
    setScanResult(null);
    try {
      setTimeout(async () => {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            stopCameraScanner();
            handleProcessSimulationQr(decodedText);
          },
          () => {}
        );
      }, 300);
    } catch (err) {
      console.error("Failed starting camera:", err);
      setIsScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignored
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  // Reset Simulation Data
  const handleResetSimulation = async () => {
    if (!window.confirm("Apakah Anda yakin ingin MENGHAPUS SELURUH DATA SIMULASI?\n\nData produksi tidak akan tersentuh.")) return;

    try {
      setLoading(true);
      await teacherTeachingAttendanceService.resetSimulationData();
      setScanResult({
        type: "info",
        message: "Data simulasi berhasil di-reset sepenuhnya. Data produksi aman."
      });
      await fetchSimulationData();
    } catch (err: any) {
      alert("Gagal memproses reset simulasi: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Wakakur Unlock Simulation Session
  const handleUnlockSimulationSession = async () => {
    if (!unlockModalItem) return;
    if (!unlockReason.trim()) {
      alert("Silakan masukkan alasan pembukaan kunci.");
      return;
    }

    try {
      setProcessing(true);
      await teacherTeachingAttendanceService.unlockLateCheckIn({
        scheduleId: unlockModalItem.scheduleId,
        dateStr: todayStr,
        reason: unlockReason,
        validatorUserId: user?.id || "admin",
        validatorUserName: user?.name || "Wakakur (Admin)",
        isSimulation: true
      });

      setUnlockModalItem(null);
      setUnlockReason("");
      setScanResult({
        type: "success",
        message: `Sesi ${unlockModalItem.className} (${unlockModalItem.jp}) berhasil dibuka oleh Wakakur dalam Mode Simulasi! Guru kini dapat melakukan Check-in.`
      });
      await fetchSimulationData();
    } catch (err: any) {
      alert("Gagal membuka kunci sesi: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 dark:bg-rose-950/30 border-2 border-rose-200 dark:border-rose-900 rounded-2xl p-8 text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-rose-600 dark:text-rose-400 mx-auto" />
          <h2 className="text-2xl font-black text-rose-900 dark:text-rose-200">Akses Terbatas — Mode Simulasi (Sandbox)</h2>
          <p className="text-sm text-rose-700 dark:text-rose-300 max-w-lg mx-auto">
            Halaman QR Simulation Mode hanya dapat diakses oleh <strong>Admin</strong> dan <strong>Wakil Kepala Sekolah (Wakakur)</strong> untuk keperluan pengujian algoritma absensi.
          </p>
          <div className="pt-2">
            <Link to="/teaching-qr-checkin" className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white font-bold rounded-xl text-sm hover:bg-rose-700 transition-colors">
              Kembali ke QR Check-in Produksi
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate Metrics for Simulation Today
  const totalSimItems = todaySimulationItems.length;
  const hadirCount = todaySimulationItems.filter(i => i.status === "Hadir Mengajar").length;
  const terlambatCount = todaySimulationItems.filter(i => i.status === "Terlambat").length;
  const belumTerkonfirmasiCount = todaySimulationItems.filter(i => i.status === "Belum Terkonfirmasi").length;
  const checkedInItems = todaySimulationItems.filter(i => i.checkInTime && !i.checkOutTime);

  return (
    <div className="space-y-6 pb-12">
      {/* HUGE SIMULATION MODE SANDBOX BANNER */}
      <div className="bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-700 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none transform translate-x-8 -translate-y-8">
          <FlaskConical className="w-72 h-72" />
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1.5 bg-amber-400 text-amber-950 font-black text-xs uppercase tracking-wider rounded-full shadow-md flex items-center gap-1.5 animate-pulse">
                <FlaskConical className="w-4 h-4" /> SIMULATION MODE (SANDBOX)
              </span>
              <span className="text-amber-100 text-xs font-semibold">
                Sistem Pengujian QR Absensi Guru
              </span>
            </div>

            <button
              onClick={handleResetSimulation}
              disabled={loading}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition-all border border-white/30 flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4 text-amber-200" />
              <span>Reset Data Simulasi</span>
            </button>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Sandbox Mode: QR Check-in / Check-out Guru
            </h1>
            <p className="text-sm text-amber-100/90 mt-1 max-w-3xl leading-relaxed">
              Mode ini menjalankan <strong>seluruh algoritma validasi produksi secara 100% identik</strong> (jadwal, toleransi keterlambatan 15 mnt, penguncian &gt;25 mnt, mapel terjeda istirahat, dan rentang Multi-JP). Data hasil tes disimpan khusus di koleksi <code>teacher_teaching_attendances_simulation</code> tanpa mempengaruhi data absensi produksi.
            </p>
          </div>
        </div>
      </div>

      {/* CONTROLLER SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PANEL 1: CLOCK & TEST TEACHER SELECTOR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-sm border-b border-slate-100 dark:border-slate-800 pb-3">
            <Clock className="w-4 h-4" />
            <span>1. Pengaturan Waktu & Guru Simulasi</span>
          </div>

          {/* Clock Override Controller */}
          <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Waktu Transaksi Scan
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Override Jam</span>
                <input
                  type="checkbox"
                  checked={useCustomTime}
                  onChange={(e) => setUseCustomTime(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>
            </div>

            {useCustomTime ? (
              <div className="space-y-1.5">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-lg font-black text-amber-700 dark:text-amber-300 text-center shadow-inner"
                />
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium text-center">
                  ⚡ Mode Override Aktif: Anda dapat mensimulasikan scan jam berapa saja!
                </p>
              </div>
            ) : (
              <div className="text-center py-1">
                <div className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-wider">
                  {realtimeClock || "00:00:00"} <span className="text-xs font-normal text-slate-500">WIB</span>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {todayDayName}, {todayStr}
                </div>
              </div>
            )}
          </div>

          {/* Test Teacher Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Akun Guru untuk Simulasi</span>
              <span className="text-[10px] text-slate-400">Total {teachers.length} Guru</span>
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role || t.roles?.[0] || "Guru"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* PANEL 2: QR SCANNER & CLASS SIMULATION */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">
              <QrCode className="w-4 h-4" />
              <span>2. Simulator Scan QR Kelas</span>
            </div>
            <span className="text-xs font-bold text-slate-500">
              Hari Ini: {todayDayName}
            </span>
          </div>

          {isScanning ? (
            <div className="space-y-3 text-center">
              <div id={scannerContainerId} className="w-full max-w-sm mx-auto overflow-hidden rounded-2xl border-2 border-indigo-500 shadow-lg"></div>
              <button
                onClick={stopCameraScanner}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Tutup Kamera QR
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Quick Class Picker & Single-Click Simulator */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <School className="w-4 h-4 text-indigo-600" />
                  <span>A. Pilih Kelas Master untuk Simulasi</span>
                </div>

                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code || c.roomCode || "Kelas"})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    const cls = classes.find(c => c.id === selectedClassId);
                    if (cls) {
                      const payload = JSON.stringify({ type: "SCHOOL_CLASS_QR", classId: cls.id, className: cls.name });
                      handleProcessSimulationQr(payload);
                    }
                  }}
                  disabled={processing || !selectedClassId}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-amber-600 text-white text-xs font-extrabold rounded-xl shadow-md hover:from-indigo-700 hover:to-amber-700 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  <span>Simulasi Scan QR Kelas Ini</span>
                </button>
              </div>

              {/* Option B: Live Camera Scanner OR Raw String Payload */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-amber-600" />
                  <span>B. Scan Kamera Asli ATAU Paste QR Payload</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualQrCode}
                    onChange={(e) => setManualQrCode(e.target.value)}
                    placeholder="Contoh: VII A atau CLASS_QR:VII A"
                    className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <button
                    onClick={() => handleProcessSimulationQr(manualQrCode)}
                    disabled={processing || !manualQrCode.trim()}
                    className="px-3 py-2 bg-amber-600 text-white font-bold text-xs rounded-xl hover:bg-amber-700 transition-colors cursor-pointer"
                  >
                    Proses
                  </button>
                </div>

                <button
                  onClick={startCameraScanner}
                  disabled={processing}
                  className="w-full py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-extrabold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Buka Kamera Scan QR Fisik</span>
                </button>
              </div>
            </div>
          )}

          {/* FEEDBACK DISPLAY BOX */}
          {scanResult && (
            <div
              className={`p-4 rounded-2xl border text-xs leading-relaxed transition-all shadow-sm ${
                scanResult.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : scanResult.type === "error"
                  ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                  : "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {scanResult.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : scanResult.type === "error" ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1">
                  <div className="font-extrabold text-sm">
                    {scanResult.type === "success"
                      ? `Hasil Simulasi (${scanResult.action || "SUKSES"})`
                      : scanResult.type === "error"
                      ? "Hasil Simulasi Ditolak (Sesuai Algoritma Validation Rules)"
                      : "Informasi Simulasi"}
                  </div>
                  <p className="whitespace-pre-line">{scanResult.message}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DASHBOARD RESULT TABLE (INSPECTOR) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-600" />
              <span>Simulation Result Dashboard — Status JP Real-Time</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tabel rekap absensi simulasi untuk verifikasi status per-JP (Hadir, Belum Terkonfirmasi, Terlambat, Dikunci).
            </p>
          </div>

          <button
            onClick={fetchSimulationData}
            className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan Dashboard</span>
          </button>
        </div>

        {/* METRICS CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="text-[11px] font-bold text-slate-500 uppercase">Total Sesi Simulasi</div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalSimItems}</div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">Hadir / Tepat Waktu</div>
            <div className="text-2xl font-black text-emerald-800 dark:text-emerald-300 mt-1">{hadirCount}</div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200/60 dark:border-amber-900/40">
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase">Terlambat (16-25m)</div>
            <div className="text-2xl font-black text-amber-800 dark:text-amber-300 mt-1">{terlambatCount}</div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-4 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40">
            <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase">Belum Terkonfirmasi (JP2+)</div>
            <div className="text-2xl font-black text-indigo-800 dark:text-indigo-300 mt-1">{belumTerkonfirmasiCount}</div>
          </div>
        </div>

        {/* SIMULATION DATA TABLE */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 font-bold">
            Memuat data simulasi...
          </div>
        ) : todaySimulationItems.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <FlaskConical className="w-12 h-12 text-amber-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Belum Ada Transaksi Simulasi Hari Ini</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Gunakan simulator di atas untuk melakukan tes Check-in atau Check-out. Hasil perubahan status JP akan muncul secara otomatis di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Guru / GTK</th>
                  <th className="p-3.5">Kelas & Mapel</th>
                  <th className="p-3.5">JP & Jam</th>
                  <th className="p-3.5">Check-In</th>
                  <th className="p-3.5">Check-Out</th>
                  <th className="p-3.5">Durasi Mengajar</th>
                  <th className="p-3.5 text-center">Status JP Simulasi</th>
                  <th className="p-3.5 text-center">Aksi / Test Wakakur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {todaySimulationItems.map((item, idx) => {
                  const status = item.status || "Belum Absen";

                  let badgeClass = "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
                  if (status === "Hadir Mengajar") badgeClass = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300";
                  else if (status === "Terlambat") badgeClass = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300";
                  else if (status === "Belum Terkonfirmasi") badgeClass = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300";
                  else if (status === "DIKUNCI") badgeClass = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300";

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 dark:text-slate-100">
                        {item.teacherName}
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{item.className}</span>
                        <div className="text-[11px] text-slate-500">{item.subjectName}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{item.jp || `JP ${item.sequence}`}</span>
                        <div className="text-[11px] text-slate-500">{item.timeSlot || "-"}</div>
                      </td>
                      <td className="p-3.5">
                        {item.checkInTime ? (
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold rounded">
                            {item.checkInTime} WIB
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {item.checkOutTime ? (
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold rounded">
                            {item.checkOutTime} WIB
                          </span>
                        ) : item.checkInTime ? (
                          <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold rounded">
                            Belum dilakukan
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {item.teachingDurationMinutes && item.checkOutTime ? (
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                            {item.teachingDurationMinutes} Menit
                          </span>
                        ) : item.checkInTime ? (
                          <span className="text-amber-600 font-bold text-[11px]">
                            Sedang Mengajar
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-full ${badgeClass}`}>
                          {item.checkInTime && !item.checkOutTime ? "SEDANG MENGAJAR" : item.checkInTime && item.checkOutTime ? "SESI SELESAI" : status}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        {(status === "DIKUNCI" || (item as any).isLateUnlocked) ? (
                          <button
                            onClick={() => setUnlockModalItem(item)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Key className="w-3 h-3" />
                            <span>Buka Kunci</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* AUDIT LOG TIMELINE */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-4">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-amber-600" />
            <span>Simulation Audit Trail (Jejak Log Validasi Simulasi)</span>
          </h3>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Belum ada audit log simulasi terdaftar.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {auditLogs.map((log, idx) => (
                <div key={log.id || idx} className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/80 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-amber-600 dark:text-amber-400">[{log.action}] {log.teacherName} — {log.className} ({log.jp})</span>
                    <span className="text-[11px] text-slate-400">{log.scanTime || log.inputTimestamp}</span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    <strong>Status:</strong> {log.previousStatus} &rarr; <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.newStatus}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Reason: {log.reason}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* WAKAKUR UNLOCK MODAL (SIMULATION) */}
      {unlockModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 font-black text-lg border-b border-slate-100 dark:border-slate-800 pb-3">
              <Unlock className="w-6 h-6" />
              <span>Buka Kunci Sesi Simulasi (Wakakur)</span>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Sesi mengajar kelas <strong>{unlockModalItem.className}</strong> ({unlockModalItem.jp} - {unlockModalItem.subjectName}) statusnya terkunci karena keterlambatan.
              </p>
              <p>
                Sebagai Wakakur, Anda dapat mensimulasikan pembukaan kunci agar guru dapat melakukan Check-in.
              </p>

              <div className="pt-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-200">
                  Alasan / Catatan Buka Kunci (Simulasi):
                </label>
                <textarea
                  rows={3}
                  value={unlockReason}
                  onChange={(e) => setUnlockReason(e.target.value)}
                  placeholder="Contoh: Tugas mendadak / Izin dinas luar"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setUnlockModalItem(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleUnlockSimulationSession}
                disabled={processing}
                className="px-4 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Unlock className="w-4 h-4" />
                <span>Buka Kunci Simulasi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeachingQrSimulationPage;
