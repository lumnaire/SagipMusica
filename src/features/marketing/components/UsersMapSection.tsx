import { Link } from "react-router-dom";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import usersMap from "@/assets/sagipmusica-users-map.png";

/**
 * Read off the pins in the screenshot, so they stay in step with it. When the
 * map is re-shot, check this list against it.
 */
const COUNTRIES = [
  "Philippines",
  "Thailand",
  "Bangladesh",
  "India",
  "United Arab Emirates",
];

/**
 * Where SagipMusica is already being used, as the last thing before the footer.
 *
 * The map is a screenshot, not a live feed -- it is a picture of the signups as
 * they stood when it was taken. The copy is written to match that: it invites
 * you onto the map rather than promising a pin appears the moment you sign up,
 * because nothing here would make that true. Re-export the image when the
 * board of churches has grown enough to be worth showing again.
 *
 * Dark band on purpose. It closes the page the way the hero opens it, and a
 * bright map reads far better lifted off ink than sitting on ivory.
 */
export function UsersMapSection() {
  return (
    <section className="relative overflow-hidden bg-sidebar py-24 text-white sm:py-32">
      {/* The same soft wash the hero and the download page use, so the dark
          bands across the site are recognisably one family. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -20%, color-mix(in oklch, var(--accent) 20%, transparent), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-5 sm:px-6">
        <Reveal className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">
            On the map
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-[clamp(1.9rem,6vw,3.25rem)] leading-[1.08]">
            Churches around the world are already singing with it
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-white/70 sm:text-base">
            Every pin is a congregation that opened SagipMusica for a service —
            from the barangay chapels of the Philippines to worship teams in
            South Asia and the Gulf.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <figure className="mt-11 sm:mt-14">
            {/* A thin lit frame rather than a bare image: the screenshot has a
                hard white edge that would otherwise cut straight into the band. */}
            <div className="overflow-hidden rounded-xl border border-white/15 bg-white/5 p-1 shadow-2xl shadow-black/50 sm:rounded-2xl sm:p-2">
              <img
                src={usersMap}
                width={1153}
                height={588}
                loading="lazy"
                decoding="async"
                alt="A map of Asia and the Middle East with pins marking churches that use SagipMusica."
                className="w-full rounded-lg sm:rounded-xl"
              />
            </div>

            <figcaption className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {COUNTRIES.map((country) => (
                <span
                  key={country}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[0.6875rem] font-medium text-white/75 sm:text-xs"
                >
                  <MapPin className="h-3 w-3 shrink-0 text-accent" />
                  {country}
                </span>
              ))}
            </figcaption>
          </figure>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="mt-11 flex flex-col items-center gap-3.5 sm:mt-14">
            <Button
              asChild
              size="lg"
              className="h-13 w-full max-w-xs gap-2 rounded-xl text-base shadow-lg shadow-black/25 sm:w-auto sm:px-9"
            >
              <Link to="/signup">
                Put your church on the map
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-center text-sm text-white/55">
              Create your account and your church joins the next map we publish.
              Free, for every congregation.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
