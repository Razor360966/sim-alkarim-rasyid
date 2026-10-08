/**
 * learningDesignRpm.service.ts
 * 
 * Service Layer for Rancangan Pembelajaran (RPM)
 * SIMAK SMP ALKARIM RASYID
 * 
 * Rules:
 * - Domain is strictly isolated in Firestore collection: "learning_designs_rpm"
 * - Document ID is deterministic based on context: ${academicYearId}_${semesterId}_${classId}_${subjectId}_${topicId}
 * - TopicId is the primary curriculum anchor; prosemMeetingId is optional context reference
 * - Identity context is strictly immutable once created
 * - Read-only dependency on Prota/Prosem; never mutates Prota/Prosem/Journals/Schedules/Progress
 * - Anti-N+1: Provides single-query context fetching with Map<topicId, LearningDesignRpm> indexing
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import {
  LearningDesignRpm,
  RpmMeetingPlan,
  RpmStatus,
  RpmContextFilter,
  RpmValidationResult,
  RpmMonitoringSummary
} from "../types/learningDesignRpm.types";
import { AnnualProgram } from "../types/curriculumPlanning.types";

export const RPM_COLLECTION = "learning_designs_rpm";
const LOG_COLLECTION = "activity_logs";

/**
 * Builds a deterministic, Firestore-safe document ID for an RPM.
 * Format: ${academicYearId}_${semesterId}_${classId}_${subjectId}_${topicId}
 */
export function buildRpmDocId(
  academicYearId: string,
  semesterId: string,
  classId: string,
  subjectId: string,
  topicId: string
): string {
  const sanitizePart = (val: string): string => {
    if (!val) return "UNKNOWN";
    const cleaned = String(val)
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned || "UNKNOWN";
  };

  const safeYear = sanitizePart(academicYearId);
  const safeSem = sanitizePart(semesterId);
  const safeClass = sanitizePart(classId);
  const safeSub = sanitizePart(subjectId);
  const safeTopic = sanitizePart(topicId);

  return `${safeYear}_${safeSem}_${safeClass}_${safeSub}_${safeTopic}`;
}

/**
 * Validates that immutable identity fields are not modified during an update.
 * Throws Error if any immutable field is modified.
 */
export function validateRpmIdentity(
  existing: LearningDesignRpm,
  incoming: Partial<LearningDesignRpm>
): void {
  const immutableFields: (keyof LearningDesignRpm)[] = [
    "academicYearId",
    "semesterId",
    "classId",
    "subjectId",
    "topicId"
  ];

  for (const field of immutableFields) {
    if (incoming[field] !== undefined && incoming[field] !== null) {
      if (String(incoming[field]).trim() !== String(existing[field]).trim()) {
        throw new Error(
          `RPM Identity Violation: Cannot mutate immutable field '${field}' (existing: '${existing[field]}', incoming: '${incoming[field]}'). Create a new RPM for a different topic or context.`
        );
      }
    }
  }

  if (incoming.id !== undefined && incoming.id !== null) {
    if (incoming.id !== existing.id) {
      throw new Error(
        `RPM Identity Violation: Document ID mismatch (existing: '${existing.id}', incoming: '${incoming.id}').`
      );
    }
  }
}

/**
 * Validates a single meeting plan item.
 */
export function validateMeetingPlan(
  plan: RpmMeetingPlan,
  index?: number
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = index !== undefined ? `Meeting Plan #${index + 1}` : "Meeting Plan";

  if (typeof plan.meetingNo !== "number" || plan.meetingNo <= 0) {
    errors.push(`${prefix}: meetingNo must be a positive integer greater than 0.`);
  }

  if (typeof plan.allocatedJP !== "number" || plan.allocatedJP <= 0) {
    errors.push(`${prefix}: allocatedJP must be a positive number greater than 0.`);
  }

  if (!plan.learningObjective || plan.learningObjective.trim() === "") {
    errors.push(`${prefix}: learningObjective (Tujuan Pembelajaran) is mandatory.`);
  }

  if (!plan.modelOrMethod || plan.modelOrMethod.trim() === "") {
    errors.push(`${prefix}: modelOrMethod (Model/Metode Pembelajaran) is mandatory.`);
  }

  if (!plan.activitiesOverview || !plan.activitiesOverview.core || plan.activitiesOverview.core.trim() === "") {
    errors.push(`${prefix}: activitiesOverview.core (Kegiatan Inti) is mandatory.`);
  }

  return { errors, warnings };
}

