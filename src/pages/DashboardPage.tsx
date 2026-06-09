import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Card, PageHeader } from '../components/ui';
import { dashboardCounts, listClasses, listRecentSessions } from '../lib/queries';

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = (user?.user_metadata?.full_name || user?.email || 'Bem-vinda').split(' ')[0];

  const { data: counts } = useQuery({ queryKey: ['counts'], queryFn: dashboardCounts });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: recent = [] } = useQuery({ queryKey: ['recent-sessions'], queryFn: () => listRecentSessions(6) });

  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? 'Turma';

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} />

      <Link to="/chamadas" className="block">
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-soft transition hover:bg-slate-900">
          <div>
            <p className="text-sm font-bold text-emerald-300">Começar agora</p>
            <h2 className="mt-1 text-xl font-black">Fazer chamada</h2>
            <p className="mt-1 text-sm text-slate-300">Registre presenças e faltas em segundos.</p>
          </div>
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500">
            <ClipboardCheck size={26} />
          </div>
        </div>
      </Link>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard to="/escolas" icon={<Building2 size={20} />} value={counts?.schools ?? 0} label="Escolas" />
        <StatCard to="/turmas" icon={<GraduationCap size={20} />} value={counts?.classes ?? 0} label="Turmas" />
        <StatCard to="/alunos" icon={<Users size={20} />} value={counts?.students ?? 0} label="Alunos" />
      </div>

      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Chamadas recentes</h2>
      {recent.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Nenhuma chamada registrada ainda.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {recent.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-bold text-slate-900">{className(s.class_id)}</p>
                <p className="text-xs text-slate-500">{format(parseISO(s.session_date), "d 'de' MMM yyyy", { locale: ptBR })}</p>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{s.present} pres.</span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{s.absent} falt.</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function StatCard({ to, icon, value, label }: { to: string; icon: React.ReactNode; value: number; label: string }) {
  return (
    <Link to={to}>
      <Card className="p-4 text-center transition hover:border-emerald-300">
        <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs font-bold text-slate-500">{label}</p>
      </Card>
    </Link>
  );
}
