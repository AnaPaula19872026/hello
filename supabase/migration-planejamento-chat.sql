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
