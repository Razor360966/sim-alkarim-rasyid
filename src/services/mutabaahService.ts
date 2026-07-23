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
import { SdmMutabaahIndicator, SdmMutabaahTemplate, SdmMutabaahEntry, SdmMutabaahChangeLog, SdmMutabaahEntryChange } from "../types";

const INDICATORS_COLLECTION = "mutabaah_indicators";
const TEMPLATES_COLLECTION = "mutabaah_templates";
const ENTRIES_COLLECTION = "mutabaah_entries";
const LOGS_COLLECTION = "mutabaah_logs";

const DEFAULT_INDICATORS: Omit<SdmMutabaahIndicator, "createdAt" | "updatedAt" | "updatedBy">[] = [
  // --- IBADAH WAJIB ---
  {
    id: "m_shalat_berjamaah",
    name: "Shalat Berjamaah 5 Waktu",
    category: "Ibadah Wajib",
    inputType: "prayers_5",
    target: 5,
    unit: "waktu",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 15,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },
  {
    id: "m_shalat_tepat_waktu",
    name: "Ketepatan Waktu Shalat 5 Waktu",
    category: "Ibadah Wajib",
    inputType: "prayers_5",
    target: 5,
    unit: "waktu",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 15,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },
  {
    id: "m_tilawah",
    name: "Tilawah Al-Qur'an",
    category: "Ibadah Wajib",
    inputType: "boolean",
    target: 1,
    unit: "lembar",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 15,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },
  {
    id: "m_dzikir",
    name: "Dzikir Pagi & Petang",
    category: "Ibadah Wajib",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },

  // --- IBADAH SUNNAH ---
  {
    id: "m_puasa_senin",
    name: "Puasa Sunnah Senin",
    category: "Ibadah Sunnah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },
  {
    id: "m_puasa_kamis",
    name: "Puasa Sunnah Kamis",
    category: "Ibadah Sunnah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Kamis"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },
  {
    id: "m_shalat_dhuha",
    name: "Shalat Dhuha",
    category: "Ibadah Sunnah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },
  {
    id: "m_qiyamul_lail",
    name: "Qiyamul Lail (Tahajud)",
    category: "Ibadah Sunnah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: true
  },

  // --- RUHIYAH ---
  {
    id: "m_kajian",
    name: "Mengikuti Kajian Keislaman",
    category: "Ruhiyah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },
  {
    id: "m_muhasabah",
    name: "Muhasabah Diri",
    category: "Ruhiyah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },
  {
    id: "m_sedekah",
    name: "Sedekah Harian / Infaq",
    category: "Ruhiyah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },
  {
    id: "m_doa",
    name: "Membaca Doa Harian & Al-Ma'tsurat",
    category: "Ruhiyah",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },

  // --- AKHLAK ---
  {
    id: "m_amanah",
    name: "Amanah dalam Mengemban Tugas",
    category: "Akhlak",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },
  {
    id: "m_disiplin",
    name: "Disiplin Kehadiran & Waktu Kegiatan",
    category: "Akhlak",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },
  {
    id: "m_keteladanan",
    name: "Menampilkan Keteladanan Sikap & Adab",
    category: "Akhlak",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  },
  {
    id: "m_menjaga_lisan",
    name: "Menjaga Lisan & Sikap Hormat",
    category: "Akhlak",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["musrif", "guru", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
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
          } as SdmMutabaahIndicator;
          await setDoc(docRef, fullInd);
        });
        await Promise.all(promises);
        
        // Refetch after seed
        const newSnapshot = await getDocs(colRef);
        const items: SdmMutabaahIndicator[] = [];
        newSnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            ...data,
            category: data.category || "Ibadah Wajib",
            frequency: data.frequency || "harian",
            applicableDays: data.applicableDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
            startTime: data.startTime || "",
            endTime: data.endTime || "",
            appliesToMale: data.appliesToMale !== undefined ? data.appliesToMale : true,
            appliesToFemale: data.appliesToFemale !== undefined ? data.appliesToFemale : true,
            excludeDuringHaid: data.excludeDuringHaid !== undefined ? data.excludeDuringHaid : false,
            isAutoWeight: data.isAutoWeight !== undefined ? data.isAutoWeight : true,
          } as SdmMutabaahIndicator);
        });
        return items;
      }

      const items: SdmMutabaahIndicator[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          ...data,
          category: data.category || "Ibadah Wajib",
          frequency: data.frequency || "harian",
          applicableDays: data.applicableDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"],
          startTime: data.startTime || "",
          endTime: data.endTime || "",
          appliesToMale: data.appliesToMale !== undefined ? data.appliesToMale : true,
          appliesToFemale: data.appliesToFemale !== undefined ? data.appliesToFemale : true,
          excludeDuringHaid: data.excludeDuringHaid !== undefined ? data.excludeDuringHaid : false,
          isAutoWeight: data.isAutoWeight !== undefined ? data.isAutoWeight : true,
        } as SdmMutabaahIndicator);
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
      
      const rawPayload = {
        ...indicator,
        category: indicator.category || "Ibadah Wajib",
        updatedAt: now,
        updatedBy: operatorName
      };

      const payload: Record<string, any> = {};
      Object.entries(rawPayload).forEach(([k, v]) => {
        if (v !== undefined) {
          payload[k] = v;
        }
      });

      if (isNew) {
        payload.createdAt = now;
        payload.isActive = payload.isActive !== undefined ? payload.isActive : true;
        payload.isArchived = payload.isArchived !== undefined ? payload.isArchived : false;
        await setDoc(docRef, payload);
        await this.logChange({
          operatorId,
          operatorName,
          action: "Tambah Indikator",
          details: `Menambah indikator: "${indicator.name || ''}"`
        });
      } else {
        await updateDoc(docRef, payload);
        await this.logChange({
          operatorId,
          operatorName,
          action: "Ubah Indikator",
          details: `Mengubah indikator: "${indicator.name || existingSnap.data()?.name || ''}"`
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

  // Set all active indicators to Auto Weighting
  async setAllAutoWeight(operatorName: string, operatorId: string): Promise<void> {
    try {
      const indicators = await this.getIndicators();
      const activeIndicators = indicators.filter((ind) => ind.isActive && !ind.isArchived);
      const now = new Date().toISOString();
      const promises = activeIndicators.map((ind) => {
        const docRef = doc(db, INDICATORS_COLLECTION, ind.id);
        return updateDoc(docRef, {
          isAutoWeight: true,
          updatedAt: now,
          updatedBy: operatorName
        });
      });
      await Promise.all(promises);
      await this.logChange({
        operatorId,
        operatorName,
        action: "Set Bobot Otomatis",
        details: `Mengatur seluruh ${activeIndicators.length} indikator aktif ke mode Pembobotan Otomatis`
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, INDICATORS_COLLECTION);
    }
  },

  // Equalize manual weights equally (100% / N)
  async equalizeManualWeights(operatorName: string, operatorId: string): Promise<void> {
    try {
      const indicators = await this.getIndicators();
      const activeIndicators = indicators.filter((ind) => ind.isActive && !ind.isArchived);
      if (activeIndicators.length === 0) return;

      const equalWeight = Number((100 / activeIndicators.length).toFixed(1));
      const now = new Date().toISOString();

      const promises = activeIndicators.map((ind) => {
        const docRef = doc(db, INDICATORS_COLLECTION, ind.id);
        return updateDoc(docRef, {
          weight: equalWeight,
          isAutoWeight: false,
          updatedAt: now,
          updatedBy: operatorName
        });
      });
      await Promise.all(promises);

      await this.logChange({
        operatorId,
        operatorName,
        action: "Ratakan Bobot Manual",
        details: `Membagi rata bobot ${equalWeight}% secara manual kepada ${activeIndicators.length} indikator aktif`
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, INDICATORS_COLLECTION);
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
        const existingData = existingSnap.data();
        const existingHistory = existingData.history || [];
        const change: SdmMutabaahEntryChange = {
          timestamp: now,
          updatedBy: entry.userName,
          oldValues: existingData.values || {},
          newValues: entry.values
        };
        await updateDoc(docRef, {
          values: entry.values,
          attachmentUrls: entry.attachmentUrls || {},
          compliancePercentage: entry.compliancePercentage,
          userHaidStatus: entry.userHaidStatus || "Normal",
          gender: entry.gender || "L",
          history: [...existingHistory, change],
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
