import { beforeAll, describe, expect, it } from "vitest";
import type { Cafe } from "../src/cafe";
import { ISO } from "../src/iso";
import { Stage } from "../src/stage";

// The stage turns tiles into CSS pixels and back through the camera (slice
// 09), so bubbles, menus, rings and picking all agree with what's drawn.

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  window.matchMedia ??= (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});

const room = { width: 12, height: 10 };

/** A stage at `scale`, its canvas placed at (left, top) within the stage box and on the page. */
function stageAt(scale: number, left: number, top: number): Stage {
  const cafe = { state: { room } } as unknown as Cafe;
  const box = document.createElement("div");
  const canvas = document.createElement("canvas");
  box.append(canvas);
  const stage = new Stage(cafe, canvas, box);
  stage.scale = scale;
  Object.defineProperty(canvas, "offsetLeft", { value: left });
  Object.defineProperty(canvas, "offsetTop", { value: top });
  canvas.getBoundingClientRect = () => ({ left, top, right: left + ISO.width * scale, bottom: top + ISO.height * scale, width: ISO.width * scale, height: ISO.height * scale, x: left, y: top, toJSON: () => ({}) });
  return stage;
}

describe("the stage on the isometric camera", () => {
  for (const [scale, left, top] of [
    [3, 144, 125],
    [1, 27, 0],
    [3, -300, -40],
  ]) {
    it(`turns every tile into CSS and back, at ${scale}× with the canvas at (${left}, ${top})`, () => {
      const stage = stageAt(scale, left, top);
      for (let y = 0; y < room.height; y++) {
        for (let x = 0; x < room.width; x++) {
          // Row 0 is the street wall: its spot is halfway up the wall.
          const at = y === 0 ? stage.wallToCss(x + 0.5) : stage.tileToCss(x + 0.5, y + 0.5);
          expect(stage.cssToTile(at.left, at.top), `(${x},${y})`).toEqual({ x, y });
        }
      }
    });
  }

  it("gives the room's box as the canvas's, so bubbles stay over the room", () => {
    const stage = stageAt(3, 100, 50);
    expect(stage.roomBox()).toEqual({ left: 100, top: 50, right: 100 + ISO.width * 3, bottom: 50 + ISO.height * 3 });
  });

  it("puts someone's feet on their tile's centre and their head a figure's height above", () => {
    const stage = stageAt(3, 100, 50);
    const { x, head, feet } = stage.figureToCss({ x: 4, y: 6 });
    const centre = stage.tileToCss(4.5, 6.5);
    expect({ x, feet }).toEqual({ x: centre.left, feet: centre.top });
    // A figure about 30 px tall at 1x (slice 11), times the scale.
    expect(head).toBe(centre.top - 30 * 3);
  });

  // Slice 09's review, finding 8.

  it("raises someone's head and feet by how high they're drawn, as on a seat", () => {
    const stage = stageAt(3, 100, 50);
    const floor = stage.figureToCss({ x: 9, y: 4 });
    const seated = stage.figureToCss({ x: 9, y: 4 }, 10);
    expect(seated.head).toBe(floor.head - 10 * 3);
    expect(seated.feet).toBe(floor.feet - 10 * 3);
  });

  it("puts a face in the window between the window's top and its sill, so a bubble clears it", () => {
    const stage = stageAt(3, 100, 50);
    const { x, head, feet } = stage.windowFaceToCss(3);
    const sill = stage.tileToCss(3.5, 1).top - 20 * 3;
    // The face is drawn from 30 to 39 px up the wall.
    expect(head).toBeLessThanOrEqual(stage.tileToCss(3.5, 1).top - 39 * 3);
    expect(feet).toBeGreaterThanOrEqual(stage.tileToCss(3.5, 1).top - 30 * 3);
    expect(feet).toBeLessThanOrEqual(sill + 1);
    expect(x).toBe(stage.tileToCss(3.5, 1).left);
  });

  it("puts a tile's centre where the camera draws it", () => {
    const stage = stageAt(3, 100, 50);
    // (0,1)'s centre is (0.5, 1.5) on the grid: (-16 + 16(0.5 + 1.5), 152 + 8(1.5 - 0.5)) at 1x,
    // the origin 56 + 8 × 12 down for the 13-wide floor (slice 16).
    expect(stage.tileToCss(0.5, 1.5)).toEqual({ left: 100 + 16 * 3, top: 50 + 160 * 3 });
  });
});

// Slice 12: the canvas is the room at its scale, so a walker can be placed
// to a screen pixel; its size on the page doesn't change.

