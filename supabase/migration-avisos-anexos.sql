-- ============================================================================
-- hello — Avisos: anexos (PDF, DOC/DOCX, PNG, JPG, PPTX, etc.)
-- Arquivos vão para o Storage (bucket privado 'avisos'), isolados por organização.
-- Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Bucket privado para os anexos.
insert into storage.buckets (id, name, public)
values ('avisos', 'avisos', false)
on conflict (id) do nothing;

-- 2) Políticas do Storage: o caminho é "<org_id>/<notice_id>/<arquivo>".
--    Membro da organização (1ª pasta = org_id) pode ler/enviar/excluir.
drop policy if exists "avisos storage read" on storage.objects;
create policy "avisos storage read" on storage.objects for select using (
  bucket_id = 'avisos' and (
    public.is_superadmin()
    or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())
  )
);
drop policy if exists "avisos storage insert" on storage.objects;
create policy "avisos storage insert" on storage.objects for insert with check (
  bucket_id = 'avisos' and (
    public.is_superadmin()
    or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())
  )
);
drop policy if exists "avisos storage delete" on storage.objects;
create policy "avisos storage delete" on storage.objects for delete using (
  bucket_id = 'avisos' and (
    public.is_superadmin()
    or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())
  )
);

-- 3) Metadados dos anexos (nome original, caminho no Storage, tipo).
create table if not exists public.notice_attachments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.notices(id) on delete cascade,
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  name text not null,
  path text not null,
  mime text,
  created_at timestamptz default now()
);
create index if not exists idx_notice_attachments_notice on public.notice_attachments(notice_id);

alter table public.notice_attachments enable row level security;

-- Visibilidade do anexo segue a visibilidade do aviso (RLS de notices vale na subconsulta).
drop policy if exists "att read" on public.notice_attachments;
create policy "att read" on public.notice_attachments for select using (
  exists (select 1 from public.notices n where n.id = notice_id)
);
drop policy if exists "att insert" on public.notice_attachments;
create policy "att insert" on public.notice_attachments for insert with check (
  exists (select 1 from public.notices n where n.id = notice_id and n.author_id = auth.uid())
);
drop policy if exists "att delete" on public.notice_attachments;
create policy "att delete" on public.notice_attachments for delete using (
  exists (select 1 from public.notices n where n.id = notice_id and (n.author_id = auth.uid() or public.is_superadmin()))
);
