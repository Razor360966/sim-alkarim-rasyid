import React from "react";
import { School, Sparkles, Download, RefreshCw, Code2, ShieldCheck, Cpu, Calendar, UserCheck, Info } from "lucide-react";
import { APP_CONFIG } from "../config/appVersion";
import { usePwa } from "../contexts/PwaContext";

export const AboutApp: React.FC = () => {
  const { installable, installApp, applyUpdate, updateAvailable } = usePwa();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-zinc-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="p-4 bg-indigo-600/30 backdrop-blur-md border border-indigo-400/30 rounded-3xl shadow-2xl shrink-0">
            <School className="w-12 h-12 text-indigo-300" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Progressive Web App (PWA)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {APP_CONFIG.name} — {APP_CONFIG.schoolName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              {APP_CONFIG.fullName}
            </p>
          </div>
        </div>
      </div>

      {/* Main Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Informasi Versi & Instalasi */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                Informasi Versi & Instalasi
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Status aplikasi dan Service Worker PWA
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-850">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Versi Aplikasi</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                v{APP_CONFIG.version}
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-850">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Tanggal Build</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{APP_CONFIG.buildDate}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-850">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Pengembang</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{APP_CONFIG.developer}</span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Institusi Sekolah</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{APP_CONFIG.schoolName}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            {installable && (
              <button
                type="button"
                onClick={installApp}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install Aplikasi SIMAK</span>
              </button>
            )}

            <button
              type="button"
              onClick={applyUpdate}
              className="flex-1 py-2.5 bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{updateAvailable ? "Perbarui Sekarang" : "Cek / Muat Ulang Versi"}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Arsitektur & Teknologi */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                Teknologi yang Digunakan
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Stack teknologi modern berkinerja tinggi
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {APP_CONFIG.techStack.map((tech) => (
              <span
                key={tech}
                className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5"
              >
                <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{tech}</span>
              </span>
            ))}
          </div>

          <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl text-xs text-emerald-900 dark:text-emerald-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Optimasi Performa SIMAK</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-zinc-400">
              Aplikasi ini mengintegrasikan Lazy Loading Route, Manual Chunking, Service Worker Caching, serta Progressive Web App (PWA) agar dapat diakses responsif pada semua perangkat mobile maupun desktop.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="text-center pt-4 text-xs text-slate-400 dark:text-zinc-500 space-y-1">
        <p className="font-semibold text-slate-600 dark:text-zinc-400">{APP_CONFIG.copyright}</p>
        <p className="text-[10px]">Tahun 2026 — {APP_CONFIG.schoolName}</p>
      </div>
    </div>
  );
};

export default AboutApp;
