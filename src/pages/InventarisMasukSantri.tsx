import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { studentService } from "../services/studentService";
import { classService } from "../services/classService";
import { academicYearService } from "../services/academicYear.service";
import { userService } from "../services/user.service";
import {
  inventarisService,
  MasterGood,
  InventarisCategory,
  InventarisExaminer,
  StudentInventarisItem,
  StudentInventaris,
  RiwayatPemeriksaan,
  StudentChecklistStatus,
  AuditStatusLog
} from "../services/inventarisService";
import { Student, Class, AcademicYear } from "../types";
import { Dialog } from "../components/Dialog";
import { Loading } from "../components/Loading";
import {
  ClipboardList,
  BarChart3,
  Package,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  FileSpreadsheet,
  PlusCircle,
  FolderPlus,
  RefreshCw,
  Clock,
  User,
  ShieldAlert,
  ChevronUp,
  ChevronDown
} from "lucide-react";

export const InventarisMasukSantri: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Active workspace roles check
  const userRoles = user?.roles || [user?.role || ""];
  const isAdmin = userRoles.includes("admin") || user?.role === "admin";

  // Tab State: "checklist" | "rekap" | "master" | "penugasan"
  const [activeTab, setActiveTab] = useState<string>("checklist");

  // UI state lists
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [masterGoods, setMasterGoods] = useState<MasterGood[]>([]);
  const [categories, setCategories] = useState<InventarisCategory[]>([]);
  const [examiners, setExaminers] = useState<InventarisExaminer[]>([]);
  const [allChecklists, setAllChecklists] = useState<StudentInventaris[]>([]);
  const [allHistory, setAllHistory] = useState<RiwayatPemeriksaan[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<StudentChecklistStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditStatusLog[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAssigned, setIsAssigned] = useState<boolean>(false);

  // Active student selection state
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [checklistClassId, setChecklistClassId] = useState<string>("");
  const [studentSearch, setStudentSearch] = useState<string>("");
  const [activeChecklistItems, setActiveChecklistItems] = useState<StudentInventarisItem[]>([]);
  const [generalNotes, setGeneralNotes] = useState<string>("");

  // Modals state
  const [isGoodModalOpen, setIsGoodModalOpen] = useState<boolean>(false);
  const [editingGood, setEditingGood] = useState<MasterGood | null>(null);
  const [goodForm, setGoodForm] = useState({
    name: "",
    minQty: 1,
    unit: "Pcs",
    category: "",
    notes: "",
    isActive: true
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [editingCategory, setEditingCategory] = useState<InventarisCategory | null>(null);
  const [masterSubTab, setMasterSubTab] = useState<"goods" | "categories">("goods");

  const [isExaminerModalOpen, setIsExaminerModalOpen] = useState<boolean>(false);
  const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>("");

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);
  const [studentHistoryList, setStudentHistoryList] = useState<RiwayatPemeriksaan[]>([]);

  // Filters state for Rekap
  const [filterClass, setFilterClass] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterPetugas, setFilterPetugas] = useState<string>("");
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");

  // Load all initial database content
  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Check roles and dynamic assignment
      const examinersList = await inventarisService.getExaminers();
      setExaminers(examinersList);

      const isUserAssigned = examinersList.some((ex) => ex.id === user?.uid);
      setIsAssigned(isUserAssigned);

      // If neither admin nor assigned, and we're not authorized, we still load to display nice warning if needed, but we check right away
      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);

      const cats = await inventarisService.getCategories();
      setCategories(cats);

      const stds = await studentService.getStudents();
      setStudents(stds);

      const cls = await classService.getClasses();
      setClasses(cls);

      const ays = await academicYearService.getAcademicYears();
      setAcademicYears(ays);

      const chkls = await inventarisService.getChecklists();
      setAllChecklists(chkls);

      const hist = await inventarisService.getAllHistory();
      setAllHistory(hist);

      const statusList = await inventarisService.getStatuses();
      setStatuses(statusList);

      const logs = await inventarisService.getAuditLogs();
      setAuditLogs(logs);

      if (isAdmin) {
        const users = await userService.getUsers();
        // filter only guru and musrif for potential examiners
        const eligible = users.filter((u) => {
          const roles = u.roles || [u.role];
          return roles.some((r: string) => r === "guru" || r === "musrif");
        });
        setSystemUsers(eligible);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast("Gagal memuat beberapa data inventaris", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Periodic lock/status background synchronization (Part 4)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const statusList = await inventarisService.getStatuses();
        setStatuses(statusList);
      } catch (e) {
        console.error("Silent reload statuses error:", e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Heartbeat for actively held student locks (Part 5, 10)
  useEffect(() => {
    if (!selectedStudent) return;
    // Immediate initial heartbeat
    inventarisService.heartbeat(selectedStudent.id);

    const interval = setInterval(() => {
      inventarisService.heartbeat(selectedStudent.id);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedStudent]);

  // Authorization check
  const hasAccess = isAdmin || isAssigned;

  // Handle student select for checklist input
  const handleSelectStudent = async (student: Student) => {
    // Check permission to edit (if existing checklist exists)
    const existingChecklist = allChecklists.find((c) => c.studentId === student.id);
    const currentExaminer = examiners.find((ex) => ex.id === user?.uid);
    const isAdminUser = isAdmin || user?.role === "admin";
    
    if (existingChecklist) {
      const isOriginalExaminer = existingChecklist.updatedBy === user?.uid;
      const hasEditOthersPrivilege = currentExaminer?.canEditOthers === true;
      if (!isAdminUser && !isOriginalExaminer && !hasEditOthersPrivilege) {
        toast("Akses Ditolak: Anda tidak memiliki hak untuk mengubah hasil pemeriksaan petugas lain.", "warning");
        return;
      }
    }

    setIsLoading(true);
    try {
      // Acquire lock first
      const lockRes = await inventarisService.acquireLock(
        student.id,
        student.name,
        user?.uid || "",
        user?.displayName || user?.email || "Petugas"
      );

      if (!lockRes.success) {
        toast(`Gagal memeriksa: Santri ini sedang diperiksa oleh ${lockRes.lockedBy}`, "warning");
        // Reload statuses to keep UI in sync
        const statusList = await inventarisService.getStatuses();
        setStatuses(statusList);
        return;
      }

      // Lock acquired successfully! Now proceed with loading
      setSelectedStudent(student);
      if (student.classId) {
        setChecklistClassId(student.classId);
      }
      setActiveTab("checklist");

      const existing = await inventarisService.getStudentChecklist(student.id);
      const activeGoods = masterGoods.filter((g) => g.isActive);

      if (existing) {
        setGeneralNotes(existing.generalNotes || "");
        // Map existing items, if any new active master goods are added after the checklist was created, merge them too!
        const existingItemsMap = new Map(existing.items.map((i) => [i.itemId, i]));
        const mergedItems: StudentInventarisItem[] = activeGoods.map((good) => {
          const exist = existingItemsMap.get(good.id);
          if (exist) {
            return {
              itemId: good.id,
              itemName: good.name,
              minQty: good.minQty,
              actualQty: exist.actualQty,
              status: exist.status,
              notes: exist.notes || ""
            };
          } else {
            return {
              itemId: good.id,
              itemName: good.name,
              minQty: good.minQty,
              actualQty: null,
              status: "Belum Dicek",
              notes: ""
            };
          }
        });
        setActiveChecklistItems(mergedItems);
      } else {
        setGeneralNotes("");
        // Build new checklist based on current Master Goods
        const newItems: StudentInventarisItem[] = activeGoods.map((good) => ({
          itemId: good.id,
          itemName: good.name,
          minQty: good.minQty,
          actualQty: null,
          status: "Belum Dicek",
          notes: ""
        }));
        setActiveChecklistItems(newItems);
      }
    } catch (err) {
      console.error(err);
      toast("Gagal memuat ceklis santri", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Live validation on actual quantites change
  const handleQtyChange = (itemId: string, valStr: string) => {
    const next = activeChecklistItems.map((item) => {
      if (item.itemId === itemId) {
        if (valStr.trim() === "") {
          return {
            ...item,
            actualQty: null,
            status: "Belum Dicek" as const
          };
        }
        const val = parseInt(valStr);
        if (isNaN(val) || val < 0) {
          return item;
        }

        // Auto validation status: Lengkap, Kurang, Tidak Membawa, Rusak, Belum Dicek
        let status: "Lengkap" | "Kurang" | "Tidak Membawa" | "Rusak" | "Belum Dicek" = "Belum Dicek";
        if (val === 0) {
          status = "Tidak Membawa";
        } else if (val >= item.minQty) {
          status = "Lengkap";
        } else {
          status = "Kurang";
        }

        return {
          ...item,
          actualQty: val,
          status
        };
      }
      return item;
    });
    setActiveChecklistItems(next);
  };

  // Handle status manual override (e.g. "Tidak Membawa", "Rusak", "Lengkap")
  const handleStatusOverride = (itemId: string, status: any) => {
    const next = activeChecklistItems.map((item) => {
      if (item.itemId === itemId) {
        return {
          ...item,
          status
        };
      }
      return item;
    });
    setActiveChecklistItems(next);
  };

  // Handle notes change
  const handleNotesChange = (itemId: string, notes: string) => {
    const next = activeChecklistItems.map((item) => {
      if (item.itemId === itemId) {
        return {
          ...item,
          notes
        };
      }
      return item;
    });
    setActiveChecklistItems(next);
  };

  // Save the checklist to database
  const handleSaveChecklist = async () => {
    if (!selectedStudent) return;
    setIsSaving(true);
    try {
      const examinerName = user?.displayName || user?.email || "Petugas";
      const examinerId = user?.uid || "";
      const classObj = classes.find((c) => c.id === selectedStudent.classId);
      const className = classObj ? classObj.name : "Tanpa Kelas";
      const ayObj = academicYears.find((y) => y.id === selectedStudent.academicYearId);
      const academicYear = ayObj ? ayObj.name : "Lainnya";

      const currentEx = examiners.find((e) => e.id === user?.uid);
      const examinerRole = currentEx?.role || (isAdmin ? "admin" : "guru");

      await inventarisService.saveChecklist(
        selectedStudent.id,
        selectedStudent.name,
        className,
        academicYear,
        activeChecklistItems,
        examinerId,
        examinerName,
        examinerRole,
        generalNotes
      );

      toast(`Ceklis barang ${selectedStudent.name} berhasil disimpan!`, "success");

      // Refresh states
      const chkls = await inventarisService.getChecklists();
      setAllChecklists(chkls);
      const hist = await inventarisService.getAllHistory();
      setAllHistory(hist);
      const statusList = await inventarisService.getStatuses();
      setStatuses(statusList);
      const logs = await inventarisService.getAuditLogs();
      setAuditLogs(logs);

      // Deselect or keep
      setSelectedStudent(null);
      setStudentSearch("");
    } catch (err) {
      console.error(err);
      toast("Gagal menyimpan pemeriksaan inventaris", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChecklist = async () => {
    if (!selectedStudent) return;
    setIsSaving(true);
    try {
      await inventarisService.releaseLock(
        selectedStudent.id,
        selectedStudent.name,
        user?.uid || "",
        user?.displayName || user?.email || "Petugas"
      );
      toast("Pemeriksaan dibatalkan, kunci dilepas.", "info");

      // Refresh states
      const statusList = await inventarisService.getStatuses();
      setStatuses(statusList);
      
      setSelectedStudent(null);
      setChecklistClassId("");
    } catch (err) {
      console.error(err);
      toast("Gagal melepas kunci pemeriksaan", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset student checklist data if checked
  const handleResetChecklist = async () => {
    if (!selectedStudent) return;
    if (!window.confirm(`Apakah Anda yakin ingin mereset data ceklis barang untuk santri ${selectedStudent.name}? Semua data pemeriksaan saat ini akan dihapus.`)) {
      return;
    }
    setIsSaving(true);
    try {
      await inventarisService.resetChecklist(
        selectedStudent.id,
        selectedStudent.name,
        user?.uid || "",
        user?.displayName || user?.email || "Petugas"
      );
      toast(`Ceklis barang ${selectedStudent.name} berhasil direset!`, "success");
      
      // Reload checklists & statuses & logs
      const chkls = await inventarisService.getChecklists();
      setAllChecklists(chkls);
      const statusList = await inventarisService.getStatuses();
      setStatuses(statusList);
      const logs = await inventarisService.getAuditLogs();
      setAuditLogs(logs);

      // Reset active checklist items to default state based on Master Goods
      const activeGoods = masterGoods.filter((g) => g.isActive);
      const newItems: StudentInventarisItem[] = activeGoods.map((good) => ({
        itemId: good.id,
        itemName: good.name,
        minQty: good.minQty,
        actualQty: null,
        status: "Belum Dicek",
        notes: ""
      }));
      setActiveChecklistItems(newItems);
      
      setSelectedStudent(null);
    } catch (err) {
      console.error(err);
      toast("Gagal mereset ceklis barang bawaan", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Dynamic checklist filtering by Class - exclude already checked or locked students (Part 4, 10)
  const studentsFilteredByChecklistClass = useMemo(() => {
    let filteredList = students;
    if (checklistClassId) {
      filteredList = filteredList.filter((s) => s.classId === checklistClassId);
    }
    
    return filteredList.filter((s) => {
      if (s.id === selectedStudent?.id) return true;

      const statusObj = statuses.find((st) => st.studentId === s.id);
      if (!statusObj) return true; // Belum Diperiksa (unlocked)
      
      if (statusObj.status === "Selesai") return false;

      if (statusObj.lockedBy && statusObj.lockedBy !== user?.uid) {
        const lastActiveTime = statusObj.lastActive ? new Date(statusObj.lastActive).getTime() : 0;
        const now = new Date().getTime();
        if (now - lastActiveTime < 5 * 60 * 1000) {
          return false; // Locked by another active examiner
        }
      }

      return true;
    });
  }, [students, checklistClassId, statuses, selectedStudent, user]);

  // Group checklist items by category, sorted by category urutan and item urutan
  const groupedChecklistItems = useMemo(() => {
    const groups: { [categoryName: string]: StudentInventarisItem[] } = {};
    activeChecklistItems.forEach((item) => {
      const masterInfo = masterGoods.find((g) => g.id === item.itemId);
      const categoryName = masterInfo?.category || "Lain-lain";
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(item);
    });

    const sortedGroups: { category: string; items: StudentInventarisItem[] }[] = [];
    const seenCategories = new Set<string>();

    categories.forEach((cat) => {
      if (groups[cat.name] && groups[cat.name].length > 0 && !seenCategories.has(cat.name)) {
        seenCategories.add(cat.name);
        sortedGroups.push({
          category: cat.name,
          items: groups[cat.name]
        });
      }
    });

    Object.keys(groups).forEach((catName) => {
      if (!seenCategories.has(catName)) {
        seenCategories.add(catName);
        sortedGroups.push({
          category: catName,
          items: groups[catName]
        });
      }
    });

    return sortedGroups;
  }, [activeChecklistItems, masterGoods, categories]);

  const handleDropdownClassChange = (classId: string) => {
    setChecklistClassId(classId);
    if (selectedStudent && classId && selectedStudent.classId !== classId) {
      setSelectedStudent(null);
    }
  };

  const handleDropdownStudentChange = (studentId: string) => {
    if (!studentId) {
      setSelectedStudent(null);
      return;
    }
    const found = students.find((s) => s.id === studentId);
    if (found) {
      handleSelectStudent(found);
    }
  };

  const handleToggleEditOthers = async (examinerId: string, value: boolean) => {
    try {
      await inventarisService.updateExaminerPrivilege(examinerId, value);
      toast("Hak khusus petugas berhasil diperbarui!", "success");
      const examinersList = await inventarisService.getExaminers();
      setExaminers(examinersList);
    } catch (err) {
      console.error(err);
      toast("Gagal memperbarui hak khusus petugas", "error");
    }
  };

  const handleForceUnlock = async (studentId: string, studentName: string, lockedByUserId: string, lockedByUserName: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin melepaskan kunci pemeriksaan untuk santri ${studentName} secara paksa?`)) return;
    try {
      await inventarisService.releaseLock(studentId, studentName, lockedByUserId, lockedByUserName, true);
      toast(`Kunci pemeriksaan santri ${studentName} berhasil dilepas secara paksa.`, "success");
      const statusList = await inventarisService.getStatuses();
      setStatuses(statusList);
    } catch (err) {
      console.error(err);
      toast("Gagal melepas kunci secara paksa", "error");
    }
  };

  // Student search filtered output
  const filteredStudentsForChecklist = useMemo(() => {
    if (!studentSearch.trim()) return [];
    const term = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.nis && s.nis.toLowerCase().includes(term))
    );
  }, [students, studentSearch]);

  // --- Master Barang Logic ---
  const handleOpenAddGood = () => {
    setEditingGood(null);
    setGoodForm({
      name: "",
      minQty: 1,
      unit: "Pcs",
      category: categories[0]?.name || "Perlengkapan Tidur",
      notes: "",
      isActive: true
    });
    setIsGoodModalOpen(true);
  };

  const handleOpenEditGood = (good: MasterGood) => {
    setEditingGood(good);
    setGoodForm({
      name: good.name,
      minQty: good.minQty,
      unit: good.unit,
      category: good.category,
      notes: good.notes || "",
      isActive: good.isActive
    });
    setIsGoodModalOpen(true);
  };

  const handleSaveGood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goodForm.name.trim() || !goodForm.category) {
      toast("Isi nama barang dan kategori dengan benar", "warning");
      return;
    }

    try {
      const catObj = categories.find((c) => c.name === goodForm.category);
      const urutanKategori = catObj ? (catObj.urutan || 999) : 999;

      if (editingGood) {
        let urutanBarang = editingGood.urutanBarang || 999;
        if (editingGood.category !== goodForm.category) {
          const sameCategoryGoods = masterGoods.filter((g) => g.category === goodForm.category);
          const maxUrutanBarang = sameCategoryGoods.reduce((max, g) => ((g.urutanBarang || 0) > max ? (g.urutanBarang || 0) : max), 0);
          urutanBarang = maxUrutanBarang + 1;
        }

        const updatedData = {
          ...goodForm,
          urutanKategori,
          urutanBarang
        };

        await inventarisService.updateGood(editingGood.id, updatedData);
        toast(`Barang "${goodForm.name}" berhasil diperbarui`, "success");
      } else {
        const sameCategoryGoods = masterGoods.filter((g) => g.category === goodForm.category);
        const maxUrutanBarang = sameCategoryGoods.reduce((max, g) => ((g.urutanBarang || 0) > max ? (g.urutanBarang || 0) : max), 0);
        const urutanBarang = maxUrutanBarang + 1;

        const newData = {
          ...goodForm,
          urutanKategori,
          urutanBarang
        };

        await inventarisService.addGood(newData);
        toast(`Barang "${goodForm.name}" berhasil ditambahkan`, "success");
      }
      setIsGoodModalOpen(false);
      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);
    } catch (err) {
      console.error(err);
      toast("Gagal menyimpan barang master", "error");
    }
  };

  const handleDeleteGood = async (id: string, name: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus barang "${name}" dari Master?`)) return;
    try {
      await inventarisService.deleteGood(id);
      toast("Barang berhasil dihapus", "success");
      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);
    } catch (err) {
      console.error(err);
      toast("Gagal menghapus barang", "error");
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      if (editingCategory) {
        // Renaming Category
        await inventarisService.updateCategory(editingCategory.id, { name: newCategoryName.trim() });
        
        // Update all corresponding master goods
        const goodsToUpdate = masterGoods.filter((g) => g.category === editingCategory.name);
        for (const g of goodsToUpdate) {
          await inventarisService.updateGood(g.id, { category: newCategoryName.trim() });
        }

        toast(`Kategori berhasil diubah menjadi "${newCategoryName}"`, "success");
      } else {
        // Adding new category
        const maxUrutan = categories.reduce((max, c) => ((c.urutan || 0) > max ? (c.urutan || 0) : max), 0);
        await inventarisService.addCategory(newCategoryName.trim(), maxUrutan + 1);
        toast(`Kategori "${newCategoryName}" berhasil ditambahkan`, "success");
      }
      setNewCategoryName("");
      setEditingCategory(null);
      setIsCategoryModalOpen(false);
      const cats = await inventarisService.getCategories();
      setCategories(cats);
      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);
    } catch (err) {
      console.error(err);
      toast("Gagal menyimpan kategori", "error");
    }
  };

  const handleMoveCategory = async (category: InventarisCategory, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === category.id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === categories.length - 1) return;

    const swapWithIdx = direction === "up" ? idx - 1 : idx + 1;
    const swapCat = categories[swapWithIdx];

    setIsSaving(true);
    try {
      const tempUrutan = category.urutan || 999;
      const targetUrutan = swapCat.urutan || 999;
      
      await inventarisService.updateCategory(category.id, { urutan: targetUrutan });
      await inventarisService.updateCategory(swapCat.id, { urutan: tempUrutan });

      // Refresh categories
      const cats = await inventarisService.getCategories();
      setCategories(cats);

      // UPDATE all goods in these categories so their urutanKategori is also in sync
      const goodsInCat = masterGoods.filter((g) => g.category === category.name);
      for (const g of goodsInCat) {
        await inventarisService.updateGood(g.id, { urutanKategori: targetUrutan });
      }

      const goodsInSwapCat = masterGoods.filter((g) => g.category === swapCat.name);
      for (const g of goodsInSwapCat) {
        await inventarisService.updateGood(g.id, { urutanKategori: tempUrutan });
      }

      // Refresh goods
      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);

      toast("Urutan kategori berhasil diubah", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengubah urutan kategori", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (category: InventarisCategory) => {
    const goodsInCat = masterGoods.filter((g) => g.category === category.name);
    if (goodsInCat.length > 0) {
      if (!window.confirm(`Kategori "${category.name}" memiliki ${goodsInCat.length} barang di dalamnya. Menghapus kategori ini juga akan memindahkan barang-barang ini ke kategori "Lain-lain". Apakah Anda yakin?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Apakah Anda yakin ingin menghapus kategori "${category.name}"?`)) return;
    }

    setIsSaving(true);
    try {
      await inventarisService.deleteCategory(category.id);

      let otherCat = categories.find((c) => c.name === "Lain-lain");
      let otherCatUrutan = otherCat ? (otherCat.urutan || 999) : 999;

      for (const g of goodsInCat) {
        await inventarisService.updateGood(g.id, { 
          category: "Lain-lain", 
          urutanKategori: otherCatUrutan,
          urutanBarang: 100 + (g.urutanBarang || 0)
        });
      }

      const cats = await inventarisService.getCategories();
      setCategories(cats);
      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);

      toast("Kategori berhasil dihapus", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal menghapus kategori", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMoveGood = async (good: MasterGood, direction: "up" | "down") => {
    const sameCatGoods = masterGoods.filter((g) => g.category === good.category);
    const idx = sameCatGoods.findIndex((g) => g.id === good.id);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === sameCatGoods.length - 1) return;

    const swapWith = direction === "up" ? sameCatGoods[idx - 1] : sameCatGoods[idx + 1];

    setIsSaving(true);
    try {
      const tempUrutan = good.urutanBarang || 999;
      const targetUrutan = swapWith.urutanBarang || 999;
      
      await inventarisService.updateGood(good.id, { urutanBarang: targetUrutan });
      await inventarisService.updateGood(swapWith.id, { urutanBarang: tempUrutan });

      const goods = await inventarisService.getGoods();
      setMasterGoods(goods);
      toast("Urutan barang berhasil diubah", "success");
    } catch (err) {
      console.error(err);
      toast("Gagal mengubah urutan barang", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // --- Penugasan Logic ---
  const handleAssignExaminer = async () => {
    if (!selectedUserToAssign) return;
    const sysUser = systemUsers.find((u) => u.userId === selectedUserToAssign);
    if (!sysUser) return;

    // Check if already assigned
    if (examiners.some((ex) => ex.id === sysUser.userId)) {
      toast("User sudah ditugaskan sebelumnya", "warning");
      return;
    }

    try {
      const payload: InventarisExaminer = {
        id: sysUser.userId,
        displayName: sysUser.displayName || sysUser.name || "Pendidik",
        email: sysUser.email,
        role: sysUser.role || "guru",
        assignedAt: new Date().toISOString()
      };

      await inventarisService.addExaminer(payload);
      toast(`Berhasil menugaskan "${payload.displayName}" sebagai petugas pemeriksa`, "success");
      setSelectedUserToAssign("");
      setIsExaminerModalOpen(false);

      // Refresh examiners
      const examinersList = await inventarisService.getExaminers();
      setExaminers(examinersList);
    } catch (err) {
      console.error(err);
      toast("Gagal menyimpan penugasan", "error");
    }
  };

  const handleRemoveExaminer = async (id: string, name: string) => {
    if (!window.confirm(`Cabut penugasan pemeriksaan untuk ${name}?`)) return;
    try {
      await inventarisService.deleteExaminer(id);
      toast("Penugasan berhasil dicabut", "success");
      const examinersList = await inventarisService.getExaminers();
      setExaminers(examinersList);
    } catch (err) {
      console.error(err);
      toast("Gagal mencabut penugasan", "error");
    }
  };

  // --- Student History Logic ---
  const handleOpenStudentHistory = async (student: Student) => {
    setHistoryStudent(student);
    setIsLoading(true);
    try {
      const history = await inventarisService.getStudentHistory(student.id);
      setStudentHistoryList(history);
      setIsHistoryModalOpen(true);
    } catch (err) {
      console.error(err);
      toast("Gagal memuat riwayat santri", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- REKAP DATA CALCULATIONS (Part 8) ---
  const rekapData = useMemo(() => {
    // List checklists mapped to student objects to have student data (nis, classId, class, status, etc)
    const checklistsMap = new Map<string, StudentInventaris>(allChecklists.map((c) => [c.studentId, c]));

    let mapped = students.map((std) => {
      const chk = checklistsMap.get(std.id);
      const statusObj = statuses.find((st) => st.studentId === std.id);
      const computedStatus = statusObj?.status || (chk ? "Selesai" : "Belum Diperiksa");
      const classObj = classes.find((c) => c.id === std.classId);
      const ayObj = academicYears.find((y) => y.id === std.academicYearId);
      const examinerRole = chk?.examinerRole || examiners.find((e) => e.id === chk?.updatedBy)?.role || "";

      return {
        student: std,
        className: classObj ? classObj.name : "Tanpa Kelas",
        classCode: classObj ? classObj.code : "",
        academicYear: ayObj ? ayObj.name : "Lainnya",
        checklist: chk || null,
        status: computedStatus,
        examinerRole
      };
    });

    // Apply pre-filters (class, year, search)
    let preFiltered = mapped;
    if (filterClass) {
      preFiltered = preFiltered.filter((f) => f.student.classId === filterClass);
    }
    if (filterYear) {
      preFiltered = preFiltered.filter((f) => f.student.academicYearId === filterYear);
    }
    if (filterSearch.trim()) {
      const term = filterSearch.toLowerCase();
      preFiltered = preFiltered.filter(
        (f) =>
          f.student.name.toLowerCase().includes(term) ||
          f.student.nis.toLowerCase().includes(term)
      );
    }

    // Compute Dashboard Counters
    const totalSantri = preFiltered.length;
    const belumDicekCount = preFiltered.filter((f) => f.status === "Belum Diperiksa").length;
    const sedangDiperiksaCount = preFiltered.filter((f) => f.status === "Sedang Diperiksa").length;
    const sudahDicekCount = preFiltered.filter((f) => f.status === "Selesai").length;
    
    const pemeriksaanGuruCount = preFiltered.filter((f) => f.checklist && f.examinerRole === "guru").length;
    const pemeriksaanMusrifCount = preFiltered.filter((f) => f.checklist && f.examinerRole === "musrif").length;
    const pemeriksaanAdminCount = preFiltered.filter((f) => f.checklist && f.examinerRole === "admin").length;

    // Apply specific status/role filters
    let filtered = preFiltered;
    if (filterPetugas) {
      filtered = filtered.filter((f) => f.checklist?.updatedBy === filterPetugas);
    }
    if (filterStatus) {
      filtered = filtered.filter((f) => f.status === filterStatus);
    }
    if (filterRole) {
      filtered = filtered.filter((f) => f.examinerRole === filterRole);
    }

    const sudahDicekList = filtered.filter((f) => f.checklist !== null);
    const sudahDicek = sudahDicekList.length;
    const belumDicek = filtered.filter((f) => f.checklist === null).length;

    // A student is "Lengkap" if they have checked items AND all of them have status === "Lengkap"
    const lengkap = sudahDicekList.filter((f) => {
      if (!f.checklist || f.checklist.items.length === 0) return false;
      return f.checklist.items.every((it) => it.status === "Lengkap");
    }).length;

    const belumLengkap = sudahDicek - lengkap;

    // Find the item deficiencies (Parts 8)
    const deficientItemsCounts: { [name: string]: number } = {};
    const missingItemsCounts: { [name: string]: number } = {};

    sudahDicekList.forEach((f) => {
      if (f.checklist) {
        f.checklist.items.forEach((it) => {
          if (it.status === "Kurang") {
            deficientItemsCounts[it.itemName] = (deficientItemsCounts[it.itemName] || 0) + 1;
          } else if (it.status === "Tidak Membawa") {
            missingItemsCounts[it.itemName] = (missingItemsCounts[it.itemName] || 0) + 1;
          }
        });
      }
    });

    const mostDeficientItems = Object.entries(deficientItemsCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const mostMissingItems = Object.entries(missingItemsCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return {
      filtered,
      totalSantri,
      sudahDicek,
      belumDicek,
      lengkap,
      belumLengkap,
      mostDeficientItems,
      mostMissingItems,
      belumDicekCount,
      sedangDiperiksaCount,
      sudahDicekCount,
      pemeriksaanGuruCount,
      pemeriksaanMusrifCount,
      pemeriksaanAdminCount
    };
  }, [students, allChecklists, classes, academicYears, statuses, examiners, filterClass, filterYear, filterPetugas, filterSearch, filterStatus, filterRole]);

  if (isLoading && masterGoods.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading />
      </div>
    );
  }

  // Warning screen if not assigned & not Admin
  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-amber-50 p-4 dark:bg-amber-950/20 text-amber-500">
            <ShieldAlert className="h-16 w-16" />
          </div>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white mb-2">Akses Terbatas</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
          Modul **Inventaris Masuk Santri** memerlukan hak akses admin atau penugasan tertulis dari administrator asrama. Silakan hubungi admin untuk memberikan penugasan kepada Anda.
        </p>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition"
        >
          <RefreshCw className="h-4 w-4" /> Periksa Status Akses
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-3xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400">
              <ClipboardList className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">Inventaris Masuk Santri</h1>
          </div>
          <p className="text-xs text-slate-400">
            Pengecekan dan riwayat berkala perlengkapan santri baru & asrama Pondok Pesantren Alkarim Rasyid Indonesia.
          </p>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-zinc-950 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab("checklist")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "checklist"
                ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            <ClipboardList className="h-4 w-4" /> Cek Barang
          </button>
          <button
            onClick={() => setActiveTab("rekap")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "rekap"
                ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
            }`}
          >
            <BarChart3 className="h-4 w-4" /> Rekapitulasi
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab("master")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "master"
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                <Package className="h-4 w-4" /> Master Barang
              </button>
              <button
                onClick={() => setActiveTab("penugasan")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === "penugasan"
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs"
                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200"
                }`}
              >
                <UserCheck className="h-4 w-4" /> Penugasan
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB CONTENTS */}

      {/* TAB 1: FORM CEKLIS BARANG */}
      {activeTab === "checklist" && (
        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-6">
          
          {/* EXAMINER MINI-DASHBOARD (Part 9) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50/50 dark:bg-zinc-950/20 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-zinc-800 rounded-xl text-indigo-600 dark:text-indigo-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Sudah Anda Periksa</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">
                  {allChecklists.filter((c) => c.updatedBy === user?.uid).length} <span className="text-xs font-normal text-slate-400">Santri</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-150 dark:border-zinc-800 sm:pl-4">
              <div className="p-2 bg-amber-50 dark:bg-zinc-800 rounded-xl text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Belum Diperiksa</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">
                  {students.length - allChecklists.length} <span className="text-xs font-normal text-slate-400">Santri</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-150 dark:border-zinc-800 sm:pl-4">
              <div className="p-2 bg-emerald-50 dark:bg-zinc-800 rounded-xl text-emerald-600 dark:text-emerald-400">
                <User className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Tersedia untuk Diperiksa</span>
                <span className="text-lg font-black text-slate-800 dark:text-white">
                  {studentsFilteredByChecklistClass.length} <span className="text-xs font-normal text-slate-400">Santri</span>
                </span>
              </div>
            </div>
          </div>

          {/* TOP SECTION: KELAS & NAMA SELECTORS */}
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">Pilih Kelas & Santri</h2>
              <p className="text-[11px] text-slate-400">Silakan pilih kelas terlebih dahulu, kemudian pilih nama santri untuk mengaudit barang bawaan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dropdown Kelas */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Kelas</label>
                <select
                  value={checklistClassId}
                  onChange={(e) => handleDropdownClassChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 px-3.5 py-2.5 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-zinc-300 font-medium"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dropdown Nama Santri */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Nama Santri</label>
                <select
                  value={selectedStudent?.id || ""}
                  onChange={(e) => handleDropdownStudentChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 px-3.5 py-2.5 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-zinc-300 font-medium"
                >
                  <option value="">-- Pilih Nama Santri --</option>
                  {studentsFilteredByChecklistClass.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.name} {std.nis ? `(NIS: ${std.nis})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ACTIVE STUDENT INFORMATION COMPACT HEADER */}
          {selectedStudent && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-indigo-50/30 dark:bg-zinc-850/30 rounded-2xl border border-indigo-100/50 dark:border-zinc-800">
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block sm:inline mr-1">Nama:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{selectedStudent.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block sm:inline mr-1">NIS:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{selectedStudent.nis || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block sm:inline mr-1">Kelas:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    {classes.find((c) => c.id === selectedStudent.classId)?.name || "Tanpa Kelas"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block sm:inline mr-1">Tahun Ajaran:</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">
                    {academicYears.find((y) => y.id === selectedStudent.academicYearId)?.name || "Lainnya"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenStudentHistory(selectedStudent)}
                  className="px-3 py-1.5 border border-indigo-200 dark:border-zinc-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-zinc-800 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <History className="h-3.5 w-3.5" /> Lihat Riwayat
                </button>
                <button
                  onClick={handleCancelChecklist}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-semibold transition"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* CHECKLIST CHECK SHEET TABLE */}
          {selectedStudent ? (
            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Daftar Barang Bawaan</h3>
                  <p className="text-[11px] text-slate-400">Silakan isi jumlah barang yang dibawa oleh santri saat ini sesuai ketentuan pondok.</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedStudent && allChecklists.some((c) => c.studentId === selectedStudent.id) && (
                    <button
                      onClick={handleResetChecklist}
                      disabled={isSaving}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-rose-100 dark:border-rose-900"
                    >
                      <RefreshCw className="h-4 w-4" /> Reset Ceklis
                    </button>
                  )}
                  <button
                    onClick={handleSaveChecklist}
                    disabled={isSaving}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
                  >
                    {isSaving ? "Menyimpan..." : "Simpan Pemeriksaan"}
                  </button>
                </div>
              </div>

              {/* TABLE OF ITEMS */}
              <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                      <th className="py-3 px-4 font-bold">Nama Barang / Kategori</th>
                      <th className="py-3 px-2 text-center font-bold">Jumlah yang Harus Dibawa</th>
                      <th className="py-3 px-2 text-center font-bold">Dibawa</th>
                      <th className="py-3 px-4 text-center font-bold">Status Verifikasi</th>
                      <th className="py-3 px-4 font-bold">Catatan Pengawas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {(() => {
                      let globalItemIndex = 0;
                      return groupedChecklistItems.map((group, groupIdx) => (
                        <React.Fragment key={group.category}>
                          {/* Section Category Header */}
                          <tr className="bg-slate-100/80 dark:bg-zinc-800/80 border-t border-b border-slate-200 dark:border-zinc-700">
                            <td colSpan={5} className="py-2.5 px-4 font-black text-xs tracking-wider text-indigo-700 dark:text-indigo-400 uppercase">
                              Kelompok {groupIdx + 1}: {group.category}
                            </td>
                          </tr>
                          {group.items.map((item) => {
                            globalItemIndex++;
                            const masterInfo = masterGoods.find((g) => g.id === item.itemId);
                            return (
                              <tr key={item.itemId} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-slate-400 w-5 text-right">{globalItemIndex}.</span>
                                    <div>
                                      <p className="font-bold text-slate-800 dark:text-zinc-200">{item.itemName}</p>
                                      <span className="text-[9px] text-slate-400">
                                        {group.category}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-center font-bold text-slate-600 dark:text-zinc-300">
                                  {item.minQty} {masterInfo?.unit || "Pcs"}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.actualQty !== null ? item.actualQty : ""}
                                    placeholder="-"
                                    onChange={(e) => handleQtyChange(item.itemId, e.target.value)}
                                    className="w-14 text-center py-1 border border-slate-150 dark:border-zinc-800 rounded-lg text-xs bg-slate-50 dark:bg-zinc-950"
                                  />
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <select
                                    value={item.status}
                                    onChange={(e) => handleStatusOverride(item.itemId, e.target.value)}
                                    className={`text-[10px] font-bold rounded-lg px-2 py-1 border cursor-pointer ${
                                      item.status === "Lengkap"
                                        ? "bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                                        : item.status === "Kurang"
                                        ? "bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                                        : item.status === "Tidak Membawa"
                                        ? "bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400"
                                        : item.status === "Rusak"
                                        ? "bg-red-50 border-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400"
                                        : "bg-slate-100 border-slate-200 text-slate-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                                    }`}
                                  >
                                    <option value="Belum Dicek">Belum Dicek</option>
                                    <option value="Lengkap">Lengkap</option>
                                    <option value="Kurang">Kurang</option>
                                    <option value="Tidak Membawa">Tidak Membawa</option>
                                    <option value="Rusak">Rusak</option>
                                  </select>
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="text"
                                    value={item.notes || ""}
                                    placeholder="Opsional..."
                                    onChange={(e) => handleNotesChange(item.itemId, e.target.value)}
                                    className="w-full py-1 px-2 border border-slate-150 dark:border-zinc-850 rounded-lg text-xs bg-slate-50 dark:bg-zinc-950"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Catatan Pemeriksa Umum (Part 6) */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Catatan Umum Pemeriksa
                </label>
                <textarea
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Masukkan catatan atau keterangan umum tambahan mengenai kelengkapan barang bawaan santri ini..."
                  className="w-full h-20 p-3 border border-slate-150 dark:border-zinc-850 rounded-2xl text-xs bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 border-t border-slate-100 dark:border-zinc-800">
              <ClipboardList className="h-16 w-16 text-slate-300 dark:text-zinc-700 mb-4" />
              <h3 className="font-extrabold text-slate-700 dark:text-zinc-300">Belum Ada Santri Terpilih</h3>
              <p className="text-xs max-w-sm">Pilih kelas dan nama santri di atas untuk memulai pemeriksaan barang bawaan.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REKAPITULASI DATA KESELURUHAN (Part 8) */}
      {activeTab === "rekap" && (
        <div className="space-y-6">
          {/* STATS HIGHLIGHTS - DASBOR UNTUK ADMIN (Part 8) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Belum Diperiksa */}
            <button
              onClick={() => {
                setFilterStatus(filterStatus === "Belum Diperiksa" ? "" : "Belum Diperiksa");
                setFilterRole("");
              }}
              className={`text-left rounded-3xl p-5 flex flex-col justify-between border transition-all relative overflow-hidden group ${
                filterStatus === "Belum Diperiksa"
                  ? "bg-amber-500 text-white border-amber-600 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-amber-200 dark:hover:border-amber-900/40 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  filterStatus === "Belum Diperiksa" ? "text-amber-100" : "text-slate-400"
                }`}>Belum Diperiksa</p>
                <Clock className={`h-4 w-4 ${
                  filterStatus === "Belum Diperiksa" ? "text-white" : "text-amber-500"
                }`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black">{rekapData.belumDicekCount}</h3>
                <p className={`text-[9px] mt-0.5 ${
                  filterStatus === "Belum Diperiksa" ? "text-amber-100" : "text-slate-400"
                }`}>Klik untuk filter</p>
              </div>
            </button>

            {/* 2. Sedang Diperiksa */}
            <button
              onClick={() => {
                setFilterStatus(filterStatus === "Sedang Diperiksa" ? "" : "Sedang Diperiksa");
                setFilterRole("");
              }}
              className={`text-left rounded-3xl p-5 flex flex-col justify-between border transition-all relative overflow-hidden group ${
                filterStatus === "Sedang Diperiksa"
                  ? "bg-indigo-600 text-white border-indigo-700 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-900/40 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  filterStatus === "Sedang Diperiksa" ? "text-indigo-100" : "text-slate-400"
                }`}>Sedang Diperiksa</p>
                <RefreshCw className={`h-4 w-4 ${
                  filterStatus === "Sedang Diperiksa" ? "text-white animate-spin" : "text-indigo-600 dark:text-indigo-400"
                }`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black">{rekapData.sedangDiperiksaCount}</h3>
                <p className={`text-[9px] mt-0.5 ${
                  filterStatus === "Sedang Diperiksa" ? "text-indigo-100" : "text-slate-400"
                }`}>Klik untuk filter</p>
              </div>
            </button>

            {/* 3. Sudah Diperiksa */}
            <button
              onClick={() => {
                setFilterStatus(filterStatus === "Selesai" ? "" : "Selesai");
                setFilterRole("");
              }}
              className={`text-left rounded-3xl p-5 flex flex-col justify-between border transition-all relative overflow-hidden group ${
                filterStatus === "Selesai"
                  ? "bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-emerald-200 dark:hover:border-emerald-900/40 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  filterStatus === "Selesai" ? "text-emerald-100" : "text-slate-400"
                }`}>Sudah Diperiksa</p>
                <CheckCircle2 className={`h-4 w-4 ${
                  filterStatus === "Selesai" ? "text-white" : "text-emerald-600 dark:text-emerald-400"
                }`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black">{rekapData.sudahDicekCount}</h3>
                <p className={`text-[9px] mt-0.5 ${
                  filterStatus === "Selesai" ? "text-emerald-100" : "text-slate-400"
                }`}>Klik untuk filter</p>
              </div>
            </button>

            {/* 4. Pemeriksaan per Guru */}
            <button
              onClick={() => {
                setFilterRole(filterRole === "guru" ? "" : "guru");
                setFilterStatus("");
              }}
              className={`text-left rounded-3xl p-5 flex flex-col justify-between border transition-all relative overflow-hidden group ${
                filterRole === "guru"
                  ? "bg-sky-600 text-white border-sky-700 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-sky-200 dark:hover:border-sky-900/40 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  filterRole === "guru" ? "text-sky-100" : "text-slate-400"
                }`}>Oleh Guru</p>
                <UserCheck className={`h-4 w-4 ${
                  filterRole === "guru" ? "text-white" : "text-sky-600 dark:text-sky-400"
                }`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black">{rekapData.pemeriksaanGuruCount}</h3>
                <p className={`text-[9px] mt-0.5 ${
                  filterRole === "guru" ? "text-sky-100" : "text-slate-400"
                }`}>Klik untuk filter</p>
              </div>
            </button>

            {/* 5. Pemeriksaan per Musrif */}
            <button
              onClick={() => {
                setFilterRole(filterRole === "musrif" ? "" : "musrif");
                setFilterStatus("");
              }}
              className={`text-left rounded-3xl p-5 flex flex-col justify-between border transition-all relative overflow-hidden group ${
                filterRole === "musrif"
                  ? "bg-purple-600 text-white border-purple-700 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-purple-200 dark:hover:border-purple-900/40 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  filterRole === "musrif" ? "text-purple-100" : "text-slate-400"
                }`}>Oleh Musrif</p>
                <UserCheck className={`h-4 w-4 ${
                  filterRole === "musrif" ? "text-white" : "text-purple-600 dark:text-purple-400"
                }`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black">{rekapData.pemeriksaanMusrifCount}</h3>
                <p className={`text-[9px] mt-0.5 ${
                  filterRole === "musrif" ? "text-purple-100" : "text-slate-400"
                }`}>Klik untuk filter</p>
              </div>
            </button>

            {/* 6. Pemeriksaan per Admin */}
            <button
              onClick={() => {
                setFilterRole(filterRole === "admin" ? "" : "admin");
                setFilterStatus("");
              }}
              className={`text-left rounded-3xl p-5 flex flex-col justify-between border transition-all relative overflow-hidden group ${
                filterRole === "admin"
                  ? "bg-slate-700 text-white border-slate-800 shadow-md scale-[1.02]"
                  : "bg-white dark:bg-zinc-900 border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                  filterRole === "admin" ? "text-slate-200" : "text-slate-400"
                }`}>Oleh Admin</p>
                <UserCheck className={`h-4 w-4 ${
                  filterRole === "admin" ? "text-white" : "text-slate-600 dark:text-zinc-400"
                }`} />
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-black">{rekapData.pemeriksaanAdminCount}</h3>
                <p className={`text-[9px] mt-0.5 ${
                  filterRole === "admin" ? "text-slate-200" : "text-slate-400"
                }`}>Klik untuk filter</p>
              </div>
            </button>
          </div>

          {/* ANALYSIS ROW (Parts 8) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-3xl space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" /> Barang Paling Sering Kurang (Dibawa Kurang Qty)
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Top perlengkapan yang dibawa santri namun di bawah minimal ketentuan.</p>
              </div>
              <div className="space-y-2">
                {rekapData.mostDeficientItems.length > 0 ? (
                  rekapData.mostDeficientItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-2 border-b border-slate-50 dark:border-zinc-850 last:border-0">
                      <span className="font-bold text-slate-700 dark:text-zinc-200">{item.name}</span>
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-600 font-black rounded-lg text-[10px]">
                        {item.count} Santri
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">Belum ada statistik barang kurang.</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-3xl space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" /> Barang Paling Sering Tidak Bawa (0 Qty)
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Top perlengkapan pondok yang sama sekali tidak dipersiapkan/dibawa.</p>
              </div>
              <div className="space-y-2">
                {rekapData.mostMissingItems.length > 0 ? (
                  rekapData.mostMissingItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-2 border-b border-slate-50 dark:border-zinc-850 last:border-0">
                      <span className="font-bold text-slate-700 dark:text-zinc-200">{item.name}</span>
                      <span className="px-2 py-0.5 bg-red-50 text-red-600 font-black rounded-lg text-[10px]">
                        {item.count} Santri
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">Belum ada statistik tidak bawa.</p>
                )}
              </div>
            </div>
          </div>

          {/* FILTERING HEADER & STUDENT STATUS TABLE (Part 8) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Rekapitulasi Santri</h3>
                <p className="text-[11px] text-slate-400">Gunakan filter di bawah untuk memetakan hasil audit asrama.</p>
                {(filterStatus || filterRole) && (
                  <button
                    onClick={() => {
                      setFilterStatus("");
                      setFilterRole("");
                    }}
                    className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900 rounded-md text-[10px] font-bold transition hover:bg-rose-100 dark:hover:bg-rose-950/40"
                  >
                    <span>Filter Aktif: {filterStatus || filterRole}</span>
                    <XCircle className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* FILTERING CONTROLS (Part 8) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2 flex-1 max-w-4xl justify-end">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nama / NIS..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 w-full lg:w-36 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl text-xs"
                  />
                </div>

                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl text-xs text-slate-600 dark:text-zinc-300"
                >
                  <option value="">Semua Kelas</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl text-xs text-slate-600 dark:text-zinc-300"
                >
                  <option value="">Semua Thn Pelajaran</option>
                  {academicYears.map((ay) => (
                    <option key={ay.id} value={ay.id}>{ay.name}</option>
                  ))}
                </select>

                <select
                  value={filterPetugas}
                  onChange={(e) => setFilterPetugas(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl text-xs text-slate-600 dark:text-zinc-300"
                >
                  <option value="">Semua Petugas</option>
                  {examiners.map((ex) => (
                    <option key={ex.id} value={ex.id}>{ex.displayName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* MAIN TABLE */}
            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800 font-bold">
                    <th className="py-3 px-4">Nama Santri / NIS</th>
                    <th className="py-3 px-4">Kelas</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Tanggal</th>
                    <th className="py-3 px-4 text-center">Jam</th>
                    <th className="py-3 px-4">Pemeriksa</th>
                    <th className="py-3 px-4 text-center">Role</th>
                    <th className="py-3 px-2 text-center">Lengkap</th>
                    <th className="py-3 px-2 text-center">Kurang</th>
                    <th className="py-3 px-2 text-center">Tidak Bawa</th>
                    <th className="py-3 px-4">Catatan</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {rekapData.filtered.length > 0 ? (
                    rekapData.filtered.map(({ student, className, status, examinerRole, checklist }) => {
                      const chk = checklist;
                      const totalItems = chk?.items.length || 0;
                      const lengkapQty = chk?.items.filter((i) => i.status === "Lengkap").length || 0;
                      const kurangQty = chk?.items.filter((i) => i.status === "Kurang").length || 0;
                      const tidakMembawaQty = chk?.items.filter((i) => i.status === "Tidak Membawa").length || 0;

                      // status badge
                      let statusBadge = (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 whitespace-nowrap">
                          Belum Diperiksa
                        </span>
                      );
                      if (status === "Sedang Diperiksa") {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 whitespace-nowrap">
                            Sedang Diperiksa
                          </span>
                        );
                      } else if (status === "Selesai") {
                        statusBadge = (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 whitespace-nowrap">
                            Selesai
                          </span>
                        );
                      }

                      const roleDisplay = examinerRole ? (examinerRole.charAt(0).toUpperCase() + examinerRole.slice(1)) : "-";

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-800 dark:text-zinc-100 whitespace-nowrap">{student.name}</p>
                            <span className="text-[9px] text-slate-400 font-mono">NIS: {student.nis || "-"}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300 font-medium whitespace-nowrap">{className}</td>
                          <td className="py-3 px-4 text-center">{statusBadge}</td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono whitespace-nowrap">
                            {chk ? new Date(chk.updatedAt).toLocaleDateString("id-ID") : "-"}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500 font-mono whitespace-nowrap">
                            {chk?.time || (chk ? new Date(chk.updatedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-")}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300 font-bold whitespace-nowrap">
                            {chk ? chk.examinerName : "-"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {chk ? (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap ${
                                examinerRole === "admin" 
                                  ? "bg-slate-100 text-slate-800 dark:bg-zinc-850 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800"
                                  : examinerRole === "guru"
                                  ? "bg-sky-50 text-sky-700 dark:bg-sky-950/20 dark:text-sky-400"
                                  : "bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
                              }`}>
                                {roleDisplay}
                              </span>
                            ) : "-"}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {chk ? `${lengkapQty}/${totalItems}` : "-"}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {chk ? kurangQty : "-"}
                          </td>
                          <td className="py-3 px-2 text-center font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {chk ? tidakMembawaQty : "-"}
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-[150px] truncate" title={chk?.generalNotes || ""}>
                            {chk?.generalNotes || "-"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSelectStudent(student)}
                                className="px-2 py-1 bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition whitespace-nowrap"
                              >
                                {chk ? "Edit Ceklis" : "Cek Barang"}
                              </button>
                              <button
                                onClick={() => handleOpenStudentHistory(student)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition"
                                title="Lihat Riwayat Riil"
                              >
                                <History className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-400">
                        Belum ada data pemeriksaan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MASTER BARANG (Admin Only) */}
      {activeTab === "master" && isAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-3xl">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">Master Barang & Kategori</h2>
              <p className="text-[11px] text-slate-400">Atur seluruh ketentuan minimal kelengkapan perlengkapan santri dan kelompok barang.</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setEditingCategory(null);
                  setNewCategoryName("");
                  setIsCategoryModalOpen(true);
                }}
                className="px-4 py-2 border border-slate-150 dark:border-zinc-800 hover:bg-slate-50 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <FolderPlus className="h-4 w-4" /> Tambah Kategori
              </button>
              <button
                onClick={handleOpenAddGood}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Tambah Barang
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs for Master */}
          <div className="flex border-b border-slate-150 dark:border-zinc-850 gap-6 px-2">
            <button
              onClick={() => setMasterSubTab("goods")}
              className={`pb-3 text-xs font-bold transition-all ${
                masterSubTab === "goods"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              }`}
            >
              Daftar Barang & Urutan
            </button>
            <button
              onClick={() => setMasterSubTab("categories")}
              className={`pb-3 text-xs font-bold transition-all ${
                masterSubTab === "categories"
                  ? "border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
              }`}
            >
              Kelola Kategori & Urutan
            </button>
          </div>

          {masterSubTab === "goods" ? (
            /* TAB 3A: GOODS LIST GROUPED BY CATEGORY */
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                      <th className="py-3 px-4 font-bold">No. / Nama Barang</th>
                      <th className="py-3 px-4 text-center font-bold">Jumlah Minimal</th>
                      <th className="py-3 px-4 text-center font-bold">Keterangan</th>
                      <th className="py-3 px-4 text-center font-bold">Status</th>
                      <th className="py-3 px-4 text-center font-bold">Pindah Urutan</th>
                      <th className="py-3 px-4 text-center font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {(() => {
                      // Group master goods by category
                      const groups: { [categoryName: string]: MasterGood[] } = {};
                      masterGoods.forEach((good) => {
                        const cat = good.category || "Lain-lain";
                        if (!groups[cat]) groups[cat] = [];
                        groups[cat].push(good);
                      });

                      // Sort categories based on order
                      const sortedCategoryList: { category: string; goods: MasterGood[] }[] = [];
                      const seenCats = new Set<string>();

                      categories.forEach((cat) => {
                        if (groups[cat.name] && !seenCats.has(cat.name)) {
                          seenCats.add(cat.name);
                          sortedCategoryList.push({ category: cat.name, goods: groups[cat.name] });
                        }
                      });

                      Object.keys(groups).forEach((catName) => {
                        if (!seenCats.has(catName)) {
                          seenCats.add(catName);
                          sortedCategoryList.push({ category: catName, goods: groups[catName] });
                        }
                      });

                      if (sortedCategoryList.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              Belum ada data master barang. Tambahkan barang untuk memulai.
                            </td>
                          </tr>
                        );
                      }

                      let globalGoodIdx = 0;
                      return sortedCategoryList.map((group, groupIdx) => (
                        <React.Fragment key={group.category}>
                          {/* Group Category Row */}
                          <tr className="bg-slate-55 dark:bg-zinc-850 border-t border-b border-slate-200 dark:border-zinc-800 font-bold text-xs">
                            <td colSpan={6} className="py-2 px-4 uppercase text-indigo-700 dark:text-indigo-400 tracking-wider font-extrabold bg-indigo-50/50 dark:bg-indigo-950/25">
                              Kelompok {groupIdx + 1}: {group.category}
                            </td>
                          </tr>
                          {group.goods.map((good, idx) => {
                            globalGoodIdx++;
                            return (
                              <tr key={good.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] text-slate-400 w-5 text-right">{globalGoodIdx}.</span>
                                    <div>
                                      <p className="font-bold text-slate-800 dark:text-zinc-100">{good.name}</p>
                                      <span className="text-[9px] text-slate-400">Kategori: {group.category}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center font-black text-slate-700 dark:text-zinc-300">
                                  {good.minQty} {good.unit}
                                </td>
                                <td className="py-3 px-4 text-center text-slate-400 font-medium">{good.notes || "-"}</td>
                                <td className="py-3 px-4 text-center">
                                  {good.isActive ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                                      Aktif
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-150 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500">
                                      Nonaktif
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-zinc-950 p-1 rounded-lg border border-slate-100 dark:border-zinc-800">
                                    <button
                                      disabled={idx === 0 || isSaving}
                                      onClick={() => handleMoveGood(good, "up")}
                                      className="p-1 hover:bg-slate-150 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 disabled:opacity-30 transition"
                                      title="Naikkan Urutan"
                                    >
                                      <ChevronUp className="h-4 w-4" />
                                    </button>
                                    <button
                                      disabled={idx === group.goods.length - 1 || isSaving}
                                      onClick={() => handleMoveGood(good, "down")}
                                      className="p-1 hover:bg-slate-150 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 disabled:opacity-30 transition"
                                      title="Turunkan Urutan"
                                    >
                                      <ChevronDown className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-3">
                                    <button
                                      onClick={() => handleOpenEditGood(good)}
                                      className="text-indigo-600 hover:text-indigo-500 transition"
                                      title="Ubah Barang (Dapat memindahkan Kategori)"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteGood(good.id, good.name)}
                                      className="text-rose-600 hover:text-rose-500 transition"
                                      title="Hapus Barang"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* TAB 3B: CATEGORIES LIST & REORDERING */
            <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                      <th className="py-3 px-4 font-bold">Urutan</th>
                      <th className="py-3 px-4 font-bold">Nama Kategori</th>
                      <th className="py-3 px-4 text-center font-bold">Jumlah Barang Terkait</th>
                      <th className="py-3 px-4 text-center font-bold font-mono">ID / Urutan Code</th>
                      <th className="py-3 px-4 text-center font-bold">Pindah Urutan</th>
                      <th className="py-3 px-4 text-center font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                    {categories.length > 0 ? (
                      categories.map((cat, idx) => {
                        const goodCount = masterGoods.filter((g) => g.category === cat.name).length;
                        return (
                          <tr key={cat.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                            <td className="py-3.5 px-4 font-bold font-mono text-slate-600 dark:text-zinc-400">
                              Kelompok {idx + 1}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-zinc-100">
                              {cat.name}
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-500">
                              {goodCount} Barang
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-[10px]">
                              {cat.urutan || 999}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-zinc-950 p-1 rounded-lg border border-slate-100 dark:border-zinc-800">
                                <button
                                  disabled={idx === 0 || isSaving}
                                  onClick={() => handleMoveCategory(cat, "up")}
                                  className="p-1 hover:bg-slate-150 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 disabled:opacity-30 transition"
                                  title="Naikkan Urutan Kategori"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </button>
                                <button
                                  disabled={idx === categories.length - 1 || isSaving}
                                  onClick={() => handleMoveCategory(cat, "down")}
                                  className="p-1 hover:bg-slate-150 dark:hover:bg-zinc-800 rounded text-slate-500 dark:text-zinc-400 disabled:opacity-30 transition"
                                  title="Turunkan Urutan Kategori"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  onClick={() => {
                                    setEditingCategory(cat);
                                    setNewCategoryName(cat.name);
                                    setIsCategoryModalOpen(true);
                                  }}
                                  className="text-indigo-600 hover:text-indigo-500 transition"
                                  title="Ubah Nama Kategori"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  disabled={cat.name === "Lain-lain"}
                                  onClick={() => handleDeleteCategory(cat)}
                                  className="text-rose-600 hover:text-rose-500 transition disabled:opacity-20"
                                  title={cat.name === "Lain-lain" ? "Kategori utama tidak bisa dihapus" : "Hapus Kategori"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada data kategori.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PENUGASAN PETUGAS (Admin Only) */}
      {activeTab === "penugasan" && isAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 p-6 rounded-3xl">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white">Manajemen Penugasan Pemeriksa</h2>
              <p className="text-[11px] text-slate-400">Tugaskan Guru atau Musrif untuk dapat menginput hasil ceklis asrama.</p>
            </div>

            <button
              onClick={() => setIsExaminerModalOpen(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Plus className="h-4 w-4" /> Tambah Petugas
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-3 px-4 font-bold">Nama Lengkap</th>
                    <th className="py-3 px-4 font-bold">Email</th>
                    <th className="py-3 px-4 font-bold">Role Sistem</th>
                    <th className="py-3 px-4 text-center font-bold">Hak Edit Ceklis Lain</th>
                    <th className="py-3 px-4 text-center font-bold">Ditugaskan Pada</th>
                    <th className="py-3 px-4 text-center font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {examiners.length > 0 ? (
                    examiners.map((ex) => (
                      <tr key={ex.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                          <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <User className="h-4 w-4" />
                          </span>
                          {ex.displayName}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{ex.email}</td>
                        <td className="py-3 px-4 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">{ex.role}</td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={ex.canEditOthers || false}
                            onChange={(e) => handleToggleEditOthers(ex.id, e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-zinc-850 rounded cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 font-mono">
                          {new Date(ex.assignedAt).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleRemoveExaminer(ex.id, ex.displayName)}
                            className="p-1 text-rose-600 hover:text-rose-500 transition"
                            title="Cabut Hak Akses"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Belum ada petugas ditugaskan. Secara default hanya Admin yang memegang kendali.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PEMANTAUAN REALTIME & LOCKS (Part 11) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-indigo-500" />
                Pemantauan Pemeriksaan Aktif & Penguncian (Real-time)
              </h2>
              <p className="text-[11px] text-slate-400">
                Berikut adalah status penguncian nyata saat petugas sedang memeriksa santri di asrama. Anda dapat melepas kunci secara paksa jika diperlukan.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800">
                    <th className="py-3 px-4 font-bold">Nama Santri</th>
                    <th className="py-3 px-4 font-bold">Status Pemeriksaan</th>
                    <th className="py-3 px-4 font-bold">Pemeriksa / Pemegang Kunci</th>
                    <th className="py-3 px-4 text-center font-bold">Waktu Penguncian / Aktif</th>
                    <th className="py-3 px-4 text-center font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {statuses.length > 0 ? (
                    statuses.map((statusObj) => {
                      const isCurrentlyLocked = !!statusObj.lockedBy;
                      const lastActiveTime = statusObj.lastActive ? new Date(statusObj.lastActive).getTime() : 0;
                      const now = new Date().getTime();
                      const isLockExpired = (now - lastActiveTime) >= 5 * 60 * 1000;
                      const isActiveLock = isCurrentlyLocked && !isLockExpired;

                      return (
                        <tr key={statusObj.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                          <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-zinc-100">
                            {statusObj.studentName}
                          </td>
                          <td className="py-3.5 px-4">
                            {statusObj.status === "Selesai" ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                                Selesai Diperiksa
                              </span>
                            ) : isActiveLock ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse">
                                Sedang Diperiksa (Kunci Aktif)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                                Belum Diperiksa / Kunci Bebas
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-300 font-medium">
                            {isActiveLock ? (
                              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{statusObj.lockedByName}</span>
                            ) : statusObj.status === "Selesai" ? (
                              <span className="text-slate-500">Pemeriksaan Selesai</span>
                            ) : (
                              <span className="text-slate-400 italic">Tidak ada</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                            {isActiveLock && statusObj.lockedAt ? (
                              new Date(statusObj.lockedAt).toLocaleTimeString("id-ID")
                            ) : statusObj.updatedAt ? (
                              new Date(statusObj.updatedAt).toLocaleTimeString("id-ID")
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isActiveLock ? (
                              <button
                                onClick={() => handleForceUnlock(statusObj.studentId, statusObj.studentName, statusObj.lockedBy || "", statusObj.lockedByName || "")}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-bold transition border border-rose-100"
                                title="Lepas kunci pemeriksaan santri ini agar dapat diakses petugas lain"
                              >
                                Unlock Paksa
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-700 text-[11px] font-medium">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Belum ada aktifitas penguncian atau pemeriksaan santri saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AUDIT STATUS LOGS HISTORY (Part 12) */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-500" />
                Histori Log Aktivitas & Audit Pemeriksaan
              </h2>
              <p className="text-[11px] text-slate-400">
                Catatan kronologis perubahan status pemeriksaan santri untuk audit keamanan dan pencegahan kesalahan pemeriksaan ganda.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-100 dark:border-zinc-800 rounded-2xl max-h-[300px]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 dark:bg-zinc-950 text-slate-400 border-b border-slate-100 dark:border-zinc-800 z-10">
                  <tr>
                    <th className="py-3 px-4 font-bold">Waktu Kejadian</th>
                    <th className="py-3 px-4 font-bold">Petugas</th>
                    <th className="py-3 px-4 font-bold">Santri</th>
                    <th className="py-3 px-4 text-center font-bold">Perubahan Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20">
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {new Date(log.timestamp).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-700 dark:text-zinc-200">
                          {log.examinerName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-zinc-300">
                          {log.studentName}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold ${
                              log.statusSebelum === "Selesai"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                                : log.statusSebelum === "Sedang Diperiksa"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                                : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {log.statusSebelum}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              log.statusSesudah === "Selesai"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                                : log.statusSesudah === "Sedang Diperiksa"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                                : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
                            }`}>
                              {log.statusSesudah}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        Belum ada histori aktivitas pemeriksaan terekam.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS INTERFACES --- */}

      {/* MODAL 1: ADD/EDIT MASTER BARANG */}
      <Dialog
        isOpen={isGoodModalOpen}
        onClose={() => setIsGoodModalOpen(false)}
        title={editingGood ? "Ubah Barang Master" : "Tambah Barang Master Baru"}
        size="md"
      >
        <form onSubmit={handleSaveGood} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nama Barang</label>
            <input
              type="text"
              required
              placeholder="Contoh: Kasur Busa Inoac, Kitab Safinah, Piring, dll..."
              value={goodForm.name}
              onChange={(e) => setGoodForm({ ...goodForm, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Jumlah Ketentuan Minimal</label>
              <input
                type="number"
                min="1"
                required
                value={goodForm.minQty}
                onChange={(e) => setGoodForm({ ...goodForm, minQty: parseInt(e.target.value) || 1 })}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Satuan</label>
              <input
                type="text"
                required
                placeholder="Contoh: Pcs, Buah, Stel, Pasang"
                value={goodForm.unit}
                onChange={(e) => setGoodForm({ ...goodForm, unit: e.target.value })}
                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kategori Barang</label>
            <select
              value={goodForm.category}
              onChange={(e) => setGoodForm({ ...goodForm, category: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Keterangan Tambahan (Opsional)</label>
            <input
              type="text"
              placeholder="Contoh: Harus berwarna putih polos, ukuran sedang..."
              value={goodForm.notes}
              onChange={(e) => setGoodForm({ ...goodForm, notes: e.target.value })}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActiveCheck"
              checked={goodForm.isActive}
              onChange={(e) => setGoodForm({ ...goodForm, isActive: e.target.checked })}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActiveCheck" className="text-xs font-bold text-slate-700 dark:text-zinc-300 select-none">
              Barang Aktif (Ditampilkan pada lembar ceklis)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsGoodModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
            >
              Simpan Barang
            </button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 2: ADD/EDIT KATEGORI */}
      <Dialog
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
          setNewCategoryName("");
        }}
        title={editingCategory ? `Ubah Nama Kategori "${editingCategory.name}"` : "Tambah Kategori Barang Baru"}
        size="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nama Kategori</label>
            <input
              type="text"
              required
              placeholder="Contoh: Perlengkapan Makan, dll"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsCategoryModalOpen(false);
                setEditingCategory(null);
                setNewCategoryName("");
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
            >
              {editingCategory ? "Simpan Perubahan" : "Tambah Kategori"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* MODAL 3: PENUGASAN PETUGAS */}
      <Dialog
        isOpen={isExaminerModalOpen}
        onClose={() => setIsExaminerModalOpen(false)}
        title="Tugaskan Petugas Pemeriksa Baru"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pilih Guru / Musrif</label>
            <select
              value={selectedUserToAssign}
              onChange={(e) => setSelectedUserToAssign(e.target.value)}
              className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-150 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs"
            >
              <option value="">-- Pilih Akun --</option>
              {systemUsers.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName || u.name} ({u.roles?.join(", ") || u.role})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsExaminerModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
            >
              Batal
            </button>
            <button
              onClick={handleAssignExaminer}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
            >
              Simpan Penugasan
            </button>
          </div>
        </div>
      </Dialog>

      {/* MODAL 4: LIHAT HISTORIS RIIL (Part 7) */}
      <Dialog
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Riwayat Inventaris: ${historyStudent?.name}`}
        size="lg"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl flex justify-between items-center text-xs">
            <div>
              <p className="font-bold text-slate-700 dark:text-zinc-200">{historyStudent?.name}</p>
              <span className="text-[11px] text-slate-400">NIS: {historyStudent?.nis || "-"}</span>
            </div>
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 font-bold rounded-lg uppercase tracking-wider">
              {historyStudent?.status}
            </span>
          </div>

          {studentHistoryList.length > 0 ? (
            <div className="space-y-6">
              {studentHistoryList.map((hist, index) => (
                <div key={hist.id} className="border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2.5 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className="h-4 w-4" />
                      <span>Sesi: {new Date(hist.createdAt).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300 font-bold">
                      <User className="h-4 w-4 text-slate-400" />
                      <span>Pemeriksa: {hist.examinerName}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 text-center">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-xl">
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">Lengkap</p>
                      <h4 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400">{hist.summary.lengkap}</h4>
                    </div>
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-2 rounded-xl">
                      <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">Kurang</p>
                      <h4 className="font-extrabold text-sm text-amber-600 dark:text-amber-400">{hist.summary.kurang}</h4>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/20 p-2 rounded-xl">
                      <p className="text-[9px] text-rose-600 dark:text-rose-400 font-bold">Tak Bawa</p>
                      <h4 className="font-extrabold text-sm text-rose-600 dark:text-rose-400">{hist.summary.tidakMembawa}</h4>
                    </div>
                    <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded-xl">
                      <p className="text-[9px] text-red-600 dark:text-red-400 font-bold">Rusak</p>
                      <h4 className="font-extrabold text-sm text-red-600 dark:text-red-400">{hist.summary.rusak}</h4>
                    </div>
                    <div className="bg-slate-100 dark:bg-zinc-800 p-2 rounded-xl">
                      <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-bold">Belum</p>
                      <h4 className="font-extrabold text-sm text-slate-600 dark:text-zinc-300">{hist.summary.belumDicek}</h4>
                    </div>
                  </div>

                  {/* MINI COLLAPSE OR SIMPLE LIST FOR DETAILED ITEMS */}
                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {hist.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] py-1 border-b border-slate-50 dark:border-zinc-850/40 last:border-0">
                        <span className="text-slate-700 dark:text-zinc-200 font-medium">{it.itemName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Qty: {it.actualQty !== null ? it.actualQty : "-"} / {it.minQty}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold text-[8px] ${
                            it.status === "Lengkap" ? "bg-emerald-50 text-emerald-600" :
                            it.status === "Kurang" ? "bg-amber-50 text-amber-600" :
                            it.status === "Tidak Membawa" ? "bg-rose-50 text-rose-600" :
                            it.status === "Rusak" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"
                          }`}>
                            {it.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs">
              Belum ada data pemeriksaan.
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setIsHistoryModalOpen(false)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default InventarisMasukSantri;
