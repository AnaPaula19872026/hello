import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Mail, Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AttachmentChips } from '../components/Attachments';
import { Dropzone } from '../components/Dropzone';
import { successToast } from '../components/Feedback';
import { Button, Card, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { downloadCalendarTemplate, parseCalendarFile, type ParsedEvent } from '../lib/importCalendar';
import { canManageCalendar } from '../lib/permissions';
import {
  bulkCreateEvents,
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
  SCHOOL_YEAR_MONTHS,
  eventCatLabel,
  eventColor,
  eventSoftColor,
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
function audienceLabel(e: EventWithMeta) {
  if (e.audience === 'all') return 'Todos os envolvidos';
  if (e.audience === 'role' && e.target_role) return ROLE_LABEL[e.target_role as AppRole] ?? 'Perfil específico';
  if (e.audience === 'user') return 'Pessoa específica';
  return 'Todos os envolvidos';
}

export function CalendarPage() {
  const { role } = useAuth();
  const canManage = canManageCalendar(role);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDate, setComposeDate] = useState<Date>(today);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<EventWithMeta | null>(null);

  const { data: events = [] } = useQuery({ queryKey: ['cal-events'], queryFn: listEvents });

  const dayEvents = (d: Date) => events.filter((e) => inEvent(d, e));
  const yearEvents = useMemo(() => events.filter((e) => e.event_date.startsWith(String(year))), [events, year]);

  // Ano letivo fev (1) a nov (10), agrupado em trimestres (3 meses por linha).
  const groups = useMemo(() => {
    const [a, b] = SCHOOL_YEAR_MONTHS;
    const arr: Date[] = [];
    for (let m = a; m <= b; m++) arr.push(new Date(year, m, 1));
    const labels = ['1º Trimestre', '2º Trimestre', '3º Trimestre', 'Encerramento'];
    const out: { label: string; months: Date[] }[] = [];
    for (let i = 0; i < arr.length; i += 3) out.push({ label: labels[i / 3] ?? '', months: arr.slice(i, i + 3) });
    return out;
  }, [year]);

  function openNew(d: Date) {
    setEditing(null);
    setComposeDate(d);
    setComposeOpen(true);
  }
  function openEdit(e: EventWithMeta) {
    setDayModal(null);
    setEditing(e);
    setComposeOpen(true);
  }

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="Ano letivo inteiro — eventos, atividades, gincanas e semana de provas."
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet size={18} /> Importar
              </Button>
              <Button onClick={() => openNew(today)}>
                <Plus size={18} /> Novo evento
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-center gap-4">
          <button onClick={() => setYear(year - 1)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200">
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-lg font-black text-slate-900">Ano letivo {year}</h2>
          <button onClick={() => setYear(year + 1)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Legenda no calendário</p>
          <div className="flex flex-wrap gap-2">
            {EVENT_CATEGORIES.map((c) => (
              <span
                key={c.key}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-black"
                style={{ backgroundColor: eventSoftColor(c.key), borderColor: `${c.color}33`, color: c.color }}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.label}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {groups.map((g, i) => (
            <div key={i}>
              {g.label ? <p className="mb-2 text-xs font-black uppercase tracking-wide text-emerald-700">{g.label}</p> : null}
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.months.map((m) => (
                  <MiniMonth key={m.toISOString()} monthDate={m} dayEvents={dayEvents} onSelect={setDayModal} />
                ))}
              </div>
            </div>
          ))}
        </div>

      </Card>

      {/* Lista de eventos do ano (nomes visíveis a todos) */}
      <h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">Eventos de {year}</h3>
      {yearEvents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
          Nenhum evento neste ano ainda.
        </p>
      ) : (
        <div className="space-y-1.5">
          {yearEvents.map((e) => (
            <button
              key={e.id}
              onClick={() => setDayModal(day(e.event_date))}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg text-center text-xs font-black text-white" style={{ backgroundColor: eventColor(e.category) }}>
                {e.event_date.slice(8, 10)}/{e.event_date.slice(5, 7)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-slate-800">{e.title}</span>
                <span className="block text-xs font-bold text-slate-400">
                  {eventCatLabel(e.category)}
                  {e.attachments.length ? ` · ${e.attachments.length} anexo(s)` : ''}
                </span>
              </span>
              {e.attachments.length ? <Paperclip size={15} className="shrink-0 text-slate-400" /> : null}
            </button>
          ))}
        </div>
      )}

      {dayModal ? (
        <DayModal
          date={dayModal}
          events={dayEvents(dayModal)}
          canManage={canManage}
          onClose={() => setDayModal(null)}
          onNew={() => openNew(dayModal)}
          onEdit={openEdit}
        />
      ) : null}
      {composeOpen ? <ComposeModal event={editing} onClose={() => setComposeOpen(false)} defaultDate={composeDate} /> : null}
      {importOpen ? <CalImportModal onClose={() => setImportOpen(false)} /> : null}
    </>
  );
}

function DayModal({
  date,
  events,
  canManage,
  onClose,
  onNew,
  onEdit,
}: {
  date: Date;
  events: EventWithMeta[];
  canManage: boolean;
  onClose: () => void;
  onNew: () => void;
  onEdit: (e: EventWithMeta) => void;
}) {
  return (
    <Modal open onClose={onClose} title={format(date, "EEEE, d 'de' MMMM", { locale: ptBR })} size="xl">
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">Nenhum evento neste dia.</p>
        ) : (
          events.map((e) => <EventCard key={e.id} event={e} canManage={canManage} onEdit={() => onEdit(e)} />)
        )}
        {canManage ? (
          <Button variant="soft" className="w-full" onClick={onNew}>
            <Plus size={16} /> Novo evento neste dia
          </Button>
        ) : null}
      </div>
    </Modal>
  );
}

function CalImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<ParsedEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function handleFile(file?: File | null) {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const rows = await parseCalendarFile(file);
      if (!rows.length) setErr('Nenhum evento reconhecido. Confira o modelo (Data e Título são obrigatórios).');
      setParsed(rows);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const importMut = useMutation({
    mutationFn: () => bulkCreateEvents(parsed ?? []),
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['cal-events'] });
      onClose();
      successToast(`${n} evento(s) importado(s)`);
    },
  });

  return (
    <Modal open onClose={onClose} title="Importar calendário" size="xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Suba um <b>.xlsx</b>/<b>.csv</b> (modelo abaixo) ou um <b>.ics</b> (exportado de outra agenda). O sistema lê o arquivo, identifica
          os dias com eventos e cria tudo no calendário para todos os envolvidos por padrão.
        </p>
        <Button variant="ghost" onClick={() => downloadCalendarTemplate()}>
          <Download size={16} /> Baixar planilha-modelo
        </Button>

        <Dropzone
          accept=".xlsx,.xls,.csv,.ics"
          multiple={false}
          title="Arraste e solte aqui, ou clique em Procurar arquivo"
          hint="Planilha .xlsx/.csv ou agenda .ics"
          onFiles={(l) => handleFile(l?.[0])}
        />

        {busy ? <p className="text-sm text-slate-500">Lendo arquivo…</p> : null}
        {err ? <p className="text-sm font-semibold text-red-600">{err}</p> : null}

        {parsed && parsed.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-bold text-slate-700">{parsed.length} evento(s) encontrado(s):</p>
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
              {parsed.slice(0, 50).map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: eventColor(e.category) }} />
                  <span className="w-20 shrink-0 font-bold text-slate-500">{e.event_date.slice(8, 10)}/{e.event_date.slice(5, 7)}</span>
                  <span className="truncate font-bold text-slate-800">{e.title}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button onClick={() => importMut.mutate()} disabled={importMut.isPending}>
                {importMut.isPending ? 'Importando…' : `Importar ${parsed.length}`}
              </Button>
            </div>
            {importMut.isError ? <p className="text-sm font-semibold text-red-600">{(importMut.error as Error).message}</p> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function MiniMonth({
  monthDate,
  dayEvents,
  onSelect,
}: {
  monthDate: Date;
  dayEvents: (d: Date) => EventWithMeta[];
  onSelect: (d: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 }),
  });
  const today = new Date();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-center text-sm font-black capitalize text-slate-800">{format(monthDate, 'MMMM', { locale: ptBR })}</p>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase text-slate-400">
        {WD.map((w) => (
          <div key={w} className="pb-1">{w[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const out = !isSameMonth(d, monthDate);
          const evs = out ? [] : dayEvents(d);
          const isToday = isSameDay(d, today);
          const has = evs.length > 0;
          const color = has ? eventColor(evs[0].category) : undefined;
          return (
            <button
              key={d.toISOString()}
              onClick={() => !out && onSelect(d)}
              disabled={out}
              title={has ? evs.map((e) => `${eventCatLabel(e.category)}: ${e.title}`).join(', ') : undefined}
              className={cn(
                'relative flex min-h-20 flex-col rounded-lg border p-1 text-left text-xs transition',
                out ? 'border-transparent text-transparent' : 'border-slate-100 bg-slate-50 text-slate-700 hover:ring-2 hover:ring-emerald-300',
                has && !out && 'bg-white',
                isToday && !out && 'border-emerald-400 ring-1 ring-emerald-300',
              )}
            >
              <span
                className={cn('mb-1 grid h-5 w-5 place-items-center rounded-md text-[11px] font-black', has ? 'text-white' : 'text-slate-500')}
                style={has ? { backgroundColor: color } : undefined}
              >
                {format(d, 'd')}
              </span>
              <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {evs.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className="truncate rounded px-1 py-0.5 text-[9px] font-black leading-tight"
                    style={{ backgroundColor: eventSoftColor(e.category), color: eventColor(e.category) }}
                  >
                    {eventCatLabel(e.category)} · {e.title}
                  </span>
                ))}
                {evs.length > 2 ? <span className="px-1 text-[9px] font-black text-slate-400">+{evs.length - 2} evento(s)</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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
            {` · ${audienceLabel(e)}`}
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
            {([['all', 'Todos'], ['role', 'Por perfil'], ['user', 'Pessoa']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setAudience(v)}
                className={cn('rounded-xl border px-3 py-2.5 text-sm font-bold transition', audience === v ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600')}
              >
                {l}
              </button>
            ))}
          </div>
          {audience === 'all' ? (
            <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              Aparece para todos os logins envolvidos nesta organização: professores, secretaria, coordenação, direção, marketing e suporte.
            </p>
          ) : null}
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
          <Dropzone
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.rtf,.odt,.pages,.key,.numbers,.heic,.heif"
            hint="PDF, DOC/DOCX, PPTX, XLSX, PNG, JPG, HEIC, Pages, Keynote…"
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
