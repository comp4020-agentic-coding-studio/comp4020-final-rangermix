#!/usr/bin/env node
// Writes content/sprites/cat.txt from the PNGs in content/sprites/png/cat/
// (slice 11, ADR 0017): the cats are drawn as pictures, and the client and
// cargo test read the text sheet they become. Run it after changing a PNG:
// `node scripts/sprites.ts`. A client test fails if the sheet isn't what
// this writes, as palettes.json is held to scripts/palettes.ts.
//
// Each PNG is drawn in the white-grey coat's day colours
// (content/sprites/coats.json), one colour per palette slot: outline, base,
// shade, light, eyes, pink. A pixel is a slot by its exact colour, or clear
// where it's transparent; any other colour stops the script, naming it, so
// a stray pixel can't slip in. The client colours each slot by the cat's
// own coat and the hour's light.
//
// A cat's build (round, slim, striped) is a folder; each frame a file. The
// sheet names each grid `build:frame`.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import coats from "../content/sprites/coats.json" with { type: "json" };

/** content/sprites/, from this script's own place (or the working directory's, under a test runner that isn't on file URLs). */
const root = (() => {
  try {
    return join(dirname(fileURLToPath(import.meta.url)), "../content/sprites");
  } catch {
    return join(process.cwd(), process.cwd().endsWith("client") ? "../content/sprites" : "content/sprites");
  }
})();

/** The frames every build has, in the sheet's order. */
export const FRAMES = ["sit", "walk_a", "walk_b", "back_sit", "back_walk_a", "back_walk_b", "nap", "eat", "play_a", "play_b", "perch", "held", "lap", "scratch", "knock", "greet"] as const;

/** A PNG's width, height and pixels as [r, g, b, a], row by row. Only 8-bit RGBA or RGB, which is what the art is saved as. */
export function decodePng(bytes: Buffer): { width: number; height: number; pixels: [number, number, number, number][] } {
  if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 4;
  const data: Buffer[] = [];
  while (at < bytes.length) {
    const len = bytes.readUInt32BE(at);
    const type = bytes.toString("latin1", at + 4, at + 8);
    const body = bytes.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = [body[8], body[9], body[10], body[11], body[12]];
      if (depth !== 8 || (colour !== 6 && colour !== 2) || interlace !== 0) throw new Error(`a PNG must be 8-bit RGBA or RGB, not interlaced (depth ${depth}, colour type ${colour})`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      const p = a + b - c;
      const paeth = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const add = [0, a, b, (a + b) >> 1, paeth][filter];
      if (add === undefined) throw new Error(`unknown PNG filter ${filter}`);
      out[y * stride + x] = (line[x] + add) & 255;
    }
  }
  const pixels: [number, number, number, number][] = [];
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    pixels.push([out[o], out[o + 1], out[o + 2], channels === 4 ? out[o + 3] : 255]);
  }
  return { width, height, pixels };
}

const SLOTS = "0123456789abcdef";
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** One PNG as rows of the sheet's characters: a slot by its colour in the key coat, or "." where clear. */
function grid(name: string, bytes: Buffer): string[] {
  const key = coats.white_grey.map((c) => c.toLowerCase());
  const { width, height, pixels } = decodePng(bytes);
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixels[y * width + x];
      if (a === 0) {
        row += ".";
        continue;
      }
      const slot = key.indexOf(hex(r, g, b));
      if (a !== 255 || slot < 0) throw new Error(`${name} at (${x}, ${y}): ${hex(r, g, b)}${a !== 255 ? ` at alpha ${a}` : ""} is not one of the coat's slot colours (${key.join(" ")})`);
      row += SLOTS[slot];
    }
    rows.push(row);
  }
  return rows;
}

/** Every build's PNGs, read from content/sprites/png/cat/. */
function readPngs(): Record<string, Record<string, Buffer>> {
  const dir = join(root, "png/cat");
  const out: Record<string, Record<string, Buffer>> = {};
  for (const build of readdirSync(dir).sort()) {
    out[build] = {};
    for (const file of readdirSync(join(dir, build))) {
      if (file.endsWith(".png")) out[build][file.slice(0, -4)] = readFileSync(join(dir, build, file));
    }
  }
  return out;
}

/**
 * The cats' sheet, as content/sprites/cat.txt holds it: every build's
 * frames in a fixed order, each `== build:frame` then its rows. Given
 * `pngs`, from those instead of the files (for tests).
 */
export function catSheet(pngs: Record<string, Record<string, Buffer>> = readPngs()): string {
  let out = "# Written by scripts/sprites.ts from content/sprites/png/cat/: edit the PNGs, then run it.\n";
  for (const build of Object.keys(pngs).sort()) {
    const frames = pngs[build];
    for (const f of [...FRAMES, ...Object.keys(frames).filter((k) => !(FRAMES as readonly string[]).includes(k)).sort()]) {
      if (!frames[f]) continue;
      out += `\n== ${build}:${f}\n${grid(`${build}:${f}`, frames[f]).join("\n")}\n`;
    }
  }
  return out;
}

if (process.argv[1]?.endsWith("sprites.ts")) {
  const out = join(root, "cat.txt");
  writeFileSync(out, catSheet());
  console.log(`wrote ${out}`);
}
