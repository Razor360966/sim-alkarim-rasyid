import React from "react";
import {
  MidtermReportStudent,
  MidtermReportContext,
  MidtermReportType,
  MidtermReportScore,
  MidtermReportSubject
} from "../types/midtermReport.types";
import { ERaporSettingsConfig } from "../types/eRapor.types";
import { AppConfig } from "../config/appConfig";

export interface MidtermStudentReportPrintableProps {
  student: MidtermReportStudent;
  context: MidtermReportContext;
  reportType: MidtermReportType;
  printConfig?: ERaporSettingsConfig;
  identity?: AppConfig;
  paperSize?: "A4" | "F4";
  printDate?: string;
  isSinglePage?: boolean;
}

export const MidtermStudentReportPrintable: React.FC<MidtermStudentReportPrintableProps> = ({
  student,
  context,
  reportType,
  printConfig,
  identity,
  paperSize = "A4",
  printDate,
  isSinglePage = true
}) => {
  const isPondok = reportType === "PONDOK";
  const isTerpadu = reportType === "TERPADU";

  // Resolve Headers
  const genHeader = printConfig?.generalReportHeader || {
    institutionName: identity?.schoolName || "SMP ALKARIM RASYID",
    subTitle: "Sekolah Menengah Pertama Berbasis Pesantren",
    address: identity?.address || "Jl. Pendidikan No. 1, Kota Solok, Sumatera Barat",
    phone: identity?.phone || "(021) 1234567",
    email: identity?.email || "info@alkarimrasyid.sch.id",
    website: identity?.website || "www.alkarimrasyid.sch.id"
  };

  const pesHeader = printConfig?.pesantrenReportHeader || {
    institutionName: "PONDOK PESANTREN ALKARIM RASYID",
    subTitle: "Madrasah Diniyah & Pengasuhan Kepesantrenan",
    address: identity?.address || "Jl. Pendidikan No. 1, Kota Solok, Sumatera Barat",
    phone: "081234567890",
    email: "pesantren@alkarimrasyid.sch.id",
    website: identity?.website || "www.alkarimrasyid.sch.id"
  };

  // For TERPADU or UMUM use genHeader; for PONDOK use pesHeader
  const activeHeader = isPondok ? pesHeader : genHeader;

  // Resolve Headmaster & Signatures
  const headmasterName =
    printConfig?.headmasterName ||
    identity?.principalName ||
    identity?.headmasterName ||
    "H. Abdullah, M.Pd.";

  const headmasterSignatureUrl =
    printConfig?.headmasterSignatureUrl ||
    identity?.principalSignatureUrl ||
    identity?.headmasterSignatureUrl ||
    "";

  const principalNipNiy = identity?.principalNipNiy || "NIY. 202001001";

  // Score Map for Fast Lookup
  const scoreMap = React.useMemo(() => {
    const map = new Map<string, MidtermReportScore>();
    student.scores.forEach((sc) => map.set(sc.subjectId, sc));
    return map;
  }, [student]);

  // Resolve subjects for Terpadu mode (Separated into Umum and Pondok)
  const umumSubjectsList = React.useMemo(() => {
    if (context.umumSubjects && context.umumSubjects.length > 0) {
      return context.umumSubjects;
    }
    return context.subjects.filter((s) => s.subjectType === "UMUM");
  }, [context.umumSubjects, context.subjects]);

  const pondokSubjectsList = React.useMemo(() => {
    if (context.pondokSubjects && context.pondokSubjects.length > 0) {
      return context.pondokSubjects;
    }
    return context.subjects.filter((s) => s.subjectType === "PONDOK");
  }, [context.pondokSubjects, context.subjects]);

  // Group subjects for UMUM (Group A & Group B if applicable)
  const { groupA, groupB, hasGrouping } = React.useMemo(() => {
    if (isPondok) {
      return { groupA: context.subjects, groupB: [], hasGrouping: false };
    }

    const targetList = isTerpadu ? umumSubjectsList : context.subjects;
    const aList: MidtermReportSubject[] = [];
    const bList: MidtermReportSubject[] = [];
    let foundGroup = false;

    targetList.forEach((subj) => {
      if (subj.group?.toUpperCase() === "B") {
        bList.push(subj);
        foundGroup = true;
      } else if (subj.group?.toUpperCase() === "A") {
        aList.push(subj);
        foundGroup = true;
      } else {
        aList.push(subj);
      }
    });

    return {
      groupA: aList,
      groupB: bList,
      hasGrouping: foundGroup && bList.length > 0
    };
  }, [context.subjects, isPondok, isTerpadu, umumSubjectsList]);

  const formattedDate =
    printDate ||
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  // Render Subject Table Row
  const renderSubjectRow = (subj: MidtermReportSubject, index: number) => {
    const sc = scoreMap.get(subj.subjectId);
    const status = sc?.status || "BELUM_DIISI";
    const score = sc?.score;
    const kkm = subj.kkm || 75;

    let scoreDisplay: React.ReactNode = "-";
    let statusDisplay: React.ReactNode = "Belum Diisi";

    if (status === "TERISI" && score !== null && score !== undefined) {
      scoreDisplay = <span className="font-bold">{score}</span>;
      if (score >= kkm) {
        statusDisplay = <span className="text-emerald-700 font-medium">Tercapai</span>;
      } else {
        statusDisplay = <span className="text-amber-700 font-medium">Perlu Peningkatan</span>;
      }
    } else if (status === "TIDAK_ADA_UTS") {
      scoreDisplay = <span className="text-slate-400">-</span>;
      statusDisplay = <span className="text-slate-500 italic">Tanpa UTS</span>;
    } else {
      scoreDisplay = <span className="text-slate-400">-</span>;
      statusDisplay = <span className="text-amber-700 italic">Belum Diisi</span>;
    }

    return (
      <tr key={subj.subjectId} className="border-b border-black">
        <td className="p-1.5 text-center border-r border-black">{index}</td>
        <td className="p-1.5 border-r border-black font-semibold text-slate-900">
          {subj.subjectName}
          {subj.subjectCode && subj.subjectCode !== subj.subjectName && (
            <span className="text-[10px] text-slate-500 font-normal ml-1.5">
              ({subj.subjectCode})
            </span>
          )}
        </td>
        <td className="p-1.5 text-center border-r border-black">{subj.hasUts === false ? "-" : kkm}</td>
        <td className="p-1.5 text-center border-r border-black">{scoreDisplay}</td>
        <td className="p-1.5 text-center text-[11px]">{statusDisplay}</td>
      </tr>
    );
  };

  return (
    <div
      className={`student-report-card bg-white text-black font-serif p-6 sm:p-8 max-w-4xl mx-auto border border-slate-300 print:border-none print:p-0 print:shadow-none ${
        isSinglePage ? "print:break-after-page" : ""
      }`}
      style={{ minHeight: paperSize === "F4" ? "300mm" : "270mm" }}
    >
      {/* 1. KOP SURAT RESMI */}
      <div className="border-b-4 border-double border-black pb-2.5 mb-4 text-center">
        <h2 className="text-lg font-black uppercase tracking-wider text-slate-900">
          {activeHeader.institutionName}
        </h2>
        <p className="text-xs font-sans text-slate-700 font-bold uppercase tracking-wide mt-0.5">
          {activeHeader.subTitle}
        </p>
        <p className="text-[11px] font-sans text-slate-700 mt-0.5">{activeHeader.address}</p>
        <p className="text-[10px] font-sans text-slate-500 italic mt-0.5">
          Telp: {activeHeader.phone || "-"} | Email: {activeHeader.email || "-"} | Website:{" "}
          {activeHeader.website || "-"}
        </p>
      </div>

      {/* 2. JUDUL RAPOR */}
      <div className="text-center mb-4">
        <h1 className="text-sm sm:text-base font-extrabold tracking-wider uppercase underline">
          LAPORAN HASIL BELAJAR TENGAH SEMESTER (RAPOR BAYANGAN)
        </h1>
        <p className="text-xs font-sans font-semibold text-slate-800 mt-0.5 uppercase">
          {isTerpadu
            ? "Mata Pelajaran Umum & Kepesantrenan / Diniyyah (Terpadu)"
            : isPondok
            ? "Mata Pelajaran Kepesantrenan & Diniyyah"
            : "Mata Pelajaran Umum (Kurikulum Merdeka)"}
        </p>
        <p className="text-[11px] font-sans text-slate-600 mt-0.5">
          Tahun Ajaran {context.academicYearId || "2024/2025"} — Semester{" "}
          {context.semesterId || "Ganjil"}
        </p>
      </div>

      {/* 3. METADATA IDENTITAS SISWA (Hanya ditampilkan SATU kali) */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-sans mb-4 border border-black p-2.5 rounded-xs bg-slate-50/40">
        <div className="flex">
          <span className="w-36 text-slate-600 font-medium">Nama Peserta Didik</span>
          <span className="font-bold">: {student.studentName}</span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-600 font-medium">Kelas / Rombel</span>
          <span className="font-bold">: {context.className}</span>
        </div>
        <div className="flex">
          <span className="w-36 text-slate-600 font-medium">NIS / NISN</span>
          <span>
            : {student.nis || "-"} / {student.nisn || "-"}
          </span>
        </div>
        <div className="flex">
          <span className="w-32 text-slate-600 font-medium">Wali Kelas</span>
          <span className="font-semibold">: {context.homeroomTeacherName || "-"}</span>
        </div>
      </div>

      {/* 4. TABEL NILAI */}
      {isTerpadu ? (
        /* FORMAT TERPADU: BAGIAN A (UMUM) & BAGIAN B (PESANTREN / DINIYAH) */
        <div className="space-y-4 mb-4">
          {/* Bagian A — Mata Pelajaran Umum */}
          <div className="border border-black overflow-hidden print:break-inside-avoid">
            <div className="bg-slate-100 border-b border-black px-3 py-1 font-sans font-bold text-xs uppercase tracking-wide text-slate-900 flex items-center justify-between">
              <span>Bagian A — Mata Pelajaran Umum</span>
              <span className="text-[10px] font-semibold text-slate-600">Kurikulum Merdeka</span>
            </div>
            <table className="w-full text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-black text-center font-bold">
                  <th className="p-1.5 border-r border-black w-10">No</th>
                  <th className="p-1.5 border-r border-black text-left min-w-[200px]">Mata Pelajaran</th>
                  <th className="p-1.5 border-r border-black w-16">KKM</th>
                  <th className="p-1.5 border-r border-black w-24">Nilai UTS</th>
                  <th className="p-1.5 w-32">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {umumSubjectsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-2.5 text-center text-slate-500 italic">
                      Belum ada mata pelajaran umum untuk kelas ini.
                    </td>
                  </tr>
                ) : hasGrouping ? (
                  <>
                    <tr className="bg-slate-100/70 border-b border-black font-bold">
                      <td colSpan={5} className="p-1 px-2.5 uppercase text-[10px] text-slate-800">
                        Kelompok A — Muatan Nasional
                      </td>
                    </tr>
                    {groupA.map((subj, idx) => renderSubjectRow(subj, idx + 1))}

                    {groupB.length > 0 && (
                      <>
                        <tr className="bg-slate-100/70 border-b border-black font-bold">
                          <td colSpan={5} className="p-1 px-2.5 uppercase text-[10px] text-slate-800">
                            Kelompok B — Muatan Lokal / Pilihan
                          </td>
                        </tr>
                        {groupB.map((subj, idx) => renderSubjectRow(subj, groupA.length + idx + 1))}
                      </>
                    )}
                  </>
                ) : (
                  umumSubjectsList.map((subj, idx) => renderSubjectRow(subj, idx + 1))
                )}
              </tbody>
            </table>
          </div>

          {/* Bagian B — Mata Pelajaran Pesantren/Diniyah */}
          <div className="border border-black overflow-hidden print:break-inside-avoid">
            <div className="bg-slate-100 border-b border-black px-3 py-1 font-sans font-bold text-xs uppercase tracking-wide text-slate-900 flex items-center justify-between">
              <span>Bagian B — Mata Pelajaran Pesantren / Diniyyah</span>
              <span className="text-[10px] font-semibold text-slate-600">Madrasah Diniyah</span>
            </div>
            <table className="w-full text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-black text-center font-bold">
                  <th className="p-1.5 border-r border-black w-10">No</th>
                  <th className="p-1.5 border-r border-black text-left min-w-[200px]">Mata Pelajaran</th>
                  <th className="p-1.5 border-r border-black w-16">KKM</th>
                  <th className="p-1.5 border-r border-black w-24">Nilai UTS</th>
                  <th className="p-1.5 w-32">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {pondokSubjectsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-2.5 text-center text-slate-500 italic">
                      Belum ada mata pelajaran pesantren untuk kelas ini.
                    </td>
                  </tr>
                ) : (
                  pondokSubjectsList.map((subj, idx) => renderSubjectRow(subj, idx + 1))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* FORMAT TUNGGAL: RAPOR UMUM ATAU RAPOR PONDOK */
        <div className="mb-4 print:break-inside-avoid">
          <table className="w-full text-xs border-collapse border border-black font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="p-1.5 border-r border-black w-10">No</th>
                <th className="p-1.5 border-r border-black text-left min-w-[220px]">Mata Pelajaran</th>
                <th className="p-1.5 border-r border-black w-16">KKM</th>
                <th className="p-1.5 border-r border-black w-24">Nilai UTS</th>
                <th className="p-1.5 w-36">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {context.subjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-500 italic">
                    Belum ada data mata pelajaran untuk kelas ini.
                  </td>
                </tr>
              ) : hasGrouping ? (
                <>
                  {/* Kelompok A */}
                  <tr className="bg-slate-100/70 border-b border-black font-bold">
                    <td colSpan={5} className="p-1 px-3 uppercase text-[10px] text-slate-800">
                      A. Muatan Nasional / Umum
                    </td>
                  </tr>
                  {groupA.map((subj, idx) => renderSubjectRow(subj, idx + 1))}

                  {/* Kelompok B */}
                  <tr className="bg-slate-100/70 border-b border-black font-bold">
                    <td colSpan={5} className="p-1 px-3 uppercase text-[10px] text-slate-800">
                      B. Muatan Lokal / Pilihan
                    </td>
                  </tr>
                  {groupB.map((subj, idx) => renderSubjectRow(subj, groupA.length + idx + 1))}
                </>
              ) : (
                context.subjects.map((subj, idx) => renderSubjectRow(subj, idx + 1))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. CATATAN PERKEMBANGAN TENGAH SEMESTER */}
      <div className="border border-black p-2.5 rounded-xs font-sans text-xs mb-6 bg-slate-50/20 print:break-inside-avoid">
        <h4 className="font-bold border-b border-black/30 pb-0.5 mb-1 text-slate-900">
          Catatan Evaluasi Tengah Semester:
        </h4>
        <p className="italic text-[10.5px] leading-relaxed text-slate-700">
          "Nilai yang tercantum dalam Rapor Bayangan ini merupakan hasil Penilaian Tengah Semester
          (UTS/STS) sebagai sarana evaluasi berkala capaian belajar peserta didik. Harap menjadi
          perhatian bersama antara pihak madrasah/sekolah dan orang tua/wali santri untuk terus
          memotivasi dan memantau perkembangan belajar."
        </p>
      </div>

      {/* 6. TANDA TANGAN RESMI (2 KOLOM GABUNGAN: WALI KELAS & KEPALA SEKOLAH/KEPALA MADRASAH) */}
      <div className="grid grid-cols-2 gap-8 text-center text-xs font-sans pt-2 print:break-inside-avoid">
        {/* Kolom 1: Wali Kelas */}
        <div className="flex flex-col justify-between h-32">
          <div>
            <p className="font-semibold">Wali Kelas {context.className}</p>
          </div>
          <div>
            <p className="font-bold underline">{context.homeroomTeacherName || "-"}</p>
            <p className="text-[10px] text-slate-500">Wali Kelas</p>
          </div>
        </div>

        {/* Kolom 2: Kepala Sekolah / Kepala Madrasah (1 Nama & 1 Kolom Tanda Tangan) */}
        <div className="flex flex-col justify-between h-32">
          <div>
            <p>Solok, {formattedDate}</p>
            <p>Mengetahui,</p>
            <p className="font-semibold">Kepala Sekolah / Kepala Madrasah</p>
          </div>
          <div>
            {headmasterSignatureUrl ? (
              <div className="h-12 flex items-center justify-center my-0.5">
                <img
                  src={headmasterSignatureUrl}
                  alt="Tanda Tangan"
                  className="max-h-12 object-contain"
                />
              </div>
            ) : null}
            <p className="font-bold underline">{headmasterName}</p>
            <p className="text-[10px] text-slate-500">{principalNipNiy}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

