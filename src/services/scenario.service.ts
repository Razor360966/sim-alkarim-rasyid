import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from "firebase/firestore";
import { db, auth } from "../firebase/config";
import {
  ScheduleScenario,
  ScenarioCurriculumMatrix,
  ScenarioSubject,
  ScenarioSchedule,
  ScenarioChangeLog,
  ScenarioStatus,
  ScenarioConflict,
  ScenarioApplyPreview,
  ScenarioApplyResult,
  ScenarioSyncPreviewResult,
  ScenarioSyncItemPreview,
  ScenarioSyncAffectedSlot,
  CurriculumMatrix,
  Schedule,
  Subject,
  Class,
  LessonPeriod,
  LessonPeriodType,
  Teacher,
  TeacherAssignment
} from "../types";
import { curriculumMatrixService } from "./curriculumMatrixService";
import { scheduleService } from "./schedule.service";
import { subjectService } from "./subjectService";
import { classService } from "./classService";
import { lessonPeriodService } from "./lessonPeriod.service";
import { teacherAssignmentService } from "./teacherAssignment.service";
import { isClassMatch, normalizeGradeLevel, getCanonicalSlotKey } from "../utils/gradeLevelHelper";
import { deduplicateSchedules, getScheduleSlotJpCount, isSlotMatchingCurriculum } from "../utils/scenarioScheduleHelper";

export function safeNormalizeGrade(val?: string | number | null): "VII" | "VIII" | "IX" | null {
  if (val === null || val === undefined) return null;
  const norm = normalizeGradeLevel(val);
  return norm === "INVALID_GRADE_LEVEL" ? null : norm;
}

export function getClassGradeLevel(
  c: { id?: string; classId?: string; name?: string; gradeLevel?: string | number | null } | undefined | null
): "VII" | "VIII" | "IX" | null {
  if (!c) return null;
  return safeNormalizeGrade(c.gradeLevel) || safeNormalizeGrade(c.name);
}

export function toValidGradeLevel(val?: string | number | null, fallback: "VII" | "VIII" | "IX" = "VII"): "VII" | "VIII" | "IX" {
  return safeNormalizeGrade(val) || fallback;
}

/**
 * Resolves the appropriate teacher from a Scenario Curriculum Matrix item
 * for a specific class/grade level (VII, VIII, IX).
 * Handles multi-teacher per grade (useDifferentTeachers) and safe fallbacks.
 */
export function getScenarioCurriculumTeacherForClass(
  curriculumItem: ScenarioCurriculumMatrix | Partial<ScenarioCurriculumMatrix> | undefined,
  gradeLevel: "VII" | "VIII" | "IX" | string
): { teacherId: string; teacherName: string } {
  if (!curriculumItem) {
    return { teacherId: "", teacherName: "Belum Ditugaskan" };
  }
  const normGrade = safeNormalizeGrade(gradeLevel) || "VII";

  // 1. If different teachers per grade are explicitly enabled or populated
  if (curriculumItem.useDifferentTeachers) {
    if (normGrade === "VII" && curriculumItem.teacherId_vii && curriculumItem.teacherId_vii.trim() !== "") {
      return {
        teacherId: curriculumItem.teacherId_vii.trim(),
        teacherName: curriculumItem.teacherName_vii ? curriculumItem.teacherName_vii.trim() : "Guru Pengampu"
      };
    }
    if (normGrade === "VIII" && curriculumItem.teacherId_viii && curriculumItem.teacherId_viii.trim() !== "") {
      return {
        teacherId: curriculumItem.teacherId_viii.trim(),
        teacherName: curriculumItem.teacherName_viii ? curriculumItem.teacherName_viii.trim() : "Guru Pengampu"
      };
    }
    if (normGrade === "IX" && curriculumItem.teacherId_ix && curriculumItem.teacherId_ix.trim() !== "") {
      return {
        teacherId: curriculumItem.teacherId_ix.trim(),
        teacherName: curriculumItem.teacherName_ix ? curriculumItem.teacherName_ix.trim() : "Guru Pengampu"
      };
    }
  }

  // 2. Direct grade-level fallback even without flag if specific grade is populated
  if (normGrade === "VII" && curriculumItem.teacherId_vii && curriculumItem.teacherId_vii.trim() !== "") {
    return {
      teacherId: curriculumItem.teacherId_vii.trim(),
      teacherName: curriculumItem.teacherName_vii ? curriculumItem.teacherName_vii.trim() : "Guru Pengampu"
    };
  }
  if (normGrade === "VIII" && curriculumItem.teacherId_viii && curriculumItem.teacherId_viii.trim() !== "") {
    return {
      teacherId: curriculumItem.teacherId_viii.trim(),
      teacherName: curriculumItem.teacherName_viii ? curriculumItem.teacherName_viii.trim() : "Guru Pengampu"
    };
  }
  if (normGrade === "IX" && curriculumItem.teacherId_ix && curriculumItem.teacherId_ix.trim() !== "") {
    return {
      teacherId: curriculumItem.teacherId_ix.trim(),
      teacherName: curriculumItem.teacherName_ix ? curriculumItem.teacherName_ix.trim() : "Guru Pengampu"
    };
  }

  // 3. Global teacher fallback
  if (curriculumItem.teacherId && curriculumItem.teacherId.trim() !== "") {
    return {
      teacherId: curriculumItem.teacherId.trim(),
      teacherName: curriculumItem.teacherName ? curriculumItem.teacherName.trim() : "Guru Pengampu"
    };
  }

  return { teacherId: "", teacherName: "Belum Ditugaskan" };
}

function cleanUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[key] = cleanUndefinedFields(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

// Dedicated Isolated Scenario Collections
const SCENARIOS_COL = "schedule_scenarios";
const SCENARIO_CURRICULUM_COL = "scenario_curriculum_matrix";
const SCENARIO_SUBJECTS_COL = "scenario_subjects";
const SCENARIO_SCHEDULES_COL = "scenario_schedules";
const SCENARIO_LOGS_COL = "scenario_change_logs";

export const scenarioService = {
  // ---------------------------------------------------------------------------
  // 1. SCENARIOS (METADATA & LIFECYCLE)
  // ---------------------------------------------------------------------------

  /**
   * Get all scenario metadata documents
   */
  async getScenarios(): Promise<ScheduleScenario[]> {
    const snap = await getDocs(collection(db, SCENARIOS_COL));
    const items: ScheduleScenario[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as ScheduleScenario);
    });
    // Sort newest first
    return items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  },

  /**
   * Get a single scenario metadata by ID
   */
  async getScenarioById(scenarioId: string): Promise<ScheduleScenario | null> {
    const ref = doc(db, SCENARIOS_COL, scenarioId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as ScheduleScenario;
  },

  /**
   * Create a new scenario with snapshot taken from operational data.
   * STRICT GUARANTEE: Only writes to scenario_* collections.
   */
  async createScenarioFromSnapshot(params: {
    name: string;
    description?: string;
    academicYearId: string;
    academicYearName: string;
    semesterId: string;
    semesterName: string;
    consultationNotes?: string;
    user: { uid: string; displayName?: string; role?: string };
  }): Promise<string> {
    if (!params.name || !params.name.trim()) {
      throw new Error("Nama rancangan jadwal bayangan wajib diisi.");
    }
    if (!params.academicYearId) {
      throw new Error("Tahun ajaran sumber wajib dipilih.");
    }
    if (!params.semesterId) {
      throw new Error("Semester sumber wajib dipilih.");
    }
    const callerUid = auth?.currentUser?.uid || params.user?.uid;
    if (!callerUid) {
      throw new Error("Sesi pengguna tidak valid. Silakan login kembali.");
    }
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";
    const callerRole = params.user?.role || "";

    const now = new Date().toISOString();
    const scenarioId = `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Fetch operational source data (strictly READ-ONLY)
    const [opCurriculums, opSchedules, opSubjects, opClasses, opAssignmentsPeriod, allAssignments] = await Promise.all([
      curriculumMatrixService.getCurriculumMatrix().catch(() => [] as CurriculumMatrix[]),
      scheduleService.getSchedules(params.academicYearId, params.semesterId).catch(() => [] as Schedule[]),
      subjectService.getSubjects().catch(() => [] as Subject[]),
      classService.getClasses().catch(() => [] as Class[]),
      teacherAssignmentService.getTeacherAssignmentsByPeriod(params.academicYearId, params.semesterId).catch(() => [] as TeacherAssignment[]),
      teacherAssignmentService.getTeacherAssignments().catch(() => [] as TeacherAssignment[])
    ]);

    // Combined assignments prioritizing the selected period assignments without dropping general records
    const assignmentMap = new Map<string, TeacherAssignment>();
    allAssignments.forEach((a) => {
      if (a.id) assignmentMap.set(a.id, a);
    });
    opAssignmentsPeriod.forEach((a) => {
      if (a.id) assignmentMap.set(a.id, a);
    });
    const combinedAssignments = Array.from(assignmentMap.values());
    const opAssignments = combinedAssignments.length > 0 ? combinedAssignments : (opAssignmentsPeriod.length > 0 ? opAssignmentsPeriod : allAssignments);

    // 2. Prepare Snapshot for scenario_curriculum_matrix with accurate grade-level teacher assignments
    const curriculumSnapshots: ScenarioCurriculumMatrix[] = opCurriculums.map((cm, idx) => {
      // Helper to resolve operational teacher for a specific grade level
      const resolveTeacherForGrade = (targetGrade: "VII" | "VIII" | "IX") => {
        const targetClasses = opClasses.filter(
          (c) => getClassGradeLevel(c) === targetGrade
        );

        // Priority 1: Check active assignments in teacher_assignments using canonical resolution per class
        for (const cls of targetClasses) {
          const targetClassId = cls.id || cls.classId;
          const res = teacherAssignmentService.resolveTeacherAssignmentSync({
            academicYearId: params.academicYearId,
            semesterId: params.semesterId,
            subjectId: cm.subjectId,
            classId: targetClassId,
            gradeLevel: targetGrade,
            curriculumMatrixItem: cm,
            preloadedAssignments: opAssignments
          });
          if (res.source === "assignment" && res.teacherId && res.teacherId.trim() !== "" && res.teacherName !== "Belum Ditentukan") {
            return {
              id: res.teacherId.trim(),
              name: res.teacherName ? res.teacherName.trim() : "Guru Pengampu"
            };
          }
        }

        // Priority 1B: Check active assignments matching subject and target class ID or gradeLevel directly
        if (opAssignments.length > 0) {
          for (const a of opAssignments) {
            if (a.isActive === false || !a.teacherId || a.teacherId.trim() === "" || a.teacherName === "Belum Ditentukan") {
              continue;
            }
            const isSubMatch = (a.subjectId && (a.subjectId === cm.subjectId || a.subjectId === cm.id)) ||
              (Boolean(a.subjectName && cm.subjectName) && a.subjectName.trim().toLowerCase() === cm.subjectName.trim().toLowerCase());
            if (!isSubMatch) continue;

            const aNormGrade = safeNormalizeGrade(a.gradeLevel) || safeNormalizeGrade(a.className);
            const isClassIdMatch = a.classId && targetClasses.some((c) => isClassMatch(a.classId, c.id || c.classId, opClasses));
            const isGrdMatch = isClassIdMatch || (aNormGrade !== null && aNormGrade === targetGrade);
            if (isGrdMatch) {
              return {
                id: a.teacherId.trim(),
                name: a.teacherName ? a.teacherName.trim() : "Guru Pengampu"
              };
            }
          }
        }

        // Priority 2: Check operational live schedules strictly for this grade
        if (opSchedules.length > 0) {
          for (const s of opSchedules) {
            if (!s.teacherId || s.teacherId.trim() === "" || s.teacherName === "Belum Ditentukan") {
              continue;
            }
            const isSubMatch = (s.subjectId && (s.subjectId === cm.subjectId || s.subjectId === cm.id)) ||
              (Boolean(s.subjectName && cm.subjectName) && s.subjectName.trim().toLowerCase() === cm.subjectName.trim().toLowerCase());
            if (!isSubMatch) continue;

            const matchedCls = opClasses.find((c) => isClassMatch(c.id || c.classId, s.classId, opClasses));
            const sGrade = safeNormalizeGrade((s as any).gradeLevel) || getClassGradeLevel(matchedCls) || safeNormalizeGrade(s.className);
            if (sGrade === targetGrade) {
              return {
                id: s.teacherId.trim(),
                name: s.teacherName ? s.teacherName.trim() : "Guru Pengampu"
              };
            }
          }
        }

        // Priority 3: Legacy curriculum matrix grade-specific fields
        if (targetGrade === "VII" && cm.teacherId_vii && cm.teacherId_vii.trim() !== "") {
          return {
            id: cm.teacherId_vii.trim(),
            name: cm.teacherName_vii ? cm.teacherName_vii.trim() : "Guru Pengampu"
          };
        }
        if (targetGrade === "VIII" && cm.teacherId_viii && cm.teacherId_viii.trim() !== "") {
          return {
            id: cm.teacherId_viii.trim(),
            name: cm.teacherName_viii ? cm.teacherName_viii.trim() : "Guru Pengampu"
          };
        }
        if (targetGrade === "IX" && cm.teacherId_ix && cm.teacherId_ix.trim() !== "") {
          return {
            id: cm.teacherId_ix.trim(),
            name: cm.teacherName_ix ? cm.teacherName_ix.trim() : "Guru Pengampu"
          };
        }

        // Priority 4: Fallback to global curriculum matrix teacher ONLY IF not using different teachers
        if (!cm.useDifferentTeachers && cm.teacherId && cm.teacherId.trim() !== "") {
          return {
            id: cm.teacherId.trim(),
            name: cm.teacherName ? cm.teacherName.trim() : "Guru Pengampu"
          };
        }

        return { id: "", name: "" };
      };

      const tchVii = resolveTeacherForGrade("VII");
      const tchViii = resolveTeacherForGrade("VIII");
      const tchIx = resolveTeacherForGrade("IX");

      // Verify if teachers differ across any grades or if individual grade fields are populated
      const hasDistinctTeachers = Boolean(
        (tchVii.id && tchViii.id && tchVii.id !== tchViii.id) ||
        (tchVii.id && tchIx.id && tchVii.id !== tchIx.id) ||
        (tchViii.id && tchIx.id && tchViii.id !== tchIx.id) ||
        (cm.teacherId_vii && cm.teacherId_viii && cm.teacherId_vii !== cm.teacherId_viii) ||
        (cm.teacherId_vii && cm.teacherId_ix && cm.teacherId_vii !== cm.teacherId_ix) ||
        (cm.teacherId_viii && cm.teacherId_ix && cm.teacherId_viii !== cm.teacherId_ix)
      );
      const useDifferentTeachers = Boolean(cm.useDifferentTeachers) || hasDistinctTeachers;

      const primaryTeacherId = cm.teacherId || tchVii.id || tchViii.id || tchIx.id || "";
      const primaryTeacherName = cm.teacherName || tchVii.name || tchViii.name || tchIx.name || "";

      // NEVER collapse distinct teachers! Maintain each grade's resolved teacher safely
      const teacherId_vii = tchVii.id || cm.teacherId_vii || (useDifferentTeachers ? "" : primaryTeacherId);
      const teacherName_vii = tchVii.name || cm.teacherName_vii || (useDifferentTeachers ? "" : primaryTeacherName);

      const teacherId_viii = tchViii.id || cm.teacherId_viii || (useDifferentTeachers ? "" : primaryTeacherId);
      const teacherName_viii = tchViii.name || cm.teacherName_viii || (useDifferentTeachers ? "" : primaryTeacherName);

      const teacherId_ix = tchIx.id || cm.teacherId_ix || (useDifferentTeachers ? "" : primaryTeacherId);
      const teacherName_ix = tchIx.name || cm.teacherName_ix || (useDifferentTeachers ? "" : primaryTeacherName);

      return {
        id: `${scenarioId}_cm_${cm.id || idx}`,
        scenarioId,
        originalCurriculumId: cm.id,
        subjectId: cm.subjectId,
        subjectName: cm.subjectName,
        subjectGroup: "A", // Default group
        isCustomSubject: false,
        isActiveInScenario: true,
        jp_vii: cm.jp_vii || 0,
        jp_viii: cm.jp_viii || 0,
        jp_ix: cm.jp_ix || 0,
        baseline_jp_vii: cm.jp_vii || 0,
        baseline_jp_viii: cm.jp_viii || 0,
        baseline_jp_ix: cm.jp_ix || 0,
        teacherId: primaryTeacherId,
        teacherName: primaryTeacherName,
        teacherId_vii,
        teacherName_vii,
        teacherId_viii,
        teacherName_viii,
        teacherId_ix,
        teacherName_ix,
        useDifferentTeachers,
        order: cm.order ?? idx,
        createdAt: now,
        updatedAt: now
      };
    });

    // 3. Prepare Snapshot for scenario_subjects (matching subjects referenced in curriculum or master)
    const subjectSnapshots: ScenarioSubject[] = opSubjects.map((sb) => ({
      id: `${scenarioId}_sb_${sb.id}`,
      scenarioId,
      originalSubjectId: sb.id,
      code: sb.code || "",
      name: sb.name,
      group: sb.group || "A",
      kkm: sb.kkm || 75,
      grades: sb.grades || ["7", "8", "9"],
      subjectType: sb.subjectType || "UMUM",
      isCustomSubject: false,
      isActive: sb.isActive !== false,
      createdAt: now,
      updatedAt: now
    }));

    // Enrich curriculum group from subjects
    const subMap = new Map<string, Subject>();
    opSubjects.forEach((s) => subMap.set(s.id, s));
    curriculumSnapshots.forEach((cm) => {
      const s = subMap.get(cm.subjectId);
      if (s) cm.subjectGroup = s.group;
    });

    // 4. Prepare Snapshot for scenario_schedules strictly mapped to scenario curriculum matrix teachers
    const scheduleSnapshots: ScenarioSchedule[] = opSchedules.map((sc, idx) => {
      const matchedCls = opClasses.find((c) => isClassMatch(c.id || c.classId, sc.classId, opClasses));
      const grade = safeNormalizeGrade((sc as any).gradeLevel) ||
                    getClassGradeLevel(matchedCls) ||
                    safeNormalizeGrade(sc.className) ||
                    "VII";
      let teacherId = sc.teacherId || "";
      let teacherName = sc.teacherName || "";

      // Strict SSOT: Resolve teacher from snapshot curriculum matrix for this grade!
      const cur = curriculumSnapshots.find((c) =>
        (sc.subjectId && (c.subjectId === sc.subjectId || c.originalCurriculumId === sc.subjectId)) ||
        (Boolean(c.subjectName && sc.subjectName) && c.subjectName.trim().toLowerCase() === sc.subjectName.trim().toLowerCase())
      );

      if (cur) {
        const res = getScenarioCurriculumTeacherForClass(cur, grade);
        if (res.teacherId) {
          teacherId = res.teacherId;
          teacherName = res.teacherName;
        }
      }

      return {
        id: `${scenarioId}_sc_${sc.id || idx}`,
        scenarioId,
        academicYearId: params.academicYearId,
        semesterId: params.semesterId,
        classId: sc.classId,
        className: sc.className || matchedCls?.name || "",
        gradeLevel: grade,
        day: sc.day,
        lessonPeriodId: sc.lessonPeriodId,
        sequence: sc.sequence,
        jp: sc.jp,
        subjectId: sc.subjectId,
        subjectName: sc.subjectName,
        teacherId,
        teacherName,
        isLocked: Boolean(sc.isLocked),
        createdAt: now,
        updatedAt: now
      };
    });

    // 5. Calculate initial metrics
    const totalJpVii = curriculumSnapshots.reduce((acc, c) => acc + (c.isActiveInScenario ? c.jp_vii : 0), 0);
    const totalJpVIII = curriculumSnapshots.reduce((acc, c) => acc + (c.isActiveInScenario ? c.jp_viii : 0), 0);
    const totalJpIX = curriculumSnapshots.reduce((acc, c) => acc + (c.isActiveInScenario ? c.jp_ix : 0), 0);

    const scenarioMetadata: ScheduleScenario = {
      id: scenarioId,
      name: params.name,
      description: params.description || "",
      academicYearId: params.academicYearId,
      academicYearName: params.academicYearName,
      semesterId: params.semesterId,
      semesterName: params.semesterName,
      status: "Draft",
      statusHistory: [
        {
          status: "Draft",
          changedBy: callerUid,
          changedByName: callerName,
          changedAt: now,
          notes: "Rancangan dibuat dari snapshot data operasional."
        }
      ],
      consultationNotes: params.consultationNotes || "",
      sourceSnapshotMeta: {
        snapshotAt: now,
        academicYearId: params.academicYearId,
        academicYearName: params.academicYearName,
        semesterId: params.semesterId,
        semesterName: params.semesterName,
        sourceCurriculumCount: curriculumSnapshots.length,
        sourceScheduleCount: scheduleSnapshots.length,
        sourceSubjectCount: subjectSnapshots.length
      },
      summaryMetrics: {
        totalJpVii,
        totalJpVIII,
        totalJpIX,
        diffJpVii: 0,
        diffJpVIII: 0,
        diffJpIX: 0,
        subjectsAdded: 0,
        subjectsRemoved: 0,
        subjectsModified: 0,
        totalScheduleSlots: scheduleSnapshots.length,
        conflictCount: 0
      },
      createdBy: callerUid,
      createdByName: callerName,
      createdByRole: callerRole,
      updatedBy: callerUid,
      updatedByName: callerName,
      createdAt: now,
      updatedAt: now
    };

    // 6. Write via Firestore Batches into ISOLATED scenario collections
    // A. Write Scenario Metadata
    await setDoc(doc(db, SCENARIOS_COL, scenarioId), cleanUndefinedFields(scenarioMetadata));

    // B. Write Curriculums in batches (max 450 per batch)
    const BATCH_SIZE = 400;
    for (let i = 0; i < curriculumSnapshots.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = curriculumSnapshots.slice(i, i + BATCH_SIZE);
      chunk.forEach((item) => {
        batch.set(doc(db, SCENARIO_CURRICULUM_COL, item.id), cleanUndefinedFields(item));
      });
      await batch.commit();
    }

    // C. Write Subjects in batches
    for (let i = 0; i < subjectSnapshots.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = subjectSnapshots.slice(i, i + BATCH_SIZE);
      chunk.forEach((item) => {
        batch.set(doc(db, SCENARIO_SUBJECTS_COL, item.id), cleanUndefinedFields(item));
      });
      await batch.commit();
    }

    // D. Write Schedules in batches
    for (let i = 0; i < scheduleSnapshots.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = scheduleSnapshots.slice(i, i + BATCH_SIZE);
      chunk.forEach((item) => {
        batch.set(doc(db, SCENARIO_SCHEDULES_COL, item.id), cleanUndefinedFields(item));
      });
      await batch.commit();
    }

    // E. Write initial change log
    const logDoc: ScenarioChangeLog = {
      id: `${scenarioId}_log_create`,
      scenarioId,
      action: "CREATE_SCENARIO",
      description: `Rancangan "${params.name}" berhasil dibuat dari snapshot operasional (${curriculumSnapshots.length} kurikulum, ${scheduleSnapshots.length} slot jadwal).`,
      changedBy: params.user.uid,
      changedByName: params.user.displayName || "Pengguna",
      changedAt: now
    };
    await setDoc(doc(db, SCENARIO_LOGS_COL, logDoc.id), cleanUndefinedFields(logDoc));

    return scenarioId;
  },

  /**
   * Duplicate an existing scenario into an independent new scenario
   */
  async duplicateScenario(params: {
    sourceScenarioId: string;
    newScenarioName: string;
    newDescription?: string;
    user: { uid: string; displayName?: string; role?: string };
  }): Promise<string> {
    const sourceScenario = await this.getScenarioById(params.sourceScenarioId);
    if (!sourceScenario) throw new Error("Rancangan sumber tidak ditemukan");

    const now = new Date().toISOString();
    const newScenarioId = `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Read source scenario items
    const [curriculums, subjects, schedules] = await Promise.all([
      this.getScenarioCurriculums(params.sourceScenarioId),
      this.getScenarioSubjects(params.sourceScenarioId),
      this.getScenarioSchedules(params.sourceScenarioId)
    ]);

    const callerUid = auth?.currentUser?.uid || params.user?.uid;
    if (!callerUid) {
      throw new Error("Sesi pengguna tidak valid. Silakan login kembali.");
    }
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";
    const callerRole = params.user?.role || "";

    // Create new metadata
    const newMetadata: ScheduleScenario = {
      ...sourceScenario,
      id: newScenarioId,
      name: params.newScenarioName,
      description: params.newDescription || `Duplikasi dari "${sourceScenario.name}"`,
      status: "Draft",
      statusHistory: [
        {
          status: "Draft",
          changedBy: callerUid,
          changedByName: callerName,
          changedAt: now,
          notes: `Diduplikasi dari rancangan "${sourceScenario.name}".`
        }
      ],
      createdBy: callerUid,
      createdByName: callerName,
      createdByRole: callerRole,
      updatedBy: callerUid,
      updatedByName: callerName,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(doc(db, SCENARIOS_COL, newScenarioId), cleanUndefinedFields(newMetadata));

    // Write duplicated items
    const BATCH_SIZE = 400;
    // Curriculums
    for (let i = 0; i < curriculums.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = curriculums.slice(i, i + BATCH_SIZE);
      chunk.forEach((c) => {
        const newId = `${newScenarioId}_cm_${c.id.split("_cm_")[1] || Math.random().toString(36).substring(2, 6)}`;
        batch.set(doc(db, SCENARIO_CURRICULUM_COL, newId), {
          ...c,
          id: newId,
          scenarioId: newScenarioId,
          createdAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
    }

    // Subjects
    for (let i = 0; i < subjects.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = subjects.slice(i, i + BATCH_SIZE);
      chunk.forEach((s) => {
        const newId = `${newScenarioId}_sb_${s.id.split("_sb_")[1] || Math.random().toString(36).substring(2, 6)}`;
        batch.set(doc(db, SCENARIO_SUBJECTS_COL, newId), {
          ...s,
          id: newId,
          scenarioId: newScenarioId,
          createdAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
    }

    // Schedules
    for (let i = 0; i < schedules.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = schedules.slice(i, i + BATCH_SIZE);
      chunk.forEach((sc) => {
        const newId = `${newScenarioId}_sc_${sc.id.split("_sc_")[1] || Math.random().toString(36).substring(2, 6)}`;
        batch.set(doc(db, SCENARIO_SCHEDULES_COL, newId), {
          ...sc,
          id: newId,
          scenarioId: newScenarioId,
          createdAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
    }

    // Change log
    const logDoc: ScenarioChangeLog = {
      id: `${newScenarioId}_log_dup`,
      scenarioId: newScenarioId,
      action: "DUPLICATE_SCENARIO",
      description: `Rancangan diduplikasi dari "${sourceScenario.name}".`,
      changedBy: params.user.uid,
      changedByName: params.user.displayName || "Pengguna",
      changedAt: now
    };
    await setDoc(doc(db, SCENARIO_LOGS_COL, logDoc.id), logDoc);

    return newScenarioId;
  },

  /**
   * Update scenario metadata (e.g. name, description, consultationNotes)
   */
  async updateScenarioMetadata(
    scenarioId: string,
    data: Partial<ScheduleScenario>,
    user: { uid: string; displayName?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    await updateDoc(doc(db, SCENARIOS_COL, scenarioId), {
      ...data,
      updatedBy: user.uid,
      updatedByName: user.displayName || "Pengguna",
      updatedAt: now
    });
  },

  /**
   * Update scenario approval status and record audit log
   */
  async updateScenarioStatus(params: {
    scenarioId: string;
    status: ScenarioStatus;
    notes?: string;
    reason?: string;
    user: { uid: string; displayName?: string };
  }): Promise<void> {
    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan tidak ditemukan");

    const now = new Date().toISOString();
    const newEntry = {
      status: params.status,
      changedBy: params.user.uid,
      changedByName: params.user.displayName || "Pengguna",
      changedAt: now,
      notes: params.notes || "",
      reason: params.reason || ""
    };

    const updatedHistory = [...(scenario.statusHistory || []), newEntry];

    const updateData: any = {
      status: params.status,
      statusHistory: updatedHistory,
      updatedBy: params.user.uid,
      updatedByName: params.user.displayName || "Pengguna",
      updatedAt: now
    };

    if (params.status === "Disetujui") {
      updateData.approvedAt = now;
      updateData.approvedBy = params.user.uid;
      updateData.approvedByName = params.user.displayName || "Pengguna";
    } else if (params.status !== "Diterapkan") {
      // Clear approval timestamp if transitioned away from Disetujui
      updateData.approvedAt = null;
    }

    await updateDoc(doc(db, SCENARIOS_COL, params.scenarioId), updateData);

    // Write change log
    const logId = `${params.scenarioId}_log_st_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "CHANGE_STATUS",
      description: `Status diubah menjadi "${params.status}". Catatan: ${params.notes || "-"}${params.reason ? ` | Alasan: ${params.reason}` : ""}`,
      changedBy: params.user.uid,
      changedByName: params.user.displayName || "Pengguna",
      changedAt: now
    });
  },

  /**
   * Automatically resets approved status back to 'Draft' if data is modified after approval
   */
  async checkAndResetApprovalIfModified(
    scenarioId: string,
    user: { uid: string; displayName?: string },
    reason: string
  ): Promise<void> {
    try {
      const scenario = await this.getScenarioById(scenarioId);
      if (!scenario) return;
      if (scenario.status === "Disetujui") {
        const now = new Date().toISOString();
        const statusEntry = {
          status: "Draft" as ScenarioStatus,
          changedBy: user.uid,
          changedByName: user.displayName || "Pengguna",
          changedAt: now,
          notes: `Persetujuan dibatalkan otomatis: Terjadi ${reason}. Diperlukan pengajuan dan persetujuan ulang sebelum penerapan.`
        };
        await updateDoc(doc(db, SCENARIOS_COL, scenarioId), {
          status: "Draft",
          approvedAt: null,
          statusHistory: [...(scenario.statusHistory || []), statusEntry],
          updatedBy: user.uid,
          updatedByName: user.displayName || "Pengguna",
          updatedAt: now
        });
      }
    } catch (e) {
      console.warn("checkAndResetApprovalIfModified error:", e);
    }
  },

  /**
   * Delete a scenario and all its child documents in scenario_* collections
   */
  async deleteScenario(scenarioId: string): Promise<void> {
    // Delete curriculum items
    const curSnap = await getDocs(query(collection(db, SCENARIO_CURRICULUM_COL), where("scenarioId", "==", scenarioId)));
    const curBatch = writeBatch(db);
    curSnap.forEach((d) => curBatch.delete(d.ref));
    await curBatch.commit();

    // Delete subjects
    const subSnap = await getDocs(query(collection(db, SCENARIO_SUBJECTS_COL), where("scenarioId", "==", scenarioId)));
    const subBatch = writeBatch(db);
    subSnap.forEach((d) => subBatch.delete(d.ref));
    await subBatch.commit();

    // Delete schedules
    const schSnap = await getDocs(query(collection(db, SCENARIO_SCHEDULES_COL), where("scenarioId", "==", scenarioId)));
    const schBatch = writeBatch(db);
    schSnap.forEach((d) => schBatch.delete(d.ref));
    await schBatch.commit();

    // Delete logs
    const logSnap = await getDocs(query(collection(db, SCENARIO_LOGS_COL), where("scenarioId", "==", scenarioId)));
    const logBatch = writeBatch(db);
    logSnap.forEach((d) => logBatch.delete(d.ref));
    await logBatch.commit();

    // Delete scenario metadata
    await deleteDoc(doc(db, SCENARIOS_COL, scenarioId));
  },

  // ---------------------------------------------------------------------------
  // 2. SCENARIO CURRICULUM MATRIX (JP & SUBJECT STRUCTURE)
  // ---------------------------------------------------------------------------

  async getScenarioCurriculums(scenarioId: string): Promise<ScenarioCurriculumMatrix[]> {
    const q = query(collection(db, SCENARIO_CURRICULUM_COL), where("scenarioId", "==", scenarioId));
    const snap = await getDocs(q);
    const items: ScenarioCurriculumMatrix[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as ScenarioCurriculumMatrix));
    return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  },

  async updateScenarioCurriculumItem(
    item: ScenarioCurriculumMatrix,
    user: { uid: string; displayName?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const curRef = doc(db, SCENARIO_CURRICULUM_COL, item.id);
    const snap = await getDoc(curRef);
    const oldData = snap.exists() ? (snap.data() as ScenarioCurriculumMatrix) : null;

    const payload = cleanUndefinedFields({
      ...item,
      teacherId: item.teacherId !== undefined ? item.teacherId.trim() : (oldData?.teacherId || ""),
      teacherName: item.teacherName !== undefined ? item.teacherName.trim() : (oldData?.teacherName || ""),
      teacherId_vii: item.teacherId_vii !== undefined ? item.teacherId_vii.trim() : (oldData?.teacherId_vii || ""),
      teacherName_vii: item.teacherName_vii !== undefined ? item.teacherName_vii.trim() : (oldData?.teacherName_vii || ""),
      teacherId_viii: item.teacherId_viii !== undefined ? item.teacherId_viii.trim() : (oldData?.teacherId_viii || ""),
      teacherName_viii: item.teacherName_viii !== undefined ? item.teacherName_viii.trim() : (oldData?.teacherName_viii || ""),
      teacherId_ix: item.teacherId_ix !== undefined ? item.teacherId_ix.trim() : (oldData?.teacherId_ix || ""),
      teacherName_ix: item.teacherName_ix !== undefined ? item.teacherName_ix.trim() : (oldData?.teacherName_ix || ""),
      useDifferentTeachers: item.useDifferentTeachers !== undefined ? Boolean(item.useDifferentTeachers) : Boolean(oldData?.useDifferentTeachers),
      subjectName: item.subjectName ? item.subjectName.trim() : (oldData?.subjectName || ""),
      updatedAt: now
    });
    delete (payload as any).id;

    await updateDoc(curRef, payload);

    // Check if any teacher assignment changed (global or per-grade)
    const teacherChanged = Boolean(
      oldData && (
        oldData.teacherId !== payload.teacherId ||
        oldData.teacherName !== payload.teacherName ||
        oldData.teacherId_vii !== payload.teacherId_vii ||
        oldData.teacherName_vii !== payload.teacherName_vii ||
        oldData.teacherId_viii !== payload.teacherId_viii ||
        oldData.teacherName_viii !== payload.teacherName_viii ||
        oldData.teacherId_ix !== payload.teacherId_ix ||
        oldData.teacherName_ix !== payload.teacherName_ix ||
        oldData.useDifferentTeachers !== payload.useDifferentTeachers
      )
    );

    // If teacher changed, log to audit trail
    if (teacherChanged) {
      const callerUid = auth?.currentUser?.uid || user?.uid || "system";
      const callerName = auth?.currentUser?.displayName || user?.displayName || "Pengguna";
      const logId = `${item.scenarioId}_log_tch_${Date.now()}`;
      try {
        await setDoc(doc(db, SCENARIO_LOGS_COL, logId), cleanUndefinedFields({
          id: logId,
          scenarioId: item.scenarioId,
          action: "UPDATE_CURRICULUM_TEACHER",
          description: payload.useDifferentTeachers
            ? `Mengubah penugasan guru per jenjang untuk "${payload.subjectName || oldData?.subjectName}" (VII: ${payload.teacherName_vii || '-'}, VIII: ${payload.teacherName_viii || '-'}, IX: ${payload.teacherName_ix || '-'}) pada rancangan.`
            : `Mengubah guru pengampu untuk "${payload.subjectName || oldData?.subjectName}" menjadi "${payload.teacherName || 'Belum Ditugaskan'}" pada rancangan.`,
          changedBy: callerUid,
          changedByName: callerName,
          changedAt: now
        }));
      } catch (logErr) {
        console.warn("Could not write audit log for teacher update:", logErr);
      }

      // Synchronize scenario_schedules for this subject matching each slot's grade level
      try {
        const qSchedules = query(
          collection(db, SCENARIO_SCHEDULES_COL),
          where("scenarioId", "==", item.scenarioId)
        );
        const schSnaps = await getDocs(qSchedules);
        if (!schSnaps.empty) {
          const matchingSlots: { ref: any; teacherId: string; teacherName: string }[] = [];
          schSnaps.forEach((d) => {
            const schData = d.data() as ScenarioSchedule;
            const isMatch = (schData.subjectId && (schData.subjectId === item.subjectId || schData.subjectId === item.originalCurriculumId)) ||
              (Boolean(schData.subjectName && (payload.subjectName || oldData?.subjectName)) &&
                schData.subjectName.trim().toLowerCase() === (payload.subjectName || oldData?.subjectName || "").trim().toLowerCase());
            if (isMatch) {
              const slotGrade = safeNormalizeGrade(schData.gradeLevel) || safeNormalizeGrade(schData.className) || "VII";
              const resolved = getScenarioCurriculumTeacherForClass(payload, slotGrade);
              matchingSlots.push({
                ref: d.ref,
                teacherId: resolved.teacherId,
                teacherName: resolved.teacherName
              });
            }
          });

          for (let i = 0; i < matchingSlots.length; i += 400) {
            const schBatch = writeBatch(db);
            const chunk = matchingSlots.slice(i, i + 400);
            chunk.forEach(({ ref, teacherId, teacherName }) => {
              schBatch.update(ref, {
                teacherId,
                teacherName,
                updatedAt: now
              });
            });
            await schBatch.commit();
          }
        }
      } catch (schSyncErr) {
        console.warn("Could not sync scenario_schedules during teacher update:", schSyncErr);
      }
    }

    // If subjectName changed, synchronize scenario_schedules for this subject in the same scenario
    if (oldData && oldData.subjectName !== payload.subjectName && payload.subjectName) {
      try {
        const qSchedules = query(
          collection(db, SCENARIO_SCHEDULES_COL),
          where("scenarioId", "==", item.scenarioId)
        );
        const schSnaps = await getDocs(qSchedules);
        if (!schSnaps.empty) {
          const renameSlots: any[] = [];
          schSnaps.forEach((d) => {
            const schData = d.data() as ScenarioSchedule;
            const isMatch = (schData.subjectId && (schData.subjectId === item.subjectId || schData.subjectId === item.originalCurriculumId)) ||
              (Boolean(schData.subjectName && oldData?.subjectName) &&
                schData.subjectName.trim().toLowerCase() === oldData.subjectName.trim().toLowerCase());
            if (isMatch) {
              renameSlots.push(d.ref);
            }
          });

          for (let i = 0; i < renameSlots.length; i += 400) {
            const schBatch = writeBatch(db);
            const chunk = renameSlots.slice(i, i + 400);
            chunk.forEach((ref) => {
              schBatch.update(ref, {
                subjectName: payload.subjectName,
                updatedAt: now
              });
            });
            await schBatch.commit();
          }
        }
      } catch (e) {
        console.warn("Could not sync scenario_schedules during subject rename:", e);
      }
    }

    await this.checkAndResetApprovalIfModified(item.scenarioId, user, "perubahan alokasi JP atau guru kurikulum");
    // Recompute scenario summary
    await this.refreshScenarioSummary(item.scenarioId, user);
  },

  /**
   * Edit Subject Name inside Scenario Curriculum Matrix & Scenario Schedules.
   * Strictly preserves canonical subjectId and isolates from live master subjects.
   */
  async updateScenarioSubjectName(params: {
    scenarioId: string;
    curriculumId: string;
    subjectId: string;
    newName: string;
    newGroup?: "A" | "B" | "C";
    user: { uid: string; displayName?: string };
  }): Promise<{ oldName: string; newName: string }> {
    const trimmed = (params.newName || "").trim();
    if (!trimmed || trimmed.length < 2) {
      throw new Error("Nama mata pelajaran baru minimal 2 karakter dan tidak boleh kosong.");
    }

    const curRef = doc(db, SCENARIO_CURRICULUM_COL, params.curriculumId);
    const snap = await getDoc(curRef);
    if (!snap.exists()) {
      throw new Error("Data mata pelajaran pada rancangan tidak ditemukan.");
    }
    const curData = snap.data() as ScenarioCurriculumMatrix;
    const oldName = curData.subjectName || "Mata Pelajaran";
    const now = new Date().toISOString();

    const updatePayload: any = {
      subjectName: trimmed,
      updatedAt: now
    };
    if (params.newGroup) {
      updatePayload.subjectGroup = params.newGroup;
    }

    // 1. Update scenario_curriculum_matrix doc
    await updateDoc(curRef, updatePayload);

    // 2. Synchronize scenario_subjects if it was created inside this scenario
    try {
      const qSubjects = query(
        collection(db, SCENARIO_SUBJECTS_COL),
        where("scenarioId", "==", params.scenarioId)
      );
      const subSnaps = await getDocs(qSubjects);
      const subBatch = writeBatch(db);
      let subBatchCount = 0;
      subSnaps.forEach((d) => {
        const data = d.data() as ScenarioSubject;
        if (data.id.includes(params.subjectId) || data.code === curData.subjectId || data.name === oldName) {
          subBatch.update(d.ref, {
            name: trimmed,
            group: params.newGroup || data.group,
            updatedAt: now
          });
          subBatchCount++;
        }
      });
      if (subBatchCount > 0) {
        await subBatch.commit();
      }
    } catch (e) {
      console.warn("Could not sync scenario_subjects during rename:", e);
    }

    // 3. Synchronize scenario_schedules slots for this subject in the same scenario
    try {
      const qSchedules = query(
        collection(db, SCENARIO_SCHEDULES_COL),
        where("scenarioId", "==", params.scenarioId),
        where("subjectId", "==", params.subjectId)
      );
      const schSnaps = await getDocs(qSchedules);
      if (!schSnaps.empty) {
        const schBatch = writeBatch(db);
        schSnaps.forEach((d) => {
          schBatch.update(d.ref, {
            subjectName: trimmed,
            updatedAt: now
          });
        });
        await schBatch.commit();
      }
    } catch (e) {
      console.warn("Could not sync scenario_schedules during rename:", e);
    }

    // 4. Log change in audit trail
    const callerUid = auth?.currentUser?.uid || params.user?.uid || "system";
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";
    const logId = `${params.scenarioId}_log_rn_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "UPDATE_SUBJECT_NAME",
      description: `Mengubah nama mata pelajaran "${oldName}" menjadi "${trimmed}" (Kelompok ${params.newGroup || curData.subjectGroup}) pada rancangan bayangan.`,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now
    });

    await this.checkAndResetApprovalIfModified(params.scenarioId, params.user, `perubahan nama mapel "${oldName}" menjadi "${trimmed}"`);
    await this.refreshScenarioSummary(params.scenarioId, params.user);

    return { oldName, newName: trimmed };
  },

  /**
   * Edit Subject Teacher in Scenario Curriculum Matrix.
   * Strictly preserves canonical teacherId and isolates from live master teachers.
   */
  async updateScenarioCurriculumTeacher(params: {
    scenarioId: string;
    curriculumId: string;
    teacherId: string;
    teacherName: string;
    teacherId_vii?: string;
    teacherName_vii?: string;
    teacherId_viii?: string;
    teacherName_viii?: string;
    teacherId_ix?: string;
    teacherName_ix?: string;
    useDifferentTeachers?: boolean;
    user: { uid: string; displayName?: string };
  }): Promise<void> {
    const curRef = doc(db, SCENARIO_CURRICULUM_COL, params.curriculumId);
    const snap = await getDoc(curRef);
    if (!snap.exists()) {
      throw new Error("Data mata pelajaran pada rancangan tidak ditemukan.");
    }
    const curData = snap.data() as ScenarioCurriculumMatrix;
    const now = new Date().toISOString();

    const updatePayload: any = {
      teacherId: params.teacherId || "",
      teacherName: params.teacherName || "",
      updatedAt: now
    };
    if (params.useDifferentTeachers !== undefined) {
      updatePayload.useDifferentTeachers = params.useDifferentTeachers;
    }
    if (params.teacherId_vii !== undefined) updatePayload.teacherId_vii = params.teacherId_vii;
    if (params.teacherName_vii !== undefined) updatePayload.teacherName_vii = params.teacherName_vii;
    if (params.teacherId_viii !== undefined) updatePayload.teacherId_viii = params.teacherId_viii;
    if (params.teacherName_viii !== undefined) updatePayload.teacherName_viii = params.teacherName_viii;
    if (params.teacherId_ix !== undefined) updatePayload.teacherId_ix = params.teacherId_ix;
    if (params.teacherName_ix !== undefined) updatePayload.teacherName_ix = params.teacherName_ix;

    await updateDoc(curRef, updatePayload);

    // Synchronize scenario_schedules slots for this subject in the same scenario per grade
    try {
      const qSchedules = query(
        collection(db, SCENARIO_SCHEDULES_COL),
        where("scenarioId", "==", params.scenarioId),
        where("subjectId", "==", curData.subjectId)
      );
      const schSnaps = await getDocs(qSchedules);
      if (!schSnaps.empty) {
        const schBatch = writeBatch(db);
        const mergedCur = { ...curData, ...updatePayload };
        schSnaps.forEach((d) => {
          const schData = d.data() as ScenarioSchedule;
          const slotGrade = schData.gradeLevel || toValidGradeLevel(schData.className);
          const resolved = getScenarioCurriculumTeacherForClass(mergedCur, slotGrade);
          schBatch.update(d.ref, {
            teacherId: resolved.teacherId,
            teacherName: resolved.teacherName,
            updatedAt: now
          });
        });
        await schBatch.commit();
      }
    } catch (schSyncErr) {
      console.warn("Could not sync scenario_schedules during updateScenarioCurriculumTeacher:", schSyncErr);
    }

    // Audit log
    const callerUid = auth?.currentUser?.uid || params.user?.uid || "system";
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";
    const logId = `${params.scenarioId}_log_tch_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "UPDATE_CURRICULUM_TEACHER",
      description: params.useDifferentTeachers
        ? `Mengubah penugasan guru per jenjang untuk "${curData.subjectName}" (VII: ${params.teacherName_vii || '-'}, VIII: ${params.teacherName_viii || '-'}, IX: ${params.teacherName_ix || '-'}) pada rancangan.`
        : `Mengubah guru pengampu untuk "${curData.subjectName}" menjadi "${params.teacherName || 'Belum Ditugaskan'}" pada rancangan.`,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now
    });

    await this.checkAndResetApprovalIfModified(params.scenarioId, params.user, `perubahan guru pengampu "${curData.subjectName}"`);
    await this.refreshScenarioSummary(params.scenarioId, params.user);
  },

  /**
   * Preview differences between operational source assignments and current shadow curriculum/schedules,
   * without writing or modifying any data.
   */
  async previewRealignScenarioTeachers(scenarioId: string): Promise<{
    scenarioName: string;
    differences: {
      curriculumId: string;
      subjectId: string;
      subjectName: string;
      currentVii: string;
      sourceVii: string;
      currentViii: string;
      sourceViii: string;
      currentIx: string;
      sourceIx: string;
      hasDifference: boolean;
    }[];
    schedulesAffectedCount: number;
  }> {
    const scenario = await this.getScenarioById(scenarioId);
    if (!scenario) throw new Error("Rancangan tidak ditemukan.");

    const [scenarioCurriculums, scenarioSchedules, opCurriculums, opSchedules, opClasses, opAssignments] =
      await Promise.all([
        this.getScenarioCurriculums(scenarioId),
        this.getScenarioSchedules(scenarioId),
        curriculumMatrixService.getCurriculumMatrix().catch(() => [] as CurriculumMatrix[]),
        scheduleService.getSchedules(scenario.academicYearId, scenario.semesterId).catch(() => [] as Schedule[]),
        classService.getClasses().catch(() => [] as Class[]),
        teacherAssignmentService.getTeacherAssignmentsByPeriod(scenario.academicYearId, scenario.semesterId).catch(() => [] as TeacherAssignment[])
      ]);

    const differences: any[] = [];
    let schedulesAffectedCount = 0;

    for (const sc of scenarioCurriculums) {
      if (sc.isCustomSubject) continue;
      const cm = opCurriculums.find((c) => c.subjectId === sc.subjectId || c.id === sc.originalCurriculumId);
      if (!cm) continue;

      const resolveTeacherForGrade = (targetGrade: "VII" | "VIII" | "IX") => {
        const gradeClasses = opClasses.filter(
          (c) => toValidGradeLevel(c.gradeLevel || c.name) === targetGrade
        );

        if (opAssignments.length > 0 && gradeClasses.length > 0) {
          for (const cls of gradeClasses) {
            const classId = cls.id || cls.classId;
            const matchedAssignment = opAssignments.find(
              (a) =>
                a.subjectId === cm.subjectId &&
                isClassMatch(a.classId, classId, opClasses) &&
                a.isActive !== false &&
                a.teacherId &&
                a.teacherId.trim() !== "" &&
                a.teacherName !== "Belum Ditentukan"
            );
            if (matchedAssignment) {
              return {
                id: matchedAssignment.teacherId.trim(),
                name: matchedAssignment.teacherName ? matchedAssignment.teacherName.trim() : "Guru Pengampu"
              };
            }
          }
        }

        if (opSchedules.length > 0 && gradeClasses.length > 0) {
          for (const cls of gradeClasses) {
            const classId = cls.id || cls.classId;
            const matchedSchedule = opSchedules.find(
              (s) =>
                s.subjectId === cm.subjectId &&
                isClassMatch(s.classId, classId, opClasses) &&
                s.teacherId &&
                s.teacherId.trim() !== "" &&
                s.teacherName !== "Belum Ditentukan"
            );
            if (matchedSchedule) {
              return {
                id: matchedSchedule.teacherId.trim(),
                name: matchedSchedule.teacherName ? matchedSchedule.teacherName.trim() : "Guru Pengampu"
              };
            }
          }
        }

        if (targetGrade === "VII" && cm.teacherId_vii?.trim()) return { id: cm.teacherId_vii.trim(), name: cm.teacherName_vii?.trim() || "Guru Pengampu" };
        if (targetGrade === "VIII" && cm.teacherId_viii?.trim()) return { id: cm.teacherId_viii.trim(), name: cm.teacherName_viii?.trim() || "Guru Pengampu" };
        if (targetGrade === "IX" && cm.teacherId_ix?.trim()) return { id: cm.teacherId_ix.trim(), name: cm.teacherName_ix?.trim() || "Guru Pengampu" };

        if (cm.teacherId?.trim()) return { id: cm.teacherId.trim(), name: cm.teacherName?.trim() || "Guru Pengampu" };
        return { id: "", name: "" };
      };

      const srcVii = resolveTeacherForGrade("VII");
      const srcViii = resolveTeacherForGrade("VIII");
      const srcIx = resolveTeacherForGrade("IX");

      const currViiName = sc.teacherName_vii || sc.teacherName || "-";
      const currViiiName = sc.teacherName_viii || sc.teacherName || "-";
      const currIxName = sc.teacherName_ix || sc.teacherName || "-";

      const diffVii = (sc.jp_vii || 0) > 0 && srcVii.id && srcVii.id !== (sc.teacherId_vii || sc.teacherId);
      const diffViii = (sc.jp_viii || 0) > 0 && srcViii.id && srcViii.id !== (sc.teacherId_viii || sc.teacherId);
      const diffIx = (sc.jp_ix || 0) > 0 && srcIx.id && srcIx.id !== (sc.teacherId_ix || sc.teacherId);

      const hasDiff = diffVii || diffViii || diffIx;
      if (hasDiff) {
        differences.push({
          curriculumId: sc.id,
          subjectId: sc.subjectId,
          subjectName: sc.subjectName,
          currentVii: currViiName,
          sourceVii: srcVii.name || "-",
          currentViii: currViiiName,
          sourceViii: srcViii.name || "-",
          currentIx: currIxName,
          sourceIx: srcIx.name || "-",
          hasDifference: true
        });

        // Count affected schedules
        const affected = scenarioSchedules.filter((s) => s.subjectId === sc.subjectId);
        schedulesAffectedCount += affected.length;
      }
    }

    return {
      scenarioName: scenario.name,
      differences,
      schedulesAffectedCount
    };
  },

  /**
   * Non-destructive targeted realignment of shadow curriculum teachers and shadow schedules
   * from operational source assignments. Only updates teacher fields of shadow items.
   */
  async realignScenarioTeachersFromOperational(params: {
    scenarioId: string;
    user: { uid: string; displayName?: string };
  }): Promise<{ updatedSubjectsCount: number; updatedSchedulesCount: number }> {
    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan tidak ditemukan.");

    const now = new Date().toISOString();
    const [scenarioCurriculums, scenarioSchedules, opCurriculums, opSchedules, opClasses, opAssignmentsPeriod, allAssignments] =
      await Promise.all([
        this.getScenarioCurriculums(params.scenarioId),
        this.getScenarioSchedules(params.scenarioId),
        curriculumMatrixService.getCurriculumMatrix().catch(() => [] as CurriculumMatrix[]),
        scheduleService.getSchedules(scenario.academicYearId, scenario.semesterId).catch(() => [] as Schedule[]),
        classService.getClasses().catch(() => [] as Class[]),
        teacherAssignmentService.getTeacherAssignmentsByPeriod(scenario.academicYearId, scenario.semesterId).catch(() => [] as TeacherAssignment[]),
        teacherAssignmentService.getTeacherAssignments().catch(() => [] as TeacherAssignment[])
      ]);

    const assignmentMap = new Map<string, TeacherAssignment>();
    allAssignments.forEach((a) => {
      if (a.id) assignmentMap.set(a.id, a);
    });
    opAssignmentsPeriod.forEach((a) => {
      if (a.id) assignmentMap.set(a.id, a);
    });
    const combinedAssignments = Array.from(assignmentMap.values());
    const opAssignments = combinedAssignments.length > 0 ? combinedAssignments : (opAssignmentsPeriod.length > 0 ? opAssignmentsPeriod : allAssignments);

    const curBatch = writeBatch(db);
    let updatedSubjectsCount = 0;
    const updatedCurriculumMap = new Map<string, ScenarioCurriculumMatrix>();

    for (const sc of scenarioCurriculums) {
      if (sc.isCustomSubject) continue;
      const cm = opCurriculums.find((c) =>
        c.subjectId === sc.subjectId ||
        c.id === sc.originalCurriculumId ||
        (Boolean(c.subjectName && sc.subjectName) && c.subjectName.trim().toLowerCase() === sc.subjectName.trim().toLowerCase())
      );
      if (!cm) continue;

      const resolveTeacherForGrade = (targetGrade: "VII" | "VIII" | "IX") => {
        const targetClasses = opClasses.filter(
          (c) => getClassGradeLevel(c) === targetGrade
        );

        // Priority 1: Check active assignments in teacher_assignments using canonical resolution per class
        for (const cls of targetClasses) {
          const targetClassId = cls.id || cls.classId;
          const res = teacherAssignmentService.resolveTeacherAssignmentSync({
            academicYearId: scenario.academicYearId,
            semesterId: scenario.semesterId,
            subjectId: cm.subjectId,
            classId: targetClassId,
            gradeLevel: targetGrade,
            curriculumMatrixItem: cm,
            preloadedAssignments: opAssignments
          });
          if (res.source === "assignment" && res.teacherId && res.teacherId.trim() !== "" && res.teacherName !== "Belum Ditentukan") {
            return {
              id: res.teacherId.trim(),
              name: res.teacherName ? res.teacherName.trim() : "Guru Pengampu"
            };
          }
        }

        // Priority 1B: Check active assignments matching subject and target class ID or gradeLevel directly
        if (opAssignments.length > 0) {
          for (const a of opAssignments) {
            if (a.isActive === false || !a.teacherId || a.teacherId.trim() === "" || a.teacherName === "Belum Ditentukan") {
              continue;
            }
            const isSubMatch = (a.subjectId && (a.subjectId === cm.subjectId || a.subjectId === cm.id)) ||
              (Boolean(a.subjectName && cm.subjectName) && a.subjectName.trim().toLowerCase() === cm.subjectName.trim().toLowerCase());
            if (!isSubMatch) continue;

            const aNormGrade = safeNormalizeGrade(a.gradeLevel) || safeNormalizeGrade(a.className);
            const isClassIdMatch = a.classId && targetClasses.some((c) => isClassMatch(a.classId, c.id || c.classId, opClasses));
            const isGrdMatch = isClassIdMatch || (aNormGrade !== null && aNormGrade === targetGrade);
            if (isGrdMatch) {
              return {
                id: a.teacherId.trim(),
                name: a.teacherName ? a.teacherName.trim() : "Guru Pengampu"
              };
            }
          }
        }

        // Priority 2: Check operational live schedules strictly for this grade
        if (opSchedules.length > 0) {
          for (const s of opSchedules) {
            if (!s.teacherId || s.teacherId.trim() === "" || s.teacherName === "Belum Ditentukan") {
              continue;
            }
            const isSubMatch = (s.subjectId && (s.subjectId === cm.subjectId || s.subjectId === cm.id)) ||
              (Boolean(s.subjectName && cm.subjectName) && s.subjectName.trim().toLowerCase() === cm.subjectName.trim().toLowerCase());
            if (!isSubMatch) continue;

            const matchedCls = opClasses.find((c) => isClassMatch(c.id || c.classId, s.classId, opClasses));
            const sGrade = safeNormalizeGrade((s as any).gradeLevel) || getClassGradeLevel(matchedCls) || safeNormalizeGrade(s.className);
            if (sGrade === targetGrade) {
              return {
                id: s.teacherId.trim(),
                name: s.teacherName ? s.teacherName.trim() : "Guru Pengampu"
              };
            }
          }
        }

        // Priority 3: Grade-specific fields from curriculum_matrix
        if (targetGrade === "VII" && cm.teacherId_vii?.trim()) return { id: cm.teacherId_vii.trim(), name: cm.teacherName_vii?.trim() || "Guru Pengampu" };
        if (targetGrade === "VIII" && cm.teacherId_viii?.trim()) return { id: cm.teacherId_viii.trim(), name: cm.teacherName_viii?.trim() || "Guru Pengampu" };
        if (targetGrade === "IX" && cm.teacherId_ix?.trim()) return { id: cm.teacherId_ix.trim(), name: cm.teacherName_ix?.trim() || "Guru Pengampu" };

        // Priority 4: Fallback to global curriculum matrix teacher ONLY IF not using different teachers
        if (!cm.useDifferentTeachers && cm.teacherId?.trim()) {
          return { id: cm.teacherId.trim(), name: cm.teacherName?.trim() || "Guru Pengampu" };
        }
        return { id: "", name: "" };
      };

      const tchVii = resolveTeacherForGrade("VII");
      const tchViii = resolveTeacherForGrade("VIII");
      const tchIx = resolveTeacherForGrade("IX");

      const hasDistinctTeachers = Boolean(
        (tchVii.id && tchViii.id && tchVii.id !== tchViii.id) ||
        (tchVii.id && tchIx.id && tchVii.id !== tchIx.id) ||
        (tchViii.id && tchIx.id && tchViii.id !== tchIx.id) ||
        (cm.teacherId_vii && cm.teacherId_viii && cm.teacherId_vii !== cm.teacherId_viii) ||
        (cm.teacherId_vii && cm.teacherId_ix && cm.teacherId_vii !== cm.teacherId_ix) ||
        (cm.teacherId_viii && cm.teacherId_ix && cm.teacherId_viii !== cm.teacherId_ix)
      );
      const useDifferentTeachers = Boolean(cm.useDifferentTeachers) || hasDistinctTeachers;

      const primaryTeacherId = cm.teacherId || tchVii.id || tchViii.id || tchIx.id || "";
      const primaryTeacherName = cm.teacherName || tchVii.name || tchViii.name || tchIx.name || "";

      // NEVER collapse distinct teachers! Maintain each grade's resolved teacher safely
      const teacherId_vii = tchVii.id || cm.teacherId_vii || (useDifferentTeachers ? "" : primaryTeacherId);
      const teacherName_vii = tchVii.name || cm.teacherName_vii || (useDifferentTeachers ? "" : primaryTeacherName);

      const teacherId_viii = tchViii.id || cm.teacherId_viii || (useDifferentTeachers ? "" : primaryTeacherId);
      const teacherName_viii = tchViii.name || cm.teacherName_viii || (useDifferentTeachers ? "" : primaryTeacherName);

      const teacherId_ix = tchIx.id || cm.teacherId_ix || (useDifferentTeachers ? "" : primaryTeacherId);
      const teacherName_ix = tchIx.name || cm.teacherName_ix || (useDifferentTeachers ? "" : primaryTeacherName);

      const updatedSc: ScenarioCurriculumMatrix = {
        ...sc,
        teacherId: primaryTeacherId,
        teacherName: primaryTeacherName,
        teacherId_vii,
        teacherName_vii,
        teacherId_viii,
        teacherName_viii,
        teacherId_ix,
        teacherName_ix,
        useDifferentTeachers,
        updatedAt: now
      };

      updatedCurriculumMap.set(sc.subjectId, updatedSc);
      curBatch.update(doc(db, SCENARIO_CURRICULUM_COL, sc.id), cleanUndefinedFields({
        teacherId: primaryTeacherId,
        teacherName: primaryTeacherName,
        teacherId_vii,
        teacherName_vii,
        teacherId_viii,
        teacherName_viii,
        teacherId_ix,
        teacherName_ix,
        useDifferentTeachers,
        updatedAt: now
      }));
      updatedSubjectsCount++;
    }

    if (updatedSubjectsCount > 0) {
      await curBatch.commit();
    }

    // Now update scenario schedules strictly to match the realigned curriculum
    let updatedSchedulesCount = 0;
    const schBatch = writeBatch(db);

    for (const sch of scenarioSchedules) {
      if (!sch.subjectId && (!sch.subjectName || sch.subjectName === "Kosong")) continue;
      const cur = updatedCurriculumMap.get(sch.subjectId) ||
        Array.from(updatedCurriculumMap.values()).find((c) =>
          (sch.subjectName && c.subjectName && c.subjectName.trim().toLowerCase() === sch.subjectName.trim().toLowerCase()) ||
          c.originalCurriculumId === sch.subjectId
        );
      if (!cur) continue;

      const matchedCls = opClasses.find((c) => isClassMatch(c.id || c.classId, sch.classId, opClasses));
      const grade = safeNormalizeGrade(sch.gradeLevel) ||
                    getClassGradeLevel(matchedCls) ||
                    safeNormalizeGrade(sch.className) ||
                    "VII";
      const res = getScenarioCurriculumTeacherForClass(cur, grade);

      if (res.teacherId && (res.teacherId !== sch.teacherId || res.teacherName !== sch.teacherName)) {
        schBatch.update(doc(db, SCENARIO_SCHEDULES_COL, sch.id), {
          teacherId: res.teacherId,
          teacherName: res.teacherName,
          updatedAt: now
        });
        updatedSchedulesCount++;
      }
    }

    if (updatedSchedulesCount > 0) {
      await schBatch.commit();
    }

    const callerUid = auth?.currentUser?.uid || params.user?.uid || "system";
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";
    const logId = `${params.scenarioId}_log_realign_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), cleanUndefinedFields({
      id: logId,
      scenarioId: params.scenarioId,
      action: "UPDATE_CURRICULUM_TEACHER",
      description: `Menyelaraskan ulang penugasan guru per jenjang (${updatedSubjectsCount} mapel, ${updatedSchedulesCount} slot jadwal) dari snapshot operasional.`,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now
    }));

    await this.refreshScenarioSummary(params.scenarioId, params.user);
    return { updatedSubjectsCount, updatedSchedulesCount };
  },

  /**
   * Strictly synchronizes ALL scenario schedule slots to match their corresponding
   * scenario curriculum matrix teacher assignments for each class's grade level.
   * Ensures that if Aqidah Grade VII has Guru A, and Grade VIII has Guru B:
  /**
   * Preview synchronization of Shadow Curriculum Matrix to Shadow Schedules.
   * Compares latest target JP per grade/class and teacher assignments with current scheduled slots.
   */
  async previewScenarioCurriculumSync(params: {
    scenarioId: string;
  }): Promise<ScenarioSyncPreviewResult> {
    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan jadwal bayangan tidak ditemukan.");

    const [curriculums, schedules, rawClasses, periods] = await Promise.all([
      this.getScenarioCurriculums(params.scenarioId),
      this.getScenarioSchedules(params.scenarioId),
      classService.getClasses().catch(() => [] as Class[]),
      lessonPeriodService.getLessonPeriods().catch(() => [] as LessonPeriod[])
    ]);

    const classes = rawClasses.filter((c) => {
      const g = toValidGradeLevel(c.gradeLevel || c.name);
      return g === "VII" || g === "VIII" || g === "IX";
    });

    const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);

    // Filter instructional lesson periods (non-routine, non-break)
    const instructionalPeriods = periods.filter(
      (p) =>
        p.type === LessonPeriodType.LESSON ||
        (!p.title.toLowerCase().includes("istirahat") && !p.title.toLowerCase().includes("upacara"))
    );

    const items: ScenarioSyncItemPreview[] = [];
    const warnings: string[] = [];
    let reducedCount = 0;
    let increasedCount = 0;
    let teacherUpdateCount = 0;
    let unchangedCount = 0;

    const dayOrder: Record<string, number> = {
      sabtu: 1,
      minggu: 2,
      senin: 3,
      selasa: 4,
      rabu: 5,
      kamis: 6
    };

    classes.forEach((cls) => {
      const classId = cls.id || cls.classId;
      const grade = toValidGradeLevel(cls.gradeLevel || cls.name);
      const clsSchedules = schedules.filter((s) => isClassMatch(s.classId, classId, rawClasses));

      activeCurriculums.forEach((cur) => {
        const targetJp = Number(
          grade === "VII" ? (cur.jp_vii ?? 0) : grade === "VIII" ? (cur.jp_viii ?? 0) : (cur.jp_ix ?? 0)
        ) || 0;

        const res = getScenarioCurriculumTeacherForClass(cur, grade);
        const targetTeacherId = res.teacherId || "";
        const targetTeacherName =
          res.teacherName && res.teacherName !== "Belum Ditugaskan" ? res.teacherName : "Belum Ditugaskan";

        const matchingSlots = deduplicateSchedules(clsSchedules).filter((s) =>
          isSlotMatchingCurriculum(s, cur)
        );

        const currentJp = matchingSlots.reduce(
          (sum, s) => sum + getScheduleSlotJpCount(s, instructionalPeriods),
          0
        );
        const diff = targetJp - currentJp;

        if (diff < 0) {
          // JP Reduced (e.g. 3 -> 2, diff = -1)
          const excess = Math.abs(diff);
          reducedCount += excess;

          // Prioritize freeing unlocked slots first, then later days/sequences in the week
          const sortedSlots = [...matchingSlots].sort((a, b) => {
            if (Boolean(a.isLocked) !== Boolean(b.isLocked)) {
              return a.isLocked ? 1 : -1;
            }
            const dayA = dayOrder[a.day.toLowerCase()] || 0;
            const dayB = dayOrder[b.day.toLowerCase()] || 0;
            if (dayA !== dayB) return dayB - dayA;
            return b.sequence - a.sequence;
          });

          const slotsToFree = sortedSlots.slice(0, excess);
          const affectedSlots = slotsToFree.map((s) => {
            if (s.isLocked) {
              warnings.push(
                `Slot ${cur.subjectName} di ${cls.name} (${s.day} ${s.jp || `JP ${s.sequence}`}) dalam keadaan TERKUNCI. Buka kunci terlebih dahulu jika ingin mengosongkannya.`
              );
            }
            return {
              id: s.id,
              day: s.day,
              sequence: s.sequence,
              jp: s.jp || `JP ${s.sequence}`,
              isLocked: Boolean(s.isLocked),
              actionDescription: `Slot kelebihan akan dikosongkan secara aman (${s.day} ${s.jp || `JP ${s.sequence}`})`
            };
          });

          items.push({
            subjectId: cur.subjectId || cur.id,
            subjectName: cur.subjectName,
            classId,
            className: cls.name,
            gradeLevel: grade,
            currentJp,
            targetJp,
            diff,
            action: "REDUCE",
            teacherId: targetTeacherId,
            teacherName: targetTeacherName,
            affectedSlots
          });
        } else if (diff > 0) {
          // JP Increased (e.g. 2 -> 3, diff = 1)
          increasedCount += diff;
          const affectedSlots: ScenarioSyncAffectedSlot[] = [];

          // Find candidate empty slots in this class
          let foundCount = 0;
          for (const p of instructionalPeriods) {
            if (foundCount >= diff) break;

            const isSlotTaken = clsSchedules.some(
              (s) =>
                s.day.toLowerCase() === p.day.toLowerCase() &&
                s.sequence === p.sequence &&
                s.subjectName !== "Kosong" &&
                s.subjectName !== "Belum Ditugaskan"
            );

            if (isSlotTaken) continue;

            // Check if teacher is busy elsewhere
            const isTeacherBusy =
              Boolean(targetTeacherId) &&
              schedules.some(
                (s) =>
                  s.teacherId === targetTeacherId &&
                  s.day.toLowerCase() === p.day.toLowerCase() &&
                  s.sequence === p.sequence &&
                  !isClassMatch(s.classId, classId, rawClasses)
              );

            if (isTeacherBusy) continue;

            foundCount++;
            affectedSlots.push({
              id: `${params.scenarioId}_sc_${classId}_${p.day}_${p.sequence}`,
              day: p.day,
              sequence: p.sequence,
              jp: p.title || `JP ${p.sequence}`,
              isLocked: false,
              actionDescription: `Akan dialokasikan ke slot kosong (${p.day} ${p.title || `JP ${p.sequence}`})`
            });
          }

          if (foundCount < diff) {
            warnings.push(
              `Mapel ${cur.subjectName} di kelas ${cls.name} membutuhkan +${diff - foundCount} JP baru, tetapi slot kosong bebas bentrok otomatis tidak mencukupi.`
            );
          }

          items.push({
            subjectId: cur.subjectId || cur.id,
            subjectName: cur.subjectName,
            classId,
            className: cls.name,
            gradeLevel: grade,
            currentJp,
            targetJp,
            diff,
            action: "INCREASE",
            teacherId: targetTeacherId,
            teacherName: targetTeacherName,
            affectedSlots
          });
        } else {
          // JP Unchanged
          unchangedCount++;
          // Check teacher difference
          const teacherMismatches = matchingSlots.filter(
            (s) => targetTeacherId && (s.teacherId !== targetTeacherId || s.teacherName !== targetTeacherName)
          );
          if (teacherMismatches.length > 0) {
            teacherUpdateCount += teacherMismatches.length;
            items.push({
              subjectId: cur.subjectId || cur.id,
              subjectName: cur.subjectName,
              classId,
              className: cls.name,
              gradeLevel: grade,
              currentJp,
              targetJp,
              diff: 0,
              action: "UNCHANGED",
              teacherId: targetTeacherId,
              teacherName: targetTeacherName,
              affectedSlots: teacherMismatches.map((s) => ({
                id: s.id,
                day: s.day,
                sequence: s.sequence,
                jp: s.jp || `JP ${s.sequence}`,
                isLocked: Boolean(s.isLocked),
                actionDescription: `Penugasan guru akan diperbarui ke ${targetTeacherName} (${s.day} ${s.jp || `JP ${s.sequence}`})`
              }))
            });
          }
        }
      });
    });

    const totalChanges = reducedCount + increasedCount + teacherUpdateCount;

    return {
      scenarioId: params.scenarioId,
      totalChanges,
      reducedCount,
      increasedCount,
      teacherUpdateCount,
      unchangedCount,
      items,
      warnings
    };
  },

  /**
   * Strictly synchronizes scenario schedules to match the latest Shadow Curriculum Matrix.
   * Adjusts slot counts (freeing excess slots, allocating to empty slots if increased)
   * and synchronizes assigned teachers per grade level without disturbing unrelated slots.
   */
  async syncScenarioCurriculumToSchedules(params: {
    scenarioId: string;
    user: { uid: string; displayName?: string };
    preview?: ScenarioSyncPreviewResult;
  }): Promise<{
    freedSlotsCount: number;
    addedSlotsCount: number;
    syncedTeachersCount: number;
    totalAdjustments: number;
    syncedSlotsCount: number;
  }> {
    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan tidak ditemukan.");

    const now = new Date().toISOString();
    const preview = params.preview || (await this.previewScenarioCurriculumSync({ scenarioId: params.scenarioId }));

    const [curriculums, schedules, rawClasses] = await Promise.all([
      this.getScenarioCurriculums(params.scenarioId),
      this.getScenarioSchedules(params.scenarioId),
      classService.getClasses().catch(() => [] as Class[])
    ]);

    let freedSlotsCount = 0;
    let addedSlotsCount = 0;
    let syncedTeachersCount = 0;

    const slotsToDelete: string[] = [];
    const slotsToAdd: ScenarioSchedule[] = [];
    const slotsToUpdateTeacher: { id: string; teacherId: string; teacherName: string }[] = [];

    // Map of deleted slot IDs so we don't update them later
    const deletedSlotIdSet = new Set<string>();

    preview.items.forEach((item) => {
      if (item.action === "REDUCE") {
        item.affectedSlots.forEach((slot) => {
          slotsToDelete.push(slot.id);
          deletedSlotIdSet.add(slot.id);
          // Also canonical ID
          const canonicalId = `${params.scenarioId}_sc_${item.classId}_${slot.day}_${slot.sequence}`;
          if (canonicalId !== slot.id) {
            slotsToDelete.push(canonicalId);
            deletedSlotIdSet.add(canonicalId);
          }
          freedSlotsCount++;
        });
      } else if (item.action === "INCREASE") {
        item.affectedSlots.forEach((slot) => {
          slotsToAdd.push({
            id: slot.id,
            scenarioId: params.scenarioId,
            academicYearId: scenario.academicYearId || "",
            semesterId: scenario.semesterId || "",
            classId: item.classId,
            className: item.className,
            gradeLevel: item.gradeLevel,
            day: slot.day,
            sequence: slot.sequence,
            jp: slot.jp,
            lessonPeriodId: "",
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            teacherId: item.teacherId,
            teacherName: item.teacherName,
            isLocked: false,
            createdAt: now,
            updatedAt: now
          });
          addedSlotsCount++;
        });
      }
    });

    // Handle teacher alignment across remaining active curriculum slots
    const curMap = new Map<string, ScenarioCurriculumMatrix>();
    const curNameMap = new Map<string, ScenarioCurriculumMatrix>();
    curriculums.forEach((c) => {
      if (c.id) curMap.set(c.id, c);
      if (c.subjectId) curMap.set(c.subjectId, c);
      if (c.originalCurriculumId) curMap.set(c.originalCurriculumId, c);
      if (c.subjectName) curNameMap.set(c.subjectName.trim().toLowerCase(), c);
    });

    for (const sch of schedules) {
      if (deletedSlotIdSet.has(sch.id)) continue;
      if (!sch.subjectId && (!sch.subjectName || sch.subjectName === "Kosong" || sch.subjectName === "Belum Ditugaskan")) continue;

      let cur = sch.subjectId ? curMap.get(sch.subjectId) : undefined;
      if (!cur && sch.subjectName) {
        const sName = sch.subjectName.trim().toLowerCase();
        cur = curNameMap.get(sName);
        if (!cur) {
          cur = curriculums.find((c) => {
            if (!c.subjectName) return false;
            const cName = c.subjectName.trim().toLowerCase();
            return sName.startsWith(cName) || cName.startsWith(sName);
          });
        }
      }

      if (!cur) continue;

      const matchedCls = rawClasses.find((c) => isClassMatch(c.id || c.classId, sch.classId, rawClasses));
      const grade =
        safeNormalizeGrade(sch.gradeLevel) ||
        getClassGradeLevel(matchedCls) ||
        safeNormalizeGrade(sch.className) ||
        "VII";
      const res = getScenarioCurriculumTeacherForClass(cur, grade);

      if (res.teacherId && (res.teacherId !== sch.teacherId || res.teacherName !== sch.teacherName)) {
        slotsToUpdateTeacher.push({
          id: sch.id,
          teacherId: res.teacherId,
          teacherName: res.teacherName
        });
        syncedTeachersCount++;
      }
    }

    // Execute deletions in batches
    const BATCH_SIZE = 400;
    for (let i = 0; i < slotsToDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = slotsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach((id) => batch.delete(doc(db, SCENARIO_SCHEDULES_COL, id)));
      await batch.commit();
    }

    // Execute additions in batches
    for (let i = 0; i < slotsToAdd.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = slotsToAdd.slice(i, i + BATCH_SIZE);
      chunk.forEach((s) => batch.set(doc(db, SCENARIO_SCHEDULES_COL, s.id), s));
      await batch.commit();
    }

    // Execute teacher updates in batches
    for (let i = 0; i < slotsToUpdateTeacher.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = slotsToUpdateTeacher.slice(i, i + BATCH_SIZE);
      chunk.forEach((s) => {
        batch.update(doc(db, SCENARIO_SCHEDULES_COL, s.id), {
          teacherId: s.teacherId,
          teacherName: s.teacherName,
          updatedAt: now
        });
      });
      await batch.commit();
    }

    const totalAdjustments = freedSlotsCount + addedSlotsCount + syncedTeachersCount;

    if (totalAdjustments > 0) {
      const callerUid = auth?.currentUser?.uid || params.user?.uid || "system";
      const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";
      const logId = `${params.scenarioId}_log_sync_${Date.now()}`;
      try {
        await setDoc(
          doc(db, SCENARIO_LOGS_COL, logId),
          cleanUndefinedFields({
            id: logId,
            scenarioId: params.scenarioId,
            action: "UPDATE_SCHEDULE",
            description: `Sinkronisasi struktur kurikulum bayangan ke jadwal bayangan: ${freedSlotsCount} slot dikosongkan, ${addedSlotsCount} slot ditambahkan, ${syncedTeachersCount} penugasan guru diselaraskan.`,
            changedBy: callerUid,
            changedByName: callerName,
            changedAt: now
          })
        );
      } catch (e) {
        console.warn("Could not write audit log for sync:", e);
      }

      await this.checkAndResetApprovalIfModified(
        params.scenarioId,
        params.user,
        "sinkronisasi struktur kurikulum bayangan ke jadwal"
      );
      await this.refreshScenarioSummary(params.scenarioId, params.user);
    }

    return {
      freedSlotsCount,
      addedSlotsCount,
      syncedTeachersCount,
      totalAdjustments,
      syncedSlotsCount: totalAdjustments
    };
  },

  async addCustomSubjectToScenario(params: {
    scenarioId: string;
    name: string;
    code: string;
    group: "A" | "B" | "C";
    jp_vii: number;
    jp_viii: number;
    jp_ix: number;
    teacherId?: string;
    teacherName?: string;
    user: { uid: string; displayName?: string };
  }): Promise<void> {
    const now = new Date().toISOString();
    const customSubId = `custom_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const subDocId = `${params.scenarioId}_sb_${customSubId}`;
    const curDocId = `${params.scenarioId}_cm_${customSubId}`;

    // 1. Add to scenario_subjects
    const newSubject: ScenarioSubject = {
      id: subDocId,
      scenarioId: params.scenarioId,
      code: params.code.trim().toUpperCase() || "SIM-MAPEL",
      name: params.name.trim(),
      group: params.group,
      kkm: 75,
      grades: ["7", "8", "9"],
      subjectType: "UMUM",
      isCustomSubject: true,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(doc(db, SCENARIO_SUBJECTS_COL, subDocId), newSubject);

    // 2. Add to scenario_curriculum_matrix
    const newCurriculum: ScenarioCurriculumMatrix = {
      id: curDocId,
      scenarioId: params.scenarioId,
      subjectId: customSubId,
      subjectName: params.name.trim(),
      subjectGroup: params.group,
      teacherId: params.teacherId?.trim() || "",
      teacherName: params.teacherName?.trim() || "",
      isCustomSubject: true,
      isActiveInScenario: true,
      jp_vii: params.jp_vii,
      jp_viii: params.jp_viii,
      jp_ix: params.jp_ix,
      baseline_jp_vii: 0,
      baseline_jp_viii: 0,
      baseline_jp_ix: 0,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(doc(db, SCENARIO_CURRICULUM_COL, curDocId), newCurriculum);

    // 3. Log change
    const logId = `${params.scenarioId}_log_add_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "UPDATE_CURRICULUM",
      description: `Mata pelajaran baru "${params.name}" (Kelompok ${params.group}) ditambahkan ke rancangan.`,
      changedBy: params.user.uid,
      changedByName: params.user.displayName || "Pengguna",
      changedAt: now
    });

    await this.refreshScenarioSummary(params.scenarioId, params.user);
  },

  async toggleSubjectActiveInScenario(
    curriculumId: string,
    isActive: boolean,
    user: { uid: string; displayName?: string }
  ): Promise<void> {
    const curRef = doc(db, SCENARIO_CURRICULUM_COL, curriculumId);
    const snap = await getDoc(curRef);
    if (!snap.exists()) return;
    const curData = snap.data() as ScenarioCurriculumMatrix;
    await updateDoc(curRef, {
      isActiveInScenario: isActive,
      updatedAt: new Date().toISOString()
    });
    await this.refreshScenarioSummary(curData.scenarioId, user);
  },

  // ---------------------------------------------------------------------------
  // 3. SCENARIO SUBJECTS
  // ---------------------------------------------------------------------------

  async getScenarioSubjects(scenarioId: string): Promise<ScenarioSubject[]> {
    const q = query(collection(db, SCENARIO_SUBJECTS_COL), where("scenarioId", "==", scenarioId));
    const snap = await getDocs(q);
    const items: ScenarioSubject[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as ScenarioSubject));
    return items.sort((a, b) => a.name.localeCompare(b.name));
  },

  // ---------------------------------------------------------------------------
  // 4. SCENARIO SCHEDULES (SLOT EDITOR & CONFLICT DETECTION)
  // ---------------------------------------------------------------------------

  async getScenarioSchedules(scenarioId: string): Promise<ScenarioSchedule[]> {
    const q = query(collection(db, SCENARIO_SCHEDULES_COL), where("scenarioId", "==", scenarioId));
    const snap = await getDocs(q);
    const items: ScenarioSchedule[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as ScenarioSchedule));
    return deduplicateSchedules(items);
  },

  /**
   * Save or update a single scenario slot.
   */
  async saveScenarioScheduleSlot(
    slot: Partial<ScenarioSchedule> & { scenarioId: string; classId: string; day: string; sequence: number },
    user: { uid: string; displayName?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const canonicalId = `${slot.scenarioId}_sc_${slot.classId}_${slot.day}_${slot.sequence}`;
    const slotId = slot.id || canonicalId;

    const isSlotEmpty =
      !slot.subjectId ||
      slot.subjectId === "Kosong" ||
      !slot.subjectName ||
      slot.subjectName === "Kosong" ||
      slot.subjectName === "Belum Ditugaskan";

    const payload: ScenarioSchedule = {
      id: slotId,
      scenarioId: slot.scenarioId,
      academicYearId: slot.academicYearId || "",
      semesterId: slot.semesterId || "",
      classId: slot.classId,
      className: slot.className || "",
      gradeLevel: slot.gradeLevel || toValidGradeLevel(slot.className),
      day: slot.day,
      lessonPeriodId: slot.lessonPeriodId || "",
      sequence: slot.sequence,
      jp: slot.jp || `JP ${slot.sequence}`,
      subjectId: isSlotEmpty ? "" : (slot.subjectId || ""),
      subjectName: isSlotEmpty ? "Kosong" : (slot.subjectName || ""),
      teacherId: isSlotEmpty ? "" : (slot.teacherId || ""),
      teacherName: isSlotEmpty ? "Belum Ditugaskan" : (slot.teacherName || ""),
      isLocked: Boolean(slot.isLocked),
      createdAt: slot.createdAt || now,
      updatedAt: now
    };

    const batch = writeBatch(db);
    batch.set(doc(db, SCENARIO_SCHEDULES_COL, slotId), payload);

    // If slotId is different from canonicalId, clean up canonicalId to avoid duplicate records
    if (slot.id && slot.id !== canonicalId) {
      batch.delete(doc(db, SCENARIO_SCHEDULES_COL, canonicalId));
    }

    await batch.commit();
    await this.checkAndResetApprovalIfModified(slot.scenarioId, user, "perubahan slot jadwal");
    await this.refreshScenarioSummary(slot.scenarioId, user);
  },

  /**
   * Clear an assigned slot in the scenario.
   * Completely removes the slot document, canonical ID, and any lingering duplicate documents in Firestore.
   */
  async clearScenarioScheduleSlot(
    slotId: string, 
    scenarioId: string, 
    user: { uid: string; displayName?: string },
    context?: { classId?: string; day?: string; sequence?: number }
  ): Promise<void> {
    const batch = writeBatch(db);
    let hasDeletes = false;

    if (slotId && slotId.trim()) {
      batch.delete(doc(db, SCENARIO_SCHEDULES_COL, slotId.trim()));
      hasDeletes = true;
    }

    // Clean up canonical ID and any duplicate documents matching (scenarioId, classId, day, sequence)
    if (context?.classId && context?.day && context?.sequence !== undefined) {
      const canonicalId = `${scenarioId}_sc_${context.classId}_${context.day}_${context.sequence}`;
      if (canonicalId !== slotId) {
        batch.delete(doc(db, SCENARIO_SCHEDULES_COL, canonicalId));
        hasDeletes = true;
      }

      try {
        const q = query(
          collection(db, SCENARIO_SCHEDULES_COL),
          where("scenarioId", "==", scenarioId),
          where("classId", "==", context.classId),
          where("day", "==", context.day),
          where("sequence", "==", context.sequence)
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
          batch.delete(d.ref);
          hasDeletes = true;
        });
      } catch (err) {
        console.warn("Could not query duplicate scenario slots for cleanup:", err);
      }
    }

    if (hasDeletes) {
      await batch.commit();
    }

    await this.checkAndResetApprovalIfModified(scenarioId, user, "pengosongan slot jadwal");
    await this.refreshScenarioSummary(scenarioId, user);
  },

  /**
   * Clears all schedule slots for an active scenario (optionally filtered by classId if class-specific).
   * Strictly deletes only documents in scenario_schedules collection matching scenarioId (and classId).
   * Does NOT touch scenario_curriculum_matrix, live schedules, teachers, or master subjects.
   */
  async clearAllScenarioSchedules(params: {
    scenarioId: string;
    classId?: string;
    user: { uid: string; displayName?: string };
  }): Promise<{ deletedCount: number }> {
    const { scenarioId, classId, user } = params;
    let q = query(collection(db, SCENARIO_SCHEDULES_COL), where("scenarioId", "==", scenarioId));
    if (classId) {
      q = query(
        collection(db, SCENARIO_SCHEDULES_COL),
        where("scenarioId", "==", scenarioId),
        where("classId", "==", classId)
      );
    }
    const snap = await getDocs(q);
    const docs = snap.docs;
    let deletedCount = 0;
    const BATCH_SIZE = 450;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + BATCH_SIZE);
      chunk.forEach((d) => {
        batch.delete(d.ref);
        deletedCount++;
      });
      await batch.commit();
    }

    const reason = classId
      ? "pengosongan seluruh slot jadwal kelas"
      : "pengosongan seluruh slot jadwal skenario (kelas VII, VIII, IX)";
    await this.checkAndResetApprovalIfModified(scenarioId, user, reason);
    await this.refreshScenarioSummary(scenarioId, user);

    return { deletedCount };
  },

  /**
   * Move or swap scenario schedule slots atomically via Firestore writeBatch.
   */
  async moveOrSwapScenarioScheduleSlot(params: {
    scenarioId: string;
    sourceSlot: {
      id?: string;
      classId: string;
      className: string;
      gradeLevel?: string;
      day: string;
      sequence: number;
      jp?: string;
      lessonPeriodId?: string;
      schedule: ScenarioSchedule;
    };
    targetSlot: {
      id?: string;
      classId: string;
      className: string;
      gradeLevel?: string;
      day: string;
      sequence: number;
      jp?: string;
      lessonPeriodId?: string;
      existingSchedule?: ScenarioSchedule | null;
    };
    user: { uid: string; displayName?: string };
  }): Promise<void> {
    const { scenarioId, sourceSlot, targetSlot, user } = params;
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    const targetSlotId =
      targetSlot.id ||
      targetSlot.existingSchedule?.id ||
      `${scenarioId}_sc_${targetSlot.classId}_${targetSlot.day}_${targetSlot.sequence}`;
    const sourceSlotId =
      sourceSlot.id ||
      sourceSlot.schedule.id ||
      `${scenarioId}_sc_${sourceSlot.classId}_${sourceSlot.day}_${sourceSlot.sequence}`;

    if (targetSlotId === sourceSlotId) return;

    // Target slot becomes source schedule's content
    const targetPayload: ScenarioSchedule = {
      id: targetSlotId,
      scenarioId,
      academicYearId: sourceSlot.schedule.academicYearId || "",
      semesterId: sourceSlot.schedule.semesterId || "",
      classId: targetSlot.classId,
      className: targetSlot.className,
      gradeLevel: toValidGradeLevel(targetSlot.gradeLevel || targetSlot.className),
      day: targetSlot.day,
      lessonPeriodId: targetSlot.lessonPeriodId || "",
      sequence: targetSlot.sequence,
      jp: targetSlot.jp || `JP ${targetSlot.sequence}`,
      subjectId: sourceSlot.schedule.subjectId || "",
      subjectName: sourceSlot.schedule.subjectName || "",
      teacherId: sourceSlot.schedule.teacherId || "",
      teacherName: sourceSlot.schedule.teacherName || "",
      isLocked: Boolean(sourceSlot.schedule.isLocked),
      createdAt: sourceSlot.schedule.createdAt || now,
      updatedAt: now
    };
    batch.set(doc(db, SCENARIO_SCHEDULES_COL, targetSlotId), targetPayload);

    // If target had an existing valid subject, swap it into source slot
    const hasTargetSubject = Boolean(
      targetSlot.existingSchedule &&
      targetSlot.existingSchedule.subjectId &&
      targetSlot.existingSchedule.subjectName !== "Kosong" &&
      targetSlot.existingSchedule.subjectName !== "Belum Ditugaskan"
    );

    if (hasTargetSubject && targetSlot.existingSchedule) {
      const sourcePayload: ScenarioSchedule = {
        id: sourceSlotId,
        scenarioId,
        academicYearId: targetSlot.existingSchedule.academicYearId || "",
        semesterId: targetSlot.existingSchedule.semesterId || "",
        classId: sourceSlot.classId,
        className: sourceSlot.className,
        gradeLevel: toValidGradeLevel(sourceSlot.gradeLevel || sourceSlot.className),
        day: sourceSlot.day,
        lessonPeriodId: sourceSlot.lessonPeriodId || "",
        sequence: sourceSlot.sequence,
        jp: sourceSlot.jp || `JP ${sourceSlot.sequence}`,
        subjectId: targetSlot.existingSchedule.subjectId || "",
        subjectName: targetSlot.existingSchedule.subjectName || "",
        teacherId: targetSlot.existingSchedule.teacherId || "",
        teacherName: targetSlot.existingSchedule.teacherName || "",
        isLocked: Boolean(targetSlot.existingSchedule.isLocked),
        createdAt: targetSlot.existingSchedule.createdAt || now,
        updatedAt: now
      };
      batch.set(doc(db, SCENARIO_SCHEDULES_COL, sourceSlotId), sourcePayload);
    } else {
      // Target was empty -> delete source slot document
      batch.delete(doc(db, SCENARIO_SCHEDULES_COL, sourceSlotId));
      if (sourceSlot.schedule.id && sourceSlot.schedule.id !== sourceSlotId) {
        batch.delete(doc(db, SCENARIO_SCHEDULES_COL, sourceSlot.schedule.id));
      }
      const canonicalSourceId = `${scenarioId}_sc_${sourceSlot.classId}_${sourceSlot.day}_${sourceSlot.sequence}`;
      if (canonicalSourceId !== sourceSlotId) {
        batch.delete(doc(db, SCENARIO_SCHEDULES_COL, canonicalSourceId));
      }
    }

    await batch.commit();
    await this.checkAndResetApprovalIfModified(scenarioId, user, "pemindahan slot jadwal (drag & drop)");
    await this.refreshScenarioSummary(scenarioId, user);
  },


  // ---------------------------------------------------------------------------
  // 5. VALIDATION & CONFLICT DETECTION ENGINE
  // ---------------------------------------------------------------------------

  detectConflicts(
    schedules: ScenarioSchedule[],
    curriculums: ScenarioCurriculumMatrix[],
    classes: Class[],
    periods: LessonPeriod[]
  ): ScenarioConflict[] {
    const conflicts: ScenarioConflict[] = [];

    // Filter instructional lesson periods
    const instructionalPeriods = periods.filter((p) => p.type === LessonPeriodType.LESSON || p.instructional !== false);
    const daySequenceMap = new Set<string>();
    instructionalPeriods.forEach((p) => daySequenceMap.add(`${p.day.toLowerCase()}_${p.sequence}`));

    // 1. Teacher Double-Booking (Teacher in 2 classes at the same day & sequence)
    const teacherSlotMap = new Map<string, ScenarioSchedule[]>();
    schedules.forEach((sch) => {
      if (!sch.teacherId || !sch.subjectId) return;
      const key = `${sch.teacherId}_${sch.day.toLowerCase()}_${sch.sequence}`;
      if (!teacherSlotMap.has(key)) teacherSlotMap.set(key, []);
      teacherSlotMap.get(key)!.push(sch);
    });

    teacherSlotMap.forEach((slots, key) => {
      // If teacher has multiple distinct classes at the exact same slot
      const uniqueClasses = new Set(slots.map((s) => s.classId));
      if (uniqueClasses.size > 1) {
        const s = slots[0];
        const classNames = slots.map((x) => x.className || x.classId).join(" dan ");
        conflicts.push({
          type: "TEACHER_DOUBLE_BOOKING",
          severity: "error",
          title: `Tabrakan Jadwal Guru: ${s.teacherName}`,
          description: `Guru ${s.teacherName} terjadwal mengajar di ${slots.length} kelas sekaligus (${classNames}) pada hari ${s.day}, urutan ke-${s.sequence}.`,
          day: s.day,
          sequence: s.sequence,
          teacherId: s.teacherId,
          teacherName: s.teacherName
        });
      }
    });

    // 2. Class Double-Booking (Class having 2 different subjects at same day & sequence)
    const classSlotMap = new Map<string, ScenarioSchedule[]>();
    schedules.forEach((sch) => {
      if (!sch.classId || !sch.subjectId) return;
      const key = `${sch.classId}_${sch.day.toLowerCase()}_${sch.sequence}`;
      if (!classSlotMap.has(key)) classSlotMap.set(key, []);
      classSlotMap.get(key)!.push(sch);
    });

    classSlotMap.forEach((slots) => {
      if (slots.length > 1) {
        const s = slots[0];
        const subNames = slots.map((x) => x.subjectName).join(" & ");
        conflicts.push({
          type: "CLASS_DOUBLE_BOOKING",
          severity: "error",
          title: `Tabrakan Jadwal Kelas: ${s.className}`,
          description: `Kelas ${s.className} memiliki ${slots.length} mata pelajaran bertumpuk (${subNames}) pada hari ${s.day}, urutan ke-${s.sequence}.`,
          day: s.day,
          sequence: s.sequence,
          classId: s.classId,
          className: s.className
        });
      }
    });

    // 3. JP Allocation Mismatches per Class & Subject
    // Compare actual scheduled JP count vs curriculum target JP
    const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);

    classes.forEach((cls) => {
      const clsGrade = toValidGradeLevel(cls.gradeLevel || cls.name);
      const clsSchedules = schedules.filter((s) => isClassMatch(s.classId, cls.id || cls.classId, classes));

      activeCurriculums.forEach((cur) => {
        const targetJp = Number(
          clsGrade === "VII" ? cur.jp_vii : clsGrade === "VIII" ? cur.jp_viii : cur.jp_ix
        ) || 0;
        if (targetJp <= 0) return;

        // Count actual scheduled JP accurately using slot weight and deduplication
        const deduplicatedClsSchedules = deduplicateSchedules(clsSchedules);
        const matchingSlots = deduplicatedClsSchedules.filter((s) => isSlotMatchingCurriculum(s, cur));
        const actualJp = matchingSlots.reduce((sum, s) => sum + getScheduleSlotJpCount(s, periods), 0);

        if (actualJp > targetJp) {
          conflicts.push({
            type: "OVER_JP_ALLOCATION",
            severity: "warning",
            title: `Alokasi JP Berlebih: ${cls.name} — ${cur.subjectName}`,
            description: `Mapel ${cur.subjectName} dialokasikan ${actualJp} JP di jadwal, padahal target struktur kurikulum rancangan adalah ${targetJp} JP (+${actualJp - targetJp} JP).`,
            classId: cls.id,
            className: cls.name,
            subjectId: cur.subjectId,
            subjectName: cur.subjectName
          });
        } else if (actualJp < targetJp) {
          conflicts.push({
            type: "UNSCHEDULED_JP",
            severity: "warning",
            title: `JP Belum Terpenuhi: ${cls.name} — ${cur.subjectName}`,
            description: `Mapel ${cur.subjectName} baru teralokasi ${actualJp} JP dari target ${targetJp} JP (kurang ${targetJp - actualJp} JP).`,
            classId: cls.id,
            className: cls.name,
            subjectId: cur.subjectId,
            subjectName: cur.subjectName
          });
        }
      });
    });

    return conflicts;
  },

  /**
   * Helper to re-evaluate scenario metrics and write summary
   */
  async refreshScenarioSummary(scenarioId: string, user?: { uid: string; displayName?: string }): Promise<void> {
    const [scenario, curriculums, schedules, classes, periods] = await Promise.all([
      this.getScenarioById(scenarioId),
      this.getScenarioCurriculums(scenarioId),
      this.getScenarioSchedules(scenarioId),
      classService.getClasses().catch(() => [] as Class[]),
      lessonPeriodService.getLessonPeriods().catch(() => [] as LessonPeriod[])
    ]);

    if (!scenario) return;

    const activeCurriculums = curriculums.filter((c) => c.isActiveInScenario);

    const totalJpVii = activeCurriculums.reduce((sum, c) => sum + (c.jp_vii || 0), 0);
    const totalJpVIII = activeCurriculums.reduce((sum, c) => sum + (c.jp_viii || 0), 0);
    const totalJpIX = activeCurriculums.reduce((sum, c) => sum + (c.jp_ix || 0), 0);

    const baselineVii = curriculums.reduce((sum, c) => sum + (c.baseline_jp_vii || 0), 0);
    const baselineVIII = curriculums.reduce((sum, c) => sum + (c.baseline_jp_viii || 0), 0);
    const baselineIX = curriculums.reduce((sum, c) => sum + (c.baseline_jp_ix || 0), 0);

    const subjectsAdded = curriculums.filter((c) => c.isCustomSubject).length;
    const subjectsRemoved = curriculums.filter((c) => !c.isActiveInScenario).length;
    const subjectsModified = curriculums.filter(
      (c) =>
        c.isActiveInScenario &&
        !c.isCustomSubject &&
        (c.jp_vii !== c.baseline_jp_vii || c.jp_viii !== c.baseline_jp_viii || c.jp_ix !== c.baseline_jp_ix)
    ).length;

    const conflicts = this.detectConflicts(schedules, curriculums, classes, periods);

    const summaryMetrics = {
      totalJpVii,
      totalJpVIII,
      totalJpIX,
      diffJpVii: totalJpVii - baselineVii,
      diffJpVIII: totalJpVIII - baselineVIII,
      diffJpIX: totalJpIX - baselineIX,
      subjectsAdded,
      subjectsRemoved,
      subjectsModified,
      totalScheduleSlots: schedules.length,
      conflictCount: conflicts.length
    };

    const now = new Date().toISOString();
    await updateDoc(doc(db, SCENARIOS_COL, scenarioId), {
      summaryMetrics,
      updatedAt: now,
      ...(user ? { updatedBy: user.uid, updatedByName: user.displayName || "Pengguna" } : {})
    });
  },

  // ---------------------------------------------------------------------------
  // 6. SCENARIO CHANGE LOGS
  // ---------------------------------------------------------------------------

  async getScenarioLogs(scenarioId: string): Promise<ScenarioChangeLog[]> {
    const q = query(collection(db, SCENARIO_LOGS_COL), where("scenarioId", "==", scenarioId));
    const snap = await getDocs(q);
    const items: ScenarioChangeLog[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as ScenarioChangeLog));
    return items.sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  },

  // ---------------------------------------------------------------------------
  // 7. CLEANUP ZERO-JP SUBJECTS IN SCENARIO MATRIX (STRICTLY ISOLATED)
  // ---------------------------------------------------------------------------

  /**
   * Delete curriculum items from scenario_curriculum_matrix that have 0 JP.
   * STRICT GUARANTEE: Never touches master 'subjects' or live 'curriculum_matrix'.
   */
  async removeZeroJpCurriculumItems(params: {
    scenarioId: string;
    curriculumItemIds: string[];
    user: { uid: string; displayName?: string };
  }): Promise<{
    deletedCount: number;
    skippedCount: number;
    deletedIds: string[];
  }> {
    const callerUid = auth?.currentUser?.uid || params.user?.uid;
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";

    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan tidak ditemukan.");

    const existingCurriculums = await this.getScenarioCurriculums(params.scenarioId);
    const existingMap = new Map<string, ScenarioCurriculumMatrix>(existingCurriculums.map((c) => [c.id, c]));

    const idsToDelete: string[] = [];
    const deletedNames: string[] = [];
    let skippedCount = 0;

    for (const id of params.curriculumItemIds) {
      const item = existingMap.get(id);
      if (!item) {
        skippedCount++;
        continue;
      }
      // Strictly verify it has 0 JP across all grades
      const isZeroJp = (item.jp_vii || 0) === 0 && (item.jp_viii || 0) === 0 && (item.jp_ix || 0) === 0;
      if (isZeroJp) {
        idsToDelete.push(item.id);
        deletedNames.push(item.subjectName || id);
      } else {
        skippedCount++;
      }
    }

    if (idsToDelete.length === 0) {
      return { deletedCount: 0, skippedCount, deletedIds: [] };
    }

    // Batch delete only from SCENARIO_CURRICULUM_COL
    const BATCH_SIZE = 400;
    for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = idsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach((docId) => {
        batch.delete(doc(db, SCENARIO_CURRICULUM_COL, docId));
      });
      await batch.commit();
    }

    // Record audit trail in change logs
    const now = new Date().toISOString();
    const logId = `${params.scenarioId}_log_rmzero_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "REMOVE_ZERO_JP_SUBJECTS",
      description: `Menghapus ${idsToDelete.length} mata pelajaran tanpa alokasi JP dari matriks bayangan (${deletedNames.slice(0, 5).join(", ")}${deletedNames.length > 5 ? `, +${deletedNames.length - 5} lainnya` : ""}).`,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now
    });

    // Reset approval if previously approved
    await this.checkAndResetApprovalIfModified(params.scenarioId, params.user, "penghapusan mapel 0 JP");

    // Refresh scenario metrics
    await this.refreshScenarioSummary(params.scenarioId, params.user);

    return {
      deletedCount: idsToDelete.length,
      skippedCount,
      deletedIds: idsToDelete
    };
  },

  async removeZeroJpCurriculumSubjects(params: {
    scenarioId: string;
    curriculumItemIds: string[];
    user: { uid: string; displayName?: string };
  }): Promise<{
    deletedCount: number;
    skippedCount: number;
    deletedIds: string[];
  }> {
    return this.removeZeroJpCurriculumItems(params);
  },

  // ---------------------------------------------------------------------------
  // 8. MASS APPROVAL & APPLY TO LIVE SCHEDULE WORKFLOW
  // ---------------------------------------------------------------------------

  /**
   * Generates a comprehensive preview and diff comparing scenario schedules with live schedules.
   */
  async previewApplyScenarioToLiveSchedule(params: {
    scenarioId: string;
    academicYearId: string;
    semesterId: string;
    classIds?: string[];
  }): Promise<ScenarioApplyPreview> {
    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan jadwal bayangan tidak ditemukan.");

    const [scenarioSchedules, scenarioCurriculums, liveSchedules, opCurriculums, classes, periods] = await Promise.all([
      this.getScenarioSchedules(params.scenarioId),
      this.getScenarioCurriculums(params.scenarioId),
      scheduleService.getSchedules(params.academicYearId, params.semesterId),
      curriculumMatrixService.getCurriculumMatrix().catch(() => [] as CurriculumMatrix[]),
      classService.getClasses().catch(() => [] as Class[]),
      lessonPeriodService.getLessonPeriods().catch(() => [] as LessonPeriod[])
    ]);

    // Check approval status: Only 'Disetujui' or already 'Diterapkan' can be previewed for apply
    let isApproved = scenario.status === "Disetujui";
    let blockReason: string | undefined = undefined;
    if (!isApproved) {
      if (scenario.status === "Diterapkan") {
        isApproved = true; // allow preview if already applied
      } else {
        blockReason = `Rancangan berstatus "${scenario.status}". Hanya rancangan yang telah "Disetujui" oleh Kepala Sekolah / Waka yang dapat diterapkan ke jadwal operasional.`;
      }
    }

    // Safety: If scenario was modified after approval, enforce re-submission
    if (isApproved && scenario.status === "Disetujui" && scenario.approvedAt && scenario.updatedAt) {
      const approvedTime = new Date(scenario.approvedAt).getTime();
      const updatedTime = new Date(scenario.updatedAt).getTime();
      if (updatedTime > approvedTime + 2000) {
        isApproved = false;
        blockReason = `Rancangan telah diubah setelah disetujui pada ${new Date(scenario.approvedAt).toLocaleDateString("id-ID")}. Harap ajukan dan minta persetujuan ulang sebelum menerapkan ke jadwal operasional.`;
      }
    }

    // Filter scenario schedules based on target classes if provided
    const hasClassFilter = Boolean(params.classIds && params.classIds.length > 0 && !params.classIds.includes("ALL"));
    const targetScenarioSchedules = scenarioSchedules.filter((s) => {
      if (!hasClassFilter) return true;
      return params.classIds!.some((cId) => isClassMatch(s.classId, cId, classes));
    });

    // Run conflict detection on scenario schedules
    const conflicts = this.detectConflicts(targetScenarioSchedules, scenarioCurriculums, classes, periods);
    const hasBlockingErrors = conflicts.some((c) => c.severity === "error");
    if (hasBlockingErrors && !blockReason) {
      blockReason = "Terdapat konflik jadwal (tabrakan guru atau kelas) yang belum diselesaikan. Harap perbaiki konflik terlebih dahulu.";
    }

    // Build map of existing live schedules by canonical slot key
    const liveBySlot = new Map<string, Schedule>();
    liveSchedules.forEach((ls) => {
      const slotKey = getCanonicalSlotKey(ls, classes);
      liveBySlot.set(slotKey, ls);
    });

    const addedSlots: ScenarioApplyPreview["addedSlots"] = [];
    const updatedSlots: ScenarioApplyPreview["updatedSlots"] = [];
    let emptySlotsCount = 0;
    let unchangedSlotsCount = 0;

    targetScenarioSchedules.forEach((sch) => {
      const slotKey = getCanonicalSlotKey(sch, classes);
      const isIntentionalEmpty = !sch.subjectId || sch.subjectName === "Kosong" || sch.subjectName === "Belum Ditugaskan";
      if (isIntentionalEmpty) emptySlotsCount++;

      const existing = liveBySlot.get(slotKey);
      if (!existing) {
        addedSlots.push({
          slotKey,
          classId: sch.classId,
          className: sch.className,
          day: sch.day,
          sequence: sch.sequence,
          jp: sch.jp || `JP ${sch.sequence}`,
          subjectName: isIntentionalEmpty ? "Kosong (Belum Ditugaskan)" : sch.subjectName,
          teacherName: sch.teacherName || "Belum Ditugaskan",
          isIntentionalEmpty
        });
      } else {
        const isSubjectDiff = (existing.subjectId || "") !== (sch.subjectId || "");
        const isTeacherDiff = (existing.teacherId || "") !== (sch.teacherId || "");
        if (isSubjectDiff || isTeacherDiff) {
          updatedSlots.push({
            slotKey,
            classId: sch.classId,
            className: sch.className,
            day: sch.day,
            sequence: sch.sequence,
            jp: sch.jp || `JP ${sch.sequence}`,
            oldSubjectName: existing.subjectName || "Kosong",
            newSubjectName: isIntentionalEmpty ? "Kosong (Belum Ditugaskan)" : sch.subjectName,
            oldTeacherName: existing.teacherName || "Belum Ditugaskan",
            newTeacherName: sch.teacherName || "Belum Ditugaskan",
            isIntentionalEmpty
          });
        } else {
          unchangedSlotsCount++;
        }
      }
    });

    // Compute curriculum changes diff
    const opMap = new Map<string, CurriculumMatrix>();
    opCurriculums.forEach((oc) => opMap.set(oc.subjectId, oc));

    const addedSubjects: Array<{ subjectId: string; subjectName: string; group: string }> = [];
    const renamedSubjects: Array<{ subjectId: string; oldName: string; newName: string }> = [];
    const jpChangedSubjects: Array<{ subjectId: string; subjectName: string; oldJp: string; newJp: string }> = [];

    scenarioCurriculums.forEach((sc) => {
      const op = opMap.get(sc.subjectId);
      if (!op) {
        addedSubjects.push({ subjectId: sc.subjectId, subjectName: sc.subjectName, group: sc.subjectGroup });
      } else {
        if (op.subjectName.trim() !== sc.subjectName.trim()) {
          renamedSubjects.push({ subjectId: sc.subjectId, oldName: op.subjectName, newName: sc.subjectName });
        }
        const opJpStr = `${op.jp_vii}/${op.jp_viii}/${op.jp_ix}`;
        const scJpStr = `${sc.jp_vii}/${sc.jp_viii}/${sc.jp_ix}`;
        if (opJpStr !== scJpStr) {
          jpChangedSubjects.push({ subjectId: sc.subjectId, subjectName: sc.subjectName, oldJp: opJpStr, newJp: scJpStr });
        }
      }
    });

    const removedZeroJpSubjects: Array<{ subjectId: string; subjectName: string }> = [];
    opCurriculums.forEach((oc) => {
      if ((oc.jp_vii || 0) === 0 && (oc.jp_viii || 0) === 0 && (oc.jp_ix || 0) === 0) {
        if (!scenarioCurriculums.some((sc) => sc.subjectId === oc.subjectId)) {
          removedZeroJpSubjects.push({ subjectId: oc.subjectId, subjectName: oc.subjectName });
        }
      }
    });

    const curriculumChanges = {
      addedSubjects,
      removedZeroJpSubjects,
      renamedSubjects,
      jpChangedSubjects
    };

    const canApply = isApproved && !hasBlockingErrors;

    return {
      academicYearId: params.academicYearId,
      academicYearName: scenario.academicYearName,
      semesterId: params.semesterId,
      semesterName: scenario.semesterName,
      selectedClassIds: params.classIds || ["ALL"],
      totalSlotsInScenario: targetScenarioSchedules.length,
      addedSlots,
      updatedSlots,
      emptySlotsCount,
      unchangedSlotsCount,
      conflicts,
      curriculumChanges,
      hasBlockingErrors,
      canApply,
      blockReason
    };
  },

  /**
   * Applies the approved scenario mass schedules into the live 'schedules' collection
   * and synchronizes approved curriculum matrix structure safely into 'curriculum_matrix'.
   * Uses canonical slots and isClassMatch, preserving intentional empty slots.
   */
  async applyScenarioToLiveSchedule(params: {
    scenarioId: string;
    academicYearId: string;
    semesterId: string;
    classIds?: string[];
    user: { uid: string; displayName?: string; role?: string };
  }): Promise<ScenarioApplyResult> {
    const callerUid = auth?.currentUser?.uid || params.user?.uid;
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";

    // 1. Validate Preview first
    const preview = await this.previewApplyScenarioToLiveSchedule({
      scenarioId: params.scenarioId,
      academicYearId: params.academicYearId,
      semesterId: params.semesterId,
      classIds: params.classIds
    });

    if (!preview.canApply) {
      throw new Error(`Penerapan dibatalkan: ${preview.blockReason || "Validasi kelayakan penerapan gagal."}`);
    }

    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan jadwal bayangan tidak ditemukan.");

    const [scenarioSchedules, scenarioCurriculums, classes, opCurriculums] = await Promise.all([
      this.getScenarioSchedules(params.scenarioId),
      this.getScenarioCurriculums(params.scenarioId),
      classService.getClasses().catch(() => [] as Class[]),
      curriculumMatrixService.getCurriculumMatrix().catch(() => [] as CurriculumMatrix[])
    ]);

    const hasClassFilter = Boolean(params.classIds && params.classIds.length > 0 && !params.classIds.includes("ALL"));
    const targetScenarioSchedules = scenarioSchedules.filter((s) => {
      if (!hasClassFilter) return true;
      return params.classIds!.some((cId) => isClassMatch(s.classId, cId, classes));
    });

    // 2. Prepare operational schedules to save into SSOT 'schedules' collection
    const operationalSchedulesToSave: Schedule[] = targetScenarioSchedules.map((sch) => {
      const isIntentionalEmpty = !sch.subjectId || sch.subjectName === "Kosong" || sch.subjectName === "Belum Ditugaskan";

      return {
        academicYearId: params.academicYearId,
        semesterId: params.semesterId,
        classId: sch.classId,
        className: sch.className,
        day: sch.day,
        sequence: sch.sequence,
        jp: sch.jp || `JP ${sch.sequence}`,
        subjectId: isIntentionalEmpty ? "" : sch.subjectId,
        subjectName: isIntentionalEmpty ? "Kosong" : sch.subjectName,
        teacherId: isIntentionalEmpty ? "" : sch.teacherId,
        teacherName: isIntentionalEmpty ? "Belum Ditugaskan" : sch.teacherName,
        isLocked: Boolean(sch.isLocked),
        lessonPeriodId: sch.lessonPeriodId || "",
        createdBy: callerUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    // 3. Write via scheduleService.saveSchedules (safely handling canonical slots, deduplication, and scope)
    const classScopeParam = hasClassFilter && params.classIds!.length === 1 ? params.classIds![0] : "ALL";
    
    await scheduleService.saveSchedules(
      operationalSchedulesToSave,
      params.academicYearId,
      params.semesterId,
      callerUid,
      callerName,
      classScopeParam,
      "manual-edit"
    );

    // 4. Synchronize approved Curriculum Structure into live 'curriculum_matrix'
    let curriculumAppliedCount = 0;
    try {
      const now = new Date().toISOString();
      const opCurriculumMap = new Map<string, CurriculumMatrix>();
      opCurriculums.forEach((oc) => opCurriculumMap.set(oc.subjectId, oc));

      for (const sc of scenarioCurriculums) {
        if (!sc.isActiveInScenario) continue;
        const existingOp = opCurriculumMap.get(sc.subjectId) || (sc.originalCurriculumId ? opCurriculums.find(o => o.id === sc.originalCurriculumId) : undefined);

        if (existingOp) {
          // Update existing curriculum_matrix document while strictly maintaining subjectId
          await updateDoc(doc(db, "curriculum_matrix", existingOp.id), {
            subjectName: sc.subjectName,
            jp_vii: sc.jp_vii,
            jp_viii: sc.jp_viii,
            jp_ix: sc.jp_ix,
            teacherId: sc.teacherId || existingOp.teacherId || "",
            teacherName: sc.teacherName || existingOp.teacherName || "",
            teacherId_vii: sc.teacherId_vii || existingOp.teacherId_vii || "",
            teacherName_vii: sc.teacherName_vii || existingOp.teacherName_vii || "",
            teacherId_viii: sc.teacherId_viii || existingOp.teacherId_viii || "",
            teacherName_viii: sc.teacherName_viii || existingOp.teacherName_viii || "",
            teacherId_ix: sc.teacherId_ix || existingOp.teacherId_ix || "",
            teacherName_ix: sc.teacherName_ix || existingOp.teacherName_ix || "",
            updatedAt: now,
            updatedBy: callerUid
          });
          curriculumAppliedCount++;
        } else if (sc.isCustomSubject) {
          // Add custom scenario subject to curriculum_matrix so reference is canonical
          const newDocRef = doc(collection(db, "curriculum_matrix"));
          await setDoc(newDocRef, {
            id: newDocRef.id,
            curriculumId: newDocRef.id,
            subjectId: sc.subjectId,
            subjectName: sc.subjectName,
            jp_vii: sc.jp_vii,
            jp_viii: sc.jp_viii,
            jp_ix: sc.jp_ix,
            teacherId: sc.teacherId || "",
            teacherName: sc.teacherName || "",
            createdAt: now,
            updatedAt: now,
            createdBy: callerUid,
            updatedBy: callerUid
          });
          curriculumAppliedCount++;
        }
      }
    } catch (curErr) {
      console.warn("Could not sync curriculum_matrix during scenario apply:", curErr);
    }

    // 5. Update Scenario Status to "Diterapkan" & write audit log
    const now = new Date().toISOString();
    const appliedClasses: string[] = targetScenarioSchedules
      .map((s) => (s.className || s.classId || "") as string)
      .filter((val, idx, arr) => Boolean(val) && arr.indexOf(val) === idx);

    const appliedSummary = {
      totalApplied: targetScenarioSchedules.length,
      classesApplied: appliedClasses,
      addedSlots: preview.addedSlots.length,
      updatedSlots: preview.updatedSlots.length,
      emptySlots: preview.emptySlotsCount
    };

    const statusEntry = {
      status: "Diterapkan" as ScenarioStatus,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now,
      notes: `Diterapkan secara massal ke jadwal operasional untuk ${appliedClasses.length} kelas (${targetScenarioSchedules.length} slot total, ${preview.emptySlotsCount} slot kosong yang disengaja).`
    };

    await updateDoc(doc(db, SCENARIOS_COL, params.scenarioId), {
      status: "Diterapkan",
      appliedAt: now,
      appliedBy: callerUid,
      appliedByName: callerName,
      appliedSummary,
      statusHistory: [...(scenario.statusHistory || []), statusEntry],
      updatedBy: callerUid,
      updatedByName: callerName,
      updatedAt: now
    });

    // 6. Write Change Log
    const logId = `${params.scenarioId}_log_apply_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "APPLY_TO_LIVE_SCHEDULE",
      description: `Rancangan berhasil diterapkan massal ke jadwal operasional (${targetScenarioSchedules.length} slot, ${appliedClasses.join(", ")}).`,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now,
      diffDetails: appliedSummary
    });

    return {
      totalApplied: targetScenarioSchedules.length,
      classesApplied: appliedClasses,
      addedCount: preview.addedSlots.length,
      updatedCount: preview.updatedSlots.length,
      emptySlotsCount: preview.emptySlotsCount,
      deletedDuplicatesCount: 0,
      curriculumAppliedCount,
      appliedAt: now,
      appliedBy: callerName
    };
  },

  /**
   * Publishes the live schedule derived from an applied scenario.
   */
  async publishScenarioLiveSchedule(params: {
    scenarioId: string;
    user: { uid: string; displayName?: string };
  }): Promise<void> {
    const callerUid = auth?.currentUser?.uid || params.user?.uid;
    const callerName = auth?.currentUser?.displayName || params.user?.displayName || "Pengguna";

    const scenario = await this.getScenarioById(params.scenarioId);
    if (!scenario) throw new Error("Rancangan tidak ditemukan.");

    const now = new Date().toISOString();

    // 1. Mark publication on scenario metadata
    await updateDoc(doc(db, SCENARIOS_COL, params.scenarioId), {
      isPublished: true,
      publishedAt: now,
      publishedBy: callerUid,
      publishedByName: callerName,
      updatedBy: callerUid,
      updatedByName: callerName,
      updatedAt: now
    });

    // 2. Call scheduleService.publishSchedules
    await scheduleService.publishSchedules(
      callerUid,
      callerName,
      `Jadwal operasional dipublikasikan dari rancangan bayangan "${scenario.name}".`
    );

    // 3. Scenario Change Log
    const logId = `${params.scenarioId}_log_pub_${Date.now()}`;
    await setDoc(doc(db, SCENARIO_LOGS_COL, logId), {
      id: logId,
      scenarioId: params.scenarioId,
      action: "PUBLISH_LIVE_SCHEDULE",
      description: `Jadwal hasil penerapan resmi dipublikasikan ke siswa, guru, dan kalender KBM.`,
      changedBy: callerUid,
      changedByName: callerName,
      changedAt: now
    });
  }
};
