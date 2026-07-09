import React, { useState } from "react";
import { AlertCircle, FileKey, Copy, Check } from "lucide-react";

export const FirebaseConfigWarning: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const exampleEnvText = `VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_project_id_here
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket_here
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here
VITE_FIREBASE_FIRESTORE_DATABASE_ID=your_firestore_database_id_here`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(exampleEnvText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-6 font-sans">
      <div className="max-w-xl w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg p-8">
        <div className="flex items-center gap-4 border-b border-slate-100 dark:border-zinc-800 pb-5 mb-6">
          <div className="h-12 w-12 bg-amber-50 dark:bg-amber-950/30 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 animate-pulse">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 dark:text-zinc-100">Konfigurasi Firebase Belum Siap</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Environment Variable Required</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
          <p>
            Aplikasi ini didesain untuk membaca konfigurasi Firebase secara dinamis dari file <code>.env</code> Anda menggunakan <strong>environment variables</strong>. Saat ini, variabel yang diperlukan belum terdeteksi.
          </p>

          <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-lg p-4 border border-slate-150 dark:border-zinc-800">
            <h2 className="text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileKey className="h-4 w-4 text-slate-500" /> Langkah Penyelesaian:
            </h2>
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
              <li>Salin file <code>.env.example</code> menjadi <code>.env</code> di root direktori proyek.</li>
              <li>Isi nilai variabel di file <code>.env</code> dengan kredensial dari konsol Firebase Anda.</li>
              <li>Muat ulang server pengembangan jika perubahan belum diterapkan secara otomatis.</li>
            </ol>
          </div>

          <div className="relative">
            <div className="flex items-center justify-between bg-slate-900 dark:bg-zinc-950 text-slate-400 dark:text-zinc-500 px-4 py-2 rounded-t-lg text-xs font-mono border border-b-0 border-slate-800">
              <span>.env.example</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 hover:text-white dark:hover:text-zinc-200 transition-colors cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Tersalin!" : "Salin Templat"}
              </button>
            </div>
            <pre className="bg-slate-950 dark:bg-zinc-950/80 text-slate-300 dark:text-zinc-400 p-4 rounded-b-lg text-xs font-mono overflow-x-auto border border-t-0 border-slate-800">
              {exampleEnvText}
            </pre>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-zinc-500 italic text-center pt-2">
            Catatan: Pastikan untuk menggunakan awalan <code>VITE_</code> agar variabel-variabel tersebut diekspos ke sisi klien aplikasi.
          </div>
        </div>
      </div>
    </div>
  );
};
