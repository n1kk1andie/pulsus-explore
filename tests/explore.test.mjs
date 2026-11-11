// Pulsus Explore: what every visitor gets, that no institution is named, and
// that none of the engine or its method is in this app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { exploreAt, insightsOf } = await import("../lib/atlas/explore.ts");
const { LAYERS } = await import("../lib/atlas/catalog.ts");
const root = new URL("../", import.meta.url);
const layers = LAYERS.map((d) => JSON.parse(readFileSync(new URL(`lib/atlas/data/${d.id}.json`, root), "utf8")));

test("every layer in the catalogue is here", () => {
  assert.equal(layers.length, LAYERS.length);
  for (const l of layers) assert.ok(l.national && l.regions && l.asOf, l.layer);
});

test("everyone gets the full depth: history, movers, hotspots", () => {
  const d = exploreAt(layers, "full");
  assert.equal(d.depth, "full");
  assert.ok(d.layers.find((l) => l.layer === "us-banks").national.trend.length > 8);
  const i = insightsOf(layers, "full");
  assert.ok(i.up.length + i.down.length > 3 && i.hotspots.length > 0);
});

test("movers and hotspots are only places with enough organisations to rank on", () => {
  const i = insightsOf(layers, "full");
  const nOf = (m) => { const l = layers.find((x) => x.layer === m.layer); return l.regions[m.region].n; };
  for (const m of [...i.up, ...i.down]) assert.ok(nOf(m) >= 20, `${m.layer} ${m.region}`);
  for (const h of i.hotspots) assert.ok(h.n >= 20, `${h.layer} ${h.region}`);
});

test("no institution is named, and small groups stay hidden", () => {
  const json = JSON.stringify(exploreAt(layers, "full"));
  assert.ok(!/"(name|institution|cert|charter|rssd)"\s*:/i.test(json));
  for (const l of layers) for (const g of Object.values(l.regions)) if (!g.hidden) assert.ok(g.n >= l.minGroup, `${l.layer}`);
});

test("none of the engine, its method or Pulsus Platform's private code is in this app", () => {
  const files = [];
  const walk = (d) => { for (const f of readdirSync(d)) { if (f === "node_modules" || f.startsWith(".")) continue; const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|mjs|js)$/.test(f)) files.push(p); } };
  walk(new URL(".", root).pathname);
  for (const f of files) {
    if (f.includes("/tests/")) continue;
    const src = readFileSync(f, "utf8");
    assert.doesNotMatch(src, /lib\/(synthesis|pulse|issues|platform|identity)\//, f);
    assert.doesNotMatch(src, /entropy|behaviou?ral[- ]energy|institutionalFromReadings/i, f);
  }
});
