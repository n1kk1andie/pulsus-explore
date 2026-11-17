// Brazil's banks and credit cooperatives, from the Banco Central do Brasil's
// IF.data under the Open Database License: the notice goes wherever the data
// does, the figures follow the same floors, and the data can be downloaded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { withLimited, countryGroup } = await import("../lib/atlas/layers.ts");
const { factsOf } = await import("../lib/atlas/facts.ts");
const { LAYERS, SECTORS, NEXT } = await import("../lib/atlas/catalog.ts");
const root = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, root), "utf8");
const layer = (id) => JSON.parse(read(`lib/atlas/data/${id}.json`));
const ATTRIBUTION = "Contains information from Banco Central do Brasil (IF.data, dadosabertos.bcb.gov.br), made available under the Open Database License (ODbL). Scores and medians calculated by Pulsus; the Banco Central do Brasil does not endorse them.";
const ODBL = "https://opendatacommons.org/licenses/odbl/1-0/";

test("both Brazil layers are live, carry the ODbL and its notice, and read Brazil as a whole", () => {
  for (const id of ["br-banks", "br-credit-coops"]) {
    const l = layer(id);
    assert.ok(LAYERS.some((d) => d.id === id && d.asOf === l.asOf), id);
    assert.equal(l.licence.id, "ODbL-1.0"); assert.equal(l.licence.url, ODBL); assert.equal(l.licence.attribution, ATTRIBUTION);
    assert.deepEqual(l.countries, ["076"]); assert.equal(l.regionKind, "country");
    assert.ok(countryGroup(l, "076").n >= 20 && !countryGroup(l, "076").hidden, id);
  }
  assert.equal(NEXT["076"], undefined, "Brazil is live, no longer next");
  assert.match(SECTORS.find((s) => s.id === "banks").where, /Brazil/);
  assert.match(SECTORS.find((s) => s.id === "credit-unions").where, /Brazil/);
});

test("states by head office: 1–9 a count only; 10–19 opened for Explore as limited samples; 20+ shown", () => {
  for (const id of ["br-banks", "br-credit-coops"]) {
    const raw = layer(id), open = withLimited(raw);
    for (const [uf, g] of Object.entries(raw.states)) {
      const o = open.states[uf];
      if (g.n < 10) assert.ok(o.hidden && o.ohi === undefined && o.ind === undefined, `${id} ${uf}`);
      else if (g.n < 20) assert.ok(g.hidden && !o.hidden && Number.isFinite(o.ohi), `${id} ${uf}`);
      else assert.ok(!o.hidden && o.ohi === g.ohi, `${id} ${uf}`);
    }
  }
  assert.ok(layer("br-banks").states.SP.n >= 20, "São Paulo's banks are ranked");
});

test("the Technology page's facts carry the licence and the states", () => {
  const f = factsOf(LAYERS.map((d) => withLimited(layer(d.id))), LAYERS, SECTORS);
  const br = f.sources.find((s) => s.id === "br-banks");
  assert.equal(br.licence.attribution, ATTRIBUTION);
  assert.match(br.places, /^Read for the country as a whole; by head-office state, \d+ shown/);
  assert.equal(br.from, "2025-03");
  assert.equal(f.sources.find((s) => s.id === "us-banks").licence, undefined);
});

test("the notice and the licence link are on every page that shows the Brazil figures; the data can be downloaded", () => {
  const map = read("components/MapApp.tsx"), tech = read("app/technology/page.tsx"), meth = read("app/methodology/page.tsx"), route = read("app/data/brazil/route.ts");
  assert.match(map, /\{l\.attribution\} The figures Explore publishes from it are made available under the <a href=\{l\.url\}>Open Database License \(ODbL\) 1\.0<\/a>/);
  assert.match(map, /lc\.attribution/);   // the Settings sources list
  assert.match(tech, /The Brazil layer data published by Explore is made available under the <a href="https:\/\/opendatacommons\.org\/licenses\/odbl\/1-0\/">Open Database License \(ODbL\) 1\.0<\/a>/);
  assert.match(tech, /s\.licence\.attribution/);
  assert.match(meth, /BR_ATTRIBUTION/);
  assert.match(route, /br-banks\.json/); assert.match(route, /br-credit-coops\.json/);
});
