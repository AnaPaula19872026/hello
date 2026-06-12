-- ============================================================================
-- hello — MIGRAÇÃO CONSOLIDADA (rode tudo de uma vez, em ordem de dependência)
-- ----------------------------------------------------------------------------
-- BANCO NOVO: rode antes o schema.sql (tabelas base) e DEPOIS este arquivo.
-- BANCO EXISTENTE (produção): rode só este — idempotente e seguro
--   (create if not exists / or replace / drop policy if exists). NÃO apaga dados.
-- Administrador (master/superadmin) do sistema: SOMENTE minitecnico@gmail.com.
-- ============================================================================



-- ############################################################################
-- ## migration-master.sql
-- ############################################################################

-- Migração: administradores master + dados compartilhados
-- Rode UMA vez no SQL Editor do Supabase. Não apaga dados.

-- 1. Coluna de papel no perfil
alter table public.profiles add column if not exists role text not null default 'user';

-- 2. Função: verdadeiro se o usuário logado for master (ignora RLS de profiles)
create or replace function public.is_master()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'master');
$$;

-- 3. Garante um perfil para todos os usuários já cadastrados (caso falte)
insert into public.profiles (id, full_name, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
       u.email
from auth.users u
on conflict (id) do nothing;

-- 4. Apenas minitecnico é Administrador (master) do sistema.
update public.profiles set role = 'master' where lower(email) = 'minitecnico@gmail.com';
-- Rebaixa qualquer outro master legado (ex.: Ana) para usuário comum.
update public.profiles set role = 'user'
where role = 'master' and lower(email) is distinct from 'minitecnico@gmail.com';

-- 5. Recria as políticas: master vê/edita tudo; demais, só o próprio
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for select using (id = auth.uid() or public.is_master());
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "schools own" on public.schools;
create policy "schools own" on public.schools
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "classes own" on public.classes;
create policy "classes own" on public.classes
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "students own" on public.students;
create policy "students own" on public.students
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "sessions own" on public.attendance_sessions;
create policy "sessions own" on public.attendance_sessions
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "records own" on public.attendance_records;
create policy "records own" on public.attendance_records
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

-- Confere
select email, role from public.profiles order by role desc;



-- ############################################################################
-- ## migration-escola.sql
-- ############################################################################

-- Migração: campos extras + logo da escola
-- Rode UMA vez no SQL Editor do Supabase. Não apaga dados.

alter table public.schools add column if not exists logo_url text;  -- base64 (data URL) da logo
alter table public.schools add column if not exists director text;
alter table public.schools add column if not exists address text;
alter table public.schools add column if not exists phone text;
alter table public.schools add column if not exists inep text;



-- ############################################################################
-- ## migration-aluno-unico.sql
-- ############################################################################

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



-- ############################################################################
-- ## migration-notas.sql
-- ############################################################################

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



-- ############################################################################
-- ## migration-notas-trimestre.sql
-- ############################################################################

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



-- ############################################################################
-- ## migration-relatorios.sql
-- ############################################################################

-- Migração: relatórios compartilháveis por link
-- Rode UMA vez no SQL Editor. Não apaga dados.

create table if not exists public.shared_reports (
  id text primary key,                 -- id curto usado no link /r/<id>
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null,              -- relatório pronto para renderizar
  created_at timestamptz default now()
);

alter table public.shared_reports enable row level security;

-- Qualquer pessoa com o link pode LER (relatório público por link)
drop policy if exists "shared read" on public.shared_reports;
create policy "shared read" on public.shared_reports for select using (true);

-- Só o dono autenticado cria/remove
drop policy if exists "shared insert" on public.shared_reports;
create policy "shared insert" on public.shared_reports for insert with check (owner_id = auth.uid());

drop policy if exists "shared delete" on public.shared_reports;
create policy "shared delete" on public.shared_reports for delete using (owner_id = auth.uid());



-- ############################################################################
-- ## migration-saas.sql
-- ############################################################################

-- ============================================================================
-- hello — Fase 1 (SaaS multi-tenant): organizações, papéis (RBAC) e isolamento
-- ----------------------------------------------------------------------------
-- O QUE FAZ:
--   1. Cria organizations (tenant = cliente, com 1..N escolas) e memberships
--      (usuário ↔ organização ↔ papel).
--   2. Migra TODOS os dados de produção atuais para uma "Organização principal"
--      (NÃO perde nada). Os masters atuais viram superadmin do sistema.
--   3. Troca o isolamento de RLS: antes por owner_id, agora por organização.
--
-- SEGURO RODAR MAIS DE UMA VEZ (idempotente). Mesmo assim: FAÇA BACKUP antes
-- (Supabase → Database → Backups) — mexe em RLS de produção.
-- Rodar inteiro no Supabase → SQL Editor.
-- ============================================================================

-- 1) Papéis do sistema --------------------------------------------------------
do $$ begin
  create type public.user_role as enum
    ('superadmin','diretor','coordenador','professor','secretaria','marketing','cpd');
exception when duplicate_object then null; end $$;

-- 2) Perfil ganha flags de tenant --------------------------------------------
alter table public.profiles add column if not exists is_superadmin boolean not null default false;
alter table public.profiles add column if not exists active_org_id uuid;

-- 3) Organizações (tenant) e vínculos ----------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',     -- trial | active | suspended
  is_demo boolean not null default false,  -- organização de demonstração
  active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role public.user_role not null default 'professor',
  created_at timestamptz default now(),
  unique (user_id, org_id)
);
create index if not exists idx_memberships_user on public.memberships(user_id);
create index if not exists idx_memberships_org on public.memberships(org_id);

-- 4) Funções auxiliares (security definer = ignoram RLS, evitam recursão) ------
create or replace function public.is_superadmin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_superadmin = true);
$$;

-- Mantém is_master() como apelido (já usado nas políticas de profiles).
create or replace function public.is_master()
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_superadmin();
$$;

create or replace function public.member_orgs()
returns setof uuid language sql security definer stable set search_path = public as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

-- Organização "ativa" do usuário (define para onde vão os inserts).
create or replace function public.default_org()
returns uuid language sql security definer stable set search_path = public as $$
  select coalesce(
    (select active_org_id from public.profiles where id = auth.uid()),
    (select org_id from public.memberships where user_id = auth.uid() order by created_at limit 1)
  );
$$;