/**
 * Validates topicId presence and optional reference against Prota.
 */
export function validateTopic(
  topicId: string,
  prota?: AnnualProgram | null
): { isValid: boolean; error?: string } {
  if (!topicId || topicId.trim() === "") {
    return { isValid: false, error: "topicId is mandatory for RPM." };
  }

  if (prota && prota.topics) {
    const exists = prota.topics.some(t => t.id === topicId.trim());
    if (!exists) {
      return {
        isValid: false,
        error: `topicId '${topicId}' was not found in Annual Program (Prota) topics for class ${prota.className || prota.classId} and subject ${prota.subjectName || prota.subjectId}.`
      };
    }
  }

  return { isValid: true };
}

/**
 * Comprehensive payload validation for RPM create / update.
 */
export function validateRpmPayload(
  payload: Partial<LearningDesignRpm>,
  isCreate: boolean = false
): RpmValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isCreate) {
    if (!payload.academicYearId?.trim()) errors.push("academicYearId is required.");
    if (!payload.semesterId?.trim()) errors.push("semesterId is required.");
    if (!payload.classId?.trim()) errors.push("classId is required.");
    if (!payload.subjectId?.trim()) errors.push("subjectId is required.");
    if (!payload.teacherId?.trim()) errors.push("teacherId is required.");
    if (!payload.topicId?.trim()) errors.push("topicId is required.");
  }

  // Validate topic if provided
  if (payload.topicId !== undefined) {
    const topicRes = validateTopic(payload.topicId);
    if (!topicRes.isValid && topicRes.error) {
      errors.push(topicRes.error);
    }
  }

  // Validate meetingPlans
  if (payload.meetingPlans !== undefined) {
    if (!Array.isArray(payload.meetingPlans) || payload.meetingPlans.length === 0) {
      errors.push("RPM must have at least one meetingPlan in meetingPlans array.");
    } else {
      const seenMeetingNos = new Set<number>();
      let totalAllocatedJP = 0;

      payload.meetingPlans.forEach((plan, idx) => {
        const planRes = validateMeetingPlan(plan, idx);
        errors.push(...planRes.errors);
        warnings.push(...planRes.warnings);

        if (seenMeetingNos.has(plan.meetingNo)) {
          errors.push(`Duplicate meetingNo '${plan.meetingNo}' found in meetingPlans array.`);
        }
        seenMeetingNos.add(plan.meetingNo);

        if (typeof plan.allocatedJP === "number") {
          totalAllocatedJP += plan.allocatedJP;
        }
      });

      // Target JP comparison warning (non-fatal, does NOT alter Prosem)
      if (typeof payload.totalTargetJP === "number" && payload.totalTargetJP > 0) {
        if (totalAllocatedJP !== payload.totalTargetJP) {
          warnings.push(
            `Total allocated JP in meeting plans (${totalAllocatedJP} JP) does not match totalTargetJP (${payload.totalTargetJP} JP). This is a planning discrepancy warning.`
          );
        }
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Removes undefined fields from objects/arrays to satisfy Firestore validation constraints.
 */
export function sanitizeRpmPayload<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeRpmPayload(item)) as unknown as T;
  } else if (obj !== null && typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val !== undefined) {
        cleaned[key] = sanitizeRpmPayload(val);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Logs activity trail for RPM operations.
 */
async function logRpmActivity(
  userId: string,
  userName: string,
  action: string,
  rpmId: string,
  description: string
): Promise<void> {
  if (!db || !userId) return;
  try {
    const logsRef = collection(db, LOG_COLLECTION);
    await addDoc(logsRef, {
      userId,
      userName: userName || "User",
      action,
      collection: RPM_COLLECTION,
      documentId: rpmId,
      description,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Failed to write RPM activity log:", error);
  }
}

export const learningDesignRpmService = {
  /**
   * Retrieves an RPM document by its canonical Document ID.
   */
  async getRpmById(id: string): Promise<LearningDesignRpm | null> {
    if (!id || !db) return null;
    try {
      const docRef = doc(db, RPM_COLLECTION, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as LearningDesignRpm;
      }
      return null;
    } catch (error) {
      return handleFirestoreError(error, OperationType.GET, `${RPM_COLLECTION}/${id}`);
    }
  },

  /**
   * Retrieves an RPM document by exact topic context using deterministic ID.
   */
  async getRpmByTopic(
    academicYearId: string,
    semesterId: string,
    classId: string,
    subjectId: string,
    topicId: string
  ): Promise<LearningDesignRpm | null> {
    const canonicalId = buildRpmDocId(academicYearId, semesterId, classId, subjectId, topicId);
    return this.getRpmById(canonicalId);
  },

  /**
   * Retrieves all RPMs for a specific academic context (Year, Semester, Class, Subject).
   * Single query to avoid N+1 queries.
   */
  async getRpmsByContext(filter: RpmContextFilter): Promise<LearningDesignRpm[]> {
    if (!db) return [];
    try {
      const colRef = collection(db, RPM_COLLECTION);
      let q = query(
        colRef,
        where("academicYearId", "==", filter.academicYearId),
        where("semesterId", "==", filter.semesterId),
        where("classId", "==", filter.classId),
        where("subjectId", "==", filter.subjectId)
      );

      if (filter.teacherId) {
        q = query(q, where("teacherId", "==", filter.teacherId));
      }

      const snap = await getDocs(q);
      const items: LearningDesignRpm[] = [];
      snap.forEach(d => {
        items.push({ id: d.id, ...d.data() } as LearningDesignRpm);
      });

      // Sort by topicOrder if available, or topicTitle
      items.sort((a, b) => {
        const orderA = a.topicOrder ?? 999;
        const orderB = b.topicOrder ?? 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.topicTitle || "").localeCompare(b.topicTitle || "");
      });

      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, RPM_COLLECTION);
    }
  },

  /**
   * Retrieves all RPMs for a context as a Map<topicId, LearningDesignRpm>.
   * Primary anti-N+1 access pattern for screens and batch evaluators.
   */
  async getRpmsMapByContext(filter: {
    academicYearId: string;
    semesterId: string;
    classId: string;
    subjectId: string;
  }): Promise<Map<string, LearningDesignRpm>> {
    const list = await this.getRpmsByContext(filter);
    const map = new Map<string, LearningDesignRpm>();
    list.forEach(rpm => {
      if (rpm.topicId) {
        map.set(rpm.topicId, rpm);
      }
    });
    return map;
  },

  /**
   * Creates a new RPM document with deterministic ID and strict identity validation.
   * Throws Error if duplicate RPM already exists for the topic context.
   * Non-approvers cannot directly create RPM as DISETUJUI.
   */
  async createRpm(
    data: Omit<LearningDesignRpm, "id" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">,
    userId: string,
    userName: string,
    options?: { isApprover?: boolean }
  ): Promise<LearningDesignRpm> {
    const isApprover = options?.isApprover ?? false;

    // Enforce approval rule: Non-approvers cannot directly create as DISETUJUI
    if (!isApprover && data.status === "DISETUJUI") {
      throw new Error(
        "Guru tidak berwenang langsung membuat RPM berstatus DISETUJUI. Silakan simpan sebagai DRAFT atau ajukan sebagai DITINJAU."
      );
    }

    const validation = validateRpmPayload(data, true);
    if (!validation.isValid) {
      throw new Error(`Validation failed for RPM creation:\n- ${validation.errors.join("\n- ")}`);
    }

    const canonicalId = buildRpmDocId(
      data.academicYearId,
      data.semesterId,
      data.classId,
      data.subjectId,
      data.topicId
    );

    const docRef = doc(db, RPM_COLLECTION, canonicalId);
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      throw new Error(
        `Duplicate RPM Error: An RPM document already exists for context ID '${canonicalId}'. Use updateRpm() to modify the existing learning design.`
      );
    }

    const now = new Date().toISOString();
    const targetStatus: RpmStatus = data.status || "DRAFT";

    // Non-approvers cannot populate approvedBy or approvedAt on create
    const approvedBy = isApprover && targetStatus === "DISETUJUI" ? userId : undefined;
    const approvedAt = isApprover && targetStatus === "DISETUJUI" ? now : undefined;

    const newRpm: LearningDesignRpm = {
      ...data,
      id: canonicalId,
      status: targetStatus,
      approvedBy,
      approvedAt,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId
    };

    const sanitized = sanitizeRpmPayload(newRpm);
    try {
      await setDoc(docRef, sanitized);
      await logRpmActivity(
        userId,
        userName,
        "CREATE_RPM",
        canonicalId,
        `Membuat Rancangan Pembelajaran (RPM) Topik '${data.topicTitle}' (Kelas ${data.className}, Mapel ${data.subjectName})`
      );
      return newRpm;
    } catch (error) {
      return handleFirestoreError(error, OperationType.CREATE, `${RPM_COLLECTION}/${canonicalId}`);
    }
  },

  /**
   * Updates an existing RPM document.
   * Enforces:
   * 1. Identity immutability and payload validation.
   * 2. Self-Approval block (Guru cannot approve their own RPM).
   * 3. Role authorization for DISETUJUI status.
   * 4. Approved RPM Edit Rule: Editing an already approved RPM by a teacher automatically
   *    reverts status to DRAFT and invalidates approvedBy & approvedAt.
   */
  async updateRpm(
    id: string,
    updates: Partial<LearningDesignRpm>,
    userId: string,
    userName: string,
    options?: { isApprover?: boolean }
  ): Promise<LearningDesignRpm> {
    if (!id || !db) {
      throw new Error("RPM ID is required for update.");
    }

    const docRef = doc(db, RPM_COLLECTION, id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error(`RPM document with ID '${id}' does not exist.`);
    }

    const existing = { id: snap.id, ...snap.data() } as LearningDesignRpm;
    const isApprover = options?.isApprover ?? false;

    // Strict identity immutability check
    validateRpmIdentity(existing, updates);

    // Validate meetingPlans if updating them
    if (updates.meetingPlans !== undefined) {
      const validation = validateRpmPayload({ ...existing, ...updates }, false);
      if (!validation.isValid) {
        throw new Error(`Validation failed for RPM update:\n- ${validation.errors.join("\n- ")}`);
      }
    }

    const now = new Date().toISOString();
    let finalStatus: RpmStatus = updates.status || existing.status;
    let finalApprovedBy = updates.approvedBy !== undefined ? updates.approvedBy : existing.approvedBy;
    let finalApprovedAt = updates.approvedAt !== undefined ? updates.approvedAt : existing.approvedAt;
    let finalReviewNotes = updates.reviewNotes !== undefined ? updates.reviewNotes : existing.reviewNotes;

    // Rule 1: Approval attempt
    if (updates.status === "DISETUJUI") {
      if (!isApprover) {
        throw new Error(
          "Guru tidak berwenang mengubah status menjadi DISETUJUI. Hanya Waka Kurikulum / Pimpinan yang berwenang menyetujui RPM."
        );
      }

      // Self-approval check: User cannot approve their own RPM
      const isCreator = existing.createdBy && userId === existing.createdBy;
      const isTeacherOwner = existing.teacherId && (userId === existing.teacherId || userId === existing.createdBy);
      if (isCreator || isTeacherOwner) {
        throw new Error(
          "Persetujuan mandiri (Self-Approval) dilarang. Guru tidak dapat menyetujui RPM rancangan sendiri."
        );
      }

      finalStatus = "DISETUJUI";
      finalApprovedBy = userId;
      finalApprovedAt = now;
    }

    // Rule 2: Approved RPM Edit Rule
    // If RPM was DISETUJUI and is now being modified by a teacher (or non-approver, or meeting plans are changed)
    if (existing.status === "DISETUJUI" && updates.status !== "DISETUJUI") {
      // Revert to DRAFT and invalidate approvals
      finalStatus = "DRAFT";
      finalApprovedBy = undefined;
      finalApprovedAt = undefined;
      finalReviewNotes = existing.reviewNotes
        ? `[Revisi Pasca-Persetujuan oleh ${userName} pada ${now}]: Status kembali ke DRAFT. Menunggu peninjauan & persetujuan ulang.`
        : `Status kembali ke DRAFT setelah diedit pada ${now}. Menunggu peninjauan & persetujuan ulang.`;
    } else if (existing.status === "DISETUJUI" && !isApprover) {
      // Even if updates didn't specify status, teacher edit automatically reverts to DRAFT
      finalStatus = "DRAFT";
      finalApprovedBy = undefined;
      finalApprovedAt = undefined;
      finalReviewNotes = `[Revisi Pasca-Persetujuan oleh Guru]: Status kembali ke DRAFT. Menunggu peninjauan & persetujuan ulang.`;
    }

    // Rule 3: If status is DRAFT or DITINJAU, approvedBy and approvedAt must be cleared
    if (finalStatus !== "DISETUJUI") {
      finalApprovedBy = undefined;
      finalApprovedAt = undefined;
    }

    const updatedData: LearningDesignRpm = {
      ...existing,
      ...updates,
      id: existing.id,
      academicYearId: existing.academicYearId,
      semesterId: existing.semesterId,
      classId: existing.classId,
      subjectId: existing.subjectId,
      topicId: existing.topicId,
      status: finalStatus,
      approvedBy: finalApprovedBy,
      approvedAt: finalApprovedAt,
      reviewNotes: finalReviewNotes,
      updatedAt: now,
      updatedBy: userId
    };

    const sanitized = sanitizeRpmPayload(updatedData);
    try {
      await setDoc(docRef, sanitized);
      await logRpmActivity(
        userId,
        userName,
        "UPDATE_RPM",
        id,
        `Memperbarui Rancangan Pembelajaran (RPM) Topik '${existing.topicTitle}' (Status: ${finalStatus})`
      );
      return updatedData;
    } catch (error) {
      return handleFirestoreError(error, OperationType.UPDATE, `${RPM_COLLECTION}/${id}`);
    }
  },

  /**
   * Guru submits an RPM for review (DRAFT -> DITINJAU).
   */
  async submitRpm(id: string, userId: string, userName: string): Promise<LearningDesignRpm> {
    return this.updateRpm(
      id,
      {
        status: "DITINJAU"
      },
      userId,
      userName,
      { isApprover: false }
    );
  },

  /**
   * Authorized Approver (Waka Kurikulum / Kepala Sekolah) approves an RPM (DITINJAU -> DISETUJUI).
   * Enforces self-approval block and stamps approvedBy (stable userId) and approvedAt (ISO timestamp).
   */
  async approveRpm(
    id: string,
    userId: string,
    userName: string,
    reviewNotes?: string
  ): Promise<LearningDesignRpm> {
    return this.updateRpm(
      id,
      {
        status: "DISETUJUI",
        reviewNotes: reviewNotes || "Disetujui oleh Waka Kurikulum / Pimpinan."
      },
      userId,
      userName,
      { isApprover: true }
    );
  },

  /**
   * Authorized Approver returns an RPM to DRAFT for teacher revision.
   */
  async returnToDraft(
    id: string,
    userId: string,
    userName: string,
    reviewNotes: string
  ): Promise<LearningDesignRpm> {
    return this.updateRpm(
      id,
      {
        status: "DRAFT",
        reviewNotes: reviewNotes || "Dikembalikan untuk revisi rencana pembelajaran."
      },
      userId,
      userName,
      { isApprover: true }
    );
  },

  /**
   * Helper for monitoring readiness:
   * Aggregates RPM availability & status for an array of curriculum topics.
   * Pure in-memory calculation (0 queries, 0 writes).
   * NOTE: plannedJP is informational only (NOT targetJP, NOT realizedJP).
   */
  getRpmMonitoringSummariesByContext(
    rpmsMap: Map<string, LearningDesignRpm>,
    topics: { id: string; title: string }[]
  ): RpmMonitoringSummary[] {
    return topics.map(t => {
      const rpm = rpmsMap.get(t.id);
      if (!rpm) {
        return {
          topicId: t.id,
          topicTitle: t.title,
          isRpmAvailable: false,
          status: "BELUM_TERSEDIA",
          meetingPlansCount: 0,
          plannedJP: 0
        };
      }

      const plannedJP = (rpm.meetingPlans || []).reduce(
        (sum, p) => sum + (p.allocatedJP || 0),
        0
      );

      return {
        topicId: t.id,
        topicTitle: rpm.topicTitle || t.title,
        isRpmAvailable: true,
        status: rpm.status,
        meetingPlansCount: (rpm.meetingPlans || []).length,
        plannedJP,
        approvedBy: rpm.approvedBy,
        approvedAt: rpm.approvedAt,
        reviewNotes: rpm.reviewNotes
      };
    });
  },

  /**
   * Deletes an RPM document.
   */
  async deleteRpm(id: string, userId: string, userName: string): Promise<void> {
    if (!id || !db) {
      throw new Error("RPM ID is required for delete.");
    }

    try {
      const docRef = doc(db, RPM_COLLECTION, id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as LearningDesignRpm;
        await deleteDoc(docRef);
        await logRpmActivity(
          userId,
          userName,
          "DELETE_RPM",
          id,
          `Menghapus Rancangan Pembelajaran (RPM) Topik '${data.topicTitle}' (Kelas ${data.className}, Mapel ${data.subjectName})`
        );
      }
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${RPM_COLLECTION}/${id}`);
    }
  }
};
