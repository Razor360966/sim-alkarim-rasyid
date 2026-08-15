import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { studentService } from "../services/studentService";
import { eRaporService } from "../services/eRapor.service";
import { schoolIdentityService } from "../services/schoolIdentity.service";
import { Student, Class, AcademicYear, Semester } from "../types";
import { ERaporSettingsConfig } from "../types/eRapor.types";
import {
  calculateStudentBiodataCompleteness,
  StudentBiodataCompletenessResult
} from "../utils/studentBiodata.utils";
import { ERaporCoverPrintable } from "../components/ERaporCoverPrintable";
import { ERaporStudentBiodataPrintable } from "../components/ERaporStudentBiodataPrintable";
import {
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Edit3,
  Eye,
  Search,
  Filter,
  Save,
  X,
  FileText,
  Sliders,
  ShieldAlert,
  Info,
  CheckSquare,
  Sparkles,
  BookOpen,
  Calendar,
  Users
} from "lucide-react";

export default function ERaporStudentBiodataPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Data State
  const [students, setStudents] = useState<Student[]>([]);
  const [printConfig, setPrintConfig] = useState<ERaporSettingsConfig | undefined>(undefined);
  const [schoolIdentity, setSchoolIdentity] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "KELENGKAPAN" | "EDIT" | "CETAK_COVER" | "CETAK_BIODATA" | "KESIAPAN"
  >("KELENGKAPAN");

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Student Selection for Edit / Detail Modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);

  // Print Selection
  const [printStudentId, setPrintStudentId] = useState<string>("ALL"); // "ALL" or studentId
  const [coverType, setCoverType] = useState<"UMUM" | "PONDOK">("UMUM");

  // Biodata Print Override Config
  const [biodataPaperSize, setBiodataPaperSize] = useState<"A4" | "F4">("A4");
  const [biodataOrientation, setBiodataOrientation] = useState<"portrait" | "landscape">("portrait");

  // Warning Modal Before Print
  const [showIncompleteWarningModal, setShowIncompleteWarningModal] = useState<boolean>(false);
  const [pendingPrintAction, setPendingPrintAction] = useState<"COVER" | "BIODATA" | null>(null);

  // Read Access Check
  const isAdminOrKurikulum = useMemo(() => {
    const r = (user?.role || "").toLowerCase();
    return (
      r === "admin" ||
      r === "pimpinan" ||
      r === "kepala sekolah" ||
      r === "wakil kepala sekolah" ||
      r === "operator"
    );
  }, [user]);

  // Homeroom class identification
  const assignedHomeroomClass = useMemo(() => {
    if (!user?.uid) return null;
    return classes.find(
      (c) =>
        c.homeroomTeacherId === user.uid ||
        c.waliKelasId === user.uid ||
        (c.homeroomTeacherName && user.teacherName && c.homeroomTeacherName === user.teacherName)
    );
  }, [classes, user]);

  const isHomeroomTeacher = !!assignedHomeroomClass;
  const canAccess = isAdminOrKurikulum || isHomeroomTeacher;

  // 1. Initial Data Loading
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const [years, sems, allClasses, eSettings, sIdent] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters(),
          classService.getClasses(),
          eRaporService.getSettings(),
          schoolIdentityService.getIdentity()
        ]);

        setAcademicYears(years);
        setSemesters(sems);

        const activeYr = years.find((y) => y.isActive) || years[0];
        const activeSem = sems.find((s) => s.isActive) || sems[0];

        if (activeYr) setSelectedAcademicYearId(activeYr.id!);
        if (activeSem) setSelectedSemesterId(activeSem.id!);

        setPrintConfig(eSettings);
        setSchoolIdentity(sIdent);

        // Class Selection Logic
        if (!isAdminOrKurikulum && user?.uid) {
          const hrClass = allClasses.find(
            (c) =>
              c.homeroomTeacherId === user.uid ||
              c.waliKelasId === user.uid ||
              (c.homeroomTeacherName && user.teacherName && c.homeroomTeacherName === user.teacherName)
          );
          setClasses(hrClass ? [hrClass] : allClasses);
          if (hrClass) setSelectedClassId(hrClass.id!);
          else if (allClasses.length > 0) setSelectedClassId(allClasses[0].id!);
        } else {
          setClasses(allClasses);
          if (allClasses.length > 0) setSelectedClassId(allClasses[0].id!);
        }
      } catch (e) {
        console.error("Error initializing student biodata page:", e);
        toast({
          title: "Gagal Memuat Data",
          description: "Terjadi kesalahan saat memuat master data.",
          type: "error"
        });
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [user, isAdminOrKurikulum]);

  // 2. Fetch Students when selectedClassId changes
  useEffect(() => {
    async function loadStudents() {
      if (!selectedClassId) {
        setStudents([]);
        return;
      }
      try {
        const allStudents = await studentService.getStudents();
        const filtered = allStudents.filter(
          (s) => s.classId === selectedClassId && s.status === "Aktif"
        );
        setStudents(filtered);
      } catch (e) {
        console.error("Error loading students:", e);
      }
    }
    loadStudents();
  }, [selectedClassId]);

  // Calculate Completeness for all students in the class
  const studentCompletenessList = useMemo(() => {
    return students.map((std) => ({
      student: std,
      completeness: calculateStudentBiodataCompleteness(std)
    }));
  }, [students]);

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const total = studentCompletenessList.length;
    let lengkapCount = 0;
    let sebagianCount = 0;
    let belumCount = 0;

    studentCompletenessList.forEach((item) => {
      if (item.completeness.status === "LENGKAP") lengkapCount++;
      else if (item.completeness.status === "SEBAGIAN") sebagianCount++;
      else belumCount++;
    });

    const totalPercentage =
      total > 0
        ? Math.round(
            (studentCompletenessList.reduce((acc, curr) => acc + curr.completeness.percentage, 0) /
              (total * 100)) *
              100
          )
        : 0;

    return {
      total,
      lengkapCount,
      sebagianCount,
      belumCount,
      totalPercentage
    };
  }, [studentCompletenessList]);

  // Filtered student list by search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return studentCompletenessList;
    const term = searchTerm.toLowerCase();
    return studentCompletenessList.filter(
      (item) =>
        item.student.name.toLowerCase().includes(term) ||
        (item.student.nis && item.student.nis.toLowerCase().includes(term)) ||
        (item.student.nisn && item.student.nisn.toLowerCase().includes(term))
    );
  }, [studentCompletenessList, searchTerm]);

  // Active selected class object
  const currentClassObj = useMemo(() => {
    return classes.find((c) => c.id === selectedClassId);
  }, [classes, selectedClassId]);

  const currentAcademicYearObj = useMemo(() => {
    return academicYears.find((y) => y.id === selectedAcademicYearId);
  }, [academicYears, selectedAcademicYearId]);

  const currentSemesterObj = useMemo(() => {
    return semesters.find((s) => s.id === selectedSemesterId);
  }, [semesters, selectedSemesterId]);

  // Students to Print
  const printStudents = useMemo(() => {
    if (printStudentId === "ALL") {
      return students;
    }
    return students.filter((s) => s.id === printStudentId);
  }, [students, printStudentId]);

  // Save Student Edit Form
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (!editingStudent.name.trim()) {
      toast({
        title: "Peringatan",
        description: "Nama siswa tidak boleh kosong.",
        type: "error"
      });
      return;
    }

    setIsSaving(true);
    try {
      await studentService.updateStudent(editingStudent.id, {
        name: editingStudent.name,
        nis: editingStudent.nis || "",
        nisn: editingStudent.nisn || "",
        gender: editingStudent.gender,
        birthPlace: editingStudent.birthPlace || "",
        birthDate: editingStudent.birthDate || "",
        address: editingStudent.address || "",
        nik: editingStudent.nik || "",
        religion: editingStudent.religion || "Islam",
        fatherName: editingStudent.fatherName || "",
        motherName: editingStudent.motherName || "",
        guardianName: editingStudent.guardianName || "",
        parentPhone: editingStudent.parentPhone || "",
        village: editingStudent.village || "",
        district: editingStudent.district || "",
        city: editingStudent.city || "",
        province: editingStudent.province || "",
        photoUrl: editingStudent.photoUrl || ""
      });

      // Update local state dynamically
      setStudents((prev) =>
        prev.map((s) => (s.id === editingStudent.id ? { ...editingStudent } : s))
      );

      toast({
        title: "Berhasil",
        description: `Biodata ${editingStudent.name} berhasil diperbarui. Status kelengkapan otomatis diperbarui.`,
        type: "success"
      });

      setEditingStudent(null);
      setActiveTab("KELENGKAPAN");
    } catch (err) {
      console.error("Gagal menyimpan biodata:", err);
      toast({
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan data ke server.",
        type: "error"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Print with incomplete check
  const handleTriggerPrint = (action: "COVER" | "BIODATA") => {
    if (metrics.belumCount > 0 || metrics.sebagianCount > 0) {
      setPendingPrintAction(action);
      setShowIncompleteWarningModal(true);
    } else {
      window.print();
    }
  };

  const executePrint = () => {
    setShowIncompleteWarningModal(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  if (!canAccess) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
          Akses Terbatas
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400">
          Menu <strong>Biodata Siswa & Cover Rapor</strong> hanya diperuntukkan bagi Wali Kelas, Admin, dan Tim Kurikulum.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
              e-Rapor — Biodata Siswa & Cover Rapor
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Pemeriksaan kelengkapan biodata, penginputan, serta pencetakan Cover Rapor & Halaman Biodata Resmi.
            </p>
          </div>
        </div>

        {/* Global Class & Master Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
            <Users className="w-4 h-4 text-slate-400" />
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={!isAdminOrKurikulum && isHomeroomTeacher}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || `Kelas ${c.code}`}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Year Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={selectedAcademicYearId}
              onChange={(e) => setSelectedAcademicYearId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none cursor-pointer"
            >
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.year}
                </option>
              ))}
            </select>
          </div>

          {/* Semester Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none cursor-pointer"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  Semester {s.type || s.semester}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Navigation Submenu Tabs */}
      <div className="flex flex-wrap bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-2xl border border-slate-200 dark:border-zinc-700 text-xs font-bold print:hidden">
        <button
          onClick={() => setActiveTab("KELENGKAPAN")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === "KELENGKAPAN"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-800"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          1. Kelengkapan Biodata
        </button>

        <button
          onClick={() => setActiveTab("CETAK_COVER")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === "CETAK_COVER"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-800"
          }`}
        >
          <Printer className="w-4 h-4" />
          2. Cetak Cover Rapor
        </button>

        <button
          onClick={() => setActiveTab("CETAK_BIODATA")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === "CETAK_BIODATA"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          3. Cetak Biodata Siswa
        </button>

        <button
          onClick={() => setActiveTab("KESIAPAN")}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === "KESIAPAN"
              ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-800"
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          4. Checklist Kesiapan Rapor
        </button>
      </div>

      {/* TAB 1: KELENGKAPAN BIODATA (DASHBOARD & TABLE) */}
      {activeTab === "KELENGKAPAN" && (
        <div className="space-y-6 print:hidden">
          {/* Summary Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Total Siswa Kelas</p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-zinc-100">
                  {metrics.total}
                </span>
                <span className="text-xs text-slate-400 font-medium">Siswa</span>
              </div>
            </div>

            <div className="bg-emerald-500/10 rounded-2xl p-4 border border-emerald-500/20 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Biodata Lengkap
                </p>
                <span className="text-emerald-600 text-sm">🟢</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {metrics.lengkapCount}
                </span>
                <span className="text-xs text-emerald-600 font-medium">Siswa</span>
              </div>
            </div>

            <div className="bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Sebagian Lengkap
                </p>
                <span className="text-amber-600 text-sm">🟠</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                  {metrics.sebagianCount}
                </span>
                <span className="text-xs text-amber-600 font-medium">Siswa</span>
              </div>
            </div>

            <div className="bg-rose-500/10 rounded-2xl p-4 border border-rose-500/20 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  Belum Lengkap
                </p>
                <span className="text-rose-600 text-sm">🔴</span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                  {metrics.belumCount}
                </span>
                <span className="text-xs text-rose-600 font-medium">Siswa</span>
              </div>
            </div>

            <div className="bg-indigo-500/10 rounded-2xl p-4 border border-indigo-500/20 shadow-sm">
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                Persentase Kelas
              </p>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                  {metrics.totalPercentage}%
                </span>
                <span className="text-xs text-indigo-600 font-medium">Lengkap</span>
              </div>
            </div>
          </div>

          {/* Student Table & Search */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                  Daftar Biodata Siswa — {currentClassObj?.name || "Kelas"}
                </h3>
                <p className="text-xs text-slate-500">
                  Daftar seluruh siswa terdaftar dan status kelengkapan biodatanya secara real-time.
                </p>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari nama / NIS / NISN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/50 text-slate-500 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Nama Siswa</th>
                    <th className="py-3 px-4">NIS</th>
                    <th className="py-3 px-4">NISN</th>
                    <th className="py-3 px-4">Status Biodata</th>
                    <th className="py-3 px-4">Field Kosong</th>
                    <th className="py-3 px-4 text-center w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {isLoading ? "Memuat data siswa..." : "Tidak ada siswa ditemukan di kelas ini."}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((item, idx) => (
                      <tr
                        key={item.student.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 text-center font-medium text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-100">
                          {item.student.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-mono">
                          {item.student.nis || "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 font-mono">
                          {item.student.nisn || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${item.completeness.statusBadgeColor}`}
                          >
                            <span>
                              {item.completeness.status === "LENGKAP"
                                ? "🟢"
                                : item.completeness.status === "SEBAGIAN"
                                ? "🟠"
                                : "🔴"}
                            </span>
                            {item.completeness.statusLabel} ({item.completeness.percentage}%)
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {item.completeness.missingFields.length === 0 ? (
                            <span className="text-emerald-600 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Lengkap
                            </span>
                          ) : (
                            <span className="text-rose-500 font-medium">
                              {item.completeness.missingFields.join(", ")}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setDetailStudent(item.student)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 bg-slate-100 dark:bg-zinc-800 rounded-lg transition-all"
                              title="Detail Biodata"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingStudent({ ...item.student });
                                setActiveTab("EDIT");
                              }}
                              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-[11px] transition-all flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              {item.completeness.status === "LENGKAP" ? "Edit" : "Lengkapi"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EDIT / INPUT BIODATA FORM */}
      {activeTab === "EDIT" && editingStudent && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-6 print:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Edit / Lengkapi Biodata Siswa: <span className="text-indigo-600">{editingStudent.name}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Lengkapi seluruh field wajib untuk memastikan pencetakan e-Rapor resmi berjalan sempurna.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingStudent(null);
                setActiveTab("KELENGKAPAN");
              }}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveStudent} className="space-y-6">
            {/* Section A: Identitas Siswa */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800 pb-2">
                A. Identitas Peserta Didik
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Nama Lengkap Siswa *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.name || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    NIS (Nomor Induk Siswa) *
                  </label>
                  <input
                    type="text"
                    value={editingStudent.nis || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, nis: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    NISN *
                  </label>
                  <input
                    type="text"
                    value={editingStudent.nisn || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, nisn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    NIK (Nomor Induk Kependudukan)
                  </label>
                  <input
                    type="text"
                    value={editingStudent.nik || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, nik: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Jenis Kelamin *
                  </label>
                  <select
                    value={editingStudent.gender || "Laki-laki"}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, gender: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Tempat Lahir *
                  </label>
                  <input
                    type="text"
                    value={editingStudent.birthPlace || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, birthPlace: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Tanggal Lahir *
                  </label>
                  <input
                    type="date"
                    value={editingStudent.birthDate || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, birthDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Agama
                  </label>
                  <input
                    type="text"
                    value={editingStudent.religion || "Islam"}
                    onChange={(e) => setEditingStudent({ ...editingStudent, religion: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Data Orang Tua / Wali */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800 pb-2">
                B. Data Orang Tua / Wali
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Nama Ayah Kandung
                  </label>
                  <input
                    type="text"
                    value={editingStudent.fatherName || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, fatherName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Nama Ibu Kandung
                  </label>
                  <input
                    type="text"
                    value={editingStudent.motherName || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, motherName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Nama Wali (jika ada)
                  </label>
                  <input
                    type="text"
                    value={editingStudent.guardianName || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, guardianName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Kontak Orang Tua / Wali *
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={editingStudent.parentPhone || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, parentPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Section C: Alamat Tempat Tinggal */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800 pb-2">
                C. Alamat Tempat Tinggal
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Alamat Jalan / RT / RW *
                  </label>
                  <input
                    type="text"
                    placeholder="Jl. Alkarim No. 1, RT 01 / RW 02"
                    value={editingStudent.address || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Desa / Kelurahan
                  </label>
                  <input
                    type="text"
                    value={editingStudent.village || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, village: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    value={editingStudent.district || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, district: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Kabupaten / Kota *
                  </label>
                  <input
                    type="text"
                    value={editingStudent.city || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, city: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Provinsi
                  </label>
                  <input
                    type="text"
                    value={editingStudent.province || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, province: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    URL Foto Siswa (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={editingStudent.photoUrl || ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, photoUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setEditingStudent(null);
                  setActiveTab("KELENGKAPAN");
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 dark:bg-zinc-800 rounded-xl transition-all"
              >
                Batal
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isSaving ? "Menyimpan..." : "Simpan Biodata"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CETAK COVER RAPOR */}
      {activeTab === "CETAK_COVER" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-600" />
                  Cetak Cover Rapor Peserta Didik
                </h2>
                <p className="text-xs text-slate-500">
                  Cetak cover resmi Rapor Umum atau Rapor Kepesantrenan dengan Kop & Format yang sudah dikonfigurasi.
                </p>
              </div>

              <button
                onClick={() => handleTriggerPrint("COVER")}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 self-start md:self-auto"
              >
                <Printer className="w-4 h-4" />
                Cetak Cover Rapor ({printStudents.length} Siswa)
              </button>
            </div>

            {/* Sub-Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Pilih Siswa
                </label>
                <select
                  value={printStudentId}
                  onChange={(e) => setPrintStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"
                >
                  <option value="ALL">Semua Siswa dalam Kelas ({students.length} Siswa)</option>
                  {students.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.name} (NIS: {std.nis || "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Jenis Rapor
                </label>
                <select
                  value={coverType}
                  onChange={(e) => setCoverType(e.target.value as "UMUM" | "PONDOK")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none text-indigo-600"
                >
                  <option value="UMUM">Rapor Umum (Kop SMP & Kertas A4)</option>
                  <option value="PONDOK">Rapor Kepesantrenan (Kop Pondok & Kertas F4)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Status Kelengkapan Kelas
                </label>
                <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-semibold flex items-center gap-2">
                  <span>{metrics.belumCount === 0 ? "🟢 100% Lengkap" : `⚠️ ${metrics.belumCount} Belum Lengkap`}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cover Printable Component View */}
          <ERaporCoverPrintable
            students={printStudents}
            className={currentClassObj?.name || "Kelas"}
            academicYear={currentAcademicYearObj?.year || "2025/2026"}
            semester={`Semester ${currentSemesterObj?.type || "Ganjil"}`}
            reportType={coverType}
            printConfig={printConfig}
            schoolIdentity={schoolIdentity}
          />
        </div>
      )}

      {/* TAB 4: CETAK BIODATA SISWA */}
      {activeTab === "CETAK_BIODATA" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Cetak Lembar Biodata Siswa
                </h2>
                <p className="text-xs text-slate-500">
                  Cetak lembar biodata lengkap peserta didik (1 siswa per 1 halaman lengkap).
                </p>
              </div>

              <button
                onClick={() => handleTriggerPrint("BIODATA")}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center gap-2 self-start md:self-auto"
              >
                <Printer className="w-4 h-4" />
                Cetak Lembar Biodata ({printStudents.length} Siswa)
              </button>
            </div>

            {/* Sub-Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Pilih Siswa
                </label>
                <select
                  value={printStudentId}
                  onChange={(e) => setPrintStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"
                >
                  <option value="ALL">Semua Siswa dalam Kelas ({students.length} Siswa)</option>
                  {students.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.name} (NIS: {std.nis || "-"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Ukuran Kertas Biodata
                </label>
                <select
                  value={biodataPaperSize}
                  onChange={(e) => setBiodataPaperSize(e.target.value as "A4" | "F4")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"
                >
                  <option value="A4">A4 (210 x 297 mm) — Recommended</option>
                  <option value="F4">F4 / Folio (215 x 330 mm)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Orientasi Kertas
                </label>
                <select
                  value={biodataOrientation}
                  onChange={(e) => setBiodataOrientation(e.target.value as "portrait" | "landscape")}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"
                >
                  <option value="portrait">Portrait (Tegak)</option>
                  <option value="landscape">Landscape (Mendatar)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Biodata Printable Component */}
          <ERaporStudentBiodataPrintable
            students={printStudents}
            className={currentClassObj?.name || "Kelas"}
            paperSize={biodataPaperSize}
            orientation={biodataOrientation}
            schoolIdentity={schoolIdentity}
            headmasterName={printConfig?.headmasterName || schoolIdentity?.principalName}
            headmasterSignatureUrl={printConfig?.headmasterSignatureUrl}
          />
        </div>
      )}

      {/* TAB 5: CHECKLIST KESIAPAN RAPOR (DISCIPLINE MONITORING) */}
      {activeTab === "KESIAPAN" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-6 print:hidden">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-600" />
              Checklist Kesiapan Rapor Kelas — {currentClassObj?.name || "Kelas"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Matriks monitoring kesiapan e-Rapor sebelum diverifikasi oleh Tim Kurikulum/Kepala Sekolah.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Box: Readiness Components */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className={metrics.totalPercentage === 100 ? "text-emerald-500" : "text-amber-500"}>
                    {metrics.totalPercentage === 100 ? "☑" : "☒"}
                  </span>
                  Biodata Siswa
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  {metrics.totalPercentage}% Lengkap
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="text-emerald-500">☑</span>
                  Nilai Mapel Umum
                </div>
                <span className="text-xs font-bold text-emerald-600">100% Terisi</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="text-emerald-500">☑</span>
                  Nilai Mapel Kepesantrenan
                </div>
                <span className="text-xs font-bold text-emerald-600">100% Terisi</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="text-emerald-500">☑</span>
                  Nilai Ekstrakurikuler
                </div>
                <span className="text-xs font-bold text-emerald-600">100% Terisi</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <span className="text-emerald-500">☑</span>
                  Kehadiran & Catatan Wali Kelas
                </div>
                <span className="text-xs font-bold text-emerald-600">100% Terisi</span>
              </div>
            </div>

            {/* Right Box: Final Readiness Card */}
            <div className="p-6 bg-indigo-50/50 dark:bg-zinc-800/80 rounded-2xl border border-indigo-200 dark:border-zinc-700 flex flex-col justify-between">
              <div className="space-y-3">
                <span className="px-3 py-1 bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider rounded-full">
                  Status Kesiapan Rapor
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
                  {metrics.totalPercentage === 100
                    ? "SIAP DIVERIFIKASI & DICETAK"
                    : "BELUM SIAP DIVERIFIKASI"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400">
                  {metrics.totalPercentage === 100
                    ? "Seluruh komponen biodata dan penilaian siswa telah terisi 100%. Wali kelas dapat mengajukan penguncian nilai untuk diverifikasi oleh Kepala Sekolah."
                    : `Masih terdapat ${metrics.belumCount + metrics.sebagianCount} siswa dengan biodata belum lengkap. Harap lengkapi terlebih dahulu.`}
                </p>
              </div>

              <div className="pt-4 border-t border-indigo-200 dark:border-zinc-700">
                <button
                  onClick={() => setActiveTab("KELENGKAPAN")}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Periksa & Lengkapi Biodata Siswa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL BIODATA MODAL */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Eye className="w-5 h-5 text-indigo-600" />
                Detail Biodata Siswa — {detailStudent.name}
              </h3>
              <button
                onClick={() => setDetailStudent(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Sections */}
            <div className="space-y-4 text-xs font-sans">
              {/* Section A */}
              <div className="space-y-2">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide border-b pb-1">
                  A. Identitas Peserta Didik
                </h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                  <p><span className="text-slate-500 font-semibold">Nama Lengkap:</span> <strong className="text-slate-900 dark:text-zinc-100">{detailStudent.name}</strong></p>
                  <p><span className="text-slate-500 font-semibold">NIS:</span> {detailStudent.nis || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">NISN:</span> {detailStudent.nisn || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">NIK:</span> {detailStudent.nik || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">Jenis Kelamin:</span> {detailStudent.gender || "-"}</p>
                  <p><span className="text-slate-500 font-semibold">Tempat/Tgl Lahir:</span> {detailStudent.birthPlace || detailStudent.birthDate ? `${detailStudent.birthPlace || "-"}, ${detailStudent.birthDate || "-"}` : <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">Agama:</span> {detailStudent.religion || "Islam"}</p>
                </div>
              </div>

              {/* Section B */}
              <div className="space-y-2">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide border-b pb-1">
                  B. Data Orang Tua / Wali
                </h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                  <p><span className="text-slate-500 font-semibold">Nama Ayah:</span> {detailStudent.fatherName || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">Nama Ibu:</span> {detailStudent.motherName || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">Nama Wali:</span> {detailStudent.guardianName || "-"}</p>
                  <p><span className="text-slate-500 font-semibold">Kontak HP:</span> {detailStudent.parentPhone || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                </div>
              </div>

              {/* Section C */}
              <div className="space-y-2">
                <h4 className="font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide border-b pb-1">
                  C. Alamat Tempat Tinggal
                </h4>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl">
                  <p className="col-span-2"><span className="text-slate-500 font-semibold">Alamat Jalan:</span> {detailStudent.address || <span className="text-slate-400 italic">Belum diisi</span>}</p>
                  <p><span className="text-slate-500 font-semibold">Desa / Kelurahan:</span> {detailStudent.village || "-"}</p>
                  <p><span className="text-slate-500 font-semibold">Kecamatan:</span> {detailStudent.district || "-"}</p>
                  <p><span className="text-slate-500 font-semibold">Kabupaten / Kota:</span> {detailStudent.city || "-"}</p>
                  <p><span className="text-slate-500 font-semibold">Provinsi:</span> {detailStudent.province || "-"}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <button
                onClick={() => {
                  setEditingStudent({ ...detailStudent });
                  setDetailStudent(null);
                  setActiveTab("EDIT");
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Lengkapi Biodata Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WARNING BEFORE PRINT MODAL */}
      {showIncompleteWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-amber-300 dark:border-amber-800">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 bg-amber-100 dark:bg-amber-950/50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Peringatan Biodata Belum Lengkap
                </h3>
                <p className="text-xs text-slate-500">
                  {metrics.belumCount + metrics.sebagianCount} siswa masih memiliki biodata belum lengkap.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              ⚠️ Masih terdapat <strong>{metrics.belumCount + metrics.sebagianCount} siswa</strong> dengan biodata belum lengkap di kelas ini.
              Apakah Anda tetap ingin melanjutkan pencetakan?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowIncompleteWarningModal(false);
                  setActiveTab("KELENGKAPAN");
                }}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 dark:bg-zinc-800 rounded-xl hover:bg-slate-200"
              >
                Periksa Biodata
              </button>
              <button
                onClick={executePrint}
                className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md"
              >
                Tetap Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
