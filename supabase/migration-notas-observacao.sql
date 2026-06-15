-- ============================================================================
-- hello — Notas: campo de observações por aluno/trimestre
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

alter table public.term_grades add column if not exists observacao text;
