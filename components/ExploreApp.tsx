"use client";

// Pulsus Explore: a free window on the world's sectors. No sign-in, no
// organisation, no personal data. Its one way out is "Connect your
// organisation to see yours", which leads to Pulsus Platform for businesses.

import React, { useEffect, useState } from "react";
import AtlasScreen from "./AtlasScreen";
import type { ExploreData } from "../lib/atlas/explore";
import { IGlobe, IMoon, ISun } from "./icons";

const ABOUT = "https://about.pulsus.tech";

function useTheme(): ["light" | "dark", () => void] {
  const [t, setT] = useState<"light" | "dark">("light");
  useEffect(() => {
    const cur = document.documentElement.dataset.pzTheme;
    setT(cur === "dark" || cur === "light" ? cur : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const toggle = () => {
    const next = t === "dark" ? "light" : "dark";
    document.documentElement.dataset.pzTheme = next;
    try { localStorage.setItem("pz-theme", next); } catch { /* storage blocked */ }
    setT(next);
  };
  return [t, toggle];
}

export default function ExploreApp({ data, platformUrl }: { data: ExploreData; platformUrl: string | null }) {
  const [theme, toggleTheme] = useTheme();
  return (
    <div className="pz pz-xp-page">
      <header className="pz-top pz-xp-top">
        <a className="pz-brand" href="/" aria-label="Pulsus Explore">
          <span className="pz-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pz-logo-day" src="/pulsus-platform-logo.png" alt="Pulsus" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pz-logo-night" src="/pulsus-platform-logo-light.png" alt="Pulsus" />
          </span>
        </a>
        <span className="pz-xp-tagline pz-muted pz-small"><IGlobe size={14} /> Explore</span>
        <nav className="pz-xp-auth" aria-label="More">
          <button className="pz-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <ISun size={18} /> : <IMoon size={18} />}
          </button>
        </nav>
      </header>
      <a className="pz-xp-banner" href="#connect">A free window on the world. <b>Connect your organisation to see yours</b> →</a>
      <main className="pz-main pz-xp-main" id="pz-main">
        <AtlasScreen only="explore" data={data} />
        <section className="pz-card pz-xp-cta" id="connect" aria-labelledby="xp-connect-h">
          <p className="pz-eyebrow">Your organisation</p>
          <h2 id="xp-connect-h" className="pz-atlas-h">Connect your organisation to see yours.</h2>
          <p className="pz-muted">Explore is a free window on the world, read from public data. Pulsus Platform reads an organisation from its own systems the same way: Operational Intelligence shows what needs attention today; Executive Intelligence adds the diagnosis, treatments, recovery and where it stands among these peers; Oversight Intelligence watches over many organisations at once.</p>
          <div className="pz-row">
            {platformUrl && <a className="pz-btn" href={`${platformUrl.replace(/\/+$/, "")}/signup?product=platform`}>Start a 14-day trial</a>}
            <a className="pz-link-btn" href={`${ABOUT}/walkthrough/`}>Talk to us</a>
            <a className="pz-link-btn" href={ABOUT}>About Pulsus Platform</a>
          </div>
        </section>
        <footer className="pz-footer">
          <p className="pz-footer-line"><span className="pz-line-sign">Live. <span className="pz-signal">Signal.</span> Clarity.</span></p>
          <p>Pulsus Explore · Tumblehill Labs, a product studio of Tumblehill Holdings</p>
          <p>© 2026 Tumblehill Holdings LLC · All Rights Reserved</p>
          <p><a className="pz-link-btn" href="/privacy">Privacy</a> · A reading of public figures, not a rating or advice.</p>
        </footer>
      </main>
    </div>
  );
}
