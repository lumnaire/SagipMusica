import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SmoothScrollHero from "@/components/ui/smooth-scroll-hero";
import heroVideo from "@/assets/hero-vid.mp4";
import heroPoster from "@/assets/hero-img.avif";

const SCROLL_HEIGHT = 1200;

export function HeroSection() {
  const { scrollY } = useScroll();
  const reduceMotion = useReducedMotion();

  // Hand the frame over to the image: the words lead, then clear the way as
  // the hymnal opens to full bleed.
  const opacity = useTransform(scrollY, [0, 420], [1, 0]);
  const y = useTransform(scrollY, [0, 420], [0, -40]);

  return (
    // Dark field behind the hero: the scroll effect starts as a small clipped
    // window, and everything outside it would otherwise be the ivory page —
    // leaving the white headline and nav unreadable until you scrolled.
    <div className="relative bg-sidebar">
      <SmoothScrollHero
        scrollHeight={SCROLL_HEIGHT}
        videoSrc={heroVideo}
        posterSrc={heroPoster}
        initialClipPercentage={14}
        finalClipPercentage={86}
      />

      <motion.div
        style={reduceMotion ? undefined : { opacity, y }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-screen w-full items-center justify-center"
      >
        <div className="pointer-events-auto mx-auto max-w-3xl px-6 text-center">
          <p className="eyebrow text-white/70">For worship teams</p>

          <h1 className="mt-5 font-display text-[clamp(2.5rem,7vw,4.75rem)] font-normal leading-[1.02] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)]">
            Serving the Lord with
            <br />
            Music made easier
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-white/80 drop-shadow sm:text-lg">
            Your hymnal, your service order, and the words on the screen —
            gathered into one place your whole team can use.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">
                Create your dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-white/55">
            Free for every church. No card required.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
