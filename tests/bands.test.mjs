// How many organisations stand behind an average: four bands, one rule for
// every average Explore shows. 1–9: no average; 10–19: a limited sample, shown
// but never ranked or compared; 20–49: moderate confidence; 50+: broader coverage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { SHOW_MIN, RANK_MIN, BROAD_MIN, BAND_LABEL, bandOf, canShow, canRank, bandClass, sampleText, rankedFirst } = await import("../lib/atlas/bands.ts");
const { shownGroup, withLimited } = await import("../lib/atlas/layers.ts");
const { insightsOf } = await import("../lib/atlas/explore.ts");
const { opsGroup, OPS_MIN_GROUP } = await import("../lib/atlas/operational.ts");
const { LAYERS } = await import("../lib/atlas/catalog.ts");
const root = new URL("../", import.meta.url);
const raw = LAYERS.map((d) => JSON.parse(readFileSync(new URL(`lib/atlas/data/${d.id}.json`, root), "utf8")));
const layers = raw.map(withLimited);

test("each band boundary: 9, 10, 19, 20, 49, 50", () => {
  assert.deepEqual([SHOW_MIN, RANK_MIN, BROAD_MIN], [10, 20, 50]);
  const at = (n) => [bandOf(n), canShow(n), canRank(n)];
  assert.deepEqual(at(1), ["insufficient", false, false]);
  assert.deepEqual(at(9), ["insufficient", false, false]);
  assert.deepEqual(at(10), ["limited", true, false]);
  assert.deepEqual(at(19), ["limited", true, false]);
  assert.deepEqual(at(20), ["moderate", true, true]);
  assert.deepEqual(at(49), ["moderate", true, true]);
  assert.deepEqual(at(50), ["broad", true, true]);
  assert.deepEqual(at(4244), ["broad", true, true]);
});

test("the labels, with their counts", () => {
  assert.deepEqual(BAND_LABEL, { insufficient: "Insufficient data", limited: "Limited sample", moderate: "Moderate confidence", broad: "Broader coverage" });
  assert.equal(sampleText(6), "6 institutions — too few for an average");
  assert.equal(sampleText(1, "banks", "bank"), "1 bank — too few for an average");
  assert.equal(sampleText(9), "9 institutions — too few for an average");
  assert.equal(sampleText(10), "Limited sample · 10 institutions");
  assert.equal(sampleText(14), "Limited sample · 14 institutions");
  assert.equal(sampleText(19, "credit unions"), "Limited sample · 19 credit unions");
  assert.equal(sampleText(20), "Moderate confidence · 20 institutions");
  assert.equal(sampleText(49), "Moderate confidence · 49 institutions");
  assert.equal(sampleText(50), "Broader coverage · 50 institutions");
  assert.equal(sampleText(4244, "banks"), "Broader coverage · 4,244 banks");
});

