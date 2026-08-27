import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Loader2, PlayCircle, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBibleStore } from "@/stores/bible-store";
import { fetchPassage, searchVerses } from "../api";
import { formatReference, parseReference, type ParsedReference } from "../reference";
import type { BibleBook, BibleSearchHit, BibleVerse } from "@/types/bible";

/** How long the box sits still before a word search is sent. */
const SEARCH_DEBOUNCE_MS = 250;

/** Below this, a search is more noise than signal. References are exempt. */
const MIN_SEARCH_LENGTH = 3;

interface BibleBrowserProps {
  /** "Present" — starts a presentation of the chosen passage. */
  onPresent: (reference: ParsedReference) => void;
  /**
   * "Add to presentation" — only supplied when one is already running, which
   * is what makes the button appear.
   */
  onAdd?: (reference: ParsedReference) => void;
  /** Shrinks the panes for the dialog, which has far less room than the page. */
  compact?: boolean;
}

/**
 * The scripture picker: find a passage, look at it, put it on the screen.
 *
 * The single box at the top does both jobs, because a presenter should not
 * have to decide which one they are doing before they start typing. Anything
 * that reads as a reference — "jn 3:16", "Psalm 23", "1 John 4:7-8" — moves
 * the panes to it. Anything else is searched for as words. See reference.ts
 * for how the two are told apart.
 *
 * Underneath, three panes in the order you narrow: book, then chapter, then
 * the chapter's text with the passage selected inside it. The text pane is
 * both the verse picker and the preview, because they are the same question —
 * "is this the bit I meant?" — and answering it twice in two places would
 * mean scrolling between them.
 */
