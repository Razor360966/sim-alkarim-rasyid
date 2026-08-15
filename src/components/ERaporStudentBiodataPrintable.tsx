import React from "react";
import { Student } from "../types";

interface ERaporStudentBiodataPrintableProps {
  students: Student[];
  className?: string;
  paperSize?: "A4" | "F4";
  orientation?: "portrait" | "landscape";
  schoolIdentity?: any;
  headmasterName?: string;
  headmasterSignatureUrl?: string;
  printDate?: string;
}

export const ERaporStudentBiodataPrintable: React.FC<ERaporStudentBiodataPrintableProps> = ({
  students,
  className = "",
  paperSize = "A4",
  orientation = "portrait",
  schoolIdentity,
  headmasterName = "H. Abdullah, M.Pd.",
  headmasterSignatureUrl = "",
  printDate = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}) => {
  if (!students || students.length === 0) return null;

  const paperSizeStyle = paperSize === "F4" ? "215mm 330mm" : "A4";

  return (
    <div className="biodata-printable-root">
      <style>{`
        @media print {
          @page {
            size: ${paperSizeStyle} ${orientation};
            margin: 12mm 15mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .biodata-page-break {
            page-break-after: always;
            break-after: page;
          }
        }
      `}</style>

      {students.map((student, idx) => (
        <div
          key={student.id || idx}
          className="biodata-page-break bg-white text-black font-serif p-6 max-w-4xl mx-auto border border-slate-300 print:border-none my-4 print:my-0 shadow-sm print:shadow-none min-h-[90vh] flex flex-col justify-between"
        >
          <div>
            {/* Header Title */}
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
              <h1 className="text-lg font-bold uppercase tracking-wide text-slate-900">
                {schoolIdentity?.schoolName || "SMP ALKARIM RASYID"}
              </h1>
              <h2 className="text-xl font-extrabold tracking-wider uppercase text-slate-900 mt-1">
                LEMBAR BIODATA PESERTA DIDIK
              </h2>
              <p className="text-xs font-sans text-slate-600 mt-0.5">
                Alamat: {schoolIdentity?.address || "Jl. Alkarim Rasyid No. 1, Cibinong, Kabupaten Bogor, Jawa Barat"}
              </p>
            </div>

            {/* Top Row: Photo & Fast Identity Badge */}
            <div className="flex justify-between items-start gap-6 mb-6">
              <div className="flex-1 font-sans text-xs space-y-1 bg-slate-50 dark:bg-zinc-900/50 p-3 rounded border border-slate-200">
                <p><span className="font-semibold text-slate-600">Nama Siswa</span> : <strong className="text-slate-900 font-bold uppercase">{student.name}</strong></p>
                <p><span className="font-semibold text-slate-600">NIS / NISN</span> : <strong>{student.nis || "-"} / {student.nisn || "-"}</strong></p>
                <p><span className="font-semibold text-slate-600">Kelas</span> : <strong>{className || student.className || "-"}</strong></p>
              </div>

              {/* Student Photo Placeholder / Image */}
              <div className="w-28 h-36 border-2 border-slate-400 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-center p-2 rounded shadow-inner flex-shrink-0">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt={student.name}
                    className="w-full h-full object-cover rounded-sm"
                  />
                ) : (
                  <div className="text-[10px] text-slate-400 font-sans">
                    <p className="font-bold">PAS FOTO</p>
                    <p>3 x 4</p>
                  </div>
                )}
              </div>
            </div>

            {/* Section A: IDENTITAS PESERTA DIDIK */}
            <div className="mb-5 space-y-2">
              <h3 className="text-xs font-bold font-sans uppercase tracking-wider bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-3 py-1 border-l-4 border-slate-800">
                A. IDENTITAS PESERTA DIDIK
              </h3>

              <table className="w-full text-xs font-sans border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 w-8 font-bold">1.</td>
                    <td className="py-1.5 px-2 w-48 font-medium text-slate-700">Nama Lengkap Siswa</td>
                    <td className="py-1.5 px-2 font-bold uppercase">{student.name}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">2.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Nomor Induk Siswa (NIS)</td>
                    <td className="py-1.5 px-2">{student.nis || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">3.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">NISN</td>
                    <td className="py-1.5 px-2">{student.nisn || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">4.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">NIK (Nomor Induk Kependudukan)</td>
                    <td className="py-1.5 px-2">{student.nik || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">5.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Jenis Kelamin</td>
                    <td className="py-1.5 px-2">{student.gender || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">6.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Tempat, Tanggal Lahir</td>
                    <td className="py-1.5 px-2">
                      {student.birthPlace || student.birthDate ? (
                        `${student.birthPlace || "-"}, ${student.birthDate || "-"}`
                      ) : (
                        <span className="text-slate-400 italic">Belum diisi</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">7.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Agama</td>
                    <td className="py-1.5 px-2">{student.religion || "Islam"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section B: DATA ORANG TUA / WALI */}
            <div className="mb-5 space-y-2">
              <h3 className="text-xs font-bold font-sans uppercase tracking-wider bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-3 py-1 border-l-4 border-slate-800">
                B. DATA ORANG TUA / WALI
              </h3>

              <table className="w-full text-xs font-sans border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 w-8 font-bold">1.</td>
                    <td className="py-1.5 px-2 w-48 font-medium text-slate-700">Nama Ayah Kandung</td>
                    <td className="py-1.5 px-2">{student.fatherName || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">2.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Nama Ibu Kandung</td>
                    <td className="py-1.5 px-2">{student.motherName || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">3.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Nama Wali (jika ada)</td>
                    <td className="py-1.5 px-2">{student.guardianName || "-"}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">4.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">No. Kontak HP Orang Tua/Wali</td>
                    <td className="py-1.5 px-2">{student.parentPhone || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section C: ALAMAT PESERTA DIDIK */}
            <div className="mb-5 space-y-2">
              <h3 className="text-xs font-bold font-sans uppercase tracking-wider bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 px-3 py-1 border-l-4 border-slate-800">
                C. ALAMAT TEMPAT TINGGAL
              </h3>

              <table className="w-full text-xs font-sans border-collapse">
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 w-8 font-bold">1.</td>
                    <td className="py-1.5 px-2 w-48 font-medium text-slate-700">Alamat Jalan / RT / RW</td>
                    <td className="py-1.5 px-2">{student.address || <span className="text-slate-400 italic">Belum diisi</span>}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">2.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Desa / Kelurahan</td>
                    <td className="py-1.5 px-2">{student.village || "-"}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">3.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Kecamatan</td>
                    <td className="py-1.5 px-2">{student.district || "-"}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">4.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Kabupaten / Kota</td>
                    <td className="py-1.5 px-2">{student.city || "-"}</td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-1.5 px-2 font-bold">5.</td>
                    <td className="py-1.5 px-2 font-medium text-slate-700">Provinsi</td>
                    <td className="py-1.5 px-2">{student.province || "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Signatures */}
          <div className="pt-6 mt-6 border-t border-slate-300 grid grid-cols-2 text-xs font-sans text-center">
            <div>
              <p>Mengetahui,</p>
              <p className="font-semibold mb-16">Orang Tua / Wali Siswa</p>
              <p className="font-bold underline">
                ( {student.fatherName || student.motherName || student.guardianName || "...................................."} )
              </p>
            </div>

            <div>
              <p>Cibinong, {printDate}</p>
              <p className="font-semibold mb-1">Kepala Sekolah,</p>

              {headmasterSignatureUrl ? (
                <div className="h-14 flex items-center justify-center my-1">
                  <img
                    src={headmasterSignatureUrl}
                    alt="TTD Kepsek"
                    className="max-h-14 object-contain"
                  />
                </div>
              ) : (
                <div className="h-14"></div>
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
