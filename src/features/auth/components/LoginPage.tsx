import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import churchLogo from "@/assets/church-logo-no-bg.png";
import lumnaireLogo from "@/assets/lumnaire_logo.png";
import show1 from "@/assets/show1.jpg";
import show2 from "@/assets/show2.jpg";
import show3 from "@/assets/show3.jpg";
import show4 from "@/assets/show4.jpg";
import show5 from "@/assets/show5.jpg";
import show6 from "@/assets/show6.jpg";
import show7 from "@/assets/show7.jpg";
import show8 from "@/assets/show8.jpg";

const BACKGROUND_IMAGES = [show1, show2, show3, show4, show5, show6, show7, show8];
const SLIDE_DURATION_MS = 6000;

function BackgroundCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BACKGROUND_IMAGES.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-neutral-900">
      {BACKGROUND_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1800 ease-in-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/55 to-black/75" />
    </div>
  );
}

function PoweredByLumnaire() {
  return (
    <div className="absolute inset-x-0 bottom-5 flex justify-center">
      <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3.5 py-1.5 backdrop-blur-sm">
        <img src={lumnaireLogo} alt="Lumnaire" className="h-4 w-4 rounded-sm" />
        <span className="text-xs font-medium text-white/70">Powered by Lumnaire</span>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { status, signIn } = useAuthStore();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (status === "authenticated") {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard";
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

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <BackgroundCarousel />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <img
            src={churchLogo}
            alt="Fundamental Baptist Church Catanduanes"
            className="h-24 w-24 object-contain drop-shadow-lg"
          />
          <h1 className="text-2xl font-semibold text-white">Worship Presenter</h1>
          <p className="text-sm text-white/75">
            Sign in to manage your church's hymnal and lead worship.
          </p>
        </div>

        <Card className="border-white/10 bg-card/95 shadow-2xl backdrop-blur-sm">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your credentials to continue.</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Input
                  id="password"
                  type="password"
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
          </CardContent>
        </Card>
      </div>

      <PoweredByLumnaire />
    </div>
  );
}
