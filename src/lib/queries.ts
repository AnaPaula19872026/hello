import { supabase } from './supabase';
import { calcMedia, withRecoveryActivity, type GradeActivity } from './types';
import { getActiveOrgId } from './org';
import { assertUploadFile } from './fileSecurity';
import type {
  AppRole,
  AttendanceRecord,
  AttendanceSession,
  ClassRoom,
  CalendarEvent,
  CalendarHoliday,
  CalendarUpload,
  CalendarUploadSlot,
  EventAttachment,
  EventAudience,
  LessonPlan,
  Membership,
  Notice,
  NoticeAttachment,
  NoticeAudience,
  Organization,
  OrgPerson,
  PlanAttachment,
  PlanStatus,
  Profile,
  ReportPayload,
  School,
  Student,
} from './types';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/**
 * Escopa a consulta à organização ativa. Necessário porque o superadmin enxerga
 * TODAS as organizações pela RLS; sem isto, a área de trabalho misturaria dados
 * de clientes diferentes. Usuário comum já é limitado pela RLS, mas o filtro é
 * inofensivo (ele só participa da própria organização).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scoped<T>(q: T): T {
  const org = getActiveOrgId();
  // FAIL-CLOSED: sem organização ativa, NÃO retorna tudo (evitaria vazamento entre
  // clientes). Filtra por um id impossível => resultado vazio. (A RLS no banco já
  // garante o isolamento; isto é defesa em profundidade no cliente.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (q as any).eq('org_id', org ?? '00000000-0000-0000-0000-000000000000') as T;
}

/* ----------------------------------- Escolas ----------------------------------- */
export async function listSchools(): Promise<School[]> {
  return unwrap(await scoped(supabase.from('schools').select('*')).order('name'));
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
  if (input.id) return unwrap(await scoped(supabase.from('schools').update(row)).eq('id', input.id).select().single());
  return unwrap(await supabase.from('schools').insert(row).select().single());
}
export async function deleteSchool(id: string): Promise<void> {
  const { error } = await scoped(supabase.from('schools').delete()).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function bulkDeleteSchools(ids: string[]): Promise<void> {
  const { error } = await scoped(supabase.from('schools').delete()).in('id', ids);
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
  return unwrap(await scoped(supabase.from('classes').select('*')).order('name'));
}
export async function saveClass(input: Partial<ClassRoom> & { name: string; school_id: string }): Promise<ClassRoom> {
  const row = {
    name: input.name,
    school_id: input.school_id,
    shift: input.shift ?? 'Manhã',
    year: input.year ?? null,
  };
  if (input.id) return unwrap(await scoped(supabase.from('classes').update(row)).eq('id', input.id).select().single());
  return unwrap(await supabase.from('classes').insert(row).select().single());
}
export async function deleteClass(id: string): Promise<void> {
  const { error } = await scoped(supabase.from('classes').delete()).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function bulkDeleteClasses(ids: string[]): Promise<void> {
  const { error } = await scoped(supabase.from('classes').delete()).in('id', ids);
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
  return unwrap(await scoped(supabase.from('students').select('*')).order('full_name'));
}
export async function listStudentsByClass(classId: string): Promise<Student[]> {
  return unwrap(
    await scoped(supabase.from('students').select('*')).eq('class_id', classId).eq('active', true).order('full_name'),
  );
}
function mapStudentError(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    if (error.message.includes('registration')) return 'Já existe um aluno com essa matrícula nesta escola.';
    return 'Já existe um aluno com esse nome nesta turma.';
  }
  return error.message;
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
  const q = input.id
    ? scoped(supabase.from('students').update(row)).eq('id', input.id)
    : supabase.from('students').insert(row);
  const { data, error } = await q.select().single();
  if (error) throw new Error(mapStudentError(error));
  return data as Student;
}
export async function deleteStudent(id: string): Promise<void> {
  const { error } = await scoped(supabase.from('students').delete()).eq('id', id);
  if (error) throw new Error(error.message);
}
export async function bulkDeleteStudents(ids: string[]): Promise<void> {
  const { error } = await scoped(supabase.from('students').delete()).in('id', ids);
  if (error) throw new Error(error.message);
}
/** Importa alunos pulando duplicados (mesma matrícula na escola ou mesmo nome na turma). */
export async function bulkInsertStudents(
  schoolId: string,
  classId: string,
  rows: { full_name: string; registration?: string; guardian_name?: string; guardian_phone?: string }[],
): Promise<number> {
  const inSchool = unwrap<{ registration: string | null }[]>(
    await scoped(supabase.from('students').select('registration')).eq('school_id', schoolId),
  );
  const inClass = unwrap<{ full_name: string }[]>(
    await scoped(supabase.from('students').select('full_name')).eq('class_id', classId),
  );
  const regSet = new Set(inSchool.map((s) => (s.registration || '').trim()).filter(Boolean));
  const nameSet = new Set(inClass.map((s) => s.full_name.toLowerCase().trim()));
  const seenReg = new Set<string>();
  const seenName = new Set<string>();

  const payload = rows
    .filter((r) => {
      const reg = (r.registration || '').trim();
      const name = r.full_name.toLowerCase().trim();
      if (reg && (regSet.has(reg) || seenReg.has(reg))) return false;
      if (nameSet.has(name) || seenName.has(name)) return false;
      if (reg) seenReg.add(reg);
      seenName.add(name);
      return true;
    })
    .map((r) => ({
      school_id: schoolId,
      class_id: classId,
      full_name: r.full_name,
      registration: r.registration || null,
      guardian_name: r.guardian_name || null,
      guardian_phone: r.guardian_phone || null,
    }));

  if (!payload.length) return 0;
  const { error } = await supabase.from('students').insert(payload);
  if (error) throw new Error(mapStudentError(error));
  return payload.length;
}

export interface ImportAllResult {
  schools: number;
  classes: number;
  students: number;
  duplicates: string[]; // alunos que já estavam cadastrados (ignorados)
}

/** Importação inteligente: uma planilha cria escolas, turmas e alunos conforme preenchido. */
export async function bulkImportAll(rows: Record<string, string>[]): Promise<ImportAllResult> {
  const [schools, classes, allStudents] = await Promise.all([listSchools(), listClasses(), listStudents()]);

  const schoolMap = new Map(schools.map((s) => [s.name.toLowerCase().trim(), s.id]));
  const classMap = new Map(classes.map((c) => [`${c.school_id}|${c.name.toLowerCase().trim()}`, c.id]));
  const regSet = new Set(allStudents.filter((s) => s.registration).map((s) => `${s.school_id}|${(s.registration || '').trim()}`));
  const nameSet = new Set(allStudents.filter((s) => s.class_id).map((s) => `${s.class_id}|${s.full_name.toLowerCase().trim()}`));

  let cS = 0;
  let cC = 0;
  let cStu = 0;
  const duplicates: string[] = [];

  for (const r of rows) {
    const schoolName = (r.school || '').trim();
    if (!schoolName) continue;

    // Escola
    const sKey = schoolName.toLowerCase();
    let schoolId = schoolMap.get(sKey);
    if (!schoolId) {
      const ins = unwrap<{ id: string }>(
        await supabase.from('schools').insert({ name: schoolName, city: (r.city || '').trim() || null }).select('id').single(),
      );
      schoolId = ins.id;
      schoolMap.set(sKey, schoolId);
      cS++;
    }

    // Turma
    const className = (r.class || '').trim();
    let classId: string | undefined;
    if (className) {
      const cKey = `${schoolId}|${className.toLowerCase()}`;
      classId = classMap.get(cKey);
      if (!classId) {
        const ins = unwrap<{ id: string }>(
          await supabase
            .from('classes')
            .insert({ school_id: schoolId, name: className, shift: (r.shift || '').trim() || 'Manhã', year: r.year ? Number(r.year) : null })
            .select('id')
            .single(),
        );
        classId = ins.id;
        classMap.set(cKey, classId);
        cC++;
      }
    }

    // Aluno
    const studentName = (r.student || '').trim();
    if (studentName) {
      const reg = (r.registration || '').trim();
      const regKey = `${schoolId}|${reg}`;
      const nameKey = `${classId || ''}|${studentName.toLowerCase()}`;
      if (reg && regSet.has(regKey)) {
        duplicates.push(`${studentName} (matrícula ${reg} já cadastrada)`);
        continue;
      }
      if (classId && nameSet.has(nameKey)) {
        duplicates.push(`${studentName} (já cadastrado nessa turma)`);
        continue;
      }
      const { error } = await supabase.from('students').insert({
        school_id: schoolId,
        class_id: classId ?? null,
        full_name: studentName,
        registration: reg || null,
        guardian_name: (r.guardian || '').trim() || null,
        guardian_phone: (r.phone || '').trim() || null,
      });
      if (error) {
        duplicates.push(`${studentName} (já cadastrado)`);
        continue;
      }
      if (reg) regSet.add(regKey);
      if (classId) nameSet.add(nameKey);
      cStu++;
    }
  }

  return { schools: cS, classes: cC, students: cStu, duplicates };
}

/** Converte o resultado da importação para o formato exibido no modal. */
export function importResultToModal(r: ImportAllResult): { created: number; note?: string; duplicates?: string[] } {
  const extra = [r.schools ? `${r.schools} escola(s)` : '', r.classes ? `${r.classes} turma(s)` : ''].filter(Boolean).join(' · ');
  return { created: r.students, note: extra ? `Também criou ${extra}.` : undefined, duplicates: r.duplicates };
}

/* ---------------------------------- Chamadas ----------------------------------- */
export async function getSession(classId: string, date: string): Promise<AttendanceSession | null> {
  const { data, error } = await scoped(supabase.from('attendance_sessions').select('*'))
    .eq('class_id', classId)
    .eq('session_date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getRecords(sessionId: string): Promise<AttendanceRecord[]> {
  return unwrap(await scoped(supabase.from('attendance_records').select('*')).eq('session_id', sessionId));
}

/** Salva a chamada inteira: cria/atualiza a sessão e grava todos os registros. */
export async function saveAttendance(
  classId: string,
  date: string,
  records: AttendanceRecord[],
  note?: string,
): Promise<void> {
  const org = getActiveOrgId();
  const session = unwrap<AttendanceSession>(
    await supabase
      .from('attendance_sessions')
      .upsert(
        { class_id: classId, session_date: date, note: note ?? null, updated_at: new Date().toISOString(), ...(org ? { org_id: org } : {}) },
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
    ...(org ? { org_id: org } : {}),
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
    await scoped(supabase.from('attendance_sessions').select('id, class_id, session_date'))
      .order('session_date', { ascending: false })
      .limit(limit),
  );
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const recs = unwrap<{ session_id: string; status: string }[]>(
    await scoped(supabase.from('attendance_records').select('session_id, status')).in('session_id', ids),
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

/* ----------------------------- Notas por trimestre ----------------------------- */
/** Composição de notas (atividades + valores) de um trimestre/ano. */
export async function getTermConfig(year: number, term: number): Promise<GradeActivity[]> {
  // org_id incluso: cada organização tem sua própria composição (RLS já limita,
  // mas superadmin enxerga várias — filtra pela organização ativa).
  let q = supabase.from('grade_terms').select('activities').eq('year', year).eq('term', term);
  const org = getActiveOrgId();
  if (org) q = q.eq('org_id', org);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return withRecoveryActivity(((data?.activities as GradeActivity[]) ?? []).filter((a) => a && a.name));
}

export async function getSavedTermConfig(year: number, term: number): Promise<GradeActivity[]> {
  let q = supabase.from('grade_terms').select('activities').eq('year', year).eq('term', term);
  const org = getActiveOrgId();
  if (org) q = q.eq('org_id', org);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.activities as GradeActivity[]) ?? []).filter((a) => a && a.name);
}

export async function saveTermConfig(year: number, term: number, activities: GradeActivity[]): Promise<void> {
  const org = getActiveOrgId();
  const row: Record<string, unknown> = { year, term, activities, updated_at: new Date().toISOString() };
  if (org) row.org_id = org;
  const { error } = await supabase.from('grade_terms').upsert(row, { onConflict: 'org_id,year,term' });
  if (error) throw new Error(error.message);
}

export interface TermGradeRow {
  student_id: string;
  scores: Record<string, number>;
  updated_at?: string | null;
}
export async function listTermGrades(classId: string, year: number, term: number): Promise<TermGradeRow[]> {
  return unwrap(
    await scoped(supabase.from('term_grades').select('student_id, scores, updated_at')).eq('class_id', classId).eq('year', year).eq('term', term),
  );
}

export async function saveTermGrades(
  classId: string,
  year: number,
  term: number,
  rows: TermGradeRow[],
): Promise<void> {
  const org = getActiveOrgId();
  const payload = rows.map((r) => ({
    class_id: classId,
    student_id: r.student_id,
    year,
    term,
    scores: r.scores,
    updated_at: new Date().toISOString(),
    ...(org ? { org_id: org } : {}),
  }));
  if (!payload.length) return;
  const { error } = await supabase.from('term_grades').upsert(payload, { onConflict: 'student_id,year,term' });
  if (error) throw new Error(error.message);
}

export async function bulkDeleteTermGrades(classId: string, year: number, term: number, studentIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('term_grades')
    .delete()
    .eq('class_id', classId)
    .eq('year', year)
    .eq('term', term)
    .in('student_id', studentIds);
  if (error) throw new Error(error.message);
}

/* --------------------------------- Relatórios ---------------------------------- */
export interface AttendanceReportRow {
  student_id: string;
  name: string;
  present: number;
  absent: number;
  total: number;
  pct: number; // % de presença
  absentDates: string[]; // dias (yyyy-mm-dd) em que faltou
}
export interface AttendanceReport {
  sessions: number;
  rows: AttendanceReportRow[];
}

export interface AttendanceAlert {
  student_id: string;
  name: string;
  class_id: string | null;
  pct: number;
  absent: number;
  total: number;
}
/**
 * Alunos com frequência abaixo do mínimo (padrão 75%) no ano, considerando todas
 * as turmas da organização ativa. Ignora quem tem poucas chamadas (ruído).
 */
export async function listAttendanceAlerts(minPct = 75, year = new Date().getFullYear(), minSessions = 4): Promise<AttendanceAlert[]> {
  const sessions = unwrap<{ id: string; session_date: string }[]>(
    await scoped(supabase.from('attendance_sessions').select('id, session_date')),
  ).filter((s) => s.session_date.startsWith(String(year)));
  if (!sessions.length) return [];
  const ids = sessions.map((s) => s.id);
  const records = unwrap<{ student_id: string; status: string }[]>(
    await supabase.from('attendance_records').select('student_id, status').in('session_id', ids),
  );
  const students = await listStudents();
  const byId = new Map(students.map((s) => [s.id, s]));
  const agg = new Map<string, { present: number; total: number }>();
  for (const r of records) {
    const a = agg.get(r.student_id) ?? { present: 0, total: 0 };
    a.total++;
    if (r.status === 'present' || r.status === 'late') a.present++;
    agg.set(r.student_id, a);
  }
  const out: AttendanceAlert[] = [];
  for (const [sid, a] of agg) {
    if (a.total < minSessions) continue;
    const pct = Math.round((a.present / a.total) * 1000) / 10;
    if (pct >= minPct) continue;
    const st = byId.get(sid);
    if (!st) continue;
    out.push({ student_id: sid, name: st.full_name, class_id: st.class_id, pct, absent: a.total - a.present, total: a.total });
  }
  return out.sort((x, y) => x.pct - y.pct);
}

export async function reportAttendance(classId: string, from: string, to: string): Promise<AttendanceReport> {
  const sessions = unwrap<{ id: string; session_date: string }[]>(
    await scoped(supabase.from('attendance_sessions').select('id, session_date'))
      .eq('class_id', classId)
      .gte('session_date', from)
      .lte('session_date', to),
  );
  const ids = sessions.map((s) => s.id);
  const records = ids.length
    ? unwrap<{ student_id: string; status: string; session_id: string }[]>(
        await scoped(supabase.from('attendance_records').select('student_id, status, session_id')).in('session_id', ids),
      )
    : [];
  const dateById = new Map(sessions.map((s) => [s.id, s.session_date]));
  const students = await listStudentsByClass(classId);

  const rows: AttendanceReportRow[] = students.map((s) => {
    const mine = records.filter((r) => r.student_id === s.id);
    const present = mine.filter((r) => r.status === 'present').length;
    const absentRecs = mine.filter((r) => r.status !== 'present');
    const total = mine.length;
    const pct = total ? Math.round((present / total) * 1000) / 10 : 0;
    const absentDates = absentRecs
      .map((r) => dateById.get(r.session_id))
      .filter((d): d is string => !!d)
      .sort();
    return { student_id: s.id, name: s.full_name, present, absent: absentRecs.length, total, pct, absentDates };
  });

  return { sessions: sessions.length, rows };
}

/** Apaga uma chamada (sessão) e seus registros. */
export async function deleteAttendanceSession(id: string): Promise<void> {
  const { error } = await scoped(supabase.from('attendance_sessions').delete()).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ----------------------------- Relatório por link ------------------------------ */
function shortId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  return Array.from(bytes, (b) => alphabet[b % 36]).join('');
}

/** Salva o relatório e devolve o id curto para o link público /r/<id>. */
export async function createSharedReport(payload: ReportPayload): Promise<string> {
  const id = shortId();
  const { error } = await supabase.from('shared_reports').insert({ id, payload });
  if (error) throw new Error(error.message);
  return id;
}

export async function getSharedReport(id: string): Promise<ReportPayload | null> {
  const { data, error } = await supabase.from('shared_reports').select('payload').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as ReportPayload) ?? null;
}

export interface TermsReportRow {
  student_id: string;
  name: string;
  terms: (number | null)[]; // média de cada trimestre (3 posições)
  final: number | null; // média anual (média dos trimestres com nota)
}

export async function reportTerms(classId: string, year: number): Promise<TermsReportRow[]> {
  const [grades, configs, students] = await Promise.all([
    unwrap<{ student_id: string; term: number; scores: Record<string, number> }[]>(
      await scoped(supabase.from('term_grades').select('student_id, term, scores')).eq('class_id', classId).eq('year', year),
    ),
    unwrap<{ term: number; activities: GradeActivity[] }[]>(
      await scoped(supabase.from('grade_terms').select('term, activities')).eq('year', year),
    ),
    listStudentsByClass(classId),
  ]);
  // Composição (atividades) por trimestre, para agrupar as notas no cálculo da média.
  const actByTerm = new Map(
    configs.map((c) => [c.term, withRecoveryActivity(((c.activities as GradeActivity[]) ?? []).filter((a) => a && a.name))]),
  );
  return students.map((s) => {
    const terms: (number | null)[] = [1, 2, 3].map((t) => {
      const g = grades.find((x) => x.student_id === s.id && x.term === t);
      return g ? calcMedia(g.scores, actByTerm.get(t)) : null;
    });
    const got = terms.filter((x): x is number => x != null);
    const final = got.length ? Math.round((got.reduce((a, b) => a + b, 0) / got.length) * 10) / 10 : null;
    return { student_id: s.id, name: s.full_name, terms, final };
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
        avatar_url: input.avatar_url,
      })
      .eq('id', userId)
      .select()
      .single(),
  );
}

/* ------------------------ Organizações / membros (SaaS) ------------------------ */
// IMPORTANTE: filtra pelo próprio usuário. A RLS deixa um membro enxergar os
// vínculos dos COLEGAS da mesma organização (para a lista de membros), então sem
// o filtro viriam vários — e o papel do usuário seria calculado errado (herdando
// o de outra pessoa da organização).
export async function listMyMemberships(userId: string): Promise<Membership[]> {
  return unwrap(await supabase.from('memberships').select('*').eq('user_id', userId));
}

/** Organizações que o usuário enxerga (membro) ou todas (superadmin). */
export async function listOrganizations(): Promise<Organization[]> {
  return unwrap(await supabase.from('organizations').select('*').order('created_at'));
}

export interface OrgAdmin {
  id: string;
  name: string;
  plan: string;
  is_demo: boolean;
  active: boolean;
  cnpj: string | null;
  logo_url: string | null;
  created_at: string;
  schools: number;
  students: number;
  members: number;
}

/** Atualiza dados do cliente (nome, CNPJ, logo). Renomear propaga em todo o sistema. */
export async function updateOrganization(
  id: string,
  input: { name?: string; cnpj?: string | null; logo_url?: string | null; plan?: string },
): Promise<void> {
  const { error } = await supabase.from('organizations').update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

/* ------------------------------ HQ — estatísticas ----------------------------- */
export interface HqStats {
  sessions_30d: number;
  sessions_total: number;
  notices_30d: number;
  notices_total: number;
  attendance_records_30d: number;
}
export async function hqStats(): Promise<HqStats> {
  const { data, error } = await supabase.rpc('hq_stats');
  if (error) throw new Error(error.message);
  const row = (data as HqStats[])?.[0];
  return row ?? { sessions_30d: 0, sessions_total: 0, notices_30d: 0, notices_total: 0, attendance_records_30d: 0 };
}

export interface DailyPoint {
  day: string;
  sessions: number;
}
export async function hqAttendanceDaily(): Promise<DailyPoint[]> {
  const { data, error } = await supabase.rpc('hq_attendance_daily');
  if (error) throw new Error(error.message);
  return (data as DailyPoint[]) ?? [];
}

/* ----------------------- Centro de permissões (overrides) --------------------- */
export interface PermissionSetting {
  role: AppRole;
  module: string;
  allowed: boolean;
}
export async function listPermissionSettings(): Promise<PermissionSetting[]> {
  return unwrap(await supabase.from('permission_settings').select('role, module, allowed'));
}
/** Define (upsert) uma permissão papel × módulo. */
export async function savePermissionSetting(role: AppRole, module: string, allowed: boolean): Promise<void> {
  const { error } = await supabase
    .from('permission_settings')
    .upsert({ role, module, allowed }, { onConflict: 'role,module' });
  if (error) throw new Error(error.message);
}
/** Lista de clientes com métricas (só superadmin). */
export async function listOrgAdmin(): Promise<OrgAdmin[]> {
  const { data, error } = await supabase.rpc('org_admin_list');
  if (error) throw new Error(error.message);
  return (data as OrgAdmin[]) ?? [];
}

/** Ativa/inativa um cliente. */
export async function setOrgActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('organizations').update({ active }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Cria uma organização nova (cliente). Só superadmin. Devolve o id. */
export async function createOrganization(name: string, isDemo = false): Promise<string> {
  const { data, error } = await supabase.rpc('create_org', { p_name: name, p_is_demo: isDemo });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Adiciona/atualiza um membro por e-mail (a conta precisa já existir). */
export async function addMember(orgId: string, email: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc('add_member', { p_org: orgId, p_email: email, p_role: role });
  if (error) throw new Error(error.message);
}

/** Define a organização ativa do usuário (para onde vão os novos cadastros). */
export async function setActiveOrg(orgId: string): Promise<void> {
  const { error } = await supabase.rpc('set_active_org', { p_org: orgId });
  if (error) throw new Error(error.message);
}

/** Troca o papel de um membro existente. */
export async function setMemberRole(orgId: string, userId: string, role: AppRole): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { p_org: orgId, p_user: userId, p_role: role });
  if (error) throw new Error(error.message);
}

/** Remove o vínculo do membro com a organização (não apaga a conta). */
export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_member', { p_org: orgId, p_user: userId });
  if (error) throw new Error(error.message);
}

export interface OrgMember {
  user_id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
}
/** Lista membros de uma organização com nome/e-mail (superadmin/diretor). */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const memberships = unwrap<{ user_id: string; role: AppRole }[]>(
    await supabase.from('memberships').select('user_id, role').eq('org_id', orgId),
  );
  if (!memberships.length) return [];
  const ids = memberships.map((m) => m.user_id);
  const profiles = unwrap<{ id: string; full_name: string | null; email: string | null }[]>(
    await supabase.from('profiles').select('id, full_name, email').in('id', ids),
  );
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return memberships.map((m) => ({
    user_id: m.user_id,
    role: m.role,
    full_name: byId.get(m.user_id)?.full_name ?? null,
    email: byId.get(m.user_id)?.email ?? null,
  }));
}

