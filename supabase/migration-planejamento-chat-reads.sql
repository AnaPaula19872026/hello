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
