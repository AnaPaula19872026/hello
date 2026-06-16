import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Award, ClipboardList, FileText, GraduationCap, Lock, Pencil, Plus, Printer, Save, Share2, Sliders, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Segmented, Select } from '../components/ui';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import { printDocument, escapeHtml } from '../lib/print';
import { usePersistentState } from '../lib/usePersistentState';
import {
  getCreditoData,
  getTermConfig,
  getSavedTermConfig,
  listClasses,
  listSchools,
  listStudentsByClass,
  listTermGrades,
  reportTerms,
  saveTermConfig,
  saveTermGrades,
  type TermsReportRow,
} from '../lib/queries';
import { DEFAULT_ACTIVITIES, MEDIA_APROVACAO, RECOVERY_ACTIVITY_NAME, TERMS, TERM_LABEL, actKey, calcMedia, isRecoveryActivity, orderGradeActivities, sanitizeGrade, type GradeActivity, type School } from '../lib/types';

/** Cabeçalho profissional para impressão (logo, escola, contato) — usado no boletim e no relatório. */
function schoolHeaderHtml(school: School | undefined, label: string): string {
  const name = school?.name ?? 'Escola';
  const contato = [school?.address, school?.city, school?.phone].filter(Boolean).map((x) => escapeHtml(String(x))).join(' • ');
  const logo = school?.logo_url
    ? `<img src="${escapeHtml(school.logo_url)}" alt="" style="height:60px;width:60px;object-fit:contain;border:1px solid #e2e8f0;border-radius:10px;padding:3px;background:#fff;" />`
    : `<div style="height:60px;width:60px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#f1f5f9;font-size:24px;font-weight:800;color:#94a3b8;">${escapeHtml(name.slice(0, 1))}</div>`;
  return `<div style="display:flex; align-items:center; gap:14px; border-bottom:2px solid #0f172a; padding-bottom:12px; margin-bottom:14px;">
    ${logo}
    <div style="flex:1; min-width:0;">
      <div style="font-size:18px; font-weight:800; line-height:1.1;">${escapeHtml(name)}</div>
      <div style="font-size:13px; font-weight:700; letter-spacing:.08em; color:#475569;">${escapeHtml(label)}</div>
      ${contato ? `<div style="font-size:11px; color:#94a3b8; margin-top:2px;">${contato}</div>` : ''}
    </div>
    <div style="text-align:right; font-size:10px; color:#94a3b8;">Gerado em<br/>${new Date().toLocaleDateString('pt-BR')}</div>
  </div>`;
}

