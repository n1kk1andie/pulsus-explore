// Builds lib/atlas/globe-dots.json: the land of the world as evenly spaced dots
// ([lat, lon, country]), for the Technology page's globe. Drawn from the same
// Natural Earth outlines as the map (lib/atlas/world.json, public domain): each
// country is painted in its own colour off screen, then a grid of points, spaced
// evenly over the sphere, is read back. Run: node scripts/globe/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const world = JSON.parse(readFileSync(new URL("../../lib/atlas/world.json", import.meta.url)));
// The projection world.json was drawn with (d3 geoNaturalEarth1; scripts/geo/project.mjs in the Platform).
const K = 177.25, TX = 480, TY = 271, R = Math.PI / 180;
const fx = (p) => { const p2 = p * p, p4 = p2 * p2; return 0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)); };
const fy = (p) => { const p2 = p * p, p4 = p2 * p2; return p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))); };
const project = (lat, lon) => { const p = lat * R, l = lon * R; return [TX + K * l * fx(p), TY - K * fy(p)]; };
const STEP = 1.9;   // degrees between rows; along a row, spaced so dots sit evenly over the sphere
const pts = [];
for (let lat = -58; lat <= 82; lat += STEP) {
  const n = Math.max(1, Math.round((360 / STEP) * Math.cos(lat * R)));
  for (let i = 0; i < n; i++) { const lon = -180 + (i + 0.5) * (360 / n); pts.push([lat, lon, ...project(lat, lon)]); }
}
const b = await chromium.launch(); const p = await b.newPage();
const ids = world.countries.map((c) => c.id);
const hits = await p.evaluate(({ w, h, countries, pts }) => {
  const S = 4, cv = document.createElement("canvas"); cv.width = w * S; cv.height = h * S;
  const g = cv.getContext("2d", { willReadFrequently: true }); g.scale(S, S); g.imageSmoothingEnabled = false;
  countries.forEach((c, i) => { const k = i + 1; g.fillStyle = `rgb(${k & 255},${(k >> 8) & 255},7)`; g.fill(new Path2D(c.d)); });
  const img = g.getImageData(0, 0, w * S, h * S).data;
  return pts.map(([, , x, y]) => { const X = Math.round(x * S), Y = Math.round(y * S); if (X < 0 || Y < 0 || X >= w * S || Y >= h * S) return 0; const o = (Y * w * S + X) * 4; return img[o + 2] === 7 && img[o + 3] === 255 ? img[o] + (img[o + 1] << 8) : 0; });
}, { w: world.w, h: world.h, countries: world.countries.map((c) => ({ d: c.d })), pts });
await b.close();
const dots = pts.map(([lat, lon], i) => (hits[i] ? [Math.round(lat * 10) / 10, Math.round(lon * 10) / 10, ids[hits[i] - 1]] : null)).filter(Boolean);
writeFileSync(new URL("../../lib/atlas/globe-dots.json", import.meta.url), JSON.stringify({ source: world.source, step: STEP, dots }));
console.log(`${dots.length} land dots of ${pts.length} points`);
