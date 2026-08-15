export interface AppConfig {
  // Identitas Sekolah
  foundationName: string; // Nama Yayasan
  schoolName: string; // Nama Sekolah
  schoolAbbreviation: string; // Singkatan Sekolah
  logoUrl: string; // Logo Sekolah
  faviconUrl: string; // Favicon
  address: string; // Alamat
  village: string; // Desa/Kelurahan
  district: string; // Kecamatan
  regency: string; // Kabupaten/Kota
  province: string; // Provinsi
  postalCode: string; // Kode Pos
  phone: string; // Nomor Telepon
  whatsapp: string; // WhatsApp
  email: string; // Email
  website: string; // Website

  // Identitas Aplikasi
  name: string; // Nama Aplikasi (e.g. SIMAK)
  shortName: string;
  fullName: string; // Subjudul Aplikasi (e.g. Sistem Manajemen Akademik)
  tagline: string;
  version: string;
  buildNumber: string;
  buildDate: string;
  developer: string;
  developerNote: string;
  releaseYear: string;
  techStack: string[];
  themeColor: string;
  backgroundColor: string;
  copyright: string;

  // Identitas Kepala Sekolah
  principalName: string;
  principalDegree: string;
  principalNipNiy: string;
  principalSignatureUrl?: string;
  headmasterName?: string;
  headmasterSignatureUrl?: string;
}

export const APP_CONFIG: AppConfig = {
  // Identitas Sekolah Default
  foundationName: "Yayasan Alkarim Rasyid",
  schoolName: "SMP Alkarim Rasyid",
  schoolAbbreviation: "SMP AKR",
  logoUrl: "/logo.png",
  faviconUrl: "/favicon.ico",
  address: "Jl. Alkarim Rasyid No. 1",
  village: "Cibinong",
  district: "Cibinong",
  regency: "Kabupaten Bogor",
  province: "Jawa Barat",
  postalCode: "16911",
  phone: "(021) 1234567",
  whatsapp: "081234567890",
  email: "info@alkarimrasyid.sch.id",
  website: "https://alkarimrasyid.sch.id",

  // Identitas Aplikasi Default
  name: "SIMAK",
  shortName: "SIMAK",
  fullName: "Sistem Manajemen Akademik",
  tagline: "Sistem Manajemen Akademik Terintegrasi",
  version: "1.2.1",
  buildNumber: "103",
  buildDate: "2026-07-30",
  developer: "M. Rakhman Azizi, S.Pd., Gr.",
  developerNote: "Dikembangkan oleh M. Rakhman Azizi, S.Pd., Gr. dengan bantuan ChatGPT (OpenAI) dan Google AI Studio sebagai AI Development Assistant.",
  releaseYear: "2026",
  techStack: [
    "React",
    "TypeScript",
    "Vite",
    "Firebase",
    "Firestore",
    "Tailwind CSS",
    "Progressive Web App (PWA)"
  ],
  themeColor: "#4f46e5",
  backgroundColor: "#0f172a",
  copyright: "© 2026 SMP Alkarim Rasyid. All Rights Reserved.",

  // Identitas Kepala Sekolah Default
  principalName: "H. Abdullah",
  principalDegree: "M.Pd.",
  principalNipNiy: "NIY. 202001001",
  principalSignatureUrl: ""
};

export const getAppVersion = (): string => APP_CONFIG.version;
export const getAppConfig = (): AppConfig => APP_CONFIG;
