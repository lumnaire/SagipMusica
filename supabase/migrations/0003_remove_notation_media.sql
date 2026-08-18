-- The musical-notation-image feature (per-section crop editor + storage
-- bucket) has been removed from the product. This migration undoes
-- 0002_storage.sql and drops the now-unused section_media table, rather
-- than editing already-applied migrations.
--
-- Note: this does not delete the files that were previously uploaded into
-- the "presentation-media" bucket. If you want those gone too, remove them
-- from Storage in the Supabase dashboard (Storage > presentation-media)
-- before or after running this migration.

drop policy if exists "presentation_media_public_read" on storage.objects;
drop policy if exists "presentation_media_admin_insert" on storage.objects;
drop policy if exists "presentation_media_admin_update" on storage.objects;
drop policy if exists "presentation_media_admin_delete" on storage.objects;

delete from storage.buckets where id = 'presentation-media';

drop table if exists section_media;
