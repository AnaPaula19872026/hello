import { useQuery } from '@tanstack/react-query';
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, FileDown, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, Field, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { downloadXlsx } from '../lib/importSheet';
import { listClasses, listStudentsByClass, reportAttendance, reportGrades } from '../lib/queries';
import { MONTHS, SUBJECT } from '../lib/types';

type Tipo = 'freq' | 'notas';
const today = new Date();
const iso = (d: Date) => format(d, 'yyyy-MM-dd');

export function ReportsPage() {
  const [tipo, setTipo] = useState<Tipo>('freq');
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(iso(startOfMonth(today)));
  const [to, setTo] = useState(iso(endOfMonth(today)));
  const [year, setYear] = useState(today.getFullYear());
  const [studentId, setStudentId] = useState('all');
  const [minPct, setMinPct] = useState(75);
  const [onlyBelow, setOnlyBelow] = useState(false);

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: students = [] } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  });

  const className = classes.find((c) => c.id === classId)?.name ?? '';

  const freq = useQuery({
    queryKey: ['rep-freq', classId, from, to],
    queryFn: () => reportAttendance(classId, from, to),
    enabled: tipo === 'freq' && !!classId,
  });
  const notas = useQuery({
    queryKey: ['rep-notas', classId, year],
    queryFn: () => reportGrades(classId, year),
    enabled: tipo === 'notas' && !!classId,
  });

  function preset(p: 'mes' | 'mesPassado' | 'ano') {
    if (p === 'mes') {
      setFrom(iso(startOfMonth(today)));
      setTo(iso(endOfMonth(today)));
    } else if (p === 'mesPassado') {
      const d = subMonths(today, 1);
      setFrom(iso(startOfMonth(d)));
      setTo(iso(endOfMonth(d)));
    } else {
      setFrom(iso(startOfYear(today)));
      setTo(iso(endOfYear(today)));
    }
  }

  const freqRows = useMemo(() => {
    let r = freq.data?.rows ?? [];
    if (studentId !== 'all') r = r.filter((x) => x.student_id === studentId);
    if (onlyBelow) r = r.filter((x) => x.pct < minPct);
    return r;
  }, [freq.data, studentId, onlyBelow, minPct]);

  const notasRows = useMemo(() => {
    let r = notas.data ?? [];
    if (studentId !== 'all') r = r.filter((x) => x.student_id === studentId);
    return r;
  }, [notas.data, studentId]);

  const freqSummary = useMemo(() => {
    const rows = freqRows;
    const avg = rows.length ? Math.round((rows.reduce((a, b) => a + b.pct, 0) / rows.length) * 10) / 10 : 0;
    const risco = rows.filter((r) => r.pct < minPct).length;
    return { alunos: rows.length, sessoes: freq.data?.sessions ?? 0, avg, risco };
  }, [freqRows, freq.data, minPct]);

  function exportExcel() {
    if (tipo === 'freq') {
      const aoa: (string | number | null)[][] = [
        ['Aluno', 'Presenças', 'Faltas', 'Atrasos', 'Justificadas', 'Total', '% Presença'],
        ...freqRows.map((r) => [r.name, r.present, r.absent, r.late, r.justified, r.total, r.pct]),
      ];
      downloadXlsx(`frequencia-${slug(className)}-${from}_a_${to}.xlsx`, aoa, 'Frequência');
    } else {
      const aoa: (string | number | null)[][] = [
        ['Aluno', ...MONTHS.map((m) => m.slice(0, 3)), 'Média', 'Situação'],
        ...notasRows.map((r) => [r.name, ...r.months, r.media, situacao(r.media)]),
      ];
      downloadXlsx(`notas-${slug(className)}-${year}.xlsx`, aoa, 'Notas');
    }
  }

  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

  return (
    <div className="report-root">
      <PageHeader
        title="Relatórios"
        subtitle="Frequência e notas, com filtros e exportação."
        action={
          <div className="no-print flex gap-2">
            <Button variant="ghost" onClick={() => window.print()} disabled={!classId}>
              <Printer size={18} /> PDF
            </Button>
            <Button onClick={exportExcel} disabled={!classId}>
              <FileDown size={18} /> Excel
            </Button>
          </div>
        }
      />

      {/* Filtros */}
      <Card className="no-print mb-5">
        <div className="mb-4 flex gap-2">
          {(['freq', 'notas'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={cn(
                'flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition',
                tipo === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {t === 'freq' ? 'Frequência' : 'Notas'}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Turma">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Selecione a turma…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Aluno">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!classId}>
              <option value="all">Todos os alunos</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          </Field>

          {tipo === 'freq' ? (
            <>
              <Field label="De">
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
              </Field>
              <Field label="Até">
                <input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500" />
              </Field>
            </>
          ) : (
            <Field label="Ano">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        {tipo === 'freq' ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={() => preset('mes')} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Este mês</button>
            <button onClick={() => preset('mesPassado')} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Mês passado</button>
            <button onClick={() => preset('ano')} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Ano todo</button>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} />
                Só faltosos abaixo de
              </label>
              <Select value={minPct} onChange={(e) => setMinPct(Number(e.target.value))} className="w-24 py-1.5">
                {[60, 70, 75, 80, 90].map((p) => (
                  <option key={p} value={p}>{p}%</option>
                ))}
              </Select>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Resultado */}
      {!classId ? (
        <EmptyState icon={<BarChart3 size={26} />} title="Escolha uma turma" hint="Selecione a turma para gerar o relatório." />
      ) : tipo === 'freq' ? (
        freq.isLoading ? (
          <p className="text-sm text-slate-500">Gerando…</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Aulas no período" value={freqSummary.sessoes} />
              <Stat label="Alunos" value={freqSummary.alunos} />
              <Stat label="Presença média" value={`${freqSummary.avg}%`} />
              <Stat label={`Abaixo de ${minPct}%`} value={freqSummary.risco} danger={freqSummary.risco > 0} />
            </div>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Aluno</th>
                    <th className="p-3 text-center">Pres.</th>
                    <th className="p-3 text-center">Faltas</th>
                    <th className="p-3 text-center">Atrasos</th>
                    <th className="p-3 text-center">Just.</th>
                    <th className="p-3 text-center">% Presença</th>
                  </tr>
                </thead>
                <tbody>
                  {freqRows.map((r) => (
                    <tr key={r.student_id} className="border-t border-slate-100">
                      <td className="p-3 font-bold text-slate-800">{r.name}</td>
                      <td className="p-3 text-center">{r.present}</td>
                      <td className="p-3 text-center font-bold text-red-600">{r.absent}</td>
                      <td className="p-3 text-center">{r.late}</td>
                      <td className="p-3 text-center">{r.justified}</td>
                      <td className="p-3 text-center">
                        <span className={cn('font-black', r.pct < minPct ? 'text-red-600' : 'text-emerald-700')}>{r.pct}%</span>
                      </td>
                    </tr>
                  ))}
                  {freqRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-slate-400">Nenhum dado no período.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </Card>
          </>
        )
      ) : notas.isLoading ? (
        <p className="text-sm text-slate-500">Gerando…</p>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 p-3">Aluno</th>
                {MONTHS.map((m) => (
                  <th key={m} className="p-2 text-center">{m.slice(0, 3)}</th>
                ))}
                <th className="p-3 text-center">Média</th>
                <th className="p-3 text-center">Situação</th>
              </tr>
            </thead>
            <tbody>
              {notasRows.map((r) => (
                <tr key={r.student_id} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white p-3 font-bold text-slate-800">{r.name}</td>
                  {r.months.map((m, i) => (
                    <td key={i} className="p-2 text-center text-slate-600">{m != null ? m : '–'}</td>
                  ))}
                  <td className="p-3 text-center">
                    {r.media != null ? <span className={cn('font-black', r.media >= 6 ? 'text-emerald-700' : 'text-red-600')}>{r.media}</span> : '–'}
                  </td>
                  <td className="p-3 text-center text-xs font-bold">{situacao(r.media)}</td>
                </tr>
              ))}
              {notasRows.length === 0 ? (
                <tr><td colSpan={15} className="p-6 text-center text-slate-400">Nenhum dado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      )}

      <p className="mt-4 hidden text-xs text-slate-400 print:block">
        {tipo === 'freq'
          ? `Frequência • ${className} • ${format(new Date(from), 'dd/MM/yyyy')} a ${format(new Date(to), 'dd/MM/yyyy')}`
          : `Notas (${SUBJECT}) • ${className} • ${year}`}{' '}
        — gerado em {format(today, "dd/MM/yyyy", { locale: ptBR })}
      </p>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className={cn('text-2xl font-black', danger ? 'text-red-600' : 'text-slate-900')}>{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function situacao(media: number | null): string {
  if (media == null) return '—';
  if (media >= 6) return 'Aprovado';
  return 'Recuperação';
}

function slug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'turma';
}
