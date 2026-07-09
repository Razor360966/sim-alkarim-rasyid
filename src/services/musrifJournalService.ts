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
import { MusrifJournal, MusrifJournalDetail } from "../types";

const JOURNALS_COLLECTION = "musrif_journals";
const DETAILS_COLLECTION = "musrif_journal_details";

export const musrifJournalService = {
  // Get all journals
  async getAll(academicYearId?: string, semesterId?: string): Promise<MusrifJournal[]> {
    const colRef = collection(db, JOURNALS_COLLECTION);
    let q = query(colRef, orderBy("date", "desc"), orderBy("createdAt", "desc"));

    if (academicYearId && semesterId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
      );
    } else if (academicYearId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
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
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JOURNALS_COLLECTION);
    }
  },

  // Get journals by musrif
  async getByMusrif(
    musrifId: string,
    academicYearId?: string,
    semesterId?: string
  ): Promise<MusrifJournal[]> {
    const colRef = collection(db, JOURNALS_COLLECTION);
    let q = query(
      colRef,
      where("musrifId", "==", musrifId),
      orderBy("date", "desc"),
      orderBy("createdAt", "desc")
    );

    if (academicYearId && semesterId) {
      q = query(
        colRef,
        where("musrifId", "==", musrifId),
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
      );
    } else if (academicYearId) {
      q = query(
        colRef,
        where("musrifId", "==", musrifId),
        where("academicYearId", "==", academicYearId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
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
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JOURNALS_COLLECTION);
    }
  },

  // Get journals by date
  async getByDate(date: string): Promise<MusrifJournal[]> {
    const colRef = collection(db, JOURNALS_COLLECTION);
    const q = query(colRef, where("date", "==", date), orderBy("createdAt", "desc"));

    try {
      const querySnapshot = await getDocs(q);
      const items: MusrifJournal[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MusrifJournal);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, JOURNALS_COLLECTION);
    }
  },

  // Create journal & its details
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
      // 1. Save journal header
      await setDoc(newDocRef, newJournal);

      // 2. Save journal details per student
      const detailsColRef = collection(db, DETAILS_COLLECTION);
      const detailPromises = details.map(async (detail) => {
        const detailDocRef = doc(detailsColRef);
        const newDetail: MusrifJournalDetail = {
          id: detailDocRef.id,
          journalId: newDocRef.id,
          ...detail,
          createdAt: now,
          updatedAt: now
        };
        return setDoc(detailDocRef, newDetail);
      });

      await Promise.all(detailPromises);
      return newJournal;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${JOURNALS_COLLECTION}/${newDocRef.id}`);
    }
  },

  // Update journal & its details
  async update(
    id: string,
    journalData: Partial<MusrifJournal>,
    details?: (Omit<MusrifJournalDetail, "id" | "journalId" | "createdAt" | "updatedAt"> & { studentId: string })[]
  ): Promise<void> {
    const docRef = doc(db, JOURNALS_COLLECTION, id);
    const now = new Date().toISOString();

    try {
      // 1. Update journal header
      await updateDoc(docRef, {
        ...journalData,
        updatedAt: now
      });

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

        const detailPromises = details.map(async (detail) => {
          const existingId = existingDetailsMap[detail.studentId];
          if (existingId) {
            // Update existing detail
            const itemRef = doc(db, DETAILS_COLLECTION, existingId);
            return updateDoc(itemRef, {
              ...detail,
              updatedAt: now
            });
          } else {
            // Create new detail (e.g. if student added late)
            const itemRef = doc(detailsColRef);
            const newDetail: MusrifJournalDetail = {
              id: itemRef.id,
              journalId: id,
              ...detail,
              createdAt: now,
              updatedAt: now
            };
            return setDoc(itemRef, newDetail);
          }
        });

        await Promise.all(detailPromises);
      }
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
  }
};
