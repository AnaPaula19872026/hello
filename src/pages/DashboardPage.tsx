import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, Building2, ChevronDown, ClipboardCheck, GraduationCap, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Card, PageHeader } from '../components/ui';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import { dashboardCounts, deleteAttendanceSession, listClasses, listRecentSessions, type RecentSession } from '../lib/queries';
import { HqDashboard } from './HqDashboard';

export function DashboardPage() {
  const qc = useQueryClient();
  const { user, isHq, isSuperadmin } = useAuth();
  const firstName = (user?.user_metadata?.full_name || user?.email || 'Bem-vinda').split(' ')[0];

  const { data: counts } = useQuery({ queryKey: ['counts'], queryFn: dashboardCounts });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: recent = [] } = useQuery({ queryKey: ['recent-sessions'], queryFn: () => listRecentSessions(60) });

  const [open, setOpen] = useState<string | null>(null);
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? 'Turma';

  const delSession = useMutation({
    mutationFn: deleteAttendanceSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recent-sessions'] });
      successToast('Chamada excluída com sucesso');
    },
  });

  // Agrupa as chamadas por turma.
  const groups = useMemo(() => {
    const map = new Map<string, RecentSession[]>();
    recent.forEach((s) => {
      const arr = map.get(s.class_id) ?? [];
      arr.push(s);
      map.set(s.class_id, arr);
    });
    return [...map.entries()];
  }, [recent]);

  // Na HQ (Administração Geral), o Início é o painel de gestão dos clientes.
  if (isHq && isSuperadmin) return <HqDashboard />;

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

      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Chamadas por turma</h2>
      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Nenhuma chamada registrada ainda.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {groups.map(([classId, sessions]) => {
            const isOpen = open === classId;
            const faltas = sessions.reduce((a, s) => a + s.absent, 0);
            return (
              <Card key={classId} className="overflow-hidden p-0">
                <button onClick={() => setOpen(isOpen ? null : classId)} className="flex w-full items-center gap-3 p-4 text-left">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                    <GraduationCap size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-slate-900">{className(classId)}</p>
                    <p className="text-xs text-slate-500">
                      {sessions.length} chamada(s) · {faltas} falta(s)
                    </p>
                  </div>
                  <ChevronDown size={20} className={cn('shrink-0 text-slate-400 transition', isOpen && 'rotate-180')} />
                </button>

                {isOpen ? (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <p className="flex-1 text-sm font-bold text-slate-700">
                          {format(parseISO(s.session_date), "EEE, d 'de' MMM", { locale: ptBR })}
                        </p>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{s.present} pres.</span>
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{s.absent} falt.</span>
                        <button
                          onClick={() => confirm(`Excluir a chamada de ${format(parseISO(s.session_date), 'dd/MM/yyyy')}?`) && delSession.mutate(s.id)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          aria-label="Excluir chamada"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <Link
                      to="/relatorios"
                      state={{ classId }}
                      className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
                    >
                      <BarChart3 size={16} /> Analisar esta turma →
                    </Link>
                  </div>
                ) : null}
              </Card>
            );
          })}
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
