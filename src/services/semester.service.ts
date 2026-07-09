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
import { Semester, AcademicYear } from "../types";

const COLLECTION_NAME = "semesters";
const ACADEMIC_YEARS_COLLECTION = "academic_years";

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

// Convert Firestore Timestamp or Date/string to YYYY-MM-DD string
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

// Helper to check if two date ranges overlap
function isOverlapping(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();
  return sA < eB && sB < eA;
}

export const semesterService = {
  // Get all semesters (non-deleted)
  async getSemesters(): Promise<Semester[]> {
    try {
      // 1. Get all active academic years so we can map them and enforce the status rule:
      // "Jika tahun pelajaran nonaktif: semua semester di dalamnya otomatis nonaktif"
      const ayColRef = collection(db, ACADEMIC_YEARS_COLLECTION);
      const aySnapshot = await getDocs(ayColRef);
      const academicYearsMap: { [id: string]: { isActive: boolean; name: string } } = {};
      
      aySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.isDeleted !== true) {
          academicYearsMap[doc.id] = {
            isActive: d.isActive || false,
            name: d.name || d.year || ""
          };
        }
      });

      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, orderBy("name", "asc"));
      const querySnapshot = await getDocs(q);
      
      const items: Semester[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted !== true) {
          const ayId = data.academicYearId || "";
          const parentAY = academicYearsMap[ayId];
          const ayName = parentAY ? parentAY.name : (data.academicYearName || "");
          const isAYActive = parentAY ? parentAY.isActive : false;

          // Crucial business rule: if academic year is not active, the semester MUST be inactive.
          const finalIsActive = isAYActive ? (data.isActive || false) : false;

          items.push({
            id: docSnap.id,
            semesterId: docSnap.id,
            academicYearId: ayId,
            academicYearName: ayName,
            name: data.name || "",
            code: data.code || "",
            startDate: toDateString(data.startDate),
            endDate: toDateString(data.endDate),
            isActive: finalIsActive,
            createdAt: toDateString(data.createdAt),
            updatedAt: toDateString(data.updatedAt),
            createdBy: data.createdBy || "",
            updatedBy: data.updatedBy || "",
            isDeleted: data.isDeleted || false,
            deletedAt: data.deletedAt ? toDateString(data.deletedAt) : null,
            deletedBy: data.deletedBy || null
          } as Semester);
        }
      });

      // Sort by academic year name desc, then by code asc (S1 then S2)
      return items.sort((a, b) => {
        const ayComp = b.academicYearName.localeCompare(a.academicYearName);
        if (ayComp !== 0) return ayComp;
        return a.code.localeCompare(b.code);
      });
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Get active semester across the system
  async getActiveSemester(): Promise<Semester | null> {
    try {
      const semesters = await this.getSemesters();
      const active = semesters.find(s => s.isActive);
      return active || null;
    } catch (error) {
      console.error("Failed to get active semester:", error);
      return null;
    }
  },

  // Create new Semester with thorough validation
  async createSemester(
    data: {
      academicYearId: string;
      name: string; // "Semester 1" atau "Semester 2"
      code: string; // "S1" atau "S2"
      startDate: string;
      endDate: string;
      isActive: boolean;
    },
    userId: string = "system",
    userName: string = "System"
  ): Promise<Semester> {
    const ayId = data.academicYearId.trim();
    if (!ayId) {
      throw new Error("Tahun Pelajaran wajib ditentukan!");
    }

    // 1. Fetch parent academic year
    const ayDocRef = doc(db, ACADEMIC_YEARS_COLLECTION, ayId);
    const aySnap = await getDoc(ayDocRef);
    if (!aySnap.exists() || aySnap.data().isDeleted === true) {
      throw new Error("Tahun Pelajaran yang dipilih tidak ditemukan!");
    }

    const ayData = aySnap.data();
    const ayName = ayData.name || ayData.year || "";
    const isAYActive = ayData.isActive || false;

    // Validation: Semester tidak boleh aktif jika tahun pelajaran tidak aktif
    if (data.isActive && !isAYActive) {
      throw new Error(`Semester tidak boleh aktif karena Tahun Pelajaran "${ayName}" sedang NONAKTIF!`);
    }

    // Validation: name and code consistency
    const semName = data.name.trim();
    const semCode = data.code.trim();
    if (semCode !== "S1" && semCode !== "S2") {
      throw new Error("Kode Semester harus berupa 'S1' atau 'S2'!");
    }
    if (semName !== "Semester 1" && semName !== "Semester 2") {
      throw new Error("Nama Semester harus berupa 'Semester 1' atau 'Semester 2'!");
    }

    // Validation: startDate < endDate
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (start >= end) {
      throw new Error("Tanggal Mulai harus lebih awal daripada Tanggal Selesai!");
    }

    try {
      // Fetch existing semesters for this academic year to perform validation checks
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, where("academicYearId", "==", ayId));
      const querySnapshot = await getDocs(q);
      const existingSemesters: any[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.isDeleted !== true) {
          existingSemesters.push({ id: docSnap.id, ...d });
        }
      });

      // Validation: Maksimal 2 semester per tahun pelajaran (S1 dan S2)
      if (existingSemesters.length >= 2) {
        throw new Error(`Tahun Pelajaran "${ayName}" sudah memiliki maksimal 2 semester!`);
      }

      // Validation: Setiap academic_year hanya boleh punya 1 S1 dan 1 S2
      const hasS1 = existingSemesters.some(s => s.code === "S1");
      const hasS2 = existingSemesters.some(s => s.code === "S2");

      if (semCode === "S1" && hasS1) {
        throw new Error(`Semester 1 (S1) sudah didefinisikan untuk Tahun Pelajaran "${ayName}"!`);
      }
      if (semCode === "S2" && hasS2) {
        throw new Error(`Semester 2 (S2) sudah didefinisikan untuk Tahun Pelajaran "${ayName}"!`);
      }

      // Validation: Overlap tanggal antar semester dalam tahun pelajaran yang sama
      for (const other of existingSemesters) {
        const otherStartStr = toDateString(other.startDate);
        const otherEndStr = toDateString(other.endDate);
        if (isOverlapping(data.startDate, data.endDate, otherStartStr, otherEndStr)) {
          throw new Error(`Tanggal semester tumpang tindih (overlap) dengan "${other.name}" (${otherStartStr} s/d ${otherEndStr})!`);
        }
      }

      const newDocRef = doc(colRef);
      const id = newDocRef.id;
      const batch = writeBatch(db);

      // If set to active, deactivate all other semesters in this academic year
      if (data.isActive) {
        existingSemesters.forEach((other) => {
          if (other.isActive === true) {
            batch.update(doc(db, COLLECTION_NAME, other.id), {
              isActive: false,
              updatedAt: serverTimestamp(),
              updatedBy: userId
            });
          }
        });
      }

      const newSemesterDoc = {
        semesterId: id,
        academicYearId: ayId,
        academicYearName: ayName,
        name: semName,
        code: semCode,
        startDate: toFirestoreTimestamp(data.startDate),
        endDate: toFirestoreTimestamp(data.endDate),
        isActive: data.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
        updatedBy: userId,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      };

      batch.set(newDocRef, newSemesterDoc);
      await batch.commit();

      await logActivity(
        userId,
        userName,
        "TAMBAH_SEMESTER",
        id,
        `${userName} menambahkan semester baru "${semName} (${semCode})" pada Tahun Pelajaran "${ayName}" dengan status ${data.isActive ? 'Aktif' : 'Nonaktif'}.`
      );

      return {
        id,
        semesterId: id,
        academicYearId: ayId,
        academicYearName: ayName,
        name: semName,
        code: semCode,
        startDate: data.startDate,
        endDate: data.endDate,
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
      if (error instanceof Error && (
        error.message.includes("wajib") || 
        error.message.includes("tidak ditemukan") || 
        error.message.includes("maksimal 2") || 
        error.message.includes("sudah didefinisikan") || 
        error.message.includes("tumpang tindih") || 
        error.message.includes("NONAKTIF") ||
        error.message.includes("harus berupa") ||
        error.message.includes("lebih awal")
      )) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/new`);
    }
  },

  // Update existing Semester
  async updateSemester(
    id: string,
    data: Partial<{
      academicYearId: string;
      name: string;
      code: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    }>,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const semSnap = await getDoc(docRef);
    if (!semSnap.exists() || semSnap.data().isDeleted === true) {
      throw new Error("Data semester tidak ditemukan!");
    }

    const currentData = semSnap.data();
    const activeAyId = data.academicYearId !== undefined ? data.academicYearId : currentData.academicYearId;
    
    // Fetch active academic year details to ensure it exists
    const ayDocRef = doc(db, ACADEMIC_YEARS_COLLECTION, activeAyId);
    const aySnap = await getDoc(ayDocRef);
    if (!aySnap.exists() || aySnap.data().isDeleted === true) {
      throw new Error("Tahun Pelajaran tidak ditemukan!");
    }

    const ayData = aySnap.data();
    const ayName = ayData.name || ayData.year || "";
    const isAYActive = ayData.isActive || false;

    // Check parent year active requirement
    const finalIsActive = data.isActive !== undefined ? data.isActive : currentData.isActive;
    if (finalIsActive && !isAYActive) {
      throw new Error(`Semester tidak boleh aktif karena Tahun Pelajaran "${ayName}" sedang NONAKTIF!`);
    }

    // Validation Name / Code consistency
    const semName = data.name !== undefined ? data.name.trim() : currentData.name;
    const semCode = data.code !== undefined ? data.code.trim() : currentData.code;
    
    if (semCode !== "S1" && semCode !== "S2") {
      throw new Error("Kode Semester harus berupa 'S1' atau 'S2'!");
    }
    if (semName !== "Semester 1" && semName !== "Semester 2") {
      throw new Error("Nama Semester harus berupa 'Semester 1' atau 'Semester 2'!");
    }

    // Date validations
    const startStr = data.startDate !== undefined ? data.startDate : toDateString(currentData.startDate);
    const endStr = data.endDate !== undefined ? data.endDate : toDateString(currentData.endDate);
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start >= end) {
      throw new Error("Tanggal Mulai harus lebih awal daripada Tanggal Selesai!");
    }

    try {
      // Fetch other semesters for overlap / uniqueness checking
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, where("academicYearId", "==", activeAyId));
      const querySnapshot = await getDocs(q);
      const existingSemesters: any[] = [];
      
      querySnapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.isDeleted !== true && docSnap.id !== id) {
          existingSemesters.push({ id: docSnap.id, ...d });
        }
      });

      // If parent year changed, verify capacity limit
      if (data.academicYearId !== undefined && data.academicYearId !== currentData.academicYearId) {
        if (existingSemesters.length >= 2) {
          throw new Error(`Tahun Pelajaran "${ayName}" sudah memiliki maksimal 2 semester!`);
        }
      }

      // Check S1 / S2 uniqueness
      const hasS1 = existingSemesters.some(s => s.code === "S1");
      const hasS2 = existingSemesters.some(s => s.code === "S2");

      if (semCode === "S1" && hasS1) {
        throw new Error(`Semester 1 (S1) sudah didefinisikan untuk Tahun Pelajaran "${ayName}"!`);
      }
      if (semCode === "S2" && hasS2) {
        throw new Error(`Semester 2 (S2) sudah didefinisikan untuk Tahun Pelajaran "${ayName}"!`);
      }

      // Check Overlap
      for (const other of existingSemesters) {
        const otherStartStr = toDateString(other.startDate);
        const otherEndStr = toDateString(other.endDate);
        if (isOverlapping(startStr, endStr, otherStartStr, otherEndStr)) {
          throw new Error(`Tanggal semester tumpang tindih (overlap) dengan "${other.name}" (${otherStartStr} s/d ${otherEndStr})!`);
        }
      }

      const batch = writeBatch(db);

      // Handle active state change
      if (data.isActive === true) {
        // Deactivate all other semesters in the same academic year
        const sameYearQuery = query(colRef, where("academicYearId", "==", activeAyId));
        const sameYearSnapshot = await getDocs(sameYearQuery);
        sameYearSnapshot.forEach((document) => {
          if (document.id !== id && document.data().isActive === true && document.data().isDeleted !== true) {
            batch.update(doc(db, COLLECTION_NAME, document.id), { 
              isActive: false,
              updatedAt: serverTimestamp(),
              updatedBy: userId
            });
          }
        });
      }

      // Prepare payload
      const updatePayload: any = {
        updatedAt: serverTimestamp(),
        updatedBy: userId
      };

      if (data.academicYearId !== undefined) {
        updatePayload.academicYearId = data.academicYearId;
        updatePayload.academicYearName = ayName;
      }
      if (data.name !== undefined) {
        updatePayload.name = semName;
      }
      if (data.code !== undefined) {
        updatePayload.code = semCode;
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

      batch.update(docRef, updatePayload);
      await batch.commit();

      // Log academic year relation change if appropriate
      if (data.academicYearId !== undefined && data.academicYearId !== currentData.academicYearId) {
        await logActivity(
          userId,
          userName,
          "UBAH_RELASI_TAHUN_PELAJARAN",
          id,
          `${userName} mengubah relasi Tahun Pelajaran untuk semester "${semName}" dari "${currentData.academicYearName}" ke "${ayName}".`
        );
      }

      await logActivity(
        userId,
        userName,
        "UBAH_SEMESTER",
        id,
        `${userName} memperbarui semester "${semName}" pada Tahun Pelajaran "${ayName}".`
      );

      if (data.isActive === true) {
        await logActivity(
          userId,
          userName,
          "MENGAKTIFKAN_SEMESTER",
          id,
          `${userName} mengaktifkan semester "${semName}" pada Tahun Pelajaran "${ayName}".`
        );
      }
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes("wajib") || 
        error.message.includes("tidak ditemukan") || 
        error.message.includes("maksimal 2") || 
        error.message.includes("sudah didefinisikan") || 
        error.message.includes("tumpang tindih") || 
        error.message.includes("NONAKTIF") ||
        error.message.includes("harus berupa") ||
        error.message.includes("lebih awal")
      )) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Soft Delete Semester
  async deleteSemester(
    id: string,
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error("Data semester tidak ditemukan!");
      }

      const semData = docSnap.data();
      if (semData.isDeleted === true) return;

      if (semData.isActive === true) {
        throw new Error("Semester yang sedang AKTIF tidak boleh dihapus!");
      }

      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
        isActive: false,
        updatedAt: serverTimestamp(),
        updatedBy: userId
      });

      await logActivity(
        userId,
        userName,
        "HAPUS_SEMESTER",
        id,
        `${userName} menghapus (Soft Delete) semester "${semData.name || id}" dari Tahun Pelajaran "${semData.academicYearName || ''}".`
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("sedang AKTIF")) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Update Manual Weeks Configuration
  async updateManualWeeksConfig(
    id: string,
    config: {
      manualWeeksConfigured: boolean;
      totalWeeks: number;
      effectiveWeeks: number;
      ineffectiveWeeks: number;
      assessmentWeeks: number;
      pasPatWeeks: number;
      projectWeeks: number;
      otherWeeks: number;
      details?: any[];
    },
    userId: string = "system",
    userName: string = "System"
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        manualWeeksConfigured: config.manualWeeksConfigured,
        totalWeeks: config.totalWeeks,
        effectiveWeeks: config.effectiveWeeks,
        ineffectiveWeeks: config.ineffectiveWeeks,
        assessmentWeeks: config.assessmentWeeks,
        pasPatWeeks: config.pasPatWeeks,
        projectWeeks: config.projectWeeks,
        otherWeeks: config.otherWeeks,
        details: config.details || [],
        updatedAt: serverTimestamp(),
        updatedBy: userId
      });
      
      await logActivity(
        userId,
        userName,
        "UPDATE_PEKAN_MANUAL",
        id,
        `${userName} memperbarui konfigurasi pekan manual semester: total=${config.totalWeeks}, efektif=${config.effectiveWeeks}, manual=${config.manualWeeksConfigured ? 'Ya' : 'Tidak'}`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}/manualWeeks`);
    }
  }
};
