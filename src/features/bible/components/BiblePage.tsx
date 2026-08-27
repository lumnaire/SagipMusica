import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { useBibleStore } from "@/stores/bible-store";
import { BibleBrowser } from "./BibleBrowser";
import { encodeReference } from "../reference";

/**
 * The Bible, as a place you can go. Find a passage and put it on the screen —
 * the same picker the presenter gets mid-service, with room to read.
 */
export function BiblePage() {
  const navigate = useNavigate();
  const translationId = useBibleStore((s) => s.translationId);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Bible</h1>
          <p className="text-sm text-muted-foreground">
            Look up a passage and present it. Type a reference like{" "}
            <span className="font-medium text-foreground">John 3:16</span>, or search for the
            words you remember.
          </p>
        </div>

        <BibleBrowser
          onPresent={(reference) =>
            navigate(
              `/presentation/${crypto.randomUUID()}?type=scripture` +
                `&ref=${encodeReference(reference)}&translation=${translationId}`,
            )
          }
        />
      </div>
    </AppShell>
  );
}
