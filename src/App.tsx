import React, { lazy, Suspense, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Firebase Config Check
import { isFirebaseConfigured } from "./firebase/config";

// Context Providers
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { PwaProvider } from "./contexts/PwaContext";
import { SchoolIdentityProvider, useSchoolIdentity } from "./contexts/SchoolIdentityContext";

// Config
import { APP_CONFIG } from "./config/appConfig";

// Components & Fallbacks
import ErrorBoundary from "./components/ErrorBoundary";
import { FirebaseConfigWarning } from "./components/FirebaseConfigWarning";
import { PageLoading } from "./components/PageLoading";
import { SplashScreen } from "./components/SplashScreen";

// Layout
import MainLayout from "./layout/MainLayout";
import { lazyRetry } from "./utils/lazyRetry";

// Lazy Loaded Pages with Auto Retry
const Login = lazyRetry(() => import("./pages/Login"), "Login");
const ChangePassword = lazyRetry(() => import("./pages/ChangePassword"), "ChangePassword");
const Dashboard = lazyRetry(() => import("./pages/Dashboard"), "Dashboard");
const AcademicYears = lazyRetry(() => import("./pages/AcademicYears"), "AcademicYears");
const Subjects = lazyRetry(() => import("./pages/Subjects"), "Subjects");
const Classes = lazyRetry(() => import("./pages/Classes"), "Classes");
const Teachers = lazyRetry(() => import("./pages/Teachers"), "Teachers");
const Students = lazyRetry(() => import("./pages/Students"), "Students");
const CurriculumMatrixPage = lazyRetry(() => import("./pages/CurriculumMatrix"), "CurriculumMatrix");
const Semesters = lazyRetry(() => import("./pages/Semesters"), "Semesters");
const Users = lazyRetry(() => import("./pages/Users"), "Users");
const Settings = lazyRetry(() => import("./pages/Settings"), "Settings");
const Profile = lazyRetry(() => import("./pages/Profile"), "Profile");
const SchoolAgendas = lazyRetry(() => import("./pages/SchoolAgendas"), "SchoolAgendas");
const LessonPeriods = lazyRetry(() => import("./pages/LessonPeriods"), "LessonPeriods");
const Schedules = lazyRetry(() => import("./pages/Schedules"), "Schedules");
const AcademicCalendar = lazyRetry(() => import("./pages/AcademicCalendar"), "AcademicCalendar");
const AnnualActivityTimeline = lazyRetry(() => import("./pages/AnnualActivityTimeline"), "AnnualActivityTimeline");
const EffectiveWeeks = lazyRetry(() => import("./pages/EffectiveWeeks"), "EffectiveWeeks");
const EffectiveDays = lazyRetry(() => import("./pages/EffectiveDays"), "EffectiveDays");
const EffectiveJp = lazyRetry(() => import("./pages/EffectiveJp"), "EffectiveJp");
const AcademicReferences = lazyRetry(() => import("./pages/AcademicReferences"), "AcademicReferences");
const AnnualProgram = lazyRetry(() => import("./pages/AnnualProgram"), "AnnualProgram");
const SemesterProgram = lazyRetry(() => import("./pages/SemesterProgram"), "SemesterProgram");
const LessonPlans = lazyRetry(() => import("./pages/LessonPlans"), "LessonPlans");
const TeachingJournals = lazyRetry(() => import("./pages/TeachingJournals"), "TeachingJournals");
const MySchedule = lazyRetry(() => import("./pages/MySchedule"), "MySchedule");
const MusrifJournals = lazyRetry(() => import("./pages/MusrifJournals"), "MusrifJournals");
const MutabaahHarian = lazyRetry(() => import("./pages/MutabaahHarian"), "MutabaahHarian");
const SdmPerformance = lazyRetry(() => import("./pages/SdmPerformance"), "SdmPerformance");
const GtkDevelopment = lazyRetry(() => import("./pages/GtkDevelopment"), "GtkDevelopment");
const SupervisionAcademic = lazyRetry(() => import("./pages/SupervisionAcademic"), "SupervisionAcademic");
const SupervisionManagerial = lazyRetry(() => import("./pages/SupervisionManagerial"), "SupervisionManagerial");
const SupervisionSchedules = lazyRetry(() => import("./pages/SupervisionSchedules"), "SupervisionSchedules");
const SupervisionInstruments = lazyRetry(() => import("./pages/SupervisionInstruments"), "SupervisionInstruments");
const InventarisMasukSantri = lazyRetry(() => import("./pages/InventarisMasukSantri"), "InventarisMasukSantri");
const TeacherTeachingAttendancePage = lazyRetry(() => import("./pages/TeacherTeachingAttendance"), "TeacherTeachingAttendance");
const TeachingQrCheckInPage = lazyRetry(() => import("./pages/TeachingQrCheckIn"), "TeachingQrCheckIn");
const TeachingQrSimulationPage = lazyRetry(() => import("./pages/TeachingQrSimulation"), "TeachingQrSimulation");
const StudentAttendancePage = lazyRetry(() => import("./pages/StudentAttendance"), "StudentAttendance");
const TeacherDisciplinePage = lazyRetry(() => import("./pages/TeacherDiscipline"), "TeacherDiscipline");
const ExecutiveMutabaahGuruPage = lazyRetry(() => import("./pages/ExecutiveMutabaahGuruPage"), "ExecutiveMutabaahGuruPage");
const ERaporTeacherInput = lazyRetry(() => import("./pages/ERaporTeacherInput"), "ERaporTeacherInput");
const ERaporHomeroomView = lazyRetry(() => import("./pages/ERaporHomeroomView"), "ERaporHomeroomView");
const ERaporStudentBiodataPage = lazyRetry(() => import("./pages/ERaporStudentBiodataPage"), "ERaporStudentBiodataPage");
const ERaporLegerPage = lazyRetry(() => import("./pages/ERaporLegerPage"), "ERaporLegerPage");
const ERaporExecutiveDashboard = lazyRetry(() => import("./pages/ERaporExecutiveDashboard"), "ERaporExecutiveDashboard");
const ERaporSettingsPage = lazyRetry(() => import("./pages/ERaporSettingsPage"), "ERaporSettingsPage");
const AboutApp = lazyRetry(() => import("./pages/AboutApp"), "AboutApp");
const OfflinePage = lazyRetry(() => import("./pages/OfflinePage"), "OfflinePage");
const NotFound = lazyRetry(() => import("./pages/NotFound"), "NotFound");

// Inner component to dynamically update Document Title based on SSOT identity
function AppTitleUpdater() {
  const { identity } = useSchoolIdentity();
  useEffect(() => {
    document.title = `${identity.name} – ${identity.fullName} ${identity.schoolName}`;
  }, [identity]);
  return null;
}

// Create TanStack Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    return !sessionStorage.getItem("simak_splash_shown");
  });

  const handleSplashFinish = () => {
    sessionStorage.setItem("simak_splash_shown", "true");
    setShowSplash(false);
  };

  if (!isFirebaseConfigured) {
    return <FirebaseConfigWarning />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <SchoolIdentityProvider>
              <AppTitleUpdater />
              <PwaProvider>
                {showSplash && <SplashScreen onFinish={handleSplashFinish} durationMs={1800} />}
                <AuthProvider>
                  <BrowserRouter>
                    <Suspense fallback={<PageLoading />}>
                      <Routes>
                        {/* Public Authentication routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Navigate to="/login" replace />} />
                        <Route path="/change-password" element={<ChangePassword />} />
                        <Route path="/offline" element={<OfflinePage />} />

                      {/* Protected School Master Data routes */}
                      <Route path="/" element={<MainLayout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="profile" element={<Profile />} />
                        <Route path="about" element={<AboutApp />} />
                        <Route path="academic-years" element={<AcademicYears />} />
                        <Route path="semesters" element={<Semesters />} />
                        <Route path="subjects" element={<Subjects />} />
                        <Route path="classes" element={<Classes />} />
                        <Route path="teachers" element={<Teachers />} />
                        <Route path="students" element={<Students />} />
                        <Route path="users" element={<Users />} />
                        <Route path="lesson-periods" element={<LessonPeriods />} />
                        <Route path="schedules" element={<Schedules />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="settings/agendas" element={<SchoolAgendas />} />
                        <Route path="curriculum-matrix" element={<CurriculumMatrixPage />} />
                        
                        {/* Academic Planning Engine Foundation Routes */}
                        <Route path="academic-calendar" element={<AcademicCalendar />} />
                        <Route path="annual-activity-timeline" element={<AnnualActivityTimeline />} />
                        <Route path="effective-weeks" element={<EffectiveWeeks />} />
                        <Route path="effective-days" element={<EffectiveDays />} />
                        <Route path="effective-jp" element={<EffectiveJp />} />
                        <Route path="academic-references" element={<AcademicReferences />} />

                        {/* Perencanaan Pembelajaran */}
                        <Route path="annual-programs" element={<AnnualProgram />} />
                        <Route path="semester-programs" element={<SemesterProgram />} />
                        <Route path="lesson-plans" element={<LessonPlans />} />
                        <Route path="teaching-journals" element={<TeachingJournals />} />
                        <Route path="my-schedule" element={<MySchedule />} />
                        <Route path="musrif-journals" element={<MusrifJournals />} />
                        <Route path="mutabaah-harian" element={<MutabaahHarian />} />
                        <Route path="sdm-performance" element={<SdmPerformance />} />
                        <Route path="gtk-development" element={<GtkDevelopment />} />

                        {/* Supervisi Akademik & Manajerial */}
                        <Route path="supervision-academic" element={<SupervisionAcademic />} />
                        <Route path="supervision-managerial" element={<SupervisionManagerial />} />
                        <Route path="supervision-instruments" element={<SupervisionInstruments />} />

                        {/* Inventaris Masuk Santri */}
                        <Route path="inventaris-santri" element={<InventarisMasukSantri />} />

                        {/* Monitoring Pembelajaran - Absensi Mengajar Guru & Siswa */}
                        <Route path="teacher-teaching-attendance" element={<TeacherTeachingAttendancePage />} />
                        <Route path="teaching-qr-checkin" element={<TeachingQrCheckInPage />} />
                        <Route path="teaching-qr-simulation" element={<TeachingQrSimulationPage />} />
                        <Route path="student-attendance" element={<StudentAttendancePage />} />
                        <Route path="teacher-discipline" element={<TeacherDisciplinePage />} />
                        <Route path="executive-mutabaah-guru" element={<ExecutiveMutabaahGuruPage />} />

                        {/* Modul e-Rapor Kurikulum Merdeka */}
                        <Route path="e-rapor/input" element={<ERaporTeacherInput />} />
                        <Route path="e-rapor/student-biodata" element={<ERaporStudentBiodataPage />} />
                        <Route path="e-rapor/wali-kelas" element={<ERaporHomeroomView />} />
                        <Route path="e-rapor/leger" element={<ERaporLegerPage />} />
                        <Route path="e-rapor/dashboard" element={<ERaporExecutiveDashboard />} />
                        <Route path="e-rapor/settings" element={<ERaporSettingsPage />} />
                      </Route>

                      {/* 404 Catch All Route */}
                      <Route path="/404" element={<NotFound />} />
                      <Route path="*" element={<Navigate to="/404" replace />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </AuthProvider>
            </PwaProvider>
            </SchoolIdentityProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
