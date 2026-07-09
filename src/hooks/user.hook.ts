import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export function useUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const operatorId = currentUser?.uid || "system";
  const operatorName = currentUser?.displayName || currentUser?.email || "Admin";

  // Get all users
  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => userService.getUsers()
  });

  // Mutation to update user roles (array)
  const updateRolesMutation = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: string[] }) =>
      userService.updateUserRoles(userId, roles, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Peran pengguna berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui peran pengguna", "error");
    }
  });

  // Legacy mutation to update user role
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      userService.updateUserRole(userId, role, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Peran pengguna berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui peran pengguna", "error");
    }
  });

  // Mutation to link user to teacher
  const linkTeacherMutation = useMutation({
    mutationFn: ({ userId, teacherId, teacherName }: { userId: string; teacherId: string | null; teacherName: string | null }) =>
      userService.linkUserToTeacher(userId, teacherId, teacherName, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Hubungan guru berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mengubah hubungan guru", "error");
    }
  });

  // Mutation to update user status
  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: "Aktif" | "Nonaktif" | "Menunggu Aktivasi" | "Ditangguhkan" }) =>
      userService.updateUserStatus(userId, status, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Status pengguna berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mengubah status pengguna", "error");
    }
  });

  // Mutation to create a new user account
  const createAccountMutation = useMutation({
    mutationFn: ({ email, passwordTemp, name, roles, teacherId, teacherName, username, phoneNumber }: { 
      email: string; 
      passwordTemp: string; 
      name: string; 
      roles: string[]; 
      teacherId: string | null;
      teacherName: string | null;
      username?: string;
      phoneNumber?: string;
    }) =>
      userService.createNewAccount(email, passwordTemp, name, roles, teacherId, teacherName, operatorId, operatorName, username, phoneNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Akun pengguna baru berhasil dibuat!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal membuat akun pengguna", "error");
    }
  });

  // Mutation to reset password (requirePasswordChange = true)
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) =>
      userService.resetUserPassword(userId, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Permintaan reset kata sandi berhasil diajukan! Pengguna wajib mengganti kata sandi pada login berikutnya.", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menyetel ulang kata sandi", "error");
    }
  });

  // Mutation to delete (soft-delete) user account
  const deleteAccountMutation = useMutation({
    mutationFn: (userId: string) =>
      userService.deleteAccount(userId, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast("Akun pengguna berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus akun pengguna", "error");
    }
  });

  return {
    users,
    isLoading,
    refetch,
    updateUserRoles: updateRolesMutation.mutateAsync,
    isUpdatingRoles: updateRolesMutation.isPending,
    updateUserRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
    linkUserToTeacher: linkTeacherMutation.mutateAsync,
    isLinkingTeacher: linkTeacherMutation.isPending,
    updateUserStatus: updateStatusMutation.mutateAsync,
    isUpdatingStatus: updateStatusMutation.isPending,
    createNewAccount: createAccountMutation.mutateAsync,
    isCreatingAccount: createAccountMutation.isPending,
    resetUserPassword: resetPasswordMutation.mutateAsync,
    isResettingPassword: resetPasswordMutation.isPending,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isDeletingAccount: deleteAccountMutation.isPending
  };
}
