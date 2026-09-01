import { 
  collection, 
  getDocs, 
  writeBatch, 
  doc, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { classService } from "./classService";
import { curriculumMatrixService } from "./curriculumMatrixService";
import { lessonPeriodService } from "./lessonPeriod.service";
import { schoolSettingsService } from "./schoolSettings.service";
import { academicYearService } from "./academicYear.service";
import { semesterService } from "./semester.service";
import { teacherService } from "./teacherService";
import { subjectService } from "./subjectService";
import { Schedule, TeacherAssignment, LessonPeriod, LessonPeriodType, CurriculumMatrix, Class } from "../types";

const COLLECTION_NAME = "schedules";

/**
 * Calculates the day before a given date string YYYY-MM-DD
 */
export function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Resolves the active teacher for a schedule slot on a specific date YYYY-MM-DD
 * based on effective dates (effectiveFrom and effectiveUntil).
 * Fallback to schedule.teacherId / schedule.teacherName for backward compatibility.
 */
export function resolveTeacherForScheduleDate(
  schedule: Schedule,
  dateStr: string
): { teacherId: string; teacherName: string; assignment?: TeacherAssignment } {
  if (!schedule) {
    return { teacherId: "", teacherName: "" };
  }

  const assignments = schedule.teacherAssignments;
  if (Array.isArray(assignments) && assignments.length > 0) {
    // Sort assignments: newest effectiveFrom first
    const sorted = [...assignments].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

    // Find assignment matching target date
    const matched = sorted.find(a => {
      const isAfterStart = a.effectiveFrom <= dateStr;
      const isBeforeEnd = !a.effectiveUntil || a.effectiveUntil >= dateStr;
      return isAfterStart && isBeforeEnd;
    });

    if (matched) {
      return {
        teacherId: matched.teacherId,
        teacherName: matched.teacherName,
        assignment: matched
      };
    }

    // If dateStr is before the earliest assignment, use the earliest assignment or fallback to base
    const earliest = [...assignments].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
    if (earliest && dateStr < earliest.effectiveFrom) {
      return {
        teacherId: earliest.teacherId,
        teacherName: earliest.teacherName,
        assignment: earliest
      };
    }
  }

  return {
    teacherId: schedule.teacherId || "",
    teacherName: schedule.teacherName || ""
  };
}

/**
 * Checks if a specific teacher is active for a schedule on a given date
 */
export function isTeacherActiveForScheduleOnDate(
  schedule: Schedule,
  teacherId: string,
  dateStr: string
): boolean {
  if (!schedule || !teacherId) return false;
  const resolved = resolveTeacherForScheduleDate(schedule, dateStr);
  return resolved.teacherId === teacherId;
}

/**
 * Validates that a new assignment does not overlap with existing assignments
 */
export function validateNoAssignmentOverlap(
  existingAssignments: TeacherAssignment[] = [],
  newAssignment: { teacherId: string; effectiveFrom: string; effectiveUntil?: string | null },
  excludeIndex?: number
): { isValid: boolean; error?: string } {
  const newStart = newAssignment.effectiveFrom;
  const newEnd = newAssignment.effectiveUntil || "9999-12-31";

  if (newAssignment.effectiveUntil && newAssignment.effectiveUntil < newStart) {
    return {
      isValid: false,
      error: `Tanggal selesai (${newAssignment.effectiveUntil}) tidak boleh lebih awal dari tanggal mulai (${newStart}).`
    };
  }

  for (let i = 0; i < existingAssignments.length; i++) {
    if (excludeIndex !== undefined && i === excludeIndex) continue;
    const existing = existingAssignments[i];
    const exStart = existing.effectiveFrom;
    const exEnd = existing.effectiveUntil || "9999-12-31";

    // Overlap condition: max(start1, start2) <= min(end1, end2)
    const maxStart = newStart > exStart ? newStart : exStart;
    const minEnd = newEnd < exEnd ? newEnd : exEnd;

    if (maxStart <= minEnd) {
      return {
        isValid: false,
        error: `Penugasan baru (${newStart} s/d ${newAssignment.effectiveUntil || "seterusnya"}) bentrok dengan penugasan yang sudah ada (${existing.teacherName}: ${exStart} s/d ${existing.effectiveUntil || "seterusnya"}).`
      };
    }
  }

  return { isValid: true };
}

// Log schedule activities to "activity_logs" collection
export async function logScheduleActivity(
  userId: string, 
  userName: string, 
  action: string, 
  description: string
) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write schedule activity log:", error);
  }
}

export interface ScheduleMetrics {
  totalTeachers: number;
  totalClasses: number;
  totalSubjects: number;
  totalJpScheduled: number;
  totalJpRequired: number;
  totalSlots: number;
  teacherConflicts: number;
  classConflicts: number;
  emptySlots: number;
  schedulePercentage: number;
  qualityScore: number;
  unassignedTasks: any[];
}

