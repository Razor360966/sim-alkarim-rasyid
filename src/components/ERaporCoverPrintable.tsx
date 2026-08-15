import React from "react";
import { Student, Semester, AcademicYear } from "../types";
import { ERaporSettingsConfig } from "../types/eRapor.types";

interface ERaporCoverPrintableProps {
  students: Student[];
  className: string;
  academicYear: string;
  semester: string;
  reportType: "UMUM" | "PONDOK";
  printConfig?: ERaporSettingsConfig;
  schoolIdentity?: any;
}

export const ERaporCoverPrintable: React.FC<ERaporCoverPrintableProps> = ({
  students,
  className,
  academicYear,
  semester,
  reportType,
  printConfig,
  schoolIdentity
}) => {
  if (!students || students.length === 0) return null;

  const isPondok = reportType === "PONDOK";

  // Kop Header based on Report Type
  const genHeader = printConfig?.generalReportHeader || {
    institutionName: schoolIdentity?.schoolName || "SMP ALKARIM RASYID",
    subTitle: "Sekolah Menengah Pertama Alkarim Rasyid",
    address: schoolIdentity?.address || "Jl. Alkarim Rasyid No. 1, Cibinong, Kabupaten Bogor, Jawa Barat 16911",
    phone: schoolIdentity?.phone || "(021) 1234567",
    email: schoolIdentity?.email || "info@alkarimrasyid.sch.id",
    website: schoolIdentity?.website || "www.alkarimrasyid.sch.id"
  };

  const pesHeader = printConfig?.pesantrenReportHeader || {
    institutionName: "PONDOK PESANTREN ALKARIM RASYID",
    subTitle: "Madrasah Diniyah & Pengasuhan Kepesantrenan",
    address: schoolIdentity?.address || "Jl. Alkarim Rasyid No. 1, Cibinong, Kabupaten Bogor, Jawa Barat 16911",
    phone: "081234567890",
    email: "pesantren@alkarimrasyid.sch.id",
    website: schoolIdentity?.website || "www.alkarimrasyid.sch.id"
  };

  const headerConfig = isPondok ? pesHeader : genHeader;

  // Paper Config based on Report Type
  const paperConfig = isPondok
    ? (printConfig?.pesantrenReport || { paperSize: "F4", orientation: "portrait" })
    : (printConfig?.generalReport || { paperSize: "A4", orientation: "portrait" });

  const paperSizeStyle = paperConfig.paperSize === "F4" ? "215mm 330mm" : "A4";

  const headmasterName = printConfig?.headmasterName || schoolIdentity?.principalName || schoolIdentity?.headmasterName || "H. Abdullah, M.Pd.";
  const headmasterSignatureUrl = printConfig?.headmasterSignatureUrl || schoolIdentity?.principalSignatureUrl || schoolIdentity?.headmasterSignatureUrl || "";

  return (
    <div className="cover-printable-root">
      {/* Inject CSS page sizing rule for print */}
      <style>{`
        @media print {
          @page {
            size: ${paperSizeStyle} ${paperConfig.orientation};
            margin: 15mm 20mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .cover-page-break {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>

      {students.map((student, idx) => (
        <div
          key={student.id || idx}
          className="cover-page-break bg-white text-black font-serif p-8 max-w-3xl mx-auto border-4 border-double border-slate-800 print:border-4 print:border-double print:border-black min-h-[95vh] flex flex-col justify-between my-4 print:my-0 print:shadow-none shadow-md"
        >
          {/* Header Kop Resmi */}
          <div className="text-center border-b-2 border-slate-800 pb-4">
            <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
              {headerConfig.institutionName}
            </h1>
            <p className="text-xs font-sans font-semibold text-slate-700 mt-1">
              {headerConfig.subTitle}
            </p>
            <p className="text-[11px] font-sans text-slate-600 mt-0.5">
              {headerConfig.address}
            </p>
            <p className="text-[10px] font-sans text-slate-500 italic mt-0.5">
              Telp: {headerConfig.phone || "-"} | Email: {headerConfig.email || "-"} | Website: {headerConfig.website || "-"}
            </p>
          </div>

          {/* Main Title Section */}
          <div className="my-auto py-10 text-center space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-widest uppercase text-slate-900 border-y-2 border-slate-800 py-3 max-w-md mx-auto">
                {isPondok ? "RAPOR KEPESANTRENAN" : "RAPOR PESERTA DIDIK"}
              </h2>
              <p className="text-sm font-sans font-bold text-slate-700 uppercase tracking-wide">
                {isPondok ? "MADRASAH DINIYAH & PENGASUHAN" : "SEKOLAH MENENGAH PERTAMA"}
              </p>
            </div>

            {/* Student Info Box */}
            <div className="max-w-md mx-auto border-2 border-slate-800 p-6 rounded-none text-left space-y-4 font-sans bg-slate-50/50 print:bg-transparent">
              <div className="grid grid-cols-3 text-xs">
                <span className="font-semibold text-slate-600">Nama Siswa</span>
                <span className="col-span-2 font-bold text-slate-900 uppercase">: {student.name}</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="font-semibold text-slate-600">NIS / NISN</span>
                <span className="col-span-2 font-bold text-slate-900">: {student.nis || "-"} / {student.nisn || "-"}</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="font-semibold text-slate-600">Kelas</span>
                <span className="col-span-2 font-bold text-slate-900">: {className}</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="font-semibold text-slate-600">Tahun Ajaran</span>
                <span className="col-span-2 font-bold text-slate-900">: {academicYear}</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="font-semibold text-slate-600">Semester</span>
                <span className="col-span-2 font-bold text-slate-900">: {semester}</span>
              </div>
            </div>
          </div>

          {/* Bottom Footer / Headmaster Section */}
          <div className="pt-6 border-t border-slate-300 flex justify-between items-end text-xs font-sans">
            <div>
              <p className="text-[10px] text-slate-400">
                Dokumen Resmi e-Rapor SIMAK SMP Alkarim Rasyid
              </p>
              <p className="text-[10px] text-slate-400 italic">
                {isPondok ? "Kop: Kepesantrenan" : "Kop: Kurikulum Umum"} ({paperConfig.paperSize})
              </p>
            </div>

            <div className="text-center min-w-[200px]">
              <p>Cibinong, {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="font-bold mt-1">Kepala Sekolah,</p>
              
              {headmasterSignatureUrl ? (
                <div className="h-16 flex items-center justify-center my-1">
                  <img
                    src={headmasterSignatureUrl}
                    alt="TTD Kepsek"
                    className="max-h-16 object-contain"
                  />
                </div>
              ) : (
                <div className="h-16"></div>
              )}

              <p className="font-bold underline text-slate-900">{headmasterName}</p>
              <p className="text-[10px] text-slate-500">NIY. 202001001</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
