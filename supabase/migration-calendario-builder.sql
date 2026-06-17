-- ============================================================================
-- hello — Construtor de calendário (documento único por organização).
-- A coordenação monta o calendário inteiro (categorias, períodos, eventos,
-- dias letivos, observações) e ele fica disponível para TODOS os usuários da
-- organização. Guardado como um único JSONB por org. Rodar no SQL Editor.
-- Depende das funções já criadas: default_org(), member_orgs(), org_role(),
-- is_superadmin(), current_active_org().
-- ============================================================================

create table if not exists public.calendar_builder (
  org_id uuid primary key default public.default_org() references public.organizations(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,   -- CalendarBuilderData (ver src/lib/types.ts)
  version bigint not null default 0,         -- trava otimista: cada gravação incrementa
  updated_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by_name text,                      -- nome de quem editou por último (denormalizado p/ exibir sem join)
  updated_at timestamptz not null default now()
);

-- Idempotente: garante as colunas novas em bases que criaram a tabela antes.
alter table public.calendar_builder add column if not exists version bigint not null default 0;
alter table public.calendar_builder add column if not exists updated_by_name text;

alter table public.calendar_builder enable row level security;

-- Leitura: qualquer membro da organização (todos os perfis) — e superadmin na base ativa.
drop policy if exists "calendar builder read" on public.calendar_builder;
create policy "calendar builder read" on public.calendar_builder for select using (
  org_id in (select public.member_orgs())
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Criar: apenas diretor/coordenador (ou superadmin na base ativa).
drop policy if exists "calendar builder insert" on public.calendar_builder;
create policy "calendar builder insert" on public.calendar_builder for insert with check (
  (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Atualizar: apenas diretor/coordenador (ou superadmin na base ativa).
drop policy if exists "calendar builder update" on public.calendar_builder;
create policy "calendar builder update" on public.calendar_builder for update using (
  (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
  or (public.is_superadmin() and org_id = public.current_active_org())
) with check (
  (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador'))
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Excluir: diretor (ou superadmin na base ativa).
drop policy if exists "calendar builder delete" on public.calendar_builder;
create policy "calendar builder delete" on public.calendar_builder for delete using (
  public.org_role(org_id) = 'diretor'
  or (public.is_superadmin() and org_id = public.current_active_org())
);
