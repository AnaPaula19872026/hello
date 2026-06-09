-- Migração: aluno único (sem duplicados)
-- Rode UMA vez no SQL Editor.
-- Os passos 1 e 2 APAGAM alunos duplicados, mantendo o mais antigo de cada grupo.
-- (Opcional) Veja antes o que será removido com os SELECTs comentados no fim.

-- 1) Remove duplicados de MATRÍCULA na mesma escola (mantém o mais antigo)
delete from public.students s
using (
  select id, row_number() over (
    partition by school_id, registration order by created_at, id
  ) as rn
  from public.students
  where registration is not null and registration <> ''
) d
where s.id = d.id and d.rn > 1;

-- 2) Remove duplicados de NOME na mesma turma (mantém o mais antigo)
delete from public.students s
using (
  select id, row_number() over (
    partition by class_id, lower(full_name) order by created_at, id
  ) as rn
  from public.students
  where class_id is not null
) d
where s.id = d.id and d.rn > 1;

-- 3) Cria os índices de unicidade
create unique index if not exists uq_students_registration
  on public.students (school_id, registration)
  where registration is not null and registration <> '';

create unique index if not exists uq_students_name_class
  on public.students (class_id, lower(full_name))
  where class_id is not null;

-- ------------------------------------------------------------------
-- (Opcional) Para VER os duplicados antes de apagar, rode só isto:
-- select school_id, registration, count(*)
-- from public.students
-- where registration is not null and registration <> ''
-- group by school_id, registration having count(*) > 1;
--
-- select class_id, lower(full_name), count(*)
-- from public.students
-- where class_id is not null
-- group by class_id, lower(full_name) having count(*) > 1;
