-- Migração: notas por trimestre (composição de atividades)
-- Rode UMA vez no SQL Editor. Não apaga dados.

-- Composição de notas: quanto cada atividade vale em cada trimestre/ano.
create table if not exists public.grade_terms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null,
  term int not null check (term between 1 and 4),
  activities jsonb not null default '[]',  -- [{ "name": "TESTE", "max": 10 }, ...]
  updated_at timestamptz default now(),
  unique (year, term)
);

-- Notas lançadas por aluno em cada trimestre (uma nota por atividade).
create table if not exists public.term_grades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  year int not null,
  term int not null check (term between 1 and 4),
  scores jsonb not null default '{}',  -- { "TESTE": 8, "E-CERM": 7, ... }
  updated_at timestamptz default now(),
  unique (student_id, year, term)
);

create index if not exists idx_term_grades_lookup on public.term_grades(class_id, year, term);

alter table public.grade_terms enable row level security;
alter table public.term_grades enable row level security;

drop policy if exists "grade_terms own" on public.grade_terms;
create policy "grade_terms own" on public.grade_terms
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "term_grades own" on public.term_grades;
create policy "term_grades own" on public.term_grades
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());
