import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, X, Download, School, Info, QrCode } from "lucide-react";
import { classService } from "../services/classService";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { Class } from "../types";

interface ClassQrCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ClassQrCardsModal: React.FC<ClassQrCardsModalProps> = ({ isOpen, onClose }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [schoolName, setSchoolName] = useState("SMP ISLAM TERPADU");
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [classList, settings] = await Promise.all([
          classService.getClasses(),
          schoolSettingsService.getSettings()
        ]);
        setClasses(classList);
        if (settings && (settings as any).schoolName) {
          setSchoolName((settings as any).schoolName);
        }
      } catch (err) {
        console.error("Error loading classes for QR:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Kartu QR Code Kelas Permanen</h2>
              <p className="text-xs text-slate-300">
                Cetak dan tempel QR Code di setiap meja guru / ruang kelas untuk Teaching Check-in
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || classes.length === 0}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Semua QR Kelas</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 print:hidden shrink-0">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Info Penggunaan QR Code Kelas:</strong>
            <p className="mt-0.5">
              QR Code di bawah ini bersifat <strong>statis per kelas</strong> dan tidak perlu diganti tiap semester.
              Guru cukup login dengan akun masing-masing dan memindai QR Code di kelas saat hendak mengajar (Check In) dan saat selesai (Check Out).
            </p>
          </div>
        </div>

        {/* Printable Grid Content */}
        <div className="p-6 overflow-y-auto flex-1 print:p-0 print:overflow-visible" ref={printRef}>
          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-zinc-400 text-sm">
              Memuat data kelas...
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-zinc-400 text-sm">
              Belum ada data kelas terdaftar. Silakan tambahkan kelas terlebih dahulu.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:p-2">
              {classes.map((cls) => {
                const qrValue = JSON.stringify({
                  type: "SCHOOL_CLASS_QR",
                  classId: cls.id,
                  className: cls.name,
                  roomCode: cls.roomCode || ""
                });

                return (
                  <div
                    key={cls.id || cls.name}
                    className="bg-white text-slate-900 border-2 border-slate-900 rounded-2xl p-6 flex flex-col items-center justify-between text-center shadow-lg print:break-inside-avoid print:shadow-none print:border-2"
                  >
                    {/* Card Header */}
                    <div className="w-full pb-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-700 text-left">
                        <School className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{schoolName}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-full uppercase">
                        {cls.gradeLevel || "KELAS"}
                      </span>
                    </div>

                    {/* Class Name Banner */}
                    <div className="my-4">
                      <h3 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
                        {cls.name}
                      </h3>
                      {cls.roomCode && (
                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                          Ruang: {cls.roomCode}
                        </p>
                      )}
                    </div>

                    {/* QR Code Container */}
                    <div className="p-4 bg-white border-2 border-slate-900 rounded-xl shadow-inner my-2 flex items-center justify-center">
                      <QRCodeSVG
                        value={qrValue}
                        size={160}
                        level="H"
                        includeMargin={false}
                      />
                    </div>

                    {/* Footer instructions */}
                    <div className="w-full pt-3 border-t border-slate-200 mt-2 text-[10px] text-slate-600 space-y-0.5">
                      <p className="font-bold text-slate-800">PETUNJUK CHECK-IN / CHECK-OUT</p>
                      <p>1. Buka Menu <strong>Scan QR Mengajar</strong> di HP/Laptop</p>
                      <p>2. Arahkan Kamera ke QR Code ini untuk <strong>Check In / Check Out</strong></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
