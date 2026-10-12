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
import { db } from "../firebase/config";
import {
  ScheduleScenario,
  ScenarioCurriculumMatrix,
  ScenarioSubject,
  ScenarioSchedule,
  ScenarioChangeLog,
  ScenarioStatus,
  ScenarioConflict,
  CurriculumMatrix,
  Schedule,
  Subject,
  Class,
  LessonPeriod,
  LessonPeriodType,
  Teacher
} from "../types";
import { curriculumMatrixService } from "./curriculumMatrixService";
import { scheduleService } from "./schedule.service";
import { subjectService } from "./subjectService";
import { classService } from "./classService";
import { lessonPeriodService } from "./lessonPeriod.service";
import { isClassMatch, normalizeGradeLevel } from "../utils/gradeLevelHelper";

function toValidGradeLevel(val?: string | number | null): "VII" | "VIII" | "IX" {
  const norm = normalizeGradeLevel(val);
  return norm === "INVALID_GRADE_LEVEL" ? "VII" : norm;
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
    if (!params.user?.uid) {
      throw new Error("Sesi pengguna tidak valid. Silakan login kembali.");
    }

    const now = new Date().toISOString();
    const scenarioId = `scenario_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Fetch operational source data (strictly READ-ONLY)
    const [opCurriculums, opSchedules, opSubjects] = await Promise.all([
      curriculumMatrixService.getCurriculumMatrix().catch(() => [] as CurriculumMatrix[]),
      scheduleService.getSchedules(params.academicYearId, params.semesterId).catch(() => [] as Schedule[]),
      subjectService.getSubjects().catch(() => [] as Subject[])
    ]);

    // 2. Prepare Snapshot for scenario_curriculum_matrix
    const curriculumSnapshots: ScenarioCurriculumMatrix[] = opCurriculums.map((cm, idx) => ({
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
      teacherId: cm.teacherId || "",
      teacherName: cm.teacherName || "",
      teacherId_vii: cm.teacherId_vii || "",
      teacherName_vii: cm.teacherName_vii || "",
      teacherId_viii: cm.teacherId_viii || "",
      teacherName_viii: cm.teacherName_viii || "",
      teacherId_ix: cm.teacherId_ix || "",
      teacherName_ix: cm.teacherName_ix || "",
      useDifferentTeachers: Boolean(cm.useDifferentTeachers),
      order: cm.order ?? idx,
      createdAt: now,
      updatedAt: now
    }));

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

    // 4. Prepare Snapshot for scenario_schedules
    const scheduleSnapshots: ScenarioSchedule[] = opSchedules.map((sc, idx) => ({
      id: `${scenarioId}_sc_${sc.id || idx}`,
      scenarioId,
      academicYearId: params.academicYearId,
      semesterId: params.semesterId,
      classId: sc.classId,
      className: sc.className,
      gradeLevel: toValidGradeLevel(sc.className),
      day: sc.day,
      lessonPeriodId: sc.lessonPeriodId,
      sequence: sc.sequence,
      jp: sc.jp,
      subjectId: sc.subjectId,
      subjectName: sc.subjectName,
      teacherId: sc.teacherId,
      teacherName: sc.teacherName,
      isLocked: Boolean(sc.isLocked),
      createdAt: now,
      updatedAt: now
    }));

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
          changedBy: params.user.uid,
          changedByName: params.user.displayName || "Pengguna",
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
      createdBy: params.user.uid,
      createdByName: params.user.displayName || "Pengguna",
      createdByRole: params.user.role || "",
      updatedBy: params.user.uid,
      updatedByName: params.user.displayName || "Pengguna",
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
          changedBy: params.user.uid,
          changedByName: params.user.displayName || "Pengguna",
          changedAt: now,
          notes: `Diduplikasi dari rancangan "${sourceScenario.name}".`
        }
      ],
      createdBy: params.user.uid,
      createdByName: params.user.displayName || "Pengguna",
      createdByRole: params.user.role || "",
      updatedBy: params.user.uid,
      updatedByName: params.user.displayName || "Pengguna",
      createdAt: now,
      updatedAt: now
    };

    await setDoc(doc(db, SCENARIOS_COL, newScenarioId), newMetadata);

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

    await updateDoc(doc(db, SCENARIOS_COL, params.scenarioId), {
      status: params.status,
      statusHistory: updatedHistory,
      updatedBy: params.user.uid,
      updatedByName: params.user.displayName || "Pengguna",
      updatedAt: now
    });

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
    await updateDoc(doc(db, SCENARIO_CURRICULUM_COL, item.id), {
      ...item,
      updatedAt: now
    });
    // Recompute scenario summary
    await this.refreshScenarioSummary(item.scenarioId, user);
  },

  async addCustomSubjectToScenario(params: {
    scenarioId: string;
    name: string;
    code: string;
    group: "A" | "B" | "C";
    jp_vii: number;
    jp_viii: number;
    jp_ix: number;
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
    return items;
  },

  /**
   * Save or update a single scenario slot.
   */
  async saveScenarioScheduleSlot(
    slot: Partial<ScenarioSchedule> & { scenarioId: string; classId: string; day: string; sequence: number },
    user: { uid: string; displayName?: string }
  ): Promise<void> {
    const now = new Date().toISOString();
    const slotId = slot.id || `${slot.scenarioId}_sc_${slot.classId}_${slot.day}_${slot.sequence}`;

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
      subjectId: slot.subjectId || "",
      subjectName: slot.subjectName || "",
      teacherId: slot.teacherId || "",
      teacherName: slot.teacherName || "",
      isLocked: Boolean(slot.isLocked),
      createdAt: slot.createdAt || now,
      updatedAt: now
    };

    await setDoc(doc(db, SCENARIO_SCHEDULES_COL, slotId), payload);
    await this.refreshScenarioSummary(slot.scenarioId, user);
  },

  /**
   * Clear an assigned slot in the scenario
   */
  async clearScenarioScheduleSlot(slotId: string, scenarioId: string, user: { uid: string; displayName?: string }): Promise<void> {
    await deleteDoc(doc(db, SCENARIO_SCHEDULES_COL, slotId));
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
      const clsGrade = toValidGradeLevel(cls.name || cls.gradeLevel);
      const clsSchedules = schedules.filter((s) => isClassMatch(s.classId, cls.id || cls.classId, classes));

      activeCurriculums.forEach((cur) => {
        const targetJp =
          clsGrade === "VII" ? cur.jp_vii : clsGrade === "VIII" ? cur.jp_viii : cur.jp_ix;
        if (targetJp <= 0) return;

        // Count how many slots are scheduled for this subject in this class
        const actualJp = clsSchedules.filter((s) => s.subjectId === cur.subjectId).length;

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
  }
};
