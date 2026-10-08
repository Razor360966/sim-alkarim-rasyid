/**
 * learningProgressMonitoring.types.ts
 * 
 * Types and interfaces for Weekly Learning Progress Monitoring
 * (Monitoring Progres Pembelajaran Mingguan)
 * SIMAK SMP ALKARIM RASYID
 * 
 * Pipeline:
 * Prota -> Prosem -> Jadwal Operasional Pondok -> Jurnal Mengajar -> Monitoring Progres
 * 
 * Strict READ-ONLY reporting layer.
 */

import { PromesMeetingEntry, AnnualProgram, SemesterProgram } from "./curriculumPlanning.types";
import { Schedule } from "./schedule.types";
import { TeachingJournal } from "./teachingJournal.types";

export type LearningProgressStatus =
  | "SESUAI RENCANA"
  | "LEBIH CEPAT"
  | "SEBAGIAN"
  | "TERTINGGAL"
  | "BELUM ADA JURNAL"
  | "TIDAK ADA TARGET"
  | "TIDAK ADA JADWAL";

export interface SchoolWeekPeriod {
  weekNumber: number; // 1, 2, 3...
  label: string; // e.g. "Minggu 1 (01 Okt - 01 Okt 2026)"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isCurrentWeek: boolean;
  totalDays: number;
}

export interface TeacherSubjectClassKey {
  teacherId: string;
  teacherName: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
}

export interface LearningProgressItem extends TeacherSubjectClassKey {
  id: string; // canonical key: academicYearId_semesterId_classId_subjectId_teacherId
  academicYearId: string;
  semesterId: string;
  
  // Period info
  periodLabel: string;
  startDate: string;
  endDate: string;
  isCumulative: boolean;

  // Quantitative Metrics
  targetJP: number;
  realizedJP: number;
  differenceJP: number; // realizedJP - targetJP
  progressPercentage: number; // Raw mathematical percentage, e.g. 250% when realized=10 and target=4
  rawProgressPercentage?: number; // Exact raw mathematical percentage (unclamped)

  // Status
  status: LearningProgressStatus;
  statusNotes?: string;

  // Prosem Evidence (Rencana)
  hasProsemTarget: boolean;
  targetTitles: string[];
  targetLearningObjectives: string[];
  prosemMeetings: PromesMeetingEntry[];

  // Schedule Evidence (Jadwal Operasional)
  hasSchedules: boolean;
  scheduledJP: number;
  schedules: Schedule[];

  // Journal Evidence (Realisasi Aktual)
  hasJournals: boolean;
  journals: TeachingJournal[];

  // Cumulative tracking (jika mode kumulatif)
  cumulativeTargetJP?: number;
  cumulativeRealizedJP?: number;
  cumulativeDifferenceJP?: number;
  cumulativeProgressPercentage?: number;
}

export interface WeeklyCumulativeRow {
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  targetJP: number;
  realizedJP: number;
  cumulativeTargetJP: number;
  cumulativeRealizedJP: number;
  cumulativeProgressPercentage: number;
}

export interface LearningProgressSummary {
  totalItems: number;
  sesuaiRencanaCount: number;
  lebihCepatCount: number;
  sebagianCount: number;
  tertinggalCount: number;
  belumAdaJurnalCount: number;
  tidakAdaTargetCount: number;
  tidakAdaJadwalCount: number;
  
  totalTargetJP: number;
  totalRealizedJP: number;
  overallPercentage: number;
}

export interface LearningProgressFilter {
  academicYearId: string;
  semesterId: string;
  periodMode: "current_week" | "specific_week" | "cumulative" | "monthly" | "custom";
  selectedWeekNumber?: number;
  selectedMonth?: string; // "YYYY-MM"
  customStartDate?: string;
  customEndDate?: string;
  teacherId?: string;
  subjectId?: string;
  classId?: string;
  status?: string;
  searchQuery?: string;
}

// =============================================================================
// PHASE 3A — LEARNING MATERIAL PROGRESS ENGINE TYPES
// =============================================================================

export type MaterialProgressStatus =
  | "BELUM_DIMULAI"
  | "BELUM_ADA_JURNAL"
  | "SEDANG_BERJALAN"
  | "SELESAI"
  | "TERTINGGAL"
  | "DI_LUAR_RENCANA";

export interface SubtopicProgressBreakdown {
  subtopicId: string;
  subtopicTitle: string;
  targetJP: number;
  realizedJP: number;
  isCompleted: boolean;
}

export interface TopicMaterialProgressItem {
  id: string; // canonical context key: academicYearId_semesterId_classId_subjectId_topicId
  academicYearId: string;
  semesterId: string;
  classId: string;
  className?: string;
  subjectId: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  topicId: string;
  topicTitle: string;
  topicOrder?: number;
  
  // Quantitative Metrics
  targetJP: number;
  weeklyTargetJP?: number;
  semesterTargetJP?: number;
  realizedJP: number;            // Actual sum of journal totalJP (uncapped, e.g. 6 when target is 4)
  differenceJP: number;          // realizedJP - targetJP
  rawProgressPercentage: number; // (realizedJP / targetJP) * 100 or 0
  progressPercentage: number;    // min(100, rawProgressPercentage)
  
  // Status
  status: MaterialProgressStatus;
  statusNotes?: string;
  
  // Date window of planned meetings for this topic
  plannedStartDate?: string;
  plannedEndDate?: string;
  semesterStartDate?: string;
  semesterEndDate?: string;
  
  // Meetings evidence
  plannedMeetings: PromesMeetingEntry[];
  meetingCount: number;
  semesterMeetingCount?: number;
  
  // Journals evidence
  journals: TeachingJournal[];
  journalCount: number;
  
  // Subtopics breakdown (informational only, not completion blocker)
  subtopicsProgress: SubtopicProgressBreakdown[];

  // Operational Schedule evidence (Phase 3C-2: Enhanced Drill-Down & Evidence Inspection)
  schedules?: Schedule[];
  scheduledJP?: number;
}

export interface CalculateMaterialProgressParams {
  academicYearId: string;
  semesterId: string;
  classId?: string;
  subjectId?: string;
  prosem?: SemesterProgram | null;
  prosems?: SemesterProgram[];
  prota?: AnnualProgram | null;
  protas?: AnnualProgram[];
  journals: TeachingJournal[];
  schedules?: Schedule[];
  startDate: string;
  endDate: string;
  mode?: "weekly" | "cumulative";
  todayStr?: string;
}

export interface MaterialProgressResult {
  topicItems: TopicMaterialProgressItem[];
  unlinkedJournals: TeachingJournal[];
  unlinkedJP: number;
  outOfProsemJournals: TeachingJournal[];
  outOfProsemJP: number;
  totalPlannedTopics: number;
  completedTopicsCount: number;
  inProgressTopicsCount: number;
  unstartedTopicsCount: number;
  delayedTopicsCount: number;
  overallMaterialCompletionRate: number; // (completedTopicsCount / totalPlannedTopics) * 100 or 0
  unmappedMeetingTargets?: {
    topicId: string;
    meetingCount: number;
    targetJP: number;
  }[];
}

export interface ExecutiveProgressSummary {
  monitoredClassSubjectCount: number;
  totalTargetJP: number;
  totalRealizedJP: number;
  completedCount: number;
  inProgressCount: number;
  noJournalCount: number;
  delayedCount: number;
  unstartedCount: number;
  outOfProsemCount: number;
  totalTopics: number;
}
