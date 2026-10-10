import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { homeroomService } from "../services/homeroom.service";
import { Class, AcademicYear } from "../types";

export interface HomeroomAssignmentResult {
  isHomeroomTeacher: boolean;
  assignedClasses: Class[];
  assignedClass: Class | null;
  activeAcademicYear: AcademicYear | null;
  canonicalTeacherId: string | null;
  isLoading: boolean;
  refetch: () => void;
}

export function useHomeroomAssignment(): HomeroomAssignmentResult {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["homeroomAssignment", user?.uid, user?.teacherId, user?.email],
    queryFn: () => homeroomService.getHomeroomStatus(user),
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    isHomeroomTeacher: query.data?.isHomeroomTeacher ?? false,
    assignedClasses: query.data?.assignedClasses ?? [],
    assignedClass: query.data?.assignedClasses?.[0] ?? null,
    activeAcademicYear: query.data?.activeAcademicYear ?? null,
    canonicalTeacherId: query.data?.canonicalTeacherId ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
