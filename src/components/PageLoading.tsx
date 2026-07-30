import React from "react";
import { Loader2, School } from "lucide-react";

export const PageLoading: React.FC = () => {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-6 text-slate-800 dark:text-zinc-100">
      <div className="flex flex-col items-center space-y-4 text-center animate-fade-in">
        <div className="relative flex items-center justify-center">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl shadow-xs">
            <School className="w-8 h-8" />
          </div>
          <Loader2 className="absolute -inset-1.5 w-14 h-14 animate-spin text-indigo-500/40 dark:text-indigo-400/40" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Memuat Halaman...</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">Mohon tunggu sebentar</p>
        </div>
      </div>
    </div>
  );
};

export default PageLoading;
