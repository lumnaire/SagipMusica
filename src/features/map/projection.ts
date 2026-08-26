import { WORLD_VIEW_BOX } from "./world-geometry";

/**
 * The Web Mercator projection the world outline was drawn with.
 *
 * This is the runtime half of a pair: scripts/generate-world-map.mjs used
 * exactly these formulas to turn Natural Earth's coastlines into the paths in
 * ./world-geometry.ts. Change one without the other and every pin drifts off
 * into the sea -- which is a silent failure, because a pin twenty miles out to
 * sea still looks like a pin.
 */

/** The projected plane is a square this many units on a side. */
export const WORLD_SIZE = 1000;

/** Mercator runs to infinity at the poles; the generator cuts here. */
const LAT_CLAMP = 84;

export interface Point {
  x: number;
  y: number;
}

export function project(lat: number, lng: number): Point {
  const phi = (Math.max(-LAT_CLAMP, Math.min(LAT_CLAMP, lat)) * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * WORLD_SIZE,
    y: (WORLD_SIZE / 2) * (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI),
  };
}

export function unproject(x: number, y: number): { lat: number; lng: number } {
  const merc = (1 - (2 * y) / WORLD_SIZE) * Math.PI;
  return {
    lat: ((2 * Math.atan(Math.exp(merc)) - Math.PI / 2) * 180) / Math.PI,
    lng: (x / WORLD_SIZE) * 360 - 180,
  };
}

/**
 * A rectangle of the projected plane, which is what an SVG viewBox is and what
 * pan and zoom actually manipulate.
 */
export interface View {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const WORLD_VIEW: View = { ...WORLD_VIEW_BOX };

export function viewBoxAttr(view: View): string {
  return `${view.x} ${view.y} ${view.width} ${view.height}`;
}

/**
 * The tightest zoom offered.
 *
 * A twelfth of the world is roughly "the Philippines fills the frame", which
 * is as far in as the data can honestly support: the pins are province
 * centroids, so zooming past the province itself is showing precision that
 * isn't there. It is also about where the 1:50m coastline starts to look like
 * the polygon it is.
 */
const MIN_VIEW_WIDTH = WORLD_SIZE / 12;

/**
 * Keeps a view inside the drawing and the right shape for its container.
 *
 * Height follows from width and the container's aspect ratio rather than being
 * tracked separately, so a resize re-frames the map instead of stretching it.
 * Everything is then clamped back inside the world; without that, a drag at
 * full zoom-out sails off into blank space and there is no way back except
 * reloading.
 */
export function clampView(view: View, aspect: number): View {
  const maxWidth = Math.min(
    WORLD_VIEW.width,
    // A tall, narrow container (a phone) cannot show the full width and the
    // full height at once. Whichever runs out first sets the limit.
    WORLD_VIEW.height * aspect,
  );
  const width = Math.min(Math.max(view.width, MIN_VIEW_WIDTH), maxWidth);
  const height = width / aspect;

  return {
    width,
    height,
    x: Math.min(Math.max(view.x, WORLD_VIEW.x), WORLD_VIEW.x + WORLD_VIEW.width - width),
    y: Math.min(Math.max(view.y, WORLD_VIEW.y), WORLD_VIEW.y + WORLD_VIEW.height - height),
  };
}

/**
 * The view that frames a set of points, with room around them.
 *
 * Used to open the map on wherever the churches actually are rather than on
 * the mid-Atlantic. With one pin there is no extent to fit, so it falls back to
 * a fixed regional window centred on it -- fitting a single point exactly would
 * zoom to maximum on one province and show nothing else at all.
 */
export function fitPoints(points: Point[], aspect: number, padding = 0.35): View {
  if (points.length === 0) return clampView(WORLD_VIEW, aspect);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const centreX = (minX + maxX) / 2;
  const centreY = (minY + maxY) / 2;

  // Width has to cover the horizontal extent AND the vertical extent once the
  // aspect ratio is applied, or a tall cluster gets cropped top and bottom.
  const width = Math.max(spanX, spanY * aspect, MIN_VIEW_WIDTH * 1.6) * (1 + padding);

  return clampView(
    { x: centreX - width / 2, y: centreY - width / aspect / 2, width, height: width / aspect },
    aspect,
  );
}

/** Zooms by `factor` about a point given in 0..1 of the container. */
export function zoomView(
  view: View,
  factor: number,
  anchorU: number,
  anchorV: number,
  aspect: number,
): View {
  const anchorX = view.x + anchorU * view.width;
  const anchorY = view.y + anchorV * view.height;
  const next = clampView(
    { ...view, width: view.width / factor, height: view.height / factor },
    aspect,
  );
  // Re-anchor after clamping, so hitting the zoom limit does not also shift the
  // map sideways.
  return clampView(
    {
      ...next,
      x: anchorX - anchorU * next.width,
      y: anchorY - anchorV * next.height,
    },
    aspect,
  );
}
