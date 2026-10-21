import React from "react";
import {
  MidtermReportStudent,
  MidtermReportContext,
  MidtermReportType,
  MidtermReportScore,
  MidtermReportSubject,
  MidtermPrintSettings
} from "../types/midtermReport.types";
import { ERaporSettingsConfig } from "../types/eRapor.types";
import { AppConfig } from "../config/appConfig";

export interface MidtermStudentReportPrintableProps {
  student: MidtermReportStudent;
  context: MidtermReportContext;
  reportType: MidtermReportType;
  printConfig?: ERaporSettingsConfig;
  midtermPrintConfig?: MidtermPrintSettings;
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
  midtermPrintConfig,
  identity,
  paperSize = "A4",
  printDate,
  isSinglePage = true
}) => {
  const isPondok = reportType === "PONDOK";
  const isTerpadu = reportType === "TERPADU";

  // Resolve Headers & Text elements according to target design (Image 2):
  // 1. Nama Pondok Pesantren (Paling atas, tebal, ~17-19 pt, warna hijau gelap)
  // Fallback: PONDOK PESANTREN ALKARIM RASYID (PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA)
  const pondokName =
    midtermPrintConfig?.customHeader?.subTitle ||
    "PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA";

  // 2. Nama Sekolah (Di bawah nama pondok, tebal, ~15-17 pt, warna hijau gelap)
  const schoolName =
    midtermPrintConfig?.customHeader?.institutionName ||
    identity?.schoolName ||
    "SMP ALKARIM RASYID";

  // 3. Keterangan Akreditasi (Di bawah nama sekolah, tebal, ~10-11 pt, warna hijau gelap)
  const accreditationText =
    (midtermPrintConfig?.accreditationText && midtermPrintConfig.accreditationText.trim()) ||
    (midtermPrintConfig?.customHeader?.accreditationText && midtermPrintConfig.customHeader.accreditationText.trim()) ||
    "";

  // 4. Alamat Lengkap (~9-10 pt)
  const kopAddress =
    midtermPrintConfig?.customHeader?.address ||
    (identity?.address && !identity.address.includes("Cibinong") && !identity.address.includes("Jl. Pendidikan No. 1")
      ? identity.address
      : "Ds. Sukabanjar Kec. Gedong Tataan Kab. Pesawaran - Lampung 35366");

  // 5. Call Center dan E-mail (~9-10 pt)
  const kopPhone =
    midtermPrintConfig?.customHeader?.phone ||
    (identity?.phone && !identity.phone.includes("(021)")
      ? identity.phone
      : "0822 8000 3961");

  const kopEmail =
    midtermPrintConfig?.customHeader?.email ||
    (identity?.email && !identity.email.includes("info@alkarimrasyid.sch.id")
      ? identity.email
      : "ponpesalkarimrasyidindonesia@gmail.com");

  const activeHeader = {
    institutionName: schoolName,
    subTitle: pondokName,
    address: kopAddress,
    phone: kopPhone,
    email: kopEmail,
    website: midtermPrintConfig?.customHeader?.website || identity?.website || "www.alkarimrasyid.sch.id"
  };

  // Resolve City & Date
  const reportCity =
    (midtermPrintConfig?.reportCity && midtermPrintConfig.reportCity.trim()) ||
    identity?.regency ||
    "Solok";

  const formattedDate =
    printDate ||
    new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

  const reportDate =
    (midtermPrintConfig?.reportDate && midtermPrintConfig.reportDate.trim()) ||
    formattedDate;

  // Resolve Logos: Pondok Logo (KIRI) & School Logo (KANAN)
  const schoolLogoUrl =
    midtermPrintConfig?.schoolLogoUrl !== undefined
      ? midtermPrintConfig.schoolLogoUrl
      : (identity?.logoUrl || "");

  const pesantrenLogoUrl = midtermPrintConfig?.pesantrenLogoUrl || "";

  // Resolve Headmaster & Signatures
  const headmasterName =
    midtermPrintConfig?.headmasterName ||
    printConfig?.headmasterName ||
    identity?.principalName ||
    identity?.headmasterName ||
    "H. Abdullah, M.Pd.";

  const headmasterTitle =
    midtermPrintConfig?.headmasterTitle ||
    "Kepala Sekolah / Kepala Madrasah";

  const headmasterSignatureUrl =
    midtermPrintConfig?.headmasterSignatureUrl ||
    printConfig?.headmasterSignatureUrl ||
    identity?.principalSignatureUrl ||
    identity?.headmasterSignatureUrl ||
    "";

  const principalNipNiy =
    midtermPrintConfig?.headmasterNipNiy ||
    identity?.principalNipNiy ||
    "NIY. 202001001";

  // Resolve School Stamp
  const schoolStampUrl = midtermPrintConfig?.schoolStampUrl || "";

  // Resolve Homeroom Teacher Identity per rombel (khusus rombel yang sedang dicetak)
  const configuredHomeroom = context.classId
    ? midtermPrintConfig?.homeroomTeachers?.[context.classId]
    : undefined;

  const homeroomTeacherName =
    (configuredHomeroom?.name && configuredHomeroom.name.trim()) ||
    context.homeroomTeacherName ||
    "-";

  const rawHomeroomNiy =
    configuredHomeroom?.niy !== undefined
      ? configuredHomeroom.niy.trim()
      : (context.homeroomTeacherNiy?.trim() || "");

  const homeroomTeacherNiyFormatted = rawHomeroomNiy
    ? (/^(NIY|NIP|NUPTK)\b/i.test(rawHomeroomNiy)
        ? rawHomeroomNiy
        : `NIY. ${rawHomeroomNiy}`)
    : "";

  // Resolve Homeroom Signature per rombel (isolated by classId, with backward compatibility)
  const homeroomSignatureUrl =
    (configuredHomeroom?.signatureUrl && configuredHomeroom.signatureUrl.trim()) ||
    (context.classId && midtermPrintConfig?.homeroomSignatures?.[context.classId]) ||
    (context.homeroomTeacherId && midtermPrintConfig?.homeroomSignatures?.[context.homeroomTeacherId]) ||
    "";


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
      className={`student-report-card bg-white text-black font-serif p-6 sm:p-8 max-w-4xl mx-auto border border-slate-300 print:border-none print:p-0 print:shadow-none print:min-h-0 print:w-full print:max-w-none ${
        isSinglePage ? "print:break-after-page" : ""
      }`}
      style={{ minHeight: paperSize === "F4" ? "300mm" : "270mm" }}
    >
      {/* 1. KOP SURAT RESMI (MENGIKUTI DESAIN GAMBAR ACUAN KEDUA) */}
      <div className="pb-2 mb-4">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo Pondok Pesantren (KIRI) */}
          <div className="w-24 sm:w-28 shrink-0 flex items-center justify-center">
            {pesantrenLogoUrl ? (
              <img
                src={pesantrenLogoUrl}
                alt="Logo Pondok Pesantren"
                className="max-h-24 sm:max-h-28 max-w-[95px] sm:max-w-[110px] w-auto h-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : schoolLogoUrl ? (
              <div className="w-24 sm:w-28 shrink-0" />
            ) : null}
          </div>

          {/* Teks Identitas KOP (TENGAH) */}
          <div className="flex-1 text-center px-1 font-sans">
            {/* 1. Nama Pondok Pesantren (Paling Besar, Huruf Kapital, Tebal, ~17-19 pt, Hijau Gelap) */}
            <h1 className="text-[16pt] sm:text-[18pt] font-black uppercase tracking-wide text-[#064e3b] leading-snug">
              {pondokName === "PONDOK PESANTREN QUR'AN DAN DAKWAH ALKARIM RASYID INDONESIA" ? (
                <>
                  <span>PONDOK PESANTREN QUR’AN DAN DAKWAH</span>
                  <br />
                  <span>ALKARIM RASYID INDONESIA</span>
                </>
              ) : (
                pondokName
              )}
            </h1>

            {/* 2. Nama Sekolah (Sedikit lebih kecil dari nama pondok, ~15-17 pt, Huruf Kapital, Tebal) */}
            <h2 className="text-[13.5pt] sm:text-[15.5pt] font-black uppercase tracking-wide text-[#064e3b] mt-0.5 leading-snug">
              {schoolName}
            </h2>

            {/* 3. Keterangan Akreditasi (Tepat di bawah nama sekolah, Tebal, ~10-11 pt, Hijau Gelap) */}
            {accreditationText ? (
              <p className="text-[10pt] sm:text-[10.5pt] font-bold uppercase tracking-wider text-[#064e3b] mt-0.5 leading-snug">
                {accreditationText}
              </p>
            ) : null}

            {/* 4. Alamat Lengkap (~9-10 pt, Regular) */}
            <p className="text-[9pt] sm:text-[9.5pt] font-normal text-slate-800 mt-1 leading-normal">
              {kopAddress}
            </p>

            {/* 5. Call Center dan E-mail (~9-10 pt, Regular) */}
            {(kopPhone || kopEmail) ? (
              <p className="text-[8.5pt] sm:text-[9pt] font-normal text-slate-800 mt-0.5 leading-normal">
                {kopPhone ? (
                  <span>
                    Call Center : {kopPhone}
                    {kopEmail ? ", " : ""}
                  </span>
                ) : null}
                {kopEmail ? <span>E-mail : {kopEmail}</span> : null}
              </p>
            ) : null}
          </div>

          {/* Logo Sekolah (KANAN) */}
          <div className="w-24 sm:w-28 shrink-0 flex items-center justify-center">
            {schoolLogoUrl ? (
              <img
                src={schoolLogoUrl}
                alt="Logo Sekolah"
                className="max-h-24 sm:max-h-28 max-w-[95px] sm:max-w-[110px] w-auto h-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : pesantrenLogoUrl ? (
              <div className="w-24 sm:w-28 shrink-0" />
            ) : null}
          </div>
        </div>

        {/* 6. Garis Pembatas KOP (Dua Lapis Warna Hijau Gelap Sesuai Gambar Acuan) */}
        <div className="mt-2.5 w-full">
          <div className="border-b-[3.5px] border-[#064e3b]" />
          <div className="border-b-[1.5px] border-[#064e3b] mt-[2.5px]" />
        </div>
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
          <span className="font-semibold">: {homeroomTeacherName}</span>
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
          perhatian bersama antara pihak madrasah/sekolah dan Orang Tua / Wali Santri untuk terus
          memotivasi dan memantau perkembangan belajar."
        </p>
      </div>

      {/* 6. TANDA TANGAN RESMI (2 KOLOM SEJAJAR: WALI KELAS & KEPALA SEKOLAH DENGAN CAP) */}
      <div className="text-xs font-sans pt-2 print:break-inside-avoid">
        {/* Baris Tempat, Tanggal & Mengetahui (Sejajar di atas kolom kanan) */}
        <div className="grid grid-cols-2 gap-8 mb-1">
          <div /> {/* Spacer kolom kiri */}
          <div className="text-center">
            <p className="text-xs text-slate-800">{reportCity}, {reportDate}</p>
            <p className="text-xs text-slate-700 font-medium">Mengetahui,</p>
          </div>
        </div>

        {/* Baris Dua Kolom Penandatangan yang SEJAJAR SECARA VERTIKAL */}
        <div className="grid grid-cols-2 gap-8 text-center">
          {/* Kolom 1: Wali Kelas */}
          <div className="flex flex-col justify-between h-36">
            <div>
              <p className="font-semibold text-xs text-slate-900">
                Wali Kelas {context.className.replace(/^Kelas\s+/i, "")}
              </p>
            </div>

            {/* Area Tanda Tangan Wali Kelas */}
            <div className="h-16 relative flex items-center justify-center my-0.5">
              {homeroomSignatureUrl ? (
                <img
                  src={homeroomSignatureUrl}
                  alt={`Tanda Tangan Wali Kelas ${context.className}`}
                  className="max-h-16 max-w-[140px] object-contain relative z-10"
                />
              ) : (
                /* Ruang kosong yang cukup untuk tanda tangan manual setelah rapor dicetak */
                <div className="h-full w-full" />
              )}
            </div>

            <div>
              <p className="font-bold underline text-slate-900">{homeroomTeacherName}</p>
              {homeroomTeacherNiyFormatted ? (
                <p className="text-[10px] text-slate-500">{homeroomTeacherNiyFormatted}</p>
              ) : (
                <p className="text-[10px] text-slate-500 min-h-[15px]">&nbsp;</p>
              )}
            </div>
          </div>

          {/* Kolom 2: Kepala Sekolah / Kepala Madrasah */}
          <div className="flex flex-col justify-between h-36">
            <div>
              <p className="font-semibold text-xs text-slate-900">
                {headmasterTitle}
              </p>
            </div>

            {/* Area Tanda Tangan & Cap Kepala Sekolah */}
            <div className="h-16 relative flex items-center justify-center my-0.5">
              {/* Cap Sekolah (Stempel Resmi, diletakkan menumpuk di sisi kiri atas tanda tangan) */}
              {schoolStampUrl ? (
                <img
                  src={schoolStampUrl}
                  alt="Cap Sekolah"
                  className="absolute left-1/2 -translate-x-14 -top-2 max-h-16 max-w-[85px] object-contain pointer-events-none opacity-85 z-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              ) : null}

              {/* Gambar Tanda Tangan Kepala Sekolah (Opsional) */}
              {headmasterSignatureUrl ? (
                <img
                  src={headmasterSignatureUrl}
                  alt="Tanda Tangan Kepala Sekolah"
                  className="relative z-10 max-h-16 max-w-[130px] object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>

            <div>
              <p className="font-bold underline text-slate-900 relative z-10">{headmasterName}</p>
              <p className="text-[10px] text-slate-500">{principalNipNiy}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

