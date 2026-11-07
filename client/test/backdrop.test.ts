import { describe, expect, it } from "vitest";
import palettes from "../../content/sprites/palettes.json";
import { FLOOR, ISO, toCanvas } from "../src/iso";
import { backdrop } from "../src/backdrop";
import { street, streetSlot, terraceAt } from "../src/street";

// Slice 18: the street and everything outside the room (the terrace, and
// the balcony it stands on) are one backdrop, drawn once per light into a
// raster over whatever span of room pixels a canvas needs. The room's
// canvas takes the room's own span, the street's canvas a wider one round
// it, and the two are the same pixels where they meet, so the balcony runs
// on past the room's canvas as the street does (slice 16).

const roomSpan = { x0: 0, y0: 0, x1: ISO.width, y1: ISO.height };

describe("the backdrop behind and round the room", () => {
  it("is the same pixels over any span: the room's own, and a wider one round it", () => {
    for (const light of [0, 1] as const) {
      const room = backdrop(roomSpan, light);
      const wide = backdrop({ x0: -60, y0: -30, x1: ISO.width + 60, y1: ISO.height + 40 }, light);
      let differ = 0;
      const first: string[] = [];
      for (let y = 0; y < ISO.height; y++)
        for (let x = 0; x < ISO.width; x++) {
          if (room.at(x, y) === wide.at(x, y)) continue;
          differ++;
          if (first.length < 8) first.push(`(${x},${y}) ${room.at(x, y)} / ${wide.at(x, y)}`);
        }
      expect(first, `light ${light}: ${differ} pixels differ`).toEqual([]);
    }
  });

  it("draws every pixel of the span: nothing left blank, inside the room's canvas or outside it", () => {
    const span = { x0: -40, y0: -20, x1: ISO.width + 40, y1: ISO.height + 30 };
    const b = backdrop(span, 0);
    for (let y = span.y0; y < span.y1; y += 3) for (let x = span.x0; x < span.x1; x += 3) expect(b.at(x, y), `(${x},${y})`).not.toBeNull();
  });

  it("is the street where nothing of the café stands: its sky and towers above the room, and past its canvas", () => {
    for (const [light, name] of [
      [0, "day"],
      [1, "night"],
    ] as const) {
      const colours = (palettes[name] as unknown as { street: string[] }).street.map((c) => c.toLowerCase());
      const b = backdrop({ x0: -40, y0: -20, x1: ISO.width + 40, y1: ISO.height }, light);
      for (const [x, y] of [
        [4, 4],
        [ISO.width - 6, 4],
        [-30, 10],
        [ISO.width + 30, -10],
      ])
        expect(b.at(x, y), `${name} (${x},${y})`).toBe(colours[streetSlot(x, y, ISO.width, ISO.height, light >= 1)]);
    }
  });

  it("is the floor layer's street: the room's canvas shows the backdrop where the room doesn't stand", async () => {
    const { floorLayer } = await import("../src/render");
    const room = {
      width: FLOOR.width,
      height: FLOOR.height,
      tiles: ["W".repeat(FLOOR.width), ...Array<string>(FLOOR.height - 1).fill(".".repeat(FLOOR.width))],
      door: { x: 7, y: 0 },
      walkway: [],
      furniture: [],
      catalogue: [],
    };
    for (const light of [0, 1] as const) {
      const layer = floorLayer(room, light, false);
      const b = backdrop(roomSpan, light);
      // The canvas's four corners are past the floor and its walls.
      for (const [x, y] of [
        [2, 2],
        [ISO.width - 3, 2],
        [2, ISO.height - 3],
        [ISO.width - 3, ISO.height - 3],
      ])
        expect(layer.at(x, y), `light ${light} (${x},${y})`).toBe(b.at(x, y));
    }
  });

  it("stands the terrace in it, and carries a thing past the room's canvas when it's placed there", () => {
    const day = new Set((palettes.day as unknown as { street: string[] }).street.map((c) => c.toLowerCase()));
    const b = backdrop({ x0: -80, y0: 0, x1: ISO.width + 80, y1: ISO.height + 60 }, 0);
    // Each terrace thing has its own pixels, off the street's colours, just over its spot.
    for (const t of street.terrace) {
      const at = terraceAt(t, FLOOR);
      const foot = toCanvas(at.x, at.y);
      let mine = 0;
      for (let dy = -10; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (!day.has(b.at(Math.round(foot.x) + dx, Math.round(foot.y) + 6 + dy) ?? "")) mine++;
      expect(mine, `the ${t.kind} at (${at.x}, ${at.y})`).toBeGreaterThan(4);
    }
    // A planter placed far along the front, past the room's canvas on the
    // right, is drawn there in the wider span, cut by nothing.
    const kept = street.terrace;
    street.terrace = [{ kind: "planter", side: "front", along: FLOOR.width + 2, out: 1.5 }];
    try {
      const at = toCanvas(FLOOR.width + 2, FLOOR.height + 1.5);
      expect(at.x, "the planter stands past the room's canvas").toBeGreaterThan(ISO.width);
      const past = backdrop({ x0: -80, y0: 0, x1: ISO.width + 80, y1: ISO.height + 60 }, 0);
      let mine = 0;
      for (let dy = -20; dy <= 2; dy++) for (let dx = -8; dx <= 8; dx++) if (!day.has(past.at(Math.round(at.x) + dx, Math.round(at.y) + 6 + dy) ?? "")) mine++;
      expect(mine, "the planter's pixels past the canvas").toBeGreaterThan(20);
    } finally {
      street.terrace = kept;
    }
  });
});
