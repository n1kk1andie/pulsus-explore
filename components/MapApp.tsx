"use client";

// Explore, the free view of Pulsus Platform, as an app: the world map fills the screen and everything
// floats over it. Tap a country to fly there and open its card; drill into
// states; play the years; see the movers; pin up to four groups to compare;
// search; filter. No sign-in. The figures are the finished, anonymous
// aggregates in lib/atlas/data (no institution is named, none of the method).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExploreData, Mover, Hotspot } from "../lib/atlas/explore";
import type { AtlasGroup, AtlasLayer } from "../lib/atlas/layers";
import { countryGroup, regionKeyOf } from "../lib/atlas/layers";
import { INSIGHT_MIN, insightsOf } from "../lib/atlas/explore";
import { ALL, ALL_DEF, allSectors, inView, valueAt, type Measure } from "../lib/atlas/allSectors";
import { BAND_LABEL, RANK_MIN, SHOW_MIN, bandClass, bandOf, canRank, canShow, rankedFirst, sampleText } from "../lib/atlas/bands";
import { ELSEWHERE, LAYERS, NEXT, SECTORS, type LayerDef, type SectorId } from "../lib/atlas/catalog";
import { OPS_SOURCES, opsGroup, scoreOf, type OpsGroup } from "../lib/atlas/operational";
import { COUNTRY, InstitutionCard, PlaceOpsCard, SAME_COUNTRY, groupWord, medianLabel, type OpsData } from "./Ops";
import { STATE_NAME } from "../lib/atlas/place-names";
import { ASK_URL, MEASURE_NAME, coversText, explainEmpty, findPlaceIn, findSector, fold, institutionCoverage, isosOf, layerCoverage, sayEmpty } from "../lib/atlas/places";

export interface World { w: number; h: number; countries: { id: string; name: string; d: string }[] }
type Sel = { layerId: string; region: string | null } | null;   // region null: the layer as a whole; layerId "ops": a country in the Operational Health view
/** Which measure the map shows: Organisational Health (financial condition, places) or Operational Health (named institutions). */
type Lens = "ohi" | "ops";
const OPS_SECTORS = ["banks", "credit-unions", "insurance"];

const ABOUT = "https://about.pulsus.tech";
const PLATFORM = (process.env.NEXT_PUBLIC_PLATFORM_URL || "https://executive.pulsus.tech").replace(/\/+$/, "");
const WORD: Record<Measure, string> = { ohi: "Organisational Health", oh: "Operational Health" };
const SHORT: Record<Measure, string> = { ohi: "Org. Health", oh: "Op. Health" };
type Sector = SectorId | "all";
const NOUN: Record<Sector, string> = { all: "organisations", banks: "banks", "credit-unions": "credit unions", insurance: "insurers", government: "agencies", hospitals: "hospitals", universities: "universities" };
// The colours follow day or night through CSS variables (app/map.css).
const COLOR = { good: "var(--good)", watch: "var(--watch)", bad: "var(--bad)", few: "var(--few)", next: "var(--next)", none: "var(--none)" } as const;
/** A score's colour: a smooth gradient along 0–100, red through amber to green.
 *  Continuous, with no cut-off: Explore applies no bands or classifications. */
const shade = (v: number) => {
  const x = Math.max(0, Math.min(100, v));
  return x <= 50 ? `color-mix(in oklab, var(--watch) ${x * 2}%, var(--bad))` : `color-mix(in oklab, var(--good) ${(x - 50) * 2}%, var(--watch))`;
};
/** A history line's colour: the shade of its latest reading. */
const lineShade = (vs: (number | null)[]) => { const v = vs.filter((x): x is number => x !== null); return v.length ? shade(v[v.length - 1]) : "var(--mute)"; };

const TILES: [string, number, number][] = [
  ["AK", 0, 0], ["ME", 11, 0], ["VT", 10, 1], ["NH", 11, 1],
  ["WA", 1, 2], ["ID", 2, 2], ["MT", 3, 2], ["ND", 4, 2], ["MN", 5, 2], ["IL", 6, 2], ["WI", 7, 2], ["MI", 8, 2], ["NY", 9, 2], ["RI", 10, 2], ["MA", 11, 2],
  ["OR", 1, 3], ["NV", 2, 3], ["WY", 3, 3], ["SD", 4, 3], ["IA", 5, 3], ["IN", 6, 3], ["OH", 7, 3], ["PA", 8, 3], ["NJ", 9, 3], ["CT", 10, 3],
  ["CA", 1, 4], ["UT", 2, 4], ["CO", 3, 4], ["NE", 4, 4], ["MO", 5, 4], ["KY", 6, 4], ["WV", 7, 4], ["VA", 8, 4], ["MD", 9, 4], ["DE", 10, 4],
  ["AZ", 2, 5], ["NM", 3, 5], ["KS", 4, 5], ["AR", 5, 5], ["TN", 6, 5], ["NC", 7, 5], ["SC", 8, 5], ["DC", 9, 5],
  ["OK", 4, 6], ["LA", 5, 6], ["MS", 6, 6], ["AL", 7, 6], ["GA", 8, 6],
  ["HI", 0, 7], ["TX", 4, 7], ["FL", 9, 7], ["PR", 11, 7],
];
const quarter = (p: string) => `Q${Math.ceil(Number(p.slice(5, 7)) / 3)} ${p.slice(0, 4)}`;
const when = (l: { cadence?: string }, p: string) => (l.cadence === "yearly" ? `FY${p.slice(0, 4)}` : quarter(p));
const n0 = (x: number) => x.toLocaleString("en-US");
/** The most places the comparison holds at once. */
const MAX_PINS = 4;


/** The regulator's own figures beside the Pulsus score: each indicator's median
 *  across the place's organisations, with its source and date, and how the
 *  score is formed (without the proprietary weighting). Medians only: no
 *  institution's figures are ever shown. */
/** The sample band beside an average, with its count: "Limited sample · 14 banks";
 *  below 10, the count alone. Small, and the same everywhere (lib/atlas/bands.ts). */
function Sample({ n, many, one }: { n: number; many: string; one?: string }) {
  return <p className={`xa-sample is-${bandOf(n)}`}>{!canShow(n) && <b>{BAND_LABEL.insufficient} · </b>}{sampleText(n, many, one ?? many.replace(/ies$/, "y").replace(/s$/, ""))}</p>;
}
/** A group's band, as a short word for a list row. */
const band = (n: number) => BAND_LABEL[bandOf(n)];
/** A group on the map: a limited sample is drawn lighter and hatched. */
const limCls = (g: { n: number; hidden?: boolean } | null | undefined) => (g && !g.hidden && canShow(g.n) && bandClass(g.n) ? ` ${bandClass(g.n)}` : "");

/** Both Pulsus measures, side by side: Organisational Health from the regulatory
 *  indicators, and Operational Health, which public data cannot supply. */
function Measures({ v, ops, onOps }: { v: number | undefined; ops?: { g: OpsGroup; word: string } | null; onOps?: () => void }) {
  const og = ops?.g;
  return (
    <dl className="xa-measures">
      <div><dt>Organisational Health</dt><dd><b>{v ?? "—"}</b>{v !== undefined && <span>/100</span>}</dd><p>Each institution scored out of 100 from the figures its regulator publishes. A place&apos;s score is the median of its institutions.</p></div>
      <div><dt>Operational Health</dt>
        <dd>{og && !og.hidden ? <><b>{og.median}</b><span>/100</span></> : <b className="xa-dash">—</b>}</dd>
        {og && og.listed > 0 && <Sample n={og.n} many={`scored ${ops!.word}`} />}
        <p>{og && !og.hidden ? <>Named {ops!.word}, {medianLabel(og.n)} from published complaints data. {SAME_COUNTRY} Kept separate from Organisational Health.</>
          : og && og.listed ? <>Too few of the named {ops!.word} have a score for a median.</>
          : <>Insufficient operational data to calculate.</>}
          {og && og.listed > 0 && onOps && <> <button className="xa-linkbtn" onClick={onOps}>See the named institutions</button></>}</p>
      </div>
    </dl>
  );
}

function Indicators({ l, g, publisher }: { l: AtlasLayer; g: AtlasGroup; publisher: string }) {
  const all = l.indicators || [];
  const ind = all.filter((i) => !i.context), ctx = all.filter((i) => i.context);
  const fmt = (v: number | null | undefined, unit: string) => (v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)}${unit}`);
  const higher = ind.filter((i) => i.better === "higher").map((i) => i.label.toLowerCase());
  const lower = ind.filter((i) => i.better === "lower").map((i) => i.label.toLowerCase());
  const list = (xs: typeof all) => <dl>{xs.map((i) => <div key={i.id}><dt>{i.label}</dt><dd>{fmt(g.ind?.[i.id], i.unit)}</dd></div>)}</dl>;
  return (
    <div className="xa-ind">
      <p className="xa-label">Regulatory indicators · median of {g.n.toLocaleString("en-US")} · {band(g.n)}</p>
      {list(ind)}
      {ctx.length > 0 && (
        <>
          <p className="xa-label xa-ctx-h">Funding, rate and liquidity risk · shown for context, not part of the score</p>
          {list(ctx)}
        </>
      )}
      <p className="xa-src-line">Source: {publisher}, {when(l, l.asOf)}{ctx.length ? " · risk measures calculated by Pulsus from the same filings" : ""} · Pulsus independent analysis</p>
      <details className="xa-how">
        <summary>How this score was calculated</summary>
        <p>Each institution is scored out of 100 from the figures its regulator publishes, the indicators above, each measured against the same fixed levels over up to three years. A place&apos;s score is the median of its institutions.</p>
        <p>{higher.length ? `Higher is stronger for ${higher.join(", ")}` : ""}{lower.length ? `${higher.length ? "; lower" : "Lower"} is stronger for ${lower.join(", ")}` : ""}. The Pulsus engine combines the indicators into one score out of 100, calculated the same way for every place. The score is not placed into bands or categories.</p>
        {ctx.length > 0 && <p>{ctx.map((i) => i.label).join(", ")} are shown beside the score because they describe funding, interest-rate and liquidity risk, which the score itself does not measure. They do not change the score.</p>}
        <p>The same inputs always give the same score. The weighting is proprietary (patent pending).</p>
        <p><a href="/technology#score">Learn more about the method →</a></p>
      </details>
    </div>
  );
}

const I_CU = "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8";
const I_SHIELD = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z";
const I_GOV = "M5 22V3M5 4h12l-2.5 4L17 12H5";
const I_HOSP = "M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M3 21h18M12 7v6M9 10h6";
const I_UNI = "M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5";
const SECTOR_ICON: Record<string, string> = { banks: "M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M12 3l9 5H3z", "credit-unions": I_CU, insurance: I_SHIELD, government: I_GOV, hospitals: I_HOSP, universities: I_UNI };
const FLAG: Record<string, string> = { "840": "🇺🇸", "826": "🇬🇧", "170": "🇨🇴", "076": "🇧🇷", Europe: "🇪🇺" };

/** The overall median, quarter by quarter: a line with its first and latest values marked. */
function Trend({ points }: { points: { label: string; v: number }[] }) {
  if (points.length < 2) return <p className="xa-note">Not enough history yet.</p>;
  const w = 320, h = 150, pad = { l: 28, r: 14, t: 22, b: 24 };
  const vs = points.map((p) => p.v); const lo = Math.floor((Math.min(...vs) - 3) / 5) * 5, hi = Math.ceil((Math.max(...vs) + 3) / 5) * 5;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((hi - v) * (h - pad.t - pad.b)) / (hi - lo || 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1], yearAgo = points.length > 4 ? points[points.length - 5] : null;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const every = Math.max(1, Math.ceil(points.length / 4));
  const change = yearAgo ? last.v - yearAgo.v : null;
  return (
    <>
      <svg className="xa-trend" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Overall median from ${points[0].v} in ${points[0].label} to ${last.v} in ${last.label}`}>
        {ticks.map((t) => <g key={t}><line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} className="xa-trend-grid" /><text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="xa-trend-ax">{t}</text></g>)}
        <path d={`${d} L${x(points.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`} className="xa-trend-area" />
        <path d={d} className="xa-trend-line" />
        {points.map((p, i) => ((points.length - 1 - i) % every === 0 ? <text key={p.label} x={x(i)} y={h - 6} textAnchor={i === points.length - 1 ? "end" : i === 0 ? "start" : "middle"} className="xa-trend-ax">{p.label}</text> : null))}
        <circle cx={x(points.length - 1)} cy={y(last.v)} r="4" className="xa-trend-dot" />
        <text x={x(points.length - 1)} y={y(last.v) - 9} textAnchor="end" className="xa-trend-val">{last.v}</text>
      </svg>
      {change !== null && <p className="xa-note">{change === 0 ? <>No change since {yearAgo!.label}</> : <><b className={change > 0 ? "xa-up" : "xa-down"}>{change > 0 ? `▲ +${change}` : `▼ ${change}`}</b> since {yearAgo!.label}</>}</p>}
    </>
  );
}

