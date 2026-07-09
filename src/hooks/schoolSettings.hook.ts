import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { schoolSettingsService } from "../services/schoolSettings.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { SchoolSettings } from "../types";

export function useSchoolSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const operatorId = currentUser?.uid || "system";
  const operatorName = currentUser?.displayName || currentUser?.email || "Admin";

  // Fetch school settings
  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ["schoolSettings"],
    queryFn: () => schoolSettingsService.getSettings()
  });

  // Mutation to update school settings
  const updateSettingsMutation = useMutation({
    mutationFn: ({ newSettings, customDescription }: { newSettings: SchoolSettings; customDescription?: string }) =>
      schoolSettingsService.updateSettings(newSettings, operatorId, operatorName, customDescription),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schoolSettings"] });
      toast("Pengaturan sekolah berhasil disimpan!", "success");
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal memperbarui pengaturan sekolah", "error");
    }
  });

  return {
    settings,
    isLoading,
    refetch,
    updateSettings: (newSettings: SchoolSettings, customDescription?: string) =>
      updateSettingsMutation.mutateAsync({ newSettings, customDescription }),
    isUpdating: updateSettingsMutation.isPending
  };
}
