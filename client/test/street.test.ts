import { describe, expect, it } from "vitest";
import { ISO } from "../src/iso";
import streetFile from "../../content/street.toml?raw";
import { STREET, parseStreet, street, streetRuns, streetSlot, terraceAt } from "../src/street";

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

describe("the terrace in the room's bottom corners (slice 16)", () => {
  it("is data in street.toml: each thing's kind, the floor edge it stands by, how far along it and how far out", () => {
    expect(street.terrace.length).toBeGreaterThanOrEqual(5);
    for (const t of street.terrace) {
      expect(["bench", "planter", "table", "umbrella", "chair", "lamp"]).toContain(t.kind);
      expect(["left", "front"]).toContain(t.side);
      expect(t.along).toBeGreaterThanOrEqual(0);
      expect(t.out).toBeGreaterThan(0);
    }
    // A bench and planters by the left edge; a table, its umbrella and a lamp out front.
    const by = (side: string) => street.terrace.filter((t) => t.side === side).map((t) => t.kind);
    expect(by("left")).toEqual(expect.arrayContaining(["bench", "planter"]));
    expect(by("front")).toEqual(expect.arrayContaining(["table", "umbrella", "lamp"]));
  });

  it("reads a new thing from a few lines, and refuses a kind it can't draw or a side it doesn't know", () => {
    const base = streetFile.replace(/\[\[terrace\]\][\s\S]*$/, "");
    const one = parseStreet(`${base}\n[[terrace]]\nkind = "planter"\nside = "left"\nalong = 2\nout = 1.5\n`);
    expect(one.terrace).toEqual([{ kind: "planter", side: "left", along: 2, out: 1.5 }]);
    expect(() => parseStreet(`${base}\n[[terrace]]\nkind = "fountain"\nside = "left"\nalong = 2\nout = 1\n`)).toThrow(/fountain/);
    expect(() => parseStreet(`${base}\n[[terrace]]\nkind = "bench"\nside = "back"\nalong = 2\nout = 1\n`)).toThrow(/back/);
  });

  it("puts each thing off the floor, outside its edge: left of the floor's left edge, or past its front", () => {
    const room = { width: 13, height: 13 };
    for (const t of street.terrace) {
      const at = terraceAt(t, room);
      if (t.side === "left") {
        expect(at.x, `${t.kind} left of the floor`).toBeLessThan(0);
        expect(at.y).toBeGreaterThanOrEqual(1);
      } else {
        expect(at.y, `${t.kind} past the floor's front`).toBeGreaterThanOrEqual(room.height);
        expect(at.x).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("the balcony under the terrace (slice 18)", () => {
  // street.toml without its [deck] table and its terrace.
  const base = streetFile.replace(/\n\[deck\]\n(?:[^[\n][^\n]*\n|\n)*/, "\n").replace(/\[\[terrace\]\][\s\S]*$/, "");

  it("is data in street.toml: the deck's reach and slab, the glass rail, its tint, the building's storey and its lit windows", () => {
    expect(street.deck).toEqual({ out: 2.6, slab: 4, rail: 18, posts: 2, glass: expect.any(Number), storey: 56, lit: 4 });
    expect(street.deck!.glass).toBeGreaterThan(0);
    expect(street.deck!.glass).toBeLessThan(1);
    // Every terrace thing stands on the deck, short of its outer edge.
    for (const t of street.terrace) expect(t.out, `the ${t.kind}`).toBeLessThan(street.deck!.out);
  });

  it("draws no balcony from a street with no [deck], as before slice 18", () => {
    expect(base, "the file without its [deck] table").not.toMatch(/^\[deck\]$/m);
    expect(parseStreet(base).deck).toBeNull();
  });

  it("reads a [deck] from a few lines, and refuses one with a value missing or out of its range", () => {
    const deck = (lines: string) => parseStreet(`${base}\n[deck]\n${lines}\n`).deck;
    const all = "out = 2\nslab = 4\nrail = 18\nposts = 2\nglass = 0.3\nstorey = 56\nlit = 4";
    expect(deck(all)).toEqual({ out: 2, slab: 4, rail: 18, posts: 2, glass: 0.3, storey: 56, lit: 4 });
    // No rail and no building are allowed: a bare deck.
    expect(deck(all.replace("rail = 18", "rail = 0").replace("storey = 56", "storey = 0"))).toMatchObject({ rail: 0, storey: 0 });
    expect(() => deck(all.replace("out = 2\n", ""))).toThrow(/deck\.out/);
    expect(() => deck(all.replace("glass = 0.3", "glass = 1.5"))).toThrow(/deck\.glass/);
    expect(() => deck(all.replace("rail = 18", "rail = 40"))).toThrow(/deck\.rail/);
    expect(() => deck(all.replace("storey = 56", "storey = 12"))).toThrow(/deck\.storey/);
  });
});

// Slice 16's review, finding 8: the street was drawn a whole stage past the
// room on every side, about nine times the window, and each redraw was a
// long task. It's drawn only as far past the room as the stage can show.
describe("how far past the room the street is drawn", () => {
  // Past the room on each side, as far as the stage is bigger than it: the
  // whole gap, since the phone's bigger room can be panned against an edge.
  it("reaches the stage's edges round a room smaller than it, and no further", async () => {
    const { streetMargin } = await import("../src/street");
    // 1920×1080 with the 1600×1056 room at 4×: 320 px across (80 room px), 24 down (6).
    expect(streetMargin({ w: 1920, h: 1080 }, { w: 400, h: 264 }, 4)).toEqual({ x: 80, y: 6 });
    // 2560×1440 at 5×: 560 across (112), 120 down (24).
    expect(streetMargin({ w: 2560, h: 1440 }, { w: 400, h: 264 }, 5)).toEqual({ x: 112, y: 24 });
  });
  it("reaches past a room bigger than the stage only as far as the stage is past it, as the phone's bigger room pans", async () => {
    const { streetMargin } = await import("../src/street");
    // 390×844 with the 1200×792 room at 3×: nothing across, 52 px down (18 room px, rounded up).
    expect(streetMargin({ w: 390, h: 844 }, { w: 400, h: 264 }, 3)).toEqual({ x: 0, y: 18 });
  });
  it("draws the street at most a little more than the stage, never nine times it", async () => {
    const { streetMargin } = await import("../src/street");
    for (const [stage, k] of [
      [{ w: 1920, h: 1080 }, 4],
      [{ w: 1440, h: 900 }, 3],
      [{ w: 390, h: 844 }, 3],
      [{ w: 2560, h: 1440 }, 5],
    ] as const) {
      const m = streetMargin(stage, { w: 400, h: 264 }, k);
      const drawn = (400 + 2 * m.x) * k * (264 + 2 * m.y) * k;
      // At most the room and the stage's whole gap on both sides: under twice the stage or the room, whichever is bigger.
      expect(drawn, `${stage.w}×${stage.h}`).toBeLessThanOrEqual(Math.max(stage.w, 400 * k) * Math.max(stage.h, 264 * k) * 2);
    }
  });
});
