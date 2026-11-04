// Slice 11, part 1: Mochi at 24 px in every pose the café shows, front and
// back, for the user to judge before any other sprite is drawn (the spec's
// settled order: one cat first). Not yet the café's code: each frame is a
// grid of the coat's six palette slots, drawn from shapes the way the
// study's 24-px cats were (docs/notes/screens/art-style/scripts/study.html,
// catSit, catNap, catWalk, TWEAK.mochi), then written as
//   mochi/<frame>.txt   the grid, in content/sprites' text format, 24x24
//   mochi/<frame>.png   the grid in the day's colours, 1 px a pixel
//   ../mochi-sheet.png  every frame at the desktop's 4x and the phone's 3x,
//                       by day and by night, on the floor's own colours,
//                       beside today's 16-px cat
// Usage, from the repo root: node docs/notes/screens/slice-11/scripts/mochi.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../../..");
const pal = JSON.parse(fs.readFileSync(path.join(repo, "content/sprites/palettes.json"), "utf8"));

// Slots: 0 outline, 1 base, 2 shade, 3 light, 4 eyes, 5 pink (coats.json).
const [O, B, S, L, E, K] = [0, 1, 2, 3, 4, 5];
const N = 24;

// ---------- shapes in the unit square ----------
const ell = (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
const tri = (a, b, c) => (u, v) => {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([u, v], a, b), d2 = s([u, v], b, c), d3 = s([u, v], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const rect = (u0, v0, u1, v1) => (u, v) => u >= u0 && u < u1 && v >= v0 && v < v1;
const curve = (fx, fy, r) => (u, v) => {
  for (let i = 0; i <= 40; i++) { const t = i / 40; if ((u - fx(t)) ** 2 + (v - fy(t)) ** 2 <= r * r) return true; }
  return false;
};
const any = (...fs) => (u, v) => fs.some((f) => f(u, v));

/** A blank grid: -1 is clear. */
const blank = () => Array.from({ length: N }, () => new Array(N).fill(-1));

/**
 * Paints a cat from its parts. `parts` maps a part's name to its shape and
 * the centre and radius its light is measured from; later parts paint over
 * earlier ones. Lit from the top left: toward it the light slot, away the
 * shade. `chest` is Mochi's big white chest, `inner` her ears' pink.
 */
function paint(parts, { chest = null, inner = null, feet = null } = {}) {
  const g = blank();
  const part = Array.from({ length: N }, () => new Array(N).fill(""));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N;
      for (const [name, p] of parts) {
        if (!p.shape(u, v)) continue;
        const [cx, cy, r] = p.light;
        const lit = (u - cx + (v - cy)) / r;
        let c = B;
        if (lit > 0.75) c = S;
        if (lit < -0.95 && name !== "tail") c = L;
        if (chest && name === "body" && chest(u, v)) c = lit > 0.95 ? B : L;
        if (inner && name === "head" && inner(u, v)) c = K;
        if (feet && feet(u, v)) c = L;
        g[y][x] = c;
        part[y][x] = name;
      }
    }
  }
  return { g, part };
}

/**
 * The outline: a clear pixel touching the cat becomes the outline, or, on
 * the lit top-left rim at this size, the shade, so the light side reads
 * softer (the study's selective outline). Where the head overlaps the body,
 * a line between them.
 */
function outline({ g, part }) {
  const out = g.map((row) => row.slice());
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (g[y][x] >= 0) continue;
      const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => (g[y + dy]?.[x + dx] ?? -1) >= 0);
      if (!nb.length) continue;
      out[y][x] = nb.every(([dx, dy]) => dy === 1 || dx === 1) ? S : O;
    }
  }
  for (let y = 1; y < N; y++) for (let x = 0; x < N; x++) if (part[y][x] === "body" && part[y - 1][x] === "head" && out[y][x] !== L) out[y][x] = O;
  return out;
}

/** Sets single pixels, in unit coordinates, where the cat is drawn. */
function put(g, u, v, c, w = 1, h = 1) {
  const x0 = Math.floor(u * N), y0 = Math.floor(v * N);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((g[y0 + j]?.[x0 + i] ?? -1) >= 0) g[y0 + j][x0 + i] = c;
}

