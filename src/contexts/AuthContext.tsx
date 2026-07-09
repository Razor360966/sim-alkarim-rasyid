import React, { createContext, useContext, useState, useEffect } from "react";
import { User } from "firebase/auth";
import { authService } from "../services/authService";
import { userService, getPrimaryRole } from "../services/user.service";
import { UserProfile } from "../types";
import { Loader2 } from "lucide-react";
import { useToast } from "./ToastContext";

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string, displayName: string, role: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (role: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange(async (firebaseUser: User | null) => {
      try {
        if (firebaseUser) {
          // Sync with Firestore users collection and find teacher matching automatically
          const profile = await userService.syncUserOnLogin(firebaseUser);
          
          // Enforce active status
          if (profile.status !== "Aktif") {
            toast(`Sesi ditolak: Status akun Anda adalah "${profile.status}". Silakan hubungi Administrator.`, "error");
            await userService.logLogin(profile.userId, profile.email, profile.name || firebaseUser.email || "", "Gagal", `Status akun: ${profile.status}`);
            await authService.logout();
            setUser(null);
            setLoading(false);
            return;
          }

          // Enforce: Guru must be linked to a teacherId
          const roles = profile.roles || [profile.role];
          if (roles.includes("guru") && !profile.teacherId) {
            toast("Sesi ditolak: Akun Guru harus dihubungkan dengan data Guru terlebih dahulu.", "error");
            await userService.logLogin(profile.userId, profile.email, profile.name || firebaseUser.email || "", "Gagal", "Akun Guru belum dihubungkan ke data Guru.");
            await authService.logout();
            setUser(null);
            setLoading(false);
            return;
          }

          // Create standard UserProfile object
          const mappedProfile: UserProfile = {
            uid: profile.userId,
            userId: profile.userId,
            email: profile.email,
            username: profile.username || "",
            phoneNumber: profile.phoneNumber || "",
            displayName: profile.name || profile.email.split("@")[0],
            name: profile.name,
            role: profile.role,
            roles: roles,
            status: profile.status,
            teacherId: profile.teacherId,
            teacherName: profile.teacherName,
            permissions: profile.permissions,
            lastLogin: profile.lastLogin,
            requirePasswordChange: profile.requirePasswordChange || false,
            createdAt: profile.createdAt
          };

          setUser(mappedProfile);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("Auth state change processing error:", err);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]);

  const login = async (identifier: string, password: string) => {
    setLoading(true);
    try {
      let emailAddress = identifier.trim();
      if (!emailAddress.includes("@")) {
        const resolvedEmail = await userService.getEmailByUsername(emailAddress);
        if (!resolvedEmail) {
          throw new Error(`Username "${identifier}" tidak ditemukan.`);
        }
        emailAddress = resolvedEmail;
      }
      const profile = await authService.login(emailAddress, password);
      // Recheck the synced Firestore data
      let dbUser = null;
      try {
        dbUser = await userService.getUser(profile.uid);
      } catch (err) {
        console.warn("Could not retrieve user document because of offline/network status during login:", err);
      }
      if (dbUser) {
        if (dbUser.status !== "Aktif") {
          await userService.logLogin(dbUser.userId, dbUser.email, dbUser.name, "Gagal", `Status akun: ${dbUser.status}`);
          await authService.logout();
          toast(`Gagal Masuk: Status akun Anda adalah "${dbUser.status}".`, "error");
          throw new Error(`Akun Anda sedang dalam status "${dbUser.status}".`);
        }

        const roles = dbUser.roles || [dbUser.role];
        if (roles.includes("guru") && !dbUser.teacherId) {
          await userService.logLogin(dbUser.userId, dbUser.email, dbUser.name, "Gagal", "Akun Guru belum dihubungkan ke data Guru.");
          await authService.logout();
          toast("Gagal Masuk: Akun Guru belum dihubungkan ke data Guru.", "error");
          throw new Error("Akun Guru belum dihubungkan ke data Guru.");
        }
        
        const mappedProfile: UserProfile = {
          uid: dbUser.userId,
          userId: dbUser.userId,
          email: dbUser.email,
          username: dbUser.username || "",
          phoneNumber: dbUser.phoneNumber || "",
          displayName: dbUser.name || dbUser.email.split("@")[0],
          name: dbUser.name,
          role: dbUser.role,
          roles: roles,
          status: dbUser.status,
          teacherId: dbUser.teacherId,
          teacherName: dbUser.teacherName,
          permissions: dbUser.permissions,
          lastLogin: dbUser.lastLogin,
          requirePasswordChange: dbUser.requirePasswordChange || false,
          createdAt: dbUser.createdAt
        };
        setUser(mappedProfile);
        return mappedProfile;
      }
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string, role: string) => {
    setLoading(true);
    try {
      const profile = await authService.register(email, password, displayName, role as any);
      setUser(profile);
      return profile;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (user) {
        await userService.logActivity(user.uid, user.displayName, "LOGOUT_USER", user.uid, `User ${user.displayName} keluar dari sistem.`);
      }
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const dbUser = await userService.getUser(user.uid);
        if (dbUser) {
          const roles = dbUser.roles || [dbUser.role];
          const mappedProfile: UserProfile = {
            uid: dbUser.userId,
            userId: dbUser.userId,
            email: dbUser.email,
            username: dbUser.username || "",
            phoneNumber: dbUser.phoneNumber || "",
            displayName: dbUser.name || dbUser.email.split("@")[0],
            name: dbUser.name,
            role: dbUser.role,
            roles: roles,
            status: dbUser.status,
            teacherId: dbUser.teacherId,
            teacherName: dbUser.teacherName,
            permissions: dbUser.permissions,
            lastLogin: dbUser.lastLogin,
            requirePasswordChange: dbUser.requirePasswordChange || false,
            createdAt: dbUser.createdAt
          };
          setUser(mappedProfile);
        }
      } catch (err) {
        console.warn("Could not refresh user profile document because of offline/network status:", err);
      }
    }
  };

  const switchRole = (newRole: string) => {
    if (user && user.roles?.includes(newRole)) {
      setUser(prev => prev ? { ...prev, role: newRole } : null);
      toast(`Berhasil beralih ke peran: ${newRole.toUpperCase()}`, "success");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 text-gray-900 dark:bg-zinc-950 dark:text-zinc-50 transition-colors duration-200">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">SMP ALKARIM RASYID</h1>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">Memuat data autentikasi...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
