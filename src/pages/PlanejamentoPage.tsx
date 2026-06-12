import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BookOpen, Check, Mail, MessageCircle, MessageSquare, Paperclip, Pencil, Plus, Save, Send, Share2, Trash2, Undo2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AttachmentChips } from '../components/Attachments';
import { Dropzone } from '../components/Dropzone';
import { successToast } from '../components/Feedback';
import { Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { canReviewPlan } from '../lib/permissions';
import { safeFileName } from '../lib/storage';
import {
  deletePlan,
  listClasses,
  listMyPlans,
  listOrgPlans,
  listPlanMessages,
  listReviewedPlans,
  markPlanRead,
  planUnreadCounts,
  reviewPlan,
  savePlan,
  sendPlanMessage,
  setMemberContact,
  submitPlan,
  uploadPlanAttachment,
  type PlanInput,
  type PlanWithMeta,
} from '../lib/queries';
import { PLAN_STATUS } from '../lib/types';

// Traduz erros técnicos (ex.: módulo ainda não ativado no banco) para algo amigável.
function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? '';
  if (m.includes('schema cache') || m.includes('lesson_plan') || m.includes('PGRST205')) {
    return 'O módulo de planejamento ainda está sendo ativado. Tente novamente em instantes.';
  }
  return m || 'Não foi possível completar a ação. Tente novamente.';
}

export function PlanejamentoPage() {
  const { user, role } = useAuth();
  const uid = user!.id;
  const canReview = canReviewPlan(role);
  const [tab, setTab] = useState<'meus' | 'revisar' | 'revisados'>('meus');
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<PlanWithMeta | null>(null);

  function openNew() {
    setEditing(null);
    setComposeOpen(true);
  }
  function openEdit(p: PlanWithMeta) {
    setEditing(p);
    setComposeOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Planejamento"
        subtitle="Planejamentos do professor — envio para a coordenação."
        action={<Button onClick={openNew}><Plus size={18} /> Novo planejamento</Button>}
      />

      {canReview ? (
        <div className="mb-5 inline-flex flex-wrap rounded-xl bg-slate-100 p-1">
          {([['meus', 'Meus planejamentos'], ['revisar', 'Para revisar'], ['revisados', 'Revisados']] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('rounded-lg px-4 py-2 text-sm font-bold transition', tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'meus' ? <MeusPlanos uid={uid} onEdit={openEdit} /> : tab === 'revisar' ? <Pendentes /> : <Revisados />}

      {composeOpen ? <ComposeModal plan={editing} onClose={() => setComposeOpen(false)} /> : null}
    </>
  );
}

function MeusPlanos({ uid, onEdit }: { uid: string; onEdit: (p: PlanWithMeta) => void }) {
  const qc = useQueryClient();
  const { data: plans = [], isLoading, isError, error } = useQuery({ queryKey: ['my-plans', uid], queryFn: () => listMyPlans(uid), retry: false });

  const send = useMutation({
    mutationFn: submitPlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-plans', uid] });
      qc.invalidateQueries({ queryKey: ['org-plans'] });
      successToast('Planejamento enviado à coordenação');
    },
  });
  const remove = useMutation({
    mutationFn: deletePlan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-plans', uid] });
      successToast('Planejamento excluído');
    },
  });

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (isError) return <EmptyState icon={<BookOpen size={26} />} title="Planejamento indisponível" hint={friendly(error)} />;
  if (plans.length === 0)
    return <EmptyState icon={<BookOpen size={26} />} title="Nenhum planejamento" hint="Crie seu primeiro planejamento e envie para a coordenação." />;

  return (
    <div className="space-y-3">
      {plans.map((p) => (
        <PlanCard
          key={p.id}
          plan={p}
          footer={
            <div className="flex flex-wrap gap-2">
              {p.status === 'rascunho' || p.status === 'devolvido' ? (
                <>
                  <Button variant="ghost" onClick={() => onEdit(p)}><Pencil size={16} /> Editar</Button>
                  <Button onClick={() => send.mutate(p.id)} disabled={send.isPending}><Send size={16} /> Enviar</Button>
                </>
              ) : null}
              <button
                onClick={() => confirm('Excluir este planejamento?') && remove.mutate(p.id)}
                className="ml-auto grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                aria-label="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>
          }
        />
      ))}
    </div>
  );
}

function Pendentes() {
  const qc = useQueryClient();
  const { data: plans = [], isLoading, isError, error } = useQuery({ queryKey: ['org-plans', 'enviado'], queryFn: () => listOrgPlans('enviado'), retry: false });
  const [feedbackFor, setFeedbackFor] = useState<PlanWithMeta | null>(null);

  const approve = useMutation({
    mutationFn: (id: string) => reviewPlan(id, 'aprovado', ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-plans', 'enviado'] });
      qc.invalidateQueries({ queryKey: ['org-plans', 'revisados'] });
      successToast('Planejamento aprovado');
    },
  });

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (isError) return <EmptyState icon={<BookOpen size={26} />} title="Planejamento indisponível" hint={friendly(error)} />;
  if (plans.length === 0)
    return <EmptyState icon={<Check size={26} />} title="Nada para revisar" hint="Planejamentos enviados pelos professores aparecem aqui." />;

  return (
    <>
      <div className="space-y-3">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            showAuthor
            footer={
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => approve.mutate(p.id)} disabled={approve.isPending}><Check size={16} /> Aprovar</Button>
                <Button variant="danger" onClick={() => setFeedbackFor(p)}><Undo2 size={16} /> Devolver</Button>
              </div>
            }
          />
        ))}
      </div>
      {feedbackFor ? <DevolverModal plan={feedbackFor} onClose={() => setFeedbackFor(null)} /> : null}
    </>
  );
}

