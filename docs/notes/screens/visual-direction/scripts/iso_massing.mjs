// Throwaway massing study: the starting room in a 2:1 isometric camera, each
// 16-px tile becoming a 32x16 diamond, furniture as plain blocks at its real
// footprint, cats and people as silhouettes at the proposed sprite sizes.
// Not art: it is for judging the camera, the fit and the density.
// Usage: node iso_massing.mjs <repo> <palettes.json> <outdir>
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [repo, palPath, outDir] = process.argv.slice(2);
const pal = JSON.parse(fs.readFileSync(palPath, "utf8"));
const roomToml = fs.readFileSync(path.join(repo, "content/room.toml"), "utf8");
const furnToml = fs.readFileSync(path.join(repo, "content/furniture.toml"), "utf8");
const pieces = [...roomToml.matchAll(/kind = "(\w+)"\s*\nx = (\d+)\s*\ny = (\d+)/g)].map((m) => ({ kind: m[1], x: +m[2], y: +m[3] }));
const size = Object.fromEntries([...furnToml.matchAll(/\[kinds\.(\w+)\]\s*\nw = (\d+)\s*\nh = (\d+)/g)].map((m) => [m[1], { w: +m[2], h: +m[3] }]));

const H = 56; // wall height in pixels
const OX = 160, OY = H; // where grid point (0,0) lands
const W = 336, HT = 232;
const P = (gx, gy, z = 0) => [OX + (gx - gy) * 16, OY + (gx + gy) * 8 - z];

const img = new Uint8Array(W * HT * 3);
const bg = [0x1e, 0x1e, 0x2e];
for (let i = 0; i < W * HT; i++) img.set(bg, i * 3);
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h, k) => rgb(h).map((v) => v * (1 - k));
function poly(pts, colour) {
  const c = typeof colour === "string" ? rgb(colour) : colour;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(HT, Math.ceil(Math.max(...ys))); y++)
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(W, Math.ceil(Math.max(...xs))); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) img.set(c.map(Math.round), (y * W + x) * 3);
    }
}
const rect = (x, y, w, h, colour) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], colour);

// Floor: planks running along x, alternate rows a touch darker.
const [floorA, floorB, seam] = [pal.room[0], pal.room[1], pal.room[2]];
for (let gy = 1; gy < 10; gy++)
  for (let gx = 0; gx < 12; gx++) {
    poly([P(gx, gy), P(gx + 1, gy), P(gx + 1, gy + 1), P(gx, gy + 1)], (gx + gy) % 2 ? floorA : floorB);
    poly([P(gx, gy + 1), P(gx + 1, gy + 1), P(gx + 1, gy + 1.06), P(gx, gy + 1.06)], seam);
  }

// Back-right wall: the street wall (row 0), with window, door and chalkboard.
const wallTop = pal.room[3], wainscot = pal.room[4];
poly([P(0, 1), P(12, 1), P(12, 1, H), P(0, 1, H)], shade(wallTop, 0.08));
poly([P(0, 1), P(12, 1), P(12, 1, 14), P(0, 1, 14)], wainscot);
poly([P(0, 0, H), P(12, 0, H), P(12, 1, H), P(0, 1, H)], shade(wallTop, -0.05));
const onWall = (g0, g1, z0, z1, colour) => poly([P(g0, 1, z0), P(g1, 1, z0), P(g1, 1, z1), P(g0, 1, z1)], colour);
onWall(2.15, 5.85, 20, 50, pal.room[5]);
for (const g of [2.25, 3.2, 4.15, 5.1]) onWall(g, g + 0.85, 22, 48, pal.room[8]);
onWall(7.08, 7.92, 0, 42, pal.room[5]);
onWall(7.16, 7.84, 0, 39, pal.room[9]);
onWall(8.12, 8.9, 20, 40, pal.room[5]);
onWall(8.18, 8.84, 22, 38, pal.room[11]);
// Back-left wall: new, plain, with the same wainscot.
poly([P(0, 1), P(0, 10), P(0, 10, H), P(0, 1, H)], shade(wallTop, 0.22));
poly([P(0, 1), P(0, 10), P(0, 10, 14), P(0, 1, 14)], shade(wainscot, 0.2));

