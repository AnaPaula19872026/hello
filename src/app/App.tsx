import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { AppShell } from '../components/AppShell';
import { AttendancePage } from '../pages/AttendancePage';
import { CalendarPage } from '../pages/CalendarPage';
import { ClassesPage } from '../pages/ClassesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { NotasPage } from '../pages/NotasPage';
import { SchoolsPage } from '../pages/SchoolsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StudentsPage } from '../pages/StudentsPage';

const qc = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
});

function Protected() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/chamadas" element={<AttendancePage />} />
        <Route path="/notas" element={<NotasPage />} />
        <Route path="/calendario" element={<CalendarPage />} />
        <Route path="/escolas" element={<SchoolsPage />} />
        <Route path="/turmas" element={<ClassesPage />} />
        <Route path="/alunos" element={<StudentsPage />} />
        <Route path="/configuracoes" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={!loading && session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*" element={<Protected />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Gate />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
