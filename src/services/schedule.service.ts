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
import { Schedule, LessonPeriod, LessonPeriodType, CurriculumMatrix, Class } from "../types";

const COLLECTION_NAME = "schedules";

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

  // 4. Save bulk schedules (supporting overwriting unlocked schedules)
  async saveSchedules(
    schedules: Schedule[], 
    academicYearId: string, 
    semesterId: string, 
    operatorId: string, 
    operatorName: string,
    classIdToOverwrite?: string
  ): Promise<void> {
    try {
      // Fetch current schedules to see what to delete
      const q = query(
        collection(db, COLLECTION_NAME),
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId)
      );
      const snapshot = await getDocs(q);
      const existingDocs = snapshot.docs;

      // 1. Delete old unlocked schedules that are to be overwritten
      const batchDelete = writeBatch(db);
      existingDocs.forEach((docSnap) => {
        const data = docSnap.data();
        const matchesClass = !classIdToOverwrite || data.classId === classIdToOverwrite;
        if (matchesClass && !data.isLocked) {
          batchDelete.delete(docSnap.ref);
        }
      });
      await batchDelete.commit();

      // 2. Add new schedules in batches (max 400 per batch)
      const newSchedules = schedules.filter(s => {
        // Only save newly generated schedules (which don't have ids or are unlocked in the preview)
        return !s.id;
      });

      const chunks: Schedule[][] = [];
      for (let i = 0; i < newSchedules.length; i += 400) {
        chunks.push(newSchedules.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batchWrite = writeBatch(db);
        chunk.forEach((sched) => {
          const docRef = doc(collection(db, COLLECTION_NAME));
          batchWrite.set(docRef, {
            ...sched,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: operatorId
          });
        });
        await batchWrite.commit();
      }

      const desc = classIdToOverwrite 
        ? `Menyimpan jadwal otomatis baru untuk kelas tertentu (ID: ${classIdToOverwrite}).`
        : `Menyimpan seluruh jadwal pelajaran otomatis baru (${newSchedules.length} slot baru ditambahkan).`;

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
    const activeDays = settings.activeDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    
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
