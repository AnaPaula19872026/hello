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
  months: (number | null)[];
  media: number | null;
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
}

export const SHIFTS = ['Manhã', 'Tarde', 'Noite', 'Integral'] as const;

export const SUBJECT = 'Língua Inglesa';

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Presente',
  absent: 'Ausente',
  late: 'Atrasado',
  justified: 'Justificado',
};
