import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  eachDayOfInterval,
  addMonths,
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
import { CalendarCheck2, CalendarDays, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, FileSpreadsheet, FileText, Flag, Mail, Paperclip, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { AttachmentChips } from '../components/Attachments';
import { Dropzone } from '../components/Dropzone';
import { successToast } from '../components/Feedback';
import { Button, Card, Field, Input, Modal, PageHeader, Select } from '../components/ui';
import { cn } from '../lib/cn';
import { listNationalHolidays } from '../lib/holidays';
import { downloadCalendarTemplate, parseCalendarFile, type ParsedEvent } from '../lib/importCalendar';
import { canManageCalendar } from '../lib/permissions';
import {
  bulkCreateEvents,
  deleteCalendarHoliday,
  deleteCalendarUpload,
  deleteEvent,
  listCalendarHolidays,
  listCalendarUploads,
  listEvents,
  listOrgPeople,
  saveEvent,
  saveCalendarHoliday,
  uploadCalendarDocument,
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
  eventSoftColor,
  type AppRole,
  type CalendarHoliday,
  type CalendarUpload,
  type CalendarUploadSlot,
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
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [dayModal, setDayModal] = useState<Date | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDate, setComposeDate] = useState<Date>(today);
  const [importOpen, setImportOpen] = useState(false);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [editing, setEditing] = useState<EventWithMeta | null>(null);

  const { data: events = [] } = useQuery({ queryKey: ['cal-events'], queryFn: listEvents });
  const { data: nationalHolidays = [] } = useQuery({
    queryKey: ['national-holidays', format(currentMonth, 'yyyy')],
    queryFn: () => listNationalHolidays(Number(format(currentMonth, 'yyyy'))),
  });
  const { data: localHolidays = [] } = useQuery({ queryKey: ['calendar-holidays'], queryFn: listCalendarHolidays });

  const dayEvents = (d: Date) => events.filter((e) => inEvent(d, e));
  const holidays = useMemo(() => [...nationalHolidays, ...localHolidays], [nationalHolidays, localHolidays]);
  const dayHolidays = (d: Date) => holidays.filter((h) => isSameDay(day(h.date), d));
  const monthEvents = useMemo(
    () => events.filter((e) => {
      const start = day(e.event_date);
      const end = e.end_date ? day(e.end_date) : start;
      return isWithinInterval(start, { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
        || isWithinInterval(end, { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
        || isWithinInterval(currentMonth, { start, end });
    }),
    [events, currentMonth],
  );
  const monthHolidays = useMemo(
    () => holidays.filter((h) => isWithinInterval(day(h.date), { start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })),
    [holidays, currentMonth],
  );

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
        subtitle="Central de calendários prontos e eventos do ano letivo."
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setHolidayOpen(true)}>
                <Flag size={18} /> Feriado local
              </Button>
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

      <CalendarUploadCenter canManage={canManage} />

      <Card className="mb-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Ano letivo {format(currentMonth, 'yyyy')}</p>
            <h2 className="text-xl font-black capitalize text-slate-900">{format(currentMonth, 'MMMM yyyy', { locale: ptBR })}</h2>
          </div>
          <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth((m) => addMonths(m, -1))} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200">
            <ChevronLeft size={18} />
          </button>
          <Button variant="ghost" onClick={() => setCurrentMonth(startOfMonth(today))}>Hoje</Button>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 hover:bg-slate-200">
            <ChevronRight size={18} />
          </button>
          </div>
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
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Feriado
            </span>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
          <MonthCalendar monthDate={currentMonth} dayEvents={dayEvents} dayHolidays={dayHolidays} onSelect={setDayModal} />
          <MonthEventList events={monthEvents} holidays={monthHolidays} onSelect={(event) => setDayModal(day(event.event_date))} onHolidaySelect={(holiday) => setDayModal(day(holiday.date))} />
        </div>

      </Card>

      {dayModal ? (
        <DayModal
          date={dayModal}
          events={dayEvents(dayModal)}
          holidays={dayHolidays(dayModal)}
          canManage={canManage}
          onClose={() => setDayModal(null)}
          onNew={() => openNew(dayModal)}
          onEdit={openEdit}
        />
      ) : null}
      {composeOpen ? <ComposeModal event={editing} onClose={() => setComposeOpen(false)} defaultDate={composeDate} /> : null}
      {importOpen ? <CalImportModal onClose={() => setImportOpen(false)} /> : null}
      {holidayOpen ? <HolidayModal onClose={() => setHolidayOpen(false)} /> : null}
    </>
  );
}

function DayModal({
  date,
  events,
  holidays,
  canManage,
  onClose,
  onNew,
  onEdit,
}: {
  date: Date;
  events: EventWithMeta[];
  holidays: CalendarHoliday[];
  canManage: boolean;
  onClose: () => void;
  onNew: () => void;
  onEdit: (e: EventWithMeta) => void;
}) {
  return (
    <Modal open onClose={onClose} title={format(date, "EEEE, d 'de' MMMM", { locale: ptBR })} size="xl">
      <div className="space-y-3">
        {holidays.map((holiday) => <HolidayCard key={holiday.id} holiday={holiday} canManage={canManage && holiday.scope !== 'national'} />)}
        {events.length === 0 && holidays.length === 0 ? (
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

type SlotMeta = {
  slot: CalendarUploadSlot;
  title: string;
  description: string;
  color: string;
  soft: string;
  icon: typeof CalendarDays;
};
const CALENDAR_UPLOAD_SLOTS: SlotMeta[] = [
  {
    slot: 'annual',
    title: 'Calendário anual',
    description: 'Ano letivo completo. Visível para todos os perfis.',
    color: '#059669',
    soft: '#ecfdf5',
    icon: CalendarDays,
  },
  {
    slot: 'term1',
    title: '1º trimestre',
    description: 'Planejamento fechado do 1º trimestre.',
    color: '#2563eb',
    soft: '#eff6ff',
    icon: CalendarRange,
  },
  {
    slot: 'term2',
    title: '2º trimestre',
    description: 'Planejamento fechado do 2º trimestre.',
    color: '#7c3aed',
    soft: '#f5f3ff',
    icon: CalendarRange,
  },
  {
    slot: 'term3',
    title: '3º trimestre',
    description: 'Planejamento fechado do 3º trimestre.',
    color: '#ea580c',
    soft: '#fff7ed',
    icon: CalendarCheck2,
  },
];

const CAL_UPLOAD_ACCEPT = 'image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.pages,.key,.numbers,.heic,.heif';

function CalendarUploadCenter({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: uploads = [], isError, error } = useQuery({ queryKey: ['calendar-uploads'], queryFn: listCalendarUploads });

  const upload = useMutation({
    mutationFn: ({ slot, file }: { slot: CalendarUploadSlot; file: File }) => uploadCalendarDocument(slot, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-uploads'] });
      successToast('Calendário enviado');
    },
  });

  const remove = useMutation({
    mutationFn: (item: CalendarUpload) => deleteCalendarUpload(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-uploads'] });
      successToast('Calendário removido');
    },
  });

  const bySlot = useMemo(() => {
    const map = new Map<CalendarUploadSlot, CalendarUpload[]>();
    for (const item of uploads) {
      const list = map.get(item.slot) ?? [];
      list.push(item);
      map.set(item.slot, list);
    }
    return map;
  }, [uploads]);

  const ready = CALENDAR_UPLOAD_SLOTS.filter((slot) => (bySlot.get(slot.slot) ?? []).length > 0).length;
  return (
    <section className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
            <FileText size={22} />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Centro de uploads</p>
            <h2 className="mt-0.5 text-xl font-black text-slate-950">Calendários prontos</h2>
            <p className="mt-1 max-w-2xl text-sm font-medium leading-relaxed text-slate-500">
              Anexe o calendário anual e os trimestres em cards separados. Os perfis autorizados visualizam tudo no próprio login.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{ready}/4 enviados</span>
      </div>

      {isError ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
          Não foi possível carregar os uploads. Verifique se a migração `calendar_uploads` foi rodada no Supabase. {(error as Error).message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CALENDAR_UPLOAD_SLOTS.map((slot) => (
          <CalendarUploadSlotCard
            key={slot.slot}
            meta={slot}
            uploads={bySlot.get(slot.slot) ?? []}
            canManage={canManage}
            busy={upload.isPending || remove.isPending}
            onUpload={(file) => upload.mutate({ slot: slot.slot, file })}
            onDelete={(item) => confirm(`Remover "${item.name}"?`) && remove.mutate(item)}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarUploadSlotCard({
  meta,
  uploads,
  canManage,
  busy,
  onUpload,
  onDelete,
}: {
  meta: SlotMeta;
  uploads: CalendarUpload[];
  canManage: boolean;
  busy: boolean;
  onUpload: (file: File) => void;
  onDelete: (item: CalendarUpload) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const Icon = meta.icon;
  const latest = uploads[0];
  const filled = !!latest;

  function sendFile(file?: File | null) {
    if (file) onUpload(file);
  }

  return (
    <article
      onDragOver={(e) => {
        if (!canManage) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!canManage) return;
        e.preventDefault();
        setDragOver(false);
        sendFile(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        'group flex min-h-[260px] flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        dragOver ? 'border-emerald-400 ring-4 ring-emerald-100' : 'border-slate-200',
      )}
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1 ring-black/5" style={{ backgroundColor: meta.soft, color: meta.color }}>
              <Icon size={21} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-slate-950">{meta.title}</h3>
              <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-500">{meta.description}</p>
            </div>
          </div>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase', filled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
            {filled ? 'Anexado' : 'Vazio'}
          </span>
        </div>

        {latest ? (
          <div className="flex flex-1 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex min-w-0 items-start gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm">
                <FileText size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{latest.name}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                  Enviado em {format(parseISO(latest.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {latest.url ? (
                <a
                  href={latest.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={latest.name}
                  className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800"
                >
                  <Download size={15} /> Abrir
                </a>
              ) : null}
              {canManage ? (
                <button
                  onClick={() => onDelete(latest)}
                  disabled={busy}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600 transition hover:bg-red-100 disabled:opacity-60"
                  aria-label="Excluir calendário"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => canManage && inputRef.current?.click()}
            disabled={!canManage || busy}
            className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center transition hover:border-emerald-300 hover:bg-emerald-50/40 disabled:cursor-default disabled:hover:border-slate-200 disabled:hover:bg-slate-50"
          >
            <Paperclip size={20} className="mb-2 text-slate-300" />
            <p className="text-sm font-black text-slate-500">{canManage ? 'Enviar arquivo' : 'Sem arquivo'}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{canManage ? 'Clique ou arraste para anexar' : 'Ainda não disponibilizado'}</p>
          </button>
        )}

        {canManage ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-white text-xs font-black text-slate-600 ring-1 ring-slate-200 transition hover:text-emerald-700 hover:ring-emerald-200 disabled:opacity-50"
            >
              <RefreshCw size={14} /> {busy ? 'Enviando...' : filled ? 'Substituir arquivo' : 'Procurar arquivo'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={CAL_UPLOAD_ACCEPT}
              className="hidden"
              onChange={(e) => {
                sendFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MonthCalendar({
  monthDate,
  dayEvents,
  dayHolidays,
  onSelect,
}: {
  monthDate: Date;
  dayEvents: (d: Date) => EventWithMeta[];
  dayHolidays: (d: Date) => CalendarHoliday[];
  onSelect: (d: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 }),
  });
  const today = new Date();
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-7 text-center text-[11px] font-black uppercase text-slate-400">
        {WD.map((w) => (
          <div key={w} className="pb-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const out = !isSameMonth(d, monthDate);
          const evs = out ? [] : dayEvents(d);
          const hols = out ? [] : dayHolidays(d);
          const isToday = isSameDay(d, today);
          const has = evs.length > 0 || hols.length > 0;
          const color = evs.length > 0 ? eventColor(evs[0].category) : undefined;
          return (
            <button
              key={d.toISOString()}
              onClick={() => !out && onSelect(d)}
              disabled={out}
              title={has ? [...hols.map((h) => `Feriado: ${h.title}`), ...evs.map((e) => `${eventCatLabel(e.category)}: ${e.title}`)].join(', ') : undefined}
              className={cn(
                'relative flex min-h-24 flex-col rounded-lg border p-1.5 text-left text-xs transition sm:min-h-28',
                out ? 'border-transparent text-transparent' : 'border-slate-100 bg-slate-50 text-slate-700 hover:ring-2 hover:ring-emerald-300',
                has && !out && 'bg-white',
                isToday && !out && 'border-emerald-400 ring-1 ring-emerald-300',
              )}
            >
              <span
                className={cn('mb-1 grid h-5 w-5 place-items-center rounded-md text-[11px] font-black', has ? 'text-white' : 'text-slate-500')}
                style={has ? { backgroundColor: hols.length ? '#d97706' : color } : undefined}
              >
                {format(d, 'd')}
              </span>
              <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {hols.slice(0, 1).map((h) => (
                  <span
                    key={h.id}
                    className="truncate rounded bg-amber-50 px-1 py-0.5 text-[9px] font-black leading-tight text-amber-700"
                  >
                    Feriado · {h.title}
                  </span>
                ))}
                {evs.slice(0, 2).map((e) => (
                  <span
                    key={e.id}
                    className="truncate rounded px-1 py-0.5 text-[9px] font-black leading-tight"
                    style={{ backgroundColor: eventSoftColor(e.category), color: eventColor(e.category) }}
                  >
                    {eventCatLabel(e.category)} · {e.title}
                  </span>
                ))}
                {evs.length + hols.length > 3 ? <span className="px-1 text-[9px] font-black text-slate-400">+{evs.length + hols.length - 3} item(ns)</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthEventList({
  events,
  holidays,
  onSelect,
  onHolidaySelect,
}: {
  events: EventWithMeta[];
  holidays: CalendarHoliday[];
  onSelect: (event: EventWithMeta) => void;
  onHolidaySelect: (holiday: CalendarHoliday) => void;
}) {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Feriados e eventos do mês</h3>
      {events.length === 0 && holidays.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm font-bold text-slate-400">
          Nenhum feriado ou evento neste mês.
        </p>
      ) : (
        <div className="mt-3 max-h-[640px] space-y-2 overflow-y-auto pr-1">
          {holidays.map((h) => (
            <button
              key={h.id}
              onClick={() => onHolidaySelect(h)}
              className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-left transition hover:bg-amber-100"
            >
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg bg-amber-600 text-center text-xs font-black text-white">
                {h.date.slice(8, 10)}/{h.date.slice(5, 7)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-amber-900">{h.title}</span>
                <span className="block text-xs font-bold text-amber-700">{holidayScopeLabel(h)}</span>
              </span>
            </button>
          ))}
          {events.map((e) => (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg text-center text-xs font-black text-white" style={{ backgroundColor: eventColor(e.category) }}>
                {e.event_date.slice(8, 10)}/{e.event_date.slice(5, 7)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold text-slate-800">{e.title}</span>
                <span className="block text-xs font-bold text-slate-400">
                  {eventCatLabel(e.category)} · {audienceLabel(e)}
                  {e.attachments.length ? ` · ${e.attachments.length} anexo(s)` : ''}
                </span>
              </span>
              {e.attachments.length ? <Paperclip size={15} className="shrink-0 text-slate-400" /> : null}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function holidayScopeLabel(holiday: CalendarHoliday) {
  if (holiday.scope === 'national') return 'Feriado nacional';
  if (holiday.scope === 'state') return `Feriado estadual${holiday.state ? ` · ${holiday.state}` : ''}`;
  return `Feriado municipal${holiday.city ? ` · ${holiday.city}` : ''}`;
}

function HolidayCard({ holiday, canManage }: { holiday: CalendarHoliday; canManage: boolean }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteCalendarHoliday(holiday.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-holidays'] });
      successToast('Feriado removido');
    },
  });

  return (
    <Card className="border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-600 text-white">
          <Flag size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-black uppercase text-white">Feriado</span>
            <p className="font-black text-amber-950">{holiday.title}</p>
          </div>
          <p className="mt-0.5 text-xs font-bold text-amber-700">
            {format(day(holiday.date), 'dd/MM/yyyy', { locale: ptBR })} · {holidayScopeLabel(holiday)}
            {holiday.source ? ` · ${holiday.source}` : ''}
          </p>
        </div>
        {canManage ? (
          <button
            onClick={() => confirm(`Excluir "${holiday.title}"?`) && remove.mutate()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
            aria-label="Excluir feriado"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
    </Card>
  );
}

function HolidayModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [scope, setScope] = useState<'state' | 'city'>('city');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  const save = useMutation({
    mutationFn: () => saveCalendarHoliday({
      title: title.trim(),
      date,
      scope,
      state: scope === 'state' ? state.trim() || null : state.trim() || null,
      city: scope === 'city' ? city.trim() || null : null,
      source: 'Cadastro manual',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['calendar-holidays'] });
      onClose();
      successToast('Feriado local cadastrado');
    },
  });

  const valid = title.trim() && date && (scope !== 'city' || city.trim());

  return (
    <Modal open onClose={onClose} title="Novo feriado local">
      <div className="space-y-4">
        <Field label="Nome do feriado">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Aniversário da cidade" autoFocus />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Tipo">
            <Select value={scope} onChange={(e) => setScope(e.target.value as 'state' | 'city')}>
              <option value="city">Municipal</option>
              <option value="state">Estadual</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Estado / UF">
            <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Ex.: BA" maxLength={32} />
          </Field>
          <Field label="Cidade">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: Salvador" disabled={scope === 'state'} />
          </Field>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">
          Feriados nacionais aparecem automaticamente. Cadastre aqui feriados estaduais e municipais da sua realidade escolar.
        </p>
        {save.isError ? <p className="text-sm font-semibold text-red-600">{(save.error as Error).message}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>
            <Flag size={16} /> {save.isPending ? 'Salvando…' : 'Salvar feriado'}
          </Button>
        </div>
      </div>
    </Modal>
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
