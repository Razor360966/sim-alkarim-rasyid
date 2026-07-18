import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUsers } from "../hooks/user.hook";
import { useTeachers } from "../hooks/useTeachers";
import { useAuth } from "../contexts/AuthContext";
import { userService, ROLE_PRIORITIES } from "../services/user.service";
import { 
  Users as UsersIcon, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  UserMinus, 
  Edit2, 
  Eye, 
  RefreshCw, 
  Filter, 
  Mail,
  User as SingleUserIcon,
  Plus,
  Lock,
  Trash2,
  Shield,
  KeyRound,
  History,
  Activity,
  Copy,
  Info,
  Check,
  Download,
  Upload,
  AlertCircle,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserSystem, UserSystemRole } from "../types";
import { useToast } from "../contexts/ToastContext";

const AVAILABLE_ROLES = [
  { id: "admin", name: "Admin" },
  { id: "operator", name: "Operator" },
  { id: "ketua yayasan", name: "Ketua Yayasan" },
  { id: "kepala sekolah", name: "Kepala Sekolah" },
  { id: "wakil kepala sekolah", name: "Wakil Kepala Sekolah" },
  { id: "guru", name: "Guru" },
  { id: "musrif", name: "Guru Halaqoh" },
  { id: "tata usaha", name: "Tata Usaha / Tendik" }
];

const STATUS_BADGES = {
  "Aktif": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900/50",
  "Nonaktif": "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50",
  "Menunggu Aktivasi": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50",
  "Ditangguhkan": "bg-slate-100 text-slate-700 border-slate-350 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
};

