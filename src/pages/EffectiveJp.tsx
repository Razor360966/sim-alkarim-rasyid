import React, { useState, useEffect } from "react";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { teacherService } from "../services/teacherService";
import { subjectService } from "../services/subjectService";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { realTeachingHoursService } from "../services/realTeachingHours.service";
import { academicPlanningService } from "../services/academicPlanning.service";
import { 
  Semester, 
  Class, 
  Subject, 
  SchoolSettings,
  RealTeachingHoursSummary, 
  SubjectRealTeachingHours,
  TeachingDateDetail,
  JpAdjustment
} from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { 
  Calendar, 
  Clock, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  BookOpen, 
  Users, 
  TrendingUp, 
  Info,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Edit3,
  Search,
  Filter,
  Check,
  X,
  Sliders,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  CalendarCheck,
  CalendarDays
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export const EffectiveJp: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>("Semua");
  const [selectedClassId, setSelectedClassId] = useState<string>("Semua");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("Semua");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("Semua");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Analysis Data
  const [summary, setSummary] = useState<RealTeachingHoursSummary | null>(null);
  const [daysAnalysis, setDaysAnalysis] = useState<any | null>(null);
  const [weeksAnalysis, setWeeksAnalysis] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Detail Modal State
  const [selectedItem, setSelectedItem] = useState<SubjectRealTeachingHours | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);

  // Adjustment Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState<boolean>(false);
  const [manualValueInput, setManualValueInput] = useState<number>(0);
  const [adjustmentReasonInput, setAdjustmentReasonInput] = useState<string>("");
  const [isSavingAdjustment, setIsSavingAdjustment] = useState<boolean>(false);

  // Tabs Management
  const [activeTab, setActiveTab] = useState<"analysis" | "monthly_details" | "approvals">("analysis");
  const [pendingAdjustments, setPendingAdjustments] = useState<JpAdjustment[]>([]);

  const isApprover = ["admin", "kepala_sekolah", "wakil_kepala_sekolah", "operator", "pimpinan"].includes(
    (user?.role || "").toLowerCase()
  );

  // Initial Load
  const loadMasterData = async () => {
    try {
      const [sems, clsList, tList, sList, setts] = await Promise.all([
        semesterService.getSemesters(),
        classService.getClasses(),
        teacherService.getTeachers(),
        subjectService.getSubjects(),
        schoolSettingsService.getSettings()
      ]);

      setSemesters(sems);
      setClasses(clsList.filter(c => c.status === "Aktif" && !c.isDeleted));
      setTeachers(tList);
      setSubjects(sList);
      setSettings(setts);

      const activeSem = sems.find(s => s.isActive);
      if (activeSem) {
        setSelectedSemesterId(activeSem.id);
      } else if (sems.length > 0) {
        setSelectedSemesterId(sems[0].id);
      }
    } catch (err: any) {
      showToast("Gagal memuat data master: " + err.message, "error");
    }
  };

  useEffect(() => {
    loadMasterData();
  }, []);

  const currentSemester = semesters.find(s => s.id === selectedSemesterId);

  // Run Real Teaching Hours Calculation & Monthly Effective Days Analysis
  const fetchAnalysis = async () => {
    if (!currentSemester) return;
    setLoading(true);
    try {
      const [data, dAnalysis, wAnalysis] = await Promise.all([
        realTeachingHoursService.getRealTeachingHoursAnalysis(
          currentSemester.academicYearId,
          currentSemester.id
        ),
        academicPlanningService.analyzeEffectiveDays(
          currentSemester.startDate,
          currentSemester.endDate,
          currentSemester.academicYearId,
          currentSemester.id
        ),
        academicPlanningService.analyzeEffectiveWeeks(
          currentSemester.startDate,
          currentSemester.endDate,
          currentSemester.academicYearId,
          currentSemester.id
        )
      ]);

      setSummary(data);
      setDaysAnalysis(dAnalysis);
      setWeeksAnalysis(wAnalysis);

      // Extract pending adjustments for approvals tab
      const pendingList: JpAdjustment[] = [];
      data.bySubjectClass.forEach(item => {
        if (item.pendingAdjustment) {
          pendingList.push(item.pendingAdjustment);
        }
      });
      setPendingAdjustments(pendingList);
    } catch (error: any) {
      showToast("Gagal menghitung JP Efektif Riil & Hari Efektif: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();
  }, [selectedSemesterId]);

  // Filtered List
  const filteredList = (summary?.bySubjectClass || []).filter(item => {
    const matchesGrade = selectedGrade === "Semua" || item.gradeLevel === selectedGrade;
    const matchesClass = selectedClassId === "Semua" || item.classId === selectedClassId;
    const matchesTeacher = selectedTeacherId === "Semua" || item.teacherId === selectedTeacherId;
    const matchesSubject = selectedSubjectId === "Semua" || item.subjectId === selectedSubjectId;
    const matchesSearch = 
      item.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.teacherName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesGrade && matchesClass && matchesTeacher && matchesSubject && matchesSearch;
  });

  // Calculate Filtered KPI Summary
  const filteredKpi = filteredList.reduce(
    (acc, item) => {
      acc.planned += item.plannedJp;
      acc.lost += item.lostJp;
      acc.effective += item.effectiveJp;
      acc.executed += item.executedJp;
      return acc;
    },
    { planned: 0, lost: 0, effective: 0, executed: 0 }
  );

  const averageProgress = filteredKpi.effective > 0
    ? Math.min(100, Math.round((filteredKpi.executed / filteredKpi.effective) * 100))
    : 0;

  // Open Adjustment Form
  const handleOpenAdjustmentModal = (item: SubjectRealTeachingHours) => {
    setSelectedItem(item);
    setManualValueInput(item.effectiveJp);
    setAdjustmentReasonInput(item.pendingAdjustment?.reason || "");
    setIsAdjustmentModalOpen(true);
  };

  // Submit Manual Adjustment
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !currentSemester) return;

    if (!adjustmentReasonInput || adjustmentReasonInput.trim() === "") {
      showToast("Gagal Simpan: Alasan penyesuaian wajib diisi!", "error");
      return;
    }

    setIsSavingAdjustment(true);
    try {
      const delta = manualValueInput - (selectedItem.plannedJp - selectedItem.lostJp);
      const adjustmentData = {
        academicYearId: currentSemester.academicYearId,
        semesterId: currentSemester.id,
        subjectId: selectedItem.subjectId,
        subjectName: selectedItem.subjectName,
        classId: selectedItem.classId,
        className: selectedItem.className,
        gradeLevel: selectedItem.gradeLevel,
        teacherId: selectedItem.teacherId,
        teacherName: selectedItem.teacherName,
        systemValue: selectedItem.plannedJp - selectedItem.lostJp,
        manualValue: manualValueInput,
        adjustmentDelta: delta,
        reason: adjustmentReasonInput.trim(),
        adjustedByUserId: user?.uid || "user",
        adjustedByUserName: user?.displayName || user?.email || "Guru"
      };

      const res = await realTeachingHoursService.saveJpAdjustment(adjustmentData);
      
      if (res.status === "pending") {
        showToast("Pengajuan penyesuaian JP dikirim! Menunggu persetujuan Kepala Sekolah/Waka.", "success");
      } else {
        showToast("Penyesuaian JP Efektif berhasil diperbarui!", "success");
      }

      setIsAdjustmentModalOpen(false);
      fetchAnalysis();
    } catch (err: any) {
      showToast("Gagal menyimpan penyesuaian: " + err.message, "error");
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  // Approve / Reject Pending Adjustment
  const handleApproveAdjustment = async (adj: JpAdjustment) => {
    if (!adj.id) return;
    try {
      await realTeachingHoursService.approveJpAdjustment(
        adj.id,
        user?.uid || "approver",
        user?.displayName || "Kepala Sekolah / Waka"
      );
      showToast(`Penyesuaian JP untuk ${adj.subjectName} (${adj.className}) disetujui!`, "success");
      fetchAnalysis();
    } catch (err: any) {
      showToast("Gagal menyetujui penyesuaian: " + err.message, "error");
    }
  };

  const handleRejectAdjustment = async (adj: JpAdjustment) => {
    if (!adj.id) return;
    const reason = window.prompt("Masukkan alasan penolakan penyesuaian JP:");
    if (reason === null) return;

    try {
      await realTeachingHoursService.rejectJpAdjustment(adj.id, reason || "Ditolak oleh pimpinan");
      showToast(`Penyesuaian JP untuk ${adj.subjectName} (${adj.className}) ditolak.`, "info");
      fetchAnalysis();
    } catch (err: any) {
      showToast("Gagal menolak penyesuaian: " + err.message, "error");
    }
  };

  // EXCEL EXPORT
  const handleExportExcel = () => {
    if (!summary || !currentSemester) return;
    try {
      const exportRows = filteredList.map((item, idx) => ({
        "No": idx + 1,
        "Mata Pelajaran": item.subjectName,
        "Kelas": item.className,
        "Jenjang": item.gradeLevel,
        "Guru Pengampu": item.teacherName,
        "Hari Mengajar": item.day,
        "JP / Minggu": item.scheduledJpPerWeek,
        "JP Rencana (Sistem)": item.plannedJp,
        "JP Hilang (Agenda/Libur)": item.lostJp,
        "Penyesuaian Manual (JP)": item.adjustmentJp,
        "JP Efektif Riil": item.effectiveJp,
        "JP Terlaksana": item.executedJp,
        "Sisa JP": item.remainingJp,
        "Progress KBM (%)": `${item.progressPercent}%`
      }));

      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analisis JP Efektif Riil");
      XLSX.writeFile(wb, `Analisis_JP_Efektif_Riil_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.xlsx`);
      showToast("Berhasil mengunduh Laporan Excel Analisis JP Efektif!", "success");
    } catch (error: any) {
      showToast("Gagal Export Excel: " + error.message, "error");
    }
  };

  // PDF EXPORT
  const handleExportPDF = () => {
    if (!summary || !currentSemester) return;
    try {
      const doc = new jsPDF("landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("ANALISIS JP EFEKTIF MATA PELAJARAN (REAL TEACHING HOURS)", 14, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tahun Pelajaran: ${currentSemester.academicYearName} | Semester: ${currentSemester.name} (${currentSemester.code})`, 14, 22);
      doc.text(`Filter Jenjang: ${selectedGrade} | Kelas: ${selectedClassId === "Semua" ? "Semua" : classes.find(c=>c.id===selectedClassId)?.name} | Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`, 14, 27);

      doc.line(14, 30, 282, 30);

      let yPos = 38;
      doc.setFont("helvetica", "bold");
      doc.text("Ringkasan Total JP Efektif:", 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(`Total JP Rencana: ${filteredKpi.planned} JP | Total JP Hilang (Libur/Agenda): ${filteredKpi.lost} JP | Total JP Efektif Riil: ${filteredKpi.effective} JP | Progress: ${averageProgress}%`, 14, yPos + 5);

      doc.line(14, 48, 282, 48);

      yPos = 56;
      doc.setFont("helvetica", "bold");
      doc.text("Daftar Alokasi Real Teaching Hours per Mata Pelajaran & Kelas:", 14, yPos);
      yPos += 8;

      doc.setFontSize(8);
      filteredList.forEach((item, idx) => {
        if (yPos > 185) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. ${item.subjectName} - ${item.className} (Guru: ${item.teacherName})`, 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(`   Hari: ${item.day} (${item.scheduledJpPerWeek} JP/Mg) | JP Rencana: ${item.plannedJp} JP | JP Hilang: ${item.lostJp} JP | Penyesuaian: ${item.adjustmentJp >= 0 ? '+' : ''}${item.adjustmentJp} JP | JP Efektif Riil: ${item.effectiveJp} JP | Terlaksana: ${item.executedJp} JP (${item.progressPercent}%)`, 14, yPos + 4);
        yPos += 9;
      });

      doc.save(`Analisis_JP_Efektif_Riil_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.pdf`);
      showToast("Berhasil mengunduh Laporan PDF!", "success");
    } catch (error: any) {
      showToast("Gagal Export PDF: " + error.message, "error");
    }
  };

  return (
    <div className="space-y-6" id="effective-jp-analysis-page">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
              Analisis JP Efektif Mata Pelajaran
            </h1>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Real Teaching Hours Engine
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Kalkulasi akurat jam pelajaran efektif berbasis jadwal nyata, kalender akademik, agenda KBM, dan libur pondok/sekolah.
          </p>
        </div>

        {/* Semester selector & Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-xs">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Semester:</span>
            <select
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="text-sm font-semibold text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-hidden cursor-pointer"
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.academicYearName} - {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchAnalysis}
            className="p-2 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Kalkulasi Ulang Data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "analysis"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            <Clock className="h-4 w-4" /> Real Teaching Hours
          </button>

          <button
            onClick={() => setActiveTab("monthly_details")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "monthly_details"
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
            }`}
          >
            <CalendarDays className="h-4 w-4" /> Rincian Hari Efektif Bulanan
          </button>

          {isApprover && (
            <button
              onClick={() => setActiveTab("approvals")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                activeTab === "approvals"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/10"
                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
              }`}
            >
              <ShieldAlert className="h-4 w-4" /> Persetujuan Penyesuaian JP
              {pendingAdjustments.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-rose-500 text-white rounded-full font-black animate-pulse">
                  {pendingAdjustments.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {activeTab === "analysis" && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">JP Rencana (Sistem)</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{filteredKpi.planned} JP</h3>
                <Calendar className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Kapasitas jadwal mengajar kotor</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider mb-1">JP Hilang (Agenda / Libur)</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">-{filteredKpi.lost} JP</h3>
                <XCircle className="h-5 w-5 text-rose-500" />
              </div>
              <p className="text-[10px] text-rose-400 mt-2">Dampak libur, MPLS, ANBK, kegiatan pondok</p>
            </div>

            <div className="bg-blue-600 border border-blue-700 p-4 rounded-2xl shadow-md shadow-blue-500/10 text-white">
              <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-1">JP Efektif Riil (SSOT)</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black">{filteredKpi.effective} JP</h3>
                <TrendingUp className="h-5 w-5 text-blue-200" />
              </div>
              <p className="text-[10px] text-blue-200 mt-2">Acuan utama Prota, Prosem & Modul Ajar</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Execution Progress</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{averageProgress}%</h3>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">{filteredKpi.executed} dari {filteredKpi.effective} JP terlaksana di Jurnal</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-zinc-200">
                <Filter className="h-4 w-4 text-blue-500" /> Filter Analysis Data
              </div>
              <span className="text-[11px] text-slate-400">Menampilkan {filteredList.length} entitas mata pelajaran & kelas</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari mapel, kelas, atau guru..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200"
                />
              </div>

              {/* Grade Level */}
              <div>
                <select
                  value={selectedGrade}
                  onChange={(e) => {
                    setSelectedGrade(e.target.value);
                    setSelectedClassId("Semua");
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200"
                >
                  <option value="Semua">Semua Jenjang</option>
                  <option value="VII">Jenjang VII</option>
                  <option value="VIII">Jenjang VIII</option>
                  <option value="IX">Jenjang IX</option>
                </select>
              </div>

              {/* Class Select */}
              <div>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200"
                >
                  <option value="Semua">Semua Kelas</option>
                  {classes
                    .filter(c => selectedGrade === "Semua" || c.gradeLevel === selectedGrade)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              {/* Teacher Select */}
              <div>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200"
                >
                  <option value="Semua">Semua Guru</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Subject Select */}
              <div>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200"
                >
                  <option value="Semua">Semua Mapel</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Analysis Data Table */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-16 text-center text-slate-500 dark:text-zinc-400">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-sm font-medium">Menganalisis jadwal nyata, kalender akademik, & kegiatan sekolah...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <BookOpen className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-medium">Data Real Teaching Hours belum tersedia</p>
                <p className="text-xs text-slate-400 mt-1">Pastikan Jadwal Pelajaran dan Kalender Akademik telah dikonfigurasi.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800">
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider w-12 text-center">No</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Mata Pelajaran</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Kelas</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Guru Pengampu</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Hari & JP/Mg</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">JP Rencana</th>
                      <th className="p-3 text-xs font-bold text-rose-500 uppercase tracking-wider text-center">JP Hilang</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Penyesuaian</th>
                      <th className="p-3 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-center bg-blue-50/50 dark:bg-blue-950/20">JP Efektif Riil</th>
                      <th className="p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-center">Terlaksana</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Progress</th>
                      <th className="p-3 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {filteredList.map((item, idx) => {
                      return (
                        <tr key={`${item.subjectId}_${item.classId}`} className="hover:bg-slate-50/60 dark:hover:bg-zinc-850/40 transition-colors">
                          <td className="p-3 text-xs font-bold text-slate-400 text-center">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">{item.subjectName}</div>
                            <div className="text-[10px] text-slate-400">Kode: {item.subjectId.slice(0, 8)}</div>
                          </td>
                          <td className="p-3">
                            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.className}</span>
                            <span className="ml-1 text-[10px] text-slate-400 font-normal">({item.gradeLevel})</span>
                          </td>
                          <td className="p-3 text-xs text-slate-700 dark:text-zinc-300 font-medium">
                            {item.teacherName || "-"}
                          </td>
                          <td className="p-3 text-center">
                            <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{item.day}</span>
                            <div className="text-[10px] text-slate-400">{item.scheduledJpPerWeek} JP / Minggu</div>
                          </td>
                          <td className="p-3 text-center text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            {item.plannedJp} JP
                          </td>
                          <td className="p-3 text-center">
                            {item.lostJp > 0 ? (
                              <span className="text-xs font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-100 dark:border-rose-900">
                                -{item.lostJp} JP
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">0 JP</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {item.adjustmentJp !== 0 ? (
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                {item.adjustmentJp > 0 ? `+${item.adjustmentJp}` : item.adjustmentJp} JP
                              </span>
                            ) : item.adjustmentStatus === "pending" ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 rounded-full animate-pulse">
                                Pending
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center bg-blue-50/40 dark:bg-blue-950/10">
                            <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                              {item.effectiveJp} JP
                            </span>
                          </td>
                          <td className="p-3 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {item.executedJp} JP
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-xs font-black text-slate-700 dark:text-zinc-300">{item.progressPercent}%</span>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-1">
                                <div 
                                  className="h-full bg-blue-600 rounded-full transition-all"
                                  style={{ width: `${item.progressPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsDetailModalOpen(true);
                                }}
                                className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                                title="Lihat rincian tanggal mengajar & agenda"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() => handleOpenAdjustmentModal(item)}
                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
                                title="Penyesuaian Manual JP"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Monthly Effective Days Details Tab */}
      {activeTab === "monthly_details" && (
        <div className="space-y-6">
          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Hari Pembelajaran</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{daysAnalysis?.learningDays || 0} Hari</h3>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">KBM efektif tatap muka / aktif</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider mb-1">Hari Asesmen / Ujian</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">{daysAnalysis?.assessmentDays || 0} Hari</h3>
                <CalendarCheck className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Sumatif, STS, SAS, Try Out</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Hari Kegiatan Sekolah/Pondok</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400">{daysAnalysis?.activityDays || 0} Hari</h3>
                <BookOpen className="h-5 w-5 text-amber-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">MPLS, P5, Outbound, Kegiatan Khusus</p>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Hari Libur / Non-Efektif</p>
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400">{daysAnalysis?.holidayDays || 0} Hari</h3>
                <XCircle className="h-5 w-5 text-rose-500" />
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Libur Nasional, Libur Pondok, Jumat</p>
            </div>
          </div>

          {/* Monthly Accordion Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-500" />
                Rincian Hari Efektif Per Bulan (Semester {currentSemester?.name})
              </h3>
              <span className="text-xs text-slate-500">
                Total Pekan Efektif: <strong className="text-blue-600 font-black">{weeksAnalysis?.effectiveWeeks || 0} Pekan</strong>
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                <p className="text-xs font-semibold">Memuat rincian hari efektif per bulan...</p>
              </div>
            ) : !weeksAnalysis?.details || weeksAnalysis.details.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <Calendar className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <p className="text-sm font-semibold">Belum ada data kalender akademik untuk semester ini</p>
              </div>
            ) : (
              weeksAnalysis.details.map((mDetail: any, mIdx: number) => {
                const monthName = mDetail.month;
                const isExpanded = expandedMonths[monthName] ?? (mIdx === 0);

                // Filter days from daysAnalysis that fall in this month
                const monthDays = (daysAnalysis?.details || []).filter((d: any) => {
                  const dObj = new Date(d.date);
                  const dMonthStr = dObj.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
                  return dMonthStr.toLowerCase() === monthName.toLowerCase();
                });

                const countLearning = monthDays.filter((d: any) => d.type === "pembelajaran").length;
                const countAssessment = monthDays.filter((d: any) => d.type === "asesmen").length;
                const countActivity = monthDays.filter((d: any) => d.type === "kegiatan").length;
                const countHoliday = monthDays.filter((d: any) => d.type === "libur").length;

                return (
                  <div 
                    key={monthName}
                    className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs transition-all"
                  >
                    {/* Month Header Card */}
                    <div 
                      onClick={() => setExpandedMonths(prev => ({ ...prev, [monthName]: !isExpanded }))}
                      className="p-4 bg-slate-50/70 dark:bg-zinc-850/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-zinc-850 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl font-bold">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900 dark:text-zinc-100">{monthName}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                            <span className="font-extrabold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              {mDetail.effectiveWeeks} Pekan Efektif
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{countLearning} Belajar</span> &bull;
                            <span className="text-blue-600 dark:text-blue-400 font-bold">{countAssessment} Asesmen</span> &bull;
                            <span className="text-amber-600 dark:text-amber-400 font-bold">{countActivity} Kegiatan</span> &bull;
                            <span className="text-rose-500 dark:text-rose-400 font-bold">{countHoliday} Libur</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {mDetail.holidayNotes && mDetail.holidayNotes.length > 0 && (
                          <div className="hidden lg:flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-3 py-1 rounded-xl border border-rose-100 dark:border-rose-900/40">
                            <Info className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate max-w-[220px]">{mDetail.holidayNotes.join(", ")}</span>
                          </div>
                        )}
                        <button className="p-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Day Details Table */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-zinc-800 space-y-3">
                        {monthDays.length === 0 ? (
                          <p className="text-xs text-slate-400 p-4 text-center">Data tanggal kalender belum terurai untuk bulan ini.</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-zinc-850 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-zinc-800">
                                  <th className="p-2.5 text-center w-12">No</th>
                                  <th className="p-2.5">Tanggal & Hari</th>
                                  <th className="p-2.5 text-center">Kategori Hari</th>
                                  <th className="p-2.5 text-center">Status Efektif KBM</th>
                                  <th className="p-2.5">Agenda / Event Sekolah & Pondok</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                                {monthDays.map((dayItem: any, dayIdx: number) => {
                                  const dateFormatted = new Date(dayItem.date).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric"
                                  });

                                  let typeBadge = (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                      KBM Efektif
                                    </span>
                                  );
                                  if (dayItem.type === "asesmen") {
                                    typeBadge = (
                                      <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                                        Asesmen / Ujian
                                      </span>
                                    );
                                  } else if (dayItem.type === "kegiatan") {
                                    typeBadge = (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                                        Kegiatan Sekolah
                                      </span>
                                    );
                                  } else if (dayItem.type === "libur") {
                                    typeBadge = (
                                      <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                                        Hari Libur
                                      </span>
                                    );
                                  }

                                  return (
                                    <tr 
                                      key={dayItem.date}
                                      className={`hover:bg-slate-50/60 dark:hover:bg-zinc-850/40 transition-colors ${
                                        !dayItem.isEffective ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                                      }`}
                                    >
                                      <td className="p-2.5 text-center font-bold text-slate-400">{dayIdx + 1}</td>
                                      <td className="p-2.5 font-bold text-slate-800 dark:text-zinc-200">
                                        {dateFormatted}
                                      </td>
                                      <td className="p-2.5 text-center">{typeBadge}</td>
                                      <td className="p-2.5 text-center">
                                        {dayItem.isEffective ? (
                                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                                            <CheckCircle2 className="h-3.5 w-3.5" /> Efektif
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                                            <XCircle className="h-3.5 w-3.5" /> Non-Efektif
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2.5 text-slate-600 dark:text-zinc-400">
                                        {dayItem.events && dayItem.events.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {dayItem.events.map((ev: string, evIdx: number) => (
                                              <span key={evIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-md font-medium text-[11px]">
                                                {ev}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-slate-400 text-[11px]">-</span>
                                        )}
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
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && isApprover && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" /> Persetujuan Penyesuaian JP Efektif
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Verifikasi & setujui pengajuan perubahan JP Efektif dari guru pengampu.
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full">
              {pendingAdjustments.length} Permohonan Pending
            </span>
          </div>

          {pendingAdjustments.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2 opacity-60" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Tidak ada pengajuan pending saat ini</p>
              <p className="text-xs text-slate-400 mt-1">Seluruh penyesuaian JP telah disetujui atau belum ada pengajuan baru.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-zinc-850">
              {pendingAdjustments.map((adj) => (
                <div key={adj.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">{adj.subjectName}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                        {adj.className} ({adj.gradeLevel})
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-zinc-400">
                      Diajukan oleh: <strong className="text-slate-800 dark:text-zinc-200">{adj.adjustedByUserName}</strong> &bull; Pada: {new Date(adj.updatedAt).toLocaleString("id-ID")}
                    </p>
                    <div className="flex items-center gap-3 text-xs mt-1">
                      <span className="text-slate-500">Nilai Sistem: <strong>{adj.systemValue} JP</strong></span>
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                      <span className="text-blue-600 font-bold">Pengajuan Manual: {adj.manualValue} JP ({adj.adjustmentDelta >= 0 ? `+${adj.adjustmentDelta}` : adj.adjustmentDelta} JP)</span>
                    </div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 italic bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/50 mt-2">
                      "Alasan: {adj.reason}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveAdjustment(adj)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Check className="h-4 w-4" /> Setujui
                    </button>
                    <button
                      onClick={() => handleRejectAdjustment(adj)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <X className="h-4 w-4" /> Tolak
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAIL TIMELINE MODAL */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-850/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                  Detail Timeline & Agendaterdampak KBM
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {selectedItem.subjectName} &bull; {selectedItem.className} &bull; Guru: {selectedItem.teacherName}
                </p>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-zinc-850 rounded-2xl text-center border border-slate-100 dark:border-zinc-800">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">JP Rencana</p>
                  <p className="text-lg font-black text-slate-800 dark:text-zinc-100">{selectedItem.plannedJp} JP</p>
                </div>
                <div>
                  <p className="text-[10px] text-rose-500 font-bold uppercase">JP Hilang</p>
                  <p className="text-lg font-black text-rose-600 dark:text-rose-400">-{selectedItem.lostJp} JP</p>
                </div>
                <div>
                  <p className="text-[10px] text-blue-500 font-bold uppercase">JP Efektif Riil</p>
                  <p className="text-lg font-black text-blue-600 dark:text-blue-400">{selectedItem.effectiveJp} JP</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Daftar Seluruh Tanggal Jadwal KBM ({selectedItem.dateDetails.length} Pertemuan Terjadwal)
                </h4>
                <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-zinc-850">
                  {selectedItem.dateDetails.map((dt, k) => (
                    <div 
                      key={dt.date} 
                      className={`p-3 text-xs flex items-center justify-between ${
                        dt.actualJp === 0 
                          ? "bg-rose-50/40 dark:bg-rose-950/10" 
                          : "hover:bg-slate-50/50 dark:hover:bg-zinc-850/30"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400 font-semibold w-6">{k + 1}.</span>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-zinc-200">
                            {new Date(dt.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                            {dt.description}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {dt.actualJp > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] rounded-lg">
                            + {dt.actualJp} JP Normal
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-[11px] rounded-lg">
                            0 JP (Hilang)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex justify-end">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {isAdjustmentModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
            <form onSubmit={handleSaveAdjustment}>
              <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-850/50">
                <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Edit3 className="h-4 w-4 text-blue-500" /> Penyesuaian Manual JP Efektif
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-zinc-850 rounded-2xl space-y-1 border border-slate-100 dark:border-zinc-800 text-xs">
                  <p className="font-bold text-slate-800 dark:text-zinc-200">{selectedItem.subjectName} ({selectedItem.className})</p>
                  <p className="text-slate-500">Nilai Otomatis Sistem: <strong>{selectedItem.plannedJp - selectedItem.lostJp} JP</strong></p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Nilai JP Efektif Disesuaikan
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={manualValueInput}
                    onChange={(e) => setManualValueInput(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200 font-bold"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Selisih: {manualValueInput - (selectedItem.plannedJp - selectedItem.lostJp) >= 0 ? '+' : ''}
                    {manualValueInput - (selectedItem.plannedJp - selectedItem.lostJp)} JP
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                    Alasan Penyesuaian <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Pembelajaran KBM pengganti pada hari efektif lain, tukar jadwal, atau kegiatan khusus..."
                    value={adjustmentReasonInput}
                    onChange={(e) => setAdjustmentReasonInput(e.target.value)}
                    className="w-full p-3 text-xs bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-200"
                    required
                  />
                </div>

                {settings?.requiresJpAdjustmentApproval && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Perubahan ini memerlukan persetujuan Kepala Sekolah/Waka Kurikulum sebelum berlaku.</span>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjustment}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 cursor-pointer disabled:opacity-50"
                >
                  {isSavingAdjustment ? "Menyimpan..." : "Simpan Penyesuaian"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EffectiveJp;
