import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Check, CheckCheck, ClipboardCheck, Save, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Card, EmptyState, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { getRecords, getSession, listClasses, listStudentsByClass, saveAttendance } from '../lib/queries';
import type { AttendanceStatus } from '../lib/types';

export function AttendancePage() {
  const qc = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });

  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today);
  const [q, setQ] = useState('');
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!classId && classes.length) setClassId(classes[0].id);
  }, [classes, classId]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students-by-class', classId],
    queryFn: () => listStudentsByClass(classId),
    enabled: !!classId,
  });

  // Carrega chamada existente (turma + data) para editar em vez de duplicar.
  const { data: existing } = useQuery({
    queryKey: ['session', classId, date],
    queryFn: async () => {
      const session = await getSession(classId, date);
      if (!session) return { records: [] as { student_id: string; status: AttendanceStatus }[] };
      const recs = await getRecords(session.id);
      return { records: recs.map((r) => ({ student_id: r.student_id, status: r.status })) };
    },
    enabled: !!classId,
  });

  const studentsSig = students.map((s) => s.id).join(',');
  const existingSig = (existing?.records ?? []).map((r) => `${r.student_id}:${r.status}`).join(',');

  // Inicializa: todos presentes, sobrescrevendo com a chamada salva.
  useEffect(() => {
    if (!students.length) {
      setRecords({});
      return;
    }
    const base: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (base[s.id] = 'present'));
    existing?.records.forEach((r) => {
      // qualquer status que não seja presente conta como falta
      if (base[r.student_id] !== undefined) base[r.student_id] = r.status === 'present' ? 'present' : 'absent';
    });
    setRecords(base);
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsSig, existingSig]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    Object.values(records).forEach((s) => (s === 'present' ? present++ : absent++));
    return { present, absent };
  }, [records]);

  const list = useMemo(() => students.filter((s) => s.full_name.toLowerCase().includes(q.toLowerCase())), [students, q]);

  const save = useMutation({
    mutationFn: () =>
      saveAttendance(
        classId,
        date,
        students.map((s) => ({ student_id: s.id, status: records[s.id] ?? 'present', note: null })),
      ),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['session', classId, date] });
      qc.invalidateQueries({ queryKey: ['recent-sessions'] });
    },
  });

  function toggle(id: string) {
    setRecords((prev) => ({ ...prev, [id]: prev[id] === 'absent' ? 'present' : 'absent' }));
    setSaved(false);
  }
  function allPresent() {
    const next: Record<string, AttendanceStatus> = {};
    students.forEach((s) => (next[s.id] = 'present'));
    setRecords(next);
    setSaved(false);
  }

  if (classes.length === 0) {
    return (
      <>
        <PageHeader title="Chamadas" subtitle="Registre presenças e faltas." />
        <EmptyState icon={<ClipboardCheck size={26} />} title="Nenhuma turma" hint="Cadastre escola, turma e alunos para iniciar as chamadas." />
      </>
    );
  }

  return (
    <div className="pb-28">
      <PageHeader title="Chamadas" subtitle="Toque no aluno para marcar falta. As faltas ficam salvas por dia." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-center">
        <Stat label="Presentes" value={counts.present} className="text-emerald-700" />
        <Stat label="Faltas" value={counts.absent} className="text-red-600" />
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno…" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <button onClick={allPresent} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
          <CheckCheck size={18} /> Todos presentes
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando alunos…</p>
      ) : students.length === 0 ? (
        <EmptyState icon={<ClipboardCheck size={26} />} title="Turma sem alunos" hint="Cadastre alunos nesta turma para fazer a chamada." />
      ) : (
        <div className="space-y-2">
          {list.map((s) => {
            const absent = records[s.id] === 'absent';
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition active:scale-[.99]',
                  absent ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50/60',
                )}
              >
                <span className={cn('min-w-0 flex-1 truncate text-base font-bold', absent ? 'text-red-800' : 'text-slate-800')}>
                  {s.full_name}
                </span>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-black text-white',
                    absent ? 'bg-red-600' : 'bg-emerald-600',
                  )}
                >
                  {absent ? <X size={18} /> : <Check size={18} />}
                  {absent ? 'Falta' : 'Presente'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {students.length > 0 ? (
        <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:pl-72">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-1">
            <p className="hidden text-sm font-semibold text-slate-500 sm:block">
              {saved ? '✓ Chamada salva' : `${counts.absent} falta(s) • ${students.length} alunos`}
            </p>
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-4 text-base font-black text-white transition hover:bg-emerald-700 disabled:opacity-60 sm:flex-none sm:px-8"
            >
              <Save size={20} />
              {save.isPending ? 'Salvando…' : saved ? 'Salvar novamente' : 'Salvar chamada'}
            </button>
          </div>
          {save.isError ? <p className="mx-auto mt-2 max-w-5xl px-1 text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        </footer>
      ) : null}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className={cn('text-2xl font-black', className)}>{value}</p>
      <p className="text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}
