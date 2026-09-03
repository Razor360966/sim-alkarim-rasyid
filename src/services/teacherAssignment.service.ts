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
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { TeacherAssignment, CurriculumMatrix, Class } from "../types";

const COLLECTION_NAME = "teacher_assignments";

/**
 * Builds a deterministic, safe document ID for an assignment
 * based on Academic Year, Semester, Subject, and Class
 */
export function buildAssignmentDocId(
  academicYearId: string,
  semesterId: string,
  subjectId: string,
  classId: string
): string {
  const safeYear = academicYearId.replace(/[\/\s\.]/g, "-");
  const safeSem = semesterId.replace(/[\/\s\.]/g, "-");
  const safeSub = subjectId.replace(/[\/\s\.]/g, "-");
  const safeClass = classId.replace(/[\/\s\.]/g, "-");
  return `${safeYear}_${safeSem}_${safeSub}_${safeClass}`;
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
   * CENTRAL TEACHER RESOLVER (Synchronous with preloaded assignments)
   * Resolves the teacher strictly following the 4-tier priority hierarchy:
   * 1. Priority 1: Active Teacher Assignment for (academicYearId + semesterId + subjectId + classId)
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
      curriculumMatrixItem,
      preloadedAssignments = []
    } = params;

    // PRIORITAS 1: Cek teacher_assignments aktif
    if (classId && preloadedAssignments.length > 0) {
      const matched = preloadedAssignments.find((a) => {
        const matchesSubject = a.subjectId === subjectId;
        const matchesClass = a.classId === classId;
        const matchesActive = a.isActive !== false;
        const matchesYear = !academicYearId || !a.academicYearId || a.academicYearId === academicYearId;
        const matchesSem = !semesterId || !a.semesterId || a.semesterId === semesterId;
        return matchesSubject && matchesClass && matchesActive && matchesYear && matchesSem;
      });

      if (matched && matched.teacherId) {
        return {
          teacherId: matched.teacherId,
          teacherName: matched.teacherName || "Guru Pengampu",
          source: "assignment",
          assignment: matched
        };
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
      if (syncResult.source === "assignment") {
        return syncResult;
      }
    }

    // 2. Query Firestore directly for the specific assignment if classId is provided
    if (params.academicYearId && params.semesterId && params.subjectId && params.classId) {
      const directAssignment = await this.getTeacherAssignmentsBySubjectAndClass(
        params.academicYearId,
        params.semesterId,
        params.subjectId,
        params.classId
      );

      if (directAssignment && directAssignment.isActive !== false && directAssignment.teacherId) {
        return {
          teacherId: directAssignment.teacherId,
          teacherName: directAssignment.teacherName || "Guru Pengampu",
          source: "assignment",
          assignment: directAssignment
        };
      }
    }

    // 3. Fallback to sync resolver for Priorities 2, 3, and 4
    return this.resolveTeacherAssignmentSync(params);
  },

  /**
   * UTILITY / HELPER: Generate initial assignments from legacy CurriculumMatrix
   * (Does NOT run automatically on database. Can be triggered safely by Admin UI)
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

    // Fetch existing assignments to avoid overwriting existing customized assignments
    const existing = await this.getTeacherAssignmentsByPeriod(academicYearId, semesterId);
    const existingMap = new Set(existing.map((a) => `${a.subjectId}_${a.classId}`));

    let createdCount = 0;
    let skippedCount = 0;

    for (const cls of classes) {
      const classId = cls.id || cls.classId;
      const grade = cls.gradeLevel;

      for (const m of curriculumMatrix) {
        const key = `${m.subjectId}_${classId}`;
        if (existingMap.has(key)) {
          skippedCount++;
          continue;
        }

        const jp = grade === "VII" ? m.jp_vii : grade === "VIII" ? m.jp_viii : m.jp_ix;
        if (jp <= 0) continue; // Subject is not taught in this grade

        let teacherId = "";
        let teacherName = "";

        if (m.useDifferentTeachers) {
          if (grade === "VII") {
            teacherId = m.teacherId_vii || m.teacherId || "";
            teacherName = m.teacherName_vii || m.teacherName || "";
          } else if (grade === "VIII") {
            teacherId = m.teacherId_viii || m.teacherId || "";
            teacherName = m.teacherName_viii || m.teacherName || "";
          } else if (grade === "IX") {
            teacherId = m.teacherId_ix || m.teacherId || "";
            teacherName = m.teacherName_ix || m.teacherName || "";
          }
        } else {
          teacherId = m.teacherId || "";
          teacherName = m.teacherName || "";
        }

        if (teacherId) {
          await this.createTeacherAssignment(
            {
              academicYearId,
              semesterId,
              subjectId: m.subjectId,
              subjectName: m.subjectName,
              classId,
              className: cls.name,
              gradeLevel: grade,
              teacherId,
              teacherName,
              isActive: true
            },
            userId,
            userName
          );
          createdCount++;
        } else {
          skippedCount++;
        }
      }
    }

    return { createdCount, skippedCount };
  }
};
