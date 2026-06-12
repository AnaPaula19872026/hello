import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { successToast } from '../components/Feedback';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { canSendNotice } from '../lib/permissions';
import {
  deleteNotice,
  listOrgPeople,
  listReceivedNotices,
  listSentNotices,
  markNoticeRead,
  sendNotice,
  type NoticeInput,
} from '../lib/queries';
import { ASSIGNABLE_ROLES, ROLE_LABEL, type AppRole, type NoticeAudience } from '../lib/types';

function fmt(iso: string) {
  return format(parseISO(iso), "dd/MM 'às' HH:mm", { locale: ptBR });
}

export function AvisosPage() {
  const { user, role } = useAuth();
  const uid = user!.id;
  const canSend = canSendNotice(role);
  const [tab, setTab] = useState<'recebidos' | 'enviados'>('recebidos');
  const [composeOpen, setComposeOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Avisos"
        subtitle="Comunicação entre setores."
        action={canSend ? <Button onClick={() => setComposeOpen(true)}><Plus size={18} /> Novo aviso</Button> : undefined}
      />

      {canSend ? (
        <div className="mb-5 inline-flex rounded-xl bg-slate-100 p-1">
          {(['recebidos', 'enviados'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-bold capitalize transition',
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'recebidos' ? <Recebidos uid={uid} /> : <Enviados uid={uid} />}

      {composeOpen ? <ComposeModal onClose={() => setComposeOpen(false)} /> : null}
    </>
  );
}

function Recebidos({ uid }: { uid: string }) {
  const qc = useQueryClient();
  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices-received', uid],
    queryFn: () => listReceivedNotices(uid),
  });
  const read = useMutation({
    mutationFn: markNoticeRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notices-received', uid] });
      qc.invalidateQueries({ queryKey: ['notices-unread', uid] });
    },
  });

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (notices.length === 0)
    return <EmptyState icon={<Megaphone size={26} />} title="Nenhum aviso" hint="Quando a coordenação enviar avisos, eles aparecem aqui." />;

  return (
    <div className="space-y-3">
      {notices.map((n) => (
        <Card key={n.id} className={cn(!n.read && 'border-emerald-300 bg-emerald-50/40')}>
          <div className="flex items-start gap-3">
            {!n.read ? <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" /> : null}
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-900">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
              <p className="mt-2 text-xs font-bold text-slate-400">{fmt(n.created_at)}</p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            {n.read ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Check size={14} /> Lido
              </span>
            ) : (
              <Button variant="soft" onClick={() => read.mutate(n.id)} disabled={read.isPending}>
                <Check size={16} /> Marcar como lida
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

const AUDIENCE_LABEL = (audience: NoticeAudience, role: AppRole | null) =>
  audience === 'all' ? 'Todos' : audience === 'role' ? `Papel: ${role ? ROLE_LABEL[role] : '—'}` : 'Pessoa específica';

function Enviados({ uid }: { uid: string }) {
  const qc = useQueryClient();
  const { data: notices = [], isLoading } = useQuery({ queryKey: ['notices-sent', uid], queryFn: () => listSentNotices(uid) });
  const remove = useMutation({
    mutationFn: deleteNotice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notices-sent', uid] });
      successToast('Aviso excluído');
    },
  });

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (notices.length === 0)
    return <EmptyState icon={<Send size={26} />} title="Nenhum aviso enviado" hint="Crie um aviso em 'Novo aviso'." />;

  return (
    <div className="space-y-3">
      {notices.map((n) => (
        <Card key={n.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-black text-slate-900">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
              <p className="mt-2 text-xs font-bold text-slate-400">
                {AUDIENCE_LABEL(n.audience, n.target_role)} • {fmt(n.created_at)}
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Excluir este aviso?')) remove.mutate(n.id);
              }}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
              aria-label="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
            <Check size={14} /> {n.reads} confirmação(ões) de leitura
          </div>
        </Card>
      ))}
    </div>
  );
}

function ComposeModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<NoticeAudience>('all');
  const [targetRole, setTargetRole] = useState<AppRole>('professor');
  const [targetUser, setTargetUser] = useState('');

  const { data: people = [] } = useQuery({ queryKey: ['org-people'], queryFn: listOrgPeople });

  const send = useMutation({
    mutationFn: () => {
      const input: NoticeInput = { title: title.trim(), body: body.trim(), audience };
      if (audience === 'role') input.target_role = targetRole;
      if (audience === 'user') input.target_user = targetUser;
      return sendNotice(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notices-sent', user?.id] });
      onClose();
      successToast('Aviso enviado com sucesso');
    },
  });

  const valid = title.trim() && body.trim() && (audience !== 'user' || targetUser);

  return (
    <Modal open onClose={onClose} title="Novo aviso">
      <div className="space-y-4">
        <Field label="Título">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Envio do planejamento" autoFocus />
        </Field>
        <Field label="Mensagem">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Escreva o aviso…"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <Field label="Para">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['all', 'Todos'],
                ['role', 'Por papel'],
                ['user', 'Pessoa'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setAudience(val)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                  audience === val ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600',
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>

        {audience === 'role' ? (
          <Field label="Papel destinatário">
            <Select value={targetRole} onChange={(e) => setTargetRole(e.target.value as AppRole)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {audience === 'user' ? (
          <Field label="Pessoa">
            <Select value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
              <option value="">Selecione…</option>
              {people.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.full_name || p.user_id} — {ROLE_LABEL[p.role]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {send.isError ? <p className="text-sm font-semibold text-red-600">{(send.error as Error).message}</p> : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => send.mutate()} disabled={!valid || send.isPending}>
            <Send size={16} /> {send.isPending ? 'Enviando…' : 'Enviar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
