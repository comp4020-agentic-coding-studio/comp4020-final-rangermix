// The camera (slice 09, ADR 0017): the café's grid seen in a 2:1 isometric
// view. The grid stays the model; this is only how the client draws it and
// finds what's under a pointer. The floor is rows 1 to 9, each tile a 32 by
// 16 diamond. Row 0, the street wall with its window, door and chalkboard,
// stands up the back right, along the floor's far edge.

/** The canvas, the walls' height and where grid point (0,0) lands, in canvas pixels at 1x. */
export const ISO = {
  width: 336,
  height: 232,
  wall: 56,
  originX: 160,
  originY: 56,
  /** Half a diamond across, and half down. */
  halfW: 16,
  halfH: 8,
} as const;

/** Where grid point (gx, gy), on the floor, lands on the canvas. */
export function toCanvas(gx: number, gy: number): { x: number; y: number } {
  return { x: ISO.originX + (gx - gy) * ISO.halfW, y: ISO.originY + (gx + gy) * ISO.halfH };
}

/** The grid point on the floor under canvas point (px, py): `toCanvas`'s inverse. */
export function fromCanvas(px: number, py: number): { gx: number; gy: number } {
  const a = (px - ISO.originX) / ISO.halfW;
  const b = (py - ISO.originY) / ISO.halfH;
  return { gx: (a + b) / 2, gy: (b - a) / 2 };
}

/**
 * The tile under canvas point (px, py): a floor tile in rows 1 and below, or
 * row 0 if the point is on the street wall's face; null anywhere else.
 */
export function pickTile(px: number, py: number, room: { width: number; height: number }): { x: number; y: number } | null {
  const { gx, gy } = fromCanvas(px, py);
  if (gx >= 0 && gx < room.width && gy >= 1 && gy < room.height) return { x: Math.floor(gx), y: Math.floor(gy) };
  // The street wall: the vertical face standing on the floor's far edge,
  // gy = 1. A point on it is that edge's point raised by some height.
  const along = (px - ISO.originX) / ISO.halfW + 1;
  if (along < 0 || along >= room.width) return null;
  const foot = toCanvas(along, 1);
  const up = foot.y - py;
  return up > 0 && up <= ISO.wall ? { x: Math.floor(along), y: 0 } : null;
}

export interface Footprint {
  x: number;
  y: number;
  w: number;
  h: number;
  /**
   * Among things neither behind the other at the same distance, what's drawn
   * later: a seat, then whoever sits on it, then a cat on their lap.
   */
  layer?: number;
}

/** Whether `a` lies wholly behind `b`, further from the viewer along either axis. */
function behind(a: Footprint, b: Footprint): boolean {
  return a.x + a.w <= b.x || a.y + a.h <= b.y;
}

/**
 * Things standing on the floor, in the order they're drawn: everything wholly
 * behind another before it, so nothing nearer the viewer is painted over. A
 * single number for depth can't do it: a cat by the far end of a long sofa
 * and one beside it would tie. Among things neither behind the other, nearer
 * footprint centres come later, then higher layers.
 */
export function inDrawOrder<T extends Footprint>(items: T[]): T[] {
  const centre = (f: Footprint) => f.x + f.w / 2 + f.y + f.h / 2;
  const left = [...items].sort((a, b) => centre(a) - centre(b) || (a.layer ?? 0) - (b.layer ?? 0));
  const out: T[] = [];
  while (left.length > 0) {
    // The first, by centre, with nothing still to draw wholly behind it.
    let i = left.findIndex((a) => !left.some((b) => b !== a && behind(b, a) && !behind(a, b)));
    if (i < 0) i = 0;
    out.push(left.splice(i, 1)[0]);
  }
  return out;
}
