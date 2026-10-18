import React, { useState, useMemo } from "react";
import { 
  Calendar, 
  User, 
  School, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Lock, 
  Unlock, 
  Edit3, 
  X, 
  Filter,
  Check,
  AlertCircle,
  Layers,
  Move,
  RefreshCw
} from "lucide-react";

import { 
  ScenarioSchedule, 
  ScenarioCurriculumMatrix, 
  Class, 
  Teacher, 
  LessonPeriod, 
  LessonPeriodType,
  ScenarioConflict 
} from "../types";
import { isClassMatch } from "../utils/gradeLevelHelper";
import { ScenarioTeacherSelect } from "./ScenarioTeacherSelect";
import { getScenarioCurriculumTeacherForClass, toValidGradeLevel } from "../services/scenario.service";
import { useToast } from "../contexts/ToastContext";

interface Props {
  scenarioId: string;
  schedules: ScenarioSchedule[];
  curriculums: ScenarioCurriculumMatrix[];
  classes: Class[];
  teachers: Teacher[];
  isLoadingTeachers?: boolean;
  isErrorTeachers?: boolean;
  onRetryTeachers?: () => void;
  periods: LessonPeriod[];
  conflicts: ScenarioConflict[];
  onSaveSlot: (slot: Partial<ScenarioSchedule> & { scenarioId: string; classId: string; day: string; sequence: number }) => Promise<void>;
  onClearSlot: (slotId: string) => Promise<void>;
  onMoveOrSwapSlot?: (data: {
    sourceSlot: {
      id?: string;
      classId: string;
      className: string;
      gradeLevel?: string;
      day: string;
      sequence: number;
      jp?: string;
      lessonPeriodId?: string;
      schedule: ScenarioSchedule;
    };
    targetSlot: {
      id?: string;
      classId: string;
      className: string;
      gradeLevel?: string;
      day: string;
      sequence: number;
      jp?: string;
      lessonPeriodId?: string;
      existingSchedule?: ScenarioSchedule | null;
    };
  }) => Promise<void>;
  onSyncCurriculumToSchedules?: () => void;
  isReadOnly?: boolean;
}

const DAYS_OF_WEEK = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];

