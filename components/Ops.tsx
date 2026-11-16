"use client";

// Operational Health on Explore's cards: a named institution's score with each
// indicator, its source and period, and the publisher's own caveat; and a
// place's median, shown only with enough scored institutions. The method is
// lib/atlas/operational.ts; /methodology explains it in full.

import React from "react";
import { INDICATORS, MIN_COMPLAINTS, OPS_MIN_GROUP, OPS_SOURCES, opsGroup, scoreOf, type IndicatorId, type OpsGroup, type OpsInstitution, type SourceId } from "../lib/atlas/operational";
import { BAND_LABEL, SHOW_MIN, bandOf, canRank, sampleText } from "../lib/atlas/bands";

export interface OpsData { institutions: OpsInstitution[]; built: string }

/** The same continuous scale as Organisational Health: red at 0, amber at 50, green at 100. */
export const shade = (v: number) => {
  const x = Math.max(0, Math.min(100, v));
  return x <= 50 ? `color-mix(in oklab, var(--watch) ${x * 2}%, var(--bad))` : `color-mix(in oklab, var(--good) ${(x - 50) * 2}%, var(--watch))`;
};
export const COUNTRY: Record<string, string> = { "840": "United States", "826": "United Kingdom" };
const ONE: Record<string, string> = { banks: "bank", "credit-unions": "credit union", insurance: "insurer" };
const MANY: Record<string, string> = { banks: "banks", "credit-unions": "credit unions", insurance: "insurers", all: "institutions" };
export const groupWord = (country: string, sector: string | null) => `${country === "840" ? "US" : "UK"} ${MANY[sector || "all"]}`;
export const srcOf = (id: SourceId) => OPS_SOURCES.find((s) => s.id === id)!;
/** Shown wherever a score is: US and UK scores are never ranked or compared with each other. */
export const SAME_COUNTRY = "Scores compare institutions within the same country only.";
/** The label for a group's median, with its real count. */
export const medianLabel = (n: number) => `median of the ${n.toLocaleString("en-US")} ${n === 1 ? "institution" : "institutions"} with a score`;
const UPHELD_LABEL = "Complaints upheld by the firm";
const UPHELD_NOTE = "Shown for information, not scored: a firm that rejects more complaints would otherwise score higher.";

/** An indicator's name for each source: the measures differ a little between publishers. */
export function indLabel(id: IndicatorId, src: SourceId): string {
  if (id === "rate") return src === "cfpb" ? "Complaints received per $1bn of total assets, a year" : "Complaints opened per 1,000 accounts or policies, half-year";
  if (id === "timely") return src === "cfpb" ? "Complaints with a timely company response" : "Complaints closed within 8 weeks";
  return "Scam losses reimbursed";
}
export const fmtInd = (id: IndicatorId, v: number) => (id === "rate" ? (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) : `${v.toFixed(1)}%`);

function Caveat({ src }: { src: SourceId }) {
  const s = srcOf(src);
  return (
    <div className="xa-ops-cav">
      <p className="xa-label">The publisher&apos;s caveat</p>
      <blockquote>{s.caveat}</blockquote>
      <p className="xa-src-line">{s.attribution} <a href={s.licenceUrl}>{s.licence}</a> · <a href={s.url}>{s.dataset}</a></p>
    </div>
  );
}

/** The score, large, or a dash with its reason; the upheld rate beside it, not scored. */
function Score({ v, reason, upheld, upheldWord }: { v: number | null; reason?: string; upheld?: number; upheldWord?: string }) {
  return (
    <div className="xa-ops-score">
      <dt>Operational Health</dt>
      <dd>{v === null ? <b className="xa-dash">—</b> : <><b style={{ color: shade(v) }}>{v}</b><span>/100</span></>}</dd>
      <p>{v === null ? reason : "From published complaints data: how many are received relative to size, and how quickly they are handled."} {SAME_COUNTRY}</p>
      {upheld !== undefined && <p className="xa-ops-upheld"><b>{UPHELD_LABEL}{upheldWord ? ` (${upheldWord})` : ""}: {upheld.toFixed(1)}%</b> · {UPHELD_NOTE}</p>}
    </div>
  );
}

