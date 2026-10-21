// Throwaway: builds palette sets to compare against content/sprites/palettes.json.
//  - latte / mocha: every current colour snapped to its nearest Catppuccin
//    colour (CIELAB), i.e. what "only Catppuccin colours" gives you as-is.
//  - led: Catppuccin-led. Mocha's darks for outlines and shadows, its
//    pastels for cloth, cats and accents, and wood ramps mixed from peach and
//    rosewater toward Mocha's surfaces, since Catppuccin has no brown.
// Usage: node gen_palettes.mjs <repo> <ctp palette.json> <outdir>
import fs from "node:fs";
import path from "node:path";

const [repo, ctpPath, outDir] = process.argv.slice(2);
const cur = JSON.parse(fs.readFileSync(path.join(repo, "content/sprites/palettes.json"), "utf8"));
const ctp = JSON.parse(fs.readFileSync(ctpPath, "utf8"));
const flavour = (f) => Object.fromEntries(Object.entries(ctp[f].colors).map(([k, v]) => [k, v.hex]));

const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
function lab(h) {
  const [r, g, b] = rgb(h).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), y = f(0.2126 * r + 0.7152 * g + 0.0722 * b), z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dist = (a, b) => { const [p, q] = [lab(a), lab(b)]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const mapAll = (v, fn) => (Array.isArray(v) ? v.map(fn) : typeof v === "string" ? fn(v) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapAll(x, fn)])));
const snap = (f) => { const cols = Object.values(flavour(f)); return (h) => cols.reduce((best, c) => (dist(h, c) < dist(h, best) ? c : best)); };

fs.writeFileSync(path.join(outDir, "latte.json"), JSON.stringify(mapAll(cur, snap("latte")), null, 1));
fs.writeFileSync(path.join(outDir, "mocha.json"), JSON.stringify(mapAll(cur, snap("mocha")), null, 1));

// Catppuccin-led.
const m = flavour("mocha");
const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v * (1 - t) + rgb(b)[i] * t));
const woodLight = mix(m.peach, m.rosewater, 0.35), wood = mix(m.peach, m.surface2, 0.38), woodDark = mix(m.peach, m.surface1, 0.6), woodDeep = mix(m.peach, m.base, 0.72);
const outline = mix(m.base, m.mauve, 0.12);
const led = {
  room: [mix(m.peach, m.surface2, 0.3), mix(m.peach, m.surface2, 0.42), mix(m.peach, m.surface2, 0.55), m.rosewater, mix(m.maroon, m.surface1, 0.5), mix(m.maroon, m.base, 0.7), m.flamingo, m.crust, m.sky, wood, m.yellow, mix(m.green, m.base, 0.75), m.text],
  furniture: [outline, m.red, mix(m.red, m.base, 0.3), woodLight, woodDark, mix(m.rosewater, m.yellow, 0.4), m.green, mix(m.green, m.base, 0.4), mix(m.peach, m.maroon, 0.4), m.lavender, mix(m.lavender, m.text, 0.5), wood, woodDeep, m.subtext1, mix(m.peach, m.base, 0.45), m.sapphire],
  coats: {
    white_grey: [outline, m.text, m.overlay1, "#ffffff", m.blue, m.pink],
    black: [m.crust, m.base, m.surface0, m.surface1, m.yellow, m.flamingo],
    orange_tabby: [mix(m.peach, m.base, 0.7), m.peach, mix(m.peach, m.maroon, 0.5), m.rosewater, m.green, m.pink],
  },
  avatars: {
    skins: [m.rosewater, mix(m.peach, m.rosewater, 0.4), mix(m.peach, m.surface2, 0.4), mix(m.peach, m.base, 0.62)],
    hair: [mix(m.base, m.mauve, 0.25), m.yellow, mix(m.maroon, m.base, 0.45), m.surface0],
    colours: [m.red, m.peach, m.green, m.sky, m.mauve, m.pink],
    base: [outline, m.surface1, mix(m.peach, m.base, 0.6), "#ffffff"],
  },
  emotes: cur.emotes,
};
fs.writeFileSync(path.join(outDir, "led.json"), JSON.stringify(led, null, 1));
console.log("wrote latte, mocha, led");
