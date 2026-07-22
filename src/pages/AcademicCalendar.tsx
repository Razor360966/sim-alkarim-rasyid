import React, { useState, useEffect, useRef } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { academicYearService } from "../services/academicYearService";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { Semester, AcademicYear, AcademicReference, AcademicCalendarDay, AcademicEvent, Teacher } from "../types";
import { teacherService } from "../services/teacherService";
import { classService } from "../services/classService";
import ExcelJS from "exceljs";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { exportAcademicCalendarExcel } from "../utils/excel/calendar.export";
import { 
  Calendar, 
  List, 
  Grid,
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  FileSpreadsheet, 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Edit, 
  Info, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  X,
  XCircle,
  Search,
  Filter,
  Save,
  Check,
  Palette
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

const indonesianMonths = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const indonesianDays = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

interface SyncedHoliday {
  date: string;
  title: string;
  categoryCode: "EVENT_LIBUR" | "EVENT_KEGIATAN";
  statusCode: "STATUS_TIDAK_EFEKTIF" | "STATUS_EFEKTIF";
  description: string;
  isEffectiveDay: boolean;
}

export const getIndonesianHolidaysAndBigDays = (year: number): SyncedHoliday[] => {
  const list: SyncedHoliday[] = [
    {
      date: `${year}-01-01`,
      title: "Tahun Baru Masehi",
      categoryCode: "EVENT_LIBUR",
      statusCode: "STATUS_TIDAK_EFEKTIF",
      description: "Libur Nasional Tahun Baru Masehi",
      isEffectiveDay: false
    },
    {
      date: `${year}-01-03`,
      title: "Hari Amal Bakti Kemenag RI",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Amal Bakti (HAB) Kementerian Agama RI - Hari Pembelajaran",
      isEffectiveDay: true
    },
    {
      date: `${year}-05-02`,
      title: "Hari Pendidikan Nasional (Hardiknas)",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Pendidikan Nasional - Kegiatan Sekolah",
      isEffectiveDay: true
    },
    {
      date: `${year}-05-20`,
      title: "Hari Kebangkitan Nasional (Harkitnas)",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Kebangkitan Nasional - Kegiatan Sekolah",
      isEffectiveDay: true
    },
    {
      date: `${year}-06-01`,
      title: "Hari Lahir Pancasila",
      categoryCode: "EVENT_LIBUR",
      statusCode: "STATUS_TIDAK_EFEKTIF",
      description: "Libur Nasional Hari Lahir Pancasila",
      isEffectiveDay: false
    },
    {
      date: `${year}-08-17`,
      title: "Hari Kemerdekaan RI",
      categoryCode: "EVENT_LIBUR",
      statusCode: "STATUS_TIDAK_EFEKTIF",
      description: "Libur Nasional Hari Kemerdekaan Republik Indonesia",
      isEffectiveDay: false
    },
    {
      date: `${year}-10-01`,
      title: "Hari Kesaktian Pancasila",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Kesaktian Pancasila - Kegiatan Upacara Sekolah",
      isEffectiveDay: true
    },
    {
      date: `${year}-10-22`,
      title: "Hari Santri Nasional",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Santri Nasional - Upacara dan Apel Hari Santri",
      isEffectiveDay: true
    },
    {
      date: `${year}-10-28`,
      title: "Hari Sumpah Pemuda",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Sumpah Pemuda - Kegiatan Sekolah",
      isEffectiveDay: true
    },
    {
      date: `${year}-11-10`,
      title: "Hari Pahlawan",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Pahlawan - Upacara dan Kegiatan Kepahlawanan",
      isEffectiveDay: true
    },
    {
      date: `${year}-11-25`,
      title: "Hari Guru Nasional (HGN)",
      categoryCode: "EVENT_KEGIATAN",
      statusCode: "STATUS_EFEKTIF",
      description: "Hari Guru Nasional / HUT PGRI - Apel Penghormatan Guru",
      isEffectiveDay: true
    },
    {
      date: `${year}-12-25`,
      title: "Hari Raya Natal",
      categoryCode: "EVENT_LIBUR",
      statusCode: "STATUS_TIDAK_EFEKTIF",
      description: "Libur Nasional Hari Raya Natal",
      isEffectiveDay: false
    }
  ];

  const movable: { [yr: number]: { date: string; title: string; isLibur: boolean }[] } = {
    2024: [
      { date: "2024-02-08", title: "Isra Mikraj Nabi Muhammad SAW", isLibur: true },
      { date: "2024-02-10", title: "Tahun Baru Imlek 2575 Kongzili", isLibur: true },
      { date: "2024-03-11", title: "Hari Suci Nyepi Saka 1946", isLibur: true },
      { date: "2024-03-29", title: "Wafat Yesus Kristus", isLibur: true },
      { date: "2024-04-10", title: "Hari Raya Idul Fitri 1445 H", isLibur: true },
      { date: "2024-04-11", title: "Hari Raya Idul Fitri 1445 H", isLibur: true },
      { date: "2024-05-01", title: "Hari Buruh Internasional", isLibur: true },
      { date: "2024-05-09", title: "Kenaikan Yesus Kristus", isLibur: true },
      { date: "2024-05-23", title: "Hari Raya Waisak 2568 BE", isLibur: true },
      { date: "2024-06-17", title: "Hari Raya Idul Adha 1445 H", isLibur: true },
      { date: "2024-07-07", title: "Tahun Baru Islam 1446 H", isLibur: true },
      { date: "2024-09-16", title: "Maulid Nabi Muhammad SAW", isLibur: true }
    ],
    2025: [
      { date: "2025-01-27", title: "Isra Mikraj Nabi Muhammad SAW", isLibur: true },
      { date: "2025-01-29", title: "Tahun Baru Imlek 2576 Kongzili", isLibur: true },
      { date: "2025-03-20", title: "Hari Raya Idul Fitri 1446 H", isLibur: true },
      { date: "2025-03-21", title: "Hari Raya Idul Fitri 1446 H", isLibur: true },
      { date: "2025-03-29", title: "Hari Suci Nyepi Saka 1947", isLibur: true },
      { date: "2025-04-18", title: "Wafat Yesus Kristus", isLibur: true },
      { date: "2025-05-01", title: "Hari Buruh Internasional", isLibur: true },
      { date: "2025-05-12", title: "Hari Raya Waisak 2569 BE", isLibur: true },
      { date: "2025-05-29", title: "Kenaikan Yesus Kristus", isLibur: true },
      { date: "2025-06-06", title: "Hari Raya Idul Adha 1446 H", isLibur: true },
      { date: "2025-06-27", title: "Tahun Baru Islam 1447 H", isLibur: true },
      { date: "2025-09-05", title: "Maulid Nabi Muhammad SAW", isLibur: true }
    ],
    2026: [
      { date: "2026-02-15", title: "Isra Mikraj Nabi Muhammad SAW", isLibur: true },
      { date: "2026-02-17", title: "Tahun Baru Imlek 2577 Kongzili", isLibur: true },
      { date: "2026-03-19", title: "Hari Suci Nyepi Saka 1948", isLibur: true },
      { date: "2026-03-20", title: "Hari Raya Idul Fitri 1447 H", isLibur: true },
      { date: "2026-03-21", title: "Hari Raya Idul Fitri 1447 H", isLibur: true },
      { date: "2026-04-03", title: "Wafat Yesus Kristus", isLibur: true },
      { date: "2026-05-01", title: "Hari Buruh Internasional", isLibur: true },
      { date: "2026-05-14", title: "Kenaikan Yesus Kristus", isLibur: true },
      { date: "2026-05-27", title: "Hari Raya Idul Adha 1447 H", isLibur: true },
      { date: "2026-06-01", title: "Hari Raya Waisak 2570 BE", isLibur: true },
      { date: "2026-06-17", title: "Tahun Baru Islam 1448 H", isLibur: true },
      { date: "2026-08-26", title: "Maulid Nabi Muhammad SAW", isLibur: true }
    ],
    2027: [
      { date: "2027-02-05", title: "Isra Mikraj Nabi Muhammad SAW", isLibur: true },
      { date: "2027-02-06", title: "Tahun Baru Imlek 2578 Kongzili", isLibur: true },
      { date: "2027-03-08", title: "Hari Suci Nyepi Saka 1949", isLibur: true },
      { date: "2027-03-10", title: "Hari Raya Idul Fitri 1448 H", isLibur: true },
      { date: "2027-03-11", title: "Hari Raya Idul Fitri 1448 H", isLibur: true },
      { date: "2027-03-26", title: "Wafat Yesus Kristus", isLibur: true },
      { date: "2027-05-01", title: "Hari Buruh Internasional", isLibur: true },
      { date: "2027-05-06", title: "Kenaikan Yesus Kristus", isLibur: true },
      { date: "2027-05-16", title: "Hari Raya Idul Adha 1448 H", isLibur: true },
      { date: "2027-05-20", title: "Hari Raya Waisak 2571 BE", isLibur: true },
      { date: "2027-06-06", title: "Tahun Baru Islam 1449 H", isLibur: true },
      { date: "2027-08-15", title: "Maulid Nabi Muhammad SAW", isLibur: true }
    ],
    2028: [
      { date: "2028-01-25", title: "Isra Mikraj Nabi Muhammad SAW", isLibur: true },
      { date: "2028-01-26", title: "Tahun Baru Imlek 2579 Kongzili", isLibur: true },
      { date: "2028-02-27", title: "Hari Raya Idul Fitri 1449 H", isLibur: true },
      { date: "2028-02-28", title: "Hari Raya Idul Fitri 1449 H", isLibur: true },
      { date: "2028-03-26", title: "Hari Suci Nyepi Saka 1950", isLibur: true },
      { date: "2028-04-14", title: "Wafat Yesus Kristus", isLibur: true },
      { date: "2028-05-01", title: "Hari Buruh Internasional", isLibur: true },
      { date: "2028-05-04", title: "Hari Raya Idul Adha 1449 H", isLibur: true },
      { date: "2028-05-08", title: "Hari Raya Waisak 2572 BE", isLibur: true },
      { date: "2028-05-25", title: "Kenaikan Yesus Kristus", isLibur: true },
      { date: "2028-05-25", title: "Tahun Baru Islam 1450 H", isLibur: true },
      { date: "2028-08-03", title: "Maulid Nabi Muhammad SAW", isLibur: true }
    ]
  };

  const movableList = movable[year] || [];
  movableList.forEach((m) => {
    list.push({
      date: m.date,
      title: m.title,
      categoryCode: m.isLibur ? "EVENT_LIBUR" : "EVENT_KEGIATAN",
      statusCode: m.isLibur ? "STATUS_TIDAK_EFEKTIF" : "STATUS_EFEKTIF",
      description: m.isLibur ? `Libur Nasional ${m.title}` : `Hari Besar ${m.title}`,
      isEffectiveDay: !m.isLibur
    });
  });

  return list;
};

export const AcademicCalendar: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const canEditCalendar = user?.role === "admin" || 
                         user?.role === "wakil kepala sekolah" || 
                         user?.role?.toLowerCase().includes("wakil") || 
                         user?.role?.toLowerCase().includes("kurikulum");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active Days configuration state
  const [activeDays, setActiveDays] = useState<string[]>(["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"]);
  const [isSemesterRangeModalOpen, setIsSemesterRangeModalOpen] = useState(false);
  const [semesterRangeForm, setSemesterRangeForm] = useState({ startDate: "", endDate: "" });
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);

  // Semesters & Years
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [weeksConfigSemesterId, setWeeksConfigSemesterId] = useState<string>("");
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [references, setReferences] = useState<AcademicReference[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [gradeLevels, setGradeLevels] = useState<string[]>(["VII", "VIII", "IX"]);
  
  // Current calendar day state
  const [calendarDays, setCalendarDays] = useState<AcademicCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual weeks configuration state
  const [weeksConfig, setWeeksConfig] = useState<{
    month: string;
    totalWeeks: number;
    effectiveWeeks: number;
    effectiveWeeksByGrade?: Record<string, number>;
    notes?: string;
  }[]>([]);
  const [isWeeksConfigLoading, setIsWeeksConfigLoading] = useState(false);

  // View mode: 'calendar' (Month View), 'year' (Year View), 'list' (List View)
  const [viewMode, setViewMode] = useState<'calendar' | 'year' | 'list'>('calendar');

  // Category Colors
  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("academic_calendar_colors");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      "Libur Nasional": "#ef4444", // Merah
      "Libur Semester": "#3b82f6", // Biru
      "PTS": "#eab308", // Kuning
      "PAS": "#f97316", // Oranye
      "MPLS": "#22c55e", // Hijau
      "Hari Besar Islam": "#a855f7", // Ungu
      "KBM / Kegiatan": "#64748b" // Default Slate
    };
  });

  const getEventColorCode = (evt: AcademicEvent): string => {
    const title = (evt.title || "").toLowerCase();
    const category = (evt.categoryName || "").toLowerCase();
    
    if (title.includes("libur nasional") || category.includes("libur nasional") || evt.categoryId === "EVENT_LIBUR_NASIONAL") {
      return categoryColors["Libur Nasional"] || "#ef4444";
    }
    if (title.includes("libur semester") || (title.includes("semester") && title.includes("libur")) || category.includes("libur semester")) {
      return categoryColors["Libur Semester"] || "#3b82f6";
    }
    if (title.includes("pts") || title.includes("tengah semester")) {
      return categoryColors["PTS"] || "#eab308";
    }
    if (title.includes("pas") || title.includes("pat") || title.includes("akhir semester") || title.includes("ujian akhir")) {
      return categoryColors["PAS"] || "#f97316";
    }
    if (title.includes("mpls") || title.includes("fortasi") || title.includes("pengenalan lingkungan")) {
      return categoryColors["MPLS"] || "#22c55e";
    }
    if (title.includes("hari besar islam") || title.includes("maulid") || title.includes("isra") || title.includes("idul fitri") || title.includes("idul adha") || title.includes("tahun baru islam")) {
      return categoryColors["Hari Besar Islam"] || "#a855f7";
    }
    return categoryColors["KBM / Kegiatan"] || "#64748b";
  };

  // Month navigation (for Month/Calendar View)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Event modal state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState<string>("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Custom delete confirmation modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    eventId: string | null;
  }>({
    isOpen: false,
    eventId: null
  });
  
  // Search and Filter (for List View)
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Event form fields
  const [eventForm, setEventForm] = useState<Omit<AcademicEvent, "id" | "createdAt">>({
    title: "",
    categoryId: "",
    statusId: "",
    description: "",
    priority: "Sedang",
    isEffectiveDay: true,
    reduceLesson: false,
    specialLessonDuration: 40,
    affectsAcademicPlanning: true,
    affectsScheduler: true,
    isRange: false,
    startDate: "",
    endDate: ""
  });

  // Load basic data
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [sems, refs, settings, tchs, clss] = await Promise.all([
        semesterService.getSemesters(),
        academicPlanningService.getReferences(),
        schoolSettingsService.getSettings(),
        teacherService.getTeachers().catch(() => []),
        classService.getClasses().catch(() => [])
      ]);
      setSemesters(sems);
      setReferences(refs);
      setTeachers(tchs);
      
      const uniqueGrades = Array.from(new Set(clss.map((c: any) => c.gradeLevel).filter(Boolean)));
      const sortedGrades = uniqueGrades.length > 0 ? uniqueGrades.sort() : ["VII", "VIII", "IX"];
      setGradeLevels(sortedGrades);

      if (settings?.activeDays) {
        setActiveDays(settings.activeDays);
      }

      // Find active semester
      const active = sems.find(s => s.isActive);
      if (active) {
        setActiveSemester(active);
        setSelectedSemesterId(active.id);
        setWeeksConfigSemesterId(active.id);
        setCurrentDate(new Date(active.startDate));
      } else if (sems.length > 0) {
        setSelectedSemesterId(sems[0].id);
        setWeeksConfigSemesterId(sems[0].id);
        setCurrentDate(new Date(sems[0].startDate));
      }

      // Pre-select default category/status for eventForm
      const firstCat = refs.find(r => r.category === "Kategori Event");
      const firstStatus = refs.find(r => r.category === "Status Hari");
      setEventForm(prev => ({
        ...prev,
        categoryId: firstCat ? firstCat.id : "",
        statusId: firstStatus ? firstStatus.id : ""
      }));
    } catch (error: any) {
      showToast("Gagal memuat data master: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const loadWeeksConfig = async (semesterObj: Semester) => {
    try {
      setIsWeeksConfigLoading(true);
      const analysis = await academicPlanningService.analyzeEffectiveWeeks(
        semesterObj.startDate,
        semesterObj.endDate,
        semesterObj.academicYearId,
        semesterObj.id
      );
      
      const processedDetails = (analysis.details || []).map((item: any) => {
        const gradeMap: Record<string, number> = { ...(item.effectiveWeeksByGrade || {}) };
        gradeLevels.forEach(grade => {
          if (gradeMap[grade] === undefined) {
            gradeMap[grade] = item.effectiveWeeks;
          }
        });
        return {
          ...item,
          effectiveWeeks: item.effectiveWeeks !== undefined ? item.effectiveWeeks : (gradeMap[gradeLevels[0]] || 0),
          effectiveWeeksByGrade: gradeMap
        };
      });
      setWeeksConfig(processedDetails);
    } catch (error: any) {
      console.error("Gagal memuat konfigurasi pekan:", error);
    } finally {
      setIsWeeksConfigLoading(false);
    }
  };

  const handleSaveWeeksConfig = async () => {
    const sem = semesters.find(s => s.id === weeksConfigSemesterId);
    if (!sem) return;
    try {
      setLoading(true);
      const totalWeeksSum = weeksConfig.reduce((sum, item) => sum + Number(item.totalWeeks), 0);
      const effectiveWeeksSum = weeksConfig.reduce((sum, item) => sum + Number(item.effectiveWeeks), 0);
      const ineffectiveWeeksSum = Math.max(0, totalWeeksSum - effectiveWeeksSum);

      await semesterService.updateManualWeeksConfig(
        sem.id,
        {
          manualWeeksConfigured: true,
          totalWeeks: totalWeeksSum,
          effectiveWeeks: effectiveWeeksSum,
          ineffectiveWeeks: ineffectiveWeeksSum,
          assessmentWeeks: sem.assessmentWeeks || 0,
          pasPatWeeks: sem.pasPatWeeks || 0,
          projectWeeks: sem.projectWeeks || 0,
          otherWeeks: sem.otherWeeks || 0,
          details: weeksConfig
        },
        user?.uid || "system",
        user?.displayName || "System"
      );

      showToast("Pengaturan pekan efektif berhasil disimpan!", "success");
      const updatedSems = await semesterService.getSemesters();
      setSemesters(updatedSems);
      const targetSem = updatedSems.find(s => s.id === weeksConfigSemesterId) || sem;
      if (targetSem) {
        await loadWeeksConfig(targetSem);
      }
    } catch (error: any) {
      showToast("Gagal menyimpan pengaturan pekan: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Reload calendar events when selectedSemesterId changes (loads full academic year events)
  useEffect(() => {
    if (selectedSemesterId) {
      const sem = semesters.find(s => s.id === selectedSemesterId);
      if (sem) {
        setLoading(true);
        academicPlanningService.getCalendarDays(sem.academicYearId)
          .then((days) => {
            setCalendarDays(days);
            setCurrentDate(new Date(sem.startDate));
            // Keep weeksConfigSemesterId aligned or initialize it
            setWeeksConfigSemesterId(prev => {
              const prevSem = semesters.find(s => s.id === prev);
              if (!prev || (prevSem && prevSem.academicYearId !== sem.academicYearId)) {
                return sem.id;
              }
              return prev;
            });
          })
          .catch((err) => showToast("Gagal memuat kalender: " + err.message, "error"))
          .finally(() => setLoading(false));
      }
    }
  }, [selectedSemesterId, semesters]);

  // Reload weeks config when weeksConfigSemesterId changes
  useEffect(() => {
    if (weeksConfigSemesterId) {
      const sem = semesters.find(s => s.id === weeksConfigSemesterId);
      if (sem) {
        loadWeeksConfig(sem);
      }
    }
  }, [weeksConfigSemesterId, semesters]);

  const handleUpdateActiveDays = async (newActiveDays: string[]) => {
    try {
      setLoading(true);
      const currentSettings = await schoolSettingsService.getSettings();
      await schoolSettingsService.updateSettings({
        ...currentSettings,
        activeDays: newActiveDays
      }, user?.uid || "system", user?.displayName || user?.name || "System");
      
      setActiveDays(newActiveDays);
      showToast("Hari aktif berhasil diperbarui!", "success");
    } catch (error: any) {
      showToast("Gagal memperbarui hari aktif: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncHolidays = async () => {
    if (!currentSemester) {
      showToast("Silakan pilih semester terlebih dahulu!", "error");
      return;
    }

    setIsSyncingHolidays(true);
    try {
      const start = new Date(currentSemester.startDate);
      const end = new Date(currentSemester.endDate);
      const startYear = start.getFullYear();
      const endYear = end.getFullYear();

      const yearsToSync = Array.from(new Set([startYear, endYear]));
      let allHolidays: any[] = [];
      yearsToSync.forEach(yr => {
        allHolidays = [...allHolidays, ...getIndonesianHolidaysAndBigDays(yr)];
      });

      // Filter to keep holidays within semester date range
      const semesterHolidays = allHolidays.filter(h => {
        const hDate = new Date(h.date);
        return hDate >= start && hDate <= end;
      });

      if (semesterHolidays.length === 0) {
        showToast("Tidak ada hari besar atau libur nasional pada rentang semester ini.", "info");
        setIsSyncingHolidays(false);
        return;
      }

      // Map of date string -> array of academic events
      const dayEventsMap = new Map<string, AcademicEvent[]>();
      calendarDays.forEach(day => {
        dayEventsMap.set(day.date, [...day.events]);
      });

      let syncedCount = 0;

      semesterHolidays.forEach(holiday => {
        const dateStr = holiday.date;
        const existingEvents = dayEventsMap.get(dateStr) || [];

        // Avoid duplicate syncing of the exact same event title
        const alreadyExists = existingEvents.some(e => e.title.toLowerCase() === holiday.title.toLowerCase());
        if (!alreadyExists) {
          const mappedCat = references.find(r => r.code === holiday.categoryCode) || eventCategories[0];
          const mappedStatus = references.find(r => r.code === holiday.statusCode) || dayStatuses[0];

          const newEvent: AcademicEvent = {
            id: `evt-sync-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title: holiday.title,
            categoryId: mappedCat?.id || "EVENT_LIBUR",
            categoryName: mappedCat?.name || "Libur Sekolah",
            statusId: mappedStatus?.id || "STATUS_TIDAK_EFEKTIF",
            statusName: mappedStatus?.name || "Hari Tidak Efektif KBM",
            description: holiday.description,
            priority: holiday.isEffectiveDay ? "Sedang" : "Tinggi",
            isEffectiveDay: holiday.isEffectiveDay,
            reduceLesson: false,
            specialLessonDuration: 40,
            affectsAcademicPlanning: true,
            affectsScheduler: true,
            createdAt: new Date().toISOString()
          };

          existingEvents.push(newEvent);
          dayEventsMap.set(dateStr, existingEvents);
          syncedCount++;
        }
      });

      if (syncedCount === 0) {
        showToast("Kalender akademik sudah tersinkronisasi sepenuhnya!", "info");
        setIsSyncingHolidays(false);
        return;
      }

      // Prepare payload for bulk import
      const updatedCalendarDays: AcademicCalendarDay[] = [];
      dayEventsMap.forEach((events, date) => {
        const resolvedSemId = getSemesterIdForDate(date, currentSemester.id);
        updatedCalendarDays.push({
          id: date,
          date,
          events: events.map(e => ({
            ...e,
            academicYearId: currentSemester.academicYearId,
            semesterId: resolvedSemId
          })),
          academicYearId: currentSemester.academicYearId,
          semesterId: resolvedSemId
        });
      });

      await academicPlanningService.importCalendarEventsBulk(
        updatedCalendarDays,
        currentSemester.academicYearId,
        currentSemester.id,
        user?.uid || "system",
        user?.displayName || user?.name || "System"
      );

      // Reload events locally
      const refreshedDays = await academicPlanningService.getCalendarDays(currentSemester.academicYearId);
      setCalendarDays(refreshedDays);

      showToast(`Berhasil menyinkronkan ${syncedCount} hari besar & libur nasional!`, "success");
    } catch (error: any) {
      showToast("Gagal melakukan sinkronisasi: " + error.message, "error");
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  const handleOpenSemesterRangeModal = () => {
    if (currentSemester) {
      setSemesterRangeForm({
        startDate: currentSemester.startDate,
        endDate: currentSemester.endDate
      });
      setIsSemesterRangeModalOpen(true);
    }
  };

  const handleSaveSemesterRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSemesterId) return;
    try {
      setLoading(true);
      await semesterService.updateSemester(selectedSemesterId, {
        startDate: semesterRangeForm.startDate,
        endDate: semesterRangeForm.endDate
      }, user?.uid || "system", user?.displayName || user?.name || "System");
      
      showToast("Rentang tanggal semester berhasil diperbarui!", "success");
      setIsSemesterRangeModalOpen(false);
      
      // Reload initial data to fetch updated semesters
      await loadInitialData();
    } catch (error: any) {
      showToast("Gagal memperbarui rentang semester: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const currentSemester = semesters.find(s => s.id === selectedSemesterId);

  const getSemesterIdForDate = (dateStr: string, defaultSemId: string): string => {
    if (!dateStr || semesters.length === 0) return defaultSemId;
    const targetDate = new Date(dateStr);
    const matched = semesters.find(s => {
      if (!s.startDate || !s.endDate) return false;
      const start = new Date(s.startDate);
      const end = new Date(s.endDate);
      return targetDate >= start && targetDate <= end;
    });
    return matched ? matched.id : defaultSemId;
  };

  const weeksConfigSemester = semesters.find(s => s.id === weeksConfigSemesterId) || currentSemester;
  const academicYearSemesters = currentSemester ? semesters.filter(s => s.academicYearId === currentSemester.academicYearId) : [];

  // Filter references by Category
  const eventCategories = references.filter(r => r.category === "Kategori Event" || r.category === "Kategori Kalender");
  const dayStatuses = references.filter(r => r.category === "Status Hari" || r.category === "Status Pembelajaran");

  // Format Date Helper
  const formatDateString = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getCalendarDayEvents = (dateStr: string): AcademicEvent[] => {
    const day = calendarDays.find(d => d.date === dateStr);
    return day ? day.events : [];
  };

  // Navigating months safely within semester boundaries if desired (or freely)
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Open manage event modal
  const handleOpenDateModal = (dateStr: string) => {
    setSelectedDateStr(dateStr);
    setEditingEventId(null);
    
    // Reset event form
    const firstCat = references.find(r => r.category === "Kategori Event");
    const firstStatus = references.find(r => r.category === "Status Hari");

    setEventForm({
      title: "",
      categoryId: firstCat ? firstCat.id : "",
      statusId: firstStatus ? firstStatus.id : "",
      description: "",
      priority: "Sedang",
      isEffectiveDay: true,
      reduceLesson: false,
      specialLessonDuration: 40,
      affectsAcademicPlanning: true,
      affectsScheduler: true,
      isRange: false,
      startDate: dateStr,
      endDate: dateStr
    });
    setIsEventModalOpen(true);
  };

  const handleEditEvent = (event: AcademicEvent) => {
    setEditingEventId(event.id);
    setEventForm({
      title: event.title,
      categoryId: event.categoryId,
      statusId: event.statusId,
      description: event.description,
      priority: event.priority,
      isEffectiveDay: event.isEffectiveDay,
      reduceLesson: event.reduceLesson,
      specialLessonDuration: event.specialLessonDuration,
      affectsAcademicPlanning: event.affectsAcademicPlanning,
      affectsScheduler: event.affectsScheduler,
      isRange: event.isRange || false,
      startDate: event.startDate || selectedDateStr,
      endDate: event.endDate || selectedDateStr
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    setDeleteConfirmation({
      isOpen: true,
      eventId
    });
  };

  const handleDeleteEventConfirmed = async () => {
    const eventId = deleteConfirmation.eventId;
    if (!eventId) return;

    // DEBUG LOGS (Sesuai instruksi)
    console.log("Delete ID:", eventId);
    console.log("Collection:", "academic_calendar");

    try {
      setLoading(true);
      await academicPlanningService.deleteCalendarEvent(
        eventId,
        user?.uid || "system",
        user?.displayName || "System"
      );

      console.log("Delete Success");

      // STEP 3: Update state React langsung (tanpa reload / menunggu refresh lambat)
      setCalendarDays(prevDays => {
        return prevDays.map(day => {
          if (day.events && Array.isArray(day.events)) {
            return {
              ...day,
              events: day.events.filter(e => e.id !== eventId)
            };
          }
          return day;
        }).filter(day => day.events && day.events.length > 0);
      });

      // Panggil sinkronisasi database di background
      const freshDays = await academicPlanningService.getCalendarDays(
        currentSemester?.academicYearId || ""
      );
      setCalendarDays(freshDays);
      
      // NOTIFIKASI SUKSES (Toast Hijau)
      showToast("Agenda berhasil dihapus.", "success");
      
      // Reset form & state
      setEditingEventId(null);
      setEventForm(prev => ({ ...prev, title: "", description: "" }));
      setDeleteConfirmation({ isOpen: false, eventId: null });
    } catch (error: any) {
      console.error(error);
      // NOTIFIKASI GAGAL (Toast Merah dengan detail error)
      showToast("Gagal menghapus agenda. Detail: " + (error.message || error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim()) {
      showToast("Judul event wajib diisi", "error");
      return;
    }

    try {
      setLoading(true);
      const catRef = references.find(r => r.id === eventForm.categoryId);
      const statusRef = references.find(r => r.id === eventForm.statusId);

      const eventPayload: AcademicEvent = {
        id: editingEventId || `evt-${Date.now()}`,
        title: eventForm.title,
        categoryId: eventForm.categoryId,
        categoryName: catRef ? catRef.name : "",
        statusId: eventForm.statusId,
        statusName: statusRef ? statusRef.name : "",
        description: eventForm.description,
        priority: eventForm.priority,
        isEffectiveDay: eventForm.isEffectiveDay,
        reduceLesson: eventForm.reduceLesson,
        specialLessonDuration: Number(eventForm.specialLessonDuration),
        affectsAcademicPlanning: eventForm.affectsAcademicPlanning,
        affectsScheduler: eventForm.affectsScheduler,
        createdAt: new Date().toISOString(),
        isRange: eventForm.isRange || false,
        startDate: eventForm.startDate || selectedDateStr,
        endDate: eventForm.isRange ? (eventForm.endDate || eventForm.startDate || selectedDateStr) : (eventForm.startDate || selectedDateStr)
      };

      await academicPlanningService.saveCalendarEvent(
        eventPayload,
        currentSemester?.academicYearId || "",
        getSemesterIdForDate(eventPayload.startDate, currentSemester?.id || ""),
        user?.uid || "",
        user?.displayName || "System"
      );

      // Refresh calendar days
      const freshDays = await academicPlanningService.getCalendarDays(
        currentSemester?.academicYearId || ""
      );
      setCalendarDays(freshDays);

      showToast("Event berhasil disimpan", "success");
      setEditingEventId(null);
      
      // Reset form
      setEventForm(prev => ({
        ...prev,
        title: "",
        description: "",
        priority: "Sedang"
      }));
    } catch (error: any) {
      showToast("Gagal menyimpan event: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // EXCEL EXPORT
  const handleExportExcel = async () => {
    try {
      if (!currentSemester) {
        showToast("Silakan pilih semester terlebih dahulu!", "error");
        return;
      }

      showToast("Sedang menyiapkan dokumen Excel...", "info");

      // Load active school settings to get accurate active school days
      const settings = await schoolSettingsService.getSettings();

      await exportAcademicCalendarExcel({
        currentSemester,
        calendarDays,
        weeksConfig,
        teachers,
        user,
        schoolSettings: settings
      });

      showToast("Unduh Kalender Pendidikan Excel berhasil!", "success");
    } catch (error: any) {
      console.error("Export Excel error: ", error);
      showToast("Gagal export Excel: " + error.message, "error");
    }
  };

  // EXCEL TEMPLATE DOWNLOAD
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          "Tanggal (YYYY-MM-DD)": "2026-07-20",
          "Judul Event": "Hari Pertama Masuk Sekolah",
          "Kategori (Code/Name)": "Kegiatan Belajar Mengajar (KBM)",
          "Status (Code/Name)": "Hari Efektif KBM",
          "Deskripsi": "KBM perdana semester baru ganjil",
          "Prioritas (Tinggi/Sedang/Rendah)": "Sedang",
          "Hari Efektif Belajar (Ya/Tidak)": "Ya",
          "Kurangi Jam Pelajaran (Ya/Tidak)": "Tidak",
          "Durasi Jam Khusus (Menit)": 40,
          "Berpengaruh ke Rencana Akad (Ya/Tidak)": "Ya",
          "Berpengaruh ke Jadwal (Ya/Tidak)": "Ya"
        },
        {
          "Tanggal (YYYY-MM-DD)": "2026-08-17",
          "Judul Event": "Hari Kemerdekaan RI",
          "Kategori (Code/Name)": "Libur Sekolah",
          "Status (Code/Name)": "Hari Tidak Efektif KBM",
          "Deskripsi": "Libur Nasional Proklamasi Kemerdekaan",
          "Prioritas (Tinggi/Sedang/Rendah)": "Tinggi",
          "Hari Efektif Belajar (Ya/Tidak)": "Tidak",
          "Kurangi Jam Pelajaran (Ya/Tidak)": "Tidak",
          "Durasi Jam Khusus (Menit)": 0,
          "Berpengaruh ke Rencana Akad (Ya/Tidak)": "Ya",
          "Berpengaruh ke Jadwal (Ya/Tidak)": "Ya"
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Kalender");
      XLSX.writeFile(wb, "Template_Kalender_Akademik.xlsx");
      showToast("Template Excel diunduh!", "success");
    } catch (error: any) {
      showToast("Gagal mengunduh template: " + error.message, "error");
    }
  };

  // EXCEL IMPORT PARSER
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) {
          throw new Error("File Excel kosong atau tidak sesuai template");
        }

        const importedDaysMap = new Map<string, AcademicEvent[]>();

        rows.forEach((row) => {
          const dateStr = row["Tanggal (YYYY-MM-DD)"];
          const title = row["Judul Event"];
          if (!dateStr || !title) return;

          // Find categories/status mappings
          const rawCat = row["Kategori (Code/Name)"] || "Kegiatan Belajar Mengajar (KBM)";
          const rawStatus = row["Status (Code/Name)"] || "Hari Efektif KBM";

          const mappedCat = references.find(r => r.name.toLowerCase() === String(rawCat).toLowerCase() || r.code === String(rawCat).toUpperCase()) || eventCategories[0];
          const mappedStatus = references.find(r => r.name.toLowerCase() === String(rawStatus).toLowerCase() || r.code === String(rawStatus).toUpperCase()) || dayStatuses[0];

          const isEff = String(row["Hari Efektif Belajar (Ya/Tidak)"]).toLowerCase() === "ya" || String(row["Hari Efektif Belajar (Ya/Tidak)"]).toLowerCase() === "yes";
          const redLesson = String(row["Kurangi Jam Pelajaran (Ya/Tidak)"]).toLowerCase() === "ya" || String(row["Kurangi Jam Pelajaran (Ya/Tidak)"]).toLowerCase() === "yes";
          const specialDuration = Number(row["Durasi Jam Khusus (Menit)"]) || 40;
          const affPl = String(row["Berpengaruh ke Rencana Akad (Ya/Tidak)"]).toLowerCase() === "ya" || String(row["Berpengaruh ke Rencana Akad (Ya/Tidak)"]).toLowerCase() === "yes";
          const affSch = String(row["Berpengaruh ke Jadwal (Ya/Tidak)"]).toLowerCase() === "ya" || String(row["Berpengaruh ke Jadwal (Ya/Tidak)"]).toLowerCase() === "yes";

          const priority = row["Prioritas (Tinggi/Sedang/Rendah)"] || "Sedang";

          const newEvt: AcademicEvent = {
            id: `evt-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            title,
            categoryId: mappedCat?.id || "EVENT_KBM",
            categoryName: mappedCat?.name || "Kegiatan Belajar Mengajar (KBM)",
            statusId: mappedStatus?.id || "STATUS_EFEKTIF",
            statusName: mappedStatus?.name || "Hari Efektif KBM",
            description: row["Deskripsi"] || "",
            priority: priority === "Tinggi" || priority === "Rendah" ? priority : "Sedang",
            isEffectiveDay: isEff,
            reduceLesson: redLesson,
            specialLessonDuration: specialDuration,
            affectsAcademicPlanning: affPl,
            affectsScheduler: affSch,
            createdAt: new Date().toISOString()
          };

          if (!importedDaysMap.has(dateStr)) {
            importedDaysMap.set(dateStr, []);
          }
          importedDaysMap.get(dateStr)!.push(newEvt);
        });

        const formattedDays: AcademicCalendarDay[] = [];
        importedDaysMap.forEach((events, date) => {
          const resolvedSemId = getSemesterIdForDate(date, currentSemester?.id || "");
          formattedDays.push({
            id: date,
            date,
            events: events.map(e => ({
              ...e,
              academicYearId: currentSemester?.academicYearId,
              semesterId: resolvedSemId
            })),
            academicYearId: currentSemester?.academicYearId,
            semesterId: resolvedSemId
          });
        });

        await academicPlanningService.importCalendarEventsBulk(
          formattedDays,
          currentSemester?.academicYearId || "",
          currentSemester?.id || "",
          user?.uid || "",
          user?.displayName || "System"
        );

        showToast(`Berhasil mengimpor ${formattedDays.length} tanggal kalender akademik`, "success");
        
        // Refresh
        const freshDays = await academicPlanningService.getCalendarDays(currentSemester?.academicYearId);
        setCalendarDays(freshDays);
      } catch (error: any) {
        showToast("Gagal mengimpor Excel: " + error.message, "error");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // PDF EXPORT PLACEHOLDER
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("KALENDER AKADEMIK & EVENT SEKOLAH", 14, 20);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Tahun Pelajaran: ${currentSemester?.academicYearName || "-"}`, 14, 28);
      doc.text(`Semester: ${currentSemester?.name || "-"}`, 14, 34);
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}`, 14, 40);

      // Draw lines
      doc.line(14, 44, 196, 44);

      let yPos = 52;
      doc.setFont("helvetica", "bold");
      doc.text("Daftar Kegiatan Pembelajaran & Libur:", 14, yPos);
      yPos += 8;

      doc.setFontSize(10);
      let count = 1;

      const sortedDays = [...calendarDays].sort((a, b) => a.date.localeCompare(b.date));

      sortedDays.forEach((day) => {
        day.events.forEach((evt) => {
          if (yPos > 270) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFont("helvetica", "bold");
          doc.text(`${count}. ${day.date} - ${evt.title}`, 14, yPos);
          yPos += 5;

          doc.setFont("helvetica", "normal");
          doc.text(`   Kategori: ${evt.categoryName || "-"} | Status: ${evt.statusName || "-"} | Prioritas: ${evt.priority}`, 14, yPos);
          yPos += 5;
          
          if (evt.description) {
            doc.text(`   Keterangan: ${evt.description}`, 14, yPos);
            yPos += 5;
          }
          yPos += 2;
          count++;
        });
      });

      doc.save(`Kalender_Akademik_${currentSemester?.academicYearName.replace("/", "_")}_${currentSemester?.code}.pdf`);
      showToast("PDF berhasil diunduh!", "success");
    } catch (error: any) {
      showToast("Gagal mengunduh PDF: " + error.message, "error");
    }
  };

  // RENDER MONTH CALENDAR GRID
  const renderMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const gridCells = [];

    // Empty cells for padding from previous month
    for (let i = 0; i < firstDayIndex; i++) {
      gridCells.push(<div key={`empty-${i}`} className="h-28 bg-slate-50/50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850/50" />);
    }

    // Days of the month
    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dayDate = new Date(year, month, dayNum);
      const dateStr = formatDateString(dayDate);
      const dayOfWeek = dayDate.getDay();
      const dayName = indonesianDays[dayOfWeek];
      const isHoliday = !activeDays.some(ad => ad.toLowerCase() === dayName.toLowerCase());

      const dayEvents = getCalendarDayEvents(dateStr);

      const cellTooltip = (() => {
        if (dayEvents.length === 0) {
          return isHoliday ? "Hari Libur Akhir Pekan / Sekolah" : "Hari Efektif KBM";
        }
        return dayEvents.map(evt => {
          const start = evt.startDate || dateStr;
          const end = evt.endDate || dateStr;
          return `Agenda: ${evt.title}
Jenis: ${evt.categoryName || "KBM"}
Tanggal Mulai: ${start}
Tanggal Selesai: ${end}
Keterangan: ${evt.description || "-"}`;
        }).join("\n\n");
      })();

      const customCellStyle: React.CSSProperties = {};
      if (dayEvents.length > 0) {
        const primaryColor = getEventColorCode(dayEvents[0]);
        customCellStyle.backgroundColor = primaryColor + "10"; // ~6% opacity
        customCellStyle.borderColor = primaryColor + "30";
      }

      gridCells.push(
        <div
          key={dateStr}
          onClick={() => handleOpenDateModal(dateStr)}
          title={cellTooltip}
          style={customCellStyle}
          className={`h-28 border border-slate-150 dark:border-zinc-850/60 p-2 flex flex-col justify-between hover:bg-blue-50/20 dark:hover:bg-zinc-800/40 transition-all cursor-pointer group relative ${
            isHoliday && dayEvents.length === 0 ? "bg-rose-50/20 dark:bg-rose-950/5" : "bg-white dark:bg-zinc-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${
              isHoliday ? "text-rose-600 dark:text-rose-400" : "text-slate-800 dark:text-zinc-300"
            }`}>
              {dayNum}
            </span>
            {dayEvents.length > 0 && (
              <span className="text-[9px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                {dayEvents.length} Event
              </span>
            )}
          </div>

          <div className="flex-1 mt-1.5 space-y-1 overflow-y-auto scrollbar-none">
            {dayEvents.slice(0, 3).map((evt) => {
              const priorityColors = {
                Tinggi: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-900",
                Sedang: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900",
                Rendah: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
              };

              return (
                <div
                  key={evt.id}
                  title={`${evt.title}\nKategori: ${evt.categoryName || "-"}\nStatus: ${evt.statusName || "-"}`}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md border font-medium truncate ${priorityColors[evt.priority]}`}
                >
                  {evt.title}
                </div>
              );
            })}
            {dayEvents.length > 3 && (
              <div className="text-[8px] font-bold text-slate-400 text-center">
                +{dayEvents.length - 3} lainnya
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 border-t border-l border-slate-200 dark:border-zinc-800 rounded-b-2xl overflow-hidden shadow-xs">
        {indonesianDays.map((d) => (
          <div key={d} className="bg-slate-100 dark:bg-zinc-850 p-2 text-center text-xs font-bold text-slate-600 dark:text-zinc-400 border-r border-b border-slate-200 dark:border-zinc-800">
            {d}
          </div>
        ))}
        {gridCells}
      </div>
    );
  };

  // RENDER YEAR VIEW
  const renderYearGrid = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {indonesianMonths.map((monthName, monthIndex) => {
          const year = currentDate.getFullYear();
          const firstDay = new Date(year, monthIndex, 1).getDay();
          const totalDays = new Date(year, monthIndex + 1, 0).getDate();

          const daysArray = [];
          for (let i = 0; i < firstDay; i++) {
            daysArray.push(<div key={`empty-${i}`} className="aspect-square" />);
          }

          for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
            const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dayEvents = getCalendarDayEvents(dateStr);
            const hasEvents = dayEvents.length > 0;
            const dayOfWeek = new Date(year, monthIndex, dayNum).getDay();
            const dayName = indonesianDays[dayOfWeek];
            const isHoliday = !activeDays.some(ad => ad.toLowerCase() === dayName.toLowerCase());

            daysArray.push(
              <button
                key={dateStr}
                onClick={() => {
                  setCurrentDate(new Date(year, monthIndex, 1));
                  setViewMode('calendar');
                }}
                className={`aspect-square flex items-center justify-center text-[10px] font-semibold rounded-lg hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer ${
                  hasEvents 
                    ? "bg-blue-600 text-white shadow-xs" 
                    : isHoliday 
                      ? "text-rose-500 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/10" 
                      : "text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-900/30"
                }`}
                title={hasEvents ? `${dayEvents.length} event` : `${monthName} ${dayNum}`}
              >
                {dayNum}
              </button>
            );
          }

          return (
            <div key={monthName} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3 text-center">
                {monthName} {year}
              </h4>
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-slate-400 font-bold mb-1.5">
                {["Mg", "Sn", "Sl", "Rb", "Km", "Jm", "Sb"].map(h => <div key={h}>{h}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {daysArray}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // RENDER EVENT LIST VIEW
  const renderListView = () => {
    const allEventsSorted: { date: string; event: AcademicEvent }[] = [];
    calendarDays.forEach((day) => {
      day.events.forEach((event) => {
        allEventsSorted.push({ date: day.date, event });
      });
    });

    // Sort ascending by date
    allEventsSorted.sort((a, b) => a.date.localeCompare(b.date));

    // Filter
    const filteredEvents = allEventsSorted.filter((item) => {
      const matchesSearch = item.event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (item.event.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter ? item.event.categoryId === categoryFilter : true;
      return matchesSearch && matchesCategory;
    });

    if (filteredEvents.length === 0) {
      return (
        <div className="p-16 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
          <Info className="h-10 w-10 mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-200">Tidak ada event ditemukan</h4>
          <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter kategori Anda.</p>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800">
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tanggal</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Judul Event</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Kategori</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Prioritas</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">KBM Efektif</th>
                <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Khusus JP</th>
                {canEditCalendar && (
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-right">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
              {filteredEvents.map(({ date, event }) => (
                <tr key={event.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="p-4 text-sm font-semibold text-slate-800 dark:text-zinc-300">
                    {new Date(date).toLocaleDateString("id-ID", { dateStyle: "medium" })}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{event.title}</div>
                    {event.description && <div className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">{event.description}</div>}
                  </td>
                  <td className="p-4 text-sm text-slate-600 dark:text-zinc-400">{event.categoryName || "KBM"}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      event.priority === "Tinggi" 
                        ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400" 
                        : event.priority === "Sedang"
                          ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400"
                          : "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400"
                    }`}>
                      {event.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    {event.isEffectiveDay ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle className="h-4 w-4" /> Ya
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-rose-500 font-semibold">
                        <XCircle className="h-4 w-4" /> Tidak (Libur)
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    {event.reduceLesson ? (
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {event.specialLessonDuration} Menit
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Normal</span>
                    )}
                  </td>
                  {canEditCalendar && (
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedDateStr(date);
                          handleEditEvent(event);
                          setIsEventModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                        title="Edit Event"
                      >
                        <Edit className="h-4.5 w-4.5" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedDateStr(date);
                          handleDeleteEvent(event.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                        title="Hapus Event"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="academic-calendar-container">
      {/* Top Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Kalender Akademik</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Kelola agenda KBM, ujian, libur nasional, dan masa kegiatan akademik Madrasah.
          </p>
        </div>
        
        {/* Dynamic Semester Selection */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Semester:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="text-sm font-semibold text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-hidden cursor-pointer"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id} className="text-slate-800 dark:text-zinc-200">
                  {s.academicYearName} - {s.name} {s.isActive ? "(Aktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-1 shadow-xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-2 rounded-lg cursor-pointer ${viewMode === 'calendar' ? 'bg-slate-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'}`}
              title="Month Grid"
            >
              <Grid className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`p-2 rounded-lg cursor-pointer ${viewMode === 'year' ? 'bg-slate-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'}`}
              title="Year View"
            >
              <Calendar className="h-4.5 w-4.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg cursor-pointer ${viewMode === 'list' ? 'bg-slate-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'}`}
              title="List View"
            >
              <List className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bento Grid: Academic Configurations & Synchronization Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: Durasi & Rentang Semester */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Calendar className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Rentang Semester</div>
              <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200 mt-0.5">
                {currentSemester ? `${new Date(currentSemester.startDate).toLocaleDateString("id-ID", { dateStyle: "medium" })} s/d ${new Date(currentSemester.endDate).toLocaleDateString("id-ID", { dateStyle: "medium" })}` : "-"}
              </div>
            </div>
          </div>
          {canEditCalendar ? (
            <button
              onClick={handleOpenSemesterRangeModal}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              <Edit className="h-3.5 w-3.5" /> Ubah Rentang Semester
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic text-center py-1">Akses Edit Terbatas</div>
          )}
        </div>

        {/* Card 2: Pengaturan Hari Aktif Mingguan */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Hari Aktif Sekolah</div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mt-0.5 line-clamp-2">
                {activeDays.length > 0 ? activeDays.join(", ") : "Tidak ada hari aktif"}
              </div>
            </div>
          </div>
          {canEditCalendar ? (
            <div className="flex gap-2">
              <button
                onClick={() => handleUpdateActiveDays(["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"])}
                className={`flex-1 text-[10px] py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  !activeDays.includes("Jumat") && activeDays.includes("Sabtu")
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-300"
                    : "border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
                title="Set Hari Jumat Libur, Hari Sabtu s/d Kamis Aktif"
              >
                Jumat Libur (Sbt-Kms)
              </button>
              <button
                onClick={() => handleUpdateActiveDays(["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"])}
                className={`flex-1 text-[10px] py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  activeDays.includes("Jumat") && !activeDays.includes("Minggu")
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-300"
                    : "border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                }`}
                title="Set Hari Minggu Libur, Hari Senin s/d Sabtu Aktif"
              >
                Minggu Libur (Snn-Sbt)
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic text-center py-1">Akses Edit Terbatas</div>
          )}
        </div>

        {/* Card 3: Sinkronisasi Hari Besar & Libur Nasional */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Sinkronisasi Libur Nasional</div>
              <p className="text-[10px] text-slate-400 mt-0.5">Integrasikan hari libur resmi & hari besar ke kalender akademik.</p>
            </div>
          </div>
          {canEditCalendar ? (
            <button
              onClick={handleSyncHolidays}
              disabled={isSyncingHolidays || !selectedSemesterId}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-zinc-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              {isSyncingHolidays ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sinkronisasi...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" /> Sinkronisasikan Hari Besar
                </>
              )}
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic text-center py-1">Akses Edit Terbatas</div>
          )}
        </div>

      </div>

      {/* Interactive Category Colors Customizer */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-zinc-850 pb-3 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-indigo-500" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Kustomisasi Tampilan Warna Kategori Kalender</h3>
          </div>
          <span className="text-[10px] text-slate-400 italic">
            {canEditCalendar ? "Klik palet untuk mengganti warna kategori KBM / Agenda secara real-time" : "Tampilan legenda kategori warna agenda akademik"}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {Object.entries(categoryColors).map(([name, color]) => (
            <div key={name} className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-100 dark:border-zinc-850 bg-slate-50/50 dark:bg-zinc-950/20">
              <span className="text-[9px] font-bold text-slate-500 dark:text-zinc-400 text-center mb-1.5 truncate w-full" title={name}>{name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color as string}
                  onChange={(e) => {
                    const newColors = { ...categoryColors, [name]: e.target.value };
                    setCategoryColors(newColors);
                    localStorage.setItem("academic_calendar_colors", JSON.stringify(newColors));
                  }}
                  disabled={!canEditCalendar}
                  className="w-10 h-7 rounded-md cursor-pointer border-0 bg-transparent focus:outline-hidden disabled:cursor-not-allowed"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Row 2: Import & Export Actions Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          Utilitas Excel & Ekspor Dokumen
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <input
            type="file"
            accept=".xlsx,.xls"
            ref={fileInputRef}
            onChange={handleImportExcel}
            className="hidden"
          />
          {canEditCalendar && (
            <>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" /> Import Excel
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Template Excel
              </button>
            </>
          )}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="p-16 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600 mx-auto mb-4" />
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Menghubungkan kalender akademik...</p>
        </div>
      ) : (
        <>
          {viewMode === 'calendar' && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              {/* Calendar Grid Header (Month and Controls) */}
              <div className="flex items-center justify-between p-4 border-b border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/20">
                <h3 className="text-base font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  {indonesianMonths[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={handlePrevMonth}
                    className="p-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                  >
                    <ChevronLeft className="h-4.5 w-4.5" />
                  </button>
                  <button
                    onClick={handleNextMonth}
                    className="p-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer"
                  >
                    <ChevronRight className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
              {renderMonthGrid()}
            </div>
          )}

          {viewMode === 'year' && renderYearGrid()}

          {viewMode === 'list' && (
            <div className="space-y-4">
              {/* List Search & Filter header */}
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="Cari event..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                  />
                </div>
                <div className="w-full sm:w-56">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                  >
                    <option value="">Semua Kategori</option>
                    {eventCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {renderListView()}
            </div>
          )}
        </>
      )}

      {/* EVENT CRUD DIALOG MODAL */}
      <AnimatePresence>
        {isEventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEventModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col md:flex-row h-[90vh] md:h-auto max-h-[90vh]"
            >
              {/* Left Column: Manage Events List */}
              <div className="w-full md:w-2/5 border-b md:border-b-0 md:border-r border-slate-150 dark:border-zinc-800 p-5 flex flex-col h-1/2 md:h-auto overflow-y-auto">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-zinc-850">
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Event di Tanggal</h3>
                    <div className="text-base font-bold text-slate-800 dark:text-zinc-100 mt-0.5">
                      {new Date(selectedDateStr).toLocaleDateString("id-ID", { dateStyle: "long" })}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5">
                  {getCalendarDayEvents(selectedDateStr).length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-slate-400">
                      <Calendar className="h-7 w-7 mx-auto opacity-35 mb-2" />
                      <p className="text-xs font-semibold">Belum ada agenda</p>
                    </div>
                  ) : (
                    getCalendarDayEvents(selectedDateStr).map((evt) => {
                      const isEditingThis = editingEventId === evt.id;
                      return (
                        <div
                          key={evt.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isEditingThis 
                              ? "border-blue-500 bg-blue-50/25 dark:bg-blue-950/20" 
                              : "border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/20"
                          }`}
                        >
                          <div className="flex justify-between gap-2">
                            <span className="font-semibold text-xs text-slate-900 dark:text-zinc-100">{evt.title}</span>
                            {canEditCalendar && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEditEvent(evt)}
                                  className="p-1 text-slate-400 hover:text-blue-500"
                                  title="Edit"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEvent(evt.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500"
                                  title="Hapus"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                          {evt.description && <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">{evt.description}</p>}
                          <div className="flex flex-wrap gap-1 mt-2">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400">
                              {evt.categoryName || "KBM"}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              evt.isEffectiveDay ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-rose-50 text-rose-700 dark:bg-rose-950/20"
                            }`}>
                              {evt.isEffectiveDay ? "Hari Efektif" : "Libur"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {canEditCalendar && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEventId(null);
                      setEventForm(prev => ({
                        ...prev,
                        title: "",
                        description: "",
                        priority: "Sedang",
                        isRange: false,
                        startDate: selectedDateStr,
                        endDate: selectedDateStr
                      }));
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-blue-200 dark:border-blue-900/50 hover:bg-blue-50/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Agenda Lain
                  </button>
                )}
              </div>

              {/* Right Column: Event Form */}
              <div className="flex-1 p-5 flex flex-col overflow-y-auto h-1/2 md:h-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-zinc-800 mb-4">
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-50">
                    {!canEditCalendar ? "Detail Agenda Akademik" : editingEventId ? "Ubah Detail Agenda" : "Buat Agenda Baru"}
                  </h3>
                  <button
                    onClick={() => setIsEventModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {!canEditCalendar ? (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-950/10">
                    <Info className="h-10 w-10 text-blue-500 mb-3 opacity-80" />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Mode Lihat (Read-Only)</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 max-w-xs">
                      Anda login sebagai Guru. Pengelolaan hari aktif dan agenda kalender akademik madrasah hanya diizinkan untuk Admin dan Wakakurikulum.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveEvent} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      <div className="sm:col-span-2 flex items-center gap-4 bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-850">
                        <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Tipe Tanggal:</div>
                        <label className="inline-flex items-center text-xs font-bold text-slate-600 dark:text-zinc-400 cursor-pointer">
                          <input
                            type="radio"
                            checked={!eventForm.isRange}
                            onChange={() => setEventForm({ ...eventForm, isRange: false })}
                            className="mr-1.5 text-blue-600 focus:ring-blue-500"
                          />
                          Satu Hari
                        </label>
                        <label className="inline-flex items-center text-xs font-bold text-slate-600 dark:text-zinc-400 cursor-pointer">
                          <input
                            type="radio"
                            checked={!!eventForm.isRange}
                            onChange={() => setEventForm({ ...eventForm, isRange: true })}
                            className="mr-1.5 text-blue-600 focus:ring-blue-500"
                          />
                          Rentang Tanggal
                        </label>
                      </div>

                      {eventForm.isRange && (
                        <div className="sm:col-span-2 grid grid-cols-2 gap-4 bg-blue-50/10 dark:bg-blue-950/5 p-3 rounded-xl border border-blue-100/40 dark:border-blue-900/20">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Tanggal Mulai</label>
                            <input
                              type="date"
                              required
                              value={eventForm.startDate}
                              onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                              className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-xs font-semibold focus:outline-hidden text-slate-800 dark:text-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Tanggal Selesai</label>
                            <input
                              type="date"
                              required
                              min={eventForm.startDate}
                              value={eventForm.endDate}
                              onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                              className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-xs font-semibold focus:outline-hidden text-slate-800 dark:text-zinc-100"
                            />
                          </div>
                        </div>
                      )}

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Judul Event / Kegiatan</label>
                        <input
                          type="text"
                          required
                          placeholder="E.g., Ujian Tengah Semester, Rapat Pleno"
                          value={eventForm.title}
                          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                        />
                      </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Kategori Event</label>
                      <select
                        value={eventForm.categoryId}
                        onChange={(e) => setEventForm({ ...eventForm, categoryId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                      >
                        {eventCategories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Status Hari</label>
                      <select
                        value={eventForm.statusId}
                        onChange={(e) => setEventForm({ ...eventForm, statusId: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                      >
                        {dayStatuses.map((st) => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Deskripsi / Catatan Tambahan</label>
                      <textarea
                        rows={2}
                        placeholder="Deskripsi ringkas mengenai agenda..."
                        value={eventForm.description}
                        onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Prioritas</label>
                      <select
                        value={eventForm.priority}
                        onChange={(e) => setEventForm({ ...eventForm, priority: e.target.value as any })}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                      >
                        <option value="Tinggi">Tinggi (Urgensi Tinggi / Libur Resmi)</option>
                        <option value="Sedang">Sedang (Agenda Standard)</option>
                        <option value="Rendah">Rendah (Opsional / Fleksibel)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Mempengaruhi Perencanaan?</label>
                      <div className="flex gap-4 mt-2">
                        <label className="inline-flex items-center text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          <input
                            type="radio"
                            checked={eventForm.affectsAcademicPlanning}
                            onChange={() => setEventForm({ ...eventForm, affectsAcademicPlanning: true })}
                            className="mr-1.5 focus:ring-blue-500"
                          />
                          Ya
                        </label>
                        <label className="inline-flex items-center text-xs font-semibold text-slate-700 dark:text-zinc-300">
                          <input
                            type="radio"
                            checked={!eventForm.affectsAcademicPlanning}
                            onChange={() => setEventForm({ ...eventForm, affectsAcademicPlanning: false })}
                            className="mr-1.5 focus:ring-blue-500"
                          />
                          Tidak
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Effective day and special JP reduction switches */}
                  <div className="border-t border-slate-150 dark:border-zinc-800 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Hari Belajar Efektif (KBM Aktif)</div>
                        <div className="text-[10px] text-slate-400">Jika aktif, hari ini dihitung sebagai waktu belajar siswa.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={eventForm.isEffectiveDay}
                        onChange={(e) => setEventForm({ ...eventForm, isEffectiveDay: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 rounded-md border-slate-300 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-700 dark:text-zinc-200">Mengurangi Jam Pelajaran?</div>
                        <div className="text-[10px] text-slate-400">E.g., jam khusus selama bulan Ramadhan atau hari khusus lainnya.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={eventForm.reduceLesson}
                        onChange={(e) => setEventForm({ ...eventForm, reduceLesson: e.target.checked })}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 rounded-md border-slate-300 cursor-pointer"
                      />
                    </div>

                    {eventForm.reduceLesson && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="pl-4 border-l-2 border-blue-500 pt-2"
                      >
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Durasi 1 JP Khusus (Menit)</label>
                        <input
                          type="number"
                          value={eventForm.specialLessonDuration}
                          onChange={(e) => setEventForm({ ...eventForm, specialLessonDuration: Number(e.target.value) })}
                          className="w-32 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs font-semibold focus:outline-hidden text-slate-800 dark:text-zinc-100"
                        />
                      </motion.div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => setIsEventModalOpen(false)}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-xs cursor-pointer"
                    >
                      Selesai
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      Simpan Agenda
                    </button>
                  </div>
                </form>
              )}
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Pengaturan Manual Pekan Efektif Card */}
      {selectedSemesterId && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs mt-6 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-850 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Palette className="h-5 w-5 text-indigo-500" />
                Pengaturan Manual Pekan per Bulan ({weeksConfigSemester?.name})
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Atur jumlah pekan dan pekan efektif pembelajaran setiap bulan secara manual untuk mendistribusikan jam pelajaran (JP).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Semester Switcher Tabs for Manual Weeks Configuration */}
              {academicYearSemesters.length > 1 && (
                <div className="flex items-center gap-1 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 p-1">
                  {academicYearSemesters.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setWeeksConfigSemesterId(s.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        weeksConfigSemesterId === s.id
                          ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-350"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}

              {canEditCalendar && (
                <button
                  onClick={handleSaveWeeksConfig}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/10 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" /> Simpan Pengaturan Pekan
                </button>
              )}
            </div>
          </div>

          {isWeeksConfigLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 mx-auto mb-2" />
              Memuat konfigurasi pekan...
            </div>
          ) : weeksConfig.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              Tidak ada data bulan yang terdeteksi untuk semester ini.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-850 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-150 dark:border-zinc-800 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
                    <th className="py-3 px-4 font-extrabold">Bulan</th>
                    <th className="py-3 px-4 text-center font-extrabold w-[130px]">Jumlah Pekan</th>
                    {gradeLevels.map(grade => (
                      <th key={grade} className="py-3 px-4 text-center font-extrabold w-[100px]">{grade}</th>
                    ))}
                    <th className="py-3 px-4 font-extrabold">Keterangan / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {weeksConfig.map((item, idx) => {
                    return (
                      <tr key={item.month} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/10 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-200">
                          {item.month}
                        </td>
                        <td className="py-2 px-4">
                          <div className="flex items-center justify-center">
                            <input
                              type="number"
                              min="1"
                              max="6"
                              disabled={!canEditCalendar}
                              value={item.totalWeeks}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                setWeeksConfig(prev => prev.map((w, i) => {
                                  if (i !== idx) return w;
                                  const gradeMap = { ...(w.effectiveWeeksByGrade || {}) };
                                  Object.keys(gradeMap).forEach(k => {
                                    gradeMap[k] = Math.min(gradeMap[k], val);
                                  });
                                  return {
                                    ...w,
                                    totalWeeks: val,
                                    effectiveWeeks: Math.min(w.effectiveWeeks, val),
                                    effectiveWeeksByGrade: gradeMap
                                  };
                                }));
                              }}
                              className="w-20 bg-slate-50 dark:bg-zinc-950 disabled:bg-slate-100/50 disabled:text-slate-400 border border-slate-250 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden"
                            />
                          </div>
                        </td>
                        {gradeLevels.map(grade => {
                          const gradeVal = item.effectiveWeeksByGrade?.[grade] ?? item.effectiveWeeks;
                          return (
                            <td key={grade} className="py-2 px-4">
                              <div className="flex items-center justify-center">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.totalWeeks}
                                  disabled={!canEditCalendar}
                                  value={gradeVal}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 0;
                                    const validatedVal = Math.max(0, Math.min(val, item.totalWeeks));
                                    setWeeksConfig(prev => prev.map((w, i) => {
                                      if (i !== idx) return w;
                                      const gradeMap = { ...(w.effectiveWeeksByGrade || {}) };
                                      gradeMap[grade] = validatedVal;
                                      return {
                                        ...w,
                                        effectiveWeeksByGrade: gradeMap,
                                        // Also keep backward compatible default in sync with the first grade level
                                        effectiveWeeks: grade === gradeLevels[0] ? validatedVal : w.effectiveWeeks
                                      };
                                    }));
                                  }}
                                  className="w-20 bg-slate-50 dark:bg-zinc-950 disabled:bg-slate-100/50 disabled:text-slate-400 border border-slate-250 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-center px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden"
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="py-2 px-4">
                          <input
                            type="text"
                            disabled={!canEditCalendar}
                            value={item.notes || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWeeksConfig(prev => prev.map((w, i) => i === idx ? { ...w, notes: val } : w));
                            }}
                            placeholder="Keterangan pekan"
                            className="w-full bg-slate-50 dark:bg-zinc-950 disabled:bg-slate-100/50 disabled:text-slate-400 border border-slate-250 dark:border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-200 focus:outline-hidden"
                          />
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

      <AnimatePresence>
        {isSemesterRangeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-zinc-800">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-blue-500" />
                  Pengaturan Rentang Semester
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSemesterRangeModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSemesterRange} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Tanggal Mulai Semester</label>
                  <input
                    type="date"
                    required
                    value={semesterRangeForm.startDate}
                    onChange={(e) => setSemesterRangeForm({ ...semesterRangeForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Tanggal Selesai Semester</label>
                  <input
                    type="date"
                    required
                    value={semesterRangeForm.endDate}
                    onChange={(e) => setSemesterRangeForm({ ...semesterRangeForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsSemesterRangeModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    <Save className="h-4 w-4" />
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* CUSTOM DELETE CONFIRMATION DIALOG MODAL */}
        {deleteConfirmation.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmation({ isOpen: false, eventId: null })}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-10 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 h-10 w-10 bg-rose-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                    Hapus Agenda
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
                    Apakah Anda yakin ingin menghapus agenda ini secara permanen?{"\n\n"}Data yang dihapus tidak dapat dikembalikan.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-6 border-t border-slate-100 dark:border-zinc-850 pt-4">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmation({ isOpen: false, eventId: null })}
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-xs cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteEventConfirmed}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-500/10 cursor-pointer transition-all"
                >
                  Ya, Hapus Permanen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AcademicCalendar;
