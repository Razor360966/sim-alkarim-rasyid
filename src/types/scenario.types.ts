export type ScenarioStatus = "Draft" | "Diajukan" | "Perlu Revisi" | "Disetujui" | "Ditolak" | "Diterapkan";

export interface StatusHistoryEntry {
  status: ScenarioStatus;
  changedBy: string;
  changedByName: string;
  changedAt: string; // ISO string
  notes?: string;
  reason?: string;
}

export interface ScheduleScenario {
  id: string; // Document ID in schedule_scenarios
  name: string; // e.g. "Simulasi Penambahan JP IPA"
  description?: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  status: ScenarioStatus;
  statusHistory: StatusHistoryEntry[];
  consultationNotes?: string;
  
  // Snapshot Metadata
  sourceSnapshotMeta: {
    snapshotAt: string; // ISO string
    academicYearId: string;
    academicYearName: string;
    semesterId: string;
    semesterName: string;
    sourceCurriculumCount: number;
    sourceScheduleCount: number;
    sourceSubjectCount: number;
  };

  // Change Summary Metrics
  summaryMetrics?: {
    totalJpVii: number;
    totalJpVIII: number;
    totalJpIX: number;
    diffJpVii: number;
    diffJpVIII: number;
    diffJpIX: number;
    subjectsAdded: number;
    subjectsRemoved: number;
    subjectsModified: number;
    totalScheduleSlots: number;
    conflictCount: number;
  };

  // Mass Apply Metadata
  appliedAt?: string;
  appliedBy?: string;
  appliedByName?: string;
  appliedSummary?: {
    totalApplied: number;
    classesApplied: string[];
    addedSlots: number;
    updatedSlots: number;
    emptySlots: number;
  };

  // Approval Metadata
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;

  // Publication Metadata
  isPublished?: boolean;
  publishedAt?: string;
  publishedBy?: string;
  publishedByName?: string;

  // RBAC & Audit
  createdBy: string;
  createdByName: string;
  createdByRole?: string;
  updatedBy: string;
  updatedByName: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ScenarioCurriculumMatrix {
  id: string; // Document ID in scenario_curriculum_matrix (e.g. `${scenarioId}_${sourceCurriculumIdOrLocalId}`)
  scenarioId: string;
  originalCurriculumId?: string; // Reference to source curriculum_matrix id, empty for new subjects
  subjectId: string; // Source subject ID or local scenario subject ID
  subjectName: string;
  subjectGroup: "A" | "B" | "C";
  isCustomSubject?: boolean; // True if added strictly inside this scenario
  isActiveInScenario: boolean; // True by default; can be disabled/excluded from scenario without deleting original
  jp_vii: number;
  jp_viii: number;
  jp_ix: number;
  
  // Baseline snapshot for instant diff
  baseline_jp_vii: number;
  baseline_jp_viii: number;
  baseline_jp_ix: number;
  
  teacherId?: string;
  teacherName?: string;
  teacherId_vii?: string;
  teacherName_vii?: string;
  teacherId_viii?: string;
  teacherName_viii?: string;
  teacherId_ix?: string;
  teacherName_ix?: string;
  useDifferentTeachers?: boolean;
  order?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioSubject {
  id: string; // Document ID in scenario_subjects
  scenarioId: string;
  originalSubjectId?: string;
  code: string;
  name: string;
  group: "A" | "B" | "C";
  kkm: number;
  grades: ("7" | "8" | "9")[];
  subjectType?: "UMUM" | "KEPESANTRENAN" | "PONDOK";
  isCustomSubject: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioSchedule {
  id: string; // Document ID in scenario_schedules
  scenarioId: string;
  academicYearId: string;
  semesterId: string;
  classId: string;
  className: string;
  gradeLevel: "VII" | "VIII" | "IX";
  day: string;
  lessonPeriodId: string;
  sequence: number;
  jp: string; // e.g. "JP 1"
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioChangeLog {
  id: string;
  scenarioId: string;
  action: 
    | "CREATE_SCENARIO" 
    | "DUPLICATE_SCENARIO" 
    | "UPDATE_CURRICULUM" 
    | "UPDATE_SCHEDULE" 
    | "CHANGE_STATUS" 
    | "DELETE_SCENARIO"
    | "APPLY_TO_LIVE_SCHEDULE"
    | "PUBLISH_LIVE_SCHEDULE"
    | "REMOVE_ZERO_JP_SUBJECTS";
  description: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  diffDetails?: Record<string, any>;
}

export interface ScenarioConflict {
  type: "TEACHER_DOUBLE_BOOKING" | "CLASS_DOUBLE_BOOKING" | "OVER_JP_ALLOCATION" | "UNSCHEDULED_JP" | "TEACHER_LOAD_MISMATCH";
  severity: "error" | "warning";
  title: string;
  description: string;
  day?: string;
  sequence?: number;
  classId?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
  subjectId?: string;
  subjectName?: string;
}

export interface ScenarioApplyPreview {
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  selectedClassIds: string[];
  totalSlotsInScenario: number;
  addedSlots: Array<{
    slotKey: string;
    classId: string;
    className: string;
    day: string;
    sequence: number;
    jp: string;
    subjectName: string;
    teacherName: string;
    isIntentionalEmpty: boolean;
  }>;
  updatedSlots: Array<{
    slotKey: string;
    classId: string;
    className: string;
    day: string;
    sequence: number;
    jp: string;
    oldSubjectName: string;
    newSubjectName: string;
    oldTeacherName: string;
    newTeacherName: string;
    isIntentionalEmpty: boolean;
  }>;
  emptySlotsCount: number;
  unchangedSlotsCount: number;
  conflicts: ScenarioConflict[];
  curriculumChanges?: {
    addedSubjects: Array<{ subjectId: string; subjectName: string; group: string }>;
    removedZeroJpSubjects: Array<{ subjectId: string; subjectName: string }>;
    renamedSubjects: Array<{ subjectId: string; oldName: string; newName: string }>;
    jpChangedSubjects: Array<{ subjectId: string; subjectName: string; oldJp: string; newJp: string }>;
  };
  hasBlockingErrors: boolean;
  canApply: boolean;
  blockReason?: string;
}

export interface ScenarioApplyResult {
  totalApplied: number;
  classesApplied: string[];
  addedCount: number;
  updatedCount: number;
  emptySlotsCount: number;
  deletedDuplicatesCount: number;
  curriculumAppliedCount?: number;
  appliedAt: string;
  appliedBy: string;
}

export interface ScenarioSyncAffectedSlot {
  id: string;
  day: string;
  sequence: number;
  jp: string;
  isLocked: boolean;
  actionDescription: string;
}

export interface ScenarioSyncItemPreview {
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  gradeLevel: "VII" | "VIII" | "IX";
  currentJp: number;
  targetJp: number;
  diff: number; // targetJp - currentJp (negatif = berkurang, positif = bertambah)
  action: "REDUCE" | "INCREASE" | "UNCHANGED";
  teacherId: string;
  teacherName: string;
  affectedSlots: ScenarioSyncAffectedSlot[];
  warning?: string;
}

export interface ScenarioSyncPreviewResult {
  scenarioId: string;
  totalChanges: number;
  reducedCount: number;
  increasedCount: number;
  teacherUpdateCount: number;
  unchangedCount: number;
  items: ScenarioSyncItemPreview[];
  warnings: string[];
}

