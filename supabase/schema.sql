-- hello — Gestão Escolar (Supabase / PostgreSQL)
-- Modelo enxuto, multi-tela, dados na nuvem. Cada usuário só enxerga o que é seu (RLS por owner_id).

create extension if not exists "pgcrypto";

do $$ begin
  create type public.attendance_status as enum ('present', 'absent', 'late', 'justified');
exception when duplicate_object then null; end $$;

-- Perfil do usuário (espelha auth.users) ---------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  calendar_url text,                 -- URL de embed da Google Agenda
  created_at timestamptz default now()
);

-- Cadastros --------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  city text,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  shift text default 'Manhã',
  year int,
  created_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  full_name text not null,
  registration text,
  guardian_name text,
  guardian_phone text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Chamadas (presenças/faltas) --------------------------------------------------
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  session_date date not null default current_date,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (class_id, session_date)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null default 'present',
  note text,
  unique (session_id, student_id)
);

-- Índices ----------------------------------------------------------------------
create index if not exists idx_classes_school on public.classes(school_id);
create index if not exists idx_students_class on public.students(class_id);
create index if not exists idx_students_school on public.students(school_id);
create index if not exists idx_sessions_lookup on public.attendance_sessions(class_id, session_date);
create index if not exists idx_records_session on public.attendance_records(session_id);
create index if not exists idx_records_student on public.attendance_records(student_id);

-- RLS --------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

do $$ begin
  create policy "profiles self" on public.profiles
    for all using (id = auth.uid()) with check (id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "schools own" on public.schools
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "classes own" on public.classes
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "students own" on public.students
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "sessions own" on public.attendance_sessions
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "records own" on public.attendance_records
    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Cria o perfil automaticamente no primeiro login (Google) ----------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
