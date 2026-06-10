-- Migração: relatórios compartilháveis por link
-- Rode UMA vez no SQL Editor. Não apaga dados.

create table if not exists public.shared_reports (
  id text primary key,                 -- id curto usado no link /r/<id>
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payload jsonb not null,              -- relatório pronto para renderizar
  created_at timestamptz default now()
);

alter table public.shared_reports enable row level security;

-- Qualquer pessoa com o link pode LER (relatório público por link)
drop policy if exists "shared read" on public.shared_reports;
create policy "shared read" on public.shared_reports for select using (true);

-- Só o dono autenticado cria/remove
drop policy if exists "shared insert" on public.shared_reports;
create policy "shared insert" on public.shared_reports for insert with check (owner_id = auth.uid());

drop policy if exists "shared delete" on public.shared_reports;
create policy "shared delete" on public.shared_reports for delete using (owner_id = auth.uid());
