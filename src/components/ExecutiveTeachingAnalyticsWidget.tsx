import React from "react";
import { 
  Award, 
  AlertTriangle, 
  Clock, 
  Lock, 
  School, 
  BookOpen, 
  CheckCircle2, 
  HelpCircle, 
  XCircle, 
  ChevronRight, 
  BarChart3,
  TrendingUp,
  ShieldAlert
} from "lucide-react";
import { teacherTeachingAttendanceService } from "../services/teacherTeachingAttendance.service";
import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";

interface ExecutiveTeachingAnalyticsWidgetProps {
  records: TeacherTeachingAttendance[];
  title?: string;
  subtitle?: string;
}

export const StatusJpLegend: React.FC = () => {
  return (
    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2.5 shadow-xs">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-200 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-600" />
          Legenda Status Kehadiran Per JP (Jam Pelajaran)
        </h4>
        <span className="text-[10px] text-slate-400 font-semibold">Standard Realtime Monitoring</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-semibold">
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <div>
            <div className="font-extrabold text-[11px] text-emerald-800 dark:text-emerald-300">🟢 HADIR</div>
            <p className="text-[9px] text-emerald-700/80 dark:text-emerald-400 font-normal">Dikonfirmasi hadir pada JP</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-800/80 text-orange-900 dark:text-orange-200">
          <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
          <div>
            <div className="font-extrabold text-[11px] text-orange-800 dark:text-orange-300">🟡 BELUM TERKONFIRMASI</div>
            <p className="text-[9px] text-orange-700/80 dark:text-orange-400 font-normal">Check-in, menunggu Check-out</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 text-amber-900 dark:text-amber-200">
          <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
          <div>
            <div className="font-extrabold text-[11px] text-amber-800 dark:text-amber-300">🟠 TERLAMBAT</div>
            <p className="text-[9px] text-amber-700/80 dark:text-amber-400 font-normal">Check-in batas toleransi</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/80 text-rose-900 dark:text-rose-200">
          <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
          <div>
            <div className="font-extrabold text-[11px] text-rose-800 dark:text-rose-300">🔴 ALPA</div>
            <p className="text-[9px] text-rose-700/80 dark:text-rose-400 font-normal">Tidak melakukan Check-in</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-zinc-100">
          <span className="w-3 h-3 rounded-full bg-slate-900 dark:bg-slate-300 shrink-0" />
          <div>
            <div className="font-extrabold text-[11px] text-slate-800 dark:text-zinc-200">⚫ DIKUNCI</div>
            <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-normal">Lewat batas, butuh Wakakur</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ExecutiveTeachingAnalyticsWidget: React.FC<ExecutiveTeachingAnalyticsWidgetProps> = ({
  records,
  title = "Dashboard Indikator Eksekutif Kehadiran JP",
  subtitle = "Analisis kinerja kedisiplinan per Jam Pelajaran (JP) secara realtime."
}) => {
  const analytics = React.useMemo(() => {
    return teacherTeachingAttendanceService.getExecutiveTeachingAnalytics(records);
  }, [records]);

  const { summary } = analytics;

  return (
    <div className="space-y-4">
      {/* 1. Status Legend */}
      <StatusJpLegend />

      {/* 2. Ringkasan Harian Per JP */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-300 uppercase">Total JP Sesi</span>
          <div className="text-xl font-black">{summary.totalJP} JP</div>
          <p className="text-[9px] text-slate-400">Total Jam Pelajaran</p>
        </div>

        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">🟢 JP Hadir</span>
          <div className="text-xl font-black text-emerald-800 dark:text-emerald-200">{summary.jpHadir} JP</div>
          <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">Dikonfirmasi Hadir</p>
        </div>

        <div className="p-3.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase">🟡 Belum Konfirmasi</span>
          <div className="text-xl font-black text-orange-800 dark:text-orange-200">{summary.jpBelumTerkonfirmasi} JP</div>
          <p className="text-[9px] text-orange-600 dark:text-orange-400 font-medium">Menunggu Check-out</p>
        </div>

        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">🟠 JP Terlambat</span>
          <div className="text-xl font-black text-amber-800 dark:text-amber-200">{summary.jpTerlambat} JP</div>
          <p className="text-[9px] text-amber-600 dark:text-amber-400 font-medium">Toleransi Waktu</p>
        </div>

        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase">🔴 JP Alpa</span>
          <div className="text-xl font-black text-rose-800 dark:text-rose-200">{summary.jpAlpa} JP</div>
          <p className="text-[9px] text-rose-600 dark:text-rose-400 font-medium">Tanpa Check-in</p>
        </div>

        <div className="p-3.5 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-2xl space-y-1">
          <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">⚫ JP Dikunci</span>
          <div className="text-xl font-black text-slate-900 dark:text-white">{summary.jpDikunci} JP</div>
          <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-medium">Validasi Wakakur</p>
        </div>
      </div>

      {/* 3. 6 Executive Indicators Cards Grid */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            {title}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Guru Belum Terkonfirmasi Terbanyak */}
          <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-orange-200/60 dark:border-orange-900/40 pb-2">
              <span className="text-xs font-bold text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                JP Belum Terkonfirmasi Terbanyak
              </span>
              <span className="text-[10px] font-bold text-orange-600">Top 5</span>
            </div>
            {analytics.topUnconfirmedTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Nihil. Seluruh sesi JP telah dikonfirmasi/Check-out.</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.topUnconfirmedTeachers.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-orange-100 dark:border-orange-950/60 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[170px]">{idx + 1}. {t.teacherName}</span>
                    <span className="font-black text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/60 px-2 py-0.5 rounded-md text-[10px]">
                      {t.unconfirmed} JP
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Guru Paling Disiplin */}
          <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-900/40 pb-2">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-600" />
                Guru Paling Disiplin
              </span>
              <span className="text-[10px] font-bold text-emerald-600">Top 5</span>
            </div>
            {analytics.mostDisciplinedTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Belum ada data kedisiplinan guru.</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.mostDisciplinedTeachers.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-emerald-100 dark:border-emerald-950/60 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[170px]">{idx + 1}. {t.teacherName}</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md text-[10px]">
                      {t.percentage}% ({t.hadir}/{t.total} JP)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Guru Paling Sering Terlambat */}
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-900/40 pb-2">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                Guru Sering Terlambat
              </span>
              <span className="text-[10px] font-bold text-amber-600">Top 5</span>
            </div>
            {analytics.mostLateTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Nihil. Tidak ada keterlambatan guru.</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.mostLateTeachers.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-amber-100 dark:border-amber-950/60 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[170px]">{idx + 1}. {t.teacherName}</span>
                    <span className="font-black text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md text-[10px]">
                      {t.terlambat} Kali
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 4: Guru Sering Dikunci */}
          <div className="p-4 bg-slate-100/70 dark:bg-zinc-800/50 border border-slate-300 dark:border-zinc-700 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-700 pb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                Guru Sering Dikunci
              </span>
              <span className="text-[10px] font-bold text-slate-500">Top 5</span>
            </div>
            {analytics.mostLockedTeachers.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Nihil. Tidak ada sesi terkunci (&gt;15 menit).</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.mostLockedTeachers.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-200 dark:border-zinc-700 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[170px]">{idx + 1}. {t.teacherName}</span>
                    <span className="font-black text-slate-900 dark:text-white bg-slate-200 dark:bg-zinc-700 px-2 py-0.5 rounded-md text-[10px]">
                      {t.dikunci} Sesi
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 5: Kelas Keterlambatan Tertinggi */}
          <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-900/40 pb-2">
              <span className="text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center gap-1.5">
                <School className="w-4 h-4 text-rose-600" />
                Kelas Keterlambatan Tertinggi
              </span>
              <span className="text-[10px] font-bold text-rose-600">Top 5</span>
            </div>
            {analytics.topLateClasses.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Nihil. Seluruh kelas tepat waktu.</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.topLateClasses.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-rose-100 dark:border-rose-950/60 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[170px]">{idx + 1}. Kelas {c.className}</span>
                    <span className="font-black text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md text-[10px]">
                      {c.percentage}% ({c.terlambat}/{c.total})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 6: Mapel Kedisiplinan Terbaik */}
          <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-2xl space-y-2">
            <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/40 pb-2">
              <span className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                Mapel Kedisiplinan Terbaik
              </span>
              <span className="text-[10px] font-bold text-blue-600">Top 5</span>
            </div>
            {analytics.topDisciplinedSubjects.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">Belum ada data mapel.</p>
            ) : (
              <div className="space-y-1.5">
                {analytics.topDisciplinedSubjects.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-blue-100 dark:border-blue-950/60 last:border-0">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate max-w-[170px]">{idx + 1}. {s.subjectName}</span>
                    <span className="font-black text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md text-[10px]">
                      {s.percentage}% ({s.hadir}/{s.total})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
