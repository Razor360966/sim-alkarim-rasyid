import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teacherService } from "../services/teacherService";
import { useAuth } from "../contexts/AuthContext";
import { Teacher } from "../types";

export function useTeachers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const userId = user?.uid || "system";
  const userName = user?.displayName || user?.email || "System User";

  // Query to get all teachers
  const teachersQuery = useQuery({
    queryKey: ["teachers"],
    queryFn: teacherService.getTeachers
  });

  // Mutation to create a new teacher
  const createTeacherMutation = useMutation({
    mutationFn: (data: Omit<Teacher, "id" | "teacherId" | "createdAt" | "updatedAt" | "isDeleted" | "deletedAt" | "deletedBy" | "createdBy" | "updatedBy">) => 
      teacherService.createTeacher(data, userId, userName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    }
  });

  // Mutation to update an existing teacher
  const updateTeacherMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Teacher> }) => 
      teacherService.updateTeacher(id, data, userId, userName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    }
  });

  // Mutation to soft-delete a teacher
  const softDeleteTeacherMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      teacherService.softDeleteTeacher(id, name, userId, userName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
    }
  });

  return {
    teachers: teachersQuery.data || [],
    isLoading: teachersQuery.isLoading,
    error: teachersQuery.error,
    refetch: teachersQuery.refetch,
    createTeacher: createTeacherMutation.mutateAsync,
    isCreating: createTeacherMutation.isPending,
    updateTeacher: updateTeacherMutation.mutateAsync,
    isUpdating: updateTeacherMutation.isPending,
    deleteTeacher: softDeleteTeacherMutation.mutateAsync,
    isDeleting: softDeleteTeacherMutation.isPending
  };
}
