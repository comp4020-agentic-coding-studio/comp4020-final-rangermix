// The floor layer (slice 13's review, findings 2, 3 and 6): the street, the
// slab, the boards and their seams, and the pieces others stand on (the rug),
// drawn once into a raster at 1×, then darkened where the windows' shadows
// and the floor's occlusion fall, pixel by pixel, whatever was drawn there.
// It changes only when the light or the furniture does, so a frame lays it
// on in one go instead of drawing twenty thousand runs.

import { ISO } from "./iso";
import { SHADE, type ShadowMask } from "./shadows";

/** A raster of "#rrggbb" colours, or null where nothing was drawn. */
export class Raster {
  readonly px: (string | null)[];
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.px = new Array(width * height).fill(null);
  }

  at(x: number, y: number): string | null {
    return x < 0 || y < 0 || x >= this.width || y >= this.height ? null : this.px[y * this.width + x];
  }

  /**
   * A drawing context that fills whole pixels of this raster: enough of a
   * canvas's for `fillCrisp`, `strokeCrisp` and `fillRect` in room pixels.
   */
  context(): CanvasRenderingContext2D {
    let fill = "#000000";
    const self = this;
    const norm = (c: string) => {
      const s = String(c).trim();
      if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
      const m = /^rgb\((\d+)[ ,]+(\d+)[ ,]+(\d+)\)$/.exec(s);
      if (m) return `#${m.slice(1).map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`;
      throw new Error(`the floor layer can't read the colour ${s}`);
    };
    return {
      get fillStyle() {
        return fill;
      },
      set fillStyle(v: string) {
        fill = norm(v);
      },
      fillRect(x: number, y: number, w: number, h: number) {
        for (let py = Math.max(0, Math.round(y)); py < Math.min(self.height, Math.round(y + h)); py++) {
          for (let px = Math.max(0, Math.round(x)); px < Math.min(self.width, Math.round(x + w)); px++) self.px[py * self.width + px] = fill;
        }
      },
    } as unknown as CanvasRenderingContext2D;
  }

  /** Each run of one colour along each row, for drawing it with fillRect. */
  runs(): { y: number; x: number; w: number; colour: string }[] {
    const out: { y: number; x: number; w: number; colour: string }[] = [];
    for (let y = 0; y < this.height; y++) {
      let x = 0;
      while (x < this.width) {
        const c = this.px[y * this.width + x];
        let end = x + 1;
        while (end < this.width && this.px[y * this.width + end] === c) end++;
        if (c) out.push({ y, x, w: end - x, colour: c });
        x = end;
      }
    }
    return out;
  }
}

/** How much a cast shadow and a foot's occlusion darken what's under them. */
export const SHADOW = 0.2;
export const OCCLUDED = 0.12;

/** `hex` darkened by `k`, as "#rrggbb". */
export function darken(hex: string, k: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(Math.max(0, Math.min(255, v * (1 - k)))).toString(16).padStart(2, "0")).join("")}`;
}

/** Darkens the raster where the mask shades it: whatever is drawn there, board, seam or rug. */
export function shadeLayer(layer: Raster, mask: ShadowMask): void {
  for (let y = 0; y < layer.height; y++) {
    for (let x = 0; x < layer.width; x++) {
      const m = mask.at(x, y);
      const c = layer.px[y * layer.width + x];
      if (m === SHADE.lit || !c) continue;
      layer.px[y * layer.width + x] = darken(c, m === SHADE.shadow ? SHADOW : OCCLUDED);
    }
  }
}

/**
 * Draws a finished layer at the room's origin: as one image where the
 * context can take a canvas (a browser), else as its runs (a test's
 * software canvas). The image is the raster at 1×, drawn under the room's
 * whole-number transform with smoothing off, so it blends nothing.
 */
export function drawLayer(ctx: CanvasRenderingContext2D, layer: Raster, image: () => CanvasImageSource | null): void {
  const img = typeof document !== "undefined" && typeof HTMLCanvasElement !== "undefined" ? image() : null;
  if (img) {
    ctx.drawImage(img, 0, 0);
    return;
  }
  for (const r of layer.runs()) {
    ctx.fillStyle = r.colour;
    ctx.fillRect(r.x, r.y, r.w, 1);
  }
}

/** The raster as a canvas, or null where there's no real 2D canvas (jsdom). */
export function toCanvas(layer: Raster): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = layer.width;
  canvas.height = layer.height;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }
  if (!ctx || typeof ImageData === "undefined") return null;
  const bytes = new Uint8ClampedArray(layer.width * layer.height * 4);
  layer.px.forEach((c, i) => {
    if (!c) return;
    const n = Number.parseInt(c.slice(1), 16);
    bytes.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });
  ctx.putImageData(new ImageData(bytes, layer.width, layer.height), 0, 0);
  return canvas;
}

export const LAYER_SIZE = { width: ISO.width, height: ISO.height };
