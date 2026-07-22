import React, { useState, useEffect, useMemo } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { curriculumPlanningService } from "../services/curriculumPlanning.service";
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
  ProtaTopic, 
  ProtaSubTopic 
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
  Palette
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";

interface WeekColumn {
  key: string; // e.g., "Juli 2025_w0"
  month: string; // "Juli 2025"
  weekIndex: number; // 0, 1, 2...
  label: string; // "1", "2"...
}

export const SemesterProgram: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Background color selection state for JP cells
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

  // Master Data States
  const [classes, setClasses] = useState<Class[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [curriculumMatrix, setCurriculumMatrix] = useState<CurriculumMatrix[]>([]);

  // Selection States
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // RPE & Calculated States
  const [weeksAnalysis, setWeeksAnalysis] = useState<any | null>(null);
  const [weekColumns, setWeekColumns] = useState<WeekColumn[]>([]);
  const [weeklyJp, setWeeklyJp] = useState<number>(0);
  const [effectiveWeeksCount, setEffectiveWeeksCount] = useState<number>(0);
  const [effectiveJpSemester, setEffectiveJpSemester] = useState<number>(0);
  const [teacherName, setTeacherName] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");

  // Manual Weeks Config states
  const [isManualWeeks, setIsManualWeeks] = useState<boolean>(false);
  const [customWeeksConfig, setCustomWeeksConfig] = useState<{
    month: string;
    totalWeeks: number;
    effectiveWeeks: number;
    notes?: string;
  }[]>([]);

  const getCellStylesAndClasses = (jp: number) => {
    if (jp <= 0) {
      return {
        className: "bg-transparent hover:bg-slate-100/50 dark:hover:bg-zinc-800/50 border-r border-b border-slate-100 dark:border-zinc-850/40 text-slate-400",
        style: {}
      };
    }

    const isPreset = ["blue", "emerald", "amber", "purple", "rose", "slate"].includes(selectedBgTheme);

    if (isPreset) {
      if (selectedBgTheme === "blue") {
        if (jp === 1) return { className: "bg-blue-105/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-extrabold border border-blue-200/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 2) return { className: "bg-blue-200/80 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-extrabold border border-blue-300/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 3) return { className: "bg-blue-300/90 text-blue-900 dark:bg-blue-850 dark:text-blue-100 font-extrabold border border-blue-400/50 text-center py-2.5 transition-colors select-none", style: {} };
        return { className: "bg-blue-500 text-white dark:bg-blue-600 dark:text-zinc-50 font-black border border-blue-600 text-center py-2.5 transition-colors select-none", style: {} };
      }
      if (selectedBgTheme === "emerald") {
        if (jp === 1) return { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-extrabold border border-emerald-200/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 2) return { className: "bg-emerald-200 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200 font-extrabold border border-emerald-300/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 3) return { className: "bg-emerald-300 text-emerald-900 dark:bg-emerald-850 dark:text-emerald-100 font-extrabold border border-emerald-400/50 text-center py-2.5 transition-colors select-none", style: {} };
        return { className: "bg-emerald-500 text-white dark:bg-emerald-600 dark:text-zinc-50 font-black border border-emerald-600 text-center py-2.5 transition-colors select-none", style: {} };
      }
      if (selectedBgTheme === "amber") {
        if (jp === 1) return { className: "bg-amber-100 text-amber-850 dark:bg-amber-950/40 dark:text-amber-300 font-extrabold border border-amber-200/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 2) return { className: "bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 font-extrabold border border-amber-300/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 3) return { className: "bg-amber-300 text-amber-950 dark:bg-amber-850 dark:text-amber-100 font-extrabold border border-amber-400/50 text-center py-2.5 transition-colors select-none", style: {} };
        return { className: "bg-amber-500 text-black dark:bg-amber-600 dark:text-zinc-900 font-black border border-amber-600 text-center py-2.5 transition-colors select-none", style: {} };
      }
      if (selectedBgTheme === "purple") {
        if (jp === 1) return { className: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-extrabold border border-purple-200/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 2) return { className: "bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 font-extrabold border border-purple-300/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 3) return { className: "bg-purple-300 text-purple-900 dark:bg-purple-850 dark:text-purple-100 font-extrabold border border-purple-400/50 text-center py-2.5 transition-colors select-none", style: {} };
        return { className: "bg-purple-500 text-white dark:bg-purple-600 dark:text-zinc-50 font-black border border-purple-600 text-center py-2.5 transition-colors select-none", style: {} };
      }
      if (selectedBgTheme === "rose") {
        if (jp === 1) return { className: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 font-extrabold border border-rose-200/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 2) return { className: "bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200 font-extrabold border border-rose-300/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 3) return { className: "bg-rose-300 text-rose-900 dark:bg-rose-850 dark:text-rose-100 font-extrabold border border-rose-400/50 text-center py-2.5 transition-colors select-none", style: {} };
        return { className: "bg-rose-500 text-white dark:bg-rose-600 dark:text-zinc-50 font-black border border-rose-600 text-center py-2.5 transition-colors select-none", style: {} };
      }
      if (selectedBgTheme === "slate") {
        if (jp === 1) return { className: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 font-extrabold border border-slate-200/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 2) return { className: "bg-slate-200 text-slate-800 dark:bg-zinc-700 dark:text-zinc-200 font-extrabold border border-slate-300/50 text-center py-2.5 transition-colors select-none", style: {} };
        if (jp === 3) return { className: "bg-slate-300 text-slate-900 dark:bg-zinc-600 dark:text-zinc-100 font-extrabold border border-slate-400/50 text-center py-2.5 transition-colors select-none", style: {} };
        return { className: "bg-slate-500 text-white dark:bg-zinc-500 dark:text-zinc-50 font-black border border-slate-600 text-center py-2.5 transition-colors select-none", style: {} };
      }
    }

    // Custom hex color
    const r = parseInt(selectedBgTheme.slice(1, 3), 16) || 0;
    const g = parseInt(selectedBgTheme.slice(3, 5), 16) || 0;
    const b = parseInt(selectedBgTheme.slice(5, 7), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = yiq >= 128 ? "#000000" : "#ffffff";

    return {
      className: "font-black border border-slate-300 dark:border-zinc-700 text-center py-2.5 transition-colors select-none",
      style: {
        backgroundColor: selectedBgTheme,
        color: textColor
      }
    };
  };

  // Active Program Semester (Promes) and Source Program Tahunan (Prota)
  const [promes, setPromes] = useState<SemesterProgramData | null>(null);
  const [sourceProta, setSourceProta] = useState<AnnualProgramData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncAlert, setSyncAlert] = useState<string | null>(null);
  const isSyncingRef = React.useRef(false);
  // Expanded State for Collapsible Topics with Subtopics
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});

  // Cell Allocation Modal States
  const [isCellModalOpen, setIsCellModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    topicId: string;
    subtopicId?: string;
    weekKey: string;
    monthLabel: string;
    weekNum: string;
    materiTitle: string;
    materiAllocatedJp: number; // Total possible JP for this topic
    currentCellJp: number;
  } | null>(null);

  // Cell Form values
  const [inputCellJp, setInputCellJp] = useState<number>(0);
  const [actionType, setActionType] = useState<"normal" | "copy" | "move">("normal");
  const [targetWeekKey, setTargetWeekKey] = useState<string>("");

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

        // Selection defaults
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

  // Mapped offered subjects
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
      ? allOfferedSubjects.filter(
          (s) => s.teacherId === user?.teacherId
        )
      : allOfferedSubjects,
  [allOfferedSubjects, isGuru, user?.teacherId]
);

  // Subject Default Selection
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
  () =>
    offeredSubjects.find(
      (s) => s.id === selectedSubjectId
    ),
  [offeredSubjects, selectedSubjectId]
);
  const currentSemesterObj = semesters.find(s => s.id === selectedSemesterId);

  // Calculate RPE - Fetch Weeks Analysis only
  useEffect(() => {
    if (!currentSemesterObj || !selectedClassId || !selectedSubjectId) {
      setWeekColumns([]);
      setEffectiveJpSemester(0);
      setEffectiveWeeksCount(0);
      return;
    }

    setLoading(true);
    academicPlanningService.analyzeEffectiveWeeks(
      currentSemesterObj.startDate,
      currentSemesterObj.endDate,
      currentSemesterObj.academicYearId,
      currentSemesterObj.id
    )
      .then((analysis) => {
        setWeeksAnalysis(analysis);
        const currentWeeklyJp = selectedSubjectObj ? selectedSubjectObj.jp : 0;
        setWeeklyJp(currentWeeklyJp);
        setTeacherName(selectedSubjectObj?.teacherName || "Belum Ditentukan");
        setTeacherId(selectedSubjectObj?.teacherId || "");
      })
      .catch((err) => showToast("Gagal melakukan analisis pekan efektif: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [selectedSemesterId, selectedClassId, selectedSubjectId, semesters]);

  // Synchronize custom weeks configuration when Promes is loaded
  useEffect(() => {
    setIsManualWeeks(false);
    setCustomWeeksConfig([]);
  }, [promes]);

  // Decoupled generation of week columns and calculation of effective weeks & JPs
  useEffect(() => {
    const currentWeeklyJp = selectedSubjectObj ? selectedSubjectObj.jp : 0;
    
    if (isManualWeeks && customWeeksConfig && customWeeksConfig.length > 0) {
      const count = customWeeksConfig.reduce((sum, m) => sum + m.effectiveWeeks, 0);
      setEffectiveWeeksCount(count);
      setEffectiveJpSemester(currentWeeklyJp * count);

      const cols: WeekColumn[] = [];
      customWeeksConfig.forEach((m) => {
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
    } else if (weeksAnalysis) {
      const levelEffectiveWeeks = weeksAnalysis.details.reduce((sum: number, m: any) => {
        const ew = m.effectiveWeeksByGrade?.[gradeLevel] ?? m.effectiveWeeks;
        return sum + ew;
      }, 0);
      setEffectiveWeeksCount(levelEffectiveWeeks);
      setEffectiveJpSemester(currentWeeklyJp * levelEffectiveWeeks);

      const cols: WeekColumn[] = [];
      weeksAnalysis.details.forEach((m: any) => {
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
  }, [weeksAnalysis, isManualWeeks, customWeeksConfig, selectedSubjectObj, gradeLevel]);

  // Load Prota (source master) and Promes
  useEffect(() => {
    if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId || !selectedSubjectId) {
      setPromes(null);
      setSourceProta(null);
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

        // Setup sync alerts
        if (!protaData || protaData.topics.length === 0) {
          setSyncAlert("Master data Program Tahunan belum diisi atau tidak memiliki topik. Silakan isi Program Tahunan terlebih dahulu.");
        } else if (!promesData) {
          setSyncAlert("Program Semester belum tersinkronisasi. Silakan klik tombol 'Sinkronkan dari Prota' di bawah.");
        } else {
          // Check if topics match
          const protaIds = protaData.topics.map(t => t.id).sort().join(",");
          const uniqueAllocatedTopics = Array.from(new Set(promesData.allocations.map(a => a.topicId))).sort().join(",");
          // Or compare the structure count. Let's check sync stamp
          if (promesData.protaLastSyncedAt && protaData.updatedAt > promesData.protaLastSyncedAt) {
            setSyncAlert("Ada perubahan terbaru di Program Tahunan. Silakan lakukan sinkronisasi ulang agar data materi selaras.");
          } else {
            setSyncAlert(null);
          }
        }

        // Initialize expand levels for subtopics
        if (protaData) {
          const expanded: Record<string, boolean> = {};
          protaData.topics.forEach(t => {
            if (t.subtopics && t.subtopics.length > 0) {
              expanded[t.id] = true;
            }
          });
          setExpandedTopics(expanded);
        }
      })
      .catch((err) => showToast("Gagal memuat Program Semester: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId, selectedSubjectId]);

  // Calculations for Indicators
  const currentAllocations = promes?.allocations || [];
  const usedJp = currentAllocations.reduce((sum, a) => sum + a.jp, 0);
  const remainingJp = effectiveJpSemester - usedJp;

  // Total JP already allocated (across ALL topics/subtopics) for a specific week
  const getWeekTotalJp = (weekKey: string): number =>
    currentAllocations
      .filter(a => a.weekKey === weekKey)
      .reduce((sum, a) => sum + a.jp, 0);

  // Check if a week is allowed to receive JP allocation (clickable / not locked).
  //
  // New logic (dynamic, no stored "effective week position"):
  // - The number of weeks (within the same month) that currently hold JP > 0
  //   must never exceed the month's configured "Pekan Efektif" quota.
  // - A week that already has JP > 0 always remains editable.
  // - An empty week is only selectable while used slots < quota for that month.
  // - As soon as a filled week's JP is fully removed (back to 0), it stops
  //   counting toward "used" and another empty week becomes selectable again.
  const isWeekEffective = (monthName: string, weekIndex: number, weekKey: string): boolean => {
    // 1. If we have the master weeks list in weeksAnalysis, use the exact isEffective value of that week!
    const m = weeksAnalysis?.details?.find((detail: any) => detail.month === monthName || detail.month.startsWith(monthName));
    if (m && Array.isArray(m.weeks) && m.weeks[weekIndex]) {
      return m.weeks[weekIndex].isEffective === true;
    }

    const quota = isManualWeeks
      ? customWeeksConfig.find(m => m.month === monthName)?.effectiveWeeks
      : (() => {
          return m ? (m.effectiveWeeksByGrade?.[gradeLevel] ?? m.effectiveWeeks) : undefined;
        })();

    if (quota === undefined || quota === null) return false;

    // A week that already carries JP is always editable, regardless of quota.
    if (getWeekTotalJp(weekKey) > 0) return true;

    // Count how many OTHER weeks in this same month are already "used" (JP > 0).
    const usedInMonth = weekColumns
      .filter(c => c.month === monthName)
      .filter(c => getWeekTotalJp(c.key) > 0)
      .length;

    return usedInMonth < quota;
  };

  // Filter topics based on active semester (Ganjil / Genap)
  const currentSemesterName = currentSemesterObj?.name || ""; // Ganjil or Genap
  const sourceTopics = sourceProta?.topics || [];
  
  const isGanjil = currentSemesterName.includes("1") || currentSemesterName.toLowerCase().includes("ganjil");
  const isGenap = currentSemesterName.includes("2") || currentSemesterName.toLowerCase().includes("genap");

  // A topic is visible in this Promes if its semester matches the Promes semester, OR if it's Ganjil & Genap
  const visibleTopics = sourceTopics.filter(t => {
    if (t.semester === "Ganjil & Genap") return true;
    if (isGanjil && t.semester === "Ganjil") return true;
    if (isGenap && t.semester === "Genap") return true;
    return t.semester === currentSemesterName;
  });

  const numTopics = visibleTopics.length;
  const numWeeksFilled = Array.from(new Set(currentAllocations.filter(a => a.jp > 0).map(a => a.weekKey))).length;

  // Get JP allocated to a specific cell (topic or subtopic, week)
  const getCellJp = (topicId: string, subtopicId: string | undefined, weekKey: string): number => {
    const alloc = currentAllocations.find(a => 
      a.topicId === topicId && 
      (!subtopicId || a.subtopicId === subtopicId) && 
      a.weekKey === weekKey
    );
    return alloc?.jp || 0;
  };

  // Get total JP allocated to a topic (or subtopic) across ALL weeks of the Promes
  const getMateriAllocatedJpSum = (topicId: string, subtopicId?: string): number => {
    return currentAllocations
      .filter(a => a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId))
      .reduce((sum, a) => sum + a.jp, 0);
  };

  // Cell Color Intensity Class Generator
  const getIntensityColorClass = (jp: number): string => {
    if (jp <= 0) return "bg-transparent hover:bg-slate-100/50 dark:hover:bg-zinc-800/50 border-r border-b border-slate-100 dark:border-zinc-850/40";
    if (jp === 1) return "bg-blue-100/70 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-extrabold border border-blue-200/50";
    if (jp === 2) return "bg-blue-200/80 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-extrabold border border-blue-300/50";
    if (jp === 3) return "bg-blue-300/90 text-blue-900 dark:bg-blue-800/75 dark:text-blue-100 font-extrabold border border-blue-400/50";
    return "bg-blue-500 text-white dark:bg-blue-600 dark:text-zinc-50 font-black border border-blue-600";
  };

  // Save allocations list to Firestore
  const handleSaveAllocations = async (updatedAllocations: PromesAllocation[]) => {
    if (!currentSemesterObj || !selectedClassId || !selectedSubjectId || !user) return;

    try {
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
        allocations: updatedAllocations,
        isManualWeeks,
        customWeeksConfig: isManualWeeks ? customWeeksConfig.map(c => ({
          month: c.month,
          totalWeeks: c.totalWeeks,
          effectiveWeeks: c.effectiveWeeks,
          notes: c.notes || ""
        })) : [],
        protaLastSyncedAt: promes?.protaLastSyncedAt || new Date().toISOString(),
        createdAt: promes?.createdAt || "",
        updatedAt: "",
        createdBy: promes?.createdBy || "",
        updatedBy: ""
      };

      const result = await curriculumPlanningService.saveSemesterProgram(toSave, user.uid, user.displayName, false);
      setPromes(result);
      setSyncAlert(null);
      queryClient.invalidateQueries({ queryKey: ["allSemesterPrograms"] });
      showToast("Alokasi Program Semester berhasil disimpan!", "success");
    } catch (error: any) {
      showToast("Gagal menyimpan alokasi: " + error.message, "error");
    }
  };

  const handleToggleManualWeeks = async (manual: boolean) => {
    if (manual) {
      setIsManualWeeks(true);
      if (weeksAnalysis && weeksAnalysis.details) {
        const initialConfig = weeksAnalysis.details.map((m: any) => ({
          month: m.month,
          totalWeeks: m.totalWeeks,
          effectiveWeeks: m.effectiveWeeksByGrade?.[gradeLevel] ?? m.effectiveWeeks,
          notes: m.notes || ""
        }));
        setCustomWeeksConfig(initialConfig);
        
        const count = initialConfig.reduce((sum, item) => sum + item.effectiveWeeks, 0);
        setEffectiveWeeksCount(count);
        setEffectiveJpSemester(weeklyJp * count);

        const cols: WeekColumn[] = [];
        initialConfig.forEach((m: any) => {
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
    } else {
      if (confirm("Apakah Anda yakin ingin kembali menggunakan Kalender Akademik? Semua penyesuaian manual jumlah pekan Anda akan diatur ulang.")) {
        setIsManualWeeks(false);
        setCustomWeeksConfig([]);
        if (weeksAnalysis) {
          setEffectiveWeeksCount(weeksAnalysis.effectiveWeeks);
          setEffectiveJpSemester(weeklyJp * weeksAnalysis.effectiveWeeks);
          
          const cols: WeekColumn[] = [];
          weeksAnalysis.details.forEach((m: any) => {
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
      }
    }
  };

  const handleAdjustWeeks = (monthName: string, field: 'totalWeeks' | 'effectiveWeeks', increment: boolean) => {
    const updated = customWeeksConfig.map(m => {
      if (m.month === monthName) {
        let val = m[field];
        if (increment) {
          val += 1;
        } else {
          val = Math.max(0, val - 1);
        }
        
        let updatedMonth = { ...m, [field]: val };
        if (field === 'totalWeeks' && updatedMonth.effectiveWeeks > updatedMonth.totalWeeks) {
          updatedMonth.effectiveWeeks = updatedMonth.totalWeeks;
        } else if (field === 'effectiveWeeks' && updatedMonth.effectiveWeeks > updatedMonth.totalWeeks) {
          updatedMonth.totalWeeks = updatedMonth.effectiveWeeks;
        }
        return updatedMonth;
      }
      return m;
    });

    setCustomWeeksConfig(updated);

    const newEffectiveCount = updated.reduce((sum, item) => sum + item.effectiveWeeks, 0);
    setEffectiveWeeksCount(newEffectiveCount);
    setEffectiveJpSemester(weeklyJp * newEffectiveCount);

    const cols: WeekColumn[] = [];
    updated.forEach((m) => {
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
  };

  const handleAutoDistributeJp = () => {
    if (!visibleTopics || visibleTopics.length === 0) {
      showToast("Gagal: Tidak ada topik materi pelajaran yang terdeteksi untuk didistribusikan", "error");
      return;
    }
    if (weekColumns.length === 0) {
      showToast("Gagal: Kolom pekan belum siap atau pekan efektif bernilai 0", "error");
      return;
    }

    if (!confirm("Sistem akan menghitung dan menyebarkan alokasi JP secara berurutan berdasarkan durasi per materi di Prota dan JP per minggu di Jadwal Pelajaran. Tindakan ini akan menimpa distribusi yang sudah ada. Lanjutkan?")) {
      return;
    }

    const updatedAllocations: PromesAllocation[] = [];
    
    interface FlatMateri {
      topicId: string;
      subtopicId?: string;
      totalJp: number;
      remainingJp: number;
    }

    const flatMateris: FlatMateri[] = [];
    visibleTopics.forEach(t => {
      if (t.subtopics && t.subtopics.length > 0) {
        t.subtopics.forEach(st => {
          flatMateris.push({
            topicId: t.id,
            subtopicId: st.id,
            totalJp: st.jp,
            remainingJp: st.jp
          });
        });
      } else {
        flatMateris.push({
          topicId: t.id,
          totalJp: t.jp,
          remainingJp: t.jp
        });
      }
    });

    let currentMateriIndex = 0;
    
    for (let w = 0; w < weekColumns.length; w++) {
      if (currentMateriIndex >= flatMateris.length) break;

      const nextCol = weekColumns[w];
      if (!isWeekEffective(nextCol.month, nextCol.weekIndex, nextCol.key)) {
        continue;
      }

      const weekKey = nextCol.key;
      let weekCapacity = weeklyJp;

      while (weekCapacity > 0 && currentMateriIndex < flatMateris.length) {
        const currentMateri = flatMateris[currentMateriIndex];
        
        if (currentMateri.remainingJp <= 0) {
          currentMateriIndex++;
          continue;
        }

        const fillJp = Math.min(weekCapacity, currentMateri.remainingJp);
        
        updatedAllocations.push({
          id: `${currentMateri.topicId}_${currentMateri.subtopicId || "main"}_${weekKey}`,
          topicId: currentMateri.topicId,
          subtopicId: currentMateri.subtopicId,
          weekKey,
          jp: fillJp
        });

        currentMateri.remainingJp -= fillJp;
        weekCapacity -= fillJp;

        if (currentMateri.remainingJp <= 0) {
          currentMateriIndex++;
        }
      }
    }

    handleSaveAllocations(updatedAllocations);
    showToast("Berhasil mendistribusikan alokasi JP secara otomatis!", "success");
  };

  // Reset Distribution
  const handleResetDistribution = () => {
    if (confirm("Apakah Anda yakin ingin menghapus seluruh alokasi JP minggu yang ada di Program Semester ini? Tindakan ini tidak dapat dibatalkan.")) {
      handleSaveAllocations([]);
    }
  };

  // Sync from Program Tahunan (Import Topics)
  const handleSyncFromProta = async () => {
    if (isSyncingRef.current) return;
    if (!sourceProta || sourceProta.topics.length === 0) {
      showToast("Gagal: Program Tahunan tidak memiliki materi pembelajaran untuk disinkronkan", "error");
      return;
    }

    if (!user || !currentSemesterObj) return;

    isSyncingRef.current = true;
    setLoading(true);
    try {
      // Create empty allocations, maintaining any overlapping allocations if they match visible topics
      const updatedAllocations: PromesAllocation[] = [];
      
      // Filter out allocations that belong to topics that no longer exist or are not visible
      if (promes) {
        promes.allocations.forEach(a => {
          const isTopicValid = visibleTopics.some(t => t.id === a.topicId);
          if (isTopicValid) {
            updatedAllocations.push(a);
          }
        });
      }

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
        allocations: updatedAllocations,
        isManualWeeks,
        customWeeksConfig: isManualWeeks ? customWeeksConfig : [],
        protaLastSyncedAt: new Date().toISOString(),
        createdAt: promes?.createdAt || "",
        updatedAt: "",
        createdBy: promes?.createdBy || "",
        updatedBy: ""
      };

      const result = await curriculumPlanningService.saveSemesterProgram(toSave, user.uid, user.displayName, true);
      setPromes(result);
      setSyncAlert(null);
      showToast("Program Semester berhasil diselaraskan dengan Prota!", "success");
    } catch (error: any) {
      showToast("Gagal sinkronisasi data: " + error.message, "error");
    } finally {
    setLoading(false);
    isSyncingRef.current = false;
}
  };

  // Open Cell Click popover/modal
  const handleCellClick = (
    topicId: string, 
    subtopicId: string | undefined, 
    weekKey: string,
    monthLabel: string,
    weekNum: string,
    materiTitle: string,
    materiAllocatedJp: number
  ) => {
    const weekCol = weekColumns.find(c => c.key === weekKey);
    if (weekCol && !isWeekEffective(weekCol.month, weekCol.weekIndex, weekCol.key)) {
      showToast("Gagal: Pekan ini tidak efektif atau dinonaktifkan di kalender akademik!", "warning");
      return;
    }

    const currentVal = getCellJp(topicId, subtopicId, weekKey);
    setSelectedCell({
      topicId,
      subtopicId,
      weekKey,
      monthLabel,
      weekNum,
      materiTitle,
      materiAllocatedJp,
      currentCellJp: currentVal
    });
    setInputCellJp(currentVal || 0);
    setActionType("normal");
    setTargetWeekKey("");
    setIsCellModalOpen(true);
  };

  // Save Cell Allocation and Action helpers (Move, Copy, Shift)
  const handleSaveCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell || !promes) return;

    const { topicId, subtopicId, weekKey, materiAllocatedJp, currentCellJp } = selectedCell;

    // 1. Basic validation of input JP value (no negatives, no decimals)
    if (inputCellJp < 0) {
      showToast("Gagal: Jumlah JP tidak boleh bernilai negatif!", "error");
      return;
    }

    if (!Number.isInteger(inputCellJp)) {
      showToast("Gagal: Jumlah JP harus berupa bilangan bulat (tidak boleh desimal)!", "error");
      return;
    }

    // Determine the week being assigned
    const assignedWeekKey = (actionType === "copy" || actionType === "move") ? targetWeekKey : weekKey;
    if ((actionType === "copy" || actionType === "move") && !targetWeekKey) {
      showToast("Silakan pilih minggu tujuan!", "warning");
      return;
    }

    const currentWeekCol = weekColumns.find(c => c.key === assignedWeekKey);
    if (!currentWeekCol || !isWeekEffective(currentWeekCol.month, currentWeekCol.weekIndex, currentWeekCol.key)) {
      showToast("Gagal: Tidak dapat mengalokasikan JP pada pekan non-efektif / dinonaktifkan!", "error");
      return;
    }

    // 2. Calculate how many JP are currently allocated for this topic EXCEPT the clicked cell
    const otherAllocatedSum = getMateriAllocatedJpSum(topicId, subtopicId) - currentCellJp;

    // 3. Total allocated JP after this input
    const targetTopicTotalJp = otherAllocatedSum + inputCellJp;

    // Check if it exceeds the Prota defined JP allocation
    if (targetTopicTotalJp > materiAllocatedJp) {
      showToast(`Gagal: Total alokasi JP untuk topik ini (${targetTopicTotalJp} JP) melebihi kapasitas materi di Prota (${materiAllocatedJp} JP)!`, "error");
      return;
    }

    // 4. Check if overall Promes JP is exceeded
    const overallOtherJpSum = usedJp - currentCellJp;
    if (overallOtherJpSum + inputCellJp > effectiveJpSemester) {
      showToast(`Gagal: Total alokasi JP Program Semester (${overallOtherJpSum + inputCellJp} JP) melebihi JP Efektif Semester (${effectiveJpSemester} JP)!`, "error");
      return;
    }

    // 5. Check if weekly JP capacity of this subject is exceeded in the target week
    const weekAllocationsSum = currentAllocations
      .filter(a => a.weekKey === assignedWeekKey && !(a.topicId === topicId && a.subtopicId === subtopicId))
      .reduce((sum, a) => sum + a.jp, 0);

    if (weekAllocationsSum + inputCellJp > weeklyJp) {
      showToast(`Gagal: Total alokasi JP pada pekan ini (${weekAllocationsSum + inputCellJp} JP) melebihi batas JP Mapel per pekan (${weeklyJp} JP)! Silakan alokasikan ke pekan berikutnya.`, "error");
      return;
    }

    let updatedAllocations = [...currentAllocations];

    if (actionType === "normal") {
      // Standard cell setting
      updatedAllocations = updatedAllocations.filter(a => 
        !(a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId) && a.weekKey === weekKey)
      );

      if (inputCellJp > 0) {
        updatedAllocations.push({
          id: `${topicId}_${subtopicId || "main"}_${weekKey}`,
          topicId,
          subtopicId,
          weekKey,
          jp: inputCellJp
        });
      }
    } else if (actionType === "copy") {
      // Check if target week copy exceeds topic JP
      const targetCurrentVal = getCellJp(topicId, subtopicId, targetWeekKey);
      const copyOtherSum = getMateriAllocatedJpSum(topicId, subtopicId) - targetCurrentVal;
      
      if (copyOtherSum + inputCellJp > materiAllocatedJp) {
        showToast(`Gagal menyalin: Akumulasi JP melebihi kapasitas materi Prota!`, "error");
        return;
      }

      // Perform Copy
      updatedAllocations = updatedAllocations.filter(a => 
        !(a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId) && a.weekKey === targetWeekKey)
      );

      if (inputCellJp > 0) {
        updatedAllocations.push({
          id: `${topicId}_${subtopicId || "main"}_${targetWeekKey}`,
          topicId,
          subtopicId,
          weekKey: targetWeekKey,
          jp: inputCellJp
        });
      }
    } else if (actionType === "move") {
      // Clear source cell, and set target cell
      updatedAllocations = updatedAllocations.filter(a => 
        !(a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId) && a.weekKey === weekKey)
      );
      updatedAllocations = updatedAllocations.filter(a => 
        !(a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId) && a.weekKey === targetWeekKey)
      );

      if (inputCellJp > 0) {
        updatedAllocations.push({
          id: `${topicId}_${subtopicId || "main"}_${targetWeekKey}`,
          topicId,
          subtopicId,
          weekKey: targetWeekKey,
          jp: inputCellJp
        });
      }
    }

    setIsCellModalOpen(false);
    handleSaveAllocations(updatedAllocations);
  };

  // Auto-shift allocations: Moves the entire distribution chain to the right (skipping non-effective weeks)!
  const handleAutoShift = () => {
    if (!selectedCell || !promes) return;
    const { topicId, subtopicId } = selectedCell;

    // Find all week keys that are larger or equal to current week index
    const currentWeekIdx = weekColumns.findIndex(c => c.key === selectedCell.weekKey);
    if (currentWeekIdx === -1 || currentWeekIdx === weekColumns.length - 1) {
      showToast("Tidak bisa bergeser lebih jauh lagi!", "warning");
      return;
    }

    // Filter allocations for this specific topic
    const topicAllocations = currentAllocations.filter(a => 
      a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId)
    );

    let updatedAllocations = currentAllocations.filter(a => 
      !(a.topicId === topicId && (!subtopicId || a.subtopicId === subtopicId))
    );

    // Shift allocations to the right, skipping non-effective/disabled weeks
    topicAllocations.forEach(a => {
      const idx = weekColumns.findIndex(c => c.key === a.weekKey);
      if (idx !== -1 && idx >= currentWeekIdx) {
        let nextIdx = idx + 1;
        while (nextIdx < weekColumns.length) {
          const nextCol = weekColumns[nextIdx];
          if (isWeekEffective(nextCol.month, nextCol.weekIndex, nextCol.key)) {
            break;
          }
          nextIdx++;
        }
        
        if (nextIdx < weekColumns.length) {
          updatedAllocations.push({
            ...a,
            weekKey: weekColumns[nextIdx].key
          });
        }
      } else {
        // Keep allocations that occur before the current shift point
        updatedAllocations.push(a);
      }
    });

    setIsCellModalOpen(false);
    handleSaveAllocations(updatedAllocations);
    showToast("Alokasi berhasil digeser ke pekan efektif berikutnya di sebelah kanan!", "success");
  };

  // Toggle Collapse / Expand
  const toggleExpand = (id: string) => {
    setExpandedTopics(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // --- EXPORTS ---

  // Export to Excel
  const exportToExcel = () => {
    if (visibleTopics.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      const rows: any[] = [];
      visibleTopics.forEach((t, idx) => {
        const rowData: any = {
          "No": idx + 1,
          "Materi / Topik / Tema": t.title,
          "Alokasi JP": t.jp
        };

        // Fill weeks
        weekColumns.forEach(col => {
          const cellJp = getCellJp(t.id, undefined, col.key);
          rowData[`${col.month} Mg ${col.label}`] = cellJp || "";
        });

        rows.push(rowData);

        if (t.subtopics && t.subtopics.length > 0) {
          t.subtopics.forEach((sub, subIdx) => {
            const subRowData: any = {
              "No": `${idx + 1}.${subIdx + 1}`,
              "Materi / Topik / Tema": `  - ${sub.title}`,
              "Alokasi JP": sub.jp
            };

            weekColumns.forEach(col => {
              const cellJp = getCellJp(t.id, sub.id, col.key);
              subRowData[`${col.month} Mg ${col.label}`] = cellJp || "";
            });

            rows.push(subRowData);
          });
        }
      });

      // Add Summary Row
      const summaryRow: any = {
        "No": "",
        "Materi / Topik / Tema": "TOTAL JP TERDISTRIBUSI",
        "Alokasi JP": usedJp
      };
      rows.push(summaryRow);

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Program Semester");
      XLSX.writeFile(wb, `Program_Semester_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.xlsx`);
      showToast("Unduh data Excel berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export Excel: " + error.message, "error");
    }
  };

  // Export to PDF (Landscape style)
  const exportToPDF = () => {
    if (visibleTopics.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    try {
      const doc = new jsPDF("l", "mm", "a4"); // Landscape
      const yearName = semesters.find(s => s.academicYearId === selectedAcademicYearId)?.academicYearName || "";

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("PROGRAM SEMESTER (PROMES)", 148, 15, { align: "center" });
      doc.setFontSize(11);
      doc.text("SMP ALKARIM RASYID SYSTEM", 148, 21, { align: "center" });

      doc.setDrawColor(180);
      doc.line(14, 25, 282, 25);

      // Metadata
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tahun Pelajaran: ${yearName}`, 14, 31);
      doc.text(`Semester        : ${currentSemesterName}`, 14, 36);
      doc.text(`Kelas / Tingkat: ${selectedClassObj?.name || "-"} (${selectedClassObj?.gradeLevel || "-"})`, 14, 41);

      doc.text(`Guru Pengampu  : ${teacherName}`, 155, 31);
      doc.text(`JP Efektif Sem : ${effectiveJpSemester} JP`, 155, 36);
      doc.text(`Pekan Efektif   : ${effectiveWeeksCount} Pekan`, 155, 41);

      doc.line(14, 45, 282, 45);

      // We draw a compact landscape table for PDF with key summary
      let y = 52;
      doc.setFont("helvetica", "bold");
      doc.setFillColor(240, 240, 240);
      doc.rect(14, y - 5, 268, 7, "F");

      doc.text("No", 16, y);
      doc.text("Materi Pokok / Bahasan Pembelajaran", 32, y);
      doc.text("JP", 195, y);
      doc.text("JP Terbagi", 215, y);
      doc.text("Keterangan", 240, y);

      doc.line(14, y + 2, 282, y + 2);
      y += 8;

      doc.setFont("helvetica", "normal");
      visibleTopics.forEach((t, idx) => {
        if (y > 185) {
          doc.addPage();
          y = 20;
        }

        const allocatedSum = getMateriAllocatedJpSum(t.id);

        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}`, 16, y);
        doc.text(t.title.length > 80 ? t.title.substring(0, 77) + "..." : t.title, 32, y);
        doc.text(`${t.jp}`, 195, y);
        doc.text(`${allocatedSum} JP`, 215, y);
        doc.setFont("helvetica", "normal");
        doc.text(allocatedSum === t.jp ? "Selesai" : "Belum Lengkap", 240, y);

        doc.line(14, y + 2, 282, y + 2);
        y += 7;

        if (t.subtopics && t.subtopics.length > 0) {
          t.subtopics.forEach((sub, subIdx) => {
            if (y > 185) {
              doc.addPage();
              y = 20;
            }

            const subAllocatedSum = getMateriAllocatedJpSum(t.id, sub.id);

            doc.setFont("helvetica", "italic");
            doc.text(`${idx + 1}.${subIdx + 1}`, 20, y);
            doc.text(`- ${sub.title.length > 75 ? sub.title.substring(0, 72) + "..." : sub.title}`, 32, y);
            doc.text(`${sub.jp}`, 195, y);
            doc.text(`${subAllocatedSum} JP`, 215, y);
            doc.text(subAllocatedSum === sub.jp ? "Selesai" : "Belum Lengkap", 240, y);

            doc.line(14, y + 2, 282, y + 2);
            y += 7;
          });
        }
      });

      doc.save(`Program_Semester_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.pdf`);
      showToast("Unduh dokumen PDF berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export PDF: " + error.message, "error");
    }
  };

  // Export to Word
  const exportToWord = () => {
    if (visibleTopics.length === 0) {
      showToast("Tidak ada data untuk diekspor", "warning");
      return;
    }

    const yearName = semesters.find(s => s.academicYearId === selectedAcademicYearId)?.academicYearName || "";
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>Program Semester</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.5; }
          .header { text-align: center; margin-bottom: 25px; }
          h2 { margin: 0; font-size: 15pt; text-transform: uppercase; }
          h3 { margin: 5px 0; font-size: 12pt; }
          .metadata-table { width: 100%; margin-bottom: 20px; font-size: 10pt; border: none; }
          .metadata-table td { padding: 4px; border: none; }
          .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10pt; }
          .main-table th, .main-table td { border: 1px solid #000; padding: 6px; text-align: left; }
          .main-table th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
          .sub-row { font-style: italic; color: #555; background-color: #fbfbfb; }
          .total-row { font-weight: bold; background-color: #f0f0f0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>PROGRAM SEMESTER (PROMES)</h2>
          <h3>SMP ALKARIM RASYID</h3>
        </div>
        
        <table class="metadata-table">
          <tr>
            <td width="25%"><b>Tahun Pelajaran</b></td><td>: ${yearName}</td>
            <td width="25%"><b>Mata Pelajaran</b></td><td>: ${selectedSubjectObj?.name || "-"}</td>
          </tr>
          <tr>
            <td><b>Semester</b></td><td>: ${currentSemesterName}</td>
            <td><b>Kelas</b></td><td>: ${selectedClassObj?.name || "-"} (Tingkat ${selectedClassObj?.gradeLevel || "-"})</td>
          </tr>
          <tr>
            <td><b>Guru Pengampu</b></td><td>: ${teacherName}</td>
            <td><b>JP Efektif Semester</b></td><td>: ${effectiveJpSemester} JP (${effectiveWeeksCount} Pekan)</td>
          </tr>
        </table>

        <table class="main-table">
          <thead>
            <tr>
              <th rowspan="2" width="5%">No</th>
              <th rowspan="2" width="35%">Materi Pokok / Bahasan Pembelajaran</th>
              <th rowspan="2" width="8%">Alokasi JP</th>
              <th colspan="${weekColumns.length}">Rincian Distribusi Pekan Efektif (Pekan / JP)</th>
            </tr>
            <tr>
              ${weekColumns.map(col => `<th>${col.month.substring(0, 3)} ${col.label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${visibleTopics.map((t, idx) => `
              <tr>
                <td style="text-align: center;"><b>${idx + 1}</b></td>
                <td><b>${t.title}</b></td>
                <td style="text-align: center;"><b>${t.jp} JP</b></td>
                ${weekColumns.map(col => {
                  const cellVal = getCellJp(t.id, undefined, col.key);
                  return `<td style="text-align: center; ${cellVal > 0 ? 'background-color: #dbeafe;' : ''}">${cellVal || ""}</td>`;
                }).join("")}
              </tr>
              ${t.subtopics?.map((sub, subIdx) => `
                <tr class="sub-row">
                  <td style="text-align: center;">${idx + 1}.${subIdx + 1}</td>
                  <td style="padding-left: 15px;">- ${sub.title}</td>
                  <td style="text-align: center;">${sub.jp} JP</td>
                  ${weekColumns.map(col => {
                    const cellVal = getCellJp(t.id, sub.id, col.key);
                    return `<td style="text-align: center; ${cellVal > 0 ? 'background-color: #eff6ff;' : ''}">${cellVal || ""}</td>`;
                  }).join("")}
                </tr>
              `).join("") || ""}
            `).join("")}
            <tr class="total-row">
              <td colspan="2">TOTAL JP TERDISTRIBUSI</td>
              <td style="text-align: center;">${usedJp} JP</td>
              <td colspan="${weekColumns.length}">Sisa JP Efektif Semester: ${remainingJp} JP</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Program_Semester_${selectedClassObj?.name || "Kelas"}_${selectedSubjectObj?.name || "Mapel"}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Unduh dokumen Word berhasil!", "success");
  };

  return (
    <div className="space-y-6" id="semester-program-view">
      {/* Page Header Title */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2.5">
            <Grid className="h-6.5 w-6.5 text-blue-500" />
            Program Semester (PROMES)
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Mendistribusikan alokasi JP materi dari Prota secara mendetail ke rincian pekan efektif di semester aktif.
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
                // Also update matching academic year
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

      {/* RPE & Sync Alert Notifications */}
      {syncAlert && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-4 flex items-start gap-3 text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <h4 className="text-xs font-bold uppercase tracking-tight">Perhatian: Penyelarasan Data Diperlukan</h4>
            <p className="text-xs leading-relaxed opacity-90">{syncAlert}</p>
            {sourceProta && sourceProta.topics.length > 0 && (
              <button
                onClick={handleSyncFromProta}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Sinkronkan dari Prota
              </button>
            )}
          </div>
        </div>
      )}

      {/* Promes Indicators Block */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Effective JP Semester */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">JP Efektif Semester</span>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100 mt-1">{effectiveJpSemester} JP</div>
          <p className="text-[10px] text-slate-500 mt-1">{weeklyJp} JP/Minggu &bull; {effectiveWeeksCount} Pekan</p>
        </div>

        {/* Allocated JP */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">JP Terdistribusi</span>
          <div className={`text-xl font-black mt-1 ${usedJp > effectiveJpSemester ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-zinc-100'}`}>
            {usedJp} JP
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{numTopics} Topik di Semester Ini</p>
        </div>

        {/* Sisa JP */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Sisa JP Semester</span>
          <div className={`text-xl font-black mt-1 ${remainingJp < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-zinc-100'}`}>
            {remainingJp} JP
          </div>
          <p className="text-[10px] text-slate-500 mt-1">Alokasi tidak terdistribusi</p>
        </div>

        {/* Weeks Filled */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Minggu Terisi KBM</span>
          <div className="text-xl font-black text-slate-800 dark:text-zinc-100 mt-1">{numWeeksFilled} Pekan</div>
          <p className="text-[10px] text-slate-500 mt-1">Distribusi kepekatan mengajar</p>
        </div>

        {/* Color Intensity Indicator */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Legenda Kepekatan JP</span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-4 h-4 rounded bg-blue-100/70 border border-blue-200 text-[8px] font-bold text-blue-700 flex items-center justify-center">1</span>
            <span className="w-4 h-4 rounded bg-blue-200/80 border border-blue-300 text-[8px] font-bold text-blue-800 flex items-center justify-center">2</span>
            <span className="w-4 h-4 rounded bg-blue-300/90 border border-blue-400 text-[8px] font-bold text-blue-900 flex items-center justify-center">3</span>
            <span className="w-4 h-4 rounded bg-blue-500 text-white text-[8px] font-black flex items-center justify-center">4+</span>
          </div>
          <p className="text-[9px] text-slate-400 mt-1">Intensitas Jam per Pekan</p>
        </div>
      </div>

      {/* Konfigurasi Minggu Efektif (Manual / Kalender Akademik) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-tight flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Sinkronisasi Kalender Akademik Aktif
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Jumlah pekan dan pekan efektif untuk setiap bulan disinkronkan secara real-time dari data pusat Kalender Akademik ({currentSemesterObj?.name || "Semester Aktif"}).
            </p>
          </div>
          <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400">
            Terhubung
          </div>
        </div>
      </div>

      {/* Metadata Panel (Landscape Mode Display) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-150 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-tight">INFORMASI DOKUMEN PROMES</h2>
            <p className="text-xs text-slate-400 mt-0.5">Rincian parameter program semester yang aktif saat ini.</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 rounded-xl text-[11px] font-semibold text-blue-700 dark:text-blue-300">
            <Info className="h-4 w-4 text-blue-500" />
            Format Cetak: Landscape (Mendatar)
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tahun Pelajaran & Semester</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              TP {currentSemesterObj?.academicYearName || "-"} ({currentSemesterName})
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mata Pelajaran & Kelas</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              {selectedSubjectObj?.name || "-"} ({selectedClassObj?.name || "-"})
            </div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guru Pengampu</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">{teacherName}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jumlah JP & Pekan Efektif</div>
            <div className="font-semibold text-slate-700 dark:text-zinc-300 mt-0.5">
              {effectiveJpSemester} JP ({effectiveWeeksCount} Pekan Belajar)
            </div>
          </div>
        </div>
      </div>

      {/* Promes Landscape Grid Matrix */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        {/* Table Toolbar */}
        <div className="px-5 py-4 border-b border-slate-150 dark:border-zinc-850/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-50/40 dark:bg-zinc-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-tight">Distribusi Mingguan</span>
            
            {/* Color Palette settings */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-950/40 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-zinc-800 text-[11px] font-semibold">
              <div className="flex items-center gap-1 text-slate-400">
                <Palette className="h-3.5 w-3.5 text-blue-500" />
                <span>Warna JP:</span>
              </div>
              <div className="flex items-center gap-1">
                {colorPresets.map(preset => {
                  let circleColor = "";
                  if (preset.value === "blue") circleColor = "#3b82f6";
                  else if (preset.value === "emerald") circleColor = "#10b981";
                  else if (preset.value === "amber") circleColor = "#f59e0b";
                  else if (preset.value === "purple") circleColor = "#8b5cf6";
                  else if (preset.value === "rose") circleColor = "#f43f5e";
                  else circleColor = "#64748b";

                  return (
                    <button
                      key={preset.value}
                      onClick={() => {
                        setSelectedBgTheme(preset.value);
                        localStorage.setItem("prosem_jp_color", preset.value);
                      }}
                      title={`Tema ${preset.name}`}
                      className={`w-4 h-4 rounded-full border transition-all cursor-pointer ${
                        selectedBgTheme === preset.value 
                          ? 'scale-110 border-blue-600 dark:border-blue-400 ring-2 ring-blue-500/20' 
                          : 'border-slate-300 dark:border-zinc-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: circleColor }}
                    />
                  );
                })}
                <div className="flex items-center gap-1 border-l border-slate-250 dark:border-zinc-850 pl-1.5 ml-1">
                  <input
                    type="color"
                    value={selectedBgTheme.startsWith("#") ? selectedBgTheme : "#3b82f6"}
                    onChange={(e) => {
                      setSelectedBgTheme(e.target.value);
                      localStorage.setItem("prosem_jp_color", e.target.value);
                    }}
                    title="Pilih warna kustom"
                    className="w-4 h-4 rounded-md border-0 p-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {sourceProta && sourceProta.topics.length > 0 && (
              <button
                onClick={handleSyncFromProta}
                className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-150 rounded-xl text-xs font-bold px-3 py-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Sinkronkan Prota
              </button>
            )}

            <button
              onClick={handleAutoDistributeJp}
              disabled={visibleTopics.length === 0}
              className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-150 rounded-xl text-xs font-bold px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" /> Saran Distribusi JP
            </button>

            <button
              onClick={handleResetDistribution}
              disabled={currentAllocations.length === 0}
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-150 rounded-xl text-xs font-bold px-3 py-1.5 cursor-pointer transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Reset Alokasi
            </button>

            {/* Export buttons */}
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              Excel
            </button>
            <button
              onClick={exportToPDF}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-rose-500" />
              PDF
            </button>
            <button
              onClick={exportToWord}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 dark:border-zinc-850 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-300 shadow-sm cursor-pointer transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-blue-500" />
              Word
            </button>
          </div>
        </div>

        {/* Matrix Container */}
        {visibleTopics.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <div className="flex flex-col items-center gap-2">
              <ListFilter className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
              <span className="font-semibold text-xs">Belum ada topik yang dialokasikan di semester ini</span>
              <p className="text-[10px] text-slate-400 max-w-sm mt-0.5">Materi diambil otomatis dari Program Tahunan (Prota). Pastikan topik Prota telah dikonfigurasi ke semester {currentSemesterName}.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                {/* Month header row */}
                <tr className="bg-slate-100/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                  <th className="py-3 px-4 text-center border-r border-slate-200 dark:border-zinc-800 w-[60px]" rowSpan={2}>No</th>
                  <th className="py-3 px-4 border-r border-slate-200 dark:border-zinc-800" rowSpan={2} style={{ minWidth: "220px" }}>Bahasan Materi Utama / Sub-Topik</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200 dark:border-zinc-800 w-[80px]" rowSpan={2}>JP Prota</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200 dark:border-zinc-800 w-[90px]" rowSpan={2}>JP Terbagi</th>
                  
                  {/* Grouped month columns */}
                  {weeksAnalysis?.details.map((m: any) => (
                    <th 
                      key={m.month} 
                      className="py-1.5 px-2 text-center border-r border-slate-200 dark:border-zinc-800 font-extrabold bg-blue-50/20 dark:bg-blue-950/10 text-[9px]" 
                      colSpan={m.totalWeeks}
                    >
                      {m.month}
                    </th>
                  ))}
                </tr>

                {/* Week index row */}
                <tr className="bg-slate-50/50 dark:bg-zinc-900/30 border-b border-slate-200 dark:border-zinc-800 text-[9px] font-extrabold text-slate-400 dark:text-zinc-500">
                  {weekColumns.map(col => {
                    const isEff = isWeekEffective(col.month, col.weekIndex, col.key);
                    return (
                      <th 
                        key={col.key} 
                        className={`py-1 px-1.5 text-center border-r border-slate-150 dark:border-zinc-850/60 w-[38px] ${
                          !isEff ? 'bg-slate-200/50 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-600 line-through' : ''
                        }`}
                        title={!isEff ? "Pekan terkunci: kuota pekan efektif bulan ini sudah terpakai" : `Pekan ke-${col.label}`}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleTopics.map((topic, index) => {
                  const hasSubtopics = topic.subtopics && topic.subtopics.length > 0;
                  const isExpanded = expandedTopics[topic.id];
                  const topicAllocatedSum = getMateriAllocatedJpSum(topic.id);

                  return (
                    <React.Fragment key={topic.id}>
                      {/* Main Topic Row */}
                      <tr className="border-b border-slate-150 dark:border-zinc-850 hover:bg-slate-50/10 dark:hover:bg-zinc-900/10 transition-colors font-bold text-slate-800 dark:text-zinc-200">
                        <td className="py-2.5 px-4 text-center border-r border-slate-150 dark:border-zinc-850/60 font-black">{index + 1}</td>
                        
                        <td className="py-2.5 px-4 border-r border-slate-150 dark:border-zinc-850/60">
                          <div className="flex items-center gap-1.5">
                            {hasSubtopics && (
                              <button 
                                onClick={() => toggleExpand(topic.id)}
                                className="p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 transition-all cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            <span className="truncate max-w-[280px]">{topic.title}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center border-r border-slate-150 dark:border-zinc-850/60 font-extrabold text-slate-500">
                          {topic.jp} JP
                        </td>

                        <td className={`py-2.5 px-3 text-center border-r border-slate-150 dark:border-zinc-850/60 font-black ${topicAllocatedSum === topic.jp ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-zinc-300'}`}>
                          {topicAllocatedSum} JP
                        </td>

                        {/* Week cells for Main Topic */}
                        {weekColumns.map(col => {
                          const cellVal = getCellJp(topic.id, undefined, col.key);
                          const isInteractive = !hasSubtopics; // Can only input directly on main topic if it has NO subtopics
                          const isEff = isWeekEffective(col.month, col.weekIndex, col.key);

                          const cellStyle = getCellStylesAndClasses(cellVal);

                          return (
                            <td 
                              key={col.key}
                              onClick={() => isInteractive && isEff && handleCellClick(
                                topic.id, 
                                undefined, 
                                col.key, 
                                col.month, 
                                col.label, 
                                topic.title, 
                                topic.jp
                              )}
                              className={`text-center py-2.5 transition-all select-none border-r border-b border-slate-100 dark:border-zinc-850/40 ${
                                isInteractive && isEff ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'
                              } ${!isEff ? 'bg-slate-200/60 dark:bg-zinc-800/50 opacity-50 text-transparent' : cellStyle.className}`}
                              style={isEff ? cellStyle.style : {}}
                              title={!isEff ? "Pekan terkunci: kuota pekan efektif bulan ini sudah terpakai" : isInteractive ? "Klik untuk alokasi JP" : ""}
                            >
                              {isEff && cellVal > 0 ? cellVal : ""}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Subtopics Listing */}
                      {hasSubtopics && isExpanded && (
                        <AnimatePresence>
                          {topic.subtopics?.map((sub, subIdx) => {
                            const subAllocatedSum = getMateriAllocatedJpSum(topic.id, sub.id);

                            return (
                              <tr 
                                key={sub.id} 
                                className="border-b border-slate-100 dark:border-zinc-850/40 bg-slate-50/20 dark:bg-zinc-900/10 italic text-slate-600 dark:text-zinc-400 text-[11px]"
                              >
                                <td className="py-2 px-4 text-center border-r border-slate-150 dark:border-zinc-850/40 text-slate-400">{index + 1}.${subIdx + 1}</td>
                                
                                <td className="py-2 px-4 border-r border-slate-150 dark:border-zinc-850/40 pl-8 flex items-center gap-1 font-semibold text-slate-500 dark:text-zinc-400">
                                  <CornerDownRight className="h-3 w-3 shrink-0 text-slate-400" />
                                  <span className="truncate max-w-[260px]">{sub.title}</span>
                                </td>

                                <td className="py-2 px-3 text-center border-r border-slate-150 dark:border-zinc-850/40 font-bold text-slate-400">
                                  {sub.jp} JP
                                </td>

                                <td className={`py-2 px-3 text-center border-r border-slate-150 dark:border-zinc-850/40 font-black ${subAllocatedSum === sub.jp ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                                  {subAllocatedSum} JP
                                </td>

                                {/* Week cells for Subtopic */}
                                {weekColumns.map(col => {
                                  const cellVal = getCellJp(topic.id, sub.id, col.key);
                                  const isEff = isWeekEffective(col.month, col.weekIndex, col.key);

                                  const cellStyle = getCellStylesAndClasses(cellVal);

                                  return (
                                    <td 
                                      key={col.key}
                                      onClick={() => isEff && handleCellClick(
                                        topic.id, 
                                        sub.id, 
                                        col.key, 
                                        col.month, 
                                        col.label, 
                                        sub.title, 
                                        sub.jp
                                      )}
                                      className={`text-center py-2 transition-all select-none border-r border-b border-slate-100 dark:border-zinc-850/40 ${
                                        isEff ? 'cursor-pointer hover:scale-105' : 'cursor-not-allowed'
                                      } ${!isEff ? 'bg-slate-200/60 dark:bg-zinc-800/50 opacity-50 text-transparent' : cellStyle.className}`}
                                      style={isEff ? cellStyle.style : {}}
                                      title={!isEff ? "Pekan terkunci: kuota pekan efektif bulan ini sudah terpakai" : "Klik untuk alokasi JP"}
                                    >
                                      {isEff && cellVal > 0 ? cellVal : ""}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </AnimatePresence>
                      )}
                    </React.Fragment>
                  );
                })}
                
                {/* Total accumulation row */}
                <tr className="bg-slate-100/50 dark:bg-zinc-900/60 border-t-2 border-slate-200 dark:border-zinc-800 font-extrabold text-slate-800 dark:text-zinc-200">
                  <td className="py-3 px-4 text-center border-r border-slate-150 dark:border-zinc-850" colSpan={2}>TOTAL JP TERDISTRIBUSI MINGGUAN</td>
                  <td className="py-3 px-3 text-center border-r border-slate-150 dark:border-zinc-850 font-extrabold text-slate-400">-</td>
                  <td className="py-3 px-3 text-center border-r border-slate-150 dark:border-zinc-850 text-blue-600 dark:text-blue-400 font-black">{usedJp} JP</td>
                  
                  {/* Sum values across each week column */}
                  {weekColumns.map(col => {
                    const weekTotalJp = currentAllocations
                      .filter(a => a.weekKey === col.key)
                      .reduce((sum, a) => sum + a.jp, 0);

                    return (
                      <td key={col.key} className="py-3 px-1 text-center font-black text-slate-700 dark:text-zinc-300 border-r border-slate-150 dark:border-zinc-850/60">
                        {weekTotalJp > 0 ? weekTotalJp : ""}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- CELL ALLOCATION POPOVER MODAL --- */}
      <AnimatePresence>
        {isCellModalOpen && selectedCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-150 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900">
                <h3 className="text-xs font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Grid className="h-4.5 w-4.5 text-blue-500" />
                  Atur Alokasi JP
                </h3>
                <button
                  onClick={() => setIsCellModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer text-lg"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSaveCell} className="p-5 space-y-4">
                {/* Information badge */}
                <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 p-3 rounded-xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Materi / Sub-Materi</div>
                  <div className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 leading-relaxed">{selectedCell.materiTitle}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 pt-1 font-semibold border-t border-blue-100/50 dark:border-blue-950/20 mt-1">
                    <span>Target Alokasi Prota: <b className="text-blue-600 dark:text-blue-400">{selectedCell.materiAllocatedJp} JP</b></span>
                    <span>Terdistribusi: <b className="text-slate-700 dark:text-zinc-300">{getMateriAllocatedJpSum(selectedCell.topicId, selectedCell.subtopicId)} JP</b></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <span>Penempatan Pekan: <b>{selectedCell.monthLabel}</b>, Pekan ke-<b>{selectedCell.weekNum}</b></span>
                </div>

                {/* Main Action Type */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType("normal")}
                    className={`py-1.5 border rounded-xl text-[10px] font-bold cursor-pointer transition-colors ${actionType === "normal" ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-850 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-slate-600 dark:text-zinc-300"}`}
                  >
                    Atur JP
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType("copy")}
                    className={`py-1.5 border rounded-xl text-[10px] font-bold cursor-pointer transition-colors ${actionType === "copy" ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-850 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-slate-600 dark:text-zinc-300"}`}
                  >
                    Salin JP
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType("move")}
                    className={`py-1.5 border rounded-xl text-[10px] font-bold cursor-pointer transition-colors ${actionType === "move" ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-850 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-slate-600 dark:text-zinc-300"}`}
                  >
                    Pindahkan JP
                  </button>
                </div>

                {/* Input JP value */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Jumlah Jam Pelajaran (JP)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={inputCellJp}
                    onChange={(e) => setInputCellJp(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm font-semibold dark:text-zinc-100"
                    placeholder="Masukkan JP"
                  />
                </div>

                {/* Extra Options for Move / Copy */}
                {(actionType === "copy" || actionType === "move") && (
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pilih Pekan Tujuan</label>
                    <select
                      value={targetWeekKey}
                      onChange={(e) => setTargetWeekKey(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs font-semibold dark:text-zinc-100"
                    >
                      <option value="">-- Pilih Pekan --</option>
                      {weekColumns
                        .filter(col => col.key !== selectedCell.weekKey)
                        .map(col => (
                          <option key={col.key} value={col.key}>{col.month} - Pekan {col.label}</option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Auto-shift row helper */}
                {actionType === "normal" && (
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Punya materi tersisa di pekan-pekan berikutnya?</span>
                    <button
                      type="button"
                      onClick={handleAutoShift}
                      title="Geser seluruh distribusi ke kanan"
                      className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Geser Pekan Kanan
                    </button>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsCellModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Lakukan Aksi
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
