import React, { useMemo, useState } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  X, 
  BookOpen, 
  User, 
  Clock, 
  School, 
  ThumbsUp, 
  ChevronRight,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Sparkles,
  ArrowRight,
  Calendar,
  History,
  UserCheck,
  RefreshCw,
  Check
} from "lucide-react";
import { Schedule, Class, Teacher, LessonPeriod, CurriculumMatrix, TeacherAssignment } from "../types";
import { scheduleService, resolveTeacherForScheduleDate } from "../services/schedule.service";

// --- TYPES FOR ANALYSES ---
export interface PreAnalysisResult {
  isValid: boolean;
  warnings: string[];
  checks: {
    curriculum: boolean;
    teachers: boolean;
    beban: boolean;
    slots: boolean;
  };
  totalRequiredJp: number;
  slotsAvailable: number;
}

export interface PostAnalysisResult {
  totalSlots: number;
  totalFilled: number;
  totalEmpty: number;
  teacherConflicts: number;
  classConflicts: number;
  schedErrors: {
    message: string;
    type: "class" | "teacher" | "general";
    targetId?: string;
  }[];
  classStats: {
    class: Class;
    filledSlots: number;
    emptySlots: number;
    incompleteSubjects: {
      subjectId: string;
      subjectName: string;
      missingJp: number;
    }[];
  }[];
  status: "JADWAL VALID" | "PERLU PERBAIKAN";
}

// --- HELPER 1: SLOT STYLING PROVIDER ---
export const getSlotStyling = (
  classId: string,
  day: string,
  sequence: number,
  matched: Schedule | undefined,
  allSchedules: Schedule[]
) => {
  if (!matched) {
    return {
      bgColor: "bg-slate-50 border-dashed border-slate-200 dark:bg-zinc-900/10 dark:border-zinc-850",
      textColor: "text-slate-400 dark:text-zinc-500",
      label: "Kosong",
      colorTag: "bg-slate-300 dark:bg-zinc-700",
      status: "empty"
    };
  }

  // Check teacher conflict at this slot: Is the teacher scheduled elsewhere at the same time?
  const isTeacherConflict = allSchedules.some(s => 
    s.teacherId === matched.teacherId && 
    s.day.toLowerCase() === day.toLowerCase() && 
    s.sequence === sequence && 
    s.classId !== classId
  );

  if (isTeacherConflict) {
    return {
      bgColor: "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/60",
      textColor: "text-rose-800 dark:text-rose-400",
      label: "Bentrok Guru",
      colorTag: "bg-rose-500 animate-pulse",
      status: "conflict"
    };
  }

  if (matched.isLocked) {
    return {
      bgColor: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/60",
      textColor: "text-emerald-800 dark:text-emerald-400",
      label: "Valid & Terkunci",
      colorTag: "bg-emerald-500",
      status: "locked"
    };
  }

  return {
    bgColor: "bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/15 dark:border-amber-900/50",
    textColor: "text-amber-800 dark:text-amber-400",
    label: "Dapat Diedit",
    colorTag: "bg-amber-400",
    status: "editable"
  };
};

