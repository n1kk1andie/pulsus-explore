// A search that finds nothing says why: a place Explore doesn't cover, one
// coming next, a covered place with nothing in the sector, or an unknown word.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { explainEmpty, sayEmpty, findPlace, findPlaceIn, findSector, layerCoverage, institutionCoverage, coversText } = await import("../lib/atlas/places.ts");
const { LAYERS, NEXT } = await import("../lib/atlas/catalog.ts");
const root = new URL("../", import.meta.url);
const layers = LAYERS.map((d) => JSON.parse(readFileSync(new URL(`lib/atlas/data/${d.id}.json`, root), "utf8")));
const insts = JSON.parse(readFileSync(new URL("lib/atlas/data/operational.json", root), "utf8")).institutions;
const ohi = layerCoverage(layers), ops = institutionCoverage(insts);
const COVERS = "the United States, Europe and Colombia";
const noun = (s) => ({ banks: "banks", "credit-unions": "credit unions", insurance: "insurers", government: "agencies", hospitals: "hospitals" })[s];
// Organisational Health in view (the default), with Operational Health as the other measure.
const say = (text, sector, measure = "ohi") => {
  const [cov, other] = measure === "ohi" ? [ohi, ops] : [ops, ohi];
  const o = explainEmpty(text, sector, cov, NEXT, other); return o && sayEmpty(o, COVERS, noun, measure);
};

test("an uncovered country says so, and offers to ask for it", () => {
  const s = say("Jamaica", "banks");
  assert.equal(s.text, "Jamaica isn't covered yet. Explore covers the United States, Europe and Colombia.");
  assert.equal(s.ask, true);
  assert.equal(say("JAMAICA", null).text, s.text);
  assert.equal(say("banks in jamaica", null).text, s.text);
});

test("names match without case or accents, and keep their article", () => {
  assert.equal(findPlace("côte d'ivoire").iso, "384");
  assert.equal(findPlace("COTE D IVOIRE").iso, "384");
  assert.equal(findPlace("méxico").iso, "484");
  assert.equal(say("philippines", null).text, "The Philippines isn't covered yet. Explore covers the United States, Europe and Colombia.");
});

test("a country on the coming-next list says coming next", () => {
  const s = say("Canada", "banks");
  assert.equal(s.text, "Canada is coming next. Explore covers the United States, Europe and Colombia today.");
  assert.match(say("Mexico", null).text, /^Mexico is coming next/);
});

test("a covered place with nothing in the sector offers all sectors", () => {
  const s = say("Colombia", "credit-unions");
  assert.equal(s.text, "No credit unions in Colombia yet.");
  assert.equal(s.allSectors, true);
  assert.equal(say("Europe", "hospitals").text, "No hospitals in Europe yet.");
  assert.equal(findSector("credit unions colombia"), "credit-unions");
});

test("a covered place with figures, and unknown words, keep the plain message", () => {
  assert.equal(explainEmpty("Colombia", "banks", ohi, NEXT, ops), null);
  assert.equal(explainEmpty("Texas", "credit-unions", ohi, NEXT, ops), null);
  assert.equal(explainEmpty("zxqv", "banks", ohi, NEXT, ops), null);
  assert.equal(explainEmpty("pizza", null, ohi, NEXT, ops), null);
  assert.equal(explainEmpty("", null, ohi, NEXT, ops), null);
});

test("the longest name wins, and states before countries of the same name", () => {
  assert.equal(findPlace("new mexico").kind, "state");
  assert.equal(findPlace("georgia").kind, "state");
  assert.equal(findPlace("papua new guinea").iso, "598");
  assert.equal(findPlace("washington dc").code, "DC");
  assert.equal(say("American Samoa", null).text, "American Samoa isn't covered yet. Explore covers the United States, Europe and Colombia.");
});

test("a region read only in part names what is there", () => {
  assert.equal(say("South America", null).text, "In South America, Explore covers Brazil and Colombia so far.");
  // Brazil, by its own name too: covered for banks and credit cooperatives, so a search finds it.
  assert.equal(explainEmpty("Brasil", "banks", ohi, NEXT, ops), null);
  assert.equal(explainEmpty("Brazil", "credit-unions", ohi, NEXT, ops), null);
  assert.match(say("Africa", null).text, /^Africa isn't covered yet\./);
});

test("the UK is covered for Operational Health: with Organisational Health in view, say so and offer the switch", () => {
  assert.ok(insts.some((i) => i.country === "826"), "UK institutions are in the Operational Health data");
  for (const q of ["UK", "United Kingdom", "england", "banks in the uk"]) {
    const s = say(q, null);
    assert.equal(s.text, "The United Kingdom is covered for Operational Health (complaints data). Switch to Operational Health to see it.", q);
    assert.equal(s.switchTo, "ops");
  }
  // In view, the UK has figures: no message (the app shows its institutions).
  assert.equal(explainEmpty("UK", null, ops, NEXT, ohi), null);
  assert.equal(explainEmpty("United States", "credit-unions", ops, NEXT, ohi), null);
});

test("with Operational Health in view, places it doesn't read point back to Organisational Health", () => {
  const s = say("Colombia", null, "ops");
  assert.equal(s.text, "Colombia is covered for Organisational Health (financial data). Switch to Organisational Health to see it.");
  assert.equal(s.switchTo, "ohi");
  // Operational Health is read country by country: a US state is in the financial view.
  assert.match(say("Texas", null, "ops").text, /^Texas is covered for Organisational Health/);
  // Neither measure: still not covered, or coming next.
  assert.match(say("Jamaica", null, "ops").text, /^Jamaica isn't covered yet\./);
  assert.match(say("Canada", null, "ops").text, /^Canada is coming next\./);
  assert.equal(say("United Kingdom", "hospitals", "ops").text, "No hospitals in the United Kingdom yet.");
});

test("the covered list is per measure, from the live data", () => {
  const opsWhere = ["840", "826"].filter((c) => insts.some((i) => i.country === c)).map((c) => (c === "840" ? "the United States" : "the United Kingdom"));
  assert.equal(coversText({ ohi: ["the United States", "Europe", "Colombia"], ops: opsWhere }),
    "the United States, Europe and Colombia for Organisational Health, and the United States and the United Kingdom for Operational Health");
  assert.equal(ohi.country("826", null), "none");
  assert.equal(ops.country("826", "insurance"), "shown");
  assert.equal(ops.country("170", null), "none");
});

test("a place's name is separated from the rest of the search", () => {
  assert.deepEqual(findPlaceIn("barclays uk").rest, ["barclays"]);
  assert.equal(findPlaceIn("barclays uk").place.iso, "826");
});