// Mochi: round, a big white chest, short ears, a medium tail (study.html, TWEAK.mochi).
const T = { f: 1.06, tip: 0.07, bw: 0.25, chest: 0.135, tail: 0.42 };

/** Sitting, facing right: the study's catSit. `tailUp` curls it higher, `lookUp` raises the head. */
function sit({ tailUp = 0, lookUp = 0, eyesShut = false, mouth = false } = {}) {
  const hy = 0.37 - lookUp;
  const head = ell(0.4, hy, 0.215 * T.f, 0.18 * T.f);
  const earL = tri([0.2, hy - 0.04], [0.23, T.tip - lookUp], [0.37, hy - 0.15]);
  const earR = tri([0.43, hy - 0.15], [0.57, T.tip - lookUp], [0.6, hy - 0.04]);
  const inner = any(tri([0.235, hy - 0.1], [0.245, T.tip + 0.06 - lookUp], [0.32, hy - 0.15]), tri([0.48, hy - 0.15], [0.555, T.tip + 0.06 - lookUp], [0.565, hy - 0.1]));
  const body = ell(0.5, 0.73, T.bw, 0.23);
  const legs = (u, v) => v > 0.8 && v < 0.97 && ((u > 0.33 && u < 0.42) || (u > 0.45 && u < 0.54));
  const tail = curve((s) => 0.7 + 0.2 * Math.sin(s * 2.4), (s) => 0.93 - (T.tail + tailUp) * s * s, 0.055);
  const cat = paint(
    [["tail", { shape: tail, light: [0.8, 0.7, 0.1] }], ["body", { shape: any(body, legs), light: [0.5, 0.73, 0.24] }], ["head", { shape: any(head, earL, earR), light: [0.4, hy, 0.2] }]],
    { chest: ell(0.4, 0.66, T.chest, 0.17), inner, feet: (u, v) => legs(u, v) && v > 0.93 },
  );
  const g = outline(cat);
  if (eyesShut) {
    put(g, 0.29, hy - 0.005, O, 2, 1);
    put(g, 0.46, hy - 0.005, O, 2, 1);
  } else {
    put(g, 0.3, hy - 0.015, E, 2, 2);
    put(g, 0.47, hy - 0.015, E, 2, 2);
    put(g, 0.3, hy - 0.015, O, 1, 2);
    put(g, 0.47, hy - 0.015, O, 1, 2);
  }
  put(g, 0.385, hy + 0.07, K, 1, 1);
  if (mouth) put(g, 0.37, hy + 0.11, O, 2, 1);
  return g;
}

/** Sitting with its back to the viewer, head right as every frame (slice 12's review, finding 1): ears and the back of the head, no face. */
function backSit() {
  const head = ell(0.6, 0.37, 0.2 * T.f, 0.17 * T.f);
  const earL = tri([0.42, 0.33], [0.45, T.tip], [0.57, 0.22]), earR = tri([0.63, 0.22], [0.75, T.tip], [0.78, 0.33]);
  const body = ell(0.5, 0.73, T.bw + 0.01, 0.23);
  const tail = curve((s) => 0.3 - 0.18 * Math.sin(s * 2.2), (s) => 0.95 - (T.tail - 0.05) * s * s, 0.055);
  const cat = paint([["body", { shape: body, light: [0.5, 0.73, 0.24] }], ["tail", { shape: tail, light: [0.25, 0.75, 0.1] }], ["head", { shape: any(head, earL, earR), light: [0.6, 0.37, 0.2] }]], {
    inner: any(tri([0.455, 0.3], [0.465, T.tip + 0.06], [0.54, 0.24]), tri([0.66, 0.24], [0.74, T.tip + 0.06], [0.755, 0.3])),
  });
  return outline(cat);
}

