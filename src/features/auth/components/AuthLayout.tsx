import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import sagipmusicaLogo from "@/assets/sagipmusica-logo1.png";
import lumnaireLogo from "@/assets/lumnaire_logo.png";
import show1 from "@/assets/show1.jpg";
import show2 from "@/assets/show2.jpg";
import show3 from "@/assets/show3.jpg";
import show4 from "@/assets/show4.jpg";
import show5 from "@/assets/show5.jpg";
import show6 from "@/assets/show6.jpg";
import show7 from "@/assets/show7.jpg";
import show8 from "@/assets/show8.jpg";

const BACKGROUND_IMAGES = [show1, show2, show3, show4, show5, show6, show7, show8];
const SLIDE_DURATION_MS = 6000;

function BackgroundCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BACKGROUND_IMAGES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {BACKGROUND_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1800 ease-in-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/55 to-black/75" />
    </div>
  );
}

function PoweredByLumnaire() {
  return (
    <div className="absolute inset-x-0 bottom-5 flex justify-center">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-1.5 backdrop-blur-sm">
        <img src={lumnaireLogo} alt="Lumnaire" className="h-4 w-4 rounded-sm" />
        <span className="text-xs font-medium text-white/70">Powered by Lumnaire</span>
      </div>
    </div>
  );
}

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <BackgroundCarousel />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2.5 text-center">
          <Link to="/" className="transition-opacity hover:opacity-80">
            <img
              src={sagipmusicaLogo}
              alt="SagipMusica — back to home"
              className="h-16 w-16 object-contain drop-shadow-lg"
            />
          </Link>
          <h1 className="font-display text-3xl text-white drop-shadow-sm">{title}</h1>
          <p className="max-w-xs text-sm leading-relaxed text-white/75">{subtitle}</p>
        </div>

        {children}
      </div>

      <PoweredByLumnaire />
    </div>
  );
}
