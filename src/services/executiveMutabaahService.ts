import {
  collection,
  getDocs,
  query,
  where
} from "firebase/firestore";
import { db } from "../firebase/config";
import { SdmMutabaahEntry, SdmMutabaahIndicator } from "../types/mutabaah.types";
import { mutabaahService } from "./mutabaahService";
import { userService, getPrimaryRole } from "./user.service";
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
  totalTeachers: number; // Single Source of Truth: Active Teachers in Master Guru
  targetMutabaahCount: number; // Target Personil Wajib Mutabaah (Active Eligible GTK, Exclude Ketua Yayasan)
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

    // A. SINGLE SOURCE OF TRUTH (SSOT) FOR MASTER GURU
    // A teacher is valid & active if:
    // - !t.isDeleted
    // - status is not "Nonaktif", "Pensiun", "Cuti" (or false)
    const isTeacherActive = (t: any): boolean => {
      if (t.isDeleted === true) return false;
      if (t.status === false || t.status === "Nonaktif" || t.status === "Pensiun") return false;
      return true; // "Aktif", true, or default undefined
    };

    const activeMasterTeachers = allTeachers.filter(isTeacherActive);
    const totalMasterTeachers = activeMasterTeachers.length;

    // B. TARGET MUTABAAH ELIGIBILITY & DEDUPLICATION (1 PERSON = 1 RECORD)
    // Business Rules:
    // - Ketua Yayasan is strictly EXCLUDED from Mutabaah obligation.
    // - Pure technical admins/operators without teaching or GTK role are EXCLUDED.
    // - Master Guru active teachers are eligible GTK (role "guru").
    // - Other active GTKs (musrif, tata usaha, staff) in users collection are eligible.
    // - Deduplicate between teacher document and user account so one person is never counted twice.

    interface MutabaahTargetPerson {
      targetId: string; // Unified unique key
      userId: string; // User ID used for mutabaah_entries lookup
      teacherId?: string; // Teacher document ID
      name: string;
      niy: string;
      role: string;
      subjectName: string;
      aliases: Set<string>; // All known IDs (user.id, user.userId, teacher.id, email)
      isMasterTeacher: boolean;
    }

    const mutabaahTargets: MutabaahTargetPerson[] = [];
    const addedTargetKeys = new Set<string>();

    // 1. Process Active Master Teachers
    activeMasterTeachers.forEach(t => {
      const aliases = new Set<string>();
      if (t.id) aliases.add(t.id);
      if (t.teacherId) aliases.add(t.teacherId);
      if (t.email) aliases.add(t.email.toLowerCase().trim());

      // Match with User account in users collection
      const matchedUser = allUsers.find(u =>
        !u.isDeleted &&
        u.status === "Aktif" &&
        ((u.teacherId && (u.teacherId === t.id || u.teacherId === t.teacherId)) ||
         (u.email && t.email && u.email.toLowerCase().trim() === t.email.toLowerCase().trim()) ||
         (u.name && t.name && u.name.toLowerCase().trim() === t.name.toLowerCase().trim()))
      );

      // Check if user has Ketua Yayasan role (if so, exclude from mutabaah target)
      const userRoles = matchedUser ? (matchedUser.roles || [matchedUser.role || ""]) : [];
      const isYayasan = userRoles.some(r => r.toLowerCase().includes("yayasan"));
      if (isYayasan) {
        // Ketua Yayasan is NEVER a Mutabaah target
        return;
      }

      if (matchedUser) {
        if (matchedUser.userId) aliases.add(matchedUser.userId);
        if (matchedUser.id) aliases.add(matchedUser.id);
        if (matchedUser.email) aliases.add(matchedUser.email.toLowerCase().trim());
      }

      // Map subjects taught
      let subName = "-";
      if (t.subjectIds && t.subjectIds.length > 0) {
        subName = t.subjectIds.map(id => subjectMap.get(id) || "").filter(Boolean).join(", ") || "-";
      }

      const primaryRole = matchedUser ? getPrimaryRole(userRoles) : "guru";

      const target: MutabaahTargetPerson = {
        targetId: t.id || t.teacherId,
        userId: matchedUser?.userId || matchedUser?.id || t.id,
        teacherId: t.id,
        name: t.name,
        niy: t.niy || (matchedUser as any)?.niy || "-",
        role: primaryRole,
        subjectName: subName,
        aliases,
        isMasterTeacher: true
      };

      mutabaahTargets.push(target);
      if (t.id) addedTargetKeys.add(t.id);
      if (t.teacherId) addedTargetKeys.add(t.teacherId);
      if (t.email) addedTargetKeys.add(t.email.toLowerCase().trim());
      if (t.name) addedTargetKeys.add(t.name.toLowerCase().trim());
      if (matchedUser?.userId) addedTargetKeys.add(matchedUser.userId);
      if (matchedUser?.id) addedTargetKeys.add(matchedUser.id);
    });

    // 2. Process other active GTK users (e.g. Musrif, Tata Usaha, Staff) not in teachers collection
    allUsers.forEach(u => {
      if (u.isDeleted || u.status !== "Aktif") return;

      const userRoles = (u.roles || [u.role || ""]).map(r => r.toLowerCase().trim());

      // Ketua Yayasan is NEVER a Mutabaah target
      if (userRoles.some(r => r.includes("yayasan"))) return;

      // Pure system admin or operator without GTK duties is excluded
      const isPureAdminOrOperator = userRoles.every(r => r === "admin" || r === "operator");
      if (isPureAdminOrOperator && !u.teacherId) return;

      // Must have an eligible GTK role
      const isEligibleGtk = userRoles.some(r =>
        r.includes("guru") ||
        r.includes("musrif") ||
        r.includes("sekolah") ||
        r.includes("kurikulum") ||
        r.includes("tata usaha") ||
        r.includes("staff") ||
        r.includes("pimpinan")
      );

      if (!isEligibleGtk && !u.teacherId) return;

      // Deduplication check
      const uEmail = (u.email || "").toLowerCase().trim();
      const uName = (u.name || "").toLowerCase().trim();
      const uId = u.userId || u.id;
      const uTeacherId = u.teacherId || "";

      if (
        (uId && addedTargetKeys.has(uId)) ||
        (uTeacherId && addedTargetKeys.has(uTeacherId)) ||
        (uEmail && addedTargetKeys.has(uEmail)) ||
        (uName && addedTargetKeys.has(uName))
      ) {
        return; // Already accounted for
      }

      // Add as distinct non-master-teacher GTK target
      const aliases = new Set<string>();
      if (u.userId) aliases.add(u.userId);
      if (u.id) aliases.add(u.id);
      if (u.email) aliases.add(uEmail);
      if (uTeacherId) aliases.add(uTeacherId);

      const target: MutabaahTargetPerson = {
        targetId: u.userId || u.id,
        userId: u.userId || u.id,
        teacherId: uTeacherId || undefined,
        name: u.name,
        niy: (u as any).niy || (u as any).nip || "-",
        role: getPrimaryRole(u.roles || [u.role || "guru"]),
        subjectName: "-",
        aliases,
        isMasterTeacher: false
      };

      mutabaahTargets.push(target);
      if (uId) addedTargetKeys.add(uId);
      if (uEmail) addedTargetKeys.add(uEmail);
      if (uName) addedTargetKeys.add(uName);
    });

    // Apply filters (teacherId, role, subjectId) on the eligible targets
    let filteredTargets = mutabaahTargets;

    if (filters.teacherId && filters.teacherId !== "ALL") {
      filteredTargets = filteredTargets.filter(t =>
        t.teacherId === filters.teacherId ||
        t.targetId === filters.teacherId ||
        t.userId === filters.teacherId ||
        t.aliases.has(filters.teacherId!)
      );
    }
    if (filters.role && filters.role !== "ALL") {
      const rFilter = filters.role.toLowerCase().trim();
      filteredTargets = filteredTargets.filter(t => t.role.toLowerCase().includes(rFilter));
    }
    if (filters.subjectId && filters.subjectId !== "ALL") {
      const targetSubName = subjectMap.get(filters.subjectId)?.toLowerCase();
      if (targetSubName) {
        filteredTargets = filteredTargets.filter(t => t.subjectName.toLowerCase().includes(targetSubName));
      }
    }

    // Determine displayed Total Guru (SSoT from Master Guru)
    let displayTotalTeachers = totalMasterTeachers;
    if (filters.teacherId && filters.teacherId !== "ALL") {
      displayTotalTeachers = activeMasterTeachers.filter(t => t.id === filters.teacherId || t.teacherId === filters.teacherId).length;
    } else if (filters.subjectId && filters.subjectId !== "ALL") {
      const targetSubName = subjectMap.get(filters.subjectId)?.toLowerCase();
      displayTotalTeachers = activeMasterTeachers.filter(t => {
        if (!t.subjectIds || t.subjectIds.length === 0) return false;
        const subNames = t.subjectIds.map(id => subjectMap.get(id)?.toLowerCase() || "");
        return subNames.some(sn => targetSubName && sn.includes(targetSubName));
      }).length;
    } else if (filters.role && filters.role !== "ALL") {
      // Role filter on master teachers
      displayTotalTeachers = filteredTargets.filter(t => t.isMasterTeacher).length;
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

    const findEntryForTarget = (target: MutabaahTargetPerson, dateStr: string): SdmMutabaahEntry | null => {
      // 1. Match by any alias
      for (const alias of target.aliases) {
        const aliasKey = `${alias}_${dateStr}`;
        if (allEntriesMap.has(aliasKey)) return allEntriesMap.get(aliasKey)!;
      }

      // 2. Match by teacherId field in entry
      if (target.teacherId) {
        const tIdKey = `${target.teacherId}_${dateStr}`;
        if (allEntriesMap.has(tIdKey)) return allEntriesMap.get(tIdKey)!;
      }

      // 3. Fallback: match by normalized user name on the same date
      const tNameLower = (target.name || "").toLowerCase().trim();
      for (const entry of allEntriesMap.values()) {
        if (entry.date === dateStr) {
          if ((entry as any).teacherId && target.aliases.has((entry as any).teacherId)) return entry;
          if (tNameLower && entry.userName && entry.userName.toLowerCase().trim() === tNameLower) return entry;
        }
      }

      return null;
    };

    // 4. Construct Records Matrix (Filtered Targets x Dates in Range)
    const rawRecords: ExecutiveMutabaahRecord[] = [];

    // Track per-target consistency statistics
    const targetStatsMap = new Map<string, {
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

    filteredTargets.forEach(t => {
      targetStatsMap.set(t.targetId, {
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
      for (const t of filteredTargets) {
        const entry = findEntryForTarget(t, dStr);
        const targetStat = targetStatsMap.get(t.targetId);

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

          if (targetStat) {
            targetStat.filledDays++;
            targetStat.totalPercentageSum += completenessPercentage;
            if (isLate) targetStat.lateCount++;
          }
        }

        const rec: ExecutiveMutabaahRecord = {
          id: `${t.targetId}_${dStr}`,
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
    // Formula:
    // Persentase Mutabaah = jumlah target yang memenuhi ketentuan / jumlah target Mutabaah * 100
    const targetMutabaahCount = filteredTargets.length;
    const totalExpectedRecords = targetMutabaahCount * datesInRange.length;

    const filledRecords = rawRecords.filter(r => r.status !== "Belum Mengisi");
    const unfilledRecords = rawRecords.filter(r => r.status === "Belum Mengisi");
    const lateRecords = rawRecords.filter(r => r.isLate || r.status === "Terlambat");

    const filledCount = filledRecords.length;
    const unfilledCount = unfilledRecords.length;
    const lateCount = lateRecords.length;

    const fillRatePercentage = totalExpectedRecords > 0
      ? Math.round((filledCount / totalExpectedRecords) * 100)
      : 0;

    // Targets with consistency >= 90%
    let consistentCount = 0;
    targetStatsMap.forEach(stat => {
      const avg = stat.totalTargetDays > 0 ? (stat.totalPercentageSum / stat.totalTargetDays) : 0;
      if (avg >= 90) consistentCount++;
    });

    const summary: ExecutiveMutabaahSummary = {
      totalTeachers: displayTotalTeachers,
      targetMutabaahCount,
      filledCount,
      unfilledCount,
      lateCount,
      consistentCount,
      fillRatePercentage
    };

    // 7. Compute Widget Statistics
    // A. Top 10 Disiplin
    const sortedTargetStats = Array.from(targetStatsMap.values()).map(s => ({
      ...s,
      avgPercentage: s.totalTargetDays > 0 ? Math.round(s.totalPercentageSum / s.totalTargetDays) : 0
    }));
    sortedTargetStats.sort((a, b) => b.avgPercentage - a.avgPercentage || b.filledDays - a.filledDays);

    const topDisciplinedTeachers = sortedTargetStats.slice(0, 10).map(s => ({
      userId: s.userId,
      teacherName: s.teacherName,
      niy: s.niy,
      role: s.role,
      subjectName: s.subjectName,
      avgPercentage: s.avgPercentage,
      totalFilled: s.filledDays
    }));

    // B. Unfilled Today Teachers (strictly from eligible targets, Ketua Yayasan is never here)
    const unfilledTodayTeachers: Array<{
      userId: string;
      teacherName: string;
      niy: string;
      role: string;
      subjectName: string;
    }> = [];

    filteredTargets.forEach(t => {
      const todayEntry = findEntryForTarget(t, todayStr);
      if (!todayEntry || (todayEntry.compliancePercentage ?? 0) === 0) {
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

