import { Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SupportDialog } from "./SupportDialog";

const FACEBOOK_URL = "https://www.facebook.com/lumnaireph";

export function SupportSection() {
  return (
    <section className="bg-secondary/40 py-24 sm:py-28">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-6 md:grid-cols-2">
        <Reveal>
          <div className="flex h-full flex-col rounded-xl border border-border bg-card p-8 shadow-sm">
            <MessageCircle className="h-5 w-5 text-accent-foreground" />
            <h3 className="mt-4 font-display text-2xl font-medium text-foreground">
              Something broken, or missing?
            </h3>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground">
              Tell us what happened and we'll look into it. Feature requests
              from real worship teams are how this gets better.
            </p>
            <Button asChild variant="outline" className="mt-6 self-start">
              <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
                Message us on Facebook
              </a>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="flex h-full flex-col rounded-xl border border-border bg-primary p-8 text-primary-foreground shadow-sm">
            <Heart className="h-5 w-5" />
            <h3 className="mt-4 font-display text-2xl font-medium">
              Help keep it free for every church
            </h3>
            <p className="mt-2.5 flex-1 text-sm leading-relaxed text-primary-foreground/80">
              SagipMusica costs nothing to use, and we'd like to keep it that
              way. If it's saved your team time, a small gift covers the
              hosting and the next set of improvements.
            </p>
            <SupportDialog />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
