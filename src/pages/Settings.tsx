import React, { useState, useEffect } from "react";
import { useSchoolSettings } from "../hooks/schoolSettings.hook";
import { useAuth } from "../contexts/AuthContext";
import { 
  Settings as SettingsIcon, 
  Clock, 
  Calendar, 
  Check, 
  Plus, 
  Trash2, 
  Save, 
  ShieldAlert, 
  Info,
  Sliders,
  Volume2,
  Coffee,
  Sparkles,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Edit2,
  X,
  UserCheck
} from "lucide-react";
import { generateDailySchedule, TimelineBlock, minutesToTime, timeToMinutes } from "../utils/scheduleCalculator";
import { SchoolSettings, BreakTime, RoutineActivity } from "../types";

const DAYS_OF_WEEK = ["Sabtu", "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

// Validate overlapping for break times
function checkBreakOverlap(breaks: BreakTime[]): string | null {
  for (let i = 0; i < breaks.length; i++) {
    for (let j = i + 1; j < breaks.length; j++) {
      const bA = breaks[i];
      const bB = breaks[j];
      const startA = timeToMinutes(bA.start);
      const endA = timeToMinutes(bA.end);
      const startB = timeToMinutes(bB.start);
      const endB = timeToMinutes(bB.end);
      
      if (startA < endB && startB < endA) {
        return `Tabrakan Istirahat: '${bA.name}' (${bA.start}-${bA.end}) dan '${bB.name}' (${bB.start}-${bB.end}) aktif pada jam yang tumpang tindih.`;
      }
    }
  }
  return null;
}

// Validate overlapping for routine activities on any active day
function checkRoutineOverlap(activities: RoutineActivity[], activeDays: string[]): string | null {
  const activeActivities = activities.filter(a => a.enabled);
  
  for (const day of activeDays) {
    const dailyActs = activeActivities.filter(a => {
      return a.days.some(d => 
        d.toLowerCase() === day.toLowerCase() || 
        d === "Semua Hari Aktif" || 
        d === "Semua"
      );
    });
    
    let finalActs = [...dailyActs];

    for (let i = 0; i < finalActs.length; i++) {
      for (let j = i + 1; j < finalActs.length; j++) {
        const actA = finalActs[i];
        const actB = finalActs[j];
        
        const startA = timeToMinutes(actA.startTime);
        const durationA = actA.duration || 10;
        const endA = startA + durationA;
        
        const startB = timeToMinutes(actB.startTime);
        const durationB = actB.duration || 10;
        const endB = startB + durationB;
        
        if (startA < endB && startB < endA) {
          return `Tabrakan Kegiatan Rutin (${day}): '${actA.name}' (${actA.startTime}-${minutesToTime(endA)}) dan '${actB.name}' (${actB.startTime}-${minutesToTime(endB)}) bertabrakan pada jam yang sama.`;
        }
      }
    }
  }
  return null;
}

export default function Settings() {
  const { user } = useAuth();
  const { settings: fetchedSettings, isLoading, updateSettings, isUpdating, refetch } = useSchoolSettings();

  // Menu Tabs for the 7 sections
  const [activeTab, setActiveTab] = useState<
    "hari-aktif" | "jam-sekolah" | "kegiatan-rutin" | "waktu-istirahat" | "struktur-jp" | "hari-libur" | "simpan"
  >("hari-aktif");

  // Selected day for the timeline preview
  const [selectedPreviewDay, setSelectedPreviewDay] = useState("Senin");

  // Local state for school settings
  const [localSettings, setLocalSettings] = useState<SchoolSettings | null>(null);

  // New break form state
  const [newBreakName, setNewBreakName] = useState("");
  const [newBreakStart, setNewBreakStart] = useState("09:20");
  const [newBreakEnd, setNewBreakEnd] = useState("09:40");
  const [newBreakDesc, setNewBreakDesc] = useState("");

  // Editing break state
  const [editingBreakId, setEditingBreakId] = useState<string | null>(null);
  const [editBreakName, setEditBreakName] = useState("");
  const [editBreakStart, setEditBreakStart] = useState("");
  const [editBreakEnd, setEditBreakEnd] = useState("");
  const [editBreakDesc, setEditBreakDesc] = useState("");

  // New routine activity form state
  const [newRoutineName, setNewRoutineName] = useState("");
  const [newRoutineEnabled, setNewRoutineEnabled] = useState(true);
  const [newRoutineDays, setNewRoutineDays] = useState<string[]>(["Senin"]);
  const [newRoutineStart, setNewRoutineStart] = useState("07:00");
  const [newRoutineDuration, setNewRoutineDuration] = useState<number>(15);
  const [newRoutineDesc, setNewRoutineDesc] = useState("");

  // Editing routine activity state
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [editRoutineName, setEditRoutineName] = useState("");
  const [editRoutineEnabled, setEditRoutineEnabled] = useState(true);
  const [editRoutineDays, setEditRoutineDays] = useState<string[]>([]);
  const [editRoutineStart, setEditRoutineStart] = useState("");
  const [editRoutineDuration, setEditRoutineDuration] = useState<number>(15);
  const [editRoutineDesc, setEditRoutineDesc] = useState("");

  // Custom loading state to handle timeout (max 3s)
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const [manualLoading, setManualLoading] = useState(true);

  // Sync fetched settings to local state
  useEffect(() => {
    if (fetchedSettings) {
      const cloned = JSON.parse(JSON.stringify(fetchedSettings));
      
      // Ensure local settings have schoolHours and lessonPeriod initialized
      if (!cloned.schoolHours) {
        cloned.schoolHours = {
          startTime: cloned.startTime || "07:00",
          endTime: cloned.endTime || "14:00"
        };
      }
      if (cloned.lessonPeriod === undefined) {
        cloned.lessonPeriod = cloned.jpDuration || 40;
      }

      // Ensure routineActivities has defaults
      if (!cloned.routineActivities) {
        cloned.routineActivities = [];
      }

      setLocalSettings(cloned);

      // Select first active day for preview
      if (cloned.activeDays && cloned.activeDays.length > 0) {
        setSelectedPreviewDay(cloned.activeDays[0]);
      }
    }
  }, [fetchedSettings]);

  // Handle max 3 seconds timeout for database loading
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (isLoading) {
      setManualLoading(true);
      setLoadingTimedOut(false);
      
      timer = setTimeout(() => {
        setLoadingTimedOut(true);
        setManualLoading(false);
      }, 3000);
    } else {
      setManualLoading(false);
      setLoadingTimedOut(false);
    }
    
    return () => {
      clearTimeout(timer);
    };
  }, [isLoading]);

  const hasWriteAccess = user?.role === "admin" || user?.role === "operator" || user?.role === "tata usaha";

  if (manualLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-zinc-950 text-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Memuat konfigurasi sekolah...</p>
      </div>
    );
  }

  if (loadingTimedOut || !localSettings) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-zinc-950 text-center space-y-4 min-h-[400px]">
        <ShieldAlert className="h-12 w-12 text-rose-500" />
        <div>
          <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">Gagal Memuat Pengaturan Sekolah (Waktu Habis)</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">Gagal mengambil data dari database cloud Firestore dalam batas waktu 3 detik.</p>
        </div>
        <button
          onClick={() => {
            setLoadingTimedOut(false);
            setManualLoading(true);
            refetch();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Coba Lagi (Retry)
        </button>
      </div>
    );
  }

  // Handle toggle day checkbox
  const handleToggleActiveDay = (day: string) => {
    if (!hasWriteAccess) return;
    const currentDays = [...localSettings.activeDays];
    const index = currentDays.indexOf(day);
    if (index > -1) {
      if (currentDays.length === 1) return; // Prevent empty active days
      currentDays.splice(index, 1);
    } else {
      currentDays.push(day);
    }

    // Maintain Chronological view order based on DISPLAY requirement
    const orderedDays = DAYS_OF_WEEK.filter(d => currentDays.includes(d));

    setLocalSettings({
      ...localSettings,
      activeDays: orderedDays
    });
  };

  // Handle active days change (all selected or none)
  const handleToggleAllActiveDays = (isChecked: boolean) => {
    if (!hasWriteAccess) return;
    setLocalSettings({
      ...localSettings,
      activeDays: isChecked ? [...DAYS_OF_WEEK] : ["Senin"]
    });
  };

  // Add routine activity
  const handleAddRoutine = () => {
    if (!hasWriteAccess) return;
    if (!newRoutineName.trim()) {
      alert("Nama kegiatan rutin harus diisi!");
      return;
    }
    if (newRoutineDays.length === 0) {
      alert("Pilih minimal satu hari operasi!");
      return;
    }

    const startMins = timeToMinutes(newRoutineStart);
    const autoEndStr = minutesToTime(startMins + newRoutineDuration);

    const newItem: RoutineActivity = {
      id: `routine-${Date.now()}`,
      name: newRoutineName.trim(),
      enabled: newRoutineEnabled,
      days: [...newRoutineDays],
      startTime: newRoutineStart,
      duration: newRoutineDuration,
      autoEndTime: autoEndStr,
      priority: 3,
      description: newRoutineDesc.trim() || undefined
    };

    const updatedRoutines = [...(localSettings.routineActivities || []), newItem];

    // Real-time overlap check for this addition
    const testOverlap = checkRoutineOverlap(updatedRoutines, localSettings.activeDays);
    if (testOverlap) {
      alert(testOverlap);
      return;
    }

    setLocalSettings({
      ...localSettings,
      routineActivities: updatedRoutines
    });

    // Reset Form
    setNewRoutineName("");
    setNewRoutineDesc("");
  };

  // Delete routine activity
  const handleDeleteRoutine = (id: string) => {
    if (!hasWriteAccess) return;

    setLocalSettings({
      ...localSettings,
      routineActivities: (localSettings.routineActivities || []).filter(r => r.id !== id)
    });
  };

  // Edit routine start
  const handleStartEditRoutine = (item: RoutineActivity) => {
    if (!hasWriteAccess) return;
    setEditingRoutineId(item.id);
    setEditRoutineName(item.name);
    setEditRoutineEnabled(item.enabled);
    setEditRoutineDays(item.days);
    setEditRoutineStart(item.startTime);
    setEditRoutineDuration(item.duration);
    setEditRoutineDesc(item.description || "");
  };

  // Save edited routine activity
  const handleSaveEditRoutine = () => {
    if (!hasWriteAccess || !editingRoutineId) return;
    if (!editRoutineName.trim()) {
      alert("Nama kegiatan rutin harus diisi!");
      return;
    }
    if (editRoutineDays.length === 0) {
      alert("Pilih minimal satu hari operasi!");
      return;
    }

    const startMins = timeToMinutes(editRoutineStart);
    const autoEndStr = minutesToTime(startMins + editRoutineDuration);

    const updatedRoutines = (localSettings.routineActivities || []).map(r => {
      if (r.id === editingRoutineId) {
        return {
          ...r,
          name: editRoutineName.trim(),
          enabled: editRoutineEnabled,
          days: [...editRoutineDays],
          startTime: editRoutineStart,
          duration: editRoutineDuration,
          autoEndTime: autoEndStr,
          description: editRoutineDesc.trim() || undefined
        };
      }
      return r;
    });

    // Check overlaps
    const testOverlap = checkRoutineOverlap(updatedRoutines, localSettings.activeDays);
    if (testOverlap) {
      alert(testOverlap);
      return;
    }

    setLocalSettings({
      ...localSettings,
      routineActivities: updatedRoutines
    });

    setEditingRoutineId(null);
  };

  // Add break time
  const handleAddBreak = () => {
    if (!hasWriteAccess) return;
    if (!newBreakName.trim()) {
      alert("Nama istirahat harus diisi!");
      return;
    }
    const startVal = timeToMinutes(newBreakStart);
    const endVal = timeToMinutes(newBreakEnd);
    if (startVal >= endVal) {
      alert("Jam Selesai harus setelah Jam Mulai!");
      return;
    }

    const calculatedDuration = endVal - startVal;

    const newBreak: BreakTime = {
      id: `break-${Date.now()}`,
      name: newBreakName.trim(),
      start: newBreakStart,
      end: newBreakEnd,
      duration: calculatedDuration
    };

    const updatedBreaks = [...(localSettings.breakTimes || []), newBreak];

    // Check overlap
    const testOverlap = checkBreakOverlap(updatedBreaks);
    if (testOverlap) {
      alert(testOverlap);
      return;
    }

    setLocalSettings({
      ...localSettings,
      breakTimes: updatedBreaks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    });

    // Reset Form
    setNewBreakName("");
    setNewBreakDesc("");
  };

  // Delete break time
  const handleDeleteBreak = (id: string) => {
    if (!hasWriteAccess) return;
    setLocalSettings({
      ...localSettings,
      breakTimes: (localSettings.breakTimes || []).filter(b => b.id !== id)
    });
  };

  // Edit break start
  const handleStartEditBreak = (item: BreakTime) => {
    if (!hasWriteAccess) return;
    setEditingBreakId(item.id);
    setEditBreakName(item.name);
    setEditBreakStart(item.start);
    setEditBreakEnd(item.end);
  };

  // Save edited break time
  const handleSaveEditBreak = () => {
    if (!hasWriteAccess || !editingBreakId) return;
    if (!editBreakName.trim()) {
      alert("Nama istirahat harus diisi!");
      return;
    }
    const startVal = timeToMinutes(editBreakStart);
    const endVal = timeToMinutes(editBreakEnd);
    if (startVal >= endVal) {
      alert("Jam Selesai harus setelah Jam Mulai!");
      return;
    }

    const calculatedDuration = endVal - startVal;

    const updatedBreaks = (localSettings.breakTimes || []).map(b => {
      if (b.id === editingBreakId) {
        return {
          ...b,
          name: editBreakName.trim(),
          start: editBreakStart,
          end: editBreakEnd,
          duration: calculatedDuration
        };
      }
      return b;
    });

    // Check overlap
    const testOverlap = checkBreakOverlap(updatedBreaks);
    if (testOverlap) {
      alert(testOverlap);
      return;
    }

    setLocalSettings({
      ...localSettings,
      breakTimes: updatedBreaks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start))
    });

    setEditingBreakId(null);
  };

  // Toggle routine active check on table row directly
  const handleToggleRoutineActive = (index: number, isChecked: boolean) => {
    if (!hasWriteAccess || !localSettings.routineActivities) return;
    const updated = [...localSettings.routineActivities];
    updated[index] = {
      ...updated[index],
      enabled: isChecked
    };

    setLocalSettings({
      ...localSettings,
      routineActivities: updated
    });
  };

  // Check routine activity list overlaps
  const routineOverlapError = checkRoutineOverlap(localSettings.routineActivities || [], localSettings.activeDays);
  
  // Check break time list overlaps
  const breakOverlapError = checkBreakOverlap(localSettings.breakTimes || []);

  // Final Overall Save Settings
  const handleSaveAllSettings = async () => {
    if (!hasWriteAccess) return;
    
    // Overall validations
    const startMins = timeToMinutes(localSettings.schoolHours?.startTime || "07:00");
    const endMins = timeToMinutes(localSettings.schoolHours?.endTime || "14:00");
    if (startMins >= endMins) {
      alert("Jam Masuk sekolah harus lebih awal dari Jam Pulang!");
      return;
    }

    if (routineOverlapError) {
      alert(routineOverlapError);
      return;
    }

    if (breakOverlapError) {
      alert(breakOverlapError);
      return;
    }

    try {
      // Sync backward compatibility variables
      const payload: SchoolSettings = {
        ...localSettings,
        startTime: localSettings.schoolHours?.startTime || localSettings.startTime || "07:00",
        endTime: localSettings.schoolHours?.endTime || localSettings.endTime || "14:00",
        jpDuration: localSettings.lessonPeriod || localSettings.jpDuration || 40,
        updatedBy: user?.uid || "system"
      };

      await updateSettings(payload, "Menyempurnakan konfigurasi School Settings lengkap.");
    } catch (e) {
      console.error(e);
    }
  };

  // Recalculate daily preview timeline based on the selected preview day
  const previewTimeline = generateDailySchedule(localSettings, selectedPreviewDay);

  // Helper styles for Timeline items
  const getTimelineItemStyle = (type: string) => {
    switch (type) {
      case "assembly":
        return "border-l-4 border-amber-500 bg-amber-50/50 dark:bg-amber-950/10 text-amber-900 dark:text-amber-300";
      case "special":
        return "border-l-4 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/10 text-indigo-900 dark:text-indigo-300";
      case "jp":
        return "border-l-4 border-blue-500 bg-blue-50/50 dark:bg-blue-950/10 text-blue-900 dark:text-blue-300";
      case "break":
        return "border-l-4 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-300";
      case "gap":
        return "border-l-4 border-slate-300 bg-slate-100/50 dark:bg-zinc-900/50 text-slate-500 dark:text-zinc-400 border-dashed";
      default:
        return "border-l-4 border-slate-400 bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400";
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case "assembly":
        return <Volume2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "special":
        return <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />;
      case "jp":
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "break":
        return <Coffee className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <Info className="h-4 w-4 text-slate-400" />;
    }
  };

  // List of tabs corresponding exactly to Patch 9.4 spec (and Simpan)
  const menuItems = [
    { id: "hari-aktif", label: "1. Hari Aktif", icon: Calendar },
    { id: "jam-sekolah", label: "2. Jam Sekolah", icon: Clock },
    { id: "struktur-jp", label: "3. Struktur JP", icon: Sliders },
    { id: "kegiatan-rutin", label: "4. Kegiatan Rutin", icon: Volume2 },
    { id: "waktu-istirahat", label: "5. Waktu Istirahat", icon: Coffee },
    { id: "hari-libur", label: "6. Hari Libur Khusus", icon: ShieldAlert },
    { id: "simpan", label: "7. Simpan Pengaturan", icon: Save },
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6 lg:p-8 dark:bg-zinc-950 text-slate-900 dark:text-zinc-50 font-sans">
      
      {/* Visual Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <SettingsIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
            Pengaturan Sekolah (School Settings)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi pusat hari aktif, jam sekolah, struktur JP, kegiatan rutin harian, dan waktu istirahat SMP ALKARIM RASYID.
          </p>
        </div>

        {hasWriteAccess && (
          <button
            onClick={handleSaveAllSettings}
            disabled={isUpdating || !!routineOverlapError || !!breakOverlapError}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {isUpdating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Simpan Semua Pengaturan
          </button>
        )}
      </div>

      {/* Role Alert Badge */}
      {!hasWriteAccess && (
        <div className="mb-6 p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex gap-3 text-xs text-amber-800 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">Mode Lihat Saja (Read-Only)</p>
            <p className="mt-0.5">Anda tidak memiliki hak akses sebagai Administrator atau Operator. Anda dapat meninjau jadwal tetapi tidak dapat menyimpan perubahan.</p>
          </div>
        </div>
      )}

      {/* Overlap Warning Banners */}
      {routineOverlapError && (
        <div className="mb-6 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex gap-3 text-xs text-rose-800 dark:text-rose-300 animate-pulse">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="font-bold">Peringatan Bentrok Kegiatan Rutin!</p>
            <p className="mt-0.5">{routineOverlapError}</p>
          </div>
        </div>
      )}

      {breakOverlapError && (
        <div className="mb-6 p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl flex gap-3 text-xs text-rose-800 dark:text-rose-300 animate-pulse">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <div>
            <p className="font-bold">Peringatan Bentrok Istirahat!</p>
            <p className="mt-0.5">{breakOverlapError}</p>
          </div>
        </div>
      )}

      {/* THREE-COLUMN BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMN 1: SIDEBAR SUBMENU (3 COLS) */}
        <div className="lg:col-span-3 space-y-2">
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs">
            <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3 px-2">Menu Pengaturan</h3>
            <div className="flex flex-col gap-1">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-950/50"
                        : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`h-4 w-4 ${isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 opacity-60 transition-transform ${isActive ? "translate-x-0.5" : ""}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMN 2: ACTIVE TAB CONTENT (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs min-h-[460px] flex flex-col justify-between">
            
            {/* Form Fields Section */}
            <div>
              {/* 1. HARI AKTIF */}
              {activeTab === "hari-aktif" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Calendar className="h-4.5 w-4.5 text-indigo-600" />
                      1. Hari Aktif Sekolah
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tentukan hari kerja aktif di mana proses belajar-mengajar dapat dijadwalkan.</p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atur Hari Kerja</span>
                      <button
                        type="button"
                        onClick={() => handleToggleAllActiveDays(localSettings.activeDays.length !== DAYS_OF_WEEK.length)}
                        disabled={!hasWriteAccess}
                        className="text-[10px] text-indigo-600 hover:underline font-bold disabled:opacity-50"
                      >
                        {localSettings.activeDays.length === DAYS_OF_WEEK.length ? "Hapus Semua" : "Pilih Semua Hari"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {DAYS_OF_WEEK.map((day) => {
                        const isActive = localSettings.activeDays.includes(day);
                        return (
                          <label 
                            key={day}
                            className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                              isActive 
                                ? "bg-indigo-50/20 border-indigo-200 dark:bg-indigo-950/5 dark:border-indigo-900/40" 
                                : "bg-slate-50/50 border-slate-200/60 dark:bg-zinc-950/50 dark:border-zinc-850"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => handleToggleActiveDay(day)}
                                disabled={!hasWriteAccess}
                                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-zinc-800 rounded cursor-pointer"
                              />
                              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">{day}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                              {isActive ? (
                                <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">AKTIF</span>
                              ) : (
                                <span className="text-slate-400 bg-slate-100 dark:bg-zinc-850 px-2 py-0.5 rounded-md">LIBUR</span>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. JAM SEKOLAH */}
              {activeTab === "jam-sekolah" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Clock className="h-4.5 w-4.5 text-indigo-600" />
                      2. Jam Sekolah Harian
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Konfigurasi jam masuk harian, jam pulang sekolah, dan durasi setiap Jam Pelajaran (JP).</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Jam Masuk Sekolah (Bel Pembuka)</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="time"
                          value={localSettings.schoolHours?.startTime || "07:00"}
                          onChange={(e) => {
                            if (!hasWriteAccess) return;
                            setLocalSettings({
                              ...localSettings,
                              schoolHours: {
                                startTime: e.target.value,
                                endTime: localSettings.schoolHours?.endTime || "14:00"
                              }
                            });
                          }}
                          className="w-full pl-10 pr-3 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25"
                          disabled={!hasWriteAccess}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Jam Pulang Sekolah (Bel Penutup)</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="time"
                          value={localSettings.schoolHours?.endTime || "14:00"}
                          onChange={(e) => {
                            if (!hasWriteAccess) return;
                            setLocalSettings({
                              ...localSettings,
                              schoolHours: {
                                startTime: localSettings.schoolHours?.startTime || "07:00",
                                endTime: e.target.value
                              }
                            });
                          }}
                          className="w-full pl-10 pr-3 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25"
                          disabled={!hasWriteAccess}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Durasi 1 Jam Pelajaran (JP) dalam Menit</label>
                      <div className="relative">
                        <Sliders className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="number"
                          value={localSettings.lessonPeriod || 40}
                          onChange={(e) => {
                            if (!hasWriteAccess) return;
                            setLocalSettings({
                              ...localSettings,
                              lessonPeriod: parseInt(e.target.value, 10) || 40
                            });
                          }}
                          min="10"
                          max="120"
                          className="w-full pl-10 pr-3 py-2.5 text-xs font-semibold bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/25"
                          disabled={!hasWriteAccess}
                        />
                      </div>
                    </div>

                    <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-950/20 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-indigo-900 dark:text-indigo-400">Total Durasi Operasional:</span>
                      <p className="text-slate-600 dark:text-zinc-400 text-[11px]">
                        Operasional harian berlangsung dari jam{" "}
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.schoolHours?.startTime || "07:00"}
                        </strong>{" "}
                        hingga{" "}
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.schoolHours?.endTime || "14:00"}
                        </strong>{" "}
                        (Total: {" "}
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {timeToMinutes(localSettings.schoolHours?.endTime || "14:00") - timeToMinutes(localSettings.schoolHours?.startTime || "07:00")} menit
                        </strong>).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. STRUKTUR JP & PREVIEW */}
              {activeTab === "struktur-jp" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Sliders className="h-4.5 w-4.5 text-indigo-600" />
                      3. Perhitungan Struktur JP Otomatis
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Berikut adalah simulasi dan pembagian Jam Pelajaran (JP) otomatis berdasarkan pengaturan Anda.</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200/50 dark:border-zinc-850">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Jam Masuk</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {localSettings.schoolHours?.startTime || "07:00"} WIB
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Jam Pulang</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {localSettings.schoolHours?.endTime || "14:00"} WIB
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Durasi JP</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {localSettings.lessonPeriod || 40} Menit / JP
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-bold uppercase">Waktu Istirahat</span>
                        <span className="font-semibold text-slate-800 dark:text-zinc-200">
                          {localSettings.breakTimes.length} Kali Terjadwal
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/20 rounded-xl text-xs flex gap-2">
                      <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                      <p className="text-slate-600 dark:text-zinc-400 text-[11px]">
                        Sistem menghitung slot JP secara sekuensial. Jam pelajaran akan dilompati secara otomatis ketika berpapasan dengan waktu istirahat atau kegiatan rutin yang aktif pada hari tersebut.
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Preview Alokasi Slot Hari {selectedPreviewDay}</span>
                      <div className="border border-slate-200/50 dark:border-zinc-800 rounded-xl p-2 bg-slate-50/50 dark:bg-zinc-950/30 max-h-[160px] overflow-y-auto space-y-1">
                        {previewTimeline.filter(b => b.type === "jp").map((b, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-100 dark:border-zinc-850">
                            <span className="font-bold text-xs text-slate-700 dark:text-zinc-300">{b.name}</span>
                            <span className="font-mono text-xs text-blue-600 font-bold bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded">
                              {b.start} - {b.end} ({b.duration} mnt)
                            </span>
                          </div>
                        ))}
                        {previewTimeline.filter(b => b.type === "jp").length === 0 && (
                          <p className="text-xs text-slate-400 italic text-center py-4">Tidak ada JP yang muat pada hari {selectedPreviewDay}.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. KEGIATAN RUTIN */}
              {activeTab === "kegiatan-rutin" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Volume2 className="h-4.5 w-4.5 text-indigo-600" />
                      4. Daftar Kegiatan Rutin Harian
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tentukan kegiatan rutin terjadwal. Admin dapat menonaktifkan kegiatan bawaan dan menambah kegiatan baru.</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* Routine activities table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-zinc-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            <th className="py-2">Nama</th>
                            <th className="py-2">Hari</th>
                            <th className="py-2 text-center">Aktif</th>
                            <th className="py-2 text-right">Mulai</th>
                            <th className="py-2 text-right">Durasi</th>
                            <th className="py-2 text-right">Selesai</th>
                            <th className="py-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {(localSettings.routineActivities || []).map((item, index) => {
                            const isEditing = editingRoutineId === item.id;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-850/20">
                                <td className="py-3 font-semibold text-slate-800 dark:text-zinc-200">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editRoutineName}
                                      onChange={(e) => setEditRoutineName(e.target.value)}
                                      className="w-20 px-1 py-0.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded"
                                    />
                                  ) : (
                                    item.name
                                  )}
                                </td>
                                <td className="py-3">
                                  {isEditing ? (
                                    <div className="flex flex-col gap-1 max-h-[80px] overflow-y-auto p-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded">
                                      {DAYS_OF_WEEK.map(d => (
                                        <label key={d} className="flex items-center gap-1 text-[10px]">
                                          <input
                                            type="checkbox"
                                            checked={editRoutineDays.includes(d)}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setEditRoutineDays([...editRoutineDays, d]);
                                              } else {
                                                setEditRoutineDays(editRoutineDays.filter(day => day !== d));
                                              }
                                            }}
                                          />
                                          {d}
                                        </label>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-zinc-400 font-medium">
                                      {item.days.length === DAYS_OF_WEEK.length ? "Semua Hari" : item.days.join(", ")}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 text-center">
                                  {isEditing ? (
                                    <input
                                      type="checkbox"
                                      checked={editRoutineEnabled}
                                      onChange={(e) => setEditRoutineEnabled(e.target.checked)}
                                    />
                                  ) : (
                                    <input
                                      type="checkbox"
                                      checked={item.enabled}
                                      onChange={(e) => handleToggleRoutineActive(index, e.target.checked)}
                                      disabled={!hasWriteAccess}
                                      className="cursor-pointer"
                                    />
                                  )}
                                </td>
                                <td className="py-3 text-right font-mono text-[11px]">
                                  {isEditing ? (
                                    <input
                                      type="time"
                                      value={editRoutineStart}
                                      onChange={(e) => setEditRoutineStart(e.target.value)}
                                      className="px-1 py-0.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-xs"
                                    />
                                  ) : (
                                    item.startTime
                                  )}
                                </td>
                                <td className="py-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={editRoutineDuration}
                                      onChange={(e) => setEditRoutineDuration(parseInt(e.target.value, 10) || 10)}
                                      className="w-12 px-1 py-0.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-xs"
                                    />
                                  ) : (
                                    `${item.duration}m`
                                  )}
                                </td>
                                <td className="py-3 text-right font-mono font-semibold">
                                  {isEditing ? (
                                    <span className="text-slate-400 text-[10px] italic">Auto</span>
                                  ) : (
                                    item.autoEndTime
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  {isEditing ? (
                                    <div className="flex justify-end gap-1">
                                      <button onClick={handleSaveEditRoutine} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded">
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => setEditingRoutineId(null)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-800 rounded">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => handleStartEditRoutine(item)}
                                        disabled={!hasWriteAccess}
                                        className="p-1 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 disabled:opacity-50"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteRoutine(item.id)}
                                        disabled={!hasWriteAccess}
                                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-800 rounded disabled:opacity-50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Add routine activity form */}
                    {hasWriteAccess && (
                      <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-850 rounded-2xl space-y-3 mt-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Tambah Kegiatan Rutin Baru</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Nama Kegiatan</label>
                            <input
                              type="text"
                              placeholder="Briefing / Kajian"
                              value={newRoutineName}
                              onChange={(e) => setNewRoutineName(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Jam Mulai</label>
                            <input
                              type="time"
                              value={newRoutineStart}
                              onChange={(e) => setNewRoutineStart(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Durasi (Menit)</label>
                            <input
                              type="number"
                              value={newRoutineDuration}
                              onChange={(e) => setNewRoutineDuration(parseInt(e.target.value, 10) || 15)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                              min="5"
                              max="180"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Keterangan</label>
                            <input
                              type="text"
                              placeholder="Keterangan singkat"
                              value={newRoutineDesc}
                              onChange={(e) => setNewRoutineDesc(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Checkbox of Active Days for routine activity */}
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 block mb-1">Hari Kerja Aktif</label>
                          <div className="flex flex-wrap gap-2 pt-1">
                            {localSettings.activeDays.map(day => {
                              const isChecked = newRoutineDays.includes(day);
                              return (
                                <button
                                  type="button"
                                  key={day}
                                  onClick={() => {
                                    if (isChecked) {
                                      setNewRoutineDays(newRoutineDays.filter(d => d !== day));
                                    } else {
                                      setNewRoutineDays([...newRoutineDays, day]);
                                    }
                                  }}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-all border ${
                                    isChecked
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-white dark:bg-zinc-900 text-slate-500 border-slate-200 dark:border-zinc-800 hover:bg-slate-100"
                                  }`}
                                >
                                  {day}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleAddRoutine}
                            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" /> Tambah Kegiatan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. WAKTU ISTIRAHAT */}
              {activeTab === "waktu-istirahat" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Coffee className="h-4.5 w-4.5 text-indigo-600" />
                      5. Konfigurasi Waktu Istirahat
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Atur slot istirahat siswa. Anda dapat menambah waktu istirahat sebanyak yang dibutuhkan tanpa batasan.</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* Breaks list table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-zinc-800 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                            <th className="py-2">Nama Istirahat</th>
                            <th className="py-2 text-right">Jam Mulai</th>
                            <th className="py-2 text-right">Jam Selesai</th>
                            <th className="py-2 text-right">Durasi (Otomatis)</th>
                            <th className="py-2 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                          {localSettings.breakTimes.map((item) => {
                            const isEditing = editingBreakId === item.id;
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/40 dark:hover:bg-zinc-850/20">
                                <td className="py-3 font-semibold text-slate-800 dark:text-zinc-200">
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={editBreakName}
                                      onChange={(e) => setEditBreakName(e.target.value)}
                                      className="px-2 py-1 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-xs w-28"
                                    />
                                  ) : (
                                    item.name
                                  )}
                                </td>
                                <td className="py-3 text-right font-mono text-[11px]">
                                  {isEditing ? (
                                    <input
                                      type="time"
                                      value={editBreakStart}
                                      onChange={(e) => setEditBreakStart(e.target.value)}
                                      className="px-1.5 py-0.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-xs"
                                    />
                                  ) : (
                                    item.start
                                  )}
                                </td>
                                <td className="py-3 text-right font-mono text-[11px]">
                                  {isEditing ? (
                                    <input
                                      type="time"
                                      value={editBreakEnd}
                                      onChange={(e) => setEditBreakEnd(e.target.value)}
                                      className="px-1.5 py-0.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-xs"
                                    />
                                  ) : (
                                    item.end
                                  )}
                                </td>
                                <td className="py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {isEditing ? (
                                    <span className="text-slate-400 text-[10px] italic">Otomatis</span>
                                  ) : (
                                    `${item.duration} Menit`
                                  )}
                                </td>
                                <td className="py-3 text-right">
                                  {isEditing ? (
                                    <div className="flex justify-end gap-1">
                                      <button onClick={handleSaveEditBreak} className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded">
                                        <Check className="h-3.5 w-3.5" />
                                      </button>
                                      <button onClick={() => setEditingBreakId(null)} className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-800 rounded">
                                        <X className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex justify-end gap-1">
                                      <button
                                        onClick={() => handleStartEditBreak(item)}
                                        disabled={!hasWriteAccess}
                                        className="p-1 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 disabled:opacity-50"
                                      >
                                        <Edit2 className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteBreak(item.id)}
                                        disabled={!hasWriteAccess}
                                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-zinc-800 rounded disabled:opacity-50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {localSettings.breakTimes.length === 0 && (
                            <tr>
                              <td colSpan={5} className="text-center py-6 text-slate-400 italic bg-slate-50 dark:bg-zinc-950/20 rounded-xl">
                                Belum ada waktu istirahat terdaftar. Silakan tambah istirahat di bawah.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Add break form */}
                    {hasWriteAccess && (
                      <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-850 rounded-2xl space-y-3 mt-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Tambah Waktu Istirahat Baru</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Nama Istirahat</label>
                            <input
                              type="text"
                              placeholder="Istirahat 1 / Dzuhur"
                              value={newBreakName}
                              onChange={(e) => setNewBreakName(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Jam Mulai</label>
                            <input
                              type="time"
                              value={newBreakStart}
                              onChange={(e) => setNewBreakStart(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Jam Selesai</label>
                            <input
                              type="time"
                              value={newBreakEnd}
                              onChange={(e) => setNewBreakEnd(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Keterangan (Optional)</label>
                            <input
                              type="text"
                              placeholder="Keterangan singkat"
                              value={newBreakDesc}
                              onChange={(e) => setNewBreakDesc(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg focus:outline-hidden"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-[10px] text-slate-400 font-mono">
                            Durasi dihitung otomatis: {timeToMinutes(newBreakEnd) - timeToMinutes(newBreakStart) > 0 ? `${timeToMinutes(newBreakEnd) - timeToMinutes(newBreakStart)} menit` : "Jam tidak valid"}
                          </span>
                          <button
                            type="button"
                            onClick={handleAddBreak}
                            className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" /> Tambah Istirahat
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 6. HARI LIBUR KHUSUS PLACEHOLDER */}
              {activeTab === "hari-libur" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <ShieldAlert className="h-4.5 w-4.5 text-indigo-600" />
                      6. Hari Libur Khusus (Placeholder)
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Penetapan kalender hari libur nasional atau libur khusus sekolah agar scheduler tidak mengisi jadwal.</p>
                  </div>

                  <div className="py-10 text-center space-y-3">
                    <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-300">Modul Kalender Libur Sekolah</h4>
                      <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                        Fitur kalender penanda hari libur khusus nasional sedang disempurnakan dan akan diintegrasikan dengan Auto Scheduler di patch mendatang.
                      </p>
                    </div>
                    <span className="inline-block text-[9px] font-bold px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md">Segera Hadir / Placeholder</span>
                  </div>
                </div>
              )}

              {/* 7. SIMPAN PENGATURAN */}
              {activeTab === "simpan" && (
                <div className="space-y-4">
                  <div className="border-b border-slate-100 dark:border-zinc-850 pb-3">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Save className="h-4.5 w-4.5 text-indigo-600" />
                      7. Tinjau & Simpan Pengaturan
                    </h2>
                    <p className="text-[11px] text-slate-400 mt-0.5">Tinjau kembali ringkasan konfigurasi sebelum menyimpannya ke database cloud Firestore.</p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-850 rounded-2xl text-xs space-y-3.5 pt-3">
                    <h4 className="font-bold text-slate-700 dark:text-zinc-300 uppercase text-[9px] tracking-wider flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Ringkasan Konfigurasi Sekolah:
                    </h4>
                    
                    <ul className="space-y-2 text-slate-600 dark:text-zinc-400">
                      <li className="flex justify-between border-b border-slate-100 dark:border-zinc-900 pb-1.5">
                        <span>Hari Aktif Sekolah:</span>
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.activeDays.length === DAYS_OF_WEEK.length ? "Semua Hari" : localSettings.activeDays.join(", ")}
                        </strong>
                      </li>
                      <li className="flex justify-between border-b border-slate-100 dark:border-zinc-900 pb-1.5">
                        <span>Jam Masuk & Pulang:</span>
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.schoolHours?.startTime || "07:00"} - {localSettings.schoolHours?.endTime || "14:00"} WIB
                        </strong>
                      </li>
                      <li className="flex justify-between border-b border-slate-100 dark:border-zinc-900 pb-1.5">
                        <span>Durasi Belajar per JP:</span>
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.lessonPeriod || 40} Menit
                        </strong>
                      </li>
                      <li className="flex justify-between border-b border-slate-100 dark:border-zinc-900 pb-1.5">
                        <span>Jumlah Istirahat Terdaftar:</span>
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.breakTimes.length} Kali
                        </strong>
                      </li>
                      <li className="flex justify-between border-b border-slate-100 dark:border-zinc-900 pb-1.5">
                        <span>Jumlah Kegiatan Rutin Aktif:</span>
                        <strong className="text-slate-800 dark:text-zinc-200">
                          {localSettings.routineActivities?.filter(r => r.enabled).length || 0} Terjadwal
                        </strong>
                      </li>
                    </ul>

                    {/* Operational indicators */}
                    <div className="flex gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300">
                      <UserCheck className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Database Sinkronisasi</span>
                        <p className="text-[10px] opacity-90 mt-0.5">Seluruh perubahan akan langsung didistribusikan ke database cloud dan modul Auto Scheduler.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions inside Form card */}
            {hasWriteAccess && (
              <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-6">
                <button
                  type="button"
                  onClick={handleSaveAllSettings}
                  disabled={isUpdating || !!routineOverlapError || !!breakOverlapError}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer text-xs"
                >
                  {isUpdating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Terapkan & Simpan Pengaturan
                </button>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 3: REAL-TIME AUTOMATIC PREVIEW PANEL (4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs sticky top-4">
            <div className="border-b border-slate-100 dark:border-zinc-850 pb-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  Preview Struktur Harian
                </h2>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Visualisasi pembagian waktu belajar SMP Alkarim Rasyid dihitung otomatis berdasarkan input Anda.
              </p>
            </div>

            {/* Day Selector Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 border-b border-slate-100 dark:border-zinc-850/50 mb-3">
              {localSettings.activeDays.map((day) => {
                const isSelected = selectedPreviewDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedPreviewDay(day)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-zinc-950 dark:text-zinc-400"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Timeline Blocks List */}
            <div className="relative border-l border-slate-150 dark:border-zinc-800 ml-2.5 pl-4 space-y-3 py-1 max-h-[380px] overflow-y-auto">
              {previewTimeline.map((block, index) => {
                return (
                  <div key={index} className="relative">
                    {/* Bullet marker */}
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border border-white dark:border-zinc-900 bg-slate-300 dark:bg-zinc-700 flex items-center justify-center z-10" />
                    
                    <div className={`p-2.5 rounded-xl border text-[11px] ${getTimelineItemStyle(block.type)}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-bold">
                          {getTimelineIcon(block.type)}
                          <span>{block.name}</span>
                        </div>
                        <span className="text-[9px] font-mono font-bold bg-white/60 dark:bg-zinc-900/50 px-1.5 py-0.5 rounded">
                          {block.start} - {block.end}
                        </span>
                      </div>
                      <div className="text-[9px] opacity-85 mt-1 flex justify-between">
                        <span>Durasi: {block.duration} Mnt</span>
                        {block.type === "jp" && <span className="font-black text-blue-600 dark:text-blue-400">Jam Pelajaran</span>}
                        {block.type === "assembly" && <span className="font-bold text-amber-600 dark:text-amber-400">Apel Pagi</span>}
                        {block.type === "special" && <span className="font-bold text-indigo-600 dark:text-indigo-400">Kegiatan Khusus</span>}
                        {block.type === "break" && <span className="font-bold text-emerald-600 dark:text-emerald-400">Waktu Istirahat</span>}
                        {block.type === "gap" && <span className="font-medium text-slate-400 italic">Jeda</span>}
                        {block.type === "end" && <span className="font-bold text-slate-500">Pulang</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {previewTimeline.length === 0 && (
                <p className="text-xs text-slate-400 italic py-6 text-center">Silakan aktifkan hari di tab Hari Aktif untuk melihat preview struktur jadwal.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
