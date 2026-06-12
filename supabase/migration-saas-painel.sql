-- ============================================================================
-- hello — SaaS: painel de administração de clientes (lista com métricas)
-- O superadmin agora é isolado por organização no banco, então a contagem por
-- organização vem de uma função (security definer) só para o superadmin.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

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
