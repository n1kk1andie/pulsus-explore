// The shape of an Explore layer (anonymous totals only — lib/atlas/catalog.ts).
// The layers themselves are loaded on the server (lib/atlas/serve.ts) and sent
// at each visitor's depth (lib/atlas/explore.ts).

/** `ind`: the median of each regulatory indicator across the group's organisations, at the layer's latest period. */
export interface AtlasGroup { n: number; hidden?: boolean; oh?: number; ohi?: number; trend?: { period: string; oh: number | null; ohi: number | null }[]; ind?: Record<string, number | null> }
/** A regulatory indicator the score is built from: its name, unit, and which direction is stronger. */
export interface AtlasIndicator { id: string; label: string; unit: string; better: "higher" | "lower"; context?: boolean }
export interface AtlasLayer {
  layer: string; sector: string; scope: string; regionKind: "state" | "country"; countries: string[];
  source: string; asOf: string; cadence?: "quarterly" | "yearly"; measures: string[]; minGroup: number;
  national: AtlasGroup; regions: Record<string, AtlasGroup>;
  peers: Record<string, { label: string; n: number; oh: number[]; ohi: number[] }>;
  indicators?: AtlasIndicator[];
}

/** A layer's reading for one country: the whole layer when it covers just that
 *  country by states, else that country's group. */
export function countryGroup(l: AtlasLayer, iso: string): AtlasGroup | null {
  if (!l.countries.includes(iso)) return null;
  if (l.regionKind === "state") return l.national;
  return l.regions[iso] || null;
}
