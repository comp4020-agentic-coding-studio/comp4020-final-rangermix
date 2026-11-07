// What's outside the room (slice 18): the street behind the café (slice
// 13) and the terrace in the room's bottom corners (slice 16), drawn once
// per light into a raster over whatever span of room pixels a canvas needs.
// The room's floor layer takes the room's own span, the street's canvas a
// wider one round it (slice 16), so the two are the same pixels where they
// meet, and the terrace and its balcony carry on past the room's canvas as
// the street does, to the café's walls' lines, where the balcony ends
// (slice 19). Scenery: nothing here is picked or walked on.

import type { Light } from "./canberra";
import { FLOOR, fromCanvas } from "./iso";
import { Raster, SHADOW, darken } from "./layer";
import { spans } from "./crisp";
import { OUTLINE, SLAB, block, outline, poly, rgb, shade, up } from "./shapes";
import { paletteAt } from "./sprites";
import { type Deck, TERRACE_REACH, type TerraceThing, street, streetRuns, terraceAt } from "./street";

type Ctx = CanvasRenderingContext2D;

/** A span of room pixels, from (x0, y0) up to but not including (x1, y1). */
export interface Span {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}


/** The last backdrop made for each span, and what it was made from: a canvas asks for the same one every frame. */
const cache = new Map<string, { made: string; raster: Raster }>();

/**
 * The backdrop over `span` in a light: the street, then the terrace on it,
 * nearest the viewer. Made again only when the light or the street's
 * content changes (a test can change the terrace).
 */
export function backdrop(span: Span, light: Light): Raster {
  const where = `${span.x0},${span.y0},${span.x1},${span.y1}`;
  const made = `${light}:${JSON.stringify(street.terrace)}:${JSON.stringify(street.deck)}`;
  const kept = cache.get(where);
  if (kept?.made === made) {
    // Asked for again: kept longest (slice 18's review, finding 6).
    cache.delete(where);
    cache.set(where, kept);
    return kept.raster;
  }
  // Inside a span already built in this light: cut from it, the same
  // pixels, since the backdrop is drawn the same over any span (slice 18's
  // review, finding 5: a light turn built it twice).
  const around = [...cache.values()].find((c) => c.made === made && c.raster.x0 <= span.x0 && c.raster.y0 <= span.y0 && c.raster.x0 + c.raster.width >= span.x1 && c.raster.y0 + c.raster.height >= span.y1);
  const raster = around ? cut(around.raster, span) : build(span, light);
  cache.set(where, { made, raster });
  // A resize asks for a new span: keep the few in use, not every size seen.
  while (cache.size > 4) cache.delete(cache.keys().next().value!);
  return raster;
}

/** How many backdrops have been drawn from scratch, for the tests. */
let built = 0;
export const builds = (): number => built;

function build(span: Span, light: Light): Raster {
  built++;
  const raster = new Raster(span.x1 - span.x0, span.y1 - span.y0, span.x0, span.y0);
  const ctx = raster.context();
  const palette = paletteAt(light);
  drawStreet(ctx, span, palette.street, light);
  if (street.deck && street.deck.storey > 0) drawBuilding(ctx, span, street.deck, palette.room, palette.balcony);
  if (street.deck) drawDeck(ctx, span, street.deck, palette.balcony, palette.room);
  if (street.deck) drawEnds(ctx, span, street.deck, palette.room);
  if (street.deck && street.deck.rail > 0) drawReturns(raster, ctx, street.deck, palette.balcony);
  for (const t of street.terrace) drawTerrace(ctx, t, palette, light);
  if (street.deck && street.deck.rail > 0) drawRail(raster, ctx, span, street.deck, palette.balcony);
  return raster;
}

/** The part of `from` over `span`, in a raster of its own. */
function cut(from: Raster, span: Span): Raster {
  const r = new Raster(span.x1 - span.x0, span.y1 - span.y0, span.x0, span.y0);
  for (let y = 0; y < r.height; y++) {
    const src = (y + span.y0 - from.y0) * from.width + (span.x0 - from.x0);
    for (let x = 0; x < r.width; x++) r.px[y * r.width + x] = from.px[src + x];
  }
  return r;
}

/** The street over the span (slice 13): each run its slot's colour in this light. */
function drawStreet(ctx: Ctx, span: Span, colours: string[], light: Light): void {
  for (const r of streetRuns(span, light >= 1)) {
    ctx.fillStyle = colours[r.slot];
    ctx.fillRect(r.x, r.y, r.w, 1);
  }
}

