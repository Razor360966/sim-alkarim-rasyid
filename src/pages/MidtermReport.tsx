import React, { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useSchoolIdentity } from "../contexts/SchoolIdentityContext";
import { academicYearService } from "../services/academicYear.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { midtermReportService } from "../services/midtermReport.service";
import { eRaporService } from "../services/eRapor.service";
import {
  MidtermReportType,
  MidtermReportContext,
  MidtermReportSubject,
  MidtermReportStudent,
  MidtermReportScore,
  MidtermPrintSettings
} from "../types/midtermReport.types";
import { AcademicYear, Semester, Class } from "../types";
import { ERaporSettingsConfig } from "../types/eRapor.types";
import { AppConfig } from "../config/appConfig";
import { homeroomService } from "../services/homeroom.service";
import { MidtermStudentReportPrintable } from "../components/MidtermStudentReportPrintable";
import { MidtermPrintSettingsModal } from "../components/MidtermPrintSettingsModal";
import { midtermPrintSettingsService } from "../services/midtermPrintSettings.service";
import {
  FileText,
  Printer,
  Search,
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Layers,
  School,
  Calendar,
  UserCheck,
  RotateCcw,
  HelpCircle,
  X,
  BookOpen,
  Filter,
  Users,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sliders
} from "lucide-react";

