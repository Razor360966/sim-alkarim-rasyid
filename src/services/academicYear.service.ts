import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy,
  where,
  writeBatch,
  addDoc,
  serverTimestamp,
  Timestamp,
  getDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { AcademicYear } from "../types";

const COLLECTION_NAME = "academic_years";

// Helper to write to activity_logs
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
    console.error("Failed to write activity log:", error);
  }
}

// Helper to deactivate all semesters of specific academic year IDs
async function deactivateSemestersForYears(yearIds: string[], userId: string) {
  if (!yearIds || yearIds.length === 0) return;
  try {
    const semColRef = collection(db, "semesters");
    const batch = writeBatch(db);
    let hasUpdates = false;

    const qSnap = await getDocs(semColRef);
    qSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (
        data.isDeleted !== true &&
        data.isActive === true &&
        yearIds.includes(data.academicYearId)
      ) {
        batch.update(doc(db, "semesters", docSnap.id), {
          isActive: false,
          updatedAt: serverTimestamp(),
          updatedBy: userId
        });
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      await batch.commit();
    }
  } catch (err) {
    console.error("Failed to cascade deactivate semesters:", err);
  }
}

// Convert firestore timestamp or anything to YYYY-MM-DD string
function toDateString(val: any): string {
  if (!val) return "";
  if (val instanceof Timestamp) {
    return val.toDate().toISOString().split("T")[0];
  }
  if (val.toDate && typeof val.toDate === "function") {
    return val.toDate().toISOString().split("T")[0];
  }
  if (val instanceof Date) {
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    return val.split("T")[0];
  }
  return "";
}

// Convert standard string/Date to Firestore Timestamp
function toFirestoreTimestamp(val: any): Timestamp {
  if (val instanceof Timestamp) return val;
  if (val instanceof Date) return Timestamp.fromDate(val);
  if (typeof val === "string") {
    return Timestamp.fromDate(new Date(val));
  }
  return Timestamp.now();
}

