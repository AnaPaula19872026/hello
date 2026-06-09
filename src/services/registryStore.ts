import type { ClassRoom, School, Student, Subject } from '../types';
import { db, enqueueSync } from '../lib/offlineDb';

export type RegistryKind = 'school' | 'class' | 'student' | 'subject';

export type SchoolForm = { name: string; city: string };
export type ClassForm = { name: string; shift: string; schoolId: string };
export type StudentForm = { name: string; registration: string; classId: string; guardian: string; phone: string };
export type SubjectForm = { name: string; teacherId: string };

export type RegistryForm = SchoolForm | ClassForm | StudentForm | SubjectForm;

const ids = {
  school: () => `school-${crypto.randomUUID()}`,
  class: () => `class-${crypto.randomUUID()}`,
  student: () => `student-${crypto.randomUUID()}`,
  subject: () => `subject-${crypto.randomUUID()}`,
};

export async function listSchools() {
  return db.schools.orderBy('name').toArray();
}

export async function listClasses() {
  return db.classes.orderBy('name').toArray();
}

export async function listStudents() {
  return db.students.orderBy('name').toArray();
}

export async function listSubjects() {
  return db.subjects.orderBy('name').toArray();
}

export async function getRegistryData(kind: RegistryKind) {
  if (kind === 'school') return listSchools();
  if (kind === 'class') return listClasses();
  if (kind === 'student') return listStudents();
  return listSubjects();
}

export async function saveRegistry(kind: RegistryKind, form: RegistryForm, id?: string) {
  if (kind === 'school') {
    const payload: School = { id: id ?? ids.school(), ...(form as SchoolForm) };
    await db.schools.put(payload);
    await enqueueSync(id ? 'schools.update' : 'schools.create', payload);
    return payload;
  }

  if (kind === 'class') {
    const data = form as ClassForm;
    const payload: ClassRoom = { id: id ?? ids.class(), name: data.name, shift: data.shift, schoolId: data.schoolId, studentsCount: 0 };
    await db.classes.put(payload);
    await enqueueSync(id ? 'classes.update' : 'classes.create', payload);
    return payload;
  }

  if (kind === 'student') {
    const data = form as StudentForm;
    const payload: Student = {
      id: id ?? ids.student(),
      name: data.name,
      registration: data.registration,
      classId: data.classId,
      guardian: data.guardian,
      phone: data.phone,
      active: true,
      absenceRate: 0,
    };
    await db.students.put(payload);
    await enqueueSync(id ? 'students.update' : 'students.create', payload);
    return payload;
  }

  const payload: Subject = { id: id ?? ids.subject(), ...(form as SubjectForm) };
  await db.subjects.put(payload);
  await enqueueSync(id ? 'subjects.update' : 'subjects.create', payload);
  return payload;
}

export async function deleteRegistry(kind: RegistryKind, id: string) {
  if (kind === 'school') {
    const classes = await db.classes.where('schoolId').equals(id).toArray();
    const classIds = classes.map((item) => item.id);
    await db.transaction('rw', db.schools, db.classes, db.students, async () => {
      await db.students.where('classId').anyOf(classIds.length ? classIds : ['']).delete();
      await db.classes.where('schoolId').equals(id).delete();
      await db.schools.delete(id);
    });
  } else if (kind === 'class') {
    await db.transaction('rw', db.classes, db.students, async () => {
      await db.students.where('classId').equals(id).delete();
      await db.classes.delete(id);
    });
  } else if (kind === 'student') {
    await db.students.delete(id);
  } else {
    await db.subjects.delete(id);
  }

  await enqueueSync(`${kind}s.delete`, { id });
}

export async function dashboardStats() {
  const [schoolCount, classCount, studentCount, sessions, students] = await Promise.all([
    db.schools.count(),
    db.classes.count(),
    db.students.count(),
    db.sessions.toArray(),
    db.students.toArray(),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = sessions.filter((session) => session.date === today).length;
  const absenceAlerts = students.filter((student) => student.absenceRate >= 25).length;

  return { schoolCount, classCount, studentCount, todaySessions, absenceAlerts };
}
