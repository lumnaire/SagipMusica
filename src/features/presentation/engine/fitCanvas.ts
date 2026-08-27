/**
 * Geometry for the slide canvas.
 *
 * Every slide is laid out in a fixed 1920x1080 reference space and then scaled
 * uniformly onto whatever it is being drawn into, so a font size means the
 * same thing on a laptop preview and on a sanctuary projector.
 */
export const REFERENCE_WIDTH = 1920;
export const REFERENCE_HEIGHT = 1080;

/**
 * The largest 1920x1080-shaped box that fits inside the container, and the
 * factor that maps reference pixels onto it.
 *
 * The previous version derived the height from the width alone and relied on
 * `max-height` to stop it overflowing. That clamped the height while leaving
 * the width at 100%, so in any container shorter than 9/16 of its width —
 * which is exactly the shape of the presenter's preview pane, and of a
 * projector that is not 16:9 — the box silently stopped being 16:9 while the
 * text carried on being sized for a box that was. Fitting against both axes
 * removes the contradiction rather than patching over it.
 *
 * Returns zeroes before the container has been measured; callers already treat
 * a zero scale as "not ready to draw".
 */
export function fitCanvas(containerWidth: number, containerHeight: number) {
  const fit = Math.min(
    containerWidth / REFERENCE_WIDTH,
    containerHeight / REFERENCE_HEIGHT,
  );
  if (!Number.isFinite(fit) || fit <= 0) return { width: 0, height: 0, scale: 0 };

  return {
    width: fit * REFERENCE_WIDTH,
    height: fit * REFERENCE_HEIGHT,
    scale: fit,
  };
}
