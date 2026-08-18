import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { PresentationChannel } from "@/features/presentation/engine/channel";
import { SlideCanvas } from "./SlideCanvas";
import { useFullscreen } from "@/hooks/useFullscreen";
import { DEFAULT_PRESENTATION_STYLE } from "@/types/presentation";
import type { PresentationBroadcastState } from "@/types/presentation";

/**
 * Dedicated projector output. No admin chrome, no navigation — this is the
 * only thing that should ever be shown on the sanctuary screen. It knows
 * nothing about Supabase; it just renders whatever the presenter broadcasts.
 */
export function ProjectorView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const rootRef = useRef<HTMLDivElement>(null);
  const { toggle, exit } = useFullscreen(rootRef);
  const [state, setState] = useState<PresentationBroadcastState | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const channel = new PresentationChannel(sessionId);
    const unsubscribe = channel.subscribe((message) => {
      if (message.type === "presentation-state") {
        setState(message);
      }
    });
    channel.send({ type: "projector-hello", sessionId });
    return () => {
      unsubscribe();
      channel.close();
    };
  }, [sessionId]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggle();
      } else if (e.key === "Escape") {
        exit();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle, exit]);

  const slide = state ? state.slides[state.currentIndex] ?? null : null;

  return (
    <div ref={rootRef} className="fixed inset-0 bg-black">
      <SlideCanvas
        slide={slide}
        style={state?.style ?? DEFAULT_PRESENTATION_STYLE}
        black={state?.displayMode === "black"}
        blank={state?.displayMode === "blank"}
      />
    </div>
  );
}