/** Walking, facing right: the study's catWalk. `frame` 0 or 1 swaps the legs. */
function walk(frame) {
  const body = ell(0.45, 0.6, T.bw + 0.02, 0.145);
  const head = ell(0.76, 0.46, 0.145 * T.f, 0.135 * T.f);
  const earL = tri([0.65, 0.4], [0.665, 0.23 - (0.07 - T.tip)], [0.745, 0.34]), earR = tri([0.76, 0.34], [0.835, 0.22 - (0.07 - T.tip)], [0.87, 0.4]);
  const xs = frame ? [0.3, 0.34, 0.56, 0.62] : [0.25, 0.37, 0.58, 0.66];
  const legs = (u, v) => v > 0.66 && v < 0.87 && xs.some((a) => u >= a && u < a + 0.065);
  const tail = curve((s) => 0.2 - 0.12 * s, (s) => 0.55 - T.tail * 0.75 * s + 0.04 * Math.sin(Math.PI * s), 0.045);
  const cat = paint(
    [["tail", { shape: tail, light: [0.15, 0.4, 0.1] }], ["body", { shape: any(body, legs), light: [0.45, 0.6, 0.22] }], ["head", { shape: any(head, earL, earR), light: [0.76, 0.46, 0.14] }]],
    { chest: ell(0.66, 0.63, 0.07, 0.08), inner: tri([0.785, 0.34], [0.83, 0.27], [0.85, 0.37]), feet: (u, v) => legs(u, v) && v > 0.83 },
  );
  const g = outline(cat);
  put(g, 0.79, 0.43, E, 2, 2);
  put(g, 0.79 + 2 / N, 0.43, O, 1, 2);
  put(g, 0.89, 0.49, K, 1, 1);
  return g;
}

/**
 * Walking away, up the screen and to the right, seen from behind and a
 * little to the side: the rump and the raised tail nearest the viewer, low
 * and left; the back foreshortened; the back of the head up and right, ears
 * up, no face. Head right, as every frame faces (slice 12's review,
 * finding 1). `frame` 0 or 1 swaps the hind legs.
 */
function walkAway(frame) {
  const rump = ell(0.4, 0.66, 0.2, 0.19);
  const back = ell(0.55, 0.53, 0.17, 0.15);
  const head = ell(0.7, 0.36, 0.15 * T.f, 0.14 * T.f);
  const earL = tri([0.56, 0.33], [0.59, 0.12], [0.68, 0.25]), earR = tri([0.72, 0.24], [0.82, 0.13], [0.85, 0.33]);
  const hx = frame ? [0.28, 0.45] : [0.32, 0.41];
  const legs = (u, v) => v > 0.78 && v < 0.95 && hx.some((a) => u >= a && u < a + 0.08);
  const fore = (u, v) => v > 0.62 && v < 0.78 && u >= (frame ? 0.62 : 0.66) && u < (frame ? 0.68 : 0.72);
  const tail = curve((s) => 0.3 - 0.1 * Math.sin(s * 2.2), (s) => 0.62 - 0.5 * s, 0.055);
  const cat = paint(
    [["body", { shape: any(back, fore), light: [0.55, 0.53, 0.2] }], ["body", { shape: any(rump, legs), light: [0.4, 0.66, 0.22] }], ["tail", { shape: tail, light: [0.28, 0.4, 0.12] }], ["head", { shape: any(head, earL, earR), light: [0.7, 0.36, 0.16] }]],
    { feet: (u, v) => legs(u, v) && v > 0.91 },
  );
  // The backs of the ears: the outline of each ear's inner edge, no pink, no face.
  return outline(cat);
}

/** Curled asleep: the study's catNap. */
function nap() {
  const body = ell(0.57, 0.75, 0.33, 0.19), head = ell(0.29, 0.69, 0.16 * T.f, 0.145 * T.f);
  const earL = tri([0.15, 0.66], [0.16, 0.5], [0.27, 0.58]), earR = tri([0.3, 0.57], [0.39, 0.49], [0.42, 0.63]);
  const tail = curve((s) => 0.88 - 0.48 * s, (s) => 0.85 + 0.07 * Math.sin(Math.PI * s), 0.055);
  const cat = paint([["body", { shape: body, light: [0.57, 0.75, 0.3] }], ["tail", { shape: tail, light: [0.62, 0.88, 0.12] }], ["head", { shape: any(head, earL, earR), light: [0.29, 0.69, 0.16] }]], {
    chest: ell(0.37, 0.8, T.chest, 0.08),
    inner: any(tri([0.175, 0.63], [0.18, 0.55], [0.24, 0.6]), tri([0.32, 0.58], [0.375, 0.53], [0.39, 0.61])),
  });
  const g = outline(cat);
  put(g, 0.2, 0.7, O, 2, 1);
  put(g, 0.315, 0.7, O, 2, 1);
  put(g, 0.265, 0.755, K, 1, 1);
  return g;
}

