import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  serverTimestamp,
  addDoc,
  Timestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { Teacher } from "../types";

const COLLECTION_NAME = "teachers";

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

export const teacherService = {
  // Get all active (not soft-deleted) teachers
  async getTeachers(): Promise<Teacher[]> {
    const colRef = collection(db, COLLECTION_NAME);
    try {
      const querySnapshot = await getDocs(colRef);
      const items: Teacher[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter out soft-deleted teachers
        if (data.isDeleted !== true) {
          items.push({ 
            id: doc.id, 
            teacherId: doc.id, 
            ...data 
          } as Teacher);
        }
      });
      
      // Sort by name A-Z by default
      return items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } catch (error) {
      return handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  // Create new teacher with uniqueness validations
  async createTeacher(
    data: Omit<Teacher, "id" | "teacherId" | "createdAt" | "updatedAt" | "isDeleted" | "deletedAt" | "deletedBy" | "createdBy" | "updatedBy">,
    userId: string,
    userName: string
  ): Promise<Teacher> {
    const colRef = collection(db, COLLECTION_NAME);

   // 1. NIY Uniqueness Check (jika diisi)
if (data.niy && data.niy.trim() !== "") {
  const niyQuery = query(colRef, where("niy", "==", data.niy.trim()));
  const niySnapshot = await getDocs(niyQuery);

  const activeNiyDocs = niySnapshot.docs.filter(
    doc => doc.data().isDeleted !== true
  );

  if (activeNiyDocs.length > 0) {
    throw new Error("NIY sudah terdaftar!");
  }
}

    // 2. NUPTK Uniqueness Check (if filled)
    if (data.nuptk && data.nuptk.trim() !== "") {
      const nuptkQuery = query(colRef, where("nuptk", "==", data.nuptk.trim()));
      const nuptkSnapshot = await getDocs(nuptkQuery);
      const activeNuptkDocs = nuptkSnapshot.docs.filter(doc => doc.data().isDeleted !== true);
      if (activeNuptkDocs.length > 0) {
        throw new Error("NUPTK sudah terdaftar!");
      }
    }

    const newDocRef = doc(colRef);
    const id = newDocRef.id;

    // Parse birthDate as Firestore Timestamp or default to current date if invalid
    let birthTimestamp: any = null;
    if (data.birthDate) {
      birthTimestamp = Timestamp.fromDate(new Date(data.birthDate));
    }

    let joinTimestamp: any = null;
    if (data.joinDate) {
      joinTimestamp = Timestamp.fromDate(new Date(data.joinDate));
    }

   const newTeacher: any = {
  teacherId: id,

  niy: data.niy ?? "",
  nuptk: data.nuptk ?? "",

  name: data.name,
  gender: data.gender,

  birthPlace: data.birthPlace ?? "",
  birthDate: birthTimestamp,

  address: data.address ?? "",
  phone: data.phone ?? "",
  email: data.email ?? "",

  status: data.status ?? "Aktif",

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  createdBy: userId,
  updatedBy: userId,

  isDeleted: false,
  deletedAt: null,
  deletedBy: null,

  frontTitle: data.frontTitle ?? "",
  backTitle: data.backTitle ?? "",
  nickName: data.nickName ?? "",
  religion: data.religion ?? "",

  employeeType: data.employeeType ?? "Guru",
  employmentStatus: data.employmentStatus ?? "Tetap Yayasan",

  joinDate: joinTimestamp,

  photoUrl: data.photoUrl ?? ""
};

    try {
      await setDoc(newDocRef, newTeacher);
      
      // Log Activity
      await logActivity(
        userId, 
        userName, 
        "TAMBAH_GURU", 
        id, 
        `${userName} menambahkan guru ${data.name}.`
      );

      return {
        id,
        ...newTeacher,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Teacher;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Update teacher with uniqueness validations
  async updateTeacher(
    id: string, 
    data: Partial<Teacher>,
    userId: string,
    userName: string
  ): Promise<void> {
    const colRef = collection(db, COLLECTION_NAME);
    const docRef = doc(db, COLLECTION_NAME, id);

    // 1. NIY Uniqueness Check
    if (data.niy) {
      const niyQuery = query(colRef, where("niy", "==", data.niy));
      const niySnapshot = await getDocs(niyQuery);
      const duplicateNiy = niySnapshot.docs.filter(
        doc => doc.id !== id && doc.data().isDeleted !== true
      );
      if (duplicateNiy.length > 0) {
        throw new Error("NIY sudah terdaftar!");
      }
    }

    // 2. NUPTK Uniqueness Check (if filled)
    if (data.nuptk && data.nuptk.trim() !== "") {
      const nuptkQuery = query(colRef, where("nuptk", "==", data.nuptk.trim()));
      const nuptkSnapshot = await getDocs(nuptkQuery);
      const duplicateNuptk = nuptkSnapshot.docs.filter(
        doc => doc.id !== id && doc.data().isDeleted !== true
      );
      if (duplicateNuptk.length > 0) {
        throw new Error("NUPTK sudah terdaftar!");
      }
    }

    // Convert birthDate if provided
    let birthTimestamp: any = undefined;
    if (data.birthDate !== undefined) {
      birthTimestamp = data.birthDate ? Timestamp.fromDate(new Date(data.birthDate)) : null;
    }

    let joinTimestamp: any = undefined;
    if (data.joinDate !== undefined) {
      joinTimestamp = data.joinDate ? Timestamp.fromDate(new Date(data.joinDate)) : null;
    }

    const updateData: any = {
  ...data,

  niy: data.niy ?? "",
  nuptk: data.nuptk ?? "",
  birthPlace: data.birthPlace ?? "",
  address: data.address ?? "",
  phone: data.phone ?? "",
  email: data.email ?? "",
  frontTitle: data.frontTitle ?? "",
  backTitle: data.backTitle ?? "",
  nickName: data.nickName ?? "",
  religion: data.religion ?? "",
  photoUrl: data.photoUrl ?? "",

  updatedAt: serverTimestamp(),
  updatedBy: userId
};

    if (birthTimestamp !== undefined) {
      updateData.birthDate = birthTimestamp;
    }
    if (joinTimestamp !== undefined) {
      updateData.joinDate = joinTimestamp;
    }

    // Remove immutable fields if present
    delete updateData.id;
    delete updateData.teacherId;
    delete updateData.createdAt;
    delete updateData.createdBy;

    try {
      await updateDoc(docRef, updateData);

      // Log Activity
      await logActivity(
        userId, 
        userName, 
        "EDIT_GURU", 
        id, 
        `${userName} mengubah data guru ${data.name || "yang bersangkutan"}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Soft delete teacher
  async softDeleteTeacher(
    id: string, 
    teacherName: string,
    userId: string,
    userName: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId,
        updatedAt: serverTimestamp(),
        updatedBy: userId
      });

      // Log Activity
      await logActivity(
        userId, 
        userName, 
        "HAPUS_GURU", 
        id, 
        `${userName} menghapus data guru ${teacherName}.`
      );
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
