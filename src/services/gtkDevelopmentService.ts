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
import { GtkDevelopmentActivity, MutabaahIndicator, MutabaahLog } from "../types";

const ACTIVITIES_COLLECTION = "gtk_development_activities";
const INDICATORS_COLLECTION = "mutabaah_indicators";
const LOGS_COLLECTION = "mutabaah_logs";

// Default indicators for fallback and auto-populating
const DEFAULT_INDICATORS: Omit<MutabaahIndicator, "createdAt" | "updatedAt">[] = [
  { id: "shalat_berjamaah", name: "Shalat Berjamaah", isActive: true },
  { id: "shalat_dhuha", name: "Shalat Dhuha", isActive: true },
  { id: "tilawah_alquran", name: "Tilawah Al-Qur'an", isActive: true },
  { id: "murajah_hafalan", name: "Muraja'ah Hafalan", isActive: true },
  { id: "dzikir_pagi_petang", name: "Dzikir Pagi dan Petang", isActive: true },
  { id: "qiyamul_lail", name: "Qiyamul Lail", isActive: true },
  { id: "puasa_sunnah", name: "Puasa Sunnah", isActive: true },
  { id: "kajian_keislaman", name: "Kajian Keislaman", isActive: true },
  { id: "sedekah", name: "Sedekah", isActive: true },
  { id: "doa_harian", name: "Doa Harian", isActive: true }
];

