export type AttendanceStatus = 'present' | 'absent' | 'late' | 'justified';

export interface School {
  id: string;
  name: string;
  city: string | null;
  logo_url: string | null;
  director: string | null;
  address: string | null;
  phone: string | null;
  inep: string | null;
  active: boolean;
  created_at?: string;
}

export interface ClassRoom {
  id: string;
  school_id: string;
  name: string;
  shift: string;
  year: number | null;
  created_at?: string;
}

export interface Student {
  id: string;
  school_id: string;
  class_id: string | null;
  full_name: string;
  registration: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  active: boolean;
  created_at?: string;
}

export interface AttendanceSession {
  id: string;
  class_id: string;
  session_date: string;
  note: string | null;
}

export interface AttendanceRecord {
  id?: string;
  session_id?: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  calendar_url: string | null;
  role: 'user' | 'master';
  is_superadmin: boolean;
  active_org_id: string | null;
}

/* ------------------------- SaaS multi-tenant (Fase 1) ------------------------- */
export type AppRole = 'superadmin' | 'diretor' | 'coordenador' | 'professor' | 'secretaria' | 'marketing' | 'cpd';

export const ROLE_LABEL: Record<AppRole, string> = {
  superadmin: 'Administrador',
  diretor: 'Diretor(a)',
  coordenador: 'Coordenação',
  professor: 'Professor(a)',
  secretaria: 'Secretaria',
  marketing: 'Marketing / Comunicação',
  cpd: 'CPD / Suporte',
};

/** Papéis que um diretor/coordenador pode atribuir ao convidar (sem superadmin). */
export const ASSIGNABLE_ROLES: AppRole[] = ['diretor', 'coordenador', 'professor', 'secretaria', 'marketing', 'cpd'];

export interface Organization {
  id: string;
  name: string;
  plan: string;
  is_demo: boolean;
  active: boolean;
  kind?: 'hq' | 'client';
  cnpj?: string | null;
  logo_url?: string | null;
  created_at?: string;
}

export interface Membership {
  id: string;
  user_id: string;
  org_id: string;
  role: AppRole;
  created_at?: string;
}

/* ------------------------------ Avisos (Fase 2) ------------------------------ */
export type NoticeAudience = 'all' | 'role' | 'user';

export interface Notice {
  id: string;
  org_id: string;
  author_id: string;
  title: string;
  body: string;
  audience: NoticeAudience;
  target_role: AppRole | null;
  target_user: string | null;
  created_at: string;
}

export interface OrgPerson {
  user_id: string;
  full_name: string | null;
  role: AppRole;
}

export interface NoticeAttachment {
  id: string;
  notice_id: string;
  name: string;
  path: string;
  mime: string | null;
  url?: string; // URL assinada (temporária) para baixar/pré-visualizar
}

/* ----------------------------- Calendário (Fase 4) ---------------------------- */
export type EventAudience = 'all' | 'role' | 'user';

export const EVENT_CATEGORIES: { key: string; label: string; color: string }[] = [
  { key: 'evento', label: 'Evento', color: '#2563eb' },
  { key: 'atividade', label: 'Atividade', color: '#059669' },
  { key: 'gincana', label: 'Gincana', color: '#d97706' },
  { key: 'prova', label: 'Semana de provas', color: '#dc2626' },
  { key: 'reuniao', label: 'Reunião', color: '#7c3aed' },
  { key: 'outro', label: 'Outro', color: '#475569' },
];
export const eventColor = (cat: string) => EVENT_CATEGORIES.find((c) => c.key === cat)?.color ?? '#64748b';
export const eventCatLabel = (cat: string) => EVENT_CATEGORIES.find((c) => c.key === cat)?.label ?? cat;
export const eventSoftColor = (cat: string) => {
  const map: Record<string, string> = {
    evento: '#eff6ff',
    atividade: '#ecfdf5',
    gincana: '#fffbeb',
    prova: '#fef2f2',
    reuniao: '#f5f3ff',
    outro: '#f8fafc',
  };
  return map[cat] ?? '#f8fafc';
};

export interface CalendarEvent {
  id: string;
  org_id: string;
  author_id: string;
  title: string;
  description: string;
  category: string;
  event_date: string; // yyyy-mm-dd
  end_date: string | null;
  audience: EventAudience;
  target_role: AppRole | null;
  target_user: string | null;
  created_at: string;
}

export interface EventAttachment {
  id: string;
  event_id: string;
  name: string;
  path: string;
  mime: string | null;
  url?: string;
}

export interface Grade {
  id?: string;
  class_id: string;
  student_id: string;
  subject: string;
  year: number;
  month: number;
  score: number | null;
  note: string | null;
}

export interface ReportSchool {
  name: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
}
export interface ReportFreqRow {
  name: string;
  present: number;
  absent: number;
  total: number;
  pct: number;
  absentDates: string[];
}
export interface ReportNotasRow {
  name: string;
  terms: (number | null)[]; // média de cada trimestre (4)
  final: number | null; // média anual
}
export interface ReportPayload {
  kind: 'freq' | 'notas';
  school: ReportSchool | null;
  className: string;
  title: string;
  period: string;
  generatedAt: string;
  minPct?: number;
  sessions?: number;
  freqRows?: ReportFreqRow[];
  subject?: string;
  notasRows?: ReportNotasRow[];
  notasTerm?: number; // 0 = todos os trimestres; 1-4 = só aquele trimestre
}

export const SHIFTS = ['Manhã', 'Tarde', 'Noite', 'Integral'] as const;

export const SUBJECT = 'Língua Inglesa';

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

/* ---- Notas por trimestre (composição de atividades) ---- */
export interface GradeActivity {
  name: string;
  max: number; // valor máximo da atividade naquele trimestre
}

/** Composição padrão (coordenação/professor ajusta por trimestre). */
export const DEFAULT_ACTIVITIES: GradeActivity[] = [
  { name: 'TESTE', max: 10 },
  { name: 'E-CERM', max: 10 },
  { name: 'SIMULADO', max: 1 },
  { name: 'PROJETO', max: 5 },
  { name: 'CRÉDITO VARIÁVEL', max: 4 },
];

// Ano letivo: fevereiro a novembro, dividido em 3 trimestres.
export const TERMS = [1, 2, 3] as const;
export const TERM_LABEL: Record<number, string> = { 1: '1º trimestre', 2: '2º trimestre', 3: '3º trimestre' };
// Faixa de meses (0 = janeiro) de cada trimestre, para filtros de frequência.
export const TERM_MONTHS: Record<number, [number, number]> = { 1: [1, 4], 2: [5, 7], 3: [8, 10] };
// Ano letivo completo: fev (1) a nov (10).
export const SCHOOL_YEAR_MONTHS: [number, number] = [1, 10];
export const MEDIA_APROVACAO = 6;
export const MEDIA_DIVISOR = 3; // média = soma das notas / 3

export function calcMedia(scores: Record<string, number>): number {
  const sum = Object.values(scores).reduce((a, b) => a + (Number(b) || 0), 0);
  return Math.round((sum / MEDIA_DIVISOR) * 10) / 10;
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Atrasado',
  justified: 'Justificado',
};
