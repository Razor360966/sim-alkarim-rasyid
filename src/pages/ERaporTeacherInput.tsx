import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { scheduleService } from "../services/schedule.service";
import { studentService } from "../services/studentService";
import { eRaporService } from "../services/eRapor.service";
import { extracurricularService } from "../services/extracurricular.service";
import { AcademicYear, Semester, Class, Subject, Student } from "../types";
import { isStudentActive } from "../utils/studentHelper";
import {
  ERaporTp,
  ERaporAssessment,
  ERaporAssessmentTpItem,
  ERaporSettingsConfig,
  ERaporClassVerification,
  ERaporPondokAssessment,
  ERaporExtracurricular,
  ERaporExtracurricularAssessment
} from "../types/eRapor.types";
import {
  BookOpen,
  Filter,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Edit,
  Sparkles,
  Info,
  Award,
  Layers
} from "lucide-react";

import {
  getSubjectCategoryType,
  getSubjectGroupType,
  isSubjectReportVisible
} from "../utils/subjectHelper";

export default function ERaporTeacherInput() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Mode Selection State
  const [inputMode, setInputMode] = useState<"MAPEL" | "EKSKUL">("MAPEL");

  // Filters State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [extracurriculars, setExtracurriculars] = useState<ERaporExtracurricular[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedEkskulId, setSelectedEkskulId] = useState<string>("");

  // Loaded Data
  const [students, setStudents] = useState<Student[]>([]);
  const [tps, setTps] = useState<ERaporTp[]>([]);
  const [assessmentsMap, setAssessmentsMap] = useState<Map<string, ERaporAssessment>>(new Map());
  const [pondokAssessmentsMap, setPondokAssessmentsMap] = useState<Map<string, ERaporPondokAssessment>>(new Map());
  const [ekskulAssessmentsMap, setEkskulAssessmentsMap] = useState<Map<string, ERaporExtracurricularAssessment>>(new Map());

  const [settings, setSettings] = useState<ERaporSettingsConfig>({ tpWeight: 60, utsWeight: 20, sasWeight: 20, isOpen: true });
  const [verification, setVerification] = useState<ERaporClassVerification | null>(null);

  // UI States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showTpModal, setShowTpModal] = useState<boolean>(false);
  const [newTpTitle, setNewTpTitle] = useState<string>("");
  const [showRequestChangeModal, setShowRequestChangeModal] = useState<boolean>(false);
  const [requestReason, setRequestReason] = useState<string>("");

  const isTeacherRole = user?.role === "guru";
  const isClassLocked = verification?.status === "LOCKED" || verification?.status === "TERVERIFIKASI";

  // Selected Subject Details
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  const isPondokSubject = useMemo(() => {
    if (!selectedSubject) return false;
    return getSubjectGroupType(selectedSubject) === "KEPESANTRENAN";
  }, [selectedSubject]);

  // 1. Initial Master Data Fetching
  useEffect(() => {
    async function loadMasters() {
      try {
        const [years, sems, cfg, ekskuls] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters(),
          eRaporService.getSettings(),
          extracurricularService.getExtracurriculars()
        ]);

        setAcademicYears(years);
        setSemesters(sems);
        setSettings(cfg);
        setExtracurriculars(ekskuls);

        const activeYr = years.find((y) => y.isActive) || years[0];
        const activeSem = sems.find((s) => s.isActive) || sems[0];

        if (activeYr) setSelectedAcademicYearId(activeYr.id!);
        if (activeSem) setSelectedSemesterId(activeSem.id!);
        if (ekskuls.length > 0) setSelectedEkskulId(ekskuls[0].id!);
      } catch (e) {
        console.error("Error loading master filters:", e);
      }
    }
    loadMasters();
  }, []);

  // 2. Fetch Classes based on Role & Year/Semester
  useEffect(() => {
    async function loadClasses() {
      if (!selectedAcademicYearId || !selectedSemesterId) return;
      try {
        const allClasses = await classService.getClasses();
        if (isTeacherRole && user?.uid) {
          const allScheds = await scheduleService.getSchedules(selectedAcademicYearId, selectedSemesterId);
          const teacherScheds = allScheds.filter((s) => s.teacherId === user.uid);
          const classIds = new Set(teacherScheds.map((s) => s.classId));
          const filtered = allClasses.filter((c) => classIds.has(c.id!) || c.homeroomTeacherId === user.uid);
          setClasses(filtered.length > 0 ? filtered : allClasses);
          if (filtered.length > 0) setSelectedClassId(filtered[0].id!);
        } else {
          setClasses(allClasses);
          if (allClasses.length > 0) setSelectedClassId(allClasses[0].id!);
        }
      } catch (e) {
        console.error("Error loading classes:", e);
      }
    }
    loadClasses();
  }, [selectedAcademicYearId, selectedSemesterId, isTeacherRole, user?.uid]);

  // 3. Fetch Subjects based on Selected Class & Teacher
  useEffect(() => {
    async function loadSubjects() {
      if (!selectedClassId || !selectedAcademicYearId || !selectedSemesterId) return;
      try {
        const allSubjects = await subjectService.getSubjects();
        const reportableSubjects = allSubjects.filter((s) => isSubjectReportVisible(s));
        const allScheds = await scheduleService.getSchedules(selectedAcademicYearId, selectedSemesterId);
        const scheds = allScheds.filter((s) => s.classId === selectedClassId);
        let validSubjIds = new Set<string>();

        const currentTeacherId = user?.teacherId || user?.uid || user?.userId;
        if (isTeacherRole && currentTeacherId) {
          scheds
            .filter((s) => s.teacherId === currentTeacherId || s.teacherId === user?.uid || s.teacherId === user?.teacherId)
            .forEach((s) => validSubjIds.add(s.subjectId));
        } else {
          scheds.forEach((s) => validSubjIds.add(s.subjectId));
        }

        const filtered = reportableSubjects.filter((s) => validSubjIds.has(s.id!));
        const finalSubjs = (isTeacherRole && currentTeacherId) ? filtered : (filtered.length > 0 ? filtered : reportableSubjects);
        setSubjects(finalSubjs);
        if (finalSubjs.length > 0) setSelectedSubjectId(finalSubjs[0].id!);
        else setSelectedSubjectId("");
      } catch (e) {
        console.error("Error loading subjects:", e);
      }
    }
    loadSubjects();
  }, [selectedClassId, selectedAcademicYearId, selectedSemesterId, isTeacherRole, user?.uid]);

  // 4. Fetch Grid Data based on Mode and Selection
  useEffect(() => {
    async function loadAssessmentGrid() {
      if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId) return;
      setIsLoading(true);
      try {
        const targetClass = classes.find((c) => c.id === selectedClassId);
        const allStudents = await studentService.getStudents();
        const loadedStudents = allStudents.filter((s) => s.classId === selectedClassId && isStudentActive(s));
        setStudents(loadedStudents);

        const ver = await eRaporService.getClassVerification(selectedAcademicYearId, selectedSemesterId, selectedClassId);
        setVerification(ver);

        if (inputMode === "MAPEL") {
          if (!selectedSubjectId) return;

          if (isPondokSubject) {
            // Load Pondok Assessments
            const pondokList = await eRaporService.getPondokAssessmentsForClassSubject(
              selectedAcademicYearId,
              selectedSemesterId,
              selectedClassId,
              selectedSubjectId
            );

            const map = new Map<string, ERaporPondokAssessment>();
            loadedStudents.forEach((st) => {
              const existing = pondokList.find((p) => p.studentId === st.id);
              if (existing) {
                map.set(st.id!, { ...existing });
              } else {
                map.set(st.id!, {
                  academicYearId: selectedAcademicYearId,
                  semesterId: selectedSemesterId,
                  classId: selectedClassId,
                  subjectId: selectedSubjectId,
                  studentId: st.id!,
                  studentName: st.name || "Santri",
                  teacherId: user?.uid || "",
                  score: null,
                  finalScore: null,
                  ketercapaian: "",
                  notes: "",
                  status: "BELUM_LENGKAP"
                });
              }
            });
            setPondokAssessmentsMap(map);
          } else {
            // Load Standard Rapor Umum Assessments
            const targetSubject = subjects.find((s) => s.id === selectedSubjectId);
            const gradeLevel = targetClass?.gradeLevel || "VII";
            const subjectName = targetSubject?.name || "Mata Pelajaran";

            const [loadedTps, loadedAssessments] = await Promise.all([
              eRaporService.syncTpsFromProtaPromes(
                selectedAcademicYearId,
                selectedSemesterId,
                gradeLevel,
                selectedSubjectId,
                subjectName,
                user?.name || "Guru"
              ),
              eRaporService.getAssessmentsForClassSubject(
                selectedAcademicYearId,
                selectedSemesterId,
                selectedClassId,
                selectedSubjectId
              )
            ]);

            setTps(loadedTps);

            const map = new Map<string, ERaporAssessment>();
            loadedStudents.forEach((st) => {
              const existing = loadedAssessments.find((a) => a.studentId === st.id);
              if (existing) {
                map.set(st.id!, { ...existing });
              } else {
                const defaultTpScores: ERaporAssessmentTpItem[] = loadedTps.map((t) => ({
                  tpId: t.id!,
                  tpCode: t.code,
                  tpTitle: t.title,
                  score: null
                }));
                map.set(st.id!, {
                  academicYearId: selectedAcademicYearId,
                  semesterId: selectedSemesterId,
                  classId: selectedClassId,
                  subjectId: selectedSubjectId,
                  studentId: st.id!,
                  studentName: st.name || "Siswa",
                  studentNis: st.nis || "",
                  teacherId: user?.uid || "",
                  tpScores: defaultTpScores,
                  utsScore: null,
                  sasScore: null,
                  tpAverage: null,
                  finalScore: null,
                  status: "BELUM_LENGKAP"
                });
              }
            });
            setAssessmentsMap(map);
          }
        } else if (inputMode === "EKSKUL") {
          if (!selectedEkskulId) return;

          const loadedEkskulAssessments = await eRaporService.getExtracurricularAssessments(
            selectedAcademicYearId,
            selectedSemesterId,
            selectedClassId,
            selectedEkskulId
          );

          const targetEkskul = extracurriculars.find((e) => e.id === selectedEkskulId);

          const map = new Map<string, ERaporExtracurricularAssessment>();
          loadedStudents.forEach((st) => {
            const existing = loadedEkskulAssessments.find((a) => a.studentId === st.id);
            if (existing) {
              map.set(st.id!, { ...existing });
            } else {
              map.set(st.id!, {
                academicYearId: selectedAcademicYearId,
                semesterId: selectedSemesterId,
                classId: selectedClassId,
                extracurricularId: selectedEkskulId,
                extracurricularName: targetEkskul?.name || "Ekstrakurikuler",
                studentId: st.id!,
                studentName: st.name || "Siswa",
                pembinaId: user?.uid || "",
                pembinaName: user?.name || "Pembina",
                participationStatus: "Aktif",
                progress: "Menunjukkan keaktifan dan semangat yang baik dalam mengikuti kegiatan.",
                notes: "",
                status: "LENGKAP"
              });
            }
          });
          setEkskulAssessmentsMap(map);
        }

        setHasUnsavedChanges(false);
      } catch (e) {
        console.error("Error loading assessment grid:", e);
        toast("Gagal memuat data penilaian e-Rapor.", "error");
      } finally {
        setIsLoading(false);
      }
    }

    loadAssessmentGrid();
  }, [
    inputMode,
    selectedAcademicYearId,
    selectedSemesterId,
    selectedClassId,
    selectedSubjectId,
    selectedEkskulId,
    isPondokSubject
  ]);

  // Handle Score Changes for Rapor Umum
  const handleScoreChange = (
    studentId: string,
    field: "tp" | "uts" | "sas",
    tpIndex: number | null,
    valueStr: string
  ) => {
    if (isClassLocked || !settings.isOpen) {
      toast("Nilai tidak dapat diubah karena kelas dikunci atau periode ditutup.", "error");
      return;
    }

    let valNum: number | null = null;
    if (valueStr.trim() !== "") {
      const parsed = parseFloat(valueStr);
      if (!isNaN(parsed)) {
        valNum = Math.min(100, Math.max(0, parsed));
      }
    }

    setAssessmentsMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId);
      if (!current) return prev;

      const updated: ERaporAssessment = { ...(current as ERaporAssessment) };

      if (field === "tp" && tpIndex !== null) {
        const tpScores = [...(updated.tpScores || [])];
        if (tpScores[tpIndex]) {
          tpScores[tpIndex] = { ...tpScores[tpIndex], score: valNum };
        }
        updated.tpScores = tpScores;
      } else if (field === "uts") {
        updated.utsScore = valNum;
      } else if (field === "sas") {
        updated.sasScore = valNum;
      }

      const calc = eRaporService.calculateAssessmentResult(
        updated.tpScores || [],
        updated.utsScore ?? null,
        updated.sasScore ?? null,
        settings
      );

      updated.tpAverage = calc.tpAverage;
      updated.finalScore = calc.finalScore;
      updated.status = calc.status;

      newMap.set(studentId, updated);
      return newMap;
    });

    setHasUnsavedChanges(true);
  };

  // Handle Pondok Score/Ketercapaian Changes
  const handlePondokChange = (
    studentId: string,
    field: "finalScore" | "ketercapaian" | "notes",
    val: any
  ) => {
    if (isClassLocked || !settings.isOpen) {
      toast("Nilai tidak dapat diubah karena kelas dikunci.", "error");
      return;
    }

    setPondokAssessmentsMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) as ERaporPondokAssessment | undefined;
      if (!current) return prev;

      const updated = { ...current };

      if (field === "finalScore") {
        let valNum: number | null = null;
        if (String(val).trim() !== "") {
          const parsed = parseFloat(val);
          if (!isNaN(parsed)) valNum = Math.min(100, Math.max(0, parsed));
        }
        updated.finalScore = valNum;

        // Auto suggestion for ketercapaian if currently empty or auto-generated
        if (valNum !== null && (!updated.ketercapaian || updated.ketercapaian.includes("diniyah"))) {
          if (valNum >= 85) updated.ketercapaian = "Sangat baik dan konsisten dalam menguasai materi kepondokan/diniyah.";
          else if (valNum >= 75) updated.ketercapaian = "Baik dalam pemahaman materi kepondokan/diniyah dan aktif berpartisipasi.";
          else if (valNum >= 65) updated.ketercapaian = "Cukup baik dalam pemahaman materi kepondokan/diniyah, perlu ketelitian.";
          else updated.ketercapaian = "Perlu bimbingan dan pengulangan intensif dalam materi kepondokan/diniyah.";
        }
      } else if (field === "ketercapaian") {
        updated.ketercapaian = val;
      } else if (field === "notes") {
        updated.notes = val;
      }

      updated.status = updated.finalScore !== null && updated.ketercapaian ? "LENGKAP" : "BELUM_LENGKAP";

      newMap.set(studentId, updated);
      return newMap;
    });

    setHasUnsavedChanges(true);
  };

  // Handle Ekskul Changes
  const handleEkskulChange = (
    studentId: string,
    field: "participationStatus" | "progress" | "notes",
    val: any
  ) => {
    if (isClassLocked || !settings.isOpen) {
      toast("Nilai tidak dapat diubah karena kelas dikunci.", "error");
      return;
    }

    setEkskulAssessmentsMap((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(studentId) as ERaporExtracurricularAssessment | undefined;
      if (!current) return prev;

      const updated = { ...current, [field]: val };
      newMap.set(studentId, updated);
      return newMap;
    });

    setHasUnsavedChanges(true);
  };

  // Save All Assessments
  const handleSaveAll = async () => {
    if (isClassLocked) {
      toast("Nilai telah dikunci oleh Wali Kelas.", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (inputMode === "MAPEL") {
        if (isPondokSubject) {
          const list = Array.from(pondokAssessmentsMap.values());
          await eRaporService.saveBatchPondokAssessments(list, user?.uid || "", user?.name || "Guru");
          toast("Seluruh nilai Rapor Pondok berhasil disimpan!", "success");
        } else {
          const list = Array.from(assessmentsMap.values());
          await eRaporService.saveBatchAssessments(list, user?.uid || "", user?.name || "Guru", settings);
          toast("Seluruh nilai Rapor Umum berhasil disimpan!", "success");
        }
      } else if (inputMode === "EKSKUL") {
        const list = Array.from(ekskulAssessmentsMap.values());
        await eRaporService.saveBatchExtracurricularAssessments(list, user?.uid || "", user?.name || "Pembina");
        toast("Seluruh nilai Ekstrakurikuler berhasil disimpan!", "success");
      }

      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("Error saving e-Rapor assessments:", e);
      toast("Gagal menyimpan nilai. Silakan coba lagi.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Add TP Manual
  const handleAddTp = async () => {
    if (!newTpTitle.trim()) {
      toast("Judul TP wajib diisi.", "error");
      return;
    }

    try {
      const targetClass = classes.find((c) => c.id === selectedClassId);
      const targetSubject = subjects.find((s) => s.id === selectedSubjectId);

      await eRaporService.saveTp(
        {
          academicYearId: selectedAcademicYearId,
          semesterId: selectedSemesterId,
          gradeLevel: targetClass?.gradeLevel || "VII",
          subjectId: selectedSubjectId,
          subjectName: targetSubject?.name || "",
          code: `TP ${tps.length + 1}`,
          title: newTpTitle.trim(),
          order: tps.length + 1
        },
        user?.name || "Guru"
      );

      toast("TP berhasil ditambahkan!", "success");
      setNewTpTitle("");
      setShowTpModal(false);

      const updatedTps = await eRaporService.getTps(
        selectedAcademicYearId,
        selectedSemesterId,
        targetClass?.gradeLevel || "VII",
        selectedSubjectId
      );
      setTps(updatedTps);
    } catch (e) {
      console.error("Error adding TP:", e);
      toast("Gagal menambah TP.", "error");
    }
  };

  // Request Grade Change Submission
  const handleSubmitRequestChange = async () => {
    if (!requestReason.trim()) {
      toast("Alasan wajib diisi.", "error");
      return;
    }

    try {
      const targetClass = classes.find((c) => c.id === selectedClassId);
      const targetSubject = subjects.find((s) => s.id === selectedSubjectId);

      await eRaporService.requestGradeChange({
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: selectedClassId,
        className: targetClass?.name || "Kelas",
        subjectId: selectedSubjectId || "EKSKUL",
        subjectName: targetSubject?.name || "Ekstrakurikuler",
        studentId: "ALL",
        studentName: "Seluruh Siswa Kelas",
        teacherId: user?.uid || "",
        teacherName: user?.name || "Guru",
        reason: requestReason.trim()
      });

      toast("Permintaan perubahan nilai dikirimkan.", "success");
      setRequestReason("");
      setShowRequestChangeModal(false);
    } catch (e) {
      console.error("Error requesting grade change:", e);
      toast("Gagal mengirimkan permintaan.", "error");
    }
  };

  // Stats Summary
  const completionStats = useMemo(() => {
    if (inputMode === "MAPEL") {
      if (isPondokSubject) {
        const list = Array.from(pondokAssessmentsMap.values());
        const total = list.length;
        const completed = list.filter((a: ERaporPondokAssessment) => a.status === "LENGKAP").length;
        return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
      } else {
        const list = Array.from(assessmentsMap.values());
        const total = list.length;
        const completed = list.filter((a: ERaporAssessment) => a.status === "LENGKAP").length;
        return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
      }
    } else {
      const list = Array.from(ekskulAssessmentsMap.values());
      const total = list.length;
      return { total, completed: total, percent: 100 };
    }
  }, [inputMode, isPondokSubject, pondokAssessmentsMap, assessmentsMap, ekskulAssessmentsMap]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                e-Rapor – Input Nilai & Asesmen Santri
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Mendukung 3 Jenis Penilaian: Rapor Umum, Rapor Pondok, dan Rapor Ekstrakurikuler.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {inputMode === "MAPEL" && !isPondokSubject && (
            <button
              onClick={() => setShowTpModal(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-500" />
              Kelola TP ({tps.length})
            </button>
          )}

          <button
            onClick={handleSaveAll}
            disabled={isSaving || isClassLocked || !hasUnsavedChanges}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm ${
              hasUnsavedChanges && !isClassLocked
                ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                : "bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Menyimpan..." : "Simpan Semua Nilai"}
          </button>
        </div>
      </div>

      {/* Lock Banner */}
      {isClassLocked && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 p-4 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-xs">
              <span className="font-bold">Status Rapor Kelas: TERVERIFIKASI / TERKUNCI</span>
              <p className="text-amber-700 dark:text-amber-300">
                Nilai di kelas ini telah dikunci oleh Wali Kelas ({verification?.homeroomTeacherName}). Input nilai ditutup sementara.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRequestChangeModal(true)}
            className="px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all flex items-center gap-1.5 flex-shrink-0"
          >
            <Edit className="w-3.5 h-3.5" />
            Ajukan Edit Nilai
          </button>
        </div>
      )}

      {/* Input Mode Selector Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setInputMode("MAPEL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            inputMode === "MAPEL"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
          }`}
        >
          <Layers className="w-4 h-4" /> Mata Pelajaran (Rapor Umum & Pondok)
        </button>

        <button
          onClick={() => setInputMode("EKSKUL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            inputMode === "EKSKUL"
              ? "bg-emerald-600 text-white shadow-md"
              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
          }`}
        >
          <Award className="w-4 h-4" /> Kegiatan Ekstrakurikuler
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Tahun Ajaran
          </label>
          <select
            value={selectedAcademicYearId}
            onChange={(e) => setSelectedAcademicYearId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year} {y.isActive ? "(Aktif)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Semester
          </label>
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {semesters
              .filter((s) => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || `Semester ${s.code}`} {s.isActive ? "(Aktif)" : ""}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Kelas / Rombel
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name}
              </option>
            ))}
          </select>
        </div>

        {inputMode === "MAPEL" ? (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1 flex items-center justify-between">
              <span>Mata Pelajaran</span>
              {isPondokSubject && (
                <span className="text-[10px] font-extrabold text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded">
                  RAPOR PONDOK
                </span>
              )}
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
            >
              {subjects.map((s) => {
                const isP = s.subjectType === "PONDOK" || s.categoryType === "diniyah_pondok";
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code}) {isP ? "⭐ [PONDOK]" : ""}
                  </option>
                );
              })}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
              Kegiatan Ekstrakurikuler
            </label>
            <select
              value={selectedEkskulId}
              onChange={(e) => setSelectedEkskulId(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
            >
              {extracurriculars.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.category})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats Summary Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-100 dark:bg-zinc-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-700/60 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-500 dark:text-zinc-400">Total Siswa:</span>{" "}
            <span className="font-bold text-slate-800 dark:text-zinc-100">{completionStats.total} Siswa</span>
          </div>
          <div>
            <span className="text-slate-500 dark:text-zinc-400">Status Penilaian:</span>{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {completionStats.completed} Lengkap ({completionStats.percent}%)
            </span>
          </div>
          {inputMode === "MAPEL" && !isPondokSubject && (
            <div>
              <span className="text-slate-500 dark:text-zinc-400">Bobot Penilaian:</span>{" "}
              <span className="font-semibold text-slate-700 dark:text-zinc-300">
                TP ({settings.tpWeight}%), UTS ({settings.utsWeight}%), SAS ({settings.sasWeight}%)
              </span>
            </div>
          )}
        </div>

        {hasUnsavedChanges && !isClassLocked && (
          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Terdapat perubahan nilai belum disimpan
          </span>
        )}
      </div>

      {/* Main Spreadsheet Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Memuat lembar kerja e-Rapor...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-zinc-400">
            <Info className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold">Tidak Ada Siswa Terdaftar</p>
            <p className="text-xs text-slate-400">Silakan pilih kelas lain atau periksa data master siswa.</p>
          </div>
        ) : inputMode === "MAPEL" && isPondokSubject ? (
          /* ==================== 1. RAPOR PONDOK MATRIX ==================== */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-slate-700 dark:text-amber-200">
                  <th className="p-3 w-10 text-center font-bold">No</th>
                  <th className="p-3 min-w-[200px] font-bold">Nama Santri / NIS</th>
                  <th className="p-3 w-28 text-center font-bold">Nilai Akhir (0-100)</th>
                  <th className="p-3 font-bold">Ketercapaian Kompetensi Santri (Rapor Pondok)</th>
                  <th className="p-3 min-w-[150px] font-bold">Catatan Guru</th>
                  <th className="p-3 w-28 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {students.map((st, sIdx) => {
                  const pAss = pondokAssessmentsMap.get(st.id!) || {
                    finalScore: null,
                    ketercapaian: "",
                    notes: "",
                    status: "BELUM_LENGKAP"
                  };

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-medium">{sIdx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-zinc-100">{st.name}</div>
                        <div className="text-[10px] text-slate-400">NIS: {st.nis || "-"}</div>
                      </td>

                      {/* Nilai Akhir */}
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isClassLocked || !settings.isOpen}
                          value={pAss.finalScore !== null && pAss.finalScore !== undefined ? pAss.finalScore : ""}
                          onChange={(e) => handlePondokChange(st.id!, "finalScore", e.target.value)}
                          placeholder="0-100"
                          className="w-20 h-9 text-center text-xs font-black rounded-lg border bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                        />
                      </td>

                      {/* Ketercapaian Deskripsi */}
                      <td className="p-2">
                        <textarea
                          rows={2}
                          disabled={isClassLocked || !settings.isOpen}
                          value={pAss.ketercapaian || ""}
                          onChange={(e) => handlePondokChange(st.id!, "ketercapaian", e.target.value)}
                          placeholder="Deskripsi pencapaian kompetensi materi diniyah/pondok..."
                          className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700"
                        />
                      </td>

                      {/* Catatan Guru */}
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isClassLocked || !settings.isOpen}
                          value={pAss.notes || ""}
                          onChange={(e) => handlePondokChange(st.id!, "notes", e.target.value)}
                          placeholder="Catatan opsional..."
                          className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700"
                        />
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {pAss.status === "LENGKAP" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <AlertCircle className="w-3 h-3" /> Belum
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : inputMode === "MAPEL" ? (
          /* ==================== 2. RAPOR UMUM MATRIX ==================== */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                  <th className="p-3 w-10 text-center font-bold">No</th>
                  <th className="p-3 min-w-[200px] font-bold">Nama Siswa / NIS</th>
                  {tps.map((tp, idx) => (
                    <th key={tp.id || idx} className="p-2 min-w-[90px] text-center font-bold" title={tp.title}>
                      <span className="block text-emerald-600 dark:text-emerald-400 font-extrabold">{tp.code}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal truncate max-w-[80px] block mx-auto">
                        {tp.title}
                      </span>
                    </th>
                  ))}
                  <th className="p-3 min-w-[90px] text-center font-bold bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
                    Rata TP
                  </th>
                  <th className="p-3 min-w-[90px] text-center font-bold">UTS / STS</th>
                  <th className="p-3 min-w-[90px] text-center font-bold">SAS</th>
                  <th className="p-3 min-w-[100px] text-center font-bold bg-blue-50/50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">
                    Nilai Akhir
                  </th>
                  <th className="p-3 min-w-[110px] text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {students.map((st, sIdx) => {
                  const ass = assessmentsMap.get(st.id!) || {};
                  const tpScores = ass.tpScores || [];

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-medium">{sIdx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-zinc-100">{st.name}</div>
                        <div className="text-[10px] text-slate-400">NIS: {st.nis || "-"}</div>
                      </td>

                      {/* TP Scores */}
                      {tps.map((tp, tpIdx) => {
                        const itemScore = tpScores[tpIdx]?.score;
                        const scoreVal = itemScore !== null && itemScore !== undefined ? itemScore : "";

                        return (
                          <td key={tp.id || tpIdx} className="p-1.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              disabled={isClassLocked || !settings.isOpen}
                              value={scoreVal}
                              onChange={(e) => handleScoreChange(st.id!, "tp", tpIdx, e.target.value)}
                              placeholder="-"
                              className={`w-16 h-8 text-center text-xs font-bold rounded-lg border transition-all ${
                                scoreVal === ""
                                  ? "bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-400"
                                  : "bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Rata-rata TP */}
                      <td className="p-3 text-center bg-emerald-50/30 dark:bg-emerald-950/10 font-bold text-emerald-700 dark:text-emerald-400">
                        {ass.tpAverage !== null && ass.tpAverage !== undefined ? ass.tpAverage : "-"}
                      </td>

                      {/* UTS / STS */}
                      <td className="p-1.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isClassLocked || !settings.isOpen}
                          value={ass.utsScore !== null && ass.utsScore !== undefined ? ass.utsScore : ""}
                          onChange={(e) => handleScoreChange(st.id!, "uts", null, e.target.value)}
                          placeholder="-"
                          className={`w-16 h-8 text-center text-xs font-bold rounded-lg border transition-all ${
                            ass.utsScore === null || ass.utsScore === undefined
                              ? "bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-400"
                              : "bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                          }`}
                        />
                      </td>

                      {/* SAS */}
                      <td className="p-1.5 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={isClassLocked || !settings.isOpen}
                          value={ass.sasScore !== null && ass.sasScore !== undefined ? ass.sasScore : ""}
                          onChange={(e) => handleScoreChange(st.id!, "sas", null, e.target.value)}
                          placeholder="-"
                          className={`w-16 h-8 text-center text-xs font-bold rounded-lg border transition-all ${
                            ass.sasScore === null || ass.sasScore === undefined
                              ? "bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-400"
                              : "bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-emerald-500"
                          }`}
                        />
                      </td>

                      {/* Nilai Akhir */}
                      <td className="p-3 text-center bg-blue-50/30 dark:bg-blue-950/10 font-black text-sm text-blue-700 dark:text-blue-400">
                        {ass.finalScore !== null && ass.finalScore !== undefined ? ass.finalScore : "-"}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        {ass.status === "LENGKAP" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Lengkap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            <AlertCircle className="w-3 h-3" /> Belum
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ==================== 3. RAPOR EKSTRAKURIKULER MATRIX ==================== */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 text-slate-700 dark:text-emerald-200">
                  <th className="p-3 w-10 text-center font-bold">No</th>
                  <th className="p-3 min-w-[200px] font-bold">Nama Siswa / NIS</th>
                  <th className="p-3 w-40 font-bold">Status Keikutsertaan</th>
                  <th className="p-3 font-bold">Deskripsi Kemajuan Siswa (Rapor Ekstrakurikuler)</th>
                  <th className="p-3 min-w-[150px] font-bold">Catatan Pembina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {students.map((st, sIdx) => {
                  const eAss = ekskulAssessmentsMap.get(st.id!) || {
                    participationStatus: "Aktif",
                    progress: "Menunjukkan keaktifan dan keikutsertaan yang baik.",
                    notes: ""
                  };

                  return (
                    <tr key={st.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-medium">{sIdx + 1}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800 dark:text-zinc-100">{st.name}</div>
                        <div className="text-[10px] text-slate-400">NIS: {st.nis || "-"}</div>
                      </td>

                      {/* Status Keikutsertaan */}
                      <td className="p-2">
                        <select
                          disabled={isClassLocked || !settings.isOpen}
                          value={eAss.participationStatus}
                          onChange={(e) => handleEkskulChange(st.id!, "participationStatus", e.target.value)}
                          className="w-full text-xs p-2 rounded-lg border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 font-semibold"
                        >
                          <option value="Sangat Aktif">⭐ Sangat Aktif</option>
                          <option value="Aktif">Aktif</option>
                          <option value="Cukup">Cukup</option>
                          <option value="Kurang">Kurang</option>
                        </select>
                      </td>

                      {/* Deskripsi Kemajuan */}
                      <td className="p-2">
                        <textarea
                          rows={2}
                          disabled={isClassLocked || !settings.isOpen}
                          value={eAss.progress}
                          onChange={(e) => handleEkskulChange(st.id!, "progress", e.target.value)}
                          placeholder="Catatan perkembangan keterampilan dan sikap siswa dalam ekstrakurikuler..."
                          className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700"
                        />
                      </td>

                      {/* Catatan Pembina */}
                      <td className="p-2">
                        <input
                          type="text"
                          disabled={isClassLocked || !settings.isOpen}
                          value={eAss.notes || ""}
                          onChange={(e) => handleEkskulChange(st.id!, "notes", e.target.value)}
                          placeholder="Catatan tambahan..."
                          className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TP Management Modal */}
      {showTpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500" /> Kelola Tujuan Pembelajaran (TP)
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
              {tps.map((tp, i) => (
                <div
                  key={tp.id || i}
                  className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{tp.code}</span>
                    <p className="text-slate-700 dark:text-zinc-300 font-medium">{tp.title}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-zinc-800 pt-3 space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tambah TP Baru</label>
              <input
                type="text"
                value={newTpTitle}
                onChange={(e) => setNewTpTitle(e.target.value)}
                placeholder="Misal: Menganalisis reaksi kimia sederhana..."
                className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowTpModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Tutup
              </button>
              <button
                onClick={handleAddTp}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Simpan TP
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grade Change Request Modal */}
      {showRequestChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" /> Permintaan Perubahan Nilai
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Rapor kelas ini telah dikunci oleh Wali Kelas. Tuliskan alasan mengapa Anda perlu memperbarui nilai.
            </p>

            <textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Misal: Perbaikan nilai ujian susulan santri Ahmad..."
              className="w-full text-xs p-3 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl h-24"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRequestChangeModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitRequestChange}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              >
                Kirim Permintaan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
