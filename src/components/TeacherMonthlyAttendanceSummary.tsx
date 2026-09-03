import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";
import { getAttendanceStatusDisplay } from "../utils/teacherAttendanceDisplayHelper";
import { 
  Calendar, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ArrowRightLeft, 
  XCircle, 
  Layers, 
  ChevronRight, 
  Eye, 
  X, 
  Download,
  CalendarDays,
  Sparkles,
  BookOpen
} from "lucide-react";

interface MonthlyStats {
  monthKey: string; // e.g. "2024-07"
  monthName: string; // e.g. "Juli 2024"
  jmlJp: number; // Kehadiran + Digantikan + Tidak Hadir
  kehadiran: number; // Sesi Hadir (termasuk Terlambat)
  menggantikan: number; // Sesi di mana guru ini menggantikan guru lain
  terlambat: number; // Informasi keterlambatan JP (TIDAK MENGURANGI KEHADIRAN)
  digantikan: number; // Sesi di mana guru berhalangan & digantikan
  tidakHadir: number; // Sesi alpa / tidak hadir
  totalJp: number; // Kehadiran + Menggantikan
  records: TeacherTeachingAttendance[];
}

interface Props {
  teacherId: string;
  teacherName?: string;
  academicYearId?: string;
  semesterId?: string;
}

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export const TeacherMonthlyAttendanceSummary: React.FC<Props> = ({
  teacherId,
  teacherName,
  academicYearId,
  semesterId
}) => {
  const [loading, setLoading] = useState(true);
  const [attendances, setAttendances] = useState<TeacherTeachingAttendance[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthlyStats | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!teacherId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const colRef = collection(db, "teacher_teaching_attendances");
        
        // Fetch attendances for primary teacher OR as substitute teacher
        const [snapPrimary, snapSub] = await Promise.all([
          getDocs(query(colRef, where("teacherId", "==", teacherId))),
          getDocs(query(colRef, where("substituteTeacherId", "==", teacherId)))
        ]);

        const map = new Map<string, TeacherTeachingAttendance>();
        snapPrimary.forEach(doc => {
          map.set(doc.id, { id: doc.id, ...doc.data() } as TeacherTeachingAttendance);
        });
        snapSub.forEach(doc => {
          map.set(doc.id, { id: doc.id, ...doc.data() } as TeacherTeachingAttendance);
        });

        const list = Array.from(map.values()).filter(item => {
          if (academicYearId && item.academicYearId && item.academicYearId !== academicYearId) return false;
          if (semesterId && item.semesterId && item.semesterId !== semesterId) return false;
          return true;
        });

        setAttendances(list);
      } catch (err) {
        console.error("Error fetching teacher monthly attendances:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [teacherId, academicYearId, semesterId]);

  // Group and calculate statistics per month
  const monthlyData: MonthlyStats[] = useMemo(() => {
    const monthGroups: Record<string, TeacherTeachingAttendance[]> = {};

    attendances.forEach(item => {
      const dateStr = item.date || "";
      if (!dateStr || dateStr.length < 7) return;
      const monthKey = dateStr.substring(0, 7); // "YYYY-MM"
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = [];
      }
      monthGroups[monthKey].push(item);
    });

    const keys = Object.keys(monthGroups).sort();
    return keys.map(mKey => {
      const [yStr, mStr] = mKey.split("-");
      const monthIdx = parseInt(mStr, 10) - 1;
      const monthName = `${MONTH_NAMES_ID[monthIdx] || mStr} ${yStr}`;
      const items = monthGroups[mKey];

      let kehadiran = 0;
      let menggantikan = 0;
      let terlambat = 0;
      let digantikan = 0;
      let tidakHadir = 0;

      items.forEach(it => {
        const isSelf = it.teacherId === teacherId;
        const isSub = it.substituteTeacherId === teacherId;

        if (isSelf) {
          if (it.status === "Digantikan Guru Lain") {
            digantikan += 1;
          } else if (it.status === "Tidak Hadir") {
            tidakHadir += 1;
          } else if (it.status === "Hadir Mengajar" || it.status === "Terlambat" || it.checkInTime) {
            kehadiran += 1;
            if (it.status === "Terlambat") {
              terlambat += 1; // Terlambat hanya informasi keterlambatan, tidak mengurangi Kehadiran
            }
          } else if (it.status === "Izin" || it.status === "Sakit" || it.status === "Tugas Dinas") {
            // Sesi berhalangan yang tidak digantikan
            tidakHadir += 1;
          }
        }

        if (isSub && !isSelf) {
          menggantikan += 1;
        }
      });

      // Sesuai Aturan Sistem:
      // JML JP = Kehadiran + Digantikan + Tidak Hadir
      // Total JP = Kehadiran + Menggantikan
      const jmlJp = kehadiran + digantikan + tidakHadir;
      const totalJp = kehadiran + menggantikan;

      return {
        monthKey: mKey,
        monthName,
        jmlJp,
        kehadiran,
        menggantikan,
        terlambat,
        digantikan,
        tidakHadir,
        totalJp,
        records: items.sort((a, b) => (a.date || "").localeCompare(b.date || ""))
      };
    });
  }, [attendances, teacherId]);

  // Total summary across all months
  const overallSummary = useMemo(() => {
    return monthlyData.reduce(
      (acc, m) => ({
        jmlJp: acc.jmlJp + m.jmlJp,
        kehadiran: acc.kehadiran + m.kehadiran,
        menggantikan: acc.menggantikan + m.menggantikan,
        terlambat: acc.terlambat + m.terlambat,
        digantikan: acc.digantikan + m.digantikan,
        tidakHadir: acc.tidakHadir + m.tidakHadir,
        totalJp: acc.totalJp + m.totalJp
      }),
      { jmlJp: 0, kehadiran: 0, menggantikan: 0, terlambat: 0, digantikan: 0, tidakHadir: 0, totalJp: 0 }
    );
  }, [monthlyData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200 dark:border-zinc-800 animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded w-1/3"></div>
        <div className="h-24 bg-slate-100 dark:bg-zinc-800/50 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Rekap Kehadiran Mengajar Saya (Per Bulan)
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Akumulasi jam pelajaran (JP) mengajar, kehadiran, penggantian, dan rincian sesi per bulan.
          </p>
        </div>

        {/* Global Stats Pill */}
        <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 px-3.5 py-1.5 rounded-2xl">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Total Diakui:</span>
          <span className="text-sm font-extrabold text-emerald-800 dark:text-emerald-200 font-mono">
            {overallSummary.totalJp} JP
          </span>
        </div>
      </div>

      {/* Rules Information Box */}
      <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-200/60 dark:border-zinc-700/60 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-zinc-300 gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-zinc-200">Formula Jam:</span>
          <span>JML JP = Kehadiran + Digantikan + Tidak Hadir</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-zinc-200">Total JP Efektif:</span>
          <span>Kehadiran + Menggantikan</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-zinc-400 italic">
          *Terlambat hanya indikasi waktu, tidak mengurangi status Kehadiran.
        </div>
      </div>

      {/* Monthly Table / List */}
      {monthlyData.length === 0 ? (
        <div className="text-center py-10 bg-slate-50 dark:bg-zinc-850/50 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
          <Clock className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">Belum Ada Catatan Absensi</p>
          <p className="text-xs text-slate-400 mt-1">Data absensi mengajar akan muncul secara otomatis setelah Anda melakukan check-in mengajar.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-150 dark:border-zinc-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100/80 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-700">
              <tr>
                <th className="px-4 py-3">Bulan</th>
                <th className="px-3 py-3 text-center" title="Jadwal Asli Guru (Kehadiran + Digantikan + Tidak Hadir)">JML JP</th>
                <th className="px-3 py-3 text-center text-emerald-700 dark:text-emerald-400">Kehadiran</th>
                <th className="px-3 py-3 text-center text-blue-700 dark:text-blue-400">Menggantikan</th>
                <th className="px-3 py-3 text-center text-amber-700 dark:text-amber-400" title="Informasi Keterlambatan">Terlambat (JP)</th>
                <th className="px-3 py-3 text-center text-purple-700 dark:text-purple-400">Digantikan</th>
                <th className="px-3 py-3 text-center text-rose-700 dark:text-rose-400">Tidak Hadir</th>
                <th className="px-3 py-3 text-center text-indigo-700 dark:text-indigo-400 font-bold" title="Kehadiran + Menggantikan">Total JP</th>
                <th className="px-4 py-3 text-center">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-medium text-slate-700 dark:text-zinc-300">
              {monthlyData.map((m) => (
                <tr key={m.monthKey} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{m.monthName}</span>
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-semibold text-slate-600 dark:text-zinc-400">
                    {m.jmlJp}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20">
                    {m.kehadiran}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                    {m.menggantikan > 0 ? `+${m.menggantikan}` : "0"}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {m.terlambat}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-semibold text-purple-600 dark:text-purple-400">
                    {m.digantikan}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-semibold text-rose-600 dark:text-rose-400">
                    {m.tidakHadir}
                  </td>
                  <td className="px-3 py-3.5 text-center font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/30 text-sm">
                    {m.totalJp}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button
                      onClick={() => setSelectedMonth(m)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Total Row */}
            <tfoot className="bg-slate-50 dark:bg-zinc-850 font-black text-slate-800 dark:text-zinc-100 border-t-2 border-slate-200 dark:border-zinc-700">
              <tr>
                <td className="px-4 py-3 text-xs uppercase tracking-wider">Total Akumulasi</td>
                <td className="px-3 py-3 text-center font-mono text-xs">{overallSummary.jmlJp}</td>
                <td className="px-3 py-3 text-center font-mono text-emerald-600 dark:text-emerald-400 text-xs">{overallSummary.kehadiran}</td>
                <td className="px-3 py-3 text-center font-mono text-blue-600 dark:text-blue-400 text-xs">+{overallSummary.menggantikan}</td>
                <td className="px-3 py-3 text-center font-mono text-amber-600 dark:text-amber-400 text-xs">{overallSummary.terlambat}</td>
                <td className="px-3 py-3 text-center font-mono text-purple-600 dark:text-purple-400 text-xs">{overallSummary.digantikan}</td>
                <td className="px-3 py-3 text-center font-mono text-rose-600 dark:text-rose-400 text-xs">{overallSummary.tidakHadir}</td>
                <td className="px-3 py-3 text-center font-mono text-indigo-700 dark:text-indigo-300 text-sm">{overallSummary.totalJp}</td>
                <td className="px-4 py-3 text-center text-[10px] text-slate-400">-</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Drill-down Modal for Month Detail */}
      {selectedMonth && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-200 dark:border-zinc-800 shadow-2xl animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 dark:text-zinc-100">
                    Rincian Kehadiran Sesi Mengajar – {selectedMonth.monthName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Total {selectedMonth.records.length} sesi mengajar tercatat pada bulan ini.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMonth(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Stats Bar */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-850/60 border-b border-slate-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Kehadiran</span>
                <p className="text-sm font-mono font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{selectedMonth.kehadiran} JP</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Menggantikan</span>
                <p className="text-sm font-mono font-extrabold text-blue-600 dark:text-blue-400 mt-0.5">{selectedMonth.menggantikan} JP</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Terlambat</span>
                <p className="text-sm font-mono font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{selectedMonth.terlambat} JP</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Total Jam Diakui</span>
                <p className="text-sm font-mono font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{selectedMonth.totalJp} JP</p>
              </div>
            </div>

            {/* Modal Body: Scrollable Session Records */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {selectedMonth.records.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Tidak ada catatan sesi pada bulan ini.</p>
              ) : (
                <div className="space-y-2">
                  {selectedMonth.records.map((rec, idx) => {
                    const isSelf = rec.teacherId === teacherId;
                    const isSub = rec.substituteTeacherId === teacherId;
                    const statusDisplay = getAttendanceStatusDisplay(rec);

                    return (
                      <div
                        key={rec.id || idx}
                        className="p-3.5 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-150 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 dark:text-zinc-100">
                              {rec.date} ({rec.day || "Hari"})
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200">
                              {rec.jp || `JP ${rec.sequence || 1}`}
                            </span>
                            {isSub && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                Menggantikan: {rec.teacherName}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 dark:text-zinc-300 font-medium">
                            <span className="font-bold text-slate-700 dark:text-zinc-200">{rec.subjectName}</span> – Kelas {rec.className} {rec.timeSlot ? `(${rec.timeSlot})` : ""}
                          </p>
                          {rec.notes && (
                            <p className="text-[11px] text-slate-400 italic">Catatan: {rec.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                            {rec.checkInTime ? <div>In: {rec.checkInTime}</div> : <div>In: -</div>}
                            {rec.checkOutTime ? <div>Out: {rec.checkOutTime}</div> : <div>Out: -</div>}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border ${statusDisplay.badgeFullClass}`}>
                              {statusDisplay.statusLabel}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                              Hadir: {statusDisplay.hadirJpText}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedMonth(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
