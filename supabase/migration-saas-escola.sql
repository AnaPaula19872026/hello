-- ============================================================================
-- hello — SaaS: organização já nasce com a "escola principal"
-- Remove o passo redundante de criar escola manualmente. Para clientes de uma
-- escola só, organização = escola. Rede/secretaria pode adicionar mais escolas.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- create_org agora cria também a escola principal (mesmo nome da organização).
create or replace function public.create_org(p_name text, p_is_demo boolean default false)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o superadmin pode criar organizações.'; end if;
  insert into public.organizations (name, is_demo) values (p_name, coalesce(p_is_demo,false)) returning id into new_id;
  insert into public.schools (org_id, name) values (new_id, p_name); -- owner_id = auth.uid() (default)
  return new_id;
end $$;

-- Backfill: toda organização sem nenhuma escola ganha uma com o nome da organização.
-- (owner_id explícito porque no SQL Editor não há usuário logado.)
insert into public.schools (org_id, name, owner_id)
select o.id, o.name, (select id from public.profiles where is_superadmin order by created_at limit 1)
from public.organizations o
where not exists (select 1 from public.schools s where s.org_id = o.id);