export default function MidtermReport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { identity } = useSchoolIdentity();

  // Master Filter State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  // Selected Filter State
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [reportType, setReportType] = useState<MidtermReportType>("TERPADU");

  // Data & Execution State
  const [reportContext, setReportContext] = useState<MidtermReportContext | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State for Per-Student Print Preview & Settings Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [selectedStudentForPrintId, setSelectedStudentForPrintId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<"SINGLE" | "BATCH">("SINGLE");
  const [printConfig, setPrintConfig] = useState<ERaporSettingsConfig | undefined>(undefined);
  const [midtermPrintConfig, setMidtermPrintConfig] = useState<MidtermPrintSettings | undefined>(undefined);

  // Concurrency & Stale Request Guard
  const requestIdRef = useRef<number>(0);

  // Load eRapor print config & dedicated Midterm print settings
  useEffect(() => {
    eRaporService
      .getSettings()
      .then((cfg) => setPrintConfig(cfg))
      .catch((e) => console.warn("Failed to load eRapor settings config for Midterm print:", e));

    midtermPrintSettingsService
      .getPrintSettings()
      .then((cfg) => setMidtermPrintConfig(cfg))
      .catch((e) => console.warn("Failed to load midterm print settings:", e));
  }, []);


  const handleOpenSingleStudentPrint = (studentId: string) => {
    setSelectedStudentForPrintId(studentId);
    setPrintMode("SINGLE");
    setIsPrintModalOpen(true);
  };

  const handleOpenBatchPrint = () => {
    setPrintMode("BATCH");
    setIsPrintModalOpen(true);
  };

  // 1. Initial Master Data Loading
  useEffect(() => {
    let isMounted = true;
    async function loadMasterFilters() {
      try {
        const [yearList, semList, classList] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters(),
          classService.getClasses()
        ]);

        if (!isMounted) return;

        setAcademicYears(yearList);
        setSemesters(semList);

        // Filter active classes (not soft deleted)
        const validClasses = classList.filter((c) => c.status === "Aktif" && !c.isDeleted);
        setClasses(validClasses);

        // Resolve default Academic Year & Semester
        const activeYr = yearList.find((y) => y.isActive) || yearList[0];
        const activeSem = semList.find((s) => s.isActive) || semList[0];

        if (activeYr) setSelectedAcademicYearId(activeYr.id!);
        if (activeSem) setSelectedSemesterId(activeSem.id!);

        // Canonical Homeroom Teacher Verification & Scoping (SIMAK — E-RAPOR MENU RBAC-2)
        const isPrivileged = [
          "admin",
          "operator",
          "kepala sekolah",
          "wakil kepala sekolah",
          "pimpinan",
          "ketua yayasan"
        ].some((r) =>
          (user?.role || "").toLowerCase().includes(r) ||
          (user?.roles || []).some((x) => x.toLowerCase().includes(r))
        );

        if (isPrivileged) {
          setClasses(validClasses);
          if (validClasses.length > 0) {
            setSelectedClassId(validClasses[0].id!);
          }
        } else {
          const assignedClasses = homeroomService.filterAssignedClassesSync(
            user,
            validClasses,
            activeYr
          );
          setClasses(assignedClasses);
          if (assignedClasses.length > 0) {
            setSelectedClassId(assignedClasses[0].id!);
          } else {
            setSelectedClassId("");
          }
        }
      } catch (err) {
        console.error("Error loading master filters for Midterm Report:", err);
        if (isMounted) {
          setError("Gagal memuat data master filter. Silakan muat ulang halaman.");
        }
      }
    }

    loadMasterFilters();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Classes filtered by the selected Academic Year
  const availableClasses = useMemo(() => {
    if (!selectedAcademicYearId) return classes;
    const filtered = classes.filter((c) => !c.academicYearId || c.academicYearId === selectedAcademicYearId);
    return filtered.length > 0 ? filtered : classes;
  }, [classes, selectedAcademicYearId]);

  // Adjust selected class when availableClasses changes
  useEffect(() => {
    if (availableClasses.length > 0) {
      const exists = availableClasses.some((c) => c.id === selectedClassId);
      if (!exists) {
        setSelectedClassId(availableClasses[0].id!);
      }
    }
  }, [availableClasses, selectedClassId]);

  // 2. Fetch Midterm Report Data from Service
  const fetchReportData = async () => {
    if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId) {
      toast("Harap lengkapi pilihan Tahun Ajaran, Semester, dan Kelas.", "warning");
      return;
    }

    const currentReq = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await midtermReportService.getMidtermReportData({
        academicYearId: selectedAcademicYearId,
        semesterId: selectedSemesterId,
        classId: selectedClassId,
        reportType
      });

      // Stale response guard
      if (currentReq === requestIdRef.current) {
        setReportContext(result);
      }
    } catch (err: any) {
      console.error("Error fetching midterm report data:", err);
      if (currentReq === requestIdRef.current) {
        setError("Gagal memuat data Rapor Tengah Semester. Silakan coba lagi.");
        toast("Gagal memuat data Rapor Tengah Semester.", "error");
      }
    } finally {
      if (currentReq === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Auto-fetch whenever filters change
  useEffect(() => {
    if (selectedAcademicYearId && selectedSemesterId && selectedClassId) {
      fetchReportData();
    }
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId, reportType]);

  // Reset Filters to default
  const handleResetFilters = () => {
    const activeYr = academicYears.find((y) => y.isActive) || academicYears[0];
    const activeSem = semesters.find((s) => s.isActive) || semesters[0];
    if (activeYr) setSelectedAcademicYearId(activeYr.id!);
    if (activeSem) setSelectedSemesterId(activeSem.id!);
    if (availableClasses.length > 0) setSelectedClassId(availableClasses[0].id!);
    setReportType("UMUM");
    setSearchQuery("");
  };

  // Active selected metadata labels
  const activeYearObj = useMemo(() => academicYears.find((y) => y.id === selectedAcademicYearId), [academicYears, selectedAcademicYearId]);
  const activeSemObj = useMemo(() => semesters.find((s) => s.id === selectedSemesterId), [semesters, selectedSemesterId]);
  const activeClassObj = useMemo(() => classes.find((c) => c.id === selectedClassId), [classes, selectedClassId]);

  // Filter students based on search query in memory
  const filteredStudents = useMemo(() => {
    if (!reportContext?.students) return [];
    if (!searchQuery.trim()) return reportContext.students;
    const q = searchQuery.toLowerCase().trim();
    return reportContext.students.filter(
      (st) =>
        (st.studentName && st.studentName.toLowerCase().includes(q)) ||
        (st.nis && st.nis.toLowerCase().includes(q)) ||
        (st.nisn && st.nisn.toLowerCase().includes(q))
    );
  }, [reportContext, searchQuery]);

  // Summary Metrics calculated strictly from returned reportContext
  const summaryMetrics = useMemo(() => {
    if (!reportContext) {
      return {
        totalStudents: 0,
        totalSubjects: 0,
        subjectsWithUts: 0,
        subjectsWithoutUts: 0,
        filledScoresCount: 0,
        missingScoresCount: 0,
        totalScoresCount: 0
      };
    }

    const totalStudents = reportContext.students.length;
    const totalSubjects = reportContext.subjects.length;
    const subjectsWithUts = reportContext.subjects.filter((s) => s.hasUts !== false).length;
    const subjectsWithoutUts = reportContext.subjects.filter((s) => s.hasUts === false).length;

    let filledScoresCount = 0;
    let missingScoresCount = 0;
    let totalScoresCount = 0;

    reportContext.students.forEach((st) => {
      st.scores.forEach((sc) => {
        if (sc.status !== "TIDAK_ADA_UTS") {
          totalScoresCount++;
          if (sc.status === "TERISI") {
            filledScoresCount++;
          } else if (sc.status === "BELUM_DIISI") {
            missingScoresCount++;
          }
        }
      });
    });

    return {
      totalStudents,
      totalSubjects,
      subjectsWithUts,
      subjectsWithoutUts,
      filledScoresCount,
      missingScoresCount,
      totalScoresCount
    };
  }, [reportContext]);

  const isPrivilegedUser = [
    "admin",
    "operator",
    "kepala sekolah",
    "wakil kepala sekolah",
    "pimpinan",
    "ketua yayasan"
  ].some((r) =>
    (user?.role || "").toLowerCase().includes(r) ||
    (user?.roles || []).some((x) => x.toLowerCase().includes(r))
  );

  if (!isPrivilegedUser && classes.length === 0 && !isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-8 text-center shadow-lg space-y-4">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
            Akses Terbatas
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            Halaman <strong>Rapor Tengah Semester</strong> hanya dapat diakses oleh Guru yang aktif ditugaskan sebagai Wali Kelas pada tahun pelajaran yang berlaku.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full pb-16">
      {/* 1. Header Identitas Halaman */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <FileText className="w-3.5 h-3.5" />
              <span>RAPOR TENGAH SEMESTER (RAPOR BAYANGAN)</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              {reportType === "TERPADU"
                ? "SMP & PONDOK PESANTREN ALKARIM RASYID"
                : reportType === "UMUM"
                ? "SMP ALKARIM RASYID"
                : "PONDOK PESANTREN ALKARIM RASYID"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {reportType === "TERPADU"
                ? "Rekapitulasi Nilai Asesmen Tengah Semester (UTS/STS) Terpadu: Mata Pelajaran Umum & Kepesantrenan."
                : reportType === "UMUM"
                ? "Rekapitulasi Nilai Asesmen Tengah Semester (UTS/STS) Mata Pelajaran Umum."
                : "Rekapitulasi Nilai Ujian Tengah Semester (UTS) Mata Pelajaran Diniyyah & Kepesantrenan."}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
              title="Atur Tanda Tangan Kepala Sekolah, Cap Sekolah, dan Tanda Tangan Wali Kelas"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pengaturan Cetak RTS</span>
            </button>

            <button
              onClick={fetchReportData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Muat Ulang</span>
            </button>

            {reportContext && reportContext.students.length > 0 && (
              <>
                <button
                  onClick={() => {
                    if (reportContext.students.length > 0) {
                      handleOpenSingleStudentPrint(reportContext.students[0].studentId);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Preview Rapor Siswa</span>
                </button>

                <button
                  onClick={handleOpenBatchPrint}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Semua ({reportContext.students.length} Siswa)</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Info Strip Wali Kelas & Konteks */}
        {activeClassObj && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-600 dark:text-zinc-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tahun Ajaran:</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-100">
                {activeYearObj?.name || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span>Semester:</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-100">
                {activeSemObj?.name || "-"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 text-slate-400" />
              <span>Kelas:</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-100">
                {activeClassObj.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Wali Kelas:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {activeClassObj.homeroomTeacherName || "-"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-300">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>FILTER RAPOR TENGAH SEMESTER</span>
          </div>

          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tahun Ajaran */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              Tahun Ajaran
            </label>
            <select
              value={selectedAcademicYearId}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {academicYears.map((yr) => (
                <option key={yr.id} value={yr.id}>
                  {yr.name} {yr.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Semester */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              Semester
            </label>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {semesters.map((sem) => (
                <option key={sem.id} value={sem.id}>
                  {sem.name} {sem.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Kelas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              Kelas / Rombel
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {availableClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.gradeLevel})
                </option>
              ))}
            </select>
          </div>

          {/* Jenis Rapor (UMUM vs PONDOK) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
              Jenis Rapor
            </label>
            <div className="grid grid-cols-3 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setReportType("TERPADU")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  reportType === "TERPADU"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Rapor Terpadu
              </button>
              <button
                type="button"
                onClick={() => setReportType("UMUM")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  reportType === "UMUM"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Rapor Umum
              </button>
              <button
                type="button"
                onClick={() => setReportType("PONDOK")}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  reportType === "PONDOK"
                    ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                }`}
              >
                Rapor Pondok
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Summary Stat Cards */}
      {reportContext && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
              Jumlah Siswa
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-zinc-50 mt-1 block">
              {summaryMetrics.totalStudents}
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
              Jumlah Mapel
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-zinc-50 mt-1 block">
              {summaryMetrics.totalSubjects}
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
              Mapel Ber-UTS
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {summaryMetrics.subjectsWithUts}
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
              Mapel Tanpa UTS
            </span>
            <span className="text-xl font-bold text-slate-600 dark:text-zinc-400 mt-1 block">
              {summaryMetrics.subjectsWithoutUts}
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
              Nilai Terisi
            </span>
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {summaryMetrics.filledScoresCount}
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-sm">
            <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 block">
              Nilai Belum Diisi
            </span>
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1 block">
              {summaryMetrics.missingScoresCount}
            </span>
          </div>
        </div>
      )}

      {/* 4. Main Content / Score Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
              Daftar Nilai UTS{" "}
              {reportType === "TERPADU"
                ? "Rapor Terpadu (Umum & Diniyah)"
                : reportType === "UMUM"
                ? "Rapor Umum"
                : "Rapor Pondok"}
            </h2>
            {reportContext && (
              <span className="text-xs text-slate-400 dark:text-zinc-500">
                ({filteredStudents.length} dari {reportContext.students.length} siswa)
              </span>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama atau NIS siswa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-16 text-center space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Memuat data rapor tengah semester...
            </p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{error}</p>
            <button
              onClick={fetchReportData}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Empty States */}
        {!isLoading && !error && !reportContext && (
          <div className="p-16 text-center space-y-2">
            <HelpCircle className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Silakan pilih Tahun Ajaran, Semester, Kelas, dan Jenis Rapor untuk menampilkan nilai.
            </p>
          </div>
        )}

        {!isLoading && !error && reportContext && reportContext.subjects.length === 0 && (
          <div className="p-16 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Belum ada mata pelajaran {reportType === "UMUM" ? "Umum" : "Pondok"} yang terjadwal untuk kelas ini.
            </p>
          </div>
        )}

        {!isLoading && !error && reportContext && reportContext.subjects.length > 0 && reportContext.students.length === 0 && (
          <div className="p-16 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Belum ada data siswa aktif pada kelas ini.
            </p>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && reportContext && reportContext.subjects.length > 0 && reportContext.students.length > 0 && (
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                  {/* Sticky Column: No */}
                  <th className="p-3 w-12 text-center font-bold sticky left-0 z-20 bg-slate-50 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    No
                  </th>

                  {/* Sticky Column: NIS */}
                  <th className="p-3 w-24 text-center font-bold sticky left-12 z-20 bg-slate-50 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    NIS
                  </th>

                  {/* Sticky Column: Nama Siswa */}
                  <th className="p-3 min-w-[200px] font-bold sticky left-36 z-20 bg-slate-50 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-800 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.1)]">
                    Nama Siswa
                  </th>

                  {/* Action Column: Cetak Rapor Per Siswa */}
                  <th className="p-3 w-28 text-center font-bold border-r border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800">
                    Aksi
                  </th>

                  {/* Dynamic Subject Columns */}
                  {reportContext.subjects.map((subj) => (
                    <th
                      key={subj.subjectId}
                      className="p-3 min-w-[140px] text-center font-bold border-r border-slate-200/80 dark:border-zinc-800"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className="font-bold text-slate-800 dark:text-zinc-100 line-clamp-2 max-w-[160px] text-center leading-tight"
                          title={subj.subjectCode ? `${subj.subjectName} (${subj.subjectCode})` : (subj.subjectName || "-")}
                        >
                          {subj.subjectName || subj.subjectCode || "-"}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-normal">
                          {reportType === "TERPADU" && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                subj.subjectType === "UMUM"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              }`}
                            >
                              {subj.subjectType === "UMUM" ? "Umum" : "Diniyah"}
                            </span>
                          )}
                          {subj.group && <span>Kel. {subj.group}</span>}
                          {subj.kkm !== undefined && subj.kkm > 0 && <span>• KKM {subj.kkm}</span>}
                        </div>
                        {subj.hasUts === false && (
                          <span className="mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500">
                            Tanpa UTS
                          </span>
                        )}

                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4 + reportContext.subjects.length}
                      className="p-8 text-center text-xs text-slate-400"
                    >
                      Tidak ada siswa yang cocok dengan pencarian "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st, idx) => {
                    const scoreMap = new Map<string, MidtermReportScore>();
                    st.scores.forEach((sc) => scoreMap.set(sc.subjectId, sc));

                    return (
                      <tr
                        key={st.studentId}
                        className="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* No */}
                        <td className="p-3 text-center text-slate-400 sticky left-0 z-10 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          {idx + 1}
                        </td>

                        {/* NIS */}
                        <td className="p-3 text-center font-mono text-slate-600 dark:text-zinc-400 sticky left-12 z-10 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          {st.nis || "-"}
                        </td>

                        {/* Nama Siswa */}
                        <td className="p-3 font-semibold text-slate-800 dark:text-zinc-100 sticky left-36 z-10 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.1)]">
                          {st.studentName}
                        </td>

                        {/* Action: Cetak Rapor Per Siswa */}
                        <td className="p-2.5 text-center border-r border-slate-200/80 dark:border-zinc-800 whitespace-nowrap">
                          <button
                            onClick={() => handleOpenSingleStudentPrint(st.studentId)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                            title={`Cetak Rapor ${st.studentName}`}
                          >
                            <Printer className="w-3 h-3" />
                            <span>Cetak Rapor</span>
                          </button>
                        </td>

                        {/* Score Cells for each subject */}
                        {reportContext.subjects.map((subj) => {
                          const sc = scoreMap.get(subj.subjectId);
                          const status = sc?.status || "BELUM_DIISI";
                          const score = sc?.score;

                          return (
                            <td
                              key={subj.subjectId}
                              className="p-3 text-center border-r border-slate-200/60 dark:border-zinc-800/60"
                            >
                              {/* 1. TERISI: Explicitly check score !== null && score !== undefined */}
                              {status === "TERISI" && score !== null && score !== undefined ? (
                                <span className="font-bold text-slate-800 dark:text-zinc-100 text-sm">
                                  {score}
                                </span>
                              ) : status === "TIDAK_ADA_UTS" ? (
                                /* 2. TIDAK_ADA_UTS */
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                                  Tidak Ada UTS
                                </span>
                              ) : (
                                /* 3. BELUM_DIISI */
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                                  Belum Diisi
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Print Preview Modal (Format Resmi Per Siswa: 1 Siswa = 1 Rapor) */}
      {isPrintModalOpen && reportContext && (
        <MidtermPrintModal
          context={reportContext}
          reportType={reportType}
          onReportTypeChange={(newType) => setReportType(newType)}
          initialStudentId={selectedStudentForPrintId}
          initialMode={printMode}
          academicYearName={activeYearObj?.name || "-"}
          semesterName={activeSemObj?.name || "-"}
          className={activeClassObj?.name || "-"}
          homeroomTeacherName={activeClassObj?.homeroomTeacherName || "-"}
          printConfig={printConfig}
          midtermPrintConfig={midtermPrintConfig}
          identity={identity}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}

      {/* 6. Modal Pengaturan Cetak RTS */}
      {isSettingsModalOpen && (
        <MidtermPrintSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          currentSettings={midtermPrintConfig}
          classes={classes}
          currentClassId={selectedClassId}
          identity={identity}
          printConfig={printConfig}
          onSettingsSaved={(newSettings) => setMidtermPrintConfig(newSettings)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// PRINT PREVIEW MODAL COMPONENT (1 SISWA = 1 RAPOR)
// Dedicated Midterm Report Card Preview & Batch Printing
// ----------------------------------------------------
interface MidtermPrintModalProps {
  context: MidtermReportContext;
  reportType: MidtermReportType;
  onReportTypeChange: (type: MidtermReportType) => void;
  initialStudentId?: string | null;
  initialMode?: "SINGLE" | "BATCH";
  academicYearName: string;
  semesterName: string;
  className: string;
  homeroomTeacherName: string;
  printConfig?: ERaporSettingsConfig;
  midtermPrintConfig?: MidtermPrintSettings;
  identity?: AppConfig;
  onOpenSettings?: () => void;
  onClose: () => void;
}

function MidtermPrintModal({
  context,
  reportType,
  onReportTypeChange,
  initialStudentId,
  initialMode = "SINGLE",
  academicYearName,
  semesterName,
  className,
  homeroomTeacherName,
  printConfig,
  midtermPrintConfig,
  identity,
  onOpenSettings,
  onClose
}: MidtermPrintModalProps) {
  const [mode, setMode] = useState<"SINGLE" | "BATCH">(initialMode);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || (context.students[0]?.studentId ?? "")
  );
  const [paperSize, setPaperSize] = useState<"A4" | "F4">(
    reportType === "PONDOK" ? "F4" : "A4"
  );
  const [searchStudent, setSearchStudent] = useState<string>("");

  // Ensure selectedStudentId exists in current context
  useEffect(() => {
    if (context.students.length > 0) {
      const exists = context.students.some((s) => s.studentId === selectedStudentId);
      if (!exists) {
        setSelectedStudentId(context.students[0].studentId);
      }
    }
  }, [context.students, selectedStudentId]);

  // Current student index in list
  const currentIndex = useMemo(() => {
    const idx = context.students.findIndex((s) => s.studentId === selectedStudentId);
    return idx >= 0 ? idx : 0;
  }, [context.students, selectedStudentId]);

  const selectedStudent = useMemo(() => {
    return context.students[currentIndex] || context.students[0];
  }, [context.students, currentIndex]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedStudentId(context.students[currentIndex - 1].studentId);
    }
  };

  const handleNext = () => {
    if (currentIndex < context.students.length - 1) {
      setSelectedStudentId(context.students[currentIndex + 1].studentId);
    }
  };

  const printDateStr = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Filtered student list for selector
  const selectorStudents = useMemo(() => {
    if (!searchStudent.trim()) return context.students;
    const q = searchStudent.toLowerCase();
    return context.students.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        (s.nis && s.nis.toLowerCase().includes(q))
    );
  }, [context.students, searchStudent]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print-modal-container">
      {/* Dynamic CSS Print Page Rule */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === "F4" ? "215mm 330mm" : "A4"} portrait;
            margin: 10mm 15mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-modal-container {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .print-paper-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
          }
          .student-report-card {
            page-break-after: always;
            break-after: page;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .student-report-card:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Modal Toolbar (Hidden during print) */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 space-y-3 no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Cetak Rapor Tengah Semester (Rapor Bayangan)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Format Resmi 1 Siswa = 1 Rapor • {className}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  title="Buka Pengaturan Cetak RTS"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Pengaturan Cetak</span>
                </button>
              )}

              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {mode === "SINGLE"
                    ? `Cetak Rapor (${selectedStudent?.studentName || "Siswa"})`
                    : `Cetak Semua (${context.students.length} Siswa)`}
                </span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Options & Filter Bar inside Modal */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/80 dark:border-zinc-800 text-xs">
            {/* Mode & Report Type Switches */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Mode Toggle */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setMode("SINGLE")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    mode === "SINGLE"
                      ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  1 Siswa
                </button>
                <button
                  type="button"
                  onClick={() => setMode("BATCH")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    mode === "BATCH"
                      ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  Semua Siswa ({context.students.length})
                </button>
              </div>

              {/* Tipe Rapor Toggle */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => onReportTypeChange("TERPADU")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    reportType === "TERPADU"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  Rapor Terpadu
                </button>
                <button
                  type="button"
                  onClick={() => onReportTypeChange("UMUM")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    reportType === "UMUM"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  Rapor Umum
                </button>
                <button
                  type="button"
                  onClick={() => onReportTypeChange("PONDOK")}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    reportType === "PONDOK"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  Rapor Pondok
                </button>
              </div>


              {/* Ukuran Kertas */}
              <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setPaperSize("A4")}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                    paperSize === "A4"
                      ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm"
                      : "text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  A4
                </button>
                <button
                  type="button"
                  onClick={() => setPaperSize("F4")}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                    paperSize === "F4"
                      ? "bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm"
                      : "text-slate-600 dark:text-zinc-400"
                  }`}
                >
                  F4
                </button>
              </div>
            </div>

            {/* Single Student Selector Navigation */}
            {mode === "SINGLE" && context.students.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="p-1 rounded-md border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                  title="Siswa Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="text-xs py-1 px-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[200px] truncate"
                >
                  {selectorStudents.map((st) => (
                    <option key={st.studentId} value={st.studentId}>
                      {st.studentName} {st.nis ? `(${st.nis})` : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentIndex >= context.students.length - 1}
                  className="p-1 rounded-md border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 disabled:opacity-40"
                  title="Siswa Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <span className="text-[11px] text-slate-500 font-medium ml-1">
                  ({currentIndex + 1} / {context.students.length})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Printable Paper Preview Canvas */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 dark:bg-zinc-950/70 print:p-0 print:bg-white print:overflow-visible">
          {mode === "BATCH" && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between no-print max-w-4xl mx-auto">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 shrink-0" />
                <span>
                  <strong>Mode Cetak Seluruh Siswa ({context.students.length} Siswa):</strong> Setiap rapor siswa otomatis berada pada 1 halaman terpisah saat dicetak (1 Siswa = 1 Rapor).
                </span>
              </div>
            </div>
          )}

          {context.students.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl border text-slate-400 text-xs">
              Tidak ada data siswa untuk dicetak.
            </div>
          ) : mode === "SINGLE" ? (
            selectedStudent && (
              <div className="print-paper-sheet max-w-4xl mx-auto shadow-md rounded-lg overflow-hidden">
                <MidtermStudentReportPrintable
                  student={selectedStudent}
                  context={context}
                  reportType={reportType}
                  printConfig={printConfig}
                  midtermPrintConfig={midtermPrintConfig}
                  identity={identity}
                  paperSize={paperSize}
                  printDate={printDateStr}
                  isSinglePage={false}
                />
              </div>
            )
          ) : (
            <div className="space-y-8 print:space-y-0 max-w-4xl mx-auto">
              {context.students.map((st, idx) => (
                <div key={st.studentId} className="print-paper-sheet shadow-md rounded-lg overflow-hidden">
                  <div className="bg-slate-200 dark:bg-zinc-800 p-1.5 px-3 text-[11px] font-bold text-slate-600 dark:text-zinc-300 flex justify-between items-center no-print border-b">
                    <span>Rapor Siswa #{idx + 1}: {st.studentName}</span>
                    <span className="font-mono text-[10px]">NIS: {st.nis || "-"}</span>
                  </div>
                  <MidtermStudentReportPrintable
                    student={st}
                    context={context}
                    reportType={reportType}
                    printConfig={printConfig}
                    midtermPrintConfig={midtermPrintConfig}
                    identity={identity}
                    paperSize={paperSize}
                    printDate={printDateStr}
                    isSinglePage={idx < context.students.length - 1}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