export const gtkDevelopmentService = {
  // =========================================================================
  // ACTIVITIES OPERATIONS (PENGEMBANGAN DIRI)
  // =========================================================================

  async getActivities(academicYearId?: string, semesterId?: string, gtkId?: string): Promise<GtkDevelopmentActivity[]> {
    const colRef = collection(db, ACTIVITIES_COLLECTION);
    let q = query(colRef, orderBy("date", "desc"), orderBy("createdAt", "desc"));

    if (academicYearId && semesterId && gtkId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("gtkId", "==", gtkId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
      );
    } else if (academicYearId && semesterId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
      );
    } else if (gtkId) {
      q = query(
        colRef,
        where("gtkId", "==", gtkId),
        orderBy("date", "desc"),
        orderBy("createdAt", "desc")
      );
    }

    try {
      const querySnapshot = await getDocs(q);
      const items: GtkDevelopmentActivity[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as GtkDevelopmentActivity);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, ACTIVITIES_COLLECTION);
    }
  },

  async createActivity(
    data: Omit<GtkDevelopmentActivity, "id" | "createdAt" | "updatedAt">
  ): Promise<GtkDevelopmentActivity> {
    const colRef = collection(db, ACTIVITIES_COLLECTION);
    const newDocRef = doc(colRef);
    const now = new Date().toISOString();

    const newActivity: GtkDevelopmentActivity = {
      id: newDocRef.id,
      ...data,
      createdAt: now,
      updatedAt: now,
      isValidated: data.isValidated || false,
      validationNotes: data.validationNotes || ""
    };

    try {
      await setDoc(newDocRef, newActivity);
      return newActivity;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${ACTIVITIES_COLLECTION}/${newDocRef.id}`);
    }
  },

  async updateActivity(id: string, data: Partial<GtkDevelopmentActivity>): Promise<void> {
    const docRef = doc(db, ACTIVITIES_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${ACTIVITIES_COLLECTION}/${id}`);
    }
  },

  async deleteActivity(id: string): Promise<void> {
    const docRef = doc(db, ACTIVITIES_COLLECTION, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${ACTIVITIES_COLLECTION}/${id}`);
    }
  },

  async validateActivity(
    id: string,
    isValidated: boolean,
    validationNotes: string,
    validatedBy: string
  ): Promise<void> {
    const docRef = doc(db, ACTIVITIES_COLLECTION, id);
    const now = new Date().toISOString();

    try {
      await updateDoc(docRef, {
        isValidated,
        validationNotes,
        validatedBy,
        validatedAt: now,
        updatedAt: now
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${ACTIVITIES_COLLECTION}/${id}`);
    }
  },

  // =========================================================================
  // MUTABA'AH INDICATORS OPERATIONS (ADMIN ONLY)
  // =========================================================================

  async getMutabaahIndicators(): Promise<MutabaahIndicator[]> {
    const colRef = collection(db, INDICATORS_COLLECTION);
    try {
      const querySnapshot = await getDocs(colRef);
      const items: MutabaahIndicator[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MutabaahIndicator);
      });

      // If the database has no indicators, pre-populate it with standard defaults!
      if (items.length === 0) {
        const now = new Date().toISOString();
        for (const ind of DEFAULT_INDICATORS) {
          const docRef = doc(colRef, ind.id);
          const newInd: MutabaahIndicator = {
            id: ind.id,
            name: ind.name,
            isActive: ind.isActive,
            createdAt: now,
            updatedAt: now
          };
          await setDoc(docRef, newInd);
          items.push(newInd);
        }
      }

      return items;
    } catch (error) {
      // In case of error (e.g. offline or permission), return default indicators to keep app functional
      console.warn("Failed to fetch indicators from Firestore, using in-memory defaults", error);
      const now = new Date().toISOString();
      return DEFAULT_INDICATORS.map(ind => ({
        ...ind,
        createdAt: now,
        updatedAt: now
      }));
    }
  },

  async createMutabaahIndicator(name: string): Promise<MutabaahIndicator> {
    const colRef = collection(db, INDICATORS_COLLECTION);
    const sanitizedId = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const uniqueId = sanitizedId || `ind_${Date.now()}`;
    const docRef = doc(colRef, uniqueId);
    const now = new Date().toISOString();

    const newInd: MutabaahIndicator = {
      id: uniqueId,
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    try {
      await setDoc(docRef, newInd);
      return newInd;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INDICATORS_COLLECTION}/${uniqueId}`);
    }
  },

  async updateMutabaahIndicator(id: string, data: Partial<MutabaahIndicator>): Promise<void> {
    const docRef = doc(db, INDICATORS_COLLECTION, id);
    const updateData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(docRef, updateData);
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${INDICATORS_COLLECTION}/${id}`);
    }
  },

  async deleteMutabaahIndicator(id: string): Promise<void> {
    const docRef = doc(db, INDICATORS_COLLECTION, id);
    try {
      await deleteDoc(docRef);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${INDICATORS_COLLECTION}/${id}`);
    }
  },

  // =========================================================================
  // MUTABA'AH LOGS OPERATIONS (GURU / STAFF FILLING)
  // =========================================================================

  async getMutabaahLogs(academicYearId?: string, semesterId?: string, gtkId?: string): Promise<MutabaahLog[]> {
    const colRef = collection(db, LOGS_COLLECTION);
    let q = query(colRef, orderBy("date", "desc"));

    if (academicYearId && semesterId && gtkId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("gtkId", "==", gtkId),
        orderBy("date", "desc")
      );
    } else if (academicYearId && semesterId) {
      q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        orderBy("date", "desc")
      );
    } else if (gtkId) {
      q = query(
        colRef,
        where("gtkId", "==", gtkId),
        orderBy("date", "desc")
      );
    }

    try {
      const querySnapshot = await getDocs(q);
      const items: MutabaahLog[] = [];
      querySnapshot.forEach((docSnap) => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as MutabaahLog);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, LOGS_COLLECTION);
    }
  },

  async saveMutabaahLog(
    date: string,
    gtkId: string,
    gtkName: string,
    academicYearId: string,
    semesterId: string,
    indicators: { [key: string]: 'Terlaksana' | 'Belum Terlaksana' | 'Tidak Berlaku' }
  ): Promise<MutabaahLog> {
    const id = `${gtkId}_${date}`;
    const docRef = doc(db, LOGS_COLLECTION, id);
    const now = new Date().toISOString();

    const docSnap = await getDoc(docRef);
    let existingData = docSnap.exists() ? docSnap.data() : null;

    const logData: MutabaahLog = {
      id,
      date,
      gtkId,
      gtkName,
      academicYearId,
      semesterId,
      indicators: {
        ...(existingData?.indicators || {}),
        ...indicators
      },
      createdAt: existingData?.createdAt || now,
      updatedAt: now
    };

    try {
      await setDoc(docRef, logData);
      return logData;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${LOGS_COLLECTION}/${id}`);
    }
  }
};
