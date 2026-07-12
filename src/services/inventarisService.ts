import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";

export interface MasterGood {
  id: string;
  name: string;
  minQty: number;
  unit: string;
  category: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface InventarisCategory {
  id: string;
  name: string;
  createdAt: string;
}

export interface InventarisExaminer {
  id: string; // The user's UID
  displayName: string;
  email: string;
  role: string;
  assignedAt: string;
}

export interface StudentInventarisItem {
  itemId: string;
  itemName: string;
  minQty: number;
  actualQty: number | null; // null/empty means Belum Dicek
  status: "Lengkap" | "Kurang" | "Tidak Membawa" | "Rusak" | "Belum Dicek";
  notes?: string;
}

export interface StudentInventaris {
  id: string; // studentId
  studentId: string;
  studentName: string;
  className: string;
  academicYear: string;
  items: StudentInventarisItem[];
  updatedAt: string;
  updatedBy: string; // userId of examiner
  examinerName: string;
}

export interface RiwayatPemeriksaan {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string; // YYYY-MM-DD
  examinerId: string;
  examinerName: string;
  summary: {
    lengkap: number;
    kurang: number;
    belumDicek: number;
    tidakMembawa: number;
    rusak: number;
  };
  items: StudentInventarisItem[];
  createdAt: string;
}

const GOODS_COL = "inventaris_goods";
const CATEGORIES_COL = "inventaris_categories";
const EXAMINERS_COL = "inventaris_examiners";
const STUDENT_INV_COL = "inventaris_santri";
const HISTORY_COL = "riwayat_pemeriksaan";

export const inventarisService = {
  // --- Master Barang ---
  async getGoods(): Promise<MasterGood[]> {
    try {
      const q = query(collection(db, GOODS_COL), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const items: MasterGood[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as MasterGood);
      });

      // Seeding default master goods if empty
      if (items.length === 0) {
        const defaultGoods = [
          { name: "Sprei 90×200 + Sarung Bantal", minQty: 1, unit: "Set", category: "Perlengkapan Tidur" },
          { name: "Selimut", minQty: 1, unit: "Pcs", category: "Perlengkapan Tidur" },
          { name: "Al-Qur'an", minQty: 1, unit: "Pcs", category: "Perlengkapan Ibadah" },
          { name: "Hanger / Gantungan Baju", minQty: 1, unit: "Lusin", category: "Perlengkapan MCK" },
          { name: "Ember", minQty: 1, unit: "Pcs", category: "Perlengkapan MCK" },
          { name: "Alat Mandi (Sabun, Shampoo, Sikat Gigi, Pasta Gigi, Handuk, Wadah)", minQty: 1, unit: "Set", category: "Perlengkapan MCK" },
          { name: "Baju Koko (Hitam Putih Wajib)", minQty: 4, unit: "Pcs", category: "Perlengkapan Ibadah" },
          { name: "Gamis (Hitam Putih Wajib)", minQty: 3, unit: "Pcs", category: "Perlengkapan Ibadah" },
          { name: "Sarung (Hitam Putih Wajib)", minQty: 4, unit: "Pcs", category: "Perlengkapan Ibadah" },
          { name: "Kaos / Pakaian Sehari-hari", minQty: 5, unit: "Pcs", category: "Perlengkapan Tidur" },
          { name: "Celana Dasar Hitam", minQty: 2, unit: "Pcs", category: "Muhadharah" },
          { name: "Sepatu Sekolah Hitam", minQty: 1, unit: "Pcs", category: "Perlengkapan Sekolah" },
          { name: "Sandal", minQty: 1, unit: "Pcs", category: "Lain-lain" },
          { name: "Kamus Bahasa Arab Al-Bisri Indonesia", minQty: 1, unit: "Pcs", category: "Perlengkapan Sekolah" },
          { name: "Kamus Bahasa Inggris Indonesia", minQty: 1, unit: "Pcs", category: "Perlengkapan Sekolah" },
          { name: "Deterjen / Sabun Cuci", minQty: 1, unit: "Secukupnya", category: "Perlengkapan MCK" },
          { name: "Perlengkapan Sekolah / ATK", minQty: 1, unit: "Set", category: "Perlengkapan Sekolah" },
          { name: "Peralatan Makan", minQty: 1, unit: "Set", category: "Perlengkapan Makan" },
          { name: "Botol Minum / Tumbler", minQty: 1, unit: "Pcs", category: "Perlengkapan Makan" },
          { name: "Parfum", minQty: 1, unit: "Pcs", category: "Lain-lain" },
          { name: "Deodorant", minQty: 1, unit: "Pcs", category: "Lain-lain" },
          { name: "Celana Pendek", minQty: 4, unit: "Pcs", category: "Perlengkapan Tidur" },
          { name: "Training", minQty: 2, unit: "Pcs", category: "Perlengkapan Olahraga" },
          { name: "Sepatu Olahraga", minQty: 2, unit: "Pcs", category: "Perlengkapan Olahraga" },
          { name: "Kaos Kaki", minQty: 3, unit: "Pcs", category: "Perlengkapan Sekolah" },
          { name: "Obat Pribadi / Vitamin", minQty: 1, unit: "Set", category: "Lain-lain" }
        ];

        for (const g of defaultGoods) {
          const colRef = collection(db, GOODS_COL);
          const newDoc = doc(colRef);
          const good: MasterGood = {
            id: newDoc.id,
            name: g.name,
            minQty: g.minQty,
            unit: g.unit,
            category: g.category,
            isActive: true,
            createdAt: new Date().toISOString()
          };
          await setDoc(newDoc, good);
          items.push(good);
        }
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, GOODS_COL);
    }
  },

