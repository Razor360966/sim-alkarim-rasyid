import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  CalendarDays,
  Calendar,
  Clock,
  Users,
  Award,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Filter,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Printer,
  X,
  UserCheck,
  UserX,
  Layers,
  Sparkles
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useSchoolIdentity } from "../contexts/SchoolIdentityContext";
import {
  halaqohRecapService,
  getTodayDateStr,
  getIndonesianDayName,
  calculateHalaqohPeriod
} from "../services/halaqohRecap.service";
import {
  HalaqohRecapPeriodMode,
  HalaqohRecapResult,
  HalaqohRecapTeacherSummary,
  HalaqohRecapMeeting,
  HalaqohAttendanceStatus
} from "../types/halaqohRecap.types";

// ============================================================================
// FORMAT HELPERS
// ============================================================================

const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember"
];

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return dateStr;
  }
  const [y, m, d] = parts;
  const monthName = INDONESIAN_MONTHS[m - 1] || "";
  const dayName = getIndonesianDayName(dateStr);
  return `${dayName}, ${d} ${monthName} ${y}`;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  const monthName = (INDONESIAN_MONTHS[m - 1] || "").slice(0, 3);
  const dayName = getIndonesianDayName(dateStr);
  return `${dayName}, ${d} ${monthName} ${y}`;
}

function formatPercentage(val: number | null): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return `${val.toFixed(1).replace(".", ",")}%`;
}

// ============================================================================
// STATUS BADGE COMPONENT (FACTUAL RECAP ONLY - ZERO MORAL JUDGMENT)
// ============================================================================

