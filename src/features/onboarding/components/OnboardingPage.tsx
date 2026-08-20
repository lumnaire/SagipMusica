import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useChurchStore } from "@/stores/church-store";
import { createChurchAndClaim } from "@/features/onboarding/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FloatingPathsBackground } from "@/components/ui/floating-paths";
import { REFERRAL_SOURCE_LABELS, type ReferralSource } from "@/types/database";
import { cn } from "@/lib/utils";
import sagipmusicaLogo from "@/assets/sagipmusica-logo.png";

const REFERRAL_OPTIONS = Object.entries(REFERRAL_SOURCE_LABELS) as [ReferralSource, string][];

export function OnboardingPage() {
  const { session, profile, refreshProfile, signOut } = useAuthStore();
  const loadChurch = useChurchStore((s) => s.loadChurch);
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [churchName, setChurchName] = useState("");
  const [referralSource, setReferralSource] = useState<ReferralSource | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile?.church_id) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleStep1(e: FormEvent) {
    e.preventDefault();
    if (!churchName.trim()) return;
    setStep(2);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault();
    if (!referralSource || !session) return;
    setSubmitting(true);
    setError(null);
    try {
      const church = await createChurchAndClaim(churchName.trim(), referralSource);
      await refreshProfile();
      await loadChurch(church.id);
    } catch (err) {
      setSubmitting(false);
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Something went wrong. Please try again.";
      setError(message);
    }
  }

  return (
    <FloatingPathsBackground
      position={-1}
      className="flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12"
    >
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <img src={sagipmusicaLogo} alt="SagipMusica" className="h-14 w-14 object-contain" />
          <div className="flex items-center gap-2" aria-label={`Step ${step} of 2`}>
            {[1, 2].map((n) => (
              <span
                key={n}
                className={cn(
                  "h-1 w-8 rounded-full transition-colors",
                  n <= step ? "bg-primary" : "bg-border",
                )}
              />
            ))}
          </div>
          <p className="eyebrow">Step {step} of 2</p>
        </div>

        {step === 1 ? (
          <Card className="border-border/70 bg-card/90 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                What's your church called?
              </CardTitle>
              <CardDescription>
                We'll name your worship dashboard after it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleStep1}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="church-name">Church name</Label>
                  <Input
                    id="church-name"
                    required
                    autoFocus
                    value={churchName}
                    onChange={(e) => setChurchName(e.target.value)}
                    placeholder="e.g. Grace Community Church"
                  />
                </div>
                <Button type="submit" className="mt-2">
                  Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/70 bg-card/90 shadow-xl backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="font-display text-2xl">
                Where did you hear about SagipMusica?
              </CardTitle>
              <CardDescription>This helps us know where to focus.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-4" onSubmit={handleStep2}>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="referral-source">Referral source</Label>
                  <Select
                    value={referralSource}
                    onValueChange={(v) => setReferralSource(v as ReferralSource)}
                  >
                    <SelectTrigger id="referral-source">
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERRAL_OPTIONS.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={submitting}
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button type="submit" className="flex-1" disabled={!referralSource || submitting}>
                    {submitting ? "Setting up..." : "Finish"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Not you? Sign out
          </button>
        </div>
      </div>
    </FloatingPathsBackground>
  );
}
