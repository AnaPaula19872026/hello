-- ============================================================================
-- hello — Correção de vínculos: a HQ (Administração Geral) é EXCLUSIVA do
-- superadmin. Remove vínculos de não-superadmin na HQ (resíduo da migração) e
-- impede que voltem. Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Remove vínculos de não-superadmin em qualquer organização do tipo HQ.
delete from public.memberships m
using public.organizations o, public.profiles p
where m.org_id = o.id
  and o.kind = 'hq'
  and m.user_id = p.id
  and p.is_superadmin = false;

-- 2) Se algum não-superadmin estava com a HQ como base ativa, joga para a
--    primeira organização de cliente em que ele participa.
update public.profiles p
set active_org_id = (
  select m.org_id from public.memberships m
  join public.organizations o on o.id = m.org_id
  where m.user_id = p.id and o.kind <> 'hq'
  order by m.created_at limit 1
)
where p.is_superadmin = false
  and p.active_org_id in (select id from public.organizations where kind = 'hq');

-- 3) Trava: add_member não adiciona ninguém a uma organização HQ.
create or replace function public.add_member(p_org uuid, p_email text, p_role public.user_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode gerenciar membros.'; end if;
  if exists (select 1 from public.organizations where id = p_org and kind = 'hq') then
    raise exception 'A Administração Geral é exclusiva do Administrador; não recebe outros membros.';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Não existe conta com o e-mail %. Crie a conta primeiro.', p_email;
  end if;
  insert into public.memberships (user_id, org_id, role) values (uid, p_org, p_role)
    on conflict (user_id, org_id) do update set role = excluded.role;
  return uid;
end $$;
