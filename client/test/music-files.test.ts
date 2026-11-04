import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Slice 15: the six tracks are data in content/music/, written by
// scripts/music.ts from the originals (re-encoded to about 128 kbps and an
// even loudness). CI has no ffmpeg, so the loudness is what the script
// measured on each file it wrote, recorded with the file's hash; this holds
// the files to that record, and reads the bitrate from the frame headers.

const dir = join(process.cwd(), "..", "content/music");
const TARGET_LUFS = -16;

interface Entry {
  title: string;
  artist: string;
  file: string;
  source: string;
  licence: string;
}

/** The playlist's sets, read from playlist.toml: `[[day]]` and `[[night]]` tables of quoted strings. */
function playlist(): Record<"day" | "night", Entry[]> {
  const out: Record<string, Record<string, string>[]> = { day: [], night: [] };
  let into: Record<string, string> | null = null;
  for (const raw of readFileSync(join(dir, "playlist.toml"), "utf8").split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const table = /^\[\[(day|night)\]\]$/.exec(line);
    if (table) {
      into = {};
      out[table[1]].push(into);
      continue;
    }
    const kv = /^(\w+)\s*=\s*"([^"]*)"$/.exec(line);
    if (kv && into) into[kv[1]] = kv[2];
  }
  return out as unknown as Record<"day" | "night", Entry[]>;
}

/** An MPEG-1 Layer III file's bitrates, in kbps, frame by frame. */
function bitrates(bytes: Buffer): number[] {
  const KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const RATES = [44100, 48000, 32000];
  let at = 0;
  // Skip an ID3v2 tag.
  if (bytes.toString("latin1", 0, 3) === "ID3") at = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
  const out: number[] = [];
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) {
      at++;
      continue;
    }
    const version = (bytes[at + 1] >> 3) & 3;
    const layer = (bytes[at + 1] >> 1) & 3;
    const kbps = KBPS[(bytes[at + 2] >> 4) & 15];
    const rate = RATES[(bytes[at + 2] >> 2) & 3];
    const pad = (bytes[at + 2] >> 1) & 1;
    if (version !== 3 || layer !== 1 || !kbps || !rate) {
      at++;
      continue;
    }
    out.push(kbps);
    at += Math.floor((144 * kbps * 1000) / rate) + pad;
  }
  return out;
}

describe("the café's music, as data", () => {
  const sets = playlist();
  const entries = [...sets.day, ...sets.night];

  it("holds three tracks for the day and three for the night, each a file there, and no file without an entry", () => {
    expect(sets.day).toHaveLength(3);
    expect(sets.night).toHaveLength(3);
    const files = readdirSync(dir).filter((f) => f.endsWith(".mp3")).sort();
    expect(entries.map((e) => e.file).sort()).toEqual(files);
    for (const e of entries) {
      expect(e.title && e.artist && e.source && e.licence, `${e.file}'s entry`).toBeTruthy();
      expect(e.licence).toBe("CC0 1.0");
      expect(e.source).toMatch(/^https:\/\/freemusicarchive\.org\/music\/holiznacc0\//);
    }
  });

  it("credits every track by its title and source page", () => {
    const credits = readFileSync(join(dir, "CREDITS.md"), "utf8");
    for (const e of entries) {
      expect(credits, e.title).toContain(e.title);
      expect(credits, e.source).toContain(e.source);
    }
    expect(credits).toContain("HoliznaCC0");
    expect(credits).toContain("CC0 1.0");
  });

  it("is about 128 kbps, under 20 MB together, each file as the script wrote it and as loud as it aims", () => {
    const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { target: number; files: Record<string, { sha256: string; lufs: number; source: string }> };
    expect(manifest.target).toBe(TARGET_LUFS);
    let total = 0;
    for (const e of entries) {
      const bytes = readFileSync(join(dir, e.file));
      total += statSync(join(dir, e.file)).size;
      const rates = bitrates(bytes);
      expect(rates.length, `${e.file}'s frames`).toBeGreaterThan(1000);
      const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
      expect(mean, `${e.file}'s bitrate`).toBeGreaterThan(112);
      expect(mean, `${e.file}'s bitrate`).toBeLessThan(144);
      const rec = manifest.files[e.file];
      expect(rec, `${e.file} in the manifest`).toBeDefined();
      expect(createHash("sha256").update(bytes).digest("hex"), `${e.file} is as the script wrote it`).toBe(rec.sha256);
      expect(Math.abs(rec.lufs - TARGET_LUFS), `${e.file}'s loudness, ${rec.lufs} LUFS`).toBeLessThanOrEqual(1);
    }
    expect(total, "the six together").toBeLessThan(20 * 1024 * 1024);
  });
});
