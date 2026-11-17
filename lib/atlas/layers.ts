import { SHOW_MIN } from "./bands";

// The shape of an Explore layer (anonymous totals only — lib/atlas/catalog.ts).
// The layers themselves are loaded on the server (lib/atlas/serve.ts) and sent
// at each visitor's depth (lib/atlas/explore.ts).

/** `ind`: the median of each regulatory indicator across the group's organisations, at the layer's latest period. */
/** `area`, `members`: a group of neighbouring countries too small to show alone (e.g. "Benelux and Ireland"). */
/** `limited`: a group of 10–19, as built: still `hidden` to anything that ranks or compares, its figures kept apart (withLimited). */
export interface AtlasGroup { n: number; hidden?: boolean; area?: string; members?: string[]; oh?: number; ohi?: number; trend?: { period: string; oh: number | null; ohi: number | null }[]; ind?: Record<string, number | null>; limited?: Omit<AtlasGroup, "n" | "hidden" | "limited"> }
/** A regulatory indicator the score is built from: its name, unit, and which direction is stronger. */
export interface AtlasIndicator { id: string; label: string; unit: string; better: "higher" | "lower"; context?: boolean }
export interface AtlasLayer {
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
export const withLimited = (l: AtlasLayer): AtlasLayer => ({
  ...l, national: shownGroup(l.national), regions: Object.fromEntries(Object.entries(l.regions).map(([k, g]) => [k, shownGroup(g)])),
  ...(l.states ? { states: Object.fromEntries(Object.entries(l.states).map(([k, g]) => [k, shownGroup(g)])) } : {}),
});