export function BibleBrowser({ onPresent, onAdd, compact = false }: BibleBrowserProps) {
  const { status, error, books, bookIndex, chapters, translations, translationId, load, setTranslationId } =
    useBibleStore();

  const [query, setQuery] = useState("");
  const [bookId, setBookId] = useState<number | null>(null);
  const [chapter, setChapter] = useState(1);
  const [verseStart, setVerseStart] = useState<number | null>(null);
  const [verseEnd, setVerseEnd] = useState<number | null>(null);

  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);

  const [hits, setHits] = useState<BibleSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const versesPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const book = useMemo(() => books.find((b) => b.id === bookId) ?? null, [books, bookId]);
  const chapterCount = bookId === null ? 0 : (chapters.get(bookId)?.length ?? 0);

  /** What the buttons at the bottom would act on. Null until a book is picked. */
  const selection = useMemo<ParsedReference | null>(
    () => (book ? { book, chapter, verseStart, verseEnd } : null),
    [book, chapter, verseStart, verseEnd],
  );

  const goTo = useCallback(
    (target: { book: BibleBook; chapter: number | null; verseStart: number | null; verseEnd: number | null }) => {
      setBookId(target.book.id);
      setChapter(target.chapter ?? 1);
      setVerseStart(target.verseStart);
      setVerseEnd(target.verseEnd);
    },
    [],
  );

  // The box does two things, and this effect decides which. A reference wins
  // over a search every time: somebody who typed "Psalm 23" wants Psalm 23,
  // not the 12 verses that mention a psalm.
  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setHits(null);
      setSearching(false);
      return;
    }

    const reference = parseReference(trimmed, bookIndex);
    if (reference) {
      setHits(null);
      setSearching(false);
      goTo(reference);
      return;
    }

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      setHits(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await searchVerses(translationId, trimmed);
        if (!cancelled) setHits(results);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setHits([]);
          toast.error("Search failed.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, bookIndex, translationId, goTo]);

  // The chapter's text, refetched whenever the chapter or translation changes.
  useEffect(() => {
    if (bookId === null || !book) {
      setVerses([]);
      return;
    }

    let cancelled = false;
    setVersesLoading(true);
    (async () => {
      try {
        const rows = await fetchPassage(translationId, {
          book,
          chapter,
          verseStart: null,
          verseEnd: null,
        });
        if (!cancelled) setVerses(rows);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setVerses([]);
          toast.error("Could not load that chapter.");
        }
      } finally {
        if (!cancelled) setVersesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [book, bookId, chapter, translationId]);

  // Bring the selected verse into view when it was reached by typing a
  // reference rather than by clicking it — otherwise "Psalm 119:105" lands the
  // user at the top of a 176-verse chapter with nothing apparently selected.
  useEffect(() => {
    if (verseStart === null || versesLoading) return;
    const pane = versesPaneRef.current;
    const target = pane?.querySelector(`[data-verse="${verseStart}"]`);
    target?.scrollIntoView({ block: "nearest" });
  }, [verseStart, versesLoading, verses]);

  /** Clicking a verse selects it; shift-clicking extends from the last one. */
  function clickVerse(number: number, extend: boolean) {
    if (extend && verseStart !== null) {
      setVerseStart(Math.min(verseStart, number));
      setVerseEnd(Math.max(verseStart, number));
    } else {
      setVerseStart(number);
      setVerseEnd(number);
    }
    setQuery("");
  }

  if (status === "error") {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Failed to load the Bible."}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }

  const paneHeight = compact ? "h-56" : "h-[26rem]";

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Search / reference */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a reference (John 3:16) or search the text…"
            className="pl-9 pr-9"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {translations.length > 1 && (
          <Select value={translationId} onValueChange={(v) => void setTranslationId(v)}>
            <SelectTrigger className="w-32 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {translations.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.abbreviation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {status !== "ready" ? (
        <Skeleton className={cn("w-full", paneHeight)} />
      ) : hits !== null || searching ? (
        <SearchResults
          hits={hits}
          searching={searching}
          className={paneHeight}
          onPick={(hit) => {
            goTo({
              book: hit.book,
              chapter: hit.chapter,
              verseStart: hit.verse,
              verseEnd: hit.verse,
            });
            setQuery("");
          }}
        />
      ) : (
        <div className={cn("grid min-h-0 gap-3", compact ? "grid-cols-1 sm:grid-cols-[10rem_1fr]" : "grid-cols-1 md:grid-cols-[12rem_11rem_1fr]")}>
          {/* Books */}
          <div className={cn("overflow-y-auto rounded-md border border-border bg-background p-1.5", paneHeight)}>
            {(["old", "new"] as const).map((testament) => (
              <div key={testament}>
                <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground first:pt-1">
                  {testament === "old" ? "Old Testament" : "New Testament"}
                </p>
                {books
                  .filter((b) => b.testament === testament)
                  .map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBookId(b.id);
                        setChapter(1);
                        setVerseStart(null);
                        setVerseEnd(null);
                        setQuery("");
                      }}
                      className={cn(
                        "block w-full rounded px-2 py-1.5 text-left text-sm transition-colors",
                        b.id === bookId
                          ? "bg-primary font-medium text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      {b.name}
                    </button>
                  ))}
              </div>
            ))}
          </div>

          {/* Chapters. Folded into the books column when the dialog is narrow. */}
          <div className={cn("overflow-y-auto rounded-md border border-border bg-background p-2", paneHeight, compact && "hidden sm:block")}>
            {bookId === null ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">Pick a book.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1">
                {Array.from({ length: chapterCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setChapter(n);
                      setVerseStart(null);
                      setVerseEnd(null);
                      setQuery("");
                    }}
                    className={cn(
                      "rounded px-1 py-1.5 text-center text-sm tabular-nums transition-colors",
                      n === chapter
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* The chapter itself: verse picker and preview in one. */}
          <div
            ref={versesPaneRef}
            className={cn("overflow-y-auto rounded-md border border-border bg-background p-2", paneHeight, compact && "sm:col-span-2")}
          >
            {bookId === null ? (
              <EmptyPane />
            ) : versesLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              verses.map((v) => {
                const selected =
                  verseStart !== null && v.verse >= verseStart && v.verse <= (verseEnd ?? verseStart);
                return (
                  <button
                    key={v.verse}
                    type="button"
                    data-verse={v.verse}
                    onClick={(e) => clickVerse(v.verse, e.shiftKey)}
                    className={cn(
                      "flex w-full gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                      selected
                        ? "bg-primary/10 text-foreground ring-1 ring-inset ring-primary/40"
                        : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "w-6 shrink-0 pt-0.5 text-right text-xs tabular-nums",
                        selected ? "font-semibold text-primary" : "text-muted-foreground",
                      )}
                    >
                      {v.verse}
                    </span>
                    <span className="leading-snug">{v.text}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* What is selected, and what can be done with it. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {selection ? formatReference(selection) : "No passage selected"}
          </p>
          <p className="text-xs text-muted-foreground">
            {selection
              ? verseStart === null
                ? "The whole chapter — click a verse, or shift-click a second to select a range."
                : `${(verseEnd ?? verseStart) - verseStart + 1} verse${(verseEnd ?? verseStart) === verseStart ? "" : "s"}, one per slide`
              : "Pick a book, or type a reference above."}
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {onAdd && (
            <Button variant="outline" disabled={!selection} onClick={() => selection && onAdd(selection)}>
              <Plus className="h-4 w-4" />
              Add to presentation
            </Button>
          )}
          <Button disabled={!selection} onClick={() => selection && onPresent(selection)}>
            <PlayCircle className="h-4 w-4" />
            Present
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <BookOpen className="h-7 w-7 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">
        Pick a book, or type a reference like <span className="font-medium text-foreground">John 3:16</span>.
      </p>
    </div>
  );
}

function SearchResults({
  hits,
  searching,
  className,
  onPick,
}: {
  hits: BibleSearchHit[] | null;
  searching: boolean;
  className?: string;
  onPick: (hit: BibleSearchHit) => void;
}) {
  if (searching && hits === null) {
    return (
      <div className={cn("flex items-center justify-center rounded-md border border-border bg-background", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hits || hits.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center gap-1 rounded-md border border-border bg-background px-6 text-center", className)}>
        <p className="text-sm text-muted-foreground">No verses found.</p>
        <p className="text-xs text-muted-foreground">
          Try fewer words, or put a phrase in quotes.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-y-auto rounded-md border border-border bg-background p-1.5", className)}>
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        {hits.length} verse{hits.length === 1 ? "" : "s"}
        {hits.length >= 100 && " (showing the first 100)"} — in Bible order
      </p>
      {hits.map((hit) => (
        <button
          key={`${hit.book_id}:${hit.chapter}:${hit.verse}`}
          type="button"
          onClick={() => onPick(hit)}
          className="block w-full rounded px-2 py-2 text-left transition-colors hover:bg-muted"
        >
          <span className="text-xs font-semibold text-primary">
            {hit.book.name} {hit.chapter}:{hit.verse}
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-foreground">{hit.text}</span>
        </button>
      ))}
    </div>
  );
}
