import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DesktopSidebar, MobileSidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/ui/TopBar';
import { LoginPage } from '../features/auth/LoginPage';
import { QuickAttendancePage } from '../features/attendance/QuickAttendancePage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ImportsPage, PlaceholderPage, ReportsPage } from '../pages/SimplePages';
import { SelectClassPage, SelectLessonPage, SelectSchoolPage } from '../pages/SelectionPages';

const qc = new QueryClient();

function Shell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <DesktopSidebar />
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-72">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/escolas" element={<SelectSchoolPage />} />
          <Route path="/turmas" element={<SelectClassPage />} />
          <Route path="/aulas" element={<SelectLessonPage />} />
          <Route path="/chamada" element={<QuickAttendancePage />} />
          <Route path="/calendarios" element={<PlaceholderPage type="calendars" />} />
          <Route path="/planejamento-semanal" element={<PlaceholderPage type="weeklyPlanning" />} />
          <Route path="/historico" element={<PlaceholderPage type="history" />} />
          <Route path="/alunos" element={<PlaceholderPage type="students" />} />
          <Route path="/cadastros/escolas" element={<PlaceholderPage type="schoolRegistry" />} />
          <Route path="/cadastros/turmas" element={<PlaceholderPage type="classRegistry" />} />
          <Route path="/importacao" element={<ImportsPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/estatisticas-aluno" element={<PlaceholderPage type="studentStats" />} />
          <Route path="/estatisticas-turma" element={<PlaceholderPage type="classStats" />} />
          <Route path="/alertas" element={<PlaceholderPage type="alerts" />} />
          <Route path="/configuracoes" element={<PlaceholderPage type="settings" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
