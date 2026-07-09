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
import { Link } from "react-router-dom";
import { academicPlanningService } from "../services/academicPlanning.service";
import { executiveDashboardService } from "../services/executiveDashboard.service";
import { WakasisDashboard } from "../components/dashboard/WakasisDashboard";
import { WakasarprasDashboard } from "../components/dashboard/WakasarprasDashboard";
import { 
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
  const currentRole = user?.role?.toLowerCase() || "";
  const [viewingRole, setViewingRole] = React.useState<string>(currentRole);

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
  const [expandedJPTeacherId, setExpandedJPTeacherId] = React.useState<string>("");

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

  // Real "today" derived from the system clock — used to filter the published schedule,
  // never to fabricate or guess an agenda.
  const dayNamesId = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const todayDayName = dayNamesId[new Date().getDay()];

  const parseTimeToMinutes = (t?: string | null): number | null => {
    if (!t) return null;
    const clean = t.replace(".", ":");
    const parts = clean.split(":").map((v) => parseInt(v, 10));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  // Teacher's schedule for TODAY, taken only from published Schedule docs (Admin's "schedules" collection).
  // No mock/sample/dummy/fallback/random agenda is generated here — if there is nothing for this
  // teacherId + today's day, the list is simply empty and the UI shows "Tidak ada jadwal mengajar hari ini."
  const teacherTodaySchedules = React.useMemo(() => {
    if (!teacherId) return [];

    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

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

        let status = "Belum Mulai";
        if (startMin !== null && endMin !== null) {
          if (nowMinutes >= endMin) status = "Selesai";
          else if (nowMinutes >= startMin && nowMinutes < endMin) status = "Sedang Berjalan";
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
  }, [allSchedules, allLessonPeriods, teacherId, todayDayName]);

  // Real journal entries belonging to the logged-in teacher (used to replace the old hardcoded "24 Entri").
  const myTeacherJournals = React.useMemo(() => {
    if (!teacherId) return [];
    return allTeachingJournals.filter((j: any) => j.teacherId === teacherId || j.createdBy === teacherId);
  }, [allTeachingJournals, teacherId]);

  // Calculate teacher planning progress indicators
  const teacherAssignments = React.useMemo(() => {
    if (!teacherId) return [];
    const list: { subjectId: string; subjectName: string; classId: string; className: string }[] = [];
    
    curriculumMatrix.forEach((m: any) => {
      const isTeacherVii = (m.teacherId === teacherId || m.teacherId_vii === teacherId) && m.jp_vii > 0;
      const isTeacherViii = (m.teacherId_viii === teacherId) && m.jp_viii > 0;
      const isTeacherIx = (m.teacherId_ix === teacherId) && m.jp_ix > 0;

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

  // ==========================================
  // Total JP Mengajar (Beban Mengajar) — computed ONLY from Struktur Kurikulum (curriculum_matrix).
  // Does NOT use Jadwal, Program Tahunan, Program Semester, or any cached dashboard value.
  //
  // Rule per record in curriculum_matrix:
  //   - If useDifferentTeachers is true: each grade (VII/VIII/IX) is taught by its own
  //     teacherId_vii / teacherId_viii / teacherId_ix, so that grade's JP is attributed
  //     ONLY to that specific teacher.
  //   - If useDifferentTeachers is false: a single teacherId teaches all three grades for
  //     that subject, so jp_vii + jp_viii + jp_ix are all attributed to that one teacher.
  //
  // This guarantees no double counting: a given grade's JP for a subject is always
  // attributed to exactly one teacher.
  // ==========================================
  interface JPSubjectBreakdown {
    subjectId: string;
    subjectName: string;
    vii: number;
    viii: number;
    ix: number;
    total: number;
  }

  const teacherJPMap = React.useMemo(() => {
    const map: Record<string, { totalJP: number; bySubject: Record<string, JPSubjectBreakdown> }> = {};

    const addJP = (tId: string, subjectId: string, subjectName: string, grade: "vii" | "viii" | "ix", jp: number) => {
      if (!tId || !jp) return;
      if (!map[tId]) map[tId] = { totalJP: 0, bySubject: {} };
      const bucket = map[tId];
      if (!bucket.bySubject[subjectId]) {
        bucket.bySubject[subjectId] = { subjectId, subjectName, vii: 0, viii: 0, ix: 0, total: 0 };
      }
      bucket.bySubject[subjectId][grade] += jp;
      bucket.bySubject[subjectId].total += jp;
      bucket.totalJP += jp;
    };

    curriculumMatrix.forEach((m: any) => {
      const teacherForVii = m.useDifferentTeachers ? m.teacherId_vii : m.teacherId;
      const teacherForViii = m.useDifferentTeachers ? m.teacherId_viii : m.teacherId;
      const teacherForIx = m.useDifferentTeachers ? m.teacherId_ix : m.teacherId;

      addJP(teacherForVii, m.subjectId, m.subjectName, "vii", m.jp_vii || 0);
      addJP(teacherForViii, m.subjectId, m.subjectName, "viii", m.jp_viii || 0);
      addJP(teacherForIx, m.subjectId, m.subjectName, "ix", m.jp_ix || 0);
    });

    return map;
  }, [curriculumMatrix]);

  // Pre-calculate statistics/monitoring lists for all active teachers
  const teachersPlanningData = React.useMemo(() => {
    return teachers
      .filter(t => t.status && !t.isDeleted)
      .map((t) => {
        // Find this teacher's assignments
        const assignments: { subjectId: string; subjectName: string; classId: string; className: string }[] = [];
        curriculumMatrix.forEach((m: any) => {
          const isTeacherVii = (m.teacherId === t.id || m.teacherId_vii === t.id) && m.jp_vii > 0;
          const isTeacherViii = (m.teacherId_viii === t.id) && m.jp_viii > 0;
          const isTeacherIx = (m.teacherId_ix === t.id) && m.jp_ix > 0;

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

        // Total JP Mengajar — sourced strictly from teacherJPMap (Struktur Kurikulum only)
        const jpData = teacherJPMap[t.id];
        const totalJP = jpData ? jpData.totalJP : 0;
        const jpBySubject: JPSubjectBreakdown[] = jpData
          ? Object.values(jpData.bySubject).sort((a, b) => a.subjectName.localeCompare(b.subjectName))
          : [];

        return {
          teacher: t,
          assignments,
          totalRequired,
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
          performanceColor,
          totalJP,
          jpBySubject
        };
      });
  }, [teachers, classes, curriculumMatrix, allAnnualPrograms, allSemesterPrograms, allLessonPlans, allTeachingJournals, teacherJPMap]);

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
  const isExecutive = ["admin", "operator", "ketua_yayasan", "pimpinan", "kepala_sekolah", "wakil kepala sekolah", "wakasis", "wakakur", "wakakurikulum", "wakasarpras"].includes(currentRole);

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
              Ahlan Wa Sahlan, Ustadz/Ustadzah {user?.displayName}!
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
                    <div key={j.id || i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-850 rounded-2xl gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-mono text-xs font-bold shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white">{j.subject}</h4>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded">{j.className}</span>
                            {j.room && <span className="text-[10px] font-medium text-slate-400">{j.room}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-between sm:justify-end">
                        <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-zinc-400">{j.time}</span>
                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold border ${
                          j.status === "Selesai"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30"
                            : j.status === "Sedang Berjalan"
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30 animate-pulse"
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
              <span>Dashboard Personal Musrif & Pembina Asrama</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ahlan Wa Sahlan, Ustadz {user?.displayName}!
            </h1>
            <p className="text-sm text-blue-50 leading-relaxed font-light">
              SMP Alkarim Rasyid Boarding School didukung penuh oleh bimbingan asrama (Halaqah) asuhan Anda. Evaluasi setoran hafalan santri, muroja'ah, jurnal harian halaqah, dan rapor kinerja kesantrian Anda.
            </p>
          </div>
        </div>

        {/* Stats Bento Grid for Musrif */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Kelompok Halaqah */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-4 flex items-center gap-3.5 hover:shadow-md transition-all shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <School className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Halaqah</p>
              {/* No halaqah-assignment service is wired up yet — show an honest placeholder instead of a fabricated group name */}
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5 truncate">Belum Ditugaskan</h3>
              <span className="text-[8px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/40 px-1 py-0.5 rounded mt-1 inline-block">Belum ada data</span>
            </div>
          </div>

          {/* Santri Binaan */}
          <Link to="/students" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-4 flex items-center gap-3.5 hover:shadow-md hover:border-indigo-500/30 transition-all shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Santri Binaan</p>
              {/* No musrif-to-santri assignment data is wired up yet — show real 0 instead of a fabricated count */}
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">0 Santri</h3>
              <span className="text-[8px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1 py-0.5 rounded mt-1 inline-block">Belum ada data</span>
            </div>
          </Link>

          {/* Agenda Hari Ini */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-4 flex items-center gap-3.5 hover:shadow-md transition-all shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Agenda Halaqah</p>
              {/* No halaqah daily-agenda service is wired up yet — show an honest placeholder instead of a fabricated agenda */}
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">-</h3>
              <span className="text-[8px] text-purple-600 font-bold bg-purple-50 dark:bg-purple-950/40 px-1 py-0.5 rounded mt-1 inline-block">Belum ada data</span>
            </div>
          </div>

          {/* Target Tahfidz */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-4 flex items-center gap-3.5 hover:shadow-md transition-all shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Tahfidz</p>
              {/* No tahfidz-tracking service is wired up yet — show real 0 instead of a fabricated value */}
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">0 Juz/Sem</h3>
              <span className="text-[8px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1 py-0.5 rounded mt-1 inline-block">Belum ada data</span>
            </div>
          </div>

          {/* Target Tahsin */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-4 flex items-center gap-3.5 hover:shadow-md transition-all shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Tahsin</p>
              {/* No tahsin-tracking service is wired up yet — show an honest placeholder instead of a fabricated level */}
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">-</h3>
              <span className="text-[8px] text-amber-600 font-bold bg-amber-50 dark:bg-amber-950/40 px-1 py-0.5 rounded mt-1 inline-block">Belum ada data</span>
            </div>
          </div>

          {/* Rapor Kinerja */}
          <Link to="/sdm-performance" className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-4 flex items-center gap-3.5 hover:shadow-md hover:border-rose-500/30 transition-all shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Kinerja Musrif</p>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{myManagerialAvgScore} / 100</h3>
              <span className="text-[8px] text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 px-1 py-0.5 rounded mt-1 inline-block uppercase">{myManagerialLabel}</span>
            </div>
          </Link>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Santri Binaan list */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Status Tahfidz & Tahsin Santri Binaan</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Ringkasan hafalan terkini halaqah bimbingan Anda</p>
              </div>
            </div>

            {/* No hafalan/tahfidz-tracking service is wired up yet — show an honest empty state
                instead of a fabricated list of named santri and scores. */}
            <div className="p-8 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400 font-medium">
              Belum ada data hafalan santri binaan yang terintegrasi ke sistem.
            </div>
          </div>

          {/* Kegiatan Pesantren Pekan Ini */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs mt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white text-sm">Kegiatan Pesantren Pekan Ini</h3>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">Daftar agenda kegiatan kesantrian dan pesantren selama satu pekan ke depan</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                Kesantrian
              </span>
            </div>

            {weeklyPesantrenEvents.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Tidak ada agenda kegiatan khusus pesantren/halaqah dalam pekan ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {weeklyPesantrenEvents.map((evt, idx) => {
                  const styles = getCategoryStyles(evt.categoryName || evt.categoryId);
                  return (
                    <div key={idx} className="flex gap-3 p-3.5 bg-slate-50 dark:bg-zinc-800/45 border border-slate-100 dark:border-zinc-850 rounded-2xl">
                      <div className="w-1.5 rounded-full shrink-0" style={{ backgroundColor: styles.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase border ${styles.bg} ${styles.text} ${styles.border}`}>
                            {evt.categoryName || "Pesantren"}
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

          {/* Agenda & Mutabaah Asrama */}
          <div className="space-y-6">
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
                  <Link
                    to="/supervision-managerial"
                    className="block text-center text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl mt-2 transition-colors"
                  >
                    Lihat Lembar Penilaian
                  </Link>
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

            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">Agenda Halaqah Asrama</h3>
              {/* No halaqah-agenda service is wired up yet — show an honest empty state
                  instead of a fabricated routine schedule. */}
              <div className="p-6 bg-slate-50 dark:bg-zinc-950/35 border border-slate-100 dark:border-zinc-850 rounded-2xl text-center text-xs text-slate-400 font-medium">
                Belum ada agenda halaqah asrama.
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
              <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3.5">Target & Realisasi Bulanan</h3>
              {/* No ziyadah/kehadiran-tracking service is wired up yet — show real 0% instead of fabricated percentages. */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                    <span>Realisasi Setoran Ziyadah</span>
                    <span className="font-bold text-slate-800 dark:text-white">0%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: "0%" }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                    <span>Kehadiran Shalat Subuh Santri</span>
                    <span className="font-bold text-slate-800 dark:text-white">0%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-850 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: "0%" }} />
                  </div>
                </div>
              </div>
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
            <span>Ekosistem Aplikasi Terintegrasi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Assalamu'alaikum, {user?.displayName}!
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
        <>
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

          {/* Integration Roadmap (Aplikasi Ekosistem) */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-6 shadow-xs">
            <div className="mb-5">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Ekosistem Aplikasi Terintegrasi</h3>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Peta jalan integrasi modul-modul sekolah berikutnya menggunakan database master terpusat ini</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { title: "Kalender Pendidikan", desc: "Penjadwalan hari efektif, libur, dan kegiatan resmi", status: "Siap Integrasi" },
                { title: "Jadwal Pelajaran", desc: "Penyusunan jadwal otomatis guru dan kelas", status: "Siap Integrasi" },
                { title: "Jurnal Harian Guru", desc: "Pencatatan materi pelajaran yang diajarkan di kelas", status: "Siap Integrasi" },
                { title: "Rapor Kinerja", desc: "Penilaian berkala untuk kinerja kepegawaian guru", status: "Siap Integrasi" },
                { title: "e-Rapor Siswa", desc: "Pencetakan hasil belajar siswa akhir semester", status: "Siap Integrasi" },
              ].map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 flex flex-col justify-between hover:border-blue-500/40 dark:hover:border-blue-500/40 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold tracking-wider text-blue-600 dark:text-blue-400 uppercase bg-blue-50/70 dark:bg-blue-950/20 px-2 py-0.5 rounded-md">
                        Modul {idx + 1}
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-200">{item.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-medium flex items-center gap-1">
                      <ArrowRightLeft className="h-3 w-3 text-emerald-500" /> DB Master
                    </span>
                    <span className="text-emerald-600 font-bold dark:text-emerald-400">{item.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
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
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Total JP Mengajar</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Prota (Annual)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Prosem (Semester)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Modul Ajar (RPP)</th>
                  <th className="p-3 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Jurnal Mengajar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/80">
                {teachersPlanningData.map((tData) => {
                  const isExpanded = expandedJPTeacherId === tData.teacher.id;
                  const hasMultipleSubjects = tData.jpBySubject.length > 1;
                  return (
                    <React.Fragment key={tData.teacher.id}>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-700 dark:text-zinc-250">{tData.teacher.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{tData.teacher.nip || "NIP Belum Diatur"}</div>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => hasMultipleSubjects && setExpandedJPTeacherId(isExpanded ? "" : tData.teacher.id)}
                            title={tData.jpBySubject.map((s) => `${s.subjectName}: VII=${s.vii}, VIII=${s.viii}, IX=${s.ix} (Total ${s.total} JP)`).join(" | ")}
                            className={`font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md inline-flex items-center gap-1 ${
                              hasMultipleSubjects ? "cursor-pointer hover:bg-slate-200 dark:hover:bg-zinc-750" : "cursor-default"
                            }`}
                          >
                            {tData.totalJP} JP
                            {hasMultipleSubjects && (
                              <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                            )}
                          </button>
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
                      {isExpanded && hasMultipleSubjects && (
                        <tr className="bg-slate-50/70 dark:bg-zinc-950/30">
                          <td colSpan={6} className="p-0">
                            <div className="p-4">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                                Rincian JP per Mata Pelajaran — {tData.teacher.name}
                              </p>
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-zinc-800">
                                    <th className="p-2 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Mata Pelajaran</th>
                                    <th className="p-2 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">VII</th>
                                    <th className="p-2 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">VIII</th>
                                    <th className="p-2 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">IX</th>
                                    <th className="p-2 font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Total JP</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850/60">
                                  {tData.jpBySubject.map((s) => (
                                    <tr key={s.subjectId}>
                                      <td className="p-2 font-semibold text-slate-700 dark:text-zinc-300">{s.subjectName}</td>
                                      <td className="p-2 text-center font-mono text-slate-600 dark:text-zinc-400">{s.vii}</td>
                                      <td className="p-2 text-center font-mono text-slate-600 dark:text-zinc-400">{s.viii}</td>
                                      <td className="p-2 text-center font-mono text-slate-600 dark:text-zinc-400">{s.ix}</td>
                                      <td className="p-2 text-center font-mono font-bold text-slate-800 dark:text-white">{s.total}</td>
                                    </tr>
                                  ))}
                                  <tr className="border-t border-slate-200 dark:border-zinc-800">
                                    <td className="p-2 font-black text-slate-800 dark:text-white">Total</td>
                                    <td className="p-2 text-center font-mono font-bold text-slate-800 dark:text-white">
                                      {tData.jpBySubject.reduce((sum, s) => sum + s.vii, 0)}
                                    </td>
                                    <td className="p-2 text-center font-mono font-bold text-slate-800 dark:text-white">
                                      {tData.jpBySubject.reduce((sum, s) => sum + s.viii, 0)}
                                    </td>
                                    <td className="p-2 text-center font-mono font-bold text-slate-800 dark:text-white">
                                      {tData.jpBySubject.reduce((sum, s) => sum + s.ix, 0)}
                                    </td>
                                    <td className="p-2 text-center font-mono font-black text-slate-900 dark:text-white">{tData.totalJP}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
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
    </div>
  );
};

export default Dashboard;
