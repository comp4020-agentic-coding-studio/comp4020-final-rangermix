// Lays the balcony-ends study's screens side by side: compare-day.png and
// compare-night.png (the whole window at 2560×1080, where the ends show
// most, at half size); compare-ends.png (both ends close, at 1×, by day and
// by night); compare-phone.png (the phone's whole room); compare-tall.png
// (a tall desktop window, as live and A).
// Usage, from spec/ (for its playwright): node ../docs/notes/screens/slice-19-study/sheet.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOWN = [
  ["run", "1C. As live: the balcony and the building run on past the café, the length of the street"],
  ["corner", "1A. The café's corner: the building ends where the café's walls end, the glass turning back to them (3A), the street beside it as now (2A)"],
  ["corner-towers", "2B. As 1A, the city carried on down beside it, as from a high floor"],
  ["fade", "1B. The balcony and the building run on 4 tiles past the café's walls and fade into the street"],
  ["corner-open", "3B. As 1A, the glass not turning the ends: the deck stops open"],
  ["corner-haze", "2C. As 2B, the city fading to sky below the skyline's foot"],
];
const SHORT = { run: "1C. As live", corner: "1A. The café's corner", "corner-towers": "2B. 1A, the city below", fade: "1B. A fade" };
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(here, f)).toString("base64")}`;
const style = (w) => `<style>
  body { margin: 0; padding: 16px; background: #1e1e2e; color: #cdd6f4; font: 18px/1.3 system-ui, sans-serif; width: ${w}px; }
  main { display: grid; gap: 16px; } figure { margin: 0; } img { display: block; border-radius: 6px; image-rendering: pixelated; }
  figcaption { padding: 6px 2px 0; } b { color: #fab387; }
  .crop { overflow: hidden; border-radius: 6px; } .crop img { border-radius: 0; }
  .pair { display: flex; gap: 4px; }
</style>`;
const browser = await chromium.launch();
const sheet = async (html, w, name) => {
  const tab = await browser.newPage({ viewport: { width: w + 32, height: 800 } });
  await tab.setContent(html);
  await tab.locator("main").screenshot({ path: path.join(here, name) });
  await tab.close();
};
const crop = (f, x, y, w, h, scale = 1) =>
  `<div class="crop" style="width:${w * scale}px;height:${h * scale}px"><img src="${img(f)}" style="width:${2560 * scale}px;margin:${-y * scale}px 0 0 ${-x * scale}px"></div>`;
for (const when of ["day", "night"]) {
  const cells = SHOWN.map(([f, label]) => `<figure><img src="${img(`${f}-${when}-2560x1080.png`)}" width="1280" height="540"><figcaption>${label}</figcaption></figure>`).join("");
  await sheet(`<!doctype html><meta charset="utf-8">${style(2576)}<main style="grid-template-columns: repeat(2, 1280px)">${cells}</main>`, 2576, `compare-${when}.png`);
}
// Both ends at 1×, from the 2560×1080 shots: the left end, then the right.
const ENDS = SHOWN.slice(0, 5);
const ends = ["day", "night"]
  .flatMap((when) =>
    ENDS.map(([f, label]) => `<figure><div class="pair">${crop(`${f}-${when}-2560x1080.png`, 280, 480, 560, 420)}${crop(`${f}-${when}-2560x1080.png`, 1860, 400, 560, 420)}</div><figcaption>${label.split(":")[0]}, ${when === "day" ? "by day" : "by night"}</figcaption></figure>`),
  )
  .join("");
await sheet(`<!doctype html><meta charset="utf-8">${style(2272)}<main style="grid-template-columns: repeat(2, 1124px)">${ends}</main>`, 2272, "compare-ends.png");
const PHONE = SHOWN.slice(0, 4);
const phones = ["day", "night"]
  .flatMap((when) => PHONE.map(([f, label]) => `<figure>${crop(`${f}-${when}-390x844.png`, 0, 90, 390, 300, 1).replace("2560px", "390px")}<figcaption>${SHORT[f]}, ${when === "day" ? "by day" : "by night"}</figcaption></figure>`))
  .join("");
await sheet(`<!doctype html><meta charset="utf-8">${style(1608)}<main style="grid-template-columns: repeat(4, 390px)">${phones}</main>`, 1608, "compare-phone.png");
const tall = [
  ["run", "1C. As live, a tall desktop window (1280×1440), by day"],
  ["corner", "1A, the same window"],
]
  .map(([f, label]) => `<figure><img src="${img(`${f}-day-1280x1440.png`)}" width="640" height="720"><figcaption>${label}</figcaption></figure>`)
  .join("");
await sheet(`<!doctype html><meta charset="utf-8">${style(1296)}<main style="grid-template-columns: repeat(2, 640px)">${tall}</main>`, 1296, "compare-tall.png");
await browser.close();
console.log("sheets");