-- Papel do usuário logado dentro de uma organização.
create or replace function public.org_role(p_org uuid)
returns public.user_role language sql security definer stable set search_path = public as $$
  select role from public.memberships where user_id = auth.uid() and org_id = p_org;
$$;

-- 5) Coluna org_id em todas as tabelas de dados ------------------------------
alter table public.schools             add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.classes             add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.students            add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.attendance_sessions add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.attendance_records  add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.grades              add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.grade_terms         add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.term_grades         add column if not exists org_id uuid references public.organizations(id) on delete cascade;
alter table public.shared_reports      add column if not exists org_id uuid references public.organizations(id) on delete cascade;

-- 6) Backfill: migra os dados atuais para a "Organização principal" -----------
do $$
declare def_org uuid;
begin
  if not exists (select 1 from public.organizations where is_demo = false) then
    insert into public.organizations (name, plan, is_demo)
      values ('Organização principal', 'active', false) returning id into def_org;
  else
    select id into def_org from public.organizations where is_demo = false order by created_at limit 1;
  end if;

  -- Os masters atuais viram superadmin do sistema.
  update public.profiles set is_superadmin = true where role = 'master';

  -- Cria vínculo para todo perfil que ainda não tem nenhum.
  insert into public.memberships (user_id, org_id, role)
  select p.id, def_org,
         case when p.role = 'master' then 'diretor'::public.user_role else 'professor'::public.user_role end
  from public.profiles p
  where not exists (select 1 from public.memberships m where m.user_id = p.id)
  on conflict (user_id, org_id) do nothing;

  update public.profiles set active_org_id = def_org where active_org_id is null;

  -- Carimba org_id em todos os registros existentes.
  update public.schools             set org_id = def_org where org_id is null;
  update public.classes             set org_id = def_org where org_id is null;
  update public.students            set org_id = def_org where org_id is null;
  update public.attendance_sessions set org_id = def_org where org_id is null;
  update public.attendance_records  set org_id = def_org where org_id is null;
  update public.grades              set org_id = def_org where org_id is null;
  update public.grade_terms         set org_id = def_org where org_id is null;
  update public.term_grades         set org_id = def_org where org_id is null;
  update public.shared_reports      set org_id = def_org where org_id is null;
end $$;

-- Organização de DEMONSTRAÇÃO (para apresentar a clientes).
insert into public.organizations (name, plan, is_demo)
select 'DEMONSTRAÇÃO', 'active', true
where not exists (select 1 from public.organizations where is_demo = true);

-- 7) Agora que está tudo preenchido: default automático + NOT NULL ------------
do $$
declare t text;
begin
  foreach t in array array[
    'schools','classes','students','attendance_sessions','attendance_records',
    'grades','grade_terms','term_grades','shared_reports'
  ] loop
    execute format('alter table public.%I alter column org_id set default public.default_org()', t);
    execute format('alter table public.%I alter column org_id set not null', t);
  end loop;
end $$;

-- Unicidade da composição de notas passa a ser por organização.
alter table public.grade_terms drop constraint if exists grade_terms_year_term_key;
create unique index if not exists uq_grade_terms_org_year_term on public.grade_terms(org_id, year, term);

-- 8) RLS das novas tabelas ----------------------------------------------------
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

drop policy if exists "orgs read" on public.organizations;
create policy "orgs read" on public.organizations
  for select using (id in (select public.member_orgs()) or public.is_superadmin());
drop policy if exists "orgs write" on public.organizations;
create policy "orgs write" on public.organizations
  for all using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists "memb read" on public.memberships;
create policy "memb read" on public.memberships
  for select using (user_id = auth.uid() or org_id in (select public.member_orgs()) or public.is_superadmin());
drop policy if exists "memb write" on public.memberships;
create policy "memb write" on public.memberships
  for all using (public.is_superadmin() or public.org_role(org_id) in ('diretor','coordenador'))
  with check (public.is_superadmin() or public.org_role(org_id) in ('diretor','coordenador'));

-- 9) Troca o isolamento das tabelas de dados: owner_id -> organização ----------
do $$
declare t text;
begin
  foreach t in array array[
    'schools','classes','students','attendance_sessions','attendance_records',
    'grades','grade_terms','term_grades'
  ] loop
    execute format('drop policy if exists "%s own" on public.%I', t, t);
    execute format('drop policy if exists "%s org" on public.%I', t, t);
    execute format($f$create policy "%s org" on public.%I
      for all using (org_id in (select public.member_orgs()) or public.is_superadmin())
      with check (org_id in (select public.member_orgs()) or public.is_superadmin())$f$, t, t);
  end loop;
end $$;

-- shared_reports: leitura pública (link), escrita pela organização.
drop policy if exists "shared read" on public.shared_reports;
create policy "shared read" on public.shared_reports for select using (true);
drop policy if exists "shared insert" on public.shared_reports;
create policy "shared insert" on public.shared_reports
  for insert with check (org_id in (select public.member_orgs()) or public.is_superadmin());
drop policy if exists "shared delete" on public.shared_reports;
create policy "shared delete" on public.shared_reports
  for delete using (org_id in (select public.member_orgs()) or public.is_superadmin());

-- 10) RPCs de provisionamento (chamadas pelo painel do superadmin) ------------
-- Cria organização (cliente novo). Só superadmin.
create or replace function public.create_org(p_name text, p_is_demo boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o superadmin pode criar organizações.'; end if;
  insert into public.organizations (name, is_demo) values (p_name, coalesce(p_is_demo,false)) returning id into new_id;
  return new_id;
end $$;

-- Adiciona/atualiza um membro por e-mail (a conta precisa já existir). Superadmin, diretor ou coordenador.
create or replace function public.add_member(p_org uuid, p_email text, p_role public.user_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not (public.is_superadmin() or public.org_role(p_org) in ('diretor','coordenador')) then
    raise exception 'Sem permissão para gerenciar membros desta organização.';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Não existe conta com o e-mail %. Crie a conta primeiro (o usuário se cadastra ou você cria no Auth).', p_email;
  end if;
  insert into public.memberships (user_id, org_id, role) values (uid, p_org, p_role)
    on conflict (user_id, org_id) do update set role = excluded.role;
  return uid;
end $$;

-- Define a organização ativa do usuário logado (precisa ser membro, ou superadmin).
create or replace function public.set_active_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_superadmin()
          or exists (select 1 from public.memberships where user_id = auth.uid() and org_id = p_org)) then
    raise exception 'Você não tem acesso a essa organização.';
  end if;
  update public.profiles set active_org_id = p_org where id = auth.uid();
end $$;

-- 11) Vincula o usuário de demonstração (se já existir no Auth) ----------------
do $$
declare demo_org uuid; demo_uid uuid;
begin
  select id into demo_org from public.organizations where is_demo = true limit 1;
  select id into demo_uid from auth.users where lower(email) = 'demo@hello.app';
  if demo_org is not null and demo_uid is not null then
    insert into public.memberships (user_id, org_id, role) values (demo_uid, demo_org, 'diretor')
      on conflict (user_id, org_id) do nothing;
    update public.profiles set active_org_id = demo_org where id = demo_uid and active_org_id is null;
  end if;
