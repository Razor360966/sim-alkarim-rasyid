import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolAgendaService } from "../services/schoolAgenda.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { SchoolAgenda } from "../types";

export function useSchoolAgendas() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const operatorId = currentUser?.uid || "system";
  const operatorName = currentUser?.displayName || currentUser?.email || "Admin";

  // Fetch school agendas
  const { data: agendas = [], isLoading, refetch } = useQuery({
    queryKey: ["schoolAgendas"],
    queryFn: () => schoolAgendaService.getAgendas()
  });

  // Mutation to add an agenda
  const addAgendaMutation = useMutation({
    mutationFn: (agenda: Omit<SchoolAgenda, "id">) =>
      schoolAgendaService.addAgenda(agenda, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolAgendas"] });
      queryClient.invalidateQueries({ queryKey: ["lessonPeriods"] });
      toast("Agenda rutin baru berhasil ditambahkan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menambahkan agenda rutin baru", "error");
    }
  });

  // Mutation to update an agenda
  const updateAgendaMutation = useMutation({
    mutationFn: ({ id, agenda }: { id: string; agenda: Partial<SchoolAgenda> }) =>
      schoolAgendaService.updateAgenda(id, agenda, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolAgendas"] });
      queryClient.invalidateQueries({ queryKey: ["lessonPeriods"] });
      toast("Agenda rutin berhasil diperbarui!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui agenda rutin", "error");
    }
  });

  // Mutation to delete an agenda
  const deleteAgendaMutation = useMutation({
    mutationFn: (id: string) =>
      schoolAgendaService.deleteAgenda(id, operatorId, operatorName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolAgendas"] });
      queryClient.invalidateQueries({ queryKey: ["lessonPeriods"] });
      toast("Agenda rutin berhasil dihapus!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal menghapus agenda rutin", "error");
    }
  });

  return {
    agendas,
    isLoading,
    refetch,
    addAgenda: (agenda: Omit<SchoolAgenda, "id">) => addAgendaMutation.mutateAsync(agenda),
    updateAgenda: (id: string, agenda: Partial<SchoolAgenda>) => updateAgendaMutation.mutateAsync({ id, agenda }),
    deleteAgenda: (id: string) => deleteAgendaMutation.mutateAsync(id),
    isSaving: addAgendaMutation.isPending || updateAgendaMutation.isPending,
    isDeleting: deleteAgendaMutation.isPending
  };
}
