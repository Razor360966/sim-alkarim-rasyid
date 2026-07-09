import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  updateDoc, 
  query, 
  where,
  serverTimestamp,
  addDoc,
  orderBy,
  limit
} from "firebase/firestore";
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, handleFirestoreError, OperationType, auth } from "../firebase/config";
import { UserSystem } from "../types";
import firebaseConfigJson from "../../firebase-applet-config.json";

const COLLECTION_NAME = "users";

export const ROLE_PRIORITIES = [
  "ketua yayasan",
  "kepala sekolah",
  "wakil kepala sekolah",
  "guru",
  "musrif",
  "tata usaha",
  "operator",
  "admin"
];

export function getPrimaryRole(roles: string[]): string {
  if (!roles || roles.length === 0) return "operator";
  for (const r of ROLE_PRIORITIES) {
    if (roles.includes(r)) {
      return r;
    }
  }
  return roles[0]; // fallback
}

export function getBrowserAndOS() {
  const ua = navigator.userAgent;
  let browser = "Unknown Browser";
  let os = "Unknown OS";

  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
  else if (ua.includes("Opera") || ua.includes("OPR")) browser = "Opera";
  else if (ua.includes("Trident")) browser = "Internet Explorer";
  else if (ua.includes("Edge") || ua.includes("Edg")) browser = "Microsoft Edge";
  else if (ua.includes("Chrome")) browser = "Google Chrome";
  else if (ua.includes("Safari")) browser = "Apple Safari";

  if (ua.includes("Windows NT 10.0")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.2")) os = "Windows 8";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

// Helper function to log activities to "activity_logs" collection
export async function logActivity(
  userId: string, 
  userName: string, 
  action: string, 
  docId: string, 
  description: string
) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      documentId: docId,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
  }
}

