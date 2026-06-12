import { EVENT_CATEGORIES } from './types';

export interface ParsedEvent {
  title: string;
  description: string;
  category: string;
  event_date: string; // yyyy-mm-dd
  end_date: string | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Converte vários formatos de data para yyyy-mm-dd. */
function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return toISO(v);
  if (typeof v === 'number') {
    // serial do Excel (dias desde 1899-12-30)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : toISO(d);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // yyyy-mm-dd
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); // dd/mm/yyyy
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${y}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : toISO(d);
}

/** Casa o texto da categoria com uma das categorias do sistema. */
function matchCategory(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return 'evento';
  const hit = EVENT_CATEGORIES.find((c) => c.key === s || c.label.toLowerCase() === s);
  if (hit) return hit.key;
  if (s.includes('prova')) return 'prova';
  if (s.includes('ginc')) return 'gincana';
  if (s.includes('reuni')) return 'reuniao';
  if (s.includes('ativ')) return 'atividade';
  return 'evento';
}

/** Gera e baixa a planilha-modelo para o coordenador preencher. */
export async function downloadCalendarTemplate() {
  const XLSX = await import('xlsx');
  const rows = [
    ['Data', 'Título', 'Categoria', 'Descrição', 'Até (opcional)'],
    ['2026-02-10', 'Início das aulas', 'Evento', 'Volta às aulas', ''],
    ['2026-03-20', 'Gincana cultural', 'Gincana', 'Atividades no pátio', '2026-03-21'],
    ['2026-06-15', 'Semana de provas', 'Semana de provas', '1º trimestre', '2026-06-19'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Calendario');
  XLSX.writeFile(wb, 'modelo-calendario.xlsx');
}

/** Lê o arquivo (.xlsx/.csv ou .ics) e devolve os eventos identificados. */
export async function parseCalendarFile(file: File): Promise<ParsedEvent[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.ics')) return parseIcs(await file.text());
  return parseSheet(file);
}

async function parseSheet(file: File): Promise<ParsedEvent[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const out: ParsedEvent[] = [];
  for (const r of rows) {
    // aceita cabeçalhos em pt (Data/Título/...) de forma flexível
    const get = (keys: string[]) => {
      for (const k of Object.keys(r)) {
        const kk = k.toLowerCase().trim();
        if (keys.some((t) => kk.startsWith(t))) return r[k];
      }
      return '';
    };
    const date = parseDate(get(['data', 'date', 'dia', 'início', 'inicio']));
    const title = String(get(['título', 'titulo', 'evento', 'nome', 'title']) ?? '').trim();
    if (!date || !title) continue;
    out.push({
      title,
      description: String(get(['descri', 'detalhe', 'obs']) ?? '').trim(),
      category: matchCategory(get(['categoria', 'tipo', 'category'])),
      event_date: date,
      end_date: parseDate(get(['até', 'ate', 'fim', 'término', 'termino', 'end'])),
    });
  }
  return out;
}

/** Parser mínimo de iCalendar (.ics): extrai VEVENTs (SUMMARY/DTSTART/DTEND/DESCRIPTION). */
function parseIcs(text: string): ParsedEvent[] {
  // desdobra linhas continuadas (RFC 5545: linha seguinte começa com espaço)
  const lines = text.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  const out: ParsedEvent[] = [];
  let cur: Record<string, string> | null = null;
  const icsDate = (v: string): string | null => {
    const m = v.match(/(\d{4})(\d{2})(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };
  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) cur = {};
    else if (line.startsWith('END:VEVENT')) {
      if (cur) {
        const date = icsDate(cur.DTSTART || '');
        const title = (cur.SUMMARY || '').trim();
        if (date && title) {
          let end = icsDate(cur.DTEND || '');
          // DTEND no ICS é exclusivo p/ datas inteiras — recua 1 dia se diferente
          if (end && end !== date) {
            const d = new Date(end + 'T00:00:00');
            d.setDate(d.getDate() - 1);
            end = toISO(d);
          }
          out.push({ title, description: (cur.DESCRIPTION || '').trim(), category: 'evento', event_date: date, end_date: end && end !== date ? end : null });
        }
        cur = null;
      }
    } else if (cur) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const key = line.slice(0, idx).split(';')[0].toUpperCase();
        cur[key] = line.slice(idx + 1);
      }
    }
  }
  return out;
}
