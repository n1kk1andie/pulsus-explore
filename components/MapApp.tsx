"use client";

// Explore, the free view of Pulsus Platform, as an app: the world map fills the screen and everything
// floats over it. Tap a country to fly there and open its card; drill into
// states; play the years; see the movers; pin up to four groups to compare;
// search; filter. No sign-in. The figures are the finished, anonymous
// aggregates in lib/atlas/data (no institution is named, none of the method).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExploreData, Mover, Hotspot } from "../lib/atlas/explore";
import type { AtlasGroup, AtlasLayer } from "../lib/atlas/layers";
import { countryGroup } from "../lib/atlas/layers";
import { INSIGHT_MIN } from "../lib/atlas/explore";
import { ELSEWHERE, EVIDENCE, LAYERS, NEXT, SECTORS, evidenceOf, type LayerDef, type SectorId } from "../lib/atlas/catalog";

export interface World { w: number; h: number; countries: { id: string; name: string; d: string }[] }
type Measure = "ohi" | "oh";
type Band = "" | "good" | "watch" | "bad";
type Sel = { layerId: string; region: string | null } | null;   // region null: the layer as a whole

const ABOUT = "https://about.pulsus.tech";
const PLATFORM = (process.env.NEXT_PUBLIC_PLATFORM_URL || "https://executive.pulsus.tech").replace(/\/+$/, "");
const WORD: Record<Measure, string> = { ohi: "Organisational Health", oh: "Operational Health" };
const SHORT: Record<Measure, string> = { ohi: "Org. Health", oh: "Op. Health" };
type Sector = SectorId | "all";
const NOUN: Record<Sector, string> = { all: "organisations", banks: "banks", "credit-unions": "credit unions", insurance: "insurers", government: "agencies", hospitals: "hospitals", universities: "universities" };
// The colours follow day or night through CSS variables (app/map.css).
const COLOR = { good: "var(--good)", watch: "var(--watch)", bad: "var(--bad)", few: "var(--few)", next: "var(--next)", none: "var(--none)" } as const;
const BAND_WORD = { good: "Stable", watch: "Steady", bad: "Fragile" } as const;

const TILES: [string, number, number][] = [
  ["AK", 0, 0], ["ME", 11, 0], ["VT", 10, 1], ["NH", 11, 1],
  ["WA", 1, 2], ["ID", 2, 2], ["MT", 3, 2], ["ND", 4, 2], ["MN", 5, 2], ["IL", 6, 2], ["WI", 7, 2], ["MI", 8, 2], ["NY", 9, 2], ["RI", 10, 2], ["MA", 11, 2],
  ["OR", 1, 3], ["NV", 2, 3], ["WY", 3, 3], ["SD", 4, 3], ["IA", 5, 3], ["IN", 6, 3], ["OH", 7, 3], ["PA", 8, 3], ["NJ", 9, 3], ["CT", 10, 3],
  ["CA", 1, 4], ["UT", 2, 4], ["CO", 3, 4], ["NE", 4, 4], ["MO", 5, 4], ["KY", 6, 4], ["WV", 7, 4], ["VA", 8, 4], ["MD", 9, 4], ["DE", 10, 4],
  ["AZ", 2, 5], ["NM", 3, 5], ["KS", 4, 5], ["AR", 5, 5], ["TN", 6, 5], ["NC", 7, 5], ["SC", 8, 5], ["DC", 9, 5],
  ["OK", 4, 6], ["LA", 5, 6], ["MS", 6, 6], ["AL", 7, 6], ["GA", 8, 6],
  ["HI", 0, 7], ["TX", 4, 7], ["FL", 9, 7], ["PR", 11, 7],
];
const STATE_NAME: Record<string, string> = {
  AK: "Alaska", AL: "Alabama", AR: "Arkansas", AZ: "Arizona", CA: "California", CO: "Colorado", CT: "Connecticut", DC: "District of Columbia", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", IA: "Iowa", ID: "Idaho", IL: "Illinois", IN: "Indiana", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", ME: "Maine", MI: "Michigan", MN: "Minnesota", MO: "Missouri", MS: "Mississippi", MT: "Montana", NC: "North Carolina", ND: "North Dakota", NE: "Nebraska", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NV: "Nevada", NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin", WV: "West Virginia", WY: "Wyoming", VI: "US Virgin Islands", GU: "Guam", AS: "American Samoa", MP: "Northern Mariana Islands", FM: "Micronesia", MH: "Marshall Islands", PW: "Palau",
};
const quarter = (p: string) => `Q${Math.ceil(Number(p.slice(5, 7)) / 3)} ${p.slice(0, 4)}`;
const when = (l: { cadence?: string }, p: string) => (l.cadence === "yearly" ? `FY${p.slice(0, 4)}` : quarter(p));
const n0 = (x: number) => x.toLocaleString("en-US");

