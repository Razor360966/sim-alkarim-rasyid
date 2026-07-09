import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { SchoolSettings } from "../types";

const COLLECTION_NAME = "school_settings";
const DOCUMENT_ID = "settings";

export async function logSettingsActivity(
  userId: string, 
  userName: string, 
  action: string, 
  description: string
) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      documentId: DOCUMENT_ID,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
}

// Default settings as required by prompt
const DEFAULT_SETTINGS: SchoolSettings = {
  settingId: DOCUMENT_ID,
  activeDays: ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"],
  startTime: "07:00",
  endTime: "14:00",
  jpDuration: 40,
  morningAssembly: {
    enabled: true,
    start: "07:00",
    duration: 10,
    end: "07:10"
  },
  specialActivities: [],
  breakTimes: [],
  jpStructure: [],
  routineActivities: [],
  schoolHours: {
    startTime: "07:00",
    endTime: "14:00"
  },
  lessonPeriod: 40
};

export const schoolSettingsService = {
  // Get settings document or initialize with defaults if not found
  async getSettings(): Promise<SchoolSettings> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Return merged data with defaults in case of missing fields
        return {
          ...DEFAULT_SETTINGS,
          ...data,
          settingId: DOCUMENT_ID,
          morningAssembly: {
            ...DEFAULT_SETTINGS.morningAssembly,
            ...(data.morningAssembly || {})
          },
          specialActivities: data.specialActivities || DEFAULT_SETTINGS.specialActivities,
          breakTimes: data.breakTimes || DEFAULT_SETTINGS.breakTimes,
          jpStructure: data.jpStructure || DEFAULT_SETTINGS.jpStructure,
          routineActivities: data.routineActivities || DEFAULT_SETTINGS.routineActivities,
          schoolHours: data.schoolHours || {
            startTime: data.startTime || DEFAULT_SETTINGS.startTime,
            endTime: data.endTime || DEFAULT_SETTINGS.endTime
          },
          lessonPeriod: data.lessonPeriod || data.jpDuration || DEFAULT_SETTINGS.lessonPeriod,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        } as SchoolSettings;
      } else {
        // Document does not exist, let's create and seed it
        console.log("School Settings not found");
        console.log("Creating default settings...");
        
        const newSettings = {
          ...DEFAULT_SETTINGS,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: "system"
        };
        
        await setDoc(docRef, newSettings);
        
        console.log("School Settings created");
        console.log("Reload success");
        
        return {
          ...DEFAULT_SETTINGS,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${DOCUMENT_ID}`);
    }
  },

  // Save/Update school settings
  async updateSettings(
    settings: SchoolSettings,
    operatorId: string,
    operatorName: string,
    customDescription?: string
  ): Promise<SchoolSettings> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      
      const payload = {
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: operatorId
      };
      
      await setDoc(docRef, payload, { merge: true });

      // Generate activity log descriptions based on what changed
      const logDesc = customDescription || `Memperbarui Pengaturan Sekolah (Apel pagi: ${settings.morningAssembly.enabled ? 'Aktif' : 'Nonaktif'}, Upacara/Senam disesuaikan, JP tetap ${settings.jpDuration} menit).`;
      
      await logSettingsActivity(
        operatorId,
        operatorName,
        "UPDATE_SETTINGS",
        logDesc
      );

      return {
        ...settings,
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${DOCUMENT_ID}`);
    }
  }
};
