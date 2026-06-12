import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Award, BarChart3, Bell, CalendarDays, ChevronDown, ClipboardCheck, GraduationCap, Megaphone, TriangleAlert, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Card, PageHeader } from '../components/ui';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import { can } from '../lib/permissions';
import {
  dashboardCounts,
  deleteAttendanceSession,
  listAttendanceAlerts,
  listClasses,
  listEvents,
  listReceivedNotices,
  listRecentSessions,
  unreadNoticeCount,
  type RecentSession,
} from '../lib/queries';
import { eventCatLabel, eventColor } from '../lib/types';
import { HqDashboard } from './HqDashboard';

export function DashboardPage() {
  const qc = useQueryClient();
  const { user, role, isHq, isSuperadmin } = useAuth();
  const uid = user?.id;
  const firstName = (user?.user_metadata?.full_name || user?.email || 'Bem-vinda').split(' ')[0];

  const { data: counts } = useQuery({ queryKey: ['counts'], queryFn: dashboardCounts });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: recent = [] } = useQuery({ queryKey: ['recent-sessions'], queryFn: () => listRecentSessions(60) });
  const { data: events = [] } = useQuery({ queryKey: ['cal-events'], queryFn: listEvents });
  const { data: unread = 0 } = useQuery({ queryKey: ['notices-unread', uid], queryFn: () => unreadNoticeCount(uid!), enabled: !!uid });
  const { data: notices = [] } = useQuery({ queryKey: ['notices-received', uid], queryFn: () => listReceivedNotices(uid!), enabled: !!uid });
  const showAlerts = can(role, 'chamadas') || can(role, 'relatorios');
  const { data: alerts = [] } = useQuery({ queryKey: ['attendance-alerts'], queryFn: () => listAttendanceAlerts(), enabled: showAlerts });

  const [open, setOpen] = useState<string | null>(null);
  const className = (id: string) => classes.find((c) => c.id === id)?.name ?? 'Turma';

  const delSession = useMutation({
    mutationFn: deleteAttendanceSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recent-sessions'] });
      successToast('Chamada excluída com sucesso');
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, RecentSession[]>();
    recent.forEach((s) => {
      const arr = map.get(s.class_id) ?? [];
      arr.push(s);
      map.set(s.class_id, arr);
    });
    return [...map.entries()];
  }, [recent]);

  const todayISO = format(new Date(), 'yyyy-MM-dd');
  const upcoming = useMemo(
    () => events.filter((e) => (e.end_date || e.event_date) >= todayISO).slice(0, 4),
    [events, todayISO],
  );
  const recentNotices = notices.slice(0, 3);

  // Na HQ (Administração Geral), o Início é o painel de gestão dos clientes.
  if (isHq && isSuperadmin) return <HqDashboard />;

  // Ações rápidas conforme o papel.
  const actions = [
    can(role, 'chamadas') && { to: '/chamadas', icon: <ClipboardCheck size={22} />, label: 'Fazer chamada', color: '#059669', soft: '#ecfdf5' },
    can(role, 'notas') && { to: '/notas', icon: <Award size={22} />, label: 'Lançar notas', color: '#2563eb', soft: '#eff6ff' },
    { to: '/avisos', icon: <Megaphone size={22} />, label: 'Avisos', color: '#7c3aed', soft: '#f5f3ff', badge: unread },
    { to: '/calendario', icon: <CalendarDays size={22} />, label: 'Calendário', color: '#ea580c', soft: '#fff7ed' },
    can(role, 'relatorios') && { to: '/relatorios', icon: <BarChart3 size={22} />, label: 'Relatórios', color: '#475569', soft: '#f1f5f9' },
  ].filter(Boolean) as { to: string; icon: React.ReactNode; label: string; color: string; soft: string; badge?: number }[];

  return (
    <>
      <PageHeader title={`Olá, ${firstName}`} subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })} />

      {/* Ações rápidas */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="group relative flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ backgroundColor: a.soft, color: a.color }}>
              {a.icon}
            </span>
            <span className="text-sm font-black text-slate-900">{a.label}</span>
            {a.badge ? (
              <span className="absolute right-3 top-3 grid h-6 min-w-6 place-items-center rounded-full bg-emerald-500 px-1.5 text-xs font-black text-white">{a.badge}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard to="/turmas" icon={<GraduationCap size={18} />} value={counts?.classes ?? 0} label="Turmas" />
        <KpiCard to="/alunos" icon={<Users size={18} />} value={counts?.students ?? 0} label="Alunos" />
        <KpiCard to="/avisos" icon={<Bell size={18} />} value={unread} label="Avisos não lidos" highlight={unread > 0} />
        <KpiCard to="/calendario" icon={<CalendarDays size={18} />} value={upcoming.length} label="Próximos eventos" />
      </div>

      {/* Atenção: frequência baixa */}
      {showAlerts && alerts.length > 0 ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <TriangleAlert size={18} />
            </span>
            <div>
              <h2 className="text-sm font-black text-amber-900">Atenção · frequência abaixo de 75%</h2>
              <p className="text-xs font-bold text-amber-700/70">{alerts.length} aluno(s) em risco de reprovação por falta.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            {alerts.slice(0, 5).map((a) => (
              <div key={a.student_id} className="flex items-center gap-3 rounded-xl bg-white/70 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">{a.name}</span>
                  <span className="block text-xs font-bold text-slate-400">{className(a.class_id ?? '')} · {a.absent} falta(s)</span>
                </span>
                <span className="shrink-0 rounded-lg bg-red-100 px-2.5 py-1 text-sm font-black tabular-nums text-red-700">{a.pct}%</span>
              </div>
            ))}
          </div>
          {alerts.length > 5 ? <p className="mt-2 text-xs font-bold text-amber-700/70">+{alerts.length - 5} aluno(s)…</p> : null}
          <Link to="/relatorios" className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-amber-800 hover:underline">
            <BarChart3 size={14} /> Ver relatório de frequência →
          </Link>
        </div>
      ) : null}

      {/* Próximos eventos + Avisos recentes */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Próximos eventos</h2>
            <Link to="/calendario" className="text-xs font-bold text-emerald-700 hover:underline">Ver calendário</Link>
          </div>
          {upcoming.length === 0 ? (
            <Card><p className="text-sm text-slate-400">Nenhum evento agendado.</p></Card>
          ) : (
            <div className="space-y-2">
              {upcoming.map((e) => (
                <Link key={e.id} to="/calendario" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-200">
                  <span className="grid h-11 w-12 shrink-0 place-items-center rounded-lg text-xs font-black text-white" style={{ backgroundColor: eventColor(e.category) }}>
                    {e.event_date.slice(8, 10)}/{e.event_date.slice(5, 7)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-800">{e.title}</span>
                    <span className="block text-xs font-bold text-slate-400">{eventCatLabel(e.category)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Avisos recentes</h2>
            <Link to="/avisos" className="text-xs font-bold text-emerald-700 hover:underline">Ver avisos</Link>
          </div>
          {recentNotices.length === 0 ? (
            <Card><p className="text-sm text-slate-400">Nenhum aviso recebido.</p></Card>
          ) : (
            <div className="space-y-2">
              {recentNotices.map((n) => (
                <Link key={n.id} to="/avisos" className={cn('flex items-start gap-3 rounded-xl border bg-white p-3 transition hover:border-emerald-200', n.read ? 'border-slate-200' : 'border-emerald-300 bg-emerald-50/40')}>
                  <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', n.read ? 'bg-slate-300' : 'bg-emerald-500')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-slate-800">{n.title}</span>
                    <span className="block truncate text-xs text-slate-500">{n.body}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Chamadas recentes por turma</h2>
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

function KpiCard({ to, icon, value, label, highlight }: { to: string; icon: React.ReactNode; value: number; label: string; highlight?: boolean }) {
  return (
    <Link to={to}>
      <Card className={cn('flex items-center gap-3 p-4 transition hover:border-emerald-300', highlight && 'border-emerald-300 bg-emerald-50/50')}>
        <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', highlight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-50 text-emerald-700')}>{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl font-black leading-none text-slate-900">{value}</p>
          <p className="mt-1 truncate text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</p>
        </div>
      </Card>
    </Link>
  );
}
