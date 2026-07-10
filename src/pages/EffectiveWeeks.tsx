import React, { useState, useEffect } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { Semester, EffectiveWeeksAnalysis } from "../types";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { 
  Calendar, 
  HelpCircle, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  XCircle,
  Clock,
  ChevronRight,
  Info,
  Sliders,
  Settings,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export const EffectiveWeeks: React.FC = () => {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [analysis, setAnalysis] = useState<EffectiveWeeksAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeLevels, setGradeLevels] = useState<string[]>(["VII", "VIII", "IX"]);
  const [selectedGrade, setSelectedGrade] = useState<string>("VII");

  // Manual weeks config states
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    manualWeeksConfigured: false,
    totalWeeks: 0,
    effectiveWeeks: 0,
    ineffectiveWeeks: 0,
    assessmentWeeks: 0,
    pasPatWeeks: 0,
    projectWeeks: 0,
    otherWeeks: 0
  });

  const canManageWeeks = currentUser?.role === "admin" || 
                         currentUser?.role === "wakil kepala sekolah" || 
                         currentUser?.role?.toLowerCase().includes("wakil") || 
                         currentUser?.role?.toLowerCase().includes("kurikulum");

  // Load Semesters and Class Levels
  useEffect(() => {
    setLoading(true);
    Promise.all([
      semesterService.getSemesters(),
      classService.getClasses().catch(() => [])
    ])
      .then(([sems, clss]) => {
        setSemesters(sems);
        const uniqueGrades = Array.from(new Set(clss.map((c: any) => c.gradeLevel).filter(Boolean)));
        const sortedGrades = uniqueGrades.length > 0 ? uniqueGrades.sort() : ["VII", "VIII", "IX"];
        setGradeLevels(sortedGrades);
        if (sortedGrades.length > 0) {
          setSelectedGrade(sortedGrades[0]);
        }
        
        const active = sems.find(s => s.isActive);
        if (active) {
          setSelectedSemesterId(active.id);
        } else if (sems.length > 0) {
          setSelectedSemesterId(sems[0].id);
        }
      })
      .catch((err) => showToast("Gagal memuat master data: " + err.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const currentSemester = semesters.find(s => s.id === selectedSemesterId);

  // Calculate analysis whenever currentSemester changes
  const runAnalysis = async () => {
    if (!currentSemester) return;
    setLoading(true);
    try {
      const data = await academicPlanningService.analyzeEffectiveWeeks(
        currentSemester.startDate,
        currentSemester.endDate,
        currentSemester.academicYearId,
        currentSemester.id
      );
      setAnalysis(data);

      setManualForm({
        manualWeeksConfigured: !!data.manualWeeksConfigured,
        totalWeeks: data.totalWeeks || 0,
        effectiveWeeks: data.effectiveWeeks || 0,
        ineffectiveWeeks: data.ineffectiveWeeks || 0,
        assessmentWeeks: data.assessmentWeeks || 0,
        pasPatWeeks: data.pasPatWeeks || 0,
        projectWeeks: data.projectWeeks || 0,
        otherWeeks: data.otherWeeks || 0
      });
    } catch (error: any) {
      showToast("Gagal melakukan analisis pekan efektif: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSemester) return;
    try {
      setLoading(true);
      await semesterService.updateManualWeeksConfig(
        currentSemester.id,
        {
          manualWeeksConfigured: manualForm.manualWeeksConfigured,
          totalWeeks: Number(manualForm.totalWeeks),
          effectiveWeeks: Number(manualForm.effectiveWeeks),
          ineffectiveWeeks: Number(manualForm.totalWeeks) - Number(manualForm.effectiveWeeks),
          assessmentWeeks: Number(manualForm.assessmentWeeks),
          pasPatWeeks: Number(manualForm.pasPatWeeks),
          projectWeeks: Number(manualForm.projectWeeks),
          otherWeeks: Number(manualForm.otherWeeks)
        },
        currentUser?.uid || "system",
        currentUser?.displayName || currentUser?.name || "System"
      );

      showToast("Pengaturan pekan semester berhasil diperbarui!", "success");
      setIsManualModalOpen(false);
      await runAnalysis();
    } catch (error: any) {
      showToast("Gagal menyimpan pengaturan pekan: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [selectedSemesterId, semesters]);

  // EXCEL EXPORT
  const handleExportExcel = () => {
    if (!analysis || !currentSemester) return;
    try {
      const dataToExport = analysis.details.map((m, idx) => ({
        "No": idx + 1,
        "Bulan": m.month,
        "Jumlah Pekan": m.totalWeeks,
        "Pekan Efektif": m.effectiveWeeks,
        "Pekan Tidak Efektif": m.ineffectiveWeeks,
        "Keterangan / Agenda": m.notes
      }));

      // Add summary row
      dataToExport.push({
        "No": "",
        "Bulan": "TOTAL",
        "Jumlah Pekan": analysis.totalWeeks,
        "Pekan Efektif": analysis.effectiveWeeks,
        "Pekan Tidak Efektif": analysis.ineffectiveWeeks,
        "Keterangan / Agenda": "Analisis Pekan Efektif"
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analisis Pekan Efektif");
      XLSX.writeFile(wb, `Analisis_Pekan_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.xlsx`);
      showToast("Unduh data Excel berhasil!", "success");
    } catch (error: any) {
      showToast("Gagal export Excel: " + error.message, "error");
    }
  };

  // PDF EXPORT
  const handleExportPDF = () => {
    if (!analysis || !currentSemester) return;
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("ANALISIS PEKAN EFEKTIF (RPE)", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Tahun Pelajaran: ${currentSemester.academicYearName}`, 14, 28);
      doc.text(`Semester: ${currentSemester.name} (${currentSemester.code})`, 14, 34);
      doc.text(`Masa Berlaku: ${currentSemester.startDate} s/d ${currentSemester.endDate}`, 14, 40);
      doc.text(`Dicetak Oleh: ${analysis.academicYearId ? 'SMP Alkarim Rasyid System' : 'System'}`, 14, 46);

      doc.line(14, 50, 196, 50);

      // Cards
      doc.setFont("helvetica", "bold");
      doc.text(`Total Pekan: ${analysis.totalWeeks}`, 14, 60);
      doc.text(`Pekan Efektif: ${analysis.effectiveWeeks}`, 80, 60);
      doc.text(`Pekan Tidak Efektif: ${analysis.ineffectiveWeeks}`, 140, 60);

      doc.line(14, 65, 196, 65);

      let yPos = 75;
      doc.text("Rincian Analisis per Bulan:", 14, yPos);
      yPos += 10;

      analysis.details.forEach((m, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}. Bulan ${m.month}`, 14, yPos);
        yPos += 5;

        doc.setFont("helvetica", "normal");
        doc.text(`   Total Pekan: ${m.totalWeeks} | Efektif: ${m.effectiveWeeks} | Tidak Efektif: ${m.ineffectiveWeeks}`, 14, yPos);
        yPos += 5;
        doc.text(`   Keterangan: ${m.notes}`, 14, yPos);
        yPos += 8;
      });

      doc.save(`Analisis_Pekan_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.pdf`);
      showToast("PDF berhasil diunduh!", "success");
    } catch (error: any) {
      showToast("Gagal export PDF: " + error.message, "error");
    }
  };

  const computedEffectiveWeeks = analysis
    ? (analysis.details || []).reduce((sum, item) => sum + (item.effectiveWeeksByGrade?.[selectedGrade] ?? item.effectiveWeeks), 0)
    : 0;

  const computedIneffectiveWeeks = analysis
    ? Math.max(0, analysis.totalWeeks - computedEffectiveWeeks)
    : 0;

  return (
    <div className="space-y-6" id="effective-weeks-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Analisis Pekan Efektif</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Hitung otomatis alokasi minggu belajar efektif siswa dalam satu semester berjalan.
          </p>
        </div>

        {/* Semester selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-xs shrink-0">
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
      </div>

      {/* Grade Level Selector Tabs */}
      {analysis && gradeLevels.length > 1 && (
        <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-2">
          {gradeLevels.map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`pb-2.5 px-4 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                selectedGrade === grade
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300"
              }`}
            >
              Jenjang {grade}
            </button>
          ))}
        </div>
      )}

      {/* KPI Stats Cards */}
      {analysis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pekan Semester</p>
                <h3 className="text-3xl font-extrabold text-slate-800 dark:text-zinc-100 mt-1">{analysis.totalWeeks} Pekan</h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-500">
                <Calendar className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-blue-500" />
              <span>Dihitung dari rentang tanggal semester aktif</span>
            </div>
          </div>

          <div className="bg-emerald-50/40 dark:bg-emerald-950/5 border border-emerald-100 dark:border-emerald-900/40 p-5 rounded-2xl shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400 uppercase tracking-wider">Pekan Efektif Belajar ({selectedGrade})</p>
                <h3 className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">{computedEffectiveWeeks} Pekan</h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/45 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-3 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Hari efektif KBM minimal 3 hari dalam satu pekan</span>
            </div>
          </div>

          <div className="bg-rose-50/40 dark:bg-rose-950/5 border border-rose-100 dark:border-rose-900/40 p-5 rounded-2xl shadow-xs relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-rose-600/80 dark:text-rose-400 uppercase tracking-wider">Pekan Tidak Efektif ({selectedGrade})</p>
                <h3 className="text-3xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">{computedIneffectiveWeeks} Pekan</h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/45 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-3 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              <span>Pekan libur, ujian sumatif, atau jeda semester</span>
            </div>
          </div>
        </div>
      )}

      {/* Action panel */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <Info className="h-4 w-4 text-blue-500" />
          <span>Rumus: <strong className="text-slate-800 dark:text-zinc-300 font-semibold">Total Pekan = Efektif + Tidak Efektif</strong></span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canManageWeeks && (
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" /> Pengaturan Pekan
            </button>
          )}
          <button
            onClick={runAnalysis}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Analisis Ulang
          </button>
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

      {/* Main Analysis Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Daftar Distribusi Pekan per Bulan</h3>
        </div>
        
        {loading ? (
          <div className="p-16 text-center text-slate-500 dark:text-zinc-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-sm font-medium">Melakukan perhitungan alokasi waktu...</p>
          </div>
        ) : !analysis ? (
          <div className="p-16 text-center text-slate-400">
            <Calendar className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">Data analisis tidak tersedia</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-850/50 border-b border-slate-200 dark:border-zinc-800">
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">No</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Bulan & Tahun</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Jumlah Pekan</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Pekan Efektif</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Pekan Tidak Efektif</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Keterangan Kegiatan / Agenda Libur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                {analysis.details.map((row, idx) => {
                  const effWeeks = row.effectiveWeeksByGrade?.[selectedGrade] ?? row.effectiveWeeks;
                  const ineffWeeks = Math.max(0, row.totalWeeks - effWeeks);
                  return (
                    <tr key={row.month} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30 transition-colors">
                      <td className="p-4 text-sm font-medium text-slate-500 dark:text-zinc-500">{idx + 1}</td>
                      <td className="p-4 text-sm font-semibold text-slate-800 dark:text-zinc-200">{row.month}</td>
                      <td className="p-4 text-sm font-bold text-slate-800 dark:text-zinc-200 text-center bg-slate-50/40 dark:bg-zinc-950/20">{row.totalWeeks}</td>
                      <td className="p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center">{effWeeks}</td>
                      <td className="p-4 text-sm font-bold text-rose-500 text-center">{ineffWeeks}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1 text-xs text-slate-600 dark:text-zinc-400">
                          {ineffWeeks > 0 ? (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                          ) : (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                          )}
                          <span className="truncate max-w-md" title={row.notes}>{row.notes}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/75 dark:bg-zinc-800/40 font-bold border-t border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100">
                  <td className="p-4 text-sm text-center" colSpan={2}>JUMLAH / TOTAL</td>
                  <td className="p-4 text-sm text-center bg-slate-50/60 dark:bg-zinc-950/35">{analysis.totalWeeks}</td>
                  <td className="p-4 text-sm text-center text-emerald-600 dark:text-emerald-400">{computedEffectiveWeeks}</td>
                  <td className="p-4 text-sm text-center text-rose-500">{computedIneffectiveWeeks}</td>
                  <td className="p-4 text-xs text-slate-400 font-semibold italic">Perhitungan Tersertifikasi System RPE</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* MANUAL PEKAN CONFIG MODAL */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-blue-500" />
                Pengaturan Pekan Semester (Manual / Kustom)
              </h3>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualConfig} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Metode Perhitungan</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, manualWeeksConfigured: false })}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border cursor-pointer text-center ${
                      !manualForm.manualWeeksConfigured
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-300"
                        : "border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    Otomatis (Kalender)
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualForm({ ...manualForm, manualWeeksConfigured: true })}
                    className={`px-3 py-2 text-xs font-bold rounded-xl border cursor-pointer text-center ${
                      manualForm.manualWeeksConfigured
                        ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-300"
                        : "border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    Kustom (Manual)
                  </button>
                </div>
              </div>

              {manualForm.manualWeeksConfigured && (
                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Total Pekan Semester</label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={manualForm.totalWeeks}
                      onChange={(e) => setManualForm({ ...manualForm, totalWeeks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Pekan Efektif Belajar</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={manualForm.totalWeeks}
                      value={manualForm.effectiveWeeks}
                      onChange={(e) => setManualForm({ ...manualForm, effectiveWeeks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Pekan Penilaian (PTS/PAS)</label>
                    <input
                      type="number"
                      min={0}
                      value={manualForm.assessmentWeeks}
                      onChange={(e) => setManualForm({ ...manualForm, assessmentWeeks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Pekan PAS/PAT</label>
                    <input
                      type="number"
                      min={0}
                      value={manualForm.pasPatWeeks}
                      onChange={(e) => setManualForm({ ...manualForm, pasPatWeeks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Pekan Projek (P5)</label>
                    <input
                      type="number"
                      min={0}
                      value={manualForm.projectWeeks}
                      onChange={(e) => setManualForm({ ...manualForm, projectWeeks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Pekan Lain-Lain</label>
                    <input
                      type="number"
                      min={0}
                      value={manualForm.otherWeeks}
                      onChange={(e) => setManualForm({ ...manualForm, otherWeeks: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 font-semibold"
                    />
                  </div>

                  <div className="col-span-2 text-xs text-slate-400 italic">
                    * Jumlah pekan tidak efektif otomatis dihitung sebagai: {manualForm.totalWeeks - manualForm.effectiveWeeks} pekan.
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-150 dark:border-zinc-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4" />
                  Simpan Pengaturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EffectiveWeeks;
