-- Platform counters for the landing page.
--
-- The hero ends on a set of running totals -- accounts, churches, desktop
-- downloads, songs, worship sets -- so the marketing site needs numbers it can
-- read while signed out. superadmin_stats() (0011/0012/0016) cannot serve
-- them: it raises 'Not authorised' for anyone who is not the platform
-- operator, which is every visitor.
--
-- Design notes:
--
--  * Counts only, never rows. This function returns five integers and nothing
--    that could identify a church, an account or a song. The underlying tables
--    stay exactly as locked down as they were -- a visitor still cannot select
--    a single row from any of them, and nothing here grants them a way to try.
--
--  * SECURITY DEFINER is what makes that possible. The counts are taken by the
--    function's owner, so RLS never enters into it, and the only thing that
--    escapes is the aggregate. The alternative -- granting anon SELECT so it
--    could count for itself -- would handing over the rows as well.
--
--  * Be deliberate about publishing these. They are business numbers: anyone
--    on the internet, including whoever else is selling worship software, can
--    read how many churches have signed up and watch it change week to week.
--    That is the point of putting them on the hero, but it is a decision, not
--    a detail. Dropping the function un-publishes them.
--
--  * `accounts` counts every profile, platform roles included, so it agrees
--    with the Accounts card on the superadmin dashboard. The difference is a
--    handful of rows and two numbers that disagree would be worse.
--
--  * `stable`, not `volatile`: it reads and never writes, which lets Postgres
--    reuse the result within a statement.

create or replace function public_platform_stats()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'accounts', (select count(*) from profiles),
    'churches', (select count(*) from churches),
    'desktop_downloads', (select count(*) from download_signups),
    'songs', (select count(*) from songs),
    'worship_sets', (select count(*) from worship_sets)
  );
$$;

-- Take the default grant back before handing out exactly what is intended.
-- `public` includes every role present and future; anon and authenticated are
-- named on purpose.
revoke all on function public_platform_stats() from public;
grant execute on function public_platform_stats() to anon, authenticated;
