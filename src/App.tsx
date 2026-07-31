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

// Lazy Loaded Pages
const Login = lazy(() => import("./pages/Login"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AcademicYears = lazy(() => import("./pages/AcademicYears"));
const Subjects = lazy(() => import("./pages/Subjects"));
const Classes = lazy(() => import("./pages/Classes"));
const Teachers = lazy(() => import("./pages/Teachers"));
const Students = lazy(() => import("./pages/Students"));
const CurriculumMatrixPage = lazy(() => import("./pages/CurriculumMatrix"));
const Semesters = lazy(() => import("./pages/Semesters"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const SchoolAgendas = lazy(() => import("./pages/SchoolAgendas"));
const LessonPeriods = lazy(() => import("./pages/LessonPeriods"));
const Schedules = lazy(() => import("./pages/Schedules"));
const AcademicCalendar = lazy(() => import("./pages/AcademicCalendar"));
const AnnualActivityTimeline = lazy(() => import("./pages/AnnualActivityTimeline"));
const EffectiveWeeks = lazy(() => import("./pages/EffectiveWeeks"));
const EffectiveDays = lazy(() => import("./pages/EffectiveDays"));
const EffectiveJp = lazy(() => import("./pages/EffectiveJp"));
const AcademicReferences = lazy(() => import("./pages/AcademicReferences"));
const AnnualProgram = lazy(() => import("./pages/AnnualProgram"));
const SemesterProgram = lazy(() => import("./pages/SemesterProgram"));
const LessonPlans = lazy(() => import("./pages/LessonPlans").then(m => ({ default: m.LessonPlans })));
const TeachingJournals = lazy(() => import("./pages/TeachingJournals"));
const MySchedule = lazy(() => import("./pages/MySchedule").then(m => ({ default: m.MySchedule })));
const MusrifJournals = lazy(() => import("./pages/MusrifJournals"));
const MutabaahHarian = lazy(() => import("./pages/MutabaahHarian").then(m => ({ default: m.MutabaahHarian })));
const SdmPerformance = lazy(() => import("./pages/SdmPerformance"));
const GtkDevelopment = lazy(() => import("./pages/GtkDevelopment"));
const SupervisionAcademic = lazy(() => import("./pages/SupervisionAcademic"));
const SupervisionManagerial = lazy(() => import("./pages/SupervisionManagerial"));
const SupervisionSchedules = lazy(() => import("./pages/SupervisionSchedules"));
const SupervisionInstruments = lazy(() => import("./pages/SupervisionInstruments"));
const InventarisMasukSantri = lazy(() => import("./pages/InventarisMasukSantri"));
const TeacherTeachingAttendancePage = lazy(() => import("./pages/TeacherTeachingAttendance"));
const TeachingQrCheckInPage = lazy(() => import("./pages/TeachingQrCheckIn").then(m => ({ default: m.TeachingQrCheckInPage })));
const AboutApp = lazy(() => import("./pages/AboutApp"));
const OfflinePage = lazy(() => import("./pages/OfflinePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

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

                        {/* Monitoring Pembelajaran - Absensi Mengajar Guru */}
                        <Route path="teacher-teaching-attendance" element={<TeacherTeachingAttendancePage />} />
                        <Route path="teaching-qr-checkin" element={<TeachingQrCheckInPage />} />
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
