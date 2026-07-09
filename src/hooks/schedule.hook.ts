import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scheduleService } from "../services/schedule.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Schedule } from "../types";

export function useSchedules(academicYearId?: string, semesterId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const operatorId = currentUser?.uid || "system";
  const operatorName = currentUser?.displayName || currentUser?.email || "Admin";

  // Fetch saved schedules
  const { data: schedules = [], isLoading, refetch } = useQuery({
    queryKey: ["schedules", academicYearId, semesterId],
    queryFn: () => scheduleService.getSchedules(academicYearId, semesterId),
    enabled: !!academicYearId && !!semesterId
  });

  // Mutation to preview schedules (run scheduling engine in memory)
  const previewMutation = useMutation({
    mutationFn: ({ 
      ayId, 
      semId, 
      targetClassId,
      optimize,
      customRules
    }: { 
      ayId: string; 
      semId: string; 
      targetClassId?: string;
      optimize?: boolean;
      customRules?: string;
    }) => scheduleService.previewSchedule(ayId, semId, targetClassId, optimize, customRules),
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal membangun simulasi jadwal.", "error");
    }
  });

  // Mutation to save schedules in database
  const saveMutation = useMutation({
    mutationFn: ({ 
      scheds, 
      ayId, 
      semId, 
      classIdToOverwrite 
    }: { 
      scheds: Schedule[]; 
      ayId: string; 
      semId: string; 
      classIdToOverwrite?: string;
    }) => scheduleService.saveSchedules(scheds, ayId, semId, operatorId, operatorName, classIdToOverwrite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast("Jadwal pelajaran berhasil disimpan ke database!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menyimpan jadwal ke database.", "error");
    }
  });

  // Mutation to reset schedules in database
  const resetMutation = useMutation({
    mutationFn: ({ 
      ayId, 
      semId, 
      classId 
    }: { 
      ayId: string; 
      semId: string; 
      classId?: string;
    }) => scheduleService.resetSchedules(ayId, semId, operatorId, operatorName, classId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast(
        variables.classId 
          ? "Jadwal untuk kelas terpilih berhasil direset (kecuali slot dikunci)!" 
          : "Jadwal seluruh sekolah berhasil direset (kecuali slot dikunci)!", 
        "success"
      );
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal melakukan reset jadwal.", "error");
    }
  });

  // Mutation to lock/unlock a single schedule slot
  const toggleLockMutation = useMutation({
    mutationFn: ({ id, isLocked }: { id: string; isLocked: boolean }) => 
      scheduleService.toggleLockSchedule(id, isLocked, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast("Status kunci slot jadwal berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mengubah status kunci slot.", "error");
    }
  });

  // Mutation to publish schedules log
  const publishMutation = useMutation({
    mutationFn: (desc: string) => scheduleService.publishSchedules(operatorId, operatorName, desc),
    onSuccess: () => {
      toast("Jadwal berhasil dipublikasikan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal mempublikasikan jadwal.", "error");
    }
  });

  return {
    schedules,
    isLoading,
    refetch,
    previewSchedule: previewMutation.mutateAsync,
    isTesting: previewMutation.isPending,
    saveSchedules: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    resetSchedules: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
    toggleLock: toggleLockMutation.mutateAsync,
    isLocking: toggleLockMutation.isPending,
    publishSchedules: publishMutation.mutateAsync,
    isPublishing: publishMutation.isPending
  };
}
