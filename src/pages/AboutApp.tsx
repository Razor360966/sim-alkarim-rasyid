import React, { useState } from "react";
import { School, Sparkles, Download, RefreshCw, Code2, Info, UserCheck, HeartHandshake, Layers, MapPin, Phone, Mail, Globe, User } from "lucide-react";
import { useSchoolIdentity } from "../contexts/SchoolIdentityContext";
import { usePwa } from "../contexts/PwaContext";

export const AboutApp: React.FC = () => {
  const { identity } = useSchoolIdentity();
  const { installable, installApp, applyUpdate, updateAvailable } = usePwa();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-zinc-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-indigo-800/40">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl shrink-0 h-20 w-20 flex items-center justify-center">
            {!imgError && identity.logoUrl ? (
              <img
                src={identity.logoUrl}
                alt={identity.schoolName}
                className="h-full w-full object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <School className="w-10 h-10 text-indigo-300" />
            )}
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Progressive Web App (PWA)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {identity.name} – {identity.schoolName}
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200 font-semibold">
              {identity.fullName}
            </p>
            <p className="text-[11px] text-slate-300 font-medium italic">
              "{identity.tagline}"
            </p>
          </div>
        </div>
      </div>

      {/* Identitas Sekolah & Yayasan Card */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
            <School className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
              Identitas Sekolah & Yayasan
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Sumber Data Utama (Single Source of Truth)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-semibold">
              <School className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{identity.schoolName} ({identity.schoolAbbreviation})</span>
            </div>
            <div className="text-slate-500 dark:text-zinc-400 pl-6 text-[11px]">
              Naungan: {identity.foundationName}
            </div>
            <div className="flex items-start gap-2 text-slate-600 dark:text-zinc-400 pl-1 pt-1">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>{identity.address}, Desa/Kel. {identity.village}, Kec. {identity.district}, {identity.regency}, {identity.province} {identity.postalCode}</span>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
              <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Telp: {identity.phone} | WA: {identity.whatsapp}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
              <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Email: {identity.email}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
              <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Website: {identity.website}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300 font-semibold pt-1">
              <User className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Kepala Sekolah: {identity.principalName}, {identity.principalDegree} ({identity.principalNipNiy})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Card 1: Informasi Versi & Status Aplikasi */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                Informasi Versi & Sistem
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Identitas resmi dan versi aplikasi
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-850">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Versi Aplikasi</span>
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                v{identity.version} (Build {identity.buildNumber})
              </span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-850">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Tanggal Build</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{identity.buildDate}</span>
            </div>

            <div className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-zinc-850">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Pengembang Utama</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{identity.developer}</span>
            </div>

            <div className="flex justify-between items-center py-1.5">
              <span className="text-slate-500 dark:text-zinc-400 font-medium">Institusi Sekolah</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200">{identity.schoolName}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            {installable && (
              <button
                type="button"
                onClick={installApp}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Install Aplikasi SIMAK</span>
              </button>
            )}

            <button
              type="button"
              onClick={applyUpdate}
              className="flex-1 py-2.5 bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{updateAvailable ? "Perbarui Sekarang" : "Cek / Muat Ulang Versi"}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Pengembang & Developer Note */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-2xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100">
                Pengembang Aplikasi
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Tim dan asisten pengembang sistem
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl text-xs space-y-2">
            <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
              <HeartHandshake className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Developer Credit & AI Assistant</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-700 dark:text-zinc-300 font-medium">
              {identity.developerNote}
            </p>
          </div>

          <div className="pt-2">
            <h4 className="text-xs font-extrabold text-slate-900 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Teknologi Utama</span>
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {identity.techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-bold rounded-lg border border-slate-200 dark:border-zinc-700 flex items-center gap-1"
                >
                  <Code2 className="w-3 h-3 text-emerald-500" />
                  <span>{tech}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Copyright */}
      <div className="text-center pt-4 text-xs text-slate-400 dark:text-zinc-500 space-y-1">
        <p className="font-semibold text-slate-600 dark:text-zinc-400">{identity.copyright}</p>
      </div>
    </div>
  );
};

export default AboutApp;
