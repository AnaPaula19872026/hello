-- ============================================================================
-- hello — Fase 3: Planejamento do professor
-- Professor cria planejamentos (semanais), anexa arquivos e envia para a
-- coordenação. Coordenação/diretoria aprova ou devolve com feedback.
-- Isolado por organização. Rodar no Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  title text not null,
  week_start date,                       -- semana / data do planejamento
  content text not null default '',
  status text not null default 'rascunho' check (status in ('rascunho','enviado','aprovado','devolvido')),
  feedback text,                         -- retorno da coordenação
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_lesson_plans_org on public.lesson_plans(org_id, status);
create index if not exists idx_lesson_plans_author on public.lesson_plans(author_id);

create table if not exists public.lesson_plan_attachments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.lesson_plans(id) on delete cascade,
  org_id uuid not null default public.default_org() references public.organizations(id) on delete cascade,
  name text not null,
  path text not null,
  mime text,
  created_at timestamptz default now()
);
create index if not exists idx_plan_attachments_plan on public.lesson_plan_attachments(plan_id);

alter table public.lesson_plans enable row level security;
alter table public.lesson_plan_attachments enable row level security;

-- Visibilidade: o autor vê os seus; coordenador/diretor veem todos da organização;
-- superadmin vê os da base ativa.
drop policy if exists "plans read" on public.lesson_plans;
create policy "plans read" on public.lesson_plans for select using (
  (org_id in (select public.member_orgs()) and (author_id = auth.uid() or public.org_role(org_id) in ('coordenador','diretor')))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
-- Criar: professor, coordenador ou diretor (ou superadmin na base ativa).
drop policy if exists "plans insert" on public.lesson_plans;
create policy "plans insert" on public.lesson_plans for insert with check (
  author_id = auth.uid() and (
    (org_id in (select public.member_orgs()) and public.org_role(org_id) in ('professor','coordenador','diretor'))
    or (public.is_superadmin() and org_id = public.current_active_org())
  )
);
-- Atualizar: autor (edita/envia) ou coordenador/diretor (revisa); superadmin na base ativa.
drop policy if exists "plans update" on public.lesson_plans;
create policy "plans update" on public.lesson_plans for update using (
  (org_id in (select public.member_orgs()) and (author_id = auth.uid() or public.org_role(org_id) in ('coordenador','diretor')))
  or (public.is_superadmin() and org_id = public.current_active_org())
);
drop policy if exists "plans delete" on public.lesson_plans;
create policy "plans delete" on public.lesson_plans for delete using (
  author_id = auth.uid() or public.org_role(org_id) = 'diretor' or (public.is_superadmin() and org_id = public.current_active_org())
);

-- Anexos seguem a visibilidade/autoria do planejamento.
drop policy if exists "plan att read" on public.lesson_plan_attachments;
create policy "plan att read" on public.lesson_plan_attachments for select using (
  exists (select 1 from public.lesson_plans p where p.id = plan_id)
);
drop policy if exists "plan att insert" on public.lesson_plan_attachments;
create policy "plan att insert" on public.lesson_plan_attachments for insert with check (
  exists (select 1 from public.lesson_plans p where p.id = plan_id and p.author_id = auth.uid())
);
drop policy if exists "plan att delete" on public.lesson_plan_attachments;
create policy "plan att delete" on public.lesson_plan_attachments for delete using (
  exists (select 1 from public.lesson_plans p where p.id = plan_id and (p.author_id = auth.uid() or public.is_superadmin()))
);

-- Revisão (aprovar/devolver) — só coordenador/diretor/superadmin.
create or replace function public.review_plan(p_id uuid, p_status text, p_feedback text)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if p_status not in ('aprovado','devolvido') then raise exception 'Status inválido.'; end if;
  select org_id into v_org from public.lesson_plans where id = p_id;
  if v_org is null then raise exception 'Planejamento não encontrado.'; end if;
  if not (public.is_superadmin() or public.org_role(v_org) in ('coordenador','diretor')) then
    raise exception 'Apenas a coordenação pode revisar planejamentos.';
  end if;
  update public.lesson_plans
    set status = p_status, feedback = p_feedback, reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
    where id = p_id;
end $$;

-- Storage privado para anexos dos planejamentos.
insert into storage.buckets (id, name, public) values ('planejamentos', 'planejamentos', false)
on conflict (id) do nothing;

drop policy if exists "plan storage read" on storage.objects;
create policy "plan storage read" on storage.objects for select using (
  bucket_id = 'planejamentos' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
drop policy if exists "plan storage insert" on storage.objects;
create policy "plan storage insert" on storage.objects for insert with check (
  bucket_id = 'planejamentos' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
drop policy if exists "plan storage delete" on storage.objects;
create policy "plan storage delete" on storage.objects for delete using (
  bucket_id = 'planejamentos' and (public.is_superadmin() or ((storage.foldername(name))[1])::uuid in (select public.member_orgs()))
);