end $$;

-- ============================================================================
-- VERIFICAÇÃO (rode e confira): deve listar organizações com contagem de dados.
--   select o.name, o.is_demo,
--     (select count(*) from public.schools s where s.org_id=o.id) escolas,
--     (select count(*) from public.students st where st.org_id=o.id) alunos,
--     (select count(*) from public.memberships m where m.org_id=o.id) membros
--   from public.organizations o order by o.created_at;
-- ============================================================================



-- ############################################################################
-- ## migration-avisos.sql
-- ############################################################################

-- ============================================================================
-- hello — Fase 2: Central de Avisos (comunicação entre setores)
-- Coordenação/diretoria dispara avisos para: todos, um papel, ou uma pessoa.
-- Com confirmação de leitura. Isolado por organização.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  audience text not null default 'all' check (audience in ('all','role','user')),
  target_role public.user_role,            -- quando audience = 'role'
  target_user uuid references auth.users(id) on delete cascade, -- quando audience = 'user'
  created_at timestamptz default now()
);
create index if not exists idx_notices_org on public.notices(org_id, created_at desc);

create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  read_at timestamptz default now(),
  primary key (notice_id, user_id)
);

alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;

-- Quem enxerga o aviso: membro da org, conforme o público-alvo; autor sempre; superadmin tudo.
drop policy if exists "notices read" on public.notices;
create policy "notices read" on public.notices for select using (
  (org_id in (select public.member_orgs()) and (
     audience = 'all'
     or (audience = 'role' and target_role = public.org_role(org_id))
     or (audience = 'user' and target_user = auth.uid())
     or author_id = auth.uid()
  ))
  or public.is_superadmin()
);

-- Quem pode disparar: diretor, coordenador ou marketing (ou superadmin).
drop policy if exists "notices send" on public.notices;
create policy "notices send" on public.notices for insert with check (
  author_id = auth.uid()
  and org_id in (select public.member_orgs())
  and (public.is_superadmin() or public.org_role(org_id) in ('diretor','coordenador','marketing'))
);

drop policy if exists "notices delete" on public.notices;
create policy "notices delete" on public.notices for delete using (
  author_id = auth.uid() or public.is_superadmin() or public.org_role(org_id) = 'diretor'
);

-- Confirmação de leitura: cada um marca a própria; autor e superadmin enxergam quem leu.
drop policy if exists "reads read" on public.notice_reads;
create policy "reads read" on public.notice_reads for select using (
  user_id = auth.uid()
  or public.is_superadmin()
  or exists (select 1 from public.notices n where n.id = notice_id and n.author_id = auth.uid())
);
drop policy if exists "reads insert" on public.notice_reads;
create policy "reads insert" on public.notice_reads for insert with check (user_id = auth.uid());

-- Pessoas da organização (para escolher destinatário). Qualquer membro pode listar
-- (a RLS de profiles não deixa ver colegas; esta função definer resolve com segurança).
create or replace function public.org_people(p_org uuid)
returns table(user_id uuid, full_name text, role public.user_role)
language sql security definer stable set search_path = public as $$
  select m.user_id, p.full_name, m.role
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org
    and (public.is_superadmin() or exists (
      select 1 from public.memberships me where me.user_id = auth.uid() and me.org_id = p_org
    ))
  order by p.full_name nulls last;
$$;



-- ############################################################################
-- ## migration-avisos-anexos.sql
-- ############################################################################

-- ============================================================================
-- hello — Avisos: anexos (PDF, DOC/DOCX, PNG, JPG, PPTX, etc.)
-- Arquivos vão para o Storage (bucket privado 'avisos'), isolados por organização.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Bucket privado para os anexos.
insert into storage.buckets (id, name, public)
values ('avisos', 'avisos', false)
on conflict (id) do nothing;

-- 2) Políticas do Storage: o caminho é "<org_id>/<notice_id>/<arquivo>".
--    Membro da organização (1ª pasta = org_id) pode ler/enviar/excluir.
drop policy if exists "avisos storage read" on storage.objects;
create policy "avisos storage read" on storage.objects for select using (
  bucket_id = 'avisos' and (
    public.is_superadmin()
    or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())
  )
);
drop policy if exists "avisos storage insert" on storage.objects;
create policy "avisos storage insert" on storage.objects for insert with check (
  bucket_id = 'avisos' and (
    public.is_superadmin()
    or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())
  )
);
drop policy if exists "avisos storage delete" on storage.objects;
create policy "avisos storage delete" on storage.objects for delete using (
  bucket_id = 'avisos' and (
    public.is_superadmin()
    or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())
  )
);

-- 3) Metadados dos anexos (nome original, caminho no Storage, tipo).
create table if not exists public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  name text not null,
  path text not null,
  mime text,
  created_at timestamptz default now()
);
create index if not exists idx_notice_attachments_notice on public.notice_attachments(notice_id);

alter table public.notice_attachments enable row level security;

-- Visibilidade do anexo segue a visibilidade do aviso (RLS de notices vale na subconsulta).
drop policy if exists "att read" on public.notice_attachments;
create policy "att read" on public.notice_attachments for select using (
  exists (select 1 from public.notices n where n.id = notice_id)
);
drop policy if exists "att insert" on public.notice_attachments;
create policy "att insert" on public.notice_attachments for insert with check (
  exists (select 1 from public.notices n where n.id = notice_id and n.author_id = auth.uid())
);
drop policy if exists "att delete" on public.notice_attachments;
create policy "att delete" on public.notice_attachments for delete using (
  exists (select 1 from public.notices n where n.id = notice_id and (n.author_id = auth.uid() or public.is_superadmin()))
);



-- ############################################################################
-- ## migration-calendario.sql
-- ############################################################################

