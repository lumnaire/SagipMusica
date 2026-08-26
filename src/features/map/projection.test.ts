import { describe, expect, it } from "vitest";
import { clampView, fitPoints, project, unproject, WORLD_SIZE } from "./projection";
import { WORLD_SHAPES, WORLD_VIEW_BOX } from "./world-geometry";

/**
 * The pins and the coastline are drawn by two different pieces of code -- this
 * module at runtime, scripts/generate-world-map.mjs at build time -- using the
 * same formulas by hand. If they ever drift apart, every pin quietly moves out
 * to sea and nothing throws. These tests are the thing that would notice.
 */
describe("projection", () => {
  it("puts the origin in the middle and the date line at the edges", () => {
    expect(project(0, 0)).toEqual({ x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 });
    expect(project(0, -180).x).toBe(0);
    expect(project(0, 180).x).toBe(WORLD_SIZE);
  });

  it("round-trips through unproject", () => {
    for (const [lat, lng] of [
      [14.6, 121.0],
      [-33.87, 151.21],
      [51.5, -0.13],
      [0, 0],
    ]) {
      const { x, y } = project(lat, lng);
      const back = unproject(x, y);
      expect(back.lat).toBeCloseTo(lat, 6);
      expect(back.lng).toBeCloseTo(lng, 6);
    }
  });

  it("clamps beyond the Mercator cutoff instead of running to infinity", () => {
    expect(Number.isFinite(project(90, 0).y)).toBe(true);
    expect(Number.isFinite(project(-90, 0).y)).toBe(true);
  });

  /**
   * The real check: a coordinate that is inside a country must land inside
   * that country's drawn outline. Bounding boxes rather than point-in-polygon,
   * which is enough to catch a projection that has been changed on one side
   * only -- any such change moves a pin by tens of units, not fractions.
   */
  it("lands capital cities inside their country's drawn shape", () => {
    const cases: [string, number, number][] = [
      ["PH", 14.6, 121.0], // Manila
      ["PH", 7.07, 125.61], // Davao
      ["TH", 13.75, 100.5], // Bangkok
      ["BD", 23.81, 90.41], // Dhaka
      ["AE", 25.2, 55.27], // Dubai
      ["IN", 28.61, 77.21], // New Delhi
      ["AU", -33.87, 151.21], // Sydney
      ["GB", 51.5, -0.13], // London
      ["KE", -1.29, 36.82], // Nairobi
      ["BR", -23.55, -46.63], // Sao Paulo
    ];

    for (const [id, lat, lng] of cases) {
      const shape = WORLD_SHAPES.find((s) => s.id === id);
      expect(shape, `no shape for ${id}`).toBeDefined();

      const numbers = shape!.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < numbers.length; i += 2) {
        xs.push(numbers[i]);
        ys.push(numbers[i + 1]);
      }

      const { x, y } = project(lat, lng);
      expect(x, `${id} x`).toBeGreaterThanOrEqual(Math.min(...xs));
      expect(x, `${id} x`).toBeLessThanOrEqual(Math.max(...xs));
      expect(y, `${id} y`).toBeGreaterThanOrEqual(Math.min(...ys));
      expect(y, `${id} y`).toBeLessThanOrEqual(Math.max(...ys));
    }
  });
});

/**
 * The generated geometry's own invariants.
 *
 * `key` exists because `id` is NOT unique: Natural Earth draws Ashmore and
 * Cartier Islands separately from Australia and calls both "AU", and gives
 * five disputed territories -- Somaliland, Kosovo, Northern Cyprus, Indian
 * Ocean Ter., Siachen Glacier -- no ISO id at all, so all five arrive as
 * "000". Keyed on `id`, React warns and may reconcile those shapes into each
 * other's elements.
 *
 * This is caught here rather than in the browser because React only warns
 * about duplicate keys in development, and the end-to-end checks run against a
 * production build where the warning is compiled out.
 */
describe("world geometry", () => {
  it("gives every shape a unique key", () => {
    const keys = WORLD_SHAPES.map((s) => s.key);
    const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(duplicates).toEqual([]);
    expect(new Set(keys).size).toBe(WORLD_SHAPES.length);
  });

  it("keeps the country proper on the unsuffixed key", () => {
    // Australia, not its uninhabited external territory, is plain "AU".
    expect(WORLD_SHAPES.find((s) => s.key === "AU")?.name).toBe("Australia");
  });

  it("gives every shape drawable path data", () => {
    for (const shape of WORLD_SHAPES) {
      expect(shape.d.startsWith("M"), `${shape.key} path`).toBe(true);
      expect(shape.d.endsWith("Z"), `${shape.key} path`).toBe(true);
    }
  });
});

describe("clampView", () => {
  const aspect = 16 / 9;

  it("keeps the view inside the drawing", () => {
    const escaped = clampView(
      { x: -5000, y: -5000, width: 200, height: 200 / aspect },
      aspect,
    );
    expect(escaped.x).toBeGreaterThanOrEqual(WORLD_VIEW_BOX.x);
    expect(escaped.y).toBeGreaterThanOrEqual(WORLD_VIEW_BOX.y);

    const overshot = clampView({ x: 5000, y: 5000, width: 200, height: 200 / aspect }, aspect);
    expect(overshot.x + overshot.width).toBeLessThanOrEqual(WORLD_VIEW_BOX.x + WORLD_VIEW_BOX.width);
    expect(overshot.y + overshot.height).toBeLessThanOrEqual(
      WORLD_VIEW_BOX.y + WORLD_VIEW_BOX.height,
    );
  });

  it("refuses to zoom out past the whole world", () => {
    const zoomedOut = clampView({ x: 0, y: 0, width: 99999, height: 99999 }, aspect);
    expect(zoomedOut.width).toBeLessThanOrEqual(WORLD_VIEW_BOX.width);
  });

  it("derives height from the container, so a resize re-frames rather than stretches", () => {
    const wide = clampView({ x: 100, y: 100, width: 400, height: 999 }, 2);
    expect(wide.height).toBeCloseTo(wide.width / 2, 5);
  });
});

describe("fitPoints", () => {
  const aspect = 16 / 9;

  it("frames the pins it is given", () => {
    const manila = project(14.6, 121.0);
    const cebu = project(10.32, 123.9);
    const view = fitPoints([manila, cebu], aspect);

    for (const p of [manila, cebu]) {
      expect(p.x).toBeGreaterThan(view.x);
      expect(p.x).toBeLessThan(view.x + view.width);
      expect(p.y).toBeGreaterThan(view.y);
      expect(p.y).toBeLessThan(view.y + view.height);
    }
    // Two Philippine provinces should not open the whole world.
    expect(view.width).toBeLessThan(WORLD_VIEW_BOX.width / 2);
  });

  it("does not zoom to maximum on a single pin", () => {
    const view = fitPoints([project(10.32, 123.9)], aspect);
    expect(view.width).toBeGreaterThan(WORLD_SIZE / 12);
  });

  it("falls back to the whole world with nothing to frame", () => {
    expect(fitPoints([], aspect).width).toBeCloseTo(
      clampView(
        { x: 0, y: 0, width: WORLD_VIEW_BOX.width, height: WORLD_VIEW_BOX.height },
        aspect,
      ).width,
      5,
    );
  });
});
