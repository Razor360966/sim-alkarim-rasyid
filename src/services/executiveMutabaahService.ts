import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase/config";
import { SdmMutabaahEntry, SdmMutabaahIndicator } from "../types/mutabaah.types";
import { mutabaahService } from "./mutabaahService";
import { userService } from "./user.service";
import { teacherService } from "./teacherService";
import { subjectService } from "./subjectService";
import { academicYearService } from "./academicYearService";
import { semesterService } from "./semester.service";

export interface ExecutiveMutabaahFilter {
  academicYearId?: string;
  semesterId?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  teacherId?: string; // "ALL" or userId/teacherId
  subjectId?: string; // "ALL" or subjectId
  role?: string; // "ALL" or "guru", "musrif", "wakil kepala sekolah", "kepala sekolah", "tata usaha"
  status?: string; // "ALL" | "Lengkap" | "Belum Lengkap" | "Belum Mengisi" | "Terlambat"
  searchQuery?: string;
}

export interface ExecutiveMutabaahRecord {
  id: string;
  userId: string;
  teacherName: string;
  niy: string;
  subjectName: string;
  role: string;
  date: string; // YYYY-MM-DD
  status: "Lengkap" | "Belum Lengkap" | "Belum Mengisi" | "Terlambat";
  submissionTime: string; // HH:MM or "-"
  isLate: boolean;
  completenessPercentage: number;
  mutabaahScore: number;
  rawEntry: SdmMutabaahEntry | null;
}

export interface ExecutiveMutabaahSummary {
  totalTeachers: number;
  filledCount: number;
  unfilledCount: number;
  lateCount: number;
  consistentCount: number;
  fillRatePercentage: number;
}

export interface ExecutiveMutabaahReport {
  summary: ExecutiveMutabaahSummary;
  records: ExecutiveMutabaahRecord[];
  stats: {
    topDisciplinedTeachers: Array<{
      userId: string;
      teacherName: string;
      niy: string;
      role: string;
      subjectName: string;
      avgPercentage: number;
      totalFilled: number;
    }>;
    unfilledTodayTeachers: Array<{
      userId: string;
      teacherName: string;
      niy: string;
      role: string;
      subjectName: string;
    }>;
    lateTeachers: Array<{
      userId: string;
      teacherName: string;
      date: string;
      submissionTime: string;
      completenessPercentage: number;
    }>;
    dailyTrend: Array<{
      date: string;
      label: string;
      percentage: number;
      filledCount: number;
      totalTeachers: number;
    }>;
    monthlyTrend: Array<{
      month: string;
      label: string;
      percentage: number;
      filledCount: number;
      totalTeachers: number;
    }>;
  };
}

const ENTRIES_COLLECTION = "mutabaah_entries";

function formatSubmissionTime(isoOrTimestampStr?: string): string {
  if (!isoOrTimestampStr) return "-";
  try {
    const d = new Date(isoOrTimestampStr);
    if (isNaN(d.getTime())) return "-";
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "-";
  }
}

function checkIsLate(isoOrTimestampStr?: string): boolean {
  if (!isoOrTimestampStr) return false;
  try {
    const d = new Date(isoOrTimestampStr);
    if (isNaN(d.getTime())) return false;
    // Considered late if submitted after 20:30 (8:30 PM) on that day
    const hours = d.getHours();
    const minutes = d.getMinutes();
    return hours > 20 || (hours === 20 && minutes > 30);
  } catch {
    return false;
  }
}

