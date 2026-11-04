import { describe, expect, it } from "vitest";
import { chooseLayout, menuSpot, panelAt, panOffset, ringCentre, ringPositions, ringRadius, saveLayout, savedLayout, savedPanels, savePanels, spotFor } from "../src/layout";

describe("phone layout B", () => {
  it("is a phone's unless it chose the whole room, and never a desktop's", () => {
    // The room at an angle fits a phone's width only at 1x (slice 09).
    expect(chooseLayout(null, true)).toBe("b");
    expect(chooseLayout("b", true)).toBe("b");
    expect(chooseLayout("nonsense", true)).toBe("b");
    expect(chooseLayout("a", true)).toBe("a");
    expect(chooseLayout("b", false)).toBe("a");
    expect(chooseLayout(null, false)).toBe("a");
  });

  it("keeps a switch for this visit when the device won't store it (slice 09's review, finding 11)", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      saveLayout("a");
      expect(savedLayout()).toBe("a");
      expect(chooseLayout(savedLayout(), true)).toBe("a");
      saveLayout("b");
      expect(chooseLayout(savedLayout(), true)).toBe("b");
    } finally {
      Object.defineProperty(window, "localStorage", real);
    }
  });

  it("pans to keep you in the middle of the view, and centres a room smaller than it", () => {
    // A 576 by 480 room at 3x in a 390 by 700 view: you at (300, 200).
    expect(panOffset({ x: 300, y: 200 }, { w: 390, h: 700 }, { w: 576, h: 480 })).toEqual({ x: 105, y: -110 });
  });

  it("moves a room shorter than the view just enough to bring what it follows out from under the bars (slice 09's review, finding 9)", () => {
    // The room at an angle, 1008 by 696 at 3x, in a 390 by 844 phone with bars down to 74 and up from 740.
    const free = { top: 74, bottom: 740 };
    // Something in the middle: the room stays centred, as before.
    expect(panOffset({ x: 500, y: 348 }, { w: 390, h: 844 }, { w: 1008, h: 696 }, free).y).toBe(-74);
    // The front corner tile, its centre 672 px down the room: the room moves up so it's clear of the talk bar.
    const low = panOffset({ x: 500, y: 672 }, { w: 390, h: 844 }, { w: 1008, h: 696 }, free);
    expect(672 - low.y).toBeLessThanOrEqual(740 - 24);
    // Something at the very top: the room moves down so it's clear of the status bar.
    const high = panOffset({ x: 500, y: 20 }, { w: 390, h: 844 }, { w: 1008, h: 696 }, free);
    expect(20 - high.y).toBeGreaterThanOrEqual(74 + 24);
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

// Slice 12: the camera following a walker is held in stage.test.ts, through
// the real stage and renderer together (slice 12's review, finding 2).

describe("panels over the room (slice 14)", () => {
  // A 1904 by 966 stage, 8 px from the window's left and 56 from its top.
  const stage = { left: 8, top: 56, width: 1904, height: 966 };
  const size = { w: 288, h: 300 };

  it("puts a panel at its spot, measured from the stage's nearer sides", () => {
    expect(panelAt({ h: "left", x: 8, v: "top", y: 8 }, size, stage)).toEqual({ left: 16, top: 64 });
    expect(panelAt({ h: "right", x: 8, v: "top", y: 8 }, size, stage)).toEqual({ left: 8 + 1904 - 8 - 288, top: 64 });
    expect(panelAt({ h: "left", x: 8, v: "bottom", y: 8 }, size, stage)).toEqual({ left: 16, top: 56 + 966 - 8 - 300 });
  });

  it("keeps a panel inside the stage, whatever its spot says, and at the stage's corner if it's bigger than the stage", () => {
    expect(panelAt({ h: "left", x: 5000, v: "top", y: -40 }, size, stage)).toEqual({ left: 8 + 1904 - 288, top: 56 });
    expect(panelAt({ h: "right", x: -100, v: "bottom", y: 5000 }, size, stage)).toEqual({ left: 8 + 1904 - 288, top: 56 });
    expect(panelAt({ h: "right", x: 8, v: "bottom", y: 8 }, { w: 3000, h: 2000 }, stage)).toEqual({ left: 8, top: 56 });
  });

  it("keeps a panel in its corner when the stage changes size", () => {
    const spot = { h: "right", x: 8, v: "bottom", y: 8 } as const;
    const small = { left: 8, top: 56, width: 1264, height: 606 };
    expect(panelAt(spot, size, small)).toEqual({ left: 8 + 1264 - 8 - 288, top: 56 + 606 - 8 - 300 });
  });
});

describe("moving a panel, and remembering it (slice 14)", () => {
  const stage = { left: 8, top: 56, width: 1904, height: 966 };
  const size = { w: 288, h: 300 };

  it("measures a dropped panel from the stage's nearer sides, so it keeps to its corner", () => {
    // Dropped near the top-right: measured from the right and the top.
    expect(spotFor({ left: 8 + 1904 - 20 - 288, top: 56 + 40 }, size, stage)).toEqual({ h: "right", x: 20, v: "top", y: 40 });
    // Near the bottom-left: from the left and the bottom.
    expect(spotFor({ left: 30, top: 56 + 966 - 10 - 300 }, size, stage)).toEqual({ h: "left", x: 22, v: "bottom", y: 10 });
    // And back again: the spot puts it where it was dropped.
    const at = { left: 700, top: 300 };
    expect(panelAt(spotFor(at, size, stage), size, stage)).toEqual(at);
  });

  it("remembers where each panel is and which are pinned, and ignores what it can't read", () => {
    savePanels({ chalkboard: { spot: { h: "right", x: 10, v: "bottom", y: 20 }, pinned: true } });
    expect(savedPanels()).toEqual({ chalkboard: { spot: { h: "right", x: 10, v: "bottom", y: 20 }, pinned: true } });
    localStorage.setItem("cafe.panels", "not json");
    expect(savedPanels()).toEqual({});
    localStorage.setItem("cafe.panels", JSON.stringify({ chalkboard: { spot: { h: "middle", x: "far", v: "top", y: 1 }, pinned: "yes" }, "here-panel": { spot: { h: "left", x: 4, v: "top", y: 5 }, pinned: false } }));
    expect(savedPanels()).toEqual({ "here-panel": { spot: { h: "left", x: 4, v: "top", y: 5 }, pinned: false } });
    localStorage.removeItem("cafe.panels");
  });

  it("keeps them for the visit when the device won't store them", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      savePanels({ "cats-panel": { spot: { h: "left", x: 1, v: "top", y: 2 }, pinned: false } });
      expect(savedPanels()).toEqual({ "cats-panel": { spot: { h: "left", x: 1, v: "top", y: 2 }, pinned: false } });
    } finally {
      Object.defineProperty(window, "localStorage", real);
    }
  });
});
