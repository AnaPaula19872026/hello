import { Clock, RotateCcw, Save, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { enqueueSync, db } from '../../lib/offlineDb';
import { listStudents } from '../../services/registryStore';
import { useAttendanceStore } from '../../stores/attendanceStore';
import type { AttendanceStatus, Student } from '../../types';

const statusStyle: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  absent: 'bg-red-50 border-red-200 text-red-800',
  late: 'bg-amber-50 border-amber-200 text-amber-800',
  justified: 'bg-sky-50 border-sky-200 text-sky-800',
};

const label: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Atrasado',
  justified: 'Justificado',
};

export function QuickAttendancePage() {
  const { setStudents, records, toggle, mark, repeatPrevious } = useAttendanceStore();
  const [students, setLocalStudents] = useState<Student[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | AttendanceStatus>('all');

  useEffect(() => {
    listStudents().then((rows) => {
      setLocalStudents(rows);
      setStudents(rows);
    });
  }, [setStudents]);

  const list = useMemo(
    () => students.filter((student) => student.name.toLowerCase().includes(q.toLowerCase())).filter((student) => filter === 'all' || records[student.id]?.status === filter),
    [students, q, filter, records],
  );

  const counts = useMemo(
    () =>
      Object.values(records).reduce(
        (acc, record) => ({ ...acc, [record.status]: (acc[record.status] || 0) + 1, reviewed: acc.reviewed + (record.reviewed ? 1 : 0) }),
        { present: 0, absent: 0, late: 0, justified: 0, reviewed: 0 } as Record<AttendanceStatus | 'reviewed', number>,
      ),
    [records],
  );

  const progress = Math.round((counts.reviewed / (students.length || 1)) * 100);

  async function save() {
    if (students.length === 0) {
      alert('Cadastre alunos antes de salvar uma chamada.');
      return;
    }
    const payload = {
      id: `local-${Date.now()}`,
      classId: students[0]?.classId ?? '',
      subjectId: 'manual',
      teacherId: 'me',
      date: new Date().toISOString().slice(0, 10),
      records: Object.values(records),
      synced: false,
      updatedAt: new Date().toISOString(),
    };
    await db.sessions.put(payload);
    await enqueueSync('save_attendance_session', payload);
    alert('Chamada salva localmente. A sincronização ocorrerá automaticamente quando houver internet.');
  }

  async function repeatLastSession() {
    const lastSession = await db.sessions.orderBy('updatedAt').last();
    if (!lastSession) {
      alert('Nenhuma chamada anterior encontrada.');
      return;
    }
    repeatPrevious(lastSession.records);
  }

  if (students.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-2xl font-black text-slate-950 dark:text-white">Nenhum aluno cadastrado</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">Cadastre alunos reais para iniciar e salvar chamadas.</p>
          <Link to="/cadastros/alunos" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">
            Cadastrar alunos
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="pb-28">
      <section className="mx-auto max-w-5xl px-4 py-4">
        <div className="rounded-lg bg-slate-950 p-5 text-white shadow-soft">
          <p className="text-sm text-emerald-300">Chamada manual • {new Date().toLocaleDateString('pt-BR')}</p>
          <h2 className="mt-1 text-2xl font-black">Chamada rápida</h2>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-300">{counts.reviewed} revisados de {students.length} alunos</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <Counter title="Total" value={students.length} />
          <Counter title="Presentes" value={counts.present} />
          <Counter title="Ausentes" value={counts.absent} />
          <Counter title="Atrasos" value={counts.late} />
        </div>

        <div className="sticky top-[73px] z-20 mt-4 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 dark:bg-slate-800">
            <Search size={18} />
            <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Pesquisar aluno rapidamente..." className="w-full bg-transparent outline-none" />
          </label>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(['all', 'present', 'absent', 'late'] as const).map((status) => (
              <button key={status} onClick={() => setFilter(status)} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-bold ${filter === status ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                {status === 'all' ? 'Todos' : label[status]}
              </button>
            ))}
            <button onClick={repeatLastSession} className="ml-auto flex shrink-0 items-center gap-1 rounded-lg bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">
              <RotateCcw size={15} />
              Repetir aula anterior
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {list.map((student) => {
            const record = records[student.id];
            const status = record?.status || 'present';
            return (
              <div key={student.id} className={`grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border p-2 ${statusStyle[status]}`}>
                <button onClick={() => toggle(student.id)} className="min-h-16 rounded-lg px-3 text-left active:scale-[.99]">
                  <strong className="block text-lg">{student.name}</strong>
                  <span className="text-xs opacity-80">Matrícula {student.registration} • {label[status]}</span>
                </button>
                <button onClick={() => mark(student.id, 'late')} className="grid h-14 w-14 place-items-center rounded-lg bg-white/70" aria-label="Marcar atraso">
                  <Clock size={22} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-5xl gap-2">
          <button onClick={() => students.forEach((student) => mark(student.id, 'present'))} className="rounded-lg bg-slate-100 px-4 py-4 font-bold text-slate-700 dark:bg-slate-800 dark:text-white">
            Todos presentes
          </button>
          <button onClick={save} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-4 text-lg font-black text-white">
            <Save size={20} />
            Salvar chamada
          </button>
        </div>
      </footer>
    </main>
  );
}

function Counter({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm dark:bg-slate-900">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <strong className="text-xl font-black text-slate-900 dark:text-white">{value}</strong>
    </div>
  );
}