/** Eating: crouched low over the bowl, head down, facing right. */
function eat() {
  const body = ell(0.42, 0.72, 0.27, 0.17), head = ell(0.74, 0.74, 0.15 * T.f, 0.13 * T.f);
  const earL = tri([0.63, 0.7], [0.64, 0.52], [0.72, 0.62]), earR = tri([0.74, 0.62], [0.83, 0.53], [0.86, 0.68]);
  const legs = (u, v) => v > 0.8 && v < 0.95 && ((u > 0.28 && u < 0.36) || (u > 0.55 && u < 0.63));
  const tail = curve((s) => 0.17 - 0.08 * s, (s) => 0.72 - 0.3 * s, 0.05);
  const cat = paint([["tail", { shape: tail, light: [0.15, 0.6, 0.1] }], ["body", { shape: any(body, legs), light: [0.42, 0.72, 0.24] }], ["head", { shape: any(head, earL, earR), light: [0.74, 0.72, 0.14] }]], {
    chest: ell(0.6, 0.8, 0.08, 0.07),
    inner: tri([0.76, 0.62], [0.82, 0.56], [0.84, 0.66]),
    feet: (u, v) => legs(u, v) && v > 0.91,
  });
  const g = outline(cat);
  put(g, 0.76, 0.73, O, 2, 1);
  return g;
}

/** Playing: up on its hind legs, a paw out to bat, tail up; two frames. */
function play(frame) {
  const rise = frame ? 0.06 : 0;
  const body = ell(0.48, 0.68 - rise / 2, 0.2, 0.24), head = ell(0.56, 0.33 - rise, 0.19 * T.f, 0.16 * T.f);
  const earL = tri([0.38, 0.3 - rise], [0.4, 0.07 - rise], [0.52, 0.2 - rise]), earR = tri([0.58, 0.2 - rise], [0.71, 0.07 - rise], [0.74, 0.3 - rise]);
  const paw = frame ? curve((s) => 0.62 + 0.22 * s, (s) => 0.55 - 0.18 * s, 0.045) : curve((s) => 0.62 + 0.16 * s, (s) => 0.58 - 0.06 * s, 0.045);
  const legs = (u, v) => v > 0.84 && v < 0.97 && ((u > 0.36 && u < 0.45) || (u > 0.5 && u < 0.59));
  const tail = curve((s) => 0.3 - 0.15 * Math.sin(s * 2.6), (s) => 0.88 - 0.6 * s, 0.05);
  const cat = paint(
    [["tail", { shape: tail, light: [0.2, 0.6, 0.1] }], ["body", { shape: any(body, legs, paw), light: [0.48, 0.66, 0.22] }], ["head", { shape: any(head, earL, earR), light: [0.56, 0.33, 0.18] }]],
    { chest: ell(0.53, 0.62, 0.1, 0.15), inner: any(tri([0.41, 0.25 - rise], [0.42, 0.13 - rise], [0.48, 0.21 - rise]), tri([0.62, 0.21 - rise], [0.69, 0.13 - rise], [0.7, 0.25 - rise])), feet: (u, v) => legs(u, v) && v > 0.93 },
  );
  const g = outline(cat);
  put(g, 0.5, 0.31 - rise, E, 2, 2);
  put(g, 0.64, 0.31 - rise, E, 2, 2);
  put(g, 0.5, 0.31 - rise, O, 1, 2);
  put(g, 0.64, 0.31 - rise, O, 1, 2);
  put(g, 0.58, 0.38 - rise, K, 1, 1);
  return g;
}