export function NotasPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { activeOrgId, ctxLoading } = useAuth();
  const now = new Date();
  const [classId, setClassId] = usePersistentState('hello:notas:classId', '');
  const [term, setTerm] = usePersistentState('hello:notas:term', 1);
  const [year, setYear] = usePersistentState('hello:notas:year', now.getFullYear());
  const [q, setQ] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [obs, setObs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [editingGrades, setEditingGrades] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [boletimOpen, setBoletimOpen] = useState(false);
  const [boletimEscolarOpen, setBoletimEscolarOpen] = useState(false);
  const orgReady = !ctxLoading && !!activeOrgId;

  const { data: classes = [] } = useQuery({ queryKey: ['classes', activeOrgId], queryFn: listClasses, enabled: orgReady });
  useEffect(() => {
    if (!orgReady) return;
    if (!classes.length) return;
    if (!classId || !classes.some((c) => c.id === classId)) setClassId(classes[0].id);
  }, [classes, classId, orgReady]);

  const { data: activities = [] } = useQuery({
    queryKey: ['term-config', activeOrgId, year, term],
    queryFn: () => getTermConfig(year, term),
    enabled: orgReady,
  });
  const orderedActivities = useMemo(() => orderGradeActivities(activities), [activities]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-by-class', activeOrgId, classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: orgReady && !!classId,
  });

  const {
    data: termGrades = [],
    isLoading: gradesLoading,
    isError: gradesIsError,
    error: gradesError,
  } = useQuery({
    queryKey: ['term-grades', activeOrgId, classId, year, term],
    queryFn: () => listTermGrades(classId, year, term),
    enabled: orgReady && !!classId,
  });

  const { data: creditData = { defs: [], byStudent: {} } } = useQuery({
    queryKey: ['credito-data', activeOrgId, classId, year, term],
    queryFn: () => getCreditoData(classId, year, term),
    enabled: orgReady && !!classId,
  });
  // Colunas finais = atividades da turma + atividades de crédito variável (vindas
  // do Centro de Avaliações, ligadas por ID estável). A média já agrupa as <10.
  const columns = useMemo(
    () => orderGradeActivities([...orderedActivities, ...creditData.defs]),
    [orderedActivities, creditData.defs],
  );
  const creditIdSet = useMemo(() => new Set(creditData.defs.map((d) => d.id as string)), [creditData.defs]);
  const firstCreditIdx = useMemo(() => columns.findIndex((a) => creditIdSet.has(actKey(a))), [columns, creditIdSet]);
  const hasCreditData = creditData.defs.length > 0;

  const studentsSig = students.map((s) => s.id).join(',');
  const gradesSig = termGrades.map((g) => `${g.student_id}:${JSON.stringify(g.scores)}:${g.updated_at ?? ''}`).join('|');
  const creditSig = `${[...creditIdSet].join(',')}|${JSON.stringify(creditData.byStudent)}`;
  const gradeByStudent = useMemo(() => new Map(termGrades.map((g) => [g.student_id, g])), [termGrades]);
  const hasSavedGrades = termGrades.length > 0;
  const maxByKey = useMemo(() => new Map(columns.map((a) => [actKey(a), a.max] as const)), [columns]);

  function resetScoresFromSaved() {
    const map: Record<string, Record<string, string>> = {};
    const obsMap: Record<string, string> = {};
    students.forEach((s) => {
      const g = termGrades.find((x) => x.student_id === s.id);
      const row: Record<string, string> = {};
      columns.forEach((a) => {
        const v = g?.scores?.[actKey(a)];
        row[actKey(a)] = v != null ? String(v) : '';
      });
      // Colunas de crédito variável (do Centro de Avaliações, por id): nota de lá quando existir.
      const cv = creditData.byStudent[s.id];
      if (cv) {
        creditIdSet.forEach((id) => {
          if (cv[id] != null) {
            const max = maxByKey.get(id) ?? 0;
            row[id] = String(max > 0 ? Math.min(cv[id], max) : cv[id]);
          }
        });
      }
      map[s.id] = row;
      obsMap[s.id] = g?.observacao ?? '';
    });
    setScores(map);
    setObs(obsMap);
    setSaved(false);
    setEditingGrades(termGrades.length === 0);
  }

  // Preenche inputs com as notas salvas.
  useEffect(() => {
    if (!orgReady || isLoading || gradesLoading) return;
    resetScoresFromSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgReady, isLoading, gradesLoading, studentsSig, gradesSig, creditSig, columns.map(actKey).join(',')]);

  function mediaOf(id: string): number | null {
    const row = scores[id];
    if (!row) return null;
    const nums: Record<string, number> = {};
    let has = false;
    columns.forEach((a) => {
      const k = actKey(a);
      if (row[k] !== '' && row[k] != null) {
        nums[k] = Number(row[k]);
        if (!isRecoveryActivity(a.name)) has = true;
      }
    });
    return has ? calcMedia(nums, columns) : null;
  }

  function setScore(id: string, act: string, raw: string, max: number) {
    if (!editingGrades) return;
    const v = sanitizeGrade(raw, max);
    setScores((p) => ({ ...p, [id]: { ...p[id], [act]: v } }));
    setSaved(false);
  }

  const list = useMemo(() => students.filter((s) => s.full_name.toLowerCase().includes(q.toLowerCase())), [students, q]);

  const save = useMutation({
    mutationFn: () => {
      const rows = students
        .map((s) => {
          const row = scores[s.id] || {};
          const obj: Record<string, number> = {};
          columns.forEach((a) => {
            const k = actKey(a);
            if (row[k] !== '' && row[k] != null) obj[k] = Number(row[k]);
          });
          return { student_id: s.id, scores: obj, observacao: (obs[s.id] ?? '').trim() || null };
        })
        .filter((r) => Object.keys(r.scores).length > 0 || r.observacao);
      return saveTermGrades(classId, year, term, rows);
    },
    onSuccess: () => {
      setSaved(true);
      setEditingGrades(false);
      qc.invalidateQueries({ queryKey: ['term-grades', activeOrgId, classId, year, term] });
      successToast('Notas salvas com sucesso');
    },
  });

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  if (!orgReady) {
    return (
      <>
        <PageHeader title="Notas" subtitle="Carregando organização ativa..." />
        <p className="text-sm font-semibold text-slate-500">Preparando os dados da escola.</p>
      </>
    );
  }

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Notas" subtitle="Notas por trimestre" />
        <EmptyState icon={<Award size={26} />} title="Nenhuma turma" hint="Cadastre turma e alunos para lançar notas." />
      </>
    );
  }

  return (
    <div className="pb-28">
      <PageHeader
        title="Notas"
        subtitle={`${TERM_LABEL[term]} • ${year} • média ${MEDIA_APROVACAO} (recuperação substitui a menor nota quando melhora a média)`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate('/avaliacoes')}>
              <ClipboardList size={18} /> Centro de Avaliações
            </Button>
            <Button onClick={() => setBoletimEscolarOpen(true)}>
              <GraduationCap size={18} /> Boletins escolares
            </Button>
            <Button variant="soft" onClick={() => setBoletimOpen(true)}>
              <FileText size={18} /> Relatório do trimestre
            </Button>
            <Button variant="ghost" onClick={() => setConfigOpen(true)}>
              <Sliders size={18} /> Composição de notas
            </Button>
          </div>
        }
      />

      {/* Filtro rápido por trimestre */}
      <Segmented<number>
        className="mb-4"
        value={term}
        onChange={setTerm}
        options={TERMS.map((t) => ({ value: t, label: TERM_LABEL[t] }))}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
      </div>

      {columns.length === 0 ? (
        <EmptyState
          icon={<Sliders size={26} />}
          title="Configure a composição deste trimestre"
          hint="Defina as atividades e quanto cada uma vale neste trimestre antes de lançar as notas."
          action={<Button onClick={() => setConfigOpen(true)}><Sliders size={18} /> Composição de notas</Button>}
        />
      ) : (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Buscar aluno…" className="mb-3" />

          {isLoading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : gradesIsError ? (
            <EmptyState
              icon={<Award size={26} />}
              title="Não foi possível carregar as notas"
              hint={(gradesError as Error).message}
            />
          ) : gradesLoading ? (
            <p className="text-sm text-slate-500">Carregando notas salvas...</p>
          ) : students.length === 0 ? (
            <EmptyState icon={<Award size={26} />} title="Turma sem alunos" hint="Cadastre alunos nesta turma para lançar notas." />
          ) : (
            <>
              {hasSavedGrades && !editingGrades ? (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  <Lock size={16} className="text-slate-400" />
                  Notas bloqueadas para evitar alterações acidentais. Clique em Editar notas para reabrir.
                </div>
              ) : null}

              {/* Resumo da turma */}
              {(() => {
                const medias = list.map((s) => mediaOf(s.id)).filter((x): x is number => x != null);
                const turma = medias.length ? Math.round((medias.reduce((a, b) => a + b, 0) / medias.length) * 10) / 10 : null;
                const aprov = medias.filter((m) => m >= MEDIA_APROVACAO).length;
                const rec = medias.length - aprov;
                const pct = medias.length ? Math.round((aprov / medias.length) * 100) : 0;
                return (
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                      <p className="text-2xl font-black text-slate-900">{list.length}</p>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Alunos</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                      <p className={cn('text-2xl font-black', turma == null ? 'text-slate-300' : turma >= MEDIA_APROVACAO ? 'text-emerald-700' : 'text-red-600')}>
                        {turma != null ? turma.toFixed(1) : '–'}
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Média da turma</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                      <p className="text-2xl font-black text-emerald-700">{aprov}</p>
                      <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700/70">Aprovados · {pct}%</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-center">
                      <p className="text-2xl font-black text-red-600">{rec}</p>
                      <p className="text-[11px] font-black uppercase tracking-wide text-red-600/70">Em recuperação</p>
                    </div>
                  </div>
                );
              })()}

              <Card className="max-h-[70vh] overflow-auto p-0">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-20 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                  {creditIdSet.size > 0 ? (
                    <>
                      <tr>
                        <th rowSpan={2} className="sticky left-0 top-0 z-30 bg-slate-50 p-3 shadow-[2px_0_0_0_rgba(226,232,240,1)]">Aluno</th>
                        {columns.map((a, idx) => {
                          if (creditIdSet.has(actKey(a))) {
                            if (idx !== firstCreditIdx) return null;
                            return (
                              <th key="credit-group" colSpan={creditIdSet.size} className="border-b border-amber-200 bg-amber-50 px-2 py-2 text-center text-amber-700">
                                Crédito variável <span className="font-bold normal-case text-amber-600">· vale 1 nota</span>
                              </th>
                            );
                          }
                          return (
                            <th key={actKey(a)} rowSpan={2} className="min-w-[92px] px-2 py-3 text-center align-bottom">
                              <span className="block leading-tight text-slate-600">{a.name}</span>
                              <span className="mt-1 inline-block rounded bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-black text-slate-500">0–{a.max}</span>
                              {isRecoveryActivity(a.name) ? <span className="mt-0.5 block text-[9px] font-black text-amber-600">substitui menor</span> : null}
                            </th>
                          );
                        })}
                        <th rowSpan={2} className="px-3 py-3 text-center">Média</th>
                        <th rowSpan={2} className="px-3 py-3 text-center">Situação</th>
                        <th rowSpan={2} className="min-w-[160px] px-3 py-3 text-center">Observações</th>
                        <th rowSpan={2} className="px-3 py-3 text-center">Últ. mov.</th>
                      </tr>
                      <tr>
                        {columns.filter((a) => creditIdSet.has(actKey(a))).map((a) => (
                          <th key={actKey(a)} className="min-w-[92px] bg-amber-50 px-2 py-2 text-center align-bottom">
                            <span className="block leading-tight text-amber-800">{a.name}</span>
                            <span className="mt-1 inline-block rounded bg-amber-200/60 px-1.5 py-0.5 text-[9px] font-black text-amber-700">0–{a.max}</span>
                          </th>
                        ))}
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <th className="sticky left-0 top-0 z-30 bg-slate-50 p-3 shadow-[2px_0_0_0_rgba(226,232,240,1)]">Aluno</th>
                      {columns.map((a) => (
                        <th key={actKey(a)} className="min-w-[92px] px-2 py-3 text-center align-bottom">
                          <span className="block leading-tight text-slate-600">{a.name}</span>
                          <span className="mt-1 inline-block rounded bg-slate-200/70 px-1.5 py-0.5 text-[9px] font-black text-slate-500">0–{a.max}</span>
                          {isRecoveryActivity(a.name) ? <span className="mt-0.5 block text-[9px] font-black text-amber-600">substitui menor</span> : null}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center">Média</th>
                      <th className="px-3 py-3 text-center">Situação</th>
                      <th className="min-w-[160px] px-3 py-3 text-center">Observações</th>
                      <th className="px-3 py-3 text-center">Últ. mov.</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const m = mediaOf(s.id);
                    const launchedAt = gradeByStudent.get(s.id)?.updated_at;
                    const ok = m != null && m >= MEDIA_APROVACAO;
                    return (
                      <tr key={s.id} className="border-t border-slate-100 transition hover:bg-emerald-50/30 even:bg-slate-50/40">
                        <td className="sticky left-0 z-10 bg-inherit p-3 font-bold text-slate-800 shadow-[2px_0_0_0_rgba(241,245,249,1)]">
                          <span className="mr-2 inline-block w-6 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>
                          {s.full_name}
                        </td>
                        {columns.map((a) => {
                          const k = actKey(a);
                          const val = scores[s.id]?.[k] ?? '';
                          const locked = creditIdSet.has(k); // vem do Centro de Avaliações — não editável aqui
                          return (
                            <td key={k} className={cn('px-1.5 py-1.5 text-center', locked && 'bg-amber-50/40')}>
                              <input
                                inputMode="decimal"
                                value={val}
                                onChange={(e) => setScore(s.id, k, e.target.value, a.max)}
                                disabled={!editingGrades || locked}
                                placeholder="–"
                                title={locked ? 'Vem do Centro de Avaliações (crédito variável)' : undefined}
                                className={cn(
                                  'h-10 w-14 rounded-lg border text-center font-bold tabular-nums outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed',
                                  locked
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : Number(val) === 0 && val !== '' ? 'border-red-200 bg-red-50 text-red-600' : val !== '' ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-200 bg-white text-slate-400',
                                  !editingGrades && !locked && 'bg-transparent disabled:bg-transparent',
                                )}
                              />
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center">
                          {m != null ? (
                            <span className={cn('inline-block min-w-[44px] rounded-lg px-2 py-1 text-base font-black tabular-nums', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600')}>
                              {m.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {m == null ? (
                            <span className="text-slate-300">–</span>
                          ) : ok ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-700">Aprovado</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-black uppercase text-red-700">Recuperação</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={obs[s.id] ?? ''}
                            onChange={(e) => {
                              if (!editingGrades) return;
                              setObs((p) => ({ ...p, [s.id]: e.target.value }));
                              setSaved(false);
                            }}
                            disabled={!editingGrades}
                            placeholder={editingGrades ? 'Anotação…' : '–'}
                            className={cn(
                              'h-10 w-full min-w-[150px] rounded-lg border px-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100',
                              editingGrades ? 'border-slate-200 bg-white text-slate-800' : 'border-transparent bg-transparent text-slate-500',
                            )}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {launchedAt ? (
                            <span className="text-[11px] font-bold text-slate-400" title={format(new Date(launchedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}>
                              {format(new Date(launchedAt), 'dd/MM', { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-slate-300">–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </Card>

              <p className="mt-3 text-xs text-slate-400">
                Média final = soma das notas ÷ 3 · aprovação a partir de {MEDIA_APROVACAO.toFixed(1)} · a nota de recuperação substitui a menor quando melhora a média.
              </p>
              {creditIdSet.size > 0 ? (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  As colunas {creditData.defs.map((d) => d.name).join(', ')} vêm do Centro de Avaliações (crédito variável) e juntas contam como uma nota. São preenchidas automaticamente; confira e salve.
                </p>
              ) : null}
            </>
          )}
        </>
      )}

      {students.length > 0 && columns.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:pl-72">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-1 sm:gap-3">
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="truncate text-sm font-bold text-slate-700">
                {saved ? '✓ Notas salvas e bloqueadas' : editingGrades ? 'Edição aberta' : `${TERM_LABEL[term]} • ${year}`}
              </p>
              <p className="truncate text-xs text-slate-400">{editingGrades ? 'Lance as notas e salve para bloquear.' : 'Toque em editar para alterar.'}</p>
            </div>
            {editingGrades ? (
              <>
                {hasSavedGrades ? (
                  <button
                    onClick={resetScoresFromSaved}
                    disabled={save.isPending}
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                ) : null}
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-black text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-none sm:px-8"
                >
                  <Save size={20} />
                  <span className="sm:hidden">{save.isPending ? 'Salvando…' : 'Salvar'}</span>
                  <span className="hidden sm:inline">{save.isPending ? 'Salvando…' : 'Salvar e bloquear'}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setEditingGrades(true);
                  setSaved(false);
                }}
                className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-base font-black text-white transition hover:bg-slate-800 sm:flex-none sm:px-8"
              >
                <Pencil size={20} />
                Editar notas
              </button>
            )}
          </div>
          {save.isError ? <p className="mx-auto mt-2 max-w-5xl px-1 text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        </footer>
      ) : null}

      <ComposicaoModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        term={term}
        year={year}
        initial={activities}
        onSaved={() => qc.invalidateQueries({ queryKey: ['term-config', activeOrgId, year, term] })}
      />

      <BoletimModal
        open={boletimOpen}
        onClose={() => setBoletimOpen(false)}
        className={classes.find((c) => c.id === classId)?.name ?? 'Turma'}
        schoolId={classes.find((c) => c.id === classId)?.school_id ?? ''}
        term={term}
        year={year}
        activities={columns}
        rows={list.map((s) => ({
          name: s.full_name,
          scores: Object.fromEntries(columns.map((a) => [a.name, scores[s.id]?.[actKey(a)] ?? ''])),
          media: mediaOf(s.id),
          obs: obs[s.id] ?? '',
        }))}
      />

      <BoletimEscolarModal
        open={boletimEscolarOpen}
        onClose={() => setBoletimEscolarOpen(false)}
        classId={classId}
        schoolId={classes.find((c) => c.id === classId)?.school_id ?? ''}
        className={classes.find((c) => c.id === classId)?.name ?? 'Turma'}
        year={year}
      />
    </div>
  );
}

type BoletimRow = { name: string; scores: Record<string, string>; media: number | null; obs: string };

/** Gerador de boletins escolares: um boletim por aluno, com os 3 trimestres,
 *  média final e situação — um por página, pronto para imprimir/baixar. */
function BoletimEscolarModal({
  open,
  onClose,
  classId,
  schoolId,
  className,
  year,
}: {
  open: boolean;
  onClose: () => void;
  classId: string;
  schoolId: string;
  className: string;
  year: number;
}) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['boletim-anual', classId, year],
    queryFn: () => reportTerms(classId, year),
    enabled: open && !!classId,
    retry: false,
  });
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools, enabled: open });
  const school = schools.find((s) => s.id === schoolId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setSelected(new Set(rows.map((r) => r.student_id)));
  }, [open, rows]);

  const allOn = rows.length > 0 && selected.size === rows.length;
  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function sit(m: number | null): { txt: string; cls: string } {
    if (m == null) return { txt: '—', cls: '' };
    return m >= MEDIA_APROVACAO ? { txt: 'Aprovado', cls: 'ok' } : { txt: 'Recuperação', cls: 'fail' };
  }

  function boletimHtml(r: TermsReportRow, last: boolean): string {
    const linhas = TERMS.map((t) => {
      const m = r.terms[t - 1] ?? null;
      const s = sit(m);
      return `<tr><td class="name">${escapeHtml(TERM_LABEL[t])}</td><td>${m == null ? '—' : m.toFixed(1)}</td><td><span class="${s.cls}">${s.txt}</span></td></tr>`;
    }).join('');
    const sf = sit(r.final);
    return `<section style="${last ? '' : 'page-break-after: always;'} max-width: 720px; margin: 0 auto;">
      ${schoolHeaderHtml(school, `BOLETIM ESCOLAR — ${year}`)}
      <p style="font-size:13px; margin:0 0 12px;"><strong>Aluno(a):</strong> ${escapeHtml(r.name)} &nbsp;·&nbsp; <strong>Turma:</strong> ${escapeHtml(className)}</p>
      <table><thead><tr><th class="name">Período</th><th>Média</th><th>Situação</th></tr></thead>
      <tbody>${linhas}
        <tr style="background:#f1f5f9; font-weight:800;"><td class="name">Média final</td><td>${r.final == null ? '—' : r.final.toFixed(1)}</td><td><span class="${sf.cls}">${sf.txt}</span></td></tr>
      </tbody></table>
      <p style="font-size:13px; margin:14px 0;"><strong>Resultado final:</strong> <span class="${sf.cls}">${sf.txt}</span> &nbsp; (média de aprovação: ${MEDIA_APROVACAO.toFixed(1)})</p>
      <div style="display:flex; gap:40px; margin-top:46px; font-size:12px; color:#475569;">
        <div style="flex:1; border-top:1px solid #94a3b8; padding-top:6px; text-align:center;">Coordenação</div>
        <div style="flex:1; border-top:1px solid #94a3b8; padding-top:6px; text-align:center;">Responsável</div>
      </div>
    </section>`;
  }

  function gerar() {
    const sel = rows.filter((r) => selected.has(r.student_id));
    if (!sel.length) return;
    const body = sel.map((r, i) => boletimHtml(r, i === sel.length - 1)).join('');
    printDocument(`Boletins — ${className} ${year}`, body);
  }

  return (
    <Modal open={open} onClose={onClose} title="Boletins escolares" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Gera um boletim por aluno ({className} · {year}) com os 3 trimestres, média final e situação — um por página, pronto para imprimir ou salvar em PDF.
        </p>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate-400">Carregando notas do ano…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nenhuma nota lançada nesta turma em {year}.</p>
        ) : (
          <>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.student_id)))} className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
              Selecionar todos ({rows.length})
            </label>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {rows.map((r) => (
                <label key={r.student_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50">
                  <input type="checkbox" checked={selected.has(r.student_id)} onChange={() => toggle(r.student_id)} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="flex-1 font-bold text-slate-800">{r.name}</span>
                  <span className={cn('text-xs font-black', r.final == null ? 'text-slate-300' : r.final >= MEDIA_APROVACAO ? 'text-emerald-600' : 'text-red-600')}>
                    {r.final == null ? '–' : r.final.toFixed(1)}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
              <Button onClick={gerar} disabled={selected.size === 0}>
                <Printer size={16} /> Gerar {selected.size} boletim(ns)
              </Button>
            </div>
            <p className="text-xs text-slate-400">Para PDF: na caixa de impressão escolha "Salvar como PDF".</p>
          </>
        )}
      </div>
    </Modal>
  );
}

function BoletimModal({
  open,
  onClose,
  className,
  schoolId,
  term,
  year,
  activities,
  rows,
}: {
  open: boolean;
  onClose: () => void;
  className: string;
  schoolId: string;
  term: number;
  year: number;
  activities: GradeActivity[];
  rows: BoletimRow[];
}) {
  const [mode, setMode] = useState<'completo' | 'resumido'>('completo');
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools, enabled: open });
  const school = schools.find((s) => s.id === schoolId);
  const titulo = `Relatório — ${className}`;
  const sub = `${TERM_LABEL[term]} • ${year} • aprovação a partir de ${MEDIA_APROVACAO.toFixed(1)}`;

  function situacao(m: number | null): 'Aprovado' | 'Recuperação' | '–' {
    if (m == null) return '–';
    return m >= MEDIA_APROVACAO ? 'Aprovado' : 'Recuperação';
  }

  function buildHtml(): string {
    const cols =
      mode === 'completo'
        ? ['#', 'Aluno', ...activities.map((a) => `${a.name} (0–${a.max})`), 'Média', 'Situação', 'Observações']
        : ['#', 'Aluno', 'Média', 'Situação'];
    const head = `<tr>${cols.map((c, i) => `<th class="${i === 1 ? 'name' : ''}">${escapeHtml(c)}</th>`).join('')}</tr>`;
    const body = rows
      .map((r, i) => {
        const m = r.media;
        const mediaCell = m == null ? '–' : `<span class="${m >= MEDIA_APROVACAO ? 'ok' : 'fail'}">${m.toFixed(1)}</span>`;
        const sit = situacao(m);
        const sitCell = sit === '–' ? '–' : `<span class="${sit === 'Aprovado' ? 'ok' : 'fail'}">${sit}</span>`;
        if (mode === 'resumido') {
          return `<tr><td>${i + 1}</td><td class="name">${escapeHtml(r.name)}</td><td>${mediaCell}</td><td>${sitCell}</td></tr>`;
        }
        const acts = activities
          .map((a) => {
            const v = r.scores[a.name];
            if (v === '' || v == null) return '<td>–</td>';
            return `<td class="${Number(v) === 0 ? 'zero' : ''}">${escapeHtml(v)}</td>`;
          })
          .join('');
        return `<tr><td>${i + 1}</td><td class="name">${escapeHtml(r.name)}</td>${acts}<td>${mediaCell}</td><td>${sitCell}</td><td class="name">${escapeHtml(r.obs)}</td></tr>`;
      })
      .join('');
    return `${schoolHeaderHtml(school, `RELATÓRIO DE NOTAS — ${TERM_LABEL[term]} / ${year}`)}
      <p style="font-size:13px; margin:0 0 12px;"><strong>Turma:</strong> ${escapeHtml(className)} &nbsp;·&nbsp; ${rows.length} aluno(s) &nbsp;·&nbsp; ${mode === 'completo' ? 'Completo' : 'Resumido'}</p>
      <table><thead>${head}</thead><tbody>${body}</tbody></table>
      <p class="foot">${escapeHtml(sub)}</p>`;
  }

  function shareText(): string {
    const linhas = rows.map((r, i) => `${i + 1}. ${r.name} — ${r.media == null ? 's/ nota' : `média ${r.media.toFixed(1)} (${situacao(r.media)})`}`);
    return `*${titulo}*\n${sub}\n\n${linhas.join('\n')}`;
  }

  return (
    <Modal open={open} onClose={onClose} title="Boletim / Relatório" size="xl">
      <div className="space-y-4">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {(['completo', 'resumido'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn('rounded-lg px-4 py-2 text-sm font-bold capitalize transition', mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-sm text-slate-500">
          {mode === 'completo' ? 'Todas as notas, média, situação e observações.' : 'Apenas média e situação por aluno.'} {rows.length} aluno(s) na turma {className}.
        </p>

        {rows.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Sem alunos para gerar o boletim.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => printDocument(titulo, buildHtml())}>
                <Printer size={16} /> Imprimir
              </Button>
              <Button variant="soft" onClick={() => printDocument(titulo, buildHtml())}>
                <FileText size={16} /> Baixar PDF
              </Button>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">Enviar resumo</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, '_blank', 'noopener')}
                >
                  <Share2 size={16} /> WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    window.location.href = `mailto:?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(shareText())}`;
                  }}
                >
                  <Share2 size={16} /> E-mail
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-400">Para baixar em PDF, use Imprimir e escolha "Salvar como PDF".</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function ComposicaoModal({
  open,
  onClose,
  term,
  year,
  initial,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  term: number;
  year: number;
  initial: GradeActivity[];
  onSaved: () => void;
}) {
  const [items, setItems] = useState<GradeActivity[]>([]);
  const cloneEnabled = term > 1;

  useEffect(() => {
    if (open) setItems(orderGradeActivities(initial.length ? initial.map((a) => ({ ...a })) : DEFAULT_ACTIVITIES.map((a) => ({ ...a }))));
  }, [open, initial]);

  const clone = useMutation({
    mutationFn: async (sourceTerm?: number) => {
      const sourceTerms = sourceTerm ? [sourceTerm] : Array.from({ length: term - 1 }, (_, i) => term - 1 - i);
      for (const candidate of sourceTerms) {
        const previous = await getSavedTermConfig(year, candidate);
        if (previous.length) return { sourceTerm: candidate, previous };
      }
      throw new Error(sourceTerm ? `${TERM_LABEL[sourceTerm]} ainda não tem composição salva.` : 'Nenhuma composição salva em trimestre anterior.');
    },
    onSuccess: ({ sourceTerm, previous }) => {
      setItems(orderGradeActivities(previous.map((a) => ({ ...a }))));
      successToast(`Composição clonada do ${TERM_LABEL[sourceTerm]}`);
    },
  });

  const save = useMutation({
    mutationFn: () =>
      saveTermConfig(
        year,
        term,
        orderGradeActivities(items.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), max: Number(a.max) || 0 }))),
      ),
    onSuccess: () => {
      onSaved();
      onClose();
      successToast('Composição salva com sucesso');
    },
  });

  return (
    <Modal open={open} onClose={onClose} title={`Composição — ${TERM_LABEL[term]} / ${year}`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Defina as atividades e quanto cada uma vale neste trimestre. A nota {RECOVERY_ACTIVITY_NAME} é coringa: substitui a menor nota do aluno somente quando for maior.
        </p>

        <div className="grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm sm:grid-cols-3">
          <div>
            <p className="font-black text-emerald-900">Atividades</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Cada rótulo vira uma coluna de nota. O campo valor define o máximo permitido naquela atividade.
            </p>
          </div>
          <div>
            <p className="font-black text-emerald-900">Média</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              O sistema soma as notas válidas e divide por 3, mantendo a regra atual da escola.
            </p>
          </div>
          <div>
            <p className="font-black text-emerald-900">{RECOVERY_ACTIVITY_NAME}</p>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Não soma como nota extra. Ela troca a menor nota somente se a recuperação for maior.
            </p>
          </div>
          <p className="rounded-lg bg-white/80 p-2 text-xs font-bold text-slate-600 sm:col-span-3">
            Exemplo: notas 8, 6 e 5 com recuperação 7 viram 8, 6 e 7. Se a recuperação for 4, nada muda.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-800">Reaproveitar composição</p>
              <p className="text-xs font-semibold text-slate-500">
                Clone o descritivo e os valores do trimestre anterior salvo para evitar redigitar tudo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cloneEnabled ? (
                Array.from({ length: term - 1 }, (_, i) => i + 1).map((sourceTerm) => (
                  <Button key={sourceTerm} variant="soft" onClick={() => clone.mutate(sourceTerm)} disabled={clone.isPending}>
                    {clone.isPending ? 'Clonando…' : `Clonar ${TERM_LABEL[sourceTerm]}`}
                  </Button>
                ))
              ) : (
                <Button variant="soft" disabled>Sem trimestre anterior</Button>
              )}
            </div>
          </div>
          {clone.isError ? <p className="mt-2 text-xs font-semibold text-red-600">{(clone.error as Error).message}</p> : null}
        </div>

        <div className="space-y-3">
          {items.map((a, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center gap-2">
                <Input
                  value={a.name}
                  onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder="Nome da atividade"
                  className="flex-1"
                  disabled={isRecoveryActivity(a.name)}
                />
                <Input
                  value={String(a.max)}
                  onChange={(e) =>
                    setItems((p) => p.map((x, j) => (j === i ? { ...x, max: Number(e.target.value.replace(/[^0-9.]/g, '')) || 0 } : x)))
                  }
                  inputMode="decimal"
                  className="w-20 text-center"
                  placeholder="Valor"
                />
                <button
                  onClick={() => setItems((p) => p.filter((_, j) => j !== i))}
                  disabled={isRecoveryActivity(a.name)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  aria-label="Remover"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Button variant="ghost" onClick={() => setItems((p) => [...p, { name: '', max: 0 }])}>
          <Plus size={18} /> Adicionar atividade
        </Button>

        {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar composição'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
