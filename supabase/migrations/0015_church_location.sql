-- Where the church is.
--
-- Onboarding asked what a church is called and how it heard about us, but
-- never where it worships -- so the web signups could not be read the way the
-- download survey (0014) can, and two congregations sharing a common name
-- ("Grace Community Church") were indistinguishable. This adds the same
-- question to onboarding and stores the answer on the church itself.
--
-- Free text, deliberately. The answer spans a barangay, a city, a province and
-- occasionally just a country, and no dropdown we could ship covers that
-- without pushing people into "Other". It is trimmed and length-capped by a
-- check constraint rather than by the form alone, matching download_signups.
--
-- Nullable because every church created before this migration has no answer,
-- and backfilling one would be inventing data. New churches always send it --
-- the onboarding step is required -- but the column stays nullable so the
-- older rows remain valid.

alter table churches
  add column if not exists location text;

alter table churches
  drop constraint if exists churches_location_length;

alter table churches
  add constraint churches_location_length
  check (location is null or length(btrim(location)) between 2 and 160);

-- 0010 revoked column-wide UPDATE on churches and handed back an explicit
-- list. Re-issued here with location added, so an admin can fix a typo later
-- without regaining write access to created_by or referral_source. INSERT is
-- untouched: it was never narrowed, and onboarding writes the column there.
grant update (name, accent_color, location) on public.churches to authenticated;