/* ----------------------------- Avisos (Fase 2) -------------------------------- */
export interface NoticeInput {
  title: string;
  body: string;
  audience: NoticeAudience;
  target_role?: AppRole | null;
  target_user?: string | null;
}

/** Pessoas da organização ativa (para escolher destinatário do aviso). */
export async function listOrgPeople(): Promise<OrgPerson[]> {
  const org = getActiveOrgId();
  if (!org) return [];
  const { data, error } = await supabase.rpc('org_people', { p_org: org });
  if (error) throw new Error(error.message);
  return (data as OrgPerson[]) ?? [];
}

/** Dispara um aviso. Devolve o id (para anexar arquivos em seguida). */
export async function sendNotice(input: NoticeInput): Promise<string> {
  const org = getActiveOrgId();
  if (!org) throw new Error('Organização ativa não encontrada.');
  const row = {
    org_id: org,
    title: input.title,
    body: input.body,
    audience: input.audience,
    target_role: input.audience === 'role' ? input.target_role ?? null : null,
    target_user: input.audience === 'user' ? input.target_user ?? null : null,
  };
  const data = unwrap<{ id: string }>(await supabase.from('notices').insert(row).select('id').single());
  return data.id;
}

/** Envia um arquivo para o Storage e registra o anexo do aviso. */
export async function uploadNoticeAttachment(noticeId: string, file: File): Promise<void> {
  const org = getActiveOrgId();
  if (!org) throw new Error('Organização ativa não encontrada.');
  assertUploadFile(file);
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${org}/${noticeId}/${Date.now()}_${safe}`;
  const up = await supabase.storage.from('avisos').upload(path, file, { upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from('notice_attachments').insert({ notice_id: noticeId, org_id: org, name: file.name, path, mime: file.type || null });
  if (error) throw new Error(error.message);
}

/** Gera uma URL temporária (assinada) para baixar/abrir um anexo. */
export async function getAttachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('avisos').createSignedUrl(path, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function attachmentsByNotice(noticeIds: string[]): Promise<Map<string, NoticeAttachment[]>> {
  const map = new Map<string, NoticeAttachment[]>();
  if (!noticeIds.length) return map;
  const rows = unwrap<NoticeAttachment[]>(
    await supabase.from('notice_attachments').select('id, notice_id, name, path, mime').in('notice_id', noticeIds),
  );
  // Pré-gera as URLs assinadas (evita popup bloqueado ao abrir depois de um await).
  if (rows.length) {
    const { data: signed } = await supabase.storage.from('avisos').createSignedUrls(
      rows.map((r) => r.path),
      3600,
    );
    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl] as const));
    for (const r of rows) r.url = urlByPath.get(r.path);
  }
  for (const a of rows) {
    const list = map.get(a.notice_id) ?? [];
    list.push(a);
    map.set(a.notice_id, list);
  }
  return map;
}

export async function deleteNotice(id: string): Promise<void> {
  const { error } = await supabase.from('notices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Marca um aviso como lido pelo usuário atual. */
export async function markNoticeRead(id: string): Promise<void> {
  const { error } = await supabase.from('notice_reads').upsert({ notice_id: id }, { onConflict: 'notice_id,user_id' });
  if (error) throw new Error(error.message);
}

export interface ReceivedNotice extends Notice {
  read: boolean;
  attachments: NoticeAttachment[];
  authorName: string | null;
  authorRole: AppRole | null;
}
/** Avisos recebidos pelo usuário (exclui os que ele mesmo enviou), com status de leitura. */
export async function listReceivedNotices(userId: string): Promise<ReceivedNotice[]> {
  const notices = unwrap<Notice[]>(
    await scoped(supabase.from('notices').select('*')).order('created_at', { ascending: false }),
  );
  const mine = notices.filter((n) => n.author_id !== userId);
  const reads = unwrap<{ notice_id: string }[]>(
    await supabase.from('notice_reads').select('notice_id').eq('user_id', userId),
  );
  const readSet = new Set(reads.map((r) => r.notice_id));
  const atts = await attachmentsByNotice(mine.map((n) => n.id));
  // Resolve o nome de quem enviou (RLS de profiles não deixa ler colegas; usa org_people).
  const people = await listOrgPeople().catch(() => []);
  const byId = new Map(people.map((p) => [p.user_id, p] as const));
  return mine.map((n) => ({
    ...n,
    read: readSet.has(n.id),
    attachments: atts.get(n.id) ?? [],
    authorName: byId.get(n.author_id)?.full_name ?? null,
    authorRole: byId.get(n.author_id)?.role ?? null,
  }));
}

export interface SentNotice extends Notice {
  reads: number;
  attachments: NoticeAttachment[];
}
/** Avisos enviados pelo usuário, com contagem de confirmações de leitura. */
export async function listSentNotices(userId: string): Promise<SentNotice[]> {
  const notices = unwrap<Notice[]>(
    await scoped(supabase.from('notices').select('*')).eq('author_id', userId).order('created_at', { ascending: false }),
  );
  if (!notices.length) return [];
  const ids = notices.map((n) => n.id);
  const reads = unwrap<{ notice_id: string }[]>(
    await supabase.from('notice_reads').select('notice_id').in('notice_id', ids),
  );
  const count = new Map<string, number>();
  for (const r of reads) count.set(r.notice_id, (count.get(r.notice_id) ?? 0) + 1);
  const atts = await attachmentsByNotice(ids);
  return notices.map((n) => ({ ...n, reads: count.get(n.id) ?? 0, attachments: atts.get(n.id) ?? [] }));
}

/** Quantos avisos recebidos ainda não foram lidos (para o selo do menu). */
export async function unreadNoticeCount(userId: string): Promise<number> {
  const received = await listReceivedNotices(userId);
  return received.filter((n) => !n.read).length;
}

/* ----------------------------- Calendário (Fase 4) ---------------------------- */
export interface EventInput {
  id?: string;
  title: string;
  description: string;
  category: string;
  event_date: string;
  end_date?: string | null;
  audience: EventAudience;
  target_role?: AppRole | null;
  target_user?: string | null;
}

export async function saveEvent(input: EventInput): Promise<string> {
  const row = {
    title: input.title,
    description: input.description,
    category: input.category,
    event_date: input.event_date,
    end_date: input.end_date || null,
    audience: input.audience,
    target_role: input.audience === 'role' ? input.target_role ?? null : null,
    target_user: input.audience === 'user' ? input.target_user ?? null : null,
  };
  if (input.id) {
    const { error } = await scoped(supabase.from('calendar_events').update(row)).eq('id', input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const data = unwrap<{ id: string }>(await supabase.from('calendar_events').insert(row).select('id').single());
  return data.id;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await scoped(supabase.from('calendar_events').delete()).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Cria vários eventos de uma vez (importação de planilha/ICS). Devolve a quantidade. */
export async function bulkCreateEvents(
  events: { title: string; description: string; category: string; event_date: string; end_date: string | null }[],
): Promise<number> {
  if (!events.length) return 0;
  const rows = events.map((e) => ({
    title: e.title,
    description: e.description,
    category: e.category,
    event_date: e.event_date,
    end_date: e.end_date || null,
    audience: 'all' as const,
  }));
  const { error } = await supabase.from('calendar_events').insert(rows);
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function uploadEventAttachment(eventId: string, file: File): Promise<void> {
  const org = getActiveOrgId();
  if (!org) throw new Error('Organização ativa não encontrada.');
  assertUploadFile(file);
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${org}/${eventId}/${Date.now()}_${safe}`;
  const up = await supabase.storage.from('calendario').upload(path, file, { upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from('event_attachments').insert({ event_id: eventId, name: file.name, path, mime: file.type });
  if (error) throw new Error(error.message);
}

export async function deleteEventAttachment(att: EventAttachment): Promise<void> {
  await supabase.storage.from('calendario').remove([att.path]);
  const { error } = await scoped(supabase.from('event_attachments').delete()).eq('id', att.id);
  if (error) throw new Error(error.message);
}

/* -------------------------- Uploads prontos do calendário -------------------------- */
export async function listCalendarUploads(): Promise<CalendarUpload[]> {
  const uploads = unwrap<CalendarUpload[]>(
    await scoped(supabase.from('calendar_uploads').select('*')).order('created_at', { ascending: false }),
  );
  if (!uploads.length) return [];
  const { data: signed } = await supabase.storage.from('calendario').createSignedUrls(uploads.map((u) => u.path), 3600);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl] as const));
  return uploads.map((upload) => ({ ...upload, url: urlByPath.get(upload.path) }));
}

