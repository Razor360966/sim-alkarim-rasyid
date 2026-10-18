/**
 * midtermReport.service.ts
 * 
 * Read-Only Service & Adapter untuk Rapor Bayangan / Rapor Tengah Semester
 * SIMAK SMP ALKARIM RASYID
 * 
 * Aturan Mutlak:
 * 1. HANYA membaca nilai UTS (utsScore).
 * 2. TIDAK melakukan recalculation, pembobotan, TP averaging, atau SAS blending.
 * 3. Nilai 0 adalah nilai valid (TERISI).
 * 4. Mendukung isolasi penuh UMUM vs PONDOK.
 * 5. Menggunakan query batch terisolasi (Bebas N+1).
 * 6. Zero-mutation: sama sekali tidak melakukan write/set/add/update/delete ke Firestore.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase/config";
import {
  MidtermReportType,
  MidtermScoreStatus,
  MidtermReportScore,
  MidtermReportSubject,
  MidtermReportStudent,
  MidtermReportContext,
  GetMidtermReportParams
} from "../types/midtermReport.types";
import { Student, Subject, Class } from "../types";
import { getActiveStudents } from "../utils/studentHelper";
import { isSubjectReportVisible } from "../utils/subjectHelper";
import { classifySubjectType } from "./eRapor.service";

/**
 * Pure function to resolve Midterm score and its status.
 * Handles the 4 canonical conditions:
 * A. TIDAK_ADA_UTS: Pondok scheme has hasUts === false -> status "TIDAK_ADA_UTS", score null
 * B. BELUM_DIISI: Assessment missing or utsScore is null/undefined -> status "BELUM_DIISI", score null
 * C. Nilai 0: utsScore === 0 -> status "TERISI", score 0 (valid!)
 * D. Nilai 1-100: utsScore is numeric -> status "TERISI", score value
 */
export function resolveMidtermScoreStatus(
  rawUtsScore: unknown,
  isPondokWithoutUts: boolean = false
): { status: MidtermScoreStatus; score: number | null } {
  if (isPondokWithoutUts) {
    return {
      status: "TIDAK_ADA_UTS",
      score: null
    };
  }

  if (rawUtsScore !== null && rawUtsScore !== undefined && rawUtsScore !== "") {
    const num = Number(rawUtsScore);
    if (!isNaN(num)) {
      return {
        status: "TERISI",
        score: num
      };
    }
  }

  return {
    status: "BELUM_DIISI",
    score: null
  };
}

/**
 * Pure function to filter and deduplicate subjects for Midterm Report
 * based on schedule entries, visibility setting, and report type.
 */
export function filterMidtermSubjects(
  scheduleSubjectIds: string[],
  subjectsMap: Map<string, Subject>,
  reportType: MidtermReportType,
  pondokSchemesMap?: Map<string, { hasUts?: boolean }>
): MidtermReportSubject[] {
  const uniqueSubjectIds = Array.from(new Set(scheduleSubjectIds));
  const results: MidtermReportSubject[] = [];

  for (const subjId of uniqueSubjectIds) {
    const subj = subjectsMap.get(subjId);
    if (!subj) continue;

    // Filter out subjects set to TIDAK_TAMPIL_RAPOR
    if (!isSubjectReportVisible(subj)) {
      continue;
    }

    // Classify using canonical existing helper
    const targetType = classifySubjectType(subj);
    if (targetType !== reportType) {
      continue;
    }

    const scheme = pondokSchemesMap?.get(subjId);
    const hasUts = reportType === "PONDOK" ? scheme?.hasUts ?? true : true;

    results.push({
      subjectId: subj.id,
      subjectName: subj.name,
      subjectCode: subj.code,
      subjectType: targetType,
      group: subj.group,
      kkm: subj.kkm,
      hasUts
    });
  }

  // Deterministic sort: group A -> B -> C then by name
  return results.sort((a, b) => {
    const grpA = a.group || "Z";
    const grpB = b.group || "Z";
    if (grpA !== grpB) return grpA.localeCompare(grpB);
    return a.subjectName.localeCompare(b.subjectName, "id");
  });
}

/**
 * Pure function to assemble MidtermReportContext from in-memory components.
 */
