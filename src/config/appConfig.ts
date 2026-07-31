export interface AppConfig {
  name: string;
  shortName: string;
  fullName: string;
  schoolName: string;
  tagline: string;
  version: string;
  buildNumber: string;
  buildDate: string;
  developer: string;
  developerNote: string;
  techStack: string[];
  website?: string;
  email?: string;
  themeColor: string;
  backgroundColor: string;
  copyright: string;
}

export const APP_CONFIG: AppConfig = {
  name: "SIMAK",
  shortName: "SIMAK",
  fullName: "Sistem Manajemen Akademik",
  schoolName: "SMP Alkarim Rasyid",
  tagline: "Sistem Manajemen Akademik Terintegrasi",
  version: "1.2.1",
  buildNumber: "103",
  buildDate: "2026-07-30",
  developer: "M. Rakhman Azizi, S.Pd., Gr.",
  developerNote: "Dikembangkan oleh M. Rakhman Azizi, S.Pd., Gr. dengan bantuan ChatGPT (OpenAI) dan Google AI Studio sebagai AI Development Assistant.",
  techStack: [
    "React",
    "TypeScript",
    "Vite",
    "Firebase",
    "Firestore",
    "Tailwind CSS",
    "Progressive Web App (PWA)"
  ],
  website: "https://alkarimrasyid.sch.id",
  email: "info@alkarimrasyid.sch.id",
  themeColor: "#4f46e5",
  backgroundColor: "#0f172a",
  copyright: "© 2026 SMP Alkarim Rasyid. All Rights Reserved."
};

export const getAppVersion = (): string => APP_CONFIG.version;
export const getAppConfig = (): AppConfig => APP_CONFIG;
