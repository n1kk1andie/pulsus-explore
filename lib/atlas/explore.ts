// Explore's depth: what each kind of visitor is sent. Pure, so the rules are
// tested directly; the data is loaded on the server only (lib/atlas/serve.ts),
// so nothing beyond a visitor's depth ever reaches a browser.
//
//   preview   anyone: the latest reading of each sector, country and state —
//             medians and counts — plus a teaser of the biggest movers and
//             areas to watch. No history.
//   showcase  the public showcase: the preview, plus the peer distributions its
//             Calibrate screen places the fictional organisation among.
//   full      registered users (free Explore and every paying organisation):
//             everything — five years of history for every group, full movers
//             and hotspots, and group comparisons.
//
// Every depth is aggregated: no institution is named, and groups smaller than
// the layer's minimum stay hidden.

import type { AtlasGroup, AtlasLayer } from "./layers";

export type Depth = "preview" | "showcase" | "full";

export interface Mover { layer: string; region: string; regionKind: "state" | "country"; from: number; to: number; change: number; since: string; until: string }
/** An area to watch: a place among the lowest median Organisational Health. No band or cut-off is applied. */
export interface Hotspot { layer: string; region: string; regionKind: "state" | "country"; score: number; n: number }
export interface Insights { up: Mover[]; down: Mover[]; hotspots: Hotspot[]; more: { up: number; down: number; hotspots: number } }
export interface ExploreData { depth: Depth; layers: AtlasLayer[]; insights: Insights }

const lastOnly = (g: AtlasGroup): AtlasGroup => {
  const { trend, ...rest } = g;
  const t = (trend || []).filter((p) => p.oh !== null || p.ohi !== null);
  return t.length ? { ...rest, trend: [t[t.length - 1]] } : rest;
};
const noTrend = (g: AtlasGroup): AtlasGroup => { const { trend: _t, ...rest } = g; return rest; };

/** A layer as sent at a depth. */
export function trimLayer(l: AtlasLayer, depth: Depth): AtlasLayer {
  if (depth === "full") return l;
  return {
    ...l,
    national: lastOnly(l.national),
    regions: Object.fromEntries(Object.entries(l.regions).map(([k, g]) => [k, noTrend(g)])),
    peers: depth === "showcase" ? l.peers : {},
  };
}

/** How far back "a year ago" is, in points of the layer's own cadence. */
const yearBack = (l: AtlasLayer) => (l.cadence === "yearly" ? 1 : 4);

/** Where Organisational Health moved most over the last year, and where it is
 *  lowest — across every layer's regions. */
/** The fewest organisations a place needs to appear among the movers and
 *  hotspots: below it, one institution swings the share too far to rank on. */
export const INSIGHT_MIN = 20;

export function insightsOf(layers: AtlasLayer[], depth: Depth): Insights {
  const movers: Mover[] = [];
  const hotspots: Hotspot[] = [];
  for (const l of layers) {
    for (const [region, g] of Object.entries(l.regions)) {
      if (g.hidden || g.n < INSIGHT_MIN) continue;
      const t = (g.trend || []).filter((p) => p.ohi !== null);
      const back = yearBack(l);
      if (t.length > back) {
        const a = t[t.length - 1 - back], b = t[t.length - 1];
        movers.push({ layer: l.layer, region, regionKind: l.regionKind, from: a.ohi!, to: b.ohi!, change: b.ohi! - a.ohi!, since: a.period, until: b.period });
      }
      if (Number.isFinite(g.ohi)) hotspots.push({ layer: l.layer, region, regionKind: l.regionKind, score: g.ohi!, n: g.n });
    }
  }
  const up = movers.filter((m) => m.change > 0).sort((a, b) => b.change - a.change);
  const down = movers.filter((m) => m.change < 0).sort((a, b) => a.change - b.change);
  const hot = hotspots.sort((a, b) => a.score - b.score || b.n - a.n);
  const cap = depth === "full" ? 10 : 3;
  return { up: up.slice(0, cap), down: down.slice(0, cap), hotspots: hot.slice(0, cap), more: { up: Math.max(0, up.length - cap), down: Math.max(0, down.length - cap), hotspots: Math.max(0, hot.length - cap) } };
}

export function exploreAt(layers: AtlasLayer[], depth: Depth): ExploreData {
  return { depth, layers: layers.map((l) => trimLayer(l, depth)), insights: insightsOf(layers, depth) };
}
