import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { userService } from "../services/user.service";
import { 
  User as UserIcon, 
  Mail, 
  Shield, 
  Activity, 
  History, 
  Computer, 
  Globe, 
  KeyRound, 
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { motion } from "motion/react";

export default function Profile() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Query for current user's login history
  const { data: loginHistory = [], isLoading, refetch } = useQuery({
    queryKey: ["myLoginHistory", user?.uid],
    queryFn: () => user ? userService.getMyLoginHistory(user.uid) : Promise.resolve([]),
    enabled: !!user
  });

  if (!user) return null;

  const handleCopyIp = (ip: string, id: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
    toast("IP berhasil disalin ke papan klip", "success");
  };

  const handleVoluntaryPasswordChange = () => {
    navigate("/change-password", { state: { voluntary: true } });
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return "-";
    try {
      return new Date(isoString).toLocaleString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  const capitalizeRole = (roleName: string | undefined | null) => {
    if (!roleName) return "";
    return roleName.split(" ").map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : "").join(" ");
  };

  const statusBadgeColor = (status?: string) => {
    switch (status) {
      case "Aktif":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50";
      case "Nonaktif":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50";
      case "Menunggu Aktivasi":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
    }
  };

  // Get first letter of displayName or name
  const initial = (user.displayName || user.name || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <UserIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            PROFIL PENGGUNA
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 uppercase tracking-wider font-semibold">
            Informasi Pribadi & Riwayat Aktivitas Keamanan Sesi
          </p>
        </div>
        
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 self-start sm:self-center px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Kembali
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Info Card Column */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Identity Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-3xl shadow-xs overflow-hidden"
          >
            {/* Ambient Background Gradient Header */}
            <div className="h-28 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-900 flex items-end px-6 pb-4 relative">
              <div className="absolute top-4 right-4">
                <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${statusBadgeColor(user.status)}`}>
                  {user.status || "Aktif"}
                </span>
              </div>
            </div>

            {/* Profile Content */}
            <div className="px-6 pb-6 pt-0 relative">
              {/* Avatar position shifted upward */}
              <div className="flex justify-between items-end -mt-10 mb-4">
                <div className="h-20 w-20 rounded-2xl bg-white dark:bg-zinc-900 p-1.5 shadow-md">
                  <div className="h-full w-full rounded-xl bg-gradient-to-tr from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-indigo-950 flex items-center justify-center text-blue-600 dark:text-blue-300 font-extrabold text-2xl border border-blue-100/50 dark:border-blue-800/40">
                    {initial}
                  </div>
                </div>
              </div>

              {/* Names */}
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                  {user.displayName || user.name}
                </h2>
                {user.username && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold mt-0.5">
                    @{user.username}
                  </p>
                )}
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 mt-1.5">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  {user.email}
                </p>
                {user.phoneNumber && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1.5 mt-1">
                    <span className="text-slate-400 shrink-0 font-bold">☏</span>
                    {user.phoneNumber}
                  </p>
                )}
              </div>

              {/* Info Attributes Divider */}
              <div className="h-[1px] bg-slate-100 dark:bg-zinc-800/60 my-5"></div>

              {/* Quick Metadata */}
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Peran Aktif Saat Ini
                  </span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Shield className="h-4 w-4 text-blue-500" />
                    <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 capitalize">
                      {capitalizeRole(user.role)}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Seluruh Peran Akun (Multi-Role)
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(user.roles && user.roles.length > 0 ? user.roles : [user.role]).map((r) => (
                      <span
                        key={r}
                        className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 capitalize border border-slate-200/50 dark:border-zinc-750"
                      >
                        {capitalizeRole(r)}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Hubungan Data SDM (Kepegawaian)
                  </span>
                  {user.teacherId ? (
                    <div className="flex items-center gap-1.5 mt-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-semibold">
                        Terhubung: {user.teacherName || "Data Guru"}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1 text-amber-600 dark:text-amber-400">
                      <XCircle className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-semibold">
                        Belum dihubungkan ke SDM
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Akun Dibuat
                  </span>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-600 dark:text-zinc-300">
                    <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-medium">
                      {formatDate(user.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Password voluntary change action */}
              <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800/60">
                <button
                  onClick={handleVoluntaryPasswordChange}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white text-xs font-bold shadow-xs cursor-pointer transition-colors"
                >
                  <KeyRound className="h-4 w-4" />
                  Ganti Kata Sandi Akun
                </button>
              </div>
            </div>
          </motion.div>

        </div>

        {/* Login History column */}
        <div className="lg:col-span-2">
          
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-3xl shadow-xs overflow-hidden"
          >
            {/* Header tab */}
            <div className="px-6 py-5 border-b border-slate-150 dark:border-zinc-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  RIWAYAT LOG MASUK KEAMANAN (50 LOG TERAKHIR)
                </h3>
              </div>
              <button
                onClick={() => refetch()}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition-colors cursor-pointer"
                title="Muat Ulang"
              >
                <Activity className="h-4 w-4" />
              </button>
            </div>

            {/* List/Table */}
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                  <Clock className="h-8 w-8 animate-spin text-blue-500 mb-2" />
                  <span className="text-xs">Memuat riwayat keamanan...</span>
                </div>
              ) : loginHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Activity className="h-10 w-10 text-slate-300 mb-2" />
                  <span className="text-xs font-medium">Belum ada riwayat masuk terdeteksi.</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 dark:bg-zinc-800/40 border-b border-slate-150 dark:border-zinc-800/80">
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Waktu & Tanggal</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Perangkat (OS)</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Peramban (Browser)</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Alamat IP</th>
                      <th className="py-3 px-4 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                    {loginHistory.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-700 dark:text-zinc-300">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                          <Computer className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {log.os}
                        </td>
                        <td className="py-3.5 px-4 text-xs font-medium text-slate-600 dark:text-zinc-400">
                          {log.browser}
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <button
                            onClick={() => handleCopyIp(log.ip, log.id)}
                            className="flex items-center gap-1 font-mono text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold hover:underline cursor-pointer"
                            title="Salin Alamat IP"
                          >
                            <Globe className="h-3 w-3 text-slate-400" />
                            {log.ip}
                            <span className="text-[9px] text-slate-400 scale-90 px-1 bg-slate-100 dark:bg-zinc-800 rounded">
                              {copiedText === log.id ? "Tersalin!" : "Salin"}
                            </span>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                            log.status === "Sukses"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                          }`}>
                            {log.status === "Sukses" ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                Sukses
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 text-rose-500" />
                                {log.reason || "Gagal"}
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>

        </div>

      </div>

    </div>
  );
}
