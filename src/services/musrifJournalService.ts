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
  orderBy,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { MusrifJournal, MusrifJournalDetail } from "../types";

const JOURNALS_COLLECTION = "musrif_journals";
const DETAILS_COLLECTION = "musrif_journal_details";

// Helper to sanitize objects for Firestore (removes any undefined properties recursively)
export function cleanUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = cleanUndefinedFields(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export const musrifJournalService = {
  // Get all journals
  async getAll(academicYearId?: string, semesterId?: string): Promise<MusrifJournal[]> {
    const colRef = collection(db, JOURNALS_COLLECTION);
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
      const items: MusrifJournal[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MusrifJournal);
      });
      // Sort in memory: date DESC, then createdAt DESC
      items.sort((a, b) => {
        const dateCompare = (b.date || "").localeCompare(a.date || "");
        if (dateCompare !== 0) return dateCompare;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JOURNALS_COLLECTION);
    }
  },

  // Get journals by musrif (supports single ID or array of candidate IDs)
  async getByMusrif(
    musrifId: string | string[],
    academicYearId?: string,
    semesterId?: string
  ): Promise<MusrifJournal[]> {
    const colRef = collection(db, JOURNALS_COLLECTION);
    const ids = (Array.isArray(musrifId) ? musrifId : [musrifId]).filter(
      (id): id is string => typeof id === "string" && id.trim() !== ""
    );

    if (ids.length === 0) {
      return [];
    }

    let q = query(colRef);
    if (ids.length === 1) {
      if (academicYearId && semesterId) {
        q = query(
          colRef,
          where("musrifId", "==", ids[0]),
          where("academicYearId", "==", academicYearId),
          where("semesterId", "==", semesterId)
        );
      } else if (academicYearId) {
        q = query(
          colRef,
          where("musrifId", "==", ids[0]),
          where("academicYearId", "==", academicYearId)
        );
      } else {
        q = query(colRef, where("musrifId", "==", ids[0]));
      }
    } else {
      if (academicYearId && semesterId) {
        q = query(
          colRef,
          where("musrifId", "in", ids.slice(0, 10)),
          where("academicYearId", "==", academicYearId),
          where("semesterId", "==", semesterId)
        );
      } else if (academicYearId) {
        q = query(
          colRef,
          where("musrifId", "in", ids.slice(0, 10)),
          where("academicYearId", "==", academicYearId)
        );
      } else {
        q = query(colRef, where("musrifId", "in", ids.slice(0, 10)));
      }
    }

    try {
      const querySnapshot = await getDocs(q);
      const items: MusrifJournal[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MusrifJournal);
      });
      // Sort in memory: date DESC, then createdAt DESC
      items.sort((a, b) => {
        const dateCompare = (b.date || "").localeCompare(a.date || "");
        if (dateCompare !== 0) return dateCompare;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JOURNALS_COLLECTION);
    }
  },

  // Get journals by date
  async getByDate(date: string): Promise<MusrifJournal[]> {
    const colRef = collection(db, JOURNALS_COLLECTION);
    const q = query(colRef, where("date", "==", date));

    try {
      const querySnapshot = await getDocs(q);
      const items: MusrifJournal[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MusrifJournal);
      });
      // Sort in memory: createdAt DESC
      items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JOURNALS_COLLECTION);
    }
  },

  // Create journal & its details atomically with writeBatch
  async create(
    journalData: Omit<MusrifJournal, "id" | "createdAt" | "updatedAt">,
    details: Omit<MusrifJournalDetail, "id" | "journalId" | "createdAt" | "updatedAt">[]
  ): Promise<MusrifJournal> {
    const colRef = collection(db, JOURNALS_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();

    const newJournal: MusrifJournal = {
      id: newDocRef.id,
      ...journalData,
      createdAt: now,
      updatedAt: now
    };

    try {
      const batch = writeBatch(db);

      // 1. Stage sanitized journal header
      batch.set(newDocRef, cleanUndefinedFields(newJournal));

      // 2. Stage sanitized journal details per student with explicit ownership metadata
      const detailsColRef = collection(db, DETAILS_COLLECTION);
      details.forEach((detail) => {
        const detailDocRef = doc(detailsColRef);
        const newDetail: MusrifJournalDetail = {
          id: detailDocRef.id,
          journalId: newDocRef.id,
          ...detail,
          musrifId: journalData.musrifId,
          createdBy: journalData.createdBy,
          createdAt: now,
          updatedAt: now
        };
        batch.set(detailDocRef, cleanUndefinedFields(newDetail));
      });

      // Atomic commit: header + all details succeed together or fail together
      await batch.commit();
      return newJournal;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${JOURNALS_COLLECTION}/${newDocRef.id}`);
    }
  },

  // Update journal & its details atomically with writeBatch
  async update(
    id: string,
    journalData: Partial<MusrifJournal>,
    details?: (Omit<MusrifJournalDetail, "id" | "journalId" | "createdAt" | "updatedAt"> & { studentId: string })[]
  ): Promise<void> {
    const docRef = doc(db, JOURNALS_COLLECTION, id);
    const now = new Date().toISOString();

    try {
      const batch = writeBatch(db);

      // 1. Update sanitized journal header
      batch.update(docRef, cleanUndefinedFields({
        ...journalData,
        updatedAt: now
      }));

      // 2. Update journal details if supplied
      if (details && details.length > 0) {
        const detailsColRef = collection(db, DETAILS_COLLECTION);
        
        // Load existing details for this journal
        const q = query(detailsColRef, where("journalId", "==", id));
        const querySnapshot = await getDocs(q);
        
        // Map of studentId to detailDocRef
        const existingDetailsMap: Record<string, string> = {};
        querySnapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.studentId) {
            existingDetailsMap[d.studentId] = docSnap.id;
          }
        });

        details.forEach((detail) => {
          const existingId = existingDetailsMap[detail.studentId];
          if (existingId) {
            // Update existing detail
            const itemRef = doc(db, DETAILS_COLLECTION, existingId);
            batch.update(itemRef, cleanUndefinedFields({
              ...detail,
              ...(journalData.musrifId ? { musrifId: journalData.musrifId } : {}),
              ...(journalData.updatedBy ? { updatedBy: journalData.updatedBy } : {}),
              updatedAt: now
            }));
          } else {
            // Create new detail (e.g. if student added late)
            const itemRef = doc(detailsColRef);
            const newDetail: MusrifJournalDetail = {
              id: itemRef.id,
              journalId: id,
              ...detail,
              ...(journalData.musrifId ? { musrifId: journalData.musrifId } : {}),
              ...(journalData.updatedBy ? { createdBy: journalData.updatedBy, updatedBy: journalData.updatedBy } : {}),
              createdAt: now,
              updatedAt: now
            };
            batch.set(itemRef, cleanUndefinedFields(newDetail));
          }
        });
      }

      await batch.commit();
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${JOURNALS_COLLECTION}/${id}`);
    }
  },

  // Delete journal and its details
  async delete(id: string): Promise<void> {
    const docRef = doc(db, JOURNALS_COLLECTION, id);

    try {
      // Delete header
      await deleteDoc(docRef);

      // Delete details
      const detailsColRef = collection(db, DETAILS_COLLECTION);
      const q = query(detailsColRef, where("journalId", "==", id));
      const querySnapshot = await getDocs(q);

      const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${JOURNALS_COLLECTION}/${id}`);
    }
  },

  // Change Status
  async changeStatus(id: string, status: "Draft" | "Selesai", userId: string): Promise<void> {
    const docRef = doc(db, JOURNALS_COLLECTION, id);

    try {
      await updateDoc(docRef, {
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${JOURNALS_COLLECTION}/${id}`);
    }
  },

  // Get Journal Details list
  async getJournalDetails(journalId: string): Promise<MusrifJournalDetail[]> {
    const colRef = collection(db, DETAILS_COLLECTION);
    const q = query(colRef, where("journalId", "==", journalId));

    try {
      const querySnapshot = await getDocs(q);
      const items: MusrifJournalDetail[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MusrifJournalDetail);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, DETAILS_COLLECTION);
    }
  },

  // Get all journal details across all journals
  async getAllJournalDetails(): Promise<MusrifJournalDetail[]> {
    const colRef = collection(db, DETAILS_COLLECTION);
    try {
      const querySnapshot = await getDocs(colRef);
      const items: MusrifJournalDetail[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MusrifJournalDetail);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, DETAILS_COLLECTION);
    }
  }
};
