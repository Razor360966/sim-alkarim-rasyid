export enum LessonPeriodType {
  ROUTINE = "ROUTINE",
  LESSON = "LESSON",
  BREAK = "BREAK"
}

export interface LessonPeriod {
  id?: string; // maps to Firestore Document ID
  day: string; // e.g. "Sabtu"
  sequence: number; // e.g. 1, 2, 3
  periodCode: string; // e.g. "SAB-ROUTINE-1", "SAB-LESSON-1"
  type: LessonPeriodType; // ROUTINE | LESSON | BREAK
  title: string; // e.g. "Apel Pagi", "JP1", "Istirahat 1"
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  duration: number; // in minutes
  instructional: boolean; // true if type is LESSON, false otherwise
  generatedAt: string; // ISO String
}
