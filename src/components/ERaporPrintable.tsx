import React from "react";
import { Student } from "../types";
import { AppConfig } from "../config/appConfig";
import { ERaporClassVerification, ERaporExtracurricularAssessment, ERaporSettingsConfig } from "../types/eRapor.types";

interface SubjectWithScore {
  subjectName: string;
  group?: string;
  finalScore: number | null;
  tpAverage?: number | null;
  utsScore?: number | null;
  sasScore?: number | null;
  description?: string;
  ketercapaian?: string;
  notes?: string;
}

interface ERaporPrintableProps {
  student: Student | null;
  className: string;
  homeroomTeacherName: string;
  identity: AppConfig | null;
  academicYear: string;
  semester: string;
  subjectsWithScores?: SubjectWithScore[];
  umumSubjects?: SubjectWithScore[];
  pondokSubjects?: SubjectWithScore[];
  extracurriculars?: ERaporExtracurricularAssessment[];
  verification: ERaporClassVerification | null;
  printDate?: string;
  printConfig?: ERaporSettingsConfig;
  forcedReportType?: "ALL" | "UMUM" | "PONDOK" | "EKSKUL";
}

export const ERaporPrintable: React.FC<ERaporPrintableProps> = ({
  student,
  className,
  homeroomTeacherName,
  identity,
  academicYear,
  semester,
  subjectsWithScores,
  umumSubjects,
  pondokSubjects,
  extracurriculars = [],
  verification,
  printDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
  printConfig,
  forcedReportType
}) => {
  const [reportType, setReportType] = React.useState<"ALL" | "UMUM" | "PONDOK" | "EKSKUL">(
    forcedReportType || "ALL"
  );

  React.useEffect(() => {
    if (forcedReportType) {
      setReportType(forcedReportType);
    }
  }, [forcedReportType]);

  if (!student) return null;

  // Derive paper settings & headers based on active report type
  const isPondokMode = reportType === "PONDOK";
  
  const genHeader = printConfig?.generalReportHeader || {
    institutionName: identity?.schoolName || "SMP ALKARIM RASYID",
    subTitle: "Sekolah Menengah Pertama Alkarim Rasyid",
    address: identity?.address || "Jl. Pendidikan No. 1, Kota Solok",
    phone: identity?.phone || "(021) 1234567",
    email: identity?.email || "info@alkarimrasyid.sch.id",
    website: identity?.website || "www.alkarimrasyid.sch.id"
  };

  const pesHeader = printConfig?.pesantrenReportHeader || {
    institutionName: "PONDOK PESANTREN ALKARIM RASYID",
    subTitle: "Madrasah Diniyah & Pengasuhan Kepesantrenan",
    address: identity?.address || "Jl. Pendidikan No. 1, Kota Solok",
    phone: "081234567890",
    email: "pesantren@alkarimrasyid.sch.id",
    website: identity?.website || "www.alkarimrasyid.sch.id"
  };

  const activeHeader = isPondokMode ? pesHeader : genHeader;

  const activePaper = isPondokMode
    ? (printConfig?.pesantrenReport || { paperSize: "F4", orientation: "portrait" })
    : (printConfig?.generalReport || { paperSize: "A4", orientation: "portrait" });

  const paperSizeStyle = activePaper.paperSize === "F4" ? "215mm 330mm" : "A4";

  const headmasterName = printConfig?.headmasterName || identity?.principalName || identity?.headmasterName || "H. Abdullah, M.Pd.";
  const headmasterSignatureUrl = printConfig?.headmasterSignatureUrl || identity?.principalSignatureUrl || identity?.headmasterSignatureUrl || "";

  const effectiveUmum = umumSubjects || subjectsWithScores || [];
  const effectivePondok = pondokSubjects || [];

  const groupA = effectiveUmum.filter((s) => s.group === "A" || !s.group);
  const groupB = effectiveUmum.filter((s) => s.group === "B");

  const showUmum = reportType === "ALL" || reportType === "UMUM";
  const showPondok = reportType === "ALL" || reportType === "PONDOK";
  const showEkskul = reportType === "ALL" || reportType === "EKSKUL";

  return (
    <div className="space-y-4">
      {/* Dynamic Print Page CSS Rule Injection */}
      <style>{`
        @media print {
          @page {
            size: ${paperSizeStyle} ${activePaper.orientation};
            margin: 12mm 15mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* Printable Output Selector Controls (Hidden when printing) */}
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-slate-100 dark:bg-zinc-800 p-3 rounded-xl border border-slate-200 dark:border-zinc-700">
        <div className="flex items-center gap-1.5 font-sans text-xs">
          <span className="font-bold text-slate-700 dark:text-zinc-300 mr-2">Output Cetak:</span>
          <button
            type="button"
            onClick={() => setReportType("ALL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              reportType === "ALL"
                ? "bg-emerald-600 text-white shadow"
                : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200"
            }`}
          >
            Rapor Lengkap
          </button>
          <button
            type="button"
            onClick={() => setReportType("UMUM")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              reportType === "UMUM"
                ? "bg-emerald-600 text-white shadow"
                : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200"
            }`}
          >
            Rapor Umum ({printConfig?.generalReport?.paperSize || "A4"})
          </button>
          <button
            type="button"
            onClick={() => setReportType("PONDOK")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              reportType === "PONDOK"
                ? "bg-amber-600 text-white shadow"
                : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200"
            }`}
          >
            Rapor Kepesantrenan ({printConfig?.pesantrenReport?.paperSize || "F4"})
          </button>
          <button
            type="button"
            onClick={() => setReportType("EKSKUL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
              reportType === "EKSKUL"
                ? "bg-indigo-600 text-white shadow"
                : "bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-200"
            }`}
          >
            Ekstrakurikuler
          </button>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold rounded-lg shadow flex items-center gap-2 cursor-pointer"
        >
          Cetak PDF / Print ({activePaper.paperSize})
        </button>
      </div>

      <div className="printable-rapor text-black font-serif p-8 bg-white max-w-4xl mx-auto border border-slate-300 print:border-none print:p-0">
        {/* 1. KOP SURAT / HEADER RESMI */}
        <div className="border-b-4 border-double border-black pb-4 mb-6 text-center">
          <h2 className="text-xl font-bold uppercase tracking-wide">{activeHeader.institutionName}</h2>
          <p className="text-xs font-sans text-slate-700 font-semibold">{activeHeader.subTitle}</p>
          <p className="text-xs font-sans text-slate-700">{activeHeader.address}</p>
          <p className="text-[10px] font-sans text-slate-500 italic mt-0.5">
            Telp: {activeHeader.phone || "-"} | Email: {activeHeader.email || "-"} | Website: {activeHeader.website || "-"}
          </p>
        </div>

        {/* 2. JUDUL RAPOR */}
        <div className="text-center mb-6">
          <h1 className="text-lg font-extrabold tracking-wider uppercase underline">
            {reportType === "UMUM"
              ? "LAPORAN HASIL BELAJAR MATA PELAJARAN UMUM"
              : reportType === "PONDOK"
              ? "LAPORAN HASIL BELAJAR MATA PELAJARAN KEPESANTRENAN"
              : reportType === "EKSKUL"
              ? "LAPORAN KEMAJUAN KEGIATAN EKSTRAKURIKULER"
              : "LAPORAN HASIL BELAJAR (e-RAPOR)"}
          </h1>
          <p className="text-xs font-semibold mt-1">
            Tahun Ajaran {academicYear} – Semester {semester}
          </p>
        </div>

      {/* 3. METADATA SISWA */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs font-sans mb-6 border border-black p-3.5 rounded-lg bg-slate-50/50">
        <div>
          <span className="font-semibold text-slate-600">Nama Peserta Didik:</span>{" "}
          <span className="font-bold">{student.name}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-600">Kelas:</span>{" "}
          <span className="font-bold">{className}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-600">NIS / NISN:</span>{" "}
          <span>{student.nis || "-"} / {student.nisn || "-"}</span>
        </div>
        <div>
          <span className="font-semibold text-slate-600">Wali Kelas:</span>{" "}
          <span className="font-bold">{homeroomTeacherName}</span>
        </div>
      </div>

      {/* 4. TABEL CAPAIAN HASIL BELAJAR UMUM */}
      {showUmum && (
        <div className="mb-6">
          <h3 className="text-xs font-bold font-sans uppercase mb-2 border-b border-black pb-1">
            {reportType === "ALL" ? "A. Capaian Kompetensi Mata Pelajaran Umum" : "Capaian Kompetensi Mata Pelajaran Umum"}
          </h3>

          <table className="w-full text-xs border-collapse border border-black font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="p-2 border-r border-black w-8">No</th>
                <th className="p-2 border-r border-black w-48 text-left">Mata Pelajaran</th>
                <th className="p-2 border-r border-black w-16">Nilai Akhir</th>
                <th className="p-2 text-left">Capaian Kompetensi / Deskripsi Tujuan Pembelajaran</th>
              </tr>
            </thead>
            <tbody>
              {effectiveUmum.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center italic text-slate-500">
                    Belum ada data nilai mata pelajaran umum.
                  </td>
                </tr>
              ) : (
                <>
                  {/* Kelompok A */}
                  {groupA.map((item, idx) => (
                    <tr key={`a-${idx}`} className="border-b border-black">
                      <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                      <td className="p-2 border-r border-black font-semibold">{item.subjectName}</td>
                      <td className="p-2 border-r border-black text-center font-bold text-sm">
                        {item.finalScore !== null && item.finalScore !== undefined ? item.finalScore : "-"}
                      </td>
                      <td className="p-2 text-[11px] leading-relaxed">{item.description || "-"}</td>
                    </tr>
                  ))}

                  {/* Kelompok B */}
                  {groupB.length > 0 && (
                    <>
                      <tr className="bg-slate-50 font-bold border-b border-black">
                        <td colSpan={4} className="p-1.5 pl-3 text-slate-700">Muatan Lokal & Keagamaan</td>
                      </tr>
                      {groupB.map((item, idx) => (
                        <tr key={`b-${idx}`} className="border-b border-black">
                          <td className="p-2 border-r border-black text-center">{groupA.length + idx + 1}</td>
                          <td className="p-2 border-r border-black font-semibold">{item.subjectName}</td>
                          <td className="p-2 border-r border-black text-center font-bold text-sm">
                            {item.finalScore !== null && item.finalScore !== undefined ? item.finalScore : "-"}
                          </td>
                          <td className="p-2 text-[11px] leading-relaxed">{item.description || "-"}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. TABEL CAPAIAN KEPONDOKAN / KEPESANTRENAN */}
      {showPondok && (
        <div className="mb-6">
          <h3 className="text-xs font-bold font-sans uppercase mb-2 border-b border-black pb-1">
            {reportType === "ALL" ? "B. Capaian Mata Pelajaran Kepesantrenan" : "Capaian Mata Pelajaran Kepesantrenan"}
          </h3>

          <table className="w-full text-xs border-collapse border border-black font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="p-2 border-r border-black w-8">No</th>
                <th className="p-2 border-r border-black w-48 text-left">Mata Pelajaran Kepesantrenan</th>
                <th className="p-2 border-r border-black w-16">Nilai Akhir</th>
                <th className="p-2 text-left">Ketercapaian Kompetensi Santri</th>
              </tr>
            </thead>
            <tbody>
              {effectivePondok.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center italic text-slate-500">
                    Belum ada data nilai mata pelajaran kepesantrenan.
                  </td>
                </tr>
              ) : (
                effectivePondok.map((item, idx) => (
                  <tr key={`p-${idx}`} className="border-b border-black">
                    <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                    <td className="p-2 border-r border-black font-semibold">{item.subjectName}</td>
                    <td className="p-2 border-r border-black text-center font-bold text-sm">
                      {item.finalScore !== null && item.finalScore !== undefined ? item.finalScore : "-"}
                    </td>
                    <td className="p-2 text-[11px] leading-relaxed">{item.ketercapaian || item.description || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. TABEL EKSTRAKURIKULER */}
      {showEkskul && (
        <div className="mb-6">
          <h3 className="text-xs font-bold font-sans uppercase mb-2 border-b border-black pb-1">
            {reportType === "ALL" ? "C. Kegiatan Ekstrakurikuler" : "Kegiatan Ekstrakurikuler"}
          </h3>

          <table className="w-full text-xs border-collapse border border-black font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="p-2 border-r border-black w-8">No</th>
                <th className="p-2 border-r border-black w-48 text-left">Kegiatan Ekstrakurikuler</th>
                <th className="p-2 border-r border-black w-24">Status Keikutsertaan</th>
                <th className="p-2 text-left">Kemajuan Siswa / Catatan Pembina</th>
              </tr>
            </thead>
            <tbody>
              {extracurriculars.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-3 text-center italic text-slate-500">
                    Belum ada kegiatan ekstrakurikuler yang diikuti.
                  </td>
                </tr>
              ) : (
                extracurriculars.map((ek, idx) => (
                  <tr key={`ek-${idx}`} className="border-b border-black">
                    <td className="p-2 border-r border-black text-center">{idx + 1}</td>
                    <td className="p-2 border-r border-black font-semibold">{ek.extracurricularName}</td>
                    <td className="p-2 border-r border-black text-center font-bold">{ek.participationStatus}</td>
                    <td className="p-2 text-[11px] leading-relaxed">{ek.progress}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 7. KEHADIRAN & CATATAN WALI KELAS */}
      <div className="grid grid-cols-2 gap-4 text-xs font-sans mb-8">
        <div className="border border-black p-3 rounded-lg">
          <h4 className="font-bold border-b border-black pb-1 mb-2">D. Ketidakhadiran</h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Sakit:</span> <span className="font-bold">0 Hari</span>
            </div>
            <div className="flex justify-between">
              <span>Izin:</span> <span className="font-bold">0 Hari</span>
            </div>
            <div className="flex justify-between">
              <span>Tanpa Keterangan:</span> <span className="font-bold">0 Hari</span>
            </div>
          </div>
        </div>

        <div className="border border-black p-3 rounded-lg">
          <h4 className="font-bold border-b border-black pb-1 mb-2">E. Catatan Wali Kelas</h4>
          <p className="italic text-[11px] leading-relaxed text-slate-800">
            "Ananda menunjukkan perkembangan akhlak dan akademik yang sangat baik. Tingkatkan semangat muraja'ah dan ketelitian dalam pembelajaran."
          </p>
        </div>
      </div>

      {/* 8. TANDA TANGAN RESMI */}
      <div className="grid grid-cols-3 gap-4 text-center text-xs font-sans pt-4 border-t border-slate-300">
        <div>
          <p>Mengetahui,</p>
          <p className="font-semibold mb-12">Orang Tua / Wali Santri</p>
          <p className="border-b border-black w-36 mx-auto mb-1"></p>
          <p className="text-[10px] text-slate-500">(Tanda Tangan & Nama Terang)</p>
        </div>

        <div>
          <p>Solok, {printDate}</p>
          <p className="font-semibold mb-12">Wali Kelas {className}</p>
          <p className="font-bold underline">{homeroomTeacherName}</p>
          <p className="text-[10px] text-slate-500">NIY. -</p>
        </div>

        <div>
          <p>Mengetahui,</p>
          <p className="font-semibold mb-2">Kepala Sekolah</p>
          {headmasterSignatureUrl ? (
            <div className="h-16 flex items-center justify-center my-1">
              <img
                src={headmasterSignatureUrl}
                alt="Tanda Tangan Kepala Sekolah"
                className="max-h-16 object-contain"
              />
            </div>
          ) : (
            <div className="h-16"></div>
          )}
          <p className="font-bold underline">{headmasterName}</p>
          <p className="text-[10px] text-slate-500">
            {identity?.principalNipNiy || "NIY. 202001001"}
          </p>
        </div>
      </div>
    </div>
  </div>
);
};

