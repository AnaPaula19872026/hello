import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type StatCardProps = {
  title: string;
  value: string | number;
  icon?: ReactNode;
  alert?: boolean;
  helper?: string;
};

export function StatCard({ title, value, icon, alert, helper }: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 shadow-soft',
        alert
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{title}</p>
        <span className={cn('text-slate-400', alert && 'text-red-500')}>{icon}</span>
      </div>
      <strong className="mt-2 block text-3xl font-black">{value}</strong>
      {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
    </div>
  );
}
