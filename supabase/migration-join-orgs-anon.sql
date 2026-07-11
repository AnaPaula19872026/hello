-- ============================================================================
-- hello — Permite listar escolas (clientes ativos) na TELA DE CADASTRO,
-- antes do login, para o usuário escolher sua organização ao se cadastrar.
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

grant execute on function public.list_join_orgs() to anon;
