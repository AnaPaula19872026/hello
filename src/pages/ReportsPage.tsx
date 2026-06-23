import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { BarChart3, Eye, FileDown, List, Printer, Rows3, Send } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ReportView } from '../components/ReportView';
import { ShareModal } from '../components/ShareModal';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Segmented, Select, Loading} from '../components/ui';
import { cn } from '../lib/cn';
import { listNationalHolidays } from '../lib/holidays';
import { downloadXlsx } from '../lib/importSheet';
import { groupByMonth, schoolDaysBetween, weekdayLetter } from '../lib/schooldays';
import { listClasses, listSchools, listStudentsByClass, reportAttendance, reportTerms } from '../lib/queries';
import { MONTHS, SCHOOL_YEAR_MONTHS, SUBJECT, TERM_MONTHS, type ReportPayload } from '../lib/types';

type Tipo = 'freq' | 'notas';
const today = new Date();
const iso = (d: Date) => format(d, 'yyyy-MM-dd');
const fmtBR = (s: string) => s.split('-').reverse().join('/');

export function ReportsPage() {
  const [tipo, setTipo] = useState<Tipo>('freq');
  const [classId, setClassId] = useState('');
  const [from, setFrom] = useState(iso(startOfMonth(today)));
  const [to, setTo] = useState(iso(endOfMonth(today)));
  const [year, setYear] = useState(today.getFullYear());
  const [studentId, setStudentId] = useState('all');
  const [minPct, setMinPct] = useState(75);
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [notaTerm, setNotaTerm] = useState(0); // 0 = todos os trimestres
  const [activePreset, setActivePreset] = useState('mes');
  const [freqLayout, setFreqLayout] = useState<'list' | 'grid'>('grid');
  const [compact, setCompact] = useState(false);
  const [preview, setPreview] = useState(false);
  const [share, setShare] = useState(false);

  const location = useLocation();
  useEffect(() => {
    const fromState = (location.state as { classId?: string } | null)?.classId;
    if (fromState) setClassId(fromState);
  }, [location.state]);

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools });
  const { data: students = [] } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  });

  const klass = classes.find((c) => c.id === classId);
  const className = klass?.name ?? '';
  const school = schools.find((s) => s.id === klass?.school_id);

  const freq = useQuery({
    queryKey: ['rep-freq', classId, from, to],
    queryFn: () => reportAttendance(classId, from, to),
    enabled: tipo === 'freq' && !!classId,
  });
  const notas = useQuery({
    queryKey: ['rep-notas', classId, year],
    queryFn: () => reportTerms(classId, year),
    enabled: tipo === 'notas' && !!classId,
  });

  // Feriados nacionais dos anos do período — para tirar do mapa de chamada (dias letivos).
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  const holidaysQ = useQuery({
    queryKey: ['national-holidays', fromYear, toYear],
    queryFn: async () => {
      const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
      const lists = await Promise.all(years.map((y) => listNationalHolidays(y)));
      return new Set(lists.flat().map((h) => h.date));
    },
    enabled: tipo === 'freq' && freqLayout === 'grid' && !!classId,
  });

  // Colunas do mapa de chamada: todos os dias letivos (seg–sex, sem feriados) do período.
  const gridDates = useMemo(
    () => (freqLayout === 'grid' ? schoolDaysBetween(from, to, holidaysQ.data) : []),
    [freqLayout, from, to, holidaysQ.data],
  );

  function preset(p: 'mes' | 'mesPassado' | 'ano' | 'tri1' | 'tri2' | 'tri3') {
    setActivePreset(p);
    const y = today.getFullYear();
    if (p === 'mes') {
      setFrom(iso(startOfMonth(today)));
      setTo(iso(endOfMonth(today)));
    } else if (p === 'mesPassado') {
      const d = subMonths(today, 1);
      setFrom(iso(startOfMonth(d)));
      setTo(iso(endOfMonth(d)));
    } else if (p === 'ano') {
      // ano letivo: fev a nov
      setFrom(iso(new Date(y, SCHOOL_YEAR_MONTHS[0], 1)));
      setTo(iso(endOfMonth(new Date(y, SCHOOL_YEAR_MONTHS[1], 1))));
    } else {
      const n = Number(p.slice(3)); // 1..3
      const [a, b] = TERM_MONTHS[n];
      setFrom(iso(new Date(y, a, 1)));
      setTo(iso(endOfMonth(new Date(y, b, 1))));
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

  // Relatório pronto (usado na tela, na pré-visualização e no link compartilhado).
  const payload: ReportPayload | null = useMemo(() => {
    if (!classId) return null;
    const reportSchool = school
      ? { name: school.name, logo_url: school.logo_url, address: school.address, city: school.city, phone: school.phone }
      : null;
    const generatedAt = format(today, 'dd/MM/yyyy');
    if (tipo === 'freq') {
      return {
        kind: 'freq',
        school: reportSchool,
        className,
        title: 'Relatório de Frequência',
        period: `${fmtBR(from)} a ${fmtBR(to)}`,
        generatedAt,
        minPct,
        sessions: freq.data?.sessions ?? 0,
        examDates: freq.data?.examDates ?? [],
        dates: freq.data?.dates ?? [],
        gridDates,
        layout: freqLayout,
        freqRows: freqRows.map((r) => ({ name: r.name, present: r.present, absent: r.absent, total: r.total, pct: r.pct, absentDates: r.absentDates, days: r.days })),
      };
    }
    return {
      kind: 'notas',
      school: reportSchool,
      className,
      title: `Relatório de Notas — ${SUBJECT}`,
      period: String(year),
      generatedAt,
      subject: SUBJECT,
      notasRows: notasRows.map((r) => ({ name: r.name, terms: r.terms, final: r.final })),
      notasTerm: notaTerm,
    };
  }, [classId, tipo, school, className, from, to, minPct, freq.data, freqRows, gridDates, freqLayout, year, notasRows, notaTerm]);

  function exportExcel() {
    const titulo = [school?.name ?? 'Escola'];
    if (tipo === 'freq' && freqLayout === 'grid' && gridDates.length) {
      // Mapa de chamada: matriz aluno × dia letivo (P/F), um bloco por mês.
      const aoa: (string | number | null)[][] = [titulo, [`Mapa de chamada — Turma ${className} — ${fmtBR(from)} a ${fmtBR(to)}`], []];
      for (const m of groupByMonth(gridDates)) {
        aoa.push([`${MONTHS[m.month - 1]} / ${m.year}`]);
        aoa.push(['', ...m.days.map((d) => weekdayLetter(d))]);
        aoa.push(['Aluno', ...m.days.map((d) => Number(d.slice(8, 10))), 'Pres.', 'Faltas', '%', 'Situação']);
        for (const r of freqRows) {
          let faltas = 0;
          const cells = m.days.map((d) => {
            const absent = r.days?.[d] === false;
            if (absent) faltas++;
            return absent ? 'F' : 'P';
          });
          const present = m.days.length - faltas;
          const pct = m.days.length ? Math.round((present / m.days.length) * 1000) / 10 : 0;
          aoa.push([r.name, ...cells, present, faltas, pct, pct < minPct ? 'Reprovado' : 'Aprovado']);
        }
        aoa.push([]);
      }
      downloadXlsx(`mapa-chamada-${slug(className)}-${from}_a_${to}.xlsx`, aoa, 'Mapa de chamada');
    } else if (tipo === 'freq') {
      const aoa: (string | number | null)[][] = [
        titulo,
        [`Frequência — Turma ${className} — ${fmtBR(from)} a ${fmtBR(to)}`],
        [],
        ['Aluno', 'Presenças', 'Faltas', 'Total', '% Presença', 'Dias de falta'],
        ...freqRows.map((r) => [r.name, r.present, r.absent, r.total, r.pct, r.absentDates.map(fmtBR).join(', ')]),
      ];
      downloadXlsx(`frequencia-${slug(className)}-${from}_a_${to}.xlsx`, aoa, 'Frequência');
    } else {
      const sit = (m: number | null) => (m == null ? '—' : m >= 6 ? 'Aprovado' : 'Recuperação');
      const aoa: (string | number | null)[][] =
        notaTerm >= 1 && notaTerm <= 3
          ? [
              titulo,
              [`Notas (${SUBJECT}) — Turma ${className} — ${notaTerm}º trimestre / ${year}`],
              [],
              ['Aluno', `${notaTerm}º tri`, 'Situação'],
              ...notasRows.map((r) => [r.name, r.terms[notaTerm - 1], sit(r.terms[notaTerm - 1])]),
            ]
          : [
              titulo,
              [`Notas (${SUBJECT}) — Turma ${className} — ${year}`],
              [],
              ['Aluno', '1º tri', '2º tri', '3º tri', 'Final'],
              ...notasRows.map((r) => [r.name, ...r.terms, r.final]),
            ];
      const suffix = notaTerm >= 1 ? `-${notaTerm}tri` : '';
      downloadXlsx(`notas-${slug(className)}-${year}${suffix}.xlsx`, aoa, 'Notas');
    }
  }

  const years = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
  const loading = tipo === 'freq' ? freq.isLoading : notas.isLoading;

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="Relatórios"
          subtitle="Frequência e notas, com filtros, compartilhamento e exportação."
        />

        {/* Filtros */}
        <Card className="mb-5">
          <Segmented<Tipo>
            className="mb-4"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: 'freq', label: 'Frequência' },
              { value: 'notas', label: 'Notas' },
            ]}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Turma">
              <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Selecione a turma…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Aluno">
              <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} disabled={!classId}>
                <option value="all">Todos os alunos</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </Select>
            </Field>

            {tipo === 'freq' ? (
              <>
                <Field label="De">
                  <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="Até">
                  <Input type="date" value={to} min={from} max={iso(today)} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="Ano">
                <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>

          {tipo === 'freq' ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {([['mes', 'Este mês'], ['mesPassado', 'Mês passado'], ['ano', 'Ano letivo'], ['tri1', '1º trimestre'], ['tri2', '2º trimestre'], ['tri3', '3º trimestre']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => preset(key)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                    activePreset === key ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
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

          {tipo === 'freq' ? (
            <Segmented<'list' | 'grid'>
              className="mt-3"
              value={freqLayout}
              onChange={setFreqLayout}
              options={[
                { value: 'grid', label: 'Mapa de chamada' },
                { value: 'list', label: 'Lista detalhada' },
              ]}
            />
          ) : null}

          {tipo === 'notas' ? (
            <Segmented<number>
              className="mt-3"
              value={notaTerm}
              onChange={setNotaTerm}
              options={[
                { value: 0, label: 'Todos' },
                { value: 1, label: '1º trimestre' },
                { value: 2, label: '2º trimestre' },
                { value: 3, label: '3º trimestre' },
              ]}
            />
          ) : null}
        </Card>

        {/* Barra de ações (responsiva) */}
        {classId ? (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-soft">
            <Button variant="ghost" onClick={() => setCompact((c) => !c)} className="flex-1 sm:flex-none" title="Alternar layout">
              {compact ? <Rows3 size={18} /> : <List size={18} />} {compact ? 'Detalhado' : 'Compacto'}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(true)} disabled={!payload} className="flex-1 sm:flex-none">
              <Eye size={18} /> Visualizar
            </Button>
            <Button variant="ghost" onClick={() => setShare(true)} disabled={!payload} className="flex-1 sm:flex-none">
              <Send size={18} /> Enviar
            </Button>
            <Button variant="ghost" onClick={() => window.print()} className="flex-1 sm:flex-none">
              <Printer size={18} /> PDF
            </Button>
            <Button onClick={exportExcel} className="flex-1 sm:ml-auto sm:flex-none">
              <FileDown size={18} /> Excel
            </Button>
          </div>
        ) : null}
      </div>

      {/* Relatório */}
      {!classId ? (
        <EmptyState icon={<BarChart3 size={26} />} title="Escolha uma turma" hint="Selecione a turma para gerar o relatório." />
      ) : loading ? (
        <Loading label="Gerando…" />
      ) : payload ? (
        <ReportView payload={payload} compact={compact} />
      ) : null}

      {/* Pré-visualização */}
      <Modal open={preview} onClose={() => setPreview(false)} title="Pré-visualização" size="xl">
        {payload ? <ReportView payload={payload} compact={compact} /> : null}
      </Modal>

      <ShareModal open={share} onClose={() => setShare(false)} payload={payload} />
    </div>
  );
}

function slug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'turma';
}
