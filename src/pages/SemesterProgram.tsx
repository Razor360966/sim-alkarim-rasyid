import React, { useState, useEffect, useMemo } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { curriculumPlanningService } from "../services/curriculumPlanning.service";
import { realTeachingHoursService } from "../services/realTeachingHours.service";
import { lessonPlanService } from "../services/lessonPlan.service";
import { teachingJournalService } from "../services/teachingJournalService";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import type {
  Semester, 
  Class, 
  CurriculumMatrix, 
  AnnualProgram as AnnualProgramData, 
  SemesterProgram as SemesterProgramData, 
  PromesAllocation, 
  PromesMeetingEntry,
  ProtaTopic, 
  ProtaSubTopic,
  LessonPlan,
  TeachingJournal,
  TeachingDateDetail
} from "../types";
import { 
  Calendar, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  RefreshCw, 
  Save, 
  Info,
  AlertTriangle,
  Grid,
  CornerDownRight,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Copy,
  Trash2,
  ListFilter,
  Sparkles,
  Sliders,
  Check,
  X,
  Palette,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  Lock,
  BookOpen,
  Layers,
  Eye,
  ArrowRight,
  Search,
  Filter,
  TrendingUp,
  Printer,
  Building2,
  UserCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";

interface WeekColumn {
  key: string; // e.g., "Juli 2026_w0"
  month: string; // "Juli 2026"
  weekIndex: number; // 0, 1, 2...
  label: string; // "1", "2"...
}

export const SemesterProgram: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Background color selection state for JP cells in administrative view
  const [selectedBgTheme, setSelectedBgTheme] = useState<string>(() => {
    return localStorage.getItem("prosem_jp_color") || "blue";
  });

  const colorPresets = useMemo(() => [
    { name: "Biru", value: "blue" },
    { name: "Hijau", value: "emerald" },
    { name: "Kuning", value: "amber" },
    { name: "Ungu", value: "purple" },
    { name: "Merah", value: "rose" },
    { name: "Abu-abu", value: "slate" },
  ], []);

  // View Modes: "dates" (Real Teaching Schedule), "weeks" (Admin Weekly), "timeline" (Chronological Timeline)
  const [viewMode, setViewMode] = useState<"dates" | "weeks" | "timeline">("dates");
  const [weeklyMatrixSubMode, setWeeklyMatrixSubMode] = useState<boolean>(false);

  // Filter States
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Master Data States
  const [classes, setClasses] = useState<Class[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [curriculumMatrix, setCurriculumMatrix] = useState<CurriculumMatrix[]>([]);

  // Selection States
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // RPE & Calculated Real Teaching Data
  const [weeksAnalysis, setWeeksAnalysis] = useState<any | null>(null);
  const [weekColumns, setWeekColumns] = useState<WeekColumn[]>([]);
  const [weeklyJp, setWeeklyJp] = useState<number>(0);
  const [effectiveWeeksCount, setEffectiveWeeksCount] = useState<number>(0);
  const [effectiveJpSemester, setEffectiveJpSemester] = useState<number>(0);
  const [teacherName, setTeacherName] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");

  // Real Teaching Date Details from Single Source of Truth
  const [realDateDetails, setRealDateDetails] = useState<TeachingDateDetail[]>([]);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [journals, setJournals] = useState<TeachingJournal[]>([]);

  // Active Program Semester (Promes), Source Prota, and Meetings list
  const [promes, setPromes] = useState<SemesterProgramData | null>(null);
  const [sourceProta, setSourceProta] = useState<AnnualProgramData | null>(null);
  const [meetings, setMeetings] = useState<PromesMeetingEntry[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [syncAlert, setSyncAlert] = useState<string | null>(null);
  const isSyncingRef = React.useRef(false);

  // Expanded State for Collapsible Topics
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Cell Allocation Modal States (For Admin Weekly Matrix)
  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    topicId: string;
    subtopicId?: string;
    weekKey: string;
    monthLabel: string;
    weekNum: string;
    materiTitle: string;
    materiAllocatedJp: number;
    currentCellJp: number;
  } | null>(null);

  const [inputCellJp, setInputCellJp] = useState<number>(0);
  const [actionType, setActionType] = useState<"normal" | "copy" | "move">("normal");
  const [targetWeekKey, setTargetWeekKey] = useState<string>("");

  // Schedule Adjustment Modal States
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedMeetingToAdjust, setSelectedMeetingToAdjust] = useState<PromesMeetingEntry | null>(null);
  const [newAdjustDate, setNewAdjustDate] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");

  // Load classes, semesters, curriculum matrix
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

        const activeSem = semList.find(s => s.isActive);
        if (activeSem) {
          setSelectedAcademicYearId(activeSem.academicYearId);
          setSelectedSemesterId(activeSem.id);
        } else if (semList.length > 0) {
          setSelectedAcademicYearId(semList[0].academicYearId);
          setSelectedSemesterId(semList[0].id);
        }

        if (activeCls.length > 0) {
          setSelectedClassId(activeCls[0].id);
        }
      })
      .catch((err) => showToast("Gagal memuat master data: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const selectedClassObj = classes.find(c => c.id === selectedClassId);
  const gradeLevel = selectedClassObj?.gradeLevel || "VII";

  const allOfferedSubjects = useMemo(
    () =>
      curriculumMatrix
        .map((m) => ({
          id: m.subjectId,
          name: m.subjectName,
          teacherId: m.teacherId,
          teacherName: m.teacherName,
          jp:
            gradeLevel === "VII"
              ? m.jp_vii
              : gradeLevel === "VIII"
              ? m.jp_viii
              : m.jp_ix,
        }))
        .filter((s) => s.jp > 0),
    [curriculumMatrix, gradeLevel]
  );

  const currentRole = user?.role?.toLowerCase() || "";
  const isGuru = user?.roles?.includes("guru") || currentRole === "guru";

  const offeredSubjects = useMemo(
    () =>
      isGuru
        ? allOfferedSubjects.filter((s) => s.teacherId === user?.teacherId)
        : allOfferedSubjects,
    [allOfferedSubjects, isGuru, user?.teacherId]
  );

  useEffect(() => {
    if (offeredSubjects.length > 0) {
      const isValid = offeredSubjects.some(s => s.id === selectedSubjectId);
      if (!isValid) {
        setSelectedSubjectId(offeredSubjects[0].id);
      }
    } else {
      setSelectedSubjectId("");
    }
  }, [selectedClassId, curriculumMatrix]);

  const selectedSubjectObj = useMemo(
    () => offeredSubjects.find((s) => s.id === selectedSubjectId),
    [offeredSubjects, selectedSubjectId]
  );
  const currentSemesterObj = semesters.find(s => s.id === selectedSemesterId);

  // Load Real Teaching Hours Analysis, Lesson Plans, and Teaching Journals
  useEffect(() => {
    if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId || !selectedSubjectId) {
      setRealDateDetails([]);
      setLessonPlans([]);
      setJournals([]);
      return;
    }

    setLoading(true);
    Promise.all([
      academicPlanningService.analyzeEffectiveWeeks(
        currentSemesterObj?.startDate || "",
        currentSemesterObj?.endDate || "",
        selectedAcademicYearId,
        selectedSemesterId
      ),
      realTeachingHoursService.getRealTeachingHoursAnalysis(selectedAcademicYearId, selectedSemesterId),
      lessonPlanService.getLessonPlans({
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: selectedClassId,
        subjectId: selectedSubjectId
      }).catch(() => []),
      teachingJournalService.getAll(selectedAcademicYearId, selectedSemesterId).catch(() => [])
    ])
      .then(([analysis, realAnalysis, lpList, journalList]) => {
        setWeeksAnalysis(analysis);
        const currentWeeklyJp = selectedSubjectObj ? selectedSubjectObj.jp : 0;
        setWeeklyJp(currentWeeklyJp);
        setTeacherName(selectedSubjectObj?.teacherName || "Belum Ditentukan");
        setTeacherId(selectedSubjectObj?.teacherId || "");

        setLessonPlans(lpList);
        setJournals(journalList.filter(j => j.classId === selectedClassId && j.subjectId === selectedSubjectId));

        const match = realAnalysis.bySubjectClass.find(
          item => item.subjectId === selectedSubjectId && item.classId === selectedClassId
        );

        if (match) {
          setRealDateDetails(match.dateDetails || []);
          setEffectiveJpSemester(match.effectiveJp || currentWeeklyJp * (analysis?.effectiveWeeks || 18));
        } else {
          setRealDateDetails([]);
          setEffectiveJpSemester(currentWeeklyJp * (analysis?.effectiveWeeks || 18));
        }

        if (analysis) {
          setEffectiveWeeksCount(analysis.effectiveWeeks || 18);
          const cols: WeekColumn[] = [];
          analysis.details.forEach((m: any) => {
            for (let i = 0; i < m.totalWeeks; i++) {
              cols.push({
                key: `${m.month}_w${i}`,
                month: m.month,
                weekIndex: i,
                label: `${i + 1}`
              });
            }
          });
          setWeekColumns(cols);
        }
      })
      .catch((err) => showToast("Gagal memuat analisis pertemuan riil: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId]);

  // Load Source Prota and Active Promes
  useEffect(() => {
    if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId || !selectedSubjectId) {
      setPromes(null);
      setSourceProta(null);
      setMeetings([]);
      return;
    }

    setLoading(true);
    Promise.all([
      curriculumPlanningService.getAnnualProgram(selectedAcademicYearId, selectedClassId, selectedSubjectId),
      curriculumPlanningService.getSemesterProgram(selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId)
    ])
      .then(([protaData, promesData]) => {
        setSourceProta(protaData);
        setPromes(promesData);

        if (!protaData || protaData.topics.length === 0) {
          setSyncAlert("Master data Program Tahunan belum diisi atau tidak memiliki topik. Silakan isi Program Tahunan terlebih dahulu.");
        } else if (!promesData) {
          setSyncAlert("Program Semester belum tersinkronisasi dengan Pertemuan Riil. Klik 'Generasi / Sinkronkan Pertemuan' di bawah.");
        } else {
          setSyncAlert(null);
        }

        if (protaData) {
          const expanded: Record<string, boolean> = {};
          protaData.topics.forEach(t => {
            if (t.subtopics && t.subtopics.length > 0) expanded[t.id] = true;
          });
          setExpandedTopics(expanded);
        }
      })
      .catch((err) => showToast("Gagal memuat Program Semester: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId]);

  // Filter topics based on active semester (Ganjil / Genap)
  const currentSemesterName = currentSemesterObj?.name || "";
  const sourceTopics = sourceProta?.topics || [];
  const isGanjil = currentSemesterName.includes("1") || currentSemesterName.toLowerCase().includes("ganjil");
  const isGenap = currentSemesterName.includes("2") || currentSemesterName.toLowerCase().includes("genap");

  const visibleTopics = useMemo(() => {
    return sourceTopics.filter(t => {
      if (t.semester === "Ganjil & Genap") return true;
      if (isGanjil && t.semester === "Ganjil") return true;
      if (isGenap && t.semester === "Genap") return true;
      return t.semester === currentSemesterName;
    });
  }, [sourceTopics, isGanjil, isGenap, currentSemesterName]);

  // Generate / Synchronize Meetings from Single Source of Truth
  useEffect(() => {
    if (realDateDetails.length === 0) {
      if (promes?.meetings && promes.meetings.length > 0) {
        setMeetings(promes.meetings);
      } else {
        setMeetings([]);
      }
      return;
    }

    const existingMeetingsMap = new Map<string, PromesMeetingEntry>();
    if (promes?.meetings) {
      promes.meetings.forEach(m => {
        existingMeetingsMap.set(m.date, m);
      });
    }

    let kbmCounter = 1;
    const generatedMeetings: PromesMeetingEntry[] = realDateDetails.map((dt, idx) => {
      const existing = existingMeetingsMap.get(dt.date);

      const isHoliday = dt.status === "HOLIDAY";
      const isAgendaCancel = dt.status === "AGENDA_CANCEL";
      const isKbm = !isHoliday && !isAgendaCancel;

      let meetingStatus: "KBM" | "HOLIDAY" | "AGENDA_CANCEL" = isKbm ? "KBM" : (isHoliday ? "HOLIDAY" : "AGENDA_CANCEL");
      let meetingNo = isKbm ? kbmCounter++ : 0;

      // Check Teaching Journal status for this date
      const journalForDate = journals.find(j => j.date === dt.date);
      let journalStatus: "BELUM_MENGAJAR" | "SUDAH_MENGAJAR" | "TERVERIFIKASI" = "BELUM_MENGAJAR";
      if (journalForDate) {
        journalStatus = (journalForDate as any).isVerified ? "TERVERIFIKASI" : "SUDAH_MENGAJAR";
      }

      // Check Modul Ajar status for existing topic
      let modulAjarStatus: "TERSEDIA" | "BELUM_DIBUAT" = "BELUM_DIBUAT";
      let modulAjarId = existing?.modulAjarId;

      const currentTopicId = existing?.topicId;
      if (currentTopicId) {
        const matchingLp = lessonPlans.find(lp => (lp as any).topicId === currentTopicId || lp.subjectId === selectedSubjectId);
        if (matchingLp) {
          modulAjarStatus = "TERSEDIA";
          modulAjarId = modulAjarId || matchingLp.id;
        }
      } else if (lessonPlans.length > 0) {
        modulAjarStatus = "TERSEDIA";
        modulAjarId = modulAjarId || lessonPlans[0].id;
      }

      return {
        id: existing?.id || `meeting_${dt.date}`,
        meetingNo: existing?.meetingNo || meetingNo,
        date: dt.date,
        dayName: dt.dayName,
        jpSlot: `JP 1–${dt.scheduledJp}`,
        jpCount: dt.scheduledJp,
        status: meetingStatus,
        statusLabel: isKbm ? "KBM Normal" : dt.description,
        topicId: isKbm ? existing?.topicId : undefined,
        topicTitle: isKbm ? existing?.topicTitle : undefined,
        subtopicId: isKbm ? existing?.subtopicId : undefined,
        subtopicTitle: isKbm ? existing?.subtopicTitle : undefined,
        tp: isKbm ? existing?.tp : undefined,
        modulAjarId,
        modulAjarStatus,
        journalStatus,
        notes: existing?.notes || (dt.agendas?.length ? dt.agendas.join(", ") : ""),
        isAdjusted: existing?.isAdjusted || false,
        originalDate: existing?.originalDate,
        adjustmentReason: existing?.adjustmentReason,
        adjustedByUserName: existing?.adjustedByUserName,
        adjustedAt: existing?.adjustedAt
      };
    });

    setMeetings(generatedMeetings);
  }, [realDateDetails, promes, lessonPlans, journals, selectedSubjectId]);

  // Save updated Meetings to Firestore
  const handleSaveMeetings = async (updatedMeetings: PromesMeetingEntry[]) => {
    if (!currentSemesterObj || !selectedClassId || !selectedSubjectId || !user) return;

    try {
      setLoading(true);
      const yearName = semesters.find(s => s.academicYearId === selectedAcademicYearId)?.academicYearName || "";
      
      const toSave: SemesterProgramData = {
        id: `${selectedAcademicYearId}_${selectedSemesterId}_${selectedClassId}_${selectedSubjectId}`,
        academicYearId: selectedAcademicYearId,
        academicYearName: yearName,
        semesterId: selectedSemesterId,
        semesterName: currentSemesterName,
        classId: selectedClassId,
        className: selectedClassObj?.name || "",
        subjectId: selectedSubjectId,
        subjectName: selectedSubjectObj?.name || "",
        teacherId,
        teacherName,
        effectiveJpSemester,
        effectiveWeeksCount,
        allocations: promes?.allocations || [],
        meetings: updatedMeetings,
        protaLastSyncedAt: new Date().toISOString(),
        createdAt: promes?.createdAt || "",
        updatedAt: "",
        createdBy: promes?.createdBy || "",
        updatedBy: ""
      };

      const result = await curriculumPlanningService.saveSemesterProgram(toSave, user.uid, user.displayName, false);
      setPromes(result);
      setMeetings(updatedMeetings);
      setSyncAlert(null);
      queryClient.invalidateQueries({ queryKey: ["allSemesterPrograms"] });
      showToast("Program Semester berhasil diperbarui!", "success");
    } catch (error: any) {
      showToast("Gagal menyimpan Program Semester: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Auto-populate Topics and TPs from Prota into Meetings
  const handleAutoPopulateTopics = () => {
    if (visibleTopics.length === 0) {
      showToast("Tidak ada materi dari Program Tahunan yang tersedia untuk dipasangkan", "warning");
      return;
    }

    if (!confirm("Sistem akan memasangkan Topik dan Tujuan Pembelajaran dari Prota ke daftar pertemuan KBM secara berurutan. Lanjutkan?")) {
      return;
    }

    interface FlatTopic {
      topicId: string;
      topicTitle: string;
      subtopicId?: string;
      subtopicTitle?: string;
      description: string;
      jp: number;
      remainingJp: number;
    }

    const flatTopicsList: FlatTopic[] = [];
    visibleTopics.forEach(t => {
      if (t.subtopics && t.subtopics.length > 0) {
        t.subtopics.forEach(st => {
          flatTopicsList.push({
            topicId: t.id,
            topicTitle: t.title,
            subtopicId: st.id,
            subtopicTitle: st.title,
            description: st.description || t.description,
            jp: st.jp,
            remainingJp: st.jp
          });
        });
      } else {
        flatTopicsList.push({
          topicId: t.id,
          topicTitle: t.title,
          description: t.description,
          jp: t.jp,
          remainingJp: t.jp
        });
      }
    });

    let currentTopicIndex = 0;

    const updatedMeetings = meetings.map(m => {
      if (m.status !== "KBM") return m;

      if (currentTopicIndex >= flatTopicsList.length) {
        return m;
      }

      const currentTopic = flatTopicsList[currentTopicIndex];
      const tpText = currentTopic.subtopicTitle 
        ? `Memahami ${currentTopic.subtopicTitle}`
        : `Memahami ${currentTopic.topicTitle}`;

      const updatedMeeting = {
        ...m,
        topicId: currentTopic.topicId,
        topicTitle: currentTopic.topicTitle,
        subtopicId: currentTopic.subtopicId,
        subtopicTitle: currentTopic.subtopicTitle,
        tp: m.tp || tpText
      };

      currentTopic.remainingJp -= m.jpCount;
      if (currentTopic.remainingJp <= 0) {
        currentTopicIndex++;
      }

      return updatedMeeting;
    });

    handleSaveMeetings(updatedMeetings);
  };

  // Perform Manual Schedule Adjustment (Tukar Jadwal / KBM Pengganti)
  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingToAdjust || !newAdjustDate) {
      showToast("Pilih tanggal baru untuk penyesuaian jadwal", "warning");
      return;
    }

    const updatedMeetings = meetings.map(m => {
      if (m.id === selectedMeetingToAdjust.id) {
        return {
          ...m,
          originalDate: m.originalDate || m.date,
          date: newAdjustDate,
          isAdjusted: true,
          adjustmentReason: adjustReason || "Tukar Jadwal / KBM Pengganti",
          adjustedByUserName: user?.displayName || "Guru",
          adjustedAt: new Date().toISOString()
        };
      }
      return m;
    });

    handleSaveMeetings(updatedMeetings);
    setIsAdjustModalOpen(false);
    setSelectedMeetingToAdjust(null);
    setNewAdjustDate("");
    setAdjustReason("");
  };

  // Helper to handle Topic Selection per meeting row
  const handleUpdateMeetingRow = (
    meetingId: string, 
    field: "topic" | "tp" | "notes", 
    value: string
  ) => {
    const updated = meetings.map(m => {
      if (m.id === meetingId) {
        if (field === "topic") {
          if (!value) {
            return { ...m, topicId: undefined, topicTitle: undefined, subtopicId: undefined, subtopicTitle: undefined };
          }
          const [topId, subId] = value.split("::");
          const parentTopic = visibleTopics.find(t => t.id === topId);
          if (subId) {
            const subTopic = parentTopic?.subtopics?.find(s => s.id === subId);
            return {
              ...m,
              topicId: topId,
              topicTitle: parentTopic?.title,
              subtopicId: subId,
              subtopicTitle: subTopic?.title,
              tp: m.tp || (subTopic ? `Memahami ${subTopic.title}` : `Memahami ${parentTopic?.title}`)
            };
          } else {
            return {
              ...m,
              topicId: topId,
              topicTitle: parentTopic?.title,
              subtopicId: undefined,
              subtopicTitle: undefined,
              tp: m.tp || (parentTopic ? `Memahami ${parentTopic.title}` : "")
            };
          }
        } else if (field === "tp") {
          return { ...m, tp: value };
        } else if (field === "notes") {
          return { ...m, notes: value };
        }
      }
      return m;
    });

    setMeetings(updated);
  };

  // Wakakur Monitoring Indicators
  const totalMeetings = meetings.length;
  const kbmMeetings = meetings.filter(m => m.status === "KBM").length;
  const executedMeetings = meetings.filter(m => m.journalStatus === "SUDAH_MENGAJAR" || m.journalStatus === "TERVERIFIKASI").length;
  const unexecutedMeetings = kbmMeetings - executedMeetings;
  const holidayMeetings = meetings.filter(m => m.status === "HOLIDAY" || m.status === "AGENDA_CANCEL").length;
  const progressPercent = kbmMeetings > 0 ? Math.round((executedMeetings / kbmMeetings) * 100) : 0;

  // Filtered Meetings for Display
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      // Filter Status
      if (filterStatus === "KBM" && m.status !== "KBM") return false;
      if (filterStatus === "SUDAH_MENGAJAR" && m.journalStatus === "BELUM_MENGAJAR") return false;
      if (filterStatus === "BELUM_MENGAJAR" && (m.journalStatus !== "BELUM_MENGAJAR" || m.status !== "KBM")) return false;
      if (filterStatus === "HOLIDAY" && m.status === "KBM") return false;
      if (filterStatus === "ADJUSTED" && !m.isAdjusted) return false;

      // Search Term
      if (searchTerm.trim() !== "") {
        const term = searchTerm.toLowerCase();
        const matchDate = m.date.toLowerCase().includes(term);
        const matchDay = m.dayName.toLowerCase().includes(term);
        const matchTopic = (m.topicTitle || "").toLowerCase().includes(term);
        const matchSubtopic = (m.subtopicTitle || "").toLowerCase().includes(term);
        const matchTp = (m.tp || "").toLowerCase().includes(term);
        const matchStatus = (m.statusLabel || "").toLowerCase().includes(term);

        return matchDate || matchDay || matchTopic || matchSubtopic || matchTp || matchStatus;
      }

      return true;
    });
  }, [meetings, filterStatus, searchTerm]);

  // Exports: Excel, PDF, Word
  const exportRealScheduleExcel = () => {
    if (meetings.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      const rows = meetings.map((m, idx) => ({
        "No": m.status === "KBM" ? `Pertemuan ${m.meetingNo}` : idx + 1,
        "Tanggal": m.date,
        "Hari": m.dayName,
        "Slot JP": m.jpSlot || `JP 1-${m.jpCount}`,
        "Status KBM": m.status === "KBM" ? "KBM Normal" : (m.statusLabel || "Tidak Ada KBM"),
        "Materi / Topik": m.subtopicTitle ? `${m.topicTitle} - ${m.subtopicTitle}` : (m.topicTitle || "-"),
        "Tujuan Pembelajaran (TP)": m.tp || "-",
        "Modul Ajar": m.modulAjarStatus === "TERSEDIA" ? "Tersedia" : "Belum dibuat",
        "Status Mengajar": m.journalStatus === "TERVERIFIKASI" ? "Terverifikasi" : (m.journalStatus === "SUDAH_MENGAJAR" ? "Sudah Mengajar" : "Belum Mengajar"),
        "Catatan / Penyesuaian": m.isAdjusted ? `Disesuaikan (Tgl Asli: ${m.originalDate}) - ${m.adjustmentReason}` : (m.notes || "-")
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Real Teaching Prosem");
      XLSX.writeFile(wb, `Prosem_Real_Schedule_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.xlsx`);
      showToast("Unduh data Excel Prosem Riil berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export Excel: " + error.message, "error");
    }
  };

  const exportRealSchedulePDF = () => {
    if (meetings.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      const doc = new jsPDF("l", "mm", "a4");
      const yearName = currentSemesterObj?.academicYearName || "";

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PROGRAM SEMESTER BERBASIS PERTEMUAN RIIL", 148, 15, { align: "center" });
      doc.setFontSize(11);
      doc.text("SMP ALKARIM RASYID SYSTEM", 148, 21, { align: "center" });

      doc.setDrawColor(180);
      doc.line(14, 25, 282, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tahun Pelajaran: ${yearName}`, 14, 31);
      doc.text(`Semester        : ${currentSemesterName}`, 14, 36);
      doc.text(`Kelas / Tingkat: ${selectedClassObj?.name || "-"} (${selectedClassObj?.gradeLevel || "-"})`, 14, 41);

      doc.text(`Guru Pengampu  : ${teacherName}`, 155, 31);
      doc.text(`Total Pertemuan: ${totalMeetings} Pertemuan`, 155, 36);
      doc.text(`Keterlaksanaan : ${progressPercent}% (${executedMeetings}/${kbmMeetings} KBM)`, 155, 41);

      doc.line(14, 45, 282, 45);

      let y = 52;
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 5, 268, 7, "F");

      doc.text("No / Tgl", 16, y);
      doc.text("Hari", 48, y);
      doc.text("Status", 68, y);
      doc.text("Materi & Topik Pembelajaran", 100, y);
      doc.text("TP / Modul", 210, y);
      doc.text("Status Jurnal", 250, y);

      doc.line(14, y + 2, 282, y + 2);
      y += 8;

      doc.setFont("helvetica", "normal");
      meetings.forEach((m) => {
        if (y > 185) {
          doc.addPage();
          y = 20;
        }

        const topicText = m.subtopicTitle ? `${m.topicTitle} - ${m.subtopicTitle}` : (m.topicTitle || "-");

        doc.text(`${m.status === "KBM" ? `P.${m.meetingNo}` : "-"} (${m.date})`, 16, y);
        doc.text(m.dayName, 48, y);
        doc.text(m.status === "KBM" ? "KBM" : "Libur", 68, y);
        doc.text(topicText.length > 55 ? topicText.substring(0, 52) + "..." : topicText, 100, y);
        doc.text(m.modulAjarStatus === "TERSEDIA" ? "Modul Ada" : "Belum Ada", 210, y);
        doc.text(m.journalStatus === "TERVERIFIKASI" ? "Verified" : (m.journalStatus === "SUDAH_MENGAJAR" ? "Mengajar" : "Belum"), 250, y);

        doc.line(14, y + 2, 282, y + 2);
        y += 7;
      });

      doc.save(`Prosem_Real_Teaching_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.pdf`);
      showToast("Unduh dokumen PDF berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export PDF: " + error.message, "error");
    }
  };

  return (
    <div className="space-y-6" id="semester-program-view">
      {/* Page Header Title & Mode Toggle */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Calendar className="h-6.5 w-6.5 text-blue-500" />
            Program Semester (PROSEM)
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Berbasis <b className="text-blue-600 dark:text-blue-400">Real Teaching Schedule</b> (Tanggal Pertemuan Riil) yang diselaraskan dengan Jadwal Pelajaran & Kalender Akademik.
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Semester Selection */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Semester</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => {
                setSelectedSemesterId(e.target.value);
                const sem = semesters.find(s => s.id === e.target.value);
                if (sem) setSelectedAcademicYearId(sem.academicYearId);
              }}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              {semesters.map(s => (
                <option key={s.id} value={s.id}>TP {s.academicYearName} ({s.name})</option>
              ))}
            </select>
          </div>

          {/* Class Selection */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Kelas</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} (Tingkat {c.gradeLevel})</option>
              ))}
            </select>
          </div>

          {/* Subject Selection */}
          <div className="flex flex-col shrink-0">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Mata Pelajaran</span>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              disabled={offeredSubjects.length === 0}
              className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 shadow-xs disabled:opacity-50"
            >
              {offeredSubjects.length === 0 ? (
                <option value="">Tidak ada mapel ditawarkan</option>
              ) : (
                offeredSubjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.jp} JP/Minggu)</option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Sync Alert Banner */}
      {syncAlert && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-tight">Perhatian: Sinkronisasi Pertemuan Riil</h4>
            <p className="text-xs leading-relaxed opacity-90">{syncAlert}</p>
            <button
              onClick={handleAutoPopulateTopics}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Pasangkan Otomatis Topik Prota
            </button>
          </div>
        </div>
      )}

      {/* Wakakur & Teacher Real Teaching Monitoring Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Pertemuan Card */}
        <div 
          onClick={() => setFilterStatus("ALL")}
          className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filterStatus === "ALL" ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Total Pertemuan</span>
            <Calendar className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-zinc-100 mt-2">{totalMeetings}</div>
          <p className="text-[10px] text-slate-500 mt-1">{effectiveJpSemester} Total JP Efektif</p>
        </div>

        {/* Pertemuan Terlaksana Card */}
        <div 
          onClick={() => setFilterStatus("SUDAH_MENGAJAR")}
          className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filterStatus === "SUDAH_MENGAJAR" ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Pertemuan Terlaksana</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{executedMeetings}</div>
          <p className="text-[10px] text-emerald-600/80 font-semibold mt-1">Sudah Diisi Jurnal Mengajar</p>
        </div>

        {/* Pertemuan Belum Terlaksana Card */}
        <div 
          onClick={() => setFilterStatus("BELUM_MENGAJAR")}
          className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filterStatus === "BELUM_MENGAJAR" ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Belum Terlaksana</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{unexecutedMeetings}</div>
          <p className="text-[10px] text-amber-600/80 font-semibold mt-1">Menunggu Jadwal KBM</p>
        </div>

        {/* Pertemuan Libur / Agenda Card */}
        <div 
          onClick={() => setFilterStatus("HOLIDAY")}
          className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] ${
            filterStatus === "HOLIDAY" ? "border-rose-500 ring-2 ring-rose-500/20" : "border-slate-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Libur / Non-KBM</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">{holidayMeetings}</div>
          <p className="text-[10px] text-rose-500/80 font-semibold mt-1">Hari Tidak Efektif / Agenda</p>
        </div>

        {/* Progress Percentage Card */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Persentase Keterlaksanaan</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{progressPercent}%</div>
          <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 mt-2 overflow-hidden">
            <div 
              className="bg-blue-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* View Mode Switcher Tabs */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-2.5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setViewMode("dates")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === "dates" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Calendar className="h-4 w-4" />
            MODE 1: Tanggal Pertemuan (Default)
          </button>

          <button
            onClick={() => setViewMode("weeks")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === "weeks" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Grid className="h-4 w-4" />
            MODE 2: Pekan (Administrasi)
          </button>

          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewMode === "timeline" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Layers className="h-4 w-4" />
            MODE 3: Timeline (Alur Pembelajaran)
          </button>
        </div>

        {/* Toolbar Quick Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleAutoPopulateTopics}
            disabled={visibleTopics.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 rounded-xl text-xs font-bold cursor-pointer transition-colors disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Pasangkan Otomatis Prota
          </button>

          <button
            onClick={exportRealScheduleExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-xs cursor-pointer transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> Excel
          </button>

          <button
            onClick={exportRealSchedulePDF}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-xs cursor-pointer transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-rose-500" /> PDF
          </button>
        </div>
      </div>

      {/* --- MODE 1: TANGGAL PERTEMUAN (REAL TEACHING SCHEDULE) --- */}
      {viewMode === "dates" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs space-y-0">
          {/* Table Search & Filter Bar */}
          <div className="p-4 border-b border-slate-150 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari berdasarkan tanggal, hari, materi, atau status..."
                className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs px-3 py-1.5 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Filter Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-bold px-3 py-1.5 rounded-xl text-slate-700 dark:text-zinc-300 focus:outline-hidden"
              >
                <option value="ALL">Semua Status Pertemuan</option>
                <option value="KBM">Hanya Pertemuan KBM</option>
                <option value="SUDAH_MENGAJAR">Sudah Mengajar (Jurnal Filled)</option>
                <option value="BELUM_MENGAJAR">Belum Mengajar</option>
                <option value="HOLIDAY">Libur / Non-KBM</option>
                <option value="ADJUSTED">Jadwal Disesuaikan</option>
              </select>
            </div>
          </div>

          {/* Real Teaching Schedule Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                  <th className="py-3 px-3 text-center w-[70px]">No</th>
                  <th className="py-3 px-3 w-[120px]">Tanggal</th>
                  <th className="py-3 px-3 w-[90px]">Hari</th>
                  <th className="py-3 px-3 w-[80px] text-center">JP</th>
                  <th className="py-3 px-3 w-[130px]">Status KBM</th>
                  <th className="py-3 px-4 min-w-[220px]">Materi & Topik (Prota)</th>
                  <th className="py-3 px-4 min-w-[220px]">Tujuan Pembelajaran (TP)</th>
                  <th className="py-3 px-3 text-center w-[110px]">Modul Ajar</th>
                  <th className="py-3 px-3 text-center w-[120px]">Jurnal Mengajar</th>
                  <th className="py-3 px-3 text-center w-[110px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-zinc-850">
                {filteredMeetings.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Tidak ada daftar pertemuan yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredMeetings.map((m) => {
                    const isKbm = m.status === "KBM";
                    const isHoliday = m.status === "HOLIDAY" || m.status === "AGENDA_CANCEL";

                    return (
                      <tr 
                        key={m.id}
                        className={`transition-colors ${
                          isHoliday 
                            ? 'bg-rose-50/40 dark:bg-rose-950/10 text-slate-400' 
                            : m.isAdjusted
                            ? 'bg-amber-50/30 dark:bg-amber-950/10'
                            : 'hover:bg-slate-50/50 dark:hover:bg-zinc-900/50'
                        }`}
                      >
                        {/* No */}
                        <td className="py-3 px-3 text-center font-bold text-slate-500">
                          {isKbm ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-black text-[11px]">
                              P.{m.meetingNo}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-zinc-700">-</span>
                          )}
                        </td>

                        {/* Tanggal */}
                        <td className="py-3 px-3 font-bold text-slate-800 dark:text-zinc-200">
                          {m.date}
                          {m.isAdjusted && (
                            <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-normal">
                              Tgl Asli: {m.originalDate}
                            </span>
                          )}
                        </td>

                        {/* Hari */}
                        <td className="py-3 px-3 font-semibold text-slate-600 dark:text-zinc-400">
                          {m.dayName}
                        </td>

                        {/* JP */}
                        <td className="py-3 px-3 text-center font-extrabold text-slate-700 dark:text-zinc-300">
                          {m.jpSlot || `JP 1–${m.jpCount}`}
                        </td>

                        {/* Status KBM */}
                        <td className="py-3 px-3">
                          {isKbm ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 text-[10px] font-bold">
                              <CheckCircle2 className="h-3 w-3" /> KBM Normal
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100/70 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/30 text-[10px] font-bold">
                              <Lock className="h-3 w-3" /> {m.statusLabel || "Tidak Ada KBM"}
                            </span>
                          )}
                        </td>

                        {/* Materi & Topik (Prota Dropdown / Display) */}
                        <td className="py-3 px-4">
                          {!isKbm ? (
                            <span className="italic text-slate-400 dark:text-zinc-600">(Locked: {m.statusLabel || "Hari Libur / Agenda"})</span>
                          ) : (
                            <select
                              value={m.subtopicId ? `${m.topicId}::${m.subtopicId}` : (m.topicId || "")}
                              onChange={(e) => handleUpdateMeetingRow(m.id, "topic", e.target.value)}
                              className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs px-2.5 py-1.5 rounded-xl font-semibold text-slate-700 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Pilih Topik dari Prota --</option>
                              {visibleTopics.map((t) => (
                                <React.Fragment key={t.id}>
                                  <option value={t.id} className="font-bold">
                                    [Topik] {t.title} ({t.jp} JP)
                                  </option>
                                  {t.subtopics?.map((sub) => (
                                    <option key={sub.id} value={`${t.id}::${sub.id}`}>
                                      &nbsp;&nbsp;&bull; {sub.title} ({sub.jp} JP)
                                    </option>
                                  ))}
                                </React.Fragment>
                              ))}
                            </select>
                          )}
                        </td>

                        {/* Tujuan Pembelajaran (TP) */}
                        <td className="py-3 px-4">
                          {!isKbm ? (
                            <span className="text-slate-300 dark:text-zinc-700">-</span>
                          ) : (
                            <input
                              type="text"
                              value={m.tp || ""}
                              onChange={(e) => handleUpdateMeetingRow(m.id, "tp", e.target.value)}
                              placeholder="Ketik Tujuan Pembelajaran (TP)..."
                              className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs px-2.5 py-1.5 rounded-xl font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            />
                          )}
                        </td>

                        {/* Modul Ajar Status */}
                        <td className="py-3 px-3 text-center">
                          {m.modulAjarStatus === "TERSEDIA" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold text-[10px]">
                              <BookOpen className="h-3 w-3" /> Modul Tersedia
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 font-semibold text-[10px]">
                              Belum dibuat
                            </span>
                          )}
                        </td>

                        {/* Status Jurnal Mengajar */}
                        <td className="py-3 px-3 text-center">
                          {m.journalStatus === "TERVERIFIKASI" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-bold text-[10px]">
                              <UserCheck className="h-3 w-3" /> Terverifikasi
                            </span>
                          ) : m.journalStatus === "SUDAH_MENGAJAR" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-[10px]">
                              <Check className="h-3 w-3" /> Sudah Mengajar
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 font-semibold text-[10px]">
                              Belum Mengajar
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3 px-3 text-center">
                          {isKbm && (
                            <button
                              onClick={() => {
                                setSelectedMeetingToAdjust(m);
                                setNewAdjustDate(m.date);
                                setAdjustReason(m.adjustmentReason || "");
                                setIsAdjustModalOpen(true);
                              }}
                              title="Tukar Jadwal / Penyesuaian KBM"
                              className="px-2 py-1 bg-white hover:bg-slate-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold text-slate-700 dark:text-zinc-300 shadow-2xs cursor-pointer transition-colors"
                            >
                              Tukar Jadwal
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODE 2: PEKAN (FORMAT ADMINISTRASI) --- */}
      {viewMode === "weeks" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-150 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-tight">
                PROGRAM SEMESTER - TAMPILAN ADMINISTRASI BERBASIS PEKAN
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Pengelompokan tanggal pertemuan riil ke dalam nomor pekan untuk kebutuhan kelengkapan berkas administrasi.
              </p>
            </div>

            <button
              onClick={() => setWeeklyMatrixSubMode(!weeklyMatrixSubMode)}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 cursor-pointer"
            >
              {weeklyMatrixSubMode ? "Lihat Pengelompokan Pekan" : "Lihat Matriks Pekan Klasik"}
            </button>
          </div>

          {!weeklyMatrixSubMode ? (
            /* Grouped Weeks Listing */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {weeksAnalysis?.details.map((m: any, idx: number) => (
                <div key={m.month} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-4 bg-slate-50/50 dark:bg-zinc-900/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                    <span className="font-extrabold text-sm text-slate-800 dark:text-zinc-100">{m.month}</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{m.effectiveWeeks} Pekan Efektif</span>
                  </div>

                  <div className="space-y-2">
                    {meetings
                      .filter(mt => {
                        const mtMonth = new Date(mt.date).toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                        return mtMonth.toLowerCase().includes(m.month.toLowerCase().split(' ')[0]);
                      })
                      .map((mt) => (
                        <div key={mt.id} className="p-2.5 bg-white dark:bg-zinc-950 rounded-lg border border-slate-150 dark:border-zinc-800 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-slate-700 dark:text-zinc-300">{mt.date} ({mt.dayName})</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] ${mt.status === "KBM" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                              {mt.status === "KBM" ? `Pertemuan ${mt.meetingNo}` : "Libur"}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {mt.subtopicTitle ? `${mt.topicTitle} - ${mt.subtopicTitle}` : (mt.topicTitle || "Belum ada materi")}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Classic Weekly Matrix Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold uppercase text-slate-500">
                    <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-zinc-800" rowSpan={2}>No</th>
                    <th className="py-2.5 px-3 border-r border-slate-200 dark:border-zinc-800" rowSpan={2}>Materi Pokok / Bahasan</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-200 dark:border-zinc-800" rowSpan={2}>JP</th>
                    {weeksAnalysis?.details.map((m: any) => (
                      <th key={m.month} className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-zinc-800 font-extrabold bg-blue-50/20" colSpan={m.totalWeeks}>
                        {m.month}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-50 dark:bg-zinc-900 text-[9px] font-bold">
                    {weekColumns.map(col => (
                      <th key={col.key} className="py-1 px-1.5 text-center border-r border-slate-200 dark:border-zinc-800 w-[36px]">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleTopics.map((t, idx) => (
                    <tr key={t.id} className="border-b border-slate-150 dark:border-zinc-850">
                      <td className="py-2 px-3 text-center font-bold border-r border-slate-200 dark:border-zinc-800">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800 dark:text-zinc-200 border-r border-slate-200 dark:border-zinc-800">{t.title}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-500 border-r border-slate-200 dark:border-zinc-800">{t.jp} JP</td>
                      {weekColumns.map(col => (
                        <td key={col.key} className="py-2 text-center border-r border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-blue-600">
                          -
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- MODE 3: TIMELINE (ALUR PEMBELAJARAN) --- */}
      {viewMode === "timeline" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-150 dark:border-zinc-800 pb-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-tight">
              TIMELINE KRONOLOGIS PEMBELAJARAN SEMESTER
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Alur kronologis seluruh pertemuan KBM, PTS, PAS, dan hari libur selama satu semester.
            </p>
          </div>

          <div className="relative border-l-2 border-blue-200 dark:border-blue-900/40 ml-4 space-y-6 pl-6 py-2">
            {meetings.map((m, idx) => {
              const isKbm = m.status === "KBM";
              const isExecuted = m.journalStatus === "SUDAH_MENGAJAR" || m.journalStatus === "TERVERIFIKASI";

              return (
                <div key={m.id} className="relative group">
                  {/* Circle marker */}
                  <span className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 bg-white dark:bg-zinc-900 ${
                    !isKbm 
                      ? "border-rose-500 bg-rose-500" 
                      : isExecuted 
                      ? "border-emerald-500 bg-emerald-500" 
                      : "border-blue-500"
                  }`} />

                  <div className="p-4 bg-slate-50/60 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                        {m.date} ({m.dayName}) &bull; {m.jpSlot || `JP 1-${m.jpCount}`}
                      </span>

                      {isKbm ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isExecuted ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          Pertemuan {m.meetingNo} - {isExecuted ? "Terlaksana" : "Direncanakan"}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          {m.statusLabel || "Tidak Ada KBM"}
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      {m.subtopicTitle ? `${m.topicTitle} - ${m.subtopicTitle}` : (m.topicTitle || "Belum ada materi")}
                    </div>

                    {m.tp && (
                      <p className="text-xs text-slate-500 italic">
                        TP: {m.tp}
                      </p>
                    )}

                    {m.isAdjusted && (
                      <div className="text-[10px] text-amber-600 font-semibold bg-amber-50 p-2 rounded-lg border border-amber-200">
                        Penyesuaian Jadwal: {m.adjustmentReason} (Tgl Asli: {m.originalDate})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- MODAL PENYESUAIAN JADWAL (TUKAR JADWAL / KBM PENGGANTI) --- */}
      <AnimatePresence>
        {isAdjustModalOpen && selectedMeetingToAdjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-150 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900">
                <h3 className="text-xs font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowRightLeft className="h-4.5 w-4.5 text-blue-500" />
                  Penyesuaian Jadwal KBM (Tukar Jadwal)
                </h3>
                <button
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleConfirmAdjustment} className="p-5 space-y-4">
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 p-3 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-slate-800 dark:text-zinc-200">
                    Pertemuan {selectedMeetingToAdjust.meetingNo} ({selectedMeetingToAdjust.date})
                  </div>
                  <div className="text-slate-500">
                    Materi: {selectedMeetingToAdjust.topicTitle || "Belum diisi"}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal Baru Pertemuan</label>
                  <input
                    type="date"
                    required
                    value={newAdjustDate}
                    onChange={(e) => setNewAdjustDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Alasan Penyesuaian / KBM Pengganti</label>
                  <textarea
                    rows={2}
                    required
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Contoh: Kegiatan Pondok, Tukar Jadwal Pengganti, Kalender Berubah..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-200"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-150 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer shadow-xs"
                  >
                    Simpan Penyesuaian
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

export default SemesterProgram;
