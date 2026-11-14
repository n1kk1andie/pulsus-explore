"use client";

// Day or night, for pages outside the map: the same choice the app keeps
// (localStorage "pz-theme", set on <html data-pz-theme> before first paint by
// app/layout.tsx). Until the reader chooses, the device's own setting.
import { useEffect, useState } from "react";

const SUN = "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4";
const MOON = "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z";

export default function ThemeSwitch({ className }: { className?: string }) {
  const [t, setT] = useState<"light" | "dark" | null>(null);
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
  const label = t === "dark" ? "Switch to day" : "Switch to night";
  return (
    <button type="button" className={className} onClick={toggle} aria-label={label} title={label} disabled={t === null}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={t === "dark" ? SUN : MOON} /></svg>
      <span>{t === "dark" ? "Day" : "Night"}</span>
    </button>
  );
}
