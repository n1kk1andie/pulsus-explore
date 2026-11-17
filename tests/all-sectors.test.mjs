// "All sectors" colours every place any single sector colours: Europe's
// countries and areas, Colombia, the US state by state and Puerto Rico.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { ALL, allSectors, inView, valueAt } = await import("../lib/atlas/allSectors.ts");
const { countryGroup, withLimited } = await import("../lib/atlas/layers.ts");
const { LAYERS } = await import("../lib/atlas/catalog.ts");
const root = new URL("../", import.meta.url);
const real = Object.fromEntries(LAYERS.map((d) => [d.id, withLimited(JSON.parse(readFileSync(new URL(`lib/atlas/data/${d.id}.json`, root), "utf8")))]));
const layers = { ...real, [ALL]: allSectors(Object.values(real)) };
const all = layers[ALL];

test("the map reads the combined layer when All sectors is chosen", () => {
  const v = inView("all", LAYERS, layers);
  assert.equal(v.length, 1);
  assert.equal(v[0].l.layer, ALL);
  assert.deepEqual(inView("banks", LAYERS, layers).map((x) => x.l.layer).sort(), ["br-banks", "co-banks", "eu-banks", "us-banks"]);
});

test("All sectors covers every country any single sector covers, coloured where any sector is", () => {
  // Medians only: a country-totals layer (EIOPA's European insurance) is never part of All sectors (tests/country-totals.test.mjs).
  for (const l of Object.values(real).filter((x) => x.kind !== "country-totals")) for (const iso of l.countries) {
    const one = countryGroup(l, iso); if (!one) continue;
    const g = countryGroup(all, iso);
    assert.ok(g, `${l.layer}: ${iso} missing from All sectors`);
    if (valueAt(one, "ohi", null) !== undefined) assert.notEqual(valueAt(g, "ohi", null), undefined, `${l.layer}: ${iso} has a figure, All sectors none`);
  }
  // Named: Europe's banks, Colombia, the US.
  for (const iso of ["276", "250", "380", "724", "752", "528", "170", "840"]) assert.notEqual(valueAt(countryGroup(all, iso), "ohi", null), undefined, iso);
});

test("All sectors covers every US state and territory any sector reads by state", () => {
  for (const l of Object.values(real)) if (l.regionKind === "state") for (const [code, g] of Object.entries(l.regions)) {
    const a = all.regions[`US-${code}`];
    assert.ok(a, `${l.layer}: ${code}`);
    if (!g.hidden) assert.notEqual(valueAt(a, "ohi", null), undefined, `${l.layer}: ${code}`);
  }
  assert.notEqual(valueAt(all.regions["US-PR"], "ohi", null), undefined, "Puerto Rico");
});

test("the combined reading is each sector's median weighted by its size", () => {
  const co = countryGroup(all, "170");
  const parts = ["co-banks", "co-insurers"].map((id) => real[id].national);
  const w = parts.reduce((t, g) => t + g.n, 0);
  assert.equal(co.n, w);
  assert.equal(co.ohi, Math.round(parts.reduce((t, g) => t + g.ohi * g.n, 0) / w));
});

test("a country listed by a source but with no institutions there is not shown as \"too few\"", () => {
  const eu = real["eu-banks"];
  const empty = eu.countries.filter((iso) => !countryGroup(eu, iso));
  assert.ok(empty.length > 0);
  for (const iso of empty) if (!Object.values(real).some((l) => countryGroup(l, iso))) assert.equal(countryGroup(all, iso), null, iso);
});
