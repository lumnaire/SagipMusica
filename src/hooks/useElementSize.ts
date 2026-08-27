import { useEffect, useRef, useState } from "react";

export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    function measure() {
      const el = ref.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      // Bail when nothing moved: this runs from a ResizeObserver, and setting
      // state unconditionally would have it observe its own re-render.
      setSize((prev) =>
        prev.width === width && prev.height === height ? prev : { width, height },
      );
    }

    const observer = new ResizeObserver(measure);
    observer.observe(ref.current);
    measure();

    /**
     * Fullscreen needs its own listener.
     *
     * Entering and leaving fullscreen moves the element between the browser's
     * top layer and normal flow, and the resize observer is not a reliable
     * witness to that — it can report the old box, or not fire at all. The
     * symptom, which is what sent us looking: a presenter hits fullscreen and
     * comes back, and the slide is still scaled for a 1920px-wide screen
     * inside a windowed preview, with the text running off the right edge.
     *
     * Measuring on the event catches it where the observer does fire late;
     * measuring again on the next frame catches it where the browser has not
     * finished settling the layout by the time the event is dispatched.
     */
    function remeasureAfterFullscreen() {
      measure();
      requestAnimationFrame(measure);
    }

    document.addEventListener("fullscreenchange", remeasureAfterFullscreen);

    return () => {
      observer.disconnect();
      document.removeEventListener("fullscreenchange", remeasureAfterFullscreen);
    };
  }, []);

  return { ref, size };
}
