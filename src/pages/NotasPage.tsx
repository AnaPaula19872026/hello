import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Award, Lock, Pencil, Plus, Save, Search, Sliders, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import { usePersistentState } from '../lib/usePersistentState';
import {
  getTermConfig,
  getSavedTermConfig,
  listClasses,
  listStudentsByClass,
  listTermGrades,
  saveTermConfig,
  saveTermGrades,
} from '../lib/queries';
import { DEFAULT_ACTIVITIES, MEDIA_APROVACAO, RECOVERY_ACTIVITY_NAME, TERMS, TERM_LABEL, calcMedia, isRecoveryActivity, orderGradeActivities, type GradeActivity } from '../lib/types';

export function NotasPage() {
  const qc = useQueryClient();
  const { activeOrgId, ctxLoading } = useAuth();
  const now = new Date();
  const [classId, setClassId] = usePersistentState('hello:notas:classId', '');
  const [term, setTerm] = usePersistentState('hello:notas:term', 1);
  const [year, setYear] = usePersistentState('hello:notas:year', now.getFullYear());
  const [q, setQ] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [saved, setSaved] = useState(false);
  const [editingGrades, setEditingGrades] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
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

  const studentsSig = students.map((s) => s.id).join(',');
  const gradesSig = termGrades.map((g) => `${g.student_id}:${JSON.stringify(g.scores)}:${g.updated_at ?? ''}`).join('|');
  const gradeByStudent = useMemo(() => new Map(termGrades.map((g) => [g.student_id, g])), [termGrades]);
  const hasSavedGrades = termGrades.length > 0;

  function resetScoresFromSaved() {
    const map: Record<string, Record<string, string>> = {};
    students.forEach((s) => {
      const g = termGrades.find((x) => x.student_id === s.id);
      const row: Record<string, string> = {};
      orderedActivities.forEach((a) => {
        const v = g?.scores?.[a.name];
        row[a.name] = v != null ? String(v) : '';
      });
      map[s.id] = row;
    });
    setScores(map);
    setSaved(false);
    setEditingGrades(termGrades.length === 0);
  }

  // Preenche inputs com as notas salvas.
  useEffect(() => {
    if (!orgReady || isLoading || gradesLoading) return;
    resetScoresFromSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgReady, isLoading, gradesLoading, studentsSig, gradesSig, orderedActivities.map((a) => a.name).join(',')]);

  function mediaOf(id: string): number | null {
    const row = scores[id];
    if (!row) return null;
    const nums: Record<string, number> = {};
    let has = false;
    orderedActivities.forEach((a) => {
      if (row[a.name] !== '' && row[a.name] != null) {
        nums[a.name] = Number(row[a.name]);
        if (!isRecoveryActivity(a.name)) has = true;
      }
    });
    return has ? calcMedia(nums) : null;
  }

  function setScore(id: string, act: string, raw: string, max: number) {
    if (!editingGrades) return;
    let v = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    if (v !== '' && Number(v) > max) v = String(max);
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
          orderedActivities.forEach((a) => {
            if (row[a.name] !== '' && row[a.name] != null) obj[a.name] = Number(row[a.name]);
          });
          return { student_id: s.id, scores: obj };
        })
        .filter((r) => Object.keys(r.scores).length > 0);
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
          <Button variant="ghost" onClick={() => setConfigOpen(true)}>
            <Sliders size={18} /> Composição de notas
          </Button>
        }
      />

      {/* Filtro rápido por trimestre */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TERMS.map((t) => (
          <button
            key={t}
            onClick={() => setTerm(t)}
            className={cn(
              'rounded-xl px-4 py-2.5 text-sm font-bold transition',
              term === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            )}
          >
            {TERM_LABEL[t]}
          </button>
        ))}
      </div>

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

      {orderedActivities.length === 0 ? (
        <EmptyState
          icon={<Sliders size={26} />}
          title="Configure a composição deste trimestre"
          hint="Defina as atividades e quanto cada uma vale neste trimestre antes de lançar as notas."
          action={<Button onClick={() => setConfigOpen(true)}><Sliders size={18} /> Composição de notas</Button>}
        />
      ) : (
        <>
          <div className="mb-3">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <Search size={18} className="text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno…" className="w-full bg-transparent text-sm outline-none" />
            </label>
          </div>

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

              <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 p-3">Aluno</th>
                    {orderedActivities.map((a) => (
                      <th key={a.name} className="p-2 text-center">
                        {a.name}
                        <span className="block text-[10px] font-bold text-slate-400">0–{a.max}</span>
                        {isRecoveryActivity(a.name) ? <span className="block text-[10px] font-black text-amber-600">substitui menor</span> : null}
                      </th>
                    ))}
                    <th className="p-3 text-center">Média</th>
                    <th className="p-3 text-center">Últ. mov.</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const m = mediaOf(s.id);
                    const launchedAt = gradeByStudent.get(s.id)?.updated_at;
                    return (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="sticky left-0 bg-white p-3 font-bold text-slate-800">
                          <span className="mr-1.5 text-slate-400">{i + 1}.</span>{s.full_name}
                        </td>
                        {orderedActivities.map((a) => (
                          <td key={a.name} className="p-1.5 text-center">
                            <input
                              inputMode="decimal"
                              value={scores[s.id]?.[a.name] ?? ''}
                              onChange={(e) => setScore(s.id, a.name, e.target.value, a.max)}
                              disabled={!editingGrades}
                              placeholder="–"
                              className={cn(
                                'h-10 w-14 rounded-lg border border-slate-200 bg-white text-center font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:shadow-none',
                                !editingGrades && 'border-slate-100',
                              )}
                            />
                          </td>
                        ))}
                        <td className="p-3 text-center">
                          {m != null ? (
                            <span className={cn('text-lg font-black', m >= MEDIA_APROVACAO ? 'text-emerald-700' : 'text-red-600')}>{m.toFixed(1)}</span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {launchedAt ? (
                            <span
                              className="text-[11px] font-bold text-slate-400"
                              title={format(new Date(launchedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            >
                              {format(new Date(launchedAt), 'dd/MM', { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </Card>
            </>
          )}
        </>
      )}

      {students.length > 0 && orderedActivities.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:pl-72">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-1">
            <p className="hidden text-sm font-semibold text-slate-500 sm:block">
              {saved ? '✓ Notas salvas e bloqueadas' : editingGrades ? 'Edição aberta' : `${TERM_LABEL[term]} • ${year}`}
            </p>
            {editingGrades ? (
              <>
                {hasSavedGrades ? (
                  <button
                    onClick={resetScoresFromSaved}
                    disabled={save.isPending}
                    className="hidden rounded-xl border border-slate-200 px-4 py-4 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60 sm:inline-flex"
                  >
                    Cancelar
                  </button>
                ) : null}
                <button
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-base font-black text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-none sm:px-8"
                >
                  <Save size={20} />
                  {save.isPending ? 'Salvando…' : 'Salvar e bloquear'}
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setEditingGrades(true);
                  setSaved(false);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-4 text-base font-black text-white transition hover:bg-slate-800 sm:flex-none sm:px-8"
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
    </div>
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

        <div className="space-y-2">
          {items.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
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
          ))}
        </div>

        <Button variant="ghost" onClick={() => setItems((p) => [...p, { name: '', max: 0 }])}>
          <Plus size={18} /> Adicionar atividade
        </Button>

        {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Salvar composição'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
