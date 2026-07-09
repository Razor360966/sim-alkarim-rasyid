import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTeachers } from "../hooks/useTeachers";
import { FormInput, FormSelect } from "../components/FormInput";
import { Dialog } from "../components/Dialog";
import { useToast } from "../contexts/ToastContext";
import { 
  GraduationCap, 
  Plus, 
  Search, 
  Eye, 
  Edit2, 
  Trash2, 
  Calendar, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  FileKey, 
  Info, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  X,
  FileClock,
  Check,
  Bookmark,
  Briefcase,
  Award
} from "lucide-react";
import { Teacher } from "../types";

// Schema Validation according to specifications
const teacherSchema = z.object({
  niy: z.string().optional().or(z.literal("")),
  nuptk: z.string().optional().or(z.literal("")),
  name: z.string().min(3, { message: "Nama lengkap minimal 3 karakter" }),
  gender: z.enum(["L", "P"], { message: "Pilih jenis kelamin" }),
  birthPlace: z.string().optional().or(z.literal("")),
  birthDate: z.string().optional().or(z.literal("")).refine((val) => {
  // Jika kosong, anggap valid
  if (!val) return true;

  const selectedDate = new Date(val);
  const today = new Date();

  selectedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return selectedDate <= today;
}, {
  message: "Tanggal lahir tidak boleh melebihi tanggal hari ini"
}),
  address: z.string().optional().or(z.literal("")),
  phone: z.preprocess(
  (v) => v === "" ? undefined : v,
  z.string()
    .regex(/^\d+$/, "Nomor HP hanya boleh berisi angka")
    .optional()
),
  email: z.preprocess(
  (v) => v === "" ? undefined : v,
  z.string().email("Email harus valid").optional()
),
  status: z.enum(["Aktif", "Cuti", "Nonaktif", "Pensiun"], { message: "Pilih status keaktifan" }).default("Aktif"),
  frontTitle: z.string().optional().or(z.literal("")),
  backTitle: z.string().optional().or(z.literal("")),
  nickName: z.string().optional().or(z.literal("")),
  religion: z.string().optional().or(z.literal("")),
  employeeType: z.string().min(1, { message: "Pilih jenis PTK" }).default("Guru"),
  employmentStatus: z.string().min(1, { message: "Pilih status kepegawaian" }).default("Tetap Yayasan"),
  joinDate: z.string().optional().or(z.literal("")).refine((val) => {
  if (!val) return true;

  const selectedDate = new Date(val);
  const today = new Date();

  selectedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return selectedDate <= today;
}, {
  message: "Tanggal bergabung tidak boleh melebihi tanggal hari ini"
}),
  photoUrl: z.string().optional().or(z.literal(""))
});

type TeacherFormValues = any;

const JABATAN_OPTIONS = [
  { id: "guru", label: "Guru" },
  { id: "musrif", label: "Musrif" },
  { id: "kepala_sekolah", label: "Kepala Sekolah" },
  { id: "wakakur", label: "Wakakur" },
  { id: "wakasis", label: "Wakasis" },
  { id: "operator", label: "Operator" },
  { id: "tu", label: "TU" },
  { id: "bendahara", label: "Bendahara" },
  { id: "ketua_yayasan", label: "Ketua Yayasan" }
];

const parseEmployeeTypeToRoles = (type: string): string[] => {
  if (!type) return ["guru"];
  const roles: string[] = [];
  const parts = type.split(", ").map(item => item.trim().toLowerCase());
  
  if (parts.some(p => p.includes("guru"))) roles.push("guru");
  if (parts.some(p => p.includes("musrif"))) roles.push("musrif");
  if (parts.some(p => p.includes("kepala sekolah"))) roles.push("kepala_sekolah");
  if (parts.some(p => p.includes("wakakur") || p.includes("kurikulum"))) roles.push("wakakur");
  if (parts.some(p => p.includes("wakasis") || p.includes("kesiswaan"))) roles.push("wakasis");
  if (parts.some(p => p.includes("operator"))) roles.push("operator");
  if (parts.some(p => p.includes("tata usaha") || p.includes("tu"))) roles.push("tu");
  if (parts.some(p => p.includes("bendahara"))) roles.push("bendahara");
  if (parts.some(p => p.includes("yayasan") || p.includes("pimpinan"))) roles.push("ketua_yayasan");
  
  if (roles.length === 0) roles.push("guru");
  return roles;
};

