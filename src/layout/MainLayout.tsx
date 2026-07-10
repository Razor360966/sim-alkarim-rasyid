import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { academicYearService } from "../services/academicYearService";
import { AcademicYear } from "../types";
import { 
  LayoutDashboard, 
  CalendarDays, 
  GraduationCap, 
  DoorClosed, 
  Users, 
  BookOpen, 
  LogOut, 
  Menu, 
  Sun, 
  Moon, 
  ChevronLeft, 
  ChevronRight,
  School,
  User as UserIcon,
  BellRing,
  Settings as SettingsIcon,
  Clock,
  Calendar,
  Grid,
  Award,
  Shield,
  ClipboardList,
  FileCheck,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const MainLayout: React.FC = () => {
  const { user, logout, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);

  // Guard routing & Force password change
  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    } else if (user.requirePasswordChange && location.pathname !== "/change-password") {
      navigate("/change-password", { replace: true });
    }
  }, [user, navigate, location.pathname]);

  // Load active academic year
  useEffect(() => {
    if (user && !user.requirePasswordChange) {
      academicYearService.getActiveAcademicYear().then(setActiveYear);
    }
  }, [user]);

  if (!user) return null;

  const menuItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"] },
    { name: "Tahun Ajaran", path: "/academic-years", icon: CalendarDays, roles: ["admin", "tata usaha", "operator", "kepala sekolah", "ketua yayasan"] },
    { name: "Semester", path: "/semesters", icon: CalendarDays, roles: ["admin", "tata usaha", "operator", "kepala sekolah", "ketua yayasan"] },
    { name: "Mata Pelajaran", path: "/subjects", icon: BookOpen, roles: ["admin", "wakil kepala sekolah", "tata usaha", "operator", "kepala sekolah", "ketua yayasan"] },
    { name: "Struktur Kurikulum", path: "/curriculum-matrix", icon: School, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"] },
    { name: "Kelas", path: "/classes", icon: DoorClosed, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"] },
    { name: "Guru & Staf", path: "/teachers", icon: GraduationCap, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"] },
    { name: "Siswa", path: "/students", icon: Users, roles: ["admin", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"] },
    { name: "Manajemen Akun", path: "/users", icon: UserIcon, roles: ["admin", "operator"] },
    { name: "Lesson Period", path: "/lesson-periods", icon: Clock, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"] },
    { name: "Auto Scheduler", path: "/schedules", icon: CalendarDays, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Jadwal Pelajaran" },
    
    // Academic Planning Engine Foundation Menus
    { name: "Kalender Akademik", path: "/academic-calendar", icon: CalendarDays, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Perencanaan Akademik" },
    { name: "Uraian Kegiatan Tahunan", path: "/annual-activity-timeline", icon: CalendarDays, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"], group: "Perencanaan Akademik" },
    { name: "Pekan Efektif", path: "/effective-weeks", icon: Clock, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Perencanaan Akademik" },
    { name: "Hari Efektif", path: "/effective-days", icon: CalendarDays, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Perencanaan Akademik" },
    { name: "JP Efektif", path: "/effective-jp", icon: School, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Perencanaan Akademik" },
    { name: "Referensi Akademik", path: "/academic-references", icon: SettingsIcon, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Perencanaan Akademik" },

    // Perencanaan Pembelajaran
    { name: "Program Tahunan", path: "/annual-programs", icon: Calendar, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"], group: "Perencanaan Pembelajaran" },
    { name: "Program Semester", path: "/semester-programs", icon: Grid, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"], group: "Perencanaan Pembelajaran" },
    { name: "Modul Ajar", path: "/lesson-plans", icon: FileText, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"], group: "Perencanaan Pembelajaran" },
    { name: "Jurnal Mengajar", path: "/teaching-journals", icon: BookOpen, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"], group: "Perencanaan Pembelajaran" },
    { name: "Jurnal Musrif", path: "/musrif-journals", icon: BookOpen, roles: ["admin", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "ketua yayasan"], group: "Perencanaan Pembelajaran" },
    
    // Pengembangan Diri GTK
    { name: "Dashboard Pengembangan", path: "/gtk-development?tab=dashboard", icon: LayoutDashboard, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"], group: "Pengembangan Diri GTK" },
    { name: "Data Pengembangan", path: "/gtk-development?tab=data", icon: BookOpen, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"], group: "Pengembangan Diri GTK" },
    { name: "Rekap Bulanan", path: "/gtk-development?tab=monthly", icon: Calendar, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"], group: "Pengembangan Diri GTK" },
    { name: "Rekap Semester", path: "/gtk-development?tab=semester", icon: Grid, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"], group: "Pengembangan Diri GTK" },
    { name: "Rekap Tahunan", path: "/gtk-development?tab=yearly", icon: Award, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "musrif", "tata usaha", "operator", "ketua yayasan"], group: "Pengembangan Diri GTK" },

    // Supervisi
    { name: "Supervisi Akademik", path: "/supervision-academic", icon: Shield, roles: ["admin", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan", "guru"], group: "Supervisi" },
    { name: "Supervisi Manajerial", path: "/supervision-managerial", icon: Shield, roles: ["admin", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"], group: "Supervisi" },
    { name: "Instrumen Supervisi", path: "/supervision-instruments", icon: FileCheck, roles: ["admin", "kepala sekolah", "wakil kepala sekolah", "ketua yayasan"], group: "Supervisi" },

    { name: "Rapor Kinerja SDM", path: "/sdm-performance", icon: Award, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Evaluasi Kinerja" },

    { name: "Profil Saya", path: "/profile", icon: UserIcon, roles: ["admin", "guru", "pimpinan", "kepala sekolah", "wakil kepala sekolah", "tata usaha", "operator", "ketua yayasan"], group: "Akun Saya" },

    { name: "Pengaturan Sekolah", path: "/settings", icon: SettingsIcon, roles: ["admin", "kepala sekolah", "operator"], group: "Pengaturan Sekolah" },
    { name: "Agenda Rutin", path: "/settings/agendas", icon: Calendar, roles: ["admin", "kepala sekolah", "operator"], group: "Pengaturan Sekolah" },
  ];

  // Filter menu based on user multi-roles array
  const userRoles = user.roles || [user.role];
  let allowedMenuItems = menuItems.filter(item => item.roles.some(r => userRoles.includes(r)));

  if (user.role === "musrif") {
    allowedMenuItems = [
      { name: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["musrif"] },
      { name: "Kelompok Halaqah", path: "/musrif-journals?tab=kelompok", icon: Users, roles: ["musrif"], group: "Halaqah Musrif" },
      { name: "Mutabaah Harian", path: "/musrif-journals?tab=jurnal", icon: BookOpen, roles: ["musrif"], group: "Halaqah Musrif" },
      { name: "Rekap Perkembangan Santri", path: "/musrif-journals?tab=rekap", icon: Award, roles: ["musrif"], group: "Halaqah Musrif" },
      { name: "Profil Saya", path: "/profile", icon: UserIcon, roles: ["musrif"], group: "Akun Saya" },
      { name: "Pengaturan Akun", path: "/change-password", icon: SettingsIcon, roles: ["musrif"], group: "Akun Saya" }
    ];
  }

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const capitalizeRole = (role: string | undefined | null) => {
    if (!role) return "";
    return role.split(" ").map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : "").join(" ");
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50 font-sans transition-colors duration-200 font-sans">
      
      {/* Sidebar for Desktop */}
      <motion.aside
        animate={{ width: isSidebarCollapsed ? "80px" : "260px" }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex flex-col h-full bg-slate-900 border-r border-slate-800 z-20 flex-shrink-0"
      >
        {/* Brand / Logo */}
        <div className="flex items-center h-16 px-5 border-b border-slate-800 justify-between">
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/30">
              <School className="h-5 w-5" />
            </div>
            {!isSidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col leading-none"
              >
                <span className="font-bold tracking-tight text-sm text-white">SMP ALKARIM</span>
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">RASYID</span>
              </motion.div>
            )}
          </Link>
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Main Menu</div>
          {allowedMenuItems.map((item, index) => {
            const isActive = location.pathname === item.path || 
              (item.path.includes("?") && location.pathname + location.search === item.path) ||
              (item.path.includes("?") && location.pathname === item.path.split("?")[0] && location.search === "" && item.path.includes("tab=dashboard"));
            const Icon = item.icon;
            const showGroupHeader = item.group && (index === 0 || (allowedMenuItems[index - 1] as any).group !== item.group);
            
            return (
              <React.Fragment key={item.path}>
                {showGroupHeader && (
                  <div className="px-3 mt-4 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {!isSidebarCollapsed && (item as any).group}
                  </div>
                )}
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    isActive
                      ? "bg-white/10 text-white border-l-4 border-blue-500"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 transition-colors ${
                    isActive ? "text-blue-500" : "text-slate-400 group-hover:text-white"
                  }`} />
                  {!isSidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="truncate"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </Link>
              </React.Fragment>
            );
          })}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2 bg-slate-950/25">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center text-slate-400 flex-shrink-0">
              <UserIcon className="h-4 w-4" />
            </div>
            {!isSidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="flex flex-col truncate leading-tight"
              >
                <span className="font-semibold text-xs text-white truncate">{user.displayName}</span>
                <span className="text-[10px] text-slate-500 font-medium capitalize mt-0.5">{capitalizeRole(user.role)}</span>
              </motion.div>
            )}
          </div>

          {!isSidebarCollapsed ? (
            <button
              onClick={handleLogout}
              className="mt-2 flex items-center justify-center gap-2 w-full px-3 py-2 border border-rose-900/50 hover:border-rose-800 text-rose-400 hover:bg-rose-950/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar Sesi
            </button>
          ) : (
            <button
              onClick={handleLogout}
              title="Keluar Sesi"
              className="mt-2 p-2 mx-auto rounded-xl border border-rose-900/50 hover:border-rose-800 text-rose-400 hover:bg-rose-950/20 transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.aside>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-72 bg-slate-900 h-full flex flex-col p-4 shadow-2xl border-r border-slate-800"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/30">
                    <School className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col leading-none">
                    <span className="font-bold tracking-tight text-sm text-white">SMP ALKARIM</span>
                    <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">RASYID</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1">
                <div className="px-3 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Main Menu</div>
                {allowedMenuItems.map((item, index) => {
                  const isActive = location.pathname === item.path || 
                    (item.path.includes("?") && location.pathname + location.search === item.path) ||
                    (item.path.includes("?") && location.pathname === item.path.split("?")[0] && location.search === "" && item.path.includes("tab=dashboard"));
                  const Icon = item.icon;
                  const showGroupHeader = item.group && (index === 0 || (allowedMenuItems[index - 1] as any).group !== item.group);
                  
                  return (
                    <React.Fragment key={item.path}>
                      {showGroupHeader && (
                        <div className="px-3 mt-4 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          {(item as any).group}
                        </div>
                      )}
                      <Link
                        to={item.path}
                        onClick={() => setIsMobileSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? "bg-white/10 text-white border-l-4 border-blue-500"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isActive ? "text-blue-500" : "text-slate-400"}`} />
                        <span>{item.name}</span>
                      </Link>
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="mt-auto border-t border-slate-800 pt-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col truncate leading-tight">
                    <span className="font-semibold text-xs text-white truncate">{user.displayName}</span>
                    <span className="text-[10px] text-slate-400 capitalize mt-0.5">{capitalizeRole(user.role)}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-rose-900/50 text-rose-400 hover:bg-rose-950/20 rounded-xl text-xs font-semibold transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  Keluar Sesi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Topbar */}
        <header className="h-16 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 z-10 shadow-xs shrink-0">
          
          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:gap-0">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* Welcome banner / title */}
            <div className="flex items-center gap-2">
              {activeYear ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-150 dark:border-amber-900/50 rounded-lg text-xs font-semibold text-amber-800 dark:text-amber-300 shadow-xs">
                  <BellRing className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Aktif: TP {activeYear.year} ({activeYear.semester})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-lg text-xs font-semibold text-rose-800 dark:text-rose-300">
                  <span>Peringatan: Tahun Ajaran Aktif Belum Diatur</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Profile / Dark mode / Preferences */}
          <div className="flex items-center gap-3">
            
            {/* Role Switcher Selector for Multi-Role Users */}
            {userRoles.length > 1 && (
              <div className="relative flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-900 border border-slate-250 dark:border-zinc-800 rounded-xl px-2.5 py-1 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden lg:inline">Beralih Peran:</span>
                <select
                  value={user.role}
                  onChange={(e) => switchRole(e.target.value)}
                  className="text-xs font-bold bg-transparent border-0 py-0.5 pl-1 pr-7 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-hidden cursor-pointer capitalize"
                >
                  {userRoles.map((r) => (
                    <option key={r} value={r} className="text-slate-900 dark:text-zinc-50 capitalize">
                      {capitalizeRole(r)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Toggle Theme */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-all cursor-pointer"
              title={theme === "light" ? "Ganti ke Mode Gelap" : "Ganti ke Mode Terang"}
            >
              {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
            </button>

            {/* Profile pill */}
            <Link 
              to="/profile"
              className="flex items-center gap-2 border border-slate-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 shadow-xs hover:bg-slate-100 dark:hover:bg-zinc-850 transition-all cursor-pointer"
              title="Lihat Profil Saya"
            >
              <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-zinc-800 flex items-center justify-center text-blue-600 dark:text-zinc-300 text-xs font-bold">
                {(user.displayName || user.name || user.email || "U").charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 hidden sm:inline leading-none">
                  {user.displayName || user.name || user.email.split("@")[0]}
                </span>
                <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tight hidden sm:inline leading-none mt-1">
                  {capitalizeRole(user.role)}
                </span>
              </div>
            </Link>

          </div>
        </header>

        {/* Scrollable Page Outlet with smooth page transitions */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:p-6 md:p-8 bg-slate-50/50 dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>

        {/* Status Bar Footer */}
        <footer className="h-8 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Firebase Connected: Cloud Firestore (Stable)</span>
            </div>
            <div className="h-3 w-[1px] bg-slate-200 dark:bg-zinc-800"></div>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium uppercase tracking-tight">SMP ALKARIM RASYID v1.0.4-LATEST</span>
          </div>
          <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic font-medium hidden sm:block">Sistem dibangun dengan Clean Architecture & TypeScript</div>
        </footer>
      </div>

    </div>
  );
};

export default MainLayout;