export const academicYearService = {
  // Get all active academic years (non-deleted)
  async getAcademicYears(): Promise<AcademicYear[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy("name", "desc"));
    try {
      const querySnapshot = await getDocs(q);
      const items: AcademicYear[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted !== true) {
          items.push({
            id: doc.id,
            academicYearId: doc.id,
            name: data.name || data.year || "",
            year: data.name || data.year || "", // compatibility
            semester: data.semester || "Ganjil", // compatibility
            startDate: toDateString(data.startDate) || new Date().toISOString().split("T")[0],
            endDate: toDateString(data.endDate) || new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0],
            isActive: data.isActive || false,
            createdAt: toDateString(data.createdAt),
            updatedAt: toDateString(data.updatedAt),
            createdBy: data.createdBy || "",
            updatedBy: data.updatedBy || "",
            isDeleted: data.isDeleted || false,
            deletedAt: data.deletedAt ? toDateString(data.deletedAt) : null,
            deletedBy: data.deletedBy || null
          } as AcademicYear);
        }
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Get active academic year
  async getActiveAcademicYear(): Promise<AcademicYear | null> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, where("isActive", "==", true));
    try {
      const querySnapshot = await getDocs(q);
      // Filter out deleted in-memory just in case
      const activeDocs = querySnapshot.docs.filter(d => d.data().isDeleted !== true);
      
      if (activeDocs.length > 0) {
        const docSnap = activeDocs[0];
        const data = docSnap.data();
        return {
          id: docSnap.id,
          academicYearId: docSnap.id,
          name: data.name || data.year || "",
          year: data.name || data.year || "",
          semester: data.semester || "Ganjil",
          startDate: toDateString(data.startDate),
          endDate: toDateString(data.endDate),
          isActive: data.isActive,
          createdAt: toDateString(data.createdAt),
          updatedAt: toDateString(data.updatedAt)
        } as AcademicYear;
      }
      return null;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Create new Academic Year with strict validation
  async createAcademicYear(
    data: {
      name?: string;
      year?: string; // fallback
      startDate?: string;
      endDate?: string;
      isActive: boolean;
      semester?: "Ganjil" | "Genap";
    },
    userId: string = "system",
    userName: string = "System"
  ): Promise<AcademicYear> {
    const colRef = collection(db, COLLECTION_NAME);

    const yearName = (data.name || data.year || "").trim();
    if (!yearName) {
      throw new Error("Nama tahun pelajaran wajib diisi!");
    }

    // 1. Validate name format YYYY/YYYY (e.g. 2025/2026)
    const formatRegex = /^\d{4}\/\d{4}$/;
    if (!formatRegex.test(yearName)) {
      throw new Error(`Format Tahun Ajaran "${yearName}" tidak valid! Harus berformat YYYY/YYYY (contoh: 2025/2026)`);
    }

    // Fallbacks for start/end dates if not specified
    const currentYear = parseInt(yearName.split("/")[0]) || new Date().getFullYear();
    const fallbackStart = `${currentYear}-07-01`;
    const fallbackEnd = `${currentYear + 1}-06-30`;

    const startStr = data.startDate || fallbackStart;
    const endStr = data.endDate || fallbackEnd;

    // 2. Validate startDate < endDate
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start >= end) {
      throw new Error("Tanggal Mulai harus lebih awal daripada Tanggal Selesai!");
    }

    try {
      // 3. Validate unique name (excluding soft deleted)
      const querySnapshot = await getDocs(colRef);
      const activeYears: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.isDeleted !== true) {
          activeYears.push(d);
        }
      });

      const isDuplicate = activeYears.some(
        (y) => y.name.trim().toLowerCase() === yearName.toLowerCase()
      );

      if (isDuplicate) {
        throw new Error(`Tahun Pelajaran "${yearName}" sudah ada dalam sistem!`);
      }

      const newDocRef = doc(colRef);
      const id = newDocRef.id;

      const batch = writeBatch(db);

      // If set to active, deactivate all other non-deleted academic years
      const deactivatedYearIds: string[] = [];
      if (data.isActive) {
        querySnapshot.forEach((document) => {
          if (document.id !== id && document.data().isActive === true && document.data().isDeleted !== true) {
            deactivatedYearIds.push(document.id);
            batch.update(doc(db, COLLECTION_NAME, document.id), { 
              isActive: false,
              updatedAt: serverTimestamp(),
              updatedBy: userId
            });
          }
        });
      }

      const newYearDoc = {
        academicYearId: id,
        name: yearName,
        startDate: toFirestoreTimestamp(startStr),
        endDate: toFirestoreTimestamp(endStr),
        isActive: data.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
        updatedBy: userId,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,

        // Backward compatibility mappings
        year: yearName,
        semester: data.semester || "Ganjil"
      };

      batch.set(newDocRef, newYearDoc);
      await batch.commit();

      if (deactivatedYearIds.length > 0) {
        await deactivateSemestersForYears(deactivatedYearIds, userId);
      }

      await logActivity(
        userId,
        userName,
        "TAMBAH_TAHUN_PELAJARAN",
        id,
        `${userName} menambahkan Tahun Pelajaran baru "${yearName}" (${startStr} s/d ${endStr}) dengan status ${data.isActive ? 'Aktif' : 'Nonaktif'}.`
      );

      return {
        id,
        academicYearId: id,
        name: yearName,
        year: yearName,
        semester: data.semester || "Ganjil",
        startDate: startStr,
        endDate: endStr,
        isActive: data.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        updatedBy: userId,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      };
    } catch (error) {
      if (error instanceof Error && (error.message.includes("tidak valid") || error.message.includes("lebih awal") || error.message.includes("sudah ada") || error.message.includes("wajib diisi"))) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/new`);
    }
  },

  // Update existing Academic Year
  async updateAcademicYear(
    id: string,
    data: Partial<{
      name: string;
      year: string; // compat
      startDate: string;
      endDate: string;
      isActive: boolean;
      semester?: "Ganjil" | "Genap";
    }>,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const colRef = collection(db, COLLECTION_NAME);

    const yearName = (data.name || data.year || "").trim();

    // Form validations if fields are specified
    if (yearName) {
      const formatRegex = /^\d{4}\/\d{4}$/;
      if (!formatRegex.test(yearName)) {
        throw new Error(`Format Tahun Ajaran "${yearName}" tidak valid! Harus berformat YYYY/YYYY (contoh: 2025/2026)`);
      }
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (start >= end) {
        throw new Error("Tanggal Mulai harus lebih awal daripada Tanggal Selesai!");
      }
    }

    try {
      // Uniqueness check for name if updated
      if (yearName) {
        const querySnapshot = await getDocs(colRef);
        const activeYears: any[] = [];
        querySnapshot.forEach((doc) => {
          const d = doc.data();
          if (d.isDeleted !== true && doc.id !== id) {
            activeYears.push(d);
          }
        });

        const isDuplicate = activeYears.some(
          (y) => y.name.trim().toLowerCase() === yearName.toLowerCase()
        );

        if (isDuplicate) {
          throw new Error(`Tahun Pelajaran "${yearName}" sudah ada dalam sistem!`);
        }
      }

      const batch = writeBatch(db);

      // Handle isActive change and auto-deactivate others
      const deactivatedYearIds: string[] = [];
      if (data.isActive) {
        const querySnapshot = await getDocs(colRef);
        querySnapshot.forEach((document) => {
          if (document.id !== id && document.data().isActive === true && document.data().isDeleted !== true) {
            deactivatedYearIds.push(document.id);
            batch.update(doc(db, COLLECTION_NAME, document.id), { 
              isActive: false,
              updatedAt: serverTimestamp(),
              updatedBy: userId
            });
          }
        });
      } else if (data.isActive === false) {
        deactivatedYearIds.push(id);
      }

      // Format payload correctly
      const updatePayload: any = {
        updatedAt: serverTimestamp(),
        updatedBy: userId
      };

      if (data.name !== undefined || data.year !== undefined) {
        const n = data.name || data.year;
        updatePayload.name = n;
        updatePayload.year = n; // compat
      }
      if (data.startDate !== undefined) {
        updatePayload.startDate = toFirestoreTimestamp(data.startDate);
      }
      if (data.endDate !== undefined) {
        updatePayload.endDate = toFirestoreTimestamp(data.endDate);
      }
      if (data.isActive !== undefined) {
        updatePayload.isActive = data.isActive;
      }
      if (data.semester !== undefined) {
        updatePayload.semester = data.semester;
      }

      batch.update(docRef, updatePayload);
      await batch.commit();

      if (deactivatedYearIds.length > 0) {
        await deactivateSemestersForYears(deactivatedYearIds, userId);
      }

      const logName = yearName || id;
      await logActivity(
        userId,
        userName,
        "UBAH_TAHUN_PELAJARAN",
        id,
        `${userName} memperbarui Tahun Pelajaran "${logName}".`
      );

      if (data.isActive) {
        await logActivity(
          userId,
          userName,
          "MENGAKTIFKAN_TAHUN_PELAJARAN",
          id,
          `${userName} mengaktifkan Tahun Pelajaran "${logName}".`
        );
      }
    } catch (error) {
      if (error instanceof Error && (error.message.includes("tidak valid") || error.message.includes("lebih awal") || error.message.includes("sudah ada"))) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Soft Delete Academic Year
  async deleteAcademicYear(
    id: string,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Data tahun ajaran tidak ditemukan!");
      }

      const yearData = docSnap.data();
      if (yearData.isActive === true) {
        throw new Error("Tahun Pelajaran yang sedang AKTIF tidak boleh dihapus!");
      }

      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
        isActive: false,
        updatedAt: serverTimestamp(),
        updatedBy: userId
      });

      await deactivateSemestersForYears([id], userId);

      await logActivity(
        userId,
        userName,
        "HAPUS_TAHUN_PELAJARAN",
        id,
        `${userName} menghapus (Soft Delete) Tahun Pelajaran "${yearData.name || yearData.year || id}".`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("sedang AKTIF")) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Set active academic year with auto-deactivation
  async setActiveAcademicYear(
    id: string,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    await this.updateAcademicYear(id, { isActive: true }, userId, userName);
  }
};