export function InstitutionCard({ i, all, onClose, onPlace }: { i: OpsInstitution; all: OpsInstitution[]; onClose: () => void; onPlace: () => void }) {
  const s = scoreOf(i);
  const g = opsGroup(all, i.country, i.sector);
  const src = srcOf(i.source);
  return (
    <div className="xa-card-in">
      <div className="xa-card-h"><h2>{i.name}</h2><button className="xa-x" onClick={onClose} aria-label="Close">×</button></div>
      <p className="xa-sub">{COUNTRY[i.country]} · {ONE[i.sector]}{i.id ? ` · ${i.idKind} ${i.id}` : ""}{i.group && i.group.toLowerCase() !== i.name.toLowerCase() ? ` · group: ${i.group}` : ""}</p>
      <dl className="xa-measures">
        <Score v={s.score} reason={s.reason} upheld={i.upheld} />
        <div><dt>Organisational Health</dt><dd><b className="xa-dash">—</b></dd><p>Financial condition is shown for places, not for single institutions, in Explore. The two measures are kept apart.</p></div>
      </dl>
      <div className="xa-ind">
        <p className="xa-label">Operational indicators · {i.period}</p>
        <table className="xa-ops-t">
          <thead><tr><th>Indicator</th><th>Value</th><th>Reads as</th><th>Weight</th></tr></thead>
          <tbody>
            {s.parts.map((p) => <tr key={p.id}><td>{indLabel(p.id, i.source)}</td><td>{fmtInd(p.id, p.value)}</td><td>{Math.round(p.sub)}</td><td>{Math.round(p.weight)}%</td></tr>)}
            {INDICATORS.filter((d) => !s.parts.some((p) => p.id === d.id)).map((d) => <tr key={d.id} className="is-none"><td>{indLabel(d.id, i.source)}</td><td colSpan={3}>{d.id === "scam" ? "No free per-firm source" : "Not published for this firm"}</td></tr>)}
          </tbody>
        </table>
        {i.size && <p className="xa-src-line">Size measure: {i.size.label}, {i.size.unit === "USD millions" ? `$${(i.size.value / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}bn` : i.size.value.toLocaleString("en-US")} ({i.size.source}).</p>}
        {i.context && i.context.length > 0 && (
          <>
            <p className="xa-label xa-ctx-h">Shown for context, not part of the score</p>
            <dl>{i.context.map((c) => <div key={c.label}><dt>{c.label}</dt><dd>{c.value}</dd></div>)}</dl>
          </>
        )}
        <p className="xa-src-line">Source: {src.publisher}, {src.dataset} · {i.period}. Published as {i.listedAs.map((n) => `“${n}”`).join(" and ")}. {i.match}.</p>
        {/* How it compares: only with OPS_MIN_GROUP (20) or more scored peers. A limited sample (10–19) is not compared with. */}
        <p className="xa-ops-peer">{g.hidden
          ? <>{sampleText(g.n, `scored ${groupWord(i.country, i.sector)}`)}, so no group median or comparison is shown.</>
          : !canRank(g.n)
            ? <>{sampleText(g.n, `scored ${groupWord(i.country, i.sector)}`)}: not compared with this firm (comparisons need at least {OPS_MIN_GROUP}). <button className="xa-linkbtn" onClick={onPlace}>See them all</button></>
            : <>{groupWord(i.country, i.sector)}, {medianLabel(g.n)}: <b style={{ color: shade(g.median!) }}>{g.median}</b> · {BAND_LABEL[bandOf(g.n)]}. {SAME_COUNTRY} <button className="xa-linkbtn" onClick={onPlace}>See them all</button></>}</p>
        <HowOps />
      </div>
      <Caveat src={i.source} />
      <p className="xa-note">Complaints received are not findings of wrongdoing. Scores are calculated by Pulsus from published complaints data. They are not official regulatory ratings.</p>
    </div>
  );
}