/**
 * The deck the terrace stands on (slice 18): stone tiles in the room's angle,
 * an L round the floor's left and front edges at the foot of its slab,
 * `out` tiles wide; its own slab under its two outer edges, lit on the left
 * and darker at the front as the room's is; and a shadow on the stone under
 * each terrace thing, as the room's own shadows darken its floor.
 */
function drawDeck(ctx: Ctx, span: Span, deck: Deck, colours: string[], room: string[]): void {
  const [stoneA, stoneB, edge] = colours;
  const { back, right: W } = ends();
  const H = FLOOR.height;
  const z = -SLAB;
  const xo = -deck.out;
  const yo = H + deck.out;
  // A tile at (x, y), cut at the deck's outer edges.
  const tile = (x: number, y: number) => {
    const [a, b] = [Math.max(x, xo), Math.min(y + 1, yo)];
    poly(ctx, [up(a, y, z), up(x + 1, y, z), up(x + 1, b, z), up(a, b, z)], (((x + y) % 2) + 2) % 2 ? stoneB : stoneA);
  };
  // The left arm, from back past the street wall's line down to the front,
  // then the front arm on past the floor's right end, the corner where they
  // meet once.
  for (let y = back; y < yo; y++) for (let x = Math.floor(xo); x < 0; x++) tile(x, y);
  for (let y = H; y < yo; y++) for (let x = 0; x < W; x++) tile(x, y);
  // Where the floor's slab meets the deck, its foot's dark line, as the
  // room's floor layer draws it over the deck's inner row (render.ts), so
  // the deck carries it and the room covers nothing of the balcony (slice
  // 18's review, findings 2 and 3).
  outline(ctx, [up(0, 1, z), up(0, H, z), up(FLOOR.width, H, z)], shade(room[2], 0.65), 1, false);
  // The terrace's shadows on the stone, before the things stand on them.
  for (const t of street.terrace) {
    if (t.kind === "umbrella") continue;
    const at = terraceAt(t, FLOOR);
    const [rx, ry] = SHADOW_UNDER[t.kind](t.side);
    for (const s of spans([up(at.x - rx, at.y - ry, z), up(at.x + rx, at.y - ry, z), up(at.x + rx, at.y + ry, z), up(at.x - rx, at.y + ry, z)])) {
      for (let x = s.x0; x < s.x1; x++) {
        const { gx, gy } = fromCanvas(x + 0.5, s.y + 0.5 + SLAB);
        ctx.fillStyle = darken((((Math.floor(gx) + Math.floor(gy)) % 2) + 2) % 2 ? stoneB : stoneA, SHADOW);
        ctx.fillRect(x, s.y, 1, 1);
      }
    }
  }
  // Its slab, under the two outer edges, and the edge's line.
  if (deck.slab > 0) {
    poly(ctx, [up(xo, back, z), up(xo, yo, z), up(xo, yo, z - deck.slab), up(xo, back, z - deck.slab)], shade(edge, 0.12));
    poly(ctx, [up(xo, yo, z), up(W, yo, z), up(W, yo, z - deck.slab), up(xo, yo, z - deck.slab)], shade(edge, 0.28));
  }
  edgeLine(ctx, xo, yo, back, W, z, shade(edge, OUTLINE));
}

/**
 * The café's own building under the balcony (slice 18; the user,
 * 2026-11-07: "D"): its two faces below the deck's outer edges, in the
 * room's wall colour lit as the room's blocks are (the left face a little
 * shaded, the front more); the balcony's shadow just under its slab; then
 * storeys `storey` px tall, each a band between floors and a row of
 * windows a tile apart in the room's frame colour, `lit` in 10 lit at night
 * by a fixed pattern. Along each face from the café's wall's line to the
 * corner (slice 19), and down past the span's foot, so it never ends on
 * screen below.
 */
