import { describe, expect, it } from "vitest";
import { ISO } from "../src/iso";
import { STREET, streetRuns, streetSlot } from "../src/street";

// Slice 16: the street carried past the room's canvas to the window's edges.
// `streetRuns` lays the street out over a span of room pixels that can start
// left of and above the room's canvas (negative) and end past it, each run
// the slot `streetSlot` gives there, so the street outside the canvas carries
// on from the street inside it, pixel for pixel.

describe("the street past the room's edges", () => {
  it("is the same street inside the room's canvas as the room draws, and carries on outside it", () => {
    const span = { x0: -40, y0: -20, x1: ISO.width + 40, y1: ISO.height + 20 };
    const runs = streetRuns(span, false);
    const at = (x: number, y: number) => {
      const r = runs.find((r) => r.y === y && x >= r.x && x < r.x + r.w);
      if (!r) throw new Error(`no run at (${x}, ${y})`);
      return r.slot;
    };
    // Inside the room's canvas, what the room's own street gives.
    for (const [x, y] of [
      [0, 0],
      [10, 30],
      [ISO.width - 1, 5],
      [5, ISO.height - 1],
      [ISO.width - 1, ISO.height - 1],
    ])
      expect(at(x, y), `(${x}, ${y})`).toBe(streetSlot(x, y, ISO.width, ISO.height, false));
    // Every pixel of the span is drawn, in rows.
    for (let y = span.y0; y < span.y1; y++) {
      const row = runs.filter((r) => r.y === y).sort((a, b) => a.x - b.x);
      expect(row[0].x, `row ${y} starts at the span's left`).toBe(span.x0);
      for (let i = 1; i < row.length; i++) expect(row[i].x).toBe(row[i - 1].x + row[i - 1].w);
      expect(row.at(-1)!.x + row.at(-1)!.w, `row ${y} ends at the span's right`).toBe(span.x1);
    }
    // Outside it: sky above, towers to the sides, pavement below.
    expect([STREET.skyTop, STREET.sky]).toContain(at(-30, -10));
    expect(at(ISO.width + 20, ISO.height + 10), "below the room, the pavement's shade").toBe(STREET.kerb);
    const besideTheRoom = new Set(runs.filter((r) => r.y === Math.round(ISO.height * 0.45) && r.x < 0).map((r) => r.slot));
    expect([...besideTheRoom].some((s) => s === STREET.tower || s === STREET.towerSide || s === STREET.lit || s === STREET.dark), "towers beside the room").toBe(true);
  });

  it("shows stars only at night, out past the room as in it", () => {
    const span = { x0: -400, y0: -60, x1: 0, y1: 40 };
    const stars = (night: boolean) => streetRuns(span, night).filter((r) => r.slot === STREET.star).length;
    expect(stars(false)).toBe(0);
    expect(stars(true)).toBeGreaterThan(0);
  });
});