export async function uploadCalendarDocument(slot: CalendarUploadSlot, file: File): Promise<void> {
  const org = getActiveOrgId();
  if (!org) throw new Error('Organização ativa não encontrada.');
  assertUploadFile(file);
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${org}/uploads/${slot}/${Date.now()}_${safe}`;
  const up = await supabase.storage.from('calendario').upload(path, file, { upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from('calendar_uploads').insert({
    slot,
    title: calendarUploadTitle(slot),
    name: file.name,
    path,
    mime: file.type || null,
  });
  if (error) throw new Error(error.message);
}

export async function deleteCalendarUpload(upload: CalendarUpload): Promise<void> {
  await supabase.storage.from('calendario').remove([upload.path]);
  const { error } = await scoped(supabase.from('calendar_uploads').delete()).eq('id', upload.id);
  if (error) throw new Error(error.message);
}

export async function listCalendarHolidays(): Promise<CalendarHoliday[]> {
  return unwrap<CalendarHoliday[]>(
    await scoped(supabase.from('calendar_holidays').select('*')).order('date', { ascending: true }),
  );
}

export async function saveCalendarHoliday(input: Omit<CalendarHoliday, 'id'> & { id?: string }): Promise<CalendarHoliday> {
  const row = {
    title: input.title,
    date: input.date,
    scope: input.scope,
    state: input.state || null,
    city: input.city || null,
    source: input.source || 'Cadastro manual',
  };
  if (input.id) return unwrap(await scoped(supabase.from('calendar_holidays').update(row)).eq('id', input.id).select().single());
  return unwrap(await supabase.from('calendar_holidays').insert(row).select().single());
}

export async function deleteCalendarHoliday(id: string): Promise<void> {
  const { error } = await scoped(supabase.from('calendar_holidays').delete()).eq('id', id);
  if (error) throw new Error(error.message);
}

function calendarUploadTitle(slot: CalendarUploadSlot) {
  const labels: Record<CalendarUploadSlot, string> = {
    annual: 'Calendário geral anual',
    term1: 'Calendário do 1º trimestre',
    term2: 'Calendário do 2º trimestre',
    term3: 'Calendário do 3º trimestre',
  };
  return labels[slot];
}

export interface EventWithMeta extends CalendarEvent {
  attachments: EventAttachment[];
  authorName: string | null;
}
/** Eventos visíveis (do mês/visão), com anexos (URL assinada) e nome do autor. */
export async function listEvents(): Promise<EventWithMeta[]> {
  const events = unwrap<CalendarEvent[]>(
    await scoped(supabase.from('calendar_events').select('*')).order('event_date', { ascending: true }),
  );
  if (!events.length) return [];
  const ids = events.map((e) => e.id);
  const atts = unwrap<EventAttachment[]>(
    await scoped(supabase.from('event_attachments').select('id, event_id, name, path, mime')).in('event_id', ids),
  );
  if (atts.length) {
    const { data: signed } = await supabase.storage.from('calendario').createSignedUrls(atts.map((a) => a.path), 3600);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl] as const));
    for (const a of atts) a.url = urlByPath.get(a.path);
  }
  const byEvent = new Map<string, EventAttachment[]>();
  for (const a of atts) {
    const l = byEvent.get(a.event_id) ?? [];
    l.push(a);
    byEvent.set(a.event_id, l);
  }
  const people = await listOrgPeople().catch(() => []);
  const nameById = new Map(people.map((p) => [p.user_id, p.full_name] as const));
  return events.map((e) => ({ ...e, attachments: byEvent.get(e.id) ?? [], authorName: nameById.get(e.author_id) ?? null }));
}

/* ----------------------- Planejamento do professor (Fase 3) ------------------- */
export interface PlanInput {
  id?: string;
  title: string;
  class_id?: string | null;
  week_start?: string | null;
  content: string;
}

export async function savePlan(input: PlanInput): Promise<string> {
  const row = {
    title: input.title,
    class_id: input.class_id || null,
    week_start: input.week_start || null,
    content: input.content,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await supabase.from('lesson_plans').update(row).eq('id', input.id);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const data = unwrap<{ id: string }>(await supabase.from('lesson_plans').insert(row).select('id').single());
  return data.id;
}

/** Envia para a coordenação (status -> enviado). */
export async function submitPlan(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_plans').update({ status: 'enviado', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Coordenação aprova ou devolve (com feedback). */
export async function reviewPlan(id: string, status: 'aprovado' | 'devolvido', feedback: string): Promise<void> {
  const { error } = await supabase.rpc('review_plan', { p_id: id, p_status: status, p_feedback: feedback });
  if (error) throw new Error(error.message);
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from('lesson_plans').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadPlanAttachment(planId: string, file: File): Promise<void> {
  assertUploadFile(file);
  const org = getActiveOrgId();
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${org}/${planId}/${Date.now()}_${safe}`;
  const up = await supabase.storage.from('planejamentos').upload(path, file, { upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from('lesson_plan_attachments').insert({ plan_id: planId, name: file.name, path, mime: file.type });
  if (error) throw new Error(error.message);
}

export interface PlanWithMeta extends LessonPlan {
  attachments: PlanAttachment[];
  authorName: string | null;
  className: string | null;
}

async function enrichPlans(plans: LessonPlan[]): Promise<PlanWithMeta[]> {
  if (!plans.length) return [];
  const ids = plans.map((p) => p.id);
  const atts = unwrap<PlanAttachment[]>(
    await supabase.from('lesson_plan_attachments').select('id, plan_id, name, path, mime').in('plan_id', ids),
  );
  if (atts.length) {
    const { data: signed } = await supabase.storage.from('planejamentos').createSignedUrls(atts.map((a) => a.path), 3600);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? '', s.signedUrl] as const));
    for (const a of atts) a.url = urlByPath.get(a.path);
  }
  const byPlan = new Map<string, PlanAttachment[]>();
  for (const a of atts) {
    const l = byPlan.get(a.plan_id) ?? [];
    l.push(a);
    byPlan.set(a.plan_id, l);
  }
  const [people, classes] = await Promise.all([listOrgPeople().catch(() => []), listClasses().catch(() => [])]);
  const nameById = new Map(people.map((p) => [p.user_id, p.full_name] as const));
  const classById = new Map(classes.map((c) => [c.id, c.name] as const));
  return plans.map((p) => ({
    ...p,
    attachments: byPlan.get(p.id) ?? [],
    authorName: nameById.get(p.author_id) ?? null,
    className: p.class_id ? classById.get(p.class_id) ?? null : null,
  }));
}

