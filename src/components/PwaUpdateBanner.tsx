import React from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { usePwa } from "../contexts/PwaContext";
import { APP_CONFIG } from "../config/appVersion";

export const PwaUpdateBanner: React.FC = () => {
  const { updateAvailable, applyUpdate } = usePwa();
  const [dismissed, setDismissed] = React.useState(false);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="bg-indigo-600 text-white px-4 py-2.5 text-xs font-bold flex flex-col sm:flex-row items-center justify-between gap-2 shadow-lg shrink-0 sticky top-0 z-[100] border-b border-indigo-400">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
        <span>Versi baru SIMAK ({APP_CONFIG.version}) telah tersedia! Klik perbarui untuk memuat fitur terbaru.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={applyUpdate}
          className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Perbarui Sekarang</span>
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-indigo-200 hover:text-white rounded-md cursor-pointer"
          title="Tutup Notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PwaUpdateBanner;
