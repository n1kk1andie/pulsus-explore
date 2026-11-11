"use client";

// Pulsus Explore: a free window on the world's sectors. No sign-in, no
// organisation, no personal data. Its one way out is "Connect your
// organisation to see yours", which leads to Pulsus Platform for businesses.

import React, { useEffect, useState } from "react";
import AtlasScreen from "./AtlasScreen";
import type { ExploreData } from "../lib/atlas/explore";
import { IGlobe, IMoon, ISun } from "./icons";

const ABOUT = "https://about.pulsus.tech";
/** Pulsus Platform: where subscriptions are kept and businesses start. */
export const PLATFORM = (process.env.NEXT_PUBLIC_PLATFORM_URL || "https://executive.pulsus.tech").replace(/\/+$/, "");

/** Subscribe for updates: just an email address. Kept by Pulsus Platform's
 *  lead store (operator console, Leads); nothing is kept here. */
function Subscribe() {
  const started = React.useRef(Date.now());
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");   // a field people never see: bots fill it
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState("sending"); setMsg("");
    try {
      const r = await fetch(`${PLATFORM}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "subscribe", email, consent: true, website, elapsedMs: Date.now() - started.current }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setState("done"); return; }
      setState("error");
      setMsg(r.status === 429 ? "Too many tries just now. Please try again later." : "That email address doesn't look right.");
    } catch { setState("error"); setMsg("You seem to be offline. Try again when you have a connection."); }
  };
  if (state === "done") return <p className="pz-xp-sub-done" role="status">Thank you, you&apos;re subscribed.</p>;
  return (
    <form className="pz-xp-sub" onSubmit={submit}>
      <label className="pz-sr" htmlFor="xp-sub-email">Email</label>
      <input id="xp-sub-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} placeholder="Your email address" />
      <input className="pz-xp-hp" aria-hidden="true" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <button className="pz-btn" disabled={state === "sending"}>{state === "sending" ? "Subscribing" : "Subscribe"}</button>
      <p className="pz-small pz-muted pz-xp-sub-note">{msg ? <span role="alert">{msg}</span> : <>Updates on new sectors and quarterly figures. Unsubscribe any time; see <a className="pz-link-btn" href="/privacy">Privacy</a>.</>}</p>
    </form>
  );
}

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
        <section className="pz-card pz-xp-cta" id="subscribe" aria-labelledby="xp-sub-h">
          <p className="pz-eyebrow">Stay in touch</p>
          <h2 id="xp-sub-h" className="pz-h3">Subscribe for updates</h2>
          <Subscribe />
        </section>
        <section className="pz-card pz-xp-cta" id="connect" aria-labelledby="xp-connect-h">
          <p className="pz-eyebrow">Your organisation</p>
          <h2 id="xp-connect-h" className="pz-atlas-h">Connect your organisation to see yours.</h2>
          <p className="pz-muted">Explore is a free window on the world, read from public data. Pulsus Platform reads an organisation from its own systems the same way: Operational Intelligence shows what needs attention today; Executive Intelligence adds the diagnosis, treatments, recovery and where it stands among these peers; Oversight Intelligence watches over many organisations at once.</p>
          <div className="pz-row">
            <a className="pz-btn" href={`${(platformUrl || PLATFORM).replace(/\/+$/, "")}/signup?product=platform`}>Start a 14-day trial</a>
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
