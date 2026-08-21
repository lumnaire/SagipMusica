import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Maximize,
  EyeOff,
  Eye,
  Settings2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { usePresentationStore } from "@/stores/presentation-store";
import { loadSongSlides, loadWorshipSetSlides } from "@/features/presentation/engine/loadPresentation";
import { SlideCanvas } from "./SlideCanvas";
import { PresentationSettingsDialog } from "./PresentationSettingsDialog";
import { SECTION_TYPE_LABELS } from "@/types/database";
import { useFullscreen } from "@/hooks/useFullscreen";

export function PresenterView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement>(null);
  const { toggle: toggleFullscreen } = useFullscreen(previewRef);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    title,
    slides,
    currentIndex,
    displayMode,
    style,
    start,
    stop,
    next,
    previous,
    goTo,
    first,
    last,
    toggleBlack,
  } = usePresentationStore();

  useEffect(() => {
    if (!sessionId) return;
    const type = searchParams.get("type");
    const id = searchParams.get("id");
    if (!type || !id) {
      toast.error("Missing presentation content.");
      navigate("/sets");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result =
          type === "set" ? await loadWorshipSetSlides(id) : await loadSongSlides(id);
        if (cancelled) return;
        if (result.slides.length === 0) {
          toast.error("This content has no sections to present yet.");
        }
        start(sessionId, result.title, result.slides);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load presentation content.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (settingsOpen) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
          e.preventDefault();
          previous();
          break;
        case "Home":
          e.preventDefault();
          first();
          break;
        case "End":
          e.preventDefault();
          last();
          break;
        case "b":
        case "B":
          e.preventDefault();
          toggleBlack();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, previous, first, last, toggleBlack, toggleFullscreen, settingsOpen]);

  function openProjector() {
    if (!sessionId) return;
    const url = `/presentation/${sessionId}/projector`;
    const win = window.open(url, "worship-projector", "width=1280,height=720");
    if (!win) {
      toast.error("Pop-up blocked. Allow pop-ups to open the projector view.");
    }
  }

  const currentSlide = slides[currentIndex] ?? null;

  return (
    <div className="flex h-svh flex-col bg-muted/30">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/sets")}>
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {title || "Presentation"}
            </p>
            <p className="text-xs text-muted-foreground">
              {slides.length > 0 ? `Slide ${currentIndex + 1} of ${slides.length}` : "No slides"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden lg:inline">Display Settings</span>
          </Button>
          <Button variant="outline" size="sm" onClick={openProjector}>
            <MonitorPlay className="h-4 w-4" />
            <span className="hidden lg:inline">Open Projector View</span>
          </Button>
        </div>
      </header>

      {/* Below `lg` the section list sits above the preview rather than beside
          it — a fixed 18rem rail would leave almost nothing for the slide. */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <aside className="max-h-40 shrink-0 overflow-y-auto border-b border-border bg-background lg:max-h-none lg:w-72 lg:border-b-0 lg:border-r">
          {loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <SectionList slides={slides} currentIndex={currentIndex} onSelect={goTo} />
          )}
        </aside>

        <main className="flex min-h-0 flex-1 flex-col gap-4 p-3 sm:p-4">
          <div ref={previewRef} className="flex-1 overflow-hidden rounded-lg border border-border bg-black">
            <SlideCanvas
              slide={currentSlide}
              style={style}
              black={displayMode === "black"}
              blank={displayMode === "blank"}
            />
          </div>
        </main>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-border bg-background px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Button variant="outline" onClick={previous} disabled={currentIndex <= 0}>
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant={displayMode === "black" ? "default" : "outline"}
            onClick={toggleBlack}
            className={cn(displayMode === "black" && "bg-neutral-900 hover:bg-neutral-800")}
          >
            <EyeOff className="h-4 w-4" />
            <span className="hidden sm:inline">Black</span>
          </Button>
          <Button
            variant={displayMode === "live" ? "default" : "outline"}
            onClick={() => usePresentationStore.getState().setDisplayMode("live")}
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Live</span>
          </Button>
          <Button variant="outline" size="icon" onClick={toggleFullscreen} title="Fullscreen (F)">
            <Maximize className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={next}
          disabled={currentIndex >= slides.length - 1}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </footer>

      <PresentationSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function SectionList({
  slides,
  currentIndex,
  onSelect,
}: {
  slides: ReturnType<typeof usePresentationStore.getState>["slides"];
  currentIndex: number;
  onSelect: (index: number) => void;
}) {
  if (slides.length === 0) {
    return (
      <p className="p-4 text-center text-sm text-muted-foreground">
        No sections available to present.
      </p>
    );
  }

  let lastSongId: string | null = null;

  return (
    <div className="p-2">
      {slides.map((slide, i) => {
        const showSongHeader = slide.songId !== lastSongId;
        lastSongId = slide.songId;
        return (
          <div key={slide.id}>
            {showSongHeader && (
              <p className="px-2 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                {slide.songTitle}
              </p>
            )}
            <button
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm transition-colors",
                i === currentIndex
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="font-medium">
                {slide.kind === "title"
                  ? "Title slide"
                  : slide.sectionTitle || SECTION_TYPE_LABELS[slide.sectionType]}
              </span>
              <span
                className={cn(
                  "line-clamp-1 text-xs",
                  i === currentIndex ? "text-primary-foreground/75" : "text-muted-foreground",
                )}
              >
                {slide.kind === "title" ? slide.songTitle : slide.lyrics.split("\n")[0]}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