/** The method in brief, in the cards' "How this score was calculated" style. */
export function HowOps() {
  return (
    <details className="xa-how">
      <summary>How this score was calculated</summary>
      <p>The Pulsus Operational Health Score, out of 100, is calculated from complaints data that regulators publish by firm. Each indicator is read against a fixed range, the same for every institution, and the readings are averaged with these weights: {INDICATORS.map((d) => `${d.label.toLowerCase()} ${d.weight}`).join(", ")}. When an indicator is not published for an institution, its weight is shared among the others (scam reimbursement has no free per-firm source yet, so every score today is {Math.round(INDICATORS[0].weight / (INDICATORS[0].weight + INDICATORS[1].weight) * 100)}% complaint rate and {Math.round(INDICATORS[1].weight / (INDICATORS[0].weight + INDICATORS[1].weight) * 100)}% timeliness). {UPHELD_LABEL} is shown beside UK scores but is not part of them: a firm that rejects more complaints would otherwise score higher. {SAME_COUNTRY}</p>
      <p>An institution is scored only with at least {MIN_COMPLAINTS} complaints in the period and at least two indicators. A group median needs at least {SHOW_MIN} scored institutions, and is labelled with how many it describes ({SHOW_MIN} to {OPS_MIN_GROUP - 1}: a limited sample); any comparison with peers needs at least {OPS_MIN_GROUP}. The score itself is not placed into bands or categories, and it is kept separate from Organisational Health.</p>
      <p><a href="/methodology">The full method, its ranges and its sources →</a></p>
    </details>
  );
}

/** A place in the Operational Health view: its median (with enough institutions), its indicators' medians, and every named institution, A to Z. */
export function PlaceOpsCard({ country, sector, all, sectorLabel, onClose, onInst }: { country: string; sector: string | null; all: OpsInstitution[]; sectorLabel: string; onClose: () => void; onInst: (key: string) => void }) {
  const rows = all.filter((i) => i.country === country && (!sector || i.sector === sector)).sort((a, b) => a.name.localeCompare(b.name));
  const g: OpsGroup = opsGroup(all, country, sector);
  const src = rows[0]?.source;
  return (
    <div className="xa-card-in">
      <div className="xa-card-h"><h2>{COUNTRY[country] || ""}: {sectorLabel}</h2><button className="xa-x" onClick={onClose} aria-label="Close">×</button></div>
      {!rows.length ? <p className="xa-muted">No complaints data from a free, openly licensed source covers these institutions here yet.</p> : (
        <>
          <p className="xa-sub">Operational Health · {srcOf(src!).publisher}</p>
          <dl className="xa-measures">
            <Score v={g.hidden ? null : g.median!} reason="No median: too few institutions here have a score. Each institution's own score is below." upheld={g.hidden ? undefined : g.upheld} upheldWord={g.hidden ? undefined : "median"} />
          </dl>
          <p className={`xa-sample is-${bandOf(g.n)}`}>{g.hidden && <b>{BAND_LABEL.insufficient} · </b>}{sampleText(g.n, "scored institutions", "scored institution")}</p>
          <p className="xa-muted small">{g.n} of {rows.length} named institutions have enough operational data for a score.{!g.hidden && ` The score shown is the ${medianLabel(g.n)}.`}{!g.hidden && !canRank(g.n) && " A limited sample: not ranked or compared."}</p>
          {!g.hidden && g.ind && Object.keys(g.ind).length > 0 && (
            <div className="xa-ind"><p className="xa-label">Indicators · {medianLabel(g.n)} · {BAND_LABEL[bandOf(g.n)]}</p>
              <dl>{INDICATORS.filter((d) => g.ind![d.id] !== undefined).map((d) => <div key={d.id}><dt>{indLabel(d.id, src!)}</dt><dd>{fmtInd(d.id, g.ind![d.id]!)}</dd></div>)}</dl>
            </div>
          )}
          <p className="xa-label">Named institutions · A to Z · tap for detail</p>
          <div className="xa-by xa-ops-list">
            {rows.map((i) => { const s = scoreOf(i).score; return (
              <button key={i.key} onClick={() => onInst(i.key)}>
                <span><b>{i.name}</b><small>{ONE[i.sector]} · {i.complaints.toLocaleString("en-US")} complaints received</small></span>
                <em style={s !== null ? { color: shade(s) } : undefined} className={s === null ? "xa-dash" : undefined}>{s ?? "—"}</em>
              </button>
            ); })}
          </div>
          <HowOps />
          <Caveat src={src!} />
        </>
      )}
    </div>
  );
}