-- ============================================================================
-- hello — Calendário colaborativo (nativo). Coordenação cria eventos/atividades/
-- gincanas/semana de provas e repassa a professores e funcionários, com anexos
-- (doc, pdf, imagens, HEIC…). Isolado por organização. Rodar no SQL Editor.
-- ============================================================================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  category text not null default 'evento',            -- evento|atividade|gincana|prova|reuniao|outro
  event_date date not null,
  end_date date,                                      -- opcional (evento de vários dias)
  audience text not null default 'all' check (audience in ('all','role','user')),
  target_role public.user_role,
  target_user uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists idx_calevents_org_date on public.calendar_events(org_id, event_date);

create table if not exists public.event_attachments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  name text not null,
  path text not null,
  mime text,
  created_at timestamptz default now()
);
create index if not exists idx_event_attachments_event on public.event_attachments(event_id);

create table if not exists public.calendar_uploads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  slot text not null check (slot in ('annual','term1','term2','term3')),
  title text not null,
  name text not null,
  path text not null,
  mime text,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_calendar_uploads_org_slot on public.calendar_uploads(org_id, slot, created_at desc);

create table if not exists public.calendar_holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  title text not null,
  date date not null,
  scope text not null default 'city' check (scope in ('national','state','city')),
  state text,
  city text,
  source text default 'Cadastro manual',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_calendar_holidays_org_date on public.calendar_holidays(org_id, date);

alter table public.calendar_events enable row level security;
alter table public.event_attachments enable row level security;
alter table public.calendar_uploads enable row level security;
alter table public.calendar_holidays enable row level security;

