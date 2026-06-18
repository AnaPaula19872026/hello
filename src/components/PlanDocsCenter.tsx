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
const SEGMENTS: { key: string; label: string; color: string }[] = [
  { key: 'fund1', label: 'Fundamental I', color: '#2563eb' },
  { key: 'fund2', label: 'Fundamental II', color: '#7c3aed' },
];
const TERMS = [1, 2, 3];
/** Colunas do kanban: um trimestre por coluna + os sem trimestre definido. */
const COLUMNS: { term: number | null; label: string }[] = [
  { term: 1, label: '1º Trimestre' },
  { term: 2, label: '2º Trimestre' },
  { term: 3, label: '3º Trimestre' },
  { term: null, label: 'Sem trimestre' },
];

export function PlanDocsCenter() {
  const { data: docs = [], isLoading, isError, error } = useQuery({ queryKey: ['plan-docs'], queryFn: listPlanDocs, retry: false });
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });

  const [seg, setSeg] = useState(SEGMENTS[0].key);
  const [turma, setTurma] = useState(''); // '' = todas

  const countBySeg = (key: string) => docs.filter((d) => d.segment === key).length;

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-500">
        Quadro por trimestre. Arraste um arquivo para a coluna do trimestre — Word, Excel, PDF, imagens (JPG/PNG/HEIC…) e mais.
      </p>

      {isError ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
          Não foi possível carregar. Verifique se a migração `plan_docs` foi rodada no Supabase. {(error as Error).message}
        </p>
      ) : null}

      {/* Barra: segmento (abas) + filtro de turma */}
      <div className="flex flex-wrap items-center gap-2">
        {SEGMENTS.map((s) => {
          const active = seg === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSeg(s.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition',
                active ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
              style={active ? { backgroundColor: s.color } : undefined}
            >
              <FileText size={15} />
              {s.label}
              <span className={cn('rounded-full px-1.5 text-[11px] font-black', active ? 'bg-white/25' : 'bg-white text-slate-500')}>{countBySeg(s.key)}</span>
            </button>
          );
        })}
        <div className="ml-auto w-full sm:w-52">
          <Select value={turma} onChange={(e) => setTurma(e.target.value)} className="py-2 text-sm">
            <option value="">Todas as turmas</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </div>

      <KanbanBoard
        segKey={seg}
        docs={docs.filter((d) => d.segment === seg)}
        classes={classes}
        turma={turma}
        loading={isLoading}
      />
    </div>
  );
}

function KanbanBoard({
  segKey,
  docs,
  classes,
  turma,
  loading,
}: {
  segKey: string;
  docs: PlanDoc[];
  classes: ClassRoom[];
  turma: string;
  loading: boolean;
}) {
  const { user, role } = useAuth();
  const userId = user?.id ?? null;
  const canReview = canReviewPlan(role);
  const qc = useQueryClient();
  const [preview, setPreview] = useState<PlanDoc | null>(null);
  const [editing, setEditing] = useState<PlanDoc | null>(null);
  const [zipping, setZipping] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['plan-docs'] });
  const segLabel = SEGMENTS.find((s) => s.key === segKey)?.label ?? '';

  const upload = useMutation({
    mutationFn: ({ file, term }: { file: File; term: number | null }) =>
      uploadPlanDoc({
        segment: segKey,
        term,
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

  async function handleFiles(list: FileList | null, term: number | null) {
    if (!list?.length) return;
    for (const f of Array.from(list)) await upload.mutateAsync({ file: f, term }).catch(() => {});
  }

  const filtered = useMemo(() => docs.filter((d) => !turma || d.class_id === turma), [docs, turma]);

  async function baixarTodos() {
    if (zipping || filtered.length === 0) return;
    setZipping(true);
    try {
      await downloadAllAttachments(filtered.map((d) => ({ name: d.name, url: d.url })), safeFileName(segLabel) || 'planejamentos');
      successToast(filtered.length > 1 ? 'Baixado (.zip)' : 'Arquivo baixado');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setZipping(false);
    }
  }

  const canManage = (d: PlanDoc) => d.author_id === userId || canReview;

  return (
    <div className="space-y-3">
      {filtered.length >= 2 ? (
        <div className="flex justify-end">
          <button
            onClick={baixarTodos}
            disabled={zipping}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {zipping ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {zipping ? 'Compactando…' : `Baixar todos (.zip) — ${filtered.length}`}
          </button>
        </div>
      ) : null}

      {/* Kanban: colunas roláveis horizontalmente no celular, em grade no desktop */}
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {COLUMNS.map((col) => {
          const cards = filtered.filter((d) => (d.term ?? null) === col.term);
          return (
            <div key={String(col.term)} className="flex w-[270px] shrink-0 snap-start flex-col rounded-2xl bg-slate-50 lg:w-auto">
              <div className="flex items-center gap-2 px-3 pt-3">
                <h3 className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-wide text-slate-500">{col.label}</h3>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-slate-500">{cards.length}</span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-3">
                <Dropzone
                  compact
                  onFiles={(l) => handleFiles(l, col.term)}
                  title={upload.isPending ? 'Enviando…' : 'Soltar arquivo'}
                />
                {loading ? (
                  <p className="py-4 text-center text-xs font-bold text-slate-400">Carregando…</p>
                ) : cards.length === 0 ? (
                  <p className="py-4 text-center text-xs font-medium text-slate-300">Vazio</p>
                ) : (
                  cards.map((d) => (
                    <DocCard
                      key={d.id}
                      doc={d}
                      turmaName={d.turma_label}
                      canManage={canManage(d)}
                      onPreview={() => setPreview(d)}
                      onEdit={() => setEditing(d)}
                      onDelete={() => confirm(`Excluir "${d.name}"?\n\n⚠️ Ação irreversível: remove o arquivo do banco e do armazenamento.`) && remove.mutate(d)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {preview?.url ? <PreviewModal name={preview.name} url={preview.url} mime={preview.mime} onClose={() => setPreview(null)} /> : null}
      {editing ? <EditDocModal doc={editing} classes={classes} onClose={() => setEditing(null)} onSaved={invalidate} /> : null}
    </div>
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
  const openExternal = () => doc.url && window.open(doc.url, '_blank', 'noopener');

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-2.5">
        <button
          onClick={canPrev ? onPreview : openExternal}
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 text-slate-400"
          aria-label="Abrir"
        >
          {isImg && doc.url ? (
            <img src={doc.url} alt={doc.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[9px] font-black text-slate-500">{ext}</span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-tight text-slate-800" title={doc.name}>{doc.name}</p>
          {turmaName ? (
            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">{turmaName}</span>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <IconBtn label="Visualizar" onClick={canPrev ? onPreview : openExternal}><Eye size={14} /></IconBtn>
        <IconBtn label="Baixar" href={doc.url} download={doc.name}><Download size={14} /></IconBtn>
        {canManage ? <IconBtn label="Editar" onClick={onEdit}><Pencil size={14} /></IconBtn> : null}
        {canManage ? <IconBtn label="Excluir" danger onClick={onDelete}><Trash2 size={14} /></IconBtn> : null}
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
    'grid h-8 flex-1 place-items-center rounded-lg transition',
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
