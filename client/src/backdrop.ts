// What's outside the room (slice 18): the street behind the café (slice
// 13) and the terrace in the room's bottom corners (slice 16), drawn once
// per light into a raster over whatever span of room pixels a canvas needs.
// The room's floor layer takes the room's own span, the street's canvas a
// wider one round it (slice 16), so the two are the same pixels where they
// meet, and the terrace carries on past the room's canvas as the street
// does. Scenery: nothing here is picked or walked on.

import type { Light } from "./canberra";
import { FLOOR, fromCanvas } from "./iso";
import { Raster, SHADOW, darken } from "./layer";
import { spans } from "./crisp";
import { OUTLINE, block, outline, poly, rgb, shade, up } from "./shapes";
import { paletteAt } from "./sprites";
import { type Deck, type TerraceThing, street, streetRuns, terraceAt } from "./street";

type Ctx = CanvasRenderingContext2D;

/** A span of room pixels, from (x0, y0) up to but not including (x1, y1). */
export interface Span {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How deep the floor's slab shows under its front edges (render.ts): the terrace stands at its foot. */
const SLAB = 6;

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
  if (kept?.made === made) return kept.raster;
  const raster = new Raster(span.x1 - span.x0, span.y1 - span.y0, span.x0, span.y0);
  const ctx = raster.context();
  const palette = paletteAt(light);
  drawStreet(ctx, span, palette.street, light);
  if (street.deck && street.deck.storey > 0) drawBuilding(ctx, span, street.deck, palette.room, palette.balcony);
  if (street.deck) drawDeck(ctx, span, street.deck, palette.balcony, palette.room);
  for (const t of street.terrace) drawTerrace(ctx, t, palette, light);
  if (street.deck && street.deck.rail > 0) drawRail(raster, ctx, span, street.deck, palette.balcony);
  cache.set(where, { made, raster });
  // A resize asks for a new span: keep the few in use, not every size seen.
  while (cache.size > 4) cache.delete(cache.keys().next().value!);
  return raster;
}

/**
 * Every colour the backdrop draws over `span` in a light, for the browser
 * checks (slice 18): what's outside the room, told from the page's own
 * background, now that the café's building stands where the pavement was.
 */