// --- COMPONENT 2: PRE-SCHEDULING PREPARATION PANEL ---
export function PreAnalysisPanel({
  curriculumMatrix,
  classes,
  instructionalPeriods,
  selectedYearId,
  selectedSemesterId
}: {
  curriculumMatrix: CurriculumMatrix[];
  classes: Class[];
  instructionalPeriods: LessonPeriod[];
  selectedYearId: string;
  selectedSemesterId: string;
}) {
  const analysis = useMemo(() => {
    if (!selectedYearId || !selectedSemesterId || curriculumMatrix.length === 0 || classes.length === 0) {
      return null;
    }

    const activeClasses = classes.filter(c => c.status === "Aktif" && !c.isDeleted);
    const warnings: string[] = [];
    const checks = {
      curriculum: true,
      teachers: true,
      beban: true,
      slots: true,
    };

    const numPeriods = instructionalPeriods.length;
    
    // Total JP per grade level
    const jpByGrade = { "VII": 0, "VIII": 0, "IX": 0 };
    curriculumMatrix.forEach((m) => {
      jpByGrade["VII"] += m.jp_vii;
      jpByGrade["VIII"] += m.jp_viii;
      jpByGrade["IX"] += m.jp_ix;
    });

    let totalRequiredJp = 0;

    // Check slots vs JP requirements for each grade
    ["VII", "VIII", "IX"].forEach((g) => {
      const grade = g as "VII" | "VIII" | "IX";
      const gradeClassesCount = activeClasses.filter(c => c.gradeLevel === grade).length;
      const requiredJp = jpByGrade[grade];
      totalRequiredJp += requiredJp * gradeClassesCount;

      const slotsAvailablePerClass = numPeriods;
      if (requiredJp > slotsAvailablePerClass) {
        warnings.push(`Jenjang ${grade} kelebihan JP: Struktur kurikulum membutuhkan ${requiredJp} JP, sedangkan slot efektif per kelas hanya ${slotsAvailablePerClass} JP.`);
        checks.curriculum = false;
      }
    });

    // Check teacher assignments completeness and loads
    const teacherLoads = new Map<string, { name: string; totalJp: number }>();

    curriculumMatrix.forEach((m) => {
      const hasVII = m.jp_vii > 0 && activeClasses.some(c => c.gradeLevel === "VII");
      const hasVIII = m.jp_viii > 0 && activeClasses.some(c => c.gradeLevel === "VIII");
      const hasIX = m.jp_ix > 0 && activeClasses.some(c => c.gradeLevel === "IX");

      if (hasVII || hasVIII || hasIX) {
        if (!m.useDifferentTeachers) {
          if (!m.teacherId || m.teacherId === "GURU_ALM_01") {
            warnings.push(`Mata Pelajaran ${m.subjectName} belum memiliki Guru Pengampu.`);
            checks.teachers = false;
          } else {
            const viiCount = activeClasses.filter(c => c.gradeLevel === "VII").length;
            const viiiCount = activeClasses.filter(c => c.gradeLevel === "VIII").length;
            const ixCount = activeClasses.filter(c => c.gradeLevel === "IX").length;
            const totalTeacherJp = (m.jp_vii * viiCount) + (m.jp_viii * viiiCount) + (m.jp_ix * ixCount);
            if (totalTeacherJp > 0) {
              const curr = teacherLoads.get(m.teacherId) || { name: m.teacherName, totalJp: 0 };
              curr.totalJp += totalTeacherJp;
              teacherLoads.set(m.teacherId, curr);
            }
          }
        } else {
          // Check for each active grade level specifically
          if (hasVII) {
            const tId = m.teacherId_vii || m.teacherId;
            const tName = m.teacherName_vii || m.teacherName;
            if (!tId || tId === "GURU_ALM_01") {
              warnings.push(`Mata Pelajaran ${m.subjectName} Kelas VII belum memiliki Guru Pengampu.`);
              checks.teachers = false;
            } else {
              const viiCount = activeClasses.filter(c => c.gradeLevel === "VII").length;
              const totalTeacherJp = m.jp_vii * viiCount;
              if (totalTeacherJp > 0) {
                const curr = teacherLoads.get(tId) || { name: tName, totalJp: 0 };
                curr.totalJp += totalTeacherJp;
                teacherLoads.set(tId, curr);
              }
            }
          }
          if (hasVIII) {
            const tId = m.teacherId_viii || m.teacherId;
            const tName = m.teacherName_viii || m.teacherName;
            if (!tId || tId === "GURU_ALM_01") {
              warnings.push(`Mata Pelajaran ${m.subjectName} Kelas VIII belum memiliki Guru Pengampu.`);
              checks.teachers = false;
            } else {
              const viiiCount = activeClasses.filter(c => c.gradeLevel === "VIII").length;
              const totalTeacherJp = m.jp_viii * viiiCount;
              if (totalTeacherJp > 0) {
                const curr = teacherLoads.get(tId) || { name: tName, totalJp: 0 };
                curr.totalJp += totalTeacherJp;
                teacherLoads.set(tId, curr);
              }
            }
          }
          if (hasIX) {
            const tId = m.teacherId_ix || m.teacherId;
            const tName = m.teacherName_ix || m.teacherName;
            if (!tId || tId === "GURU_ALM_01") {
              warnings.push(`Mata Pelajaran ${m.subjectName} Kelas IX belum memiliki Guru Pengampu.`);
              checks.teachers = false;
            } else {
              const ixCount = activeClasses.filter(c => c.gradeLevel === "IX").length;
              const totalTeacherJp = m.jp_ix * ixCount;
              if (totalTeacherJp > 0) {
                const curr = teacherLoads.get(tId) || { name: tName, totalJp: 0 };
                curr.totalJp += totalTeacherJp;
                teacherLoads.set(tId, curr);
              }
            }
          }
        }
      }
    });

    teacherLoads.forEach((load) => {
      if (load.totalJp > 30) {
        warnings.push(`Guru ${load.name} berpotensi bentrok/kelelahan karena beban mengajar sangat tinggi (${load.totalJp} JP/minggu).`);
        checks.beban = false;
      }
    });

    return {
      isValid: warnings.length === 0,
      warnings,
      checks,
      totalRequiredJp,
      slotsAvailable: activeClasses.length * numPeriods
    } as PreAnalysisResult;
  }, [curriculumMatrix, classes, instructionalPeriods, selectedYearId, selectedSemesterId]);

  if (!analysis) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
          <Info className="h-4.5 w-4.5 text-blue-500" />
          Analisis Kesiapan Data Kurikulum
        </h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          analysis.isValid ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600" : "bg-amber-50 dark:bg-amber-950/30 text-amber-600"
        }`}>
          {analysis.isValid ? "Data Siap" : "Ada Catatan"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* CHECK 1 */}
        <div className="bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-850 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Struktur JP</span>
          <div className="flex items-center gap-1.5 mt-2">
            {analysis.checks.curriculum ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Struktur JP Valid</span>
          </div>
        </div>

        {/* CHECK 2 */}
        <div className="bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-850 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Guru Pengampu</span>
          <div className="flex items-center gap-1.5 mt-2">
            {analysis.checks.teachers ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Guru Lengkap</span>
          </div>
        </div>

        {/* CHECK 3 */}
        <div className="bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-850 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Beban Mengajar</span>
          <div className="flex items-center gap-1.5 mt-2">
            {analysis.checks.beban ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Beban Wajar</span>
          </div>
        </div>

        {/* CHECK 4 */}
        <div className="bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-850 flex flex-col justify-between">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kebutuhan vs Slot</span>
          <div className="mt-2 text-xs font-bold text-slate-800 dark:text-zinc-200">
            {analysis.totalRequiredJp} / {analysis.slotsAvailable} JP
          </div>
        </div>
      </div>

      {analysis.warnings.length > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/10 border border-amber-200/70 dark:border-amber-900/40 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 text-xs font-bold">
            <AlertTriangle className="h-4 w-4" />
            <span>Pemberitahuan Terdeteksi ({analysis.warnings.length}):</span>
          </div>
          <ul className="list-disc pl-4 text-[11px] text-amber-700 dark:text-amber-400/80 space-y-1">
            {analysis.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- COMPONENT 3: POST-SCHEDULING FINAL ANALYSIS PANEL & DASHBOARD ---
export function PostAnalysisPanel({
  activeSchedules,
  curriculumMatrix,
  classes,
  instructionalPeriods,
  teachers,
  onJump
}: {
  activeSchedules: Schedule[];
  curriculumMatrix: CurriculumMatrix[];
  classes: Class[];
  instructionalPeriods: LessonPeriod[];
  teachers: Teacher[];
  onJump: (type: "class" | "teacher" | "general", targetId?: string) => void;
}) {
  const analysis = useMemo(() => {
    if (classes.length === 0) return null;

    const activeClasses = classes.filter(c => c.status === "Aktif" && !c.isDeleted);
    const numPeriods = instructionalPeriods.length;
    const totalSlots = activeClasses.length * numPeriods;
    const totalFilled = activeSchedules.length;
    const totalEmpty = Math.max(0, totalSlots - totalFilled);

    // Group active schedules by class
    const classStats = activeClasses.map((cls) => {
      const grade = cls.gradeLevel;
      const classScheds = activeSchedules.filter(s => s.classId === cls.classId);
      const filledSlots = classScheds.length;
      const emptySlots = Math.max(0, numPeriods - filledSlots);

      // Incomplete subjects
      const incompleteSubjects: { subjectId: string; subjectName: string; missingJp: number }[] = [];
      
      curriculumMatrix.forEach((m) => {
        const required = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
        if (required > 0) {
          const scheduled = classScheds.filter(s => s.subjectId === m.subjectId).length;
          if (scheduled < required) {
            incompleteSubjects.push({
              subjectId: m.subjectId,
              subjectName: m.subjectName,
              missingJp: required - scheduled
            });
          }
        }
      });

      return {
        class: cls,
        filledSlots,
        emptySlots,
        incompleteSubjects
      };
    });

    // Check conflicts
    let teacherConflicts = 0;
    let classConflicts = 0;
    const teacherConflictDetails: string[] = [];
    const classConflictDetails: string[] = [];

    const teacherDaySlotMap = new Map<string, { className: string; subjectName: string }[]>();
    const classDaySlotMap = new Map<string, { subjectName: string }[]>();

    activeSchedules.forEach((s) => {
      const key = `${s.day}_${s.sequence}`;
      const teachKey = `${s.teacherId}_${key}`;
      
      if (!teacherDaySlotMap.has(teachKey)) {
        teacherDaySlotMap.set(teachKey, []);
      }
      teacherDaySlotMap.get(teachKey)!.push({ className: s.className, subjectName: s.subjectName });

      const classKey = `${s.classId}_${key}`;
      if (!classDaySlotMap.has(classKey)) {
        classDaySlotMap.set(classKey, []);
      }
      classDaySlotMap.get(classKey)!.push({ subjectName: s.subjectName });
    });

    teacherDaySlotMap.forEach((slots, key) => {
      if (slots.length > 1) {
        teacherConflicts += (slots.length - 1);
        const parts = key.split("_");
        const tId = parts[0];
        const day = parts[1];
        const seq = parts[2];
        const tName = teachers.find(t => t.id === tId)?.name || tId;
        teacherConflictDetails.push(`Guru ${tName} bentrok mengajar di hari ${day} JP ${seq} pada kelas: ${slots.map(s => s.className).join(", ")}.`);
      }
    });

    classDaySlotMap.forEach((slots, key) => {
      if (slots.length > 1) {
        classConflicts += (slots.length - 1);
        const parts = key.split("_");
        const cId = parts[0];
        const day = parts[1];
        const seq = parts[2];
        const cName = classes.find(c => c.id === cId || c.classId === cId)?.name || cId;
        classConflictDetails.push(`Kelas ${cName} memiliki bentrok jadwal di hari ${day} JP ${seq}: ${slots.map(s => s.subjectName).join(", ")}.`);
      }
    });

    // General warnings / errors compilation
    const schedErrors: { message: string; type: "class" | "teacher" | "general"; targetId?: string }[] = [];
    
    classStats.forEach((stat) => {
      if (stat.emptySlots > 0) {
        schedErrors.push({
          message: `Kelas ${stat.class.name} memiliki ${stat.emptySlots} slot kosong.`,
          type: "class",
          targetId: stat.class.classId
        });
      }
      stat.incompleteSubjects.forEach((sub) => {
        schedErrors.push({
          message: `Mata Pelajaran ${sub.subjectName} di Kelas ${stat.class.name} masih kurang ${sub.missingJp} JP.`,
          type: "class",
          targetId: stat.class.classId
        });
      });
    });

    teacherConflictDetails.forEach(detail => {
      schedErrors.push({
        message: detail,
        type: "general"
      });
    });

    classConflictDetails.forEach(detail => {
      schedErrors.push({
        message: detail,
        type: "general"
      });
    });

    let mapelBelumLengkap = 0;
    classStats.forEach((stat) => {
      mapelBelumLengkap += stat.incompleteSubjects.length;
    });

    return {
      totalSlots,
      totalFilled,
      totalEmpty,
      teacherConflicts,
      classConflicts,
      mapelBelumLengkap,
      schedErrors,
      classStats,
      status: (totalEmpty === 0 && teacherConflicts === 0 && classConflicts === 0 && schedErrors.length === 0) 
        ? "JADWAL VALID" 
        : "PERLU PERBAIKAN"
    } as PostAnalysisResult;
  }, [activeSchedules, curriculumMatrix, classes, instructionalPeriods, teachers]);

  if (!analysis) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT PANEL: STATUS PENJADWALAN */}
      <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status Penjadwalan per Kelas</h3>
        
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {analysis.classStats.map((stat) => (
            <div key={stat.class.classId} className="border border-slate-100 dark:border-zinc-800/60 rounded-xl p-3 bg-slate-50/40 dark:bg-zinc-950/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{stat.class.name}</span>
                <span className="text-[10px] font-mono text-slate-500 font-bold">
                  {stat.filledSlots} / {stat.filledSlots + stat.emptySlots} JP
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200/80 dark:bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    stat.emptySlots === 0 ? "bg-emerald-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${(stat.filledSlots / (stat.filledSlots + stat.emptySlots)) * 100}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  stat.emptySlots === 0 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" : "bg-amber-50 dark:bg-amber-950/20 text-amber-600"
                }`}>
                  {stat.emptySlots === 0 ? "Selesai" : `${stat.emptySlots} slot kosong`}
                </span>

                {stat.incompleteSubjects.map((sub) => (
                  <span key={sub.subjectId} className="text-[9px] text-rose-500 font-semibold bg-rose-50/60 dark:bg-rose-950/10 border border-rose-100/50 dark:border-rose-950 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-rose-500"></span>
                    {sub.subjectName}: kurang {sub.missingJp} JP
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL: WARNINGS & FINAL SCHEDULING STATUS */}
      <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hasil Akhir Penjadwalan</h3>
            <span className={`text-[11px] font-black px-3 py-1 rounded-full border ${
              analysis.status === "JADWAL VALID" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/60" 
                : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/60"
            }`}>
              {analysis.status}
            </span>
          </div>

          {/* Metrics summary (Bagian 8) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-3">
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Jumlah Slot</span>
              <span className="text-base font-black text-slate-800 dark:text-zinc-200 mt-0.5 block">
                {analysis.totalSlots}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Slot Terisi</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {analysis.totalFilled}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Slot Kosong</span>
              <span className={`text-base font-black mt-0.5 block ${analysis.totalEmpty > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {analysis.totalEmpty}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Bentrok Guru</span>
              <span className={`text-base font-black mt-0.5 block ${analysis.teacherConflicts > 0 ? "text-rose-500 font-extrabold animate-pulse" : "text-slate-800 dark:text-zinc-200"}`}>
                {analysis.teacherConflicts}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Bentrok Kelas</span>
              <span className={`text-base font-black mt-0.5 block ${analysis.classConflicts > 0 ? "text-rose-500 font-extrabold animate-pulse" : "text-slate-800 dark:text-zinc-200"}`}>
                {analysis.classConflicts}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 dark:bg-zinc-950/40 rounded-xl border border-slate-100 dark:border-zinc-850">
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Belum Lengkap</span>
              <span className={`text-base font-black mt-0.5 block ${analysis.mapelBelumLengkap > 0 ? "text-amber-500" : "text-emerald-500"}`}>
                {analysis.mapelBelumLengkap}
              </span>
            </div>
          </div>

          {/* Warning Panels List */}
          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
            {analysis.schedErrors.length > 0 ? (
              analysis.schedErrors.map((err, idx) => (
                <div 
                  key={idx} 
                  onClick={() => err.targetId && onJump(err.type, err.targetId)}
                  className={`p-2.5 rounded-xl text-[11px] border leading-relaxed flex items-start gap-2 ${
                    err.targetId 
                      ? "cursor-pointer hover:shadow-xs transition-shadow" 
                      : ""
                  } ${
                    err.message.includes("bentrok") 
                      ? "bg-rose-50/60 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400" 
                      : "bg-amber-50/60 border-amber-200 text-amber-800 dark:bg-amber-950/15 dark:border-amber-900/40 dark:text-amber-400"
                  }`}
                >
                  <AlertCircle className={`h-4 w-4 shrink-0 mt-0.5 ${err.message.includes("bentrok") ? "text-rose-500" : "text-amber-500"}`} />
                  <div className="flex-1">
                    <span>{err.message}</span>
                    {err.targetId && (
                      <span className="block text-[9px] font-bold text-blue-500 hover:underline mt-1 flex items-center gap-0.5">
                        Klik untuk periksa <ChevronRight className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-xl flex flex-col items-center gap-1.5">
                <ThumbsUp className="h-5 w-5 text-emerald-500" />
                <span className="font-bold text-slate-700 dark:text-zinc-300">Selamat! Penjadwalan Selesai</span>
                <p className="text-[10px] text-slate-400">Tidak ada slot kosong maupun bentrok guru terdeteksi.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- COMPONENT 4: INTERACTIVE SLOT EDITOR MODAL ---
export function ScheduleEditorDialog({
  isOpen,
  onClose,
  slot,
  curriculumMatrix,
  teachers,
  activeSchedules,
  onSave,
  onDelete,
  onAssignmentUpdated
}: {
  isOpen: boolean;
  onClose: () => void;
  slot: {
    classId: string;
    className: string;
    day: string;
    sequence: number;
    jp: string;
    matchedSchedule?: Schedule;
  } | null;
  curriculumMatrix: CurriculumMatrix[];
  teachers: Teacher[];
  activeSchedules: Schedule[];
  onSave: (subjectId: string, teacherId: string) => void;
  onDelete: () => void;
  onAssignmentUpdated?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"edit" | "assignment">("edit");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");

  // Assignment tab state
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [newTeacherId, setNewTeacherId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(todayStr);
  const [assignmentNotes, setAssignmentNotes] = useState<string>("");
  const [applyToMatchingSlots, setApplyToMatchingSlots] = useState<boolean>(true);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState<boolean>(false);
  const [assignmentSuccessMsg, setAssignmentSuccessMsg] = useState<string | null>(null);

  if (!isOpen || !slot) return null;

  // Grade level of current class
  const gradeLevel = slot.className.toUpperCase().includes("7") || slot.className.toUpperCase().includes("VII") ? "VII" :
                     slot.className.toUpperCase().includes("8") || slot.className.toUpperCase().includes("VIII") ? "VIII" : "IX";

  // Filter matrix elements for this grade level
  const relevantSubjects = curriculumMatrix.filter(m => {
    const required = gradeLevel === "VII" ? m.jp_vii : gradeLevel === "VIII" ? m.jp_viii : m.jp_ix;
    return required > 0;
  });

  // Calculate detailed stats and checks for each subject option
  const options = relevantSubjects.map(m => {
    const required = gradeLevel === "VII" ? m.jp_vii : gradeLevel === "VIII" ? m.jp_viii : m.jp_ix;
    
    // Count how many JPs are scheduled for this subject in this class
    const scheduled = activeSchedules.filter(s => s.classId === slot.classId && s.subjectId === m.subjectId).length;
    const remaining = Math.max(0, required - scheduled);

    let resolvedTeacherId = m.teacherId || "GURU_ALM_01";
    let resolvedTeacherName = m.teacherName || "Guru Pengampu";

    if (m.useDifferentTeachers) {
      if (gradeLevel === "VII") {
        resolvedTeacherId = m.teacherId_vii || m.teacherId || "GURU_ALM_01";
        resolvedTeacherName = m.teacherName_vii || m.teacherName || "Guru Pengampu";
      } else if (gradeLevel === "VIII") {
        resolvedTeacherId = m.teacherId_viii || m.teacherId || "GURU_ALM_01";
        resolvedTeacherName = m.teacherName_viii || m.teacherName || "Guru Pengampu";
      } else if (gradeLevel === "IX") {
        resolvedTeacherId = m.teacherId_ix || m.teacherId || "GURU_ALM_01";
        resolvedTeacherName = m.teacherName_ix || m.teacherName || "Guru Pengampu";
      }
    }

    // Check teacher conflict: Is the teacher teaching another class in the same day and sequence?
    const teacherConflict = activeSchedules.find(s => 
      s.teacherId === resolvedTeacherId && 
      s.day.toLowerCase() === slot.day.toLowerCase() && 
      s.sequence === slot.sequence && 
      s.classId !== slot.classId
    );

    return {
      matrixItem: m,
      required,
      scheduled,
      remaining,
      resolvedTeacherId,
      resolvedTeacherName,
      teacherConflictClass: teacherConflict ? teacherConflict.className : null,
      isAvailable: !teacherConflict
    };
  });

  // Auto recommendation engine (Bagian 12)
  const recommendations = options
    .filter(opt => opt.remaining > 0 && opt.isAvailable)
    .sort((a, b) => b.remaining - a.remaining);

  const currentSelectionDetails = options.find(o => o.matrixItem.subjectId === selectedSubjectId);

  // Resolved teacher right now for this slot
  const currentResolved = slot.matchedSchedule 
    ? resolveTeacherForScheduleDate(slot.matchedSchedule, todayStr)
    : null;

  const currentTeacherName = currentResolved 
    ? (teachers.find(t => t.id === currentResolved.teacherId)?.name || slot.matchedSchedule?.teacherName || "Guru")
    : (slot.matchedSchedule?.teacherName || "Guru");

  const handleSaveTeacherTransfer = async () => {
    if (!slot.matchedSchedule?.id || !newTeacherId || !effectiveFrom) return;
    const newTeacherObj = teachers.find(t => t.id === newTeacherId);
    if (!newTeacherObj) return;

    setIsSubmittingAssignment(true);
    try {
      const targetIds = applyToMatchingSlots
        ? activeSchedules
            .filter(s => s.classId === slot.classId && s.subjectId === slot.matchedSchedule?.subjectId && s.id)
            .map(s => s.id!)
        : [slot.matchedSchedule.id];

      await scheduleService.changeTeacherAssignment({
        scheduleIds: targetIds,
        newTeacherId,
        newTeacherName: newTeacherObj.name,
        effectiveFrom,
        notes: assignmentNotes,
        operatorId: "admin",
        operatorName: "Admin"
      });

      setAssignmentSuccessMsg(`Berhasil mengalihkan pengampu ke ${newTeacherObj.name} mulai tanggal ${effectiveFrom}!`);
      if (onAssignmentUpdated) {
        onAssignmentUpdated();
      }
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Gagal memperbarui guru pengampu");
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-zinc-950/80 backdrop-blur-xs transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 text-left overflow-hidden space-y-4">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-zinc-50">
              {slot.matchedSchedule ? "Ubah Slot Pelajaran" : "Isi Slot Pelajaran"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
              <School className="h-3 w-3" /> {slot.className}
              <ChevronRight className="h-3 w-3" />
              <span>{slot.day}, {slot.jp}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* TAB SWITCHER (Only if slot already exists) */}
        {slot.matchedSchedule && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-xl">
            <button
              onClick={() => setActiveTab("edit")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "edit"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> Atur Mapel
            </button>
            <button
              onClick={() => setActiveTab("assignment")}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "assignment"
                  ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700"
              }`}
            >
              <History className="h-3.5 w-3.5" /> Ganti Pengampu (Tanggal Efektif)
            </button>
          </div>
        )}

        {/* TAB 1: EDIT MAPEL */}
        {activeTab === "edit" && (
          <>
            {/* DETAIL CURRENT SLOT (Bagian 11) */}
            {slot.matchedSchedule && (
              <div className="bg-slate-50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-850 rounded-xl p-3 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Informasi Detail Slot Saat Ini:</span>
                <div className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Mata Pelajaran:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">{slot.matchedSchedule.subjectName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Guru Pengampu Aktif:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">{currentTeacherName}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-200/50 dark:border-zinc-800/60 pt-1.5 mt-1">
                    <span className="text-slate-500">JP yang Dibutuhkan di Kurikulum:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {options.find(o => o.matrixItem.subjectId === slot.matchedSchedule?.subjectId)?.required || 0} JP
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">JP Sudah Terjadwal (Kelas Ini):</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {options.find(o => o.matrixItem.subjectId === slot.matchedSchedule?.subjectId)?.scheduled || 0} JP
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* AUTOMATIC RECOMMENDATION CARDS (Bagian 12) */}
            {!slot.matchedSchedule && recommendations.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Rekomendasi Pintar Penjadwalan
                </span>
                
                <div className="grid grid-cols-1 gap-2 max-h-[140px] overflow-y-auto">
                  {recommendations.slice(0, 2).map((rec) => (
                    <div 
                      key={rec.matrixItem.subjectId} 
                      className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/40 rounded-xl p-2.5 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-800/80 transition-all"
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 block">
                          {rec.matrixItem.subjectName}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {rec.matrixItem.teacherName} • <span className="font-bold text-blue-600 dark:text-blue-400">Kurang {rec.remaining} JP</span>
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          onSave(rec.matrixItem.subjectId, rec.matrixItem.teacherId);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      >
                        Gunakan Rekomendasi
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MANUAL FORM EDITOR */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {slot.matchedSchedule ? "Pilih Mapel Pengganti:" : "Atur Manual Slot:"}
              </span>
              
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Pilih Mata Pelajaran...</option>
                {options.map((opt) => (
                  <option 
                    key={opt.matrixItem.subjectId} 
                    value={opt.matrixItem.subjectId}
                    disabled={opt.remaining === 0 && opt.matrixItem.subjectId !== slot.matchedSchedule?.subjectId}
                  >
                    {opt.matrixItem.subjectName} ({opt.resolvedTeacherName}) 
                    {opt.remaining === 0 ? " - [JP Terpenuhi]" : ` - [Kurang ${opt.remaining} JP]`}
                    {opt.teacherConflictClass ? ` - [Bentrok di Kelas ${opt.teacherConflictClass}]` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* LIVE FORM VALIDATION WARNINGS */}
            {currentSelectionDetails && (
              <div className="bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Kebutuhan JP:</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{currentSelectionDetails.required} JP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Telah Terjadwal:</span>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{currentSelectionDetails.scheduled} JP</span>
                </div>
                
                {currentSelectionDetails.teacherConflictClass && (
                  <div className="text-rose-500 font-bold text-[10px] mt-1.5 border-t border-dashed border-rose-200/50 pt-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Peringatan: Guru Bentrok mengajar di Kelas {currentSelectionDetails.teacherConflictClass}!</span>
                  </div>
                )}
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-800/80 pt-4 mt-2 gap-2">
              {slot.matchedSchedule ? (
                <button
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="px-3.5 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-950/60 dark:text-rose-400 dark:hover:bg-rose-950/20 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus Jadwal
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-3.5 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    if (selectedSubjectId) {
                      const targetOpt = options.find(o => o.matrixItem.subjectId === selectedSubjectId);
                      if (targetOpt) {
                        onSave(selectedSubjectId, targetOpt.resolvedTeacherId);
                        onClose();
                      }
                    }
                  }}
                  disabled={!selectedSubjectId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 flex items-center gap-1 cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: EFFECTIVE-DATE TEACHER REASSIGNMENT */}
        {activeTab === "assignment" && slot.matchedSchedule && (
          <div className="space-y-4">
            {/* Timeline of teacher assignments */}
            <div className="bg-slate-50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-850 rounded-xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <History className="h-3 w-3 text-blue-500" /> Riwayat Pengampu Slot Ini:
              </span>
              
              <div className="space-y-1.5 text-xs">
                {/* Default initial teacher */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-700" />
                    <div>
                      <span className="font-bold text-slate-800 dark:text-zinc-200">
                        {teachers.find(t => t.id === slot.matchedSchedule?.teacherId)?.name || slot.matchedSchedule.teacherName || "Guru Awal"}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Guru Awal Semester</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {slot.matchedSchedule.teacherAssignments && slot.matchedSchedule.teacherAssignments.length > 0
                      ? `s.d. ${slot.matchedSchedule.teacherAssignments[0].effectiveFrom}`
                      : "Aktif"}
                  </span>
                </div>

                {/* Additional assignments */}
                {slot.matchedSchedule.teacherAssignments?.map((asg, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <div>
                        <span className="font-bold text-blue-900 dark:text-blue-300">
                          {asg.teacherName || teachers.find(t => t.id === asg.teacherId)?.name || asg.teacherId}
                        </span>
                        {asg.notes && <span className="text-[10px] text-blue-600/80 dark:text-blue-400/80 block">{asg.notes}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 dark:text-blue-300">
                      Mulai {asg.effectiveFrom}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Form to switch teacher */}
            <div className="space-y-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5">
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                Formulir Pergantian Pengampu:
              </span>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Guru Pengampu Baru:
                </label>
                <select
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Pilih Guru Baru...</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.nip ? `(${t.nip})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Mulai Berlaku Tanggal:
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block mb-1">
                  Catatan Alasan (Opsional):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pergantian penugasan tengah semester"
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={applyToMatchingSlots}
                  onChange={(e) => setApplyToMatchingSlots(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                />
                <span className="text-[11px] text-slate-600 dark:text-zinc-400 leading-tight">
                  Terapkan juga ke seluruh slot <b>{slot.matchedSchedule.subjectName}</b> pada <b>{slot.className}</b>.
                </span>
              </label>
            </div>

            {/* Immutability guarantee banner */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl flex items-start gap-2 text-emerald-800 dark:text-emerald-300 text-[11px]">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <div>
                <span className="font-bold block">Prinsip Immutability Riwayat</span>
                <span>Seluruh presensi & jurnal mengajar sebelum tanggal {effectiveFrom || "terpilih"} tetap tercatat atas nama guru sebelumnya secara aman.</span>
              </div>
            </div>

            {assignmentSuccessMsg && (
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold text-center">
                {assignmentSuccessMsg}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800/80 pt-3">
              <button
                onClick={onClose}
                className="px-3.5 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleSaveTeacherTransfer}
                disabled={!newTeacherId || !effectiveFrom || isSubmittingAssignment}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingAssignment ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
                Simpan Pergantian Pengampu
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// --- COMPONENT 5: BATCH TEACHER TRANSFER MODAL (PERGANTIAN PENGAMPU TENGAH PERIODE) ---
export function BatchTeacherTransferModal({
  isOpen,
  onClose,
  activeSchedules,
  teachers,
  classes,
  onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  activeSchedules: Schedule[];
  teachers: Teacher[];
  classes: Class[];
  onSuccess: () => void;
}) {
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [newTeacherId, setNewTeacherId] = useState<string>("");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(todayStr);
  const [notes, setNotes] = useState<string>("Pergantian guru pengampu tengah periode");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Distinct subjects present in active schedules
  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    activeSchedules.forEach(s => {
      if (s.subjectId && s.subjectName) {
        map.set(s.subjectId, s.subjectName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [activeSchedules]);

  // Classes that currently have schedules for selectedSubjectId
  const subjectClasses = useMemo(() => {
    if (!selectedSubjectId) return [];
    const classMap = new Map<string, { classId: string; className: string; currentTeacherName: string; slotCount: number }>();
    activeSchedules
      .filter(s => s.subjectId === selectedSubjectId)
      .forEach(s => {
        if (!classMap.has(s.classId)) {
          const resolved = resolveTeacherForScheduleDate(s, todayStr);
          const teacherObj = teachers.find(t => t.id === resolved.teacherId);
          classMap.set(s.classId, {
            classId: s.classId,
            className: s.className,
            currentTeacherName: teacherObj?.name || s.teacherName || "Guru",
            slotCount: 0
          });
        }
        const item = classMap.get(s.classId)!;
        item.slotCount += 1;
      });
    return Array.from(classMap.values());
  }, [activeSchedules, selectedSubjectId, teachers, todayStr]);

  // Auto-select all classes when subject changes
  React.useEffect(() => {
    if (subjectClasses.length > 0) {
      setSelectedClassIds(subjectClasses.map(c => c.classId));
    } else {
      setSelectedClassIds([]);
    }
  }, [selectedSubjectId, subjectClasses.length]);

  // Matching schedules to update
  const affectedSchedules = useMemo(() => {
    if (!selectedSubjectId || selectedClassIds.length === 0) return [];
    return activeSchedules.filter(s => 
      s.subjectId === selectedSubjectId && 
      selectedClassIds.includes(s.classId) &&
      s.id
    );
  }, [activeSchedules, selectedSubjectId, selectedClassIds]);

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleSelectAllClasses = () => {
    if (selectedClassIds.length === subjectClasses.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(subjectClasses.map(c => c.classId));
    }
  };

  const handleSubmitBatch = async () => {
    if (affectedSchedules.length === 0 || !newTeacherId || !effectiveFrom) return;
    const newTeacherObj = teachers.find(t => t.id === newTeacherId);
    if (!newTeacherObj) return;

    setIsSubmitting(true);
    try {
      await scheduleService.changeTeacherAssignment({
        scheduleIds: affectedSchedules.map(s => s.id!),
        newTeacherId,
        newTeacherName: newTeacherObj.name,
        effectiveFrom,
        notes,
        operatorId: "admin",
        operatorName: "Admin"
      });

      setSuccessMsg(`Berhasil mengalihkan ${affectedSchedules.length} slot jadwal pada ${selectedClassIds.length} kelas kepada ${newTeacherObj.name} mulai tanggal ${effectiveFrom}!`);
      onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Gagal melakukan pergantian guru massal");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 dark:bg-zinc-950/80 backdrop-blur-xs transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-2xl p-5 sm:p-6 text-left overflow-hidden space-y-4">
        
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-50">
                Pergantian Guru Pengampu di Tengah Periode
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Alihkan jadwal guru ke pengampu baru mulai tanggal efektif dengan riwayat presensi lama tetap aman.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STEP 1: PILIH MATA PELAJARAN */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
            1. Pilih Mata Pelajaran yang Mengalami Pergantian Guru:
          </label>
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Pilih Mata Pelajaran...</option>
            {availableSubjects.map(sub => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>
        </div>

        {/* STEP 2: PILIH KELAS YANG TERDAMPAK */}
        {selectedSubjectId && subjectClasses.length > 0 && (
          <div className="space-y-2 bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100 dark:border-zinc-850">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                2. Pilih Kelas yang Dialihkan ({selectedClassIds.length}/{subjectClasses.length} Kelas Terpilih):
              </label>
              <button
                type="button"
                onClick={handleSelectAllClasses}
                className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {selectedClassIds.length === subjectClasses.length ? "Batal Pilih Semua" : "Pilih Semua"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
              {subjectClasses.map(c => {
                const isSelected = selectedClassIds.includes(c.classId);
                return (
                  <div
                    key={c.classId}
                    onClick={() => handleToggleClass(c.classId)}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      isSelected
                        ? "bg-blue-50/80 border-blue-300 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`h-4 w-4 rounded flex items-center justify-center border ${
                        isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300 dark:border-zinc-700"
                      }`}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold block">{c.className}</span>
                        <span className="text-[10px] opacity-75 block">Pengampu saat ini: {c.currentTeacherName}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                      {c.slotCount} Slot
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3 & 4: GURU BARU & TANGGAL EFEKTIF */}
        {selectedSubjectId && selectedClassIds.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                3. Guru Pengampu Baru:
              </label>
              <select
                value={newTeacherId}
                onChange={(e) => setNewTeacherId(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2.5 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Pilih Guru Baru...</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.nip ? `(${t.nip})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                4. Mulai Berlaku Tanggal (Effective Date):
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* CATATAN */}
        {selectedSubjectId && selectedClassIds.length > 0 && (
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
              5. Catatan Penugasan (Opsional):
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Menggantikan Guru A mulai pertengahan semester"
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-2 text-xs text-slate-700 dark:text-zinc-300 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {/* SUMMARY & IMMUTABILITY GUARANTEE */}
        {selectedSubjectId && selectedClassIds.length > 0 && newTeacherId && (
          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-1.5 text-xs text-blue-950 dark:text-blue-200">
            <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
              <Info className="h-4 w-4 shrink-0" />
              <span>Ringkasan Pengalihan Tugas</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Sebanyak <b>{affectedSchedules.length} slot jadwal</b> pada <b>{selectedClassIds.length} kelas</b> akan dialihkan kepada <b>{teachers.find(t => t.id === newTeacherId)?.name}</b> mulai tanggal <b>{effectiveFrom}</b>.
            </p>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold border-t border-blue-100 dark:border-blue-900/40 pt-1">
              ✓ Riwayat presensi, jurnal, dan laporan disiplin sebelum tanggal {effectiveFrom} tetap utuh atas nama guru lama.
            </p>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-bold text-center">
            {successMsg}
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800/80 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handleSubmitBatch}
            disabled={affectedSchedules.length === 0 || !newTeacherId || !effectiveFrom || isSubmitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5" />}
            Terapkan Pergantian Pengampu
          </button>
        </div>

      </div>
    </div>
  );
}
