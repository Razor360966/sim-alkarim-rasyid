import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  writeBatch
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  ERaporTp,
  ERaporAssessment,
  ERaporAssessmentTpItem,
  ERaporPondokAssessment,
  ERaporExtracurricular,
  ERaporExtracurricularAssessment,
  ERaporClassVerification,
  ERaporClassVerificationStatus,
  ERaporGradeChangeRequest,
  ERaporAuditLog,
  ERaporSettingsConfig,
  ERaporLegerConfig,
  ERaporHistoricalAssessment,
  ERaporHistoricalAuditLog,
  ERaporLegerEntry,
  ERaporLegerSemesterScore,
  ERaporLegerSemesterColumn,
  ERaporSubjectCompleteness,
  ERaporStudentCompleteness,
  ERaporExecutiveDrilldownItem
} from "../types/eRapor.types";
import { Student, Subject, AcademicYear, Semester } from "../types";
import { AppConfig, APP_CONFIG } from "../config/appConfig";
import { academicYearService } from "./academicYear.service";
import { semesterService } from "./semester.service";
import { studentService } from "./studentService";
import { subjectService } from "./subjectService";
import { getSubjectGroupType, isSubjectReportVisible } from "../utils/subjectHelper";

const COLLECTION_TPS = "e_rapor_tps";
const COLLECTION_ASSESSMENTS = "e_rapor_assessments";
const COLLECTION_PONDOK_ASSESSMENTS = "e_rapor_pondok_assessments";
const COLLECTION_EXTRACURRICULAR_ASSESSMENTS = "e_rapor_extracurricular_assessments";
const COLLECTION_VERIFICATIONS = "e_rapor_class_verifications";
const COLLECTION_GRADE_REQUESTS = "e_rapor_grade_change_requests";
const COLLECTION_AUDIT_LOGS = "e_rapor_audit_logs";
const COLLECTION_HISTORICAL_ASSESSMENTS = "e_rapor_historical_assessments";
const COLLECTION_HISTORICAL_AUDIT_LOGS = "e_rapor_historical_audit_logs";

export function classifySubjectType(data: any): "UMUM" | "PONDOK" {
  if (!data) return "UMUM";
  const groupType = getSubjectGroupType(data);
  if (groupType === "KEPESANTRENAN") return "PONDOK";
  return "UMUM";
}
const COLLECTION_SETTINGS = "e_rapor_settings";

export const DEFAULT_RAPOR_SETTINGS: ERaporSettingsConfig = {
  tpWeight: 60,
  utsWeight: 20,
  sasWeight: 20,
  isOpen: true,
  legerConfig: {
    maxSemesters: 6,
    presetType: "6"
  },
  generalReport: {
    paperSize: "A4",
    orientation: "portrait"
  },
  pesantrenReport: {
    paperSize: "F4",
    orientation: "portrait"
  },
  headmasterName: "H. Abdullah, M.Pd.",
  headmasterSignatureUrl: "",
  generalReportHeader: {
    institutionName: "SMP ALKARIM RASYID",
    subTitle: "Sekolah Menengah Pertama Alkarim Rasyid Solok",
    address: "Jl. Alkarim Rasyid No. 1, Cibinong, Kabupaten Bogor, Jawa Barat 16911",
    phone: "(021) 1234567",
    email: "info@alkarimrasyid.sch.id",
    website: "www.alkarimrasyid.sch.id",
    logoUrl: "/logo.png"
  },
  pesantrenReportHeader: {
    institutionName: "PONDOK PESANTREN ALKARIM RASYID",
    subTitle: "Madrasah Diniyah & Pengasuhan Kepesantrenan",
    address: "Jl. Alkarim Rasyid No. 1, Cibinong, Kabupaten Bogor, Jawa Barat 16911",
    phone: "081234567890",
    email: "pesantren@alkarimrasyid.sch.id",
    website: "www.alkarimrasyid.sch.id",
    logoUrl: "/logo.png"
  }
};

