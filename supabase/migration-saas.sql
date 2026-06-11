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
