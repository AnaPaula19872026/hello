import { supabase } from './supabase';
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
  const row = { name: input.name, city: input.city ?? null, active: input.active ?? true };
  if (input.id) return unwrap(await supabase.from('schools').update(row).eq('id', input.id).select().single());
  return unwrap(await supabase.from('schools').insert(row).select().single());
}
export async function deleteSchool(id: string): Promise<void> {
  const { error } = await supabase.from('schools').delete().eq('id', id);
  if (error) throw new Error(error.message);
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
