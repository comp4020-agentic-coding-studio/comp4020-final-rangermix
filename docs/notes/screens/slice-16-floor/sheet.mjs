// Lays the floor sizes side by side as compare-day.png and compare-night.png.
// Usage, from the repo root: node docs/notes/screens/slice-16-floor/sheet.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOWN = [
  ["a-now-12x9", "Today's floor, 12 wide by 9 deep (108 tiles), at 4×"],
  ["b-13x10", "13 by 10 (130 tiles, +20%), at 4×"],
  ["c-13x12", "13 by 12 (156 tiles, +44%), at 4×: the most that fits 4×"],
  ["d-16x13", "16 by 13 (208 tiles, +93%), at 3×"],
  ["e-20x15", "20 by 15 (300 tiles, +178%), at 3×: the most that fits 3×"],
];
const browser = await chromium.launch();
for (const when of ["day", "night"]) {
  const cells = SHOWN.map(([f, label], i) => {
    const data = fs.readFileSync(path.join(here, `${f}-${when}.png`)).toString("base64");
    return `<figure><img src="data:image/png;base64,${data}"><figcaption><b>${i + 1}.</b> ${label}</figcaption></figure>`;
  }).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 16px; background: #1e1e2e; color: #cdd6f4; font: 18px/1.3 system-ui, sans-serif; width: 1968px; }
    main { display: grid; grid-template-columns: repeat(2, 960px); gap: 16px; }
    figure { margin: 0; } img { display: block; width: 960px; height: 540px; border-radius: 6px; }
    figcaption { padding: 6px 2px 0; } b { color: #fab387; }
  </style><main>${cells}</main>`;
  const tab = await browser.newPage({ viewport: { width: 2000, height: 800 } });
  await tab.setContent(html);
  await tab.locator("main").screenshot({ path: path.join(here, `compare-${when}.png`) });
  await tab.close();
}
await browser.close();
