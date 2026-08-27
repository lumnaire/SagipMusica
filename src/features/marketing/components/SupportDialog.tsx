import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import qrCode from "@/assets/qr-code-buymeacoffee.png";

const FACEBOOK_URL = "https://www.facebook.com/lumnaireph";
const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/lumnaire";

export function SupportDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="mt-6 self-start">
          Support the project
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            Thank you for giving
          </DialogTitle>
          <DialogDescription>
            Scan the code or tap the button below to support SagipMusica. Any amount helps cover hosting, maintenance, and development while keeping SagipMusica free for churches.
          </DialogDescription>
        </DialogHeader>

        <figure className="mt-2">
          <div className="overflow-hidden rounded-lg border border-border bg-white p-3">
            <img
              src={qrCode}
              alt="Buy Me a Coffee QR code for sending a gift to SagipMusica"
              className="mx-auto h-auto w-full max-w-65"
            />
          </div>
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">
            Cards, GCash, Maya, and PayPal are accepted — in pesos or US
            dollars.
          </figcaption>
        </figure>

        <Button asChild className="w-full">
          <a href={BUY_ME_A_COFFEE_URL} target="_blank" rel="noreferrer">
            Donate ❤️
          </a>
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Prefer to give another way?{" "}
          <a
            href={FACEBOOK_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Message us
          </a>
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}
