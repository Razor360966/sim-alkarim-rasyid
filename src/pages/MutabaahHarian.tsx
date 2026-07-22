import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Dialog } from "../components/Dialog";
import { Loading } from "../components/Loading";
import { FormInput } from "../components/FormInput";
import { mutabaahService } from "../services/mutabaahService";
import { userService } from "../services/user.service";
import { SdmMutabaahIndicator, SdmMutabaahEntry, SdmMutabaahChangeLog } from "../types/mutabaah.types";
import { useSearchParams } from "react-router-dom";
import {
  Calendar,
  Layers,
  ChevronRight,
  Settings as SettingsIcon,
  Upload,
  History,
  Archive,
  CheckCircle,
  Activity,
  Check,
  X,
  Plus,
  Edit2,
  AlertTriangle,
  Heart,
  TrendingUp,
  Award,
  Users,
  Grid,
  FileText,
  Clock,
  Sliders,
  CalendarDays,
  FileSpreadsheet
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

const EMPTY_ARRAY: any[] = [];

export const MutabaahHarian: React.FC = () => {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const userRolesStr = user?.roles?.join(",") || user?.role || "";
  const originalUserRoles = useMemo(() => {
    return user?.roles || [user?.role || ""];
  }, [userRolesStr, user?.role]);

  const userRoles = useMemo(() => {
    const roles = user?.roles || [user?.role || ""];
    const mapped = new Set<string>();
    roles.forEach((r) => {
      const lowerR = r.toLowerCase().trim();
      
      // Standard direct mappings
      if (lowerR === "guru" || lowerR === "guru halaqoh" || lowerR === "guru_halaqoh") {
        mapped.add("guru");
      }
      if (lowerR === "musrif") {
        mapped.add("musrif");
      }
      if (lowerR === "staff" || lowerR === "operator" || lowerR === "tata usaha" || lowerR === "tata_usaha") {
        mapped.add("staff");
        mapped.add("tata usaha");
      }
      if (lowerR === "wakil kepala sekolah" || lowerR === "wakakur" || lowerR === "wakasis" || lowerR === "wakasarpras" || lowerR === "waka kurikulum") {
        mapped.add("wakil kepala sekolah");
        mapped.add("guru"); // A vice principal is also a teacher
      }
      if (lowerR === "kepala sekolah" || lowerR === "kepala_sekolah" || lowerR === "pimpinan") {
        mapped.add("kepala sekolah");
        mapped.add("guru"); // A principal is also a teacher
      }
      if (lowerR === "ketua yayasan" || lowerR === "ketua_yayasan") {
        mapped.add("ketua yayasan");
        mapped.add("kepala sekolah"); // Ketua yayasan can fill principal/pimpinan level
        mapped.add("guru");
      }
      if (lowerR === "admin") {
        // Admins can see and fill everything
        mapped.add("admin");
        mapped.add("guru");
        mapped.add("staff");
        mapped.add("musrif");
        mapped.add("wakil kepala sekolah");
        mapped.add("kepala sekolah");
        mapped.add("tata usaha");
      }
      
      mapped.add(lowerR);
    });
    return Array.from(mapped);
  }, [userRolesStr, user?.role]);

  const isAdmin = originalUserRoles.some(r => (r || "").toLowerCase().trim() === "admin") || user?.role?.toLowerCase() === "admin";
  const isKepalaSekolah = originalUserRoles.some(r => ["kepala sekolah", "kepala_sekolah", "pimpinan"].includes((r || "").toLowerCase().trim())) || ["kepala sekolah", "kepala_sekolah", "pimpinan"].includes((user?.role || "").toLowerCase());
  const isWakaKurikulum = originalUserRoles.some(r => ["wakil kepala sekolah", "wakil_kepala_sekolah", "wakakur", "waka kurikulum"].includes((r || "").toLowerCase().trim())) || ["wakil kepala sekolah", "wakil_kepala_sekolah", "wakakur"].includes((user?.role || "").toLowerCase());
  const isKetuaYayasan = originalUserRoles.some(r => ["ketua yayasan", "ketua_yayasan"].includes((r || "").toLowerCase().trim())) || (user?.role || "").toLowerCase().includes("yayasan");
  const isOperator = originalUserRoles.some(r => ["operator", "tata usaha", "admin"].includes((r || "").toLowerCase().trim())) || (user?.role || "").toLowerCase() === "operator";

  const canManageIndicators = isKepalaSekolah || isWakaKurikulum || isKetuaYayasan || isAdmin || isOperator;
  const canViewAllRekap = isKepalaSekolah || isWakaKurikulum || isKetuaYayasan || isAdmin;

  // Active Tab synchronized with URL search parameter
  const urlTab = searchParams.get("tab") || "dashboard";
  const activeTab = (
    ["dashboard", "saya", "daily", "weekly", "monthly", "semester", "yearly", "pengaturan", "logs"].includes(urlTab)
      ? urlTab
      : "dashboard"
  ) as "dashboard" | "saya" | "daily" | "weekly" | "monthly" | "semester" | "yearly" | "pengaturan" | "logs";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // Selected date for "saya" fill-up (defaults to today)
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Load all indicators
  const { data: indicators = EMPTY_ARRAY, isLoading: isLoadingIndicators } = useQuery<SdmMutabaahIndicator[]>({
    queryKey: ["mutabaahIndicators"],
    queryFn: () => mutabaahService.getIndicators()
  });

  // Load today's entry
  const { data: todayEntry } = useQuery<SdmMutabaahEntry | null>({
    queryKey: ["mutabaahEntry", user?.userId, selectedDate],
    queryFn: () => mutabaahService.getDailyEntry(user?.userId || "", selectedDate),
    enabled: !!user?.userId
  });

  // Load user entry history
  const { data: userHistory = EMPTY_ARRAY, isLoading: isLoadingHistory } = useQuery<SdmMutabaahEntry[]>({
    queryKey: ["mutabaahHistory", user?.userId],
    queryFn: () => mutabaahService.getUserEntries(user?.userId || ""),
    enabled: !!user?.userId
  });

  // Load all users (for monitoring and templates)
  const { data: allUsers = EMPTY_ARRAY } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => userService.getUsers(),
    enabled: true
  });

  // Load monitoring entries for selected date
  const [monitoredDate, setMonitoredDate] = useState<string>(todayStr);
  const [monitoredRole, setMonitoredRole] = useState<string>("Semua");
  const { data: monitoringEntries = EMPTY_ARRAY, isLoading: isLoadingMonitoring } = useQuery<SdmMutabaahEntry[]>({
    queryKey: ["mutabaahAllEntries", monitoredDate],
    queryFn: () => mutabaahService.getAllEntries(monitoredDate),
    enabled: activeTab === "daily" || activeTab === "dashboard"
  });

  // Load all entries globally for rekap
  const { data: globalEntries = EMPTY_ARRAY } = useQuery<SdmMutabaahEntry[]>({
    queryKey: ["mutabaahAllEntriesGlobal"],
    queryFn: () => mutabaahService.getAllEntries(),
    enabled: ["weekly", "monthly", "semester", "yearly", "dashboard"].includes(activeTab)
  });

  // Load change logs
  const { data: changeLogs = EMPTY_ARRAY } = useQuery<SdmMutabaahChangeLog[]>({
    queryKey: ["mutabaahLogs"],
    queryFn: () => mutabaahService.getChangeLogs(),
    enabled: activeTab === "logs"
  });

  const getIndonesianDayName = (dateString: string): string => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      const dayIndex = date.getDay();
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      return days[dayIndex];
    }
    const date = new Date(dateString);
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return days[date.getDay()];
  };

  const getIndonesianCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Local state for filling up Mutabaah
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formAttachments, setFormAttachments] = useState<Record<string, string>>({});

  // Get active indicators that apply to current user's role, gender, and selected day
  const myApplicableIndicators = useMemo(() => {
    const selectedDayName = getIndonesianDayName(selectedDate);
    return indicators.filter(
      (ind) => {
        if (!ind.isActive || ind.isArchived) return false;
        
        // 1. Check roles
        const indRoles = Array.isArray(ind.applicableRoles) && ind.applicableRoles.length > 0
          ? ind.applicableRoles
          : ["guru", "musrif", "staff", "wakil kepala sekolah", "kepala sekolah", "tata usaha", "operator", "pimpinan", "ketua yayasan", "admin"];

        const roleMatches = indRoles.some((r) => {
          const checkRole = r.toLowerCase().trim();
          return userRoles.some(ur => {
            const userR = ur.toLowerCase().trim();
            if (userR === checkRole) return true;
            if (checkRole === "guru" && (userR === "guru halaqoh" || userR === "guru_halaqoh" || userR === "wakil kepala sekolah" || userR === "kepala sekolah" || userR === "pimpinan" || userR === "admin")) return true;
            if ((checkRole === "guru halaqoh" || checkRole === "guru_halaqoh") && userR === "guru") return true;
            if (checkRole === "staff" && (userR === "tata usaha" || userR === "tata_usaha" || userR === "operator" || userR === "admin")) return true;
            return false;
          });
        });
        if (!roleMatches) return false;

        // 2. Check gender
        if (user?.gender) {
          const g = user.gender.toLowerCase().trim();
          const isMale = g === "l" || g.includes("laki") || g.includes("ikhwan") || g === "male";
          const isFemale = g === "p" || g.includes("perempuan") || g.includes("akhwat") || g === "female";
          if (isMale && ind.appliesToMale === false) return false;
          if (isFemale && ind.appliesToFemale === false) return false;
        }

        // 3. Check days applicable
        if (ind.frequency === "harian" && (!ind.applicableDays || ind.applicableDays.length === 0 || ind.applicableDays.length >= 6)) {
          // Applies every day for daily indicator
        } else if (ind.applicableDays && ind.applicableDays.length > 0) {
          const matchDay = ind.applicableDays.some((d) => d.toLowerCase().trim() === selectedDayName.toLowerCase().trim());
          if (!matchDay) return false;
        }

        return true;
      }
    );
  }, [indicators, userRoles, user?.gender, selectedDate]);

  const indicatorsKey = useMemo(() => {
    return myApplicableIndicators.map((ind) => `${ind.id}-${ind.inputType}`).join(",");
  }, [myApplicableIndicators]);

  // Sync values to form
  useEffect(() => {
    const emptyVals: Record<string, any> = {};
    const emptyAtts: Record<string, string> = {};

    const formatPrayerValue = (val: any) => {
      if (typeof val === "object" && val !== null) {
        return { subuh: false, dzuhur: false, ashar: false, maghrib: false, isya: false, ...val };
      }
      if (val === true) {
        return { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true };
      }
      return { subuh: false, dzuhur: false, ashar: false, maghrib: false, isya: false };
    };

    myApplicableIndicators.forEach((ind) => {
      if (ind.inputType === "boolean") emptyVals[ind.id] = false;
      else if (ind.inputType === "prayers_5") emptyVals[ind.id] = { subuh: false, dzuhur: false, ashar: false, maghrib: false, isya: false };
      else if (ind.inputType === "number") emptyVals[ind.id] = 0;
      else if (ind.inputType === "percentage") emptyVals[ind.id] = 0;
      else if (ind.inputType === "choice") emptyVals[ind.id] = "Cukup";
      else emptyVals[ind.id] = "";
      emptyAtts[ind.id] = "";
    });

    const targetMonth = selectedDate.substring(0, 7); // "YYYY-MM"

    const todayVals = todayEntry?.values || {};
    const todayAtts = todayEntry?.attachmentUrls || {};

    myApplicableIndicators.forEach((ind) => {
      if (ind.frequency === "bulanan") {
        const sameMonthEntry = userHistory.find((entry) => {
          if (entry.date.substring(0, 7) !== targetMonth) return false;
          const val = entry.values?.[ind.id];
          if (ind.inputType === "boolean") return val === true;
          if (ind.inputType === "prayers_5") {
            const p = formatPrayerValue(val);
            return p.subuh && p.dzuhur && p.ashar && p.maghrib && p.isya;
          }
          if (ind.inputType === "number" || ind.inputType === "percentage") return (parseFloat(val) || 0) > 0;
          if (ind.inputType === "choice") return val && val !== "Cukup" && val !== "Perlu Pembinaan";
          return val && String(val).trim().length > 0;
        });

        if (todayVals[ind.id] !== undefined) {
          emptyVals[ind.id] = ind.inputType === "prayers_5" ? formatPrayerValue(todayVals[ind.id]) : todayVals[ind.id];
        } else if (sameMonthEntry && sameMonthEntry.values?.[ind.id] !== undefined) {
          emptyVals[ind.id] = ind.inputType === "prayers_5" ? formatPrayerValue(sameMonthEntry.values[ind.id]) : sameMonthEntry.values[ind.id];
        }

        if (todayAtts[ind.id] !== undefined) {
          emptyAtts[ind.id] = todayAtts[ind.id];
        } else if (sameMonthEntry && sameMonthEntry.attachmentUrls?.[ind.id] !== undefined) {
          emptyAtts[ind.id] = sameMonthEntry.attachmentUrls[ind.id];
        }
      } else {
        if (todayVals[ind.id] !== undefined) {
          emptyVals[ind.id] = ind.inputType === "prayers_5" ? formatPrayerValue(todayVals[ind.id]) : todayVals[ind.id];
        }
        if (todayAtts[ind.id] !== undefined) {
          emptyAtts[ind.id] = todayAtts[ind.id];
        }
      }
    });

    setFormValues(emptyVals);
    setFormAttachments(emptyAtts);
  }, [todayEntry, userHistory, selectedDate, indicatorsKey]);

  // Handle value change during filling
  const handleValueChange = (indicatorId: string, val: any) => {
    setFormValues((prev) => ({
      ...prev,
      [indicatorId]: val
    }));
  };

  const handleAttachmentChange = (indicatorId: string, val: string) => {
    setFormAttachments((prev) => ({
      ...prev,
      [indicatorId]: val
    }));
  };

  const getIndicatorStatus = (ind: SdmMutabaahIndicator) => {
    const selectedDayName = getIndonesianDayName(selectedDate);
    const isDayApplicable = !ind.applicableDays || ind.applicableDays.length === 0 || ind.applicableDays.includes(selectedDayName);
    
    const activeHaidStatus = todayEntry?.userHaidStatus || user?.haidStatus || "Normal";
    const isHaidExempt = user?.gender === "P" && activeHaidStatus === "Haid" && ind.excludeDuringHaid === true;

    if (!isDayApplicable || isHaidExempt) {
      return "Dikecualikan";
    }

    if (selectedDate === todayStr && ind.frequency === "waktu" && ind.startTime) {
      const currentTime = getIndonesianCurrentTime();
      if (currentTime < ind.startTime) {
        return "Belum Waktunya";
      }
    }

    const rawVal = formValues[ind.id];
    let hasValue = false;
    
    if (ind.inputType === "boolean") {
      hasValue = rawVal === true;
    } else if (ind.inputType === "prayers_5") {
      const pObj = typeof rawVal === "object" && rawVal !== null
        ? rawVal
        : (rawVal === true ? { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true } : {});
      hasValue = !!(pObj.subuh && pObj.dzuhur && pObj.ashar && pObj.maghrib && pObj.isya);
    } else if (ind.inputType === "number" || ind.inputType === "percentage") {
      const num = parseFloat(rawVal) || 0;
      hasValue = num >= ind.target;
    } else if (ind.inputType === "choice") {
      hasValue = rawVal === "Sangat Baik" || rawVal === "Baik";
    } else {
      hasValue = rawVal && String(rawVal).trim().length > 0;
    }

    return hasValue ? "Dilaksanakan" : "Belum Dilaksanakan";
  };

  const missedIndicators = useMemo(() => {
    if (selectedDate !== todayStr) return [];
    const currentTime = getIndonesianCurrentTime();
    return myApplicableIndicators.filter((ind) => {
      if (ind.frequency === "waktu" && ind.endTime) {
        if (currentTime > ind.endTime) {
          const status = getIndicatorStatus(ind);
          return status === "Belum Dilaksanakan";
        }
      }
      return false;
    });
  }, [myApplicableIndicators, formValues, selectedDate, todayStr]);

  const toggleHaidStatus = async () => {
    if (!user) return;
    const nextStatus = user.haidStatus === "Haid" ? "Normal" : "Haid";
    try {
      await userService.updateUserHaidStatus(user.uid, nextStatus, user.uid, user.name || user.displayName);
      await refreshProfile();
      toast(`Status haid diubah menjadi ${nextStatus === "Haid" ? "Haid" : "Normal"}`, "success");
    } catch (error) {
      toast("Gagal mengubah status haid", "error");
    }
  };

  const currentCompliancePercent = useMemo(() => {
    if (myApplicableIndicators.length === 0) return 100;

    let totalWeight = 0;
    let earnedWeight = 0;

    myApplicableIndicators.forEach((ind) => {
      const status = getIndicatorStatus(ind);
      if (status === "Dikecualikan" || status === "Belum Waktunya") {
        return;
      }

      const weight = ind.weight || 1;
      totalWeight += weight;

      const rawVal = formValues[ind.id];
      let compliance = 0;

      if (ind.inputType === "boolean") {
        compliance = rawVal === true ? 1 : 0;
      } else if (ind.inputType === "prayers_5") {
        const pObj = typeof rawVal === "object" && rawVal !== null
          ? rawVal
          : (rawVal === true ? { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true } : {});
        const checkedCount = ["subuh", "dzuhur", "ashar", "maghrib", "isya"].filter(p => !!pObj[p]).length;
        compliance = checkedCount / 5;
      } else if (ind.inputType === "number") {
        const num = parseFloat(rawVal) || 0;
        compliance = ind.target > 0 ? Math.min(num / ind.target, 1) : 1;
      } else if (ind.inputType === "percentage") {
        const pct = parseFloat(rawVal) || 0;
        compliance = ind.target > 0 ? Math.min(pct / ind.target, 1) : 1;
      } else if (ind.inputType === "choice") {
        if (rawVal === "Sangat Baik" || rawVal === "Baik") compliance = 1;
        else if (rawVal === "Cukup") compliance = 0.5;
        else compliance = 0;
      } else {
        compliance = rawVal && String(rawVal).trim().length > 0 ? 1 : 0;
      }

      earnedWeight += compliance * weight;
    });

    return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;
  }, [myApplicableIndicators, formValues, selectedDate, user?.haidStatus, todayEntry?.userHaidStatus]);

  const saveEntryMutation = useMutation({
    mutationFn: async () => {
      const entryPayload: Omit<SdmMutabaahEntry, "createdAt" | "updatedAt"> = {
        id: `${user?.userId}_${selectedDate}`,
        userId: user?.userId || "",
        userName: user?.name || user?.displayName || user?.email.split("@")[0] || "",
        userRole: user?.role || "",
        date: selectedDate,
        values: formValues,
        attachmentUrls: formAttachments,
        compliancePercentage: currentCompliancePercent,
        userHaidStatus: user?.haidStatus || "Normal",
        gender: user?.gender || "L"
      };
      await mutabaahService.saveDailyEntry(entryPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahEntry"] });
      queryClient.invalidateQueries({ queryKey: ["mutabaahHistory"] });
      queryClient.invalidateQueries({ queryKey: ["mutabaahAllEntriesGlobal"] });
      toast("Mutabaah Harian berhasil disimpan!", "success");
    },
    onError: (err: any) => {
      toast(`Gagal menyimpan mutabaah: ${err.message}`, "error");
    }
  });

  // --- INDICATOR CONFIG STATE ---
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<SdmMutabaahIndicator | null>(null);
  const [indicatorForm, setIndicatorForm] = useState<Omit<SdmMutabaahIndicator, "createdAt" | "updatedAt" | "updatedBy">>({
    id: "",
    name: "",
    category: "Ibadah Wajib",
    inputType: "boolean",
    target: 1,
    unit: "kali",
    applicableRoles: ["guru"],
    weight: 10,
    isActive: true,
    isArchived: false,
    frequency: "harian",
    applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Sabtu", "Minggu"],
    startTime: "",
    endTime: "",
    appliesToMale: true,
    appliesToFemale: true,
    excludeDuringHaid: false
  });

  const handleOpenIndicatorModal = (ind: SdmMutabaahIndicator | null) => {
    if (ind) {
      setSelectedIndicator(ind);
      setIndicatorForm({
        id: ind.id,
        name: ind.name,
        category: ind.category || "Ibadah Wajib",
        inputType: ind.inputType,
        target: ind.target,
        unit: ind.unit,
        applicableRoles: ind.applicableRoles || [],
        weight: ind.weight || 10,
        isActive: ind.isActive,
        isArchived: ind.isArchived,
        frequency: ind.frequency || "harian",
        applicableDays: ind.applicableDays || [],
        startTime: ind.startTime || "",
        endTime: ind.endTime || "",
        appliesToMale: ind.appliesToMale !== false,
        appliesToFemale: ind.appliesToFemale !== false,
        excludeDuringHaid: ind.excludeDuringHaid === true
      });
    } else {
      setSelectedIndicator(null);
      setIndicatorForm({
        id: `m_${Math.random().toString(36).substring(2, 11)}`,
        name: "",
        category: "Ibadah Wajib",
        inputType: "boolean",
        target: 1,
        unit: "kali",
        applicableRoles: ["guru", "musrif", "staff"],
        weight: 10,
        isActive: true,
        isArchived: false,
        frequency: "harian",
        applicableDays: ["Senin", "Selasa", "Rabu", "Kamis", "Sabtu", "Minggu"],
        startTime: "",
        endTime: "",
        appliesToMale: true,
        appliesToFemale: true,
        excludeDuringHaid: false
      });
    }
    setIsIndicatorModalOpen(true);
  };

  const saveIndicatorMutation = useMutation({
    mutationFn: async () => {
      await mutabaahService.saveIndicator(
        {
          id: indicatorForm.id,
          name: indicatorForm.name,
          category: indicatorForm.category,
          inputType: indicatorForm.inputType,
          target: indicatorForm.target,
          unit: indicatorForm.unit,
          applicableRoles: indicatorForm.applicableRoles,
          weight: indicatorForm.weight,
          frequency: indicatorForm.frequency,
          applicableDays: indicatorForm.applicableDays,
          startTime: indicatorForm.startTime,
          endTime: indicatorForm.endTime,
          appliesToMale: indicatorForm.appliesToMale,
          appliesToFemale: indicatorForm.appliesToFemale,
          excludeDuringHaid: indicatorForm.excludeDuringHaid
        },
        user?.name || user?.displayName || "System",
        user?.userId || ""
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahIndicators"] });
      setIsIndicatorModalOpen(false);
      toast(selectedIndicator ? "Indikator berhasil diperbarui!" : "Indikator baru berhasil ditambahkan!", "success");
    },
    onError: (err: any) => {
      toast(`Gagal menyimpan indikator: ${err.message}`, "error");
    }
  });

  const archiveIndicatorMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      await mutabaahService.archiveIndicator(
        id,
        name,
        user?.name || user?.displayName || "System",
        user?.userId || ""
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahIndicators"] });
      toast("Indikator berhasil diarsipkan!", "success");
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, name, currentStatus }: { id: string; name: string; currentStatus: boolean }) => {
      await mutabaahService.toggleIndicatorActive(
        id,
        name,
        currentStatus,
        user?.name || user?.displayName || "System",
        user?.userId || ""
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahIndicators"] });
      toast("Status aktif indikator berhasil diubah!", "success");
    }
  });

  // --- TEMPLATE LOGIC ---
  const [templateRole, setTemplateRole] = useState<string>("guru");
  const handleSaveTemplate = async () => {
    try {
      const roleInds = indicators.filter(
        (ind) => !ind.isArchived && Array.isArray(ind.applicableRoles) && ind.applicableRoles.includes(templateRole)
      );
      if (roleInds.length === 0) {
        toast(`Tidak ada indikator aktif untuk peran ${templateRole.toUpperCase()}`, "warning");
        return;
      }
      const templateId = `tpl_${templateRole}_${Date.now()}`;
      await mutabaahService.saveTemplate({
        id: templateId,
        name: `Template ${templateRole.toUpperCase()} - ${new Date().toLocaleDateString("id-ID")}`,
        role: templateRole,
        updatedBy: user?.name || user?.displayName || "System",
        indicators: roleInds.map((ind) => ({
          id: ind.id,
          name: ind.name,
          category: ind.category,
          inputType: ind.inputType,
          target: ind.target,
          unit: ind.unit,
          applicableRoles: ind.applicableRoles,
          weight: ind.weight,
          isActive: ind.isActive,
          isArchived: ind.isArchived,
          updatedBy: ind.updatedBy,
          frequency: ind.frequency || "harian",
          applicableDays: ind.applicableDays || ["Senin", "Selasa", "Rabu", "Kamis", "Sabtu", "Minggu"],
          startTime: ind.startTime || "",
          endTime: ind.endTime || "",
          appliesToMale: ind.appliesToMale !== undefined ? ind.appliesToMale : true,
          appliesToFemale: ind.appliesToFemale !== undefined ? ind.appliesToFemale : true,
          excludeDuringHaid: ind.excludeDuringHaid !== undefined ? ind.excludeDuringHaid : false
        }))
      });
      toast(`Template untuk peran ${templateRole.toUpperCase()} berhasil disimpan!`, "success");
    } catch (e: any) {
      toast(`Gagal menyimpan template: ${e.message}`, "error");
    }
  };

  // Filtered monitoring table data
  const filteredMonitoringList = useMemo(() => {
    let sdmList = allUsers.filter((u) => u.status === "Aktif");
    if (!canViewAllRekap) {
      sdmList = sdmList.filter((u) => u.userId === user?.userId || u.id === user?.userId);
      if (sdmList.length === 0 && user) {
        sdmList = [{
          userId: user.userId,
          name: user.name || user.displayName || "Saya",
          role: user.role || "guru",
          roles: user.roles || [user.role || "guru"],
          status: "Aktif"
        } as any];
      }
    }

    return sdmList
      .map((u) => {
        const uRole = u.role || "";
        const uRoles = u.roles || [uRole];
        const entry = monitoringEntries.find((e) => e.userId === u.userId);

        return {
          userId: u.userId,
          name: u.name || u.email?.split("@")[0] || "",
          role: uRole,
          roles: uRoles,
          filled: !!entry,
          compliance: entry ? entry.compliancePercentage : null,
          entry
        };
      })
      .filter((u) => {
        if (monitoredRole === "Semua") return true;
        return u.roles.some((r: string) => (r || "").toLowerCase().trim() === monitoredRole.toLowerCase().trim());
      });
  }, [allUsers, monitoringEntries, monitoredRole, canViewAllRekap, user]);

  // --- ANALYTICS DASHBOARD CALCULATIONS ---
  const dashboardStats = useMemo(() => {
    const userEntries = globalEntries.filter(e => e.userId === user?.userId);
    
    // Streaks
    let streak = 0;
    const sortedUserEntries = [...userEntries].sort((a, b) => b.date.localeCompare(a.date));
    for (let i = 0; i < sortedUserEntries.length; i++) {
      if (sortedUserEntries[i].compliancePercentage >= 80) {
        streak++;
      } else {
        break;
      }
    }

    // Averages
    const totalEntries = userEntries.length;
    const averageCompliance = totalEntries > 0 
      ? Math.round(userEntries.reduce((sum, e) => sum + e.compliancePercentage, 0) / totalEntries)
      : 100;

    // Categories breakdown
    const categoriesList = ["Ibadah Wajib", "Ibadah Sunnah", "Ruhiyah", "Akhlak"];
    const categoryAverages = categoriesList.map(cat => {
      const catInds = indicators.filter(i => i.category === cat);
      if (catInds.length === 0) return { category: cat, compliance: 100 };

      let totalCount = 0;
      let trueCount = 0;

      userEntries.forEach(entry => {
        catInds.forEach(ind => {
          const val = entry.values?.[ind.id];
          if (val !== undefined) {
            totalCount++;
            if (ind.inputType === "boolean" && val === true) trueCount++;
            else if (ind.inputType === "prayers_5") {
              if (typeof val === "object" && val !== null && val.subuh && val.dzuhur && val.ashar && val.maghrib && val.isya) {
                trueCount++;
              } else if (val === true) {
                trueCount++;
              }
            }
            else if ((ind.inputType === "number" || ind.inputType === "percentage") && (parseFloat(val) || 0) >= ind.target) trueCount++;
            else if (ind.inputType === "choice" && (val === "Sangat Baik" || val === "Baik")) trueCount++;
            else if (ind.inputType === "text" && String(val).trim().length > 0) trueCount++;
          }
        });
      });

      return {
        category: cat,
        compliance: totalCount > 0 ? Math.round((trueCount / totalCount) * 100) : 100
      };
    });

    // Monthly Trend Chart
    const trendData = sortedUserEntries.slice(0, 15).reverse().map(e => ({
      date: e.date.substring(8, 10) + "/" + e.date.substring(5, 7),
      compliance: e.compliancePercentage
    }));

    return {
      streak,
      averageCompliance,
      categoryAverages,
      trendData
    };
  }, [globalEntries, user?.userId, indicators]);

  // --- REKAPITULASI PERIODIK DECOUPLED DATA ---
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedSemester, setSelectedSemester] = useState<number>(1);

  // Helper to get active SDM list according to permissions
  const activeSdmList = useMemo(() => {
    let sdm = allUsers.filter(u => u.status === "Aktif");
    if (!canViewAllRekap) {
      sdm = sdm.filter(u => u.userId === user?.userId || u.id === user?.userId);
      if (sdm.length === 0 && user) {
        sdm = [{
          userId: user.userId,
          name: user.name || user.displayName || "Saya",
          role: user.role || "guru",
          status: "Aktif"
        } as any];
      }
    }
    return sdm;
  }, [allUsers, canViewAllRekap, user]);

  // Weekly report calculations
  const weeklyReportData = useMemo(() => {
    const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
    const activeSdm = activeSdmList;

    return activeSdm.map(u => {
      const uEntries = globalEntries.filter(e => e.userId === u.userId && e.date.startsWith(yearMonth));
      
      // Split into 4 virtual weeks
      const w1 = uEntries.filter(e => parseInt(e.date.split("-")[2], 10) <= 7);
      const w2 = uEntries.filter(e => parseInt(e.date.split("-")[2], 10) > 7 && parseInt(e.date.split("-")[2], 10) <= 14);
      const w3 = uEntries.filter(e => parseInt(e.date.split("-")[2], 10) > 14 && parseInt(e.date.split("-")[2], 10) <= 21);
      const w4 = uEntries.filter(e => parseInt(e.date.split("-")[2], 10) > 21);

      const calcAvg = (entries: SdmMutabaahEntry[]) => {
        return entries.length > 0 
          ? Math.round(entries.reduce((sum, e) => sum + e.compliancePercentage, 0) / entries.length)
          : null;
      };

      const w1Avg = calcAvg(w1);
      const w2Avg = calcAvg(w2);
      const w3Avg = calcAvg(w3);
      const w4Avg = calcAvg(w4);

      const overall = uEntries.length > 0 
        ? Math.round(uEntries.reduce((sum, e) => sum + e.compliancePercentage, 0) / uEntries.length)
        : null;

      return {
        userId: u.userId,
        name: u.name || u.email?.split("@")[0] || "",
        role: u.role || "",
        w1: w1Avg,
        w2: w2Avg,
        w3: w3Avg,
        w4: w4Avg,
        overall
      };
    });
  }, [globalEntries, activeSdmList, selectedYear, selectedMonth]);

  // Monthly report calculations
  const monthlyReportData = useMemo(() => {
    const activeSdm = activeSdmList;
    return activeSdm.map(u => {
      const uEntries = globalEntries.filter(e => e.userId === u.userId && e.date.startsWith(String(selectedYear)));
      const monthlyAverages = Array.from({ length: 12 }, (_, i) => {
        const monthStr = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
        const monthEntries = uEntries.filter(e => e.date.startsWith(monthStr));
        return monthEntries.length > 0 
          ? Math.round(monthEntries.reduce((sum, e) => sum + e.compliancePercentage, 0) / monthEntries.length)
          : null;
      });

      const overall = uEntries.length > 0
        ? Math.round(uEntries.reduce((sum, e) => sum + e.compliancePercentage, 0) / uEntries.length)
        : null;

      return {
        userId: u.userId,
        name: u.name || u.email?.split("@")[0] || "",
        role: u.role || "",
        months: monthlyAverages,
        overall
      };
    });
  }, [globalEntries, activeSdmList, selectedYear]);

  // Semester report calculations
  const semesterReportData = useMemo(() => {
    const activeSdm = activeSdmList;
    const targetMonths = selectedSemester === 1 ? [7, 8, 9, 10, 11, 12] : [1, 2, 3, 4, 5, 6];

    return activeSdm.map(u => {
      const uEntries = globalEntries.filter(e => {
        if (e.userId !== u.userId) return false;
        const entryYear = parseInt(e.date.split("-")[0], 10);
        const entryMonth = parseInt(e.date.split("-")[1], 10);
        return entryYear === selectedYear && targetMonths.includes(entryMonth);
      });

      const monthAverages = targetMonths.map(m => {
        const monthStr = `${selectedYear}-${String(m).padStart(2, "0")}`;
        const monthEntries = uEntries.filter(e => e.date.startsWith(monthStr));
        return monthEntries.length > 0 
          ? Math.round(monthEntries.reduce((sum, e) => sum + e.compliancePercentage, 0) / monthEntries.length)
          : null;
      });

      const overall = uEntries.length > 0
        ? Math.round(uEntries.reduce((sum, e) => sum + e.compliancePercentage, 0) / uEntries.length)
        : null;

      return {
        userId: u.userId,
        name: u.name || u.email?.split("@")[0] || "",
        role: u.role || "",
        months: monthAverages,
        overall
      };
    });
  }, [globalEntries, activeSdmList, selectedYear, selectedSemester]);

  // Export to CSV helper
  const handleExportCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 dark:border-zinc-800 pb-5 gap-4">
        <div>
          <span className="text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Modul Mutabaah GTK
          </span>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mt-1">Mutabaah Ruhiyah GTK</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Fokus pada peningkatan ruhiyah, pembinaan spiritual, ibadah wajib/sunnah, dan penguatan akhlak mulia asatidzah pondok pesantren.
          </p>
        </div>

        {/* Tab Selector Links */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("saya")}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "saya"
                ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Isi Mutabaah
          </button>
          {(isKepalaSekolah || isWakaKurikulum || isKetuaYayasan || isAdmin) && (
            <>
              <button
                onClick={() => setActiveTab("daily")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "daily"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Harian
              </button>
              <button
                onClick={() => setActiveTab("weekly")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "weekly"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Mingguan
              </button>
              <button
                onClick={() => setActiveTab("monthly")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "monthly"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Bulanan
              </button>
              <button
                onClick={() => setActiveTab("semester")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "semester"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Semester
              </button>
              <button
                onClick={() => setActiveTab("yearly")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "yearly"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Tahunan
              </button>
            </>
          )}
          {canManageIndicators && (
            <>
              <button
                onClick={() => setActiveTab("pengaturan")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "pengaturan"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Indikator
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "logs"
                    ? "bg-white dark:bg-zinc-850 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Logs
              </button>
            </>
          )}
        </div>
      </div>

      {isLoadingIndicators ? (
        <Loading />
      ) : (
        <>
          {/* TAB 1: DASHBOARD MUTABAAH */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Top stats grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Rata-rata Kepatuhan</span>
                    <div className="text-3xl font-black text-rose-600 dark:text-rose-400">{dashboardStats.averageCompliance}%</div>
                    <p className="text-[10px] text-slate-400">Seluruh pengisian Anda</p>
                  </div>
                  <div className="h-12 w-12 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl flex items-center justify-center">
                    <Award className="h-6 w-6" />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Konsistensi Beruntun</span>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{dashboardStats.streak} Hari</div>
                    <p className="text-[10px] text-slate-400">Kepatuhan di atas 80%</p>
                  </div>
                  <div className="h-12 w-12 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                    <Heart className="h-6 w-6 animate-pulse" />
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-2xl flex items-center justify-between shadow-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">Total Pengisian</span>
                    <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                      {globalEntries.filter(e => e.userId === user?.userId).length} Kali
                    </div>
                    <p className="text-[10px] text-slate-400">Mencatat spiritualitas harian</p>
                  </div>
                  <div className="h-12 w-12 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Chart & Categories breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-3xl shadow-xs space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Tren Kepatuhan Mutabaah Ruhiyah</h3>
                    <span className="text-[10px] text-slate-400 font-bold">15 Pengisian Terakhir</span>
                  </div>
                  <div className="h-64">
                    {dashboardStats.trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dashboardStats.trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} fontWeight={700} />
                          <YAxis stroke="#94a3b8" fontSize={10} fontWeight={700} domain={[0, 100]} />
                          <Tooltip contentStyle={{ fontSize: 11, fontWeight: 700, borderRadius: 12 }} />
                          <Line type="monotone" dataKey="compliance" name="Persentase Kepatuhan" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                        Belum ada data untuk digambarkan secara grafis. Silakan isi mutabaah harian Anda.
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-3xl shadow-xs space-y-5">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-zinc-800 pb-2">
                    Skor Kepatuhan Per Kategori
                  </h3>
                  <div className="space-y-4">
                    {dashboardStats.categoryAverages.map(cat => (
                      <div key={cat.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 dark:text-zinc-300">{cat.category}</span>
                          <span className="font-black text-slate-900 dark:text-white">{cat.compliance}%</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-zinc-850 rounded-full h-2">
                          <div
                            className="bg-rose-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${cat.compliance}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ISI MUTABAAH SAYA */}
          {activeTab === "saya" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Input */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-rose-600" />
                    <div>
                      <h2 className="text-md font-bold text-slate-800 dark:text-white">Isi Evaluasi Mutabaah</h2>
                      <p className="text-[10px] text-slate-400">Silakan isi perkembangan mutabaah pribadi Anda.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.gender === "P" && (
                      <button
                        type="button"
                        onClick={toggleHaidStatus}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                          user.haidStatus === "Haid"
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900/50 dark:text-indigo-400"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-750"
                        }`}
                      >
                        <Archive className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        Status: {user.haidStatus === "Haid" ? "Sedang Haid" : "Normal"}
                      </button>
                    )}
                    <input
                      type="date"
                      value={selectedDate}
                      max={todayStr}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {myApplicableIndicators.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Tidak ada indikator mutabaah yang terdaftar untuk peran Anda ({originalUserRoles.join(", ").toUpperCase()}). Hubungi Kepala Sekolah atau Waka Kurikulum.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Time limit alerts */}
                    {missedIndicators.length > 0 && (
                      <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 p-4 rounded-xl flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs">
                          <h4 className="font-extrabold text-amber-800 dark:text-amber-400">Pengingat Waktu Pelaksanaan</h4>
                          <p className="text-amber-700/90 dark:text-amber-500 mt-1">
                            Indikator berikut telah melewati batas waktu pelaksanaan hari ini tetapi belum diisi:{" "}
                            <span className="font-bold">
                              {missedIndicators.map((ind) => ind.name).join(", ")}
                            </span>.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Grouping by Spiritual categories */}
                    {["Ibadah Wajib", "Ibadah Sunnah", "Ruhiyah", "Akhlak"].map((cat) => {
                      const catInds = myApplicableIndicators.filter((i) => i.category === cat);
                      if (catInds.length === 0) return null;

                      return (
                        <div key={cat} className="space-y-3">
                          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-l-2 border-rose-500 pl-2">{cat}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {catInds.map((ind) => {
                              const status = getIndicatorStatus(ind);
                              return (
                                <div
                                  key={ind.id}
                                  className="p-4 bg-slate-50/50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-850 rounded-xl space-y-3 relative overflow-hidden"
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200">{ind.name}</h4>
                                      <p className="text-[9px] text-slate-400 mt-0.5 capitalize">
                                        Frekuensi: {ind.frequency} {ind.startTime ? `(${ind.startTime} - ${ind.endTime})` : ""}
                                      </p>
                                    </div>
                                    <span
                                      className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
                                        status === "Dilaksanakan"
                                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                                          : status === "Dikecualikan"
                                          ? "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                                          : status === "Belum Waktunya"
                                          ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                                          : "bg-red-50 text-red-600 dark:bg-red-950/10 dark:text-red-400"
                                      }`}
                                    >
                                      {status}
                                    </span>
                                  </div>

                                  {/* Inputs depending on indicator inputType */}
                                  <div className="pt-1">
                                    {ind.inputType === "boolean" && (
                                      <div className="flex items-center gap-3">
                                        <button
                                          type="button"
                                          onClick={() => handleValueChange(ind.id, true)}
                                          className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                                            formValues[ind.id] === true
                                              ? "bg-emerald-600 text-white"
                                              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                                          }`}
                                        >
                                          Sudah
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleValueChange(ind.id, false)}
                                          className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                                            formValues[ind.id] === false
                                              ? "bg-red-600 text-white"
                                              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                                          }`}
                                        >
                                          Belum
                                        </button>
                                      </div>
                                    )}

                                    {ind.inputType === "prayers_5" && (
                                      <div className="space-y-3">
                                        <div className="p-3 bg-slate-50/90 dark:bg-zinc-900/70 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                                          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                                            {[
                                              { id: "subuh", label: "Subuh" },
                                              { id: "dzuhur", label: "Dzuhur" },
                                              { id: "ashar", label: "Ashar" },
                                              { id: "maghrib", label: "Maghrib" },
                                              { id: "isya", label: "Isya" },
                                            ].map((p) => {
                                              const currentObj = typeof formValues[ind.id] === "object" && formValues[ind.id] !== null
                                                ? formValues[ind.id]
                                                : (formValues[ind.id] === true ? { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true } : {});
                                              const isChecked = !!currentObj[p.id];

                                              return (
                                                <button
                                                  key={p.id}
                                                  type="button"
                                                  onClick={() => {
                                                    const newObj = {
                                                      subuh: false,
                                                      dzuhur: false,
                                                      ashar: false,
                                                      maghrib: false,
                                                      isya: false,
                                                      ...currentObj,
                                                      [p.id]: !isChecked
                                                    };
                                                    handleValueChange(ind.id, newObj);
                                                  }}
                                                  className={`flex-1 min-w-[95px] sm:min-w-[105px] py-2 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-2 cursor-pointer select-none active:scale-98 whitespace-nowrap ${
                                                    isChecked
                                                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-600/20"
                                                      : "bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-750 hover:border-slate-300 dark:hover:border-zinc-600"
                                                  }`}
                                                >
                                                  <span className={`text-xs font-black shrink-0 ${isChecked ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`}>
                                                    {isChecked ? "✓" : "○"}
                                                  </span>
                                                  <span className="tracking-wide font-semibold">{p.label}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>

                                        {(() => {
                                          const currentObj = typeof formValues[ind.id] === "object" && formValues[ind.id] !== null
                                            ? formValues[ind.id]
                                            : (formValues[ind.id] === true ? { subuh: true, dzuhur: true, ashar: true, maghrib: true, isya: true } : {});
                                          const checkedCount = ["subuh", "dzuhur", "ashar", "maghrib", "isya"].filter(p => !!currentObj[p]).length;
                                          return (
                                            <div className="flex items-center justify-between text-[11px] px-1 text-slate-500 dark:text-zinc-400">
                                              <span>
                                                Status: <strong className={checkedCount === 5 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-800 dark:text-zinc-200"}>{checkedCount}/5 Waktu Terceklis</strong>
                                              </span>
                                              {checkedCount < 5 ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-medium text-[10px]">
                                                  (Belum lengkap, semua 5 waktu harus diceklis)
                                                </span>
                                              ) : (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                                                  ✓ Shalat 5 Waktu Lengkap
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}

                                    {ind.inputType === "number" && (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="number"
                                          value={formValues[ind.id] !== undefined ? formValues[ind.id] : ""}
                                          onChange={(e) => handleValueChange(ind.id, e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
                                          className="w-20 px-2 py-1 text-xs border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg text-slate-800 dark:text-zinc-200"
                                          placeholder="0"
                                        />
                                        <span className="text-[10px] text-slate-400">
                                          {ind.unit} (Target: {ind.target})
                                        </span>
                                      </div>
                                    )}

                                    {ind.inputType === "percentage" && (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="range"
                                          min="0"
                                          max="100"
                                          value={formValues[ind.id] !== undefined ? formValues[ind.id] : 0}
                                          onChange={(e) => handleValueChange(ind.id, parseFloat(e.target.value) || 0)}
                                          className="w-full h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                                        />
                                        <span className="text-xs font-black text-rose-600">
                                          {formValues[ind.id] !== undefined ? formValues[ind.id] : 0}%
                                        </span>
                                      </div>
                                    )}

                                    {ind.inputType === "choice" && (
                                      <select
                                        value={formValues[ind.id] || "Cukup"}
                                        onChange={(e) => handleValueChange(ind.id, e.target.value)}
                                        className="text-xs border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-1 w-full"
                                      >
                                        <option value="Sangat Baik">Sangat Baik</option>
                                        <option value="Baik">Baik</option>
                                        <option value="Cukup">Cukup</option>
                                        <option value="Perlu Pembinaan">Perlu Pembinaan</option>
                                      </select>
                                    )}

                                    {ind.inputType === "text" && (
                                      <input
                                        type="text"
                                        placeholder="Tulis deskripsi / laporan..."
                                        value={formValues[ind.id] || ""}
                                        onChange={(e) => handleValueChange(ind.id, e.target.value)}
                                        className="w-full text-xs border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2"
                                      />
                                    )}

                                    {/* Photo/Document simulated uploader */}
                                    {(ind.inputType === "photo" || ind.inputType === "document") && (
                                      <div className="space-y-1 mt-1">
                                        <input
                                          type="text"
                                          placeholder={ind.inputType === "photo" ? "Paste Link Foto Pendukung..." : "Paste Link Bukti Dokumen..."}
                                          value={formAttachments[ind.id] || ""}
                                          onChange={(e) => handleAttachmentChange(ind.id, e.target.value)}
                                          className="w-full text-[10px] border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-1.5"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                      <button
                        type="button"
                        onClick={() => saveEntryMutation.mutate()}
                        disabled={saveEntryMutation.isPending}
                        className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all flex items-center gap-2"
                      >
                        {saveEntryMutation.isPending ? "Menyimpan..." : "Simpan Mutabaah"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar with compliance card & history */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-2xl text-center space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Kepatuhan Hari Ini</h3>
                  <div className="relative inline-flex items-center justify-center">
                    {/* Ring score */}
                    <div className="text-4xl font-black text-rose-600 dark:text-rose-400">
                      {currentCompliancePercent}%
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Nilai kepatuhan mutabaah Anda pada tanggal {selectedDate}. Isi semua indikator untuk menaikkan skor Anda.
                  </p>
                </div>

                {/* History panel */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 p-6 rounded-2xl space-y-3">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Histori Terakhir Anda</h3>
                  {isLoadingHistory ? (
                    <Loading />
                  ) : userHistory.length === 0 ? (
                    <p className="text-[10px] text-slate-400 text-center py-4">Belum ada catatan mutabaah yang disimpan.</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {userHistory.slice(0, 10).map((h) => (
                        <div
                          key={h.id}
                          onClick={() => setSelectedDate(h.date)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                            selectedDate === h.date
                              ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50"
                              : "bg-slate-50/50 border-slate-100 dark:bg-zinc-950/10 dark:border-zinc-850 hover:bg-slate-100"
                          }`}
                        >
                          <span className="font-semibold text-slate-700 dark:text-zinc-300">{h.date}</span>
                          <span className="font-extrabold text-rose-600">{h.compliancePercentage}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MONITORING DAILY */}
          {activeTab === "daily" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Pemantauan Mutabaah Harian SDM</h2>
                  <p className="text-[10px] text-slate-400">Pantau status pengisian dan tingkat kepatuhan guru & musrif hari demi hari.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={monitoredRole}
                    onChange={(e) => setMonitoredRole(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none"
                  >
                    <option value="Semua">Semua Peran</option>
                    <option value="Guru">Guru</option>
                    <option value="Musrif">Musrif</option>
                    <option value="Staff">Staff</option>
                  </select>
                  <input
                    type="date"
                    value={monitoredDate}
                    max={todayStr}
                    onChange={(e) => setMonitoredDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>
              </div>

              {isLoadingMonitoring ? (
                <Loading />
              ) : filteredMonitoringList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">Belum ada SDM terdaftar untuk kriteria ini.</div>
              ) : (
                <div className="overflow-x-auto border border-slate-150 dark:border-zinc-850 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-150 dark:border-zinc-850">
                        <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nama Lengkap</th>
                        <th className="p-4 text-[10px] font-black uppercase text-slate-400">Peran</th>
                        <th className="p-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                        <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Tingkat Kepatuhan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                      {filteredMonitoringList.map((m) => (
                        <tr key={m.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                          <td className="p-4 font-black text-slate-800 dark:text-zinc-200">{m.name}</td>
                          <td className="p-4 font-semibold text-slate-400 capitalize">{m.roles.join(", ")}</td>
                          <td className="p-4">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                m.filled
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400"
                                  : "bg-amber-50 text-amber-600 dark:bg-amber-950/10 dark:text-amber-400"
                              }`}
                            >
                              {m.filled ? "Sudah Mengisi" : "Belum Mengisi"}
                            </span>
                          </td>
                          <td className="p-4 text-right font-black text-rose-600">
                            {m.compliance !== null ? `${m.compliance}%` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: WEEKLY REPORT */}
          {activeTab === "weekly" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Rekapitulasi Mutabaah Mingguan</h2>
                  <p className="text-[10px] text-slate-400">Analisis tingkat kepatuhan rata-rata per pekan untuk bulan berjalan.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>Bulan {new Date(2000, i).toLocaleString("id-ID", { month: "long" })}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                  </select>
                  <button
                    onClick={() => {
                      const csvHeaders = ["Nama", "Peran", "Pekan 1", "Pekan 2", "Pekan 3", "Pekan 4", "Rata-rata"];
                      const csvRows = weeklyReportData.map(r => [
                        r.name, r.role,
                        r.w1 !== null ? `${r.w1}%` : "-",
                        r.w2 !== null ? `${r.w2}%` : "-",
                        r.w3 !== null ? `${r.w3}%` : "-",
                        r.w4 !== null ? `${r.w4}%` : "-",
                        r.overall !== null ? `${r.overall}%` : "-"
                      ]);
                      handleExportCSV(`Rekap_Mutabaah_Mingguan_${selectedMonth}_${selectedYear}.csv`, csvHeaders, csvRows);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Ekspor
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 dark:border-zinc-850 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-150 dark:border-zinc-850">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nama SDM</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Peran</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">Pekan 1 (Tgl 1-7)</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">Pekan 2 (Tgl 8-14)</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">Pekan 3 (Tgl 15-21)</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">Pekan 4 (Tgl 22+)</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Rata-rata Bulan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                    {weeklyReportData.map(w => (
                      <tr key={w.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                        <td className="p-4 font-black text-slate-800 dark:text-zinc-200">{w.name}</td>
                        <td className="p-4 font-semibold text-slate-400 capitalize">{w.role}</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-zinc-300">{w.w1 !== null ? `${w.w1}%` : "-"}</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-zinc-300">{w.w2 !== null ? `${w.w2}%` : "-"}</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-zinc-300">{w.w3 !== null ? `${w.w3}%` : "-"}</td>
                        <td className="p-4 text-center font-bold text-slate-700 dark:text-zinc-300">{w.w4 !== null ? `${w.w4}%` : "-"}</td>
                        <td className="p-4 text-right font-black text-rose-600">{w.overall !== null ? `${w.overall}%` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: MONTHLY REPORT */}
          {activeTab === "monthly" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Rekapitulasi Mutabaah Bulanan</h2>
                  <p className="text-[10px] text-slate-400">Pantau kepatuhan bulanan asatidzah sepanjang tahun ajaran.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                  </select>
                  <button
                    onClick={() => {
                      const csvHeaders = ["Nama", "Peran", ...Array.from({ length: 12 }, (_, i) => `Bulan ${i + 1}`), "Rata-rata"];
                      const csvRows = monthlyReportData.map(r => [
                        r.name, r.role,
                        ...r.months.map(m => m !== null ? `${m}%` : "-"),
                        r.overall !== null ? `${r.overall}%` : "-"
                      ]);
                      handleExportCSV(`Rekap_Mutabaah_Bulanan_${selectedYear}.csv`, csvHeaders, csvRows);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Ekspor
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 dark:border-zinc-850 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-150 dark:border-zinc-850">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nama SDM</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Peran</th>
                      {Array.from({ length: 12 }, (_, i) => (
                        <th key={i} className="p-2 text-[10px] font-black uppercase text-slate-400 text-center">
                          {new Date(2000, i).toLocaleString("id-ID", { month: "short" })}
                        </th>
                      ))}
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                    {monthlyReportData.map(m => (
                      <tr key={m.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                        <td className="p-4 font-black text-slate-800 dark:text-zinc-200">{m.name}</td>
                        <td className="p-4 font-semibold text-slate-400 capitalize">{m.role}</td>
                        {m.months.map((val, idx) => (
                          <td key={idx} className="p-2 text-center font-bold text-slate-600 dark:text-zinc-400">
                            {val !== null ? `${val}%` : "-"}
                          </td>
                        ))}
                        <td className="p-4 text-right font-black text-rose-600">{m.overall !== null ? `${m.overall}%` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: SEMESTER REPORT */}
          {activeTab === "semester" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Rekapitulasi Mutabaah Semester</h2>
                  <p className="text-[10px] text-slate-400">Rincian kepatuhan spiritual untuk Semester 1 (Ganjil) atau Semester 2 (Genap).</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    <option value={1}>Semester 1 (Ganjil - Jul-Des)</option>
                    <option value={2}>Semester 2 (Genap - Jan-Jun)</option>
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                  </select>
                  <button
                    onClick={() => {
                      const csvHeaders = ["Nama", "Peran", "Bulan 1", "Bulan 2", "Bulan 3", "Bulan 4", "Bulan 5", "Bulan 6", "Rata-rata"];
                      const csvRows = semesterReportData.map(r => [
                        r.name, r.role,
                        ...r.months.map(m => m !== null ? `${m}%` : "-"),
                        r.overall !== null ? `${r.overall}%` : "-"
                      ]);
                      handleExportCSV(`Rekap_Mutabaah_Semester_${selectedSemester}_${selectedYear}.csv`, csvHeaders, csvRows);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Ekspor
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 dark:border-zinc-850 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-150 dark:border-zinc-850">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nama SDM</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Peran</th>
                      {(selectedSemester === 1 ? ["Juli", "Agustus", "September", "Oktober", "November", "Desember"] : ["Januari", "Februari", "Maret", "April", "Mei", "Juni"]).map((m, idx) => (
                        <th key={idx} className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">{m}</th>
                      ))}
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Rata-rata Semester</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                    {semesterReportData.map(s => (
                      <tr key={s.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                        <td className="p-4 font-black text-slate-800 dark:text-zinc-200">{s.name}</td>
                        <td className="p-4 font-semibold text-slate-400 capitalize">{s.role}</td>
                        {s.months.map((val, idx) => (
                          <td key={idx} className="p-4 text-center font-bold text-slate-700 dark:text-zinc-300">
                            {val !== null ? `${val}%` : "-"}
                          </td>
                        ))}
                        <td className="p-4 text-right font-black text-rose-600">{s.overall !== null ? `${s.overall}%` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: YEARLY REPORT */}
          {activeTab === "yearly" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Rekapitulasi Mutabaah Tahunan</h2>
                  <p className="text-[10px] text-slate-400">Skor tahunan penuh untuk penilaian kinerja spiritual dan pembinaan ruhiyah.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    <option value={currentYear}>{currentYear}</option>
                    <option value={currentYear - 1}>{currentYear - 1}</option>
                  </select>
                  <button
                    onClick={() => {
                      const csvHeaders = ["Nama", "Peran", "Rata-rata Tahunan"];
                      const csvRows = monthlyReportData.map(r => [
                        r.name, r.role,
                        r.overall !== null ? `${r.overall}%` : "-"
                      ]);
                      handleExportCSV(`Rekap_Mutabaah_Tahunan_${selectedYear}.csv`, csvHeaders, csvRows);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Ekspor
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-150 dark:border-zinc-850 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-150 dark:border-zinc-850">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nama SDM</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Peran</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Rata-rata Skor Tahunan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                    {monthlyReportData.map(m => (
                      <tr key={m.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                        <td className="p-4 font-black text-slate-800 dark:text-zinc-200">{m.name}</td>
                        <td className="p-4 font-semibold text-slate-400 capitalize">{m.role}</td>
                        <td className="p-4 text-right font-black text-rose-600 text-sm">
                          {m.overall !== null ? `${m.overall}%` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: PENGATURAN INDIKATOR */}
          {activeTab === "pengaturan" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Konfigurasi Indikator Mutabaah</h2>
                  <p className="text-[10px] text-slate-400">Kelola daftar indikator pencapaian ruhiyah, bobot nilai, serta target harian asatidzah.</p>
                </div>
                {canManageIndicators && (
                  <button
                    type="button"
                    onClick={() => handleOpenIndicatorModal(null)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah Indikator
                  </button>
                )}
              </div>

              <div className="overflow-x-auto border border-slate-150 dark:border-zinc-850 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-150 dark:border-zinc-850">
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Nama Indikator</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Kategori</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400">Jenis Input</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">Bobot</th>
                      <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-center">Status</th>
                      {canManageIndicators && <th className="p-4 text-[10px] font-black uppercase text-slate-400 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                    {indicators
                      .filter((ind) => !ind.isArchived)
                      .map((ind) => (
                        <tr key={ind.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                          <td className="p-4">
                            <span className="font-black text-slate-800 dark:text-zinc-200 block">{ind.name}</span>
                            <span className="text-[9px] text-slate-400 block mt-0.5 uppercase">ID: {ind.id}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                              {ind.category}
                            </span>
                          </td>
                          <td className="p-4 capitalize font-semibold text-slate-500">
                            {ind.inputType === "prayers_5" ? "Shalat 5 Waktu" : ind.inputType}
                          </td>
                          <td className="p-4 text-center font-bold text-slate-700 dark:text-zinc-300">{ind.weight}%</td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => canManageIndicators && toggleActiveMutation.mutate({ id: ind.id, name: ind.name, currentStatus: ind.isActive })}
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                                ind.isActive
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400"
                                  : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                              }`}
                            >
                              {ind.isActive ? "Aktif" : "Non-Aktif"}
                            </button>
                          </td>
                          {canManageIndicators && (
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenIndicatorModal(ind)}
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-700 rounded-lg cursor-pointer transition-all"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Yakin ingin mengarsipkan indikator "${ind.name}"?`)) {
                                      archiveIndicatorMutation.mutate({ id: ind.id, name: ind.name });
                                    }
                                  }}
                                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer transition-all"
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Template generator */}
              <div className="bg-slate-50 dark:bg-zinc-950/30 border border-slate-100 dark:border-zinc-850 p-5 rounded-3xl space-y-4">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Simpan Template Indikator Peran</h3>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={templateRole}
                    onChange={(e) => setTemplateRole(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200"
                  >
                    <option value="guru">Guru</option>
                    <option value="musrif">Musrif</option>
                    <option value="staff">Staff</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow"
                  >
                    Simpan Sebagai Template Aktif
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: LOGS */}
          {activeTab === "logs" && (
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-zinc-800 pb-2">
                Histori Perubahan Konfigurasi Indikator
              </h3>
              {changeLogs.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">Belum ada catatan log aktivitas.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {changeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-4 bg-slate-50/50 dark:bg-zinc-950/20 border border-slate-100 dark:border-zinc-850 rounded-xl flex items-start gap-3"
                    >
                      <History className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-700 dark:text-zinc-200">{log.operatorName}</span>
                          <span className="text-[10px] text-slate-400">{log.timestamp}</span>
                        </div>
                        <p className="text-rose-600 font-bold mt-1 uppercase text-[9px]">{log.action}</p>
                        <p className="text-slate-500 mt-0.5">{log.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: ADD/EDIT INDICATOR */}
      {isIndicatorModalOpen && (
        <Dialog
          title={selectedIndicator ? "Edit Indikator Mutabaah" : "Tambah Indikator Mutabaah"}
          isOpen={isIndicatorModalOpen}
          onClose={() => setIsIndicatorModalOpen(false)}
        >
          <div className="space-y-4 pt-2">
            <FormInput
              label="Nama Indikator"
              type="text"
              value={indicatorForm.name}
              onChange={(e: any) => {
                const val = e && e.target ? e.target.value : e;
                setIndicatorForm((p) => ({ ...p, name: val }));
              }}
              placeholder="Contoh: Shalat Berjamaah tepat waktu"
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Kategori</label>
                <select
                  value={indicatorForm.category}
                  onChange={(e) => setIndicatorForm((p) => ({ ...p, category: e.target.value }))}
                  className="w-full text-xs border border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="Ibadah Wajib">Ibadah Wajib</option>
                  <option value="Ibadah Sunnah">Ibadah Sunnah</option>
                  <option value="Ruhiyah">Ruhiyah</option>
                  <option value="Akhlak">Akhlak</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Jenis Input</label>
                <select
                  value={indicatorForm.inputType}
                  onChange={(e) => setIndicatorForm((p) => ({ ...p, inputType: e.target.value as any }))}
                  className="w-full text-xs border border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="boolean">Pilihan Ya/Tidak (Boolean)</option>
                  <option value="prayers_5">Shalat 5 Waktu (Subuh, Dzuhur, Ashar, Maghrib, Isya)</option>
                  <option value="number">Input Angka (Number)</option>
                  <option value="percentage">Input Persentase (Slider)</option>
                  <option value="choice">Pilihan Skala Sikap (Sangat Baik/Baik/Cukup)</option>
                  <option value="text">Input Laporan Teks (Teks)</option>
                  <option value="photo">Lampiran Foto Pendukung</option>
                  <option value="document">Lampiran Bukti Dokumen</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Target Nilai"
                type="number"
                value={indicatorForm.target}
                onChange={(e: any) => {
                  const val = e && e.target ? e.target.value : e;
                  setIndicatorForm((p) => ({ ...p, target: val === "" ? "" : (parseFloat(val) || 0) as any }));
                }}
                placeholder="1"
              />
              <FormInput
                label="Satuan Unit"
                type="text"
                value={indicatorForm.unit}
                onChange={(e: any) => {
                  const val = e && e.target ? e.target.value : e;
                  setIndicatorForm((p) => ({ ...p, unit: val }));
                }}
                placeholder="kali"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormInput
                label="Bobot Nilai (%)"
                type="number"
                value={indicatorForm.weight}
                onChange={(e: any) => {
                  const val = e && e.target ? e.target.value : e;
                  setIndicatorForm((p) => ({ ...p, weight: val === "" ? "" : (parseFloat(val) || 0) as any }));
                }}
                placeholder="10"
              />
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500">Frekuensi Pengisian</label>
                <select
                  value={indicatorForm.frequency}
                  onChange={(e) => setIndicatorForm((p) => ({ ...p, frequency: e.target.value as any }))}
                  className="w-full text-xs border border-slate-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-rose-500"
                >
                  <option value="harian">Setiap Hari Aktif (Harian)</option>
                  <option value="waktu">Berdasarkan Jam/Waktu Tertentu</option>
                  <option value="mingguan">Satu Kali Seminggu (Mingguan)</option>
                  <option value="bulanan">Satu Kali Sebulan (Bulanan)</option>
                </select>
              </div>
            </div>

            {/* Time windows for specific frequencies */}
            {indicatorForm.frequency === "waktu" && (
              <div className="grid grid-cols-2 gap-4">
                <FormInput
                  label="Jam Mulai"
                  type="text"
                  value={indicatorForm.startTime || ""}
                  onChange={(e: any) => {
                    const val = e && e.target ? e.target.value : e;
                    setIndicatorForm((p) => ({ ...p, startTime: val }));
                  }}
                  placeholder="04:30"
                />
                <FormInput
                  label="Jam Selesai"
                  type="text"
                  value={indicatorForm.endTime || ""}
                  onChange={(e: any) => {
                    const val = e && e.target ? e.target.value : e;
                    setIndicatorForm((p) => ({ ...p, endTime: val }));
                  }}
                  placeholder="06:00"
                />
              </div>
            )}

            {/* Applicable Days selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block">Hari Aktif Pelaksanaan</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"].map((day) => {
                  const days = indicatorForm.applicableDays || [];
                  const isChecked = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const nextDays = isChecked ? days.filter((d) => d !== day) : [...days, day];
                        setIndicatorForm((p) => ({ ...p, applicableDays: nextDays }));
                      }}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/20 dark:border-rose-900/40"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Applicable Roles selection */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 block">Peran SDM Terkait (Wajib Mengisi)</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: "guru", label: "Guru / Asatidzah" },
                  { id: "musrif", label: "Musrif / Pengasuh" },
                  { id: "staff", label: "Staff / Tata Usaha" },
                  { id: "wakil kepala sekolah", label: "Wakil Kepala Sekolah" },
                  { id: "kepala sekolah", label: "Kepala Sekolah" },
                  { id: "pimpinan", label: "Pimpinan / Yayasan" }
                ].map((roleObj) => {
                  const roles = indicatorForm.applicableRoles || [];
                  const isChecked = roles.includes(roleObj.id);
                  return (
                    <button
                      key={roleObj.id}
                      type="button"
                      onClick={() => {
                        const nextRoles = isChecked ? roles.filter((r) => r !== roleObj.id) : [...roles, roleObj.id];
                        setIndicatorForm((p) => ({ ...p, applicableRoles: nextRoles }));
                      }}
                      className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/20 dark:border-blue-900/40"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                      }`}
                    >
                      {roleObj.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Exemption parameters */}
            <div className="border border-slate-100 dark:border-zinc-800/60 p-3 rounded-xl space-y-2">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-1">Parameter Pengecualian</span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={indicatorForm.appliesToMale}
                    onChange={(e) => setIndicatorForm((p) => ({ ...p, appliesToMale: e.target.checked }))}
                    className="accent-rose-500 h-4 w-4"
                  />
                  Berlaku Laki-laki
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={indicatorForm.appliesToFemale}
                    onChange={(e) => setIndicatorForm((p) => ({ ...p, appliesToFemale: e.target.checked }))}
                    className="accent-rose-500 h-4 w-4"
                  />
                  Berlaku Perempuan
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={indicatorForm.excludeDuringHaid}
                    onChange={(e) => setIndicatorForm((p) => ({ ...p, excludeDuringHaid: e.target.checked }))}
                    className="accent-rose-500 h-4 w-4"
                  />
                  Bebas Saat Haid (Perempuan)
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsIndicatorModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-lg cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => saveIndicatorMutation.mutate()}
                disabled={saveIndicatorMutation.isPending}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow transition-all"
              >
                {saveIndicatorMutation.isPending ? "Menyimpan..." : "Simpan Indikator"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
