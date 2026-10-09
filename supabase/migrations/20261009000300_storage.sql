-- =============================================================================
-- Tilt — media storage
-- Public-read bucket (players, often anonymous, must see question images),
-- objects stored under "<user id>/<random uuid>.<ext>" so paths are not
-- guessable, and each user can only write in their own folder.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy quiz_media_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'quiz-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.profiles where id = (select auth.uid()))
  );

create policy quiz_media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'quiz-media' and owner_id = (select auth.uid())::text);

create policy quiz_media_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-media' and owner_id = (select auth.uid())::text);
