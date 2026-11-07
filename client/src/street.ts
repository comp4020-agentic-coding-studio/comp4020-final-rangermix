import streetFile from "../../content/street.toml?raw";
import { ISO } from "./iso";

// The street behind the café (slice 13, ADR 0018): sky, the towers across
// the road, the kerb and the pavement, round the room's diamond. Its shape
// is content/street.toml, its colours the palette's "street" slots, so it
// changes with the hour as the room does.

/** The kinds of thing the terrace can have: each drawn as its own few blocks (render.ts). */
export const TERRACE_KINDS = ["bench", "planter", "table", "umbrella", "chair", "lamp"] as const;
export type TerraceKind = (typeof TERRACE_KINDS)[number];

/**
 * A thing on the terrace in the room's bottom corners (slice 16): its kind,
 * the floor's edge it stands by (its left, x = 0, or its front, y = the
 * floor's last row), how far along that edge from its back end in tiles,
 * and how far out from it. Scenery: off the server's grid, taking no click.
 */
export interface TerraceThing {
  kind: TerraceKind;
  side: "left" | "front";
  along: number;
  out: number;
}

/**
 * The balcony the terrace stands on (slice 18): a deck `out` tiles round
 * the floor's left and front edges, its own slab `slab` px deep, a glass
 * rail `rail` px high (0 for none) with a post every `posts` tiles, the
 * glass tinting what's behind it by `glass`, and under it the café's own
 * building in storeys `storey` px tall (0 for none), `lit` windows in 10
 * lit at night.
 */
export interface Deck {
  out: number;
  slab: number;
  rail: number;
  posts: number;
  glass: number;
  storey: number;
  lit: number;
}

export interface Street {
  horizon: number;
  /** How far up the sky the warm band by the skyline reaches, as a share of it. */
  glow: number;
  windows: { every: number; size: number; lit: number };
  towers: { width: number; height: number }[];
  clouds: { x: number; y: number; width: number }[];
  terrace: TerraceThing[];
  /** The balcony under the terrace, or null for none. */
  deck: Deck | null;
}

/** The street's slots in the palette's "street" list. */
export const STREET = { skyTop: 0, sky: 1, tower: 2, towerSide: 3, lit: 4, dark: 5, star: 6, kerb: 7, pavement: 8, cloud: 9, cloudShade: 10, glow: 11 } as const;

/**
 * Reads street.toml: top-level `key = number` lines, the `[windows]` and
 * `[deck]` tables, and `[[towers]]`, `[[clouds]]` and `[[terrace]]` tables. Enough TOML
 * for this one file, which the server's tests also read with a real parser.
 */
export function parseStreet(text: string): Street {
  type Table = Record<string, number | string>;
  const top: Table = {};
  const windows: Table = {};
  const towers: Table[] = [];
  const clouds: Table[] = [];
  const terrace: Table[] = [];
  let deck: Table | null = null;
  let into: Table = top;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    if (line === "[[towers]]") {
      into = {};
      towers.push(into);
    } else if (line === "[windows]") {
      into = windows;
    } else if (line === "[[clouds]]") {
      into = {};
      clouds.push(into);
    } else if (line === "[deck]") {
      into = deck = {};
    } else if (line === "[[terrace]]") {
      into = {};
      terrace.push(into);
    } else {
      const m = /^(\w+)\s*=\s*(-?[\d.]+)$/.exec(line);
      const q = /^(\w+)\s*=\s*"([^"]*)"$/.exec(line);
      if (m) into[m[1]] = Number(m[2]);
      else if (q) into[q[1]] = q[2];
      else throw new Error(`street.toml: can't read ${JSON.stringify(raw)}`);
    }
  }
  const things = terrace.map((t): TerraceThing => {
    if (!TERRACE_KINDS.includes(t.kind as TerraceKind)) throw new Error(`street.toml: the terrace has no ${JSON.stringify(t.kind)}`);
    if (t.side !== "left" && t.side !== "front") throw new Error(`street.toml: a terrace thing stands by the floor's left or front, not ${JSON.stringify(t.side)}`);
    return { kind: t.kind as TerraceKind, side: t.side, along: Number(t.along), out: Number(t.out) };
  });
  const n = (t: Table, key: string) => Number(t[key]);
  return {
    horizon: n(top, "horizon"),
    glow: n(top, "glow"),
    windows: { every: n(windows, "every"), size: n(windows, "size"), lit: n(windows, "lit") },
    towers: towers.map((t) => ({ width: n(t, "width"), height: n(t, "height") })),
    clouds: clouds.map((c) => ({ x: n(c, "x"), y: n(c, "y"), width: n(c, "width") })),
    terrace: things,
    deck: deck ? readDeck(deck, things) : null,
  };
}

