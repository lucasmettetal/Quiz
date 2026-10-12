-- =============================================================================
-- Tiltt — storage hardening (audit of 2026-10-12)
-- An owner may update their own objects, but never move one out of their
-- folder (the update policy had no WITH CHECK).
-- Kept separate from the other migrations: the PGlite test harness skips
-- storage files (no storage schema there).
-- =============================================================================

drop policy if exists quiz_media_update_own on storage.objects;

create policy quiz_media_update_own on storage.objects for update to authenticated
  using (bucket_id = 'quiz-media' and owner_id = (select auth.uid())::text)
  with check (
    bucket_id = 'quiz-media'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
