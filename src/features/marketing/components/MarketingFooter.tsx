import { Link } from "react-router-dom";
import sagipmusicaLogo from "@/assets/sagipmusica-logo.png";

export function MarketingFooter() {
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
