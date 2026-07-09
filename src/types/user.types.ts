export interface UserSystem {
  id: string; // Document ID (usually same as userId)
  userId: string;
  teacherId: string | null;
  teacherName?: string | null; // Cached teacher name for convenience

  name: string;
  email: string;
  username?: string;
  phoneNumber?: string;

  role: string; // 'admin' | 'kepala sekolah' | 'wakil kepala sekolah' | 'guru' | 'musrif' | 'tata usaha' | 'operator' | 'ketua yayasan'
  roles?: string[]; // Multiple roles support
  status: "Aktif" | "Nonaktif" | "Menunggu Aktivasi" | "Ditangguhkan";

  permissions?: string[];

  lastLogin: string | null; // ISO Date String
  requirePasswordChange?: boolean;

  createdAt: string;
  updatedAt: string;
  createdBy: string;

  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
}

export type UserSystemRole =
  | "admin"
  | "kepala sekolah"
  | "wakil kepala sekolah"
  | "guru"
  | "musrif"
  | "tata usaha"
  | "operator"
  | "ketua yayasan";