/** Each of the deck's values and the range it must be in (the server's content test holds the file to the same). */
const DECK_RANGES: Record<keyof Deck, [number, number, boolean]> = {
  out: [1, 4, false],
  slab: [0, 12, true],
  rail: [0, 32, true],
  posts: [0.5, 6, false],
  glass: [0, 1, false],
  storey: [0, 96, true],
  lit: [0, 10, true],
};

function readDeck(t: Record<string, number | string>, terrace: TerraceThing[]): Deck {
  const deck = {} as Deck;
  for (const [key, [lo, hi, whole]] of Object.entries(DECK_RANGES) as [keyof Deck, [number, number, boolean]][]) {
    const v = t[key];
    if (typeof v !== "number" || v < lo || v > hi || (whole && !Number.isInteger(v))) {
      throw new Error(`street.toml: deck.${key} must be a ${whole ? "whole " : ""}number from ${lo} to ${hi}, not ${JSON.stringify(v)}`);
    }
    deck[key] = v;
  }
  // A building's storey is tall enough for a window and a band between floors.
  if (deck.storey !== 0 && deck.storey < 32) throw new Error(`street.toml: deck.storey is 0 for no building, or 32 to 96, not ${deck.storey}`);
  // The rail's top clears the floor's slab on screen, or the room, drawn
  // over the balcony, would cut it off: a tile out is 8 px lower, the rail
  // stands a little in from the edge, and the slab and its foot line take
  // 3 px (slice 18's review, finding 3; the server's content test holds the
  // file to the same, and a render test measures it).
  if (deck.rail > (deck.out - 0.2) * 16 - 3) {
    throw new Error(`street.toml: deck.rail ${deck.rail} px rises behind the floor's slab at deck.out ${deck.out}: lower it, or reach further out`);
  }
  // Every terrace thing stands on the deck, its blocks and shadow too: the
  // widest reaches 0.6 tiles across from its spot.
  for (const thing of terrace) {
    if (thing.out + 0.6 > deck.out) throw new Error(`street.toml: the terrace's ${thing.kind} at ${thing.out} tiles out reaches past the deck's edge at ${deck.out}`);
  }
  return deck;
}

export const street = parseStreet(streetFile);

/** A 4×4 ordered dither, so bands of sky step in a pattern, not a soft blend. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** A fixed pattern of lit windows: the same windows lit every frame, about `lit` in 10. */
function isLit(tower: number, col: number, row: number, lit: number): boolean {
  return (((tower * 7 + col * 13 + row * 29) * 2654435761) >>> 0) % 10 < lit;
}

/** A fixed scatter of stars: about one pixel in 140 of the upper sky. */
function isStar(x: number, y: number): boolean {
  return (((x * 7919) ^ (y * 104729)) >>> 0) % 140 === 0;
}

/**
 * Which of the street's slots is at backdrop pixel (x, y) at 1×, on a
 * backdrop `w` by `h`. `night` is whether stars show: only once the light
 * has turned.
 */
export function streetSlot(x: number, y: number, w: number, h: number, night: boolean): number {
  const horizon = Math.round(h * street.horizon);
  if (y >= horizon) {
    // The kerb, then the pavement, darkening down into the street's shade
    // below the room, in dithered steps, so the room stands on it.
    const d = y - horizon;
    if (d < 1) return STREET.kerb;
    const depth = d / (h - horizon);
    return depth * 3 + BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5 < 1 ? STREET.pavement : STREET.kerb;
  }
  // The towers, repeated across the backdrop.
  const total = street.towers.reduce((n, t) => n + t.width, 0);
  let at = ((x % total) + total) % total;
  let i = 0;
  while (at >= street.towers[i].width) {
    at -= street.towers[i].width;
    i++;
  }
  const tower = street.towers[i];
  const top = horizon - Math.round(horizon * tower.height);
  if (y >= top) {
    const { every, size, lit } = street.windows;
    const col = Math.floor(at / every);
    const row = Math.floor((horizon - 1 - y) / every);
    const inWindow = at % every < size && (horizon - 1 - y) % every < size && at >= 2 && at < tower.width - 2 && y > top + 1;
    if (inWindow) return isLit(i, col, row, lit) ? STREET.lit : STREET.dark;
    // Each tower lit on its left, in shade on its right, as the room is.
    return at >= tower.width - 3 ? STREET.towerSide : STREET.tower;
  }
  const cloud = cloudAt(x, y, w, horizon);
  if (cloud !== null) return cloud;
  if (night && isStar(x, y) && y < horizon * 0.7) return STREET.star;
  // Sky, darker at the top, in dithered bands down to the towers, warming
  // low down where the sky meets them (the user, 2026-11-05).
  const t = y / horizon;
  const d = BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;
  // The towers stand over the sky's lowest part, so the warm band starts at
  // the shortest tower's top and reaches up by `glow` of the sky, its top
  // edge dithered: it shows between the taller towers.
  const lowest = Math.min(...street.towers.map((tw) => tw.height));
  const above = (1 - lowest - t) / street.glow;
  if (street.glow > 0 && above + d < 0.5) return STREET.glow;
  return t * 4 + d < 2 ? STREET.skyTop : STREET.sky;
}

