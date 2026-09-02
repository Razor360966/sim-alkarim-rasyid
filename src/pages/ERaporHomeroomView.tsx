import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { academicYearService } from "../services/academicYearService";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { studentService } from "../services/studentService";
import { eRaporService } from "../services/eRapor.service";
import { AcademicYear, Semester, Class, Student } from "../types";
import { isStudentActive } from "../utils/studentHelper";
import {
  ERaporSubjectCompleteness,
  ERaporClassVerification,
  ERaporGradeChangeRequest
} from "../types/eRapor.types";
import { ERaporPrintable } from "../components/ERaporPrintable";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Printer,
  RefreshCw,
  Search,
  Check,
  X,
  FileText,
  User,
  BookOpen
} from "lucide-react";

export default function ERaporHomeroomView() {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filters State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState<string>("");
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  // Homeroom Data
  const [subjectCompleteness, setSubjectCompleteness] = useState<ERaporSubjectCompleteness[]>([]);
  const [verification, setVerification] = useState<ERaporClassVerification | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ERaporGradeChangeRequest[]>([]);

  // UI States
  const [activeTab, setActiveTab] = useState<"subjects" | "validation" | "print" | "requests">("subjects");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [uncompletedBreakdown, setUncompletedBreakdown] = useState<string[]>([]);
  const [searchStudent, setSearchStudent] = useState<string>("");

  // Print Modal State
  const [selectedStudentForPrint, setSelectedStudentForPrint] = useState<Student | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [isPrintLoading, setIsPrintLoading] = useState<boolean>(false);

  // 1. Load Initial Filters
  useEffect(() => {
    async function loadFilters() {
      try {
        const [years, sems, allClasses] = await Promise.all([
          academicYearService.getAcademicYears(),
          semesterService.getSemesters(),
          classService.getClasses()
        ]);

        setAcademicYears(years);
        setSemesters(sems);

        const activeYr = years.find((y) => y.isActive) || years[0];
        const activeSem = sems.find((s) => s.isActive) || sems[0];

        if (activeYr) setSelectedAcademicYearId(activeYr.id!);
        if (activeSem) setSelectedSemesterId(activeSem.id!);

        // If Homeroom Teacher, auto select their assigned class
        if (user?.role === "guru" && user?.uid) {
          const hrClass = allClasses.find((c) => c.homeroomTeacherId === user.uid);
          setClasses(hrClass ? [hrClass] : allClasses);
          if (hrClass) setSelectedClassId(hrClass.id!);
          else if (allClasses.length > 0) setSelectedClassId(allClasses[0].id!);
        } else {
          setClasses(allClasses);
          if (allClasses.length > 0) setSelectedClassId(allClasses[0].id!);
        }
      } catch (e) {
        console.error("Error loading homeroom filters:", e);
      }
    }
    loadFilters();
  }, [user]);

  // 2. Fetch Class Completeness Data
  useEffect(() => {
    async function loadClassData() {
      if (!selectedAcademicYearId || !selectedSemesterId || !selectedClassId) return;
      setIsLoading(true);
      try {
        const allStudents = await studentService.getStudents();
        const classStudents = allStudents.filter((s) => s.classId === selectedClassId && isStudentActive(s));

        const [monitoring, requests] = await Promise.all([
          eRaporService.getHomeroomMonitoringData(
            selectedAcademicYearId,
            selectedSemesterId,
            selectedClassId
          ),
          eRaporService.getPendingGradeRequests(selectedClassId)
        ]);

        setSubjectCompleteness([
          ...(monitoring.generalCompleteness || []),
          ...(monitoring.pondokCompleteness || [])
        ]);
        setStudents(classStudents);
        setPendingRequests(requests);

        const ver = await eRaporService.getClassVerification(
          selectedAcademicYearId,
          selectedSemesterId,
          selectedClassId
        );
        setVerification(ver);
      } catch (e) {
        console.error("Error loading homeroom data:", e);
        toast("Gagal memuat data monitoring Wali Kelas.", "error");
      } finally {
        setIsLoading(false);
      }
    }
    loadClassData();
  }, [selectedAcademicYearId, selectedSemesterId, selectedClassId]);

  // Run Completeness Validation Check
  const handleCheckCompleteness = async () => {
    if (!selectedClassId) return;
    setIsVerifying(true);
    setUncompletedBreakdown([]);
    try {
      const selectedClassObj = classes.find((c) => c.id === selectedClassId);
      const res = await eRaporService.verifyAndLockClass(
        selectedAcademicYearId,
        selectedSemesterId,
        selectedClassId,
        selectedClassObj?.name || "Kelas",
        user?.uid || "",
        user?.name || "Wali Kelas",
        "TERVERIFIKASI",
        "",
        true // check only
      );

      if (res.success) {
        toast(res.message, "success");
      } else {
        toast(res.message, "error");
        if (res.uncompletedBreakdown) {
          setUncompletedBreakdown(res.uncompletedBreakdown);
        }
      }
    } catch (e) {
      console.error("Error checking class completeness:", e);
      toast("Terjadi kesalahan saat memeriksa kelengkapan nilai.", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  // Perform Lock or Verification
  const handleLockClass = async (targetStatus: "TERVERIFIKASI" | "LOCKED") => {
    setIsVerifying(true);
    try {
      const selectedClassObj = classes.find((c) => c.id === selectedClassId);
      const res = await eRaporService.verifyAndLockClass(
        selectedAcademicYearId,
        selectedSemesterId,
        selectedClassId,
        selectedClassObj?.name || "Kelas",
        user?.uid || "",
        user?.name || "Wali Kelas",
        targetStatus,
        `Disahkan oleh ${user?.name || "Wali Kelas"} pada ${new Date().toLocaleDateString("id-ID")}`
      );

      if (res.success) {
        toast(res.message, "success");
        // Reload verification status
        const ver = await eRaporService.getClassVerification(
          selectedAcademicYearId,
          selectedSemesterId,
          selectedClassId
        );
        setVerification(ver);
      } else {
        toast(res.message, "error");
        if (res.uncompletedBreakdown) {
          setUncompletedBreakdown(res.uncompletedBreakdown);
        }
      }
    } catch (e) {
      console.error("Error verifying class:", e);
      toast("Gagal mengubah status verifikasi kelas.", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  // Open Student Report Card Print Preview
  const handleOpenPrintPreview = async (st: Student) => {
    setSelectedStudentForPrint(st);
    setIsPrintLoading(true);
    try {
      const currentYearObj = academicYears.find((y) => y.id === selectedAcademicYearId);
      const currentSemObj = semesters.find((s) => s.id === selectedSemesterId);

      const [rData, printSettingsConfig] = await Promise.all([
        eRaporService.getReportCardDataForStudent(
          selectedAcademicYearId,
          selectedSemesterId,
          selectedClassId,
          st.id!
        ),
        eRaporService.getSettings()
      ]);

      setPrintData({
        ...rData,
        academicYear: currentYearObj?.year || "2024/2025",
        semester: currentSemObj?.type || "Ganjil",
        printConfig: printSettingsConfig
      });
    } catch (e) {
      console.error("Error generating report card data:", e);
      toast("Gagal menyiapkan data cetak rapor.", "error");
    } finally {
      setIsPrintLoading(false);
    }
  };

  // Process Grade Change Request Approval
  const handleProcessRequest = async (reqId: string, status: "APPROVED" | "REJECTED") => {
    try {
      await eRaporService.processGradeChangeRequest(reqId, status, user?.name || "Wali Kelas");
      toast(`Permintaan berhasil di-${status === "APPROVED" ? "setujui" : "tolak"}.`, "success");
      setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    } catch (e) {
      console.error("Error processing request:", e);
      toast("Gagal memproses permintaan.", "error");
    }
  };

  const selectedClassObj = classes.find((c) => c.id === selectedClassId);
  const filteredStudents = students.filter((st) =>
    st.name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
    st.nis?.includes(searchStudent)
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
                e-Rapor – Workspace Wali Kelas
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Monitor kelengkapan nilai, verifikasi & kunci rapor kelas, serta cetak rapor resmi santri.
              </p>
            </div>
          </div>
        </div>

        {/* Verification Status Badge */}
        <div className="flex items-center gap-3">
          {verification?.status === "LOCKED" ? (
            <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 flex items-center gap-2 border border-blue-200 dark:border-blue-800">
              <Lock className="w-4 h-4 text-blue-600" /> RAPOR DITERBITKAN & DIKUNCI
            </span>
          ) : verification?.status === "TERVERIFIKASI" ? (
            <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 flex items-center gap-2 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> TERVERIFIKASI
            </span>
          ) : (
            <span className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 flex items-center gap-2 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> DRAFT (BELUM DIKUNCI)
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-slate-200 dark:border-zinc-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Tahun Ajaran
          </label>
          <select
            value={selectedAcademicYearId}
            onChange={(e) => setSelectedAcademicYearId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {academicYears.map((y) => (
              <option key={y.id} value={y.id}>
                {y.year} {y.isActive ? "(Aktif)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Semester
          </label>
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {semesters
              .filter((s) => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || `Semester ${s.code}`} {s.isActive ? "(Aktif)" : ""}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-1">
            Kelas / Rombel Pengampuan
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-emerald-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Kelas {c.name} (Wali Kelas: {c.homeroomTeacherName || "-"})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-2">
        <button
          onClick={() => setActiveTab("subjects")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "subjects"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="w-4 h-4" /> Progress Nilai Mapel ({subjectCompleteness.length})
        </button>

        <button
          onClick={() => setActiveTab("validation")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "validation"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Verifikasi & Kunci Kelas
        </button>

        <button
          onClick={() => setActiveTab("print")}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "print"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Printer className="w-4 h-4" /> Cetak Rapor Santri ({students.length})
        </button>

        {pendingRequests.length > 0 && (
          <button
            onClick={() => setActiveTab("requests")}
            className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "requests"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" /> Request Edit ({pendingRequests.length})
          </button>
        )}
      </div>

      {/* Tab 1: Subject Progress */}
      {activeTab === "subjects" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
              <p className="text-xs">Memuat status pengisian nilai per mata pelajaran...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300">
                    <th className="p-3 w-10 text-center font-bold">No</th>
                    <th className="p-3 font-bold">Mata Pelajaran</th>
                    <th className="p-3 font-bold">Guru Pengampu</th>
                    <th className="p-3 text-center font-bold">Progress TP</th>
                    <th className="p-3 text-center font-bold">Progress UTS</th>
                    <th className="p-3 text-center font-bold">Progress SAS</th>
                    <th className="p-3 text-center font-bold">Kelengkapan</th>
                    <th className="p-3 text-center font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {subjectCompleteness.map((subj, idx) => (
                    <tr key={subj.subjectId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-zinc-100">{subj.subjectName}</td>
                      <td className="p-3 text-slate-600 dark:text-zinc-300">{subj.teacherName}</td>
                      <td className="p-3 text-center font-medium">
                        {subj.tpFilledCount} / {subj.tpTotalCount}
                      </td>
                      <td className="p-3 text-center font-medium">
                        {subj.utsFilledCount} / {subj.totalStudents}
                      </td>
                      <td className="p-3 text-center font-medium">
                        {subj.sasFilledCount} / {subj.totalStudents}
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-bold text-slate-700 dark:text-zinc-300">
                          {subj.completedStudents} / {subj.totalStudents} Siswa
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {subj.isComplete ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Lengkap
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Belum
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Validation & Lock */}
      {activeTab === "validation" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" /> Verifikasi & Penguncian Nilai Kelas
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Sebelum mencetak rapor, Wali Kelas wajib memverifikasi bahwa seluruh mata pelajaran dan seluruh santri telah memiliki nilai TP, UTS, dan SAS secara 100% lengkap.
            </p>

            {uncompletedBreakdown.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Rincian Nilai Belum Lengkap:
                </h4>
                <ul className="list-disc list-inside text-xs text-amber-700 dark:text-amber-200 space-y-1">
                  {uncompletedBreakdown.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleCheckCompleteness}
                disabled={isVerifying}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isVerifying ? "animate-spin" : ""}`} /> Periksa Kelengkapan
              </button>

              <button
                onClick={() => handleLockClass("TERVERIFIKASI")}
                disabled={isVerifying}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Sahkan & Verifikasi Kelas
              </button>

              <button
                onClick={() => handleLockClass("LOCKED")}
                disabled={isVerifying}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Terbitkan & Kunci Rapor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Print Report Cards */}
      {activeTab === "print" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-slate-200 dark:border-zinc-800">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Cari nama santri atau NIS..."
                className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl"
              />
            </div>
            <span className="text-xs text-slate-500 font-medium">
              Menampilkan {filteredStudents.length} dari {students.length} Santri
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((st) => (
              <div
                key={st.id}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                    {st.name?.charAt(0) || "S"}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100">{st.name}</h4>
                    <p className="text-[10px] text-slate-400">NIS: {st.nis || "-"}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenPrintPreview(st)}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Pratinjau Rapor
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Pending Grade Requests */}
      {activeTab === "requests" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Permintaan Perubahan Nilai dari Guru Mapel
          </h3>

          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {pendingRequests.map((req) => (
              <div key={req.id} className="py-4 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-bold text-slate-800 dark:text-zinc-100">
                    {req.teacherName} – <span className="text-emerald-600">{req.subjectName}</span>
                  </div>
                  <p className="text-slate-500 mt-1">Alasan: "{req.reason}"</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Dikirim: {req.requestedAt}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleProcessRequest(req.id!, "APPROVED")}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Setujui
                  </button>
                  <button
                    onClick={() => handleProcessRequest(req.id!, "REJECTED")}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Printable Report Modal */}
      {selectedStudentForPrint && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 dark:border-zinc-800 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-500" /> Pratinjau Rapor Resmi – {selectedStudentForPrint.name}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 shadow-md"
                >
                  <Printer className="w-4 h-4" /> Cetak ke PDF / Printer
                </button>
                <button
                  onClick={() => setSelectedStudentForPrint(null)}
                  className="px-3 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-semibold rounded-xl text-xs"
                >
                  Tutup
                </button>
              </div>
            </div>

            {isPrintLoading ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                <p className="text-xs">Menyiapkan dokumen rapor...</p>
              </div>
            ) : printData ? (
              <div className="max-h-[70vh] overflow-y-auto border p-4 bg-slate-50 rounded-xl">
                <ERaporPrintable
                  student={printData.student}
                  className={printData.className}
                  homeroomTeacherName={printData.homeroomTeacherName}
                  identity={printData.identity}
                  academicYear={printData.academicYear}
                  semester={printData.semester}
                  subjectsWithScores={printData.subjectsWithScores}
                  umumSubjects={printData.umumSubjects}
                  pondokSubjects={printData.pondokSubjects}
                  extracurriculars={printData.extracurriculars}
                  verification={printData.verification}
                  printConfig={printData.printConfig}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
