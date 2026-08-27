-- Scripture, in SQLite.
--
-- The SQLite half of supabase/migrations/0020_bible.sql. Same shape, same
-- ids, same natural key, so a verse is addressed identically on both builds
-- and the shared picker in src/features/bible works against either.
--
-- Where they differ, and why:
--
--   * `aliases` is JSON text, not an array. SQLite has no array type. The
--     column is read once at startup and parsed; see repo/bible.ts.
--
--   * `paragraph` and `is_default` are integers. SQLite has no boolean either.
--
--   * Search is FTS5 rather than a tsvector column. The porter tokenizer
--     stems, which is what lets "comfort" find "comforted" the way the
--     hosted app's english configuration does.
--
--   * There is no RLS, because there is nobody to keep out. The database is a
--     file this user owns. What is preserved is that nothing in the app ever
--     writes to these tables -- the IPC allowlist exposes reads only.

create table if not exists bible_translations (
  id text primary key,
  name text not null,
  abbreviation text not null,
  language_code text not null default 'en',
  year integer,
  license text not null,
  source_url text,
  is_default integer not null default 0
);

create table if not exists bible_books (
  -- 1 = Genesis .. 66 = Revelation, and the sort order. Same ids as Postgres.
  id integer primary key,
  name text not null unique,
  abbreviation text not null,
  testament text not null check (testament in ('old', 'new')),
  -- JSON array of strings. Every other spelling the reference parser accepts.
  aliases text not null default '[]'
);

create table if not exists bible_verses (
  translation_id text not null references bible_translations(id) on delete cascade,
  book_id integer not null references bible_books(id),
  chapter integer not null,
  verse integer not null,
  text text not null,
  paragraph integer not null default 0,
  primary key (translation_id, book_id, chapter, verse)
);

-- Deliberately NOT `without rowid`: the FTS index below is external-content
-- and joins back on this table's rowid.
create index if not exists idx_bible_verses_canonical
  on bible_verses (translation_id, book_id, chapter, verse);

-- Full-text search over the words.
--
-- External content: the index stores only the terms and points at
-- bible_verses by rowid, so the text is not held twice. That costs a join on
-- every hit and saves several megabytes in a file that already carries the
-- whole Bible once.
--
-- No sync triggers, on purpose. The usual external-content setup needs
-- insert/update/delete triggers to keep the index honest; here the rows are
-- written once by the seeder and never change, so the index is built with a
-- single 'rebuild' after the load and there is nothing left to drift.
create virtual table if not exists bible_verses_fts using fts5(
  text,
  content = 'bible_verses',
  tokenize = 'porter unicode61 remove_diacritics 2'
);