/** Perched: sitting tall and upright, tail hanging down over the edge it sits on. */
function perch() {
  const head = ell(0.46, 0.27, 0.2 * T.f, 0.17 * T.f);
  const earL = tri([0.27, 0.24], [0.3, 0.03], [0.43, 0.13]), earR = tri([0.49, 0.13], [0.62, 0.03], [0.65, 0.24]);
  const body = ell(0.48, 0.6, 0.2, 0.25);
  const legs = (u, v) => v > 0.74 && v < 0.86 && ((u > 0.38 && u < 0.46) || (u > 0.5 && u < 0.58));
  const tail = curve((s) => 0.66 + 0.04 * s, (s) => 0.7 + 0.28 * s, 0.05);
  const cat = paint([["tail", { shape: tail, light: [0.7, 0.85, 0.1] }], ["body", { shape: any(body, legs), light: [0.48, 0.6, 0.22] }], ["head", { shape: any(head, earL, earR), light: [0.46, 0.27, 0.18] }]], {
    chest: ell(0.45, 0.55, 0.11, 0.17),
    inner: any(tri([0.3, 0.19], [0.31, 0.09], [0.38, 0.14]), tri([0.54, 0.14], [0.61, 0.09], [0.62, 0.19])),
    feet: (u, v) => legs(u, v) && v > 0.83,
  });
  const g = outline(cat);
  put(g, 0.37, 0.25, E, 2, 2);
  put(g, 0.52, 0.25, E, 2, 2);
  put(g, 0.37, 0.25, O, 1, 2);
  put(g, 0.52, 0.25, O, 1, 2);
  put(g, 0.45, 0.33, K, 1, 1);
  return g;
}

/** Held: hanging in someone's arms, front paws and head over, back legs and tail dangling. */
function held() {
  const head = ell(0.5, 0.3, 0.19 * T.f, 0.16 * T.f);
  const earL = tri([0.32, 0.27], [0.34, 0.07], [0.46, 0.17]), earR = tri([0.54, 0.17], [0.66, 0.07], [0.68, 0.27]);
  const body = ell(0.5, 0.6, 0.17, 0.2);
  const hind = (u, v) => v > 0.75 && v < 0.93 && ((u > 0.38 && u < 0.45) || (u > 0.55 && u < 0.62));
  const fore = (u, v) => v > 0.45 && v < 0.6 && ((u > 0.27 && u < 0.34) || (u > 0.66 && u < 0.73));
  const tail = curve((s) => 0.5 + 0.06 * Math.sin(s * 3), (s) => 0.78 + 0.2 * s, 0.045);
  const cat = paint([["tail", { shape: tail, light: [0.5, 0.88, 0.1] }], ["body", { shape: any(body, hind, fore), light: [0.5, 0.6, 0.2] }], ["head", { shape: any(head, earL, earR), light: [0.5, 0.3, 0.18] }]], {
    chest: ell(0.5, 0.55, 0.1, 0.14),
    inner: any(tri([0.35, 0.22], [0.36, 0.12], [0.42, 0.18]), tri([0.58, 0.18], [0.64, 0.12], [0.65, 0.22])),
    feet: (u, v) => (hind(u, v) && v > 0.89) || (fore(u, v) && v > 0.56),
  });
  const g = outline(cat);
  put(g, 0.41, 0.29, E, 2, 2);
  put(g, 0.55, 0.29, E, 2, 2);
  put(g, 0.41, 0.29, O, 1, 2);
  put(g, 0.55, 0.29, O, 1, 2);
  put(g, 0.49, 0.36, K, 1, 1);
  return g;
}

/** On a lap: loafed, paws tucked, eyes half shut, content. */
function lap() {
  const body = ell(0.5, 0.72, 0.32, 0.17), head = ell(0.33, 0.58, 0.17 * T.f, 0.15 * T.f);
  const earL = tri([0.18, 0.55], [0.2, 0.36], [0.3, 0.45]), earR = tri([0.34, 0.45], [0.44, 0.36], [0.47, 0.55]);
  const tail = curve((s) => 0.8 - 0.35 * s, (s) => 0.84 + 0.04 * Math.sin(Math.PI * s), 0.05);
  const cat = paint([["body", { shape: body, light: [0.5, 0.72, 0.28] }], ["tail", { shape: tail, light: [0.6, 0.86, 0.12] }], ["head", { shape: any(head, earL, earR), light: [0.33, 0.58, 0.16] }]], {
    chest: ell(0.38, 0.75, 0.1, 0.08),
    inner: any(tri([0.21, 0.5], [0.22, 0.41], [0.27, 0.46]), tri([0.37, 0.46], [0.42, 0.41], [0.44, 0.5])),
  });
  const g = outline(cat);
  put(g, 0.24, 0.58, O, 2, 1);
  put(g, 0.36, 0.58, O, 2, 1);
  put(g, 0.31, 0.63, K, 1, 1);
  return g;
}

