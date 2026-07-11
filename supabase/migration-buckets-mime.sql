-- ============================================================================
-- hello — Liberar formatos de anexo nos buckets de Storage
-- Remove qualquer restrição de allowed_mime_types (que causava "formato não
-- suportado" para Excel/Word) e fixa limite de 50 MB. A segurança fica na
-- camada da aplicação (assertUploadFile bloqueia só executáveis) + RLS por org.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

update storage.buckets
  set allowed_mime_types = null,           -- sem lista branca: aceita qualquer tipo
      file_size_limit = 52428800           -- 50 MB
  where id in ('avisos', 'calendario', 'planejamentos');