export default function Users() {
  const { user: currentLoggedUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"accounts" | "profiles" | "roles" | "login-history" | "audit">("accounts");
  
  const { 
    users, 
    isLoading: isUsersLoading, 
    refetch, 
    updateUserRoles, 
    isUpdatingRoles,
    linkUserToTeacher, 
    isLinkingTeacher, 
    updateUserStatus, 
    createNewAccount,
    isCreatingAccount,
    resetUserPassword,
    isResettingPassword,
    deleteAccount,
    isDeletingAccount
  } = useUsers();
  
  const { teachers, isLoading: isTeachersLoading } = useTeachers();

  // Queries for other tabs
  const { data: loginHistory = [], isLoading: isHistoryLoading, refetch: refetchHistory } = useQuery({
    queryKey: ["loginHistory"],
    queryFn: () => userService.getLoginHistory(),
    enabled: activeTab === "login-history"
  });

  const { data: auditLogs = [], isLoading: isAuditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => userService.getAuditLogs(),
    enabled: activeTab === "audit"
  });

  const isAuthorized = currentLoggedUser?.role === "admin" || currentLoggedUser?.role === "operator" || currentLoggedUser?.role === "ketua yayasan";
  const isReadOnly = currentLoggedUser?.role === "ketua yayasan";

  // State management
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // States & Filtering for Master Profil Guru & Musrif
  const [profileSearch, setProfileSearch] = useState("");
  const [profileSertifikasiFilter, setProfileSertifikasiFilter] = useState("");
  const [profileStatusFilter, setProfileStatusFilter] = useState(""); // "Lengkap" | "Belum Lengkap"

  const teacherOrMusrifUsers = (users || []).filter(u => {
    const rolesList = u.roles || [u.role];
    return rolesList.some(r => r === "guru" || r === "musrif");
  });

  const filteredProfileUsers = teacherOrMusrifUsers.filter(u => {
    const matchesSearch = 
      (u.name || "").toLowerCase().includes(profileSearch.toLowerCase()) || 
      (u.email || "").toLowerCase().includes(profileSearch.toLowerCase()) ||
      (u.nuptk || "").toLowerCase().includes(profileSearch.toLowerCase()) ||
      (u.niy || "").toLowerCase().includes(profileSearch.toLowerCase());
    
    const matchesSertifikasi = profileSertifikasiFilter === "" || u.sertifikasi === profileSertifikasiFilter;
    
    const isComplete = u.nuptk && u.nuptk.trim() !== "" && 
                       u.niy && u.niy.trim() !== "" && 
                       u.tempatLahir && u.tempatLahir.trim() !== "" && 
                       u.tanggalLahir && u.tanggalLahir.trim() !== "" && 
                       u.sertifikasi;
    const matchesStatus = profileStatusFilter === "" || 
      (profileStatusFilter === "Lengkap" && isComplete) || 
      (profileStatusFilter === "Belum Lengkap" && !isComplete);

    return matchesSearch && matchesSertifikasi && matchesStatus;
  });

  const handleExportProfilesCSV = () => {
    try {
      const headers = ["Nama Lengkap", "Email", "Peran", "NUPTK", "NIY", "Tempat Lahir", "Tanggal Lahir", "Sertifikasi", "Status Kelengkapan"];
      
      const rows = teacherOrMusrifUsers.map(u => {
        const rolesList = u.roles || [u.role];
        const rolesStr = rolesList.join(", ");
        const isComplete = u.nuptk && u.niy && u.tempatLahir && u.tanggalLahir && u.sertifikasi;
        
        return [
          u.name || "",
          u.email || "",
          rolesStr,
          u.nuptk || "-",
          u.niy || "-",
          u.tempatLahir || "-",
          u.tanggalLahir || "-",
          u.sertifikasi || "-",
          isComplete ? "Lengkap" : "Belum Lengkap"
        ];
      });

      const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `rekap_data_profil_guru_guru_halaqoh.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      toast("Rekap data profil guru & guru halaqoh berhasil diekspor ke CSV!", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengekspor data profil", "error");
    }
  };

  // Helper to format teacher name with degrees/titles (gelar)
  const getTeacherFullName = (teacherId?: string, fallbackName?: string) => {
    if (!teacherId || !teachers) return fallbackName || "";
    const teacher = teachers.find(t => t.id === teacherId || t.teacherId === teacherId);
    if (!teacher) return fallbackName || "";
    return `${teacher.frontTitle ? teacher.frontTitle.trim() + " " : ""}${teacher.name || ""}${teacher.backTitle ? ", " + teacher.backTitle.trim() : ""}`;
  };

  const getTeacherFullNameByEmailOrId = (email?: string, userId?: string, fallbackName?: string) => {
    if (!users || !teachers) return fallbackName || "";
    const foundUser = users.find(u => 
      (userId && u.userId === userId) || 
      (email && u.email?.toLowerCase() === email.toLowerCase())
    );
    if (!foundUser || !foundUser.teacherId) return fallbackName || "";
    return getTeacherFullName(foundUser.teacherId, foundUser.name);
  };

  // Modal states
  const [selectedUser, setSelectedUser] = useState<UserSystem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const [isLinkTeacherOpen, setIsLinkTeacherOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserSystem | null>(null);

  // Import/Export modal states
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<"idle" | "parsing" | "parsed" | "importing" | "completed" | "error">("idle");
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importLogs, setImportLogs] = useState<{ name: string; email: string; username: string; status: "success" | "error"; password?: string; reason?: string }[]>([]);
  const [defaultPassword, setDefaultPassword] = useState("Alkarim123");
  const [generateRandomPasswords, setGenerateRandomPasswords] = useState(true);
  const [importErrorMsg, setImportErrorMsg] = useState("");

  // Form input states (Create)
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createSelectedRoles, setCreateSelectedRoles] = useState<string[]>(["guru"]);
  const [createTeacherId, setCreateTeacherId] = useState("");
  const [generatedUsername, setGeneratedUsername] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    username: string;
    passwordTemp: string;
    email: string;
  } | null>(null);

  const generateUniqueUsername = (fullName: string, existingUsers: UserSystem[]) => {
    if (!fullName) return "";
    const words = fullName.trim().split(/\s+/);
    // Get first word, lowercase, strip non-alphanumeric
    let baseUsername = words[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!baseUsername) baseUsername = "user";

    let username = baseUsername;
    let counter = 1;

    const isTaken = (un: string) => existingUsers.some(u => u.username?.toLowerCase() === un.toLowerCase());

    while (isTaken(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  };

  const generateTempPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const length = Math.floor(Math.random() * 3) + 8; // 8, 9, or 10
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return generateTempPassword();
    }
    return password;
  };

  // Pre-generate password when modal opens
  useEffect(() => {
    if (isCreateOpen) {
      setCreatePassword(generateTempPassword());
      setCreateName("");
      setCreateEmail("");
      setGeneratedUsername("");
      setCreateTeacherId("");
    }
  }, [isCreateOpen]);

  const handleTeacherChange = (teacherId: string) => {
    setCreateTeacherId(teacherId);
    if (teacherId) {
      const teacher = teachers.find(t => t.id === teacherId);
      if (teacher) {
        setCreateName(teacher.name);
        // Generate username
        const generated = generateUniqueUsername(teacher.name, users);
        setGeneratedUsername(generated);
      }
    } else {
      setGeneratedUsername("");
    }
  };

  const handleNameChange = (name: string) => {
    setCreateName(name);
    const generated = generateUniqueUsername(name, users);
    setGeneratedUsername(generated);
  };

  // Form input states (Edit Roles)
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([]);

  // Form input states (Link Teacher / Status)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [newStatus, setNewStatus] = useState<"Aktif" | "Nonaktif" | "Menunggu Aktivasi" | "Ditangguhkan">("Aktif");

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-zinc-950 text-center py-20">
        <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4 border border-rose-100 dark:border-rose-900/50">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Akses Ditolak</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
          Anda tidak memiliki izin untuk mengakses halaman Manajemen Akun. Silakan hubungi Administrator sistem jika Anda memerlukan hak akses ini.
        </p>
      </div>
    );
  }

  const handleCopy = (id: string, ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast("IP berhasil disalin ke papan klip", "success");
  };

  const handleOpenDetail = (user: UserSystem) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const handleOpenEditRoles = (user: UserSystem) => {
    setSelectedUser(user);
    setEditSelectedRoles(user.roles || [user.role]);
    setIsRoleOpen(true);
  };

  const handleOpenLinkTeacher = (user: UserSystem) => {
    setSelectedUser(user);
    setSelectedTeacherId(user.teacherId || "");
    setIsLinkTeacherOpen(true);
  };

  const handleOpenStatus = (user: UserSystem) => {
    setSelectedUser(user);
    setNewStatus(user.status || "Aktif");
    setIsStatusOpen(true);
  };

  const handleSaveRoles = async () => {
    if (isReadOnly) {
      toast("Akses ditolak: Peran Ketua Yayasan hanya memiliki hak akses Baca-Saja (Read-Only) untuk monitoring.", "error");
      return;
    }
    if (!selectedUser) return;
    if (editSelectedRoles.length === 0) {
      toast("Minimal pilih satu peran untuk akun ini", "error");
      return;
    }
    try {
      await updateUserRoles({ userId: selectedUser.userId, roles: editSelectedRoles });
      setIsRoleOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLinkTeacher = async () => {
    if (isReadOnly) {
      toast("Akses ditolak: Peran Ketua Yayasan hanya memiliki hak akses Baca-Saja (Read-Only) untuk monitoring.", "error");
      return;
    }
    if (!selectedUser) return;
    try {
      if (selectedTeacherId !== "") {
        const alreadyLinked = users?.find(u => 
          u.userId !== selectedUser.userId && 
          u.teacherId === selectedTeacherId && 
          (u.status === "Aktif" || u.status === "Menunggu Aktivasi")
        );
        if (alreadyLinked) {
          toast(`Satu SDM hanya boleh terhubung dengan SATU akun aktif. SDM ini sudah terhubung ke akun aktif lain (${alreadyLinked.email}).`, "error");
          return;
        }
      }

      if (selectedTeacherId === "") {
        await linkUserToTeacher({ 
          userId: selectedUser.userId, 
          teacherId: null, 
          teacherName: null 
        });
      } else {
        const teacher = teachers.find(t => t.id === selectedTeacherId);
        await linkUserToTeacher({
          userId: selectedUser.userId,
          teacherId: selectedTeacherId,
          teacherName: teacher ? teacher.name : "Guru"
        });
      }
      setIsLinkTeacherOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveStatus = async () => {
    if (isReadOnly) {
      toast("Akses ditolak: Peran Ketua Yayasan hanya memiliki hak akses Baca-Saja (Read-Only) untuk monitoring.", "error");
      return;
    }
    if (!selectedUser) return;
    if (selectedUser.userId === currentLoggedUser?.uid && newStatus !== "Aktif") {
      toast("Anda tidak bisa menonaktifkan atau menangguhkan akun Anda sendiri!", "error");
      return;
    }
    try {
      await updateUserStatus({ userId: selectedUser.userId, status: newStatus });
      setIsStatusOpen(false);
      setSelectedUser(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (user: UserSystem) => {
    if (isReadOnly) {
      toast("Akses ditolak: Peran Ketua Yayasan hanya memiliki hak akses Baca-Saja (Read-Only) untuk monitoring.", "error");
      return;
    }
    const confirmReset = window.confirm(`Apakah Anda yakin ingin menyetel ulang sandi ${user.name}? Pengguna ini akan dipaksa mengganti kata sandi pada login berikutnya.`);
    if (!confirmReset) return;

    try {
      await resetUserPassword(user.userId);
    } catch (err) {
      console.error(err);
    }
  };

 const handleDeleteAccount = (user: UserSystem) => {
  if (isReadOnly) {
    toast("Akses ditolak: Peran Ketua Yayasan hanya memiliki hak akses Baca-Saja (Read-Only) untuk monitoring.", "error");
    return;
  }
  if (user.userId === currentLoggedUser?.uid) {
    toast("Anda tidak bisa menghapus akun Anda sendiri!", "error");
    return;
  }
  setUserToDelete(user); // buka modal konfirmasi, bukan window.confirm
};

const confirmDeleteAccount = async () => {
  if (!userToDelete) return;
  try {
    await deleteAccount(userToDelete.userId);
  } catch (err) {
    console.error(err);
  } finally {
    setUserToDelete(null);
  }
};

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast("Akses ditolak: Peran Ketua Yayasan hanya memiliki hak akses Baca-Saja (Read-Only) untuk monitoring.", "error");
      return;
    }
    if (!createName) {
      toast("Silakan lengkapi nama lengkap", "error");
      return;
    }
    if (createSelectedRoles.length === 0) {
      toast("Pilih minimal satu peran", "error");
      return;
    }

    const username = generatedUsername || generateUniqueUsername(createName, users);
    const finalEmail = createEmail.trim() || `${username}@smpalkarim.sch.id`;
    const finalPassword = createPassword || generateTempPassword();

    try {
      if (createTeacherId) {
        const alreadyLinked = users?.find(u => 
          u.teacherId === createTeacherId && 
          (u.status === "Aktif" || u.status === "Menunggu Aktivasi")
        );
        if (alreadyLinked) {
          toast(`Satu SDM hanya boleh terhubung dengan SATU akun aktif. SDM ini sudah terhubung ke akun aktif lain (${alreadyLinked.email}).`, "error");
          return;
        }
      }

      const teacher = teachers.find(t => t.id === createTeacherId);
      await createNewAccount({
        email: finalEmail,
        passwordTemp: finalPassword,
        name: createName,
        roles: createSelectedRoles,
        teacherId: createTeacherId || null,
        teacherName: teacher ? teacher.name : null,
        username: username,
        phoneNumber: "" // default empty
      });

      // Save credentials for the display once modal
      setCreatedCredentials({
        name: createName,
        username: username,
        passwordTemp: finalPassword,
        email: createEmail.trim() ? createEmail.trim() : "Login via Username (Email Otomatis)"
      });

      // Reset form states
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateSelectedRoles(["guru"]);
      setCreateTeacherId("");
      setIsCreateOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCreateRole = (roleId: string) => {
    if (createSelectedRoles.includes(roleId)) {
      setCreateSelectedRoles(createSelectedRoles.filter(r => r !== roleId));
    } else {
      setCreateSelectedRoles([...createSelectedRoles, roleId]);
    }
  };

  const toggleEditRole = (roleId: string) => {
    if (editSelectedRoles.includes(roleId)) {
      setEditSelectedRoles(editSelectedRoles.filter(r => r !== roleId));
    } else {
      setEditSelectedRoles([...editSelectedRoles, roleId]);
    }
  };

  const handleExportAccounts = () => {
    try {
      const exportData = users.map(user => ({
        name: user.name || "",
        email: user.email || "",
        username: user.username || "",
        phoneNumber: user.phoneNumber || "",
        roles: user.roles || (user.role ? [user.role] : ["operator"]),
        status: user.status || "Aktif",
        teacherId: user.teacherId || null,
        teacherName: user.teacherName || null,
        permissions: user.permissions || [],
        requirePasswordChange: user.requirePasswordChange ?? true,
        password: "" // optional empty field in template
      }));

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `ekspor_akun_smpalkarim_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      toast("Data akun berhasil diekspor ke JSON!", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengekspor data akun ke JSON", "error");
    }
  };

  const handleExportAccountsCSV = () => {
    try {
      const headers = ["Nama Lengkap", "Email", "Username", "No HP", "Peran", "Status"];
      const rows = users.map(user => [
        user.name || "",
        user.email || "",
        user.username || "",
        user.phoneNumber || "",
        (user.roles || (user.role ? [user.role] : ["operator"])).join(", "),
        user.status || "Aktif"
      ]);

      // Construct CSV content with semicolon delimiter for high Excel compatibility
      const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
      ].join("\r\n");

      // Add BOM to force Excel to read it as UTF-8
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `ekspor_akun_smpalkarim_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
      
      toast("Data akun berhasil diekspor ke CSV (Excel)!", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengekspor data akun ke CSV", "error");
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          name: "Nama Lengkap Guru",
          email: "guru.baru@smpalkarim.sch.id",
          username: "gurubaru",
          phoneNumber: "081234567890",
          roles: ["guru"],
          status: "Aktif",
          teacherId: null,
          teacherName: null,
          permissions: [],
          requirePasswordChange: true,
          password: "SandiSementara123"
        }
      ];

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(templateData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `template_impor_akun_smpalkarim.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      toast("Template impor JSON berhasil diunduh!", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengunduh template JSON", "error");
    }
  };

  const handleDownloadTemplateCSV = () => {
    try {
      const headers = ["Nama Lengkap", "Email", "Username", "No HP", "Peran", "Status", "Sandi Sementara"];
      const exampleRow = [
        "Ahmad Junaidi",
        "ahmad.junaidi@smpalkarim.sch.id",
        "ahmadjunaidi",
        "081234567890",
        "guru",
        "Aktif",
        "SandiSementara123"
      ];

      const csvContent = [
        headers.join(";"),
        exampleRow.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";")
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", url);
      downloadAnchor.setAttribute("download", `template_impor_akun_smpalkarim.csv`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      toast("Template impor CSV (Excel) berhasil diunduh!", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengunduh template CSV", "error");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportStatus("parsing");
    setImportErrorMsg("");

    const isCsv = file.name.endsWith(".csv");

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let parsed: any[] = [];

        if (isCsv) {
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) {
            throw new Error("File CSV kosong.");
          }

          // Auto-detect delimiter (comma or semicolon)
          const headerLine = lines[0].replace(/^\uFEFF/, ""); // Strip UTF-8 BOM if present
          const commaCount = (headerLine.match(/,/g) || []).length;
          const semicolonCount = (headerLine.match(/;/g) || []).length;
          const delimiter = semicolonCount >= commaCount ? ';' : ',';

          const parseRow = (rowText: string) => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < rowText.length; i++) {
              const char = rowText[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === delimiter && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = "";
              } else {
                current += char;
              }
            }
            result.push(current.trim().replace(/^"|"$/g, ''));
            return result;
          };

          const headers = parseRow(headerLine).map(h => h.toLowerCase().trim());

          const findValue = (rowValues: string[], searchKeys: string[]) => {
            const idx = headers.findIndex(h => searchKeys.some(key => h.includes(key)));
            return idx !== -1 ? rowValues[idx] : "";
          };

          for (let i = 1; i < lines.length; i++) {
            const values = parseRow(lines[i]);
            if (values.length === 0 || (values.length === 1 && values[0] === "")) continue;

            const name = findValue(values, ["nama", "name"]);
            const email = findValue(values, ["email"]);
            const username = findValue(values, ["username", "pengguna"]);
            const phoneNumber = findValue(values, ["hp", "telp", "phone", "nomor", "no"]);
            const rawRoles = findValue(values, ["peran", "role", "roles"]);
            const status = findValue(values, ["status"]);
            const password = findValue(values, ["sandi", "password"]);

            if (!name) {
              throw new Error(`Baris ${i + 1} tidak memiliki kolom 'Nama Lengkap'.`);
            }

            let processedRoles: string[] = ["guru"];
            if (rawRoles) {
              processedRoles = rawRoles.split(/[,|]/).map((r: string) => r.trim()).filter(Boolean);
            }

            parsed.push({
              name: name.trim(),
              email: email.trim(),
              username: username.trim(),
              phoneNumber: phoneNumber.trim(),
              roles: processedRoles.length > 0 ? processedRoles : ["guru"],
              status: ["Aktif", "Nonaktif", "Menunggu Aktivasi", "Ditangguhkan"].includes(status) ? status : "Aktif",
              teacherId: null,
              teacherName: null,
              permissions: [],
              requirePasswordChange: true,
              password: password.trim()
            });
          }
        } else {
          // Parse JSON
          const rawParsed = JSON.parse(text);
          if (!Array.isArray(rawParsed)) {
            throw new Error("Data JSON harus berupa array berisi kumpulan akun.");
          }

          parsed = rawParsed.map((item, index) => {
            if (!item.name) {
              throw new Error(`Item baris ${index + 1} tidak memiliki nama lengkap ('name').`);
            }
            return {
              name: item.name.trim(),
              email: (item.email || "").trim(),
              username: (item.username || "").trim(),
              phoneNumber: (item.phoneNumber || "").trim(),
              roles: Array.isArray(item.roles) && item.roles.length > 0 ? item.roles : ["guru"],
              status: ["Aktif", "Nonaktif", "Menunggu Aktivasi", "Ditangguhkan"].includes(item.status) ? item.status : "Aktif",
              teacherId: item.teacherId || null,
              teacherName: item.teacherName || null,
              permissions: Array.isArray(item.permissions) ? item.permissions : [],
              requirePasswordChange: item.requirePasswordChange ?? true,
              password: (item.password || "").trim()
            };
          });
        }

        if (parsed.length === 0) {
          throw new Error("Tidak ada data akun valid yang dapat diimpor.");
        }

        setImportPreview(parsed);
        setImportStatus("parsed");
      } catch (err: any) {
        console.error(err);
        setImportErrorMsg(err.message || "Gagal mengurai file.");
        setImportStatus("error");
      }
    };
    reader.onerror = () => {
      setImportErrorMsg("Gagal membaca file.");
      setImportStatus("error");
    };
    reader.readAsText(file);
  };

  const handleImportNow = async () => {
    if (importPreview.length === 0) return;
    setImportStatus("importing");
    setImportProgress(0);
    
    const logs: typeof importLogs = [];

    for (let i = 0; i < importPreview.length; i++) {
      const item = importPreview[i];
      const username = item.username || generateUniqueUsername(item.name, users);
      const email = item.email || `${username}@smpalkarim.sch.id`;
      
      // Determine temporary password
      let finalPassword = item.password;
      if (!finalPassword) {
        if (generateRandomPasswords) {
          finalPassword = generateTempPassword();
        } else {
          finalPassword = defaultPassword;
        }
      }

      try {
        // Validate if email already exists in our current users list
        const emailExists = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
        if (emailExists) {
          throw new Error("Email ini sudah digunakan oleh akun lain.");
        }

        // Validate if teacherId is already linked to an active user
        if (item.teacherId) {
          const alreadyLinked = users.find(u => 
            u.teacherId === item.teacherId && 
            (u.status === "Aktif" || u.status === "Menunggu Aktivasi")
          );
          if (alreadyLinked) {
            throw new Error(`SDM ini sudah terhubung ke akun aktif lain (${alreadyLinked.email}).`);
          }
        }

        // Call the hook's mutateAsync
        await createNewAccount({
          email: email,
          passwordTemp: finalPassword,
          name: item.name,
          roles: item.roles,
          teacherId: item.teacherId,
          teacherName: item.teacherName,
          username: username,
          phoneNumber: item.phoneNumber
        });

        logs.push({
          name: item.name,
          email: email,
          username: username,
          status: "success",
          password: finalPassword
        });
      } catch (err: any) {
        console.error("Gagal mengimpor akun:", item.name, err);
        logs.push({
          name: item.name,
          email: email,
          username: username,
          status: "error",
          reason: err.message || "Gagal membuat akun"
        });
      }

      setImportProgress(Math.round(((i + 1) / importPreview.length) * 100));
    }

    setImportLogs(logs);
    setImportStatus("completed");
    refetch(); // refresh the main user accounts table
  };

  const handleDownloadImportReport = () => {
    try {
      const successLogs = importLogs.filter(l => l.status === "success");
      if (successLogs.length === 0) return;

      let reportText = `LAPORAN KREDENSIAL AKUN BARU - SMP ALKARIM RASYID\n`;
      reportText += `Tanggal Pembuatan: ${new Date().toLocaleString("id-ID")}\n`;
      reportText += `===============================================\n\n`;

      successLogs.forEach((log, index) => {
        reportText += `${index + 1}. Nama Lengkap : ${log.name}\n`;
        reportText += `   Username     : ${log.username}\n`;
        reportText += `   Email        : ${log.email}\n`;
        reportText += `   Sandi Masuk  : ${log.password}\n`;
        reportText += `   -------------------------------------------\n\n`;
      });

      const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(reportText);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `laporan_kredensial_impor_${new Date().toISOString().slice(0, 10)}.txt`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast("Laporan kredensial berhasil diunduh!", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengunduh laporan kredensial", "error");
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900/50";
      case "kepala sekolah":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-900/50";
      case "wakil kepala sekolah":
        return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900/50";
      case "guru":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50";
      case "musrif":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50";
      case "tata usaha":
        return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900/50";
      case "operator":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900/50";
      case "ketua yayasan":
        return "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-900/50";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/30 dark:text-slate-300 dark:border-slate-900/50";
    }
  };

  const capitalizeRole = (role: string | undefined | null) => {
    if (!role) return "";
    if (role.toLowerCase() === "musrif") return "Guru Halaqoh";
    return role.split(" ").map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : "").join(" ");
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.name || "").toLowerCase().includes(search.toLowerCase()) || 
      (user.email || "").toLowerCase().includes(search.toLowerCase());
    
    const userRoles = user.roles || [user.role];
    const matchesRole = roleFilter === "" || userRoles.some(r => r.toLowerCase() === roleFilter.toLowerCase());
    return matchesSearch && matchesRole;
  });

  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => u.status === "Aktif").length;
  const pendingUsersCount = users.filter(u => u.status === "Menunggu Aktivasi").length;
  const suspendedUsersCount = users.filter(u => u.status === "Ditangguhkan").length;

  return (
    <div className="flex-1 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <UsersIcon className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Manajemen Akun & Hak Akses
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kelola multi-peran pengguna, audit aktivitas, riwayat login, dan hubungan akun dengan data SDM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "accounts" && (
            <>
              {!isReadOnly && (
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Buat Akun Baru
                </button>
              )}
              <button
                onClick={handleExportAccountsCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer transition-all"
                title="Unduh seluruh data akun sebagai file CSV (Excel)"
              >
                <Download className="h-4 w-4" />
                Ekspor CSV (Excel)
              </button>
              <button
                onClick={handleExportAccounts}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-xl shadow-xs cursor-pointer transition-all"
                title="Unduh seluruh data akun sebagai file JSON"
              >
                <Download className="h-4 w-4" />
                Ekspor JSON
              </button>
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setImportFile(null);
                    setImportStatus("idle");
                    setImportPreview([]);
                    setImportProgress(0);
                    setImportLogs([]);
                    setImportErrorMsg("");
                    setIsImportOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs cursor-pointer transition-all"
                  title="Impor kumpulan akun dari file CSV atau JSON"
                >
                  <Upload className="h-4 w-4" />
                  Impor Akun
                </button>
              )}
            </>
          )}
          <button 
            onClick={() => {
              if (activeTab === "accounts") refetch();
              else if (activeTab === "login-history") refetchHistory();
              else if (activeTab === "audit") refetchAudit();
            }} 
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-850 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-zinc-850 shadow-xs cursor-pointer transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Segarkan Data
          </button>
        </div>
      </div>

      {/* Tabs Selection */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 gap-6 overflow-x-auto scrollbar-none shrink-0">
        {[
          { id: "accounts", label: "Daftar Akun", icon: UsersIcon },
          { id: "profiles", label: "Profil Guru & Guru Halaqoh (Master)", icon: FileText },
          { id: "roles", label: "Hak Akses & Peran", icon: Shield },
          { id: "login-history", label: "Riwayat Login", icon: History },
          { id: "audit", label: "Audit Aktivitas", icon: Activity },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                isActive 
                  ? "border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500" 
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ACCOUNTS TAB */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* Stats Bento Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <UsersIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Akun</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">{totalUsersCount}</h3>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Akun Aktif</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">{activeUsersCount}</h3>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Menunggu Aktivasi</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">{pendingUsersCount}</h3>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ditangguhkan</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">{suspendedUsersCount}</h3>
              </div>
            </div>
          </div>

          {/* Filter and Search Section */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="flex gap-2.5 w-full sm:w-auto items-center">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Filter className="h-3.5 w-3.5" />
                Saring Peran:
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs font-medium px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 cursor-pointer text-slate-800 dark:text-white"
              >
                <option value="">Semua Peran</option>
                {AVAILABLE_ROLES.map(role => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Main Table Content */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs overflow-hidden">
            {isUsersLoading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Memuat data pengguna sistem...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-16 text-center">
                <div className="h-12 w-12 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-3">
                  <SingleUserIcon className="h-6 w-6" />
                </div>
                <p className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Data pengguna tidak ditemukan</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Coba ubah kata kunci pencarian atau saringan peran Anda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-zinc-900/50 dark:border-zinc-800">
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16">No</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nama</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peran (Roles)</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">SDM Terkait</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Login Terakhir</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                    {filteredUsers.map((item, index) => {
                      const rolesList = item.roles || [item.role];
                      return (
                        <tr key={item.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/20 transition-colors">
                          <td className="px-5 py-4 text-xs font-semibold text-slate-500">{index + 1}</td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-slate-900 dark:text-white block text-sm">{getTeacherFullName(item.teacherId, item.name)}</span>
                            {item.requirePasswordChange && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase mt-0.5">
                                <KeyRound className="h-2.5 w-2.5 animate-pulse" /> Wajib Ganti Sandi
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-xs font-medium text-slate-700 dark:text-zinc-300 block">{item.email}</span>
                            {item.username && (
                              <span className="text-[10px] font-semibold text-slate-400 font-mono block mt-0.5">@{item.username}</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1">
                              {rolesList.map(r => (
                                <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border capitalize shrink-0 ${getRoleBadgeStyle(r)}`}>
                                  {capitalizeRole(r)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            {item.teacherId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                                  {getTeacherFullName(item.teacherId, item.teacherName || "Terkoneksi")}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Belum terhubung</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {isReadOnly ? (
                              <div
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_BADGES[item.status || "Aktif"]}`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                {item.status || "Aktif"}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleOpenStatus(item)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer border ${STATUS_BADGES[item.status || "Aktif"]}`}
                              >
                                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                                {item.status || "Aktif"}
                              </button>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400">
                            {item.lastLogin ? new Date(item.lastLogin).toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {/* Detail */}
                              <button
                                onClick={() => handleOpenDetail(item)}
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 cursor-pointer"
                                title="Detail Pengguna"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Peran */}
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleOpenEditRoles(item)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 cursor-pointer"
                                  title="Atur Peran (Multi-Role)"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Hubungkan Guru */}
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleOpenLinkTeacher(item)}
                                  className={`p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 ${
                                    item.teacherId ? "hover:text-rose-650" : "hover:text-emerald-600"
                                  } cursor-pointer`}
                                  title={item.teacherId ? "Putus Hubungan Guru" : "Hubungkan ke Guru"}
                                >
                                  {item.teacherId ? <UserMinus className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                                </button>
                              )}

                              {/* Reset Sandi */}
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleResetPassword(item)}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:text-amber-600 cursor-pointer"
                                  title="Ubah Wajib Password Baru"
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Hapus */}
                              {!isReadOnly && (
                                <button
                                  onClick={() => handleDeleteAccount(item)}
                                  disabled={item.userId === currentLoggedUser?.uid}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 dark:text-slate-400 hover:text-rose-600 cursor-pointer disabled:opacity-40"
                                  title="Hapus Akun"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PROFILES TAB (Master Data Guru & Musrif) */}
      {activeTab === "profiles" && (
        <div className="space-y-6">
          {/* Quick stats cards for profiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Guru & Guru Halaqoh</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">{teacherOrMusrifUsers.length}</h3>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Profil Lengkap (Wajib)</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">
                  {teacherOrMusrifUsers.filter(u => u.nuptk && u.nuptk.trim() !== "" && u.niy && u.niy.trim() !== "" && u.tempatLahir && u.tempatLahir.trim() !== "" && u.tanggalLahir && u.tanggalLahir.trim() !== "" && u.sertifikasi).length}
                </h3>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Belum Lengkap</p>
                <h3 className="text-lg font-bold tracking-tight mt-0.5">
                  {teacherOrMusrifUsers.filter(u => !u.nuptk || u.nuptk.trim() === "" || !u.niy || u.niy.trim() === "" || !u.tempatLahir || u.tempatLahir.trim() === "" || !u.tanggalLahir || u.tanggalLahir.trim() === "" || !u.sertifikasi).length}
                </h3>
              </div>
            </div>
          </div>

          {/* Search, Filter, and Export Section */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama, NUPTK, NIY..."
                value={profileSearch}
                onChange={(e) => setProfileSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto items-center justify-end">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Filter className="h-3.5 w-3.5" />
                Saring:
              </div>
              
              <select
                value={profileSertifikasiFilter}
                onChange={(e) => setProfileSertifikasiFilter(e.target.value)}
                className="text-xs font-medium px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 cursor-pointer text-slate-800 dark:text-white"
              >
                <option value="">Semua Sertifikasi</option>
                <option value="Sudah">Sudah Sertifikasi</option>
                <option value="Belum">Belum Sertifikasi</option>
              </select>

              <select
                value={profileStatusFilter}
                onChange={(e) => setProfileStatusFilter(e.target.value)}
                className="text-xs font-medium px-3.5 py-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/25 cursor-pointer text-slate-800 dark:text-white"
              >
                <option value="">Semua Kelengkapan</option>
                <option value="Lengkap">Lengkap</option>
                <option value="Belum Lengkap">Belum Lengkap</option>
              </select>

              <button
                onClick={handleExportProfilesCSV}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer transition-all md:ml-2"
                title="Unduh seluruh rekapitulasi data profil guru & guru halaqoh sebagai file Excel (CSV)"
              >
                <Download className="h-4 w-4" />
                Ekspor Rekap CSV
              </button>
            </div>
          </div>

          {/* Profiles Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs overflow-hidden">
            {filteredProfileUsers.length === 0 ? (
              <div className="p-16 text-center text-slate-500">
                <FileText className="h-12 w-12 mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                <p className="font-semibold text-sm text-slate-700 dark:text-zinc-300">Data profil tidak ditemukan</p>
                <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau saringan filter Anda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-zinc-900/50 dark:border-zinc-800">
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16">No</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nama Lengkap</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Peran Akun</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">NUPTK</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">NIY (Yayasan)</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tempat, Tanggal Lahir</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sertifikasi</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">Status Profil</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50 text-xs">
                    {filteredProfileUsers.map((item, idx) => {
                      const rolesList = item.roles || [item.role];
                      const isComplete = item.nuptk && item.nuptk.trim() !== "" && 
                                         item.niy && item.niy.trim() !== "" && 
                                         item.tempatLahir && item.tempatLahir.trim() !== "" && 
                                         item.tanggalLahir && item.tanggalLahir.trim() !== "" && 
                                         item.sertifikasi;
                      return (
                        <tr key={item.userId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/20 transition-colors">
                          <td className="px-5 py-4 text-xs font-semibold text-slate-500">{idx + 1}</td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-800 dark:text-zinc-100">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">{item.email}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1">
                              {rolesList.map(r => (
                                <span key={r} className="px-1.5 py-0.5 text-[9px] font-bold bg-slate-100 dark:bg-zinc-800 border border-slate-200/50 dark:border-zinc-750 rounded text-slate-600 dark:text-zinc-300 uppercase">
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono font-medium text-slate-600 dark:text-zinc-300">
                            {item.nuptk || <span className="text-rose-400 text-[10px] italic">Belum diisi</span>}
                          </td>
                          <td className="px-5 py-4 font-mono font-medium text-slate-600 dark:text-zinc-300">
                            {item.niy || <span className="text-rose-400 text-[10px] italic">Belum diisi</span>}
                          </td>
                          <td className="px-5 py-4 text-slate-600 dark:text-zinc-300 font-medium">
                            {item.tempatLahir && item.tanggalLahir ? (
                              <span>{item.tempatLahir}, {new Date(item.tanggalLahir).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            ) : (
                              <span className="text-rose-400 text-[10px] italic">Belum diisi</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {item.sertifikasi ? (
                              <span className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                                item.sertifikasi === "Sudah"
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                                  : "bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300"
                              }`}>
                                {item.sertifikasi === "Sudah" ? "Sudah Sertifikasi" : "Belum Sertifikasi"}
                              </span>
                            ) : (
                              <span className="text-rose-400 text-[10px] italic">Belum diisi</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {isComplete ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 rounded-full font-bold text-[9px]">
                                <CheckCircle2 className="h-3 w-3 shrink-0" />
                                Lengkap
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 rounded-full font-bold text-[9px]">
                                <AlertCircle className="h-3 w-3 shrink-0" />
                                Belum Lengkap
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROLES MATRIX TAB */}
      {activeTab === "roles" && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 flex gap-3 text-blue-800 dark:text-blue-300 text-xs">
            <Info className="h-4.5 w-4.5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm">Prinsip Keamanan Prioritas & Kombinasi Multi-Role</span>
              <p className="mt-1 leading-relaxed">
                SMP Alkarim Rasyid menerapkan otorisasi fleksibel multi-peran (misalnya Guru yang juga menjabat Musrif atau Wakil Kepala Sekolah). Urutan prioritas peran tertinggi akan secara otomatis menentukan visual dashboard utama, sedangkan semua otorisasi modul dikombinasikan secara kumulatif untuk memudahkan operasional.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                role: "Ketua Yayasan", 
                priority: 1, 
                desc: "Hanya untuk memantau aktivitas operasional sekolah. Memiliki akses penuh read-only tanpa hak manipulasi data.",
                permissions: ["Akses Semua Dashboard", "Rekap Jurnal Mengajar & Halaqah", "Grafik Kinerja SDM", "Hanya Lihat (Read-Only)"]
              },
              { 
                role: "Kepala Sekolah", 
                priority: 2, 
                desc: "Akses komprehensif terhadap seluruh modul sekolah. Melakukan supervisi akademik & penilaian rapor kinerja guru.",
                permissions: ["Akses Semua Modul Akademik", "Lakukan Penilaian & Supervisi", "Rekapitulasi Kinerja", "Validasi Jurnal Guru"]
              },
              { 
                role: "Wakil Kepala Sekolah (Waka)", 
                priority: 3, 
                desc: "Mengelola area operasional akademik sesuai fungsi kurikulum (Wakakur) atau kesiswaan (Wakasis).",
                permissions: ["Manajemen Jadwal & Mata Pelajaran", "Konfigurasi Semester & Struktur Kurikulum", "Laporan Supervisi Akademik"]
              },
              { 
                role: "Guru", 
                priority: 4, 
                desc: "Peran pendidik fungsional. Wajib terhubung ke data SDM terkait untuk menginput jurnal harian mengajar.",
                permissions: ["Dashboard Mandiri Guru", "Input Jurnal Mengajar Harian", "Modul Pengembangan Diri GTK", "Pencapaian Kinerja"]
              },
              { 
                role: "Musrif", 
                priority: 5, 
                desc: "Mengasuh dan membina kedisiplinan serta ibadah di asrama (Halaqah).",
                permissions: ["Dashboard Musrif", "Input Jurnal Halaqah", "Data Riwayat Kehadiran", "Profil Mandiri"]
              },
              { 
                role: "Tenaga Kependidikan / TU", 
                priority: 6, 
                desc: "Administrasi sekolah meliputi data kesiswaan, kepegawaian, tahun pelajaran, dan kalender pendidikan.",
                permissions: ["Manajemen Murid & Kelas", "Pengaturan Tahun Ajaran & Kalender", "Administrasi Master Data"]
              }
            ].map(r => (
              <div key={r.role} className="bg-white dark:bg-zinc-900 border border-slate-150 dark:border-zinc-800 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">{r.role}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded">
                      Prioritas {r.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mb-4">{r.desc}</p>
                </div>
                <div className="border-t border-slate-100 dark:border-zinc-850 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Otorisasi Fitur:</span>
                  <div className="space-y-1.5">
                    {r.permissions.map(p => (
                      <div key={p} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-300">
                        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOGIN HISTORY TAB */}
      {activeTab === "login-history" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Riwayat Autentikasi Sistem</h3>
              <p className="text-[11px] text-slate-500">Mencatat 200 riwayat login masuk dari seluruh pengurus sistem.</p>
            </div>
            <button
              onClick={() => refetchHistory()}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-500"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {isHistoryLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Memuat riwayat login...</p>
            </div>
          ) : loginHistory.length === 0 ? (
            <div className="p-16 text-center text-slate-500">Belum ada riwayat masuk sistem yang tercatat.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-zinc-900/50 dark:border-zinc-800">
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16">No</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Waktu</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pengguna</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Perangkat (Browser / OS)</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Alamat IP</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                  {loginHistory.map((log, index) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/20 text-xs">
                      <td className="px-5 py-3.5 font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-5 py-3.5 text-slate-500">{new Date(log.timestamp).toLocaleString("id-ID")}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-slate-800 dark:text-zinc-200 block">
                          {getTeacherFullNameByEmailOrId(log.email, log.userId, log.name)}
                        </span>
                        <span className="text-[10px] text-slate-400">{log.email}</span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {log.browser} • <span className="font-semibold text-slate-700 dark:text-zinc-300">{log.os}</span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 dark:text-zinc-300">
                        <div className="flex items-center gap-1.5">
                          <span>{log.ip}</span>
                          <button
                            onClick={() => handleCopy(log.id, log.ip)}
                            className="text-slate-400 hover:text-blue-500 cursor-pointer p-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800"
                            title="Salin Alamat IP"
                          >
                            {copiedId === log.id ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                          log.status === "Sukses"
                            ? "bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20"
                            : "bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20"
                        }`}>
                          {log.status === "Sukses" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                          {log.status}
                          {log.reason && <span className="font-light italic text-[9px] text-rose-400 ml-1">({log.reason})</span>}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === "audit" && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Audit Aktivitas Kepegawaian & Sistem</h3>
              <p className="text-[11px] text-slate-500">Mencatat 250 log perubahan konfigurasi, hak akses, dan administrasi pengguna secara kronologis.</p>
            </div>
            <button
              onClick={() => refetchAudit()}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl text-slate-500"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {isAuditLoading ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-500 border-t-transparent" />
              <p className="text-xs text-slate-500 dark:text-slate-400">Memuat log audit...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-16 text-center text-slate-500">Belum ada aktivitas kepegawaian yang tercatat.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100 dark:bg-zinc-900/50 dark:border-zinc-800">
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-16">No</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operator</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tindakan</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">ID Dokumen</th>
                    <th className="px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Deskripsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                  {auditLogs.map((log, index) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/20 text-xs">
                      <td className="px-5 py-3.5 font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-5 py-3.5 text-slate-500">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-zinc-200">
                        {getTeacherFullNameByEmailOrId(undefined, log.userId, log.userName || "Operator")}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-extrabold text-[9px] uppercase border ${
                          log.action.includes("CREATE")
                            ? "bg-emerald-50 text-emerald-700 border-emerald-250"
                            : log.action.includes("UPDATE")
                            ? "bg-blue-50 text-blue-700 border-blue-250"
                            : "bg-rose-50 text-rose-700 border-rose-250"
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400 text-[10px] select-all">{log.documentId}</td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-zinc-300 font-medium leading-relaxed">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE ACCOUNT MODAL */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-zinc-50 my-8"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-blue-500" />
                  Buat Akun Operator / GTK Baru
                </h3>
                <button 
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      required
                      value={createName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g. Ahmad Fauzi, S.Pd"
                      className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Username (Otomatis)</label>
                    <input
                      type="text"
                      disabled
                      value={generatedUsername}
                      placeholder="Generated otomatis..."
                      className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-500 dark:text-slate-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Alamat Email (Opsional)</label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="fauzi@sekolah.sch.id (kosongkan jika login via username)"
                    className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white"
                  />
                  <p className="text-[9px] text-slate-400 mt-1">
                    * Jika kosong, sistem otomatis membuat email login internal berbasis username. Pengguna dapat login menggunakan Username + Password.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Sandi Sementara (Otomatis & Wajib Diganti)</label>
                  <input
                    type="text"
                    required
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Sandi sementara"
                    className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Sandi di atas telah dibuat secara acak. Pengguna wajib memperbarui sandi ini saat masuk pertama kali.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Penugasan Hak Akses (Multi-Role)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    {AVAILABLE_ROLES.map(role => {
                      const isChecked = createSelectedRoles.includes(role.id);
                      return (
                        <button
                          type="button"
                          key={role.id}
                          onClick={() => toggleCreateRole(role.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-[10px] font-bold border transition-all text-left cursor-pointer ${
                            isChecked
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          <span className="truncate">{role.name}</span>
                          {isChecked && <Check className="h-3 w-3 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Hubungkan ke Data Master SDM</label>
                  <select
                    value={createTeacherId}
                    onChange={(e) => handleTeacherChange(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden cursor-pointer text-slate-900 dark:text-white"
                  >
                    <option value="">-- Lewati / Bukan Guru (Staf Operator/TU) --</option>
                    {isTeachersLoading ? (
                      <option disabled>Memuat daftar guru...</option>
                    ) : (
                      teachers.map(t => {
                        const nameWithTitle = `${t.frontTitle ? t.frontTitle.trim() + " " : ""}${t.name || ""}${t.backTitle ? ", " + t.backTitle.trim() : ""}`;
                        return (
                          <option key={t.id} value={t.id}>{nameWithTitle} — NIY {t.niy}</option>
                        );
                      })
                    )}
                  </select>
                </div>

                <div className="mt-6 flex justify-end gap-2 text-xs font-semibold pt-4 border-t border-slate-100 dark:border-zinc-800">
                  <button 
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreatingAccount}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCreatingAccount && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                    Buat Akun
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT ROLES MODAL */}
      <AnimatePresence>
        {isRoleOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900 dark:text-zinc-50"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <h3 className="text-base font-bold tracking-tight">Atur Peran Akses (Multi-Role)</h3>
                <button 
                  onClick={() => setIsRoleOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nama Akun</label>
                  <div className="font-semibold text-xs bg-slate-50 dark:bg-zinc-950 p-2.5 border border-slate-100 dark:border-zinc-800 mt-1 rounded-xl">
                    {getTeacherFullName(selectedUser.teacherId, selectedUser.name)} ({selectedUser.email})
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Penugasan Peran</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-950 p-3 rounded-2xl border border-slate-200 dark:border-zinc-800">
                    {AVAILABLE_ROLES.map(role => {
                      const isChecked = editSelectedRoles.includes(role.id);
                      return (
                        <button
                          type="button"
                          key={role.id}
                          onClick={() => toggleEditRole(role.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-[10px] font-bold border transition-all text-left cursor-pointer ${
                            isChecked
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400"
                          }`}
                        >
                          <span className="truncate">{role.name}</span>
                          {isChecked && <Check className="h-3 w-3 shrink-0 ml-1" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    * Akun dapat memiliki banyak peran sekaligus. Sistem akan mendeteksi peran-peran tersebut secara dinamis.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 text-xs font-semibold">
                <button 
                  onClick={() => setIsRoleOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveRoles}
                  disabled={isUpdatingRoles}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdatingRoles && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* STATUS STATUS MODAL */}
      <AnimatePresence>
        {isStatusOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900 dark:text-zinc-50"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <h3 className="text-base font-bold tracking-tight">Perbarui Status Akun</h3>
                <button 
                  onClick={() => setIsStatusOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nama Akun</label>
                  <div className="font-semibold text-xs bg-slate-50 dark:bg-zinc-950 p-2.5 border border-slate-100 dark:border-zinc-800 mt-1 rounded-xl">
                    {getTeacherFullName(selectedUser.teacherId, selectedUser.name)}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Status Keaktifan</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden cursor-pointer text-slate-900 dark:text-white"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Nonaktif">Nonaktif</option>
                    <option value="Menunggu Aktivasi">Menunggu Aktivasi</option>
                    <option value="Ditangguhkan">Ditangguhkan</option>
                  </select>
                  <p className="text-[10px] text-slate-450 mt-1.5 leading-relaxed">
                    * Hanya akun dengan status <strong>Aktif</strong> yang diizinkan masuk ke sistem. Status lainnya akan diblokir otomatis.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 text-xs font-semibold">
                <button 
                  onClick={() => setIsStatusOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveStatus}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  Simpan Status
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* DELETE CONFIRM MODAL */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl text-slate-900 dark:text-zinc-50"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <h3 className="text-base font-bold tracking-tight text-rose-600">Hapus Akun</h3>
                <button
                  onClick={() => setUserToDelete(null)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus akun <strong>{getTeacherFullName(userToDelete.teacherId, userToDelete.name)}</strong> secara permanen?
                Akun ini akan di-<strong>soft-delete</strong> dari sistem.
              </p>

              <div className="mt-6 flex justify-end gap-2 text-xs font-semibold">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteAccount}
                  disabled={isDeletingAccount}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingAccount ? "Menghapus..." : "Hapus Akun"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LINK TEACHER MODAL */}
      <AnimatePresence>
        {isLinkTeacherOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-slate-900 dark:text-zinc-50"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <h3 className="text-base font-bold tracking-tight">Hubungkan Akun ke Guru</h3>
                <button 
                  onClick={() => setIsLinkTeacherOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Nama Akun Login</label>
                  <div className="font-semibold text-xs bg-slate-50 dark:bg-zinc-950 p-2.5 border border-slate-100 dark:border-zinc-800 mt-1 rounded-xl">
                    {getTeacherFullName(selectedUser.teacherId, selectedUser.name)} ({selectedUser.email})
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Guru Terkait</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden cursor-pointer text-slate-900 dark:text-white"
                  >
                    <option value="">-- Putuskan Hubungan Guru (Unlink) --</option>
                    {isTeachersLoading ? (
                      <option disabled>Memuat guru...</option>
                    ) : (
                      teachers.map(t => {
                        const nameWithTitle = `${t.frontTitle ? t.frontTitle.trim() + " " : ""}${t.name || ""}${t.backTitle ? ", " + t.backTitle.trim() : ""}`;
                        return (
                          <option key={t.id} value={t.id}>{nameWithTitle} — NIY {t.niy}</option>
                        );
                      })
                    )}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                    * Menghubungkan akun login dengan data Guru Master sangat penting fungsionalnya agar data rekap jurnal harian dan performa GTK terintegrasi dengan benar.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 text-xs font-semibold">
                <button 
                  onClick={() => setIsLinkTeacherOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveLinkTeacher}
                  disabled={isLinkingTeacher}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isLinkingTeacher && <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Simpan Hubungan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAIL USER MODAL */}
      <AnimatePresence>
        {isDetailOpen && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl overflow-hidden text-slate-900 dark:text-zinc-50"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <h3 className="text-base font-bold tracking-tight">Detail Pengguna Sistem</h3>
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <SingleUserIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedUser.name}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {selectedUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Peran Terdaftar</span>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(selectedUser.roles || [selectedUser.role]).map(r => (
                        <span key={r} className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border capitalize ${getRoleBadgeStyle(r)}`}>
                          {capitalizeRole(r)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Status Akun</span>
                    <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_BADGES[selectedUser.status || "Aktif"]}`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                      {selectedUser.status || "Aktif"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-800 pt-3 space-y-2.5">
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">ID Pengguna (Auth UID)</span>
                    <span className="font-mono text-slate-700 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-950 px-2 py-1 rounded block mt-1 select-all">
                      {selectedUser.userId}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">SDM / Guru Terkait</span>
                    <div className="mt-1 p-2 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-850/50">
                      {selectedUser.teacherId ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">{selectedUser.teacherName}</span>
                          <span className="text-[10px] text-slate-400">ID Guru: {selectedUser.teacherId}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Belum dihubungkan ke data master guru.</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Terdaftar Pada</span>
                      <span className="font-semibold text-slate-700 dark:text-zinc-300 mt-1 block">
                        {new Date(selectedUser.createdAt).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[10px]">Login Terakhir</span>
                      <span className="font-semibold text-slate-700 dark:text-zinc-300 mt-1 block">
                        {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString("id-ID") : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Tutup Detail
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CREDENTIALS SUCCESS DISPLAY MODAL */}
      <AnimatePresence>
        {createdCredentials && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-zinc-50"
            >
              <div className="flex flex-col items-center text-center pb-2 mb-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3 border border-emerald-500/25">
                  <CheckCircle2 className="h-7 w-7 animate-bounce" />
                </div>
                <h3 className="text-lg font-bold tracking-tight text-white">Akun Berhasil Dibuat!</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Kredensial login berikut hanya ditampilkan sekali. Mohon salin dan berikan kepada pengguna secara aman.
                </p>
              </div>

              <div className="space-y-3 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl font-mono text-xs">
                <div>
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px] block">Nama Lengkap</span>
                  <span className="text-white font-semibold block mt-0.5 text-sm">{createdCredentials.name}</span>
                </div>
                <div className="border-t border-zinc-800/60 pt-2.5">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px] block">Username Login</span>
                  <span className="text-blue-400 font-bold block mt-0.5 text-sm select-all">{createdCredentials.username}</span>
                </div>
                <div className="border-t border-zinc-800/60 pt-2.5">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px] block">Kata Sandi Sementara</span>
                  <span className="text-yellow-400 font-bold block mt-0.5 text-sm select-all">{createdCredentials.passwordTemp}</span>
                </div>
                <div className="border-t border-zinc-800/60 pt-2.5">
                  <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[9px] block">Alamat Email</span>
                  <span className="text-zinc-300 block mt-0.5 text-xs select-all">{createdCredentials.email}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button 
                  onClick={() => {
                    const text = `Kredensial Akun Baru:\nNama: ${createdCredentials.name}\nUsername: ${createdCredentials.username}\nKata Sandi: ${createdCredentials.passwordTemp}\nEmail: ${createdCredentials.email}`;
                    navigator.clipboard.writeText(text);
                    toast("Seluruh kredensial berhasil disalin!", "success");
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <Copy className="h-4 w-4" />
                  Salin Seluruh Kredensial
                </button>
                <button 
                  onClick={() => setCreatedCredentials(null)}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 font-bold text-xs rounded-xl cursor-pointer text-zinc-300 transition-all text-center border border-zinc-700"
                >
                  Tutup & Selesai
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IMPORT ACCOUNTS MODAL */}
      <AnimatePresence>
        {isImportOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl text-slate-900 dark:text-zinc-50 my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-purple-600" />
                  <h3 className="text-base font-bold tracking-tight">Impor Akun Pengguna</h3>
                </div>
                <button 
                  onClick={() => setIsImportOpen(false)}
                  disabled={importStatus === "importing"}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* IDLE state - Ask for file upload */}
              {importStatus === "idle" && (
                <div className="space-y-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Sistem mendukung impor massal akun pengguna melalui format **Excel CSV** (Semicolon atau Comma separated) atau **JSON**. Akun-akun baru akan didaftarkan secara aman ke sistem harian.
                  </div>

                  <div className="border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-all relative">
                    <input 
                      type="file" 
                      accept=".csv,.json" 
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 bg-slate-50 dark:bg-zinc-950 rounded-xl flex items-center justify-center text-slate-400 mb-2">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200">Pilih atau Seret file CSV / JSON Anda di sini</span>
                      <span className="text-[10px] text-slate-400 mt-1">Maksimal ukuran file 2MB (.csv, .json)</span>
                    </div>
                  </div>

                  {/* Template Download Section */}
                  <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-850 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-850 dark:text-white">Butuh panduan format?</span>
                        <p className="text-[10px] text-slate-550 dark:text-zinc-400">Unduh file template kosong agar format impor Anda tepat.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={handleDownloadTemplateCSV}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] rounded-lg border border-emerald-150 dark:border-emerald-900/50 transition-all cursor-pointer"
                      >
                        <Download className="h-3 w-3" />
                        Template CSV (Excel)
                      </button>
                      <button
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-[10px] rounded-lg border border-blue-100 dark:border-blue-900 transition-all cursor-pointer"
                      >
                        <Download className="h-3 w-3" />
                        Template JSON
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PARSING state - Loader */}
              {importStatus === "parsing" && (
                <div className="py-10 text-center flex flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sedang mengurai file...</p>
                </div>
              )}

              {/* ERROR state - Error details */}
              {importStatus === "error" && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex gap-3 text-rose-700 dark:text-rose-400 text-xs">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div>
                      <span className="font-bold text-sm block">Gagal Mengurai File</span>
                      <p className="mt-1 leading-relaxed">{importErrorMsg}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 text-xs font-semibold">
                    <button 
                      onClick={() => setImportStatus("idle")}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                    >
                      Coba File Lain
                    </button>
                  </div>
                </div>
              )}

              {/* PARSED state - Show preview & setting default password */}
              {importStatus === "parsed" && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-2xl flex gap-2.5 text-emerald-800 dark:text-emerald-400 text-xs">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-sm block">File Berhasil Terbaca!</span>
                      <p className="mt-0.5">Ditemukan **{importPreview.length}** data akun yang siap dimasukkan ke dalam database.</p>
                    </div>
                  </div>

                  {/* Settings */}
                  <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-150 dark:border-zinc-850 space-y-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pengaturan Sandi Pengguna Baru</span>
                    
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                        <input 
                          type="checkbox" 
                          checked={generateRandomPasswords} 
                          onChange={(e) => setGenerateRandomPasswords(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span>Buat kata sandi acak otomatis untuk tiap akun</span>
                      </label>

                      {!generateRandomPasswords && (
                        <div className="mt-1 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Sandi Default Impor</label>
                          <input 
                            type="text" 
                            value={defaultPassword}
                            onChange={(e) => setDefaultPassword(e.target.value)}
                            className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden text-slate-900 dark:text-white"
                            placeholder="Contoh: Alkarim123"
                          />
                          <p className="text-[9px] text-slate-400">Sandi default minimal 6 karakter kombinasi huruf & angka.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Preview list */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pratinjau Data Akun</span>
                    <div className="max-h-40 overflow-y-auto border border-slate-150 dark:border-zinc-800 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800">
                      {importPreview.map((user, idx) => (
                        <div key={idx} className="p-3 text-xs flex justify-between items-center hover:bg-slate-50/50 dark:hover:bg-zinc-850/10">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-white block">{user.name}</span>
                            <span className="text-[10px] text-slate-400">{user.email || `@${user.username}`}</span>
                          </div>
                          <div className="flex gap-1">
                            {user.roles.map((r: string) => (
                              <span key={r} className="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-100 capitalize">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2 text-xs font-semibold pt-4 border-t border-slate-100 dark:border-zinc-800">
                    <button 
                      onClick={() => setImportStatus("idle")}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleImportNow}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      Mulai Impor Sekarang
                    </button>
                  </div>
                </div>
              )}

              {/* IMPORTING state - Progress bar */}
              {importStatus === "importing" && (
                <div className="py-8 space-y-4 text-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-purple-500 border-t-transparent mx-auto" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200">Mendaftarkan Akun Baru ke Sistem...</p>
                    <p className="text-[10px] text-slate-450">Proses {importProgress}% selesai</p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-zinc-850 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-purple-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-amber-650 font-medium">Mohon tidak menutup jendela atau menyegarkan halaman selama proses impor berlangsung.</p>
                </div>
              )}

              {/* COMPLETED state - Summary report with download option */}
              {importStatus === "completed" && (
                <div className="space-y-4">
                  {/* Result Panel */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900/50 rounded-2xl text-center">
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-2xl block">
                        {importLogs.filter(l => l.status === "success").length}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Sukses Dibuat</span>
                    </div>
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900/50 rounded-2xl text-center">
                      <span className="text-rose-600 dark:text-rose-400 font-extrabold text-2xl block">
                        {importLogs.filter(l => l.status === "error").length}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Gagal Terbuat</span>
                    </div>
                  </div>

                  {/* Success Credentials List */}
                  {importLogs.filter(l => l.status === "success").length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Kredensial Akun Baru</span>
                        <button
                          onClick={handleDownloadImportReport}
                          className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:underline cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          Unduh Laporan Kredensial (.txt)
                        </button>
                      </div>

                      <div className="max-h-44 overflow-y-auto border border-slate-150 dark:border-zinc-850 rounded-2xl divide-y divide-slate-100 dark:divide-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50">
                        {importLogs.filter(l => l.status === "success").map((log, idx) => (
                          <div key={idx} className="p-3 text-xs flex justify-between items-center hover:bg-slate-50 dark:hover:bg-zinc-850/10">
                            <div>
                              <span className="font-bold text-slate-850 dark:text-white block">{log.name}</span>
                              <span className="text-[10px] text-slate-450 block mt-0.5">Username: <strong className="text-blue-600 dark:text-blue-400 font-mono">@{log.username}</strong></span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-zinc-400 font-medium block">Sandi Masuk:</span>
                              <span className="text-[11px] text-yellow-600 dark:text-yellow-400 font-bold font-mono">{log.password}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Failure Logs (if any) */}
                  {importLogs.filter(l => l.status === "error").length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider block">Log Kegagalan</span>
                      <div className="max-h-24 overflow-y-auto border border-rose-100 dark:border-rose-950/50 rounded-2xl divide-y divide-rose-50/50 dark:divide-rose-950/20 bg-rose-50/10">
                        {importLogs.filter(l => l.status === "error").map((log, idx) => (
                          <div key={idx} className="p-2.5 text-[10px] flex justify-between items-start">
                            <div>
                              <strong className="text-slate-800 dark:text-zinc-200 block">{log.name}</strong>
                              <span className="text-slate-400 font-mono text-[9px] mt-0.5">@{log.username} | {log.email}</span>
                            </div>
                            <span className="text-rose-600 text-[10px] font-medium ml-2 text-right">{log.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-col gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800">
                    {importLogs.filter(l => l.status === "success").length > 0 && (
                      <button 
                        onClick={() => {
                          const successLogs = importLogs.filter(l => l.status === "success");
                          const text = successLogs.map(l => `Nama: ${l.name}\nUsername: ${l.username}\nEmail: ${l.email}\nSandi: ${l.password}`).join("\n\n");
                          navigator.clipboard.writeText(text);
                          toast("Semua kredensial sukses disalin ke clipboard!", "success");
                        }}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Copy className="h-4 w-4" />
                        Salin Semua Kredensial Baru
                      </button>
                    )}
                    <button 
                      onClick={() => setIsImportOpen(false)}
                      className="w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 font-bold text-xs rounded-xl text-center text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Tutup & Selesai
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
