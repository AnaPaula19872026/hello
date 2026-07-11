-- ============================================================================
-- hello — Correção definitiva de Storage (uploads)
-- Garante os 3 buckets, LIBERA todos os formatos (sem restrição de MIME — causa
-- do "formato não suportado"), fixa 50 MB e reassenta TODAS as policies de
-- upload/leitura/exclusão isoladas por organização. Idempotente — pode rodar
-- quantas vezes quiser. Rodar no Supabase → SQL Editor.
-- ============================================================================

-- 1) Buckets existem (privados).
insert into storage.buckets (id, name, public) values
  ('avisos', 'avisos', false),
  ('calendario', 'calendario', false),
  ('planejamentos', 'planejamentos', false)
on conflict (id) do nothing;

-- 2) Sem lista branca de MIME (aceita Excel, Word, PDF, imagens, zip…) + 50 MB.
update storage.buckets
  set allowed_mime_types = null,
      file_size_limit = 52428800
  where id in ('avisos', 'calendario', 'planejamentos');

-- 3) Policies de Storage por bucket — acesso só dentro da própria organização
--    (ou superadmin). Removemos nomes antigos e recriamos de forma uniforme.
do $$
declare
  b text;
  buckets text[] := array['avisos', 'calendario', 'planejamentos'];
  old_names text[] := array[
    'avisos storage read','avisos storage insert','avisos storage delete',
    'cal storage read','cal storage insert','cal storage delete',
    'plan storage read','plan storage insert','plan storage delete'
  ];
  p text;
begin
  -- limpa policies antigas (nomes variados das migrations anteriores)
  foreach p in array old_names loop
    execute format('drop policy if exists %I on storage.objects', p);
  end loop;

  -- recria, uniforme, para cada bucket
  foreach b in array buckets loop
    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' read');
    execute format($f$
      create policy %1$I on storage.objects for select using (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' read', b);

    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' insert');
    execute format($f$
      create policy %1$I on storage.objects for insert with check (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' insert', b);

    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' update');
    execute format($f$
      create policy %1$I on storage.objects for update using (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' update', b);

    execute format($f$drop policy if exists %1$I on storage.objects$f$, b || ' delete');
    execute format($f$
      create policy %1$I on storage.objects for delete using (
        bucket_id = %2$L and (public.is_superadmin()
          or ((storage.foldername(name))[1])::uuid in (select public.member_orgs())))
    $f$, b || ' delete', b);
  end loop;
end $$;
