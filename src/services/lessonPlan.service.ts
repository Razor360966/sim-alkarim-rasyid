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
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { LessonPlan } from "../types";

const COLLECTION_NAME = "lesson_plans";
const LOG_COLLECTION = "activity_logs";

async function logActivity(
  userId: string, 
  userName: string, 
  action: string, 
  documentId: string, 
  description: string
) {
  try {
    const logsRef = collection(db, LOG_COLLECTION);
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      documentId,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write lesson plans activity log:", error);
  }
}

export const lessonPlanService = {
  // Get all lesson plans (with optional filters)
  async getLessonPlans(filters?: {
    academicYearId?: string;
    semesterId?: string;
    classId?: string;
    subjectId?: string;
    teacherId?: string;
  }): Promise<LessonPlan[]> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let q = query(colRef);

      if (filters) {
        if (filters.academicYearId) {
          q = query(q, where("academicYearId", "==", filters.academicYearId));
        }
        if (filters.semesterId) {
          q = query(q, where("semesterId", "==", filters.semesterId));
        }
        if (filters.classId) {
          q = query(q, where("classId", "==", filters.classId));
        }
        if (filters.subjectId) {
          q = query(q, where("subjectId", "==", filters.subjectId));
        }
        if (filters.teacherId) {
          q = query(q, where("teacherId", "==", filters.teacherId));
        }
      }

      const snap = await getDocs(q);
      const list: LessonPlan[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          ...data,
          id: docSnap.id,
        } as LessonPlan);
      });

      return list;
    } catch (error: any) {
      throw new Error(handleFirestoreError(error, OperationType.GET, COLLECTION_NAME));
    }
  },

  // Save lesson plan (creates new or overwrites existing)
  async saveLessonPlan(
    lessonPlan: Omit<LessonPlan, "createdAt" | "updatedAt"> & { id?: string },
    userId: string,
    userName: string
  ): Promise<LessonPlan> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let targetId = lessonPlan.id;
      const now = new Date().toISOString();

      let isNew = false;
      if (!targetId) {
        const newDocRef = doc(colRef);
        targetId = newDocRef.id;
        isNew = true;
      }

      const docRef = doc(db, COLLECTION_NAME, targetId);

      let finalData: LessonPlan;
      if (isNew) {
        finalData = {
          ...lessonPlan,
          id: targetId,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId
        } as LessonPlan;
      } else {
        const existingSnap = await getDoc(docRef);
        const existingData = existingSnap.exists() ? existingSnap.data() : {};
        
        finalData = {
          ...existingData,
          ...lessonPlan,
          id: targetId,
          updatedAt: now,
          updatedBy: userId
        } as LessonPlan;
      }

      await setDoc(docRef, finalData);

      await logActivity(
        userId,
        userName,
        isNew ? "CREATE" : "UPDATE",
        targetId,
        `${isNew ? "Membuat" : "Memperbarui"} Modul Ajar: ${lessonPlan.title} (${lessonPlan.subjectName})`
      );

      return finalData;
    } catch (error: any) {
      throw new Error(handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME));
    }
  },

  // Delete lesson plan
  async deleteLessonPlan(
    id: string,
    userId: string,
    userName: string,
    title: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);

      await logActivity(
        userId,
        userName,
        "DELETE",
        id,
        `Menghapus Modul Ajar: ${title}`
      );
    } catch (error: any) {
      throw new Error(handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME));
    }
  }
};
