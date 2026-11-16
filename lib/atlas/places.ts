// When a search finds nothing, say why: the place it names isn't covered yet,
// is coming next, is covered for the other measure, or has nothing in the
// chosen sector. Coverage is per measure, from the live data for each. Pure, so it is tested
// directly (tests/places.test.mjs); the names are in lib/atlas/place-names.ts.

import type { AtlasGroup, AtlasLayer } from "./layers";
import { countryGroup } from "./layers";
import { COUNTRY_NAMES, REGION_NAMES, STATE_ALIASES, STATE_NAME } from "./place-names";

/** Where to ask for a place to be added. */
export const ASK_URL = "https://about.pulsus.tech/walkthrough/?app=Explore#ask";

/** Lower case, no accents, punctuation as spaces: "Côte d’Ivoire" → "cote d ivoire". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export type Place =
  | { kind: "country"; iso: string; name: string }
  | { kind: "state"; code: string; name: string }
  | { kind: "region"; name: string; isos: string[]; states: string[] };

const INDEX: Map<string, Place> = (() => {
  const m = new Map<string, Place>();
  const add = (alias: string, p: Place) => { const k = fold(alias.replace(/^the /i, "")); if (k) m.set(k, p); };
  for (const r of REGION_NAMES) {
    const isos = [...new Set([...COUNTRY_NAMES.filter((c) => r.regions.includes(c.region)).map((c) => c.iso), ...(r.isos || [])])];
    const p: Place = { kind: "region", name: r.name, isos, states: r.states || [] };
    for (const a of r.aliases) add(a, p);
  }
  for (const c of COUNTRY_NAMES) { const p: Place = { kind: "country", iso: c.iso, name: c.name }; add(c.name, p); for (const a of c.aliases) add(a, p); }
  // States last: "Georgia" is the state, which Explore reads.
  for (const [code, name] of Object.entries(STATE_NAME)) { const p: Place = { kind: "state", code, name }; add(name, p); for (const a of STATE_ALIASES[code] || []) add(a, p); }
  return m;
})();
const LONGEST = Math.max(...[...INDEX.keys()].map((k) => k.split(" ").length));

/** The place a search names, if any: the longest name in it ("New Mexico", not "Mexico"),
 *  and the search's other words. */
export function findPlaceIn(text: string): { place: Place; rest: string[] } | null {
  const w = fold(text).split(" ").filter(Boolean);
  for (let n = Math.min(LONGEST, w.length); n > 0; n--)
    for (let i = 0; i + n <= w.length; i++) { const p = INDEX.get(w.slice(i, i + n).join(" ")); if (p) return { place: p, rest: [...w.slice(0, i), ...w.slice(i + n)] }; }
  return null;
}
export const findPlace = (text: string): Place | null => findPlaceIn(text)?.place ?? null;
/** The countries a place stands for (a state: none). */
export const isosOf = (p: Place): string[] => (p.kind === "country" ? [p.iso] : p.kind === "region" ? p.isos : []);

/** The sector a search names, if any ("credit unions Texas" → credit-unions). */
export function findSector(text: string): string | null {
  const t = ` ${fold(text)} `;
  if (/ credit unions? /.test(t)) return "credit-unions";
  if (/ banks? | banking /.test(t)) return "banks";
  if (/ insur(ers?|ance|ance companies) /.test(t)) return "insurance";
  if (/ (agenc(y|ies)|government|federal) /.test(t)) return "government";
  if (/ hospitals? /.test(t)) return "hospitals";
  if (/ universit(y|ies) /.test(t)) return "universities";
  return null;
}

export type Reach = "shown" | "few" | "none";
const best = (rs: Reach[]): Reach => (rs.includes("shown") ? "shown" : rs.includes("few") ? "few" : "none");
const reachOf = (g: AtlasGroup | null | undefined): Reach => (!g ? "none" : g.hidden ? "few" : "shown");

/** What one measure has for a country or a US state (in a sector, or any). */
export interface Coverage { country: (iso: string, sector: string | null) => Reach; state: (code: string, sector: string | null) => Reach }

/** Organisational Health: the live layers, as the map reads them. */
export function layerCoverage(layers: AtlasLayer[]): Coverage {
  const of = (sector: string | null) => layers.filter((l) => !sector || l.sector === sector);
  return {
    country: (iso, sector) => best(of(sector).map((l) => reachOf(countryGroup(l, iso)))),
    state: (code, sector) => best(of(sector).filter((l) => l.regionKind === "state" && l.countries.includes("840")).map((l) => reachOf(l.regions[code]))),
  };
}
/** Operational Health: the named institutions, read country by country (no states). */
export function institutionCoverage(insts: { country: string; sector: string }[]): Coverage {
  return {
    country: (iso, sector) => (insts.some((i) => i.country === iso && (!sector || i.sector === sector)) ? "shown" : "none"),
    state: () => "none",
  };
}

