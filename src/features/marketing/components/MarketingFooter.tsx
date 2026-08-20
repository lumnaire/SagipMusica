import { Link } from "react-router-dom";
import {
  FacebookIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/icons/social-icons";
import { useConsentStore } from "@/stores/consent-store";
import sagipmusicaLogo from "@/assets/sagipmusica-logo.png";

const SOCIALS = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/lumnaireph",
    Icon: FacebookIcon,
  },
  { name: "X", href: "https://x.com/Lumnaire_coding", Icon: XIcon },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/lumnaire",
    Icon: LinkedInIcon,
  },
];

export function MarketingFooter() {
  const openCustomize = useConsentStore((s) => s.openCustomize);

  return (
    <footer className="border-t border-border bg-background py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={sagipmusicaLogo} alt="" className="h-7 w-7 object-contain" />
              <span className="font-display text-lg text-foreground">SagipMusica</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A hymnal, a service order, and a projector — in one place for
              your church.
            </p>

            <div className="mt-5">
              <p className="text-xs text-muted-foreground">Follow our socials</p>
              <ul className="mt-2.5 flex items-center gap-2">
                {SOCIALS.map(({ name, href, Icon }) => (
                  <li key={name}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`SagipMusica on ${name}`}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <nav className="flex gap-16" aria-label="Footer">
            <div>
              <h2 className="eyebrow">Product</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/signup" className="text-muted-foreground hover:text-foreground">
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-muted-foreground hover:text-foreground">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="eyebrow">Legal</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className="text-muted-foreground hover:text-foreground">
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={openCustomize}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Cookie settings
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="eyebrow">Contact</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <a
                    href="https://www.facebook.com/lumnaireph"
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Lumnaire on Facebook
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="staff-rule mt-12 opacity-50" aria-hidden="true" />

        <p className="mt-6 text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} SagipMusica. Built by Lumnaire.
        </p>
      </div>
    </footer>
  );
}
