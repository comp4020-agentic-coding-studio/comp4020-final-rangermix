import { describe, expect, it } from "vitest";
import { chooseLayout, panOffset, ringPositions, ringRadius } from "../src/layout";

describe("phone layout B", () => {
  it("is only for a phone, and only when chosen", () => {
    expect(chooseLayout("b", true)).toBe("b");
    expect(chooseLayout("b", false)).toBe("a");
    expect(chooseLayout(null, true)).toBe("a");
    expect(chooseLayout("nonsense", true)).toBe("a");
  });

  it("pans to keep you in the middle of the view, and centres a room smaller than it", () => {
    // A 576 by 480 room at 3x in a 390 by 700 view: you at (300, 200).
    expect(panOffset({ x: 300, y: 200 }, { w: 390, h: 700 }, { w: 576, h: 480 })).toEqual({ x: 105, y: -110 });
  });

  it("stops at the room's edges", () => {
    expect(panOffset({ x: 10, y: 10 }, { w: 390, h: 300 }, { w: 576, h: 480 })).toEqual({ x: 0, y: 0 });
    expect(panOffset({ x: 570, y: 470 }, { w: 390, h: 300 }, { w: 576, h: 480 })).toEqual({ x: 186, y: 180 });
  });

  it("widens the ring so its buttons never overlap", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 8]) {
      const r = ringRadius(n, 88);
      expect(r).toBeGreaterThanOrEqual(72);
      if (n > 1) expect(2 * r * Math.sin(Math.PI / n)).toBeGreaterThanOrEqual(88 + 8);
    }
  });

  it("puts a ring of actions round what you tapped, on screen", () => {
    const free = { left: 0, top: 120, right: 390, bottom: 740 };
    const ring = ringPositions(4, { x: 200, y: 300 }, 70, free, 44);
    expect(ring).toHaveLength(4);
    for (const p of ring) {
      expect(Math.hypot(p.x - 200, p.y - 300)).toBeCloseTo(70, 0);
    }
    // Tapped under the floating status bar: the ring drops below it.
    const edge = ringPositions(3, { x: 5, y: 60 }, 70, free, 44);
    for (const p of edge) {
      expect(p.x).toBeGreaterThanOrEqual(22);
      expect(p.y).toBeGreaterThanOrEqual(120 + 22);
    }
  });
});
