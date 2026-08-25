import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Reveal } from "@/components/ui/reveal";
import { FBC_FACEBOOK_URL, LUMNAIRE_FACEBOOK_URL } from "@/lib/links";
import { LIBRARY_SONG_COUNT } from "@/features/download/download-info";

const INLINE_LINK =
  "font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline";

/**
 * Answers are ReactNode rather than strings so the origin story can carry a
 * link and more than one paragraph. Everything claimed here is something the
 * product actually does today -- there is no team-invite flow yet, for
 * instance, so no question pretends there is.
 */
const FAQS: { question: string; answer: ReactNode }[] = [
  {
    question: "What is SagipMusica?",
    answer: (
      <p>
        SagipMusica is a worship presentation tool built for churches. It keeps
        your hymnal, your service order and the words on the screen in one
        place, so preparing for Sunday does not depend on one person remembering
        where everything is. It runs in the browser, and as a Windows app for
        the computer that drives the projector.
      </p>
    ),
  },
  {
    question: "How did SagipMusica start?",
    answer: (
      <>
        <p>
          It started in a local church, not a boardroom. Ronald Castromero was
          serving on the worship team at{" "}
          <a
            href={FBC_FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
            className={INLINE_LINK}
          >
            Fundamental Baptist Church
          </a>
          , where every Sunday meant rebuilding slides by hand and trusting that
          the one laptop that knew where everything lived would make it through
          the service.
        </p>
        <p>
          The established answers — EasyWorship, ProPresenter and the rest — did
          the job well, but their licences and yearly subscriptions sat far
          outside what his congregation could justify, and outside what most of
          the churches around it could afford at all. Software priced for a
          Western megachurch was never going to come out of a Philippine church
          budget.
        </p>
        <p>
          So he built the tool his own church needed, and kept building it as
          other congregations asked for the same thing. SagipMusica is what came
          of that: the capability those tools offer, shaped around how a
          volunteer worship team actually works on a Sunday morning, and free —
          so that cost is never the reason a church goes without.
        </p>
      </>
    ),
  },
  {
    question: "Is it free to use?",
    answer: (
      <>
        <p>
          Yes, completely, for every church. There is no trial period, no
          per-seat licence and no card required — on the web app or the Windows
          app.
        </p>
        <p>
          It is kept running by gifts from churches that are able to give. If
          yours is, there is a support panel further up this page. If it is not,
          nothing changes: you get exactly the same product either way.
        </p>
      </>
    ),
  },
  {
    question: "Do we need the internet during a service?",
    answer: (
      <p>
        Not with the Windows app. Your hymnal is a file on the church computer,
        so nothing stalls mid-service because the church WiFi dropped — that is
        the reason the desktop build exists. The web app does need a connection,
        which makes it the better fit for planning during the week and for teams
        on a reliable line.
      </p>
    ),
  },
  {
    question: "Should we use the web app or the Windows app?",
    answer: (
      <>
        <p>
          Both project to a second screen, so it comes down to where you work.
          The web app opens anywhere, on any modern browser, and is the easier
          place to prepare a set during the week.
        </p>
        <p>
          The Windows app is for the machine at the front of the sanctuary: it
          runs with the internet unplugged, needs no account, and arrives with{" "}
          {LIBRARY_SONG_COUNT} hymns already in the hymnal.{" "}
          <Link to="/download" className={INLINE_LINK}>
            Download it here
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    question: "Does it work with a projector?",
    answer: (
      <p>
        Yes. Plug in the projector and the lyrics window finds the second
        display on its own. The congregation sees only the words while the
        operator keeps the controls and their notes on the laptop — arrow keys
        move the service forward, and B blacks the screen when it is time to
        preach.
      </p>
    ),
  },
  {
    question: "Do we still need a CCLI licence for our songs?",
    answer: (
      <p>
        Whatever cover your church already needs to project a song, it still
        needs — SagipMusica grants you no rights of its own. Public-domain hymns
        ship complete with their words. Songs still under copyright are included
        as titles and details only, deliberately without lyrics, for your church
        to fill in under its own licence.
      </p>
    ),
  },
  {
    question: "Where does our church's information live?",
    answer: (
      <p>
        The Windows app keeps everything in a file on your own computer. There
        is no account and no sign-in, and your songs never reach us. The web app
        stores your hymnal in your church's own space, which only your church's
        accounts can open — no other church on the platform can see it.
      </p>
    ),
  },
  {
    question: "Is there a macOS version?",
    answer: (
      <p>
        Not yet — a macOS build is in the works. Until it lands, the web app
        runs on a Mac in any modern browser and does everything except work
        offline.
      </p>
    ),
  },
];

/**
 * Questions worth answering before somebody signs up.
 *
 * Built on native <details> rather than a scripted accordion: it opens without
 * JavaScript, is keyboard- and screen-reader-correct for free, and lets a
 * visitor use the browser's own find-on-page across every open answer. The
 * only work left to do is hiding the default marker and turning the plus into
 * a cross.
 */
export function FaqSection() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-6">
        <Reveal>
          <p className="eyebrow">Questions</p>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,6vw,3.25rem)] leading-[1.08] text-foreground">
            Before you sign up
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
            The things churches ask us most. Anything not covered here,{" "}
            <a
              href={LUMNAIRE_FACEBOOK_URL}
              target="_blank"
              rel="noreferrer"
              className={INLINE_LINK}
            >
              send us a message
            </a>{" "}
            and we will answer it.
          </p>
        </Reveal>

        <div className="staff-rule mt-10 opacity-60" aria-hidden="true" />

        <div className="mt-4">
          {FAQS.map((faq, i) => (
            <Reveal key={faq.question} delay={Math.min(i, 4) * 0.05}>
              <details className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-display text-lg font-medium leading-snug text-foreground transition-colors group-hover:text-primary sm:text-xl">
                    {faq.question}
                  </h3>
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-all duration-300 group-hover:border-primary/40 group-hover:text-foreground group-open:rotate-45 group-open:border-primary/40 group-open:bg-primary group-open:text-primary-foreground"
                    aria-hidden="true"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </summary>

                <div className="animate-in fade-in-0 slide-in-from-top-1 pb-6 pr-0 text-sm leading-relaxed text-muted-foreground duration-300 sm:pr-13 sm:text-base [&_p+p]:mt-3.5">
                  {faq.answer}
                </div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
