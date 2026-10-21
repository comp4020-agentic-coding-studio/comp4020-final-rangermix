// Throwaway: renders the café's starting room from content/ with a chosen
// palette set, to compare the current colours with Catppuccin remaps.
// Usage: node render_room.mjs <repo> <palettes.json> <out.png>
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [repo, palPath, out] = process.argv.slice(2);
const pal = JSON.parse(fs.readFileSync(palPath, "utf8"));
const read = (f) => fs.readFileSync(path.join(repo, "content/sprites", f), "utf8");

function parseSheet(text) {
  const sheet = new Map();
  let name = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith("== ")) { name = line.slice(3).trim(); sheet.set(name, []); }
    else if (line !== "" && name) sheet.get(name).push([...line].map((c) => (c === "." ? -1 : "0123456789abcdef".indexOf(c))));
  }
  return sheet;
}
const sheets = { room: parseSheet(read("room.txt")), furniture: parseSheet(read("furniture.txt")), cat: parseSheet(read("cat.txt")), avatar: parseSheet(read("avatar.txt")) };

const W = 12 * 16, H = 10 * 16;
const px = new Uint8Array(W * H * 3).fill(0);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function blit(grid, palette, ox, oy, flip = false) {
  grid.forEach((row, y) => row.forEach((s, x) => {
    if (s < 0) return;
    const X = ox + (flip ? row.length - 1 - x : x), Y = oy + y;
    if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    px.set(hex(palette[s]), (Y * W + X) * 3);
  }));
}

// The room as content/room.toml lays it out (tiles and furniture).
const roomToml = fs.readFileSync(path.join(repo, "content/room.toml"), "utf8");
const tiles = JSON.parse(roomToml.match(/tiles = (\[[\s\S]*?\])/)[1].replace(/,\s*\]/, "]"));
const ground = { ".": "floor", W: "wall", G: "window", D: "door", C: "board" };
tiles.forEach((row, y) => [...row].forEach((ch, x) => blit(sheets.room.get(ground[ch]), pal.room, x * 16, y * 16)));
const pieces = [...roomToml.matchAll(/kind = "(\w+)"\s*\nx = (\d+)\s*\ny = (\d+)/g)].map((m) => ({ kind: m[1], x: +m[2], y: +m[3] }));
const flat = new Set(["rug", "cushion"]);
for (const p of pieces.filter((p) => flat.has(p.kind))) blit(sheets.furniture.get(p.kind), pal.furniture, p.x * 16, p.y * 16);
for (const p of pieces.filter((p) => !flat.has(p.kind)).sort((a, b) => a.y - b.y)) blit(sheets.furniture.get(p.kind), pal.furniture, p.x * 16, p.y * 16);

// Three cats and two people, where a visit might put them.
blit(sheets.cat.get("sit"), pal.coats.orange_tabby, 7 * 16, 6 * 16);
blit(sheets.cat.get("walk_a"), pal.coats.white_grey, 4 * 16, 8 * 16, true);
blit(sheets.cat.get("nap"), pal.coats.black, 0 * 16, 5 * 16);
const a = pal.avatars;
const look = (i, c) => [a.base[0], a.skins[i], a.hair[i], a.colours[c], a.base[1], a.base[2], a.base[3]];
blit(sheets.avatar.get("stand"), look(0, 3), 5 * 16, 5 * 16);
blit(sheets.avatar.get("stand"), look(2, 4), 9 * 16, 2 * 16);

// Write a PNG at 3x so it can be looked at.
const S = 3, OW = W * S, OH = H * S;
const raw = Buffer.alloc((OW * 3 + 1) * OH);
for (let y = 0; y < OH; y++) {
  raw[y * (OW * 3 + 1)] = 0;
  for (let x = 0; x < OW; x++) {
    const i = (Math.floor(y / S) * W + Math.floor(x / S)) * 3;
    raw.set(px.subarray(i, i + 3), y * (OW * 3 + 1) + 1 + x * 3);
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(OW, 0); ihdr.writeUInt32BE(OH, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
console.log("wrote", out);
