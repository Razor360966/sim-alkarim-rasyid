import React from "react";
import { useQuery } from "@tanstack/react-query";
import { studentService } from "../services/studentService";
import { teacherService } from "../services/teacherService";
import { classService } from "../services/classService";
import { subjectService } from "../services/subjectService";
import { academicYearService } from "../services/academicYearService";
import { supervisionService } from "../services/supervision.service";
import { curriculumMatrixService } from "../services/curriculumMatrixService";
import { curriculumPlanningService } from "../services/curriculumPlanning.service";
import { lessonPlanService } from "../services/lessonPlan.service";
import { teachingJournalService } from "../services/teachingJournalService";
import { scheduleService } from "../services/schedule.service";
import { lessonPeriodService } from "../services/lessonPeriod.service";
import { AcademicSupervision, ManagerialSupervision } from "../types/supervision.types";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { academicPlanningService } from "../services/academicPlanning.service";
import { executiveDashboardService } from "../services/executiveDashboard.service";
import { halaqahGroupService } from "../services/halaqahGroupService";
import { musrifJournalService } from "../services/musrifJournalService";
import { WakasisDashboard } from "../components/dashboard/WakasisDashboard";
import { WakasarprasDashboard } from "../components/dashboard/WakasarprasDashboard";
import { 
  X,
  Users, 
  GraduationCap, 
  DoorClosed, 
  BookOpen, 
  Calendar,
  School,
  Sparkles,
  ArrowRightLeft,
  FileCheck2,
  Award,
  Clock,
  TrendingUp,
  UserCheck,
  CheckCircle,
  Activity,
  Heart,
  ChevronRight,
  BookOpenCheck,
  FileText,
  ExternalLink
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from "recharts";
import { Loading } from "../components/Loading";

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  
  const getGreetingTitle = (): string => {
    if (user?.gender === "P") {
      return "Ustadzah";
    }
    if (user?.gender === "L") {
      return "Ustadz";
    }
    // Fallback heuristic based on name
    const name = (user?.displayName || user?.name || "").toLowerCase();
    if (
      name.includes("ustadzah") ||
      name.includes("ibu") ||
      name.includes("fitri") ||
      name.includes("putri") ||
      name.includes("anisa") ||
      name.includes("annisa") ||
      name.includes("siti") ||
      name.includes("fatimah") ||
      name.includes("aisyah") ||
      name.includes("nur") ||
      name.includes("indah") ||
      name.includes("dewi") ||
      name.endsWith("ah") ||
      name.endsWith("ti") ||
      name.endsWith("ni") ||
      name.endsWith("na")
    ) {
      return "Ustadzah";
    }
    return "Ustadz";
  };

  const navigate = useNavigate();
  const currentRole = user?.role?.toLowerCase() || "";
  const [viewingRole, setViewingRole] = React.useState<string>(currentRole);
  const isExecutive = ["admin", "operator", "ketua_yayasan", "pimpinan", "kepala_sekolah", "wakil kepala sekolah", "wakasis", "wakakur", "wakakurikulum", "wakasarpras"].includes(currentRole);

  const dayNamesId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const todayDayName = dayNamesId[new Date().getDay()];

  const parseTimeToMinutes = (t?: string | null): number | null => {
    if (!t) return null;
    const clean = t.replace(".", ":");
    const parts = clean.split(":").map((v) => parseInt(v, 10));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  // Set viewingRole to currentRole when user's primary role changes
  React.useEffect(() => {
    if (currentRole) {
      setViewingRole(currentRole);
    }
  }, [currentRole]);

  // Seeding initial data for Executive Dashboard collections (Student Character & Sarpras)
  React.useEffect(() => {
    executiveDashboardService.seedInitialDataIfEmpty().catch(console.error);
  }, []);

  const [events, setEvents] = React.useState<any[]>([]);
  React.useEffect(() => {
    academicPlanningService.getCalendarEvents().then(setEvents).catch(console.error);
  }, []);

  const getCategoryStyles = (categoryName: string) => {
    const norm = (categoryName || "").trim().toLowerCase();
    if (norm.includes("akademik")) {
      return {
        bg: "bg-blue-50 dark:bg-blue-950/20",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-900/30",
        color: "#3b82f6",
        label: "Akademik"
      };
    }
    if (norm.includes("penilaian") || norm.includes("asesmen") || norm.includes("pts") || norm.includes("pas") || norm.includes("pat") || norm.includes("ujian")) {
      return {
        bg: "bg-orange-50 dark:bg-orange-950/20",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-900/30",
        color: "#f97316",
        label: "Penilaian"
      };
    }
    if (norm.includes("libur")) {
      return {
        bg: "bg-red-50 dark:bg-red-950/20",
        text: "text-red-700 dark:text-red-300",
        border: "border-red-200 dark:border-red-900/30",
        color: "#ef4444",
        label: "Libur"
      };
    }
    if (norm.includes("kesiswaan")) {
      return {
        bg: "bg-pink-50 dark:bg-pink-950/20",
        text: "text-pink-700 dark:text-pink-300",
        border: "border-pink-200 dark:border-pink-900/30",
        color: "#ec4899",
        label: "Kesiswaan"
      };
    }
    if (norm.includes("guru") || norm.includes("rapat") || norm.includes("workshop")) {
      return {
        bg: "bg-purple-50 dark:bg-purple-950/20",
        text: "text-purple-700 dark:text-purple-300",
        border: "border-purple-200 dark:border-purple-900/30",
        color: "#8b5cf6",
        label: "Guru"
      };
    }
    if (norm.includes("pesantren")) {
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/20",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-900/30",
        color: "#10b981",
        label: "Pesantren"
      };
    }
    if (norm.includes("nasional")) {
      return {
        bg: "bg-gray-50 dark:bg-zinc-850",
        text: "text-gray-700 dark:text-zinc-300",
        border: "border-gray-200 dark:border-zinc-800",
        color: "#6b7280",
        label: "Nasional"
      };
    }
    if (norm.includes("keagamaan") || norm.includes("islam") || norm.includes("raya") || norm.includes("ramadhan")) {
      return {
        bg: "bg-cyan-50 dark:bg-cyan-950/20",
        text: "text-cyan-700 dark:text-cyan-300",
        border: "border-cyan-200 dark:border-cyan-900/30",
        color: "#06b6d4",
        label: "Keagamaan"
      };
    }
    return {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-900/30",
      color: "#f59e0b",
      label: "Lainnya"
    };
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const next7DaysStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  
  const weeklyEvents = events.filter(e => {
    const start = e.startDate || e.date || "";
    const end = e.endDate || e.date || "";
    return (start >= todayStr && start <= next7DaysStr) || (end >= todayStr && end <= next7DaysStr) || (start <= todayStr && end >= next7DaysStr);
  });

  const weeklyPesantrenEvents = weeklyEvents.filter(e => 
    (e.categoryName || "").toLowerCase().includes("pesantren") || 
    (e.categoryId || "").toLowerCase().includes("pesantren") ||
    (e.description || "").toLowerCase().includes("pesantren")
  );

  const upcomingEvents = events.filter(e => (e.startDate || e.date || "") >= todayStr).slice(0, 15);

  // Leadership / Admin Tab and Filter States
  const [activeTab, setActiveTab] = React.useState("summary");
  const [selectedSupTeacherId, setSelectedSupTeacherId] = React.useState("");

  // Drilldown modal for actionable Executive Dashboard indicators
  const [drilldownModal, setDrilldownModal] = React.useState<{
    isOpen: boolean;
    title: string;
    type: "unfilled_journals" | "unfilled_halaqah" | "missing_prota" | "missing_prosem" | "missing_rpp" | "student_violations" | "student_rewards" | "broken_sarpras" | "active_maintenance";
    data: any[];
  }>({
    isOpen: false,
    title: "",
    type: "unfilled_journals",
    data: []
  });

  // Queries
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: studentService.getStudents
  });

  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: teacherService.getTeachers
  });

  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: classService.getClasses
  });

  const { data: subjects = [], isLoading: isLoadingSubjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: subjectService.getSubjects
  });

  const { data: academicYears = [], isLoading: isLoadingYears } = useQuery({
    queryKey: ["academicYears"],
    queryFn: academicYearService.getAcademicYears
  });

  const { data: academicSupervisions = [] } = useQuery<AcademicSupervision[]>({
    queryKey: ["academicSupervisions"],
    queryFn: () => supervisionService.getAcademicSupervisions()
  });

  const { data: managerialSupervisions = [] } = useQuery<ManagerialSupervision[]>({
    queryKey: ["managerialSupervisions"],
    queryFn: () => supervisionService.getManagerialSupervisions()
  });

  const { data: curriculumMatrix = [] } = useQuery({
    queryKey: ["curriculumMatrix"],
    queryFn: curriculumMatrixService.getCurriculumMatrix
  });

  const { data: allAnnualPrograms = [] } = useQuery({
    queryKey: ["allAnnualPrograms"],
    queryFn: curriculumPlanningService.getAllAnnualPrograms
  });

  const { data: allSemesterPrograms = [] } = useQuery({
    queryKey: ["allSemesterPrograms"],
    queryFn: curriculumPlanningService.getAllSemesterPrograms
  });

  const { data: allLessonPlans = [] } = useQuery({
    queryKey: ["allLessonPlans"],
    queryFn: () => lessonPlanService.getLessonPlans()
  });

  const { data: allTeachingJournals = [] } = useQuery({
    queryKey: ["allTeachingJournals"],
    queryFn: () => teachingJournalService.getAll()
  });

  // Jadwal Mengajar: sourced directly from the "schedules" collection written by Admin's Publish Jadwal flow.
  // This is the SAME collection scheduleService/Schedules.tsx (Admin) reads/writes, so it always stays in sync.
  const { data: allSchedules = [] } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => scheduleService.getSchedules()
  });

  const { data: allLessonPeriods = [] } = useQuery({
    queryKey: ["lessonPeriods"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  // --- EXECUTIVE & COMMAND CENTER SPECIFIC QUERIES ---
  const { data: studentViolations = [] } = useQuery({
    queryKey: ["studentViolations"],
    queryFn: () => executiveDashboardService.getViolations(),
    enabled: isExecutive
  });

  const { data: studentRewards = [] } = useQuery({
    queryKey: ["studentRewards"],
    queryFn: () => executiveDashboardService.getRewards(),
    enabled: isExecutive
  });

  const { data: sarprasInventory = [] } = useQuery({
    queryKey: ["sarprasInventory"],
    queryFn: () => executiveDashboardService.getInventory(),
    enabled: isExecutive
  });

  const { data: sarprasMaintenance = [] } = useQuery({
    queryKey: ["sarprasMaintenance"],
    queryFn: () => executiveDashboardService.getMaintenance(),
    enabled: isExecutive
  });

  const { data: allHalaqahGroups = [] } = useQuery({
    queryKey: ["allHalaqahGroupsExecutive"],
    queryFn: () => halaqahGroupService.getGroups(),
    enabled: isExecutive
  });

  const { data: allMusrifJournals = [] } = useQuery({
    queryKey: ["allMusrifJournalsExecutive"],
    queryFn: () => musrifJournalService.getAll(),
    enabled: isExecutive
  });

  // Musrif specific data queries
  const { data: myGroups = [] } = useQuery({
    queryKey: ["myHalaqahGroups", user?.userId],
    queryFn: () => halaqahGroupService.getGroups(user?.userId),
    enabled: (viewingRole === "musrif" || isExecutive) && !!user?.userId
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["allHalaqahMembers"],
    queryFn: () => halaqahGroupService.getAllMembers(),
    enabled: viewingRole === "musrif" || isExecutive
  });

  const { data: myJournals = [] } = useQuery({
    queryKey: ["myMusrifJournals", user?.userId],
    queryFn: () => musrifJournalService.getByMusrif(user?.userId || ""),
    enabled: (viewingRole === "musrif" || isExecutive) && !!user?.userId
  });

  const { data: allJournalDetails = [] } = useQuery({
    queryKey: ["allJournalDetails"],
    queryFn: () => musrifJournalService.getAllJournalDetails(),
    enabled: viewingRole === "musrif" || isExecutive
  });

  // Compute Musrif Stats
  const musrifStats = React.useMemo(() => {
    if (viewingRole !== "musrif") return null;

    const myGroupIds = myGroups.map(g => g.id);
    const myStudentsList = allMembers.filter(m => myGroupIds.includes(m.groupId));
    const totalMyStudents = myStudentsList.length;

    // Mutabaah Hari Ini
    const todayMyJournals = myJournals.filter(j => j.date === todayStr);
    const todayJournalIds = todayMyJournals.map(j => j.id);
    const todayDetails = allJournalDetails.filter(d => todayJournalIds.includes(d.journalId));
    const studentsFilledToday = Array.from(new Set(todayDetails.map(d => d.studentId)));
    const countFilledToday = studentsFilledToday.length;

    // Santri Belum Diisi Hari Ini
    const unfilledStudents = myStudentsList.filter(m => !studentsFilledToday.includes(m.studentId));

    // Ringkasan Perkembangan Santri (Tahsin, Tahfizh, Adab)
    const myStudentsDetails = allJournalDetails.filter(d => myStudentsList.some(s => s.studentId === d.studentId));
    
    let totalTahsinRatings = 0;
    let goodTahsinRatings = 0;
    myStudentsDetails.forEach(d => {
      if (d.tajwid) {
        totalTahsinRatings++;
        if (d.tajwid === "Sangat Baik" || d.tajwid === "Baik") goodTahsinRatings++;
      }
      if (d.makhraj) {
        totalTahsinRatings++;
        if (d.makhraj === "Sangat Baik" || d.makhraj === "Baik") goodTahsinRatings++;
      }
      if (d.fluency) {
        totalTahsinRatings++;
        if (d.fluency === "Sangat Baik" || d.fluency === "Baik") goodTahsinRatings++;
      }
    });
    const tahsinOkPct = totalTahsinRatings > 0 ? Math.round((goodTahsinRatings / totalTahsinRatings) * 100) : 0;

    let totalAdabRatings = 0;
    let goodAdabRatings = 0;
    myStudentsDetails.forEach(d => {
      if (d.behavior) {
        totalAdabRatings++;
        if (d.behavior === "Sangat Baik" || d.behavior === "Baik") goodAdabRatings++;
      }
    });
    const adabOkPct = totalAdabRatings > 0 ? Math.round((goodAdabRatings / totalAdabRatings) * 100) : 0;

    const totalTahfizhSetoran = myStudentsDetails.filter(d => d.memorizationAchievement && d.memorizationAchievement.trim() !== "").length;

    return {
      totalGroups: myGroups.length,
      totalStudents: totalMyStudents,
      myStudentsList,
      countFilledToday,
      unfilledStudents,
      tahsinOkPct,
      adabOkPct,
      totalTahfizhSetoran,
      totalAdabRatings,
      totalTahsinRatings
    };
  }, [viewingRole, myGroups, allMembers, myJournals, allJournalDetails, todayStr]);

  const isLoading = isLoadingStudents || isLoadingTeachers || isLoadingClasses || isLoadingSubjects || isLoadingYears;

  // Aggregate stats
  const totalStudents = students.length;
  const totalTeachers = teachers.length;
  const totalClasses = classes.length;
  const totalSubjects = subjects.length;

  // Chart 1: Students distribution by Grade
  const gradeData = React.useMemo(() => {
    const grades = { "Grade 7": 0, "Grade 8": 0, "Grade 9": 0, "Belum Diatur": 0 };
    students.forEach(s => {
      const cls = classes.find(c => c.id === s.classId);
      if (cls) {
        if (cls.grade === "7") grades["Grade 7"]++;
        else if (cls.grade === "8") grades["Grade 8"]++;
        else if (cls.grade === "9") grades["Grade 9"]++;
      } else {
        grades["Belum Diatur"]++;
      }
    });
    return [
      { name: "Kelas 7", Siswa: grades["Grade 7"] },
      { name: "Kelas 8", Siswa: grades["Grade 8"] },
      { name: "Kelas 9", Siswa: grades["Grade 9"] },
      { name: "Tanpa Kelas", Siswa: grades["Belum Diatur"] }
    ];
  }, [students, classes]);

  // Chart 2: Teacher status distribution (Aktif / Nonaktif)
  const COLORS = ["#10b981", "#ef4444"];
  const teacherStatusData = React.useMemo(() => {
    const counts: Record<string, number> = { "Aktif": 0, "Nonaktif": 0 };
    teachers.forEach(t => {
      const label = t.status ? "Aktif" : "Nonaktif";
      counts[label]++;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [teachers]);

  const teacherId = user?.teacherId || "";

  // Real journal entries belonging to the logged-in teacher (used to replace the old hardcoded "24 Entri").
  const myTeacherJournals = React.useMemo(() => {
    if (!teacherId) return [];
    return allTeachingJournals.filter((j: any) => j.teacherId === teacherId || j.createdBy === teacherId);
  }, [allTeachingJournals, teacherId]);

  // Teacher's schedule for TODAY, taken only from published Schedule docs (Admin's "schedules" collection).
  // No mock/sample/dummy/fallback/random agenda is generated here — if there is nothing for this
  // teacherId + today's day, the list is simply empty and the UI shows "Tidak ada jadwal mengajar hari ini."
  const teacherTodaySchedules = React.useMemo(() => {
    if (!teacherId) return [];

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
    const todayStr = new Date().toISOString().split("T")[0];

    return allSchedules
      .filter((s: any) => s.teacherId === teacherId && (s.day || "").toLowerCase() === todayDayName.toLowerCase())
      .map((s: any) => {
        const period = allLessonPeriods.find((p: any) =>
          (s.lessonPeriodId && p.id === s.lessonPeriodId) ||
          ((p.day || "").toLowerCase() === (s.day || "").toLowerCase() && p.sequence === s.sequence)
        );

        const startTime = period?.startTime || "";
        const endTime = period?.endTime || "";
        const startMin = parseTimeToMinutes(startTime);
        const endMin = parseTimeToMinutes(endTime);

        // Check if journal has been filled for this schedule slot today
        const hasJournalToday = myTeacherJournals.some((j: any) => 
          j.date === todayStr &&
          j.classId === s.classId &&
          j.subjectId === s.subjectId &&
          (j.lessonPeriodIds?.includes(s.lessonPeriodId) || j.lessonPeriods?.includes(period?.title))
        );

        let status = "Belum Mulai";
        if (hasJournalToday) {
          status = "Jurnal Sudah Diisi";
        } else if (startMin !== null && endMin !== null) {
          if (nowMinutes >= endMin) {
            status = "Belum Mengisi Jurnal";
          } else if (nowMinutes >= startMin && nowMinutes < endMin) {
            status = "Sedang Berjalan";
          }
        }

        return {
          id: s.id,
          sequence: s.sequence,
          time: startTime && endTime ? `${startTime} - ${endTime}` : (period?.title || ""),
          subject: s.subjectName || "-",
          className: s.className || "-",
          room: s.room || period?.title || "",
          status
        };
      })
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }, [allSchedules, allLessonPeriods, teacherId, todayDayName, myTeacherJournals]);

  // Calculate teacher planning progress indicators
  const teacherAssignments = React.useMemo(() => {
    if (!teacherId) return [];
    const list: { subjectId: string; subjectName: string; classId: string; className: string }[] = [];
    
    curriculumMatrix.forEach((m: any) => {
      const isTeacherVii = (m.useDifferentTeachers ? m.teacherId_vii === teacherId : m.teacherId === teacherId) && m.jp_vii > 0;
      const isTeacherViii = (m.useDifferentTeachers ? m.teacherId_viii === teacherId : m.teacherId === teacherId) && m.jp_viii > 0;
      const isTeacherIx = (m.useDifferentTeachers ? m.teacherId_ix === teacherId : m.teacherId === teacherId) && m.jp_ix > 0;

      classes.forEach((c) => {
        if (c.status === "Aktif" && !c.isDeleted) {
          if (c.gradeLevel === "VII" && isTeacherVii) {
            list.push({ subjectId: m.subjectId, subjectName: m.subjectName, classId: c.id, className: c.name });
          } else if (c.gradeLevel === "VIII" && isTeacherViii) {
            list.push({ subjectId: m.subjectId, subjectName: m.subjectName, classId: c.id, className: c.name });
          } else if (c.gradeLevel === "IX" && isTeacherIx) {
            list.push({ subjectId: m.subjectId, subjectName: m.subjectName, classId: c.id, className: c.name });
          }
        }
      });
    });

    return list;
  }, [curriculumMatrix, classes, teacherId]);

  const teacherProgress = React.useMemo(() => {
    if (teacherAssignments.length === 0) {
      return { protaPct: 100, prosemPct: 100, lessonPlanPct: 100, overall: 100, requiredCount: 0, protaCount: 0, prosemCount: 0, lessonPlanCount: 0 };
    }

    let protaCount = 0;
    let prosemCount = 0;
    let lessonPlanCount = 0;

    teacherAssignments.forEach((assign) => {
      const hasProta = allAnnualPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.topics && p.topics.length > 0);
      if (hasProta) protaCount++;

      const hasProsem = allSemesterPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.allocations && p.allocations.length > 0);
      if (hasProsem) prosemCount++;

      const hasLessonPlan = allLessonPlans.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId);
      if (hasLessonPlan) lessonPlanCount++;
    });

    const protaPct = Math.min(100, Math.round((protaCount / teacherAssignments.length) * 100));
    const prosemPct = Math.min(100, Math.round((prosemCount / teacherAssignments.length) * 100));
    const lessonPlanPct = Math.min(100, Math.round((lessonPlanCount / teacherAssignments.length) * 100));
    const overall = Math.round((protaPct + prosemPct + lessonPlanPct) / 3);

    return {
      protaPct,
      prosemPct,
      lessonPlanPct,
      overall,
      requiredCount: teacherAssignments.length,
      protaCount,
      prosemCount,
      lessonPlanCount
    };
  }, [teacherAssignments, allAnnualPrograms, allSemesterPrograms, allLessonPlans]);

  // Pre-calculate statistics/monitoring lists for all active teachers
  const teachersPlanningData = React.useMemo(() => {
    return teachers
      .filter(t => t.status && !t.isDeleted)
      .map((t) => {
        // Find this teacher's assignments
        const assignments: { subjectId: string; subjectName: string; classId: string; className: string }[] = [];
        curriculumMatrix.forEach((m: any) => {
          const isTeacherVii = (m.useDifferentTeachers ? m.teacherId_vii === t.id : m.teacherId === t.id) && m.jp_vii > 0;
          const isTeacherViii = (m.useDifferentTeachers ? m.teacherId_viii === t.id : m.teacherId === t.id) && m.jp_viii > 0;
          const isTeacherIx = (m.useDifferentTeachers ? m.teacherId_ix === t.id : m.teacherId === t.id) && m.jp_ix > 0;

          classes.forEach((c) => {
            if (c.status === "Aktif" && !c.isDeleted) {
              if (c.gradeLevel === "VII" && isTeacherVii) {
                assignments.push({ subjectId: m.subjectId, subjectName: m.subjectName, classId: c.id, className: c.name });
              } else if (c.gradeLevel === "VIII" && isTeacherViii) {
                assignments.push({ subjectId: m.subjectId, subjectName: m.subjectName, classId: c.id, className: c.name });
              } else if (c.gradeLevel === "IX" && isTeacherIx) {
                assignments.push({ subjectId: m.subjectId, subjectName: m.subjectName, classId: c.id, className: c.name });
              }
            }
          });
        });

        // Compute completions
        let totalJp = 0;
        if (t.customJpOverride !== undefined && t.customJpOverride !== null && (t.customJpOverride as any) !== "") {
          const num = parseInt(t.customJpOverride as any, 10);
          if (!isNaN(num)) {
            totalJp = num;
          }
        }

        if (totalJp === 0) {
          // Fallback to calculated from curriculum matrix sum
          curriculumMatrix.forEach((m: any) => {
            if (m.useDifferentTeachers) {
              if (m.teacherId_vii === t.id && m.jp_vii > 0) totalJp += m.jp_vii;
              if (m.teacherId_viii === t.id && m.jp_viii > 0) totalJp += m.jp_viii;
              if (m.teacherId_ix === t.id && m.jp_ix > 0) totalJp += m.jp_ix;
            } else {
              if (m.teacherId === t.id) {
                totalJp += (m.jp_vii || 0) + (m.jp_viii || 0) + (m.jp_ix || 0);
              }
            }
          });
        }

        let protaCount = 0;
        let prosemCount = 0;
        let lessonPlanCount = 0;

        assignments.forEach((assign) => {
          const hasProta = allAnnualPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.topics && p.topics.length > 0);
          if (hasProta) protaCount++;

          const hasProsem = allSemesterPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.allocations && p.allocations.length > 0);
          if (hasProsem) prosemCount++;

          const hasLessonPlan = allLessonPlans.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId);
          if (hasLessonPlan) lessonPlanCount++;
        });

        const totalRequired = assignments.length;
        const protaPct = totalRequired > 0 ? Math.round((protaCount / totalRequired) * 100) : 0;
        const prosemPct = totalRequired > 0 ? Math.round((prosemCount / totalRequired) * 100) : 0;
        const lessonPlanPct = totalRequired > 0 ? Math.round((lessonPlanCount / totalRequired) * 100) : 0;

        // Teaching journals count
        const teacherJournals = allTeachingJournals.filter((j: any) => j.teacherId === t.id || j.createdBy === t.id);
        const journalCount = teacherJournals.length;

        // E-Rapor Kinerja Score calculation:
        // Prota = 25%, Prosem = 25%, Modul Ajar Link = 25%, Jurnal Consistency = 25% (up to 5 journals max score)
        const protaScore = totalRequired > 0 ? (protaCount / totalRequired) * 25 : 25;
        const prosemScore = totalRequired > 0 ? (prosemCount / totalRequired) * 25 : 25;
        const lessonPlanScore = totalRequired > 0 ? (lessonPlanCount / totalRequired) * 25 : 25;
        const journalScore = Math.min(25, (journalCount / 5) * 25);

        const performanceScore = Math.round(protaScore + prosemScore + lessonPlanScore + journalScore);

        let performanceLabel = "Perlu Pembinaan";
        let performanceColor = "text-rose-600 bg-rose-50 dark:bg-rose-950/20";
        if (performanceScore >= 90) {
          performanceLabel = "Sangat Baik";
          performanceColor = "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-250";
        } else if (performanceScore >= 80) {
          performanceLabel = "Baik";
          performanceColor = "text-blue-700 bg-blue-50 dark:bg-blue-950/20 border-blue-250";
        } else if (performanceScore >= 70) {
          performanceLabel = "Cukup";
          performanceColor = "text-amber-700 bg-amber-50 dark:bg-amber-950/20 border-amber-250";
        }

        return {
          teacher: t,
          assignments,
          totalRequired,
          totalJp,
          protaCount,
          prosemCount,
          lessonPlanCount,
          protaPct,
          prosemPct,
          lessonPlanPct,
          journalCount,
          journals: teacherJournals,
          performanceScore,
          performanceLabel,
          performanceColor
        };
      });
  }, [teachers, classes, curriculumMatrix, allAnnualPrograms, allSemesterPrograms, allLessonPlans, allTeachingJournals]);

  // --- COMMAND CENTER MEMOIZED ACTIONABLE STATS ---
  const unfilledJournalsToday = React.useMemo(() => {
    const todaySchedules = allSchedules.filter((s: any) => (s.day || "").toLowerCase() === todayDayName.toLowerCase());
    return todaySchedules.map((s: any) => {
      const period = allLessonPeriods.find((p: any) =>
        (s.lessonPeriodId && p.id === s.lessonPeriodId) ||
        ((p.day || "").toLowerCase() === (s.day || "").toLowerCase() && p.sequence === s.sequence)
      );
      const hasJournalToday = allTeachingJournals.some((j: any) => 
        j.date === todayStr &&
        j.classId === s.classId &&
        j.subjectId === s.subjectId &&
        (j.lessonPeriodIds?.includes(s.lessonPeriodId) || j.lessonPeriods?.includes(period?.title))
      );
      return {
        schedule: s,
        period,
        hasJournalToday
      };
    }).filter(item => !item.hasJournalToday);
  }, [allSchedules, allLessonPeriods, allTeachingJournals, todayDayName, todayStr]);

  const unfilledHalaqahToday = React.useMemo(() => {
    const groupsToProcess = isExecutive ? allHalaqahGroups : myGroups;
    return groupsToProcess.map((g: any) => {
      const hasJournalToday = (isExecutive ? allMusrifJournals : myJournals).some((j: any) => 
        j.date === todayStr && j.groupId === g.id
      );
      return {
        group: g,
        hasJournalToday
      };
    }).filter(item => !item.hasJournalToday);
  }, [allHalaqahGroups, myGroups, allMusrifJournals, myJournals, isExecutive, todayStr]);

  const missingProtaList = React.useMemo(() => {
    const list: any[] = [];
    teachersPlanningData.forEach(tData => {
      tData.assignments.forEach((assign: any) => {
        const hasProta = allAnnualPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.topics && p.topics.length > 0);
        if (!hasProta) {
          list.push({
            teacherName: tData.teacher.name,
            className: assign.className,
            subjectName: assign.subjectName
          });
        }
      });
    });
    return list;
  }, [teachersPlanningData, allAnnualPrograms]);

  const missingProsemList = React.useMemo(() => {
    const list: any[] = [];
    teachersPlanningData.forEach(tData => {
      tData.assignments.forEach((assign: any) => {
        const hasProsem = allSemesterPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.allocations && p.allocations.length > 0);
        if (!hasProsem) {
          list.push({
            teacherName: tData.teacher.name,
            className: assign.className,
            subjectName: assign.subjectName
          });
        }
      });
    });
    return list;
  }, [teachersPlanningData, allSemesterPrograms]);

  const missingRppList = React.useMemo(() => {
    const list: any[] = [];
    teachersPlanningData.forEach(tData => {
      tData.assignments.forEach((assign: any) => {
        const hasLessonPlan = allLessonPlans.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId);
        if (!hasLessonPlan) {
          list.push({
            teacherName: tData.teacher.name,
            className: assign.className,
            subjectName: assign.subjectName
          });
        }
      });
    });
    return list;
  }, [teachersPlanningData, allLessonPlans]);

  // Real performance score/label for the logged-in teacher (replaces the old hardcoded "87.5 / 100 Sangat Baik").
  const myPerformance = teachersPlanningData.find((t) => t.teacher.id === teacherId) || null;

  // Real average managerial-supervision score for the logged-in Musrif (replaces the old hardcoded "85.2 / 100 Baik").
  const myManagerialScores = managerialSupervisions
    .filter((s) => (s.staffId === teacherId || s.teacherId === teacherId) && s.status === "Selesai" && (s.score || 0) > 0)
    .map((s) => s.score || 0);
  const myManagerialAvgScore = myManagerialScores.length > 0
    ? Number((myManagerialScores.reduce((a, b) => a + b, 0) / myManagerialScores.length).toFixed(1))
    : 0;
  let myManagerialLabel = "Belum Ada Data";
  if (myManagerialScores.length > 0) {
    if (myManagerialAvgScore >= 90) myManagerialLabel = "Sangat Baik";
    else if (myManagerialAvgScore >= 80) myManagerialLabel = "Baik";
    else if (myManagerialAvgScore >= 70) myManagerialLabel = "Cukup";
    else myManagerialLabel = "Perlu Pembinaan";
  }

  if (isLoading) {
    return <Loading variant="full" text="Menyinkronkan data ekosistem sekolah..." />;
  }

  // Helper calculations for role-based Supervision sections
  
  // A. Guru
  const nextAcademicSupervision = academicSupervisions.filter(s => s.teacherId === teacherId && (s.status === "Terjadwal" || s.status === "Sedang Berlangsung")).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
  const latestCompletedAcademic = academicSupervisions.filter(s => s.teacherId === teacherId && s.status === "Selesai").sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0] || null;

  // B. Musrif
  const nextManagerialSupervision = managerialSupervisions.filter(s => (s.staffId === teacherId || s.teacherId === teacherId) && (s.status === "Terjadwal" || s.status === "Sedang Berlangsung")).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] || null;
  const latestCompletedManagerial = managerialSupervisions.filter(s => (s.staffId === teacherId || s.teacherId === teacherId) && s.status === "Selesai").sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0] || null;

  // C. Kepala Sekolah & Ketua Yayasan
  const totalAcademic = academicSupervisions.length;
  const completedAcademic = academicSupervisions.filter(s => s.status === "Selesai");
  const totalManagerial = managerialSupervisions.length;
  const completedManagerial = managerialSupervisions.filter(s => s.status === "Selesai");

  const totalSupervisions = totalAcademic + totalManagerial;
  const completedSupervisions = completedAcademic.length + completedManagerial.length;
  const supervisionPercentage = totalSupervisions > 0 ? Math.round((completedSupervisions / totalSupervisions) * 100) : 0;

  const academicScores = completedAcademic.map(s => s.score || 0).filter(score => score > 0);
  const managerialScores = completedManagerial.map(s => s.score || 0).filter(score => score > 0);
  const allScores = [...academicScores, ...managerialScores];
  const averageSupervisionScore = allScores.length > 0 ? Number((allScores.reduce((sum, s) => sum + s, 0) / allScores.length).toFixed(1)) : 0;

  const urgentSupervisions = [
    ...academicSupervisions.filter(s => s.status !== "Selesai").map(s => ({ ...s, type: "Akademik" })),
    ...managerialSupervisions.filter(s => s.status !== "Selesai").map(s => ({ ...s, type: "Manajerial" }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);

  // ==========================================
  // 1. GURU DASHBOARD VIEW
  // ==========================================

  const wrapWithSwitcher = (content: React.ReactNode) => {
    if (!isExecutive) return content;
    return (
      <div className="space-y-6">
        {/* Executive View Selector */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" /> Executive Portal Control Center
            </h4>
            <p className="text-[11px] text-slate-400 dark:text-zinc-550">
              Anda masuk sebagai <strong className="text-slate-700 dark:text-white">{user?.displayName} ({user?.role})</strong>. Memantau seluruh ekosistem sekolah & pondok secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-zinc-950 p-1.5 rounded-2xl border border-slate-150 dark:border-zinc-800 w-full md:w-auto">
            {[
              { role: "ketua_yayasan", label: "Ketua Yayasan" },
              { role: "kepala_sekolah", label: "Kepala Sekolah" },
              { role: "wakakur", label: "Waka Kurikulum" },
              { role: "wakasis", label: "Waka Kesiswaan" },
              { role: "wakasarpras", label: "Waka Sarpras" },
              { role: "musrif", label: "Musrif / Asrama" },
              { role: "guru", label: "Guru / Personal" }
            ].map((item) => (
              <button
                key={item.role}
                onClick={() => {
                  if (item.role === "wakakur") {
                    setViewingRole("kepala_sekolah"); // map to kepsek dashboard
                    setActiveTab("monitoring"); // set default tab to curriculum monitoring
                  } else {
                    setViewingRole(item.role);
                    if (item.role === "kepala_sekolah") {
                      setActiveTab("summary");
                    }
                  }
                }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  viewingRole === item.role || (item.role === "wakakur" && viewingRole === "kepala_sekolah" && activeTab === "monitoring")
                    ? "bg-indigo-600 text-white dark:bg-white dark:text-zinc-900 shadow-xs font-black"
                    : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {content}
      </div>
    );
  };

  if (viewingRole === "wakasis") {
    return wrapWithSwitcher(<WakasisDashboard />);
  }

  if (viewingRole === "wakasarpras") {
    return wrapWithSwitcher(<WakasarprasDashboard />);
  }

  if (viewingRole === "guru") {
    return wrapWithSwitcher(
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-700 to-cyan-800 text-white rounded-3xl p-8 shadow-lg border border-emerald-500/10">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <School className="h-44 w-44" />
          </div>
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span>Dashboard Personal Asatidzah</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ahlan Wa Sahlan, {getGreetingTitle()} {user?.displayName}!
            </h1>
            <p className="text-sm text-emerald-50 leading-relaxed font-light">
              SMP Alkarim Rasyid berkomitmen untuk terus meningkatkan mutu pendidikan Islami terpadu. Pantau terus jurnal harian, agenda mengajar, dan rapor kinerja akademik Anda secara real-time.
            </p>
          </div>
        </div>

        {/* Stats Bento Grid for Guru */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Jumlah Jurnal */}
          <Link to="/teaching-journals" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md hover:border-emerald-500/30 transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <BookOpenCheck className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Jurnal Mengajar</p>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5">{myTeacherJournals.length} Entri</h3>
              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded mt-1 inline-block">
                {myTeacherJournals.length > 0
                  ? `${Array.from(new Set(myTeacherJournals.map((j: any) => j.className))).length} Kelas Terisi`
                  : "Belum ada entri"}
              </span>
            </div>
          </Link>

          {/* Jadwal Hari Ini */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Clock className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Jadwal Hari Ini</p>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5">{teacherTodaySchedules.length} Jam (JP)</h3>
              <span className="text-[9px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded mt-1 inline-block">
                {teacherTodaySchedules.length > 0
                  ? Array.from(new Set(teacherTodaySchedules.map(j => j.className))).join(" & ")
                  : "Tidak ada jadwal"}
              </span>
            </div>
          </div>

          {/* Pengembangan Diri */}
          <Link to="/gtk-development" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md hover:border-indigo-500/30 transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Pengembangan</p>
              {/* No GTK development-hours service is wired up yet — show real 0 instead of a fabricated sample value */}
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5">0 Jam JP</h3>
              <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded mt-1 inline-block">Belum ada sertifikat</span>
            </div>
          </Link>

          {/* Nilai Rapor Kinerja */}
          <Link to="/sdm-performance" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md hover:border-amber-500/30 transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Award className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Kinerja Saya</p>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5">{myPerformance ? myPerformance.performanceScore : 0} / 100</h3>
              <span className="text-[9px] text-amber-600 font-extrabold bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded mt-1 inline-block uppercase">
                {myPerformance ? myPerformance.performanceLabel : "Belum Ada Data"}
              </span>
            </div>
          </Link>

          {/* Mutaba'ah */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <Heart className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Mutaba'ah</p>
              {/* No mutaba'ah-yaumiyah tracking service is wired up yet — show real 0% instead of a fabricated sample value */}
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-white mt-0.5">0% Target</h3>
              <span className="text-[9px] text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-1.5 py-0.5 rounded mt-1 inline-block">Belum ada data</span>
            </div>
          </div>
        </div>

        {/* Guru Planning Progress Indicator Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-150 dark:border-zinc-800 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-1.5 uppercase tracking-wide">
                <FileCheck2 className="h-4.5 w-4.5 text-emerald-500" />
                Progres Kesiapan Perencanaan Mengajar
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Akumulasi kelengkapan administrasi program tahunan, semester, dan modul ajar Anda.</p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-slate-400">Total Kesiapan:</span>
              <div className="flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-mono text-sm font-extrabold border border-emerald-100 dark:border-emerald-900/30">
                {teacherProgress.overall}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Prota */}
            <div className="bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-zinc-300">Program Tahunan (Prota)</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{teacherProgress.protaPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200/60 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${teacherProgress.protaPct}%` }} />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Mapel Terpenuhi</span>
                <span>{teacherProgress.protaCount} / {teacherProgress.requiredCount}</span>
              </div>
            </div>

            {/* Prosem */}
            <div className="bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-zinc-300">Program Semester (Prosem)</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{teacherProgress.prosemPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200/60 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${teacherProgress.prosemPct}%` }} />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Mapel Terpenuhi</span>
                <span>{teacherProgress.prosemCount} / {teacherProgress.requiredCount}</span>
              </div>
            </div>

            {/* Modul Ajar */}
            <div className="bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 p-4 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 dark:text-zinc-300">Modul Ajar (Link Ref)</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{teacherProgress.lessonPlanPct}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200/60 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${teacherProgress.lessonPlanPct}%` }} />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Link Terunggah</span>
                <span>{teacherProgress.lessonPlanCount} / {teacherProgress.requiredCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Jadwal Pelajaran Hari Ini */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Agenda & Jadwal Mengajar Hari Ini</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Daftar kelas yang harus Anda ampu pada hari efektif ini</p>
                </div>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-full">{todayDayName} Efektif</span>
              </div>

              <div className="space-y-3">
                {teacherTodaySchedules.length === 0 ? (
                  <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400 font-medium">
                    Tidak ada jadwal mengajar hari ini.
                  </div>
                ) : (
                  teacherTodaySchedules.map((j, i) => (
                    <div 
                      key={j.id || i} 
                      onClick={() => navigate(`/teaching-journals?prefillDate=${new Date().toISOString().split("T")[0]}&prefillScheduleId=${j.id}&openForm=true`)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/60 border border-slate-100 hover:border-indigo-150 dark:border-zinc-850 dark:hover:border-zinc-750 rounded-2xl gap-3 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-mono text-xs font-bold shrink-0 group-hover:bg-indigo-50 dark:group-hover:bg-zinc-800 transition-colors">
                          {i + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-blue-400 transition-colors">{j.subject}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded">{j.className}</span>
                            {j.room && <span className="text-[10px] font-medium text-slate-400">{j.room}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{j.time}</span>
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                          j.status === "Jurnal Sudah Diisi"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                            : j.status === "Sedang Berjalan"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30 animate-pulse"
                            : j.status === "Belum Mengisi Jurnal"
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 font-black"
                            : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                        }`}>{j.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Agenda Akademik Pekan Ini */}
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Agenda Akademik Pekan Ini</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Daftar agenda sekolah selama satu pekan ke depan</p>
                </div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900/30">
                  Terintegrasi Timeline
                </span>
              </div>

              {weeklyEvents.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400 font-medium">
                  Tidak ada agenda akademik dalam pekan ini.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {weeklyEvents.map((evt, idx) => {
                    const styles = getCategoryStyles(evt.categoryName || evt.categoryId);
                    return (
                      <div key={idx} className="flex gap-3 p-3.5 bg-slate-50 dark:bg-zinc-800/45 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                        <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: styles.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${styles.bg} ${styles.text} ${styles.border}`}>
                              {evt.categoryName || "Kegiatan"}
                            </span>
                            <span className="text-[9px] font-mono font-medium text-slate-400 shrink-0">
                              {evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} s/d ${evt.endDate}`}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1.5 truncate">{evt.title}</h4>
                          {evt.description && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{evt.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <Link to="/teaching-journals" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
                Isi Jurnal Mengajar Harian <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Right side widgets: Mutabaah & Gtk info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Poin Mutaba'ah Yaumiyah</h3>
              </div>
              {/* No mutaba'ah-yaumiyah tracking service is wired up yet — show an honest empty state
                  instead of a fabricated sample checklist with fake percentages. */}
              <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Belum ada data Mutaba'ah Yaumiyah.
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Supervisi & RTL Saya</h3>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase bg-blue-50/70 dark:bg-blue-950/20 px-2 py-0.5 rounded-md">
                  OTOMATIS
                </span>
              </div>

              {nextAcademicSupervision ? (
                <div className="mb-4 p-4 bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span>Jadwal Supervisi Terdekat</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600 dark:text-zinc-350">
                    <div><span className="text-slate-400 font-medium">Tanggal:</span> <strong>{new Date(nextAcademicSupervision.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong></div>
                    <div><span className="text-slate-400 font-medium">Supervisor:</span> <strong>{nextAcademicSupervision.supervisorName}</strong></div>
                    <div><span className="text-slate-400 font-medium">Instrumen:</span> <strong>{nextAcademicSupervision.instrumentName}</strong></div>
                  </div>
                  <Link
                    to="/supervision-academic"
                    className="block text-center text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-xl mt-2 transition-colors"
                  >
                    Lihat Lembar Penilaian
                  </Link>
                </div>
              ) : (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400">
                  Belum ada jadwal supervisi terdekat.
                </div>
              )}

              {latestCompletedAcademic ? (
                <div className="p-4 bg-emerald-50/45 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span>Hasil Supervisi Terakhir</span>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      {latestCompletedAcademic.score}
                    </span>
                  </div>
                  
                  {latestCompletedAcademic.rtlText && (
                    <div className="text-xs space-y-1.5 border-t border-slate-200/50 dark:border-zinc-800/50 pt-2">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Rencana Tindak Lanjut (RTL):</div>
                      <p className="italic text-slate-605 dark:text-zinc-300 font-medium bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                        "{latestCompletedAcademic.rtlText}"
                      </p>
                      <div className="flex justify-between items-center text-[10px] mt-1">
                        <span className="text-slate-400 font-medium">Status RTL:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${
                          latestCompletedAcademic.rtlStatus === "Sudah Dilaksanakan"
                            ? "bg-emerald-100 text-emerald-850 dark:bg-emerald-900/35 dark:text-emerald-300"
                            : latestCompletedAcademic.rtlStatus === "Sedang Dilaksanakan"
                            ? "bg-blue-100 text-blue-850 dark:bg-blue-900/35 dark:text-blue-300"
                            : "bg-amber-100 text-amber-850 dark:bg-amber-900/35 dark:text-amber-300"
                        }`}>
                          {latestCompletedAcademic.rtlStatus || "Belum Dilaksanakan"}
                        </span>
                      </div>
                    </div>
                  )}
                  <Link
                    to="/supervision-academic"
                    className="block text-center text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl mt-1 transition-colors"
                  >
                    Kelola RTL & Bukti
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">Informasi GTK & Sertifikasi</h3>
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-600" /> Profil SDM Sinkron
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                  Data kepegawaian Anda telah terhubung ke modul master data SDM atas nama: <strong>{user?.displayName}</strong>. Seluruh akumulasi jam mengajar akan disinkronisasikan otomatis ke E-Rapor Kinerja.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. MUSRIF DASHBOARD VIEW
  // ==========================================
  if (viewingRole === "musrif") {
    const totalMyGroups = musrifStats?.totalGroups || 0;
    const totalMyStudents = musrifStats?.totalStudents || 0;
    const countFilledToday = musrifStats?.countFilledToday || 0;
    const unfilledStudents = musrifStats?.unfilledStudents || [];
    const todayEvents = events.filter(e => {
      const start = e.startDate || e.date || "";
      const end = e.endDate || e.date || "";
      return todayStr >= start && todayStr <= end;
    });

    const fillPercentage = totalMyStudents > 0 ? Math.round((countFilledToday / totalMyStudents) * 100) : 0;

    return wrapWithSwitcher(
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 text-white rounded-3xl p-8 shadow-lg border border-blue-500/10">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <School className="h-44 w-44" />
          </div>
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span>Pusat Aktivitas Musrif & Pembina Asrama</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ahlan Wa Sahlan, {getGreetingTitle()} {user?.displayName}!
            </h1>
            <p className="text-sm text-blue-50 leading-relaxed font-light">
              Selamat datang di Dashboard Operasional Halaqah Anda. Kelola mutabaah harian, evaluasi tahfidz, tahsin, serta pantau agenda harian santri asuhan Anda secara terpusat.
            </p>
          </div>
        </div>

        {/* Stats Bento Grid for Musrif */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Kelompok Halaqah */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <School className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Kelompok Halaqah</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">
                {totalMyGroups} {totalMyGroups > 0 ? "Kelompok" : "Belum Ditugaskan"}
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                {myGroups.map(g => g.groupName).join(", ") || "Belum ada kelompok binaan"}
              </p>
            </div>
          </div>

          {/* Santri Binaan */}
          <Link to="/musrif-journals?tab=kelompok" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md hover:border-indigo-500/30 transition-all shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Santri Binaan</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{totalMyStudents} Santri</h3>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-1 hover:underline">Kelola Kelompok &rarr;</p>
            </div>
          </Link>

          {/* Mutabaah Hari Ini */}
          <Link to="/musrif-journals?tab=jurnal" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md hover:border-purple-500/30 transition-all shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <BookOpenCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Mutaba'ah Hari Ini</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">{countFilledToday} / {totalMyStudents}</h3>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1.5 w-16 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${fillPercentage}%` }} />
                </div>
                <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400">{fillPercentage}%</span>
              </div>
            </div>
          </Link>

          {/* Kepatuhan Ruhiyah Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-12 w-12 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Kepatuhan Ruhiyah</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-1">
                {musrifStats && musrifStats.totalAdabRatings > 0 ? `${musrifStats.adabOkPct}%` : "-"}
              </h3>
              <p className="text-[9px] text-slate-500 font-medium mt-1">
                {musrifStats && musrifStats.totalAdabRatings > 0 ? "Sikap adab/akhlak santri binaan" : "Belum ada inputan adab"}
              </p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN: Operational Status, Agenda & Unfilled Students */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Mutabaah & Jurnal Harian Tracker */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Mutaba'ah & Jurnal Harian</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Daftar santri yang belum memperoleh input perkembangan/mutaba'ah hari ini</p>
                </div>
                <Link
                  to="/musrif-journals?tab=jurnal"
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer text-center"
                >
                  Buka Jurnal & Input Mutaba'ah
                </Link>
              </div>

              {unfilledStudents.length === 0 ? (
                <div className="p-8 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/30 dark:border-emerald-900/30 rounded-2xl text-center flex flex-col items-center justify-center space-y-2">
                  <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400 animate-bounce" />
                  <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-400">Alhamdulillah, Tugas Selesai!</h4>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed max-w-sm">
                    Seluruh {totalMyStudents} santri binaan Anda sudah diisi mutaba'ah hari ini ({new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-900/30">
                      Perlu Diisi ({unfilledStudents.length} Santri)
                    </span>
                    <span className="text-[10px] text-slate-400">Mutaba'ah Tanggal: {todayStr}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {unfilledStudents.slice(0, 12).map((member, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-850 rounded-2xl flex flex-col justify-between hover:shadow-xs transition-shadow">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{member.studentName}</span>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-200/40 dark:border-zinc-800/40 text-[9px] text-slate-400">
                          <span>{member.className || "Tanpa Kelas"}</span>
                          <Link to="/musrif-journals?tab=jurnal" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Isi &rarr;</Link>
                        </div>
                      </div>
                    ))}
                    {unfilledStudents.length > 12 && (
                      <Link to="/musrif-journals?tab=jurnal" className="p-3 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800/30 dark:hover:bg-zinc-800/50 border border-slate-100 dark:border-zinc-850 rounded-2xl flex items-center justify-center font-bold text-xs text-blue-600 dark:text-blue-400 cursor-pointer">
                        + {unfilledStudents.length - 12} Santri Lainnya
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Ringkasan Perkembangan Santri (Tahsin, Tahfizh, Adab) */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Rangkuman Perkembangan Santri Binaan</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Analitik kumulatif dari pencapaian halaqah bimbingan Anda</p>
                </div>
                <Link
                  to="/musrif-journals?tab=rekap"
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  Detail Rekap Santri &rarr;
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Tahfizh Widget */}
                <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/5 border border-slate-100 dark:border-zinc-850 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">I. Tahfizh</span>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-3xl font-black text-slate-800 dark:text-white">{musrifStats?.totalTahfizhSetoran || 0}</h3>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">Total setoran hafalan tercatat selama semester ini</p>
                  </div>
                </div>

                {/* Tahsin Widget */}
                <div className="p-4 bg-blue-50/20 dark:bg-blue-950/5 border border-slate-100 dark:border-zinc-850 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800 dark:text-blue-400">II. Tahsin</span>
                    <Activity className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-800 dark:text-white">
                      {musrifStats && musrifStats.totalTahsinRatings > 0 ? `${musrifStats.tahsinOkPct}%` : "-"}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {musrifStats && musrifStats.totalTahsinRatings > 0 ? "Santri binaan berpredikat tajwid & makhraj Baik/Sangat Baik" : "Belum ada inputan tahsin"}
                    </p>
                    {musrifStats && musrifStats.totalTahsinRatings > 0 && (
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${musrifStats.tahsinOkPct}%` }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Adab / Akhlak Widget */}
                <div className="p-4 bg-purple-50/20 dark:bg-purple-950/5 border border-slate-100 dark:border-zinc-850 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-800 dark:text-purple-400">III. Adab & Akhlak</span>
                    <Heart className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-slate-800 dark:text-white">
                      {musrifStats && musrifStats.totalAdabRatings > 0 ? `${musrifStats.adabOkPct}%` : "-"}
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                      {musrifStats && musrifStats.totalAdabRatings > 0 ? "Santri binaan berpredikat disiplin & sopan santun Baik/Sangat Baik" : "Belum ada inputan adab/akhlak"}
                    </p>
                    {musrifStats && musrifStats.totalAdabRatings > 0 && (
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${musrifStats.adabOkPct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: My Halaqah Groups & Managerial Supervision */}
          <div className="space-y-6">
            
            {/* Kelompok Halaqah List */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-4">Daftar Kelompok Halaqah Saya</h3>
              
              {myGroups.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400">
                  Belum ada kelompok halaqah yang ditugaskan kepada Anda.
                </div>
              ) : (
                <div className="space-y-3">
                  {myGroups.map((grp) => {
                    const groupStudents = allMembers.filter(m => m.groupId === grp.id);
                    return (
                      <div key={grp.id} className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-850 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-xs">{grp.groupName}</h4>
                          <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">
                            {groupStudents.length} Santri
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Lokasi: {grp.location || "-"} | Deskripsi: {grp.description || "-"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Agenda Pesantren Pekan Ini */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Agenda Sekolah Hari Ini</h3>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0">
                  Kalender Akademik
                </span>
              </div>

              {todayEvents.length === 0 ? (
                <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400">
                  Tidak ada agenda kegiatan khusus hari ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {todayEvents.map((evt, idx) => {
                    const styles = getCategoryStyles(evt.categoryName || evt.categoryId);
                    return (
                      <div key={idx} className="flex gap-3 p-3.5 bg-slate-50 dark:bg-zinc-800/45 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                        <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: styles.color }} />
                        <div className="flex-1 min-w-0">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${styles.bg} ${styles.text} ${styles.border}`}>
                            {evt.categoryName || "Pesantren"}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1.5 truncate">{evt.title}</h4>
                          {evt.description && (
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{evt.description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Supervisi Manajerial */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Supervisi Manajerial Saya</h3>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase bg-indigo-50/70 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md">
                  ASRAMA
                </span>
              </div>

              {nextManagerialSupervision ? (
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 dark:text-indigo-400">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    <span>Jadwal Supervisi Terdekat</span>
                  </div>
                  <div className="text-xs space-y-1 text-slate-600 dark:text-zinc-350">
                    <div><span className="text-slate-400 font-medium">Tanggal:</span> <strong>{new Date(nextManagerialSupervision.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</strong></div>
                    <div><span className="text-slate-400 font-medium">Supervisor:</span> <strong>{nextManagerialSupervision.supervisorName}</strong></div>
                    <div><span className="text-slate-400 font-medium">Aspek:</span> <strong>{nextManagerialSupervision.instrumentName}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400">
                  Belum ada jadwal supervisi manajerial terdekat.
                </div>
              )}

              {latestCompletedManagerial ? (
                <div className="mt-4 p-4 bg-emerald-50/45 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span>Evaluasi Terakhir</span>
                    </div>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                      {latestCompletedManagerial.score}
                    </span>
                  </div>
                  
                  {latestCompletedManagerial.rtlText && (
                    <div className="text-xs space-y-1.5 border-t border-slate-200/50 dark:border-zinc-800/50 pt-2">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Tindak Lanjut Asrama:</div>
                      <p className="italic text-slate-605 dark:text-zinc-300 font-medium bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-100 dark:border-zinc-800">
                        "{latestCompletedManagerial.rtlText}"
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 3. KETUA YAYASAN VIEW (PRIVACY-PRESERVING EXECUTIVE QUALITY DASHBOARD)
  // ==========================================
  if (viewingRole === "ketua_yayasan") {
    const sdmMutuRecommendation = averageSupervisionScore >= 85
      ? "Mutu SDM berada di level prima (Sangat Baik). Direkomendasikan pemberian penghargaan riset pengajaran, insentif prestasi, serta penunjukan sebagai pembina sejawat bagi asatidzah lainnya."
      : averageSupervisionScore >= 75
      ? "Mutu SDM berada dalam kondisi sehat (Baik). Disarankan menyelenggarakan In-House Training (IHT) berkala mengenai literasi digital, penguatan adab asrama, dan metodologi pembelajaran abad 21."
      : "Mutu SDM memerlukan pendampingan intensif (Cukup/Kurang). Direkomendasikan mengadakan re-sertifikasi kompetensi pedagogik secara terfokus serta audit tata tertib kepengasuhan asrama.";

    return wrapWithSwitcher(
      <div className="space-y-8 animate-fade-in">
        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-800 via-zinc-900 to-slate-950 text-white rounded-3xl p-8 shadow-lg border border-zinc-700/30">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <School className="h-44 w-44" />
          </div>
          <div className="max-w-2xl space-y-3 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide border border-white/10">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>Lembaga Penjaminan Mutu & Pengawasan Yayasan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Assalamu'alaikum, Ketua Yayasan!
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed font-light">
              Selamat datang di portal ekosistem pengawasan mutu SDM Pesantren SMP Alkarim Rasyid. Di sini Anda dapat memantau kesehatan ekosistem pendidikan dan pembinaan kesantrian secara makro demi menjaga amanah umat.
            </p>
          </div>
        </div>

        {/* Stats Bento Grid for Yayasan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-slate-50 dark:bg-zinc-950 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold">
              <Users className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Guru & Staf</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{totalTeachers} Orang</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
              <Calendar className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Supervisi Terlaksana</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{completedSupervisions} / {totalSupervisions} Kegiatan</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              <Award className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Rata-Rata Nilai Mutu</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{averageSupervisionScore} / 100</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-850 p-5 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all shadow-xs">
            <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold">
              <TrendingUp className="h-5.5 w-5.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ketercapaian Semester</p>
              <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">{supervisionPercentage}%</h3>
            </div>
          </div>
        </div>

        {/* Executive Quality Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-850 dark:text-white text-sm mb-1">Rapor Mutu SDM Yayasan (Berdasarkan Supervisi)</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">Penyebaran status kualifikasi asatidzah berdasarkan hasil observasi akademik dan manajerial asrama.</p>
              
              <div className="mt-6 space-y-4">
                {[
                  { name: "Sangat Baik (Nilai >= 90)", desc: "Kompetensi mengajar luar biasa & teladan asrama", count: academicSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) >= 90).length + managerialSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) >= 90).length, color: "bg-emerald-500" },
                  { name: "Baik (Nilai 80 - 89)", desc: "Menguasai pedagogik & adab asrama secara konsisten", count: academicSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) >= 80 && (s.score || 0) < 90).length + managerialSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) >= 80 && (s.score || 0) < 90).length, color: "bg-blue-500" },
                  { name: "Cukup (Nilai 70 - 79)", desc: "Memerlukan bimbingan taktis berkala", count: academicSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) >= 70 && (s.score || 0) < 80).length + managerialSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) >= 70 && (s.score || 0) < 80).length, color: "bg-amber-500" },
                  { name: "Perlu Pembinaan (Nilai < 70)", desc: "Butuh intervensi dan pendampingan yayasan secara intensif", count: academicSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) > 0 && (s.score || 0) < 70).length + managerialSupervisions.filter(s => s.status === "Selesai" && (s.score || 0) > 0 && (s.score || 0) < 70).length, color: "bg-rose-500" }
                ].map((item, index) => {
                  const count = item.count;
                  // Real percentage of completed supervisions in this band — 0% (not a fabricated fallback) when there is no data yet.
                  const widthPct = completedSupervisions > 0 ? Math.min(100, Math.round((count / completedSupervisions) * 100)) : 0;
                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-zinc-350">
                        <div>
                          <span>{item.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal ml-2">({item.desc})</span>
                        </div>
                        <span className="font-bold text-slate-800 dark:text-white">{count} SDM</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800 text-xs text-slate-400 flex items-center justify-between">
              <span>* Data bersifat makro dan dirancang ramah privasi sesuai regulasi asatidzah.</span>
            </div>
          </div>

          {/* Systemic Recommendation Sidebar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-sm">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span>Rekomendasi Pembinaan Sistemik</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Berdasarkan rekapitulasi data pengawasan mutu otomatis semester ini, Yayasan menyarankan aksi berikut kepada jajaran Kepala Sekolah & Pengasuh Pesantren:
              </p>
              
              <div className="p-4 bg-amber-50/60 dark:bg-amber-950/10 border border-amber-150 dark:border-amber-900/30 rounded-2xl text-xs text-amber-850 leading-relaxed font-medium">
                {sdmMutuRecommendation}
              </div>

              <div className="text-xs space-y-2 text-slate-600 dark:text-zinc-400 pt-2">
                <div className="flex items-start gap-1.5">
                  <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                  <span>Prioritas 1: Sinkronisasi nilai supervisi dengan rencana peningkatan anggaran diklat asatidzah.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <div className="h-1.5 w-1.5 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                  <span>Prioritas 2: Pemantauan realisasi Rencana Tindak Lanjut (RTL) pasca-supervisi setiap bulan oleh Litbang.</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-zinc-800 text-[10px] text-slate-400 text-center">
              Laporan Kinerja Makro SMP Alkarim Rasyid Boarding School
            </div>
          </div>
        </div>

        {/* Timeline Kegiatan Sekolah (Uraian Kegiatan Tahunan) */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs mt-6">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-850 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-sm">Timeline Kegiatan Sekolah</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Urutan kronologis agenda kegiatan akademik dan pesantren sepanjang tahun ajaran</p>
            </div>
            <Link to="/annual-activity-timeline" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer">
              Lihat Selengkapnya <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400">
              Tidak ada agenda kegiatan sekolah yang direncanakan dalam waktu dekat.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 dark:border-zinc-800 pl-4 ml-2 space-y-5 max-h-[420px] overflow-y-auto pr-1">
              {upcomingEvents.map((evt, idx) => {
                const styles = getCategoryStyles(evt.categoryName || evt.categoryId);
                return (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900" style={{ backgroundColor: styles.color }} />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${styles.bg} ${styles.text} ${styles.border}`}>
                          {evt.categoryName || "Kegiatan"}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white mt-1.5">{evt.title}</h4>
                        {evt.description && (
                          <p className="text-[10px] text-slate-450 dark:text-zinc-400 mt-0.5">{evt.description}</p>
                        )}
                      </div>
                      <span className="text-[9px] font-mono font-bold text-slate-500 bg-white dark:bg-zinc-900 border border-slate-250/70 dark:border-zinc-800 px-2 py-1 rounded-lg shrink-0 h-fit">
                        {evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} s/d ${evt.endDate}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    );
  }

  // ==========================================
  // 4. ADMIN & KEPALA SEKOLAH VIEW (EXECUTIVE DASHBOARD)
  // ==========================================

  return wrapWithSwitcher(
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white rounded-3xl p-8 shadow-lg border border-blue-500/10">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <School className="h-44 w-44" />
        </div>
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold tracking-wide">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>School Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Assalamu'alaikum, {getGreetingTitle()} {user?.displayName}!
          </h1>
          <p className="text-sm text-blue-100 leading-relaxed font-light">
            Selamat datang di <strong>Master Data Sekolah SMP Alkarim Rasyid</strong>. Modul ini merupakan satu-satunya sumber kebenaran (Single Source of Truth) data guru, siswa, kelas, mapel, dan kalender untuk seluruh sistem lain.
          </p>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Siswa */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow shadow-xs">
          <div className="h-12 w-12 rounded-lg bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Total Siswa</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-1">{totalStudents}</h3>
          </div>
        </div>

        {/* Guru */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow shadow-xs">
          <div className="h-12 w-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Guru & Staf</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-1">{totalTeachers}</h3>
          </div>
        </div>

        {/* Kelas */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow shadow-xs">
          <div className="h-12 w-12 rounded-lg bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <DoorClosed className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Total Kelas</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-1">{totalClasses}</h3>
          </div>
        </div>

        {/* Mata Pelajaran */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-5 flex items-center gap-4 hover:shadow-sm transition-shadow shadow-xs">
          <div className="h-12 w-12 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider">Mata Pelajaran</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mt-1">{totalSubjects}</h3>
          </div>
        </div>

      </div>

      {/* Leadership Dashboard Tab Selection Bar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/70 dark:bg-zinc-850 p-1.5 rounded-2xl w-fit border border-slate-200/45 dark:border-zinc-800/45">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "summary"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-zinc-100 shadow-sm border border-slate-200/50 dark:border-zinc-800/50"
              : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Ringkasan Umum
        </button>
        <button
          onClick={() => setActiveTab("monitoring")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "monitoring"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-zinc-100 shadow-sm border border-slate-200/50 dark:border-zinc-800/50"
              : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Monitoring Perencanaan (Wakakurikulum)
        </button>
        <button
          onClick={() => {
            setActiveTab("supervisor");
            if (teachersPlanningData.length > 0 && !selectedSupTeacherId) {
              setSelectedSupTeacherId(teachersPlanningData[0].teacher.id);
            }
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "supervisor"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-zinc-100 shadow-sm border border-slate-200/50 dark:border-zinc-800/50"
              : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Supervisor 360° View
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "performance"
              ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-zinc-100 shadow-sm border border-slate-200/50 dark:border-zinc-800/50"
              : "text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          E-Rapor Kinerja Guru
        </button>
      </div>

      {/* CONDITIONAL TAB RENDERING */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* QUICK ACTIONS ROW */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link to="/lesson-schedules" className="flex items-center gap-3.5 p-4 bg-indigo-50/55 dark:bg-indigo-950/10 hover:bg-indigo-50 dark:hover:bg-indigo-950/25 border border-indigo-100/40 dark:border-indigo-900/20 rounded-2xl transition-all shadow-3xs hover:shadow-2xs">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 rounded-xl">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">Kelola Jadwal</h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">Atur & Auto-Schedule</p>
              </div>
            </Link>
            <Link to="/teaching-journals" className="flex items-center gap-3.5 p-4 bg-emerald-50/55 dark:bg-emerald-950/10 hover:bg-emerald-50 dark:hover:bg-emerald-950/25 border border-emerald-100/40 dark:border-emerald-900/20 rounded-2xl transition-all shadow-3xs hover:shadow-2xs">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl">
                <BookOpenCheck className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">Jurnal Mengajar</h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">Input Jurnal KBM</p>
              </div>
            </Link>
            <button 
              onClick={() => setDrilldownModal({ 
                isOpen: true, 
                title: "Daftar Pelanggaran Adab Santri", 
                type: "student_violations", 
                data: studentViolations 
              })} 
              className="flex items-center gap-3.5 p-4 bg-rose-50/55 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/25 border border-rose-100/40 dark:border-rose-900/20 rounded-2xl text-left transition-all shadow-3xs hover:shadow-2xs cursor-pointer"
            >
              <div className="p-2.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 rounded-xl">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-950 dark:text-rose-200">Input Pelanggaran</h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">Catat Pelanggaran Adab</p>
              </div>
            </button>
            <button 
              onClick={() => setDrilldownModal({ 
                isOpen: true, 
                title: "Daftar Penghargaan & Karakter Baik", 
                type: "student_rewards", 
                data: studentRewards 
              })} 
              className="flex items-center gap-3.5 p-4 bg-amber-50/55 dark:bg-amber-950/10 hover:bg-amber-50 dark:hover:bg-amber-950/25 border border-amber-100/40 dark:border-amber-900/20 rounded-2xl text-left transition-all shadow-3xs hover:shadow-2xs cursor-pointer"
            >
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-xl">
                <Award className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">Input Penghargaan</h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">Catat Akhlak & Prestasi</p>
              </div>
            </button>
            <Link to="/sarpras-maintenance" className="flex items-center gap-3.5 p-4 bg-blue-50/55 dark:bg-blue-950/10 hover:bg-blue-50 dark:hover:bg-blue-950/25 border border-blue-100/40 dark:border-blue-900/20 rounded-2xl transition-all shadow-3xs hover:shadow-2xs">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-950 dark:text-blue-200">Perbaikan Sarpras</h4>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500">Ajukan Perbaikan Fasilitas</p>
              </div>
            </Link>
          </div>

          {/* AGENDA SECTION & CALENDAR ROADMAP */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">Agenda & Kegiatan Pekan Ini</h3>
                </div>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">{todayDayName}, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>

              {weeklyEvents.length > 0 ? (
                <div className="space-y-2.5 max-h-56 overflow-y-auto">
                  {weeklyEvents.map((event, i) => {
                    const styles = getCategoryStyles(event.categoryName || event.categoryId);
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                        <div className={`text-center py-1 px-2.5 rounded-lg font-mono ${styles.bg} ${styles.text} border ${styles.border}`}>
                          <div className="text-xs font-extrabold">{new Date(event.startDate || event.date).getDate()}</div>
                          <div className="text-[9px] uppercase font-bold">{new Date(event.startDate || event.date).toLocaleDateString("id-ID", { month: "short" })}</div>
                        </div>
                        <div className="flex-1 space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">{event.title}</h4>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-1">{event.description || "Tidak ada rincian kegiatan."}</p>
                        </div>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${styles.bg} ${styles.text} border ${styles.border}`}>{styles.label}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl text-xs text-slate-400">
                  Tidak ada agenda resmi di kalender akademik pekan ini.
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-sm">Waktu Operasional Sekolah</h3>
                </div>
                <p className="text-[11px] text-slate-400">Status pembelajaran dan alokasi JP terjadwal harian secara realtime.</p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-3 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Hari Pembelajaran</span>
                  <span className="font-black text-slate-800 dark:text-white">{todayDayName} Efektif</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Waktu Sekarang</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-blue-400 bg-indigo-50 dark:bg-blue-950/40 px-2 py-0.5 rounded">
                    {new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Total JP Terjadwal</span>
                  <span className="font-black text-slate-800 dark:text-white">
                    {allSchedules.filter((s: any) => (s.day || "").toLowerCase() === todayDayName.toLowerCase()).length} JP
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* COMMAND CENTER MONITORING BENTO-GRID WIDGETS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* WIDGET 1: GTK & PEMBELAJARAN */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-md">GTK & Pembelajaran</span>
                  <Users className="h-4 w-4 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm">Disiplin Pengisian Jurnal</h3>
                <p className="text-[11px] text-slate-400 mt-1">Mengukur rasio pengisian jurnal mengajar oleh guru di kelas secara realtime hari ini.</p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-4">
                {(() => {
                  const todaySchedulesCount = allSchedules.filter((s: any) => (s.day || "").toLowerCase() === todayDayName.toLowerCase()).length;
                  const unfilledCount = unfilledJournalsToday.length;
                  const filledCount = Math.max(0, todaySchedulesCount - unfilledCount);
                  const ratePct = todaySchedulesCount > 0 ? Math.round((filledCount / todaySchedulesCount) * 100) : 100;

                  return (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Rasio Jurnal Hari Ini</span>
                        <span className="text-xl font-black text-slate-800 dark:text-white">{ratePct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${ratePct}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] font-medium border-t border-slate-200/50 dark:border-zinc-800/50 pt-3">
                        <span className="text-slate-500">Jurnal Sudah Terisi:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{filledCount} / {todaySchedulesCount} Slot</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (unfilledCount > 0) {
                            setDrilldownModal({
                              isOpen: true,
                              title: "Daftar Guru Belum Mengisi Jurnal Hari Ini",
                              type: "unfilled_journals",
                              data: unfilledJournalsToday
                            });
                          }
                        }}
                        className={`w-full text-center py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                          unfilledCount > 0 
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 cursor-pointer" 
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 cursor-default"
                        }`}
                      >
                        {unfilledCount > 0 ? `⚠️ ${unfilledCount} Guru Belum Isi Jurnal (Detail)` : "✅ Semua Jurnal Terisi Hari Ini"}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* WIDGET 2: MUTU AKADEMIK & KURIKULUM */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md">Mutu Akademik</span>
                  <BookOpenCheck className="h-4 w-4 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm">Kelengkapan Perencanaan</h3>
                <p className="text-[11px] text-slate-400 mt-1">Pemantauan kelengkapan pengunggahan perangkat ajar (Prota, Prosem, RPP) seluruh guru pengampu.</p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-3.5">
                {(() => {
                  let totalAssignments = 0;
                  let protaFilled = 0;
                  let prosemFilled = 0;
                  let rppFilled = 0;

                  teachersPlanningData.forEach(tData => {
                    tData.assignments.forEach((assign: any) => {
                      totalAssignments++;
                      const hasProta = allAnnualPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.topics && p.topics.length > 0);
                      if (hasProta) protaFilled++;

                      const hasProsem = allSemesterPrograms.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId && p.allocations && p.allocations.length > 0);
                      if (hasProsem) prosemFilled++;

                      const hasLessonPlan = allLessonPlans.some((p: any) => p.classId === assign.classId && p.subjectId === assign.subjectId);
                      if (hasLessonPlan) rppFilled++;
                    });
                  });

                  const protaPct = totalAssignments > 0 ? Math.round((protaFilled / totalAssignments) * 100) : 100;
                  const prosemPct = totalAssignments > 0 ? Math.round((prosemFilled / totalAssignments) * 100) : 100;
                  const rppPct = totalAssignments > 0 ? Math.round((rppFilled / totalAssignments) * 100) : 100;

                  return (
                    <>
                      <div className="space-y-2">
                        <div onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Guru Belum Lengkap Prota", type: "missing_prota", data: missingProtaList })} className="flex items-center justify-between hover:bg-slate-100 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors cursor-pointer">
                          <span className="text-[11px] text-slate-500 font-bold">Program Tahunan</span>
                          <span className={`text-xs font-black ${protaPct === 100 ? "text-emerald-600" : "text-rose-600"}`}>{protaPct}% Selesai</span>
                        </div>
                        <div onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Guru Belum Lengkap Prosem", type: "missing_prosem", data: missingProsemList })} className="flex items-center justify-between hover:bg-slate-100 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors cursor-pointer">
                          <span className="text-[11px] text-slate-500 font-bold">Program Semester</span>
                          <span className={`text-xs font-black ${prosemPct === 100 ? "text-emerald-600" : "text-rose-600"}`}>{prosemPct}% Selesai</span>
                        </div>
                        <div onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Guru Belum Mengunggah Modul Ajar (RPP)", type: "missing_rpp", data: missingRppList })} className="flex items-center justify-between hover:bg-slate-100 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition-colors cursor-pointer">
                          <span className="text-[11px] text-slate-500 font-bold">Modul Ajar / RPP</span>
                          <span className={`text-xs font-black ${rppPct === 100 ? "text-emerald-600" : "text-indigo-600"}`}>{rppPct}% Uploaded</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 text-center border-t border-slate-200/50 dark:border-zinc-800/50 pt-2.5">
                        *Klik masing-masing item perencanaan untuk melihat rincian guru belum melengkapi.
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* WIDGET 3: KARAKTER & KEDISIPLINAN */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1 rounded-md">Karakter & Kedisiplinan</span>
                  <Activity className="h-4 w-4 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm">Pencatatan Karakter Santri</h3>
                <p className="text-[11px] text-slate-400 mt-1">Monitoring pelanggaran adab/ketertiban pondok serta prestasi kepesantrenan santri secara berkala.</p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Pelanggaran Adab Santri", type: "student_violations", data: studentViolations })}
                    className="p-3 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-900 rounded-xl transition-all hover:shadow-2xs text-left cursor-pointer space-y-1"
                  >
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Pelanggaran</span>
                    <h4 className="text-lg font-black text-rose-600 dark:text-rose-400">{studentViolations.length} Kasus</h4>
                    <p className="text-[9px] text-slate-400">Total poin: {studentViolations.reduce((sum: number, v: any) => sum + (v.points || 0), 0)} pts</p>
                  </button>

                  <button 
                    onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Penghargaan & Karakter Baik", type: "student_rewards", data: studentRewards })}
                    className="p-3 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-900 rounded-xl transition-all hover:shadow-2xs text-left cursor-pointer space-y-1"
                  >
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Prestasi</span>
                    <h4 className="text-lg font-black text-amber-600 dark:text-amber-400">{studentRewards.length} Kasus</h4>
                    <p className="text-[9px] text-slate-400">Total poin: {studentRewards.reduce((sum: number, r: any) => sum + (r.points || 0), 0)} pts</p>
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 text-center border-t border-slate-200/50 dark:border-zinc-800/50 pt-2">
                  *Klik pada kotak pelanggaran atau prestasi untuk menginspeksi kasus.
                </div>
              </div>
            </div>

            {/* WIDGET 4: HALAQAH & PENGASUHAN ASRAMA */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-md">Halaqah & Pengasuhan</span>
                  <Heart className="h-4 w-4 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm">Disiplin Halaqah Asatidzah</h3>
                <p className="text-[11px] text-slate-400 mt-1">Pemantauan realtime laporan jurnal mutabaah harian asrama yang disubmit oleh musrif/ustadz pembimbing halaqah.</p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-4">
                {(() => {
                  const totalGroupsCount = allHalaqahGroups.length || 1;
                  const unfilledGroupsCount = unfilledHalaqahToday.length;
                  const filledGroupsCount = Math.max(0, totalGroupsCount - unfilledGroupsCount);
                  const groupRatePct = Math.round((filledGroupsCount / totalGroupsCount) * 100);

                  return (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Rasio Jurnal Halaqah</span>
                        <span className="text-xl font-black text-slate-800 dark:text-white">{groupRatePct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 transition-all duration-500" style={{ width: `${groupRatePct}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] font-medium border-t border-slate-200/50 dark:border-zinc-800/50 pt-3">
                        <span className="text-slate-500">Grup Halaqah Terlapor:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{filledGroupsCount} / {totalGroupsCount} Halaqah</span>
                      </div>
                      <button 
                        onClick={() => {
                          if (unfilledGroupsCount > 0) {
                            setDrilldownModal({
                              isOpen: true,
                              title: "Daftar Halaqah Belum Melaporkan Jurnal Hari Ini",
                              type: "unfilled_halaqah",
                              data: unfilledHalaqahToday
                            });
                          }
                        }}
                        className={`w-full text-center py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                          unfilledGroupsCount > 0 
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 cursor-pointer" 
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 cursor-default"
                        }`}
                      >
                        {unfilledGroupsCount > 0 ? `⚠️ ${unfilledGroupsCount} Musrif Belum Lapor (Detail)` : "✅ Semua Musrif Mengisi Jurnal"}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* WIDGET 5: SARANA & PRASARANA */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2.5 py-1 rounded-md">Sarana & Prasarana</span>
                  <School className="h-4 w-4 text-slate-400" />
                </div>
                <h3 className="font-black text-slate-800 dark:text-white text-sm">Fasilitas & Pemeliharaan Aset</h3>
                <p className="text-[11px] text-slate-400 mt-1">Daftar inventaris sarpras sekolah yang memerlukan perbaikan segera demi kenyamanan santri.</p>
              </div>

              <div className="bg-slate-50 dark:bg-zinc-950/35 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-4">
                {(() => {
                  const brokenItems = sarprasInventory.filter((i: any) => i.damagedConditionCount > 0);
                  const activeMaint = sarprasMaintenance.filter((m: any) => m.status !== "Selesai");

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Inventaris Sarpras Rusak", type: "broken_sarpras", data: brokenItems })}
                          className="p-3 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-900 rounded-xl transition-all hover:shadow-2xs text-left cursor-pointer space-y-1"
                        >
                          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Item Rusak</span>
                          <h4 className="text-lg font-black text-amber-600 dark:text-amber-400">{brokenItems.length} Jenis</h4>
                          <p className="text-[9px] text-slate-400">Rusak: {brokenItems.reduce((sum: number, item: any) => sum + (item.damagedConditionCount || 0), 0)} unit</p>
                        </button>

                        <button 
                          onClick={() => setDrilldownModal({ isOpen: true, title: "Daftar Pemeliharaan & Perbaikan Aktif", type: "active_maintenance", data: activeMaint })}
                          className="p-3 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-900 rounded-xl transition-all hover:shadow-2xs text-left cursor-pointer space-y-1"
                        >
                          <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Perbaikan Aktif</span>
                          <h4 className="text-lg font-black text-blue-600 dark:text-blue-400">{activeMaint.length} Pengajuan</h4>
                          <p className="text-[9px] text-slate-400">Biaya: Rp {(activeMaint.reduce((sum: number, item: any) => sum + (item.cost || 0), 0) || 0).toLocaleString("id-ID")}</p>
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 text-center border-t border-slate-200/50 dark:border-zinc-800/50 pt-2">
                        *Klik pada kotak rusak atau perbaikan untuk memantau detail aset.
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* SECTION: SUPERVISI & PENJAMINAN MUTU */}
          {(currentRole === "kepala_sekolah" || currentRole === "admin" || currentRole === "wakasis" || currentRole === "wakakur" || currentRole === "wakakurikulum") && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-850 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Supervisi Akademik & Manajerial</h3>
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Pemantauan ketercapaian pengawasan mutu asatidzah dan pengasuhan asrama semester ini.</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to="/supervision-academic"
                    className="text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/20 dark:text-blue-400 px-3 py-1.5 rounded-xl border border-blue-100 dark:border-blue-900/30 transition-colors"
                  >
                    Supervisi Akademik
                  </Link>
                  <Link
                    to="/supervision-managerial"
                    className="text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 transition-colors"
                  >
                    Supervisi Manajerial
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ketercapaian Supervisi */}
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">Ketercapaian Pengawasan Mutu</div>
                  
                  <div className="bg-slate-50 dark:bg-zinc-950/40 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-medium">Realisasi Agenda</span>
                      <span className="text-sm font-black text-slate-800 dark:text-white">{completedSupervisions} / {totalSupervisions} Kegiatan</span>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-blue-600 dark:text-blue-400">Persentase Keberhasilan</span>
                        <span>{supervisionPercentage}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${supervisionPercentage}%` }} />
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-200/50 dark:border-zinc-800/50 pt-3">
                      <span className="text-xs text-slate-500 font-medium">Rata-Rata Nilai Mutu</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{averageSupervisionScore} / 100</span>
                    </div>
                  </div>
                </div>

                {/* Antrean / Agenda Terdekat */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="text-xs font-bold uppercase text-slate-400 tracking-wider">Daftar Guru / Staf Mendesak Disupervisi</div>

                  {urgentSupervisions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {urgentSupervisions.map((sup) => (
                        <div key={sup.id} className="p-3 bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-850 rounded-2xl flex flex-col justify-between space-y-2">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`px-1.5 py-0.5 rounded-md font-bold uppercase ${
                                sup.type === "Akademik"
                                  ? "bg-blue-100 text-blue-850 dark:bg-blue-950/30 dark:text-blue-400"
                                  : "bg-indigo-100 text-indigo-850 dark:bg-indigo-950/30 dark:text-indigo-400"
                              }`}>
                                {sup.type}
                              </span>
                              <span className="text-slate-400 font-mono">{new Date(sup.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                              {sup.type === "Akademik" ? (sup as any).teacherName : (sup as any).staffName || (sup as any).teacherName}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">Instrumen: {sup.instrumentName}</p>
                          </div>
                          
                          <Link
                            to={sup.type === "Akademik" ? "/supervision-academic" : "/supervision-managerial"}
                            className="block text-center text-[10px] font-black uppercase text-blue-600 hover:text-blue-750 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 py-1.5 rounded-xl transition-all"
                          >
                            Mulai Penilaian
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 bg-slate-50 dark:bg-zinc-950/20 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl text-center text-xs text-slate-400 w-full">
                      Semua agenda supervisi semester ini telah terselesaikan dengan baik. Alhamdulillah!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Visual Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Students bar chart */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-6 flex flex-col shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Distribusi Murid per Tingkat Kelas</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Grafik jumlah total murid aktif berdasarkan pembagian tingkat kelas</p>
              </div>
              <div className="flex-1 min-h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: "12px", 
                        borderColor: "#e2e8f0",
                        fontSize: "12px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)"
                      }} 
                    />
                    <Bar dataKey="Siswa" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Teacher pie chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-6 flex flex-col justify-between shadow-xs">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Status Kepegawaian Guru</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Komposisi status guru PNS, Yayasan (GTY), dan Honorer</p>
              </div>
              
              {teacherStatusData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <GraduationCap className="h-10 w-10 text-slate-350 dark:text-zinc-700 animate-pulse mb-2" />
                  <p className="text-xs text-slate-400">Belum ada data guru</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-[160px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={teacherStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {teacherStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Legends list */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-850">
                    {teacherStatusData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400">
                        <span 
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }} 
                        />
                        <span className="truncate text-[11px]">{entry.name}: <strong>{entry.value}</strong></span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "monitoring" && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Monitoring Dokumen Perencanaan (Wakakurikulum)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Daftar lengkap kesiapan asatidzah dalam pengisian program tahunan, program semester, dan pengunggahan modul ajar.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/20">
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Nama Guru</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Beban Mengajar</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Prota (Annual)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Prosem (Semester)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Modul Ajar (RPP)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Jurnal Mengajar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {teachersPlanningData.map((tData) => (
                  <tr key={tData.teacher.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-slate-700 dark:text-zinc-250">{tData.teacher.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{tData.teacher.nip || "NIP Belum Diatur"}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                        {tData.totalJp} JP
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {tData.totalRequired === 0 ? (
                        <span className="text-slate-400 text-[10px]">Bukan Pengampu</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tData.protaPct === 100
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : tData.protaPct > 0
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}>
                            {tData.protaPct}% ({tData.protaCount}/{tData.totalRequired})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {tData.totalRequired === 0 ? (
                        <span className="text-slate-400 text-[10px]">Bukan Pengampu</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tData.prosemPct === 100
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : tData.prosemPct > 0
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}>
                            {tData.prosemPct}% ({tData.prosemCount}/{tData.totalRequired})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {tData.totalRequired === 0 ? (
                        <span className="text-slate-400 text-[10px]">Bukan Pengampu</span>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tData.lessonPlanPct === 100
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : tData.lessonPlanPct > 0
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}>
                            {tData.lessonPlanPct}% ({tData.lessonPlanCount}/{tData.totalRequired})
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-bold font-mono text-slate-700 dark:text-zinc-300">
                        {tData.journalCount} Entri Jurnal
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "supervisor" && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-850 pb-4">
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Siklus Supervisi (Supervisor 360° View)</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">Analisis siklus komparasi menyeluruh guru mulai dari perencanaan (Prota & Prosem) hingga refleksi harian (Jurnal Mengajar).</p>
            </div>

            {/* Select Teacher to Audit */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pilih Asatidzah</label>
              <select
                value={selectedSupTeacherId}
                onChange={(e) => setSelectedSupTeacherId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-hidden"
              >
                {teachersPlanningData.map(tData => (
                  <option key={tData.teacher.id} value={tData.teacher.id}>{tData.teacher.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Audit Dashboard Detail */}
          {(() => {
            const auditData = teachersPlanningData.find(t => t.teacher.id === selectedSupTeacherId);
            if (!auditData) {
              return (
                <div className="text-center py-10 text-xs text-slate-400">
                  Pilih salah satu guru untuk menganalisis siklus perencanaan hingga pelaksanaan.
                </div>
              );
            }

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Planning Panel */}
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-blue-500" /> 1. Fase Perencanaan (Prota, Prosem, Modul Ajar)
                  </div>

                  <div className="bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl p-5 space-y-5">
                    <div>
                      <h4 className="text-xs font-black text-slate-700 dark:text-zinc-300">Kebutuhan Dokumen Mengajar</h4>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Prota</span>
                          <span className="text-base font-black text-slate-800 dark:text-zinc-100 mt-1 block">
                            {auditData.protaCount} / {auditData.totalRequired}
                          </span>
                        </div>
                        <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Prosem</span>
                          <span className="text-base font-black text-slate-800 dark:text-zinc-100 mt-1 block">
                            {auditData.prosemCount} / {auditData.totalRequired}
                          </span>
                        </div>
                        <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-center">
                          <span className="block text-[10px] text-slate-400 font-bold uppercase">Modul Ajar</span>
                          <span className="text-base font-black text-slate-800 dark:text-zinc-100 mt-1 block">
                            {auditData.lessonPlanCount} / {auditData.totalRequired}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-700 dark:text-zinc-300">Daftar Link Modul Ajar Terunggah</h4>
                      {allLessonPlans.filter(p => p.teacherId === auditData.teacher.id).length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Belum mengunggah referensi link Modul Ajar.</p>
                      ) : (
                        <div className="space-y-2">
                          {allLessonPlans.filter(p => p.teacherId === auditData.teacher.id).map((p, i) => (
                            <div key={i} className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850 p-2.5 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <span className="font-bold text-slate-700 dark:text-zinc-250">{p.title}</span>
                                <div className="text-[10px] text-slate-400 mt-0.5">{p.subjectName} - Kelas {p.className}</div>
                              </div>
                              <a
                                href={p.link}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                rel="noreferrer"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Execution Panel */}
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <BookOpenCheck className="h-4 w-4 text-emerald-500" /> 2. Pelaksanaan & Refleksi Harian (Jurnal Guru)
                  </div>

                  <div className="bg-slate-50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-700 dark:text-zinc-300">Daftar Jurnal Mengajar Harian</h4>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                        {auditData.journals.length} Jurnal Terisi
                      </span>
                    </div>

                    {auditData.journals.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 italic">
                        Belum ada realisasi jurnal mengajar kelas terdaftar di sistem.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {auditData.journals.map((j: any) => (
                          <div key={j.id} className="p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-400">{j.className}</span>
                              <span className="text-slate-400">{j.date}</span>
                            </div>
                            <div>
                              <div className="font-bold text-slate-700 dark:text-zinc-250">{j.subjectName}</div>
                              <p className="text-[11px] text-slate-500 mt-0.5">Materi: {j.topic || j.materials || "Belum dimasukkan"}</p>
                            </div>
                            {j.notes && (
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 italic border-l-2 border-slate-200 pl-2">
                                "{j.notes}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === "performance" && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Rapor Kinerja Otomatis (E-Rapor Akademik)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Penghitungan skor kinerja otomatis bersumber dari keterisian Prota (25%), Prosem (25%), kelengkapan link Modul Ajar (25%), dan konsistensi harian Jurnal Mengajar (25%).</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950/20">
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Nama Guru</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Skor Prota (25)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Skor Prosem (25)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Skor Modul (25)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Skor Jurnal (25)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Skor Kinerja Akhir</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Kualifikasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {teachersPlanningData.map((tData) => {
                  const protaScore = tData.totalRequired > 0 ? Math.round((tData.protaCount / tData.totalRequired) * 25) : 25;
                  const prosemScore = tData.totalRequired > 0 ? Math.round((tData.prosemCount / tData.totalRequired) * 25) : 25;
                  const lessonScore = tData.totalRequired > 0 ? Math.round((tData.lessonPlanCount / tData.totalRequired) * 25) : 25;
                  const journalScore = Math.min(25, Math.round((tData.journalCount / 5) * 25));

                  return (
                    <tr key={tData.teacher.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                      <td className="p-3 font-bold text-slate-700 dark:text-zinc-200">
                        {tData.teacher.name}
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-600 dark:text-zinc-300 font-mono">
                        {protaScore} / 25
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-600 dark:text-zinc-300 font-mono">
                        {prosemScore} / 25
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-600 dark:text-zinc-300 font-mono">
                        {lessonScore} / 25
                      </td>
                      <td className="p-3 text-center font-semibold text-slate-600 dark:text-zinc-300 font-mono">
                        {journalScore} / 25
                      </td>
                      <td className="p-3 text-center font-black text-slate-800 dark:text-white font-mono text-sm">
                        {tData.performanceScore} / 100
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${tData.performanceColor}`}>
                          {tData.performanceLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTIONABLE EXECUTIVE DRILLDOWN MODAL */}
      {drilldownModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between bg-slate-50 dark:bg-zinc-950/20">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <h3 className="font-extrabold text-slate-850 dark:text-white text-sm">{drilldownModal.title}</h3>
              </div>
              <button 
                onClick={() => setDrilldownModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {drilldownModal.data.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  Tidak ada data yang ditemukan untuk indikator ini. Luar biasa!
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950/30 border-b border-slate-100 dark:border-zinc-800">
                        {drilldownModal.type === "unfilled_journals" && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Guru</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Kelas</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Mata Pelajaran</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Slot Waktu</th>
                          </>
                        )}
                        {drilldownModal.type === "unfilled_halaqah" && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Kelompok</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Musrif</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Keterangan</th>
                          </>
                        )}
                        {["missing_prota", "missing_prosem", "missing_rpp"].includes(drilldownModal.type) && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Guru</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Kelas</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Mata Pelajaran</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Status</th>
                          </>
                        )}
                        {drilldownModal.type === "student_violations" && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Tanggal</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Santri</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Kelas</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Jenis Pelanggaran</th>
                            <th className="p-3 font-bold text-slate-500 uppercase text-center">Poin Minus</th>
                          </>
                        )}
                        {drilldownModal.type === "student_rewards" && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Tanggal</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Santri</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Kelas</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Prestasi / Akhlak</th>
                            <th className="p-3 font-bold text-slate-500 uppercase text-center">Poin Plus</th>
                          </>
                        )}
                        {drilldownModal.type === "broken_sarpras" && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Barang / Aset</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Kategori</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Lokasi</th>
                            <th className="p-3 font-bold text-slate-500 uppercase text-center">Jumlah Rusak</th>
                          </>
                        )}
                        {drilldownModal.type === "active_maintenance" && (
                          <>
                            <th className="p-3 font-bold text-slate-500 uppercase">Nama Barang / Aset</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Pelapor</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Deskripsi Kerusakan</th>
                            <th className="p-3 font-bold text-slate-500 uppercase">Status Perbaikan</th>
                            <th className="p-3 font-bold text-slate-500 uppercase text-right">Estimasi Biaya</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                      {drilldownModal.data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                          {drilldownModal.type === "unfilled_journals" && (
                            <>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.schedule?.teacherName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.schedule?.className}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.schedule?.subjectName}</td>
                              <td className="p-3">
                                <span className="font-mono text-indigo-600 dark:text-blue-400 bg-indigo-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                                  JP {item.schedule?.sequence} ({item.period?.startTime || "--:--"} - {item.period?.endTime || "--:--"})
                                </span>
                              </td>
                            </>
                          )}
                          {drilldownModal.type === "unfilled_halaqah" && (
                            <>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.group?.groupName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.group?.musrifName}</td>
                              <td className="p-3">
                                <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded font-medium">
                                  Belum Lapor Hari Ini
                                </span>
                              </td>
                            </>
                          )}
                          {["missing_prota", "missing_prosem", "missing_rpp"].includes(drilldownModal.type) && (
                            <>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.teacherName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.className}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.subjectName}</td>
                              <td className="p-3">
                                <span className="text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded font-semibold">
                                  Belum Dilengkapi
                                </span>
                              </td>
                            </>
                          )}
                          {drilldownModal.type === "student_violations" && (
                            <>
                              <td className="p-3 text-slate-500 font-mono">{new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.studentName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.className}</td>
                              <td className="p-3">
                                <span className="font-bold text-slate-850 dark:text-zinc-200">{item.type}</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
                              </td>
                              <td className="p-3 text-center text-rose-600 dark:text-rose-400 font-mono font-bold">-{item.points} pts</td>
                            </>
                          )}
                          {drilldownModal.type === "student_rewards" && (
                            <>
                              <td className="p-3 text-slate-500 font-mono">{new Date(item.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</td>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.studentName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.className}</td>
                              <td className="p-3">
                                <span className="font-bold text-slate-850 dark:text-zinc-200">{item.category}</span>
                                <p className="text-[10px] text-slate-400 mt-0.5">{item.description}</p>
                              </td>
                              <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-mono font-bold">+{item.points} pts</td>
                            </>
                          )}
                          {drilldownModal.type === "broken_sarpras" && (
                            <>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.itemName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.category}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.location}</td>
                              <td className="p-3 text-center text-amber-600 dark:text-amber-400 font-mono font-black">{item.damagedConditionCount} Unit</td>
                            </>
                          )}
                          {drilldownModal.type === "active_maintenance" && (
                            <>
                              <td className="p-3 font-bold text-slate-850 dark:text-zinc-200">{item.itemName}</td>
                              <td className="p-3 text-slate-600 dark:text-zinc-400">{item.reporterName}</td>
                              <td className="p-3 text-slate-400 dark:text-zinc-500 italic truncate max-w-xs">{item.issueDescription}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-md font-extrabold uppercase text-[10px] ${
                                  item.status === "Menunggu Persetujuan" ? "bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:text-amber-400" :
                                  item.status === "Sedang Dikerjakan" ? "bg-blue-100 text-blue-850 dark:bg-blue-950/20 dark:text-blue-400" :
                                  "bg-emerald-100 text-emerald-850 dark:bg-emerald-950/20 dark:text-emerald-400"
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-slate-850 dark:text-white">
                                Rp {(item.cost || 0).toLocaleString("id-ID")}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-850 bg-slate-50 dark:bg-zinc-950/25 flex justify-end">
              <button 
                onClick={() => setDrilldownModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 py-2 bg-slate-800 text-white hover:bg-slate-900 dark:bg-zinc-800 dark:hover:bg-zinc-750 font-bold rounded-xl transition-all cursor-pointer text-xs"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