export function backdropColours(span: Span, light: Light): string[] {
  return [...new Set(backdrop(span, light).runs().map((r) => r.colour))];
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
  const { back, right: W } = reach(span, deck);
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
 * by a fixed pattern. Down past the span's foot, so it never ends on screen.
 */
function drawBuilding(ctx: Ctx, span: Span, deck: Deck, room: string[], colours: string[]): void {
  const [, , , , , windowDark, windowOn] = colours;
  const wall = room[3];
  const band = room[4];
  const frame = room[5];
  const { back, right: W } = reach(span, deck);
  const xo = -deck.out;
  const yo = FLOOR.height + deck.out;
  // The faces start under the deck's slab: z is up from the floor's level.
  const zt = -SLAB - deck.slab;
  // Deep enough to reach past the span's foot from the deck's highest point.
  const bottom = zt - (span.y1 - Math.min(up(xo, back).y, up(W, yo).y)) - 8;
  type Face = "left" | "front";
  const face = (f: Face, a: number, b: number, z0: number, z1: number, colour: string) =>
    poly(ctx, f === "left" ? [up(xo, a, z0), up(xo, b, z0), up(xo, b, z1), up(xo, a, z1)] : [up(a, yo, z0), up(b, yo, z0), up(b, yo, z1), up(a, yo, z1)], colour);
  // How each face is lit, as the room's blocks are (shapes.ts).
  const lightOf: Record<Face, number> = { left: 0.12, front: 0.28 };
  const ends: Record<Face, [number, number]> = { left: [back, yo], front: [xo, W] };
  for (const f of ["left", "front"] as Face[]) {
    const [a, b] = ends[f];
    // As "#rrggbb", which `darken` reads (`shade` gives "rgb(…)").
    const faceColour = darken(wall, lightOf[f]);
    face(f, a, b, bottom, zt, faceColour);
    // The balcony's shadow on the wall, just under the slab.
    face(f, a, b, zt - 5, zt, darken(faceColour, SHADOW));
    for (let k = 0; ; k++) {
      const top = zt - 12 - k * deck.storey;
      if (top - deck.storey < bottom) break;
      // The band between this storey and the one below.
      face(f, a, b, top - deck.storey + 18, top - deck.storey + 15, shade(band, lightOf[f]));
      // A window a tile wide in each tile along the face, in its frame.
      for (let g = Math.floor(a); g < b; g++) {
        const [w0, w1] = [Math.max(g + 0.15, a + 0.1), Math.min(g + 0.85, b - 0.1)];
        if (w1 - w0 < 0.3) continue;
        face(f, w0, w1, top - 26, top, shade(frame, lightOf[f]));
        const on = windowLit(f === "left" ? 0 : 1, g, k, deck.lit);
        face(f, w0 + 0.07, w1 - 0.07, top - 24, top - 2, on ? windowOn : windowDark);
      }
    }
  }
  // The building's corner where its two faces meet, and its far ends.
  outline(ctx, [up(xo, yo, zt), up(xo, yo, bottom)], shade(wall, OUTLINE), 1, false);
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
  const { back, right: W } = reach(span, deck);
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
  // Posts counted from the floor's corners (the street wall's line, the
  // floor's right end), so they stand in the same places whatever the span.
  for (let gy = 1 - deck.posts * Math.ceil((1 - back) / deck.posts); gy < yo; gy += deck.posts) post(xo, gy);
  post(xo, yo);
  for (let gx = FLOOR.width + deck.posts * Math.floor((W - FLOOR.width) / deck.posts); gx > xo + 0.3; gx -= deck.posts) post(gx, yo);
  edgeLine(ctx, xo, yo, back, W, top, metal);
  edgeLine(ctx, xo, yo, back, W, top + 1, shade(metal, -0.25));
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
 * How far the balcony runs along the building's face (slice 18): the left
 * arm from `back`, back past the street wall's line, and the front arm to
 * `right`, on past the floor's right end, each far enough to leave the span
 * on screen, so the café is one unit on a longer upper-floor balcony and
 * no end of it shows. In tiles along each edge.
 */
function reach(span: Span, deck: Deck): { back: number; right: number } {
  // A point's grid spot along the left edge (x = -out) or the front (y = H + out).
  const xo = -deck.out;
  const yo = FLOOR.height + deck.out;
  // A screen point stands straight below the face's point with the same
  // gx + gy, since across the screen is (gx + gy) · 16: on the left face
  // (gx = xo) that's t = gx + gy − xo along it, and on the front (gy = yo)
  // gx + gy − yo (slice 18's review, finding 1).
  const alongLeft = (px: number, py: number) => {
    const { gx, gy } = fromCanvas(px, py);
    return gx + gy - xo;
  };
  const alongFront = (px: number, py: number) => {
    const { gx, gy } = fromCanvas(px, py);
    return gx + (gy - yo);
  };
  const back = Math.min(1, Math.floor(Math.min(alongLeft(span.x0, span.y0), alongLeft(span.x0, span.y1), alongLeft(span.x1, span.y0))) - 2);
  const right = Math.max(FLOOR.width, Math.ceil(Math.max(alongFront(span.x1, span.y0), alongFront(span.x1, span.y1), alongFront(span.x0, span.y1))) + 2);
  return { back, right };
}

/** How far a terrace thing's shadow reaches round its spot on the deck, in tiles, across and along. */
const SHADOW_UNDER: Record<TerraceThing["kind"], (side: TerraceThing["side"]) => [number, number]> = {
  bench: (side) => (side === "left" ? [0.42, 1.3] : [1.3, 0.42]),
  planter: () => [0.55, 0.55],
  table: () => [0.6, 0.6],
  umbrella: () => [0, 0],
  chair: () => [0.36, 0.36],
  lamp: () => [0.3, 0.3],
};

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
