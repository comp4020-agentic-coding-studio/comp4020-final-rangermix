// Lays the terrace study's screens side by side: compare-day.png and
// compare-night.png (the whole window, 1920×1080, at half size) and
// compare-corner.png (the front corner, close, by day and by night).
// Usage, from spec/ (for its playwright): node ../docs/notes/screens/slice-18-study/sheet.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOWN = [
  ["none", "As live: the terrace on the street's pavement"],
  ["glass", "A deck and a glass balustrade 12 px high"],
  ["glass-tall", "A deck and a glass balustrade 18 px high"],
  ["parapet", "A deck and a low parapet, 7 px"],
  ["glass-deep", "As 3, the deck's slab 24 px deep, the building's face"],
  ["glass-high", "As 3, the towers carried on below: the café upstairs"],
];
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(here, f)).toString("base64")}`;
const style = (w) => `<style>
  body { margin: 0; padding: 16px; background: #1e1e2e; color: #cdd6f4; font: 18px/1.3 system-ui, sans-serif; width: ${w}px; }
  main { display: grid; gap: 16px; } figure { margin: 0; } img { display: block; border-radius: 6px; }
  figcaption { padding: 6px 2px 0; } b { color: #fab387; }
</style>`;
const browser = await chromium.launch();
const sheet = async (html, w, name) => {
  const tab = await browser.newPage({ viewport: { width: w + 32, height: 800 } });
  await tab.setContent(html);
  await tab.locator("main").screenshot({ path: path.join(here, name) });
  await tab.close();
};
for (const when of ["day", "night"]) {
  const cells = SHOWN.map(([f, label], i) => `<figure><img src="${img(`${f}-${when}.png`)}" width="960" height="540"><figcaption><b>${i + 1}.</b> ${label}</figcaption></figure>`).join("");
  await sheet(`<!doctype html><meta charset="utf-8">${style(1936)}<main style="grid-template-columns: repeat(2, 960px)">${cells}</main>`, 1936, `compare-${when}.png`);
}
const corners = ["day", "night"].flatMap((when) =>
  SHOWN.map(([f], i) => `<figure><img src="${img(`${f}-${when}-corner.png`)}" width="600" height="367"><figcaption><b>${i + 1}.</b> ${when === "day" ? "By day" : "By night"}</figcaption></figure>`),
).join("");
await sheet(`<!doctype html><meta charset="utf-8">${style(1832)}<main style="grid-template-columns: repeat(3, 600px)">${corners}</main>`, 1832, "compare-corner.png");
const phones = [["phone-a-none", "Phone, the whole room, as live"], ["phone-a-glass-tall", "Phone, the whole room, deck and 18-px glass"], ["phone-b-none", "Phone, the room at 3×, as live"], ["phone-b-glass-tall", "Phone, the room at 3×, deck and 18-px glass"]]
  .map(([f, label]) => `<figure><img src="${img(`${f}.png`)}" width="390" height="844"><figcaption>${label}</figcaption></figure>`).join("");
await sheet(`<!doctype html><meta charset="utf-8">${style(1624)}<main style="grid-template-columns: repeat(4, 390px)">${phones}</main>`, 1624, "compare-phone.png");
await browser.close();
