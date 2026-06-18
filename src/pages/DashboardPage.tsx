import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Award, BarChart3, Bell, CalendarDays, ChevronDown, ClipboardCheck, GraduationCap, Megaphone, RotateCcw, TriangleAlert, Trash2, Users } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, Loading, Modal, PageHeader, SectionTitle, StatCard } from '../components/ui';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import { can } from '../lib/permissions';
import {
  dashboardCounts,
  deleteAttendanceSession,
  listAttendanceAlerts,
  listClasses,
  listDeletedSessions,
  listEvents,
  listReceivedNotices,
  listRecentSessions,
  purgeAttendanceSession,
  restoreAttendanceSession,
  unreadNoticeCount,
  type RecentSession,
} from '../lib/queries';
import { eventCatLabel, eventColor } from '../lib/types';

// Carrega sob demanda (tira o recharts do bundle inicial dos professores).
const HqDashboard = lazy(() => import('./HqDashboard').then((m) => ({ default: m.HqDashboard })));

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
  const [trashOpen, setTrashOpen] = useState(false);
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
  if (isHq && isSuperadmin) return <Suspense fallback={<Loading />}><HqDashboard /></Suspense>;

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
        <StatCard to="/turmas" icon={<GraduationCap size={18} />} value={counts?.classes ?? 0} label="Turmas" />
        <StatCard to="/alunos" icon={<Users size={18} />} value={counts?.students ?? 0} label="Alunos" />
        <StatCard to="/avisos" icon={<Bell size={18} />} value={unread} label="Avisos não lidos" highlight={unread > 0} />
        <StatCard to="/calendario" icon={<CalendarDays size={18} />} value={upcoming.length} label="Próximos eventos" />
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
          <SectionTitle action={<Link to="/calendario" className="text-xs font-bold text-emerald-700 hover:underline">Ver calendário</Link>}>
            Próximos eventos
          </SectionTitle>
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
          <SectionTitle action={<Link to="/avisos" className="text-xs font-bold text-emerald-700 hover:underline">Ver avisos</Link>}>
            Avisos recentes
          </SectionTitle>
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

      <SectionTitle
        className="mb-3"
        action={
          <button onClick={() => setTrashOpen(true)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800">
            <Trash2 size={14} /> Lixeira
          </button>
        }
      >
        Chamadas recentes por turma
      </SectionTitle>
      {groups.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">Nenhuma chamada registrada ainda.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(([classId, sessions]) => {
            const isOpen = open === classId;
            const faltas = sessions.reduce((a, s) => a + s.absent, 0);
            const presentes = sessions.reduce((a, s) => a + s.present, 0);
            const total = presentes + faltas;
            const rate = total > 0 ? faltas / total : 0;
            const presPct = total > 0 ? Math.round((presentes / total) * 100) : 100;
            const lastDate = sessions[0]?.session_date;
            // Polimorfismo: o tom acompanha a severidade das faltas da turma.
            const tone =
              faltas === 0
                ? { accent: 'border-l-emerald-400', icon: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' }
                : rate < 0.15
                ? { accent: 'border-l-amber-400', icon: 'bg-amber-50 text-amber-700', bar: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' }
                : { accent: 'border-l-rose-400', icon: 'bg-rose-50 text-rose-700', bar: 'bg-rose-500', pill: 'bg-rose-50 text-rose-700' };
            return (
              <Card key={classId} className={cn('overflow-hidden border-l-4 p-0 transition', tone.accent, isOpen && 'sm:col-span-2 xl:col-span-3')}>
                <button onClick={() => setOpen(isOpen ? null : classId)} className="flex w-full items-center gap-3 p-4 text-left">
                  <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', tone.icon)}>
                    <GraduationCap size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black text-slate-900">{className(classId)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {sessions.length} chamada(s)
                      {lastDate ? <> · últ. {format(parseISO(lastDate), "d 'de' MMM", { locale: ptBR })}</> : null}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${presPct}%` }} />
                      </div>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-slate-400">{presPct}% pres.</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-black tabular-nums', tone.pill)}>{faltas}</span>
                    <ChevronDown size={18} className={cn('text-slate-400 transition', isOpen && 'rotate-180')} />
                  </div>
                </button>

                {isOpen ? (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {sessions.map((s) => (
                      <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                        <p className="min-w-0 flex-1 text-sm font-bold text-slate-700">
                          {format(parseISO(s.session_date), "EEE, d 'de' MMM", { locale: ptBR })}
                        </p>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{s.present} pres.</span>
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{s.absent} falt.</span>
                        <button
                          onClick={() => confirm(`Excluir a chamada de ${format(parseISO(s.session_date), 'dd/MM/yyyy')}?`) && delSession.mutate(s.id)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
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

      {trashOpen ? <TrashModal classNameOf={className} onClose={() => setTrashOpen(false)} /> : null}
    </>
  );
}

/** Lixeira de chamadas: restaurar ou excluir definitivamente. */
function TrashModal({ classNameOf, onClose }: { classNameOf: (id: string) => string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['deleted-sessions'], queryFn: () => listDeletedSessions(), retry: false });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['deleted-sessions'] });
    qc.invalidateQueries({ queryKey: ['recent-sessions'] });
  };
  const restore = useMutation({ mutationFn: restoreAttendanceSession, onSuccess: () => { refresh(); successToast('Chamada restaurada'); } });
  const purge = useMutation({ mutationFn: purgeAttendanceSession, onSuccess: () => { refresh(); successToast('Chamada excluída definitivamente'); } });

  return (
    <Modal open onClose={onClose} title="Lixeira de chamadas">
      <div className="space-y-3">
        <p className="text-sm text-slate-500">Chamadas excluídas. Restaure com um clique ou exclua de vez.</p>
        {isLoading ? (
          <Loading />
        ) : items.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">A lixeira está vazia.</p>
        ) : (
          <div className="space-y-2">
            {items.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-800">{classNameOf(s.class_id)}</p>
                  <p className="text-xs font-bold text-slate-400">
                    {format(parseISO(s.session_date), "dd/MM/yyyy", { locale: ptBR })} · {s.present} pres. · {s.absent} falt.
                  </p>
                </div>
                <Button variant="soft" onClick={() => restore.mutate(s.id)} disabled={restore.isPending}>
                  <RotateCcw size={16} /> Restaurar
                </Button>
                <button
                  onClick={() => confirm('Excluir DEFINITIVAMENTE esta chamada? Não dá pra recuperar depois.') && purge.mutate(s.id)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                  aria-label="Excluir definitivamente"
                  title="Excluir definitivamente"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

