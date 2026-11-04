// Crisp shapes (slice 13, ADR 0019): a canvas anti-aliases every path it
// fills or strokes, blending the edge into what's behind, so the room drew
// soft. These fill a polygon or trace its edge by whole room pixels instead,
// with fillRect, so every pixel is one colour. The stage's transform scales
// each room pixel to a whole block of screen pixels.

export interface Pt {
  x: number;
  y: number;
}

/**
 * The spans of a convex or concave polygon, row by row: for each pixel row,
 * the runs of pixels whose centres are inside it (the even-odd rule, as a
 * canvas decides inside before it blends).
 */
export function spans(pts: Pt[]): { y: number; x0: number; x1: number }[] {
  const out: { y: number; x0: number; x1: number }[] = [];
  if (pts.length < 3) return out;
  const top = Math.floor(Math.min(...pts.map((p) => p.y)));
  const bottom = Math.ceil(Math.max(...pts.map((p) => p.y)));
  for (let y = top; y < bottom; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      // Half-open in y, so a vertex on the row is counted once.
      if (a.y <= cy === b.y <= cy) continue;
      xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      // Pixels whose centre x + 0.5 lies in [xs[i], xs[i + 1]).
      const x0 = Math.ceil(xs[i] - 0.5);
      const x1 = Math.ceil(xs[i + 1] - 0.5);
      if (x1 > x0) out.push({ y, x0, x1 });
    }
  }
  return out;
}

/** Fills a polygon by whole room pixels. */
export function fillCrisp(ctx: CanvasRenderingContext2D, pts: Pt[], colour: string): void {
  ctx.fillStyle = colour;
  for (const s of spans(pts)) ctx.fillRect(s.x0, s.y, s.x1 - s.x0, 1);
}

/**
 * Traces a closed polygon's edge `width` room pixels wide, by whole pixels:
 * a step along each side, one pixel square at a time.
 */
export function strokeCrisp(ctx: CanvasRenderingContext2D, pts: Pt[], colour: string, width = 1): void {
  ctx.fillStyle = colour;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let k = 0; k <= n; k++) {
      const x = Math.floor(a.x + ((b.x - a.x) * k) / n);
      const y = Math.floor(a.y + ((b.y - a.y) * k) / n);
      ctx.fillRect(x - Math.floor((width - 1) / 2), y - Math.floor((width - 1) / 2), width, width);
    }
  }
}
