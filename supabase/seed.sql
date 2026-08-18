-- Development seed data: a handful of public-domain hymns so the app has
-- something to show immediately after setup. Run manually against your
-- local/dev Supabase project — this is NOT applied automatically in
-- production. See README.md for instructions.

do $$
declare
  song_id uuid;
  section_id uuid;
begin

  -- Amazing Grace (John Newton, 1779 — public domain)
  insert into songs (title, author, composer, category, key, tempo)
  values ('Amazing Grace', 'John Newton', 'Traditional American Melody', 'Hymn', 'G', 'Slow')
  returning id into song_id;

  insert into song_sections (song_id, type, title, lyrics, order_index) values
    (song_id, 'verse', 'Verse 1', E'Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost but now am found\nWas blind, but now I see', 0),
    (song_id, 'verse', 'Verse 2', E'''Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed', 1),
    (song_id, 'verse', 'Verse 3', E'Through many dangers, toils and snares\nI have already come\n''Tis grace hath brought me safe thus far\nAnd grace will lead me home', 2),
    (song_id, 'verse', 'Verse 4', E'When we''ve been there ten thousand years\nBright shining as the sun\nWe''ve no less days to sing God''s praise\nThan when we first begun', 3);

  -- Holy, Holy, Holy (Reginald Heber, 1826 — public domain)
  insert into songs (title, author, composer, category, key, tempo)
  values ('Holy, Holy, Holy', 'Reginald Heber', 'John B. Dykes', 'Hymn', 'D', 'Moderate')
  returning id into song_id;

  insert into song_sections (song_id, type, title, lyrics, order_index) values
    (song_id, 'verse', 'Verse 1', E'Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee\nHoly, holy, holy! Merciful and mighty!\nGod in three Persons, blessed Trinity!', 0),
    (song_id, 'verse', 'Verse 2', E'Holy, holy, holy! All the saints adore Thee\nCasting down their golden crowns around the glassy sea\nCherubim and seraphim falling down before Thee\nWhich wert, and art, and evermore shalt be', 1),
    (song_id, 'verse', 'Verse 3', E'Holy, holy, holy! Though the darkness hide Thee\nThough the eye of sinful man Thy glory may not see\nOnly Thou art holy; there is none beside Thee\nPerfect in power, in love, and purity', 2);

  -- Blessed Assurance (Fanny Crosby, 1873 — public domain)
  insert into songs (title, author, composer, category, key, tempo)
  values ('Blessed Assurance', 'Fanny Crosby', 'Phoebe Knapp', 'Hymn', 'D', 'Bright')
  returning id into song_id;

  insert into song_sections (song_id, type, title, lyrics, order_index) values
    (song_id, 'verse', 'Verse 1', E'Blessed assurance, Jesus is mine!\nOh, what a foretaste of glory divine!\nHeir of salvation, purchase of God\nBorn of His Spirit, washed in His blood', 0),
    (song_id, 'chorus', 'Chorus', E'This is my story, this is my song\nPraising my Savior all the day long\nThis is my story, this is my song\nPraising my Savior all the day long', 1),
    (song_id, 'verse', 'Verse 2', E'Perfect submission, perfect delight\nVisions of rapture now burst on my sight\nAngels descending bring from above\nEchoes of mercy, whispers of love', 2);

  insert into song_sections (song_id, type, title, lyrics, order_index)
  select song_id, 'chorus', 'Chorus', E'This is my story, this is my song\nPraising my Savior all the day long\nThis is my story, this is my song\nPraising my Savior all the day long', 3;

  -- It Is Well with My Soul (Horatio Spafford, 1873 — public domain)
  insert into songs (title, author, composer, category, key, tempo)
  values ('It Is Well with My Soul', 'Horatio Spafford', 'Philip Bliss', 'Hymn', 'D', 'Slow')
  returning id into song_id;

  insert into song_sections (song_id, type, title, lyrics, order_index) values
    (song_id, 'verse', 'Verse 1', E'When peace, like a river, attendeth my way\nWhen sorrows like sea billows roll\nWhatever my lot, Thou hast taught me to say\nIt is well, it is well with my soul', 0),
    (song_id, 'chorus', 'Chorus', E'It is well, with my soul\nIt is well, it is well, with my soul', 1),
    (song_id, 'verse', 'Verse 2', E'Though Satan should buffet, though trials should come\nLet this blest assurance control\nThat Christ has regarded my helpless estate\nAnd hath shed His own blood for my soul', 2);

  insert into song_sections (song_id, type, title, lyrics, order_index)
  select song_id, 'chorus', 'Chorus', E'It is well, with my soul\nIt is well, it is well, with my soul', 3;

  -- A starter worship set combining a few of the songs above.
  declare
    set_id uuid;
    amazing_grace_id uuid;
    holy_holy_holy_id uuid;
    blessed_assurance_id uuid;
  begin
    select id into amazing_grace_id from songs where title = 'Amazing Grace' limit 1;
    select id into holy_holy_holy_id from songs where title = 'Holy, Holy, Holy' limit 1;
    select id into blessed_assurance_id from songs where title = 'Blessed Assurance' limit 1;

    insert into worship_sets (name, description)
    values ('Sunday Morning Worship', 'A sample service order using public-domain hymns.')
    returning id into set_id;

    insert into worship_set_items (set_id, song_id, order_index) values
      (set_id, amazing_grace_id, 0),
      (set_id, holy_holy_holy_id, 1),
      (set_id, blessed_assurance_id, 2);
  end;

end $$;
