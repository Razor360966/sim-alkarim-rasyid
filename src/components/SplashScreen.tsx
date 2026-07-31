import React, { useState, useEffect } from "react";
import { School, Sparkles } from "lucide-react";
import { APP_CONFIG } from "../config/appVersion";
import { motion, AnimatePresence } from "motion/react";

interface SplashScreenProps {
  onFinish?: () => void;
  durationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  durationMs = 1800
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onFinish) onFinish();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-slate-950 px-6 py-10 text-white select-none"
        >
          {/* Top spacer */}
          <div className="w-full" />

          {/* Center Brand */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center text-center space-y-5"
          >
            <div className="relative flex items-center justify-center">
              <div className="h-20 w-20 rounded-3xl bg-indigo-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40 border border-indigo-400/30">
                <School className="h-10 w-10 animate-pulse" />
              </div>
              <div className="absolute -top-2 -right-2 p-1.5 bg-amber-400 text-slate-950 rounded-xl shadow-md">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h1 className="text-3xl font-black tracking-tight text-white">
                {APP_CONFIG.name}
              </h1>
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest">
                {APP_CONFIG.fullName}
              </p>
              <p className="text-[11px] text-slate-400 font-medium">
                {APP_CONFIG.schoolName}
              </p>
            </div>

            {/* Loading Indicator */}
            <div className="pt-6 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" />
            </div>
          </motion.div>

          {/* Footer Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center text-center space-y-1 text-slate-500 text-xs font-medium"
          >
            <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[11px] font-mono text-indigo-400 font-bold">
              Versi {APP_CONFIG.version}
            </div>
            <p className="text-[10px] text-slate-600 mt-1">{APP_CONFIG.copyright}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
