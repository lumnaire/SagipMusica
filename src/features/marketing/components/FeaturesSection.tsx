import { Library, ListMusic, MonitorPlay, Palette } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";

const FEATURES = [
  {
    icon: Library,
    title: "A hymnal that stays put",
    body: "Type lyrics once, split them into verses, chorus, and bridge, and every song stays searchable by title, author, or category.",
  },
  {
    icon: ListMusic,
    title: "Service orders in minutes",
    body: "Drag songs into the order you'll sing them. Rearrange on Saturday night without rebuilding a single slide.",
  },
  {
    icon: MonitorPlay,
    title: "Presentation without the panic",
    body: "Arrow keys move the congregation forward. Press B to black the screen. The projector shows the words and nothing else.",
  },
  {
    icon: Palette,
    title: "It looks like your church",
    body: "Your church's name and colour carry through the whole dashboard, so the team sees something familiar.",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-4 font-display text-4xl leading-[1.08] text-foreground sm:text-5xl">
            Built around how a service actually runs
          </h2>
        </Reveal>

        <div className="staff-rule mt-10 opacity-60" aria-hidden="true" />

        <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-12 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 0.08}>
              <div className="flex gap-5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
