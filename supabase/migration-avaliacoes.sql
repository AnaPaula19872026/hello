-- ============================================================================
-- hello — Centro de Avaliações (controle de atividades da turma, sem média)
-- A professora define as atividades (composição) por turma/ano/trimestre e
-- registra quem fez + pontuação. Não calcula média — é controle de atividades.
-- Isolado por organização. Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

-- Composição (lista de atividades) por turma/ano/trimestre.
create table if not exists public.evaluation_terms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  year int not null,
  term int not null,
  activities jsonb not null default '[]'::jsonb,   -- [{ "name": "...", "max": 10 }]
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, class_id, year, term)
);
create index if not exists idx_eval_terms_lookup on public.evaluation_terms(org_id, class_id, year, term);

-- Registro por aluno: quem fez cada atividade e a pontuação.
create table if not exists public.evaluation_grades (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  year int not null,
  term int not null,
  marks jsonb not null default '{}'::jsonb,         -- { "Atividade X": { "done": true, "score": 8 } }
  updated_at timestamptz default now(),
  unique (org_id, class_id, student_id, year, term)
);
create index if not exists idx_eval_grades_lookup on public.evaluation_grades(org_id, class_id, year, term);

alter table public.evaluation_terms enable row level security;
alter table public.evaluation_grades enable row level security;

-- Isolamento por organização (mesmo predicado das demais tabelas de dados).
do $$
declare t text;
declare pred text := 'org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())';
begin
  foreach t in array array['evaluation_terms','evaluation_grades'] loop
    execute format('drop policy if exists "%s org" on public.%I', t, t);
    execute format('create policy "%s org" on public.%I for all using (%s) with check (%s)', t, t, pred, pred);
  end loop;
end $$;
