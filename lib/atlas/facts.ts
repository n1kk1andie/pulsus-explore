// The figures the Technology page quotes (app/technology), worked out from the
// layers themselves, so the page stays true each time the data is refreshed
// (npm run sync-data). Pure: tested in tests/explore.test.mjs.

import type { AtlasLayer } from "./layers";
import type { LayerDef, SectorDef } from "./catalog";
import { INSIGHT_MIN } from "./explore";

/** A period as Explore writes it: "Q2 2026", or "FY2024" for a yearly source. */
export const periodLabel = (cadence: string | undefined, p: string) =>
  cadence === "yearly" ? `FY${p.slice(0, 4)}` : `Q${Math.ceil(Number(p.slice(5, 7)) / 3)} ${p.slice(0, 4)}`;

export interface SourceFact {
  id: string; title: string; sector: string; publisher: string; source: string;
  n: number; cadence: "quarterly" | "yearly"; from: string; to: string; points: number;
  minGroup: number; regionKind: "state" | "country";
  /** How the layer is broken down into places, in words. */
  places: string;
  indicators: { label: string; better: "higher" | "lower"; context: boolean }[];
}

export interface Facts {
  organisations: number; sectorsLive: number; sectorsNext: { label: string; where: string }[];
  sources: SourceFact[]; minGroup: number; insightMin: number;
  /** Layers whose minimum differs from the common one (Europe's largest banks). */
  exceptions: { title: string; n: number; countries: number; minGroup: number; areas: string[]; alone: number }[];
  countries: number;
}

const count = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

export function factsOf(layers: AtlasLayer[], defs: LayerDef[], sectors: SectorDef[]): Facts {
  const byId = Object.fromEntries(layers.map((l) => [l.layer, l]));
  const live = defs.filter((d) => byId[d.id]);
  const sources: SourceFact[] = live.map((d) => {
    const l = byId[d.id];
    const t = (l.national.trend || []).filter((p) => p.ohi !== null);
    const regions = Object.entries(l.regions);
    const shown = regions.filter(([, g]) => !g.hidden);
    let places: string;
    if (l.regionKind === "state") places = `${shown.length} of ${regions.length} states and territories shown on their own`;
    else if (l.countries.length === 1) places = "Read for the country as a whole";
    else {
      const areas = shown.filter(([, g]) => g.area);
      places = `${count(shown.length - areas.length, "country", "countries")} shown on their own; the rest read together in ${count(areas.length, "area", "areas")}`;
    }
    return {
      id: d.id, title: d.title, sector: d.sector, publisher: d.publisher, source: l.source,
      n: l.national.n, cadence: l.cadence === "yearly" ? "yearly" : "quarterly",
      from: t.length ? t[0].period : l.asOf, to: l.asOf, points: t.length, minGroup: l.minGroup, regionKind: l.regionKind, places,
      indicators: (l.indicators || []).map((i) => ({ label: i.label, better: i.better, context: !!i.context })),
    };
  });
  const mins = live.map((d) => byId[d.id].minGroup);
  const freq = (m: number) => mins.filter((x) => x === m).length;
  const common = [...new Set(mins)].sort((a, b) => freq(b) - freq(a) || b - a)[0];
  const exceptions = live.map((d) => byId[d.id]).filter((l) => l.minGroup !== common).map((l) => {
    const regs = Object.entries(l.regions);
    const countries = regs.filter(([, g]) => !g.area && g.n > 0);
    return {
      title: live.find((d) => d.id === l.layer)!.title, n: l.national.n, countries: countries.length, minGroup: l.minGroup,
      areas: regs.filter(([, g]) => g.area && !g.hidden).map(([, g]) => g.area!), alone: countries.filter(([, g]) => !g.hidden).length,
    };
  });
  // Countries with at least one organisation read: a single-country layer's
  // country, and each country of a many-country layer that has organisations.
  const iso = new Set<string>();
  for (const d of live) {
    const l = byId[d.id];
    if (l.countries.length === 1) iso.add(l.countries[0]);
    else for (const [k, g] of Object.entries(l.regions)) if (!g.area && g.n > 0 && l.countries.includes(k)) iso.add(k);
  }
  return {
    organisations: live.reduce((t, d) => t + byId[d.id].national.n, 0),
    sectorsLive: sectors.filter((s) => s.status === "live" && live.some((d) => d.sector === s.id)).length,
    sectorsNext: sectors.filter((s) => s.status !== "live").map((s) => ({ label: s.label, where: s.where })),
    sources, minGroup: common, insightMin: INSIGHT_MIN, exceptions, countries: iso.size,
  };
}
