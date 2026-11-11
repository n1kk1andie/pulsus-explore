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
const ROLES: [string, string][] = [["executive", "Executive or board"], ["operations", "Operations"], ["compliance_risk", "Compliance or risk"], ["it", "Technology"], ["other", "Something else"]];

/** Subscribe for updates: new sectors, new countries and the quarterly
 *  figures. Kept by Pulsus Platform's lead store; nothing is kept here. */
function Subscribe() {
  const started = React.useRef(Date.now());
  const [f, setF] = useState({ name: "", email: "", company: "", role: "", country: "", consent: false, website: "" });
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setState("sending"); setMsg("");
    try {
      const r = await fetch(`${PLATFORM}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "platform", name: f.name, email: f.email, company: f.company, role: f.role, country: f.country, consent: f.consent, website: f.website, elapsedMs: Date.now() - started.current, letters: "Pulsus Explore: subscribe to updates" }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setState("done"); return; }
      setState("error");
      setMsg(r.status === 429 ? "Too many tries just now. Please try again later." : j.error === "bad_email" ? "That email address doesn't look right." : "That didn't go through. Check each field and try again.");
    } catch { setState("error"); setMsg("You seem to be offline. Try again when you have a connection."); }
  };
  if (state === "done") return <p className="pz-xp-sub-done" role="status">Thank you. You&apos;re subscribed: we&apos;ll write when there are new sectors, countries or quarterly figures.</p>;
  return (
    <form className="pz-form pz-xp-sub" onSubmit={submit}>
      <label>Name<input required value={f.name} onChange={set("name")} autoComplete="name" maxLength={120} /></label>
      <label>Email<input required type="email" value={f.email} onChange={set("email")} autoComplete="email" maxLength={254} /></label>
      <label>Organisation<input required value={f.company} onChange={set("company")} autoComplete="organization" maxLength={160} placeholder="Where you work, or Independent" /></label>
      <label>Role<select required value={f.role} onChange={set("role")}><option value="" disabled>Choose</option>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Country<input required value={f.country} onChange={set("country")} autoComplete="country-name" maxLength={80} /></label>
      <label className="pz-xp-hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
      <label className="pz-check"><input type="checkbox" required checked={f.consent} onChange={set("consent")} /><span>Email me updates about Pulsus Explore and Pulsus Platform. I can ask to stop at any time (see <a className="pz-link-btn" href="/privacy">Privacy</a>).</span></label>
      <div className="pz-row"><button className="pz-btn" disabled={state === "sending"}>{state === "sending" ? "Subscribing" : "Subscribe"}</button>{msg && <span className="pz-small" role="alert">{msg}</span>}</div>
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
          <p className="pz-muted">New sectors, new countries and each quarter&apos;s figures, by email. No account needed.</p>
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
