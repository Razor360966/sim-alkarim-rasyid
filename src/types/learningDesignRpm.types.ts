/**
 * learningDesignRpm.types.ts
 * 
 * Data models and interfaces for Rancangan Pembelajaran (RPM)
 * SIMAK SMP ALKARIM RASYID
 * 
 * RPM is the operational learning design prepared by teachers,
 * anchored to curriculum targets (Prota/Prosem via topicId).
 * 
 * Pipeline:
 * PROTA -> PROSEM -> RPM -> JURNAL -> MONITORING
 */

export interface RpmMeetingPlan {
  meetingNo: number; // 1, 2, 3...

  // Optional contextual reference to Prosem meeting schedule.
  // NOT a primary identity, NOT a mandatory foreign key.
  prosemMeetingId?: string;

  allocatedJP: number; // Positive number (e.g. 2 JP)

  subtopicId?: string;
  subtopicTitle?: string;

  learningObjective: string; // Mandatory TP for this session

  modelOrMethod: string; // e.g. "Problem-Based Learning", "Diskusi Kelompok"

  activitiesOverview: {
    intro?: string; // Kegiatan Awal / Apersepsi (optional)
    core: string;   // Kegiatan Inti / Eksplorasi (mandatory)
    closing?: string; // Refleksi & Penutup (optional)
  };

  mediaAndResources?: string; // Optional tools/media
  assessmentPlan?: string;    // Optional formatif/sumatif plan
  differentiationNotes?: string; // Optional notes for student differentiation
}

export type RpmStatus = "DRAFT" | "DITINJAU" | "DISETUJUI";

export interface LearningDesignRpm {
  id: string; // Deterministic: ${academicYearId}_${semesterId}_${classId}_${subjectId}_${topicId}

  // Academic Context (Immutable after creation)
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;

  classId: string;
  className: string;

  subjectId: string;
  subjectName: string;

  // Teacher Ownership Metadata
  teacherId: string;
  teacherName: string;

  // Topic Linkage (Immutable after creation)
  topicId: string;
  topicTitle: string;
  topicOrder?: number;

  totalTargetJP: number; // Target JP from Prosem/Prota

  meetingPlans: RpmMeetingPlan[];

  status: RpmStatus;

  approvedBy?: string;
  approvedAt?: string;
  reviewNotes?: string;

  createdAt: string;
  updatedAt: string;

  createdBy: string;
  updatedBy: string;
}

export interface RpmContextFilter {
  academicYearId: string;
  semesterId: string;
  classId: string;
  subjectId: string;
  teacherId?: string;
}

export interface RpmValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Monitoring readiness summary item for an academic topic.
 * Exposes planning status (informational only; NOT targetJP, NOT realizedJP).
 */
export interface RpmMonitoringSummary {
  topicId: string;
  topicTitle: string;
  isRpmAvailable: boolean;
  status: RpmStatus | "BELUM_TERSEDIA";
  meetingPlansCount: number;
  plannedJP: number; // Informational planned JP in RPM (NOT targetJP, NOT realizedJP)
  approvedBy?: string;
  approvedAt?: string;
  reviewNotes?: string;
}
