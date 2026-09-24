import React, { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, X, ShieldAlert, School, Info, QrCode } from "lucide-react";
import { useSchoolIdentity } from "../contexts/SchoolIdentityContext";

interface OfficeBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OfficeBarcodeModal: React.FC<OfficeBarcodeModalProps> = ({ isOpen, onClose }) => {
  const { identity } = useSchoolIdentity();
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const targetUrl = typeof window !== "undefined"
    ? `${window.location.origin}/assisted-check-in`
    : "/assisted-check-in";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Modal Header (Hidden on print) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Cetak Barcode Resmi Assisted Check-In</h2>
              <p className="text-xs text-slate-300">
                1 Barcode khusus untuk ditempel di kantor sekolah
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              Cetak / Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Card Area */}
        <div className="p-6 md:p-8 overflow-y-auto max-h-[80vh] flex justify-center bg-slate-50 dark:bg-zinc-950 print:bg-white print:p-0">
          <div
            ref={printRef}
            className="w-full max-w-md bg-white border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col items-center text-center relative print:shadow-none print:border-2 print:border-black print:rounded-2xl"
          >
            {/* Header Badge */}
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider mb-4">
              <School className="w-3.5 h-3.5 text-emerald-600" />
              <span>TERMINAL KANTOR SEKOLAH</span>
            </div>

            {/* School Identity */}
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1">
              {identity.fullName || identity.schoolName || "SMP IT AL-KARIM RASYID"}
            </h1>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">
              SISTEM INFORMASI MANAJEMEN AKADEMIK (SIMAK)
            </p>

            {/* QR Frame */}
            <div className="p-5 bg-white border-2 border-dashed border-slate-300 rounded-2xl shadow-inner mb-4 flex flex-col items-center">
              <QRCodeSVG
                value={targetUrl}
                size={220}
                level="H"
                includeMargin={true}
                className="w-48 h-48 sm:w-56 sm:h-56"
              />
              <span className="text-[11px] font-mono font-semibold text-slate-500 mt-2 bg-slate-100 px-2 py-0.5 rounded">
                /assisted-check-in
              </span>
            </div>

            {/* Title & Description */}
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1">
              BARCODE ASSISTED CHECK-IN
            </h2>
            <p className="text-xs text-slate-600 font-medium mb-4 max-w-xs">
              Digunakan khusus oleh guru yang tidak membawa HP untuk melakukan absensi mengajar resmi di kantor.
            </p>

            {/* Steps Instruction */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-left text-xs space-y-1.5 mb-4 text-slate-700">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Petunjuk Penggunaan:</span>
              </div>
              <p className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-600">1.</span>
                <span>Scan barcode ini menggunakan terminal / perangkat kantor.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-600">2.</span>
                <span>Masukkan akun SIMAK Anda untuk verifikasi identitas guru.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="font-bold text-indigo-600">3.</span>
                <span>Pilih sesi mengajar Anda hari ini dan tekan <strong>Check-In</strong>.</span>
              </p>
            </div>

            {/* Fixed Warning */}
            <div className="w-full border-t border-slate-200 pt-3 flex items-center justify-center gap-2 text-[11px] text-amber-800 font-semibold">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Inventaris Tetap Kantor — Dilarang Dibawa Pulang</span>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-zinc-800/80 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500 shrink-0 print:hidden">
          <span>Target URL: <code className="bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border">{targetUrl}</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