export const scheduleService = {
  // 1. Get all schedules for active Academic Year & Semester
  async getSchedules(academicYearId?: string, semesterId?: string): Promise<Schedule[]> {
    try {
      let q = query(collection(db, COLLECTION_NAME));
      if (academicYearId) {
        q = query(collection(db, COLLECTION_NAME), where("academicYearId", "==", academicYearId));
      }
      const querySnapshot = await getDocs(q);
      const schedules: Schedule[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        // If semesterId was passed, filter in memory or via where (Firestore requires composite indexes for multiple wheres, so in-memory is safer for developer app setup)
        if (!semesterId || data.semesterId === semesterId) {
          schedules.push({
            id: docSnap.id,
            ...data
          } as Schedule);
        }
      });
      return schedules;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // 2. Toggle locked state of a single schedule
  async toggleLockSchedule(id: string, isLocked: boolean, operatorId: string, operatorName: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        isLocked,
        updatedAt: new Date().toISOString()
      });
      
      await logScheduleActivity(
        operatorId,
        operatorName,
        isLocked ? "LOCK_SCHEDULE" : "UNLOCK_SCHEDULE",
        `Mengubah status kunci jadwal ${id} menjadi ${isLocked ? "TERKUNCI" : "TERBUKA"}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // 3. Reset schedules for active Academic Year & Semester (keeping locked ones)
  async resetSchedules(
    academicYearId: string, 
    semesterId: string, 
    operatorId: string, 
    operatorName: string,
    classId?: string
  ): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId)
      );
      const snapshot = await getDocs(q);
      const deleteBatch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const matchesClass = !classId || data.classId === classId;
        if (matchesClass && !data.isLocked) {
          deleteBatch.delete(docSnap.ref);
          count++;
        }
      });

      if (count > 0) {
        await deleteBatch.commit();
      }

      await logScheduleActivity(
        operatorId,
        operatorName,
        "RESET_SCHEDULE",
        classId 
          ? `Mereset ${count} slot jadwal untuk Kelas ${classId} (mempertahankan slot terkunci).`
          : `Mereset ${count} slot jadwal sekolah seluruh kelas (mempertahankan slot terkunci).`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    }
  },

  // 4. Save bulk schedules using intelligent diff / upsert
  async saveSchedules(
    schedules: Schedule[], 
    academicYearId: string, 
    semesterId: string, 
    operatorId: string, 
    operatorName: string,
    classIdToOverwrite?: string,
    mode?: 'manual-edit' | 'auto-generate'
  ): Promise<void> {
    try {
      // 1. Query existing schedules in Firestore for active Academic Year & Semester
      const q = query(
        collection(db, COLLECTION_NAME),
        where("academicYearId", "==", academicYearId)
      );
      const snapshot = await getDocs(q);
      
      // Filter by semesterId in memory
      const allExistingDocs = snapshot.docs.filter(docSnap => {
        const d = docSnap.data();
        return !semesterId || d.semesterId === semesterId;
      });

      // 2. Determine target existing docs scope based on classIdToOverwrite
      const targetExistingDocs = allExistingDocs.filter(docSnap => {
        const d = docSnap.data();
        if (!classIdToOverwrite || classIdToOverwrite === "ALL") return true;
        return d.classId === classIdToOverwrite;
      });

      const existingDocsMap = new Map<string, { ref: any; data: Schedule }>();
      targetExistingDocs.forEach(docSnap => {
        existingDocsMap.set(docSnap.id, {
          ref: docSnap.ref,
          data: { id: docSnap.id, ...docSnap.data() } as Schedule
        });
      });

      // 3. Determine target incoming schedules scope
      const targetIncomingSchedules = schedules.filter(s => {
        const matchesAy = !s.academicYearId || s.academicYearId === academicYearId;
        const matchesSem = !s.semesterId || s.semesterId === semesterId;
        const matchesClass = !classIdToOverwrite || classIdToOverwrite === "ALL" || s.classId === classIdToOverwrite;
        return matchesAy && matchesSem && matchesClass;
      });

      const incomingIdsSet = new Set<string>();
      targetIncomingSchedules.forEach(s => {
        if (s.id) incomingIdsSet.add(s.id);
      });

      // 4. Prepare Batch Write Operations
      const batchOps: Array<(batch: any) => void> = [];
      let updatedCount = 0;
      let addedCount = 0;
      let deletedCount = 0;

      // A. Identify deletions: docs in DB scope that are NOT in incoming set
      targetExistingDocs.forEach(docSnap => {
        const data = docSnap.data();
        if (!incomingIdsSet.has(docSnap.id)) {
          // Do NOT delete locked schedules!
          if (!data.isLocked) {
            batchOps.push((batch) => batch.delete(docSnap.ref));
            deletedCount++;
          }
        }
      });

      // B. Process incoming schedules (Updates & Creates)
      targetIncomingSchedules.forEach((sched) => {
        const cleanPayload = {
          academicYearId: sched.academicYearId || academicYearId,
          semesterId: sched.semesterId || semesterId,
          classId: sched.classId || "",
          className: sched.className || "",
          day: sched.day || "",
          sequence: sched.sequence || 1,
          jp: sched.jp || `JP ${sched.sequence || 1}`,
          subjectId: sched.subjectId || "",
          subjectName: sched.subjectName || "",
          teacherId: sched.teacherId || "",
          teacherName: sched.teacherName || "",
          teacherAssignments: (sched.teacherAssignments && sched.teacherAssignments.length > 0)
            ? sched.teacherAssignments
            : (existingDocsMap.get(sched.id || "")?.data.teacherAssignments || []),
          isLocked: sched.isLocked || false,
          lessonPeriodId: sched.lessonPeriodId || "LPERIOD_FALLBACK",
          createdBy: sched.createdBy || operatorId,
          createdAt: sched.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (sched.id && existingDocsMap.has(sched.id)) {
          // Existing document: UPSERT/UPDATE with same ID
          const existingItem = existingDocsMap.get(sched.id)!;
          const targetRef = existingItem.ref;
          
          // Preserve locked status if existing was locked
          if (existingItem.data.isLocked) {
            cleanPayload.isLocked = true;
          }

          batchOps.push((batch) => {
            batch.set(targetRef, { ...cleanPayload, id: sched.id }, { merge: true });
          });
          updatedCount++;
        } else {
          // New document: CREATE with new ID
          const newDocRef = doc(collection(db, COLLECTION_NAME));
          sched.id = newDocRef.id; // Assign generated ID back to memory object!

          batchOps.push((batch) => {
            batch.set(newDocRef, {
              ...cleanPayload,
              id: newDocRef.id
            });
          });
          addedCount++;
        }
      });

      // 5. Execute Batch Operations in Chunks (max 400 per batch)
      const chunkSize = 400;
      for (let i = 0; i < batchOps.length; i += chunkSize) {
        const chunk = batchOps.slice(i, i + chunkSize);
        const batchWrite = writeBatch(db);
        chunk.forEach(op => op(batchWrite));
        await batchWrite.commit();
      }

      const desc = mode === 'auto-generate' || (classIdToOverwrite && classIdToOverwrite !== "ALL")
        ? `Menyimpan jadwal hasil sinkronisasi (${addedCount} baru, ${updatedCount} diperbarui, ${deletedCount} dihapus).`
        : `Menyimpan perubahan jadwal pelajaran (${updatedCount} diperbarui, ${addedCount} ditambahkan, ${deletedCount} dihapus).`;

      await logScheduleActivity(
        operatorId,
        operatorName,
        "SAVE_SCHEDULE",
        desc
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  // 4b. Change teacher assignment with effective date for single or multiple slots
  async changeTeacherAssignment(params: {
    scheduleIds?: string[];
    classIds?: string[];
    subjectId?: string;
    academicYearId?: string;
    semesterId?: string;
    newTeacherId: string;
    newTeacherName: string;
    effectiveFrom: string; // YYYY-MM-DD
    effectiveUntil?: string | null;
    notes?: string;
    operatorId: string;
    operatorName: string;
  }): Promise<{ updatedCount: number }> {
    try {
      const {
        scheduleIds,
        classIds,
        subjectId,
        academicYearId,
        semesterId,
        newTeacherId,
        newTeacherName,
        effectiveFrom,
        effectiveUntil,
        notes,
        operatorId,
        operatorName
      } = params;

      // 1. Fetch relevant schedules
      const allSchedules = await this.getSchedules(academicYearId, semesterId);
      const targetSchedules = allSchedules.filter(s => {
        if (scheduleIds && scheduleIds.length > 0) {
          return scheduleIds.includes(s.id!);
        }
        const matchSubject = !subjectId || s.subjectId === subjectId;
        const matchClass = !classIds || classIds.length === 0 || classIds.includes(s.classId);
        return matchSubject && matchClass;
      });

      if (targetSchedules.length === 0) {
        throw new Error("Tidak ditemukan jadwal yang sesuai untuk pergantian guru pengampu.");
      }

      const todayStr = new Date().toISOString().split("T")[0];
      const previousDay = getPreviousDay(effectiveFrom);
      const timestamp = new Date().toISOString();
      const batch = writeBatch(db);
      let updatedCount = 0;

      for (const sched of targetSchedules) {
        if (!sched.id) continue;
        const currentAssignments: TeacherAssignment[] = Array.isArray(sched.teacherAssignments) 
          ? [...sched.teacherAssignments] 
          : [];

        // If there were no prior assignments in history, create baseline assignment from the schedule's original teacher
        if (currentAssignments.length === 0 && sched.teacherId) {
          currentAssignments.push({
            id: `assign_base_${sched.id}`,
            teacherId: sched.teacherId,
            teacherName: sched.teacherName,
            effectiveFrom: "2000-01-01", // Baseline
            effectiveUntil: previousDay,
            createdAt: sched.createdAt || timestamp,
            createdBy: sched.createdBy || operatorId,
            notes: "Penugasan awal semester"
          });
        } else {
          // Close out any currently active open assignment
          currentAssignments.forEach(a => {
            if (!a.effectiveUntil || a.effectiveUntil >= effectiveFrom) {
              if (a.effectiveFrom < effectiveFrom) {
                a.effectiveUntil = previousDay;
              }
            }
          });
        }

        // Add the new assignment
        const newAssignment: TeacherAssignment = {
          id: `assign_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          teacherId: newTeacherId,
          teacherName: newTeacherName,
          effectiveFrom,
          effectiveUntil: effectiveUntil || null,
          createdAt: timestamp,
          createdBy: operatorId,
          createdByName: operatorName,
          notes: notes || "Pergantian guru pengampu di tengah periode"
        };

        currentAssignments.push(newAssignment);

        // Sort assignments by effectiveFrom
        currentAssignments.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

        // Determine active teacher for today to update base teacherId/teacherName for instant display
        const activeNow = resolveTeacherForScheduleDate({
          ...sched,
          teacherAssignments: currentAssignments
        }, todayStr);

        const docRef = doc(db, COLLECTION_NAME, sched.id);
        batch.update(docRef, {
          teacherAssignments: currentAssignments,
          teacherId: activeNow.teacherId || newTeacherId,
          teacherName: activeNow.teacherName || newTeacherName,
          updatedAt: timestamp
        });

        updatedCount++;
      }

      await batch.commit();

      await logScheduleActivity(
        operatorId,
        operatorName,
        "CHANGE_TEACHER_ASSIGNMENT",
        `Mengganti guru pengampu menjadi ${newTeacherName} berlaku mulai ${effectiveFrom} untuk ${updatedCount} slot jadwal.`
      );

      return { updatedCount };
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  // 4c. Delete assignment record from a schedule's history
  async deleteTeacherAssignment(
    scheduleId: string,
    assignmentId: string,
    operatorId: string,
    operatorName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, scheduleId);
      const snap = await getDocs(query(collection(db, COLLECTION_NAME), where("__name__", "==", scheduleId)));
      if (snap.empty) throw new Error("Jadwal tidak ditemukan.");
      const sched = { id: snap.docs[0].id, ...snap.docs[0].data() } as Schedule;
      
      const currentAssignments = (sched.teacherAssignments || []).filter(a => (a.id || a.effectiveFrom) !== assignmentId);
      const todayStr = new Date().toISOString().split("T")[0];
      const activeNow = resolveTeacherForScheduleDate({
        ...sched,
        teacherAssignments: currentAssignments
      }, todayStr);

      await updateDoc(docRef, {
        teacherAssignments: currentAssignments,
        teacherId: activeNow.teacherId || sched.teacherId,
        teacherName: activeNow.teacherName || sched.teacherName,
        updatedAt: new Date().toISOString()
      });

      await logScheduleActivity(
        operatorId,
        operatorName,
        "DELETE_TEACHER_ASSIGNMENT",
        `Menghapus riwayat penugasan guru pada jadwal ${scheduleId}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${scheduleId}`);
    }
  },

  // 5. Publish Schedules Log
  async publishSchedules(operatorId: string, operatorName: string, description: string): Promise<void> {
    await logScheduleActivity(operatorId, operatorName, "PUBLISH_SCHEDULE", description);
  },

  // 6. Core Scheduling algorithm (Pre-calculation & backtracking)
  async previewSchedule(
    academicYearId: string,
    semesterId: string,
    targetClassId?: string, // Optional: for generating a single class
    optimize?: boolean,
    customRules?: string
  ): Promise<{ schedules: Schedule[]; metrics: ScheduleMetrics }> {
    
    // --- STEP 1: FETCH ALL MASTER DATA ---
    const [
      classesList,
      teachersList,
      subjectsList,
      matrixList,
      periodsList,
      settings
    ] = await Promise.all([
      classService.getClasses(),
      teacherService.getTeachers(),
      subjectService.getSubjects(),
      curriculumMatrixService.getCurriculumMatrix(),
      lessonPeriodService.getLessonPeriods(),
      schoolSettingsService.getSettings()
    ]);

    // --- STEP 1b: PARSE CUSTOM RULES ---
    const teacherOffDays = new Map<string, Set<string>>();
    const subjectOffDays = new Map<string, Set<string>>();
    const subjectMorningPriority = new Set<string>();
    const customTeacherMaxHours = new Map<string, number>();

    if (customRules) {
      const lines = customRules.split("\n");
      const daysList = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "ahad"];
      
      lines.forEach(line => {
        const lowerLine = line.trim().toLowerCase();
        if (!lowerLine) return;
        
        // Find if any day is mentioned in this line
        const mentionedDays = daysList.filter(d => lowerLine.includes(d));
        
        // Match teachers
        teachersList.forEach(t => {
          const tNameLower = t.name.toLowerCase();
          if (lowerLine.includes(tNameLower)) {
            // Check if it's an off-day rule: e.g. "tidak mengajar", "libur", "dilarang", "jangan di hari", "off"
            if (mentionedDays.length > 0 && (lowerLine.includes("tidak") || lowerLine.includes("libur") || lowerLine.includes("jangan") || lowerLine.includes("dilarang") || lowerLine.includes("bukan") || lowerLine.includes("off"))) {
              if (!teacherOffDays.has(t.id)) teacherOffDays.set(t.id, new Set());
              mentionedDays.forEach(d => teacherOffDays.get(t.id)!.add(d));
            }
            
            // Check if it's a max JP rule: e.g. "maksimal 4 jp", "max 4 jp", "maksimum 4"
            const maxMatch = lowerLine.match(/(?:maksimal|maksimum|max|paling banyak|jam mengajar)\s*(\d+)/);
            if (maxMatch) {
              const limit = parseInt(maxMatch[1], 10);
              if (!isNaN(limit)) {
                customTeacherMaxHours.set(t.id, limit);
              }
            }
          }
        });

        // Match subjects
        subjectsList.forEach(s => {
          const sNameLower = s.name.toLowerCase();
          if (lowerLine.includes(sNameLower)) {
            // Check if off-day rule
            if (mentionedDays.length > 0 && (lowerLine.includes("tidak") || lowerLine.includes("dilarang") || lowerLine.includes("jangan") || lowerLine.includes("bukan") || lowerLine.includes("off"))) {
              if (!subjectOffDays.has(s.id)) subjectOffDays.set(s.id, new Set());
              mentionedDays.forEach(d => subjectOffDays.get(s.id)!.add(d));
            }
            // Check morning priority: e.g. "pagi", "awal", "prioritas"
            if (lowerLine.includes("pagi") || lowerLine.includes("awal") || lowerLine.includes("prioritas")) {
              subjectMorningPriority.add(s.id);
            }
          }
        });
      });
    }

    // Active Day filtering
    const activeDays = settings.activeDays || ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];
    
    // Filtering down active/non-deleted classes and active lesson periods
    const classes = classesList.filter(c => c.status === "Aktif" && !c.isDeleted);
    const lessonPeriods = periodsList.filter(p => 
      p.type === LessonPeriodType.LESSON && 
      p.instructional &&
      activeDays.some(ad => ad.toLowerCase() === p.day.toLowerCase())
    );

    // Fetch existing schedules to implement Rule 21 (preserve locked) and Rule 22 (class specific)
    const existingSchedules = await this.getSchedules(academicYearId, semesterId);

    // --- STEP 2: BUILD CONSTRAINTS GRIDS ---
    // Track occupied slots in maps
    // key: classId_day_sequence -> subjectId
    const classOccupation = new Map<string, string>();
    // key: teacherId_day_sequence -> classId
    const teacherOccupation = new Map<string, string>();
    // key: teacherId_day -> current hours of teaching
    const teacherDailyHours = new Map<string, number>();

    // Lock schedules that we should preserve
    const preservedSchedules: Schedule[] = [];

    existingSchedules.forEach((sched) => {
      // Determine if this schedule should be locked (preserved)
      let shouldPreserve = false;
      if (sched.isLocked || optimize) {
        shouldPreserve = true;
      } else if (targetClassId && sched.classId !== targetClassId) {
        // Rule 22: Generate specific class leaves all other classes untouched
        shouldPreserve = true;
      }

      if (shouldPreserve) {
        preservedSchedules.push(sched);
        
        const slotKey = `${sched.classId}_${sched.day.toLowerCase()}_${sched.sequence}`;
        classOccupation.set(slotKey, sched.subjectId);

        const teachSlotKey = `${sched.teacherId}_${sched.day.toLowerCase()}_${sched.sequence}`;
        teacherOccupation.set(teachSlotKey, sched.classId);

        const teachDayKey = `${sched.teacherId}_${sched.day.toLowerCase()}`;
        const currentHours = teacherDailyHours.get(teachDayKey) || 0;
        teacherDailyHours.set(teachDayKey, currentHours + 1);
      }
    });

    // --- STEP 3: PREPARE SCHEDULING TASKS (Decomposition into blocks) ---
    interface SchedulingTask {
      classId: string;
      className: string;
      gradeLevel: string;
      subjectId: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      totalJpRequired: number;
      assignedJpCount: number; // already assigned via locked schedules
      remainingJpCount: number; // to schedule
    }

    const tasksRaw: SchedulingTask[] = [];

    // Filter classes to schedule
    const classesToSchedule = targetClassId 
      ? classes.filter(c => c.classId === targetClassId)
      : classes;

    // For each class, find curriculum matrix requirements
    classesToSchedule.forEach((cls) => {
      const grade = cls.gradeLevel; // "VII", "VIII", "IX"
      
      // Get curriculum matrix items for this grade level
      const classMatrix = matrixList.filter(item => {
        if (grade === "VII") return item.jp_vii > 0;
        if (grade === "VIII") return item.jp_viii > 0;
        if (grade === "IX") return item.jp_ix > 0;
        return false;
      });

      classMatrix.forEach((m) => {
        const reqJp = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
        
        // Count how many JPs are already assigned to locked schedules for this class + subject
        const lockedJpCount = preservedSchedules.filter(s => 
          s.classId === cls.classId && 
          s.subjectId === m.subjectId
        ).length;

        const remainingJp = Math.max(0, reqJp - lockedJpCount);

        let resolvedTeacherId = m.teacherId || "GURU_ALM_01";
        let resolvedTeacherName = m.teacherName || "Guru Pengampu";

        if (m.useDifferentTeachers) {
          if (cls.gradeLevel === "VII") {
            resolvedTeacherId = m.teacherId_vii || m.teacherId || "GURU_ALM_01";
            resolvedTeacherName = m.teacherName_vii || m.teacherName || "Guru Pengampu";
          } else if (cls.gradeLevel === "VIII") {
            resolvedTeacherId = m.teacherId_viii || m.teacherId || "GURU_ALM_01";
            resolvedTeacherName = m.teacherName_viii || m.teacherName || "Guru Pengampu";
          } else if (cls.gradeLevel === "IX") {
            resolvedTeacherId = m.teacherId_ix || m.teacherId || "GURU_ALM_01";
            resolvedTeacherName = m.teacherName_ix || m.teacherName || "Guru Pengampu";
          }
        }

        if (remainingJp > 0) {
          tasksRaw.push({
            classId: cls.classId,
            className: cls.name,
            gradeLevel: cls.gradeLevel,
            subjectId: m.subjectId,
            subjectName: m.subjectName,
            teacherId: resolvedTeacherId,
            teacherName: resolvedTeacherName,
            totalJpRequired: reqJp,
            assignedJpCount: lockedJpCount,
            remainingJpCount: remainingJp
          });
        }
      });
    });

    // Decompose tasks into blocks of size 1, 2, or 3
    interface BlockTask {
      classId: string;
      className: string;
      subjectId: string;
      subjectName: string;
      teacherId: string;
      teacherName: string;
      blockSize: number;
      isCore: boolean;
    }

    const decomposeJP = (jpCount: number, fallback: boolean): number[] => {
      if (jpCount <= 0) return [];
      if (jpCount === 1) return [1];
      if (jpCount === 2) return [2]; // Rule 4: Mapel 2 JP WAJIB berurutan
      if (jpCount === 3) return fallback ? [2, 1] : [3]; // Rule 5: 3 JP prioritizes 3, fallback 2+1
      if (jpCount === 4) return fallback ? [2, 1, 1] : [2, 2]; // Rule 6: 4 JP prioritizes 2+2
      if (jpCount === 5) return fallback ? [2, 2, 1] : [3, 2]; // Rule 7: 5 JP prioritizes 3+2
      if (jpCount === 6) return fallback ? [2, 2, 2] : [3, 3]; // Rule 8: 6 JP prioritizes 3+3, fallback 2+2+2
      
      // General decomposition for other larger blocks
      const list: number[] = [];
      let rem = jpCount;
      while (rem > 0) {
        if (rem >= 3) { list.push(3); rem -= 3; }
        else if (rem >= 2) { list.push(2); rem -= 2; }
        else { list.push(1); rem -= 1; }
      }
      return list;
    };

    // Helper to check core subject (Matematika, IPA, Bahasa Inggris)
    const isCoreSubject = (name: string): boolean => {
      const lower = name.toLowerCase();
      return lower.includes("matematika") || lower.includes("ipa") || lower.includes("sains") || lower.includes("inggris") || lower.includes("english");
    };

    // Construct the actual Block Tasks list
    let blockTasks: BlockTask[] = [];
    tasksRaw.forEach((task) => {
      const blockSizes = decomposeJP(task.remainingJpCount, false);
      const isCore = isCoreSubject(task.subjectName);
      blockSizes.forEach((size) => {
        blockTasks.push({
          classId: task.classId,
          className: task.className,
          subjectId: task.subjectId,
          subjectName: task.subjectName,
          teacherId: task.teacherId,
          teacherName: task.teacherName,
          blockSize: size,
          isCore
        });
      });
    });

    // Core Subject morning priority setting in settings:
    // If not explicitly set, default to true
    const corePriorityEnabled = (settings as any).prioritizeCoreSubjectsMorning !== false;

    // Sort block tasks:
    // 1. Largest block size first (Rule of thumb)
    // 2. Core subjects first
    // 3. Teachers with higher overall load (makes backtracking highly efficient)
    const teacherTotalRequirements = new Map<string, number>();
    blockTasks.forEach(bt => {
      teacherTotalRequirements.set(bt.teacherId, (teacherTotalRequirements.get(bt.teacherId) || 0) + bt.blockSize);
    });

    blockTasks.sort((a, b) => {
      if (a.blockSize !== b.blockSize) {
        return b.blockSize - a.blockSize; // Larger blocks first
      }
      if (a.isCore !== b.isCore) {
        return a.isCore ? -1 : 1; // Core subjects first
      }
      const loadA = teacherTotalRequirements.get(a.teacherId) || 0;
      const loadB = teacherTotalRequirements.get(b.teacherId) || 0;
      return loadB - loadA; // Higher total load first
    });

    // --- STEP 4: BACKTRACKING SOLVER ENGINE ---
    // Gather all valid lesson periods per day to find valid contiguous slots
    const periodsByDay = new Map<string, LessonPeriod[]>();
    activeDays.forEach(day => {
      const dayPeriods = lessonPeriods
        .filter(p => p.day.toLowerCase() === day.toLowerCase())
        .sort((a, b) => a.sequence - b.sequence);
      periodsByDay.set(day.toLowerCase(), dayPeriods);
    });

    const maxTeacherDailyJp = (settings as any).maxTeacherJp || 8; // Rule 10: Teacher daily maximum

    interface Placement {
      day: string;
      periods: LessonPeriod[];
    }

    // Find all valid contiguous placements for a task
    const findValidPlacementsForBlock = (task: BlockTask): Placement[] => {
      const validPlacements: Placement[] = [];

      activeDays.forEach((day) => {
        const dayLower = day.toLowerCase();
        const dayPeriods = periodsByDay.get(dayLower) || [];
        
        // --- Custom Rules Constraints ---
        // 1. Teacher off-day check
        const tOff = teacherOffDays.get(task.teacherId);
        if (tOff && tOff.has(dayLower)) {
          return;
        }
        
        // 2. Subject off-day check
        const sOff = subjectOffDays.get(task.subjectId);
        if (sOff && sOff.has(dayLower)) {
          return;
        }

        // Check Rule 9: Mapel yang sama tidak boleh muncul 2x dalam satu hari
        // Check if this class already has this subject on this day (excluding locked if they are on other days)
        let subjectAlreadyOnDay = false;
        // In-memory quick check
        for (let idx = 0; idx < dayPeriods.length; idx++) {
          const checkKey = `${task.classId}_${dayLower}_${dayPeriods[idx].sequence}`;
          if (classOccupation.get(checkKey) === task.subjectId) {
            subjectAlreadyOnDay = true;
            break;
          }
        }
        if (subjectAlreadyOnDay) return;

        // Check if teacher has enough budget for the day (Rule 10 with Custom Rule priority limit)
        const teachDayKey = `${task.teacherId}_${dayLower}`;
        const currentTeacherHours = teacherDailyHours.get(teachDayKey) || 0;
        const teacherMaxLimit = customTeacherMaxHours.get(task.teacherId) ?? maxTeacherDailyJp;
        if (currentTeacherHours + task.blockSize > teacherMaxLimit) {
          return;
        }

        // Loop through starting indexes
        for (let i = 0; i <= dayPeriods.length - task.blockSize; i++) {
          const candidatePeriods: LessonPeriod[] = [];
          let isValid = true;

          for (let j = 0; j < task.blockSize; j++) {
            const currentPeriod = dayPeriods[i + j];
            
            // Check consecutive sequence number contiguity
            if (j > 0 && currentPeriod.sequence !== dayPeriods[i + j - 1].sequence + 1) {
              isValid = false;
              break;
            }

            // Exclude fixed activities: BREAK (Istirahat) or ROUTINE
            const isFixedActivity = currentPeriod.type === LessonPeriodType.ROUTINE ||
                                    currentPeriod.type === LessonPeriodType.BREAK ||
                                    currentPeriod.title.toLowerCase().includes("istirahat") ||
                                    currentPeriod.type === ("BREAK" as any);
            if (isFixedActivity) {
              isValid = false;
              break;
            }

            // Check if slot is occupied for Class or Teacher
            const slotKey = `${task.classId}_${dayLower}_${currentPeriod.sequence}`;
            const teachSlotKey = `${task.teacherId}_${dayLower}_${currentPeriod.sequence}`;

            if (classOccupation.has(slotKey) || teacherOccupation.has(teachSlotKey)) {
              isValid = false;
              break;
            }

            candidatePeriods.push(currentPeriod);
          }

          if (isValid) {
            validPlacements.push({
              day,
              periods: candidatePeriods
            });
          }
        }
      });

      return validPlacements;
    };

    // Sort candidates using heuristics (Morning core priority, teacher balance)
    const sortPlacementsForBlock = (placements: Placement[], task: BlockTask) => {
      placements.sort((a, b) => {
        const teachDayKeyA = `${task.teacherId}_${a.day.toLowerCase()}`;
        const teachDayKeyB = `${task.teacherId}_${b.day.toLowerCase()}`;
        const hoursA = teacherDailyHours.get(teachDayKeyA) || 0;
        const hoursB = teacherDailyHours.get(teachDayKeyB) || 0;

        // Rule 11 Heuristic: Prefer days where the teacher is less busy to distribute load evenly!
        if (hoursA !== hoursB) {
          return hoursA - hoursB;
        }

        // Rule 12 Heuristic: Core subjects / Morning priority subjects prefer early sequences
        const firstSeqA = a.periods[0].sequence;
        const firstSeqB = b.periods[0].sequence;

        if (subjectMorningPriority.has(task.subjectId) || (corePriorityEnabled && task.isCore)) {
          return firstSeqA - firstSeqB; // Morning priority (lower sequence first)
        }

        return firstSeqA - firstSeqB; // Default to natural chronological order
      });
    };

    // Apply placements in state
    const applyPlacement = (task: BlockTask, placement: Placement, assignedList: Schedule[]) => {
      const dayLower = placement.day.toLowerCase();
      
      placement.periods.forEach((period) => {
        const slotKey = `${task.classId}_${dayLower}_${period.sequence}`;
        const teachSlotKey = `${task.teacherId}_${dayLower}_${period.sequence}`;
        
        classOccupation.set(slotKey, task.subjectId);
        teacherOccupation.set(teachSlotKey, task.classId);

        const teachDayKey = `${task.teacherId}_${dayLower}`;
        teacherDailyHours.set(teachDayKey, (teacherDailyHours.get(teachDayKey) || 0) + 1);

        // Append to schedule list
        assignedList.push({
          academicYearId,
          semesterId,
          classId: task.classId,
          className: task.className,
          day: placement.day,
          lessonPeriodId: period.id || "LPERIOD_FALLBACK",
          sequence: period.sequence,
          jp: period.title,
          subjectId: task.subjectId,
          subjectName: task.subjectName,
          teacherId: task.teacherId,
          teacherName: task.teacherName,
          isLocked: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: "system"
        });
      });
    };

    // Remove placement from state
    const removePlacement = (task: BlockTask, placement: Placement, assignedList: Schedule[]) => {
      const dayLower = placement.day.toLowerCase();
      const sequenceSet = new Set(placement.periods.map(p => p.sequence));

      placement.periods.forEach((period) => {
        const slotKey = `${task.classId}_${dayLower}_${period.sequence}`;
        const teachSlotKey = `${task.teacherId}_${dayLower}_${period.sequence}`;
        
        classOccupation.delete(slotKey);
        teacherOccupation.delete(teachSlotKey);

        const teachDayKey = `${task.teacherId}_${dayLower}`;
        const currHours = teacherDailyHours.get(teachDayKey) || 1;
        teacherDailyHours.set(teachDayKey, currHours - 1);
      });

      // Filter in-place
      for (let i = assignedList.length - 1; i >= 0; i--) {
        const s = assignedList[i];
        if (s.classId === task.classId && s.day.toLowerCase() === dayLower && sequenceSet.has(s.sequence)) {
          assignedList.splice(i, 1);
        }
      }
    };

    let bestAssignment: Schedule[] = [];
    let bestUnassigned: BlockTask[] = [];
    let bestSuccessCount = -1;

    let iterations = 0;
    const MAX_ITERATIONS = 3000;

    // Standard recursive backtracking
    const solve = (taskIdx: number, currentAssigned: Schedule[], skippedTasks: BlockTask[]): boolean => {
      iterations++;

      // Track the best partial solution found so far (most blocks placed)
      const successCount = currentAssigned.length;
      if (successCount > bestSuccessCount) {
        bestSuccessCount = successCount;
        bestAssignment = [...currentAssigned];
        bestUnassigned = [...skippedTasks, ...blockTasks.slice(taskIdx)];
      }

      // Base cases
      if (taskIdx >= blockTasks.length) {
        return true; // All tasks scheduled successfully!
      }

      if (iterations > MAX_ITERATIONS) {
        return false; // Iteration limit reached, halt to prevent locks
      }

      const task = blockTasks[taskIdx];
      const placements = findValidPlacementsForBlock(task);
      sortPlacementsForBlock(placements, task);

      for (const placement of placements) {
        applyPlacement(task, placement, currentAssigned);

        if (solve(taskIdx + 1, currentAssigned, skippedTasks)) {
          return true;
        }

        removePlacement(task, placement, currentAssigned);
      }

      // Best-Effort Relaxed Branch: allow skipping a block if it cannot be placed!
      // This is crucial to prevent hard blockages and find near-optimal layouts.
      // We skip with a maximum allowable skip budget or allow it generally with backtracking pruning.
      if (skippedTasks.length < 15) { // Cap on skipped blocks to avoid excessive recursion depth
        if (solve(taskIdx + 1, currentAssigned, [...skippedTasks, task])) {
          return true;
        }
      }

      return false;
    };

    // Run solve starting with preserved schedules
    const currentList = [...preservedSchedules];
    const initialSkipped: BlockTask[] = [];

    const isSolvedPerfectly = solve(0, currentList, initialSkipped);
    
    // Choose the best assignment
    const finalSchedules = bestAssignment.length > 0 ? bestAssignment : currentList;

    // --- STEP 5: COMPUTE PREVIEW METRICS & QUALITY SCORE ---
    const teachersMap = new Map<string, string>();
    teachersList.forEach(t => teachersMap.set(t.id, t.name));

    // Calculate unique totals
    const uniqueTeachersAssigned = new Set(finalSchedules.map(s => s.teacherId));
    const uniqueClassesAssigned = new Set(finalSchedules.map(s => s.classId));
    const uniqueSubjectsAssigned = new Set(finalSchedules.map(s => s.subjectId));

    // Calculate slots
    const totalLessonSlots = classes.length * lessonPeriods.length;
    const totalJpScheduled = finalSchedules.length - preservedSchedules.length + preservedSchedules.filter(s => targetClassId ? s.classId === targetClassId : true).length;
    const emptySlotsCount = totalLessonSlots - finalSchedules.length;

    // Calculate required JPs in curriculum matrix for this academic run
    let totalJpRequired = 0;
    classesToSchedule.forEach((cls) => {
      const grade = cls.gradeLevel;
      matrixList.forEach((m) => {
        const req = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
        totalJpRequired += req;
      });
    });

    // Check conflicts (as double insurance)
    let teacherConflicts = 0;
    let classConflicts = 0;
    let teacherOverloads = 0;

    const teacherDaySlotMap = new Map<string, string[]>();
    const classDaySlotMap = new Map<string, string[]>();
    const teacherDailyHoursMap = new Map<string, number>();

    finalSchedules.forEach((s) => {
      const key = `${s.day}_${s.sequence}`;
      
      // Teacher conflicts
      const teachKey = `${s.teacherId}_${key}`;
      if (!teacherDaySlotMap.has(teachKey)) {
        teacherDaySlotMap.set(teachKey, []);
      }
      teacherDaySlotMap.get(teachKey)!.push(s.className);

      // Class conflicts
      const classKey = `${s.classId}_${key}`;
      if (!classDaySlotMap.has(classKey)) {
        classDaySlotMap.set(classKey, []);
      }
      classDaySlotMap.get(classKey)!.push(s.subjectName);

      // Daily hours check for overloads
      const teachDayKey = `${s.teacherId}_${s.day.toLowerCase()}`;
      teacherDailyHoursMap.set(teachDayKey, (teacherDailyHoursMap.get(teachDayKey) || 0) + 1);
    });

    teacherDaySlotMap.forEach((classes, key) => {
      if (classes.length > 1) {
        teacherConflicts += (classes.length - 1);
      }
    });

    classDaySlotMap.forEach((subjects, key) => {
      if (subjects.length > 1) {
        classConflicts += (subjects.length - 1);
      }
    });

    teacherDailyHoursMap.forEach((hours, key) => {
      if (hours > maxTeacherDailyJp) {
        teacherOverloads++;
      }
    });

    // Unassigned required hours calculation
    const schedulePercentage = totalJpRequired > 0 
      ? Math.min(100, Math.round((totalJpScheduled / totalJpRequired) * 100))
      : 100;

    // QUALITY SCORE (Rule evaluation out of 100)
    let qualityScore = 100;
    
    // Deduct for conflicts
    qualityScore -= (teacherConflicts * 15);
    qualityScore -= (classConflicts * 15);
    
    // Deduct for missing target JP
    const missingJpCount = Math.max(0, totalJpRequired - totalJpScheduled);
    qualityScore -= (missingJpCount * 2);

    // Deduct for teacher overload
    qualityScore -= (teacherOverloads * 5);

    // Deduct for uneven teacher distribution
    // Compute teacher daily workload variance
    let varianceDeduction = 0;
    uniqueTeachersAssigned.forEach((tId) => {
      const dailyLoads: number[] = [];
      activeDays.forEach(day => {
        dailyLoads.push(teacherDailyHoursMap.get(`${tId}_${day.toLowerCase()}`) || 0);
      });
      // Standard deviation of daily hours
      const mean = dailyLoads.reduce((sum, v) => sum + v, 0) / dailyLoads.length;
      if (mean > 0) {
        const variance = dailyLoads.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / dailyLoads.length;
        const stdDev = Math.sqrt(variance);
        if (stdDev > 2) {
          varianceDeduction += 1; // minor deduction for high variance
        }
      }
    });
    qualityScore -= Math.min(15, varianceDeduction);

    // Restrict score boundaries
    qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

    const metrics: ScheduleMetrics = {
      totalTeachers: teachersList.length,
      totalClasses: classes.length,
      totalSubjects: subjectsList.length,
      totalJpScheduled,
      totalJpRequired,
      totalSlots: totalLessonSlots,
      teacherConflicts,
      classConflicts,
      emptySlots: emptySlotsCount,
      schedulePercentage,
      qualityScore,
      unassignedTasks: bestUnassigned.map(task => ({
        classId: task.classId,
        className: task.className,
        subjectId: task.subjectId,
        subjectName: task.subjectName,
        teacherId: task.teacherId,
        teacherName: task.teacherName,
        blockSize: task.blockSize
      }))
    };

    return {
      schedules: finalSchedules,
      metrics
    };
  }
};
