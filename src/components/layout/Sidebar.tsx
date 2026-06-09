import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react';
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Settings,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/cn';

type NavItem = {
  label: string;
  to: string;
  icon: ReactNode;
};

const primaryNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Nova chamada', to: '/escolas', icon: <UserPlus size={18} /> },
  { label: 'Calendários', to: '/calendarios', icon: <CalendarDays size={18} /> },
  { label: 'Planejamento semanal', to: '/planejamento-semanal', icon: <BarChart3 size={18} /> },
  { label: 'Histórico', to: '/historico', icon: <History size={18} /> },
  { label: 'Relatórios', to: '/relatorios', icon: <FileText size={18} /> },
];

const registryNav: NavItem[] = [
  { label: 'Cadastro de escolas', to: '/cadastros/escolas', icon: <Building2 size={18} /> },
  { label: 'Cadastro de turmas', to: '/cadastros/turmas', icon: <GraduationCap size={18} /> },
  { label: 'Cadastro de alunos', to: '/cadastros/alunos', icon: <Users size={18} /> },
  { label: 'Disciplinas', to: '/cadastros/disciplinas', icon: <FileText size={18} /> },
  { label: 'Importação', to: '/importacao', icon: <FileSpreadsheet size={18} /> },
];

const supportNav: NavItem[] = [
  { label: 'Alertas', to: '/alertas', icon: <AlertTriangle size={18} /> },
  { label: 'Configurações', to: '/configuracoes', icon: <Settings size={18} /> },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <p className="text-xs font-bold uppercase text-emerald-300">hello</p>
        <h2 className="mt-1 text-lg font-black">Gestão escolar</h2>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <NavGroup items={primaryNav} onNavigate={onNavigate} />
        <NavGroup title="Cadastros" items={registryNav} onNavigate={onNavigate} />
        <NavGroup title="Operação" items={supportNav} onNavigate={onNavigate} />
      </nav>
      <div className="border-t border-white/10 p-4 text-xs font-semibold text-slate-400">
        React, Supabase, PDF, Excel, CSV e DOCX prontos para evoluir.
      </div>
    </div>
  );
}

function NavGroup({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="mb-5">
      {title ? <p className="mb-2 px-3 text-xs font-bold uppercase text-slate-500">{title}</p> : null}
      <div className="space-y-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition',
                isActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 lg:block">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Transition show={open} as={Fragment}>
      <Dialog className="relative z-50 lg:hidden" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/50" />
        </TransitionChild>
        <div className="fixed inset-0 flex">
          <TransitionChild
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition ease-in duration-150"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <DialogPanel className="relative w-80 max-w-[86vw]">
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white"
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
              <SidebarContent onNavigate={onClose} />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