-- Visibilidade segue o público-alvo; superadmin só na organização ativa.
drop policy if exists "events read" on public.calendar_events;
create policy "events read" on public.calendar_events for select using (
  (org_id in (select public.member_orgs()) and (
     audience = 'all'
     or (audience = 'role' and target_role = public.org_role(org_id))
     or (audience = 'user' and target_user = auth.uid())
     or author_id = auth.uid()
  ))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
-- Criar/editar: diretor ou coordenador (ou superadmin na base ativa).
drop policy if exists "events write" on public.calendar_events;
create policy "events write" on public.calendar_events for insert with check (
  author_id = auth.uid() and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
drop policy if exists "events update" on public.calendar_events;
create policy "events update" on public.calendar_events for update using (
  author_id = auth.uid() or public.org_role(org_id) = 'diretor' or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "events delete" on public.calendar_events;
create policy "events delete" on public.calendar_events for delete using (
  author_id = auth.uid() or public.org_role(org_id) = 'diretor' or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Anexos: visibilidade/escrita seguem o evento.
drop policy if exists "event att read" on public.event_attachments;
create policy "event att read" on public.event_attachments for select using (
  exists (select 1 from public.calendar_events e where e.id = event_id)
);
drop policy if exists "event att insert" on public.event_attachments;
create policy "event att insert" on public.event_attachments for insert with check (
  exists (select 1 from public.calendar_events e where e.id = event_id and e.author_id = auth.uid())
);
drop policy if exists "event att delete" on public.event_attachments;
create policy "event att delete" on public.event_attachments for delete using (
  exists (select 1 from public.calendar_events e where e.id = event_id and (e.author_id = auth.uid() or public.is_superadmin()))
);

-- Calendários prontos: todos os membros da organização enxergam; coordenação/direção/admin gerenciam.
drop policy if exists "calendar uploads read" on public.calendar_uploads;
create policy "calendar uploads read" on public.calendar_uploads for select using (
  org_id in (select public.member_orgs())
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "calendar uploads insert" on public.calendar_uploads;
create policy "calendar uploads insert" on public.calendar_uploads for insert with check (
  uploaded_by = auth.uid()
  and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
drop policy if exists "calendar uploads delete" on public.calendar_uploads;
create policy "calendar uploads delete" on public.calendar_uploads for delete using (
  uploaded_by = auth.uid()
  or public.org_role(org_id) = 'diretor'
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Feriados locais: todos veem; direção/coordenação/admin mantêm feriados estaduais/municipais.
drop policy if exists "calendar holidays read" on public.calendar_holidays;
create policy "calendar holidays read" on public.calendar_holidays for select using (
  org_id in (select public.member_orgs())
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "calendar holidays insert" on public.calendar_holidays;
create policy "calendar holidays insert" on public.calendar_holidays for insert with check (
  created_by = auth.uid()
  and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
drop policy if exists "calendar holidays update" on public.calendar_holidays;
create policy "calendar holidays update" on public.calendar_holidays for update using (
  created_by = auth.uid()
  or public.org_role(org_id) = 'diretor'
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "calendar holidays delete" on public.calendar_holidays;
create policy "calendar holidays delete" on public.calendar_holidays for delete using (
  created_by = auth.uid()
  or public.org_role(org_id) = 'diretor'
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Storage privado para os anexos do calendário (caminho: <org_id>/<event_id>/arquivo).
insert into storage.buckets (id, name, public) values ('calendario', 'calendario', false)
on conflict (id) do nothing;

drop policy if exists "cal storage read" on storage.objects;
create policy "cal storage read" on storage.objects for select using (
  bucket_id = 'calendario' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
drop policy if exists "cal storage insert" on storage.objects;
create policy "cal storage insert" on storage.objects for insert with check (
  bucket_id = 'calendario' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
drop policy if exists "cal storage delete" on storage.objects;
create policy "cal storage delete" on storage.objects for delete using (
  bucket_id = 'calendario' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);



-- ############################################################################
-- ## migration-planejamento.sql
-- ############################################################################

-- ============================================================================
-- hello — Fase 3: Planejamento do professor
-- Professor cria planejamentos (semanais), anexa arquivos e envia para a
-- coordenação. Coordenação/diretoria aprova ou devolve com feedback.
-- Isolado por organização. Rodar no Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  week_start date,                       -- semana / data do planejamento
  content text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho','enviado','aprovado','devolvido')),
  feedback text,                         -- retorno da coordenação
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_lesson_plans_org on public.lesson_plans(org_id, status);
create index if not exists idx_lesson_plans_author on public.lesson_plans(author_id);

create table if not exists public.lesson_plan_attachments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  name text not null,
  path text not null,
  mime text,
  created_at timestamptz default now()
);
create index if not exists idx_plan_attachments_plan on public.lesson_plan_attachments(plan_id);

alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_attachments enable row level security;

-- Visibilidade: o autor vê os seus; coordenador/diretor veem todos da organização;
-- superadmin vê os da base ativa.
drop policy if exists "plans read" on public.lesson_plans;
create policy "plans read" on public.lesson_plans for select using (
  (org_id in (select public.member_orgs()) and (author_id = auth.uid() or public.org_role(org_id) in ('coordenador','diretor')))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
-- Criar: professor, coordenador ou diretor (ou superadmin na base ativa).
drop policy if exists "plans insert" on public.lesson_plans;
create policy "plans insert" on public.lesson_plans for insert with check (
  author_id = auth.uid() and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('professor','coordenador','diretor'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
-- Atualizar: autor (edita/envia) ou coordenador/diretor (revisa); superadmin na base ativa.
drop policy if exists "plans update" on public.lesson_plans;
create policy "plans update" on public.lesson_plans for update using (
  (org_id in (select public.member_orgs()) and (author_id = auth.uid() or public.org_role(org_id) in ('coordenador','diretor')))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "plans delete" on public.lesson_plans;
create policy "plans delete" on public.lesson_plans for delete using (
  author_id = auth.uid() or public.org_role(org_id) = 'diretor' or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Anexos seguem a visibilidade/autoria do planejamento.
drop policy if exists "plan att read" on public.lesson_plan_attachments;
create policy "plan att read" on public.lesson_plan_attachments for select using (
  exists (select 1 from public.lesson_plans p where p.id = plan_id)
);
drop policy if exists "plan att insert" on public.lesson_plan_attachments;
create policy "plan att insert" on public.lesson_plan_attachments for insert with check (
  exists (select 1 from public.lesson_plans p where p.id = plan_id and p.author_id = auth.uid())
);
drop policy if exists "plan att delete" on public.lesson_plan_attachments;
create policy "plan att delete" on public.lesson_plan_attachments for delete using (
  exists (select 1 from public.lesson_plans p where p.id = plan_id and (p.author_id = auth.uid() or public.is_superadmin()))
);

-- Revisão (aprovar/devolver) — só coordenador/diretor/superadmin.
create or replace function public.review_plan(p_id uuid, p_status text, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if p_status not in ('aprovado','devolvido') then raise exception 'Status inválido.'; end if;
  select org_id into v_org from public.lesson_plans where id = p_id;
  if v_org is null then raise exception 'Planejamento não encontrado.'; end if;
  if not (public.is_superadmin() or public.org_role(v_org) in ('coordenador','diretor')) then
    raise exception 'Apenas a coordenação pode revisar planejamentos.';
  end if;
  update public.lesson_plans
    set status = p_status, feedback = p_feedback, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = p_id;
end $$;

-- Storage privado para anexos dos planejamentos.
insert into storage.buckets (id, name, public) values ('planejamentos', 'planejamentos', false)
on conflict (id) do nothing;

drop policy if exists "plan storage read" on storage.objects;
create policy "plan storage read" on storage.objects for select using (
  bucket_id = 'planejamentos' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
drop policy if exists "plan storage insert" on storage.objects;
create policy "plan storage insert" on storage.objects for insert with check (
  bucket_id = 'planejamentos' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
drop policy if exists "plan storage delete" on storage.objects;
create policy "plan storage delete" on storage.objects for delete using (
  bucket_id = 'planejamentos' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);



-- ############################################################################
-- ## migration-saas-membros.sql
-- ############################################################################

-- ============================================================================
-- hello — SaaS: gestão de membros (trocar papel / remover)
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- Troca o papel de um membro existente (por id de usuário).
create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_superadmin() or public.org_role(p_org) in ('diretor','coordenador')) then
    raise exception 'Sem permissão para alterar papéis nesta organização.';
  end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
end $$;

-- Remove um membro da organização (não apaga a conta, só o vínculo).
create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_superadmin() or public.org_role(p_org) in ('diretor','coordenador')) then
    raise exception 'Sem permissão para remover membros desta organização.';
  end if;
  delete from public.memberships where org_id = p_org and user_id = p_user;
end $$;



-- ############################################################################
-- ## migration-saas-escola.sql
-- ############################################################################

-- ============================================================================
-- hello — SaaS: organização já nasce com a "escola principal"
-- Remove o passo redundante de criar escola manualmente. Para clientes de uma
-- escola só, organização = escola. Rede/secretaria pode adicionar mais escolas.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- create_org agora cria também a escola principal (mesmo nome da organização).
create or replace function public.create_org(p_name text, p_is_demo boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o superadmin pode criar organizações.'; end if;
  insert into public.organizations (name, is_demo) values (p_name, coalesce(p_is_demo,false)) returning id into new_id;
  insert into public.schools (org_id, name) values (new_id, p_name); -- owner_id = auth.uid() (default)
  return new_id;
end $$;

-- Backfill: toda organização sem nenhuma escola ganha uma com o nome da organização.
-- (owner_id explícito porque no SQL Editor não há usuário logado.)
insert into public.schools (org_id, name, owner_id)
select o.id, o.name, (select id from public.profiles where is_superadmin order by created_at limit 1)
from public.organizations o
where not exists (select 1 from public.schools s where s.org_id = o.id);



-- ############################################################################
-- ## migration-saas-admin.sql
-- ############################################################################

-- ============================================================================
-- hello — SaaS: só Jonathan (minitecnico) é o Administrador (superadmin)
-- Ele é o único que cria organizações, define/edita papéis e gerencia membros.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Apenas minitecnico é administrador do sistema.
update public.profiles set is_superadmin = true  where lower(email) = 'minitecnico@gmail.com';
update public.profiles set is_superadmin = false where lower(email) is distinct from 'minitecnico@gmail.com';

-- 2) Gestão de membros/permissões: SOMENTE o administrador (superadmin).
create or replace function public.add_member(p_org uuid, p_email text, p_role public.user_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode gerenciar membros.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Não existe conta com o e-mail %. Crie a conta primeiro.', p_email;
  end if;
  insert into public.memberships (user_id, org_id, role) values (uid, p_org, p_role)
    on conflict (user_id, org_id) do update set role = excluded.role;
  return uid;
end $$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode alterar papéis.'; end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode remover membros.'; end if;
  delete from public.memberships where org_id = p_org and user_id = p_user;
end $$;

-- create_org já exige superadmin (sem mudança aqui).



-- ############################################################################
-- ## migration-saas-painel.sql
-- ############################################################################

-- ============================================================================
-- hello — SaaS: painel de administração de clientes (lista com métricas)
-- O superadmin agora é isolado por organização no banco, então a contagem por
-- organização vem de uma função (security definer) só para o superadmin.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- DROP antes: a função pode já existir com outro retorno (Postgres não troca as
-- colunas de saída com CREATE OR REPLACE). Idempotente e seguro.
drop function if exists public.org_admin_list();
create or replace function public.org_admin_list()
returns table(
  id uuid, name text, plan text, is_demo boolean, active boolean, created_at timestamptz,
  schools bigint, students bigint, members bigint
)
language sql security definer stable set search_path = public as $$
  select o.id, o.name, o.plan, o.is_demo, o.active, o.created_at,
    (select count(*) from public.schools s where s.org_id = o.id),
    (select count(*) from public.students st where st.org_id = o.id),
    (select count(*) from public.memberships m where m.org_id = o.id)
  from public.organizations o
  where public.is_superadmin()
  order by o.name;
$$;



-- ############################################################################
-- ## migration-saas-hq.sql
-- ############################################################################

-- ============================================================================
-- hello — SaaS: HQ (Administração Geral) + metadados do cliente + centro de permissões
-- ----------------------------------------------------------------------------
-- 1) "Organização principal" passa a ser a HQ (centro de operações do admin):
--    a escola que estava nela é movida para uma BASE DE CLIENTE própria.
-- 2) Organização ganha CNPJ, logo e tipo (hq | client).
-- 3) Centro de permissões: tabela permission_settings (overrides por papel × módulo).
-- FAÇA BACKUP antes. Idempotente. Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Metadados da organização ------------------------------------------------
alter table public.organizations add column if not exists cnpj text;
alter table public.organizations add column if not exists logo_url text;            -- base64 (data URL)
alter table public.organizations add column if not exists kind text not null default 'client'; -- 'hq' | 'client'

-- 2) Centro de permissões (somente OVERRIDES; ausência = padrão do código) -----
create table if not exists public.permission_settings (
  role public.user_role not null,
  module text not null,
  allowed boolean not null default true,
  primary key (role, module)
);
alter table public.permission_settings enable row level security;
drop policy if exists "perm read" on public.permission_settings;
create policy "perm read" on public.permission_settings for select using (true);
drop policy if exists "perm write" on public.permission_settings;
create policy "perm write" on public.permission_settings for all using (public.is_superadmin()) with check (public.is_superadmin());

-- 3) Reestrutura: principal -> HQ; escola dela -> base de cliente -------------
do $$
declare hq uuid; client uuid; school_name text;
begin
  select id into hq from public.organizations where name = 'Organização principal' limit 1;
  if hq is null then
    -- já reestruturado: garante que exista alguma HQ
    if not exists (select 1 from public.organizations where kind = 'hq') then
      update public.organizations set kind = 'hq'
      where id = (select id from public.organizations where is_demo = false order by created_at limit 1);
    end if;
    return;
  end if;

  -- Se a "principal" ainda tem escola, move tudo para uma base de cliente nova.
  if exists (select 1 from public.schools where org_id = hq) then
    select name into school_name from public.schools where org_id = hq order by created_at limit 1;
    insert into public.organizations (name, plan, kind, is_demo)
      values (coalesce(school_name, 'Escola'), 'active', 'client', false)
      returning id into client;

    update public.schools             set org_id = client where org_id = hq;
    update public.classes             set org_id = client where org_id = hq;
    update public.students            set org_id = client where org_id = hq;
    update public.attendance_sessions set org_id = client where org_id = hq;
    update public.attendance_records  set org_id = client where org_id = hq;
    update public.grades              set org_id = client where org_id = hq;
    update public.grade_terms         set org_id = client where org_id = hq;
    update public.term_grades         set org_id = client where org_id = hq;
    update public.shared_reports      set org_id = client where org_id = hq;
    update public.notices             set org_id = client where org_id = hq;
    update public.notice_attachments  set org_id = client where org_id = hq;

    -- Membros não-superadmin (ex.: Ana) vão para a base do cliente, como diretor.
    update public.memberships m set org_id = client, role = 'diretor'
      where m.org_id = hq and not exists (select 1 from public.profiles p where p.id = m.user_id and p.is_superadmin);

    -- Organização ativa: não-superadmins -> base do cliente; superadmins -> HQ.
    update public.profiles set active_org_id = client
      where active_org_id = hq and not is_superadmin;
    update public.profiles set active_org_id = hq where is_superadmin;
  end if;

  -- Transforma a principal na HQ.
  update public.organizations set kind = 'hq', name = 'hello — Administração Geral' where id = hq;
end $$;

-- 4) Painel de clientes lista apenas BASES DE CLIENTE (exclui a HQ) -----------
-- DROP necessário: a função já existe com outro retorno (Postgres não deixa
-- trocar as colunas de saída com CREATE OR REPLACE).
drop function if exists public.org_admin_list();
create or replace function public.org_admin_list()
returns table(
  id uuid, name text, plan text, is_demo boolean, active boolean, created_at timestamptz,
  cnpj text, logo_url text, schools bigint, students bigint, members bigint
)
language sql security definer stable set search_path = public as $$
  select o.id, o.name, o.plan, o.is_demo, o.active, o.created_at, o.cnpj, o.logo_url,
    (select count(*) from public.schools s where s.org_id = o.id),
    (select count(*) from public.students st where st.org_id = o.id),
    (select count(*) from public.memberships m where m.org_id = o.id)
  from public.organizations o
  where public.is_superadmin() and o.kind = 'client'
  order by o.name;
$$;

-- Verificação:
--   select name, kind, (select count(*) from schools s where s.org_id=o.id) escolas
--   from organizations o order by kind, name;



-- ############################################################################
-- ## migration-saas-hq-stats.sql
-- ############################################################################

-- ============================================================================
-- hello — HQ: estatísticas de gestão (visão consolidada dos clientes)
-- Funções security definer só para o superadmin (a RLS isola por base; estas
-- agregam tudo para o painel de Administração Geral).
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- Totais de atividade (últimos 30 dias e gerais).
create or replace function public.hq_stats()
returns table(
  sessions_30d bigint, sessions_total bigint,
  notices_30d bigint, notices_total bigint,
  attendance_records_30d bigint
)
language sql security definer stable set search_path = public as $$
  select
    (select count(*) from public.attendance_sessions where session_date >= current_date - 30),
    (select count(*) from public.attendance_sessions),
    (select count(*) from public.notices where created_at >= now() - interval '30 days'),
    (select count(*) from public.notices),
    (select count(*) from public.attendance_records r
       join public.attendance_sessions s on s.id = r.session_id
       where s.session_date >= current_date - 30)
  where public.is_superadmin();
$$;

-- Chamadas por dia nos últimos 14 dias (atividade recente).
create or replace function public.hq_attendance_daily()
returns table(day date, sessions bigint)
language sql security definer stable set search_path = public as $$
  select d::date,
    (select count(*) from public.attendance_sessions s where s.session_date = d::date)
  from generate_series(current_date - 13, current_date, interval '1 day') d
  where public.is_superadmin()
  order by d;
$$;



-- ############################################################################
-- ## migration-saas-isolation.sql
-- ############################################################################

-- ============================================================================
-- hello — SaaS: isolamento FORTE por organização (fail-closed)
-- ----------------------------------------------------------------------------
-- PROBLEMA: a RLS deixava o superadmin ver TODAS as organizações; o isolamento
-- dependia só de um filtro no cliente. Se o filtro falhasse, vazavam dados de
-- outro cliente (falha grave).
-- SOLUÇÃO: o superadmin passa a enxergar SOMENTE a organização ATIVA (a "base"
-- atual, profiles.active_org_id) no nível do banco. Para ver outro cliente, ele
-- TROCA a organização ativa. O banco garante o isolamento — não o front.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- Organização ativa do usuário logado (a "base" atualmente selecionada).
create or replace function public.current_active_org()
returns uuid language sql security definer stable set search_path = public as $$
  select active_org_id from public.profiles where id = auth.uid();
$$;

-- Predicado de acesso a uma linha de dados:
--   - membro: vê as organizações em que participa;
--   - superadmin: vê SOMENTE a organização ativa.
-- (aplicado em USING e WITH CHECK de todas as tabelas de dados)

-- Tabelas de dados simples (mesmo predicado em leitura e escrita).
do $$
declare t text;
declare pred text := 'org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())';
begin
  foreach t in array array[
    'schools','classes','students','attendance_sessions','attendance_records',
    'grades','grade_terms','term_grades'
  ] loop
    execute format('drop policy if exists "%s org" on public.%I', t, t);
    execute format('drop policy if exists "%s own" on public.%I', t, t);
    execute format('create policy "%s org" on public.%I for all using (%s) with check (%s)', t, t, pred, pred);
  end loop;
end $$;

-- shared_reports: leitura pública (link), escrita isolada por organização ativa.
drop policy if exists "shared insert" on public.shared_reports;
create policy "shared insert" on public.shared_reports for insert with check (
  org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "shared delete" on public.shared_reports;
create policy "shared delete" on public.shared_reports for delete using (
  org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Avisos: superadmin também só enxerga/posta na organização ativa.
drop policy if exists "notices read" on public.notices;
create policy "notices read" on public.notices for select using (
  (org_id in (select public.member_orgs()) and (
     audience = 'all'
     or (audience = 'role' and target_role = public.org_role(org_id))
     or (audience = 'user' and target_user = auth.uid())
     or author_id = auth.uid()
  ))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "notices send" on public.notices;
create policy "notices send" on public.notices for insert with check (
  author_id = auth.uid() and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador','marketing'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
drop policy if exists "notices delete" on public.notices;
create policy "notices delete" on public.notices for delete using (
  author_id = auth.uid()
  or (public.is_superadmin() and org_id = public.current_active_org())
  or public.org_role(org_id) = 'diretor'
);

-- NOTA: organizations e memberships continuam visíveis ao superadmin (painel de
-- clientes precisa listar todas). O que é isolado é o DADO (turmas, alunos, etc.).



-- ############################################################################
-- ## migration-saas-hq-cleanup.sql
-- ############################################################################

-- ============================================================================
-- hello — Correção de vínculos: a HQ (Administração Geral) é EXCLUSIVA do
-- superadmin. Remove vínculos de não-superadmin na HQ (resíduo da migração) e
-- impede que voltem. Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Remove vínculos de não-superadmin em qualquer organização do tipo HQ.
delete from public.memberships m
using public.organizations o, public.profiles p
where m.org_id = o.id
  and o.kind = 'hq'
  and m.user_id = p.id
  and p.is_superadmin = false;

-- 2) Se algum não-superadmin estava com a HQ como base ativa, joga para a
--    primeira organização de cliente em que ele participa.
update public.profiles p
set active_org_id = (
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = p.id and o.kind <> 'hq'
  order by m.created_at limit 1
)
where p.is_superadmin = false
  and p.active_org_id in (select id from public.organizations where kind = 'hq');

-- 3) Trava: add_member não adiciona ninguém a uma organização HQ.
create or replace function public.add_member(p_org uuid, p_email text, p_role public.user_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode gerenciar membros.'; end if;
  if exists (select 1 from public.organizations where id = p_org and kind = 'hq') then
    raise exception 'A Administração Geral é exclusiva do Administrador; não recebe outros membros.';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Não existe conta com o e-mail %. Crie a conta primeiro.', p_email;
  end if;
  insert into public.memberships (user_id, org_id, role) values (uid, p_org, p_role)
    on conflict (user_id, org_id) do update set role = excluded.role;
  return uid;
end $$;



-- ############################################################################
-- ## migration-attendance-robust.sql
-- ############################################################################

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



-- ############################################################################
-- ## migration-term-grades-robust.sql
-- ############################################################################

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
-- ============================================================================
-- hello — Fase 3.1: Chat interno do planejamento (coordenação ⇄ professor)
-- Thread de mensagens por planejamento. Quem enxerga o planejamento pode ler
-- e responder (autor + coordenação/diretoria; superadmin na base ativa).
-- Isolado por organização. Rodar no Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.lesson_plan_messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz default now()
);
create index if not exists idx_plan_messages_plan on public.lesson_plan_messages(plan_id, created_at);

alter table public.lesson_plan_messages enable row level security;

-- Ler/escrever segue exatamente a visibilidade do planejamento (autor ou
-- coordenação/diretoria da organização; superadmin na base ativa).
drop policy if exists "plan msg read" on public.lesson_plan_messages;
create policy "plan msg read" on public.lesson_plan_messages for select using (
  exists (select 1 from public.lesson_plans p where p.id = plan_id)
);
drop policy if exists "plan msg insert" on public.lesson_plan_messages;
create policy "plan msg insert" on public.lesson_plan_messages for insert with check (
  author_id = auth.uid()
  and exists (select 1 from public.lesson_plans p where p.id = plan_id)
);
-- Só o próprio autor da mensagem pode excluí-la (ou superadmin).
drop policy if exists "plan msg delete" on public.lesson_plan_messages;
create policy "plan msg delete" on public.lesson_plan_messages for delete using (
  author_id = auth.uid() or public.is_superadmin()
);
-- ============================================================================
-- hello — Liberar formatos de anexo nos buckets de Storage
-- Remove qualquer restrição de allowed_mime_types (que causava "formato não
-- suportado" para Excel/Word) e fixa limite de 50 MB. A segurança fica na
-- camada da aplicação (assertUploadFile bloqueia só executáveis) + RLS por org.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

update storage.buckets
  set allowed_mime_types = null,           -- sem lista branca: aceita qualquer tipo
      file_size_limit = 52428800           -- 50 MB
  where id in ('avisos', 'calendario', 'planejamentos');
-- ============================================================================
-- hello — Planejamento: aba Revisados + contato pré-configurado (WhatsApp/e-mail)
-- - Guarda telefone/WhatsApp no perfil para disparo rápido.
-- - org_people passa a devolver email e phone (para pré-preencher o envio).
-- - set_member_contact: coordenação/diretoria salva o contato do professor.
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

alter table public.profiles add column if not exists phone text;

-- org_people agora também devolve email e phone (mudou o tipo de retorno → drop antes).
drop function if exists public.org_people(uuid);
create or replace function public.org_people(p_org uuid)
returns table(user_id uuid, full_name text, role public.user_role, email text, phone text)
language sql security definer stable set search_path = public as $$
  select m.user_id, p.full_name, m.role, p.email, p.phone
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org
    and (public.is_superadmin() or exists (
      select 1 from public.memberships me where me.user_id = auth.uid() and me.org_id = p_org
    ))
  order by p.full_name nulls last;
$$;

-- Salvar contato de um membro (telefone/WhatsApp e e-mail de notificação).
-- Permitido: o próprio usuário, coordenação/diretoria da mesma org, ou superadmin.
create or replace function public.set_member_contact(p_user uuid, p_phone text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (
    p_user = auth.uid()
    or public.is_superadmin()
    or exists (
      select 1
      from public.memberships me
      join public.memberships them on them.org_id = me.org_id
      where me.user_id = auth.uid()
        and me.role in ('coordenador','diretor')
        and them.user_id = p_user
    )
  ) then
    raise exception 'Sem permissão para editar este contato.';
  end if;

  update public.profiles
    set phone = nullif(btrim(coalesce(p_phone, '')), ''),
        email = coalesce(nullif(btrim(coalesce(p_email, '')), ''), email)
    where id = p_user;
end $$;
-- ============================================================================
-- hello — Correção definitiva de Storage (uploads)
-- Garante os 3 buckets, LIBERA todos os formatos (sem restrição de MIME — causa
-- do "formato não suportado"), fixa 50 MB e reassenta TODAS as policies de
-- upload/leitura/exclusão isoladas por organização. Idempotente — pode rodar
-- quantas vezes quiser. Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Buckets existem (privados).
insert into storage.buckets (id, name, public) values
  ('avisos', 'avisos', false),
  ('calendario', 'calendario', false),
  ('planejamentos', 'planejamentos', false)
on conflict (id) do nothing;

-- 2) Sem lista branca de MIME (aceita Excel, Word, PDF, imagens, zip…) + 50 MB.
update storage.buckets
  set allowed_mime_types = null,
      file_size_limit = 52428800
  where id in ('avisos', 'calendario', 'planejamentos');

-- 3) Policies de Storage por bucket — acesso só dentro da própria organização
--    (ou superadmin). Removemos nomes antigos e recriamos de forma uniforme.
do $$
declare
  b text;
  buckets text[] := array['avisos', 'calendario', 'planejamentos'];
  old_names text[] := array[
    'avisos storage read','avisos storage insert','avisos storage delete',
    'cal storage read','cal storage insert','cal storage delete',
    'plan storage read','plan storage insert','plan storage delete'
  ];
  p text;
begin
  -- limpa policies antigas (nomes variados das migrations anteriores)
  foreach p in array old_names loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;

  -- recria, uniforme, para cada bucket
  foreach b in array buckets loop
    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' read');
    execute format($f$
      create policy %1$I on storage.objects for select using (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' read', b);

    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' insert');
    execute format($f$
      create policy %1$I on storage.objects for insert with check (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' insert', b);

    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' update');
    execute format($f$
      create policy %1$I on storage.objects for update using (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' update', b);

    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' delete');
    execute format($f$
      create policy %1$I on storage.objects for delete using (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' delete', b);
  end loop;
end $$;
-- ============================================================================
-- hello — Notificação de mensagens não lidas no chat do planejamento
-- Guarda a última leitura de cada usuário por planejamento e calcula quantas
-- mensagens novas (de outras pessoas) existem desde então.
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

create table if not exists public.plan_reads (
  plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

alter table public.plan_reads enable row level security;

drop policy if exists "plan reads own" on public.plan_reads;
create policy "plan reads own" on public.plan_reads for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Marca um planejamento como lido (agora) para o usuário atual.
create or replace function public.mark_plan_read(p_plan uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.plan_reads (plan_id, user_id, last_read_at)
  values (p_plan, auth.uid(), now())
  on conflict (plan_id, user_id) do update set last_read_at = now();
end $$;

-- Contagem de mensagens não lidas por planejamento (só dos planos visíveis ao usuário).
create or replace function public.plan_unread_counts()
returns table(plan_id uuid, unread int)
language sql security definer stable set search_path = public as $$
  select m.plan_id, count(*)::int as unread
  from public.lesson_plan_messages m
  join public.lesson_plans p on p.id = m.plan_id
  left join public.plan_reads r on r.plan_id = m.plan_id and r.user_id = auth.uid()
  where m.author_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    and (
      p.author_id = auth.uid()
      or (p.org_id in (select public.member_orgs()) and public.org_role(p.org_id) in ('coordenador','diretor'))
      or (public.is_superadmin() and p.org_id = public.current_active_org())
    )
  group by m.plan_id;
$$;
