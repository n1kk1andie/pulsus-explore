"use client";

// Explore: whole sectors read anonymously from public data. The figures are
// finished aggregates (lib/atlas/data); no engine and no method ship here. Layers (anonymous
// totals only, see lib/atlas) load when the screen opens.

import React, { useEffect, useMemo, useState } from "react";
/** Explore runs without an organisation: no model is ever passed. */
type PulseModel = { org: string; showcase: boolean };
import { ELSEWHERE, EVIDENCE, LAYERS, NEXT, SECTORS, evidenceOf, type Evidence, type SectorId } from "../lib/atlas/catalog";
import { countryGroup, type AtlasGroup, type AtlasLayer } from "../lib/atlas/layers";
import type { ExploreData } from "../lib/atlas/explore";
import { Compare, InsightsPanel, Locked, Search, groupsOf, type GroupRef } from "./ExploreTools";
import { HealthChart } from "./charts";
import { IGlobe, IInfo } from "./icons";

interface World { w: number; h: number; countries: { id: string; name: string; d: string }[] }
type Measure = "ohi" | "oh";

// A tile map of the United States: one square per state, in roughly its place.
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
/** A period as the layer reports it: a quarter, or a fiscal year for yearly layers. */
const when = (l: { cadence?: string }, p: string) => (l.cadence === "yearly" ? `FY${p.slice(0, 4)}` : quarter(p));
const n0 = (x: number) => x.toLocaleString("en-US");
const WORD: Record<Measure, string> = { ohi: "Organisational Health", oh: "Operational Health" };
const SECTOR_OVERVIEW: Record<SectorId, string> = { banks: "Banking sector overview", "credit-unions": "Credit union sector overview", insurance: "Insurance sector overview", government: "Government sector overview", hospitals: "Hospital sector overview", universities: "University sector overview" };
const SECTOR_NOUN: Record<SectorId, string> = { banks: "banks", "credit-unions": "credit unions", insurance: "insurers", government: "agencies", hospitals: "hospitals", universities: "universities" };

type Tab = "calibrate" | "explore";

