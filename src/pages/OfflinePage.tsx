import React from "react";
import { WifiOff, RefreshCw, School } from "lucide-react";
import { APP_CONFIG } from "../config/appVersion";

export const OfflinePage: React.FC = () => {
  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center p-6 text-center text-slate-800 dark:text-zinc-100">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-8 shadow-xl space-y-6">
        <div className="relative mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100">
            Anda sedang Offline
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Aplikasi <strong className="text-slate-800 dark:text-zinc-200">{APP_CONFIG.name}</strong> membutuhkan koneksi internet untuk sinkronisasi data Firestore. Silakan periksa koneksi Wi-Fi atau data seluler Anda.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Hubungkan Kembali</span>
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 text-[11px] text-slate-400 dark:text-zinc-500">
          {APP_CONFIG.schoolName} — Versi {APP_CONFIG.version}
        </div>
      </div>
    </div>
  );
};

export default OfflinePage;
