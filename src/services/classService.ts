import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  orderBy,
  writeBatch,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { Class } from "../types";

const COLLECTION_NAME = "classes";

// Helper function to write to activity_logs
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

export const classService = {
  // Get all active classes (excluding soft deleted ones)
  async getClasses(): Promise<Class[]> {
    const colRef = collection(db, COLLECTION_NAME);
    const q = query(colRef, orderBy("name", "asc"));
    try {
      const querySnapshot = await getDocs(q);
      const items: Class[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted !== true) {
          items.push({ 
            id: doc.id, 
            classId: doc.id, 
            ...data 
          } as Class);
        }
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Create class with unique name validation and activity logging
  async createClass(
    data: {
      name: string;
      gradeLevel: "VII" | "VIII" | "IX";
      roomCode?: string;
      capacity: number;
      homeroomTeacherId: string;
      homeroomTeacherName: string;
      academicYear: string;
      status: "Aktif" | "Nonaktif";
    },
    userId: string,
    userName: string
  ): Promise<Class> {
    const colRef = collection(db, COLLECTION_NAME);

    try {
      // 1. Validation for unique name (case-insensitive)
      const querySnapshot = await getDocs(colRef);
      const activeClasses: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.isDeleted !== true) {
          activeClasses.push(d);
        }
      });

      const isDuplicate = activeClasses.some(
        (c) => c.name.trim().toLowerCase() === data.name.trim().toLowerCase()
      );

      if (isDuplicate) {
        throw new Error(`Nama kelas "${data.name}" sudah digunakan oleh kelas aktif lainnya!`);
      }

      const newDocRef = doc(colRef);
      const id = newDocRef.id;

      // Legacy grade and wali kelas mapping for backwards compatibility
      const legacyGrade = data.gradeLevel === "VII" ? "7" : data.gradeLevel === "VIII" ? "8" : "9";

      const newClass: Class = {
        id,
        classId: id,
        name: data.name,
        gradeLevel: data.gradeLevel,
        roomCode: data.roomCode || "",
        capacity: data.capacity,
        homeroomTeacherId: data.homeroomTeacherId,
        homeroomTeacherName: data.homeroomTeacherName,
        academicYear: data.academicYear,
        status: data.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        updatedBy: userId,
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,

        // Backward compatibility mappings
        code: data.name, // e.g. "VII A"
        grade: legacyGrade,
        waliKelasId: data.homeroomTeacherId,
        waliKelasName: data.homeroomTeacherName,
        academicYearId: data.academicYear // e.g., 2025/2026
      };

      const batch = writeBatch(db);
      
      // Save class document
      batch.set(newDocRef, newClass);

      // Link wali kelas teacher record if specified
      if (data.homeroomTeacherId) {
        const teacherRef = doc(db, "teachers", data.homeroomTeacherId);
        batch.update(teacherRef, {
          isWaliKelas: true,
          classId: id
        });
      }

      await batch.commit();

      // Log activities
      await logActivity(
        userId,
        userName,
        "TAMBAH_KELAS",
        id,
        `${userName} menambahkan kelas baru "${data.name}" (Tingkat ${data.gradeLevel}) dengan Wali Kelas "${data.homeroomTeacherName || 'Belum Ditentukan'}".`
      );

      return newClass;
    } catch (error) {
      if (error instanceof Error && error.message.includes("sudah digunakan")) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/new`);
    }
  },

  // Update class with uniqueness checking and activity logging
  async updateClass(
    id: string,
    oldWaliKelasId: string,
    data: Partial<Class>,
    userId: string,
    userName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const colRef = collection(db, COLLECTION_NAME);

    try {
      // 1. If name is changing, validate uniqueness
      if (data.name) {
        const querySnapshot = await getDocs(colRef);
        const activeClasses: any[] = [];
        querySnapshot.forEach((doc) => {
          const d = doc.data();
          if (d.isDeleted !== true && doc.id !== id) {
            activeClasses.push(d);
          }
        });

        const isDuplicate = activeClasses.some(
          (c) => c.name.trim().toLowerCase() === data.name!.trim().toLowerCase()
        );

        if (isDuplicate) {
          throw new Error(`Nama kelas "${data.name}" sudah digunakan oleh kelas aktif lainnya!`);
        }
      }

      // Sync backward compatibility fields automatically if new fields are provided
      const updatedFields: any = {
        ...data,
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      };

      if (data.name) {
        updatedFields.code = data.name;
      }
      if (data.gradeLevel) {
        updatedFields.grade = data.gradeLevel === "VII" ? "7" : data.gradeLevel === "VIII" ? "8" : "9";
      }
      if (data.homeroomTeacherId !== undefined) {
        updatedFields.waliKelasId = data.homeroomTeacherId;
        updatedFields.waliKelasName = data.homeroomTeacherName || "";
      }
      if (data.academicYear) {
        updatedFields.academicYearId = data.academicYear;
      }

      const batch = writeBatch(db);
      
      // Update class doc
      batch.update(docRef, updatedFields);

      // Handle Wali Kelas change
      const hasWaliKelasChanged = data.homeroomTeacherId !== undefined && data.homeroomTeacherId !== oldWaliKelasId;
      if (hasWaliKelasChanged) {
        // Reset old teacher's assignment
        if (oldWaliKelasId) {
          const oldTeacherRef = doc(db, "teachers", oldWaliKelasId);
          batch.update(oldTeacherRef, {
            isWaliKelas: false,
            classId: null
          });
        }
        // Set new teacher's assignment
        if (data.homeroomTeacherId) {
          const newTeacherRef = doc(db, "teachers", data.homeroomTeacherId);
          batch.update(newTeacherRef, {
            isWaliKelas: true,
            classId: id
          });
        }
      }

      await batch.commit();

      // Log activity
      await logActivity(
        userId,
        userName,
        "UBAH_KELAS",
        id,
        `${userName} mengubah data kelas "${data.name || 'ID: ' + id}".`
      );

      if (hasWaliKelasChanged) {
        await logActivity(
          userId,
          userName,
          "UBAH_WALI_KELAS",
          id,
          `${userName} mengubah Wali Kelas menjadi "${data.homeroomTeacherName || 'Belum Ditentukan'}".`
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("sudah digunakan")) {
        throw error;
      }
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Soft Delete Class with status tracking and activity logging
  async deleteClass(
    id: string,
    waliKelasId: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      const batch = writeBatch(db);

      // Soft delete: update fields instead of deleting the document
      batch.update(docRef, {
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: userId,
        status: "Nonaktif",
        updatedAt: new Date().toISOString(),
        updatedBy: userId
      });

      // Reset teacher's wali kelas assignment
      if (waliKelasId) {
        const teacherRef = doc(db, "teachers", waliKelasId);
        batch.update(teacherRef, {
          isWaliKelas: false,
          classId: null
        });
      }

      await batch.commit();

      await logActivity(
        userId,
        userName,
        "HAPUS_KELAS",
        id,
        `${userName} menghapus kelas (Soft Delete) ID: "${id}".`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
