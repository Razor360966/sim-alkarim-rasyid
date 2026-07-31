import React from "react";
import { WifiOff, AlertTriangle } from "lucide-react";
import { usePwa } from "../contexts/PwaContext";

export const OfflineBanner: React.FC = () => {
  const { isOnline } = usePwa();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-xs flex items-center justify-center gap-2 shadow-md shrink-0 sticky top-0 z-[90] animate-pulse">
      <WifiOff className="w-4 h-4" />
      <span>🔴 Anda sedang offline. Beberapa fitur Firestore/Server memerlukan koneksi internet.</span>
    </div>
  );
};

export default OfflineBanner;
