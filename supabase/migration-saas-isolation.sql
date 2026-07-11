-- ============================================================================
-- hello — SaaS: isolamento FORTE por organização (fail-closed)
-- ----------------------------------------------------------------------------
-- PROBLEMA: a RLS deixava o superadmin ver TODAS as organizações; o isolamento
-- dependia só de um filtro no cliente. Se o filtro falhasse, vazavam dados de
-- outro cliente (falha grave).
-- SOLUÇÃO: o superadmin passa a enxergar SOMENTE a organização ATIVA (a "base"
-- atual, profiles.active_org_id) no nível do banco. Para ver outro cliente, ele
-- TROCA a organização ativa. O banco garante o isolamento — não o front.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- Organização ativa do usuário logado (a "base" atualmente selecionada).
create or replace function public.current_active_org()
returns uuid language sql security definer stable set search_path = public as $$
  select active_org_id from public.profiles where id = auth.uid();
$$;

-- Predicado de acesso a uma linha de dados:
--   - membro: vê as organizações em que participa;
--   - superadmin: vê SOMENTE a organização ativa.
-- (aplicado em USING e WITH CHECK de todas as tabelas de dados)

-- Tabelas de dados simples (mesmo predicado em leitura e escrita).
do $$
declare t text;
declare pred text := 'org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())';
begin
  foreach t in array array[
    'schools','classes','students','attendance_sessions','attendance_records',
    'grades','grade_terms','term_grades'
  ] loop
    execute format('drop policy if exists "%s org" on public.%I', t, t);
    execute format('drop policy if exists "%s own" on public.%I', t, t);
    execute format('create policy "%s org" on public.%I for all using (%s) with check (%s)', t, t, pred, pred);
  end loop;
end $$;

-- shared_reports: leitura pública (link), escrita isolada por organização ativa.
drop policy if exists "shared insert" on public.shared_reports;
create policy "shared insert" on public.shared_reports for insert with check (
  org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "shared delete" on public.shared_reports;
create policy "shared delete" on public.shared_reports for delete using (
  org_id in (select public.member_orgs()) or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Avisos: superadmin também só enxerga/posta na organização ativa.
drop policy if exists "notices read" on public.notices;
create policy "notices read" on public.notices for select using (
  (org_id in (select public.member_orgs()) and (
     audience = 'all'
     or (audience = 'role' and target_role = public.org_role(org_id))
     or (audience = 'user' and target_user = auth.uid())
     or author_id = auth.uid()
  ))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "notices send" on public.notices;
create policy "notices send" on public.notices for insert with check (
  author_id = auth.uid() and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('diretor','coordenador','marketing'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
drop policy if exists "notices delete" on public.notices;
create policy "notices delete" on public.notices for delete using (
  author_id = auth.uid()
  or (public.is_superadmin() and org_id = public.current_active_org())
  or public.org_role(org_id) = 'diretor'
);

-- NOTA: organizations e memberships continuam visíveis ao superadmin (painel de
-- clientes precisa listar todas). O que é isolado é o DADO (turmas, alunos, etc.).
