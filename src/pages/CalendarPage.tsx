import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { successToast } from "../components/Feedback";
import { canManageCalendar } from "../lib/permissions";
import { CALENDAR_CONFLICT, loadCalendarBuilder, saveCalendarBuilder } from "../lib/queries";
import type {
  CalBuilderEvent as CalEvent,
  CalCategory as Category,
  CalendarBuilderData as CalendarData,
  CalPeriod as Period,
} from "../lib/types";

/* ============================================================================
   Construtor de Calendário Escolar — React + TypeScript
   ----------------------------------------------------------------------------
   • A coordenação alimenta os dados no Editor (categorias, eventos, períodos)
     e o calendário aparece preenchido automaticamente (preview ao vivo).
   • Cores livres por categoria — o contraste do texto é calculado sozinho.
   • Visão "Ano completo" ou qualquer "Período/Trimestre" configurável.
   • Persistido no Supabase: a coordenação salva e o calendário fica disponível
     para todos os usuários da organização (multi-tenant). Export/Import JSON e
     Imprimir/PDF continuam disponíveis.
============================================================================ */

/* --------------------------- Utilidades ---------------------------------- */
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DOW = [["S","seg"],["T","ter"],["Q","qua"],["Q","qui"],["S","sex"],["S","sáb"],["D","dom"]]; // semana inicia na segunda
const uid = () => Math.random().toString(36).slice(2, 9);
const pad2 = (n: number) => String(n).padStart(2, "0");

function hexToRgb(hex: string) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h || "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const rgba = (hex: string, a: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
/** Texto legível (preto/branco) sobre qualquer cor — garante leitura ao professor. */
function readableText(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return L > 0.6 ? "#1F2A24" : "#FFFFFF";
}
function parseISO(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** Lista de {y,m,d} cobertos por um evento (intervalo inclusivo). */
function eventDays(ev: CalEvent) {
  const start = parseISO(ev.start);
  const end = ev.end ? parseISO(ev.end) : start;
  const out: { y: number; m: number; d: number }[] = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push({ y: cur.getFullYear(), m: cur.getMonth(), d: cur.getDate() });
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}
function daysInMonthFor(ev: CalEvent, year: number, month: number) {
  return eventDays(ev).filter((x) => x.y === year && x.m === month).map((x) => x.d).sort((a, b) => a - b);
}
function chipLabel(days: number[]) {
  if (days.length === 0) return "";
  if (days.length === 1) return pad2(days[0]);
  return `${pad2(days[0])}–${pad2(days[days.length - 1])}`;
}

/* ----------------------- Dados iniciais (semente) ------------------------ */
const d = (m: number, day: number) => `2026-${pad2(m + 1)}-${pad2(day)}`;
const SEED: CalendarData = {
  school: "Sua escola",
  title: "Calendário 2026",
  year: 2026,
  categories: [
    { id: "feriado", label: "Feriado", color: "#E0544A" },
    { id: "avaliacao", label: "Avaliação", color: "#D9822B" },
    { id: "pedagogico", label: "Pedagógico", color: "#3D6FD1" },
    { id: "evento", label: "Evento & Cultura", color: "#2E9E6B" },
    { id: "recuperacao", label: "Recuperação Paralela", color: "#8557C6" },
    { id: "comemorativa", label: "Data comemorativa", color: "#D6549B" },
    { id: "marco", label: "Marco do período", color: "#5E7585" },
  ],
  periods: [
    { id: uid(), label: "1º Trimestre", startMonth: 1, endMonth: 3 },
    { id: uid(), label: "2º Trimestre", startMonth: 4, endMonth: 7 },
    { id: uid(), label: "3º Trimestre", startMonth: 8, endMonth: 11 },
  ],
  letivosByMonth: {},
  notes: "",
  events: [
    { id: uid(), title: "Feriado do Dia do Trabalhador", categoryId: "feriado", start: d(4, 1) },
    { id: uid(), title: "Dia das Mães", categoryId: "comemorativa", start: d(4, 9) },
  ],
};

function fmtStamp(iso: string | null, name: string | null) {
  if (!name && !iso) return null;
  const when = iso
    ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  if (name && when) return `Última edição por ${name} · ${when}`;
  if (name) return `Última edição por ${name}`;
  return when ? `Última edição em ${when}` : null;
}

/* ====================== Página (carrega/salva no Supabase) ====================== */
export function CalendarPage() {
  const { role, activeOrgId, profile, user } = useAuth();
  const canManage = canManageCalendar(role);
  const qc = useQueryClient();
  const [reloadKey, setReloadKey] = useState(0);

  const { data: loaded, isLoading, isError, error } = useQuery({
    queryKey: ["calendar-builder", activeOrgId, reloadKey],
    queryFn: loadCalendarBuilder,
  });

  const updaterName = profile?.full_name || profile?.email || "Usuário";
  const updaterId = user?.id ?? null;

  if (isLoading) {
    return <div className="grid place-items-center p-16 text-sm font-bold text-slate-400">Carregando calendário…</div>;
  }

  return (
    <>
      {isError ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-700">
          Não foi possível carregar o calendário. Verifique se a migração `calendar_builder` foi rodada no Supabase.{" "}
          {(error as Error).message}
        </p>
      ) : null}
      <CalendarBuilder
        key={`${activeOrgId ?? "none"}:${reloadKey}`}
        initialData={loaded?.data ?? SEED}
        initialVersion={loaded?.version ?? null}
        initialStamp={fmtStamp(loaded?.updatedAt ?? null, loaded?.updatedByName ?? null)}
        canManage={canManage}
        save={async ({ data, expectedVersion }) => {
          try {
            const meta = await saveCalendarBuilder({ data, expectedVersion, updaterId, updaterName });
            successToast("Calendário salvo para toda a equipe");
            qc.invalidateQueries({ queryKey: ["calendar-builder", activeOrgId] });
            return { version: meta.version, stamp: fmtStamp(meta.updatedAt, meta.updatedByName) };
          } catch (e) {
            if ((e as Error).message === CALENDAR_CONFLICT) {
              alert(
                "Outro coordenador salvou o calendário enquanto você editava.\n\n" +
                  "Para não sobrescrever o trabalho dele, suas alterações não salvas serão descartadas e a versão atualizada será recarregada.",
              );
              setReloadKey((k) => k + 1); // remonta com os dados frescos do banco
              return "conflict";
            }
            throw e;
          }
        }}
      />
    </>
  );
}

