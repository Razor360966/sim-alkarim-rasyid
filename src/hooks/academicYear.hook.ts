import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { academicYearService } from "../services/academicYear.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export function useAcademicYears() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const currentUserId = user?.uid || "system";
  const currentUserName = user?.displayName || user?.email || "Admin";

  // Get all academic years
  const { data: academicYears = [], isLoading, refetch } = useQuery({
    queryKey: ["academicYears"],
    queryFn: () => academicYearService.getAcademicYears()
  });

  // Get currently active academic year
  const { data: activeAcademicYear, isLoading: isLoadingActive } = useQuery({
    queryKey: ["activeAcademicYear"],
    queryFn: () => academicYearService.getActiveAcademicYear()
  });

  // Create academic year
  const createMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string; isActive: boolean; semester?: "Ganjil" | "Genap" }) =>
      academicYearService.createAcademicYear(data, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
      queryClient.invalidateQueries({ queryKey: ["activeAcademicYear"] });
      toast("Tahun Pelajaran berhasil ditambahkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menambahkan Tahun Pelajaran baru", "error");
    }
  });

  // Update academic year
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; startDate: string; endDate: string; isActive: boolean; semester?: "Ganjil" | "Genap" }> }) =>
      academicYearService.updateAcademicYear(id, data, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
      queryClient.invalidateQueries({ queryKey: ["activeAcademicYear"] });
      toast("Tahun Pelajaran berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui data", "error");
    }
  });

  // Soft Delete academic year
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      academicYearService.deleteAcademicYear(id, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
      queryClient.invalidateQueries({ queryKey: ["activeAcademicYear"] });
      toast("Tahun Pelajaran berhasil dihapus (Soft Delete)!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus Tahun Pelajaran", "error");
    }
  });

  // Set active academic year
  const setActiveMutation = useMutation({
    mutationFn: (id: string) =>
      academicYearService.setActiveAcademicYear(id, currentUserId, currentUserName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicYears"] });
      queryClient.invalidateQueries({ queryKey: ["activeAcademicYear"] });
      toast("Tahun Pelajaran berhasil diaktifkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mengaktifkan Tahun Pelajaran", "error");
    }
  });

  return {
    academicYears,
    activeAcademicYear,
    isLoading: isLoading || isLoadingActive,
    refetch,
    createAcademicYear: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateAcademicYear: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteAcademicYear: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    setActiveAcademicYear: setActiveMutation.mutateAsync,
    isSettingActive: setActiveMutation.isPending
  };
}
