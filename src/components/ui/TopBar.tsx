import { LogOut, Menu, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type TopBarProps = {
  onMenuClick?: () => void;
};

export function TopBar({ onMenuClick }: TopBarProps) {
  const online = navigator.onLine;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:static">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase text-emerald-600">hello</p>
            <h1 className="truncate text-base font-black text-slate-950 dark:text-white sm:text-lg">
              Chamada Rápida Escolar
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`flex items-center gap-1 rounded-lg px-3 py-2 font-semibold ${
              online ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
          </span>
          <span className="hidden items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 font-semibold text-slate-600 sm:flex">
            <RefreshCw size={16} />
            Sincronizado
          </span>
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950"
            aria-label="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