/* ============================== Construtor =============================== */
type SaveResult = "conflict" | { version: number; stamp: string | null };
function CalendarBuilder({
  initialData,
  initialVersion,
  initialStamp,
  canManage,
  save,
}: {
  initialData: CalendarData;
  initialVersion: number | null;
  initialStamp: string | null;
  canManage: boolean;
  save: (args: { data: CalendarData; expectedVersion: number | null }) => Promise<SaveResult>;
}) {
  const [data, setData] = useState<CalendarData>(initialData);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initialData));
  const [editing, setEditing] = useState(canManage);
  const [viewId, setViewId] = useState<string>(initialData.periods[1]?.id ?? "year");
  const [active, setActive] = useState<Set<string>>(new Set(initialData.categories.map((c) => c.id)));
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState<number | null>(initialVersion);
  const [stamp, setStamp] = useState<string | null>(initialStamp);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify(data) !== savedJson;

  const catById = useMemo(
    () => Object.fromEntries(data.categories.map((c) => [c.id, c])),
    [data.categories]
  );

  // Meses visíveis conforme a seleção (Ano completo ou período)
  const months = useMemo<number[]>(() => {
    if (viewId === "year") return Array.from({ length: 12 }, (_, i) => i);
    const p = data.periods.find((x) => x.id === viewId);
    if (!p) return Array.from({ length: 12 }, (_, i) => i);
    const out: number[] = [];
    for (let m = p.startMonth; m <= p.endMonth; m++) out.push(m);
    return out;
  }, [viewId, data.periods]);

  const totalLetivos = useMemo(
    () => months.reduce((s, m) => s + (data.letivosByMonth[m] || 0), 0),
    [months, data.letivosByMonth]
  );

  /* ---- helpers de mutação ---- */
  const set = (patch: Partial<CalendarData>) => setData((p) => ({ ...p, ...patch }));
  const toggleCat = (id: string) =>
    setActive((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const addCategory = () =>
    set({ categories: [...data.categories, { id: uid(), label: "Nova categoria", color: "#6366F1" }] });
  const updateCategory = (id: string, patch: Partial<Category>) =>
    set({ categories: data.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeCategory = (id: string) =>
    set({
      categories: data.categories.filter((c) => c.id !== id),
      events: data.events.filter((e) => e.categoryId !== id),
    });

  const addEvent = () =>
    set({
      events: [
        ...data.events,
        { id: uid(), title: "Novo evento", categoryId: data.categories[0]?.id ?? "", start: `${data.year}-01-01` },
      ],
    });
  const updateEvent = (id: string, patch: Partial<CalEvent>) =>
    set({ events: data.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  const removeEvent = (id: string) => set({ events: data.events.filter((e) => e.id !== id) });

  const addPeriod = () =>
    set({ periods: [...data.periods, { id: uid(), label: "Novo período", startMonth: 0, endMonth: 2 }] });
  const updatePeriod = (id: string, patch: Partial<Period>) =>
    set({ periods: data.periods.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const removePeriod = (id: string) => {
    set({ periods: data.periods.filter((p) => p.id !== id) });
    if (viewId === id) setViewId("year");
  };

  /* ---- salvar no Supabase (trava otimista por versão) ---- */
  const handleSave = async () => {
    if (saving) return;
    const snapshot = data;
    setSaving(true);
    try {
      const res = await save({ data: snapshot, expectedVersion: version });
      if (res === "conflict") return; // a página remonta com os dados frescos do banco
      setVersion(res.version);
      setStamp(res.stamp);
      setSavedJson(JSON.stringify(snapshot));
    } catch (e) {
      alert("Não foi possível salvar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  /* ---- exportar / importar JSON ---- */
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calendario-${data.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file: File) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(String(r.result)) as CalendarData;
        setData(parsed);
        setActive(new Set(parsed.categories.map((c) => c.id)));
        setViewId("year");
      } catch {
        alert("Arquivo inválido. Selecione um JSON exportado por este app.");
      }
    };
    r.readAsText(file);
  };

  /* ============================== Render ============================== */
  return (
    <div className="cb-app">
      <style>{CSS}</style>

      {/* Cabeçalho global */}
      <header className="cb-top">
        <div className="cb-brand">
          <div className="cb-mark">{(data.school[0] || "C").toUpperCase()}</div>
          <div>
            <div className="cb-eyebrow">{data.school}</div>
            <h1 className="cb-h1">{data.title}</h1>
            {stamp ? <div className="cb-stamp">{stamp}</div> : null}
          </div>
        </div>
        <div className="cb-top-actions">
          <select className="cb-select" value={viewId} onChange={(e) => setViewId(e.target.value)} aria-label="Visualização">
            <option value="year">Ano completo ({data.year})</option>
            {data.periods.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          {canManage ? (
            <button className="cb-btn" onClick={() => setEditing((v) => !v)}>
              {editing ? "Ocultar editor" : "✎ Editar"}
            </button>
          ) : null}
          {canManage ? (
            <button className="cb-btn cb-btn-primary" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? "Salvando…" : dirty ? "Salvar" : "✓ Salvo"}
            </button>
          ) : null}
          <button className="cb-btn" onClick={() => window.print()}>Imprimir / PDF</button>
          <button className="cb-btn" onClick={exportJSON}>Exportar</button>
          {canManage ? (
            <>
              <button className="cb-btn" onClick={() => fileRef.current?.click()}>Importar</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && importJSON(e.target.files[0])}
              />
            </>
          ) : null}
        </div>
      </header>

      <div className={`cb-layout ${editing ? "with-editor" : ""}`}>
        {/* ---------------- EDITOR ---------------- */}
        {editing && canManage && (
          <aside className="cb-editor">
            <Section title="Identificação">
              <Field label="Escola">
                <input className="cb-input" value={data.school} onChange={(e) => set({ school: e.target.value })} />
              </Field>
              <Field label="Título do calendário">
                <input className="cb-input" value={data.title} onChange={(e) => set({ title: e.target.value })} />
              </Field>
              <Field label="Ano letivo">
                <input
                  className="cb-input"
                  type="number"
                  value={data.year}
                  onChange={(e) => set({ year: Number(e.target.value) })}
                />
              </Field>
            </Section>

            <Section title="Categorias" action={<button className="cb-add" onClick={addCategory}>+ Categoria</button>}>
              <p className="cb-help">Cores livres — o texto se ajusta para boa leitura automaticamente.</p>
              {data.categories.map((c) => (
                <div className="cb-row" key={c.id}>
                  <input
                    type="color"
                    className="cb-color"
                    value={c.color}
                    onChange={(e) => updateCategory(c.id, { color: e.target.value })}
                    aria-label={`Cor de ${c.label}`}
                  />
                  <input
                    className="cb-input cb-grow"
                    value={c.label}
                    onChange={(e) => updateCategory(c.id, { label: e.target.value })}
                  />
                  <button className="cb-del" onClick={() => removeCategory(c.id)} aria-label="Remover">×</button>
                </div>
              ))}
            </Section>

            <Section title="Períodos / Trimestres" action={<button className="cb-add" onClick={addPeriod}>+ Período</button>}>
              <p className="cb-help">Cada período vira uma opção no seletor “Visualização”.</p>
              {data.periods.map((p) => (
                <div className="cb-prow" key={p.id}>
                  <input
                    className="cb-input cb-grow"
                    value={p.label}
                    onChange={(e) => updatePeriod(p.id, { label: e.target.value })}
                  />
                  <select className="cb-input cb-mini" value={p.startMonth} onChange={(e) => updatePeriod(p.id, { startMonth: Number(e.target.value) })}>
                    {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m.slice(0, 3)}</option>)}
                  </select>
                  <span className="cb-to">→</span>
                  <select className="cb-input cb-mini" value={p.endMonth} onChange={(e) => updatePeriod(p.id, { endMonth: Number(e.target.value) })}>
                    {MONTHS_PT.map((m, i) => <option key={i} value={i}>{m.slice(0, 3)}</option>)}
                  </select>
                  <button className="cb-del" onClick={() => removePeriod(p.id)} aria-label="Remover">×</button>
                </div>
              ))}
            </Section>

            <Section title={`Eventos (${data.events.length})`} action={<button className="cb-add" onClick={addEvent}>+ Evento</button>}>
              {[...data.events].sort((a, b) => a.start.localeCompare(b.start)).map((ev) => (
                <div className="cb-event" key={ev.id} style={{ borderLeftColor: catById[ev.categoryId]?.color ?? "#ccc" }}>
                  <input
                    className="cb-input"
                    value={ev.title}
                    placeholder="Título do evento"
                    onChange={(e) => updateEvent(ev.id, { title: e.target.value })}
                  />
                  <div className="cb-event-grid">
                    <select className="cb-input" value={ev.categoryId} onChange={(e) => updateEvent(ev.id, { categoryId: e.target.value })}>
                      {data.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <input className="cb-input" type="date" value={ev.start} onChange={(e) => updateEvent(ev.id, { start: e.target.value })} />
                    <input
                      className="cb-input"
                      type="date"
                      value={ev.end ?? ""}
                      placeholder="fim (opcional)"
                      onChange={(e) => updateEvent(ev.id, { end: e.target.value || undefined })}
                    />
                    <button className="cb-del" onClick={() => removeEvent(ev.id)} aria-label="Remover">× remover</button>
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Rodapé">
              <Field label="Observações">
                <textarea className="cb-input cb-area" rows={3} value={data.notes} onChange={(e) => set({ notes: e.target.value })} />
              </Field>
            </Section>
          </aside>
        )}

        {/* ---------------- PREVIEW (visual aprovado) ---------------- */}
        <main className="cb-preview">
          {/* Filtros por categoria */}
          <div className="cb-filters">
            <span className="cb-hint">Filtrar:</span>
            {data.categories.map((c) => {
              const on = active.has(c.id);
              return (
                <button
                  key={c.id}
                  className="cb-chip"
                  aria-pressed={on}
                  onClick={() => toggleCat(c.id)}
                  style={{
                    color: on ? "#1F2A24" : "#5C6B62",
                    borderColor: on ? rgba(c.color, 0.55) : "#E7E4DA",
                    background: on ? rgba(c.color, 0.1) : "#fff",
                    opacity: on ? 1 : 0.55,
                  }}
                >
                  <span className="cb-cdot" style={{ background: c.color }} />
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="cb-months">
            {months.map((m) => (
              <MonthCard
                key={m}
                year={data.year}
                month={m}
                events={data.events}
                catById={catById}
                active={active}
                letivos={data.letivosByMonth[m]}
              />
            ))}
          </div>

          <footer className="cb-foot">
            <div className="cb-note">{data.notes}</div>
            {totalLetivos > 0 && (
              <div>Dias letivos no período: <strong>{totalLetivos}</strong></div>
            )}
          </footer>
        </main>
      </div>
    </div>
  );
}

/* --------------------------- Subcomponentes ------------------------------ */
function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="cb-section">
      <div className="cb-section-head">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="cb-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function MonthCard({
  year, month, events, catById, active, letivos,
}: {
  year: number; month: number; events: CalEvent[];
  catById: Record<string, Category>; active: Set<string>; letivos?: number;
}) {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = segunda
  const nDays = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  // dia -> categorias presentes
  const dayCats: Record<number, string[]> = {};
  const monthEvents = events
    .map((ev) => ({ ev, days: daysInMonthFor(ev, year, month) }))
    .filter((x) => x.days.length > 0);
  monthEvents.forEach(({ ev, days }) => {
    days.forEach((day) => {
      (dayCats[day] = dayCats[day] || []).push(ev.categoryId);
    });
  });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(<div key={`e${i}`} className="cb-cell empty" />);
  for (let day = 1; day <= nDays; day++) {
    const cats = Array.from(new Set(dayCats[day] || []));
    const visible = cats.filter((c) => active.has(c));
    const has = cats.length > 0;
    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
    const primary = visible[0] ? catById[visible[0]]?.color : undefined;
    cells.push(
      <div
        key={day}
        className={`cb-cell ${has ? "has" : ""} ${isToday ? "today" : ""} ${has && visible.length === 0 ? "dim" : ""}`}
        style={primary ? { background: rgba(primary, 0.16), fontWeight: 700 } : undefined}
      >
        {day}
        {visible.length > 0 && (
          <span className="cb-dots">
            {visible.slice(0, 3).map((c, i) => (
              <i key={i} style={{ background: catById[c]?.color }} />
            ))}
          </span>
        )}
      </div>
    );
  }

  const listed = monthEvents
    .map(({ ev, days }) => ({ ev, days, min: days[0] }))
    .sort((a, b) => a.min - b.min);

  return (
    <section className="cb-month">
      <div className="cb-month-head">
        <h2>{MONTHS_PT[month]}</h2>
        {letivos ? <span className="cb-badge">{letivos} dias letivos</span> : null}
      </div>
      <div className="cb-cal">
        <div className="cb-dow">
          {DOW.map(([s, full], i) => <span key={i} title={full}>{s}</span>)}
        </div>
        <div className="cb-grid">{cells}</div>
      </div>
      <div className="cb-events">
        {listed.length === 0 && <p className="cb-empty">Sem eventos neste mês.</p>}
        {listed.map(({ ev, days }) => {
          const cat = catById[ev.categoryId];
          const on = active.has(ev.categoryId);
          if (!cat) return null;
          return (
            <div className={`cb-ev ${on ? "" : "dim"}`} key={ev.id}>
              <span className="cb-date" style={{ background: cat.color, color: readableText(cat.color) }}>
                {chipLabel(days)}
              </span>
              <span className="cb-txt">
                {ev.title}
                <small style={{ color: cat.color }}>{cat.label}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------- Estilo ---------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

.cb-app{--paper:#FBFAF6;--surface:#fff;--ink:#1F2A24;--ink-soft:#5C6B62;--line:#E7E4DA;--line-soft:#F0EEE6;--green:#1B6B4C;--green-2:#2E9E6B;
  font-family:"Plus Jakarta Sans",system-ui,-apple-system,sans-serif;color:var(--ink);background:var(--paper);min-height:100%;line-height:1.5;-webkit-font-smoothing:antialiased;border-radius:18px;overflow:hidden;border:1px solid var(--line)}
.cb-app *{box-sizing:border-box}

.cb-top{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;padding:18px clamp(16px,3vw,32px);border-bottom:1px solid var(--line);background:var(--surface)}
.cb-brand{display:flex;align-items:center;gap:13px}
.cb-mark{width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff;font-weight:700;font-family:"Fraunces",serif;font-size:19px;background:radial-gradient(circle at 30% 30%,var(--green-2),var(--green))}
.cb-eyebrow{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);font-weight:600}
.cb-h1{margin:1px 0 0;font-family:"Fraunces",serif;font-weight:600;font-size:clamp(22px,3.2vw,30px);letter-spacing:-.01em;line-height:1.05}
.cb-stamp{margin-top:4px;font-size:11.5px;font-weight:600;color:var(--ink-soft)}
.cb-top-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cb-btn,.cb-select{font:inherit;font-weight:600;font-size:13.5px;cursor:pointer;border:1px solid var(--line);background:var(--surface);color:var(--ink);padding:8px 14px;border-radius:999px;transition:.15s}
.cb-btn:hover,.cb-select:hover{border-color:var(--green-2);color:var(--green)}
.cb-btn:disabled{opacity:.5;cursor:default;border-color:var(--line);color:var(--ink-soft)}
.cb-btn-primary{background:var(--green);border-color:var(--green);color:#fff}
.cb-btn-primary:hover{background:var(--green-2);border-color:var(--green-2);color:#fff}
.cb-btn-primary:disabled{background:var(--surface);color:var(--ink-soft)}

.cb-layout{display:grid;grid-template-columns:1fr;gap:0}
.cb-layout.with-editor{grid-template-columns:minmax(320px,380px) 1fr}
@media (max-width:900px){.cb-layout.with-editor{grid-template-columns:1fr}}

/* Editor */
.cb-editor{background:var(--surface);border-right:1px solid var(--line);padding:20px clamp(14px,2vw,22px);max-height:none}
@media (min-width:901px){.cb-editor{position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto}}
.cb-section{padding:14px 0;border-bottom:1px solid var(--line-soft)}
.cb-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.cb-section-head h3{margin:0;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink)}
.cb-help{margin:0 0 10px;font-size:12px;color:var(--ink-soft)}
.cb-field{display:block;margin-bottom:10px}
.cb-field>span{display:block;font-size:12px;font-weight:600;color:var(--ink-soft);margin-bottom:4px}
.cb-input{width:100%;font:inherit;font-size:13.5px;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:9px;padding:8px 10px;outline:none;transition:.15s}
.cb-input:focus{border-color:var(--green-2);box-shadow:0 0 0 3px ${rgba("#2E9E6B", 0.12)}}
.cb-area{resize:vertical;line-height:1.4}
.cb-grow{flex:1;min-width:0}
.cb-mini{width:78px;padding:8px 6px}
.cb-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.cb-prow{display:flex;gap:6px;align-items:center;margin-bottom:8px}
.cb-to{color:var(--ink-soft);font-size:13px}
.cb-color{width:34px;height:34px;flex:none;border:1px solid var(--line);border-radius:9px;background:#fff;padding:2px;cursor:pointer}
.cb-add{font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;border:1px dashed var(--green-2);color:var(--green);background:${rgba("#2E9E6B", 0.06)};padding:5px 11px;border-radius:999px}
.cb-add:hover{background:${rgba("#2E9E6B", 0.12)}}
.cb-del{font:inherit;font-size:13px;font-weight:700;cursor:pointer;border:none;background:none;color:#E0544A;padding:4px 6px;border-radius:8px;white-space:nowrap}
.cb-del:hover{background:${rgba("#E0544A", 0.1)}}
.cb-event{border:1px solid var(--line);border-left-width:4px;border-radius:10px;padding:10px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;background:#fff}
.cb-event-grid{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:center}
@media (max-width:520px){.cb-event-grid{grid-template-columns:1fr 1fr}}

/* Preview */
.cb-preview{padding:clamp(18px,3vw,32px) clamp(16px,3vw,36px) 60px;min-width:0}
.cb-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:22px}
.cb-hint{font-size:13px;color:var(--ink-soft);margin-right:2px}
.cb-chip{font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:6px 13px 6px 11px;border-radius:999px;border:1px solid var(--line);display:inline-flex;align-items:center;gap:7px;transition:.15s}
.cb-chip:hover{transform:translateY(-1px)}
.cb-cdot{width:11px;height:11px;border-radius:50%;flex:none}

.cb-months{display:grid;gap:clamp(16px,2.2vw,24px);grid-template-columns:repeat(auto-fit,minmax(290px,1fr))}
.cb-month{background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(31,42,36,.04),0 8px 24px rgba(31,42,36,.06);overflow:hidden;display:flex;flex-direction:column}
.cb-month-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:16px 18px 12px;border-bottom:1px solid var(--line-soft)}
.cb-month-head h2{margin:0;font-family:"Fraunces",serif;font-weight:600;font-size:22px;letter-spacing:-.01em}
.cb-badge{font-size:11.5px;font-weight:600;color:var(--green);background:${rgba("#2E9E6B", 0.12)};border:1px solid ${rgba("#2E9E6B", 0.22)};padding:3px 10px;border-radius:999px;white-space:nowrap}
.cb-cal{padding:12px 12px 2px}
.cb-dow{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:4px}
.cb-dow span{text-align:center;font-size:11px;font-weight:700;color:var(--ink-soft);padding:3px 0}
.cb-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
.cb-cell{aspect-ratio:1/1;border-radius:9px;display:flex;align-items:center;justify-content:center;position:relative;font-size:13px;font-weight:500;color:var(--ink)}
.cb-cell.empty{visibility:hidden}
.cb-cell.dim{opacity:.25}
.cb-cell.today{outline:2px solid var(--green);outline-offset:1px}
.cb-cell.today::after{content:"hoje";position:absolute;top:-7px;font-size:8px;font-weight:700;color:var(--green);background:var(--surface);padding:0 3px}
.cb-dots{display:flex;gap:2px;position:absolute;bottom:5px}
.cb-dots i{width:5px;height:5px;border-radius:50%}
.cb-events{padding:6px 16px 18px;display:flex;flex-direction:column;gap:2px;flex:1}
.cb-empty{font-size:12.5px;color:var(--ink-soft);padding:6px 4px;margin:0}
.cb-ev{display:flex;gap:11px;padding:8px 6px;border-radius:10px;align-items:flex-start;transition:.12s}
.cb-ev:hover{background:var(--line-soft)}
.cb-ev.dim{opacity:.2;filter:grayscale(.3)}
.cb-date{flex:none;min-width:42px;text-align:center;font-weight:700;font-size:12.5px;border-radius:8px;padding:5px 6px;line-height:1.15}
.cb-txt{font-size:13.5px;color:var(--ink);padding-top:2px}
.cb-txt small{display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-top:2px;opacity:.9}
.cb-foot{margin-top:28px;padding-top:16px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between;align-items:center;font-size:12.5px;color:var(--ink-soft)}
.cb-note{max-width:680px;white-space:pre-wrap}
.cb-foot strong{color:var(--ink)}

@media print{
  .cb-top-actions,.cb-editor,.cb-filters{display:none!important}
  .cb-layout.with-editor{grid-template-columns:1fr}
  .cb-app{background:#fff;border:none;border-radius:0}
  .cb-months{grid-template-columns:repeat(2,1fr)}
  .cb-month{box-shadow:none;break-inside:avoid}
}
@media (prefers-reduced-motion:reduce){.cb-app *{transition:none!important}}
`;
