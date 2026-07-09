import { 
  collection, 
  doc, 
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
import { CurriculumMatrix } from "../types";

const COLLECTION_NAME = "curriculum_matrix";

// Helper function to log activities to "activity_logs" collection
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

export const curriculumMatrixService = {
  // Get all curriculum matrix items
  async getCurriculumMatrix(): Promise<CurriculumMatrix[]> {
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const querySnapshot = await getDocs(colRef);
      const items: CurriculumMatrix[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Partial<CurriculumMatrix>;
        items.push({
          id: doc.id,
          curriculumId: doc.id,
          subjectId: data.subjectId ?? "",
          subjectName: data.subjectName ?? "",
          jp_vii: typeof data.jp_vii === "number" ? data.jp_vii : 0,
          jp_viii: typeof data.jp_viii === "number" ? data.jp_viii : 0,
          jp_ix: typeof data.jp_ix === "number" ? data.jp_ix : 0,
          teacherId: data.teacherId ?? "",
          teacherName: data.teacherName ?? "",
          teacherId_vii: data.teacherId_vii ?? "",
          teacherName_vii: data.teacherName_vii ?? "",
          teacherId_viii: data.teacherId_viii ?? "",
          teacherName_viii: data.teacherName_viii ?? "",
          teacherId_ix: data.teacherId_ix ?? "",
          teacherName_ix: data.teacherName_ix ?? "",
          useDifferentTeachers: !!data.useDifferentTeachers,
          createdAt: data.createdAt ?? "",
          updatedAt: data.updatedAt ?? "",
          createdBy: data.createdBy ?? "",
          updatedBy: data.updatedBy ?? "",
          order: typeof data.order === "number" ? data.order : 0
        } as CurriculumMatrix);
      });
      return items;
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Add a subject to the curriculum matrix
  async addSubjectToCurriculum(
    subjectId: string,
    subjectName: string,
    teacherId: string = "",
    teacherName: string = "",
    userId: string,
    userName: string
  ): Promise<CurriculumMatrix> {
    const colRef = collection(db, COLLECTION_NAME);

    // Uniqueness validation: subjectId cannot already exist in curriculum_matrix
    const duplicateQuery = query(colRef, where("subjectId", "==", subjectId));
    const duplicateSnapshot = await getDocs(duplicateQuery);
    if (!duplicateSnapshot.empty) {
      throw new Error("Mata pelajaran ini sudah ditambahkan ke struktur kurikulum!");
    }

    const newDocRef = doc(colRef);
    const id = newDocRef.id;

    const newMatrixItem: Omit<CurriculumMatrix, "id" | "curriculumId"> = {
      subjectId,
      subjectName,
      jp_vii: 0,
      jp_viii: 0,
      jp_ix: 0,
      teacherId,
      teacherName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      updatedBy: userId,
      order: 0
    };

    try {
      await setDoc(newDocRef, newMatrixItem);
      
      // Log Activity
      await logActivity(
        userId, 
        userName, 
        "TAMBAH_MATRIKS_KURIKULUM", 
        id, 
        `${userName} menambahkan mata pelajaran "${subjectName}" ke struktur kurikulum.`
      );

      return {
        id,
        curriculumId: id,
        ...newMatrixItem
      } as CurriculumMatrix;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Update JP (Jam Pelajaran) inline
  async updateJP(
    id: string,
    grades: { jp_vii?: number; jp_viii?: number; jp_ix?: number },
    userId: string,
    userName: string,
    subjectName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    // Validation
    if (grades.jp_vii !== undefined && (grades.jp_vii < 0 || isNaN(grades.jp_vii))) {
      throw new Error("JP Kelas VII harus berupa angka positif!");
    }
    if (grades.jp_viii !== undefined && (grades.jp_viii < 0 || isNaN(grades.jp_viii))) {
      throw new Error("JP Kelas VIII harus berupa angka positif!");
    }
    if (grades.jp_ix !== undefined && (grades.jp_ix < 0 || isNaN(grades.jp_ix))) {
      throw new Error("JP Kelas IX harus berupa angka positif!");
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    if (grades.jp_vii !== undefined) {
      updateData.jp_vii = grades.jp_vii;
    }
    if (grades.jp_viii !== undefined) {
      updateData.jp_viii = grades.jp_viii;
    }
    if (grades.jp_ix !== undefined) {
      updateData.jp_ix = grades.jp_ix;
    }

    try {
      await updateDoc(docRef, updateData);

      // Construct activity log details
      const details = [];
      if (grades.jp_vii !== undefined) details.push(`Kelas VII: ${grades.jp_vii} JP`);
      if (grades.jp_viii !== undefined) details.push(`Kelas VIII: ${grades.jp_viii} JP`);
      if (grades.jp_ix !== undefined) details.push(`Kelas IX: ${grades.jp_ix} JP`);

      await logActivity(
        userId, 
        userName, 
        "UBAH_JP_KURIKULUM", 
        id, 
        `${userName} mengubah JP untuk mapel "${subjectName}" (${details.join(", ")}).`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Update Order inline
  async updateOrder(
    id: string,
    order: number,
    userId: string,
    userName: string,
    subjectName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    if (order < 0 || isNaN(order)) {
      throw new Error("Urutan harus berupa angka positif!");
    }

    const updateData = {
      order,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    try {
      await updateDoc(docRef, updateData);

      await logActivity(
        userId, 
        userName, 
        "UBAH_URUTAN_KURIKULUM", 
        id, 
        `${userName} mengubah urutan untuk mapel "${subjectName}" menjadi ${order}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Assign or change teacher
  async assignTeacher(
    id: string,
    teacherId: string,
    teacherName: string,
    userId: string,
    userName: string,
    subjectName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    
    const updateData = {
      teacherId,
      teacherName,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    try {
      await updateDoc(docRef, updateData);

      await logActivity(
        userId, 
        userName, 
        "UBAH_GURU_KURIKULUM", 
        id, 
        `${userName} mengubah Guru Pengampu mapel "${subjectName}" menjadi "${teacherName}".`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Assign or change teacher for specific grade
  async assignTeacherForGrade(
    id: string,
    grade: "vii" | "viii" | "ix",
    teacherId: string,
    teacherName: string,
    userId: string,
    userName: string,
    subjectName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData: any = {
      [`teacherId_${grade}`]: teacherId,
      [`teacherName_${grade}`]: teacherName,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    try {
      await updateDoc(docRef, updateData);

      await logActivity(
        userId,
        userName,
        "UBAH_GURU_JENJANG_KURIKULUM",
        id,
        `${userName} mengubah Guru Pengampu mapel "${subjectName}" Kelas ${grade.toUpperCase()} menjadi "${teacherName}".`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Toggle useDifferentTeachers flag
  async toggleDifferentTeachers(
    id: string,
    useDifferentTeachers: boolean,
    userId: string,
    userName: string,
    subjectName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    const updateData = {
      useDifferentTeachers,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };

    try {
      await updateDoc(docRef, updateData);

      await logActivity(
        userId,
        userName,
        "UBAH_METODE_GURU_KURIKULUM",
        id,
        `${userName} ${useDifferentTeachers ? "mengaktifkan" : "menonaktifkan"} opsi guru berbeda tiap jenjang untuk mapel "${subjectName}".`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Delete/Remove a subject matrix item
  async removeSubjectFromCurriculum(
    id: string,
    subjectName: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await deleteDoc(docRef);

      await logActivity(
        userId, 
        userName, 
        "HAPUS_MAPEL_KURIKULUM", 
        id, 
        `${userName} menghapus mapel "${subjectName}" dari struktur kurikulum.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
