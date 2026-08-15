import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { eRaporService } from "../services/eRapor.service";
import { AcademicYear, Semester } from "../types";
import { ERaporExecutiveDrilldownItem } from "../types/eRapor.types";
import {
  BarChart3,
  Users,
  BookOpen,
  DoorClosed,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  PieChart,
  ShieldAlert,
  ArrowRight
} from "lucide-react";

export default function ERaporExecutiveDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  const [monitoringData, setMonitoringData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function loadFilters() {
      try {
        const [years, sems] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters()
        ]);
        setAcademicYears(years);
        setSemesters(sems);

        const activeYr = years.find((y) => y.isActive) || years[0];
        const activeSem = sems.find((s) => s.isActive) || sems[0];

        if (activeYr) setSelectedAcademicYearId(activeYr.id!);
        if (activeSem) setSelectedSemesterId(activeSem.id!);
      } catch (e) {
        console.error("Error loading executive filters:", e);
      }
    }
    loadFilters();
  }, []);

  useEffect(() => {
    async function fetchExecutiveStats() {
      if (!selectedAcademicYearId || !selectedSemesterId) return;
      setIsLoading(true);
      try {
        const res = await eRaporService.getExecutiveMonitoringData(
          selectedAcademicYearId,
          selectedSemesterId
        );
        setMonitoringData(res);
      } catch (e) {
        console.error("Error fetching executive data:", e);
        toast("Gagal memuat statistik e-Rapor.", "error");
      } finally {
        setIsLoading(false);
      }
    }
    fetchExecutiveStats();
  }, [selectedAcademicYearId, selectedSemesterId]);

  const summary = monitoringData?.summary;
  const drilldown: ERaporExecutiveDrilldownItem[] = monitoringData?.drilldownItems || [];

  const filteredDrilldown = drilldown.filter(
    (item) =>
      item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.className.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
              e-Rapor – Executive Monitoring & Audit Dashboard
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Pantau progres input nilai seluruh guru, mata pelajaran, dan rombel secara real-time.
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Tahun Ajaran
          </label>
          <select
            value={selectedAcademicYearId}
            onChange={(e) => setSelectedAcademicYearId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year} {y.isActive ? "(Aktif)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Semester
          </label>
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {semesters
              .filter((s) => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || `Semester ${s.code}`} {s.isActive ? "(Aktif)" : ""}
                </option>
              ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
          <p className="text-xs">Mengkalkulasi statistik e-Rapor...</p>
        </div>
      ) : summary ? (
        <>
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Guru Tuntas</span>
                <Users className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">
                {summary.completedTeachers} / {summary.totalTeachers}
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${summary.totalTeachers > 0 ? (summary.completedTeachers / summary.totalTeachers) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Mapel Tuntas</span>
                <BookOpen className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">
                {summary.completedSubjects} / {summary.totalSubjects}
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${summary.totalSubjects > 0 ? (summary.completedSubjects / summary.totalSubjects) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Kelas Tuntas</span>
                <DoorClosed className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">
                {summary.completedClasses} / {summary.totalClasses}
              </div>
              <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{
                    width: `${summary.totalClasses > 0 ? (summary.completedClasses / summary.totalClasses) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">Total Nilai Populated</span>
                <PieChart className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {summary.overallPercentage}%
              </div>
              <p className="text-[10px] text-slate-400">
                TP ({summary.tpPercentage}%) | UTS ({summary.utsPercentage}%) | SAS ({summary.sasPercentage}%)
              </p>
            </div>
          </div>

          {/* Drilldown Section */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-500" /> Rincian Guru & Mapel Belum Tuntas ({drilldown.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Gunakan data ini untuk memberikan pengingat langsung kepada guru pengampu.
                </p>
              </div>

              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama guru / mapel..."
                  className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>
            </div>

            {filteredDrilldown.length === 0 ? (
              <div className="p-8 text-center text-emerald-600 dark:text-emerald-400 space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto" />
                <p className="text-sm font-bold">Seluruh Guru & Mata Pelajaran Telah Tuntas!</p>
                <p className="text-xs text-slate-500">Nilai e-Rapor semester ini sudah 100% lengkap.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                      <th className="p-3 w-10 text-center font-bold">No</th>
                      <th className="p-3 font-bold">Guru Pengampu</th>
                      <th className="p-3 font-bold">Mata Pelajaran</th>
                      <th className="p-3 font-bold">Kelas</th>
                      <th className="p-3 font-bold">Bagian Belum Terisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                    {filteredDrilldown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                        <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-zinc-100">{item.teacherName}</td>
                        <td className="p-3 text-slate-700 dark:text-zinc-300">{item.subjectName}</td>
                        <td className="p-3 font-semibold text-emerald-600">{item.className}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {item.missingParts.map((part, pIdx) => (
                              <span
                                key={pIdx}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              >
                                {part}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
