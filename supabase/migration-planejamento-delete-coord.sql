-- ============================================================================
-- hello — Planejamento: coordenação também pode excluir/editar planejamentos
-- (antes só autor/diretor/superadmin podiam excluir). Rodar no Supabase. Idempotente.
-- ============================================================================

drop policy if exists "plans delete" on public.lesson_plans;
create policy "plans delete" on public.lesson_plans for delete using (
  author_id = auth.uid()
  or public.org_role(org_id) in ('coordenador','diretor')
  or (public.is_superadmin() and org_id = public.current_active_org())
);
