import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import sagipmusicaLogo from "@/assets/sagipmusica-logo.png";

export function MarketingNav() {
  // Transparent over the hero image, then settles onto the page once the
  // reader has scrolled past it.
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={sagipmusicaLogo} alt="" className="h-8 w-8 object-contain" />
          <span className="font-display text-lg text-white">SagipMusica</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            asChild
            variant="ghost"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