/**
 * A cloud's slot at backdrop pixel (x, y), or null for clear sky: each
 * cloud of street.toml where it floats, three soft lumps over a flat
 * underside, the underside's last row in its shade. Drawn at the
 * backdrop's 1×, whatever its size, since its spots are in those pixels.
 */
function cloudAt(x: number, y: number, _w: number, _horizon: number): number | null {
  for (const c of street.clouds) {
    const cw = c.width;
    const ch = Math.max(5, Math.round(cw * 0.32));
    const left = c.x - cw / 2;
    const base = c.y + Math.round(ch / 2);
    const u = x + 0.5 - left;
    const v = y + 0.5;
    if (u < 0 || u >= cw || v > base || v < base - ch) continue;
    // Three lumps across the cloud, the middle one tallest, on a flat underside.
    const lump = (cx: number, r: number) => ((u - cx) / r) ** 2 + ((v - (base - r * 0.7)) / (r * 0.8)) ** 2 <= 1;
    const inside = lump(cw * 0.28, cw * 0.2) || lump(cw * 0.52, cw * 0.27) || lump(cw * 0.76, cw * 0.19) || (v > base - ch * 0.4 && u > cw * 0.1 && u < cw * 0.9);
    if (!inside) continue;
    return v > base - 1.5 ? STREET.cloudShade : STREET.cloud;
  }
  return null;
}

/** One run of a row of the street: from `x`, `w` room pixels in one slot. */
export interface StreetRun {
  y: number;
  x: number;
  w: number;
  slot: number;
}

/**
 * The street over a span of room pixels (slice 16), from (x0, y0) to (x1,
 * y1), which can start left of and above the room's canvas and end past it:
 * each row as runs of one slot, the slots the room's own street has inside
 * its canvas and carrying on outside it, so the street runs to the window's
 * edges behind the room.
 */
export function streetRuns(span: { x0: number; y0: number; x1: number; y1: number }, night: boolean): StreetRun[] {
  const out: StreetRun[] = [];
  for (let y = span.y0; y < span.y1; y++) {
    let x = span.x0;
    while (x < span.x1) {
      const slot = streetSlot(x, y, ISO.width, ISO.height, night);
      let end = x + 1;
      while (end < span.x1 && streetSlot(end, y, ISO.width, ISO.height, night) === slot) end++;
      out.push({ y, x, w: end - x, slot });
      x = end;
    }
  }
  return out;
}

/**
 * Where a terrace thing stands, in tiles on the floor's grid (beyond it): by
 * the left edge it's `out` tiles left of x = 0 and `along` down from the
 * street wall's foot; by the front, `out` past the floor's last row and
 * `along` from its left corner.
 */
export function terraceAt(t: TerraceThing, room: { width: number; height: number }): { x: number; y: number } {
  return t.side === "left" ? { x: -t.out, y: 1 + t.along } : { x: t.along, y: room.height + t.out };
}

/**
 * How far past the room's canvas the street is drawn, in room pixels on
 * each side (slice 16's review, finding 8): as far as the stage can show
 * past the room, `stage` and the room's 1× size at scale `k`. The whole gap
 * either side, since the phone's bigger room can be panned against one
 * edge; on a desktop, where the room is centred, half of it shows.
 */
export function streetMargin(stage: { w: number; h: number }, room: { w: number; h: number }, k: number): { x: number; y: number } {
  return { x: Math.ceil(Math.max(0, stage.w - room.w * k) / k), y: Math.ceil(Math.max(0, stage.h - room.h * k) / k) };
}
