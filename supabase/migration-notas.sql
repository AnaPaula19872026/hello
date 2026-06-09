-- Migração: módulo de Notas (mensais, matéria Língua Inglesa)
-- Rode UMA vez no SQL Editor do Supabase. Não apaga dados.

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  subject text not null default 'Língua Inglesa',
  year int not null,
  month int not null check (month between 1 and 12),
  score numeric(4,2) check (score >= 0 and score <= 10),
  note text,
  updated_at timestamptz default now(),
  unique (student_id, subject, year, month)
);

create index if not exists idx_grades_class_year on public.grades(class_id, year);
create index if not exists idx_grades_student on public.grades(student_id);

alter table public.grades enable row level security;

drop policy if exists "grades own" on public.grades;
create policy "grades own" on public.grades
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());
