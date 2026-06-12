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
