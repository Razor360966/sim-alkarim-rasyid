import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Dialog } from "../components/Dialog";
import { DataTable, Column } from "../components/DataTable";
import { Loading } from "../components/Loading";
import { FormInput, FormSelect, FormTextarea } from "../components/FormInput";
import { 
  academicYearService 
} from "../services/academicYear.service";
import { academicPlanningService } from "../services/academicPlanning.service";
import { 
  semesterService 
} from "../services/semester.service";
import { 
  scheduleService 
} from "../services/schedule.service";
import { 
  classService 
} from "../services/classService";
import { 
  teacherService 
} from "../services/teacherService";
import { 
  subjectService 
} from "../services/subjectService";
import { 
  studentService 
} from "../services/studentService";
import { 
  curriculumPlanningService 
} from "../services/curriculumPlanning.service";
import { 
  teachingJournalService 
} from "../services/teachingJournalService";
import { 
  lessonPeriodService 
} from "../services/lessonPeriod.service";
import { 
  TeachingJournal, 
  StudentAttendance, 
  Schedule, 
  LessonPeriod, 
  Student, 
  Class, 
  Subject, 
  Teacher 
} from "../types";
import { 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Send, 
  FileText, 
  Clock, 
  Users, 
  ChevronRight, 
  MessageSquare,
  AlertCircle,
  Filter,
  Check,
  X,
  ExternalLink
} from "lucide-react";

