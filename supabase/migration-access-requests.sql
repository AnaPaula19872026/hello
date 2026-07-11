-- ============================================================================
-- hello — Autocadastro com aprovação do administrador
-- Usuário cria conta, escolhe a escola (organização) e fica PENDENTE. O admin
-- (superadmin, ou diretor/coordenador da escola) aprova definindo o papel — só
-- então o vínculo (membership) é criado e o acesso liberado.
-- Rodar no Supabase → SQL Editor. Idempotente.
-- ============================================================================

create table if not exists public.membership_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  requested_role public.user_role not null default 'professor',
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz default now(),
  unique (user_id, org_id)
);
create index if not exists idx_mreq_org_status on public.membership_requests(org_id, status);
create index if not exists idx_mreq_user on public.membership_requests(user_id);

alter table public.membership_requests enable row level security;

-- Ler: o próprio solicitante, ou admin da organização (superadmin/diretor/coordenador).
drop policy if exists "mreq read" on public.membership_requests;
create policy "mreq read" on public.membership_requests for select using (
  user_id = auth.uid() or public.is_superadmin() or public.org_role(org_id) in ('diretor','coordenador')
);
-- Inserir/editar/excluir o próprio pedido (decisões são via RPC security definer).
drop policy if exists "mreq insert own" on public.membership_requests;
create policy "mreq insert own" on public.membership_requests for insert with check (
  user_id = auth.uid() and status = 'pending'
);
drop policy if exists "mreq update own" on public.membership_requests;
create policy "mreq update own" on public.membership_requests for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "mreq delete own" on public.membership_requests;
create policy "mreq delete own" on public.membership_requests for delete using (
  user_id = auth.uid() or public.is_superadmin()
);

-- Escolas que aceitam novos pedidos (clientes ativos). Visível só a autenticados
-- (não expõe a lista de clientes publicamente).
create or replace function public.list_join_orgs()
returns table(id uuid, name text)
language sql security definer stable set search_path = public as $$
  select id, name from public.organizations
  where active = true and kind = 'client'
  order by name;
$$;
grant execute on function public.list_join_orgs() to authenticated;

-- Solicitar acesso a uma escola (cria/atualiza pedido pendente).
create or replace function public.request_access(p_org uuid, p_role public.user_role, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role public.user_role := coalesce(p_role, 'professor');
begin
  if not exists (select 1 from public.organizations where id = p_org and active = true and kind = 'client') then
    raise exception 'Escola inválida.';
  end if;
  if exists (select 1 from public.memberships where user_id = auth.uid() and org_id = p_org) then
    raise exception 'Você já tem acesso a esta escola.';
  end if;
  if v_role = 'superadmin' then v_role := 'professor'; end if;  -- ninguém se autodeclara admin
  insert into public.membership_requests (user_id, org_id, requested_role, note, status, decided_by, decided_at, created_at)
  values (auth.uid(), p_org, v_role, nullif(btrim(coalesce(p_note,'')),''), 'pending', null, null, now())
  on conflict (user_id, org_id) do update
    set requested_role = excluded.requested_role,
        note = excluded.note,
        status = 'pending',
        decided_by = null,
        decided_at = null,
        created_at = now();
end $$;
grant execute on function public.request_access(uuid, public.user_role, text) to authenticated;

-- Fila de solicitações visíveis ao admin (com nome/e-mail e escola).
create or replace function public.list_access_requests(p_status text default 'pending')
returns table(id uuid, user_id uuid, full_name text, email text, org_id uuid, org_name text,
              requested_role public.user_role, note text, status text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.id, r.user_id, p.full_name, p.email, r.org_id, o.name, r.requested_role, r.note, r.status, r.created_at
  from public.membership_requests r
  join public.organizations o on o.id = r.org_id
  left join public.profiles p on p.id = r.user_id
  where (p_status = 'all' or r.status = p_status)
    and (public.is_superadmin() or public.org_role(r.org_id) in ('diretor','coordenador'))
  order by r.created_at desc;
$$;
grant execute on function public.list_access_requests(text) to authenticated;

-- Decidir um pedido: aprovar (cria/atualiza vínculo com o papel) ou recusar.
create or replace function public.decide_access_request(p_id uuid, p_approve boolean, p_role public.user_role)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_user uuid; v_role public.user_role := coalesce(p_role, 'professor');
begin
  select org_id, user_id into v_org, v_user from public.membership_requests where id = p_id;
  if v_org is null then raise exception 'Solicitação não encontrada.'; end if;
  if not (public.is_superadmin() or public.org_role(v_org) in ('diretor','coordenador')) then
    raise exception 'Sem permissão para decidir esta solicitação.';
  end if;
  if v_role = 'superadmin' then v_role := 'diretor'; end if;  -- superadmin é flag global, não papel de escola
  if p_approve then
    insert into public.memberships (user_id, org_id, role) values (v_user, v_org, v_role)
      on conflict (user_id, org_id) do update set role = excluded.role;
    update public.membership_requests set status='approved', decided_by=auth.uid(), decided_at=now() where id = p_id;
    update public.profiles set active_org_id = coalesce(active_org_id, v_org) where id = v_user;
  else
    update public.membership_requests set status='rejected', decided_by=auth.uid(), decided_at=now() where id = p_id;
  end if;
end $$;
grant execute on function public.decide_access_request(uuid, boolean, public.user_role) to authenticated;