/** Scratching: stretched up tall, front paws high on the post (at the right edge), back arched. */
function scratch() {
  const body = ell(0.5, 0.6, 0.15, 0.27), head = ell(0.62, 0.27, 0.15 * T.f, 0.13 * T.f);
  const earL = tri([0.5, 0.25], [0.52, 0.08], [0.6, 0.17]), earR = tri([0.63, 0.16], [0.73, 0.08], [0.76, 0.24]);
  const fore = curve((s) => 0.6 + 0.25 * s, (s) => 0.42 - 0.2 * s, 0.045);
  const hind = (u, v) => v > 0.82 && v < 0.97 && ((u > 0.4 && u < 0.48) || (u > 0.52 && u < 0.6));
  const tail = curve((s) => 0.36 - 0.14 * s, (s) => 0.8 - 0.1 * Math.sin(Math.PI * s) + 0.08 * s, 0.05);
  const cat = paint([["tail", { shape: tail, light: [0.28, 0.78, 0.1] }], ["body", { shape: any(body, fore, hind), light: [0.5, 0.6, 0.22] }], ["head", { shape: any(head, earL, earR), light: [0.62, 0.27, 0.14] }]], {
    chest: ell(0.56, 0.55, 0.08, 0.15),
    inner: any(tri([0.53, 0.21], [0.54, 0.12], [0.59, 0.17]), tri([0.66, 0.17], [0.71, 0.12], [0.73, 0.21])),
    feet: (u, v) => hind(u, v) && v > 0.93,
  });
  const g = outline(cat);
  put(g, 0.65, 0.25, E, 2, 2);
  put(g, 0.65 + 2 / N, 0.25, O, 1, 2);
  put(g, 0.73, 0.3, K, 1, 1);
  return g;
}

/** Knocking something over: crouched, one paw swiped out to the right, tail flicked up. */
function knock() {
  const body = ell(0.4, 0.68, 0.24, 0.2), head = ell(0.6, 0.48, 0.16 * T.f, 0.14 * T.f);
  const earL = tri([0.47, 0.45], [0.49, 0.27], [0.58, 0.36]), earR = tri([0.6, 0.36], [0.7, 0.27], [0.74, 0.44]);
  const paw = curve((s) => 0.55 + 0.38 * s, (s) => 0.7 - 0.1 * s, 0.045);
  const legs = (u, v) => v > 0.8 && v < 0.96 && ((u > 0.24 && u < 0.32) || (u > 0.44 && u < 0.52));
  const tail = curve((s) => 0.18 - 0.06 * s, (s) => 0.68 - 0.48 * s, 0.05);
  const cat = paint([["tail", { shape: tail, light: [0.15, 0.5, 0.1] }], ["body", { shape: any(body, legs, paw), light: [0.4, 0.68, 0.24] }], ["head", { shape: any(head, earL, earR), light: [0.6, 0.48, 0.14] }]], {
    chest: ell(0.52, 0.68, 0.09, 0.12),
    inner: any(tri([0.5, 0.41], [0.51, 0.31], [0.56, 0.37]), tri([0.63, 0.37], [0.69, 0.31], [0.71, 0.41])),
    feet: (u, v) => legs(u, v) && v > 0.92,
  });
  const g = outline(cat);
  put(g, 0.6, 0.46, E, 2, 2);
  put(g, 0.6 + 2 / N, 0.46, O, 1, 2);
  put(g, 0.7, 0.52, K, 1, 1);
  return g;
}

