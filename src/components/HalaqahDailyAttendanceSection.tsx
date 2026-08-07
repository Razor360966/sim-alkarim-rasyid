import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { 
  teacherHalaqahAttendanceService, 
  getTodayDateStr, 
  getIndonesianDayName 
} from "../services/teacherHalaqahAttendance.service";
import { halaqahGroupService } from "../services/halaqahGroupService";
import { teacherService } from "../services/teacherService";
import { Loading } from "./Loading";
import { Dialog } from "./Dialog";
import { HalaqahGroupQrCardsModal } from "./HalaqahGroupQrCardsModal";
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  UserX, 
  Users, 
  QrCode, 
  UserCheck, 
  RefreshCw, 
  Sparkles, 
  Edit3, 
  Printer, 
  ChevronRight, 
  Info,
  CalendarDays,
  ShieldCheck,
  Check
} from "lucide-react";

interface Props {
  selectedAyId: string;
  selectedSemesterId: string;
}

export const HalaqahDailyAttendanceSection: React.FC<Props> = ({
  selectedAyId,
  selectedSemesterId
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Modals
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [manualModal, setManualModal] = useState<{
    isOpen: boolean;
    group?: any;
    checkInTime?: string;
    checkOutTime?: string;
    status?: string;
    teacherId?: string;
    teacherName?: string;
  }>({ isOpen: false });

  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const isWakakurOrAdmin = user && (
    user.role === "admin" || 
    user.role === "wakil kepala sekolah" || 
    user.role === "kepala sekolah" ||
    user.role === "pimpinan" ||
    user.role === "ketua yayasan" ||
    user.role === "operator" ||
    (user.roles && (
      user.roles.includes("admin") || 
      user.roles.includes("wakil kepala sekolah") || 
      user.roles.includes("kepala sekolah") || 
      user.roles.includes("pimpinan") || 
      user.roles.includes("ketua yayasan") || 
      user.roles.includes("wakakur")
    ))
  );

  // Query Daily Overview Data
  const { data: overview, isLoading, refetch } = useQuery({
    queryKey: ["halaqahDailyOverview", selectedDate, selectedAyId, selectedSemesterId],
    queryFn: () => teacherHalaqahAttendanceService.getDailyHalaqahOverview(selectedDate, selectedAyId, selectedSemesterId),
    refetchInterval: 15000 // Realtime updates every 15s
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["teachersList"],
    queryFn: () => teacherService.getTeachers()
  });

  // Manual Attendance Mutation
  const saveManualMutation = useMutation({
    mutationFn: (data: {
      groupId: string;
      groupName: string;
      teacherId: string;
      teacherName: string;
      date: string;
      checkInTime: string;
      checkOutTime?: string;
      status?: string;
    }) => teacherHalaqahAttendanceService.recordManualAttendance({
      ...data,
      academicYearId: selectedAyId,
      semesterId: selectedSemesterId
    }),
    onSuccess: () => {
      showToast("Absensi manual berhasil disimpan", "success");
      queryClient.invalidateQueries({ queryKey: ["halaqahDailyOverview"] });
      queryClient.invalidateQueries({ queryKey: ["halaqahAttendanceRecap"] });
      setManualModal({ isOpen: false });
    },
    onError: (err: any) => {
      showToast(`Gagal menyimpan: ${err?.message || "Kesalahan sistem"}`, "error");
    }
  });

  const dayName = getIndonesianDayName(selectedDate);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-bounce ${
          toastMessage.type === "success"
            ? "bg-emerald-900 text-white border-emerald-700"
            : "bg-rose-900 text-white border-rose-700"
        }`}>
          {toastMessage.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-rose-400" />}
          <span className="text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* Header Controls & Date Selector */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60">
                <BookOpen className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
                  Absensi Harian Guru Halaqoh Qur'an
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitoring & Pencatatan Check-in / Check-out Pembimbing Halaqah
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-zinc-700">
              <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden cursor-pointer"
              />
              {selectedDate !== todayStr && (
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-500 cursor-pointer"
                >
                  Hari Ini
                </button>
              )}
            </div>

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-bold rounded-2xl flex items-center gap-2 transition-all cursor-pointer border border-slate-200 dark:border-zinc-700"
            >
              <Printer className="w-4 h-4 text-emerald-500" />
              <span>Cetak QR Group</span>
            </button>

            <button
              onClick={() => refetch()}
              className="p-2.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 rounded-2xl transition-colors cursor-pointer border border-slate-200 dark:border-zinc-700"
              title="Segarkan Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Daily Schedule Banner (SSOT from School Agendas) */}
        {overview && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            overview.isLibur 
              ? "bg-slate-50 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
              : "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                overview.isLibur ? "bg-slate-200 dark:bg-zinc-800" : "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
              }`}>
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm">
                    {dayName}, {selectedDate}
                  </span>
                  <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                    overview.isLibur
                      ? "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border-slate-300"
                      : "bg-emerald-600 text-white border-emerald-500"
                  }`}>
                    {overview.isLibur ? "Hari Libur Sekolah" : "Hari Sekolah Aktif"}
                  </span>
                </div>
                <p className="text-xs opacity-80 mt-0.5">
                  Agenda Sekolah: <strong className="font-bold">{overview.agendaName}</strong> | Jadwal Resmi: <strong className="font-bold">{overview.startTime} – {overview.endTime} WIB</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold opacity-75">Status Sesi:</span>
              <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
                overview.sessionStatus === "Sedang Berlangsung"
                  ? "bg-emerald-500 text-white border-emerald-400 animate-pulse shadow-xs"
                  : overview.sessionStatus === "Selesai"
                  ? "bg-blue-600 text-white border-blue-500"
                  : overview.sessionStatus === "Libur Sekolah"
                  ? "bg-slate-300 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-400"
                  : "bg-amber-500 text-white border-amber-400"
              }`}>
                {overview.sessionStatus}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <Loading message="Memuat status absensi halaqah harian..." />
      ) : (
        /* Grid of All 4 Master Halaqah Groups */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {overview?.groups.map((group) => {
            const isAssignedToUser = user && (
              group.musrifId === user.uid ||
              group.musrifId === user.id ||
              group.musrifId === user.teacherId ||
              (group.musrifName && group.musrifName.toLowerCase().trim() === (user.displayName || user.name || "").toLowerCase().trim())
            );

            const canManage = isWakakurOrAdmin || isAssignedToUser;

            return (
              <div
                key={group.groupId}
                className={`bg-white dark:bg-zinc-900 border rounded-3xl p-6 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4 ${
                  group.checkOutTime !== "-"
                    ? "border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/10 dark:bg-emerald-950/10"
                    : group.checkInTime !== "-"
                    ? "border-blue-200 dark:border-blue-900/40 bg-blue-50/10 dark:bg-blue-950/10"
                    : "border-slate-200 dark:border-zinc-800"
                }`}
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-zinc-850 pb-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base text-slate-850 dark:text-white">
                          {group.groupName}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-[10px] rounded-lg uppercase">
                          {group.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Pembimbing: <strong className="text-slate-700 dark:text-zinc-200">{group.musrifName}</strong></span>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                      group.status === "Selesai Membimbing"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        : group.status === "Sedang Membimbing"
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 animate-pulse"
                        : group.status === "Tidak Hadir"
                        ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                        : group.status === "Libur"
                        ? "bg-slate-100 dark:bg-zinc-800 text-slate-500 border-slate-200 dark:border-zinc-700"
                        : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                    }`}>
                      {group.status === "Selesai Membimbing" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {group.status === "Sedang Membimbing" && <Clock className="w-3.5 h-3.5 text-blue-500" />}
                      {group.status === "Tidak Hadir" && <UserX className="w-3.5 h-3.5 text-rose-500" />}
                      <span>{group.status}</span>
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div className="bg-slate-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Jadwal & Ruangan
                      </span>
                      <div className="font-bold text-slate-700 dark:text-zinc-200">
                        {group.startTime} – {group.endTime} WIB
                      </div>
                      <p className="text-[10px] text-slate-400">{group.room}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-zinc-950/60 p-3 rounded-2xl border border-slate-100 dark:border-zinc-850 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Waktu Check-In
                      </span>
                      <div className={`font-bold ${group.checkInTime !== "-" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                        {group.checkInTime !== "-" ? `${group.checkInTime} WIB` : "Belum Scan"}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Check-Out: {group.checkOutTime !== "-" ? `${group.checkOutTime} WIB` : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-400">
                    {group.duration > 0 ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Durasi: {group.duration} Menit
                      </span>
                    ) : (
                      <span>Halaqoh Qur'an Agenda</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Manual Action Button for Admin / Musrif */}
                    {canManage && (
                      <button
                        onClick={() => setManualModal({
                          isOpen: true,
                          group,
                          checkInTime: group.checkInTime !== "-" ? group.checkInTime : "07:10",
                          checkOutTime: group.checkOutTime !== "-" ? group.checkOutTime : "08:20",
                          status: group.status !== "Belum Check-in" ? group.status : "Hadir",
                          teacherId: group.musrifId,
                          teacherName: group.musrifName
                        })}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 dark:border-zinc-700"
                        title="Input / Edit Absensi Manual"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Input Manual</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CETAK QR GROUP HALAQAH */}
      {isQrModalOpen && (
        <HalaqahGroupQrCardsModal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
        />
      )}

      {/* MODAL INPUT MANUAL ABSENSI HALAQAH */}
      {manualModal.isOpen && manualModal.group && (
        <Dialog
          isOpen={manualModal.isOpen}
          onClose={() => setManualModal({ isOpen: false })}
          title={`Input Absensi Manual - ${manualModal.group.groupName}`}
          size="md"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualModal.teacherId) {
                showToast("Pilih Pembimbing terlebih dahulu", "error");
                return;
              }
              saveManualMutation.mutate({
                groupId: manualModal.group.groupId,
                groupName: manualModal.group.groupName,
                teacherId: manualModal.teacherId,
                teacherName: manualModal.teacherName || "Ustadz Pembimbing",
                date: selectedDate,
                checkInTime: manualModal.checkInTime || "07:10",
                checkOutTime: manualModal.checkOutTime || "",
                status: manualModal.status || "Hadir"
              });
            }}
            className="space-y-4"
          >
            <div className="bg-slate-50 dark:bg-zinc-800 p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-700 space-y-1 text-xs">
              <div className="font-extrabold text-slate-800 dark:text-white">
                {manualModal.group.groupName}
              </div>
              <p className="text-slate-500 dark:text-zinc-400">
                Tanggal: <strong>{selectedDate} ({dayName})</strong> | Agenda: <strong>Halaqoh Qur'an</strong>
              </p>
            </div>

            {/* Teacher Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Guru Pembimbing / Musrif
              </label>
              <select
                value={manualModal.teacherId || ""}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const found = teachers.find(t => t.id === selectedId || (t as any).userId === selectedId);
                  setManualModal(prev => ({
                    ...prev,
                    teacherId: selectedId,
                    teacherName: found?.name || prev.group?.musrifName || "Ustadz Pembimbing"
                  }));
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-hidden"
              >
                <option value={manualModal.group.musrifId}>
                  {manualModal.group.musrifName} (Pembimbing Resmi)
                </option>
                {teachers.filter(t => t.id !== manualModal.group.musrifId).map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Check-In & Check-Out Times */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Jam Check-In
                </label>
                <input
                  type="time"
                  value={manualModal.checkInTime || "07:10"}
                  onChange={(e) => setManualModal(prev => ({ ...prev, checkInTime: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                  Jam Check-Out (Opsional)
                </label>
                <input
                  type="time"
                  value={manualModal.checkOutTime || ""}
                  onChange={(e) => setManualModal(prev => ({ ...prev, checkOutTime: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Status Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">
                Status Kehadiran
              </label>
              <select
                value={manualModal.status || "Hadir"}
                onChange={(e) => setManualModal(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-slate-800 dark:text-zinc-100"
              >
                <option value="Hadir">Hadir (Tepat Waktu)</option>
                <option value="Terlambat">Terlambat</option>
                <option value="Selesai Membimbing">Selesai Membimbing</option>
                <option value="Tidak Hadir">Tidak Hadir</option>
                <option value="Izin / Sakit">Izin / Sakit</option>
              </select>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setManualModal({ isOpen: false })}
                className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saveManualMutation.isPending}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {saveManualMutation.isPending ? "Menyimpan..." : "Simpan Absensi"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};
