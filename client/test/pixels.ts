// A small software canvas for tests (slice 13): fillRect, the transform,
// save and restore, and nothing that blends. Paths aren't drawn: a call to
// fill or stroke is recorded, so a test can hold that the room never asks
// the canvas for a shape it would anti-alias.

export interface Pixels {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** The colour at (x, y), as "#rrggbb", or null where nothing was drawn. */
  at(x: number, y: number): string | null;
  /** Every colour drawn, by how many pixels have it. */
  colours(): Map<string, number>;
  /** Calls that would blend: fill and stroke of paths, fills at less than full alpha, and images off the grid or smoothed. */
  blended: string[];
  /** Images drawn at less than full alpha: see-through on purpose (a hiding cat). */
  seeThrough: string[];
}

export function pixels(width: number, height: number): Pixels {
  const grid: (string | null)[] = new Array(width * height).fill(null);
  const blended: string[] = [];
  /** Images drawn see-through: a hiding cat, which is meant to be. */
  const seeThrough: string[] = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack: { m: number[]; fill: string; alpha: number }[] = [];
  let fill = "#000000";
  let alpha = 1;
  const norm = (c: string) => {
    const s = String(c).trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    const rgb = /^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)\)$/.exec(s);
    if (rgb) return `#${rgb.slice(1).map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
    return s;
  };
  const ctx = {
    get fillStyle() {
      return fill;
    },
    set fillStyle(v: string) {
      fill = norm(v);
    },
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(v: number) {
      alpha = v;
    },
    strokeStyle: "#000000",
    lineWidth: 1,
    imageSmoothingEnabled: false,
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      m = [a, b, c, d, e, f];
    },
    getTransform() {
      return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] };
    },
    save() {
      stack.push({ m: [...m], fill, alpha });
    },
    restore() {
      const s = stack.pop();
      if (s) ({ m, fill, alpha } = s);
    },
    translate(x: number, y: number) {
      m = [m[0], m[1], m[2], m[3], m[4] + m[0] * x + m[2] * y, m[5] + m[1] * x + m[3] * y];
    },
    scale(x: number, y: number) {
      m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]];
    },
    fillRect(x: number, y: number, w: number, h: number) {
      if (alpha < 1) blended.push(`fillRect at alpha ${alpha}`);
      // Device rectangle; a mirror (negative scale) flips it.
      const xs = [m[0] * x + m[4], m[0] * (x + w) + m[4]].sort((a, b) => a - b);
      const ys = [m[3] * y + m[5], m[3] * (y + h) + m[5]].sort((a, b) => a - b);
      if (![...xs, ...ys].every(Number.isInteger)) blended.push(`fillRect off the pixel grid at (${xs}, ${ys})`);
      for (let py = Math.max(0, Math.round(ys[0])); py < Math.min(height, Math.round(ys[1])); py++) {
        for (let px = Math.max(0, Math.round(xs[0])); px < Math.min(width, Math.round(xs[1])); px++) grid[py * width + px] = fill;
      }
    },
    clearRect() {},
    // An image is drawn as-is, but a blended one is recorded (slice 13's
    // review, finding 12): at a fraction of a device pixel, scaled to one,
    // under alpha, or with smoothing on.
    drawImage(img: { width?: number; height?: number }, ...args: number[]) {
      // (img, dx, dy), (img, dx, dy, dw, dh) or (img, sx, sy, sw, sh, dx, dy, dw, dh).
      const [x, y, w, h] = args.length === 2 ? [args[0], args[1], img?.width ?? 0, img?.height ?? 0] : args.length === 4 ? args : args.slice(4, 8);
      const corners = [m[0] * x + m[4], m[0] * (x + w) + m[4], m[3] * y + m[5], m[3] * (y + h) + m[5]];
      const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-6;
      if (alpha < 1) seeThrough.push(`drawImage at alpha ${alpha}`);
      if (!corners.every(whole)) blended.push(`drawImage off the pixel grid at (${corners.map((v) => +v.toFixed(3))})`);
      if ((ctx as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled) blended.push("drawImage with smoothing on");
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    fill() {
      blended.push(`fill ${fill}`);
    },
    stroke() {
      blended.push("stroke");
    },
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    width,
    height,
    at: (x, y) => grid[y * width + x],
    colours() {
      const seen = new Map<string, number>();
      for (const c of grid) if (c) seen.set(c, (seen.get(c) ?? 0) + 1);
      return seen;
    },
    blended,
    seeThrough,
  };
}
