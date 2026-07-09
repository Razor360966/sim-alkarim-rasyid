import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supervisionService } from "../services/supervision.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  AcademicSupervision,
  ManagerialSupervision,
  SupervisionSchedule,
  SupervisionInstrument,
  SupervisionResult
} from "../types";

// =========================================================================
// ACADEMIC SUPERVISION HOOKS
// =========================================================================

export function useAcademicSupervisions(filters?: {
  academicYearId?: string;
  semesterId?: string;
  supervisorId?: string;
  teacherId?: string;
  status?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const currentUserId = currentUser?.uid || "system";

  const { data: supervisions = [], isLoading, error } = useQuery({
    queryKey: ["academicSupervisions", filters],
    queryFn: () => supervisionService.getAcademicSupervisions(filters)
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<AcademicSupervision, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
      return supervisionService.createAcademicSupervision({
        ...data,
        createdBy: currentUserId,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicSupervisions"] });
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Supervisi akademik berhasil dijadwalkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menjadwalkan supervisi akademik", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AcademicSupervision> }) => {
      return supervisionService.updateAcademicSupervision(id, {
        ...data,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicSupervisions"] });
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Supervisi akademik berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui supervisi akademik", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return supervisionService.deleteAcademicSupervision(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academicSupervisions"] });
      toast("Supervisi akademik berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus supervisi akademik", "error");
    }
  });

  return {
    supervisions,
    isLoading,
    error,
    createSupervision: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSupervision: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSupervision: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
  };
}

// =========================================================================
// MANAGERIAL SUPERVISION HOOKS
// =========================================================================

export function useManagerialSupervisions(filters?: {
  academicYearId?: string;
  semesterId?: string;
  supervisorId?: string;
  staffId?: string;
  status?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const currentUserId = currentUser?.uid || "system";

  const { data: supervisions = [], isLoading, error } = useQuery({
    queryKey: ["managerialSupervisions", filters],
    queryFn: () => supervisionService.getManagerialSupervisions(filters)
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<ManagerialSupervision, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
      return supervisionService.createManagerialSupervision({
        ...data,
        createdBy: currentUserId,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerialSupervisions"] });
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Supervisi manajerial berhasil dijadwalkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menjadwalkan supervisi manajerial", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ManagerialSupervision> }) => {
      return supervisionService.updateManagerialSupervision(id, {
        ...data,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerialSupervisions"] });
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Supervisi manajerial berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui supervisi manajerial", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return supervisionService.deleteManagerialSupervision(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managerialSupervisions"] });
      toast("Supervisi manajerial berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus supervisi manajerial", "error");
    }
  });

  return {
    supervisions,
    isLoading,
    error,
    createSupervision: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSupervision: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSupervision: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
  };
}

// =========================================================================
// SUPERVISION SCHEDULES HOOKS
// =========================================================================

export function useSupervisionSchedules(filters?: {
  supervisorId?: string;
  participantId?: string;
  type?: string;
  status?: string;
  academicYearId?: string;
  semesterId?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const currentUserId = currentUser?.uid || "system";

  const { data: schedules = [], isLoading, error } = useQuery({
    queryKey: ["supervisionSchedules", filters],
    queryFn: () => supervisionService.getSupervisionSchedules(filters)
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<SupervisionSchedule, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
      return supervisionService.createSupervisionSchedule({
        ...data,
        createdBy: currentUserId,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Jadwal supervisi berhasil ditambahkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menambahkan jadwal supervisi", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SupervisionSchedule> }) => {
      return supervisionService.updateSupervisionSchedule(id, {
        ...data,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Jadwal supervisi berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui jadwal supervisi", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return supervisionService.deleteSupervisionSchedule(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisionSchedules"] });
      toast("Jadwal supervisi berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus jadwal supervisi", "error");
    }
  });

  return {
    schedules,
    isLoading,
    error,
    createSchedule: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateSchedule: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteSchedule: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
  };
}

// =========================================================================
// SUPERVISION INSTRUMENTS HOOKS
// =========================================================================

export function useSupervisionInstruments(filters?: {
  type?: string;
  category?: string;
  isActive?: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const currentUserId = currentUser?.uid || "system";

  const { data: instruments = [], isLoading, error } = useQuery({
    queryKey: ["supervisionInstruments", filters],
    queryFn: () => supervisionService.getSupervisionInstruments(filters)
  });

  const createMutation = useMutation({
    mutationFn: (data: Omit<SupervisionInstrument, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">) => {
      return supervisionService.createSupervisionInstrument({
        ...data,
        createdBy: currentUserId,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisionInstruments"] });
      toast("Instrumen supervisi berhasil ditambahkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menambahkan instrumen supervisi", "error");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SupervisionInstrument> }) => {
      return supervisionService.updateSupervisionInstrument(id, {
        ...data,
        updatedBy: currentUserId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisionInstruments"] });
      toast("Instrumen supervisi berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui instrumen supervisi", "error");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      return supervisionService.deleteSupervisionInstrument(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supervisionInstruments"] });
      toast("Instrumen supervisi berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus instrumen supervisi", "error");
    }
  });

  return {
    instruments,
    isLoading,
    error,
    createInstrument: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateInstrument: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteInstrument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending
  };
}

// =========================================================================
// SUPERVISION RESULTS / ASSESSMENT HOOKS
// =========================================================================

export function useSupervisionResult(supervisionId: string) {
  const { data: result = null, isLoading, error } = useQuery({
    queryKey: ["supervisionResult", supervisionId],
    queryFn: () => supervisionService.getSupervisionResult(supervisionId),
    enabled: !!supervisionId
  });

  return {
    result,
    isLoading,
    error
  };
}

export function useSaveSupervisionResult() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.uid || "system";

  const saveMutation = useMutation({
    mutationFn: (data: Omit<SupervisionResult, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy"> & { id?: string }) => {
      return supervisionService.saveSupervisionResult({
        ...data,
        createdBy: currentUserId,
        updatedBy: currentUserId
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["supervisionResult", data.supervisionId] });
      queryClient.invalidateQueries({ queryKey: ["academicSupervisions"] });
      queryClient.invalidateQueries({ queryKey: ["managerialSupervisions"] });
      toast("Penilaian supervisi berhasil disimpan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menyimpan penilaian supervisi", "error");
    }
  });

  return {
    saveResult: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending
  };
}
