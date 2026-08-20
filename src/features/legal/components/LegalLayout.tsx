import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MarketingNav } from "@/features/marketing/components/MarketingNav";
import { MarketingFooter } from "@/features/marketing/components/MarketingFooter";

/** Shared date for all three documents, so they stay in step. */
export const LEGAL_LAST_UPDATED = "21 August 2026";

interface LegalLayoutProps {
  title: string;
  summary: string;
  children: ReactNode;
}

export function LegalLayout({ title, summary, children }: LegalLayoutProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-svh bg-background">
      <MarketingNav solid />

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-28">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <header className="mt-8">
          <h1 className="font-display text-4xl leading-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{summary}</p>
          <p className="eyebrow mt-6">Last updated {LEGAL_LAST_UPDATED}</p>
        </header>

        <div className="staff-rule my-10 opacity-60" aria-hidden="true" />

        <div className="legal-prose">{children}</div>

        <div className="mt-16 rounded-lg border border-border bg-secondary/40 p-5">
          <p className="text-sm text-muted-foreground">
            Questions about this page?{" "}
            <a
              href="https://www.facebook.com/lumnaireph"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Message Lumnaire on Facebook
            </a>{" "}
            and we'll answer.
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
