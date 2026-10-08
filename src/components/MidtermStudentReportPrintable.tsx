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

  // Group subjects for UMUM (Group A & Group B if applicable)
  const { groupA, groupB, hasGrouping } = React.useMemo(() => {
    if (isPondok) {
      return { groupA: context.subjects, groupB: [], hasGrouping: false };
    }

    const aList: MidtermReportSubject[] = [];
    const bList: MidtermReportSubject[] = [];
    let foundGroup = false;

    context.subjects.forEach((subj) => {
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
  }, [context.subjects, isPondok]);

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
        <td className="p-2 text-center border-r border-black">{index}</td>
        <td className="p-2 border-r border-black font-semibold text-slate-900">
          {subj.subjectName}
          {subj.subjectCode && subj.subjectCode !== subj.subjectName && (
            <span className="text-[10px] text-slate-500 font-normal ml-1.5">
              ({subj.subjectCode})
            </span>
          )}
        </td>
        <td className="p-2 text-center border-r border-black">{subj.hasUts === false ? "-" : kkm}</td>
        <td className="p-2 text-center border-r border-black">{scoreDisplay}</td>
        <td className="p-2 text-center">{statusDisplay}</td>
      </tr>
    );
  };

  return (
    <div
      className={`student-report-card bg-white text-black font-serif p-8 max-w-4xl mx-auto border border-slate-300 print:border-none print:p-0 print:shadow-none ${
        isSinglePage ? "print:break-after-page" : ""
      }`}
      style={{ minHeight: paperSize === "F4" ? "300mm" : "270mm" }}
    >
      {/* 1. KOP SURAT RESMI */}
      <div className="border-b-4 border-double border-black pb-3 mb-5 text-center">
        <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">
          {activeHeader.institutionName}
        </h2>
        <p className="text-xs font-sans text-slate-700 font-bold uppercase tracking-wide mt-0.5">
          {activeHeader.subTitle}
        </p>
        <p className="text-xs font-sans text-slate-700 mt-0.5">{activeHeader.address}</p>
        <p className="text-[10px] font-sans text-slate-500 italic mt-0.5">
          Telp: {activeHeader.phone || "-"} | Email: {activeHeader.email || "-"} | Website:{" "}
          {activeHeader.website || "-"}
        </p>
      </div>

      {/* 2. JUDUL RAPOR */}
      <div className="text-center mb-5">
        <h1 className="text-base font-extrabold tracking-wider uppercase underline">
          LAPORAN HASIL BELAJAR TENGAH SEMESTER (RAPOR BAYANGAN)
        </h1>
        <p className="text-xs font-sans font-semibold text-slate-800 mt-1 uppercase">
          {isPondok
            ? "Mata Pelajaran Kepesantrenan & Diniyyah"
            : "Mata Pelajaran Umum (Kurikulum Merdeka)"}
        </p>
        <p className="text-xs font-sans text-slate-600 mt-0.5">
          Tahun Ajaran {context.academicYearId || "2024/2025"} — Semester{" "}
          {context.semesterId || "Ganjil"}
        </p>
      </div>

      {/* 3. METADATA IDENTITAS SISWA */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-sans mb-5 border border-black p-3.5 rounded-sm bg-slate-50/40">
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

      {/* 4. TABEL NILAI UTS */}
      <div className="mb-5">
        <table className="w-full text-xs border-collapse border border-black font-sans">
          <thead>
            <tr className="bg-slate-100 border-b border-black text-center font-bold">
              <th className="p-2 border-r border-black w-10">No</th>
              <th className="p-2 border-r border-black text-left min-w-[220px]">Mata Pelajaran</th>
              <th className="p-2 border-r border-black w-16">KKM</th>
              <th className="p-2 border-r border-black w-24">Nilai UTS</th>
              <th className="p-2 w-36">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {context.subjects.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                  Belum ada data mata pelajaran untuk kelas ini.
                </td>
              </tr>
            ) : hasGrouping ? (
              <>
                {/* Kelompok A */}
                <tr className="bg-slate-100/70 border-b border-black font-bold">
                  <td colSpan={5} className="p-1.5 px-3 uppercase text-[11px] text-slate-800">
                    A. Muatan Nasional / Umum
                  </td>
                </tr>
                {groupA.map((subj, idx) => renderSubjectRow(subj, idx + 1))}

                {/* Kelompok B */}
                <tr className="bg-slate-100/70 border-b border-black font-bold">
                  <td colSpan={5} className="p-1.5 px-3 uppercase text-[11px] text-slate-800">
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

      {/* 5. CATATAN PERKEMBANGAN TENGAH SEMESTER */}
      <div className="border border-black p-3 rounded-sm font-sans text-xs mb-8 bg-slate-50/20">
        <h4 className="font-bold border-b border-black/40 pb-1 mb-1.5 text-slate-900">
          Catatan Evaluasi Tengah Semester:
        </h4>
        <p className="italic text-[11px] leading-relaxed text-slate-700">
          "Nilai yang tercantum dalam Rapor Bayangan ini merupakan hasil Penilaian Tengah Semester
          (UTS/STS) sebagai sarana evaluasi berkala capaian belajar peserta didik. Harap menjadi
          perhatian bersama antara pihak madrasah/sekolah dan orang tua/wali santri untuk terus
          memotivasi dan memantau perkembangan belajar."
        </p>
      </div>

      {/* 6. TANDA TANGAN RESMI (3 KOLOM STANDAR) */}
      <div className="grid grid-cols-3 gap-4 text-center text-xs font-sans pt-2">
        {/* Kolom 1: Orang Tua / Wali */}
        <div className="flex flex-col justify-between h-36">
          <div>
            <p>Mengetahui,</p>
            <p className="font-semibold">Orang Tua / Wali Santri</p>
          </div>
          <div>
            <p className="border-b border-black w-36 mx-auto mb-1"></p>
            <p className="text-[10px] text-slate-500">(Tanda Tangan & Nama Terang)</p>
          </div>
        </div>

        {/* Kolom 2: Wali Kelas */}
        <div className="flex flex-col justify-between h-36">
          <div>
            <p>Solok, {formattedDate}</p>
            <p className="font-semibold">Wali Kelas {context.className}</p>
          </div>
          <div>
            <p className="font-bold underline">{context.homeroomTeacherName || "-"}</p>
            <p className="text-[10px] text-slate-500">NIY. -</p>
          </div>
        </div>

        {/* Kolom 3: Kepala Sekolah */}
        <div className="flex flex-col justify-between h-36">
          <div>
            <p>Mengetahui,</p>
            <p className="font-semibold">
              {isPondok ? "Pimpinan Pondok Pesantren" : "Kepala Sekolah"}
            </p>
          </div>
          <div>
            {headmasterSignatureUrl ? (
              <div className="h-14 flex items-center justify-center my-0.5">
                <img
                  src={headmasterSignatureUrl}
                  alt="Tanda Tangan"
                  className="max-h-14 object-contain"
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
