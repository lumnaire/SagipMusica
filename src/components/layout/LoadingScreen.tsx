import { Music } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Music className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-sm">Loading...</p>
      </div>
    </div>
  );
}