export function assembleMidtermReportContext(params: {
  academicYearId: string;
  semesterId: string;
  classId: string;
  className: string;
  gradeLevel?: string;
  homeroomTeacherId?: string;
  homeroomTeacherName?: string;
  reportType: MidtermReportType;
  students: Student[];
  subjects: MidtermReportSubject[];
  umumSubjects?: MidtermReportSubject[];
  pondokSubjects?: MidtermReportSubject[];
  assessmentsMap: Map<string, { utsScore?: number | null }>;
  pondokSchemesMap?: Map<string, { hasUts?: boolean }>;
}): MidtermReportContext {
  const {
    academicYearId,
    semesterId,
    classId,
    className,
    gradeLevel,
    homeroomTeacherId,
    homeroomTeacherName,
    reportType,
    students,
    subjects,
    umumSubjects,
    pondokSubjects,
    assessmentsMap,
    pondokSchemesMap
  } = params;

  // Filter only active students using canonical helper
  const activeStudents = getActiveStudents(students).sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", "id")
  );

  const reportStudents: MidtermReportStudent[] = activeStudents.map((st) => {
    const studentScores: MidtermReportScore[] = subjects.map((subj) => {
      const scheme = pondokSchemesMap?.get(subj.subjectId);
      const isPondokWithoutUts = subj.subjectType === "PONDOK" && scheme && scheme.hasUts === false;

      // Look up assessment in Map using composite key: `${subjectId}_${studentId}`
      const mapKey = `${subj.subjectId}_${st.id}`;
      const ass = assessmentsMap.get(mapKey);
      const rawUts = ass?.utsScore;

      const { status, score } = resolveMidtermScoreStatus(rawUts, isPondokWithoutUts);

      return {
        studentId: st.id,
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        subjectType: subj.subjectType,
        score,
        status
      };
    });

    return {
      studentId: st.id,
      studentName: st.name,
      nis: st.nis,
      nisn: st.nisn,
      scores: studentScores
    };
  });

  return {
    academicYearId,
    semesterId,
    classId,
    className,
    gradeLevel,
    reportType,
    homeroomTeacherId,
    homeroomTeacherName,
    subjects,
    umumSubjects,
    pondokSubjects,
    students: reportStudents,
    generatedAt: new Date().toISOString()
  };
}

