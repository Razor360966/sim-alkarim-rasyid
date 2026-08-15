import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { ERaporExtracurricular } from "../types/eRapor.types";

const COLLECTION_NAME = "e_rapor_extracurriculars";

export const extracurricularService = {
  // Get all extracurricular activities
  async getExtracurriculars(): Promise<ERaporExtracurricular[]> {
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const snap = await getDocs(q);
      const items: ERaporExtracurricular[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as ERaporExtracurricular);
      });

      // Default seed list if empty
      if (items.length === 0) {
        const defaultList: Omit<ERaporExtracurricular, "id">[] = [
          { name: "Pramuka", pembinaId: "", pembinaName: "Ust. Ahmad", category: "Wajib", active: true },
          { name: "Tahfidz & Qiraat", pembinaId: "", pembinaName: "Ust. Rayhan", category: "Keagamaan", active: true },
          { name: "Panahan & Seni Bela Diri", pembinaId: "", pembinaName: "Ust. Hamzah", category: "Olahraga", active: true },
          { name: "Paskibra & KSN", pembinaId: "", pembinaName: "Ustadzah Fatimah", category: "Akademik", active: true }
        ];

        for (const item of defaultList) {
          const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...item,
            createdAt: new Date().toISOString()
          });
          items.push({ id: docRef.id, ...item });
        }
      }

      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  },

  // Save / Update Extracurricular
  async saveExtracurricular(item: Partial<ERaporExtracurricular>, userEmail: string): Promise<void> {
    if (item.id) {
      const docRef = doc(db, COLLECTION_NAME, item.id);
      await updateDoc(docRef, { ...item, updatedAt: new Date().toISOString() });
    } else {
      await addDoc(collection(db, COLLECTION_NAME), {
        ...item,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: userEmail
      });
    }
  }
};
