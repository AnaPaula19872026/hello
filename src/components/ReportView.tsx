import { cn } from '../lib/cn';
import type { ReportPayload } from '../lib/types';

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function fmtDM(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} (${wd})`;
}
function situacao(media: number | null) {
  if (media == null) return '—';
  return media >= 6 ? 'Aprovado' : 'Recuperação';
}

export function ReportView({ payload, compact = false }: { payload: ReportPayload; compact?: boolean }) {
  const { school, kind, minPct = 75 } = payload;

  return (
    <div className="report-view">
      {/* Cabeçalho */}
      <div className="mb-5 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft print:shadow-none">
        {school?.logo_url ? (
          <img src={school.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1" />
        ) : (
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-slate-100 text-xl font-black uppercase text-slate-400">
            {school?.name?.slice(0, 1) ?? 'E'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {school?.name ? <p className="truncate text-xs font-black uppercase tracking-wide text-emerald-700">{school.name}</p> : null}
          <h2 className="text-lg font-black text-slate-900">{payload.title}</h2>
          <p className="text-sm text-slate-500">Turma {payload.className} • {payload.period}</p>
          {school && (school.address || school.city || school.phone) ? (
            <p className="mt-0.5 truncate text-xs text-slate-400">{[school.address, school.city, school.phone].filter(Boolean).join(' • ')}</p>
          ) : null}
        </div>
        <div className="ml-auto hidden shrink-0 text-right text-xs text-slate-400 sm:block">
          Gerado em<br />{payload.generatedAt}
        </div>
      </div>

      <ReportSummary payload={payload} minPct={minPct} />

      {kind === 'freq' ? <FreqBody payload={payload} compact={compact} minPct={minPct} /> : <NotasBody payload={payload} compact={compact} />}
    </div>
  );
}

function SummaryGrid({ stats }: { stats: { label: string; value: React.ReactNode; color?: string; box?: string }[] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 print:grid-cols-4">
      {stats.map((s, i) => (
        <div key={i} className={cn('rounded-2xl border border-slate-200 bg-white p-3 text-center print:shadow-none', s.box)}>
          <p className={cn('text-2xl font-black text-slate-900', s.color)}>{s.value}</p>
          <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

function ReportSummary({ payload, minPct }: { payload: ReportPayload; minPct: number }) {
  if (payload.kind === 'freq') {
    const rows = payload.freqRows ?? [];
    if (!rows.length) return null;
    const presMed = Math.round((rows.reduce((a, r) => a + r.pct, 0) / rows.length) * 10) / 10;
    const faltas = rows.reduce((a, r) => a + r.absent, 0);
    return (
      <SummaryGrid
        stats={[
          { label: 'Alunos', value: rows.length },
          { label: 'Presença média', value: `${presMed}%`, color: presMed < minPct ? 'text-amber-600' : 'text-emerald-700', box: 'border-emerald-200 bg-emerald-50' },
          { label: 'Total de faltas', value: faltas, color: 'text-red-600', box: 'border-red-200 bg-red-50' },
          { label: 'Aulas no período', value: payload.sessions ?? '–' },
        ]}
      />
    );
  }
  const rows = payload.notasRows ?? [];
  if (!rows.length) return null;
  const t = payload.notasTerm ?? 0;
  const vals = rows.map((r) => (t >= 1 && t <= 3 ? r.terms[t - 1] : r.final)).filter((x): x is number => x != null);
  const turma = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  const aprov = vals.filter((v) => v >= 6).length;
  const pct = vals.length ? Math.round((aprov / vals.length) * 100) : 0;
  return (
    <SummaryGrid
      stats={[
        { label: 'Alunos', value: rows.length },
        { label: 'Média da turma', value: turma != null ? turma.toFixed(1) : '–', color: turma != null && turma >= 6 ? 'text-emerald-700' : 'text-red-600' },
        { label: `Aprovados · ${pct}%`, value: aprov, color: 'text-emerald-700', box: 'border-emerald-200 bg-emerald-50' },
        { label: 'Em recuperação', value: vals.length - aprov, color: 'text-red-600', box: 'border-red-200 bg-red-50' },
      ]}
    />
  );
}

function FreqBody({ payload, compact, minPct }: { payload: ReportPayload; compact: boolean; minPct: number }) {
  const rows = payload.freqRows ?? [];
  if (rows.length === 0) return <p className="text-center text-slate-400">Nenhum dado no período.</p>;

  if (compact) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
            <tr>
              <th className="p-2.5">Aluno</th>
              <th className="p-2.5 text-center">%</th>
              <th className="p-2.5 text-center">Faltas</th>
              <th className="p-2.5">Dias de falta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} className="border-t border-slate-100">
                <td className="p-2.5 font-bold text-slate-800">
                  <span className="mr-2 inline-block w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>{r.name}
                </td>
                <td className="p-2.5 text-center">
                  <span className={cn('font-black', r.pct < minPct ? 'text-red-600' : 'text-emerald-700')}>{r.pct}%</span>
                </td>
                <td className="p-2.5 text-center font-bold text-red-600">{r.absent}</td>
                <td className="p-2.5 text-xs text-slate-600">{r.absentDates.map(fmtDM).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.name} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate font-bold text-slate-800">
              <span className="mr-2 inline-block w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>{r.name}
            </p>
            <span className={cn('text-lg font-black', r.pct < minPct ? 'text-red-600' : 'text-emerald-700')}>{r.pct}%</span>
          </div>
          {r.absent === 0 ? (
            <p className="mt-1 text-sm font-semibold text-emerald-700">Sem faltas · {r.present}/{r.total} aulas</p>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-bold text-red-600">{r.absent} falta(s):</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.absentDates.map((d) => (
                  <span key={d} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{fmtDM(d)}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NotasBody({ payload, compact }: { payload: ReportPayload; compact: boolean }) {
  const rows = payload.notasRows ?? [];
  if (rows.length === 0) return <p className="text-center text-slate-400">Nenhum dado.</p>;
  const pad = compact ? 'p-1.5' : 'p-2';
  const TLABEL = ['1º tri', '2º tri', '3º tri'];

  // Filtro por trimestre específico: mostra só a média daquele trimestre.
  const t = payload.notasTerm ?? 0;
  if (t >= 1 && t <= 3) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
            <tr>
              <th className={cn('sticky left-0 bg-slate-50', compact ? 'p-2' : 'p-3')}>Aluno</th>
              <th className={cn('text-center', pad)}>{TLABEL[t - 1]}</th>
              <th className={cn('text-center', pad)}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const m = r.terms[t - 1];
              return (
                <tr key={r.name} className="border-t border-slate-100">
                  <td className={cn('sticky left-0 bg-white font-bold text-slate-800', compact ? 'p-2' : 'p-3')}>
                    <span className="mr-2 inline-block w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>{r.name}
                  </td>
                  <td className={cn('text-center', pad)}>
                    {m != null ? <span className={cn('text-base font-black', m >= 6 ? 'text-emerald-700' : 'text-red-600')}>{m.toFixed(1)}</span> : '–'}
                  </td>
                  <td className={cn('text-center text-xs font-bold', pad)}>{situacao(m)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
          <tr>
            <th className={cn('sticky left-0 bg-slate-50', compact ? 'p-2' : 'p-3')}>Aluno</th>
            {TLABEL.map((t) => (
              <th key={t} className={cn('text-center', pad)}>{t}</th>
            ))}
            <th className={cn('text-center', pad)}>Final</th>
            <th className={cn('text-center', pad)}>Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className="border-t border-slate-100">
              <td className={cn('sticky left-0 bg-white font-bold text-slate-800', compact ? 'p-2' : 'p-3')}>
                <span className="mr-2 inline-block w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>{r.name}
              </td>
              {r.terms.map((m, j) => (
                <td key={j} className={cn('text-center', pad)}>
                  {m != null ? <span className={cn('font-bold', m >= 6 ? 'text-emerald-700' : 'text-red-600')}>{m.toFixed(1)}</span> : '–'}
                </td>
              ))}
              <td className={cn('text-center', pad)}>
                {r.final != null ? <span className={cn('font-black', r.final >= 6 ? 'text-emerald-700' : 'text-red-600')}>{r.final.toFixed(1)}</span> : '–'}
              </td>
              <td className={cn('text-center text-xs font-bold', pad)}>{situacao(r.final)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
