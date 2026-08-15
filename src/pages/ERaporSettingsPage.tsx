import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { eRaporService, DEFAULT_RAPOR_SETTINGS } from "../services/eRapor.service";
import { ERaporSettingsConfig } from "../types/eRapor.types";
import { Settings, Save, AlertCircle, CheckCircle2, Lock, Unlock, Printer, Sliders } from "lucide-react";
import { ERaporPrintSettingsPanel } from "../components/ERaporPrintSettingsPanel";

export default function ERaporSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"BOBOT" | "CETAK">("BOBOT");
  const [config, setConfig] = useState<ERaporSettingsConfig>(DEFAULT_RAPOR_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        const cfg = await eRaporService.getSettings();
        setConfig(cfg);
      } catch (e) {
        console.error("Error loading e-Rapor config:", e);
        toast("Gagal memuat pengaturan e-Rapor.", "error");
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const totalWeight = Number(config.tpWeight || 0) + Number(config.utsWeight || 0) + Number(config.sasWeight || 0);
  const isValidWeight = totalWeight === 100;

  const handleSave = async () => {
    if (!isValidWeight) {
      toast("Total persentase bobot penilaian harus tepat 100%.", "error");
      return;
    }

    setIsSaving(true);
    try {
      await eRaporService.saveSettings(config, user?.name || "Admin");
      toast("Pengaturan e-Rapor & Bobot Nilai berhasil disimpan!", "success");
    } catch (e) {
      console.error("Error saving e-Rapor settings:", e);
      toast("Gagal menyimpan pengaturan e-Rapor.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
              Pengaturan e-Rapor
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Atur persentase bobot nilai, akses penginputan, serta cetak & kop rapor resmi.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-bold">
          <button
            onClick={() => setActiveTab("BOBOT")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "BOBOT"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-800"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Bobot & Periode
          </button>
          <button
            onClick={() => setActiveTab("CETAK")}
            className={`px-3.5 py-2 rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "CETAK"
                ? "bg-white dark:bg-zinc-900 text-indigo-600 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-800"
            }`}
          >
            <Printer className="w-4 h-4" />
            Pengaturan Cetak
          </button>
        </div>
      </div>

      {activeTab === "CETAK" ? (
        <ERaporPrintSettingsPanel />
      ) : isLoading ? (
        <div className="p-12 text-center text-slate-500">Memuat pengaturan...</div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || !isValidWeight}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl text-white transition-all flex items-center gap-2 ${
                isValidWeight
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-md"
                  : "bg-slate-300 dark:bg-zinc-800 cursor-not-allowed"
              }`}
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Menyimpan..." : "Simpan Bobot & Periode"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Form 1: Weight Calculation */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Bobot Formulasi Nilai Akhir (%)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Bobot Asesmen TP (Tujuan Pembelajaran)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.tpWeight}
                    onChange={(e) => setConfig({ ...config, tpWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Bobot Asesmen UTS / STS (Tengah Semester)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.utsWeight}
                    onChange={(e) => setConfig({ ...config, utsWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Bobot Asesmen SAS (Akhir Semester)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={config.sasWeight}
                    onChange={(e) => setConfig({ ...config, sasWeight: parseFloat(e.target.value) || 0 })}
                    className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-400 font-bold">%</span>
                </div>
              </div>

              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  isValidWeight
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                }`}
              >
                <span>Total Alokasi Bobot:</span>
                <span>{totalWeight}% / 100%</span>
              </div>
            </div>
          </div>

          {/* Form 2: Grading Window Access Control */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Akses Periode Penginputan Nilai
            </h3>

            <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                    {config.isOpen ? "Status: Terbuka" : "Status: Ditutup"}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {config.isOpen
                      ? "Guru mata pelajaran dapat menginput dan mengedit nilai."
                      : "Input nilai dikunci secara global oleh Kurikulum/Admin."}
                  </p>
                </div>

                <button
                  onClick={() => setConfig({ ...config, isOpen: !config.isOpen })}
                  className={`p-3 rounded-xl transition-all ${
                    config.isOpen
                      ? "bg-emerald-500 text-white"
                      : "bg-rose-500 text-white"
                  }`}
                >
                  {config.isOpen ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Leger Configuration */}
            <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Konfigurasi Leger Nilai Multi-Semester
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Tentukan jumlah semester yang akan ditampilkan pada matriks Leger Nilai jenjang SMP.
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "5 Semester", preset: "5", count: 5 },
                  { label: "6 Semester", preset: "6", count: 6 },
                  { label: "Custom", preset: "CUSTOM", count: config.legerConfig?.customSemesterCount || 6 }
                ].map((item) => {
                  const isSelected = (config.legerConfig?.presetType || "6") === item.preset;
                  return (
                    <button
                      key={item.preset}
                      type="button"
                      onClick={() => {
                        const currentLeger = config.legerConfig || { maxSemesters: 6, presetType: "6" };
                        if (item.preset === "CUSTOM") {
                          setConfig({
                            ...config,
                            legerConfig: {
                              ...currentLeger,
                              presetType: "CUSTOM",
                              maxSemesters: currentLeger.customSemesterCount || 6,
                              customSemesterCount: currentLeger.customSemesterCount || 6
                            }
                          });
                        } else {
                          setConfig({
                            ...config,
                            legerConfig: {
                              ...currentLeger,
                              presetType: item.preset as "5" | "6" | "CUSTOM",
                              maxSemesters: item.count
                            }
                          });
                        }
                      }}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                          : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {config.legerConfig?.presetType === "CUSTOM" && (
                <div className="mt-2">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                    Jumlah Semester Kustom:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={config.legerConfig.customSemesterCount || config.legerConfig.maxSemesters || 6}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 6;
                      setConfig({
                        ...config,
                        legerConfig: {
                          presetType: "CUSTOM",
                          customSemesterCount: val,
                          maxSemesters: val
                        }
                      });
                    }}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
