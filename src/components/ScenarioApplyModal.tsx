import React, { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Layers, 
  ArrowRight, 
  Calendar, 
  School, 
  Clock, 
  Check, 
  ShieldCheck, 
  FileText,
  Loader2
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scenarioService } from "../services/scenario.service";
import { 
  ScheduleScenario, 
  Class, 
  ScenarioApplyPreview, 
  ScenarioApplyResult 
} from "../types";
import { useToast } from "../contexts/ToastContext";

interface Props {
  scenario: ScheduleScenario;
  classes: Class[];
  isOpen: boolean;
  onClose: () => void;
  onApplySuccess: (result: ScenarioApplyResult) => void;
  user: { uid: string; displayName?: string; role?: string } | null;
}

export const ScenarioApplyModal: React.FC<Props> = ({
  scenario,
  classes,
  isOpen,
  onClose,
  onApplySuccess,
  user
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(["ALL"]);
  const [confirmed, setConfirmed] = useState(false);
  const [applyResult, setApplyResult] = useState<ScenarioApplyResult | null>(null);
  const [activeDiffTab, setActiveDiffTab] = useState<"all" | "added" | "updated" | "empty">("all");

  // Query Preview Apply
  const { data: preview, isLoading: isLoadingPreview, refetch: refetchPreview } = useQuery<ScenarioApplyPreview>({
    queryKey: ["scenario_apply_preview", scenario.id, selectedClassIds],
    queryFn: () => scenarioService.previewApplyScenarioToLiveSchedule({
      scenarioId: scenario.id,
      academicYearId: scenario.academicYearId,
      semesterId: scenario.semesterId,
      classIds: selectedClassIds
    }),
    enabled: isOpen
  });

  const [isPublished, setIsPublished] = useState(Boolean(scenario.isPublished));

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi pengguna tidak valid.");
      return scenarioService.publishScenarioLiveSchedule({
        scenarioId: scenario.id,
        user: { uid: user.uid, displayName: user.displayName }
      });
    },
    onSuccess: () => {
      setIsPublished(true);
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", scenario.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      showToast("Jadwal resmi SIMAK berhasil dipublikasikan!", "success");
    },
    onError: (err: any) => {
      showToast(err.message || "Gagal mempublikasikan jadwal", "error");
    }
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi pengguna tidak valid.");
      return scenarioService.updateScenarioStatus({
        scenarioId: scenario.id,
        status: "Disetujui",
        notes: "Disetujui langsung dari dialog persiapan penerapan massal",
        user: { uid: user.uid, displayName: user.displayName }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", scenario.id] });
      refetchPreview();
      showToast("Rancangan berhasil disetujui! Anda sekarang dapat menerapkan secara massal.", "success");
    },
    onError: (err: any) => {
      showToast(err.message || "Gagal menyetujui rancangan", "error");
    }
  });

  // Apply Mutation
  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi pengguna tidak valid.");
      return scenarioService.applyScenarioToLiveSchedule({
        scenarioId: scenario.id,
        academicYearId: scenario.academicYearId,
        semesterId: scenario.semesterId,
        classIds: selectedClassIds,
        user: { uid: user.uid, displayName: user.displayName, role: user.role }
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["schedule_scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["scenario", scenario.id] });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setApplyResult(result);
      onApplySuccess(result);
      showToast(`Jadwal bayangan berhasil diterapkan massal ke ${result.classesApplied.length} kelas!`, "success");
    },
    onError: (err: any) => {
      showToast(err.message || "Gagal menerapkan jadwal bayangan", "error");
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                Pratinjau & Penerapan Massal ke Jadwal Asli
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Rancangan: <strong>{scenario.name}</strong> • {scenario.academicYearName} • {scenario.semesterName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {applyResult ? (
          /* Post-Apply Success Report */
          <div className="space-y-4 py-4 text-center my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Penerapan Massal Berhasil!
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-300 max-w-lg mx-auto leading-relaxed">
              Seluruh jadwal bayangan yang telah disetujui telah resmi disalin dan aktif pada <strong>Jadwal Operasional SIMAK</strong> untuk tahun ajaran {scenario.academicYearName} ({scenario.semesterName}).
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto text-left pt-2">
              <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                <span className="text-[10px] text-slate-500 dark:text-zinc-400 uppercase font-bold block">Total Slot</span>
                <span className="text-lg font-extrabold text-slate-900 dark:text-white">{applyResult.totalApplied}</span>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block">Slot Baru</span>
                <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">{applyResult.addedCount}</span>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold block">Slot Diperbarui</span>
                <span className="text-lg font-extrabold text-blue-700 dark:text-blue-400">{applyResult.updatedCount}</span>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold block">Slot Kosong</span>
                <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">{applyResult.emptySlotsCount}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-100 dark:bg-zinc-800/80 rounded-xl max-w-xl mx-auto text-xs text-slate-600 dark:text-zinc-400 text-left">
              <strong>Kelas yang Diterapkan:</strong> {applyResult.classesApplied.join(", ")}
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 font-bold text-xs rounded-xl transition-colors"
              >
                Selesai & Tutup
              </button>

              {!isPublished ? (
                <button
                  type="button"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{publishMutation.isPending ? "Mempublikasikan..." : "Publikasikan Jadwal Live Sekarang"}</span>
                </button>
              ) : (
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Jadwal Telah Dipublikasikan ke Kalender KBM
                </span>
              )}
            </div>
          </div>
        ) : (
          /* Preview and Confirmation Flow */
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Scope Selector: Target Classes */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-700/80">
              <div className="flex items-center gap-2">
                <School className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Cakupan Rombel Kelas:
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setSelectedClassIds(["ALL"])}
                  className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedClassIds.includes("ALL")
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-zinc-750 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                  }`}
                >
                  Semua Kelas ({classes.length})
                </button>
                {classes.map((cls) => {
                  const isSelected = selectedClassIds.includes(cls.id);
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => {
                        if (selectedClassIds.includes("ALL")) {
                          setSelectedClassIds([cls.id]);
                        } else if (isSelected) {
                          const next = selectedClassIds.filter((id) => id !== cls.id);
                          setSelectedClassIds(next.length === 0 ? ["ALL"] : next);
                        } else {
                          setSelectedClassIds([...selectedClassIds, cls.id]);
                        }
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all ${
                        !selectedClassIds.includes("ALL") && isSelected
                          ? "bg-emerald-600 text-white"
                          : "bg-white dark:bg-zinc-750 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
                      }`}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoadingPreview ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
                <p className="text-xs text-slate-500">Menganalisis perbedaan jadwal dan validasi konflik...</p>
              </div>
            ) : preview ? (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                  <div className="p-2.5 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Slot</span>
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">{preview.totalSlotsInScenario}</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold block">Slot Baru</span>
                    <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">{preview.addedSlots.length}</span>
                  </div>
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold block">Slot Diperbarui</span>
                    <span className="text-base font-extrabold text-blue-700 dark:text-blue-400">{preview.updatedSlots.length}</span>
                  </div>
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold block">Slot Kosong</span>
                    <span className="text-base font-extrabold text-amber-700 dark:text-amber-400">{preview.emptySlotsCount}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Tidak Berubah</span>
                    <span className="text-base font-extrabold text-slate-700 dark:text-zinc-300">{preview.unchangedSlotsCount}</span>
                  </div>
                </div>

                {/* Empty Slots & Safety Reassurance Info */}
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>
                    <strong>Slot Kosong Dipertahankan:</strong> Tersedia {preview.emptySlotsCount} slot kosong yang disengaja. Seluruh slot kosong diizinkan dan tidak memblokir persetujuan, penerapan massal, maupun publikasi jadwal.
                  </span>
                </div>

                {/* Validation & Conflict Banner */}
                {preview.hasBlockingErrors ? (
                  <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Penerapan Diblokir: Terdeteksi {preview.conflicts.length} Konflik Jadwal</span>
                    </div>
                    <ul className="text-[11px] text-rose-700 dark:text-rose-400 list-disc list-inside space-y-1">
                      {preview.conflicts.slice(0, 3).map((cf, idx) => (
                        <li key={idx}>{cf.description}</li>
                      ))}
                      {preview.conflicts.length > 3 && (
                        <li>...dan {preview.conflicts.length - 3} konflik lainnya</li>
                      )}
                    </ul>
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 italic">
                      Harap selesaikan tabrakan jadwal pada workbench Jadwal Bayangan sebelum melakukan penerapan resmi.
                    </p>
                  </div>
                ) : !preview.canApply ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{preview.blockReason || "Rancangan belum memenuhi syarat penerapan."}</span>
                    </div>
                    {scenario.status !== "Disetujui" && scenario.status !== "Diterapkan" && (
                      <button
                        type="button"
                        disabled={approveMutation.isPending}
                        onClick={() => approveMutation.mutate()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition-colors shrink-0"
                      >
                        {approveMutation.isPending ? "Menyetujui..." : "Setujui Sekarang"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Validasi Berhasil: Jadwal bebas dari konflik tabrakan guru/kelas dan siap diterapkan ke operasional.</span>
                  </div>
                )}

                {/* Tabs to Inspect Changes */}
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab("all")}
                    className={`py-1.5 px-3 font-bold border-b-2 transition-all ${
                      activeDiffTab === "all"
                        ? "border-emerald-600 text-emerald-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Semua Perubahan ({preview.addedSlots.length + preview.updatedSlots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab("added")}
                    className={`py-1.5 px-3 font-bold border-b-2 transition-all ${
                      activeDiffTab === "added"
                        ? "border-emerald-600 text-emerald-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Slot Baru ({preview.addedSlots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab("updated")}
                    className={`py-1.5 px-3 font-bold border-b-2 transition-all ${
                      activeDiffTab === "updated"
                        ? "border-emerald-600 text-emerald-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Slot Diperbarui ({preview.updatedSlots.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDiffTab("empty")}
                    className={`py-1.5 px-3 font-bold border-b-2 transition-all ${
                      activeDiffTab === "empty"
                        ? "border-emerald-600 text-emerald-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    Slot Kosong Dipertahankan ({preview.emptySlotsCount})
                  </button>
                </div>

                {/* Detail Table */}
                <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl max-h-48">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-zinc-800 font-bold text-slate-700 dark:text-zinc-300 sticky top-0 border-b border-slate-200 dark:border-zinc-700">
                      <tr>
                        <th className="py-2 px-3">Kelas & Waktu</th>
                        <th className="py-2 px-3">Mata Pelajaran</th>
                        <th className="py-2 px-3">Guru Pengampu</th>
                        <th className="py-2 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {/* Added Slots */}
                      {(activeDiffTab === "all" || activeDiffTab === "added") &&
                        preview.addedSlots.map((slot, idx) => (
                          <tr key={`add_${idx}`} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 dark:text-white block">{slot.className}</span>
                              <span className="text-[10px] text-slate-400">{slot.day}, {slot.jp}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                {slot.subjectName}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-zinc-300">
                              {slot.teacherName}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Ditambahkan
                              </span>
                            </td>
                          </tr>
                        ))}

                      {/* Updated Slots */}
                      {(activeDiffTab === "all" || activeDiffTab === "updated") &&
                        preview.updatedSlots.map((slot, idx) => (
                          <tr key={`upd_${idx}`} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 dark:text-white block">{slot.className}</span>
                              <span className="text-[10px] text-slate-400">{slot.day}, {slot.jp}</span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-slate-400 line-through text-[10px] block">{slot.oldSubjectName}</span>
                              <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                {slot.newSubjectName}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="text-slate-400 line-through text-[10px] block">{slot.oldTeacherName}</span>
                              <span className="text-slate-700 dark:text-zinc-200 flex items-center gap-1">
                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                {slot.newTeacherName}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                Diperbarui
                              </span>
                            </td>
                          </tr>
                        ))}

                      {/* Empty Slots */}
                      {activeDiffTab === "empty" &&
                        [...preview.addedSlots, ...preview.updatedSlots]
                          .filter((s) => s.isIntentionalEmpty)
                          .map((slot, idx) => {
                            const slotSubject = "newSubjectName" in slot ? slot.newSubjectName : slot.subjectName;
                            return (
                              <tr key={`empty_${idx}`} className="hover:bg-slate-50 dark:hover:bg-zinc-850">
                                <td className="py-2 px-3">
                                  <span className="font-bold text-slate-900 dark:text-white block">{slot.className}</span>
                                  <span className="text-[10px] text-slate-400">{slot.day}, {slot.jp}</span>
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-semibold text-amber-700 dark:text-amber-400 italic">
                                    {slotSubject}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-400 italic text-[11px]">
                                  Belum Ditugaskan / Jam Mandiri
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                    Slot Kosong
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                    </tbody>
                  </table>
                </div>

                {/* Explicit Confirmation Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-750 transition-colors">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      disabled={!preview.canApply}
                      className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-medium">
                      Saya mengonfirmasi bahwa penerapan ini akan <strong>menulis secara massal</strong> ke jadwal operasional SIMAK untuk rombel kelas yang dipilih. Data historis absensi dan jurnal masa lalu dijamin tidak akan terganggu.
                    </span>
                  </label>
                </div>
              </div>
            ) : null}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={!preview?.canApply || !confirmed || applyMutation.isPending}
                onClick={() => applyMutation.mutate()}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all shadow-xs disabled:opacity-40"
              >
                {applyMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menerapkan Jadwal Massal...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Terapkan Sekarang Secara Massal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