function Spark({ values, color, h = 56 }: { values: (number | null)[]; color: string; h?: number }) {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return null;
  const w = 300, lo = Math.min(...v) - 3, hi = Math.max(...v) + 3;
  const pts = v.map((x, i) => [(i * w) / (v.length - 1), h - ((x - lo) / (hi - lo)) * h]);
  const d = "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");
  return (
    <svg className="xa-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${d} L${w},${h} L0,${h} Z`} style={{ fill: color }} opacity="0.15" /><path d={d} fill="none" style={{ stroke: color }} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}



const Ico = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I_MOVERS = "M7 20V5M3 9l4-4 4 4M17 4v15M13 15l4 4 4-4";
const I_GEAR = "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z";
const I_INFO = "M12 11v6M12 7.5v.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z";
const I_SEARCH = "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4";

/** Day or night: the reader's choice, kept on this device; until they choose, the device's own setting. */
function useTheme(): ["light" | "dark", () => void] {
  const [t, setT] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const cur = document.documentElement.dataset.pzTheme;
    setT(cur === "dark" || cur === "light" ? cur : window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  }, []);
  const toggle = () => {
    const next = t === "dark" ? "light" : "dark";
    document.documentElement.dataset.pzTheme = next;
    try { localStorage.setItem("pz-theme", next); } catch { /* storage blocked: this visit only */ }
    setT(next);
  };
  return [t, toggle];
}
const I_SUN = "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const I_MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z";
const I_MAIL = "M3 5h18v14H3zM3 7l9 6 9-6";
const I_ORGS = "M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M9 11h.01M15 11h.01";
const I_GLOBE = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20";
const I_SECTORS = "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z";
const I_NAMED = "M9 12l2 2 4-4M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z";
const I_HOME = "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z";
const I_LIST = "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01";
const I_MAP = "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14";
type View = "overview" | "directory" | "map" | "settings";
const VIEWS: View[] = ["overview", "directory", "map", "settings"];

/** A reading's change over the last year (or the last step, for yearly sources). */
function yearChange(g: AtlasGroup, k: Measure): number | null {
  const t = (g.trend || []).filter((p) => p[k] !== null);
  if (t.length < 2) return null;
  const last = t[t.length - 1];
  const y = Number(last.period.slice(0, 4)) - 1;
  const target = `${y}${last.period.slice(4)}`;
  const prev = [...t].reverse().find((p) => p.period <= target) || t[0];
  return prev === last ? null : (last[k] as number) - (prev[k] as number);
}

/** The middle and width of a country's largest piece of land (so France's
 *  number sits on France, not between it and French Guiana). */
/** The US outline's Alaska and Hawaii, apart from the lower 48 (by where each
 *  piece sits on the map), so the state view can colour them as their states. */
function usOuterStates(d: string): { AK: string; HI: string } {
  const out = { AK: "", HI: "" };
  for (const part of d.split(/(?=M)/)) {
    const ys: number[] = [];
    for (const m of part.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) ys.push(+m[2]);
    if (!ys.length) continue;
    if (Math.max(...ys) < 110) out.AK += part;        // north-west of the lower 48
    else if (Math.min(...ys) > 195) out.HI += part;   // the Pacific, south-west
  }
  return out;
}

function mainland(d: string): [number, number, number] {
  let best: [number, number, number] = [0, 0, 0]; let area = -1;
  for (const part of d.split(/(?=M)/)) {
    const xs: number[] = [], ys: number[] = [];
    for (const m of part.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) { xs.push(+m[1]); ys.push(+m[2]); }
    if (!xs.length) continue;
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const a = (x1 - x0) * (y1 - y0);
    if (a > area) { area = a; best = [(x0 + x1) / 2, (y0 + y1) / 2, x1 - x0]; }
  }
  return best;
}


