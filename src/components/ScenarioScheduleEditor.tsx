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
  AlertCircle
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
  isReadOnly = false
}) => {
  const [viewMode, setViewMode] = useState<"class" | "teacher">("class");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || "");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(teachers[0]?.id || "");
  
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

  // Current class details
  const activeClass = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId || c.classId === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Current teacher details
  const activeTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId || t.teacherId === selectedTeacherId) || teachers[0];
  }, [teachers, selectedTeacherId]);

  // Open slot editor
  const handleSlotClick = (day: string, period: LessonPeriod) => {
    if (isReadOnly) return;
    if (viewMode === "class" && !activeClass) return;

    // Find existing schedule for this slot
    const existing = schedules.find((s) => {
      if (viewMode === "class") {
        return (
          isClassMatch(s.classId, activeClass.id || activeClass.classId, classes) &&
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

    const targetClass = existing ? classes.find((c) => isClassMatch(c.id, existing.classId, classes)) || activeClass : activeClass;

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
      teacherId: existing?.teacherId || (viewMode === "teacher" ? selectedTeacherId : ""),
      teacherName: existing?.teacherName || (viewMode === "teacher" ? activeTeacher?.name : ""),
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

  return (
    <div className="space-y-6">
      {/* Top Controls: Switch between Class View & Teacher View */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("class")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "class"
                  ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              <School className="w-4 h-4" />
              Jadwal Per Kelas
            </button>
            <button
              onClick={() => setViewMode("teacher")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                viewMode === "teacher"
                  ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
              }`}
            >
              <User className="w-4 h-4" />
              Jadwal Per Guru
            </button>
          </div>

          {/* Selector */}
          {viewMode === "class" ? (
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
          ) : (
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

        {/* Conflict Quick Badge */}
        <div className="flex items-center gap-2">
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

      {/* Grid Schedule Timetable */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="font-bold text-slate-900 dark:text-white">
              {viewMode === "class" ? `Matriks Jadwal: ${activeClass?.name}` : `Matriks Jadwal: ${activeTeacher?.name}`}
            </h4>
          </div>
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            Klik slot kosong atau terisi untuk mengedit slot di jadwal simulasi
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

                      return (
                        <div
                          key={period.id || period.sequence}
                          onClick={() => handleSlotClick(day, period)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-xs relative ${
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
                                <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                                  {matched.subjectName}
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-1 mt-0.5">
                                  {viewMode === "class" ? matched.teacherName || "-" : matched.className || "-"}
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
                            <div className="py-2 text-center text-slate-400 dark:text-zinc-600 text-[11px] font-medium flex items-center justify-center gap-1">
                              <Plus className="w-3 h-3" />
                              <span>Kosong</span>
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
                      const sub = availableSubjects.find((s) => s.subjectId === subId);
                      setActiveSlotData({
                        ...activeSlotData,
                        subjectId: subId,
                        subjectName: sub ? sub.subjectName : "",
                        teacherId: sub?.teacherId || activeSlotData.teacherId,
                        teacherName: sub?.teacherName || activeSlotData.teacherName
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
