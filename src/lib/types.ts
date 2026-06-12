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
  updated_at?: string | null;
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

/* ------------------------ Planejamento do professor (Fase 3) ------------------ */
export type PlanStatus = 'rascunho' | 'enviado' | 'aprovado' | 'devolvido';

export const PLAN_STATUS: Record<PlanStatus, { label: string; cls: string }> = {
  rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  enviado: { label: 'Enviado', cls: 'bg-blue-100 text-blue-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  devolvido: { label: 'Devolvido', cls: 'bg-red-100 text-red-700' },
};

export interface LessonPlan {
  id: string;
  org_id: string;
  author_id: string;
  class_id: string | null;
  title: string;
  week_start: string | null;
  content: string;
  status: PlanStatus;
  feedback: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanAttachment {
  id: string;
  plan_id: string;
  name: string;
  path: string;
  mime: string | null;
  url?: string;
}

export type CalendarUploadSlot = 'annual' | 'term1' | 'term2' | 'term3';

export interface CalendarUpload {
  id: string;
  org_id: string;
  slot: CalendarUploadSlot;
  title: string;
  name: string;
  path: string;
  mime: string | null;
  uploaded_by: string | null;
  created_at: string;
  url?: string;
}

export type HolidayScope = 'national' | 'state' | 'city';

export interface CalendarHoliday {
  id: string;
  org_id?: string;
  title: string;
  date: string;
  scope: HolidayScope;
  state?: string | null;
  city?: string | null;
  source?: string | null;
  created_at?: string;
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

export const RECOVERY_ACTIVITY_NAME = 'RECUPERAÇÃO';
export const RECOVERY_ACTIVITY: GradeActivity = { name: RECOVERY_ACTIVITY_NAME, max: 10 };

/** Composição padrão (coordenação/professor ajusta por trimestre). */
export const DEFAULT_ACTIVITIES: GradeActivity[] = [
  { name: 'TESTE', max: 10 },
  { name: 'E-CERM', max: 10 },
  { name: 'SIMULADO', max: 1 },
  { name: 'PROJETO', max: 5 },
  { name: 'CRÉDITO VARIÁVEL', max: 4 },
  RECOVERY_ACTIVITY,
];

export function isRecoveryActivity(name: string): boolean {
  return name.trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase() === 'RECUPERACAO';
}

export function withRecoveryActivity(activities: GradeActivity[]): GradeActivity[] {
  const next = activities.some((activity) => isRecoveryActivity(activity.name)) ? activities : [...activities, RECOVERY_ACTIVITY];
  return orderGradeActivities(next);
}

export function orderGradeActivities(activities: GradeActivity[]): GradeActivity[] {
  return [...activities].sort((a, b) => {
    if (isRecoveryActivity(a.name)) return 1;
    if (isRecoveryActivity(b.name)) return -1;
    return 0;
  });
}

// Ano letivo: fevereiro a novembro, dividido em 3 trimestres.
export const TERMS = [1, 2, 3] as const;
export const TERM_LABEL: Record<number, string> = { 1: '1º trimestre', 2: '2º trimestre', 3: '3º trimestre' };
// Faixa de meses (0 = janeiro) de cada trimestre, para filtros de frequência.
export const TERM_MONTHS: Record<number, [number, number]> = { 1: [1, 4], 2: [5, 7], 3: [8, 10] };
// Ano letivo completo: fev (1) a nov (10).
export const SCHOOL_YEAR_MONTHS: [number, number] = [1, 10];
export const MEDIA_APROVACAO = 6;
export const MEDIA_DIVISOR = 3; // média = soma das notas / 3

/**
 * Monta as "notas" (buckets) a partir da composição:
 *  - atividades de valor cheio (max >= 10) contam como UMA nota cada (ex.: TESTE, E-CERM);
 *  - as menores (max < 10) SOMAM e viram UMA única nota (ex.: SIMULADO+PROJETO+CRÉDITO = 10).
 * Sem a composição, cada atividade lançada conta como uma nota (fallback).
 */
function gradeBuckets(scores: Record<string, number>, activities?: GradeActivity[]): number[] {
  if (activities && activities.length) {
    const mains: number[] = [];
    const small: number[] = [];
    for (const a of activities) {
      if (isRecoveryActivity(a.name)) continue;
      const v = Number(scores[a.name]) || 0;
      if (a.max < 10) small.push(v);
      else mains.push(v);
    }
    const buckets = [...mains];
    if (small.length) buckets.push(small.reduce((x, y) => x + y, 0));
    if (buckets.length) return buckets;
  }
  return Object.entries(scores)
    .filter(([name, value]) => !isRecoveryActivity(name) && Number.isFinite(Number(value)))
    .map(([, value]) => Number(value) || 0);
}

/**
 * Média final = soma das notas ÷ 3.
 * Recuperação: se a média ficar abaixo de 6, a nota de recuperação SUBSTITUI a MENOR
 * das notas (desde que seja maior que ela, ou seja, que melhore a média).
 */
export function calcMedia(scores: Record<string, number>, activities?: GradeActivity[]): number {
  const buckets = gradeBuckets(scores, activities);
  if (!buckets.length) return 0;

  const sum = buckets.reduce((a, b) => a + b, 0);
  const baseMedia = sum / MEDIA_DIVISOR;

  const recovery = Object.entries(scores).find(([name]) => isRecoveryActivity(name))?.[1];
  if (recovery != null && Number.isFinite(Number(recovery)) && baseMedia < MEDIA_APROVACAO) {
    const rec = Number(recovery) || 0;
    const lowestIndex = buckets.indexOf(Math.min(...buckets));
    if (lowestIndex >= 0 && rec > buckets[lowestIndex]) {
      const adjustedSum = sum - buckets[lowestIndex] + rec;
      return Math.round((adjustedSum / MEDIA_DIVISOR) * 10) / 10;
    }
  }
  return Math.round(baseMedia * 10) / 10;
}

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Atrasado',
  justified: 'Justificado',
};
