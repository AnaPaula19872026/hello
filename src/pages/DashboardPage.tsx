import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, ClipboardCheck, GraduationCap, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Card, PageHeader } from '../components/ui';
import { dashboardCounts, listClasses, listRecentSessions, type RecentSession } from '../lib/queries';

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = (user?.user_metadata?.full_name || user?.email || 'Bem-vinda').split(' ')[0];

  const { data: counts } = useQuery({ queryKey: ['counts'], queryFn: dashboardCounts });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: recent = [] } = useQuery({ queryKey: ['recent-sessions'], queryFn: () => listRecentSessions(40) });

  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? 'Turma';

  // Agrupa as chamadas por turma (mais organizadas).
  const groups = useMemo(() => {
    const map = new Map<string, RecentSession[]>();
    recent.forEach((s) => {
      const arr = map.get(s.class_id) ?? [];
      arr.push(s);
      map.set(s.class_id, arr);
    });
    return [...map.entries()];
  }, [recent]);

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

      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Chamadas recentes por turma</h2>
      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Nenhuma chamada registrada ainda.</p>
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map(([classId, sessions]) => (
            <div key={classId}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <GraduationCap size={16} className="text-emerald-600" />
                <h3 className="text-sm font-black text-slate-800">{className(classId)}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{sessions.length}</span>
              </div>
              <div className="space-y-2">
                {sessions.map((s) => (
                  <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
                    <p className="text-sm font-bold text-slate-700">
                      {format(parseISO(s.session_date), "EEE, d 'de' MMM", { locale: ptBR })}
                    </p>
                    <div className="flex gap-2 text-xs font-bold">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{s.present} pres.</span>
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{s.absent} falt.</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
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
