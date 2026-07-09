import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { semesterService } from "../services/semester.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export function useSemesters() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const currentUserId = user?.uid || "system";
  const currentUserName = user?.displayName || user?.email || "Admin";

  // Get all semesters
  const { data: semesters = [], isLoading, refetch } = useQuery({
    queryKey: ["semesters"],
    queryFn: () => semesterService.getSemesters()
  });

  // Get currently active semester
  const { data: activeSemester, isLoading: isLoadingActive } = useQuery({
    queryKey: ["activeSemester"],
    queryFn: () => semesterService.getActiveSemester()
  });

  // Create semester
  const createMutation = useMutation({
    mutationFn: (data: { academicYearId: string; name: string; code: string; startDate: string; endDate: string; isActive: boolean }) =>
      semesterService.createSemester(data, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      queryClient.invalidateQueries({ queryKey: ["activeSemester"] });
      toast("Semester berhasil ditambahkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menambahkan Semester baru", "error");
    }
  });

  // Update semester
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ academicYearId: string; name: string; code: string; startDate: string; endDate: string; isActive: boolean }> }) =>
      semesterService.updateSemester(id, data, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      queryClient.invalidateQueries({ queryKey: ["activeSemester"] });
      toast("Semester berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui data semester", "error");
    }
  });

  // Soft Delete semester
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      semesterService.deleteSemester(id, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      queryClient.invalidateQueries({ queryKey: ["activeSemester"] });
      toast("Semester berhasil dihapus (Soft Delete)!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus Semester", "error");
    }
  });

  // Set active semester
  const setActiveMutation = useMutation({
    mutationFn: (id: string) =>
      semesterService.updateSemester(id, { isActive: true }, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      queryClient.invalidateQueries({ queryKey: ["activeSemester"] });
      toast("Semester berhasil diaktifkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mengaktifkan Semester", "error");
    }
  });

  return {
    semesters,
    activeSemester,
    isLoading: isLoading || isLoadingActive,
    refetch,
    createSemester: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSemester: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSemester: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    setActiveSemester: setActiveMutation.mutateAsync,
    isSettingActive: setActiveMutation.isPending
  };
}