/**
 * Mirrored left to right. Every frame faces right, head on the right, as
 * the café mirrors a cat walking left (slice 12's review, finding 1); the
 * study drew its sitting and sleeping cats facing left, so those turn.
 */
const right = (g) => g.map((row) => row.slice().reverse());

/** Mochi's frames, in the order the sheet shows them, with what each is for. */
const FRAMES = [
  ["sit", right(sit()), "sitting (idle, sit, groom)"],
  ["walk_a", walk(0), "walking"],
  ["walk_b", walk(1), "walking, the other step"],
  ["back_sit", backSit(), "sitting, back turned"],
  ["back_walk_a", walkAway(0), "walking away"],
  ["back_walk_b", walkAway(1), "walking away, the other step"],
  ["nap", right(nap()), "asleep"],
  ["eat", eat(), "eating from the bowl"],
  ["play_a", play(0), "playing"],
  ["play_b", play(1), "playing, batting"],
  ["perch", perch(), "perched on the window seat"],
  ["held", held(), "held in someone's arms"],
  ["lap", right(lap()), "on a lap"],
  ["scratch", scratch(), "scratching the post"],
  ["knock", knock(), "knocking something over"],
  ["greet", right(sit({ tailUp: 0.12, lookUp: 0.03, mouth: true })), "greeting someone, tail up"],
];

// ---------- writing ----------
const SLOTS = "0123456789abcdef";
const out = path.join(here, "../mochi");
fs.mkdirSync(out, { recursive: true });

/** A PNG of `w` by `h` RGBA bytes. */
function png(w, h, rgba) {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = ~0; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

let text = "";
for (const [name, g] of FRAMES) {
  text += `== ${name}\n${g.map((row) => row.map((v) => (v < 0 ? "." : SLOTS[v])).join("")).join("\n")}\n\n`;
  const rgba = Buffer.alloc(N * N * 4);
  g.forEach((row, y) => row.forEach((v, x) => { if (v >= 0) rgba.set([...rgbOf(pal.day.coats.white_grey[v]), 255], (y * N + x) * 4); }));
  fs.writeFileSync(path.join(out, `${name}.png`), png(N, N, rgba));
}
fs.writeFileSync(path.join(out, "mochi.txt"), text.trimEnd() + "\n");

// ---------- the sheet ----------
// Today's 16-px cat, for comparison.
const old = new Map();
{
  let cur = null;
  for (const line of fs.readFileSync(path.join(repo, "content/sprites/cat.txt"), "utf8").split("\n")) {
    if (line.startsWith("== ")) { cur = line.slice(3).trim(); old.set(cur, []); }
    else if (line.trim() && cur) old.get(cur).push([...line].map((ch) => (ch === "." ? -1 : SLOTS.indexOf(ch))));
  }
}
// A 5x7 pixel font for the labels: just what the sheet needs.
const FONT = {
  A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110", C: "01111100001000010000100001000001111", D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111", G: "01111100001000010111100011000101111", H: "10001100011000111111100011000110001", I: "01110001000010000100001000010001110",
  K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111", M: "10001110111010110101100011000110001", N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000", R: "11110100011000111110101001001010001", S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100", U: "10001100011000110001100011000101110", W: "10001100011000110101101011101110001", X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100", 0: "01110100011001110101110011000101110", 1: "00100011000010000100001000010001110", 3: "11110000010000101110000010000111110",
  4: "00010001100101010010111110001000010", 6: "01110100001000011110100011000101110", " ": "00000000000000000000000000000000000", "-": "00000000000000011111000000000000000",
  2: "01110100010000100010001000100011111", F: "11111100001000011110100001000010000", J: "00111000100001000010100101001001100", V: "10001100011000110001100010101000100",
  _: "00000000000000000000000000000011111", Q: "01110100011000110001101011001001101", Z: "11111000010001000100010001000011111",
  ",": "00000000000000000000000000110001000", ".": "00000000000000000000000000000001100", "(": "00010001000100001000010000010000010", ")": "01000001000001000010000100010001000",
};
const scales = [["DESKTOP 4X", 4], ["PHONE 3X", 3]];
const lights = [["DAY", "day"], ["NIGHT", "night"]];
const cellW = (s) => N * s + 12;
const W = 16 + 70 * 1 + FRAMES.reduce((a) => a + cellW(4), 0);
const rowH = (s) => N * s + 24 + (s === 3 ? 14 : 0);
const H = 40 + lights.length * scales.reduce((a, [, s]) => a + rowH(s), 0) + 20;
const sheet = Buffer.alloc(W * H * 4);
const fill = (x0, y0, w, h, hex) => { const [r, g, b] = rgbOf(hex); for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) sheet.set([r, g, b, 255], (y * W + x) * 4); };
const label = (x, y, s, hex, k = 1) => { for (const ch of s.toUpperCase()) { const f = FONT[ch] ?? FONT[" "]; for (let i = 0; i < 35; i++) if (f[i] === "1") fill(x + (i % 5) * k, y + Math.floor(i / 5) * k, k, k, hex); x += 6 * k; } };
const blit = (g, colours, x0, y0, s) => g.forEach((row, y) => row.forEach((v, x) => { if (v >= 0) fill(x0 + x * s, y0 + y * s, s, s, colours[v]); }));

