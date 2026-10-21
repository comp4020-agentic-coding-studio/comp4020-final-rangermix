// Throwaway density study: one sitting cat, built from the same shapes, rasterised
// at 16, 24 and 32 px with light from the top left, a selective outline and
// (for the tabby) stripes, next to the café's current hand-drawn 16-px cat.
// Usage: node density.mjs <repo> <palettes.json> <out.png>
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [repo, palPath, out] = process.argv.slice(2);
const pal = JSON.parse(fs.readFileSync(palPath, "utf8"));
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Parts in a unit square; each returns true if (u,v) is inside.
const ell = (cx, cy, rx, ry) => (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1;
const tri = (a, b, c) => (u, v) => {
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = s([u, v], a, b), d2 = s([u, v], b, c), d3 = s([u, v], c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
};
const tail = (u, v) => {
  for (let t = 0; t <= 1; t += 0.02) {
    const x = 0.7 + 0.2 * Math.sin(t * 2.4), y = 0.93 - 0.42 * t * t;
    if ((u - x) ** 2 + (v - y) ** 2 <= 0.055 ** 2) return true;
  }
  return false;
};
const head = ell(0.4, 0.37, 0.215, 0.18);
const earL = tri([0.2, 0.33], [0.23, 0.07], [0.37, 0.22]);
const earR = tri([0.43, 0.22], [0.57, 0.07], [0.6, 0.33]);
const innerL = tri([0.235, 0.27], [0.245, 0.13], [0.32, 0.22]);
const innerR = tri([0.48, 0.22], [0.555, 0.13], [0.565, 0.27]);
const body = ell(0.5, 0.73, 0.25, 0.23);
const chest = ell(0.4, 0.66, 0.11, 0.17);
const legs = (u, v) => v > 0.8 && v < 0.97 && ((u > 0.33 && u < 0.42) || (u > 0.45 && u < 0.54));

function rasterise(n, coat, striped) {
  const [O, B, S, L, E, K] = coat; // outline, base, shade, light, eye, pink
  const g = Array.from({ length: n }, () => Array(n).fill(null));
  const part = Array.from({ length: n }, () => Array(n).fill(""));
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      // Supersample the centre of each pixel.
      const u = (x + 0.5) / n, v = (y + 0.5) / n;
      let p = "";
      if (tail(u, v)) p = "tail";
      if (body(u, v) || legs(u, v)) p = "body";
      if (head(u, v) || earL(u, v) || earR(u, v)) p = "head";
      if (!p) continue;
      part[y][x] = p;
      let c = B;
      const [cx, cy, r] = p === "head" ? [0.4, 0.37, 0.2] : p === "body" ? [0.5, 0.73, 0.24] : [0.8, 0.7, 0.1];
      const lit = ((u - cx) + (v - cy)) / r; // > 0 faces away from the light
      if (lit > 0.75) c = S;
      if (lit < -0.95 && p !== "tail") c = L;
      if (p === "body" && chest(u, v)) c = lit > 0.9 ? B : L;
      if (striped && p !== "body" | !chest(u, v)) {
        const band = p === "tail" ? Math.sin(v * 60) : p === "head" ? (v < 0.3 ? Math.sin(u * 70) : 0) : Math.sin((u * 0.6 + v) * 34);
        if (band > 0.55 && c !== L) c = S;
      }
      if (p === "head" && (innerL(u, v) || innerR(u, v))) c = K;
      if (legs(u, v) && v > 0.93) c = L;
      g[y][x] = c;
    }
  // Face: eyes and nose, scaled to the grid.
  const put = (u, v, c, w = 1, h = 1) => { const x = Math.floor(u * n), y = Math.floor(v * n); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (g[y + j]?.[x + i] !== undefined) g[y + j][x + i] = c; };
  const ew = Math.max(1, Math.round(n / 14)), eh = Math.max(1, Math.round(n / 11));
  put(0.3, 0.355, E, ew, eh); put(0.47, 0.355, E, ew, eh);
  if (n >= 24) { put(0.3, 0.355, O, 1, eh); put(0.47, 0.355, O, 1, eh); }
  if (n >= 32) { put(0.3 + 1 / n, 0.355, "#ffffff"); put(0.47 + 1 / n, 0.355, "#ffffff"); }
  put(0.385, 0.44, K, Math.max(1, Math.round(n / 16)), 1);
  // A line between the legs, and between head and body at bigger sizes.
  if (n >= 24) for (let y = Math.floor(0.82 * n); y < Math.floor(0.95 * n); y++) { const x = Math.floor(0.435 * n); if (g[y][x]) g[y][x] = S; }
  // Selective outline: dark below and right, shade colour above and left.
  const outl = g.map((row) => row.slice());
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (g[y][x]) continue;
      const nb = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => g[y + dy]?.[x + dx]);
      if (!nb.length) continue;
      const fromAbove = nb.some(([dx, dy]) => dy === 1 || dx === 1); // filled pixel is below or right of us => we sit above/left
      outl[y][x] = n >= 24 && fromAbove && !nb.some(([dx, dy]) => dy === -1 || dx === -1) ? S : O;
    }
  // Head over body: a dark line where the head's chin meets the body.
  if (n >= 24) for (let y = 1; y < n; y++) for (let x = 0; x < n; x++) if (part[y][x] === "body" && part[y - 1][x] === "head" && outl[y][x] !== L) outl[y][x] = O;
  return outl;
}

function current(coat) {
  const text = fs.readFileSync(path.join(repo, "content/sprites/cat.txt"), "utf8");
  const rows = text.split("== walk_a")[0].split("\n").slice(1).filter((l) => l.trim());
  return rows.map((r) => [...r].map((ch) => (ch === "." ? null : coat["0123456789abcdef".indexOf(ch)])));
}

// Lay out: for each coat, current 16, new 16, 24, 32, each at a zoom that keeps
// their on-screen sizes honest relative to each other (same 4x for all).
const Z = 5, PAD = 10;
const coats = [["orange_tabby", true], ["white_grey", false], ["black", false]];
const cells = coats.map(([name, striped]) => [current(pal.coats[name]), rasterise(16, pal.coats[name], striped), rasterise(24, pal.coats[name], striped), rasterise(32, pal.coats[name], striped)]);
const colW = [16, 16, 24, 32].map((n) => n * Z + PAD * 2);
const W = colW.reduce((a, b) => a + b, 0), RH = 32 * Z + PAD * 2, H = RH * coats.length;
const img = Buffer.alloc(W * H * 3);
const bgs = [rgb("#c9a184"), rgb("#b88f72")];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img.set(bgs[(Math.floor(x / (Z * 8)) + Math.floor(y / (Z * 8))) % 2], (y * W + x) * 3);
cells.forEach((row, ri) => {
  let ox = 0;
  row.forEach((grid, ci) => {
    const n = grid.length, top = ri * RH + PAD + (32 - n) * Z;
    grid.forEach((r, y) => r.forEach((c, x) => {
      if (!c) return;
      for (let j = 0; j < Z; j++) for (let i = 0; i < Z; i++) img.set(rgb(c), ((top + y * Z + j) * W + ox + PAD + x * Z + i) * 3);
    }));
    ox += colW[ci];
  });
});
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote", out, W, H);
