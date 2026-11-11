"use client";

// Pulsus Explore, as an app: the world map fills the screen and everything
// floats over it. Tap a country to fly there and open its card; drill into
// states; play the years; see the movers; pin up to four groups to compare;
// search; filter. No sign-in. The figures are the finished, anonymous
// aggregates in lib/atlas/data (no institution is named, none of the method).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExploreData, Mover, Hotspot } from "../lib/atlas/explore";
import type { AtlasGroup, AtlasLayer } from "../lib/atlas/layers";
import { countryGroup } from "../lib/atlas/layers";
import { ELSEWHERE, EVIDENCE, LAYERS, NEXT, SECTORS, evidenceOf, type LayerDef, type SectorId } from "../lib/atlas/catalog";

export interface World { w: number; h: number; countries: { id: string; name: string; d: string }[] }
type Measure = "ohi" | "oh";
type Band = "" | "good" | "watch" | "bad";
type Sel = { layerId: string; region: string | null } | null;   // region null: the layer as a whole

const ABOUT = "https://about.pulsus.tech";
const PLATFORM = (process.env.NEXT_PUBLIC_PLATFORM_URL || "https://executive.pulsus.tech").replace(/\/+$/, "");
const WORD: Record<Measure, string> = { ohi: "Organisational Health", oh: "Operational Health" };
const SHORT: Record<Measure, string> = { ohi: "Org. Health", oh: "Op. Health" };
const NOUN: Record<SectorId, string> = { banks: "banks", "credit-unions": "credit unions", insurance: "insurers", government: "agencies", hospitals: "hospitals", universities: "universities" };
const COLOR = { good: "#3ddc97", watch: "#f5b947", bad: "#ff4f6d", few: "#3a4a7d", next: "#25306a", none: "#141c45" } as const;
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
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity="0.15" /><path d={d} fill="none" stroke={color} strokeWidth="2.4" vectorEffect="non-scaling-stroke" />
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

// ── the camera: what part of the map is in view ─────────────────────────────
interface Cam { cx: number; cy: number; zoom: number }

