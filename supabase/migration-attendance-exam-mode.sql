-- ============================================================================
-- hello — Chamada: sinalizar sessões feitas em "Modo prova" (turmas misturadas)
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

alter table public.attendance_sessions add column if not exists exam_mode boolean not null default false;
