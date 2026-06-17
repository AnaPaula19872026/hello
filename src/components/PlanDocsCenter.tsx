import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Eye, FileText, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { canReviewPlan } from '../lib/permissions';
import { deletePlanDoc, listClasses, listPlanDocs, updatePlanDoc, uploadPlanDoc } from '../lib/queries';
import { downloadAllAttachments, safeFileName, translateStorageError } from '../lib/storage';
import type { ClassRoom, PlanDoc } from '../lib/types';
import { Button, Modal, Select } from './ui';
import { Dropzone } from './Dropzone';
import { PreviewModal } from './Attachments';
import { successToast } from './Feedback';
import { cn } from '../lib/cn';

/** Segmentos da escola — fácil de estender (basta adicionar aqui). */
const SEGMENTS: { key: string; label: string; color: string; soft: string }[] = [
  { key: 'fund1', label: 'Fundamental I', color: '#2563eb', soft: '#eff6ff' },
  { key: 'fund2', label: 'Fundamental II', color: '#7c3aed', soft: '#f5f3ff' },
];
const TERMS = [1, 2, 3];

export function PlanDocsCenter() {
  const { data: docs = [], isLoading, isError, error } = useQuery({ queryKey: ['plan-docs'], queryFn: listPlanDocs, retry: false });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });

  return (
    <div className="space-y-6">
      <p className="text-sm font-medium text-slate-500">
        Anexe seus planejamentos por segmento, filtrando por trimestre e turma. Aceita Word, Excel, PDF, imagens (JPG/PNG/HEIC…) e mais.
      </p>
      {isError ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
          Não foi possível carregar. Verifique se a migração `plan_docs` foi rodada no Supabase. {(error as Error).message}
        </p>
      ) : null}
      {SEGMENTS.map((seg) => (
        <DocSegment key={seg.key} seg={seg} docs={docs.filter((d) => d.segment === seg.key)} classes={classes} loading={isLoading} />
      ))}
    </div>
  );
}

function DocSegment({
  seg,
  docs,
  classes,
  loading,
}: {
  seg: (typeof SEGMENTS)[number];
  docs: PlanDoc[];
  classes: ClassRoom[];
  loading: boolean;
}) {
  const { user, role } = useAuth();
  const userId = user?.id ?? null;
  const canReview = canReviewPlan(role);
  const qc = useQueryClient();
  const [term, setTerm] = useState<string>(''); // '' = todos
  const [turma, setTurma] = useState<string>(''); // '' = todas (class_id)
  const [preview, setPreview] = useState<PlanDoc | null>(null);
  const [editing, setEditing] = useState<PlanDoc | null>(null);
  const [zipping, setZipping] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['plan-docs'] });

  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadPlanDoc({
        segment: seg.key,
        term: term ? Number(term) : null,
        classId: turma || null,
        turmaLabel: turma ? classes.find((c) => c.id === turma)?.name ?? null : null,
        file,
      }),
    onSuccess: () => {
      invalidate();
      successToast('Arquivo enviado');
    },
    onError: (e) => alert(translateStorageError((e as Error).message)),
  });

  const remove = useMutation({
    mutationFn: (doc: PlanDoc) => deletePlanDoc(doc),
    onSuccess: () => {
      invalidate();
      successToast('Arquivo excluído');
    },
  });

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    for (const f of Array.from(list)) await upload.mutateAsync(f).catch(() => {});
  }

  const filtered = useMemo(
    () => docs.filter((d) => (!term || d.term === Number(term)) && (!turma || d.class_id === turma)),
    [docs, term, turma],
  );

  async function baixarTodos() {
    if (zipping) return;
    setZipping(true);
    try {
      await downloadAllAttachments(filtered.map((d) => ({ name: d.name, url: d.url })), safeFileName(seg.label) || 'planejamentos');
      successToast(filtered.length > 1 ? 'Baixado (.zip)' : 'Arquivo baixado');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  const canManage = (d: PlanDoc) => d.author_id === userId || canReview;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ backgroundColor: seg.soft }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: seg.color }}>
          <FileText size={18} />
        </span>
        <h3 className="text-base font-black text-slate-900">{seg.label}</h3>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-black text-slate-500">{docs.length} arquivo(s)</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Select value={term} onChange={(e) => setTerm(e.target.value)} className="h-9 w-auto py-1 text-sm">
            <option value="">Todos os trimestres</option>
            {TERMS.map((t) => <option key={t} value={t}>{t}º trimestre</option>)}
          </Select>
          <Select value={turma} onChange={(e) => setTurma(e.target.value)} className="h-9 w-auto py-1 text-sm">
            <option value="">Todas as turmas</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <Dropzone
          onFiles={handleFiles}
          title={upload.isPending ? 'Enviando…' : 'Arraste arquivos aqui ou clique para anexar'}
          hint={`Vai para: ${seg.label}${term ? ` · ${term}º tri` : ''}${turma ? ` · ${classes.find((c) => c.id === turma)?.name ?? ''}` : ''} · Word, Excel, PDF, imagens…`}
        />

        {filtered.length >= 2 ? (
          <button
            onClick={baixarTodos}
            disabled={zipping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {zipping ? 'Compactando…' : `Baixar todos (.zip) — ${filtered.length}`}
          </button>
        ) : null}

        {loading ? (
          <p className="py-6 text-center text-sm font-bold text-slate-400">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm font-bold text-slate-400">
            Nenhum arquivo {term || turma ? 'com esse filtro' : 'ainda'}.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                turmaName={d.turma_label}
                canManage={canManage(d)}
                onPreview={() => setPreview(d)}
                onEdit={() => setEditing(d)}
                onDelete={() => confirm(`Excluir "${d.name}"?\n\n⚠️ Ação irreversível: remove o arquivo do banco e do armazenamento.`) && remove.mutate(d)}
              />
            ))}
          </div>
        )}
      </div>

      {preview?.url ? <PreviewModal name={preview.name} url={preview.url} mime={preview.mime} onClose={() => setPreview(null)} /> : null}
      {editing ? <EditDocModal doc={editing} classes={classes} onClose={() => setEditing(null)} onSaved={invalidate} /> : null}
    </section>
  );
}