export const TeachingJournals: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const isGuru = user?.role === "guru";

  // Active Year & Semester Queries
  const { data: activeYear, isLoading: isLoadingYear } = useQuery({
    queryKey: ["activeAcademicYear"],
    queryFn: () => academicYearService.getActiveAcademicYear()
  });

  const { data: activeSemester, isLoading: isLoadingSemester } = useQuery({
    queryKey: ["activeSemester"],
    queryFn: () => semesterService.getActiveSemester()
  });

  // Master Data Queries
  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => teacherService.getTeachers()
  });

  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classService.getClasses()
  });

  const { data: subjects = [], isLoading: isLoadingSubjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => subjectService.getSubjects()
  });

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => studentService.getStudents()
  });

  const { data: lessonPeriods = [], isLoading: isLoadingPeriods } = useQuery({
    queryKey: ["lessonPeriods"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  // Load Journals Query
  const { data: journals = [], isLoading: isLoadingJournals, refetch: refetchJournals } = useQuery({
    queryKey: ["teachingJournals", activeYear?.id, activeSemester?.id],
    queryFn: () => {
      if (isGuru) {
        return teachingJournalService.getByTeacher(user?.teacherId || "", activeYear?.id, activeSemester?.id);
      } else {
        return teachingJournalService.getAll(activeYear?.id, activeSemester?.id);
      }
    },
    enabled: !!activeYear?.id && !!activeSemester?.id
  });

  // State Management
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<TeachingJournal | null>(null);

  // Filter States (For Leadership Dashboard)
  const [filterTeacher, setFilterTeacher] = useState<string>("Semua");
  const [filterClass, setFilterClass] = useState<string>("Semua");
  const [filterSubject, setFilterSubject] = useState<string>("Semua");
  const [filterStatus, setFilterStatus] = useState<string>("Semua");

  // Form State
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [schedulesForDate, setSchedulesForDate] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Prota Topic Autopopulation Helpers
  const [protaTopics, setProtaTopics] = useState<any[]>([]);
  const [selectedProtaTopicId, setSelectedProtaTopicId] = useState<string>("");

  const [formFields, setFormFields] = useState({
    material: "",
    learningObjectives: "",
    learningActivities: "",
    learningMethod: "PBL (Problem Based Learning)",
    learningMedia: "Canva, Proyektor & Buku Paket",
    assessment: "Asesmen Formatif (Kuis / LKPD)",
    reflection: "",
    followUp: "",
    supportingLink: ""
  });

  const [attendance, setAttendance] = useState<StudentAttendance>({
    hadir: 0,
    sakit: 0,
    izin: 0,
    alpha: 0,
    total: 0
  });

  // Custom Verification State
  const [verifyStatus, setVerifyStatus] = useState<"Disetujui" | "Ditolak">("Disetujui");
  const [verifyComment, setVerifyComment] = useState<string>("");
  const [isWeekEffective, setIsWeekEffective] = useState<boolean>(true);

  // Prefill check on mount or when searchParams change
  useEffect(() => {
    const prefillDate = searchParams.get("prefillDate");
    const openForm = searchParams.get("openForm");

    if (prefillDate) {
      setSelectedDate(prefillDate);
    }
    if (openForm === "true") {
      setIsFormOpen(true);
    }
  }, [searchParams]);

  // Determine active schedules on Date change
  useEffect(() => {
    if (!selectedDate || !activeYear?.id || !activeSemester?.id) return;

    const daysIndonesian = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dayName = daysIndonesian[new Date(selectedDate).getDay()];

    const fetchSchedules = async () => {
      try {
        const allScheds = await scheduleService.getSchedules(activeYear.id, activeSemester.id);
        const filtered = allScheds.filter(s => 
          s.teacherId === user?.teacherId && 
          s.day.toLowerCase() === dayName.toLowerCase()
        );
        setSchedulesForDate(filtered);
        
        const prefillScheduleId = searchParams.get("prefillScheduleId");
        if (prefillScheduleId && filtered.some(s => s.id === prefillScheduleId)) {
          setSelectedScheduleId(prefillScheduleId);
          const matchedSched = filtered.find(s => s.id === prefillScheduleId) || null;
          setSelectedSchedule(matchedSched);

          if (matchedSched) {
            const classStudents = students.filter(s => s.classId === matchedSched.classId && s.status === "Aktif");
            const count = classStudents.length;
            setAttendance({
              hadir: count,
              sakit: 0,
              izin: 0,
              alpha: 0,
              total: count
            });

            try {
              const prota = await curriculumPlanningService.getAnnualProgram(activeYear?.id || "", matchedSched.classId, matchedSched.subjectId);
              if (prota) {
                setProtaTopics(prota.topics || []);
              }
            } catch (err) {
              console.error("Prota load error:", err);
            }
          }
        } else {
          setSelectedScheduleId("");
          setSelectedSchedule(null);
          setProtaTopics([]);
          setSelectedProtaTopicId("");
        }
      } catch (error) {
        console.error("Failed to load schedules:", error);
      }
    };

    const checkEffectiveness = async () => {
      try {
        const res = await academicPlanningService.checkDateEffectiveness(
          selectedDate,
          activeYear.id,
          activeSemester.id
        );
        setIsWeekEffective(res.isEffective);
      } catch (error) {
        console.error("Failed to check date effectiveness:", error);
      }
    };

    if (isGuru) {
      fetchSchedules();
    }
    checkEffectiveness();
  }, [selectedDate, activeYear, activeSemester, isGuru, user, searchParams, students]);

  // Handle schedule selection
  const handleScheduleChange = async (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    const sched = schedulesForDate.find(s => s.id === scheduleId) || null;
    setSelectedSchedule(sched);

    if (sched) {
      // Find exact student count in class
      const classStudents = students.filter(s => s.classId === sched.classId && s.status === "Aktif");
      const count = classStudents.length;

      setAttendance({
        hadir: count,
        sakit: 0,
        izin: 0,
        alpha: 0,
        total: count
      });

      // Load Prota topics to offer auto-populate helper
      try {
        const prota = await curriculumPlanningService.getAnnualProgram(activeYear?.id || "", sched.classId, sched.subjectId);
        if (prota && prota.topics) {
          // Filter topics for the active semester
          const currentSemesterName = activeSemester?.name || "Ganjil";
          const isGanjil = currentSemesterName.includes("1") || currentSemesterName.toLowerCase().includes("ganjil");
          const isGenap = currentSemesterName.includes("2") || currentSemesterName.toLowerCase().includes("genap");

          const filteredTopics = prota.topics.filter(t => {
            if (t.semester === "Ganjil & Genap") return true;
            if (isGanjil && t.semester === "Ganjil") return true;
            if (isGenap && t.semester === "Genap") return true;
            return t.semester.toLowerCase() === currentSemesterName.toLowerCase();
          });
          setProtaTopics(filteredTopics);
        } else {
          setProtaTopics([]);
        }
        setSelectedProtaTopicId("");
      } catch (err) {
        console.error("Failed to fetch Prota:", err);
        setProtaTopics([]);
      }
    } else {
      setProtaTopics([]);
      setSelectedProtaTopicId("");
    }
  };

  // Handle topic auto-fill helper selection
  const handleProtaTopicChange = (topicId: string) => {
    setSelectedProtaTopicId(topicId);
    const topic = protaTopics.find(t => t.id === topicId);
    if (topic) {
      setFormFields(prev => ({
        ...prev,
        material: topic.title,
        learningObjectives: topic.description || ""
      }));
      toast("Data materi dan tujuan pembelajaran berhasil disinkronisasi dari Prota/Promes!", "success");
    }
  };

  // Update attendance values safely
  const handleAttendanceChange = (field: keyof Omit<StudentAttendance, "total">, value: number) => {
    const num = Math.max(0, value);
    setAttendance(prev => {
      const updated = {
        ...prev,
        [field]: num
      };
      updated.total = updated.hadir + updated.sakit + updated.izin + updated.alpha;
      return updated;
    });
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newJournal: Omit<TeachingJournal, "id" | "createdAt" | "updatedAt">) => 
      teachingJournalService.create(newJournal),
    onSuccess: () => {
      toast("Jurnal Mengajar berhasil disimpan!", "success");
      queryClient.invalidateQueries({ queryKey: ["teachingJournals"] });
      setIsFormOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal menyimpan jurnal: " + err.message, "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<TeachingJournal> }) => 
      teachingJournalService.update(id, data),
    onSuccess: () => {
      toast("Jurnal Mengajar berhasil diperbarui!", "success");
      queryClient.invalidateQueries({ queryKey: ["teachingJournals"] });
      setIsFormOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal memperbarui jurnal: " + err.message, "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachingJournalService.delete(id),
    onSuccess: () => {
      toast("Jurnal Mengajar berhasil dihapus!", "success");
      queryClient.invalidateQueries({ queryKey: ["teachingJournals"] });
      setIsDeleteOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal menghapus jurnal: " + err.message, "error");
    }
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status, comment }: { id: string, status: "Disetujui" | "Ditolak", comment: string }) => 
      teachingJournalService.changeStatus(id, status, user?.userId || "system", comment),
    onSuccess: () => {
      toast(`Jurnal berhasil diverifikasi dengan status: ${verifyStatus}!`, "success");
      queryClient.invalidateQueries({ queryKey: ["teachingJournals"] });
      setIsVerifyOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal memproses verifikasi: " + err.message, "error");
    }
  });

  // Handle Form Submission
  const handleSubmit = (status: "Draft" | "Diajukan") => {
    if (!selectedSchedule && !selectedJournal) {
      toast("Jadwal mengajar belum dipilih!", "error");
      return;
    }

    if (!formFields.material.trim()) {
      toast("Materi yang diajarkan wajib diisi!", "error");
      return;
    }

    if (!formFields.learningObjectives.trim()) {
      toast("Tujuan pembelajaran wajib diisi!", "error");
      return;
    }

    if (!formFields.learningActivities.trim()) {
      toast("Aktivitas pembelajaran wajib diisi!", "error");
      return;
    }

    if (!formFields.reflection.trim()) {
      toast("Refleksi pembelajaran wajib diisi!", "error");
      return;
    }

    if (!formFields.followUp.trim()) {
      toast("Tindak lanjut wajib diisi!", "error");
      return;
    }

    // Attendance validation matching actual active students
    const targetSched = selectedSchedule || (journals.find(j => j.id === selectedJournal?.id) as any);
    const classStudents = students.filter(s => s.classId === targetSched.classId && s.status === "Aktif");
    if (attendance.total !== classStudents.length) {
      const confirmSubmit = window.confirm(
        `Total kehadiran (${attendance.total}) tidak sama dengan jumlah siswa aktif di kelas (${classStudents.length}). Tetap simpan?`
      );
      if (!confirmSubmit) return;
    }

    const daysIndonesian = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dayName = daysIndonesian[new Date(selectedDate).getDay()];

    const payload = {
      teacherId: user?.teacherId || "GURU_ALM_01",
      teacherName: user?.teacherName || user?.displayName || "Guru Pengampu",
      academicYearId: activeYear?.id || "",
      academicYearName: activeYear?.year || "",
      semesterId: activeSemester?.id || "",
      semesterName: activeSemester?.name || "",
      date: selectedDate,
      dayName,
      classId: targetSched.classId,
      className: targetSched.className,
      subjectId: targetSched.subjectId,
      subjectName: targetSched.subjectName,
      lessonPeriodIds: targetSched.lessonPeriodId ? [targetSched.lessonPeriodId] : (targetSched.lessonPeriodIds || []),
      lessonPeriods: targetSched.jp || targetSched.lessonPeriods || "JP",
      startTime: targetSched.startTime || "",
      endTime: targetSched.endTime || "",
      totalJP: Number(formFields.supportingLink ? 2 : 1), // default logic or let editable
      ...formFields,
      studentAttendance: attendance,
      status,
      createdBy: user?.userId || "system",
      updatedBy: user?.userId || "system"
    };

    if (selectedJournal) {
      updateMutation.mutate({
        id: selectedJournal.id,
        data: {
          ...payload,
          updatedBy: user?.userId || "system",
          // Reset comment if resubmitting to Diajukan
          ...(status === "Diajukan" ? { verificationComment: "" } : {})
        } as any
      });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  // Edit Journal Loader
  const handleEditOpen = (journal: TeachingJournal) => {
    setSelectedJournal(journal);
    setSelectedDate(journal.date);
    setSelectedScheduleId("");
    setSelectedSchedule(null);
    setFormFields({
      material: journal.material,
      learningObjectives: journal.learningObjectives,
      learningActivities: journal.learningActivities,
      learningMethod: journal.learningMethod,
      learningMedia: journal.learningMedia,
      assessment: journal.assessment,
      reflection: journal.reflection,
      followUp: journal.followUp,
      supportingLink: journal.supportingLink
    });
    setAttendance(journal.studentAttendance);
    setIsFormOpen(true);
  };

  // Open Verify Modal
  const handleVerifyOpen = (journal: TeachingJournal) => {
    setSelectedJournal(journal);
    setVerifyStatus("Disetujui");
    setVerifyComment("");
    setIsVerifyOpen(true);
  };

  // Metrics calculations
  const metrics: Record<string, { title: string; value: number | string; icon: any; color: "blue" | "emerald" | "green" | "rose" | "amber" }> = useMemo(() => {
    if (isGuru) {
      const myJournals = journals.filter(j => j.teacherId === user?.teacherId);
      const totalJP = myJournals.reduce((sum, j) => sum + (j.totalJP || 0), 0);
      const approved = myJournals.filter(j => j.status === "Disetujui").length;
      const pending = myJournals.filter(j => j.status === "Diajukan").length;
      return {
        card1: { title: "Total Jurnal Semester Ini", value: myJournals.length, icon: FileText, color: "blue" },
        card2: { title: "Total JP Mengajar", value: totalJP, icon: Clock, color: "emerald" },
        card3: { title: "Jurnal Disetujui", value: approved, icon: CheckCircle, color: "green" },
        card4: { title: "Menunggu Verifikasi", value: pending, icon: AlertCircle, color: "amber" }
      };
    } else {
      const pending = journals.filter(j => j.status === "Diajukan").length;
      const approved = journals.filter(j => j.status === "Disetujui").length;
      const rejected = journals.filter(j => j.status === "Ditolak").length;
      return {
        card1: { title: "Total Jurnal Diajukan", value: journals.length, icon: FileText, color: "blue" },
        card2: { title: "Verifikasi Tertunda", value: pending, icon: AlertCircle, color: "amber" },
        card3: { title: "Disetujui", value: approved, icon: CheckCircle, color: "green" },
        card4: { title: "Ditolak", value: rejected, icon: XCircle, color: "rose" }
      };
    }
  }, [journals, isGuru, user]);

  // Filter Journals list
  const filteredJournals = useMemo(() => {
    return journals.filter(j => {
      const matchTeacher = filterTeacher === "Semua" || j.teacherId === filterTeacher;
      const matchClass = filterClass === "Semua" || j.classId === filterClass;
      const matchSubject = filterSubject === "Semua" || j.subjectId === filterSubject;
      const matchStatus = filterStatus === "Semua" || j.status === filterStatus;
      return matchTeacher && matchClass && matchSubject && matchStatus;
    });
  }, [journals, filterTeacher, filterClass, filterSubject, filterStatus]);

  // Loading indicator for foundation queries
  if (isLoadingYear || isLoadingSemester || isLoadingTeachers || isLoadingClasses || isLoadingSubjects || isLoadingStudents || isLoadingPeriods || isLoadingJournals) {
    return <Loading text="Memuat data Jurnal Mengajar..." />;
  }

  // Warning when Active Terms are missing
  if (!activeYear || !activeSemester) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl text-center shadow-xs">
        <AlertCircle className="h-16 w-16 text-rose-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Tahun Ajaran atau Semester Aktif Belum Diatur</h3>
        <p className="text-gray-500 dark:text-zinc-400 max-w-md">Harap atur Tahun Ajaran dan Semester aktif terlebih dahulu di menu pengaturan administrator sebelum dapat mengakses Jurnal Mengajar.</p>
      </div>
    );
  }

  // columns setup for DataTable
  const columns: Column<TeachingJournal>[] = [
    {
      header: "Tanggal & Hari",
      accessor: (j) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-zinc-200">{new Date(j.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{j.dayName}</span>
        </div>
      ),
      sortable: true,
      sortKey: "date"
    },
    ...(!isGuru ? [{
      header: "Nama Guru",
      accessor: (j: TeachingJournal) => j.teacherName,
      sortable: true,
      sortKey: "teacherName" as keyof TeachingJournal
    }] : []),
    {
      header: "Kelas",
      accessor: (j: TeachingJournal) => j.className,
      sortable: true,
      sortKey: "className" as keyof TeachingJournal
    },
    {
      header: "Mata Pelajaran",
      accessor: (j: TeachingJournal) => j.subjectName,
      sortable: true,
      sortKey: "subjectName" as keyof TeachingJournal
    },
    {
      header: "Materi & Objectives",
      accessor: (j) => (
        <div className="max-w-xs truncate flex flex-col">
          <span className="font-semibold text-slate-700 dark:text-zinc-300 truncate">{j.material}</span>
          <span className="text-xs text-slate-400 truncate">{j.learningObjectives}</span>
        </div>
      )
    },
    {
      header: "Presensi",
      accessor: (j) => (
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded" title="Hadir">H:{j.studentAttendance?.hadir || 0}</span>
          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded" title="Sakit">S:{j.studentAttendance?.sakit || 0}</span>
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded" title="Izin">I:{j.studentAttendance?.izin || 0}</span>
          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 rounded" title="Alpha">A:{j.studentAttendance?.alpha || 0}</span>
        </div>
      )
    },
    {
      header: "Status",
      accessor: (j) => {
        const styles = {
          Draft: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300",
          Diajukan: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
          Disetujui: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
          Ditolak: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
        };
        return (
          <div className="flex flex-col gap-1">
            <span className={`px-2.5 py-1 text-xs font-bold rounded-xl inline-block w-fit ${styles[j.status]}`}>
              {j.status}
            </span>
            {j.status === "Ditolak" && j.verificationComment && (
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold max-w-[150px] truncate" title={j.verificationComment}>
                Feedback: "{j.verificationComment}"
              </span>
            )}
          </div>
        );
      },
      sortable: true
    }
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Jurnal Mengajar Guru</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Modul pencatatan, pemantauan, dan verifikasi jurnal mengajar guru terintegrasi prota/promes.</p>
        </div>
        {isGuru && (
          <button
            onClick={() => {
              setSelectedJournal(null);
              setSelectedDate(new Date().toISOString().split("T")[0]);
              setFormFields({
                material: "",
                learningObjectives: "",
                learningActivities: "",
                learningMethod: "PBL (Problem Based Learning)",
                learningMedia: "Canva, Proyektor & Buku Paket",
                assessment: "Asesmen Formatif (Kuis / LKPD)",
                reflection: "",
                followUp: "",
                supportingLink: ""
              });
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md shadow-blue-500/15 cursor-pointer transition-all hover:scale-[1.02]"
          >
            <Plus className="h-4.5 w-4.5" />
            Tulis Jurnal Harian
          </button>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(metrics).map(([key, item]) => {
          const Icon = item.icon;
          const colors = {
            blue: "bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/30 dark:text-blue-400",
            emerald: "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400",
            green: "bg-green-50 border-green-100 text-green-600 dark:bg-green-950/20 dark:border-green-900/30 dark:text-green-400",
            rose: "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400",
            amber: "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400"
          };

          return (
            <div key={key} className="flex items-center p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
              <div className={`p-3 rounded-xl border mr-4 ${colors[item.color]}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{item.value}</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase mt-1 tracking-wider">{item.title}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters (Leadership side only) */}
      {!isGuru && (
        <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-zinc-200 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <Filter className="h-4.5 w-4.5 text-blue-500" />
            Panel Filter Jurnal Mengajar
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <FormSelect
              label="Pilih Guru"
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              options={[
                { value: "Semua", label: "Semua Guru" },
                ...teachers.map(t => ({ value: t.id, label: t.name }))
              ]}
            />
            <FormSelect
              label="Pilih Kelas"
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              options={[
                { value: "Semua", label: "Semua Kelas" },
                ...classes.map(c => ({ value: c.id, label: c.name }))
              ]}
            />
            <FormSelect
              label="Pilih Mata Pelajaran"
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              options={[
                { value: "Semua", label: "Semua Mata Pelajaran" },
                ...subjects.map(s => ({ value: s.id, label: s.name }))
              ]}
            />
            <FormSelect
              label="Status Jurnal"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={[
                { value: "Semua", label: "Semua Status" },
                { value: "Draft", label: "Draft" },
                { value: "Diajukan", label: "Diajukan" },
                { value: "Disetujui", label: "Disetujui" },
                { value: "Ditolak", label: "Ditolak" }
              ]}
            />
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-500" />
          Daftar Jurnal Mengajar ({filteredJournals.length})
        </h3>
        <DataTable
          data={filteredJournals}
          columns={columns}
          rowKey={(j) => j.id}
          searchKeys={["teacherName", "className", "subjectName", "material"]}
          searchPlaceholder="Cari berdasarkan Guru, Kelas, Mapel, atau Materi..."
          actions={(j) => (
            <div className="flex justify-end items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedJournal(j);
                  setIsDetailOpen(true);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Lihat Detail Jurnal"
              >
                <Eye className="h-4 w-4" />
              </button>

              {isGuru && j.status === "Draft" && (
                <button
                  onClick={() => handleEditOpen(j)}
                  className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 rounded-lg transition-colors cursor-pointer"
                  title="Edit Jurnal"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}

              {isGuru && j.status === "Ditolak" && (
                <button
                  onClick={() => handleEditOpen(j)}
                  className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 rounded-lg transition-colors cursor-pointer"
                  title="Revisi Jurnal"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}

              {isGuru && j.status === "Draft" && (
                <button
                  onClick={() => {
                    setSelectedJournal(j);
                    setIsDeleteOpen(true);
                  }}
                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 rounded-lg transition-colors cursor-pointer"
                  title="Hapus Jurnal"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {!isGuru && j.status === "Diajukan" && (
                <button
                  onClick={() => handleVerifyOpen(j)}
                  className="px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  title="Verifikasi Jurnal"
                >
                  Verifikasi
                </button>
              )}
            </div>
          )}
        />
      </div>

      {/* Write/Edit Journal Form Dialog */}
      <Dialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={selectedJournal ? "Edit/Revisi Jurnal Mengajar" : "Tulis Jurnal Mengajar Harian"}
        size="2xl"
      >
        <div className="space-y-6">
          {!isWeekEffective && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-900 rounded-xl">
              <span className="flex-shrink-0 inline-block h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
              <div className="text-xs">
                <span className="font-bold uppercase tracking-wider mr-1.5">Minggu Tidak Efektif:</span>
                <span className="font-medium text-red-700 dark:text-red-400">Jurnal tetap dapat dibuat, tetapi pekan ini terhitung sebagai pekan tidak efektif belajar.</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              type="date"
              label="Pilih Tanggal Pembelajaran"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
            />

            {!selectedJournal && (
              <FormSelect
                label="Pilih Jadwal Mengajar Anda Pada Tanggal Ini"
                value={selectedScheduleId}
                onChange={(e) => handleScheduleChange(e.target.value)}
                required
                options={[
                  { value: "", label: "-- Pilih Jadwal --" },
                  ...schedulesForDate.map(s => ({
                    value: s.id,
                    label: `${s.jp} - ${s.subjectName} (${s.className})`
                  }))
                ]}
              />
            )}
          </div>

          {/* Autopopulation Helper Dropdown */}
          {protaTopics.length > 0 && !selectedJournal && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 rounded-xl space-y-2">
              <label className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider block">Asisten Prota/Promes Terdeteksi</label>
              <FormSelect
                label="Pilih topik dari rencana Prota/Promes untuk otomatis mengisi form"
                value={selectedProtaTopicId}
                onChange={(e) => handleProtaTopicChange(e.target.value)}
                options={[
                  { value: "", label: "-- Pilih Topik Pembelajaran --" },
                  ...protaTopics.map(t => ({ value: t.id, label: t.title }))
                ]}
              />
            </div>
          )}

          {/* Auto-filled details info strip */}
          {(selectedSchedule || selectedJournal) && (
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-500 uppercase block">Mata Pelajaran</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  {selectedSchedule?.subjectName || selectedJournal?.subjectName}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase block">Kelas</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  {selectedSchedule?.className || selectedJournal?.className}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase block">Jam Mengajar</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  {selectedSchedule?.jp || selectedJournal?.lessonPeriods}
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase block">Waktu</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  {selectedSchedule ? `${selectedSchedule.startTime || "07:00"} - ${selectedSchedule.endTime || "07:40"}` : `${selectedJournal?.startTime || "07:00"} - ${selectedJournal?.endTime || "07:40"}`}
                </span>
              </div>
            </div>
          )}

          {/* Form Fields Inputs */}
          <div className="space-y-4">
            <FormInput
              type="text"
              label="Materi yang Diajarkan"
              value={formFields.material}
              onChange={(e) => setFormFields(prev => ({ ...prev, material: e.target.value }))}
              placeholder="Contoh: Operasi Aljabar, Persamaan Linier, atau teks bacaan..."
              required
            />

            <FormTextarea
              label="Tujuan Pembelajaran"
              value={formFields.learningObjectives}
              onChange={(e) => setFormFields(prev => ({ ...prev, learningObjectives: e.target.value }))}
              placeholder="Contoh: Siswa mampu melakukan penyelesaian masalah persamaan linier..."
              required
            />

            <FormTextarea
              label="Aktivitas Pembelajaran"
              value={formFields.learningActivities}
              onChange={(e) => setFormFields(prev => ({ ...prev, learningActivities: e.target.value }))}
              placeholder="Langkah-langkah KBM (Pendahuluan, Inti, Penutup)..."
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput
                type="text"
                label="Metode Pembelajaran"
                value={formFields.learningMethod}
                onChange={(e) => setFormFields(prev => ({ ...prev, learningMethod: e.target.value }))}
                required
              />
              <FormInput
                type="text"
                label="Media Pembelajaran"
                value={formFields.learningMedia}
                onChange={(e) => setFormFields(prev => ({ ...prev, learningMedia: e.target.value }))}
                required
              />
              <FormInput
                type="text"
                label="Asesmen / Penilaian"
                value={formFields.assessment}
                onChange={(e) => setFormFields(prev => ({ ...prev, assessment: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormTextarea
                label="Refleksi Guru"
                value={formFields.reflection}
                onChange={(e) => setFormFields(prev => ({ ...prev, reflection: e.target.value }))}
                placeholder="Evaluasi KBM: apa yang sudah baik, apa kendalanya..."
                required
              />
              <FormTextarea
                label="Rencana Tindak Lanjut"
                value={formFields.followUp}
                onChange={(e) => setFormFields(prev => ({ ...prev, followUp: e.target.value }))}
                placeholder="Langkah perbaikan: remidial, pengayaan, tugas rumah..."
                required
              />
            </div>

            {/* Attendance Aggregate Input Section */}
            <div className="p-5 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-blue-500" />
                  Presensi & Kehadiran Kelas
                </span>
                <span className="text-xs text-slate-500 font-bold bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 px-2.5 py-1 rounded-xl">
                  Total Terisi: {attendance.total} siswa
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <FormInput
                  type="number"
                  label="Hadir (H)"
                  value={attendance.hadir}
                  onChange={(e) => handleAttendanceChange("hadir", parseInt(e.target.value) || 0)}
                  required
                />
                <FormInput
                  type="number"
                  label="Sakit (S)"
                  value={attendance.sakit}
                  onChange={(e) => handleAttendanceChange("sakit", parseInt(e.target.value) || 0)}
                  required
                />
                <FormInput
                  type="number"
                  label="Izin (I)"
                  value={attendance.izin}
                  onChange={(e) => handleAttendanceChange("izin", parseInt(e.target.value) || 0)}
                  required
                />
                <FormInput
                  type="number"
                  label="Alpha (A)"
                  value={attendance.alpha}
                  onChange={(e) => handleAttendanceChange("alpha", parseInt(e.target.value) || 0)}
                  required
                />
              </div>
            </div>

            <FormInput
              type="text"
              label="Tautan Pendukung Pembelajaran (Supporting Link / Drive)"
              value={formFields.supportingLink}
              onChange={(e) => setFormFields(prev => ({ ...prev, supportingLink: e.target.value }))}
              placeholder="Contoh: https://drive.google.com/drive/folders/..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => handleSubmit("Draft")}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-xl cursor-pointer transition-colors"
            >
              Simpan Draft
            </button>
            <button
              onClick={() => handleSubmit("Diajukan")}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md shadow-blue-500/15 cursor-pointer transition-colors"
            >
              <Send className="h-4 w-4" />
              Ajukan Sekarang
            </button>
          </div>
        </div>
      </Dialog>

      {/* Detail Jurnal View Dialog */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Detail Jurnal Mengajar Guru"
        size="lg"
      >
        {selectedJournal && (
          <div className="space-y-6">
            {/* Top header stats */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-500 uppercase">Nama Guru</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">{selectedJournal.teacherName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase">Tanggal / Hari</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">
                  {new Date(selectedJournal.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ({selectedJournal.dayName})
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase">Mata Pelajaran / Kelas</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">{selectedJournal.subjectName} / {selectedJournal.className}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase">Alokasi JP / Jam</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">{selectedJournal.lessonPeriods} ({selectedJournal.startTime} - {selectedJournal.endTime})</span>
              </div>
            </div>

            {/* Core learning details */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Materi Pokok</span>
                <p className="text-base font-bold text-slate-800 dark:text-zinc-200 mt-1">{selectedJournal.material}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tujuan Pembelajaran</span>
                <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-1 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-slate-150 dark:border-zinc-800 whitespace-pre-wrap">{selectedJournal.learningObjectives}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Aktivitas Pembelajaran</span>
                <p className="text-sm text-slate-700 dark:text-zinc-300 mt-1 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-slate-150 dark:border-zinc-800 whitespace-pre-wrap">{selectedJournal.learningActivities}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/30 border border-slate-150 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Metode</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 block mt-1">{selectedJournal.learningMethod}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/30 border border-slate-150 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Media</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 block mt-1">{selectedJournal.learningMedia}</span>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-zinc-800/30 border border-slate-150 dark:border-zinc-800 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Asesmen</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 block mt-1">{selectedJournal.assessment}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Refleksi Pembelajaran</span>
                  <p className="text-sm text-slate-700 dark:text-zinc-300 mt-1 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-slate-150 dark:border-zinc-800 whitespace-pre-wrap">{selectedJournal.reflection}</p>
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Rencana Tindak Lanjut</span>
                  <p className="text-sm text-slate-700 dark:text-zinc-300 mt-1 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-slate-150 dark:border-zinc-800 whitespace-pre-wrap">{selectedJournal.followUp}</p>
                </div>
              </div>

              {/* Attendance and link summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Presensi Kelas</span>
                    <div className="flex items-center gap-1.5 text-xs font-bold mt-2">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 rounded">H: {selectedJournal.studentAttendance?.hadir || 0}</span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 rounded">S: {selectedJournal.studentAttendance?.sakit || 0}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded">I: {selectedJournal.studentAttendance?.izin || 0}</span>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 rounded">A: {selectedJournal.studentAttendance?.alpha || 0}</span>
                    </div>
                  </div>
                  <span className="text-sm font-extrabold text-slate-500 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-zinc-800">
                    {selectedJournal.studentAttendance?.total || 0} Siswa
                  </span>
                </div>

                {selectedJournal.supportingLink && (
                  <div className="p-4 bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">Bukti KBM (Tautan)</span>
                      <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 mt-1 block truncate max-w-[200px]">
                        {selectedJournal.supportingLink}
                      </span>
                    </div>
                    <a
                      href={selectedJournal.supportingLink}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>

              {/* Verification summary if reviewed */}
              {(selectedJournal.status === "Disetujui" || selectedJournal.status === "Ditolak") && (
                <div className={`p-4 rounded-xl border ${selectedJournal.status === "Disetujui" ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:text-emerald-300" : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:border-rose-800/40 dark:text-rose-300"}`}>
                  <span className="text-xs font-bold uppercase tracking-wider block flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" />
                    Feedback Verifikasi Pimpinan
                  </span>
                  <p className="text-sm font-semibold mt-1.5">
                    "{selectedJournal.verificationComment || "Tidak ada komentar ditambahkan."}"
                  </p>
                  <span className="text-[10px] opacity-75 font-medium mt-2 block">
                    Diverifikasi oleh admin/pimpinan pada {selectedJournal.verifiedAt ? new Date(selectedJournal.verifiedAt).toLocaleString("id-ID") : "-"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 dark:border-zinc-800 pt-4">
              <button
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Verification Dialog (Leadership side only) */}
      <Dialog
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        title="Verifikasi Jurnal Mengajar Guru"
        size="lg"
      >
        {selectedJournal && (
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-150 dark:border-amber-900/40 p-4 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-300">
              Tinjau dengan seksama seluruh kelengkapan jurnal di bawah sebelum melakukan persetujuan/penolakan.
            </div>

            {/* Read-only summaries */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-slate-400">GURU PENGAMPU</span>
                <span className="text-slate-800 dark:text-zinc-200">{selectedJournal.teacherName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MAPEL / KELAS</span>
                <span className="text-slate-800 dark:text-zinc-200">{selectedJournal.subjectName} / {selectedJournal.className}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">TANGGAL</span>
                <span className="text-slate-800 dark:text-zinc-200">{selectedJournal.date} ({selectedJournal.dayName})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MATERI POKOK</span>
                <span className="text-slate-800 dark:text-zinc-200 text-right max-w-xs truncate">{selectedJournal.material}</span>
              </div>
            </div>

            {/* Verification Inputs Form */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Keputusan Verifikasi</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setVerifyStatus("Disetujui")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      verifyStatus === "Disetujui"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-600 dark:text-emerald-200"
                        : "bg-white border-slate-200 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <Check className="h-5 w-5 text-emerald-500" />
                    Setujui Jurnal
                  </button>
                  <button
                    onClick={() => setVerifyStatus("Ditolak")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      verifyStatus === "Ditolak"
                        ? "bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950/30 dark:border-rose-600 dark:text-rose-200"
                        : "bg-white border-slate-200 hover:bg-slate-50 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <X className="h-5 w-5 text-rose-500" />
                    Tolak / Beri Revisi
                  </button>
                </div>
              </div>

              <FormTextarea
                label="Catatan / Feedback Verifikasi (Wajib jika menolak)"
                value={verifyComment}
                onChange={(e) => setVerifyComment(e.target.value)}
                placeholder="Berikan arahan perbaikan jika jurnal ditolak, atau apresiasi/evaluasi ringkas..."
                required={verifyStatus === "Ditolak"}
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-150 dark:border-zinc-800 pt-4">
              <button
                onClick={() => setIsVerifyOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-850 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (verifyStatus === "Ditolak" && !verifyComment.trim()) {
                    toast("Catatan verifikasi wajib diisi untuk penolakan/revisi!", "error");
                    return;
                  }
                  verifyMutation.mutate({
                    id: selectedJournal.id,
                    status: verifyStatus,
                    comment: verifyComment
                  });
                }}
                disabled={verifyMutation.isPending}
                className={`px-5 py-2 font-bold rounded-xl text-white shadow-md transition-all cursor-pointer ${verifyStatus === "Disetujui" ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/15" : "bg-rose-600 hover:bg-rose-500 shadow-rose-600/15"}`}
              >
                Simpan Verifikasi
              </button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus Jurnal Mengajar"
        size="sm"
      >
        <div className="space-y-6 text-center">
          <div className="mx-auto h-12 w-12 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-full flex items-center justify-center text-rose-600 mb-4 animate-pulse">
            <Trash2 className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">Apakah Anda yakin ingin menghapus jurnal ini?</h4>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">Tindakan ini permanen dan tidak dapat dibatalkan di kemudian hari.</p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => deleteMutation.mutate(selectedJournal?.id || "")}
              disabled={deleteMutation.isPending}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl shadow-md shadow-rose-600/15 cursor-pointer transition-colors"
            >
              Ya, Hapus Permanen
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default TeachingJournals;
