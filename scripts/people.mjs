// The people's sprites (slice 11): someone 32 px tall, front and back,
// standing and two steps of a walk, drawn from shapes as the study's
// people were (docs/notes/screens/art-style/scripts/study.html, person),
// in the avatar palette's seven slots, so each visitor's skin, hair and
// shirt colour still swap. Written as content/sprites/png/person/<frame>.png
// in avatar 0's colours with shirt 0, which scripts/sprites.ts turns into
// content/sprites/avatar.txt, and a sheet to judge from in
// docs/notes/screens/slice-11/people-sheet.png.
// Usage, from the repo root: node scripts/people.mjs, then node scripts/sprites.ts
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pal = JSON.parse(fs.readFileSync(path.join(repo, "content/sprites/palettes.json"), "utf8"));

// Slots: 0 outline and eyes, 1 skin, 2 hair, 3 shirt, 4 trousers, 5 shoes, 6 white.
const [O, SK, HA, SH, TR, SO, WH] = [0, 1, 2, 3, 4, 5, 6];
const N = 32;
const ell = (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
const rect = (u0, v0, u1, v1) => (u, v) => u >= u0 && u < u1 && v >= v0 && v < v1;

/**
 * Someone `view` front or back, `frame` 0 standing or 1 and 2 the walk's
 * steps. Lit from the top left: the right side of the shirt and trousers
 * a shade darker is done with the outline's selective rim below, since the
 * palette has one slot each.
 */
function person(view, frame) {
  const g = Array.from({ length: N }, () => new Array(N).fill(-1));
  // Proportions for someone about 31 px tall in a 32-px frame, slimmer than
  // the study's square box: a head 9 px, a torso 10, legs 9, feet 2.
  const head = ell(0.5, 0.155, 0.14, 0.13), cap = ell(0.5, 0.12, 0.155, 0.115);
  const hair = view === "back" ? (u, v) => (head(u, v) && v < 0.27) || cap(u, v) : (u, v) => cap(u, v) && (v < 0.13 || (Math.abs(u - 0.5) > 0.1 && v < 0.21));
  const neck = rect(0.455, 0.27, 0.545, 0.31);
  const torso = (u, v) => rect(0.36, 0.3, 0.64, 0.6)(u, v) && !((u < 0.39 || u > 0.61) && v < 0.33);
  const swing = frame === 1 ? 0.03 : frame === 2 ? -0.03 : 0;
  const arms = (u, v) => rect(0.29, 0.32 + swing, 0.36, 0.54 + swing)(u, v) || rect(0.64, 0.32 - swing, 0.71, 0.54 - swing)(u, v);
  const hands = (u, v) => rect(0.29, 0.54 + swing, 0.36, 0.59 + swing)(u, v) || rect(0.64, 0.54 - swing, 0.71, 0.59 - swing)(u, v);
  const legs = frame === 1 ? [rect(0.37, 0.6, 0.48, 0.91), rect(0.52, 0.6, 0.63, 0.88)] : frame === 2 ? [rect(0.37, 0.6, 0.48, 0.88), rect(0.52, 0.6, 0.63, 0.91)] : [rect(0.38, 0.6, 0.49, 0.91), rect(0.51, 0.6, 0.62, 0.91)];
  const feet = frame === 1 ? [rect(0.36, 0.91, 0.49, 0.96), rect(0.51, 0.88, 0.64, 0.93)] : frame === 2 ? [rect(0.36, 0.88, 0.49, 0.93), rect(0.51, 0.91, 0.64, 0.96)] : [rect(0.37, 0.91, 0.5, 0.96), rect(0.5, 0.91, 0.63, 0.96)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N, v = (y + 0.5) / N;
      let c = -1;
      if (legs.some((f) => f(u, v))) c = TR;
      if (feet.some((f) => f(u, v))) c = SO;
      if (torso(u, v)) c = SH;
      if (arms(u, v)) c = SH;
      if (hands(u, v)) c = SK;
      if (neck(u, v)) c = SK;
      if (head(u, v)) c = SK;
      if (hair(u, v)) c = HA;
      g[y][x] = c;
    }
  }
  if (view === "front") {
    // Eyes, and a white glint in each at this size.
    for (const ex of [0.43, 0.55]) {
      const x = Math.floor(ex * N), y = Math.floor(0.16 * N);
      g[y][x] = O;
      g[y + 1][x] = O;
    }
  }
  // The outline, all round.
  const out = g.map((row) => row.slice());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] >= 0) continue;
    if ([[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => (g[y + dy]?.[x + dx] ?? -1) >= 0)) out[y][x] = O;
  }
  return out;
}

const FRAMES = [
  ["stand", person("front", 0)],
  ["walk_a", person("front", 1)],
  ["walk_b", person("front", 2)],
  ["back", person("back", 0)],
  ["back_walk_a", person("back", 1)],
  ["back_walk_b", person("back", 2)],
];

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
const lookColours = (light, avatar, colour) => {
  const a = pal[light].avatars;
  return [a.base[0], a.skins[avatar], a.hair[avatar], a.colours[colour], a.base[1], a.base[2], a.base[3]];
};

// The art, in avatar 0 with shirt 0 by day: the key scripts/sprites.ts reads.
const dir = path.join(repo, "content/sprites/png/person");
fs.mkdirSync(dir, { recursive: true });
const key = lookColours("day", 0, 0);
for (const [name, g] of FRAMES) {
  const rgba = Buffer.alloc(N * N * 4);
  g.forEach((row, y) => row.forEach((v, x) => { if (v >= 0) rgba.set([...rgbOf(key[v]), 255], (y * N + x) * 4); }));
  fs.writeFileSync(path.join(dir, `${name}.png`), png(N, N, rgba));
}

// The sheet: every frame for each of the four avatars, at the desktop's 4x, by day and by night.
const s = 4, cell = N * s + 10, W = 16 + FRAMES.length * cell, H = 16 + 8 * cell;
const sheet = Buffer.alloc(W * H * 4);
const fill = (x0, y0, w, h, hex) => { const [r, g, b] = rgbOf(hex); for (let y = Math.max(0, y0); y < Math.min(H, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(W, x0 + w); x++) sheet.set([r, g, b, 255], (y * W + x) * 4); };
fill(0, 0, W, H, "#1e1e2e");
let row = 0;
for (const light of ["day", "night"]) {
  for (let avatar = 0; avatar < 4; avatar++) {
    const colours = lookColours(light, avatar, avatar + 1);
    FRAMES.forEach(([, g], i) => {
      const x0 = 16 + i * cell, y0 = 16 + row * cell;
      fill(x0, y0, N * s + 4, N * s + 4, pal[light].room[i % 2]);
      g.forEach((r, y) => r.forEach((v, x) => { if (v >= 0) fill(x0 + 2 + x * s, y0 + 2 + y * s, s, s, colours[v]); }));
    });
    row++;
  }
}
fs.writeFileSync(path.join(repo, "docs/notes/screens/slice-11/people-sheet.png"), png(W, H, sheet));
console.log(`drew ${FRAMES.length} frames into content/sprites/png/person/, and the people's sheet`);
