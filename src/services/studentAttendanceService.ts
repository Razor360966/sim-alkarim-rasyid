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
import { 
  ClassStudentAttendanceRecord, 
  StudentAttendanceItem, 
  SessionLockStatus, 
  StudentAttendanceAuditLog,
  StudentOverallRecap,
  HomeroomClassDetailRecap,
  HeadmasterOverviewStats
} from "../types/studentAttendance.types";

const COLLECTION_NAME = "student_attendances";
const STUDENTS_COLLECTION = "students";
const TEACHER_ATTENDANCES_COLLECTION = "teacher_teaching_attendances";
const AUDIT_LOGS_COLLECTION = "student_attendance_audit_logs";

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

  // Check teaching session gating & lock status based on teacher QR Check-in & Check-out
  async checkTeachingSessionLock(
    date: string,
    teacherId?: string,
    classId?: string,
    subjectId?: string,
    scheduleId?: string,
    isPrivilegedRole: boolean = false
  ): Promise<SessionLockStatus> {
    if (!date) {
      return {
        canInput: true,
        isLocked: false,
        reason: "Tanggal belum dipilih."
      };
    }

    try {
      const colRef = collection(db, TEACHER_ATTENDANCES_COLLECTION);
      let q = query(colRef, where("date", "==", date));

      if (teacherId) {
        q = query(q, where("teacherId", "==", teacherId));
      }

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // No check-in record found for this session/date
        return {
          canInput: isPrivilegedRole,
          isLocked: true,
          reason: isPrivilegedRole 
            ? "Guru pengampu belum melakukan QR Check-In. Menginput menggunakan wewenang Admin/Wakakur."
            : "Menu absensi siswa TERKUNCI. Guru pengampu belum melakukan QR Check-In untuk sesi pembelajaran ini."
        };
      }

      // Find matching session
      let matchingDoc: any = null;
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (scheduleId && data.scheduleId === scheduleId) {
          matchingDoc = data;
        } else if (classId && data.classId === classId) {
          matchingDoc = data;
        } else if (!matchingDoc) {
          matchingDoc = data;
        }
      });

      if (!matchingDoc) {
        return {
          canInput: isPrivilegedRole,
          isLocked: true,
          reason: isPrivilegedRole 
            ? "Belum ada catatan Check-In guru. Diizinkan edit dengan Wewenang Khusus."
            : "Absensi siswa TERKUNCI: Guru belum melakukan QR Check-In di kelas."
        };
      }

      const checkInTime = matchingDoc.checkInTime;
      const checkOutTime = matchingDoc.checkOutTime;

      // Rule 1: No Check-In -> Locked
      if (!checkInTime) {
        return {
          canInput: isPrivilegedRole,
          isLocked: true,
          reason: isPrivilegedRole
            ? "Guru belum QR Check-In. Mode pengeditan Waka Kurikulum/Admin."
            : "Absensi siswa TERKUNCI: Guru belum melakukan QR Check-In untuk sesi ini."
        };
      }

      // Rule 2: Checked Out -> Locked
      if (checkOutTime) {
        return {
          canInput: isPrivilegedRole,
          isLocked: true,
          checkInTime,
          checkOutTime,
          teachingAttendanceId: matchingDoc.id,
          reason: isPrivilegedRole
            ? `Sesi telah di-Check-Out jam ${checkOutTime}. Pengeditan Waka Kurikulum/Admin wajib menyertakan Alasan Audit Trail.`
            : `Absensi siswa telah DIKUNCI karena guru telah melakukan QR Check-Out pada ${checkOutTime}. Perubahan hanya dapat dilakukan oleh Admin/Waka Kurikulum.`
        };
      }

      // Rule 3: Checked In & Not Checked Out -> Open for input!
      return {
        canInput: true,
        isLocked: false,
        checkInTime,
        teachingAttendanceId: matchingDoc.id,
        reason: `Sesi Pembelajaran Aktif. QR Check-In terkonfirmasi jam ${checkInTime}.`
      };

    } catch (error) {
      console.error("Error checking session lock:", error);
      // Fallback: allow input with warning
      return {
        canInput: true,
        isLocked: false,
        reason: "Gagal memeriksa status kunci sesi, mengizinkan pengisian."
      };
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

  // Save or update student attendance with optional Audit Trail
  async saveStudentAttendance(
    recordData: Omit<ClassStudentAttendanceRecord, "createdAt" | "updatedAt"> & { id?: string },
    userId: string,
    userName: string,
    auditReason?: string,
    userRole?: string
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

    // Fetch existing record to compare summary for audit log
    let oldSummary: any = null;
    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        oldSummary = existingSnap.data()?.summary;
      }
    } catch (e) {
      console.warn("Could not fetch old record for audit trail comparison:", e);
    }

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

      // Write Audit Log if reason is provided or if updating locked record
      if (auditReason) {
        const auditRef = doc(collection(db, AUDIT_LOGS_COLLECTION));
        const auditData: StudentAttendanceAuditLog = {
          id: auditRef.id,
          recordId: customDocId,
          date: recordData.date,
          className: recordData.className,
          subjectName: recordData.subjectName,
          teacherName: recordData.teacherName,
          userId,
          userName,
          userRole: userRole || "wakakur/admin",
          timestamp,
          reason: auditReason,
          oldSummary,
          newSummary: summary
        };
        await setDoc(auditRef, auditData);
      }

      await logActivity(
        userId, 
        userName, 
        "Save Student Attendance", 
        `Menyimpan absensi siswa kelas ${recordData.className} tanggal ${recordData.date} (H:${hadir}, S:${sakit}, I:${izin}, A:${alpha})${auditReason ? ` [Audit: ${auditReason}]` : ""}`
      );

      return fullRecord;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${customDocId}`);
    }
  },

  // Fetch Audit Trail Logs for Admin / Wakakur
  async getAuditLogs(): Promise<StudentAttendanceAuditLog[]> {
    try {
      const colRef = collection(db, AUDIT_LOGS_COLLECTION);
      const q = query(colRef, orderBy("timestamp", "desc"), limit(100));
      const snapshot = await getDocs(q);
      const items: StudentAttendanceAuditLog[] = [];
      snapshot.forEach(d => {
        items.push({ id: d.id, ...d.data() } as StudentAttendanceAuditLog);
      });
      return items;
    } catch (error) {
      console.error("Error fetching student attendance audit logs:", error);
      return [];
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
      let q = query(colRef, orderBy("date", "desc"), limit(300));

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

  // Rekap Per Siswa (Subject-by-subject percentage e.g. IPA 90%, Matematika 82%, etc.)
  async getStudentHistoryRecap(classId?: string): Promise<StudentOverallRecap[]> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      let q = query(colRef, limit(400));
      if (classId) {
        q = query(q, where("classId", "==", classId));
      }
      const snapshot = await getDocs(q);
      const records: ClassStudentAttendanceRecord[] = [];
      snapshot.forEach(d => records.push({ id: d.id, ...d.data() } as ClassStudentAttendanceRecord));

      // Map studentId -> StudentOverallRecap
      const studentMap: { [studentId: string]: StudentOverallRecap } = {};

      records.forEach(rec => {
        const subjectName = rec.subjectName || "Umum";
        const subjectId = rec.subjectId || "general";
        const teacherName = rec.teacherName || "-";

        rec.students.forEach(st => {
          if (!studentMap[st.studentId]) {
            studentMap[st.studentId] = {
              studentId: st.studentId,
              studentName: st.studentName,
              nis: st.nis || "-",
              className: rec.className,
              subjects: [],
              overallPercentage: 0,
              totalHadir: 0,
              totalSakit: 0,
              totalIzin: 0,
              totalAlpha: 0
            };
          }

          const sr = studentMap[st.studentId];
          let sbjItem = sr.subjects.find(s => s.subjectId === subjectId || s.subjectName === subjectName);
          if (!sbjItem) {
            sbjItem = {
              subjectId,
              subjectName,
              teacherName,
              totalSessions: 0,
              hadir: 0,
              sakit: 0,
              izin: 0,
              alpha: 0,
              percentage: 0
            };
            sr.subjects.push(sbjItem);
          }

          sbjItem.totalSessions += 1;
          if (st.status === "Sakit") {
            sbjItem.sakit += 1;
            sr.totalSakit += 1;
          } else if (st.status === "Izin") {
            sbjItem.izin += 1;
            sr.totalIzin += 1;
          } else if (st.status === "Alpha") {
            sbjItem.alpha += 1;
            sr.totalAlpha += 1;
          } else {
            sbjItem.hadir += 1;
            sr.totalHadir += 1;
          }
        });
      });

      // Compute percentages
      Object.values(studentMap).forEach(sr => {
        let totalSessionsSum = 0;
        let totalHadirSum = 0;

        sr.subjects.forEach(sbj => {
          sbj.percentage = sbj.totalSessions > 0 ? Math.round((sbj.hadir / sbj.totalSessions) * 100) : 100;
          totalSessionsSum += sbj.totalSessions;
          totalHadirSum += sbj.hadir;
        });

        sr.overallPercentage = totalSessionsSum > 0 ? Math.round((totalHadirSum / totalSessionsSum) * 100) : 100;
      });

      return Object.values(studentMap).sort((a, b) => a.studentName.localeCompare(b.studentName));
    } catch (error) {
      console.error("Error generating student history recap:", error);
      return [];
    }
  },

  // Rekap Wali Kelas (Homeroom Breakdown per Student & Subject)
  async getHomeroomClassRecap(classId: string): Promise<HomeroomClassDetailRecap[]> {
    if (!classId) return [];
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, where("classId", "==", classId), limit(400));
      const snapshot = await getDocs(q);
      const records: ClassStudentAttendanceRecord[] = [];
      snapshot.forEach(d => records.push({ id: d.id, ...d.data() } as ClassStudentAttendanceRecord));

      const studentMap: { [studentId: string]: HomeroomClassDetailRecap } = {};

      records.forEach(rec => {
        const subjectName = rec.subjectName || "Umum";

        rec.students.forEach(st => {
          if (!studentMap[st.studentId]) {
            studentMap[st.studentId] = {
              studentId: st.studentId,
              studentName: st.studentName,
              nis: st.nis || "-",
              bySubject: {},
              totalHadir: 0,
              totalSakit: 0,
              totalIzin: 0,
              totalAlpha: 0,
              totalSessions: 0,
              overallPercentage: 0
            };
          }

          const hr = studentMap[st.studentId];
          if (!hr.bySubject[subjectName]) {
            hr.bySubject[subjectName] = {
              hadir: 0,
              sakit: 0,
              izin: 0,
              alpha: 0,
              total: 0,
              percentage: 0
            };
          }

          const sbjObj = hr.bySubject[subjectName];
          sbjObj.total += 1;
          hr.totalSessions += 1;

          if (st.status === "Sakit") {
            sbjObj.sakit += 1;
            hr.totalSakit += 1;
          } else if (st.status === "Izin") {
            sbjObj.izin += 1;
            hr.totalIzin += 1;
          } else if (st.status === "Alpha") {
            sbjObj.alpha += 1;
            hr.totalAlpha += 1;
          } else {
            sbjObj.hadir += 1;
            hr.totalHadir += 1;
          }
        });
      });

      // Calculate percentages
      Object.values(studentMap).forEach(hr => {
        Object.keys(hr.bySubject).forEach(sbjKey => {
          const s = hr.bySubject[sbjKey];
          s.percentage = s.total > 0 ? Math.round((s.hadir / s.total) * 100) : 100;
        });
        hr.overallPercentage = hr.totalSessions > 0 ? Math.round((hr.totalHadir / hr.totalSessions) * 100) : 100;
      });

      return Object.values(studentMap).sort((a, b) => a.studentName.localeCompare(b.studentName));
    } catch (error) {
      console.error("Error generating homeroom class recap:", error);
      return [];
    }
  },

  // Rekap Kepala Sekolah (Dashboard Overview per Subject, Teacher, and Class)
  async getHeadmasterOverviewStats(): Promise<HeadmasterOverviewStats> {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      const q = query(colRef, limit(500));
      const snapshot = await getDocs(q);
      const records: ClassStudentAttendanceRecord[] = [];
      snapshot.forEach(d => records.push({ id: d.id, ...d.data() } as ClassStudentAttendanceRecord));

      const subjectStats: { [name: string]: { total: number; hadir: number; sakit: number; izin: number; alpha: number } } = {};
      const teacherStats: { [name: string]: { total: number; hadir: number; sakit: number; izin: number; alpha: number } } = {};
      const classStats: { [name: string]: { total: number; hadir: number; sakit: number; izin: number; alpha: number } } = {};

      let grandTotalHadir = 0;
      let grandTotalSessions = 0;

      records.forEach(rec => {
        const sbj = rec.subjectName || "Umum";
        const tch = rec.teacherName || "Guru Pengampu";
        const cls = `Kelas ${rec.className}`;

        if (!subjectStats[sbj]) subjectStats[sbj] = { total: 0, hadir: 0, sakit: 0, izin: 0, alpha: 0 };
        if (!teacherStats[tch]) teacherStats[tch] = { total: 0, hadir: 0, sakit: 0, izin: 0, alpha: 0 };
        if (!classStats[cls]) classStats[cls] = { total: 0, hadir: 0, sakit: 0, izin: 0, alpha: 0 };

        const s = rec.summary || { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 };

        [subjectStats[sbj], teacherStats[tch], classStats[cls]].forEach(group => {
          group.total += s.total;
          group.hadir += s.hadir;
          group.sakit += s.sakit;
          group.izin += s.izin;
          group.alpha += s.alpha;
        });

        grandTotalHadir += s.hadir;
        grandTotalSessions += s.total;
      });

      const mapGroup = (obj: typeof subjectStats, labelKey: string) => {
        return Object.keys(obj).map(key => {
          const item = obj[key];
          return {
            [labelKey]: key,
            totalSessions: item.total,
            attendancePct: item.total > 0 ? Math.round((item.hadir / item.total) * 100) : 100,
            hadir: item.hadir,
            sakit: item.sakit,
            izin: item.izin,
            alpha: item.alpha
          };
        });
      };

      return {
        bySubject: mapGroup(subjectStats, "subjectName") as any,
        byTeacher: mapGroup(teacherStats, "teacherName") as any,
        byClass: mapGroup(classStats, "className") as any,
        overallPercentage: grandTotalSessions > 0 ? Math.round((grandTotalHadir / grandTotalSessions) * 100) : 100,
        totalSessions: records.length
      };
    } catch (error) {
      console.error("Error fetching headmaster overview stats:", error);
      return {
        bySubject: [],
        byTeacher: [],
        byClass: [],
        overallPercentage: 100,
        totalSessions: 0
      };
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

