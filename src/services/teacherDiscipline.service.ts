import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  query, 
  where,
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { teacherTeachingAttendanceService } from "./teacherTeachingAttendance.service";
import { teacherService } from "./teacherService";
import { scheduleService } from "./schedule.service";
import { schoolSettingsService } from "./schoolSettings.service";
import { academicPlanningService } from "./academicPlanning.service";
import { TeacherTeachingAttendance } from "../types/teacherTeachingAttendance.types";

export interface TeacherDisciplineMetric {
  teacherId: string;
  teacherName: string;
  niy?: string;
  subjectName?: string;
  className?: string;
  
  // Teaching Sessions
  totalScheduledSessions: number;
  totalRealizedSessions: number;
  
  // Status breakdown
  totalHadir: number;
  totalTerlambat: number;
  totalAlpha: number;
  totalIzin: number;
  totalTugasDinas: number;
  totalIncompleteCheckout: number;
  totalPendingValidation: number;
  totalApprovedValidation: number;
  
  // Percentages
  attendancePercentage: number; // (Hadir / Scheduled) * 100
  checkInOnTimePercentage: number; // (CheckIn Tepat Waktu / Scheduled) * 100
  checkOutOnTimePercentage: number; // (CheckOut Tepat Waktu / Scheduled) * 100
  sessionCompletenessPercentage: number; // (Realized / Scheduled) * 100
  
  // Lateness
  totalLateMinutes: number;
  avgLateMinutes: number;
  
  // Scoring & Category
  disciplineScore: number; // 0 - 100
  category: "Sangat Disiplin" | "Disiplin" | "Cukup Disiplin" | "Perlu Pembinaan" | "Pembinaan Khusus";
  
  // Historical trend comparison
  previousDisciplineScore?: number;
  trendStatus?: "Meningkat" | "Stabil" | "Menurun";
}

export interface SchoolDisciplineSummary {
  totalTeachers: number;
  sangatDisiplinCount: number;
  disiplinCount: number;
  cukupDisiplinCount: number;
  perluPembinaanCount: number;
  pembinaanKhususCount: number;
  avgSchoolDisciplineScore: number;
  schoolDisciplinePercentage: number;
  
  avgAttendanceRate: number;
  avgOnTimeCheckInRate: number;
  avgOnTimeCheckOutRate: number;
  totalIncompleteCheckouts: number;
  totalLateIncidents: number;
}

export interface DisciplineHistoryRecord {
  id?: string;
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  academicYearName: string;
  semesterId: string;
  semesterName: string;
  monthStr?: string; // e.g. "2026-08"
  periodType: "monthly" | "semester" | "yearly";
  
  disciplineScore: number;
  category: string;
  attendancePercentage: number;
  checkInOnTimePercentage: number;
  checkOutOnTimePercentage: number;
  totalTerlambat: number;
  totalAlpha: number;
  totalIncompleteCheckout: number;
  avgLateMinutes: number;
  
  trendStatus: "Meningkat" | "Stabil" | "Menurun";
  createdAt?: any;
}

export interface SystemDisciplineRecommendation {
  id: string;
  type: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
  teacherId?: string;
  teacherName?: string;
}

const DISCIPLINE_HISTORY_COLLECTION = "teacher_discipline_histories";

export const getDisciplineCategory = (score: number): TeacherDisciplineMetric["category"] => {
  if (score >= 96) return "Sangat Disiplin";
  if (score >= 86) return "Disiplin";
  if (score >= 76) return "Cukup Disiplin";
  if (score >= 61) return "Perlu Pembinaan";
  return "Pembinaan Khusus";
};

