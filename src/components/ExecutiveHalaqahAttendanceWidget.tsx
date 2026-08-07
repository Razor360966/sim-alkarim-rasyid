import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  BookOpen, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  TrendingUp, 
  ChevronRight, 
  X, 
  RefreshCw,
  Search,
  Filter
} from "lucide-react";
import { teacherHalaqahAttendanceService, getTodayDateStr } from "../services/teacherHalaqahAttendance.service";
import { HalaqahAttendanceWidgetStats } from "../types/halaqahAttendance.types";

interface ExecutiveHalaqahAttendanceWidgetProps {
  academicYearId?: string;
  semesterId?: string;
}

export const ExecutiveHalaqahAttendanceWidget: React.FC<ExecutiveHalaqahAttendanceWidgetProps> = ({
  academicYearId,
  semesterId
}) => {
  const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const todayStr = getTodayDateStr();

  const { data: stats, isLoading, refetch } = useQuery<HalaqahAttendanceWidgetStats>({
    queryKey: ["halaqahWidgetStats", todayStr, academicYearId, semesterId],
    queryFn: () => teacherHalaqahAttendanceService.getHalaqahWidgetStats(todayStr, academicYearId, semesterId),
    refetchInterval: 30000 // Refresh every 30s for live monitoring
  });

  const totalTeachers = stats?.totalTeachers || 0;
  const alreadyCheckedIn = stats?.alreadyCheckedIn || 0;
  const currentlyMentoring = stats?.currentlyMentoring || 0;
  const alreadyCheckedOut = stats?.alreadyCheckedOut || 0;
  const notYetAttended = stats?.notYetAttended || 0;
  const pct = stats?.attendancePercentage || 0;
  const records = stats?.records || [];

  const filteredRecords = records.filter(r => 
    (r.teacherName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.groupName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      {/* Widget Box */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-5 hover:shadow-md transition-all">
        {/* Widget Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-850 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-2xl border border-teal-200/50 dark:border-teal-900/50">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-850 dark:text-white text-base">
                  Kehadiran Halaqah Hari Ini
                </h3>
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold text-[10px] rounded-full border border-emerald-200 dark:border-emerald-800">
                  Real-time
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoring presensi pembimbing halaqah Qur'an berbasis QR Code permanen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              title="Refresh Presensi"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsDrilldownOpen(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <span>Lihat Detail</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Jumlah Pembimbing */}
          <div className="bg-slate-50 dark:bg-zinc-950/50 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-850">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Jumlah Pembimbing
            </p>
            <h4 className="text-lg font-black text-slate-800 dark:text-white mt-1">
              {totalTeachers} <span className="text-xs font-normal text-slate-400">Guru</span>
            </h4>
          </div>

          {/* 2. Sudah Check In */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Sudah Check In
            </p>
            <h4 className="text-lg font-black text-emerald-800 dark:text-emerald-300 mt-1">
              {alreadyCheckedIn} <span className="text-xs font-normal opacity-70">Guru</span>
            </h4>
          </div>

          {/* 3. Sedang Membimbing */}
          <div className="bg-blue-50/60 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
              Sedang Membimbing
            </p>
            <h4 className="text-lg font-black text-blue-800 dark:text-blue-300 mt-1">
              {currentlyMentoring} <span className="text-xs font-normal opacity-70">Sesi</span>
            </h4>
          </div>

          {/* 4. Sudah Check Out */}
          <div className="bg-teal-50/60 dark:bg-teal-950/20 p-3.5 rounded-2xl border border-teal-100 dark:border-teal-900/30">
            <p className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
              Sudah Check Out
            </p>
            <h4 className="text-lg font-black text-teal-800 dark:text-teal-300 mt-1">
              {alreadyCheckedOut} <span className="text-xs font-normal opacity-70">Guru</span>
            </h4>
          </div>

          {/* 5. Belum Hadir */}
          <div className="bg-rose-50/60 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-100 dark:border-rose-900/30">
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Belum Hadir
            </p>
            <h4 className="text-lg font-black text-rose-800 dark:text-rose-300 mt-1">
              {notYetAttended} <span className="text-xs font-normal opacity-70">Guru</span>
            </h4>
          </div>

          {/* 6. Persentase Kehadiran */}
          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              % Kehadiran
            </p>
            <h4 className="text-lg font-black text-indigo-800 dark:text-indigo-300 mt-1">
              {pct}%
            </h4>
          </div>
        </div>
      </div>

      {/* Drilldown Modal */}
      {isDrilldownOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-teal-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Detail Presensi Halaqah Qur'an</h3>
                  <p className="text-xs text-teal-200">
                    Daftar kehadiran guru pembimbing halaqah tanggal {todayStr}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDrilldownOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter / Search Bar */}
            <div className="p-4 border-b border-slate-100 dark:border-zinc-850 flex items-center gap-3 bg-slate-50 dark:bg-zinc-950/40">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama guru atau group halaqah..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Table Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Memuat data presensi halaqah...
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  Belum ada log presensi halaqah untuk pencarian ini hari ini.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 uppercase text-[10px] font-bold">
                        <th className="py-3 px-3">Nama Guru</th>
                        <th className="py-3 px-3">Group Halaqah</th>
                        <th className="py-3 px-3">Check In</th>
                        <th className="py-3 px-3">Check Out</th>
                        <th className="py-3 px-3">Durasi</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                      {filteredRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/50 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-800 dark:text-white">
                            {r.teacherName || "Guru Pembimbing"}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-1 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 font-bold rounded-lg border border-teal-200 dark:border-teal-800">
                              {r.groupName}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                            {r.checkInTime ? `${r.checkInTime} WIB` : "-"}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                            {r.checkOutTime ? `${r.checkOutTime} WIB` : "-"}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-700 dark:text-zinc-300">
                            {r.duration ? `${r.duration} Menit` : "-"}
                          </td>
                          <td className="py-3 px-3">
                            {r.status === "Selesai Membimbing" || r.checkOutTime ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                Selesai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                <Clock className="w-3 h-3 animate-spin" />
                                Sedang Membimbing
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