export const Teachers: React.FC = () => {
  const { toast } = useToast();
  
  // Custom teacher hooks
  const { 
    teachers, 
    isLoading, 
    createTeacher, 
    updateTeacher, 
    deleteTeacher,
    isCreating,
    isUpdating,
    isDeleting 
  } = useTeachers();

  // Multi-role states
  const [createJabatans, setCreateJabatans] = useState<string[]>(["guru"]);
  const [editJabatans, setEditJabatans] = useState<string[]>([]);

  const toggleCreateJabatan = (id: string) => {
    setCreateJabatans(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  const toggleEditJabatan = (id: string) => {
    setEditJabatans(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  // Search, Filter, Sorting, & Pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Semua" | "Aktif" | "Cuti" | "Nonaktif" | "Pensiun">("Semua");
  const [sortBy, setSortBy] = useState<"Nama A-Z" | "Nama Z-A" | "NIY" | "Tanggal Update">("Nama A-Z");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Forms setup
  const createForm = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      niy: "",
      nuptk: "",
      name: "",
      gender: "L",
      birthPlace: "",
      birthDate: "",
      address: "",
      phone: "",
      email: "",
      status: "Aktif",
      frontTitle: "",
      backTitle: "",
      nickName: "",
      religion: "",
      employeeType: "Guru",
      employmentStatus: "Tetap Yayasan",
      joinDate: "",
      photoUrl: ""
    }
  });

  const editForm = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherSchema)
  });

  // Helper: Format Firestore Timestamps safely for form date picker (YYYY-MM-DD)
  const formatTimestampToInputDate = (ts: any): string => {
    if (!ts) return "";
    if (typeof ts.toDate === "function") {
      const d = ts.toDate();
      return d.toISOString().split("T")[0];
    }
    try {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    } catch (e) {}
    return "";
  };

  // Helper: Elegant date and birthplace display ("Jakarta, 12 Desember 1985")
  const formatBirthDetails = (birthPlace: string, ts: any): string => {
    if (!ts) return birthPlace || "-";
    let dateStr = "";
    try {
      const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
      if (!isNaN(d.getTime())) {
        dateStr = d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric"
        });
      }
    } catch (e) {}
    return birthPlace ? `${birthPlace}, ${dateStr}` : dateStr || "-";
  };

  // Helper: Date format for "Terakhir Diubah"
  const formatLastModified = (updatedAt: any): string => {
    if (!updatedAt) return "-";
    try {
      const d = typeof updatedAt.toDate === "function" ? updatedAt.toDate() : new Date(updatedAt);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("id-ID", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }) + " WIB";
      }
    } catch (e) {}
    return "-";
  };

  // Process data with Search, Filter, and Sort (done in memory for robustness and reliability)
  const processedTeachers = useMemo(() => {
    let result = [...teachers];

    // 1. Status Filtering
    if (statusFilter !== "Semua") {
      result = result.filter(t => {
        let normStatus = "Aktif";
        if (t.status === true || t.status === "Aktif") normStatus = "Aktif";
        else if (t.status === false || t.status === "Nonaktif") normStatus = "Nonaktif";
        else if (t.status === "Cuti") normStatus = "Cuti";
        else if (t.status === "Pensiun") normStatus = "Pensiun";
        return normStatus === statusFilter;
      });
    }

    // 2. Real-time Search
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        (t.name || "").toLowerCase().includes(q) ||
        (t.niy || "").toLowerCase().includes(q) ||
        (t.nuptk || "").toLowerCase().includes(q)
      );
    }

    // 3. Sorting
    result.sort((a, b) => {
      if (sortBy === "Nama A-Z") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "Nama Z-A") {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (sortBy === "NIY") {
        return (a.niy || "").localeCompare(b.niy || "");
      }
      if (sortBy === "Tanggal Update") {
        const timeA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : new Date(a.updatedAt || 0).getTime();
        const timeB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : new Date(b.updatedAt || 0).getTime();
        return timeB - timeA; // Descending
      }
      return 0;
    });

    return result;
  }, [teachers, searchQuery, statusFilter, sortBy]);

  // Pagination calculation
  const totalItems = processedTeachers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const adjustedPage = currentPage > totalPages ? totalPages : currentPage;

  const paginatedTeachers = useMemo(() => {
    const startIdx = (adjustedPage - 1) * itemsPerPage;
    return processedTeachers.slice(startIdx, startIdx + itemsPerPage);
  }, [processedTeachers, adjustedPage]);

  // Handlers for Add/Create Dialog
  const handleCreateOpen = () => {
    setCreateJabatans(["guru"]);
    createForm.reset({
      niy: "",
      nuptk: "",
      name: "",
      gender: "L",
      birthPlace: "",
      birthDate: "",
      address: "",
      phone: "",
      email: "",
      status: "Aktif",
      frontTitle: "",
      backTitle: "",
      nickName: "",
      religion: "",
      employeeType: "Guru",
      employmentStatus: "Tetap Yayasan",
      joinDate: "",
      photoUrl: ""
    });
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (data: TeacherFormValues) => {
    try {
      const selectedLabels = createJabatans.map(id => JABATAN_OPTIONS.find(o => o.id === id)?.label || id);
      const combinedPayload = {
        ...data,
        roles: createJabatans,
        employeeType: selectedLabels.join(", ")
      };
      await createTeacher(combinedPayload);
      toast("Berhasil Menambah Guru", "success");
      setIsCreateOpen(false);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "";
      if (errMsg.includes("NIY")) {
        createForm.setError("niy", { message: "NIY sudah terdaftar!" });
      } else if (errMsg.includes("NUPTK")) {
        createForm.setError("nuptk", { message: "NUPTK sudah terdaftar!" });
      } else {
        toast("Gagal Menyimpan Data", "error");
      }
    }
  };

  // Handlers for Edit Dialog
  const handleEditOpen = (teacher: any) => {
    setSelectedTeacher(teacher);
    let currentStatus = "Aktif";
    if (teacher.status === true || teacher.status === "Aktif") currentStatus = "Aktif";
    else if (teacher.status === false || teacher.status === "Nonaktif") currentStatus = "Nonaktif";
    else if (teacher.status === "Cuti") currentStatus = "Cuti";
    else if (teacher.status === "Pensiun") currentStatus = "Pensiun";

    const rolesParsed = teacher.roles || parseEmployeeTypeToRoles(teacher.employeeType);
    setEditJabatans(rolesParsed);

    editForm.reset({
      niy: teacher.niy || "",
      nuptk: teacher.nuptk || "",
      name: teacher.name || "",
      gender: teacher.gender || "L",
      birthPlace: teacher.birthPlace || "",
      birthDate: formatTimestampToInputDate(teacher.birthDate),
      address: teacher.address || "",
      phone: teacher.phone || "",
      email: teacher.email || "",
      status: currentStatus,
      frontTitle: teacher.frontTitle || "",
      backTitle: teacher.backTitle || "",
      nickName: teacher.nickName || "",
      religion: teacher.religion || "",
      employeeType: teacher.employeeType || "Guru",
      employmentStatus: teacher.employmentStatus || "Tetap Yayasan",
      joinDate: formatTimestampToInputDate(teacher.joinDate),
      photoUrl: teacher.photoUrl || ""
    });
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (data: TeacherFormValues) => {
    if (!selectedTeacher) return;
    try {
      const selectedLabels = editJabatans.map(id => JABATAN_OPTIONS.find(o => o.id === id)?.label || id);
      const combinedPayload = {
        ...data,
        roles: editJabatans,
        employeeType: selectedLabels.join(", ")
      };
      await updateTeacher({
        id: selectedTeacher.id,
        data: combinedPayload
      });
      toast("Berhasil Mengubah Guru", "success");
      setIsEditOpen(false);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || "";
      if (errMsg.includes("NIY")) {
        editForm.setError("niy", { message: "NIY sudah terdaftar!" });
      } else if (errMsg.includes("NUPTK")) {
        editForm.setError("nuptk", { message: "NUPTK sudah terdaftar!" });
      } else {
        toast("Gagal Menyimpan Data", "error");
      }
    }
  };

  // Handlers for Delete Dialog (Soft Delete)
  const handleDeleteOpen = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedTeacher) return;
    try {
      await deleteTeacher({
        id: selectedTeacher.id,
        name: selectedTeacher.name
      });
      toast("Berhasil Menghapus Guru", "success");
      setIsDeleteOpen(false);
    } catch (err) {
      console.error(err);
      toast("Gagal Menyimpan Data", "error");
    }
  };

  // Handlers for Detail Dialog
  const handleDetailOpen = (teacher: Teacher) => {
    setSelectedTeacher(teacher);
    setIsDetailOpen(true);
  };

  // Rendering Helpers
  const renderSkeleton = () => (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-slate-100 dark:bg-zinc-800 rounded-xl w-full" />
      <div className="border border-slate-150 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900">
        <div className="h-12 bg-slate-50 dark:bg-zinc-900 border-b border-slate-150 dark:border-zinc-800" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-850 flex items-center px-6 justify-between">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-sm w-1/4" />
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-sm w-1/6" />
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-sm w-12" />
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-sm w-1/5" />
            <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded-lg w-16" />
          </div>
        ))}
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 px-6 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-150 dark:border-zinc-800 shadow-xs">
      <div className="h-20 w-20 bg-blue-50 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 mb-6">
        <GraduationCap className="h-10 w-10 animate-pulse" />
      </div>
      <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 mb-2">Belum Ada Data Guru</h3>
      <p className="text-sm text-slate-400 dark:text-zinc-500 text-center max-w-sm mb-6 leading-relaxed">
        Direktori pendidik SMP Alkarim Rasyid masih kosong. Mulai dengan mendaftarkan guru pertama Anda.
      </p>
      <button
        onClick={handleCreateOpen}
        className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
      >
        <Plus className="h-4.5 w-4.5" />
        Tambah Guru
      </button>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      
      {/* Page Header, Title and Breadcrumb */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-zinc-850 pb-5">
        <div>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-zinc-500 mb-1 font-semibold uppercase tracking-wider">
            <span>Master Data</span>
            <span className="text-slate-300 dark:text-zinc-700">/</span>
            <span className="text-blue-600 dark:text-blue-500 font-bold">Guru</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            Direktori Guru & Tenaga Kependidikan
          </h1>
          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
            Manajemen master data pendidik, detail profil, riwayat aktivitas, dan status kepegawaian.
          </p>
        </div>

        <button
          onClick={handleCreateOpen}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="h-4.5 w-4.5" />
          Tambah Guru
        </button>
      </div>

      {isLoading ? (
        renderSkeleton()
      ) : teachers.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-4">
          
          {/* Filters, Search, and Sorting Bar */}
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            
            {/* Left side: Search Box and Status Filter Tabs */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400 dark:text-zinc-500">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Cari berdasarkan Nama, NIY, atau NUPTK..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all placeholder-slate-400 dark:placeholder-zinc-600"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex bg-slate-100 dark:bg-zinc-950 rounded-xl p-1 shrink-0 border border-slate-200/50 dark:border-zinc-850">
                {(["Semua", "Aktif", "Cuti", "Nonaktif", "Pensiun"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setStatusFilter(tab);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      statusFilter === tab
                        ? "bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-100 dark:border-zinc-800"
                        : "text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Right side: Sorting Selection */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Urutkan:</span>
              <select
                className="px-3 py-2 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-zinc-100 transition-all appearance-none cursor-pointer pr-8 relative font-medium"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
              >
                <option value="Nama A-Z">Nama A-Z</option>
                <option value="Nama Z-A">Nama Z-A</option>
                <option value="NIY">NIY</option>
                <option value="Tanggal Update">Tanggal Update</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150 dark:border-zinc-800 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-zinc-900 border-b border-slate-150 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-6 py-4 text-center w-12">No</th>
                    <th className="px-6 py-4">NIY</th>
                    <th className="px-6 py-4">Nama Guru</th>
                    <th className="px-6 py-4">Jenis PTK</th>
                    <th className="px-6 py-4">Status Kepegawaian</th>
                    <th className="px-6 py-4">Nomor HP</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right pr-8">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {paginatedTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-zinc-500">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                        <span className="font-semibold text-sm block mb-1">Data tidak ditemukan</span>
                        Tidak ada guru yang cocok dengan kriteria pencarian dan filter Anda.
                      </td>
                    </tr>
                  ) : (
                    paginatedTeachers.map((teacher, index) => {
                      const absoluteNo = (adjustedPage - 1) * itemsPerPage + index + 1;
                      const formattedName = `${teacher.frontTitle ? teacher.frontTitle.trim() + " " : ""}${teacher.name || ""}${teacher.backTitle ? ", " + teacher.backTitle.trim() : ""}`;
                      
                      const normStatus = teacher.status === true || teacher.status === "Aktif" ? "Aktif" : (teacher.status === false || teacher.status === "Nonaktif" ? "Nonaktif" : teacher.status || "Aktif");
                      
                      let statusBadgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400";
                      let statusDotClass = "bg-emerald-500";
                      if (normStatus === "Cuti") {
                        statusBadgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400";
                        statusDotClass = "bg-amber-500";
                      } else if (normStatus === "Nonaktif") {
                        statusBadgeClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400";
                        statusDotClass = "bg-rose-500";
                      } else if (normStatus === "Pensiun") {
                        statusBadgeClass = "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400";
                        statusDotClass = "bg-slate-400";
                      }

                      return (
                        <tr key={teacher.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/30 transition-colors">
                          <td className="px-6 py-4 text-center font-medium text-slate-400">{absoluteNo}</td>
                          <td className="px-6 py-4 font-mono font-semibold text-slate-600 dark:text-zinc-400">{teacher.niy}</td>
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-zinc-200">{formattedName}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 font-medium">{teacher.employeeType || "Guru"}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 font-medium">{teacher.employmentStatus || "Tetap Yayasan"}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-zinc-400 font-medium">{teacher.phone}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full ${statusBadgeClass}`}>
                              <span className={`h-1 w-1 rounded-full ${statusDotClass}`} />
                              {normStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right pr-8">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleDetailOpen(teacher)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                                title="Lihat Detail"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleEditOpen(teacher)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 rounded-lg transition-colors cursor-pointer"
                                title="Edit"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteOpen(teacher)}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between px-6 py-4 bg-slate-50/50 dark:bg-zinc-900 border-t border-slate-150 dark:border-zinc-800">
                <div className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                  Menampilkan <span className="font-bold text-slate-700 dark:text-zinc-300">{(adjustedPage - 1) * itemsPerPage + 1}</span>-
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{Math.min(adjustedPage * itemsPerPage, totalItems)}</span> dari{" "}
                  <span className="font-bold text-slate-700 dark:text-zinc-300">{totalItems}</span> Guru
                </div>

                <div className="flex items-center gap-1">
                  <button
                    disabled={adjustedPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 w-8 text-xs font-bold rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                        adjustedPage === page
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs"
                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    disabled={adjustedPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-400 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Tambah Guru */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Daftarkan Guru / Pendidik Baru"
        size="lg"
      >
        <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4 font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nomor Induk Yayasan (NIY)"
              placeholder="E.g., NIY.2026.010"
             
              register={createForm.register("niy")}
              error={createForm.formState.errors.niy?.message}
            />
            <FormInput
              label="NUPTK (Opsional)"
              placeholder="E.g., 98218765412"
              register={createForm.register("nuptk")}
              error={createForm.formState.errors.nuptk?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              label="Gelar Depan"
              placeholder="E.g., Dr., H."
              register={createForm.register("frontTitle")}
              error={createForm.formState.errors.frontTitle?.message}
            />
            <FormInput
              label="Nama Lengkap (Tanpa Gelar)"
              placeholder="E.g., Ahmad Fauzi"
              required
              register={createForm.register("name")}
              error={createForm.formState.errors.name?.message}
            />
            <FormInput
              label="Gelar Belakang"
              placeholder="E.g., M.Pd, S.Pd"
              register={createForm.register("backTitle")}
              error={createForm.formState.errors.backTitle?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nama Panggilan"
              placeholder="E.g., Fauzi"
              register={createForm.register("nickName")}
              error={createForm.formState.errors.nickName?.message}
            />
            <FormSelect
              label="Jenis Kelamin"
              required
              options={[
                { value: "L", label: "Laki-laki" },
                { value: "P", label: "Perempuan" }
              ]}
              register={createForm.register("gender")}
              error={createForm.formState.errors.gender?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              label="Tempat Lahir"
              placeholder="E.g., Jakarta"
             
              register={createForm.register("birthPlace")}
              error={createForm.formState.errors.birthPlace?.message}
            />
            <FormInput
              label="Tanggal Lahir"
              type="date"
             
              register={createForm.register("birthDate")}
              error={createForm.formState.errors.birthDate?.message}
            />
            <FormInput
              label="Agama"
              placeholder="E.g., Islam"
              register={createForm.register("religion")}
              error={createForm.formState.errors.religion?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5 w-full">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Peran / Jabatan (Multi Select) <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-white border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl max-h-40 overflow-y-auto">
                {JABATAN_OPTIONS.map((jabatan) => (
                  <label key={jabatan.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createJabatans.includes(jabatan.id)}
                      onChange={() => toggleCreateJabatan(jabatan.id)}
                      className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    {jabatan.label}
                  </label>
                ))}
              </div>
            </div>
            <FormSelect
              label="Status Kepegawaian"
              required
              options={[
                { value: "Tetap Yayasan", label: "Tetap Yayasan" },
                { value: "Honorer Yayasan", label: "Honorer Yayasan" },
                { value: "PPPK", label: "PPPK" },
                { value: "PNS", label: "PNS" },
                { value: "Kontrak", label: "Kontrak" }
              ]}
              register={createForm.register("employmentStatus")}
              error={createForm.formState.errors.employmentStatus?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nomor Handphone (WhatsApp)"
              placeholder="E.g., 08123456789"
             
              register={createForm.register("phone")}
              error={createForm.formState.errors.phone?.message}
            />
            <FormInput
              label="Alamat Email"
              type="email"
              placeholder="E.g., ahmad.fauzi@alkarim.sch.id"
              
              register={createForm.register("email")}
              error={createForm.formState.errors.email?.message}
            />
          </div>

          <FormInput
            label="Alamat Domisili"
            placeholder="E.g., Jl. Al-Karim No. 45, Kebon Jeruk, Jakarta Barat"
            
            register={createForm.register("address")}
            error={createForm.formState.errors.address?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Tanggal Bergabung"
              type="date"
              
              register={createForm.register("joinDate")}
              error={createForm.formState.errors.joinDate?.message}
            />
            <FormInput
              label="Foto Profil (URL sementara)"
              placeholder="E.g., https://example.com/photo.jpg"
              register={createForm.register("photoUrl")}
              error={createForm.formState.errors.photoUrl?.message}
            />
          </div>

          <FormSelect
            label="Status Keaktifan Guru"
            required
            options={[
              { value: "Aktif", label: "Aktif" },
              { value: "Cuti", label: "Cuti" },
              { value: "Nonaktif", label: "Nonaktif" },
              { value: "Pensiun", label: "Pensiun" }
            ]}
            register={createForm.register("status")}
            error={createForm.formState.errors.status?.message}
          />

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isCreating ? "Menyimpan..." : "Simpan Guru"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Edit Guru */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Ubah Data Profil Guru"
        size="lg"
      >
        <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4 font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nomor Induk Yayasan (NIY)"
              placeholder="E.g., NIY.2026.010"
             
              register={editForm.register("niy")}
              error={editForm.formState.errors.niy?.message}
            />
            <FormInput
              label="NUPTK (Opsional)"
              placeholder="E.g., 98218765412"
              register={editForm.register("nuptk")}
              error={editForm.formState.errors.nuptk?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              label="Gelar Depan"
              placeholder="E.g., Dr., H."
              register={editForm.register("frontTitle")}
              error={editForm.formState.errors.frontTitle?.message}
            />
            <FormInput
              label="Nama Lengkap (Tanpa Gelar)"
              placeholder="E.g., Ahmad Fauzi"
              required
              register={editForm.register("name")}
              error={editForm.formState.errors.name?.message}
            />
            <FormInput
              label="Gelar Belakang"
              placeholder="E.g., M.Pd, S.Pd"
              register={editForm.register("backTitle")}
              error={editForm.formState.errors.backTitle?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nama Panggilan"
              placeholder="E.g., Fauzi"
              register={editForm.register("nickName")}
              error={editForm.formState.errors.nickName?.message}
            />
            <FormSelect
              label="Jenis Kelamin"
              required
              options={[
                { value: "L", label: "Laki-laki" },
                { value: "P", label: "Perempuan" }
              ]}
              register={editForm.register("gender")}
              error={editForm.formState.errors.gender?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput
              label="Tempat Lahir"
              placeholder="E.g., Jakarta"
             
              register={editForm.register("birthPlace")}
              error={editForm.formState.errors.birthPlace?.message}
            />
            <FormInput
              label="Tanggal Lahir"
              type="date"
              
              register={editForm.register("birthDate")}
              error={editForm.formState.errors.birthDate?.message}
            />
            <FormInput
              label="Agama"
              placeholder="E.g., Islam"
              register={editForm.register("religion")}
              error={editForm.formState.errors.religion?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5 w-full">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Peran / Jabatan (Multi Select) <span className="text-rose-500 font-bold">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-white border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl max-h-40 overflow-y-auto">
                {JABATAN_OPTIONS.map((jabatan) => (
                  <label key={jabatan.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editJabatans.includes(jabatan.id)}
                      onChange={() => toggleEditJabatan(jabatan.id)}
                      className="rounded border-gray-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    {jabatan.label}
                  </label>
                ))}
              </div>
            </div>
            <FormSelect
              label="Status Kepegawaian"
              required
              options={[
                { value: "Tetap Yayasan", label: "Tetap Yayasan" },
                { value: "Honorer Yayasan", label: "Honorer Yayasan" },
                { value: "PPPK", label: "PPPK" },
                { value: "PNS", label: "PNS" },
                { value: "Kontrak", label: "Kontrak" }
              ]}
              register={editForm.register("employmentStatus")}
              error={editForm.formState.errors.employmentStatus?.message}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Nomor Handphone (WhatsApp)"
              placeholder="E.g., 08123456789"
              
              register={editForm.register("phone")}
              error={editForm.formState.errors.phone?.message}
            />
            <FormInput
              label="Alamat Email"
              type="email"
              placeholder="E.g., ahmad.fauzi@alkarim.sch.id"
             
              register={editForm.register("email")}
              error={editForm.formState.errors.email?.message}
            />
          </div>

          <FormInput
            label="Alamat Domisili"
            placeholder="E.g., Jl. Al-Karim No. 45, Kebon Jeruk, Jakarta Barat"
          
            register={editForm.register("address")}
            error={editForm.formState.errors.address?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Tanggal Bergabung"
              type="date"
              
              register={editForm.register("joinDate")}
              error={editForm.formState.errors.joinDate?.message}
            />
            <FormInput
              label="Foto Profil (URL sementara)"
              placeholder="E.g., https://example.com/photo.jpg"
              register={editForm.register("photoUrl")}
              error={editForm.formState.errors.photoUrl?.message}
            />
          </div>

          <FormSelect
            label="Status Keaktifan Guru"
            required
            options={[
              { value: "Aktif", label: "Aktif" },
              { value: "Cuti", label: "Cuti" },
              { value: "Nonaktif", label: "Nonaktif" },
              { value: "Pensiun", label: "Pensiun" }
            ]}
            register={editForm.register("status")}
            error={editForm.formState.errors.status?.message}
          />

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {isUpdating ? "Memperbarui..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Dialog: Detail Guru */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Profil Lengkap Pendidik"
        size="md"
      >
        {selectedTeacher && (() => {
          const detailFormattedName = `${selectedTeacher.frontTitle ? selectedTeacher.frontTitle.trim() + " " : ""}${selectedTeacher.name || ""}${selectedTeacher.backTitle ? ", " + selectedTeacher.backTitle.trim() : ""}`;
          const normStatus = selectedTeacher.status === true || selectedTeacher.status === "Aktif" ? "Aktif" : (selectedTeacher.status === false || selectedTeacher.status === "Nonaktif" ? "Nonaktif" : selectedTeacher.status || "Aktif");
          
          let statusBadgeClass = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400";
          if (normStatus === "Cuti") {
            statusBadgeClass = "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400";
          } else if (normStatus === "Nonaktif") {
            statusBadgeClass = "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400";
          } else if (normStatus === "Pensiun") {
            statusBadgeClass = "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400";
          }

          return (
            <div className="space-y-6 font-sans">
              
              {/* Header Profil */}
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-slate-150 dark:border-zinc-850">
                {selectedTeacher.photoUrl ? (
                  <img
                    src={selectedTeacher.photoUrl}
                    alt={selectedTeacher.name}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-2xl object-cover shrink-0 border border-slate-200 dark:border-zinc-800"
                    onError={(e) => {
                      // Fallback if image fails to load
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : null}
                <div className="h-16 w-16 bg-blue-50 dark:bg-blue-950/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 shrink-0 border border-blue-100/50 dark:border-blue-900/30 [[style*='display: none']_~_&]:flex">
                  <User className="h-8 w-8" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-extrabold text-slate-800 dark:text-white truncate">{detailFormattedName}</h4>
                    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[9px] font-bold rounded-full shrink-0 ${statusBadgeClass}`}>
                      {normStatus}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-zinc-500 flex items-center gap-3 mt-1 font-semibold flex-wrap">
                    <span className="flex items-center gap-1">
                      <FileKey className="h-3 w-3" />
                      NIY: {selectedTeacher.niy}
                    </span>
                    <span>•</span>
                    <span>
                      NUPTK: {selectedTeacher.nuptk || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Grid Detail */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Nama Panggilan */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama Panggilan</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.nickName || "-"}
                    </div>
                  </div>
                </div>

                {/* Agama */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Bookmark className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agama</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.religion || "-"}
                    </div>
                  </div>
                </div>

                {/* Jenis PTK */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis PTK</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.employeeType || "Guru"}
                    </div>
                  </div>
                </div>

                {/* Status Kepegawaian */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status Kepegawaian</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.employmentStatus || "Tetap Yayasan"}
                    </div>
                  </div>
                </div>

                {/* Tanggal Bergabung */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tanggal Bergabung</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.joinDate?.toDate ? selectedTeacher.joinDate.toDate().toLocaleDateString("id-ID") : (selectedTeacher.joinDate ? new Date(selectedTeacher.joinDate).toLocaleDateString("id-ID") : "-")}
                    </div>
                  </div>
                </div>

                {/* Jenis Kelamin */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jenis Kelamin</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.gender === "L" ? "Laki-laki" : "Perempuan"}
                    </div>
                  </div>
                </div>

                {/* TTL */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tempat & Tanggal Lahir</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {formatBirthDetails(selectedTeacher.birthPlace, selectedTeacher.birthDate)}
                    </div>
                  </div>
                </div>

                {/* No HP */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nomor HP (WA)</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5">
                      {selectedTeacher.phone || "-"}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl sm:col-span-2">
                  <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Email</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5 break-all">
                      {selectedTeacher.email || "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Alamat */}
              <div className="flex gap-3 items-start border border-slate-100 dark:border-zinc-850 p-3 rounded-xl">
                <div className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-lg shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Lengkap</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-zinc-300 mt-0.5 leading-relaxed">
                    {selectedTeacher.address || "-"}
                  </div>
                </div>
              </div>

              {/* Audit / Metadata Trail */}
              <div className="bg-slate-50/50 dark:bg-zinc-950 p-4 rounded-xl border border-slate-150 dark:border-zinc-850 text-[10px] text-slate-400 dark:text-zinc-500 space-y-1.5 font-semibold">
                <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-extrabold mb-1">
                  <FileClock className="h-3.5 w-3.5" />
                  Audit Trail Aktivitas
                </div>
                <div className="flex justify-between">
                  <span>Daftar Pertama:</span>
                  <span className="font-bold text-slate-600 dark:text-zinc-400">
                    {selectedTeacher.createdAt?.toDate ? selectedTeacher.createdAt.toDate().toLocaleString("id-ID") : selectedTeacher.createdAt || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Diperbarui Terakhir:</span>
                  <span className="font-bold text-slate-600 dark:text-zinc-400">
                    {selectedTeacher.updatedAt?.toDate ? selectedTeacher.updatedAt.toDate().toLocaleString("id-ID") : selectedTeacher.updatedAt || "-"}
                  </span>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Tutup Profil
                </button>
              </div>
            </div>
          );
        })()}
      </Dialog>

      {/* Dialog: Konfirmasi Hapus (Soft Delete) */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Hapus Data Guru"
        size="sm"
      >
        {selectedTeacher && (
          <div className="space-y-4 font-sans">
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-950/50">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-red-800 dark:text-red-400 uppercase tracking-wider">Peringatan Penghapusan</h4>
                <p className="text-xs text-red-700 dark:text-red-400/80 mt-1 leading-relaxed">
                  Tindakan ini akan melakukan <strong>Soft-Delete</strong> pada data guru <strong>{selectedTeacher.name}</strong>. Data guru tidak akan ditampilkan lagi pada list utama, namun riwayat log aktivitas tetap tersimpan secara permanen untuk kebutuhan audit sekolah.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              Apakah Anda benar-benar yakin ingin menghapus data pendidik ini?
            </p>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800 mt-4">
              <button
                type="button"
                onClick={() => setIsDeleteOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-zinc-850 text-slate-500 dark:text-zinc-400 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus Data"}
              </button>
            </div>
          </div>
        )}
      </Dialog>

    </div>
  );
};

export default Teachers;
