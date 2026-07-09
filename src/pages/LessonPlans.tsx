import React, { useState, useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { classService } from "../services/classService";
import { semesterService } from "../services/semester.service";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { lessonPlanService } from "../services/lessonPlan.service";
import type { Class, Semester, CurriculumMatrix, LessonPlan } from "../types";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  ExternalLink, 
  Search, 
  Info,
  Calendar,
  School,
  BookOpen,
  Filter,
  Save,
  X,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const LessonPlans: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Master Data States
  const [classes, setClasses] = useState<Class[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [curriculumMatrix, setCurriculumMatrix] = useState<CurriculumMatrix[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);

  // Selection Filters
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Loaded Modul Ajar data
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(false);

  // UI Interactive States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null);

  // Form States
  const [formTitle, setFormTitle] = useState("");
  const [formClassId, setFormClassId] = useState("");
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formSemesterId, setFormSemesterId] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const currentRole = user?.role?.toLowerCase() || "";
  const isGuru = user?.roles?.includes("guru") || currentRole === "guru";

  // Load classes, semesters, matrix
  useEffect(() => {
    setLoading(true);
    Promise.all([
      classService.getClasses(),
      semesterService.getSemesters(),
      curriculumMatrixService.getCurriculumMatrix()
    ])
      .then(([clsList, semList, matrixList]) => {
        const activeCls = clsList.filter(c => c.status === "Aktif" && !c.isDeleted);
        setClasses(activeCls);
        setSemesters(semList);
        setCurriculumMatrix(matrixList);

        // Group unique academic years from semesters
        const yearsMap = new Map<string, string>();
        semList.forEach(s => {
          yearsMap.set(s.academicYearId, s.academicYearName);
        });
        const yearsArray = Array.from(yearsMap.entries()).map(([id, name]) => ({ id, name }));
        setAcademicYears(yearsArray);

        // Select defaults
        const activeSem = semList.find(s => s.isActive);
        if (activeSem) {
          setSelectedAcademicYearId(activeSem.academicYearId);
          setSelectedSemesterId(activeSem.id);
        } else {
          if (yearsArray.length > 0) setSelectedAcademicYearId(yearsArray[0].id);
          if (semList.length > 0) setSelectedSemesterId(semList[0].id);
        }
      })
      .catch((err) => showToast("Gagal memuat master data: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  // Filter offered subjects for selected class
  const selectedClassObj = classes.find(c => c.id === selectedClassId);
  const gradeLevel = selectedClassObj?.gradeLevel || "VII";

  const allOfferedSubjects = curriculumMatrix.map(m => ({
    id: m.subjectId,
    name: m.subjectName,
    teacherId: m.teacherId,
    teacherName: m.teacherName,
    jp: gradeLevel === "VII" ? m.jp_vii : gradeLevel === "VIII" ? m.jp_viii : m.jp_ix
  })).filter(s => s.jp > 0);

  const offeredSubjects = isGuru
    ? allOfferedSubjects.filter(s => s.teacherId === user?.teacherId)
    : allOfferedSubjects;

  // Filter offered subjects for modal form
  const modalClassObj = classes.find(c => c.id === formClassId);
  const modalGradeLevel = modalClassObj?.gradeLevel || "VII";
  const modalOfferedSubjects = curriculumMatrix.map(m => ({
    id: m.subjectId,
    name: m.subjectName,
    teacherId: m.teacherId,
    teacherName: m.teacherName,
    jp: modalGradeLevel === "VII" ? m.jp_vii : modalGradeLevel === "VIII" ? m.jp_viii : m.jp_ix
  })).filter(s => s.jp > 0);

  // Fetch Lesson Plans
  const fetchLessonPlans = () => {
    setLoading(true);
    lessonPlanService.getLessonPlans({
      academicYearId: selectedAcademicYearId || undefined,
      semesterId: selectedSemesterId || undefined,
      classId: selectedClassId || undefined,
      subjectId: selectedSubjectId || undefined,
      teacherId: isGuru ? (user?.teacherId || undefined) : undefined
    })
      .then((data) => {
        setLessonPlans(data);
      })
      .catch((err) => showToast("Gagal memuat daftar Modul Ajar: " + err.message, "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLessonPlans();
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setFormTitle("");
    setFormLink("");
    setFormDescription("");

    // Set default selections
    if (classes.length > 0) setFormClassId(selectedClassId || classes[0].id);
    if (offeredSubjects.length > 0) setFormSubjectId(selectedSubjectId || offeredSubjects[0].id);
    if (semesters.length > 0) setFormSemesterId(selectedSemesterId || semesters[0].id);

    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (plan: LessonPlan) => {
    setEditingPlan(plan);
    setFormTitle(plan.title);
    setFormClassId(plan.classId);
    setFormSubjectId(plan.subjectId);
    setFormSemesterId(plan.semesterId);
    setFormLink(plan.link);
    setFormDescription(plan.description || "");
    setIsModalOpen(true);
  };

  // Save / Update Modul Ajar
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formTitle.trim()) {
      showToast("Judul Modul Ajar harus diisi", "error");
      return;
    }
    if (!formLink.trim()) {
      showToast("Link Referensi dokumen harus diisi", "error");
      return;
    }
    if (!formClassId || !formSubjectId || !formSemesterId) {
      showToast("Mata Pelajaran, Kelas, dan Semester harus dipilih", "error");
      return;
    }

    // Validate link format
    try {
      new URL(formLink);
    } catch (_) {
      showToast("Format link tidak valid. Harap masukkan URL lengkap (contoh: https://...) ", "error");
      return;
    }

    setLoading(true);
    try {
      const clsObj = classes.find(c => c.id === formClassId);
      const semObj = semesters.find(s => s.id === formSemesterId);
      const subObj = curriculumMatrix.find(m => m.subjectId === formSubjectId);

      const targetSubjectName = subObj?.subjectName || "";
      const targetClassName = clsObj?.name || "";
      const targetSemesterName = semObj?.name || "";
      const targetAcademicYearName = semObj?.academicYearName || "";
      const targetAcademicYearId = semObj?.academicYearId || "";

      await lessonPlanService.saveLessonPlan({
        id: editingPlan?.id,
        teacherId: isGuru ? (user?.teacherId || "") : (subObj?.teacherId || ""),
        teacherName: isGuru ? (user?.displayName || "") : (subObj?.teacherName || "Belum Ditentukan"),
        academicYearId: targetAcademicYearId,
        academicYearName: targetAcademicYearName,
        semesterId: formSemesterId,
        semesterName: targetSemesterName,
        classId: formClassId,
        className: targetClassName,
        subjectId: formSubjectId,
        subjectName: targetSubjectName,
        title: formTitle,
        link: formLink,
        description: formDescription,
        createdBy: editingPlan?.createdBy || user?.uid || "",
        updatedBy: user?.uid || ""
      }, user?.uid || "", user?.displayName || "");

      showToast(`Modul Ajar "${formTitle}" berhasil disimpan!`, "success");
      setIsModalOpen(false);
      fetchLessonPlans();
    } catch (err: any) {
      showToast("Gagal menyimpan Modul Ajar: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete Modul Ajar
  const handleDelete = async (plan: LessonPlan) => {
    if (confirm(`Apakah Anda yakin ingin menghapus referensi Modul Ajar "${plan.title}"?`)) {
      setLoading(true);
      try {
        await lessonPlanService.deleteLessonPlan(plan.id, user?.uid || "", user?.displayName || "", plan.title);
        showToast("Referensi Modul Ajar berhasil dihapus", "success");
        fetchLessonPlans();
      } catch (err: any) {
        showToast("Gagal menghapus Modul Ajar: " + err.message, "error");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-zinc-100 uppercase tracking-tight">Modul Ajar & RPP</h1>
            <p className="text-xs text-slate-400 mt-0.5">Pengelola referensi link dokumen modul ajar kurikulum sekolah terintegrasi.</p>
          </div>
        </div>
        
        {isGuru && (
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm shadow-blue-900/10 hover:shadow-md cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Unggah Modul Ajar
          </button>
        )}
      </div>

      {/* Navigation Filter Sidebar / Panel */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <Filter className="h-4 w-4 text-blue-500" /> Filter Pencarian Referensi
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Tahun Pelajaran */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tahun Pelajaran</label>
            <div className="relative">
              <select
                value={selectedAcademicYearId}
                onChange={(e) => setSelectedAcademicYearId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-750/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="">Semua Tahun Pelajaran</option>
                {academicYears.map(y => (
                  <option key={y.id} value={y.id}>TP {y.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Semester</label>
            <div className="relative">
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-750/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="">Semua Semester</option>
                {semesters
                  .filter(s => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.name} (TP {s.academicYearName})</option>
                  ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Kelas */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kelas</label>
            <div className="relative">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-750/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Mata Pelajaran */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mata Pelajaran</label>
            <div className="relative">
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/80 dark:bg-zinc-850 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-750/80 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
              >
                <option value="">Semua Mata Pelajaran</option>
                {offeredSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.teacherName})</option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main List Display Grid */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
          <div className="h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          <span className="text-xs text-slate-400 font-medium">Memproses data referensi...</span>
        </div>
      ) : lessonPlans.length === 0 ? (
        <div className="h-80 flex flex-col items-center justify-center gap-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
          <div className="h-16 w-16 bg-slate-50 dark:bg-zinc-800 rounded-full flex items-center justify-center">
            <FileText className="h-8 w-8 text-slate-300" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-zinc-300">Belum Ada Referensi Modul Ajar</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Tidak ditemukan dokumen modul ajar yang cocok dengan filter yang Anda gunakan.</p>
          </div>
          {isGuru && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Mulai Unggah Referensi Baru
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessonPlans.map((plan) => (
            <motion.div
              layout
              key={plan.id}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="space-y-3.5">
                {/* Visual Accent */}
                <div className="flex items-center justify-between">
                  <div className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase tracking-wider w-fit">
                    {plan.className}
                  </div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">
                    {plan.semesterName}
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 line-clamp-2 leading-snug">
                    {plan.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                    <BookOpen className="h-3.5 w-3.5 text-blue-500" /> {plan.subjectName}
                  </div>
                </div>

                {plan.description && (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 line-clamp-3 leading-relaxed">
                    {plan.description}
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-zinc-850/80 pt-4 mt-5 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="truncate">Oleh: <strong className="text-slate-600 dark:text-zinc-300 font-bold">{plan.teacherName}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={plan.link}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-zinc-750/60"
                  >
                    Buka Dokumen <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* Edit/Delete Actions (Only Creator or Admin or Wakakur) */}
                  {(user?.uid === plan.createdBy || !isGuru) && (
                    <>
                      <button
                        onClick={() => handleOpenEditModal(plan)}
                        className="p-2 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 border border-slate-150 dark:border-zinc-750/50 rounded-xl transition-all cursor-pointer"
                        title="Edit Referensi"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 border border-rose-100 dark:border-rose-900/30 rounded-xl transition-all cursor-pointer"
                        title="Hapus Referensi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload/Edit Modal Dialogue */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-150 dark:border-zinc-800 max-w-lg w-full overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-850/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-zinc-100 tracking-tight">
                      {editingPlan ? "Ubah Referensi Modul Ajar" : "Unggah Referensi Modul Ajar"}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Lengkapi formulir untuk menyimpan link referensi dokumen</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Judul */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Judul Modul / RPP *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Contoh: Modul Ajar Matematika - Bab 1 Aljabar"
                    className="w-full bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Grid Form Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Kelas */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kelas *</label>
                    <div className="relative">
                      <select
                        required
                        value={formClassId}
                        onChange={(e) => setFormClassId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-150 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
                      >
                        <option value="">Pilih Kelas</option>
                        {classes.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Semester */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Semester *</label>
                    <div className="relative">
                      <select
                        required
                        value={formSemesterId}
                        onChange={(e) => setFormSemesterId(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-150 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
                      >
                        <option value="">Pilih Semester</option>
                        {semesters.map(s => (
                          <option key={s.id} value={s.id}>{s.name} (TP {s.academicYearName})</option>
                        ))}
                      </select>
                      <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Mata Pelajaran */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mata Pelajaran *</label>
                  <div className="relative">
                    <select
                      required
                      value={formSubjectId}
                      onChange={(e) => setFormSubjectId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-150 focus:outline-hidden focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer appearance-none"
                    >
                      <option value="">Pilih Mata Pelajaran</option>
                      {modalOfferedSubjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.teacherName})</option>
                      ))}
                    </select>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Link Dokumen */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Link Referensi Dokumen *</label>
                  <input
                    type="url"
                    required
                    value={formLink}
                    onChange={(e) => setFormLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <p className="text-[9px] text-slate-400">Masukkan link dari penyimpanan cloud seperti Google Drive, OneDrive, Dropbox, PMM, dll.</p>
                </div>

                {/* Deskripsi */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Deskripsi / Catatan Tambahan (Opsional)</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={3}
                    placeholder="Masukkan materi pokok, topik pembahasan, kompetensi dasar, atau catatan tambahan..."
                    className="w-full bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all resize-none"
                  />
                </div>

                {/* Modal Actions */}
                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-zinc-850/80">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs shadow-blue-950/10 cursor-pointer"
                  >
                    <Save className="h-3.5 w-3.5" /> Simpan Referensi
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