/** A group's reading at a period: its latest point at or before it, or now. */
function valueAt(g: AtlasGroup | undefined, k: Measure, at: string | null): number | undefined {
  if (!g || g.hidden) return undefined;
  if (!at) return g[k];
  const t = (g.trend || []).filter((p) => p.period <= at && p[k] !== null);
  return t.length ? (t[t.length - 1][k] as number) : undefined;
}
function bandOf(v: number | undefined, k: Measure, b: AtlasLayer["bands"]): Exclude<Band, ""> | null {
  if (v === undefined) return null;
  return k === "ohi" ? (v >= b.ssiStable ? "good" : v >= b.ssiSteady ? "watch" : "bad") : (v >= b.ohiHealthy ? "good" : v >= b.ohiWatch ? "watch" : "bad");
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

function Split({ g }: { g: AtlasGroup }) {
  if (!g.split || !g.n) return null;
  const p = (x: number) => Math.round((100 * x) / g.n);
  return (
    <>
      <div className="xa-bar" aria-hidden="true"><i style={{ width: `${p(g.split.stable)}%`, background: COLOR.good }} /><i style={{ width: `${p(g.split.steady)}%`, background: COLOR.watch }} /><i style={{ width: `${p(g.split.fragile)}%`, background: COLOR.bad }} /></div>
      <p className="xa-legend"><span><b style={{ background: COLOR.good }} />Stable {p(g.split.stable)}%</span><span><b style={{ background: COLOR.watch }} />Steady {p(g.split.steady)}%</span><span><b style={{ background: COLOR.bad }} />Fragile {p(g.split.fragile)}%</span></p>
    </>
  );
}


const Ico = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I_FILTER = "M4 6h16M7 12h10M10 18h4";
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

/** All sectors together: for each country, its sectors' groups combined.
 *  Counts and the Stable/Steady/Fragile split add up exactly; the readings
 *  are each sector's median weighted by its size (labelled as such). */
const ALL = "all-sectors";
const ALL_DEF: LayerDef = { id: ALL, sector: "all" as SectorId, title: "All sectors", publisher: "Every source in Explore", asOf: "", evidence: "financial" };
function combine(gs: AtlasGroup[], periods: string[]): AtlasGroup {
  const vis = gs.filter((g) => !g.hidden);
  const n = gs.reduce((t, g) => t + g.n, 0);
  if (!vis.length) return { n, hidden: true };
  const avg = (k: Measure, at: string | null) => {
    let w = 0, t = 0;
    for (const g of vis) { const v = valueAt(g, k, at); if (v !== undefined) { w += g.n; t += v * g.n; } }
    return w ? Math.round(t / w) : undefined;
  };
  const split = vis.every((g) => g.split) ? vis.reduce((t, g) => ({ stable: t.stable + g.split!.stable, steady: t.steady + g.split!.steady, fragile: t.fragile + g.split!.fragile }), { stable: 0, steady: 0, fragile: 0 }) : undefined;
  return {
    n: vis.reduce((t, g) => t + g.n, 0), ohi: avg("ohi", null), oh: avg("oh", null), split,
    trend: periods.map((p) => ({ period: p, ohi: avg("ohi", p) ?? null, oh: avg("oh", p) ?? null })),
  };
}
function allSectors(ls: AtlasLayer[]): AtlasLayer {
  // The timeline follows the quarterly sources; yearly ones carry their latest year.
  const periods = [...new Set(ls.filter((l) => l.cadence !== "yearly").flatMap((l) => (l.national.trend || []).map((t) => t.period)))].sort();
  const countries = [...new Set(ls.flatMap((l) => l.countries))];
  const regions: Record<string, AtlasGroup> = {};
  for (const iso of countries) regions[iso] = combine(ls.map((l) => countryGroup(l, iso)).filter((g): g is AtlasGroup => !!g), periods);
  // The US state by state: the sectors read by state, together (keys "US-TX").
  const byState = ls.filter((l) => l.regionKind === "state" && l.countries.includes("840"));
  for (const code of new Set(byState.flatMap((l) => Object.keys(l.regions)))) regions[`US-${code}`] = combine(byState.map((l) => l.regions[code]).filter((g): g is AtlasGroup => !!g), periods);
  const latest = ls.map((l) => l.asOf).sort().pop() || "";
  return { ...ls[0], layer: ALL, sector: "all", scope: "all", regionKind: "country", countries, source: "", asOf: latest, cadence: "quarterly", national: combine(ls.map((l) => l.national), periods), regions, peers: {} };
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

export default function MapApp({ data, world }: { data: ExploreData; world: World }) {
  const real = useMemo(() => Object.fromEntries(data.layers.map((l) => [l.layer, l])) as Record<string, AtlasLayer>, [data]);
  const realDefs = useMemo(() => LAYERS.filter((d) => real[d.id]), [real]);
  // "All sectors": every country's sectors read together (lib below), as one more layer.
  const layers = useMemo((): Record<string, AtlasLayer> => ({ ...real, [ALL]: allSectors(realDefs.map((d) => real[d.id])) }), [real, realDefs]);
  const defs = useMemo(() => [...realDefs, ALL_DEF], [realDefs]);
  const [theme, toggleTheme] = useTheme();
  // The tab: Overview, Directory, Map or About, kept in the address (#map) so a refresh or a shared link opens it.
  const [view, setView] = useState<View>("overview");
  useEffect(() => { const raw = window.location.hash.slice(1); const h = (raw === "about" ? "settings" : raw) as View; if (VIEWS.includes(h)) setView(h); }, []);
  useEffect(() => { try { window.history.replaceState(null, "", view === "overview" ? window.location.pathname + window.location.search : `#${view}`); } catch { /* ignore */ } }, [view]);
  const [dirQ, setDirQ] = useState("");
  const [dirSort, setDirSort] = useState<"high" | "low" | "change" | "az">("high");
  const [dirKind, setDirKind] = useState<"" | "country" | "state">("");
  const [sector, setSector] = useState<Sector>("all");
  const [measure, setMeasure] = useState<Measure>("ohi");
  const [band, setBand] = useState<Band>("");
  const [sel, setSel] = useState<Sel>(null);
  /** The US grid of states for a sector, when it is read by state: the map opens on it. */
  const usGridFor = (sec: Sector): string | null => {
    if (sec === "all") return Object.keys(layers[ALL]?.regions || {}).some((k) => k.startsWith("US-")) ? ALL : null;
    return realDefs.find((d) => d.sector === sec && real[d.id]?.regionKind === "state" && real[d.id].countries.includes("840"))?.id ?? null;
  };
  const [states, setStates] = useState<string | null>(() => usGridFor("all"));   // a state layer open as its states (the US grid by default)
  const [pins, setPins] = useState<string[]>([]);
  const [sheet, setSheet] = useState<"" | "movers" | "filters" | "about" | "you" | "search">("");
  const [moverTab, setMoverTab] = useState<"up" | "down" | "hot">("down");
  const [q, setQ] = useState("");
  const inSector = useMemo(() => defs.filter((d) => d.sector === sector).map((def) => ({ def, l: layers[def.id] })), [defs, layers, sector]);
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
  // A US state names its country ("Alaska, US"), so states and countries can't be mistaken in one list.
  const stateName = (code: string) => { const n = STATE_NAME[code] || code; return n.startsWith("US ") ? n : `${n}, US`; };
  const place = useCallback((l: AtlasLayer, region: string) => (region.startsWith("US-") ? stateName(region.slice(3)) : l.regionKind === "state" ? stateName(region) : cname(region)), [cname]);
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
  // Units per pixel at zoom 1: the whole world's height on a phone, its width on a wide screen.
  const base = portrait ? world.h / size.h : Math.max(world.w / size.w, world.h / size.h);
  const home: Cam = useMemo(() => ({ cx: portrait ? 300 : 470, cy: portrait ? 230 : 250, zoom: portrait ? 1.15 : 1 }), [portrait]);
  const [cam, setCam] = useState<Cam>(home);
  useEffect(() => { setCam(home); }, [home]);
  const u = base / cam.zoom;
  const vb = `${cam.cx - (size.w * u) / 2} ${cam.cy - (size.h * u) / 2} ${size.w * u} ${size.h * u}`;
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
  const paths = useRef(new Map<string, SVGPathElement>());
  /** Fly so a country fills the part of the screen the card leaves free. */
  const flyToCountry = useCallback((iso: string) => {
    const p = paths.current.get(iso); if (!p) return;
    let b = p.getBBox();
    if (iso === "840") b = { x: 170, y: 117, width: 147, height: 76 } as DOMRect;   // the lower 48, not Alaska and the islands
    const freeW = wide ? size.w - 420 : size.w, freeH = wide ? size.h - 120 : size.h * 0.42;
    const zoom = Math.min(10, Math.max(1, Math.min(freeW / (b.width / base), freeH / (b.height / base)) * 0.6));
    const uu = base / zoom;
    const cx = b.x + b.width / 2 + (wide ? (420 / 2) * uu : 0);
    const cy = b.y + b.height / 2 + (wide ? 0 : (size.h * 0.27) * uu);
    flyTo({ cx, cy, zoom });
  }, [wide, size, base, flyTo]);

  // Drag to pan, pinch or wheel to zoom; a short press is a tap.
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const onDown = (e: React.PointerEvent) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = 0; if (anim.current) cancelAnimationFrame(anim.current); };
  const onMove = (e: React.PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
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
    const r = atCountry(iso);
    if (!r) { setSel({ layerId: "", region: iso }); flyToCountry(iso); setSheet(""); return; }
    // The US opens state by state, where every quarter visibly moves the tiles.
    const byState = r.l.regionKind === "state" ? r.l.layer : r.def.id === ALL && iso === "840" && Object.keys(r.l.regions).some((k) => k.startsWith("US-")) ? ALL : null;
    if (byState) { setStates(byState); setSel(null); setSheet(""); flyToCountry(iso); return; }
    setSel({ layerId: r.def.id, region: r.l.regionKind === "state" ? null : r.l.countries.length === 1 ? null : iso });
    setStates(null); setSheet(""); flyToCountry(iso);
  };
  const choose = (layerId: string, region: string | null) => {
    const def = defs.find((d) => d.id === layerId); const l = layers[layerId]; if (!def || !l) return;
    setSector(def.sector); setSheet(""); setQ("");
    if (l.regionKind === "state" && region) { setStates(layerId); setSel({ layerId, region }); return; }
    setStates(null); setSel({ layerId, region });
    const iso = region ?? l.countries[0];
    setTimeout(() => flyToCountry(iso), 30);
  };
  const close = () => { setSel(null); if (!states) flyTo(home); };
  const pinKey = (s: NonNullable<Sel>) => `${s.layerId}|${s.region ?? ""}`;
  const togglePin = (s: NonNullable<Sel>) => { const k = pinKey(s); setPins((p) => (p.includes(k) ? p.filter((x) => x !== k) : p.length >= 4 ? p : [...p, k])); };

  // ── search ───────────────────────────────────────────────────────────────
  const allGroups = useMemo(() => {
    const out: { layerId: string; region: string | null; label: string; g: AtlasGroup }[] = [];
    for (const def of realDefs) {
      const l = layers[def.id];
      out.push({ layerId: def.id, region: null, label: def.title, g: l.national });
      for (const [r, g] of Object.entries(l.regions)) if (!g.hidden && !(l.regionKind === "country" && l.countries.length === 1)) out.push({ layerId: def.id, region: r, label: `${place(l, r)}: ${NOUN[def.sector]}`, g });
    }
    return out;
  }, [realDefs, layers, place]);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase(); if (t.length < 2) return [];
    const words = t.split(/\s+/);
    return allGroups.filter((g) => words.every((w) => g.label.toLowerCase().includes(w) || (defs.find((d) => d.id === g.layerId)?.sector || "").includes(w))).slice(0, 8);
  }, [q, allGroups, defs]);

  // ── what is shown ────────────────────────────────────────────────────────
  const cur = sel && sel.layerId ? groupOf(sel) : null;
  const statesLayer = states ? layers[states] : null;
  const bandsOf = (l: AtlasLayer) => l.bands;
  const fill = (g: AtlasGroup | undefined, l: AtlasLayer) => {
    const v = valueAt(g, measure, at); const b = bandOf(v, measure, bandsOf(l));
    if (!b) return g && g.hidden ? COLOR.few : COLOR.none;
    return COLOR[b];
  };
  const dimmed = (g: AtlasGroup | undefined, l: AtlasLayer) => { if (!band) return false; const b = bandOf(valueAt(g, measure, at), measure, bandsOf(l)); return b !== band; };
  const insight = data.insights;
  const movers: (Mover | Hotspot)[] = moverTab === "up" ? insight.up : moverTab === "down" ? insight.down : insight.hotspots;
  // Markers: countries in this sector among the movers and hotspots.
  const markers = useMemo(() => {
    const m: { iso: string; color: string }[] = [];
    const add = (layer: string, region: string, kind: string, color: string) => {
      const l = layers[layer]; const def = defs.find((d) => d.id === layer); if (!l || !def || (sector !== "all" && def.sector !== sector)) return;
      const iso = kind === "state" ? l.countries[0] : region; if (!m.some((x) => x.iso === iso)) m.push({ iso, color });
    };
    for (const x of insight.up.slice(0, 3)) add(x.layer, x.region, x.regionKind, COLOR.good);
    for (const x of insight.down.slice(0, 3)) add(x.layer, x.region, x.regionKind, COLOR.bad);
    return m;
  }, [insight, layers, defs, sector]);
  // Every country's middle and width, measured once the map is drawn: where its number and marker sit.
  const [centres, setCentres] = useState<Record<string, [number, number, number]>>({});
  useEffect(() => {
    const c: Record<string, [number, number, number]> = {};
    for (const k of world.countries) c[k.id] = mainland(k.d);
    setCentres(c);
  }, [world]);
  // Each covered country's reading at the chosen period: shown on the map, so the slider visibly moves it.
  const labels = useMemo(() => {
    const out: { iso: string; v: number; b: Exclude<Band, ""> }[] = [];
    for (const c of world.countries) {
      const r = atCountry(c.id); if (!r || !centres[c.id]) continue;
      const v = valueAt(r.g, measure, at); const b = bandOf(v, measure, r.l.bands);
      if (v !== undefined && b) out.push({ iso: c.id, v, b });
    }
    return out;
  }, [world, atCountry, centres, measure, at]);
  const unpinned = (k: string) => { const [layerId, region] = k.split("|"); return { layerId, region: region || null }; };

  // ── the card ─────────────────────────────────────────────────────────────
  const card = (() => {
    if (!sel) return null;
    if (!sel.layerId) {
      const iso = sel.region!;
      return (
        <div className="xa-card-in">
          <div className="xa-card-h"><h2>{cname(iso)}</h2><button className="xa-x" onClick={close} aria-label="Close">×</button></div>
          <p className="xa-muted">{NEXT[iso] || ELSEWHERE}</p>
        </div>
      );
    }
    if (!cur) return null;
    const { def, l, g, title } = cur;
    const v = valueAt(g, measure, at); const b = bandOf(v, measure, l.bands);
    const pinned = pins.includes(pinKey(sel));
    return (
      <div className="xa-card-in">
        <div className="xa-card-h"><h2>{sel.region === null && l.regionKind === "state" ? `${cname(l.countries[0])}: ${NOUN[def.sector]}` : title}</h2><button className="xa-x" onClick={close} aria-label="Close">×</button></div>
        <p className="xa-sub">{def.title} · {when(l, at || l.asOf)}</p>
        {g.hidden ? <p className="xa-muted">Fewer than {l.minGroup} {NOUN[def.sector]} here, so not shown on their own. They are counted in the totals.</p> : (
          <>
            <div className="xa-stats">
              <div><small>{NOUN[def.sector]}</small><b>{n0(g.n)}</b></div>
              <div><small>{SHORT.ohi}</small><b style={{ color: COLOR[bandOf(valueAt(g, "ohi", at), "ohi", l.bands) || "good"] }}>{valueAt(g, "ohi", at) ?? "—"}</b></div>
              <div><small>{SHORT.oh}</small><b>{valueAt(g, "oh", at) ?? "—"}</b></div>
            </div>
            <Split g={g} />
            {(g.trend || []).length > 1 && (
              <>
                <Spark values={(g.trend || []).map((t) => t[measure])} color={b ? COLOR[b] : COLOR.good} />
                <p className="xa-axis"><span>{when(l, g.trend![0].period)}</span><span>{WORD[measure]}</span><span>{when(l, g.trend![g.trend!.length - 1].period)}</span></p>
              </>
            )}
          </>
        )}
        {def.id === ALL && sel.region && (
          <div className="xa-by">
            <p className="xa-label">By sector · tap to open</p>
            {realDefs.map((d) => { const rl = real[d.id]; const st = sel.region!.startsWith("US-") ? sel.region!.slice(3) : null;
              const rg = st ? (rl.regionKind === "state" && rl.countries.includes("840") ? rl.regions[st] : null) : countryGroup(rl, sel.region!); if (!rg) return null;
              const rv = valueAt(rg, measure, at); const rb = bandOf(rv, measure, rl.bands);
              return (
                <button key={d.id} onClick={() => choose(d.id, st ? st : rl.regionKind === "state" ? null : rl.countries.length === 1 ? null : sel.region)}>
                  <span><b>{SECTORS.find((x) => x.id === d.sector)?.label}</b><small>{n0(rg.n)} {NOUN[d.sector]} · {d.publisher}</small></span>
                  <em style={{ color: rb ? COLOR[rb] : undefined }}>{rg.hidden ? "few" : rv ?? "—"}</em>
                </button>
              ); })}
          </div>
        )}
        <div className="xa-btns">
          {def.id === ALL && sel.region === "840" && !states && Object.keys(l.regions).some((k) => k.startsWith("US-")) && <button className="xa-btn" onClick={() => { setStates(ALL); setSel(null); }}>See the states ›</button>}
          {l.regionKind === "state" && sel.region === null && !states && <button className="xa-btn" onClick={() => { setStates(l.layer); }}>See the states ›</button>}
          {!g.hidden && <button className={`xa-btn ghost${pinned ? " on" : ""}`} onClick={() => togglePin(sel)} disabled={!pinned && pins.length >= 4}>{pinned ? "✓ Comparing" : "+ Compare"}</button>}
        </div>
        <p className="xa-note">{def.id === ALL ? <>Each sector&apos;s median, weighted by how many organisations it has; the split counts every one. No institution is named.</> : <><span className={`xa-ev is-${def.evidence}`}>{evidenceOf(def.evidence).label}</span> {def.publisher}. No institution is named.</>}</p>
      </div>
    );
  })();

  const chips = (
    <div className="xa-chips" role="group" aria-label="Sector">
      {[{ id: "all" as Sector, label: "All sectors", status: "live", where: "Every sector, together" }, ...SECTORS].map((s) => (
        <button key={s.id} className={`xa-chip${sector === s.id ? " on" : ""}`} disabled={s.status !== "live"} aria-pressed={sector === s.id}
          onClick={() => { setSector(s.id); setSel(null); setStates(usGridFor(s.id)); flyTo(home); }} title={s.status === "live" ? s.where : "Coming next"}>
          {s.label}{s.status !== "live" && <small> · next</small>}
        </button>
      ))}
    </div>
  );

  const brand = (
    <div className="xa-brand">
      <a href="/" aria-label="Pulsus Platform · Explore"><img src={theme === "light" ? "/pulsus-platform-logo.png" : "/pulsus-platform-logo-light.png"} alt="Pulsus" /></a>
      <span className="xa-tag">Explore</span>
      <button className="xa-you" onClick={() => setSheet(sheet === "you" ? "" : "you")}>See How You Stack Up →</button>
    </div>
  );
  /** Open a place on the map, with its card. */
  const open = (layerId: string, region: string | null) => { setView("map"); choose(layerId, region); };
  const openSector = (id: Sector) => { setSector(id); setSel(null); setStates(usGridFor(id)); setView("map"); flyTo(home); };
  const tone = (v: number | undefined, l: AtlasLayer) => { const b = bandOf(v, measure, l.bands); return b ? COLOR[b] : undefined; };
  const bandWord = (v: number | undefined, l: AtlasLayer) => { const b = bandOf(v, measure, l.bands); return b ? BAND_WORD[b] : "Not shown"; };

  // ── Overview: the world at a glance ──────────────────────────────────────
  const allL = layers[ALL];
  const sectorCards = SECTORS.filter((x) => x.status === "live").map((x) => {
    const ls = realDefs.filter((d) => d.sector === x.id).map((d) => real[d.id]);
    return ls.length ? { x, l: ls.length === 1 ? ls[0] : allSectors(ls), n: ls.length } : null;
  }).filter(Boolean) as { x: (typeof SECTORS)[number]; l: AtlasLayer; n: number }[];
  const moverRow = (m: Mover | Hotspot) => {
    const l = layers[m.layer]; const def = defs.find((d) => d.id === m.layer); if (!l || !def) return null;
    const mv = "change" in m;
    return (
      <button key={`${m.layer}|${m.region}`} onClick={() => open(m.layer, m.region)}>
        <span><b>{place(l, m.region)}</b><small>{NOUN[def.sector]}{mv ? ` · ${(m as Mover).from} → ${(m as Mover).to}` : ` · ${(m as Hotspot).fragile} of ${(m as Hotspot).n} Fragile`}</small></span>
        <em style={{ color: mv ? ((m as Mover).change > 0 ? COLOR.good : COLOR.bad) : COLOR.bad }}>{mv ? <Delta n={(m as Mover).change} /> : `${(m as Hotspot).share}%`}</em>
      </button>
    );
  };
  const overview = (
    <div className="xa-ov">
      <section className="xa-panel xa-hero">
        <p className="xa-label">The world at a glance · {when(allL, allL.asOf)}</p>
        <div className="xa-hero-row">
          <div><strong style={{ color: tone(allL.national.ohi, allL) }}>{allL.national.ohi ?? "—"}</strong><small>Organisational Health · {bandWord(allL.national.ohi, allL)}</small></div>
          <div><strong>{allL.national.oh ?? "—"}</strong><small>Operational Health</small></div>
        </div>
        <p className="xa-muted">{n0(allL.national.n)} organisations in {allL.countries.length} countries, across {sectorCards.length} sectors, read from public data. No institution is named.</p>
        <Split g={allL.national} />
        <div className="xa-btns"><button className="xa-btn" onClick={() => openSector("all")}>Open the map ›</button><button className="xa-btn ghost" onClick={() => setView("directory")}>Browse the directory</button></div>
      </section>
      <Invite />
      <h2 className="xa-h2">Sectors</h2>
      <div className="xa-sectors">
        {sectorCards.map(({ x, l }) => (
          <button key={x.id} className="xa-panel xa-sec" onClick={() => openSector(x.id)}>
            <span className="xa-sec-h"><b>{x.label}</b><strong style={{ color: tone(l.national.ohi, l) }}>{l.national.ohi ?? "—"}</strong></span>
            <small>{n0(l.national.n)} {NOUN[x.id]} · {x.where}</small>
            <Spark values={(l.national.trend || []).map((t) => t[measure])} color={tone(l.national.ohi, l) || COLOR.good} h={34} />
          </button>
        ))}
        {SECTORS.filter((x) => x.status !== "live").map((x) => <div key={x.id} className="xa-panel xa-sec is-next"><span className="xa-sec-h"><b>{x.label}</b><small>Next</small></span><small>{x.where}</small></div>)}
      </div>
      <div className="xa-cols">
        <section className="xa-panel"><h2 className="xa-h2 is-up"><Delta n={1} bare /> Improving</h2><div className="xa-list">{insight.up.slice(0, 4).map(moverRow)}</div></section>
        <section className="xa-panel"><h2 className="xa-h2 is-down"><Delta n={-1} bare /> Deteriorating</h2><div className="xa-list">{insight.down.slice(0, 4).map(moverRow)}</div></section>
        <section className="xa-panel"><h2 className="xa-h2 is-hot">Hotspots</h2><p className="xa-sub">The largest share of Fragile organisations</p><div className="xa-list">{insight.hotspots.slice(0, 4).map(moverRow)}</div></section>
      </div>
      <p className="xa-note">Organisational Health over the last year, among places with at least {INSIGHT_MIN} organisations. These are Pulsus readings of public data, not official regulatory ratings or advice.</p>
    </div>
  );

  // ── Directory: every place and sector, searchable ────────────────────────
  const rows = useMemo(() => allGroups.map((r) => {
    const l = layers[r.layerId]; const def = defs.find((d) => d.id === r.layerId)!;
    return { ...r, l, def, v: valueAt(r.g, measure, null), ch: yearChange(r.g, measure) };
  }), [allGroups, layers, defs, measure]);
  const shown = useMemo(() => {
    const words = dirQ.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = rows.filter((r) => (sector === "all" || r.def.sector === sector)
      && (!dirKind || (dirKind === "state") === (r.region !== null && r.l.regionKind === "state"))
      && (!band || bandOf(r.v, measure, r.l.bands) === band)
      && words.every((w) => r.label.toLowerCase().includes(w) || r.def.sector.includes(w) || r.def.title.toLowerCase().includes(w)));
    const by = { high: (a: typeof out[0], b: typeof out[0]) => (b.v ?? -1) - (a.v ?? -1), low: (a: typeof out[0], b: typeof out[0]) => (a.v ?? 999) - (b.v ?? 999), change: (a: typeof out[0], b: typeof out[0]) => Math.abs(b.ch ?? 0) - Math.abs(a.ch ?? 0), az: (a: typeof out[0], b: typeof out[0]) => a.label.localeCompare(b.label) }[dirSort];
    return out.sort(by);
  }, [rows, dirQ, sector, band, measure, dirSort, dirKind]);
  const directory = (
    <div className="xa-dir">
      <div className="xa-dir-tools">
        <label className="xa-dir-q"><Ico d={I_SEARCH} size={18} /><input value={dirQ} onChange={(e) => setDirQ(e.target.value)} placeholder="Search a country, state or sector" aria-label="Search the directory" /></label>
        {chips}
        <div className="xa-seg xa-kind">{([["", "Everywhere"], ["country", "Countries"], ["state", "US states"]] as ["" | "country" | "state", string][]).map(([k, w]) => <button key={k || "all"} className={dirKind === k ? "on" : ""} onClick={() => setDirKind(k)}>{w}</button>)}</div>
        <div className="xa-dir-row">
          <div className="xa-seg">{([["", "Every band"], ["good", "Stable"], ["watch", "Steady"], ["bad", "Fragile"]] as [Band, string][]).map(([k, w]) => <button key={k || "all"} className={band === k ? "on" : ""} onClick={() => setBand(k)}>{w}</button>)}</div>
          <label className="xa-sort"><span>Sort</span><select value={dirSort} onChange={(e) => setDirSort(e.target.value as typeof dirSort)}><option value="high">Highest first</option><option value="low">Lowest first</option><option value="change">Biggest change</option><option value="az">A to Z</option></select></label>
        </div>
        <p className="xa-sub">{shown.length} {shown.length === 1 ? "place" : "places"} · {WORD[measure]} · places and sectors only; no institution is named</p>
      </div>
      <ul className="xa-dir-list">
        {shown.map((r) => (
          <li key={`${r.layerId}|${r.region}`}>
            <button onClick={() => open(r.layerId, r.region)}>
              <span className="xa-dir-dot" style={{ background: tone(r.v, r.l) || COLOR.few }} />
              <span className="xa-dir-name"><b>{r.region === null ? r.def.title : r.label}</b><small>{n0(r.g.n)} {NOUN[r.def.sector]} · {bandWord(r.v, r.l)} · {when(r.l, r.l.asOf)}</small></span>
              <span className="xa-dir-v"><strong style={{ color: tone(r.v, r.l) }}>{r.v ?? "—"}</strong>{r.ch !== null && r.ch !== 0 && <small style={{ color: r.ch > 0 ? COLOR.good : COLOR.bad }}><Delta n={r.ch} /></small>}</span>
            </button>
          </li>
        ))}
        {!shown.length && <li className="xa-muted xa-empty">Nothing matches. Try another word, or every band and all sectors.</li>}
      </ul>
    </div>
  );

  // ── About ────────────────────────────────────────────────────────────────
  const about = (
    <div className="xa-ab">
      <section className="xa-panel">
        <h2 className="xa-h2">Plans &amp; Billing</h2>
        <dl className="xa-plans">
          <div><dt>Free</dt><dd>Explore, as you see it here. No account needed.</dd><dd className="xa-price">Free</dd></div>
          <div><dt>Operational Intelligence</dt><dd>What needs attention today: the daily brief and alerts from your own data.</dd><dd className="xa-price">Contact us</dd></div>
          <div><dt>Executive Intelligence</dt><dd>Adds the diagnosis, treatments, recovery and where you stand among these peers, with the Board Pack.</dd><dd className="xa-price">Contact us</dd></div>
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
          <p>Explore shows how healthy whole sectors are, country by country and state by state: banks, credit unions, insurers and government agencies today, with hospitals and universities next. Anyone can use it, with no account.</p>
          <p><b>Organisational Health</b> is how stable the organisations in a place are as a whole; <b>Operational Health</b> is how well they run day to day. Both are out of 100.</p>
          <p className="xa-legend"><span><b style={{ background: COLOR.good }} />Stable</span><span><b style={{ background: COLOR.watch }} />Steady</span><span><b style={{ background: COLOR.bad }} />Fragile</span><span><b style={{ background: COLOR.few }} />Too few to show</span><span><b style={{ background: COLOR.next }} />Coming next</span></p>
          {(() => { const bd = data.layers[0]?.bands; if (!bd) return null;
            return (
              <table className="xa-bands">
                <caption>Where each band begins (out of 100)</caption>
                <thead><tr><th scope="col"></th><th scope="col"><b style={{ background: COLOR.good }} />Stable</th><th scope="col"><b style={{ background: COLOR.watch }} />Steady</th><th scope="col"><b style={{ background: COLOR.bad }} />Fragile</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Organisational Health</th><td>{bd.ssiStable}+</td><td>{bd.ssiSteady}–{bd.ssiStable - 1}</td><td>below {bd.ssiSteady}</td></tr>
                  <tr><th scope="row">Operational Health</th><td>{bd.ohiHealthy}+</td><td>{bd.ohiWatch}–{bd.ohiHealthy - 1}</td><td>below {bd.ohiWatch}</td></tr>
                </tbody>
              </table>
            ); })()}
        </div>
        <div className="xa-sub-sec">
          <h3>How the Numbers Are Made</h3>
          <p>Operational Health and Organisational Health are calculated using fixed rules on our servers. The same inputs always produce the same results, making every figure consistent, verifiable and reproducible.</p>
          <ul className="xa-principles">
            <li><b>Totals only.</b> Each institution is read from its public figures, then only medians and the Stable / Steady / Fragile split are shown. No institution is named; groups too small to keep anonymous are hidden, and a place needs at least {INSIGHT_MIN} organisations to appear among the movers and hotspots.</li>
            <li><b>Not an official rating.</b> These are Pulsus readings of public data, not regulatory ratings, credit ratings or advice. For any institution, the regulator&apos;s published data is authoritative.</li>
          </ul>
          {EVIDENCE.map((e) => <p key={e.id}><span className={`xa-ev is-${e.id}`}>{e.label}</span> {e.text}</p>)}
        </div>
        <div className="xa-sub-sec">
          <h3>Sources</h3>
          <ul className="xa-src">{realDefs.map((d) => <li key={d.id}><b>{d.title}</b><small>{d.publisher} · {when(layers[d.id], layers[d.id].asOf)}</small></li>)}</ul>
        </div>
      </section>
      <section className="xa-panel">
        <h2 className="xa-h2">Terms of Use &amp; Privacy Policy</h2>
        <p><a href={`${PLATFORM}/legal/terms`}>Terms of Use</a> · <a href="/privacy">Privacy Policy</a></p>
      </section>
      <footer className="xa-foot">
        <p>Pulsus <span className="xa-red">Platform</span> · Explore</p>
        <p>© 2026 Tumblehill Holdings LLC</p>
      </footer>
    </div>
  );

  return (
    <div className={`xa${theme === "light" ? " is-light" : ""}${wide ? " is-wide" : ""}${sel ? " has-card" : ""} on-${view}`}>
    <div className="xa-stage" ref={box}>
      {/* the map */}
      <svg className="xa-map" viewBox={vb} role="img" aria-label={`World map: ${WORD[measure]} of ${NOUN[sector]} by country. Use search to choose a place.`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="transparent" onClick={() => { if (moved.current <= 8 && sel) close(); }} />
        {world.countries.map((c) => {
          const r = atCountry(c.id);
          const col = r ? fill(r.g, r.l) : NEXT[c.id] ? COLOR.next : COLOR.none;
          const dim = r ? dimmed(r.g, r.l) : !!band;
          const on = sel && ((sel.region === c.id) || (cur && sel.region === null && cur.l.countries.includes(c.id)));
          return <path key={c.id + c.name} ref={(el) => { if (el) paths.current.set(c.id, el); }} d={c.d} style={{ fill: col }} className={`xa-c${on ? " on" : ""}${dim ? " dim" : ""}`} onClick={() => tapCountry(c.id)}><title>{c.name}</title></path>;
        })}
        {labels.map(({ iso, v, b }) => {
          const [x, y, w] = centres[iso];
          if (w / u < 26 && sel?.region !== iso) return null;   // too small on screen at this zoom: tap or zoom in
          return (
            <g key={iso} className={`xa-val is-${b}${band && band !== b ? " dim" : ""}`} transform={`translate(${x} ${y}) scale(${u})`}>
              <rect x={-16} y={8} width={32} height={19} rx={9.5} /><text x={0} y={22} textAnchor="middle">{v}</text>
            </g>
          );
        })}
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
        const wv = valueAt(whole, measure, at); const wb = bandOf(wv, measure, statesLayer.bands);
        const noun = isAll ? "organisations" : NOUN[defs.find((d) => d.id === statesLayer.layer)!.sector];
        return (
        <div className="xa-states">
          <nav className="xa-crumb" aria-label="Where you are"><button onClick={() => { setStates(null); setSel(null); flyTo(home); }}>‹ World</button><span>›</span>{cname("840")}<span>·</span>{isAll ? "all sectors" : noun}</nav>
          <div className="xa-states-h">
            <div><h2>{isAll ? "United States by state" : `US ${noun} by state`}</h2><p className="xa-sub">{WORD[measure]} · {at ? when(statesLayer, at) : `latest, ${when(statesLayer, statesLayer.asOf)}`} · tap a state for its detail</p></div>
            <button className="xa-states-all" onClick={() => setSel(isAll ? { layerId: ALL, region: "840" } : { layerId: statesLayer.layer, region: null })}><small>Whole US</small><strong style={{ color: wb ? COLOR[wb] : undefined }}>{wv ?? "—"}</strong></button>
          </div>
          <div className="xa-tiles" role="group" aria-label="States">
            {TILES.map(([s, x, y]) => {
              const g = statesLayer.regions[key(s)]; const v = valueAt(g, measure, at); const b = bandOf(v, measure, statesLayer.bands);
              const col = b ? COLOR[b] : g?.hidden ? COLOR.few : COLOR.next;
              return (
                <button key={s} className={`xa-tile${sel?.region === key(s) ? " on" : ""}${dimmed(g, statesLayer) ? " dim" : ""}`} style={{ gridColumn: x + 1, gridRow: y + 1, color: col, background: `color-mix(in srgb, ${col} 16%, transparent)`, transition: "background .3s" }}
                  aria-label={`${STATE_NAME[s]}: ${v ?? "not shown"}`} onClick={() => setSel({ layerId: statesLayer.layer, region: key(s) })}>
                  <b>{s}</b><span style={{ color: col }}>{v ?? "·"}</span>
                </button>
              );
            })}
          </div>
          <p className="xa-muted xa-small">{isAll ? "Banks and credit unions, state by state; US federal agencies are read for the country as a whole." : `Groups of fewer than ${statesLayer.minGroup} ${noun} are not shown.`} Press ▶ to watch the quarters change.</p>
        </div>
        ); })()}

      {/* the top: brand, search, sectors */}
      <header className="xa-top">
        {brand}
        <button className="xa-search" onClick={() => setSheet("search")} aria-label="Search places and sectors"><Ico d={I_SEARCH} size={18} /> <span>Search places and sectors</span></button>
        {chips}
        {!sel && !sheet && !states && <Invite />}
      </header>

      {/* the side buttons */}
      <div className="xa-fabs">
        <button className={sheet === "filters" ? "on" : ""} onClick={() => setSheet(sheet === "filters" ? "" : "filters")} aria-label="Filters"><Ico d={I_FILTER} /></button>
        <button className={sheet === "movers" ? "on" : ""} onClick={() => setSheet(sheet === "movers" ? "" : "movers")} aria-label="Movers and hotspots"><Ico d={I_MOVERS} /></button>
        <button onClick={() => { setSheet(""); setView("settings"); }} aria-label="About these figures"><Ico d={I_INFO} /></button>
        <button onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to day" : "Switch to night"} title={theme === "dark" ? "Day" : "Night"}><Ico d={theme === "dark" ? I_SUN : I_MOON} /></button>
      </div>

      {at && !sel && !(sheet && !wide) && (
        <p className="xa-period" aria-live="polite"><b>{when(inSector[0]?.l || {}, at)}</b><span>{WORD[measure]} then · the numbers and colours show that quarter</span></p>
      )}
      {!at && !sel && !sheet && !pins.length && (
        <p className="xa-key" aria-hidden="true"><span><b style={{ background: COLOR.good }} />Stable</span><span><b style={{ background: COLOR.watch }} />Steady</span><span><b style={{ background: COLOR.bad }} />Fragile</span><span><b style={{ background: COLOR.few }} />Too few</span><span><b style={{ background: COLOR.next }} />Next</span></p>
      )}

      {/* the time slider */}
      {periods.length > 1 && !(sel && !wide) && !(sheet && !wide) && (
        <div className="xa-time">
          <button className="xa-play" onClick={() => { if (!playing && at === null) setPi(0); setPlaying(!playing); }} aria-label={playing ? "Pause" : "Play the years"}>{playing ? "❚❚" : "▶"}</button>
          <input type="range" min={0} max={periods.length - 1} value={pi === null ? periods.length - 1 : pi} onChange={(e) => { setPlaying(false); const i = Number(e.target.value); setPi(i >= periods.length - 1 ? null : i); }} aria-label="Period" />
          <span className="xa-when">{at ? when(inSector[0]?.l || {}, at) : "Latest"}</span>
        </div>
      )}

      {/* the card: a bottom sheet on a phone, a side panel on a wide screen */}
      {card && <aside className="xa-card" aria-live="polite">{card}</aside>}

      {/* compare */}
      {pins.length > 0 && !sheet && !(sel && !wide) && (
        <section className="xa-tray" aria-label="Comparing">
          <div className="xa-card-h"><h2>Comparing {pins.length}</h2><button className="xa-x" onClick={() => setPins([])} aria-label="Clear">×</button></div>
          <div className="xa-cmp">
            {pins.map((k) => { const s = unpinned(k); const r = groupOf(s); if (!r) return null; const v = valueAt(r.g, measure, at); const b = bandOf(v, measure, r.l.bands);
              return (
                <div key={k} className="xa-cmpc">
                  <button className="xa-x small" onClick={() => togglePin(s)} aria-label={`Remove ${r.title}`}>×</button>
                  <b>{s.region === null && r.l.regionKind === "state" ? `${cname(r.l.countries[0])}: ${NOUN[r.def.sector]}` : r.title}</b>
                  <strong style={{ color: b ? COLOR[b] : undefined }}>{v ?? "—"}</strong>
                  <small>{n0(r.g.n)} · {r.g.split ? `${Math.round((100 * r.g.split.fragile) / r.g.n)}% Fragile` : ""}</small>
                  <Spark values={(r.g.trend || []).map((t) => t[measure])} color={b ? COLOR[b] : COLOR.good} h={30} />
                </div>
              ); })}
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
            {hits.map((h) => <button key={`${h.layerId}|${h.region}`} onClick={() => choose(h.layerId, h.region)}><b>{h.label}</b><small>{n0(h.g.n)} · {SHORT.ohi} {h.g.ohi ?? "—"}</small></button>)}
            {q.trim().length >= 2 && !hits.length && <p className="xa-muted">Nothing matches. Try a country, a US state, or banks, credit unions, insurers or agencies.</p>}
            {q.trim().length < 2 && <p className="xa-muted">For example: “credit unions Texas”, “banks Germany”, “agencies”.</p>}
          </div>
        </div>
      )}

      {(sheet === "movers" || sheet === "filters" || sheet === "about" || sheet === "you") && (
        <aside className="xa-sheet" role="dialog" aria-label={sheet}>
          <div className="xa-card-h"><h2>{sheet === "movers" ? "Movers and hotspots" : sheet === "filters" ? "Filters" : sheet === "about" ? "About these figures" : "See How You Stack Up"}</h2><button className="xa-x" onClick={() => setSheet("")} aria-label="Close">×</button></div>
          {sheet === "movers" && (
            <>
              <div className="xa-tabs" role="tablist">
                {([["up", "Improving"], ["down", "Deteriorating"], ["hot", "Hotspots"]] as const).map(([k, w]) => <button key={k} role="tab" aria-selected={moverTab === k} className={moverTab === k ? "on" : ""} onClick={() => setMoverTab(k)}>{w}</button>)}
              </div>
              <p className="xa-sub">Organisational Health, over the last year · tap to go there</p>
              <div className="xa-list">
                {movers.map((m) => { const l = layers[m.layer]; const def = defs.find((d) => d.id === m.layer); if (!l || !def) return null;
                  const name = `${place(l, m.region)}`; const mv = "change" in m;
                  return (
                    <button key={`${m.layer}|${m.region}`} onClick={() => choose(m.layer, m.region)}>
                      <span><b>{name}</b><small>{NOUN[def.sector]}{mv ? ` · ${(m as Mover).from} → ${(m as Mover).to}` : ` · ${(m as Hotspot).fragile} of ${(m as Hotspot).n} Fragile`}</small></span>
                      <em style={{ color: mv ? ((m as Mover).change > 0 ? COLOR.good : COLOR.bad) : COLOR.bad }}>{mv ? <Delta n={(m as Mover).change} /> : `${(m as Hotspot).share}%`}</em>
                    </button>
                  ); })}
              </div>
            </>
          )}
          {sheet === "filters" && (
            <div className="xa-filters">
              <p className="xa-label">Measure</p>
              <div className="xa-seg">{(["ohi", "oh"] as Measure[]).map((k) => <button key={k} className={measure === k ? "on" : ""} onClick={() => setMeasure(k)}>{WORD[k]}</button>)}</div>
              <p className="xa-label">Show</p>
              <div className="xa-seg">{([["", "Every band"], ["good", "Stable"], ["watch", "Steady"], ["bad", "Fragile"]] as [Band, string][]).map(([k, w]) => <button key={k || "all"} className={band === k ? "on" : ""} onClick={() => setBand(k)}>{w}</button>)}</div>
              <p className="xa-muted">Places outside the chosen band fade, on the map and in the states.</p>
            </div>
          )}
          {sheet === "about" && (
            <div className="xa-about">
              <p>Each institution is read from its public figures through the same engine Pulsus <span className="xa-red">Platform</span> uses for an organisation&apos;s own data, then only totals are shown: medians and the Stable / Steady / Fragile split, by country, state and size. No institution is named, and groups too small to keep anonymous are hidden. These are Pulsus readings of public data, not official regulatory ratings or advice.</p>
              {EVIDENCE.map((e) => <p key={e.id}><span className={`xa-ev is-${e.id}`}>{e.label}</span> {e.text}</p>)}
              <p className="xa-label">Sources</p>
              <ul>{realDefs.map((d) => <li key={d.id}><b>{d.title}</b> · {d.publisher} · {when(layers[d.id], layers[d.id].asOf)}</li>)}</ul>
              <p><a href="/privacy">Privacy</a> · © 2026 Tumblehill Holdings LLC</p>
            </div>
          )}
          {sheet === "you" && (
            <div className="xa-you-in">
              <h3>Connect your organisation to see yours.</h3>
              <p className="xa-muted">Explore is a free window on the world, read from public data. Pulsus <span className="xa-red">Platform</span> reads an organisation from its own systems the same way: Operational Intelligence shows what needs attention today; Executive Intelligence adds the diagnosis, treatments, recovery and where it stands among these peers; Oversight Intelligence watches over many organisations at once.</p>
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
      {([["overview", "Overview", I_HOME], ["directory", "Directory", I_LIST], ["map", "Map", I_MAP], ["settings", "Settings", I_GEAR]] as [View, string, string][]).map(([k, w, d]) => (
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
