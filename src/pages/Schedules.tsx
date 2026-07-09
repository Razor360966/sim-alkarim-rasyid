import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  Lock, 
  Unlock, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Info, 
  Save, 
  X, 
  Layers, 
  CheckCheck,
  Search,
  Filter,
  Calendar,
  User,
  School,
  Clock,
  BookOpen,
  Settings
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useSchedules } from "../hooks/schedule.hook";
import { academicYearService } from "../services/academicYear.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { teacherService } from "../services/teacherService";
import { lessonPeriodService } from "../services/lessonPeriod.service";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { Schedule, Class, Teacher, LessonPeriod, LessonPeriodType, CurriculumMatrix } from "../types";
import { useToast } from "../contexts/ToastContext";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { 
  PreAnalysisPanel, 
  PostAnalysisPanel, 
  ScheduleEditorDialog, 
  getSlotStyling 
} from "../components/ScheduleHelper";

interface ParsedSlot {
  day: string;
  sequence: number;
  className: string;
  classId: string | null;
  subjectName: string;
  subjectId: string | null;
  teacherId: string | null;
  teacherName: string | null;
  status: "valid" | "error" | "empty";
  errors: string[];
}

export const getFixedActivityForPeriod = (period: LessonPeriod) => {
  const dayLower = period.day.toLowerCase();
  
  if (period.type === LessonPeriodType.ROUTINE) {
    const titleUpper = period.title.toUpperCase();
    let colorTheme = {
      bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/50 text-purple-800 dark:text-purple-400",
      badge: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      label: "Agenda"
    };
    if (titleUpper.includes("UPACARA")) {
      colorTheme = {
        bg: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50 text-rose-800 dark:text-rose-400",
        badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
        label: "Upacara"
      };
    } else if (titleUpper.includes("SENAM")) {
      colorTheme = {
        bg: "bg-sky-50 border-sky-200 dark:bg-sky-950/20 dark:border-sky-900/50 text-sky-800 dark:text-sky-400",
        badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
        label: "Senam"
      };
    } else if (titleUpper.includes("APEL")) {
      colorTheme = {
        bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400",
        badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        label: "Apel"
      };
    } else if (titleUpper.includes("SHOLAT") || titleUpper.includes("DHUHA") || titleUpper.includes("KAJIAN")) {
      colorTheme = {
        bg: "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-400",
        badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
        label: "Ibadah"
      };
    }
    return {
      title: titleUpper,
      bgColor: colorTheme.bg,
      badge: colorTheme.label,
      badgeColor: colorTheme.badge
    };
  }
  
  if (period.type === LessonPeriodType.BREAK || period.title.toLowerCase().includes("istirahat")) {
    return {
      title: "ISTIRAHAT",
      bgColor: "bg-slate-50 border-slate-200 dark:bg-zinc-900/50 dark:border-zinc-800 text-slate-600 dark:text-zinc-400",
      badge: "Istirahat",
      badgeColor: "bg-slate-100 text-slate-800 dark:bg-zinc-850 dark:text-zinc-300"
    };
  }
  return null;
};

