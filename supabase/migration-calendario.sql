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

alter table public.calendar_events enable row level security;
alter table public.event_attachments enable row level security;

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
