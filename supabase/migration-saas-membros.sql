-- ============================================================================
-- hello — SaaS: gestão de membros (trocar papel / remover)
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- Troca o papel de um membro existente (por id de usuário).
create or replace function public.set_member_role(p_org uuid, p_user uuid, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_superadmin() or public.org_role(p_org) in ('diretor','coordenador')) then
    raise exception 'Sem permissão para alterar papéis nesta organização.';
  end if;
  update public.memberships set role = p_role where org_id = p_org and user_id = p_user;
end $$;

-- Remove um membro da organização (não apaga a conta, só o vínculo).
create or replace function public.remove_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_superadmin() or public.org_role(p_org) in ('diretor','coordenador')) then
    raise exception 'Sem permissão para remover membros desta organização.';
  end if;
  delete from public.memberships where org_id = p_org and user_id = p_user;
end $$;