export default function Schedules() {
  const { toast } = useToast();

  // --- EXCEL IMPORT STATES ---
  const [importedSlots, setImportedSlots] = useState<ParsedSlot[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importOption, setImportOption] = useState<"overwrite" | "merge">("merge");
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    totalSlots: number;
    validSlots: number;
    errorSlots: number;
    emptySlots: number;
    newSchedulesCount: number;
    updatedSchedulesCount: number;
    incompleteSubjectsCount: number;
    teacherConflictsCount: number;
    classConflictsCount: number;
  } | null>(null);

  // --- FILTERS STATE ---
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("ALL");
  const [selectedDay, setSelectedDay] = useState<string>("ALL");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // --- VIEW STATE ---
  // "class" (Jadwal per Kelas), "teacher" (Jadwal per Guru), "weekly" (Jadwal Mingguan / Master Schedule)
  const [activeTab, setActiveTab] = useState<"class" | "teacher" | "weekly">("weekly");

  // Spreadsheet spreadsheet state
  const [selectedCell, setSelectedCell] = useState<{
    classId: string;
    day: string;
    sequence: number;
  } | null>(null);
  const [copiedSlot, setCopiedSlot] = useState<Schedule | null>(null);

  // --- PREVIEW / RUN STATE ---
  const [previewSchedules, setPreviewSchedules] = useState<Schedule[] | null>(null);
  const [previewMetrics, setPreviewMetrics] = useState<any | null>(null);
  const [classToGenerate, setClassToGenerate] = useState<string>("ALL"); // For specific class generate
  const [customRules, setCustomRules] = useState("");

  // --- FETCH MASTER DATA ---
  const { data: academicYears = [] } = useQuery({
    queryKey: ["academicYearsList"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["semestersList"],
    queryFn: () => semesterService.getSemesters()
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classesList"],
    queryFn: () => classService.getClasses()
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachersList"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: lessonPeriods = [] } = useQuery({
    queryKey: ["lessonPeriods"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  const { data: curriculumMatrix = [] } = useQuery({
    queryKey: ["curriculumMatrixList"],
    queryFn: () => curriculumMatrixService.getCurriculumMatrix()
  });

  const { data: settings } = useQuery({
    queryKey: ["schoolSettings"],
    queryFn: () => schoolSettingsService.getSettings()
  });

  const activeDays = settings?.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const instructionalPeriods = lessonPeriods.filter(p => 
    p.type === LessonPeriodType.LESSON && 
    p.instructional &&
    p.sequence !== 1 &&
    activeDays.some(ad => ad.toLowerCase() === p.day.toLowerCase())
  );

  // --- SYNC ACTIVE YEAR / SEMESTER DEFAULT ---
  useEffect(() => {
    if (academicYears.length > 0 && !selectedYearId) {
      const active = academicYears.find(y => y.isActive);
      if (active) setSelectedYearId(active.id);
      else setSelectedYearId(academicYears[0].id);
    }
  }, [academicYears, selectedYearId]);

  useEffect(() => {
    if (semesters.length > 0 && selectedYearId && !selectedSemesterId) {
      const yearSemesters = semesters.filter(s => s.academicYearId === selectedYearId);
      const active = yearSemesters.find(s => s.isActive);
      if (active) setSelectedSemesterId(active.id);
      else if (yearSemesters.length > 0) setSelectedSemesterId(yearSemesters[0].id);
    }
  }, [semesters, selectedYearId, selectedSemesterId]);

  // Adjust semester when academic year changes
  const handleYearChange = (yearId: string) => {
    setSelectedYearId(yearId);
    const yearSemesters = semesters.filter(s => s.academicYearId === yearId);
    const active = yearSemesters.find(s => s.isActive);
    if (active) setSelectedSemesterId(active.id);
    else if (yearSemesters.length > 0) setSelectedSemesterId(yearSemesters[0].id);
    else setSelectedSemesterId("");
    // Clear preview state
    setPreviewSchedules(null);
    setPreviewMetrics(null);
  };

  // --- DB HOOK FOR SCHEDULES ---
  const {
    schedules: dbSchedules,
    isLoading: isLoadingSchedules,
    previewSchedule,
    isTesting,
    saveSchedules,
    isSaving,
    resetSchedules,
    isResetting,
    toggleLock,
    isLocking,
    publishSchedules,
    isPublishing
  } = useSchedules(selectedYearId, selectedSemesterId);

  // Active working set: preview if available, otherwise saved dbSchedules
  const activeSchedules = previewSchedules !== null ? previewSchedules : dbSchedules;

  // Compute unique subjects from curriculum matrix
  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    curriculumMatrix.forEach((m) => {
      if (m.subjectId && m.subjectName) {
        map.set(m.subjectId, m.subjectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [curriculumMatrix]);

  // Active classes filtered by Jenjang and Kelas filters and sorted automatically by Jenjang -> Name
  const activeClasses = useMemo(() => {
    let list = classes.filter((c) => c.status === "Aktif" && !c.isDeleted);
    if (selectedClassId !== "ALL") {
      list = list.filter((c) => c.id === selectedClassId || c.classId === selectedClassId);
    }
    if (selectedGrade !== "ALL") {
      list = list.filter((c) => c.gradeLevel === selectedGrade);
    }
    const gradeOrder: Record<string, number> = { "VII": 7, "VIII": 8, "IX": 9 };
    return [...list].sort((a, b) => {
      const orderA = gradeOrder[a.gradeLevel] || 99;
      const orderB = gradeOrder[b.gradeLevel] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes, selectedClassId, selectedGrade]);

  const classesVII = useMemo(() => activeClasses.filter(c => c.gradeLevel === "VII"), [activeClasses]);
  const classesVIII = useMemo(() => activeClasses.filter(c => c.gradeLevel === "VIII"), [activeClasses]);
  const classesIX = useMemo(() => activeClasses.filter(c => c.gradeLevel === "IX"), [activeClasses]);

  // Active days filtered by Hari filter
  const filteredDays = useMemo(() => {
    const activeDays = settings?.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return activeDays.filter((d) => selectedDay === "ALL" || d.toLowerCase() === selectedDay.toLowerCase());
  }, [settings?.activeDays, selectedDay]);

  // Sorted instructional lesson periods
  const sortedPeriods = useMemo(() => {
    return lessonPeriods.filter((p) => p.type === LessonPeriodType.LESSON && p.instructional);
  }, [lessonPeriods]);

  // Map of periods grouped by day
  const dayPeriodsMap = useMemo(() => {
    const map = new Map<string, LessonPeriod[]>();
    filteredDays.forEach((day) => {
      const periods = sortedPeriods
        .filter((p) => p.day.toLowerCase() === day.toLowerCase())
        .sort((a, b) => a.sequence - b.sequence);
      if (periods.length > 0) {
        map.set(day.toLowerCase(), periods);
      }
    });
    return map;
  }, [filteredDays, sortedPeriods]);

  // Display periods including routine agenda items like apel pagi, senam pagi, upacara bendera
  const displayPeriods = useMemo(() => {
    return lessonPeriods.filter(p => {
      const dayLower = p.day.toLowerCase();
      const isActiveDay = activeDays.some(ad => ad.toLowerCase() === dayLower);
      if (!isActiveDay) return false;

      // Keep if it is ROUTINE
      if (p.type === LessonPeriodType.ROUTINE) return true;
      // Keep if it is BREAK or title contains "istirahat"
      if (p.type === LessonPeriodType.BREAK || p.title.toLowerCase().includes("istirahat")) return true;
      // Keep if it is LESSON
      if (p.type === LessonPeriodType.LESSON && p.instructional) return true;

      return false;
    });
  }, [lessonPeriods, activeDays]);

  // Group display periods by day
  const displayPeriodsMap = useMemo(() => {
    const map = new Map<string, LessonPeriod[]>();
    filteredDays.forEach((day) => {
      const periods = displayPeriods
        .filter((p) => p.day.toLowerCase() === day.toLowerCase())
        .sort((a, b) => a.sequence - b.sequence);
      if (periods.length > 0) {
        map.set(day.toLowerCase(), periods);
      }
    });
    return map;
  }, [filteredDays, displayPeriods]);

  // Check if schedule cell matches active filters (Bagian 7)
  const matchesFilters = (sched: Schedule | undefined, cls: Class, day: string, periodSequence: number) => {
    // Day filter
    if (selectedDay !== "ALL" && day.toLowerCase() !== selectedDay.toLowerCase()) {
      return false;
    }
    // Grade filter
    if (selectedGrade !== "ALL" && cls.gradeLevel !== selectedGrade) {
      return false;
    }
    // Class filter
    if (selectedClassId !== "ALL" && cls.id !== selectedClassId && cls.classId !== selectedClassId) {
      return false;
    }

    // If teacher, subject, or status is set, they require the slot to have a schedule
    if (selectedTeacherId !== "ALL") {
      if (!sched || sched.teacherId !== selectedTeacherId) return false;
    }
    if (selectedSubjectId !== "ALL") {
      if (!sched || sched.subjectId !== selectedSubjectId) return false;
    }
    if (selectedStatus !== "ALL") {
      if (selectedStatus === "KOSONG") {
        if (sched) return false;
      } else if (selectedStatus === "BENTROK") {
        const styling = getSlotStyling(cls.id, day, periodSequence, sched, activeSchedules);
        if (styling.status !== "conflict") return false;
      } else if (selectedStatus === "VALID") {
        if (!sched) return false;
        const styling = getSlotStyling(cls.id, day, periodSequence, sched, activeSchedules);
        if (styling.status === "conflict") return false;
      }
    }

    return true;
  };

  // --- REQUISITE DATA FOR ANALYSIS & MANUAL EDIT ---

  // --- MANUAL EDITING & DIALOG STATES ---
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    classId: string;
    className: string;
    day: string;
    sequence: number;
    jp: string;
    matchedSchedule?: Schedule;
  } | null>(null);

  // Save changes from manual slot editor
  const handleSaveManualSlot = (subjectId: string, teacherId: string) => {
    if (!selectedSlot) return;
    const matrixItem = curriculumMatrix.find(m => m.subjectId === subjectId);
    if (!matrixItem) return;

    let updatedSchedules = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];

    // Remove old matching slot if any
    updatedSchedules = updatedSchedules.filter(s => 
      !(s.classId === selectedSlot.classId && 
        s.day.toLowerCase() === selectedSlot.day.toLowerCase() && 
        s.sequence === selectedSlot.sequence)
    );

    const newSchedule: Schedule = {
      academicYearId: selectedYearId,
      semesterId: selectedSemesterId,
      classId: selectedSlot.classId,
      className: selectedSlot.className,
      day: selectedSlot.day,
      sequence: selectedSlot.sequence,
      jp: selectedSlot.jp,
      subjectId: subjectId,
      subjectName: matrixItem.subjectName,
      teacherId: teacherId,
      teacherName: matrixItem.teacherName || "Guru Pengampu",
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "operator",
      lessonPeriodId: "LPERIOD_MANUAL"
    };

    const matchedPeriod = lessonPeriods.find(p => 
      p.day.toLowerCase() === selectedSlot.day.toLowerCase() && 
      p.sequence === selectedSlot.sequence
    );
    if (matchedPeriod && matchedPeriod.id) {
      newSchedule.lessonPeriodId = matchedPeriod.id;
    }

    updatedSchedules.push(newSchedule);
    setPreviewSchedules(updatedSchedules);
    toast(`Berhasil memasukkan ${matrixItem.subjectName} ke jadwal! Klik 'Simpan Jadwal' untuk menyimpan secara permanen.`, "success");
  };

  // Clear/delete schedule from manual slot editor
  const handleDeleteManualSlot = () => {
    if (!selectedSlot) return;

    let updatedSchedules = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];

    updatedSchedules = updatedSchedules.filter(s => 
      !(s.classId === selectedSlot.classId && 
        s.day.toLowerCase() === selectedSlot.day.toLowerCase() && 
        s.sequence === selectedSlot.sequence)
    );

    setPreviewSchedules(updatedSchedules);
    toast("Slot berhasil dikosongkan! Klik 'Simpan Jadwal' untuk menyimpan secara permanen.", "info");
  };

  // Paste a copied slot to target (Bagian 18)
  const handlePasteSlot = (source: Schedule, targetClass: Class, targetPeriod: LessonPeriod) => {
    const targetDayLower = targetPeriod.day.toLowerCase();
    
    // Check teacher conflict
    const isTeacherOccupied = activeSchedules.some(s => 
      s.teacherId === source.teacherId && 
      s.day.toLowerCase() === targetDayLower && 
      s.sequence === targetPeriod.sequence && 
      !(s.classId === targetClass.id || s.classId === targetClass.classId)
    );

    if (isTeacherOccupied) {
      toast(`Gagal menempel: Guru ${source.teacherName} bentrok pada hari ${targetPeriod.day} JP ${targetPeriod.sequence}!`, "error");
      return;
    }

    let updatedSchedules = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];

    // Remove existing target slot if any
    updatedSchedules = updatedSchedules.filter(s => 
      !(s.classId === (targetClass.id || targetClass.classId) && 
        s.day.toLowerCase() === targetDayLower && 
        s.sequence === targetPeriod.sequence)
    );

    const newSchedule: Schedule = {
      academicYearId: selectedYearId,
      semesterId: selectedSemesterId,
      classId: targetClass.classId || targetClass.id,
      className: targetClass.name,
      day: targetPeriod.day,
      sequence: targetPeriod.sequence,
      jp: targetPeriod.title,
      subjectId: source.subjectId,
      subjectName: source.subjectName,
      teacherId: source.teacherId,
      teacherName: source.teacherName,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: "manual_paste",
      lessonPeriodId: targetPeriod.id || "LPERIOD_MANUAL"
    };

    updatedSchedules.push(newSchedule);
    setPreviewSchedules(updatedSchedules);
    toast(`Berhasil menyalin ${source.subjectName} ke Kelas ${targetClass.name}! Klik 'Simpan Jadwal' untuk menyimpan secara permanen.`, "success");
  };

  // Drag & Drop handlers (Bagian 18)
  const handleDragStart = (e: React.DragEvent, sched: Schedule, sourceClassId: string) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ sched, sourceClassId }));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, targetClass: Class, targetPeriod: LessonPeriod) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { sched, sourceClassId } = JSON.parse(dataStr) as { sched: Schedule; sourceClassId: string };
      
      const targetDayLower = targetPeriod.day.toLowerCase();
      
      // Prevent dropping on itself
      if (sourceClassId === targetClass.id && sched.day.toLowerCase() === targetDayLower && sched.sequence === targetPeriod.sequence) {
        return;
      }

      // Check teacher conflict on target
      const isTeacherOccupied = activeSchedules.some(s => 
        s.teacherId === sched.teacherId && 
        s.day.toLowerCase() === targetDayLower && 
        s.sequence === targetPeriod.sequence && 
        !(s.classId === targetClass.id || s.classId === targetClass.classId)
      );

      if (isTeacherOccupied) {
        toast(`Gagal memindahkan: Guru ${sched.teacherName} bentrok pada hari ${targetPeriod.day} JP ${targetPeriod.sequence}!`, "error");
        return;
      }

      let updatedSchedules = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];

      // Remove source slot
      updatedSchedules = updatedSchedules.filter(s => 
        !(s.classId === sourceClassId && 
          s.day.toLowerCase() === sched.day.toLowerCase() && 
          s.sequence === sched.sequence)
      );

      // Remove target slot if exists
      updatedSchedules = updatedSchedules.filter(s => 
        !(s.classId === (targetClass.id || targetClass.classId) && 
          s.day.toLowerCase() === targetDayLower && 
          s.sequence === targetPeriod.sequence)
      );

      // Add new dropped slot
      const newSchedule: Schedule = {
        academicYearId: selectedYearId,
        semesterId: selectedSemesterId,
        classId: targetClass.classId || targetClass.id,
        className: targetClass.name,
        day: targetPeriod.day,
        sequence: targetPeriod.sequence,
        jp: targetPeriod.title,
        subjectId: sched.subjectId,
        subjectName: sched.subjectName,
        teacherId: sched.teacherId,
        teacherName: sched.teacherName,
        isLocked: sched.isLocked || false,
        createdAt: sched.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "drag_drop",
        lessonPeriodId: targetPeriod.id || "LPERIOD_MANUAL"
      };

      updatedSchedules.push(newSchedule);
      setPreviewSchedules(updatedSchedules);
      toast(`Berhasil memindahkan ${sched.subjectName} ke Kelas ${targetClass.name} pada ${targetPeriod.day} ${targetPeriod.title}!`, "success");
    } catch (err) {
      console.error("Error drop slot:", err);
    }
  };

  // --- EXCEL TEMPLATE & IMPORT LOGIC ---
  const handleDownloadTemplateExcel = () => {
    try {
      const templateData: any[] = [];
      const activeDaysList = settings?.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      
      activeDaysList.forEach((day) => {
        const dayPeriods = lessonPeriods
          .filter((p) => p.type === LessonPeriodType.LESSON && p.instructional && p.day.toLowerCase() === day.toLowerCase())
          .sort((a, b) => a.sequence - b.sequence);
          
        dayPeriods.forEach((period) => {
          const row: any = {
            "Hari": day,
            "Jam": period.sequence,
          };
          
          activeClasses.forEach((c) => {
            const sched = activeSchedules.find((s) => 
              (s.classId === c.id || s.classId === c.classId) && 
              s.day.toLowerCase() === day.toLowerCase() && 
              s.sequence === period.sequence
            );
            row[c.name] = sched ? sched.subjectName : "";
          });
          
          templateData.push(row);
        });
      });
      
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Template_Jadwal");
      XLSX.writeFile(workbook, "Template_Import_Jadwal.xlsx");
      toast("Template Excel berhasil diunduh!", "success");
    } catch (err) {
      console.error("Error downloading template:", err);
      toast("Gagal mengunduh template excel.", "error");
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        processImportData(jsonData);
      } catch (err) {
        console.error("Error reading excel file:", err);
        toast("Gagal membaca file Excel. Pastikan format file sesuai.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const processImportData = (rows: any[]) => {
    const errorsList: string[] = [];
    const parsed: ParsedSlot[] = [];
    
    if (rows.length === 0) {
      toast("File Excel kosong atau tidak valid.", "error");
      return;
    }
    
    const firstRowKeys = Object.keys(rows[0]);
    const classKeys = firstRowKeys.filter(k => k !== "Hari" && k !== "Jam");
    
    if (classKeys.length === 0) {
      toast("Format kolom tidak valid. Harus memiliki kolom Hari, Jam, dan setidaknya satu kolom nama Kelas.", "error");
      return;
    }
    
    // Build mapping for active classes (case-insensitive)
    const classMap = new Map<string, Class>();
    classes.forEach(c => {
      if (c.status === "Aktif" && !c.isDeleted) {
        classMap.set(c.name.toLowerCase().trim(), c);
      }
    });
    
    // Check if any imported class column is not in our active classes list
    classKeys.forEach(key => {
      const normalizedKey = key.toLowerCase().trim();
      if (!classMap.has(normalizedKey)) {
        errorsList.push(`Kelas "${key}" pada kolom Excel tidak ditemukan atau tidak aktif di sistem.`);
      }
    });
    
    // Parse each cell in each row
    rows.forEach((row, rowIdx) => {
      const dayStr = String(row["Hari"] || "").trim();
      const jamVal = row["Jam"];
      
      if (!dayStr || jamVal === undefined) {
        return;
      }
      
      // Parse sequence
      let sequence = parseInt(String(jamVal), 10);
      if (isNaN(sequence)) {
        const match = String(jamVal).match(/\d+/);
        if (match) {
          sequence = parseInt(match[0], 10);
        } else {
          sequence = rowIdx + 1;
        }
      }
      
      // Validate if day matches settings
      const dayNormalized = dayStr.toLowerCase();
      const validDay = (settings?.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"])
        .find(d => d.toLowerCase() === dayNormalized);
        
      if (!validDay) {
        errorsList.push(`Baris ${rowIdx + 1}: Hari "${dayStr}" tidak aktif/tidak valid dalam pengaturan sekolah.`);
      }
      
      // For each class column in this row
      classKeys.forEach(classNameKey => {
        const targetClass = classMap.get(classNameKey.toLowerCase().trim());
        const rawSubjectVal = String(row[classNameKey] || "").trim();
        
        let subjectName = rawSubjectVal;
        let subjectId: string | null = null;
        let teacherId: string | null = null;
        let teacherName: string | null = null;
        let status: "valid" | "error" | "empty" = "valid";
        const slotErrors: string[] = [];
        
        const isEmpty = !subjectName || subjectName === "-" || subjectName.toUpperCase() === "KOSONG" || subjectName.toUpperCase() === "EMPTY";
        
        if (isEmpty) {
          status = "empty";
          subjectName = "";
        } else {
          const matrixItem = curriculumMatrix.find(m => m.subjectName.toLowerCase().trim() === subjectName.toLowerCase());
          
          if (!matrixItem) {
            status = "error";
            slotErrors.push(`Mata Pelajaran "${subjectName}" tidak dikenal.`);
            errorsList.push(`Baris ${rowIdx + 1}, Kelas ${classNameKey}: Mapel "${subjectName}" tidak terdaftar di Struktur Kurikulum.`);
          } else {
            subjectId = matrixItem.subjectId;
            subjectName = matrixItem.subjectName; // normalize casing
            
            const grade = targetClass?.gradeLevel; // "VII" / "VIII" / "IX"
            teacherId = matrixItem.teacherId || null;
            teacherName = matrixItem.teacherName || null;
            
            if (matrixItem.useDifferentTeachers && grade) {
              if (grade === "VII") {
                teacherId = matrixItem.teacherId_vii || matrixItem.teacherId || null;
                teacherName = matrixItem.teacherName_vii || matrixItem.teacherName || null;
              } else if (grade === "VIII") {
                teacherId = matrixItem.teacherId_viii || matrixItem.teacherId || null;
                teacherName = matrixItem.teacherName_viii || matrixItem.teacherName || null;
              } else if (grade === "IX") {
                teacherId = matrixItem.teacherId_ix || matrixItem.teacherId || null;
                teacherName = matrixItem.teacherName_ix || matrixItem.teacherName || null;
              }
            }
            
            if (!teacherId || !teacherName) {
              status = "error";
              slotErrors.push("Guru belum ditentukan.");
              errorsList.push(`Baris ${rowIdx + 1}, Kelas ${classNameKey}: Guru pengampu untuk mapel "${subjectName}" belum ditentukan.`);
            }
          }
        }
        
        parsed.push({
          day: validDay || dayStr,
          sequence,
          className: classNameKey,
          classId: targetClass ? (targetClass.classId || targetClass.id) : null,
          subjectName,
          subjectId,
          teacherId,
          teacherName,
          status,
          errors: slotErrors
        });
      });
    });
    
    // A. Class Conflicts
    const classDaySeqMap = new Map<string, ParsedSlot[]>();
    parsed.forEach(slot => {
      if (slot.status === "valid" && slot.classId) {
        const key = `${slot.classId}_${slot.day.toLowerCase()}_${slot.sequence}`;
        if (!classDaySeqMap.has(key)) classDaySeqMap.set(key, []);
        classDaySeqMap.get(key)!.push(slot);
      }
    });
    
    classDaySeqMap.forEach((slots) => {
      if (slots.length > 1) {
        slots.forEach(slot => {
          slot.status = "error";
          slot.errors.push("Bentrok Kelas (beberapa mapel di jam yang sama).");
        });
        errorsList.push(`Bentrok Kelas: Kelas ${slots[0].className} memiliki ${slots.length} mata pelajaran di hari ${slots[0].day} JP ${slots[0].sequence}.`);
      }
    });
    
    // B. Teacher Conflicts
    const teacherDaySeqMap = new Map<string, ParsedSlot[]>();
    parsed.forEach(slot => {
      if (slot.status === "valid" && slot.teacherId) {
        const key = `${slot.teacherId}_${slot.day.toLowerCase()}_${slot.sequence}`;
        if (!teacherDaySeqMap.has(key)) teacherDaySeqMap.set(key, []);
        teacherDaySeqMap.get(key)!.push(slot);
      }
    });
    
    if (importOption === "merge") {
      activeSchedules.forEach(es => {
        const isOverridden = parsed.some(ps => 
          ps.classId === es.classId && 
          ps.day.toLowerCase() === es.day.toLowerCase() && 
          ps.sequence === es.sequence
        );
        
        if (!isOverridden && es.teacherId) {
          const key = `${es.teacherId}_${es.day.toLowerCase()}_${es.sequence}`;
          if (!teacherDaySeqMap.has(key)) teacherDaySeqMap.set(key, []);
          teacherDaySeqMap.get(key)!.push({
            day: es.day,
            sequence: es.sequence,
            className: es.className,
            classId: es.classId,
            subjectName: es.subjectName,
            subjectId: es.subjectId,
            teacherId: es.teacherId,
            teacherName: es.teacherName,
            status: "valid",
            errors: []
          });
        }
      });
    }
    
    teacherDaySeqMap.forEach((slots) => {
      if (slots.length > 1) {
        const parsedSlotsInConflict = slots.filter(s => parsed.includes(s));
        parsedSlotsInConflict.forEach(slot => {
          slot.status = "error";
          slot.errors.push(`Bentrok Guru ${slot.teacherName} (mengajar di kelas lain).`);
        });
        errorsList.push(`Bentrok Guru: ${slots[0].teacherName} terdeteksi mengajar di beberapa kelas sekaligus (${slots.map(s => s.className).join(", ")}) pada hari ${slots[0].day} JP ${slots[0].sequence}.`);
      }
    });
    
    // C. JP validation
    const classSubjectsJpMap = new Map<string, number>();
    parsed.forEach(slot => {
      if (slot.status === "valid" && slot.classId && slot.subjectId) {
        const key = `${slot.classId}_${slot.subjectId}`;
        classSubjectsJpMap.set(key, (classSubjectsJpMap.get(key) || 0) + 1);
      }
    });
    
    if (importOption === "merge") {
      activeSchedules.forEach(es => {
        const isOverridden = parsed.some(ps => 
          ps.classId === es.classId && 
          ps.day.toLowerCase() === es.day.toLowerCase() && 
          ps.sequence === es.sequence
        );
        if (!isOverridden) {
          const key = `${es.classId}_${es.subjectId}`;
          classSubjectsJpMap.set(key, (classSubjectsJpMap.get(key) || 0) + 1);
        }
      });
    }
    
    activeClasses.forEach(cls => {
      const classId = cls.classId || cls.id;
      const grade = cls.gradeLevel;
      
      curriculumMatrix.forEach(matrix => {
        const requiredJp = grade === "VII" ? matrix.jp_vii : grade === "VIII" ? matrix.jp_viii : matrix.jp_ix;
        if (requiredJp > 0) {
          const allocatedJp = classSubjectsJpMap.get(`${classId}_${matrix.subjectId}`) || 0;
          if (allocatedJp > requiredJp) {
            errorsList.push(`Kelebihan JP: Kelas ${cls.name} mengalokasikan ${allocatedJp} JP untuk mapel ${matrix.subjectName} (Kurikulum hanya butuh ${requiredJp} JP).`);
          }
        }
      });
    });
    
    setImportedSlots(parsed);
    setImportErrors(errorsList);
    setShowImportPreview(true);
    
    const totalSlots = parsed.length;
    const errorSlots = parsed.filter(s => s.status === "error").length;
    const emptySlots = parsed.filter(s => s.status === "empty").length;
    const validSlots = parsed.filter(s => s.status === "valid").length;
    
    let newSchedulesCount = 0;
    let updatedSchedulesCount = 0;
    
    parsed.forEach(slot => {
      if (slot.status === "valid") {
        const existing = dbSchedules.find(s => 
          s.classId === slot.classId && 
          s.day.toLowerCase() === slot.day.toLowerCase() && 
          s.sequence === slot.sequence
        );
        if (existing) {
          if (existing.subjectId !== slot.subjectId) {
            updatedSchedulesCount++;
          }
        } else {
          newSchedulesCount++;
        }
      }
    });
    
    let incompleteSubjectsCount = 0;
    activeClasses.forEach(cls => {
      const classId = cls.classId || cls.id;
      const grade = cls.gradeLevel;
      curriculumMatrix.forEach(matrix => {
        const requiredJp = grade === "VII" ? matrix.jp_vii : grade === "VIII" ? matrix.jp_viii : matrix.jp_ix;
        if (requiredJp > 0) {
          const allocatedJp = classSubjectsJpMap.get(`${classId}_${matrix.subjectId}`) || 0;
          if (allocatedJp < requiredJp) {
            incompleteSubjectsCount++;
          }
        }
      });
    });
    
    setImportSummary({
      totalSlots,
      validSlots,
      errorSlots,
      emptySlots,
      newSchedulesCount,
      updatedSchedulesCount,
      incompleteSubjectsCount,
      teacherConflictsCount: Array.from(teacherDaySeqMap.values()).filter(slots => slots.length > 1).length,
      classConflictsCount: Array.from(classDaySeqMap.values()).filter(slots => slots.length > 1).length
    });
  };

  const handleApplyImport = () => {
    if (importSummary && importSummary.errorSlots > 0) {
      toast("Harap perbaiki kesalahan terlebih dahulu sebelum menerapkan hasil import.", "warning");
      return;
    }
    
    let updatedSchedules: Schedule[] = [];
    
    if (importOption === "overwrite") {
      updatedSchedules = [];
    } else {
      updatedSchedules = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];
    }
    
    importedSlots.forEach((slot) => {
      if (slot.status === "valid" && slot.classId && slot.subjectId && slot.teacherId) {
        updatedSchedules = updatedSchedules.filter(s => 
          !(s.classId === slot.classId && 
            s.day.toLowerCase() === slot.day.toLowerCase() && 
            s.sequence === slot.sequence)
        );
        
        const newSchedule: Schedule = {
          academicYearId: selectedYearId,
          semesterId: selectedSemesterId,
          classId: slot.classId,
          className: slot.className,
          day: slot.day,
          sequence: slot.sequence,
          jp: `JP ${slot.sequence}`,
          subjectId: slot.subjectId,
          subjectName: slot.subjectName,
          teacherId: slot.teacherId,
          teacherName: slot.teacherName || "",
          isLocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "excel_import",
          lessonPeriodId: "LPERIOD_MANUAL"
        };
        updatedSchedules.push(newSchedule);
      } else if (slot.status === "empty" && importOption === "overwrite") {
        updatedSchedules = updatedSchedules.filter(s => 
          !(s.classId === slot.classId && 
            s.day.toLowerCase() === slot.day.toLowerCase() && 
            s.sequence === slot.sequence)
        );
      }
    });
    
    setPreviewSchedules(updatedSchedules);
    setShowImportPreview(false);
    toast("Hasil import berhasil diterapkan ke simulasi! Silakan klik 'Simpan Jadwal' untuk menyimpan secara permanen.", "success");
  };

  // Auto Fill vacant slots with missing curriculum hours (Bagian 7)
  const handleAutoFillEmptySlots = () => {
    let currentScheds = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];
    let filledCount = 0;
    
    const activeClasses = classes.filter(c => c.status === "Aktif" && !c.isDeleted);
    
    const tempTeacherOccupation = new Set<string>();
    currentScheds.forEach(s => {
      tempTeacherOccupation.add(`${s.teacherId}_${s.day.toLowerCase()}_${s.sequence}`);
    });

    const tempClassSubjectCount = new Map<string, number>();
    currentScheds.forEach(s => {
      const k = `${s.classId}_${s.subjectId}`;
      tempClassSubjectCount.set(k, (tempClassSubjectCount.get(k) || 0) + 1);
    });

    const classRequirements: { 
      classId: string; 
      subjectId: string; 
      requiredJp: number; 
      teacherId: string; 
      teacherName: string; 
      subjectName: string;
    }[] = [];
    
    activeClasses.forEach(cls => {
      const grade = cls.gradeLevel;
      curriculumMatrix.forEach(m => {
        const req = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
        if (req > 0) {
          classRequirements.push({
            classId: cls.classId,
            subjectId: m.subjectId,
            requiredJp: req,
            teacherId: m.teacherId || "GURU_ALM_01",
            teacherName: m.teacherName || "Guru Pengampu",
            subjectName: m.subjectName
          });
        }
      });
    });

    activeClasses.forEach(cls => {
      activeDays.forEach(day => {
        const dayLower = day.toLowerCase();
        const dayPeriods = instructionalPeriods.filter(p => p.day.toLowerCase() === dayLower);
        
        dayPeriods.forEach(period => {
          const isOccupied = currentScheds.some(s => 
            s.classId === cls.classId && 
            s.day.toLowerCase() === dayLower && 
            s.sequence === period.sequence
          );
          
          if (!isOccupied) {
            const candidates = classRequirements.filter(req => {
              if (req.classId !== cls.classId) return false;
              
              const currentCount = tempClassSubjectCount.get(`${cls.classId}_${req.subjectId}`) || 0;
              if (currentCount >= req.requiredJp) return false;
              
              const teacherKey = `${req.teacherId}_${dayLower}_${period.sequence}`;
              if (tempTeacherOccupation.has(teacherKey)) return false;
              
              const isSubjectOnDay = currentScheds.some(s => 
                s.classId === cls.classId && 
                s.day.toLowerCase() === dayLower && 
                s.subjectId === req.subjectId
              );

              return !isSubjectOnDay;
            });

            candidates.sort((a, b) => {
              const lackingA = a.requiredJp - (tempClassSubjectCount.get(`${cls.classId}_${a.subjectId}`) || 0);
              const lackingB = b.requiredJp - (tempClassSubjectCount.get(`${cls.classId}_${b.subjectId}`) || 0);
              return lackingB - lackingA;
            });

            if (candidates.length > 0) {
              const chosen = candidates[0];
              
              const newSched: Schedule = {
                academicYearId: selectedYearId,
                semesterId: selectedSemesterId,
                classId: cls.classId,
                className: cls.name,
                day: day,
                lessonPeriodId: period.id || "LPERIOD_FALLBACK",
                sequence: period.sequence,
                jp: period.title,
                subjectId: chosen.subjectId,
                subjectName: chosen.subjectName,
                teacherId: chosen.teacherId,
                teacherName: chosen.teacherName,
                isLocked: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: "system"
              };

              currentScheds.push(newSched);
              tempTeacherOccupation.add(`${chosen.teacherId}_${dayLower}_${period.sequence}`);
              
              const ck = `${cls.classId}_${chosen.subjectId}`;
              tempClassSubjectCount.set(ck, (tempClassSubjectCount.get(ck) || 0) + 1);
              filledCount++;
            }
          }
        });
      });
    });

    if (filledCount > 0) {
      setPreviewSchedules(currentScheds);
      toast(`${filledCount} Slot kosong berhasil diisi secara otomatis! Klik 'Simpan Jadwal' untuk menyimpan secara permanen.`, "success");
    } else {
      toast("Gagal mengisi slot kosong. Pastikan semua JP kurikulum sudah terpenuhi, atau tidak ada guru yang bentrok.", "warning");
    }
  };

  // Warning jump target links (Bagian 9)
  const handleJumpToWarning = (type: "class" | "teacher" | "general", targetId?: string) => {
    if (type === "class" && targetId) {
      const foundClass = classes.find(c => c.classId === targetId || c.id === targetId);
      if (foundClass) {
        setActiveTab("class");
        setSelectedClassId(foundClass.classId);
        toast(`Beralih ke jadwal ${foundClass.name} untuk perbaikan.`, "info");
        setTimeout(() => {
          const element = document.getElementById("schedule-main-hub");
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    } else if (type === "teacher" && targetId) {
      setActiveTab("teacher");
      setSelectedTeacherId(targetId);
      toast("Beralih ke jadwal Guru untuk perbaikan.", "info");
      setTimeout(() => {
        const element = document.getElementById("schedule-main-hub");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  };

  // Sync class selection filter default based on active view
  useEffect(() => {
    if (activeTab === "class" && selectedClassId === "ALL" && classes.length > 0) {
      const activeClasses = classes.filter(c => c.status === "Aktif");
      if (activeClasses.length > 0) setSelectedClassId(activeClasses[0].id);
    } else if (activeTab === "teacher" && selectedTeacherId === "ALL" && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id);
    }
  }, [activeTab, classes, teachers]);

  // --- SCHEDULER ENGINE TRIGGER ACTIONS ---
  
  // 1. Generate Jadwal (Complete)
  const handleGenerateAll = async (isRegenerate: boolean = false) => {
    if (!selectedYearId || !selectedSemesterId) {
      toast("Pilih Tahun Pelajaran dan Semester terlebih dahulu!", "error");
      return;
    }
    try {
      const result = await previewSchedule({ 
        ayId: selectedYearId, 
        semId: selectedSemesterId,
        customRules
      });
      setPreviewSchedules(result.schedules);
      setPreviewMetrics(result.metrics);
      toast(isRegenerate ? "Simulasi penjadwalan ulang berhasil dibentuk!" : "Simulasi jadwal otomatis berhasil dibentuk!", "success");
    } catch (err) {
      console.error(err);
    }
  };

  // 1b. Optimize Jadwal (Bagian 2 & 18)
  const handleOptimizeAll = async () => {
    if (!selectedYearId || !selectedSemesterId) {
      toast("Pilih Tahun Pelajaran dan Semester terlebih dahulu!", "error");
      return;
    }
    try {
      const result = await previewSchedule({ 
        ayId: selectedYearId, 
        semId: selectedSemesterId,
        optimize: true,
        customRules
      });
      setPreviewSchedules(result.schedules);
      setPreviewMetrics(result.metrics);
      toast("Simulasi optimasi jadwal berhasil dibentuk! Sisa slot kosong dan jam pelajaran kurang telah diisi.", "success");
    } catch (err) {
      console.error(err);
    }
  };

  // Spreadsheet Keyboard Navigation Effect (Bagian 18)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCell || isEditorOpen) return;
      const rowCount = sortedPeriods.length;
      const colCount = activeClasses.length;
      if (rowCount === 0 || colCount === 0) return;

      const currentRowIdx = sortedPeriods.findIndex(
        (p) => p.day.toLowerCase() === selectedCell.day.toLowerCase() && p.sequence === selectedCell.sequence
      );
      const currentColIdx = activeClasses.findIndex(
        (c) => c.id === selectedCell.classId || c.classId === selectedCell.classId
      );

      if (currentRowIdx === -1 || currentColIdx === -1) return;

      let nextRowIdx = currentRowIdx;
      let nextColIdx = currentColIdx;

      if (e.key === "ArrowUp") {
        nextRowIdx = Math.max(0, currentRowIdx - 1);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        nextRowIdx = Math.min(rowCount - 1, currentRowIdx + 1);
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        nextColIdx = Math.max(0, currentColIdx - 1);
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        nextColIdx = Math.min(colCount - 1, currentColIdx + 1);
        e.preventDefault();
      } else if (e.key === "Enter") {
        const targetPeriod = sortedPeriods[currentRowIdx];
        const targetClass = activeClasses[currentColIdx];
        const matched = activeSchedules.find(
          (s) =>
            (s.classId === targetClass.id || s.classId === targetClass.classId) &&
            s.day.toLowerCase() === targetPeriod.day.toLowerCase() &&
            s.sequence === targetPeriod.sequence
        );
        setSelectedSlot({
          classId: targetClass.classId || targetClass.id,
          className: targetClass.name,
          day: targetPeriod.day,
          sequence: targetPeriod.sequence,
          jp: targetPeriod.title,
          matchedSchedule: matched
        });
        setIsEditorOpen(true);
        e.preventDefault();
      } else if (e.key === "Escape") {
        setSelectedCell(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        // Copy shortcut
        const targetClass = activeClasses[currentColIdx];
        const targetPeriod = sortedPeriods[currentRowIdx];
        const matched = activeSchedules.find(
          (s) =>
            (s.classId === targetClass.id || s.classId === targetClass.classId) &&
            s.day.toLowerCase() === targetPeriod.day.toLowerCase() &&
            s.sequence === targetPeriod.sequence
        );
        if (matched) {
          setCopiedSlot(matched);
          toast(`Disalin: ${matched.subjectName} (${matched.teacherName})`, "info");
        } else {
          toast("Tidak ada jadwal di sel ini untuk disalin.", "warning");
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        // Paste shortcut
        if (copiedSlot) {
          const targetClass = activeClasses[currentColIdx];
          const targetPeriod = sortedPeriods[currentRowIdx];
          handlePasteSlot(copiedSlot, targetClass, targetPeriod);
        } else {
          toast("Belum ada jadwal yang disalin! Gunakan Ctrl+C terlebih dahulu.", "warning");
        }
        e.preventDefault();
      }

      if (nextRowIdx !== currentRowIdx || nextColIdx !== currentColIdx) {
        const nextPeriod = sortedPeriods[nextRowIdx];
        const nextClass = activeClasses[nextColIdx];
        setSelectedCell({
          classId: nextClass.classId || nextClass.id,
          day: nextPeriod.day,
          sequence: nextPeriod.sequence
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCell, sortedPeriods, activeClasses, isEditorOpen, activeSchedules, copiedSlot]);

  // 2. Generate Kelas Tertentu
  const handleGenerateClassSpecific = async () => {
    if (!selectedYearId || !selectedSemesterId) {
      toast("Pilih Tahun Pelajaran dan Semester terlebih dahulu!", "error");
      return;
    }
    if (classToGenerate === "ALL") {
      toast("Pilih kelas spesifik yang ingin dijadwalkan!", "error");
      return;
    }
    try {
      const result = await previewSchedule({
        ayId: selectedYearId,
        semId: selectedSemesterId,
        targetClassId: classToGenerate
      });
      setPreviewSchedules(result.schedules);
      setPreviewMetrics(result.metrics);
      toast(`Simulasi jadwal khusus Kelas ${classes.find(c => c.id === classToGenerate)?.name || classToGenerate} berhasil dibentuk!`, "success");
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Save Previewed Schedules
  const handleSavePreview = async () => {
    if (!previewSchedules) return;
    try {
      await saveSchedules({
        scheds: previewSchedules,
        ayId: selectedYearId,
        semId: selectedSemesterId,
        classIdToOverwrite: classToGenerate !== "ALL" ? classToGenerate : undefined
      });
      // Clear preview state upon successful database save
      setPreviewSchedules(null);
      setPreviewMetrics(null);
      setClassToGenerate("ALL");
    } catch (err) {
      console.error(err);
    }
  };

  // 4. Reset Schedules
  const handleReset = async () => {
    if (!selectedYearId || !selectedSemesterId) return;
    if (confirm("Apakah Anda yakin ingin mereset seluruh jadwal yang belum dikunci untuk semester ini? Tindakan ini tidak dapat dibatalkan.")) {
      try {
        await resetSchedules({
          ayId: selectedYearId,
          semId: selectedSemesterId
        });
        setPreviewSchedules(null);
        setPreviewMetrics(null);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 5. Publish Schedules
  const handlePublish = async () => {
    if (!selectedYearId || !selectedSemesterId) return;
    const yearName = academicYears.find(y => y.id === selectedYearId)?.name || "";
    const semName = semesters.find(s => s.id === selectedSemesterId)?.name || "";
    const desc = `Mempublikasikan jadwal pelajaran resmi untuk Tahun Pelajaran ${yearName} - ${semName}.`;
    
    try {
      await publishSchedules(desc);
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Interactive lock toggle click handler
  const handleToggleLockClick = async (sched: Schedule) => {
    if (!sched.id) {
      toast("Simpan jadwal terlebih dahulu ke database untuk dapat mengunci slot pelajaran!", "info");
      return;
    }
    try {
      await toggleLock({
        id: sched.id,
        isLocked: !sched.isLocked
      });
    } catch (err) {
      console.error(err);
    }
  };

  // --- FILTERED SCHEDULES RENDER COMPOSITION ---
  const getFilteredSchedules = () => {
    return activeSchedules.filter((s) => {
      const matchesClass = selectedClassId === "ALL" || s.classId === selectedClassId;
      const matchesTeacher = selectedTeacherId === "ALL" || s.teacherId === selectedTeacherId;
      const matchesDay = selectedDay === "ALL" || s.day.toLowerCase() === selectedDay.toLowerCase();
      return matchesClass && matchesTeacher && matchesDay;
    });
  };

  const filteredItems = getFilteredSchedules();

  // --- COMPUTE LIVE STATS (from filtered view or database) ---
  const getLiveMetrics = () => {
    if (previewMetrics) return previewMetrics;
    
    // Live compute database stats if not in preview mode
    const uniqueTeachers = new Set(dbSchedules.map(s => s.teacherId)).size;
    const uniqueClasses = new Set(dbSchedules.map(s => s.classId)).size;
    const uniqueSubjects = new Set(dbSchedules.map(s => s.subjectId)).size;
    const totalJp = dbSchedules.length;
    
    // Calculate total slots
    const totalSlots = classes.filter(c => c.status === "Aktif").length * instructionalPeriods.length;
    const emptySlots = Math.max(0, totalSlots - totalJp);
    
    return {
      totalTeachers: uniqueTeachers || teachers.length,
      totalClasses: uniqueClasses || classes.filter(c => c.status === "Aktif").length,
      totalSubjects: uniqueSubjects,
      totalJpScheduled: totalJp,
      totalSlots,
      emptySlots,
      teacherConflicts: 0,
      classConflicts: 0,
      schedulePercentage: totalSlots > 0 ? Math.round((totalJp / totalSlots) * 100) : 0,
      qualityScore: totalJp > 0 ? 100 : 0
    };
  };

  const liveMetrics = getLiveMetrics();

  // --- EXPORT CONTROLLERS ---

  // EXCEL EXPORT
  const handleExportExcel = () => {
    const reportData: any[] = [];
    
    if (activeTab === "class") {
      const clsName = classes.find(c => c.id === selectedClassId)?.name || "Semua Kelas";
      reportData.push({ title: `JADWAL PELAJARAN KELAS: ${clsName.toUpperCase()}` });
      reportData.push({});
      
      activeDays.forEach((day) => {
        const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
        dayPeriods.forEach((period) => {
          const fixedActivity = getFixedActivityForPeriod(period);
          const matched = filteredItems.find(s => s.day.toLowerCase() === day.toLowerCase() && s.sequence === period.sequence && s.classId === selectedClassId);
          reportData.push({
            "Hari": day,
            "JP": period.title,
            "Waktu": `${period.startTime} - ${period.endTime}`,
            "Mata Pelajaran": fixedActivity ? fixedActivity.title : (matched ? matched.subjectName : "-"),
            "Guru Pengampu": fixedActivity ? "" : (matched ? matched.teacherName : "-")
          });
        });
        reportData.push({});
      });
    } else if (activeTab === "teacher") {
      const teachName = teachers.find(t => t.id === selectedTeacherId)?.name || "Semua Guru";
      reportData.push({ title: `JADWAL MENGAJAR GURU: ${teachName.toUpperCase()}` });
      reportData.push({});

      activeDays.forEach((day) => {
        const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
        dayPeriods.forEach((period) => {
          const fixedActivity = getFixedActivityForPeriod(period);
          const matched = filteredItems.find(s => s.day.toLowerCase() === day.toLowerCase() && s.sequence === period.sequence && s.teacherId === selectedTeacherId);
          reportData.push({
            "Hari": day,
            "JP": period.title,
            "Waktu": `${period.startTime} - ${period.endTime}`,
            "Kelas": fixedActivity ? "" : (matched ? matched.className : "-"),
            "Mata Pelajaran": fixedActivity ? fixedActivity.title : (matched ? matched.subjectName : "-")
          });
        });
        reportData.push({});
      });
    } else {
      // Weekly Master View
      reportData.push({ title: "JADWAL PELAJARAN MINGGUAN (MASTER SCHEDULE)" });
      reportData.push({});
      
      classes.filter(c => c.status === "Aktif").forEach((cls) => {
        reportData.push({ "Kelas": cls.name.toUpperCase() });
        activeDays.forEach((day) => {
          const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
          dayPeriods.forEach((period) => {
            const fixedActivity = getFixedActivityForPeriod(period);
            const matched = activeSchedules.find(s => s.classId === cls.id && s.day.toLowerCase() === day.toLowerCase() && s.sequence === period.sequence);
            reportData.push({
              "Hari": day,
              "JP": period.title,
              "Waktu": `${period.startTime} - ${period.endTime}`,
              "Mata Pelajaran": fixedActivity ? fixedActivity.title : (matched ? matched.subjectName : "-"),
              "Guru": fixedActivity ? "" : (matched ? matched.teacherName : "-")
            });
          });
        });
        reportData.push({});
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(reportData, { skipHeader: false });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Jadwal_Pelajaran");
    XLSX.writeFile(workbook, `Jadwal_Pelajaran_${activeTab}.xlsx`);
    toast("Ekspor data Excel berhasil diunduh!", "success");
  };

  // PDF EXPORT
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(16);
    
    let titleStr = "JADWAL PELAJARAN SEKOLAH";
    if (activeTab === "class") {
      const clsName = classes.find(c => c.id === selectedClassId)?.name || "";
      titleStr = `JADWAL PELAJARAN - KELAS ${clsName.toUpperCase()}`;
    } else if (activeTab === "teacher") {
      const teachName = teachers.find(t => t.id === selectedTeacherId)?.name || "";
      titleStr = `JADWAL MENGAJAR - GURU: ${teachName.toUpperCase()}`;
    } else {
      titleStr = "JADWAL PELAJARAN MINGGUAN (MASTER)";
    }

    doc.text(titleStr, 14, 20);
    
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Tahun Pelajaran: ${academicYears.find(y => y.id === selectedYearId)?.name || "-"} | Semester: ${semesters.find(s => s.id === selectedSemesterId)?.name || "-"}`, 14, 27);
    doc.line(14, 32, 196, 32);

    let yOffset = 40;

    if (activeTab === "class") {
      activeDays.forEach((day) => {
        if (yOffset > 250) {
          doc.addPage();
          yOffset = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text(day, 14, yOffset);
        yOffset += 6;

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.text("JP", 14, yOffset);
        doc.text("Waktu", 30, yOffset);
        doc.text("Mata Pelajaran", 65, yOffset);
        doc.text("Guru Pengampu", 125, yOffset);
        doc.line(14, yOffset + 2, 196, yOffset + 2);
        yOffset += 8;

        doc.setFont("Helvetica", "normal");
        const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
        dayPeriods.forEach((period) => {
          const fixedActivity = getFixedActivityForPeriod(period);
          const matched = filteredItems.find(s => s.day.toLowerCase() === day.toLowerCase() && s.sequence === period.sequence && s.classId === selectedClassId);
          doc.text(period.title, 14, yOffset);
          doc.text(`${period.startTime} - ${period.endTime}`, 30, yOffset);
          doc.text(fixedActivity ? fixedActivity.title : (matched ? matched.subjectName : "-"), 65, yOffset);
          doc.text(fixedActivity ? "" : (matched ? matched.teacherName : "-"), 125, yOffset);
          yOffset += 7;
        });
        yOffset += 5;
      });
    } else if (activeTab === "teacher") {
      activeDays.forEach((day) => {
        if (yOffset > 250) {
          doc.addPage();
          yOffset = 20;
        }
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.text(day, 14, yOffset);
        yOffset += 6;

        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.text("JP", 14, yOffset);
        doc.text("Waktu", 30, yOffset);
        doc.text("Kelas Target", 65, yOffset);
        doc.text("Mata Pelajaran", 115, yOffset);
        doc.line(14, yOffset + 2, 196, yOffset + 2);
        yOffset += 8;

        doc.setFont("Helvetica", "normal");
        const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
        dayPeriods.forEach((period) => {
          const fixedActivity = getFixedActivityForPeriod(period);
          const matched = filteredItems.find(s => s.day.toLowerCase() === day.toLowerCase() && s.sequence === period.sequence && s.teacherId === selectedTeacherId);
          doc.text(period.title, 14, yOffset);
          doc.text(`${period.startTime} - ${period.endTime}`, 30, yOffset);
          doc.text(fixedActivity ? "" : (matched ? matched.className : "-"), 65, yOffset);
          doc.text(fixedActivity ? fixedActivity.title : (matched ? matched.subjectName : "-"), 115, yOffset);
          yOffset += 7;
        });
        yOffset += 5;
      });
    } else {
      // General master text dump
      doc.setFontSize(9);
      doc.text("Silakan gunakan ekspor spreadsheet Excel untuk hasil tabel mingguan lengkap.", 14, yOffset);
    }

    doc.save(`Jadwal_Pelajaran_${activeTab}.pdf`);
    toast("Dokumen cetak PDF berhasil diunduh!", "success");
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-zinc-800/80 pb-5">
        <div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">Jadwal Pelajaran</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 mt-1">Auto Scheduler Engine</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Membentuk jadwal pelajaran sekolah otomatis bebas bentrok dengan metode Constraint Satisfaction.</p>
        </div>

        {/* YEAR & SEMESTER GLOBAL DROPDOWN FILTERS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Tahun:</span>
            <select
              value={selectedYearId}
              onChange={(e) => handleYearChange(e.target.value)}
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="" disabled>Pilih...</option>
              {academicYears.map((ay) => (
                <option key={ay.id} value={ay.id}>{ay.name} {ay.isActive ? "(Aktif)" : ""}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 shadow-xs">
            <span className="text-[10px] font-semibold text-slate-400 uppercase">Semester:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => {
                setSelectedSemesterId(e.target.value);
                setPreviewSchedules(null);
                setPreviewMetrics(null);
              }}
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
              disabled={!selectedYearId}
            >
              <option value="" disabled>Pilih...</option>
              {semesters.filter(s => s.academicYearId === selectedYearId).map((s) => (
                <option key={s.id} value={s.id}>{s.name} {s.isActive ? "(Aktif)" : ""}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* WARNING / PREVIEW MODE HERO STATUS */}
      <AnimatePresence>
        {previewSchedules !== null && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl animate-pulse">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-blue-900 dark:text-blue-300">Simulasi Jadwal Siap Ditinjau</h3>
                <p className="text-xs text-blue-700 dark:text-blue-400/80 mt-0.5">Sistem telah menyimulasikan susunan jadwal. Harap klik "Simpan Jadwal" untuk menulis ke database, atau "Batal" untuk membuang.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <button
                onClick={() => {
                  setPreviewSchedules(null);
                  setPreviewMetrics(null);
                  setClassToGenerate("ALL");
                  toast("Simulasi jadwal dibatalkan.", "info");
                }}
                className="px-3.5 py-2 border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Batal
              </button>
              <button
                onClick={handleSavePreview}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-xl transition-all shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan Jadwal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* METRICS & STATS PANEL (PREVIEW CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* QUALITY SCORE BENTO CARD */}
        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Quality Score</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              liveMetrics.qualityScore >= 95 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" :
              liveMetrics.qualityScore >= 80 ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600"
            }`}>
              {liveMetrics.qualityScore >= 95 ? "Sempurna" : "Bagus"}
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-zinc-100">{liveMetrics.qualityScore}</span>
            <span className="text-xs text-slate-400">/100</span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-3">Skor dihitung berdasarkan kepatuhan seluruh aturan dan distribusi beban mengajar guru.</p>
        </div>

        {/* PLACEMENT PERCENTAGE */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Persentase Jadwal</span>
          <div className="mt-4">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100">{liveMetrics.schedulePercentage}%</span>
            <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${liveMetrics.schedulePercentage}%` }}
              />
            </div>
          </div>
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-2">
            Terisi {liveMetrics.totalJpScheduled} dari {liveMetrics.totalSlots} slot.
          </span>
        </div>

        {/* BENTROK INDICATOR */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Indikator Bentrok</span>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Bentrok Guru:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded ${liveMetrics.teacherConflicts > 0 ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600" : "text-emerald-600"}`}>
                {liveMetrics.teacherConflicts}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Bentrok Kelas:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded ${liveMetrics.classConflicts > 0 ? "bg-rose-50 dark:bg-rose-950/20 text-rose-600" : "text-emerald-600"}`}>
                {liveMetrics.classConflicts}
              </span>
            </div>
          </div>
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-2">
            Wajib bernilai 0 untuk rilis resmi.
          </span>
        </div>

        {/* TEACHERS & CLASSES COUNT */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Kapasitas Master</span>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Jumlah Guru:</span>
              <span className="font-bold text-slate-800 dark:text-zinc-300">{liveMetrics.totalTeachers}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Jumlah Kelas:</span>
              <span className="font-bold text-slate-800 dark:text-zinc-300">{liveMetrics.totalClasses}</span>
            </div>
          </div>
          <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-2">
            Terintegrasi struktur kurikulum.
          </span>
        </div>

        {/* SLOT KOSONG CARD */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Slot Pelajaran Kosong</span>
          <div className="mt-4 flex items-baseline gap-1">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-zinc-100">{liveMetrics.emptySlots}</span>
            <span className="text-xs text-slate-400">slot</span>
          </div>
          <p className="text-[9px] text-slate-400 dark:text-zinc-500 mt-3">Jumlah sisa slot kosong yang tidak terisi materi kurikulum.</p>
        </div>

      </div>

      {/* UNASSIGNED TASKS CRITICAL DIAGNOSTIC (Rule feedback) */}
      <AnimatePresence>
        {liveMetrics.unassignedTasks && liveMetrics.unassignedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 space-y-2 shadow-xs"
          >
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <h4 className="text-xs font-bold">Diagnostik Aturan: Beberapa JP Pelajaran Tidak Dapat Ditempatkan ({liveMetrics.unassignedTasks.length} JP)</h4>
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-400/80 leading-relaxed">
              Algoritma penjadwalan mendeteksi konflik tingkat tinggi (misal: guru bersangkutan mengajar melebihi kuota 8 JP/hari, bentrok kelas, atau tidak ada hari tersisa). Anda dapat merevisi Struktur Kurikulum atau mengaktifkan "Mereset" untuk menata ulang:
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2 max-h-[120px] overflow-y-auto p-1 bg-white/40 dark:bg-zinc-950/35 border border-amber-100 dark:border-amber-900/35 rounded-xl">
              {liveMetrics.unassignedTasks.map((task, idx) => (
                <div key={idx} className="bg-amber-100/50 dark:bg-amber-950/55 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-medium border border-amber-200/50">
                  {task.className} - {task.subjectName} ({task.teacherName}) : {task.blockSize} JP
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRE-SCHEDULING READINESS ANALYSIS */}
      <PreAnalysisPanel
        curriculumMatrix={curriculumMatrix}
        classes={classes}
        instructionalPeriods={instructionalPeriods}
        selectedYearId={selectedYearId}
        selectedSemesterId={selectedSemesterId}
      />

      {/* POST-SCHEDULING FINAL ANALYSIS & STATUS PENJADWALAN */}
      <PostAnalysisPanel
        activeSchedules={activeSchedules}
        curriculumMatrix={curriculumMatrix}
        classes={classes}
        instructionalPeriods={instructionalPeriods}
        teachers={teachers}
        onJump={handleJumpToWarning}
      />

      {/* CUSTOM SCHEDULING LOGIC INPUT BLOCK */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-sm">
        <div className="flex items-start gap-2.5">
          <Settings className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50">Aturan Logika Penjadwalan Kustom (Opsional)</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Masukkan aturan atau pembatasan khusus untuk mengarahkan penjadwalan otomatis. Kosongkan untuk menggunakan aturan standar sekolah.
            </p>
          </div>
        </div>

        <textarea
          value={customRules}
          onChange={(e) => setCustomRules(e.target.value)}
          placeholder={`Contoh Aturan yang didukung:
• Guru Budi tidak mengajar hari Senin
• Penjas dilarang hari Jumat
• Matematika prioritaskan pagi
• Guru Ani maksimal 4 JP per hari`}
          className="w-full h-28 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-800 dark:text-zinc-100 placeholder-slate-400 transition-all resize-none font-mono"
        />
        <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500">
          <span>Aturan akan dibaca baris per baris secara otomatis oleh mesin penjadwalan.</span>
          {customRules.trim() && (
            <button 
              onClick={() => setCustomRules("")} 
              className="text-rose-500 hover:underline font-bold cursor-pointer"
            >
              Hapus Semua Aturan
            </button>
          )}
        </div>
      </div>

      {/* CORE CONTROLLER CONTROLS ROW */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm">
        
        {/* ENGINE BUTTONS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => handleGenerateAll(false)}
            disabled={isTesting || !selectedSemesterId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 flex items-center gap-1.5 cursor-pointer"
            title="Hapus seluruh jadwal saat ini dan buat ulang jadwal baru dari awal"
          >
            {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generate Jadwal Baru
          </button>

          <button
            onClick={handleOptimizeAll}
            disabled={isTesting || !selectedSemesterId}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-900/10 hover:shadow-indigo-900/20 flex items-center gap-1.5 cursor-pointer"
            title="Pertahankan jadwal yang ada, isi slot kosong, selesaikan JP yang kurang, dan hilangkan bentrok"
          >
            {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-indigo-200" />}
            Optimalkan Jadwal
          </button>

          <button
            onClick={() => handleGenerateAll(true)}
            disabled={isTesting || !selectedSemesterId}
            className="px-3.5 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            title="Membentuk ulang jadwal, mempertahankan slot yang terkunci"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Generate Ulang
          </button>

          <button
            onClick={handleAutoFillEmptySlots}
            disabled={activeSchedules.length === 0}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-900/10 hover:shadow-indigo-900/20 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            title="Mengisi seluruh sisa slot kosong yang masih tersedia secara otomatis berdasarkan kuota kurikulum"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
            Isi Slot Kosong (Autofill)
          </button>

          <button
            onClick={handleReset}
            disabled={isResetting || !selectedSemesterId}
            className="px-3.5 py-2 border border-rose-200 dark:border-rose-950 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isResetting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Reset Jadwal
          </button>
        </div>

        {/* CLASS-SPECIFIC GENERATION */}
        <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 dark:border-zinc-800/80 pt-4 md:pt-0 md:pl-5">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl px-2.5 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Kelas Target:</span>
            <select
              value={classToGenerate}
              onChange={(e) => setClassToGenerate(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Pilih Kelas...</option>
              {classes.filter(c => c.status === "Aktif").map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerateClassSpecific}
            disabled={isTesting || classToGenerate === "ALL"}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            title="Hanya menjadwalkan ulang kelas terpilih tanpa mengubah kelas lainnya"
          >
            <Layers className="h-3.5 w-3.5" />
            Generate Kelas Terpilih
          </button>
        </div>

      </div>

      {/* FILTER & VIEW COMPOSITION MAIN HUB */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xs">
        
        {/* VIEW NAVIGATION TABS */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
          
          <div className="flex bg-slate-50 dark:bg-zinc-950 p-1 rounded-xl w-fit border border-slate-200/50 dark:border-zinc-800/40">
            <button
              onClick={() => setActiveTab("class")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "class" 
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              Jadwal per Kelas
            </button>
            <button
              onClick={() => setActiveTab("teacher")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "teacher" 
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              Jadwal per Guru
            </button>
            <button
              onClick={() => setActiveTab("weekly")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === "weekly" 
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm" 
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
              }`}
            >
              Jadwal Induk
            </button>
          </div>

          {/* EXPORT, PUBLISH ACTIONS */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={handleDownloadTemplateExcel}
              className="p-2 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              title="Unduh Template Excel untuk Import"
            >
              <FileSpreadsheet className="h-4 w-4 text-blue-500" /> <span className="hidden sm:inline">Template Excel</span>
            </button>
            <button
              onClick={() => {
                const input = document.getElementById("excel-import-file-input");
                if (input) input.click();
              }}
              className="p-2 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              title="Import Jadwal dari Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-indigo-600 font-extrabold" /> <span className="hidden sm:inline">Import Jadwal</span>
            </button>
            <input
              id="excel-import-file-input"
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleImportFileChange}
            />
            <button
              onClick={handleExportExcel}
              className="p-2 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              title="Ekspor Jadwal ke Excel"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> <span className="hidden sm:inline">Export Excel</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="p-2 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
              title="Cetak/Ekspor PDF"
            >
              <FileText className="h-4 w-4 text-rose-500" /> <span className="hidden sm:inline">PDF</span>
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || activeSchedules.length === 0}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/10 hover:shadow-emerald-950/20 flex items-center gap-1.5 cursor-pointer"
            >
              {isPublishing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-4 w-4" />} Publish Jadwal
            </button>
          </div>

        </div>

        {/* DYNAMIC FILTER ROW */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/50 dark:border-zinc-800/40 p-3 rounded-2xl">
          
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500">Filter:</span>
          </div>

          {/* GRADE LEVEL FILTER (Jenjang) */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Jenjang:</span>
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setSelectedClassId("ALL");
              }}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Semua Jenjang</option>
              <option value="VII">Jenjang VII</option>
              <option value="VIII">Jenjang VIII</option>
              <option value="IX">Jenjang IX</option>
            </select>
          </div>

          {/* CLASS SELECTOR */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
            <School className="h-3 w-3 text-slate-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Semua Kelas</option>
              {classes
                .filter(c => c.status === "Aktif" && (selectedGrade === "ALL" || c.gradeLevel === selectedGrade))
                .map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))}
            </select>
          </div>

          {/* TEACHER SELECTOR */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
            <User className="h-3 w-3 text-slate-400" />
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Semua Guru</option>
              {teachers.map((teach) => (
                <option key={teach.id} value={teach.id}>{teach.name}</option>
              ))}
            </select>
          </div>

          {/* SUBJECT SELECTOR */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
            <BookOpen className="h-3 w-3 text-slate-400" />
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Semua Mapel</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* DAY SELECTOR */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
            <Calendar className="h-3 w-3 text-slate-400" />
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Semua Hari</option>
              {activeDays.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* STATUS SELECTOR (VALID, BENTROK, KOSONG) */}
          <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1">
            <AlertCircle className="h-3 w-3 text-slate-400" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs font-bold text-slate-700 dark:text-zinc-300 bg-transparent border-0 p-0 focus:ring-0 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="VALID">Status OK</option>
              <option value="BENTROK">Status Bentrok</option>
              <option value="KOSONG">Status Kosong</option>
            </select>
          </div>

          {/* CLEAR FILTER UTILITY */}
          {(selectedClassId !== "ALL" || selectedTeacherId !== "ALL" || selectedDay !== "ALL" || selectedGrade !== "ALL" || selectedSubjectId !== "ALL" || selectedStatus !== "ALL") && (
            <button
              onClick={() => {
                setSelectedClassId("ALL");
                setSelectedTeacherId("ALL");
                setSelectedDay("ALL");
                setSelectedGrade("ALL");
                setSelectedSubjectId("ALL");
                setSelectedStatus("ALL");
              }}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer ml-auto"
            >
              Reset Filter
            </button>
          )}

        </div>

        {/* --- SCHEDULE DRAWING SECTION --- */}
        <div className="border border-slate-100 dark:border-zinc-800 rounded-2xl overflow-hidden bg-slate-50/20 dark:bg-zinc-950/10">
          
          {isLoadingSchedules ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Memuat data jadwal pelajaran...</p>
            </div>
          ) : activeSchedules.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
              <div className="p-4 bg-slate-100 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 rounded-full">
                <Calendar className="h-10 w-10" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-2">Belum Ada Jadwal Pelajaran</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-400 max-w-sm">Klik tombol "Generate Jadwal" di atas untuk menyusun jadwal pelajaran otomatis secara real-time.</p>
            </div>
          ) : (
            <div>
              {/* VIEW 1: CLASS VIEW GRID */}
              {activeTab === "class" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 w-40">Hari</th>
                        <th className="p-4 w-32">JP</th>
                        <th className="p-4 w-48">Waktu</th>
                        <th className="p-4">Mata Pelajaran / Guru Pengampu</th>
                        <th className="p-4 w-28 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950/20">
                      {activeDays
                        .filter(d => selectedDay === "ALL" || d.toLowerCase() === selectedDay.toLowerCase())
                        .map((day) => {
                          const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
                          return dayPeriods.map((period, pIdx) => {
                            const matched = filteredItems.find(s => 
                              s.day.toLowerCase() === day.toLowerCase() && 
                              s.sequence === period.sequence && 
                              s.classId === selectedClassId
                            );

                            return (
                              <tr key={`${day}_${period.sequence}`} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                                {pIdx === 0 && (
                                  <td className="p-4 font-bold text-sm text-slate-800 dark:text-zinc-200 align-top border-r border-slate-100 dark:border-zinc-800/60" rowSpan={dayPeriods.length}>
                                    {day}
                                  </td>
                                )}
                                <td className="p-4 text-xs font-mono font-bold text-slate-400">{period.title}</td>
                                <td className="p-4 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    {period.startTime} - {period.endTime}
                                  </div>
                                </td>
                                <td className="p-4">
                                  {(() => {
                                    const fixedActivity = getFixedActivityForPeriod(period);
                                    if (fixedActivity) {
                                      return (
                                        <div className={`p-3 rounded-xl border flex items-center justify-between ${fixedActivity.bgColor}`}>
                                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                                            <Calendar className="h-4 w-4 flex-shrink-0" />
                                            {fixedActivity.title}
                                          </div>
                                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${fixedActivity.badgeColor}`}>
                                            {fixedActivity.badge}
                                          </span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div 
                                        onClick={() => {
                                          setSelectedSlot({
                                            classId: selectedClassId,
                                            className: classes.find(c => c.classId === selectedClassId || c.id === selectedClassId)?.name || "",
                                            day,
                                            sequence: period.sequence,
                                            jp: period.title,
                                            matchedSchedule: matched
                                          });
                                          setIsEditorOpen(true);
                                        }}
                                        className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-xs group ${getSlotStyling(selectedClassId, day, period.sequence, matched, activeSchedules).bgColor}`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100">
                                            <BookOpen className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                            {matched ? matched.subjectName : <span className="italic text-slate-400">Isi Slot Kosong...</span>}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className={`h-1.5 w-1.5 rounded-full ${getSlotStyling(selectedClassId, day, period.sequence, matched, activeSchedules).colorTag}`} />
                                            <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                          </div>
                                        </div>
                                        {matched && (
                                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5 pl-5">
                                            <User className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            {matched.teacherName}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-4 text-center">
                                  {!getFixedActivityForPeriod(period) && matched && (
                                    <button
                                      onClick={() => handleToggleLockClick(matched)}
                                      disabled={isLocking}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        matched.isLocked 
                                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-600 hover:bg-amber-100" 
                                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                                      }`}
                                      title={matched.isLocked ? "Slot Terkunci (Pertahankan selama regenerasi)" : "Slot Terbuka"}
                                    >
                                      {matched.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 2: TEACHER VIEW GRID */}
              {activeTab === "teacher" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="p-4 w-40">Hari</th>
                        <th className="p-4 w-32">JP</th>
                        <th className="p-4 w-48">Waktu</th>
                        <th className="p-4">Kelas & Mata Pelajaran Diajar</th>
                        <th className="p-4 w-28 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950/20">
                      {activeDays
                        .filter(d => selectedDay === "ALL" || d.toLowerCase() === selectedDay.toLowerCase())
                        .map((day) => {
                          const dayPeriods = displayPeriods.filter(p => p.day.toLowerCase() === day.toLowerCase());
                          return dayPeriods.map((period, pIdx) => {
                            const matched = filteredItems.find(s => 
                              s.day.toLowerCase() === day.toLowerCase() && 
                              s.sequence === period.sequence && 
                              s.teacherId === selectedTeacherId
                            );

                            return (
                              <tr key={`${day}_${period.sequence}`} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                                {pIdx === 0 && (
                                  <td className="p-4 font-bold text-sm text-slate-800 dark:text-zinc-200 align-top border-r border-slate-100 dark:border-zinc-800/60" rowSpan={dayPeriods.length}>
                                    {day}
                                  </td>
                                )}
                                <td className="p-4 text-xs font-mono font-bold text-slate-400">{period.title}</td>
                                <td className="p-4 text-xs text-slate-500 dark:text-zinc-400 font-medium">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="h-3 w-3 text-slate-400" />
                                    {period.startTime} - {period.endTime}
                                  </div>
                                </td>
                                <td className="p-4">
                                  {(() => {
                                    const fixedActivity = getFixedActivityForPeriod(period);
                                    if (fixedActivity) {
                                      return (
                                        <div className={`p-3 rounded-xl border flex items-center justify-between ${fixedActivity.bgColor}`}>
                                          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                                            <Calendar className="h-4 w-4 flex-shrink-0" />
                                            {fixedActivity.title}
                                          </div>
                                          <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md ${fixedActivity.badgeColor}`}>
                                            {fixedActivity.badge}
                                          </span>
                                        </div>
                                      );
                                    }
                                    if (matched) {
                                      return (
                                        <div 
                                          onClick={() => {
                                            setSelectedSlot({
                                              classId: matched.classId,
                                              className: matched.className,
                                              day,
                                              sequence: period.sequence,
                                              jp: period.title,
                                              matchedSchedule: matched
                                            });
                                            setIsEditorOpen(true);
                                          }}
                                          className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-xs group ${getSlotStyling(matched.classId, day, period.sequence, matched, activeSchedules).bgColor}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100">
                                              <School className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                                              Kelas {matched.className}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className={`h-1.5 w-1.5 rounded-full ${getSlotStyling(matched.classId, day, period.sequence, matched, activeSchedules).colorTag}`} />
                                              <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-zinc-400 mt-1.5 pl-5">
                                            <BookOpen className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            Materi: {matched.subjectName}
                                          </div>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10 text-xs text-slate-400 italic">
                                        Bebas Tugas
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td className="p-4 text-center">
                                  {!getFixedActivityForPeriod(period) && matched && (
                                    <button
                                      onClick={() => handleToggleLockClick(matched)}
                                      disabled={isLocking}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                        matched.isLocked 
                                          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900 text-amber-600 hover:bg-amber-100" 
                                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                                      }`}
                                      title={matched.isLocked ? "Slot Terkunci (Pertahankan selama regenerasi)" : "Slot Terbuka"}
                                    >
                                      {matched.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* VIEW 3: WEEKLY MASTER SCHEDULE (JADWAL INDUK - MATRIX SPREAD) (Bagian 18) */}
              {activeTab === "weekly" && (
                <div className="flex flex-col gap-6">
                  {/* Excel Import Preview Panel */}
                  {showImportPreview && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-slate-50 dark:bg-zinc-900 border border-blue-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
                          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Pratinjau Import Jadwal dari Excel</h3>
                        </div>
                        <button 
                          onClick={() => setShowImportPreview(false)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full cursor-pointer"
                        >
                          <X className="h-4 w-4 text-slate-500" />
                        </button>
                      </div>

                      {/* Summary Metrics */}
                      {importSummary && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                          <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-850">
                            <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Slot Excel</span>
                            <span className="text-lg font-black text-slate-700 dark:text-zinc-200">{importSummary.totalSlots}</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-850">
                            <span className="text-[10px] font-bold text-emerald-500 block uppercase">Slot Valid</span>
                            <span className="text-lg font-black text-emerald-600">{importSummary.validSlots}</span>
                          </div>
                          <div className={`p-3 rounded-xl border ${importSummary.errorSlots > 0 ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900" : "bg-white dark:bg-zinc-950 border-slate-100 dark:border-zinc-850"}`}>
                            <span className={`text-[10px] font-bold block uppercase ${importSummary.errorSlots > 0 ? "text-rose-600" : "text-slate-400"}`}>Slot Salah / Error</span>
                            <span className={`text-lg font-black ${importSummary.errorSlots > 0 ? "text-rose-600" : "text-slate-700 dark:text-zinc-200"}`}>{importSummary.errorSlots}</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-850">
                            <span className="text-[10px] font-bold text-amber-500 block uppercase">Slot Kosong</span>
                            <span className="text-lg font-black text-amber-600">{importSummary.emptySlots}</span>
                          </div>
                          <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-slate-100 dark:border-zinc-850 col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold text-indigo-500 block uppercase">Jadwal Baru / Edit</span>
                            <span className="text-lg font-black text-indigo-600">+{importSummary.newSchedulesCount} / ~{importSummary.updatedSchedulesCount}</span>
                          </div>
                        </div>
                      )}

                      {/* Validation Warnings / Error Log Box */}
                      {importErrors.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-250 dark:border-rose-900/40 rounded-xl p-3.5 space-y-2 max-h-44 overflow-y-auto">
                          <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs">
                            <AlertCircle className="h-4 w-4" />
                            <span>Laporan Validasi & Bentrok ({importErrors.length} Pesan)</span>
                          </div>
                          <ul className="list-disc pl-5 text-[11px] text-rose-600 dark:text-rose-400 space-y-1">
                            {importErrors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {importErrors.length === 0 && (
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-150 dark:border-emerald-900/30 rounded-xl p-3 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                          <CheckCircle className="h-4 w-4" />
                          <span>Seluruh data jadwal dalam excel berhasil divalidasi dengan sukses! Tidak terdeteksi bentrok guru maupun bentrok kelas.</span>
                        </div>
                      )}

                      {/* Import Strategy Options & Submit buttons */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-zinc-800">
                        <div className="flex items-center gap-5">
                          <span className="text-xs font-bold text-slate-500 uppercase">Opsi Import:</span>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            <input 
                              type="radio" 
                              name="importOption" 
                              value="merge" 
                              checked={importOption === "merge"} 
                              onChange={() => {
                                setImportOption("merge");
                              }}
                              className="text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                            />
                            Gabungkan (Isi Slot Kosong / Update yang dipilih)
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            <input 
                              type="radio" 
                              name="importOption" 
                              value="overwrite" 
                              checked={importOption === "overwrite"} 
                              onChange={() => {
                                setImportOption("overwrite");
                              }}
                              className="text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
                            />
                            Timpa Semua (Kosongkan jadwal lama & ganti total)
                          </label>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowImportPreview(false)}
                            className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            onClick={handleApplyImport}
                            disabled={importSummary && importSummary.errorSlots > 0}
                            className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${importSummary && importSummary.errorSlots > 0 ? "bg-slate-300 dark:bg-zinc-800 cursor-not-allowed opacity-50 text-slate-500" : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-md shadow-emerald-900/10"}`}
                          >
                            <CheckCircle className="h-4 w-4" />
                            Terapkan Hasil Import ke Simulasi
                          </button>
                        </div>
                      </div>

                      {/* Inline Cell Preview List (Grid style for micro-inspection) */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Daftar Slot Hasil Parse Excel:</span>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 bg-white dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850">
                          {importedSlots.map((slot, idx) => (
                            <div 
                              key={idx}
                              className={`p-2 rounded-lg border text-left text-[10px] flex flex-col justify-between ${
                                slot.status === "error" 
                                  ? "bg-rose-50/50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/60" 
                                  : slot.status === "empty"
                                  ? "bg-slate-50/50 border-slate-200 border-dashed text-slate-400 dark:bg-zinc-900/30 dark:border-zinc-800"
                                  : "bg-emerald-50/50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/30"
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span>Kelas {slot.className}</span>
                                <span className="font-mono text-[8px] opacity-75">{slot.day}, JP {slot.sequence}</span>
                              </div>
                              <div className="mt-1 font-extrabold truncate">
                                {slot.status === "empty" ? "KOSONG" : slot.subjectName}
                              </div>
                              <div className="text-[8.5px] opacity-80 truncate">
                                {slot.status === "empty" ? "-" : (slot.teacherName || "Tanpa Guru")}
                              </div>
                              {slot.errors.length > 0 && (
                                <div className="mt-1 text-[8px] text-rose-600 dark:text-rose-400 font-semibold leading-tight pt-1 border-t border-rose-100 dark:border-rose-900/30">
                                  {slot.errors.join(", ")}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Floating Action Bar for Selected Cell */}
                  {selectedCell && (
                    <div className="flex items-center justify-between p-3.5 bg-blue-50/90 dark:bg-zinc-950 border border-blue-200/80 dark:border-zinc-800 rounded-xl animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                          Sel Terpilih: 
                        </span>
                        <span className="text-xs bg-blue-100/60 dark:bg-zinc-800 px-2 py-0.5 rounded text-blue-800 dark:text-zinc-200 font-mono">
                          {activeClasses.find(c => c.id === selectedCell.classId || c.classId === selectedCell.classId)?.name || selectedCell.classId} 
                          {" • "} 
                          {selectedCell.day} 
                          {" • JP "} 
                          {selectedCell.sequence}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Copy button */}
                        <button
                          onClick={() => {
                            const matched = activeSchedules.find(s => 
                              (s.classId === selectedCell.classId) && 
                              s.day.toLowerCase() === selectedCell.day.toLowerCase() && 
                              s.sequence === selectedCell.sequence
                            );
                            if (matched) {
                              setCopiedSlot(matched);
                              toast(`Disalin: ${matched.subjectName} (${matched.teacherName})`, "info");
                            } else {
                              toast("Tidak ada jadwal di sel ini untuk disalin.", "warning");
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 text-slate-700 dark:text-zinc-300 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Salin Jadwal dari Sel Ini (Ctrl+C)"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                          Salin
                        </button>

                        {/* Paste button */}
                        <button
                          onClick={() => {
                            if (!copiedSlot) {
                              toast("Belum ada jadwal yang disalin! Salin jadwal terlebih dahulu.", "warning");
                              return;
                            }
                            const targetClass = activeClasses.find(c => c.id === selectedCell.classId || c.classId === selectedCell.classId);
                            const targetPeriod = sortedPeriods.find(p => p.day.toLowerCase() === selectedCell.day.toLowerCase() && p.sequence === selectedCell.sequence);
                            if (targetClass && targetPeriod) {
                              handlePasteSlot(copiedSlot, targetClass, targetPeriod);
                            }
                          }}
                          disabled={!copiedSlot}
                          className="px-2.5 py-1 text-[11px] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 text-slate-700 dark:text-zinc-300 disabled:opacity-50 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Tempel Jadwal yang Disalin (Ctrl+V)"
                        >
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                          Tempel
                        </button>

                        {/* Edit button */}
                        <button
                          onClick={() => {
                            const targetClass = activeClasses.find(c => c.id === selectedCell.classId || c.classId === selectedCell.classId);
                            const targetPeriod = sortedPeriods.find(p => p.day.toLowerCase() === selectedCell.day.toLowerCase() && p.sequence === selectedCell.sequence);
                            if (targetClass && targetPeriod) {
                              const matched = activeSchedules.find(s => 
                                (s.classId === targetClass.id || s.classId === targetClass.classId) && 
                                s.day.toLowerCase() === targetPeriod.day.toLowerCase() && 
                                s.sequence === targetPeriod.sequence
                              );
                              setSelectedSlot({
                                classId: targetClass.classId || targetClass.id,
                                className: targetClass.name,
                                day: targetPeriod.day,
                                sequence: targetPeriod.sequence,
                                jp: targetPeriod.title,
                                matchedSchedule: matched
                              });
                              setIsEditorOpen(true);
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Sparkles className="h-3 w-3" />
                          Ubah Slot
                        </button>

                        {/* Clear button */}
                        <button
                          onClick={() => {
                            const targetClass = activeClasses.find(c => c.id === selectedCell.classId || c.classId === selectedCell.classId);
                            const targetPeriod = sortedPeriods.find(p => p.day.toLowerCase() === selectedCell.day.toLowerCase() && p.sequence === selectedCell.sequence);
                            if (targetClass && targetPeriod) {
                              setSelectedSlot({
                                classId: targetClass.classId || targetClass.id,
                                className: targetClass.name,
                                day: targetPeriod.day,
                                sequence: targetPeriod.sequence,
                                jp: targetPeriod.title,
                                matchedSchedule: activeSchedules.find(s => 
                                  (s.classId === targetClass.id || s.classId === targetClass.classId) && 
                                  s.day.toLowerCase() === targetPeriod.day.toLowerCase() && 
                                  s.sequence === targetPeriod.sequence
                                )
                              });
                              // Clear directly
                              let updated = previewSchedules !== null ? [...previewSchedules] : [...dbSchedules];
                              updated = updated.filter(s => 
                                !((s.classId === targetClass.id || s.classId === targetClass.classId) && 
                                  s.day.toLowerCase() === targetPeriod.day.toLowerCase() && 
                                  s.sequence === targetPeriod.sequence)
                              );
                              setPreviewSchedules(updated);
                              toast("Slot berhasil dikosongkan!", "info");
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                          Kosongkan
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SPREADSHEET TABLE GRID CONTAINER */}
                  <div className="border border-slate-200 dark:border-zinc-850 rounded-2xl overflow-hidden bg-white dark:bg-zinc-950 shadow-sm">
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                      <table className="w-full text-left border-collapse table-fixed min-w-full">
                        <thead>
                          {/* First Header Row: Grouped Grade Levels */}
                          <tr className="bg-slate-100 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-black tracking-wider sticky top-0 z-20 shadow-xs">
                            <th colSpan={2} className="p-2 text-center sticky left-0 bg-slate-100 dark:bg-zinc-900 z-30 border-r border-slate-200 dark:border-zinc-800 text-slate-500 uppercase">
                              IDENTITAS WAKTU
                            </th>
                            {classesVII.length > 0 && (
                              <th colSpan={classesVII.length} className="p-2 text-center border-r border-slate-200 dark:border-zinc-800 bg-blue-50/75 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 uppercase">
                                KELAS VII
                              </th>
                            )}
                            {classesVIII.length > 0 && (
                              <th colSpan={classesVIII.length} className="p-2 text-center border-r border-slate-200 dark:border-zinc-800 bg-emerald-50/75 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 uppercase">
                                KELAS VIII
                              </th>
                            )}
                            {classesIX.length > 0 && (
                              <th colSpan={classesIX.length} className="p-2 text-center border-r border-slate-200 dark:border-zinc-800 bg-amber-50/75 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 uppercase">
                                KELAS IX
                              </th>
                            )}
                          </tr>
                          {/* Second Header Row: Class Columns */}
                          <tr className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-[29px] z-20 shadow-xs">
                            <th className="p-2 w-14 text-center sticky left-0 bg-slate-50 dark:bg-zinc-900 z-30">Hari</th>
                            <th className="p-2 w-20 text-center sticky left-14 bg-slate-50 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 z-30">JP / Waktu</th>
                            {activeClasses.map((cls) => {
                              const isVII = cls.gradeLevel === "VII";
                              const isVIII = cls.gradeLevel === "VIII";
                              const isIX = cls.gradeLevel === "IX";
                              const classHeaderBg = isVII ? "bg-blue-50/40 dark:bg-blue-950/10" : isVIII ? "bg-emerald-50/40 dark:bg-emerald-950/10" : "bg-amber-50/40 dark:bg-amber-950/10";
                              return (
                                <th key={cls.id} className={`p-2 text-center border-r border-slate-200 dark:border-zinc-800 w-22 ${classHeaderBg}`}>
                                  <div className="font-extrabold text-slate-800 dark:text-zinc-100 text-[10px] leading-tight">{cls.name}</div>
                                  <div className="text-[7.5px] text-slate-400 font-semibold uppercase mt-0.5">Jenjang {cls.gradeLevel}</div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-zinc-800 bg-white dark:bg-zinc-950/20">
                          {filteredDays.map((day) => {
                            const periods = displayPeriodsMap.get(day.toLowerCase()) || [];
                            if (periods.length === 0) return null;

                            return periods.map((period, pIdx) => {
                              return (
                                <tr key={`${day}_${period.sequence}`} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/10 transition-colors">
                                  {/* Day Column with rowSpan */}
                                  {pIdx === 0 && (
                                    <td 
                                      className="p-1 font-black text-[10px] text-slate-800 dark:text-zinc-200 text-center bg-slate-100 dark:bg-zinc-900 align-middle border-r border-slate-200 dark:border-zinc-800 sticky left-0 z-10 shadow-2xs w-14"
                                      rowSpan={periods.length}
                                    >
                                      <div className="flex flex-col items-center justify-center gap-0.5">
                                        <Calendar className="h-3 w-3 text-slate-400" />
                                        <span className="uppercase tracking-wider text-[9px]">{day}</span>
                                      </div>
                                    </td>
                                  )}

                                  {/* JP & Time Column */}
                                  <td className="p-2 text-center bg-slate-50 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 sticky left-14 z-10 font-medium shadow-2xs w-20">
                                    <div className="text-[9.5px] font-bold text-slate-700 dark:text-zinc-300">{period.title}</div>
                                    <div className="text-[8px] text-slate-400 font-mono mt-0.5 flex items-center justify-center gap-0.5">
                                      <Clock className="h-2 w-2" />
                                      {period.startTime}-{period.endTime}
                                    </div>
                                  </td>

                                  {/* Class Columns */}
                                  {(() => {
                                    const fixedActivity = getFixedActivityForPeriod(period);
                                    if (fixedActivity) {
                                      return (
                                        <td 
                                          colSpan={activeClasses.length} 
                                          className={`p-3 text-center border-r border-b border-slate-150 dark:border-zinc-850 ${fixedActivity.bgColor}`}
                                        >
                                          <div className="flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-widest">
                                            <Calendar className="h-3.5 w-3.5" />
                                            <span>{fixedActivity.title}</span>
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${fixedActivity.badgeColor}`}>
                                              {fixedActivity.badge}
                                            </span>
                                          </div>
                                        </td>
                                      );
                                    }
                                    return activeClasses.map((cls) => {
                                      const classId = cls.classId || cls.id;
                                      const matched = activeSchedules.find(s => 
                                        (s.classId === cls.id || s.classId === cls.classId) && 
                                        s.day.toLowerCase() === day.toLowerCase() && 
                                        s.sequence === period.sequence
                                      );

                                      // Filter check for dimming
                                      const matchesCellFilter = matchesFilters(matched, cls, day, period.sequence);

                                      // Selection check
                                      const isSelected = selectedCell && 
                                        selectedCell.classId === classId && 
                                        selectedCell.day.toLowerCase() === day.toLowerCase() && 
                                        selectedCell.sequence === period.sequence;

                                      // Styling
                                      const styling = getSlotStyling(classId, day, period.sequence, matched, activeSchedules);

                                      return (
                                        <td 
                                          key={cls.id} 
                                          onClick={() => setSelectedCell({ classId, day, sequence: period.sequence })}
                                          onDoubleClick={() => {
                                            setSelectedSlot({
                                              classId,
                                              className: cls.name,
                                              day,
                                              sequence: period.sequence,
                                              jp: period.title,
                                              matchedSchedule: matched
                                            });
                                            setIsEditorOpen(true);
                                          }}
                                          draggable={!!matched}
                                          onDragStart={(e) => matched && handleDragStart(e, matched, classId)}
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={(e) => handleDrop(e, cls, period)}
                                          className={`p-1 border-r border-slate-150 dark:border-zinc-850 text-center relative transition-all group select-none ${
                                            isSelected 
                                              ? "ring-2 ring-blue-500 ring-inset bg-blue-50/30 dark:bg-blue-950/20 z-10" 
                                              : ""
                                          } ${
                                            !matchesCellFilter ? "opacity-30 scale-[0.98] blur-[0.3px]" : ""
                                          }`}
                                        >
                                          {matched ? (
                                            <div 
                                              className={`rounded-xl p-1.5 border text-left flex flex-col justify-between h-full min-h-[60px] cursor-grab active:cursor-grabbing shadow-2xs hover:shadow-xs transition-all ${
                                                styling.status === "conflict" 
                                                  ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50" 
                                                  : styling.status === "locked"
                                                  ? "bg-amber-50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-900/40"
                                                  : "bg-emerald-50/80 border-emerald-150 dark:bg-emerald-950/10 dark:border-emerald-900/30"
                                              }`}
                                            >
                                              <div className="flex items-start justify-between gap-1">
                                                <span className={`text-[9.5px] font-extrabold tracking-tight uppercase line-clamp-2 leading-tight ${
                                                  styling.status === "conflict" ? "text-rose-700 dark:text-rose-400 font-extrabold" : "text-slate-700 dark:text-zinc-300"
                                                }`}>
                                                  {matched.subjectName}
                                                </span>
                                                {matched.isLocked && (
                                                  <Lock className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                                                )}
                                              </div>

                                              <div className="text-[8px] text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5" title={matched.teacherName}>
                                                {matched.teacherName}
                                              </div>

                                              {/* Status Badge Tag */}
                                              <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 dark:border-zinc-800/40">
                                                <span className={`text-[7.5px] font-black uppercase px-0.5 rounded-sm ${
                                                  styling.status === "conflict" 
                                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400" 
                                                    : matched.isLocked
                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                }`}>
                                                  {styling.status === "conflict" ? "BENTROK" : styling.status === "locked" ? "LOCKED" : "OK"}
                                                </span>
                                                <span className="text-[7.5px] text-slate-400 font-mono">[{matched.jp}]</span>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-1.5 h-full min-h-[60px] flex flex-col items-center justify-center text-slate-300 dark:text-zinc-700 hover:border-slate-400 dark:hover:border-zinc-500 hover:bg-slate-50/50 transition-colors cursor-pointer group-hover:text-blue-500 group-hover:border-blue-300">
                                              <span className="text-[8.5px] font-bold uppercase tracking-wider">KOSONG</span>
                                              <span className="text-[7.5px] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 text-blue-500 font-bold flex items-center gap-0.5">
                                                + Isi Slot
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                      );
                                    });
                                  })()}
                                </tr>
                              );
                            });
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* INTERACTIVE DIAGNOSTIC PANEL (BAGIAN 9, 10, 11) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-3">
                    
                    {/* 1. DETEKSI SLOT KOSONG */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col h-[320px]">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                          <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Deteksi Slot Kosong</h4>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-full">
                          {activeClasses.reduce((sum, cls) => {
                            const filled = activeSchedules.filter(s => (s.classId === cls.id || s.classId === cls.classId)).length;
                            return sum + Math.max(0, sortedPeriods.length - filled);
                          }, 0)} Slot
                        </span>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {activeClasses.map(cls => {
                          const classId = cls.classId || cls.id;
                          const emptySlotsInClass: { day: string; period: LessonPeriod }[] = [];
                          
                          filteredDays.forEach(day => {
                            const pList = dayPeriodsMap.get(day.toLowerCase()) || [];
                            pList.forEach(p => {
                              const hasSched = activeSchedules.some(s => 
                                (s.classId === cls.id || s.classId === cls.classId) && 
                                s.day.toLowerCase() === day.toLowerCase() && 
                                s.sequence === p.sequence
                              );
                              if (!hasSched) {
                                emptySlotsInClass.push({ day, period: p });
                              }
                            });
                          });

                          if (emptySlotsInClass.length === 0) return null;

                          return (
                            <div key={cls.id} className="p-2 border border-slate-100 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-950/20 rounded-xl space-y-1.5">
                              <span className="text-[10px] font-extrabold text-slate-700 dark:text-zinc-300">{cls.name}</span>
                              <div className="grid grid-cols-1 gap-1.5">
                                {emptySlotsInClass.map((item, iIdx) => (
                                  <div 
                                    key={iIdx}
                                    onClick={() => {
                                      setSelectedCell({ classId, day: item.day, sequence: item.period.sequence });
                                      setSelectedSlot({
                                        classId,
                                        className: cls.name,
                                        day: item.day,
                                        sequence: item.period.sequence,
                                        jp: item.period.title,
                                        matchedSchedule: undefined
                                      });
                                      setIsEditorOpen(true);
                                    }}
                                    className="p-1.5 bg-white dark:bg-zinc-900 hover:bg-blue-50/50 dark:hover:bg-blue-950/10 border border-slate-150 dark:border-zinc-800 rounded-lg text-[10px] flex items-center justify-between cursor-pointer transition-colors"
                                  >
                                    <span className="font-medium text-slate-600 dark:text-zinc-400">
                                      {item.day} • {item.period.title}
                                    </span>
                                    <span className="text-[9px] text-blue-600 font-bold hover:underline">+ Isi Slot</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }).filter(Boolean)}

                        {activeClasses.every(cls => {
                          const filled = activeSchedules.filter(s => (s.classId === cls.id || s.classId === cls.classId)).length;
                          return sortedPeriods.length - filled <= 0;
                        }) && (
                          <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                            <p className="text-[10px] text-slate-400 font-bold">Seluruh slot kelas sudah penuh terisi!</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 2. DETEKSI JP BELUM MASUK */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col h-[320px]">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                          <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Mapel Kurang JP</h4>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {activeClasses.map(cls => {
                          const classId = cls.classId || cls.id;
                          const grade = cls.gradeLevel;
                          const classScheds = activeSchedules.filter(s => s.classId === cls.id || s.classId === cls.classId);
                          
                          const incompleteList: { name: string; req: number; sched: number }[] = [];
                          curriculumMatrix.forEach(m => {
                            const req = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
                            if (req > 0) {
                              const sched = classScheds.filter(s => s.subjectId === m.subjectId).length;
                              if (sched < req) {
                                incompleteList.push({ name: m.subjectName, req, sched });
                              }
                            }
                          });

                          if (incompleteList.length === 0) return null;

                          return (
                            <div key={cls.id} className="p-2 border border-slate-100 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-950/20 rounded-xl space-y-1">
                              <span className="text-[10px] font-extrabold text-slate-700 dark:text-zinc-300">{cls.name}</span>
                              <div className="space-y-1">
                                {incompleteList.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-1 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-[9px] rounded px-1.5">
                                    <span className="font-semibold text-slate-600 dark:text-zinc-400">{item.name}</span>
                                    <span className="text-amber-600 font-extrabold bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded">
                                      Kurang {item.req - item.sched} JP ({item.sched}/{item.req} JP)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }).filter(Boolean)}

                        {activeClasses.every(cls => {
                          const classScheds = activeSchedules.filter(s => s.classId === cls.id || s.classId === cls.classId);
                          return curriculumMatrix.every(m => {
                            const req = cls.gradeLevel === "VII" ? m.jp_vii : cls.gradeLevel === "VIII" ? m.jp_viii : m.jp_ix;
                            if (req === 0) return true;
                            const sched = classScheds.filter(s => s.subjectId === m.subjectId).length;
                            return sched >= req;
                          });
                        }) && (
                          <div className="flex flex-col items-center justify-center h-full text-center p-4">
                            <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                            <p className="text-[10px] text-slate-400 font-bold">Semua kebutuhan JP kurikulum telah terpenuhi!</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. PANEL WARNING / BENTROK */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-4 flex flex-col h-[320px]">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3 mb-3">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" />
                          <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Deteksi Bentrok</h4>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                        {/* Calculate Teacher Conflicts */}
                        {(() => {
                          const teacherDaySlotMap = new Map<string, { className: string; subjectName: string; classId: string; seq: number; day: string }[]>();
                          activeSchedules.forEach((s) => {
                            const key = `${s.teacherId}_${s.day.toLowerCase()}_${s.sequence}`;
                            if (!teacherDaySlotMap.has(key)) {
                              teacherDaySlotMap.set(key, []);
                            }
                            teacherDaySlotMap.get(key)!.push({ className: s.className, subjectName: s.subjectName, classId: s.classId, seq: s.sequence, day: s.day });
                          });

                          const conflictsList: React.ReactNode[] = [];
                          teacherDaySlotMap.forEach((slots, key) => {
                            if (slots.length > 1) {
                              const parts = key.split("_");
                              const tId = parts[0];
                              const day = parts[1];
                              const seq = parseInt(parts[2]);
                              const tName = teachers.find(t => t.id === tId)?.name || tId;
                              
                              conflictsList.push(
                                <div 
                                  key={key} 
                                  className="p-2 border border-rose-100 dark:border-rose-950 bg-rose-50/40 dark:bg-rose-950/10 rounded-xl space-y-1.5"
                                >
                                  <div className="flex items-center gap-1 text-[10px] font-extrabold text-rose-700 dark:text-rose-400">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <span>Guru {tName} Bentrok!</span>
                                  </div>
                                  <p className="text-[9.5px] text-slate-600 dark:text-zinc-400 leading-normal">
                                    Mengajar bersamaan pada {day.toUpperCase()} JP {seq} di kelas: {slots.map(s => s.className).join(", ")}.
                                  </p>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {slots.map((s, sIdx) => (
                                      <button
                                        key={sIdx}
                                        onClick={() => {
                                          setSelectedCell({ classId: s.classId, day: s.day, sequence: s.seq });
                                          const matched = activeSchedules.find(as => 
                                            as.classId === s.classId && 
                                            as.day.toLowerCase() === s.day.toLowerCase() && 
                                            as.sequence === s.seq
                                          );
                                          setSelectedSlot({
                                            classId: s.classId,
                                            className: s.className,
                                            day: s.day,
                                            sequence: s.seq,
                                            jp: `JP ${s.seq}`,
                                            matchedSchedule: matched
                                          });
                                          setIsEditorOpen(true);
                                        }}
                                        className="text-[9px] font-bold text-blue-600 hover:underline bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 px-1.5 py-0.5 rounded"
                                      >
                                        Edit {s.className}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                          });

                          return conflictsList.length > 0 ? conflictsList : (
                            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                              <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                              <p className="text-[10px] text-slate-400 font-bold">Tidak terdeteksi bentrok mengajar!</p>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* DETAILED INTERACTIVE EDITING DIALOG (MODAL) */}
      {selectedSlot && (
        <ScheduleEditorDialog
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedSlot(null);
          }}
          slot={selectedSlot}
          curriculumMatrix={curriculumMatrix}
          teachers={teachers}
          activeSchedules={activeSchedules}
          onSave={handleSaveManualSlot}
          onDelete={handleDeleteManualSlot}
        />
      )}

    </div>
  );
}
