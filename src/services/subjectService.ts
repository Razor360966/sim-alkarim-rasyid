import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
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
        items.push({
          id: docSnap.id,
          ...docSnap.data()
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

  // Create subject
  async createSubject(
    data: Omit<Subject, "id" | "createdAt">
  ): Promise<Subject> {

    console.log("=== CREATE SUBJECT DIPANGGIL ===");
    console.log(data);

    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);

    const newSubject: Subject = {
      id: newDocRef.id,
      ...data,
      createdAt: new Date().toISOString()
    };

    try {

      console.log("DB =", db);
      console.log("Akan disimpan =", newSubject);

      await setDoc(newDocRef, newSubject);

      console.log("✅ BERHASIL DISIMPAN");

      return newSubject;

    } catch (error) {

      console.error("❌ ERROR FIRESTORE", error);

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

  // Delete subject
  async deleteSubject(id: string): Promise<void> {

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
  }

};