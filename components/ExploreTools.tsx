"use client";

// Explore's tools: search, movers and hotspots, and group comparison. Every
// result is a group (a sector in a country or state, or a size band), never an
// institution. What a visitor sees depends on the depth they were sent
// (lib/atlas/explore.ts): a preview gets search and a teaser; registered
// users get everything.

import React, { useMemo, useState } from "react";
import type { AtlasGroup, AtlasLayer } from "../lib/atlas/layers";
import type { Insights, Mover, Hotspot } from "../lib/atlas/explore";
import { LAYERS } from "../lib/atlas/catalog";
import { Spark } from "./charts";
import { ISearch, IUp, IDown, IUnwell, IClose } from "./icons";

export interface GroupRef { key: string; layerId: string; sector: string; region: string | null; label: string; place: string; g: AtlasGroup; l: AtlasLayer }
type Measure = "ohi" | "oh";
const WORD: Record<Measure, string> = { ohi: "Organisational Health", oh: "Operational Health" };

/** Every group a visitor can find or compare: each layer as a whole, and each
 *  of its regions big enough to show. */
export function groupsOf(layers: Record<string, AtlasLayer>, place: (l: AtlasLayer, region: string) => string): GroupRef[] {
  const out: GroupRef[] = [];
  for (const def of LAYERS) {
    const l = layers[def.id];
    if (!l) continue;
    out.push({ key: def.id, layerId: def.id, sector: def.sector, region: null, label: def.title, place: "", g: l.national, l });
    for (const [region, g] of Object.entries(l.regions)) {
      if (g.hidden) continue;
      const p = place(l, region);
      if (l.regionKind === "country" && l.countries.length === 1) continue; // the layer itself
      out.push({ key: `${def.id}:${region}`, layerId: def.id, sector: def.sector, region, label: `${def.title}: ${p}`, place: p, g, l });
    }
  }
  return out;
}

export function Locked({ register, children }: { register: string | null; children: React.ReactNode }) {
  return (
    <p className="pz-xp-lock pz-small">
      <span>{children}</span>
      {register && <a className="pz-btn pz-btn-sm" href={register}>Register free</a>}
    </p>
  );
}

