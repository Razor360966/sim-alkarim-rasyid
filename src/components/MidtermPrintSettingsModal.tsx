import React, { useState, useEffect } from "react";
import { MidtermPrintSettings, MidtermReportHeaderConfig } from "../types/midtermReport.types";
import { Class } from "../types";
import { AppConfig } from "../config/appConfig";
import { ERaporSettingsConfig } from "../types/eRapor.types";
import { midtermPrintSettingsService } from "../services/midtermPrintSettings.service";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import {
  Printer,
  X,
  Upload,
  Trash2,
  CheckCircle2,
  School,
  User,
  Shield,
  Save,
  Eye,
  AlertCircle,
  FileCheck,
  Building,
  Users,
  Calendar,
  MapPin,
  Award,
  Image as ImageIcon
} from "lucide-react";

export interface MidtermPrintSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSettings?: MidtermPrintSettings;
  classes: Class[];
  currentClassId?: string;
  identity?: AppConfig;
  printConfig?: ERaporSettingsConfig;
  onSettingsSaved: (newSettings: MidtermPrintSettings) => void;
}

/**
 * Kompresi dan resize gambar menggunakan HTMLCanvasElement
 * Menghasilkan DataURL teroptimasi (< 50 KB) untuk menjaga batas 1 MiB dokumen Firestore.
 */
