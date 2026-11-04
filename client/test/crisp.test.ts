import { describe, expect, it } from "vitest";
import { spans, strokeCrisp } from "../src/crisp";

// Slice 13: shapes filled and traced by whole room pixels.

/** The pixels a stroke fills, as "x,y". */
function stroked(pts: { x: number; y: number }[], closed?: boolean): Set<string> {
  const seen = new Set<string>();
  const ctx = { fillStyle: "", fillRect: (x: number, y: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add(`${x + i},${y + j}`);
  } } as unknown as CanvasRenderingContext2D;
  strokeCrisp(ctx, pts, "#000", 1, closed);
  return seen;
}

describe("crisp shapes", () => {
  it("fills a pixel when its centre is inside the polygon", () => {
    // A 4×2 rectangle from (1,1): pixels (1..4, 1..2).
    const s = spans([{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 3 }, { x: 1, y: 3 }]);
    expect(s).toEqual([{ y: 1, x0: 1, x1: 5 }, { y: 2, x0: 1, x1: 5 }]);
  });

  it("closes a traced polygon back to its start", () => {
    const px = stroked([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }]);
    // The closing side, from (4,4) back to (0,0), passes (2,2).
    expect(px.has("2,2")).toBe(true);
  });

  it("leaves an open line open: nothing drawn from its end back to its start", () => {
    const px = stroked([{ x: 0, y: 10 }, { x: 8, y: 14 }, { x: 16, y: 10 }], false);
    // A closing side from (16,10) back to (0,10) would run along y = 10.
    for (let x = 2; x < 15; x++) expect(px.has(`${x},10`), `(${x},10)`).toBe(false);
    expect(px.has("0,10") && px.has("16,10") && px.has("8,14")).toBe(true);
  });
});