export function Search({ groups, full, onPick }: { groups: GroupRef[]; full: boolean; onPick: (g: GroupRef) => void }) {
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const words = t.split(/\s+/);
    return groups.filter((g) => (full || !g.region || g.l.regionKind === "country") && words.every((w) => g.label.toLowerCase().includes(w) || g.sector.includes(w))).slice(0, 8);
  }, [q, groups, full]);
  return (
    <div className="pz-xp-search">
      <label className="pz-xp-searchbox"><ISearch size={16} /><span className="pz-sr">Search places and sectors</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={full ? "Search: e.g. credit unions Texas, banks Germany" : "Search: e.g. banks Germany"} />
      </label>
      {hits.length > 0 && (
        <ul className="pz-xp-hits" role="listbox" aria-label="Matching groups">
          {hits.map((h) => (
            <li key={h.key}><button type="button" onClick={() => { onPick(h); setQ(""); }}>
              <strong>{h.label}</strong><span className="pz-muted pz-small"> · {h.g.n.toLocaleString("en-US")} · Org. Health {h.g.ohi ?? "—"}</span>
            </button></li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !hits.length && <p className="pz-small pz-muted">No group matches{full ? "" : " (states are searchable after free registration)"}.</p>}
    </div>
  );
}

const pts = (n: number) => `${n > 0 ? "+" : ""}${n}`;

export function InsightsPanel({ insights, full, register, name, onPick }: {
  insights: Insights; full: boolean; register: string | null;
  name: (layerId: string, region: string, kind: "state" | "country") => string;
  onPick: (layerId: string, region: string) => void;
}) {
  const row = (m: Mover) => (
    <li key={`${m.layer}:${m.region}`}><button type="button" onClick={() => onPick(m.layer, m.region)}>
      <span>{name(m.layer, m.region, m.regionKind)}</span>
      <b className={m.change > 0 ? "is-good" : "is-bad"}>{m.change > 0 ? <IUp size={12} /> : <IDown size={12} />} {pts(m.change)}</b>
      <span className="pz-muted pz-small">{m.from} → {m.to}</span>
    </button></li>
  );
  const hot = (h: Hotspot) => (
    <li key={`${h.layer}:${h.region}`}><button type="button" onClick={() => onPick(h.layer, h.region)}>
      <span>{name(h.layer, h.region, h.regionKind)}</span>
      <b className="is-bad"><IUnwell size={12} /> {h.share}%</b>
      <span className="pz-muted pz-small">{h.fragile} of {h.n} Fragile</span>
    </button></li>
  );
  const more = insights.more.up + insights.more.down + insights.more.hotspots;
  return (
    <section className="pz-card pz-xp-insights" aria-labelledby="xp-ins-h">
      <div className="pz-card-head"><h2 id="xp-ins-h" className="pz-h3">Movers and areas to watch</h2><span className="pz-muted pz-small">Organisational Health, over the last year</span></div>
      <div className="pz-xp-cols">
        <div><h3 className="pz-eyebrow">Improving Indicators</h3><ol className="pz-xp-list">{insights.up.map(row)}</ol>{!insights.up.length && <p className="pz-small pz-muted">None yet.</p>}</div>
        <div><h3 className="pz-eyebrow">Declining Indicators</h3><ol className="pz-xp-list">{insights.down.map(row)}</ol>{!insights.down.length && <p className="pz-small pz-muted">None yet.</p>}</div>
        <div><h3 className="pz-eyebrow">Areas to Watch</h3><ol className="pz-xp-list">{insights.hotspots.map(hot)}</ol>{!insights.hotspots.length && <p className="pz-small pz-muted">None.</p>}</div>
      </div>
      {!full && more > 0 && <Locked register={register}>The top three of each are shown. {more} more, and five years of history behind them, after free registration.</Locked>}
    </section>
  );
}

export function Compare({ groups, full, measure, register }: { groups: GroupRef[]; full: boolean; measure: Measure; register: string | null }) {
  const [picked, setPicked] = useState<string[]>([]);
  const options = groups.filter((g) => !picked.includes(g.key));
  const rows = picked.map((k) => groups.find((g) => g.key === k)).filter((g): g is GroupRef => !!g);
  if (!full) return (
    <section className="pz-card pz-xp-compare" aria-labelledby="xp-cmp-h">
      <div className="pz-card-head"><h2 id="xp-cmp-h" className="pz-h3">Compare groups</h2></div>
      <Locked register={register}>Put up to four groups side by side (for example Texas banks against Florida banks, or US credit unions against Europe&apos;s large banks), with their history. Free with registration.</Locked>
    </section>
  );
  return (
    <section className="pz-card pz-xp-compare" aria-labelledby="xp-cmp-h">
      <div className="pz-card-head"><h2 id="xp-cmp-h" className="pz-h3">Compare groups</h2><span className="pz-muted pz-small">Up to four</span></div>
      {picked.length < 4 && (
        <label className="pz-xp-add"><span className="pz-small pz-muted">Add a group</span>
          <select value="" onChange={(e) => { if (e.target.value) setPicked([...picked, e.target.value]); }}>
            <option value="">Choose…</option>
            {options.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </label>
      )}
      {rows.length === 0 ? <p className="pz-small pz-muted">Choose groups to compare their medians, the Stable / Steady / Fragile split and their history.</p> : (
        <div className="pz-atlas-tablewrap"><table className="pz-atlas-table pz-xp-table">
          <thead><tr><th scope="col">Group</th><th scope="col">Count</th><th scope="col">Op. Health</th><th scope="col">Org. Health</th><th scope="col">Fragile</th><th scope="col">{WORD[measure]}, history</th><th scope="col"><span className="pz-sr">Remove</span></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              <td>{r.g.n.toLocaleString("en-US")}</td><td>{r.g.oh ?? "—"}</td><td>{r.g.ohi ?? "—"}</td>
              <td>{r.g.split ? `${Math.round((100 * r.g.split.fragile) / r.g.n)}%` : "—"}</td>
              <td className="pz-xp-spark"><Spark values={(r.g.trend || []).map((t) => t[measure])} domain={[0, 100]} label={`${r.label}: ${WORD[measure]} over time`} /></td>
              <td><button type="button" className="pz-icon-btn pz-icon-btn-sm" aria-label={`Remove ${r.label}`} onClick={() => setPicked(picked.filter((k) => k !== r.key))}><IClose size={14} /></button></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
