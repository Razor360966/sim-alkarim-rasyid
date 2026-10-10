import React from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useHomeroomAssignment } from "../hooks/useHomeroomAssignment";
import { PageLoading } from "./PageLoading";
import { ShieldAlert, BookOpen, LayoutDashboard } from "lucide-react";

interface HomeroomRouteGuardProps {
  children?: React.ReactNode;
}

const PRIVILEGED_ROLES = [
  "admin",
  "operator",
  "kepala sekolah",
  "wakil kepala sekolah",
  "pimpinan",
  "ketua yayasan"
];

export const HomeroomRouteGuard: React.FC<HomeroomRouteGuardProps> = ({ children }) => {
  const { user, activeRole } = useAuth();
  const { isHomeroomTeacher, isLoading } = useHomeroomAssignment();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if current user or active workspace has privileged administrative / leadership authority
  const userRoles = user.roles || (user.role ? [user.role] : []);
  const currentRole = (activeRole || user.role || "").toLowerCase();

  const isPrivileged =
    PRIVILEGED_ROLES.some((r) => currentRole.includes(r)) ||
    userRoles.some((r) => PRIVILEGED_ROLES.some((p) => r.toLowerCase().includes(p)));

  if (isPrivileged) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <PageLoading />;
  }

  if (isHomeroomTeacher) {
    return <>{children}</>;
  }

  // Not privileged and not an active homeroom teacher -> Access Restricted
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-8 text-center shadow-lg space-y-5">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-900">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
            Akses Khusus Wali Kelas
          </h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            Halaman ini hanya dapat diakses oleh Guru yang aktif ditugaskan sebagai <strong>Wali Kelas</strong> pada tahun pelajaran yang berlaku, atau oleh Admin dan Pimpinan Sekolah.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/e-rapor/input"
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <BookOpen className="w-4 h-4" />
            Input Nilai Mapel
          </Link>
          <Link
            to="/"
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomeroomRouteGuard;
