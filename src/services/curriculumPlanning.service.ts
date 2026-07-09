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
import { AnnualProgram, SemesterProgram, PromesAllocation, ProtaTopic, ProtaSubTopic } from "../types";

const PROTA_COLLECTION = "annual_programs";
const PROMES_COLLECTION = "semester_programs";
const LOG_COLLECTION = "activity_logs";

// Log Activity Helper
async function logActivity(
  userId: string, 
  userName: string, 
  action: string, 
  collectionName: string, 
  documentId: string, 
  description: string
) {
  try {
    const logsRef = collection(db, LOG_COLLECTION);
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: collectionName,
      documentId,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write curriculum planning activity log:", error);
  }
}

// Deeply remove undefined properties from an object/array so Firestore doesn't throw setDoc() validation errors
function removeUndefinedFields<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)) as unknown as T;
  } else if (obj !== null && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = removeUndefinedFields(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

export const curriculumPlanningService = {
  // --- PROGRAM TAHUNAN (PROTA) ---

  // Get specific Prota
  async getAnnualProgram(
    academicYearId: string, 
    classId: string, 
    subjectId: string
  ): Promise<AnnualProgram | null> {
    try {
      const docId = `${academicYearId}_${classId}_${subjectId}`;
      const docRef = doc(db, PROTA_COLLECTION, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as AnnualProgram;
      }
      return null;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${PROTA_COLLECTION}`);
    }
  },

  // Save Prota (Create/Update)
  async saveAnnualProgram(
    prota: Omit<AnnualProgram, "createdAt" | "updatedAt">,
    userId: string,
    userName: string
  ): Promise<AnnualProgram> {
    try {
      const docId = prota.id || `${prota.academicYearId}_${prota.classId}_${prota.subjectId}`;
      const docRef = doc(db, PROTA_COLLECTION, docId);
      const docSnap = await getDoc(docRef);
      
      const now = new Date().toISOString();
      let finalProta: AnnualProgram;

      if (docSnap.exists()) {
        const existing = docSnap.data() as AnnualProgram;
        finalProta = {
          ...existing,
          ...prota,
          id: docId,
          updatedAt: now,
          updatedBy: userId
        };
        await setDoc(docRef, removeUndefinedFields(finalProta));
        await logActivity(
          userId,
          userName,
          "EDIT_PROTA",
          PROTA_COLLECTION,
          docId,
          `Memperbarui Program Tahunan TP ${prota.academicYearName} - Kelas ${prota.className} - Mapel ${prota.subjectName}`
        );
      } else {
        finalProta = {
          ...prota,
          id: docId,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId
        };
        await setDoc(docRef, removeUndefinedFields(finalProta));
        await logActivity(
          userId,
          userName,
          "ADD_PROTA",
          PROTA_COLLECTION,
          docId,
          `Membuat Program Tahunan baru TP ${prota.academicYearName} - Kelas ${prota.className} - Mapel ${prota.subjectName}`
        );
      }
      return finalProta;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, PROTA_COLLECTION);
    }
  },

  // Delete Prota
  async deleteAnnualProgram(id: string, userId: string, userName: string): Promise<void> {
    try {
      const docRef = doc(db, PROTA_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as AnnualProgram;
        await deleteDoc(docRef);
        await logActivity(
          userId,
          userName,
          "DELETE_PROTA",
          PROTA_COLLECTION,
          id,
          `Menghapus Program Tahunan TP ${data.academicYearName} - Kelas ${data.className} - Mapel ${data.subjectName}`
        );
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${PROTA_COLLECTION}/${id}`);
    }
  },

  // --- PROGRAM SEMESTER (PROMES) ---

  // Get specific Promes
  async getSemesterProgram(
    academicYearId: string,
    semesterId: string,
    classId: string,
    subjectId: string
  ): Promise<SemesterProgram | null> {
    try {
      const docId = `${academicYearId}_${semesterId}_${classId}_${subjectId}`;
      const docRef = doc(db, PROMES_COLLECTION, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SemesterProgram;
      }
      return null;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${PROMES_COLLECTION}`);
    }
  },

  // Save Promes
  async saveSemesterProgram(
    promes: Omit<SemesterProgram, "createdAt" | "updatedAt">,
    userId: string,
    userName: string,
    isSyncAction: boolean = false
  ): Promise<SemesterProgram> {
    try {
      const docId = promes.id || `${promes.academicYearId}_${promes.semesterId}_${promes.classId}_${promes.subjectId}`;
      const docRef = doc(db, PROMES_COLLECTION, docId);
      const docSnap = await getDoc(docRef);
      
      const now = new Date().toISOString();
      let finalPromes: SemesterProgram;

      if (docSnap.exists()) {
        const existing = docSnap.data() as SemesterProgram;
        finalPromes = {
          ...existing,
          ...promes,
          id: docId,
          updatedAt: now,
          updatedBy: userId
        };
        await setDoc(docRef, removeUndefinedFields(finalPromes));
        await logActivity(
          userId,
          userName,
          isSyncAction ? "SYNC_PROMES" : "EDIT_PROMES",
          PROMES_COLLECTION,
          docId,
          isSyncAction 
            ? `Sinkronisasi Program Semester dari Prota: TP ${promes.academicYearName} (${promes.semesterName}) - Kelas ${promes.className} - Mapel ${promes.subjectName}`
            : `Memperbarui Program Semester TP ${promes.academicYearName} (${promes.semesterName}) - Kelas ${promes.className} - Mapel ${promes.subjectName}`
        );
      } else {
        finalPromes = {
          ...promes,
          id: docId,
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId
        };
        await setDoc(docRef, removeUndefinedFields(finalPromes));
        await logActivity(
          userId,
          userName,
          "ADD_PROMES",
          PROMES_COLLECTION,
          docId,
          `Membuat Program Semester baru TP ${promes.academicYearName} (${promes.semesterName}) - Kelas ${promes.className} - Mapel ${promes.subjectName}`
        );
      }
      return finalPromes;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, PROMES_COLLECTION);
    }
  },

  // Delete Promes
  async deleteSemesterProgram(id: string, userId: string, userName: string): Promise<void> {
    try {
      const docRef = doc(db, PROMES_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as SemesterProgram;
        await deleteDoc(docRef);
        await logActivity(
          userId,
          userName,
          "DELETE_PROMES",
          PROMES_COLLECTION,
          id,
          `Menghapus Program Semester TP ${data.academicYearName} (${data.semesterName}) - Kelas ${data.className} - Mapel ${data.subjectName}`
        );
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${PROMES_COLLECTION}/${id}`);
    }
  },

  // Log activity from UI directly
  async logPlanningActivity(
    userId: string,
    userName: string,
    action: string,
    collectionName: string,
    documentId: string,
    description: string
  ): Promise<void> {
    await logActivity(userId, userName, action, collectionName, documentId, description);
  },

  // Get all Prota
  async getAllAnnualPrograms(): Promise<AnnualProgram[]> {
    try {
      const snap = await getDocs(collection(db, PROTA_COLLECTION));
      const list: AnnualProgram[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as AnnualProgram);
      });
      return list;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, PROTA_COLLECTION);
    }
  },

  // Get all Prosem
  async getAllSemesterPrograms(): Promise<SemesterProgram[]> {
    try {
      const snap = await getDocs(collection(db, PROMES_COLLECTION));
      const list: SemesterProgram[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as SemesterProgram);
      });
      return list;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, PROMES_COLLECTION);
    }
  }
};
