import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Mail, Paperclip, Pencil, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AttachmentChips } from '../components/Attachments';
import { successToast } from '../components/Feedback';
import { Button, Card, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { canManageCalendar } from '../lib/permissions';
import {
  deleteEvent,
  listEvents,
  listOrgPeople,
  saveEvent,
  uploadEventAttachment,
  type EventInput,
  type EventWithMeta,
} from '../lib/queries';
import {
  ASSIGNABLE_ROLES,
  EVENT_CATEGORIES,
  ROLE_LABEL,
  eventCatLabel,
  eventColor,
  type AppRole,
  type EventAudience,
} from '../lib/types';

const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const day = (iso: string) => parseISO(iso + 'T00:00:00');
function inEvent(d: Date, e: EventWithMeta) {
  const s = day(e.event_date);
  const en = e.end_date ? day(e.end_date) : s;
  return isWithinInterval(d, { start: s, end: en });
}
function rangeLabel(e: EventWithMeta) {
  const s = format(day(e.event_date), "dd/MM/yyyy", { locale: ptBR });
  if (e.end_date && e.end_date !== e.event_date) return `${s} a ${format(day(e.end_date), 'dd/MM/yyyy')}`;
  return s;
}
function shareText(e: EventWithMeta) {
  return `📅 ${eventCatLabel(e.category)}: ${e.title}\n🗓️ ${rangeLabel(e)}${e.description ? `\n\n${e.description}` : ''}`;
}

export function CalendarPage() {
  const { role } = useAuth();
  const canManage = canManageCalendar(role);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState(new Date());
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState<EventWithMeta | null>(null);

  const { data: events = [], isLoading } = useQuery({ queryKey: ['cal-events'], queryFn: listEvents });

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const dayEvents = (d: Date) => events.filter((e) => inEvent(d, e));
  const selectedEvents = dayEvents(selected);

  function openNew() {
    setEditing(null);
    setComposeOpen(true);
  }
  function openEdit(e: EventWithMeta) {
    setEditing(e);
    setComposeOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="Eventos, atividades, gincanas e semana de provas."
        action={canManage ? <Button onClick={openNew}><Plus size={18} /> Novo evento</Button> : undefined}
      />

      {/* Navegação do mês */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => setCursor(addMonths(cursor, -1))} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-black capitalize text-slate-900">{format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}</h2>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-slate-400">
          {WD.map((w) => (
            <div key={w} className="py-1">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthDays.map((d) => {
            const evs = dayEvents(d);
            const isSel = isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={cn(
                  'flex min-h-14 flex-col items-center rounded-lg border p-1 text-sm transition',
                  isSel ? 'border-emerald-500 bg-emerald-50' : 'border-transparent hover:bg-slate-50',
                  !isSameMonth(d, cursor) && 'opacity-40',
                )}
              >
                <span className={cn('text-xs font-bold', isToday ? 'grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white' : 'text-slate-700')}>
                  {format(d, 'd')}
                </span>
                <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: eventColor(e.category) }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Eventos do dia selecionado */}
      <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">
        {format(selected, "EEEE, d 'de' MMMM", { locale: ptBR })}
      </h3>
      {isLoading ? (
        <p className="text-slate-400">Carregando…</p>
      ) : selectedEvents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
          Nenhum evento neste dia.
        </p>
      ) : (
        <div className="space-y-3">
          {selectedEvents.map((e) => (
            <EventCard key={e.id} event={e} canManage={canManage} onEdit={() => openEdit(e)} />
          ))}
        </div>
      )}

      {composeOpen ? <ComposeModal event={editing} onClose={() => setComposeOpen(false)} defaultDate={selected} /> : null}
    </>
  );
}

function EventCard({ event: e, canManage, onEdit }: { event: EventWithMeta; canManage: boolean; onEdit: () => void }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteEvent(e.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cal-events'] });
      successToast('Evento excluído');
    },
  });
  const wpp = () => window.open('https://wa.me/?text=' + encodeURIComponent(shareText(e)), '_blank', 'noopener');
  const mail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(e.title)}&body=${encodeURIComponent(shareText(e))}`;
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: eventColor(e.category) }} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md px-2 py-0.5 text-[11px] font-black uppercase text-white" style={{ backgroundColor: eventColor(e.category) }}>
              {eventCatLabel(e.category)}
            </span>
            <p className="font-black text-slate-900">{e.title}</p>
          </div>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {rangeLabel(e)}
            {e.authorName ? ` · por ${e.authorName}` : ''}
          </p>
          {e.description ? <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{e.description}</p> : null}
          <AttachmentChips attachments={e.attachments} />
        </div>
        {canManage ? (
          <div className="flex shrink-0 gap-1">
            <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Editar">
              <Pencil size={15} />
            </button>
            <button
              onClick={() => confirm('Excluir este evento?') && remove.mutate()}
              className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
              aria-label="Excluir"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button onClick={wpp} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
          <WhatsAppIcon /> WhatsApp
        </button>
        <button onClick={mail} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200">
          <Mail size={14} /> E-mail
        </button>
      </div>
    </Card>
  );
}

function WhatsAppIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 018.413 3.488 11.82 11.82 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.477-.607zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z" />
    </svg>
  );
}

function ComposeModal({ event, onClose, defaultDate }: { event: EventWithMeta | null; onClose: () => void; defaultDate: Date }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [category, setCategory] = useState(event?.category ?? 'evento');
  const [date, setDate] = useState(event?.event_date ?? format(defaultDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(event?.end_date ?? '');
  const [audience, setAudience] = useState<EventAudience>(event?.audience ?? 'all');
  const [targetRole, setTargetRole] = useState<AppRole>((event?.target_role as AppRole) ?? 'professor');
  const [targetUser, setTargetUser] = useState(event?.target_user ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const { data: people = [] } = useQuery({ queryKey: ['org-people'], queryFn: listOrgPeople });

  const addFiles = (l: FileList | null) => l && l.length && setFiles((p) => [...p, ...Array.from(l)]);

  const save = useMutation({
    mutationFn: async () => {
      const input: EventInput = {
        id: event?.id,
        title: title.trim(),
        description: description.trim(),
        category,
        event_date: date,
        end_date: endDate || null,
        audience,
        target_role: audience === 'role' ? targetRole : null,
        target_user: audience === 'user' ? targetUser : null,
      };
      const id = await saveEvent(input);
      for (const f of files) await uploadEventAttachment(id, f);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cal-events'] });
      onClose();
      successToast(event ? 'Evento atualizado' : 'Evento criado');
    },
  });

  const valid = title.trim() && date && (audience !== 'user' || targetUser);

  return (
    <Modal open onClose={onClose} title={event ? 'Editar evento' : 'Novo evento'} size="xl">
      <div className="space-y-4">
        <Field label="Título">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Gincana de aniversário da escola" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Até (opcional)">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={date} />
            </Field>
          </div>
        </div>
        <Field label="Descrição">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            placeholder="Detalhes do evento…"
          />
        </Field>

        <Field label="Para">
          <div className="grid grid-cols-3 gap-2">
            {([['all', 'Todos'], ['role', 'Por papel'], ['user', 'Pessoa']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setAudience(v)}
                className={cn('rounded-xl border px-3 py-2.5 text-sm font-bold transition', audience === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600')}
              >
                {l}
              </button>
            ))}
          </div>
        </Field>
        {audience === 'role' ? (
          <Field label="Papel">
            <Select value={targetRole} onChange={(e) => setTargetRole(e.target.value as AppRole)}>
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </Select>
          </Field>
        ) : null}
        {audience === 'user' ? (
          <Field label="Pessoa">
            <Select value={targetUser} onChange={(e) => setTargetUser(e.target.value)}>
              <option value="">Selecione…</option>
              {people.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.full_name || p.user_id} — {ROLE_LABEL[p.role]}</option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="Anexos (calendário pronto, regulamento, etc.)">
          <label
            htmlFor="ev-files"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            className={cn('flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition', dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100')}
          >
            <UploadCloud size={22} className="text-slate-400" />
            <p className="text-sm font-bold text-slate-600">Clique ou arraste os arquivos aqui</p>
            <p className="text-xs text-slate-400">PDF, DOC/DOCX, PPTX, XLSX, PNG, JPG, HEIC, Pages, Keynote…</p>
            <input
              id="ev-files"
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.pages,.key,.numbers,.heic,.heif"
              className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
            />
          </label>
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

        {event?.attachments?.length ? (
          <div>
            <p className="mb-1 text-xs font-bold text-slate-500">Anexos atuais</p>
            <AttachmentChips attachments={event.attachments} />
          </div>
        ) : null}

        {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            <CalendarDays size={16} /> {save.isPending ? 'Salvando…' : event ? 'Salvar' : 'Criar evento'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
