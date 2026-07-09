import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { Student } from "../types";

const COLLECTION_NAME = "students";

export const studentService = {
  // Get all students sorted by name
  async getStudents(): Promise<Student[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy("name", "asc"));
    try {
      const querySnapshot = await getDocs(q);
      const items: Student[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Student);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Create new student
  async createStudent(data: Omit<Student, "id" | "createdAt">): Promise<Student> {
    const colRef = collection(db, COLLECTION_NAME);
    const newDocRef = doc(colRef);
    const id = newDocRef.id;

    const newStudent: Student = {
      id,
      ...data,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(newDocRef, newStudent);
      return newStudent;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Update student
  async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, data);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Delete student
  async deleteStudent(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Bulk import students using Firestore WriteBatch (safely chunked by 500)
  async importStudents(students: Omit<Student, "id" | "createdAt">[]): Promise<void> {
    const chunks: Omit<Student, "id" | "createdAt">[][] = [];
    const size = 450; // Use a conservative chunk size less than 500
    
    for (let i = 0; i < students.length; i += size) {
      chunks.push(students.slice(i, i + size));
    }

    try {
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        
        chunk.forEach((std) => {
          const docRef = doc(collection(db, COLLECTION_NAME));
          const newStudent: Student = {
            id: docRef.id,
            ...std,
            createdAt: new Date().toISOString()
          };
          batch.set(docRef, newStudent);
        });

        await batch.commit();
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  }
};
