"use client";

// Charts for Pulse: measured to their container so text stays crisp, drawn
// with SVG, animated only when the reader allows motion. Every chart carries a
// plain-language label and a hidden table, so it is never only a picture.

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export const useIsoLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    try {
      const q = window.matchMedia("(prefers-reduced-motion: reduce)");
      setR(q.matches);
      const on = () => setR(q.matches);
      q.addEventListener?.("change", on);
      return () => q.removeEventListener?.("change", on);
    } catch { return undefined; }
  }, []);
  return r;
}

export function useWidth<T extends HTMLElement>(fallback = 600): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useIsoLayout(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth || fallback);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w];
}

/** Count from 0 to `target` once, easing out. Shows the real number before
 *  hydration and when motion is reduced. */
export function useCountUp(target: number | null, ms = 1400, delay = 150): number | null {
  const [v, setV] = useState(target);
  useIsoLayout(() => {
    if (target === null) { setV(null); return; }
    let reduce = false;
    try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* no matchMedia */ }
    if (reduce) { setV(target); return; }
    setV(0);
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const k = Math.max(0, Math.min(1, (t - t0) / ms));
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, delay]);
  return v;
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortMonth = (p: string) => MONTH[Number(p.slice(5, 7)) - 1] || p;

function smooth(pts: [number, number][]): string {
  if (!pts.length) return "";
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.18;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export interface Marker { period: string; label: string; kind: "low" | "start" | "now" }
export interface Shade { from: string; to: string; label: string; tone: "good" | "watch" | "bad" | "calm" }

export type Tone = "healthy" | "watch" | "critical";
/** A heartbeat's period for a condition: calm when healthy, quicker on watch, fast when critical. */
export const BEAT_MS: Record<Tone, number> = { healthy: 1400, watch: 1000, critical: 700 };

/** Replays `key`-driven beats whenever the element scrolls back into view. */
function useInView<T extends Element>(ref: React.RefObject<T>): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let seen = false;
    const io = new IntersectionObserver((es) => {
      for (const e of es) { if (e.isIntersecting && !seen) { seen = true; setN((k) => k + 1); } else if (!e.isIntersecting) seen = false; }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return n;
}

/** The health line, 0–100, with the Command Center's healthy and watch lines
 *  drawn in. A monitor sweep runs along the real line when it appears, and the
 *  latest point beats at a rate set by its condition — a few beats, then still.
 *  The line itself is always the data: no decorative spikes. */
export function HealthChart({ points, height: fixedHeight = 220, markers = [], shades = [], label, cursor, compact, fill, thresholds = [82, 65], second, secondLabel, firstLabel = "Operational Health", tick = shortMonth }: {
  points: { period: string; score: number | null }[]; height?: number; markers?: Marker[]; shades?: Shade[];
  label: string; cursor?: number | null; compact?: boolean; fill?: boolean; thresholds?: [number, number];
  second?: { period: string; score: number | null }[]; secondLabel?: string; firstLabel?: string;
  tick?: (period: string) => string;   // the axis label for a period (a month by default)
}) {
  const [hi, wa] = thresholds;
  const toneOf = (v: number): Tone => (v >= hi ? "healthy" : v >= wa ? "watch" : "critical");
  const reduce = useReducedMotion();
  const [ref, w] = useWidth<HTMLDivElement>();
  // `fill`: take the height the layout gives the chart (desktop cards), never less than asked.
  const [fh, setFh] = useState(0);
  useIsoLayout(() => {
    if (!fill || !ref.current) return;
    const el = ref.current;
    const read = () => setFh(el.clientHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const height = Math.max(fixedHeight, fill ? fh : 0);
  const pad = { l: 30, r: 14, t: compact ? 14 : 26, b: 26 };
  const known = [...points, ...(second || [])].filter((p) => p.score !== null) as { period: string; score: number }[];
  const lo = Math.max(0, Math.min(50, ...known.map((p) => p.score)) - 10);
  const x = (i: number) => pad.l + (points.length < 2 ? 0 : (i * (w - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((100 - v) * (height - pad.t - pad.b)) / (100 - lo);
  const xy: [number, number][] = points.map((p, i) => [x(i), p.score === null ? NaN : y(p.score)]).filter((p) => !Number.isNaN(p[1])) as [number, number][];
  const line = smooth(xy);
  const area = xy.length ? `${line} L${xy[xy.length - 1][0]},${height - pad.b} L${xy[0][0]},${height - pad.b} Z` : "";
  const idx = (p: string) => points.findIndex((q) => q.period === p);
  const gid = useRef(`g${Math.random().toString(36).slice(2, 8)}`).current;
  const shown = cursor === null || cursor === undefined ? points.length - 1 : cursor;
  const clipW = cursor === null || cursor === undefined ? w : x(shown) + 6;
  const xy2: [number, number][] = (second || []).map((p, i) => [x(i), p.score === null ? NaN : y(p.score)]).filter((p) => !Number.isNaN(p[1])) as [number, number][];
  const nowPt = points[shown];
  const nowTone = nowPt && nowPt.score !== null ? toneOf(nowPt.score) : null;
  const beats = useInView(ref);
  // The sweep: a bright point travelling the real line once, as a monitor draws.
  const sweep = useRef<SVGAnimateMotionElement>(null);
  useEffect(() => {
    if (reduce || cursor != null || !line) return;
    try { sweep.current?.beginElement(); } catch { /* SMIL unavailable: the line still draws */ }
  }, [reduce, cursor, line, beats]);
  return (
    <div ref={ref} className={`pz-chart${fill ? " is-fill" : ""}`}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pz-line-strong)" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--pz-line-strong)" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${gid}c`}><rect x="0" y="0" width={clipW} height={height} className="pz-clip" /></clipPath>
        </defs>
        {shades.map((s, k) => {
          const a = idx(s.from), b = idx(s.to);
          if (a < 0 || b < 0) return null;
          const half = points.length > 1 ? (w - pad.l - pad.r) / (points.length - 1) / 2 : 0;
          const x0 = Math.max(pad.l, x(a) - half), x1 = Math.min(w - pad.r, x(b) + half);
          return (
            <g key={k}>
              <rect x={x0} y={pad.t - (compact ? 0 : 18)} width={x1 - x0} height={height - pad.b - pad.t + (compact ? 0 : 18)} className={`pz-shade pz-shade-${s.tone}`} />
              {!compact && <text x={x0 + 6} y={pad.t - 6} className="pz-shade-label">{s.label}</text>}
            </g>
          );
        })}
        {[hi, wa].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} className={v === hi ? "pz-rule pz-rule-good" : "pz-rule pz-rule-bad"} />
            <text x={pad.l - 6} y={y(v) + 3.5} textAnchor="end" className="pz-axis">{v}</text>
          </g>
        ))}
        <text x={pad.l - 6} y={y(100) + 3.5} textAnchor="end" className="pz-axis">100</text>
        <g clipPath={`url(#${gid}c)`}>
          {!shades.length && <path d={area} fill={`url(#${gid})`} />}
          {xy2.length > 1 && <path d={smooth(xy2)} className="pz-line pz-line-second" pathLength={1} />}
          <path d={line} className="pz-line" pathLength={1} />
          {points.map((p, i) => p.score === null ? null : (
            <circle key={p.period} cx={x(i)} cy={y(p.score)} r={i === shown ? 5 : 2.6} className={`pz-dot pz-dot-${toneOf(p.score) === "healthy" ? "good" : toneOf(p.score) === "watch" ? "watch" : "bad"}${i === shown ? " is-now" : ""}`} />
          ))}
        </g>
        {!reduce && nowPt && nowPt.score !== null && nowTone && (
          <circle key={`beat-${shown}-${beats}`} cx={x(shown)} cy={y(nowPt.score)} r={5} className={`pz-beat tone-${nowTone}`}
            style={{ ["--beat" as string]: `${BEAT_MS[nowTone]}ms` }} aria-hidden="true" />
        )}
        {!reduce && cursor == null && line && (
          <g className="pz-sweep" key={`sweep-${beats}`} aria-hidden="true">
            <circle r={9} className="pz-sweep-glow"><animateMotion ref={sweep} dur="1.7s" begin="indefinite" fill="freeze" path={line} /></circle>
          </g>
        )}
        {markers.map((m) => {
          const i = idx(m.period);
          const p = points[i];
          if (i < 0 || !p || p.score === null) return null;
          if (m.kind === "start") return (
            <g key={m.label} className="pz-marker">
              <line x1={x(i)} x2={x(i)} y1={pad.t} y2={height - pad.b} className="pz-rule pz-rule-start" />
              {!compact && <text x={x(i) + 5} y={height - pad.b - 6} className="pz-marker-label">{m.label}</text>}
            </g>
          );
          return (
            <g key={m.label} className="pz-marker">
              <text x={Math.min(Math.max(x(i), pad.l + 24), w - pad.r - 24)} y={m.kind === "low" ? y(p.score) + 18 : y(p.score) - 11} textAnchor="middle" className="pz-marker-label strong">{m.label}</text>
            </g>
          );
        })}
        {points.map((p, i) => (compact && i % 2 && i !== points.length - 1) ? null : (
          <text key={p.period} x={x(i)} y={height - 8} textAnchor="middle" className={`pz-axis${i === shown ? " is-now" : ""}`}>{tick(p.period)}</text>
        ))}
      </svg>
      <table className="pz-sr">
        <caption>{label}</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">{firstLabel}</th>{second ? <th scope="col">{secondLabel || "Second"}</th> : null}</tr></thead>
        <tbody>{points.map((p, i) => <tr key={p.period}><td>{p.period}</td><td>{p.score ?? "no reading"}</td>{second ? <td>{second[i]?.score ?? "no reading"}</td> : null}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** A small line, no text: the shape of a trend. */
export function Spark({ values, height = 34, tone = "calm", label, domain }: { values: (number | null)[]; height?: number; tone?: string; label?: string; domain?: [number, number] }) {
  const [ref, w] = useWidth<HTMLDivElement>(120);
  const beats = useInView(ref);
  const vs = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  if (vs.length < 2) return <div ref={ref} className="pz-spark" style={{ height }} />;
  const lo = Math.min(domain ? domain[0] : Infinity, ...vs.map((p) => p[1])), hi = Math.max(domain ? domain[1] : -Infinity, ...vs.map((p) => p[1]));
  const span = hi - lo || 1;
  const x = (i: number) => 2 + (i * (w - 4)) / (values.length - 1);
  const y = (v: number) => 3 + ((hi - v) * (height - 6)) / span;
  const pts = vs.map(([i, v]) => [x(i), y(v)] as [number, number]);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="pz-spark" style={{ height }}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <path d={smooth(pts)} className={`pz-spark-line tone-${tone}`} pathLength={1} />
        <circle cx={last[0]} cy={last[1]} r={2.6} className={`pz-spark-dot tone-${tone}`} />
        {(tone === "healthy" || tone === "watch" || tone === "critical") && (
          <circle key={beats} cx={last[0]} cy={last[1]} r={2.6} className={`pz-beat pz-beat-sm tone-${tone}`} style={{ ["--beat" as string]: `${BEAT_MS[tone as Tone]}ms` }} aria-hidden="true" />
        )}
      </svg>
    </div>
  );
}

/** One reading over time: its own earlier level drawn in, the month it turned worse marked. */
export function ReadingChart({ points, baseline, since, worseUp, label, fmt }: {
  points: { period: string; value: number }[]; baseline: number; since: string | null; worseUp: boolean; label: string; fmt: (v: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>(320);
  const h = 128, pad = { l: 8, r: 8, t: 18, b: 22 };
  const vals = [...points.map((p) => p.value), baseline];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i: number) => pad.l + (points.length < 2 ? 0 : (i * (w - pad.l - pad.r)) / (points.length - 1));
  const y = (v: number) => pad.t + ((hi - v) * (h - pad.t - pad.b)) / span;
  const pts = points.map((p, i) => [x(i), y(p.value)] as [number, number]);
  const si = since ? points.findIndex((p) => p.period === since) : -1;
  const worst = points.reduce((m, p, i) => ((worseUp ? p.value > points[m].value : p.value < points[m].value) ? i : m), 0);
  return (
    <div ref={ref} className="pz-chart">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
        <line x1={pad.l} x2={w - pad.r} y1={y(baseline)} y2={y(baseline)} className="pz-rule pz-rule-good" />
        <text x={w - pad.r} y={y(baseline) - 5} textAnchor="end" className="pz-axis">usual {fmt(baseline)}</text>
        {si >= 0 && <line x1={x(si)} x2={x(si)} y1={pad.t - 6} y2={h - pad.b} className="pz-rule pz-rule-start" />}
        <path d={smooth(pts)} className="pz-line pz-line-reading" pathLength={1} />
        {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i === worst || i === pts.length - 1 ? 3.6 : 2} className={`pz-dot ${i === worst ? "pz-dot-bad" : i === pts.length - 1 ? "is-now pz-dot-ink" : "pz-dot-ink"}`} />)}
        <text x={Math.min(Math.max(pts[worst][0], 24), w - 24)} y={worseUp ? pts[worst][1] - 8 : pts[worst][1] + 15} textAnchor="middle" className="pz-marker-label strong">{fmt(points[worst].value)}</text>
        {points.map((p, i) => (i % 2 && i !== points.length - 1) ? null : <text key={p.period} x={x(i)} y={h - 6} textAnchor="middle" className="pz-axis">{shortMonth(p.period)}</text>)}
      </svg>
      <table className="pz-sr">
        <caption>{label}</caption>
        <tbody>{points.map((p) => <tr key={p.period}><td>{p.period}</td><td>{fmt(p.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

/** A heart-monitor trace: a symbol of the pulse, not data. It sweeps a few
 *  times at the rate of the condition, then rests fully drawn. */
export function Heartbeat({ tone, width = 220, height = 34, sweeps = 4 }: { tone: Tone | null; width?: number; height?: number; sweeps?: number }) {
  const m = height / 2, u = width / 2;
  const beat = (x0: number) => `L${x0 + u * 0.3},${m} L${x0 + u * 0.36},${m - 3} L${x0 + u * 0.42},${m} L${x0 + u * 0.5},${m} L${x0 + u * 0.54},${m + 4} L${x0 + u * 0.6},${2} L${x0 + u * 0.66},${height - 3} L${x0 + u * 0.71},${m} L${x0 + u * 0.82},${m} L${x0 + u * 0.88},${m - 5} L${x0 + u * 0.94},${m}`;
  const d = `M0,${m} ${beat(0)} L${u},${m} ${beat(u)} L${width},${m}`;
  const t = tone || "healthy";
  return (
    <svg className={`pz-heartbeat tone-${t}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
      style={{ ["--beat" as string]: `${Math.round(BEAT_MS[t] * 1.4)}ms`, ["--sweeps" as string]: sweeps }}>
      <path d={d} className="pz-heartbeat-track" />
      <path d={d} className="pz-heartbeat-line" pathLength={1} />
      <circle cx={width - 2} cy={m} r={3.2} className="pz-heartbeat-dot" />
    </svg>
  );
}