fill(0, 0, W, H, "#1e1e2e");
label(16, 12, "MOCHI AT 24 PX, EVERY POSE (SLICE 11, FOR JUDGING)", "#cdd6f4", 2);
let y = 40;
for (const [lname, light] of lights) {
  const coat = pal[light].coats.white_grey;
  const floor = [pal[light].room[0], pal[light].room[1]];
  for (const [sname, s] of scales) {
    label(16, y + 6, lname, "#a6adc8");
    label(16, y + 18, sname, "#a6adc8");
    let x = 16 + 70;
    FRAMES.forEach(([name, g], i) => {
      // Each frame on a patch of the floor in this light, the boards alternating.
      fill(x, y, N * s + 8, N * s + 8, floor[i % 2]);
      blit(g, coat, x + 4, y + 4, s);
      // Its name under the last row of each light.
      if (s === 3) label(x, y + N * s + 12, name.replace("back_", "bk_"), "#a6adc8");
      x += cellW(4);
    });
    y += rowH(s);
  }
}
fs.writeFileSync(path.join(here, "../mochi-sheet.png"), png(W, H, sheet));

// The same frames beside today's 16-px ones, at the desktop's 4x, by day.
{
  const pairs = [["sit", "sit"], ["walk_a", "walk_a"], ["back_walk_a", "back_walk_a"], ["nap", "nap"]];
  const s = 4, pw = 16 * s + N * s + 40, W2 = 16 + pairs.length * pw, H2 = N * s + 60;
  const b2 = Buffer.alloc(W2 * H2 * 4);
  const f2 = (x0, y0, w, h, hex) => { const [r, g, b] = rgbOf(hex); for (let yy = y0; yy < y0 + h; yy++) for (let xx = x0; xx < x0 + w; xx++) if (xx >= 0 && yy >= 0 && xx < W2 && yy < H2) b2.set([r, g, b, 255], (yy * W2 + xx) * 4); };
  f2(0, 0, W2, H2, "#1e1e2e");
  pairs.forEach(([a, b], i) => {
    const x = 16 + i * pw;
    f2(x, 20, 16 * s + 8, N * s + 8, pal.day.room[0]);
    old.get(a)?.forEach((row, yy) => row.forEach((v, xx) => { if (v >= 0) f2(x + 4 + xx * s, 20 + 4 + (N - 16) * s + yy * s, s, s, pal.day.coats.white_grey[v]); }));
    f2(x + 16 * s + 16, 20, N * s + 8, N * s + 8, pal.day.room[1]);
    FRAMES.find(([n]) => n === b)[1].forEach((row, yy) => row.forEach((v, xx) => { if (v >= 0) f2(x + 16 * s + 20 + xx * s, 24 + yy * s, s, s, pal.day.coats.white_grey[v]); }));
  });
  fs.writeFileSync(path.join(here, "../mochi-16-and-24.png"), png(W2, H2, b2));
}
console.log(`wrote ${FRAMES.length} frames to ${out}, and the sheets`);
