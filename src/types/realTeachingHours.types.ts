export interface JpAdjustment {
  id?: string;
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  gradeLevel: string;
  teacherId?: string;
  teacherName?: string;
  systemValue: number;
  manualValue: number;
  adjustmentDelta: number;
  reason: string;
  adjustedByUserId: string;
  adjustedByUserName: string;
  createdAt: string;
  updatedAt: string;
  status?: "approved" | "pending" | "rejected";
  approvedByUserId?: string;
  approvedByUserName?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface TeachingDateDetail {
  date: string; // YYYY-MM-DD
  dayName: string; // "Sabtu", "Minggu", etc.
  scheduledJp: number;
  actualJp: number;
  status: "NORMAL" | "HOLIDAY" | "AGENDA_CANCEL" | "INEFFECTIVE_WEEK" | "MANUAL_ADJUSTMENT";
  description: string;
  agendas: string[];
}

export interface SubjectRealTeachingHours {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  gradeLevel: string;
  teacherId: string;
  teacherName: string;
  day: string; // "Sabtu", "Senin", etc.
  scheduledJpPerWeek: number;
  plannedJp: number;
  lostJp: number;
  adjustmentJp: number;
  effectiveJp: number;
  executedJp: number;
  remainingJp: number;
  progressPercent: number;
  adjustmentStatus?: "none" | "approved" | "pending" | "rejected";
  pendingAdjustment?: JpAdjustment;
  dateDetails: TeachingDateDetail[];
}

export interface RealTeachingHoursSummary {
  academicYearId: string;
  semesterId: string;
  totalPlannedJp: number;
  totalLostJp: number;
  totalEffectiveJp: number;
  totalExecutedJp: number;
  bySubjectClass: SubjectRealTeachingHours[];
}
