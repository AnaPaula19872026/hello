-- Migração: administradores master + dados compartilhados
-- Rode UMA vez no SQL Editor do Supabase. Não apaga dados.

-- 1. Coluna de papel no perfil
alter table public.profiles add column if not exists role text not null default 'user';

-- 2. Função: verdadeiro se o usuário logado for master (ignora RLS de profiles)
create or replace function public.is_master()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'master');
$$;

-- 3. Garante um perfil para todos os usuários já cadastrados (caso falte)
insert into public.profiles (id, full_name, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email),
       u.email
from auth.users u
on conflict (id) do nothing;

-- 4. Apenas minitecnico é Administrador (master) do sistema.
update public.profiles set role = 'master' where lower(email) = 'minitecnico@gmail.com';
-- Rebaixa qualquer outro master legado (ex.: Ana) para usuário comum.
update public.profiles set role = 'user'
where role = 'master' and lower(email) is distinct from 'minitecnico@gmail.com';

-- 5. Recria as políticas: master vê/edita tudo; demais, só o próprio
drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles
  for select using (id = auth.uid() or public.is_master());
drop policy if exists "profiles update self" on public.profiles;
create policy "profiles update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "schools own" on public.schools;
create policy "schools own" on public.schools
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "classes own" on public.classes;
create policy "classes own" on public.classes
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "students own" on public.students;
create policy "students own" on public.students
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "sessions own" on public.attendance_sessions;
create policy "sessions own" on public.attendance_sessions
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "records own" on public.attendance_records;
create policy "records own" on public.attendance_records
  for all using (owner_id = auth.uid() or public.is_master())
  with check (owner_id = auth.uid() or public.is_master());

-- Confere
select email, role from public.profiles order by role desc;
