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
    expect(head).toBe(centre.top - 16 * 3);
  });

  it("puts a tile's centre where the camera draws it", () => {
    const stage = stageAt(3, 100, 50);
    // (0,1)'s centre is (0.5, 1.5) on the grid: (160 + 16(0.5 - 1.5), 56 + 8(0.5 + 1.5)) at 1x.
    expect(stage.tileToCss(0.5, 1.5)).toEqual({ left: 100 + 144 * 3, top: 50 + 72 * 3 });
  });
});