function drawBuilding(ctx: Ctx, span: Span, deck: Deck, room: string[], colours: string[]): void {
  const [, , , , , windowDark, windowOn] = colours;
  const wall = room[3];
  const band = room[4];
  const frame = room[5];
  const { back, right: W } = ends();
  const xo = -deck.out;
  const yo = FLOOR.height + deck.out;
  // The faces start under the deck's slab: z is up from the floor's level.
  const zt = -SLAB - deck.slab;
  const bottom = foot(span, deck);
  type Face = "left" | "front";
  const face = (f: Face, a: number, b: number, z0: number, z1: number, colour: string) =>
    poly(ctx, f === "left" ? [up(xo, a, z0), up(xo, b, z0), up(xo, b, z1), up(xo, a, z1)] : [up(a, yo, z0), up(b, yo, z0), up(b, yo, z1), up(a, yo, z1)], colour);
  // How each face is lit, as the room's blocks are (shapes.ts).
  const lightOf: Record<Face, number> = { left: 0.12, front: 0.28 };
  const along: Record<Face, [number, number]> = { left: [back, yo], front: [xo, W] };
  for (const f of ["left", "front"] as Face[]) {
    const [a, b] = along[f];
    // As "#rrggbb", which `darken` reads (`shade` gives "rgb(…)").
    const faceColour = darken(wall, lightOf[f]);
    face(f, a, b, bottom, zt, faceColour);
    // The balcony's shadow on the wall, just under the slab.
    face(f, a, b, zt - 5, zt, darken(faceColour, SHADOW));
    for (let k = 0; ; k++) {
      const top = zt - 12 - k * deck.storey;
      // Every storey any of whose face is over the span's foot, drawn whole:
      // one cut off where it reached past the foot changed with the span.
      if (top < bottom) break;
      // The band between this storey and the one below.
      face(f, a, b, top - deck.storey + 18, top - deck.storey + 15, shade(band, lightOf[f]));
      // A window a tile wide in each tile along the face, in its frame.
      // A window in each tile along the face, kept inside the face: the
      // building's corner, where its two faces meet, and its ends at the
      // café's walls (slice 19) trim one that would cross them.
      const [lo, hi] = along[f];
      for (let g = Math.floor(a); g < b; g++) {
        const [w0, w1] = [Math.max(g + 0.15, lo + 0.1), Math.min(g + 0.85, hi - 0.1)];
        if (w1 - w0 < 0.3) continue;
        face(f, w0, w1, top - 26, top, shade(frame, lightOf[f]));
        const on = windowLit(f === "left" ? 0 : 1, g, k, deck.lit);
        face(f, w0 + 0.07, w1 - 0.07, top - 24, top - 2, on ? windowOn : windowDark);
      }
    }
  }
  // The building's corner where its two faces meet (its ends: drawEnds).
  outline(ctx, [up(xo, yo, zt), up(xo, yo, bottom)], shade(wall, OUTLINE), 1, false);
}

/** How far down the building's faces go, in px up from the floor's level: past the span's foot from the deck's highest point. */
function foot(span: Span, deck: Deck): number {
  const { back, right } = ends();
  const zt = -SLAB - deck.slab;
  return zt - (span.y1 - Math.min(up(-deck.out, back).y, up(right, FLOOR.height + deck.out).y)) - 8;
}

/**
 * Where the balcony ends at the café's walls (slice 19): a dark edge down
 * each end, from the deck's top, down its slab and the building's wall
 * under it, in the wall's outline colour, as the building's corner has, so
 * each end reads as the building's edge with the street past it.
 */
function drawEnds(ctx: Ctx, span: Span, deck: Deck, room: string[]): void {
  const { back, right } = ends();
  const z = -SLAB;
  const lowest = deck.storey > 0 ? foot(span, deck) : z - deck.slab;
  const edge = shade(room[3], OUTLINE);
  outline(ctx, [up(-deck.out, back, z), up(-deck.out, back, lowest)], edge, 1, false);
  outline(ctx, [up(right, FLOOR.height + deck.out, z), up(right, FLOOR.height + deck.out, lowest)], edge, 1, false);
}

/** A fixed pattern of the building's lit windows: about `lit` in 10, the same every night. */
function windowLit(face: number, along: number, storey: number, lit: number): boolean {
  return (((face * 7 + along * 13 + storey * 29 + 101) * 2654435761) >>> 0) % 10 < lit;
}

/**
 * The glass balustrade along the deck's outer edges (slice 18), `rail` px
 * high, nearest the viewer of all: each pane tints what's already drawn
 * behind it toward the glass's colour by `glass`, pixel by pixel, so every
 * pixel stays one solid colour (ADR 0019); then posts every `posts` tiles
 * and a handrail along the top, in the rail's metal, as blocks.
 */
