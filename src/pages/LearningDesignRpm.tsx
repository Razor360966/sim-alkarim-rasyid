import React, { useState, useEffect, useMemo } from "react";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { classService } from "../services/classService";
import { semesterService } from "../services/semester.service";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { subjectService } from "../services/subjectService";
import { curriculumPlanningService } from "../services/curriculumPlanning.service";
import { teacherAssignmentService, resolveTeacherAssignmentSync } from "../services/teacherAssignment.service";
import { learningDesignRpmService } from "../services/learningDesignRpm.service";
import type {
  Class,
  Semester,
  CurriculumMatrix,
  Subject,
  TeacherAssignment,
  AnnualProgram,
  SemesterProgram,
  ProtaTopic,
  ProtaSubTopic,
  LearningDesignRpm as LearningDesignRpmData,
  RpmMeetingPlan,
  RpmStatus
} from "../types";
import {
  FileText,
  Plus,
  Edit3,
  Trash2,
  Printer,
  Search,
  Info,
  Calendar,
  BookOpen,
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  Shield,
  Eye,
  Check,
  Building2,
  GraduationCap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TeacherAssignmentOption {
  classId: string;
  className: string;
  gradeLevel: "VII" | "VIII" | "IX";
  subjectId: string;
  subjectName: string;
  jp: number;
}

const COMMON_LEARNING_MODELS = [
  "Problem-Based Learning (PBL)",
  "Project-Based Learning (PjBL)",
  "Inquiry Learning",
  "Discovery Learning",
  "Diskusi Kelompok & Presentasi",
  "Praktikum / Eksperimen Sains",
  "Ceramah Interaktif & Latihan Terbimbing",
  "Tanya Jawab & Penugasan Mandiri"
];

export const LearningDesignRpm: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Master Data States
  const [classes, setClasses] = useState<Class[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [curriculumMatrix, setCurriculumMatrix] = useState<CurriculumMatrix[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);

  // Selection Filters
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Context Data: Prota, Prosem, RPMs
  const [prota, setProta] = useState<AnnualProgram | null>(null);
  const [promes, setPromes] = useState<SemesterProgram | null>(null);
  const [rpmsMap, setRpmsMap] = useState<Map<string, LearningDesignRpmData>>(new Map());

  // UI & Loading States
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [activeTopicForEdit, setActiveTopicForEdit] = useState<ProtaTopic | null>(null);
  const [activeRpmForPrint, setActiveRpmForPrint] = useState<LearningDesignRpmData | null>(null);

  // Form State for Editing/Creating RPM
  const [editingRpmId, setEditingRpmId] = useState<string | null>(null);
  const [editingRpmOriginalStatus, setEditingRpmOriginalStatus] = useState<RpmStatus | null>(null);
  const [editingRpmOwnerTeacherId, setEditingRpmOwnerTeacherId] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState<RpmStatus>("DRAFT");
  const [formReviewNotes, setFormReviewNotes] = useState<string>("");
  const [formMeetingPlans, setFormMeetingPlans] = useState<RpmMeetingPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmRpm, setDeleteConfirmRpm] = useState<LearningDesignRpmData | null>(null);

  // Role Checks
  const currentRole = user?.role?.toLowerCase() || "";
  const isAdminOrKurikulum =
    user?.roles?.some(r => ["admin", "kurikulum", "superadmin", "operator", "kepala sekolah", "wakil kepala sekolah"].includes(r.toLowerCase())) ||
    ["admin", "kurikulum", "superadmin", "operator", "kepala sekolah", "wakil kepala sekolah"].includes(currentRole);
  const isGuru = (user?.roles?.includes("guru") || currentRole === "guru") && !isAdminOrKurikulum;

  // 1. Initial Load of Master Data
  useEffect(() => {
    setLoadingMaster(true);
    Promise.all([
      classService.getClasses(),
      semesterService.getSemesters(),
      curriculumMatrixService.getCurriculumMatrix(),
      subjectService.getSubjects(),
      teacherAssignmentService.getTeacherAssignments()
    ])
      .then(([clsList, semList, matrixList, subList, assignList]) => {
        const activeCls = clsList.filter(c => c.status === "Aktif" && !c.isDeleted);
        setClasses(activeCls);
        setSemesters(semList);
        setCurriculumMatrix(matrixList);
        setSubjects(subList);
        setTeacherAssignments(assignList);

        // Build academic years list
        const yearsMap = new Map<string, string>();
        semList.forEach(s => {
          yearsMap.set(s.academicYearId, s.academicYearName);
        });
        const yearsArray = Array.from(yearsMap.entries()).map(([id, name]) => ({ id, name }));
        setAcademicYears(yearsArray);

        // Auto-select active semester and academic year
        const activeSem = semList.find(s => s.isActive);
        if (activeSem) {
          setSelectedAcademicYearId(activeSem.academicYearId);
          setSelectedSemesterId(activeSem.id);
        } else if (semList.length > 0) {
          setSelectedAcademicYearId(semList[0].academicYearId);
          setSelectedSemesterId(semList[0].id);
        }
      })
      .catch(err => {
        showToast("Gagal memuat master data kurikulum: " + err.message, "error");
      })
      .finally(() => setLoadingMaster(false));
  }, []);

  // 2. Compute Teacher's Direct Assignments (Context-Aware for Teachers)
  const teacherDirectAssignments: TeacherAssignmentOption[] = useMemo(() => {
    if (!classes.length || !curriculumMatrix.length) return [];

    const assignments: TeacherAssignmentOption[] = [];

    classes.forEach(cls => {
      const gLevel = cls.gradeLevel || "VII";
      curriculumMatrix.forEach(m => {
        const resolved = resolveTeacherAssignmentSync({
          academicYearId: selectedAcademicYearId,
          semesterId: selectedSemesterId,
          subjectId: m.subjectId,
          classId: cls.id,
          gradeLevel: gLevel,
          curriculumMatrixItem: m,
          preloadedAssignments: teacherAssignments
        });

        const jp = gLevel === "VII" ? m.jp_vii : gLevel === "VIII" ? m.jp_viii : m.jp_ix;
        if (!jp || jp <= 0) return;

        // Check if current user is the teacher
        let matches = false;
        if (isGuru && user) {
          if (user.teacherId && resolved.teacherId === user.teacherId) matches = true;
          if (user.uid && resolved.teacherId === user.uid) matches = true;
          const uName = (user.displayName || user.name || user.teacherName || "").toLowerCase().trim();
          const tName = (resolved.teacherName || "").toLowerCase().trim();
          if (uName && tName && (uName.includes(tName) || tName.includes(uName))) matches = true;
        } else if (!isGuru) {
          matches = true;
        }

        if (matches) {
          const masterSub = subjects.find(s => s.id === m.subjectId);
          assignments.push({
            classId: cls.id,
            className: cls.name,
            gradeLevel: gLevel,
            subjectId: m.subjectId,
            subjectName: masterSub?.name || m.subjectName,
            jp: jp
          });
        }
      });
    });

    return assignments;
  }, [
    classes,
    curriculumMatrix,
    selectedAcademicYearId,
    selectedSemesterId,
    teacherAssignments,
    subjects,
    isGuru,
    user
  ]);

  // Auto-select class & subject when teacher assignments are resolved
  useEffect(() => {
    if (!selectedClassId && !selectedSubjectId && teacherDirectAssignments.length > 0) {
      setSelectedClassId(teacherDirectAssignments[0].classId);
      setSelectedSubjectId(teacherDirectAssignments[0].subjectId);
    } else if (selectedClassId && !selectedSubjectId) {
      const match = teacherDirectAssignments.find(a => a.classId === selectedClassId);
      if (match) {
        setSelectedSubjectId(match.subjectId);
      }
    }
  }, [teacherDirectAssignments, selectedClassId, selectedSubjectId]);

  // If Admin / Kurikulum, get offered subjects for currently selected class
  const selectedClassObj = classes.find(c => c.id === selectedClassId);
  const gradeLevel = selectedClassObj?.gradeLevel || "VII";

  const offeredSubjectsForClass = useMemo(() => {
    if (!selectedClassId) return [];
    return curriculumMatrix
      .map(m => {
        const resolved = resolveTeacherAssignmentSync({
          academicYearId: selectedAcademicYearId,
          semesterId: selectedSemesterId,
          subjectId: m.subjectId,
          classId: selectedClassId,
          gradeLevel: gradeLevel,
          curriculumMatrixItem: m,
          preloadedAssignments: teacherAssignments
        });
        const jp = gradeLevel === "VII" ? m.jp_vii : gradeLevel === "VIII" ? m.jp_viii : m.jp_ix;
        const masterSub = subjects.find(s => s.id === m.subjectId);
        return {
          id: m.subjectId,
          name: masterSub?.name || m.subjectName,
          teacherId: resolved.teacherId,
          teacherName: resolved.teacherName,
          jp: jp || 0
        };
      })
      .filter(s => s.jp > 0);
  }, [
    curriculumMatrix,
    gradeLevel,
    subjects,
    selectedAcademicYearId,
    selectedSemesterId,
    selectedClassId,
    teacherAssignments
  ]);

  // Resolved teacher for current context
  const currentAssignedTeacher = useMemo(() => {
    if (!selectedClassId || !selectedSubjectId) return null;
    const m = curriculumMatrix.find(item => item.subjectId === selectedSubjectId);
    return resolveTeacherAssignmentSync({
      academicYearId: selectedAcademicYearId,
      semesterId: selectedSemesterId,
      subjectId: selectedSubjectId,
      classId: selectedClassId,
      gradeLevel: gradeLevel,
      curriculumMatrixItem: m,
      preloadedAssignments: teacherAssignments
    });
  }, [
    selectedClassId,
    selectedSubjectId,
    curriculumMatrix,
    selectedAcademicYearId,
    selectedSemesterId,
    gradeLevel,
    teacherAssignments
  ]);

  // 3. Load Prota, Prosem, and RPMs for the active selection
  useEffect(() => {
    if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId || !selectedSubjectId) {
      setProta(null);
      setPromes(null);
      setRpmsMap(new Map());
      return;
    }

    let isSubscribed = true;
    setLoadingContext(true);

    Promise.all([
      curriculumPlanningService.getAnnualProgram(selectedAcademicYearId, selectedClassId, selectedSubjectId),
      curriculumPlanningService.getSemesterProgram(selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId),
      learningDesignRpmService.getRpmsMapByContext({
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      })
    ])
      .then(([protaData, promesData, rpmsMapData]) => {
        if (!isSubscribed) return;
        setProta(protaData);
        setPromes(promesData);
        setRpmsMap(rpmsMapData);
      })
      .catch(err => {
        if (!isSubscribed) return;
        showToast("Gagal memuat konteks pembelajaran: " + err.message, "error");
      })
      .finally(() => {
        if (isSubscribed) setLoadingContext(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId]);

  // 4. Topics List for this context (Merged Prota & Prosem information)
  const contextTopics = useMemo(() => {
    if (!prota || !prota.topics || prota.topics.length === 0) {
      return [];
    }

    // Determine current semester string (Ganjil or Genap)
    const semObj = semesters.find(s => s.id === selectedSemesterId);
    const semName = semObj?.name?.toLowerCase() || "";
    const isGanjil = semObj?.semesterNumber === 1 || semName.includes("ganjil");
    const targetSemesterStr = isGanjil ? "Ganjil" : "Genap";

    // Filter topics assigned to this semester
    const topicsInSemester = prota.topics.filter(t => {
      if (!t.semester) return true;
      if (t.semester === "Ganjil & Genap") return true;
      return t.semester === targetSemesterStr;
    });

    // Enhance each topic with Prosem target JP and meetings
    return topicsInSemester.map(topic => {
      // Find prosem meetings for this topic
      const prosemMeetings = (promes?.meetings || []).filter(m => m.topicId === topic.id);

      // Target JP: either sum of prosem meetings jpCount, or sum of allocations jp, or topic.jp
      const meetingsJp = prosemMeetings.reduce((sum, m) => sum + (m.jpCount || 0), 0);
      const allocJp = (promes?.allocations || [])
        .filter(a => a.topicId === topic.id)
        .reduce((sum, a) => sum + (a.jp || 0), 0);
      const targetJp = meetingsJp > 0 ? meetingsJp : allocJp > 0 ? allocJp : (topic.jp || 0);

      // Find existing RPM
      const existingRpm = rpmsMap.get(topic.id) || null;

      // Calculate RPM total allocated JP
      const rpmAllocatedJp = existingRpm
        ? existingRpm.meetingPlans.reduce((acc, p) => acc + (p.allocatedJP || 0), 0)
        : 0;

      return {
        topic,
        targetJp,
        prosemMeetings,
        existingRpm,
        rpmAllocatedJp
      };
    });
  }, [prota, promes, rpmsMap, selectedSemesterId, semesters]);

  // Filtered Topics based on Search and Status Filter
  const filteredTopics = useMemo(() => {
    return contextTopics.filter(item => {
      const matchSearch =
        item.topic.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.topic.subtopics?.some(sub => sub.title.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchStatus = true;
      if (statusFilter === "PLANNED") {
        matchStatus = item.existingRpm !== null;
      } else if (statusFilter === "UNPLANNED") {
        matchStatus = item.existingRpm === null;
      } else if (statusFilter === "DRAFT") {
        matchStatus = item.existingRpm?.status === "DRAFT";
      } else if (statusFilter === "DITINJAU") {
        matchStatus = item.existingRpm?.status === "DITINJAU";
      } else if (statusFilter === "DISETUJUI") {
        matchStatus = item.existingRpm?.status === "DISETUJUI";
      }

      return matchSearch && matchStatus;
    });
  }, [contextTopics, searchTerm, statusFilter]);

  // Statistical Summary
  const stats = useMemo(() => {
    const totalTopics = contextTopics.length;
    const plannedTopics = contextTopics.filter(t => t.existingRpm !== null).length;
    const approvedTopics = contextTopics.filter(t => t.existingRpm?.status === "DISETUJUI").length;
    const totalTargetJp = contextTopics.reduce((acc, t) => acc + t.targetJp, 0);
    const totalPlannedJp = contextTopics.reduce((acc, t) => acc + t.rpmAllocatedJp, 0);

    return {
      totalTopics,
      plannedTopics,
      unplannedTopics: totalTopics - plannedTopics,
      approvedTopics,
      totalTargetJp,
      totalPlannedJp,
      completionPct: totalTopics > 0 ? Math.round((plannedTopics / totalTopics) * 100) : 0
    };
  }, [contextTopics]);

  // 5. Open RPM Editor (Create or Edit)
  const handleOpenEditor = (topic: ProtaTopic, existingRpm: LearningDesignRpmData | null) => {
    setActiveTopicForEdit(topic);

    if (existingRpm) {
      setEditingRpmId(existingRpm.id);
      setEditingRpmOriginalStatus(existingRpm.status || "DRAFT");
      setEditingRpmOwnerTeacherId(existingRpm.teacherId || null);
      setFormStatus(existingRpm.status || "DRAFT");
      setFormReviewNotes(existingRpm.reviewNotes || "");
      // Clone meeting plans
      setFormMeetingPlans(JSON.parse(JSON.stringify(existingRpm.meetingPlans || [])));
    } else {
      setEditingRpmId(null);
      setEditingRpmOriginalStatus(null);
      setEditingRpmOwnerTeacherId(null);
      setFormStatus("DRAFT");
      setFormReviewNotes("");

      // Find prosem meetings for this topic to suggest sensible initial sessions
      const prosemMeetings = (promes?.meetings || []).filter(m => m.topicId === topic.id);

      if (prosemMeetings.length > 0) {
        // Initialize from prosem meetings
        const initialPlans: RpmMeetingPlan[] = prosemMeetings.map((pm, idx) => ({
          meetingNo: idx + 1,
          prosemMeetingId: pm.id,
          allocatedJP: pm.jpCount || 2,
          subtopicId: pm.subtopicId,
          subtopicTitle: pm.subtopicTitle || (topic.subtopics && topic.subtopics[idx]?.title) || "",
          learningObjective: pm.tp || `Memahami konsep ${topic.title}${pm.subtopicTitle ? ` - ${pm.subtopicTitle}` : ""}`,
          modelOrMethod: "Problem-Based Learning (PBL)",
          activitiesOverview: {
            intro: "Membuka pelajaran dengan salam, doa, dan apersepsi mengaitkan materi dengan pengalaman nyata siswa.",
            core: `Peserta didik melakukan pengamatan, eksplorasi materi ${topic.title}, diskusi kelompok, dan menyampaikan hasil diskusi.`,
            closing: "Melakukan refleksi bersama siswa, menyimpulkan poin inti, dan menyampaikan topik pertemuan berikutnya."
          },
          mediaAndResources: "Buku Paket Pegangan Siswa, LCD Proyektor, Lembar Kerja Peserta Didik (LKPD)",
          assessmentPlan: "Formatif: Observasi keaktifan diskusi & kelengkapan LKPD",
          differentiationNotes: "Diferensiasi proses: Bimbingan terarah bagi kelompok yang membutuhkan dukungan."
        }));
        setFormMeetingPlans(initialPlans);
      } else {
        // Default single session
        const defaultJp = topic.jp && topic.jp > 0 ? Math.min(topic.jp, 2) : 2;
        setFormMeetingPlans([
          {
            meetingNo: 1,
            allocatedJP: defaultJp,
            subtopicId: topic.subtopics && topic.subtopics.length > 0 ? topic.subtopics[0].id : undefined,
            subtopicTitle: topic.subtopics && topic.subtopics.length > 0 ? topic.subtopics[0].title : "",
            learningObjective: `Memahami dan menganalisis ${topic.title}`,
            modelOrMethod: "Problem-Based Learning (PBL)",
            activitiesOverview: {
              intro: "Salam, doa bersama, presensi, serta apersepsi dan motivasi materi.",
              core: `Peserta didik mengamati materi ${topic.title}, berdiskusi aktif dalam kelompok kecil, dan mempresentasikan hasil pemahaman.`,
              closing: "Refleksi pembelajaran bersama siswa dan penarikan kesimpulan materi pokok."
            },
            mediaAndResources: "Buku Teks Kurikulum Merdeka, Media Presentasi / LKPD",
            assessmentPlan: "Formatif: Penilaian proses dan keaktifan peserta didik",
            differentiationNotes: ""
          }
        ]);
      }
    }

    setIsEditorOpen(true);
  };

  // Quick Action: Autofill Meeting Plans from Prosem
  const handleAutofillFromProsem = () => {
    if (!activeTopicForEdit) return;
    const prosemMeetings = (promes?.meetings || []).filter(m => m.topicId === activeTopicForEdit.id);

    if (prosemMeetings.length === 0) {
      showToast("Tidak ditemukan data jadwal pertemuan di Prosem untuk topik ini.", "warning");
      return;
    }

    const newPlans: RpmMeetingPlan[] = prosemMeetings.map((pm, idx) => ({
      meetingNo: idx + 1,
      prosemMeetingId: pm.id,
      allocatedJP: pm.jpCount || 2,
      subtopicId: pm.subtopicId,
      subtopicTitle: pm.subtopicTitle || "",
      learningObjective: pm.tp || `Menganalisis dan menguasai ${activeTopicForEdit.title}${pm.subtopicTitle ? ` - ${pm.subtopicTitle}` : ""}`,
      modelOrMethod: "Problem-Based Learning (PBL)",
      activitiesOverview: {
        intro: "Salam, apersepsi keterkaitan materi, dan penyampaian tujuan pembelajaran.",
        core: `Peserta didik mempelajari materi ${pm.subtopicTitle || activeTopicForEdit.title}, melakukan investigasi kelompok, dan menyusun laporan ringkas.`,
        closing: "Umpan balik penguatan guru, refleksi pembelajaran, dan penutup."
      },
      mediaAndResources: "Buku Siswa, LKPD Interaktif",
      assessmentPlan: "Formatif: Kuis singkat / Penilaian kinerja diskusi",
      differentiationNotes: ""
    }));

    setFormMeetingPlans(newPlans);
    showToast(`Berhasil menyinkronkan ${newPlans.length} pertemuan dari Prosem!`, "success");
  };

  // Add a new meeting plan row
  const handleAddMeetingPlan = () => {
    const nextNo = formMeetingPlans.length + 1;
    setFormMeetingPlans(prev => [
      ...prev,
      {
        meetingNo: nextNo,
        allocatedJP: 2,
        subtopicTitle: "",
        learningObjective: "",
        modelOrMethod: "Problem-Based Learning (PBL)",
        activitiesOverview: {
          intro: "",
          core: "",
          closing: ""
        },
        mediaAndResources: "",
        assessmentPlan: "",
        differentiationNotes: ""
      }
    ]);
  };

  // Remove a meeting plan row
  const handleRemoveMeetingPlan = (index: number) => {
    if (formMeetingPlans.length <= 1) {
      showToast("RPM minimal harus memiliki 1 pertemuan terencana.", "warning");
      return;
    }
    const updated = formMeetingPlans.filter((_, i) => i !== index);
    // Renumber meetingNo sequentially
    const renumbered = updated.map((item, idx) => ({
      ...item,
      meetingNo: idx + 1
    }));
    setFormMeetingPlans(renumbered);
  };

  // Update a field in a specific meeting plan
  const handleUpdatePlanField = (index: number, field: keyof RpmMeetingPlan, value: any) => {
    setFormMeetingPlans(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Update nested activities overview
  const handleUpdateActivities = (
    index: number,
    activityType: "intro" | "core" | "closing",
    value: string
  ) => {
    setFormMeetingPlans(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        activitiesOverview: {
          ...copy[index].activitiesOverview,
          [activityType]: value
        }
      };
      return copy;
    });
  };

  // Calculate total JP in currently edited form
  const formTotalJp = useMemo(() => {
    return formMeetingPlans.reduce((acc, p) => acc + (Number(p.allocatedJP) || 0), 0);
  }, [formMeetingPlans]);

  // Target JP for active topic
  const activeTopicTargetJp = useMemo(() => {
    if (!activeTopicForEdit) return 0;
    const prosemMeetings = (promes?.meetings || []).filter(m => m.topicId === activeTopicForEdit.id);
    const meetingsJp = prosemMeetings.reduce((sum, m) => sum + (m.jpCount || 0), 0);
    const allocJp = (promes?.allocations || [])
      .filter(a => a.topicId === activeTopicForEdit.id)
      .reduce((sum, a) => sum + (a.jp || 0), 0);
    return meetingsJp > 0 ? meetingsJp : allocJp > 0 ? allocJp : (activeTopicForEdit.jp || 0);
  }, [activeTopicForEdit, promes]);

  // 6. Save RPM (Create or Update)
  const handleSaveRpm = async () => {
    if (!activeTopicForEdit) return;

    // Validate Form
    if (formMeetingPlans.length === 0) {
      showToast("Minimal harus memiliki 1 rencana pertemuan.", "error");
      return;
    }

    for (let i = 0; i < formMeetingPlans.length; i++) {
      const p = formMeetingPlans[i];
      if (!p.learningObjective || p.learningObjective.trim() === "") {
        showToast(`Pertemuan #${i + 1}: Tujuan Pembelajaran (TP) wajib diisi.`, "error");
        return;
      }
      if (!p.modelOrMethod || p.modelOrMethod.trim() === "") {
        showToast(`Pertemuan #${i + 1}: Model/Metode Pembelajaran wajib diisi.`, "error");
        return;
      }
      if (!p.activitiesOverview || !p.activitiesOverview.core || p.activitiesOverview.core.trim() === "") {
        showToast(`Pertemuan #${i + 1}: Kegiatan Inti wajib diisi.`, "error");
        return;
      }
      if (typeof p.allocatedJP !== "number" || p.allocatedJP <= 0) {
        showToast(`Pertemuan #${i + 1}: Alokasi JP harus berupa angka positif.`, "error");
        return;
      }
    }

    const semObj = semesters.find(s => s.id === selectedSemesterId);
    const clsObj = classes.find(c => c.id === selectedClassId);
    const subObj = subjects.find(s => s.id === selectedSubjectId);

    const yearName = semObj?.academicYearName || academicYears.find(y => y.id === selectedAcademicYearId)?.name || "2026/2027";
    const semName = semObj?.name || "Semester Ganjil";
    const className = clsObj?.name || "Kelas";
    const subjectName = subObj?.name || "Mata Pelajaran";

    const teacherId = currentAssignedTeacher?.teacherId || user?.teacherId || user?.uid || "UNKNOWN_TEACHER";
    const teacherName = currentAssignedTeacher?.teacherName || user?.displayName || user?.name || "Guru Pengampu";

    const currentUserId = user?.uid || "SYSTEM";
    const currentUserName = user?.displayName || user?.name || "User";

    setSaving(true);
    try {
      if (editingRpmId) {
        // Update existing RPM
        await learningDesignRpmService.updateRpm(
          editingRpmId,
          {
            meetingPlans: formMeetingPlans,
            status: formStatus,
            reviewNotes: formReviewNotes,
            totalTargetJP: activeTopicTargetJp
          },
          currentUserId,
          currentUserName,
          { isApprover: isAdminOrKurikulum }
        );
        showToast("Rancangan Pembelajaran (RPM) berhasil diperbarui!", "success");
      } else {
        // Create new RPM
        await learningDesignRpmService.createRpm(
          {
            academicYearId: selectedAcademicYearId,
            academicYearName: yearName,
            semesterId: selectedSemesterId,
            semesterName: semName,
            classId: selectedClassId,
            className: className,
            subjectId: selectedSubjectId,
            subjectName: subjectName,
            teacherId: teacherId,
            teacherName: teacherName,
            topicId: activeTopicForEdit.id,
            topicTitle: activeTopicForEdit.title,
            topicOrder: activeTopicForEdit.order,
            totalTargetJP: activeTopicTargetJp,
            meetingPlans: formMeetingPlans,
            status: formStatus,
            reviewNotes: formReviewNotes
          },
          currentUserId,
          currentUserName,
          { isApprover: isAdminOrKurikulum }
        );
        showToast("Rancangan Pembelajaran (RPM) berhasil dibuat!", "success");
      }

      // Refresh RPMs map
      const freshRpms = await learningDesignRpmService.getRpmsMapByContext({
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      });
      setRpmsMap(freshRpms);
      setIsEditorOpen(false);
    } catch (err: any) {
      showToast("Gagal menyimpan RPM: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  // 7. Delete RPM
  const handleConfirmDelete = async () => {
    if (!deleteConfirmRpm) return;
    try {
      await learningDesignRpmService.deleteRpm(
        deleteConfirmRpm.id,
        user?.uid || "SYSTEM",
        user?.displayName || "User"
      );
      showToast("Rancangan Pembelajaran (RPM) berhasil dihapus.", "success");

      // Refresh RPMs map
      const freshRpms = await learningDesignRpmService.getRpmsMapByContext({
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      });
      setRpmsMap(freshRpms);
      setDeleteConfirmRpm(null);
    } catch (err: any) {
      showToast("Gagal menghapus RPM: " + err.message, "error");
    }
  };

  // 8. Open Print / Export Modal
  const handleOpenPrint = (rpm: LearningDesignRpmData) => {
    setActiveRpmForPrint(rpm);
    setIsPrintModalOpen(true);
  };

  // Trigger browser printing
  const handlePrintDocument = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Kurikulum Merdeka
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Perencanaan Operasional
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            RPM — Rancangan Pembelajaran
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ringkasan rencana pembelajaran praktis per topik/bab yang terhubung langsung dengan target kurikulum Prosem.
          </p>
        </div>

        {/* Quick Context Summary Pill */}
        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-500 font-medium">Konteks Aktif:</span>
            <span className="font-bold text-slate-800">
              {classes.find(c => c.id === selectedClassId)?.name || "Pilih Kelas"} •{" "}
              {subjects.find(s => s.id === selectedSubjectId)?.name || "Pilih Mapel"}
            </span>
            <span className="text-slate-500">
              Guru: {currentAssignedTeacher?.teacherName || "Belum Ditetapkan"}
            </span>
          </div>
        </div>
      </div>

      {/* TEACHER ASSIGNMENT QUICK-SWITCHER (For logged-in Teachers) */}
      {isGuru && teacherDirectAssignments.length > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-emerald-700" />
              Penugasan Mengajar Anda (Pilih Cepat):
            </span>
            <span className="text-xs text-emerald-700">
              {teacherDirectAssignments.length} Kelas Terdaftar
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {teacherDirectAssignments.map(assign => {
              const isSelected =
                assign.classId === selectedClassId && assign.subjectId === selectedSubjectId;
              return (
                <button
                  key={`${assign.classId}_${assign.subjectId}`}
                  type="button"
                  onClick={() => {
                    setSelectedClassId(assign.classId);
                    setSelectedSubjectId(assign.subjectId);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-emerald-700 text-white shadow-xs scale-102"
                      : "bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100"
                  }`}
                >
                  <span className="font-bold">{assign.className}</span>
                  <span className="opacity-75">•</span>
                  <span>{assign.subjectName}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-800/20">
                    {assign.jp} JP
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & CONTEXT SELECTOR BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tahun Ajaran */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tahun Ajaran</label>
            <select
              value={selectedAcademicYearId}
              onChange={e => setSelectedAcademicYearId(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white py-2"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
            <select
              value={selectedSemesterId}
              onChange={e => setSelectedSemesterId(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white py-2"
            >
              {semesters
                .filter(s => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.isActive ? "(Aktif)" : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* Kelas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas</label>
            <select
              value={selectedClassId}
              onChange={e => {
                setSelectedClassId(e.target.value);
                setSelectedSubjectId("");
              }}
              className="w-full text-xs rounded-xl border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white py-2"
            >
              <option value="">-- Pilih Kelas --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.gradeLevel || "Tingkat " + (c.grade || "VII")})
                </option>
              ))}
            </select>
          </div>

          {/* Mata Pelajaran */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mata Pelajaran</label>
            <select
              value={selectedSubjectId}
              onChange={e => setSelectedSubjectId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full text-xs rounded-xl border-slate-300 focus:border-emerald-500 focus:ring-emerald-500 bg-white py-2 disabled:bg-slate-100"
            >
              <option value="">-- Pilih Mata Pelajaran --</option>
              {offeredSubjectsForClass.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.jp} JP) - {s.teacherName || "Belum ada guru"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search & Status Quick Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari topik atau subtopik..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <span className="text-xs text-slate-500 font-medium">Filter Status:</span>
            {[
              { id: "ALL", label: "Semua" },
              { id: "PLANNED", label: "Sudah Dirancang" },
              { id: "UNPLANNED", label: "Belum Dirancang" },
              { id: "DISETUJUI", label: "Disetujui" }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === f.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DASHBOARD STATS WIDGET */}
      {selectedClassId && selectedSubjectId && prota && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Total Topik / Bab</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900">{stats.totalTopics}</span>
              <span className="text-xs text-slate-500">topik semester ini</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full"
                style={{ width: `${stats.completionPct}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Status Perancangan</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-600">{stats.plannedTopics}</span>
              <span className="text-xs text-slate-500">dari {stats.totalTopics} dirancang</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block">
              {stats.unplannedTopics > 0 ? `${stats.unplannedTopics} topik belum ada RPM` : "Semua topik telah dirancang"}
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Total Alokasi Rencana</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-blue-600">{stats.totalPlannedJp}</span>
              <span className="text-xs text-slate-500">/ {stats.totalTargetJp} Target JP</span>
            </div>
            <span className="text-[11px] text-slate-400 mt-2 block">
              Berdasarkan distribusi Prosem
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block">Kelengkapan RPM</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold text-emerald-700">{stats.completionPct}%</span>
              <span className="text-xs text-slate-500">selesai</span>
            </div>
            <span className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> {stats.approvedTopics} Disetujui Waka Kurikulum
            </span>
          </div>
        </div>
      )}

      {/* TOPIC LIST & RPM STATUS */}
      {loadingContext ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto" />
          <p className="text-xs text-slate-500 mt-3">Memuat rancangan pembelajaran dan kurikulum...</p>
        </div>
      ) : !selectedClassId || !selectedSubjectId ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Pilih Kelas dan Mata Pelajaran</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            Silakan pilih kelas dan mata pelajaran di atas untuk melihat target pembelajaran dan menyusun Rancangan Pembelajaran (RPM).
          </p>
        </div>
      ) : !prota || contextTopics.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-amber-900">Belum Ada Target Topik di Program Tahunan (Prota)</h3>
          <p className="text-xs text-amber-700 max-w-md mx-auto mt-1">
            Topik materi pembelajaran belum disusun di menu Program Tahunan (Prota) untuk kelas dan mapel ini. Susun Prota terlebih dahulu agar RPM dapat dihubungkan ke target pembelajaran.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              Daftar Topik & Rancangan Pembelajaran ({filteredTopics.length} Topik)
            </h2>
            <span className="text-xs text-slate-500">
              Target Kurikulum: <strong className="text-slate-800">{prota.className}</strong> •{" "}
              <strong className="text-slate-800">{prota.subjectName}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredTopics.map((item, index) => {
              const { topic, targetJp, prosemMeetings, existingRpm, rpmAllocatedJp } = item;
              const hasRpm = existingRpm !== null;

              return (
                <div
                  key={topic.id}
                  className={`bg-white rounded-2xl border transition-all p-5 shadow-xs ${
                    hasRpm
                      ? "border-slate-200 hover:border-slate-300"
                      : "border-amber-200/80 bg-amber-50/20 hover:border-amber-300"
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Topic Left Content */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                          Topik #{index + 1}
                        </span>

                        {hasRpm ? (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                              existingRpm.status === "DISETUJUI"
                                ? "bg-emerald-100 text-emerald-800"
                                : existingRpm.status === "DITINJAU"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {existingRpm.status === "DISETUJUI" && <Check className="w-3 h-3" />}
                            {existingRpm.status === "DITINJAU" && <Clock className="w-3 h-3" />}
                            {existingRpm.status === "DRAFT" && <Edit3 className="w-3 h-3" />}
                            RPM: {existingRpm.status}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                            Belum Dirancang
                          </span>
                        )}

                        <span className="text-xs text-slate-500 font-medium">
                          Target Prosem: <strong className="text-slate-700">{targetJp} JP</strong>
                        </span>

                        {hasRpm && (
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                              rpmAllocatedJp === targetJp
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            Alokasi RPM: {rpmAllocatedJp} JP
                            {rpmAllocatedJp !== targetJp && " ⚠️ (Beda Target)"}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{topic.title}</h3>

                      {/* Subtopics Chips */}
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-slate-400 font-medium">Submateri:</span>
                          {topic.subtopics.map(sub => (
                            <span
                              key={sub.id}
                              className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-md text-[11px]"
                            >
                              {sub.title} ({sub.jp || 0} JP)
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meeting summary pill */}
                      {hasRpm && (
                        <div className="pt-2 text-xs text-slate-600 flex flex-wrap items-center gap-3">
                          <span className="font-semibold text-slate-700">
                            {existingRpm.meetingPlans.length} Sesi Pertemuan Dirancang:
                          </span>
                          {existingRpm.meetingPlans.map(p => (
                            <span
                              key={p.meetingNo}
                              className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-700"
                            >
                              Pertemuan {p.meetingNo} ({p.allocatedJP} JP) - {p.modelOrMethod}
                            </span>
                          ))}
                        </div>
                      )}

                      {hasRpm && existingRpm.reviewNotes && (
                        <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs text-blue-900 mt-2">
                          <strong className="block font-semibold">Catatan Kurikulum / Review:</strong>
                          {existingRpm.reviewNotes}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {hasRpm ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditor(topic, existingRpm)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit RPM
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenPrint(existingRpm)}
                            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Pratinjau & Cetak Lembar Rencana Mengajar"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-500" />
                            Cetak
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteConfirmRpm(existingRpm)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Hapus RPM"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenEditor(topic, null)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Rancang RPM
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RPM EDITOR MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditorOpen && activeTopicForEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500 text-slate-950">
                      RPM EDITOR
                    </span>
                    <span className="text-xs text-slate-300">
                      {classes.find(c => c.id === selectedClassId)?.name} •{" "}
                      {subjects.find(s => s.id === selectedSubjectId)?.name}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold">{activeTopicForEdit.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Target Alokasi Prosem: <strong>{activeTopicTargetJp} JP</strong> • Total Terencana Saat Ini:{" "}
                    <strong className={formTotalJp === activeTopicTargetJp ? "text-emerald-400" : "text-amber-400"}>
                      {formTotalJp} JP
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="text-slate-400 hover:text-white p-2 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
                {/* Warning Banner if Editing previously Approved RPM */}
                {editingRpmOriginalStatus === "DISETUJUI" && (
                  <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block uppercase tracking-wider text-[11px] text-amber-900">
                        Peringatan: RPM Ini Sebelumnya Berstatus DISETUJUI
                      </span>
                      <p className="mt-0.5 text-amber-800 leading-relaxed">
                        Mengubah isi rencana pembelajaran pada dokumen yang telah disetujui akan secara otomatis membatalkan status pengesahan dan mengembalikannya ke status <strong>DRAFT</strong>. Seluruh tanda pengesahan lama dibatalkan, dan dokumen harus diajukan ulang (DITINJAU) ke Waka Kurikulum.
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>
                      Rancang proses mengajar praktis per pertemuan. Gunakan tombol di samping untuk menyalin otomatis dari jadwal Prosem.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAutofillFromProsem}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    Salin Kerangka dari Prosem
                  </button>
                </div>

                {/* Sesi / Pertemuan List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Rencana Sesi Pembelajaran ({formMeetingPlans.length} Pertemuan)
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddMeetingPlan}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Tambah Pertemuan
                    </button>
                  </div>

                  {formMeetingPlans.map((plan, idx) => (
                    <div
                      key={idx}
                      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4"
                    >
                      {/* Meeting Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                            #{plan.meetingNo}
                          </span>
                          <span className="text-sm font-bold text-slate-800">
                            Pertemuan Ke-{plan.meetingNo}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <label className="text-xs font-semibold text-slate-600">Alokasi JP:</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={plan.allocatedJP}
                              onChange={e =>
                                handleUpdatePlanField(idx, "allocatedJP", Number(e.target.value))
                              }
                              className="w-16 px-2 py-1 text-xs font-bold rounded-lg border-slate-300 text-center"
                            />
                          </div>
                          {formMeetingPlans.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMeetingPlan(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Hapus sesi ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Submateri & TP */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Fokus Subtopik / Materi Pokok
                          </label>
                          {activeTopicForEdit.subtopics && activeTopicForEdit.subtopics.length > 0 ? (
                            <select
                              value={plan.subtopicTitle || ""}
                              onChange={e => {
                                const selectedSub = activeTopicForEdit.subtopics?.find(
                                  s => s.title === e.target.value
                                );
                                handleUpdatePlanField(idx, "subtopicTitle", e.target.value);
                                if (selectedSub) {
                                  handleUpdatePlanField(idx, "subtopicId", selectedSub.id);
                                }
                              }}
                              className="w-full text-xs rounded-xl border-slate-300 py-2"
                            >
                              <option value="">-- Seluruh Topik / Umum --</option>
                              {activeTopicForEdit.subtopics.map(sub => (
                                <option key={sub.id} value={sub.title}>
                                  {sub.title} ({sub.jp || 0} JP)
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Materi pokok pertemuan ini..."
                              value={plan.subtopicTitle || ""}
                              onChange={e => handleUpdatePlanField(idx, "subtopicTitle", e.target.value)}
                              className="w-full text-xs rounded-xl border-slate-300 py-2"
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Model / Metode Pembelajaran <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            list={`models-list-${idx}`}
                            placeholder="Pilih atau ketik model pembelajaran..."
                            value={plan.modelOrMethod}
                            onChange={e => handleUpdatePlanField(idx, "modelOrMethod", e.target.value)}
                            className="w-full text-xs rounded-xl border-slate-300 py-2"
                          />
                          <datalist id={`models-list-${idx}`}>
                            {COMMON_LEARNING_MODELS.map(m => (
                              <option key={m} value={m} />
                            ))}
                          </datalist>
                        </div>
                      </div>

                      {/* Tujuan Pembelajaran (TP) */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Tujuan Pembelajaran (TP) Sesi Ini <span className="text-rose-500">*</span>
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Peserta didik mampu memahami dan menganalisis..."
                          value={plan.learningObjective}
                          onChange={e =>
                            handleUpdatePlanField(idx, "learningObjective", e.target.value)
                          }
                          className="w-full text-xs rounded-xl border-slate-300 py-2"
                        />
                      </div>

                      {/* Ringkasan Kegiatan (Awal, Inti, Penutup) */}
                      <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                          Ringkasan Langkah Pembelajaran
                        </span>

                        <div className="space-y-2">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              1. Kegiatan Awal / Apersepsi (Orientasi & Motivasi)
                            </label>
                            <input
                              type="text"
                              placeholder="Salam, doa, presensi, apersepsi review materi..."
                              value={plan.activitiesOverview?.intro || ""}
                              onChange={e => handleUpdateActivities(idx, "intro", e.target.value)}
                              className="w-full text-xs rounded-lg border-slate-300 py-1.5"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              2. Kegiatan Inti (Eksplorasi, Kolaborasi & Praktik Siswa) <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Peserta didik secara berkelompok mendiskusikan studi kasus, menganalisis data, dan menyajikan hasil..."
                              value={plan.activitiesOverview?.core || ""}
                              onChange={e => handleUpdateActivities(idx, "core", e.target.value)}
                              className="w-full text-xs rounded-lg border-slate-300 py-1.5"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              3. Kegiatan Penutup (Refleksi & Simpulan)
                            </label>
                            <input
                              type="text"
                              placeholder="Guru bersama siswa menyimpulkan poin pokok, refleksi, tugas lanjutan..."
                              value={plan.activitiesOverview?.closing || ""}
                              onChange={e => handleUpdateActivities(idx, "closing", e.target.value)}
                              className="w-full text-xs rounded-lg border-slate-300 py-1.5"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Media & Asesmen (Optional praktis) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Media & Sumber Belajar
                          </label>
                          <input
                            type="text"
                            placeholder="Buku Siswa Hal..., Video YouTube, LKPD..."
                            value={plan.mediaAndResources || ""}
                            onChange={e =>
                              handleUpdatePlanField(idx, "mediaAndResources", e.target.value)
                            }
                            className="w-full text-xs rounded-xl border-slate-300 py-2"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Rencana Asesmen
                          </label>
                          <input
                            type="text"
                            placeholder="Formatif: Observasi keaktifan diskusi, Sumatif: Kuis..."
                            value={plan.assessmentPlan || ""}
                            onChange={e => handleUpdatePlanField(idx, "assessmentPlan", e.target.value)}
                            className="w-full text-xs rounded-xl border-slate-300 py-2"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Status & Review Controls */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  {(() => {
                    const isSelfRpm = Boolean(
                      isAdminOrKurikulum &&
                      ((editingRpmOwnerTeacherId && (editingRpmOwnerTeacherId === user?.teacherId || editingRpmOwnerTeacherId === user?.uid)) ||
                       (!editingRpmId && currentAssignedTeacher?.teacherId === user?.teacherId))
                    );

                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="block text-xs font-bold text-slate-800">Status Dokumen RPM</label>
                            <p className="text-[11px] text-slate-500">
                              {isGuru
                                ? "Guru dapat menyimpan sebagai DRAFT atau DITINJAU (diajukan ke Waka Kurikulum)."
                                : isSelfRpm
                                ? "Persetujuan mandiri dicegah: Dokumen Anda harus disetujui oleh staf kurikulum / pimpinan lain."
                                : "Kurikulum / Pimpinan dapat menyetujui dokumen (DISETUJUI)."}
                            </p>
                          </div>

                          <select
                            value={formStatus}
                            onChange={e => setFormStatus(e.target.value as RpmStatus)}
                            className="text-xs font-bold rounded-xl border-slate-300 py-1.5 px-3 bg-white"
                          >
                            <option value="DRAFT">🟡 DRAFT (Dalam Pengerjaan)</option>
                            <option value="DITINJAU">🔵 DITINJAU (Diajukan)</option>
                            {isAdminOrKurikulum && !isSelfRpm && (
                              <option value="DISETUJUI">🟢 DISETUJUI (Disahkan)</option>
                            )}
                          </select>
                        </div>

                        {isAdminOrKurikulum && !isSelfRpm && (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Catatan Review / Umpan Balik Kurikulum
                            </label>
                            <textarea
                              rows={2}
                              placeholder="Tambahkan catatan masukan perbaikan atau persetujuan..."
                              value={formReviewNotes}
                              onChange={e => setFormReviewNotes(e.target.value)}
                              className="w-full text-xs rounded-xl border-slate-300 py-2"
                            />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Total Alokasi Rencana:{" "}
                  <strong className={formTotalJp === activeTopicTargetJp ? "text-emerald-600" : "text-amber-600"}>
                    {formTotalJp} JP
                  </strong>{" "}
                  (Target Prosem: {activeTopicTargetJp} JP)
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveRpm}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {saving && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />}
                    Simpan Rancangan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* PRINTABLE PREVIEW MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPrintModalOpen && activeRpmForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 max-h-[92vh] flex flex-col"
            >
              {/* Top Controls Bar (Hidden when printed) */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold">Pratinjau Lembar RPM Siap Cetak</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintDocument}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak Dokumen
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Content Paper (A4 Style) */}
              <div className="p-8 overflow-y-auto space-y-6 flex-1 bg-white text-slate-900 print:p-0 print:m-0">
                {/* Header Kop */}
                <div className="text-center border-b-2 border-slate-900 pb-3">
                  <h2 className="text-lg font-black tracking-wider uppercase">SMP AL-KARIM RASYID</h2>
                  <h3 className="text-base font-bold uppercase text-slate-800">
                    RANCANGAN PEMBELAJARAN (RPM)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Kurikulum Merdeka • Tahun Pelajaran {activeRpmForPrint.academicYearName}
                  </p>
                </div>

                {/* Identity Metadata Table */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 print:bg-transparent print:border-none print:p-0">
                  <div className="flex">
                    <span className="w-32 font-semibold text-slate-600">Mata Pelajaran:</span>
                    <span className="font-bold text-slate-900">{activeRpmForPrint.subjectName}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-semibold text-slate-600">Kelas / Semester:</span>
                    <span className="font-bold text-slate-900">
                      {activeRpmForPrint.className} / {activeRpmForPrint.semesterName}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-semibold text-slate-600">Topik / Bab Pokok:</span>
                    <span className="font-bold text-slate-900">{activeRpmForPrint.topicTitle}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-semibold text-slate-600">Guru Pengampu:</span>
                    <span className="font-bold text-slate-900">{activeRpmForPrint.teacherName}</span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-semibold text-slate-600">Alokasi Target JP:</span>
                    <span className="font-bold text-slate-900">
                      {activeRpmForPrint.totalTargetJP} Jam Pelajaran (JP)
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-32 font-semibold text-slate-600">Status Validasi:</span>
                    <span className="font-bold text-emerald-700">{activeRpmForPrint.status}</span>
                  </div>
                </div>

                {/* Meeting Plans Table */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                    I. Matriks Rencana Pelaksanaan Pembelajaran
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100 text-slate-800 font-bold text-left">
                          <th className="border border-slate-300 p-2 w-16 text-center">Pert.</th>
                          <th className="border border-slate-300 p-2 w-48">Materi & Tujuan (TP)</th>
                          <th className="border border-slate-300 p-2 w-40">Model & Media</th>
                          <th className="border border-slate-300 p-2">Ringkasan Langkah Pembelajaran</th>
                          <th className="border border-slate-300 p-2 w-36">Asesmen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeRpmForPrint.meetingPlans.map((plan, idx) => (
                          <tr key={idx} className="align-top hover:bg-slate-50/50">
                            <td className="border border-slate-300 p-2 text-center font-bold">
                              Ke-{plan.meetingNo}
                              <span className="block text-[10px] text-slate-500 font-normal">
                                ({plan.allocatedJP} JP)
                              </span>
                            </td>
                            <td className="border border-slate-300 p-2 space-y-1">
                              {plan.subtopicTitle && (
                                <strong className="block text-slate-900">{plan.subtopicTitle}</strong>
                              )}
                              <p className="text-slate-700 text-[11px] leading-relaxed">
                                {plan.learningObjective}
                              </p>
                            </td>
                            <td className="border border-slate-300 p-2 space-y-1">
                              <span className="font-semibold text-slate-800 block">
                                {plan.modelOrMethod}
                              </span>
                              {plan.mediaAndResources && (
                                <span className="text-[10px] text-slate-500 block">
                                  Media: {plan.mediaAndResources}
                                </span>
                              )}
                            </td>
                            <td className="border border-slate-300 p-2 space-y-1.5 leading-relaxed text-[11px]">
                              {plan.activitiesOverview?.intro && (
                                <div>
                                  <strong className="text-slate-800">Awal: </strong>
                                  <span className="text-slate-600">{plan.activitiesOverview.intro}</span>
                                </div>
                              )}
                              <div>
                                <strong className="text-slate-900">Inti: </strong>
                                <span className="text-slate-800">{plan.activitiesOverview?.core}</span>
                              </div>
                              {plan.activitiesOverview?.closing && (
                                <div>
                                  <strong className="text-slate-800">Penutup: </strong>
                                  <span className="text-slate-600">{plan.activitiesOverview.closing}</span>
                                </div>
                              )}
                            </td>
                            <td className="border border-slate-300 p-2 text-[11px] text-slate-700">
                              {plan.assessmentPlan || "Observasi & Formatif"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signature Block */}
                <div className="pt-6 grid grid-cols-2 gap-8 text-xs text-center">
                  <div>
                    <p className="text-slate-600">Mengetahui,</p>
                    <p className="font-bold text-slate-800">Kepala Sekolah / Waka Kurikulum</p>
                    <div className="h-16" />
                    <p className="font-bold text-slate-900 underline">
                      {activeRpmForPrint.approvedBy || "Waka Kurikulum SMP ALKARIM"}
                    </p>
                    <p className="text-slate-500 text-[10px]">NIP / NIY: -</p>
                  </div>

                  <div>
                    <p className="text-slate-600">Bandung Barat,</p>
                    <p className="font-bold text-slate-800">Guru Mata Pelajaran</p>
                    <div className="h-16" />
                    <p className="font-bold text-slate-900 underline">{activeRpmForPrint.teacherName}</p>
                    <p className="text-slate-500 text-[10px]">NIP / NIY: -</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmRpm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white max-w-md w-full rounded-2xl p-6 shadow-xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600 mb-3">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-base font-bold text-slate-900">Hapus Rancangan Pembelajaran?</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus RPM topik{" "}
                <strong className="text-slate-900">"{deleteConfirmRpm.topicTitle}"</strong>? Data rencana pertemuan yang telah disusun akan dihapus secara permanen.
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmRpm(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Hapus RPM
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LearningDesignRpm;
