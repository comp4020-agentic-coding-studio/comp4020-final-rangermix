// What's outside the room (slice 18): the street behind the café (slice
// 13) and the terrace in the room's bottom corners (slice 16), drawn once
// per light into a raster over whatever span of room pixels a canvas needs.
// The room's floor layer takes the room's own span, the street's canvas a
// wider one round it (slice 16), so the two are the same pixels where they
// meet, and the terrace carries on past the room's canvas as the street
// does. Scenery: nothing here is picked or walked on.

import type { Light } from "./canberra";
import { FLOOR } from "./iso";
import { Raster } from "./layer";
import { block } from "./shapes";
import { paletteAt } from "./sprites";
import { type TerraceThing, street, streetRuns, terraceAt } from "./street";

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
  for (const t of street.terrace) drawTerrace(ctx, t, palette, light);
  cache.set(where, { made, raster });
  // A resize asks for a new span: keep the few in use, not every size seen.
  while (cache.size > 4) cache.delete(cache.keys().next().value!);
  return raster;
}

/** The street over the span (slice 13): each run its slot's colour in this light. */
function drawStreet(ctx: Ctx, span: Span, colours: string[], light: Light): void {
  for (const r of streetRuns(span, light >= 1)) {
    ctx.fillStyle = colours[r.slot];
    ctx.fillRect(r.x, r.y, r.w, 1);
  }
}

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
      // review, finding 2), so the terrace stays low.
      box(0, 0, 0.08, 0.08, 26, dark, 15);
      box(0, 0, 0.26, 0.26, 24, FURNITURE[1], 17);
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
