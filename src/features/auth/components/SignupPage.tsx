import { useState, type FormEvent } from "react";
import { Navigate, Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleIcon } from "@/components/icons/google-icon";
import { AuthLayout } from "./AuthLayout";

export function SignupPage() {
  const { status, signUp, signInWithOAuth, resendVerification } = useAuthStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const { error, needsVerification } = await signUp(email, password, name);
    setSubmitting(false);
    if (error) {
      setFormError(error);
      return;
    }
    if (needsVerification) {
      setPendingEmail(email);
    }
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

  async function handleResend() {
    if (!pendingEmail) return;
    setResending(true);
    const { error } = await resendVerification(pendingEmail);
    setResending(false);
    if (error) {
      setFormError(error);
      return;
    }
    setResent(true);
  }

  if (pendingEmail) {
    return (
      <AuthLayout title="SagipMusica" subtitle="You're almost there.">
        <Card className="border-white/10 bg-card/95 shadow-2xl backdrop-blur-sm">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Check your email</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We sent a verification link to <span className="font-medium">{pendingEmail}</span>.
                Click it to activate your account.
              </p>
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={resending || resent}
              onClick={handleResend}
            >
              {resent ? "Email resent" : resending ? "Resending..." : "Resend email"}
            </Button>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="SagipMusica"
      subtitle="Create your account and get your church's worship dashboard."
    >
      <Card className="border-white/10 bg-card/95 shadow-2xl backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="font-display text-2xl">Create an account</CardTitle>
          <CardDescription>Start serving the Lord with music, made easier.</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
              />
            </div>
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
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </div>
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="font-medium text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="font-medium text-primary hover:underline">
              Privacy Policy
            </Link>

          </p>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
