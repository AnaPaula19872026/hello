import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { AppShell } from '../components/AppShell';
import { AccessRequestGate } from '../pages/AccessRequestGate';
import { FeedbackHost } from '../components/Feedback';
import { AttendancePage } from '../pages/AttendancePage';
import { AvisosPage } from '../pages/AvisosPage';
import { CalendarPage } from '../pages/CalendarPage';
import { ClassesPage } from '../pages/ClassesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { EvaluationsPage } from '../pages/EvaluationsPage';
import { LoginPage } from '../pages/LoginPage';
import { NotasPage } from '../pages/NotasPage';
import { PlanejamentoPage } from '../pages/PlanejamentoPage';
import { OrganizationsPage } from '../pages/OrganizationsPage';
import { PermissionsPage } from '../pages/PermissionsPage';
import { ReportsPage } from '../pages/ReportsPage';
import { SchoolsPage } from '../pages/SchoolsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { SharedReportPage } from '../pages/SharedReportPage';
import { StudentsPage } from '../pages/StudentsPage';
import { canAccessModule, type ModuleKey } from '../lib/permissions';

const qc = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 30_000 } },
});

function Protected() {
  const { session, loading, ctxLoading, role, isHq, memberships, isSuperadmin } = useAuth();

  if (loading || (session && ctxLoading)) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-600" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  // Autenticado mas sem vínculo: pedir acesso e aguardar liberação do admin.
  if (!isSuperadmin && memberships.length === 0) return <AccessRequestGate />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<ModuleGate module="dashboard" role={role} isHq={isHq}><DashboardPage /></ModuleGate>} />
        <Route path="/chamadas" element={<ModuleGate module="chamadas" role={role} isHq={isHq}><AttendancePage /></ModuleGate>} />
        <Route path="/notas" element={<ModuleGate module="notas" role={role} isHq={isHq}><NotasPage /></ModuleGate>} />
        <Route path="/avaliacoes" element={<ModuleGate module="notas" role={role} isHq={isHq}><EvaluationsPage /></ModuleGate>} />
        <Route path="/planejamento" element={<ModuleGate module="planejamentos" role={role} isHq={isHq}><PlanejamentoPage /></ModuleGate>} />
        <Route path="/relatorios" element={<ModuleGate module="relatorios" role={role} isHq={isHq}><ReportsPage /></ModuleGate>} />
        <Route path="/avisos" element={<ModuleGate module="avisos" role={role} isHq={isHq}><AvisosPage /></ModuleGate>} />
        <Route path="/calendario" element={<ModuleGate module="calendario" role={role} isHq={isHq}><CalendarPage /></ModuleGate>} />
        <Route path="/escolas" element={<ModuleGate module="escolas" role={role} isHq={isHq}><SchoolsPage /></ModuleGate>} />
        <Route path="/turmas" element={<ModuleGate module="turmas" role={role} isHq={isHq}><ClassesPage /></ModuleGate>} />
        <Route path="/alunos" element={<ModuleGate module="alunos" role={role} isHq={isHq}><StudentsPage /></ModuleGate>} />
        <Route path="/organizacoes" element={<ModuleGate module="organizacoes" role={role} isHq={isHq}><OrganizationsPage /></ModuleGate>} />
        <Route path="/permissoes" element={<ModuleGate module="permissoes" role={role} isHq={isHq}><PermissionsPage /></ModuleGate>} />
        <Route path="/configuracoes" element={<ModuleGate module="configuracoes" role={role} isHq={isHq}><SettingsPage /></ModuleGate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

function ModuleGate({
  module,
  role,
  isHq,
  children,
}: {
  module: ModuleKey;
  role: ReturnType<typeof useAuth>['role'];
  isHq: boolean;
  children: ReactNode;
}) {
  if (!canAccessModule(role, module, isHq)) return <Navigate to="/" replace />;
  return children;
}

function Gate() {
  const { session, loading } = useAuth();
  return (
    <Routes>
      <Route path="/r/:id" element={<SharedReportPage />} />
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
        <FeedbackHost />
      </AuthProvider>
    </QueryClientProvider>
  );
}
