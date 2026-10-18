import React, { useState } from "react";
import {
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  User,
  School,
  Lock,
  Layers,
  Info
} from "lucide-react";
import { ScenarioSyncPreviewResult, ScenarioSyncItemPreview } from "../types";

interface Props {
  preview: ScenarioSyncPreviewResult;
  isOpen: boolean;
  onClose: () => void;
  onApply: () => Promise<void>;
  isApplying: boolean;
}

export const ScenarioSyncModal: React.FC<Props> = ({
  preview,
  isOpen,
  onClose,
  onApply,
  isApplying
}) => {
  const [filterAction, setFilterAction] = useState<"ALL" | "REDUCE" | "INCREASE" | "UNCHANGED">("ALL");

  if (!isOpen) return null;

  const filteredItems = preview.items.filter((item) => {
    if (filterAction === "ALL") return true;
    return item.action === filterAction;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                Sinkronisasi Struktur Kurikulum ke Jadwal Bayangan
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Menyelaraskan alokasi JP dan penugasan guru dari Struktur Kurikulum Bayangan terbaru ke Jadwal Bayangan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          {/* Reduced */}
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 flex flex-col justify-between">
            <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Alokasi Berkurang</span>
              <ArrowDownCircle className="w-4 h-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-rose-800 dark:text-rose-200">{preview.reducedCount}</span>
              <span className="text-[11px] text-rose-600 dark:text-rose-400">slot dikosongkan</span>
            </div>
          </div>

          {/* Increased */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Alokasi Bertambah</span>
              <ArrowUpCircle className="w-4 h-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-800 dark:text-emerald-200">{preview.increasedCount}</span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">slot dialokasikan</span>
            </div>
          </div>

          {/* Teacher Updated */}
          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Update Guru</span>
              <User className="w-4 h-4" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-blue-800 dark:text-blue-200">{preview.teacherUpdateCount}</span>
              <span className="text-[11px] text-blue-600 dark:text-blue-400">slot diselaraskan</span>
            </div>
          </div>

          {/* Unchanged / Matched */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-600 dark:text-zinc-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Sesuai Target</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-800 dark:text-zinc-200">{preview.unchangedCount}</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">mapel sesuai</span>
            </div>
          </div>
        </div>

        {/* Warnings Alert Box */}
        {preview.warnings.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5 shrink-0">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Catatan / Peringatan Validasi ({preview.warnings.length})</span>
            </div>
            <ul className="text-[11px] text-amber-700 dark:text-amber-400 list-disc list-inside space-y-0.5 max-h-24 overflow-y-auto">
              {preview.warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Table & Filtering */}
        <div className="flex-1 min-h-0 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Rincian Perubahan yang Akan Diterapkan ({preview.items.length})
            </h4>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setFilterAction("ALL")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterAction === "ALL"
                    ? "bg-white dark:bg-zinc-700 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterAction("REDUCE")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterAction === "REDUCE"
                    ? "bg-white dark:bg-zinc-700 text-rose-700 dark:text-rose-400 shadow-2xs font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-rose-600"
                }`}
              >
                Berkurang ({preview.items.filter((i) => i.action === "REDUCE").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterAction("INCREASE")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterAction === "INCREASE"
                    ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-2xs font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-emerald-600"
                }`}
              >
                Bertambah ({preview.items.filter((i) => i.action === "INCREASE").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterAction("UNCHANGED")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  filterAction === "UNCHANGED"
                    ? "bg-white dark:bg-zinc-700 text-blue-700 dark:text-blue-400 shadow-2xs font-bold"
                    : "text-slate-500 dark:text-zinc-400 hover:text-blue-600"
                }`}
              >
                Update Guru ({preview.items.filter((i) => i.action === "UNCHANGED").length})
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                {preview.totalChanges === 0
                  ? "Seluruh slot Jadwal Bayangan sudah sinkron dengan Struktur Kurikulum Bayangan!"
                  : "Tidak ada mata pelajaran pada kategori filter yang dipilih."}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md">
                {preview.totalChanges === 0
                  ? "Alokasi JP dan penugasan guru pengampu pada setiap rombel kelas telah sesuai target."
                  : "Pilih tab lain di atas untuk melihat rincian perubahan lainnya."}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-10 font-bold text-slate-600 dark:text-zinc-300">
                  <tr>
                    <th className="p-2.5">Kelas</th>
                    <th className="p-2.5">Mata Pelajaran</th>
                    <th className="p-2.5 text-center">Status Alokasi JP</th>
                    <th className="p-2.5">Rincian Slot & Aksi Penyesuaian</th>
                    <th className="p-2.5">Guru Pengampu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredItems.map((item, idx) => {
                    const badgeAction =
                      item.action === "REDUCE"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200"
                        : item.action === "INCREASE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200";

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        {/* Class */}
                        <td className="p-2.5 font-bold text-slate-800 dark:text-zinc-200 whitespace-nowrap align-top">
                          <div className="flex items-center gap-1.5">
                            <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.className}</span>
                          </div>
                        </td>

                        {/* Subject */}
                        <td className="p-2.5 align-top">
                          <p className="font-bold text-slate-900 dark:text-zinc-100">{item.subjectName}</p>
                          <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold border mt-0.5 ${badgeAction}`}>
                            {item.action === "REDUCE"
                              ? `Berkurang (${item.diff} JP)`
                              : item.action === "INCREASE"
                              ? `Bertambah (+${item.diff} JP)`
                              : "Update Guru"}
                          </span>
                        </td>

                        {/* JP Comparison */}
                        <td className="p-2.5 text-center align-top whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-[11px] font-bold">
                            <span className="text-slate-500" title="Alokasi di Jadwal Bayangan saat ini">
                              {item.currentJp} JP
                            </span>
                            <span className="text-slate-400">➔</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold" title="Target Struktur Kurikulum Bayangan">
                              {item.targetJp} JP
                            </span>
                          </div>
                        </td>

                        {/* Action on Affected Slots */}
                        <td className="p-2.5 align-top">
                          <div className="space-y-1">
                            {item.affectedSlots.map((slot, sIdx) => (
                              <div
                                key={sIdx}
                                className={`text-[10px] p-1.5 rounded-md flex items-center justify-between gap-2 border ${
                                  item.action === "REDUCE"
                                    ? "bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300"
                                    : item.action === "INCREASE"
                                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300"
                                    : "bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300"
                                }`}
                              >
                                <span>{slot.actionDescription}</span>
                                {slot.isLocked && (
                                  <span className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-100 dark:bg-amber-950/40 px-1 py-0.5 rounded shrink-0">
                                    <Lock className="w-2.5 h-2.5" /> Terkunci
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Teacher */}
                        <td className="p-2.5 align-top whitespace-nowrap text-slate-600 dark:text-zinc-300">
                          <div className="flex items-center gap-1 text-[11px]">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.teacherName}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800 pt-4 shrink-0">
          <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>Perubahan manual drag-and-drop yang valid pada slot lain tetap dipertahankan.</span>
          </p>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={isApplying || preview.totalChanges === 0}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl shadow-xs transition-all ${
                preview.totalChanges === 0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-500"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isApplying ? "animate-spin" : ""}`} />
              <span>{isApplying ? "Menerapkan Sinkronisasi..." : "Terapkan Sinkronisasi Sekarang"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