export default function MapApp({ data, world }: { data: ExploreData; world: World }) {
  const layers = useMemo(() => Object.fromEntries(data.layers.map((l) => [l.layer, l])) as Record<string, AtlasLayer>, [data]);
  const defs = useMemo(() => LAYERS.filter((d) => layers[d.id]), [layers]);
  const [sector, setSector] = useState<SectorId>("banks");
  const [measure, setMeasure] = useState<Measure>("ohi");
  const [band, setBand] = useState<Band>("");
  const [sel, setSel] = useState<Sel>(null);
  const [states, setStates] = useState<string | null>(null);   // a state layer open as its states
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
  const place = useCallback((l: AtlasLayer, region: string) => (l.regionKind === "state" ? STATE_NAME[region] || region : cname(region)), [cname]);
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
    for (const def of defs) {
      const l = layers[def.id];
      out.push({ layerId: def.id, region: null, label: def.title, g: l.national });
      for (const [r, g] of Object.entries(l.regions)) if (!g.hidden && !(l.regionKind === "country" && l.countries.length === 1)) out.push({ layerId: def.id, region: r, label: `${place(l, r)}: ${NOUN[def.sector]}`, g });
    }
    return out;
  }, [defs, layers, place]);
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
      const l = layers[layer]; const def = defs.find((d) => d.id === layer); if (!l || def?.sector !== sector) return;
      const iso = kind === "state" ? l.countries[0] : region; if (!m.some((x) => x.iso === iso)) m.push({ iso, color });
    };
    for (const x of insight.up.slice(0, 3)) add(x.layer, x.region, x.regionKind, COLOR.good);
    for (const x of insight.down.slice(0, 3)) add(x.layer, x.region, x.regionKind, COLOR.bad);
    return m;
  }, [insight, layers, defs, sector]);
  const [centres, setCentres] = useState<Record<string, [number, number]>>({});
  useEffect(() => {
    const c: Record<string, [number, number]> = {};
    for (const { iso } of markers) { const p = paths.current.get(iso); if (p) { const b = iso === "840" ? { x: 170, y: 117, width: 147, height: 76 } : p.getBBox(); c[iso] = [b.x + b.width / 2, b.y + b.height / 2]; } }
    setCentres(c);
  }, [markers]);
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
        <div className="xa-btns">
          {l.regionKind === "state" && sel.region === null && !states && <button className="xa-btn" onClick={() => { setStates(l.layer); }}>See the states ›</button>}
          {!g.hidden && <button className={`xa-btn ghost${pinned ? " on" : ""}`} onClick={() => togglePin(sel)} disabled={!pinned && pins.length >= 4}>{pinned ? "✓ Comparing" : "+ Compare"}</button>}
        </div>
        <p className="xa-note"><span className={`xa-ev is-${def.evidence}`}>{evidenceOf(def.evidence).label}</span> {def.publisher}. No institution is named.</p>
      </div>
    );
  })();

  const chips = (
    <div className="xa-chips" role="group" aria-label="Sector">
      {SECTORS.map((s) => (
        <button key={s.id} className={`xa-chip${sector === s.id ? " on" : ""}`} disabled={s.status !== "live"} aria-pressed={sector === s.id}
          onClick={() => { setSector(s.id); setSel(null); setStates(null); flyTo(home); }} title={s.status === "live" ? s.where : "Coming next"}>
          {s.label}{s.status !== "live" && <small> · next</small>}
        </button>
      ))}
    </div>
  );

  return (
    <div className={`xa${wide ? " is-wide" : ""}${sel ? " has-card" : ""}`} ref={box}>
      {/* the map */}
      <svg className="xa-map" viewBox={vb} role="img" aria-label={`World map: ${WORD[measure]} of ${NOUN[sector]} by country. Use search to choose a place.`}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <rect x={-2000} y={-2000} width={5000} height={5000} fill="transparent" onClick={() => { if (moved.current <= 8 && sel) close(); }} />
        {world.countries.map((c) => {
          const r = atCountry(c.id);
          const col = r ? fill(r.g, r.l) : NEXT[c.id] ? COLOR.next : COLOR.none;
          const dim = r ? dimmed(r.g, r.l) : !!band;
          const on = sel && ((sel.region === c.id) || (cur && sel.region === null && cur.l.countries.includes(c.id)));
          return <path key={c.id + c.name} ref={(el) => { if (el) paths.current.set(c.id, el); }} d={c.d} fill={col} className={`xa-c${on ? " on" : ""}${dim ? " dim" : ""}`} onClick={() => tapCountry(c.id)}><title>{c.name}</title></path>;
        })}
        {markers.map((m) => centres[m.iso] && (
          <g key={m.iso} className="xa-mark" transform={`translate(${centres[m.iso][0]} ${centres[m.iso][1]}) scale(${1 / cam.zoom})`}>
            <circle r="13" fill={m.color} opacity="0.25" className="xa-pulse" /><circle r="5" fill={m.color} stroke="#0a0f2c" strokeWidth="1.5" />
          </g>
        ))}
      </svg>

      {/* the states, when a country is read by state */}
      {statesLayer && (
        <div className="xa-states">
          <nav className="xa-crumb" aria-label="Where you are"><button onClick={() => { setStates(null); setSel({ layerId: statesLayer.layer, region: null }); flyToCountry(statesLayer.countries[0]); }}>‹ World</button><span>›</span>{cname(statesLayer.countries[0])}<span>·</span>{NOUN[defs.find((d) => d.id === statesLayer.layer)!.sector]}</nav>
          <div className="xa-tiles" role="group" aria-label="States">
            {TILES.map(([s, x, y]) => {
              const g = statesLayer.regions[s]; const v = valueAt(g, measure, at); const b = bandOf(v, measure, statesLayer.bands);
              const col = b ? COLOR[b] : g?.hidden ? COLOR.few : COLOR.next;
              return (
                <button key={s} className={`xa-tile${sel?.region === s ? " on" : ""}${dimmed(g, statesLayer) ? " dim" : ""}`} style={{ gridColumn: x + 1, gridRow: y + 1, borderColor: col, background: `${col}22` }}
                  aria-label={`${STATE_NAME[s]}: ${v ?? "not shown"}`} onClick={() => setSel({ layerId: statesLayer.layer, region: s })}>
                  <b>{s}</b><span style={{ color: col }}>{v ?? "·"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* the top: brand, search, sectors */}
      <header className="xa-top">
        <div className="xa-brand">
          <a href="/" aria-label="Pulsus Explore"><img src="/pulsus-platform-logo-light.png" alt="Pulsus" /></a>
          <span className="xa-tag">Explore</span>
          <button className="xa-you" onClick={() => setSheet(sheet === "you" ? "" : "you")}>Your organisation →</button>
        </div>
        <button className="xa-search" onClick={() => setSheet("search")} aria-label="Search places and sectors">⌕ <span>Search places and sectors</span></button>
        {chips}
      </header>

      {/* the side buttons */}
      <div className="xa-fabs">
        <button className={sheet === "filters" ? "on" : ""} onClick={() => setSheet(sheet === "filters" ? "" : "filters")} aria-label="Filters">⚲</button>
        <button className={sheet === "movers" ? "on" : ""} onClick={() => setSheet(sheet === "movers" ? "" : "movers")} aria-label="Movers and hotspots">↕</button>
        <button className={sheet === "about" ? "on" : ""} onClick={() => setSheet(sheet === "about" ? "" : "about")} aria-label="About these figures">i</button>
      </div>

      {!sel && !sheet && !pins.length && (
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
          <div className="xa-card-h"><h2>{sheet === "movers" ? "Movers and hotspots" : sheet === "filters" ? "Filters" : sheet === "about" ? "About these figures" : "Your organisation"}</h2><button className="xa-x" onClick={() => setSheet("")} aria-label="Close">×</button></div>
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
                      <em style={{ color: mv ? ((m as Mover).change > 0 ? COLOR.good : COLOR.bad) : COLOR.bad }}>{mv ? `${(m as Mover).change > 0 ? "↗ +" : "↘ "}${(m as Mover).change}` : `${(m as Hotspot).share}%`}</em>
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
              <p>Each institution is read from its public figures through the same engine Pulsus Platform uses for an organisation&apos;s own data, then only totals are shown: medians and the Stable / Steady / Fragile split, by country, state and size. No institution is named, and groups too small to keep anonymous are hidden. A reading of public figures, not a rating or advice.</p>
              {EVIDENCE.map((e) => <p key={e.id}><span className={`xa-ev is-${e.id}`}>{e.label}</span> {e.text}</p>)}
              <p className="xa-label">Sources</p>
              <ul>{defs.map((d) => <li key={d.id}><b>{d.title}</b> · {d.publisher} · {when(layers[d.id], layers[d.id].asOf)}</li>)}</ul>
              <p><a href="/privacy">Privacy</a> · © 2026 Tumblehill Holdings LLC</p>
            </div>
          )}
          {sheet === "you" && (
            <div className="xa-you-in">
              <h3>Connect your organisation to see yours.</h3>
              <p className="xa-muted">Explore is a free window on the world, read from public data. Pulsus Platform reads an organisation from its own systems the same way: Operational Intelligence shows what needs attention today; Executive Intelligence adds the diagnosis, treatments, recovery and where it stands among these peers; Oversight Intelligence watches over many organisations at once.</p>
              <div className="xa-btns"><a className="xa-btn" href={`${PLATFORM}/signup?product=platform`}>Start a 14-day trial</a><a className="xa-btn ghost" href={`${ABOUT}/walkthrough/`}>Talk to us</a></div>
              <h3>Subscribe for updates</h3>
              <Subscribe />
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

/** Subscribe for updates: just an email address, kept by Pulsus Platform. */
function Subscribe() {
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
      if (r.ok && j.ok) { setState("done"); return; }
      setState("error"); setMsg(r.status === 429 ? "Too many tries just now. Please try again later." : "That email address doesn't look right.");
    } catch { setState("error"); setMsg("You seem to be offline. Try again when you have a connection."); }
  };
  if (state === "done") return <p className="xa-done" role="status">Thank you, you&apos;re subscribed.</p>;
  return (
    <form className="xa-sub-form" onSubmit={submit}>
      <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="Your email address" aria-label="Email" />
      <input className="xa-hp" aria-hidden="true" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button className="xa-btn" disabled={state === "sending"}>{state === "sending" ? "Subscribing" : "Subscribe"}</button>
      <p className="xa-muted small">{msg ? <span role="alert">{msg}</span> : <>Updates on new sectors and quarterly figures. Unsubscribe any time; see <a href="/privacy">Privacy</a>.</>}</p>
    </form>
  );
}
