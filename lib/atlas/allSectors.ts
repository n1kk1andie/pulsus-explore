// "All sectors": every place's sectors read together, as one more layer, so
// the map can colour every place that has data in ANY sector: Europe's
// countries and areas (banks), Colombia, the US state by state, Puerto Rico.
// Pure, so it is tested directly (tests/all-sectors.test.mjs).

import type { LayerDef, SectorId } from "./catalog";
import type { AtlasGroup, AtlasLayer } from "./layers";
import { countryGroup } from "./layers";
import { canShow } from "./bands";

export type Measure = "ohi" | "oh";

/** A group's reading at a period: its latest point at or before it, or now. */
export function valueAt(g: AtlasGroup | undefined, k: Measure, at: string | null): number | undefined {
  if (!g || g.hidden || !canShow(g.n)) return undefined;   // 1–9: never a figure (lib/atlas/bands.ts)
  if (!at) return g[k];
  const t = (g.trend || []).filter((p) => p.period <= at && p[k] !== null);
  return t.length ? (t[t.length - 1][k] as number) : undefined;
}

/** All sectors together: for each country, its sectors' groups combined.
 *  Counts add up exactly; the readings
 *  are each sector's median weighted by its size (labelled as such). */
export const ALL = "all-sectors";
export const ALL_DEF: LayerDef = { id: ALL, sector: "all" as SectorId, title: "All sectors", publisher: "Every source in Explore", asOf: "", evidence: "financial" };
export function combine(gs: AtlasGroup[], periods: string[]): AtlasGroup {
  const vis = gs.filter((g) => !g.hidden);
  const n = gs.reduce((t, g) => t + g.n, 0);
  if (!vis.length) return { n, hidden: true };
  const avg = (k: Measure, at: string | null) => {
    let w = 0, t = 0;
    for (const g of vis) { const v = valueAt(g, k, at); if (v !== undefined) { w += g.n; t += v * g.n; } }
    return w ? Math.round(t / w) : undefined;
  };
  return {
    n: vis.reduce((t, g) => t + g.n, 0), ohi: avg("ohi", null), oh: avg("oh", null),
    trend: periods.map((p) => ({ period: p, ohi: avg("ohi", p) ?? null, oh: avg("oh", p) ?? null })),
    // A country read only as part of an area (Sweden, in the Nordic and Baltic countries) keeps the area's name.
    ...(vis.length === 1 && vis[0].area ? { area: vis[0].area, members: vis[0].members } : {}),
  };
}
export function allSectors(ls: AtlasLayer[], id: string = ALL, sector: string = "all"): AtlasLayer {
  // The timeline follows the quarterly sources; yearly ones carry their latest year.
  const periods = [...new Set(ls.filter((l) => l.cadence !== "yearly").flatMap((l) => (l.national.trend || []).map((t) => t.period)))].sort();
  const countries = [...new Set(ls.flatMap((l) => l.countries))];
  const regions: Record<string, AtlasGroup> = {};
  // A country listed by a source but with no institutions in it (no group in any sector) stays unread, as in each sector.
  for (const iso of countries) { const gs = ls.map((l) => countryGroup(l, iso)).filter((g): g is AtlasGroup => !!g); if (gs.length) regions[iso] = combine(gs, periods); }
  // The US state by state: the sectors read by state, together (keys "US-TX").
  const byState = ls.filter((l) => l.regionKind === "state" && l.countries.includes("840"));
  for (const code of new Set(byState.flatMap((l) => Object.keys(l.regions)))) regions[`US-${code}`] = combine(byState.map((l) => l.regions[code]).filter((g): g is AtlasGroup => !!g), periods);
  const latest = ls.map((l) => l.asOf).sort().pop() || "";
  return { ...ls[0], layer: id, sector, scope: sector, regionKind: "country", countries, source: "", asOf: latest, cadence: "quarterly", national: combine(ls.map((l) => l.national), periods), regions, peers: {} };
}
/** The layers the map reads for a sector. "All sectors" is the combined layer
 *  (`layers[ALL]`): without it, nothing but the US grid would be coloured. */
export function inView(sector: string, realDefs: LayerDef[], layers: Record<string, AtlasLayer>): { def: LayerDef; l: AtlasLayer }[] {
  if (sector === "all") return layers[ALL] ? [{ def: ALL_DEF, l: layers[ALL] }] : [];
  return realDefs.filter((d) => d.sector === sector).map((def) => ({ def, l: layers[def.id] }));
}
