-- Starter hymn library.
--
-- songs.church_id is NOT NULL, so there is no such thing as a "global" song
-- row that every church can see -- a plain seed would belong to nobody. This
-- instead keeps a template library and copies it into each church at the
-- moment the church is created, so every new signup starts with a stocked
-- hymnal that they own outright: edit, reorder, or delete without affecting
-- anyone else.
--
-- To change what new churches receive, edit hymn_templates below. Existing
-- churches are not touched (see the backfill note at the bottom).
--
-- COPYRIGHT: only hymns in the public domain carry lyrics here. Two of the
-- requested titles are still under copyright and are seeded as metadata with
-- empty lyrics -- see the note above them before adding words.

create table if not exists hymn_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  author text,
  composer text,
  category text,
  key text,
  tempo text,
  description text,
  order_index integer not null default 0
);

create table if not exists hymn_template_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references hymn_templates (id) on delete cascade,
  type text not null default 'verse'
    check (type in ('verse', 'chorus', 'bridge', 'intro', 'outro', 'refrain', 'custom')),
  title text not null default '',
  lyrics text not null default '',
  order_index integer not null default 0
);

create index if not exists idx_hymn_template_sections_template
  on hymn_template_sections (template_id, order_index);

-- The templates are reference data, not tenant data: readable by any signed-in
-- user, writable by nobody through the API (maintained via migrations).
alter table hymn_templates enable row level security;
alter table hymn_template_sections enable row level security;

drop policy if exists "hymn_templates_read" on hymn_templates;
create policy "hymn_templates_read" on hymn_templates
  for select to authenticated using (true);

drop policy if exists "hymn_template_sections_read" on hymn_template_sections;
create policy "hymn_template_sections_read" on hymn_template_sections
  for select to authenticated using (true);

-- Idempotent: re-running this migration replaces the library cleanly.
delete from hymn_templates;

-- ============================================================================
-- Public-domain hymns (lyrics included)
-- ============================================================================

do $$
declare
  t uuid;
