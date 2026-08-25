import { useEffect, useState } from "react";
import { MessageCircle, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublishedUpdates } from "@/features/updates/api";
import type { PlatformUpdate } from "@/types/database";
import { FACEBOOK_URL } from "../download-info";

/**
 * What is being built next, straight from the board the superadmin keeps
 * (migration 0016).
 *
 * It sits directly under the "this is version one" note because the two are
 * one argument: we are asking for patience and for suggestions, and this is
 * the evidence that both go somewhere. An empty board therefore does not go
 * quiet -- it asks for the suggestion instead.
 *
 * A failed fetch is told apart from an empty board on purpose. Rendering
 * "nothing planned" because Supabase was unreachable would be a claim about
 * the roadmap that we have not actually checked.
 */
export function UpcomingUpdates() {
  const [updates, setUpdates] = useState<PlatformUpdate[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPublishedUpdates()
      .then((rows) => {
        if (alive) setUpdates(rows);
      })
      .catch((err) => {
        console.error("Could not load the updates board", err);
        if (alive) {
          setUpdates([]);
          setFailed(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="border-b border-border bg-background py-24 sm:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <p className="eyebrow">On the way</p>
          <h2 className="mt-4 font-display text-3xl leading-[1.1] text-foreground sm:text-4xl">
            What we're building next
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The list below is what is being worked on for the next release. It
            is kept short on purpose — everything on it is something a worship
            team asked for.
          </p>
        </Reveal>

        <div className="staff-rule mt-10 opacity-60" aria-hidden="true" />

        {updates === null ? (
          <div className="mt-12 space-y-8" aria-busy="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="border-t border-border pt-6">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
              </div>
            ))}
          </div>
        ) : updates.length > 0 ? (
          <ol className="mt-12 space-y-9">
            {updates.map((update, i) => (
              <Reveal key={update.id} delay={i * 0.08}>
                <li className="relative border-t border-border pt-6">
                  <span
                    className="absolute -top-px left-0 h-px w-12 bg-accent"
                    aria-hidden="true"
                  />
                  <div className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                      <Rocket className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-foreground">
                        {update.title}
                      </h3>
                      {update.detail && (
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {update.detail}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        ) : (
          <Reveal>
            <div className="mt-12 rounded-xl border border-dashed border-border bg-card p-7 text-center sm:p-9">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                <MessageCircle className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                {failed
                  ? "The board couldn't be loaded just now"
                  : "Nothing on the board at the moment"}
              </h3>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {failed
                  ? "Please try again in a moment. In the meantime, we would still like to hear what would make SagipMusica work better for your team."
                  : "The next release is still open. If there is something that would make your Sundays easier — a feature you keep wishing for, or a rough edge worth smoothing — we would like to hear it, and it will be weighed for what comes next."}
              </p>
              <Button asChild variant="outline" className="mt-6">
                <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Send us a suggestion
                </a>
              </Button>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
