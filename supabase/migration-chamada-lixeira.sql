-- ============================================================================
-- hello — Lixeira de chamadas (exclusão recuperável / soft-delete)
-- Excluir uma chamada passa a marcar deleted_at em vez de apagar. Fica na
-- lixeira até ser restaurada ou excluída definitivamente. Rodar no Supabase.
-- Idempotente.
-- ============================================================================

alter table public.attendance_sessions add column if not exists deleted_at timestamptz;
create index if not exists idx_att_sessions_deleted on public.attendance_sessions(deleted_at);