/** Planejamentos do próprio professor. */
export async function listMyPlans(userId: string): Promise<PlanWithMeta[]> {
  const plans = unwrap<LessonPlan[]>(
    await scoped(supabase.from('lesson_plans').select('*')).eq('author_id', userId).order('updated_at', { ascending: false }),
  );
  return enrichPlans(plans);
}

/** Todos os planejamentos visíveis (coordenação/diretoria veem da organização). */
export async function listOrgPlans(status?: PlanStatus): Promise<PlanWithMeta[]> {
  let q = scoped(supabase.from('lesson_plans').select('*'));
  if (status) q = q.eq('status', status);
  const plans = unwrap<LessonPlan[]>(await q.order('updated_at', { ascending: false }));
  return enrichPlans(plans);
}

/* --------------------------------- Dashboard ----------------------------------- */
export async function dashboardCounts() {
  const [schools, classes, students] = await Promise.all([
    scoped(supabase.from('schools').select('id', { count: 'exact', head: true })),
    scoped(supabase.from('classes').select('id', { count: 'exact', head: true })),
    scoped(supabase.from('students').select('id', { count: 'exact', head: true })),
  ]);
  return {
    schools: schools.count ?? 0,
    classes: classes.count ?? 0,
    students: students.count ?? 0,
  };
}