// Calibrate · Explore. Calibrate places the organisation among peers; Explore
// is the sectors themselves (the map, countries, states and groups).
export default function AtlasScreen({ m, only, data: given, register = null }: { m?: PulseModel | null; only?: "explore"; data?: ExploreData; register?: string | null }) {
  const [tab, setTab] = useState<Tab>(() => only ?? (typeof window !== "undefined" && window.location.hash === "#explore" ? "explore" : "calibrate"));
  const [layers, setLayers] = useState<Record<string, AtlasLayer>>({});
  const [world, setWorld] = useState<World | null>(null);
  const [failed, setFailed] = useState(false);
  const [sector, setSector] = useState<SectorId>("banks");
  const [country, setCountry] = useState("840");
  const [measure, setMeasure] = useState<Measure>("ohi");
  const [state, setState] = useState<string | null>(null);
  // The layers arrive at this visitor's depth (lib/atlas/explore.ts): from the
  // page (the showcase), or from /api/explore, which knows who is asking.
  const [data, setData] = useState<ExploreData | null>(given ?? null);
  const [period, setPeriod] = useState<string | null>(null);   // null: the latest
  const [band, setBand] = useState<"" | "good" | "watch" | "bad">("");
  useEffect(() => {
    let live = true;
    const d = given ? Promise.resolve(given) : fetch("/api/explore", { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<ExploreData>; });
    Promise.all([import("../lib/atlas/world.json"), d])
      .then(([w, x]) => { if (!live) return; setWorld(((w as { default?: unknown }).default ?? w) as World); setData(x); setLayers(Object.fromEntries(x.layers.map((l) => [l.layer, l]))); })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [given]);
  const full = data?.depth === "full";

  const inSector = useMemo(() => LAYERS.filter((d) => d.sector === sector && layers[d.id]).map((d) => ({ def: d, l: layers[d.id] })), [layers, sector]);
  // Keep the chosen country if this sector covers it; else its first country.
  useEffect(() => {
    if (!inSector.length) return;
    if (!inSector.some(({ l }) => l.countries.includes(country))) setCountry(inSector[0].l.countries[0]);
    setState(null); setPeriod(null);
  }, [sector, inSector]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = null; // Explore only: no Calibrate tab here

  if (failed) return <>{tabs}<div className="pz-card pz-empty" role="alert"><IInfo size={24} /><p>The sector data could not be loaded. Try again in a moment.</p></div></>;
  if (!world || !Object.keys(layers).length) return <>{tabs}<div className="pz-loading" role="status"><span className="pz-ekg" aria-hidden="true"><IGlobe size={40} /></span><p>Loading the sector data</p></div></>;



  const b = Object.values(layers)[0].bands;
  // The periods this sector can be read at (registered: its whole history).
  const periods = [...new Set(inSector.flatMap(({ l }) => (l.national.trend || []).map((t) => t.period)))].sort();
  const at_ = period && periods.includes(period) ? period : null;
  /** A group's reading at the chosen period (its latest point at or before
   *  it), or now. */
  const val = (g: AtlasGroup | undefined, k: Measure): number | undefined => {
    if (!g || g.hidden) return undefined;
    if (!at_) return g[k];
    const t = (g.trend || []).filter((p) => p.period <= at_ && p[k] !== null);
    return t.length ? (t[t.length - 1][k] as number) : undefined;
  };
  const dim = (v: number | undefined, k: Measure) => (band && v !== undefined && tone(v, k) !== band ? " is-dim" : "");
  const place = (l: AtlasLayer, region: string) => (l.regionKind === "state" ? STATE_NAME[region] || region : world.countries.find((c) => c.id === region)?.name || region);
  const groups: GroupRef[] = groupsOf(layers, place);
  const pick = (layerId: string, region: string | null) => {
    const l = layers[layerId]; const def = LAYERS.find((d) => d.id === layerId);
    if (!l || !def) return;
    setSector(def.sector);
    if (l.regionKind === "state") { setCountry(l.countries[0]); setTimeout(() => setState(region), 0); }
    else if (region) setCountry(region);
    setTimeout(() => document.getElementById(l.regionKind === "state" && region ? "atlas-us-h" : "atlas-country-h")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  const regionName = (layerId: string, region: string, kind: "state" | "country") => {
    const def = LAYERS.find((d) => d.id === layerId);
    const where = kind === "state" ? STATE_NAME[region] || region : world.countries.find((c) => c.id === region)?.name || region;
    return `${where}: ${def ? SECTOR_NOUN[def.sector] : ""}`;
  };
  const tone = (v: number | undefined, k: Measure) => (v === undefined ? "none" : k === "ohi" ? (v >= b.ssiStable ? "good" : v >= b.ssiSteady ? "watch" : "bad") : (v >= b.ohiHealthy ? "good" : v >= b.ohiWatch ? "watch" : "bad"));
  const noun = SECTOR_NOUN[sector];
  // For the map: each country's reading in this sector (the first layer that covers it).
  const at = (iso: string) => { for (const { def, l } of inSector) { const g = countryGroup(l, iso); if (g) return { def, l, g }; } return null; };
  const here = at(country);
  const cname = world.countries.find((c) => c.id === country)?.name || "";
  const usLayer = here?.l.regionKind === "state" ? here.l : null;

  return (
    <>
    {tabs}
    <div className="pz-atlas" role="tabpanel" id="pz-panel-explore" aria-labelledby="pz-tab-explore">
      <section className="pz-card pz-atlas-intro">
        <p className="pz-eyebrow"><IGlobe size={14} /> Explore</p>
        <h2 className="pz-atlas-h">{m ? "The health of whole sectors, and where you stand in them." : "A free window on the world\u2019s sectors."}</h2>
        <p className="pz-muted">Public data on institutions, read by the same engine that reads {m?.showcase ? "the showcase organisation" : m ? "your organisation" : "an organisation\u2019s own data in Pulsus Platform"}. No institution is named and none can be singled out: only totals by region and size are shown.</p>
        <div className="pz-atlas-sectors" role="group" aria-label="Sector">
          {SECTORS.map((s) => (
            <button key={s.id} type="button" className={`pz-atlas-chip${s.status === "live" ? " is-live" : ""}`} aria-pressed={sector === s.id} disabled={s.status !== "live"}
              onClick={() => setSector(s.id)} title={s.status === "live" ? s.where : `Next: ${s.where}`}>
              {s.label}<small>{s.status === "live" ? s.where : "Next"}</small>
            </button>
          ))}
        </div>
        <EvidenceScale peers={[...new Set(inSector.map(({ def }) => def.evidence))]} />
      </section>

      <section className="pz-card pz-atlas-world" aria-labelledby="atlas-world-h">
        <div className="pz-card-head"><h2 id="atlas-world-h" className="pz-h3">{SECTORS.find((s) => s.id === sector)?.label} around the world</h2>
          <div className="pz-aseg" role="group" aria-label="Measure">
            {(["ohi", "oh"] as Measure[]).map((k) => <button key={k} type="button" aria-pressed={measure === k} onClick={() => setMeasure(k)}>{k === "ohi" ? "Organisational Health" : "Operational Health"}</button>)}
          </div>
        </div>
        <svg viewBox={`0 0 ${world.w} ${world.h}`} className="pz-atlas-map" role="group" aria-label={`World map: median ${WORD[measure]} of ${noun} by country`}>
          {world.countries.map((c) => {
            const r = at(c.id); const v = r ? val(r.g, measure) : undefined;
            const cls = r ? (v !== undefined ? `is-${tone(v, measure)}${dim(v, measure)}` : "is-live") : NEXT[c.id] ? "is-next" : "";
            return <path key={c.id + c.name} d={c.d} className={`${cls}${c.id === country ? " is-on" : ""}`} tabIndex={0} role="button" aria-pressed={c.id === country}
              aria-label={`${c.name}: ${r ? (v !== undefined ? `median ${v}, ${r.g.n} ${noun}` : `fewer than ${r.l.minGroup} ${noun} in the data`) : NEXT[c.id] ? "next" : "your own data"}`}
              onClick={() => setCountry(c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setCountry(c.id); } }}><title>{c.name}</title></path>;
          })}
        </svg>
        <div className="pz-xp-filters">
          <label><span className="pz-small pz-muted">Show</span>
            <select value={band} onChange={(e) => setBand(e.target.value as typeof band)} disabled={!full}>
              <option value="">Every band</option><option value="good">Stable only</option><option value="watch">Steady only</option><option value="bad">Fragile only</option>
            </select>
          </label>
          <label className="pz-xp-period"><span className="pz-small pz-muted">As at {at_ ? when(inSector[0]?.l || {}, at_) : "the latest"}</span>
            <input type="range" min={0} max={Math.max(0, periods.length - 1)} value={at_ ? periods.indexOf(at_) : Math.max(0, periods.length - 1)} disabled={!full || periods.length < 2}
              onChange={(e) => { const i = Number(e.target.value); setPeriod(i >= periods.length - 1 ? null : periods[i]); }} aria-label="Period" />
          </label>
        </div>
        {!full && <Locked register={register}>Filtering by band and moving back through five years of history come with free registration.</Locked>}
        <p className="pz-atlas-legend"><i className="is-good" />Stable<i className="is-watch" />Steady<i className="is-bad" />Fragile<i className="is-live" />Too few to show<i className="is-next" />Next<i />Your own data</p>
      </section>

      <Search groups={groups} full={full} onPick={(g) => pick(g.layerId, g.region)} />

      <CountryCard name={cname} here={here} noun={noun} country={country} measure={measure} full={full} register={register} />

      {usLayer && (
        <section className="pz-card pz-atlas-us" aria-labelledby="atlas-us-h">
          <div className="pz-card-head"><h2 id="atlas-us-h" className="pz-h3">{inSector.find(({ l }) => l === usLayer)?.def.title} by state</h2><span className="pz-muted pz-small">{when(usLayer, usLayer.asOf)}</span></div>
          <p className="pz-muted pz-small">Median {WORD[measure]} of the {noun} based in each state. Choose a state for its detail.</p>
          <div className="pz-atlas-tiles" role="group" aria-label={`US states coloured by median ${WORD[measure]}`}>
            {TILES.map(([s, x, y]) => {
              const g = usLayer.regions[s]; const v = val(g, measure);
              return (
                <button key={s} type="button" className={`pz-tile is-${tone(v, measure)}${dim(v, measure)}${state === s ? " is-on" : ""}`} style={{ gridColumn: x + 1, gridRow: y + 1 }}
                  aria-pressed={state === s} aria-label={`${STATE_NAME[s]}: ${g ? (g.hidden ? `fewer than ${usLayer.minGroup} ${noun}` : `${v}, ${g.n} ${noun}`) : `no ${noun}`}`} onClick={() => setState(state === s ? null : s)}>
                  <span>{s}</span><b>{v ?? "·"}</b>
                </button>
              );
            })}
          </div>
          <div className="pz-atlas-detail" aria-live="polite">
            {state && usLayer.regions[state] ? (usLayer.regions[state].hidden
              ? <p className="pz-small"><b>{STATE_NAME[state]}</b>: fewer than {usLayer.minGroup} {noun}, so not shown.</p>
              : <><p className="pz-small"><b>{STATE_NAME[state]}</b> · {usLayer.regions[state].n} {noun} · median Operational Health <b>{usLayer.regions[state].oh}</b> · median Organisational Health <b>{usLayer.regions[state].ohi}</b></p><Split s={usLayer.regions[state].split!} n={usLayer.regions[state].n} /></>)
              : <p className="pz-small pz-muted">Groups of fewer than {usLayer.minGroup} {noun} are not shown.</p>}
          </div>
        </section>
      )}

      {data && <InsightsPanel insights={data.insights} full={full} register={register} name={regionName} onPick={pick} />}
      <Compare groups={groups} full={full} measure={measure} register={register} />

      <section className="pz-card pz-atlas-layers" aria-labelledby="atlas-layers-h">
        <div className="pz-card-head"><h2 id="atlas-layers-h" className="pz-h3">{SECTOR_OVERVIEW[sector]}</h2></div>
        <div className="pz-atlas-tablewrap"><table className="pz-atlas-table">
          <thead><tr><th scope="col">Group</th><th scope="col">Count</th><th scope="col">Op. Health</th><th scope="col">Org. Health</th><th scope="col">As at</th><th scope="col">Evidence</th></tr></thead>
          <tbody>{inSector.map(({ def, l }) => (
            <tr key={def.id}><th scope="row">{def.title}</th><td>{n0(l.national.n)}</td><td className={`is-${tone(l.national.oh, "oh")}`}>{l.national.oh}</td><td className={`is-${tone(l.national.ohi, "ohi")}`}>{l.national.ohi}</td><td>{when(l, l.asOf)}</td><td><span className={`pz-ev-tag is-${def.evidence}`}>{evidenceOf(def.evidence).label}</span></td></tr>
          ))}</tbody>
        </table></div>
        <p className="pz-small pz-muted">Medians. {inSector.map(({ def, l }) => `${def.title}: ${l.source}, read from ${l.measures.length} public measures (${l.measures.join(", ").toLowerCase()}).`).join(" ")}</p>
      </section>

      <p className="pz-small pz-muted pz-atlas-foot">Each institution is read from public measures through the same engine as an organisation's own data. A reading of public figures, not a rating or advice. No institution is named.{m && only !== "explore" ? ` To see where ${m.org} stands, open Calibrate.` : ""}</p>
    </div>
    </>
  );
}

function CountryCard({ name, here, noun, country, measure, full, register }: { name: string; here: { def: { title: string; evidence: Evidence }; l: AtlasLayer; g: AtlasGroup } | null; noun: string; country: string; measure: Measure; full: boolean; register: string | null }) {
  if (!here) return <section className="pz-card pz-atlas-country"><p className="pz-small"><b>{name}</b> · {NEXT[country] || ELSEWHERE}</p></section>;
  const { def, l, g } = here;
  if (g.hidden) return <section className="pz-card pz-atlas-country"><p className="pz-small"><b>{name}</b> · {g.n} of {def.title.toLowerCase()} {g.n === 1 ? "is" : "are"} based here: fewer than {l.minGroup}, so not shown on {g.n === 1 ? "its" : "their"} own. {g.n === 1 ? "It is" : "They are"} included in the totals for {def.title.toLowerCase()}.</p></section>;
  const trend = g.trend || l.national.trend || [];
  return (
    <section className="pz-card pz-atlas-country" aria-labelledby="atlas-country-h">
      <div className="pz-card-head"><h2 id="atlas-country-h" className="pz-h3">{name}: {noun}</h2><span className="pz-muted pz-small">Medians · {when(l, l.asOf)}</span></div>
      <div className="pz-atlas-stats">
        <div><span className="pz-eyebrow">{noun}</span><b>{n0(g.n)}</b></div>
        <div><span className="pz-eyebrow">Op. Health</span><b>{g.oh}</b></div>
        <div><span className="pz-eyebrow">Org. Health</span><b>{g.ohi}</b></div>
      </div>
      {g.split && <Split s={g.split} n={g.n} />}
      {trend.length > 1 && (
        <>
          <HealthChart compact label={`Median ${WORD[measure]} of ${noun} in ${name}, by quarter`} thresholds={measure === "ohi" ? [l.bands.ssiStable, l.bands.ssiSteady] : [l.bands.ohiHealthy, l.bands.ohiWatch]}
            points={trend.map((t) => ({ period: t.period, score: t[measure] }))} firstLabel={`Median ${WORD[measure]}`}
            tick={l.cadence === "yearly" ? (p: string) => `FY${p.slice(2, 4)}` : undefined} />
          <p className="pz-atlas-key"><span>Median {WORD[measure]}</span><span>{when(l, trend[0].period)} – {when(l, trend[trend.length - 1].period)}</span></p>
        </>
      )}
      {!full && <Locked register={register}>How this has moved, quarter by quarter, comes with free registration.</Locked>}
      <p className="pz-small pz-muted">{def.title}{l.regionKind === "country" && l.countries.length > 1 ? ` based in ${name}` : ""}. Source: {l.source}.</p>
      <p className="pz-small"><span className={`pz-ev-tag is-${def.evidence}`}>{evidenceOf(def.evidence).label}</span> <span className="pz-muted">{evidenceOf(def.evidence).text}</span></p>
    </section>
  );
}

function Split({ s, n }: { s: { stable: number; steady: number; fragile: number }; n: number }) {
  const pct = (x: number) => `${(100 * x) / n}%`;
  return (
    <div className="pz-atlas-split">
      <div className="pz-atlas-bar" aria-hidden="true"><i className="is-good" style={{ width: pct(s.stable) }} /><i className="is-watch" style={{ width: pct(s.steady) }} /><i className="is-bad" style={{ width: pct(s.fragile) }} /></div>
      <p className="pz-small"><span className="pz-adot is-good" />Stable {Math.round((100 * s.stable) / n)}% <span className="pz-adot is-watch" />Steady {Math.round((100 * s.steady) / n)}% <span className="pz-adot is-bad" />Fragile {Math.round((100 * s.fragile) / n)}%</p>
    </div>
  );
}

function EvidenceScale({ peers }: { peers: Evidence[] }) {
  return (
    <div className="pz-ev-scale" role="list" aria-label="Depth of evidence">
      {EVIDENCE.map((e, i) => (
        <div key={e.id} role="listitem" className={`pz-ev-step is-${e.id}${peers.includes(e.id) || e.id === "operational-full" ? " is-on" : ""}`}>
          <span className="pz-ev-n">{i + 1}</span>
          <b>{e.label}</b>
          <small>{e.id === "operational-full" ? "Your own data" : peers.includes(e.id) ? "This sector's public data" : "Not in this sector"}</small>
          <p>{e.text}</p>
        </div>
      ))}
    </div>
  );
}
