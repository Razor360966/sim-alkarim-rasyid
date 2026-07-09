import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Dialog } from "../components/Dialog";
import { DataTable, Column } from "../components/DataTable";
import { Loading } from "../components/Loading";
import { FormInput, FormSelect, FormTextarea } from "../components/FormInput";
import { academicYearService } from "../services/academicYear.service";
import { semesterService } from "../services/semester.service";
import { studentService } from "../services/studentService";
import { classService } from "../services/classService";
import { halaqahGroupService } from "../services/halaqahGroupService";
import { musrifJournalService } from "../services/musrifJournalService";
import { 
  HalaqahGroup, 
  HalaqahGroupMember, 
  MusrifJournal, 
  MusrifJournalDetail, 
  Student, 
  Class 
} from "../types";
import { 
  Users, 
  BookOpen, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  Check, 
  X, 
  Search, 
  MapPin, 
  FileText, 
  Clock, 
  Award, 
  Book, 
  ExternalLink,
  ChevronRight,
  UserPlus,
  HelpCircle,
  Calendar,
  Layers
} from "lucide-react";

export const MusrifJournals: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isMusrif = user?.role === "musrif" || user?.role === "guru";
  const isAdmin = user?.role === "admin";

  // Active Year & Semester Queries
  const { data: activeYear } = useQuery({
    queryKey: ["activeAcademicYear"],
    queryFn: () => academicYearService.getActiveAcademicYear()
  });

  const { data: activeSemester } = useQuery({
    queryKey: ["activeSemester"],
    queryFn: () => semesterService.getActiveSemester()
  });

  // Load all students
  const { data: studentsList = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: () => studentService.getStudents()
  });

  // Load all classes (for caching class names if needed)
  const { data: classesList = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => classService.getClasses()
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<"kelompok" | "jurnal">("kelompok");

  // --- TAB 1: KELOMPOK HALAQAH STATE ---
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<HalaqahGroup | null>(null);

  const [groupForm, setGroupForm] = useState({
    groupName: "",
    location: "",
    description: ""
  });

  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Query groups
  const { data: halaqahGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ["halaqahGroups", user?.userId],
    queryFn: () => {
      // Admin gets all groups, Musrif gets their own groups
      if (isMusrif && !isAdmin) {
        return halaqahGroupService.getGroups(user?.userId || "");
      }
      return halaqahGroupService.getGroups();
    }
  });

  // Query members of currently selected group
  const { data: groupMembers = [], isLoading: isLoadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ["groupMembers", selectedGroup?.id],
    queryFn: () => {
      if (!selectedGroup?.id) return [];
      return halaqahGroupService.getMembers(selectedGroup.id);
    },
    enabled: !!selectedGroup?.id
  });

  // --- TAB 2: JURNAL HALAQAH STATE ---
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [isJournalDetailOpen, setIsJournalDetailOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<MusrifJournal | null>(null);
  const [selectedJournalDetails, setSelectedJournalDetails] = useState<MusrifJournalDetail[]>([]);

  // Filtering Jurnal
  const [filterDate, setFilterDate] = useState("");
  const [filterGroup, setFilterGroup] = useState("Semua");
  const [filterStatus, setFilterStatus] = useState("Semua");

  // Journal form fields
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split("T")[0]);
  const [journalGroup, setJournalGroup] = useState("");
  const [journalStartTime, setJournalStartTime] = useState("16:00");
  const [journalEndTime, setJournalEndTime] = useState("17:30");
  const [journalActivityType, setJournalActivityType] = useState<MusrifJournal["activityType"]>("Tahfidz");
  const [journalGeneralNotes, setJournalGeneralNotes] = useState("");
  const [journalSupportingLink, setJournalSupportingLink] = useState("");
  const [journalStatus, setJournalStatus] = useState<"Draft" | "Selesai">("Draft");

  // Student progress details in journal form
  const [studentJournalInputs, setStudentJournalInputs] = useState<Record<string, {
    attendance: "Hadir" | "Sakit" | "Izin" | "Alpha";
    memorizationTarget: string;
    memorizationAchievement: string;
    tajwid: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
    makhraj: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
    fluency: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
    behavior: "Sangat Baik" | "Baik" | "Cukup" | "Perlu Bimbingan";
    notes: string;
    followUp: string;
  }>>({});

  // Query journals list
  const { data: musrifJournals = [], isLoading: isLoadingJournals } = useQuery({
    queryKey: ["musrifJournals", activeYear?.id, activeSemester?.id, user?.userId],
    queryFn: () => {
      if (isMusrif && !isAdmin) {
        return musrifJournalService.getByMusrif(user?.userId || "", activeYear?.id, activeSemester?.id);
      }
      return musrifJournalService.getAll(activeYear?.id, activeSemester?.id);
    },
    enabled: !!activeYear?.id && !!activeSemester?.id
  });

  // Filter journals list on client
  const filteredJournals = useMemo(() => {
    return musrifJournals.filter((j) => {
      const matchDate = !filterDate || j.date === filterDate;
      const matchGroup = filterGroup === "Semua" || j.groupId === filterGroup;
      const matchStatus = filterStatus === "Semua" || j.status === filterStatus;
      return matchDate && matchGroup && matchStatus;
    });
  }, [musrifJournals, filterDate, filterGroup, filterStatus]);

  // --- MUTATIONS: TAB 1 ---
  const createGroupMutation = useMutation({
    mutationFn: (newGroup: Omit<HalaqahGroup, "id" | "createdAt" | "updatedAt">) => 
      halaqahGroupService.createGroup(newGroup),
    onSuccess: () => {
      toast("Kelompok Halaqah berhasil dibuat!", "success");
      queryClient.invalidateQueries({ queryKey: ["halaqahGroups"] });
      setIsGroupModalOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal membuat kelompok: " + err.message, "error");
    }
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<HalaqahGroup> }) => 
      halaqahGroupService.updateGroup(id, data),
    onSuccess: () => {
      toast("Kelompok Halaqah berhasil diperbarui!", "success");
      queryClient.invalidateQueries({ queryKey: ["halaqahGroups"] });
      setIsGroupModalOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal memperbarui kelompok: " + err.message, "error");
    }
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => halaqahGroupService.deleteGroup(id),
    onSuccess: () => {
      toast("Kelompok Halaqah berhasil dihapus!", "success");
      queryClient.invalidateQueries({ queryKey: ["halaqahGroups"] });
    },
    onError: (err: any) => {
      toast("Gagal menghapus kelompok: " + err.message, "error");
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: (member: Omit<HalaqahGroupMember, "id" | "createdAt" | "updatedAt">) => 
      halaqahGroupService.addMember(member),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groupMembers"] });
    },
    onError: (err: any) => {
      toast("Gagal menambahkan santri: " + err.message, "error");
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => halaqahGroupService.removeMember(memberId),
    onSuccess: () => {
      toast("Santri berhasil dikeluarkan dari kelompok!", "success");
      queryClient.invalidateQueries({ queryKey: ["groupMembers"] });
    },
    onError: (err: any) => {
      toast("Gagal mengeluarkan santri: " + err.message, "error");
    }
  });

  // --- MUTATIONS: TAB 2 ---
  const createJournalMutation = useMutation({
    mutationFn: ({ journal, details }: { 
      journal: Omit<MusrifJournal, "id" | "createdAt" | "updatedAt">;
      details: Omit<MusrifJournalDetail, "id" | "journalId" | "createdAt" | "updatedAt">[];
    }) => musrifJournalService.create(journal, details),
    onSuccess: () => {
      toast("Jurnal Halaqah berhasil disimpan!", "success");
      queryClient.invalidateQueries({ queryKey: ["musrifJournals"] });
      setIsJournalModalOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal menyimpan jurnal: " + err.message, "error");
    }
  });

  const updateJournalMutation = useMutation({
    mutationFn: ({ id, journal, details }: { 
      id: string;
      journal: Partial<MusrifJournal>;
      details: (Omit<MusrifJournalDetail, "id" | "journalId" | "createdAt" | "updatedAt"> & { studentId: string })[];
    }) => musrifJournalService.update(id, journal, details),
    onSuccess: () => {
      toast("Jurnal Halaqah berhasil diperbarui!", "success");
      queryClient.invalidateQueries({ queryKey: ["musrifJournals"] });
      setIsJournalModalOpen(false);
    },
    onError: (err: any) => {
      toast("Gagal memperbarui jurnal: " + err.message, "error");
    }
  });

  const deleteJournalMutation = useMutation({
    mutationFn: (id: string) => musrifJournalService.delete(id),
    onSuccess: () => {
      toast("Jurnal Halaqah berhasil dihapus!", "success");
      queryClient.invalidateQueries({ queryKey: ["musrifJournals"] });
    },
    onError: (err: any) => {
      toast("Gagal menghapus jurnal: " + err.message, "error");
    }
  });

  // --- GROUP MEMBERSHIP SELECTION HELPERS ---
  const filteredStudentsForAdding = useMemo(() => {
    // Exclude students who are already members
    const existingMemberIds = groupMembers.map((m) => m.studentId);
    return studentsList.filter((s) => {
      if (existingMemberIds.includes(s.id)) return false;
      const matchSearch = s.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                          s.nis.includes(memberSearchQuery);
      const matchClass = classFilter === "Semua" || s.classId === classFilter;
      return matchSearch && matchClass;
    });
  }, [studentsList, groupMembers, memberSearchQuery, classFilter]);

  // Handle adding checked students
  const handleAddMembersSubmit = async () => {
    if (!selectedGroup) return;
    if (selectedStudentIds.length === 0) {
      toast("Pilih minimal satu santri!", "error");
      return;
    }

    try {
      const promises = selectedStudentIds.map((studentId) => {
        const student = studentsList.find((s) => s.id === studentId);
        return addMemberMutation.mutateAsync({
          groupId: selectedGroup.id,
          studentId,
          studentName: student?.name || "Santri",
          classId: student?.classId || "",
          className: student?.className || "Tanpa Kelas"
        });
      });

      await Promise.all(promises);
      toast(`Berhasil menambahkan ${selectedStudentIds.length} santri ke kelompok ${selectedGroup.groupName}!`, "success");
      setSelectedStudentIds([]);
      setIsAddMemberModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // --- AUTO FILL MEMBERS FOR NEW JOURNAL ---
  useEffect(() => {
    if (!journalGroup) return;

    const fetchAndSetMembersInputs = async () => {
      try {
        const members = await halaqahGroupService.getMembers(journalGroup);
        const inputs: Record<string, any> = {};
        
        // If editing, merge. Else write defaults.
        members.forEach((m) => {
          inputs[m.studentId] = {
            attendance: "Hadir",
            memorizationTarget: "QS ",
            memorizationAchievement: "Lancar",
            tajwid: "Baik",
            makhraj: "Baik",
            fluency: "Baik",
            behavior: "Baik",
            notes: "",
            followUp: ""
          };
        });
        setStudentJournalInputs(inputs);
      } catch (err) {
        console.error("Gagal memuat anggota kelompok untuk jurnal:", err);
      }
    };

    if (!selectedJournal) {
      fetchAndSetMembersInputs();
    }
  }, [journalGroup, selectedJournal]);

  // --- SUBMIT JOURNAL ---
  const handleJournalSubmit = () => {
    if (!journalGroup) {
      toast("Pilih Kelompok Halaqah terlebih dahulu!", "error");
      return;
    }

    const group = halaqahGroups.find((g) => g.id === journalGroup);
    if (!group) {
      toast("Kelompok Halaqah tidak valid!", "error");
      return;
    }

    // Validation: Musrif tidak boleh membuat dua jurnal pada Tanggal, Jam, Kelompok yang sama
    const duplicate = musrifJournals.find((j) => 
      j.id !== selectedJournal?.id &&
      j.date === journalDate &&
      j.groupId === journalGroup &&
      j.startTime === journalStartTime &&
      j.endTime === journalEndTime
    );

    if (duplicate) {
      toast(`Jurnal untuk kelompok ${group.groupName} pada tanggal ${journalDate} jam ${journalStartTime}-${journalEndTime} sudah ada!`, "error");
      return;
    }

    const daysIndonesian = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dayName = daysIndonesian[new Date(journalDate).getDay()];

    const journalHeader = {
      musrifId: user?.userId || "musrif-system",
      musrifName: user?.displayName || user?.name || "Musrif",
      academicYearId: activeYear?.id || "",
      academicYearName: activeYear?.year || "",
      semesterId: activeSemester?.id || "",
      semesterName: activeSemester?.name || "",
      groupId: journalGroup,
      groupName: group.groupName,
      date: journalDate,
      dayName,
      startTime: journalStartTime,
      endTime: journalEndTime,
      activityType: journalActivityType,
      generalNotes: journalGeneralNotes,
      supportingLink: journalSupportingLink,
      status: journalStatus,
      createdBy: user?.userId || "system",
      updatedBy: user?.userId || "system"
    };

    const detailsPayload = Object.entries(studentJournalInputs).map(([studentId, inputs]) => {
      const student = studentsList.find((s) => s.id === studentId);
      return {
        studentId,
        studentName: student?.name || "Santri",
        ...(inputs as any)
      };
    });

    if (selectedJournal) {
      updateJournalMutation.mutate({
        id: selectedJournal.id,
        journal: {
          ...journalHeader,
          updatedBy: user?.userId || "system"
        } as any,
        details: detailsPayload as any
      });
    } else {
      createJournalMutation.mutate({
        journal: journalHeader as any,
        details: detailsPayload as any
      });
    }
  };

  // --- LOAD JOURNAL FOR EDIT ---
  const handleEditJournalOpen = async (journal: MusrifJournal) => {
    setSelectedJournal(journal);
    setJournalDate(journal.date);
    setJournalGroup(journal.groupId);
    setJournalStartTime(journal.startTime);
    setJournalEndTime(journal.endTime);
    setJournalActivityType(journal.activityType);
    setJournalGeneralNotes(journal.generalNotes);
    setJournalSupportingLink(journal.supportingLink);
    setJournalStatus(journal.status);

    try {
      const dbDetails = await musrifJournalService.getJournalDetails(journal.id);
      const inputs: Record<string, any> = {};
      dbDetails.forEach((d) => {
        inputs[d.studentId] = {
          attendance: d.attendance,
          memorizationTarget: d.memorizationTarget,
          memorizationAchievement: d.memorizationAchievement,
          tajwid: d.tajwid,
          makhraj: d.makhraj,
          fluency: d.fluency,
          behavior: d.behavior,
          notes: d.notes,
          followUp: d.followUp
        };
      });
      setStudentJournalInputs(inputs);
      setIsJournalModalOpen(true);
    } catch (err) {
      toast("Gagal memuat detail jurnal untuk diedit!", "error");
    }
  };

  // --- VIEW JOURNAL DETAILS (READONLY) ---
  const handleViewJournalDetail = async (journal: MusrifJournal) => {
    setSelectedJournal(journal);
    try {
      const details = await musrifJournalService.getJournalDetails(journal.id);
      setSelectedJournalDetails(details);
      setIsJournalDetailOpen(true);
    } catch (err) {
      toast("Gagal memuat detail perkembangan santri!", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Jurnal Musrif Halaqah</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">Pencatatan kegiatan halaqah Al-Qur'an, tahfidz, tahsin, serta rekap perkembangan harian santri.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab("kelompok")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
            activeTab === "kelompok"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
          }`}
        >
          <Users className="h-4.5 w-4.5" />
          Kelompok Halaqah
        </button>
        <button
          onClick={() => setActiveTab("jurnal")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer ${
            activeTab === "jurnal"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
          }`}
        >
          <BookOpen className="h-4.5 w-4.5" />
          Jurnal Halaqah
        </button>
      </div>

      {/* --- TAB 1: KELOMPOK HALAQAH --- */}
      {activeTab === "kelompok" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-blue-500" />
              Daftar Kelompok Halaqah Anda ({halaqahGroups.length})
            </h3>
            {isMusrif && (
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setGroupForm({ groupName: "", location: "", description: "" });
                  setIsGroupModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md shadow-blue-500/15 cursor-pointer transition-all hover:scale-[1.01]"
              >
                <Plus className="h-4.5 w-4.5" />
                Buat Kelompok Baru
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {halaqahGroups.map((group) => (
              <div key={group.id} className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-bold text-xs rounded-lg">
                      Kelompok
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Musrif: {group.musrifName}
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{group.groupName}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{group.location || "Lokasi belum diatur"}</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{group.description || "Tidak ada deskripsi kelompok."}</p>
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedGroup(group);
                      setIsMembersModalOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                  >
                    <Users className="h-4 w-4" />
                    Kelola Santri
                  </button>

                  <div className="flex items-center gap-1">
                    {isMusrif && (
                      <button
                        onClick={() => {
                          setSelectedGroup(group);
                          setGroupForm({
                            groupName: group.groupName,
                            location: group.location,
                            description: group.description
                          });
                          setIsGroupModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                        title="Edit Kelompok"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}

                    {isMusrif && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Yakin ingin menghapus kelompok halaqah "${group.groupName}"?`)) {
                            deleteGroupMutation.mutate(group.id);
                          }
                        }}
                        className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                        title="Hapus Kelompok"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {halaqahGroups.length === 0 && (
              <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-zinc-900/30 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-slate-700 dark:text-zinc-300">Belum Ada Kelompok Halaqah</h4>
                <p className="text-xs text-slate-400 mt-1">Silakan klik tombol "Buat Kelompok Baru" di kanan atas untuk membuat kelompok Anda sendiri.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB 2: JURNAL HALAQAH --- */}
      {activeTab === "jurnal" && (
        <div className="space-y-6">
          {/* Filters card */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Calendar className="h-4.5 w-4.5 text-blue-500" />
                Filter Jurnal Halaqah
              </span>
              {isMusrif && (
                <button
                  onClick={() => {
                    setSelectedJournal(null);
                    setJournalDate(new Date().toISOString().split("T")[0]);
                    setJournalGroup(halaqahGroups[0]?.id || "");
                    setJournalStartTime("16:00");
                    setJournalEndTime("17:30");
                    setJournalActivityType("Tahfidz");
                    setJournalGeneralNotes("");
                    setJournalSupportingLink("");
                    setJournalStatus("Draft");
                    setStudentJournalInputs({});
                    setIsJournalModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-md cursor-pointer"
                >
                  <Plus className="h-4.5 w-4.5" />
                  Buat Jurnal Halaqah
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormInput
                type="date"
                label="Tanggal"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
              <FormSelect
                label="Kelompok Halaqah"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                options={[
                  { value: "Semua", label: "Semua Kelompok" },
                  ...halaqahGroups.map((g) => ({ value: g.id, label: g.groupName }))
                ]}
              />
              <FormSelect
                label="Status Jurnal"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: "Semua", label: "Semua Status" },
                  { value: "Draft", label: "Draft" },
                  { value: "Selesai", label: "Selesai" }
                ]}
              />
            </div>
          </div>

          {/* Jurnal Table */}
          <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Daftar Rekap Jurnal Halaqah</h3>
            <DataTable
              data={filteredJournals}
              rowKey={(j) => j.id}
              searchKeys={["groupName", "musrifName", "activityType"]}
              searchPlaceholder="Cari berdasarkan kelompok, musrif, atau kegiatan..."
              columns={[
                {
                  header: "Tanggal / Hari",
                  accessor: (j: MusrifJournal) => (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 dark:text-zinc-200">
                        {new Date(j.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      <span className="text-xs text-slate-400 font-semibold">{j.dayName}</span>
                    </div>
                  ),
                  sortable: true,
                  sortKey: "date" as keyof MusrifJournal
                },
                ...(!isMusrif || isAdmin ? [{
                  header: "Musrif",
                  accessor: (j: MusrifJournal) => j.musrifName,
                  sortable: true
                }] : []),
                {
                  header: "Kelompok",
                  accessor: (j: MusrifJournal) => j.groupName,
                  sortable: true
                },
                {
                  header: "Waktu",
                  accessor: (j: MusrifJournal) => `${j.startTime} - ${j.endTime}`,
                },
                {
                  header: "Aktivitas",
                  accessor: (j: MusrifJournal) => {
                    const activityStyles = {
                      Tahsin: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
                      Tahfidz: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
                      "Muraja'ah": "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
                      "Setoran Hafalan": "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
                      "Tasmi": "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
                      "Pembinaan Akhlak": "bg-pink-100 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300",
                      Pendampingan: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300",
                      Lainnya: "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-300"
                    };
                    return (
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-xl ${activityStyles[j.activityType] || ""}`}>
                        {j.activityType}
                      </span>
                    );
                  },
                  sortable: true
                },
                {
                  header: "Status",
                  accessor: (j: MusrifJournal) => (
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-xl ${
                      j.status === "Selesai"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}>
                      {j.status}
                    </span>
                  )
                }
              ]}
              actions={(j: MusrifJournal) => (
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleViewJournalDetail(j)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-950 rounded-lg cursor-pointer"
                    title="Lihat Detail Jurnal"
                  >
                    <Eye className="h-4.5 w-4.5" />
                  </button>

                  {(j.status === "Draft" || isAdmin) && (
                    <button
                      onClick={() => handleEditJournalOpen(j)}
                      className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-500 hover:text-blue-700 rounded-lg cursor-pointer"
                      title="Edit Jurnal"
                    >
                      <Edit2 className="h-4.5 w-4.5" />
                    </button>
                  )}

                  {j.status === "Draft" && (
                    <button
                      onClick={() => {
                        if (window.confirm("Yakin ingin menghapus jurnal halaqah ini beserta rekap per santri?")) {
                          deleteJournalMutation.mutate(j.id);
                        }
                      }}
                      className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 hover:text-rose-700 rounded-lg cursor-pointer"
                      title="Hapus Jurnal"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  )}
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* --- DIALOG MODALS: TAB 1 KELOMPOK HALAQAH --- */}
      {/* Create / Edit Group Dialog */}
      <Dialog
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        title={selectedGroup ? "Perbarui Kelompok Halaqah" : "Buat Kelompok Halaqah Baru"}
        size="md"
      >
        <div className="space-y-4">
          <FormInput
            type="text"
            label="Nama Kelompok Halaqah"
            value={groupForm.groupName}
            onChange={(e) => setGroupForm(prev => ({ ...prev, groupName: e.target.value }))}
            placeholder="Contoh: Halaqah Abu Bakar, Halaqah Ali, dll"
            required
          />
          <FormInput
            type="text"
            label="Lokasi Halaqah"
            value={groupForm.location}
            onChange={(e) => setGroupForm(prev => ({ ...prev, location: e.target.value }))}
            placeholder="Contoh: Masjid Lantai 2, Gazebo Barat, atau Kelas 7A"
            required
          />
          <FormTextarea
            label="Keterangan / Catatan Kelompok"
            value={groupForm.description}
            onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Keterangan opsional kelompok halaqah..."
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={() => setIsGroupModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => {
                if (!groupForm.groupName.trim() || !groupForm.location.trim()) {
                  toast("Nama Kelompok dan Lokasi wajib diisi!", "error");
                  return;
                }
                const payload = {
                  musrifId: user?.userId || "musrif-system",
                  musrifName: user?.displayName || user?.name || "Musrif",
                  groupName: groupForm.groupName,
                  location: groupForm.location,
                  description: groupForm.description,
                  createdBy: user?.userId || "system",
                  updatedBy: user?.userId || "system"
                };

                if (selectedGroup) {
                  updateGroupMutation.mutate({
                    id: selectedGroup.id,
                    data: {
                      ...payload,
                      updatedBy: user?.userId || "system"
                    } as any
                  });
                } else {
                  createGroupMutation.mutate(payload as any);
                }
              }}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md shadow-blue-500/15 cursor-pointer"
            >
              Simpan
            </button>
          </div>
        </div>
      </Dialog>

      {/* Group Members Management Dialog */}
      <Dialog
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        title={`Kelola Santri: ${selectedGroup?.groupName || ""}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Anggota Kelompok Saat Ini ({groupMembers.length} Santri)</span>
            {isMusrif && (
              <button
                onClick={() => {
                  setSelectedStudentIds([]);
                  setMemberSearchQuery("");
                  setClassFilter("Semua");
                  setIsAddMemberModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Tambah Anggota
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800">
            {groupMembers.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{member.studentName}</span>
                  <span className="text-xs text-slate-400 font-semibold mt-0.5">Kelas: {member.className || "Tanpa Kelas"}</span>
                </div>
                {isMusrif && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Keluarkan ${member.studentName} dari kelompok halaqah ini?`)) {
                        removeMemberMutation.mutate(member.id);
                      }
                    }}
                    className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
                    title="Keluarkan Santri"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            {groupMembers.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold">Belum ada santri di kelompok ini. Klik "Tambah Anggota" di atas.</span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={() => setIsMembersModalOpen(false)}
              className="px-5 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer hover:bg-slate-200 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </Dialog>

      {/* Nested Add Member List Dialog (Checkboxes Multi-Select across VII/VIII/IX) */}
      <Dialog
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title="Daftar Master Santri (Siswa Aktif)"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 dark:bg-zinc-800/30 p-4 rounded-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari santri berdasarkan nama / NIS..."
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div className="w-full sm:w-48">
              <FormSelect
                label=""
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                options={[
                  { value: "Semua", label: "Semua Kelas" },
                  ...classesList.map(c => ({ value: c.id, label: c.name }))
                ]}
              />
            </div>
          </div>

          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Hasil Pencarian ({filteredStudentsForAdding.length} Santri Tersedia)</span>

          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredStudentsForAdding.map((student) => {
              const isChecked = selectedStudentIds.includes(student.id);
              return (
                <label
                  key={student.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/20 cursor-pointer select-none transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs sm:text-sm">{student.name}</span>
                    <span className="text-[10px] sm:text-xs text-slate-400 font-semibold mt-0.5">NIS: {student.nis} • Kelas: {student.className || "Tanpa Kelas"}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {
                      if (isChecked) {
                        setSelectedStudentIds(prev => prev.filter(id => id !== student.id));
                      } else {
                        setSelectedStudentIds(prev => [...prev, student.id]);
                      }
                    }}
                    className="h-4.5 w-4.5 text-blue-600 rounded-md border-slate-300 focus:ring-blue-500"
                  />
                </label>
              );
            })}

            {filteredStudentsForAdding.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Search className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <span className="text-xs font-semibold">Tidak menemukan santri yang cocok atau semua sudah masuk kelompok.</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
              {selectedStudentIds.length} Santri Terpilih
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleAddMembersSubmit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md shadow-blue-500/15 cursor-pointer"
              >
                Masukkan ke Halaqah
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* --- DIALOG MODALS: TAB 2 JURNAL HALAQAH --- */}
      {/* Create / Edit Jurnal Halaqah Dialog */}
      <Dialog
        isOpen={isJournalModalOpen}
        onClose={() => setIsJournalModalOpen(false)}
        title={selectedJournal ? "Edit Jurnal Halaqah" : "Tulis Jurnal Halaqah Baru"}
        size="2xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormInput
              type="date"
              label="Tanggal"
              value={journalDate}
              onChange={(e) => setJournalDate(e.target.value)}
              required
            />
            <FormSelect
              label="Kelompok Halaqah"
              value={journalGroup}
              onChange={(e) => setJournalGroup(e.target.value)}
              required
              disabled={!!selectedJournal}
              options={[
                { value: "", label: "-- Pilih Kelompok --" },
                ...halaqahGroups.map((g) => ({ value: g.id, label: g.groupName }))
              ]}
            />
            <FormInput
              type="text"
              label="Jam Mulai"
              value={journalStartTime}
              onChange={(e) => setJournalStartTime(e.target.value)}
              placeholder="16:00"
              required
            />
            <FormInput
              type="text"
              label="Jam Selesai"
              value={journalEndTime}
              onChange={(e) => setJournalEndTime(e.target.value)}
              placeholder="17:30"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Jenis Kegiatan Halaqah"
              value={journalActivityType}
              onChange={(e) => setJournalActivityType(e.target.value as any)}
              required
              options={[
                { value: "Tahsin", label: "Tahsin" },
                { value: "Tahfidz", label: "Tahfidz" },
                { value: "Muraja'ah", label: "Muraja'ah" },
                { value: "Setoran Hafalan", label: "Setoran Hafalan" },
                { value: "Tasmi", label: "Tasmi'" },
                { value: "Pembinaan Akhlak", label: "Pembinaan Akhlak" },
                { value: "Pendampingan", label: "Pendampingan" },
                { value: "Lainnya", label: "Lainnya" }
              ]}
            />
            <FormInput
              type="text"
              label="Bukti Dukung Pembelajaran (Tautan Google Drive/OneDrive/Canva)"
              value={journalSupportingLink}
              onChange={(e) => setJournalSupportingLink(e.target.value)}
              placeholder="Contoh: https://drive.google.com/drive/folders/..."
            />
          </div>

          {/* Student Progress Inputs Section (Multi-Item Grid Table) */}
          {journalGroup && Object.keys(studentJournalInputs).length > 0 && (
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-100 dark:border-zinc-800 pb-2 flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-blue-500" />
                Catatan Perkembangan & Hafalan Per Santri
              </span>

              <div className="max-h-96 overflow-y-auto space-y-6 border border-slate-150 dark:border-zinc-800/80 p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40">
                {Object.entries(studentJournalInputs).map(([studentId, rawInputs]) => {
                  const inputs = rawInputs as any;
                  const student = studentsList.find((s) => s.id === studentId);
                  return (
                    <div key={studentId} className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-4 shadow-xs">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-sm text-slate-800 dark:text-zinc-200">{student?.name || "Santri"}</span>
                          <span className="text-[10px] text-slate-400 font-semibold mt-0.5">NIS: {student?.nis || "-"} • Kelas: {student?.className || "Tanpa Kelas"}</span>
                        </div>
                        <div className="w-28">
                          <FormSelect
                            label=""
                            value={inputs.attendance}
                            onChange={(e) => setStudentJournalInputs(prev => ({
                              ...prev,
                              [studentId]: {
                                ...prev[studentId],
                                attendance: e.target.value as any
                              }
                            }))}
                            options={[
                              { value: "Hadir", label: "Hadir" },
                              { value: "Sakit", label: "Sakit" },
                              { value: "Izin", label: "Izin" },
                              { value: "Alpha", label: "Alpha" }
                            ]}
                          />
                        </div>
                      </div>

                      {inputs.attendance === "Hadir" && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormInput
                              type="text"
                              label="Target Hafalan / Setoran"
                              value={inputs.memorizationTarget}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], memorizationTarget: e.target.value }
                              }))}
                              placeholder="Contoh: QS Al-Mulk 1-10, Halaman 18..."
                            />
                            <FormInput
                              type="text"
                              label="Capaian Hari Ini"
                              value={inputs.memorizationAchievement}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], memorizationAchievement: e.target.value }
                              }))}
                              placeholder="Contoh: Sangat Lancar, Kurang Mengulang..."
                            />
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <FormSelect
                              label="Tajwid"
                              value={inputs.tajwid}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], tajwid: e.target.value as any }
                              }))}
                              options={[
                                { value: "Sangat Baik", label: "Sangat Baik" },
                                { value: "Baik", label: "Baik" },
                                { value: "Cukup", label: "Cukup" },
                                { value: "Perlu Bimbingan", label: "Perlu Bimbingan" }
                              ]}
                            />
                            <FormSelect
                              label="Makhraj"
                              value={inputs.makhraj}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], makhraj: e.target.value as any }
                              }))}
                              options={[
                                { value: "Sangat Baik", label: "Sangat Baik" },
                                { value: "Baik", label: "Baik" },
                                { value: "Cukup", label: "Cukup" },
                                { value: "Perlu Bimbingan", label: "Perlu Bimbingan" }
                              ]}
                            />
                            <FormSelect
                              label="Kelancaran"
                              value={inputs.fluency}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], fluency: e.target.value as any }
                              }))}
                              options={[
                                { value: "Sangat Baik", label: "Sangat Baik" },
                                { value: "Baik", label: "Baik" },
                                { value: "Cukup", label: "Cukup" },
                                { value: "Perlu Bimbingan", label: "Perlu Bimbingan" }
                              ]}
                            />
                            <FormSelect
                              label="Adab"
                              value={inputs.behavior}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], behavior: e.target.value as any }
                              }))}
                              options={[
                                { value: "Sangat Baik", label: "Sangat Baik" },
                                { value: "Baik", label: "Baik" },
                                { value: "Cukup", label: "Cukup" },
                                { value: "Perlu Bimbingan", label: "Perlu Bimbingan" }
                              ]}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormInput
                              type="text"
                              label="Catatan Musrif"
                              value={inputs.notes}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], notes: e.target.value }
                              }))}
                              placeholder="Catatan individu perkembangan membaca..."
                            />
                            <FormInput
                              type="text"
                              label="Tindak Lanjut"
                              value={inputs.followUp}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], followUp: e.target.value }
                              }))}
                              placeholder="Remidial, penugasan di rumah, dll..."
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* General Notes & Status selection */}
          <div className="space-y-4">
            <FormTextarea
              label="Catatan Umum Halaqah (Kendala, Capaian Kelas, Rencana Berikutnya)"
              value={journalGeneralNotes}
              onChange={(e) => setJournalGeneralNotes(e.target.value)}
              placeholder="Contoh: Alhamdulillah KBM berjalan hikmat, 3 santri berhasil mencapai target munaqosyah..."
            />

            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-500 uppercase">PILIH STATUS JURNAL</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none text-slate-700 dark:text-zinc-200">
                  <input
                    type="radio"
                    name="journalStatus"
                    checked={journalStatus === "Draft"}
                    onChange={() => setJournalStatus("Draft")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  Simpan sebagai Draft
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold select-none text-slate-700 dark:text-zinc-200">
                  <input
                    type="radio"
                    name="journalStatus"
                    checked={journalStatus === "Selesai"}
                    onChange={() => setJournalStatus("Selesai")}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  />
                  Selesai & Kunci Jurnal
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <button
              onClick={() => setIsJournalModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleJournalSubmit}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md shadow-blue-500/15 cursor-pointer"
            >
              {selectedJournal ? "Perbarui Jurnal" : "Simpan Jurnal"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Jurnal Halaqah Detail Dialog (Read-only) */}
      <Dialog
        isOpen={isJournalDetailOpen}
        onClose={() => setIsJournalDetailOpen(false)}
        title="Detail Kegiatan Halaqah & Perkembangan Santri"
        size="2xl"
      >
        {selectedJournal && (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="font-semibold text-slate-500 uppercase">Musrif Halaqah</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm block mt-0.5">{selectedJournal.musrifName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase">Kelompok</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm block mt-0.5">{selectedJournal.groupName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase">Tanggal / Hari</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm block mt-0.5">
                  {new Date(selectedJournal.date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ({selectedJournal.dayName})
                </span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 uppercase">Waktu / Aktivitas</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm block mt-0.5">
                  {selectedJournal.startTime} - {selectedJournal.endTime} ({selectedJournal.activityType})
                </span>
              </div>
            </div>

            {/* List of Student entries readonly cards */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Hasil Perkembangan Santri ({selectedJournalDetails.length})</span>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {selectedJournalDetails.map((detail) => (
                  <div key={detail.id} className="p-4 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                      <span className="font-bold text-slate-800 dark:text-zinc-200 text-sm">{detail.studentName}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                        detail.attendance === "Hadir"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                      }`}>
                        {detail.attendance}
                      </span>
                    </div>

                    {detail.attendance === "Hadir" ? (
                      <div className="space-y-2.5 text-xs text-slate-600 dark:text-zinc-300">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-lg">
                          <div>
                            <span className="font-semibold text-slate-400 block text-[10px] uppercase">Target Setoran</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{detail.memorizationTarget || "-"}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400 block text-[10px] uppercase">Capaian Capaian</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{detail.memorizationAchievement || "-"}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="p-1.5 border border-slate-150 dark:border-zinc-800 rounded-lg text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Tajwid</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{detail.tajwid}</span>
                          </div>
                          <div className="p-1.5 border border-slate-150 dark:border-zinc-800 rounded-lg text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Makhraj</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{detail.makhraj}</span>
                          </div>
                          <div className="p-1.5 border border-slate-150 dark:border-zinc-800 rounded-lg text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Kelancaran</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{detail.fluency}</span>
                          </div>
                          <div className="p-1.5 border border-slate-150 dark:border-zinc-800 rounded-lg text-center">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Adab</span>
                            <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{detail.behavior}</span>
                          </div>
                        </div>

                        {(detail.notes || detail.followUp) && (
                          <div className="space-y-1 bg-blue-50/20 dark:bg-zinc-800/20 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                            {detail.notes && <p><strong>Catatan:</strong> "{detail.notes}"</p>}
                            {detail.followUp && <p><strong>Tindak Lanjut:</strong> "{detail.followUp}"</p>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-semibold italic">Santri tidak hadir, data perkembangan hafalan ditiadakan.</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* General notes & Supporting links read only */}
            <div className="space-y-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
              {selectedJournal.generalNotes && (
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase block">Catatan Umum / Kendala Halaqah</span>
                  <p className="text-sm text-slate-700 dark:text-zinc-300 mt-1 bg-slate-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 whitespace-pre-wrap">{selectedJournal.generalNotes}</p>
                </div>
              )}

              {selectedJournal.supportingLink && (
                <div className="p-4 bg-blue-50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-blue-600 block">Tautan Dokumentasi / Bukti Dukung</span>
                    <span className="text-slate-500 mt-0.5 block truncate max-w-[400px]">{selectedJournal.supportingLink}</span>
                  </div>
                  <a
                    href={selectedJournal.supportingLink}
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Buka Bukti
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 dark:border-zinc-800 pt-4">
              <button
                onClick={() => setIsJournalDetailOpen(false)}
                className="px-5 py-2 bg-slate-150 text-slate-700 hover:bg-slate-200 font-bold rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default MusrifJournals;