export const eRaporService = {
  // ----------------------------------------------------
  // 1. SETTINGS MANAGEMENT
  // ----------------------------------------------------
  async getSettings(): Promise<ERaporSettingsConfig> {
    try {
      // Sync headmaster info from school_settings/identity (SSOT)
      let ssotPrincipalName = "";
      let ssotSignatureUrl = "";
      try {
        const idenSnap = await getDoc(doc(db, "school_settings", "identity"));
        if (idenSnap.exists()) {
          const idData = idenSnap.data();
          ssotPrincipalName = idData.principalName || idData.headmasterName || "";
          ssotSignatureUrl = idData.principalSignatureUrl || idData.headmasterSignatureUrl || "";
        }
      } catch (e) {
        console.warn("Error reading school_settings/identity in getSettings:", e);
      }

      const docRef = doc(db, COLLECTION_SETTINGS, "config");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...DEFAULT_RAPOR_SETTINGS,
          ...data,
          generalReport: {
            ...DEFAULT_RAPOR_SETTINGS.generalReport,
            ...(data.generalReport || {})
          },
          pesantrenReport: {
            ...DEFAULT_RAPOR_SETTINGS.pesantrenReport,
            ...(data.pesantrenReport || {})
          },
          generalReportHeader: {
            ...DEFAULT_RAPOR_SETTINGS.generalReportHeader,
            ...(data.generalReportHeader || {})
          },
          pesantrenReportHeader: {
            ...DEFAULT_RAPOR_SETTINGS.pesantrenReportHeader,
            ...(data.pesantrenReportHeader || {})
          },
          headmasterName: data.headmasterName || ssotPrincipalName || DEFAULT_RAPOR_SETTINGS.headmasterName,
          headmasterSignatureUrl: data.headmasterSignatureUrl || ssotSignatureUrl || DEFAULT_RAPOR_SETTINGS.headmasterSignatureUrl
        } as ERaporSettingsConfig;
      }
      return {
        ...DEFAULT_RAPOR_SETTINGS,
        headmasterName: ssotPrincipalName || DEFAULT_RAPOR_SETTINGS.headmasterName,
        headmasterSignatureUrl: ssotSignatureUrl || DEFAULT_RAPOR_SETTINGS.headmasterSignatureUrl
      };
    } catch (error) {
      console.error("Error fetching e-Rapor settings:", error);
      return DEFAULT_RAPOR_SETTINGS;
    }
  },

  async saveSettings(config: Partial<ERaporSettingsConfig>, updatedBy: string): Promise<void> {
    const docRef = doc(db, COLLECTION_SETTINGS, "config");
    await setDoc(docRef, {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy
    }, { merge: true });

    // Sync SSOT principal fields to school_settings/identity doc as well
    if (config.headmasterName !== undefined || config.headmasterSignatureUrl !== undefined) {
      try {
        const schoolIdenRef = doc(db, "school_settings", "identity");
        const updatePayload: Record<string, any> = {};
        if (config.headmasterName !== undefined) {
          updatePayload.principalName = config.headmasterName;
          updatePayload.headmasterName = config.headmasterName;
        }
        if (config.headmasterSignatureUrl !== undefined) {
          updatePayload.principalSignatureUrl = config.headmasterSignatureUrl;
          updatePayload.headmasterSignatureUrl = config.headmasterSignatureUrl;
        }
        await setDoc(schoolIdenRef, updatePayload, { merge: true });
      } catch (err) {
        console.warn("Could not sync headmaster info to school_settings/identity:", err);
      }
    }
  },

  // ----------------------------------------------------
  // 2. TP (TUJUAN PEMBELAJARAN) MANAGEMENT & SYNC
  // ----------------------------------------------------
  async getTps(academicYearId: string, semesterId: string, gradeLevel: string, subjectId: string): Promise<ERaporTp[]> {
    try {
      const colRef = collection(db, COLLECTION_TPS);
      const q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("gradeLevel", "==", gradeLevel),
        where("subjectId", "==", subjectId)
      );
      const snap = await getDocs(q);
      const tps: ERaporTp[] = [];
      snap.forEach((d) => {
        tps.push({ id: d.id, ...d.data() } as ERaporTp);
      });
      return tps.sort((a, b) => a.order - b.order);
    } catch (error) {
      console.error("Error fetching e-Rapor TPs:", error);
      return [];
    }
  },

  async syncTpsFromProtaPromes(
    academicYearId: string,
    semesterId: string,
    gradeLevel: string,
    subjectId: string,
    subjectName: string,
    createdBy: string
  ): Promise<ERaporTp[]> {
    const existing = await this.getTps(academicYearId, semesterId, gradeLevel, subjectId);
    if (existing.length > 0) {
      return existing;
    }

    let candidateTitles: string[] = [];
    try {
      const promesRef = collection(db, "semester_programs");
      const q = query(
        promesRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("gradeLevel", "==", gradeLevel),
        where("subjectId", "==", subjectId)
      );
      const promesSnap = await getDocs(q);
      promesSnap.forEach((d) => {
        const data = d.data();
        if (data.materials && Array.isArray(data.materials)) {
          data.materials.forEach((m: any) => {
            if (m.tp && typeof m.tp === "string" && m.tp.trim() !== "") {
              candidateTitles.push(m.tp.trim());
            } else if (m.topic && typeof m.topic === "string" && m.topic.trim() !== "") {
              candidateTitles.push(`Memahami dan menguasai materi ${m.topic.trim()}`);
            }
          });
        }
      });
    } catch (e) {
      console.warn("Could not load TPs from semester_programs:", e);
    }

    candidateTitles = Array.from(new Set(candidateTitles));

    if (candidateTitles.length === 0) {
      candidateTitles = [
        `Memahami konsep dasar dan teori materi ${subjectName}`,
        `Menerapkan dan menganalisis modul latihan ${subjectName}`,
        `Melakukan evaluasi dan penyelesaian studi kasus ${subjectName}`,
        `Membuat karya/praktikum pemahaman ${subjectName}`
      ];
    }

    const created: ERaporTp[] = [];
    for (let i = 0; i < candidateTitles.length; i++) {
      const tpData: Omit<ERaporTp, "id"> = {
        academicYearId,
        semesterId,
        gradeLevel,
        subjectId,
        subjectName,
        code: `TP ${i + 1}`,
        title: candidateTitles[i],
        order: i + 1,
        createdAt: new Date().toISOString(),
        createdBy,
        updatedAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, COLLECTION_TPS), tpData);
      created.push({ id: docRef.id, ...tpData });
    }

    return created;
  },

  async saveTp(tp: Partial<ERaporTp>, createdBy: string): Promise<void> {
    if (tp.id) {
      const docRef = doc(db, COLLECTION_TPS, tp.id);
      await updateDoc(docRef, {
        ...tp,
        updatedAt: new Date().toISOString()
      });
    } else {
      await addDoc(collection(db, COLLECTION_TPS), {
        ...tp,
        createdAt: new Date().toISOString(),
        createdBy,
        updatedAt: new Date().toISOString()
      });
    }
  },

  async deleteTp(tpId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_TPS, tpId);
    await setDoc(docRef, { active: false }, { merge: true });
  },

  // ----------------------------------------------------
  // 3. RAPOR UMUM ASSESSMENTS ENGINE
  // ----------------------------------------------------
  async getAssessmentsForClassSubject(
    academicYearId: string,
    semesterId: string,
    classId: string,
    subjectId: string
  ): Promise<ERaporAssessment[]> {
    try {
      const colRef = collection(db, COLLECTION_ASSESSMENTS);
      const q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("classId", "==", classId),
        where("subjectId", "==", subjectId)
      );
      const snap = await getDocs(q);
      const results: ERaporAssessment[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as ERaporAssessment);
      });
      return results;
    } catch (error) {
      console.error("Error fetching assessments for class & subject:", error);
      return [];
    }
  },

  autoGenerateDescription(tpScores: ERaporAssessmentTpItem[], subjectName: string, finalScore: number | null): string {
    if (finalScore === null || !tpScores || tpScores.length === 0) return "Belum ada penilaian.";

    const filledTps = tpScores.filter((t) => t.score !== null && t.score !== undefined);
    if (filledTps.length === 0) return `Telah mengikuti pembelajaran ${subjectName}.`;

    const sorted = [...filledTps].sort((a, b) => (b.score || 0) - (a.score || 0));
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    let desc = "";
    if (highest && highest.score !== null && highest.score >= 75) {
      desc += `Menunjukkan penguasaan yang SANGAT BAIK dalam ${highest.tpTitle || highest.tpCode}`;
    } else if (highest) {
      desc += `Menunjukkan penguasaan BAIK dalam ${highest.tpTitle || highest.tpCode}`;
    }

    if (lowest && lowest.score !== null && lowest.score < 75 && lowest.tpCode !== highest?.tpCode) {
      desc += `, serta perlu peningkatan pendampingan pada ${lowest.tpTitle || lowest.tpCode}.`;
    } else {
      desc += `.`;
    }

    return desc;
  },

  calculateAssessmentResult(
    tpScores: ERaporAssessmentTpItem[],
    utsScore: number | null,
    sasScore: number | null,
    settings: ERaporSettingsConfig
  ): { tpAverage: number | null; finalScore: number | null; status: "BELUM_LENGKAP" | "LENGKAP" } {
    const validTpScores = tpScores.map(t => t.score).filter((s): s is number => s !== null && s !== undefined && !isNaN(s));
    const isAllTpFilled = tpScores.length > 0 && validTpScores.length === tpScores.length;

    let tpAverage: number | null = null;
    if (validTpScores.length > 0) {
      const sum = validTpScores.reduce((acc, curr) => acc + curr, 0);
      tpAverage = Math.round(sum / validTpScores.length);
    }

    const isUtsFilled = utsScore !== null && utsScore !== undefined && !isNaN(utsScore);
    const isSasFilled = sasScore !== null && sasScore !== undefined && !isNaN(sasScore);

    let finalScore: number | null = null;
    if (tpAverage !== null || isUtsFilled || isSasFilled) {
      const weightTP = settings.tpWeight || 60;
      const weightUTS = settings.utsWeight || 20;
      const weightSAS = settings.sasWeight || 20;
      const totalWeight = weightTP + weightUTS + weightSAS;

      const valTP = tpAverage ?? 0;
      const valUTS = isUtsFilled ? (utsScore as number) : 0;
      const valSAS = isSasFilled ? (sasScore as number) : 0;

      const rawFinal = (valTP * weightTP + valUTS * weightUTS + valSAS * weightSAS) / (totalWeight || 100);
      finalScore = Math.min(100, Math.max(0, Math.round(rawFinal)));
    }

    const status = (isAllTpFilled && isUtsFilled && isSasFilled) ? "LENGKAP" : "BELUM_LENGKAP";

    return { tpAverage, finalScore, status };
  },

  async saveBatchAssessments(
    assessments: Partial<ERaporAssessment>[],
    currentUserId: string,
    currentUserName: string,
    settings: ERaporSettingsConfig
  ): Promise<void> {
    const batch = writeBatch(db);
    const nowStr = new Date().toISOString();

    for (const item of assessments) {
      if (!item.academicYearId || !item.semesterId || !item.classId || !item.subjectId || !item.studentId) {
        continue;
      }

      const docId = `${item.academicYearId}_${item.semesterId}_${item.classId}_${item.subjectId}_${item.studentId}`;
      const docRef = doc(db, COLLECTION_ASSESSMENTS, docId);

      const tpScores: ERaporAssessmentTpItem[] = (item.tpScores || []).map((t) => ({
        tpId: t.tpId,
        tpCode: t.tpCode,
        tpTitle: t.tpTitle || "",
        score: (t.score !== null && t.score !== undefined && !isNaN(t.score)) ? Math.min(100, Math.max(0, Number(t.score))) : null
      }));

      const utsScore = (item.utsScore !== null && item.utsScore !== undefined && !isNaN(item.utsScore))
        ? Math.min(100, Math.max(0, Number(item.utsScore)))
        : null;

      const sasScore = (item.sasScore !== null && item.sasScore !== undefined && !isNaN(item.sasScore))
        ? Math.min(100, Math.max(0, Number(item.sasScore)))
        : null;

      const { tpAverage, finalScore, status } = this.calculateAssessmentResult(tpScores, utsScore, sasScore, settings);

      const autoDesc = this.autoGenerateDescription(tpScores, item.subjectId || "Mata Pelajaran", finalScore);

      const payload: ERaporAssessment = {
        academicYearId: item.academicYearId,
        semesterId: item.semesterId,
        classId: item.classId,
        subjectId: item.subjectId,
        studentId: item.studentId,
        studentName: item.studentName || "",
        studentNis: item.studentNis || "",
        teacherId: item.teacherId || currentUserId,
        tpScores,
        utsScore,
        sasScore,
        tpAverage,
        finalScore,
        status,
        description: item.description && item.description.trim() !== "" ? item.description : autoDesc,
        updatedAt: nowStr,
        updatedBy: currentUserName
      };

      batch.set(docRef, payload, { merge: true });
    }

    await batch.commit();
  },

  // ----------------------------------------------------
  // 4. RAPOR PONDOK ASSESSMENTS ENGINE
  // ----------------------------------------------------
  async getPondokAssessmentsForClassSubject(
    academicYearId: string,
    semesterId: string,
    classId: string,
    subjectId: string
  ): Promise<ERaporPondokAssessment[]> {
    try {
      const colRef = collection(db, COLLECTION_PONDOK_ASSESSMENTS);
      const q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("classId", "==", classId),
        where("subjectId", "==", subjectId)
      );
      const snap = await getDocs(q);
      const results: ERaporPondokAssessment[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as ERaporPondokAssessment);
      });
      return results;
    } catch (error) {
      console.error("Error fetching Pondok assessments:", error);
      return [];
    }
  },

  async saveBatchPondokAssessments(
    assessments: Partial<ERaporPondokAssessment>[],
    currentUserId: string,
    currentUserName: string
  ): Promise<void> {
    const batch = writeBatch(db);
    const nowStr = new Date().toISOString();

    for (const item of assessments) {
      if (!item.academicYearId || !item.semesterId || !item.classId || !item.subjectId || !item.studentId) {
        continue;
      }

      const docId = `${item.academicYearId}_${item.semesterId}_${item.classId}_${item.subjectId}_${item.studentId}`;
      const docRef = doc(db, COLLECTION_PONDOK_ASSESSMENTS, docId);

      const scoreNum = (item.score !== null && item.score !== undefined && !isNaN(item.score))
        ? Math.min(100, Math.max(0, Number(item.score)))
        : null;

      const isComplete = scoreNum !== null && Boolean(item.ketercapaian && item.ketercapaian.trim().length > 0);

      const payload: ERaporPondokAssessment = {
        academicYearId: item.academicYearId,
        semesterId: item.semesterId,
        classId: item.classId,
        subjectId: item.subjectId,
        subjectName: item.subjectName || "",
        studentId: item.studentId,
        studentName: item.studentName || "",
        studentNis: item.studentNis || "",
        teacherId: item.teacherId || currentUserId,
        score: scoreNum,
        ketercapaian: item.ketercapaian || "",
        notes: item.notes || "",
        status: isComplete ? "LENGKAP" : "BELUM_LENGKAP",
        updatedAt: nowStr,
        updatedBy: currentUserName
      };

      batch.set(docRef, payload, { merge: true });
    }

    await batch.commit();
  },

  // ----------------------------------------------------
  // 5. RAPOR EKSTRAKURIKULER ASSESSMENTS ENGINE
  // ----------------------------------------------------
  async getExtracurricularAssessments(
    academicYearId: string,
    semesterId: string,
    extracurricularId: string,
    classId?: string
  ): Promise<ERaporExtracurricularAssessment[]> {
    try {
      const colRef = collection(db, COLLECTION_EXTRACURRICULAR_ASSESSMENTS);
      let q = query(
        colRef,
        where("academicYearId", "==", academicYearId),
        where("semesterId", "==", semesterId),
        where("extracurricularId", "==", extracurricularId)
      );
      if (classId) {
        q = query(
          colRef,
          where("academicYearId", "==", academicYearId),
          where("semesterId", "==", semesterId),
          where("extracurricularId", "==", extracurricularId),
          where("classId", "==", classId)
        );
      }
      const snap = await getDocs(q);
      const results: ERaporExtracurricularAssessment[] = [];
      snap.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as ERaporExtracurricularAssessment);
      });
      return results;
    } catch (error) {
      console.error("Error fetching extracurricular assessments:", error);
      return [];
    }
  },

  async saveBatchExtracurricularAssessments(
    assessments: Partial<ERaporExtracurricularAssessment>[],
    currentUserId: string,
    currentUserName: string
  ): Promise<void> {
    const batch = writeBatch(db);
    const nowStr = new Date().toISOString();

    for (const item of assessments) {
      if (!item.academicYearId || !item.semesterId || !item.extracurricularId || !item.studentId) {
        continue;
      }

      const docId = `${item.academicYearId}_${item.semesterId}_${item.extracurricularId}_${item.studentId}`;
      const docRef = doc(db, COLLECTION_EXTRACURRICULAR_ASSESSMENTS, docId);

      const isComplete = Boolean(item.progress && item.progress.trim().length > 0);

      const payload: ERaporExtracurricularAssessment = {
        academicYearId: item.academicYearId,
        semesterId: item.semesterId,
        classId: item.classId || "",
        className: item.className || "",
        extracurricularId: item.extracurricularId,
        extracurricularName: item.extracurricularName || "",
        pembinaId: item.pembinaId || currentUserId,
        pembinaName: item.pembinaName || currentUserName,
        studentId: item.studentId,
        studentName: item.studentName || "",
        studentNis: item.studentNis || "",
        participationStatus: item.participationStatus || "Aktif",
        progress: item.progress || "",
        notes: item.notes || "",
        grade: item.grade || "Sangat Baik",
        status: isComplete ? "LENGKAP" : "BELUM_LENGKAP",
        updatedAt: nowStr,
        updatedBy: currentUserName
      };

      batch.set(docRef, payload, { merge: true });
    }

    await batch.commit();
  },

  // ----------------------------------------------------
  // 6. HOMEROOM VERIFICATION & LOCKING
  // ----------------------------------------------------
  async getClassVerification(academicYearId: string, semesterId: string, classId: string): Promise<ERaporClassVerification | null> {
    try {
      const docId = `${academicYearId}_${semesterId}_${classId}`;
      const docRef = doc(db, COLLECTION_VERIFICATIONS, docId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as ERaporClassVerification;
      }
      return null;
    } catch (e) {
      console.error("Error fetching class verification:", e);
      return null;
    }
  },

  async verifyAndLockClass(
    academicYearId: string,
    semesterId: string,
    classId: string,
    className: string,
    homeroomTeacherId: string,
    homeroomTeacherName: string,
    targetStatus: "TERVERIFIKASI" | "LOCKED",
    notes: string,
    isCheckOnly: boolean = false
  ): Promise<{ success: boolean; message: string; uncompletedBreakdown?: string[] }> {
    const schedulesRef = collection(db, "schedules");
    const schedQuery = query(
      schedulesRef,
      where("academicYearId", "==", academicYearId),
      where("semesterId", "==", semesterId),
      where("classId", "==", classId)
    );
    const schedSnap = await getDocs(schedQuery);

    const subjectMap = new Map<string, { name: string; type: "UMUM" | "PONDOK" }>();
    
    // Fetch all subjects to check type
    const subjSnap = await getDocs(collection(db, "subjects"));
    const subjectMasterMap = new Map<string, Subject>();
    subjSnap.forEach((d) => {
      const data = d.data();
      const fallbackType: "UMUM" | "PONDOK" = classifySubjectType(data);
      subjectMasterMap.set(d.id, { id: d.id, ...data, subjectType: fallbackType } as Subject);
    });

    schedSnap.forEach((d) => {
      const data = d.data();
      if (data.subjectId) {
        const masterSubj = subjectMasterMap.get(data.subjectId);
        // Exclude subjects that are set to TIDAK_TAMPIL_RAPOR
        if (masterSubj && !isSubjectReportVisible(masterSubj)) {
          return;
        }
        const subjType = classifySubjectType(masterSubj);
        subjectMap.set(data.subjectId, {
          name: data.subjectName || masterSubj?.name || "Mata Pelajaran",
          type: subjType
        });
      }
    });

    const studentsRef = collection(db, "students");
    const studentQuery = query(studentsRef, where("classId", "==", classId), where("active", "==", true));
    const studentSnap = await getDocs(studentQuery);
    const studentIds: string[] = [];
    studentSnap.forEach((d) => studentIds.push(d.id));

    if (studentIds.length === 0) {
      return { success: false, message: `Tidak ada siswa aktif terdaftar di kelas ${className}.` };
    }

    const uncompletedBreakdown: string[] = [];

    for (const [subjId, meta] of Array.from(subjectMap.entries())) {
      if (meta.type === "PONDOK") {
        const pAss = await this.getPondokAssessmentsForClassSubject(academicYearId, semesterId, classId, subjId);
        const pMap = new Map<string, ERaporPondokAssessment>();
        pAss.forEach((a) => pMap.set(a.studentId, a));

        let missing = 0;
        studentIds.forEach((sId) => {
          const ass = pMap.get(sId);
          if (!ass || ass.status !== "LENGKAP") missing++;
        });

        if (missing > 0) {
          uncompletedBreakdown.push(`[Pondok] ${meta.name}: ${missing} santri belum memiliki nilai/ketercapaian lengkap.`);
        }
      } else {
        const assessments = await this.getAssessmentsForClassSubject(academicYearId, semesterId, classId, subjId);
        const assessmentMap = new Map<string, ERaporAssessment>();
        assessments.forEach((a) => assessmentMap.set(a.studentId, a));

        let missing = 0;
        studentIds.forEach((sId) => {
          const ass = assessmentMap.get(sId);
          if (!ass || ass.status !== "LENGKAP") missing++;
        });

        if (missing > 0) {
          uncompletedBreakdown.push(`[Umum] ${meta.name}: ${missing} santri belum memiliki nilai TP/UTS/SAS lengkap.`);
        }
      }
    }

    if (uncompletedBreakdown.length > 0) {
      return {
        success: false,
        message: `Rapor kelas ${className} belum dapat diverifikasi karena masih terdapat ${uncompletedBreakdown.length} mata pelajaran yang belum lengkap.`,
        uncompletedBreakdown
      };
    }

    if (isCheckOnly) {
      return { success: true, message: `Seluruh nilai kelas ${className} telah 100% LENGKAP dan siap diverifikasi/dikunci.` };
    }

    const docId = `${academicYearId}_${semesterId}_${classId}`;
    const docRef = doc(db, COLLECTION_VERIFICATIONS, docId);
    const payload: ERaporClassVerification = {
      academicYearId,
      semesterId,
      classId,
      className,
      homeroomTeacherId,
      homeroomTeacherName,
      status: targetStatus,
      verifiedAt: new Date().toISOString(),
      verifiedBy: homeroomTeacherName,
      notes,
      updatedAt: new Date().toISOString()
    };

    await setDoc(docRef, payload, { merge: true });

    return {
      success: true,
      message: `Status kelas ${className} berhasil diubah menjadi ${targetStatus}.`
    };
  },

  // ----------------------------------------------------
  // 7. GRADE CHANGE REQUEST FLOW
  // ----------------------------------------------------
  async requestGradeChange(req: Omit<ERaporGradeChangeRequest, "id" | "status" | "requestedAt">): Promise<void> {
    await addDoc(collection(db, COLLECTION_GRADE_REQUESTS), {
      ...req,
      status: "PENDING",
      requestedAt: new Date().toISOString()
    });
  },

  async getPendingGradeRequests(classId?: string, teacherId?: string): Promise<ERaporGradeChangeRequest[]> {
    const colRef = collection(db, COLLECTION_GRADE_REQUESTS);
    let q = query(colRef, where("status", "==", "PENDING"));
    if (classId) {
      q = query(colRef, where("classId", "==", classId), where("status", "==", "PENDING"));
    }
    const snap = await getDocs(q);
    const requests: ERaporGradeChangeRequest[] = [];
    snap.forEach((d) => {
      requests.push({ id: d.id, ...d.data() } as ERaporGradeChangeRequest);
    });
    return requests;
  },

  async processGradeChangeRequest(
    requestId: string,
    status: "APPROVED" | "REJECTED",
    processedBy: string,
    notes?: string
  ): Promise<void> {
    const docRef = doc(db, COLLECTION_GRADE_REQUESTS, requestId);
    await updateDoc(docRef, {
      status,
      processedBy,
      processedAt: new Date().toISOString(),
      notes: notes || ""
    });
  },

  // ----------------------------------------------------
  // 8. HOMEROOM MONITORING DATA
  // ----------------------------------------------------
  async getHomeroomMonitoringData(
    academicYearId: string,
    semesterId: string,
    classId: string
  ): Promise<{
    generalCompleteness: ERaporSubjectCompleteness[];
    pondokCompleteness: ERaporSubjectCompleteness[];
    extracurricularCompleteness: any[];
    studentCompleteness: ERaporStudentCompleteness[];
    isClassVerified: boolean;
    verificationStatus: ERaporClassVerificationStatus;
  }> {
    const ver = await this.getClassVerification(academicYearId, semesterId, classId);
    const verificationStatus = ver?.status || "DRAFT";
    const isClassVerified = verificationStatus === "TERVERIFIKASI" || verificationStatus === "LOCKED";

    const studentsRef = collection(db, "students");
    const sQuery = query(studentsRef, where("classId", "==", classId), where("active", "==", true));
    const sSnap = await getDocs(sQuery);
    const students: Student[] = [];
    sSnap.forEach((d) => students.push({ id: d.id, ...d.data() } as Student));

    // Subject master map
    const subjSnap = await getDocs(collection(db, "subjects"));
    const subjectMasterMap = new Map<string, Subject>();
    subjSnap.forEach((d) => {
      const data = d.data();
      const fallbackType: "UMUM" | "PONDOK" = classifySubjectType(data);
      subjectMasterMap.set(d.id, { id: d.id, ...data, subjectType: fallbackType } as Subject);
    });

    const schedRef = collection(db, "schedules");
    const schedQ = query(
      schedRef,
      where("academicYearId", "==", academicYearId),
      where("semesterId", "==", semesterId),
      where("classId", "==", classId)
    );
    const schedSnap = await getDocs(schedQ);
    const subjectsMap = new Map<string, { subjectName: string; teacherId: string; teacherName: string; type: "UMUM" | "PONDOK" }>();

    schedSnap.forEach((d) => {
      const data = d.data();
      if (data.subjectId && !subjectsMap.has(data.subjectId)) {
        const masterSubj = subjectMasterMap.get(data.subjectId);
        // Exclude subjects that are set to TIDAK_TAMPIL_RAPOR from report card completeness monitoring
        if (masterSubj && !isSubjectReportVisible(masterSubj)) {
          return;
        }
        const subjType = classifySubjectType(masterSubj);
        subjectsMap.set(data.subjectId, {
          subjectName: data.subjectName || masterSubj?.name || "Mata Pelajaran",
          teacherId: data.teacherId || "",
          teacherName: data.teacherName || "Guru Pengampu",
          type: subjType
        });
      }
    });

    const generalCompleteness: ERaporSubjectCompleteness[] = [];
    const pondokCompleteness: ERaporSubjectCompleteness[] = [];

    for (const [subjId, meta] of Array.from(subjectsMap.entries())) {
      if (meta.type === "PONDOK") {
        const pAss = await this.getPondokAssessmentsForClassSubject(academicYearId, semesterId, classId, subjId);
        const pMap = new Map<string, ERaporPondokAssessment>();
        pAss.forEach((a) => pMap.set(a.studentId, a));

        let completedCount = 0;
        students.forEach((st) => {
          const ass = pMap.get(st.id!);
          if (ass && ass.status === "LENGKAP") completedCount++;
        });

        const isComplete = students.length > 0 && completedCount === students.length;
        pondokCompleteness.push({
          subjectId: subjId,
          subjectName: meta.subjectName,
          teacherId: meta.teacherId,
          teacherName: meta.teacherName,
          totalStudents: students.length,
          completedStudents: completedCount,
          tpFilledCount: completedCount,
          tpTotalCount: students.length,
          utsFilledCount: completedCount,
          sasFilledCount: completedCount,
          isComplete,
          statusText: isComplete ? "LENGKAP" : "BELUM_LENGKAP"
        });
      } else {
        const assessments = await this.getAssessmentsForClassSubject(academicYearId, semesterId, classId, subjId);
        const assMap = new Map<string, ERaporAssessment>();
        assessments.forEach((a) => assMap.set(a.studentId, a));

        let completedCount = 0;
        let tpFilled = 0;
        let tpTotal = 0;
        let utsFilled = 0;
        let sasFilled = 0;

        students.forEach((st) => {
          const ass = assMap.get(st.id!);
          if (ass) {
            if (ass.status === "LENGKAP") completedCount++;
            if (ass.utsScore !== null) utsFilled++;
            if (ass.sasScore !== null) sasFilled++;
            if (ass.tpScores) {
              tpTotal += ass.tpScores.length;
              tpFilled += ass.tpScores.filter((t) => t.score !== null).length;
            }
          }
        });

        const isSubjComplete = students.length > 0 && completedCount === students.length;
        generalCompleteness.push({
          subjectId: subjId,
          subjectName: meta.subjectName,
          teacherId: meta.teacherId,
          teacherName: meta.teacherName,
          totalStudents: students.length,
          completedStudents: completedCount,
          tpFilledCount: tpFilled,
          tpTotalCount: tpTotal || (students.length * 4),
          utsFilledCount: utsFilled,
          sasFilledCount: sasFilled,
          isComplete: isSubjComplete,
          statusText: isSubjComplete ? "LENGKAP" : "BELUM_LENGKAP"
        });
      }
    }

    return {
      generalCompleteness,
      pondokCompleteness,
      extracurricularCompleteness: [],
      studentCompleteness: [],
      isClassVerified,
      verificationStatus
    };
  },

  // ----------------------------------------------------
  // 9. EXECUTIVE DASHBOARD MONITORING
  // ----------------------------------------------------
  async getExecutiveMonitoringData(academicYearId: string, semesterId: string): Promise<{
    summary: {
      totalTeachers: number;
      completedTeachers: number;
      totalSubjects: number;
      completedSubjects: number;
      totalClasses: number;
      completedClasses: number;
      totalStudents: number;
      tpPercentage: number;
      utsPercentage: number;
      sasPercentage: number;
      overallPercentage: number;
    };
    drilldownItems: ERaporExecutiveDrilldownItem[];
  }> {
    const schedRef = collection(db, "schedules");
    const q = query(schedRef, where("academicYearId", "==", academicYearId), where("semesterId", "==", semesterId));
    const snap = await getDocs(q);

    const classSubjectMap = new Map<string, { classId: string; className: string; subjectId: string; subjectName: string; teacherId: string; teacherName: string }>();
    const teacherIds = new Set<string>();
    const subjectIds = new Set<string>();
    const classIds = new Set<string>();

    snap.forEach((d) => {
      const data = d.data();
      if (data.classId && data.subjectId) {
        const key = `${data.classId}_${data.subjectId}`;
        if (!classSubjectMap.has(key)) {
          classSubjectMap.set(key, {
            classId: data.classId,
            className: data.className || "Kelas",
            subjectId: data.subjectId,
            subjectName: data.subjectName || "Mapel",
            teacherId: data.teacherId || "",
            teacherName: data.teacherName || "Guru"
          });
        }
        if (data.teacherId) teacherIds.add(data.teacherId);
        if (data.subjectId) subjectIds.add(data.subjectId);
        if (data.classId) classIds.add(data.classId);
      }
    });

    const studentsRef = collection(db, "students");
    const stSnap = await getDocs(query(studentsRef, where("active", "==", true)));
    const studentsByClass = new Map<string, Student[]>();
    stSnap.forEach((d) => {
      const st = { id: d.id, ...d.data() } as Student;
      if (st.classId) {
        if (!studentsByClass.has(st.classId)) studentsByClass.set(st.classId, []);
        studentsByClass.get(st.classId)!.push(st);
      }
    });

    let totalStudents = 0;
    Array.from(studentsByClass.values()).forEach((list) => { totalStudents += list.length; });

    let totalPairs = classSubjectMap.size;
    let completedPairs = 0;

    const drilldownItems: ERaporExecutiveDrilldownItem[] = [];

    for (const item of Array.from(classSubjectMap.values())) {
      const classStudents = studentsByClass.get(item.classId) || [];
      if (classStudents.length === 0) continue;

      const assessments = await this.getAssessmentsForClassSubject(academicYearId, semesterId, item.classId, item.subjectId);
      const isComplete = assessments.length > 0 && assessments.filter((a) => a.status === "LENGKAP").length === classStudents.length;

      if (isComplete) {
        completedPairs++;
      } else {
        drilldownItems.push({
          teacherId: item.teacherId,
          teacherName: item.teacherName,
          classId: item.classId,
          className: item.className,
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          missingParts: ["Nilai/Ketercapaian belum 100% terisi"]
        });
      }
    }

    const overallPercentage = totalPairs > 0 ? Math.round((completedPairs / totalPairs) * 100) : 100;

    return {
      summary: {
        totalTeachers: teacherIds.size,
        completedTeachers: Math.round(teacherIds.size * (overallPercentage / 100)),
        totalSubjects: subjectIds.size,
        completedSubjects: Math.round(subjectIds.size * (overallPercentage / 100)),
        totalClasses: classIds.size,
        completedClasses: Math.round(classIds.size * (overallPercentage / 100)),
        totalStudents,
        tpPercentage: overallPercentage,
        utsPercentage: overallPercentage,
        sasPercentage: overallPercentage,
        overallPercentage
      },
      drilldownItems
    };
  },

  // ----------------------------------------------------
  // 10. REPORT CARD COMPILER FOR PRINTING
  // ----------------------------------------------------
  async getReportCardDataForStudent(
    academicYearId: string,
    semesterId: string,
    classId: string,
    studentId: string
  ): Promise<{
    student: Student | null;
    className: string;
    homeroomTeacherName: string;
    identity: AppConfig | null;
    generalSubjects: {
      subjectName: string;
      group: string;
      finalScore: number | null;
      tpAverage: number | null;
      utsScore: number | null;
      sasScore: number | null;
      description: string;
    }[];
    pondokSubjects: {
      subjectName: string;
      score: number | null;
      ketercapaian: string;
    }[];
    extracurriculars: {
      name: string;
      participationStatus: string;
      progress: string;
      notes?: string;
    }[];
    verification: ERaporClassVerification | null;
  }> {
    const studentDoc = await getDoc(doc(db, "students", studentId));
    const student = studentDoc.exists() ? ({ id: studentDoc.id, ...studentDoc.data() } as Student) : null;

    const classDoc = await getDoc(doc(db, "classes", classId));
    const classData = classDoc.data();
    const className = classData?.name || "Kelas";
    const homeroomTeacherName = classData?.homeroomTeacherName || "Wali Kelas";

    const verification = await this.getClassVerification(academicYearId, semesterId, classId);

    let identity: AppConfig | null = APP_CONFIG;
    try {
      const idenSnap = await getDoc(doc(db, "school_settings", "identity"));
      if (idenSnap.exists()) {
        identity = { ...APP_CONFIG, ...idenSnap.data() } as AppConfig;
      }
    } catch (e) {
      console.warn("Could not load school identity:", e);
    }

    // Load subjects
    const subjSnap = await getDocs(collection(db, "subjects"));
    const subjectMasterMap = new Map<string, Subject>();
    subjSnap.forEach((d) => {
      const data = d.data();
      const fallbackType: "UMUM" | "PONDOK" = classifySubjectType(data);
      subjectMasterMap.set(d.id, { id: d.id, ...data, subjectType: fallbackType } as Subject);
    });

    const schedRef = collection(db, "schedules");
    const schedQ = query(
      schedRef,
      where("academicYearId", "==", academicYearId),
      where("semesterId", "==", semesterId),
      where("classId", "==", classId)
    );
    const schedSnap = await getDocs(schedQ);
    const subjectsMap = new Map<string, { subjectName: string; group: string; type: "UMUM" | "PONDOK" }>();

    schedSnap.forEach((d) => {
      const data = d.data();
      if (data.subjectId && !subjectsMap.has(data.subjectId)) {
        const masterSubj = subjectMasterMap.get(data.subjectId);
        // Exclude subjects that are set to TIDAK_TAMPIL_RAPOR from student report card
        if (masterSubj && !isSubjectReportVisible(masterSubj)) {
          return;
        }
        subjectsMap.set(data.subjectId, {
          subjectName: data.subjectName || masterSubj?.name || "Mata Pelajaran",
          group: data.group || masterSubj?.group || "A",
          type: classifySubjectType(masterSubj)
        });
      }
    });

    const generalSubjects: any[] = [];
    const pondokSubjects: any[] = [];

    for (const [subjId, meta] of Array.from(subjectsMap.entries())) {
      const docId = `${academicYearId}_${semesterId}_${classId}_${subjId}_${studentId}`;

      if (meta.type === "PONDOK") {
        const pSnap = await getDoc(doc(db, COLLECTION_PONDOK_ASSESSMENTS, docId));
        if (pSnap.exists()) {
          const data = pSnap.data() as ERaporPondokAssessment;
          pondokSubjects.push({
            subjectName: meta.subjectName,
            score: data.score,
            ketercapaian: data.ketercapaian || "Telah menyelesaikan modul pembelajaran pondok."
          });
        } else {
          pondokSubjects.push({
            subjectName: meta.subjectName,
            score: null,
            ketercapaian: "Belum ada penilaian."
          });
        }
      } else {
        const assSnap = await getDoc(doc(db, COLLECTION_ASSESSMENTS, docId));
        if (assSnap.exists()) {
          const ass = assSnap.data() as ERaporAssessment;
          generalSubjects.push({
            subjectName: meta.subjectName,
            group: meta.group,
            finalScore: ass.finalScore,
            tpAverage: ass.tpAverage,
            utsScore: ass.utsScore,
            sasScore: ass.sasScore,
            description: ass.description || this.autoGenerateDescription(ass.tpScores || [], meta.subjectName, ass.finalScore)
          });
        } else {
          generalSubjects.push({
            subjectName: meta.subjectName,
            group: meta.group,
            finalScore: null,
            tpAverage: null,
            utsScore: null,
            sasScore: null,
            description: "Belum ada penilaian."
          });
        }
      }
    }

    // Load Extracurriculars for student
    const ekskulCol = collection(db, COLLECTION_EXTRACURRICULAR_ASSESSMENTS);
    const ekskulQ = query(ekskulCol, where("academicYearId", "==", academicYearId), where("semesterId", "==", semesterId), where("studentId", "==", studentId));
    const ekskulSnap = await getDocs(ekskulQ);

    const extracurriculars: any[] = [];
    ekskulSnap.forEach((d) => {
      const data = d.data() as ERaporExtracurricularAssessment;
      extracurriculars.push({
        name: data.extracurricularName,
        participationStatus: data.participationStatus,
        progress: data.progress,
        notes: data.notes
      });
    });

    if (extracurriculars.length === 0) {
      extracurriculars.push({
        name: "Pramuka",
        participationStatus: "Aktif",
        progress: "Menunjukkan perkembangan baik dalam disiplin dan keterampilan kepramukaan.",
        notes: "-"
      });
    }

    return {
      student,
      className,
      homeroomTeacherName,
      identity,
      generalSubjects,
      pondokSubjects,
      extracurriculars,
      verification
    };
  },

  // ----------------------------------------------------
  // 12. LEGER MANAGEMENT & HISTORICAL ASSESSMENTS
  // ----------------------------------------------------
  async saveLegerConfig(config: ERaporLegerConfig, userId: string = "system"): Promise<void> {
    const current = await this.getSettings();
    const updated: ERaporSettingsConfig = {
      ...current,
      legerConfig: config,
      updatedAt: new Date().toISOString(),
      updatedBy: userId
    };
    await this.saveSettings(updated);
  },

  async getLegerSemesterColumns(maxSemestersOverride?: number): Promise<ERaporLegerSemesterColumn[]> {
    const settings = await this.getSettings();
    const configuredMax = settings.legerConfig?.maxSemesters || 6;
    const maxSemesters = maxSemestersOverride || configuredMax;

    // Fetch all academic years & semesters
    const [academicYears, semesters] = await Promise.all([
      academicYearService.getAcademicYears(),
      semesterService.getSemesters()
    ]);

    // Sort academic years ascending by name or start date
    const sortedAYs = [...academicYears].sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Build map for each sequence (1..maxSemesters)
    const sequenceMap: { [seq: number]: { ay?: AcademicYear; sem?: Semester } } = {};

    let seqCount = 1;
    for (const ay of sortedAYs) {
      const aySems = semesters.filter(s => s.academicYearId === ay.id);
      const sem1 = aySems.find(s => s.code === "S1" || (s.name || "").toLowerCase().includes("1"));
      const sem2 = aySems.find(s => s.code === "S2" || (s.name || "").toLowerCase().includes("2"));

      sequenceMap[seqCount] = { ay, sem: sem1 };
      seqCount++;

      sequenceMap[seqCount] = { ay, sem: sem2 };
      seqCount++;
    }

    const columns: ERaporLegerSemesterColumn[] = [];
    const gradeLevels = ["Kelas VII", "Kelas VII", "Kelas VIII", "Kelas VIII", "Kelas IX", "Kelas IX"];

    for (let i = 1; i <= maxSemesters; i++) {
      const item = sequenceMap[i];
      const defaultGrade = gradeLevels[i - 1] || `Tingkat ${Math.ceil(i / 2)}`;
      const semType = i % 2 === 1 ? "Ganjil" : "Genap";

      const label = `Sem ${i}`;
      let subLabel = `${defaultGrade} ${semType}`;
      if (item?.ay) {
        subLabel = `${defaultGrade} (${item.ay.name})`;
      }

      columns.push({
        sequence: i,
        label,
        subLabel,
        academicYearId: item?.ay?.id,
        semesterId: item?.sem?.id,
        academicYearName: item?.ay?.name,
        semesterName: item?.sem?.name
      });
    }

    return columns;
  },

  async getHistoricalAssessments(classId?: string, subjectId?: string): Promise<ERaporHistoricalAssessment[]> {
    try {
      const colRef = collection(db, COLLECTION_HISTORICAL_ASSESSMENTS);
      let q = query(colRef);
      if (classId) {
        q = query(colRef, where("classId", "==", classId));
      }
      const snap = await getDocs(q);
      const items: ERaporHistoricalAssessment[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as ERaporHistoricalAssessment;
        if (!subjectId || data.subjectId === subjectId) {
          items.push({ id: docSnap.id, ...data });
        }
      });
      return items;
    } catch (error) {
      console.error("Failed to fetch historical assessments:", error);
      return [];
    }
  },

  async saveHistoricalAssessment(
    payload: {
      academicYearId?: string;
      semesterId?: string;
      semesterSequence: number;
      classId: string;
      className?: string;
      subjectId: string;
      subjectName?: string;
      studentId: string;
      studentName?: string;
      score: number;
    },
    userId: string,
    userName: string,
    reason?: string
  ): Promise<void> {
    if (payload.score < 0 || payload.score > 100 || isNaN(payload.score)) {
      throw new Error("Nilai harus angka antara 0 dan 100!");
    }

    const docId = `HIST_${payload.classId}_${payload.subjectId}_${payload.studentId}_SEQ${payload.semesterSequence}`;
    const docRef = doc(db, COLLECTION_HISTORICAL_ASSESSMENTS, docId);

    let oldScore: number | null = null;
    try {
      const existingSnap = await getDoc(docRef);
      if (existingSnap.exists()) {
        oldScore = existingSnap.data().score ?? null;
      }
    } catch (e) {
      console.warn("Could not read existing historical assessment", e);
    }

    const now = new Date().toISOString();
    const historicalDoc: ERaporHistoricalAssessment = {
      id: docId,
      academicYearId: payload.academicYearId || "HISTORICAL_AY",
      semesterId: payload.semesterId || "HISTORICAL_SEM",
      semesterSequence: payload.semesterSequence,
      classId: payload.classId,
      className: payload.className || "",
      subjectId: payload.subjectId,
      subjectName: payload.subjectName || "",
      studentId: payload.studentId,
      studentName: payload.studentName || "",
      score: Number(payload.score),
      source: "HISTORICAL",
      enteredBy: userId,
      enteredByName: userName,
      enteredAt: now,
      updatedAt: now,
      updatedBy: userId,
      reason: reason || "Input/Edit Nilai Historis Leger"
    };

    await setDoc(docRef, historicalDoc, { merge: true });

    // Audit log entry
    try {
      const auditRef = doc(collection(db, COLLECTION_HISTORICAL_AUDIT_LOGS));
      const auditData: ERaporHistoricalAuditLog = {
        id: auditRef.id,
        studentId: payload.studentId,
        studentName: payload.studentName,
        subjectId: payload.subjectId,
        subjectName: payload.subjectName,
        semesterId: payload.semesterId || "HISTORICAL_SEM",
        semesterSequence: payload.semesterSequence,
        oldScore,
        newScore: Number(payload.score),
        changedBy: userId,
        changedByName: userName,
        changedAt: now,
        reason: reason || "Input/Edit Nilai Historis Leger"
      };
      await setDoc(auditRef, auditData);
    } catch (auditErr) {
      console.error("Failed to write historical audit log:", auditErr);
    }
  },

  async getLegerData(options: {
    classId: string;
    allowedSubjectIds?: string[];
    subjectTypeFilter?: "ALL" | "UMUM" | "PONDOK";
    maxSemesters?: number;
  }) {
    const { classId, allowedSubjectIds, subjectTypeFilter = "ALL", maxSemesters } = options;

    const columns = await this.getLegerSemesterColumns(maxSemesters);

    // Fetch students in class
    const allStudents = await studentService.getStudents();
    const students = allStudents
      .filter(s => s.classId === classId || s.className === classId)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // Fetch subjects
    const allSubjects = await subjectService.getSubjects();
    let subjects = allSubjects.filter(sub => isSubjectReportVisible(sub));

    if (allowedSubjectIds && allowedSubjectIds.length > 0) {
      subjects = subjects.filter(sub => allowedSubjectIds.includes(sub.id));
    }

    if (subjectTypeFilter !== "ALL") {
      subjects = subjects.filter(sub => classifySubjectType(sub) === subjectTypeFilter);
    }

    // Fetch e-Rapor assessments & Pondok assessments for classId
    const [eRaporAssSnap, pondokAssSnap, historicalAssList] = await Promise.all([
      getDocs(query(collection(db, COLLECTION_ASSESSMENTS), where("classId", "==", classId))),
      getDocs(query(collection(db, COLLECTION_PONDOK_ASSESSMENTS), where("classId", "==", classId))),
      this.getHistoricalAssessments(classId)
    ]);

    const eRaporMap = new Map<string, number>();
    eRaporAssSnap.forEach(d => {
      const data = d.data() as ERaporAssessment;
      if (data.finalScore !== null && data.finalScore !== undefined) {
        eRaporMap.set(`${data.academicYearId}_${data.semesterId}_${data.subjectId}_${data.studentId}`, data.finalScore);
      }
    });

    pondokAssSnap.forEach(d => {
      const data = d.data() as ERaporPondokAssessment;
      const score = data.score ?? data.finalScore ?? null;
      if (score !== null && score !== undefined) {
        eRaporMap.set(`${data.academicYearId}_${data.semesterId}_${data.subjectId}_${data.studentId}`, score);
      }
    });

    const historicalMap = new Map<string, number>();
    historicalAssList.forEach(item => {
      if (item.score !== null && item.score !== undefined) {
        historicalMap.set(`${item.subjectId}_${item.studentId}_SEQ${item.semesterSequence}`, item.score);
      }
    });

    const entries: ERaporLegerEntry[] = [];
    const semesterCompletenessCount: { [seq: number]: { filled: number; total: number } } = {};

    columns.forEach(col => {
      semesterCompletenessCount[col.sequence] = { filled: 0, total: 0 };
    });

    for (const student of students) {
      for (const subject of subjects) {
        const semesterScores: { [seq: number]: ERaporLegerSemesterScore } = {};
        const subType = classifySubjectType(subject);

        columns.forEach(col => {
          let finalVal: number | null = null;
          let sourceVal: "ERAPOR" | "HISTORICAL" | "NONE" = "NONE";

          // Priority 1: Official e-Rapor
          if (col.academicYearId && col.semesterId) {
            const eRaporKey = `${col.academicYearId}_${col.semesterId}_${subject.id}_${student.id}`;
            if (eRaporMap.has(eRaporKey)) {
              finalVal = eRaporMap.get(eRaporKey)!;
              sourceVal = "ERAPOR";
            }
          }

          // Priority 2: Historical Assessment
          if (sourceVal === "NONE") {
            const histKey = `${subject.id}_${student.id}_SEQ${col.sequence}`;
            if (historicalMap.has(histKey)) {
              finalVal = historicalMap.get(histKey)!;
              sourceVal = "HISTORICAL";
            }
          }

          semesterScores[col.sequence] = {
            score: finalVal,
            source: sourceVal,
            academicYearId: col.academicYearId,
            semesterId: col.semesterId
          };

          semesterCompletenessCount[col.sequence].total += 1;
          if (sourceVal !== "NONE") {
            semesterCompletenessCount[col.sequence].filled += 1;
          }
        });

        entries.push({
          studentId: student.id,
          studentName: student.name,
          studentNis: student.nis || "",
          studentNisn: student.nisn || "",
          classId: classId,
          className: student.className || classId,
          subjectId: subject.id,
          subjectName: subject.name,
          subjectGroup: subject.group || "",
          subjectType: subType,
          semesterScores
        });
      }
    }

    const semesterCompleteness: { [seq: number]: number } = {};
    let totalFilledSlots = 0;
    let totalSlots = 0;

    columns.forEach(col => {
      const item = semesterCompletenessCount[col.sequence];
      const pct = item.total > 0 ? Math.round((item.filled / item.total) * 100) : 0;
      semesterCompleteness[col.sequence] = pct;
      totalFilledSlots += item.filled;
      totalSlots += item.total;
    });

    const completePercentage = totalSlots > 0 ? Math.round((totalFilledSlots / totalSlots) * 100) : 0;

    return {
      entries,
      columns,
      students,
      subjects,
      stats: {
        totalStudents: students.length,
        totalSubjects: subjects.length,
        totalEntries: entries.length,
        completePercentage,
        semesterCompleteness
      }
    };
  }
};

