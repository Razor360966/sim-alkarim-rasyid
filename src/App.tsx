import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Firebase Config Check
import { isFirebaseConfigured } from "./firebase/config";

// Context Providers
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";

// Components
import ErrorBoundary from "./components/ErrorBoundary";
import { FirebaseConfigWarning } from "./components/FirebaseConfigWarning";

// Layout & Pages
import MainLayout from "./layout/MainLayout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import Dashboard from "./pages/Dashboard";
import AcademicYears from "./pages/AcademicYears";
import Subjects from "./pages/Subjects";
import Classes from "./pages/Classes";
import Teachers from "./pages/Teachers";
import Students from "./pages/Students";
import CurriculumMatrixPage from "./pages/CurriculumMatrix";
import Semesters from "./pages/Semesters";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import SchoolAgendas from "./pages/SchoolAgendas";
import LessonPeriods from "./pages/LessonPeriods";
import Schedules from "./pages/Schedules";
import AcademicCalendar from "./pages/AcademicCalendar";
import AnnualActivityTimeline from "./pages/AnnualActivityTimeline";
import EffectiveWeeks from "./pages/EffectiveWeeks";
import EffectiveDays from "./pages/EffectiveDays";
import EffectiveJp from "./pages/EffectiveJp";
import AcademicReferences from "./pages/AcademicReferences";
import AnnualProgram from "./pages/AnnualProgram";
import SemesterProgram from "./pages/SemesterProgram";
import { LessonPlans } from "./pages/LessonPlans";
import TeachingJournals from "./pages/TeachingJournals";
import MusrifJournals from "./pages/MusrifJournals";
import SdmPerformance from "./pages/SdmPerformance";
import GtkDevelopment from "./pages/GtkDevelopment";
import SupervisionAcademic from "./pages/SupervisionAcademic";
import SupervisionManagerial from "./pages/SupervisionManagerial";
import SupervisionSchedules from "./pages/SupervisionSchedules";
import SupervisionInstruments from "./pages/SupervisionInstruments";
import NotFound from "./pages/NotFound";

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
  if (!isFirebaseConfigured) {
    return <FirebaseConfigWarning />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public Authentication routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/change-password" element={<ChangePassword />} />

                  {/* Protected School Master Data routes */}
                  <Route path="/" element={<MainLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="profile" element={<Profile />} />
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
                    <Route path="musrif-journals" element={<MusrifJournals />} />
                    <Route path="sdm-performance" element={<SdmPerformance />} />
                    <Route path="gtk-development" element={<GtkDevelopment />} />

                    {/* Supervisi Akademik & Manajerial */}
                    <Route path="supervision-academic" element={<SupervisionAcademic />} />
                    <Route path="supervision-managerial" element={<SupervisionManagerial />} />
                    <Route path="supervision-instruments" element={<SupervisionInstruments />} />
                  </Route>

                  {/* 404 Catch All Route */}
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </BrowserRouter>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
