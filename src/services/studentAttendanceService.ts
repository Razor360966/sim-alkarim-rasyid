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
  orderBy,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { Student } from "../types";
import { ClassStudentAttendanceRecord, StudentAttendanceItem } from "../types/studentAttendance.types";

const COLLECTION_NAME = "student_attendances";
const STUDENTS_COLLECTION = "students";

async function logActivity(userId: string, userName: string, action: string, description: string) {
  try {
    const logsRef = collection(db, "activity_logs");
    const newLogRef = doc(logsRef);
    await setDoc(newLogRef, {
      id: newLogRef.id,
      userId,
      userName,
      action,
      description,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}

export const studentAttendanceService = {
  // Get active students for a given class
  async getStudentsByClass(classId: string): Promise<Student[]> {
    if (!classId) return [];
    try {
      const colRef = collection(db, STUDENTS_COLLECTION);
      const q = query(
        colRef, 
        where("classId", "==", classId),
        where("status", "==", "Aktif")
      );
      const snapshot = await getDocs(q);
      const items: Student[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as Student);
      });
      // Sort alphabetically by name
      items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      return items;
    } catch (error) {
      console.error("Error getting students for class:", error);
      return [];
    }
  },

  // Get existing attendance record for a specific date, class, and optional subject/journal
  async getAttendanceRecord(
    date: string, 
    classId: string, 
    subjectId?: string,
    journalId?: string
  ): Promise<ClassStudentAttendanceRecord | null> {
    if (!date || !classId) return null;
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let q = query(
        colRef, 
        where("date", "==", date),
        where("classId", "==", classId)
      );

      if (journalId) {
        q = query(q, where("journalId", "==", journalId));
      } else if (subjectId) {
        q = query(q, where("subjectId", "==", subjectId));
      }

      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;

      // Return the first match
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as ClassStudentAttendanceRecord;
    } catch (error) {
      console.error("Error fetching student attendance record:", error);
      return null;
    }
  },

  // Save or update student attendance
  async saveStudentAttendance(
    recordData: Omit<ClassStudentAttendanceRecord, "createdAt" | "updatedAt"> & { id?: string },
    userId: string,
    userName: string
  ): Promise<ClassStudentAttendanceRecord> {
    const timestamp = new Date().toISOString();
    
    // Calculate summary
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alpha = 0;

    recordData.students.forEach(s => {
      switch (s.status) {
        case "Hadir":
          hadir++;
          break;
        case "Sakit":
          sakit++;
          break;
        case "Izin":
          izin++;
          break;
        case "Alpha":
          alpha++;
          break;
        default:
          hadir++;
          break;
      }
    });

    const total = recordData.students.length;
    const summary = { hadir, sakit, izin, alpha, total };

    // Document ID: combine date, classId, and subjectId or custom id
    const customDocId = recordData.id || `${recordData.date}_${recordData.classId}_${recordData.subjectId || "general"}`;
    const docRef = doc(db, COLLECTION_NAME, customDocId);

    const fullRecord: ClassStudentAttendanceRecord = {
      ...recordData,
      id: customDocId,
      summary,
      updatedAt: timestamp,
      updatedBy: userName,
      createdAt: (recordData as any).createdAt || timestamp,
      createdBy: (recordData as any).createdBy || userName
    };

    try {
      await setDoc(docRef, fullRecord, { merge: true });

      await logActivity(
        userId, 
        userName, 
        "Save Student Attendance", 
        `Menyimpan absensi siswa kelas ${recordData.className} tanggal ${recordData.date} (H:${hadir}, S:${sakit}, I:${izin}, A:${alpha})`
      );

      return fullRecord;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${customDocId}`);
    }
  },

  // Get attendance history records for rekap
  async getAttendanceHistory(filters: {
    startDate?: string;
    endDate?: string;
    classId?: string;
    teacherId?: string;
    subjectId?: string;
  }): Promise<ClassStudentAttendanceRecord[]> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let q = query(colRef, orderBy("date", "desc"), limit(200));

      if (filters.classId) {
        q = query(q, where("classId", "==", filters.classId));
      }

      const snapshot = await getDocs(q);
      let items: ClassStudentAttendanceRecord[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as ClassStudentAttendanceRecord);
      });

      // Filter in memory for dates and teacher/subject
      if (filters.startDate) {
        items = items.filter(i => i.date >= filters.startDate!);
      }
      if (filters.endDate) {
        items = items.filter(i => i.date <= filters.endDate!);
      }
      if (filters.teacherId) {
        items = items.filter(i => i.teacherId === filters.teacherId);
      }
      if (filters.subjectId) {
        items = items.filter(i => i.subjectId === filters.subjectId);
      }

      return items;
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      return [];
    }
  },

  // Delete attendance record
  async deleteAttendanceRecord(id: string, userId: string, userName: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    try {
      await deleteDoc(docRef);
      await logActivity(userId, userName, "Delete Student Attendance", `Menghapus data absensi siswa dengan ID ${id}`);
    } catch (error) {
      return handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  }
};
