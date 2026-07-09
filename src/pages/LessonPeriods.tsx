import React, { useState, useMemo } from "react";
import { useSchoolSettings } from "../hooks/schoolSettings.hook";
import { useLessonPeriods } from "../hooks/lessonPeriod.hook";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { Dialog } from "../components/Dialog";
import { 
  Clock, 
  Sparkles, 
  RefreshCw, 
  Calendar, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  Sliders
} from "lucide-react";
import { LessonPeriod, LessonPeriodType } from "../types";

export const LessonPeriods: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Queries
  const { settings, isLoading: isLoadingSettings } = useSchoolSettings();
  const { periods, isLoading: isLoadingPeriods, generatePeriods, isGenerating } = useLessonPeriods();

  // Day filter state: "Semua" or specific day
  const [selectedDay, setSelectedDay] = useState<string>("Semua");
  
  // Dialog state for regeneration confirmation
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // Role verification (Admin, Operator, Tata Usaha can write/generate)
  const canWrite = useMemo(() => {
    return user?.role === "admin" || user?.role === "operator" || user?.role === "tata usaha";
  }, [user]);

  // Active days list from settings
  const activeDays = useMemo(() => {
    return settings?.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  }, [settings]);

  // Filter periods based on selection
  const filteredPeriods = useMemo(() => {
    if (selectedDay === "Semua") return periods;
    return periods.filter(p => p.day.toLowerCase() === selectedDay.toLowerCase());
  }, [periods, selectedDay]);

  // Check if any periods exist globally
  const hasPeriods = periods.length > 0;

  const handleGenerate = async () => {
    try {
      await generatePeriods();
      setIsConfirmOpen(false);
    } catch (error: any) {
      console.error(error);
    }
  };

  const openConfirmation = () => {
    if (!canWrite) {
      toast("Anda tidak memiliki akses untuk melakukan tindakan ini.", "error");
      return;
    }
    setIsConfirmOpen(true);
  };

  if (isLoadingSettings || isLoadingPeriods) {
    return <Loading variant="full" text="Memuat data struktur Lesson Period..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 dark:border-zinc-850 pb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Lesson Period Engine
          </h1>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
            Mesin otomatis pembentuk seluruh struktur waktu sekolah (JP, Istirahat, dan Kegiatan Rutin) tanpa overlap.
          </p>
        </div>

        {/* Show (Re)generate Button at top right if we already have data */}
        {hasPeriods && (
          canWrite ? (
            <button
              onClick={openConfirmation}
              disabled={isGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
              Regenerate Lesson Period
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs bg-slate-100 dark:bg-zinc-900 text-slate-500 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 font-medium">
              Mode Lihat Saja
            </span>
          )
        )}
      </div>

      {/* Info Card / Quick Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Hari Aktif</h3>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
              {activeDays.join(", ")}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">Sesuai pengaturan sekolah aktif</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Durasi 1 JP</h3>
            <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-0.5">
              {settings?.lessonPeriod || settings?.jpDuration || 40} <span className="text-xs font-semibold text-gray-500">Menit</span>
            </p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">Maksimal jam mengajar harian</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Status Timeline</h3>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
              {hasPeriods ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Terbentuk ({periods.length} Slot)
                </>
              ) : (
                <span className="text-amber-500">Belum Digenerate</span>
              )}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">Dipakai otomatis oleh Auto Scheduler</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!hasPeriods ? (
        /* Empty State with Generate button */
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-3xl border border-gray-150 dark:border-zinc-800 shadow-xs text-center max-w-2xl mx-auto space-y-6">
          <div className="mx-auto w-16 h-16 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
            <Sparkles className="h-8 w-8 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Generate Lesson Period Anda</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
              Struktur Lesson Period kosong. Mesin ini akan otomatis menghitung waktu jam pelajaran (JP), rutinitas apel/upacara, dan jam istirahat agar sinkron serta tidak saling tumpang tindih.
            </p>
          </div>

          {canWrite ? (
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-blue-500/15 transition-all hover:scale-[1.02] cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Menggenerate..." : "Generate Lesson Period"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-xs text-red-500 bg-red-50 dark:bg-red-950/20 px-4 py-2 rounded-xl max-w-sm mx-auto">
              <ShieldAlert className="h-4 w-4" />
              <span>Hanya Admin, Operator, atau Tata Usaha yang dapat melakukan generate.</span>
            </div>
          )}
        </div>
      ) : (
        /* Display List of Lesson Periods */
        <div className="space-y-6">
          
          {/* Day Filter Horizontal Scroll Bar */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-wrap gap-2 items-center">
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mr-2">Filter Hari:</span>
            
            <button
              onClick={() => setSelectedDay("Semua")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedDay === "Semua"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-600 dark:text-zinc-300"
              }`}
            >
              Semua Hari Aktif
            </button>

            {activeDays.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  selectedDay.toLowerCase() === day.toLowerCase()
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-gray-50 hover:bg-gray-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-gray-600 dark:text-zinc-300"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          {/* Table Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-50 dark:border-zinc-850 flex justify-between items-center bg-gray-50/20 dark:bg-zinc-900/10">
              <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
                Struktur Waktu: {selectedDay === "Semua" ? "Semua Hari Aktif" : `Hari ${selectedDay}`}
              </span>
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20 px-2.5 py-1 rounded-lg">
                Total {filteredPeriods.length} Slot Waktu
              </span>
            </div>

            {filteredPeriods.length === 0 ? (
              <div className="p-12 text-center text-gray-400 dark:text-zinc-500 text-xs">
                Tidak ada data Lesson Period untuk filter yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-900/30 text-gray-400 dark:text-zinc-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-6">Hari</th>
                      <th className="py-3 px-6 text-center">Seq</th>
                      <th className="py-3 px-6">Period Code</th>
                      <th className="py-3 px-6">Jenis (Tipe)</th>
                      <th className="py-3 px-6">Nama / Judul</th>
                      <th className="py-3 px-6 text-center">Mulai</th>
                      <th className="py-3 px-6 text-center">Selesai</th>
                      <th className="py-3 px-6 text-center">Durasi</th>
                      <th className="py-3 px-6 text-center">Instruksional</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-850">
                    {filteredPeriods.map((period, idx) => {
                      // Styling based on types
                      const typeStyles = {
                        [LessonPeriodType.LESSON]: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30",
                        [LessonPeriodType.ROUTINE]: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30",
                        [LessonPeriodType.BREAK]: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/30"
                      };

                      return (
                        <tr 
                          key={period.id || idx} 
                          className="hover:bg-gray-50/40 dark:hover:bg-zinc-900/20 transition-colors text-xs text-gray-600 dark:text-zinc-300 font-medium"
                        >
                          <td className="py-3.5 px-6 font-bold text-gray-900 dark:text-white">{period.day}</td>
                          <td className="py-3.5 px-6 text-center font-mono">{period.sequence}</td>
                          <td className="py-3.5 px-6 font-mono text-[10px] text-gray-400 dark:text-zinc-500">{period.periodCode}</td>
                          <td className="py-3.5 px-6">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider ${typeStyles[period.type]}`}>
                              {period.type}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-semibold text-gray-800 dark:text-zinc-200">{period.title}</td>
                          <td className="py-3.5 px-6 text-center font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/10">{period.startTime}</td>
                          <td className="py-3.5 px-6 text-center font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10">{period.endTime}</td>
                          <td className="py-3.5 px-6 text-center">
                            <span className="font-semibold text-gray-900 dark:text-white">{period.duration}</span>
                            <span className="text-[10px] text-gray-400 dark:text-zinc-500 ml-1">Min</span>
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            {period.instructional ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                                Ya
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 font-bold text-[10px]">
                                No
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Regeneration */}
      <Dialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Regenerate Lesson Period?"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-3 text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-6 w-6 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider">Perhatian Penting</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">
                Melakukan generate ulang (Regenerate) akan menghapus seluruh data Lesson Period yang tersimpan saat ini dan menggantinya dengan perhitungan baru berdasarkan pengaturan sekolah terbaru.
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl text-[11px] text-blue-700 dark:text-blue-400">
            Tindakan ini sangat disarankan jika Anda baru saja mengubah Jam Masuk, Jam Pulang, Kegiatan Rutin, atau Istirahat pada menu Pengaturan Sekolah.
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="px-4 py-2 border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-350 rounded-xl text-xs font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? "Membangun Ulang..." : "Ya, Generate Ulang"}
            </button>
          </div>
        </div>
      </Dialog>

    </div>
  );
};

export default LessonPeriods;