function Revisados() {
  const { data: plans = [], isLoading, isError, error } = useQuery({ queryKey: ['org-plans', 'revisados'], queryFn: listReviewedPlans, retry: false });
  const [sendFor, setSendFor] = useState<PlanWithMeta | null>(null);

  if (isLoading) return <p className="text-slate-400">Carregando…</p>;
  if (isError) return <EmptyState icon={<BookOpen size={26} />} title="Planejamento indisponível" hint={friendly(error)} />;
  if (plans.length === 0)
    return <EmptyState icon={<Check size={26} />} title="Nenhum revisado ainda" hint="Aprovados e devolvidos ficam aqui para consulta e reenvio." />;

  return (
    <>
      <div className="space-y-3">
        {plans.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            showAuthor
            footer={
              <div className="flex flex-wrap gap-2">
                <Button variant="soft" onClick={() => setSendFor(p)}><Share2 size={16} /> Enviar</Button>
              </div>
            }
          />
        ))}
      </div>
      {sendFor ? <SendModal plan={sendFor} onClose={() => setSendFor(null)} /> : null}
    </>
  );
}

/** Só dígitos; garante DDI 55 (Brasil) quando o número não tem código de país. */
function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55')) return d;
  return d.length <= 11 ? `55${d}` : d;
}

