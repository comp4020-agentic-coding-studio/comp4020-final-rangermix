// The room's shapes in the isometric camera (slice 13, ADR 0019): points
// on the floor's grid raised by a height, and polygons, blocks and
// outlines filled and traced crisp, by whole room pixels. Shared by the
// room (render.ts) and the backdrop round it (backdrop.ts, slice 18).

import { fillCrisp, strokeCrisp } from "./crisp";
import { toCanvas } from "./iso";

type Ctx = CanvasRenderingContext2D;
type Pt = { x: number; y: number };

export function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `hex` darkened by `k` (0 to 1), or lightened by a negative `k`. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = rgb(hex).map((v) => Math.round(Math.max(0, Math.min(255, k >= 0 ? v * (1 - k) : v + (255 - v) * -k))));
  return `rgb(${r} ${g} ${b})`;
}

/** A polygon filled crisp, by whole room pixels (slice 13): no edge is blended. */
export function poly(ctx: Ctx, pts: Pt[], colour: string): void {
  fillCrisp(ctx, pts, colour);
}

/** A floor point raised by `z` pixels. */
export function up(gx: number, gy: number, z = 0): Pt {
  const p = toCanvas(gx, gy);
  return { x: p.x, y: p.y - z };
}

/**
 * A block standing on the floor over (x, y, w, h), `z` pixels tall: the two
 * faces the viewer sees from the front-right corner (the one toward the
 * street wall's near end, at x, and the one toward the front, at y + h),
 * then its top.
 */
export function block(ctx: Ctx, x: number, y: number, w: number, h: number, z: number, colour: string, z0 = 0): void {
  // Lit from the street wall's windows, a little from +x (shadows.ts): the
  // left face (toward -x) turns from the light a little, the front face
  // (toward +y) most, as in the study the look was chosen from (slice 13's
  // review, finding 7). A part raised off the floor (slice 11) starts at z0.
  poly(ctx, [up(x, y, z0), up(x, y + h, z0), up(x, y + h, z), up(x, y, z)], shade(colour, 0.12));
  poly(ctx, [up(x, y + h, z0), up(x + w, y + h, z0), up(x + w, y + h, z), up(x, y + h, z)], shade(colour, 0.28));
  poly(ctx, [up(x, y, z), up(x + w, y, z), up(x + w, y + h, z), up(x, y + h, z)], colour);
  // The self outline (slice 13, ADR 0019): the block's silhouette, a room
  // pixel wide, in its own colour darkened, so it stands off what's behind.
  outline(ctx, silhouette(x, y, w, h, z, z0), shade(colour, OUTLINE));
}

/** How much a piece's outline darkens its own colour. */
export const OUTLINE = 0.45;

/**
 * A block's outline as seen from the front-right corner: its top's back
 * three corners, then down its two visible faces to the floor.
 */
export function silhouette(x: number, y: number, w: number, h: number, z: number, z0 = 0): Pt[] {
  return [up(x, y, z), up(x + w, y, z), up(x + w, y + h, z), up(x + w, y + h, z0), up(x, y + h, z0), up(x, y, z0)];
}

export function diamond(x: number, y: number, w = 1, h = 1): Pt[] {
  return [up(x, y), up(x + w, y), up(x + w, y + h), up(x, y + h)];
}

/** A polygon's edge traced crisp, `width` room pixels wide (slice 13). */
export function outline(ctx: Ctx, pts: Pt[], colour: string, width = 1, closed = true): void {
  strokeCrisp(ctx, pts, colour, width, closed);
}