  async addGood(data: Omit<MasterGood, "id" | "createdAt">): Promise<MasterGood> {
    const colRef = collection(db, GOODS_COL);
    const newDoc = doc(colRef);
    const item: MasterGood = {
      id: newDoc.id,
      ...data,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(newDoc, item);
      return item;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${GOODS_COL}/${newDoc.id}`);
    }
  },

  async updateGood(id: string, data: Partial<MasterGood>): Promise<void> {
    const docRef = doc(db, GOODS_COL, id);
    try {
      await updateDoc(docRef, data);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${GOODS_COL}/${id}`);
    }
  },

  async deleteGood(id: string): Promise<void> {
    const docRef = doc(db, GOODS_COL, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${GOODS_COL}/${id}`);
    }
  },

  // --- Kategori Barang ---
  async getCategories(): Promise<InventarisCategory[]> {
    try {
      const q = query(collection(db, CATEGORIES_COL), orderBy("name", "asc"));
      const snapshot = await getDocs(q);
      const items: InventarisCategory[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as InventarisCategory);
      });

      // Seeding default categories if empty
      if (items.length === 0) {
        const defaults = [
          "Perlengkapan Tidur",
          "Perlengkapan MCK",
          "Perlengkapan Ibadah",
          "Perlengkapan Sekolah",
          "Perlengkapan Makan",
          "Perlengkapan Olahraga",
          "Muhadharah",
          "Lain-lain"
        ];
        for (const name of defaults) {
          const colRef = collection(db, CATEGORIES_COL);
          const newDoc = doc(colRef);
          const cat: InventarisCategory = {
            id: newDoc.id,
            name,
            createdAt: new Date().toISOString()
          };
          await setDoc(newDoc, cat);
          items.push(cat);
        }
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, CATEGORIES_COL);
    }
  },

  async addCategory(name: string): Promise<InventarisCategory> {
    const colRef = collection(db, CATEGORIES_COL);
    const newDoc = doc(colRef);
    const item: InventarisCategory = {
      id: newDoc.id,
      name,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(newDoc, item);
      return item;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${CATEGORIES_COL}/${newDoc.id}`);
    }
  },

  // --- Penugasan Petugas Pemeriksa ---
  async getExaminers(): Promise<InventarisExaminer[]> {
    try {
      const q = query(collection(db, EXAMINERS_COL), orderBy("assignedAt", "desc"));
      const snapshot = await getDocs(q);
      const items: InventarisExaminer[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as InventarisExaminer);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, EXAMINERS_COL);
    }
  },

  async addExaminer(examiner: InventarisExaminer): Promise<void> {
    const docRef = doc(db, EXAMINERS_COL, examiner.id);
    try {
      await setDoc(docRef, examiner);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${EXAMINERS_COL}/${examiner.id}`);
    }
  },

  async deleteExaminer(id: string): Promise<void> {
    const docRef = doc(db, EXAMINERS_COL, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${EXAMINERS_COL}/${id}`);
    }
  },

  // --- Inventaris Santri ---
  async getChecklists(): Promise<StudentInventaris[]> {
    try {
      const snapshot = await getDocs(collection(db, STUDENT_INV_COL));
      const items: StudentInventaris[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as StudentInventaris);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, STUDENT_INV_COL);
    }
  },

  async getStudentChecklist(studentId: string): Promise<StudentInventaris | null> {
    const docRef = doc(db, STUDENT_INV_COL, studentId);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as StudentInventaris;
      }
      return null;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${STUDENT_INV_COL}/${studentId}`);
    }
  },

  async saveChecklist(
    studentId: string,
    studentName: string,
    className: string,
    academicYear: string,
    items: StudentInventarisItem[],
    examinerId: string,
    examinerName: string
  ): Promise<void> {
    const dateStr = new Date().toISOString().split("T")[0];

    // Calculate summary of status
    const summary = {
      lengkap: 0,
      kurang: 0,
      belumDicek: 0,
      tidakMembawa: 0,
      rusak: 0
    };

    items.forEach((it) => {
      if (it.status === "Lengkap") summary.lengkap++;
      else if (it.status === "Kurang") summary.kurang++;
      else if (it.status === "Tidak Membawa") summary.tidakMembawa++;
      else if (it.status === "Rusak") summary.rusak++;
      else summary.belumDicek++;
    });

    const docRef = doc(db, STUDENT_INV_COL, studentId);
    const checklistData: StudentInventaris = {
      id: studentId,
      studentId,
      studentName,
      className,
      academicYear,
      items,
      updatedAt: new Date().toISOString(),
      updatedBy: examinerId,
      examinerName
    };

    const historyRef = doc(collection(db, HISTORY_COL));
    const historyData: RiwayatPemeriksaan = {
      id: historyRef.id,
      studentId,
      studentName,
      className,
      date: dateStr,
      examinerId,
      examinerName,
      summary,
      items,
      createdAt: new Date().toISOString()
    };

    try {
      // Save/update current student checklist state
      await setDoc(docRef, checklistData);
      // Append a historic record that is never deleted
      await setDoc(historyRef, historyData);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${STUDENT_INV_COL}/${studentId}`);
    }
  },

  // --- Riwayat Pemeriksaan ---
  async getStudentHistory(studentId: string): Promise<RiwayatPemeriksaan[]> {
    try {
      const q = query(
        collection(db, HISTORY_COL),
        where("studentId", "==", studentId)
      );
      const snapshot = await getDocs(q);
      const items: RiwayatPemeriksaan[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as RiwayatPemeriksaan);
      });
      // Sort in-memory to avoid composite index requirement in Firestore
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, HISTORY_COL);
    }
  },

  async getAllHistory(): Promise<RiwayatPemeriksaan[]> {
    try {
      const q = query(collection(db, HISTORY_COL), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items: RiwayatPemeriksaan[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as RiwayatPemeriksaan);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, HISTORY_COL);
    }
  },

  async resetChecklist(studentId: string): Promise<void> {
    const docRef = doc(db, STUDENT_INV_COL, studentId);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${STUDENT_INV_COL}/${studentId}`);
    }
  }
};
