import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";

// A genuine sequence, so the numbering carries real information —
// set like hymnal verse numbers rather than decorative "01 / 02 / 03".
const STEPS = [
  {
    title: "Create your account",
    body: "Sign up with Google or an email address. Verification takes a minute.",
  },
  {
    title: "Name your church",
    body: "Tell us what to call your dashboard. We'll set it up around that name.",
  },
  {
    title: "Start your hymnal",
    body: "Add your first song and build the set for Sunday. The dashboard is yours from here.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-secondary/40 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">Getting set up</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.08] text-foreground sm:text-5xl">
            Three steps, then it's yours
          </h2>
        </Reveal>

        <ol className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.1}>
              <li className="relative border-t border-border pt-6">
                <span
                  className="absolute -top-px left-0 h-px w-12 bg-accent"
                  aria-hidden="true"
                />
                <span className="font-display text-base font-semibold tabular-nums text-accent-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-2xl font-medium leading-snug text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.2} className="mt-14">
          <Button asChild size="lg">
            <Link to="/signup">
              Start with your church
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
