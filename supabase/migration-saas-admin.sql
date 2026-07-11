-- ============================================================================
-- hello — SaaS: só Jonathan (minitecnico) é o Administrador (superadmin)
-- Ele é o único que cria organizações, define/edita papéis e gerencia membros.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Apenas minitecnico é administrador do sistema.
update public.profiles set is_superadmin = true  where lower(email) = 'minitecnico@gmail.com';
update public.profiles set is_superadmin = false where lower(email) is distinct from 'minitecnico@gmail.com';

-- 2) Gestão de membros/permissões: SOMENTE o administrador (superadmin).
create or replace function public.add_member(p_org uuid, p_email text, p_role public.user_role)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode gerenciar membros.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'Não existe conta com o e-mail %. Crie a conta primeiro.', p_email;
  end if;
  insert into public.memberships (user_id, org_id, role) values (uid, p_org, p_role)
    on conflict (user_id, org_id) do update set role = excluded.role;
  return uid;
end $$;

create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode alterar papéis.'; end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
end $$;

create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then raise exception 'Apenas o Administrador pode remover membros.'; end if;
  delete from public.memberships where org_id = p_org and user_id = p_user;
end $$;

-- create_org já exige superadmin (sem mudança aqui).
