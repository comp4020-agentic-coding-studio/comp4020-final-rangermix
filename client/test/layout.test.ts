import { describe, expect, it } from "vitest";
import { chooseLayout, menuSpot, panOffset, ringCentre, ringPositions, ringRadius } from "../src/layout";

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

  it("says where a ring can sit: round its tile if it fits, or only as far in as it must", () => {
    const free = { left: 0, top: 120, right: 390, bottom: 740 };
    expect(ringCentre({ x: 200, y: 400 }, 72, free, 88)).toEqual({ x: 200, y: 400 });
    // A tile against the left wall, and one by the talk bar: in by the
    // radius and half a button, so the room can move over by the difference.
    expect(ringCentre({ x: 24, y: 400 }, 72, free, 88)).toEqual({ x: 116, y: 400 });
    expect(ringCentre({ x: 200, y: 700 }, 72, free, 88)).toEqual({ x: 200, y: 624 });
    // The ring's buttons sit round that spot.
    for (const p of ringPositions(2, { x: 24, y: 400 }, 72, free, 88)) expect(Math.hypot(p.x - 116, p.y - 400)).toBeCloseTo(72, 5);
  });
});

describe("the menu beside what you clicked", () => {
  // A 1296 by 950 stage, as at 1920x1080, and a cat's menu of six actions.
  const stage = { w: 1296, h: 950 };
  const menu = { w: 193, h: 355 };
  const inside = (at: { left: number; top: number }, m = menu, s = stage) => {
    expect(at.left).toBeGreaterThanOrEqual(0);
    expect(at.top).toBeGreaterThanOrEqual(0);
    expect(at.left + m.w).toBeLessThanOrEqual(s.w);
    expect(at.top + m.h).toBeLessThanOrEqual(s.h);
  };

  it("opens beside its tile when there's room", () => {
    // The tile's left edge at 404, its right edge at 500.
    expect(menuSpot({ left: 404, right: 500, top: 300 }, menu, stage)).toEqual({ left: 504, top: 300 });
  });

  it("moves up when its tile is low in the room, so nothing hides under the talk bar", () => {
    // Tora on the box on the bottom row: the tile's top at 795.
    const at = menuSpot({ left: 236, right: 332, top: 795 }, menu, stage);
    inside(at);
    expect(at).toEqual({ left: 336, top: 950 - 355 });
  });

  it("opens on the tile's left when its right side has no room", () => {
    // The bowls against the right wall: right edge at 1256.
    const at = menuSpot({ left: 1160, right: 1256, top: 300 }, menu, stage);
    inside(at);
    expect(at.left + menu.w).toBeLessThanOrEqual(1160);
  });

  it("keeps to the stage in a corner", () => {
    inside(menuSpot({ left: 1160, right: 1256, top: 900 }, menu, stage));
    inside(menuSpot({ left: 0, right: 96, top: -40 }, menu, stage));
  });

  it("starts at the stage's top when it's taller than the stage, so its top never hides", () => {
    expect(menuSpot({ left: 404, right: 500, top: 200 }, menu, { w: 1296, h: 300 }).top).toBe(0);
  });
});