export const midtermReportService = {
  /**
   * Main Read-Only API to compile Midterm Report Context for a class.
   * Performs only batch reads (Zero N+1) and never executes any write/mutation.
   */
  async getMidtermReportData(params: GetMidtermReportParams): Promise<MidtermReportContext> {
    const { academicYearId, semesterId, classId, reportType } = params;

    // 1. Fetch Class document
    const classDocRef = doc(db, "classes", classId);
    const classSnap = await getDoc(classDocRef);
    const classData = classSnap.exists() ? (classSnap.data() as Class) : null;
    const className = classData?.name || "Kelas";
    const gradeLevel = classData?.gradeLevel || undefined;
    const homeroomTeacherId = classData?.homeroomTeacherId || undefined;
    const homeroomTeacherName = classData?.homeroomTeacherName || undefined;

    // 2. Fetch all students for the class in a single batch query
    const studentsCol = collection(db, "students");
    const studentsQ = query(studentsCol, where("classId", "==", classId));

    // 3. Fetch all schedules for this class & semester in a single query
    const schedulesCol = collection(db, "schedules");
    const schedulesQ = query(
      schedulesCol,
      where("academicYearId", "==", academicYearId),
      where("semesterId", "==", semesterId),
      where("classId", "==", classId)
    );

    // 4. Fetch master subjects
    const subjectsCol = collection(db, "subjects");

    // 5. Fetch assessments based on report type (for TERPADU, query both)
    const needUmumAssessments = reportType === "UMUM" || reportType === "TERPADU";
    const needPondokAssessments = reportType === "PONDOK" || reportType === "TERPADU";

    const umumAssessmentsQ = needUmumAssessments
      ? query(
          collection(db, "e_rapor_assessments"),
          where("academicYearId", "==", academicYearId),
          where("semesterId", "==", semesterId),
          where("classId", "==", classId)
        )
      : null;

    const pondokAssessmentsQ = needPondokAssessments
      ? query(
          collection(db, "e_rapor_pondok_assessments"),
          where("academicYearId", "==", academicYearId),
          where("semesterId", "==", semesterId),
          where("classId", "==", classId)
        )
      : null;

    // Pondok schemes query if PONDOK or TERPADU
    const pondokSchemesCol = collection(db, "e_rapor_pondok_schemes");
    const pondokSchemesQ = needPondokAssessments
      ? query(
          pondokSchemesCol,
          where("academicYearId", "==", academicYearId),
          where("semesterId", "==", semesterId),
          where("classId", "==", classId)
        )
      : null;

    // Execute queries in parallel
    const [
      studentsSnap,
      schedulesSnap,
      subjectsSnap,
      umumSnap,
      pondokSnap,
      pondokSchemesSnap
    ] = await Promise.all([
      getDocs(studentsQ),
      getDocs(schedulesQ),
      getDocs(subjectsCol),
      umumAssessmentsQ ? getDocs(umumAssessmentsQ) : Promise.resolve(null),
      pondokAssessmentsQ ? getDocs(pondokAssessmentsQ) : Promise.resolve(null),
      pondokSchemesQ ? getDocs(pondokSchemesQ) : Promise.resolve(null)
    ]);

    // Build Students list
    const students: Student[] = [];
    studentsSnap.forEach((d) => {
      students.push({ id: d.id, ...d.data() } as Student);
    });

    // Build Master Subjects Map
    const subjectsMap = new Map<string, Subject>();
    subjectsSnap.forEach((d) => {
      subjectsMap.set(d.id, { id: d.id, ...d.data() } as Subject);
    });

    // Collect schedule subject IDs
    const scheduleSubjectIds: string[] = [];
    schedulesSnap.forEach((d) => {
      const data = d.data();
      if (data.subjectId) {
        scheduleSubjectIds.push(data.subjectId);
      }
    });

    // Build Pondok Schemes Map
    const pondokSchemesMap = new Map<string, { hasUts?: boolean }>();
    if (pondokSchemesSnap) {
      pondokSchemesSnap.forEach((d) => {
        const data = d.data();
        if (data.subjectId) {
          pondokSchemesMap.set(data.subjectId, { hasUts: data.hasUts });
        }
      });
    }

    // Filter Subjects based on reportType
    let subjects: MidtermReportSubject[] = [];
    let umumSubjects: MidtermReportSubject[] | undefined = undefined;
    let pondokSubjects: MidtermReportSubject[] | undefined = undefined;

    if (reportType === "TERPADU") {
      umumSubjects = filterMidtermSubjects(scheduleSubjectIds, subjectsMap, "UMUM", pondokSchemesMap);
      pondokSubjects = filterMidtermSubjects(scheduleSubjectIds, subjectsMap, "PONDOK", pondokSchemesMap);
      subjects = [...umumSubjects, ...pondokSubjects];
    } else {
      subjects = filterMidtermSubjects(scheduleSubjectIds, subjectsMap, reportType, pondokSchemesMap);
      if (reportType === "UMUM") umumSubjects = subjects;
      if (reportType === "PONDOK") pondokSubjects = subjects;
    }

    // Build Assessments Map keyed by `${subjectId}_${studentId}`
    const assessmentsMap = new Map<string, { utsScore?: number | null }>();
    if (umumSnap) {
      umumSnap.forEach((d) => {
        const data = d.data();
        if (data.subjectId && data.studentId) {
          const key = `${data.subjectId}_${data.studentId}`;
          assessmentsMap.set(key, { utsScore: data.utsScore });
        }
      });
    }
    if (pondokSnap) {
      pondokSnap.forEach((d) => {
        const data = d.data();
        if (data.subjectId && data.studentId) {
          const key = `${data.subjectId}_${data.studentId}`;
          assessmentsMap.set(key, { utsScore: data.utsScore });
        }
      });
    }

    // Assemble and return final context
    return assembleMidtermReportContext({
      academicYearId,
      semesterId,
      classId,
      className,
      gradeLevel,
      homeroomTeacherId,
      homeroomTeacherName,
      reportType,
      students,
      subjects,
      umumSubjects,
      pondokSubjects,
      assessmentsMap,
      pondokSchemesMap
    });
  },

  /**
   * Helper to retrieve only subjects for a given context and report type.
   */
  async getMidtermSubjects(
    academicYearId: string,
    semesterId: string,
    classId: string,
    reportType: MidtermReportType
  ): Promise<MidtermReportSubject[]> {
    const schedulesCol = collection(db, "schedules");
    const schedulesQ = query(
      schedulesCol,
      where("academicYearId", "==", academicYearId),
      where("semesterId", "==", semesterId),
      where("classId", "==", classId)
    );

    const [schedulesSnap, subjectsSnap] = await Promise.all([
      getDocs(schedulesQ),
      getDocs(collection(db, "subjects"))
    ]);

    const scheduleSubjectIds: string[] = [];
    schedulesSnap.forEach((d) => {
      const data = d.data();
      if (data.subjectId) scheduleSubjectIds.push(data.subjectId);
    });

    const subjectsMap = new Map<string, Subject>();
    subjectsSnap.forEach((d) => {
      subjectsMap.set(d.id, { id: d.id, ...d.data() } as Subject);
    });

    return filterMidtermSubjects(scheduleSubjectIds, subjectsMap, reportType);
  }
};
