#!/usr/bin/env node
// Writes content/music/: the café's six tracks, re-encoded once from the
// originals, and manifest.json, which records where each came from, its
// hash and the loudness measured on the file written (slice 15, ADR 0020).
//
// The originals are 320 kbps MP3s from the Free Music Archive, each by
// HoliznaCC0 under CC0 1.0 (content/music/CREDITS.md). They aren't kept in
// the repo. Each track's page names its file in its own data (`fileUrl`);
// TRACKS below records that address, and the name to save it under. Fetch
// them into one folder (with --get, this script does it with curl), then
// run, from the repo root:
//
//   node scripts/music.ts <folder for the originals> [--get]
//
// A remake on another machine may not match the committed files byte for
// byte, nor to a tenth of a LU: the manifest records the ffmpeg that made
// them, and the test holds whichever files are committed to the manifest
// written with them (slice 15's review, finding 9).
//
// Each is re-encoded to 128 kbps stereo MP3 at -16 LUFS integrated and
// -1.5 dBTP true peak (EBU R128, ffmpeg's loudnorm, in two passes: one to
// measure, one to apply), so none is louder than another and none clips.
// ffmpeg must be installed; CI doesn't need it, since a client test holds
// the written files to the manifest (client/test/music-files.test.ts).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "../content/music");
const TARGET = -16;
const PEAK = -1.5;

/** Each track: the file it's written as, the original's address and the name it's saved under, and the page it came from. */
export const TRACKS = [
  { file: "bubbles.mp3", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/zh5usndkyEfVvKOz8dvsrCd1Ga0jfz4xIcLUendD.mp3", original: "bubbles-lofi-bright-relaxed.mp3", page: "https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/bubbles-lofi-bright-relaxed/" },
  { file: "ocean-breeze.mp3", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/7ahdWvuUuDCVriuh5RvYsl96eUmAJuaVvC30sqlW.mp3", original: "ocean-breeze-lofi-ukulele-peaceful-mp3.mp3", page: "https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ocean-breeze-lofi-ukulele-peaceful-mp3/" },
  { file: "tranquil-mindscape.mp3", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/uxGaqYrlWHy1w4jA6fJki0NlNx6xkkFG5BMwI8JN.mp3", original: "tranquil-mindscape-lofi-happy-reflection.mp3", page: "https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/tranquil-mindscape-lofi-happy-reflection/" },
  { file: "moon-unit.mp3", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/CbNZO1QUuJq1f50RHzZ5kykNj1hdqT04UaWOYSNf.mp3", original: "moon-unit-lofi-reflection-dreamy.mp3", page: "https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/moon-unit-lofi-reflection-dreamy/" },
  { file: "ease-into-night.mp3", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/XobMN43VCXdGmXCTuVc964P0O4gzMe0p2RoPTLKC.mp3", original: "ease-into-night-lofi-relax-chill.mp3", page: "https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/ease-into-night-lofi-relax-chill/" },
  { file: "one-night-in-france.mp3", url: "https://files.freemusicarchive.org/storage-freemusicarchive-org/tracks/hgY8pG5KicULRbUJjUVavqs1h53lNSHdLptPoCwS.mp3", original: "one-night-in-france-lofi-nostalgic-chill.mp3", page: "https://freemusicarchive.org/music/holiznacc0/public-domain-lofi/one-night-in-france-lofi-nostalgic-chill/" },
];

/** Runs ffmpeg and gives back what it printed to stderr, where its measurements go. */
function stderr(args: string[]): string {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg ${args.join(" ")} failed: ${r.stderr.slice(-400)}`);
  return r.stderr;
}

/** The integrated loudness of a file, in LUFS, and its true peak, in dBTP, by ffmpeg's ebur128. */
function loudness(path: string): { lufs: number; peak: number } {
  const text = stderr(["-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const i = [...text.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].at(-1);
  const p = [...text.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].at(-1);
  if (!i || !p) throw new Error(`no loudness for ${path}`);
  return { lufs: Number(i[1]), peak: Number(p[1]) };
}

/** Re-encodes one original to `dest` at the target loudness, in two passes. */
function encode(src: string, dest: string): void {
  // Pass one: measure, as loudnorm's JSON.
  const text = stderr(["-i", src, "-af", `loudnorm=I=${TARGET}:TP=${PEAK}:LRA=11:print_format=json`, "-f", "null", "-"]);
  const json = JSON.parse(text.slice(text.lastIndexOf("{"), text.lastIndexOf("}") + 1)) as Record<string, string>;
  const measured = `measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}`;
  // Pass two: apply, linearly where it can, and encode at 128 kbps.
  // Then a limiter 2 dB under the ceiling: the 128-kbps MP3 encoder adds
  // up to about 2 dB of overshoot between samples (measured on One Night in
  // France: -2.4 dBTP limited, -0.5 once encoded), so the file lands at or
  // under the ceiling. Only peaks are touched; the loudness barely moves.
  const limit = 10 ** ((PEAK - 2) / 20);
  stderr(["-y", "-i", src, "-af", `loudnorm=I=${TARGET}:TP=${PEAK}:LRA=11:${measured}:linear=true,alimiter=limit=${limit.toFixed(4)}:level=false`, "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "128k", "-map_metadata", "-1", "-id3v2_version", "0", dest]);
}

if (process.argv[1]?.endsWith("music.ts")) {
  const from = process.argv[2];
  if (!from) throw new Error("usage: node scripts/music.ts <folder for the originals> [--get]");
  if (process.argv.includes("--get")) {
    for (const t of TRACKS) {
      const r = spawnSync("curl", ["-fsSL", "-o", join(from, t.original), t.url], { stdio: "inherit" });
      if (r.status !== 0) throw new Error(`couldn't fetch ${t.url}`);
    }
  }
  const made = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).stdout.split("\n")[0];
  const files: Record<string, { source: string; sha256: string; lufs: number; peak: number }> = {};
  for (const t of TRACKS) {
    const dest = join(out, t.file);
    encode(join(from, t.original), dest);
    const { lufs, peak } = loudness(dest);
    const sha256 = createHash("sha256").update(readFileSync(dest)).digest("hex");
    files[t.file] = { source: t.page, sha256, lufs, peak };
    console.log(`${t.file}: ${lufs} LUFS, ${peak} dBTP`);
  }
  writeFileSync(join(out, "manifest.json"), `${JSON.stringify({ target: TARGET, peak: PEAK, kbps: 128, ffmpeg: made, files }, null, 2)}\n`);
  console.log(`wrote ${out}/manifest.json`);
}
