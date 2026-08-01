import React, { useState } from "react";
import { 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  QrCode, 
  Calendar, 
  Bell, 
  History, 
  Info, 
  Lock, 
  CheckCircle2, 
  Check, 
  Sliders, 
  RotateCcw,
  Sparkles,
  Zap,
  HelpCircle,
  ChevronDown,
  UserCheck
} from "lucide-react";
import { SchoolSettings, TeachingAttendanceSettings } from "../types";
import { DEFAULT_TEACHING_ATTENDANCE_SETTINGS, SettingsHistoryItem } from "../services/schoolSettings.service";

interface TeachingAttendanceSettingsPanelProps {
  localSettings: SchoolSettings;
  setLocalSettings: React.Dispatch<React.SetStateAction<SchoolSettings | null>>;
  canEdit: boolean;
  userRoleDisplay: string;
  historyItems?: SettingsHistoryItem[];
  onSave?: () => void;
}

export const TeachingAttendanceSettingsPanel: React.FC<TeachingAttendanceSettingsPanelProps> = ({
  localSettings,
  setLocalSettings,
  canEdit,
  userRoleDisplay,
  historyItems = []
}) => {
  const tas: TeachingAttendanceSettings = {
    ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS,
    ...(localSettings.teachingAttendanceSettings || {}),
    pendingValidationConditions: {
      ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS.pendingValidationConditions,
      ...(localSettings.teachingAttendanceSettings?.pendingValidationConditions || {})
    },
    qrRules: {
      ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS.qrRules,
      ...(localSettings.teachingAttendanceSettings?.qrRules || {})
    },
    notifications: {
      ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS.notifications,
      ...(localSettings.teachingAttendanceSettings?.notifications || {})
    }
  };

  const [activeSubSection, setActiveSubSection] = useState<
    "toleransi" | "approval" | "validasi" | "scan_berulang" | "jadwal_istirahat" | "qr_code" | "durasi" | "notifikasi" | "audit"
  >("toleransi");

  // Helper to update teachingAttendanceSettings in localSettings
  const updateTas = (updater: (prev: TeachingAttendanceSettings) => TeachingAttendanceSettings) => {
    if (!canEdit) return;
    setLocalSettings(prev => {
      if (!prev) return prev;
      const currentTas: TeachingAttendanceSettings = {
        ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS,
        ...(prev.teachingAttendanceSettings || {}),
        pendingValidationConditions: {
          ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS.pendingValidationConditions,
          ...(prev.teachingAttendanceSettings?.pendingValidationConditions || {})
        },
        qrRules: {
          ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS.qrRules,
          ...(prev.teachingAttendanceSettings?.qrRules || {})
        },
        notifications: {
          ...DEFAULT_TEACHING_ATTENDANCE_SETTINGS.notifications,
          ...(prev.teachingAttendanceSettings?.notifications || {})
        }
      };

      const updatedTas = updater(currentTas);
      return {
        ...prev,
        teachingAttendanceSettings: updatedTas
      };
    });
  };

  const TOLERANCE_OPTIONS = [5, 10, 15, 20, 30];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-700/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
          <UserCheck className="h-36 w-36 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Modul Pengaturan Kebijakan SIMAK</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">Pengaturan Kebijakan Absensi Mengajar</h2>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-2xl leading-relaxed">
              Atur toleransi check-in/out, metode approval, syarat pending validation, aturan scan berulang, serta QR Code secara dinamis. Perubahan langsung berlaku secara realtime bagi seluruh guru.
            </p>
          </div>

          {!canEdit && (
            <div className="shrink-0 flex items-center gap-2 bg-amber-500/20 backdrop-blur-xs border border-amber-300/30 text-amber-200 px-3 py-2 rounded-xl text-xs font-medium">
              <Lock className="h-4 w-4 text-amber-300 shrink-0" />
              <span>Mode Lihat Saja ({userRoleDisplay})</span>
            </div>
          )}
        </div>
      </div>

      {/* Sub-section Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-200/60 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700/50">
        {[
          { id: "toleransi", label: "Toleransi Waktu", icon: Clock },
          { id: "approval", label: "Metode Approval", icon: ShieldCheck },
          { id: "validasi", label: "Kondisi Validasi", icon: AlertTriangle },
          { id: "scan_berulang", label: "Scan Berulang", icon: Zap },
          { id: "jadwal_istirahat", label: "Waktu Istirahat", icon: Calendar },
          { id: "qr_code", label: "QR Code", icon: QrCode },
          { id: "durasi", label: "Durasi Mengajar", icon: Sliders },
          { id: "notifikasi", label: "Notifikasi", icon: Bell },
          { id: "audit", label: "Audit Trail", icon: History }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubSection(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200/80 dark:border-zinc-700"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100/80 dark:hover:bg-zinc-800/80"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: TOLERANSI WAKTU */}
      {activeSubSection === "toleransi" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">1. Konfigurasi Toleransi Waktu Check-In & Check-Out</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Batas waktu keterlambatan dan kelonggaran scan bagi guru sebelum & setelah jam jadwal pelajaran.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Check-In Tolerance */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-emerald-500" />
                  Toleransi Check-In
                </label>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-900/40">
                  {tas.checkInToleranceMinutes} Menit
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Waktu maksimal sebelum/setelah jam mulai jadwal yang masih dianggap sah/tepat waktu.
              </p>
              <select
                disabled={!canEdit}
                value={tas.checkInToleranceMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateTas(prev => ({ ...prev, checkInToleranceMinutes: val }));
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {TOLERANCE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt} Menit {opt === 15 ? "(Default Sekolah)" : ""}</option>
                ))}
              </select>
            </div>

            {/* Check-Out Tolerance */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200/80 dark:border-zinc-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-rose-500" />
                  Toleransi Check-Out
                </label>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-900/40">
                  {tas.checkOutToleranceMinutes} Menit
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Batas waktu kelonggaran saat jam pelajaran selesai untuk menyelesaikan check-out mengajar.
              </p>
              <select
                disabled={!canEdit}
                value={tas.checkOutToleranceMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  updateTas(prev => ({ ...prev, checkOutToleranceMinutes: val }));
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {TOLERANCE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt} Menit {opt === 15 ? "(Default Sekolah)" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p>
              <strong>Contoh Penerapan:</strong> Jika jam mengajar dimulai 07:30 dengan toleransi 10 menit, guru dapat melakukan check-in antara 07:20 s.d. 07:40 tanpa masuk status terlambat atau memerlukan persetujuan manual.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: METODE APPROVAL */}
      {activeSubSection === "approval" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">2. Metode Persetujuan (Approval Method)</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Pilih alur kerja verifikasi absensi mengajar guru oleh sistem SIMAK.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: "automatic",
                title: "Automatic Approval",
                badge: "Otomatis Total",
                desc: "Seluruh absensi mengajar yang memenuhi aturan dasar akan langsung disetujui otomatis oleh sistem tanpa perlu intervensi Waka Kurikulum.",
                color: "emerald"
              },
              {
                id: "manual",
                title: "Manual Approval",
                badge: "Validasi Waka",
                desc: "Seluruh absensi mengajar wajib diverifikasi dan disetujui secara manual satu per satu oleh Waka Kurikulum sebelum berstatus valid.",
                color: "amber"
              },
              {
                id: "hybrid",
                title: "Hybrid Approval",
                badge: "Rekomendasi / Default",
                desc: "Absensi normal yang sesuai jadwal disetujui otomatis. Hanya kasus khusus (terlambat, luar jam, input manual, dll) yang masuk ke Pending Validation.",
                color: "indigo"
              }
            ].map(method => {
              const isSelected = tas.approvalMethod === method.id;
              return (
                <div
                  key={method.id}
                  onClick={() => canEdit && updateTas(prev => ({ ...prev, approvalMethod: method.id as any }))}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs"
                      : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                  } ${!canEdit ? "opacity-80 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isSelected
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}>
                      {method.badge}
                    </span>
                    <input
                      type="radio"
                      name="approvalMethod"
                      checked={isSelected}
                      disabled={!canEdit}
                      onChange={() => updateTas(prev => ({ ...prev, approvalMethod: method.id as any }))}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-zinc-700"
                    />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-1.5">{method.title}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                    {method.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: KONDISI PENDING VALIDATION */}
      {activeSubSection === "validasi" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">3. Kondisi Pemicu Pending Validation</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Centang kondisi khusus yang mewajibkan peninjauan & verifikasi manual oleh Waka Kurikulum.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "checkInTerlambat", label: "Check-in Terlambat", desc: "Guru melakukan scan setelah melewati waktu toleransi jam mulai" },
              { key: "checkOutTerlambat", label: "Check-out Terlambat", desc: "Guru melakukan check-out jauh melewati batas toleransi jam selesai" },
              { key: "checkInTerlaluAwal", label: "Check-in Terlalu Awal", desc: "Scan dilakukan sebelum jendela toleransi awal dibuka" },
              { key: "checkOutTerlaluAwal", label: "Check-out Terlalu Awal / Terburu-buru", desc: "Scan dilakukan jauh sebelum jam pelajaran selesai" },
              { key: "durasiTidakSesuai", label: "Durasi Mengajar Tidak Sesuai", desc: "Durasi tatap muka kurang dari batas persentase minimal yang ditetapkan" },
              { key: "inputManual", label: "Input Manual oleh Admin/Guru", desc: "Absensi diinput tanpa melalui Scan QR Code kelas" },
              { key: "lupaCheckOut", label: "Guru Lupa Check-out / Diselesaikan Sistem", desc: "Sesi mengajar belum ditutup atau ditutup secara manual oleh Waka" },
              { key: "jadwalTidakSesuai", label: "Jadwal Tidak Sesuai", desc: "Scan dilakukan di luar jam atau mata pelajaran yang terdaftar" },
              { key: "scanDILuarToleransi", label: "Scan di Luar Toleransi Jam", desc: "Scan dilakukan pada jam yang tidak memiliki porsi jadwal aktif" },
              { key: "scanBerulang", label: "Scan Berulang dalam 1 Sesi", desc: "Multiple scan terdeteksi pada 1 sesi jam mengajar" }
            ].map(item => {
              const key = item.key as keyof typeof tas.pendingValidationConditions;
              const isChecked = tas.pendingValidationConditions[key] ?? true;
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    isChecked
                      ? "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700"
                      : "bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800 opacity-60"
                  } ${canEdit ? "cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700" : "cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateTas(prev => ({
                        ...prev,
                        pendingValidationConditions: {
                          ...prev.pendingValidationConditions,
                          [key]: checked
                        }
                      }));
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">{item.label}</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug block mt-0.5">{item.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SCAN BERULANG */}
      {activeSubSection === "scan_berulang" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">4. Pengaturan Kebijakan Scan Berulang</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Tentukan kebijakan ketika guru melakukan scan QR berulang kali pada sesi jam mengajar yang sama.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              {
                id: "never_allowed",
                title: "Tidak pernah diizinkan",
                desc: "Hanya 1x Check-in dan 1x Check-out per sesi. Scan ulang berikutnya akan ditolak oleh sistem."
              },
              {
                id: "allowed_across_break",
                title: "Diizinkan apabila jadwal melewati waktu istirahat (Default)",
                desc: "Diizinkan melakukan Check-out & Check-In ulang khusus jika jadwal pelajaran terpotong waktu istirahat (2 segmen)."
              },
              {
                id: "always_allowed",
                title: "Selalu diizinkan",
                desc: "Guru bebas melakukan scan berulang untuk memperbarui waktu masuk/keluar pada sesi yang sama."
              }
            ].map(opt => {
              const isSelected = tas.repeatScanRule === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-900 dark:text-indigo-200"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                  } ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-80"}`}
                >
                  <input
                    type="radio"
                    name="repeatScanRule"
                    checked={isSelected}
                    disabled={!canEdit}
                    onChange={() => updateTas(prev => ({ ...prev, repeatScanRule: opt.id as any }))}
                    className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-zinc-700"
                  />
                  <div>
                    <span className="text-xs font-bold block text-slate-900 dark:text-white">{opt.title}</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 block leading-relaxed">{opt.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: JADWAL & WAKTU ISTIRAHAT */}
      {activeSubSection === "jadwal_istirahat" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">5. Integration dengan Jadwal Istirahat Sekolah</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Integrasi otomatis logika absensi dengan konfigurasi jam istirahat sekolah dari School Settings.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={tas.useBreakTimesFromSettings}
              disabled={!canEdit}
              onChange={(e) => {
                const checked = e.target.checked;
                updateTas(prev => ({ ...prev, useBreakTimesFromSettings: checked }));
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white block">
                Gunakan jadwal istirahat dari School Settings
              </span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                Seluruh logika Check-in dan Check-out akan membaca jumlah, jam mulai, dan jam selesai istirahat secara dinamis tanpa hardcode.
              </span>
            </div>
          </label>

          {/* Current Break Times Display */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-500" />
              Daftar Waktu Istirahat Aktif saat ini ({localSettings.breakTimes?.length || 0} Istirahat):
            </h4>

            {(!localSettings.breakTimes || localSettings.breakTimes.length === 0) ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-xl text-xs">
                Belum ada waktu istirahat yang dikonfigurasi di tab <strong>5. Waktu Istirahat</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {localSettings.breakTimes.map((bt, idx) => (
                  <div key={bt.id || idx} className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-indigo-950 dark:text-indigo-200">{bt.name}</p>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-400 mt-0.5">
                        {bt.start} - {bt.end} ({bt.duration} Menit)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-200/80 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-md">
                      Segmen Istirahat
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: QR CODE RULES */}
      {activeSubSection === "qr_code" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">6. Pengaturan Validasi QR Code Mengajar</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Konfigurasi syarat keamanan validitas QR Code saat di-scan oleh guru di kelas.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                key: "activeScheduleOnly",
                label: "QR hanya berlaku pada jadwal aktif",
                desc: "Scan QR hanya sah jika dilakukan dalam rentang waktu jam pelajaran berlangsung (+toleransi)"
              },
              {
                key: "matchingClassOnly",
                label: "QR hanya berlaku pada kelas yang sesuai",
                desc: "Mencegah guru melakukan scan QR kelas lain yang bukan lokasi jadwal mengajar fisiknya"
              },
              {
                key: "matchingDayOnly",
                label: "QR hanya berlaku pada hari yang sesuai",
                desc: "Mencegah scan QR pada hari di luar jadwal pelajaran yang terdaftar"
              },
              {
                key: "activeSemesterOnly",
                label: "QR hanya berlaku pada semester aktif",
                desc: "QR Code otomatis kedaluwarsa apabila tahun ajaran atau semester sekolah telah berganti"
              }
            ].map(rule => {
              const key = rule.key as keyof typeof tas.qrRules;
              const isChecked = tas.qrRules[key] ?? true;
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    isChecked
                      ? "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700"
                      : "bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800 opacity-60"
                  } ${canEdit ? "cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700" : "cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateTas(prev => ({
                        ...prev,
                        qrRules: {
                          ...prev.qrRules,
                          [key]: checked
                        }
                      }));
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{rule.label}</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5 leading-snug">{rule.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 7: DURASI MENGAJAR */}
      {activeSubSection === "durasi" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">7. Pengaturan Batas Minimal Durasi Mengajar</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Menentukan ambang batas minimum kehadiran fisik guru dalam kelas selama jam pelajaran.
              </p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700/60 max-w-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Minimal Durasi Mengajar (% dari total durasi jadwal)
              </label>
              <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/40">
                {tas.minTeachingDurationPercent}%
              </span>
            </div>

            <input
              type="range"
              min={50}
              max={100}
              step={5}
              disabled={!canEdit}
              value={tas.minTeachingDurationPercent}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateTas(prev => ({ ...prev, minTeachingDurationPercent: val }));
              }}
              className="w-full h-2 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
              <span>50% (Longgar)</span>
              <span>80% (Default Sekolah)</span>
              <span>100% (Ketat)</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 rounded-xl text-xs text-indigo-900 dark:text-indigo-300">
            <strong>Dampak Aturan:</strong> Apabila durasi mengajar riil guru kurang dari <strong>{tas.minTeachingDurationPercent}%</strong> dari estimasi durasi jadwal (misal: kurang dari {Math.round(40 * (tas.minTeachingDurationPercent/100))} menit untuk 1 JP 40 menit), status absensi otomatis dialihkan ke <strong>Pending Validation</strong>.
          </div>
        </div>
      )}

      {/* TAB 8: NOTIFIKASI */}
      {activeSubSection === "notifikasi" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">8. Pengaturan Notifikasi Absensi</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Aktifkan atau nonaktifkan jenis pesan umpan balik & notifikasi sistem kepada guru dan pimpinan.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: "checkInSuccess", label: "Notifikasi Check-in Berhasil", desc: "Konfirmasi popup & toast saat scan check-in berhasil" },
              { key: "checkOutSuccess", label: "Notifikasi Check-out Berhasil", desc: "Rincian durasi mengajar saat scan check-out berhasil" },
              { key: "pendingValidation", label: "Notifikasi Pending Validation", desc: "Pemberitahuan ketika status absensi membutuhkan validasi Waka" },
              { key: "approval", label: "Notifikasi Approval Persetujuan", desc: "Notifikasi kepada guru ketika absensi disetujui Waka" },
              { key: "rejection", label: "Notifikasi Rejection / Penolakan", desc: "Pemberitahuan beserta alasan jika absensi ditolak Waka" }
            ].map(notif => {
              const key = notif.key as keyof typeof tas.notifications;
              const isChecked = tas.notifications[key] ?? true;
              return (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    isChecked
                      ? "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700"
                      : "bg-white dark:bg-zinc-900 border-slate-200/60 dark:border-zinc-800 opacity-60"
                  } ${canEdit ? "cursor-pointer hover:border-slate-300 dark:hover:border-zinc-700" : "cursor-not-allowed"}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      updateTas(prev => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          [key]: checked
                        }
                      }));
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">{notif.label}</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 block mt-0.5 leading-snug">{notif.desc}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 9: AUDIT TRAIL */}
      {activeSubSection === "audit" && (
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 space-y-5 shadow-xs">
          <div className="flex items-start gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">9. Audit Trail & Log Perubahan Kebijakan Absensi</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Catatan riwayat lengkap perubah konfigurasi: Operator UID, Nama, Tanggal, Jam, dan Ringkasan Nilai.
              </p>
            </div>
          </div>

          {historyItems.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 text-xs text-slate-500">
              Belum ada catatan riwayat perubahan konfigurasi yang terekam.
            </div>
          ) : (
            <div className="space-y-3">
              {historyItems.map((item) => {
                const dateObj = new Date(item.savedAt);
                const dateStr = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
                const timeStr = dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

                const tasHist = item.settings?.teachingAttendanceSettings || DEFAULT_TEACHING_ATTENDANCE_SETTINGS;

                return (
                  <div key={item.id} className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-zinc-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">{item.operatorName}</span>
                        <span className="px-2 py-0.5 text-[10px] bg-slate-200 dark:bg-zinc-700 font-mono rounded text-slate-700 dark:text-zinc-300">
                          UID: {item.operatorId}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                        {dateStr} - Pukul {timeStr} WIB
                      </span>
                    </div>

                    <p className="text-slate-700 dark:text-zinc-300 font-medium">{item.description}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-600 dark:text-zinc-400">
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200/80 dark:border-zinc-800">
                        <span className="text-[10px] text-slate-400 block">Toleransi In/Out</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{tasHist.checkInToleranceMinutes}m / {tasHist.checkOutToleranceMinutes}m</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200/80 dark:border-zinc-800">
                        <span className="text-[10px] text-slate-400 block">Metode Approval</span>
                        <span className="font-bold capitalize text-indigo-600 dark:text-indigo-400">{tasHist.approvalMethod}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200/80 dark:border-zinc-800">
                        <span className="text-[10px] text-slate-400 block">Scan Berulang</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{tasHist.repeatScanRule}</span>
                      </div>
                      <div className="bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200/80 dark:border-zinc-800">
                        <span className="text-[10px] text-slate-400 block">Min. Durasi</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{tasHist.minTeachingDurationPercent}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default TeachingAttendanceSettingsPanel;
