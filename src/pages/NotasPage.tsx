import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Plus, Save, Search, Sliders, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { successToast } from '../components/Feedback';
import { cn } from '../lib/cn';
import {
  getTermConfig,
  listClasses,
  listStudentsByClass,
  listTermGrades,
  saveTermConfig,
  saveTermGrades,
} from '../lib/queries';
import { DEFAULT_ACTIVITIES, MEDIA_APROVACAO, TERMS, TERM_LABEL, calcMedia, type GradeActivity } from '../lib/types';

export function NotasPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState(1);
  const [year, setYear] = useState(now.getFullYear());
  const [q, setQ] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [saved, setSaved] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: activities = [] } = useQuery({
    queryKey: ['term-config', year, term],
    queryFn: () => getTermConfig(year, term),
  });

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  });

  const { data: termGrades = [] } = useQuery({
    queryKey: ['term-grades', classId, year, term],
    queryFn: () => listTermGrades(classId, year, term),
    enabled: !!classId,
  });

  const studentsSig = students.map((s) => s.id).join(',');
  const gradesSig = termGrades.map((g) => `${g.student_id}:${JSON.stringify(g.scores)}`).join('|');

  // Preenche inputs com as notas salvas.
  useEffect(() => {
    const map: Record<string, Record<string, string>> = {};
    students.forEach((s) => {
      const g = termGrades.find((x) => x.student_id === s.id);
      const row: Record<string, string> = {};
      activities.forEach((a) => {
        const v = g?.scores?.[a.name];
        row[a.name] = v != null ? String(v) : '';
      });
      map[s.id] = row;
    });
    setScores(map);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsSig, gradesSig, activities.map((a) => a.name).join(',')]);

  function mediaOf(id: string): number | null {
    const row = scores[id];
    if (!row) return null;
    const nums: Record<string, number> = {};
    let has = false;
    activities.forEach((a) => {
      if (row[a.name] !== '' && row[a.name] != null) {
        nums[a.name] = Number(row[a.name]);
        has = true;
      }
    });
    return has ? calcMedia(nums) : null;
  }

  function setScore(id: string, act: string, raw: string, max: number) {
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
          activities.forEach((a) => {
            if (row[a.name] !== '' && row[a.name] != null) obj[a.name] = Number(row[a.name]);
          });
          return { student_id: s.id, scores: obj };
        })
        .filter((r) => Object.keys(r.scores).length > 0);
      return saveTermGrades(classId, year, term, rows);
    },
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['term-grades', classId, year, term] });
      successToast('Notas salvas com sucesso');
    },
  });

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

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
        subtitle={`${TERM_LABEL[term]} • ${year} • média ${MEDIA_APROVACAO} (soma ÷ 3)`}
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

      {activities.length === 0 ? (
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
          ) : students.length === 0 ? (
            <EmptyState icon={<Award size={26} />} title="Turma sem alunos" hint="Cadastre alunos nesta turma para lançar notas." />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-black uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 p-3">Aluno</th>
                    {activities.map((a) => (
                      <th key={a.name} className="p-2 text-center">
                        {a.name}
                        <span className="block text-[10px] font-bold text-slate-400">0–{a.max}</span>
                      </th>
                    ))}
                    <th className="p-3 text-center">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const m = mediaOf(s.id);
                    return (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="sticky left-0 bg-white p-3 font-bold text-slate-800">
                          <span className="mr-1.5 text-slate-400">{i + 1}.</span>{s.full_name}
                        </td>
                        {activities.map((a) => (
                          <td key={a.name} className="p-1.5 text-center">
                            <input
                              inputMode="decimal"
                              value={scores[s.id]?.[a.name] ?? ''}
                              onChange={(e) => setScore(s.id, a.name, e.target.value, a.max)}
                              placeholder="–"
                              className="h-10 w-14 rounded-lg border border-slate-200 bg-white text-center font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      {students.length > 0 && activities.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:pl-72">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-1">
            <p className="hidden text-sm font-semibold text-slate-500 sm:block">{saved ? '✓ Notas salvas' : `${TERM_LABEL[term]} • ${year}`}</p>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-base font-black text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-none sm:px-8"
            >
              <Save size={20} />
              {save.isPending ? 'Salvando…' : saved ? 'Salvar novamente' : 'Salvar notas'}
            </button>
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
        onSaved={() => qc.invalidateQueries({ queryKey: ['term-config', year, term] })}
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

  useEffect(() => {
    if (open) setItems(initial.length ? initial.map((a) => ({ ...a })) : DEFAULT_ACTIVITIES.map((a) => ({ ...a })));
  }, [open, initial]);

  const save = useMutation({
    mutationFn: () =>
      saveTermConfig(
        year,
        term,
        items.filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), max: Number(a.max) || 0 })),
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
          Defina as atividades e quanto cada uma vale neste trimestre. A média é a soma das notas dividida por 3.
        </p>

        <div className="space-y-2">
          {items.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={a.name}
                onChange={(e) => setItems((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Nome da atividade"
                className="flex-1"
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