function drawRail(raster: Raster, ctx: Ctx, span: Span, deck: Deck, colours: string[]): void {
  const glass = colours[3];
  const metal = colours[4];
  const { back, right: W } = ends();
  const z = -SLAB;
  // Set in from the deck's edge a little, so the slab's edge shows below it.
  const xo = -deck.out + 0.08;
  const yo = FLOOR.height + deck.out - 0.08;
  const top = z + deck.rail;
  const panes = [
    [up(xo, back, z), up(xo, yo, z), up(xo, yo, top), up(xo, back, top)],
    [up(xo, yo, z), up(W, yo, z), up(W, yo, top), up(xo, yo, top)],
  ];
  for (const pane of panes) {
    for (const s of spans(pane)) {
      for (let x = s.x0; x < s.x1; x++) {
        const behind = raster.at(x, s.y);
        if (!behind) continue;
        ctx.fillStyle = mix(behind, glass, deck.glass);
        ctx.fillRect(x, s.y, 1, 1);
      }
    }
  }
  // Posts, from the street wall's end down the left and along the front, and
  // one at the corner; then the handrail, a bar along the top.
  const post = (gx: number, gy: number) => block(ctx, gx - 0.05, gy - 0.05, 0.1, 0.1, top, metal, z);
  // Posts counted from the balcony's ends at the café's walls (the street
  // wall's line, the plain wall's), down the left arm and back along the
  // front, and one at the corner.
  for (let gy = back; gy < yo; gy += deck.posts) post(xo, gy);
  post(xo, yo);
  for (let gx = W; gx > xo + 0.3; gx -= deck.posts) post(gx, yo);
  edgeLine(ctx, xo, yo, back, W, top, metal);
  edgeLine(ctx, xo, yo, back, W, top + 1, shade(metal, -0.25));
}

/**
 * The glass turning each end of the balcony back to the café's wall (slice
 * 19; the user, 2026-11-08: "3A"), so the balcony is closed on every side:
 * along the street wall's line from the deck's outer edge to the wall, and
 * along the plain wall's line from the wall to the front's outer edge. The
 * same glass as the front, set the same way in from the deck's edge,
 * tinting what's behind it pixel by pixel (ADR 0019), with its handrail and
 * a post at the wall. Drawn behind the terrace's things, which stand nearer
 * the viewer than either return.
 */
function drawReturns(raster: Raster, ctx: Ctx, deck: Deck, colours: string[]): void {
  const glass = colours[3];
  const metal = colours[4];
  const { back, right } = ends();
  const z = -SLAB;
  const top = z + deck.rail;
  const xo = -deck.out + 0.08;
  const yo = FLOOR.height + deck.out - 0.08;
  const H = FLOOR.height;
  const panes = [
    [up(xo, back, z), up(0, back, z), up(0, back, top), up(xo, back, top)],
    [up(right, H, z), up(right, yo, z), up(right, yo, top), up(right, H, top)],
  ];
  for (const pane of panes) {
    for (const s of spans(pane)) {
      for (let x = s.x0; x < s.x1; x++) {
        const behind = raster.at(x, s.y);
        if (!behind) continue;
        ctx.fillStyle = mix(behind, glass, deck.glass);
        ctx.fillRect(x, s.y, 1, 1);
      }
    }
  }
  // A post at each wall, on the glass's line just short of the wall's end:
  // the room is drawn over the backdrop, so anything on the wall's own line
  // would be cut by the wall (the render test of what the room covers). On
  // screen across is (gx + gy) · 16, so the left post keeps gx + gy under
  // the street wall's corner and the front one over the plain wall's. The
  // deck's corner posts are the front glass's.
  const GAP = 0.07;
  block(ctx, -GAP - 0.1, back - 0.05, 0.1, 0.1, top, metal, z);
  block(ctx, right - 0.05, H + GAP, 0.1, 0.1, top, metal, z);
  // The handrail along each return's top, as the front's: the metal, and a
  // darker line over it, stopping as short of the wall.
  for (const [a, b] of [
    [up(xo, back, top), up(-GAP, back, top)],
    [up(right, H + GAP, top), up(right, yo, top)],
  ]) {
    outline(ctx, [a, b], metal, 1, false);
    outline(ctx, [{ x: a.x, y: a.y - 1 }, { x: b.x, y: b.y - 1 }], shade(metal, -0.25), 1, false);
  }
}

/** `a` mixed toward `b` by `t`, as "#rrggbb". */
function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A line along the balcony's edges, traced a tile at a time between whole
 * grid points: traced end to end, a longer line steps through slightly
 * different pixels, so the room's canvas and the street's, which draw the
 * balcony over different spans, would disagree. Down the left edge from
 * `back` to the corner, then along the front to `right`, `z` px up.
 */
function edgeLine(ctx: Ctx, xo: number, yo: number, back: number, right: number, z: number, colour: string): void {
  const marks = (from: number, to: number) => {
    const out = [from];
    for (let g = Math.floor(from) + 1; g < to; g++) out.push(g);
    out.push(to);
    return out;
  };
  const down = marks(back, yo);
  for (let i = 0; i + 1 < down.length; i++) outline(ctx, [up(xo, down[i], z), up(xo, down[i + 1], z)], colour, 1, false);
  const along = marks(xo, right);
  for (let i = 0; i + 1 < along.length; i++) outline(ctx, [up(along[i], yo, z), up(along[i + 1], yo, z)], colour, 1, false);
}

