-- ============================================================================
-- hello — Planejamento semanal estruturado.
-- Guarda o modelo semanal (grade dias × turmas, materiais, prazer de casa) como
-- JSON no próprio planejamento, sem quebrar os planos de texto livre existentes.
-- Rodar no SQL Editor.
-- ============================================================================

alter table public.lesson_plans add column if not exists plan_data jsonb;
