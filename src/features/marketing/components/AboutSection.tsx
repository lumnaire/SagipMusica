import { Reveal } from "@/components/ui/reveal";
import lumnaireLogo from "@/assets/lumnaire_logo.png";

export function AboutSection() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <Reveal>
          <blockquote className="text-center">
            <p className="font-display text-[clamp(1.6rem,3.6vw,2.5rem)] leading-tight text-foreground">
              “Let the word of Christ dwell in you richly… singing psalms and
              hymns and spiritual songs.”
            </p>
            <footer className="eyebrow mt-6">Colossians 3:16</footer>
          </blockquote>
        </Reveal>

        <div className="staff-rule my-14 opacity-60" aria-hidden="true" />

        <Reveal delay={0.1}>
          <div className="text-center">
            <p className="eyebrow">Why we built it</p>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              Most worship teams run Sunday on a pile of slide decks, printed
              sheets, and one laptop that knows where everything is.
              SagipMusica keeps the songs, the service order, and the screen in
              one place, so preparing for Sunday doesn't depend on any one
              person remembering.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-10 flex justify-center">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-sm sm:rounded-full">
              <img src={lumnaireLogo} alt="" className="h-6 w-6 rounded-sm" />
              <p className="text-sm text-muted-foreground">
                Built by <span className="font-medium text-foreground">Ronald Castromero</span>{" "}
                from Fundamental Baptist Church, founder of Lumnaire
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
