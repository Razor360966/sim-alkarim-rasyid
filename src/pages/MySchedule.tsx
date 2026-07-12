import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Loading } from "../components/Loading";
import { 
  Calendar, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  MapPin, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  User,
  LayoutGrid,
  ListFilter
} from "lucide-react";
import { scheduleService } from "../services/schedule.service";
import { lessonPeriodService } from "../services/lessonPeriod.service";
import { teacherService } from "../services/teacherService";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { teachingJournalService } from "../services/teachingJournalService";
import { academicYearService } from "../services/academicYear.service";
import { semesterService } from "../services/semester.service";

export const MySchedule: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Active view mode: "today" | "weekly" | "semester"
  const [viewMode, setViewMode] = useState<"today" | "weekly" | "semester">("today");

  // Selected Teacher ID (for non-teachers or administrators to select which teacher schedule to view)
  const isGuru = user?.role === "guru";
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    isGuru ? user?.teacherId || "" : ""
  );

  // Active Year & Semester Queries
  const { data: activeYear, isLoading: isLoadingYear } = useQuery({
    queryKey: ["activeAcademicYear"],
    queryFn: () => academicYearService.getActiveAcademicYear()
  });

  const { data: activeSemester, isLoading: isLoadingSemester } = useQuery({
    queryKey: ["activeSemester"],
    queryFn: () => semesterService.getActiveSemester()
  });

  // Master Data Queries
  const { data: allSchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["schedules", activeYear?.id, activeSemester?.id],
    queryFn: () => scheduleService.getSchedules(activeYear?.id, activeSemester?.id),
    enabled: !!activeYear?.id && !!activeSemester?.id
  });

  const { data: lessonPeriods = [], isLoading: isLoadingPeriods } = useQuery({
    queryKey: ["lessonPeriods"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classService.getClasses()
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectService.getSubjects()
  });

  const { data: journals = [], isLoading: isLoadingJournals } = useQuery({
    queryKey: ["allTeachingJournals", activeYear?.id, activeSemester?.id],
    queryFn: () => teachingJournalService.getAll(activeYear?.id, activeSemester?.id),
    enabled: !!activeYear?.id && !!activeSemester?.id
  });

  // Automatically set teacher if not set yet and we're not guru
  React.useEffect(() => {
    if (!isGuru && !selectedTeacherId && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id || "");
    }
  }, [teachers, isGuru, selectedTeacherId]);

  // Current selected teacher details
  const currentTeacher = useMemo(() => {
    return teachers.find(t => t.id === selectedTeacherId) || null;
  }, [teachers, selectedTeacherId]);

  // Determine current Day of Week in Indonesian
  const todayDayName = useMemo(() => {
    const daysIndonesian = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return daysIndonesian[new Date().getDay()];
  }, []);

  // Filter schedules for the selected teacher
  const teacherSchedules = useMemo(() => {
    if (!selectedTeacherId) return [];
    return allSchedules.filter(s => s.teacherId === selectedTeacherId);
  }, [allSchedules, selectedTeacherId]);

  // Helper function to match current time against a lesson period
  const parseTimeToMinutes = (t?: string | null): number | null => {
    if (!t) return null;
    const clean = t.replace(".", ":");
    const parts = clean.split(":").map((v) => parseInt(v, 10));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  // Enhance schedules with periods, journals, status
  const enhancedSchedules = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    return teacherSchedules.map(s => {
      // Find corresponding lesson period (matching by ID or stable day & sequence)
      const period = lessonPeriods.find(p => 
        p.id === s.lessonPeriodId || 
        ((p.day || "").toLowerCase() === (s.day || "").toLowerCase() && p.sequence === s.sequence)
      );
      const startTime = period?.startTime || "";
      const endTime = period?.endTime || "";
      const startMin = parseTimeToMinutes(startTime);
      const endMin = parseTimeToMinutes(endTime);

      // Check if teaching journal exists for this class, subject, teacher, and lesson period on TODAY
      // For general weekly view, check journals matching day & schedule
      const journalToday = journals.find(j => 
        j.date === todayStr &&
        j.classId === s.classId &&
        j.subjectId === s.subjectId &&
        j.teacherId === s.teacherId &&
        j.lessonPeriodIds?.includes(s.lessonPeriodId)
      );

      // Check if teaching journal exists for this schedule on any date
      const journalForThisSlot = journals.filter(j => 
        j.classId === s.classId &&
        j.subjectId === s.subjectId &&
        j.teacherId === s.teacherId &&
        j.lessonPeriodIds?.includes(s.lessonPeriodId)
      );

      // Determine live teaching status for TODAY
      let status: "filled" | "ongoing" | "unfilled" | "incoming" = "unfilled";
      if (journalToday) {
        status = "filled";
      } else {
        if (startMin !== null && endMin !== null) {
          if (currentMin >= startMin && currentMin <= endMin) {
            status = "ongoing";
          } else if (currentMin < startMin) {
            status = "incoming";
          } else {
            status = "unfilled";
          }
        }
      }

      return {
        ...s,
        period,
        startTime,
        endTime,
        journalToday,
        allJournals: journalForThisSlot,
        status
      };
    });
  }, [teacherSchedules, lessonPeriods, journals]);

  // Statistics calculation
  const metrics = useMemo(() => {
    const todaySchedules = enhancedSchedules.filter(s => s.day.toLowerCase() === todayDayName.toLowerCase());
    const totalJpHariIni = todaySchedules.length;
    const totalJpMingguIni = enhancedSchedules.length;

    const uniqueClasses = Array.from(new Set(enhancedSchedules.map(s => s.classId))).length;
    const uniqueSubjects = Array.from(new Set(enhancedSchedules.map(s => s.subjectId))).length;

    return {
      totalJpHariIni,
      totalJpMingguIni,
      uniqueClasses,
      uniqueSubjects
    };
  }, [enhancedSchedules, todayDayName]);

  const handleCreateJournal = (schedule: any, dateString?: string) => {
    const dateToUse = dateString || new Date().toISOString().split("T")[0];
    navigate(`/teaching-journals?prefillDate=${dateToUse}&prefillScheduleId=${schedule.id}&openForm=true`);
    toast(`Membuka formulir Jurnal Mengajar untuk Kelas ${schedule.className} - ${schedule.subjectName}`, "success");
  };

  const isLoading = isLoadingYear || isLoadingSemester || isLoadingSchedules || isLoadingPeriods || isLoadingTeachers || isLoadingJournals;

  if (isLoading) {
    return <Loading label="Memuat Jadwal Mengajar Anda..." />;
  }

  // Group schedules by day for the weekly view
  const daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const schedulesByDay = daysOfWeek.map(day => {
    const daySchedules = enhancedSchedules
      .filter(s => s.day.toLowerCase() === day.toLowerCase())
      .sort((a, b) => (a.period?.sequence || 0) - (b.period?.sequence || 0));
    return { day, schedules: daySchedules };
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" id="my-schedule-page">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-150 dark:border-zinc-800 shadow-xs">
        <div>
          <span className="text-xs font-black tracking-widest text-indigo-600 dark:text-blue-400 uppercase">
            Sistem Jadwal Mengajar Dinamis
          </span>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white mt-1">
            Jadwal Mengajar Saya
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Gunakan Command Center Jadwal untuk melihat penugasan mengajar, memonitor administrasi jurnal, dan langsung mengisi Jurnal Mengajar harian.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-2xl border border-slate-200 dark:border-zinc-800 self-start md:self-center">
          {[
            { mode: "today", label: "Hari Ini" },
            { mode: "weekly", label: "Mingguan" },
            { mode: "semester", label: "Satu Semester" }
          ].map(item => (
            <button
              key={item.mode}
              onClick={() => setViewMode(item.mode as any)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === item.mode
                  ? "bg-white text-slate-900 dark:bg-zinc-800 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* EXECUTIVE CONTROLLER (TEACHER SELECTOR) */}
      {!isGuru && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-indigo-50/50 dark:bg-zinc-950/40 p-4 rounded-2xl border border-indigo-100/50 dark:border-zinc-850">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-blue-400">
            <User className="h-4.5 w-4.5" />
            <span className="text-xs font-bold uppercase tracking-wider">Workspace Administrator:</span>
          </div>
          <div className="flex-1 max-w-xs">
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full text-xs font-bold text-slate-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
            >
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.frontTitle ? t.frontTitle + " " : ""}{t.name}{t.backTitle ? ", " + t.backTitle : ""}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-zinc-500">
            Melihat Dashboard Jadwal Mengajar sebagai: <strong>{currentTeacher ? `${currentTeacher.frontTitle || ""} ${currentTeacher.name} ${currentTeacher.backTitle || ""}`.trim() : "Guru"}</strong>
          </span>
        </div>
      )}

      {/* METRICS HEADER */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Total JP Hari Ini</p>
          <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{metrics.totalJpHariIni} JP</h3>
          <span className="text-[9px] text-slate-400 mt-0.5 block">{todayDayName} Efektif</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Total JP Minggu Ini</p>
          <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{metrics.totalJpMingguIni} JP</h3>
          <span className="text-[9px] text-slate-400 mt-0.5 block">Senin s/d Sabtu</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Kelas Diajar</p>
          <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{metrics.uniqueClasses} Kelas</h3>
          <span className="text-[9px] text-slate-400 mt-0.5 block">Rombongan Belajar</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Mata Pelajaran</p>
          <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{metrics.uniqueSubjects} Mapel</h3>
          <span className="text-[9px] text-slate-400 mt-0.5 block">Materi Pokok Diampu</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Semester Aktif</p>
          <h3 className="text-sm font-black text-slate-800 dark:text-white mt-2 truncate">{activeSemester?.name || "Semester Aktif"}</h3>
          <span className="text-[9px] text-slate-400 mt-0.5 block">Sistem Terintegrasi</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Tahun Pelajaran</p>
          <h3 className="text-sm font-black text-slate-800 dark:text-white mt-2 truncate">{activeYear?.name || "Tahun Pelajaran"}</h3>
          <span className="text-[9px] text-slate-400 mt-0.5 block">Tingkat Akademik</span>
        </div>
      </div>

      {/* CORE SCHEDULE PANEL */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-150 dark:border-zinc-800 shadow-xs">
        {/* VIEW 1: TODAY */}
        {viewMode === "today" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Jadwal Hari Ini ({todayDayName})</h3>
                <p className="text-xs text-slate-400 mt-0.5">Daftar jam mengajar Anda pada hari ini beserta status pengisian administrasi jurnal.</p>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-blue-400 bg-indigo-50 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-indigo-100/30">
                Live Sinkronisasi
              </span>
            </div>

            {enhancedSchedules.filter(s => s.day.toLowerCase() === todayDayName.toLowerCase()).length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <Calendar className="h-10 w-10 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400">Hari ini Anda tidak memiliki jadwal mengajar.</h4>
                <p className="text-[10px] text-slate-400 mt-1">Nikmati hari bebas mengajar atau persiapkan materi untuk agenda berikutnya!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enhancedSchedules
                  .filter(s => s.day.toLowerCase() === todayDayName.toLowerCase())
                  .sort((a, b) => (a.period?.sequence || 0) - (b.period?.sequence || 0))
                  .map((s) => (
                    <div 
                      key={s.id} 
                      onClick={() => handleCreateJournal(s)}
                      className="group relative flex flex-col justify-between p-5 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-850 hover:border-indigo-400 dark:hover:border-zinc-700 rounded-2xl transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                    >
                      <div>
                        {/* Status Badge */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono font-extrabold text-indigo-600 dark:text-blue-400 bg-indigo-50 dark:bg-blue-950/40 border border-indigo-100/30 px-2 py-0.5 rounded-md">
                            {s.period?.title || s.jp || `JP ${s.sequence}`} ({s.startTime} - {s.endTime})
                          </span>
                          
                          <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold border ${
                            s.status === "filled" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                              : s.status === "ongoing"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 animate-pulse"
                              : s.status === "incoming"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30"
                              : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              s.status === "filled" ? "bg-emerald-500" :
                              s.status === "ongoing" ? "bg-amber-500" :
                              s.status === "incoming" ? "bg-blue-500" : "bg-rose-500"
                            }`} />
                            {s.status === "filled" ? "🟢 Jurnal sudah diisi" :
                             s.status === "ongoing" ? "🟡 Sedang berlangsung" :
                             s.status === "incoming" ? "🔵 Akan Datang" : "🔴 Belum mengisi jurnal"}
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition-colors">
                          {s.subjectName}
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] text-slate-500 dark:text-zinc-400">
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>Kelas: <strong>{s.className}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>Ruang: <strong>{s.room || "Utama"}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Attendance Summary */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between text-[10px]">
                        <div className="text-slate-400">
                          {s.journalToday ? (
                            <span>
                              Siswa Hadir: <strong className="text-emerald-600 font-bold">{s.journalToday.studentAttendance?.hadir}</strong>
                              {s.journalToday.studentAttendance?.sakit > 0 && <span className="text-amber-500">, Sakit: {s.journalToday.studentAttendance.sakit}</span>}
                              {s.journalToday.studentAttendance?.izin > 0 && <span className="text-blue-500">, Izin: {s.journalToday.studentAttendance.izin}</span>}
                              {s.journalToday.studentAttendance?.alpha > 0 && <span className="text-rose-500">, Alpha: {s.journalToday.studentAttendance.alpha}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 italic">Data kehadiran belum dimasukkan</span>
                          )}
                        </div>
                        <div className="flex items-center text-indigo-600 dark:text-blue-400 font-bold group-hover:translate-x-1 transition-transform">
                          {s.status === "filled" ? "Lihat Jurnal" : "Isi Jurnal"} <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: WEEKLY */}
        {viewMode === "weekly" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Jadwal Mingguan Satu Pekan</h3>
              <p className="text-xs text-slate-400 mt-0.5">Daftar agenda mengajar lengkap selama satu pekan aktif (Senin s/d Sabtu).</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {schedulesByDay.map(({ day, schedules }) => (
                <div key={day} className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-150 dark:border-zinc-850 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800 mb-3">
                      <h4 className="text-xs font-black text-slate-800 dark:text-white tracking-wide uppercase">{day}</h4>
                      <span className="text-[10px] font-bold text-slate-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded-full">
                        {schedules.length} JP
                      </span>
                    </div>

                    {schedules.length === 0 ? (
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 italic text-center py-8">Tidak ada jadwal mengajar.</p>
                    ) : (
                      <div className="space-y-3">
                        {schedules.map((s) => (
                          <div 
                            key={s.id} 
                            onClick={() => handleCreateJournal(s)}
                            className="group p-3.5 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-zinc-700 rounded-xl cursor-pointer transition-all shadow-3xs"
                          >
                            <div className="flex items-center justify-between text-[9px] mb-1.5">
                              <span className="font-mono font-bold text-indigo-600 dark:text-blue-400">
                                {s.period?.title || s.jp || `JP ${s.sequence}`}
                              </span>
                              <span className="text-slate-400 dark:text-zinc-500">
                                {s.startTime} - {s.endTime}
                              </span>
                            </div>

                            <h5 className="text-[11px] font-black text-slate-800 dark:text-zinc-200 group-hover:text-indigo-600 dark:group-hover:text-blue-400 truncate">
                              {s.subjectName}
                            </h5>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2.5">
                              <span>Kelas: <strong className="text-slate-700 dark:text-zinc-300 font-bold">{s.className}</strong></span>
                              <span className="text-indigo-600 dark:text-blue-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                Jurnal <ChevronRight className="h-3 w-3" />
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: FULL SEMESTER */}
        {viewMode === "semester" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Rekap Penugasan Satu Semester</h3>
                <p className="text-xs text-slate-400 mt-0.5">Seluruh daftar penugasan resmi Anda pada Semester {activeSemester?.name || ""} Tahun Pelajaran {activeYear?.name || ""}.</p>
              </div>
            </div>

            {enhancedSchedules.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <BookOpen className="h-10 w-10 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
                <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400">Belum ada penugasan mengajar terbit.</h4>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-150 dark:border-zinc-800 rounded-2xl">
                <table className="min-w-full divide-y divide-slate-150 dark:divide-zinc-800 text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-zinc-950 text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3.5">Hari</th>
                      <th className="px-6 py-3.5">Jam Pelajaran</th>
                      <th className="px-6 py-3.5">Mata Pelajaran</th>
                      <th className="px-6 py-3.5">Kelas</th>
                      <th className="px-6 py-3.5">Ruang / Lokasi</th>
                      <th className="px-6 py-3.5 text-center">Akumulasi Jurnal</th>
                      <th className="px-6 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-zinc-800 bg-white dark:bg-zinc-900 font-medium text-slate-700 dark:text-zinc-300">
                    {enhancedSchedules
                      .sort((a, b) => {
                        const dayWeight = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].indexOf(a.day);
                        const otherWeight = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"].indexOf(b.day);
                        if (dayWeight !== otherWeight) return dayWeight - otherWeight;
                        return (a.period?.sequence || 0) - (b.period?.sequence || 0);
                      })
                      .map((s, index) => (
                        <tr key={s.id || index} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-white uppercase tracking-wide text-[11px]">
                            {s.day}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-[11px] bg-slate-100 dark:bg-zinc-850 px-2.5 py-1 rounded-md text-slate-600 dark:text-zinc-400 font-bold">
                              {s.period?.title || s.jp || `JP ${s.sequence}`} ({s.startTime} - {s.endTime})
                            </span>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                            {s.subjectName}
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-indigo-50 dark:bg-blue-950/30 text-indigo-700 dark:text-blue-400 border border-indigo-100/50 dark:border-blue-900/20 px-2.5 py-0.5 rounded font-black text-[10px]">
                              {s.className}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 dark:text-zinc-500">
                            {s.room || s.period?.title || "Ruang Utama"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 px-2 py-0.5 rounded text-[10px] font-bold">
                              <CheckCircle className="h-3 w-3" /> {s.allJournals.length} Jurnal Terisi
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleCreateJournal(s)}
                              className="inline-flex items-center gap-1 text-[11px] font-black text-indigo-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              Buat Jurnal <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
