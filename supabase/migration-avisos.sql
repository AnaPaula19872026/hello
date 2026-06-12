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
