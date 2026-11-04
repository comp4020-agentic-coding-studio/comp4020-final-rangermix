// Builds study.html with the café's palettes and slice 10's live frame filled
// in as view.html (open it in a browser to watch the walks move), opens it in
// Playwright's Chromium, and saves each section as a PNG beside view.html.
// Usage, from the repo root: node docs/notes/screens/art-style/scripts/render.mjs [built.html]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../../../..");
const outDir = path.resolve(here, "..");
const built = process.argv[2] ?? path.join(outDir, "view.html");

const pal = fs.readFileSync(path.join(repo, "content/sprites/palettes.json"), "utf8");
const shot = fs.readFileSync(path.join(repo, "docs/notes/screens/slice-10/room-10h.png")).toString("base64");
const page = fs
  .readFileSync(path.join(here, "study.html"), "utf8")
  .replace("/*PAL*/null", pal.trim())
  .replace('/*SHOT*/""', JSON.stringify(`data:image/png;base64,${shot}`));
fs.writeFileSync(built, page);

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
tab.on("pageerror", (e) => errors.push(String(e)));
await tab.goto(`file://${built}`);
await tab.waitForFunction(() => window.__ready === true, null, { timeout: 300_000 });
const err = await tab.evaluate(() => window.__error);
if (err || errors.length) {
  console.error(err ?? errors.join("\n"));
  process.exit(1);
}
await tab.evaluate(() => window.__walkAt(250));
for (const id of await tab.$$eval("section[data-shot]", (s) => s.map((e) => e.dataset.shot))) {
  await tab.locator(`section[data-shot="${id}"]`).screenshot({ path: path.join(outDir, `${id}.png`) });
}
console.log(JSON.stringify(await tab.evaluate(() => window.__numbers), null, 1));
await browser.close();
