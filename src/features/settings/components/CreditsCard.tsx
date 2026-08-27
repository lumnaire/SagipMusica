import type { ReactNode } from "react";
import { Code2, ExternalLink, Heart } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DEVELOPER, FBC_FACEBOOK_URL, LUMNAIRE_FACEBOOK_URL } from "@/lib/links";
import lumnaireLogo from "@/assets/lumnaire_logo.png";

interface CreditsCardProps {
  /**
   * Build-specific facts to list underneath — the desktop passes its version
   * and the path to the database file. Rendered as a definition list, so pass
   * <CreditsRow> children rather than arbitrary markup.
   */
  children?: ReactNode;
}

/**
 * Who made this. Shown in Settings on both builds; see SupportCard for why a
 * shared component rather than one per build.
 */
export function CreditsCard({ children }: CreditsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Code2 className="h-4 w-4 text-primary" />
          Credits
        </CardTitle>
        <CardDescription>
          Who builds SagipMusica, and who it was built for.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <img
            src={lumnaireLogo}
            alt=""
            className="mt-0.5 h-10 w-10 shrink-0 rounded-md object-contain"
          />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Developed by</p>
            <p className="text-base font-semibold text-foreground">{DEVELOPER.name}</p>
            <p className="text-sm text-muted-foreground">{DEVELOPER.title}</p>
            <a
              href={LUMNAIRE_FACEBOOK_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Lumnaire
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        <p className="flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
          <Heart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            Built for the worship teams who run the words on a Sunday — first for{" "}
            <a
              href={FBC_FACEBOOK_URL}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Fundamental Baptist Church
            </a>
            , and now for every church using it.
          </span>
        </p>

        {children && (
          <dl className="space-y-3 border-t border-border pt-4 text-sm">{children}</dl>
        )}
      </CardContent>
    </Card>
  );
}

/** One fact in the CreditsCard's build-specific list. */
export function CreditsRow({
  label,
  children,
  stacked = false,
}: {
  label: string;
  children: ReactNode;
  /** For long values — a filesystem path — that need the full width. */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="flex flex-col gap-1">
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{children}</dd>
      </div>
    );
  }

  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
