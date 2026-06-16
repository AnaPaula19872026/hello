import { Dialog, DialogPanel, DialogTitle, Menu, MenuButton, MenuItem, MenuItems, Transition, TransitionChild } from '@headlessui/react';
import { ArrowLeft, Check, CheckSquare, MoreVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Fragment, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '../lib/cn';

/* --------------------------------- Botões -------------------------------------- */
type Variant = 'primary' | 'ghost' | 'danger' | 'soft';
const variants: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[.98]',
  soft: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  ghost: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100',
};

export function Button({
  variant = 'primary',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* --------------------------------- Campos -------------------------------------- */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* -------------------------------- Cabeçalho ------------------------------------ */
export function PageHeader({
  title,
  subtitle,
  action,
  back = true,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  back?: boolean;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const showBack = back && pathname !== '/'; // no Início não mostra voltar

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {showBack ? (
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Voltar"
            title="Voltar"
          >
            <ArrowLeft size={20} />
          </button>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------- Controle segmentado (abas/filtros) ----------------- */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex flex-wrap rounded-xl bg-slate-100 p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition',
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button onClick={onClick}>
      <Plus size={18} /> {label}
    </Button>
  );
}

/* ---------------------------------- Cartões ------------------------------------ */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white p-5 shadow-soft', className)}>{children}</div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">{icon}</div>
      <h3 className="text-lg font-black text-slate-800">{title}</h3>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

/* -------------------------- Seleção múltipla (modo) ---------------------------- */

/** Botão de cabeçalho que entra/sai do modo de seleção. */
export function SelectModeButton({ active, onEnable, onCancel }: { active: boolean; onEnable: () => void; onCancel: () => void }) {
  return active ? (
    <Button variant="ghost" onClick={onCancel}>
      <X size={18} /> Cancelar
    </Button>
  ) : (
    <Button variant="ghost" onClick={onEnable}>
      <CheckSquare size={18} /> Selecionar
    </Button>
  );
}

/** Barra flutuante de ações da seleção (só aparece no modo de seleção). */
export function SelectionBar({
  active,
  count,
  allSelected,
  onToggleAll,
  onDelete,
  onCancel,
  busy,
}: {
  active: boolean;
  count: number;
  allSelected: boolean;
  onToggleAll: () => void;
  onDelete: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  if (!active) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_30px_rgba(15,23,42,.10)] backdrop-blur lg:pl-72">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-1">
        <button onClick={onToggleAll} className="flex shrink-0 items-center gap-2 text-sm font-bold text-slate-600">
          <span className={cn('grid h-5 w-5 place-items-center rounded border', allSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300')}>
            {allSelected ? <Check size={14} /> : null}
          </span>
          Todos
        </button>
        <span className="text-sm font-black text-slate-800">{count} selecionado(s)</span>
        <button onClick={onCancel} className="ml-auto hidden text-sm font-bold text-slate-500 hover:text-slate-900 sm:block">
          Cancelar
        </button>
        <Button variant="danger" className="ml-auto sm:ml-0" onClick={onDelete} disabled={!count || busy}>
          <Trash2 size={16} /> {busy ? 'Excluindo…' : count ? `Excluir (${count})` : 'Excluir'}
        </Button>
      </div>
    </div>
  );
}

/** Checkbox quadrado padronizado para seleção em listas. */
export function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
    />
  );
}

/* --------------------------- Menu de ações da linha ---------------------------- */
export function ActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
        aria-label="Ações"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreVertical size={18} />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        className="z-50 w-44 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-soft focus:outline-none"
      >
        <MenuItem>
          <button
            onClick={onEdit}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 font-bold text-slate-700 data-[focus]:bg-slate-100"
          >
            <Pencil size={16} /> Editar
          </button>
        </MenuItem>
        <MenuItem>
          <button
            onClick={onDelete}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 font-bold text-red-600 data-[focus]:bg-red-50"
          >
            <Trash2 size={16} /> Excluir
          </button>
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}

/* ---------------------------------- Modal -------------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'lg' | 'xl';
}) {
  const maxW = size === 'xl' ? 'max-w-3xl' : 'max-w-lg';
  return (
    <Transition show={open} as={Fragment}>
      <Dialog className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm" />
        </TransitionChild>
        <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-y-full opacity-0 sm:translate-y-4"
            enterTo="translate-y-0 opacity-100"
            leave="ease-in duration-150"
            leaveFrom="translate-y-0 opacity-100"
            leaveTo="translate-y-full opacity-0 sm:translate-y-4"
          >
            <DialogPanel className={cn('flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white shadow-soft sm:rounded-3xl', maxW)}>
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <DialogTitle className="text-lg font-black text-slate-900">{title}</DialogTitle>
                <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto p-5">{children}</div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
