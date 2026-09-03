import React from "react";
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  HelpCircle, 
  UserCheck, 
  LogOut, 
  LogIn, 
  FileText, 
  Lock,
  Calendar,
  Sparkles
} from "lucide-react";
import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";
import { getAttendanceStatusDisplay } from "../utils/teacherAttendanceDisplayHelper";

interface TeacherAttendanceTimelineProps {
  history: TeacherTeachingAttendance[];
  teacherName: string;
}

export const TeacherAttendanceTimeline: React.FC<TeacherAttendanceTimelineProps> = ({
  history,
  teacherName
}) => {
  if (!history || history.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
        Belum ada catatan timeline mengajar untuk guru {teacherName}.
      </div>
    );
  }

  // Group history records by Date
  const groupedByDate: Record<string, TeacherTeachingAttendance[]> = {};
  history.forEach(item => {
    const d = item.date || "Unknown";
    if (!groupedByDate[d]) {
      groupedByDate[d] = [];
    }
    groupedByDate[d].push(item);
  });

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-2xl text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Timeline Kehadiran Mengajar Per JP: <strong className="underline">{teacherName}</strong></span>
        </div>
        <span className="font-bold bg-blue-100 dark:bg-blue-900/60 px-2.5 py-0.5 rounded-lg text-[10px]">
          {history.length} Sesi Terdata
        </span>
      </div>

      <div className="space-y-6">
        {dates.map((dateStr) => {
          const dayItems = groupedByDate[dateStr];
          const firstDay = dayItems[0];
          const dayName = firstDay?.day || "Hari";

          return (
            <div key={dateStr} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-4 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-150 dark:border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="font-extrabold text-xs text-slate-800 dark:text-zinc-100">{dayName}, {dateStr}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-bold uppercase">{dayItems.length} Sesi Mengajar</span>
              </div>

              <div className="relative border-l-2 border-slate-200 dark:border-zinc-800 pl-4 ml-2 space-y-6">
                {dayItems.map((item, idx) => {
                  const checkInStr = item.checkInTime || null;
                  const checkOutStr = item.checkOutTime || null;
                  const duration = item.teachingDurationMinutes || null;

                  // Evaluate JP sequence display
                  const jpLabel = item.jp || `JP ${item.sequence}`;
                  const timeSlot = item.timeSlot || "-";
                  const isSubstitution = item.isSubstitution;
                  const isReplaced = item.isReplaced;
                  const isBelumTerkonfirmasi = item.status === "Belum Terkonfirmasi";
                  const statusDisplay = getAttendanceStatusDisplay(item);

                  return (
                    <div key={item.id || idx} className="relative space-y-2">
                      {/* Timeline Dot */}
                      <span className={`absolute -left-[21px] top-1 flex h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 ${
                        isSubstitution ? "bg-purple-600" :
                        isReplaced ? "bg-orange-500" :
                        statusDisplay.statusLabel.includes("PENDING") ? "bg-amber-500 animate-ping" :
                        statusDisplay.isLate ? "bg-amber-500" :
                        statusDisplay.hadirJpValue === 1 ? "bg-emerald-500" :
                        "bg-rose-500"
                      }`} />

                      <div className={`p-3.5 rounded-2xl border space-y-3 ${
                        isSubstitution ? "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40" :
                        isReplaced ? "bg-orange-50/40 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40" :
                        "bg-slate-50 dark:bg-zinc-850 border-slate-200 dark:border-zinc-750"
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 dark:border-zinc-700/60 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-md">
                                {jpLabel} ({timeSlot})
                              </span>
                              {isSubstitution && (
                                <span className="text-[10px] font-black uppercase text-purple-700 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-md border border-purple-300 dark:border-purple-800">
                                  Menggantikan Guru Lain
                                </span>
                              )}
                              {isReplaced && (
                                <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-100 dark:bg-orange-950 px-2 py-0.5 rounded-md border border-orange-300 dark:border-orange-800">
                                  Digantikan Guru Pengganti
                                </span>
                              )}
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 mt-1">
                              {item.subjectName} &bull; Kelas {item.className}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border w-fit ${statusDisplay.badgeFullClass}`}>
                              {statusDisplay.statusLabel}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-800">
                              Hadir: {statusDisplay.hadirJpText}
                            </span>
                          </div>
                        </div>

                        {/* Substitution Relationship Callout */}
                        {isSubstitution && (
                          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-800/60 text-xs text-purple-950 dark:text-purple-200 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-purple-900 dark:text-purple-100">
                              <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                              <span>Sesi Menggantikan Guru Asal: <strong>{item.originalTeacherName || "Guru"}</strong></span>
                            </div>
                            <p className="text-[10px] text-purple-700 dark:text-purple-300">
                              JP ini masuk ke <strong>Menggantikan (JP)</strong> dan <strong>Total JP</strong>, tidak mengubah JML JP jadwal asli guru pengganti.
                            </p>
                          </div>
                        )}

                        {isReplaced && (
                          <div className="p-2.5 bg-orange-50 dark:bg-orange-950/40 rounded-xl border border-orange-200 dark:border-orange-800/60 text-xs text-orange-950 dark:text-orange-200 space-y-1">
                            <div className="font-bold flex items-center gap-1.5 text-orange-900 dark:text-orange-100">
                              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                              <span>Sesi Digantikan Oleh: <strong>{item.substituteTeacherName || "Guru Pengganti"}</strong></span>
                            </div>
                            <p className="text-[10px] text-orange-700 dark:text-orange-300">
                              JP ini tetap dihitung dalam <strong>JML JP</strong> guru asal, namun tidak dihitung dalam <strong>Kehadiran (JP)</strong> atau <strong>Total JP</strong>.
                            </p>
                          </div>
                        )}

                        {/* Progression steps (Check-in & Check-out events) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {/* Step 1: Check-In */}
                          <div className={`p-2.5 rounded-xl border ${
                            checkInStr 
                              ? "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700" 
                              : "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800"
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-700 dark:text-zinc-200 mb-1">
                              <LogIn className="w-3.5 h-3.5 text-blue-600" />
                              <span>1. Check-In Sesi</span>
                            </div>
                            {checkInStr ? (
                              <div className="space-y-0.5 text-[11px]">
                                <div className="font-extrabold text-blue-700 dark:text-blue-300">{checkInStr} WIB</div>
                                <div className="text-[10px] text-slate-400">Metode: {item.checkInType || "Scan QR"}</div>
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                  <span>🟢 Status JP Awal: HADIR</span>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-rose-600 font-medium">
                                Belum Check-in / Sesi Tanpa Kehadiran
                              </div>
                            )}
                          </div>

                          {/* Step 2: Check-Out */}
                          <div className={`p-2.5 rounded-xl border ${
                            checkOutStr 
                              ? "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700" 
                              : isBelumTerkonfirmasi 
                              ? "bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800/60"
                              : "bg-slate-100 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700"
                          }`}>
                            <div className="flex items-center gap-1.5 font-bold text-[11px] text-slate-700 dark:text-zinc-200 mb-1">
                              <LogOut className="w-3.5 h-3.5 text-amber-600" />
                              <span>2. Check-Out / Konfirmasi JP</span>
                            </div>
                            {checkOutStr ? (
                              <div className="space-y-0.5 text-[11px]">
                                <div className="font-extrabold text-emerald-700 dark:text-emerald-300">{checkOutStr} WIB</div>
                                {duration && <div className="text-[10px] text-slate-400">Durasi: {duration} Menit</div>}
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                                  <span>🟢 Seluruh JP Dikonfirmasi Selesai</span>
                                </div>
                              </div>
                            ) : checkInStr ? (
                              <div className="space-y-0.5 text-[10px] text-amber-800 dark:text-amber-300 font-semibold">
                                <div>Check-out: <strong>Belum dilakukan</strong></div>
                                <div>Durasi: <strong className="text-indigo-600 dark:text-indigo-400">Sedang Mengajar</strong></div>
                                <div className="text-[9px] text-amber-600 font-normal mt-1">Lakukan scan QR kelas setelah KBM selesai</div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-slate-400">
                                Belum ada catatan Check-out
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Notes / Wakakur Audit Note if any */}
                        {item.notes && (
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 italic bg-white dark:bg-zinc-900 p-2 rounded-xl border border-slate-150 dark:border-zinc-800 flex items-center gap-1.5">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>Catatan: {item.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
