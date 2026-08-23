import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import sagipmusicaLogo from "@/assets/sagipmusica-logo1.png";

/**
 * @param solid Forces the filled bar. Pages without a dark hero behind the
 * nav (the legal pages) need it, or the white wordmark sits on ivory.
 */
export function MarketingNav({ solid = false }: { solid?: boolean }) {
  // Transparent over the hero video, then settles onto the page once the
  // reader has scrolled past it.
  const [hasScrolled, setHasScrolled] = useState(false);
  const scrolled = solid || hasScrolled;

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setHasScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  return (
    // The nav stays light-on-dark the whole way down: the hero is a tall dark
    // field, so switching to a light bar partway through it read as a glitch.
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/10 bg-sidebar/90 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img src={sagipmusicaLogo} alt="SagipMusica" className="h-8 w-8 shrink-0 object-contain" />
          {/* Wordmark drops below `xs`, where it would crowd the actions. */}
          <span className="hidden font-display text-lg text-white xs:inline">
            SagipMusica
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/15 hover:text-white sm:h-10 sm:px-4"
          >
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="sm:h-10 sm:px-4">
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
