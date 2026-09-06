import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  addDoc,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { TeacherAssignment, CurriculumMatrix, Class } from "../types";
import { semesterService } from "./semester.service";

const COLLECTION_NAME = "teacher_assignments";

/**
 * Builds a deterministic, safe document ID for an assignment
 * based on Academic Year, Semester, Subject, and Class.
 * Sanitizes all characters outside [A-Za-z0-9_-] to ensure Firestore-safe document IDs.
 */
export function buildAssignmentDocId(
  academicYearId: string,
  semesterId: string,
  subjectId: string,
  classId: string
): string {
  const sanitizePart = (val: string): string => {
    if (!val) return "UNKNOWN";
    const cleaned = val
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
    return cleaned || "UNKNOWN";
  };

  const safeYear = sanitizePart(academicYearId);
  const safeSem = sanitizePart(semesterId);
  const safeSub = sanitizePart(subjectId);
  const safeClass = sanitizePart(classId);
  return `${safeYear}_${safeSem}_${safeSub}_${safeClass}`;
}

/**
 * Builds a deterministic, safe document ID for an effective-dated (versioned) assignment.
 * Backward compatible: Preserves base ID structure while appending the effectiveFrom date.
 * Example: AY-2026-2027_SEM-1_SUB-IPA_CLS-7A_2026-10-16
 */
export function buildVersionedAssignmentDocId(
  academicYearId: string,
  semesterId: string,
  subjectId: string,
  classId: string,
  effectiveFrom: string
): string {
  const baseDocId = buildAssignmentDocId(academicYearId, semesterId, subjectId, classId);
  const sanitizePart = (val: string): string => {
    if (!val) return "UNKNOWN";
    const cleaned = val
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "");
    return cleaned || "UNKNOWN";
  };
  const safeDate = sanitizePart(effectiveFrom);
  return `${baseDocId}_${safeDate}`;
}

/**
 * Helper to get today's date in YYYY-MM-DD format consistently.
 */
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Helper to get the previous day in YYYY-MM-DD format (pure UTC date math, zero timezone skew).
 * Example: getPreviousDayString("2026-10-16") -> "2026-10-15"
 */
export function getPreviousDayString(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return "";
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  const prevY = date.getUTCFullYear();
  const prevM = String(date.getUTCMonth() + 1).padStart(2, "0");
  const prevD = String(date.getUTCDate()).padStart(2, "0");
  return `${prevY}-${prevM}-${prevD}`;
}

export interface TransitionTeacherAssignmentParams {
  academicYearId: string;
  semesterId: string;
  subjectId: string;
  subjectName?: string;
  classId: string;
  className?: string;
  gradeLevel?: "VII" | "VIII" | "IX";
  newTeacherId: string;
  newTeacherName: string;
  effectiveFrom: string; // YYYY-MM-DD
  notes?: string;
  userId?: string;
  userName?: string;
}