export const executiveMutabaahService = {
  async getExecutiveReport(filters: ExecutiveMutabaahFilter): Promise<ExecutiveMutabaahReport> {
    // 1. Load Reference Data
    const [allUsers, allTeachers, allSubjects, allIndicators] = await Promise.all([
      userService.getUsers(),
      teacherService.getTeachers(),
      subjectService.getSubjects(),
      mutabaahService.getIndicators()
    ]);

    // Build subject map: id -> subjectName
    const subjectMap = new Map<string, string>();
    allSubjects.forEach(s => subjectMap.set(s.id, s.name));

    // Filter relevant GTK (Guru, Musrif, Staff/TU, Wakakur, Kepsek)
    // Map teachers to a standard teacher list
    const teacherList: Array<{
      userId: string;
      name: string;
      niy: string;
      role: string;
      subjectName: string;
    }> = [];

    // Combine users and teachers to ensure we capture all staff
    const processedUserIds = new Set<string>();

    allUsers.forEach(u => {
      const lowerRole = (u.role || u.roles?.[0] || "").toLowerCase();
      // Include GTK roles
      if (
        lowerRole.includes("guru") ||
        lowerRole.includes("musrif") ||
        lowerRole.includes("sekolah") ||
        lowerRole.includes("kurikulum") ||
        lowerRole.includes("tata usaha") ||
        lowerRole.includes("staff") ||
        lowerRole.includes("pimpinan") ||
        lowerRole.includes("yayasan")
      ) {
        processedUserIds.add(u.userId || u.id);

        // Find subject from matched teacher
        const matchedTeacher = allTeachers.find(t => t.email === u.email || t.name.toLowerCase() === u.name.toLowerCase());
        let subName = "-";
        if (matchedTeacher?.subjectIds && matchedTeacher.subjectIds.length > 0) {
          subName = matchedTeacher.subjectIds.map(id => subjectMap.get(id) || "").filter(Boolean).join(", ") || "-";
        }

        teacherList.push({
          userId: u.userId || u.id,
          name: u.name,
          niy: matchedTeacher?.niy || u.niy || (u as any).nip || "-",
          role: u.role || u.roles?.[0] || "Guru",
          subjectName: subName
        });
      }
    });

    // Also add any teacher from allTeachers that wasn't in allUsers
    allTeachers.forEach(t => {
      if (!processedUserIds.has(t.id) && !processedUserIds.has(t.teacherId)) {
        processedUserIds.add(t.id);
        let subName = "-";
        if (t.subjectIds && t.subjectIds.length > 0) {
          subName = t.subjectIds.map(id => subjectMap.get(id) || "").filter(Boolean).join(", ") || "-";
        }

        teacherList.push({
          userId: t.id || t.teacherId,
          name: t.name,
          niy: t.niy || t.nip || "-",
          role: "Guru",
          subjectName: subName
        });
      }
    });

    // Apply teacher, subject, and role filter on the GTK list
    let filteredTeachers = teacherList;
    if (filters.teacherId && filters.teacherId !== "ALL") {
      filteredTeachers = filteredTeachers.filter(t => t.userId === filters.teacherId);
    }
    if (filters.role && filters.role !== "ALL") {
      const rFilter = filters.role.toLowerCase();
      filteredTeachers = filteredTeachers.filter(t => t.role.toLowerCase().includes(rFilter));
    }
    if (filters.subjectId && filters.subjectId !== "ALL") {
      const targetSubName = subjectMap.get(filters.subjectId)?.toLowerCase();
      if (targetSubName) {
        filteredTeachers = filteredTeachers.filter(t => t.subjectName.toLowerCase().includes(targetSubName));
      }
    }

    // 2. Resolve Date Range
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Default to last 7 days or specified range
    let startDateStr = filters.startDate;
    let endDateStr = filters.endDate;

    if (!startDateStr && !endDateStr) {
      // Default to 7 days before today up to today
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      startDateStr = d7.toISOString().split("T")[0];
      endDateStr = todayStr;
    } else if (!startDateStr) {
      startDateStr = endDateStr;
    } else if (!endDateStr) {
      endDateStr = startDateStr;
    }

    // Generate list of dates in the range
    const datesInRange: string[] = [];
    const curDate = new Date(startDateStr! + "T00:00:00");
    const lastDate = new Date(endDateStr! + "T00:00:00");

    while (curDate <= lastDate) {
      datesInRange.push(curDate.toISOString().split("T")[0]);
      curDate.setDate(curDate.getDate() + 1);
    }

    // 3. Fetch All Mutabaah Entries from Firestore
    const colRef = collection(db, ENTRIES_COLLECTION);
    const snap = await getDocs(colRef);
    const allEntriesMap = new Map<string, SdmMutabaahEntry>(); // Key: `${userId}_${date}`

    snap.forEach(docSnap => {
      const data = docSnap.data() as SdmMutabaahEntry;
      if (data.userId && data.date) {
        allEntriesMap.set(`${data.userId}_${data.date}`, { id: docSnap.id, ...data });
      }
    });

    // 4. Construct Records Matrix (Filtered Teachers x Dates in Range)
    const rawRecords: ExecutiveMutabaahRecord[] = [];

    // Track per-teacher consistency statistics
    const teacherStatsMap = new Map<string, {
      userId: string;
      teacherName: string;
      niy: string;
      role: string;
      subjectName: string;
      totalTargetDays: number;
      filledDays: number;
      totalPercentageSum: number;
      lateCount: number;
    }>();

    filteredTeachers.forEach(t => {
      teacherStatsMap.set(t.userId, {
        userId: t.userId,
        teacherName: t.name,
        niy: t.niy,
        role: t.role,
        subjectName: t.subjectName,
        totalTargetDays: datesInRange.length,
        filledDays: 0,
        totalPercentageSum: 0,
        lateCount: 0
      });
    });

    for (const dStr of datesInRange) {
      for (const t of filteredTeachers) {
        const key = `${t.userId}_${dStr}`;
        const entry = allEntriesMap.get(key) || null;

        const teacherStat = teacherStatsMap.get(t.userId);

        let status: "Lengkap" | "Belum Lengkap" | "Belum Mengisi" | "Terlambat" = "Belum Mengisi";
        let completenessPercentage = 0;
        let submissionTime = "-";
        let isLate = false;

        if (entry) {
          completenessPercentage = entry.compliancePercentage ?? 0;
          submissionTime = formatSubmissionTime(entry.updatedAt || entry.createdAt);
          isLate = checkIsLate(entry.updatedAt || entry.createdAt);

          if (isLate) {
            status = "Terlambat";
          } else if (completenessPercentage >= 85) {
            status = "Lengkap";
          } else if (completenessPercentage > 0) {
            status = "Belum Lengkap";
          } else {
            status = "Belum Mengisi";
          }

          if (teacherStat) {
            teacherStat.filledDays++;
            teacherStat.totalPercentageSum += completenessPercentage;
            if (isLate) teacherStat.lateCount++;
          }
        }

        const rec: ExecutiveMutabaahRecord = {
          id: `${t.userId}_${dStr}`,
          userId: t.userId,
          teacherName: t.name,
          niy: t.niy,
          subjectName: t.subjectName,
          role: t.role,
          date: dStr,
          status,
          submissionTime,
          isLate,
          completenessPercentage,
          mutabaahScore: completenessPercentage,
          rawEntry: entry
        };

        rawRecords.push(rec);
      }
    }

    // 5. Apply Status and Search Filter
    let filteredRecords = rawRecords;

    if (filters.status && filters.status !== "ALL") {
      filteredRecords = filteredRecords.filter(r => r.status === filters.status);
    }

    if (filters.searchQuery && filters.searchQuery.trim() !== "") {
      const q = filters.searchQuery.toLowerCase().trim();
      filteredRecords = filteredRecords.filter(r =>
        r.teacherName.toLowerCase().includes(q) ||
        r.subjectName.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.niy.toLowerCase().includes(q)
      );
    }

    // 6. Compute Monitoring Kepatuhan Summary Metrics
    const totalTeachers = filteredTeachers.length;
    const totalExpectedRecords = totalTeachers * datesInRange.length;

    const filledRecords = rawRecords.filter(r => r.status !== "Belum Mengisi");
    const unfilledRecords = rawRecords.filter(r => r.status === "Belum Mengisi");
    const lateRecords = rawRecords.filter(r => r.isLate || r.status === "Terlambat");

    const filledCount = filledRecords.length;
    const unfilledCount = unfilledRecords.length;
    const lateCount = lateRecords.length;

    const fillRatePercentage = totalExpectedRecords > 0
      ? Math.round((filledCount / totalExpectedRecords) * 100)
      : 0;

    // Teachers with consistency >= 90%
    let consistentCount = 0;
    teacherStatsMap.forEach(stat => {
      const avg = stat.totalTargetDays > 0 ? (stat.totalPercentageSum / stat.totalTargetDays) : 0;
      if (avg >= 90) consistentCount++;
    });

    const summary: ExecutiveMutabaahSummary = {
      totalTeachers,
      filledCount,
      unfilledCount,
      lateCount,
      consistentCount,
      fillRatePercentage
    };

    // 7. Compute Widget Statistics
    // A. Top 10 Disiplin
    const sortedTeacherStats = Array.from(teacherStatsMap.values()).map(s => ({
      ...s,
      avgPercentage: s.totalTargetDays > 0 ? Math.round(s.totalPercentageSum / s.totalTargetDays) : 0
    }));
    sortedTeacherStats.sort((a, b) => b.avgPercentage - a.avgPercentage || b.filledDays - a.filledDays);

    const topDisciplinedTeachers = sortedTeacherStats.slice(0, 10).map(s => ({
      userId: s.userId,
      teacherName: s.teacherName,
      niy: s.niy,
      role: s.role,
      subjectName: s.subjectName,
      avgPercentage: s.avgPercentage,
      totalFilled: s.filledDays
    }));

    // B. Unfilled Today Teachers
    const unfilledTodayTeachers: Array<{
      userId: string;
      teacherName: string;
      niy: string;
      role: string;
      subjectName: string;
    }> = [];

    filteredTeachers.forEach(t => {
      const todayKey = `${t.userId}_${todayStr}`;
      const entry = allEntriesMap.get(todayKey);
      if (!entry || (entry.compliancePercentage ?? 0) === 0) {
        unfilledTodayTeachers.push({
          userId: t.userId,
          teacherName: t.name,
          niy: t.niy,
          role: t.role,
          subjectName: t.subjectName
        });
      }
    });

    // C. Late Teachers List
    const lateTeachersMap = new Map<string, {
      userId: string;
      teacherName: string;
      date: string;
      submissionTime: string;
      completenessPercentage: number;
    }>();

    rawRecords.filter(r => r.isLate || r.status === "Terlambat").forEach(r => {
      lateTeachersMap.set(r.id, {
        userId: r.userId,
        teacherName: r.teacherName,
        date: r.date,
        submissionTime: r.submissionTime,
        completenessPercentage: r.completenessPercentage
      });
    });

    const lateTeachers = Array.from(lateTeachersMap.values());

    // D. Daily Trend (Percentage per day in range)
    const dailyTrend = datesInRange.map(dStr => {
      const dayRecs = rawRecords.filter(r => r.date === dStr);
      const dayFilled = dayRecs.filter(r => r.status !== "Belum Mengisi").length;
      const pct = dayRecs.length > 0 ? Math.round((dayFilled / dayRecs.length) * 100) : 0;
      
      const dateObj = new Date(dStr + "T00:00:00");
      const dayName = dateObj.toLocaleDateString("id-ID", { weekday: "short" });
      const dayNum = dateObj.getDate();

      return {
        date: dStr,
        label: `${dayName} ${dayNum}`,
        percentage: pct,
        filledCount: dayFilled,
        totalTeachers: dayRecs.length
      };
    });

    // E. Monthly Trend (Group by YYYY-MM)
    const monthGroups = new Map<string, { total: number; filled: number }>();
    rawRecords.forEach(r => {
      const monthKey = r.date.substring(0, 7); // e.g. "2026-08"
      const cur = monthGroups.get(monthKey) || { total: 0, filled: 0 };
      cur.total++;
      if (r.status !== "Belum Mengisi") cur.filled++;
      monthGroups.set(monthKey, cur);
    });

    const monthlyTrend = Array.from(monthGroups.entries()).map(([mKey, data]) => {
      const [year, monthNum] = mKey.split("-");
      const mDate = new Date(Number(year), Number(monthNum) - 1, 1);
      const monthLabel = mDate.toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
      const pct = data.total > 0 ? Math.round((data.filled / data.total) * 100) : 0;

      return {
        month: mKey,
        label: monthLabel,
        percentage: pct,
        filledCount: data.filled,
        totalTeachers: data.total
      };
    });

    return {
      summary,
      records: filteredRecords,
      stats: {
        topDisciplinedTeachers,
        unfilledTodayTeachers,
        lateTeachers,
        dailyTrend,
        monthlyTrend
      }
    };
  }
};
