import { Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ClassRoom, School, Student, Subject } from '../types';
import {
  ClassForm,
  deleteRegistry,
  getRegistryData,
  listClasses,
  listSchools,
  RegistryForm,
  RegistryKind,
  saveRegistry,
  SchoolForm,
  StudentForm,
  SubjectForm,
} from '../services/registryStore';

type RegistryItem = School | ClassRoom | Student | Subject;

const config = {
  school: { title: 'Cadastro de escolas', action: 'Nova escola', empty: 'Nenhuma escola cadastrada.' },
  class: { title: 'Cadastro de turmas', action: 'Nova turma', empty: 'Nenhuma turma cadastrada.' },
  student: { title: 'Cadastro de alunos', action: 'Novo aluno', empty: 'Nenhum aluno cadastrado.' },
  subject: { title: 'Cadastro de disciplinas', action: 'Nova disciplina', empty: 'Nenhuma disciplina cadastrada.' },
} satisfies Record<RegistryKind, { title: string; action: string; empty: string }>;

const blankForms = {
  school: { name: '', city: '' },
  class: { name: '', shift: 'Matutino', schoolId: '' },
  student: { name: '', registration: '', classId: '', guardian: '', phone: '' },
  subject: { name: '', teacherId: '' },
} satisfies Record<RegistryKind, RegistryForm>;