/** A change, with a drawn arrow (text arrows become emoji on iPhones). */
function Delta({ n, bare = false }: { n: number; bare?: boolean }) {
  const up = n > 0;
  return (
    <span className="xa-delta">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d={up ? "M2.5 9.5 9.5 2.5M4 2.5h5.5V8" : "M2.5 2.5 9.5 9.5M9.5 4v5.5H4"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {!bare && <>{up ? "+" : "−"}{Math.abs(n)}</>}
    </span>
  );
}

// ── the camera: what part of the map is in view ─────────────────────────────
interface Cam { cx: number; cy: number; zoom: number }

export default function MapApp({ data, world, ops }: { data: ExploreData; world: World; ops: OpsData }) {
  const real = useMemo(() => Object.fromEntries(data.layers.map((l) => [l.layer, l])) as Record<string, AtlasLayer>, [data]);
  const realDefs = useMemo(() => LAYERS.filter((d) => real[d.id]), [real]);
  // "All sectors": every country's sectors read together (lib below), as one more layer.
  // A sector read from several sources (banks: US, Europe, Colombia) also has a
  // combined reading, so tapping the sector opens one card for all of it.
  const sectorDefs = useMemo(() => SECTORS.flatMap((x) => {
    const own = realDefs.filter((d) => d.sector === x.id);
    return own.length > 1 ? [{ id: `sector-${x.id}`, sector: x.id, title: x.label, publisher: own.map((d) => d.publisher).join("; "), asOf: "", evidence: "financial" } as LayerDef] : [];
  }), [realDefs]);
  const layers = useMemo((): Record<string, AtlasLayer> => ({
    ...real, [ALL]: allSectors(realDefs.map((d) => real[d.id])),
    ...Object.fromEntries(sectorDefs.map((sd) => [sd.id, allSectors(realDefs.filter((d) => d.sector === sd.sector).map((d) => real[d.id]), sd.id, sd.sector)])),
  }), [real, realDefs, sectorDefs]);
  const defs = useMemo(() => [...realDefs, ...sectorDefs, ALL_DEF], [realDefs, sectorDefs]);
  const [theme, toggleTheme] = useTheme();
  // The tab: Overview, Directory, Map or About, kept in the address (#map) so a refresh or a shared link opens it.
  const [view, setView] = useState<View>("overview");
  useEffect(() => { const raw = window.location.hash.slice(1); const h = (raw === "about" ? "settings" : raw) as View; if (VIEWS.includes(h)) setView(h); }, []);
  useEffect(() => { try { window.history.replaceState(null, "", view === "overview" ? window.location.pathname + window.location.search : `#${view}`); } catch { /* ignore */ } }, [view]);
  const [dirQ, setDirQ] = useState("");
  const [dirSort, setDirSort] = useState<"high" | "low" | "change" | "az">("high");
  const [dirKind, setDirKind] = useState<"" | "country" | "state">("");
  const [sector, setSector] = useState<Sector>("all");
  const [ovSector, setOvSector] = useState<Sector>("all");   // the Overview's lists: which sector they're for
  // Explore measures financial condition only: Organisational Health. Operational
  // Health needs an organisation's own operational data, which only Pulsus Platform reads.
  const measure: Measure = "ohi";
  const [sel, setSel] = useState<Sel>(null);
  // Operational Health: named institutions, from published complaints data (components/Ops.tsx).
  const [lens, setLensRaw] = useState<Lens>("ohi");
  const [inst, setInst] = useState<string | null>(null);
  const insts = ops.institutions;
  const instOf = (k: string | null) => (k ? insts.find((i) => i.key === k) || null : null);
  const opsSector = (s: Sector) => (s === "all" ? null : OPS_SECTORS.includes(s) ? s : "none");
  const opsAt = (iso: string, s: Sector) => { const sec = opsSector(s); if (sec === "none" || !insts.some((i) => i.country === iso && (!sec || i.sector === sec))) return null; return opsGroup(insts, iso, sec); };
  /** A layer's Operational Health, where named institutions cover it (the US banks and credit unions, as a whole). */
  const opsForLayer = (l: AtlasLayer, region: string | null): { g: OpsGroup; word: string } | null => {
    if (l.layer === "us-banks" && region === null) return { g: opsGroup(insts, "840", "banks"), word: "US banks" };
    if (l.layer === "us-credit-unions" && region === null) return { g: opsGroup(insts, "840", "credit-unions"), word: "US credit unions" };
    if (l.layer === ALL && region === "840") return { g: opsGroup(insts, "840", null), word: "US banks and credit unions" };
    return null;
  };
  const setLens = (k: Lens) => { setLensRaw(k); setSel(null); setInst(null); setPlaying(false); };
  /** The US grid of states for a sector, when it is read by state: the map opens on it. */
  const usGridFor = (sec: Sector): string | null => {
    if (sec === "all") return Object.keys(layers[ALL]?.regions || {}).some((k) => k.startsWith("US-")) ? ALL : null;
    return realDefs.find((d) => d.sector === sec && real[d.id]?.regionKind === "state" && real[d.id].countries.includes("840"))?.id ?? null;
  };
  const [states, setStates] = useState<string | null>(null);   // the full-screen states view (no longer opened: the grid sits on the map)
  const [pins, setPins] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"" | "movers" | "about" | "you" | "search">("");
  const [moverTab, setMoverTab] = useState<"up" | "down" | "hot">("down");
  const [q, setQ] = useState("");
  // The layers the map reads for the chosen sector; "All sectors" is its own combined layer (lib/atlas/allSectors.ts).
  const inSector = useMemo(() => inView(sector, realDefs, layers), [realDefs, layers, sector]);
  const periods = useMemo(() => [...new Set(inSector.flatMap(({ l }) => (l.national.trend || []).map((t) => t.period)))].sort(), [inSector]);
  const [pi, setPi] = useState<number | null>(null);   // null: the latest
  const at = pi === null || pi >= periods.length - 1 ? null : periods[pi];
  const [playing, setPlaying] = useState(false);
  useEffect(() => { setPi(null); setPlaying(false); }, [sector]);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPi((i) => { const n = (i === null ? -1 : i) + 1; if (n >= periods.length - 1) { setPlaying(false); return null; } return n; }), 650);
    return () => clearInterval(t);
  }, [playing, periods.length]);

  // ── names and groups ──────────────────────────────────────────────────────
  const cname = useCallback((iso: string) => world.countries.find((c) => c.id === iso)?.name || iso, [world]);
  // Where Explore shows figures: a country on its own once a group there has at
  // least the layer's minimum; a layer across many countries is named by its
  // scope ("Europe").
  const whereList = useMemo(() => {
    const out: string[] = [];
    for (const d of realDefs) {
      const l = real[d.id];
      if (l.countries.length === 1) { const n = l.countries[0] === "840" ? "the United States" : cname(l.countries[0]); if (!out.includes(n)) out.push(n); continue; }
      // A layer across many countries is named by its scope ("Europe"), however finely it is broken up.
      const n = l.scope.split(" (")[0]; if (!out.includes(n)) out.push(n);
    }
    return out;
  }, [realDefs, real, cname]);
  const shownWhere = whereList.length > 1 ? `${whereList.slice(0, -1).join(", ")} and ${whereList[whereList.length - 1]}` : whereList[0] || "";
  // A US state names its country ("Alaska, US"), so states and countries can't be mistaken in one list.
  const stateName = (code: string) => { const n = STATE_NAME[code] || code; return n.startsWith("US ") ? n : `${n}, US`; };
  const place = useCallback((l: AtlasLayer, region: string) => (region.startsWith("US-") ? stateName(region.slice(3)) : l.regionKind === "state" ? stateName(region) : l.regions[region]?.area || cname(region)), [cname]);
  const groupOf = useCallback((s: NonNullable<Sel>): { def: LayerDef; l: AtlasLayer; g: AtlasGroup; title: string } | null => {
    const l = layers[s.layerId]; const def = defs.find((d) => d.id === s.layerId);
    if (!l || !def) return null;
    if (s.region === null) return { def, l, g: l.national, title: def.title };
    const g = l.regionKind === "country" && l.countries.length === 1 && l.countries[0] === s.region ? l.national : l.regions[s.region];
    if (!g) return null;
    return { def, l, g, title: `${place(l, s.region)}: ${NOUN[def.sector]}` };
  }, [layers, defs, place]);

  // Each country's reading in the sector (the first layer that covers it).
  const atCountry = useCallback((iso: string) => { for (const { def, l } of inSector) { const g = countryGroup(l, iso); if (g) return { def, l, g }; } return null; }, [inSector]);

  // ── the map camera ───────────────────────────────────────────────────────
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 390, h: 800 });
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const wide = size.w >= 900;
  const portrait = size.h > size.w;
  // On a wide screen the controls are a toolbar above the map, not over it: the map is drawn
  // in the space below (mapTop, mh). On a phone it fills the screen under a compact header.
  const topRef = useRef<HTMLElement>(null);
  const [topH, setTopH] = useState(0);
  const mapTop = wide ? topH : 0;
  const mh = Math.max(1, size.h - mapTop);
  // Units per pixel at zoom 1: the whole world's height on a phone, its width on a wide screen.
  const base = portrait ? world.h / mh : Math.max(world.w / size.w, world.h / mh);
  // On a phone the map opens on the Americas, framed so the US grid of states sits whole below the
  // header (measured: it is solid on a phone) and above the colour key and time slider.
  useEffect(() => {
    const el = topRef.current; if (!el) return;
    // The header is hidden on the other tabs (height 0): keep the last real height so the map doesn't jump.
    const read = () => { const h = Math.round(el.getBoundingClientRect().bottom - (box.current?.getBoundingClientRect().top ?? 0)); if (h > 0) setTopH(h); };
    const ro = new ResizeObserver(read); ro.observe(el); read();
    return () => ro.disconnect();
  }, []);
  // The colour key's top, measured like the header (kept while it is hidden): a phone's map is framed above it.
  const keyRef = useRef<HTMLParagraphElement | null>(null);
  const [keyTop, setKeyTop] = useState(0);
  const keyObs = useRef<ResizeObserver | null>(null);
  const setKeyEl = useCallback((el: HTMLParagraphElement | null) => {
    keyObs.current?.disconnect(); keyRef.current = el; if (!el) return;
    const read = () => { const t = Math.round(el.getBoundingClientRect().top - (box.current?.getBoundingClientRect().top ?? 0)); if (t > 0) setKeyTop(t); };
    keyObs.current = new ResizeObserver(read); keyObs.current.observe(el); read();
  }, []);
  /** The bounding box of some countries' outlines, in map units. */
  const boxOf = useCallback((ids: string[]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of world.countries) if (ids.includes(c.id)) for (const m of c.d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) { x0 = Math.min(x0, +m[1]); x1 = Math.max(x1, +m[1]); y0 = Math.min(y0, +m[2]); y1 = Math.max(y1, +m[2]); }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
  }, [world]);
  // Every place Explore covers, in map units: on a wide screen the map opens framed on all of them.
  const coveredBox = useMemo(() => {
    const ids = new Set([...realDefs.flatMap((d) => real[d.id].countries), ...insts.map((i) => i.country)]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of world.countries) if (ids.has(c.id)) for (const m of c.d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)) { x0 = Math.min(x0, +m[1]); x1 = Math.max(x1, +m[1]); y0 = Math.min(y0, +m[2]); y1 = Math.max(y1, +m[2]); }
    return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: world.w, y1: world.h };
  }, [world, realDefs, real, insts]);
  const home: Cam = useMemo(() => {
    if (!portrait) {
      // Kept clear of the round buttons on the right and the key and time slider at the bottom.
      const L = 16, R = 84, T = 12, B = 124, freeW = Math.max(100, size.w - L - R), freeH = Math.max(100, mh - T - B);
      const b = coveredBox, pad = 6, bw = b.x1 - b.x0 + 2 * pad, bh = b.y1 - b.y0 + 2 * pad;
      const uu = Math.max(bw / freeW, bh / freeH), zoom = base / uu;
      return { cx: (b.x0 + b.x1) / 2 - (L + freeW / 2 - size.w / 2) * uu, cy: (b.y0 + b.y1) / 2 - (T + freeH / 2 - mh / 2) * uu, zoom };
    }
    if (!topH) return { cx: 246, cy: 212, zoom: 1.15 };
    // A phone opens on the covered Americas, clear of the header above and the colour key below:
    // the US grid of states (12 by 8 tiles of 14 map units, from (160, 88)) and Colombia; with
    // Operational Health, the US and the UK.
    const grid = { x0: 160, y0: 88, x1: 160 + 12 * 14, y1: 88 + 8 * 14 };
    const join = (a: typeof grid, b: typeof grid | null) => (b ? { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) } : a);
    const opsIds = [...new Set(insts.map((i) => i.country))];
    const t = lens === "ops" ? (boxOf(opsIds) ?? grid) : join(grid, real["co-banks"] || real["co-insurers"] ? boxOf(["170"]) : null);
    // ...and clear of the round buttons on the right edge.
    const L = 12, R = 64, top = topH + 10, bottom = (keyTop > topH ? keyTop : mh - 112) - 10, freeH = Math.max(80, bottom - top), freeW = Math.max(100, size.w - L - R);
    const pad = 3, bw = t.x1 - t.x0 + 2 * pad, bh = t.y1 - t.y0 + 2 * pad;
    const uu = Math.max(bw / freeW, bh / freeH), zoom = Math.min(1.6, base / uu);
    const u2 = base / zoom;
    return { cx: (t.x0 + t.x1) / 2 - (L + freeW / 2 - size.w / 2) * u2, cy: (t.y0 + t.y1) / 2 - ((top + bottom) / 2 - mh / 2) * u2, zoom };
  }, [portrait, topH, keyTop, size.w, mh, base, coveredBox, lens, insts, boxOf, real]);
  const [cam, setCam] = useState<Cam>(home);
  // re-frame only when the framing itself changes (on a wide screen it never does)
  useEffect(() => { setCam(home); }, [home.cx, home.cy, home.zoom]);
  const u = base / cam.zoom;
  const vb = `${cam.cx - (size.w * u) / 2} ${cam.cy - (mh * u) / 2} ${size.w * u} ${mh * u}`;
  const anim = useRef<number | null>(null);
  const flyTo = useCallback((to: Cam) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const from = { ...cam }; const t0 = performance.now(); const dur = 650;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
      setCam({ cx: from.cx + (to.cx - from.cx) * e, cy: from.cy + (to.cy - from.cy) * e, zoom: from.zoom + (to.zoom - from.zoom) * e });
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, [cam]);
  // Switching the measure flies to that measure's opening view (a phone frames the US and the UK for Operational Health).
  const lensSeen = useRef(lens);
  useEffect(() => {
    if (lensSeen.current === lens) return; lensSeen.current = lens;
    if (view === "map") flyTo(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lens, home.cx, home.cy, home.zoom]);
  const paths = useRef(new Map<string, SVGPathElement>());
  /** Fly so a country fills the part of the screen the card leaves free. */
  const flyToCountry = useCallback((iso: string) => {
    const p = paths.current.get(iso); if (!p) return;
    let b = p.getBBox();
    if (iso === "840") b = { x: 170, y: 117, width: 147, height: 76 } as DOMRect;   // the lower 48, not Alaska and the islands
    const freeW = wide ? size.w - 420 : size.w, freeH = wide ? mh - 120 : mh * 0.42;
    const zoom = Math.min(10, Math.max(1, Math.min(freeW / (b.width / base), freeH / (b.height / base)) * 0.6));
    const uu = base / zoom;
    const cx = b.x + b.width / 2 + (wide ? (420 / 2) * uu : 0);
    const cy = b.y + b.height / 2 + (wide ? 0 : (mh * 0.27) * uu);
    flyTo({ cx, cy, zoom });
  }, [wide, size, mh, base, flyTo]);

  // Drag to pan, pinch or wheel to zoom; a short press is a tap.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  // The pointer is captured only once it drags, so a tap still reaches the tile or country under it.
  const onDown = (e: React.PointerEvent) => { ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = 0; if (anim.current) cancelAnimationFrame(anim.current); };
  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    const el = e.currentTarget as Element;
    if (moved.current > 4 && !el.hasPointerCapture(e.pointerId)) { try { el.setPointerCapture(e.pointerId); } catch { /* the pointer has gone */ } }
    const all = [...ptrs.current.entries()];
    if (all.length === 2) {
      const other = all.find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (d0 > 0) setCam((c) => ({ ...c, zoom: Math.min(12, Math.max(0.8, c.zoom * (d1 / d0))) }));
      moved.current += Math.abs(d1 - d0);
    } else {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      moved.current += Math.abs(dx) + Math.abs(dy);
      setCam((c) => ({ ...c, cx: c.cx - dx * (base / c.zoom), cy: c.cy - dy * (base / c.zoom) }));
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); };
  const onWheel = (e: React.WheelEvent) => { setCam((c) => ({ ...c, zoom: Math.min(12, Math.max(0.8, c.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))) })); };

  // ── choosing ─────────────────────────────────────────────────────────────
  const tapCountry = (iso: string) => {
    if (moved.current > 8) return;
    if (lens === "ops") { setInst(null); setSel({ layerId: "ops", region: iso }); setStates(null); setSheet(""); flyToCountry(iso); return; }
    const r = atCountry(iso);
    if (!r) { setSel({ layerId: "", region: iso }); flyToCountry(iso); setSheet(""); return; }
    // The US opens state by state, where every quarter visibly moves the tiles.
    const byState = r.l.regionKind === "state" ? r.l.layer : r.def.id === ALL && iso === "840" && Object.keys(r.l.regions).some((k) => k.startsWith("US-")) ? ALL : null;
    if (byState) { setStates(null); setSel(byState === ALL ? { layerId: ALL, region: "840" } : { layerId: byState, region: null }); setSheet(""); return; }
    setSel({ layerId: r.def.id, region: r.l.regionKind === "state" ? null : r.l.countries.length === 1 ? null : r.def.id === ALL ? iso : regionKeyOf(r.l, iso) });
    setStates(null); setSheet(""); flyToCountry(iso);
  };
  const choose = (layerId: string, region: string | null) => {
    const def = defs.find((d) => d.id === layerId); const l = layers[layerId]; if (!def || !l) return;
    setSector(def.sector); setSheet(""); setQ("");
    if (l.regionKind === "state" && region) { setStates(null); setSel({ layerId, region }); setTimeout(() => flyToCountry("840"), 30); return; }
    setStates(null); setSel({ layerId, region });
    const iso = region ?? l.countries[0];
    setTimeout(() => flyToCountry(iso), 30);
  };
  const close = () => { setSel(null); setInst(null); if (!states) flyTo(home); };
  /** Open the Operational Health view on a country (and, optionally, one of its named institutions). */
  const openOps = (iso: string, key: string | null = null) => {
    setLensRaw("ops"); setPlaying(false); setView("map"); setSheet(""); setStates(null); setQ("");
    setSel({ layerId: "ops", region: iso }); setInst(key);
    setTimeout(() => flyToCountry(iso), 30);
  };
  const pinKey = (s: NonNullable<Sel>) => `${s.layerId}|${s.region ?? ""}`;
  const togglePin = (s: NonNullable<Sel>) => { const k = pinKey(s); setPins((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= MAX_PINS ? p : [...p, k])); };
  // Compare tells you what happened: a short note under the button, read out politely.
  const [pinNote, setPinNote] = useState<{ text: string; view: boolean } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (text: string, view = false) => {
    setPinNote({ text, view });
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setPinNote(null), 7000);
  };
  useEffect(() => () => { if (noteTimer.current) clearTimeout(noteTimer.current); }, []);
  useEffect(() => { setPinNote(null); }, [sel?.layerId, sel?.region]);
  const pinFromCard = (s: NonNullable<Sel>) => {
    const k = pinKey(s);
    if (pins.includes(k)) { togglePin(s); say(pins.length - 1 ? `Removed — ${pins.length - 1} ${pins.length - 1 === 1 ? "place" : "places"} in comparison.` : "Removed from comparison."); return; }
    if (pins.length >= MAX_PINS) return;
    togglePin(s);
    const n = pins.length + 1;
    say(n === 1 ? `Added to comparison. Choose another place to compare (up to ${MAX_PINS}).` : `Added — ${n} places in comparison.`, n >= 2);
  };
  // "View comparison": on a phone the card closes so the tray shows; on a wide screen the tray is beside the card, so it takes focus.
  const trayHead = useRef<HTMLHeadingElement>(null);
  const [trayFlash, setTrayFlash] = useState(0);
  const viewComparison = () => {
    setPinNote(null); setSheet("");
    if (!wide) setSel(null);
    setTrayFlash((x) => x + 1);
  };
  useEffect(() => {
    if (!trayFlash) return;
    const t = setTimeout(() => trayHead.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [trayFlash]);

  // ── search ───────────────────────────────────────────────────────────────
  const allGroups = useMemo(() => {
    // `hay`: what a search matches, without case or accents; an area ("Benelux and Ireland") also answers to its countries' names.
    const out: { layerId: string; region: string | null; label: string; g: AtlasGroup; hay: string }[] = [];
    for (const def of realDefs) {
      const l = layers[def.id];
      out.push({ layerId: def.id, region: null, label: def.title, g: l.national, hay: fold(`${def.title} ${def.sector}`) });
      for (const [r, g] of Object.entries(l.regions)) if (!g.hidden && !(l.regionKind === "country" && l.countries.length === 1)) { const label = `${place(l, r)}: ${NOUN[def.sector]}`; out.push({ layerId: def.id, region: r, label, g, hay: fold(`${label} ${def.sector} ${(g.members || []).map(cname).join(" ")}`) }); }
    }
    return out;
  }, [realDefs, layers, place, cname]);
  /** Named institutions a search finds. In the Operational Health view a place's name
   *  ("UK", "United States") finds that country's institutions. */
  const instFind = useCallback((text: string, withPlace: boolean, hay: (i: (typeof insts)[number]) => string) => {
    const f = withPlace ? findPlaceIn(text) : null;
    const isos = f ? isosOf(f.place) : [];
    const words = f && isos.length ? f.rest : fold(text).split(" ").filter(Boolean);
    return insts.filter((i) => (!isos.length || isos.includes(i.country)) && words.every((w) => fold(hay(i)).includes(w)));
  }, [insts]);
  const instHits = useMemo(() => (q.trim().length < 2 ? [] : instFind(q, lens === "ops", (i) => `${i.name} ${i.listedAs.join(" ")}`).slice(0, 8)), [q, lens, instFind]);
  /** In the Operational Health view, a country it reads, by name: its place card. */
  const placeHit = useMemo(() => {
    if (lens !== "ops" || q.trim().length < 2) return null;
    const f = findPlaceIn(q); if (!f || f.place.kind !== "country" || f.rest.length) return null;
    const iso = f.place.iso; return insts.some((i) => i.country === iso) ? iso : null;
  }, [q, lens, insts]);
  const hits = useMemo(() => {
    if (q.trim().length < 2) return [];
    const words = fold(q).split(" ").filter(Boolean);
    return allGroups.filter((g) => words.every((w) => g.hay.includes(w))).slice(0, 8);
  }, [q, allGroups]);
  /** A search that found nothing: why, when it names a place Explore doesn't
   *  cover, one coming next, or one with nothing in the sector (lib/atlas/places.ts). */
  const whyEmpty = (text: string, chosen: Sector, setText: (s: string) => void, plain: React.ReactNode) => {
    const named = findSector(text);
    const ohiCov = layerCoverage(realDefs.map((d) => real[d.id])), opsCov = institutionCoverage(insts);
    const o = explainEmpty(text, chosen !== "all" ? chosen : named, lens === "ohi" ? ohiCov : opsCov, NEXT, lens === "ohi" ? opsCov : ohiCov);
    if (!o) return plain;
    const covers = coversText({ ohi: whereList, ops: (["840", "826"] as const).filter((c) => insts.some((i) => i.country === c)).map((c) => (c === "840" ? "the United States" : "the United Kingdom")) });
    const s = sayEmpty(o, covers, (x) => NOUN[x as Sector] || x, lens);
    const toAll = () => { if (chosen !== "all") { setSector("all"); setSel(null); setStates(null); } if (named) setText(o.place.name.replace(/^the /, "")); };
    return (
      <div className="xa-why" role="status">
        <p>{s.text}</p>
        {(s.allSectors || s.ask || s.switchTo) && <p className="xa-why-do">{s.switchTo && <button type="button" className="xa-btn ghost" onClick={() => setLens(s.switchTo!)}>Switch to {MEASURE_NAME[s.switchTo]}</button>}{s.allSectors && <button type="button" className="xa-btn ghost" onClick={toAll}>Try all sectors</button>}{s.ask && <a href={ASK_URL}>Ask us to add it</a>}</p>}
      </div>
    );
  };

  // ── what is shown ────────────────────────────────────────────────────────
  const cur = sel && sel.layerId ? groupOf(sel) : null;
  const statesLayer = states ? layers[states] : null;
  const fill = (g: AtlasGroup | undefined) => {
    const v = valueAt(g, measure, at);
    if (v === undefined) return g && g.hidden ? COLOR.few : COLOR.none;
    return shade(v);
  };
  const insight = data.insights;
  const movers: (Mover | Hotspot)[] = moverTab === "up" ? insight.up : moverTab === "down" ? insight.down : insight.hotspots;
  // Markers: countries in this sector among the movers and hotspots.
  const markers = useMemo(() => {
    const m: { iso: string; color: string }[] = [];
    const add = (layer: string, region: string, kind: string, color: string) => {
      const l = layers[layer]; const def = defs.find((d) => d.id === layer); if (!l || !def || (sector !== "all" && def.sector !== sector)) return;
      const iso = kind === "state" ? l.countries[0] : region; if (iso === "840" && usGridFor(sector)) return; if (!m.some((x) => x.iso === iso)) m.push({ iso, color });
    };
    if (lens === "ops") return m;
    for (const x of insight.up.slice(0, 3)) add(x.layer, x.region, x.regionKind, COLOR.good);
    for (const x of insight.down.slice(0, 3)) add(x.layer, x.region, x.regionKind, COLOR.bad);
    return m;
  }, [insight, layers, defs, sector, lens]);
  // Every country's middle and width, measured once the map is drawn: where its number and marker sit.
  const [centres, setCentres] = useState<Record<string, [number, number, number]>>({});
  useEffect(() => {
    const c: Record<string, [number, number, number]> = {};
    for (const k of world.countries) c[k.id] = mainland(k.d);
    setCentres(c);
  }, [world]);
  // Each covered country's reading at the chosen period: shown on the map, so the slider visibly moves it.
  const gridId = lens === "ops" ? null : usGridFor(sector);   // the US is drawn as its states, on the world map (financial view only)
  /** A country's colour and number in the Operational Health view: its median, with enough scored institutions. */
  const opsFill = (iso: string) => { const g = opsAt(iso, sector); return !g ? (NEXT[iso] ? COLOR.next : COLOR.none) : g.hidden ? COLOR.few : shade(g.median!); };
  const opsLabels = useMemo(() => Object.keys(COUNTRY).map((iso) => ({ iso, g: opsAt(iso, sector) })).filter((x) => x.g && !x.g.hidden && centres[x.iso]).map((x) => ({ iso: x.iso, v: x.g!.median!, lim: !canRank(x.g!.n) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [insts, sector, centres]);
  const labels = useMemo(() => {
    const out: { iso: string; v: number; lim: boolean }[] = [];
    for (const c of world.countries) {
      if (gridId && c.id === "840") continue;
      const r = atCountry(c.id); if (!r || !centres[c.id]) continue;
      if (r.g.members && r.g.members[0] !== c.id) continue;   // an area's number sits once, on its largest country
      const v = valueAt(r.g, measure, at);
      if (v !== undefined) out.push({ iso: c.id, v, lim: !canRank(r.g.n) });
    }
    return lens === "ops" ? opsLabels : out;
  }, [world, atCountry, centres, measure, at, gridId, lens, opsLabels]);
  // A multi-country layer where no country has enough organisations on its own
  // (Europe's largest banks: 105 banks, none of the 25 countries with 20) is
  // read as one region: a single badge with the region's score, and its
  // countries lightly tinted with that colour. No country is given a score of its own.
  const regionBadges = useMemo(() => {
    const out: { layerId: string; name: string; x: number; y: number; v: number; isos: string[] }[] = [];
    if (lens === "ops") return out;
    for (const def of realDefs) {
      if (sector !== "all" && def.sector !== sector) continue;
      const l = real[def.id];
      if (l.countries.length < 2 || Object.values(l.regions).some((g) => !g.hidden)) continue;
      const v = valueAt(l.national, measure, at); if (v === undefined) continue;
      const pts = l.countries.map((c) => centres[c]).filter(Boolean);
      if (!pts.length || out.some((b) => b.isos.join() === l.countries.join())) continue;
      // The middle of the region's larger countries, so small far-off members don't pull it into the sea.
      const big = [...pts].sort((a, b) => b[2] - a[2]).slice(0, Math.max(3, Math.ceil(pts.length / 3)));
      out.push({ layerId: def.id, name: l.scope.split(" (")[0].replace(/'s largest.*$/, ""), x: big.reduce((a, p) => a + p[0], 0) / big.length, y: big.reduce((a, p) => a + p[1], 0) / big.length, v, isos: l.countries });
    }
    return out;
  }, [realDefs, real, sector, measure, at, centres, lens]);
  const regionTint = useMemo(() => { const t: Record<string, string> = {}; for (const b of regionBadges) for (const i of b.isos) t[i] = `color-mix(in srgb, ${shade(b.v)} 45%, ${COLOR.few})`; return t; }, [regionBadges]);
  const unpinned = (k: string) => { const [layerId, region] = k.split("|"); return { layerId, region: region || null }; };

  // ── the card ─────────────────────────────────────────────────────────────
  const card = (() => {
    const one = instOf(inst);
    if (one) return <InstitutionCard i={one} all={insts} onClose={close} onPlace={() => { setInst(null); setSector(one.sector as Sector); setSel({ layerId: "ops", region: one.country }); }} />;
    if (!sel) return null;
    if (sel.layerId === "ops") {
      const iso = sel.region!; const sec = opsSector(sector);
      if (!COUNTRY[iso] || sec === "none") return (
        <div className="xa-card-in">
          <div className="xa-card-h"><h2>{cname(iso)}</h2><button className="xa-x" onClick={close} aria-label="Close">×</button></div>
          <p className="xa-muted">Operational Health: no complaints data from a free, openly licensed source covers {sec === "none" ? `${NOUN[sector]} here` : "institutions here"} yet. Explore shows it for named banks and credit unions in the United States and banks and insurers in the United Kingdom.</p>
        </div>
      );
      return <PlaceOpsCard country={iso} sector={sec} all={insts} sectorLabel={sec ? NOUN[sector as Sector] : iso === "826" ? "banks and insurers" : "banks and credit unions"} onClose={close} onInst={(k) => setInst(k)} />;
    }
    if (!sel.layerId) {
      const iso = sel.region!;
      return (
        <div className="xa-card-in">
          <div className="xa-card-h"><h2>{cname(iso)}</h2><button className="xa-x" onClick={close} aria-label="Close">×</button></div>
          <p className="xa-muted">{NEXT[iso] || ELSEWHERE}</p>
          {insts.some((i) => i.country === iso) && <div className="xa-btns"><button className="xa-btn" onClick={() => openOps(iso)}>See Operational Health ›</button></div>}
        </div>
      );
    }
    if (!cur) return null;
    const { def, l, g, title } = cur;
    const pinned = pins.includes(pinKey(sel));
    return (
      <div className="xa-card-in">
        <div className="xa-card-h"><h2>{sel.region === null && l.regionKind === "state" ? `${cname(l.countries[0])}: ${NOUN[def.sector]}` : title}</h2><button className="xa-x" onClick={close} aria-label="Close">×</button></div>
        <p className="xa-sub">{def.title} · {when(l, at || l.asOf)}</p>
        {g.hidden ? <><Sample n={g.n} many={NOUN[def.sector]} /><p className="xa-muted">Not shown on their own, so no institution can be singled out. They are counted in the totals.</p></> : (
          <>
            <div className="xa-stats">
              <div><small>{NOUN[def.sector]}</small><b>{n0(g.n)}</b></div>
            </div>
            <Sample n={g.n} many={NOUN[def.sector]} />
            <Measures v={valueAt(g, "ohi", at)} ops={opsForLayer(l, sel.region)} onOps={() => openOps("840")} />
            {(g.trend || []).length > 1 && (
              <>
                <Spark values={(g.trend || []).map((t) => t[measure])} color={lineShade((g.trend || []).map((t) => t[measure]))} />
                <p className="xa-axis"><span>{when(l, g.trend![0].period)}</span><span>{WORD[measure]}</span><span>{when(l, g.trend![g.trend!.length - 1].period)}</span></p>
              </>
            )}
            {l.indicators && g.ind && <Indicators l={l} g={g} publisher={def.publisher} />}
          </>
        )}
        {def.id === ALL && sel.region && (
          <div className="xa-by">
            <p className="xa-label">By sector · tap to open</p>
            {realDefs.map((d) => { const rl = real[d.id]; const st = sel.region!.startsWith("US-") ? sel.region!.slice(3) : null;
              const rg = st ? (rl.regionKind === "state" && rl.countries.includes("840") ? rl.regions[st] : null) : countryGroup(rl, sel.region!); if (!rg) return null;
              const rv = valueAt(rg, measure, at);
              return (
                <button key={d.id} onClick={() => choose(d.id, st ? st : rl.regionKind === "state" ? null : rl.countries.length === 1 ? null : sel.region)}>
                  <span><b>{SECTORS.find((x) => x.id === d.sector)?.label}</b><small>{n0(rg.n)} {NOUN[d.sector]} · {rg.hidden ? "too few for an average" : band(rg.n)} · {d.publisher}</small></span>
                  <em>{rg.hidden ? "few" : rv ?? "—"}</em>
                </button>
              ); })}
          </div>
        )}
        <div className="xa-btns">
          {!g.hidden && canRank(g.n) && <button className={`xa-btn ghost${pinned ? " on" : ""}`} onClick={() => pinFromCard(sel)} aria-pressed={pinned}
            disabled={!pinned && pins.length >= MAX_PINS} aria-describedby={!pinned && pins.length >= MAX_PINS ? "xa-cmp-full" : undefined}
            title={pinned ? "In comparison: tap to remove" : undefined}>{pinned ? <>✓ In comparison<span className="xa-vh"> (tap to remove)</span></> : "+ Compare"}</button>}
          {pins.length > 0 && <button className="xa-btn view" onClick={viewComparison}>View comparison ({pins.length})</button>}
        </div>
        {!g.hidden && canRank(g.n) && !pinned && pins.length >= MAX_PINS && <p id="xa-cmp-full" className="xa-cmp-full">Comparison full — remove one to add another.</p>}
        {!g.hidden && !canRank(g.n) && <p className="xa-note">Not ranked or compared: a limited sample. Rankings and comparisons need at least {RANK_MIN}.</p>}
        <div className="xa-cmp-note" role="status" aria-live="polite">
          {pinNote && <><span>{pinNote.text}</span>{pinNote.view && <button className="xa-linkbtn" onClick={viewComparison}>View comparison</button>}</>}
        </div>
        <p className="xa-note">{def.id === ALL ? <>Each sector&apos;s median, weighted by how many organisations it has. No institution is named in the financial figures.</> : <>{def.publisher}. No institution is named in the financial figures.</>}</p>
      </div>
    );
  })();

  const chips = (
    <div className="xa-chips" role="group" aria-label="Sector">
      {[{ id: "all" as Sector, label: "All sectors", status: "live", where: "Every sector, together" }, ...SECTORS].map((s) => (
        <button key={s.id} className={`xa-chip${sector === s.id ? " on" : ""}`} disabled={s.status !== "live"} aria-pressed={sector === s.id}
          onClick={() => { setSector(s.id); setSel(null); setStates(null); flyTo(home); }} title={s.status === "live" ? s.where : "Coming next"}>
          {s.label}{s.status !== "live" && <small> · next</small>}
        </button>
      ))}
    </div>
  );

  /** Which measure the map shows. The two are never blended. */
  const lensSeg = (
    <div className="xa-seg xa-lens" role="group" aria-label="Measure">
      {([["ohi", "Organisational Health"], ["ops", "Operational Health"]] as [Lens, string][]).map(([k, w]) => (
        <button key={k} className={lens === k ? "on" : ""} aria-pressed={lens === k} onClick={() => setLens(k)}>{w}</button>
      ))}
    </div>
  );
  const logo = <a href="/"><img src={theme === "light" ? "/pulsus-explore-logo.png" : "/pulsus-explore-logo-night.png"} alt="Pulsus Explore" width={588} height={160} /></a>;
  const you = <button className="xa-you" onClick={() => setSheet(sheet === "you" ? "" : "you")}>See How You Stack Up →</button>;
  const brand = <div className="xa-brand">{logo}{you}</div>;
  /** Open a place on the map, with its card. */
  const open = (layerId: string, region: string | null) => { setView("map"); choose(layerId, region); };
  const openSector = (id: Sector) => { setSector(id); setSel(null); setStates(null); setView("map"); flyTo(home); };
  /** A sector card on the Overview: the map, on that sector, with its card open. */
  const openSectorCard = (id: Sector) => {
    const own = realDefs.filter((d) => d.sector === id);
    const layerId = own.length > 1 ? `sector-${id}` : own[0]?.id;
    if (!layerId) { openSector(id); return; }
    setSector(id); setStates(null); setView("map"); setSheet(""); setSel({ layerId, region: null });
    setTimeout(() => { if (own.length === 1 && layers[layerId].countries.length === 1) flyToCountry(layers[layerId].countries[0]); else flyTo(home); }, 30);
  };

  // ── Overview (the Pulse tab): the world of business at a glance ──────────────────────────────────────
  const allL = layers[ALL];
  const sectorCards = SECTORS.filter((x) => x.status === "live").map((x) => {
    const ls = realDefs.filter((d) => d.sector === x.id).map((d) => real[d.id]);
    return ls.length ? { x, l: ls.length === 1 ? ls[0] : allSectors(ls), n: ls.length } : null;
  }).filter(Boolean) as { x: (typeof SECTORS)[number]; l: AtlasLayer; n: number }[];
  // By region: every sector's layers in one place (the United States, Europe, Colombia), read as one.
  const placeCards = (() => {
    const by = new Map<string, AtlasLayer[]>();
    for (const d of realDefs) {
      const l = real[d.id];
      const name = l.countries.length === 1 ? (l.countries[0] === "840" ? "the United States" : cname(l.countries[0])) : l.scope.split(" (")[0];
      by.set(name, [...(by.get(name) || []), l]);
    }
    return [...by.entries()].map(([name, ls]) => ({ name, flag: FLAG[ls.length && ls[0].countries.length === 1 ? ls[0].countries[0] : name] || "🌐", l: ls.length === 1 ? ls[0] : allSectors(ls) }));
  })();
  // The movers and areas to watch, for the sector chosen on the Overview ("all": every sector).
  const ovInsight = ovSector === "all" ? insight
    : insightsOf(realDefs.filter((d) => d.sector === ovSector).map((d) => real[d.id]), data.depth);
  const ovLabel = ovSector === "all" ? "All sectors" : SECTORS.find((x) => x.id === ovSector)?.label ?? "";
  const moverRow = (m: Mover | Hotspot) => {
    const l = layers[m.layer]; const def = defs.find((d) => d.id === m.layer); if (!l || !def) return null;
    const mv = "change" in m;
    return (
      <button key={`${m.layer}|${m.region}`} onClick={() => open(m.layer, m.region)}>
        <span><b>{place(l, m.region)}</b><small>{NOUN[def.sector]}{mv ? ` · ${(m as Mover).from} → ${(m as Mover).to}` : ` · median of ${n0((m as Hotspot).n)} · ${band((m as Hotspot).n)}`}</small></span>
        <em style={{ color: mv ? ((m as Mover).change > 0 ? COLOR.good : COLOR.bad) : undefined }}>{mv ? <Delta n={(m as Mover).change} /> : (m as Hotspot).score}</em>
      </button>
    );
  };
  const overview = (
    <div className="xa-ov">
      <section className="xa-panel xa-hero">
        <p className="xa-label">The world of business at a glance · {when(allL, allL.asOf)}</p>
        <div className="xa-hero-row">
          <div><strong>{allL.national.ohi ?? "—"}</strong><small>Organisational Health</small></div>
          <div className="xa-hero-ops"><strong>{(["840", "826"] as const).map((c, k) => { const g = opsGroup(insts, c, null); return <span key={c}>{k > 0 && <i> · </i>}<small>{c === "840" ? "US" : "UK"}</small> {g.hidden ? "—" : g.median}</span>; })}</strong><small>Operational Health</small></div>
        </div>
        <p className="xa-note xa-measure-note">Organisational Health: each institution scored out of 100 from the figures its regulator publishes, against the same fixed levels; a place&apos;s score is the median of its institutions. Operational Health: calculated from complaints data regulators publish by firm; each country&apos;s figure is the {(["840", "826"] as const).map((c) => `${c === "840" ? "US" : "UK"} ${medianLabel(opsGroup(insts, c, null).n)}`).join(" and the ")}. {SAME_COUNTRY} Every average shows how many organisations it describes: under {SHOW_MIN}, no average; {SHOW_MIN} to {RANK_MIN - 1}, a {BAND_LABEL.limited.toLowerCase()}, never ranked; {RANK_MIN} to 49, a {BAND_LABEL.moderate.toLowerCase()}; 50 or more, a {BAND_LABEL.broad.toLowerCase()}. The two measures are kept separate.</p>
        <ul className="xa-stats" aria-label="What Explore covers">
          <li title="Organisations scored for Organisational Health; none is named in the financial figures"><Ico d={I_ORGS} size={18} /><b>{n0(allL.national.n)}</b><small>organisations</small></li>
          <li title={shownWhere}><Ico d={I_GLOBE} size={18} /><b>{whereList.length}</b><small>{whereList.length === 1 ? "region" : "regions"}</small></li>
          <li title={sectorCards.map(({ x }) => x.label).join(", ")}><Ico d={I_SECTORS} size={18} /><b>{sectorCards.length}</b><small>sectors</small></li>
          <li title="Banks, credit unions and insurers named for Operational Health, in the United States and the United Kingdom"><Ico d={I_NAMED} size={18} /><b>{n0(insts.length)}</b><small>named · US &amp; UK</small></li>
        </ul>
        <div className="xa-btns"><button className="xa-btn" onClick={() => openSector("all")}>Open the map ›</button><button className="xa-btn ghost" onClick={() => { setLens("ops"); setSector("all"); setView("map"); flyTo(home); }}>Operational Health ›</button><button className="xa-btn ghost" onClick={() => setView("directory")}>Browse the directory</button></div>
      </section>
      <Invite />
      <div className="xa-boxes">
        <section className="xa-panel xa-box" aria-labelledby="xa-box-sec">
          <h2 id="xa-box-sec" className="xa-box-h">Sectors <small>median Organisational Health</small></h2>
          <ul className="xa-bars">
            {sectorCards.map(({ x, l }) => { const v = l.national.ohi; return (
              <li key={x.id}><button type="button" onClick={() => openSectorCard(x.id)} aria-label={`${x.label}: ${v ?? "no score"}, ${n0(l.national.n)} ${NOUN[x.id]}. Open on the map`} title={`${n0(l.national.n)} ${NOUN[x.id]} · ${x.where}`}>
                <Ico d={SECTOR_ICON[x.id] || I_ORGS} size={17} /><span className="xa-bar-l">{x.label}</span>
                <span className="xa-bar"><i style={{ width: `${v ?? 0}%`, background: v == null ? "var(--few)" : shade(v) }} /></span><b>{v ?? "—"}</b>
              </button></li>); })}
            {SECTORS.filter((x) => x.status !== "live").map((x) => <li key={x.id} className="is-next"><span className="xa-row"><Ico d={SECTOR_ICON[x.id] || I_ORGS} size={17} /><span className="xa-bar-l">{x.label}</span><span className="xa-bar" /><small>Next</small></span></li>)}
          </ul>
          <p className="xa-note">Tap a sector to see it on the map.</p>
        </section>
        <section className="xa-panel xa-box" aria-labelledby="xa-box-where">
          <h2 id="xa-box-where" className="xa-box-h">By region <small>median Organisational Health</small></h2>
          <ul className="xa-bars">
            {placeCards.map(({ name, flag, l }) => { const v = l.national.ohi; return (
              <li key={name}><span className="xa-row" title={`${n0(l.national.n)} organisations`}>
                <span className="xa-flag" aria-hidden="true">{flag}</span><span className="xa-bar-l">{name.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase())}</span>
                <span className="xa-bar"><i style={{ width: `${v ?? 0}%`, background: v == null ? "var(--few)" : shade(v) }} /></span><b>{v ?? "—"}</b>
              </span></li>); })}
          </ul>
          <p className="xa-note">Each region&apos;s median across every sector it has.</p>
        </section>
        <section className="xa-panel xa-box" aria-labelledby="xa-box-trend">
          <h2 id="xa-box-trend" className="xa-box-h">Trend <small>overall median, by quarter</small></h2>
          <Trend points={(allL.national.trend || []).filter((t) => t.ohi !== null).map((t) => ({ label: when(allL, t.period), v: t.ohi as number }))} />
        </section>
      </div>
      <h2 className="xa-h2">What&apos;s moving · {ovLabel}</h2>
      <p className="xa-sub xa-hint">Choose a sector for the lists below. Tap a place to see it on the map.</p>
      <div className="xa-chips xa-ov-chips" role="group" aria-label="Sector for the lists below">
        {[{ id: "all" as Sector, label: "All sectors" }, ...sectorCards.map(({ x }) => ({ id: x.id as Sector, label: x.label }))].map((s) => (
          <button key={s.id} className={`xa-chip${ovSector === s.id ? " on" : ""}`} aria-pressed={ovSector === s.id} onClick={() => setOvSector(s.id)}>{s.label}</button>
        ))}
      </div>
      <div className="xa-cols">
        <section className="xa-panel"><h2 className="xa-h2 is-up"><Delta n={1} bare /> Improving Indicators</h2><p className="xa-sub">{ovLabel}</p><div className="xa-list">{ovInsight.up.length ? ovInsight.up.slice(0, 4).map(moverRow) : <p className="xa-sub">None over the last year.</p>}</div></section>
        <section className="xa-panel"><h2 className="xa-h2 is-down"><Delta n={-1} bare /> Declining Indicators</h2><p className="xa-sub">{ovLabel}</p><div className="xa-list">{ovInsight.down.length ? ovInsight.down.slice(0, 4).map(moverRow) : <p className="xa-sub">None over the last year.</p>}</div></section>
        <section className="xa-panel"><h2 className="xa-h2 is-hot">Areas to Watch</h2><p className="xa-sub">{ovLabel}: places with the lowest median Organisational Health</p><div className="xa-list">{ovInsight.hotspots.length ? ovInsight.hotspots.slice(0, 4).map(moverRow) : <p className="xa-sub">Not enough places to rank yet.</p>}</div></section>
      </div>
      <p className="xa-note">Organisational Health over the last year, among places with at least {INSIGHT_MIN} organisations. Scores are calculated by Pulsus from published regulatory data. They are not official regulatory ratings.</p>
    </div>
  );

  // ── Directory: every place and sector, searchable ────────────────────────
  const rows = useMemo(() => allGroups.map((r) => {
    const l = layers[r.layerId]; const def = defs.find((d) => d.id === r.layerId)!;
    return { ...r, l, def, v: valueAt(r.g, measure, null), ch: yearChange(r.g, measure) };
  }), [allGroups, layers, defs, measure]);
  const shown = useMemo(() => {
    const words = fold(dirQ).split(" ").filter(Boolean);
    const out = rows.filter((r) => (sector === "all" || r.def.sector === sector)
      && (!dirKind || (dirKind === "state") === (r.region !== null && r.l.regionKind === "state"))
      && words.every((w) => r.hay.includes(w) || fold(r.def.title).includes(w)));
    const by = { high: (a: typeof out[0], b: typeof out[0]) => (b.v ?? -1) - (a.v ?? -1), low: (a: typeof out[0], b: typeof out[0]) => (a.v ?? 999) - (b.v ?? 999), change: (a: typeof out[0], b: typeof out[0]) => Math.abs(b.ch ?? 0) - Math.abs(a.ch ?? 0), az: (a: typeof out[0], b: typeof out[0]) => a.label.localeCompare(b.label) }[dirSort];
    // Highest, lowest and biggest change rank: only groups of RANK_MIN or more; limited samples follow, A to Z, not ranked.
    return dirSort === "az" ? out.sort(by) : rankedFirst(out, (r) => r.g.n, by, (r) => r.label);
  }, [rows, dirQ, sector, measure, dirSort, dirKind]);
  const instShown = useMemo(() => {
    const sec = opsSector(sector);
    const out = instFind(dirQ, true, (i) => `${i.name} ${i.listedAs.join(" ")} ${i.group || ""} ${COUNTRY[i.country]} ${i.sector}`)
      .filter((i) => (sec === null || i.sector === sec) && (!dirKind || dirKind === "country"))
      .map((i) => ({ i, s: scoreOf(i).score }));
    const az = (a: typeof out[0], b: typeof out[0]) => a.i.name.localeCompare(b.i.name);
    // Scores compare institutions within the same country only: a sort by score orders each
    // country's institutions on their own, the United States first, then the United Kingdom.
    const byCountry = (a: typeof out[0], b: typeof out[0]) => b.i.country.localeCompare(a.i.country);
    const by = dirSort === "high" ? (a: typeof out[0], b: typeof out[0]) => (b.s ?? -1) - (a.s ?? -1) || az(a, b) : dirSort === "low" ? (a: typeof out[0], b: typeof out[0]) => (a.s ?? 999) - (b.s ?? 999) || az(a, b) : az;
    return out.sort(dirSort === "high" || dirSort === "low" ? (a, b) => byCountry(a, b) || by(a, b) : by);
  }, [instFind, dirQ, sector, dirKind, dirSort]);
  const directory = (
    <div className="xa-dir">
      <div className="xa-dir-tools">
        <label className="xa-dir-q"><Ico d={I_SEARCH} size={18} /><input value={dirQ} onChange={(e) => setDirQ(e.target.value)} placeholder="Search a country, state or sector" aria-label="Search the directory" /></label>
        {chips}
        <div className="xa-seg xa-kind">{([["", "Everywhere"], ["country", "Countries"], ["state", "US states"]] as ["" | "country" | "state", string][]).map(([k, w]) => <button key={k || "all"} className={dirKind === k ? "on" : ""} onClick={() => setDirKind(k)}>{w}</button>)}</div>
        <div className="xa-dir-row">
          <label className="xa-sort"><span>Sort</span><select value={dirSort} onChange={(e) => setDirSort(e.target.value as typeof dirSort)}><option value="high">Highest first</option><option value="low">Lowest first</option><option value="change">Biggest change</option><option value="az">A to Z</option></select></label>
        </div>
        {lensSeg}
        {lens === "ohi"
          ? <p className="xa-sub">{shown.length} {shown.length === 1 ? "place" : "places"} · {WORD[measure]} · places and sectors only; no institution is named</p>
          : <p className="xa-sub">{instShown.length} named {instShown.length === 1 ? "institution" : "institutions"} · Operational Health, from published complaints data · {SAME_COUNTRY} <a href="/methodology">How it is calculated</a></p>}
      </div>
      {lens === "ops" ? (
        <ul className="xa-dir-list">
          {instShown.map(({ i, s }, k) => (
            <React.Fragment key={i.key}>
            {(dirSort === "high" || dirSort === "low") && (k === 0 || instShown[k - 1].i.country !== i.country) && <li className="xa-dir-h">{COUNTRY[i.country]} · {dirSort === "high" ? "highest" : "lowest"} first, among {i.country === "840" ? "US" : "UK"} institutions only</li>}
            <li>
              <button onClick={() => openOps(i.country, i.key)}>
                <span className="xa-dir-dot" style={{ background: s !== null ? shade(s) : COLOR.few }} />
                <span className="xa-dir-name"><b>{i.name}</b><small>{COUNTRY[i.country]} · {NOUN[i.sector as Sector].replace(/s$/, "")} · {n0(i.complaints)} complaints received</small></span>
                <span className="xa-dir-v"><strong className={s === null ? "xa-dash" : undefined}>{s ?? "—"}</strong></span>
              </button>
            </li>
            </React.Fragment>
          ))}
          {!instShown.length && <li className="xa-muted xa-empty">{whyEmpty(dirQ, sector, setDirQ, "No named institution matches. Operational Health covers banks, credit unions and insurers in the US and the UK.")}</li>}
        </ul>
      ) : (
      <ul className="xa-dir-list">
        {shown.map((r) => (
          <li key={`${r.layerId}|${r.region}`}>
            <button onClick={() => open(r.layerId, r.region)}>
              <span className="xa-dir-dot" style={{ background: r.v !== undefined ? shade(r.v) : COLOR.few }} />
              <span className="xa-dir-name"><b>{r.region === null ? r.def.title : r.label}</b><small>{n0(r.g.n)} {NOUN[r.def.sector]} · <span className={`xa-band is-${bandOf(r.g.n)}`}>{band(r.g.n)}{!canRank(r.g.n) && dirSort !== "az" ? " · not ranked" : ""}</span> · {when(r.l, r.l.asOf)}</small></span>
              <span className="xa-dir-v"><strong>{r.v ?? "—"}</strong>{r.ch !== null && r.ch !== 0 && <small style={{ color: r.ch > 0 ? COLOR.good : COLOR.bad }}><Delta n={r.ch} /></small>}</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="xa-muted xa-empty">{whyEmpty(dirQ, sector, setDirQ, "Nothing matches. Try another word, or all sectors.")}</li>}
      </ul>
      )}
    </div>
  );

  // ── About ────────────────────────────────────────────────────────────────
  const about = (
    <div className="xa-ab">
      <section className="xa-panel">
        <h2 className="xa-h2">Plans &amp; Billing</h2>
        <dl className="xa-plans">
          <div><dt>Free</dt><dd>Explore, as you see it here. No account needed.</dd><dd className="xa-price">Free</dd></div>
          <div><dt>Pulse</dt><dd>Your organisation&apos;s health from its own data, and what needs attention today: the daily brief and alerts. One Pulse for everyone you share it with.</dd><dd className="xa-price">Contact us</dd></div>
          <div><dt>Executive Intelligence</dt><dd>Pulse plus the deeper tools: the diagnosis, treatments, recovery and where you stand among these peers, with the Board Pack.</dd><dd className="xa-price">Contact us</dd></div>
          <div><dt>Oversight Intelligence</dt><dd>For those who watch over many organisations at once.</dd><dd className="xa-price">Contact us</dd></div>
        </dl>
        <div className="xa-btns"><a className="xa-btn ghost" href={`${PLATFORM}/signup?product=platform`}>Start a 14-day trial</a></div>
        <p className="xa-note">Or <a href={`${ABOUT}/walkthrough/`}>talk to us about a plan</a>.</p>
      </section>
      <section className="xa-panel">
        <h2 className="xa-h2">Take a Peek</h2>
        <p>See Pulsus <span className="xa-red">Platform</span> with a fictional organisation, Meridian Society: every screen, before you sign up.</p>
        <div className="xa-btns"><a className="xa-btn" href={`${ABOUT}/demo/?from=explore`}>Take a peek</a></div>
      </section>
      <section className="xa-panel xa-ab-row">
        <h2 className="xa-h2">Appearance</h2>
        <button className="xa-btn ghost" onClick={toggleTheme}><Ico d={theme === "dark" ? I_SUN : I_MOON} size={16} /> {theme === "dark" ? "Switch to day" : "Switch to night"}</button>
      </section>
      <section className="xa-panel">
        <h2 className="xa-h2">Updates</h2>
        <Subscribe />
      </section>
      <section className="xa-panel">
        <h2 className="xa-h2 is-name">About Pulsus <span className="xa-red">Platform</span></h2>
        <p>Explore is the free view of Pulsus <span className="xa-red">Platform</span>. The Platform reads your own organisation from its own systems, the same way. <a href={`${ABOUT}/#about`}>More about Pulsus <span className="xa-red">Platform</span> →</a></p>
        <div className="xa-sub-sec">
          <h3>About Explore</h3>
          <p>Explore shows how healthy whole sectors are, country by country and state by state: banks, credit unions, insurers, hospitals and government agencies today, with universities next. Anyone can use it, with no account.</p>
          <p><b>Organisational Health</b> is a score out of 100 for financial condition. Each institution is scored from the figures its regulator publishes (for banks, credit unions and insurers: capital, profitability, loan quality and costs; for government agencies, published budget and reporting measures), each measured against the same fixed levels over up to three years. A place&apos;s score is the median of its institutions. It describes financial condition, not how an organisation operates day to day; that takes an organisation&apos;s own operational data, which Pulsus <span className="xa-red">Platform</span> reads.</p>
          <p><b>Operational Health</b> is a separate Pulsus score, out of 100, for named banks, credit unions and insurers. It is calculated by a published formula from complaints data their regulators publish by firm (the US Consumer Financial Protection Bureau and the UK Financial Conduct Authority): how many complaints are received relative to size, and how quickly they are handled. The share of complaints a UK firm upheld is shown beside its score, for information only, not scored. {SAME_COUNTRY} Complaints received are not findings of wrongdoing. The two scores are never blended. <a href="/methodology">How Operational Health is calculated →</a></p>
          <p className="xa-legend"><span className="xa-scale"><i />Organisational Health, 0 to 100</span><span><b className="xa-sw-limited" />Limited sample ({SHOW_MIN}–{RANK_MIN - 1}), not ranked</span><span><b style={{ background: COLOR.few }} />Too few for an average (under {SHOW_MIN})</span><span><b style={{ background: COLOR.next }} />Coming next</span></p>
          <p className="xa-muted">Every place is scored the same way, out of 100. Explore does not sort scores into bands or categories: the colour moves smoothly from red at 0, through amber, to green at 100.</p>
          <p><a href="/technology">How Pulsus Explore works →</a></p>
        </div>
        <div className="xa-sub-sec">
          <h3>How the Numbers Are Made</h3>
          <ul className="xa-principles">
            <li><b>Calculated from published figures by fixed rules.</b> The same rules for every institution and every place.</li>
            <li><b>Consistent and reproducible.</b> Identical inputs and calculation settings produce identical results.</li>
            <li><b>Traceable.</b> Every score can be traced to its underlying indicators.</li>
          </ul>
          <p className="xa-muted">Scores are calculated by Pulsus from published regulatory and complaints data. They are not official regulatory ratings. No institution is named in the financial figures; Operational Health names institutions only from complaints data their regulators publish by name under an open licence.</p>
        </div>
        <div className="xa-sub-sec">
          <h3>Data streams (sources)</h3>
          <p className="xa-label">Organisational Health</p>
          <ul className="xa-src">{realDefs.map((d) => <li key={d.id}><b>{d.title}</b><small>{d.publisher} · {when(layers[d.id], layers[d.id].asOf)}</small></li>)}</ul>
          <p className="xa-label">Operational Health</p>
          <ul className="xa-src">{OPS_SOURCES.filter((s) => s.used).map((s) => <li key={s.id}><b>{s.dataset}</b><small>{s.publisher} · {s.period}</small><small>Licence: <a href={s.licenceUrl}>{s.licence}</a></small><small>{s.attribution}</small></li>)}</ul>
          <p className="xa-muted small">Checked and not used, because they are not free to reuse: {OPS_SOURCES.filter((s) => !s.used).map((s) => s.publisher).join("; ")}. <a href="/methodology#sources">Why, and the full method →</a></p>
        </div>
      </section>
      <section className="xa-panel">
        <h2 className="xa-h2">Terms of Use &amp; Privacy Policy</h2>
        <p><a href={`${PLATFORM}/legal/terms`}>Terms of Use</a> · <a href="/privacy">Privacy Policy</a></p>
      </section>
      <footer className="xa-foot">
        <p>Pulsus <span className="xa-red">Platform</span> · Explore</p>
        <p><a href="/technology">How Pulsus Explore works</a></p>
        <p>© 2026 Tumblehill Holdings LLC</p>
        <p className="xa-patent">Patent pending · TAO: U.S. 19/362,373 · EMM: U.S. 19/362,400 · PCT/US26/22409</p>
      </footer>
    </div>
  );

  return (
    <div className={`xa${theme === "light" ? " is-light" : ""}${wide ? " is-wide" : ""}${sel || inst ? " has-card" : ""} on-${view}`} style={{ "--maptop": `${mapTop}px` } as React.CSSProperties}>
    <div className="xa-stage" ref={box}>
      {/* the map */}
      <svg className="xa-map" style={{ top: mapTop }} viewBox={vb} role="img" aria-label={`World map: ${WORD[measure]} of ${NOUN[sector]} by country. Use search to choose a place.`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        {/* A limited sample (10–19) is drawn lighter, under this hatch. */}
        <defs><pattern id="xa-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" /></pattern></defs>
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="transparent" onClick={() => { if (moved.current <= 8 && sel) close(); }} />
        {world.countries.map((c) => {
          const r = atCountry(c.id);
          const col = lens === "ops" ? opsFill(c.id) : gridId && c.id === "840" ? COLOR.none : r && r.g.hidden && regionTint[c.id] ? regionTint[c.id] : r ? fill(r.g) : NEXT[c.id] ? COLOR.next : COLOR.none;
          const on = sel && ((sel.region === c.id) || (cur && sel.region === null && cur.l.countries.includes(c.id)) || (cur?.g.members?.includes(c.id) ?? false));
          const lim = lens === "ops" ? limCls(opsAt(c.id, sector)) : gridId && c.id === "840" ? "" : limCls(r?.g);
          return (
            <React.Fragment key={c.id + c.name}>
              <path ref={(el) => { if (el) paths.current.set(c.id, el); }} d={c.d} style={{ fill: col }} className={`xa-c${on ? " on" : ""}${lim}`} onClick={() => tapCountry(c.id)}><title>{lens === "ops" && opsAt(c.id, sector) && !opsAt(c.id, sector)!.hidden ? `${c.name}: ${medianLabel(opsAt(c.id, sector)!.n)}${lim ? " (limited sample)" : ""}` : lim ? `${c.name}: limited sample` : c.name}</title></path>
              {lim && <path d={c.d} className="xa-hatch" />}
            </React.Fragment>
          );
        })}
        {gridId && wide && (() => {
          // Alaska and Hawaii on the world map take their state's colour too (the tiles cover only the lower 48's place).
          // On a phone the AK and HI tiles carry them: Alaska's land would sit under the header.
          const us = world.countries.find((c) => c.id === "840"); if (!us) return null;
          const gl = layers[gridId]; const parts = usOuterStates(us.d);
          return (["AK", "HI"] as const).map((code) => {
            if (!parts[code]) return null;
            const key = gridId === ALL ? `US-${code}` : code; const g = gl.regions[key];
            const v = valueAt(g, measure, at);
            const col = v !== undefined ? shade(v) : g?.hidden ? COLOR.few : COLOR.next;
            const on = sel?.layerId === gridId && sel?.region === key;
            return <path key={code} d={parts[code]} style={{ fill: limCls(g) ? `color-mix(in srgb, ${col} 55%, var(--fade))` : col }} className={`xa-c${on ? " on" : ""}${limCls(g)}`}
              onClick={() => { if (moved.current > 8 || !g) return; setSel({ layerId: gridId, region: key }); setSheet(""); }}><title>{`${STATE_NAME[code]}: ${v ?? (g?.hidden ? "too few for an average" : "not shown")}${limCls(g) ? " (limited sample)" : ""}`}</title></path>;
          });
        })()}
        {gridId && (() => {
          // The US as its states, laid out where the US sits on the map: each tile's colour and number follow the slider.
          const gl = layers[gridId]; const C = 14, X0 = 160, Y0 = 88;   // keep in step with the phone framing of `home`
          const showNum = C / u >= 18;   // numbers once a tile is big enough on screen; colours always
          return (
            <g className="xa-usgrid" aria-label={`United States by state: ${WORD[measure]}`}>
              {TILES.map(([code, tx, ty]) => {
                const key = gridId === ALL ? `US-${code}` : code; const g = gl.regions[key];
                const v = valueAt(g, measure, at);
                const col = v !== undefined ? shade(v) : g?.hidden ? COLOR.few : COLOR.next;
                const on = sel?.layerId === gridId && sel?.region === key;
                return (
                  <g key={code} transform={`translate(${X0 + tx * C} ${Y0 + ty * C})`} className={`xa-ut${on ? " on" : ""}${limCls(g)}`}
                    onClick={() => { if (moved.current > 8 || !g) return; setSel({ layerId: gridId, region: key }); setSheet(""); }}>
                    <title>{`${STATE_NAME[code]}: ${v ?? (g?.hidden ? "too few for an average" : "not shown")}${limCls(g) ? " (limited sample)" : ""}`}</title>
                    <rect width={C - 1.4} height={C - 1.4} rx={2} style={{ fill: col }} />
                    {limCls(g) && <rect className="xa-hatch" width={C - 1.4} height={C - 1.4} rx={2} />}
                    {showNum ? <>
                      <text x={(C - 1.4) / 2} y={C * 0.38} textAnchor="middle" className="xa-ut-c">{code}</text>
                      <text x={(C - 1.4) / 2} y={C * 0.78} textAnchor="middle" className="xa-ut-v">{v ?? "·"}</text>
                    </> : <text x={(C - 1.4) / 2} y={C * 0.62} textAnchor="middle" className="xa-ut-c">{code}</text>}
                  </g>
                );
              })}
            </g>
          );
        })()}
        {labels.map(({ iso, v, lim }) => {
          const [x, y, w] = centres[iso];
          if (w / u < 26 && sel?.region !== iso) return null;   // too small on screen at this zoom: tap or zoom in
          return (
            <g key={iso} className={`xa-val${lim ? " is-limited" : ""}`} transform={`translate(${x} ${y}) scale(${u})`}>
              <rect x={-16} y={8} width={32} height={19} rx={9.5} style={{ stroke: shade(v), strokeWidth: 2 }} /><text x={0} y={22} textAnchor="middle">{v}</text>
            </g>
          );
        })}
        {regionBadges.map((b) => (
          <g key={b.layerId} className="xa-val xa-region" transform={`translate(${b.x} ${b.y}) scale(${u})`} role="button" aria-label={`${b.name}: ${b.v}`}
            onClick={() => { if (moved.current > 8) return; setStates(null); setSel({ layerId: b.layerId, region: null }); setSheet(""); }}>
            <title>{`${b.name}, as one region: ${b.v}`}</title>
            <rect x={-34} y={-12} width={68} height={24} rx={12} style={{ stroke: shade(b.v), strokeWidth: 2 }} /><text x={0} y={4.5} textAnchor="middle">{b.name} {b.v}</text>
          </g>
        ))}
        {markers.map((m) => centres[m.iso] && (
          <g key={m.iso} className="xa-mark" transform={`translate(${centres[m.iso][0]} ${centres[m.iso][1]}) scale(${1 / cam.zoom})`}>
            <circle r="13" style={{ fill: m.color }} opacity="0.25" className="xa-pulse" /><circle r="5" className="xa-dot" style={{ fill: m.color }} strokeWidth="1.5" />
          </g>
        ))}
      </svg>

      {/* the states, when a country is read by state */}
      {statesLayer && (() => {
        const isAll = statesLayer.layer === ALL;
        const key = (st: string) => (isAll ? `US-${st}` : st);
        const whole = isAll ? statesLayer.regions["840"] : statesLayer.national;
        const wv = valueAt(whole, measure, at);
        const noun = isAll ? "organisations" : NOUN[defs.find((d) => d.id === statesLayer.layer)!.sector];
        return (
        <div className="xa-states">
          <nav className="xa-crumb" aria-label="Where you are"><button onClick={() => { setStates(null); setSel(null); flyTo(home); }}>‹ World</button><span>›</span>{cname("840")}<span>·</span>{isAll ? "all sectors" : noun}</nav>
          <div className="xa-states-h">
            <div><h2>{isAll ? "United States by state" : `US ${noun} by state`}</h2><p className="xa-sub">{WORD[measure]} · {at ? when(statesLayer, at) : `latest, ${when(statesLayer, statesLayer.asOf)}`} · tap a state for its detail</p></div>
            <button className="xa-states-all" onClick={() => setSel(isAll ? { layerId: ALL, region: "840" } : { layerId: statesLayer.layer, region: null })}><small>Whole US</small><strong>{wv ?? "—"}</strong></button>
          </div>
          <div className="xa-tiles" role="group" aria-label="States">
            {TILES.map(([s, x, y]) => {
              const g = statesLayer.regions[key(s)]; const v = valueAt(g, measure, at);
              const col = v !== undefined ? shade(v) : g?.hidden ? COLOR.few : COLOR.next;
              return (
                <button key={s} className={`xa-tile${sel?.region === key(s) ? " on" : ""}${limCls(g)}`} style={{ gridColumn: x + 1, gridRow: y + 1, background: `color-mix(in srgb, ${col} 55%, transparent)`, transition: "background .3s" }}
                  aria-label={`${STATE_NAME[s]}: ${v ?? "not shown"}`} onClick={() => setSel({ layerId: statesLayer.layer, region: key(s) })}>
                  <b>{s}</b><span>{v ?? "·"}</span>
                </button>
              );
            })}
          </div>
          <p className="xa-muted xa-small">{isAll ? "Banks, credit unions and hospitals, state by state; US federal agencies are read for the country as a whole." : `Fewer than ${SHOW_MIN} ${noun}: no average. ${SHOW_MIN} to ${RANK_MIN - 1}: a limited sample, shown lighter and not ranked.`} Press ▶ to watch the quarters change.</p>
        </div>
        ); })()}

      {/* the top: brand, search, sectors */}
      <header className="xa-top" ref={topRef}>
        {wide ? (
          // A wide screen: the updates prompt sits in the header row, beside "See How You Stack Up".
          <div className="xa-brand">{logo}<Invite />{you}</div>
        ) : brand}
        <div className="xa-tools">
        <button className="xa-search" onClick={() => setSheet("search")} aria-label="Search places, sectors and institutions"><Ico d={I_SEARCH} size={18} /> <span>{lens === "ops" ? "Search places and institutions" : "Search places and sectors"}</span></button>
        {chips}
        {lensSeg}
        </div>
      </header>

      {/* the side buttons */}
      <div className="xa-fabs">
        <button className={sheet === "movers" ? "on" : ""} onClick={() => setSheet(sheet === "movers" ? "" : "movers")} aria-label="Improving and declining indicators, and areas to watch"><Ico d={I_MOVERS} /></button>
        <button onClick={() => { setSheet(""); setView("settings"); }} aria-label="About these figures"><Ico d={I_INFO} /></button>
        <button onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to day" : "Switch to night"} title={theme === "dark" ? "Day" : "Night"}><Ico d={theme === "dark" ? I_SUN : I_MOON} /></button>
      </div>

      {lens === "ohi" && at && !sel && !(sheet && !wide) && (
        <p className="xa-period" aria-live="polite"><b>{when(inSector[0]?.l || {}, at)}</b><span>{WORD[measure]} then · the numbers and colours show that quarter</span></p>
      )}
      {!at && !sel && !inst && !sheet && !pins.length && (lens === "ohi"
        ? <p className="xa-key" ref={setKeyEl} aria-hidden="true"><span className="xa-scale"><i /><span className="xa-k-long">Organisational Health, 0 to 100</span><span className="xa-k-short">Org. Health 0–100</span></span><span><b className="xa-sw-limited" /><span className="xa-k-long">Limited sample</span><span className="xa-k-short">Limited</span></span><span><b style={{ background: COLOR.few }} />Too few</span><span><b style={{ background: COLOR.next }} />Next</span></p>
        : <p className="xa-key" ref={setKeyEl} aria-hidden="true"><span className="xa-scale"><i /><span className="xa-k-long">Operational Health, 0 to 100 · each country&apos;s median of the institutions with a score</span><span className="xa-k-short">Op. Health 0–100</span></span><span><b className="xa-sw-limited" /><span className="xa-k-long">Limited sample</span><span className="xa-k-short">Limited</span></span><span><b style={{ background: COLOR.few }} /><span className="xa-k-long">Fewer than {SHOW_MIN} scored</span><span className="xa-k-short">Under {SHOW_MIN}</span></span></p>
      )}

      {/* the time slider */}
      {lens === "ohi" && periods.length > 1 && !(sel && !wide) && !(sheet && !wide) && (
        <div className="xa-time">
          <button className="xa-play" onClick={() => { if (!playing && at === null) setPi(0); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play the years"}>{playing ? "❚❚" : "▶"}</button>
          <input type="range" min={0} max={periods.length - 1} value={pi === null ? periods.length - 1 : pi} onChange={(e) => { setPlaying(false); const i = Number(e.target.value); setPi(i >= periods.length - 1 ? null : i); }} aria-label="Period" />
          <span className="xa-when">{at ? when(inSector[0]?.l || {}, at) : "Latest"}</span>
        </div>
      )}

      {/* the card: a bottom sheet on a phone, a side panel on a wide screen */}
      {card && <aside className="xa-card" aria-live="polite" key={inst || (sel ? `${sel.layerId}|${sel.region}` : "")}>{card}</aside>}

      {/* compare */}
      {pins.length > 0 && !sheet && !(sel && !wide) && (
        <section key={trayFlash} className={`xa-tray${trayFlash ? " flash" : ""}`} aria-labelledby="xa-tray-h">
          <div className="xa-card-h"><h2 id="xa-tray-h" ref={trayHead} tabIndex={-1}>Comparing {pins.length} of {MAX_PINS}</h2><button className="xa-x" onClick={() => setPins([])} aria-label="Clear all from comparison" title="Clear all">×</button></div>
          <div className="xa-cmp">
            {pins.map((k) => { const s = unpinned(k); const r = groupOf(s); if (!r) return null; const v = valueAt(r.g, measure, at);
              return (
                <div key={k} className="xa-cmpc">
                  <button className="xa-x small" onClick={() => togglePin(s)} aria-label={`Remove ${r.title}`}>×</button>
                  <b>{s.region === null && r.l.regionKind === "state" ? `${cname(r.l.countries[0])}: ${NOUN[r.def.sector]}` : r.title}</b>
                  <strong>{v ?? "—"}</strong>
                  <small>{n0(r.g.n)} {NOUN[r.def.sector]} · {band(r.g.n)}</small>
                  <Spark values={(r.g.trend || []).map((t) => t[measure])} color={lineShade((r.g.trend || []).map((t) => t[measure]))} h={30} />
                </div>
              ); })}
            {pins.length === 1 && (
              <div className="xa-cmpc xa-cmp-hint">
                <b>Add another place to compare</b>
                <small>{wide ? "Choose a place on the map" : "Tap a place on the map"}, then + Compare (up to {MAX_PINS}).</small>
              </div>
            )}
          </div>
        </section>
      )}


      {/* the other tabs: pages over the map, which stays ready underneath */}
      {view !== "map" && (
        <main className="xa-page">
          <header className="xa-page-top">
            {brand}
            {view === "settings" && <h1 className="xa-h1">Settings</h1>}
          </header>
          {view === "overview" && overview}
          {view === "directory" && directory}
          {view === "settings" && about}
        </main>
      )}

      {/* sheets */}
      {sheet === "search" && (
        <div className="xa-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSheet(""); }}>
          <div className="xa-searchbox">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="A country, a state or a sector" aria-label="Search places and sectors" />
            <button className="xa-x" onClick={() => { setSheet(""); setQ(""); }} aria-label="Close">×</button>
          </div>
          <div className="xa-results">
            {hits.map((h) => <button key={`${h.layerId}|${h.region}`} onClick={() => choose(h.layerId, h.region)}><b>{h.label}</b><small>{n0(h.g.n)} · {SHORT.ohi} {h.g.ohi ?? "—"} · {band(h.g.n)}</small></button>)}
            {placeHit && <button onClick={() => openOps(placeHit)}><b>{COUNTRY[placeHit]}: Operational Health</b><small>{n0(insts.filter((i) => i.country === placeHit).length)} named institutions</small></button>}
            {instHits.length > 0 && <p className="xa-label">Named institutions · Operational Health</p>}
            {instHits.map((i) => { const s = scoreOf(i).score; return <button key={i.key} onClick={() => openOps(i.country, i.key)}><b>{i.name}</b><small>{COUNTRY[i.country]} · {SHORT.oh} {s ?? "—"}</small></button>; })}
            {q.trim().length >= 2 && !hits.length && !instHits.length && !placeHit && <div className="xa-muted">{whyEmpty(q, "all", setQ, <p>Nothing matches. Try a country, a US state, a bank or insurer&apos;s name, or banks, credit unions, insurers or agencies.</p>)}</div>}
            {q.trim().length < 2 && <p className="xa-muted">For example: “credit unions Texas”, “banks Germany”, “agencies”.</p>}
          </div>
        </div>
      )}

      {(sheet === "movers" || sheet === "about" || sheet === "you") && (
        <aside className="xa-sheet" role="dialog" aria-label={sheet}>
          <div className="xa-card-h"><h2>{sheet === "movers" ? "Movers and areas to watch" : sheet === "about" ? "About these figures" : "See How You Stack Up"}</h2><button className="xa-x" onClick={() => setSheet("")} aria-label="Close">×</button></div>
          {sheet === "movers" && (
            <>
              <div className="xa-tabs" role="tablist">
                {([["up", "Improving Indicators"], ["down", "Declining Indicators"], ["hot", "Areas to Watch"]] as const).map(([k, w]) => <button key={k} role="tab" aria-selected={moverTab === k} className={moverTab === k ? "on" : ""} onClick={() => setMoverTab(k)}>{w}</button>)}
              </div>
              <p className="xa-sub">Organisational Health, over the last year · tap to go there</p>
              <div className="xa-list">
                {movers.map((m) => { const l = layers[m.layer]; const def = defs.find((d) => d.id === m.layer); if (!l || !def) return null;
                  const name = `${place(l, m.region)}`; const mv = "change" in m;
                  return (
                    <button key={`${m.layer}|${m.region}`} onClick={() => choose(m.layer, m.region)}>
                      <span><b>{name}</b><small>{NOUN[def.sector]}{mv ? ` · ${(m as Mover).from} → ${(m as Mover).to}` : ` · median of ${n0((m as Hotspot).n)} · ${band((m as Hotspot).n)}`}</small></span>
                      <em style={{ color: mv ? ((m as Mover).change > 0 ? COLOR.good : COLOR.bad) : undefined }}>{mv ? <Delta n={(m as Mover).change} /> : (m as Hotspot).score}</em>
                    </button>
                  ); })}
              </div>
            </>
          )}
          {sheet === "about" && (
            <div className="xa-about">
              <ul className="xa-principles">
                <li><b>Calculated from published figures by fixed rules.</b> The same rules for every institution and every place.</li>
                <li><b>Consistent and reproducible.</b> Identical inputs and calculation settings produce identical results.</li>
                <li><b>Traceable.</b> Every score can be traced to its underlying indicators.</li>
              </ul>
              <p>Scores are calculated by Pulsus from published regulatory data. They are not official regulatory ratings. No institution is named in the financial figures.</p>
              <p className="xa-label">Data streams (sources)</p>
              <ul>{realDefs.map((d) => <li key={d.id}><b>{d.title}</b> · {d.publisher} · {when(layers[d.id], layers[d.id].asOf)}</li>)}
                {OPS_SOURCES.filter((s) => s.used).map((s) => <li key={s.id}><b>Operational Health</b> · {s.publisher}, {s.dataset} · {s.licence}</li>)}</ul>
              <p><a href="/methodology">How Operational Health is calculated</a></p>
              <p><a href="/privacy">Privacy</a> · © 2026 Tumblehill Holdings LLC</p>
            </div>
          )}
          {sheet === "you" && (
            <div className="xa-you-in">
              <h3>Connect your organisation to see yours.</h3>
              <p className="xa-muted">Explore is a free window on the world, read from public data. Pulsus <span className="xa-red">Platform</span> reads an organisation from its own systems the same way: Pulse shows its health and what needs attention today; Executive Intelligence adds the deeper tools: the diagnosis, treatments, recovery and where it stands among these peers; Oversight Intelligence watches over many organisations at once.</p>
              <div className="xa-btns"><a className="xa-btn" href={`${ABOUT}/demo/?from=explore`}>Take a peek</a><a className="xa-btn ghost" href={`${PLATFORM}/signup?product=platform`}>Start a 14-day trial</a><a className="xa-btn ghost" href={`${ABOUT}/walkthrough/`}>Talk to us</a></div>
              <p className="xa-note">Take a peek: Pulsus <span className="xa-red">Platform</span> with a fictional organisation, no sign-up needed.</p>
              <h3>Subscribe for updates</h3>
              <Subscribe />
            </div>
          )}
        </aside>
      )}
    </div>
    <nav className="xa-tabs-bar" aria-label="Views">
      {([["overview", "Pulse", I_HOME], ["directory", "Directory", I_LIST], ["map", "Map", I_MAP], ["settings", "Settings", I_GEAR]] as [View, string, string][]).map(([k, w, d]) => (
        <button key={k} className={view === k ? "on" : ""} aria-current={view === k ? "page" : undefined} onClick={() => { setSheet(""); setView(k); }}><Ico d={d} size={22} /><span>{w}</span></button>
      ))}
    </nav>
    </div>
  );
}

/** Subscribe for updates: just an email address, kept by Pulsus Platform. */
function Subscribe({ autoFocus = false, compact = false, onDone }: { autoFocus?: boolean; compact?: boolean; onDone?: () => void } = {}) {
  const started = useRef(Date.now());
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");   // never seen by people: bots fill it
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState("sending"); setMsg("");
    try {
      const r = await fetch(`${PLATFORM}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "subscribe", email, consent: true, website, elapsedMs: Date.now() - started.current }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setState("done"); try { localStorage.setItem(INVITE_KEY, "subscribed"); } catch { /* this visit only */ } onDone?.(); return; }
      setState("error"); setMsg(r.status === 429 ? "Too many tries just now. Please try again later." : "That email address doesn't look right.");
    } catch { setState("error"); setMsg("You seem to be offline. Try again when you have a connection."); }
  };
  if (state === "done") return <p className="xa-done" role="status">Thank you, you&apos;re subscribed.</p>;
  return (
    <form className={`xa-sub-form${compact ? " compact" : ""}`} onSubmit={submit}>
      <input required autoFocus={autoFocus} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="Your email address" aria-label="Email" />
      <input className="xa-hp" aria-hidden="true" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button className="xa-btn" disabled={state === "sending"}>{state === "sending" ? "Subscribing" : "Subscribe"}</button>
      <p className="xa-muted small">{msg ? <span role="alert">{msg}</span> : <>New sectors and quarterly figures. No spam; unsubscribe any time. See <a href="/privacy">Privacy</a>.</>}</p>
    </form>
  );
}

/** "Get Pulsus Platform updates": a one-line invitation, as in GeoATM. It opens
 *  into an email field when tapped and goes away for good once dismissed or
 *  subscribed (remembered on this device only). */
const INVITE_KEY = "pulsus-explore.updates";
function Invite() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setShow(!localStorage.getItem(INVITE_KEY)); } catch { setShow(true); } }, []);
  const remember = (v: "dismissed" | "subscribed") => { try { localStorage.setItem(INVITE_KEY, v); } catch { /* this visit only */ } };
  const dismiss = () => { remember("dismissed"); setShow(false); };
  if (!show) return null;
  const X = <button type="button" className="xa-inv-x" onClick={dismiss} aria-label="Dismiss"><Ico d="M6 6l12 12M18 6L6 18" size={16} /></button>;
  return (
    <div className="xa-invite" role="region" aria-label="Get Pulsus Platform updates">
      {!open ? (
        <div className="xa-inv-row">
          <span className="xa-inv-ic"><Ico d={I_MAIL} size={17} /></span>
          <span className="xa-inv-t">Get Pulsus <span className="xa-red">Platform</span> updates</span>
          <button type="button" className="xa-inv-go" onClick={() => setOpen(true)}>Subscribe</button>
          {X}
        </div>
      ) : (
        <div className="xa-inv-open">
          <div className="xa-inv-row"><span className="xa-inv-t">Get Pulsus <span className="xa-red">Platform</span> updates</span>{X}</div>
          <Subscribe autoFocus compact onDone={() => { remember("subscribed"); setTimeout(() => setShow(false), 2500); }} />
        </div>
      )}
    </div>
  );
}
