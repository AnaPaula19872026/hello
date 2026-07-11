import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
  Award,
  BookOpen,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  Home,
  LogOut,
  Megaphone,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Fragment, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import { canAccessModule, type ModuleKey } from '../lib/permissions';
import { listAccessRequests, listSchools, planUnreadCounts, unreadNoticeCount, saveEvalGrades, saveTermGrades, saveAttendance } from '../lib/queries';
import { ROLE_LABEL } from '../lib/types';
import { signOut } from '../lib/supabase';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { getOfflineQueue, syncOfflineQueue, type OfflineQueueItem } from '../lib/offlineQueue';

type NavItem = { label: string; to: string; icon: ReactNode; module: ModuleKey };

const groups: { title?: string; items: NavItem[] }[] = [
  {
    items: [{ label: 'Início', to: '/', icon: <Home size={18} />, module: 'dashboard' }],
  },
  {
    title: 'Pedagógico',
    items: [
      { label: 'Chamadas', to: '/chamadas', icon: <ClipboardCheck size={18} />, module: 'chamadas' },
      { label: 'Notas', to: '/notas', icon: <Award size={18} />, module: 'notas' },
      { label: 'Central de Avaliações', to: '/avaliacoes', icon: <ClipboardList size={18} />, module: 'notas' },
      { label: 'Planejamento', to: '/planejamento', icon: <BookOpen size={18} />, module: 'planejamentos' },
      { label: 'Relatórios', to: '/relatorios', icon: <BarChart3 size={18} />, module: 'relatorios' },
    ],
  },
  {
    title: 'Comunicação',
    items: [
      { label: 'Avisos', to: '/avisos', icon: <Megaphone size={18} />, module: 'avisos' },
      { label: 'Calendário', to: '/calendario', icon: <CalendarDays size={18} />, module: 'calendario' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { label: 'Escolas', to: '/escolas', icon: <Building2 size={18} />, module: 'escolas' },
      { label: 'Turmas', to: '/turmas', icon: <GraduationCap size={18} />, module: 'turmas' },
      { label: 'Alunos', to: '/alunos', icon: <Users size={18} />, module: 'alunos' },
    ],
  },
  {
    title: 'Administração',
    items: [
      { label: 'Organizações', to: '/organizacoes', icon: <Network size={18} />, module: 'organizacoes' },
      { label: 'Permissões', to: '/permissoes', icon: <ShieldCheck size={18} />, module: 'permissoes' },
      { label: 'Configurações', to: '/configuracoes', icon: <Settings size={18} />, module: 'configuracoes' },
    ],
  },
];

function OrgSwitcher() {
  const { organizations, activeOrgId, switchOrg, isSuperadmin } = useAuth();
  // A HQ (Administração Geral) é exclusiva do superadmin — nunca aparece para os demais.
  const options = isSuperadmin ? organizations : organizations.filter((o) => o.kind !== 'hq');
  // Só mostra o seletor quando há mais de uma organização para escolher.
  if (options.length <= 1) return null;
  return (
    <div className="border-b border-border px-4 py-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Organização</p>
      <select
        value={activeOrgId ?? ''}
        onChange={(e) => switchOrg(e.target.value)}
        className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm font-bold text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="text-foreground">
            {o.name}
            {o.is_demo ? ' (demo)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, role, activeOrgId, organizations, isHq, isSuperadmin } = useAuth();
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Usuária';
  const avatar = profile?.avatar_url || (user?.user_metadata?.avatar_url as string | undefined);
  const orgName = organizations.find((o) => o.id === activeOrgId)?.name;
  const { data: unread = 0 } = useQuery({
    queryKey: ['notices-unread', user?.id],
    queryFn: () => unreadNoticeCount(user!.id),
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const { data: planUnreadMap = {} } = useQuery({
    queryKey: ['plan-unread'],
    queryFn: planUnreadCounts,
    enabled: !!user,
    refetchInterval: 30_000,
    retry: false,
  });
  const planUnread = Object.values(planUnreadMap).reduce((a, b) => a + b, 0);
  const { data: accessReqs = [] } = useQuery({
    queryKey: ['access-requests', 'pending'],
    queryFn: () => listAccessRequests('pending'),
    enabled: !!user && isSuperadmin,
    refetchInterval: 30_000,
    retry: false,
  });
  const pendingAccess = accessReqs.length;
  // "Escolas" só faz sentido para rede/secretaria (2+ escolas). Numa base de uma
  // escola só, o cadastro é redundante (a base já é a escola).
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools, enabled: !!user && !isHq });
  const multiSchool = schools.length > 1;

  const visibleGroups = groups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          canAccessModule(role, it.module, isHq) &&
          (it.module !== 'escolas' || multiSchool), // Escolas: só com 2+ escolas
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col border-r border-border bg-card text-foreground">
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-xl font-black text-white">h</div>
        <div className="min-w-0">
          <p className="text-base font-black leading-none text-foreground">hello</p>
          <p className="mt-1 truncate text-xs font-bold text-emerald-600">{orgName ?? 'Gestão escolar'}</p>
        </div>
      </div>

      <OrgSwitcher />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group, i) => (
          <div key={i} className="mb-5">
            {group.title ? (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{group.title}</p>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition',
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.to === '/avisos' && unread > 0 ? (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-black text-white">
                      {unread}
                    </span>
                  ) : null}
                  {item.to === '/planejamento' && planUnread > 0 ? (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-black text-white">
                      {planUnread > 9 ? '9+' : planUnread}
                    </span>
                  ) : null}
                  {item.to === '/organizacoes' && pendingAccess > 0 ? (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-black text-white">
                      {pendingAccess > 9 ? '9+' : pendingAccess}
                    </span>
                  ) : null}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          {avatar ? (
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-black uppercase text-white">
              {name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{role ? ROLE_LABEL[role] : user?.email}</p>
          </div>
          <button onClick={() => signOut()} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const online = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(() => getOfflineQueue().length);
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleQueueUpdate = () => setQueueCount(getOfflineQueue().length);
    window.addEventListener('offline-queue-updated', handleQueueUpdate);
    return () => window.removeEventListener('offline-queue-updated', handleQueueUpdate);
  }, []);

  useEffect(() => {
    if (!online || queueCount === 0 || syncing) return;
    let cancelled = false;
    setSyncing(true);
    syncOfflineQueue(async (item: OfflineQueueItem) => {
      if (cancelled) return false;
      if (item.type === 'grades') {
        const { classId, year, term, rows } = item.payload as { classId: string; year: number; term: number; rows: Array<Record<string, any>> };
        await saveTermGrades(classId, year, term, rows);
        return true;
      }
      if (item.type === 'attendance') {
        const { classId, date, records, examMode } = item.payload as { classId: string; date: string; records: Array<Record<string, any>>; examMode?: boolean };
        await saveAttendance(classId, date, records, { examMode });
        return true;
      }
      if (item.type === 'evaluations') {
        const { classId, year, term, rows } = item.payload as { classId: string; year: number; term: number; rows: Array<Record<string, any>> };
        await saveEvalGrades(classId, year, term, rows);
        return true;
      }
      return false;
    })
      .then((removed) => {
        if (!cancelled) {
          setSyncing(false);
          if (removed > 0) {
            successToast('Dados offline sincronizados com sucesso');
            qc.invalidateQueries();
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online, queueCount, syncing, qc]);

  useEffect(() => {
    if (!online || queueCount === 0 || syncing) return;
    let cancelled = false;
    setSyncing(true);
    syncOfflineQueue(async (item: OfflineQueueItem) => {
      if (cancelled) return false;
      if (item.type === 'grades') {
        const { classId, year, term, rows } = item.payload as { classId: string; year: number; term: number; rows: Array<Record<string, any>> };
        await saveTermGrades(classId, year, term, rows);
        return true;
      }
      if (item.type === 'attendance') {
        const { classId, date, records, examMode } = item.payload as { classId: string; date: string; records: Array<Record<string, any>>; examMode?: boolean };
        await saveAttendance(classId, date, records, { examMode });
        return true;
      }
      if (item.type === 'evaluations') {
        const { classId, year, term, rows } = item.payload as { classId: string; year: number; term: number; rows: Array<Record<string, any>> };
        await saveEvalGrades(classId, year, term, rows);
        return true;
      }
      return false;
    })
      .then((removed) => {
        if (!cancelled) {
          setSyncing(false);
          if (removed > 0) {
            successToast('Dados offline sincronizados com sucesso');
            qc.invalidateQueries();
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online, queueCount, syncing, qc]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-72 lg:block">
        <SidebarContent />
      </aside>

      <Transition show={open} as={Fragment}>
        <Dialog className="relative z-50 lg:hidden" onClose={() => setOpen(false)}>
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-950/50" />
          </TransitionChild>
          <div className="fixed inset-0 flex">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="ease-in duration-150"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <DialogPanel className="relative w-72 max-w-[84vw]">
                <button
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground hover:bg-muted"
                  aria-label="Fechar menu"
                >
                  <X size={18} />
                </button>
                <SidebarContent onNavigate={() => setOpen(false)} />
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-card/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-muted" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <span className="text-lg font-black">hello</span>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-black text-muted-foreground sm:flex">
            <span className={cn('inline-flex h-2.5 w-2.5 rounded-full', online ? 'bg-emerald-500' : 'bg-red-500')} />
            {online ? (queueCount > 0 ? `${queueCount} em fila` : 'Online') : 'Offline'}
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