/** Envio do retorno por WhatsApp ou e-mail, com contato pré-configurável. */
function SendModal({ plan, onClose }: { plan: PlanWithMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [phone, setPhone] = useState(plan.authorPhone ?? '');
  const [email, setEmail] = useState(plan.authorEmail ?? '');
  const statusLabel = PLAN_STATUS[plan.status].label.toLowerCase();
  const defaultMsg =
    `Olá${plan.authorName ? `, ${plan.authorName}` : ''}! Seu planejamento "${plan.title}" foi ${statusLabel}.` +
    (plan.feedback ? `\n\nRetorno da coordenação:\n${plan.feedback}` : '') +
    (plan.className ? `\n\nTurma: ${plan.className}` : '');
  const [message, setMessage] = useState(defaultMsg);

  const saveContact = useMutation({
    mutationFn: () => setMemberContact(plan.author_id, phone, email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-plans'] });
      successToast('Contato salvo');
    },
  });

  function fire() {
    if (channel === 'whatsapp') {
      const num = normalizePhone(phone);
      if (!num) return;
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    } else {
      const subject = `Planejamento "${plan.title}" — ${PLAN_STATUS[plan.status].label}`;
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    }
    successToast('Abrindo para envio…');
    onClose();
  }

  const canFire = channel === 'whatsapp' ? !!normalizePhone(phone) : /\S+@\S+\.\S+/.test(email);

  return (
    <Modal open onClose={onClose} title="Enviar retorno ao professor">
      <div className="space-y-4">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          <button
            onClick={() => setChannel('whatsapp')}
            className={cn('flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition', channel === 'whatsapp' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500')}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button
            onClick={() => setChannel('email')}
            className={cn('flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold transition', channel === 'email' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500')}
          >
            <Mail size={16} /> E-mail
          </button>
        </div>

        {channel === 'whatsapp' ? (
          <Field label="WhatsApp do professor (com DDD)">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex.: (11) 99999-9999" inputMode="tel" />
          </Field>
        ) : (
          <Field label="E-mail do professor">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="professor@escola.com" type="email" />
          </Field>
        )}

        <Field label="Mensagem">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={() => saveContact.mutate()} disabled={saveContact.isPending || (!phone.trim() && !email.trim())}>
            <Save size={16} /> {saveContact.isPending ? 'Salvando…' : 'Salvar contato'}
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={fire} disabled={!canFire}>
              {channel === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />} Disparar
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          "Salvar contato" guarda o WhatsApp/e-mail no perfil do professor — da próxima vez já vem preenchido, é só disparar.
        </p>
      </div>
    </Modal>
  );
}

function PlanCard({ plan: p, footer, showAuthor }: { plan: PlanWithMeta; footer?: React.ReactNode; showAuthor?: boolean }) {
  const st = PLAN_STATUS[p.status];
  const [chatOpen, setChatOpen] = useState(false);
  // Query compartilhada (mesma key) — o React Query dedup: 1 fetch p/ todos os cards.
  const { data: unreadMap = {} } = useQuery({ queryKey: ['plan-unread'], queryFn: planUnreadCounts, refetchInterval: 15000, retry: false });
  const unread = unreadMap[p.id] ?? 0;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black uppercase', st.cls)}>{st.label}</span>
            <p className="font-black text-slate-900">{p.title}</p>
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-400">
            {showAuthor && p.authorName ? `${p.authorName} · ` : ''}
            {p.className ? `${p.className} · ` : ''}
            {p.week_start ? `Semana de ${format(parseISO(p.week_start), 'dd/MM/yyyy')}` : 'Sem data'}
          </p>
        </div>
        <button
          onClick={() => setChatOpen(true)}
          className={cn(
            'relative flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition',
            unread > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700',
          )}
          title={unread > 0 ? `${unread} mensagem(ns) nova(s)` : 'Abrir conversa'}
        >
          <MessageSquare size={15} /> Conversa
          {unread > 0 ? (
            <span className="grid min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-black leading-5 text-emerald-700">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </button>
      </div>
      {p.content ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{p.content}</p> : null}
      <AttachmentChips attachments={p.attachments} zipName={safeFileName(p.title) || 'planejamento'} />
      {p.feedback ? (
        <div className={cn('mt-3 rounded-xl border p-3 text-sm', p.status === 'aprovado' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800')}>
          <p className="text-[11px] font-black uppercase tracking-wide opacity-70">Retorno da coordenação</p>
          <p className="mt-0.5 whitespace-pre-wrap font-semibold">{p.feedback}</p>
        </div>
      ) : null}
      {footer ? <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div> : null}
      {chatOpen ? <ChatModal plan={p} onClose={() => setChatOpen(false)} /> : null}
    </Card>
  );
}

/** Chat interno por planejamento — coordenação ⇄ professor, com auto-atualização. */
function ChatModal({ plan, onClose }: { plan: PlanWithMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user!.id;
  const [body, setBody] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const key = ['plan-messages', plan.id];

  const { data: messages = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => listPlanMessages(plan.id),
    refetchInterval: 8000, // quase em tempo real, sem peso de websocket
    retry: false,
  });

  const send = useMutation({
    mutationFn: () => sendPlanMessage(plan.id, body),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: key });
    },
  });

  // Ao abrir/receber mensagens, marca como lido e zera o badge de não lidas.
  useEffect(() => {
    if (!messages.length) return;
    markPlanRead(plan.id)
      .then(() => qc.invalidateQueries({ queryKey: ['plan-unread'] }))
      .catch(() => {});
  }, [plan.id, messages.length, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function submit() {
    if (body.trim() && !send.isPending) send.mutate();
  }

  return (
    <Modal open onClose={onClose} title={`Conversa — ${plan.title}`}>
      <div className="flex h-[60vh] flex-col">
        <div className="-mx-1 flex-1 space-y-2 overflow-y-auto px-1">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-slate-400">Carregando…</p>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                  <MessageSquare size={22} />
                </div>
                <p className="text-sm font-bold text-slate-600">Nenhuma mensagem ainda</p>
                <p className="mt-1 text-xs text-slate-400">Tire dúvidas ou peça ajustes diretamente aqui.</p>
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.author_id === uid;
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
                      mine ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800',
                    )}
                  >
                    {!mine ? <p className="mb-0.5 text-[11px] font-black opacity-70">{m.authorName ?? 'Usuário'}</p> : null}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] font-bold text-slate-400">
                    {format(parseISO(m.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="mt-3 flex items-end gap-2 border-t border-slate-100 pt-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            autoFocus
            placeholder="Escreva uma mensagem…  (Enter envia, Shift+Enter quebra linha)"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <Button onClick={submit} disabled={!body.trim() || send.isPending} className="shrink-0">
            <Send size={16} /> Enviar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DevolverModal({ plan, onClose }: { plan: PlanWithMeta; onClose: () => void }) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState('');
  const ret = useMutation({
    mutationFn: () => reviewPlan(plan.id, 'devolvido', feedback.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-plans', 'enviado'] });
      onClose();
      successToast('Planejamento devolvido ao professor');
    },
  });
  return (
    <Modal open onClose={onClose} title="Devolver planejamento">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Explique o que precisa ser ajustado. O professor verá esse retorno.</p>
        <Field label="Feedback">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Ex.: incluir os objetivos de aprendizagem da BNCC…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => ret.mutate()} disabled={!feedback.trim() || ret.isPending}>
            <Undo2 size={16} /> {ret.isPending ? 'Devolvendo…' : 'Devolver'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ComposeModal({ plan, onClose }: { plan: PlanWithMeta | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: classes = [] } = useQuery({ queryKey: ['classes'], queryFn: listClasses });
  const [title, setTitle] = useState(plan?.title ?? '');
  const [classId, setClassId] = useState(plan?.class_id ?? '');
  const [week, setWeek] = useState(plan?.week_start ?? '');
  const [content, setContent] = useState(plan?.content ?? '');
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = (l: FileList | null) => l && l.length && setFiles((p) => [...p, ...Array.from(l)]);

  async function persist(andSend: boolean) {
    const input: PlanInput = { id: plan?.id, title: title.trim(), class_id: classId || null, week_start: week || null, content: content.trim() };
    const id = await savePlan(input);
    for (const f of files) await uploadPlanAttachment(id, f);
    if (andSend) await submitPlan(id);
    return id;
  }

  const saveDraft = useMutation({
    mutationFn: () => persist(false),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-plans', user?.id] });
      onClose();
      successToast('Rascunho salvo');
    },
  });
  const saveSend = useMutation({
    mutationFn: () => persist(true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-plans', user?.id] });
      qc.invalidateQueries({ queryKey: ['org-plans'] });
      onClose();
      successToast('Planejamento enviado à coordenação');
    },
  });

  const valid = title.trim().length > 0;
  const busy = saveDraft.isPending || saveSend.isPending;

  return (
    <Modal open onClose={onClose} title={plan ? 'Editar planejamento' : 'Novo planejamento'} size="xl">
      <div className="space-y-4">
        <Field label="Título">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Plano semanal — Língua Inglesa" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Turma (opcional)">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">—</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Semana (opcional)">
            <Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} />
          </Field>
        </div>
        <Field label="Conteúdo / objetivos / atividades">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Objetivos de aprendizagem (BNCC), conteúdos, metodologia, recursos, avaliação…"
          />
        </Field>

        <Field label="Anexos (plano em PDF/DOCX, materiais…)">
          <Dropzone
            hint="PDF, Word, Excel, PowerPoint, imagens, ZIP… (até 50 MB)"
            onFiles={addFiles}
          />
          {files.length > 0 ? (
            <div className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                  <Paperclip size={14} className="shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label="Remover" className="text-slate-400 hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </Field>

        {plan?.attachments?.length ? (
          <div>
            <p className="mb-1 text-xs font-bold text-slate-500">Anexos atuais</p>
            <AttachmentChips attachments={plan.attachments} />
          </div>
        ) : null}

        {saveDraft.isError || saveSend.isError ? (
          <p className="text-sm font-semibold text-red-600">{friendly(saveDraft.error || saveSend.error)}</p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant="soft" onClick={() => saveDraft.mutate()} disabled={!valid || busy}>Salvar rascunho</Button>
          <Button onClick={() => saveSend.mutate()} disabled={!valid || busy}>
            <Send size={16} /> {busy ? 'Salvando…' : 'Salvar e enviar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
