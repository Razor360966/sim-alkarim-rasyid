import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Heart, Shield, CheckCircle2, AlertCircle, Clock, Eye, ChevronRight } from "lucide-react";
import { executiveMutabaahService } from "../services/executiveMutabaahService";
import { ExecutiveMutabaahDrilldown } from "./ExecutiveMutabaahDrilldown";

export const ExecutiveMutabaahWidget: React.FC = () => {
  const [showDrilldownModal, setShowDrilldownModal] = useState<boolean>(false);
  const [drilldownStatus, setDrilldownStatus] = useState<string>("ALL");

  const todayStr = new Date().toISOString().split("T")[0];

  const { data: report, isLoading } = useQuery({
    queryKey: ["executiveMutabaahWidget", todayStr],
    queryFn: () => executiveMutabaahService.getExecutiveReport({
      startDate: todayStr,
      endDate: todayStr
    })
  });

  const summary = report?.summary;

  const handleOpenDrilldown = (statusFilter: string = "ALL") => {
    setDrilldownStatus(statusFilter);
    setShowDrilldownModal(true);
  };

  return (
    <>
      <div className="bg-gradient-to-br from-rose-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-md border border-rose-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-md border border-rose-500/30 flex items-center gap-1">
                <Heart className="w-3 h-3 text-rose-400" /> Executive Indicator
              </span>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-md border border-amber-500/30 flex items-center gap-1">
                <Shield className="w-3 h-3 text-amber-300" /> Read Only Access
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-black text-white">
              Mutabaah Guru (Asatidz & Ustadzah)
            </h3>
            <p className="text-xs text-slate-300">
              Pemantauan pengisian mutabaah ibadah & ruhiyah harian guru secara real-time.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleOpenDrilldown("ALL")}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-xl text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
          >
            <Eye className="w-4 h-4" />
            <span>Executive Drilldown</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* CLICKABLE METRIC CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 text-xs">
          {/* Total Guru */}
          <div
            onClick={() => handleOpenDrilldown("ALL")}
            className="bg-white/10 backdrop-blur-xs border border-white/10 p-3.5 rounded-2xl cursor-pointer hover:bg-white/15 transition-all"
          >
            <span className="text-[10px] text-slate-300 uppercase font-bold block">Total Guru</span>
            <div className="text-2xl font-black text-white mt-1">
              {isLoading ? "..." : summary?.totalTeachers ?? 0}
            </div>
            <span className="text-[9px] text-slate-400 mt-0.5 block">Asatidz/ah Aktif</span>
          </div>

          {/* Sudah Mengisi */}
          <div
            onClick={() => handleOpenDrilldown("Lengkap")}
            className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-2xl cursor-pointer hover:bg-emerald-900/50 transition-all group"
          >
            <span className="text-[10px] text-emerald-300 uppercase font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Sudah Mengisi
            </span>
            <div className="text-2xl font-black text-emerald-300 mt-1">
              {isLoading ? "..." : summary?.filledCount ?? 0}
            </div>
            <span className="text-[9px] text-emerald-400 font-bold mt-0.5 block group-hover:underline">Detail Guru &rarr;</span>
          </div>

          {/* Belum Mengisi */}
          <div
            onClick={() => handleOpenDrilldown("Belum Mengisi")}
            className="bg-rose-950/50 border border-rose-500/40 p-3.5 rounded-2xl cursor-pointer hover:bg-rose-900/60 transition-all group"
          >
            <span className="text-[10px] text-rose-300 uppercase font-bold flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-rose-400" /> Belum Mengisi
            </span>
            <div className="text-2xl font-black text-rose-300 mt-1">
              {isLoading ? "..." : summary?.unfilledCount ?? 0}
            </div>
            <span className="text-[9px] text-rose-400 font-bold mt-0.5 block group-hover:underline">Detail Guru &rarr;</span>
          </div>

          {/* Persentase Keterisian */}
          <div className="bg-indigo-950/40 border border-indigo-500/30 p-3.5 rounded-2xl">
            <span className="text-[10px] text-indigo-300 uppercase font-bold block">Keterisian Hari Ini</span>
            <div className="text-2xl font-black text-indigo-200 mt-1">
              {isLoading ? "..." : `${summary?.fillRatePercentage ?? 0}%`}
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div
                className="bg-indigo-400 h-full rounded-full"
                style={{ width: `${summary?.fillRatePercentage ?? 0}%` }}
              />
            </div>
          </div>

          {/* Terlambat */}
          <div
            onClick={() => handleOpenDrilldown("Terlambat")}
            className="bg-purple-950/40 border border-purple-500/30 p-3.5 rounded-2xl cursor-pointer hover:bg-purple-900/50 transition-all group col-span-2 md:col-span-1"
          >
            <span className="text-[10px] text-purple-300 uppercase font-bold flex items-center gap-1">
              <Clock className="w-3 h-3 text-purple-400" /> Terlambat
            </span>
            <div className="text-2xl font-black text-purple-300 mt-1">
              {isLoading ? "..." : summary?.lateCount ?? 0}
            </div>
            <span className="text-[9px] text-purple-400 font-bold mt-0.5 block group-hover:underline">Detail Guru &rarr;</span>
          </div>
        </div>
      </div>

      {/* DRILLDOWN FULLSCREEN MODAL */}
      {showDrilldownModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md p-3 md:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl p-4 md:p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-rose-600" />
                <h2 className="text-lg font-black text-slate-800 dark:text-white">
                  Executive Detail Drilldown Mutabaah Guru
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDrilldownModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl transition-all cursor-pointer font-bold text-xs"
              >
                Tutup Modal
              </button>
            </div>

            <ExecutiveMutabaahDrilldown
              initialStatusFilter={drilldownStatus}
              onClose={() => setShowDrilldownModal(false)}
              isModal={true}
            />
          </div>
        </div>
      )}
    </>
  );
};
