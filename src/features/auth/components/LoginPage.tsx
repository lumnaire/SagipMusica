import { useState, type FormEvent } from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/icons/google-icon";
import { landingPathFor } from "@/lib/auth-routing";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { status, profile, signIn, signInWithOAuth, error: authError } = useAuthStore();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (status === "authenticated") {
    // A superadmin has no church, so send them to their own dashboard
    // rather than through the church onboarding gate.
    const redirectTo =
      (location.state as { from?: string } | null)?.from ?? landingPathFor(profile);
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setFormError(error);
  }

  async function handleGoogle() {
    setFormError(null);
    setGoogleSubmitting(true);
    const { error } = await signInWithOAuth("google");
    if (error) {
      setFormError(error);
      setGoogleSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="SagipMusica"
      subtitle="Sign in to manage your church's hymnal and lead worship."
    >
      <Card className="border-white/10 bg-card/95 shadow-2xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
          <CardDescription>Enter your credentials to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* An OAuth attempt that could not resolve the account comes back
              here with an empty form, so this sits outside it -- otherwise the
              bounce is silent and looks like the sign-in simply did nothing. */}
          {authError && !formError && (
            <p
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {authError}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={googleSubmitting}
            onClick={handleGoogle}
          >
            <GoogleIcon className="h-4 w-4" />
            {googleSubmitting ? "Redirecting..." : "Continue with Google"}
          </Button>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@church.org"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-muted-foreground">
            <Link to="/terms" className="hover:underline">
              Terms
            </Link>
            {" · "}
            <Link to="/privacy" className="hover:underline">
              Privacy
            </Link>
            {" · "}
            <Link to="/cookies" className="hover:underline">
              Cookies
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
