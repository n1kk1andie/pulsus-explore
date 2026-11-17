"use client";
// The Pulse tab's three pictures of the world of business:
//   Heartbeat  the overall median, five years of quarters, drawn as a pulse line.
//   Shapes     every organisation in each sector, as the shape of its scores (0–100).
//   Matrix     sector by region: one tile per pair, with the rows' and columns' medians.
// Every figure is Organisational Health. No institution is named: the shapes are
// built from anonymous score lists, and every tile is a median.
import React, { useEffect, useRef, useState } from "react";

/** A score's colour, red through amber to green (the same scale as the map). */
export type Shade = (v: number) => string;

/** True once the element has been on screen: animations play when their section is in view. */
function useSeen<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

// ── Heartbeat ────────────────────────────────────────────────────────────────

export interface Beat { label: string; v: number }

/** One plain sentence on the line, by fixed rules. */
export function beatSentence(points: Beat[]): string {
  if (points.length < 2) return "";
  const last = points[points.length - 1];
  const ago = points.length > 4 ? points[points.length - 5] : points[0];
  const low = points.reduce((a, b) => (b.v < a.v ? b : a));
  const ch = last.v - ago.v;
  const move = ch === 0 ? `Steady: no change on ${ago.label}` : ch > 0 ? `Up ${ch} on ${ago.label}` : `Down ${-ch} on ${ago.label}`;
  const fromLow = last.v - low.v;
  return fromLow >= 3 && low !== last ? `${move}, and ${fromLow} points above the low of ${low.v} in ${low.label}.` : `${move}.`;
}

export function Heartbeat({ points, shade }: { points: Beat[]; shade: Shade }) {
  const [ref, seen] = useSeen<SVGSVGElement>();
  const [narrow, setNarrow] = useState(false);
  useEffect(() => { const q = window.matchMedia("(max-width: 640px)"); const on = () => setNarrow(q.matches); on(); q.addEventListener("change", on); return () => q.removeEventListener("change", on); }, []);
  if (points.length < 2) return null;
  const w = narrow ? 400 : 720, h = narrow ? 190 : 170, pad = { l: 6, r: 44, t: 26, b: 26 };
  const vs = points.map((p) => p.v);
  const lo = Math.min(...vs) - 4, hi = Math.max(...vs) + 4;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((hi - v) * (h - pad.t - pad.b)) / (hi - lo || 1);
  // The line goes through every quarter at its true value: nothing is drawn between them.
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const lowI = vs.indexOf(Math.min(...vs));
  const years = points.map((p, i) => ({ i, y: p.label.slice(-4) })).filter((p, k, a) => k > 0 && p.y !== a[k - 1].y);
  return (
    <svg ref={ref} className={`xa-beat${seen ? " is-on" : ""}`} viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label={`Median Organisational Health by quarter, ${points[0].label} to ${points[last].label}: from ${points[0].v} to ${points[last].v}; lowest ${vs[lowI]} in ${points[lowI].label}.`}>
      <defs>
        <linearGradient id="xa-beat-g" x1="0" x2="1" y1="0" y2="0">
          {points.map((p, i) => <stop key={i} offset={`${(x(i) / w) * 100}%`} stopColor={shade(p.v)} />)}
        </linearGradient>
      </defs>
      {years.map((t) => <g key={t.y}><line x1={x(t.i)} x2={x(t.i)} y1={pad.t - 8} y2={h - pad.b} className="xa-beat-yr" /><text x={x(t.i) + 4} y={h - 8} className="xa-beat-ax">{t.y}</text></g>)}
      <path d={`${d} L${x(points.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`} className="xa-beat-area" style={{ fill: "url(#xa-beat-g)" }} />
      <path d={d} className="xa-beat-line" pathLength={1} style={{ stroke: "url(#xa-beat-g)" }} />
      {lowI !== last && <g className="xa-beat-note"><circle cx={x(lowI)} cy={y(vs[lowI])} r="3.5" /><text x={x(lowI)} y={y(vs[lowI]) + 18} textAnchor="middle">low {vs[lowI]} · {points[lowI].label}</text></g>}
      <circle cx={x(last)} cy={y(vs[last])} r="9" className="xa-beat-ring" style={{ fill: shade(vs[last]) }} />
      <circle cx={x(last)} cy={y(vs[last])} r="4.5" className="xa-beat-now" style={{ fill: shade(vs[last]) }} />
      <text x={x(last) + 13} y={y(vs[last]) + 5} className="xa-beat-val">{vs[last]}</text>
    </svg>
  );
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface ShapeRow { id: string; label: string; icon: string; n: number; median: number | null; scores: number[]; next?: boolean; where?: string }

/** The score at a share of a sorted list. */
const at = (s: number[], q: number) => (s.length ? s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] : 0);

