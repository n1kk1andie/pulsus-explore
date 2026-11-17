// European insurance is a COUNTRY-LEVEL READING from EIOPA's published country
// totals (layer kind "country-totals"), not a median of institutions. It shows
// on the grid, the map, the cards and the directory, labelled as such, and never
// feeds a median, total, ranking, comparison, shape, mover or sample band.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { ALL, allSectors, combine, valueAt } = await import("../lib/atlas/allSectors.ts");
const { withLimited, isCountryTotals, medianLayers, countryGroup } = await import("../lib/atlas/layers.ts");
const { insightsOf, exploreAt } = await import("../lib/atlas/explore.ts");
const { rankedFirst, rankCount, canRank } = await import("../lib/atlas/bands.ts");
const { factsOf } = await import("../lib/atlas/facts.ts");
const { LAYERS, SECTORS } = await import("../lib/atlas/catalog.ts");
const root = new URL("../", import.meta.url);
const src = (f) => readFileSync(new URL(f, root), "utf8");
const raw = LAYERS.map((d) => JSON.parse(src(`lib/atlas/data/${d.id}.json`)));
const layers = raw.map(withLimited);
const eu = layers.find((l) => l.layer === "eu-insurers");
const others = layers.filter((l) => l.layer !== "eu-insurers");

test("European insurance is a country-totals layer, in the catalogue as one", () => {
  assert.ok(eu, "eu-insurers is served");
  assert.equal(eu.kind, "country-totals");
  assert.equal(LAYERS.find((d) => d.id === "eu-insurers").kind, "country-totals");
  assert.ok(isCountryTotals(eu));
  assert.equal(layers.filter(isCountryTotals).length, 1, "the only one");
  assert.deepEqual(eu.peers, {}, "no distribution of institutions: no peers");
  for (const [iso, g] of Object.entries(eu.regions)) {
    assert.equal(g.totals, true, iso); assert.equal(g.n, 1, `${iso}: n counts the country`);
    assert.ok(g.undertakings >= 3, `${iso}: undertakings in the totals`);
  }
  assert.equal(eu.national.n, eu.countries.length, "the whole area: n is its countries");
});

test("its readings are shown (the 10/20 sample bands count institutions, not countries)", () => {
  const before = raw.find((l) => l.layer === "eu-insurers");
  assert.deepEqual(eu, before, "withLimited leaves a country-totals layer as built");
  const de = countryGroup(eu, "276");
  assert.equal(valueAt(de, "ohi", null), de.ohi);
  assert.ok(Number.isFinite(valueAt(de, "ohi", null)));
  // An ordinary group of 1 still never shows a figure.
  assert.equal(valueAt({ n: 1, ohi: 50 }, "ohi", null), undefined);
});

test("never part of All sectors, a sector's combined median, or a region's total", () => {
  assert.deepEqual(allSectors(layers), allSectors(others), "All sectors (the headline, the All regions row and column) is the same without it");
  const ins = layers.filter((l) => l.sector === "insurance");
  assert.deepEqual(allSectors(ins, "sector-insurance", "insurance"), allSectors(medianLayers(ins), "sector-insurance", "insurance"), "Insurance's All regions total");
  const europe = layers.filter((l) => /europe/i.test(l.scope));
  assert.deepEqual(allSectors(europe), allSectors(medianLayers(europe)), "Europe's All sectors tile");
  assert.equal(allSectors(layers).national.n, others.reduce((t, l) => t + l.national.n, 0), "the count is organisations only");
  const g = { n: 40, ohi: 60, oh: 60, trend: [{ period: "2026-06", oh: 60, ohi: 60 }] };
  assert.deepEqual(combine([g, { ...eu.regions["276"], n: 500 }], ["2026-06"]), combine([g], ["2026-06"]), "a totals group is dropped from any combination");
  assert.equal(allSectors(layers).kind, undefined, "the combined layer is a median layer");
});

test("never among the movers or areas to watch, even if it had a large count", () => {
  for (const d of ["full", "preview"]) assert.deepEqual(insightsOf(layers, d), insightsOf(others, d));
  const big = { ...eu, regions: Object.fromEntries(Object.entries(eu.regions).map(([k, g]) => [k, { ...g, n: 500 }])) };
  const i = insightsOf([...others, big], "full");
  for (const m of [...i.up, ...i.down, ...i.hotspots]) assert.notEqual(m.layer, "eu-insurers");
  assert.deepEqual(exploreAt(layers, "full").insights, insightsOf(others, "full"));
});

test("never ranked or compared, and never in a sector's shape", () => {
  assert.equal(rankCount(eu.national), 0); assert.equal(rankCount(eu.regions["276"]), 0);
  assert.ok(!canRank(rankCount(eu.national)), "30 countries are not 30 institutions: no Compare");
  const rows = [{ g: eu.national, v: 99, label: "Europe" }, { g: { n: 25 }, v: 10, label: "Z" }, { g: eu.regions["276"], v: 100, label: "Germany" }];
  const out = rankedFirst(rows, (r) => rankCount(r.g), (a, b) => b.v - a.v, (r) => r.label);
  assert.equal(out[0].label, "Z", "the ranked place first; country-level readings follow, A to Z, unranked");
  assert.deepEqual(medianLayers(layers).map((l) => l.layer), others.map((l) => l.layer));
  const shape = medianLayers(layers.filter((l) => l.sector === "insurance")).flatMap((l) => l.peers?.all?.ohi || []);
  assert.equal(shape.length, layers.find((l) => l.layer === "co-insurers").peers.all.ohi.length, "Insurance's shape: Colombia's insurers only");
});

test("the Technology page counts organisations without it, and states its terms", () => {
  const f = factsOf(layers, LAYERS, SECTORS);
  assert.equal(f.organisations, others.reduce((t, l) => t + l.national.n, 0));
  const s = f.sources.find((x) => x.id === "eu-insurers");
  assert.ok(s.totals && s.totals.undertakings > 1000);
  assert.match(s.places, /each read from its published totals/);
  assert.equal(s.totals.terms.acknowledgement, "Source: EIOPA - European Insurance and Occupational Pensions Authority, https://eiopa.europa.eu/");
  assert.match(s.totals.terms.disclaimer, /^This document has been drafted using material downloaded from EIOPA website\. EIOPA does not endorse this publication/);
  assert.ok(f.exceptions.every((e) => e.title !== s.title));
  const tech = src("app/technology/page.tsx");
  assert.match(tech, /id="totals"/); assert.match(tech, /Its limits/);
});

test("the grid, map and cards label it, and the grid no longer calls the box empty", () => {
  const app = src("components/MapApp.tsx"), grid = src("components/PulseOverview.tsx");
  assert.doesNotMatch(app, /insurance: "Country totals only"/, "EMPTY_WHY: the box now has its reading");
  assert.match(grid, /From country totals, not a median of insurers/);
  assert.match(grid, /is-ctotals/); assert.match(grid, /country totals/);
  assert.match(app, /Country-level reading \(EIOPA totals\)/);
  assert.match(app, /<Terms t=\{l\.terms\} \/>/, "the card carries EIOPA's acknowledgement and disclaimer");
  // Every consumer that forms a median or ranks reads medianLayers or rankCount.
  for (const k of ["sectorCards", "shapeRows", "matrix"]) assert.ok(app.includes(k), k);
  assert.match(app, /const ls = medianLayers\(realDefs\.filter\(\(d\) => d\.sector === x\.id\)/);
  assert.match(app, /rankedFirst\(out, \(r\) => rankCount\(r\.g\)/);
});