export const ScenarioScheduleEditor: React.FC<Props> = ({
  scenarioId,
  schedules,
  curriculums,
  classes,
  teachers,
  isLoadingTeachers = false,
  isErrorTeachers = false,
  onRetryTeachers,
  periods,
  conflicts,
  onSaveSlot,
  onClearSlot,
  onMoveOrSwapSlot,
  onSyncCurriculumToSchedules,
  isReadOnly = false
}) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<"class" | "general" | "teacher">("class");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || "");

  // Filters for Jadwal Umum VII-IX View
  const [generalFilterGrade, setGeneralFilterGrade] = useState<string>("ALL");
  const [generalFilterDay, setGeneralFilterDay] = useState<string>("ALL");

  // Classes for Jadwal Umum VII-IX View
  const generalClasses = useMemo(() => {
    const valid = classes.filter((c) => {
      const g = toValidGradeLevel(c.gradeLevel || c.name);
      return g === "VII" || g === "VIII" || g === "IX";
    });
    const sorted = [...valid].sort((a, b) => {
      const gOrder: Record<string, number> = { VII: 1, VIII: 2, IX: 3 };
      const gA = gOrder[toValidGradeLevel(a.gradeLevel || a.name)] || 99;
      const gB = gOrder[toValidGradeLevel(b.gradeLevel || b.name)] || 99;
      if (gA !== gB) return gA - gB;
      return (a.name || "").localeCompare(b.name || "", "id");
    });
    if (generalFilterGrade === "ALL") return sorted;
    if (generalFilterGrade === "VII" || generalFilterGrade === "VIII" || generalFilterGrade === "IX") {
      return sorted.filter((c) => toValidGradeLevel(c.gradeLevel || c.name) === generalFilterGrade);
    }
    return sorted.filter((c) => c.id === generalFilterGrade || c.classId === generalFilterGrade);
  }, [classes, generalFilterGrade]);
  
  // Slot Editor Modal
  const [activeSlotData, setActiveSlotData] = useState<{
    slotId?: string;
    classId: string;
    className: string;
    day: string;
    sequence: number;
    jp: string;
    lessonPeriodId: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
    teacherName: string;
    isLocked: boolean;
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Group periods by day
  const periodsByDay = useMemo(() => {
    const map = new Map<string, LessonPeriod[]>();
    DAYS_OF_WEEK.forEach((d) => map.set(d, []));
    periods.forEach((p) => {
      const day = p.day;
      if (map.has(day)) {
        map.get(day)!.push(p);
      }
    });
    // Sort chronologically
    map.forEach((list) => list.sort((a, b) => a.sequence - b.sequence));
    return map;
  }, [periods]);

  // Active subjects in scenario
  const availableSubjects = useMemo(() => {
    return curriculums.filter((c) => c.isActiveInScenario);
  }, [curriculums]);

  // Helper to reliably resolve curriculum matrix record for any slot (by ID or subject name)
  const findCurriculumForSlot = (subId?: string, subName?: string) => {
    if (!subId && !subName) return undefined;
    return curriculums.find((c) => {
      if (subId && (c.id === subId || c.subjectId === subId || c.originalCurriculumId === subId)) return true;
      if (subName && c.subjectName) {
        const sName = subName.trim().toLowerCase();
        const cName = c.subjectName.trim().toLowerCase();
        if (sName === cName) return true;
        if (sName.startsWith(cName) || cName.startsWith(sName)) return true;
      }
      return false;
    });
  };

  // Current class details
  const activeClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId || c.classId === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Current teacher details
  const activeTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId || t.teacherId === selectedTeacherId) || teachers[0];
  }, [teachers, selectedTeacherId]);

  // Open slot editor
  const handleSlotClick = (day: string, period: LessonPeriod, targetClassOverride?: Class) => {
    if (isReadOnly) return;
    const currentClass = targetClassOverride || activeClass;
    if ((viewMode === "class" || viewMode === "general") && !currentClass) return;

    // Find existing schedule for this slot
    const existing = schedules.find((s) => {
      if (viewMode === "teacher") {
        return (
          s.teacherId === selectedTeacherId &&
          s.day.toLowerCase() === day.toLowerCase() &&
          s.sequence === period.sequence
        );
      } else {
        return (
          isClassMatch(s.classId, currentClass.id || currentClass.classId, classes) &&
          s.day.toLowerCase() === day.toLowerCase() &&
          s.sequence === period.sequence
        );
      }
    });

    const targetClass = existing ? classes.find((c) => isClassMatch(c.id, existing.classId, classes)) || currentClass : currentClass;
    const targetGrade = toValidGradeLevel(targetClass?.gradeLevel || targetClass?.name);

    let initialTeacherId = existing?.teacherId || (viewMode === "teacher" ? selectedTeacherId : "");
    let initialTeacherName = existing?.teacherName || (viewMode === "teacher" ? activeTeacher?.name : "");

    // If teacher is missing on existing slot but subject is set, resolve from scenario curriculums for this grade
    if (!initialTeacherId && (existing?.subjectId || existing?.subjectName)) {
      const cur = findCurriculumForSlot(existing?.subjectId, existing?.subjectName);
      if (cur) {
        const resolved = getScenarioCurriculumTeacherForClass(cur, targetGrade);
        if (resolved.teacherId) {
          initialTeacherId = resolved.teacherId;
          initialTeacherName = resolved.teacherName;
        }
      }
    }

    setActiveSlotData({
      slotId: existing?.id,
      classId: targetClass.id || targetClass.classId,
      className: targetClass.name,
      day,
      sequence: period.sequence,
      jp: period.title || `JP ${period.sequence}`,
      lessonPeriodId: period.id || "",
      subjectId: existing?.subjectId || "",
      subjectName: existing?.subjectName || "",
      teacherId: initialTeacherId,
      teacherName: initialTeacherName,
      isLocked: existing?.isLocked || false
    });
  };


  const handleSaveModal = async () => {
    if (!activeSlotData) return;
    try {
      setIsSaving(true);
      const isSlotEmpty = !activeSlotData.subjectId || activeSlotData.subjectName === "Kosong" || activeSlotData.subjectName === "Belum Ditugaskan";
      await onSaveSlot({
        id: activeSlotData.slotId,
        scenarioId,
        classId: activeSlotData.classId,
        className: activeSlotData.className,
        day: activeSlotData.day,
        sequence: activeSlotData.sequence,
        jp: activeSlotData.jp,
        lessonPeriodId: activeSlotData.lessonPeriodId,
        subjectId: isSlotEmpty ? "" : activeSlotData.subjectId,
        subjectName: isSlotEmpty ? "Kosong" : activeSlotData.subjectName,
        teacherId: isSlotEmpty ? "" : activeSlotData.teacherId,
        teacherName: isSlotEmpty ? "Belum Ditugaskan" : activeSlotData.teacherName,
        isLocked: activeSlotData.isLocked
      });
      setActiveSlotData(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearModal = async () => {
    if (!activeSlotData?.slotId) return;
    try {
      setIsSaving(true);
      await onClearSlot(activeSlotData.slotId);
      setActiveSlotData(null);
    } finally {
      setIsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DRAG & DROP HANDLERS (Jadwal Bayangan: Per Kelas & Jadwal Umum VII-IX)
  // ---------------------------------------------------------------------------
  const [draggedSlot, setDraggedSlot] = useState<{
    sched: ScenarioSchedule;
    sourceClassId: string;
    sourceClassName: string;
    sourceDay: string;
    sourceSequence: number;
    sourcePeriodTitle?: string;
    sourcePeriodId?: string;
  } | null>(null);

  const [dragOverTargetKey, setDragOverTargetKey] = useState<string | null>(null);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);

  const handleDragStart = (
    e: React.DragEvent,
    sched: ScenarioSchedule,
    cls: Class,
    day: string,
    period: LessonPeriod
  ) => {
    if (isReadOnly) {
      e.preventDefault();
      return;
    }
    if (sched.isLocked) {
      showToast("Gagal memindahkan: Jadwal yang ditarik dalam keadaan TERKUNCI.", "error");
      e.preventDefault();
      return;
    }

    // Resolve canonical teacher info to ensure teacher information is never lost
    let finalTeacherId = sched.teacherId;
    let finalTeacherName = sched.teacherName;
    if (!finalTeacherId || finalTeacherName === "Belum Ditugaskan") {
      const cur = findCurriculumForSlot(sched.subjectId, sched.subjectName);
      const grade = toValidGradeLevel(cls.gradeLevel || cls.name);
      const res = cur ? getScenarioCurriculumTeacherForClass(cur, grade) : null;
      if (res?.teacherId) {
        finalTeacherId = res.teacherId;
        finalTeacherName = res.teacherName;
      }
    }

    const payloadSchedule: ScenarioSchedule = {
      ...sched,
      teacherId: finalTeacherId || "",
      teacherName: finalTeacherName || "Belum Ditugaskan",
      classId: cls.id || cls.classId,
      className: cls.name,
      gradeLevel: toValidGradeLevel(cls.gradeLevel || cls.name)
    };

    const dragData = {
      sched: payloadSchedule,
      sourceClassId: cls.id || cls.classId,
      sourceClassName: cls.name,
      sourceDay: day,
      sourceSequence: period.sequence,
      sourcePeriodTitle: period.title,
      sourcePeriodId: period.id
    };

    e.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = "move";
    setDraggedSlot(dragData);
  };

  const handleDragEnd = () => {
    setDraggedSlot(null);
    setDragOverTargetKey(null);
  };

  const handleDragOver = (
    e: React.DragEvent,
    cls: Class,
    day: string,
    period: LessonPeriod
  ) => {
    e.preventDefault();
    if (isReadOnly) return;
    const key = `${cls.id || cls.classId}_${day.toLowerCase()}_${period.sequence}`;
    if (dragOverTargetKey !== key) {
      setDragOverTargetKey(key);
    }
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) {
      setDragOverTargetKey(null);
    }
  };

  const handleDrop = async (
    e: React.DragEvent,
    targetClass: Class,
    targetDay: string,
    targetPeriod: LessonPeriod
  ) => {
    e.preventDefault();
    setDragOverTargetKey(null);
    const prevDragged = draggedSlot;
    setDraggedSlot(null);

    if (isReadOnly) {
      showToast("Jadwal bayangan dalam mode hanya baca (read-only).", "error");
      return;
    }

    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      let dragData = prevDragged;
      if (dataStr) {
        try {
          dragData = JSON.parse(dataStr);
        } catch {
          // fallback
        }
      }
      if (!dragData || !dragData.sched) return;

      const { sched, sourceClassId, sourceClassName, sourceDay, sourceSequence } = dragData;

      // 1. Check if source slot is locked
      if (sched.isLocked) {
        showToast("Gagal memindahkan: Jadwal yang ditarik dalam keadaan TERKUNCI.", "error");
        return;
      }

      // 2. Target slot routine or break check
      const isRoutineOrBreak =
        targetPeriod.type === LessonPeriodType.ROUTINE ||
        targetPeriod.type === LessonPeriodType.BREAK ||
        targetPeriod.title.toLowerCase().includes("istirahat") ||
        targetPeriod.title.toLowerCase().includes("upacara");

      if (isRoutineOrBreak) {
        showToast("Gagal memindahkan: Slot tujuan adalah waktu istirahat atau kegiatan rutin.", "error");
        return;
      }

      const targetDayLower = targetDay.toLowerCase();
      const targetClassId = targetClass.id || targetClass.classId;

      // 3. Prevent dropping on itself
      if (
        isClassMatch(sourceClassId, targetClassId, classes) &&
        sourceDay.toLowerCase() === targetDayLower &&
        sourceSequence === targetPeriod.sequence
      ) {
        return;
      }

      // 4. Isolation constraint: Ensure movement remains within the same class
      if (!isClassMatch(sourceClassId, targetClassId, classes)) {
        showToast(
          `Gagal memindahkan: Pemindahan jadwal harus dalam rombel kelas yang sama (${sourceClassName}).`,
          "error"
        );
        return;
      }

      // 5. Find existing schedule in target slot
      const existingTarget = schedules.find(
        (s) =>
          isClassMatch(s.classId, targetClassId, classes) &&
          s.day.toLowerCase() === targetDayLower &&
          s.sequence === targetPeriod.sequence
      );

      // Check if target is locked
      if (existingTarget?.isLocked) {
        showToast("Gagal memindahkan: Slot tujuan dalam keadaan TERKUNCI. Buka kunci terlebih dahulu.", "error");
        return;
      }

      // 6. Check teacher conflict on target slot
      const sourceTeacherId = sched.teacherId;
      const sourceTeacherName = sched.teacherName || "Guru Pengampu";
      if (sourceTeacherId && sourceTeacherName !== "Belum Ditugaskan") {
        const isTeacherOccupied = schedules.some(
          (s) =>
            s.teacherId === sourceTeacherId &&
            s.day.toLowerCase() === targetDayLower &&
            s.sequence === targetPeriod.sequence &&
            !isClassMatch(s.classId, targetClassId, classes)
        );

        if (isTeacherOccupied) {
          showToast(
            `Gagal memindahkan: Guru ${sourceTeacherName} bentrok pada hari ${targetDay} JP ${targetPeriod.sequence} di kelas lain!`,
            "error"
          );
          return;
        }
      }

      // 7. Check target teacher conflict on source slot if swapping
      const hasTargetSubject = Boolean(
        existingTarget &&
          existingTarget.subjectId &&
          existingTarget.subjectName !== "Kosong" &&
          existingTarget.subjectName !== "Belum Ditugaskan"
      );

      if (hasTargetSubject && existingTarget) {
        const targetTeacherId = existingTarget.teacherId;
        const targetTeacherName = existingTarget.teacherName || "Guru Pengampu";

        if (targetTeacherId && targetTeacherName !== "Belum Ditugaskan") {
          const isTargetTeacherOccupied = schedules.some(
            (s) =>
              s.teacherId === targetTeacherId &&
              s.day.toLowerCase() === sourceDay.toLowerCase() &&
              s.sequence === sourceSequence &&
              !isClassMatch(s.classId, sourceClassId, classes)
          );

          if (isTargetTeacherOccupied) {
            showToast(
              `Gagal menukar: Guru ${targetTeacherName} pada slot tujuan bentrok di hari ${sourceDay} JP ${sourceSequence} kelas lain!`,
              "error"
            );
            return;
          }
        }
      }

      // 8. Execute Move or Swap
      if (!onMoveOrSwapSlot) {
        showToast("Fungsi penyimpanan pemindahan jadwal belum terhubung.", "error");
        return;
      }

      setIsProcessingDrop(true);
      await onMoveOrSwapSlot({
        sourceSlot: {
          id: sched.id,
          classId: sourceClassId,
          className: sourceClassName,
          gradeLevel: toValidGradeLevel(sourceClassName),
          day: sourceDay,
          sequence: sourceSequence,
          jp: sched.jp || `JP ${sourceSequence}`,
          lessonPeriodId: sched.lessonPeriodId || "",
          schedule: sched
        },
        targetSlot: {
          id: existingTarget?.id,
          classId: targetClassId,
          className: targetClass.name,
          gradeLevel: toValidGradeLevel(targetClass.gradeLevel || targetClass.name),
          day: targetDay,
          sequence: targetPeriod.sequence,
          jp: targetPeriod.title || `JP ${targetPeriod.sequence}`,
          lessonPeriodId: targetPeriod.id || "",
          existingSchedule: existingTarget || null
        }
      });
    } catch (err: any) {
      console.error("Error during drop in scenario:", err);
    } finally {
      setIsProcessingDrop(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Switch between Class View, General View (VII-IX), & Teacher View */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("class")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "class"
                  ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              <School className="w-4 h-4" />
              Per Kelas
            </button>
            <button
              onClick={() => setViewMode("general")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "general"
                  ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              Jadwal Umum VII–IX
            </button>
            <button
              onClick={() => setViewMode("teacher")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "teacher"
                  ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              <User className="w-4 h-4" />
              Per Guru
            </button>
          </div>

          {/* Selector based on viewMode */}
          {viewMode === "class" && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-sm font-semibold border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.gradeLevel})
                </option>
              ))}
            </select>
          )}

          {viewMode === "general" && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Penyaring Kelas / Tingkat */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Filter Kelas:</span>
                <select
                  value={generalFilterGrade}
                  onChange={(e) => setGeneralFilterGrade(e.target.value)}
                  className="text-xs font-semibold border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
                >
                  <option value="ALL">Semua Kelas (VII, VIII, IX)</option>
                  <option value="VII">Tingkat VII Saja</option>
                  <option value="VIII">Tingkat VIII Saja</option>
                  <option value="IX">Tingkat IX Saja</option>
                  {classes
                    .filter((c) => {
                      const g = toValidGradeLevel(c.gradeLevel || c.name);
                      return g === "VII" || g === "VIII" || g === "IX";
                    })
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.gradeLevel})
                      </option>
                    ))}
                </select>
              </div>

              {/* Penyaring Hari */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-500 font-medium">Hari:</span>
                <select
                  value={generalFilterDay}
                  onChange={(e) => setGeneralFilterDay(e.target.value)}
                  className="text-xs font-semibold border border-slate-300 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
                >
                  <option value="ALL">Semua Hari</option>
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {viewMode === "teacher" && (
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="text-sm font-semibold border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 bg-white dark:bg-zinc-800 dark:text-white"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Actions & Conflict Quick Badge */}
        <div className="flex flex-wrap items-center gap-2">
          {!isReadOnly && onSyncCurriculumToSchedules && (
            <button
              type="button"
              onClick={onSyncCurriculumToSchedules}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition-all shadow-2xs"
              title="Sinkronkan alokasi JP dan penugasan guru dari Struktur Kurikulum Bayangan terbaru (dengan Pratinjau)"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sinkronkan Kurikulum</span>
            </button>
          )}

          {conflicts.length > 0 ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>{conflicts.length} Temuan Konflik Jadwal</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Jadwal Bebas Tabrakan</span>
            </div>
          )}
        </div>
      </div>

      {viewMode === "general" ? (
        /* ========================================================================= */
        /* JADWAL UMUM VII-IX: TAMPILAN GABUNGAN JADWAL BAYANGAN KELAS VII, VIII, IX */
        /* ========================================================================= */
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    Jadwal Umum Bayangan: Tingkat VII – IX
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Menampilkan {generalClasses.length} rombel kelas (VII, VIII, IX) dari skenario bayangan aktif
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Klik slot untuk mengedit • Tarik (drag) & lepaskan (drop) slot untuk memindahkan atau menukar jadwal
              </span>
            </div>

            {/* Matrix per Day */}
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {DAYS_OF_WEEK
                .filter((d) => generalFilterDay === "ALL" || d.toLowerCase() === generalFilterDay.toLowerCase())
                .map((day) => {
                  const dayPeriods = periodsByDay.get(day) || [];

                  return (
                    <div key={day} className="p-4 space-y-3">
                      {/* Day Header Banner */}
                      <div className="flex items-center justify-between bg-slate-100 dark:bg-zinc-800 py-2 px-3.5 rounded-lg">
                        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-zinc-100 text-sm">
                          <Calendar className="w-4 h-4 text-emerald-600" />
                          <span>{day.toUpperCase()}</span>
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                          {dayPeriods.length} Sesi Jam Pelajaran
                        </span>
                      </div>

                      {/* General Schedule Matrix Table */}
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                        <table className="w-full text-left border-collapse min-w-[720px]">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800 text-xs">
                              <th className="p-2.5 w-28 text-center font-bold text-slate-600 dark:text-zinc-300 border-r border-slate-200 dark:border-zinc-800 sticky left-0 z-10 bg-slate-50 dark:bg-zinc-850">
                                Jam / JP
                              </th>
                              {generalClasses.map((cls) => {
                                const g = toValidGradeLevel(cls.gradeLevel || cls.name);
                                const badgeStyle =
                                  g === "VII"
                                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200"
                                    : g === "VIII"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200";

                                return (
                                  <th
                                    key={cls.id}
                                    className="p-2.5 text-center font-bold border-r border-slate-200 dark:border-zinc-800 min-w-[170px]"
                                  >
                                    <div className="flex items-center justify-center gap-1.5">
                                      <span className="text-slate-900 dark:text-zinc-100">{cls.name}</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${badgeStyle}`}
                                      >
                                        Kelas {g}
                                      </span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                            {dayPeriods.map((period) => {
                              const isRoutineOrBreak =
                                period.type === LessonPeriodType.ROUTINE ||
                                period.type === LessonPeriodType.BREAK ||
                                period.title.toLowerCase().includes("istirahat") ||
                                period.title.toLowerCase().includes("upacara");

                              if (isRoutineOrBreak) {
                                return (
                                  <tr
                                    key={period.id || period.sequence}
                                    className="bg-slate-50/70 dark:bg-zinc-900/40"
                                  >
                                    <td className="p-2 text-center border-r border-slate-200 dark:border-zinc-800 sticky left-0 z-10 bg-slate-50 dark:bg-zinc-850">
                                      <span className="font-mono font-bold text-slate-500 block">
                                        {period.title}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block">
                                        {period.startTime} - {period.endTime}
                                      </span>
                                    </td>
                                    <td
                                      colSpan={generalClasses.length}
                                      className="p-2 text-center font-semibold text-slate-500 dark:text-zinc-400 italic text-[11px]"
                                    >
                                      {period.title} ({period.startTime} - {period.endTime})
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr
                                  key={period.id || period.sequence}
                                  className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                                >
                                  {/* Jam / JP column */}
                                  <td className="p-2.5 text-center border-r border-slate-200 dark:border-zinc-800 sticky left-0 z-10 bg-white dark:bg-zinc-900">
                                    <span className="font-mono font-bold text-slate-700 dark:text-zinc-200 block">
                                      {period.title || `JP ${period.sequence}`}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">
                                      {period.startTime} - {period.endTime}
                                    </span>
                                  </td>

                                  {/* Slot per Class */}
                                  {generalClasses.map((cls) => {
                                    const matched = schedules.find(
                                      (s) =>
                                        isClassMatch(s.classId, cls.id || cls.classId, classes) &&
                                        s.day.toLowerCase() === day.toLowerCase() &&
                                        s.sequence === period.sequence
                                    );

                                    const slotConflicts = conflicts.filter(
                                      (cf) =>
                                        (cf.classId === cls.id || isClassMatch(cf.classId, cls.id, classes)) &&
                                        cf.day?.toLowerCase() === day.toLowerCase() &&
                                        cf.sequence === period.sequence
                                    );

                                    const isIntentionalEmpty = Boolean(
                                      matched &&
                                        (!matched.subjectId ||
                                          matched.subjectName === "Kosong" ||
                                          matched.subjectName === "Belum Ditugaskan")
                                    );

                                    const hasValidSubject =
                                      Boolean(matched?.subjectId) && !isIntentionalEmpty;

                                    // Resolve teacher name with canonical fallback to curriculum
                                    const teacherDisplay = (() => {
                                      if (matched?.teacherName && matched.teacherName !== "Belum Ditugaskan") {
                                        return matched.teacherName;
                                      }
                                      if (matched?.subjectId || matched?.subjectName) {
                                        const cur = findCurriculumForSlot(matched?.subjectId, matched?.subjectName);
                                        const g = toValidGradeLevel(cls.gradeLevel || cls.name);
                                        const res = cur ? getScenarioCurriculumTeacherForClass(cur, g) : null;
                                        if (res?.teacherName && res.teacherName !== "Belum Ditugaskan") {
                                          return res.teacherName;
                                        }
                                      }
                                      return "Belum Ditugaskan";
                                    })();

                                    const slotKey = `${cls.id || cls.classId}_${day.toLowerCase()}_${period.sequence}`;
                                    const isDropTarget = dragOverTargetKey === slotKey;
                                    const isSelf = Boolean(
                                      draggedSlot &&
                                        isClassMatch(draggedSlot.sourceClassId, cls.id || cls.classId, classes) &&
                                        draggedSlot.sourceDay.toLowerCase() === day.toLowerCase() &&
                                        draggedSlot.sourceSequence === period.sequence
                                    );
                                    const isMismatchClass = Boolean(
                                      draggedSlot && !isClassMatch(draggedSlot.sourceClassId, cls.id || cls.classId, classes)
                                    );

                                    return (
                                      <td
                                        key={cls.id}
                                        onDragOver={(e) => handleDragOver(e, cls, day, period)}
                                        onDragLeave={handleDragLeave}
                                        onDrop={(e) => handleDrop(e, cls, day, period)}
                                        onClick={() => handleSlotClick(day, period, cls)}
                                        className={`p-1.5 border-r border-slate-200 dark:border-zinc-800 align-middle transition-all select-none ${
                                          isDropTarget
                                            ? isMismatchClass
                                              ? "bg-rose-50/80 dark:bg-rose-950/40 ring-2 ring-rose-400 ring-inset"
                                              : "bg-emerald-100/70 dark:bg-emerald-950/50 ring-2 ring-emerald-500 ring-inset z-10 scale-[1.01]"
                                            : ""
                                        }`}
                                      >
                                        {hasValidSubject && matched ? (
                                          <div
                                            draggable={!isReadOnly && !matched.isLocked}
                                            onDragStart={(e) => handleDragStart(e, matched, cls, day, period)}
                                            onDragEnd={handleDragEnd}
                                            className={`p-2 rounded-lg border text-left transition-all relative ${
                                              !isReadOnly && !matched.isLocked
                                                ? "cursor-grab active:cursor-grabbing hover:scale-[1.01] hover:shadow-xs"
                                                : "cursor-pointer"
                                            } ${
                                              isSelf ? "opacity-40 scale-[0.98] border-dashed" : ""
                                            } ${
                                              isDropTarget && !isMismatchClass && !isSelf
                                                ? "ring-2 ring-emerald-500 border-emerald-400 bg-emerald-100/90 dark:bg-emerald-900/60"
                                                : ""
                                            } ${
                                              slotConflicts.length > 0
                                                ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800"
                                                : "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                                            }`}
                                          >
                                            <div className="flex items-start justify-between gap-1">
                                              <p className="font-bold text-slate-900 dark:text-zinc-100 line-clamp-1 text-[11px]">
                                                {matched.subjectName}
                                              </p>
                                              {!isReadOnly && !matched.isLocked && (
                                                <Move className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100 shrink-0" />
                                              )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5 flex items-center gap-1">
                                              <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                              <span>{teacherDisplay}</span>
                                            </p>
                                            {matched.isLocked && (
                                              <span
                                                className="absolute top-1.5 right-1.5 text-slate-400"
                                                title="Terkunci"
                                              >
                                                <Lock className="w-2.5 h-2.5" />
                                              </span>
                                            )}
                                            {slotConflicts.length > 0 && (
                                              <span
                                                className="absolute bottom-1 right-1 text-amber-600"
                                                title="Ada potensi tabrakan jadwal"
                                              >
                                                <AlertTriangle className="w-3 h-3" />
                                              </span>
                                            )}
                                          </div>
                                        ) : (
                                          <div
                                            className={`p-2 rounded-lg border border-dashed transition-all text-center cursor-pointer text-[10px] flex items-center justify-center gap-1 ${
                                              isDropTarget
                                                ? isMismatchClass
                                                  ? "border-rose-400 bg-rose-50/80 text-rose-600 ring-1 ring-rose-400"
                                                  : "border-emerald-500 bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 font-bold scale-[1.02] ring-2 ring-emerald-500"
                                                : "border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/20 hover:border-emerald-400 hover:bg-emerald-50/30 text-slate-400 dark:text-zinc-600"
                                            }`}
                                          >
                                            <Plus className="w-2.5 h-2.5" />
                                            <span>{isDropTarget && !isMismatchClass ? "Lepaskan ke sini" : "Kosong"}</span>
                                          </div>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* GRID TIMETABLE PER KELAS / PER GURU                                       */
        /* ========================================================================= */
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h4 className="font-bold text-slate-900 dark:text-white">
                {viewMode === "class" ? `Matriks Jadwal: ${activeClass?.name}` : `Matriks Jadwal: ${activeTeacher?.name}`}
              </h4>
            </div>
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              {viewMode === "class"
                ? "Klik slot untuk mengedit • Tarik (drag) & lepaskan (drop) slot untuk memindahkan atau menukar jadwal"
                : "Klik slot kosong atau terisi untuk mengedit slot di jadwal simulasi"}
            </span>
          </div>

          <div className="overflow-x-auto p-4">
            <div className="grid grid-cols-6 gap-3 min-w-[900px]">
              {DAYS_OF_WEEK.map((day) => {
                const dayPeriods = periodsByDay.get(day) || [];

                return (
                  <div key={day} className="space-y-2">
                    {/* Day Header */}
                    <div className="bg-slate-100 dark:bg-zinc-800 py-2 px-3 rounded-lg text-center font-bold text-slate-800 dark:text-zinc-200 text-sm">
                      {day}
                    </div>

                    {/* Day Slots */}
                    <div className="space-y-2">
                      {dayPeriods.map((period) => {
                        // Find matched schedule slot
                        const matched = schedules.find((s) => {
                          if (viewMode === "class") {
                            return (
                              isClassMatch(s.classId, activeClass?.id || activeClass?.classId, classes) &&
                              s.day.toLowerCase() === day.toLowerCase() &&
                              s.sequence === period.sequence
                            );
                          } else {
                            return (
                              s.teacherId === selectedTeacherId &&
                              s.day.toLowerCase() === day.toLowerCase() &&
                              s.sequence === period.sequence
                            );
                          }
                        });

                        // Check for conflicts on this slot
                        const slotConflicts = conflicts.filter(
                          (cf) => cf.day?.toLowerCase() === day.toLowerCase() && cf.sequence === period.sequence
                        );

                        const isRoutineOrBreak =
                          period.type === LessonPeriodType.ROUTINE || period.type === LessonPeriodType.BREAK;

                        if (isRoutineOrBreak) {
                          return (
                            <div
                              key={period.id || period.sequence}
                              className="p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 text-center"
                            >
                              <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 block">
                                {period.title}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-600 block">
                                {period.startTime} - {period.endTime}
                              </span>
                            </div>
                          );
                        }

                        const isIntentionalEmpty = Boolean(
                          matched && (!matched.subjectId || matched.subjectName === "Kosong" || matched.subjectName === "Belum Ditugaskan")
                        );
                        const hasValidSubject = Boolean(matched?.subjectId) && !isIntentionalEmpty;

                        const slotKey = `${activeClass?.id || activeClass?.classId}_${day.toLowerCase()}_${period.sequence}`;
                        const isDropTarget = dragOverTargetKey === slotKey;
                        const isSelf = Boolean(
                          draggedSlot &&
                            isClassMatch(draggedSlot.sourceClassId, activeClass?.id || activeClass?.classId, classes) &&
                            draggedSlot.sourceDay.toLowerCase() === day.toLowerCase() &&
                            draggedSlot.sourceSequence === period.sequence
                        );

                        return (
                          <div
                            key={period.id || period.sequence}
                            onDragOver={(e) => handleDragOver(e, activeClass, day, period)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, activeClass, day, period)}
                            onClick={() => handleSlotClick(day, period)}
                            draggable={!isReadOnly && !matched?.isLocked && hasValidSubject}
                            onDragStart={(e) => matched && handleDragStart(e, matched, activeClass, day, period)}
                            onDragEnd={handleDragEnd}
                            className={`p-2.5 rounded-lg border text-left transition-all shadow-xs relative select-none ${
                              !isReadOnly && matched && !matched.isLocked && hasValidSubject
                                ? "cursor-grab active:cursor-grabbing hover:scale-[1.02]"
                                : "cursor-pointer"
                            } ${
                              isSelf ? "opacity-40 scale-[0.98] border-dashed" : ""
                            } ${
                              isDropTarget && !isSelf
                                ? "ring-2 ring-emerald-500 bg-emerald-100/70 dark:bg-emerald-950/50 border-emerald-400 scale-[1.02] z-10"
                                : ""
                            } ${
                              matched
                                ? isIntentionalEmpty
                                  ? "bg-amber-50/60 border-dashed border-amber-300 dark:bg-amber-950/20 dark:border-amber-800"
                                  : slotConflicts.length > 0
                                  ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800"
                                  : "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900"
                                : "bg-white dark:bg-zinc-850 border-slate-200 dark:border-zinc-700/60 hover:border-emerald-400"
                            }`}
                          >
                            {/* Slot Header */}
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                              <span className="font-bold">{period.title}</span>
                              <span>{period.startTime}</span>
                            </div>

                            {matched ? (
                              isIntentionalEmpty ? (
                                <div>
                                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300 line-clamp-1 flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0"></span>
                                    <span>Kosong (Belum Ditugaskan)</span>
                                  </p>
                                  <p className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                                    Slot sengaja dikosongkan
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <div className="flex items-start justify-between gap-1">
                                    <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                      {matched.subjectName}
                                    </p>
                                    {!isReadOnly && !matched.isLocked && (
                                      <Move className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-1 mt-0.5">
                                    {viewMode === "class" 
                                      ? (matched.teacherName && matched.teacherName !== "Belum Ditugaskan"
                                          ? matched.teacherName
                                          : (() => {
                                              const cur = findCurriculumForSlot(matched.subjectId, matched.subjectName);
                                              const cls = classes.find((c) => isClassMatch(c.id, matched.classId, classes));
                                              const slotGrade = toValidGradeLevel(cls?.gradeLevel || cls?.name || matched.className);
                                              const res = cur ? getScenarioCurriculumTeacherForClass(cur, slotGrade) : null;
                                              return res?.teacherName && res.teacherName !== "Belum Ditugaskan" ? res.teacherName : "-";
                                            })())
                                      : matched.className || "-"}
                                  </p>

                                  {matched.isLocked && (
                                    <span className="absolute top-2 right-2 text-slate-400" title="Terkunci">
                                      <Lock className="w-3 h-3" />
                                    </span>
                                  )}

                                  {slotConflicts.length > 0 && (
                                    <span className="absolute bottom-1.5 right-1.5 text-amber-600" title="Ada potensi tabrakan">
                                      <AlertTriangle className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                              )
                            ) : (
                              <div className={`py-2 text-center text-[11px] font-medium flex items-center justify-center gap-1 transition-all ${
                                isDropTarget && !isSelf
                                  ? "text-emerald-700 dark:text-emerald-300 font-bold"
                                  : "text-slate-400 dark:text-zinc-600"
                              }`}>
                                <Plus className="w-3 h-3" />
                                <span>{isDropTarget && !isSelf ? "Lepaskan ke sini" : "Kosong"}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}


      {/* Edit Slot Modal */}
      {activeSlotData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Edit Slot Jadwal Bayangan
                </h3>
                <span className="text-xs text-slate-500">
                  {activeSlotData.className} • {activeSlotData.day}, {activeSlotData.jp}
                </span>
              </div>
              <button
                onClick={() => setActiveSlotData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Select Subject */}
              <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase">
                      Mata Pelajaran (dari Kurikulum Rancangan)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSlotData({
                          ...activeSlotData,
                          subjectId: "",
                          subjectName: "Kosong",
                          teacherId: "",
                          teacherName: "Belum Ditugaskan"
                        });
                      }}
                      className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                    >
                      Tandai Slot Kosong
                    </button>
                  </div>
                <select
                  value={activeSlotData.subjectId}
                  onChange={(e) => {
                    const subId = e.target.value;
                    if (!subId) {
                      setActiveSlotData({
                        ...activeSlotData,
                        subjectId: "",
                        subjectName: "Kosong",
                        teacherId: "",
                        teacherName: "Belum Ditugaskan"
                      });
                    } else {
                      const sub = availableSubjects.find((s) => s.subjectId === subId || s.id === subId);
                      const cls = classes.find((c) => isClassMatch(c.id, activeSlotData.classId, classes));
                      const slotGrade = toValidGradeLevel(cls?.gradeLevel || cls?.name || activeSlotData.className);
                      const resolved = sub ? getScenarioCurriculumTeacherForClass(sub, slotGrade) : { teacherId: "", teacherName: "" };

                      setActiveSlotData({
                        ...activeSlotData,
                        subjectId: subId,
                        subjectName: sub ? sub.subjectName : "",
                        teacherId: resolved.teacherId || sub?.teacherId || activeSlotData.teacherId,
                        teacherName: resolved.teacherId ? resolved.teacherName : (sub?.teacherName || activeSlotData.teacherName)
                      });
                    }
                  }}
                  className="w-full text-sm font-semibold border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- [Slot Kosong / Belum Ditugaskan] --</option>
                  {availableSubjects.map((sub) => (
                    <option key={sub.id} value={sub.subjectId}>
                      {sub.subjectName} ({sub.isCustomSubject ? "Mapel Baru" : `Kel. ${sub.subjectGroup}`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Teacher */}
              <div>
                <ScenarioTeacherSelect
                  label="Guru Pengampu"
                  currentTeacherId={activeSlotData.teacherId}
                  currentTeacherName={activeSlotData.teacherName}
                  teachers={teachers}
                  isLoading={isLoadingTeachers}
                  isError={isErrorTeachers}
                  onRetry={onRetryTeachers}
                  onSelect={(tchId, tchName) => {
                    setActiveSlotData({
                      ...activeSlotData,
                      teacherId: tchId,
                      teacherName: tchName
                    });
                  }}
                  disabled={isReadOnly}
                />
              </div>

              {/* Locked Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="lockSlot"
                  checked={activeSlotData.isLocked}
                  onChange={(e) => setActiveSlotData({ ...activeSlotData, isLocked: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="lockSlot" className="text-xs text-slate-700 dark:text-zinc-300 font-medium cursor-pointer">
                  Kunci slot ini (tandai permanen di rancangan)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-zinc-800">
              {activeSlotData.slotId ? (
                <button
                  type="button"
                  onClick={handleClearModal}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Kosongkan Slot
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSlotData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Slot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
