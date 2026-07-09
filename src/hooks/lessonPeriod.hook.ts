import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { lessonPeriodService } from "../services/lessonPeriod.service";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { LessonPeriod } from "../types";

export function useLessonPeriods() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const operatorId = currentUser?.uid || "system";
  const operatorName = currentUser?.displayName || currentUser?.email || "Admin";

  // Fetch lesson periods
  const { data: periods = [], isLoading, refetch } = useQuery({
    queryKey: ["lessonPeriods"],
    queryFn: () => lessonPeriodService.getLessonPeriods()
  });

  // Mutation to generate or regenerate lesson periods
  const generatePeriodsMutation = useMutation({
    mutationFn: () => lessonPeriodService.generateLessonPeriods(operatorId, operatorName),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lessonPeriods"] });
      if (data.length > 0) {
        toast(`Lesson Period berhasil digenerate! Total ${data.length} periode terbentuk.`, "success");
      } else {
        toast("Lesson Period berhasil dibersihkan/dibuat.", "success");
      }
    },
    onError: (err: any) => {
      console.error(err);
      toast(err.message || "Gagal melakukan generate Lesson Period", "error");
    }
  });

  return {
    periods,
    isLoading,
    refetch,
    generatePeriods: () => generatePeriodsMutation.mutateAsync(),
    isGenerating: generatePeriodsMutation.isPending
  };
}
