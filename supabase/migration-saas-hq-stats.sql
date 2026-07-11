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
