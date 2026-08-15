import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { eRaporService } from "../services/eRapor.service";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { scheduleService } from "../services/schedule.service";
import {
  ERaporLegerEntry,
  ERaporLegerSemesterColumn,
  ERaporHistoricalAssessment
} from "../types/eRapor.types";
import { Class, Subject, Student } from "../types";
import { getSubjectGroupType, isSubjectReportVisible } from "../utils/subjectHelper";
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  Search,
  Printer,
  Download,
  PlusCircle,
  FileSpreadsheet,
  UserCheck,
  History,
  Info,
  ChevronRight,
  Eye,
  Edit3,
  RefreshCw,
  ShieldAlert,
  Award,
  Layers
} from "lucide-react";

export default function ERaporLegerPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Master & Selector state
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("ALL");
  const [subjectTypeFilter, setSubjectTypeFilter] = useState<"ALL" | "UMUM" | "PONDOK">("ALL");
  const [selectedSeqFilter, setSelectedSeqFilter] = useState<number | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Role permissions
  const [teacherAllowedSubjectIds, setTeacherAllowedSubjectIds] = useState<string[] | null>(null);
  const isWaliKelas = user?.role === "guru" && !!user?.assignedClassId;
  const isAdminOrPimpinan = ["admin", "kepala sekolah", "wakil kepala sekolah", "operator", "ketua yayasan"].includes(user?.role || "");
  const isPureGuru = user?.role === "guru" && !isWaliKelas;

  // Data state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [legerEntries, setLegerEntries] = useState<ERaporLegerEntry[]>([]);
  const [legerColumns, setLegerColumns] = useState<ERaporLegerSemesterColumn[]>([]);
  const [legerStats, setLegerStats] = useState<{
    totalStudents: number;
    totalSubjects: number;
    totalEntries: number;
    completePercentage: number;
    semesterCompleteness: { [seq: number]: number };
  }>({
    totalStudents: 0,
    totalSubjects: 0,
    totalEntries: 0,
    completePercentage: 0,
    semesterCompleteness: {}
  });

  // Modal states
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState<boolean>(false);
  const [historicalFormData, setHistoricalFormData] = useState<{
    studentId: string;
    subjectId: string;
    semesterSequence: number;
    score: string;
    reason: string;
  }>({
    studentId: "",
    subjectId: "",
    semesterSequence: 1,
    score: "",
    reason: ""
  });
  const [isSavingHistorical, setIsSavingHistorical] = useState<boolean>(false);

  // Student Detail Modal
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState<string | null>(null);

  // Print Preview Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Load Initial Master Data
  useEffect(() => {
    async function initMasterData() {
      try {
        setIsLoading(true);
        const [classList, subjectList] = await Promise.all([
          classService.getClasses(),
          subjectService.getSubjects()
        ]);

        const activeClasses = classList.filter(c => c.status === "Aktif" && !c.isDeleted);
        setClasses(activeClasses);
        setSubjects(subjectList);

        // Determine initial selected class
        let initialClassId = activeClasses[0]?.classId || "";
        if (user?.assignedClassId) {
          const found = activeClasses.find(c => c.classId === user.assignedClassId || c.name === user.assignedClassId);
          if (found) initialClassId = found.classId;
        }
        setSelectedClassId(initialClassId);

        // Determine Teacher Allowed Subjects if Pure Guru Mapel
        if (isPureGuru && user?.id) {
          const schedules = await scheduleService.getSchedules();
          const tSchedules = schedules.filter(s => s.teacherId === user.id);
          const schedSubIds = tSchedules.map(s => s.subjectId);

          const directSubIds = subjectList
            .filter(sub => sub.teacherId === user.id)
            .map(sub => sub.id);

          const combined = Array.from(new Set([...schedSubIds, ...directSubIds]));
          setTeacherAllowedSubjectIds(combined);

          if (combined.length > 0) {
            setSelectedSubjectId(combined[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load Leger master data:", err);
        toast("Gagal memuat data kelas dan mata pelajaran.", "error");
      } finally {
        setIsLoading(false);
      }
    }
    initMasterData();
  }, [user]);

  // Load Leger Data whenever class, allowed subjects, or filter changes
  const loadLegerData = async () => {
    if (!selectedClassId) return;
    try {
      setIsLoading(true);

      // Construct subject filter list
      let allowedIds: string[] | undefined = undefined;
      if (isPureGuru && teacherAllowedSubjectIds) {
        allowedIds = teacherAllowedSubjectIds;
      } else if (selectedSubjectId !== "ALL") {
        allowedIds = [selectedSubjectId];
      }

      const res = await eRaporService.getLegerData({
        classId: selectedClassId,
        allowedSubjectIds: allowedIds,
        subjectTypeFilter
      });

      setLegerEntries(res.entries);
      setLegerColumns(res.columns);
      setLegerStats(res.stats);
    } catch (err) {
      console.error("Failed to fetch Leger data:", err);
      toast("Gagal memuat histori Leger nilai.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLegerData();
  }, [selectedClassId, selectedSubjectId, subjectTypeFilter, teacherAllowedSubjectIds]);

  // Filtered Leger entries based on search query
  const filteredEntries = useMemo(() => {
    return legerEntries.filter(entry => {
      const matchSearch =
        entry.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.studentNis && entry.studentNis.includes(searchQuery)) ||
        entry.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [legerEntries, searchQuery]);

  // Current selected class object
  const currentClassObject = classes.find(c => c.classId === selectedClassId || c.name === selectedClassId);

  // Grouped entries by Student for Student View / Print
  const studentGroupedEntries = useMemo(() => {
    const map = new Map<string, { studentName: string; studentNis?: string; entries: ERaporLegerEntry[] }>();
    filteredEntries.forEach(entry => {
      if (!map.has(entry.studentId)) {
        map.set(entry.studentId, {
          studentName: entry.studentName,
          studentNis: entry.studentNis,
          entries: []
        });
      }
      map.get(entry.studentId)!.entries.push(entry);
    });
    return Array.from(map.values());
  }, [filteredEntries]);

  // Single student detail data for modal
  const activeStudentDetail = useMemo(() => {
    if (!selectedStudentForDetail) return null;
    const studentEntries = legerEntries.filter(e => e.studentId === selectedStudentForDetail);
    if (studentEntries.length === 0) return null;
    return {
      studentId: selectedStudentForDetail,
      studentName: studentEntries[0].studentName,
      studentNis: studentEntries[0].studentNis,
      studentNisn: studentEntries[0].studentNisn,
      entries: studentEntries
    };
  }, [selectedStudentForDetail, legerEntries]);

  // Submit Historical Grade Entry
  const handleSaveHistorical = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!historicalFormData.studentId) {
      toast("Pilih siswa terlebih dahulu!", "error");
      return;
    }
    if (!historicalFormData.subjectId) {
      toast("Pilih mata pelajaran terlebih dahulu!", "error");
      return;
    }
    const scoreNum = parseFloat(historicalFormData.score);
    if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
      toast("Masukkan nilai antara 0 dan 100!", "error");
      return;
    }

    setIsSavingHistorical(true);
    try {
      const st = legerEntries.find(e => e.studentId === historicalFormData.studentId);
      const sb = subjects.find(s => s.id === historicalFormData.subjectId);
      const col = legerColumns.find(c => c.sequence === historicalFormData.semesterSequence);

      await eRaporService.saveHistoricalAssessment(
        {
          academicYearId: col?.academicYearId,
          semesterId: col?.semesterId,
          semesterSequence: historicalFormData.semesterSequence,
          classId: selectedClassId,
          className: currentClassObject?.name || selectedClassId,
          subjectId: historicalFormData.subjectId,
          subjectName: sb?.name || "",
          studentId: historicalFormData.studentId,
          studentName: st?.studentName || "",
          score: scoreNum
        },
        user?.id || "system",
        user?.name || "User",
        historicalFormData.reason
      );

      toast("Nilai historis berhasil disimpan!", "success");
      setIsHistoricalModalOpen(false);
      setHistoricalFormData({
        studentId: "",
        subjectId: "",
        semesterSequence: 1,
        score: "",
        reason: ""
      });
      await loadLegerData();
    } catch (err: any) {
      console.error("Error saving historical assessment:", err);
      toast(err.message || "Gagal menyimpan nilai historis.", "error");
    } finally {
      setIsSavingHistorical(false);
    }
  };

  // Open Historical Entry Modal with prefilled row
  const openHistoricalForEntry = (studentId: string, subjectId: string, seq: number, currentScore?: number | null) => {
    setHistoricalFormData({
      studentId,
      subjectId,
      semesterSequence: seq,
      score: currentScore !== null && currentScore !== undefined ? String(currentScore) : "",
      reason: "Pengisian Nilai Historis e-Rapor"
    });
    setIsHistoricalModalOpen(true);
  };

  // Export Leger to Excel/CSV
  const handleExportExcel = () => {
    if (filteredEntries.length === 0) {
      toast("Tidak ada data Leger untuk diexport.", "error");
      return;
    }

    const headers = ["No", "NIS", "Nama Siswa", "Mata Pelajaran", "Kelompok Mapel"];
    legerColumns.forEach(col => {
      headers.push(`${col.label} (${col.subLabel || ''})`);
    });
    headers.push("Rata-rata");

    const rows: string[][] = [];
    filteredEntries.forEach((entry, idx) => {
      const displayType = entry.subjectType === "PONDOK" || entry.subjectType === "KEPESANTRENAN" ? "KEPESANTRENAN" : "UMUM";
      const row: string[] = [
        String(idx + 1),
        entry.studentNis || "-",
        `"${entry.studentName.replace(/"/g, '""')}"`,
        `"${entry.subjectName.replace(/"/g, '""')}"`,
        displayType
      ];

      let sum = 0;
      let count = 0;
      legerColumns.forEach(col => {
        const item = entry.semesterScores[col.sequence];
        if (item && item.score !== null) {
          row.push(String(item.score));
          sum += item.score;
          count++;
        } else {
          row.push("-");
        }
      });

      const avg = count > 0 ? (sum / count).toFixed(1) : "-";
      row.push(avg);
      rows.push(row);
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const classNameClean = (currentClassObject?.name || "Kelas").replace(/\s+/g, "_");
    link.setAttribute("download", `Leger_Nilai_${classNameClean}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast("File Leger berhasil didownload!", "success");
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Top Banner / Title */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl shadow-md">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              Leger Nilai e-Rapor
              <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Multi-Semester
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Rekapitulasi histori perkembangan nilai siswa sepanjang jenjang SMP Alkarim Rasyid.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsHistoricalModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl transition-all flex items-center gap-2"
          >
            <History className="w-4 h-4" />
            Input Nilai Historis
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 rounded-xl transition-all flex items-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Export Excel
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Cetak Leger
          </button>
        </div>
      </div>

      {/* Role Banner Info */}
      {isPureGuru && (
        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl flex items-start gap-3 text-xs text-indigo-900 dark:text-indigo-200">
          <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Akses Leger Guru Mata Pelajaran:</span> Menampilkan khusus mata pelajaran yang Anda ampu berdasarkan penugasan mengajar. Anda tidak dapat melihat nilai mata pelajaran lain demi privasi dan keamanan data e-Rapor.
          </div>
        </div>
      )}

      {isWaliKelas && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Akses Wali Kelas ({currentClassObject?.name}):</span> Anda memiliki wewenang untuk memantau seluruh mata pelajaran yang diikuti oleh siswa dalam kelas Anda. Anda juga dapat menginput nilai historis semester terdahulu, namun nilai resmi e-Rapor semester aktif milik Guru Mapel terlindungi dari perubahan langsung.
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Pilih Kelas */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
              Pilih Kelas
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={isWaliKelas && !!user?.assignedClassId}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100 disabled:opacity-80"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.classId}>
                  Kelas {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Pilih Mapel (if not restricted pure guru) */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
              Mata Pelajaran
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100"
            >
              {!isPureGuru && <option value="ALL">Semua Mata Pelajaran</option>}
              {subjects
                .filter(sub => {
                  if (isPureGuru && teacherAllowedSubjectIds) {
                    if (!teacherAllowedSubjectIds.includes(sub.id)) return false;
                  }
                  if (!isSubjectReportVisible(sub)) return false;
                  const grp = getSubjectGroupType(sub);
                  if (subjectTypeFilter === "UMUM" && grp !== "UMUM") return false;
                  if (subjectTypeFilter === "PONDOK" && grp !== "KEPESANTRENAN") return false;
                  return true;
                })
                .map((sub) => {
                  const grpType = getSubjectGroupType(sub);
                  return (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({grpType})
                    </option>
                  );
                })}
            </select>
          </div>

          {/* 3. Jenis Mapel Tabs */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
              Klasifikasi Kurikulum
            </label>
            <select
              value={subjectTypeFilter}
              onChange={(e) => setSubjectTypeFilter(e.target.value as any)}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100"
            >
              <option value="ALL">Semua (Umum & Kepesantrenan)</option>
              <option value="UMUM">Mata Pelajaran UMUM saja</option>
              <option value="PONDOK">Mata Pelajaran KEPESANTRENAN saja</option>
            </select>
          </div>

          {/* 4. Filter Semester View */}
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 block mb-1">
              Filter Semester
            </label>
            <select
              value={selectedSeqFilter}
              onChange={(e) => setSelectedSeqFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100"
            >
              <option value="ALL">Semua Semester (Matriks Leger)</option>
              {legerColumns.map((col) => (
                <option key={col.sequence} value={col.sequence}>
                  {col.label} ({col.subLabel || ''})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative pt-2">
          <Search className="w-4 h-4 absolute left-3 top-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan nama siswa, NIS, atau nama mata pelajaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold">Total Siswa Kelas</p>
            <p className="text-lg font-extrabold text-slate-800 dark:text-zinc-100">{legerStats.totalStudents} Siswa</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold">Mapel Terdata</p>
            <p className="text-lg font-extrabold text-slate-800 dark:text-zinc-100">{legerStats.totalSubjects} Mapel</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold">Kelengkapan Leger</p>
            <p className="text-lg font-extrabold text-slate-800 dark:text-zinc-100">{legerStats.completePercentage}%</p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold">Jumlah Semester</p>
            <p className="text-lg font-extrabold text-slate-800 dark:text-zinc-100">{legerColumns.length} Semester</p>
          </div>
        </div>
      </div>

      {/* Semester Completeness Breakdown */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-2">
        <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          Status Kelengkapan Nilai per Semester
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
          {legerColumns.map((col) => {
            const pct = legerStats.semesterCompleteness[col.sequence] || 0;
            const isFull = pct === 100;
            const isPartial = pct > 0 && pct < 100;
            return (
              <div
                key={col.sequence}
                className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                  isFull
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : isPartial
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400"
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>{col.label}</span>
                  {isFull ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : isPartial ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <div className="mt-1 flex items-baseline justify-between text-xs font-extrabold">
                  <span>{pct}%</span>
                  <span className="text-[10px] font-normal opacity-80">{col.subLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leger Table View */}
      {isLoading ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 border border-slate-200 dark:border-zinc-800 text-center text-slate-500 dark:text-zinc-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
          Memuat matriks Leger Nilai...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-12 border border-slate-200 dark:border-zinc-800 text-center space-y-3">
          <Info className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">Tidak ada data Leger ditemukan.</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Pastikan siswa dan mata pelajaran sudah terdaftar pada kelas yang dipilih, atau coba sesuaikan filter pencarian.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
              Matriks Leger Kelas {currentClassObject?.name || selectedClassId}
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal">
                ({filteredEntries.length} Baris Data)
              </span>
            </h3>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> e-Rapor Resmi
              </span>
              <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Nilai Historis
              </span>
              <span className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-zinc-700"></span> Belum Diisi
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-zinc-300">
                  <th className="p-3 w-10 text-center">No</th>
                  <th className="p-3 min-w-[160px]">Nama Siswa</th>
                  <th className="p-3 min-w-[150px]">Mata Pelajaran</th>
                  <th className="p-3 w-28 text-center">Jenis</th>

                  {legerColumns
                    .filter(col => selectedSeqFilter === "ALL" || selectedSeqFilter === col.sequence)
                    .map((col) => (
                      <th key={col.sequence} className="p-3 text-center min-w-[90px] border-l border-slate-200 dark:border-zinc-800">
                        <div>{col.label}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{col.subLabel}</div>
                      </th>
                    ))}

                  <th className="p-3 text-center w-20 border-l border-slate-200 dark:border-zinc-800">Rata2</th>
                  <th className="p-3 text-center w-20">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {filteredEntries.map((entry, index) => {
                  // Compute average
                  let totalScore = 0;
                  let filledCount = 0;

                  legerColumns.forEach(col => {
                    const item = entry.semesterScores[col.sequence];
                    if (item && item.score !== null) {
                      totalScore += item.score;
                      filledCount++;
                    }
                  });

                  const avgScore = filledCount > 0 ? (totalScore / filledCount).toFixed(1) : "—";

                  return (
                    <tr
                      key={`${entry.studentId}_${entry.subjectId}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="p-3 text-center text-slate-500 font-medium">{index + 1}</td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-zinc-100">
                        <div>{entry.studentName}</div>
                        <div className="text-[10px] text-slate-400 font-normal">NIS: {entry.studentNis || "—"}</div>
                      </td>
                      <td className="p-3 text-slate-700 dark:text-zinc-300 font-medium">
                        {entry.subjectName}
                        <span className="text-[10px] text-slate-400 block font-normal">{entry.subjectGroup}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                            entry.subjectType === "PONDOK"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {entry.subjectType === "PONDOK" ? "Pesantren" : "Umum"}
                        </span>
                      </td>

                      {/* Semester Scores */}
                      {legerColumns
                        .filter(col => selectedSeqFilter === "ALL" || selectedSeqFilter === col.sequence)
                        .map((col) => {
                          const item = entry.semesterScores[col.sequence];
                          const hasScore = item && item.score !== null;
                          const isERapor = item?.source === "ERAPOR";
                          const isHist = item?.source === "HISTORICAL";

                          return (
                            <td
                              key={col.sequence}
                              onClick={() => openHistoricalForEntry(entry.studentId, entry.subjectId, col.sequence, item?.score)}
                              className="p-3 text-center border-l border-slate-200 dark:border-zinc-800 cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group"
                              title="Klik untuk menginput/mengedit nilai historis"
                            >
                              {hasScore ? (
                                <div className="inline-flex flex-col items-center">
                                  <span
                                    className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                      isERapor
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                    }`}
                                  >
                                    {item.score}
                                  </span>
                                  <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isERapor ? "e-Rapor" : "Historis"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 dark:text-zinc-600 font-bold group-hover:text-emerald-600">
                                  —
                                </span>
                              )}
                            </td>
                          );
                        })}

                      <td className="p-3 text-center font-extrabold text-slate-800 dark:text-zinc-100 border-l border-slate-200 dark:border-zinc-800">
                        {avgScore}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedStudentForDetail(entry.studentId)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-lg transition-all"
                          title="Lihat Riwayat Nilai Siswa"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Input Nilai Historis */}
      {isHistoricalModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                Input Nilai Historis Leger
              </h3>
              <button
                onClick={() => setIsHistoricalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveHistorical} className="space-y-4 text-xs">
              {/* Siswa */}
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Pilih Siswa <span className="text-rose-500">*</span>
                </label>
                <select
                  value={historicalFormData.studentId}
                  onChange={(e) => setHistoricalFormData({ ...historicalFormData, studentId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  required
                >
                  <option value="">-- Pilih Siswa --</option>
                  {studentGroupedEntries.map(s => (
                    <option key={s.entries[0].studentId} value={s.entries[0].studentId}>
                      {s.studentName} (NIS: {s.studentNis || "—"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mapel */}
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Mata Pelajaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={historicalFormData.subjectId}
                  onChange={(e) => setHistoricalFormData({ ...historicalFormData, subjectId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  required
                >
                  <option value="">-- Pilih Mata Pelajaran --</option>
                  {subjects
                    .filter(sub => {
                      if (isPureGuru && teacherAllowedSubjectIds) {
                        return teacherAllowedSubjectIds.includes(sub.id);
                      }
                      return true;
                    })
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.group || "Umum"})
                      </option>
                    ))}
                </select>
              </div>

              {/* Semester Sequence */}
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Semester Target <span className="text-rose-500">*</span>
                </label>
                <select
                  value={historicalFormData.semesterSequence}
                  onChange={(e) => setHistoricalFormData({ ...historicalFormData, semesterSequence: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  required
                >
                  {legerColumns.map(col => (
                    <option key={col.sequence} value={col.sequence}>
                      {col.label} ({col.subLabel || ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Score */}
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Nilai Rapor Historis (0 - 100) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={historicalFormData.score}
                  onChange={(e) => setHistoricalFormData({ ...historicalFormData, score: e.target.value })}
                  placeholder="Contoh: 85.5"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold"
                  required
                />
              </div>

              {/* Catatan / Alasan */}
              <div>
                <label className="font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Alasan / Catatan
                </label>
                <input
                  type="text"
                  value={historicalFormData.reason}
                  onChange={(e) => setHistoricalFormData({ ...historicalFormData, reason: e.target.value })}
                  placeholder="Contoh: Pengisian nilai sebelum sistem e-Rapor aktif"
                  className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Nilai historis akan diberi penanda <strong className="font-extrabold">HISTORICAL</strong> dan disimpan terpisah dari engine e-Rapor aktif tanpa mengubah perhitungan e-Rapor resmi semester aktif.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsHistoricalModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingHistorical}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
                >
                  {isSavingHistorical ? "Menyimpan..." : "Simpan Nilai Historis"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Detail Riwayat Nilai Siswa */}
      {activeStudentDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-600" />
                  Riwayat Perkembangan Akademik Siswa
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {activeStudentDetail.studentName} (NIS: {activeStudentDetail.studentNis || "—"}) — Kelas {currentClassObject?.name || selectedClassId}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForDetail(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-800 font-bold text-slate-700 dark:text-zinc-300">
                    <th className="p-3">Mata Pelajaran</th>
                    <th className="p-3 w-24">Jenis</th>
                    {legerColumns.map(col => (
                      <th key={col.sequence} className="p-3 text-center w-20 border-l border-slate-200 dark:border-zinc-800">
                        {col.label}
                      </th>
                    ))}
                    <th className="p-3 text-center w-20 border-l border-slate-200 dark:border-zinc-800">Rata2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {activeStudentDetail.entries.map(entry => {
                    let total = 0;
                    let count = 0;

                    legerColumns.forEach(col => {
                      const item = entry.semesterScores[col.sequence];
                      if (item && item.score !== null) {
                        total += item.score;
                        count++;
                      }
                    });

                    const avg = count > 0 ? (total / count).toFixed(1) : "—";

                    return (
                      <tr key={entry.subjectId} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="p-3 font-semibold text-slate-800 dark:text-zinc-200">
                          {entry.subjectName}
                        </td>
                        <td className="p-3 text-slate-500">
                          {entry.subjectType === "PONDOK" ? "Pesantren" : "Umum"}
                        </td>

                        {legerColumns.map(col => {
                          const item = entry.semesterScores[col.sequence];
                          const hasScore = item && item.score !== null;
                          const isERapor = item?.source === "ERAPOR";

                          return (
                            <td key={col.sequence} className="p-3 text-center border-l border-slate-200 dark:border-zinc-800">
                              {hasScore ? (
                                <span
                                  className={`px-2 py-0.5 rounded font-bold ${
                                    isERapor
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                  }`}
                                >
                                  {item.score}
                                </span>
                              ) : (
                                <span className="text-slate-300 dark:text-zinc-600">—</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-3 text-center font-extrabold text-slate-800 dark:text-zinc-100 border-l border-slate-200 dark:border-zinc-800">
                          {avg}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => setSelectedStudentForDetail(null)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Cetak Leger Preview Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-600" />
                  Cetak Leger Nilai Rapor Kelas {currentClassObject?.name || selectedClassId}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Format Siap Cetak (Landscape) — SIMAK SMP Alkarim Rasyid Solok
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Cetak Sekarang
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="p-6 bg-white text-slate-900 rounded-xl border border-slate-200 space-y-4 font-sans print:p-0 print:border-none">
              {/* Header Kop */}
              <div className="text-center border-b-2 border-slate-800 pb-3 space-y-1">
                <h2 className="text-base font-extrabold uppercase tracking-wide">LEGER NILAI E-RAPOR KURIKULUM MERDEKA</h2>
                <h3 className="text-sm font-bold uppercase">SMP ALKARIM RASYID SOLOK</h3>
                <p className="text-xs text-slate-600">
                  Kelas: {currentClassObject?.name || selectedClassId} | Tahun Ajaran & Historical Multi-Semester
                </p>
              </div>

              {/* Table */}
              <table className="w-full text-left text-[11px] border-collapse border border-slate-800">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-800">
                    <th className="p-2 border-r border-slate-800 text-center w-8">No</th>
                    <th className="p-2 border-r border-slate-800">NIS</th>
                    <th className="p-2 border-r border-slate-800">Nama Siswa</th>
                    <th className="p-2 border-r border-slate-800">Mata Pelajaran</th>
                    {legerColumns.map(col => (
                      <th key={col.sequence} className="p-2 border-r border-slate-800 text-center">
                        {col.label}
                      </th>
                    ))}
                    <th className="p-2 text-center w-16">Rata-rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredEntries.map((entry, idx) => {
                    let sum = 0;
                    let count = 0;

                    legerColumns.forEach(col => {
                      const item = entry.semesterScores[col.sequence];
                      if (item && item.score !== null) {
                        sum += item.score;
                        count++;
                      }
                    });

                    const avg = count > 0 ? (sum / count).toFixed(1) : "—";

                    return (
                      <tr key={`${entry.studentId}_${entry.subjectId}_print`}>
                        <td className="p-1.5 text-center border-r border-slate-800">{idx + 1}</td>
                        <td className="p-1.5 border-r border-slate-800">{entry.studentNis || "—"}</td>
                        <td className="p-1.5 border-r border-slate-800 font-semibold">{entry.studentName}</td>
                        <td className="p-1.5 border-r border-slate-800">{entry.subjectName}</td>
                        {legerColumns.map(col => {
                          const item = entry.semesterScores[col.sequence];
                          return (
                            <td key={col.sequence} className="p-1.5 text-center border-r border-slate-800">
                              {item?.score !== null && item?.score !== undefined ? item.score : "—"}
                            </td>
                          );
                        })}
                        <td className="p-1.5 text-center font-bold">{avg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-8 flex justify-between text-xs font-semibold">
                <div className="text-center">
                  <p>Mengetahui,</p>
                  <p>Kepala SMP Alkarim Rasyid</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline">H. Abdullah, M.Pd.</p>
                </div>
                <div className="text-center">
                  <p>Solok, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <p>Wali Kelas {currentClassObject?.name || selectedClassId}</p>
                  <div className="h-16"></div>
                  <p className="font-bold underline">{user?.name || "Wali Kelas"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
