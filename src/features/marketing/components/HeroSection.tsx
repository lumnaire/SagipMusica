import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SmoothScrollHero from "@/components/ui/smooth-scroll-hero";
import { HeroStats } from "./HeroStats";
import heroImage from "@/assets/hero-img.avif";
import heroImageMobile from "@/assets/hero-img-responsive-mobile.jpg";

const SCROLL_HEIGHT = 1200;

export function HeroSection() {
  const { scrollY } = useScroll();
  const reduceMotion = useReducedMotion();

  // The clip is a square inset applied to both axes, so the same percentage
  // that frames the image nicely on a wide screen reduces it to a narrow
  // vertical strip on a phone. Start closer to full-bleed there.
  // Matches the md breakpoint where SmoothScrollHero swaps to the portrait
  // crop, so the framing and the image change over together.
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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
        desktopImage={heroImage}
        mobileImage={heroImageMobile}
        initialClipPercentage={isNarrow ? 5 : 14}
        finalClipPercentage={isNarrow ? 95 : 86}
      />

      {/* The counters take the same scroll height, so they arrive exactly as
          the frame finishes opening rather than at a guessed offset. */}
      <HeroStats scrollHeight={SCROLL_HEIGHT} />

      <motion.div
        style={reduceMotion ? undefined : { opacity, y }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-screen w-full items-center justify-center"
      >
        <div className="pointer-events-auto mx-auto max-w-3xl px-5 text-center sm:px-6">
          <p className="eyebrow text-white/70">For worship teams</p>

          {/* The line break is a desktop nicety; on a phone it would strand a
              word, so let the text wrap naturally there. */}
          <h1 className="mt-4 font-display text-[clamp(1.9rem,7.5vw,4.75rem)] font-normal leading-[1.05] text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.45)] sm:mt-5">
            Serving the Lord with
            <br className="hidden sm:inline" />{" "}
            Music made easier
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/80 drop-shadow sm:mt-6 sm:text-lg">
            Your hymnal, your service order, and the words on the screen —
            gathered into one place your whole team can use.
          </p>

          <div className="mt-7 flex flex-col items-stretch justify-center gap-2.5 xs:flex-row xs:items-center sm:mt-9 sm:gap-3">
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

          <p className="mt-5 text-xs text-white/70 drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)] sm:mt-6">
            Free for every church. No card required.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
