import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/config";
import { 
  JpAdjustment, 
  TeachingDateDetail, 
  SubjectRealTeachingHours, 
  RealTeachingHoursSummary 
} from "../types/realTeachingHours.types";
import { semesterService } from "./semester.service";
import { scheduleService } from "./schedule.service";
import { classService } from "./classService";
import { academicPlanningService } from "./academicPlanning.service";
import { schoolSettingsService } from "./schoolSettings.service";
import { teachingJournalService } from "./teachingJournalService";

const ADJUSTMENTS_COLLECTION = "jp_adjustments";

const indonesianDaysMap: Record<number, string> = {
  0: "Minggu",
  1: "Senin",
  2: "Selasa",
  3: "Rabu",
  4: "Kamis",
  5: "Jumat",
  6: "Sabtu"
};

export const realTeachingHoursService = {
  // Fetch all manual adjustments for a semester
  async getJpAdjustments(semesterId: string): Promise<JpAdjustment[]> {
    try {
      const q = query(
        collection(db, ADJUSTMENTS_COLLECTION),
        where("semesterId", "==", semesterId)
      );
      const snap = await getDocs(q);
      const list: JpAdjustment[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as JpAdjustment);
      });
      return list;
    } catch (error) {
      console.error("Failed to fetch JP adjustments:", error);
      return [];
    }
  },

  // Save/Submit a manual adjustment
  async saveJpAdjustment(
    adjustment: Omit<JpAdjustment, "id" | "createdAt" | "updatedAt">
  ): Promise<JpAdjustment> {
    try {
      const settings = await schoolSettingsService.getSettings();
      const requiresApproval = settings.requiresJpAdjustmentApproval ?? false;
      const status = requiresApproval ? "pending" : "approved";

      const docId = `${adjustment.semesterId}_${adjustment.subjectId}_${adjustment.classId}`;
      const docRef = doc(db, ADJUSTMENTS_COLLECTION, docId);

      const payload = {
        ...adjustment,
        status,
        updatedAt: new Date().toISOString()
      };

      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        await updateDoc(docRef, payload);
      } else {
        await setDoc(docRef, {
          ...payload,
          createdAt: new Date().toISOString()
        });
      }

      return {
        id: docId,
        ...payload,
        createdAt: docSnap.exists() ? docSnap.data().createdAt : new Date().toISOString()
      } as JpAdjustment;
    } catch (error) {
      return handleFirestoreError(error, OperationType.WRITE, ADJUSTMENTS_COLLECTION);
    }
  },

  // Approve a pending JP adjustment
  async approveJpAdjustment(
    adjustmentId: string, 
    approvedByUserId: string, 
    approvedByUserName: string
  ): Promise<void> {
    try {
      const docRef = doc(db, ADJUSTMENTS_COLLECTION, adjustmentId);
      await updateDoc(docRef, {
        status: "approved",
        approvedByUserId,
        approvedByUserName,
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${ADJUSTMENTS_COLLECTION}/${adjustmentId}`);
    }
  },

  // Reject a pending JP adjustment
  async rejectJpAdjustment(
    adjustmentId: string, 
    rejectionReason: string
  ): Promise<void> {
    try {
      const docRef = doc(db, ADJUSTMENTS_COLLECTION, adjustmentId);
      await updateDoc(docRef, {
        status: "rejected",
        rejectionReason,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${ADJUSTMENTS_COLLECTION}/${adjustmentId}`);
    }
  },

  // Calculate Real Teaching Hours (JP Efektif Riil)
  async getRealTeachingHoursAnalysis(
    academicYearId: string,
    semesterId: string
  ): Promise<RealTeachingHoursSummary> {
    try {
      // 1. Fetch dependencies
      const [
        semesters,
        classes,
        schedules,
        calendarDays,
        schoolSettings,
        journals,
        adjustments
      ] = await Promise.all([
        semesterService.getSemesters(),
        classService.getClasses(),
        scheduleService.getSchedules(),
        academicPlanningService.getCalendarDays(academicYearId, semesterId),
        schoolSettingsService.getSettings(),
        teachingJournalService.getAll(academicYearId, semesterId),
        this.getJpAdjustments(semesterId)
      ]);

      const currentSemester = semesters.find(s => s.id === semesterId);
      if (!currentSemester) {
        return {
          academicYearId,
          semesterId,
          totalPlannedJp: 0,
          totalLostJp: 0,
          totalEffectiveJp: 0,
          totalExecutedJp: 0,
          bySubjectClass: []
        };
      }

      // Determine date range with fallback if missing on semester record
      let startDateVal = currentSemester.startDate;
      let endDateVal = currentSemester.endDate;
      if (!startDateVal || !endDateVal) {
        const yearMatch = currentSemester.academicYearName ? currentSemester.academicYearName.match(/\d{4}/) : null;
        const startYr = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
        const isGenap = currentSemester.code === "S2" || 
                        currentSemester.name.toLowerCase().includes("2") || 
                        currentSemester.name.toLowerCase().includes("genap");
        if (isGenap) {
          startDateVal = startDateVal || `${startYr + 1}-01-02`;
          endDateVal = endDateVal || `${startYr + 1}-06-30`;
        } else {
          startDateVal = startDateVal || `${startYr}-07-15`;
          endDateVal = endDateVal || `${startYr}-12-31`;
        }
      }

      const activeClasses = classes.filter(c => c.status === "Aktif" && !c.isDeleted);
      const activeDays = schoolSettings.activeDays || ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis"];

      // Filter schedules for current semester with fallback to academic year schedules
      let semesterSchedules = schedules.filter(
        s => s.academicYearId === academicYearId && (s.semesterId === semesterId || !s.semesterId)
      );

      if (semesterSchedules.length === 0) {
        semesterSchedules = schedules.filter(
          s => s.academicYearId === academicYearId
        );
      }

      // Build date map for calendar events and holidays
      const calendarEventsByDate: Record<string, any[]> = {};
      calendarDays.forEach(cd => {
        calendarEventsByDate[cd.date] = cd.events || [];
      });

      // Map subject + class schedules
      // Group schedules by key: `${subjectId}_${classId}`
      const subjectClassMap: Record<string, {
        subjectId: string;
        subjectName: string;
        classId: string;
        className: string;
        gradeLevel: string;
        teacherId: string;
        teacherName: string;
        daysMap: Record<string, number>; // e.g. { "Sabtu": 2, "Rabu": 2 }
      }> = {};

      semesterSchedules.forEach(s => {
        const key = `${s.subjectId}_${s.classId}`;
        const cls = activeClasses.find(c => c.id === s.classId);
        const gradeLevel = cls?.gradeLevel || "VII";

        if (!subjectClassMap[key]) {
          subjectClassMap[key] = {
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            classId: s.classId,
            className: s.className,
            gradeLevel,
            teacherId: s.teacherId,
            teacherName: s.teacherName,
            daysMap: {}
          };
        }

        // Count JP slots per day
        const day = s.day;
        subjectClassMap[key].daysMap[day] = (subjectClassMap[key].daysMap[day] || 0) + 1;
      });

      // Generate date range from startDateVal to endDateVal
      const startDate = new Date(startDateVal);
      const endDate = new Date(endDateVal);

      const allDates: { dateStr: string; dayName: string; isHoliday: boolean }[] = [];
      let curr = new Date(startDate);

      while (curr <= endDate) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, "0");
        const dateNum = String(curr.getDate()).padStart(2, "0");
        const dateStr = `${year}-${month}-${dateNum}`;

        const dayOfWeek = curr.getDay();
        const dayName = indonesianDaysMap[dayOfWeek] || "Minggu";
        const isHoliday = !activeDays.some(ad => ad.toLowerCase() === dayName.toLowerCase());

        allDates.push({ dateStr, dayName, isHoliday });
        curr.setDate(curr.getDate() + 1);
      }

      // Process calculation per subject/class
      const results: SubjectRealTeachingHours[] = [];
      let totalPlannedJpSum = 0;
      let totalLostJpSum = 0;
      let totalEffectiveJpSum = 0;
      let totalExecutedJpSum = 0;

      for (const key of Object.keys(subjectClassMap)) {
        const item = subjectClassMap[key];
        const daysWithJp = Object.keys(item.daysMap);
        const scheduledJpPerWeek = Object.values(item.daysMap).reduce((a, b) => a + b, 0);

        let plannedJp = 0;
        let lostJp = 0;
        const dateDetails: TeachingDateDetail[] = [];

        // Check each date in semester range
        allDates.forEach(({ dateStr, dayName, isHoliday }) => {
          if (item.daysMap[dayName] && item.daysMap[dayName] > 0) {
            const jpSlotCount = item.daysMap[dayName];
            plannedJp += jpSlotCount;

            const eventsOnDate = calendarEventsByDate[dateStr] || [];
            
            // Check if day is holiday or affected by KBM-disrupting event
            let isKbmDisrupted = isHoliday;
            let cancelReason = isHoliday ? `Libur Akhir Pekan / Routine (${dayName})` : "";
            const eventTitles: string[] = [];

            eventsOnDate.forEach(evt => {
              eventTitles.push(evt.title);
              
              const normalizeGrade = (g?: string) => {
                if (!g) return "";
                const s = g.toString().trim().toUpperCase();
                if (s === "7" || s === "VII" || s.includes("VII") || s.includes("7")) return "VII";
                if (s === "8" || s === "VIII" || s.includes("VIII") || s.includes("8")) return "VIII";
                if (s === "9" || s === "IX" || s.includes("IX") || s.includes("9")) return "IX";
                return s;
              };

              // Check if event affects KBM or is a holiday
              const isHolidayCategory = evt.categoryId === "EVENT_LIBUR" || 
                                        (evt.categoryName && evt.categoryName.toLowerCase().includes("libur")) || 
                                        (evt.title && evt.title.toLowerCase().includes("libur")) || 
                                        evt.isEffectiveDay === false;

              const affectsKbm = isHolidayCategory || evt.affectsKbm !== false || evt.reduceLesson;
              const targetType = evt.targetType || "all";
              const targetGrade = evt.targetGrade;
              const targetClassId = evt.targetClassId;

              let isTargeted = false;
              if (targetType === "all" || !targetType) {
                isTargeted = true;
              } else if (targetType === "grade" && normalizeGrade(targetGrade) === normalizeGrade(item.gradeLevel)) {
                isTargeted = true;
              } else if (targetType === "class" && targetClassId === item.classId) {
                isTargeted = true;
              }

              if (affectsKbm && isTargeted) {
                isKbmDisrupted = true;
                cancelReason = cancelReason ? `${cancelReason}, ${evt.title}` : evt.title;
              }
            });

            if (isKbmDisrupted) {
              lostJp += jpSlotCount;
              dateDetails.push({
                date: dateStr,
                dayName,
                scheduledJp: jpSlotCount,
                actualJp: 0,
                status: isHoliday ? "HOLIDAY" : "AGENDA_CANCEL",
                description: cancelReason || "Agenda / Libur Sekolah",
                agendas: eventTitles
              });
            } else {
              dateDetails.push({
                date: dateStr,
                dayName,
                scheduledJp: jpSlotCount,
                actualJp: jpSlotCount,
                status: "NORMAL",
                description: "Hari Pembelajaran Normal (KBM)",
                agendas: eventTitles
              });
            }
          }
        });

        // Lookup manual adjustment
        const adjustmentDoc = adjustments.find(
          a => a.subjectId === item.subjectId && a.classId === item.classId
        );

        let adjustmentJp = 0;
        let adjustmentStatus: "none" | "approved" | "pending" | "rejected" = "none";
        let pendingAdjustment: JpAdjustment | undefined = undefined;

        if (adjustmentDoc) {
          adjustmentStatus = adjustmentDoc.status;
          if (adjustmentDoc.status === "approved" || !schoolSettings.requiresJpAdjustmentApproval) {
            adjustmentJp = adjustmentDoc.adjustmentDelta || (adjustmentDoc.manualValue - adjustmentDoc.systemValue);
          } else if (adjustmentDoc.status === "pending") {
            pendingAdjustment = adjustmentDoc;
          }
        }

        const effectiveJp = Math.max(0, plannedJp - lostJp + adjustmentJp);

        // Sum executed JP from teaching journals
        const subjectJournals = journals.filter(
          j => j.subjectId === item.subjectId && j.classId === item.classId && j.semesterId === semesterId
        );
        const executedJp = subjectJournals.reduce((sum, j) => sum + (j.totalJP || j.lessonPeriodIds?.length || 2), 0);
        const remainingJp = Math.max(0, effectiveJp - executedJp);
        const progressPercent = effectiveJp > 0 ? Math.min(100, Math.round((executedJp / effectiveJp) * 100)) : 0;

        totalPlannedJpSum += plannedJp;
        totalLostJpSum += lostJp;
        totalEffectiveJpSum += effectiveJp;
        totalExecutedJpSum += executedJp;

        results.push({
          subjectId: item.subjectId,
          subjectName: item.subjectName,
          classId: item.classId,
          className: item.className,
          gradeLevel: item.gradeLevel,
          teacherId: item.teacherId,
          teacherName: item.teacherName,
          day: daysWithJp.join(", "),
          scheduledJpPerWeek,
          plannedJp,
          lostJp,
          adjustmentJp,
          effectiveJp,
          executedJp,
          remainingJp,
          progressPercent,
          adjustmentStatus,
          pendingAdjustment,
          dateDetails
        });
      }

      return {
        academicYearId,
        semesterId,
        totalPlannedJp: totalPlannedJpSum,
        totalLostJp: totalLostJpSum,
        totalEffectiveJp: totalEffectiveJpSum,
        totalExecutedJp: totalExecutedJpSum,
        bySubjectClass: results
      };
    } catch (error) {
      console.error("Failed to calculate real teaching hours:", error);
      return {
        academicYearId,
        semesterId,
        totalPlannedJp: 0,
        totalLostJp: 0,
        totalEffectiveJp: 0,
        totalExecutedJp: 0,
        bySubjectClass: []
      };
    }
  }
};