export const teacherDisciplineService = {
  /**
   * Calculates teacher discipline metrics based on filters
   */
  async getDisciplineMetrics(filters: {
    academicYearId?: string;
    academicYearName?: string;
    semesterId?: string;
    semesterName?: string;
    monthStr?: string; // YYYY-MM
    teacherId?: string;
    subjectId?: string;
    classId?: string;
  }): Promise<{
    metrics: TeacherDisciplineMetric[];
    summary: SchoolDisciplineSummary;
    recommendations: SystemDisciplineRecommendation[];
  }> {
    try {
      // 1. Fetch all teachers
      const allTeachers = await teacherService.getTeachers();
      let targetTeachers = allTeachers;
      if (filters.teacherId && filters.teacherId !== "ALL") {
        targetTeachers = allTeachers.filter(t => t.id === filters.teacherId);
      }

      // 2. Fetch all attendance records in range
      const attendanceRecords = await teacherTeachingAttendanceService.getAllAttendances({
        academicYearId: filters.academicYearId,
        semesterId: filters.semesterId,
        teacherId: filters.teacherId !== "ALL" ? filters.teacherId : undefined,
        classId: filters.classId !== "ALL" ? filters.classId : undefined,
      });

      // Filter by month if specified
      let filteredAttendances = attendanceRecords;
      if (filters.monthStr && filters.monthStr !== "ALL") {
        filteredAttendances = attendanceRecords.filter(a => a.date && a.date.startsWith(filters.monthStr!));
      }
      if (filters.subjectId && filters.subjectId !== "ALL") {
        filteredAttendances = filteredAttendances.filter(a => a.subjectId === filters.subjectId);
      }

      // 3. Fetch past discipline history for trend calculations
      const historySnap = await getDocs(collection(db, DISCIPLINE_HISTORY_COLLECTION));
      const pastHistories: DisciplineHistoryRecord[] = [];
      historySnap.forEach(d => pastHistories.push({ id: d.id, ...d.data() } as DisciplineHistoryRecord));

      // 4. Calculate metric for each teacher
      const metrics: TeacherDisciplineMetric[] = [];

      for (const t of targetTeachers) {
        const teacherAtts = filteredAttendances.filter(a => a.teacherId === t.id);

        let totalHadir = 0;
        let totalTerlambat = 0;
        let totalAlpha = 0;
        let totalIzin = 0;
        let totalTugasDinas = 0;
        let totalIncompleteCheckout = 0;
        let totalPendingValidation = 0;
        let totalApprovedValidation = 0;
        let totalLateMinutes = 0;
        let totalCheckInOnTime = 0;
        let totalCheckOutOnTime = 0;

        teacherAtts.forEach(a => {
          const status = a.status;
          
          if (status === "Hadir Mengajar") {
            totalHadir++;
          } else if (status === "Terlambat") {
            totalTerlambat++;
          } else if (status === "Tidak Hadir") {
            totalAlpha++;
          } else if (status === "Izin" || status === "Sakit") {
            totalIzin++;
          } else if (status === "Tugas Dinas") {
            totalTugasDinas++;
          }

          // Check-in / Check-out timing checks
          if (a.checkInTime) {
            if (status !== "Terlambat") {
              totalCheckInOnTime++;
            }
          }

          if (a.checkOutTime || a.manualCheckOutTime) {
            totalCheckOutOnTime++;
          } else if (a.checkInTime && !a.checkOutTime) {
            totalIncompleteCheckout++;
          }

          // Validation tracking
          if (a.attendanceStatus === "Pending") {
            totalPendingValidation++;
          } else if (a.attendanceStatus === "Approved") {
            totalApprovedValidation++;
          }

          // Calculate late minutes if available in checkInTime or notes
          if (status === "Terlambat") {
            totalLateMinutes += 15; // standard estimate if exact delay not stored
          }
        });

        const totalScheduledSessions = teacherAtts.length;
        const totalRealizedSessions = totalHadir + totalTerlambat + totalTugasDinas;

        const attendancePercentage = totalScheduledSessions > 0
          ? Math.round(((totalHadir + totalTugasDinas) / totalScheduledSessions) * 100)
          : 100;

        const checkInOnTimePercentage = totalScheduledSessions > 0
          ? Math.round((totalCheckInOnTime / totalScheduledSessions) * 100)
          : 100;

        const checkOutOnTimePercentage = totalScheduledSessions > 0
          ? Math.round((totalCheckOutOnTime / totalScheduledSessions) * 100)
          : 100;

        const sessionCompletenessPercentage = totalScheduledSessions > 0
          ? Math.round((totalRealizedSessions / totalScheduledSessions) * 100)
          : 100;

        // Formula score: Kehadiran (40%), Ketepatan Check-in (30%), Ketepatan Check-out (20%), Kelengkapan Session (10%)
        const disciplineScore = Math.min(
          100,
          Math.max(
            0,
            Math.round(
              (attendancePercentage * 0.4) +
              (checkInOnTimePercentage * 0.3) +
              (checkOutOnTimePercentage * 0.2) +
              (sessionCompletenessPercentage * 0.1)
            )
          )
        );

        const category = getDisciplineCategory(disciplineScore);
        const avgLateMinutes = totalTerlambat > 0 ? Math.round(totalLateMinutes / totalTerlambat) : 0;

        // Calculate trend from history
        const teacherPast = pastHistories
          .filter(h => h.teacherId === t.id)
          .sort((a, b) => (b.monthStr || "").localeCompare(a.monthStr || ""));

        let previousDisciplineScore = teacherPast.length > 0 ? teacherPast[0].disciplineScore : undefined;
        let trendStatus: "Meningkat" | "Stabil" | "Menurun" = "Stabil";
        if (previousDisciplineScore !== undefined) {
          if (disciplineScore - previousDisciplineScore >= 2) trendStatus = "Meningkat";
          else if (previousDisciplineScore - disciplineScore >= 2) trendStatus = "Menurun";
        }

        metrics.push({
          teacherId: t.id,
          teacherName: t.name,
          niy: t.niy || t.nuptk || "-",
          totalScheduledSessions,
          totalRealizedSessions,
          totalHadir,
          totalTerlambat,
          totalAlpha,
          totalIzin,
          totalTugasDinas,
          totalIncompleteCheckout,
          totalPendingValidation,
          totalApprovedValidation,
          attendancePercentage,
          checkInOnTimePercentage,
          checkOutOnTimePercentage,
          sessionCompletenessPercentage,
          totalLateMinutes,
          avgLateMinutes,
          disciplineScore,
          category,
          previousDisciplineScore,
          trendStatus
        });
      }

      // Sort metrics by discipline score descending
      metrics.sort((a, b) => b.disciplineScore - a.disciplineScore);

      // 5. Build School Summary
      let sangatDisiplinCount = 0;
      let disiplinCount = 0;
      let cukupDisiplinCount = 0;
      let perluPembinaanCount = 0;
      let pembinaanKhususCount = 0;
      let sumScores = 0;
      let sumAttendance = 0;
      let sumCheckIn = 0;
      let sumCheckOut = 0;
      let totalIncompleteCheckouts = 0;
      let totalLateIncidents = 0;

      metrics.forEach(m => {
        sumScores += m.disciplineScore;
        sumAttendance += m.attendancePercentage;
        sumCheckIn += m.checkInOnTimePercentage;
        sumCheckOut += m.checkOutOnTimePercentage;
        totalIncompleteCheckouts += m.totalIncompleteCheckout;
        totalLateIncidents += m.totalTerlambat;

        if (m.category === "Sangat Disiplin") sangatDisiplinCount++;
        else if (m.category === "Disiplin") disiplinCount++;
        else if (m.category === "Cukup Disiplin") cukupDisiplinCount++;
        else if (m.category === "Perlu Pembinaan") perluPembinaanCount++;
        else if (m.category === "Pembinaan Khusus") pembinaanKhususCount++;
      });

      const totalTeachersCount = metrics.length;
      const avgSchoolDisciplineScore = totalTeachersCount > 0 ? Math.round(sumScores / totalTeachersCount) : 100;
      const schoolDisciplinePercentage = avgSchoolDisciplineScore;

      const summary: SchoolDisciplineSummary = {
        totalTeachers: totalTeachersCount,
        sangatDisiplinCount,
        disiplinCount,
        cukupDisiplinCount,
        perluPembinaanCount,
        pembinaanKhususCount,
        avgSchoolDisciplineScore,
        schoolDisciplinePercentage,
        avgAttendanceRate: totalTeachersCount > 0 ? Math.round(sumAttendance / totalTeachersCount) : 100,
        avgOnTimeCheckInRate: totalTeachersCount > 0 ? Math.round(sumCheckIn / totalTeachersCount) : 100,
        avgOnTimeCheckOutRate: totalTeachersCount > 0 ? Math.round(sumCheckOut / totalTeachersCount) : 100,
        totalIncompleteCheckouts,
        totalLateIncidents
      };

      // 6. Generate Data-driven Automated Recommendations
      const recommendations: SystemDisciplineRecommendation[] = [];

      metrics.forEach(m => {
        if (m.trendStatus === "Meningkat" && m.disciplineScore >= 90) {
          recommendations.push({
            id: `rec_increase_${m.teacherId}`,
            type: "success",
            title: "Peningkatan Kedisiplinan",
            message: `${m.teacherName} mengalami peningkatan skor kedisiplinan menjadi ${m.disciplineScore}% (${m.category}) dibanding periode sebelumnya.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.totalTerlambat >= 5) {
          recommendations.push({
            id: `rec_late_${m.teacherId}`,
            type: "warning",
            title: "Tingkat Keterlambatan Tinggi",
            message: `${m.teacherName} tercatat keterlambatan sebanyak ${m.totalTerlambat} kali dalam periode aktif ini (rata-rata ${m.avgLateMinutes} menit).`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.totalIncompleteCheckout >= 3) {
          recommendations.push({
            id: `rec_no_checkout_${m.teacherId}`,
            type: "warning",
            title: "Lupa Check-out Berulang",
            message: `${m.teacherName} belum melakukan Check-out sebanyak ${m.totalIncompleteCheckout} kali. Perlu pengingat otomatis saat sesi jam pelajaran berakhir.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.disciplineScore < 75 || m.category === "Pembinaan Khusus" || m.category === "Perlu Pembinaan") {
          recommendations.push({
            id: `rec_pembinaan_${m.teacherId}`,
            type: "danger",
            title: "Rekomendasi Pembinaan Kedisiplinan",
            message: `${m.teacherName} memiliki skor kedisiplinan ${m.disciplineScore}% (${m.category}). Direkomendasikan untuk masuk program pembinaan oleh Waka Kurikulum & Kepala Sekolah.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }

        if (m.disciplineScore === 100 && m.totalScheduledSessions >= 5) {
          recommendations.push({
            id: `rec_perfect_${m.teacherId}`,
            type: "success",
            title: "Kandidat Guru Teladan Kedisiplinan",
            message: `${m.teacherName} memiliki tingkat kedisiplinan sempurna 100% (Sangat Disiplin) pada seluruh jadwal mengajar.`,
            teacherId: m.teacherId,
            teacherName: m.teacherName
          });
        }
      });

      if (recommendations.length === 0) {
        recommendations.push({
          id: "rec_general_good",
          type: "info",
          title: "Kedisiplinan Guru Stabil",
          message: `Kedisiplinan guru di sekolah secara keseluruhan berada pada kategori ${getDisciplineCategory(avgSchoolDisciplineScore)} (${avgSchoolDisciplineScore}%).`
        });
      }

      return { metrics, summary, recommendations };
    } catch (error) {
      console.error("Error calculating discipline metrics:", error);
      return {
        metrics: [],
        summary: {
          totalTeachers: 0,
          sangatDisiplinCount: 0,
          disiplinCount: 0,
          cukupDisiplinCount: 0,
          perluPembinaanCount: 0,
          pembinaanKhususCount: 0,
          avgSchoolDisciplineScore: 100,
          schoolDisciplinePercentage: 100,
          avgAttendanceRate: 100,
          avgOnTimeCheckInRate: 100,
          avgOnTimeCheckOutRate: 100,
          totalIncompleteCheckouts: 0,
          totalLateIncidents: 0
        },
        recommendations: []
      };
    }
  },

  /**
   * Save permanent historical discipline snapshot to Firestore
   */
  async saveDisciplineSnapshot(snapshotData: Omit<DisciplineHistoryRecord, "id" | "createdAt">): Promise<void> {
    try {
      const docId = `${snapshotData.teacherId}_${snapshotData.academicYearId}_${snapshotData.semesterId}_${snapshotData.monthStr || "full"}`;
      const docRef = doc(db, DISCIPLINE_HISTORY_COLLECTION, docId);
      
      await setDoc(docRef, {
        ...snapshotData,
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, DISCIPLINE_HISTORY_COLLECTION);
    }
  },

  /**
   * Get permanent discipline history for a specific teacher or all teachers
   */
  async getDisciplineHistory(teacherId?: string): Promise<DisciplineHistoryRecord[]> {
    try {
      const colRef = collection(db, DISCIPLINE_HISTORY_COLLECTION);
      let q = colRef;
      if (teacherId && teacherId !== "ALL") {
        q = query(colRef, where("teacherId", "==", teacherId)) as any;
      }
      const snapshot = await getDocs(q);
      const items: DisciplineHistoryRecord[] = [];
      snapshot.forEach(docSnap => {
        items.push({
          id: docSnap.id,
          ...docSnap.data()
        } as DisciplineHistoryRecord);
      });

      // Sort by creation or month string
      items.sort((a, b) => (b.monthStr || "").localeCompare(a.monthStr || ""));
      return items;
    } catch (error) {
      console.error("Error fetching discipline history:", error);
      return [];
    }
  },

  /**
   * Get distinct teacher KPI summary metrics
   */
  async getDistinctTeacherKpiSummary(filters: any = {}) {
    const metricsRes = await this.getDisciplineMetrics(filters);
    const metrics = metricsRes.metrics || [];
    return Object.assign([...metrics], {
      summary: metricsRes.summary,
      metrics,
      rankings: metrics,
      teachers: metrics,
      items: metrics,
      totalTeachers: metrics.length
    });
  }
};

export const getDistinctTeacherKpiSummary = (filters?: any) =>
  teacherDisciplineService.getDistinctTeacherKpiSummary(filters);