/** What a measure has for a place. */
function reach(p: Place, cov: Coverage, sector: string | null): Reach {
  if (p.kind === "country") return cov.country(p.iso, sector);
  if (p.kind === "state") return cov.state(p.code, sector);
  return best([...p.isos.map((iso) => cov.country(iso, sector)), ...p.states.map((code) => cov.state(code, sector))]);
}

export type Outcome =
  | { kind: "uncovered"; place: Place }
  | { kind: "next"; place: Place }
  | { kind: "empty-sector"; place: Place; sector: string }
  | { kind: "few"; place: Place; sector: string }
  | { kind: "part"; place: Place; covered: string[] }
  | { kind: "other-measure"; place: Place };

/** Why a search that names a place found nothing; null when it names no place
 *  (or the place has figures, so the plain "Nothing matches" stands).
 *  `cov`: the measure in view; `other`: the other measure, if any. */
export function explainEmpty(text: string, sector: string | null, cov: Coverage, next: Record<string, string>, other?: Coverage): Outcome | null {
  const place = findPlace(text);
  if (!place) return null;
  const anywhere = reach(place, cov, null);
  if (anywhere === "none") {
    if (other && reach(place, other, null) !== "none") return { kind: "other-measure", place };
    return place.kind === "country" && next[place.iso] ? { kind: "next", place } : { kind: "uncovered", place };
  }
  if (sector) {
    const here = reach(place, cov, sector);
    if (here === "none") return { kind: "empty-sector", place, sector };
    if (here === "few") return { kind: "few", place, sector };
  }
  if (place.kind === "region") {
    // A region read only in part ("South America": Colombia): name what is there.
    const names = [
      ...place.isos.filter((iso) => cov.country(iso, sector) === "shown").map((iso) => COUNTRY_NAMES.find((c) => c.iso === iso)!.name),
      ...place.states.filter((code) => cov.state(code, sector) === "shown").map((code) => STATE_NAME[code]),
    ];
    if (names.length && names.length <= 3) return { kind: "part", place, covered: names };
  }
  return null;
}


const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] || "");

export type MeasureId = "ohi" | "ops";
export const MEASURE_NAME: Record<MeasureId, string> = { ohi: "Organisational Health", ops: "Operational Health" };
const MEASURE_DATA: Record<MeasureId, string> = { ohi: "financial data", ops: "complaints data" };

/** Where each measure reads, in words: "the United States, Europe and Colombia for
 *  Organisational Health, and the United States and the United Kingdom for Operational Health". */
export const coversText = (where: Partial<Record<MeasureId, string[]>>) =>
  (["ohi", "ops"] as MeasureId[]).filter((m) => where[m]?.length).map((m) => `${and(where[m]!)} for ${MEASURE_NAME[m]}`).join(", and ");

export interface Said { text: string; allSectors?: boolean; ask?: boolean; switchTo?: MeasureId }
/** The words for an outcome. `covers`: where Explore reads (coversText); `noun`: the sector's plural;
 *  `measure`: the measure in view. */
export function sayEmpty(o: Outcome, covers: string, noun: (sector: string) => string, measure: MeasureId = "ohi"): Said {
  const name = o.place.name;
  switch (o.kind) {
    case "other-measure": { const m: MeasureId = measure === "ohi" ? "ops" : "ohi";
      return { text: `${cap(name)} is covered for ${MEASURE_NAME[m]} (${MEASURE_DATA[m]}). Switch to ${MEASURE_NAME[m]} to see it.`, switchTo: m }; }
    case "uncovered": return { text: `${cap(name)} isn't covered yet. Explore covers ${covers}.`, ask: true };
    case "next": return { text: `${cap(name)} is coming next. Explore covers ${covers} today.`, ask: true };
    case "empty-sector": return { text: `No ${noun(o.sector)} in ${name} yet.`, allSectors: true };
    case "few": return { text: `Too few ${noun(o.sector)} in ${name} to show without identifying them.`, allSectors: true };
    case "part": return { text: `In ${name}, Explore covers ${and(o.covered)} so far.` };
  }
}
