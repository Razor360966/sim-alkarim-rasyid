import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  TrendingUp, 
  Calendar, 
  Search, 
  Filter, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Layers, 
  BookOpen, 
  User, 
  ChevronRight, 
  RefreshCw, 
  Eye, 
  X, 
  ShieldCheck, 
  BarChart3, 
  ArrowRight,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { useAuth } from "../contexts/AuthContext";
import { academicYearService } from "../services/academicYear.service";
import { semesterService } from "../services/semester.service";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { classService } from "../services/classService";
import { 
  learningProgressMonitoringService, 
  generateSchoolWeeks, 
  formatDateJakarta,
  formatIndonesianDateShort
} from "../services/learningProgressMonitoring.service";
import { 
  LearningProgressItem, 
  LearningProgressStatus, 
  SchoolWeekPeriod,
  WeeklyCumulativeRow,
  TopicMaterialProgressItem,
  MaterialProgressStatus,
  MaterialProgressResult 
} from "../types/learningProgressMonitoring.types";

export default function LearningProgressMonitoringPage() {
  const { user } = useAuth();

  // Role detection
  const userRoles = useMemo(() => {
    const roles: string[] = [];
    if (user?.role) roles.push(user.role.toLowerCase());
    if (Array.isArray(user?.roles)) {
      user.roles.forEach((r: string) => {
        if (!roles.includes(r.toLowerCase())) roles.push(r.toLowerCase());
      });
    }
    return roles;
  }, [user]);

  const isLeadership = userRoles.some(r => 
    ["admin", "kepala sekolah", "wakil kepala sekolah", "pimpinan", "ketua yayasan", "operator"].includes(r)
  );
  const isGuru = userRoles.includes("guru") && !isLeadership;

  // 1. Fetch Academic Years and Semesters
  const { data: academicYears = [] } = useQuery({
    queryKey: ["academicYears"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => semesterService.getSemesters()
  });

  const activeAy = useMemo(() => academicYears.find(ay => ay.isActive) || academicYears[0], [academicYears]);
  const [selectedAyId, setSelectedAyId] = useState<string>("");
  const currentAyId = selectedAyId || activeAy?.id || "";

  const activeSem = useMemo(() => {
    const semList = semesters.filter(s => !currentAyId || s.academicYearId === currentAyId);
    return semList.find(s => s.isActive) || semList[0];
  }, [semesters, currentAyId]);

  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const currentSemesterId = selectedSemesterId || activeSem?.id || "";

  // 2. Fetch Teachers, Subjects, Classes for filter dropdowns
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachersList"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjectsList"],
    queryFn: () => subjectService.getSubjects()
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classesList"],
    queryFn: () => classService.getClasses()
  });

  // Determine current semester date bounds
  const currentSemesterObj = useMemo(() => {
    return semesters.find(s => s.id === currentSemesterId) || activeSem;
  }, [semesters, currentSemesterId, activeSem]);

  const semesterStartDate = currentSemesterObj?.startDate || "2026-07-15";
  const semesterEndDate = currentSemesterObj?.endDate || "2026-12-31";

  // Today in Asia/Jakarta
  const todayJakarta = useMemo(() => formatDateJakarta(new Date()), []);

  // Generate all school operational weeks for this semester (Sabtu-Kamis)
  const semesterWeeks = useMemo(() => {
    return generateSchoolWeeks(semesterStartDate, semesterEndDate, todayJakarta);
  }, [semesterStartDate, semesterEndDate, todayJakarta]);

  // Find index of current week
  const currentWeekIndex = useMemo(() => {
    const idx = semesterWeeks.findIndex(w => w.isCurrentWeek);
    return idx !== -1 ? idx : 0;
  }, [semesterWeeks]);

  // Filters State (Phase 3C-1: Streamlined to Pekan Berjalan, Pilih Pekan, Kumulatif)
  const [periodMode, setPeriodMode] = useState<"current_week" | "specific_week" | "cumulative">("current_week");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number>(0);

  // Search and Specific Filters
  const [filterTeacherId, setFilterTeacherId] = useState<string>(isGuru ? (user?.teacherId || "") : "ALL");
  const [filterSubjectId, setFilterSubjectId] = useState<string>("ALL");
  const [filterClassId, setFilterClassId] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tab State: JP vs MATERI (Phase 3B)
  const [activeTab, setActiveTab] = useState<"JP" | "MATERI">("JP");

  // Modal State for Drilldown Detail (JP)
  const [detailItem, setDetailItem] = useState<LearningProgressItem | null>(null);
  const [cumulativeTimeline, setCumulativeTimeline] = useState<WeeklyCumulativeRow[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState<boolean>(false);

  // Modal State for Material Detail & Special Journals (Phase 3B & Phase 3C-2)
  const [detailTopicItem, setDetailTopicItem] = useState<TopicMaterialProgressItem | null>(null);
  const [topicEvidenceTab, setTopicEvidenceTab] = useState<"ALL" | "PROSEM" | "SCHEDULE" | "JOURNALS" | "SUBTOPICS">("ALL");
  const [showSpecialJournalsModal, setShowSpecialJournalsModal] = useState<"OUT_OF_PROSEM" | "UNLINKED" | null>(null);

  // Modal State for Executive Reporting (Phase 3C-3: Executive Reporting & Export)
  const [showExecutiveReportModal, setShowExecutiveReportModal] = useState<boolean>(false);

  // Compute active date boundaries based on periodMode (Sabtu-Kamis cycle, Asia/Jakarta)
  const activeDateBounds = useMemo(() => {
    if (semesterWeeks.length === 0) {
      return {
        startDate: todayJakarta,
        endDate: todayJakarta,
        label: "Periode Hari Ini",
        weekNumber: 1,
        isCumulative: false,
        cumulativeStart: semesterStartDate
      };
    }

    if (periodMode === "current_week") {
      const activeWeek = semesterWeeks[currentWeekIndex] || semesterWeeks[0];
      return {
        startDate: activeWeek.startDate,
        endDate: activeWeek.endDate,
        label: `${activeWeek.label} [Pekan Berjalan]`,
        weekNumber: activeWeek.weekNumber,
        isCumulative: false,
        cumulativeStart: semesterStartDate
      };
    }

    if (periodMode === "specific_week") {
      const activeWeek = semesterWeeks[selectedWeekIndex] || semesterWeeks[0];
      return {
        startDate: activeWeek.startDate,
        endDate: activeWeek.endDate,
        label: activeWeek.label,
        weekNumber: activeWeek.weekNumber,
        isCumulative: false,
        cumulativeStart: semesterStartDate
      };
    }

    // periodMode === "cumulative": from semester start up to the end of the selected/active week
    const targetWeek = semesterWeeks[selectedWeekIndex] || semesterWeeks[currentWeekIndex] || semesterWeeks[0];
    return {
      startDate: semesterStartDate,
      endDate: targetWeek.endDate,
      label: `Kumulatif Semester s/d ${targetWeek.label}`,
      weekNumber: targetWeek.weekNumber,
      isCumulative: true,
      cumulativeStart: semesterStartDate
    };
  }, [
    periodMode,
    semesterWeeks,
    currentWeekIndex,
    selectedWeekIndex,
    semesterStartDate,
    todayJakarta
  ]);

  // Main Query: Fetch and calculate learning progress
  const { data: progressResult, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "learningProgressMonitoring",
      currentAyId,
      currentSemesterId,
      activeDateBounds.startDate,
      activeDateBounds.endDate,
      activeDateBounds.isCumulative
    ],
    queryFn: () =>
      learningProgressMonitoringService.getLearningProgress({
        academicYearId: currentAyId,
        semesterId: currentSemesterId,
        startDate: activeDateBounds.startDate,
        endDate: activeDateBounds.endDate,
        periodLabel: activeDateBounds.label,
        isCumulative: activeDateBounds.isCumulative,
        cumulativeStartDate: activeDateBounds.cumulativeStart
      }),
    enabled: !!currentAyId && !!currentSemesterId
  });

  // Material Progress Query (Phase 3B - Pure Topic-Centric Engine)
  const { 
    data: materialResult, 
    isLoading: isLoadingMaterial, 
    isFetching: isFetchingMaterial, 
    refetch: refetchMaterial 
  } = useQuery({
    queryKey: [
      "materialProgressMonitoring",
      currentAyId,
      currentSemesterId,
      activeDateBounds.startDate,
      activeDateBounds.endDate,
      activeDateBounds.isCumulative ? "cumulative" : "weekly"
    ],
    queryFn: () =>
      learningProgressMonitoringService.getMaterialProgress({
        academicYearId: currentAyId,
        semesterId: currentSemesterId,
        startDate: activeDateBounds.startDate,
        endDate: activeDateBounds.endDate,
        mode: activeDateBounds.isCumulative ? "cumulative" : "weekly",
        todayStr: todayJakarta
      }),
    enabled: !!currentAyId && !!currentSemesterId
  });

  const rawItems = progressResult?.items || [];
  const summary = progressResult?.summary || {
    totalItems: 0,
    sesuaiRencanaCount: 0,
    lebihCepatCount: 0,
    sebagianCount: 0,
    tertinggalCount: 0,
    belumAdaJurnalCount: 0,
    tidakAdaTargetCount: 0,
    tidakAdaJadwalCount: 0,
    totalTargetJP: 0,
    totalRealizedJP: 0,
    overallPercentage: 0
  };

  // Map Class + Subject to Assigned Teacher
  const classSubjectToTeacherMap = useMemo(() => {
    const map = new Map<string, { teacherId: string; teacherName: string }>();
    rawItems.forEach(item => {
      const key = `${item.classId}_${item.subjectId}`;
      if (!map.has(key)) {
        map.set(key, { teacherId: item.teacherId, teacherName: item.teacherName });
      }
    });
    return map;
  }, [rawItems]);

  // Map Class + Subject to Operational Schedules (Phase 3C-2 Evidence Inspection)
  const classSubjectToSchedulesMap = useMemo(() => {
    const map = new Map<string, any[]>();
    rawItems.forEach(item => {
      const key = `${item.classId}_${item.subjectId}`;
      if (!map.has(key) && item.schedules && item.schedules.length > 0) {
        map.set(key, item.schedules);
      }
    });
    return map;
  }, [rawItems]);

  // Topic-level operational schedules for enhanced drill-down (Phase 3C-2)
  const activeTopicSchedules = useMemo(() => {
    if (!detailTopicItem) return [];
    if (detailTopicItem.schedules && detailTopicItem.schedules.length > 0) {
      return detailTopicItem.schedules;
    }
    return classSubjectToSchedulesMap.get(`${detailTopicItem.classId}_${detailTopicItem.subjectId}`) || [];
  }, [detailTopicItem, classSubjectToSchedulesMap]);

  const activeTopicScheduledJP = useMemo(() => {
    return activeTopicSchedules.reduce((acc, s) => acc + Number((s as any).jpCount || 1), 0);
  }, [activeTopicSchedules]);

  // Client-Side Filtering for JP Progress
  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      // Guru role lock
      if (isGuru && user?.teacherId && item.teacherId !== user.teacherId) {
        return false;
      }

      // Teacher dropdown filter
      if (filterTeacherId !== "ALL" && item.teacherId !== filterTeacherId) {
        return false;
      }

      // Subject dropdown filter
      if (filterSubjectId !== "ALL" && item.subjectId !== filterSubjectId) {
        return false;
      }

      // Class dropdown filter
      if (filterClassId !== "ALL" && item.classId !== filterClassId) {
        return false;
      }

      // Status filter
      if (filterStatus !== "ALL" && item.status !== filterStatus) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTeacher = item.teacherName.toLowerCase().includes(q);
        const matchSubject = item.subjectName.toLowerCase().includes(q);
        const matchClass = item.className.toLowerCase().includes(q);
        const matchTopic = item.targetTitles.some(t => t.toLowerCase().includes(q));
        if (!matchTeacher && !matchSubject && !matchClass && !matchTopic) {
          return false;
        }
      }

      return true;
    });
  }, [rawItems, isGuru, user, filterTeacherId, filterSubjectId, filterClassId, filterStatus, searchQuery]);

  // Client-Side Filtering for Material Progress (Phase 3C-1: Scoped & Executive Summary)
  const rawTopicItems = materialResult?.topicItems || [];
  const scopedTopicItems = useMemo(() => {
    return rawTopicItems.filter(item => {
      const resolvedTeacher = classSubjectToTeacherMap.get(`${item.classId}_${item.subjectId}`);
      const effectiveTeacherId = item.teacherId || resolvedTeacher?.teacherId || "";
      const effectiveTeacherName = item.teacherName || resolvedTeacher?.teacherName || "";

      // Guru role lock
      if (isGuru && user?.teacherId && effectiveTeacherId !== user.teacherId) {
        const hasTeacherJournal = item.journals?.some(j => j.teacherId === user.teacherId);
        if (!hasTeacherJournal) return false;
      }

      // Teacher dropdown filter
      if (filterTeacherId !== "ALL" && effectiveTeacherId !== filterTeacherId) {
        const hasTeacherJournal = item.journals?.some(j => j.teacherId === filterTeacherId);
        if (!hasTeacherJournal) return false;
      }

      // Subject dropdown filter
      if (filterSubjectId !== "ALL" && item.subjectId !== filterSubjectId) {
        return false;
      }

      // Class dropdown filter
      if (filterClassId !== "ALL" && item.classId !== filterClassId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTopic = item.topicTitle.toLowerCase().includes(q);
        const matchSubject = (item.subjectName || "").toLowerCase().includes(q);
        const matchClass = (item.className || "").toLowerCase().includes(q);
        const matchTeacher = effectiveTeacherName.toLowerCase().includes(q);
        const matchSubtopics = item.subtopicsProgress?.some(st => st.subtopicTitle.toLowerCase().includes(q));
        if (!matchTopic && !matchSubject && !matchClass && !matchTeacher && !matchSubtopics) {
          return false;
        }
      }

      return true;
    });
  }, [
    rawTopicItems,
    classSubjectToTeacherMap,
    isGuru,
    user,
    filterTeacherId,
    filterSubjectId,
    filterClassId,
    searchQuery
  ]);

  // Executive Overview Summary for Wakakur & Kepala Sekolah (Phase 3C-1)
  const executiveSummary = useMemo(() => {
    return learningProgressMonitoringService.aggregateExecutiveSummary(scopedTopicItems);
  }, [scopedTopicItems]);

  // Final filtered topics for table display (with filterStatus)
  const filteredTopicItems = useMemo(() => {
    if (filterStatus === "ALL") return scopedTopicItems;
    return scopedTopicItems.filter(item => item.status === filterStatus);
  }, [scopedTopicItems, filterStatus]);

  // Open Detail Modal & Load Cumulative Timeline
  const handleOpenDetail = async (item: LearningProgressItem) => {
    setDetailItem(item);
    setLoadingTimeline(true);
    try {
      const timeline = await learningProgressMonitoringService.getCumulativeBreakdown({
        academicYearId: item.academicYearId,
        semesterId: item.semesterId,
        classId: item.classId,
        subjectId: item.subjectId,
        teacherId: item.teacherId,
        weeks: semesterWeeks
      });
      setCumulativeTimeline(timeline);
    } catch (err) {
      console.error("Failed to load cumulative timeline:", err);
      setCumulativeTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: LearningProgressStatus) => {
    switch (status) {
      case "SESUAI RENCANA":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          icon: CheckCircle2,
          label: "Sesuai Rencana"
        };
      case "LEBIH CEPAT":
        return {
          bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
          icon: TrendingUp,
          label: "Lebih Cepat"
        };
      case "SEBAGIAN":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
          icon: Clock,
          label: "Sebagian"
        };
      case "TERTINGGAL":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
          icon: AlertCircle,
          label: "Tertinggal"
        };
      case "BELUM ADA JURNAL":
        return {
          bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
          icon: AlertTriangle,
          label: "Belum Ada Jurnal"
        };
      case "TIDAK ADA TARGET":
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
          icon: Info,
          label: "Tidak Ada Target"
        };
      case "TIDAK ADA JADWAL":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
          icon: Calendar,
          label: "Tidak Ada Jadwal"
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-300",
          icon: Info,
          label: status
        };
    }
  };

  // Status Badge Helper for Material Progress (Phase 3B)
  const getMaterialStatusBadge = (status: MaterialProgressStatus) => {
    switch (status) {
      case "SELESAI":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
          icon: CheckCircle2,
          label: "Selesai"
        };
      case "SEDANG_BERJALAN":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
          icon: Clock,
          label: "Sedang Berjalan"
        };
      case "BELUM_DIMULAI":
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
          icon: Calendar,
          label: "Belum Dimulai"
        };
      case "BELUM_ADA_JURNAL":
        return {
          bg: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800",
          icon: AlertTriangle,
          label: "Belum Ada Jurnal"
        };
      case "TERTINGGAL":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
          icon: AlertCircle,
          label: "Tertinggal"
        };
      case "DI_LUAR_RENCANA":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
          icon: Info,
          label: "Di Luar Rencana"
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-700 border-slate-300",
          icon: Info,
          label: status
        };
    }
  };

  // Active Filter Labels for Display in Report & Export (Phase 3C-3)
  const activeTeacherLabel = useMemo(() => {
    if (filterTeacherId === "ALL") return "Semua Guru";
    return teachers.find(t => t.id === filterTeacherId)?.name || filterTeacherId;
  }, [filterTeacherId, teachers]);

  const activeSubjectLabel = useMemo(() => {
    if (filterSubjectId === "ALL") return "Semua Mata Pelajaran";
    return subjects.find(s => s.id === filterSubjectId)?.name || filterSubjectId;
  }, [filterSubjectId, subjects]);

  const activeClassLabel = useMemo(() => {
    if (filterClassId === "ALL") return "Semua Kelas";
    return classes.find(c => c.id === filterClassId)?.name || filterClassId;
  }, [filterClassId, classes]);

  const activeStatusLabel = useMemo(() => {
    if (filterStatus === "ALL") return "Semua Status";
    return filterStatus;
  }, [filterStatus]);

  // Executive summary based on current filtered items (Phase 3C-3)
  const filteredExecutiveSummary = useMemo(() => {
    return learningProgressMonitoringService.aggregateExecutiveSummary(filteredTopicItems);
  }, [filteredTopicItems]);

  const filteredJpSummary = useMemo(() => {
    let totalTargetJP = 0;
    let totalRealizedJP = 0;
    filteredItems.forEach(i => {
      totalTargetJP += Number(i.targetJP || 0);
      totalRealizedJP += Number(i.realizedJP || 0);
    });
    const differenceJP = totalRealizedJP - totalTargetJP;
    const overallPercentage = totalTargetJP > 0 ? Math.round((totalRealizedJP / totalTargetJP) * 100) : (totalRealizedJP > 0 ? 100 : 0);
    return {
      totalItems: filteredItems.length,
      totalTargetJP,
      totalRealizedJP,
      differenceJP,
      overallPercentage
    };
  }, [filteredItems]);

  // Tab switcher handler
  const handleTabChange = (newTab: "JP" | "MATERI") => {
    setActiveTab(newTab);
    setFilterStatus("ALL");
  };

  // Export to Excel (supports both JP Progress and Material Progress with Executive Summary Sheet - Phase 3C-3)
  const handleExportExcel = () => {
    const timestampStr = new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });

    if (activeTab === "JP") {
      if (filteredItems.length === 0) return;

      const summaryData = [
        { Parameter: "SATUAN PENDIDIKAN", Nilai: "SMP ALKARIM RASYID" },
        { Parameter: "DOKUMEN", Nilai: "LAPORAN EKSEKUTIF MONITORING PROGRES PEMBELAJARAN (BEBAN MENGAJAR JP)" },
        { Parameter: "Waktu Cetak", Nilai: timestampStr },
        { Parameter: "Tahun Pelajaran", Nilai: activeAy?.year || "-" },
        { Parameter: "Semester", Nilai: activeSem?.name || "-" },
        { Parameter: "Mode Evaluasi", Nilai: periodMode === "current_week" ? "Pekan Berjalan" : periodMode === "specific_week" ? "Pilih Pekan" : "Kumulatif Semester" },
        { Parameter: "Rentang Periode", Nilai: `${activeDateBounds.label} (${activeDateBounds.startDate} s/d ${activeDateBounds.endDate})` },
        { Parameter: "Filter Guru", Nilai: activeTeacherLabel },
        { Parameter: "Filter Mapel", Nilai: activeSubjectLabel },
        { Parameter: "Filter Kelas", Nilai: activeClassLabel },
        { Parameter: "Filter Status", Nilai: activeStatusLabel },
        { Parameter: "Pencarian", Nilai: searchQuery || "-" },
        { Parameter: "--- RINGKASAN METRIK ---", Nilai: "-------------------------" },
        { Parameter: "Total Data Terpantau", Nilai: filteredItems.length },
        { Parameter: "Total Target Beban JP", Nilai: filteredJpSummary.totalTargetJP },
        { Parameter: "Total Realisasi JP Terlapor", Nilai: filteredJpSummary.totalRealizedJP },
        { Parameter: "Selisih Netto JP", Nilai: filteredJpSummary.differenceJP > 0 ? `+${filteredJpSummary.differenceJP}` : filteredJpSummary.differenceJP },
        { Parameter: "Tingkat Ketercapaian Kumulatif (%)", Nilai: `${filteredJpSummary.overallPercentage}%` }
      ];

      const dataToExport = filteredItems.map((item, idx) => ({
        No: idx + 1,
        Periode: item.periodLabel,
        "Guru Pengampu": item.teacherName,
        "Mata Pelajaran": item.subjectName,
        Kelas: item.className,
        "Target Pembelajaran (Prosem)": item.targetTitles.join("; ") || (item.hasProsemTarget ? "Target Terjadwal" : "Belum Ditentukan"),
        "Target JP": item.targetJP,
        "Realisasi JP": item.realizedJP,
        "Selisih JP": item.differenceJP > 0 ? `+${item.differenceJP}` : item.differenceJP,
        "Progres (%)": `${item.progressPercentage}%`,
        Status: item.status,
        "Catatan Evaluasi": item.statusNotes || "-"
      }));

      const workbook = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 35 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(workbook, wsSummary, "Ringkasan_Eksekutif");

      const wsDetail = XLSX.utils.json_to_sheet(dataToExport);
      wsDetail["!cols"] = [
        { wch: 6 },
        { wch: 18 },
        { wch: 25 },
        { wch: 20 },
        { wch: 10 },
        { wch: 35 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(workbook, wsDetail, "Rincian_Progres_JP");

      XLSX.writeFile(
        workbook,
        `Laporan_Eksekutif_Progres_JP_${activeDateBounds.startDate}_sd_${activeDateBounds.endDate}.xlsx`
      );
    } else {
      if (filteredTopicItems.length === 0) return;

      const summaryData = [
        { Parameter: "SATUAN PENDIDIKAN", Nilai: "SMP ALKARIM RASYID" },
        { Parameter: "DOKUMEN", Nilai: "LAPORAN EKSEKUTIF MONITORING PROGRES MATERI KURIKULUM (PROSEM & JURNAL)" },
        { Parameter: "Waktu Cetak", Nilai: timestampStr },
        { Parameter: "Tahun Pelajaran", Nilai: activeAy?.year || "-" },
        { Parameter: "Semester", Nilai: activeSem?.name || "-" },
        { Parameter: "Mode Evaluasi", Nilai: periodMode === "current_week" ? "Pekan Berjalan" : periodMode === "specific_week" ? "Pilih Pekan" : "Kumulatif Semester" },
        { Parameter: "Rentang Periode", Nilai: `${activeDateBounds.label} (${activeDateBounds.startDate} s/d ${activeDateBounds.endDate})` },
        { Parameter: "Filter Guru", Nilai: activeTeacherLabel },
        { Parameter: "Filter Mapel", Nilai: activeSubjectLabel },
        { Parameter: "Filter Kelas", Nilai: activeClassLabel },
        { Parameter: "Filter Status", Nilai: activeStatusLabel },
        { Parameter: "Pencarian", Nilai: searchQuery || "-" },
        { Parameter: "--- RINGKASAN METRIK ---", Nilai: "-------------------------" },
        { Parameter: "Total Topik Terpantau", Nilai: filteredTopicItems.length },
        { Parameter: "Rombel-Mapel Terpantau", Nilai: filteredExecutiveSummary.monitoredClassSubjectCount },
        { Parameter: "Total Target Beban JP", Nilai: filteredExecutiveSummary.totalTargetJP },
        { Parameter: "Total Realisasi JP Terlapor", Nilai: filteredExecutiveSummary.totalRealizedJP },
        { Parameter: "Selisih Netto JP", Nilai: filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP },
        { Parameter: "Tingkat Ketercapaian Kumulatif (%)", Nilai: `${filteredExecutiveSummary.totalTargetJP > 0 ? Math.round((filteredExecutiveSummary.totalRealizedJP / filteredExecutiveSummary.totalTargetJP) * 100) : 0}%` },
        { Parameter: "--- DISTRIBUSI STATUS TOPIK ---", Nilai: "-------------------------" },
        { Parameter: "Topik Selesai", Nilai: filteredExecutiveSummary.completedCount },
        { Parameter: "Topik Sedang Berjalan", Nilai: filteredExecutiveSummary.inProgressCount },
        { Parameter: "Topik Belum Dimulai", Nilai: filteredExecutiveSummary.unstartedCount },
        { Parameter: "Topik Belum Ada Jurnal", Nilai: filteredExecutiveSummary.noJournalCount },
        { Parameter: "Topik Tertinggal", Nilai: filteredExecutiveSummary.delayedCount },
        { Parameter: "Topik Di Luar Rencana", Nilai: filteredExecutiveSummary.outOfProsemCount }
      ];

      const dataToExport = filteredTopicItems.map((item, idx) => {
        const resolvedTeacher = classSubjectToTeacherMap.get(`${item.classId}_${item.subjectId}`);
        const effectiveTeacherName = item.teacherName || resolvedTeacher?.teacherName || "-";
        return {
          No: idx + 1,
          Kelas: item.className || item.classId,
          "Mata Pelajaran": item.subjectName || item.subjectId,
          "Guru Pengampu": effectiveTeacherName,
          "Urutan Topik": item.topicOrder || idx + 1,
          "Topik Pembelajaran": item.topicTitle,
          "Target JP Pekan": item.targetJP,
          "Target JP Semester": item.semesterTargetJP !== undefined ? item.semesterTargetJP : item.targetJP,
          "Realisasi JP": item.realizedJP,
          "Selisih JP": item.differenceJP > 0 ? `+${item.differenceJP}` : item.differenceJP,
          "Progres (%)": `${item.progressPercentage}%`,
          "Raw Progres (%)": `${item.rawProgressPercentage}%`,
          Status: item.status,
          "Jumlah Pertemuan Prosem": item.plannedMeetings?.length || 0,
          "Jumlah Jurnal": item.journals?.length || 0,
          "Slot Jadwal KBM": item.schedules?.length || 0,
          "Catatan Evaluasi": item.statusNotes || "-"
        };
      });

      const workbook = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 35 }, { wch: 60 }];
      XLSX.utils.book_append_sheet(workbook, wsSummary, "Ringkasan_Eksekutif");

      const wsDetail = XLSX.utils.json_to_sheet(dataToExport);
      wsDetail["!cols"] = [
        { wch: 6 },
        { wch: 10 },
        { wch: 22 },
        { wch: 25 },
        { wch: 12 },
        { wch: 32 },
        { wch: 14 },
        { wch: 16 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 30 }
      ];
      XLSX.utils.book_append_sheet(workbook, wsDetail, "Rincian_Progres_Materi");

      XLSX.writeFile(
        workbook,
        `Laporan_Eksekutif_Progres_Materi_${activeDateBounds.startDate}_sd_${activeDateBounds.endDate}.xlsx`
      );
    }
  };

  // Export to PDF (structured table format with school header and summary - Phase 3C-3)
  const handleExportPdf = () => {
    const timestampStr = new Date().toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    });

    if (activeTab === "JP") {
      if (filteredItems.length === 0) return;

      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = 297;
      const margin = 14;
      const printableWidth = pageWidth - margin * 2; // 269mm

      // Header Section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("SMP ALKARIM RASYID", margin, 14);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("LAPORAN EKSEKUTIF MONITORING PROGRES PEMBELAJARAN (BEBAN MENGAJAR JP)", margin, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(
        `Tahun Pelajaran: ${activeAy?.year || "-"}  |  Semester: ${activeSem?.name || "-"}  |  Periode: ${activeDateBounds.label} (${activeDateBounds.startDate} s/d ${activeDateBounds.endDate})  |  Waktu Cetak: ${timestampStr}`,
        margin,
        25
      );
      doc.text(
        `Filter: Guru: ${activeTeacherLabel}  |  Mapel: ${activeSubjectLabel}  |  Kelas: ${activeClassLabel}  |  Status: ${activeStatusLabel}`,
        margin,
        29
      );

      // Mini KPI Bar
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(margin, 32, printableWidth, 7, "F");
      doc.setDrawColor(203, 213, 225); // slate-300
      doc.rect(margin, 32, printableWidth, 7, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const diffJP = filteredJpSummary.differenceJP;
      const diffStr = diffJP > 0 ? `+${diffJP}` : `${diffJP}`;
      doc.text(
        `Total Guru-Mapel: ${filteredItems.length}   |   Target: ${filteredJpSummary.totalTargetJP} JP   |   Realisasi: ${filteredJpSummary.totalRealizedJP} JP   |   Selisih: ${diffStr} JP   |   Capaian Keseluruhan: ${filteredJpSummary.overallPercentage}%`,
        margin + 3,
        36.5
      );

      // Table Header Definitions
      const columns = [
        { header: "No", width: 10, align: "center" as const },
        { header: "Guru Pengampu", width: 45, align: "left" as const },
        { header: "Mata Pelajaran", width: 35, align: "left" as const },
        { header: "Kelas", width: 18, align: "center" as const },
        { header: "Target Pembelajaran (Prosem)", width: 65, align: "left" as const },
        { header: "Target", width: 18, align: "center" as const },
        { header: "Realisasi", width: 18, align: "center" as const },
        { header: "Selisih", width: 16, align: "center" as const },
        { header: "Progres", width: 18, align: "center" as const },
        { header: "Status", width: 26, align: "center" as const }
      ];

      const drawTableHeader = (startY: number) => {
        doc.setFillColor(226, 232, 240); // slate-200
        doc.rect(margin, startY, printableWidth, 7, "F");
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, startY, printableWidth, 7, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);

        let currX = margin;
        columns.forEach(col => {
          if (col.align === "center") {
            doc.text(col.header, currX + col.width / 2, startY + 4.8, { align: "center" });
          } else {
            doc.text(col.header, currX + 2, startY + 4.8);
          }
          currX += col.width;
        });
      };

      let y = 42;
      drawTableHeader(y);
      y += 7;

      filteredItems.forEach((item, idx) => {
        if (y > 185) {
          doc.addPage();
          y = 15;
          drawTableHeader(y);
          y += 7;
        }

        // Alternating background
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, printableWidth, 6, "F");
        }
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + 6, margin + printableWidth, y + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);

        const diffRow = item.differenceJP > 0 ? `+${item.differenceJP}` : `${item.differenceJP}`;
        const targetTitleStr = item.targetTitles.length > 0 ? item.targetTitles[0] : (item.hasProsemTarget ? "Target Terjadwal" : "-");

        let currX = margin;
        // No
        doc.text(String(idx + 1), currX + columns[0].width / 2, y + 4.2, { align: "center" });
        currX += columns[0].width;
        // Guru
        doc.text(item.teacherName.slice(0, 24), currX + 2, y + 4.2);
        currX += columns[1].width;
        // Mapel
        doc.text(item.subjectName.slice(0, 18), currX + 2, y + 4.2);
        currX += columns[2].width;
        // Kelas
        doc.text(item.className, currX + columns[3].width / 2, y + 4.2, { align: "center" });
        currX += columns[3].width;
        // Target Title
        doc.text(targetTitleStr.slice(0, 36), currX + 2, y + 4.2);
        currX += columns[4].width;
        // Target JP
        doc.text(`${item.targetJP} JP`, currX + columns[5].width / 2, y + 4.2, { align: "center" });
        currX += columns[5].width;
        // Realisasi JP
        doc.text(`${item.realizedJP} JP`, currX + columns[6].width / 2, y + 4.2, { align: "center" });
        currX += columns[6].width;
        // Selisih
        doc.text(`${diffRow} JP`, currX + columns[7].width / 2, y + 4.2, { align: "center" });
        currX += columns[7].width;
        // Progres
        doc.text(`${item.progressPercentage}%`, currX + columns[8].width / 2, y + 4.2, { align: "center" });
        currX += columns[8].width;
        // Status
        doc.setFont("helvetica", "bold");
        doc.text(item.status, currX + columns[9].width / 2, y + 4.2, { align: "center" });
        doc.setFont("helvetica", "normal");

        y += 6;
      });

      // Page numbering footer on all pages
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("SIMAK SMP Alkarim Rasyid • Sistem Informasi Manajemen Akademik", margin, 203);
        doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin - 25, 203);
      }

      doc.save(`Laporan_Eksekutif_Progres_JP_${activeDateBounds.startDate}_sd_${activeDateBounds.endDate}.pdf`);
    } else {
      if (filteredTopicItems.length === 0) return;

      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = 297;
      const margin = 14;
      const printableWidth = pageWidth - margin * 2; // 269mm

      // Header Section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("SMP ALKARIM RASYID", margin, 14);

      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("LAPORAN EKSEKUTIF MONITORING PROGRES MATERI KURIKULUM (PROSEM & JURNAL)", margin, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(
        `Tahun Pelajaran: ${activeAy?.year || "-"}  |  Semester: ${activeSem?.name || "-"}  |  Periode: ${activeDateBounds.label} (${activeDateBounds.startDate} s/d ${activeDateBounds.endDate})  |  Waktu Cetak: ${timestampStr}`,
        margin,
        25
      );
      doc.text(
        `Filter: Guru: ${activeTeacherLabel}  |  Mapel: ${activeSubjectLabel}  |  Kelas: ${activeClassLabel}  |  Status: ${activeStatusLabel}`,
        margin,
        29
      );

      // Mini KPI Bar
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, 32, printableWidth, 7, "F");
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, 32, printableWidth, 7, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const diffJP = filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP;
      const diffStr = diffJP > 0 ? `+${diffJP}` : `${diffJP}`;
      const pctRate = filteredExecutiveSummary.totalTargetJP > 0 ? Math.round((filteredExecutiveSummary.totalRealizedJP / filteredExecutiveSummary.totalTargetJP) * 100) : 0;
      doc.text(
        `Total Topik: ${filteredTopicItems.length}   |   Target: ${filteredExecutiveSummary.totalTargetJP} JP   |   Realisasi: ${filteredExecutiveSummary.totalRealizedJP} JP   |   Selisih: ${diffStr} JP   |   Capaian: ${pctRate}%   |   Selesai: ${filteredExecutiveSummary.completedCount}   |   Berjalan: ${filteredExecutiveSummary.inProgressCount}   |   Tertinggal: ${filteredExecutiveSummary.delayedCount}`,
        margin + 3,
        36.5
      );

      // Table Header Definitions for MATERI
      const columns = [
        { header: "No", width: 10, align: "center" as const },
        { header: "Kelas", width: 14, align: "center" as const },
        { header: "Mata Pelajaran", width: 32, align: "left" as const },
        { header: "Guru Pengampu", width: 38, align: "left" as const },
        { header: "Topik Pembelajaran", width: 73, align: "left" as const },
        { header: "Target", width: 16, align: "center" as const },
        { header: "Realisasi", width: 18, align: "center" as const },
        { header: "Selisih", width: 16, align: "center" as const },
        { header: "Progres", width: 18, align: "center" as const },
        { header: "Status", width: 34, align: "center" as const }
      ];

      const drawTableHeader = (startY: number) => {
        doc.setFillColor(226, 232, 240);
        doc.rect(margin, startY, printableWidth, 7, "F");
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, startY, printableWidth, 7, "S");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(51, 65, 85);

        let currX = margin;
        columns.forEach(col => {
          if (col.align === "center") {
            doc.text(col.header, currX + col.width / 2, startY + 4.8, { align: "center" });
          } else {
            doc.text(col.header, currX + 2, startY + 4.8);
          }
          currX += col.width;
        });
      };

      let y = 42;
      drawTableHeader(y);
      y += 7;

      filteredTopicItems.forEach((item, idx) => {
        if (y > 185) {
          doc.addPage();
          y = 15;
          drawTableHeader(y);
          y += 7;
        }

        // Alternating background
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, printableWidth, 6, "F");
        }
        doc.setDrawColor(241, 245, 249);
        doc.line(margin, y + 6, margin + printableWidth, y + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);

        const resolvedTeacher = classSubjectToTeacherMap.get(`${item.classId}_${item.subjectId}`);
        const effectiveTeacherName = item.teacherName || resolvedTeacher?.teacherName || "-";
        const diffRow = item.differenceJP > 0 ? `+${item.differenceJP}` : `${item.differenceJP}`;

        let currX = margin;
        // No
        doc.text(String(idx + 1), currX + columns[0].width / 2, y + 4.2, { align: "center" });
        currX += columns[0].width;
        // Kelas
        doc.text(item.className || item.classId, currX + columns[1].width / 2, y + 4.2, { align: "center" });
        currX += columns[1].width;
        // Mapel
        doc.text((item.subjectName || item.subjectId).slice(0, 18), currX + 2, y + 4.2);
        currX += columns[2].width;
        // Guru
        doc.text(effectiveTeacherName.slice(0, 20), currX + 2, y + 4.2);
        currX += columns[3].width;
        // Topik
        doc.text(item.topicTitle.slice(0, 42), currX + 2, y + 4.2);
        currX += columns[4].width;
        // Target
        doc.text(`${item.targetJP} JP`, currX + columns[5].width / 2, y + 4.2, { align: "center" });
        currX += columns[5].width;
        // Realisasi
        doc.text(`${item.realizedJP} JP`, currX + columns[6].width / 2, y + 4.2, { align: "center" });
        currX += columns[6].width;
        // Selisih
        doc.text(`${diffRow} JP`, currX + columns[7].width / 2, y + 4.2, { align: "center" });
        currX += columns[7].width;
        // Progres
        doc.text(`${item.progressPercentage}%`, currX + columns[8].width / 2, y + 4.2, { align: "center" });
        currX += columns[8].width;
        // Status
        doc.setFont("helvetica", "bold");
        doc.text(item.status, currX + columns[9].width / 2, y + 4.2, { align: "center" });
        doc.setFont("helvetica", "normal");

        y += 6;
      });

      // Page numbering footer on all pages
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text("SIMAK SMP Alkarim Rasyid • Sistem Informasi Manajemen Akademik", margin, 203);
        doc.text(`Halaman ${p} dari ${totalPages}`, pageWidth - margin - 25, 203);
      }

      doc.save(`Laporan_Eksekutif_Progres_Materi_${activeDateBounds.startDate}_sd_${activeDateBounds.endDate}.pdf`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 dark:from-zinc-900 dark:to-zinc-950 text-white p-6 rounded-2xl shadow-lg border border-indigo-800/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight">
              Monitoring Progres Pembelajaran Mingguan
            </h1>
          </div>
          <p className="text-xs md:text-sm text-indigo-200/90 max-w-3xl">
            Audit kesesuaian antara rencana program semester (Prosem), jadwal operasional KBM pondok (Sabtu–Kamis),
            dan bukti pelaksanaan jurnal mengajar secara objektif & deterministik.
          </p>
        </div>

        {/* Action Controls (Phase 3C-3: Executive Report & Formatted Exports) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              refetch();
              refetchMaterial();
            }}
            disabled={isFetching || isFetchingMaterial}
            className="px-3 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl text-xs font-bold border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching || isFetchingMaterial ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowExecutiveReportModal(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            title="Buka Ringkasan Laporan Eksekutif"
          >
            <FileText className="w-3.5 h-3.5" />
            Laporan Eksekutif
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            title="Ekspor ke Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            title="Ekspor ke PDF"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Mode Tab Switcher: Progres JP vs Progres Materi (Phase 3B) */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
        <button
          type="button"
          onClick={() => handleTabChange("JP")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "JP"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-white dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Progres Beban JP (Jam Mengajar)</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("MATERI")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "MATERI"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
              : "bg-white dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Progres Materi Kurikulum</span>
          {materialResult?.totalPlannedTopics !== undefined && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === "MATERI"
                ? "bg-white/20 text-white"
                : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            }`}>
              {materialResult.totalPlannedTopics} Topik
            </span>
          )}
        </button>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
        {/* Row 1: Academic Year, Semester, and Period Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-150 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            {/* Academic Year Selector */}
            <select
              value={currentAyId}
              onChange={(e) => setSelectedAyId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {academicYears.map(ay => (
                <option key={ay.id} value={ay.id}>
                  TP: {ay.year} {ay.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>

            {/* Semester Selector */}
            <select
              value={currentSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {semesters
                .filter(s => !currentAyId || s.academicYearId === currentAyId)
                .map(s => (
                  <option key={s.id} value={s.id}>
                    Semester: {s.name} {s.isActive ? "(Aktif)" : ""}
                  </option>
                ))}
            </select>
          </div>

          {/* Period Mode Selector (Phase 3C-1: Pekan Berjalan, Pilih Pekan, Kumulatif) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl flex-wrap">
            <button
              type="button"
              onClick={() => setPeriodMode("current_week")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodMode === "current_week"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Pekan Berjalan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("specific_week")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodMode === "specific_week"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Pilih Pekan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("cumulative")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                periodMode === "cumulative"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              }`}
            >
              Kumulatif
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Period Pickers depending on mode (Phase 3C-1) */}
        {periodMode === "current_week" && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50/70 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-900 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Pekan Berjalan:</strong> {semesterWeeks[currentWeekIndex]?.label || "Pekan 1"} ({formatIndonesianDateShort(activeDateBounds.startDate)} s/d {formatIndonesianDateShort(activeDateBounds.endDate)})
              </span>
            </div>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              Siklus Operasional KBM: Sabtu s/d Kamis (Jumat Libur Pondok) • Asia/Jakarta
            </span>
          </div>
        )}

        {periodMode === "specific_week" && (
          <div className="flex flex-wrap items-center gap-3 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/40">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              Pilih Pekan Pembelajaran:
            </span>
            <select
              value={selectedWeekIndex}
              onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden"
            >
              {semesterWeeks.map((w, idx) => (
                <option key={w.weekNumber} value={idx}>
                  {w.label} {w.isCurrentWeek ? "★ [Pekan Berjalan]" : ""} ({formatIndonesianDateShort(w.startDate)} s/d {formatIndonesianDateShort(w.endDate)})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              (Siklus: Sabtu s/d Kamis)
            </span>
          </div>
        )}

        {periodMode === "cumulative" && (
          <div className="flex flex-wrap items-center gap-3 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/40">
            <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Kumulatif Semester s/d Pekan:
            </span>
            <select
              value={selectedWeekIndex}
              onChange={(e) => setSelectedWeekIndex(Number(e.target.value))}
              className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold text-slate-800 dark:text-zinc-200 focus:outline-hidden"
            >
              {semesterWeeks.map((w, idx) => (
                <option key={w.weekNumber} value={idx}>
                  Sampai {w.label} {w.isCurrentWeek ? "★ [Pekan Berjalan]" : ""} (s/d {formatIndonesianDateShort(w.endDate)})
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
              (Rentang: {formatIndonesianDateShort(semesterStartDate)} s/d {formatIndonesianDateShort(semesterWeeks[selectedWeekIndex]?.endDate || semesterStartDate)})
            </span>
          </div>
        )}

        {/* Row 3: Entity Filters (Guru, Mapel, Kelas, Status, Search) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          {/* Guru Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Guru Pengampu
            </label>
            <select
              value={filterTeacherId}
              onChange={(e) => setFilterTeacherId(e.target.value)}
              disabled={isGuru}
              className={`w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-hidden ${
                isGuru ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {!isGuru && <option value="ALL">Semua Guru ({teachers.length})</option>}
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Mapel Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Mata Pelajaran
            </label>
            <select
              value={filterSubjectId}
              onChange={(e) => setFilterSubjectId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-hidden"
            >
              <option value="ALL">Semua Mata Pelajaran</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Kelas Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Kelas
            </label>
            <select
              value={filterClassId}
              onChange={(e) => setFilterClassId(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-hidden"
            >
              <option value="ALL">Semua Kelas</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Status Progres
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-200 focus:outline-hidden"
            >
              <option value="ALL">Semua Status</option>
              {activeTab === "JP" ? (
                <>
                  <option value="SESUAI RENCANA">Sesuai Rencana</option>
                  <option value="LEBIH CEPAT">Lebih Cepat</option>
                  <option value="SEBAGIAN">Sebagian</option>
                  <option value="TERTINGGAL">Tertinggal</option>
                  <option value="BELUM ADA JURNAL">Belum Ada Jurnal</option>
                  <option value="TIDAK ADA TARGET">Tidak Ada Target</option>
                  <option value="TIDAK ADA JADWAL">Tidak Ada Jadwal</option>
                </>
              ) : (
                <>
                  <option value="SELESAI">Selesai</option>
                  <option value="SEDANG_BERJALAN">Sedang Berjalan</option>
                  <option value="BELUM_DIMULAI">Belum Dimulai</option>
                  <option value="BELUM_ADA_JURNAL">Belum Ada Jurnal</option>
                  <option value="TERTINGGAL">Tertinggal</option>
                  <option value="DI_LUAR_RENCANA">Di Luar Rencana</option>
                </>
              )}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Pencarian Cepat
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === "JP" ? "Cari guru / mapel / kelas..." : "Cari topik / guru / mapel / kelas..."}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-200 focus:outline-hidden"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. JP Progress View (When Tab === "JP") */}
      {activeTab === "JP" && (
        <div className="space-y-6">
          {/* Summary Cards (Dashboard Wakakur / Kepala Sekolah) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Sesuai Rencana */}
        <div 
          onClick={() => setFilterStatus(filterStatus === "SESUAI RENCANA" ? "ALL" : "SESUAI RENCANA")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "SESUAI RENCANA"
              ? "ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Sesuai Rencana
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {summary.sesuaiRencanaCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
            Target 100% Tercapai
          </span>
        </div>

        {/* Card 2: Lebih Cepat */}
        <div 
          onClick={() => setFilterStatus(filterStatus === "LEBIH CEPAT" ? "ALL" : "LEBIH CEPAT")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "LEBIH CEPAT"
              ? "ring-2 ring-blue-500 bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-blue-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Lebih Cepat
            </span>
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
            {summary.lebihCepatCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
            Melampaui Target
          </span>
        </div>

        {/* Card 3: Sebagian */}
        <div 
          onClick={() => setFilterStatus(filterStatus === "SEBAGIAN" ? "ALL" : "SEBAGIAN")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "SEBAGIAN"
              ? "ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-amber-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Sebagian
            </span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {summary.sebagianCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
            1 JP s/d &lt; Target
          </span>
        </div>

        {/* Card 4: Tertinggal */}
        <div 
          onClick={() => setFilterStatus(filterStatus === "TERTINGGAL" ? "ALL" : "TERTINGGAL")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "TERTINGGAL"
              ? "ring-2 ring-rose-500 bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Tertinggal
            </span>
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
            {summary.tertinggalCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
            Perlu Tindak Lanjut
          </span>
        </div>

        {/* Card 5: Belum Ada Jurnal */}
        <div 
          onClick={() => setFilterStatus(filterStatus === "BELUM ADA JURNAL" ? "ALL" : "BELUM ADA JURNAL")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "BELUM ADA JURNAL"
              ? "ring-2 ring-orange-500 bg-orange-50/80 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-orange-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
              Belum Ada Jurnal
            </span>
            <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="text-2xl font-black text-orange-700 dark:text-orange-300 mt-1">
            {summary.belumAdaJurnalCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
            Jadwal Ada, Belum Diisi
          </span>
        </div>

        {/* Card 6: Tidak Ada Target */}
        <div 
          onClick={() => setFilterStatus(filterStatus === "TIDAK ADA TARGET" ? "ALL" : "TIDAK ADA TARGET")}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterStatus === "TIDAK ADA TARGET"
              ? "ring-2 ring-slate-500 bg-slate-100 dark:bg-zinc-800 border-slate-400"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-400"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Tidak Ada Target
            </span>
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-700 dark:text-zinc-300 mt-1">
            {summary.tidakAdaTargetCount}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
            Prosem Belum Terisi
          </span>
        </div>
      </div>

      {/* Aggregate Volume Banner */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700 dark:text-zinc-300">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            Total Beban Mapel/Kelas: <strong className="text-slate-900 dark:text-zinc-100">{summary.totalItems} rombel</strong>
          </div>
          <div>
            Akumulasi Target KBM: <strong className="text-indigo-600 dark:text-indigo-400">{summary.totalTargetJP} JP</strong>
          </div>
          <div>
            Akumulasi Realisasi Jurnal: <strong className="text-emerald-600 dark:text-emerald-400">{summary.totalRealizedJP} JP</strong>
          </div>
          <div>
            Capaian Keseluruhan: <strong className="text-blue-600 dark:text-blue-400">{summary.overallPercentage}%</strong>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-zinc-400">
          Menampilkan: <strong>{filteredItems.length}</strong> dari {rawItems.length} kombinasi rombel/mapel
        </div>
      </div>

      {/* 4. Main Monitoring Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm font-semibold">Mengagregasi data Prosem, Jadwal KBM, dan Jurnal Mengajar...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-zinc-500 space-y-2">
            <Layers className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">Tidak ada data progres pembelajaran yang cocok</p>
            <p className="text-xs">Pastikan filter Tahun Pelajaran, Semester, dan filter lainnya sudah sesuai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-700">
                  <th className="py-3 px-3 text-center w-12">No</th>
                  <th className="py-3 px-4">Guru Pengampu</th>
                  <th className="py-3 px-3">Mata Pelajaran</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-4">Target Pembelajaran (Prosem)</th>
                  <th className="py-3 px-3 text-center">Target JP</th>
                  <th className="py-3 px-3 text-center">Realisasi JP</th>
                  <th className="py-3 px-3 text-center">Selisih</th>
                  <th className="py-3 px-3 text-center">Progres</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60 font-medium text-slate-800 dark:text-zinc-200">
                {filteredItems.map((item, idx) => {
                  const badge = getStatusBadge(item.status);
                  const BadgeIcon = badge.icon;
                  const diffColor = item.differenceJP > 0
                    ? "text-blue-600 dark:text-blue-400 font-bold"
                    : item.differenceJP < 0
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : "text-slate-400 font-semibold";

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-zinc-100">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{item.teacherName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-zinc-200">
                        {item.subjectName}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-bold text-[11px] border border-slate-200/80 dark:border-zinc-700">
                          {item.className}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {item.targetTitles.length > 0 ? (
                          <div className="space-y-0.5 max-w-xs">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100 line-clamp-1" title={item.targetTitles.join(", ")}>
                              {item.targetTitles[0]}
                            </div>
                            {item.targetTitles.length > 1 && (
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                +{item.targetTitles.length - 1} materi lainnya
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">
                            {item.hasProsemTarget ? "Target KBM Terjadwal" : "Belum teralokasi di Prosem"}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/20">
                        {item.targetJP} <span className="text-[10px] font-normal text-slate-400">JP</span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                        {item.realizedJP} <span className="text-[10px] font-normal text-slate-400">JP</span>
                      </td>
                      <td className={`py-3.5 px-3 text-center font-mono ${diffColor}`}>
                        {item.differenceJP > 0 ? `+${item.differenceJP}` : item.differenceJP} <span className="text-[10px] font-normal text-slate-400">JP</span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-xs">
                            {item.progressPercentage}%
                          </span>
                          <div className="w-16 bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.progressPercentage >= 100
                                  ? "bg-emerald-500"
                                  : item.progressPercentage >= 50
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${Math.min(100, item.progressPercentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                          <BadgeIcon className="w-3 h-3 shrink-0" />
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(item)}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all border border-indigo-200/80 dark:border-indigo-800 cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detail
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
    </div>
  )}

  {/* 4. Material Progress View (When Tab === "MATERI" - Phase 3B) */}
  {activeTab === "MATERI" && (
    <div className="space-y-6">
      {/* Executive Overview Summary Cards for Wakakur & Kepala Sekolah (Phase 3C-1) */}
      <div className="space-y-3">
        {/* Row 1: Metrik Operasional KBM (Kelas & Mapel, Target JP, Realisasi JP) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card A: Kelas & Mapel Terpantau */}
          <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                Kelas & Mapel Terpantau
              </span>
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
              {executiveSummary.monitoredClassSubjectCount} <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">Rombel-Mapel</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Dari total {executiveSummary.totalTopics} topik dalam evaluasi
            </span>
          </div>

          {/* Card B: Target Beban JP */}
          <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                Target Beban Pembelajaran
              </span>
              <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-300 mt-1">
              {executiveSummary.totalTargetJP} <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">JP</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              {periodMode === "cumulative" ? "Alokasi target semester berjalan" : "Alokasi target pekan aktif Prosem"}
            </span>
          </div>

          {/* Card C: Realisasi JP */}
          <div className="p-4 rounded-2xl border bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Realisasi Tatap Muka Terlapor
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {executiveSummary.totalRealizedJP} <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">JP</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Akumulasi riil dari jurnal mengajar terverifikasi
            </span>
          </div>
        </div>

        {/* Row 2: Status Keterlaksanaan Materi Kurikulum (5 Kartu Interaktif: Selesai, Berjalan, Belum Ada Jurnal, Tertinggal, Belum Dimulai) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card D: Selesai */}
          <div 
            onClick={() => setFilterStatus(filterStatus === "SELESAI" ? "ALL" : "SELESAI")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === "SELESAI"
                ? "ring-2 ring-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-md"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Topik Selesai
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
              {executiveSummary.completedCount}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Target 100% terpenuhi
            </span>
          </div>

          {/* Card E: Sedang Berjalan */}
          <div 
            onClick={() => setFilterStatus(filterStatus === "SEDANG_BERJALAN" ? "ALL" : "SEDANG_BERJALAN")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === "SEDANG_BERJALAN"
                ? "ring-2 ring-amber-500 bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 shadow-md"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-amber-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Sedang Berjalan
              </span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1">
              {executiveSummary.inProgressCount}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Dalam realisasi bertahap
            </span>
          </div>

          {/* Card F: Belum Ada Jurnal */}
          <div 
            onClick={() => setFilterStatus(filterStatus === "BELUM_ADA_JURNAL" ? "ALL" : "BELUM_ADA_JURNAL")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === "BELUM_ADA_JURNAL"
                ? "ring-2 ring-orange-500 bg-orange-50/80 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 shadow-md"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-orange-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
                Belum Ada Jurnal
              </span>
              <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-black text-orange-700 dark:text-orange-300 mt-1">
              {executiveSummary.noJournalCount}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Pekan aktif, menunggu jurnal
            </span>
          </div>

          {/* Card G: Tertinggal */}
          <div 
            onClick={() => setFilterStatus(filterStatus === "TERTINGGAL" ? "ALL" : "TERTINGGAL")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === "TERTINGGAL"
                ? "ring-2 ring-rose-500 bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 shadow-md"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-rose-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Tertinggal
              </span>
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1">
              {executiveSummary.delayedCount}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Batas target lewat, 0 JP
            </span>
          </div>

          {/* Card H: Belum Dimulai */}
          <div 
            onClick={() => setFilterStatus(filterStatus === "BELUM_DIMULAI" ? "ALL" : "BELUM_DIMULAI")}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              filterStatus === "BELUM_DIMULAI"
                ? "ring-2 ring-slate-500 bg-slate-100 dark:bg-zinc-800 border-slate-400 shadow-md"
                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 hover:border-slate-400"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Belum Dimulai
              </span>
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-black text-slate-700 dark:text-zinc-300 mt-1">
              {executiveSummary.unstartedCount}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5 block">
              Menunggu jadwal pertemuan
            </span>
          </div>
        </div>
      </div>

      {/* Special Journals Row (OUT_OF_PROSEM and UNLINKED) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Card Di Luar Prosem */}
        <div 
          onClick={() => setShowSpecialJournalsModal("OUT_OF_PROSEM")}
          className="p-3.5 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-purple-100/70 transition-all shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl text-purple-700 dark:text-purple-300">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-purple-900 dark:text-purple-200">
                Jurnal Di Luar Prosem (OUT_OF_PROSEM)
              </div>
              <div className="text-[11px] text-purple-700/80 dark:text-purple-400">
                Sengaja diinput guru di luar materi terencana. Klik untuk melihat daftar.
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-black text-purple-700 dark:text-purple-300">
              {materialResult?.outOfProsemJournals?.length || 0} Jurnal
            </div>
            <div className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
              {materialResult?.outOfProsemJP || 0} JP
            </div>
          </div>
        </div>

        {/* Card Belum Tertaut (Legacy) */}
        <div 
          onClick={() => setShowSpecialJournalsModal("UNLINKED")}
          className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 dark:bg-zinc-700 rounded-xl text-slate-700 dark:text-zinc-300">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                Jurnal Belum Tertaut (Legacy)
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Jurnal lama tanpa topik. Tetap sah & masuk ke Progres Beban JP. Klik untuk rincian.
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-base font-black text-slate-800 dark:text-zinc-200">
              {materialResult?.unlinkedJournals?.length || 0} Jurnal
            </div>
            <div className="text-[10px] font-bold text-slate-600 dark:text-zinc-400">
              {materialResult?.unlinkedJP || 0} JP
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Volume Banner for Material */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-slate-700 dark:text-zinc-300">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            Total Topik Kurikulum: <strong className="text-slate-900 dark:text-zinc-100">{materialResult?.totalPlannedTopics || 0} topik</strong>
          </div>
          <div>
            Topik Selesai: <strong className="text-emerald-600 dark:text-emerald-400">{materialResult?.completedTopicsCount || 0} topik</strong>
          </div>
          <div>
            Topik Berjalan: <strong className="text-amber-600 dark:text-amber-400">{materialResult?.inProgressTopicsCount || 0} topik</strong>
          </div>
          <div>
            Rasio Ketercapaian: <strong className="text-blue-600 dark:text-blue-400">{materialResult?.overallMaterialCompletionRate || 0}%</strong>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 dark:text-zinc-400">
          Menampilkan: <strong>{filteredTopicItems.length}</strong> dari {rawTopicItems.length} topik kurikulum
        </div>
      </div>

      {/* Main Material Progress Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs overflow-hidden">
        {isLoadingMaterial ? (
          <div className="p-12 text-center text-slate-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-sm font-semibold">Mengagregasi data Prota, Prosem, dan Jurnal Materi Kurikulum...</span>
          </div>
        ) : filteredTopicItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-zinc-500 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600" />
            <p className="text-sm font-bold text-slate-600 dark:text-zinc-300">Tidak ada materi pembelajaran yang cocok</p>
            <p className="text-xs">Pastikan filter Tahun Pelajaran, Semester, dan filter lainnya sudah sesuai.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-700">
                  <th className="py-3 px-3 text-center w-12">No</th>
                  <th className="py-3 px-3 text-center">Kelas</th>
                  <th className="py-3 px-3">Mata Pelajaran</th>
                  <th className="py-3 px-4">Guru Pengampu</th>
                  <th className="py-3 px-4">Topik Pembelajaran</th>
                  <th className="py-3 px-3 text-center">
                    {periodMode === "cumulative" ? "Target JP" : "Target JP (Pekan / Sem)"}
                  </th>
                  <th className="py-3 px-3 text-center">Realisasi JP</th>
                  <th className="py-3 px-3 text-center">Selisih</th>
                  <th className="py-3 px-3 text-center min-w-[100px]">Progres</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Rincian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60 font-medium text-slate-800 dark:text-zinc-200">
                {filteredTopicItems.map((item, idx) => {
                  const resolvedTeacher = classSubjectToTeacherMap.get(`${item.classId}_${item.subjectId}`);
                  const effectiveTeacherName = item.teacherName || resolvedTeacher?.teacherName || "-";
                  const badge = getMaterialStatusBadge(item.status);
                  const BadgeIcon = badge.icon;
                  const diffColor = item.differenceJP > 0
                    ? "text-blue-600 dark:text-blue-400 font-bold"
                    : item.differenceJP < 0
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : "text-slate-400 font-semibold";

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded font-bold text-[11px] border border-slate-200/80 dark:border-zinc-700">
                          {item.className || item.classId}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-800 dark:text-zinc-200">
                        {item.subjectName || item.subjectId}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-zinc-100">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{effectiveTeacherName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-sm">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">
                            {item.topicTitle}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400">
                            {item.subtopicsProgress && item.subtopicsProgress.length > 0 && (
                              <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 font-semibold">
                                {item.subtopicsProgress.length} Subtopik
                              </span>
                            )}
                            {item.plannedStartDate && item.plannedEndDate ? (
                              <span>
                                {formatIndonesianDateShort(item.plannedStartDate)} - {formatIndonesianDateShort(item.plannedEndDate)}
                              </span>
                            ) : (
                              <span>{item.meetingCount || 0} Pertemuan Terjadwal</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {periodMode === "cumulative" ? (
                          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {item.targetJP} JP
                          </span>
                        ) : (
                          <div className="font-mono">
                            <div className="font-bold text-indigo-600 dark:text-indigo-400">{item.targetJP} JP</div>
                            <div className="text-[10px] text-slate-400">Sem: {item.semesterTargetJP || 0} JP</div>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{item.realizedJP} JP</div>
                        <div className="text-[10px] text-slate-400">{item.journalCount} jurnal</div>
                      </td>
                      <td className={`py-3.5 px-3 text-center font-mono ${diffColor}`}>
                        {item.differenceJP > 0 ? `+${item.differenceJP}` : item.differenceJP} JP
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-col items-center gap-1 min-w-[90px]">
                          <div className="flex items-center gap-1 font-bold text-xs">
                            <span>{item.progressPercentage}%</span>
                            {item.rawProgressPercentage > 100 && (
                              <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-300 px-1 rounded border border-blue-200 dark:border-blue-800" title={`Raw: ${item.rawProgressPercentage}%`}>
                                +{item.rawProgressPercentage - 100}%
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                item.progressPercentage >= 100
                                  ? "bg-emerald-500"
                                  : item.progressPercentage >= 50
                                  ? "bg-blue-500"
                                  : "bg-amber-500"
                              }`}
                              style={{ width: `${Math.min(100, item.progressPercentage)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <div className="flex flex-col items-center gap-0.5 max-w-[130px] mx-auto">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                            <BadgeIcon className="w-3 h-3 shrink-0" />
                            <span>{badge.label}</span>
                          </span>
                          {item.statusNotes && (
                            <span className="text-[9px] text-slate-500 dark:text-zinc-400 line-clamp-1" title={item.statusNotes}>
                              {item.statusNotes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setDetailTopicItem(item);
                            setTopicEvidenceTab("ALL");
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Rincian</span>
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
    </div>
  )}

      {/* 5. Drill-Down Detail Modal (Read-Only) */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-black uppercase tracking-wider border border-indigo-400/30">
                    Drilldown Progres Pembelajaran
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">• {detailItem.className}</span>
                </div>
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <span>{detailItem.subjectName}</span>
                  <span className="text-slate-400 font-normal">({detailItem.teacherName})</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Metric Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/80 dark:border-indigo-800">
                  <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase">Target Rencana (Prosem)</span>
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                    {detailItem.targetJP} <span className="text-xs font-normal">JP</span>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Realisasi (Jurnal)</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {detailItem.realizedJP} <span className="text-xs font-normal">JP</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">Selisih KBM</span>
                  <div className={`text-xl font-black mt-1 ${detailItem.differenceJP >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                    {detailItem.differenceJP > 0 ? `+${detailItem.differenceJP}` : detailItem.differenceJP} <span className="text-xs font-normal text-slate-400">JP</span>
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">Status & Capaian</span>
                  <div className="text-base font-black text-slate-900 dark:text-zinc-100 mt-1">
                    {detailItem.progressPercentage}%
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                    {detailItem.status}
                  </span>
                </div>
              </div>

              {/* Section A: Rencana Prosem (Target & Alokasi Pertemuan) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  <span>A. Rencana Pembelajaran (Program Semester)</span>
                </div>

                {detailItem.prosemMeetings.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl text-xs text-slate-500 border border-dashed border-slate-200 dark:border-zinc-700">
                    {detailItem.hasProsemTarget
                      ? "Target dialokasikan berdasarkan estimasi beban mingguan Prosem."
                      : "Belum ada alokasi pertemuan atau target materi pada Prosem untuk periode ini."}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                        <tr>
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Tanggal & Hari</th>
                          <th className="py-2 px-3 text-center">Beban JP</th>
                          <th className="py-2 px-3">Topik / Subtopik</th>
                          <th className="py-2 px-3">Tujuan Pembelajaran (TP)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                        {detailItem.prosemMeetings.map((m, mIdx) => (
                          <tr key={m.id || mIdx}>
                            <td className="py-2 px-3 font-bold text-slate-400">{m.meetingNo || mIdx + 1}</td>
                            <td className="py-2 px-3 font-semibold">
                              {formatIndonesianDateShort(m.date)} ({m.dayName})
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600">
                              {m.jpCount} JP
                            </td>
                            <td className="py-2 px-3 font-medium">
                              <div>{m.topicTitle || "-"}</div>
                              {m.subtopicTitle && (
                                <div className="text-[10px] text-slate-500">{m.subtopicTitle}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-zinc-300">
                              {m.tp || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section B: Jadwal Operasional KBM */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>B. Jadwal KBM Operasional Terjadwal</span>
                </div>

                {detailItem.schedules.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl text-xs text-slate-500 border border-dashed border-slate-200 dark:border-zinc-700">
                    Tidak ditemukan slot jadwal KBM aktif untuk kombinasi ini.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {detailItem.schedules.map((s, sIdx) => (
                      <div key={s.id || sIdx} className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
                        <div className="font-bold text-slate-900 dark:text-zinc-100">{s.day}</div>
                        <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                          {s.jp || `Urutan JP ${s.sequence}`}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono truncate" title={s.id}>
                          ID: {s.id || "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section C: Realisasi Aktual Jurnal Mengajar */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>C. Bukti Realisasi Aktual (Jurnal Mengajar)</span>
                </div>

                {detailItem.journals.length === 0 ? (
                  <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl text-xs text-orange-700 dark:text-orange-300 border border-dashed border-orange-200 dark:border-orange-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Belum ada catatan jurnal mengajar yang diinput pada periode ini.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                        <tr>
                          <th className="py-2 px-3">Tanggal</th>
                          <th className="py-2 px-3 text-center">Beban JP</th>
                          <th className="py-2 px-3">Materi Pembelajaran</th>
                          <th className="py-2 px-3">Aktivitas / Metode</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                        {detailItem.journals.map((j, jIdx) => (
                          <tr key={j.id || jIdx}>
                            <td className="py-2.5 px-3 font-semibold">
                              <div>{formatIndonesianDateShort(j.date)}</div>
                              <div className="text-[10px] text-slate-400">{j.dayName}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                              {j.totalJP} JP
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-zinc-100">
                              <div>{j.material || "-"}</div>
                              {j.learningObjectives && (
                                <div className="text-[10px] text-slate-500 line-clamp-1">{j.learningObjectives}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                              <div>{j.learningActivities || "-"}</div>
                              {j.learningMethod && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-medium text-slate-600 mt-1 inline-block">
                                  {j.learningMethod}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                j.status === "Disetujui"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : j.status === "Diajukan"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                {j.status || "Draft"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Section D: Timeline Kumulatif Semester */}
              <div className="space-y-2 pt-2 border-t border-slate-150 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>D. Progres Kumulatif Pekan ke Pekan (Sabtu–Kamis)</span>
                </div>

                {loadingTimeline ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Memuat linimasa kumulatif...
                  </div>
                ) : cumulativeTimeline.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Tidak ada data linimasa kumulatif.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                        <tr>
                          <th className="py-2 px-3 text-center">Pekan</th>
                          <th className="py-2 px-3">Rentang Tanggal</th>
                          <th className="py-2 px-3 text-center">Target Pekan</th>
                          <th className="py-2 px-3 text-center">Realisasi Pekan</th>
                          <th className="py-2 px-3 text-center bg-indigo-50/50 dark:bg-indigo-950/20">Target Kumulatif</th>
                          <th className="py-2 px-3 text-center bg-emerald-50/50 dark:bg-emerald-950/20">Realisasi Kumulatif</th>
                          <th className="py-2 px-3 text-center">Capaian Kumulatif</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800 font-medium">
                        {cumulativeTimeline.map(row => (
                          <tr key={row.weekNumber} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-2 px-3 text-center font-bold text-slate-500">Pekan {row.weekNumber}</td>
                            <td className="py-2 px-3 text-slate-700 dark:text-zinc-300">
                              {formatIndonesianDateShort(row.startDate)} - {formatIndonesianDateShort(row.endDate)}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">{row.targetJP} JP</td>
                            <td className="py-2 px-3 text-center font-mono">{row.realizedJP} JP</td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50/30 dark:bg-indigo-950/10">
                              {row.cumulativeTargetJP} JP
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/10">
                              {row.cumulativeRealizedJP} JP
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold">
                              <span className={row.cumulativeProgressPercentage >= 100 ? "text-emerald-600" : row.cumulativeProgressPercentage >= 75 ? "text-blue-600" : "text-amber-600"}>
                                {row.cumulativeProgressPercentage}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Rincian Topik Materi & Evidence Inspection (Phase 3C-2) */}
      {detailTopicItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-6 flex items-start justify-between">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-white/20 rounded-lg text-[11px] font-black tracking-wider uppercase">
                    {detailTopicItem.className || detailTopicItem.classId} • {detailTopicItem.subjectName || detailTopicItem.subjectId}
                  </span>
                  <span className="px-2.5 py-0.5 bg-indigo-400/30 rounded-lg text-[11px] font-bold text-indigo-200">
                    Urutan Topik #{detailTopicItem.topicOrder || 1}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-black">
                  {detailTopicItem.topicTitle}
                </h2>
                <div className="flex items-center gap-3 text-xs text-indigo-200/90 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    Guru Pengampu: <strong>{detailTopicItem.teacherName || classSubjectToTeacherMap.get(`${detailTopicItem.classId}_${detailTopicItem.subjectId}`)?.teacherName || "-"}</strong>
                  </span>
                  <span className="text-indigo-300">•</span>
                  <span className="font-mono text-[11px]">
                    Konteks: {detailTopicItem.academicYearId} / {detailTopicItem.semesterId}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailTopicItem(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer shrink-0"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/80 dark:border-indigo-800">
                  <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase">Target Beban</span>
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                    {detailTopicItem.targetJP} <span className="text-xs font-normal">JP</span>
                  </div>
                  {detailTopicItem.semesterTargetJP !== undefined && (
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                      Semester: {detailTopicItem.semesterTargetJP} JP
                    </span>
                  )}
                </div>

                <div className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Realisasi (Jurnal)</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {detailTopicItem.realizedJP} <span className="text-xs font-normal">JP</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                    {detailTopicItem.journalCount} catatan tatap muka
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">Selisih Realisasi</span>
                  <div className={`text-xl font-black mt-1 ${detailTopicItem.differenceJP >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                    {detailTopicItem.differenceJP > 0 ? `+${detailTopicItem.differenceJP}` : detailTopicItem.differenceJP} <span className="text-xs font-normal text-slate-400">JP</span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 block mt-0.5">
                    {detailTopicItem.differenceJP >= 0 ? "Target terpenuhi" : "Kurang dari rencana"}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">Status & Capaian</span>
                  <div className="text-base font-black text-slate-900 dark:text-zinc-100 mt-1">
                    {detailTopicItem.progressPercentage}%
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                    {detailTopicItem.status}
                  </span>
                </div>
              </div>

              {/* Status Notes Banner */}
              {detailTopicItem.statusNotes && (
                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span><strong>Catatan Evaluasi Deskriptif:</strong> {detailTopicItem.statusNotes}</span>
                </div>
              )}

              {/* Triad Alignment Box (Korelasi Perencanaan & KBM Phase 3C-3) */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Korelasi Perencanaan & KBM (Prosem + Jadwal Operasional + Jurnal Mengajar)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 bg-white dark:bg-zinc-850 rounded-xl border border-slate-200/80 dark:border-zinc-750">
                    <span className="text-[10px] font-bold text-blue-600 uppercase">1. Rencana Prosem</span>
                    <div className="font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                      {detailTopicItem.plannedMeetings.length} Pertemuan
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
                      Target: {detailTopicItem.targetJP} JP
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-zinc-850 rounded-xl border border-slate-200/80 dark:border-zinc-750">
                    <span className="text-[10px] font-bold text-amber-600 uppercase">2. Konteks Jadwal KBM</span>
                    <div className="font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                      {activeTopicSchedules.length} Slot Terjadwal
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
                      Alokasi: {activeTopicScheduledJP} JP/Minggu
                    </span>
                  </div>

                  <div className="p-3 bg-white dark:bg-zinc-850 rounded-xl border border-slate-200/80 dark:border-zinc-750">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">3. Realisasi Jurnal</span>
                    <div className="font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                      {detailTopicItem.journals.length} Catatan Tatap Muka
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-400 block">
                      Terealisasi: {detailTopicItem.realizedJP} JP Riil
                    </span>
                  </div>
                </div>
              </div>

              {/* Evidence Navigation Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl overflow-x-auto text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTopicEvidenceTab("ALL")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    topicEvidenceTab === "ALL"
                      ? "bg-white dark:bg-zinc-900 text-indigo-700 dark:text-indigo-300 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  Semua Bukti
                </button>
                <button
                  type="button"
                  onClick={() => setTopicEvidenceTab("PROSEM")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    topicEvidenceTab === "PROSEM"
                      ? "bg-white dark:bg-zinc-900 text-blue-700 dark:text-blue-300 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Rencana Prosem ({detailTopicItem.plannedMeetings.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTopicEvidenceTab("SCHEDULE")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    topicEvidenceTab === "SCHEDULE"
                      ? "bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Jadwal KBM ({activeTopicSchedules.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTopicEvidenceTab("JOURNALS")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    topicEvidenceTab === "JOURNALS"
                      ? "bg-white dark:bg-zinc-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Jurnal Mengajar ({detailTopicItem.journals.length})</span>
                </button>
                {detailTopicItem.subtopicsProgress && detailTopicItem.subtopicsProgress.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTopicEvidenceTab("SUBTOPICS")}
                    className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                      topicEvidenceTab === "SUBTOPICS"
                        ? "bg-white dark:bg-zinc-900 text-purple-700 dark:text-purple-300 shadow-xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Subtopik ({detailTopicItem.subtopicsProgress.length})</span>
                  </button>
                )}
              </div>

              {/* Section 1: Breakdown Subtopik (Jika Ada) */}
              {(topicEvidenceTab === "ALL" || topicEvidenceTab === "SUBTOPICS") &&
                detailTopicItem.subtopicsProgress &&
                detailTopicItem.subtopicsProgress.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span>A. Rincian Capaian Subtopik ({detailTopicItem.subtopicsProgress.length} Subtopik)</span>
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                        <tr>
                          <th className="py-2 px-3">No</th>
                          <th className="py-2 px-3">Judul Subtopik</th>
                          <th className="py-2 px-3 text-center">Target JP</th>
                          <th className="py-2 px-3 text-center">Realisasi JP</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                        {detailTopicItem.subtopicsProgress.map((st, stIdx) => (
                          <tr key={st.subtopicId || stIdx}>
                            <td className="py-2 px-3 font-bold text-slate-400">{stIdx + 1}</td>
                            <td className="py-2 px-3 font-semibold text-slate-900 dark:text-zinc-100">
                              {st.subtopicTitle}
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600">
                              {st.targetJP} JP
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-emerald-600">
                              {st.realizedJP} JP
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                st.isCompleted
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : st.realizedJP > 0
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                                {st.isCompleted ? "Tercapai" : st.realizedJP > 0 ? "Sebagian" : "Belum Mulai"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Section 2: Rencana Pertemuan Prosem */}
              {(topicEvidenceTab === "ALL" || topicEvidenceTab === "PROSEM") && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    <span>B. Jadwal Pertemuan Terencana (Program Semester)</span>
                  </div>
                  {detailTopicItem.plannedMeetings.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl text-xs text-slate-500 border border-dashed border-slate-200 dark:border-zinc-700">
                      Tidak ada pertemuan terencana spesifik pada Prosem dalam rentang periode ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                          <tr>
                            <th className="py-2 px-3">No</th>
                            <th className="py-2 px-3">Tanggal & Hari</th>
                            <th className="py-2 px-3 text-center">Beban JP</th>
                            <th className="py-2 px-3">Subtopik</th>
                            <th className="py-2 px-3">Tujuan Pembelajaran (TP)</th>
                            <th className="py-2 px-3 text-center">Status Waktu</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                          {detailTopicItem.plannedMeetings.map((m, mIdx) => {
                            const isPast = m.date < todayJakarta;
                            const isToday = m.date === todayJakarta;
                            return (
                              <tr key={m.id || mIdx}>
                                <td className="py-2 px-3 font-bold text-slate-400">{m.meetingNo || mIdx + 1}</td>
                                <td className="py-2 px-3 font-semibold">
                                  <div>{formatIndonesianDateShort(m.date)}</div>
                                  <div className="text-[10px] text-slate-400">{m.dayName}</div>
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600">
                                  {m.jpCount} JP
                                </td>
                                <td className="py-2 px-3 font-medium text-slate-700 dark:text-zinc-300">
                                  {m.subtopicTitle || "-"}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-zinc-400">
                                  {m.tp || "-"}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    isToday
                                      ? "bg-blue-50 text-blue-700 border-blue-200"
                                      : isPast
                                      ? "bg-slate-100 text-slate-600 border-slate-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}>
                                    {isToday ? "Hari Ini" : isPast ? "Terlewati" : "Mendatang"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Section 3: Konteks Jadwal Operasional KBM (Phase 3C-2 & 3C-3) */}
              {(topicEvidenceTab === "ALL" || topicEvidenceTab === "SCHEDULE") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>C. Konteks Jadwal KBM Kelas & Mapel (Jadwal Terjadwal)</span>
                    </div>
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      Total: {activeTopicScheduledJP} JP Terjadwal / Pekan
                    </span>
                  </div>

                  {activeTopicSchedules.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl text-xs text-slate-500 border border-dashed border-slate-200 dark:border-zinc-700">
                      Tidak ditemukan slot jadwal KBM aktif untuk kombinasi kelas & mapel ini pada jadwal operasional.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {activeTopicSchedules.map((s, sIdx) => (
                        <div key={s.id || sIdx} className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-zinc-100">{s.day}</span>
                            <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded font-mono font-bold text-[10px] border border-amber-200 dark:border-amber-800">
                              {s.jp || `Urutan ${s.sequence}`}
                            </span>
                          </div>
                          <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 mt-1">
                            Guru: {s.teacherName || "-"}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate" title={s.id}>
                            Slot ID: {s.id || "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 4: Bukti Realisasi Jurnal Mengajar */}
              {(topicEvidenceTab === "ALL" || topicEvidenceTab === "JOURNALS") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>D. Bukti Jurnal Mengajar Terhubung (PROSEM_TOPIC)</span>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                      Total: {detailTopicItem.journals.length} Jurnal ({detailTopicItem.realizedJP} JP Riil)
                    </span>
                  </div>

                  {detailTopicItem.journals.length === 0 ? (
                    <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 rounded-xl text-xs text-orange-700 dark:text-orange-300 border border-dashed border-orange-200 dark:border-orange-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Belum ada catatan jurnal mengajar yang diinput untuk topik ini pada periode evaluasi.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                          <tr>
                            <th className="py-2 px-3">Tanggal</th>
                            <th className="py-2 px-3">Guru Mengajar</th>
                            <th className="py-2 px-3 text-center">Beban JP</th>
                            <th className="py-2 px-3">Materi Jurnal</th>
                            <th className="py-2 px-3">Aktivitas / TP</th>
                            <th className="py-2 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                          {detailTopicItem.journals.map((j, jIdx) => {
                            const isSubstitute = !!detailTopicItem.teacherId && !!j.teacherId && j.teacherId !== detailTopicItem.teacherId;
                            return (
                              <tr key={j.id || jIdx}>
                                <td className="py-2.5 px-3 font-semibold">
                                  <div>{formatIndonesianDateShort(j.date)}</div>
                                  <div className="text-[10px] text-slate-400">{j.dayName}</div>
                                  <div className="text-[9px] font-mono text-slate-400 mt-0.5 truncate" title={`ID: ${j.id}`}>
                                    ID: {j.id ? j.id.slice(0, 8) + '...' : '-'}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-zinc-200">
                                  <div>{j.teacherName || "-"}</div>
                                  {isSubstitute && (
                                    <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded text-[9px] font-bold border border-amber-200 dark:border-amber-800">
                                      Guru Pengganti
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                                  {j.totalJP} JP
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-zinc-100">
                                  <div>{j.material || "-"}</div>
                                  {j.learningObjectives && (
                                    <div className="text-[10px] text-slate-500 line-clamp-1">{j.learningObjectives}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                                  <div>{j.learningActivities || "-"}</div>
                                  {j.learningMethod && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-medium text-slate-600 mt-1 inline-block">
                                      {j.learningMethod}
                                    </span>
                                  )}
                                  {j.reflection && (
                                    <div className="text-[10px] text-slate-400 italic mt-0.5 line-clamp-1" title={j.reflection}>
                                      Refleksi: {j.reflection}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    j.status === "Disetujui"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : j.status === "Diajukan"
                                      ? "bg-amber-50 text-amber-700 border-amber-200"
                                      : "bg-slate-100 text-slate-600 border-slate-200"
                                  }`}>
                                    {j.status || "Draft"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer (Strictly Read-Only) */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailTopicItem(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Jurnal Khusus (OUT_OF_PROSEM / UNLINKED LEGACY) */}
      {showSpecialJournalsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className={`p-6 text-white flex items-start justify-between ${
              showSpecialJournalsModal === "OUT_OF_PROSEM"
                ? "bg-gradient-to-r from-purple-900 to-indigo-900"
                : "bg-gradient-to-r from-slate-800 to-zinc-900"
            }`}>
              <div className="space-y-1 max-w-2xl">
                <span className="px-2.5 py-0.5 bg-white/20 rounded-lg text-[11px] font-black tracking-wider uppercase">
                  {showSpecialJournalsModal === "OUT_OF_PROSEM" ? "Jurnal Di Luar Prosem" : "Jurnal Belum Tertaut (Legacy)"}
                </span>
                <h2 className="text-lg md:text-xl font-black">
                  {showSpecialJournalsModal === "OUT_OF_PROSEM"
                    ? "Daftar Jurnal Di Luar Cakupan Rencana Prosem"
                    : "Daftar Jurnal Historis Tanpa Penautan Topik"}
                </h2>
                <p className="text-xs text-white/80">
                  {showSpecialJournalsModal === "OUT_OF_PROSEM"
                    ? "Jurnal ini secara sengaja diinput oleh guru dengan memilih opsi 'Lainnya / Di Luar Prosem'. Jurnal ini tidak dialokasikan ke topik kurikulum tertentu namun sah dan berkontribusi terhadap jam tatap muka riil guru."
                    : "Jurnal historis yang dibuat sebelum tersedianya fitur penautan topik kurikulum. Jurnal ini tetap valid dan berkontribusi penuh pada Progres Beban JP, namun diperlakukan sebagai 'Belum Tertaut' pada Progres Materi."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowSpecialJournalsModal(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const list = showSpecialJournalsModal === "OUT_OF_PROSEM"
                  ? (materialResult?.outOfProsemJournals || [])
                  : (materialResult?.unlinkedJournals || []);
                const totalJP = showSpecialJournalsModal === "OUT_OF_PROSEM"
                  ? (materialResult?.outOfProsemJP || 0)
                  : (materialResult?.unlinkedJP || 0);

                if (list.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-500 dark:text-zinc-400">
                      Tidak ada catatan jurnal dalam kategori ini pada periode yang dipilih.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400 font-semibold px-1">
                      <span>Total: <strong>{list.length}</strong> catatan jurnal</span>
                      <span>Total Akumulasi: <strong className="text-indigo-600 dark:text-indigo-400">{totalJP} JP</strong></span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-600 dark:text-zinc-400">
                          <tr>
                            <th className="py-2.5 px-3">No</th>
                            <th className="py-2.5 px-3">Tanggal</th>
                            <th className="py-2.5 px-3">Guru Pengampu</th>
                            <th className="py-2.5 px-3">Kelas & Mapel</th>
                            <th className="py-2.5 px-3 text-center">Beban JP</th>
                            <th className="py-2.5 px-3">Materi Jurnal</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                          {list.map((j, idx) => (
                            <tr key={j.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                              <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-semibold">
                                <div>{formatIndonesianDateShort(j.date)}</div>
                                <div className="text-[10px] text-slate-400">{j.dayName}</div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-zinc-100">
                                {j.teacherName || "-"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-300">
                                <span className="font-bold">{j.className || j.classId}</span> • {j.subjectName || j.subjectId}
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600">
                                {j.totalJP} JP
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-zinc-100 max-w-xs">
                                <div>{j.material || "-"}</div>
                                {j.learningActivities && (
                                  <div className="text-[10px] text-slate-500 line-clamp-1">{j.learningActivities}</div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  j.status === "Disetujui"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : j.status === "Diajukan"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}>
                                  {j.status || "Draft"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSpecialJournalsModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Modal Laporan Eksekutif Pembelajaran (Phase 3C-3: Executive Reporting & Export) */}
      {showExecutiveReportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 flex items-start justify-between">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-white/20 rounded-lg text-[10px] font-black tracking-wider uppercase">
                    SMP ALKARIM RASYID
                  </span>
                  <span className="px-2.5 py-0.5 bg-indigo-500/30 rounded-lg text-[10px] font-bold text-indigo-200">
                    {activeTab === "MATERI" ? "Progres Materi Kurikulum (Prosem & Jurnal)" : "Monitoring Beban Mengajar (JP)"}
                  </span>
                </div>
                <h2 className="text-lg md:text-xl font-black">
                  Laporan Eksekutif Progres Pembelajaran
                </h2>
                <div className="flex items-center gap-3 text-xs text-indigo-200/90 flex-wrap">
                  <span>
                    TP: <strong>{activeAy?.year || "-"}</strong> ({activeSem?.name || "-"})
                  </span>
                  <span>•</span>
                  <span>
                    Periode: <strong>{activeDateBounds.label}</strong> ({activeDateBounds.startDate} s/d {activeDateBounds.endDate})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExecutiveReportModal(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer shrink-0"
                title="Tutup Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Context Scope Card */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Cakupan Filter & Parameter Evaluasi
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Guru Pengampu:</span>
                    <strong className="text-slate-800 dark:text-zinc-200">{activeTeacherLabel}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Mata Pelajaran:</span>
                    <strong className="text-slate-800 dark:text-zinc-200">{activeSubjectLabel}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Rombel / Kelas:</span>
                    <strong className="text-slate-800 dark:text-zinc-200">{activeClassLabel}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Status Evaluasi:</span>
                    <strong className="text-slate-800 dark:text-zinc-200">{activeStatusLabel}</strong>
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span>Ringkasan Metrik Eksekutif</span>
                </div>
                {activeTab === "MATERI" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800">
                      <span className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase">Target Beban JP</span>
                      <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
                        {filteredExecutiveSummary.totalTargetJP} <span className="text-xs font-normal">JP</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Alokasi target rencana kurikulum
                      </span>
                    </div>

                    <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800">
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Realisasi JP Terlapor</span>
                      <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                        {filteredExecutiveSummary.totalRealizedJP} <span className="text-xs font-normal">JP</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Akumulasi jurnal mengajar valid
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">Selisih Netto</span>
                      <div className={`text-xl font-black mt-1 ${
                        (filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP) >= 0 ? "text-blue-600" : "text-rose-600"
                      }`}>
                        {(filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP) > 0
                          ? `+${filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP}`
                          : filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP} <span className="text-xs font-normal text-slate-400">JP</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {(filteredExecutiveSummary.totalRealizedJP - filteredExecutiveSummary.totalTargetJP) >= 0 ? "Keterpenuhan terpenuhi" : "Kurang dari rencana"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/80 dark:border-indigo-800">
                      <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase">Topik Terpantau</span>
                      <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                        {filteredTopicItems.length} <span className="text-xs font-normal text-slate-500">Topik</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {filteredExecutiveSummary.monitoredClassSubjectCount} Rombel-Mapel
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800">
                      <span className="text-[10px] font-bold text-blue-800 dark:text-blue-400 uppercase">Target Beban JP</span>
                      <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
                        {filteredJpSummary.totalTargetJP} <span className="text-xs font-normal">JP</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Beban KBM terjadwal
                      </span>
                    </div>

                    <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/80 dark:border-emerald-800">
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase">Realisasi JP</span>
                      <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                        {filteredJpSummary.totalRealizedJP} <span className="text-xs font-normal">JP</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        Total jam mengajar riil
                      </span>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase">Selisih Netto</span>
                      <div className={`text-xl font-black mt-1 ${filteredJpSummary.differenceJP >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                        {filteredJpSummary.differenceJP > 0 ? `+${filteredJpSummary.differenceJP}` : filteredJpSummary.differenceJP} <span className="text-xs font-normal text-slate-400">JP</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {filteredJpSummary.differenceJP >= 0 ? "Beban terpenuhi" : "Kurang dari beban"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/80 dark:border-indigo-800">
                      <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-400 uppercase">Capaian Kumulatif</span>
                      <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                        {filteredJpSummary.overallPercentage}%
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {filteredItems.length} Rombel-Guru terpantau
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Breakdown (MATERI) */}
              {activeTab === "MATERI" && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-600" />
                    <span>Distribusi Status Keterlaksanaan Materi</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/70 text-center">
                      <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">Selesai</span>
                      <span className="text-lg font-black text-emerald-700 dark:text-emerald-200">{filteredExecutiveSummary.completedCount}</span>
                    </div>
                    <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/70 text-center">
                      <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">Sedang Berjalan</span>
                      <span className="text-lg font-black text-amber-700 dark:text-amber-200">{filteredExecutiveSummary.inProgressCount}</span>
                    </div>
                    <div className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-xl border border-slate-200 text-center">
                      <span className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 block">Belum Dimulai</span>
                      <span className="text-lg font-black text-slate-800 dark:text-zinc-200">{filteredExecutiveSummary.unstartedCount}</span>
                    </div>
                    <div className="p-2.5 bg-orange-50/70 dark:bg-orange-950/30 rounded-xl border border-orange-200/70 text-center">
                      <span className="text-[10px] font-bold text-orange-800 dark:text-orange-300 block">Belum Ada Jurnal</span>
                      <span className="text-lg font-black text-orange-700 dark:text-orange-200">{filteredExecutiveSummary.noJournalCount}</span>
                    </div>
                    <div className="p-2.5 bg-rose-50/70 dark:bg-rose-950/30 rounded-xl border border-rose-200/70 text-center">
                      <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 block">Tertinggal</span>
                      <span className="text-lg font-black text-rose-700 dark:text-rose-200">{filteredExecutiveSummary.delayedCount}</span>
                    </div>
                    <div className="p-2.5 bg-purple-50/70 dark:bg-purple-950/30 rounded-xl border border-purple-200/70 text-center">
                      <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 block">Di Luar Rencana</span>
                      <span className="text-lg font-black text-purple-700 dark:text-purple-200">{filteredExecutiveSummary.outOfProsemCount}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Topics Requiring Attention */}
              {activeTab === "MATERI" && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Fokus Perhatian Kurikulum (Tertinggal / Belum Ada Jurnal)</span>
                  </div>

                  {(() => {
                    const attentionTopics = filteredTopicItems.filter(
                      t => t.status === "TERTINGGAL" || t.status === "BELUM_ADA_JURNAL"
                    );

                    if (attentionTopics.length === 0) {
                      return (
                        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/80 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Seluruh topik pembelajaran pada filter ini terpantau berjalan sesuai rencana, sudah selesai, atau belum memasuki jadwal KBM aktif.</span>
                        </div>
                      );
                    }

                    return (
                      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold border-b border-slate-200 dark:border-zinc-700">
                            <tr>
                              <th className="py-2 px-3">Kelas & Mapel</th>
                              <th className="py-2 px-3">Topik Pembelajaran</th>
                              <th className="py-2 px-3">Guru Pengampu</th>
                              <th className="py-2 px-3 text-center">Target</th>
                              <th className="py-2 px-3 text-center">Realisasi</th>
                              <th className="py-2 px-3 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                            {attentionTopics.slice(0, 10).map((t, idx) => (
                              <tr key={t.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                <td className="py-2 px-3 font-bold text-slate-800 dark:text-zinc-200">
                                  {t.className || t.classId} • {t.subjectName || t.subjectId}
                                </td>
                                <td className="py-2 px-3 text-slate-700 dark:text-zinc-300">
                                  {t.topicTitle}
                                </td>
                                <td className="py-2 px-3 text-slate-600 dark:text-zinc-400">
                                  {t.teacherName || "-"}
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600">
                                  {t.targetJP} JP
                                </td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-emerald-600">
                                  {t.realizedJP} JP
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    t.status === "TERTINGGAL"
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-orange-100 text-orange-700"
                                  }`}>
                                    {t.status === "TERTINGGAL" ? "Tertinggal" : "Belum Ada Jurnal"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {attentionTopics.length > 10 && (
                          <div className="p-2 bg-slate-50 dark:bg-zinc-850 text-center text-[11px] text-slate-500 font-medium">
                            +{attentionTopics.length - 10} topik lainnya yang memerlukan atensi. Ekspor ke Excel/PDF untuk laporan lengkap.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer with Direct Export Buttons */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                Data diekspor secara deterministik berdasarkan filter aktif saat ini.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Unduh Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh PDF (.pdf)
                </button>
                <button
                  type="button"
                  onClick={() => setShowExecutiveReportModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Tutup Laporan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
