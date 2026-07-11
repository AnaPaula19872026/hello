-- ============================================================================
-- hello — Turmas: marcar se a turma faz provas
-- Turmas mais novas (ex.: Fund. 1) podem não fazer provas. O Modo prova da
-- chamada passa a oferecer só as turmas que fazem. Rodar no Supabase. Idempotente.
-- ============================================================================

alter table public.classes add column if not exists does_exams boolean not null default true;
