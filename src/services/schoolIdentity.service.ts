import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { APP_CONFIG, AppConfig } from "../config/appConfig";

const COLLECTION_NAME = "school_settings";
const DOCUMENT_ID = "identity";

export const schoolIdentityService = {
  async getIdentity(): Promise<AppConfig> {
    try {
      const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...APP_CONFIG,
          ...data
        };
      }
    } catch (error) {
      console.warn("Using baseline APP_CONFIG due to Firestore fetch state:", error);
    }
    return APP_CONFIG;
  },

  async updateIdentity(identityData: Partial<AppConfig>, userName?: string): Promise<AppConfig> {
    const docRef = doc(db, COLLECTION_NAME, DOCUMENT_ID);
    const updated = {
      ...APP_CONFIG,
      ...identityData,
      updatedAt: serverTimestamp(),
      updatedBy: userName || "Admin"
    };
    await setDoc(docRef, updated, { merge: true });
    return updated as AppConfig;
  }
};
