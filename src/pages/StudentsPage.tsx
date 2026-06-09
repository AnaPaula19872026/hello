import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Pencil, Phone, Search, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImportModal } from '../components/ImportModal';
import { AddButton, Button, Card, CheckBox, EmptyState, Field, Input, Modal, PageHeader, Select, SelectionBar } from '../components/ui';
import { bulkDeleteStudents, bulkInsertStudents, deleteStudent, listClasses, listStudents, saveStudent } from '../lib/queries';
import type { ColumnDef } from '../lib/importSheet';
import type { Student } from '../lib/types';
import { useSelection } from '../lib/useSelection';

const IMPORT_COLUMNS: ColumnDef[] = [
  { key: 'full_name', label: 'Nome', example: 'Maria de Souza', required: true },
  { key: 'registration', label: 'Matrícula', example: '2026001' },
  { key: 'guardian_name', label: 'Responsável', example: 'João de Souza' },
  { key: 'guardian_phone', label: 'Telefone', example: '(62) 90000-0000' },
];

export function StudentsPage() {
  const qc = useQueryClient();
  const { data: students = [], isLoading } = useQuery({ queryKey: ['students'], queryFn: listStudents });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const [editing, setEditing] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importClass, setImportClass] = useState('');
  const [q, setQ] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  const save = useMutation({
    mutationFn: saveStudent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: deleteStudent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['students'] }),
  });
  const sel = useSelection();
  const bulkRemove = useMutation({
    mutationFn: () => bulkDeleteStudents([...sel.ids]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] });
      sel.clear();
    },
  });

  const className = (id: string | null) => classes.find((c) => c.id === id)?.name ?? 'Sem turma';

  const list = useMemo(
    () =>
      students
        .filter((s) => s.full_name.toLowerCase().includes(q.toLowerCase()))
        .filter((s) => classFilter === 'all' || s.class_id === classFilter),
    [students, q, classFilter],
  );

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(s: Student) {
    setEditing(s);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const classId = String(f.get('class_id') || '');
    const school_id = classes.find((c) => c.id === classId)?.school_id;
    if (!school_id) return;
    save.mutate({
      id: editing?.id,
      full_name: String(f.get('full_name') || '').trim(),
      class_id: classId,
      school_id,
      registration: String(f.get('registration') || '').trim() || null,
      guardian_name: String(f.get('guardian_name') || '').trim() || null,
      guardian_phone: String(f.get('guardian_phone') || '').trim() || null,
    });
  }

  return (
    <>
      <PageHeader
        title="Alunos"
        subtitle={`${students.length} aluno(s) cadastrado(s).`}
        action={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setImportClass(classes[0]?.id ?? '');
                setImportOpen(true);
              }}
            >
              <FileSpreadsheet size={18} /> Importar
            </Button>
            <AddButton onClick={openNew} label="Novo aluno" />
          </div>
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="Cadastre uma turma primeiro"
          hint="Os alunos precisam estar em uma turma."
          action={
            <Link to="/turmas">
              <Button>Cadastrar turma</Button>
            </Link>
          }
        />
      ) : (
        <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar aluno…" className="w-full bg-transparent text-sm outline-none" />
        </label>
        <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:w-56">
          <option value="all">Todas as turmas</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="Nenhum aluno"
          hint="Cadastre alunos para fazer as chamadas."
          action={<AddButton onClick={openNew} label="Novo aluno" />}
        />
      ) : (
        <div className="space-y-2">
          <SelectionBar count={sel.size} onClear={sel.clear} onDelete={() => confirm(`Excluir ${sel.size} aluno(s)?`) && bulkRemove.mutate()} busy={bulkRemove.isPending} />
          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm font-bold text-slate-500">
            <CheckBox checked={list.length > 0 && list.every((s) => sel.has(s.id))} onChange={() => (list.every((s) => sel.has(s.id)) ? sel.clear() : sel.setAll(list.map((s) => s.id)))} />
            Selecionar todos ({list.length})
          </label>
          {list.map((s) => (
            <Card key={s.id} className="flex items-center justify-between gap-3 p-4">
              <CheckBox checked={sel.has(s.id)} onChange={() => sel.toggle(s.id)} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-bold text-slate-900">{s.full_name}</h3>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-emerald-700">{className(s.class_id)}</span>
                  {s.registration ? <span>Mat. {s.registration}</span> : null}
                  {s.guardian_phone ? (
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {s.guardian_phone}
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(s)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Editar">
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => confirm(`Excluir o aluno "${s.full_name}"?`) && remove.mutate(s.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar aluno' : 'Novo aluno'}>
        {classes.length === 0 ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium text-slate-600">Cadastre uma turma antes de adicionar alunos.</p>
            <Link to="/turmas">
              <Button onClick={() => setOpen(false)}>Cadastrar turma</Button>
            </Link>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nome completo">
            <Input name="full_name" defaultValue={editing?.full_name} required autoFocus placeholder="Nome do aluno" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Turma">
              <Select name="class_id" defaultValue={editing?.class_id ?? classes[0]?.id} required>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Matrícula">
              <Input name="registration" defaultValue={editing?.registration ?? ''} placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Responsável">
            <Input name="guardian_name" defaultValue={editing?.guardian_name ?? ''} placeholder="Nome do responsável" />
          </Field>
          <Field label="Telefone do responsável">
            <Input name="guardian_phone" defaultValue={editing?.guardian_phone ?? ''} placeholder="(00) 00000-0000" />
          </Field>
          {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
        )}
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar alunos"
        columns={IMPORT_COLUMNS}
        templateFileName="modelo-alunos.xlsx"
        ready={!!importClass}
        notReadyHint={classes.length ? 'Selecione a turma dos alunos.' : 'Cadastre uma turma primeiro.'}
        contextSlot={
          <Field label="Turma dos alunos">
            <Select value={importClass} onChange={(e) => setImportClass(e.target.value)}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        }
        importFn={(rows) => {
          const schoolId = classes.find((c) => c.id === importClass)?.school_id;
          if (!schoolId) throw new Error('Turma inválida.');
          return bulkInsertStudents(
            schoolId,
            importClass,
            rows as { full_name: string; registration?: string; guardian_name?: string; guardian_phone?: string }[],
          );
        }}
        onDone={() => qc.invalidateQueries({ queryKey: ['students'] })}
      />
    </>
  );
}
