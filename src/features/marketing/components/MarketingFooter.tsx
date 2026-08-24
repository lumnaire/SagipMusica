import { Link } from "react-router-dom";
import {
  FacebookIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/icons/social-icons";
import { useConsentStore } from "@/stores/consent-store";
import sagipmusicaLogo from "@/assets/sagipmusica-logo1.png";

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

/** Shared by every footer link, so the three columns stay in step. */
const LINK_CLASS =
  "text-muted-foreground transition-colors hover:text-foreground";

export function MarketingFooter() {
  const openCustomize = useConsentStore((s) => s.openCustomize);

  return (
    <footer className="border-t border-border bg-background py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-col gap-9 md:flex-row md:justify-between md:gap-8 lg:gap-10">
          <div className="md:max-w-[14rem] lg:max-w-xs">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src={sagipmusicaLogo}
                alt=""
                className="h-6 w-6 shrink-0 object-contain sm:h-7 sm:w-7"
              />
              <span className="font-display text-base text-foreground sm:text-lg">
                SagipMusica
              </span>
            </Link>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              A hymnal, a service order, and a projector — in one place for
              your church.
            </p>

            <div className="mt-5">
              <p className="text-[0.6875rem] text-muted-foreground sm:text-xs">
                Follow our socials
              </p>
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

          {/* Three columns beside the blurb only fit from `md`. Below that the
              labels wrap a word per line — so a phone gets two columns under
              the blurb, a tablet gets three, and the row waits for the room. */}
          <nav
            className="grid grid-cols-2 gap-x-6 gap-y-8 xs:gap-x-10 sm:grid-cols-3 sm:gap-x-8 md:flex md:gap-8 lg:gap-14"
            aria-label="Footer"
          >
            <div>
              <h2 className="eyebrow text-[0.6875rem] sm:text-xs">Product</h2>
              <ul className="mt-3.5 space-y-2.5 text-xs sm:mt-4 sm:text-sm">
                <li>
                  <Link to="/download" className={LINK_CLASS}>
                    Download for Windows
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className={LINK_CLASS}>
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link to="/login" className={LINK_CLASS}>
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="eyebrow text-[0.6875rem] sm:text-xs">Legal</h2>
              <ul className="mt-3.5 space-y-2.5 text-xs sm:mt-4 sm:text-sm">
                <li>
                  <Link to="/terms" className={LINK_CLASS}>
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className={LINK_CLASS}>
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className={LINK_CLASS}>
                    Cookie Policy
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={openCustomize}
                    className={`text-left ${LINK_CLASS}`}
                  >
                    Cookie settings
                  </button>
                </li>
              </ul>
            </div>

            {/* Odd one out of the phone's two-column grid, so it takes its own
                full-width row rather than sitting in a half-empty one. From
                `sm` there are three columns and it sits in the third. */}
            <div className="col-span-2 sm:col-span-1">
              <h2 className="eyebrow text-[0.6875rem] sm:text-xs">Contact</h2>
              <ul className="mt-3.5 space-y-2.5 text-xs sm:mt-4 sm:text-sm">
                <li>
                  <a
                    href="mailto:connect@lumnaire.com"
                    className={`break-all ${LINK_CLASS}`}
                  >
                    connect@lumnaire.com
                  </a>
                </li>
                <li>
                  <a href="tel:+639489664935" className={LINK_CLASS}>
                    +63 948 966 4935
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="staff-rule mt-10 opacity-50 sm:mt-12" aria-hidden="true" />

        <p className="mt-5 text-[0.6875rem] text-muted-foreground sm:mt-6 sm:text-xs">
          &copy; {new Date().getFullYear()} SagipMusica. Built by Lumnaire.
        </p>
      </div>
    </footer>
  );
}
