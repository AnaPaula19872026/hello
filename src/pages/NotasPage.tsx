import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card, CheckBox, EmptyState, PageHeader, Select, SelectionBar } from '../components/ui';
import { cn } from '../lib/cn';
import { bulkDeleteGrades, listClasses, listGrades, listStudentsByClass, saveGrades } from '../lib/queries';
import { MONTHS, SUBJECT } from '../lib/types';
import { useSelection } from '../lib/useSelection';

export function NotasPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [classId, setClassId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [scores, setScores] = useState<Record<string, string>>({});
  const [q, setQ] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ['grades', classId, year],
    queryFn: () => listGrades(classId, year),
    enabled: !!classId,
  });

  // Assinaturas estáveis: evita loop de render por causa do default `= []` instável.
  const studentsSig = students.map((s) => s.id).join(',');
  const gradesSig = grades.map((g) => `${g.student_id}:${g.month}:${g.score}`).join(',');

  // Preenche os inputs com a nota salva do mês selecionado.
  useEffect(() => {
    const map: Record<string, string> = {};
    students.forEach((s) => {
      const g = grades.find((x) => x.student_id === s.id && x.month === month);
      map[s.id] = g?.score != null ? String(g.score) : '';
    });
    setScores(map);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsSig, gradesSig, month]);

  // Média anual por aluno (notas salvas).
  const media = useMemo(() => {
    const acc: Record<string, { sum: number; n: number }> = {};
    grades.forEach((g) => {
      if (g.score == null) return;
      acc[g.student_id] ??= { sum: 0, n: 0 };
      acc[g.student_id].sum += Number(g.score);
      acc[g.student_id].n += 1;
    });
    const out: Record<string, number | null> = {};
    Object.entries(acc).forEach(([id, v]) => (out[id] = v.n ? v.sum / v.n : null));
    return out;
  }, [grades]);

  const list = useMemo(
    () => students.filter((s) => s.full_name.toLowerCase().includes(q.toLowerCase())),
    [students, q],
  );

  function setScore(id: string, raw: string) {
    let v = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    if (v !== '' && Number(v) > 10) v = '10';
    setScores((p) => ({ ...p, [id]: v }));
    setSaved(false);
  }

  const save = useMutation({
    mutationFn: () =>
      saveGrades(
        classId,
        year,
        month,
        students.map((s) => {
          const raw = scores[s.id];
          return { student_id: s.id, score: raw === '' || raw == null ? null : Number(raw) };
        }),
      ),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['grades', classId, year] });
    },
  });

  const sel = useSelection();
  const bulkRemove = useMutation({
    mutationFn: () => bulkDeleteGrades(classId, year, month, [...sel.ids]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grades', classId, year] });
      sel.clear();
    },
  });

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Notas" subtitle={SUBJECT} />
        <EmptyState icon={<Award size={26} />} title="Nenhuma turma" hint="Cadastre turma e alunos para lançar notas." />
      </>
    );
  }

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="pb-28">
      <PageHeader title="Notas" subtitle={`${SUBJECT} • lançamento mensal (0–10)`} />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

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
        <div className="space-y-2">
          <SelectionBar
            count={sel.size}
            onClear={sel.clear}
            onDelete={() => confirm(`Apagar as notas de ${MONTHS[month - 1]}/${year} de ${sel.size} aluno(s)?`) && bulkRemove.mutate()}
            busy={bulkRemove.isPending}
          />
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm font-bold text-slate-500">
            <CheckBox checked={list.length > 0 && list.every((s) => sel.has(s.id))} onChange={() => (list.every((s) => sel.has(s.id)) ? sel.clear() : sel.setAll(list.map((s) => s.id)))} />
            Selecionar todos ({list.length})
          </label>
          {list.map((s, i) => {
            const m = media[s.id];
            return (
              <Card key={s.id} className="flex items-center justify-between gap-3 p-3">
                <CheckBox checked={sel.has(s.id)} onChange={() => sel.toggle(s.id)} />
                <span className="w-6 shrink-0 text-right text-sm font-bold text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{s.full_name}</p>
                  <p className="text-xs text-slate-500">
                    Média anual:{' '}
                    {m != null ? (
                      <span className={cn('font-black', m >= 6 ? 'text-emerald-700' : 'text-red-600')}>{m.toFixed(1)}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </p>
                </div>
                <input
                  inputMode="decimal"
                  value={scores[s.id] ?? ''}
                  onChange={(e) => setScore(s.id, e.target.value)}
                  placeholder="—"
                  className="h-12 w-20 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </Card>
            );
          })}
        </div>
      )}

      {students.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:pl-72">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-1">
            <p className="hidden text-sm font-semibold text-slate-500 sm:block">
              {saved ? '✓ Notas salvas' : `${MONTHS[month - 1]}/${year}`}
            </p>
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
    </div>
  );
}
