import React from "react";
import { Link } from "react-router-dom";
import { School, HelpCircle, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

export const NotFound: React.FC = () => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
      <div className="text-center max-w-md px-4 flex flex-col items-center space-y-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md mb-2">
            <School className="h-6 w-6" />
          </div>
          <p className="text-[10px] text-gray-400 font-extrabold tracking-widest uppercase">SMP Alkarim Rasyid</p>
        </div>

        {/* 404 Visual Icon */}
        <div className="relative">
          <h1 className="text-8xl font-black text-gray-200 dark:text-zinc-800 tracking-tight select-none">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <HelpCircle className="h-12 w-12 text-blue-500 animate-bounce" />
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Halaman Tidak Ditemukan
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
            Maaf, halaman yang Anda cari tidak tersedia atau dipindahkan ke alamat lain.
          </p>
        </div>

        {/* Action Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
