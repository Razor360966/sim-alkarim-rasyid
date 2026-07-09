import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { UserProfile } from "../types";

export const authService = {
  // Login user
  async login(email: string, password: string): Promise<UserProfile> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Fetch profile
    const profile = await this.getUserProfile(user.uid);
    if (!profile) {
      // Create default profile if not exists
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || email,
        displayName: user.displayName || email.split("@")[0],
        role: "admin", // default role
        createdAt: new Date().toISOString()
      };
      await this.saveUserProfile(newProfile);
      return newProfile;
    }
    return profile;
  },

  // Register user
  async register(email: string, password: string, displayName: string, role: "admin" | "guru" | "pimpinan"): Promise<UserProfile> {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    const profile: UserProfile = {
      uid: user.uid,
      email: email,
      displayName: displayName,
      role: role,
      createdAt: new Date().toISOString()
    };
    
    await this.saveUserProfile(profile);
    return profile;
  },

  // Logout user
  async logout(): Promise<void> {
    await signOut(auth);
  },

  // Get current authenticated user details from Firestore
  async getCurrentUserProfile(): Promise<UserProfile | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return this.getUserProfile(currentUser.uid);
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  },

  // Helper to fetch user profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    if (!uid || uid === "undefined") {
      console.warn("authService.getUserProfile called with invalid uid:", uid);
      return null;
    }
    const cacheKey = `user_profile_${uid}`;
    let cachedProfile: UserProfile | null = null;
    
    // Attempt to load from localStorage cache first
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        cachedProfile = JSON.parse(cachedStr);
      }
    } catch (e) {
      console.warn("Failed to read from localStorage cache:", e);
    }

    try {
      // If we are explicitly offline, return cache immediately to prevent waiting for timeout
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        console.log("Client is currently offline. Returning cached profile.");
        if (cachedProfile) {
          cachedProfile.uid = uid;
          cachedProfile.userId = uid;
        }
        return cachedProfile;
      }

      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        profile.uid = uid;
        profile.userId = uid;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(profile));
        } catch (e) {
          console.warn("Failed to write user profile to localStorage:", e);
        }
        return profile;
      }
      if (cachedProfile) {
        cachedProfile.uid = uid;
        cachedProfile.userId = uid;
      }
      return cachedProfile;
    } catch (error: any) {
      const isOfflineError = error?.message?.includes("offline") || (typeof navigator !== "undefined" && !navigator.onLine);
      if (isOfflineError) {
        console.warn("Error fetching user profile (offline/transient):", error?.message || error);
      } else {
        console.error("Error fetching user profile:", error);
      }
      // Fallback to cache on error / offline
      if (cachedProfile) {
        cachedProfile.uid = uid;
        cachedProfile.userId = uid;
      }
      return cachedProfile;
    }
  },

  // Helper to save/update user profile
  async saveUserProfile(profile: UserProfile): Promise<void> {
    const cacheKey = `user_profile_${profile.uid}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(profile));
    } catch (e) {
      console.warn("Failed to write user profile to localStorage:", e);
    }

    try {
      const docRef = doc(db, "users", profile.uid);
      await setDoc(docRef, {
        ...profile,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error: any) {
      const isOfflineError = error?.message?.includes("offline") || (typeof navigator !== "undefined" && !navigator.onLine);
      if (isOfflineError) {
        console.warn("Error saving user profile to firestore (offline/transient):", error?.message || error);
      } else {
        console.error("Error saving user profile to firestore (offline?):", error);
      }
      // Do not throw so that local/offline flow is not blocked
    }
  }
};
