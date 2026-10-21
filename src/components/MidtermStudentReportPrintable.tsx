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

  // Resolve Academic Year cleanly: prefer name from context, or formatted academicYearId
  const displayAcademicYear = React.useMemo(() => {
    if (context.academicYearName && context.academicYearName.trim()) {
      return context.academicYearName.trim();
    }
    const rawId = (context.academicYearId || "").trim();
    if (/^\d{4}\/\d{4}$/.test(rawId)) {
      return rawId;
    }
    const cleaned = rawId.replace(/^ay[-_]/i, "").replace(/[-_]/g, "/");
    if (/^\d{4}\/\d{4}$/.test(cleaned)) {
      return cleaned;
    }
    return rawId || "2024/2025";
  }, [context.academicYearName, context.academicYearId]);

  // Resolve Semester cleanly: prefer semesterName, or clean up semesterId
  const displaySemester = React.useMemo(() => {
    const raw = (context.semesterName || context.semesterId || "").trim();
    if (/^semester\s+/i.test(raw)) {
      return raw;
    }
    if (/^(1|ganjil|sem-1|sem_1)$/i.test(raw)) {
      return "Semester Ganjil";
    }
    if (/^(2|genap|sem-2|sem_2)$/i.test(raw)) {
      return "Semester Genap";
    }
    return raw ? `Semester ${raw}` : "Semester Ganjil";
  }, [context.semesterName, context.semesterId]);

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
        <td className="py-1 px-1.5 text-center border-r border-black">{index}</td>
        <td className="py-1 px-1.5 border-r border-black font-semibold text-slate-900">
          {subj.subjectName}
          {subj.subjectCode && subj.subjectCode !== subj.subjectName && (
            <span className="text-[10px] text-slate-500 font-normal ml-1.5">
              ({subj.subjectCode})
            </span>
          )}
        </td>
        <td className="py-1 px-1.5 text-center border-r border-black">{subj.hasUts === false ? "-" : kkm}</td>
        <td className="py-1 px-1.5 text-center border-r border-black">{scoreDisplay}</td>
        <td className="py-1 px-1.5 text-center text-[10.5px]">{statusDisplay}</td>
      </tr>
    );
  };

  return (
    <div
      className={`student-report-card bg-white text-black font-serif mx-auto border border-slate-300 print:border-none print:p-0 print:shadow-none print:min-h-0 print:w-full print:max-w-none ${
        isSinglePage ? "print:break-after-page" : ""
      }`}
      style={{
        width: "100%",
        maxWidth: paperSize === "F4" ? "215mm" : "210mm",
        minHeight: paperSize === "F4" ? "330mm" : "297mm",
        padding: "10mm 15mm",
        boxSizing: "border-box"
      }}
    >
      {/* 1. KOP SURAT RESMI (MENGIKUTI DESAIN GAMBAR ACUAN KEDUA) */}
      <div className="w-full pb-1.5 mb-2 rts-header-block print:break-inside-avoid">
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Logo Pondok Pesantren (KIRI) */}
          <div className="w-[22mm] sm:w-[24mm] shrink-0 flex items-center justify-center">
            {pesantrenLogoUrl ? (
              <img
                src={pesantrenLogoUrl}
                alt="Logo Pondok Pesantren"
                className="max-h-16 sm:max-h-20 max-w-[22mm] sm:max-w-[24mm] w-auto h-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : schoolLogoUrl ? (
              <div className="w-[22mm] sm:w-[24mm] shrink-0" />
            ) : null}
          </div>

          {/* Teks Identitas KOP (TENGAH) */}
          <div className="flex-1 text-center font-sans">
            {/* 1. Nama Pondok Pesantren (Paling Besar, Huruf Kapital, Tebal, ~17-19 pt, Hijau Gelap) */}
            <h1 className="text-[13pt] sm:text-[15pt] font-black uppercase tracking-wide text-[#064e3b] leading-tight">
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
            <h2 className="text-[11.5pt] sm:text-[13pt] font-black uppercase tracking-wide text-[#064e3b] mt-0.5 leading-tight">
              {schoolName}
            </h2>

            {/* 3. Keterangan Akreditasi (Tepat di bawah nama sekolah, Tebal, ~10-11 pt, Hijau Gelap) */}
            {accreditationText ? (
              <p className="text-[8.5pt] sm:text-[9.5pt] font-bold uppercase tracking-wider text-[#064e3b] mt-0.5 leading-tight">
                {accreditationText}
              </p>
            ) : null}

            {/* 4. Alamat Lengkap (~9-10 pt, Regular) */}
            <p className="text-[8pt] sm:text-[8.5pt] font-normal text-slate-800 mt-0.5 leading-tight">
              {kopAddress}
            </p>

            {/* 5. Call Center dan E-mail (~9-10 pt, Regular) */}
            {(kopPhone || kopEmail) ? (
              <p className="text-[7.5pt] sm:text-[8pt] font-normal text-slate-800 mt-0.5 leading-tight">
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
          <div className="w-[22mm] sm:w-[24mm] shrink-0 flex items-center justify-center">
            {schoolLogoUrl ? (
              <img
                src={schoolLogoUrl}
                alt="Logo Sekolah"
                className="max-h-16 sm:max-h-20 max-w-[22mm] sm:max-w-[24mm] w-auto h-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
            ) : pesantrenLogoUrl ? (
              <div className="w-[22mm] sm:w-[24mm] shrink-0" />
            ) : null}
          </div>
        </div>

        {/* 6. Garis Pembatas KOP (Dua Lapis Warna Hijau Gelap Sesuai Gambar Acuan) */}
        <div className="mt-1.5 w-full">
          <div className="border-b-[3px] border-[#064e3b] w-full" />
          <div className="border-b-[1.5px] border-[#064e3b] mt-[2px] w-full" />
        </div>
      </div>

      {/* 2. JUDUL RAPOR */}
      <div className="w-full text-center mb-2 rts-title-block print:break-inside-avoid">
        <h1 className="text-[12pt] sm:text-[13.5pt] font-extrabold tracking-wider uppercase underline leading-tight">
          <span>LAPORAN HASIL BELAJAR TENGAH SEMESTER</span>
          <br />
          <span className="whitespace-nowrap">(RAPOR BAYANGAN)</span>
        </h1>
        <p className="text-[9.5pt] font-sans font-semibold text-slate-800 mt-0.5 uppercase leading-tight">
          {isTerpadu
            ? "Mata Pelajaran Umum & Kepesantrenan / Diniyyah (Terpadu)"
            : isPondok
            ? "Mata Pelajaran Kepesantrenan & Diniyyah"
            : "Mata Pelajaran Umum (Kurikulum Merdeka)"}
        </p>
        <p className="text-[9pt] font-sans text-slate-600 mt-0.5 leading-tight">
          Tahun Pelajaran {displayAcademicYear} — {displaySemester}
        </p>
      </div>

      {/* 3. METADATA IDENTITAS SISWA (Hanya ditampilkan SATU kali) */}
      <div className="w-full grid grid-cols-2 gap-x-6 gap-y-0.5 text-[10.5px] font-sans mb-2 border border-black p-1.5 px-2.5 rounded-xs bg-slate-50/40 rts-identity-block print:break-inside-avoid">
        <div className="flex items-baseline">
          <span className="w-32 sm:w-36 text-slate-600 font-medium shrink-0">Nama Peserta Didik</span>
          <span className="font-bold truncate">: {student.studentName}</span>
        </div>
        <div className="flex items-baseline">
          <span className="w-28 sm:w-32 text-slate-600 font-medium shrink-0">Kelas / Rombel</span>
          <span className="font-bold truncate">: {context.className}</span>
        </div>
        <div className="flex items-baseline">
          <span className="w-32 sm:w-36 text-slate-600 font-medium shrink-0">NIS / NISN</span>
          <span className="truncate">
            : {student.nis || "-"} / {student.nisn || "-"}
          </span>
        </div>
        <div className="flex items-baseline">
          <span className="w-28 sm:w-32 text-slate-600 font-medium shrink-0">Wali Kelas</span>
          <span className="font-semibold truncate">: {homeroomTeacherName}</span>
        </div>
      </div>

      {/* 4. TABEL NILAI */}
      {isTerpadu ? (
        /* FORMAT TERPADU: BAGIAN A (UMUM) & BAGIAN B (PESANTREN / DINIYAH) */
        <div className="space-y-2 mb-2">
          {/* Bagian A — Mata Pelajaran Umum */}
          <div className="border border-black overflow-hidden print:break-inside-avoid">
            <div className="rts-section-heading bg-slate-100 border-b border-black px-2.5 py-0.5 font-sans font-bold text-[10.5px] uppercase tracking-wide text-slate-900 flex items-center justify-between">
              <span>Bagian A — Mata Pelajaran Umum</span>
              <span className="text-[9.5px] font-semibold text-slate-600">Kurikulum Merdeka</span>
            </div>
            <table className="w-full text-[10.5px] border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-black text-center font-bold">
                  <th className="py-1 px-1.5 border-r border-black w-9">No</th>
                  <th className="py-1 px-1.5 border-r border-black text-left min-w-[200px]">Mata Pelajaran</th>
                  <th className="py-1 px-1.5 border-r border-black w-14">KKM</th>
                  <th className="py-1 px-1.5 border-r border-black w-20">Nilai UTS</th>
                  <th className="py-1 px-1.5 w-28">Keterangan</th>
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
                      <td colSpan={5} className="py-0.5 px-2 uppercase text-[9.5px] text-slate-800">
                        Kelompok A — Muatan Nasional
                      </td>
                    </tr>
                    {groupA.map((subj, idx) => renderSubjectRow(subj, idx + 1))}

                    {groupB.length > 0 && (
                      <>
                        <tr className="bg-slate-100/70 border-b border-black font-bold">
                          <td colSpan={5} className="py-0.5 px-2 uppercase text-[9.5px] text-slate-800">
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
            <div className="rts-section-heading bg-slate-100 border-b border-black px-2.5 py-0.5 font-sans font-bold text-[10.5px] uppercase tracking-wide text-slate-900 flex items-center justify-between">
              <span>Bagian B — Mata Pelajaran Pesantren / Diniyyah</span>
              <span className="text-[9.5px] font-semibold text-slate-600">Madrasah Diniyah</span>
            </div>
            <table className="w-full text-[10.5px] border-collapse font-sans">
              <thead>
                <tr className="bg-slate-50 border-b border-black text-center font-bold">
                  <th className="py-1 px-1.5 border-r border-black w-9">No</th>
                  <th className="py-1 px-1.5 border-r border-black text-left min-w-[200px]">Mata Pelajaran</th>
                  <th className="py-1 px-1.5 border-r border-black w-14">KKM</th>
                  <th className="py-1 px-1.5 border-r border-black w-20">Nilai UTS</th>
                  <th className="py-1 px-1.5 w-28">Keterangan</th>
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
        <div className="border border-black overflow-hidden print:break-inside-avoid mb-2">
          <table className="w-full text-[10.5px] border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-black text-center font-bold">
                <th className="py-1 px-1.5 border-r border-black w-9">No</th>
                <th className="py-1 px-1.5 border-r border-black text-left min-w-[200px]">Mata Pelajaran</th>
                <th className="py-1 px-1.5 border-r border-black w-14">KKM</th>
                <th className="py-1 px-1.5 border-r border-black w-20">Nilai UTS</th>
                <th className="py-1 px-1.5 w-28">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {context.subjects.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-2.5 text-center text-slate-500 italic">
                    Belum ada data mata pelajaran untuk kelas ini.
                  </td>
                </tr>
              ) : hasGrouping ? (
                <>
                  {/* Kelompok A */}
                  <tr className="bg-slate-100/70 border-b border-black font-bold">
                    <td colSpan={5} className="py-0.5 px-2 uppercase text-[9.5px] text-slate-800">
                      A. Muatan Nasional / Umum
                    </td>
                  </tr>
                  {groupA.map((subj, idx) => renderSubjectRow(subj, idx + 1))}

                  {/* Kelompok B */}
                  <tr className="bg-slate-100/70 border-b border-black font-bold">
                    <td colSpan={5} className="py-0.5 px-2 uppercase text-[9.5px] text-slate-800">
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
      <div className="w-full border border-black p-1.5 px-2.5 rounded-xs font-sans text-[10px] mb-2 bg-slate-50/20 print:break-inside-avoid rts-evaluation-block">
        <h4 className="font-bold border-b border-black/30 pb-0.5 mb-0.5 text-slate-900">
          Catatan Evaluasi Tengah Semester:
        </h4>
        <p className="italic text-[9.5px] leading-snug text-slate-700">
          "Nilai yang tercantum dalam Rapor Bayangan ini merupakan hasil Penilaian Tengah Semester
          (UTS/STS) sebagai sarana evaluasi berkala capaian belajar peserta didik. Harap menjadi
          perhatian bersama antara pihak madrasah/sekolah dan Orang Tua / Wali Santri untuk terus
          memotivasi dan memantau perkembangan belajar."
        </p>
      </div>

      {/* 6. TANDA TANGAN RESMI (2 KOLOM SEJAJAR: WALI KELAS & KEPALA SEKOLAH DENGAN CAP) */}
      <div className="w-full text-xs font-sans pt-1 print:break-inside-avoid rts-signature-block">
        {/* Baris Tempat, Tanggal & Mengetahui (Sejajar di atas kolom kanan) */}
        <div className="grid grid-cols-2 gap-8 mb-0.5 w-full">
          <div /> {/* Spacer kolom kiri */}
          <div className="text-center">
            <p className="text-[10px] text-slate-800">{reportCity}, {reportDate}</p>
            <p className="text-[10px] text-slate-700 font-medium">Mengetahui,</p>
          </div>
        </div>

        {/* Baris Dua Kolom Penandatangan yang SEJAJAR SECARA VERTIKAL */}
        <div className="grid grid-cols-2 gap-8 text-center w-full">
          {/* Kolom 1: Wali Kelas */}
          <div className="flex flex-col justify-between h-28 sm:h-auto min-h-[116px] sm:min-h-[124px] rts-sign-col">
            <div>
              <p className="font-semibold text-[11px] text-slate-900 leading-tight">
                Wali Kelas {context.className.replace(/^Kelas\s+/i, "")}
              </p>
            </div>

            {/* Area Tanda Tangan Wali Kelas (Ukuran Adaptif & Proporsional) */}
            <div className="h-20 sm:h-22 min-h-[72px] sm:min-h-[80px] relative flex items-center justify-center my-0.5 rts-sig-area">
              {homeroomSignatureUrl ? (
                <img
                  src={homeroomSignatureUrl}
                  alt={`Tanda Tangan Wali Kelas ${context.className}`}
                  className="max-h-20 sm:max-h-22 max-w-[190px] sm:max-w-[210px] w-auto h-auto object-contain relative z-10 rts-homeroom-sig-img"
                />
              ) : (
                /* Ruang kosong yang cukup untuk tanda tangan manual setelah rapor dicetak */
                <div className="h-full w-full min-h-[68px]" />
              )}
            </div>

            <div>
              <p className="font-bold underline text-[11px] text-slate-900 leading-tight">{homeroomTeacherName}</p>
              {homeroomTeacherNiyFormatted ? (
                <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">{homeroomTeacherNiyFormatted}</p>
              ) : (
                <p className="text-[9.5px] text-slate-500 min-h-[14px] leading-tight mt-0.5">&nbsp;</p>
              )}
            </div>
          </div>

          {/* Kolom 2: Kepala Sekolah / Kepala Madrasah */}
          <div className="flex flex-col justify-between h-28 sm:h-auto min-h-[116px] sm:min-h-[124px] rts-sign-col">
            <div>
              <p className="font-semibold text-[11px] text-slate-900 leading-tight">
                {headmasterTitle}
              </p>
            </div>

            {/* Area Tanda Tangan & Cap Kepala Sekolah (Ukuran Adaptif & Proporsional) */}
            <div className="h-20 sm:h-22 min-h-[72px] sm:min-h-[80px] relative flex items-center justify-center my-0.5 rts-sig-area">
              {schoolStampUrl ? (
                <img
                  src={schoolStampUrl}
                  alt="Cap Sekolah"
                  className="absolute left-1/2 -translate-x-[68%] top-1/2 -translate-y-1/2 max-h-22 sm:max-h-24 max-w-[115px] sm:max-w-[125px] w-auto h-auto object-contain pointer-events-none opacity-85 z-0 rts-stamp-img"
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
                  className="relative z-10 max-h-20 sm:max-h-22 max-w-[190px] sm:max-w-[210px] w-auto h-auto object-contain rts-headmaster-sig-img"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              ) : (
                /* Ruang tanda tangan manual jika berkas gambar kepsek belum diunggah */
                <div className="h-full w-full min-h-[68px]" />
              )}
            </div>

            <div>
              <p className="font-bold underline text-[11px] text-slate-900 relative z-10 leading-tight">{headmasterName}</p>
              <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">{principalNipNiy}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