describe("the canvas at the room's scale", () => {
  function fitted(width: number, height: number, layout: "a" | "b" = "a") {
    const cafe = { state: null } as unknown as Cafe;
    const box = document.createElement("div");
    Object.defineProperty(box, "clientWidth", { value: width });
    Object.defineProperty(box, "clientHeight", { value: height });
    const canvas = document.createElement("canvas");
    box.append(canvas);
    const stage = new Stage(cafe, canvas, box);
    stage.layout = layout;
    stage.fit();
    return { stage, canvas };
  }

  for (const [w, h, layout, scale] of [
    [1296, 950, "a", 3],
    [400, 300, "a", 1],
    [390, 844, "b", 3],
  ] as const) {
    it(`holds the room at ${scale}× in its own pixels, and stays ${scale}× its size on the page (${w}×${h}, layout ${layout})`, () => {
      const { stage, canvas } = fitted(w, h, layout);
      expect(stage.scale).toBe(scale);
      expect([canvas.width, canvas.height]).toEqual([ISO.width * scale, ISO.height * scale]);
      expect([canvas.style.width, canvas.style.height]).toEqual([`${ISO.width * scale}px`, `${ISO.height * scale}px`]);
    });
  }
});

// Slice 12's review, finding 2: the real stage and renderer together. In
// layout B the camera follows you; you walk along a diagonal; each frame the
// canvas's CSS left plus where your sprite is drawn on it is where you are
// on screen, and that must hold still. Stepped through the stage's own
// paint, with a 2D context that records where each image is drawn.

describe("the stage's camera and the sprite it follows, together", () => {
  for (const width of [390, 393]) {
    it(`holds you on one screen pixel across as the camera follows your walk in layout B, at ${width} wide`, async () => {
      const { fromWelcome } = await import("../src/state");
      const now = { t: 100_000 };
      const realNow = Date.now;
      Date.now = () => now.t;
      try {
        const welcome = {
          type: "welcome" as const,
          you: 1,
          build: "b",
          now: 100_000,
          cap: 6,
          chalkHours: 24,
          chalkShown: 8,
          demo: false,
          ahead: 0,
          nextJump: 0,
          layouts: [],
          snapshot: {
            room: { width: 12, height: 10, tiles: ["WWGGGGWDCWWW", ...Array<string>(9).fill("............")], door: { x: 7, y: 0 }, walkway: [], furniture: [], catalogue: [] },
            people: [{ id: 1, name: "me", look: { avatar: 0, colour: 0 }, place: "inside" as const, at: { x: 1, y: 6 }, walk: { path: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => ({ x, y: 6 })), start: 100_000, speed: 3 }, sitting: false, bot: false }],
            cats: [],
            yourTrust: [],
            held: [],
            treats: [],
            yourTreats: 3,
            bowls: 2,
            chalkboard: [],
          },
        };
        const state = fromWelcome(welcome, 100_000);
        const cafe = { state } as unknown as Cafe;
        const box = document.createElement("div");
        Object.defineProperty(box, "clientWidth", { value: width });
        Object.defineProperty(box, "clientHeight", { value: 844 });
        box.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: 844, width, height: 844, x: 0, y: 0, toJSON: () => ({}) });
        const canvas = document.createElement("canvas");
        box.append(canvas);
        // The person's sprite is the only image this room draws; record its device x.
        let m = [1, 0, 0, 1, 0, 0];
        const stack: number[][] = [];
        let drawnAt: number | null = null;
        const ctx = new Proxy(
          {},
          {
            get: (_t, key) => {
              if (key === "setTransform") return (a: number, b: number, c: number, d: number, e: number, f: number) => (m = [a, b, c, d, e, f]);
              if (key === "getTransform") return () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] });
              if (key === "save") return () => stack.push([...m]);
              if (key === "restore") return () => (m = stack.pop() ?? m);
              if (key === "translate") return (x: number, y: number) => (m = [m[0], m[1], m[2], m[3], m[4] + m[0] * x, m[5] + m[3] * y]);
              if (key === "scale") return (x: number, y: number) => (m = [m[0] * x, m[1], m[2], m[3] * y, m[4], m[5]]);
              if (key === "drawImage") return (_img: unknown, x: number) => (drawnAt = Math.min(m[0] * x + m[4], m[0] * (x + 16) + m[4]));
              return () => {};
            },
            set: () => true,
          },
        );
        canvas.getContext = (() => ctx) as unknown as typeof canvas.getContext;
        const stage = new Stage(cafe, canvas, box);
        // Every sprite is a canvas, so the stub draws it.
        stage.sprites.avatar = () => document.createElement("canvas");
        stage.sprites.cat = () => null;
        stage.sprites.emote = () => null;
        stage.setLayout("b");
        const onScreen = new Set<number>();
        for (let f = 0; f < 90; f++) {
          now.t = 100_000 + 200 + f * (1000 / 60);
          (stage as unknown as { paint(): void }).paint();
          expect(drawnAt, `frame ${f}: the sprite was drawn`).not.toBeNull();
          onScreen.add(Math.round(parseFloat(canvas.style.left) + drawnAt!));
          drawnAt = null;
        }
        expect([...onScreen], "where you are on screen, across, frame by frame").toHaveLength(1);
      } finally {
        Date.now = realNow;
      }
    });
  }
});