// Furniture as blocks: top, front-left face (+y), front-right face (+x).
const HEIGHT = { cat_tower: 44, window_seat: 12, sofa: 16, rug: 1, table: 16, chair: 14, cat_bed: 5, box: 12, plant: 22, toys: 3, bowls: 4, cushion: 4 };
const COLOUR = { cat_tower: pal.furniture[3], window_seat: pal.furniture[11], sofa: pal.furniture[1], rug: pal.furniture[9], table: pal.furniture[11], chair: pal.furniture[4], cat_bed: pal.furniture[1], box: pal.furniture[3], plant: pal.furniture[6], toys: pal.furniture[1], bowls: pal.furniture[13], cushion: pal.furniture[9] };
const INSET = { plant: 0.28, toys: 0.32, bowls: 0.18, chair: 0.2, cat_bed: 0.12, box: 0.15, cushion: 0.15 };
function block(x, y, w, h, z, colour) {
  poly([P(x + w, y), P(x + w, y + h), P(x + w, y + h, z), P(x + w, y, z)], shade(colour, 0.3));
  poly([P(x, y + h), P(x + w, y + h), P(x + w, y + h, z), P(x, y + h, z)], shade(colour, 0.14));
  poly([P(x, y, z), P(x + w, y, z), P(x + w, y + h, z), P(x, y + h, z)], colour);
}
function shadow(x, y, w, h) {
  poly([P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], shade(floorA, 0.25));
}

// Cats and people as silhouettes at the proposed sizes, base at the tile's centre.
function figure(kind, gx, gy, colour) {
  const [cx, cy] = P(gx + 0.5, gy + 0.5);
  if (kind === "person") {
    poly([[cx - 8, cy - 1], [cx + 8, cy - 1], [cx + 8, cy + 2], [cx - 8, cy + 2]], shade(floorA, 0.25));
    rect(cx - 6, cy - 22, 12, 21, colour);
    rect(cx - 7, cy - 33, 14, 12, pal.avatars.skins[0]);
    rect(cx - 7, cy - 34, 14, 4, pal.avatars.hair[0]);
  } else if (kind === "cat") {
    rect(cx - 9, cy - 1, 18, 3, shade(floorA, 0.25));
    rect(cx - 7, cy - 12, 14, 12, colour);
    rect(cx - 9, cy - 20, 11, 9, colour);
    rect(cx - 9, cy - 23, 3, 3, colour);
    rect(cx - 2, cy - 23, 3, 3, colour);
    rect(cx + 6, cy - 6, 5, 3, colour);
  } else {
    rect(cx - 11, cy - 1, 22, 3, shade(floorA, 0.25));
    rect(cx - 10, cy - 8, 20, 8, colour);
    rect(cx - 12, cy - 11, 9, 7, colour);
  }
}

const items = [];
for (const p of pieces) {
  const { w, h } = size[p.kind];
  const i = INSET[p.kind] ?? 0.06;
  const draw = () => { if (p.kind !== "rug") shadow(p.x + i - 0.06, p.y + i + 0.06, w - 2 * i + 0.12, h - 2 * i); block(p.x + i, p.y + i, w - 2 * i, h - 2 * i, HEIGHT[p.kind], COLOUR[p.kind]); };
  items.push({ depth: p.kind === "rug" ? -1 : p.x + w + p.y + h, draw });
}
const coats = pal.coats;
items.push({ depth: 7 + 6 + 1.01, draw: () => figure("cat", 7, 6, coats.orange_tabby[1]) });
items.push({ depth: 4 + 8 + 1.01, draw: () => figure("cat", 4, 8, coats.white_grey[1]) });
items.push({ depth: 0 + 5 + 1.5, draw: () => figure("nap", 0.4, 5, coats.black[2]) });
items.push({ depth: 5 + 5 + 1.01, draw: () => figure("person", 5, 5, pal.avatars.colours[3]) });
items.push({ depth: 9 + 2 + 1.01, draw: () => figure("person", 9, 2, pal.avatars.colours[4]) });
items.sort((a, b) => a.depth - b.depth).forEach((it) => it.draw());

// PNG writing, with optional whole-number upscale and a framed canvas.
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(file, w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set(pixel(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}
const at = (x, y) => [...img.subarray((y * W + x) * 3, (y * W + x) * 3 + 3)];
png(path.join(outDir, "iso-3x.png"), W * 3, HT * 3, (x, y) => at(Math.floor(x / 3), Math.floor(y / 3)));
fs.writeFileSync(path.join(outDir, "iso-1x.raw.json"), JSON.stringify({ W, HT }));
fs.writeFileSync(path.join(outDir, "iso-1x.bin"), img);
console.log("iso room", W, "x", HT, "at 1x");