begin

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('To God Be the Glory', 'Fanny J. Crosby', 'William H. Doane', 'Hymn', 'G', 'Bright', 1)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'To God be the glory, great things He hath done!\nSo loved He the world that He gave us His Son,\nWho yielded His life an atonement for sin,\nAnd opened the life gate that all may go in.', 0),
    (t, 'chorus', 'Chorus', E'Praise the Lord, praise the Lord,\nLet the earth hear His voice!\nPraise the Lord, praise the Lord,\nLet the people rejoice!\nO come to the Father, through Jesus the Son,\nAnd give Him the glory, great things He hath done!', 1),
    (t, 'verse', 'Verse 2', E'O perfect redemption, the purchase of blood,\nTo every believer the promise of God;\nThe vilest offender who truly believes,\nThat moment from Jesus a pardon receives.', 2),
    (t, 'verse', 'Verse 3', E'Great things He hath taught us, great things He hath done,\nAnd great our rejoicing through Jesus the Son;\nBut purer, and higher, and greater will be\nOur wonder, our transport, when Jesus we see.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Amazing Grace', 'John Newton', 'Traditional American Melody', 'Hymn', 'G', 'Slow', 2)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found,\nWas blind, but now I see.', 0),
    (t, 'verse', 'Verse 2', E'''Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!', 1),
    (t, 'verse', 'Verse 3', E'Through many dangers, toils and snares,\nI have already come;\n''Tis grace hath brought me safe thus far,\nAnd grace will lead me home.', 2),
    (t, 'verse', 'Verse 4', E'When we''ve been there ten thousand years,\nBright shining as the sun,\nWe''ve no less days to sing God''s praise\nThan when we first begun.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Blessed Assurance', 'Fanny J. Crosby', 'Phoebe P. Knapp', 'Hymn', 'D', 'Bright', 3)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Blessed assurance, Jesus is mine!\nOh, what a foretaste of glory divine!\nHeir of salvation, purchase of God,\nBorn of His Spirit, washed in His blood.', 0),
    (t, 'chorus', 'Chorus', E'This is my story, this is my song,\nPraising my Savior all the day long;\nThis is my story, this is my song,\nPraising my Savior all the day long.', 1),
    (t, 'verse', 'Verse 2', E'Perfect submission, perfect delight,\nVisions of rapture now burst on my sight;\nAngels descending bring from above\nEchoes of mercy, whispers of love.', 2),
    (t, 'verse', 'Verse 3', E'Perfect submission, all is at rest,\nI in my Savior am happy and blest;\nWatching and waiting, looking above,\nFilled with His goodness, lost in His love.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Great Is Thy Faithfulness', 'Thomas O. Chisholm', 'William M. Runyan', 'Hymn', 'Eb', 'Moderate', 4)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Great is Thy faithfulness, O God my Father,\nThere is no shadow of turning with Thee;\nThou changest not, Thy compassions, they fail not;\nAs Thou hast been Thou forever wilt be.', 0),
    (t, 'chorus', 'Chorus', E'Great is Thy faithfulness! Great is Thy faithfulness!\nMorning by morning new mercies I see;\nAll I have needed Thy hand hath provided,\nGreat is Thy faithfulness, Lord, unto me!', 1),
    (t, 'verse', 'Verse 2', E'Summer and winter, and springtime and harvest,\nSun, moon and stars in their courses above,\nJoin with all nature in manifold witness\nTo Thy great faithfulness, mercy and love.', 2),
    (t, 'verse', 'Verse 3', E'Pardon for sin and a peace that endureth,\nThine own dear presence to cheer and to guide;\nStrength for today and bright hope for tomorrow,\nBlessings all mine, with ten thousand beside!', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('It Is Well with My Soul', 'Horatio G. Spafford', 'Philip P. Bliss', 'Hymn', 'C', 'Slow', 6)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'When peace like a river attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul.', 0),
    (t, 'chorus', 'Chorus', E'It is well with my soul,\nIt is well, it is well with my soul.', 1),
    (t, 'verse', 'Verse 2', E'Though Satan should buffet, though trials should come,\nLet this blest assurance control,\nThat Christ hath regarded my helpless estate,\nAnd hath shed His own blood for my soul.', 2),
    (t, 'verse', 'Verse 3', E'My sin—oh, the bliss of this glorious thought!—\nMy sin, not in part but the whole,\nIs nailed to the cross, and I bear it no more,\nPraise the Lord, praise the Lord, O my soul!', 3),
    (t, 'verse', 'Verse 4', E'And, Lord, haste the day when my faith shall be sight,\nThe clouds be rolled back as a scroll;\nThe trump shall resound, and the Lord shall descend,\nEven so, it is well with my soul.', 4);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('The Old Rugged Cross', 'George Bennard', 'George Bennard', 'Hymn', 'Bb', 'Slow', 7)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'On a hill far away stood an old rugged cross,\nThe emblem of suffering and shame;\nAnd I love that old cross where the dearest and best\nFor a world of lost sinners was slain.', 0),
    (t, 'chorus', 'Chorus', E'So I''ll cherish the old rugged cross,\nTill my trophies at last I lay down;\nI will cling to the old rugged cross,\nAnd exchange it some day for a crown.', 1),
    (t, 'verse', 'Verse 2', E'Oh, that old rugged cross, so despised by the world,\nHas a wondrous attraction for me;\nFor the dear Lamb of God left His glory above\nTo bear it to dark Calvary.', 2),
    (t, 'verse', 'Verse 3', E'To the old rugged cross I will ever be true,\nIts shame and reproach gladly bear;\nThen He''ll call me some day to my home far away,\nWhere His glory forever I''ll share.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('At Calvary', 'William R. Newell', 'Daniel B. Towner', 'Hymn', 'G', 'Moderate', 8)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Years I spent in vanity and pride,\nCaring not my Lord was crucified,\nKnowing not it was for me He died\nOn Calvary.', 0),
    (t, 'chorus', 'Chorus', E'Mercy there was great, and grace was free;\nPardon there was multiplied to me;\nThere my burdened soul found liberty,\nAt Calvary.', 1),
    (t, 'verse', 'Verse 2', E'By God''s Word at last my sin I learned;\nThen I trembled at the law I''d spurned,\nTill my guilty soul imploring turned\nTo Calvary.', 2),
    (t, 'verse', 'Verse 3', E'Oh, the love that drew salvation''s plan!\nOh, the grace that brought it down to man!\nOh, the mighty gulf that God did span\nAt Calvary!', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Just As I Am', 'Charlotte Elliott', 'William B. Bradbury', 'Hymn', 'F', 'Slow', 9)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Just as I am, without one plea,\nBut that Thy blood was shed for me,\nAnd that Thou bidd''st me come to Thee,\nO Lamb of God, I come, I come.', 0),
    (t, 'verse', 'Verse 2', E'Just as I am, and waiting not\nTo rid my soul of one dark blot,\nTo Thee whose blood can cleanse each spot,\nO Lamb of God, I come, I come.', 1),
    (t, 'verse', 'Verse 3', E'Just as I am, though tossed about\nWith many a conflict, many a doubt,\nFightings and fears within, without,\nO Lamb of God, I come, I come.', 2),
    (t, 'verse', 'Verse 4', E'Just as I am, Thou wilt receive,\nWilt welcome, pardon, cleanse, relieve;\nBecause Thy promise I believe,\nO Lamb of God, I come, I come.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Rock of Ages', 'Augustus M. Toplady', 'Thomas Hastings', 'Hymn', 'Ab', 'Slow', 10)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Rock of Ages, cleft for me,\nLet me hide myself in Thee;\nLet the water and the blood,\nFrom Thy wounded side which flowed,\nBe of sin the double cure,\nSave from wrath and make me pure.', 0),
    (t, 'verse', 'Verse 2', E'Not the labors of my hands\nCan fulfill Thy law''s demands;\nCould my zeal no respite know,\nCould my tears forever flow,\nAll for sin could not atone;\nThou must save, and Thou alone.', 1),
    (t, 'verse', 'Verse 3', E'Nothing in my hand I bring,\nSimply to Thy cross I cling;\nNaked, come to Thee for dress;\nHelpless, look to Thee for grace;\nFoul, I to the fountain fly;\nWash me, Savior, or I die.', 2),
    (t, 'verse', 'Verse 4', E'While I draw this fleeting breath,\nWhen my eyes shall close in death,\nWhen I soar to worlds unknown,\nSee Thee on Thy judgment throne,\nRock of Ages, cleft for me,\nLet me hide myself in Thee.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Come Thou Fount of Every Blessing', 'Robert Robinson', 'John Wyeth', 'Hymn', 'D', 'Moderate', 11)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Come, Thou Fount of every blessing,\nTune my heart to sing Thy grace;\nStreams of mercy, never ceasing,\nCall for songs of loudest praise.\nTeach me some melodious sonnet,\nSung by flaming tongues above;\nPraise the mount! I''m fixed upon it,\nMount of Thy redeeming love.', 0),
    (t, 'verse', 'Verse 2', E'Here I raise mine Ebenezer;\nHither by Thy help I''m come;\nAnd I hope, by Thy good pleasure,\nSafely to arrive at home.\nJesus sought me when a stranger,\nWandering from the fold of God;\nHe, to rescue me from danger,\nInterposed His precious blood.', 1),
    (t, 'verse', 'Verse 3', E'O to grace how great a debtor\nDaily I''m constrained to be!\nLet Thy goodness, like a fetter,\nBind my wandering heart to Thee.\nProne to wander, Lord, I feel it,\nProne to leave the God I love;\nHere''s my heart, O take and seal it,\nSeal it for Thy courts above.', 2);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('I Surrender All', 'Judson W. Van DeVenter', 'Winfield S. Weeden', 'Hymn', 'F', 'Slow', 12)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'All to Jesus I surrender,\nAll to Him I freely give;\nI will ever love and trust Him,\nIn His presence daily live.', 0),
    (t, 'chorus', 'Chorus', E'I surrender all, I surrender all;\nAll to Thee, my blessed Savior,\nI surrender all.', 1),
    (t, 'verse', 'Verse 2', E'All to Jesus I surrender,\nHumbly at His feet I bow,\nWorldly pleasures all forsaken;\nTake me, Jesus, take me now.', 2),
    (t, 'verse', 'Verse 3', E'All to Jesus I surrender,\nMake me, Savior, wholly Thine;\nLet me feel the Holy Spirit,\nTruly know that Thou art mine.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Have Thine Own Way, Lord', 'Adelaide A. Pollard', 'George C. Stebbins', 'Hymn', 'Db', 'Slow', 13)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Have Thine own way, Lord! Have Thine own way!\nThou art the Potter, I am the clay.\nMold me and make me after Thy will,\nWhile I am waiting, yielded and still.', 0),
    (t, 'verse', 'Verse 2', E'Have Thine own way, Lord! Have Thine own way!\nSearch me and try me, Master, today!\nWhiter than snow, Lord, wash me just now,\nAs in Thy presence humbly I bow.', 1),
    (t, 'verse', 'Verse 3', E'Have Thine own way, Lord! Have Thine own way!\nWounded and weary, help me, I pray!\nPower, all power, surely is Thine!\nTouch me and heal me, Savior divine!', 2),
    (t, 'verse', 'Verse 4', E'Have Thine own way, Lord! Have Thine own way!\nHold o''er my being absolute sway!\nFill with Thy Spirit till all shall see\nChrist only, always, living in me!', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Jesus Paid It All', 'Elvina M. Hall', 'John T. Grape', 'Hymn', 'Bb', 'Moderate', 14)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'I hear the Savior say,\n"Thy strength indeed is small,\nChild of weakness, watch and pray,\nFind in Me thine all in all."', 0),
    (t, 'chorus', 'Chorus', E'Jesus paid it all,\nAll to Him I owe;\nSin had left a crimson stain,\nHe washed it white as snow.', 1),
    (t, 'verse', 'Verse 2', E'Lord, now indeed I find\nThy power, and Thine alone,\nCan change the leper''s spots\nAnd melt the heart of stone.', 2),
    (t, 'verse', 'Verse 3', E'And when before the throne\nI stand in Him complete,\n"Jesus died my soul to save,"\nMy lips shall still repeat.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('When We All Get to Heaven', 'Eliza E. Hewitt', 'Emily D. Wilson', 'Hymn', 'G', 'Bright', 15)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Sing the wondrous love of Jesus,\nSing His mercy and His grace;\nIn the mansions bright and blessed\nHe''ll prepare for us a place.', 0),
    (t, 'chorus', 'Chorus', E'When we all get to heaven,\nWhat a day of rejoicing that will be!\nWhen we all see Jesus,\nWe''ll sing and shout the victory!', 1),
    (t, 'verse', 'Verse 2', E'While we walk the pilgrim pathway,\nClouds will overspread the sky;\nBut when trav''ling days are over,\nNot a shadow, not a sigh.', 2),
    (t, 'verse', 'Verse 3', E'Onward to the prize before us!\nSoon His beauty we''ll behold;\nSoon the pearly gates will open,\nWe shall tread the streets of gold.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Revive Us Again', 'William P. Mackay', 'John J. Husband', 'Hymn', 'G', 'Bright', 16)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'We praise Thee, O God, for the Son of Thy love,\nFor Jesus who died and is now gone above.', 0),
    (t, 'chorus', 'Chorus', E'Hallelujah! Thine the glory,\nHallelujah! Amen;\nHallelujah! Thine the glory,\nRevive us again.', 1),
    (t, 'verse', 'Verse 2', E'We praise Thee, O God, for Thy Spirit of light,\nWho has shown us our Savior and scattered our night.', 2),
    (t, 'verse', 'Verse 3', E'All glory and praise to the Lamb that was slain,\nWho has borne all our sins and has cleansed every stain.', 3),
    (t, 'verse', 'Verse 4', E'Revive us again, fill each heart with Thy love;\nMay each soul be rekindled with fire from above.', 4);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('A Mighty Fortress Is Our God', 'Martin Luther (tr. Frederick H. Hedge)', 'Martin Luther', 'Hymn', 'C', 'Moderate', 18)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'A mighty fortress is our God,\nA bulwark never failing;\nOur helper He, amid the flood\nOf mortal ills prevailing.\nFor still our ancient foe\nDoth seek to work us woe;\nHis craft and power are great,\nAnd, armed with cruel hate,\nOn earth is not his equal.', 0),
    (t, 'verse', 'Verse 2', E'Did we in our own strength confide,\nOur striving would be losing;\nWere not the right Man on our side,\nThe Man of God''s own choosing.\nDost ask who that may be?\nChrist Jesus, it is He;\nLord Sabaoth His name,\nFrom age to age the same,\nAnd He must win the battle.', 1),
    (t, 'verse', 'Verse 3', E'And though this world, with devils filled,\nShould threaten to undo us,\nWe will not fear, for God hath willed\nHis truth to triumph through us.\nThe prince of darkness grim,\nWe tremble not for him;\nHis rage we can endure,\nFor lo! his doom is sure;\nOne little word shall fell him.', 2),
    (t, 'verse', 'Verse 4', E'That word above all earthly powers,\nNo thanks to them, abideth;\nThe Spirit and the gifts are ours\nThrough Him who with us sideth.\nLet goods and kindred go,\nThis mortal life also;\nThe body they may kill:\nGod''s truth abideth still,\nHis kingdom is forever.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('Stand Up, Stand Up for Jesus', 'George Duffield Jr.', 'George J. Webb', 'Hymn', 'Ab', 'Bright', 19)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'Stand up, stand up for Jesus,\nYe soldiers of the cross;\nLift high His royal banner,\nIt must not suffer loss.\nFrom victory unto victory\nHis army shall He lead,\nTill every foe is vanquished,\nAnd Christ is Lord indeed.', 0),
    (t, 'verse', 'Verse 2', E'Stand up, stand up for Jesus,\nThe trumpet call obey;\nForth to the mighty conflict,\nIn this His glorious day.\nYe that are men now serve Him\nAgainst unnumbered foes;\nLet courage rise with danger,\nAnd strength to strength oppose.', 1),
    (t, 'verse', 'Verse 3', E'Stand up, stand up for Jesus,\nStand in His strength alone;\nThe arm of flesh will fail you,\nYe dare not trust your own.\nPut on the gospel armor,\nEach piece put on with prayer;\nWhere duty calls, or danger,\nBe never wanting there.', 2),
    (t, 'verse', 'Verse 4', E'Stand up, stand up for Jesus,\nThe strife will not be long;\nThis day the noise of battle,\nThe next the victor''s song.\nTo him that overcometh\nA crown of life shall be;\nHe with the King of glory\nShall reign eternally.', 3);

  insert into hymn_templates (title, author, composer, category, key, tempo, order_index)
  values ('On Jordan''s Stormy Banks', 'Samuel Stennett', 'Traditional American Melody', 'Hymn', 'F', 'Moderate', 20)
  returning id into t;
  insert into hymn_template_sections (template_id, type, title, lyrics, order_index) values
    (t, 'verse', 'Verse 1', E'On Jordan''s stormy banks I stand,\nAnd cast a wishful eye\nTo Canaan''s fair and happy land,\nWhere my possessions lie.', 0),
    (t, 'chorus', 'Chorus', E'I am bound for the promised land,\nI am bound for the promised land;\nOh, who will come and go with me?\nI am bound for the promised land.', 1),
    (t, 'verse', 'Verse 2', E'O''er all those wide extended plains\nShines one eternal day;\nThere God the Son forever reigns,\nAnd scatters night away.', 2),
    (t, 'verse', 'Verse 3', E'No chilling winds nor poisonous breath\nCan reach that healthful shore;\nSickness and sorrow, pain and death,\nAre felt and feared no more.', 3),
    (t, 'verse', 'Verse 4', E'When shall I reach that happy place,\nAnd be forever blest?\nWhen shall I see my Father''s face,\nAnd in His bosom rest?', 4);

end $$;

-- ============================================================================
-- Still under copyright -- seeded as metadata only, with no lyrics.
--
-- "How Great Thou Art" (Stuart K. Hine's English text, 1949) and "Victory in
-- Jesus" (E. M. Bartlett, 1939) are NOT public domain. Reproducing their
-- words needs a licence -- most churches already hold one through CCLI.
-- Once yours covers it, paste the lyrics into these songs from the app.
-- ============================================================================

insert into hymn_templates (title, author, composer, category, key, tempo, description, order_index)
values
  ('How Great Thou Art', 'Carl Boberg; tr. Stuart K. Hine', 'Swedish folk melody', 'Hymn', 'Bb', 'Moderate',
   'Lyrics not included: this English text is under copyright. Add the words under your church''s CCLI licence.', 5),
  ('Victory in Jesus', 'Eugene M. Bartlett', 'Eugene M. Bartlett', 'Hymn', 'G', 'Bright',
   'Lyrics not included: this hymn is under copyright. Add the words under your church''s CCLI licence.', 17);

-- ============================================================================
-- Copy the library into every church at creation
-- ============================================================================

create or replace function seed_church_hymns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- church_id is set explicitly here: the auto-fill trigger on songs reads it
  -- from the caller's profile, which is not pointed at this church yet during
  -- onboarding.
  insert into songs (church_id, title, author, composer, category, key, tempo, description)
  select new.id, t.title, t.author, t.composer, t.category, t.key, t.tempo, t.description
  from hymn_templates t
  order by t.order_index;

  insert into song_sections (church_id, song_id, type, title, lyrics, order_index)
  select new.id, s.id, ts.type, ts.title, ts.lyrics, ts.order_index
  from hymn_template_sections ts
  join hymn_templates t on t.id = ts.template_id
  join songs s on s.church_id = new.id and s.title = t.title;

  return new;
end;
$$;

drop trigger if exists trg_churches_seed_hymns on churches;
create trigger trg_churches_seed_hymns
  after insert on churches
  for each row execute function seed_church_hymns();

-- Backfill for churches that already exist (safe to re-run: skips any church
-- that already has songs).
do $$
declare
  c record;
begin
  for c in select id from churches loop
    if not exists (select 1 from songs where church_id = c.id) then
      insert into songs (church_id, title, author, composer, category, key, tempo, description)
      select c.id, t.title, t.author, t.composer, t.category, t.key, t.tempo, t.description
      from hymn_templates t order by t.order_index;

      insert into song_sections (church_id, song_id, type, title, lyrics, order_index)
      select c.id, s.id, ts.type, ts.title, ts.lyrics, ts.order_index
      from hymn_template_sections ts
      join hymn_templates t on t.id = ts.template_id
      join songs s on s.church_id = c.id and s.title = t.title;
    end if;
  end loop;
end $$;
