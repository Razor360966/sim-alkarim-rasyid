import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { SdmMutabaahIndicator, SdmMutabaahTemplate, SdmMutabaahEntry, SdmMutabaahChangeLog } from "../types";

const INDICATORS_COLLECTION = "mutabaah_indicators";
const TEMPLATES_COLLECTION = "mutabaah_templates";
const ENTRIES_COLLECTION = "mutabaah_entries";
const LOGS_COLLECTION = "mutabaah_logs";

const DEFAULT_INDICATORS: Omit<SdmMutabaahIndicator, "createdAt" | "updatedAt" | "updatedBy">[] = [
  {
    id: "m_shalat_jamaah",
    name: "Shalat Berjamaah",
    category: "Ibadah",
    inputType: "choice",
    target: 5,
    unit: "waktu per hari",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_shalat_tahajud",
    name: "Shalat Tahajud",
    category: "Ibadah",
    inputType: "boolean",
    target: 1,
    unit: "kali per hari",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_shalat_dhuha",
    name: "Shalat Dhuha",
    category: "Ibadah",
    inputType: "boolean",
    target: 1,
    unit: "kali per hari",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_tilawah",
    name: "Tilawah Quran",
    category: "Literasi",
    inputType: "number",
    target: 2,
    unit: "halaman per hari",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 15,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_murajaah",
    name: "Murajaah Hafalan",
    category: "Tahfizh",
    inputType: "number",
    target: 2,
    unit: "halaman per hari",
    applicableRoles: ["musrif"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_ziyadah",
    name: "Ziyadah Hafalan",
    category: "Tahfizh",
    inputType: "number",
    target: 5,
    unit: "ayat per hari",
    applicableRoles: ["musrif"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_target_hafalan",
    name: "Target Penambahan Hafalan",
    category: "Tahfizh",
    inputType: "percentage",
    target: 100,
    unit: "persen per semester",
    applicableRoles: ["musrif"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_puasa_sunnah",
    name: "Puasa Sunnah",
    category: "Ibadah",
    inputType: "boolean",
    target: 8,
    unit: "kali per bulan",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_dzikir",
    name: "Dzikir Pagi & Petang",
    category: "Ibadah",
    inputType: "boolean",
    target: 2,
    unit: "kali per hari",
    applicableRoles: ["musrif"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_membaca_buku",
    name: "Membaca Buku",
    category: "Literasi",
    inputType: "number",
    target: 1,
    unit: "buku per bulan",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_resume_buku",
    name: "Resume Buku",
    category: "Literasi",
    inputType: "text",
    target: 1,
    unit: "resume per bulan",
    applicableRoles: ["musrif"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_kehadiran",
    name: "Kehadiran Tugas",
    category: "Kedisiplinan",
    inputType: "choice",
    target: 100,
    unit: "persen",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_keteladanan",
    name: "Keteladanan Sikap",
    category: "Adab",
    inputType: "choice",
    target: 100,
    unit: "persen",
    applicableRoles: ["musrif"],
    weight: 5,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_pembinaan_santri",
    name: "Pembinaan Santri",
    category: "Pembinaan",
    inputType: "choice",
    target: 100,
    unit: "persen",
    applicableRoles: ["musrif"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "m_administrasi_halaqah",
    name: "Administrasi Halaqah",
    category: "Administrasi",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["musrif"],
    weight: 20,
    isActive: true,
    isArchived: false,
  },
  {
    id: "g_administrasi_pembelajaran",
    name: "Administrasi Pembelajaran",
    category: "Administrasi",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["guru"],
    weight: 20,
    isActive: true,
    isArchived: false,
  },
  {
    id: "g_modul_ajar",
    name: "Penyusunan Modul Ajar",
    category: "Administrasi",
    inputType: "boolean",
    target: 1,
    unit: "modul per bab",
    applicableRoles: ["guru"],
    weight: 15,
    isActive: true,
    isArchived: false,
  },
  {
    id: "g_pengembangan_diri",
    name: "Pengembangan Diri",
    category: "Pengembangan Diri",
    inputType: "choice",
    target: 2,
    unit: "pelatihan per semester",
    applicableRoles: ["guru", "staff", "wakil kepala sekolah", "kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "s_ketepatan_pelayanan",
    name: "Ketepatan Pelayanan",
    category: "Kedisiplinan",
    inputType: "choice",
    target: 100,
    unit: "persen",
    applicableRoles: ["staff"],
    weight: 25,
    isActive: true,
    isArchived: false,
  },
  {
    id: "s_administrasi_staff",
    name: "Administrasi Kantor",
    category: "Administrasi",
    inputType: "choice",
    target: 100,
    unit: "persen",
    applicableRoles: ["staff"],
    weight: 20,
    isActive: true,
    isArchived: false,
  },
  {
    id: "ks_supervisi_akademik",
    name: "Supervisi Akademik",
    category: "Kepemimpinan",
    inputType: "number",
    target: 5,
    unit: "guru per semester",
    applicableRoles: ["kepala sekolah"],
    weight: 15,
    isActive: true,
    isArchived: false,
  },
  {
    id: "ks_supervisi_manajerial",
    name: "Supervisi Manajerial",
    category: "Kepemimpinan",
    inputType: "number",
    target: 2,
    unit: "kali per semester",
    applicableRoles: ["kepala sekolah"],
    weight: 15,
    isActive: true,
    isArchived: false,
  },
  {
    id: "ks_monitoring_guru",
    name: "Monitoring Guru",
    category: "Kepemimpinan",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "ks_monitoring_staff",
    name: "Monitoring Staff",
    category: "Kepemimpinan",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "ks_monitoring_musrif",
    name: "Monitoring Musrif",
    category: "Kepemimpinan",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "ks_koordinasi",
    name: "Rapat Koordinasi",
    category: "Kepemimpinan",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["kepala sekolah", "wakil kepala sekolah"],
    weight: 10,
    isActive: true,
    isArchived: false,
  },
  {
    id: "wk_monitoring_bidang",
    name: "Monitoring Bidang",
    category: "Kepemimpinan",
    inputType: "boolean",
    target: 1,
    unit: "kali per minggu",
    applicableRoles: ["wakil kepala sekolah"],
    weight: 20,
    isActive: true,
    isArchived: false,
  },
  {
    id: "wk_supervisi",
    name: "Supervisi Bidang Kerja",
    category: "Kepemimpinan",
    inputType: "choice",
    target: 100,
    unit: "persen",
    applicableRoles: ["wakil kepala sekolah"],
    weight: 20,
    isActive: true,
    isArchived: false,
  }
];

export const mutabaahService = {
  // Get all indicators (with auto-seeding if empty)
  async getIndicators(): Promise<SdmMutabaahIndicator[]> {
    const colRef = collection(db, INDICATORS_COLLECTION);
    try {
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        console.log("Seeding default mutabaah indicators...");
        const now = new Date().toISOString();
        const promises = DEFAULT_INDICATORS.map(async (ind) => {
          const docRef = doc(colRef, ind.id);
          const fullInd: SdmMutabaahIndicator = {
            ...ind,
            createdAt: now,
            updatedAt: now,
            updatedBy: "System Seeder"
          };
          await setDoc(docRef, fullInd);
        });
        await Promise.all(promises);
        
        // Refetch after seed
        const newSnapshot = await getDocs(colRef);
        const items: SdmMutabaahIndicator[] = [];
        newSnapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as SdmMutabaahIndicator);
        });
        return items;
      }

      const items: SdmMutabaahIndicator[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SdmMutabaahIndicator);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, INDICATORS_COLLECTION);
    }
  },

  // Save/Update Indicator
  async saveIndicator(indicator: Partial<SdmMutabaahIndicator> & { id: string }, operatorName: string, operatorId: string): Promise<void> {
    const docRef = doc(db, INDICATORS_COLLECTION, indicator.id);
    const now = new Date().toISOString();
    try {
      const existingSnap = await getDoc(docRef);
      const isNew = !existingSnap.exists();
      
      const payload = {
        ...indicator,
        updatedAt: now,
        updatedBy: operatorName
      };

      if (isNew) {
        (payload as any).createdAt = now;
        (payload as any).isActive = true;
        (payload as any).isArchived = false;
        await setDoc(docRef, payload);
        await this.logChange({
          operatorId,
          operatorName,
          action: "Tambah Indikator",
          details: `Menambah indikator: "${indicator.name}"`
        });
      } else {
        await updateDoc(docRef, payload);
        await this.logChange({
          operatorId,
          operatorName,
          action: "Ubah Indikator",
          details: `Mengubah indikator: "${indicator.name || existingSnap.data()?.name}"`
        });
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INDICATORS_COLLECTION}/${indicator.id}`);
    }
  },

  // Archive Indicator (rather than deleting)
  async archiveIndicator(id: string, name: string, operatorName: string, operatorId: string): Promise<void> {
    const docRef = doc(db, INDICATORS_COLLECTION, id);
    try {
      await updateDoc(docRef, {
        isArchived: true,
        isActive: false,
        updatedAt: new Date().toISOString(),
        updatedBy: operatorName
      });
      await this.logChange({
        operatorId,
        operatorName,
        action: "Arsip Indikator",
        details: `Mengarsipkan indikator: "${name}"`
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INDICATORS_COLLECTION}/${id}`);
    }
  },

  // Toggle Activate/Deactivate
  async toggleIndicatorActive(id: string, name: string, currentStatus: boolean, operatorName: string, operatorId: string): Promise<void> {
    const docRef = doc(db, INDICATORS_COLLECTION, id);
    const nextStatus = !currentStatus;
    try {
      await updateDoc(docRef, {
        isActive: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: operatorName
      });
      await this.logChange({
        operatorId,
        operatorName,
        action: nextStatus ? "Aktivasi Indikator" : "Deaktivasi Indikator",
        details: `${nextStatus ? "Mengaktifkan" : "Menonaktifkan"} indikator: "${name}"`
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INDICATORS_COLLECTION}/${id}`);
    }
  },

  // Get daily mutabaah entry for a specific user and date
  async getDailyEntry(userId: string, date: string): Promise<SdmMutabaahEntry | null> {
    const docId = `${userId}_${date}`;
    const docRef = doc(db, ENTRIES_COLLECTION, docId);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as SdmMutabaahEntry;
      }
      return null;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${ENTRIES_COLLECTION}/${docId}`);
    }
  },

  // Save daily mutabaah entry
  async saveDailyEntry(entry: Omit<SdmMutabaahEntry, "createdAt" | "updatedAt">): Promise<void> {
    const docId = `${entry.userId}_${entry.date}`;
    const docRef = doc(db, ENTRIES_COLLECTION, docId);
    const now = new Date().toISOString();
    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        await updateDoc(docRef, {
          values: entry.values,
          attachmentUrls: entry.attachmentUrls || {},
          compliancePercentage: entry.compliancePercentage,
          updatedAt: now
        });
      } else {
        await setDoc(docRef, {
          ...entry,
          createdAt: now,
          updatedAt: now
        });
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${ENTRIES_COLLECTION}/${docId}`);
    }
  },

  // Get all entries by user
  async getUserEntries(userId: string): Promise<SdmMutabaahEntry[]> {
    const colRef = collection(db, ENTRIES_COLLECTION);
    const q = query(colRef, where("userId", "==", userId));
    try {
      const snapshot = await getDocs(q);
      const items: SdmMutabaahEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SdmMutabaahEntry);
      });
      // Sort in memory by date descending
      items.sort((a, b) => b.date.localeCompare(a.date));
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, ENTRIES_COLLECTION);
    }
  },

  // Get all entries (for monitoring/rekap)
  async getAllEntries(date?: string): Promise<SdmMutabaahEntry[]> {
    const colRef = collection(db, ENTRIES_COLLECTION);
    let q = query(colRef);
    if (date) {
      q = query(colRef, where("date", "==", date));
    }
    try {
      const snapshot = await getDocs(q);
      const items: SdmMutabaahEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SdmMutabaahEntry);
      });
      items.sort((a, b) => b.date.localeCompare(a.date));
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, ENTRIES_COLLECTION);
    }
  },

  // Save Template
  async saveTemplate(template: Omit<SdmMutabaahTemplate, "createdAt" | "updatedAt">): Promise<void> {
    const docRef = doc(db, TEMPLATES_COLLECTION, template.id);
    const now = new Date().toISOString();
    try {
      await setDoc(docRef, {
        ...template,
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${TEMPLATES_COLLECTION}/${template.id}`);
    }
  },

  // Get Templates
  async getTemplates(): Promise<SdmMutabaahTemplate[]> {
    const colRef = collection(db, TEMPLATES_COLLECTION);
    try {
      const snapshot = await getDocs(colRef);
      const items: SdmMutabaahTemplate[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SdmMutabaahTemplate);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, TEMPLATES_COLLECTION);
    }
  },

  // Log Change History
  async logChange(log: Omit<SdmMutabaahChangeLog, "id" | "timestamp">): Promise<void> {
    const colRef = collection(db, LOGS_COLLECTION);
    const docRef = doc(colRef);
    const timestamp = new Date().toISOString();
    try {
      await setDoc(docRef, {
        id: docRef.id,
        ...log,
        timestamp
      });
    } catch (error) {
      console.error("Failed to save change log:", error);
    }
  },

  // Get Change Logs
  async getChangeLogs(): Promise<SdmMutabaahChangeLog[]> {
    const colRef = collection(db, LOGS_COLLECTION);
    try {
      const snapshot = await getDocs(colRef);
      const items: SdmMutabaahChangeLog[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SdmMutabaahChangeLog);
      });
      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return items;
    } catch (error) {
      return [];
    }
  }
};
