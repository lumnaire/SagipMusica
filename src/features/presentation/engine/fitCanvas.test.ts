import { describe, expect, it } from "vitest";
import { fitCanvas } from "./fitCanvas";

/** 16:9 to within a rounding error. */
function ratio({ width, height }: { width: number; height: number }) {
  return Number((width / height).toFixed(4));
}

describe("fitCanvas", () => {
  it("fills a container that is already 16:9", () => {
    const box = fitCanvas(1920, 1080);
    expect(box).toEqual({ width: 1920, height: 1080, scale: 1 });
  });

  it("letterboxes a container that is too tall", () => {
    const box = fitCanvas(1600, 1200);
    expect(box.width).toBe(1600);
    expect(box.height).toBe(900);
    expect(ratio(box)).toBe(ratio({ width: 16, height: 9 }));
  });

  it("pillarboxes a container that is too short — the bug this fixes", () => {
    // The presenter's preview pane: wide and short. The old code kept the
    // full 1060 width, clamped the height, and went on scaling text as though
    // the box were 1060x596 — which is how the words ended up off the edge.
    const box = fitCanvas(1060, 520);

    expect(box.height).toBe(520);
    expect(box.width).toBeCloseTo(924.44, 1);
    expect(ratio(box)).toBe(ratio({ width: 16, height: 9 }));
    // Never wider than what it was given.
    expect(box.width).toBeLessThanOrEqual(1060);
  });

  it("scales text against the box it actually drew, not the container", () => {
    // A stale 1920-wide measurement in a 1060-wide pane was the other half of
    // the bug: scale must fall out of the fitted box every time.
    const box = fitCanvas(1060, 520);
    expect(box.scale).toBeCloseTo(520 / 1080, 5);
    expect(box.width * box.scale).toBeCloseTo(box.width * box.scale, 5);
  });

  it("reports nothing to draw before the container has been measured", () => {
    for (const box of [fitCanvas(0, 0), fitCanvas(1920, 0), fitCanvas(0, 1080)]) {
      expect(box).toEqual({ width: 0, height: 0, scale: 0 });
    }
  });

  it("survives a container with no layout at all", () => {
    expect(fitCanvas(Number.NaN, Number.NaN)).toEqual({ width: 0, height: 0, scale: 0 });
    expect(fitCanvas(-100, -100)).toEqual({ width: 0, height: 0, scale: 0 });
  });
});
