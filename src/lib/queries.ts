import { supabase } from './supabase';
import { SUBJECT } from './types';
import type {
  AttendanceRecord,
  AttendanceSession,
  ClassRoom,
  Profile,
  School,
  Student,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/* ----------------------------------- Escolas ----------------------------------- */
export async function listSchools(): Promise<School[]> {
  return unwrap(await supabase.from('schools').select('*').order('name'));
}
export async function saveSchool(input: Partial<School> & { name: string }): Promise<School> {
  const row = {
    name: input.name,
    city: input.city ?? null,
    logo_url: input.logo_url ?? null,
    director: input.director ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    inep: input.inep ?? null,
    active: input.active ?? true,
  };
  if (input.id) return unwrap(await supabase.from('schools').update(row).eq('id', input.id).select().single());
  return unwrap(await supabase.from('schools').insert(row).select().single());
}
export async function deleteSchool(id: string): Promise<void> {
  const { error } = await supabase.from('schools').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function bulkInsertSchools(rows: { name: string; city?: string }[]): Promise<number> {
  const payload = rows.map((r) => ({ name: r.name, city: r.city || null }));
  const { error } = await supabase.from('schools').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

/* ----------------------------------- Turmas ------------------------------------ */
export async function listClasses(): Promise<ClassRoom[]> {
  return unwrap(await supabase.from('classes').select('*').order('name'));
}
export async function saveClass(input: Partial<ClassRoom> & { name: string; school_id: string }): Promise<ClassRoom> {
  const row = {
    name: input.name,
    school_id: input.school_id,
    shift: input.shift ?? 'Manhã',
    year: input.year ?? null,
  };
  if (input.id) return unwrap(await supabase.from('classes').update(row).eq('id', input.id).select().single());
  return unwrap(await supabase.from('classes').insert(row).select().single());
}
export async function deleteClass(id: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function bulkInsertClasses(
  schoolId: string,
  rows: { name: string; shift?: string; year?: string }[],
): Promise<number> {
  const payload = rows.map((r) => ({
    school_id: schoolId,
    name: r.name,
    shift: r.shift || 'Manhã',
    year: r.year ? Number(r.year) : null,
  }));
  const { error } = await supabase.from('classes').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

/* ----------------------------------- Alunos ------------------------------------ */
export async function listStudents(): Promise<Student[]> {
  return unwrap(await supabase.from('students').select('*').order('full_name'));
}
export async function listStudentsByClass(classId: string): Promise<Student[]> {
  return unwrap(
    await supabase.from('students').select('*').eq('class_id', classId).eq('active', true).order('full_name'),
  );
}
export async function saveStudent(
  input: Partial<Student> & { full_name: string; school_id: string },
): Promise<Student> {
  const row = {
    full_name: input.full_name,
    school_id: input.school_id,
    class_id: input.class_id ?? null,
    registration: input.registration ?? null,
    guardian_name: input.guardian_name ?? null,
    guardian_phone: input.guardian_phone ?? null,
    active: input.active ?? true,
  };
  if (input.id) return unwrap(await supabase.from('students').update(row).eq('id', input.id).select().single());
  return unwrap(await supabase.from('students').insert(row).select().single());
}
export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
export async function bulkInsertStudents(
  schoolId: string,
  classId: string,
  rows: { full_name: string; registration?: string; guardian_name?: string; guardian_phone?: string }[],
): Promise<number> {
  const payload = rows.map((r) => ({
    school_id: schoolId,
    class_id: classId,
    full_name: r.full_name,
    registration: r.registration || null,
    guardian_name: r.guardian_name || null,
    guardian_phone: r.guardian_phone || null,
  }));
  const { error } = await supabase.from('students').insert(payload);
  if (error) throw new Error(error.message);
  return payload.length;
}

/* ---------------------------------- Chamadas ----------------------------------- */
export async function getSession(classId: string, date: string): Promise<AttendanceSession | null> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('class_id', classId)
    .eq('session_date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getRecords(sessionId: string): Promise<AttendanceRecord[]> {
  return unwrap(await supabase.from('attendance_records').select('*').eq('session_id', sessionId));
}

/** Salva a chamada inteira: cria/atualiza a sessão e grava todos os registros. */
export async function saveAttendance(
  classId: string,
  date: string,
  records: AttendanceRecord[],
  note?: string,
): Promise<void> {
  const session = unwrap<AttendanceSession>(
    await supabase
      .from('attendance_sessions')
      .upsert(
        { class_id: classId, session_date: date, note: note ?? null, updated_at: new Date().toISOString() },
        { onConflict: 'class_id,session_date' },
      )
      .select()
      .single(),
  );

  const rows = records.map((r) => ({
    session_id: session.id,
    student_id: r.student_id,
    status: r.status,
    note: r.note ?? null,
  }));

  if (rows.length) {
    const { error } = await supabase
      .from('attendance_records')
      .upsert(rows, { onConflict: 'session_id,student_id' });
    if (error) throw new Error(error.message);
  }
}

export interface RecentSession {
  id: string;
  class_id: string;
  session_date: string;
  present: number;
  absent: number;
  total: number;
}

export async function listRecentSessions(limit = 10): Promise<RecentSession[]> {
  const sessions = unwrap<{ id: string; class_id: string; session_date: string }[]>(
    await supabase
      .from('attendance_sessions')
      .select('id, class_id, session_date')
      .order('session_date', { ascending: false })
      .limit(limit),
  );
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const recs = unwrap<{ session_id: string; status: string }[]>(
    await supabase.from('attendance_records').select('session_id, status').in('session_id', ids),
  );
  return sessions.map((s) => {
    const mine = recs.filter((r) => r.session_id === s.id);
    return {
      id: s.id,
      class_id: s.class_id,
      session_date: s.session_date,
      present: mine.filter((r) => r.status === 'present' || r.status === 'late').length,
      absent: mine.filter((r) => r.status === 'absent').length,
      total: mine.length,
    };
  });
}

/* ------------------------------------ Notas ------------------------------------ */
export interface GradeRow {
  student_id: string;
  year: number;
  month: number;
  score: number | null;
}

/** Todas as notas de uma turma num ano (para preencher o mês e calcular médias). */
export async function listGrades(classId: string, year: number): Promise<GradeRow[]> {
  return unwrap(
    await supabase
      .from('grades')
      .select('student_id, year, month, score')
      .eq('class_id', classId)
      .eq('subject', SUBJECT)
      .eq('year', year),
  );
}

/** Salva as notas de um mês (upsert por aluno). score null apaga a nota daquele mês. */
export async function saveGrades(
  classId: string,
  year: number,
  month: number,
  rows: { student_id: string; score: number | null }[],
): Promise<void> {
  const toUpsert = rows.filter((r) => r.score !== null);
  const toClear = rows.filter((r) => r.score === null).map((r) => r.student_id);

  if (toUpsert.length) {
    const payload = toUpsert.map((r) => ({
      class_id: classId,
      student_id: r.student_id,
      subject: SUBJECT,
      year,
      month,
      score: r.score,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('grades').upsert(payload, { onConflict: 'student_id,subject,year,month' });
    if (error) throw new Error(error.message);
  }

  if (toClear.length) {
    const { error } = await supabase
      .from('grades')
      .delete()
      .eq('class_id', classId)
      .eq('subject', SUBJECT)
      .eq('year', year)
      .eq('month', month)
      .in('student_id', toClear);
    if (error) throw new Error(error.message);
  }
}

/* --------------------------------- Relatórios ---------------------------------- */
export interface AttendanceReportRow {
  student_id: string;
  name: string;
  present: number;
  absent: number;
  late: number;
  justified: number;
  total: number;
  pct: number; // % de presença (presente + atrasado)
}
export interface AttendanceReport {
  sessions: number;
  rows: AttendanceReportRow[];
}

export async function reportAttendance(classId: string, from: string, to: string): Promise<AttendanceReport> {
  const sessions = unwrap<{ id: string }[]>(
    await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', classId)
      .gte('session_date', from)
      .lte('session_date', to),
  );
  const ids = sessions.map((s) => s.id);
  const records = ids.length
    ? unwrap<{ student_id: string; status: string }[]>(
        await supabase.from('attendance_records').select('student_id, status').in('session_id', ids),
      )
    : [];
  const students = await listStudentsByClass(classId);

  const rows: AttendanceReportRow[] = students.map((s) => {
    const mine = records.filter((r) => r.student_id === s.id);
    const present = mine.filter((r) => r.status === 'present').length;
    const late = mine.filter((r) => r.status === 'late').length;
    const absent = mine.filter((r) => r.status === 'absent').length;
    const justified = mine.filter((r) => r.status === 'justified').length;
    const total = mine.length;
    const pct = total ? Math.round(((present + late) / total) * 1000) / 10 : 0;
    return { student_id: s.id, name: s.full_name, present, absent, late, justified, total, pct };
  });

  return { sessions: sessions.length, rows };
}

export interface GradesReportRow {
  student_id: string;
  name: string;
  months: (number | null)[]; // 12 posições
  media: number | null;
}

export async function reportGrades(classId: string, year: number): Promise<GradesReportRow[]> {
  const [grades, students] = await Promise.all([listGrades(classId, year), listStudentsByClass(classId)]);
  return students.map((s) => {
    const months: (number | null)[] = Array.from({ length: 12 }, (_, i) => {
      const g = grades.find((x) => x.student_id === s.id && x.month === i + 1);
      return g?.score != null ? Number(g.score) : null;
    });
    const got = months.filter((m): m is number => m != null);
    const media = got.length ? Math.round((got.reduce((a, b) => a + b, 0) / got.length) * 10) / 10 : null;
    return { student_id: s.id, name: s.full_name, months, media };
  });
}

/* ----------------------------------- Perfil ------------------------------------ */
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
export async function updateProfile(userId: string, input: Partial<Profile>): Promise<Profile> {
  return unwrap(
    await supabase
      .from('profiles')
      .update({
        full_name: input.full_name,
        calendar_url: input.calendar_url,
      })
      .eq('id', userId)
      .select()
      .single(),
  );
}

/* --------------------------------- Dashboard ----------------------------------- */
export async function dashboardCounts() {
  const [schools, classes, students] = await Promise.all([
    supabase.from('schools').select('id', { count: 'exact', head: true }),
    supabase.from('classes').select('id', { count: 'exact', head: true }),
    supabase.from('students').select('id', { count: 'exact', head: true }),
  ]);
  return {
    schools: schools.count ?? 0,
    classes: classes.count ?? 0,
    students: students.count ?? 0,
  };
}
