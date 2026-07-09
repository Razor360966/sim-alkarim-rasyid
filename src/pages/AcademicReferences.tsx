import React, { useState, useEffect } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { AcademicReference } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  Filter, 
  Database, 
  RefreshCw,
  Info,
  CheckCircle,
  XCircle,
  Save,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const CATEGORIES = [
  "Kategori Event",
  "Status Hari",
  "Jenis Hari",
  "Jenis Penilaian",
  "Jenis Jurnal",
  "Status Pembelajaran",
  "Jenis Kegiatan Akademik",
  "Jenis Libur",
  "Jenis Asesmen",
  "Kategori Kalender"
];

export const AcademicReferences: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [references, setReferences] = useState<AcademicReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Kategori Event");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: "Kategori Event",
    code: "",
    name: ""
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch references on mount
  const fetchRefs = async () => {
    setLoading(true);
    try {
      const data = await academicPlanningService.getReferences();
      setReferences(data);
    } catch (error: any) {
      showToast("Gagal memuat referensi: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefs();
  }, []);

  const filteredRefs = references.filter((ref) => {
    const matchesCategory = ref.category === selectedCategory;
    const matchesSearch = 
      ref.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({
      category: selectedCategory,
      code: "",
      name: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ref: AcademicReference) => {
    setEditingId(ref.id);
    setFormData({
      category: ref.category,
      code: ref.code,
      name: ref.name
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus referensi ini? Modul lain yang menggunakannya mungkin akan terpengaruh.")) return;
    try {
      await academicPlanningService.deleteReference(id, user?.uid || "", user?.displayName || "System");
      showToast("Referensi berhasil dihapus", "success");
      fetchRefs();
    } catch (error: any) {
      showToast("Gagal menghapus referensi: " + error.message, "error");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      showToast("Semua field wajib diisi", "error");
      return;
    }

    setSubmitting(true);
    try {
      const refCode = formData.code.toUpperCase().replace(/\s+/g, "_");
      if (editingId) {
        await academicPlanningService.updateReference(
          editingId, 
          { name: formData.name, code: refCode, category: formData.category },
          user?.uid || "",
          user?.displayName || "System"
        );
        showToast("Referensi berhasil diperbarui", "success");
      } else {
        await academicPlanningService.addReference(
          { category: formData.category, code: refCode, name: formData.name },
          user?.uid || "",
          user?.displayName || "System"
        );
        showToast("Referensi berhasil ditambahkan", "success");
      }
      setIsModalOpen(false);
      fetchRefs();
    } catch (error: any) {
      showToast("Gagal menyimpan referensi: " + error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="academic-references-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Master Referensi Akademik</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Sumber data tunggal (Single Source of Truth) untuk kategori event, status, penilaian, dan administrasi akademik.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchRefs}
            className="p-2.5 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 shadow-xs cursor-pointer"
            title="Muat Ulang"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/10 cursor-pointer text-sm"
          >
            <Plus className="h-4.5 w-4.5" />
            Tambah Referensi
          </button>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category List Panel */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Kategori Referensi
          </h3>
          <div className="space-y-1">
            {CATEGORIES.map((cat) => {
              const count = references.filter(r => r.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all cursor-pointer ${
                    isSelected 
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50" 
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    isSelected ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" : "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* References Table Panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Cari referensi (Nama atau Kode)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
              <Database className="h-4 w-4 text-blue-500" />
              <span>Koleksi database: <strong className="text-slate-700 dark:text-zinc-200">academic_reference</strong></span>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-slate-500 dark:text-zinc-400">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-sm font-medium">Memuat data referensi...</p>
              </div>
            ) : filteredRefs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-zinc-400">
                <Info className="h-8 w-8 mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
                <p className="text-sm font-medium">Belum ada data di kategori "{selectedCategory}"</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Silakan tambahkan data referensi baru.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">No</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Kode Referensi</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Nama Display</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Dibuat Tanggal</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {filteredRefs.map((ref, idx) => (
                      <tr key={ref.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="p-4 text-sm text-slate-500 dark:text-zinc-400 font-medium">{idx + 1}</td>
                        <td className="p-4 text-sm font-mono text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/10 px-2 py-1 rounded-md inline-block mt-2 ml-4">
                          {ref.code}
                        </td>
                        <td className="p-4 text-sm font-semibold text-slate-800 dark:text-zinc-200">{ref.name}</td>
                        <td className="p-4 text-xs text-slate-400 dark:text-zinc-500">
                          {ref.createdAt ? new Date(ref.createdAt).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "-"}
                        </td>
                        <td className="p-4 text-sm text-right space-x-1.5">
                          <button
                            onClick={() => handleOpenEdit(ref)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer inline-flex"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ref.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer inline-flex"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DIALOG */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-150 dark:border-zinc-800 pb-3 mb-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50">
                  {editingId ? "Edit Referensi" : "Tambah Referensi"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Kategori Referensi
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                    disabled={!!editingId}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Kode Referensi (Unique Code)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., EVENT_KBM, LIBUR_NASIONAL, JH_PEMBELAJARAN"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 uppercase"
                    disabled={!!editingId}
                  />
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    Gunakan huruf kapital dengan format SNAKE_CASE.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                    Nama Display (Label)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g., Kegiatan Belajar Mengajar, Libur Nasional"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-sm cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-md shadow-blue-500/10 cursor-pointer text-sm disabled:opacity-55"
                  >
                    <Save className="h-4 w-4" />
                    {submitting ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicReferences;
