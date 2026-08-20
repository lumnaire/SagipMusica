import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import qrCode from "@/assets/qrcode.jpg";

const FACEBOOK_URL = "https://www.facebook.com/lumnaireph";

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
            Scan this InstaPay code with your bank or e-wallet app. Any amount
            helps cover hosting and keeps SagipMusica free for churches.
          </DialogDescription>
        </DialogHeader>

        <figure className="mt-2">
          <div className="overflow-hidden rounded-lg border border-border bg-white p-3">
            <img
              src={qrCode}
              alt="InstaPay QR code for sending a gift to SagipMusica"
              className="mx-auto h-auto w-full max-w-[260px]"
            />
          </div>
          <figcaption className="mt-3 text-center text-xs text-muted-foreground">
            Works with any InstaPay-enabled bank or e-wallet in the Philippines.
          </figcaption>
        </figure>

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
