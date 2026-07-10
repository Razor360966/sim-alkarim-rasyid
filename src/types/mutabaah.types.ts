export interface SdmMutabaahIndicator {
  id: string;
  name: string;
  category: string; // "Ibadah" | "Pengembangan Diri" | "Administrasi" | "Kedisiplinan" | "Kepemimpinan" | "Pembinaan" | "Literasi" | "Tahfizh" | "Tahsin" | "Adab"
  inputType: "boolean" | "number" | "percentage" | "choice" | "text" | "document" | "photo";
  target: number;
  unit: string; // e.g., "halaman", "kali", "ayat", "buku"
  applicableRoles: string[]; // ["guru", "musrif", "staff", "wakil kepala sekolah", "kepala sekolah"]
  weight: number; // percentage, e.g., 10 for 10%
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
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

export interface SdmMutabaahEntry {
  id: string; // format: `${userId}_${date}`
  userId: string;
  userName: string;
  userRole: string;
  date: string; // YYYY-MM-DD
  values: Record<string, any>; // mapping indicatorId -> value
  attachmentUrls?: Record<string, string>; // mapping indicatorId -> simulated file URL/description
  compliancePercentage: number;
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
