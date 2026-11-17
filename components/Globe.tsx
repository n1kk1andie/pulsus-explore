"use client";
// The Technology page's globe: the world's land as dots (lib/atlas/globe-dots.json,
// Natural Earth, public domain), turning slowly while it is on screen. Drag to spin it;
// the places Explore covers glow, and each has a pulsing marker: tap one for its figures.
import React, { useEffect, useRef, useState } from "react";
import dotsFile from "../lib/atlas/globe-dots.json";

export interface GlobePlace { id: string; label: string; sub: string; isos: string[]; /** Label on the left of the marker, where two places sit close. */ left?: boolean }

const R = Math.PI / 180;
const DOTS = (dotsFile as unknown as { dots: [number, number, string][] }).dots;
const TILT = 20;    // the globe leans a little, so the northern hemisphere faces the reader

export default function Globe({ places, mapHref = "/" }: { places: GlobePlace[]; mapHref?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rot = useRef(45);                  // the longitude facing the reader (rot = −lon): starts on the Atlantic, the Americas and Europe both in view
  const drag = useRef<{ x: number; r: number; moved: boolean } | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [marks, setMarks] = useState<{ id: string; x: number; y: number; front: boolean }[]>([]);

  // Each place's marker sits at the middle of its dots.
  const centres = useRef(places.map((p) => {
    const ds = DOTS.filter((d) => p.isos.includes(d[2]));
    if (!ds.length) return null;
    // Average on the sphere, so places that cross the date line still land where they should.
    let x = 0, y = 0, z = 0;
    for (const [la, lo] of ds) { x += Math.cos(la * R) * Math.cos(lo * R); y += Math.cos(la * R) * Math.sin(lo * R); z += Math.sin(la * R); }
    return { id: p.id, lat: Math.atan2(z, Math.hypot(x, y)) / R, lon: Math.atan2(y, x) / R };
  }).filter(Boolean) as { id: string; lat: number; lon: number }[]);
  const covered = useRef(new Set(places.flatMap((p) => p.isos)));

  useEffect(() => {
    const cv = canvas.current, box = wrap.current;
    if (!cv || !box) return;
    const g = cv.getContext("2d");
    if (!g) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, on = true, last = performance.now(), size = 0, dpr = 1;
    const resize = () => { size = box.clientWidth; dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = size * dpr; cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(box);
    const io = new IntersectionObserver((es) => { on = es.some((e) => e.isIntersecting); }, { threshold: 0.05 });
    io.observe(box);
    const css = (v: string, f: string) => getComputedStyle(box).getPropertyValue(v).trim() || f;

    // Orthographic: a point's place on the disc, and whether it faces the reader.
    const toScreen = (lat: number, lon: number, rad: number, c: number) => {
      const l = (lon + rot.current) * R, p = lat * R, t = TILT * R;
      const x = Math.cos(p) * Math.sin(l);
      const y0 = Math.sin(p), z0 = Math.cos(p) * Math.cos(l);
      const y = y0 * Math.cos(t) - z0 * Math.sin(t), z = y0 * Math.sin(t) + z0 * Math.cos(t);
      return { x: c + x * rad, y: c - y * rad, z };
    };

    let tick = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!on) { last = now; return; }
      const dt = Math.min(64, now - last); last = now;
      if (!still && !drag.current) rot.current += dt * 0.006;
      const c = size / 2, rad = size * 0.46;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, size);
      // The atmosphere, then the sphere.
      const halo = g.createRadialGradient(c, c, rad * 0.9, c, c, rad * 1.12);
      halo.addColorStop(0, css("--gl-halo", "rgba(90,140,255,.35)")); halo.addColorStop(1, "rgba(90,140,255,0)");
      g.fillStyle = halo; g.beginPath(); g.arc(c, c, rad * 1.12, 0, Math.PI * 2); g.fill();
      const body = g.createRadialGradient(c - rad * 0.35, c - rad * 0.4, rad * 0.1, c, c, rad);
      body.addColorStop(0, css("--gl-sea-hi", "#1b2a6b")); body.addColorStop(1, css("--gl-sea", "#0a1236"));
      g.fillStyle = body; g.beginPath(); g.arc(c, c, rad, 0, Math.PI * 2); g.fill();
      // The land: dots, larger and brighter towards the reader; the covered places glow.
      const land = css("--gl-land", "#c9d6ff"), lit = css("--gl-lit", "#ffffff");
      const ds = Math.max(1, size / 340);
      for (const [la, lo, id] of DOTS) {
        const s = toScreen(la, lo, rad, c);
        if (s.z <= 0.02) continue;
        const on = covered.current.has(id);
        g.globalAlpha = on ? 0.6 + 0.4 * s.z : 0.12 + 0.3 * s.z;
        g.fillStyle = on ? lit : land;
        g.beginPath(); g.arc(s.x, s.y, ds * (on ? 1.25 : 0.95) * (0.6 + 0.4 * s.z), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      // The markers' places, for the buttons laid over the canvas (a few times a second is enough).
      if (++tick % 6 === 0) setMarks(centres.current.map((m) => { const s = toScreen(m.lat, m.lon, rad, c); return { id: m.id, x: s.x, y: s.y, front: s.z > 0.12 }; }));
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);

  const down = (e: React.PointerEvent) => { drag.current = { x: e.clientX, r: rot.current, moved: false }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const dx = e.clientX - d.x; if (Math.abs(dx) > 3) d.moved = true; rot.current = d.r + dx * 0.35; };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => { if (e.key === "ArrowLeft") rot.current -= 12; if (e.key === "ArrowRight") rot.current += 12; };
  const chosen = places.find((p) => p.id === pick);

  return (
    <div className="gl" ref={wrap}>
      <canvas ref={canvas} className="gl-canvas" role="img" tabIndex={0} onKeyDown={key}
        aria-label={`A globe of the places Pulsus Explore covers: ${places.map((p) => p.label).join(", ")}. Drag, or use the arrow keys, to turn it.`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
      {marks.map((m) => {
        const p = places.find((x) => x.id === m.id)!;
        return (
          <button key={m.id} type="button" className={`gl-mark${p.left ? " is-left" : ""}${m.front ? "" : " is-back"}${pick === m.id ? " is-on" : ""}`} style={{ left: m.x, top: m.y }}
            tabIndex={m.front ? 0 : -1} aria-hidden={!m.front} aria-label={`${p.label}: ${p.sub}`} onClick={() => setPick(pick === m.id ? null : m.id)}>
            <i /><span>{p.label}</span>
          </button>
        );
      })}
      {chosen && (
        <div className="gl-card" role="status">
          <b>{chosen.label}</b><span>{chosen.sub}</span>
          <a href={mapHref}>Open on the map →</a>
          <button type="button" className="gl-x" onClick={() => setPick(null)} aria-label="Close">×</button>
        </div>
      )}
      <p className="gl-hint">Drag to turn · tap a red marker</p>
    </div>
  );
}
