import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Pencil, PlayCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SlideCanvas } from "@/features/presentation/components/SlideCanvas";
import { loadSongSlides } from "@/features/presentation/engine/loadPresentation";
import { DEFAULT_PRESENTATION_STYLE, type PresentationSlide } from "@/types/presentation";
import { useAuthStore } from "@/stores/auth-store";

export function SongPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.profile?.role === "admin");
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<PresentationSlide[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await loadSongSlides(id);
        if (cancelled) return;
        setTitle(result.title);
        setSlides(result.slides);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load song preview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const currentSlide = slides[index] ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/songs")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{title || "Preview"}</h1>
              <p className="text-sm text-muted-foreground">
                Simulated 16:9 projector preview.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <Button variant="outline" onClick={() => navigate(`/songs/${id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            <Button
              onClick={() =>
                navigate(`/presentation/${crypto.randomUUID()}?type=song&id=${id}`)
              }
            >
              <PlayCircle className="h-4 w-4" />
              Present
            </Button>
          </div>
        </div>

        {loading ? (
          <Skeleton className="aspect-video w-full" />
        ) : slides.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted/30 px-4 py-16 text-center text-sm text-muted-foreground">
            {isAdmin
              ? "This song has no sections yet. Add sections in the editor to preview it."
              : "This song has no sections yet."}
          </p>
        ) : (
          <>
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black shadow-sm">
              <SlideCanvas slide={currentSlide} style={DEFAULT_PRESENTATION_STYLE} />
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="flex flex-wrap justify-center gap-1.5">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setIndex(i)}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      i === index
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
                disabled={index === slides.length - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
