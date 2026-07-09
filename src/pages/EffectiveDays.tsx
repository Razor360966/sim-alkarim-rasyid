import React, { useState, useEffect } from "react";
import { academicPlanningService } from "../services/academicPlanning.service";
import { semesterService } from "../services/semester.service";
import { Semester, EffectiveDaysAnalysis } from "../types";
import { useToast } from "../contexts/ToastContext";
import { 
  Calendar, 
  HelpCircle, 
  FileSpreadsheet, 
  FileText, 
  RefreshCw, 
  BookOpen, 
  Smile, 
  Award, 
  Award as ActivityIcon, 
  Check, 
  X,
  Search,
  Filter,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";

export const EffectiveDays: React.FC = () => {
  const { showToast } = useToast();
  
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [analysis, setAnalysis] = useState<EffectiveDaysAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dayTypeFilter, setDayTypeFilter] = useState("");

  // Load Semesters
  useEffect(() => {
    semesterService.getSemesters()
      .then((sems) => {
        setSemesters(sems);
        const active = sems.find(s => s.isActive);
        if (active) {
          setSelectedSemesterId(active.id);
        } else if (sems.length > 0) {
          setSelectedSemesterId(sems[0].id);
        }
      })
      .catch((err) => showToast("Gagal memuat semester: " + err.message, "error"));
  }, []);

  const currentSemester = semesters.find(s => s.id === selectedSemesterId);

  const runAnalysis = async () => {
    if (!currentSemester) return;
    setLoading(true);
    try {
      const data = await academicPlanningService.analyzeEffectiveDays(
        currentSemester.startDate,
        currentSemester.endDate,
        currentSemester.academicYearId,
        currentSemester.id
      );
      setAnalysis(data);
    } catch (error: any) {
      showToast("Gagal melakukan analisis hari efektif: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, [selectedSemesterId, semesters]);

  // Filters calculation
  const filteredDetails = (analysis?.details || []).filter((day) => {
    const matchesSearch = day.date.includes(searchQuery) || 
                          day.dayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          day.events.some(e => e.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = dayTypeFilter ? day.type === dayTypeFilter : true;
    return matchesSearch && matchesType;
  });

  // EXCEL EXPORT
  const handleExportExcel = () => {
    if (!analysis || !currentSemester) return;
    try {
      const dataToExport = analysis.details.map((d, idx) => ({
        "No": idx + 1,
        "Tanggal": d.date,
        "Hari": d.dayName,
        "Klasifikasi Hari": d.type,
        "Status Efektif KBM": d.isEffective ? "Ya (Efektif)" : "Tidak (Non-Efektif)",
        "Agenda / Event": d.events.join(", ")
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Analisis Hari Efektif");
      XLSX.writeFile(wb, `Analisis_Hari_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.xlsx`);
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
      doc.text("LAPORAN ANALISIS HARI BELAJAR EFEKTIF", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Tahun Pelajaran: ${currentSemester.academicYearName}`, 14, 28);
      doc.text(`Semester: ${currentSemester.name} (${currentSemester.code})`, 14, 34);
      doc.text(`Masa Berlaku: ${currentSemester.startDate} s/d ${currentSemester.endDate}`, 14, 40);

      doc.line(14, 44, 196, 44);

      // Stats
      doc.setFont("helvetica", "bold");
      doc.text("Kalkulasi Hari Efektif Belajar:", 14, 52);
      doc.setFont("helvetica", "normal");
      doc.text(`- Hari KBM Efektif: ${analysis.learningDays} Hari`, 14, 58);
      doc.text(`- Hari Asesmen/Ujian: ${analysis.assessmentDays} Hari`, 14, 64);
      doc.text(`- Hari Kegiatan Sekolah: ${analysis.activityDays} Hari`, 14, 70);
      doc.text(`- Hari Libur Semester/Nasional: ${analysis.holidayDays} Hari`, 14, 76);

      doc.line(14, 82, 196, 82);

      let yPos = 92;
      doc.setFont("helvetica", "bold");
      doc.text("Rincian Kalender Pembelajaran (30 Hari Pertama):", 14, yPos);
      yPos += 8;

      doc.setFontSize(9);
      analysis.details.slice(0, 30).forEach((d) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${d.date} (${d.dayName})`, 14, yPos);
        doc.setFont("helvetica", "normal");
        doc.text(` - ${d.type} | Efektif KBM: ${d.isEffective ? 'YA' : 'TIDAK'}`, 60, yPos);
        if (d.events.length > 0) {
          yPos += 4;
          doc.text(`   Agenda: ${d.events.join(", ")}`, 14, yPos);
        }
        yPos += 6;
      });

      doc.save(`Analisis_Hari_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.pdf`);
      showToast("PDF Laporan Berhasil Diunduh!", "success");
    } catch (error: any) {
      showToast("Gagal export PDF: " + error.message, "error");
    }
  };

  return (
    <div className="space-y-6" id="effective-days-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">Analisis Hari Efektif</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Pantau dan analisis rincian klasifikasi pembelajaran, ujian, libur, dan kegiatan secara real-time.
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

      {/* KPI Cards */}
      {analysis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari Pembelajaran</p>
                <h3 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 mt-1">{analysis.learningDays} Hari</h3>
              </div>
              <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari Asesmen / Ujian</p>
                <h3 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 mt-1">{analysis.assessmentDays} Hari</h3>
              </div>
              <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600">
                <Award className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari Kegiatan Sekolah</p>
                <h3 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 mt-1">{analysis.activityDays} Hari</h3>
              </div>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600">
                <ActivityIcon className="h-4 w-4" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4.5 rounded-2xl shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari Libur Sekolah</p>
                <h3 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 mt-1">{analysis.holidayDays} Hari</h3>
              </div>
              <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600">
                <Smile className="h-4 w-4" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control panel & Filter */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
          <div className="relative w-full sm:w-60">
            <input
              type="text"
              placeholder="Cari tanggal, hari, event..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs focus:outline-hidden dark:text-zinc-100"
            />
          </div>
          <div className="w-full sm:w-52">
            <select
              value={dayTypeFilter}
              onChange={(e) => setDayTypeFilter(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs focus:outline-hidden dark:text-zinc-100 cursor-pointer"
            >
              <option value="">Semua Jenis Hari</option>
              <option value="Hari Pembelajaran">Hari Pembelajaran</option>
              <option value="Hari Libur">Hari Libur</option>
              <option value="Hari Asesmen">Hari Asesmen</option>
              <option value="Hari Kegiatan">Hari Kegiatan</option>
              <option value="Hari Tidak Aktif (Weekend)">Hari Tidak Aktif (Weekend)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={runAnalysis}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Analisis Ulang
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/10 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/10 cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5" /> Export PDF
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
            Daftar Hari dan Status Efektivitas KBM
          </h3>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-500 dark:text-zinc-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
            <p className="text-sm font-medium">Mengalkulasi dan mengecek agenda sekolah...</p>
          </div>
        ) : filteredDetails.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Info className="h-8 w-8 mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
            <p className="text-sm font-medium">Tidak ada data hari yang cocok dengan filter</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[60vh]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-850/50 border-b border-slate-200 dark:border-zinc-800 sticky top-0 z-10">
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">No</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Tanggal</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Hari</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Jenis Hari</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center">Status Efektif</th>
                  <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Keterangan Agenda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                {filteredDetails.map((row, idx) => (
                  <tr key={row.date} className="hover:bg-slate-50/20 dark:hover:bg-zinc-900/20 transition-colors">
                    <td className="p-4 text-xs font-medium text-slate-400">{idx + 1}</td>
                    <td className="p-4 text-sm font-semibold text-slate-800 dark:text-zinc-300">{row.date}</td>
                    <td className="p-4 text-sm font-semibold text-slate-600 dark:text-zinc-400">{row.dayName}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        row.type === "Hari Pembelajaran" 
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400"
                          : row.type === "Hari Asesmen"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                            : row.type === "Hari Kegiatan"
                              ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400"
                              : row.type === "Hari Libur"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400"
                                : "bg-slate-50 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {row.isEffective ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
                          <Check className="h-4 w-4 stroke-[3px]" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-500">
                          <X className="h-4 w-4 stroke-[3px]" />
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {row.events.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.events.map((e, index) => (
                            <span key={index} className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-medium">
                              {e}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Tidak ada agenda</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EffectiveDays;
