import React, { useState, useEffect } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { classService } from "../services/classService";
import { Semester, EffectiveJpAnalysis } from "../types";
import { useToast } from "../contexts/ToastContext";
import { 
  BarChart, 
  HelpCircle, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  BookOpen, 
  Layers, 
  Users,
  Grid,
  TrendingUp,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export const EffectiveJp: React.FC = () => {
  const { showToast } = useToast();
  
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [analysis, setAnalysis] = useState<EffectiveJpAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  const [rombelCounts, setRombelCounts] = useState({ VII: 0, VIII: 0, IX: 0 });

  // Load Semester & Rombels
  const loadData = async () => {
    try {
      const [sems, classes] = await Promise.all([
        semesterService.getSemesters(),
        classService.getClasses()
      ]);
      setSemesters(sems);
      
      const activeClasses = classes.filter(c => c.status === "Aktif" && !c.isDeleted);
      setRombelCounts({
        VII: activeClasses.filter(c => c.gradeLevel === "VII").length,
        VIII: activeClasses.filter(c => c.gradeLevel === "VIII").length,
        IX: activeClasses.filter(c => c.gradeLevel === "IX").length
      });

      const active = sems.find(s => s.isActive);
      if (active) {
        setSelectedSemesterId(active.id);
      } else if (sems.length > 0) {
        setSelectedSemesterId(sems[0].id);
      }
    } catch (err: any) {
      showToast("Gagal memuat data master JP: " + err.message, "error");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentSemester = semesters.find(s => s.id === selectedSemesterId);

  const runAnalysis = async () => {
    if (!currentSemester) return;
    setLoading(true);
    try {
      const data = await academicPlanningService.analyzeEffectiveJp(
        currentSemester.academicYearId,
        currentSemester.id,
        currentSemester.startDate,
        currentSemester.endDate
      );
      setAnalysis(data);
    } catch (error: any) {
      showToast("Gagal melakukan analisis JP efektif: " + error.message, "error");
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
      const dataToExport = analysis.bySubject.map((s, idx) => ({
        "No": idx + 1,
        "Mata Pelajaran": s.subjectName,
        "Mingguan VII (JP)": s.weeklyJpVii,
        "Mingguan VIII (JP)": s.weeklyJpViii,
        "Mingguan IX (JP)": s.weeklyJpIx,
        "Total JP Mingguan (Semua Rombel)": s.weeklyJpVii + s.weeklyJpViii + s.weeklyJpIx,
        "JP Efektif Semester Ganjil": s.effectiveSemesterGanjil,
        "JP Efektif Semester Genap": s.effectiveSemesterGenap,
        "JP Efektif Tahunan": s.effectiveTahunan
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analisis JP Efektif");
      XLSX.writeFile(wb, `Analisis_JP_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.xlsx`);
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
      doc.text("ANALISIS JP EFEKTIF PER MATA PELAJARAN", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Tahun Pelajaran: ${currentSemester.academicYearName}`, 14, 28);
      doc.text(`Semester: ${currentSemester.name} (${currentSemester.code})`, 14, 34);
      doc.text(`Kalkulasi Rombel Aktif: VII (${rombelCounts.VII} Rombel) | VIII (${rombelCounts.VIII} Rombel) | IX (${rombelCounts.IX} Rombel)`, 14, 40);

      doc.line(14, 44, 196, 44);

      let yPos = 54;
      doc.setFont("helvetica", "bold");
      doc.text("Kalkulasi Total JP Efektif Kelembagaan:", 14, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(`- JP Efektif Semester Ini (Ganjil/Genap): ${analysis.effectiveJpHalfYear} JP`, 14, yPos + 6);
      doc.text(`- Proyeksi JP Efektif Tahunan (Double Semester): ${analysis.effectiveJpFullYear} JP`, 14, yPos + 12);

      doc.line(14, 72, 196, 72);
      
      yPos = 82;
      doc.setFont("helvetica", "bold");
      doc.text("Daftar JP Efektif Per Mata Pelajaran (Top 15):", 14, yPos);
      yPos += 8;

      doc.setFontSize(9);
      analysis.bySubject.slice(0, 15).forEach((s) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text(s.subjectName, 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(`- JP Mingguan (VII: ${s.weeklyJpVii}, VIII: ${s.weeklyJpViii}, IX: ${s.weeklyJpIx}) | Efektif Semester Ganjil: ${s.effectiveSemesterGanjil} JP | Tahunan: ${s.effectiveTahunan} JP`, 14, yPos + 5);
        yPos += 10;
      });

      doc.save(`Analisis_JP_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.pdf`);
      showToast("PDF Laporan Berhasil Diunduh!", "success");
    } catch (error: any) {
      showToast("Gagal export PDF: " + error.message, "error");
    }
  };

  return (
    <div className="space-y-6" id="effective-jp-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Analisis JP Efektif</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Hitung otomatis ketersediaan jam pelajaran (JP) efektif per mata pelajaran dan per jenjang kelas.
          </p>
        </div>

        {/* Semester select */}
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

      {/* KPI Cards / Multi Rombel Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rombel Aktif (VII)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{rombelCounts.VII} Rombel</h3>
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-[9px] text-slate-400 mt-2">Seluruh rombongan belajar kelas 7 aktif</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rombel Aktif (VIII)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{rombelCounts.VIII} Rombel</h3>
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-[9px] text-slate-400 mt-2">Seluruh rombongan belajar kelas 8 aktif</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xs">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rombel Aktif (IX)</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100">{rombelCounts.IX} Rombel</h3>
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-[9px] text-slate-400 mt-2">Seluruh rombongan belajar kelas 9 aktif</p>
        </div>

        <div className="bg-blue-600 border border-blue-700 p-4 rounded-2xl shadow-md shadow-blue-500/10 text-white">
          <p className="text-[10px] font-bold text-blue-100 uppercase tracking-wider mb-1">Total JP Efektif Kelembagaan</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black">{analysis ? analysis.effectiveJpHalfYear : 0} JP</h3>
            <TrendingUp className="h-5 w-5 text-blue-200" />
          </div>
          <p className="text-[9px] text-blue-200 mt-2">Calculated for {analysis ? analysis.bySubject.length : 0} subjects total</p>
        </div>
      </div>

      {/* Control panel */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <Info className="h-4 w-4 text-blue-500" />
          <span>Rumus: <strong className="text-slate-800 dark:text-zinc-300 font-semibold">JP Efektif = JP Mingguan * Jumlah Rombel * Pekan Efektif</strong></span>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={runAnalysis}
            className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Analisis Ulang
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Main Analysis JP Grid Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
            Tabel Analisis Alokasi Jam Pelajaran (JP) Efektif
          </h3>
          <span className="text-xs bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-0.5 rounded-full font-bold">
            Multi-Rombel Enabled
          </span>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 dark:text-zinc-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-sm font-medium">Memproses database kurikulum dan rombel...</p>
          </div>
        ) : !analysis || analysis.bySubject.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <BookOpen className="h-10 w-10 mx-auto opacity-30 mb-2" />
            <p className="text-sm font-medium">Data alokasi JP kurikulum belum terkonfigurasi</p>
            <p className="text-xs text-slate-400 mt-1">Silakan atur "Struktur Kurikulum" terlebih dahulu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-850/50 border-b border-slate-200 dark:border-zinc-800">
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">No</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Mata Pelajaran (Mapel)</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">VII JP/Mg</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">VIII JP/Mg</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">IX JP/Mg</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center bg-slate-50 dark:bg-zinc-900/40">JP Mingguan</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">JP Efektif Semester Ganjil</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">JP Efektif Semester Genap</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center text-blue-600 dark:text-blue-400">JP Efektif Tahunan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                {analysis.bySubject.map((row, idx) => {
                  const weeklySum = row.weeklyJpVii + row.weeklyJpViii + row.weeklyJpIx;
                  return (
                    <tr key={row.subjectId} className="hover:bg-slate-50/20 dark:hover:bg-zinc-900/20 transition-colors">
                      <td className="p-4 text-xs font-medium text-slate-400">{idx + 1}</td>
                      <td className="p-4 text-sm font-semibold text-slate-800 dark:text-zinc-200">{row.subjectName}</td>
                      <td className="p-4 text-sm font-bold text-slate-600 dark:text-zinc-300 text-center">{row.weeklyJpVii} <span className="text-[10px] text-slate-400 font-normal">JP</span></td>
                      <td className="p-4 text-sm font-bold text-slate-600 dark:text-zinc-300 text-center">{row.weeklyJpViii} <span className="text-[10px] text-slate-400 font-normal">JP</span></td>
                      <td className="p-4 text-sm font-bold text-slate-600 dark:text-zinc-300 text-center">{row.weeklyJpIx} <span className="text-[10px] text-slate-400 font-normal">JP</span></td>
                      <td className="p-4 text-sm font-extrabold text-slate-800 dark:text-zinc-100 text-center bg-slate-50/50 dark:bg-zinc-950/20">{weeklySum} JP</td>
                      <td className="p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center">{row.effectiveSemesterGanjil} JP</td>
                      <td className="p-4 text-sm font-bold text-amber-600 dark:text-amber-400 text-center">{row.effectiveSemesterGenap} JP</td>
                      <td className="p-4 text-sm font-extrabold text-blue-600 dark:text-blue-400 text-center bg-blue-50/10 dark:bg-blue-950/10">{row.effectiveTahunan} JP</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-zinc-800/40 font-bold border-t border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100">
                  <td className="p-4 text-sm text-center" colSpan={2}>TOTAL JP INSTITUSI</td>
                  <td className="p-4 text-sm text-center">
                    {analysis.bySubject.reduce((sum, r) => sum + r.weeklyJpVii, 0)} JP
                  </td>
                  <td className="p-4 text-sm text-center">
                    {analysis.bySubject.reduce((sum, r) => sum + r.weeklyJpViii, 0)} JP
                  </td>
                  <td className="p-4 text-sm text-center">
                    {analysis.bySubject.reduce((sum, r) => sum + r.weeklyJpIx, 0)} JP
                  </td>
                  <td className="p-4 text-sm text-center bg-slate-50/60 dark:bg-zinc-950/35">
                    {analysis.bySubject.reduce((sum, r) => sum + r.weeklyJpVii + r.weeklyJpViii + r.weeklyJpIx, 0)} JP
                  </td>
                  <td className="p-4 text-sm text-center text-emerald-600 dark:text-emerald-400">
                    {analysis.effectiveJpHalfYear} JP
                  </td>
                  <td className="p-4 text-sm text-center text-amber-600 dark:text-amber-400">
                    {analysis.effectiveJpHalfYear} JP
                  </td>
                  <td className="p-4 text-sm text-center text-blue-600 dark:text-blue-400 bg-blue-50/20 dark:bg-blue-950/20">
                    {analysis.effectiveJpFullYear} JP
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EffectiveJp;
