import React, { useState, useMemo } from "react";
import { 
  Printer, 
  X, 
  AlertTriangle, 
  FileText, 
  Calendar, 
  Clock, 
  Layers, 
  CheckCircle2, 
  Building2,
  Users,
  Grid,
  Filter
} from "lucide-react";
import { 
  ScheduleScenario, 
  ScenarioCurriculumMatrix, 
  ScenarioSchedule, 
  Class, 
  Teacher, 
  LessonPeriod, 
  LessonPeriodType,
  ScenarioConflict 
} from "../types";
import { isClassMatch, normalizeGradeLevel } from "../utils/gradeLevelHelper";
import { toValidGradeLevel } from "../services/scenario.service";

interface Props {
  scenario: ScheduleScenario;
  curriculums: ScenarioCurriculumMatrix[];
  schedules: ScenarioSchedule[];
  classes: Class[];
  teachers: Teacher[];
  periods: LessonPeriod[];
  conflicts: ScenarioConflict[];
  onClose: () => void;
}

const DEFAULT_DAYS = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];

export const ScenarioPrintModal: React.FC<Props> = ({
  scenario,
  curriculums,
  schedules,
  classes,
  teachers,
  periods,
  conflicts,
  onClose
}) => {
  // View mode switcher:
  // - "CLASS_SCHEDULE": Jadwal Per Rombel (Tabel Mingguan)
  // - "GENERAL_SCHEDULE": Jadwal Gabungan Umum (Matriks Seluruh Rombel VII–IX)
  // - "CURRICULUM_MATRIX": Struktur Kurikulum & Ringkasan Alokasi JP
  const [printView, setPrintView] = useState<"CLASS_SCHEDULE" | "GENERAL_SCHEDULE" | "CURRICULUM_MATRIX">("CLASS_SCHEDULE");

  // Filter rombel for CLASS_SCHEDULE view ("ALL" or specific classId)
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");

  // Filter day for GENERAL_SCHEDULE view ("ALL" or specific day)
  const [selectedDay, setSelectedDay] = useState<string>("ALL");

  const handlePrint = () => {
    window.print();
  };

  // Sort and filter active valid classes (VII, VIII, IX)
  const sortedClasses = useMemo(() => {
    const valid = classes.filter((c) => {
      const g = toValidGradeLevel(c.gradeLevel || c.name);
      return g === "VII" || g === "VIII" || g === "IX";
    });
    return [...valid].sort((a, b) => {
      const gOrder: Record<string, number> = { VII: 1, VIII: 2, IX: 3 };
      const gA = gOrder[toValidGradeLevel(a.gradeLevel || a.name)] || 99;
      const gB = gOrder[toValidGradeLevel(b.gradeLevel || b.name)] || 99;
      if (gA !== gB) return gA - gB;
      return (a.name || "").localeCompare(b.name || "", "id");
    });
  }, [classes]);

  // Target classes to print
  const targetClasses = useMemo(() => {
    if (selectedClassId === "ALL") return sortedClasses;
    return sortedClasses.filter((c) => c.id === selectedClassId);
  }, [selectedClassId, sortedClasses]);

  // Distinct days resolved from periods or schedules or fallback to DEFAULT_DAYS
  const availableDays = useMemo(() => {
    const daySet = new Set<string>();
    periods.forEach((p) => {
      if (p.day) daySet.add(p.day);
    });
    schedules.forEach((s) => {
      if (s.day) daySet.add(s.day);
    });
    if (daySet.size === 0) {
      return DEFAULT_DAYS;
    }
    // Maintain standard day order
    return DEFAULT_DAYS.filter((d) => daySet.has(d)).concat(
      Array.from(daySet).filter((d) => !DEFAULT_DAYS.includes(d))
    );
  }, [periods, schedules]);

  // Target days for general matrix
  const targetDays = useMemo(() => {
    if (selectedDay === "ALL") return availableDays;
    return availableDays.filter((d) => d === selectedDay);
  }, [selectedDay, availableDays]);

  // Distinct periods sorted by sequence
  const sortedPeriods = useMemo(() => {
    const map = new Map<number, LessonPeriod>();
    periods.forEach((p) => {
      if (!map.has(p.sequence)) {
        map.set(p.sequence, p);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.sequence - b.sequence);
  }, [periods]);

  // Helper to find a schedule slot strictly from the shadow schedule
  const findScheduleSlot = (cls: Class, day: string, sequence: number) => {
    return schedules.find((s) => {
      const matchesClass = s.classId === cls.id || isClassMatch(s.classId, cls, classes);
      const matchesDay = (s.day || "").trim().toLowerCase() === day.trim().toLowerCase();
      const matchesSeq = s.sequence === sequence;
      return matchesClass && matchesDay && matchesSeq;
    });
  };

  // Helper for curriculum totals
  const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);
  const totalVii = activeCurriculums.reduce((s, c) => s + (c.jp_vii || 0), 0);
  const totalViii = activeCurriculums.reduce((s, c) => s + (c.jp_viii || 0), 0);
  const totalIx = activeCurriculums.reduce((s, c) => s + (c.jp_ix || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-start overflow-y-auto p-3 sm:p-6 print:p-0 print:bg-white print:overflow-visible">
      {/* Top Floating Control Toolbar (Hidden during Print) */}
      <div className="w-full max-w-5xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xl mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        {/* Left: View Mode Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl overflow-x-auto">
          <button
            type="button"
            onClick={() => setPrintView("CLASS_SCHEDULE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              printView === "CLASS_SCHEDULE"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Jadwal Per Rombel</span>
          </button>

          <button
            type="button"
            onClick={() => setPrintView("GENERAL_SCHEDULE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              printView === "GENERAL_SCHEDULE"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Jadwal Gabungan (VII–IX)</span>
          </button>

          <button
            type="button"
            onClick={() => setPrintView("CURRICULUM_MATRIX")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              printView === "CURRICULUM_MATRIX"
                ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Struktur Kurikulum & JP</span>
          </button>
        </div>

        {/* Center / Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {printView === "CLASS_SCHEDULE" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Pilih Rombel:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
              >
                <option value="ALL">Semua Rombel ({sortedClasses.length} Kelas)</option>
                {sortedClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    Kelas {cls.name} ({cls.gradeLevel})
                  </option>
                ))}
              </select>
            </div>
          )}

          {printView === "GENERAL_SCHEDULE" && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Pilih Hari:</span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
              >
                <option value="ALL">Semua Hari KBM ({availableDays.length} Hari)</option>
                {availableDays.map((d) => (
                  <option key={d} value={d}>
                    Hari {d}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Print & Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF</span>
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Wrapper */}
      <div className="w-full max-w-5xl bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 print:shadow-none print:p-0 print:max-w-none print:w-full print:rounded-none relative overflow-hidden font-sans">
        
        {/* BIG BACKGROUND WATERMARK FOR PRINT & PDF */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] select-none rotate-[-30deg]">
          <span className="text-6xl sm:text-7xl font-black uppercase text-center tracking-widest leading-relaxed">
            DOKUMEN RANCANGAN<br />BUKAN JADWAL OPERASIONAL
          </span>
        </div>

        {/* =========================================================================
            VIEW 1: JADWAL PER ROMBEL (TABEL MINGGUAN PER KELAS)
           ========================================================================= */}
        {printView === "CLASS_SCHEDULE" && (
          <div className="space-y-12">
            {targetClasses.map((cls, classIdx) => {
              const classGrade = toValidGradeLevel(cls.gradeLevel || cls.name);
              const homeroomTeacher = cls.homeroomTeacherName || "-";

              return (
                <div
                  key={cls.id}
                  className={`space-y-5 ${classIdx < targetClasses.length - 1 ? "print:break-after-page" : ""}`}
                >
                  {/* Warning Strip */}
                  <div className="border border-amber-400 bg-amber-50/90 rounded-lg p-2 text-center print:border-amber-500">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                      ⚠️ DOKUMEN RANCANGAN JADWAL BAYANGAN — BUKAN JADWAL OPERASIONAL RESMI
                    </span>
                  </div>

                  {/* Letterhead Header */}
                  <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                    <div>
                      <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                        SMP ALKARIM RASYID
                      </h1>
                      <h2 className="text-xs sm:text-sm font-bold text-emerald-800 leading-tight">
                        PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA
                      </h2>
                      <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                        JADWAL BAYANGAN PELAJARAN: KELAS {cls.name} ({classGrade})
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tahun Ajaran: {scenario.academicYearName} • Semester: {scenario.semesterName} • Wali Kelas: {homeroomTeacher}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-white mb-0.5">
                        RANCANGAN: {scenario.name}
                      </span>
                      <p className="text-[10px] text-slate-600">
                        Status: <strong>{scenario.status}</strong>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Penyusun: {scenario.createdByName}
                      </p>
                    </div>
                  </div>

                  {/* Weekly Table for this Class */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse border border-slate-800">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-800 text-slate-900">
                          <th className="border border-slate-800 py-1.5 px-2 text-center w-12 font-bold">JP</th>
                          <th className="border border-slate-800 py-1.5 px-2 text-center w-28 font-bold">Waktu</th>
                          {availableDays.map((d) => (
                            <th key={d} className="border border-slate-800 py-1.5 px-2 text-center font-bold min-w-[130px]">
                              {d}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedPeriods.map((period) => {
                          const isBreak = period.type === LessonPeriodType.BREAK || Boolean((period as any).isBreak);
                          const timeRange = period.startTime && period.endTime
                            ? `${period.startTime} - ${period.endTime}`
                            : "-";

                          if (isBreak) {
                            return (
                              <tr key={period.id || period.sequence} className="bg-slate-100/70 border-b border-slate-800">
                                <td className="border border-slate-800 py-1 px-2 text-center font-bold text-slate-500">
                                  -
                                </td>
                                <td className="border border-slate-800 py-1 px-2 text-center font-mono text-[11px] text-slate-600">
                                  {timeRange}
                                </td>
                                <td
                                  colSpan={availableDays.length}
                                  className="border border-slate-800 py-1 px-2 text-center font-bold uppercase tracking-wider text-slate-600 text-[11px]"
                                >
                                  {period.title || (period as any).name || "ISTIRAHAT"}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={period.id || period.sequence} className="border-b border-slate-800">
                              <td className="border border-slate-800 py-1.5 px-2 text-center font-bold">
                                {period.sequence}
                              </td>
                              <td className="border border-slate-800 py-1.5 px-2 text-center font-mono text-[10.5px] text-slate-700">
                                {timeRange}
                              </td>

                              {availableDays.map((d) => {
                                const slot = findScheduleSlot(cls, d, period.sequence);
                                return (
                                  <td
                                    key={d}
                                    className={`border border-slate-800 p-1.5 text-center align-middle ${
                                      slot ? "bg-white" : "bg-slate-50/50"
                                    }`}
                                  >
                                    {slot ? (
                                      <div className="space-y-0.5">
                                        <div className="font-bold text-slate-900 leading-tight">
                                          {slot.subjectName}
                                        </div>
                                        <div className="text-[10px] text-emerald-800 font-medium leading-tight">
                                          {slot.teacherName || "-"}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 italic text-[11px]">-</span>
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

                  {/* Formal 3-Column Signatures */}
                  <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs print:break-inside-avoid">
                    <div>
                      <p className="font-semibold text-slate-700">Wakakur / Tim Kurikulum,</p>
                      <div className="h-16" />
                      <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
                      <div className="h-16" />
                      <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
                      <div className="h-16" />
                      <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =========================================================================
            VIEW 2: JADWAL GABUNGAN UMUM (MATRIKS SELURUH ROMBEL VII–IX)
           ========================================================================= */}
        {printView === "GENERAL_SCHEDULE" && (
          <div className="space-y-12">
            {targetDays.map((dayName, dayIdx) => (
              <div
                key={dayName}
                className={`space-y-4 ${dayIdx < targetDays.length - 1 ? "print:break-after-page" : ""}`}
              >
                {/* Warning Strip */}
                <div className="border border-amber-400 bg-amber-50/90 rounded-lg p-2 text-center print:border-amber-500">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                    ⚠️ DOKUMEN RANCANGAN JADWAL BAYANGAN — BUKAN JADWAL OPERASIONAL RESMI
                  </span>
                </div>

                {/* Header */}
                <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
                  <div>
                    <h1 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-tight">
                      SMP ALKARIM RASYID — JADWAL GABUNGAN KELAS VII–IX
                    </h1>
                    <h2 className="text-xs sm:text-sm font-bold text-emerald-800 leading-tight">
                      PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA
                    </h2>
                    <p className="text-xs font-bold text-slate-800 mt-1 uppercase">
                      HARI: {dayName} • TAHUN AJARAN: {scenario.academicYearName} • SEMESTER: {scenario.semesterName}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 text-white mb-0.5">
                      RANCANGAN: {scenario.name}
                    </span>
                    <p className="text-[10px] text-slate-600">
                      Status: <strong>{scenario.status}</strong>
                    </p>
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse border border-slate-800">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-800 text-slate-900">
                        <th className="border border-slate-800 py-1.5 px-2 text-center w-10 font-bold">JP</th>
                        <th className="border border-slate-800 py-1.5 px-2 text-center w-24 font-bold">Waktu</th>
                        {sortedClasses.map((cls) => (
                          <th key={cls.id} className="border border-slate-800 py-1.5 px-2 text-center font-bold min-w-[120px]">
                            Kelas {cls.name}
                            <span className="block text-[9px] font-normal text-slate-500">
                              ({cls.gradeLevel})
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPeriods.map((period) => {
                        const isBreak = period.type === LessonPeriodType.BREAK || Boolean((period as any).isBreak);
                        const timeRange = period.startTime && period.endTime
                          ? `${period.startTime} - ${period.endTime}`
                          : "-";

                        if (isBreak) {
                          return (
                            <tr key={period.id || period.sequence} className="bg-slate-100/70 border-b border-slate-800">
                              <td className="border border-slate-800 py-1 px-1.5 text-center font-bold text-slate-500">
                                -
                              </td>
                              <td className="border border-slate-800 py-1 px-1.5 text-center font-mono text-[10px] text-slate-600">
                                {timeRange}
                              </td>
                              <td
                                colSpan={sortedClasses.length}
                                className="border border-slate-800 py-1 px-2 text-center font-bold uppercase tracking-wider text-slate-600 text-[10px]"
                              >
                                {period.title || (period as any).name || "ISTIRAHAT"}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={period.id || period.sequence} className="border-b border-slate-800">
                            <td className="border border-slate-800 py-1 px-1.5 text-center font-bold">
                              {period.sequence}
                            </td>
                            <td className="border border-slate-800 py-1 px-1.5 text-center font-mono text-[10px] text-slate-700">
                              {timeRange}
                            </td>

                            {sortedClasses.map((cls) => {
                              const slot = findScheduleSlot(cls, dayName, period.sequence);
                              return (
                                <td
                                  key={cls.id}
                                  className={`border border-slate-800 p-1 text-center align-middle ${
                                    slot ? "bg-white" : "bg-slate-50/40"
                                  }`}
                                >
                                  {slot ? (
                                    <div className="space-y-0.5">
                                      <div className="font-bold text-slate-900 leading-tight">
                                        {slot.subjectName}
                                      </div>
                                      <div className="text-[9.5px] text-emerald-800 font-medium leading-tight">
                                        {slot.teacherName || "-"}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 italic text-[10px]">-</span>
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

                {/* Signatures */}
                <div className="pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs print:break-inside-avoid">
                  <div>
                    <p className="font-semibold text-slate-700">Wakakur / Tim Kurikulum,</p>
                    <div className="h-16" />
                    <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
                    <div className="h-16" />
                    <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
                    <div className="h-16" />
                    <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* =========================================================================
            VIEW 3: STRUKTUR KURIKULUM & DISTRIBUSI ALOKASI JP
           ========================================================================= */}
        {printView === "CURRICULUM_MATRIX" && (
          <div className="space-y-6">
            {/* Warning Strip */}
            <div className="border border-amber-400 bg-amber-50/90 rounded-lg p-2.5 text-center print:border-amber-500">
              <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                ⚠️ PERINGATAN: DOKUMEN RANCANGAN — BUKAN JADWAL OPERASIONAL RESMI
              </span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Dokumen ini dicetak khusus untuk bahan rapat, diskusi, dan konsultasi perencanaan struktur kurikulum & alokasi jadwal.
              </p>
            </div>

            {/* Letterhead Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                  SIMAK SMP ALKARIM RASYID
                </h1>
                <h2 className="text-sm font-semibold text-slate-700">
                  Jadwal Bayangan: Simulasi Perencanaan Kurikulum dan Jadwal
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Tahun Ajaran: {scenario.academicYearName} • {scenario.semesterName}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block text-xs font-bold uppercase px-2.5 py-1 rounded bg-slate-900 text-white mb-1">
                  STATUS: {scenario.status}
                </span>
                <p className="text-[11px] text-slate-500">
                  Snapshot: {new Date(scenario.sourceSnapshotMeta.snapshotAt).toLocaleDateString("id-ID")}
                </p>
                <p className="text-[11px] text-slate-500">
                  Penyusun: {scenario.createdByName}
                </p>
              </div>
            </div>

            {/* Scenario Overview */}
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                Nama Rancangan: {scenario.name}
              </h3>
              {scenario.description && (
                <p className="text-xs text-slate-600 italic">
                  Deskripsi / Tujuan: {scenario.description}
                </p>
              )}
              {scenario.consultationNotes && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <strong className="block text-slate-700 mb-0.5">Catatan Bahan Konsultasi:</strong>
                  <p className="text-slate-600">{scenario.consultationNotes}</p>
                </div>
              )}
            </div>

            {/* KPI Totals */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 border rounded-lg bg-slate-50 text-center">
                <span className="text-[11px] text-slate-500 font-bold block uppercase">Kelas VII</span>
                <span className="text-xl font-bold">{totalVii} JP</span>
                <span className="text-[10px] text-slate-500 block">per pekan</span>
              </div>
              <div className="p-3 border rounded-lg bg-slate-50 text-center">
                <span className="text-[11px] text-slate-500 font-bold block uppercase">Kelas VIII</span>
                <span className="text-xl font-bold">{totalViii} JP</span>
                <span className="text-[10px] text-slate-500 block">per pekan</span>
              </div>
              <div className="p-3 border rounded-lg bg-slate-50 text-center">
                <span className="text-[11px] text-slate-500 font-bold block uppercase">Kelas IX</span>
                <span className="text-xl font-bold">{totalIx} JP</span>
                <span className="text-[10px] text-slate-500 block">per pekan</span>
              </div>
            </div>

            {/* Curriculum Matrix Summary Table */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-slate-800 mb-2">
                I. Struktur Kurikulum & Distribusi Jam Pelajaran (JP)
              </h4>
              <table className="w-full text-xs border border-slate-300">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-300 py-1.5 px-2 text-center w-8">No</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-left">Mata Pelajaran</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-center w-12">Kel.</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-center w-16">VII</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-center w-16">VIII</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-center w-16">IX</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-center w-16">Total</th>
                    <th className="border border-slate-300 py-1.5 px-2 text-left">Status di Rancangan</th>
                  </tr>
                </thead>
                <tbody>
                  {curriculums.map((item, idx) => {
                    const totalItem = (item.jp_vii || 0) + (item.jp_viii || 0) + (item.jp_ix || 0);
                    return (
                      <tr key={item.id} className={!item.isActiveInScenario ? "opacity-50 line-through" : ""}>
                        <td className="border border-slate-300 py-1 px-2 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 py-1 px-2 font-medium">
                          {item.subjectName} {item.isCustomSubject && "(Mapel Baru)"}
                        </td>
                        <td className="border border-slate-300 py-1 px-2 text-center">{item.subjectGroup}</td>
                        <td className="border border-slate-300 py-1 px-2 text-center">{item.jp_vii}</td>
                        <td className="border border-slate-300 py-1 px-2 text-center">{item.jp_viii}</td>
                        <td className="border border-slate-300 py-1 px-2 text-center">{item.jp_ix}</td>
                        <td className="border border-slate-300 py-1 px-2 text-center font-bold">{totalItem}</td>
                        <td className="border border-slate-300 py-1 px-2">
                          {item.isCustomSubject ? "Ditambahkan Baru" : item.isActiveInScenario ? "Aktif" : "Dinonaktifkan"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Validation & Conflict Notes */}
            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-slate-800 mb-2">
                II. Catatan Hasil Analisis & Konflik Jadwal
              </h4>
              {conflicts.length === 0 ? (
                <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded border border-emerald-200">
                  ✅ Analisis Validasi: Rancangan jadwal tidak memiliki tabrakan guru maupun kelas. Distribusi JP terpenuhi sesuai matriks.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {conflicts.map((cf, idx) => (
                    <div key={idx} className="p-2 border border-slate-200 bg-slate-50 text-xs rounded">
                      <strong>• {cf.title}</strong>: {cf.description}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signature Box */}
            <div className="mt-12 pt-4 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <p className="font-semibold text-slate-700">Wakakur / Penyusun,</p>
                <div className="h-16" />
                <p className="font-bold underline text-slate-900">{scenario.createdByName}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Mengetahui, Kepala Sekolah</p>
                <div className="h-16" />
                <p className="font-bold underline text-slate-900">Ustadz Kepala Sekolah, M.Pd.</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Pimpinan Pondok Pesantren</p>
                <div className="h-16" />
                <p className="font-bold underline text-slate-900">Mudir / Pengasuh Pondok</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
