export interface GtkDevelopmentActivity {
  id: string;
  date: string; // YYYY-MM-DD
  academicYearId: string;
  academicYearName: string; // e.g. "2025/2026"
  semesterId: string;
  semesterName: string; // e.g. "Semester 1"
  gtkId: string; // userId of GTK
  gtkName: string; // name of GTK
  gtkRole: string; // role of GTK (e.g. "guru", "tata usaha")
  type: string; // Jenis Pengembangan
  title: string; // Nama Kegiatan
  organizer: string; // Penyelenggara
  category: string; // Kategori Pengembangan
  status: 'Direncanakan' | 'Sedang Berlangsung' | 'Selesai';
  location?: string; // Tempat (opsional)
  hours?: number; // Jumlah JP Pelatihan (opsional)
  certificateNumber?: string; // Nomor Sertifikat (opsional)
  evidenceLink?: string; // Link Bukti Dukung (opsional)
  notes?: string; // Catatan (opsional)
  isValidated?: boolean; // Validasi oleh Kepsek
  validationNotes?: string; // Catatan oleh Kepsek
  validatedBy?: string; // Kepala Sekolah userId
  validatedAt?: string; // Timestamp ISO
  createdAt: string;
  updatedAt: string;
}

export interface MutabaahIndicator {
  id: string;
  name: string; // Shalat Berjamaah, Shalat Dhuha, etc.
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface MutabaahLog {
  id: string; // `${gtkId}_${date}`
  date: string; // YYYY-MM-DD
  academicYearId: string;
  semesterId: string;
  gtkId: string;
  gtkName: string;
  indicators: {
    [indicatorId: string]: 'Terlaksana' | 'Belum Terlaksana' | 'Tidak Berlaku';
  };
  createdAt: string;
  updatedAt: string;
}
