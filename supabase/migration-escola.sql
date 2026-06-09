-- Migração: campos extras + logo da escola
-- Rode UMA vez no SQL Editor do Supabase. Não apaga dados.

alter table public.schools add column if not exists logo_url text;  -- base64 (data URL) da logo
alter table public.schools add column if not exists director text;
alter table public.schools add column if not exists address text;
alter table public.schools add column if not exists phone text;
alter table public.schools add column if not exists inep text;
