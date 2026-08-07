import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { teacherHalaqahAttendanceService, getTodayDateStr } from "../services/teacherHalaqahAttendance.service";
import { halaqahGroupService } from "../services/halaqahGroupService";
import { teacherService } from "../services/teacherService";
import { AcademicYear, Semester } from "../types";
import { Loading } from "./Loading";
import { Dialog } from "./Dialog";
import { 
  BookOpen, 
  Calendar, 
  Filter, 
  Search, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  UserX, 
  Users, 
  BarChart2, 
  CalendarDays, 
  RefreshCw,
  Eye,
  X,
  Sparkles,
  ChevronRight,
  UserCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

interface Props {
  selectedAyId: string;
  selectedSemesterId: string;
  academicYears: AcademicYear[];
  semesters: Semester[];
}

export const HalaqahAttendanceRecapSection: React.FC<Props> = ({
  selectedAyId,
  selectedSemesterId,
  academicYears,
  semesters
}) => {
  const { user } = useAuth();

  const isWakakurOrAdmin = user && (
    user.role === "admin" || 
    user.role === "wakil kepala sekolah" || 
    user.role === "kepala sekolah" ||
    user.role === "pimpinan" ||
    user.role === "ketua yayasan" ||
    user.role === "operator" ||
    (user.roles && (
      user.roles.includes("admin") || 
      user.roles.includes("wakil kepala sekolah") || 
      user.roles.includes("kepala sekolah") || 
      user.roles.includes("pimpinan") || 
      user.roles.includes("ketua yayasan") || 
      user.roles.includes("wakakur")
    ))
  );

  // Default Date Range: 1st of current month to today
  const todayStr = getTodayDateStr();
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  }, []);

  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Filters
  const [teacherFilter, setTeacherFilter] = useState<string>("ALL");
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"harian" | "guru">("harian");

  // Modal Drilldown
  const [detailTeacher, setDetailTeacher] = useState<{ teacherId: string; teacherName: string } | null>(null);

  // Master Data Queries
  const { data: groups = [] } = useQuery({
    queryKey: ["halaqahGroups"],
    queryFn: () => halaqahGroupService.getGroups()
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => teacherService.getTeachers()
  });

  // Query Recap Data from teacherHalaqahAttendanceService
  const { data: recapData, isLoading, refetch } = useQuery({
    queryKey: ["halaqahAttendanceRecap", startDate, endDate, selectedAyId, selectedSemesterId],
    queryFn: () => teacherHalaqahAttendanceService.getHalaqahAttendanceRecap({
      startDate,
      endDate,
      academicYearId: selectedAyId,
      semesterId: selectedSemesterId
    })
  });

  // Filtered Daily Records
  const filteredDailyRecords = useMemo(() => {
    if (!recapData?.records) return [];

    let records = [...recapData.records];

    // RBAC: Non-admin/non-wakakur can only see their own records
    if (!isWakakurOrAdmin && user) {
      const uName = (user.displayName || user.name || "").toLowerCase().trim();
      records = records.filter(r => 
        r.teacherId === user.uid || 
        r.teacherId === user.id || 
        (r.teacherName && r.teacherName.toLowerCase().trim() === uName)
      );
    } else if (teacherFilter !== "ALL") {
      records = records.filter(r => r.teacherId === teacherFilter || r.teacherName === teacherFilter);
    }

    if (groupFilter !== "ALL") {
      records = records.filter(r => r.groupId === groupFilter || r.groupName === groupFilter);
    }

    if (statusFilter !== "ALL") {
      records = records.filter(r => r.status?.toLowerCase().includes(statusFilter.toLowerCase()));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      records = records.filter(r => 
        r.teacherName.toLowerCase().includes(q) ||
        r.groupName.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        r.dayName?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q)
      );
    }

    return records;
  }, [recapData, isWakakurOrAdmin, user, teacherFilter, groupFilter, statusFilter, searchQuery]);

  // Filtered Teacher Summaries
  const filteredTeacherSummaries = useMemo(() => {
    if (!recapData?.summaries) return [];

    let summaries = [...recapData.summaries];

    // RBAC Lock
    if (!isWakakurOrAdmin && user) {
      const uName = (user.displayName || user.name || "").toLowerCase().trim();
      summaries = summaries.filter(s => 
        s.teacherId === user.uid || 
        s.teacherId === user.id || 
        s.teacherName.toLowerCase().trim() === uName
      );
    } else if (teacherFilter !== "ALL") {
      summaries = summaries.filter(s => s.teacherId === teacherFilter || s.teacherName === teacherFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      summaries = summaries.filter(s => s.teacherName.toLowerCase().includes(q));
    }

    return summaries;
  }, [recapData, isWakakurOrAdmin, user, teacherFilter, searchQuery]);

  // Teacher Drilldown Records
  const drilldownRecords = useMemo(() => {
    if (!detailTeacher || !recapData?.records) return [];
    return recapData.records.filter(r => 
      r.teacherId === detailTeacher.teacherId || 
      r.teacherName === detailTeacher.teacherName
    );
  }, [detailTeacher, recapData]);

  // Export Excel
  const handleExportExcel = () => {
    if (viewMode === "harian") {
      const data = filteredDailyRecords.map((r, idx) => ({
        No: idx + 1,
        Tanggal: r.date,
        Hari: r.dayName || "-",
        "Guru Pembimbing": r.teacherName,
        "Group Halaqah": r.groupName,
        Jadwal: `${r.startTime || "06:00"} - ${r.endTime || "07:30"} WIB`,
        "Jam Check-In": r.checkInTime || "-",
        "Jam Check-Out": r.checkOutTime || "-",
        "Durasi (Menit)": r.duration || 0,
        "Status Kehadiran": r.status || "-",
        Keterangan: r.isExpectedMissing ? "Sesi Belum Diabsen (Tidak Hadir)" : "Tercatat di Attendance Engine"
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap_Harian_Halaqah");
      XLSX.writeFile(workbook, `Rekap_Absensi_Halaqah_${startDate}_s.d_${endDate}.xlsx`);
    } else {
      const data = filteredTeacherSummaries.map((s, idx) => ({
        No: idx + 1,
        "Nama Guru Pembimbing": s.teacherName,
        "Total Jadwal Expected": s.totalExpected,
        "Sesi Terlaksana (Actual)": s.totalActual,
        "Tepat Waktu": s.tepatWaktu,
        Terlambat: s.terlambat,
        Susulan: s.susulan,
        "Tidak Hadir": s.tidakHadir,
        "Belum Check-Out": s.belumCheckOut,
        "Persentase Kehadiran (%)": `${s.percentage}%`
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap_Guru_Halaqah");
      XLSX.writeFile(workbook, `Rekap_Per_Guru_Halaqah_${startDate}_s.d_${endDate}.xlsx`);
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text("REKAP ABSENSI GURU HALAQAH QUR'AN - SMP ALKARIM RASYID", 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${startDate} s/d ${endDate} | T.A: ${academicYears.find(y => y.id === selectedAyId)?.name || "-"} - Sem: ${semesters.find(s => s.id === selectedSemesterId)?.name || "-"}`, 14, 22);

    let startY = 32;

    if (viewMode === "harian") {
      doc.setFontSize(9);
      doc.text("No | Tanggal | Guru | Group | Jadwal | Check-In | Check-Out | Status", 14, startY);
      doc.line(14, startY + 2, 280, startY + 2);
      startY += 8;

      filteredDailyRecords.forEach((r, idx) => {
        if (startY > 185) {
          doc.addPage();
          startY = 15;
        }
        const line = `${idx + 1}.  ${r.date} (${r.dayName})  |  ${r.teacherName}  |  ${r.groupName}  |  ${r.startTime || "06:00"}-${r.endTime || "07:30"}  |  ${r.checkInTime}  |  ${r.checkOutTime}  |  ${r.status}`;
        doc.text(line, 14, startY);
        startY += 6;
      });

      doc.save(`Rekap_Harian_Halaqah_${startDate}_s.d_${endDate}.pdf`);
    } else {
      doc.setFontSize(9);
      doc.text("No | Nama Guru | Target Sesi | Hadir | Terlambat | Susulan | Tidak Hadir | Persentase", 14, startY);
      doc.line(14, startY + 2, 280, startY + 2);
      startY += 8;

      filteredTeacherSummaries.forEach((s, idx) => {
        if (startY > 185) {
          doc.addPage();
          startY = 15;
        }
        const line = `${idx + 1}.  ${s.teacherName}  |  ${s.totalExpected} Sesi  |  ${s.hadir}  |  ${s.terlambat}  |  ${s.susulan}  |  ${s.tidakHadir}  |  ${s.percentage}%`;
        doc.text(line, 14, startY);
        startY += 6;
      });

      doc.save(`Rekap_Per_Guru_Halaqah_${startDate}_s.d_${endDate}.pdf`);
    }
  };

  const overall = recapData?.overallStats;

  return (
    <div className="space-y-6">
      {/* Top Banner Agenda Rutin */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-emerald-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-md text-xs font-semibold tracking-wide border border-emerald-400/30 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Agenda Rutin Pondok
            </span>
            <span className="px-2.5 py-1 bg-teal-500/20 text-teal-300 rounded-md text-xs font-semibold tracking-wide border border-teal-400/30">
              Absensi Bimbingan Halaqah Qur'an
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Rekapitilasi Absensi Guru Pembimbing Halaqah
          </h2>
          <p className="text-xs text-emerald-100/80 max-w-2xl">
            Monitoring pelaksanaan kegiatan Halaqah Qur'an rutin. Data dihitung berdasarkan Target Sesi (Expected) vs Sesi Terlaksana (Actual) berbasis QR Attendance Engine.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-teal-300" />
            Muat Ulang
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Stats Cards (Expected vs Actual) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Target Sesi (Expected)</span>
            <CalendarDays className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-zinc-100">{overall?.totalExpected || 0}</div>
          <p className="text-[10px] text-slate-500">Total Sesi Wajib Hari Efektif</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Sesi Terlaksana (Actual)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{overall?.totalActual || 0}</div>
          <p className="text-[10px] text-slate-500">Memiliki Catatan Absensi</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tepat Waktu</span>
            <Clock className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-black text-teal-600 dark:text-teal-400">{overall?.totalHadir || 0}</div>
          <p className="text-[10px] text-slate-500">Check-in Sesuai Jam</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Terlambat</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{overall?.totalTerlambat || 0}</div>
          <p className="text-[10px] text-slate-500">Check-in Lewat Toleransi</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tidak Hadir (Kosong)</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{overall?.totalTidakHadir || 0}</div>
          <p className="text-[10px] text-slate-500">Belum Melakukan Scan</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-wider">% Kehadiran</span>
            <BarChart2 className="w-4 h-4 text-emerald-200" />
          </div>
          <div className="text-2xl font-black text-white">{overall?.attendancePercentage || 0}%</div>
          <p className="text-[10px] text-emerald-100/80">(Total Hadir / Expected) x 100%</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          {/* Sub Tab View Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("harian")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "harian"
                  ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Rekap Harian Sesi
            </button>
            <button
              onClick={() => setViewMode("guru")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === "guru"
                  ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Ringkasan Per Guru
            </button>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari guru / group / status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Filter inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Mulai Tanggal</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold text-slate-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Sampai Tanggal</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold text-slate-800 dark:text-zinc-100"
            />
          </div>

          {isWakakurOrAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Guru Pembimbing</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
              >
                <option value="ALL">Semua Guru Pembimbing</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Group Halaqah</label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
            >
              <option value="ALL">Semua Group Halaqah</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>{g.groupName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Status Kehadiran</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold text-slate-800 dark:text-zinc-100 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="Tepat Waktu">Tepat Waktu</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Susulan">Susulan</option>
              <option value="Belum Check-out">Belum Check-out</option>
              <option value="Tidak Hadir">Tidak Hadir (Kosong)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
          <Loading size="lg" text="Memuat rekapitulasi absensi halaqah..." />
        </div>
      ) : viewMode === "harian" ? (
        /* REKAP HARIAN TABLE */
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Tabel Absensi Harian Halaqah ({filteredDailyRecords.length} Catatan Sesi)
              </h3>
            </div>
            <span className="text-xs text-slate-500">Rentang: {startDate} s/d {endDate}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Tanggal / Hari</th>
                  <th className="px-4 py-3">Guru Pembimbing</th>
                  <th className="px-4 py-3">Group Halaqah</th>
                  <th className="px-4 py-3">Jadwal Mulai - Selesai</th>
                  <th className="px-4 py-3">Check-In</th>
                  <th className="px-4 py-3">Check-Out</th>
                  <th className="px-4 py-3">Durasi</th>
                  <th className="px-4 py-3">Status Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredDailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data absensi halaqah yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredDailyRecords.map((r, idx) => {
                    const isMissing = r.isExpectedMissing;
                    const isCompleted = !!r.checkOutTime;

                    return (
                      <tr key={r.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800 dark:text-zinc-200">
                          <div>{r.date}</div>
                          <span className="text-[10px] text-slate-400 font-normal">{r.dayName}</span>
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-zinc-100">
                          {r.teacherName}
                        </td>
                        <td className="px-4 py-3 font-medium text-emerald-700 dark:text-emerald-400">
                          {r.groupName}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-zinc-300 font-mono">
                          {r.startTime || "06:00"} - {r.endTime || "07:30"} WIB
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {r.checkInTime || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-zinc-200">
                          {r.checkOutTime || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-zinc-300 font-semibold">
                          {r.duration ? `${r.duration} mnt` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isMissing
                              ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
                              : isCompleted
                                ? r.status === "Terlambat"
                                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 animate-pulse"
                          }`}>
                            {isMissing ? (
                              <>
                                <UserX className="w-3 h-3" />
                                Tidak Hadir (Kosong)
                              </>
                            ) : isCompleted ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                {r.status || "Hadir / Selesai"}
                              </>
                            ) : (
                              <>
                                <Clock className="w-3 h-3" />
                                Belum Check-out
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* REKAP PER GURU SUMMARY TABLE */
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                Ringkasan Kehadiran Per Guru Pembimbing ({filteredTeacherSummaries.length} Guru)
              </h3>
            </div>
            <span className="text-xs text-slate-500">Target Sesi vs Sesi Terlaksana</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3">Nama Guru Pembimbing</th>
                  <th className="px-4 py-3 text-center">Total Jadwal (Expected)</th>
                  <th className="px-4 py-3 text-center">Hadir (Selesai)</th>
                  <th className="px-4 py-3 text-center">Terlambat</th>
                  <th className="px-4 py-3 text-center">Susulan</th>
                  <th className="px-4 py-3 text-center">Tidak Hadir</th>
                  <th className="px-4 py-3 text-center">Belum Check-Out</th>
                  <th className="px-4 py-3 text-center">Persentase Kehadiran</th>
                  <th className="px-4 py-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredTeacherSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      Tidak ada data guru pembimbing yang sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredTeacherSummaries.map((s, idx) => (
                    <tr key={s.teacherId || idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-zinc-100">
                        {s.teacherName}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-zinc-300">
                        {s.totalExpected} Sesi
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {s.hadir}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-600 dark:text-amber-400">
                        {s.terlambat}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-purple-600 dark:text-purple-400">
                        {s.susulan}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-rose-600 dark:text-rose-400">
                        {s.tidakHadir}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {s.belumCheckOut}
                      </td>
                      <td className="px-4 py-3 text-center font-black">
                        <span className={`px-2.5 py-1 rounded-full text-xs ${
                          s.percentage >= 90
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : s.percentage >= 75
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        }`}>
                          {s.percentage}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setDetailTeacher({ teacherId: s.teacherId, teacherName: s.teacherName })}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-all flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Drilldown
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DRILLDOWN MODAL */}
      <Dialog
        isOpen={!!detailTeacher}
        onClose={() => setDetailTeacher(null)}
        title={`Detail Absensi Halaqah: ${detailTeacher?.teacherName}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200">
            <span className="font-bold">Periode:</span> {startDate} s/d {endDate} | <span className="font-bold">Total Sesi Recorded:</span> {drilldownRecords.length}
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-zinc-800 sticky top-0 font-bold text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2">Group</th>
                  <th className="px-3 py-2">Jadwal</th>
                  <th className="px-3 py-2">Check-in</th>
                  <th className="px-3 py-2">Check-out</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {drilldownRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-slate-400">Tidak ada riwayat.</td>
                  </tr>
                ) : (
                  drilldownRecords.map((dr, idx) => (
                    <tr key={dr.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td className="px-3 py-2 font-medium">{dr.date} ({dr.dayName})</td>
                      <td className="px-3 py-2 font-bold text-emerald-600">{dr.groupName}</td>
                      <td className="px-3 py-2 font-mono">{dr.startTime || "06:00"} - {dr.endTime || "07:30"}</td>
                      <td className="px-3 py-2 font-mono">{dr.checkInTime || "-"}</td>
                      <td className="px-3 py-2 font-mono">{dr.checkOutTime || "-"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          dr.isExpectedMissing
                            ? "bg-rose-100 text-rose-700"
                            : dr.checkOutTime
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700"
                        }`}>
                          {dr.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setDetailTeacher(null)}
              className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-800 dark:text-zinc-100 rounded-xl text-xs font-semibold"
            >
              Tutup
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
