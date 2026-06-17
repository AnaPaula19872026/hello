-- ============================================================================
-- hello — Centro de calendários (vários calendários por organização).
-- Evolui o modelo de 1 calendário por org (calendar_builder) para N calendários,
-- cada um com criador, lista de editores (participantes) e trava otimista.
-- Migra o calendário existente. Rodar no SQL Editor.
-- Depende de: default_org(), member_orgs(), org_role(), is_superadmin(),
-- current_active_org().
-- ============================================================================

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  title text not null default 'Calendário',
  data jsonb not null default '{}'::jsonb,         -- CalendarBuilderData (ver src/lib/types.ts)
  editors uuid[] not null default '{}',            -- usuários extras com permissão de editar
  version bigint not null default 0,               -- trava otimista
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_by_name text,
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_calendars_org on public.calendars(org_id, created_at desc);

-- Migra o calendário único existente (calendar_builder) para a nova tabela, uma vez.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'calendar_builder') then
    insert into public.calendars (org_id, title, data, version, created_by, created_by_name, updated_by, updated_by_name, updated_at)
    select b.org_id,
           coalesce(nullif(b.data->>'title', ''), 'Calendário'),
           b.data, coalesce(b.version, 0),
           b.updated_by, b.updated_by_name, b.updated_by, b.updated_by_name, b.updated_at
    from public.calendar_builder b
    where (b.data ? 'school')                                   -- só linhas com conteúdo real
      and not exists (select 1 from public.calendars c where c.org_id = b.org_id);  -- não duplica em re-run
  end if;
end $$;

alter table public.calendars enable row level security;

-- Leitura: qualquer membro da organização — e superadmin na base ativa.
drop policy if exists "calendars read" on public.calendars;
create policy "calendars read" on public.calendars for select using (
  org_id in (select public.member_orgs())
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Criar: diretor/coordenador (ou superadmin na base ativa).
drop policy if exists "calendars insert" on public.calendars;
create policy "calendars insert" on public.calendars for insert with check (
  (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Atualizar: criador, OU coordenação/direção, OU quem está na lista de editores, OU superadmin.
drop policy if exists "calendars update" on public.calendars;
create policy "calendars update" on public.calendars for update using (
  (org_id in (select public.member_orgs()) and (
     created_by = auth.uid()
     or public.org_role(org_id) in ('diretor','coordenador')
     or auth.uid() = any(editors)
  ))
  or (public.is_superadmin() and org_id = public.current_active_org())
) with check (
  (org_id in (select public.member_orgs()) and (
     created_by = auth.uid()
     or public.org_role(org_id) in ('diretor','coordenador')
     or auth.uid() = any(editors)
  ))
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Excluir: criador OU diretor (ou superadmin na base ativa).
drop policy if exists "calendars delete" on public.calendars;
create policy "calendars delete" on public.calendars for delete using (
  (org_id in (select public.member_orgs()) and (created_by = auth.uid() or public.org_role(org_id) = 'diretor'))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
