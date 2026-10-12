import React from "react";
import { 
  GitCompare, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Layers,
  Clock
} from "lucide-react";
import { ScenarioCurriculumMatrix, ScenarioConflict, ScheduleScenario } from "../types";

interface Props {
  scenario: ScheduleScenario;
  curriculums: ScenarioCurriculumMatrix[];
  conflicts: ScenarioConflict[];
}

export const ScenarioComparisonView: React.FC<Props> = ({
  scenario,
  curriculums,
  conflicts
}) => {
  // Categorize subjects:
  // 1. Added
  const addedSubjects = curriculums.filter((c) => c.isCustomSubject);
  // 2. Disabled/Removed
  const removedSubjects = curriculums.filter((c) => !c.isActiveInScenario);
  // 3. Modified JP or Name
  const modifiedSubjects = curriculums.filter((c) => {
    if (c.isCustomSubject || !c.isActiveInScenario) return false;
    return (
      c.jp_vii !== c.baseline_jp_vii ||
      c.jp_viii !== c.baseline_jp_viii ||
      c.jp_ix !== c.baseline_jp_ix
    );
  });
  // 4. Unchanged
  const unchangedSubjects = curriculums.filter((c) => {
    if (c.isCustomSubject || !c.isActiveInScenario) return false;
    return (
      c.jp_vii === c.baseline_jp_vii &&
      c.jp_viii === c.baseline_jp_viii &&
      c.jp_ix === c.baseline_jp_ix
    );
  });

  // Calculate totals
  const totalRancanganVii = curriculums.reduce((s, c) => s + (c.isActiveInScenario ? c.jp_vii : 0), 0);
  const totalBaselineVii = curriculums.reduce((s, c) => s + c.baseline_jp_vii, 0);

  const totalRancanganViii = curriculums.reduce((s, c) => s + (c.isActiveInScenario ? c.jp_viii : 0), 0);
  const totalBaselineViii = curriculums.reduce((s, c) => s + c.baseline_jp_viii, 0);

  const totalRancanganIx = curriculums.reduce((s, c) => s + (c.isActiveInScenario ? c.jp_ix : 0), 0);
  const totalBaselineIx = curriculums.reduce((s, c) => s + c.baseline_jp_ix, 0);

  return (
    <div className="space-y-6">
      {/* High-level Summary Comparison */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <GitCompare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Ringkasan Perbandingan: Baseline Operasional vs Rancangan Bayangan
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold block mb-1">
              Mapel Ditambahkan
            </span>
            <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">
              +{addedSubjects.length}
            </span>
          </div>

          <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-center">
            <span className="text-xs text-rose-700 dark:text-rose-400 font-bold block mb-1">
              Mapel Dinonaktifkan
            </span>
            <span className="text-2xl font-extrabold text-rose-800 dark:text-rose-300">
              -{removedSubjects.length}
            </span>
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-center">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-bold block mb-1">
              Mapel Berubah JP
            </span>
            <span className="text-2xl font-extrabold text-amber-800 dark:text-amber-300">
              {modifiedSubjects.length}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-lg text-center">
            <span className="text-xs text-slate-600 dark:text-zinc-400 font-bold block mb-1">
              Mapel Tetap (Sama)
            </span>
            <span className="text-2xl font-extrabold text-slate-800 dark:text-zinc-200">
              {unchangedSubjects.length}
            </span>
          </div>
        </div>
      </div>

      {/* Grade Level Total Differences Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 font-bold text-slate-900 dark:text-white flex items-center justify-between">
          <span>Perbandingan Total JP per Tingkat Kelas</span>
          <span className="text-xs text-slate-500 font-normal">
            Snapshot: {new Date(scenario.sourceSnapshotMeta.snapshotAt).toLocaleDateString("id-ID")}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 text-xs font-bold uppercase">
              <tr>
                <th className="py-3 px-4">Tingkat Kelas</th>
                <th className="py-3 px-4 text-center">Total JP Baseline Operasional</th>
                <th className="py-3 px-4 text-center">Total JP Rancangan Bayangan</th>
                <th className="py-3 px-4 text-center">Selisih JP</th>
                <th className="py-3 px-4">Keterangan Pembahasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {/* Kelas VII */}
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Kelas VII</td>
                <td className="py-3 px-4 text-center font-semibold text-slate-600">{totalBaselineVii} JP</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">{totalRancanganVii} JP</td>
                <td className="py-3 px-4 text-center font-bold">
                  {totalRancanganVii - totalBaselineVii === 0 ? (
                    <span className="text-slate-500">0 (Sama)</span>
                  ) : totalRancanganVii - totalBaselineVii > 0 ? (
                    <span className="text-emerald-600">+{totalRancanganVii - totalBaselineVii} JP</span>
                  ) : (
                    <span className="text-rose-600">{totalRancanganVii - totalBaselineVii} JP</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">
                  {totalRancanganVii - totalBaselineVii > 0
                    ? "Terdapat penambahan beban belajar mingguan"
                    : totalRancanganVii - totalBaselineVii < 0
                    ? "Terdapat efisiensi / pengurangan JP mingguan"
                    : "Beban total belajar tetap stabil"}
                </td>
              </tr>

              {/* Kelas VIII */}
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Kelas VIII</td>
                <td className="py-3 px-4 text-center font-semibold text-slate-600">{totalBaselineViii} JP</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">{totalRancanganViii} JP</td>
                <td className="py-3 px-4 text-center font-bold">
                  {totalRancanganViii - totalBaselineViii === 0 ? (
                    <span className="text-slate-500">0 (Sama)</span>
                  ) : totalRancanganViii - totalBaselineViii > 0 ? (
                    <span className="text-emerald-600">+{totalRancanganViii - totalBaselineViii} JP</span>
                  ) : (
                    <span className="text-rose-600">{totalRancanganViii - totalBaselineViii} JP</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">
                  {totalRancanganViii - totalBaselineViii > 0
                    ? "Terdapat penambahan beban belajar mingguan"
                    : totalRancanganViii - totalBaselineViii < 0
                    ? "Terdapat efisiensi / pengurangan JP mingguan"
                    : "Beban total belajar tetap stabil"}
                </td>
              </tr>

              {/* Kelas IX */}
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Kelas IX</td>
                <td className="py-3 px-4 text-center font-semibold text-slate-600">{totalBaselineIx} JP</td>
                <td className="py-3 px-4 text-center font-bold text-emerald-600">{totalRancanganIx} JP</td>
                <td className="py-3 px-4 text-center font-bold">
                  {totalRancanganIx - totalBaselineIx === 0 ? (
                    <span className="text-slate-500">0 (Sama)</span>
                  ) : totalRancanganIx - totalBaselineIx > 0 ? (
                    <span className="text-emerald-600">+{totalRancanganIx - totalBaselineIx} JP</span>
                  ) : (
                    <span className="text-rose-600">{totalRancanganIx - totalBaselineIx} JP</span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-slate-500">
                  {totalRancanganIx - totalBaselineIx > 0
                    ? "Terdapat penambahan beban belajar mingguan"
                    : totalRancanganIx - totalBaselineIx < 0
                    ? "Terdapat efisiensi / pengurangan JP mingguan"
                    : "Beban total belajar tetap stabil"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Subject Change Diff Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 font-bold text-slate-900 dark:text-white">
          Daftar Rincian Perubahan Mata Pelajaran & Alokasi JP
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 text-xs font-bold uppercase">
              <tr>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-3 text-center">Jenis Perubahan</th>
                <th className="py-3 px-3 text-center">Kelas VII (Lama → Baru)</th>
                <th className="py-3 px-3 text-center">Kelas VIII (Lama → Baru)</th>
                <th className="py-3 px-3 text-center">Kelas IX (Lama → Baru)</th>
                <th className="py-3 px-3 text-center">Total JP (Lama → Baru)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {/* Added Subjects */}
              {addedSubjects.map((sub) => (
                <tr key={sub.id} className="bg-emerald-50/40 dark:bg-emerald-950/10">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                    {sub.subjectName}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold">
                      Mapel Baru
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-xs">
                    0 JP → <strong className="text-emerald-700">{sub.jp_vii} JP</strong>
                  </td>
                  <td className="py-3 px-3 text-center text-xs">
                    0 JP → <strong className="text-emerald-700">{sub.jp_viii} JP</strong>
                  </td>
                  <td className="py-3 px-3 text-center text-xs">
                    0 JP → <strong className="text-emerald-700">{sub.jp_ix} JP</strong>
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-emerald-700">
                    +{sub.jp_vii + sub.jp_viii + sub.jp_ix} JP
                  </td>
                </tr>
              ))}

              {/* Modified Subjects */}
              {modifiedSubjects.map((sub) => {
                const oldTotal = sub.baseline_jp_vii + sub.baseline_jp_viii + sub.baseline_jp_ix;
                const newTotal = sub.jp_vii + sub.jp_viii + sub.jp_ix;

                return (
                  <tr key={sub.id} className="bg-amber-50/30 dark:bg-amber-950/10">
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      {sub.subjectName}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-bold">
                        Modifikasi JP
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      {sub.baseline_jp_vii} → <strong className="text-slate-900 dark:text-white">{sub.jp_vii} JP</strong>
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      {sub.baseline_jp_viii} → <strong className="text-slate-900 dark:text-white">{sub.jp_viii} JP</strong>
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      {sub.baseline_jp_ix} → <strong className="text-slate-900 dark:text-white">{sub.jp_ix} JP</strong>
                    </td>
                    <td className="py-3 px-3 text-center font-bold">
                      {oldTotal} → {newTotal} JP ({newTotal - oldTotal > 0 ? `+${newTotal - oldTotal}` : newTotal - oldTotal})
                    </td>
                  </tr>
                );
              })}

              {/* Removed / Inactive Subjects */}
              {removedSubjects.map((sub) => (
                <tr key={sub.id} className="bg-rose-50/40 dark:bg-rose-950/10 opacity-70">
                  <td className="py-3 px-4 font-semibold text-slate-700 dark:text-zinc-300 line-through">
                    {sub.subjectName}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-1 rounded-full font-bold">
                      Dinonaktifkan
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-xs">{sub.baseline_jp_vii} JP → 0 JP</td>
                  <td className="py-3 px-3 text-center text-xs">{sub.baseline_jp_viii} JP → 0 JP</td>
                  <td className="py-3 px-3 text-center text-xs">{sub.baseline_jp_ix} JP → 0 JP</td>
                  <td className="py-3 px-3 text-center font-bold text-rose-600">
                    -{sub.baseline_jp_vii + sub.baseline_jp_viii + sub.baseline_jp_ix} JP
                  </td>
                </tr>
              ))}

              {addedSubjects.length === 0 && modifiedSubjects.length === 0 && removedSubjects.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Struktur kurikulum rancangan saat ini masih identik 100% dengan snapshot operasional.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conflict Log Section */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Analisis Konflik & Validasi Jadwal Rancangan
          </h3>
          <span className="text-xs bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-bold">
            {conflicts.length} Masalah Terdeteksi
          </span>
        </div>

        {conflicts.length === 0 ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
              Tidak ada konflik jadwal! Semua guru, kelas, dan alokasi JP terpetakan secara konsisten.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            {conflicts.map((cf, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border text-sm flex items-start gap-3 ${
                  cf.severity === "error"
                    ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                    : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 text-amber-900 dark:text-amber-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <strong className="block text-xs uppercase tracking-wider">{cf.title}</strong>
                  <p className="text-xs mt-0.5 opacity-90">{cf.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
