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
  urutanKategori: number;
  urutanBarang: number;
}

export interface InventarisCategory {
  id: string;
  name: string;
  urutan: number;
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
      const snapshot = await getDocs(collection(db, GOODS_COL));
      const items: MasterGood[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as MasterGood);
      });

      // Seeding default master goods if empty
      if (items.length === 0) {
        const defaultGoods = [
          // 1. Perlengkapan Ibadah (urutanKategori: 1)
          { name: "Baju Koko (Hitam Putih Wajib)", minQty: 4, unit: "Pcs", category: "Perlengkapan Ibadah", urutanKategori: 1, urutanBarang: 1 },
          { name: "Gamis (Hitam Putih Wajib)", minQty: 3, unit: "Pcs", category: "Perlengkapan Ibadah", urutanKategori: 1, urutanBarang: 2 },
          { name: "Sarung (Hitam Putih Wajib)", minQty: 4, unit: "Pcs", category: "Perlengkapan Ibadah", urutanKategori: 1, urutanBarang: 3 },
          { name: "Al-Qur'an", minQty: 1, unit: "Pcs", category: "Perlengkapan Ibadah", urutanKategori: 1, urutanBarang: 4 },

          // 2. Perlengkapan Sekolah (urutanKategori: 2)
          { name: "Sepatu Sekolah Hitam", minQty: 1, unit: "Pcs", category: "Perlengkapan Sekolah", urutanKategori: 2, urutanBarang: 1 },
          { name: "Kaos Kaki", minQty: 3, unit: "Pcs", category: "Perlengkapan Sekolah", urutanKategori: 2, urutanBarang: 2 },
          { name: "Kamus Bahasa Arab Al-Bisri Indonesia", minQty: 1, unit: "Pcs", category: "Perlengkapan Sekolah", urutanKategori: 2, urutanBarang: 3 },
          { name: "Kamus Bahasa Inggris Indonesia", minQty: 1, unit: "Pcs", category: "Perlengkapan Sekolah", urutanKategori: 2, urutanBarang: 4 },
          { name: "Perlengkapan Sekolah / ATK", minQty: 1, unit: "Set", category: "Perlengkapan Sekolah", urutanKategori: 2, urutanBarang: 5 },

          // 3. Pakaian Harian dan Tidur (urutanKategori: 3)
          { name: "Sprei 90×200 + Sarung Bantal", minQty: 1, unit: "Set", category: "Pakaian Harian dan Tidur", urutanKategori: 3, urutanBarang: 1 },
          { name: "Selimut", minQty: 1, unit: "Pcs", category: "Pakaian Harian dan Tidur", urutanKategori: 3, urutanBarang: 2 },
          { name: "Kaos / Pakaian Sehari-hari", minQty: 5, unit: "Pcs", category: "Pakaian Harian dan Tidur", urutanKategori: 3, urutanBarang: 3 },
          { name: "Celana Pendek", minQty: 4, unit: "Pcs", category: "Pakaian Harian dan Tidur", urutanKategori: 3, urutanBarang: 4 },

          // 4. Perlengkapan Olahraga (urutanKategori: 4)
          { name: "Training", minQty: 2, unit: "Pcs", category: "Perlengkapan Olahraga", urutanKategori: 4, urutanBarang: 1 },
          { name: "Sepatu Olahraga", minQty: 2, unit: "Pcs", category: "Perlengkapan Olahraga", urutanKategori: 4, urutanBarang: 2 },

          // 5. Perlengkapan MCK (urutanKategori: 5)
          { name: "Ember", minQty: 1, unit: "Pcs", category: "Perlengkapan MCK", urutanKategori: 5, urutanBarang: 1 },
          { name: "Hanger / Gantungan Baju", minQty: 1, unit: "Lusin", category: "Perlengkapan MCK", urutanKategori: 5, urutanBarang: 2 },
          { name: "Alat Mandi (Sabun, Shampoo, Sikat Gigi, Pasta Gigi, Handuk, Wadah)", minQty: 1, unit: "Set", category: "Perlengkapan MCK", urutanKategori: 5, urutanBarang: 3 },
          { name: "Deterjen / Sabun Cuci", minQty: 1, unit: "Secukupnya", category: "Perlengkapan MCK", urutanKategori: 5, urutanBarang: 4 },

          // 6. Perlengkapan Makan (urutanKategori: 6)
          { name: "Peralatan Makan", minQty: 1, unit: "Set", category: "Perlengkapan Makan", urutanKategori: 6, urutanBarang: 1 },
          { name: "Botol Minum / Tumbler", minQty: 1, unit: "Pcs", category: "Perlengkapan Makan", urutanKategori: 6, urutanBarang: 2 },

          // 7. Muhadharah (urutanKategori: 7)
          { name: "Celana Dasar Hitam", minQty: 2, unit: "Pcs", category: "Muhadharah", urutanKategori: 7, urutanBarang: 1 },

          // 8. Lain-lain (urutanKategori: 8)
          { name: "Sandal", minQty: 1, unit: "Pcs", category: "Lain-lain", urutanKategori: 8, urutanBarang: 1 },
          { name: "Parfum", minQty: 1, unit: "Pcs", category: "Lain-lain", urutanKategori: 8, urutanBarang: 2 },
          { name: "Deodorant", minQty: 1, unit: "Pcs", category: "Lain-lain", urutanKategori: 8, urutanBarang: 3 },
          { name: "Obat Pribadi / Vitamin", minQty: 1, unit: "Set", category: "Lain-lain", urutanKategori: 8, urutanBarang: 4 }
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
            createdAt: new Date().toISOString(),
            urutanKategori: g.urutanKategori,
            urutanBarang: g.urutanBarang
          };
          await setDoc(newDoc, good);
          items.push(good);
        }
      }

      // Sort by category order then item order
      items.sort((a, b) => {
        const catDiff = (a.urutanKategori || 999) - (b.urutanKategori || 999);
        if (catDiff !== 0) return catDiff;
        return (a.urutanBarang || 999) - (b.urutanBarang || 999);
      });

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
      const snapshot = await getDocs(collection(db, CATEGORIES_COL));
      const items: InventarisCategory[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as InventarisCategory);
      });

      // Seeding default categories if empty
      if (items.length === 0) {
        const defaults = [
          "Perlengkapan Ibadah",
          "Perlengkapan Sekolah",
          "Pakaian Harian dan Tidur",
          "Perlengkapan Olahraga",
          "Perlengkapan MCK",
          "Perlengkapan Makan",
          "Muhadharah",
          "Lain-lain"
        ];
        let idx = 1;
        for (const name of defaults) {
          const colRef = collection(db, CATEGORIES_COL);
          const newDoc = doc(colRef);
          const cat: InventarisCategory = {
            id: newDoc.id,
            name,
            urutan: idx++,
            createdAt: new Date().toISOString()
          };
          await setDoc(newDoc, cat);
          items.push(cat);
        }
      }

      // Sort categories by order
      items.sort((a, b) => (a.urutan || 999) - (b.urutan || 999));

      // De-duplicate categories by name to prevent duplicate keys or duplicate sections
      const uniqueItems: InventarisCategory[] = [];
      const seenNames = new Set<string>();
      items.forEach((item) => {
        const normalizedName = item.name.trim();
        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueItems.push(item);
        }
      });

      return uniqueItems;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, CATEGORIES_COL);
    }
  },

  async addCategory(name: string, urutan?: number): Promise<InventarisCategory> {
    const colRef = collection(db, CATEGORIES_COL);
    const newDoc = doc(colRef);
    const item: InventarisCategory = {
      id: newDoc.id,
      name,
      urutan: urutan !== undefined ? urutan : 999,
      createdAt: new Date().toISOString()
    };
    try {
      await setDoc(newDoc, item);
      return item;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${CATEGORIES_COL}/${newDoc.id}`);
    }
  },

  async updateCategory(id: string, data: Partial<InventarisCategory>): Promise<void> {
    const docRef = doc(db, CATEGORIES_COL, id);
    try {
      await updateDoc(docRef, data);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${CATEGORIES_COL}/${id}`);
    }
  },

  async deleteCategory(id: string): Promise<void> {
    const docRef = doc(db, CATEGORIES_COL, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${CATEGORIES_COL}/${id}`);
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
