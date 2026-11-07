import { describe, expect, it } from "vitest";
import palettes from "../../content/sprites/palettes.json";
import { FLOOR, ISO, toCanvas } from "../src/iso";
import { backdrop } from "../src/backdrop";
import { SHADOW, darken } from "../src/layer";
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

// Slice 18: the deck the terrace stands on, round the floor's left and
// front edges at the foot of its slab, in the room's angle.
describe("the balcony's deck", () => {
  const SLAB = 6;
  const wide = { x0: -120, y0: -20, x1: ISO.width + 120, y1: ISO.height + 80 };
  const balcony = (name: "day" | "night") => (palettes[name] as unknown as { balcony: string[] }).balcony.map((c) => c.toLowerCase());
  /** The colour on the deck at grid spot (gx, gy): the pixel at its middle, at the slab's foot. */
  const onDeck = (b: ReturnType<typeof backdrop>, gx: number, gy: number) => {
    const p = toCanvas(gx, gy);
    return b.at(Math.round(p.x), Math.round(p.y) + SLAB);
  };
  const deck = street.deck!;

  for (const [light, name] of [
    [0, "day"],
    [1, "night"],
  ] as const) {
    it(`lays stone tiles in two tones in both arms, by the left edge and out front, by ${name}`, () => {
      const b = backdrop(wide, light);
      const [stoneA, stoneB] = balcony(name);
      const seen = new Set<string>();
      // Spots in the left arm (left of x = 0) and the front arm (past the
      // floor's last row), clear of the terrace's things.
      const spots: [number, number][] = [
        [-0.5, 1.5],
        [-1.5, 2.5],
        [-0.5, 10.5],
        [-1.5, FLOOR.height + 0.5],
        [0.5, FLOOR.height + 0.5],
        [3.5, FLOOR.height + 1.5],
        [11.5, FLOOR.height + 0.5],
        [12.5, FLOOR.height + 1.5],
      ];
      for (const [gx, gy] of spots) {
        const c = onDeck(b, gx, gy);
        expect([stoneA, stoneB], `${name}: the deck at (${gx}, ${gy}) is ${c}`).toContain(c);
        seen.add(c!);
      }
      expect(seen.size, "both tones").toBe(2);
    });
  }

  it("reaches as far out as street.toml says, and no further: past it is what's below the balcony", () => {
    const b = backdrop(wide, 0);
    const stones = balcony("day").slice(0, 2);
    // Just inside the deck's outer edges, and just past them.
    expect(stones).toContain(onDeck(b, -(deck.out - 0.15), 6.5));
    expect(stones).toContain(onDeck(b, 6.5, FLOOR.height + deck.out - 0.15));
    expect(stones).not.toContain(onDeck(b, -(deck.out + 0.4), 6.5));
    expect(stones).not.toContain(onDeck(b, 6.5, FLOOR.height + deck.out + 0.4));
  });

  it("stands every terrace thing on the deck, a shadow under it", () => {
    const b = backdrop(wide, 0);
    for (const t of street.terrace) {
      const at = terraceAt(t, FLOOR);
      // The deck reaches round the thing's spot on every side.
      for (const [dx, dy] of [
        [-0.7, 0],
        [0.7, 0],
        [0, -0.7],
        [0, 0.7],
      ]) {
        const [gx, gy] = [at.x + dx, at.y + dy];
        const onIt = gx < 0 ? gx >= -deck.out && gy >= 1 : gy >= FLOOR.height && gy <= FLOOR.height + deck.out && gx >= -deck.out;
        expect(onIt, `the ${t.kind}'s side (${gx}, ${gy}) is on the deck`).toBe(true);
      }
    }
    // A shadow under each thing: the deck's own stone darkened as the
    // room's shadows are (layer.ts), round each thing's foot.
    const shadows = balcony("day").slice(0, 2).map((c) => darken(c, SHADOW));
    for (const t of street.terrace) {
      if (t.kind === "umbrella") continue;
      const at = terraceAt(t, FLOOR);
      const p = toCanvas(at.x, at.y);
      let shaded = 0;
      for (let dx = -24; dx <= 24; dx++) for (let dy = -6; dy <= 14; dy++) if (shadows.includes(b.at(Math.round(p.x) + dx, Math.round(p.y) + SLAB + dy) ?? "")) shaded++;
      expect(shaded, `the ${t.kind}'s shadow on the deck`).toBeGreaterThan(3);
    }
  });

  it("draws no deck from a street with no [deck]", () => {
    const kept = street.deck;
    street.deck = null;
    try {
      const b = backdrop(wide, 0);
      const stones = balcony("day").slice(0, 2);
      expect(stones).not.toContain(onDeck(b, -0.5, 6.5));
      expect(stones).not.toContain(onDeck(b, 6.5, FLOOR.height + 0.5));
    } finally {
      street.deck = kept;
    }
  });
});
