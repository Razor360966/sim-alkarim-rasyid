import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import firebaseConfigJson from "../../firebase-applet-config.json";

// Read Firebase configuration from environment variables safely, falling back to firebase-applet-config.json
const metaEnv = (import.meta as any).env || {};
const apiKey = metaEnv.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey;
const authDomain = metaEnv.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain;
const projectId = metaEnv.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId;
const storageBucket = metaEnv.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket;
const messagingSenderId = metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId;
const appId = metaEnv.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId;
const firestoreDatabaseId = metaEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const measurementId = metaEnv.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfigJson.measurementId;

// Check if Firebase is properly configured
export const isFirebaseConfigured = !!(apiKey && projectId && appId);

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
};

let app: any = null;
let auth: any = null;
let db: any = null;

if (isFirebaseConfigured) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  // Support custom databaseId if configured, or fallback to default. Use persistent local cache.
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (err) {
    // If already initialized, fallback to getFirestore
    db = getFirestore(app);
  }
}

export { app, auth, db };
export default app;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMsg = error instanceof Error ? error.message : String(error);
  const isOffline = errMsg.toLowerCase().includes("offline") || 
                    errMsg.toLowerCase().includes("unavailable") || 
                    errMsg.toLowerCase().includes("network") ||
                    errMsg.toLowerCase().includes("failed to get document") ||
                    errMsg.toLowerCase().includes("timeout");

  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  if (isOffline) {
    console.warn('Firestore Offline/Network Warning: ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  throw new Error(JSON.stringify(errInfo));
}
