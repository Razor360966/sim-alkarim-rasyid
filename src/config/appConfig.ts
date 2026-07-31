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
}

export const APP_CONFIG: AppConfig = {
  // Identitas Sekolah Default
  foundationName: "Yayasan Alkarim Rasyid Indonesia",
  schoolName: "SMP Alkarim Rasyid",
  schoolAbbreviation: "SMP AKR",
  logoUrl: "/logo.png",
  faviconUrl: "/favicon.ico",
  address: "Ds. Sukabanjar, Kec. Gedong Tataan, Kab. Pesawaran",
  village: "Sukabanjar",
  district: "Gedong Tataan",
  regency: "Kabupaten Pesawaran",
  province: "Lampung",
  postalCode: "-",
  phone: "-",
  whatsapp: "-",
  email: "-",
  website: "-",

  // Identitas Aplikasi Default
  name: "SIMAK",
  shortName: "SIMAK",
  fullName: "Sistem Manajemen Akademik",
  tagline: "Sistem Manajemen Akademik Terintegrasi",
  version: "1.2.1",
  buildNumber: "103",
  buildDate: "2026-07-30",
  developer: "M. Rakhman Azizi, S.Pd., Gr.",
  developerNote: "Developed by M. Rakhman Azizi, S.Pd., Gr., with the support of Artificial Intelligence technologies powered by ChatGPT (OpenAI) and Google AI Studio.",
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
  principalName: "Samhari",
  principalDegree: "S.Sos",
  principalNipNiy: "NIY",
  principalSignatureUrl: ""
};

export const getAppVersion = (): string => APP_CONFIG.version;
export const getAppConfig = (): AppConfig => APP_CONFIG;