test("the map draws 10–19 as a limited sample and 1–9 as too few", () => {
  assert.equal(bandClass(9), "is-few");
  assert.equal(bandClass(10), "is-limited");
  assert.equal(bandClass(19), "is-limited");
  assert.equal(bandClass(20), "");
  const css = readFileSync(new URL("app/map.css", root), "utf8");
  assert.match(css, /\.xa-c\.is-limited[^{]*\{[^}]*fill-opacity/);
  assert.match(css, /\.xa-hatch\{[^}]*url\(#xa-hatch\)/);
  assert.match(css, /\.xa-sw-limited/);
  const app = readFileSync(new URL("components/MapApp.tsx", root), "utf8");
  assert.match(app, /<pattern id="xa-hatch"/);
  assert.match(app, /className="xa-sw-limited" \/>Limited sample/);   // the map's key
});

test("rankings exclude groups below 20: they follow, A to Z, unranked", () => {
  const rows = [{ name: "Vermont", n: 11, v: 99 }, { name: "Texas", n: 300, v: 70 }, { name: "Idaho", n: 10, v: 95 }, { name: "Ohio", n: 20, v: 80 }, { name: "Utah", n: 49, v: 60 }];
  const high = rankedFirst(rows, (r) => r.n, (a, b) => b.v - a.v, (r) => r.name).map((r) => r.name);
  assert.deepEqual(high, ["Ohio", "Texas", "Utah", "Idaho", "Vermont"]);
  const low = rankedFirst(rows, (r) => r.n, (a, b) => a.v - b.v, (r) => r.name).map((r) => r.name);
  assert.deepEqual(low, ["Utah", "Texas", "Ohio", "Idaho", "Vermont"]);
});

test("movers and areas to watch rank only 20 or more, with the limited samples opened", () => {
  const i = insightsOf(layers, "full");
  const nOf = (m) => layers.find((l) => l.layer === m.layer).regions[m.region].n;
  for (const m of [...i.up, ...i.down]) assert.ok(nOf(m) >= RANK_MIN, `${m.layer} ${m.region}`);
  for (const h of i.hotspots) assert.ok(h.n >= RANK_MIN, `${h.layer} ${h.region}`);
});

test("a group of 10–19 shows its average; no group of 1–9 ever shows a figure", () => {
  // As built: 10–19 stays hidden (so the Platform never ranks or compares it), its figures under `limited`.
  const lim = shownGroup({ n: 14, hidden: true, limited: { ohi: 71, oh: 80, trend: [{ period: "2026-06", oh: 80, ohi: 71 }], ind: { roa: 1 } } });
  assert.equal(lim.hidden, undefined); assert.equal(lim.ohi, 71); assert.equal(lim.n, 14); assert.equal(lim.limited, undefined);
  // Even if a file held figures for a group of 9, none survive.
  const few = shownGroup({ n: 9, ohi: 70, oh: 70, trend: [{ period: "2026-06", oh: 70, ohi: 70 }], ind: { roa: 1 } });
  assert.deepEqual(few, { n: 9, hidden: true });
  assert.deepEqual(shownGroup({ n: 3, hidden: true, limited: { ohi: 1 } }), { n: 3, hidden: true });
  let shown = 0, limited = 0;
  for (const l of layers) for (const g of [l.national, ...Object.values(l.regions)]) {
    if (g.n < SHOW_MIN) { for (const k of ["ohi", "oh", "trend", "ind", "limited"]) assert.equal(g[k], undefined, `${l.layer} n=${g.n} has ${k}`); assert.equal(g.hidden, true); }
    if (!g.hidden) { assert.ok(g.n >= SHOW_MIN, l.layer); shown++; if (g.n < RANK_MIN) limited++; }
  }
  assert.ok(shown > 100);
  assert.ok(limited > 0, "some places are limited samples");
  // The data as built keeps 10–19 hidden, for everything that ranks or compares.
  for (const l of raw) if (l.minGroup >= RANK_MIN) for (const g of Object.values(l.regions)) if (g.n < RANK_MIN) assert.equal(g.hidden, true, l.layer);
});

test("Operational Health: a median from 10, a comparison only from 20", () => {
  const inst = (k, score) => ({ key: `x${k}`, name: `X${k}`, listedAs: [], match: "", country: "840", sector: "credit-unions", idKind: "", id: "", source: "cfpb", period: "", complaints: 500, ind: { rate: score, timely: 99 } });
  const of = (n) => opsGroup(Array.from({ length: n }, (_, k) => inst(k, 5)), "840", "credit-unions");
  assert.equal(of(9).hidden, true); assert.equal(of(9).median, undefined);
  assert.equal(of(10).hidden, false); assert.ok(Number.isFinite(of(10).median));
  assert.equal(of(19).hidden, false);
  assert.equal(OPS_MIN_GROUP, RANK_MIN);
  assert.equal(canRank(of(19).n), false);
  assert.equal(canRank(of(20).n), true);
});