export const userService = {
  logActivity,
  // Get all users (excluding soft-deleted)
  async getUsers(): Promise<UserSystem[]> {
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const querySnapshot = await getDocs(colRef);
      const items: UserSystem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted !== true) {
          const roles = data.roles || (data.role ? [data.role] : ["operator"]);
          items.push({
            id: doc.id,
            userId: doc.id,
            ...data,
            roles,
            role: getPrimaryRole(roles),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
            lastLogin: data.lastLogin?.toDate ? data.lastLogin.toDate().toISOString() : data.lastLogin || null,
          } as UserSystem);
        }
      });
      return items;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isOffline = errMsg.toLowerCase().includes("offline") || 
                        isOfflineCheck(errMsg);
      if (isOffline) {
        console.warn("Firestore is offline, returning empty users list fallback.");
        return [];
      }
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Get user profile by UID
  async getUser(uid: string): Promise<UserSystem | null> {
    if (!uid || uid === "undefined") {
      console.warn("userService.getUser called with invalid uid:", uid);
      return null;
    }
    try {
      const docRef = doc(db, COLLECTION_NAME, uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().isDeleted !== true) {
        const data = docSnap.data();
        const roles = data.roles || (data.role ? [data.role] : ["operator"]);
        return {
          id: docSnap.id,
          userId: docSnap.id,
          ...data,
          roles,
          role: getPrimaryRole(roles),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
          lastLogin: data.lastLogin?.toDate ? data.lastLogin.toDate().toISOString() : data.lastLogin || null,
        } as UserSystem;
      }
      return null;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isOffline = isOfflineCheck(errMsg);
      if (isOffline) {
        console.warn("Firestore is offline. Returning fallback user if requested UID matches current authenticated user.");
        if (auth?.currentUser && auth.currentUser.uid === uid) {
          const email = auth.currentUser.email || "";
          return {
            id: uid,
            userId: uid,
            teacherId: null,
            name: auth.currentUser.displayName || email.split("@")[0] || "User",
            email,
            role: email === "razor6155@gmail.com" ? "admin" : "operator",
            roles: [email === "razor6155@gmail.com" ? "admin" : "operator"],
            status: "Aktif",
            permissions: [],
            lastLogin: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: "system",
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          } as UserSystem;
        }
        return null;
      }
      return handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${uid}`);
    }
  },

  // Find teacher by email
  async findTeacherByEmail(email: string): Promise<{ id: string; name: string } | null> {
    try {
      const teachersRef = collection(db, "teachers");
      const q = query(teachersRef, where("email", "==", email), where("isDeleted", "==", false));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const teacherDoc = querySnapshot.docs[0];
        return {
          id: teacherDoc.id,
          name: teacherDoc.data().name || "Guru"
        };
      }
      return null;
    } catch (error) {
      console.error("Error finding teacher by email:", error);
      return null;
    }
  },

  // Get email from username for login
  async getEmailByUsername(username: string): Promise<string | null> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, where("username", "==", username.toLowerCase().trim()), where("isDeleted", "==", false));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        return userDoc.data().email || null;
      }
      return null;
    } catch (error) {
      console.error("Error resolving username to email:", error);
      return null;
    }
  },

  // Sync or Create user on login
  async syncUserOnLogin(firebaseUser: any): Promise<UserSystem> {
    const uid = firebaseUser.uid;
    const email = firebaseUser.email || "";
    const name = firebaseUser.displayName || email.split("@")[0] || "User";

    try {
      let existingUser = await this.getUser(uid);

      if (existingUser) {
        const roles = existingUser.roles || [existingUser.role || "operator"];
        const primaryRole = getPrimaryRole(roles);

        // Update last login
        const docRef = doc(db, COLLECTION_NAME, uid);
        await updateDoc(docRef, {
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp(),
          roles,
          role: primaryRole
        });
        
        // Log successful login
        await this.logLogin(uid, email, existingUser.name || name, "Sukses");

        existingUser.lastLogin = new Date().toISOString();
        existingUser.roles = roles;
        existingUser.role = primaryRole;
        return existingUser;
      }

      // If does not exist, let's create a new user profile record
      const matchedTeacher = await this.findTeacherByEmail(email);

      // Determine default role
      let defaultRole = "operator";
      if (email === "razor6155@gmail.com") {
        defaultRole = "admin";
      } else if (matchedTeacher) {
        defaultRole = "guru";
      }

      const defaultRoles = [defaultRole];

      const newUserData: Omit<UserSystem, "id"> = {
        userId: uid,
        teacherId: matchedTeacher ? matchedTeacher.id : null,
        teacherName: matchedTeacher ? matchedTeacher.name : null,
        name,
        email,
        role: defaultRole,
        roles: defaultRoles,
        status: "Aktif",
        permissions: [],
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      };

      const docRef = doc(db, COLLECTION_NAME, uid);
      await setDoc(docRef, {
        ...newUserData,
        lastLogin: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Write activity log for first login / auto user creation
      await logActivity(
        uid,
        name,
        "REGISTER_USER",
        uid,
        `User ${name} (${email}) login pertama kali. Otomatis dibuat dengan role ${defaultRole}.`
      );

      // Log login success
      await this.logLogin(uid, email, name, "Sukses");

      return {
        id: uid,
        ...newUserData
      } as UserSystem;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isOffline = isOfflineCheck(errMsg);
      
      if (isOffline) {
        console.warn("Failed to sync user on login (offline):", error);
      } else {
        console.error("Failed to sync user on login:", error);
      }
      // Fallback in memory user to prevent login crash
      return {
        id: uid,
        userId: uid,
        teacherId: null,
        name,
        email,
        role: email === "razor6155@gmail.com" ? "admin" : "operator",
        roles: [email === "razor6155@gmail.com" ? "admin" : "operator"],
        status: "Aktif",
        permissions: [],
        lastLogin: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: "system",
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      } as UserSystem;
    }
  },

  // Update user roles array and primary role
  async updateUserRoles(
    targetUserId: string,
    newRoles: string[],
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, targetUserId);
      const userSnap = await getDoc(docRef);
      const userName = userSnap.exists() ? userSnap.data().name : targetUserId;
      const primaryRole = getPrimaryRole(newRoles);

      await updateDoc(docRef, {
        roles: newRoles,
        role: primaryRole,
        updatedAt: serverTimestamp(),
        updatedBy: operatorId
      });

      await logActivity(
        operatorId,
        operatorName,
        "UPDATE_ROLE",
        targetUserId,
        `Mengubah peran user ${userName} menjadi [${newRoles.join(", ")}].`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${targetUserId}`);
    }
  },

  // Update single legacy user role (for backwards compatibility if hooks use it)
  async updateUserRole(
    targetUserId: string,
    newRole: string,
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    return this.updateUserRoles(targetUserId, [newRole], operatorId, operatorName);
  },

  // Link / Unlink teacher
  async linkUserToTeacher(
    targetUserId: string,
    teacherId: string | null,
    teacherName: string | null,
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, targetUserId);
      const userSnap = await getDoc(docRef);
      const userName = userSnap.exists() ? userSnap.data().name : targetUserId;

      await updateDoc(docRef, {
        teacherId,
        teacherName,
        updatedAt: serverTimestamp(),
        updatedBy: operatorId
      });

      const actionText = teacherId ? `menghubungkan dengan guru ${teacherName}` : "memutuskan hubungan guru";
      await logActivity(
        operatorId,
        operatorName,
        "LINK_TEACHER",
        targetUserId,
        `User ${userName} ${actionText}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${targetUserId}`);
    }
  },

  // Update user status (Aktif / Nonaktif / Menunggu Aktivasi / Ditangguhkan)
  async updateUserStatus(
    targetUserId: string,
    status: "Aktif" | "Nonaktif" | "Menunggu Aktivasi" | "Ditangguhkan",
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, targetUserId);
      const userSnap = await getDoc(docRef);
      const userName = userSnap.exists() ? userSnap.data().name : targetUserId;

      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
        updatedBy: operatorId
      });

      await logActivity(
        operatorId,
        operatorName,
        "UPDATE_STATUS",
        targetUserId,
        `Mengubah status user ${userName} menjadi "${status}".`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${targetUserId}`);
    }
  },

  // Create account with a temporary password (Admin Action) using a Secondary Auth App
  async createNewAccount(
    email: string,
    passwordTemp: string,
    name: string,
    roles: string[],
    teacherId: string | null,
    teacherName: string | null,
    operatorId: string,
    operatorName: string,
    username?: string,
    phoneNumber?: string
  ): Promise<void> {
    try {
      // Initialize secondary firebase auth application to register new account
      let secondaryApp;
      const appName = `SecondaryCreate_${Date.now()}`;
      try {
        secondaryApp = initializeApp(firebaseConfigJson, appName);
      } catch (e) {
        secondaryApp = getApp(appName);
      }
      const secondaryAuth = getAuth(secondaryApp);

      // Create authentication in Firebase Auth
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, passwordTemp);
      const uid = credential.user.uid;

      // Create corresponding document in users collection
      const primaryRole = getPrimaryRole(roles);
      const docRef = doc(db, COLLECTION_NAME, uid);
      const newUserData = {
        userId: uid,
        name,
        email,
        username: username || "",
        phoneNumber: phoneNumber || "",
        role: primaryRole,
        roles,
        status: "Aktif",
        teacherId,
        teacherName,
        permissions: [],
        lastLogin: null,
        requirePasswordChange: true, // Wajib ganti password pada login pertama!
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: operatorId,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      };

      await setDoc(docRef, newUserData);

      // Log activity
      await logActivity(
        operatorId,
        operatorName,
        "CREATE_USER",
        uid,
        `Membuat akun pengguna baru: ${name} (${email}) dengan peran [${roles.join(", ")}].`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  // Reset user password (sets flag requirePasswordChange: true)
  async resetUserPassword(
    targetUserId: string,
    operatorId: string,
    operatorName: string
  ): Promise<string> {
    try {
      const docRef = doc(db, COLLECTION_NAME, targetUserId);
      const userSnap = await getDoc(docRef);
      const userName = userSnap.exists() ? userSnap.data().name : targetUserId;

      // Because we cannot programmatically update auth password on client without Admin SDK,
      // we generate a unique code and flag requirePasswordChange so that we can let them log in
      // and force change password, OR they can use Email Reset link.
      // Let's create a temporary flag in the doc
      await updateDoc(docRef, {
        requirePasswordChange: true,
        updatedAt: serverTimestamp(),
        updatedBy: operatorId
      });

      await logActivity(
        operatorId,
        operatorName,
        "RESET_PASSWORD",
        targetUserId,
        `Mengatur ulang kata sandi pengguna ${userName}. Pengguna diwajibkan mengganti kata sandi.`
      );

      return "Sukses";
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${targetUserId}`);
    }
  },

  // Delete user (soft-delete)
  async deleteAccount(
    targetUserId: string,
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, targetUserId);
      const userSnap = await getDoc(docRef);
      const userName = userSnap.exists() ? userSnap.data().name : targetUserId;

      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: operatorId,
        updatedAt: serverTimestamp()
      });

      await logActivity(
        operatorId,
        operatorName,
        "DELETE_USER",
        targetUserId,
        `Menghapus (soft-delete) akun pengguna ${userName}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${targetUserId}`);
    }
  },

  // Log Login details to login_history
  async logLogin(userId: string, email: string, name: string, status: "Sukses" | "Gagal", reason?: string) {
    try {
      let ip = "127.0.0.1";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        if (res.ok) {
          const data = await res.json();
          ip = data.ip || ip;
        }
      } catch (err) {
        console.warn("Could not retrieve client IP:", err);
      }

      const { browser, os } = getBrowserAndOS();

      const historyRef = collection(db, "login_history");
      await addDoc(historyRef, {
        userId,
        email,
        name,
        browser,
        os,
        ip,
        status,
        reason: reason || "",
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to log login:", err);
    }
  },

  // Get login history
  async getLoginHistory(): Promise<any[]> {
    try {
      const colRef = collection(db, "login_history");
      const q = query(colRef, orderBy("timestamp", "desc"), limit(200));
      const querySnapshot = await getDocs(q);
      const logs: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        logs.push({
          id: doc.id,
          ...d,
          timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp
        });
      });
      return logs;
    } catch (err) {
      console.error("Failed to fetch login history:", err);
      return [];
    }
  },

  // Get login history for specific user
  async getMyLoginHistory(userId: string): Promise<any[]> {
    try {
      const colRef = collection(db, "login_history");
      const q = query(colRef, where("userId", "==", userId), limit(50));
      const querySnapshot = await getDocs(q);
      const logs: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        logs.push({
          id: doc.id,
          ...d,
          timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp
        });
      });
      // Sort in memory to avoid needing custom indexes
      return logs.sort((a, b) => {
        const tA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tB - tA;
      });
    } catch (err) {
      console.error("Failed to fetch user login history:", err);
      return [];
    }
  },

  // Get audit logs
  async getAuditLogs(): Promise<any[]> {
    try {
      const colRef = collection(db, "activity_logs");
      const q = query(colRef, orderBy("createdAt", "desc"), limit(250));
      const querySnapshot = await getDocs(q);
      const logs: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        logs.push({
          id: doc.id,
          ...d,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : d.createdAt
        });
      });
      return logs;
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
      return [];
    }
  }
};

function isOfflineCheck(msg: string): boolean {
  return msg.toLowerCase().includes("offline") || 
         msg.toLowerCase().includes("unavailable") || 
         msg.toLowerCase().includes("network") ||
         msg.toLowerCase().includes("failed to get document") ||
         msg.toLowerCase().includes("timeout");
}