function compressImageToBase64(
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 240,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Pertahankan PNG jika transparan, atau JPEG untuk foto padat
        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(mimeType, quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => reject(new Error("Gagal membaca gambar"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas"));
    reader.readAsDataURL(file);
  });
}

export const MidtermPrintSettingsModal: React.FC<MidtermPrintSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSettings,
  classes,
  currentClassId,
  identity,
  printConfig,
  onSettingsSaved
}) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"SIGNATURES" | "STAMP" | "HOMEROOM" | "KOP">("SIGNATURES");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Form State: Tempat & Tanggal Rapor
  const [reportCity, setReportCity] = useState<string>("Solok");
  const [reportDate, setReportDate] = useState<string>("");

  // Form State: Kepala Sekolah
  const [headmasterName, setHeadmasterName] = useState<string>("");
  const [headmasterTitle, setHeadmasterTitle] = useState<string>("Kepala Sekolah / Kepala Madrasah");
  const [headmasterNipNiy, setHeadmasterNipNiy] = useState<string>("");
  const [headmasterSignatureUrl, setHeadmasterSignatureUrl] = useState<string>("");
  const [schoolStampUrl, setSchoolStampUrl] = useState<string>("");

  // Form State: Logo & Akreditasi KOP
  const [schoolLogoUrl, setSchoolLogoUrl] = useState<string>("");
  const [pesantrenLogoUrl, setPesantrenLogoUrl] = useState<string>("");
  const [accreditationText, setAccreditationText] = useState<string>("");

  // Homeroom signatures map
  const [homeroomSignatures, setHomeroomSignatures] = useState<Record<string, string>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>(currentClassId || classes[0]?.id || "");

  // Custom KOP text
  const [customHeader, setCustomHeader] = useState<MidtermReportHeaderConfig>({});

  // Sync state with currentSettings or defaults when opened
  useEffect(() => {
    if (isOpen) {
      // 1. Tempat & Tanggal
      const city =
        currentSettings?.reportCity ||
        identity?.regency ||
        identity?.district ||
        "Solok";

      const defaultDateStr =
        currentSettings?.reportDate ||
        new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });

      setReportCity(city);
      setReportDate(currentSettings?.reportDate || defaultDateStr);

      // 2. Kepala Sekolah
      const hName =
        currentSettings?.headmasterName ||
        printConfig?.headmasterName ||
        identity?.principalName ||
        identity?.headmasterName ||
        "H. Abdullah, M.Pd.";

      const hTitle =
        currentSettings?.headmasterTitle ||
        "Kepala Sekolah / Kepala Madrasah";

      const hNip =
        currentSettings?.headmasterNipNiy ||
        identity?.principalNipNiy ||
        "NIY. 202001001";

      const hSig =
        currentSettings?.headmasterSignatureUrl ||
        printConfig?.headmasterSignatureUrl ||
        identity?.principalSignatureUrl ||
        identity?.headmasterSignatureUrl ||
        "";

      const stamp = currentSettings?.schoolStampUrl || "";
      const hSigs = currentSettings?.homeroomSignatures || {};

      setHeadmasterName(hName);
      setHeadmasterTitle(hTitle);
      setHeadmasterNipNiy(hNip);
      setHeadmasterSignatureUrl(hSig);
      setSchoolStampUrl(stamp);
      setHomeroomSignatures({ ...hSigs });

      // 3. Logo Sekolah, Logo Pondok, & Akreditasi
      const sLogo =
        currentSettings?.schoolLogoUrl !== undefined
          ? currentSettings.schoolLogoUrl
          : (identity?.logoUrl || "");

      const pLogo = currentSettings?.pesantrenLogoUrl || "";
      const accred =
        currentSettings?.accreditationText ||
        currentSettings?.customHeader?.accreditationText ||
        "";

      setSchoolLogoUrl(sLogo);
      setPesantrenLogoUrl(pLogo);
      setAccreditationText(accred);

      // 4. Class Selector
      if (currentClassId && classes.some((c) => c.id === currentClassId)) {
        setSelectedClassId(currentClassId);
      } else if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }

      // 5. Header info
      setCustomHeader(
        currentSettings?.customHeader || {
          institutionName: identity?.schoolName || "SMP ALKARIM RASYID",
          subTitle: "Sekolah Menengah Pertama Berbasis Pesantren",
          address: identity?.address || "Jl. Pendidikan No. 1, Kota Solok, Sumatera Barat",
          phone: identity?.phone || "(021) 1234567",
          email: identity?.email || "info@alkarimrasyid.sch.id",
          website: identity?.website || "www.alkarimrasyid.sch.id"
        }
      );
    }
  }, [isOpen, currentSettings, printConfig, identity, currentClassId, classes]);

  if (!isOpen) return null;

  // Selected Class details
  const selectedClassObj = classes.find((c) => c.id === selectedClassId);
  const selectedClassHomeroomSig =
    (selectedClassId && homeroomSignatures[selectedClassId]) ||
    (selectedClassObj?.homeroomTeacherId && homeroomSignatures[selectedClassObj.homeroomTeacherId]) ||
    "";

  // Generic File Upload Validator & Compressor
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onSuccess: (dataUrl: string) => void,
    label: string,
    maxWidth = 400,
    maxHeight = 240
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(png|jpeg|jpg)/i)) {
      toast("Format file harus PNG, JPG, atau JPEG.", "error");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast("Ukuran file sebelum kompresi maksimal 2MB.", "error");
      return;
    }

    try {
      const compressedDataUrl = await compressImageToBase64(file, maxWidth, maxHeight);
      onSuccess(compressedDataUrl);
      toast(`${label} berhasil diproses dan disimpan!`, "success");
    } catch (err) {
      console.error(`Error processing image ${label}:`, err);
      toast(`Gagal memproses file ${label}.`, "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const payload: MidtermPrintSettings = {
        reportCity: reportCity.trim(),
        reportDate: reportDate.trim(),
        schoolLogoUrl: schoolLogoUrl,
        pesantrenLogoUrl: pesantrenLogoUrl,
        accreditationText: accreditationText.trim(),
        headmasterName: headmasterName.trim(),
        headmasterTitle: headmasterTitle.trim(),
        headmasterNipNiy: headmasterNipNiy.trim(),
        headmasterSignatureUrl: headmasterSignatureUrl,
        schoolStampUrl: schoolStampUrl,
        homeroomSignatures: homeroomSignatures,
        customHeader: {
          ...customHeader,
          accreditationText: accreditationText.trim(),
          schoolLogoUrl: schoolLogoUrl,
          pesantrenLogoUrl: pesantrenLogoUrl
        }
      };

      // Validasi batas dokumen Firestore 1 MiB (1,048,576 bytes) dengan batas aman konservatif 800 KB
      const payloadString = JSON.stringify(payload);
      const estimatedBytes = new Blob([payloadString]).size;
      if (estimatedBytes > 800 * 1024) {
        toast("Total ukuran berkas gambar melebihi batas aman Firestore (maks 800 KB). Harap hapus atau perkecil beberapa gambar.", "error");
        setIsSaving(false);
        return;
      }

      const saved = await midtermPrintSettingsService.savePrintSettings(
        payload,
        user?.name || "Admin"
      );

      onSettingsSaved(saved);
      toast("Pengaturan Cetak Rapor Tengah Semester berhasil disimpan!", "success");
      onClose();
    } catch (err) {
      console.error("Error saving midterm print settings:", err);
      toast("Gagal menyimpan pengaturan cetak RTS.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                Pengaturan Cetak Rapor Tengah Semester (RTS)
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Atur Tempat & Tanggal Rapor, KOP (Logo & Akreditasi), TTD Kepala Sekolah, Cap, dan Wali Kelas.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-6 pt-2 flex items-center gap-2 overflow-x-auto bg-slate-50/50 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setActiveTab("SIGNATURES")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "SIGNATURES"
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
            }`}
          >
            <User className="w-4 h-4" />
            <span>TTD Kepala Sekolah & Tanggal</span>
            {headmasterSignatureUrl ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("STAMP")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "STAMP"
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Cap / Stempel Sekolah</span>
            {schoolStampUrl ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("HOMEROOM")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "HOMEROOM"
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>TTD Wali Kelas</span>
            {Object.keys(homeroomSignatures).length > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px]">
                {Object.keys(homeroomSignatures).length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("KOP")}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "KOP"
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
            }`}
          >
            <School className="w-4 h-4" />
            <span>KOP, Logo & Akreditasi</span>
            {(schoolLogoUrl || pesantrenLogoUrl) && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: TANDA TANGAN KEPALA SEKOLAH & TANGGAL */}
          {activeTab === "SIGNATURES" && (
            <div className="space-y-5">
              {/* Bagian A: Kota/Kabupaten dan Tanggal Rapor */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wide">
                    Tempat dan Tanggal Pengesahan Rapor
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Tanggal ini dicetak pada bagian penandatangan Kepala Sekolah (contoh: <em>Solok, 18 Oktober 2026</em>). Tersimpan persisten dan tidak berubah otomatis setiap kali rapor dibuka.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Kota / Kabupaten Penandatanganan
                    </label>
                    <input
                      type="text"
                      value={reportCity}
                      onChange={(e) => setReportCity(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="e.g. Solok"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                      Tanggal Rapor
                    </label>
                    <input
                      type="text"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="e.g. 18 Oktober 2026"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian B: Identitas Kepala Sekolah */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Nama Penandatangan (Kepala Sekolah)
                  </label>
                  <input
                    type="text"
                    value={headmasterName}
                    onChange={(e) => setHeadmasterName(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. H. Abdullah, M.Pd."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    Jabatan Penandatangan
                  </label>
                  <input
                    type="text"
                    value={headmasterTitle}
                    onChange={(e) => setHeadmasterTitle(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. Kepala Sekolah / Kepala Madrasah"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                    NIP / NIY Kepala Sekolah
                  </label>
                  <input
                    type="text"
                    value={headmasterNipNiy}
                    onChange={(e) => setHeadmasterNipNiy(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-mono text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. NIY. 202001001"
                  />
                </div>
              </div>

              {/* Bagian C: Upload & Preview TTD Kepala Sekolah */}
              <div className="pt-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
                  Berkas Gambar Tanda Tangan Hasil Scan
                </label>

                {headmasterSignatureUrl ? (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-20 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-1.5 flex items-center justify-center shadow-inner overflow-hidden">
                        <img
                          src={headmasterSignatureUrl}
                          alt="Tanda Tangan Kepala Sekolah"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tanda Tangan Terunggah</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Format PNG transparan dianjurkan untuk hasil optimal.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-100 cursor-pointer transition-colors inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Ganti Gambar</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) =>
                            handleFileUpload(e, setHeadmasterSignatureUrl, "Tanda tangan Kepala Sekolah", 400, 200)
                          }
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setHeadmasterSignatureUrl("");
                          toast("Tanda tangan Kepala Sekolah dikosongkan.", "info");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-6 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Pilih Gambar Tanda Tangan Kepala Sekolah
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Format PNG atau JPEG (Maks. 2MB). Disarankan PNG transparan agar bersih saat dicetak.
                    </p>
                    <label className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Tanda Tangan</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) =>
                          handleFileUpload(e, setHeadmasterSignatureUrl, "Tanda tangan Kepala Sekolah", 400, 200)
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CAP SEKOLAH / STEMPEL RESMI */}
          {activeTab === "STAMP" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-zinc-300">
                  <p className="font-semibold text-slate-800 dark:text-zinc-100">
                    Posisi Cap / Stempel Sekolah Resmi
                  </p>
                  <p className="text-[11px] mt-0.5 text-slate-500 dark:text-zinc-400">
                    Cap sekolah diletakkan secara formal di sebelah kiri tanda tangan Kepala Sekolah (bertumpang tindih secara wajar tanpa menutupi nama). Cap bersifat opsional.
                  </p>
                </div>
              </div>

              {/* Upload & Preview Cap Sekolah */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
                  Berkas Gambar Cap Sekolah Hasil Scan
                </label>

                {schoolStampUrl ? (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-1.5 flex items-center justify-center shadow-inner overflow-hidden">
                        <img
                          src={schoolStampUrl}
                          alt="Cap Sekolah"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Cap Sekolah Terunggah</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Disarankan PNG transparan agar stempel terlihat menyatu dengan dokumen resmi.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-100 cursor-pointer transition-colors inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Ganti Cap</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) =>
                            handleFileUpload(e, setSchoolStampUrl, "Cap Sekolah", 260, 260)
                          }
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setSchoolStampUrl("");
                          toast("Cap Sekolah dihapus.", "info");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-6 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
                      <Shield className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Pilih Berkas Cap / Stempel Sekolah
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Format PNG atau JPEG (Maks. 2MB). Disarankan PNG dengan latar belakang transparan.
                    </p>
                    <label className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Cap Sekolah</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) =>
                          handleFileUpload(e, setSchoolStampUrl, "Cap Sekolah", 260, 260)
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TANDA TANGAN WALI KELAS */}
          {activeTab === "HOMEROOM" && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 flex items-start gap-2.5">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-zinc-300">
                  <p className="font-semibold text-slate-800 dark:text-zinc-100">
                    Tanda Tangan Wali Kelas Berdasarkan Kelas
                  </p>
                  <p className="text-[11px] mt-0.5 text-slate-500 dark:text-zinc-400">
                    Pilih kelas untuk mengunggah tanda tangan wali kelas. Tanda tangan disimpan terpisah untuk tiap kelas sehingga tidak tertukar. Jika kosong, ruang manual tetap disediakan rapi.
                  </p>
                </div>
              </div>

              {/* Pilih Kelas */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                  Pilih Rombongan Belajar (Kelas)
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {classes.map((cls) => {
                    const hasSig = Boolean(
                      homeroomSignatures[cls.id] ||
                        (cls.homeroomTeacherId && homeroomSignatures[cls.homeroomTeacherId])
                    );
                    return (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} — Wali Kelas: {cls.homeroomTeacherName || "-"} {hasSig ? "✓ (Ada TTD)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {selectedClassObj && (
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 dark:text-zinc-400">Nama Wali Kelas:</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-100 ml-1.5">
                      {selectedClassObj.homeroomTeacherName || "-"}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                    {selectedClassObj.name}
                  </span>
                </div>
              )}

              {/* Upload & Preview TTD Wali Kelas Terpilih */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
                  Berkas Gambar Tanda Tangan Wali Kelas ({selectedClassObj?.name || ""})
                </label>

                {selectedClassHomeroomSig ? (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-32 h-20 bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg p-1.5 flex items-center justify-center shadow-inner overflow-hidden">
                        <img
                          src={selectedClassHomeroomSig}
                          alt="Tanda Tangan Wali Kelas"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Tanda Tangan Tersedia</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Tanda tangan untuk {selectedClassObj?.name || "Kelas"} ({selectedClassObj?.homeroomTeacherName || "Wali Kelas"}).
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-100 cursor-pointer transition-colors inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Ganti Gambar</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) =>
                            handleFileUpload(
                              e,
                              (dataUrl) => {
                                setHomeroomSignatures((prev) => ({
                                  ...prev,
                                  [selectedClassId]: dataUrl,
                                  ...(selectedClassObj?.homeroomTeacherId
                                    ? { [selectedClassObj.homeroomTeacherId]: dataUrl }
                                    : {})
                                }));
                              },
                              `Tanda tangan Wali Kelas ${selectedClassObj?.name || ""}`,
                              400,
                              200
                            )
                          }
                          className="hidden"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setHomeroomSignatures((prev) => {
                            const updated = { ...prev };
                            delete updated[selectedClassId];
                            if (selectedClassObj?.homeroomTeacherId) {
                              delete updated[selectedClassObj.homeroomTeacherId];
                            }
                            return updated;
                          });
                          toast(`Tanda tangan Wali Kelas ${selectedClassObj?.name || ""} dihapus.`, "info");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-2xl p-6 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 flex items-center justify-center mx-auto mb-2">
                      <Upload className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Pilih Tanda Tangan Wali Kelas {selectedClassObj?.name || ""}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Format PNG/JPEG (Maks. 2MB). Disarankan PNG transparan.
                    </p>
                    <label className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm transition-all">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Unggah Tanda Tangan Wali Kelas</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/jpg"
                        onChange={(e) =>
                          handleFileUpload(
                            e,
                            (dataUrl) => {
                              setHomeroomSignatures((prev) => ({
                                ...prev,
                                [selectedClassId]: dataUrl,
                                ...(selectedClassObj?.homeroomTeacherId
                                  ? { [selectedClassObj.homeroomTeacherId]: dataUrl }
                                  : {})
                              }));
                            },
                            `Tanda tangan Wali Kelas ${selectedClassObj?.name || ""}`,
                            400,
                            200
                          )
                        }
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: KOP RAPOR, LOGO & AKREDITASI */}
          {activeTab === "KOP" && (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 flex items-start gap-2.5">
                <School className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-zinc-300">
                  <p className="font-semibold text-slate-800 dark:text-zinc-100">
                    Pengaturan Logo & KOP Rapor Tengah Semester
                  </p>
                  <p className="text-[11px] mt-0.5 text-slate-500 dark:text-zinc-400">
                    Kedua logo (sekolah dan pondok) bersifat opsional. KOP akan menata logo secara seimbang di sisi kiri dan kanan. Anda juga dapat menentukan keterangan akreditasi yang dicetak di bawah nama sekolah.
                  </p>
                </div>
              </div>

              {/* Upload Logo Sekolah & Logo Pondok (2 Kolom Sejajar) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Logo Sekolah (Kiri KOP) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-emerald-600" />
                      Logo Sekolah (Kiri KOP)
                    </span>
                    {schoolLogoUrl && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ada
                      </span>
                    )}
                  </div>

                  {schoolLogoUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-1.5 flex items-center justify-center overflow-hidden">
                        <img
                          src={schoolLogoUrl}
                          alt="Logo Sekolah"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-100 cursor-pointer inline-flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>Ganti Logo</span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={(e) =>
                              handleFileUpload(e, setSchoolLogoUrl, "Logo Sekolah", 240, 240)
                            }
                            className="hidden"
                          />
                        </label>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setSchoolLogoUrl("");
                              toast("Logo sekolah dihapus.", "info");
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-4 text-center">
                      <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-1" />
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Belum ada logo sekolah
                      </p>
                      <label className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs">
                        <Upload className="w-3 h-3" />
                        <span>Unggah Logo</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) =>
                            handleFileUpload(e, setSchoolLogoUrl, "Logo Sekolah", 240, 240)
                          }
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* 2. Logo Pondok / Pesantren (Kanan KOP) */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                      <School className="w-3.5 h-3.5 text-emerald-600" />
                      Logo Pondok Pesantren (Kanan KOP)
                    </span>
                    {pesantrenLogoUrl && (
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ada
                      </span>
                    )}
                  </div>

                  {pesantrenLogoUrl ? (
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-1.5 flex items-center justify-center overflow-hidden">
                        <img
                          src={pesantrenLogoUrl}
                          alt="Logo Pondok Pesantren"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-100 cursor-pointer inline-flex items-center gap-1">
                          <Upload className="w-3 h-3" />
                          <span>Ganti Logo</span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={(e) =>
                              handleFileUpload(e, setPesantrenLogoUrl, "Logo Pondok Pesantren", 240, 240)
                            }
                            className="hidden"
                          />
                        </label>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              setPesantrenLogoUrl("");
                              toast("Logo pondok pesantren dihapus.", "info");
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-4 text-center">
                      <ImageIcon className="w-7 h-7 text-slate-400 mx-auto mb-1" />
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        Belum ada logo pondok
                      </p>
                      <label className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-xs">
                        <Upload className="w-3 h-3" />
                        <span>Unggah Logo</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg"
                          onChange={(e) =>
                            handleFileUpload(e, setPesantrenLogoUrl, "Logo Pondok Pesantren", 240, 240)
                          }
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Keterangan Akreditasi */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/70 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <label className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                    Keterangan Akreditasi Sekolah (KOP)
                  </label>
                </div>
                <input
                  type="text"
                  value={accreditationText}
                  onChange={(e) => setAccreditationText(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  placeholder="e.g. Terakreditasi A (atau kosongkan jika tidak dicantumkan)"
                />
                <p className="text-[11px] text-slate-400">
                  Teks akreditasi ini opsional dan akan dicetak tepat di bawah sub-judul lembaga pada KOP surat rapor.
                </p>
              </div>

              {/* Teks Identitas Sekolah */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Nama Lembaga / Sekolah
                  </label>
                  <input
                    type="text"
                    value={customHeader.institutionName || ""}
                    onChange={(e) =>
                      setCustomHeader((prev) => ({ ...prev, institutionName: e.target.value }))
                    }
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. SMP ALKARIM RASYID"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Sub-Judul Lembaga
                  </label>
                  <input
                    type="text"
                    value={customHeader.subTitle || ""}
                    onChange={(e) =>
                      setCustomHeader((prev) => ({ ...prev, subTitle: e.target.value }))
                    }
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder="e.g. Sekolah Menengah Pertama Berbasis Pesantren"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Alamat Lengkap
                  </label>
                  <input
                    type="text"
                    value={customHeader.address || ""}
                    onChange={(e) =>
                      setCustomHeader((prev) => ({ ...prev, address: e.target.value }))
                    }
                    className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                      Nomor Telepon
                    </label>
                    <input
                      type="text"
                      value={customHeader.phone || ""}
                      onChange={(e) =>
                        setCustomHeader((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                      Email / Website
                    </label>
                    <input
                      type="text"
                      value={customHeader.email || ""}
                      onChange={(e) =>
                        setCustomHeader((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LIVE MINI PREVIEW OF KOP & SIGNATURE BLOCK */}
          <div className="pt-4 border-t border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
              <Eye className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pratinjau Langsung Tata Letak KOP & Pengesahan Rapor</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl space-y-4">
              <div className="bg-white text-black p-5 border border-slate-300 rounded-lg shadow-inner max-w-xl mx-auto font-sans text-xs space-y-4">
                {/* 1. Mini KOP Preview */}
                <div className="border-b-2 border-double border-black pb-2">
                  <div className="flex items-center justify-between gap-2">
                    {/* Logo Kiri */}
                    <div className="w-12 shrink-0 flex items-center justify-center">
                      {schoolLogoUrl ? (
                        <img
                          src={schoolLogoUrl}
                          alt="Logo Sekolah"
                          className="max-h-12 max-w-[48px] object-contain"
                        />
                      ) : pesantrenLogoUrl ? (
                        <div className="w-12" />
                      ) : null}
                    </div>

                    {/* Teks KOP */}
                    <div className="flex-1 text-center">
                      <p className="font-extrabold text-[12px] uppercase tracking-wide">
                        {customHeader.institutionName || identity?.schoolName || "SMP ALKARIM RASYID"}
                      </p>
                      <p className="text-[9px] font-bold uppercase text-slate-700">
                        {customHeader.subTitle || "Sekolah Menengah Pertama Berbasis Pesantren"}
                      </p>
                      {accreditationText ? (
                        <p className="text-[8.5px] font-semibold text-slate-800">
                          {accreditationText}
                        </p>
                      ) : null}
                      <p className="text-[8px] text-slate-600">
                        {customHeader.address || identity?.address || "Jl. Pendidikan No. 1, Kota Solok"}
                      </p>
                    </div>

                    {/* Logo Kanan */}
                    <div className="w-12 shrink-0 flex items-center justify-center">
                      {pesantrenLogoUrl ? (
                        <img
                          src={pesantrenLogoUrl}
                          alt="Logo Pondok Pesantren"
                          className="max-h-12 max-w-[48px] object-contain"
                        />
                      ) : schoolLogoUrl ? (
                        <div className="w-12" />
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 2. Mini Signature Block Preview (2 Kolom Vertikal Sejajar) */}
                <div>
                  {/* Tanggal & Mengetahui Sejajar di Kolom Kanan */}
                  <div className="grid grid-cols-2 gap-4 mb-1">
                    <div />
                    <div className="text-center text-[10px]">
                      <p className="text-slate-700 font-medium">{reportCity || "Solok"}, {reportDate || "18 Oktober 2026"}</p>
                      <p className="text-slate-600">Mengetahui,</p>
                    </div>
                  </div>

                  {/* Dua Kolom Sejajar */}
                  <div className="grid grid-cols-2 gap-4 text-center">
                    {/* Preview Kolom Wali Kelas */}
                    <div className="flex flex-col justify-between h-32 border-r border-slate-100 pr-2">
                      <div>
                        <p className="font-semibold text-[11px]">
                          Wali Kelas {selectedClassObj?.name || "VII-A"}
                        </p>
                      </div>

                      <div className="h-14 flex items-center justify-center my-0.5">
                        {selectedClassHomeroomSig ? (
                          <img
                            src={selectedClassHomeroomSig}
                            alt="Tanda Tangan Wali Kelas"
                            className="max-h-14 max-w-[100px] object-contain"
                          />
                        ) : (
                          <span className="text-[9px] text-slate-300 italic border border-dashed border-slate-200 px-2 py-1 rounded">
                            (Tanda Tangan Manual)
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="font-bold underline text-[11px]">
                          {selectedClassObj?.homeroomTeacherName || "Nama Wali Kelas"}
                        </p>
                        <p className="text-[9px] text-slate-500">Wali Kelas</p>
                      </div>
                    </div>

                    {/* Preview Kolom Kepala Sekolah & Cap */}
                    <div className="flex flex-col justify-between h-32 pl-2">
                      <div>
                        <p className="font-semibold text-[11px] leading-tight">{headmasterTitle}</p>
                      </div>

                      <div className="h-14 relative flex items-center justify-center my-0.5">
                        {schoolStampUrl && (
                          <img
                            src={schoolStampUrl}
                            alt="Cap Sekolah"
                            className="absolute left-1/2 -translate-x-12 -top-1 max-h-14 max-w-[65px] object-contain pointer-events-none opacity-85 z-0"
                          />
                        )}

                        {headmasterSignatureUrl ? (
                          <img
                            src={headmasterSignatureUrl}
                            alt="Tanda Tangan Kepala Sekolah"
                            className="relative z-10 max-h-14 max-w-[100px] object-contain"
                          />
                        ) : (
                          <span className="relative z-10 text-[9px] text-slate-300 italic border border-dashed border-slate-200 px-2 py-1 rounded">
                            (Tanda Tangan Manual)
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="font-bold underline text-[11px] relative z-10">{headmasterName}</p>
                        <p className="text-[9px] text-slate-500">{headmasterNipNiy}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Menyimpan..." : "Simpan Pengaturan"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
