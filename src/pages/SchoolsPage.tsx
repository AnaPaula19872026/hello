import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { AddButton, Button, Card, EmptyState, Field, Input, Modal, PageHeader } from '../components/ui';
import { deleteSchool, listSchools, saveSchool } from '../lib/queries';
import type { School } from '../lib/types';

export function SchoolsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['schools'], queryFn: listSchools });
  const [editing, setEditing] = useState<School | null>(null);
  const [open, setOpen] = useState(false);

  const save = useMutation({
    mutationFn: saveSchool,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: deleteSchool,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schools'] }),
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(s: School) {
    setEditing(s);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      id: editing?.id,
      name: String(f.get('name') || '').trim(),
      city: String(f.get('city') || '').trim() || null,
    });
  }

  return (
    <>
      <PageHeader
        title="Escolas"
        subtitle="Unidades onde você faz as chamadas."
        action={<AddButton onClick={openNew} label="Nova escola" />}
      />

      {isLoading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Building2 size={26} />}
          title="Nenhuma escola"
          hint="Cadastre a primeira escola para começar."
          action={<AddButton onClick={openNew} label="Nova escola" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.map((s) => (
            <Card key={s.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-slate-900">{s.name}</h3>
                {s.city ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin size={14} /> {s.city}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(s)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200" aria-label="Editar">
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => confirm(`Excluir "${s.name}"? Turmas e alunos vinculados também serão removidos.`) && remove.mutate(s.id)}
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar escola' : 'Nova escola'}>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nome da escola">
            <Input name="name" defaultValue={editing?.name} required autoFocus placeholder="Ex.: E.M. João da Silva" />
          </Field>
          <Field label="Cidade">
            <Input name="city" defaultValue={editing?.city ?? ''} placeholder="Ex.: Goiânia" />
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
      </Modal>
    </>
  );
}
