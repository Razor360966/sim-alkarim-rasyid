import React, { useState } from "react";
import { 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  AlertCircle, 
  BookOpen, 
  ArrowUpDown, 
  Sparkles,
  TrendingUp,
  Layers,
  HelpCircle
} from "lucide-react";
import { ScenarioCurriculumMatrix, ScenarioSubject } from "../types";

interface Props {
  curriculums: ScenarioCurriculumMatrix[];
  subjects: ScenarioSubject[];
  onUpdateItem: (item: ScenarioCurriculumMatrix) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onAddCustomSubject: (data: {
    name: string;
    code: string;
    group: "A" | "B" | "C";
    jp_vii: number;
    jp_viii: number;
    jp_ix: number;
  }) => Promise<void>;
  isReadOnly?: boolean;
}

export const ScenarioCurriculumEditor: React.FC<Props> = ({
  curriculums,
  subjects,
  onUpdateItem,
  onToggleActive,
  onAddCustomSubject,
  isReadOnly = false
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    jp_vii: number;
    jp_viii: number;
    jp_ix: number;
    subjectName: string;
    subjectGroup: "A" | "B" | "C";
  }>({
    jp_vii: 0,
    jp_viii: 0,
    jp_ix: 0,
    subjectName: "",
    subjectGroup: "A"
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubForm, setNewSubForm] = useState({
    name: "",
    code: "",
    group: "A" as "A" | "B" | "C",
    jp_vii: 2,
    jp_viii: 2,
    jp_ix: 2
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Totals
  const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);
  const totalVii = activeCurriculums.reduce((s, c) => s + (c.jp_vii || 0), 0);
  const totalViii = activeCurriculums.reduce((s, c) => s + (c.jp_viii || 0), 0);
  const totalIx = activeCurriculums.reduce((s, c) => s + (c.jp_ix || 0), 0);

  const baselineVii = curriculums.reduce((s, c) => s + (c.baseline_jp_vii || 0), 0);
  const baselineViii = curriculums.reduce((s, c) => s + (c.baseline_jp_viii || 0), 0);
  const baselineIx = curriculums.reduce((s, c) => s + (c.baseline_jp_ix || 0), 0);

  const startEdit = (c: ScenarioCurriculumMatrix) => {
    if (isReadOnly) return;
    setEditingId(c.id);
    setEditForm({
      jp_vii: c.jp_vii || 0,
      jp_viii: c.jp_viii || 0,
      jp_ix: c.jp_ix || 0,
      subjectName: c.subjectName || "",
      subjectGroup: c.subjectGroup || "A"
    });
  };

  const saveEdit = async (originalItem: ScenarioCurriculumMatrix) => {
    try {
      setIsSubmitting(true);
      await onUpdateItem({
        ...originalItem,
        jp_vii: Math.max(0, Number(editForm.jp_vii) || 0),
        jp_viii: Math.max(0, Number(editForm.jp_viii) || 0),
        jp_ix: Math.max(0, Number(editForm.jp_ix) || 0),
        subjectName: editForm.subjectName.trim() || originalItem.subjectName,
        subjectGroup: editForm.subjectGroup
      });
      setEditingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubForm.name.trim()) return;
    try {
      setIsSubmitting(true);
      await onAddCustomSubject({
        name: newSubForm.name.trim(),
        code: newSubForm.code.trim() || "SIM-MAPEL",
        group: newSubForm.group,
        jp_vii: Math.max(0, Number(newSubForm.jp_vii) || 0),
        jp_viii: Math.max(0, Number(newSubForm.jp_viii) || 0),
        jp_ix: Math.max(0, Number(newSubForm.jp_ix) || 0)
      });
      setShowAddModal(false);
      setNewSubForm({
        name: "",
        code: "",
        group: "A",
        jp_vii: 2,
        jp_viii: 2,
        jp_ix: 2
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards: Total JP comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kelas VII */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total JP Kelas VII</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rancangan vs Baseline</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalVii}</span>
            <span className="text-sm text-slate-500 dark:text-zinc-400">JP / pekan</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-auto ${
              totalVii > baselineVii 
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" 
                : totalVii < baselineVii 
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}>
              {totalVii - baselineVii > 0 ? `+${totalVii - baselineVii}` : totalVii - baselineVii} JP dari Master ({baselineVii})
            </span>
          </div>
        </div>

        {/* Kelas VIII */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total JP Kelas VIII</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rancangan vs Baseline</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalViii}</span>
            <span className="text-sm text-slate-500 dark:text-zinc-400">JP / pekan</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-auto ${
              totalViii > baselineViii 
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" 
                : totalViii < baselineViii 
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}>
              {totalViii - baselineViii > 0 ? `+${totalViii - baselineViii}` : totalViii - baselineViii} JP dari Master ({baselineViii})
            </span>
          </div>
        </div>

        {/* Kelas IX */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total JP Kelas IX</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rancangan vs Baseline</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">{totalIx}</span>
            <span className="text-sm text-slate-500 dark:text-zinc-400">JP / pekan</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-auto ${
              totalIx > baselineIx 
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400" 
                : totalIx < baselineIx 
                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}>
              {totalIx - baselineIx > 0 ? `+${totalIx - baselineIx}` : totalIx - baselineIx} JP dari Master ({baselineIx})
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 border border-slate-200 dark:border-zinc-800 rounded-xl">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Matriks Struktur Kurikulum Bayangan
          </h3>
          <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
            {curriculums.length} Mapel ({activeCurriculums.length} Aktif)
          </span>
        </div>

        {!isReadOnly && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Tambah Mapel Khusus Rancangan
          </button>
        )}
      </div>

      {/* Curriculum Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-3 text-center">Kelompok</th>
                <th className="py-3 px-3 text-center w-24">JP Kelas VII</th>
                <th className="py-3 px-3 text-center w-24">JP Kelas VIII</th>
                <th className="py-3 px-3 text-center w-24">JP Kelas IX</th>
                <th className="py-3 px-3 text-center w-28">Total JP Rancangan</th>
                <th className="py-3 px-3 text-center w-28">Baseline Master</th>
                <th className="py-3 px-3 text-center">Status</th>
                {!isReadOnly && <th className="py-3 px-4 text-center w-32">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {curriculums.map((item, index) => {
                const isEditing = editingId === item.id;
                const totalItemJp = (item.jp_vii || 0) + (item.jp_viii || 0) + (item.jp_ix || 0);
                const totalBaseline = (item.baseline_jp_vii || 0) + (item.baseline_jp_viii || 0) + (item.baseline_jp_ix || 0);
                const hasDiff = totalItemJp !== totalBaseline || item.isCustomSubject;

                return (
                  <tr 
                    key={item.id}
                    className={`hover:bg-slate-50/50 dark:hover:bg-zinc-850/50 transition-colors ${
                      !item.isActiveInScenario ? "opacity-40 bg-slate-50/30 dark:bg-zinc-950/40" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-medium text-slate-500">
                      {index + 1}
                    </td>

                    {/* Subject Name */}
                    <td className="py-3 px-4">
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editForm.subjectName}
                            onChange={(e) => setEditForm({ ...editForm, subjectName: e.target.value })}
                            className="w-full text-sm font-semibold border border-emerald-500 rounded px-2 py-1 bg-white dark:bg-zinc-800 dark:text-white"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Kelompok:</span>
                            <select
                              value={editForm.subjectGroup}
                              onChange={(e) => setEditForm({ ...editForm, subjectGroup: e.target.value as any })}
                              className="text-xs border border-slate-300 dark:border-zinc-700 rounded px-1.5 py-0.5 bg-white dark:bg-zinc-800 dark:text-white"
                            >
                              <option value="A">Kelompok A (Wajib)</option>
                              <option value="B">Kelompok B (Pilihan)</option>
                              <option value="C">Kelompok C (Muatan Lokal)</option>
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {item.subjectName}
                            </span>
                            {item.isCustomSubject && (
                              <span className="bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 text-xs px-2 py-0.5 rounded font-bold">
                                Mapel Baru Simulasi
                              </span>
                            )}
                          </div>
                          {item.teacherName && (
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                              Guru: {item.teacherName}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Group */}
                    <td className="py-3 px-3 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        Kel. {isEditing ? editForm.subjectGroup : item.subjectGroup || "A"}
                      </span>
                    </td>

                    {/* JP VII */}
                    <td className="py-3 px-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={editForm.jp_vii}
                          onChange={(e) => setEditForm({ ...editForm, jp_vii: Number(e.target.value) })}
                          className="w-16 text-center border border-emerald-500 rounded px-2 py-1 bg-white dark:bg-zinc-800 dark:text-white font-bold"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-slate-800 dark:text-zinc-200">{item.jp_vii}</span>
                          {item.jp_vii !== item.baseline_jp_vii && (
                            <span className={`text-[10px] font-bold ${item.jp_vii > item.baseline_jp_vii ? "text-emerald-600" : "text-rose-600"}`}>
                              ({item.jp_vii > item.baseline_jp_vii ? `+${item.jp_vii - item.baseline_jp_vii}` : item.jp_vii - item.baseline_jp_vii})
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* JP VIII */}
                    <td className="py-3 px-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={editForm.jp_viii}
                          onChange={(e) => setEditForm({ ...editForm, jp_viii: Number(e.target.value) })}
                          className="w-16 text-center border border-emerald-500 rounded px-2 py-1 bg-white dark:bg-zinc-800 dark:text-white font-bold"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-slate-800 dark:text-zinc-200">{item.jp_viii}</span>
                          {item.jp_viii !== item.baseline_jp_viii && (
                            <span className={`text-[10px] font-bold ${item.jp_viii > item.baseline_jp_viii ? "text-emerald-600" : "text-rose-600"}`}>
                              ({item.jp_viii > item.baseline_jp_viii ? `+${item.jp_viii - item.baseline_jp_viii}` : item.jp_viii - item.baseline_jp_viii})
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* JP IX */}
                    <td className="py-3 px-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={editForm.jp_ix}
                          onChange={(e) => setEditForm({ ...editForm, jp_ix: Number(e.target.value) })}
                          className="w-16 text-center border border-emerald-500 rounded px-2 py-1 bg-white dark:bg-zinc-800 dark:text-white font-bold"
                        />
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-slate-800 dark:text-zinc-200">{item.jp_ix}</span>
                          {item.jp_ix !== item.baseline_jp_ix && (
                            <span className={`text-[10px] font-bold ${item.jp_ix > item.baseline_jp_ix ? "text-emerald-600" : "text-rose-600"}`}>
                              ({item.jp_ix > item.baseline_jp_ix ? `+${item.jp_ix - item.baseline_jp_ix}` : item.jp_ix - item.baseline_jp_ix})
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Total JP in Scenario */}
                    <td className="py-3 px-3 text-center font-bold text-slate-900 dark:text-white">
                      {isEditing 
                        ? (Number(editForm.jp_vii) || 0) + (Number(editForm.jp_viii) || 0) + (Number(editForm.jp_ix) || 0) 
                        : totalItemJp
                      } JP
                    </td>

                    {/* Baseline Master */}
                    <td className="py-3 px-3 text-center text-slate-500 text-xs">
                      {item.isCustomSubject ? (
                        <span className="italic text-slate-400">Tidak ada (Baru)</span>
                      ) : (
                        <span>{totalBaseline} JP ({item.baseline_jp_vii}/{item.baseline_jp_viii}/{item.baseline_jp_ix})</span>
                      )}
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-3 text-center">
                      {item.isActiveInScenario ? (
                        <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs px-2.5 py-1 rounded-full font-semibold">
                          Aktif
                        </span>
                      ) : (
                        <span className="bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-400 text-xs px-2.5 py-1 rounded-full font-semibold">
                          Dinonaktifkan
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    {!isReadOnly && (
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(item)}
                                disabled={isSubmitting}
                                className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors"
                                title="Simpan Perubahan"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded hover:bg-slate-300 transition-colors"
                                title="Batal"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(item)}
                                className="text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded transition-colors"
                              >
                                Edit JP
                              </button>

                              <button
                                onClick={() => onToggleActive(item.id, !item.isActiveInScenario)}
                                className={`p-1.5 rounded transition-colors ${
                                  item.isActiveInScenario
                                    ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                    : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                }`}
                                title={item.isActiveInScenario ? "Nonaktifkan dari Rancangan" : "Aktifkan Kembali"}
                              >
                                {item.isActiveInScenario ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Custom Subject Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                Tambah Mata Pelajaran Khusus Rancangan
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Mata pelajaran ini hanya ada di rancangan simulasi ini dan <strong>tidak akan</strong> mengubah Master Mata Pelajaran operasional SIMAK.
            </p>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                  Nama Mata Pelajaran
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Robotika & Kecerdasan Buatan"
                  value={newSubForm.name}
                  onChange={(e) => setNewSubForm({ ...newSubForm, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Kode Singkat
                  </label>
                  <input
                    type="text"
                    placeholder="ROBOT"
                    value={newSubForm.code}
                    onChange={(e) => setNewSubForm({ ...newSubForm, code: e.target.value })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase mb-1">
                    Kelompok
                  </label>
                  <select
                    value={newSubForm.group}
                    onChange={(e) => setNewSubForm({ ...newSubForm, group: e.target.value as any })}
                    className="w-full text-sm border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="A">Kelompok A (Wajib)</option>
                    <option value="B">Kelompok B (Pilihan)</option>
                    <option value="C">Kelompok C (Muatan Lokal)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-200 dark:border-zinc-700">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1 text-center">
                    JP Kelas VII
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={newSubForm.jp_vii}
                    onChange={(e) => setNewSubForm({ ...newSubForm, jp_vii: Number(e.target.value) })}
                    className="w-full text-center text-sm font-bold border border-slate-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1 text-center">
                    JP Kelas VIII
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={newSubForm.jp_viii}
                    onChange={(e) => setNewSubForm({ ...newSubForm, jp_viii: Number(e.target.value) })}
                    className="w-full text-center text-sm font-bold border border-slate-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-zinc-400 mb-1 text-center">
                    JP Kelas IX
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={newSubForm.jp_ix}
                    onChange={(e) => setNewSubForm({ ...newSubForm, jp_ix: Number(e.target.value) })}
                    className="w-full text-center text-sm font-bold border border-slate-300 dark:border-zinc-600 rounded px-2 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs"
                >
                  {isSubmitting ? "Menambahkan..." : "Tambahkan ke Rancangan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
