import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { FormInput, FormSelect } from "../components/FormInput";
import { School, Loader2, UserPlus } from "lucide-react";
import { motion } from "motion/react";

const registerSchema = z.object({
  displayName: z.string().min(2, { message: "Nama lengkap minimal 2 karakter" }),
  email: z.string().email({ message: "Format email tidak valid" }),
  password: z.string().min(6, { message: "Kata sandi minimal 6 karakter" }),
  role: z.enum(["admin", "guru", "pimpinan"], { message: "Pilih peran pengguna" }),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { register: createAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
      role: "admin",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsSubmitting(true);
    try {
      await createAccount(data.email, data.password, data.displayName, data.role);
      toast("Registrasi akun berhasil!", "success");
      navigate("/", { replace: true });
    } catch (error: any) {
      console.error(error);
      let errMsg = "Terjadi kesalahan registrasi";
      if (error.code === "auth/email-already-in-use") {
        errMsg = "Alamat email ini sudah terdaftar";
      } else if (error.code === "auth/weak-password") {
        errMsg = "Kata sandi terlalu lemah";
      }
      toast(errMsg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    { value: "admin", label: "Administrator (Akses Penuh)" },
    { value: "guru", label: "Guru Mata Pelajaran / Wali Kelas" },
    { value: "pimpinan", label: "Kepala Sekolah / Pimpinan (Hanya Baca)" },
  ];

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-gray-50 dark:bg-zinc-950 px-4 py-8 transition-colors duration-200">
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
              Buat Akun Baru
            </h2>
            <p className="text-xs text-gray-400 dark:text-zinc-400 mt-1">
              Daftarkan diri Anda untuk mengelola seluruh ekosistem master data
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              label="Nama Lengkap"
              type="text"
              placeholder="Ahmad Karim, S.Pd"
              error={errors.displayName?.message}
              register={register("displayName")}
            />

            <FormInput
              label="Alamat Email"
              type="email"
              placeholder="nama@sekolah.sch.id"
              error={errors.email?.message}
              register={register("email")}
            />

            <FormInput
              label="Kata Sandi"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              register={register("password")}
            />

            <FormSelect
              label="Peran Pengguna (Role)"
              options={roleOptions}
              error={errors.role?.message}
              register={register("role")}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 dark:bg-blue-500 py-3 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Mendaftarkan...
                </>
              ) : (
                <>
                  Daftar Sekarang
                  <UserPlus className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-850 text-center">
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Sudah memiliki akun?{" "}
              <Link
                to="/login"
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Masuk Sesi
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Register;
