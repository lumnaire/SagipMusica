import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useConsentStore } from "@/stores/consent-store";
import { LegalLayout } from "./LegalLayout";

export function CookiePolicyPage() {
  const openCustomize = useConsentStore((s) => s.openCustomize);

  return (
    <LegalLayout
      title="Cookie Policy"
      summary="What SagipMusica stores on your device, and how to change it."
    >
      <h2>The short version</h2>
      <p>
        SagipMusica stores the minimum needed to keep you signed in. We don't
        use advertising cookies, and we don't currently run analytics. Anything
        optional is off until you turn it on.
      </p>

      <div className="my-6 not-prose">
        <Button onClick={openCustomize}>Change your cookie preferences</Button>
      </div>

      <h2>What we store</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Purpose</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>sb-…-auth-token</code>
            </td>
            <td>
              Keeps you signed in between page loads, so you don't have to log
              in again on every screen. Set by our authentication provider,
              Supabase.
            </td>
            <td>Strictly necessary</td>
          </tr>
          <tr>
            <td>
              <code>sagipmusica.cookie-consent</code>
            </td>
            <td>
              Remembers the choice you made on the cookie banner, so we stop
              asking.
            </td>
            <td>Strictly necessary</td>
          </tr>
        </tbody>
      </table>
      <p>
        Both are stored in your browser's local storage rather than as
        traditional cookies. They stay on your device until you sign out, clear
        your browser data, or delete your account.
      </p>

      <h2>The categories</h2>
      <h3>Strictly necessary</h3>
      <p>
        Required for the service to work at all — signing in, staying signed
        in, and remembering your cookie choice. These can't be switched off,
        because without them you couldn't use SagipMusica.
      </p>

      <h3>Preferences</h3>
      <p>
        Remembers interface choices between visits. Off unless you allow it.
      </p>

      <h3>Analytics</h3>
      <p>
        Would help us see which features churches actually use, so we know what
        to improve.{" "}
        <strong>We don't run any analytics today.</strong> The setting exists so
        that if we ever add it, your answer already applies and nothing loads
        without your permission.
      </p>

      <h2>Signing in with Google</h2>
      <p>
        If you choose “Continue with Google”, Google sets its own cookies on its
        own domains as part of signing you in. We don't control those, and they
        are covered by Google's privacy policy rather than ours. You can avoid
        them entirely by signing up with an email address and password instead.
      </p>

      <h2>Controlling storage in your browser</h2>
      <p>
        Every major browser lets you view, block, and clear cookies and site
        data in its settings. Blocking storage for SagipMusica will sign you out
        and keep you from signing back in, because the sign-in token has
        nowhere to live.
      </p>

      <h2>Changes</h2>
      <p>
        If we add anything that stores data on your device, we'll update this
        page and ask you again. See also our{" "}
        <Link to="/privacy">Privacy Policy</Link> and{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalLayout>
  );
}
