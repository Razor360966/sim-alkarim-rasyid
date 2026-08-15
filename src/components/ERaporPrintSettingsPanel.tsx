import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useSchoolIdentity } from "../contexts/SchoolIdentityContext";
import { eRaporService, DEFAULT_RAPOR_SETTINGS } from "../services/eRapor.service";
import { semesterService } from "../services/semester.service";
import { ERaporSettingsConfig, ERaporReportHeaderConfig } from "../types/eRapor.types";
import { Semester } from "../types";
import { ERaporPrintable } from "./ERaporPrintable";
import {
  Printer,
  FileText,
  Save,
  Eye,
  Upload,
  Trash2,
  CheckCircle2,
  Building,
  School,
  User,
  Image as ImageIcon,
  Calendar,
  X,
  FileCode,
  ShieldAlert
} from "lucide-react";

export const ERaporPrintSettingsPanel: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { identity, updateIdentity } = useSchoolIdentity();

  const [config, setConfig] = useState<ERaporSettingsConfig>(DEFAULT_RAPOR_SETTINGS);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewTab, setPreviewTab] = useState<"UMUM" | "PONDOK">("UMUM");

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [fetchedConfig, fetchedSemesters] = await Promise.all([
          eRaporService.getSettings(),
          semesterService.getSemesters()
        ]);

        setConfig(fetchedConfig);
        setSemesters(fetchedSemesters);

        const activeSem = fetchedSemesters.find((s) => s.isActive) || fetchedSemesters[0];
        if (activeSem) {
          setSelectedSemesterId(activeSem.id);
        }
      } catch (err) {
        console.error("Error loading print settings data:", err);
        toast("Gagal memuat pengaturan cetak e-Rapor.", "error");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await eRaporService.saveSettings(config, user?.name || "Admin");

      // Also sync school identity SSOT
      if (config.headmasterName) {
        await updateIdentity({
          principalName: config.headmasterName,
          headmasterName: config.headmasterName,
          principalSignatureUrl: config.headmasterSignatureUrl,
          headmasterSignatureUrl: config.headmasterSignatureUrl
        }).catch((e) => console.warn("Failed syncing identity context:", e));
      }

      toast("Pengaturan Cetak e-Rapor berhasil disimpan!", "success");
    } catch (err) {
      console.error("Error saving print settings:", err);
      toast("Gagal menyimpan pengaturan cetak.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(png|jpeg|jpg)/i)) {
      toast("Format file harus PNG, JPG, atau JPEG.", "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast("Ukuran file maksimal 2MB.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setConfig((prev) => ({
        ...prev,
        headmasterSignatureUrl: dataUrl
      }));
      toast("Tanda tangan berhasil diunggah!", "success");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setConfig((prev) => ({
      ...prev,
      headmasterSignatureUrl: ""
    }));
    toast("Tanda tangan telah dihapus.", "info");
  };

  const activeSemesterObj = semesters.find((s) => s.id === selectedSemesterId);

  // Sample Mock Student for Live Print Preview
  const mockStudent = {
    id: "sample-student-1",
    name: "Ahmad Fauzi Al-Farisi",
    nis: "232407001",
    nisn: "0081234567",
    gender: "Laki-laki" as const,
    birthPlace: "Solok",
    birthDate: "2010-05-14",
    address: "Jl. Merdeka No. 12, Solok",
    classId: "VII-A"
  };

  const mockUmumSubjects = [
    { subjectName: "Pendidikan Agama Islam", group: "A", finalScore: 88, tpAverage: 86, utsScore: 90, sasScore: 88, description: "Sangat baik dalam memahami tajwid dan hafalan juz 30." },
    { subjectName: "Pendidikan Pancasila", group: "A", finalScore: 82, tpAverage: 80, utsScore: 85, sasScore: 81, description: "Baik dalam mengimplementasikan nilai-nilai Pancasila dalam keseharian." },
    { subjectName: "Bahasa Indonesia", group: "A", finalScore: 85, tpAverage: 84, utsScore: 86, sasScore: 85, description: "Sangat terampil dalam menyusun teks Laporan Hasil Observasi." },
    { subjectName: "Matematika", group: "A", finalScore: 78, tpAverage: 76, utsScore: 80, sasScore: 78, description: "Cukup baik dalam menyelesaikan soal aljabar dan himpunan." },
    { subjectName: "Bahasa Inggris", group: "B", finalScore: 86, tpAverage: 85, utsScore: 88, sasScore: 85, description: "Sangat percaya diri dalam percakapan sehari-hari." },
    { subjectName: "Seni Budaya", group: "B", finalScore: 90, tpAverage: 90, utsScore: 90, sasScore: 90, description: "Sangat kreatif dalam seni rupa dan kaligrafi Islam." }
  ];

  const mockPondokSubjects = [
    { subjectName: "Nahwu Sharaf", score: 88, ketercapaian: "Telah menguasai kaidah dasar isim, fi'il, dan i'rab bab awal." },
    { subjectName: "Tahfidzul Qur'an", score: 92, ketercapaian: "Telah menyelesaikan setoran Juz 29 dan mutqin Juz 30." },
    { subjectName: "Aqidatul Awam", score: 85, ketercapaian: "Memahami 50 sifat wajib, mustahil, dan jaiz bagi Allah dan Rasul." },
    { subjectName: "Fiqih Ibadah", score: 89, ketercapaian: "Sangat tertib dan paham tata cara thaharah, shalat fardhu dan sunnah." }
  ];

  const mockExtracurriculars = [
    { name: "Pramuka", extracurricularName: "Pramuka", participationStatus: "Aktif" as const, progress: "Aktif dalam perkemahan dan kecakapan keanggotaan." },
    { name: "Panahan", extracurricularName: "Panahan", participationStatus: "Aktif" as const, progress: "Menunjukkan teknik memanah fokus jarak 15m dengan baik." }
  ];

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 border border-slate-200 dark:border-zinc-800 text-center text-slate-500">
        Memuat Pengaturan Cetak e-Rapor...
      </div>
    );
  }

  const genPaper = config.generalReport || { paperSize: "A4", orientation: "portrait" };
  const pesPaper = config.pesantrenReport || { paperSize: "F4", orientation: "portrait" };
  const genHeader = config.generalReportHeader || DEFAULT_RAPOR_SETTINGS.generalReportHeader!;
  const pesHeader = config.pesantrenReportHeader || DEFAULT_RAPOR_SETTINGS.pesantrenReportHeader!;

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
              Pengaturan Cetak e-Rapor
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Konfigurasi kertas (A4/F4), orientasi, kop lembaga, dan tanda tangan Kepala Sekolah secara terpisah.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-indigo-500" />
            Preview Cetak
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Menyimpan..." : "Simpan Pengaturan"}
          </button>
        </div>
      </div>

      {/* Summary Box (Requirement 9) */}
      <div className="bg-indigo-950/90 text-indigo-100 dark:bg-zinc-900/90 rounded-2xl p-5 border border-indigo-900 dark:border-zinc-800 shadow-md font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-indigo-800/80 dark:border-zinc-800 pb-2">
          <span className="font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <FileCode className="w-4 h-4" /> PENGATURAN RAPOR (PREVIEW STATUS)
          </span>
          {activeSemesterObj && (
            <span className="text-[11px] bg-indigo-900 px-2.5 py-0.5 rounded-full text-indigo-200">
              Semester: {activeSemesterObj.name} {activeSemesterObj.isActive ? "(Aktif)" : ""}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-indigo-900/40 dark:bg-zinc-800/50 p-3 rounded-xl border border-indigo-800/50 dark:border-zinc-700 space-y-1">
            <h4 className="font-bold text-emerald-400 text-xs">RAPOR UMUM</h4>
            <p>Ukuran     : <span className="font-bold text-white">{genPaper.paperSize}</span></p>
            <p>Orientasi  : <span className="font-bold text-white uppercase">{genPaper.orientation}</span></p>
            <p>Kop        : <span className="text-white">{genHeader.institutionName || "Kop Sekolah"}</span></p>
            <p>TTD Kepsek : <span className="text-emerald-300">{config.headmasterSignatureUrl ? "✓ Ada" : "– Belum diunggah"}</span></p>
          </div>

          <div className="bg-indigo-900/40 dark:bg-zinc-800/50 p-3 rounded-xl border border-indigo-800/50 dark:border-zinc-700 space-y-1">
            <h4 className="font-bold text-amber-400 text-xs">RAPOR KEPESANTRENAN</h4>
            <p>Ukuran     : <span className="font-bold text-white">{pesPaper.paperSize}</span></p>
            <p>Orientasi  : <span className="font-bold text-white uppercase">{pesPaper.orientation}</span></p>
            <p>Kop        : <span className="text-white">{pesHeader.institutionName || "Kop Kepesantrenan"}</span></p>
            <p>TTD Kepsek : <span className="text-emerald-300">{config.headmasterSignatureUrl ? "✓ Ada" : "– Belum diunggah"}</span></p>
          </div>
        </div>
      </div>

      {/* Main Forms Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SECTION 1: RAPOR UMUM */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <School className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                1. Pengaturan Rapor Umum
              </h3>
              <p className="text-[11px] text-slate-500">
                Konfigurasi cetak khusus untuk mata pelajaran kurikulum umum.
              </p>
            </div>
          </div>

          {/* Paper Size & Orientation */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Ukuran Kertas & Orientasi
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1 font-semibold">Ukuran Kertas</span>
                <div className="flex gap-2">
                  {(["A4", "F4"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          generalReport: {
                            ...(prev.generalReport || { paperSize: "A4", orientation: "portrait" }),
                            paperSize: size
                          }
                        }))
                      }
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        genPaper.paperSize === size
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1 font-semibold">Orientasi</span>
                <div className="flex gap-2">
                  {(["portrait", "landscape"] as const).map((ori) => (
                    <button
                      key={ori}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          generalReport: {
                            ...(prev.generalReport || { paperSize: "A4", orientation: "portrait" }),
                            orientation: ori
                          }
                        }))
                      }
                      className={`flex-1 py-2 text-xs font-bold capitalize rounded-xl border transition-all ${
                        genPaper.orientation === ori
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                      }`}
                    >
                      {ori}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Kop Rapor Umum */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Konfigurasi Kop Rapor Umum
            </label>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                  Nama Lembaga / Sekolah
                </label>
                <input
                  type="text"
                  value={genHeader.institutionName || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      generalReportHeader: {
                        ...(prev.generalReportHeader || {}),
                        institutionName: e.target.value
                      }
                    }))
                  }
                  className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  placeholder="e.g. SMP ALKARIM RASYID"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                  Sub-Judul Kop / Informasi Tambahan
                </label>
                <input
                  type="text"
                  value={genHeader.subTitle || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      generalReportHeader: {
                        ...(prev.generalReportHeader || {}),
                        subTitle: e.target.value
                      }
                    }))
                  }
                  className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  placeholder="e.g. Sekolah Menengah Pertama Alkarim Rasyid"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                  Alamat Lengkap KOP
                </label>
                <input
                  type="text"
                  value={genHeader.address || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      generalReportHeader: {
                        ...(prev.generalReportHeader || {}),
                        address: e.target.value
                      }
                    }))
                  }
                  className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Telepon
                  </label>
                  <input
                    type="text"
                    value={genHeader.phone || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        generalReportHeader: {
                          ...(prev.generalReportHeader || {}),
                          phone: e.target.value
                        }
                      }))
                    }
                    className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Email / Website
                  </label>
                  <input
                    type="text"
                    value={genHeader.email || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        generalReportHeader: {
                          ...(prev.generalReportHeader || {}),
                          email: e.target.value
                        }
                      }))
                    }
                    className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: RAPOR MAPEL KEPESANTRENAN */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <Building className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                2. Pengaturan Rapor Kepesantrenan
              </h3>
              <p className="text-[11px] text-slate-500">
                Konfigurasi cetak independen untuk mata pelajaran kepesantrenan / diniyah.
              </p>
            </div>
          </div>

          {/* Paper Size & Orientation */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Ukuran Kertas & Orientasi (Independen)
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1 font-semibold">Ukuran Kertas</span>
                <div className="flex gap-2">
                  {(["A4", "F4"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          pesantrenReport: {
                            ...(prev.pesantrenReport || { paperSize: "F4", orientation: "portrait" }),
                            paperSize: size
                          }
                        }))
                      }
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                        pesPaper.paperSize === size
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block mb-1 font-semibold">Orientasi</span>
                <div className="flex gap-2">
                  {(["portrait", "landscape"] as const).map((ori) => (
                    <button
                      key={ori}
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          pesantrenReport: {
                            ...(prev.pesantrenReport || { paperSize: "F4", orientation: "portrait" }),
                            orientation: ori
                          }
                        }))
                      }
                      className={`flex-1 py-2 text-xs font-bold capitalize rounded-xl border transition-all ${
                        pesPaper.orientation === ori
                          ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100"
                      }`}
                    >
                      {ori}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Kop Rapor Kepesantrenan */}
          <div className="space-y-3 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Konfigurasi Kop Kepesantrenan (Terpisah dari Rapor Umum)
            </label>

            <div className="space-y-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                  Nama Lembaga / Pondok Pesantren
                </label>
                <input
                  type="text"
                  value={pesHeader.institutionName || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      pesantrenReportHeader: {
                        ...(prev.pesantrenReportHeader || {}),
                        institutionName: e.target.value
                      }
                    }))
                  }
                  className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  placeholder="e.g. PONDOK PESANTREN ALKARIM RASYID"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                  Sub-Judul Kop Kepesantrenan
                </label>
                <input
                  type="text"
                  value={pesHeader.subTitle || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      pesantrenReportHeader: {
                        ...(prev.pesantrenReportHeader || {}),
                        subTitle: e.target.value
                      }
                    }))
                  }
                  className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  placeholder="e.g. Madrasah Diniyah & Pengasuhan Kepesantrenan"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                  Alamat Lembaga Kepesantrenan
                </label>
                <input
                  type="text"
                  value={pesHeader.address || ""}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      pesantrenReportHeader: {
                        ...(prev.pesantrenReportHeader || {}),
                        address: e.target.value
                      }
                    }))
                  }
                  className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Telepon
                  </label>
                  <input
                    type="text"
                    value={pesHeader.phone || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pesantrenReportHeader: {
                          ...(prev.pesantrenReportHeader || {}),
                          phone: e.target.value
                        }
                      }))
                    }
                    className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400">
                    Email / Contact
                  </label>
                  <input
                    type="text"
                    value={pesHeader.email || ""}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        pesantrenReportHeader: {
                          ...(prev.pesantrenReportHeader || {}),
                          email: e.target.value
                        }
                      }))
                    }
                    className="w-full mt-1 p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-medium"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3 & 4: IDENTITAS KEPALA SEKOLAH, TTD & MASTER SEMESTER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Headmaster Identity & Signature Upload */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <User className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                3. Identitas & Tanda Tangan Kepala Sekolah (SSOT)
              </h3>
              <p className="text-[11px] text-slate-500">
                Data ini otomatis digunakan pada lembar pengesahan Rapor Umum & Rapor Kepesantrenan.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Nama Lengkap & Gelar Kepala Sekolah
            </label>
            <input
              type="text"
              value={config.headmasterName || ""}
              onChange={(e) => setConfig({ ...config, headmasterName: e.target.value })}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100"
              placeholder="e.g. H. Abdullah, M.Pd."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              File Tanda Tangan Digital Kepala Sekolah
            </label>

            {config.headmasterSignatureUrl ? (
              <div className="p-4 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-16 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-1 flex items-center justify-center overflow-hidden shadow-inner">
                    <img
                      src={config.headmasterSignatureUrl}
                      alt="Tanda Tangan Kepala Sekolah"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">
                      ✓ Tanda Tangan Tersedia
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Background transparan (PNG direkomendasikan)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 cursor-pointer transition-all">
                    Ganti
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleSignatureUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveSignature}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                    title="Hapus Tanda Tangan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-400 bg-slate-50 dark:bg-zinc-800/50 hover:bg-indigo-50/30 rounded-xl p-6 text-center block cursor-pointer transition-all">
                <Upload className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200 block">
                  Unggah Tanda Tangan Digital (PNG/JPG)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Gunakan gambar bertipe PNG transparan untuk hasil cetak maksimal.
                </span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* Master Semester Active Selection */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                4. Master Semester e-Rapor
              </h3>
              <p className="text-[11px] text-slate-500">
                Semester diambil secara dinamis dari master data <code className="font-mono text-indigo-600">semesters</code>.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Semester Aktif / Default Cetak
            </label>

            {semesters.length > 0 ? (
              <select
                value={selectedSemesterId}
                onChange={(e) => setSelectedSemesterId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-zinc-100"
              >
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.name} {sem.isActive ? "— (Semester Aktif Sistem)" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800">
                Belum ada data semester di master data <code className="font-mono">semesters</code>.
              </div>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-zinc-300 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-slate-800 dark:text-zinc-100">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Catatan Integrasi Master Data:
            </p>
            <p className="text-[11px] leading-relaxed">
              Mata pelajaran Rapor Umum dan Rapor Kepesantrenan diambil langsung dari master data <code className="font-mono">subjects</code> berdasarkan pengelompokan group mapel.
            </p>
          </div>
        </div>
      </div>

      {/* PREVIEW CETAK MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full p-6 border border-slate-200 dark:border-zinc-800 shadow-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-zinc-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-indigo-600" />
                  Preview Konfigurasi Cetak e-Rapor
                </h3>
                <p className="text-xs text-slate-500">
                  Uji coba tampilan Kop, Kertas ({previewTab === "UMUM" ? genPaper.paperSize : pesPaper.paperSize}), dan Tanda Tangan.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewTab("UMUM")}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                      previewTab === "UMUM"
                        ? "bg-emerald-600 text-white shadow"
                        : "text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    Rapor Umum ({genPaper.paperSize})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab("PONDOK")}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                      previewTab === "PONDOK"
                        ? "bg-amber-600 text-white shadow"
                        : "text-slate-600 dark:text-zinc-400"
                    }`}
                  >
                    Rapor Kepesantrenan ({pesPaper.paperSize})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
              <ERaporPrintable
                student={mockStudent}
                className="VII-A"
                homeroomTeacherName="Ustadz Ahmad Rasyid, S.Pd."
                identity={identity}
                academicYear="2024/2025"
                semester={activeSemesterObj?.name || "Semester Ganjil"}
                umumSubjects={mockUmumSubjects}
                pondokSubjects={mockPondokSubjects}
                extracurriculars={mockExtracurriculars as any}
                verification={{
                  academicYearId: "ay-1",
                  semesterId: "sem-1",
                  classId: "VII-A",
                  className: "VII-A",
                  homeroomTeacherId: "hr-1",
                  homeroomTeacherName: "Ustadz Ahmad Rasyid, S.Pd.",
                  status: "TERVERIFIKASI"
                }}
                printConfig={config}
                forcedReportType={previewTab}
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Mode Preview: <strong className="text-slate-800 dark:text-zinc-200">{previewTab === "UMUM" ? "Rapor Umum" : "Rapor Kepesantrenan"}</strong> ({previewTab === "UMUM" ? genPaper.paperSize : pesPaper.paperSize} - {previewTab === "UMUM" ? genPaper.orientation : pesPaper.orientation})
              </span>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl"
              >
                Tutup Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
