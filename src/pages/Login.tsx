import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { FormInput } from "../components/FormInput";
import { School, Loader2, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

const loginSchema = z.object({
  identifier: z.string().min(1, { message: "Email atau Username wajib diisi" }),
  password: z.string().min(6, { message: "Kata sandi minimal 6 karakter" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsSubmitting(true);
    try {
      await login(data.identifier, data.password);
      toast("Berhasil masuk ke sistem!", "success");
      navigate("/", { replace: true });
    } catch (error: any) {
      console.error(error);
      let errMsg = error.message || "Email/Username atau kata sandi salah";
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        errMsg = "Email/Username atau kata sandi salah";
      } else if (error.code === "auth/network-request-failed") {
        errMsg = "Koneksi internet bermasalah";
      }
      toast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        
        {/* Header Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-md mb-3">
            <School className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            SMP ALKARIM RASYID
          </h1>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-semibold tracking-wider uppercase">
            Sistem Informasi Master Data
          </p>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 shadow-xl p-8"
        >
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Selamat Datang Kembali
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-400 mt-1">
              Masukkan akun terdaftar Anda untuk masuk ke dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              label="Email atau Username"
              type="text"
              placeholder="nama@sekolah.sch.id atau username"
              error={errors.identifier?.message}
              register={register("identifier")}
            />

            <FormInput
              label="Kata Sandi"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              register={register("password")}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 dark:bg-blue-500 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  Masuk Sekarang
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Registration link */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-850 text-center">
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Belum memiliki akun?{" "}
              <Link
                to="/register"
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Daftar Akun
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
