-- Migração: aluno único (sem duplicados)
-- Rode UMA vez no SQL Editor. Se houver duplicados, remova-os antes (o índice falha senão).

-- Matrícula única por escola
create unique index if not exists uq_students_registration
  on public.students (school_id, registration)
  where registration is not null and registration <> '';

-- Nome único por turma
create unique index if not exists uq_students_name_class
  on public.students (class_id, lower(full_name))
  where class_id is not null;