function DocCard({
  doc,
  turmaName,
  canManage,
  onPreview,
  onEdit,
  onDelete,
}: {
  doc: PlanDoc;
  turmaName: string | null;
  canManage: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isImg = !!doc.mime?.startsWith('image/');
  const canPrev = !!doc.url && (isImg || doc.mime === 'application/pdf');
  const ext = (doc.name.split('.').pop() || 'arq').toUpperCase().slice(0, 4);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button onClick={canPrev ? onPreview : () => doc.url && window.open(doc.url, '_blank', 'noopener')} className="relative h-28 w-full bg-slate-50">
        {isImg && doc.url ? (
          <img src={doc.url} alt={doc.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center text-slate-400">
            <FileText size={28} />
            <span className="mt-1 rounded bg-slate-200/70 px-1.5 text-[10px] font-black text-slate-600">{ext}</span>
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col p-2.5">
        <p className="truncate text-sm font-bold text-slate-800" title={doc.name}>{doc.name}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {doc.term ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{doc.term}º tri</span> : null}
          {turmaName ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{turmaName}</span> : null}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <IconBtn label="Visualizar" onClick={canPrev ? onPreview : () => doc.url && window.open(doc.url, '_blank', 'noopener')}><Eye size={15} /></IconBtn>
          <IconBtn label="Baixar" href={doc.url} download={doc.name}><Download size={15} /></IconBtn>
          {canManage ? <IconBtn label="Editar" onClick={onEdit}><Pencil size={15} /></IconBtn> : null}
          {canManage ? <IconBtn label="Excluir" danger onClick={onDelete}><Trash2 size={15} /></IconBtn> : null}
        </div>
      </div>
    </article>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  href,
  download,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  download?: string;
  danger?: boolean;
}) {
  const cls = cn(
    'grid h-9 flex-1 place-items-center rounded-lg transition',
    danger ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900',
  );
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" download={download} className={cls} title={label} aria-label={label}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls} title={label} aria-label={label}>{children}</button>;
}

function EditDocModal({ doc, classes, onClose, onSaved }: { doc: PlanDoc; classes: ClassRoom[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(doc.name);
  const [segment, setSegment] = useState(doc.segment);
  const [term, setTerm] = useState(doc.term ? String(doc.term) : '');
  const [turma, setTurma] = useState(doc.class_id ?? '');

  const save = useMutation({
    mutationFn: () =>
      updatePlanDoc(doc.id, {
        name: name.trim() || doc.name,
        segment,
        term: term ? Number(term) : null,
        class_id: turma || null,
        turma_label: turma ? classes.find((c) => c.id === turma)?.name ?? null : null,
      }),
    onSuccess: () => {
      onSaved();
      onClose();
      successToast('Arquivo atualizado');
    },
  });

  return (
    <Modal open onClose={onClose} title="Editar arquivo">
      <div className="space-y-3">
        <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Segmento</span>
            <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Trimestre</span>
            <Select value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="">—</option>
              {TERMS.map((t) => <option key={t} value={t}>{t}º</option>)}
            </Select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-slate-500">Turma</span>
            <Select value={turma} onChange={(e) => setTurma(e.target.value)}>
              <option value="">Todas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </div>
    </Modal>
  );
}
