import React, { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, X, School, Info, QrCode, BookOpen } from "lucide-react";
import { halaqahGroupService } from "../services/halaqahGroupService";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { HalaqahGroup } from "../types";

interface HalaqahGroupQrCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HalaqahGroupQrCardsModal: React.FC<HalaqahGroupQrCardsModalProps> = ({ isOpen, onClose }) => {
  const [groups, setGroups] = useState<HalaqahGroup[]>([]);
  const [schoolName, setSchoolName] = useState("SMP ALKARIM RASYID");
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [groupList, settings] = await Promise.all([
          halaqahGroupService.getGroups(),
          schoolSettingsService.getSettings()
        ]);
        setGroups(groupList);
        if (settings && (settings as any).schoolName) {
          setSchoolName((settings as any).schoolName);
        }
      } catch (err) {
        console.error("Error loading halaqah groups for QR:", err);
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
        <div className="px-6 py-5 bg-teal-950 text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-500/20 text-teal-400 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Kartu QR Code Permanen Group Halaqah</h2>
              <p className="text-xs text-teal-200">
                Cetak dan tempel QR Code di halaqah / masjid / asrama untuk Absensi Pembimbing Halaqah
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading || groups.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Semua QR Group</span>
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
        <div className="p-4 bg-teal-50 dark:bg-teal-950/40 border-b border-teal-200 dark:border-teal-900/60 flex items-start gap-3 text-xs text-teal-900 dark:text-teal-200 print:hidden shrink-0">
          <Info className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div>
            <strong>Prinsip QR Code Group Halaqah Permanen:</strong>
            <p className="mt-0.5">
              QR Code mewakili <strong>Group Halaqah</strong> (misal: Group Al Fatih, Group Al Baqarah, Ali Imran, An Nisa), bukan guru atau jadwal. 
              Apabila terjadi pergantian Ustadz/Guru pembimbing, Admin cukup mengubah penugasan pada Master Jadwal Halaqah tanpa perlu mencetak ulang QR Code.
            </p>
          </div>
        </div>

        {/* Printable Grid Content */}
        <div className="p-6 overflow-y-auto flex-1 print:p-0 print:overflow-visible" ref={printRef}>
          {loading ? (
            <div className="text-center py-12 text-slate-500 dark:text-zinc-400 text-sm">
              Memuat data Group Halaqah...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-zinc-400 text-sm">
              Belum ada Group Halaqah terdaftar dalam sistem.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:w-full">
              {groups.map((group) => {
                const qrPayload = JSON.stringify({
                  type: "halaqah",
                  groupId: group.id,
                  groupName: group.groupName
                });

                return (
                  <div
                    key={group.id}
                    className="border-2 border-teal-600/40 rounded-3xl p-6 bg-gradient-to-br from-teal-50/50 via-white to-emerald-50/30 dark:from-zinc-900 dark:to-zinc-850 flex flex-col items-center justify-between shadow-sm relative overflow-hidden print:border-2 print:border-black print:break-inside-avoid print:bg-white print:shadow-none print:p-4"
                  >
                    <div className="w-full text-center border-b border-teal-200 dark:border-teal-900/40 pb-3 mb-4 print:border-black">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-widest">
                        <School className="w-3.5 h-3.5" />
                        <span>{schoolName}</span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                        {group.groupName || `GROUP HALAQAH ${group.id}`}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Pembimbing Utama: {group.musrifName || "Ustadz Pembimbing"}
                      </p>
                    </div>

                    <div className="p-4 bg-white dark:bg-zinc-950 rounded-2xl border-2 border-teal-500/30 shadow-inner my-2 flex items-center justify-center print:border-black">
                      <QRCodeSVG
                        value={qrPayload}
                        size={180}
                        level="H"
                        includeMargin={true}
                      />
                    </div>

                    <div className="w-full text-center mt-4 pt-3 border-t border-teal-200 dark:border-teal-900/40 text-[10px] text-slate-500 dark:text-zinc-400 space-y-1 print:border-black">
                      <p className="font-bold text-teal-800 dark:text-teal-300">
                        STASIUN ABSENSI HALAQAH QUR'AN
                      </p>
                      <p className="text-[9px]">
                        Guru Pembimbing melakukan Scan QR saat memulainya (Check In) & mengakhirinya (Check Out)
                      </p>
                      <span className="inline-block px-2 py-0.5 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-mono text-[9px] rounded-md font-bold mt-1">
                        TYPE: HALAQAH | ID: {group.id}
                      </span>
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
