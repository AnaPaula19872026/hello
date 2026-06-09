import { Building2, GraduationCap, Plus, School, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { classes, schools, subjects } from '../services/mockData';

export function SelectSchoolPage() {
  return (
    <Picker
      title="Selecione a escola"
      description="Escolha a unidade para iniciar uma chamada ou cadastre uma nova escola."
      action={{ label: 'Cadastrar escola', to: '/cadastros/escolas' }}
      icon={<Building2 size={18} />}
      items={schools.map((school) => ({ id: school.id, title: school.name, sub: school.city || 'Escola ativa', to: '/turmas' }))}
    />
  );
}

export function SelectClassPage() {
  return (
    <Picker
      title="Selecione a turma"
      description="Avance para a aula correta ou organize novas turmas por escola e turno."
      action={{ label: 'Cadastrar turma', to: '/cadastros/turmas' }}
      icon={<GraduationCap size={18} />}
      items={classes.map((classRoom) => ({
        id: classRoom.id,
        title: classRoom.name,
        sub: `${classRoom.shift} - ${classRoom.studentsCount} alunos`,
        to: '/aulas',
      }))}
    />
  );
}

export function SelectLessonPage() {
  return (
    <Picker
      title="Selecione a aula"
      description="Abra a chamada rápida para registrar presenças sem perder tempo."
      action={{ label: 'Ver planejamento', to: '/planejamento-semanal' }}
      icon={<School size={18} />}
      items={subjects.map((subject) => ({
        id: subject.id,
        title: subject.name,
        sub: 'Toque para abrir a chamada rápida',
        to: '/chamada',
      }))}
    />
  );
}

function Picker({
  title,
  description,
  action,
  icon,
  items,
}: {
  title: string;
  description: string;
  action: { label: string; to: string };
  icon: ReactNode;
  items: { id: string; title: string; sub: string; to: string }[];
}) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:py-8">
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-emerald-600">Chamada</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-xl text-sm font-medium text-slate-500 sm:text-base">{description}</p>
        </div>
        <Link
          to={action.to}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-soft"
        >
          <Plus size={18} />
          {action.label}
        </Link>
      </section>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            className="flex min-h-24 items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition active:scale-[.99] dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              {icon}
            </span>
            <span>
              <strong className="text-lg text-slate-950 dark:text-white">{item.title}</strong>
              <span className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-500">
                <Users size={14} />
                {item.sub}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