/**
 * Where the balcony ends (slice 19; the user, 2026-11-08: "1A 2A 3A"): the
 * left arm at the street wall's line (y = 1) and the front arm at the
 * plain wall's (x = width), where the café's walls end, so the café is its
 * building's corner, cut out as the room is, and past each end the street
 * shows. The same over every span, at any window's size. In tiles along
 * each edge: the left arm from `back` to the deck's outer corner, the
 * front from the corner to `right`.
 */
function ends(): { back: number; right: number } {
  return { back: 1, right: FLOOR.width };
}

/** How far a terrace thing's shadow reaches round its spot on the deck, in tiles, across x and along y: its reach (street.ts), turned to its edge. */
const SHADOW_UNDER: Record<TerraceThing["kind"], (side: TerraceThing["side"]) => [number, number]> = Object.fromEntries(
  Object.entries(TERRACE_REACH).map(([kind, r]) => [kind, kind === "umbrella" ? () => [0, 0] : (side: TerraceThing["side"]) => (side === "left" ? [r.across, r.along] : [r.along, r.across])]),
) as Record<TerraceThing["kind"], (side: TerraceThing["side"]) => [number, number]>;

/**
 * A thing on the terrace (slice 16), on the pavement at the slab's foot: a
 * few blocks for its kind, in the furniture's colours and the hour's light,
 * with the room's outlines. Scenery: nothing picks it.
 */
function drawTerrace(ctx: Ctx, t: TerraceThing, palette: ReturnType<typeof paletteAt>, light: Light): void {
  const FURNITURE = palette.furniture;
  const ROOM = palette.room;
  const at = terraceAt(t, FLOOR);
  /** A block `w` by `h` tiles centred on the thing's spot, from `z0` to `z` px over the pavement. */
  const box = (dx: number, dy: number, w: number, h: number, z: number, colour: string, z0 = 0) =>
    block(ctx, at.x + dx - w / 2, at.y + dy - h / 2, w, h, z - SLAB, colour, z0 - SLAB);
  // Along the left edge, a long thing lies along y; out front, along x.
  const long = (len: number, deep: number) => (t.side === "left" ? [deep, len] : [len, deep]);
  const wood = FURNITURE[14];
  const dark = FURNITURE[12];
  switch (t.kind) {
    case "bench": {
      const [w, h] = long(2.4, 0.6);
      const [lw, lh] = long(0.12, 0.12);
      for (const k of [-1, 1]) {
        const [dx, dy] = t.side === "left" ? [0, k * 1.05] : [k * 1.05, 0];
        box(dx, dy, lw, lh, 7, dark);
      }
      box(0, 0, w, h, 9, wood, 7);
      // Its back, on the side away from the café.
      const [bw, bh] = long(2.4, 0.14);
      const [bx, by] = t.side === "left" ? [-0.23, 0] : [0, 0.23];
      box(bx, by, bw, bh, 18, wood, 9);
      break;
    }
    case "planter":
      box(0, 0, 0.9, 0.9, 10, FURNITURE[8]);
      box(0, 0, 0.74, 0.74, 18, FURNITURE[6], 10);
      box(0, 0, 0.5, 0.5, 23, FURNITURE[7], 18);
      break;
    case "table":
      box(0, 0, 0.14, 0.14, 13, dark);
      box(0, 0, 1.1, 1.1, 15, FURNITURE[5], 13);
      break;
    case "umbrella":
      // Folded, a closed parasol over the table: tall things out front
      // would stand over the floor's front tiles on screen (slice 16's
      // review, finding 2), so the terrace stays low; and since the room is
      // drawn over the terrace, low enough that the floor's slab hides none
      // of its tip (slice 18's review, finding 2).
      box(0, 0, 0.08, 0.08, 23, dark, 15);
      box(0, 0, 0.26, 0.26, 22, FURNITURE[1], 16);
      break;
    case "chair":
      box(0, 0, 0.55, 0.55, 9, FURNITURE[11]);
      box(0, 0.2, 0.55, 0.15, 17, FURNITURE[11], 9);
      break;
    case "lamp":
      // A low lantern on a short post, not a street lamp (finding 2).
      box(0, 0, 0.16, 0.16, 12, dark);
      // Lit at night in the window's glass, warm yellow then.
      box(0, 0, 0.42, 0.42, 18, light >= 1 ? ROOM[8] : FURNITURE[5], 12);
      break;
  }
}
