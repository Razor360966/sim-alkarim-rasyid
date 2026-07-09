import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { FormInput } from "../components/FormInput";
import { auth, db } from "../firebase/config";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { userService } from "../services/user.service";
import { ShieldAlert, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { motion } from "motion/react";

const changePasswordSchema = z.object({
  password: z.string().min(6, { message: "Kata sandi minimal 6 karakter" }),
  confirmPassword: z.string().min(6, { message: "Kata sandi minimal 6 karakter" }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Kata sandi tidak cocok",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export default function ChangePassword() {
  const { user, refreshProfile, logout } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isVoluntary = location.state?.voluntary === true;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // If user is not logged in or doesn't require password change, redirect
  React.useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    } else if (!user.requirePasswordChange && !isVoluntary) {
      navigate("/", { replace: true });
    }
  }, [user, navigate, isVoluntary]);

  const onSubmit = async (data: ChangePasswordFormValues) => {
    if (!auth.currentUser || !user) return;
    setIsSubmitting(true);
    try {
      // 1. Update password in Firebase Auth
      await updatePassword(auth.currentUser, data.password);

      // 2. Clear flag in Firestore using updateDoc
      if (!isVoluntary) {
        await userService.updateUserStatus(user.uid, user.status || "Aktif", user.uid, user.displayName);
        
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          requirePasswordChange: false,
          updatedAt: serverTimestamp()
        });
      }

      // Log activity
      await userService.logActivity(
        user.uid,
        user.displayName,
        isVoluntary ? "CHANGE_PASSWORD_VOLUNTARY" : "CHANGE_PASSWORD_REQUIRED",
        user.uid,
        isVoluntary
          ? `User ${user.displayName} berhasil memperbarui kata sandi secara sukarela.`
          : `User ${user.displayName} berhasil merubah password wajib pada login pertama.`
      );

      toast("Kata sandi berhasil diperbarui!", "success");
      
      // 3. Refresh profile state in AuthContext so requirePasswordChange becomes false
      await refreshProfile();
      
      // 4. Navigate back to profile or dashboard
      navigate(isVoluntary ? "/profile" : "/", { replace: true });
    } catch (error: any) {
      console.error(error);
      toast(error.message || "Gagal mengubah kata sandi. Silakan coba lagi.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-slate-50 dark:bg-zinc-950 px-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-md mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            PENGAMANAN AKUN
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-semibold tracking-wider uppercase">
            SMP ALKARIM RASYID
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-8 text-slate-900 dark:text-zinc-100"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Wajib Ubah Kata Sandi
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
              Ini adalah login pertama Anda atau akun Anda baru saja disetel ulang oleh Administrator. Demi keamanan, Anda wajib membuat kata sandi baru yang kuat sebelum masuk ke dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              label="Kata Sandi Baru"
              type="password"
              placeholder="Minimal 6 karakter"
              error={errors.password?.message}
              register={register("password")}
            />

            <FormInput
              label="Konfirmasi Kata Sandi Baru"
              type="password"
              placeholder="Ketik ulang kata sandi baru"
              error={errors.confirmPassword?.message}
              register={register("confirmPassword")}
            />

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 dark:bg-blue-500 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memperbarui Sandi...
                  </>
                ) : (
                  <>
                    {isVoluntary ? "Perbarui Kata Sandi" : "Simpan & Masuk Dashboard"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
              
              {isVoluntary ? (
                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-center py-2 transition-colors cursor-pointer"
                >
                  Batal & Kembali ke Profil
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 text-center py-2 transition-colors cursor-pointer"
                >
                  Keluar dari Akun
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
