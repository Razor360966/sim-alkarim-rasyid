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
import { TeachingJournal } from "../types";

const COLLECTION_NAME = "teaching_journals";

export const teachingJournalService = {
  // Get all journals
  async getAll(academicYearId?: string, semesterId?: string): Promise<TeachingJournal[]> {
    const colRef = collection(db, COLLECTION_NAME);
    let q = query(colRef);

    if (academicYearId && semesterId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId)
      );
    } else if (academicYearId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId)
      );
    }

    try {
      const querySnapshot = await getDocs(q);
      const items: TeachingJournal[] = [];

      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as TeachingJournal);
      });

      // Sort client-side by date desc, then createdAt desc
      items.sort((a, b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        const createdA = a.createdAt || "";
        const createdB = b.createdAt || "";
        return createdB.localeCompare(createdA);
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

  // Get journals by teacher
  async getByTeacher(
    teacherId: string,
    academicYearId?: string,
    semesterId?: string
  ): Promise<TeachingJournal[]> {
    const colRef = collection(db, COLLECTION_NAME);
    let q = query(
      colRef,
      where("teacherId", "==", teacherId)
    );

    if (academicYearId && semesterId) {
      q = query(
        colRef,
        where("teacherId", "==", teacherId),
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId)
      );
    } else if (academicYearId) {
      q = query(
        colRef,
        where("teacherId", "==", teacherId),
        where("academicYearId", "==", academicYearId)
      );
    }

    try {
      const querySnapshot = await getDocs(q);
      const items: TeachingJournal[] = [];

      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as TeachingJournal);
      });

      // Sort client-side by date desc, then createdAt desc
      items.sort((a, b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        const createdA = a.createdAt || "";
        const createdB = b.createdAt || "";
        return createdB.localeCompare(createdA);
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

  // Get journals by date
  async getByDate(date: string): Promise<TeachingJournal[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(
      colRef,
      where("date", "==", date)
    );

    try {
      const querySnapshot = await getDocs(q);
      const items: TeachingJournal[] = [];

      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as TeachingJournal);
      });

      // Sort client-side by createdAt desc
      items.sort((a, b) => {
        const createdA = a.createdAt || "";
        const createdB = b.createdAt || "";
        return createdB.localeCompare(createdA);
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

  // Create journal
  async create(
    data: Omit<TeachingJournal, "id" | "createdAt" | "updatedAt">
  ): Promise<TeachingJournal> {
    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);

    const now = new Date().toISOString();
    const newJournal: TeachingJournal = {
      id: newDocRef.id,
      ...data,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(newDocRef, newJournal);
      return newJournal;
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${newDocRef.id}`
      );
    }
  },

  // Update journal
  async update(
    id: string,
    data: Partial<TeachingJournal>
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  },

  // Delete journal
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);

    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.DELETE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  },

  // Change Status
  async changeStatus(
    id: string,
    status: "Draft" | "Diajukan" | "Disetujui" | "Ditolak",
    userId: string,
    verificationComment?: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);

    try {
      const updateData: any = {
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };

      if (status === "Disetujui" || status === "Ditolak") {
        updateData.verifiedBy = userId;
        updateData.verifiedAt = new Date().toISOString();
        updateData.verificationComment = verificationComment || "";
      }

      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(
        error,
        OperationType.WRITE,
        `${COLLECTION_NAME}/${id}`
      );
    }
  }
};
