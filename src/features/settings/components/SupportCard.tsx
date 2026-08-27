import { Coffee, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BUY_ME_A_COFFEE_URL } from "@/lib/links";
import qrCode from "@/assets/qr-code-buymeacoffee.png";

/**
 * The donate panel, shown in Settings on both the web and the desktop build.
 *
 * It lives here, under the web app's src, rather than being written twice:
 * the desktop renderer imports the web components through the `@` alias, so
 * one file serves both and the QR code cannot drift out of step between them.
 *
 * Both a code and a link on purpose. On the desktop the QR is the useful one —
 * the app is running on a laptop plugged into a projector and the person
 * giving is holding their phone. On the web the button is, because the phone
 * is already the thing looking at the page. Neither is a fallback for the
 * other, so neither is hidden behind the other.
 */
export function SupportCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Coffee className="h-4 w-4 text-primary" />
          Support SagipMusica
        </CardTitle>
        <CardDescription>
          SagipMusica is free, and we intend to keep it that way. Hosting, the domain
          and the hours after work are what it costs to keep running — if this has
          helped your church, a little support goes a long way.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <figure className="mx-auto shrink-0 sm:mx-0">
          <div className="overflow-hidden rounded-lg border border-border bg-white p-2.5">
            <img
              src={qrCode}
              alt="Buy Me a Coffee QR code for supporting SagipMusica"
              className="h-auto w-40 max-w-full"
            />
          </div>
          <figcaption className="mt-2 text-center text-xs text-muted-foreground">
            Scan to give
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Cards, GCash, Maya and PayPal are all accepted — in pesos or in US
            dollars, so it works whether you are giving from here in the
            Philippines or from abroad.
          </p>

          <Button asChild className="w-full sm:w-auto sm:self-start">
            <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">
              <Coffee className="h-4 w-4" />
              Buy us a coffee
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
          </Button>

          {/* Spelled out as text as well as linked: on the desktop build this
              opens in a separate browser, and someone who wants to give from
              their phone needs to be able to read the address off the screen. */}
          <p className="break-all text-xs text-muted-foreground">
            buymeacoffee.com/lumnaire
          </p>

          <p className="text-xs text-muted-foreground">
            Thank you — every bit of it goes back into the app.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
