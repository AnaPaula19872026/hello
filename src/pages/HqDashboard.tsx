import { useQuery } from '@tanstack/react-query';
import { Bell, Building2, ClipboardCheck, GraduationCap, Network, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, PageHeader, SectionTitle, StatCard } from '../components/ui';
import { hqAttendanceDaily, hqStats, listOrgAdmin } from '../lib/queries';

export function HqDashboard() {
  // Tempo real: revalida periodicamente.
  const opts = { refetchInterval: 30_000 };
  const { data: clients = [] } = useQuery({ queryKey: ['org-admin'], queryFn: listOrgAdmin, ...opts });
  const { data: stats } = useQuery({ queryKey: ['hq-stats'], queryFn: hqStats, ...opts });
  const { data: daily = [] } = useQuery({ queryKey: ['hq-daily'], queryFn: hqAttendanceDaily, ...opts });

  const totals = useMemo(() => {
    const active = clients.filter((c) => c.active).length;
    return {
      clients: clients.length,
      active,
      inactive: clients.length - active,
      schools: clients.reduce((a, c) => a + c.schools, 0),
      students: clients.reduce((a, c) => a + c.students, 0),
      members: clients.reduce((a, c) => a + c.members, 0),
    };
  }, [clients]);

  const topStudents = useMemo(
    () => [...clients].sort((a, b) => b.students - a.students).slice(0, 8).map((c) => ({ name: c.name, alunos: c.students })),
    [clients],
  );

  const pieData = [
    { name: 'Ativos', value: totals.active, color: '#10b981' },
    { name: 'Inativos', value: totals.inactive, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  const dailyData = daily.map((d) => ({ dia: d.day.slice(8, 10) + '/' + d.day.slice(5, 7), chamadas: d.sessions }));

  return (
    <>
      <PageHeader title="Administração Geral" subtitle="Visão consolidada dos clientes — atualiza em tempo real." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Network size={22} />}
          label="Clientes"
          value={totals.clients}
          sub={`${totals.active} ativos · ${totals.inactive} inativos`}
        />
        <StatCard icon={<Building2 size={22} />} label="Escolas" value={totals.schools} />
        <StatCard icon={<GraduationCap size={22} />} label="Alunos" value={totals.students} />
        <StatCard icon={<Users size={22} />} label="Membros" value={totals.members} />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard
          icon={<ClipboardCheck size={22} />}
          label="Chamadas (30 dias)"
          value={stats?.sessions_30d ?? 0}
          sub={`${stats?.sessions_total ?? 0} no total`}
        />
        <StatCard
          icon={<Bell size={22} />}
          label="Avisos (30 dias)"
          value={stats?.notices_30d ?? 0}
          sub={`${stats?.notices_total ?? 0} no total`}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Atividade diária */}
        <Card className="lg:col-span-2">
          <SectionTitle className="mb-3">Chamadas por dia (14 dias)</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ left: -20, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Area type="monotone" dataKey="chamadas" stroke="#059669" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Ativos x Inativos */}
        <Card>
          <SectionTitle className="mb-3">Status dos clientes</SectionTitle>
          <div className="h-64">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="grid h-full place-items-center text-sm text-slate-400">Sem clientes ainda.</p>
            )}
          </div>
          <div className="flex justify-center gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {totals.active} ativos</span>
            <span className="flex items-center gap-1.5 text-red-600"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> {totals.inactive} inativos</span>
          </div>
        </Card>

        {/* Alunos por cliente */}
        <Card className="lg:col-span-3">
          <SectionTitle className="mb-3" action={<Link to="/organizacoes" className="text-xs font-bold text-emerald-700 hover:underline">Ver todos</Link>}>
            Alunos por cliente
          </SectionTitle>
          <div className="h-72">
            {topStudents.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topStudents} margin={{ left: -20, right: 8, top: 4 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="alunos" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="grid h-full place-items-center text-sm text-slate-400">Sem dados de clientes.</p>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
