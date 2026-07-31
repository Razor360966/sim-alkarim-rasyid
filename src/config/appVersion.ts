export interface AppConfig {
  name: string;
  fullName: string;
  schoolName: string;
  version: string;
  buildDate: string;
  developer: string;
  techStack: string[];
  copyright: string;
}

export const APP_CONFIG: AppConfig = {
  name: "SIMAK",
  fullName: "Sistem Informasi Manajemen Akademik",
  schoolName: "SMP IT Alkarim Rasyid",
  version: "1.2.0",
  buildDate: "2026-07-30",
  developer: "Tim Pengembang IT SIMAK",
  techStack: [
    "React 18",
    "TypeScript",
    "Vite",
    "Tailwind CSS",
    "Firebase Firestore & Auth",
    "Progressive Web App (PWA)"
  ],
  copyright: "© 2026 SMP IT Alkarim Rasyid. All Rights Reserved."
};

export const getAppVersion = (): string => APP_CONFIG.version;
export const getAppConfig = (): AppConfig => APP_CONFIG;
