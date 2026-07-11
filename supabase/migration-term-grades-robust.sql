-- ============================================================================
-- Notas: robustez de persistência por organização/turma
-- ----------------------------------------------------------------------------
-- Garante que as notas trimestrais fiquem vinculadas à organização correta.
-- Isto evita "sumir no refresh" por linha sem org_id e prepara uma unicidade
-- segura para SaaS: organização + turma + aluno + ano + trimestre.
-- ============================================================================

alter table public.term_grades add column if not exists org_id uuid references public.organizations(id) on delete cascade;

update public.term_grades tg
set org_id = c.org_id
from public.classes c
where tg.class_id = c.id
  and tg.org_id is null
  and c.org_id is not null;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'default_org') then
    execute 'alter table public.term_grades alter column org_id set default public.default_org()';
  end if;
end $$;

create unique index if not exists uq_term_grades_org_class_student_year_term
  on public.term_grades(org_id, class_id, student_id, year, term);

create index if not exists idx_term_grades_org_lookup
  on public.term_grades(org_id, class_id, year, term);
