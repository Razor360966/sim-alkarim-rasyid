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
  X,
  ShieldCheck,
  AlertTriangle,
  Edit,
  Save,
  RotateCcw,
  Plus,
  Trash2
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

  // Master Pekan Efektif Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [editingDetails, setEditingDetails] = useState<any[]>([]);

  // Manual extra weeks states (for additional metadata if needed, though they can also be edited)
  const [manualForm, setManualForm] = useState({
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

  // Load analysis whenever currentSemester changes
  const runAnalysis = async (bypassManual: boolean = false) => {
    if (!currentSemester) return;
    setLoading(true);
    try {
      const data = await academicPlanningService.analyzeEffectiveWeeks(
        currentSemester.startDate,
        currentSemester.endDate,
        currentSemester.academicYearId,
        currentSemester.id,
        bypassManual
      );
      setAnalysis(data);
      setEditingDetails(data.details || []);

      setManualForm({
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

  useEffect(() => {
    runAnalysis();
    setIsEditing(false);
  }, [selectedSemesterId, semesters]);

  // Handle status toggle for a specific week
  const handleWeekStatusChange = (monthIndex: number, weekIndex: number, isEffective: boolean) => {
    const updated = [...editingDetails];
    const month = { ...updated[monthIndex] };
    const weeks = [...(month.weeks || [])];
    
    if (weeks[weekIndex]) {
      weeks[weekIndex] = { 
        ...weeks[weekIndex], 
        isEffective,
        notes: isEffective ? "" : (weeks[weekIndex].notes || "Kegiatan Sekolah")
      };
    }

    // Recalculate monthly totals
    const totalWeeks = weeks.length;
    const effectiveWeeks = weeks.filter(w => w.isEffective).length;
    const ineffectiveWeeks = totalWeeks - effectiveWeeks;

    month.weeks = weeks;
    month.totalWeeks = totalWeeks;
    month.effectiveWeeks = effectiveWeeks;
    month.ineffectiveWeeks = ineffectiveWeeks;
    
    // Auto update grade-level specific numbers as well
    month.effectiveWeeksByGrade = {
      "VII": effectiveWeeks,
      "VIII": effectiveWeeks,
      "IX": effectiveWeeks
    };

    const notesArray = weeks.filter(w => !w.isEffective).map(w => w.notes).filter(Boolean);
    month.notes = notesArray.length > 0 ? notesArray.join(", ") : "Hari efektif belajar penuh";

    updated[monthIndex] = month;
    setEditingDetails(updated);
  };

  // Handle notes change for a specific week
  const handleWeekNotesChange = (monthIndex: number, weekIndex: number, notes: string) => {
    const updated = [...editingDetails];
    const month = { ...updated[monthIndex] };
    const weeks = [...(month.weeks || [])];

    if (weeks[weekIndex]) {
      weeks[weekIndex] = { ...weeks[weekIndex], notes };
    }

    month.weeks = weeks;
    const notesArray = weeks.filter(w => !w.isEffective).map(w => w.notes).filter(Boolean);
    month.notes = notesArray.length > 0 ? notesArray.join(", ") : "Hari efektif belajar penuh";

    updated[monthIndex] = month;
    setEditingDetails(updated);
  };

  // Add week to month
  const handleAddWeekToMonth = (monthIndex: number) => {
    const updated = [...editingDetails];
    const month = { ...updated[monthIndex] };
    const weeks = [...(month.weeks || [])];

    const newWeekNum = weeks.length + 1;
    weeks.push({
      weekNum: newWeekNum,
      isEffective: true,
      notes: "",
      dates: []
    });

    const totalWeeks = weeks.length;
    const effectiveWeeks = weeks.filter(w => w.isEffective).length;
    const ineffectiveWeeks = totalWeeks - effectiveWeeks;

    month.weeks = weeks;
    month.totalWeeks = totalWeeks;
    month.effectiveWeeks = effectiveWeeks;
    month.ineffectiveWeeks = ineffectiveWeeks;

    month.effectiveWeeksByGrade = {
      "VII": effectiveWeeks,
      "VIII": effectiveWeeks,
      "IX": effectiveWeeks
    };

    const notesArray = weeks.filter(w => !w.isEffective).map(w => w.notes).filter(Boolean);
    month.notes = notesArray.length > 0 ? notesArray.join(", ") : "Hari efektif belajar penuh";

    updated[monthIndex] = month;
    setEditingDetails(updated);
    showToast(`Berhasil menambahkan Pekan ${newWeekNum} di bulan ${month.month}`, "success");
  };

  // Delete week from month
  const handleDeleteWeekFromMonth = (monthIndex: number, weekIndex: number) => {
    const updated = [...editingDetails];
    const month = { ...updated[monthIndex] };
    const weeks = [...(month.weeks || [])];

    if (weeks.length <= 1) {
      showToast("Bulan harus memiliki minimal 1 pekan!", "error");
      return;
    }

    weeks.splice(weekIndex, 1);

    // Reindex week numbers
    const reindexedWeeks = weeks.map((w, idx) => ({
      ...w,
      weekNum: idx + 1
    }));

    const totalWeeks = reindexedWeeks.length;
    const effectiveWeeks = reindexedWeeks.filter(w => w.isEffective).length;
    const ineffectiveWeeks = totalWeeks - effectiveWeeks;

    month.weeks = reindexedWeeks;
    month.totalWeeks = totalWeeks;
    month.effectiveWeeks = effectiveWeeks;
    month.ineffectiveWeeks = ineffectiveWeeks;

    month.effectiveWeeksByGrade = {
      "VII": effectiveWeeks,
      "VIII": effectiveWeeks,
      "IX": effectiveWeeks
    };

    const notesArray = reindexedWeeks.filter(w => !w.isEffective).map(w => w.notes).filter(Boolean);
    month.notes = notesArray.length > 0 ? notesArray.join(", ") : "Hari efektif belajar penuh";

    updated[monthIndex] = month;
    setEditingDetails(updated);
    showToast(`Berhasil menghapus pekan dari bulan ${month.month}`, "info");
  };

  // Save validated Master Pekan Efektif configuration to database
  const handleSaveMasterPekan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSemester) return;

    // VALIDATION: All ineffective weeks must have a reason (notes)
    for (let mIdx = 0; mIdx < editingDetails.length; mIdx++) {
      const month = editingDetails[mIdx];
      if (Array.isArray(month.weeks)) {
        for (let wIdx = 0; wIdx < month.weeks.length; wIdx++) {
          const week = month.weeks[wIdx];
          if (!week.isEffective && (!week.notes || week.notes.trim() === "")) {
            showToast(`Gagal Menyimpan: Alasan wajib diisi untuk ${month.month} - Pekan ${week.weekNum}!`, "error");
            return;
          }
        }
      }
    }

    try {
      setLoading(true);
      const totalWeeksSum = editingDetails.reduce((sum, m) => sum + m.totalWeeks, 0);
      const effectiveWeeksSum = editingDetails.reduce((sum, m) => sum + m.effectiveWeeks, 0);
      const ineffectiveWeeksSum = totalWeeksSum - effectiveWeeksSum;

      await semesterService.updateManualWeeksConfig(
        currentSemester.id,
        {
          manualWeeksConfigured: true,
          totalWeeks: totalWeeksSum,
          effectiveWeeks: effectiveWeeksSum,
          ineffectiveWeeks: ineffectiveWeeksSum,
          assessmentWeeks: Number(manualForm.assessmentWeeks),
          pasPatWeeks: Number(manualForm.pasPatWeeks),
          projectWeeks: Number(manualForm.projectWeeks),
          otherWeeks: Number(manualForm.otherWeeks),
          details: editingDetails
        },
        currentUser?.uid || "system",
        currentUser?.displayName || currentUser?.name || "System"
      );

      showToast("Master Pekan Efektif berhasil divalidasi dan disimpan!", "success");
      setIsEditing(false);
      await runAnalysis();
    } catch (error: any) {
      showToast("Gagal menyimpan Master Pekan Efektif: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Load clean calendar recommendations
  const handleResetToCalendar = async () => {
    if (!currentSemester) return;
    if (window.confirm("Apakah Anda yakin ingin memuat ulang rekomendasi dari Kalender Akademik? Perubahan manual Anda akan ditimpa.")) {
      await runAnalysis(true); // Bypass manual config
      showToast("Rekomendasi kalender berhasil dimuat ulang. Klik 'Simpan' untuk memfinalisasi.", "info");
    }
  };

  // Format date range nicely
  const formatDateRange = (dates: string[]) => {
    if (!dates || dates.length === 0) return "-";
    const parseDate = (dStr: string) => {
      const d = new Date(dStr);
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    };
    if (dates.length === 1) return parseDate(dates[0]);
    return `${parseDate(dates[0])} s/d ${parseDate(dates[dates.length - 1])}`;
  };

  // EXCEL EXPORT
  const handleExportExcel = () => {
    if (!analysis || !currentSemester) return;
    try {
      const dataToExport: any[] = [];
      analysis.details.forEach((m) => {
        dataToExport.push({
          "Bulan": m.month,
          "Pekan": "RINGKASAN BULAN",
          "Status": `Efektif: ${m.effectiveWeeks} | Tidak: ${m.ineffectiveWeeks}`,
          "Alasan / Agenda Kegiatan": m.notes
        });
        if (Array.isArray((m as any).weeks)) {
          (m as any).weeks.forEach((w: any) => {
            dataToExport.push({
              "Bulan": "",
              "Pekan": `Pekan ${w.weekNum}`,
              "Status": w.isEffective ? "Efektif" : "Tidak Efektif",
              "Alasan / Agenda Kegiatan": w.notes || "-"
            });
          });
        }
      });

      // Add summary row
      dataToExport.push({
        "Bulan": "TOTAL SEMESTER",
        "Pekan": "",
        "Status": `Efektif: ${analysis.effectiveWeeks} Pekan`,
        "Alasan / Agenda Kegiatan": `Total ${analysis.totalWeeks} Pekan`
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Master Pekan Efektif");
      XLSX.writeFile(wb, `Master_Pekan_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.xlsx`);
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
      doc.setFontSize(14);
      doc.text("MASTER PEKAN EFEKTIF (RPE)", 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Tahun Pelajaran: ${currentSemester.academicYearName}`, 14, 27);
      doc.text(`Semester: ${currentSemester.name} (${currentSemester.code})`, 14, 32);
      doc.text(`Masa Berlaku: ${currentSemester.startDate} s/d ${currentSemester.endDate}`, 14, 37);
      doc.text(`Status: ${analysis.manualWeeksConfigured ? 'TERVERIFIKASI / VALID' : 'DRAFT KALENDER'}`, 14, 42);

      doc.line(14, 46, 196, 46);

      // KPI Status
      doc.setFont("helvetica", "bold");
      doc.text(`Total Pekan: ${analysis.totalWeeks}`, 14, 53);
      doc.text(`Pekan Efektif: ${analysis.effectiveWeeks}`, 80, 53);
      doc.text(`Pekan Tidak Efektif: ${analysis.ineffectiveWeeks}`, 140, 53);

      doc.line(14, 58, 196, 58);

      let yPos = 67;
      doc.text("Rincian Master Pekan per Bulan:", 14, yPos);
      yPos += 8;

      analysis.details.forEach((m) => {
        if (yPos > 260) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`Bulan ${m.month} (Total: ${m.totalWeeks} Pekan, Efektif: ${m.effectiveWeeks})`, 14, yPos);
        yPos += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);

        if (Array.isArray((m as any).weeks)) {
          (m as any).weeks.forEach((w: any) => {
            if (yPos > 270) {
              doc.addPage();
              yPos = 20;
            }
            const statusStr = w.isEffective ? "EFEKTIF" : "TIDAK EFEKTIF";
            doc.text(`  - Pekan ${w.weekNum} (${formatDateRange(w.dates)}) : [${statusStr}]`, 16, yPos);
            if (w.notes) {
              doc.text(`    Ket: ${w.notes}`, 16, yPos + 4);
              yPos += 9;
            } else {
              yPos += 5;
            }
          });
        } else {
          doc.text(`  Keterangan: ${m.notes}`, 16, yPos);
          yPos += 7;
        }
        yPos += 3;
      });

      doc.save(`Master_Pekan_Efektif_${currentSemester.academicYearName.replace("/", "_")}_${currentSemester.code}.pdf`);
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
    <div className="space-y-6 animate-fade-in" id="effective-weeks-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-zinc-50 font-sans">
            Master Pekan Efektif
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Pusat validasi dan Single Source of Truth alokasi pekan efektif pembelajaran pesantren.
          </p>
        </div>

        {/* Semester Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 shadow-xs shrink-0">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Semester:</span>
          <select
            value={selectedSemesterId}
            onChange={(e) => setSelectedSemesterId(e.target.value)}
            disabled={isEditing}
            className="text-sm font-semibold text-slate-700 dark:text-zinc-200 bg-transparent focus:outline-hidden cursor-pointer disabled:opacity-50"
          >
            {semesters.map((s) => (
              <option key={s.id} value={s.id}>
                {s.academicYearName} - {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Verification Status Banner */}
      {analysis && (
        <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          analysis.manualWeeksConfigured
            ? "bg-emerald-50/40 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300"
            : "bg-amber-50/40 border-amber-100 dark:bg-amber-950/10 dark:border-amber-900/40 text-amber-800 dark:text-amber-300"
        }`}>
          <div className="flex items-start sm:items-center gap-3">
            {analysis.manualWeeksConfigured ? (
              <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              <h4 className="font-extrabold text-sm">
                {analysis.manualWeeksConfigured 
                  ? "Status Verifikasi: Terverifikasi (Master)" 
                  : "Status Verifikasi: Rekomendasi Otomatis (Draft)"}
              </h4>
              <p className="text-xs opacity-90 mt-0.5">
                {analysis.manualWeeksConfigured
                  ? "Daftar pekan telah diverifikasi dan disahkan oleh Kurikulum sebagai acuan tunggal Program Semester & Prota."
                  : "Daftar pekan masih dihitung berdasarkan algoritma Kalender Akademik secara otomatis. Harap divalidasi."}
              </p>
            </div>
          </div>

          {canManageWeeks && !isEditing && (
            <button
              onClick={() => {
                setIsEditing(true);
                // Initialize local edit state
                setEditingDetails(JSON.parse(JSON.stringify(analysis.details || [])));
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer shrink-0"
            >
              <Edit className="h-3.5 w-3.5" /> Verifikasi & Edit Pekan
            </button>
          )}
        </div>
      )}

      {/* Grade Selector Tabs */}
      {analysis && gradeLevels.length > 1 && (
        <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-2">
          {gradeLevels.map(grade => (
            <button
              key={grade}
              onClick={() => setSelectedGrade(grade)}
              className={`pb-2.5 px-4 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                selectedGrade === grade
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
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
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs">
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

          <div className="bg-emerald-50/30 dark:bg-emerald-950/5 border border-emerald-100 dark:border-emerald-900/40 p-5 rounded-2xl shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400 uppercase tracking-wider">Pekan Efektif Belajar ({selectedGrade})</p>
                <h3 className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
                  {isEditing 
                    ? editingDetails.reduce((sum, item) => sum + (item.effectiveWeeksByGrade?.[selectedGrade] ?? item.effectiveWeeks), 0)
                    : computedEffectiveWeeks} Pekan
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/45 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-3 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Sabtu s/d Kamis aktif, Minimal 3 hari KBM</span>
            </div>
          </div>

          <div className="bg-rose-50/30 dark:bg-rose-950/5 border border-rose-100 dark:border-rose-900/40 p-5 rounded-2xl shadow-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-rose-600/80 dark:text-rose-400 uppercase tracking-wider">Pekan Tidak Efektif ({selectedGrade})</p>
                <h3 className="text-3xl font-extrabold text-rose-700 dark:text-rose-300 mt-1">
                  {isEditing
                    ? Math.max(0, analysis.totalWeeks - editingDetails.reduce((sum, item) => sum + (item.effectiveWeeksByGrade?.[selectedGrade] ?? item.effectiveWeeks), 0))
                    : computedIneffectiveWeeks} Pekan
                </h3>
              </div>
              <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-950/45 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
            <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-3 flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              <span>Pekan libur, ujian pondok, MPLS, atau agenda khusus</span>
            </div>
          </div>
        </div>
      )}

      {/* Action panel */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-wrap sm:flex-nowrap justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <Info className="h-4 w-4 text-blue-500" />
          <span>Hari aktif Pesantren: <strong className="text-slate-800 dark:text-zinc-300 font-semibold">Sabtu - Kamis</strong> (Jumat selalu libur).</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing && (
            <>
              <button
                onClick={() => runAnalysis()}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Muat Ulang
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Unduh Excel
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5" /> Cetak RPE
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN VIEW: MASTER PEKAN EFEKTIF VERIFICATION & LIST */}
      {loading ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-16 text-center text-slate-500">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
          <p className="text-sm font-semibold">Mengambil Data Pekan...</p>
        </div>
      ) : !analysis ? (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-16 text-center text-slate-400">
          <Calendar className="h-10 w-10 mx-auto opacity-35 mb-2" />
          <p className="text-sm font-medium">Data pekan tidak ditemukan</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Monthly Summary Table */}
          {!isEditing && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10">
                <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                  Ringkasan Pekan per Bulan (Rencana Pekan Efektif)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-850/50 border-b border-slate-200 dark:border-zinc-800">
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider w-16">No</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Bulan & Tahun</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center w-36">Jumlah Pekan</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center w-36">Pekan Efektif</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-center w-36">Pekan Tidak Efektif</th>
                      <th className="p-4 text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Keterangan Kegiatan / Agenda Libur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {analysis.details.map((row, idx) => {
                      const effWeeks = row.effectiveWeeksByGrade?.[selectedGrade] ?? row.effectiveWeeks;
                      const ineffWeeks = Math.max(0, row.totalWeeks - effWeeks);
                      return (
                        <tr key={row.month} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30 transition-colors">
                          <td className="p-4 text-sm font-medium text-slate-400">{idx + 1}</td>
                          <td className="p-4 text-sm font-bold text-slate-800 dark:text-zinc-200">{row.month}</td>
                          <td className="p-4 text-sm font-bold text-slate-800 dark:text-zinc-200 text-center bg-slate-50/40 dark:bg-zinc-950/20">{row.totalWeeks}</td>
                          <td className="p-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-center">{effWeeks}</td>
                          <td className="p-4 text-sm font-bold text-rose-500 text-center">{ineffWeeks}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400">
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
                    <tr className="bg-slate-50/75 dark:bg-zinc-800/40 font-extrabold border-t border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-100">
                      <td className="p-4 text-sm text-center" colSpan={2}>TOTAL SEMESTER</td>
                      <td className="p-4 text-sm text-center bg-slate-50/60 dark:bg-zinc-950/35">{analysis.totalWeeks}</td>
                      <td className="p-4 text-sm text-center text-emerald-600 dark:text-emerald-400">{computedEffectiveWeeks}</td>
                      <td className="p-4 text-sm text-center text-rose-500">{computedIneffectiveWeeks}</td>
                      <td className="p-4 text-xs text-slate-400 font-semibold italic">Perhitungan Tersertifikasi Master Pekan</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* MASTER DETAIL TABLE PER MONTH (REAL-TIME EDITABLE / VIEWABLE) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-zinc-200">
                {isEditing ? "Verifikasi & Edit Rincian Master Pekan" : "Rincian Pekan per Bulan"}
              </h2>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToCalendar}
                    className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Rekomendasi Kalender
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6">
              {(isEditing ? editingDetails : analysis.details).map((monthRow, mIdx) => (
                <div 
                  key={monthRow.month} 
                  className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs"
                >
                  {/* Month header */}
                  <div className="px-5 py-3.5 border-b border-slate-150 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/10 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200">
                        Bulan {monthRow.month}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Total {monthRow.totalWeeks} pekan &bull; {monthRow.effectiveWeeks} Pekan Efektif
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing && (
                        <button
                          type="button"
                          onClick={() => handleAddWeekToMonth(mIdx)}
                          className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" /> Tambah Pekan
                        </button>
                      )}
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                        Evaluasi Bulan
                      </span>
                    </div>
                  </div>

                  {/* Weeks Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 dark:bg-zinc-850/20 border-b border-slate-200 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
                          <th className="p-3 font-semibold w-24 text-center">Pekan</th>
                          <th className="p-3 font-semibold w-48">Rentang Tanggal</th>
                          <th className="p-3 font-semibold w-40 text-center">Status</th>
                          <th className="p-3 font-semibold">Alasan / Keterangan Agenda (Wajib jika Tidak Efektif)</th>
                          {isEditing && <th className="p-3 font-semibold w-20 text-center">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                        {(() => {
                          const weeks = Array.isArray(monthRow.weeks) ? monthRow.weeks : [];
                          if (weeks.length === 0 && monthRow.totalWeeks > 0) {
                            monthRow.weeks = Array.from({ length: monthRow.totalWeeks }, (_, idx) => ({
                              weekNum: idx + 1,
                              isEffective: idx < (monthRow.effectiveWeeks || 0),
                              notes: idx < (monthRow.effectiveWeeks || 0) ? "" : (monthRow.notes || "Minggu Tidak Efektif"),
                              dates: []
                            }));
                          }
                          return (monthRow.weeks || []).map((w: any, wIdx: number) => {
                            const isEff = w.isEffective;
                            return (
                              <tr 
                                key={w.weekNum} 
                                className={`transition-colors ${
                                  !isEff 
                                    ? "bg-rose-50/10 hover:bg-rose-50/20" 
                                    : "hover:bg-slate-50/30 dark:hover:bg-zinc-900/30"
                                }`}
                              >
                              {/* Pekan Number */}
                              <td className="p-3 text-sm font-extrabold text-center text-slate-700 dark:text-zinc-300">
                                Pekan {w.weekNum}
                              </td>

                              {/* Date Range */}
                              <td className="p-3 text-xs text-slate-500 font-medium">
                                {formatDateRange(w.dates)}
                              </td>

                              {/* Status Toggle / Badge */}
                              <td className="p-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-0.5 max-w-[150px] mx-auto">
                                    <button
                                      type="button"
                                      onClick={() => handleWeekStatusChange(mIdx, wIdx, true)}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                                        isEff
                                          ? "bg-emerald-600 text-white shadow-xs"
                                          : "text-slate-400 hover:text-slate-600"
                                      }`}
                                    >
                                      Efektif
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleWeekStatusChange(mIdx, wIdx, false)}
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold transition-all cursor-pointer ${
                                        !isEff
                                          ? "bg-rose-500 text-white shadow-xs"
                                          : "text-slate-400 hover:text-slate-600"
                                      }`}
                                    >
                                      Tidak
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-center">
                                    {isEff ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50">
                                        <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                        Efektif
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-200/50">
                                        <span className="h-1 w-1 rounded-full bg-rose-500 animate-pulse" />
                                        Tidak Efektif
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Alasan / Notes */}
                              <td className="p-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    placeholder={!isEff ? "Alasan tidak efektif belajar (e.g. MPLS, Libur Pesantren) - WAJIB" : "Keterangan agenda belajar (opsional)"}
                                    value={w.notes || ""}
                                    required={!isEff}
                                    onChange={(e) => handleWeekNotesChange(mIdx, wIdx, e.target.value)}
                                    className={`w-full px-3 py-1.5 border rounded-lg text-xs focus:outline-hidden focus:ring-1 ${
                                      !isEff && (!w.notes || w.notes.trim() === "")
                                        ? "border-rose-300 bg-rose-50/20 focus:ring-rose-400"
                                        : "border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 focus:ring-blue-500"
                                    } dark:text-zinc-100 font-medium`}
                                  />
                                ) : (
                                  <span className={`text-xs ${!isEff ? "text-slate-700 dark:text-zinc-300 font-bold" : "text-slate-400 font-medium"}`}>
                                    {w.notes || (isEff ? "Kegiatan Belajar Mengajar penuh" : "Tanpa Keterangan")}
                                  </span>
                                )}
                              </td>

                              {/* Aksi */}
                              {isEditing && (
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWeekFromMonth(mIdx, wIdx)}
                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
                                    title="Hapus Pekan"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        });
                      })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            {/* Editing bottom controls */}
            {isEditing && (
              <form onSubmit={handleSaveMasterPekan} className="bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-left">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                    Konfirmasi Validasi Master Pekan Efektif
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Pastikan seluruh alasan untuk pekan tidak efektif telah diisi dengan benar sebelum menyimpan data.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditingDetails(JSON.parse(JSON.stringify(analysis.details || [])));
                    }}
                    className="px-4 py-2 border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-bold rounded-xl text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-500/10 cursor-pointer"
                  >
                    <Save className="h-4 w-4" /> Simpan & Validasi Master Pekan
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EffectiveWeeks;
