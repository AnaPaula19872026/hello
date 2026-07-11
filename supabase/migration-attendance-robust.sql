-- ============================================================================
-- Chamadas: robustez de persistência por organização
-- ----------------------------------------------------------------------------
-- Garante que sessões/registros de chamada fiquem vinculados ao tenant correto
-- e que exista no máximo um registro por aluno em cada chamada.
-- ============================================================================

alter table public.attendance_sessions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.attendance_records add column if not exists org_id uuid references public.organizations(id) on delete cascade;

update public.attendance_sessions s
set org_id = c.org_id
from public.classes c
where s.class_id = c.id
  and s.org_id is null
  and c.org_id is not null;

update public.attendance_records r
set org_id = s.org_id
from public.attendance_sessions s
where r.session_id = s.id
  and r.org_id is null
  and s.org_id is not null;

do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'default_org') then
    execute 'alter table public.attendance_sessions alter column org_id set default public.default_org()';
    execute 'alter table public.attendance_records alter column org_id set default public.default_org()';
  end if;
end $$;

with duplicated as (
  select ctid, row_number() over (partition by session_id, student_id order by id) as rn
  from public.attendance_records
)
delete from public.attendance_records r
using duplicated d
where r.ctid = d.ctid
  and d.rn > 1;

create unique index if not exists uq_attendance_records_session_student
  on public.attendance_records(session_id, student_id);

create unique index if not exists uq_attendance_sessions_org_class_date
  on public.attendance_sessions(org_id, class_id, session_date);

create index if not exists idx_attendance_sessions_org_lookup
  on public.attendance_sessions(org_id, class_id, session_date);
