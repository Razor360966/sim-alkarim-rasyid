import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { teacherTeachingAttendanceService, getIndonesianDayName, getTodayDateStr } from "../services/teacherTeachingAttendance.service";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { classService } from "../services/classService";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { ClassQrCardsModal } from "../components/ClassQrCardsModal";
import { ExecutiveTeachingAnalyticsWidget, StatusJpLegend } from "../components/ExecutiveTeachingAnalyticsWidget";
import { TeacherAttendanceTimeline } from "../components/TeacherAttendanceTimeline";
import { HalaqahAttendanceRecapSection } from "../components/HalaqahAttendanceRecapSection";
import { HalaqahDailyAttendanceSection } from "../components/HalaqahDailyAttendanceSection";
import { 
  TeacherTeachingAttendance, 
  AttendanceTeachingStatus, 
  TeacherAttendanceSummary 
} from "../types/teacherTeachingAttendance.types";
import { Teacher } from "../types";
import { Loading } from "../components/Loading";
import { Dialog } from "../components/Dialog";
import { 
  ClipboardList, 
  Calendar, 
  Search, 
  Save, 
  Download, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  UserX, 
  RefreshCw, 
  ChevronRight, 
  X, 
  Info,
  Filter,
  BarChart2,
  CalendarDays,
  Sparkles,
  ShieldAlert,
  ArrowRightLeft,
  RotateCcw,
  Trash2,
  Edit2,
  PlusCircle,
  History,
  Users,
  HelpCircle,
  Activity,
  TrendingUp,
  Eye,
  Bell,
  BookOpen,
  Layers,
  QrCode,
  Printer,
  Lock,
  Unlock
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export const TeacherTeachingAttendancePage: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const isKepalaSekolah = user && (
    user.role === "kepala sekolah" ||
    user.role === "pimpinan" ||
    user.role === "ketua yayasan" ||
    (user.roles && (
      user.roles.includes("kepala sekolah") || 
      user.roles.includes("pimpinan") || 
      user.roles.includes("ketua yayasan")
    ))
  );

  // Default date = today's YYYY-MM-DD
  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<"input" | "validasi" | "rekap" | "absensi_halaqah" | "rekap_halaqah">("input");

  // Validation State
  const [validationSearchQuery, setValidationSearchQuery] = useState<string>("");
  const [validationStatusFilter, setValidationStatusFilter] = useState<"ALL" | "Pending" | "Approved" | "Rejected">("Pending");
  const [rejectModalItem, setRejectModalItem] = useState<{ id: string; dateStr: string; teacherName: string; subjectName: string; className: string } | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [selectedValidationIds, setSelectedValidationIds] = useState<string[]>([]);

  // Load Master Data (Academic Years, Semesters, Teachers, Subjects, Classes)
  const { data: academicYears = [] } = useQuery({
    queryKey: ["academicYears"],
    queryFn: academicYearService.getAcademicYears
  });

  const { data: semesters = [] } = useQuery({
    queryKey: ["semesters"],
    queryFn: semesterService.getSemesters
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: teacherService.getTeachers
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: subjectService.getSubjects
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: classService.getClasses
  });

  // Selected or Active Academic Year & Semester
  const activeAy = academicYears.find(y => y.isActive) || academicYears[0];
  const [selectedAyId, setSelectedAyId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");

  useEffect(() => {
    if (activeAy?.id && !selectedAyId) {
      setSelectedAyId(activeAy.id);
    }
  }, [activeAy, selectedAyId]);

  const availableSemesters = useMemo(() => {
    if (!selectedAyId) return semesters;
    return semesters.filter(s => s.academicYearId === selectedAyId);
  }, [semesters, selectedAyId]);

  const activeSem = availableSemesters.find(s => s.isActive) || availableSemesters[0];

  useEffect(() => {
    if (activeSem?.id && !selectedSemesterId) {
      setSelectedSemesterId(activeSem.id);
    }
  }, [activeSem, selectedSemesterId]);

  const { data: validationStats, refetch: refetchValidationStats } = useQuery({
    queryKey: ["attendanceValidationStats", selectedDate, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getAttendanceValidationStats(selectedDate, selectedAyId, selectedSemesterId)
  });

  const validateMutation = useMutation({
    mutationFn: async (params: { id: string; dateStr: string; status: "Approved" | "Rejected"; validationNote?: string }) => {
      if (!user) throw new Error("Belum diautentikasi");
      await teacherTeachingAttendanceService.validateAttendance({
        attendanceId: params.id,
        dateStr: params.dateStr,
        status: params.status,
        validationNote: params.validationNote,
        validatorUserId: user.uid,
        validatorUserName: user.displayName || user.name || "Wakakur"
      });
    },
    onSuccess: () => {
      toast("Validasi absensi berhasil disimpan!", "success");
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceValidationStats"] });
      queryClient.invalidateQueries({ queryKey: ["qrMonitoringStats"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
      setRejectModalItem(null);
      setRejectReason("");
    },
    onError: (err: any) => {
      toast("Gagal memvalidasi absensi: " + err.message, "error");
    }
  });

  const batchApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error("Belum diautentikasi");
      for (const id of ids) {
        await teacherTeachingAttendanceService.validateAttendance({
          attendanceId: id,
          dateStr: selectedDate,
          status: "Approved",
          validationNote: "Persetujuan Masal Waka Kurikulum",
          validatorUserId: user.uid,
          validatorUserName: user.displayName || user.name || "Wakakur"
        });
      }
    },
    onSuccess: () => {
      toast(`Berhasil menyetujui ${selectedValidationIds.length} catatan absensi!`, "success");
      setSelectedValidationIds([]);
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceValidationStats"] });
      queryClient.invalidateQueries({ queryKey: ["qrMonitoringStats"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
    },
    onError: (err: any) => {
      toast("Gagal menyetujui masal: " + err.message, "error");
    }
  });

  const [unlockLateModalItem, setUnlockLateModalItem] = useState<{ scheduleId: string; dateStr: string; teacherName: string; subjectName: string; className: string; jp: string } | null>(null);
  const [unlockLateReason, setUnlockLateReason] = useState("");

  const unlockLateMutation = useMutation({
    mutationFn: async (params: { scheduleId: string; dateStr: string; reason: string }) => {
      if (!user) throw new Error("Belum diautentikasi");
      await teacherTeachingAttendanceService.unlockLateCheckIn({
        scheduleId: params.scheduleId,
        dateStr: params.dateStr,
        reason: params.reason,
        validatorUserId: user.uid,
        validatorUserName: user.displayName || user.name || "Wakakur"
      });
    },
    onSuccess: () => {
      toast("Kunci sesi terlambat berhasil dibuka oleh Wakakur!", "success");
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendanceValidationStats"] });
      queryClient.invalidateQueries({ queryKey: ["qrMonitoringStats"] });
      setUnlockLateModalItem(null);
      setUnlockLateReason("");
    },
    onError: (err: any) => {
      toast("Gagal membuka kunci sesi: " + err.message, "error");
    }
  });

  // Incomplete Attendance Dates alert query
  const { data: incompleteDates = [] } = useQuery({
    queryKey: ["incompleteAttendanceDates", selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getIncompleteAttendanceDates(selectedAyId, selectedSemesterId),
    enabled: isWakakurOrAdmin && !!selectedAyId && !!selectedSemesterId
  });

  // Audit logs query & Detail Teacher History view mode
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [historyViewMode, setHistoryViewMode] = useState<"timeline" | "table">("timeline");
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["teacherAttendanceAuditLogs"],
    queryFn: () => teacherTeachingAttendanceService.getAuditLogs(),
    enabled: showAuditModal
  });

  // Reason state for back-dating
  const [backdateReason, setBackdateReason] = useState("");
  const [overrideKbmLock, setOverrideKbmLock] = useState(false);

  useEffect(() => {
    setOverrideKbmLock(false);
  }, [selectedDate]);

  // Schedule Exchange ("Tukar Jadwal") modal state
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeModalSubTab, setExchangeModalSubTab] = useState<"create" | "list">("create");
  const [exchangeSearchQuery, setExchangeSearchQuery] = useState("");
  const [editingExchangeId, setEditingExchangeId] = useState<string | null>(null);
  const [editingExchangeReason, setEditingExchangeReason] = useState("");

  const [exchangeScheduleAId, setExchangeScheduleAId] = useState("");
  const [exchangeTeacherBId, setExchangeTeacherBId] = useState("");
  const [exchangeDateB, setExchangeDateB] = useState(selectedDate);
  const [exchangeScheduleBId, setExchangeScheduleBId] = useState("");
  const [exchangeReason, setExchangeReason] = useState("");

  useEffect(() => {
    setExchangeDateB(selectedDate);
  }, [selectedDate, showExchangeModal]);

  // Fetch Schedule Exchanges List
  const { data: scheduleExchangesList = [], isLoading: isLoadingExchanges } = useQuery({
    queryKey: ["scheduleExchangesList"],
    queryFn: () => teacherTeachingAttendanceService.getScheduleExchanges(),
    enabled: showExchangeModal || activeTab === "input"
  });

  const filteredScheduleExchanges = useMemo(() => {
    if (!exchangeSearchQuery.trim()) return scheduleExchangesList;
    const q = exchangeSearchQuery.toLowerCase();
    return scheduleExchangesList.filter(ex => 
      ex.teacherAName?.toLowerCase().includes(q) ||
      ex.teacherBName?.toLowerCase().includes(q) ||
      ex.subjectAName?.toLowerCase().includes(q) ||
      ex.subjectBName?.toLowerCase().includes(q) ||
      ex.classAName?.toLowerCase().includes(q) ||
      ex.classBName?.toLowerCase().includes(q) ||
      ex.reason?.toLowerCase().includes(q) ||
      ex.date?.includes(q) ||
      ex.dateB?.includes(q)
    );
  }, [scheduleExchangesList, exchangeSearchQuery]);

  // Fetch Guru B's schedule/attendance for exchangeDateB
  const { data: scheduleBData, isLoading: isLoadingScheduleB } = useQuery({
    queryKey: ["teacherTeachingAttendanceB", exchangeDateB, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getAttendanceForDate(exchangeDateB, selectedAyId, selectedSemesterId),
    enabled: showExchangeModal && !!exchangeDateB
  });

  const exchangeScheduleBItems = useMemo(() => {
    if (!scheduleBData?.items || !exchangeTeacherBId) return [];
    return scheduleBData.items.filter(item => item.teacherId === exchangeTeacherBId);
  }, [scheduleBData, exchangeTeacherBId]);

  // Leadership Monitoring Query (for Headmaster / Yayasan / Wakakur)
  const { data: leadershipStats } = useQuery({
    queryKey: ["leadershipMonitoringStats", selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getLeadershipMonitoringStats(selectedAyId, selectedSemesterId)
  });

  // QR Teaching Check-in Monitoring Stats Query
  const { data: qrStats, refetch: refetchQrStats } = useQuery({
    queryKey: ["qrMonitoringStats", selectedDate, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getQrMonitoringStats(selectedDate, selectedAyId, selectedSemesterId),
    enabled: !!selectedDate
  });

  const [isClassQrModalOpen, setIsClassQrModalOpen] = useState<boolean>(false);
  const [manualCheckOutModal, setManualCheckOutModal] = useState<{
    isOpen: boolean;
    item?: TeacherTeachingAttendance;
    checkOutTime: string;
    reason: string;
  }>({
    isOpen: false,
    checkOutTime: "08:15",
    reason: ""
  });

  const handleManualCheckOutSubmit = async () => {
    if (!manualCheckOutModal.item || !manualCheckOutModal.item.scheduleId) return;
    try {
      await teacherTeachingAttendanceService.performManualCheckOut({
        dateStr: selectedDate,
        scheduleId: manualCheckOutModal.item.scheduleId,
        manualCheckOutTime: manualCheckOutModal.checkOutTime,
        userId: user?.uid || user?.userId || "",
        userName: user?.displayName || user?.name || "Wakakur",
        reason: manualCheckOutModal.reason || "Check Out Manual Wakakur"
      });
      toast("Berhasil mencatat Check Out Manual untuk " + manualCheckOutModal.item.teacherName, "success");
      setManualCheckOutModal({ isOpen: false, checkOutTime: "08:15", reason: "" });
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["qrMonitoringStats"] });
    } catch (err: any) {
      toast("Gagal Check Out Manual: " + (err?.message || "Terjadi kesalahan"), "error");
    }
  };

  // --- TAB 1: INPUT ABSENSI ---
  const dayName = getIndonesianDayName(selectedDate);

  const { data: dailyAttendanceData, isLoading: isLoadingAttendance, refetch: refetchAttendance } = useQuery({
    queryKey: ["teacherTeachingAttendance", selectedDate, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getAttendanceForDate(selectedDate, selectedAyId, selectedSemesterId),
    enabled: !!selectedDate
  });

  const isKbmDisabled = !!dailyAttendanceData?.isKbmDisabled && !overrideKbmLock;

  const [localAttendanceItems, setLocalAttendanceItems] = useState<TeacherTeachingAttendance[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    if (dailyAttendanceData?.items) {
      setLocalAttendanceItems(dailyAttendanceData.items);
      setIsDirty(false);
    }
  }, [dailyAttendanceData]);

  const getOffsetDateStr = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Handle local changes
  const handleStatusChange = (index: number, newStatus: AttendanceTeachingStatus) => {
    setLocalAttendanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        status: newStatus,
        substituteTeacherId: newStatus === "Digantikan Guru Lain" ? copy[index].substituteTeacherId : "",
        substituteTeacherName: newStatus === "Digantikan Guru Lain" ? copy[index].substituteTeacherName : ""
      };
      return copy;
    });
    setIsDirty(true);
  };

  const handleSubstituteChange = (index: number, subTeacherId: string) => {
    const subTeacher = teachers.find(t => t.id === subTeacherId);
    setLocalAttendanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        substituteTeacherId: subTeacherId,
        substituteTeacherName: subTeacher ? subTeacher.name : ""
      };
      return copy;
    });
    setIsDirty(true);
  };

  const handleNotesChange = (index: number, newNotes: string) => {
    setLocalAttendanceItems(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        notes: newNotes
      };
      return copy;
    });
    setIsDirty(true);
  };

  // Mutation to save attendance (batch)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Pengguna belum diautentikasi");
      const isPastDate = selectedDate < todayStr;
      const reason = isPastDate ? (backdateReason || "Input Susulan Tanggal Lampau oleh Wakakur") : undefined;

      await teacherTeachingAttendanceService.saveAttendanceForDate(
        selectedDate,
        localAttendanceItems,
        user.uid,
        user.displayName || user.name || "Wakakur",
        reason
      );
    },
    onSuccess: () => {
      toast("Monitoring pelaksanaan jam mengajar berhasil disimpan!", "success");
      setIsDirty(false);
      setBackdateReason("");
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
      queryClient.invalidateQueries({ queryKey: ["teacherDailyStats"] });
      queryClient.invalidateQueries({ queryKey: ["incompleteAttendanceDates"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceAuditLogs"] });
      queryClient.invalidateQueries({ queryKey: ["leadershipMonitoringStats"] });
    },
    onError: (err: any) => {
      toast("Gagal menyimpan monitoring: " + err.message, "error");
    }
  });

  // Mutation to save a single session attendance independently
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  const saveSingleSessionMutation = useMutation({
    mutationFn: async (item: TeacherTeachingAttendance) => {
      if (!user) throw new Error("Pengguna belum diautentikasi");
      setSavingSessionId(item.scheduleId);
      const isPastDate = selectedDate < todayStr;
      const reason = isPastDate ? (backdateReason || "Input Susulan Sesi Tanggal Lampau oleh Wakakur") : undefined;

      await teacherTeachingAttendanceService.saveSingleSessionAttendance(
        selectedDate,
        item,
        user.uid,
        user.displayName || user.name || "Wakakur",
        reason
      );
    },
    onSuccess: (_, item) => {
      toast(`Absensi sesi ${item.teacherName} (${item.className} - ${item.jp}) berhasil disimpan!`, "success");
      setSavingSessionId(null);
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
      queryClient.invalidateQueries({ queryKey: ["teacherDailyStats"] });
      queryClient.invalidateQueries({ queryKey: ["incompleteAttendanceDates"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceAuditLogs"] });
      queryClient.invalidateQueries({ queryKey: ["leadershipMonitoringStats"] });
    },
    onError: (err: any) => {
      setSavingSessionId(null);
      toast("Gagal menyimpan sesi: " + err.message, "error");
    }
  });

  const saveExchangeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Pengguna belum diautentikasi");
      const itemA = localAttendanceItems.find(i => i.scheduleId === exchangeScheduleAId);
      if (!itemA) throw new Error("Pilih Sesi A yang ingin ditukar");
      const teacherB = teachers.find(t => t.id === exchangeTeacherBId);
      if (!teacherB) throw new Error("Pilih Guru B (Penukar)");
      const itemB = exchangeScheduleBItems.find(i => i.scheduleId === exchangeScheduleBId);

      await teacherTeachingAttendanceService.saveScheduleExchange(
        {
          date: selectedDate,
          dateB: exchangeDateB || selectedDate,
          teacherAId: itemA.teacherId,
          teacherAName: itemA.teacherName,
          scheduleAId: itemA.scheduleId,
          subjectAName: itemA.subjectName,
          classAName: itemA.className,
          jpA: itemA.jp,
          teacherBId: teacherB.id,
          teacherBName: teacherB.name,
          scheduleBId: itemB?.scheduleId || "",
          subjectBName: itemB?.subjectName || "",
          classBName: itemB?.className || "",
          jpB: itemB?.jp || "",
          reason: exchangeReason || "Penyesuaian Jadwal Mengajar Sesi"
        },
        user.uid,
        user.displayName || user.name || "Wakakur"
      );
    },
    onSuccess: () => {
      toast("Pertukaran jadwal mengajar berhasil diproses!", "success");
      setShowExchangeModal(false);
      setExchangeScheduleAId("");
      setExchangeTeacherBId("");
      setExchangeScheduleBId("");
      setExchangeReason("");
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendanceB"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
      queryClient.invalidateQueries({ queryKey: ["teacherDailyStats"] });
      queryClient.invalidateQueries({ queryKey: ["leadershipMonitoringStats"] });
    },
    onError: (err: any) => {
      toast("Gagal memproses tukar jadwal: " + err.message, "error");
    }
  });

  const deleteExchangeMutation = useMutation({
    mutationFn: async (exchangeId: string) => {
      if (!user) throw new Error("Pengguna belum diautentikasi");
      await teacherTeachingAttendanceService.deleteScheduleExchange(
        exchangeId,
        user.uid,
        user.displayName || user.name || "Wakakur"
      );
    },
    onSuccess: () => {
      toast("Tukar jadwal berhasil dibatalkan & jadwal dikembalikan ke semula!", "success");
      queryClient.invalidateQueries({ queryKey: ["scheduleExchangesList"] });
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendanceB"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
      queryClient.invalidateQueries({ queryKey: ["teacherDailyStats"] });
      queryClient.invalidateQueries({ queryKey: ["leadershipMonitoringStats"] });
    },
    onError: (err: any) => {
      toast("Gagal membatalkan tukar jadwal: " + err.message, "error");
    }
  });

  const updateExchangeMutation = useMutation({
    mutationFn: async ({ exchangeId, reason }: { exchangeId: string; reason: string }) => {
      if (!user) throw new Error("Pengguna belum diautentikasi");
      await teacherTeachingAttendanceService.updateScheduleExchange(
        exchangeId,
        reason,
        user.uid,
        user.displayName || user.name || "Wakakur"
      );
    },
    onSuccess: () => {
      toast("Alasan tukar jadwal berhasil diperbarui!", "success");
      setEditingExchangeId(null);
      setEditingExchangeReason("");
      queryClient.invalidateQueries({ queryKey: ["scheduleExchangesList"] });
      queryClient.invalidateQueries({ queryKey: ["teacherTeachingAttendance"] });
      queryClient.invalidateQueries({ queryKey: ["teacherAttendanceRecap"] });
    },
    onError: (err: any) => {
      toast("Gagal memperbarui tukar jadwal: " + err.message, "error");
    }
  });

  const handleResetOrManageExchange = (item: TeacherTeachingAttendance) => {
    const matched = scheduleExchangesList.find(
      ex => ex.scheduleAId === item.scheduleId || ex.scheduleBId === item.scheduleId
    );
    if (matched && matched.id) {
      if (confirm(`Batalkan pertukaran jadwal antara ${matched.teacherAName} dan ${matched.teacherBName}?\nStatus kedua jadwal akan otomatis dikembalikan ke status semula.`)) {
        deleteExchangeMutation.mutate(matched.id);
      }
    } else {
      const itemIdx = localAttendanceItems.findIndex(i => i.scheduleId === item.scheduleId);
      if (itemIdx !== -1) {
        const updated = [...localAttendanceItems];
        updated[itemIdx] = {
          ...updated[itemIdx],
          status: "Hadir Mengajar",
          exchangedWithTeacherId: undefined,
          exchangedWithTeacherName: undefined,
          exchangedScheduleId: undefined,
          notes: updated[itemIdx].notes?.replace(/Tukar Jadwal.*$/i, "").trim() || ""
        };
        setLocalAttendanceItems(updated);
        setIsDirty(true);
        toast("Status sesi dikembalikan ke Hadir Mengajar di tampilan. Klik 'Simpan Monitoring' untuk menyimpannya.", "info");
      }
    }
  };

  // Calculate local daily summary stats
  const stats = useMemo(() => {
    const total = localAttendanceItems.length;
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let tugas = 0;
    let tidakHadir = 0;
    let diganti = 0;
    let tukarJadwal = 0;
    let kbmDitiadakan = 0;
    let belumDiverifikasi = 0;

    localAttendanceItems.forEach(item => {
      switch (item.status) {
        case "Hadir Mengajar": hadir++; break;
        case "Terlambat": terlambat++; break;
        case "Izin": izin++; break;
        case "Sakit": sakit++; break;
        case "Tugas Dinas": tugas++; break;
        case "Tidak Hadir": tidakHadir++; break;
        case "Digantikan Guru Lain": diganti++; break;
        case "Tukar Jadwal": tukarJadwal++; break;
        case "KBM Ditiadakan": kbmDitiadakan++; break;
        case "Belum Diverifikasi":
        default:
          belumDiverifikasi++;
          break;
      }
    });

    const effectiveTotal = total - kbmDitiadakan;
    const percentage = effectiveTotal > 0 ? Math.round(((hadir + terlambat + diganti + tukarJadwal) / effectiveTotal) * 100) : (total > 0 && dailyAttendanceData?.isKbmDisabled ? 100 : 0);

    return {
      total,
      hadir,
      terlambat,
      izin,
      sakit,
      tugas,
      tidakHadir,
      diganti,
      tukarJadwal,
      kbmDitiadakan,
      belumDiverifikasi,
      percentage
    };
  }, [localAttendanceItems, dailyAttendanceData]);

  // Filtered rows for input table
  const filteredInputItems = useMemo(() => {
    return localAttendanceItems.map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => {
      const matchSearch = 
        item.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.substituteTeacherName && item.substituteTeacherName.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchStatus = statusFilter === "ALL" || item.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [localAttendanceItems, searchQuery, statusFilter]);

  // --- TAB 2: REKAP ABSENSI & EXCEPTION FIRST DASHBOARD ---
  const [rekapPeriodType, setRekapPeriodType] = useState<"harian" | "mingguan" | "bulanan" | "semester" | "tahunan" | "custom">("harian");
  const [rekapStartDate, setRekapStartDate] = useState<string>(todayStr);
  const [rekapEndDate, setRekapEndDate] = useState<string>(todayStr);
  const [filterTeacherId, setFilterTeacherId] = useState<string>("");
  const [filterSubjectId, setFilterSubjectId] = useState<string>("");
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>("");
  const [filterClassId, setFilterClassId] = useState<string>("");

  // Exception Card Detail Modal State
  const [cardDetailModal, setCardDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    category: string;
    records: TeacherTeachingAttendance[];
  } | null>(null);

  const [cardModalSearch, setCardModalSearch] = useState<string>("");

  const openDetailModal = (title: string, category: string, records: TeacherTeachingAttendance[]) => {
    setCardModalSearch("");
    setCardDetailModal({
      isOpen: true,
      title,
      category,
      records
    });
  };

  // Update date range defaults when period type changes
  useEffect(() => {
    const now = new Date();
    if (rekapPeriodType === "harian") {
      setRekapStartDate(selectedDate || todayStr);
      setRekapEndDate(selectedDate || todayStr);
    } else if (rekapPeriodType === "mingguan") {
      const day = now.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monObj = new Date(now);
      monObj.setDate(now.getDate() + diffToMon);
      const sunObj = new Date(monObj);
      sunObj.setDate(monObj.getDate() + 6);

      const monStr = `${monObj.getFullYear()}-${String(monObj.getMonth() + 1).padStart(2, "0")}-${String(monObj.getDate()).padStart(2, "0")}`;
      const sunStr = `${sunObj.getFullYear()}-${String(sunObj.getMonth() + 1).padStart(2, "0")}-${String(sunObj.getDate()).padStart(2, "0")}`;

      setRekapStartDate(monStr);
      setRekapEndDate(sunStr);
    } else if (rekapPeriodType === "bulanan") {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      setRekapStartDate(`${y}-${m}-01`);
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setRekapEndDate(`${y}-${m}-${String(lastDay).padStart(2, "0")}`);
    } else if (rekapPeriodType === "semester" || rekapPeriodType === "tahunan") {
      setRekapStartDate("");
      setRekapEndDate("");
    }
  }, [rekapPeriodType, selectedDate, todayStr]);

  // Pending replacement check
  const pendingReplacementExchanges = useMemo(() => {
    return scheduleExchangesList.filter(ex => !ex.scheduleBId || (ex.reason && ex.reason.toLowerCase().includes("belum diganti")));
  }, [scheduleExchangesList]);

  const { data: rekapData, isLoading: isLoadingRekap } = useQuery({
    queryKey: ["teacherAttendanceRecap", selectedAyId, selectedSemesterId, rekapStartDate, rekapEndDate, filterTeacherId, filterSubjectId, filterGradeLevel, filterClassId],
    queryFn: () => teacherTeachingAttendanceService.getAttendanceRecap({
      academicYearId: selectedAyId,
      semesterId: rekapPeriodType === "tahunan" ? undefined : selectedSemesterId,
      startDate: rekapStartDate || undefined,
      endDate: rekapEndDate || undefined,
      teacherId: filterTeacherId || undefined,
      subjectId: filterSubjectId || undefined,
      gradeLevel: filterGradeLevel || undefined,
      classId: filterClassId || undefined
    })
  });

  // Extract raw records for Exception First Dashboard
  const rawRecords = useMemo(() => rekapData?.rawRecords || [], [rekapData]);

  // Scheduled / Active Teachers count in selected filter range
  const guruMengajarList = useMemo(() => {
    const teacherMap = new Map<string, string>();
    rawRecords.forEach(r => {
      if (r.teacherId) teacherMap.set(r.teacherId, r.teacherName || "Guru");
      if (r.substituteTeacherId) teacherMap.set(r.substituteTeacherId, r.substituteTeacherName || "Guru Pengganti");
    });
    return Array.from(teacherMap.entries()).map(([id, name]) => ({ id, name }));
  }, [rawRecords]);

  // Categorized Exception Record Sets
  const hadirRecords = useMemo(() => rawRecords.filter(r => r.status === "Hadir Mengajar" || r.status === "Terlambat"), [rawRecords]);
  const tugasRecords = useMemo(() => rawRecords.filter(r => r.status === "Tugas Dinas"), [rawRecords]);
  const izinRecords = useMemo(() => rawRecords.filter(r => r.status === "Izin"), [rawRecords]);
  const sakitRecords = useMemo(() => rawRecords.filter(r => r.status === "Sakit"), [rawRecords]);
  const digantiRecords = useMemo(() => rawRecords.filter(r => r.status === "Digantikan Guru Lain"), [rawRecords]);
  const tukarJpRecords = useMemo(() => rawRecords.filter(r => r.status === "Tukar Jadwal"), [rawRecords]);
  const tidakHadirRecords = useMemo(() => rawRecords.filter(r => r.status === "Tidak Hadir"), [rawRecords]);
  const belumDiverifikasiRecords = useMemo(() => rawRecords.filter(r => !r.status || r.status === "Belum Diverifikasi"), [rawRecords]);

  // Unreplaced teaching sessions: status Digantikan Guru Lain but substitute teacher is missing
  const unreplacedRecords = useMemo(() => digantiRecords.filter(r => !r.substituteTeacherId && !r.substituteTeacherName), [digantiRecords]);

  // Critical exception sessions requiring urgent attention / action
  const criticalRecords = useMemo(() => [
    ...tidakHadirRecords,
    ...unreplacedRecords,
    ...sakitRecords,
    ...izinRecords
  ], [tidakHadirRecords, unreplacedRecords, sakitRecords, izinRecords]);

  // Dedicated Absent & Leave records set for Kepala Sekolah notification
  const absentAndLeaveRecords = useMemo(() => [
    ...tidakHadirRecords,
    ...izinRecords,
    ...sakitRecords
  ], [tidakHadirRecords, izinRecords, sakitRecords]);

  // Attendance Status Distribution Chart Data
  const chartDistributionData = useMemo(() => [
    { name: "Hadir", label: "Guru Hadir", count: hadirRecords.length, fill: "#10b981", key: "hadir" },
    { name: "Tugas Dinas", label: "Tugas Dinas", count: tugasRecords.length, fill: "#3b82f6", key: "tugas" },
    { name: "Izin", label: "Guru Izin", count: izinRecords.length, fill: "#eab308", key: "izin" },
    { name: "Sakit", label: "Guru Sakit", count: sakitRecords.length, fill: "#f59e0b", key: "sakit" },
    { name: "Digantikan", label: "Guru Digantikan", count: digantiRecords.length, fill: "#f97316", key: "diganti" },
    { name: "Tukar JP", label: "Guru Tukar JP", count: tukarJpRecords.length, fill: "#8b5cf6", key: "tukar" },
    { name: "Tidak Hadir", label: "Tidak Hadir", count: tidakHadirRecords.length, fill: "#f43f5e", key: "alpa" },
    { name: "Belum Verifikasi", label: "Belum Verifikasi", count: belumDiverifikasiRecords.length, fill: "#64748b", key: "unverified" }
  ], [hadirRecords, tugasRecords, izinRecords, sakitRecords, digantiRecords, tukarJpRecords, tidakHadirRecords, belumDiverifikasiRecords]);

  // Helper to extract numerical JP for sorting
  const parseJpNum = (record: TeacherTeachingAttendance): number => {
    if (typeof record.sequence === "number" && record.sequence > 0) {
      return record.sequence;
    }
    if (record.jp) {
      const match = record.jp.match(/\d+/);
      if (match) {
        return parseInt(match[0], 10);
      }
    }
    return 0;
  };

  const sortRecordsByNameAndJp = (records: TeacherTeachingAttendance[]): TeacherTeachingAttendance[] => {
    return [...records].sort((a, b) => {
      // 1. Sort by Teacher Name (A to Z)
      const nameA = (a.teacherName || "").trim().toLowerCase();
      const nameB = (b.teacherName || "").trim().toLowerCase();
      const nameComp = nameA.localeCompare(nameB, "id", { sensitivity: "base" });
      if (nameComp !== 0) return nameComp;

      // 2. Sort by Date ascending (for multi-date views)
      const dateA = a.date || "";
      const dateB = b.date || "";
      const dateComp = dateA.localeCompare(dateB);
      if (dateComp !== 0) return dateComp;

      // 3. Sort by JP Number (JP 1 to JP 8)
      const jpA = parseJpNum(a);
      const jpB = parseJpNum(b);
      return jpA - jpB;
    });
  };

  // Filtered and sorted records inside Modal
  const filteredModalRecords = useMemo(() => {
    if (!cardDetailModal?.records) return [];
    
    // Sort records alphabetically by teacher name, then chronologically by date and JP 1-8
    const sorted = sortRecordsByNameAndJp(cardDetailModal.records);

    if (!cardModalSearch.trim()) return sorted;
    const q = cardModalSearch.toLowerCase();
    return sorted.filter(r => 
      r.teacherName?.toLowerCase().includes(q) ||
      r.subjectName?.toLowerCase().includes(q) ||
      r.className?.toLowerCase().includes(q) ||
      r.substituteTeacherName?.toLowerCase().includes(q) ||
      r.exchangedWithTeacherName?.toLowerCase().includes(q) ||
      r.notes?.toLowerCase().includes(q) ||
      r.date?.includes(q) ||
      r.jp?.toLowerCase().includes(q)
    );
  }, [cardDetailModal, cardModalSearch]);

  const handleExportModalExcel = (title: string, records: TeacherTeachingAttendance[]) => {
    const dataToExport = records.map((item, idx) => ({
      No: idx + 1,
      Tanggal: item.date,
      Hari: item.day,
      "Nama Guru": item.teacherName,
      "Mata Pelajaran": item.subjectName,
      Kelas: item.className,
      "No. JP / Jam": `${item.jp} (${item.timeSlot || "-"})`,
      Status: item.status,
      "Guru Pengganti": item.substituteTeacherName || "-",
      "Guru Penukar": item.exchangedWithTeacherName || "-",
      Catatan: item.notes || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detail_Exception");
    XLSX.writeFile(workbook, `${title.replace(/\s+/g, "_")}.xlsx`);
  };

  // Modal Detail History
  const [detailTeacher, setDetailTeacher] = useState<{ id: string; name: string } | null>(null);
  
  const { data: teacherHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["teacherHistory", detailTeacher?.id, selectedAyId, selectedSemesterId],
    queryFn: () => teacherTeachingAttendanceService.getTeacherHistory(detailTeacher!.id, {
      academicYearId: selectedAyId,
      semesterId: selectedSemesterId
    }),
    enabled: !!detailTeacher?.id
  });

  // --- EXPORT FUNCTIONS ---
  const handleExportInputExcel = () => {
    const dataToExport = localAttendanceItems.map((item, idx) => ({
      No: idx + 1,
      Tanggal: item.date,
      Hari: item.day,
      "Nama Guru": item.teacherName,
      "Mata Pelajaran": item.subjectName,
      Kelas: item.className,
      "No. JP / Jam": `${item.jp} (${item.timeSlot || "-"})`,
      Status: item.status,
      "Guru Pengganti": item.substituteTeacherName || "-",
      Catatan: item.notes || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Absensi_Mengajar");
    XLSX.writeFile(workbook, `Absensi_Mengajar_${selectedDate}.xlsx`);
  };

  const handleExportInputPdf = () => {
    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text(`REKAP ABSENSI MENGAJAR GURU - ${selectedDate} (${dayName})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Tahun Pelajaran: ${activeAy?.name || "-"} | Semester: ${activeSem?.name || "-"}`, 14, 22);

    let startY = 30;
    doc.setFontSize(9);
    doc.text("No  |  Nama Guru  |  Mapel  |  Kelas  |  JP  |  Status  |  Guru Pengganti  |  Catatan", 14, startY);
    doc.line(14, startY + 2, 280, startY + 2);
    startY += 8;

    localAttendanceItems.forEach((item, idx) => {
      if (startY > 180) {
        doc.addPage();
        startY = 15;
      }
      const line = `${idx + 1}.  ${item.teacherName}  |  ${item.subjectName}  |  ${item.className}  |  ${item.jp}  |  ${item.status}  |  ${item.substituteTeacherName || "-"}  |  ${item.notes || "-"}`;
      doc.text(line, 14, startY);
      startY += 6;
    });

    doc.save(`Absensi_Mengajar_${selectedDate}.pdf`);
  };

  const handleExportRekapExcel = () => {
    if (!rekapData?.summaries) return;
    const dataToExport = rekapData.summaries.map((s, idx) => ({
      No: idx + 1,
      "Nama Guru": s.teacherName,
      "JML JP (Jadwal Asli)": s.jmlJp,
      "Kehadiran (JP)": s.hadirJP,
      "Menggantikan (JP)": s.menggantikanJP,
      "Digantikan (JP)": s.digantikanJP,
      "Tidak Hadir (JP)": s.tidakHadirJP,
      "Terlambat (JP)": s.terlambatJP,
      "Total JP": s.totalJP,
      "Persentase Kehadiran (%)": `${s.kehadiranPercentage ?? s.percentage}%`,
      "Status Neraca": s.isBalanced ? "✓ Valid (Seimbang)" : "⚠ Cek Neraca"
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap_Kehadiran_Guru");
    XLSX.writeFile(workbook, `Rekap_Kehadiran_Guru_${rekapStartDate || "Semua"}_sd_${rekapEndDate || "Semua"}.xlsx`);
  };

  const handleExportRekapPdf = () => {
    if (!rekapData?.summaries) return;
    const doc = new jsPDF("landscape");
    doc.setFontSize(14);
    doc.text(`REKAPITULASI KEHADIRAN MENGAJAR GURU (JP)`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Tahun Pelajaran: ${activeAy?.name || "-"} | Semester: ${activeSem?.name || "-"} | Periode: ${rekapStartDate || "Awal"} s/d ${rekapEndDate || "Akhir"}`, 14, 22);

    let startY = 30;
    doc.setFontSize(8.5);
    doc.text("No | Nama Guru | JML JP | Kehadiran | Menggantikan | Digantikan | Tidak Hadir | Terlambat | Total JP | % Kehadiran", 14, startY);
    doc.line(14, startY + 2, 280, startY + 2);
    startY += 8;

    rekapData.summaries.forEach((s, idx) => {
      if (startY > 185) {
        doc.addPage();
        startY = 15;
      }
      const line = `${idx + 1}. | ${s.teacherName.padEnd(20, ' ')} | ${s.jmlJp} JP | ${s.hadirJP} JP | ${s.menggantikanJP} JP | ${s.digantikanJP} JP | ${s.tidakHadirJP} JP | ${s.terlambatJP} JP | ${s.totalJP} JP | ${s.kehadiranPercentage ?? s.percentage}%`;
      doc.text(line, 14, startY);
      startY += 6;
    });

    doc.save(`Rekap_Kehadiran_Guru.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 dark:from-zinc-900 dark:to-zinc-950 text-white p-6 rounded-2xl shadow-lg border border-blue-800/30">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs font-semibold tracking-wide border border-blue-400/30 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              Monitoring Sesi KBM
            </span>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-md text-xs font-semibold tracking-wide border border-emerald-400/30">
              Akses Kurikulum / Wakakur
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Monitoring Pelaksanaan Jam Mengajar (Per Sesi / Per JP)
          </h1>
          <p className="text-sm text-blue-100/80 max-w-2xl">
            Sistem pemantauan dan pencatatan kehadiran guru berbasis Sesi/JP mengajar real-time, penggantian guru, pertukaran jadwal, dan terintegrasi Kalender Akademik.
          </p>
        </div>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowAuditModal(true)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Lihat Rekam Jejak Audit Log Perubahan Absensi Guru"
          >
            <History className="w-4 h-4 text-amber-300" />
            Log Perubahan
          </button>

          {activeTab === "input" && (
            <>
              {isWakakurOrAdmin && (
                <button
                  type="button"
                  onClick={() => setShowExchangeModal(true)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  Tukar Jadwal Sesi
                </button>
              )}
              <button
                onClick={handleExportInputExcel}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Export Excel
              </button>
              <button
                onClick={handleExportInputPdf}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                Export PDF
              </button>
              {isWakakurOrAdmin && (
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || isKbmDisabled}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                    isDirty
                      ? "bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-300"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Save className="w-4 h-4" />
                  {saveMutation.isPending ? "Memproses..." : isDirty ? "Simpan Perubahan *" : "Simpan Monitoring"}
                </button>
              )}
            </>
          )}

          {activeTab === "rekap" && (
            <>
              <button
                onClick={handleExportRekapExcel}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Export Excel Rekap
              </button>
              <button
                onClick={handleExportRekapPdf}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-xs border border-white/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-4 h-4 text-rose-400" />
                Export PDF Rekap
              </button>
            </>
          )}
        </div>
      </div>

      {/* Leadership Monitoring Widget (for Kepala Sekolah, Yayasan & Wakakur) */}
      {leadershipStats && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Dashboard Monitoring Kepala Sekolah & Pimpinan Semester Ini
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-semibold">T.A: {activeAy?.name} - {activeSem?.name}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Persentase KBM Terlaksana</span>
              <div className="text-2xl font-black text-emerald-400">{leadershipStats.kbmExecutionPercentage}%</div>
              <p className="text-[10px] text-slate-400">Total Sesi Terlaksana / Sesi Wajib</p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Penggantian Guru</span>
              <div className="text-2xl font-black text-purple-400">{leadershipStats.totalSubstitutionsSemester} Sesi</div>
              <p className="text-[10px] text-slate-400">Digantikan Guru Lain Semester Ini</p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Tukar Jadwal</span>
              <div className="text-2xl font-black text-amber-400">{leadershipStats.totalExchangesSemester} Sesi</div>
              <p className="text-[10px] text-slate-400">Pertukaran Sesi Mengajar</p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Sering Berhalangan</span>
              <div className="text-xs font-bold text-rose-300 truncate">
                {leadershipStats.topAbsentTeachers.length > 0
                  ? `${leadershipStats.topAbsentTeachers[0].teacherName} (${leadershipStats.topAbsentTeachers[0].count} Sesi)`
                  : "Nihil"}
              </div>
              <p className="text-[10px] text-slate-400">Tingkat Ketidakhadiran Tertinggi</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("input")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "input"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Monitoring Sesi Mengajar Hari Ini
          </button>
          <button
            onClick={() => setActiveTab("validasi")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "validasi"
                ? "bg-amber-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Validasi Absensi Mengajar
            {!!validationStats?.pendingCount && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-rose-500 text-white font-extrabold animate-pulse">
                {validationStats.pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("rekap")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rekap"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            Rekapitilasi Kehadiran Guru (JP 1–8)
          </button>
          <button
            onClick={() => setActiveTab("absensi_halaqah")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "absensi_halaqah"
                ? "bg-emerald-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            Absensi Harian Halaqah
          </button>
          <button
            onClick={() => setActiveTab("rekap_halaqah")}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "rekap_halaqah"
                ? "bg-teal-600 text-white shadow-md"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
            }`}
          >
            <BookOpen className="w-4 h-4 text-teal-300" />
            Rekap Absensi Halaqah
          </button>
        </div>

        {/* Academic Year & Semester Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-zinc-700">
            <span className="font-semibold text-slate-500 dark:text-zinc-400">T.A:</span>
            <select
              value={selectedAyId}
              onChange={(e) => setSelectedAyId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
            >
              {academicYears.map(y => (
                <option key={y.id} value={y.id} className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">
                  {y.name} {y.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-xl text-xs border border-slate-200 dark:border-zinc-700">
            <span className="font-semibold text-slate-500 dark:text-zinc-400">Sem:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
            >
              {availableSemesters.map(s => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-100">
                  {s.name} {s.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifikasi Kepemimpinan / Kepala Sekolah jika ada Guru Izin atau Tidak Hadir */}
      {absentAndLeaveRecords.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-amber-300/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-xs shrink-0 shadow-inner">
              <Bell className="w-6 h-6 text-white animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 bg-white/25 text-white rounded-full text-[10px] font-black uppercase tracking-wider border border-white/30">
                  Notifikasi Kepala Sekolah & Pimpinan
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wide text-amber-100">
                  Ketidakhadiran Guru Terdeteksi ({absentAndLeaveRecords.length} Sesi)
                </span>
              </div>
              <p className="text-xs text-white font-medium mt-1 leading-relaxed">
                Pemberitahuan kepada Kepala Sekolah & Manajemen: Terdaftar{" "}
                {tidakHadirRecords.length > 0 && <strong className="underline font-bold">{tidakHadirRecords.length} Sesi Tidak Hadir (Alpa)</strong>}
                {tidakHadirRecords.length > 0 && (izinRecords.length > 0 || sakitRecords.length > 0) && ", "}
                {izinRecords.length > 0 && <strong className="underline font-bold">{izinRecords.length} Sesi Izin</strong>}
                {izinRecords.length > 0 && sakitRecords.length > 0 && ", "}
                {sakitRecords.length > 0 && <strong className="underline font-bold">{sakitRecords.length} Sesi Sakit</strong>}
                . Silakan periksa rincian terurut untuk koordinasi penugasan/guru pengganti.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCardDetailModal({
              isOpen: true,
              title: "Detail Ketidakhadiran Guru (Izin, Sakit & Tidak Hadir)",
              subtitle: "Data diurutkan berdasarkan Abjad Nama Guru (A-Z) dan Sesi JP (JP 1 - JP 8)",
              categoryKey: "absent_leave",
              records: absentAndLeaveRecords
            })}
            className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-extrabold text-xs rounded-xl transition-all shadow-md shrink-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-rose-600" />
            Lihat Detail Rekap ({absentAndLeaveRecords.length} Sesi)
          </button>
        </div>
      )}

      {/* Indicator Monitoring Check-in / Check-out QR Mengajar */}
      {isWakakurOrAdmin && qrStats && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Monitoring Teaching Check-In QR ({selectedDate})
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Real-time status konfirmasi kehadiran mengajar guru via pemindaian QR kelas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/teaching-qr-checkin"
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan QR</span>
              </Link>
              <button
                type="button"
                onClick={() => setIsClassQrModalOpen(true)}
                className="px-3.5 py-2 bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak QR Kelas</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* 1. Belum Check-In */}
            <button
              type="button"
              onClick={() => setCardDetailModal({
                isOpen: true,
                title: "Daftar Sesi Guru Belum Check-In QR",
                subtitle: "Guru belum memindai QR Code kelas saat jam mengajar telah/sedang berjalan",
                categoryKey: "qr_belum_checkin",
                records: qrStats.belumCheckIn
              })}
              className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 rounded-2xl text-left hover:scale-[1.02] transition-all cursor-pointer group"
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-between">
                <span>Belum Check In</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-black text-amber-900 dark:text-amber-100 mt-1">
                {qrStats.belumCheckIn.length} <span className="text-xs font-normal opacity-70">Sesi</span>
              </div>
              <p className="text-[10px] text-amber-800 dark:text-amber-300 mt-1 group-hover:underline">
                Klik detail &rarr;
              </p>
            </button>

            {/* 2. Belum Check-Out */}
            <button
              type="button"
              onClick={() => setCardDetailModal({
                isOpen: true,
                title: "Daftar Sesi Guru Belum Check-Out QR",
                subtitle: "Guru sudah check-in tetapi jam mengajar usai tanpa scan check-out. Wakakur dapat melakukan Check Out Manual.",
                categoryKey: "qr_belum_checkout",
                records: qrStats.belumCheckOut
              })}
              className="p-3.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/80 rounded-2xl text-left hover:scale-[1.02] transition-all cursor-pointer group"
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center justify-between">
                <span>Belum Check Out</span>
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-black text-blue-900 dark:text-blue-100 mt-1">
                {qrStats.belumCheckOut.length} <span className="text-xs font-normal opacity-70">Sesi</span>
              </div>
              <p className="text-[10px] text-blue-800 dark:text-blue-300 mt-1 group-hover:underline">
                Klik untuk Check-Out Manual &rarr;
              </p>
            </button>

            {/* 3. Terlambat Check-In */}
            <button
              type="button"
              onClick={() => setCardDetailModal({
                isOpen: true,
                title: "Daftar Sesi Guru Terlambat Check-In QR",
                subtitle: "Guru memindai QR Code lebih dari 15 menit setelah jam pelajaran dimulai",
                categoryKey: "qr_terlambat",
                records: qrStats.terlambatCheckIn
              })}
              className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80 rounded-2xl text-left hover:scale-[1.02] transition-all cursor-pointer group"
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-between">
                <span>Terlambat Check In</span>
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-black text-rose-900 dark:text-rose-100 mt-1">
                {qrStats.terlambatCheckIn.length} <span className="text-xs font-normal opacity-70">Sesi</span>
              </div>
              <p className="text-[10px] text-rose-800 dark:text-rose-300 mt-1 group-hover:underline">
                Klik detail &rarr;
              </p>
            </button>

            {/* 4. Lupa Check-Out / Manual */}
            <button
              type="button"
              onClick={() => setCardDetailModal({
                isOpen: true,
                title: "Daftar Sesi Check-Out Manual / Terindikasi Lupa Scan",
                subtitle: "Sesi mengajar yang dicatat Check Out Manual oleh Wakakur atau terindikasi lupa scan",
                categoryKey: "qr_lupa_checkout",
                records: qrStats.lupaCheckOut
              })}
              className="p-3.5 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/80 rounded-2xl text-left hover:scale-[1.02] transition-all cursor-pointer group"
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400 flex items-center justify-between">
                <span>Check Out Manual</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-2xl font-black text-purple-900 dark:text-purple-100 mt-1">
                {qrStats.lupaCheckOut.length} <span className="text-xs font-normal opacity-70">Sesi</span>
              </div>
              <p className="text-[10px] text-purple-800 dark:text-purple-300 mt-1 group-hover:underline">
                Klik detail &rarr;
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Alert Banner: Pending Unreplaced JP Notification */}
      {pendingReplacementExchanges.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="font-extrabold text-amber-900 dark:text-amber-100 flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm">Masih terdapat JP yang belum tergantikan.</span>
              <span className="px-2.5 py-0.5 bg-amber-200 dark:bg-amber-900 text-amber-950 dark:text-amber-100 rounded-lg text-[10px] font-black uppercase tracking-wider">
                {pendingReplacementExchanges.length} Pertukaran Pending
              </span>
            </div>
            <p className="text-amber-800 dark:text-amber-300">
              Jumlah JP mata pelajaran tidak boleh berkurang akibat pertukaran. Jadwal di bawah ini memerlukan penugasan JP pengganti lengkap oleh Wakakur/Guru:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {pendingReplacementExchanges.map((ex) => (
                <div key={ex.id} className="px-3 py-1 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 rounded-xl text-[11px] font-bold text-amber-900 dark:text-amber-200 shadow-2xs">
                  {ex.teacherAName} ({ex.subjectAName} — {ex.classAName}, JP {ex.jpA}) Tgl: {ex.date}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: INPUT ABSENSI MENGAJAR                             */}
      {/* ========================================================= */}
      {activeTab === "input" && (
        <div className="space-y-6">
          {/* Absensi Belum Lengkap Alert Card for Wakakur */}
          {isWakakurOrAdmin && incompleteDates.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs uppercase tracking-wider">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Sesi Mengajar Belum Diverifikasi ({incompleteDates.length} Tanggal)
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(true)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Lihat Log Audit Perubahan
                </button>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Wakakur dapat melakukan pengisian atau verifikasi susulan pada tanggal lampau dalam semester aktif ini. Klik tanggal di bawah untuk berpindah:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {incompleteDates.slice(0, 10).map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    onClick={() => setSelectedDate(item.date)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedDate === item.date
                        ? "bg-amber-600 text-white shadow-xs"
                        : "bg-white dark:bg-zinc-800 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {item.date} ({item.day}) — {item.missingCount}/{item.totalCount} Sesi Belum
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Controls Bar */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Pilih Tanggal Mengajar
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3.5 py-2 pl-9 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-sm font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>

                  {/* Quick Date Selectors for Flexible Past Date Picking */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(todayStr)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedDate === todayStr
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      Hari Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getOffsetDateStr(1))}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedDate === getOffsetDateStr(1)
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      Kemarin
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getOffsetDateStr(3))}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedDate === getOffsetDateStr(3)
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      3 H. Lalu
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getOffsetDateStr(7))}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedDate === getOffsetDateStr(7)
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      7 H. Lalu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const y = selectedDate ? selectedDate.split("-")[0] : new Date().getFullYear().toString();
                        setSelectedDate(`${y}-07-25`);
                      }}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        selectedDate.endsWith("-07-25")
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 hover:bg-amber-200"
                      }`}
                    >
                      25 Juli (Awal KBM)
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 flex items-center gap-3">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Hari Active</div>
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{dayName}</div>
                </div>
                <div className="h-6 w-px bg-slate-200 dark:bg-zinc-800" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Sesi Mengajar</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-zinc-100">{stats.total} Sesi</div>
                </div>
              </div>
            </div>

            {/* Quick Search & Status Filter */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari Guru / Mapel / Kelas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="Hadir Mengajar">Hadir Mengajar</option>
                <option value="Terlambat">Terlambat</option>
                <option value="Izin">Izin</option>
                <option value="Sakit">Sakit</option>
                <option value="Tugas Dinas">Tugas Dinas</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
                <option value="Digantikan Guru Lain">Digantikan Guru Lain</option>
                <option value="Tukar Jadwal">Tukar Jadwal</option>
                <option value="KBM Ditiadakan">KBM Ditiadakan</option>
                <option value="Belum Diverifikasi">Belum Diverifikasi</option>
              </select>
            </div>
          </div>

          {/* Kaldik Lock Banner */}
          {dailyAttendanceData?.isKbmDisabled && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold">
                    {overrideKbmLock ? "Kunci Absensi Dibuka Secara Manual" : "Hari ini ditandai Non-KBM di Kalender Akademik"}
                  </h4>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Agenda Kalender Akademik: <span className="font-semibold underline">{dailyAttendanceData.lockReason}</span>.
                    {overrideKbmLock ? " Pengisian absensi diizinkan pada tanggal ini." : " Input absensi dikunci secara otomatis oleh sistem."}
                  </p>
                </div>
              </div>
              {isWakakurOrAdmin && (
                <button
                  type="button"
                  onClick={() => setOverrideKbmLock(!overrideKbmLock)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {overrideKbmLock ? "Tutup Kunci KBM" : "Buka Kunci Absensi Tanggal Ini"}
                </button>
              )}
            </div>
          )}

          {/* Backdate Reason Banner if editing past dates */}
          {selectedDate < todayStr && isWakakurOrAdmin && (
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-bold">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <span>Pengisian / Perbaikan Susulan Tanggal Lampau ({selectedDate})</span>
                  <p className="text-[11px] font-normal text-blue-700 dark:text-blue-300">
                    Sistem mencatat tanggal ini sebagai Input Susulan. Seluruh perubahan akan terekam pada Audit Log.
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Alasan perbaikan (opsional)..."
                  value={backdateReason}
                  onChange={(e) => setBackdateReason(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-xl text-slate-800 dark:text-zinc-100 w-full sm:w-64"
                />
              </div>
            </div>
          )}

          {/* Daily Stats Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Sesi</span>
              <div className="text-xl font-extrabold text-slate-800 dark:text-zinc-100">{stats.total}</div>
              <p className="text-[10px] text-slate-400">Jadwal hari {dayName}</p>
            </div>

            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-200/60 dark:border-emerald-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Hadir</span>
              <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{stats.hadir}</div>
              <p className="text-[10px] text-emerald-600/80">Sesuai Jadwal</p>
            </div>

            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3.5 rounded-2xl border border-blue-200/60 dark:border-blue-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Izin / Sakit / Tugas</span>
              <div className="text-xl font-extrabold text-blue-700 dark:text-blue-300">{stats.izin + stats.sakit + stats.tugas}</div>
              <p className="text-[10px] text-blue-600/80">Terpencatatkan</p>
            </div>

            <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3.5 rounded-2xl border border-rose-200/60 dark:border-rose-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase">Tidak Hadir</span>
              <div className="text-xl font-extrabold text-rose-700 dark:text-rose-300">{stats.tidakHadir}</div>
              <p className="text-[10px] text-rose-600/80">Tanpa Keterangan</p>
            </div>

            <div className="bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-200/60 dark:border-purple-900/30 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Diganti</span>
              <div className="text-xl font-extrabold text-purple-700 dark:text-purple-300">{stats.diganti}</div>
              <p className="text-[10px] text-purple-600/80">Guru Pengganti</p>
            </div>

            <div className="bg-slate-100 dark:bg-zinc-800 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-xs space-y-1">
              <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase">KBM Ditiadakan</span>
              <div className="text-xl font-extrabold text-slate-700 dark:text-zinc-200">{stats.kbmDitiadakan}</div>
              <p className="text-[10px] text-slate-400">Kalender / Agenda</p>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white p-3.5 rounded-2xl shadow-md space-y-1">
              <span className="text-[10px] font-bold text-indigo-100 uppercase">Kehadiran Hari Ini</span>
              <div className="text-xl font-extrabold">{stats.percentage}%</div>
              <p className="text-[10px] text-indigo-100/80">Rasio Pelaksanaan</p>
            </div>
          </div>

          {/* Input Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
            {isLoadingAttendance ? (
              <div className="p-12 text-center">
                <Loading />
                <p className="text-xs text-slate-400 mt-2">Memuat jadwal mengajar hari {dayName}...</p>
              </div>
            ) : filteredInputItems.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">Tidak Ada Jadwal Mengajar</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Tidak ditemukan sesi mengajar pada hari {dayName} ({selectedDate}) sesuai filter pencarian atau belum ada Jadwal Pelajaran dipublikasi.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-12 text-center">No</th>
                      <th className="py-3.5 px-4">Guru Utama</th>
                      <th className="py-3.5 px-4">Mata Pelajaran</th>
                      <th className="py-3.5 px-4">Kelas</th>
                      <th className="py-3.5 px-4">Jam / JP</th>
                      <th className="py-3.5 px-4 min-w-[180px]">Status Kehadiran</th>
                      <th className="py-3.5 px-4 min-w-[200px]">Catatan / Terlambat / Pengganti</th>
                      <th className="py-3.5 px-4 text-center min-w-[130px]">Aksi / Simpan Sesi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60 font-medium text-slate-800 dark:text-zinc-200">
                    {filteredInputItems.map(({ item, originalIndex }, displayIdx) => (
                      <tr key={item.scheduleId || displayIdx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">{displayIdx + 1}</td>
                        
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                            <span>{item.teacherName}</span>
                            {(item.isInputSusulan || selectedDate < todayStr) && (
                              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded text-[9px] font-black uppercase tracking-wider border border-amber-200/60">
                                Susulan
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">Jadwal Asli</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 dark:text-zinc-200">{item.subjectName}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-md font-bold text-[11px] border border-blue-200/50 dark:border-blue-900/30">
                            {item.className}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-zinc-200">
                            {item.jp?.toUpperCase().startsWith("JP") ? item.jp : `JP ${item.jp}`}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 font-medium mt-0.5">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{item.timeSlot ? `${item.timeSlot} WIB` : "Jam Pelajaran"}</span>
                          </div>
                          <div className="text-[10px] space-y-0.5 mt-1 pt-1 border-t border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                              <span className="font-semibold">IN:</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                                {item.checkInTime ? `${item.checkInTime.slice(0, 5)} WIB` : "-"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                              <span className="font-semibold">OUT:</span>
                              <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                                {item.checkOutTime
                                  ? `${item.checkOutTime.slice(0, 5)} WIB`
                                  : item.checkInTime
                                  ? "Belum dilakukan"
                                  : "-"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-600 dark:text-zinc-400">
                              <span className="font-semibold">Durasi:</span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {item.teachingDurationMinutes && item.checkOutTime
                                  ? `${item.teachingDurationMinutes}m`
                                  : item.checkInTime && !item.checkOutTime
                                  ? "Sedang Mengajar"
                                  : "-"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={item.status}
                            disabled={!isWakakurOrAdmin || isKbmDisabled}
                            onChange={(e) => handleStatusChange(originalIndex, e.target.value as AttendanceTeachingStatus)}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border focus:ring-2 focus:outline-hidden cursor-pointer ${
                              item.status === "Hadir Mengajar"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : item.status === "Terlambat"
                                ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                : item.status === "Belum Terkonfirmasi"
                                ? "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800 font-semibold"
                                : item.status === "Digantikan Guru Lain"
                                ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : item.status === "Tukar Jadwal"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                                : item.status === "Tidak Hadir"
                                ? "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                                : item.status === "KBM Ditiadakan"
                                ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                                : item.status === "Belum Diverifikasi"
                                ? "bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800"
                                : "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                            }`}
                          >
                            <option value="Hadir Mengajar">Hadir Mengajar</option>
                            <option value="Terlambat">Terlambat</option>
                            <option value="Belum Terkonfirmasi">Belum Terkonfirmasi</option>
                            <option value="Izin">Izin</option>
                            <option value="Sakit">Sakit</option>
                            <option value="Tugas Dinas">Tugas Dinas</option>
                            <option value="Digantikan Guru Lain">Digantikan Guru Lain</option>
                            <option value="Tukar Jadwal">Tukar Jadwal</option>
                            <option value="Tidak Hadir">Tidak Hadir</option>
                            <option value="KBM Ditiadakan">KBM Ditiadakan</option>
                            <option value="Belum Diverifikasi">Belum Diverifikasi</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4 space-y-1.5">
                          {item.status === "Digantikan Guru Lain" && (
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                                Pilih Guru Pengganti:
                              </label>
                              <select
                                value={item.substituteTeacherId || ""}
                                onChange={(e) => handleSubstituteChange(originalIndex, e.target.value)}
                                className="w-full px-2.5 py-1 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-lg text-xs font-semibold text-purple-900 dark:text-purple-200 focus:ring-1 focus:ring-purple-500 cursor-pointer"
                              >
                                <option value="">-- Pilih Guru Pengganti --</option>
                                {teachers.map(t => (
                                  <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {item.status === "Tukar Jadwal" && (
                            <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 rounded-lg">
                              <span className="text-[10px] font-semibold text-indigo-900 dark:text-indigo-200">
                                Tukar dg: <strong>{item.exchangedWithTeacherName || "Guru Penukar"}</strong>
                              </span>
                              {isWakakurOrAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleResetOrManageExchange(item)}
                                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                  title="Batalkan pertukaran ini dan kembalikan jadwal ke semula"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Kembalikan Semula
                                </button>
                              )}
                            </div>
                          )}

                          <input
                            type="text"
                            placeholder="Catatan (Terlambat 10m, dll)..."
                            value={item.notes || ""}
                            disabled={!isWakakurOrAdmin || isKbmDisabled}
                            onChange={(e) => handleNotesChange(originalIndex, e.target.value)}
                            className="w-full px-2.5 py-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs text-slate-800 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            disabled={!isWakakurOrAdmin || isKbmDisabled || savingSessionId === item.scheduleId}
                            onClick={() => saveSingleSessionMutation.mutate(item)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-bold text-[11px] rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                            title="Simpan absensi sesi mengajar ini secara langsung"
                          >
                            {savingSessionId === item.scheduleId ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Menyimpan...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Simpan Sesi</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: VALIDASI ABSENSI MENGAJAR (WAKA KURIKULUM)         */}
      {/* ========================================================= */}
      {activeTab === "validasi" && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 text-white p-5 sm:p-6 rounded-2xl shadow-lg border border-amber-400/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4">
              <div className="p-3.5 bg-white/20 rounded-2xl backdrop-blur-md shrink-0 shadow-inner">
                <ShieldAlert className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-white/25 text-white rounded-full text-[10px] font-black uppercase tracking-wider border border-white/30">
                    Workflow Waka Kurikulum
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-wide text-amber-100">
                    Validasi Manual & Persetujuan Otomatis Sesi Mengajar
                  </span>
                </div>
                <h2 className="text-lg font-black text-white mt-1">
                  Persetujuan Kehadiran & Sesi Mengajar Guru
                </h2>
                <p className="text-xs text-amber-100 font-medium mt-1 leading-relaxed max-w-3xl">
                  Sistem mengevaluasi absensi secara otomatis. Sesi yang berada di luar batas toleransi check-in/check-out (15 menit), lupa check-out, atau berstatus khusus ditandai sebagai <strong className="underline font-bold text-white">Pending</strong> dan memerlukan persetujuan Waka Kurikulum.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  refetchValidationStats();
                  refetchAttendance();
                  toast("Data statistik validasi diperbarui", "info");
                }}
                className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white font-bold text-xs rounded-xl transition-all border border-white/40 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* Validation Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Sesi</span>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-zinc-100">
                {validationStats?.totalCount || 0}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Sesi mengajar terdaftar</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Pending</span>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
                {validationStats?.pendingCount || 0}
                {!!validationStats?.pendingCount && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-extrabold animate-pulse">
                    Perlu Tindakan
                  </span>
                )}
              </div>
              <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-0.5">Memerlukan persetujuan</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-xs">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Approved (Auto)</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {validationStats?.automaticApprovalCount || 0}
              </div>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">Sesuai batas toleransi</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 shadow-xs">
              <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Approved (Manual)</span>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {validationStats?.manualApprovalCount || 0}
              </div>
              <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/80 font-medium mt-0.5">Disetujui Waka Kurikulum</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-xs">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Ditolak</span>
                <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
                  <UserX className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                {validationStats?.rejectedCount || 0}
              </div>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 font-medium mt-0.5">Absensi ditolak</p>
            </div>
          </div>

          {/* Validation Filter Bar & Table */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-slate-150 dark:border-zinc-800">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">Tanggal:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent font-bold text-xs text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
                  />
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari guru, mapel, atau kelas..."
                    value={validationSearchQuery}
                    onChange={(e) => setValidationSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Status Filter Sub-Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl flex-wrap">
                {[
                  { id: "Pending", label: "Pending Validasi", icon: AlertTriangle, color: "text-amber-600" },
                  { id: "Approved", label: "Disetujui", icon: CheckCircle2, color: "text-emerald-600" },
                  { id: "Rejected", label: "Ditolak", icon: UserX, color: "text-rose-600" },
                  { id: "ALL", label: "Semua Sesi", icon: Layers, color: "text-slate-600" }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setValidationStatusFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      validationStatusFilter === tab.id
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-zinc-400 hover:bg-slate-200/70 dark:hover:bg-zinc-700/60"
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Batch Approve Action Bar if rows selected */}
            {selectedValidationIds.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {selectedValidationIds.length} catatan absensi terpilih
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedValidationIds([])}
                    className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold cursor-pointer transition-all"
                  >
                    Batal Pilih
                  </button>
                  <button
                    type="button"
                    onClick={() => batchApproveMutation.mutate(selectedValidationIds)}
                    disabled={batchApproveMutation.isPending}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Setujui Masal ({selectedValidationIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* Validation Table */}
            {isLoadingAttendance ? (
              <div className="p-12 text-center">
                <Loading />
              </div>
            ) : (() => {
              const allItems = localAttendanceItems.filter(item => {
                if (item.status === "KBM Ditiadakan") return false;
                const evalRes = teacherTeachingAttendanceService.evaluateAttendanceApprovalStatus(item);
                const currentStatus = item.validatedByUserId ? (item.attendanceStatus || evalRes.attendanceStatus) : evalRes.attendanceStatus;

                if (validationStatusFilter !== "ALL" && currentStatus !== validationStatusFilter) {
                  return false;
                }

                if (validationSearchQuery.trim()) {
                  const q = validationSearchQuery.toLowerCase();
                  const matchTeacher = item.teacherName?.toLowerCase().includes(q);
                  const matchSubject = item.subjectName?.toLowerCase().includes(q);
                  const matchClass = item.className?.toLowerCase().includes(q);
                  return matchTeacher || matchSubject || matchClass;
                }
                return true;
              });

              if (allItems.length === 0) {
                return (
                  <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 dark:bg-zinc-950/60 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                    Tidak ada catatan absensi yang sesuai dengan kriteria filter validasi ({validationStatusFilter}).
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                        <th className="py-3 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={selectedValidationIds.length > 0 && selectedValidationIds.length === allItems.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedValidationIds(allItems.map(i => i.id).filter(Boolean) as string[]);
                              } else {
                                setSelectedValidationIds([]);
                              }
                            }}
                            className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Tanggal & Sesi</th>
                        <th className="py-3 px-3">Nama Guru</th>
                        <th className="py-3 px-3">Mapel & Kelas</th>
                        <th className="py-3 px-3">Check-In / Check-Out</th>
                        <th className="py-3 px-3">Durasi</th>
                        <th className="py-3 px-3">Status & Alasan Pending</th>
                        <th className="py-3 px-3">Tipe Approval</th>
                        <th className="py-3 px-3 text-center">Aksi Wakakur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-zinc-800 font-medium text-slate-800 dark:text-zinc-200">
                      {allItems.map((item, idx) => {
                        const evalRes = teacherTeachingAttendanceService.evaluateAttendanceApprovalStatus(item);
                        const isManuallyVal = !!item.validatedByUserId;
                        const currentStatus = isManuallyVal ? (item.attendanceStatus || evalRes.attendanceStatus) : evalRes.attendanceStatus;
                        const pendingReason = isManuallyVal ? (item.pendingReason || "") : evalRes.pendingReason;
                        const approvalType = isManuallyVal ? (item.approvalType || evalRes.approvalType) : evalRes.approvalType;
                        const isChecked = !!item.id && selectedValidationIds.includes(item.id);

                        return (
                          <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                            <td className="py-3 px-3 text-center">
                              {item.id ? (
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedValidationIds(prev => [...prev, item.id!]);
                                    } else {
                                      setSelectedValidationIds(prev => prev.filter(id => id !== item.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                              ) : null}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-zinc-100">{item.date}</div>
                              <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">{item.jp} ({item.timeSlot})</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-zinc-100">{item.teacherName}</div>
                              <div className="text-[10px] text-slate-500">{item.status}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-800 dark:text-zinc-200">{item.subjectName}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">Kelas {item.className}</div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className={`font-bold ${item.checkInTime ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                                  IN: {item.checkInTime || "-"}
                                </span>
                                <span className="text-slate-300">|</span>
                                <span className={`font-bold ${item.checkOutTime ? "text-blue-600 dark:text-blue-400" : "text-amber-500"}`}>
                                  OUT: {item.checkOutTime || "-"}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-700 dark:text-zinc-300">
                              {item.teachingDurationMinutes ? `${item.teachingDurationMinutes}m` : "-"}
                            </td>
                            <td className="py-3 px-3">
                              <div className="space-y-1">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 ${
                                  currentStatus === "Approved" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                                  currentStatus === "Rejected" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                                  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                }`}>
                                  {currentStatus === "Approved" && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                  {currentStatus === "Rejected" && <UserX className="w-3 h-3 text-rose-600" />}
                                  {currentStatus === "Pending" && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                                  {currentStatus}
                                </span>
                                {pendingReason && currentStatus === "Pending" && (
                                  <div className="text-[10px] font-medium text-amber-700 dark:text-amber-300 leading-tight">
                                    ⚠️ {pendingReason}
                                  </div>
                                )}
                                {item.validationNote && currentStatus !== "Pending" && (
                                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 italic">
                                    Catatan: {item.validationNote}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                approvalType === "Automatic" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                              }`}>
                                {approvalType}
                              </span>
                              {item.validatedBy && (
                                <div className="text-[9px] text-slate-400 mt-0.5">Oleh: {item.validatedBy}</div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {isWakakurOrAdmin && item.id ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  {currentStatus !== "Approved" && (
                                    <button
                                      type="button"
                                      disabled={validateMutation.isPending}
                                      onClick={() => validateMutation.mutate({
                                        id: item.id!,
                                        dateStr: item.date,
                                        status: "Approved",
                                        validationNote: "Disetujui Waka Kurikulum"
                                      })}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                      title="Setujui Absensi Sesi Ini"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Setujui
                                    </button>
                                  )}
                                  {currentStatus !== "Rejected" && (
                                    <button
                                      type="button"
                                      disabled={validateMutation.isPending}
                                      onClick={() => {
                                        setRejectModalItem({
                                          id: item.id!,
                                          dateStr: item.date,
                                          teacherName: item.teacherName,
                                          subjectName: item.subjectName,
                                          className: item.className
                                        });
                                        setRejectReason("");
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                                      title="Tolak Absensi Sesi Ini"
                                    >
                                      <UserX className="w-3 h-3" />
                                      Tolak
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Modal Penolakan Absensi */}
          {rejectModalItem && (
            <Dialog
              isOpen={true}
              onClose={() => setRejectModalItem(null)}
              title="Tolak Absensi Sesi Mengajar"
            >
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200">
                  <div className="font-bold text-sm mb-1">Konfirmasi Penolakan Absensi</div>
                  <div>Guru: <strong>{rejectModalItem.teacherName}</strong></div>
                  <div>Mata Pelajaran: <strong>{rejectModalItem.subjectName}</strong> (Kelas {rejectModalItem.className})</div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-zinc-200 mb-1">
                    Alasan Penolakan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Masukkan alasan spesifik penolakan absensi ini..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl font-medium focus:ring-2 focus:ring-rose-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectModalItem(null)}
                    className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-200 rounded-xl font-bold transition-all cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!rejectReason.trim() || validateMutation.isPending}
                    onClick={() => validateMutation.mutate({
                      id: rejectModalItem.id,
                      dateStr: rejectModalItem.dateStr,
                      status: "Rejected",
                      validationNote: rejectReason
                    })}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <UserX className="w-4 h-4" />
                    Konfirmasi Penolakan
                  </button>
                </div>
              </div>
            </Dialog>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DASHBOARD REKAP ABSENSI GURU (EXCEPTION FIRST)     */}
      {/* ========================================================= */}
      {activeTab === "rekap" && (
        <div className="space-y-6">

          {/* 1. BANNER INFORMASI PRIORITAS (CRITICAL EXCEPTION BANNER) */}
          {criticalRecords.length > 0 && (
            <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-rose-400/40 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-pulse-subtle">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md shrink-0 shadow-inner">
                  <ShieldAlert className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-extrabold text-sm text-white tracking-wide uppercase">
                      PERHATIAN: EXCEPTION DETECTED!
                    </h4>
                    <span className="px-2.5 py-0.5 bg-white/25 text-white rounded-full text-[10px] font-black uppercase tracking-wider border border-white/30">
                      {criticalRecords.length} Sesi Kritis
                    </span>
                  </div>
                  <p className="text-xs text-rose-100 font-medium mt-1 leading-relaxed">
                    {unreplacedRecords.length > 0 
                      ? `Perhatian: Terdapat ${unreplacedRecords.length} sesi pembelajaran yang belum memiliki guru pengganti.` 
                      : `Perhatian: Terdapat ${tidakHadirRecords.length} guru tidak hadir (alpa), ${sakitRecords.length} guru sakit, dan ${izinRecords.length} guru izin yang perlu ditindaklanjuti.`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => openDetailModal("Sesi Kritis Memerlukan Tindak Lanjut", "kritis", criticalRecords)}
                className="px-4 py-2.5 bg-white hover:bg-rose-50 text-rose-950 font-black text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 border border-white/80 active:scale-95"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Lihat & Tindak Lanjut ({criticalRecords.length})</span>
                <ChevronRight className="w-4 h-4 text-rose-800" />
              </button>
            </div>
          )}

          {/* 2. REKAP FILTER BAR */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-150 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">Filter Monitoring & Rekapitulasi</h3>
                <span className="text-xs text-slate-400 font-normal">
                  ({rekapStartDate === rekapEndDate ? rekapStartDate : `${rekapStartDate} s/d ${rekapEndDate}`})
                </span>
              </div>

              {/* Periode Selector Buttons */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl flex-wrap">
                {[
                  { id: "harian", label: "Hari Ini" },
                  { id: "mingguan", label: "Minggu Ini" },
                  { id: "bulanan", label: "Bulan Ini" },
                  { id: "semester", label: "Semester" },
                  { id: "custom", label: "Rentang Tanggal Bebas" }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setRekapPeriodType(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      rekapPeriodType === p.id
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-700/60"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {rekapPeriodType === "custom" && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-900/40">
                <span className="text-xs font-bold text-blue-900 dark:text-blue-200">Rentang Tanggal Custom:</span>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500">Mulai:</label>
                  <input
                    type="date"
                    value={rekapStartDate}
                    onChange={(e) => setRekapStartDate(e.target.value)}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-slate-500">Sampai:</label>
                  <input
                    type="date"
                    value={rekapEndDate}
                    onChange={(e) => setRekapEndDate(e.target.value)}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Guru</label>
                <select
                  value={filterTeacherId}
                  onChange={(e) => setFilterTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Guru</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Mapel</label>
                <select
                  value={filterSubjectId}
                  onChange={(e) => setFilterSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Mapel</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Jenjang Target</label>
                <select
                  value={filterGradeLevel}
                  onChange={(e) => setFilterGradeLevel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Jenjang</option>
                  <option value="VII">Jenjang VII</option>
                  <option value="VIII">Jenjang VIII</option>
                  <option value="IX">Jenjang IX</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Filter Rombel / Kelas</label>
                <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 cursor-pointer"
                >
                  <option value="">Semua Rombel</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setFilterTeacherId("");
                    setFilterSubjectId("");
                    setFilterGradeLevel("");
                    setFilterClassId("");
                  }}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </div>

          {/* 3. EXCEPTION-FIRST KPI SUMMARY CARDS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-blue-600" />
                Ringkasan Status Kehadiran (Klik Kartu Untuk Detail)
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Actionable Exception First Dashboard
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-9 gap-3">
              {/* Card 1: Guru Mengajar */}
              <div
                onClick={() => openDetailModal("Guru Mengajar (Jadwal & Sesi)", "mengajar", rawRecords)}
                className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer border border-slate-800 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-300">Guru Mengajar</span>
                    <Users className="w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-xl font-black text-white">
                    {guruMengajarList.length} <span className="text-xs font-normal text-slate-400">Guru</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{rawRecords.length} Total Sesi</span>
                  <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 2: Guru Hadir (HIJAU) */}
              <div
                onClick={() => openDetailModal("Guru Hadir Mengajar", "hadir", hadirRecords)}
                className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">Guru Hadir</span>
                    <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {hadirRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/50 flex items-center justify-between text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                  <span>Sesi Hadir</span>
                  <ChevronRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 3: Guru Tugas Dinas (BIRU) */}
              <div
                onClick={() => openDetailModal("Guru Tugas Dinas", "tugas", tugasRecords)}
                className="bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-blue-900 dark:text-blue-200">Guru Tugas Dinas</span>
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-blue-700 dark:text-blue-300">
                    {tugasRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/50 flex items-center justify-between text-[10px] font-bold text-blue-800 dark:text-blue-300">
                  <span>Sesi Dinas</span>
                  <ChevronRight className="w-3 h-3 text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 4: Guru Izin (KUNING) */}
              <div
                onClick={() => openDetailModal("Guru Izin", "izin", izinRecords)}
                className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-yellow-900 dark:text-yellow-200">Guru Izin</span>
                    <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-yellow-700 dark:text-yellow-300">
                    {izinRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-yellow-200/60 dark:border-yellow-900/50 flex items-center justify-between text-[10px] font-bold text-yellow-800 dark:text-yellow-300">
                  <span>Sesi Izin</span>
                  <ChevronRight className="w-3 h-3 text-yellow-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 5: Guru Sakit (AMBER) */}
              <div
                onClick={() => openDetailModal("Guru Sakit", "sakit", sakitRecords)}
                className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">Guru Sakit</span>
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                    {sakitRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-amber-200/60 dark:border-amber-900/50 flex items-center justify-between text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  <span>Sesi Sakit</span>
                  <ChevronRight className="w-3 h-3 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 6: Guru Digantikan (ORANYE) */}
              <div
                onClick={() => openDetailModal("Guru / Sesi Digantikan", "diganti", digantiRecords)}
                className="bg-orange-50 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-orange-900 dark:text-orange-200">Guru Digantikan</span>
                    <RefreshCw className="w-4 h-4 text-orange-600 dark:text-orange-400 group-hover:rotate-45 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-orange-700 dark:text-orange-300">
                    {digantiRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-orange-200/60 dark:border-orange-900/50 flex items-center justify-between text-[10px] font-bold text-orange-800 dark:text-orange-300">
                  <span>{unreplacedRecords.length > 0 ? `⚠️ ${unreplacedRecords.length} Belum Diganti` : "Sesi Diganti"}</span>
                  <ChevronRight className="w-3 h-3 text-orange-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 7: Guru Tukar JP (UNGU / PURPLE) */}
              <div
                onClick={() => openDetailModal("Guru / Sesi Tukar JP", "tukar", tukarJpRecords)}
                className="bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200">Guru Tukar JP</span>
                    <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-purple-700 dark:text-purple-300">
                    {tukarJpRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-purple-200/60 dark:border-purple-900/50 flex items-center justify-between text-[10px] font-bold text-purple-800 dark:text-purple-300">
                  <span>Pertukaran JP</span>
                  <ChevronRight className="w-3 h-3 text-purple-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 8: Guru Tidak Hadir (MERAH) */}
              <div
                onClick={() => openDetailModal("Guru Tidak Hadir (Alpa)", "alpa", tidakHadirRecords)}
                className="bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800/80 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-rose-900 dark:text-rose-200">Guru Tidak Hadir</span>
                    <UserX className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-300">
                    {tidakHadirRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/50 flex items-center justify-between text-[10px] font-bold text-rose-800 dark:text-rose-300">
                  <span>Tidak Hadir</span>
                  <ChevronRight className="w-3 h-3 text-rose-600 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Card 9: Belum Diverifikasi (ABU-ABU) */}
              <div
                onClick={() => openDetailModal("Sesi Belum Diverifikasi", "unverified", belumDiverifikasiRecords)}
                className="bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 p-3.5 rounded-2xl shadow-xs hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-200">Belum Verifikasi</span>
                    <HelpCircle className="w-4 h-4 text-slate-500 dark:text-zinc-400 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="text-2xl font-black text-slate-700 dark:text-zinc-300">
                    {belumDiverifikasiRecords.length}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-700 flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-zinc-400">
                  <span>Sesi Belum Dihadirkan</span>
                  <ChevronRight className="w-3 h-3 text-slate-500 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </div>

          {/* 4. GRAFIK DISTRIBUSI STATUS KEHADIRAN GURU */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-150 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-600" />
                  Grafik Distribusi Status Kehadiran Guru
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualisasi statistik distribusi kehadiran mengajar untuk periode terpilih ({rekapPeriodType}).
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
                <span>Total Record:</span>
                <span className="text-blue-600 font-black">{rawRecords.length} Sesi</span>
              </div>
            </div>

            {rawRecords.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-400 space-y-2">
                <BarChart2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p>Belum ada data sesi mengajar terdata pada filter periode ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-64 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fontWeight: 700 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const pct = rawRecords.length > 0 ? Math.round((data.count / rawRecords.length) * 100) : 0;
                            return (
                              <div className="bg-slate-900 text-white p-2.5 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                <div className="font-bold border-b border-slate-700 pb-1">{data.label}</div>
                                <div className="flex items-center justify-between gap-4">
                                  <span>Jumlah:</span>
                                  <span className="font-extrabold text-amber-300">{data.count} Sesi</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 text-[11px] text-slate-300">
                                  <span>Persentase:</span>
                                  <span>{pct}%</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar
                        dataKey="count"
                        radius={[8, 8, 0, 0]}
                        onClick={(entry) => {
                          if (entry && entry.key) {
                            if (entry.key === "hadir") openDetailModal("Guru Hadir Mengajar", "hadir", hadirRecords);
                            else if (entry.key === "tugas") openDetailModal("Guru Tugas Dinas", "tugas", tugasRecords);
                            else if (entry.key === "izin") openDetailModal("Guru Izin", "izin", izinRecords);
                            else if (entry.key === "sakit") openDetailModal("Guru Sakit", "sakit", sakitRecords);
                            else if (entry.key === "diganti") openDetailModal("Guru / Sesi Digantikan", "diganti", digantiRecords);
                            else if (entry.key === "tukar") openDetailModal("Guru / Sesi Tukar JP", "tukar", tukarJpRecords);
                            else if (entry.key === "alpa") openDetailModal("Guru Tidak Hadir (Alpa)", "alpa", tidakHadirRecords);
                            else if (entry.key === "unverified") openDetailModal("Sesi Belum Diverifikasi", "unverified", belumDiverifikasiRecords);
                          }
                        }}
                        className="cursor-pointer hover:opacity-85 transition-opacity"
                      >
                        {chartDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Status Legend Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  {chartDistributionData.map((item) => {
                    const pct = rawRecords.length > 0 ? Math.round((item.count / rawRecords.length) * 100) : 0;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          if (item.key === "hadir") openDetailModal("Guru Hadir Mengajar", "hadir", hadirRecords);
                          else if (item.key === "tugas") openDetailModal("Guru Tugas Dinas", "tugas", tugasRecords);
                          else if (item.key === "izin") openDetailModal("Guru Izin", "izin", izinRecords);
                          else if (item.key === "sakit") openDetailModal("Guru Sakit", "sakit", sakitRecords);
                          else if (item.key === "diganti") openDetailModal("Guru / Sesi Digantikan", "diganti", digantiRecords);
                          else if (item.key === "tukar") openDetailModal("Guru / Sesi Tukar JP", "tukar", tukarJpRecords);
                          else if (item.key === "alpa") openDetailModal("Guru Tidak Hadir (Alpa)", "alpa", tidakHadirRecords);
                          else if (item.key === "unverified") openDetailModal("Sesi Belum Diverifikasi", "unverified", belumDiverifikasiRecords);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
                        <span className="text-slate-700 dark:text-zinc-200">{item.name}:</span>
                        <span className="text-slate-900 dark:text-white font-black">{item.count}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({pct}%)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4.5 EXECUTIVE TEACHING ANALYTICS WIDGET & JP STATUS SUMMARY */}
          <ExecutiveTeachingAnalyticsWidget records={rekapData?.rawRecords || []} />

          {/* 5. TABEL RINCIAN REKAPITULASI KEHADIRAN PER GURU */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-150 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Tabel Rincian Rekapitulasi Kehadiran Per Guru (JP)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Neraca Standar: <strong className="text-slate-600 dark:text-zinc-300">JML JP = Kehadiran + Digantikan + Tidak Hadir</strong> | <strong className="text-blue-600 dark:text-blue-400">Total JP = Kehadiran + Menggantikan</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 font-semibold px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg">
                  {rekapData?.summaries?.length || 0} Guru Terdata
                </span>
                <button
                  type="button"
                  onClick={handleExportRekapExcel}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={handleExportRekapPdf}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Export PDF
                </button>
              </div>
            </div>

            {isLoadingRekap ? (
              <div className="p-12 text-center">
                <Loading />
                <p className="text-xs text-slate-400 mt-2">Menghitung rekapitulasi kehadiran guru...</p>
              </div>
            ) : !rekapData?.summaries || rekapData.summaries.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <BarChart2 className="w-8 h-8 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-200">Belum Ada Data Rekap</h3>
                <p className="text-xs text-slate-400">Belum ada catatan absensi terdata untuk filter yang dipilih.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-3 w-10 text-center">No</th>
                      <th className="py-3 px-4">Nama Guru</th>
                      <th className="py-3 px-3 text-center bg-slate-100/60 dark:bg-zinc-800/40 text-slate-700 dark:text-zinc-200 font-black">
                        JML JP
                      </th>
                      <th className="py-3 px-3 text-center text-emerald-700 dark:text-emerald-400">
                        Kehadiran (JP)
                      </th>
                      <th className="py-3 px-3 text-center text-purple-700 dark:text-purple-400">
                        Menggantikan (JP)
                      </th>
                      <th className="py-3 px-3 text-center text-orange-700 dark:text-orange-400">
                        Digantikan (JP)
                      </th>
                      <th className="py-3 px-3 text-center text-rose-700 dark:text-rose-400">
                        Tidak Hadir (JP)
                      </th>
                      <th className="py-3 px-3 text-center text-amber-700 dark:text-amber-400">
                        Terlambat (JP)
                      </th>
                      <th className="py-3 px-3 text-center bg-blue-50/60 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 font-black">
                        Total JP
                      </th>
                      <th className="py-3 px-3 text-center">
                        % Kehadiran
                      </th>
                      <th className="py-3 px-3 text-center">
                        Audit
                      </th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60 font-medium text-slate-800 dark:text-zinc-200">
                    {rekapData.summaries.map((s, idx) => {
                      const teacherHadirRecords = rawRecords.filter(r => r.teacherId === s.teacherId && (r.status === "Hadir Mengajar" || r.status === "Terlambat"));
                      const teacherMenggantikanRecords = rawRecords.filter(r => (r.substituteTeacherId === s.teacherId || r.exchangedWithTeacherId === s.teacherId) && r.teacherId !== s.teacherId);
                      const teacherDigantikanRecords = rawRecords.filter(r => r.teacherId === s.teacherId && (r.status === "Digantikan Guru Lain" || r.status === "Tukar Jadwal"));
                      const teacherTidakHadirRecords = rawRecords.filter(r => r.teacherId === s.teacherId && (r.status === "Tidak Hadir" || r.status === "Izin" || r.status === "Sakit" || r.status === "Tugas Dinas" || r.status === "Belum Terkonfirmasi"));
                      const teacherTerlambatRecords = rawRecords.filter(r => r.teacherId === s.teacherId && r.status === "Terlambat");

                      return (
                        <tr key={s.teacherId || idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-zinc-100">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{s.teacherName}</span>
                              {s.menggantikanJP > 0 && (
                                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 rounded text-[10px] font-black" title="Guru Menggantikan">
                                  +{s.menggantikanJP} JP Pengganti
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 1. JML JP (Jadwal Asli Guru) */}
                          <td className="py-3.5 px-3 text-center font-black bg-slate-50/60 dark:bg-zinc-950/30 text-slate-900 dark:text-zinc-100">
                            {s.jmlJp} <span className="text-[10px] font-normal text-slate-400">JP</span>
                          </td>

                          {/* 2. Kehadiran (JP) */}
                          <td className="py-3.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => openDetailModal(`Kehadiran Mengajar: ${s.teacherName}`, "hadir_guru", teacherHadirRecords)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 rounded-lg font-black text-xs border border-emerald-200/80 dark:border-emerald-800 transition-all cursor-pointer inline-flex items-center gap-1"
                              title="Klik untuk melihat rincian sesi hadir"
                            >
                              <span>{s.hadirJP} JP</span>
                              <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">({s.hadir} sesi)</span>
                            </button>
                          </td>

                          {/* 3. Menggantikan (JP) */}
                          <td className="py-3.5 px-3 text-center">
                            {s.menggantikanJP > 0 ? (
                              <button
                                type="button"
                                onClick={() => openDetailModal(`Sesi Menggantikan Guru Lain: ${s.teacherName}`, "menggantikan_guru", teacherMenggantikanRecords)}
                                className="px-2 py-1 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-300 rounded-lg font-black text-xs border border-purple-200/80 dark:border-purple-800 transition-all cursor-pointer inline-flex items-center gap-1"
                                title="Klik untuk melihat rincian sesi menggantikan guru lain"
                              >
                                <span>{s.menggantikanJP} JP</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-600 font-semibold">-</span>
                            )}
                          </td>

                          {/* 4. Digantikan (JP) */}
                          <td className="py-3.5 px-3 text-center">
                            {s.digantikanJP > 0 ? (
                              <button
                                type="button"
                                onClick={() => openDetailModal(`Sesi Digantikan Guru Pengganti: ${s.teacherName}`, "digantikan_guru", teacherDigantikanRecords)}
                                className="px-2 py-1 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 rounded-lg font-black text-xs border border-orange-200/80 dark:border-orange-800 transition-all cursor-pointer inline-flex items-center gap-1"
                                title="Klik untuk melihat rincian sesi digantikan oleh guru lain"
                              >
                                <span>{s.digantikanJP} JP</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-600 font-semibold">-</span>
                            )}
                          </td>

                          {/* 5. Tidak Hadir (JP) */}
                          <td className="py-3.5 px-3 text-center">
                            {s.tidakHadirJP > 0 ? (
                              <button
                                type="button"
                                onClick={() => openDetailModal(`Ketidakhadiran: ${s.teacherName}`, "tidakhadir_guru", teacherTidakHadirRecords)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 rounded-lg font-black text-xs border border-rose-200/80 dark:border-rose-800 transition-all cursor-pointer inline-flex items-center gap-1"
                                title="Klik untuk melihat rincian ketidakhadiran (Izin, Sakit, Alpa, Tugas)"
                              >
                                <span>{s.tidakHadirJP} JP</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-600 font-semibold">-</span>
                            )}
                          </td>

                          {/* 6. Terlambat (JP) */}
                          <td className="py-3.5 px-3 text-center">
                            {s.terlambatJP > 0 ? (
                              <button
                                type="button"
                                onClick={() => openDetailModal(`Sesi Terlambat: ${s.teacherName}`, "terlambat_guru", teacherTerlambatRecords)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 rounded-lg font-bold text-xs border border-amber-200/80 dark:border-amber-800 transition-all cursor-pointer inline-flex items-center gap-1"
                                title="Informasi keterlambatan (sudah termasuk dalam Kehadiran)"
                              >
                                <span>{s.terlambatJP} JP</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-600 font-semibold">-</span>
                            )}
                          </td>

                          {/* 7. Total JP (Kehadiran + Menggantikan) */}
                          <td className="py-3.5 px-3 text-center font-black bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm">
                            {s.totalJP} <span className="text-[10px] font-normal text-slate-400">JP</span>
                          </td>

                          {/* 8. % Kehadiran */}
                          <td className="py-3.5 px-3 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                              (s.kehadiranPercentage ?? s.percentage) >= 90
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : (s.kehadiranPercentage ?? s.percentage) >= 75
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                            }`}>
                              {s.kehadiranPercentage ?? s.percentage}%
                            </span>
                          </td>

                          {/* 9. Audit Balance */}
                          <td className="py-3.5 px-3 text-center">
                            {s.isBalanced ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center gap-1 w-fit mx-auto" title="Neraca JP Seimbang: JML JP = Kehadiran + Digantikan + Tidak Hadir">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Valid
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center justify-center gap-1 w-fit mx-auto" title="Neraca Belum Seimbang">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Selisih
                              </span>
                            )}
                          </td>

                          {/* 10. Aksi */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setDetailTeacher({ id: s.teacherId, name: s.teacherName })}
                              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-all border border-blue-200/60 dark:border-blue-900/40 flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              Riwayat
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

        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ABSENSI HARIAN GURU HALAQAH QUR'AN                 */}
      {/* ========================================================= */}
      {activeTab === "absensi_halaqah" && (
        <HalaqahDailyAttendanceSection
          selectedAyId={selectedAyId}
          selectedSemesterId={selectedSemesterId}
        />
      )}

      {/* ========================================================= */}
      {/* TAB 5: REKAP ABSENSI GURU HALAQAH QUR'AN                   */}
      {/* ========================================================= */}
      {activeTab === "rekap_halaqah" && (
        <HalaqahAttendanceRecapSection
          selectedAyId={selectedAyId}
          selectedSemesterId={selectedSemesterId}
          academicYears={academicYears}
          semesters={semesters}
        />
      )}

      {/* MODAL RINCIAN EXCEPTION (ACTIONABLE CARD DETAIL POPUP) */}
      {cardDetailModal && cardDetailModal.isOpen && (
        <Dialog
          isOpen={cardDetailModal.isOpen}
          onClose={() => setCardDetailModal(null)}
          title={cardDetailModal.title}
          size="lg"
        >
          <div className="space-y-4 max-h-[78vh] overflow-y-auto pr-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-800/80 p-3 rounded-2xl border border-slate-200 dark:border-zinc-700">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama guru, mapel, kelas, atau catatan..."
                  value={cardModalSearch}
                  onChange={(e) => setCardModalSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-100"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                  Total: <strong className="text-blue-600">{filteredModalRecords.length} Sesi</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleExportModalExcel(cardDetailModal.title, filteredModalRecords)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Export Excel
                </button>
              </div>
            </div>

            {filteredModalRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                Tidak ada data sesi ditemukan untuk kategori ini.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Tanggal & Hari</th>
                      <th className="py-2.5 px-3">Nama Guru</th>
                      <th className="py-2.5 px-3">Mata Pelajaran</th>
                      <th className="py-2.5 px-3">Kelas</th>
                      <th className="py-2.5 px-3">JP / Jam</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Pengganti / Penukar</th>
                      <th className="py-2.5 px-3">Alasan / Catatan</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-zinc-800 font-medium text-slate-800 dark:text-zinc-200">
                    {filteredModalRecords.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-zinc-100">{r.date}</div>
                          <div className="text-[10px] text-slate-500">{r.day}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-zinc-100">{r.teacherName}</td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-zinc-200">{r.subjectName}</td>
                        <td className="py-2.5 px-3 font-semibold">{r.className}</td>
                        <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">
                          {r.jp} {r.timeSlot ? `(${r.timeSlot})` : ""}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            r.status === "Hadir Mengajar" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                            r.status === "Terlambat" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                            r.status === "Belum Terkonfirmasi" ? "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-950 dark:text-orange-300" :
                            r.status === "Tidak Hadir" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" :
                            r.status === "Izin" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" :
                            r.status === "Sakit" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                            r.status === "Digantikan Guru Lain" ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300" :
                            r.status === "Tukar Jadwal" ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300" :
                            r.status === "Tugas Dinas" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                            "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {r.substituteTeacherName ? (
                            <span className="font-bold text-orange-700 dark:text-orange-300 flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 text-orange-500" />
                              {r.substituteTeacherName}
                            </span>
                          ) : r.exchangedWithTeacherName ? (
                            <span className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                              <ArrowRightLeft className="w-3 h-3 text-purple-500" />
                              {r.exchangedWithTeacherName}
                            </span>
                          ) : r.status === "Digantikan Guru Lain" ? (
                            <span className="text-rose-600 dark:text-rose-400 font-extrabold italic animate-pulse">
                              ⚠️ Belum Ditentukan
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">
                          {r.notes || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isWakakurOrAdmin && r.checkInTime && !r.checkOutTime && (
                              <button
                                type="button"
                                onClick={() => {
                                  setManualCheckOutModal({
                                    isOpen: true,
                                    item: r,
                                    checkOutTime: "08:15",
                                    reason: ""
                                  });
                                }}
                                className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-200 rounded-lg text-[11px] font-bold transition-all border border-amber-200/60 cursor-pointer"
                                title="Check Out Manual"
                              >
                                Check-Out Manual
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDate(r.date);
                                setActiveTab("input");
                                setCardDetailModal(null);
                              }}
                              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-bold transition-all border border-blue-200/60 cursor-pointer"
                              title="Buka Halaman Input/Edit untuk Tanggal Ini"
                            >
                              Buka Sesi
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Detail History Modal */}
      {detailTeacher && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold">Riwayat Absensi Mengajar</h3>
                <p className="text-xs text-slate-300">Guru: <span className="font-semibold text-white">{detailTeacher.name}</span></p>
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setHistoryViewMode("timeline")}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      historyViewMode === "timeline" ? "bg-blue-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Timeline Kehadiran Per JP
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryViewMode("table")}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      historyViewMode === "table" ? "bg-blue-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    Tabel Sesi
                  </button>
                </div>

                <button
                  onClick={() => setDetailTeacher(null)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-slate-300" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingHistory ? (
                <div className="p-12 text-center">
                  <Loading />
                </div>
              ) : teacherHistory.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  Belum ada catatan riwayat absensi untuk guru ini.
                </div>
              ) : historyViewMode === "timeline" ? (
                <TeacherAttendanceTimeline history={teacherHistory} teacherName={detailTeacher.name} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Hari</th>
                        <th className="py-2.5 px-3">Mata Pelajaran</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">JP</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Catatan / Pengganti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 dark:divide-zinc-800/60">
                      {teacherHistory.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-zinc-200">{item.date}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-300">{item.day}</td>
                          <td className="py-2.5 px-3 font-semibold">{item.subjectName}</td>
                          <td className="py-2.5 px-3">{item.className}</td>
                          <td className="py-2.5 px-3 font-bold">{item.jp}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              item.status === "Hadir Mengajar"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.status === "Belum Terkonfirmasi"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                                : item.status === "Terlambat"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : item.status === "Digantikan Guru Lain"
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400">
                            {item.substituteTeacherName ? `Pengganti: ${item.substituteTeacherName}` : item.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-950 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setDetailTeacher(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-800 dark:text-zinc-100 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditModal && (
        <Dialog
          isOpen={showAuditModal}
          onClose={() => setShowAuditModal(false)}
          title="Audit Log Perbaikan & Susulan Absensi Mengajar"
          size="lg"
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Menampilkan seluruh rekam jejak audit log perubahan status absensi mengajar, perbaikan data, dan input susulan oleh Wakakur/Admin.
            </p>

            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                Belum ada rekam jejak audit log perbaikan absensi.
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200/80 dark:border-zinc-700 space-y-2 text-xs shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between text-[11px] font-bold text-slate-700 dark:text-zinc-300 border-b border-slate-200/60 dark:border-zinc-700/60 pb-2 gap-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span>Tgl Mengajar: {log.attendanceDate}</span>
                      </div>
                      <span className="text-slate-400 font-normal text-[10px]">
                        {new Date(log.inputTimestamp).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <div className="font-extrabold text-slate-900 dark:text-zinc-100">
                        {log.teacherName} — {log.subjectName} ({log.className})
                      </div>
                      <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded text-[10px] font-bold w-fit">
                        JP {log.jp}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] pt-0.5">
                      <span className="px-2.5 py-1 bg-slate-200 dark:bg-zinc-700 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold">
                        {log.previousStatus || "Belum Diisi"}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 rounded-lg font-bold">
                        {log.newStatus}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                      <span>Petugas: <strong className="text-slate-700 dark:text-zinc-200">{log.userName}</strong></span>
                      <span className="italic">Catatan/Alasan: {log.reason || "Input Susulan / Perbaikan"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Tukar Jadwal Modal */}
      {showExchangeModal && (
        <Dialog
          isOpen={showExchangeModal}
          onClose={() => setShowExchangeModal(false)}
          title="Tukar Jadwal Mengajar (Per Sesi)"
          size="lg"
        >
          <div className="space-y-4">
            {/* Modal Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2">
              <button
                type="button"
                onClick={() => setExchangeModalSubTab("create")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  exchangeModalSubTab === "create"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200"
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                Buat Pertukaran Baru
              </button>
              <button
                type="button"
                onClick={() => setExchangeModalSubTab("list")}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  exchangeModalSubTab === "list"
                    ? "bg-amber-500 text-slate-950 shadow-xs"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200"
                }`}
              >
                <History className="w-4 h-4" />
                Daftar & Kelola Tukar Jadwal ({scheduleExchangesList.length})
              </button>
            </div>

            {exchangeModalSubTab === "create" && (
              <>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Wakakur dapat memproses pertukaran jadwal mengajar antara dua guru atau menugaskan Sesi/JP kepada guru penukar tanpa mengubah struktur jadwal tetap sekolah.
                </p>

                <div className="space-y-3 bg-slate-50 dark:bg-zinc-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-700">
                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 block uppercase tracking-wider">
                    1. Pilih Sesi Mengajar Utama (Sesi A) - Tanggal {selectedDate}:
                  </label>
                  <select
                    value={exchangeScheduleAId}
                    onChange={(e) => setExchangeScheduleAId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Pilih Sesi Mengajar yang Akan Ditukar --</option>
                    {localAttendanceItems.map((item) => (
                      <option key={item.scheduleId} value={item.scheduleId}>
                        {item.teacherName} — {item.subjectName} ({item.className}) [{item.jp?.toUpperCase().startsWith("JP") ? item.jp : `JP ${item.jp}`}]
                      </option>
                    ))}
                  </select>

                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 block uppercase tracking-wider pt-2">
                    2. Pilih Guru Penukar (Guru B):
                  </label>
                  <select
                    value={exchangeTeacherBId}
                    onChange={(e) => setExchangeTeacherBId(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Pilih Guru Penukar --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.nip || "Guru"})
                      </option>
                    ))}
                  </select>

                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 block uppercase tracking-wider pt-2">
                    3. Pilih Tanggal Sesi Guru B (Dilain Hari atau Sama Hari):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={exchangeDateB}
                      onChange={(e) => setExchangeDateB(e.target.value)}
                      className="px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setExchangeDateB(selectedDate)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        exchangeDateB === selectedDate
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-300"
                      }`}
                    >
                      Sama Hari ({selectedDate})
                    </button>
                  </div>

                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 block uppercase tracking-wider pt-2">
                    4. Pilih Sesi Guru B yang Ditukar (Tanggal {exchangeDateB}):
                  </label>
                  <select
                    value={exchangeScheduleBId}
                    onChange={(e) => setExchangeScheduleBId(e.target.value)}
                    disabled={isLoadingScheduleB || !exchangeTeacherBId}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                  >
                    <option value="">-- Tanpa Sesi Pengganti Sisi B (Penugasan Langsung Sesi A Saja) --</option>
                    {exchangeScheduleBItems.map((item) => (
                      <option key={item.scheduleId} value={item.scheduleId}>
                        {item.teacherName} — {item.subjectName} ({item.className}) [{item.jp?.toUpperCase().startsWith("JP") ? item.jp : `JP ${item.jp}`}]
                      </option>
                    ))}
                  </select>
                  {isLoadingScheduleB && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Memuat jadwal Guru B pada tanggal {exchangeDateB}...</p>
                  )}
                  {!isLoadingScheduleB && exchangeTeacherBId && exchangeScheduleBItems.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">
                      Guru B tidak memiliki jadwal mengajar terdaftar pada tanggal {exchangeDateB}. Guru B hanya mengambil alih JP Sesi A.
                    </p>
                  )}

                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-200 block uppercase tracking-wider pt-2">
                    5. Alasan / Catatan Pertukaran Sesi:
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Saling tukar JP 2 dan JP 5 karena keperluan dinas..."
                    value={exchangeReason}
                    onChange={(e) => setExchangeReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowExchangeModal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => saveExchangeMutation.mutate()}
                    disabled={saveExchangeMutation.isPending || !exchangeScheduleAId || !exchangeTeacherBId}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {saveExchangeMutation.isPending ? "Memproses..." : "Proses Tukar Jadwal"}
                  </button>
                </div>
              </>
            )}

            {exchangeModalSubTab === "list" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama guru, mata pelajaran, kelas, atau tanggal..."
                      value={exchangeSearchQuery}
                      onChange={(e) => setExchangeSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {isLoadingExchanges ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                    Memuat daftar tukar jadwal...
                  </div>
                ) : filteredScheduleExchanges.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 dark:bg-zinc-900/60 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <p className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Belum ada riwayat pertukaran jadwal yang tercatat.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Gunakan tab "Buat Pertukaran Baru" untuk memproses tukar jadwal.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {filteredScheduleExchanges.map((ex) => (
                      <div
                        key={ex.id}
                        className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 space-y-2.5 hover:border-amber-400/50 transition-all"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[10px] font-bold rounded-lg border border-amber-300/60 dark:border-amber-800/60">
                              Tgl A: {ex.date}
                            </span>
                            {ex.dateB && ex.dateB !== ex.date && (
                              <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 text-[10px] font-bold rounded-lg border border-blue-300/60 dark:border-blue-800/60">
                                Tgl B: {ex.dateB}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isWakakurOrAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExchangeId(ex.id!);
                                    setEditingExchangeReason(ex.reason || "");
                                  }}
                                  className="px-2.5 py-1 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-100 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Edit alasan pertukaran"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit Alasan
                                </button>
                                <button
                                  type="button"
                                  disabled={deleteExchangeMutation.isPending}
                                  onClick={() => {
                                    if (confirm(`Batalkan tukar jadwal ini? Status kedua jadwal (${ex.teacherAName} & ${ex.teacherBName}) akan otomatis dikembalikan ke status semula.`)) {
                                      deleteExchangeMutation.mutate(ex.id!);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  title="Batalkan & Kembalikan ke jadwal semula"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Kembalikan Semula
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Exchange Teacher Mapping details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs">
                          <div className="space-y-0.5 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-800 pb-1.5 md:pb-0 md:pr-2">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block uppercase">Guru Sesi A (Pemrakarsa):</span>
                            <p className="font-bold text-slate-900 dark:text-zinc-100">{ex.teacherAName}</p>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">{ex.subjectAName} ({ex.classAName}) • JP {ex.jpA}</p>
                          </div>
                          <div className="space-y-0.5 md:pl-2 pt-1 md:pt-0">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Guru Sesi B (Penukar):</span>
                            <p className="font-bold text-slate-900 dark:text-zinc-100">{ex.teacherBName}</p>
                            {ex.subjectBName ? (
                              <p className="text-[11px] text-slate-500 dark:text-zinc-400">{ex.subjectBName} ({ex.classBName}) • JP {ex.jpB}</p>
                            ) : (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 italic">Mengambil alih Sesi A tanpa penukaran JP Sesi B</p>
                            )}
                          </div>
                        </div>

                        {/* Reason / Note display or Edit form */}
                        {editingExchangeId === ex.id ? (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={editingExchangeReason}
                              onChange={(e) => setEditingExchangeReason(e.target.value)}
                              className="flex-1 px-3 py-1.5 bg-white dark:bg-zinc-900 border border-amber-400 rounded-xl text-xs text-slate-800 dark:text-zinc-100"
                              placeholder="Masukkan alasan baru..."
                            />
                            <button
                              type="button"
                              onClick={() => updateExchangeMutation.mutate({ exchangeId: ex.id!, reason: editingExchangeReason })}
                              disabled={updateExchangeMutation.isPending}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingExchangeId(null)}
                              className="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 pt-0.5">
                            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Alasan: <strong className="font-semibold text-slate-800 dark:text-zinc-200">{ex.reason}</strong></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}

      {/* Manual Check Out Dialog for Wakakur */}
      {manualCheckOutModal.isOpen && (
        <Dialog
          isOpen={manualCheckOutModal.isOpen}
          onClose={() => setManualCheckOutModal({ isOpen: false, checkOutTime: "08:15", reason: "" })}
          title="Konfirmasi Check Out Manual (Wakakur)"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-indigo-900 dark:text-indigo-200">
                {manualCheckOutModal.item?.teacherName}
              </div>
              <div className="text-slate-600 dark:text-zinc-300">
                {manualCheckOutModal.item?.subjectName} — Kelas {manualCheckOutModal.item?.className} ({manualCheckOutModal.item?.jp})
              </div>
              <div className="text-slate-500 dark:text-zinc-400 font-mono text-[11px]">
                Waktu Check-In: {manualCheckOutModal.item?.checkInTime || "-"}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Waktu Check-Out Manual (HH:MM)
              </label>
              <input
                type="text"
                value={manualCheckOutModal.checkOutTime}
                onChange={(e) => setManualCheckOutModal(prev => ({ ...prev, checkOutTime: e.target.value }))}
                placeholder="08:15"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Alasan / Catatan Wakakur
              </label>
              <textarea
                value={manualCheckOutModal.reason}
                onChange={(e) => setManualCheckOutModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Misal: Guru lupa scan out karena langsung ada rapat guru"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 min-h-[70px]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setManualCheckOutModal({ isOpen: false, checkOutTime: "08:15", reason: "" })}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleManualCheckOutSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
              >
                Simpan Check Out Manual
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Validasi Check-In Terlambat / Unlock Late Modal (Wakakur) */}
      {unlockLateModalItem && (
        <Dialog
          isOpen={!!unlockLateModalItem}
          onClose={() => { setUnlockLateModalItem(null); setUnlockLateReason(""); }}
          title="Validasi Check-in Terlambat (Wakakur)"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                {unlockLateModalItem.teacherName}
              </div>
              <div className="text-slate-600 dark:text-zinc-300">
                {unlockLateModalItem.subjectName} — Kelas {unlockLateModalItem.className} ({unlockLateModalItem.jp})
              </div>
              <div className="text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                Sesi ini terkunci karena batas waktu Check-in (25 menit) terlampaui. Membuka kunci akan mengizinkan guru melakukan scan QR Check-in.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Alasan / Catatan Validasi Wakakur
              </label>
              <textarea
                value={unlockLateReason}
                onChange={(e) => setUnlockLateReason(e.target.value)}
                placeholder="Misal: Penugasan rapat guru / izin dinas luar dari Waka Kurikulum"
                className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 min-h-[80px]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => { setUnlockLateModalItem(null); setUnlockLateReason(""); }}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!unlockLateReason.trim() || unlockLateMutation.isPending}
                onClick={() => {
                  unlockLateMutation.mutate({
                    scheduleId: unlockLateModalItem.scheduleId,
                    dateStr: unlockLateModalItem.dateStr,
                    reason: unlockLateReason
                  });
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {unlockLateMutation.isPending ? "Memproses..." : "Buka Kunci & Validasi"}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Class QR Cards Printable Modal */}
      <ClassQrCardsModal
        isOpen={isClassQrModalOpen}
        onClose={() => setIsClassQrModalOpen(false)}
      />
    </div>
  );
};

export default TeacherTeachingAttendancePage;
