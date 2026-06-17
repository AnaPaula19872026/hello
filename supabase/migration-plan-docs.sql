-- ============================================================================
-- hello — Central de documentos de planejamento.
-- Professores anexam arquivos (Word/Excel/PDF/imagens…) organizados por
-- SEGMENTO (Fundamental I/II…), TRIMESTRE e TURMA. Aprovação da coordenação é
-- opcional (a definir). Usa o bucket 'planejamentos' já existente.
-- Rodar no SQL Editor.
-- ============================================================================

create table if not exists public.plan_docs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  segment text not null,                                   -- 'fund1' | 'fund2' | ...
  term int check (term between 1 and 3),                   -- trimestre (nullable = geral)
  class_id uuid references public.classes(id) on delete set null,  -- turma (nullable = todas)
  turma_label text,                                        -- nome da turma (denormalizado)
  name text not null,
  path text not null,
  mime text,
  created_at timestamptz not null default now()
);
create index if not exists idx_plan_docs_org on public.plan_docs(org_id, segment, created_at desc);

alter table public.plan_docs enable row level security;

-- Leitura: qualquer membro da organização — e superadmin na base ativa.
drop policy if exists "plan docs read" on public.plan_docs;
create policy "plan docs read" on public.plan_docs for select using (
  org_id in (select public.member_orgs())
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Criar: professor/coordenação/direção (o próprio autor).
drop policy if exists "plan docs insert" on public.plan_docs;
create policy "plan docs insert" on public.plan_docs for insert with check (
  author_id = auth.uid()
  and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('professor','coordenador','diretor'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);

-- Editar: autor OU coordenação/direção.
drop policy if exists "plan docs update" on public.plan_docs;
create policy "plan docs update" on public.plan_docs for update using (
  (org_id in (select public.member_orgs()) and (author_id = auth.uid() or public.org_role(org_id) in ('coordenador','diretor')))
  or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Excluir: autor OU coordenação/direção.
drop policy if exists "plan docs delete" on public.plan_docs;
create policy "plan docs delete" on public.plan_docs for delete using (
  (org_id in (select public.member_orgs()) and (author_id = auth.uid() or public.org_role(org_id) in ('coordenador','diretor')))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
