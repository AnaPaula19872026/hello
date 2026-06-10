import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, FileSpreadsheet, ImagePlus, MapPin, Phone, X } from 'lucide-react';
import { useState } from 'react';
import { ImportModal } from '../components/ImportModal';
import { successToast } from '../components/Feedback';
import { ActionsMenu, AddButton, Button, Card, CheckBox, EmptyState, Field, Input, Modal, PageHeader, SelectionBar, SelectModeButton } from '../components/ui';
import { fileToCompressedDataUrl } from '../lib/image';
import { CADASTRO_COLUMNS } from '../lib/importSheet';
import { bulkDeleteSchools, bulkImportAll, importResultToModal, deleteSchool, listSchools, saveSchool } from '../lib/queries';
import type { School } from '../lib/types';
import { useSelection } from '../lib/useSelection';

export function SchoolsPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ['schools'], queryFn: listSchools });
  const [editing, setEditing] = useState<School | null>(null);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState('');

  // Excluir escola cascateia turmas/alunos — atualiza tudo + contadores.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['schools'] });
    qc.invalidateQueries({ queryKey: ['classes'] });
    qc.invalidateQueries({ queryKey: ['students'] });
    qc.invalidateQueries({ queryKey: ['students-by-class'] });
    qc.invalidateQueries({ queryKey: ['recent-sessions'] });
    qc.invalidateQueries({ queryKey: ['counts'] });
  };

  const save = useMutation({
    mutationFn: saveSchool,
    onSuccess: () => {
      refresh();
      setOpen(false);
      successToast(editing ? 'Escola atualizada com sucesso' : 'Escola cadastrada com sucesso');
    },
  });
  const remove = useMutation({
    mutationFn: deleteSchool,
    onSuccess: () => {
      refresh();
      successToast('Escola excluída com sucesso');
    },
  });
  const sel = useSelection();
  const bulkRemove = useMutation({
    mutationFn: () => bulkDeleteSchools([...sel.ids]),
    onSuccess: () => {
      refresh();
      sel.disable();
      successToast('Escolas excluídas com sucesso');
    },
  });
  const allSelected = data.length > 0 && data.every((s) => sel.has(s.id));
  const toggleAll = () => (allSelected ? sel.clear() : sel.setAll(data.map((s) => s.id)));

  function openNew() {
    setEditing(null);
    setLogo(null);
    setLogoErr('');
    setOpen(true);
  }
  function openEdit(s: School) {
    setEditing(s);
    setLogo(s.logo_url ?? null);
    setLogoErr('');
    setOpen(true);
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoErr('');
    try {
      setLogo(await fileToCompressedDataUrl(file));
    } catch (err) {
      setLogoErr((err as Error).message);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    save.mutate({
      id: editing?.id,
      name: String(f.get('name') || '').trim(),
      city: String(f.get('city') || '').trim() || null,
      director: String(f.get('director') || '').trim() || null,
      address: String(f.get('address') || '').trim() || null,
      phone: String(f.get('phone') || '').trim() || null,
      inep: String(f.get('inep') || '').trim() || null,
      logo_url: logo,
    });
  }

  return (
    <>
      <PageHeader
        title="Escolas"
        subtitle="Unidades onde você faz as chamadas."
        action={
          <div className="flex flex-wrap gap-2">
            <SelectModeButton active={sel.active} onEnable={sel.enable} onCancel={sel.disable} />
            <Button variant="ghost" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet size={18} /> Importar
            </Button>
            <AddButton onClick={openNew} label="Nova escola" />
          </div>
        }
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
        <>
          <div className={`grid gap-3 sm:grid-cols-2 ${sel.active ? 'pb-24' : ''}`}>
          {data.map((s) => (
            <Card key={s.id} className="flex items-start gap-3">
              {sel.active ? <CheckBox checked={sel.has(s.id)} onChange={() => sel.toggle(s.id)} /> : null}
              <Logo src={s.logo_url} name={s.name} />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-black text-slate-900">{s.name}</h3>
                {s.director ? <p className="truncate text-sm text-slate-600">Dir.: {s.director}</p> : null}
                {s.city || s.address ? (
                  <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                    <MapPin size={14} /> {[s.address, s.city].filter(Boolean).join(' — ')}
                  </p>
                ) : null}
                {s.phone ? (
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
                    <Phone size={14} /> {s.phone}
                  </p>
                ) : null}
              </div>
              <ActionsMenu
                onEdit={() => openEdit(s)}
                onDelete={() => confirm(`Excluir "${s.name}"? Turmas e alunos vinculados também serão removidos.`) && remove.mutate(s.id)}
              />
            </Card>
          ))}
          </div>
        </>
      )}

      <SelectionBar
        active={sel.active}
        count={sel.size}
        allSelected={allSelected}
        onToggleAll={toggleAll}
        onCancel={sel.disable}
        onDelete={() => confirm(`Excluir ${sel.size} escola(s)? Turmas e alunos vinculados também serão removidos.`) && bulkRemove.mutate()}
        busy={bulkRemove.isPending}
      />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar escola' : 'Nova escola'}>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <Logo src={logo} name={editing?.name ?? ''} size="lg" />
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-100">
                <ImagePlus size={18} /> {logo ? 'Trocar logo' : 'Adicionar logo'}
                <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
              </label>
              {logo ? (
                <button type="button" onClick={() => setLogo(null)} className="ml-2 inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-red-600">
                  <X size={14} /> Remover
                </button>
              ) : null}
              <p className="mt-1 text-xs text-slate-400">PNG/JPG. Fica leve e salva no banco.</p>
              {logoErr ? <p className="mt-1 text-xs font-semibold text-red-600">{logoErr}</p> : null}
            </div>
          </div>

          <Field label="Nome da escola">
            <Input name="name" defaultValue={editing?.name} required autoFocus placeholder="Ex.: E.M. João da Silva" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cidade">
              <Input name="city" defaultValue={editing?.city ?? ''} placeholder="Ex.: Goiânia" />
            </Field>
            <Field label="Código INEP">
              <Input name="inep" defaultValue={editing?.inep ?? ''} placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Endereço">
            <Input name="address" defaultValue={editing?.address ?? ''} placeholder="Rua, nº, bairro" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Diretor(a)">
              <Input name="director" defaultValue={editing?.director ?? ''} placeholder="Nome" />
            </Field>
            <Field label="Telefone">
              <Input name="phone" defaultValue={editing?.phone ?? ''} placeholder="(00) 0000-0000" />
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
      </Modal>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar cadastros"
        columns={CADASTRO_COLUMNS}
        templateFileName="modelo-cadastro.xlsx"
        importFn={(rows) => bulkImportAll(rows).then(importResultToModal)}
        onDone={refresh}
      />
    </>
  );
}

function Logo({ src, name, size = 'md' }: { src?: string | null; name: string; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-14 w-14 text-lg';
  if (src) {
    return <img src={src} alt={name} className={`${dim} shrink-0 rounded-xl border border-slate-200 object-contain bg-white p-1`} />;
  }
  return (
    <div className={`${dim} grid shrink-0 place-items-center rounded-xl bg-slate-100 font-black uppercase text-slate-400`}>
      {name ? name.slice(0, 1) : <Building2 size={22} />}
    </div>
  );
}
