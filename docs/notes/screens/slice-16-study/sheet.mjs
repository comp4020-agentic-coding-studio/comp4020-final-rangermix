// Lays the study's screens side by side, as compare-day.png and
// compare-night.png beside them, each labelled.
// Usage, from the repo root: node docs/notes/screens/slice-16-study/sheet.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const SHOWN = [
  ["0-now", "Now: 32-px tiles, 4×, the bars in rows"],
  ["1-tile36", "36-px tiles, the bars in rows: only 3× fits"],
  ["3-float-tile36", "36-px tiles, the bars floating: 4×"],
  ["4-fill", "…and the street across the whole window"],
  ["5-fill-terrace", "…with a terrace in the bottom corners"],
  ["6-fill-garden", "…with a garden in the bottom corners"],
  ["8-fill-plinth", "…with only a deeper plinth (14 px)"],
  ["7-fill-terrace-plinth", "…a terrace and a deeper plinth"],
];
const browser = await chromium.launch();
for (const when of ["day", "night"]) {
  const cells = SHOWN.map(([f, label], i) => {
    const data = fs.readFileSync(path.join(here, `${f}-${when}.png`)).toString("base64");
    return `<figure><img src="data:image/png;base64,${data}"><figcaption><b>${i + 1}.</b> ${label}</figcaption></figure>`;
  }).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; padding: 16px; background: #1e1e2e; color: #cdd6f4; font: 18px/1.3 system-ui, sans-serif; width: 1968px; }
    main { display: grid; grid-template-columns: repeat(2, 960px); gap: 16px 16px; }
    figure { margin: 0; } img { display: block; width: 960px; height: 540px; border-radius: 6px; }
    figcaption { padding: 6px 2px 0; } b { color: #fab387; }
  </style><main>${cells}</main>`;
  const tab = await browser.newPage({ viewport: { width: 2000, height: 800 } });
  await tab.setContent(html);
  await tab.locator("main").screenshot({ path: path.join(here, `compare-${when}.png`) });
  await tab.close();
}
await browser.close();
console.log("laid out the study's sheets");
