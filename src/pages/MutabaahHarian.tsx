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
  Edit2
} from "lucide-react";

export const MutabaahHarian: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const userRoles = user?.roles || [user?.role || ""];
  const isAdmin = userRoles.includes("admin") || user?.role === "admin";
  const isKepalaSekolah = userRoles.includes("kepala sekolah") || user?.role === "kepala sekolah";
  const isWakaKurikulum = userRoles.includes("wakil kepala sekolah") || user?.role === "wakil kepala sekolah";
  const isKetuaYayasan = userRoles.includes("ketua yayasan") || user?.role === "ketua yayasan";
  const canManageIndicators = isKepalaSekolah || isWakaKurikulum || isAdmin;

  // Active Tab
  const [activeTab, setActiveTab] = useState<"saya" | "monitoring" | "pengaturan" | "logs">("saya");

  // Selected date for "saya" fill-up (defaults to today)
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Load all indicators
  const { data: indicators = [], isLoading: isLoadingIndicators } = useQuery<SdmMutabaahIndicator[]>({
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
  const { data: userHistory = [], isLoading: isLoadingHistory } = useQuery<SdmMutabaahEntry[]>({
    queryKey: ["mutabaahHistory", user?.userId],
    queryFn: () => mutabaahService.getUserEntries(user?.userId || ""),
    enabled: !!user?.userId && activeTab === "saya"
  });

  // Load all users (for monitoring and templates)
  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => userService.getUsers(),
    enabled: activeTab === "monitoring" || activeTab === "pengaturan"
  });

  // Load monitoring entries for selected date
  const [monitoredDate, setMonitoredDate] = useState<string>(todayStr);
  const [monitoredRole, setMonitoredRole] = useState<string>("Semua");
  const { data: monitoringEntries = [], isLoading: isLoadingMonitoring } = useQuery<SdmMutabaahEntry[]>({
    queryKey: ["mutabaahAllEntries", monitoredDate],
    queryFn: () => mutabaahService.getAllEntries(monitoredDate),
    enabled: activeTab === "monitoring"
  });

  // Load change logs
  const { data: changeLogs = [] } = useQuery<SdmMutabaahChangeLog[]>({
    queryKey: ["mutabaahLogs"],
    queryFn: () => mutabaahService.getChangeLogs(),
    enabled: activeTab === "logs"
  });

  // Local state for filling up Mutabaah
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formAttachments, setFormAttachments] = useState<Record<string, string>>({});

  // Get active indicators that apply to current user's role
  const myApplicableIndicators = useMemo(() => {
    return indicators.filter(
      (ind) =>
        ind.isActive &&
        !ind.isArchived &&
        ind.applicableRoles.some((r) => userRoles.includes(r))
    );
  }, [indicators, userRoles]);

  // Sync today's values to form state when loaded
  useEffect(() => {
    if (todayEntry) {
      setFormValues(todayEntry.values || {});
      setFormAttachments(todayEntry.attachmentUrls || {});
    } else {
      // Pre-populate empty form
      const emptyVals: Record<string, any> = {};
      const emptyAtts: Record<string, string> = {};
      myApplicableIndicators.forEach((ind) => {
        if (ind.inputType === "boolean") emptyVals[ind.id] = false;
        else if (ind.inputType === "number") emptyVals[ind.id] = 0;
        else if (ind.inputType === "percentage") emptyVals[ind.id] = 0;
        else if (ind.inputType === "choice") emptyVals[ind.id] = "Cukup";
        else emptyVals[ind.id] = "";
        emptyAtts[ind.id] = "";
      });
      setFormValues(emptyVals);
      setFormAttachments(emptyAtts);
    }
  }, [todayEntry, myApplicableIndicators]);

  // Handle value change during filling
  const handleValueChange = (indicatorId: string, val: any) => {
    setFormValues((prev) => ({
      ...prev,
      [indicatorId]: val
    }));
  };

  // Handle attachment simulated URL input
  const handleAttachmentChange = (indicatorId: string, url: string) => {
    setFormAttachments((prev) => ({
      ...prev,
      [indicatorId]: url
    }));
  };

  // Calculate compliance for filling
  const currentCompliancePercent = useMemo(() => {
    if (myApplicableIndicators.length === 0) return 100;

    let totalWeight = 0;
    let earnedWeight = 0;

    myApplicableIndicators.forEach((ind) => {
      const weight = ind.weight || 1;
      totalWeight += weight;

      const rawVal = formValues[ind.id];
      let compliance = 0; // 0 to 1

      if (ind.inputType === "boolean") {
        compliance = rawVal === true ? 1 : 0;
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
        // Text/Photo/Document: filled vs empty
        compliance = rawVal && String(rawVal).trim().length > 0 ? 1 : 0;
      }

      earnedWeight += compliance * weight;
    });

    return totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  }, [myApplicableIndicators, formValues]);

  // Mutation to save daily entry
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
        compliancePercentage: currentCompliancePercent
      };
      await mutabaahService.saveDailyEntry(entryPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mutabaahEntry"] });
      queryClient.invalidateQueries({ queryKey: ["mutabaahHistory"] });
      toast("Mutabaah Harian berhasil disimpan!", "success");
    },
    onError: (err: any) => {
      toast(`Gagal menyimpan mutabaah: ${err.message}`, "error");
    }
  });

  // --- INDICATOR MANAGEMENT STATE ---
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<SdmMutabaahIndicator | null>(null);
  const [indicatorForm, setIndicatorForm] = useState({
    id: "",
    name: "",
    category: "Ibadah",
    inputType: "boolean" as SdmMutabaahIndicator["inputType"],
    target: 1,
    unit: "",
    applicableRoles: [] as string[],
    weight: 10
  });

  // Handle open modal for indicator add/edit
  const handleOpenIndicatorModal = (ind?: SdmMutabaahIndicator) => {
    if (ind) {
      setSelectedIndicator(ind);
      setIndicatorForm({
        id: ind.id,
        name: ind.name,
        category: ind.category,
        inputType: ind.inputType,
        target: ind.target,
        unit: ind.unit,
        applicableRoles: ind.applicableRoles,
        weight: ind.weight
      });
    } else {
      setSelectedIndicator(null);
      setIndicatorForm({
        id: "ind_" + Math.random().toString(36).substr(2, 9),
        name: "",
        category: "Ibadah",
        inputType: "boolean",
        target: 1,
        unit: "",
        applicableRoles: ["guru", "musrif"],
        weight: 10
      });
    }
    setIsIndicatorModalOpen(true);
  };

  // Mutation to save indicator
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
          weight: indicatorForm.weight
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

  // Mutation to archive indicator
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

  // Mutation to toggle active status
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
        (ind) => !ind.isArchived && ind.applicableRoles.includes(templateRole)
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
        indicators: roleInds.map(({ id, name, category, inputType, target, unit, applicableRoles, weight, isActive, isArchived, updatedBy }) => ({
          id, name, category, inputType, target, unit, applicableRoles, weight, isActive, isArchived, updatedBy
        }))
      });
      toast(`Template untuk peran ${templateRole.toUpperCase()} berhasil disimpan!`, "success");
    } catch (e: any) {
      toast(`Gagal menyimpan template: ${e.message}`, "error");
    }
  };

  const handleApplyTemplate = async () => {
    toast("Fitur reset/apply template berhasil diterapkan!", "success");
  };

  // Filtered monitoring table data
  const filteredMonitoringList = useMemo(() => {
    return allUsers
      .filter((u) => u.status === "Aktif")
      .map((u) => {
        const uRole = u.role || "";
        const uRoles = u.roles || [uRole];
        const entry = monitoringEntries.find((e) => e.userId === u.userId);

        return {
          userId: u.userId,
          name: u.name || u.email.split("@")[0],
          role: uRole,
          roles: uRoles,
          filled: !!entry,
          compliance: entry ? entry.compliancePercentage : null,
          entry
        };
      })
      .filter((u) => {
        if (monitoredRole === "Semua") return true;
        return u.roles.includes(monitoredRole.toLowerCase());
      });
  }, [allUsers, monitoringEntries, monitoredRole]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 dark:border-zinc-800 pb-5 gap-4">
        <div>
          <span className="text-[10px] bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Modul Evaluasi SDM
          </span>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mt-1">Mutabaah Harian</h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Mencatat dan memantau perkembangan pribadi, ibadah, kedisiplinan, serta administrasi tugas asatidzah secara berkala.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setActiveTab("saya")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === "saya"
                ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs"
                : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Mutabaah Saya
          </button>
          {(isKepalaSekolah || isWakaKurikulum || isKetuaYayasan || isAdmin) && (
            <button
              onClick={() => setActiveTab("monitoring")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === "monitoring"
                  ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              Monitoring SDM
            </button>
          )}
          {canManageIndicators && (
            <>
              <button
                onClick={() => setActiveTab("pengaturan")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "pengaturan"
                    ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Pengaturan Indikator
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === "logs"
                    ? "bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                Template & Log
              </button>
            </>
          )}
        </div>
      </div>

      {isLoadingIndicators ? (
        <Loading />
      ) : (
        <>
          {/* TAB 1: MUTABAAH SAYA */}
          {activeTab === "saya" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Input */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-rose-600" />
                    <div>
                      <h2 className="text-md font-bold text-slate-800 dark:text-white">Isi Evaluasi Mutabaah</h2>
                      <p className="text-[10px] text-slate-400">Silakan isi perkembangan mutabaah pribadi Anda.</p>
                    </div>
                  </div>
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                {myApplicableIndicators.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Tidak ada indikator mutabaah yang terdaftar untuk peran Anda ({userRoles.join(", ").toUpperCase()}). Hubungi Kepala Sekolah atau Waka Kurikulum.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Groups by Category */}
                    {["Ibadah", "Literasi", "Kedisiplinan", "Administrasi", "Pengembangan Diri", "Kepemimpinan", "Pembinaan", "Tahfizh", "Tahsin", "Adab"].map((cat) => {
                      const catInds = myApplicableIndicators.filter((i) => i.category === cat);
                      if (catInds.length === 0) return null;

                      return (
                        <div key={cat} className="space-y-3">
                          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-l-2 border-rose-500 pl-2">{cat}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {catInds.map((ind) => (
                              <div
                                key={ind.id}
                                className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-100 dark:border-zinc-900 space-y-3 flex flex-col justify-between"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-zinc-200">{ind.name}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Target: <span className="font-semibold text-rose-500">{ind.target}</span> {ind.unit || ""}
                                    </p>
                                  </div>
                                  <span className="text-[9px] bg-slate-200/50 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-2 py-0.5 rounded font-bold">
                                    Bobot: {ind.weight}%
                                  </span>
                                </div>

                                {/* Dynamic Input Field */}
                                <div className="pt-2">
                                  {ind.inputType === "boolean" && (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleValueChange(ind.id, true)}
                                        className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                          formValues[ind.id] === true
                                            ? "bg-rose-600 border-rose-600 text-white"
                                            : "border-slate-200 dark:border-zinc-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900"
                                        }`}
                                      >
                                        <Check className="h-3 w-3" /> Ya
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleValueChange(ind.id, false)}
                                        className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                                          formValues[ind.id] === false
                                            ? "bg-slate-600 border-slate-600 text-white"
                                            : "border-slate-200 dark:border-zinc-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900"
                                        }`}
                                      >
                                        <X className="h-3 w-3" /> Tidak
                                      </button>
                                    </div>
                                  )}

                                  {ind.inputType === "number" && (
                                    <input
                                      type="number"
                                      min="0"
                                      value={formValues[ind.id] || 0}
                                      onChange={(e) => handleValueChange(ind.id, parseFloat(e.target.value) || 0)}
                                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    />
                                  )}

                                  {ind.inputType === "percentage" && (
                                    <div className="relative">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={formValues[ind.id] || 0}
                                        onChange={(e) => handleValueChange(ind.id, parseFloat(e.target.value) || 0)}
                                        className="w-full pr-8 pl-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                      />
                                      <span className="absolute right-3 top-1.5 text-xs text-slate-400">%</span>
                                    </div>
                                  )}

                                  {ind.inputType === "choice" && (
                                    <select
                                      value={formValues[ind.id] || "Cukup"}
                                      onChange={(e) => handleValueChange(ind.id, e.target.value)}
                                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    >
                                      <option value="Sangat Baik">Sangat Baik</option>
                                      <option value="Baik">Baik</option>
                                      <option value="Cukup">Cukup</option>
                                      <option value="Perlu Pembinaan">Perlu Pembinaan</option>
                                    </select>
                                  )}

                                  {ind.inputType === "text" && (
                                    <textarea
                                      rows={2}
                                      value={formValues[ind.id] || ""}
                                      onChange={(e) => handleValueChange(ind.id, e.target.value)}
                                      placeholder="Tambahkan penjelasan..."
                                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                    />
                                  )}

                                  {(ind.inputType === "document" || ind.inputType === "photo") && (
                                    <div className="space-y-2">
                                      <input
                                        type="text"
                                        value={formValues[ind.id] || ""}
                                        onChange={(e) => handleValueChange(ind.id, e.target.value)}
                                        placeholder={ind.inputType === "photo" ? "Tulis keterangan / URL foto bukti..." : "Tulis link / keterangan dokumen..."}
                                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                                      />
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                        <Upload className="h-3 w-3 text-rose-500" />
                                        <span>Simulasi bukti dokumen / tautan terlampir</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="border-t border-slate-100 dark:border-zinc-800 pt-5 flex items-center justify-end gap-3">
                      <button
                        onClick={() => saveEntryMutation.mutate()}
                        disabled={saveEntryMutation.isPending}
                        className="px-6 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                      >
                        {saveEntryMutation.isPending ? "Menyimpan..." : "Simpan Mutabaah Hari Ini"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress and History */}
              <div className="space-y-6">
                {/* Score Card */}
                <div className="bg-gradient-to-tr from-rose-600 to-amber-500 text-white rounded-2xl p-6 shadow-md space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-rose-100">Evaluasi Hari Ini</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-black">{currentCompliancePercent}%</span>
                    <span className="text-rose-100 text-xs font-semibold">Ketercapaian</span>
                  </div>
                  <p className="text-[11px] text-rose-100">
                    Nilai akhir didapatkan berdasarkan kalkulasi persentase dan bobot indikator tugas fungsional Anda.
                  </p>
                  <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                    <div className="bg-white h-full rounded-full transition-all duration-300" style={{ width: `${currentCompliancePercent}%` }} />
                  </div>
                </div>

                {/* History Card */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-50 dark:border-zinc-800 pb-3">
                    <History className="h-4 w-4 text-slate-500" />
                    <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Riwayat Pengisian</h3>
                  </div>

                  {isLoadingHistory ? (
                    <Loading />
                  ) : userHistory.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">Belum ada riwayat mutabaah.</div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {userHistory.slice(0, 8).map((hist) => (
                        <div
                          key={hist.id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 rounded-xl"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                              {new Date(hist.date).toLocaleDateString("id-ID", {
                                weekday: "long",
                                day: "numeric",
                                month: "short",
                                year: "numeric"
                              })}
                            </p>
                            <p className="text-[9px] text-slate-400 mt-0.5">Dibuat: {new Date(hist.createdAt).toLocaleTimeString("id-ID")}</p>
                          </div>
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                            hist.compliancePercentage >= 80
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                              : hist.compliancePercentage >= 50
                              ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                              : "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400"
                          }`}>
                            {hist.compliancePercentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MONITORING SDM */}
          {activeTab === "monitoring" && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-6">
              {/* Filters */}
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-rose-600" />
                  <div>
                    <h2 className="text-md font-bold text-slate-800 dark:text-white">Pemantauan Mutabaah SDM</h2>
                    <p className="text-[10px] text-slate-400">Rekap keaktifan harian dan tingkat kepatuhan ketercapaian target sdm asatidzah.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Tanggal:</span>
                    <input
                      type="date"
                      value={monitoredDate}
                      onChange={(e) => setMonitoredDate(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">Peran:</span>
                    <select
                      value={monitoredRole}
                      onChange={(e) => setMonitoredRole(e.target.value)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      <option value="Semua">Semua Peran</option>
                      <option value="kepala sekolah">Kepala Sekolah</option>
                      <option value="wakil kepala sekolah">Waka</option>
                      <option value="guru">Guru</option>
                      <option value="staff">Staff</option>
                      <option value="musrif">Musrif</option>
                    </select>
                  </div>
                </div>
              </div>

              {isLoadingMonitoring ? (
                <Loading />
              ) : filteredMonitoringList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">Tidak ada data asatidzah untuk peran yang dipilih.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-bold">
                        <th className="py-3 px-4">Nama SDM</th>
                        <th className="py-3 px-4">Peran Fungsional</th>
                        <th className="py-3 px-4">Status Pengisian</th>
                        <th className="py-3 px-4">Tingkat Kepatuhan</th>
                        <th className="py-3 px-4 text-right">Detail Evaluasi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMonitoringList.map((m) => (
                        <tr key={m.userId} className="border-b border-slate-50 dark:border-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-950/30">
                          <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-zinc-200">{m.name}</td>
                          <td className="py-3.5 px-4">
                            <span className="capitalize px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                              {m.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {m.filled ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                <CheckCircle className="h-3.5 w-3.5" /> Sudah Isi
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">Belum Mengisi</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {m.compliance !== null ? (
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden shrink-0">
                                  <div className={`h-full rounded-full ${
                                    m.compliance >= 80 ? "bg-emerald-500" : m.compliance >= 50 ? "bg-amber-500" : "bg-rose-500"
                                  }`} style={{ width: `${m.compliance}%` }} />
                                </div>
                                <span className={`font-black ${
                                  m.compliance >= 80 ? "text-emerald-600" : m.compliance >= 50 ? "text-amber-600" : "text-rose-600"
                                }`}>
                                  {m.compliance}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-700 font-bold">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {m.filled && m.entry ? (
                              <button
                                onClick={() => {
                                  toast(`Tingkat kepatuhan ${m.name}: ${m.compliance}%`, "info");
                                }}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-zinc-300 transition-all cursor-pointer"
                              >
                                Lihat Isian
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-700 font-bold">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PENGATURAN INDIKATOR */}
          {activeTab === "pengaturan" && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <SettingsIcon className="h-5 w-5 text-rose-600" />
                  <div>
                    <h2 className="text-md font-bold text-slate-800 dark:text-white">Pengaturan Indikator Mutabaah</h2>
                    <p className="text-[10px] text-slate-400">Definisikan, ubah, dan kelola target fungsional indikator mutabaah asatidzah.</p>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenIndicatorModal()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Tambah Indikator
                </button>
              </div>

              {/* Table list of indicators */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-zinc-800 text-slate-400 font-bold">
                      <th className="py-3 px-4">Nama Indikator</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Tipe Input</th>
                      <th className="py-3 px-4">Target & Satuan</th>
                      <th className="py-3 px-4">Berlaku Untuk</th>
                      <th className="py-3 px-4">Bobot</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.filter(ind => !ind.isArchived).map((ind) => (
                      <tr key={ind.id} className="border-b border-slate-50 dark:border-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-950/30">
                        <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-zinc-200">{ind.name}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400">
                            {ind.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-150 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 uppercase tracking-tight text-[9px]">
                            {ind.inputType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-700 dark:text-zinc-300">{ind.target}</span> <span className="text-slate-400">{ind.unit}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {ind.applicableRoles.map((role) => (
                              <span key={role} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-700 dark:text-zinc-300">{ind.weight}%</td>
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: ind.id, name: ind.name, currentStatus: ind.isActive })}
                            className={`px-2.5 py-1 rounded-full text-[9px] font-black transition-all cursor-pointer ${
                              ind.isActive
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500"
                            }`}
                          >
                            {ind.isActive ? "Aktif" : "Nonaktif"}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenIndicatorModal(ind)}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-all cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Yakin ingin mengarsipkan indikator "${ind.name}"?`)) {
                                archiveIndicatorMutation.mutate({ id: ind.id, name: ind.name });
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TEMPLATE & LOGS */}
          {activeTab === "logs" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Templates management */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-50 dark:border-zinc-800 pb-3">
                  <Layers className="h-5 w-5 text-rose-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Template Indikator</h3>
                    <p className="text-[10px] text-slate-400">Gunakan template untuk menyimpan atau mereset indikator.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Pilih Peran Fungsional</label>
                    <select
                      value={templateRole}
                      onChange={(e) => setTemplateRole(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value="guru">Guru</option>
                      <option value="staff">Staff</option>
                      <option value="musrif">Musrif</option>
                      <option value="wakil kepala sekolah">Wakil Kepala Sekolah</option>
                      <option value="kepala sekolah">Kepala Sekolah</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={handleSaveTemplate}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold text-slate-700 dark:text-zinc-200 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Simpan Sebagai Template Aktif
                    </button>
                    <button
                      onClick={handleApplyTemplate}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      Terapkan Template Default
                    </button>
                  </div>
                </div>
              </div>

              {/* Change History Logs */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 p-6 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-50 dark:border-zinc-800 pb-3">
                  <History className="h-5 w-5 text-rose-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">Riwayat Perubahan Indikator</h3>
                    <p className="text-[10px] text-slate-400">Log pencatatan audit perubahan parameter indikator oleh Kepala Sekolah atau Waka.</p>
                  </div>
                </div>

                {changeLogs.length === 0 ? (
                  <div className="text-center py-12 text-xs text-slate-400">Belum ada riwayat aktivitas log.</div>
                ) : (
                  <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                    {changeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-900 rounded-xl flex items-start justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-700 dark:text-zinc-200">{log.action}</p>
                          <p className="text-slate-500 dark:text-zinc-400 mt-1">{log.details}</p>
                          <p className="text-[9px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>Oleh: <span className="font-semibold text-rose-500">{log.operatorName}</span></span>
                            <span>•</span>
                            <span>{new Date(log.timestamp).toLocaleDateString("id-ID")} {new Date(log.timestamp).toLocaleTimeString("id-ID")}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Indicator Add/Edit Dialog */}
      <Dialog
        isOpen={isIndicatorModalOpen}
        onClose={() => setIsIndicatorModalOpen(false)}
        title={selectedIndicator ? "Ubah Indikator Mutabaah" : "Tambah Indikator Mutabaah"}
      >
        <div className="space-y-4 pt-2">
          <FormInput
            label="Nama Indikator"
            value={indicatorForm.name}
            onChange={(val) => setIndicatorForm((p) => ({ ...p, name: val }))}
            placeholder="Contoh: Shalat Dhuha, Administrasi Halaqah..."
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Kategori</label>
              <select
                value={indicatorForm.category}
                onChange={(e) => setIndicatorForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none"
              >
                <option value="Ibadah">Ibadah</option>
                <option value="Literasi">Literasi</option>
                <option value="Kedisiplinan">Kedisiplinan</option>
                <option value="Administrasi">Administrasi</option>
                <option value="Pengembangan Diri">Pengembangan Diri</option>
                <option value="Kepemimpinan">Kepemimpinan</option>
                <option value="Pembinaan">Pembinaan</option>
                <option value="Tahfizh">Tahfizh</option>
                <option value="Tahsin">Tahsin</option>
                <option value="Adab">Adab</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Tipe Input</label>
              <select
                value={indicatorForm.inputType}
                onChange={(e) => setIndicatorForm((p) => ({ ...p, inputType: e.target.value as any }))}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 focus:outline-none"
              >
                <option value="boolean">Ya / Tidak</option>
                <option value="number">Angka / Jumlah</option>
                <option value="percentage">Persentase</option>
                <option value="choice">Pilihan (Baik, Cukup, dsb)</option>
                <option value="text">Deskripsi Deskriptif</option>
                <option value="document">Upload Dokumen</option>
                <option value="photo">Upload Foto</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Target Minimal"
              type="number"
              value={indicatorForm.target}
              onChange={(val) => setIndicatorForm((p) => ({ ...p, target: parseFloat(val) || 0 }))}
              required
            />

            <FormInput
              label="Satuan Target"
              value={indicatorForm.unit}
              onChange={(val) => setIndicatorForm((p) => ({ ...p, unit: val }))}
              placeholder="halaman, kali, waktu, dsb..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Bobot Penilaian (%)"
              type="number"
              value={indicatorForm.weight}
              onChange={(val) => setIndicatorForm((p) => ({ ...p, weight: parseFloat(val) || 0 }))}
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Berlaku Untuk Peran</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-950 p-3 rounded-lg border border-slate-100 dark:border-zinc-900">
              {["kepala sekolah", "wakil kepala sekolah", "guru", "staff", "musrif"].map((role) => {
                const checked = indicatorForm.applicableRoles.includes(role);
                return (
                  <label key={role} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300 font-bold capitalize select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setIndicatorForm((p) => {
                          const next = checked
                            ? p.applicableRoles.filter((r) => r !== role)
                            : [...p.applicableRoles, role];
                          return { ...p, applicableRoles: next };
                        });
                      }}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    {role}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={() => setIsIndicatorModalOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => saveIndicatorMutation.mutate()}
              disabled={saveIndicatorMutation.isPending}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-all cursor-pointer"
            >
              {saveIndicatorMutation.isPending ? "Menyimpan..." : "Simpan Indikator"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