export function Shapes({ rows, shade, icon, onPick }: { rows: ShapeRow[]; shade: Shade; icon: (d: string) => React.ReactNode; onPick: (id: string) => void }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const W = 400, H = 44, BINS = 50;
  const stops = Array.from({ length: 11 }, (_, i) => i * 10);
  return (
    <div ref={ref} className={`xa-shapes${seen ? " is-on" : ""}`}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
        <defs><linearGradient id="xa-shape-g" x1="0" x2="1" y1="0" y2="0">{stops.map((s) => <stop key={s} offset={`${s}%`} stopColor={shade(s)} />)}</linearGradient></defs>
      </svg>
      <div className="xa-shape-axis" aria-hidden="true"><span /><span><i>0</i><i>25</i><i>50</i><i>75</i><i>100</i></span><span /></div>
      {rows.map((r, k) => {
        if (r.next || !r.scores.length) return (
          <div key={r.id} className="xa-shape is-next"><span className="xa-shape-l">{icon(r.icon)}<b>{r.label}</b><small>Next{r.where ? ` · ${r.where}` : ""}</small></span><span className="xa-shape-plot" /><span className="xa-shape-v">—</span></div>
        );
        const s = [...r.scores].sort((a, b) => a - b);
        // A smoothed count of scores in each 2-point step: the shape of the sector.
        const raw = Array.from({ length: BINS }, () => 0);
        for (const v of s) raw[Math.min(BINS - 1, Math.max(0, Math.floor(v / (100 / BINS))))]++;
        const k5 = [1, 3, 5, 3, 1];
        const sm = raw.map((_, i) => k5.reduce((t, kw, j) => t + kw * (raw[i + j - 2] ?? 0), 0));
        const top = Math.max(...sm) || 1;
        const px = (i: number) => ((i + 0.5) * W) / BINS;
        const py = (c: number) => H - 2 - (c / top) * (H - 6);
        const d = `M0,${H - 2} ` + sm.map((c, i) => `L${px(i).toFixed(1)},${py(c).toFixed(1)}`).join(" ") + ` L${W},${H - 2} Z`;
        const q1 = at(s, 0.25), q3 = at(s, 0.75);
        const m = r.median ?? at(s, 0.5);
        return (
          <button key={r.id} type="button" className="xa-shape" style={{ "--d": `${k * 90}ms` } as React.CSSProperties} onClick={() => onPick(r.id)}
            aria-label={`${r.label}: ${r.n.toLocaleString("en-US")} organisations, median ${m}; the middle half scores ${q1} to ${q3}. Open on the map.`}>
            <span className="xa-shape-l">{icon(r.icon)}<b>{r.label}</b><small>{r.n.toLocaleString("en-US")} · middle half {q1}–{q3}</small></span>
            <span className="xa-shape-plot">
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
                <rect x={(q1 / 100) * W} y="0" width={((q3 - q1) / 100) * W} height={H} className="xa-shape-iqr" />
                <path d={d} className="xa-shape-area" style={{ fill: "url(#xa-shape-g)" }} />
                <line x1={(m / 100) * W} x2={(m / 100) * W} y1="0" y2={H} className="xa-shape-med" />
              </svg>
            </span>
            <span className="xa-shape-v" style={{ color: shade(m) }}>{m}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Matrix ───────────────────────────────────────────────────────────────────

/** `totals`: a country-level reading from published country totals (EIOPA's insurance), not a
 *  median of institutions: `n` is its number of countries, `undertakings` the undertakings their
 *  totals sum. Drawn apart (dashed, hatched, tagged) and never part of a row's or column's total. */
export interface Cell { v: number | null; n: number; change: number | null; totals?: { undertakings: number | null } }
/** The words a country-totals tile is described by: its tooltip and the start of its label. */
export const TOTALS_TIP = "From country totals, not a median of insurers; average of the last four quarters";
export interface MatrixData {
  /** Every continent, covered or not: an empty one says so rather than being left out. */
  rows: { id: string; label: string; sub: string; globe: string; total: Cell | null }[];
  cols: { id: string; label: string; icon: string; total: Cell }[];
  cells: Record<string, Record<string, Cell | null>>;   // row id → col id → cell (null: no data)
  all: Cell;
  /** Why a box is empty: region id → sector id → a few words. */
  why?: Record<string, Record<string, string>>;
}

const arrow = (c: number | null) => (c === null || c === 0 ? null : c > 0 ? <i className="xa-up">▲{c}</i> : <i className="xa-down">▼{-c}</i>);

export function Matrix({ m, shade, icon, onPick }: { m: MatrixData; shade: Shade; icon: (d: string) => React.ReactNode; onPick: (sector: string, region: string) => void }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const tile = (c: Cell | null, key: string, label: string, pick?: () => void, strong = false, reason?: string) => {
    if (!c || c.v === null) { const why = reason || "No public data yet"; return <span key={key} role="cell" className="xa-mx-c is-none" title={why} aria-label={`${label}: ${why}`}><small>{why}</small></span>; }
    const style = { "--c": shade(c.v) } as React.CSSProperties;
    const ch = c.change ? `, ${c.change > 0 ? "up" : "down"} ${Math.abs(c.change)} on a year ago` : "";
    if (c.totals) {
      // A country-level reading: dashed and hatched, tagged, and counted in countries (and undertakings), not institutions.
      const cn = `${c.n.toLocaleString("en-US")} ${c.n === 1 ? "country" : "countries"}`;
      const un = c.totals.undertakings ? ` · ${c.totals.undertakings.toLocaleString("en-US")} undertakings` : "";
      // No year-on-year arrow: a country-level reading shows its trend line on its card, not a change badge.
      const aria = `${label}: country-level reading ${c.v}, ${TOTALS_TIP.toLowerCase()}; ${cn}${un}`;
      const inner = <><b>{c.v}</b><em className="xa-mx-tag">country totals</em><small>{cn}{un}</small></>;
      return pick
        ? <button key={key} type="button" role="cell" className="xa-mx-c is-ctotals" style={style} onClick={pick} title={TOTALS_TIP} aria-label={`${aria}. Open on the map`}>{inner}</button>
        : <span key={key} role="cell" className="xa-mx-c is-ctotals" style={style} title={TOTALS_TIP} aria-label={aria}>{inner}</span>;
    }
    const body = <><b>{c.v}</b>{arrow(c.change)}<small>{c.n.toLocaleString("en-US")}</small></>;
    const aria = `${label}: median ${c.v} of ${c.n.toLocaleString("en-US")}${ch}`;
    return pick
      ? <button key={key} type="button" role="cell" className={`xa-mx-c${strong ? " is-total" : ""}`} style={style} onClick={pick} aria-label={`${aria}. Open on the map`}>{body}</button>
      : <span key={key} role="cell" className={`xa-mx-c${strong ? " is-total" : ""}`} style={style} aria-label={aria}>{body}</span>;
  };
  return (
    <div ref={ref} className={`xa-mx${seen ? " is-on" : ""}`} style={{ "--cols": m.cols.length } as React.CSSProperties} role="table" aria-label="Median Organisational Health by region and sector">
      <div className="xa-mx-r is-head" role="row">
        <span role="columnheader" className="xa-mx-l" />
        {m.cols.map((c) => <span key={c.id} role="columnheader" className="xa-mx-h">{icon(c.icon)}<span>{c.label}</span></span>)}
        <span role="columnheader" className="xa-mx-h is-total"><span>All sectors</span></span>
      </div>
      {m.rows.map((r) => (
        <div key={r.id} className={`xa-mx-r${r.total ? "" : " is-empty"}`} role="row">
          <span role="rowheader" className="xa-mx-l"><em aria-hidden="true">{r.globe}</em><span><b>{r.label}</b><small>{r.sub}</small></span></span>
          {r.total
            ? <>{m.cols.map((c) => tile(m.cells[r.id]?.[c.id] ?? null, c.id, `${r.label}, ${c.label}`, () => onPick(c.id, r.id), false, m.why?.[r.id]?.[c.id]))}{tile(r.total, "t", `${r.label}, all sectors`, undefined, true)}</>
            : <span role="cell" className="xa-mx-none">No data available yet for any sector</span>}
        </div>
      ))}
      <div className="xa-mx-r is-foot" role="row">
        <span role="rowheader" className="xa-mx-l"><span><b>All regions</b></span></span>
        {m.cols.map((c) => tile(c.total, c.id, `${c.label}, all regions`, () => onPick(c.id, ""), true))}
        {tile(m.all, "all", "All sectors, all regions", undefined, true)}
      </div>
    </div>
  );
}