const StatusBadge: React.FC<{ status: HalaqohAttendanceStatus }> = ({ status }) => {
  switch (status) {
    case "HADIR_LENGKAP":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          HADIR LENGKAP
        </span>
      );
    case "CHECK_IN_SAJA":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          CHECK-IN SAJA
        </span>
      );
    case "TIDAK_HADIR":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <UserX className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          TIDAK HADIR
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400">
          TIDAK ADA SESI
        </span>
      );
  }
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function HalaqohAttendanceRecap() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { identity } = useSchoolIdentity();

  // Filter States
  const [periodMode, setPeriodMode] = useState<HalaqohRecapPeriodMode>("WEEKLY");
  const [referenceDate, setReferenceDate] = useState<string>(getTodayDateStr());
  
  // Monthly Filter States
  const todayParts = getTodayDateStr().split("-").map(Number);
  const [selectedMonth, setSelectedMonth] = useState<number>(todayParts[1] || 9);
  const [selectedYear, setSelectedYear] = useState<number>(todayParts[0] || 2026);

  // Custom Range Filter States
  const [startDate, setStartDate] = useState<string>(getTodayDateStr());
  const [endDate, setEndDate] = useState<string>(getTodayDateStr());

  // Entity Selectors
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Filter Options (fetched via read-only halaqohRecapService)
  const [teacherOptions, setTeacherOptions] = useState<{ id: string; name: string }[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string }[]>([]);

  // Local Search & Sorting
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<
    "teacherName" | "totalScheduledMeetings" | "totalPresentComplete" | "totalCheckInOnly" | "totalAbsent" | "attendancePercentage"
  >("teacherName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drilldown Modal / Drawer
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState<HalaqohRecapTeacherSummary | null>(null);

  // Data & Loading States
  const [recapData, setRecapData] = useState<HalaqohRecapResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Request race protection
  const requestIdRef = useRef<number>(0);

  // Load filter options on mount
  useEffect(() => {
    halaqohRecapService
      .getFilterOptions()
      .then((opts) => {
        setTeacherOptions(opts.teachers);
        setGroupOptions(opts.groups);
      })
      .catch((err) => {
        console.warn("Failed to load initial halaqoh filter options:", err);
      });
  }, []);

  // Compute active date boundaries dynamically for display
  const activeComputedPeriod = useMemo(() => {
    let effectiveRef = referenceDate;
    if (periodMode === "MONTHLY") {
      effectiveRef = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    }
    return calculateHalaqohPeriod({
      periodMode,
      referenceDate: effectiveRef,
      startDate,
      endDate
    });
  }, [periodMode, referenceDate, selectedMonth, selectedYear, startDate, endDate]);

  // Fetch recap data from SSOT halaqohRecapService
  const fetchRecap = async () => {
    // Validate custom range if in custom mode
    if (periodMode === "CUSTOM" && startDate > endDate) {
      showToast("Tanggal Mulai tidak boleh lebih besar dari Tanggal Akhir", "error");
      return;
    }

    const currentReqId = ++requestIdRef.current;
    setIsLoading(true);
    setErrorMessage(null);

    let effectiveRef = referenceDate;
    if (periodMode === "MONTHLY") {
      effectiveRef = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
    }

    try {
      const result = await halaqohRecapService.getHalaqohRecap({
        periodMode,
        referenceDate: effectiveRef,
        startDate: periodMode === "CUSTOM" ? startDate : undefined,
        endDate: periodMode === "CUSTOM" ? endDate : undefined,
        teacherId: selectedTeacherId || undefined,
        halaqohGroupId: selectedGroupId || undefined
      });

      // Avoid race conditions
      if (currentReqId === requestIdRef.current) {
        setRecapData(result);
      }
    } catch (err: any) {
      console.error("Error fetching halaqoh recap:", err);
      if (currentReqId === requestIdRef.current) {
        setErrorMessage("Data rekap Halaqoh belum dapat dimuat. Silakan coba lagi.");
        showToast("Gagal memuat data rekap halaqoh", "error");
      }
    } finally {
      if (currentReqId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Initial load
  useEffect(() => {
    fetchRecap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset Filters
  const handleResetFilters = () => {
    const today = getTodayDateStr();
    setPeriodMode("WEEKLY");
    setReferenceDate(today);
    const parts = today.split("-").map(Number);
    setSelectedMonth(parts[1] || 9);
    setSelectedYear(parts[0] || 2026);
    setStartDate(today);
    setEndDate(today);
    setSelectedTeacherId("");
    setSelectedGroupId("");
    setSearchQuery("");
    setSortField("teacherName");
    setSortOrder("asc");

    // Immediately trigger fresh recap with default params
    setTimeout(() => {
      halaqohRecapService
        .getHalaqohRecap({
          periodMode: "WEEKLY",
          referenceDate: today
        })
        .then((res) => {
          setRecapData(res);
          showToast("Filter berhasil di-reset", "info");
        })
        .catch(() => {
          setErrorMessage("Data rekap Halaqoh belum dapat dimuat. Silakan coba lagi.");
        });
    }, 50);
  };

  // Filtered and sorted teacher list
  const filteredTeacherSummaries = useMemo(() => {
    if (!recapData?.teacherSummaries) return [];
    let list = recapData.teacherSummaries;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.teacherName.toLowerCase().includes(q));
    }

    // Sorting
    return [...list].sort((a, b) => {
      let comp = 0;
      if (sortField === "teacherName") {
        comp = a.teacherName.localeCompare(b.teacherName);
      } else if (sortField === "attendancePercentage") {
        const valA = a.attendancePercentage ?? -1;
        const valB = b.attendancePercentage ?? -1;
        comp = valA - valB;
      } else {
        comp = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortOrder === "asc" ? comp : -comp;
    });
  }, [recapData, searchQuery, sortField, sortOrder]);

  // Handle header sorting click
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "teacherName" ? "asc" : "desc");
    }
  };

  // Meetings for selected drilldown teacher (sorted ascending by date)
  const drilldownMeetings = useMemo(() => {
    if (!selectedTeacherForDetail || !recapData?.meetings) return [];
    return recapData.meetings
      .filter((m) => m.teacherId === selectedTeacherForDetail.teacherId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedTeacherForDetail, recapData]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-0 print:space-y-4">
      {/* ==================================================================== */}
      {/* PAGE HEADER */}
      {/* ==================================================================== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5 print:border-b-2 print:border-black">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 print:text-black">
              Rekap Absensi Guru Halaqoh
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 print:hidden">
              <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              Monitoring KS / Wakakur
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 print:text-gray-700">
            Monitoring pertemuan dan kehadiran Guru Halaqoh
          </p>
        </div>

        {/* Action Buttons: Cetak & Refresh */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={fetchRecap}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs disabled:opacity-50"
            title="Muat ulang data rekap"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handlePrint}
            disabled={isLoading || !recapData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-xs transition-colors disabled:opacity-50"
            title="Cetak laporan rekap"
          >
            <Printer className="w-4 h-4" />
            Cetak Rekap
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* FILTER CONTROL CARD */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 shadow-xs print:hidden space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
              Filter Periode & Parameter Rekap
            </h2>
          </div>
          <button
            onClick={handleResetFilters}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors underline"
          >
            Reset Filter
          </button>
        </div>

        {/* Tab Jenis Periode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5 md:col-span-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Jenis Periode
            </label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setPeriodMode("WEEKLY")}
                className={`text-xs py-1.5 font-medium rounded-md transition-all ${
                  periodMode === "WEEKLY"
                    ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-semibold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Mingguan
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("MONTHLY")}
                className={`text-xs py-1.5 font-medium rounded-md transition-all ${
                  periodMode === "MONTHLY"
                    ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-semibold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Bulanan
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("CUSTOM")}
                className={`text-xs py-1.5 font-medium rounded-md transition-all ${
                  periodMode === "CUSTOM"
                    ? "bg-white dark:bg-zinc-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-semibold"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                }`}
              >
                Rentang
              </button>
            </div>
          </div>

          {/* Dynamic Period Inputs */}
          <div className="md:col-span-2">
            {/* WEEKLY MODE */}
            {periodMode === "WEEKLY" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Tanggal Referensi</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-zinc-400">
                    Siklus: Sabtu s.d. Jumat
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <input
                    type="date"
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-zinc-700/60 leading-relaxed">
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">
                      Periode: {formatShortDate(activeComputedPeriod.startDate)} s.d. {formatShortDate(activeComputedPeriod.endDate)}
                    </p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Operasional Halaqoh: Sabtu – Kamis (Jumat Libur)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MONTHLY MODE */}
            {periodMode === "MONTHLY" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                  <span>Pilih Bulan & Tahun</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-zinc-400">
                    1 s.d. Akhir Bulan
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {INDONESIAN_MONTHS.map((m, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-zinc-700/60">
                    <span className="font-semibold text-slate-800 dark:text-zinc-200">
                      {activeComputedPeriod.startDate} s.d. {activeComputedPeriod.endDate}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CUSTOM MODE */}
            {periodMode === "CUSTOM" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Rentang Tanggal Bebas (Inklusif)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">Mulai:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 shrink-0">Akhir:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter Guru & Kelompok */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Guru Halaqoh
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Guru Halaqoh</option>
              {teacherOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
              Kelompok Halaqoh
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Semua Kelompok Halaqoh</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchRecap}
              disabled={isLoading || (periodMode === "CUSTOM" && startDate > endDate)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-sm transition-colors shadow-xs disabled:opacity-50"
            >
              <Filter className="w-4 h-4" />
              Tampilkan Rekap
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* ERROR STATE */}
      {/* ==================================================================== */}
      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900/60 flex items-center justify-between text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-sm font-medium">{errorMessage}</p>
          </div>
          <button
            onClick={fetchRecap}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUMMARY CARDS (6 CARDS) */}
      {/* ==================================================================== */}
      {recapData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 print:grid-cols-6 print:gap-2">
          {/* Card 1: Total Guru */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Total Guru</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {isLoading ? "..." : recapData.teacherSummaries.length}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Guru dalam rekap
            </p>
          </div>

          {/* Card 2: Total Pertemuan Terjadwal */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Pertemuan</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              {isLoading ? "..." : recapData.overallSummary.totalScheduledMeetings}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Sesi terjadwal
            </p>
          </div>

          {/* Card 3: Hadir Lengkap */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Hadir Lengkap</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {isLoading ? "..." : recapData.overallSummary.totalPresentComplete}
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
              Check-in + Check-out
            </p>
          </div>

          {/* Card 4: Check-in Saja */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Check-in Saja</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {isLoading ? "..." : recapData.overallSummary.totalCheckInOnly}
            </div>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
              Tanpa check-out
            </p>
          </div>

          {/* Card 5: Tidak Hadir */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Tidak Hadir</span>
              <UserX className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {isLoading ? "..." : recapData.overallSummary.totalAbsent}
            </div>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-0.5">
              Sesi tanpa presensi
            </p>
          </div>

          {/* Card 6: Persentase Kehadiran */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">Kehadiran</span>
              <Award className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
              {isLoading ? "..." : formatPercentage(recapData.overallSummary.attendancePercentage)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Rasio Hadir Lengkap
            </p>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TABLE SEARCH & SORT BAR */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs print:hidden">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama guru halaqoh..."
            className="w-full text-sm pl-9 pr-3 py-1.5 border border-slate-200 dark:border-zinc-700 rounded-lg bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500 dark:text-zinc-400 shrink-0">Urutkan:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="text-xs px-2.5 py-1.5 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
          >
            <option value="teacherName">Nama Guru (A–Z)</option>
            <option value="totalScheduledMeetings">Jumlah Pertemuan</option>
            <option value="totalPresentComplete">Hadir Lengkap</option>
            <option value="totalCheckInOnly">Check-in Saja</option>
            <option value="totalAbsent">Tidak Hadir</option>
            <option value="attendancePercentage">Persentase Kehadiran</option>
          </select>
          <button
            onClick={() => setSortOrder((p) => (p === "asc" ? "desc" : "asc"))}
            className="p-1.5 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300"
            title={sortOrder === "asc" ? "Menaik (A-Z)" : "Menurun (Z-A)"}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MAIN DATA TABLE */}
      {/* ==================================================================== */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
              Memuat data rekap pertemuan & presensi guru halaqoh...
            </p>
          </div>
        ) : filteredTeacherSummaries.length === 0 ? (
          <div className="py-16 text-center px-4 space-y-2">
            <Users className="w-10 h-10 text-slate-300 dark:text-zinc-600 mx-auto" />
            <p className="text-base font-semibold text-slate-700 dark:text-zinc-300">
              Tidak ada data pertemuan Halaqoh pada periode yang dipilih.
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
              Silakan periksa rentang periode tanggal atau filter kelompok halaqoh yang dipilih.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800/80 text-xs font-semibold text-slate-600 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-800">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th
                    onClick={() => handleSort("teacherName")}
                    className="py-3 px-4 cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Guru Halaqoh</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("totalScheduledMeetings")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-emerald-600 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Pertemuan</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("totalPresentComplete")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-emerald-600 transition-colors text-emerald-700 dark:text-emerald-400"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Hadir Lengkap</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("totalCheckInOnly")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-emerald-600 transition-colors text-amber-700 dark:text-amber-400"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Check-in Saja</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("totalAbsent")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-emerald-600 transition-colors text-rose-700 dark:text-rose-400"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Tidak Hadir</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("attendancePercentage")}
                    className="py-3 px-4 text-right cursor-pointer hover:text-emerald-600 transition-colors font-bold"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Kehadiran</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center w-28 print:hidden">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredTeacherSummaries.map((teacher, index) => {
                  const hasSessions = teacher.totalScheduledMeetings > 0;
                  return (
                    <tr
                      key={teacher.teacherId}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedTeacherForDetail(teacher)}
                    >
                      <td className="py-3.5 px-4 text-center text-xs text-slate-400 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-zinc-100">
                        <div className="flex items-center gap-2">
                          <span>{teacher.teacherName}</span>
                          {!hasSessions && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                              0 Sesi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-800 dark:text-zinc-200">
                        {teacher.totalScheduledMeetings}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400">
                        {teacher.totalPresentComplete}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-amber-600 dark:text-amber-400">
                        {teacher.totalCheckInOnly}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-rose-600 dark:text-rose-400">
                        {teacher.totalAbsent}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-zinc-100">
                        {formatPercentage(teacher.attendancePercentage)}
                      </td>
                      <td className="py-3.5 px-4 text-center print:hidden" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedTeacherForDetail(teacher)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:text-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
                        >
                          Detail
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* DRILLDOWN MODAL / DRAWER (DETAIL PERTEMUAN PER GURU) */}
      {/* ==================================================================== */}
      {selectedTeacherForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex items-start justify-between bg-slate-50/70 dark:bg-zinc-800/40">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                    Detail Pertemuan: {selectedTeacherForDetail.teacherName}
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                  <span>
                    <strong>Periode:</strong> {recapData?.period.startDate} s.d. {recapData?.period.endDate} ({recapData?.period.mode})
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Total Pertemuan:</strong> {selectedTeacherForDetail.totalScheduledMeetings} Sesi
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Persentase:</strong> {formatPercentage(selectedTeacherForDetail.attendancePercentage)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedTeacherForDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Mini Summary Stat Chips */}
            <div className="px-5 py-3 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Hadir Lengkap: {selectedTeacherForDetail.totalPresentComplete}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                <Clock className="w-3.5 h-3.5" />
                Check-in Saja: {selectedTeacherForDetail.totalCheckInOnly}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                <UserX className="w-3.5 h-3.5" />
                Tidak Hadir: {selectedTeacherForDetail.totalAbsent}
              </span>
            </div>

            {/* Modal Body: Meetings Table */}
            <div className="p-5 overflow-y-auto flex-1">
              {drilldownMeetings.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  Tidak ada rekaman sesi pertemuan pada periode ini.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold border-b border-slate-200 dark:border-zinc-800">
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Kelompok Halaqoh</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Check-In</th>
                        <th className="py-2.5 px-3 text-center">Check-Out</th>
                        <th className="py-2.5 px-3 text-center">Durasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {drilldownMeetings.map((meeting, idx) => (
                        <tr key={meeting.meetingId} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
                          <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200 whitespace-nowrap">
                            {formatShortDate(meeting.date)}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300">
                            {meeting.halaqohGroupName}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <StatusBadge status={meeting.status} />
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-700 dark:text-zinc-300">
                            {meeting.checkInTime || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-medium text-slate-700 dark:text-zinc-300">
                            {meeting.checkOutTime || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-500 dark:text-zinc-400">
                            {meeting.durationMinutes !== null ? `${meeting.durationMinutes} mnt` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/20 flex justify-end">
              <button
                onClick={() => setSelectedTeacherForDetail(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
