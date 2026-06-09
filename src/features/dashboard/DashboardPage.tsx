import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  GraduationCap,
  Plus,
  Upload,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/ui/StatCard';

const actions = [
  { label: 'Cadastrar escola', to: '/cadastros/escolas', icon: <Building2 size={18} />, tone: 'bg-slate-950 text-white' },
  { label: 'Cadastrar turma', to: '/cadastros/turmas', icon: <GraduationCap size={18} />, tone: 'bg-white text-slate-950' },
  { label: 'Cadastrar aluno', to: '/alunos', icon: <Users size={18} />, tone: 'bg-white text-slate-950' },
  { label: 'Importar planilha', to: '/importacao', icon: <Upload size={18} />, tone: 'bg-emerald-600 text-white' },
];

const absenceRanking = [
  { name: '6o Ano B', value: 18 },
  { name: '8o Ano A', value: 15 },
  { name: '5o Ano C', value: 12 },
];

export function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
      <section className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-emerald-600">Operação escolar</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">Dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 sm:text-base">
            Visão rápida de presença, cadastros, sincronização e documentos da escola.
          </p>
        </div>
        <Link
          to="/escolas"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-soft"
        >
          <Plus size={18} />
          Nova chamada
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Escolas" value={2} icon={<Building2 size={20} />} helper="2 ativas" />
        <StatCard title="Turmas" value={18} icon={<GraduationCap size={20} />} helper="Manhã e tarde" />
        <StatCard title="Alunos" value={642} icon={<Users size={20} />} helper="Base atual" />
        <StatCard title="Chamadas hoje" value={24} icon={<CheckCircle2 size={20} />} helper="Sincronizadas" />
        <StatCard title="Presença geral" value="94%" icon={<CalendarDays size={20} />} helper="Últimos 30 dias" />
        <StatCard title="Excesso de faltas" value={17} alert icon={<AlertTriangle size={20} />} helper="Requer ação" />
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white">Ações rápidas</h3>
              <p className="text-sm font-medium text-slate-500">Cadastros e rotinas principais em um clique.</p>
            </div>
            <Link to="/relatorios" className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
              <FileText size={16} />
              Ver relatórios
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {actions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`flex min-h-20 items-center gap-3 rounded-lg border border-slate-200 p-4 text-sm font-black shadow-sm transition active:scale-[.99] ${action.tone}`}
              >
                {action.icon}
                <span>{action.label}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <h3 className="text-lg font-black text-slate-950 dark:text-white">Turmas com maior ausência</h3>
          <div className="mt-4 space-y-4">
            {absenceRanking.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex justify-between text-sm font-bold">
                  <span>{item.name}</span>
                  <span>{item.value}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-3 rounded-full bg-red-400" style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-4 grid gap-3 lg:grid-cols-3">
        <AlertCard tone="red" text="17 alunos ultrapassaram o limite configurado de faltas." />
        <AlertCard tone="amber" text="3 chamadas offline aguardam sincronização." />
        <AlertCard tone="emerald" text="Todas as turmas do turno matutino foram registradas hoje." />
      </section>
    </main>
  );
}

function AlertCard({ tone, text }: { tone: 'red' | 'amber' | 'emerald'; text: string }) {
  const toneClass = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }[tone];

  return <p className={`rounded-lg border p-4 text-sm font-bold ${toneClass}`}>{text}</p>;
}
