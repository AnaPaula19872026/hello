import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, GraduationCap, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImportModal } from '../components/ImportModal';
import { AddButton, Button, Card, CheckBox, EmptyState, Field, Input, Modal, PageHeader, Select, SelectionBar } from '../components/ui';
import { bulkDeleteClasses, bulkInsertClasses, deleteClass, listClasses, listSchools, saveClass } from '../lib/queries';
import { useSelection } from '../lib/useSelection';
import type { ColumnDef } from '../lib/importSheet';
import { SHIFTS, type ClassRoom } from '../lib/types';

const IMPORT_COLUMNS: ColumnDef[] = [
  { key: 'name', label: 'Turma', example: '5º ano A', required: true },
  { key: 'shift', label: 'Turno', example: 'Manhã' },
  { key: 'year', label: 'Ano', example: '2026' },
];

export function ClassesPage() {
  const qc = useQueryClient();
  const { data: classes = [], isLoading } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const { data: schools = [] } = useQuery({ queryKey: ['schools'], queryFn: listSchools });
  const [editing, setEditing] = useState<ClassRoom | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importSchool, setImportSchool] = useState('');

  const save = useMutation({
    mutationFn: saveClass,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] }),
  });
  const sel = useSelection();
  const bulkRemove = useMutation({
    mutationFn: () => bulkDeleteClasses([...sel.ids]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes'] });
      sel.clear();
    },
  });

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name ?? '—';

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(c: ClassRoom) {
    setEditing(c);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      id: editing?.id,
      name: String(f.get('name') || '').trim(),
      school_id: String(f.get('school_id') || ''),
      shift: String(f.get('shift') || 'Manhã'),
      year: f.get('year') ? Number(f.get('year')) : null,
    });
  }

  return (
    <>
      <PageHeader
        title="Turmas"
        subtitle="Turmas vinculadas a uma escola."
        action={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setImportSchool(schools[0]?.id ?? '');
                setImportOpen(true);
              }}
            >
              <FileSpreadsheet size={18} /> Importar
            </Button>
            <AddButton onClick={openNew} label="Nova turma" />
          </div>
        }
      />

      {schools.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={26} />}
          title="Cadastre uma escola primeiro"
          hint="As turmas precisam estar vinculadas a uma escola."
          action={
            <Link to="/escolas">
              <Button>Cadastrar escola</Button>
            </Link>
          }
        />
      ) : isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={26} />}
          title="Nenhuma turma"
          hint="Crie a primeira turma para organizar os alunos."
          action={<AddButton onClick={openNew} label="Nova turma" />}
        />
      ) : (
        <>
          <SelectionBar count={sel.size} onClear={sel.clear} onDelete={() => confirm(`Excluir ${sel.size} turma(s)?`) && bulkRemove.mutate()} busy={bulkRemove.isPending} />
          <label className="mb-2 flex cursor-pointer items-center gap-2 px-1 text-sm font-bold text-slate-500">
            <CheckBox checked={classes.length > 0 && classes.every((c) => sel.has(c.id))} onChange={() => (classes.every((c) => sel.has(c.id)) ? sel.clear() : sel.setAll(classes.map((c) => c.id)))} />
            Selecionar todas ({classes.length})
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
          {classes.map((c) => (
            <Card key={c.id} className="flex items-start gap-3">
              <CheckBox checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-black text-slate-900">{c.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{schoolName(c.school_id)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{c.shift}</span>
                  {c.year ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{c.year}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(c)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Editar">
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => confirm(`Excluir a turma "${c.name}"?`) && remove.mutate(c.id)}
                  className="grid h-9 w-9 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </Card>
          ))}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar turma' : 'Nova turma'}>
        {schools.length === 0 ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-medium text-slate-600">Cadastre uma escola antes de criar turmas.</p>
            <Link to="/escolas">
              <Button onClick={() => setOpen(false)}>Cadastrar escola</Button>
            </Link>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nome da turma">
            <Input name="name" defaultValue={editing?.name} required autoFocus placeholder="Ex.: 5º ano A" />
          </Field>
          <Field label="Escola">
            <Select name="school_id" defaultValue={editing?.school_id ?? schools[0]?.id} required>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Turno">
              <Select name="shift" defaultValue={editing?.shift ?? 'Manhã'}>
                {SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ano letivo">
              <Input name="year" type="number" defaultValue={editing?.year ?? new Date().getFullYear()} />
            </Field>
          </div>
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
        title="Importar turmas"
        columns={IMPORT_COLUMNS}
        templateFileName="modelo-turmas.xlsx"
        ready={!!importSchool}
        notReadyHint={schools.length ? 'Selecione a escola das turmas.' : 'Cadastre uma escola primeiro.'}
        contextSlot={
          <Field label="Escola das turmas">
            <Select value={importSchool} onChange={(e) => setImportSchool(e.target.value)}>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        }
        importFn={(rows) => bulkInsertClasses(importSchool, rows as { name: string; shift?: string; year?: string }[])}
        onDone={() => qc.invalidateQueries({ queryKey: ['classes'] })}
      />
    </>
  );
}
