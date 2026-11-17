import { SHOW_MIN } from "./bands";

// The shape of an Explore layer (anonymous totals only — lib/atlas/catalog.ts).
// The layers themselves are loaded on the server (lib/atlas/serve.ts) and sent
// at each visitor's depth (lib/atlas/explore.ts).

/** `ind`: the median of each regulatory indicator across the group's organisations, at the layer's latest period. */
/** `area`, `members`: a group of neighbouring countries too small to show alone (e.g. "Benelux and Ireland"). */
/** `limited`: a group of 10–19, as built: still `hidden` to anything that ranks or compares, its figures kept apart (withLimited). */
/** `totals`, `undertakings`: a country-totals reading (layer kind "country-totals"): `n` counts countries, not institutions, and `undertakings` how many reporting undertakings the published totals sum. */
/** `excluded`: indicators left out for a country-totals reading, with why (its figure is not comparable; nothing is put in its place). */
export interface AtlasGroup { n: number; hidden?: boolean; totals?: true; undertakings?: number | null; excluded?: { id: string; why: string }[]; area?: string; members?: string[]; oh?: number; ohi?: number; trend?: { period: string; oh: number | null; ohi: number | null }[]; ind?: Record<string, number | null>; limited?: Omit<AtlasGroup, "n" | "hidden" | "limited"> }
/** A regulatory indicator the score is built from: its name, unit, and which direction is stronger. */
export interface AtlasIndicator { id: string; label: string; unit: string; better: "higher" | "lower"; context?: boolean }
/** What a layer's figures are. "medians" (the default): each place's figure is the
 *  median of its institutions' scores. "country-totals": each country is read from
 *  the totals its publisher sums over all its undertakings (EIOPA's insurance
 *  statistics) — one reading per country, with no distribution of institutions
 *  behind it. A country-totals layer never feeds a median, total, ranking,
 *  comparison, shape, mover or sample band (isCountryTotals, medianLayers). */
export type LayerKind = "medians" | "country-totals";
/** A publisher's reuse terms that travel with the data (EIOPA: its acknowledgement and twofold disclaimer). */
export interface AtlasTerms { publisher: string; url: string; data: string; acknowledgement: string; disclaimer: string; free: string }
export interface AtlasLayer {
  kind?: LayerKind;
  /** For a country-totals layer: its publisher's reuse terms, and what the reading is, in words. */
  terms?: AtlasTerms; note?: string;
  layer: string; sector: string; scope: string; regionKind: "state" | "country"; countries: string[];
  source: string; asOf: string; cadence?: "quarterly" | "yearly"; measures: string[]; minGroup: number;
  national: AtlasGroup; regions: Record<string, AtlasGroup>;
  peers: Record<string, { label: string; n: number; oh: number[]; ohi: number[] }>;
  indicators?: AtlasIndicator[];
  /** A country read as part of an area: country → the area's key in `regions`. */
  areas?: Record<string, string>;
  /** States within a one-country layer (Brazil: each institution's head office), under the same floors as `regions`. */
  stateKind?: string; states?: Record<string, AtlasGroup>;
  /** The source's licence, carried with its data (Brazil: the Open Database License). */
  licence?: AtlasLicence;
}
/** An open-database licence and the notice it asks for (ODbL 4.2–4.3). */
export interface AtlasLicence { id: string; url: string; attribution: string; database?: string; notice?: string }

/** A layer's reading for one country: the whole layer when it covers just that
 *  country by states, else that country's group. */
export function countryGroup(l: AtlasLayer, iso: string): AtlasGroup | null {
  if (!l.countries.includes(iso)) return null;
  if (l.regionKind === "state") return l.national;
  const own = l.regions[iso];
  if ((!own || own.hidden) && l.areas?.[iso]) return l.regions[l.areas[iso]] || own || null;
  return own || null;
}

/** The key a country is read under: its own, or its area's. */
export const regionKeyOf = (l: AtlasLayer, iso: string) => ((!l.regions[iso] || l.regions[iso].hidden) && l.areas?.[iso] ? l.areas[iso] : iso);

/** Is this layer read from country totals (not medians of institutions)? */
export const isCountryTotals = (l: Pick<AtlasLayer, "kind"> | null | undefined): boolean => l?.kind === "country-totals";
/** The layers whose figures are medians of institutions: the only ones any median,
 *  total, ranking, comparison, shape, mover or sample band is built from. */
export const medianLayers = <T extends Pick<AtlasLayer, "kind">>(ls: T[]): T[] => ls.filter((l) => !isCountryTotals(l));

/** A group as Explore shows it. The build writes a group of 10–19 as `hidden`,
 *  its figures under `limited`, so the Platform's rankings and peer comparisons
 *  never see it; Explore shows its average, as a limited sample
 *  (lib/atlas/bands.ts). Below SHOW_MIN nothing but the count is kept, whatever
 *  the file holds, so no group of 1–9 can ever show a figure. */
export function shownGroup(g: AtlasGroup): AtlasGroup {
  const { limited, ...rest } = g;
  if (g.n < SHOW_MIN) return { n: g.n, hidden: true, ...(g.area ? { area: g.area, members: g.members } : {}) };
  if (g.hidden && limited) { const { hidden: _h, ...open } = rest; return { ...open, ...limited }; }
  return rest;
}
/** A layer with its limited samples opened (shownGroup), for Explore. */
export const withLimited = (l: AtlasLayer): AtlasLayer => (isCountryTotals(l) ? l : {
  ...l, national: shownGroup(l.national), regions: Object.fromEntries(Object.entries(l.regions).map(([k, g]) => [k, shownGroup(g)])),
  ...(l.states ? { states: Object.fromEntries(Object.entries(l.states).map(([k, g]) => [k, shownGroup(g)])) } : {}),
});
// A country-totals layer is left as built: its readings are one country each (n = 1),
// so the 10/20 sample bands, which count institutions, do not apply to it.
