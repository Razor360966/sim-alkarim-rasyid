import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { Subject } from "../types";

const COLLECTION_NAME = "subjects";

export const subjectService = {

  // Get all subjects
  async getSubjects(): Promise<Subject[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy("name", "asc"));

    try {
      const querySnapshot = await getDocs(q);
      const items: Subject[] = [];

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const fallbackType: "UMUM" | "PONDOK" = data.subjectType || (data.categoryType === "diniyah_pondok" ? "PONDOK" : "UMUM");
        items.push({
          id: docSnap.id,
          ...data,
          subjectType: fallbackType,
          // Backward compatibility: undefined is treated as true (active)
          isActive: data.isActive !== false
        } as Subject);
      });

      return items;

    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.LIST,
        COLLECTION_NAME
      );
    }
  },

  // Check if subject is actively or historically referenced in other collections
  async checkSubjectUsage(subjectId: string): Promise<{ inUse: boolean; reasons: string[] }> {
    if (!subjectId) return { inUse: false, reasons: [] };

    const checks: { collection: string; label: string }[] = [
      { collection: "curriculum_matrix", label: "Struktur Kurikulum" },
      { collection: "schedules", label: "Jadwal Pelajaran" },
      { collection: "annual_programs", label: "Program Tahunan (Prota)" },
      { collection: "semester_programs", label: "Program Semester (Prosem)" },
      { collection: "lesson_plans", label: "Modul Ajar / RPP" },
      { collection: "erapor_assessments", label: "Penilaian e-Rapor" },
      { collection: "teaching_journals", label: "Jurnal Mengajar" },
      { collection: "teacher_teaching_attendances", label: "Presensi Guru" }
    ];

    const reasons: string[] = [];

    try {
      await Promise.all(
        checks.map(async (check) => {
          try {
            const cRef = collection(db, check.collection);
            const q = query(cRef, where("subjectId", "==", subjectId), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              reasons.push(check.label);
            }
          } catch {
            // Ignore collection permission or index issues during safety scan
          }
        })
      );

      return {
        inUse: reasons.length > 0,
        reasons
      };
    } catch {
      return { inUse: false, reasons: [] };
    }
  },

  // Deactivate subject (soft delete)
  async deactivateSubject(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, { isActive: false });
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  },

  // Activate subject
  async activateSubject(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, { isActive: true });
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  },

  // Create subject
  async createSubject(
    data: Omit<Subject, "id" | "createdAt">
  ): Promise<Subject> {
    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);

    const newSubject: Subject = {
      id: newDocRef.id,
      ...data,
      isActive: data.isActive !== false,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(newDocRef, newSubject);
      return newSubject;
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${newDocRef.id}`
      );
    }
  },

  // Update subject
  async updateSubject(
    id: string,
    data: Partial<Subject>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);

    try {
      await updateDoc(docRef, data);
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  },

  // Delete subject with soft-delete safety barrier
  async deleteSubject(
    id: string,
    force: boolean = false
  ): Promise<{ deleted: boolean; deactivated?: boolean; message: string }> {
    const docRef = doc(db, COLLECTION_NAME, id);

    try {
      if (!force) {
        const usage = await this.checkSubjectUsage(id);
        if (usage.inUse) {
          await this.deactivateSubject(id);
          return {
            deleted: false,
            deactivated: true,
            message: `Mata pelajaran memiliki relasi aktif di ${usage.reasons.join(", ")}. Status otomatis dialihkan ke NONAKTIF demi menjaga keutuhan data historis.`
          };
        }
      }

      await deleteDoc(docRef);
      return {
        deleted: true,
        deactivated: false,
        message: "Mata pelajaran berhasil dihapus permanen."
      };
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.DELETE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  }

};