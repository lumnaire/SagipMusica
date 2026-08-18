-- Storage bucket for musical notation images and presentation backgrounds.
-- Files are organized as: songs/{song_id}/{section_id}/original-*.{ext}
--
-- The bucket is public for read (so <img> tags and the projector view can
-- load files directly without signed URLs), but writes are restricted to
-- admins via RLS-style storage policies.

insert into storage.buckets (id, name, public)
values ('presentation-media', 'presentation-media', true)
on conflict (id) do nothing;

create policy "presentation_media_public_read"
  on storage.objects for select
  using (bucket_id = 'presentation-media');

create policy "presentation_media_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'presentation-media' and is_admin());

create policy "presentation_media_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'presentation-media' and is_admin());

create policy "presentation_media_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'presentation-media' and is_admin());
