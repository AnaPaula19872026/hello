-- ============================================================================
-- hello — Planejamento: aba Revisados + contato pré-configurado (WhatsApp/e-mail)
-- - Guarda telefone/WhatsApp no perfil para disparo rápido.
-- - org_people passa a devolver email e phone (para pré-preencher o envio).
-- - set_member_contact: coordenação/diretoria salva o contato do professor.
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

alter table public.profiles add column if not exists phone text;

-- org_people agora também devolve email e phone (mudou o tipo de retorno → drop antes).
drop function if exists public.org_people(uuid);
create or replace function public.org_people(p_org uuid)
returns table(user_id uuid, full_name text, role public.user_role, email text, phone text)
language sql security definer stable set search_path = public as $$
  select m.user_id, p.full_name, m.role, p.email, p.phone
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.org_id = p_org
    and (public.is_superadmin() or exists (
      select 1 from public.memberships me where me.user_id = auth.uid() and me.org_id = p_org
    ))
  order by p.full_name nulls last;
$$;

-- Salvar contato de um membro (telefone/WhatsApp e e-mail de notificação).
-- Permitido: o próprio usuário, coordenação/diretoria da mesma org, ou superadmin.
create or replace function public.set_member_contact(p_user uuid, p_phone text, p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (
    p_user = auth.uid()
    or public.is_superadmin()
    or exists (
      select 1
      from public.memberships me
      join public.memberships them on them.org_id = me.org_id
      where me.user_id = auth.uid()
        and me.role in ('coordenador','diretor')
        and them.user_id = p_user
    )
  ) then
    raise exception 'Sem permissão para editar este contato.';
  end if;

  update public.profiles
    set phone = nullif(btrim(coalesce(p_phone, '')), ''),
        email = coalesce(nullif(btrim(coalesce(p_email, '')), ''), email)
    where id = p_user;
end $$;
