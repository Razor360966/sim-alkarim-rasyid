export interface SdmMutabaahIndicator {
  id: string;
  name: string;
  category: string; // "Ibadah" | "Pengembangan Diri" | "Administrasi" | "Kedisiplinan" | "Kepemimpinan" | "Pembinaan" | "Literasi" | "Tahfizh" | "Tahsin" | "Adab"
  inputType: "boolean" | "number" | "percentage" | "choice" | "text" | "document" | "photo" | "prayers_5";
  target: number;
  unit: string; // e.g., "halaman", "kali", "ayat", "buku"
  applicableRoles: string[]; // ["guru", "musrif", "staff", "wakil kepala sekolah", "kepala sekolah"]
  weight: number; // percentage, e.g., 10 for 10%
  isAutoWeight?: boolean; // true if auto-calculated based on active indicators count, false if manual/priority
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;

  // Smart Mutabaah Fields
  frequency: "waktu" | "harian" | "mingguan" | "bulanan";
  applicableDays?: string[]; // ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
  startTime?: string; // "HH:MM" e.g., "04:30"
  endTime?: string; // "HH:MM" e.g., "06:00"
  appliesToMale?: boolean;
  appliesToFemale?: boolean;
  excludeDuringHaid?: boolean;
}

export interface SdmMutabaahTemplate {
  id: string;
  name: string;
  role: string; // e.g., "guru", "musrif", "staff"
  indicators: Omit<SdmMutabaahIndicator, "createdAt" | "updatedAt">[];
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}

export interface SdmMutabaahEntryChange {
  timestamp: string;
  updatedBy: string;
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
}

export interface SdmMutabaahEntry {
  id: string; // format: `${userId}_${date}`
  userId: string;
  userName: string;
  userRole: string;
  date: string; // YYYY-MM-DD
  values: Record<string, any>; // mapping indicatorId -> value
  attachmentUrls?: Record<string, string>; // mapping indicatorId -> simulated file URL/description
  compliancePercentage: number;
  userHaidStatus?: "Normal" | "Haid";
  gender?: "L" | "P";
  history?: SdmMutabaahEntryChange[];
  createdAt: string;
  updatedAt: string;
}

export interface SdmMutabaahChangeLog {
  id: string;
  operatorId: string;
  operatorName: string;
  action: string; // "Tambah Indikator" | "Ubah Indikator" | "Hapus Indikator" | "Arsip Indikator" | "Reset Indikator"
  details: string;
  timestamp: string;
}