// Activity logging
async function logActivity(
  userId: string, 
  userName: string, 
  action: string, 
  docId: string, 
  description: string
) {
  try {
    const logsRef = collection(db, "activity_logs");
    await addDoc(logsRef, {
      userId,
      userName,
      action,
      collection: COLLECTION_NAME,
      documentId: docId,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write activity log for teacher assignment:", error);
  }
}

export const teacherAssignmentService = {
  /**
   * Create or upsert a teacher assignment
   */
  async createTeacherAssignment(
    data: Omit<TeacherAssignment, "id" | "createdAt" | "updatedAt">,
    userId: string = "system",
    userName: string = "System"
  ): Promise<TeacherAssignment> {
    const academicYearId = data.academicYearId || "";
    const semesterId = data.semesterId || "";
    const subjectId = data.subjectId || "";
    const classId = data.classId || "";

    if (!academicYearId || !semesterId || !subjectId || !classId) {
      throw new Error("academicYearId, semesterId, subjectId, dan classId wajib diisi!");
    }

    const docId = buildAssignmentDocId(academicYearId, semesterId, subjectId, classId);
    const docRef = doc(db, COLLECTION_NAME, docId);
    const now = new Date().toISOString();

    const assignmentPayload: TeacherAssignment = {
      ...data,
      id: docId,
      academicYearId,
      semesterId,
      subjectId,
      classId,
      isActive: data.isActive !== false,
      effectiveFrom: data.effectiveFrom || now.split("T")[0],
      effectiveUntil: data.effectiveUntil || null,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      createdByName: userName
    };

    try {
      await setDoc(docRef, assignmentPayload, { merge: true });
      await logActivity(
        userId,
        userName,
        "ASSIGN_TEACHER_TO_CLASS",
        docId,
        `Menugaskan guru ${data.teacherName} pada mapel ${data.subjectName || subjectId} untuk kelas ${data.className || classId}`
      );
      return assignmentPayload;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
      throw error;
    }
  },

  /**
   * Get all teacher assignments
   */
  async getTeacherAssignments(): Promise<TeacherAssignment[]> {
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const snapshot = await getDocs(colRef);
      const items: TeacherAssignment[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      return items;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      return [];
    }
  },

  /**
   * Get teacher assignments by academic period
   */
  async getTeacherAssignmentsByPeriod(
    academicYearId: string,
    semesterId: string
  ): Promise<TeacherAssignment[]> {
    if (!academicYearId || !semesterId) return [];
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId)
      );
      const snapshot = await getDocs(q);
      const items: TeacherAssignment[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      return items;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      return [];
    }
  },

  /**
   * Get teacher assignments for a specific class in a period
   */
  async getTeacherAssignmentsByClass(
    academicYearId: string,
    semesterId: string,
    classId: string
  ): Promise<TeacherAssignment[]> {
    if (!academicYearId || !semesterId || !classId) return [];
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("classId", "==", classId)
      );
      const snapshot = await getDocs(q);
      const items: TeacherAssignment[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...(d.data() as any) });
      });
      return items;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
      return [];
    }
  },

  /**
   * Get teacher assignment for a specific subject and class in a period
   */
  async getTeacherAssignmentsBySubjectAndClass(
    academicYearId: string,
    semesterId: string,
    subjectId: string,
    classId: string
  ): Promise<TeacherAssignment | null> {
    if (!academicYearId || !semesterId || !subjectId || !classId) return null;
    const docId = buildAssignmentDocId(academicYearId, semesterId, subjectId, classId);
    try {
      const docSnap = await getDoc(doc(db, COLLECTION_NAME, docId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...(docSnap.data() as any) };
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${docId}`);
      return null;
    }
  },

  /**
   * Get all teacher assignments (active and historical) for a specific subject and class in a period
   */
  async getAllTeacherAssignmentsBySubjectAndClass(
    academicYearId: string,
    semesterId: string,
    subjectId: string,
    classId: string
  ): Promise<TeacherAssignment[]> {
    if (!academicYearId || !semesterId || !subjectId || !classId) return [];
    const allInPeriod = await this.getTeacherAssignmentsByPeriod(academicYearId, semesterId);
    return allInPeriod
      .filter((a) => a.subjectId === subjectId && a.classId === classId && a.isActive !== false)
      .sort((a, b) => (a.effectiveFrom || "").localeCompare(b.effectiveFrom || ""));
  },

  /**
   * Update teacher assignment details
   */
  async updateTeacherAssignment(
    id: string,
    updates: Partial<TeacherAssignment>,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      const updatePayload = {
        ...updates,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };
      await updateDoc(docRef, updatePayload);
      await logActivity(
        userId,
        userName,
        "UPDATE_TEACHER_ASSIGNMENT",
        id,
        `Memperbarui penugasan guru (ID: ${id})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  },

  /**
   * Deactivate a teacher assignment (Soft-delete / nonaktif)
   */
  async deactivateTeacherAssignment(
    id: string,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        isActive: false,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      });
      await logActivity(
        userId,
        userName,
        "DEACTIVATE_TEACHER_ASSIGNMENT",
        id,
        `Menonaktifkan penugasan guru (ID: ${id})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
      throw error;
    }
  },

  /**
   * TRANSITION TEACHER ASSIGNMENT (Tahap 4: Effective-Dated Assignment Versioning)
   * Replaces the active teacher for a subject and class starting on effectiveFrom (YYYY-MM-DD)
   * without deleting or overwriting historical assignment records.
   *
   * Logic:
   * 1. Validates inputs and effectiveFrom date format (YYYY-MM-DD).
   * 2. Checks existing assignments for (academicYearId, semesterId, subjectId, classId).
   * 3. Prevents duplicate assignment if the same transition parameters were already executed (Idempotent).
   * 4. Validates that newTeacherId is different from the active teacher.
   * 5. Checks for date collisions / overlaps:
   *    If any assignment starts on or after effectiveFrom (effectiveFrom >= targetEffectiveFrom),
   *    rejects with a clear error without overwriting.
   * 6. Closes the currently active assignment by setting its effectiveUntil = previousDay(effectiveFrom).
   * 7. Creates a new versioned assignment document with deterministic ID:
   *    buildVersionedAssignmentDocId(academicYearId, semesterId, subjectId, classId, effectiveFrom).
   * 8. Executes via writeBatch to guarantee atomicity.
   */
  async transitionTeacherAssignment(
    params: TransitionTeacherAssignmentParams
  ): Promise<TeacherAssignment> {
    const {
      academicYearId,
      semesterId,
      subjectId,
      classId,
      newTeacherId,
      newTeacherName,
      effectiveFrom,
      notes,
      userId = "system",
      userName = "System"
    } = params;

    if (!academicYearId || !semesterId || !subjectId || !classId) {
      throw new Error("academicYearId, semesterId, subjectId, dan classId wajib diisi!");
    }
    if (!newTeacherId || newTeacherId.trim() === "" || newTeacherName === "Belum Ditentukan") {
      throw new Error("Guru pengganti (newTeacherId) wajib dipilih!");
    }
    if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      throw new Error("Format tanggal mulai pergantian guru (effectiveFrom) harus YYYY-MM-DD!");
    }

    // 1. Preload all assignments for this period and filter for this class + subject
    const periodAssignments = await this.getTeacherAssignmentsByPeriod(academicYearId, semesterId);
    const existing = periodAssignments.filter(
      (a) => a.subjectId === subjectId && a.classId === classId && a.isActive !== false
    );

    // 2. Duplicate Prevention / Idempotency check:
    // If an assignment already exists with this exact teacher and effectiveFrom, return it cleanly
    const exactDuplicate = existing.find(
      (a) => a.teacherId === newTeacherId && a.effectiveFrom === effectiveFrom
    );
    if (exactDuplicate) {
      return exactDuplicate;
    }

    // 3. Find the currently active assignment that covers effectiveFrom
    const activeCovering = existing.find((a) => {
      const startOk = !a.effectiveFrom || a.effectiveFrom <= effectiveFrom;
      const endOk = !a.effectiveUntil || a.effectiveUntil >= effectiveFrom;
      return startOk && endOk;
    });

    // 4. Validate that new teacher is not already the active teacher
    if (activeCovering && activeCovering.teacherId === newTeacherId) {
      throw new Error(`Guru pengganti (${newTeacherName}) sama dengan guru yang sedang aktif untuk kelas ini!`);
    }

    // 5. Overlap collision check:
    // Any existing assignment that starts on or after effectiveFrom is considered an illegal overlap
    const colliding = existing.find(
      (a) => a.effectiveFrom && a.effectiveFrom >= effectiveFrom && a.id !== activeCovering?.id
    );
    if (colliding) {
      throw new Error(
        `Tanggal mulai pergantian guru (${effectiveFrom}) bertabrakan dengan periode penugasan yang sudah ada (mulai ${colliding.effectiveFrom} oleh ${colliding.teacherName})!`
      );
    }

    // 6. Atomically close old assignment and create new versioned assignment
    const previousDay = getPreviousDayString(effectiveFrom);
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    if (activeCovering && activeCovering.id) {
      const prevDocRef = doc(db, COLLECTION_NAME, activeCovering.id);
      batch.update(prevDocRef, {
        effectiveUntil: previousDay,
        updatedAt: now,
        updatedBy: userId
      });
    }

    const versionedDocId = buildVersionedAssignmentDocId(
      academicYearId,
      semesterId,
      subjectId,
      classId,
      effectiveFrom
    );
    const newDocRef = doc(db, COLLECTION_NAME, versionedDocId);

    const newAssignment: TeacherAssignment = {
      id: versionedDocId,
      academicYearId,
      semesterId,
      subjectId,
      subjectName: params.subjectName || activeCovering?.subjectName || "",
      classId,
      className: params.className || activeCovering?.className || "",
      ...(params.gradeLevel || activeCovering?.gradeLevel ? { gradeLevel: params.gradeLevel || activeCovering?.gradeLevel } : {}),
      teacherId: newTeacherId,
      teacherName: newTeacherName,
      effectiveFrom,
      effectiveUntil: null,
      isActive: true,
      notes: notes || `Pergantian guru dari ${activeCovering?.teacherName || "guru sebelumnya"} ke ${newTeacherName} mulai ${effectiveFrom}`,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      createdByName: userName
    };

    batch.set(newDocRef, newAssignment, { merge: true });
    await batch.commit();

    await logActivity(
      userId,
      userName,
      "TRANSITION_TEACHER_ASSIGNMENT",
      versionedDocId,
      `Pergantian guru kelas ${newAssignment.className || classId} mapel ${newAssignment.subjectName || subjectId}: ${activeCovering?.teacherName || "Guru Lama"} -> ${newTeacherName} (Mulai: ${effectiveFrom})`
    );

    return newAssignment;
  },

  /**
   * CENTRAL TEACHER RESOLVER (Synchronous with preloaded assignments)
   * Resolves the teacher strictly following the 4-tier priority hierarchy:
   * 1. Priority 1: Active Teacher Assignment for (academicYearId + semesterId + subjectId + classId)
   *    - Date-aware if `date` (YYYY-MM-DD) is provided (effectiveFrom <= date && (!effectiveUntil || effectiveUntil >= date))
   *    - Current active assignment if `date` is omitted
   * 2. Priority 2: Grade-level legacy fallback from curriculum_matrix (teacherId_vii / viii / ix)
   * 3. Priority 3: Global legacy fallback from curriculum_matrix (teacherId)
   * 4. Priority 4: "Belum Ditentukan" (empty teacherId)
   */
  resolveTeacherAssignmentSync(params: {
    academicYearId?: string;
    semesterId?: string;
    subjectId: string;
    classId?: string;
    gradeLevel?: "VII" | "VIII" | "IX" | string;
    date?: string; // YYYY-MM-DD
    curriculumMatrixItem?: CurriculumMatrix | null;
    preloadedAssignments?: TeacherAssignment[];
  }): {
    teacherId: string;
    teacherName: string;
    source: "assignment" | "matrix_grade" | "matrix_global" | "unassigned";
    assignment?: TeacherAssignment;
  } {
    const {
      academicYearId,
      semesterId,
      subjectId,
      classId,
      gradeLevel,
      date,
      curriculumMatrixItem,
      preloadedAssignments = []
    } = params;

    // PRIORITAS 1: Cek teacher_assignments aktif
    if (classId && preloadedAssignments.length > 0) {
      const matching = preloadedAssignments.filter((a) => {
        const matchesSubject = a.subjectId === subjectId;
        const matchesClass = a.classId === classId;
        // If resolving for a specific date, allow past bounded periods (effectiveUntil set);
        // otherwise only include active records (a.isActive !== false)
        const matchesActive = Boolean(date) ? (a.isActive !== false || Boolean(a.effectiveUntil)) : a.isActive !== false;
        const matchesYear = !academicYearId || !a.academicYearId || a.academicYearId === academicYearId;
        const matchesSem = !semesterId || !a.semesterId || a.semesterId === semesterId;
        return matchesSubject && matchesClass && matchesActive && matchesYear && matchesSem;
      });

      if (matching.length > 0) {
        let matched: TeacherAssignment | undefined;

        if (date) {
          // Date-aware resolution: effectiveFrom <= date AND (!effectiveUntil || effectiveUntil >= date)
          const dateMatched = matching.filter((a) => {
            const startOk = !a.effectiveFrom || a.effectiveFrom <= date;
            const endOk = !a.effectiveUntil || a.effectiveUntil >= date;
            return startOk && endOk;
          });

          if (dateMatched.length > 0) {
            // Sort by latest effectiveFrom (prefer versioned assignment over legacy assignment)
            dateMatched.sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));
            matched = dateMatched[0];
          }
        } else {
          // No date provided: prefer currently active assignment (effective for today)
          const today = getTodayDateString();
          const activeToday = matching.filter((a) => {
            const startOk = !a.effectiveFrom || a.effectiveFrom <= today;
            const endOk = !a.effectiveUntil || a.effectiveUntil >= today;
            return startOk && endOk;
          });

          if (activeToday.length > 0) {
            activeToday.sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));
            matched = activeToday[0];
          } else {
            // Fallback 1: any assignment with no effectiveUntil (open-ended)
            const openEnded = matching.filter((a) => !a.effectiveUntil);
            if (openEnded.length > 0) {
              openEnded.sort((a, b) => (b.effectiveFrom || "").localeCompare(a.effectiveFrom || ""));
              matched = openEnded[0];
            } else {
              // Fallback 2: latest updated assignment
              matched = matching[0];
            }
          }
        }

        if (matched) {
          if (matched.teacherId && matched.teacherId.trim() !== "" && matched.teacherName !== "Belum Ditentukan") {
            return {
              teacherId: matched.teacherId,
              teacherName: matched.teacherName || "Guru Pengampu",
              source: "assignment",
              assignment: matched
            };
          }
          // Assignment exists but teacher not yet selected (draft/unassigned)
          return {
            teacherId: "",
            teacherName: "Belum Ditentukan",
            source: "unassigned",
            assignment: matched
          };
        }
      }
    }

    // PRIORITAS 2: Cek fallback jenjang curriculum_matrix (teacherId_vii / viii / ix)
    if (curriculumMatrixItem) {
      const normalizedGrade = String(gradeLevel || "").toUpperCase();
      const isVii = normalizedGrade.includes("VII") || normalizedGrade === "7";
      const isViii = normalizedGrade.includes("VIII") || normalizedGrade === "8";
      const isIx = normalizedGrade.includes("IX") || normalizedGrade === "9";

      if (curriculumMatrixItem.useDifferentTeachers) {
        if (isVii && curriculumMatrixItem.teacherId_vii) {
          return {
            teacherId: curriculumMatrixItem.teacherId_vii,
            teacherName: curriculumMatrixItem.teacherName_vii || "Guru Pengampu",
            source: "matrix_grade"
          };
        }
        if (isViii && curriculumMatrixItem.teacherId_viii) {
          return {
            teacherId: curriculumMatrixItem.teacherId_viii,
            teacherName: curriculumMatrixItem.teacherName_viii || "Guru Pengampu",
            source: "matrix_grade"
          };
        }
        if (isIx && curriculumMatrixItem.teacherId_ix) {
          return {
            teacherId: curriculumMatrixItem.teacherId_ix,
            teacherName: curriculumMatrixItem.teacherName_ix || "Guru Pengampu",
            source: "matrix_grade"
          };
        }
      }

      // PRIORITAS 3: Cek fallback global curriculum_matrix (teacherId)
      if (curriculumMatrixItem.teacherId) {
        return {
          teacherId: curriculumMatrixItem.teacherId,
          teacherName: curriculumMatrixItem.teacherName || "Guru Pengampu",
          source: "matrix_global"
        };
      }
    }

    // PRIORITAS 4: Belum Ditentukan
    return {
      teacherId: "",
      teacherName: "Belum Ditentukan",
      source: "unassigned"
    };
  },

  /**
   * CENTRAL TEACHER RESOLVER (Asynchronous with Firestore fallback)
   */
  async resolveTeacherAssignment(params: {
    academicYearId?: string;
    semesterId?: string;
    subjectId: string;
    classId?: string;
    gradeLevel?: "VII" | "VIII" | "IX" | string;
    date?: string; // YYYY-MM-DD
    curriculumMatrixItem?: CurriculumMatrix | null;
    preloadedAssignments?: TeacherAssignment[];
  }): Promise<{
    teacherId: string;
    teacherName: string;
    source: "assignment" | "matrix_grade" | "matrix_global" | "unassigned";
    assignment?: TeacherAssignment;
  }> {
    // 1. If preloaded assignments exist, try sync resolution first
    if (params.preloadedAssignments && params.preloadedAssignments.length > 0) {
      const syncResult = this.resolveTeacherAssignmentSync(params);
      if (syncResult.source === "assignment" || (syncResult.source === "unassigned" && syncResult.assignment)) {
        return syncResult;
      }
    }

    // 2. Direct query by academic period (preloads all assignments in period to resolve synchronously)
    if (params.academicYearId && params.semesterId && params.classId) {
      const periodAssignments = await this.getTeacherAssignmentsByPeriod(
        params.academicYearId,
        params.semesterId
      );
      const syncResult = this.resolveTeacherAssignmentSync({
        ...params,
        preloadedAssignments: periodAssignments
      });
      if (syncResult.source === "assignment" || (syncResult.source === "unassigned" && syncResult.assignment)) {
        return syncResult;
      }
    }

    // 3. Fallback to sync resolver for Priorities 2, 3, and 4
    return this.resolveTeacherAssignmentSync(params);
  },

  /**
   * UTILITY / HELPER: Synchronize / generate missing assignments from CurriculumMatrix for all classes.
   * Strictly non-destructive: SKIPS any class-subject pair that already has an assignment!
   * System does NOT guess teachers; newly provisioned assignments have teacherName: "Belum Ditentukan".
   */
  async generateAssignmentsFromCurriculumMatrix(
    academicYearId: string,
    semesterId: string,
    classes: Class[],
    curriculumMatrix: CurriculumMatrix[],
    userId: string = "system",
    userName: string = "System"
  ): Promise<{ createdCount: number; skippedCount: number }> {
    if (!academicYearId || !semesterId || !classes.length || !curriculumMatrix.length) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // 1. Preload existing assignments for this period in memory (avoid N+1 Firestore queries)
    const existing = await this.getTeacherAssignmentsByPeriod(academicYearId, semesterId);
    const existingMap = new Set(existing.map((a) => `${a.subjectId}_${a.classId}`));

    let createdCount = 0;
    let skippedCount = 0;

    const newAssignments: TeacherAssignment[] = [];
    const now = new Date().toISOString();

    for (const cls of classes) {
      if (cls.status !== "Aktif" || cls.isDeleted) continue;
      const classId = cls.id || cls.classId;
      const grade = cls.gradeLevel;

      for (const m of curriculumMatrix) {
        const key = `${m.subjectId}_${classId}`;
        // RULE: If assignment already exists, SKIP! Never overwrite existing assignments!
        if (existingMap.has(key)) {
          skippedCount++;
          continue;
        }

        const jp = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
        if (jp <= 0) continue; // Subject is not taught in this grade

        const docId = buildAssignmentDocId(academicYearId, semesterId, m.subjectId, classId);

        newAssignments.push({
          id: docId,
          academicYearId,
          semesterId,
          subjectId: m.subjectId,
          subjectName: m.subjectName,
          classId,
          className: cls.name,
          gradeLevel: grade,
          teacherId: "",
          teacherName: "Belum Ditentukan",
          isActive: true,
          effectiveFrom: null,
          effectiveUntil: null,
          notes: "Otomatis disiapkan via Sinkronisasi Matriks Kurikulum",
          createdAt: now,
          updatedAt: now,
          createdBy: userId,
          updatedBy: userId,
          createdByName: userName
        });

        existingMap.add(key);
        createdCount++;
      }
    }

    // 2. Batch write new assignments in chunks of 450 (Firestore limit is 500)
    if (newAssignments.length > 0) {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < newAssignments.length; i += CHUNK_SIZE) {
        const chunk = newAssignments.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const item of chunk) {
          const docRef = doc(db, COLLECTION_NAME, item.id!);
          batch.set(docRef, item, { merge: true });
        }
        await batch.commit();
      }

      await logActivity(
        userId,
        userName,
        "SYNC_TEACHER_ASSIGNMENTS",
        `${academicYearId}_${semesterId}`,
        `Sinkronisasi otomatis membuat ${createdCount} penugasan rombel baru (Belum Ditentukan). ${skippedCount} penugasan dilewati (sudah ada).`
      );
    }

    return { createdCount, skippedCount };
  },

  /**
   * AUTOMATION: Automatically ensure teacher_assignments exist when a new class is created.
   * Finds all subjects in curriculum_matrix with JP > 0 for this class's grade level.
   * If assignment doesn't exist, creates with teacherId: "" and teacherName: "Belum Ditentukan".
   * Never overwrites existing assignments.
   */
  async ensureAssignmentsForClass(params: {
    classObj: Class;
    academicYearId?: string;
    semesterId?: string;
    userId?: string;
    userName?: string;
  }): Promise<{ createdCount: number; skippedCount: number }> {
    const { classObj, userId = "system", userName = "System" } = params;
    const classId = classObj.id || classObj.classId;
    const gradeLevel = classObj.gradeLevel;

    if (!classId || !gradeLevel) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // Resolve period (academicYearId & semesterId)
    let academicYearId = params.academicYearId;
    let semesterId = params.semesterId;

    if (!academicYearId || !semesterId) {
      try {
        const semesters = await semesterService.getSemesters();
        const activeSem = semesters.find((s) => s.isActive) || semesters[0];
        if (activeSem) {
          academicYearId = academicYearId || activeSem.academicYearId;
          semesterId = semesterId || activeSem.id;
        }
      } catch (err) {
        console.warn("Could not retrieve active semester for class auto-assignment:", err);
      }
    }

    if (!academicYearId || !semesterId) {
      console.warn("No active academicYearId/semesterId found for ensureAssignmentsForClass");
      return { createdCount: 0, skippedCount: 0 };
    }

    // Fetch curriculum matrix
    const matrixColRef = collection(db, "curriculum_matrix");
    const matrixSnap = await getDocs(matrixColRef);
    const relevantSubjects: { subjectId: string; subjectName: string; jp: number }[] = [];

    matrixSnap.forEach((d) => {
      const data = d.data() as any;
      const jp = gradeLevel === "VII" ? (data.jp_vii || 0) : gradeLevel === "VIII" ? (data.jp_viii || 0) : (data.jp_ix || 0);
      if (jp > 0 && data.subjectId) {
        relevantSubjects.push({
          subjectId: data.subjectId,
          subjectName: data.subjectName || "",
          jp
        });
      }
    });

    if (relevantSubjects.length === 0) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // Preload existing assignments for this class & period to avoid duplicates/overwrite
    const existing = await this.getTeacherAssignmentsByPeriod(academicYearId, semesterId);
    const existingKeys = new Set(existing.map((a) => `${a.subjectId}_${a.classId}`));

    let createdCount = 0;
    let skippedCount = 0;
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    for (const subj of relevantSubjects) {
      const key = `${subj.subjectId}_${classId}`;
      if (existingKeys.has(key)) {
        skippedCount++;
        continue;
      }

      const docId = buildAssignmentDocId(academicYearId, semesterId, subj.subjectId, classId);
      const docRef = doc(db, COLLECTION_NAME, docId);

      const payload: TeacherAssignment = {
        id: docId,
        academicYearId,
        semesterId,
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        classId,
        className: classObj.name,
        gradeLevel,
        teacherId: "",
        teacherName: "Belum Ditentukan",
        isActive: true,
        effectiveFrom: null,
        effectiveUntil: null,
        notes: "Otomatis dibuat saat penambahan rombel baru",
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        createdByName: userName
      };

      batch.set(docRef, payload, { merge: true });
      existingKeys.add(key);
      createdCount++;
    }

    if (createdCount > 0) {
      await batch.commit();
      await logActivity(
        userId,
        userName,
        "AUTO_ASSIGN_NEW_CLASS",
        classId,
        `Otomatis menyiapkan ${createdCount} penugasan mata pelajaran (Belum Ditentukan) untuk kelas baru "${classObj.name}".`
      );
    }

    return { createdCount, skippedCount };
  },

  /**
   * AUTOMATION: Automatically ensure teacher_assignments exist when JP is added/updated for a grade in curriculum_matrix.
   * Detects all active classes in that grade level.
   * For any missing assignment, creates with teacherId: "" and teacherName: "Belum Ditentukan".
   * Never overwrites existing assignments.
   */
  async ensureAssignmentsForSubjectJP(params: {
    subjectId: string;
    subjectName: string;
    gradeLevel: "VII" | "VIII" | "IX";
    academicYearId?: string;
    semesterId?: string;
    userId?: string;
    userName?: string;
  }): Promise<{ createdCount: number; skippedCount: number }> {
    const { subjectId, subjectName, gradeLevel, userId = "system", userName = "System" } = params;

    if (!subjectId || !gradeLevel) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // Resolve period
    let academicYearId = params.academicYearId;
    let semesterId = params.semesterId;

    if (!academicYearId || !semesterId) {
      try {
        const semesters = await semesterService.getSemesters();
        const activeSem = semesters.find((s) => s.isActive) || semesters[0];
        if (activeSem) {
          academicYearId = academicYearId || activeSem.academicYearId;
          semesterId = semesterId || activeSem.id;
        }
      } catch (err) {
        console.warn("Could not retrieve active semester for subject JP auto-assignment:", err);
      }
    }

    if (!academicYearId || !semesterId) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // Fetch active classes for this grade level
    const classColRef = collection(db, "classes");
    const classSnap = await getDocs(classColRef);
    const targetClasses: Class[] = [];

    classSnap.forEach((d) => {
      const data = d.data() as any;
      if (data.isDeleted !== true && data.status !== "Nonaktif") {
        const clsGrade = String(data.gradeLevel || "").toUpperCase();
        const clsName = String(data.name || "").toUpperCase();
        const isMatch = clsGrade === gradeLevel || 
          (gradeLevel === "VII" && (clsName.includes("7") || clsName.includes("VII"))) ||
          (gradeLevel === "VIII" && (clsName.includes("8") || clsName.includes("VIII"))) ||
          (gradeLevel === "IX" && (clsName.includes("9") || clsName.includes("IX")));

        if (isMatch) {
          targetClasses.push({
            id: d.id,
            classId: d.id,
            name: data.name,
            gradeLevel: gradeLevel,
            status: data.status,
            ...data
          } as Class);
        }
      }
    });

    if (targetClasses.length === 0) {
      return { createdCount: 0, skippedCount: 0 };
    }

    // Preload existing assignments for this period
    const existing = await this.getTeacherAssignmentsByPeriod(academicYearId, semesterId);
    const existingKeys = new Set(existing.map((a) => `${a.subjectId}_${a.classId}`));

    let createdCount = 0;
    let skippedCount = 0;
    const now = new Date().toISOString();
    const batch = writeBatch(db);

    for (const cls of targetClasses) {
      const classId = cls.id || cls.classId;
      const key = `${subjectId}_${classId}`;
      if (existingKeys.has(key)) {
        skippedCount++;
        continue;
      }

      const docId = buildAssignmentDocId(academicYearId, semesterId, subjectId, classId);
      const docRef = doc(db, COLLECTION_NAME, docId);

      const payload: TeacherAssignment = {
        id: docId,
        academicYearId,
        semesterId,
        subjectId,
        subjectName,
        classId,
        className: cls.name,
        gradeLevel,
        teacherId: "",
        teacherName: "Belum Ditentukan",
        isActive: true,
        effectiveFrom: null,
        effectiveUntil: null,
        notes: "Otomatis dibuat saat penambahan JP struktur kurikulum",
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
        createdByName: userName
      };

      batch.set(docRef, payload, { merge: true });
      existingKeys.add(key);
      createdCount++;
    }

    if (createdCount > 0) {
      await batch.commit();
      await logActivity(
        userId,
        userName,
        "AUTO_ASSIGN_SUBJECT_JP",
        subjectId,
        `Otomatis menyiapkan ${createdCount} penugasan untuk mapel "${subjectName}" (Tingkat ${gradeLevel}).`
      );
    }

    return { createdCount, skippedCount };
  },

  /**
   * Alias for createTeacherAssignment (upsert)
   */
  async setTeacherAssignment(
    data: Omit<TeacherAssignment, "id" | "createdAt" | "updatedAt">,
    userId: string = "system",
    userName: string = "System"
  ): Promise<TeacherAssignment> {
    return this.createTeacherAssignment(data, userId, userName);
  },

  buildAssignmentDocId(
    academicYearId: string,
    semesterId: string,
    subjectId: string,
    classId: string
  ): string {
    return buildAssignmentDocId(academicYearId, semesterId, subjectId, classId);
  }
};

export const resolveTeacherAssignmentSync = teacherAssignmentService.resolveTeacherAssignmentSync.bind(teacherAssignmentService);
export const resolveTeacherAssignment = teacherAssignmentService.resolveTeacherAssignment.bind(teacherAssignmentService);
export const transitionTeacherAssignment = teacherAssignmentService.transitionTeacherAssignment.bind(teacherAssignmentService);