export function RegistryPage({ kind }: { kind: RegistryKind }) {
  const [items, setItems] = useState<RegistryItem[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [editing, setEditing] = useState<RegistryItem | null>(null);
  const [form, setForm] = useState<RegistryForm>(blankForms[kind]);
  const [open, setOpen] = useState(false);

  const copy = config[kind];

  async function refresh() {
    const [data, schoolRows, classRows] = await Promise.all([getRegistryData(kind), listSchools(), listClasses()]);
    setItems(data);
    setSchools(schoolRows);
    setClasses(classRows);
  }

  useEffect(() => {
    setForm(blankForms[kind]);
    setEditing(null);
    setOpen(false);
    refresh();
  }, [kind]);

  const titleById = useMemo(() => {
    return {
      schools: Object.fromEntries(schools.map((school) => [school.id, school.name])),
      classes: Object.fromEntries(classes.map((classRoom) => [classRoom.id, classRoom.name])),
    };
  }, [schools, classes]);

  function startCreate() {
    setEditing(null);
    setForm(defaultForm(kind, schools, classes));
    setOpen(true);
  }

  function startEdit(item: RegistryItem) {
    setEditing(item);
    setForm(itemToForm(kind, item));
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveRegistry(kind, form, editing?.id);
    await refresh();
    setOpen(false);
    setEditing(null);
  }

  async function handleDelete(item: RegistryItem) {
    const label = displayName(item);
    const confirmed = window.confirm(`Excluir "${label}"? Essa ação também remove vínculos dependentes.`);
    if (!confirmed) return;
    await deleteRegistry(kind, item.id);
    await refresh();
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:py-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-emerald-600">Cadastros</p>
          <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white sm:text-3xl">{copy.title}</h2>
          <p className="mt-2 text-sm font-medium text-slate-500">Crie, edite e exclua registros com persistência local e fila de sincronização.</p>
        </div>
        <button onClick={startCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white shadow-soft">
          <Plus size={18} />
          {copy.action}
        </button>
      </section>

      {open ? (
        <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 md:grid-cols-2">
            <Fields kind={kind} form={form} setForm={setForm} schools={schools} classes={classes} />
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">
              Cancelar
            </button>
            <button type="submit" className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">
              {editing ? 'Salvar alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
        {items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-black text-slate-950 dark:text-white">{copy.empty}</p>
            <button onClick={startCreate} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-black text-white">
              <Plus size={18} />
              {copy.action}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-950">
                <tr>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Detalhe</th>
                  <th className="px-4 py-3">Vínculo</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-4 font-bold text-slate-950 dark:text-white">{displayName(item)}</td>
                    <td className="px-4 py-4 text-slate-500">{detail(kind, item)}</td>
                    <td className="px-4 py-4 text-slate-500">{relation(kind, item, titleById)}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(item)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700" aria-label="Editar">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDelete(item)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-700" aria-label="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Fields({
  kind,
  form,
  setForm,
  schools,
  classes,
}: {
  kind: RegistryKind;
  form: RegistryForm;
  setForm: (form: RegistryForm) => void;
  schools: School[];
  classes: ClassRoom[];
}) {
  if (kind === 'school') {
    const data = form as SchoolForm;
    return (
      <>
        <Input label="Nome da escola" value={data.name} onChange={(name) => setForm({ ...data, name })} required />
        <Input label="Cidade / bairro" value={data.city} onChange={(city) => setForm({ ...data, city })} />
      </>
    );
  }

  if (kind === 'class') {
    const data = form as ClassForm;
    return (
      <>
        <Input label="Nome da turma" value={data.name} onChange={(name) => setForm({ ...data, name })} required />
        <Input label="Turno" value={data.shift} onChange={(shift) => setForm({ ...data, shift })} required />
        <Select label="Escola" value={data.schoolId} onChange={(schoolId) => setForm({ ...data, schoolId })} options={schools.map((school) => ({ value: school.id, label: school.name }))} required />
      </>
    );
  }

  if (kind === 'student') {
    const data = form as StudentForm;
    return (
      <>
        <Input label="Nome do aluno" value={data.name} onChange={(name) => setForm({ ...data, name })} required />
        <Input label="Matrícula" value={data.registration} onChange={(registration) => setForm({ ...data, registration })} required />
        <Select label="Turma" value={data.classId} onChange={(classId) => setForm({ ...data, classId })} options={classes.map((classRoom) => ({ value: classRoom.id, label: classRoom.name }))} required />
        <Input label="Responsável" value={data.guardian} onChange={(guardian) => setForm({ ...data, guardian })} />
        <Input label="Telefone" value={data.phone} onChange={(phone) => setForm({ ...data, phone })} />
      </>
    );
  }

  const data = form as SubjectForm;
  return (
    <>
      <Input label="Nome da disciplina" value={data.name} onChange={(name) => setForm({ ...data, name })} required />
      <Input label="Professor" value={data.teacherId} onChange={(teacherId) => setForm({ ...data, teacherId })} />
    </>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-950 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
    </label>
  );
}

function Select({ label, value, onChange, options, required }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-950 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function defaultForm(kind: RegistryKind, schools: School[], classes: ClassRoom[]): RegistryForm {
  if (kind === 'class') return { ...blankForms.class, schoolId: schools[0]?.id ?? '' };
  if (kind === 'student') return { ...blankForms.student, classId: classes[0]?.id ?? '' };
  return blankForms[kind];
}

function itemToForm(kind: RegistryKind, item: RegistryItem): RegistryForm {
  if (kind === 'school') {
    const school = item as School;
    return { name: school.name, city: school.city ?? '' };
  }
  if (kind === 'class') {
    const classRoom = item as ClassRoom;
    return { name: classRoom.name, shift: classRoom.shift, schoolId: classRoom.schoolId };
  }
  if (kind === 'student') {
    const student = item as Student;
    return { name: student.name, registration: student.registration, classId: student.classId, guardian: student.guardian ?? '', phone: student.phone ?? '' };
  }
  const subject = item as Subject;
  return { name: subject.name, teacherId: subject.teacherId ?? '' };
}

function displayName(item: RegistryItem) {
  return 'name' in item ? item.name : '';
}

function detail(kind: RegistryKind, item: RegistryItem) {
  if (kind === 'school') return (item as School).city || 'Sem cidade';
  if (kind === 'class') return (item as ClassRoom).shift;
  if (kind === 'student') return `Matrícula ${(item as Student).registration}`;
  return (item as Subject).teacherId || 'Sem professor vinculado';
}

function relation(kind: RegistryKind, item: RegistryItem, titleById: { schools: Record<string, string>; classes: Record<string, string> }) {
  if (kind === 'class') return titleById.schools[(item as ClassRoom).schoolId] ?? 'Escola não encontrada';
  if (kind === 'student') return titleById.classes[(item as Student).classId] ?? 'Turma não encontrada';
  return '-';
}
