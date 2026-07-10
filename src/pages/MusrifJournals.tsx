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
import { userService } from "../services/user.service";
import { teacherService } from "../services/teacherService";
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

  const userRoles = user?.roles || [user?.role || ""];
  const isAdmin = userRoles.includes("admin") || user?.role === "admin";
  const isKepalaSekolah = userRoles.includes("kepala sekolah") || user?.role === "kepala sekolah";
  const isWakilKepalaSekolah = userRoles.includes("wakil kepala sekolah") || user?.role === "wakil kepala sekolah";
  const isKetuaYayasan = userRoles.includes("ketua yayasan") || user?.role === "ketua yayasan";
  const isMusrif = userRoles.includes("musrif") || user?.role === "musrif" || userRoles.includes("guru") || user?.role === "guru";

  // Confirmation state (to replace window.confirm inside the iframe)
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

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

  // Load all users to pick a Musrif if logged in user is Admin
  const { data: systemUsers = [] } = useQuery({
    queryKey: ["systemUsers"],
    queryFn: () => userService.getUsers(),
    enabled: isAdmin
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<"kelompok" | "jurnal" | "rekap">("kelompok");

  // --- TAB 3: REKAP PERKEMBANGAN SANTRI STATE ---
  const [selectedRecapStudentId, setSelectedRecapStudentId] = useState<string>("");
  const [recapGroupFilter, setRecapGroupFilter] = useState<string>("Semua");

  // --- TAB 1: KELOMPOK HALAQAH STATE ---
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<HalaqahGroup | null>(null);

  const [groupForm, setGroupForm] = useState({
    groupName: "",
    location: "",
    description: "",
    musrifId: "" // For admin to assign a musrif
  });

  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("Semua");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [showAllStudentsForTransfer, setShowAllStudentsForTransfer] = useState(false);

  // Query groups
  const { data: halaqahGroups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ["halaqahGroups", user?.userId, isAdmin, isKepalaSekolah, isWakilKepalaSekolah, isKetuaYayasan],
    queryFn: () => {
      // Admin, Kepala Sekolah, Wakil Kepala Sekolah, Ketua Yayasan see all groups
      if (isAdmin || isKepalaSekolah || isWakilKepalaSekolah || isKetuaYayasan) {
        return halaqahGroupService.getGroups();
      }
      // Musrif gets their own groups
      return halaqahGroupService.getGroups(user?.userId || "");
    }
  });

  // Query all members across all groups (to handle Bagian 4 & 5 filtering)
  const { data: allGroupMembers = [], refetch: refetchAllMembers } = useQuery({
    queryKey: ["allGroupMembers"],
    queryFn: () => halaqahGroupService.getAllMembers()
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

  // Query all journal details across all journals for student progress recap
  const { data: allJournalDetails = [], isLoading: isLoadingAllJournalDetails } = useQuery({
    queryKey: ["allJournalDetails"],
    queryFn: () => musrifJournalService.getAllJournalDetails(),
  });

  // Filter students list for the progress recap tab based on selected group filter
  const recapStudents = useMemo(() => {
    // Get student IDs of members of the groups that the current user has access to
    const groupIds = halaqahGroups.map(g => g.id);
    const relevantMembers = allGroupMembers.filter(m => groupIds.includes(m.groupId));
    
    if (recapGroupFilter === "Semua") {
      // Return distinct students from relevantMembers
      const seen = new Set();
      return relevantMembers.filter(m => {
        if (seen.has(m.studentId)) return false;
        seen.add(m.studentId);
        return true;
      }).map(m => ({
        id: m.studentId,
        name: m.studentName,
        className: m.className || "Tanpa Kelas"
      })).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      return relevantMembers
        .filter(m => m.groupId === recapGroupFilter)
        .map(m => ({
          id: m.studentId,
          name: m.studentName,
          className: m.className || "Tanpa Kelas"
        })).sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [halaqahGroups, allGroupMembers, recapGroupFilter]);

  // Map and sort student details across all journals
  const selectedStudentRecapDetails = useMemo(() => {
    if (!selectedRecapStudentId) return [];
    
    // Get all details for this student
    const details = allJournalDetails.filter(d => d.studentId === selectedRecapStudentId);
    
    // Map with journal metadata (date, musrifName, activityType, etc.) and sort by date DESC
    const mapped = details.map(d => {
      const journal = musrifJournals.find(j => j.id === d.journalId);
      return {
        ...d,
        journalDate: journal ? journal.date : d.createdAt ? d.createdAt.split("T")[0] : "",
        journalActivityType: journal ? journal.activityType : "Lainnya",
        journalMusrifName: journal ? journal.musrifName : "Musrif",
        journalGroupName: journal ? journal.groupName : ""
      };
    });
    
    return mapped.sort((a, b) => b.journalDate.localeCompare(a.journalDate));
  }, [selectedRecapStudentId, allJournalDetails, musrifJournals]);

  // Compute stats for selected student
  const studentRecapStats = useMemo(() => {
    const total = selectedStudentRecapDetails.length;
    if (total === 0) return { total: 0, hadir: 0, sakit: 0, izin: 0, alpha: 0, hadirPercent: 0 };
    
    const hadir = selectedStudentRecapDetails.filter(d => d.attendance === "Hadir").length;
    const sakit = selectedStudentRecapDetails.filter(d => d.attendance === "Sakit").length;
    const izin = selectedStudentRecapDetails.filter(d => d.attendance === "Izin").length;
    const alpha = selectedStudentRecapDetails.filter(d => d.attendance === "Alpha").length;
    
    return {
      total,
      hadir,
      sakit,
      izin,
      alpha,
      hadirPercent: Math.round((hadir / total) * 100)
    };
  }, [selectedStudentRecapDetails]);

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
      queryClient.invalidateQueries({ queryKey: ["allJournalDetails"] });
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
      queryClient.invalidateQueries({ queryKey: ["allJournalDetails"] });
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
      queryClient.invalidateQueries({ queryKey: ["allJournalDetails"] });
    },
    onError: (err: any) => {
      toast("Gagal menghapus jurnal: " + err.message, "error");
    }
  });

  // --- GROUP MEMBERSHIP SELECTION HELPERS ---
  const filteredStudentsForAdding = useMemo(() => {
    // Exclude students who are already members of the current group
    const currentMemberIds = groupMembers.map((m) => m.studentId);
    
    // Map of studentId to existing group name for all other assignments
    const allAssignedStudentMap = new Map<string, string>();
    allGroupMembers.forEach((m) => {
      if (m.groupId !== selectedGroup?.id) {
        const grp = halaqahGroups.find((g) => g.id === m.groupId);
        allAssignedStudentMap.set(m.studentId, grp?.groupName || "Kelompok Lain");
      }
    });

    return studentsList.filter((s) => {
      if (currentMemberIds.includes(s.id)) return false;
      
      // If we are NOT showing all students for transfer, hide any student in another group
      if (!showAllStudentsForTransfer && allAssignedStudentMap.has(s.id)) {
        return false;
      }

      const matchSearch = s.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                          (s.nis && s.nis.includes(memberSearchQuery));
      const matchClass = classFilter === "Semua" || s.classId === classFilter;
      return matchSearch && matchClass;
    });
  }, [studentsList, groupMembers, allGroupMembers, halaqahGroups, selectedGroup, memberSearchQuery, classFilter, showAllStudentsForTransfer]);

  // Handle adding checked students
  const handleAddMembersSubmit = async () => {
    if (!selectedGroup) return;
    if (selectedStudentIds.length === 0) {
      toast("Pilih minimal satu santri!", "error");
      return;
    }

    try {
      const promises = selectedStudentIds.map(async (studentId) => {
        const student = studentsList.find((s) => s.id === studentId);
        
        // Find if they are in another group, and remove them first to prevent duplicates
        const existingAssignment = allGroupMembers.find((m) => m.studentId === studentId);
        if (existingAssignment) {
          await halaqahGroupService.removeMember(existingAssignment.id);
        }

        return addMemberMutation.mutateAsync({
          groupId: selectedGroup.id,
          studentId,
          studentName: student?.name || "Santri",
          classId: student?.classId || "",
          className: student?.className || "Tanpa Kelas"
        });
      });

      await Promise.all(promises);
      toast(`Berhasil menambahkan/memindahkan ${selectedStudentIds.length} santri ke kelompok ${selectedGroup.groupName}!`, "success");
      setSelectedStudentIds([]);
      setIsAddMemberModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["allGroupMembers"] });
      queryClient.invalidateQueries({ queryKey: ["groupMembers"] });
    } catch (err: any) {
      toast("Gagal memindahkan santri: " + err.message, "error");
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
            followUp: "",
            
            // Detailed fields for Bagian 7
            tahsinMakhraj: "",
            tahsinTajwid: "",
            tahsinFluency: "",
            tahsinNotes: "",

            tahfizhSurah: "",
            tahfizhAyat: "",
            tahfizhHalaman: "",
            tahfizhNewMemorization: "",
            tahfizhMurajaah: "",
            tahfizhFluency: "",
            tahfizhNotes: "",

            adabDiscipline: "",
            adabNeatness: "",
            adabPoliteness: "",
            adabHonesty: "",
            adabResponsibility: "",
            adabCooperation: "",
            adabNotes: "",

            asramaCleanliness: "",
            asramaWorship: "",
            asramaAttendance: "",
            asramaDiscipline: "",
            asramaSocialInteraction: "",
            asramaNotes: "",

            specialIssues: ""
          };
        });
        setStudentJournalInputs(inputs);
      } catch (err) {
        console.error("Gagal memuat anggota kelompok untuk jurnal:", err);
      }
    };

    if (!selectedJournal && isJournalModalOpen) {
      fetchAndSetMembersInputs();
    }
  }, [journalGroup, selectedJournal, isJournalModalOpen]);

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
          followUp: d.followUp,
          
          tahsinMakhraj: d.tahsinMakhraj || "",
          tahsinTajwid: d.tahsinTajwid || "",
          tahsinFluency: d.tahsinFluency || "",
          tahsinNotes: d.tahsinNotes || "",
          
          tahfizhSurah: d.tahfizhSurah || "",
          tahfizhAyat: d.tahfizhAyat || "",
          tahfizhHalaman: d.tahfizhHalaman || "",
          tahfizhNewMemorization: d.tahfizhNewMemorization || "",
          tahfizhMurajaah: d.tahfizhMurajaah || "",
          tahfizhFluency: d.tahfizhFluency || "",
          tahfizhNotes: d.tahfizhNotes || "",
          
          adabDiscipline: d.adabDiscipline || "",
          adabNeatness: d.adabNeatness || "",
          adabPoliteness: d.adabPoliteness || "",
          adabHonesty: d.adabHonesty || "",
          adabResponsibility: d.adabResponsibility || "",
          adabCooperation: d.adabCooperation || "",
          adabNotes: d.adabNotes || "",
          
          asramaCleanliness: d.asramaCleanliness || "",
          asramaWorship: d.asramaWorship || "",
          asramaAttendance: d.asramaAttendance || "",
          asramaDiscipline: d.asramaDiscipline || "",
          asramaSocialInteraction: d.asramaSocialInteraction || "",
          asramaNotes: d.asramaNotes || "",
          
          specialIssues: d.specialIssues || ""
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
      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab("kelompok")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer whitespace-nowrap ${
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
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "jurnal"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
          }`}
        >
          <BookOpen className="h-4.5 w-4.5" />
          Jurnal Halaqah
        </button>
        <button
          onClick={() => setActiveTab("rekap")}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-px flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "rekap"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300"
          }`}
        >
          <Award className="h-4.5 w-4.5" />
          Rekap Perkembangan Santri
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
            {(isMusrif || isAdmin) && (
              <button
                onClick={() => {
                  setSelectedGroup(null);
                  setGroupForm({ groupName: "", location: "", description: "", musrifId: "" });
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
                    {(isAdmin || (isMusrif && group.musrifId === user?.userId)) ? "Kelola Santri" : "Lihat Santri"}
                  </button>

                  <div className="flex items-center gap-1">
                    {(isAdmin || (isMusrif && group.musrifId === user?.userId)) && (
                      <button
                        onClick={() => {
                          setSelectedGroup(group);
                          setGroupForm({
                            groupName: group.groupName,
                            location: group.location,
                            description: group.description,
                            musrifId: group.musrifId || ""
                          });
                          setIsGroupModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
                        title="Edit Kelompok"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}

                    {(isAdmin || (isMusrif && group.musrifId === user?.userId)) && (
                      <button
                        onClick={() => {
                          setConfirmState({
                            isOpen: true,
                            title: "Hapus Kelompok Halaqah",
                            message: `Apakah Anda yakin ingin menghapus kelompok halaqah "${group.groupName}"? Semua data keanggotaan kelompok ini juga akan ikut dibersihkan.`,
                            onConfirm: () => {
                              deleteGroupMutation.mutate(group.id);
                              setConfirmState(null);
                            }
                          });
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
                        setConfirmState({
                          isOpen: true,
                          title: "Hapus Jurnal Halaqah",
                          message: "Apakah Anda yakin ingin menghapus jurnal halaqah ini beserta seluruh catatan perkembangan santri di dalamnya?",
                          onConfirm: () => {
                            deleteJournalMutation.mutate(j.id);
                            setConfirmState(null);
                          }
                        });
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

      {activeTab === "rekap" && (
        <div className="space-y-6">
          {/* Filters card */}
          <div className="p-5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs space-y-4">
            <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Award className="h-4.5 w-4.5 text-blue-500" />
              Pilih Santri untuk Rekap Perkembangan
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormSelect
                label="Kelompok Halaqah"
                value={recapGroupFilter}
                onChange={(e) => {
                  setRecapGroupFilter(e.target.value);
                  setSelectedRecapStudentId("");
                }}
                options={[
                  { value: "Semua", label: "Semua Kelompok Anda" },
                  ...halaqahGroups.map((g) => ({ value: g.id, label: g.groupName }))
                ]}
              />
              <FormSelect
                label="Pilih Santri"
                value={selectedRecapStudentId}
                onChange={(e) => setSelectedRecapStudentId(e.target.value)}
                options={[
                  { value: "", label: "-- Pilih Santri --" },
                  ...recapStudents.map((s) => ({
                    value: s.id,
                    label: `${s.name} (${s.className})`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Main Recap Dashboard */}
          {!selectedRecapStudentId ? (
            <div className="p-12 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs max-w-xl mx-auto">
              <div className="h-16 w-16 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">Rekapitulasi Perkembangan Santri</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                Silakan pilih kelompok halaqah dan santri pada filter di atas untuk melihat rekapitulasi perkembangan belajar, catatan hafalan baru, muraja'ah, evaluasi adab, serta mutaba'ah asrama secara berkala.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Student Header & Attendance Bento Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Profil Santri</span>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-zinc-100">
                      {recapStudents.find(s => s.id === selectedRecapStudentId)?.name || "Santri"}
                    </h2>
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      Kelas: {recapStudents.find(s => s.id === selectedRecapStudentId)?.className || "Tanpa Kelas"}
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800/80">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kelompok Halaqah</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">
                        {allGroupMembers.find(m => m.studentId === selectedRecapStudentId)
                          ? halaqahGroups.find(g => g.id === allGroupMembers.find(m => m.studentId === selectedRecapStudentId)?.groupId)?.groupName || "-"
                          : "-"
                        }
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 text-[11px] text-slate-400 dark:text-zinc-500 italic">
                    Tahun Pelajaran: {activeYear?.name || "-"} • Semester: {activeSemester?.name || "-"}
                  </div>
                </div>

                {/* Attendance Stats Card */}
                <div className="lg:col-span-2 p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-3">Statistik Kehadiran Halaqah</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-2xl text-center border border-slate-100 dark:border-zinc-800">
                      <span className="text-xs font-semibold text-slate-400 block">Total Pertemuan</span>
                      <span className="text-2xl font-extrabold text-slate-800 dark:text-zinc-100 mt-1 block">{studentRecapStats.total}</span>
                    </div>
                    <div className="p-4 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-2xl text-center border border-emerald-100/40 dark:border-emerald-900/10">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 block">Hadir</span>
                      <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 block">{studentRecapStats.hadir}</span>
                    </div>
                    <div className="p-4 bg-amber-50/40 dark:bg-amber-950/10 rounded-2xl text-center border border-amber-100/40 dark:border-amber-900/10">
                      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 block">Sakit</span>
                      <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1 block">{studentRecapStats.sakit}</span>
                    </div>
                    <div className="p-4 bg-blue-50/40 dark:bg-blue-950/10 rounded-2xl text-center border border-blue-100/40 dark:border-blue-900/10">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 block">Izin</span>
                      <span className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 mt-1 block">{studentRecapStats.izin}</span>
                    </div>
                    <div className="p-4 bg-rose-50/40 dark:bg-rose-950/10 rounded-2xl text-center border border-rose-100/40 dark:border-rose-900/10">
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 block">Alpha</span>
                      <span className="text-2xl font-extrabold text-rose-700 dark:text-rose-300 mt-1 block">{studentRecapStats.alpha}</span>
                    </div>
                  </div>

                  <div className="mt-5 bg-slate-50 dark:bg-zinc-800/30 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Persentase Kehadiran Santri</span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-1/2">
                      <div className="w-full bg-slate-200 dark:bg-zinc-700 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${studentRecapStats.hadirPercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {studentRecapStats.hadirPercent}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMELINE PROGRESS SECTIONS */}
              {selectedStudentRecapDetails.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl">
                  <span className="text-sm text-slate-400 font-semibold">Belum ada rekaman jurnal untuk santri ini.</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Category 1: TAHFIZH PROGRESS */}
                  <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                    <h3 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-2 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                      <BookOpen className="h-4.5 w-4.5" />
                      1. Perkembangan Hafalan Al-Qur'an (Tahfizh)
                    </h3>
                    <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 divide-y divide-slate-100 dark:divide-zinc-800">
                      {selectedStudentRecapDetails
                        .filter(d => d.attendance === "Hadir" && (d.tahfizhSurah || d.tahfizhNewMemorization || d.tahfizhMurajaah))
                        .map((d, index) => (
                          <div key={d.id} className={`pt-4 ${index === 0 ? "pt-0" : ""}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                  {new Date(d.journalDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                                <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-md border border-emerald-100 dark:border-emerald-900/30">
                                  {d.journalActivityType}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">Musrif: {d.journalMusrifName}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/50">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Surat / Ayat / Hal</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">{d.tahfizhSurah || "-"} / Ay: {d.tahfizhAyat || "-"} / Hal: {d.tahfizhHalaman || "-"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Hafalan Baru</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">{d.tahfizhNewMemorization || "-"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Muraja'ah</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">{d.tahfizhMurajaah || "-"}</span>
                              </div>
                            </div>
                            <div className="mt-2 text-xs flex flex-col gap-1">
                              <div><strong>Kelancaran:</strong> {d.tahfizhFluency || "-"}</div>
                              {d.tahfizhNotes && <div className="text-slate-500 dark:text-zinc-400 italic">"Catatan: {d.tahfizhNotes}"</div>}
                            </div>
                          </div>
                        ))}
                      {selectedStudentRecapDetails.filter(d => d.attendance === "Hadir" && (d.tahfizhSurah || d.tahfizhNewMemorization || d.tahfizhMurajaah)).length === 0 && (
                        <span className="text-xs text-slate-400 italic block py-4">Belum ada catatan aktivitas tahfizh yang tercatat.</span>
                      )}
                    </div>
                  </div>

                  {/* Category 2: TAHSIN PROGRESS */}
                  <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                    <h3 className="text-sm font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-2 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                      <Book className="h-4.5 w-4.5" />
                      2. Perkembangan Membaca Al-Qur'an (Tahsin)
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 divide-y divide-slate-100 dark:divide-zinc-800">
                      {selectedStudentRecapDetails
                        .filter(d => d.attendance === "Hadir" && (d.tahsinMakhraj || d.tahsinTajwid || d.tahsinFluency))
                        .map((d, index) => (
                          <div key={d.id} className={`pt-4 ${index === 0 ? "pt-0" : ""}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                {new Date(d.journalDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">Musrif: {d.journalMusrifName}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-zinc-800/30 p-3 rounded-xl border border-slate-100 dark:border-zinc-800/50">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Makharijul Huruf</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">{d.tahsinMakhraj || "-"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Tajwid</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">{d.tahsinTajwid || "-"}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Kelancaran</span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mt-0.5">{d.tahsinFluency || "-"}</span>
                              </div>
                            </div>
                            {d.tahsinNotes && <p className="text-xs text-slate-500 dark:text-zinc-400 italic mt-2">"Catatan: {d.tahsinNotes}"</p>}
                          </div>
                        ))}
                      {selectedStudentRecapDetails.filter(d => d.attendance === "Hadir" && (d.tahsinMakhraj || d.tahsinTajwid || d.tahsinFluency)).length === 0 && (
                        <span className="text-xs text-slate-400 italic block py-4">Belum ada catatan aktivitas tahsin yang tercatat.</span>
                      )}
                    </div>
                  </div>

                  {/* Category 3: ADAB & CHARACTER */}
                  <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                    <h3 className="text-sm font-extrabold text-purple-700 dark:text-purple-400 flex items-center gap-2 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                      <Award className="h-4.5 w-4.5" />
                      3. Rekap Adab dan Akhlak
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 divide-y divide-slate-100 dark:divide-zinc-800">
                      {selectedStudentRecapDetails
                        .filter(d => d.attendance === "Hadir" && (d.adabDiscipline || d.adabPoliteness || d.adabNotes))
                        .map((d, index) => (
                          <div key={d.id} className={`pt-4 ${index === 0 ? "pt-0" : ""}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                {new Date(d.journalDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">Musrif: {d.journalMusrifName}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-purple-50/10 dark:bg-purple-950/5 p-3 rounded-xl border border-purple-100/30 dark:border-purple-900/10">
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Disiplin</span>
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 mt-0.5 block">{d.adabDiscipline || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Kerapian</span>
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 mt-0.5 block">{d.adabNeatness || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Sopan</span>
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 mt-0.5 block">{d.adabPoliteness || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Jujur</span>
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 mt-0.5 block">{d.adabHonesty || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Tg. Jawab</span>
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 mt-0.5 block">{d.adabResponsibility || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Kerjasama</span>
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 mt-0.5 block">{d.adabCooperation || "-"}</span>
                              </div>
                            </div>
                            {d.adabNotes && <p className="text-xs text-slate-500 dark:text-zinc-400 italic mt-2">"Catatan Adab: {d.adabNotes}"</p>}
                          </div>
                        ))}
                      {selectedStudentRecapDetails.filter(d => d.attendance === "Hadir" && (d.adabDiscipline || d.adabPoliteness || d.adabNotes)).length === 0 && (
                        <span className="text-xs text-slate-400 italic block py-4">Belum ada rekap catatan adab.</span>
                      )}
                    </div>
                  </div>

                  {/* Category 4: ASRAMA LIFE */}
                  <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                    <h3 className="text-sm font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-2 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                      <Users className="h-4.5 w-4.5" />
                      4. Mutaba'ah & Kehidupan Asrama
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 divide-y divide-slate-100 dark:divide-zinc-800">
                      {selectedStudentRecapDetails
                        .filter(d => d.attendance === "Hadir" && (d.asramaCleanliness || d.asramaWorship || d.asramaNotes))
                        .map((d, index) => (
                          <div key={d.id} className={`pt-4 ${index === 0 ? "pt-0" : ""}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                {new Date(d.journalDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">Musrif: {d.journalMusrifName}</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-amber-50/10 dark:bg-amber-950/5 p-3 rounded-xl border border-amber-100/30 dark:border-amber-900/10">
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Kebersihan</span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 block">{d.asramaCleanliness || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Ibadah</span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 block">{d.asramaWorship || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Kehadiran</span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 block">{d.asramaAttendance || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Disiplin</span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 block">{d.asramaDiscipline || "-"}</span>
                              </div>
                              <div className="text-center p-1.5 border border-slate-100 dark:border-zinc-800/40 rounded bg-white dark:bg-zinc-900">
                                <span className="text-[8px] font-bold text-slate-400 uppercase block">Interaksi</span>
                                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mt-0.5 block">{d.asramaSocialInteraction || "-"}</span>
                              </div>
                            </div>
                            {d.asramaNotes && <p className="text-xs text-slate-500 dark:text-zinc-400 italic mt-2">"Catatan Asrama: {d.asramaNotes}"</p>}
                          </div>
                        ))}
                      {selectedStudentRecapDetails.filter(d => d.attendance === "Hadir" && (d.asramaCleanliness || d.asramaWorship || d.asramaNotes)).length === 0 && (
                        <span className="text-xs text-slate-400 italic block py-4">Belum ada catatan asrama yang terekam.</span>
                      )}
                    </div>
                  </div>

                  {/* Category 5: SPECIAL ISSUES */}
                  <div className="p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs">
                    <h3 className="text-sm font-extrabold text-rose-700 dark:text-rose-400 flex items-center gap-2 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 dark:border-zinc-800/80">
                      <HelpCircle className="h-4.5 w-4.5 text-rose-500" />
                      5. Permasalahan Khusus & Tindak Lanjut
                    </h3>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 divide-y divide-slate-100 dark:divide-zinc-800">
                      {selectedStudentRecapDetails
                        .filter(d => d.specialIssues)
                        .map((d, index) => (
                          <div key={d.id} className={`pt-4 ${index === 0 ? "pt-0" : ""}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                {new Date(d.journalDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">Musrif: {d.journalMusrifName}</span>
                            </div>
                            <div className="bg-rose-50/30 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                              <p className="text-xs font-bold text-rose-900 dark:text-rose-300 whitespace-pre-wrap leading-relaxed">
                                "{d.specialIssues}"
                              </p>
                            </div>
                          </div>
                        ))}
                      {selectedStudentRecapDetails.filter(d => d.specialIssues).length === 0 && (
                        <span className="text-xs text-slate-400 italic block py-4">Tidak ada catatan permasalahan khusus untuk santri ini.</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
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
          {isAdmin && (
            <FormSelect
              label="Pilih Pembina / Musrif"
              value={groupForm.musrifId}
              onChange={(e) => setGroupForm(prev => ({ ...prev, musrifId: e.target.value }))}
              options={[
                { value: "", label: "-- Pilih Musrif / Guru --" },
                ...systemUsers
                  .filter((u) => u.role === "musrif" || u.role === "guru" || u.role === "admin")
                  .map((u) => ({ value: u.id, label: u.name || u.email }))
              ]}
              required
            />
          )}
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
                
                let mId = user?.userId || "musrif-system";
                let mName = user?.displayName || user?.name || "Musrif";
                
                if (isAdmin && groupForm.musrifId) {
                  mId = groupForm.musrifId;
                  const pickedUser = systemUsers.find(u => u.id === mId);
                  mName = pickedUser?.name || pickedUser?.email || "Musrif";
                }

                const payload = {
                  musrifId: mId,
                  musrifName: mName,
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
            {(isAdmin || (isMusrif && selectedGroup?.musrifId === user?.userId)) && (
              <button
                onClick={() => {
                  setSelectedStudentIds([]);
                  setMemberSearchQuery("");
                  setClassFilter("Semua");
                  setShowAllStudentsForTransfer(false);
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
                {(isAdmin || (isMusrif && selectedGroup?.musrifId === user?.userId)) && (
                  <button
                    onClick={() => {
                      setConfirmState({
                        isOpen: true,
                        title: "Keluarkan Santri",
                        message: `Apakah Anda yakin ingin mengeluarkan "${member.studentName}" dari kelompok halaqah "${selectedGroup?.groupName || "ini"}"?`,
                        onConfirm: () => {
                          removeMemberMutation.mutate(member.id);
                          setConfirmState(null);
                        }
                      });
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

          {/* Opsi Pindah Kelompok (Bagian 4 & 5) */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              id="transferToggle"
              checked={showAllStudentsForTransfer}
              onChange={(e) => setShowAllStudentsForTransfer(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="transferToggle" className="text-xs font-semibold text-slate-600 dark:text-zinc-300 cursor-pointer select-none">
              Tampilkan Siswa dari Kelompok Lain (Opsi Pindah Kelompok)
            </label>
          </div>

          <span className="text-xs font-bold text-slate-400 uppercase tracking-wide block">Hasil Pencarian ({filteredStudentsForAdding.length} Santri Tersedia)</span>

          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredStudentsForAdding.map((student) => {
              const isChecked = selectedStudentIds.includes(student.id);
              const assignedMember = allGroupMembers.find(m => m.studentId === student.id);
              const otherGroup = assignedMember ? halaqahGroups.find(g => g.id === assignedMember.groupId) : null;

              return (
                <label
                  key={student.id}
                  className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-zinc-800/20 cursor-pointer select-none transition-colors"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-zinc-200 text-xs sm:text-sm">{student.name}</span>
                      {otherGroup && (
                        <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 rounded uppercase">
                          {otherGroup.groupName}
                        </span>
                      )}
                    </div>
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
                        <div className="space-y-4 pt-2">
                          {/* 1. TAHSIN */}
                          <div className="bg-blue-50/20 dark:bg-blue-950/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 uppercase">
                              <BookOpen className="h-4 w-4 text-blue-500" />
                              1. Evaluasi Tahsin (Membaca)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <FormInput
                                type="text"
                                label="Makharijul Huruf"
                                value={inputs.tahsinMakhraj || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahsinMakhraj: e.target.value }
                                }))}
                                placeholder="Misal: Makhraj halq sudah tepat..."
                              />
                              <FormInput
                                type="text"
                                label="Tajwid"
                                value={inputs.tahsinTajwid || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahsinTajwid: e.target.value }
                                }))}
                                placeholder="Misal: Idgham bighunnah perlu ditahan..."
                              />
                              <FormInput
                                type="text"
                                label="Kelancaran"
                                value={inputs.tahsinFluency || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahsinFluency: e.target.value }
                                }))}
                                placeholder="Misal: Sangat lancar membaca..."
                              />
                            </div>
                            <FormInput
                              type="text"
                              label="Catatan Tahsin"
                              value={inputs.tahsinNotes || ""}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], tahsinNotes: e.target.value }
                              }))}
                              placeholder="Keterangan perkembangan tahsin..."
                            />
                          </div>

                          {/* 2. TAHFIZH */}
                          <div className="bg-emerald-50/20 dark:bg-emerald-950/10 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
                              <Award className="h-4 w-4 text-emerald-500" />
                              2. Progres Tahfizh (Hafalan)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <FormInput
                                type="text"
                                label="Surat"
                                value={inputs.tahfizhSurah || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahfizhSurah: e.target.value }
                                }))}
                                placeholder="Surat..."
                              />
                              <FormInput
                                type="text"
                                label="Ayat"
                                value={inputs.tahfizhAyat || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahfizhAyat: e.target.value }
                                }))}
                                placeholder="Ayat..."
                              />
                              <FormInput
                                type="text"
                                label="Halaman"
                                value={inputs.tahfizhHalaman || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahfizhHalaman: e.target.value }
                                }))}
                                placeholder="Halaman..."
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <FormInput
                                type="text"
                                label="Hafalan Baru (Ziyadah)"
                                value={inputs.tahfizhNewMemorization || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahfizhNewMemorization: e.target.value }
                                }))}
                                placeholder="Hafalan baru..."
                              />
                              <FormInput
                                type="text"
                                label="Muroja'ah"
                                value={inputs.tahfizhMurajaah || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahfizhMurajaah: e.target.value }
                                }))}
                                placeholder="Muroja'ah..."
                              />
                              <FormInput
                                type="text"
                                label="Kelancaran Hafalan"
                                value={inputs.tahfizhFluency || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], tahfizhFluency: e.target.value }
                                }))}
                                placeholder="Sangat lancar, terbata-bata..."
                              />
                            </div>
                            <FormInput
                              type="text"
                              label="Catatan Tahfizh"
                              value={inputs.tahfizhNotes || ""}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], tahfizhNotes: e.target.value }
                              }))}
                              placeholder="Keterangan perkembangan hafalan..."
                            />
                          </div>

                          {/* 3. ADAB */}
                          <div className="bg-purple-50/20 dark:bg-purple-950/10 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/30 space-y-3">
                            <span className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5 uppercase">
                              <Clock className="h-4 w-4 text-purple-500" />
                              3. Adab dan Akhlak Santri
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <FormInput
                                type="text"
                                label="Kedisiplinan"
                                value={inputs.adabDiscipline || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], adabDiscipline: e.target.value }
                                }))}
                                placeholder="Kedisiplinan..."
                              />
                              <FormInput
                                type="text"
                                label="Kerapian"
                                value={inputs.adabNeatness || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], adabNeatness: e.target.value }
                                }))}
                                placeholder="Kerapian pakaian/kamar..."
                              />
                              <FormInput
                                type="text"
                                label="Kesopanan"
                                value={inputs.adabPoliteness || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], adabPoliteness: e.target.value }
                                }))}
                                placeholder="Kesopanan kepada asatidz..."
                              />
                              <FormInput
                                type="text"
                                label="Kejujuran"
                                value={inputs.adabHonesty || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], adabHonesty: e.target.value }
                                }))}
                                placeholder="Sikap jujur..."
                              />
                              <FormInput
                                type="text"
                                label="Tanggung Jawab"
                                value={inputs.adabResponsibility || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], adabResponsibility: e.target.value }
                                }))}
                                placeholder="Tanggung jawab tugas..."
                              />
                              <FormInput
                                type="text"
                                label="Kerjasama"
                                value={inputs.adabCooperation || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], adabCooperation: e.target.value }
                                }))}
                                placeholder="Kerjasama tim..."
                              />
                            </div>
                            <FormInput
                              type="text"
                              label="Catatan Adab & Akhlak"
                              value={inputs.adabNotes || ""}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], adabNotes: e.target.value }
                              }))}
                              placeholder="Deskripsi perkembangan perilaku..."
                            />
                          </div>

                          {/* 4. KEHIDUPAN ASRAMA */}
                          <div className="bg-amber-50/20 dark:bg-amber-950/10 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/30 space-y-3">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 uppercase">
                              <Layers className="h-4 w-4 text-amber-500" />
                              4. Kehidupan & Mutaba'ah Asrama
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <FormInput
                                type="text"
                                label="Kebersihan"
                                value={inputs.asramaCleanliness || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], asramaCleanliness: e.target.value }
                                }))}
                                placeholder="Misal: Piket kamar rajin..."
                              />
                              <FormInput
                                type="text"
                                label="Ibadah Harian"
                                value={inputs.asramaWorship || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], asramaWorship: e.target.value }
                                }))}
                                placeholder="Misal: Salat berjamaah tepat waktu..."
                              />
                              <FormInput
                                type="text"
                                label="Kehadiran"
                                value={inputs.asramaAttendance || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], asramaAttendance: e.target.value }
                                }))}
                                placeholder="Kehadiran kajian, makan..."
                              />
                              <FormInput
                                type="text"
                                label="Kedisiplinan Asrama"
                                value={inputs.asramaDiscipline || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], asramaDiscipline: e.target.value }
                                }))}
                                placeholder="Jam tidur, jam belajar..."
                              />
                              <FormInput
                                type="text"
                                label="Interaksi Sosial"
                                value={inputs.asramaSocialInteraction || ""}
                                onChange={(e) => setStudentJournalInputs(prev => ({
                                  ...prev,
                                  [studentId]: { ...prev[studentId], asramaSocialInteraction: e.target.value }
                                }))}
                                placeholder="Sosialisasi sesama santri..."
                              />
                            </div>
                            <FormInput
                              type="text"
                              label="Catatan Pengasuhan"
                              value={inputs.asramaNotes || ""}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], asramaNotes: e.target.value }
                              }))}
                              placeholder="Catatan pengasuhan asrama..."
                            />
                          </div>

                          {/* 5. PERMASALAHAN KHUSUS */}
                          <div className="bg-rose-50/20 dark:bg-rose-950/10 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30 space-y-3">
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase">
                              <HelpCircle className="h-4 w-4 text-rose-500" />
                              5. Permasalahan Khusus (Bila Ada)
                            </span>
                            <FormTextarea
                              label="Deskripsi Masalah / Sakit / Pelanggaran / Prestasi"
                              value={inputs.specialIssues || ""}
                              onChange={(e) => setStudentJournalInputs(prev => ({
                                ...prev,
                                [studentId]: { ...prev[studentId], specialIssues: e.target.value }
                              }))}
                              placeholder="Tuliskan jika santri sakit, melakukan pelanggaran, berkonflik, atau memiliki prestasi istimewa..."
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
                      <div className="space-y-3 text-xs text-slate-600 dark:text-zinc-300">
                        {/* 1. TAHSIN */}
                        <div className="bg-blue-50/20 dark:bg-blue-950/10 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                          <span className="font-bold text-blue-700 dark:text-blue-400 block mb-1">1. Evaluasi Tahsin (Membaca)</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] mt-1">
                            <div><strong>Makhraj:</strong> {detail.tahsinMakhraj || "-"}</div>
                            <div><strong>Tajwid:</strong> {detail.tahsinTajwid || "-"}</div>
                            <div><strong>Kelancaran:</strong> {detail.tahsinFluency || "-"}</div>
                          </div>
                          {detail.tahsinNotes && <p className="text-[11px] mt-1.5 text-slate-500 dark:text-zinc-400 italic"><strong>Catatan:</strong> "{detail.tahsinNotes}"</p>}
                        </div>

                        {/* 2. TAHFIZH */}
                        <div className="bg-emerald-50/20 dark:bg-emerald-950/10 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 block mb-1">2. Progres Tahfizh (Hafalan)</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] mt-1">
                            <div><strong>Surat/Ayat/Halaman:</strong> {detail.tahfizhSurah || "-"} / {detail.tahfizhAyat || "-"} / {detail.tahfizhHalaman || "-"}</div>
                            <div><strong>Hafalan Baru:</strong> {detail.tahfizhNewMemorization || "-"}</div>
                            <div><strong>Muraja'ah:</strong> {detail.tahfizhMurajaah || "-"}</div>
                          </div>
                          <div className="text-[11px] mt-1"><strong>Kelancaran Hafalan:</strong> {detail.tahfizhFluency || "-"}</div>
                          {detail.tahfizhNotes && <p className="text-[11px] mt-1.5 text-slate-500 dark:text-zinc-400 italic"><strong>Catatan:</strong> "{detail.tahfizhNotes}"</p>}
                        </div>

                        {/* 3. ADAB */}
                        <div className="bg-purple-50/20 dark:bg-purple-950/10 p-2.5 rounded-lg border border-purple-100 dark:border-purple-900/30">
                          <span className="font-bold text-purple-700 dark:text-purple-400 block mb-1">3. Adab dan Akhlak Santri</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] mt-1">
                            <div><strong>Disiplin:</strong> {detail.adabDiscipline || "-"}</div>
                            <div><strong>Kerapian:</strong> {detail.adabNeatness || "-"}</div>
                            <div><strong>Sopan:</strong> {detail.adabPoliteness || "-"}</div>
                            <div><strong>Jujur:</strong> {detail.adabHonesty || "-"}</div>
                            <div><strong>Tanggung Jawab:</strong> {detail.adabResponsibility || "-"}</div>
                            <div><strong>Kerjasama:</strong> {detail.adabCooperation || "-"}</div>
                          </div>
                          {detail.adabNotes && <p className="text-[11px] mt-1.5 text-slate-500 dark:text-zinc-400 italic"><strong>Catatan:</strong> "{detail.adabNotes}"</p>}
                        </div>

                        {/* 4. ASRAMA */}
                        <div className="bg-amber-50/20 dark:bg-amber-950/10 p-2.5 rounded-lg border border-amber-100 dark:border-amber-900/30">
                          <span className="font-bold text-amber-700 dark:text-amber-400 block mb-1">4. Kehidupan & Mutaba'ah Asrama</span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] mt-1">
                            <div><strong>Kebersihan:</strong> {detail.asramaCleanliness || "-"}</div>
                            <div><strong>Ibadah:</strong> {detail.asramaWorship || "-"}</div>
                            <div><strong>Kehadiran:</strong> {detail.asramaAttendance || "-"}</div>
                            <div><strong>Disiplin:</strong> {detail.asramaDiscipline || "-"}</div>
                            <div><strong>Interaksi:</strong> {detail.asramaSocialInteraction || "-"}</div>
                          </div>
                          {detail.asramaNotes && <p className="text-[11px] mt-1.5 text-slate-500 dark:text-zinc-400 italic"><strong>Catatan:</strong> "{detail.asramaNotes}"</p>}
                        </div>

                        {/* 5. PERMASALAHAN KHUSUS */}
                        {detail.specialIssues && (
                          <div className="bg-rose-50/20 dark:bg-rose-950/10 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30">
                            <span className="font-bold text-rose-700 dark:text-rose-400 block mb-1">5. Permasalahan Khusus</span>
                            <p className="text-[11px] text-rose-950 dark:text-rose-300 font-medium whitespace-pre-wrap mt-1">"{detail.specialIssues}"</p>
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

      {/* Custom Confirmation Dialog for destructive operations */}
      {confirmState && (
        <Dialog
          isOpen={confirmState.isOpen}
          onClose={() => setConfirmState(null)}
          title={confirmState.title}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
              {confirmState.message}
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <button
                onClick={() => setConfirmState(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={confirmState.onConfirm}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Ya, Lanjutkan
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default MusrifJournals;
