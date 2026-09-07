import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { scheduleService } from "../services/schedule.service";
import { teacherAssignmentService } from "../services/teacherAssignment.service";
import { studentService } from "../services/studentService";
import { eRaporService, calculatePondokAssessmentResult } from "../services/eRapor.service";
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
  ERaporPondokScheme,
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
  Layers,
  Sliders,
  Settings2,
  AlertTriangle,
  Check,
  X,
  ChevronDown
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

  // Selected Subject & Class Details
  const selectedSubject = useMemo(() => {
    return subjects.find((s) => s.id === selectedSubjectId);
  }, [subjects, selectedSubjectId]);

  const targetClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  const isPondokSubject = useMemo(() => {
    if (!selectedSubject) return false;
    return getSubjectGroupType(selectedSubject) === "KEPESANTRENAN";
  }, [selectedSubject]);

  // Authorization check via teacher_assignments SSOT
  const isTeacherAuthorizedForSubject = useMemo(() => {
    if (!isTeacherRole) return true;
    if (inputMode !== "MAPEL") return true;
    if (!selectedSubjectId) return false;
    return subjects.some((s) => s.id === selectedSubjectId);
  }, [isTeacherRole, inputMode, selectedSubjectId, subjects]);

  const isInputDisabled = isClassLocked || !settings.isOpen || !isTeacherAuthorizedForSubject;

  // Pondok Scheme Configuration States
  const [pondokScheme, setPondokScheme] = useState<ERaporPondokScheme | null>(null);
  const [showSchemeEditor, setShowSchemeEditor] = useState<boolean>(false);
  const [isSavingScheme, setIsSavingScheme] = useState<boolean>(false);
  const [schemeForm, setSchemeForm] = useState<{
    hasDaily: boolean;
    dailyCount: number;
    hasUts: boolean;
    hasSemester: boolean;
    weights: {
      daily: number;
      uts: number;
      semester: number;
    };
  }>({
    hasDaily: true,
    dailyCount: 3,
    hasUts: true,
    hasSemester: true,
    weights: {
      daily: 40,
      uts: 30,
      semester: 30
    }
  });

  // Modal confirmation when reducing PH count while data exists
  const [phReduceWarning, setPhReduceWarning] = useState<{
    isOpen: boolean;
    oldCount: number;
    newCount: number;
    pendingForm: typeof schemeForm;
  } | null>(null);

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
          const currentTeacherId = user?.teacherId || user?.uid || user?.userId;
          const [allScheds, periodAssignments] = await Promise.all([
            scheduleService.getSchedules(selectedAcademicYearId, selectedSemesterId),
            teacherAssignmentService.getTeacherAssignmentsByPeriod(selectedAcademicYearId, selectedSemesterId)
          ]);

          const classIds = new Set<string>();

          // Priority 1: Classes where teacher has active assignment via teacher_assignments SSOT
          periodAssignments.forEach((a) => {
            if (a.classId) {
              const res = teacherAssignmentService.resolveTeacherAssignmentSync({
                academicYearId: selectedAcademicYearId,
                semesterId: selectedSemesterId,
                subjectId: a.subjectId,
                classId: a.classId,
                preloadedAssignments: periodAssignments
              });
              if (res.source === "assignment" && (res.teacherId === currentTeacherId || res.teacherId === user.uid)) {
                classIds.add(a.classId);
              }
            }
          });

          // Priority 2: Fallback to schedule records if no assignment found in teacher_assignments
          allScheds
            .filter((s) => s.teacherId === currentTeacherId || s.teacherId === user.uid)
            .forEach((s) => classIds.add(s.classId));

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
  }, [selectedAcademicYearId, selectedSemesterId, isTeacherRole, user?.uid, user?.teacherId]);

  // 3. Fetch Subjects based on Selected Class & Teacher
  useEffect(() => {
    async function loadSubjects() {
      if (!selectedClassId || !selectedAcademicYearId || !selectedSemesterId) return;
      try {
        const allSubjects = await subjectService.getSubjects();
        const reportableSubjects = allSubjects.filter((s) => isSubjectReportVisible(s));
        const [allScheds, periodAssignments] = await Promise.all([
          scheduleService.getSchedules(selectedAcademicYearId, selectedSemesterId),
          teacherAssignmentService.getTeacherAssignmentsByPeriod(selectedAcademicYearId, selectedSemesterId)
        ]);
        const scheds = allScheds.filter((s) => s.classId === selectedClassId);
        let validSubjIds = new Set<string>();

        const currentTeacherId = user?.teacherId || user?.uid || user?.userId;
        if (isTeacherRole && currentTeacherId) {
          // Priority 1: Check teacher_assignments SSOT
          reportableSubjects.forEach((sub) => {
            const resolved = teacherAssignmentService.resolveTeacherAssignmentSync({
              academicYearId: selectedAcademicYearId,
              semesterId: selectedSemesterId,
              subjectId: sub.id!,
              classId: selectedClassId,
              preloadedAssignments: periodAssignments
            });
            if (
              resolved.source === "assignment" &&
              (resolved.teacherId === currentTeacherId || resolved.teacherId === user?.uid)
            ) {
              validSubjIds.add(sub.id!);
            }
          });

          // Priority 2: Fallback to schedule records if subject not explicitly resolved to another teacher in assignments
          scheds
            .filter((s) => s.teacherId === currentTeacherId || s.teacherId === user?.uid || s.teacherId === user?.teacherId)
            .forEach((s) => {
              const resolved = teacherAssignmentService.resolveTeacherAssignmentSync({
                academicYearId: selectedAcademicYearId,
                semesterId: selectedSemesterId,
                subjectId: s.subjectId,
                classId: selectedClassId,
                preloadedAssignments: periodAssignments
              });
              if (resolved.source !== "assignment" || resolved.teacherId === currentTeacherId || resolved.teacherId === user?.uid) {
                validSubjIds.add(s.subjectId);
              }
            });
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
  }, [selectedClassId, selectedAcademicYearId, selectedSemesterId, isTeacherRole, user?.uid, user?.teacherId]);

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
            // 1. Load Pondok Scheme
            const loadedScheme = await eRaporService.getPondokScheme(
              selectedAcademicYearId,
              selectedSemesterId,
              selectedClassId,
              selectedSubjectId
            );
            setPondokScheme(loadedScheme);

            if (loadedScheme) {
              setSchemeForm({
                hasDaily: loadedScheme.hasDaily,
                dailyCount: loadedScheme.dailyCount,
                hasUts: loadedScheme.hasUts,
                hasSemester: loadedScheme.hasSemester,
                weights: { ...loadedScheme.weights }
              });
              setShowSchemeEditor(false);
            } else {
              // Default template when no scheme has been configured yet
              setSchemeForm({
                hasDaily: true,
                dailyCount: 3,
                hasUts: true,
                hasSemester: true,
                weights: { daily: 40, uts: 30, semester: 30 }
              });
              setShowSchemeEditor(true);
            }

            // 2. Load Pondok Assessments
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
                map.set(st.id!, {
                  ...existing,
                  finalScore: existing.finalScore ?? existing.score ?? null,
                  score: existing.score ?? existing.finalScore ?? null
                });
              } else {
                map.set(st.id!, {
                  academicYearId: selectedAcademicYearId,
                  semesterId: selectedSemesterId,
                  classId: selectedClassId,
                  subjectId: selectedSubjectId,
                  studentId: st.id!,
                  studentName: st.name || "Santri",
                  studentNis: st.nis || "",
                  teacherId: user?.uid || "",
                  dailyScores: loadedScheme?.hasDaily ? Array(loadedScheme.dailyCount).fill(null) : [],
                  dailyAverage: null,
                  utsScore: null,
                  semesterScore: null,
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
    if (isInputDisabled) {
      toast("Nilai tidak dapat diubah karena kelas dikunci, periode ditutup, atau Anda bukan guru pengampu aktif.", "error");
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

  // Scheme Weights Calculation & Validation
  const totalActiveWeight = useMemo(() => {
    let sum = 0;
    if (schemeForm.hasDaily) sum += Number(schemeForm.weights.daily) || 0;
    if (schemeForm.hasUts) sum += Number(schemeForm.weights.uts) || 0;
    if (schemeForm.hasSemester) sum += Number(schemeForm.weights.semester) || 0;
    return sum;
  }, [schemeForm]);

  const isSchemeWeightValid = useMemo(() => {
    const atLeastOne = schemeForm.hasDaily || schemeForm.hasUts || schemeForm.hasSemester;
    if (!atLeastOne) return false;
    if (schemeForm.hasDaily && (schemeForm.dailyCount < 1 || schemeForm.dailyCount > 10)) {
      return false;
    }
    return totalActiveWeight === 100;
  }, [schemeForm, totalActiveWeight]);

  // Save Pondok Scheme Function
  const doSaveScheme = async (formToSave: typeof schemeForm) => {
    setIsSavingScheme(true);
    try {
      const saved = await eRaporService.savePondokScheme(
        {
          academicYearId: selectedAcademicYearId,
          semesterId: selectedSemesterId,
          classId: selectedClassId,
          subjectId: selectedSubjectId,
          teacherId: user?.uid || "",
          hasDaily: formToSave.hasDaily,
          dailyCount: formToSave.hasDaily ? formToSave.dailyCount : 0,
          dailyLabels: formToSave.hasDaily
            ? Array.from({ length: formToSave.dailyCount }, (_, i) => `PH ${i + 1}`)
            : [],
          hasUts: formToSave.hasUts,
          hasSemester: formToSave.hasSemester,
          weights: {
            daily: formToSave.hasDaily ? Number(formToSave.weights.daily) || 0 : 0,
            uts: formToSave.hasUts ? Number(formToSave.weights.uts) || 0 : 0,
            semester: formToSave.hasSemester ? Number(formToSave.weights.semester) || 0 : 0
          }
        },
        user?.uid || "",
        user?.name || "Guru"
      );

      setPondokScheme(saved);
      setShowSchemeEditor(false);
      toast("Skema Penilaian Pondok berhasil disimpan!", "success");

      // Recalculate in-memory assessments using the updated scheme
      setPondokAssessmentsMap((prev) => {
        const newMap = new Map<string, ERaporPondokAssessment>(prev);
        newMap.forEach((ass: ERaporPondokAssessment, stId: string) => {
          const rawScores = ass.dailyScores ? [...ass.dailyScores] : [];
          try {
            const calc = calculatePondokAssessmentResult({
              scheme: saved,
              dailyScores: rawScores,
              utsScore: ass.utsScore,
              semesterScore: ass.semesterScore
            });
            newMap.set(stId, {
              ...ass,
              dailyAverage: calc.dailyAverage,
              finalScore: calc.finalScore,
              score: calc.finalScore,
              status:
                calc.isComplete && Boolean(ass.ketercapaian && ass.ketercapaian.trim())
                  ? "LENGKAP"
                  : "BELUM_LENGKAP",
              schemeSnapshot: {
                hasDaily: saved.hasDaily,
                dailyCount: saved.dailyCount,
                hasUts: saved.hasUts,
                hasSemester: saved.hasSemester,
                weights: { ...saved.weights }
              }
            });
          } catch (e) {
            console.error("Recalculation error after scheme save:", e);
          }
        });
        return newMap;
      });
      setHasUnsavedChanges(true);
    } catch (err: any) {
      console.error("Error saving pondok scheme:", err);
      toast(err?.message || "Gagal menyimpan skema penilaian pondok.", "error");
    } finally {
      setIsSavingScheme(false);
    }
  };

  // Initiate Scheme Save with Warnings if PH reduced
  const handleInitiateSaveScheme = async () => {
    if (isInputDisabled) {
      toast("Skema tidak dapat diubah karena kelas dikunci, periode ditutup, atau Anda bukan guru pengampu aktif.", "error");
      return;
    }

    if (!isSchemeWeightValid) {
      toast("Total bobot komponen aktif harus tepat 100%.", "error");
      return;
    }

    if (
      pondokScheme &&
      pondokScheme.hasDaily &&
      schemeForm.hasDaily &&
      schemeForm.dailyCount < pondokScheme.dailyCount
    ) {
      const hasScoresInHigher = (Array.from(pondokAssessmentsMap.values()) as ERaporPondokAssessment[]).some((ass) => {
        if (!ass.dailyScores) return false;
        for (let i = schemeForm.dailyCount; i < pondokScheme.dailyCount; i++) {
          if (ass.dailyScores[i] !== null && ass.dailyScores[i] !== undefined) {
            return true;
          }
        }
        return false;
      });

      if (hasScoresInHigher) {
        setPhReduceWarning({
          isOpen: true,
          oldCount: pondokScheme.dailyCount,
          newCount: schemeForm.dailyCount,
          pendingForm: { ...schemeForm }
        });
        return;
      }
    }

    await doSaveScheme(schemeForm);
  };

  // Handle Pondok Dynamic Score Input (PH, UTS, Semesteran)
  const handlePondokScoreChange = (
    studentId: string,
    field: "daily" | "uts" | "semester",
    phIndex: number,
    rawVal: string
  ) => {
    if (isInputDisabled) {
      toast("Nilai tidak dapat diubah karena kelas dikunci, periode ditutup, atau Anda bukan guru pengampu aktif.", "error");
      return;
    }

    if (!pondokScheme) {
      toast("Harap simpan skema penilaian terlebih dahulu.", "error");
      return;
    }

    let parsedVal: number | null = null;
    const trimmed = rawVal.trim();
    if (trimmed !== "") {
      const num = Number(trimmed);
      if (isNaN(num) || num < 0 || num > 100) {
        toast("Nilai harus berada pada rentang 0–100.", "error");
        return;
      }
      parsedVal = num;
    }

    setPondokAssessmentsMap((prev) => {
      const newMap = new Map<string, ERaporPondokAssessment>(prev);
      const current = newMap.get(studentId);
      if (!current) return prev;

      const updated: ERaporPondokAssessment = { ...current };
      let nextDailyScores = updated.dailyScores ? [...updated.dailyScores] : [];
      let nextUtsScore = updated.utsScore ?? null;
      let nextSemesterScore = updated.semesterScore ?? null;

      if (field === "daily") {
        while (nextDailyScores.length < pondokScheme.dailyCount) {
          nextDailyScores.push(null);
        }
        nextDailyScores[phIndex] = parsedVal;
      } else if (field === "uts") {
        nextUtsScore = parsedVal;
      } else if (field === "semester") {
        nextSemesterScore = parsedVal;
      }

      try {
        const calcResult = calculatePondokAssessmentResult({
          scheme: pondokScheme,
          dailyScores: nextDailyScores,
          utsScore: nextUtsScore,
          semesterScore: nextSemesterScore
        });

        updated.dailyScores = nextDailyScores;
        updated.dailyAverage = calcResult.dailyAverage;
        updated.utsScore = nextUtsScore;
        updated.semesterScore = nextSemesterScore;
        updated.finalScore = calcResult.finalScore;
        updated.score = calcResult.finalScore;

        updated.status =
          calcResult.isComplete && Boolean(updated.ketercapaian && updated.ketercapaian.trim().length > 0)
            ? "LENGKAP"
            : "BELUM_LENGKAP";

        // Auto suggestion for ketercapaian if currently empty or default
        if (
          calcResult.finalScore !== null &&
          (!updated.ketercapaian ||
            updated.ketercapaian.includes("diniyah") ||
            updated.ketercapaian.includes("kepondokan"))
        ) {
          if (calcResult.finalScore >= 85) {
            updated.ketercapaian = "Sangat baik dan konsisten dalam menguasai materi kepondokan/diniyah.";
          } else if (calcResult.finalScore >= 75) {
            updated.ketercapaian = "Baik dalam pemahaman materi kepondokan/diniyah dan aktif berpartisipasi.";
          } else if (calcResult.finalScore >= 65) {
            updated.ketercapaian = "Cukup baik dalam pemahaman materi kepondokan/diniyah, perlu ketelitian.";
          } else {
            updated.ketercapaian = "Perlu bimbingan dan pengulangan intensif dalam materi kepondokan/diniyah.";
          }
        }

        updated.schemeSnapshot = {
          hasDaily: pondokScheme.hasDaily,
          dailyCount: pondokScheme.dailyCount,
          hasUts: pondokScheme.hasUts,
          hasSemester: pondokScheme.hasSemester,
          weights: { ...pondokScheme.weights }
        };
      } catch (calcErr: any) {
        console.error("Pondok score calculation error:", calcErr);
      }

      newMap.set(studentId, updated);
      return newMap;
    });

    setHasUnsavedChanges(true);
  };

  // Handle Pondok Text Fields (ketercapaian & notes)
  const handlePondokTextChange = (
    studentId: string,
    field: "ketercapaian" | "notes",
    val: string
  ) => {
    if (isClassLocked || !settings.isOpen) {
      toast("Nilai tidak dapat diubah karena kelas dikunci.", "error");
      return;
    }

    setPondokAssessmentsMap((prev) => {
      const newMap = new Map<string, ERaporPondokAssessment>(prev);
      const current = newMap.get(studentId);
      if (!current) return prev;

      const updated: ERaporPondokAssessment = { ...current, [field]: val };

      if (field === "ketercapaian") {
        let isCalcComplete = false;
        if (pondokScheme) {
          try {
            const calcResult = calculatePondokAssessmentResult({
              scheme: pondokScheme,
              dailyScores: updated.dailyScores,
              utsScore: updated.utsScore,
              semesterScore: updated.semesterScore
            });
            isCalcComplete = calcResult.isComplete;
          } catch {
            isCalcComplete = false;
          }
        } else {
          isCalcComplete = updated.finalScore !== null && updated.finalScore !== undefined;
        }

        updated.status =
          isCalcComplete && Boolean(val && val.trim().length > 0)
            ? "LENGKAP"
            : "BELUM_LENGKAP";
      }

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

    if (!isTeacherAuthorizedForSubject) {
      toast("Anda tidak memiliki kewenangan penugasan (teacher_assignments) untuk mata pelajaran ini.", "error");
      return;
    }

    setIsSaving(true);
    try {
      if (inputMode === "MAPEL") {
        if (isPondokSubject) {
          if (!pondokScheme) {
            toast("Harap simpan skema penilaian pondok terlebih dahulu.", "error");
            setIsSaving(false);
            return;
          }
          const list = (Array.from(pondokAssessmentsMap.values()) as ERaporPondokAssessment[]).map((ass) => ({
            ...ass,
            score: ass.finalScore ?? null,
            finalScore: ass.finalScore ?? null,
            schemeSnapshot: {
              hasDaily: pondokScheme.hasDaily,
              dailyCount: pondokScheme.dailyCount,
              hasUts: pondokScheme.hasUts,
              hasSemester: pondokScheme.hasSemester,
              weights: { ...pondokScheme.weights }
            }
          }));
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
    } catch (e: any) {
      console.error("Error saving e-Rapor assessments:", e);
      toast(e?.message || "Gagal menyimpan nilai. Silakan coba lagi.", "error");
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
            disabled={isSaving || isClassLocked || !hasUnsavedChanges || !isTeacherAuthorizedForSubject}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 shadow-sm ${
              hasUnsavedChanges && !isClassLocked && isTeacherAuthorizedForSubject
                ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse"
                : "bg-slate-200 dark:bg-zinc-800 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Menyimpan..." : "Simpan Semua Nilai"}
          </button>
        </div>
      </div>

      {/* Teacher Assignment Authorization Banner */}
      {!isTeacherAuthorizedForSubject && isTeacherRole && inputMode === "MAPEL" && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <div className="text-xs">
            <span className="font-bold">Akses Terbatas: Bukan Guru Pengampu Aktif</span>
            <p className="text-rose-700 dark:text-rose-300">
              Anda tidak terdaftar sebagai guru pengampu aktif untuk mata pelajaran ini pada penugasan guru (teacher_assignments). Halaman ini ditampilkan dalam mode hanya-baca (Read-Only).
            </p>
          </div>
        </div>
      )}

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
          <div className="space-y-0">
            {/* Scheme Configuration / Summary Panel */}
            <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-zinc-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg">
                      <Sliders className="w-4 h-4" />
                    </span>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-200">
                      Skema Komponen Penilaian Mapel Pondok
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                    {selectedSubject?.name} • Rombel {targetClass?.name || targetClass?.gradeLevel || "-"}
                  </p>
                </div>

                {pondokScheme && !showSchemeEditor && (
                  <button
                    type="button"
                    onClick={() => setShowSchemeEditor(true)}
                    disabled={isInputDisabled}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white transition-colors shadow-xs"
                  >
                    <Settings2 className="w-3.5 h-3.5" /> Ubah Skema
                  </button>
                )}
              </div>

              {/* Summary of Active Scheme */}
              {pondokScheme && !showSchemeEditor ? (
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/70 shadow-xs">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Komponen:</span>
                    <div className="flex items-center gap-1.5">
                      {pondokScheme.hasDaily && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                          <Check className="w-3 h-3" /> PH ({pondokScheme.dailyCount})
                        </span>
                      )}
                      {pondokScheme.hasUts && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                          <Check className="w-3 h-3" /> UTS
                        </span>
                      )}
                      {pondokScheme.hasSemester && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                          <Check className="w-3 h-3" /> Semesteran
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/70 shadow-xs">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Bobot Aktif:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-100">
                      {[
                        pondokScheme.hasDaily ? `PH ${pondokScheme.weights.daily}%` : null,
                        pondokScheme.hasUts ? `UTS ${pondokScheme.weights.uts}%` : null,
                        pondokScheme.hasSemester ? `Semesteran ${pondokScheme.weights.semester}%` : null
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </span>
                  </div>
                </div>
              ) : (
                /* Scheme Configuration Form */
                <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-amber-200 dark:border-amber-900/60 space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                        Konfigurasi Komponen & Bobot Penilaian
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Aktifkan komponen yang digunakan lalu tentukan bobot masing-masing. Total bobot komponen aktif harus tepat 100%.
                      </p>
                    </div>
                    <div>
                      {isSchemeWeightValid ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          <Check className="w-3.5 h-3.5" /> Total Bobot: {totalActiveWeight}% (Valid)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="w-3.5 h-3.5" /> Total Bobot: {totalActiveWeight}% (Harus 100%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3 Component Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Penilaian Harian (PH) */}
                    <div
                      className={`p-3.5 rounded-xl border transition-colors ${
                        schemeForm.hasDaily
                          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/60 opacity-60"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={schemeForm.hasDaily}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSchemeForm((prev) => ({
                              ...prev,
                              hasDaily: checked,
                              weights: {
                                ...prev.weights,
                                daily: checked ? (prev.weights.daily > 0 ? prev.weights.daily : 40) : 0
                              }
                            }));
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        Penilaian Harian (PH)
                      </label>

                      {schemeForm.hasDaily && (
                        <div className="mt-3 space-y-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 dark:text-zinc-300 font-medium text-[11px]">
                              Jumlah PH (1–10):
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={schemeForm.dailyCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                const clamped = Math.max(1, Math.min(10, val));
                                setSchemeForm((prev) => ({ ...prev, dailyCount: clamped }));
                              }}
                              className="w-16 h-8 text-center text-xs font-bold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 dark:text-zinc-300 font-medium text-[11px]">
                              Bobot PH (%):
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={schemeForm.weights.daily}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setSchemeForm((prev) => ({
                                  ...prev,
                                  weights: { ...prev.weights, daily: Math.max(0, Math.min(100, val)) }
                                }));
                              }}
                              className="w-16 h-8 text-center text-xs font-bold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Ujian Tengah Semester (UTS) */}
                    <div
                      className={`p-3.5 rounded-xl border transition-colors ${
                        schemeForm.hasUts
                          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/60 opacity-60"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={schemeForm.hasUts}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSchemeForm((prev) => ({
                              ...prev,
                              hasUts: checked,
                              weights: {
                                ...prev.weights,
                                uts: checked ? (prev.weights.uts > 0 ? prev.weights.uts : 30) : 0
                              }
                            }));
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        Ujian Tengah Semester (UTS)
                      </label>

                      {schemeForm.hasUts && (
                        <div className="mt-3 space-y-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 dark:text-zinc-300 font-medium text-[11px]">
                              Bobot UTS (%):
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={schemeForm.weights.uts}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setSchemeForm((prev) => ({
                                  ...prev,
                                  weights: { ...prev.weights, uts: Math.max(0, Math.min(100, val)) }
                                }));
                              }}
                              className="w-16 h-8 text-center text-xs font-bold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Semesteran / UAS */}
                    <div
                      className={`p-3.5 rounded-xl border transition-colors ${
                        schemeForm.hasSemester
                          ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-700/60 opacity-60"
                      }`}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          checked={schemeForm.hasSemester}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSchemeForm((prev) => ({
                              ...prev,
                              hasSemester: checked,
                              weights: {
                                ...prev.weights,
                                semester: checked ? (prev.weights.semester > 0 ? prev.weights.semester : 30) : 0
                              }
                            }));
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        Semesteran / UAS
                      </label>

                      {schemeForm.hasSemester && (
                        <div className="mt-3 space-y-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 dark:text-zinc-300 font-medium text-[11px]">
                              Bobot Semesteran (%):
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={schemeForm.weights.semester}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setSchemeForm((prev) => ({
                                  ...prev,
                                  weights: { ...prev.weights, semester: Math.max(0, Math.min(100, val)) }
                                }));
                              }}
                              className="w-16 h-8 text-center text-xs font-bold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warning message if editing */}
                  {pondokScheme && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>
                        <strong>Perhatian:</strong> Perubahan skema akan memengaruhi perhitungan nilai yang belum disimpan. Nilai yang sudah tersimpan tidak akan dihapus.
                      </span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                    {pondokScheme && (
                      <button
                        type="button"
                        onClick={() => {
                          setSchemeForm({
                            hasDaily: pondokScheme.hasDaily,
                            dailyCount: pondokScheme.dailyCount,
                            hasUts: pondokScheme.hasUts,
                            hasSemester: pondokScheme.hasSemester,
                            weights: { ...pondokScheme.weights }
                          });
                          setShowSchemeEditor(false);
                        }}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleInitiateSaveScheme}
                      disabled={!isSchemeWeightValid || isSavingScheme || isInputDisabled}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white transition-colors shadow-xs"
                    >
                      {isSavingScheme ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan Skema...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" /> Simpan Skema
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Assessment Table Matrix or Empty State */}
            {!pondokScheme ? (
              <div className="p-12 text-center text-slate-500 dark:text-zinc-400 space-y-2">
                <Sliders className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                  Skema Penilaian Belum Dikonfigurasi
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Harap tentukan komponen penilaian dan simpan skema di atas terlebih dahulu untuk mulai menginput nilai santri.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 text-slate-700 dark:text-amber-200">
                      <th className="p-3 w-10 text-center font-bold">No</th>
                      <th className="p-3 min-w-[200px] font-bold">Nama Santri / NIS</th>

                      {/* Dynamic PH columns */}
                      {pondokScheme.hasDaily &&
                        Array.from({ length: pondokScheme.dailyCount }, (_, i) => (
                          <th key={`th-ph-${i}`} className="p-3 w-20 text-center font-bold">
                            PH {i + 1}
                          </th>
                        ))}

                      {/* Rata-rata PH column */}
                      {pondokScheme.hasDaily && (
                        <th className="p-3 w-24 text-center font-bold bg-amber-100/50 dark:bg-amber-900/30">
                          Rata-rata PH
                        </th>
                      )}

                      {/* UTS column */}
                      {pondokScheme.hasUts && (
                        <th className="p-3 w-20 text-center font-bold">
                          UTS
                        </th>
                      )}

                      {/* Semesteran column */}
                      {pondokScheme.hasSemester && (
                        <th className="p-3 w-24 text-center font-bold">
                          Semesteran
                        </th>
                      )}

                      {/* Nilai Akhir (Calculated Read-Only) */}
                      <th className="p-3 w-24 text-center font-bold bg-amber-100/70 dark:bg-amber-900/50 text-amber-950 dark:text-amber-100">
                        Nilai Akhir
                      </th>

                      {/* Ketercapaian */}
                      <th className="p-3 font-bold min-w-[240px]">
                        Ketercapaian Kompetensi Santri (Rapor Pondok)
                      </th>

                      {/* Catatan Guru */}
                      <th className="p-3 min-w-[150px] font-bold">Catatan Guru</th>

                      {/* Status */}
                      <th className="p-3 w-28 text-center font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                    {students.map((st, sIdx) => {
                      const pAss = pondokAssessmentsMap.get(st.id!) || {
                        academicYearId: selectedAcademicYearId,
                        semesterId: selectedSemesterId,
                        classId: selectedClassId,
                        subjectId: selectedSubjectId,
                        studentId: st.id!,
                        studentName: st.name || "Santri",
                        studentNis: st.nis || "",
                        teacherId: user?.uid || "",
                        dailyScores: [],
                        dailyAverage: null,
                        utsScore: null,
                        semesterScore: null,
                        score: null,
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

                          {/* Dynamic PH input cells */}
                          {pondokScheme.hasDaily &&
                            Array.from({ length: pondokScheme.dailyCount }, (_, i) => {
                              const scoreVal = pAss.dailyScores?.[i];
                              return (
                                <td key={`td-ph-${st.id}-${i}`} className="p-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    disabled={isInputDisabled}
                                    value={scoreVal !== null && scoreVal !== undefined ? scoreVal : ""}
                                    onChange={(e) => handlePondokScoreChange(st.id!, "daily", i, e.target.value)}
                                    placeholder="0-100"
                                    className="w-16 h-8 text-center text-xs font-semibold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                                  />
                                </td>
                              );
                            })}

                          {/* Rata-rata PH display */}
                          {pondokScheme.hasDaily && (
                            <td className="p-2 text-center bg-slate-50/40 dark:bg-zinc-800/20">
                              <span className="inline-block px-2 py-1 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                {pAss.dailyAverage !== null && pAss.dailyAverage !== undefined
                                  ? pAss.dailyAverage
                                  : "-"}
                              </span>
                            </td>
                          )}

                          {/* UTS input cell */}
                          {pondokScheme.hasUts && (
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={isInputDisabled}
                                value={pAss.utsScore !== null && pAss.utsScore !== undefined ? pAss.utsScore : ""}
                                onChange={(e) => handlePondokScoreChange(st.id!, "uts", 0, e.target.value)}
                                placeholder="0-100"
                                className="w-16 h-8 text-center text-xs font-semibold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                          )}

                          {/* Semesteran input cell */}
                          {pondokScheme.hasSemester && (
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={isInputDisabled}
                                value={pAss.semesterScore !== null && pAss.semesterScore !== undefined ? pAss.semesterScore : ""}
                                onChange={(e) => handlePondokScoreChange(st.id!, "semester", 0, e.target.value)}
                                placeholder="0-100"
                                className="w-16 h-8 text-center text-xs font-semibold rounded-lg border bg-white dark:bg-zinc-900 border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                              />
                            </td>
                          )}

                          {/* Nilai Akhir (Calculated Read-Only) */}
                          <td className="p-2 text-center bg-amber-50/40 dark:bg-amber-950/20">
                            <div className="w-16 mx-auto py-1.5 px-2 text-center text-xs font-black rounded-lg border border-amber-300/80 dark:border-amber-700/80 bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-400">
                              {pAss.finalScore !== null && pAss.finalScore !== undefined ? pAss.finalScore : "-"}
                            </div>
                          </td>

                          {/* Ketercapaian Deskripsi */}
                          <td className="p-2">
                            <textarea
                              rows={2}
                              disabled={isInputDisabled}
                              value={pAss.ketercapaian || ""}
                              onChange={(e) => handlePondokTextChange(st.id!, "ketercapaian", e.target.value)}
                              placeholder="Deskripsi pencapaian kompetensi materi diniyah/pondok..."
                              className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                            />
                          </td>

                          {/* Catatan Guru */}
                          <td className="p-2">
                            <input
                              type="text"
                              disabled={isInputDisabled}
                              value={pAss.notes || ""}
                              onChange={(e) => handlePondokTextChange(st.id!, "notes", e.target.value)}
                              placeholder="Catatan opsional..."
                              className="w-full text-xs p-2 rounded-lg border bg-slate-50 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
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
            )}
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
                              disabled={isInputDisabled}
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
                          disabled={isInputDisabled}
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
                          disabled={isInputDisabled}
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
                          disabled={isInputDisabled}
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
                          disabled={isInputDisabled}
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
                          disabled={isInputDisabled}
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

      {/* Warning Modal when Reducing PH Count */}
      {phReduceWarning && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-950/60 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Konfirmasi Pengurangan Jumlah PH
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Perubahan Komponen Penilaian Harian
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              Jumlah PH akan dikurangi dari <strong>{phReduceWarning.oldCount}</strong> menjadi <strong>{phReduceWarning.newCount}</strong>. Nilai PH yang sudah tersimpan di atas PH {phReduceWarning.newCount} tidak akan digunakan dalam skema baru. Lanjutkan?
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (pondokScheme) {
                    setSchemeForm((prev) => ({
                      ...prev,
                      dailyCount: pondokScheme.dailyCount
                    }));
                  }
                  setPhReduceWarning(null);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  const form = phReduceWarning.pendingForm;
                  setPhReduceWarning(null);
                  await doSaveScheme(form);
                }}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs"
              >
                Lanjutkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
