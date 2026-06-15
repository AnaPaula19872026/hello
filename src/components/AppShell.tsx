import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
  Award,
  BookOpen,
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
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
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Fragment, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { cn } from '../lib/cn';
import { canAccessModule, type ModuleKey } from '../lib/permissions';
import { listAccessRequests, listSchools, planUnreadCounts, unreadNoticeCount } from '../lib/queries';
import { ROLE_LABEL } from '../lib/types';
import { signOut } from '../lib/supabase';

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
    <div className="border-b border-white/10 px-4 py-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Organização</p>
      <select
        value={activeOrgId ?? ''}
        onChange={(e) => switchOrg(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-emerald-400"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="text-slate-900">
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
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-xl font-black">h</div>
        <div className="min-w-0">
          <p className="text-base font-black leading-none">hello</p>
          <p className="mt-1 truncate text-xs font-medium text-emerald-300">{orgName ?? 'Gestão escolar'}</p>
        </div>
      </div>

      <OrgSwitcher />

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {visibleGroups.map((group, i) => (
          <div key={i} className="mb-5">
            {group.title ? (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.title}</p>
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
                      isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white',
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

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          {avatar ? (
            <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-black uppercase">
              {name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{name}</p>
            <p className="truncate text-xs text-slate-400">{role ? ROLE_LABEL[role] : user?.email}</p>
          </div>
          <button onClick={() => signOut()} className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
                  className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white"
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <span className="text-lg font-black">hello</span>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
