-- ============================================================================
-- hello — Excluir organizações (cliente). SOMENTE o administrador (superadmin).
-- A organização principal (HQ — Administração Geral) NUNCA pode ser excluída.
-- Apaga em cascata todos os dados do cliente (escolas, turmas, alunos, notas,
-- avisos, planejamentos…) via FKs on delete cascade. Rodar no Supabase. Idempotente.
-- ============================================================================

create or replace function public.delete_org(p_org uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_superadmin() then
    raise exception 'Apenas o administrador pode excluir organizações.';
  end if;
  if exists (select 1 from public.organizations where id = p_org and kind = 'hq') then
    raise exception 'A organização principal (Administração Geral) não pode ser excluída.';
  end if;
  delete from public.organizations where id = p_org;
end $$;
grant execute on function public.delete_org(uuid) to authenticated;
