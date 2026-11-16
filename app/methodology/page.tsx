import type { Metadata } from "next";
import operational from "../../lib/atlas/data/operational.json";
import { INDICATORS, MIN_COMPLAINTS, MIN_INDICATORS, OPS_SOURCES, RANGES, US_TIMELY_PERCENTILES, opsGroup, type OpsInstitution } from "../../lib/atlas/operational";
import { BAND_LABEL, BROAD_MIN, RANK_MIN, SHOW_MIN, bandOf, sampleText } from "../../lib/atlas/bands";

export const metadata: Metadata = { title: "Operational Health: method and sources · Pulsus Platform · Explore" };
export const dynamic = "force-static";

const insts = operational.institutions as OpsInstitution[];
const RED = { color: "#d0284a" };
const th = { textAlign: "left" as const, padding: "6px 8px", borderBottom: "1px solid var(--pz-line, #d6dcec)", fontSize: 13 };
const h2 = { marginTop: 26 };
const td = { padding: "6px 8px", borderBottom: "1px solid var(--pz-line, #d6dcec)", fontSize: 14, verticalAlign: "top" as const };

// Operational Health, in full: every indicator, range, weight, rule and source,
// so anyone can rebuild a score from the publishers' own files.
export default function Methodology() {
  const w = Object.fromEntries(INDICATORS.map((d) => [d.id, d.weight])) as Record<string, number>;
  const pct = (x: number) => `${Math.round((x / (w.rate + w.timely)) * 100)}%`;
  const median = (n: number) => `median of the ${n} ${n === 1 ? "institution" : "institutions"} with a score`;
  const groups: [string, string, string | null][] = [["US banks", "840", "banks"], ["US credit unions", "840", "credit-unions"], ["UK banks", "826", "banks"], ["UK insurers", "826", "insurance"]];
  return (
    <main className="pz pz-xp-page"><div className="pz-main pz-xp-main" style={{ maxWidth: 820 }}>
      <p className="pz-eyebrow"><a className="pz-link-btn" href="/">← Explore</a></p>
      <h1>Operational Health: how it&apos;s calculated</h1>
      <p className="pz-muted">Data built {operational.built}. Every figure here comes from the publishers&apos; own files; nothing is estimated.</p>

      <h2 className="pz-h3" style={h2}>What it is</h2>
      <p>The Pulsus Operational Health Score is a reading, out of 100, of how a named bank, credit union or insurer handles complaints, from complaints data that its regulator publishes by firm. It is calculated by the published formula below, the same for every institution. It is separate from Organisational Health, which reads financial condition for places from regulators&apos; financial indicators. Explore never blends the two into one number.</p>
      <p><b>Scores compare institutions within the same country only.</b> The US and UK figures come from different regulators, measure complaints differently and cover different periods, so a US score and a UK score are never ranked, sorted or compared together.</p>
      <p>Complaints received are not findings of wrongdoing, and complaints data describes one part of how an institution operates, not all of it. Scores are calculated by Pulsus from published complaints data. They are not official regulatory ratings.</p>

      <h2 className="pz-h3" style={h2}>The indicators and their weights</h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}>Indicator</th><th style={th}>Weight</th><th style={th}>United States (CFPB)</th><th style={th}>United Kingdom (FCA)</th></tr></thead>
          <tbody>
            <tr><td style={td}>Complaints received, relative to size</td><td style={td}>{w.rate}</td><td style={td}>Complaints received in the year per $1bn of total assets (FDIC or NCUA, June 2026)</td><td style={td}>Complaints opened per 1,000 accounts or policies, from the FCA&apos;s own context data, across the firm&apos;s products</td></tr>
            <tr><td style={td}>Complaints handled in time</td><td style={td}>{w.timely}</td><td style={td}>Share of complaints with a timely company response</td><td style={td}>Share of complaints closed within 8 weeks (within 3 days, plus after 3 days but within 8 weeks)</td></tr>
            <tr><td style={td}>Scam losses reimbursed</td><td style={td}>{w.scam}</td><td style={td} colSpan={2}>Not used yet: no per-firm source is free to reuse (see Sources)</td></tr>
          </tbody>
        </table>
      </div>
      <p>Each indicator is read against a fixed range, the same for every institution, giving a reading from 0 to 100:</p>
      <ul>{INDICATORS.map((d) => <li key={d.id}><b>{d.label}</b> ({d.better} is stronger): {d.reads}</li>)}</ul>
      <p>The score is the weighted mean of the readings an institution has. When an indicator is not published for it, its weight is shared among the others in proportion. Scam reimbursement has no free per-firm source yet, so today every score, US and UK, is read {pct(w.rate)} on its complaint rate and {pct(w.timely)} on timeliness. Those are simply the weights after the missing indicator&apos;s share is redistributed: they are not extra evidence for either indicator, and they do not make the score more certain. The ranges&apos; fixed points: US complaint rate {RANGES.cfpb.rate.best} {RANGES.cfpb.rate.unit} scores 100; UK {RANGES.fca.rate.best} {RANGES.fca.rate.unit} scores 100.</p>
      <p><b>The US timeliness range</b>, {RANGES.cfpb.timely.zero}% to {RANGES.cfpb.timely.full}%, is set from the data, not by hand: among the US institutions with a score, the {US_TIMELY_PERCENTILES[0]}th percentile of the timely-response rate was 96.9% and the {US_TIMELY_PERCENTILES[1]}th was 100%; the low end is rounded down to the nearest 5 points. It is a fixed constant, the same for every institution, and is reviewed once a year when the period moves on. Most US institutions respond on time to nearly every complaint, so the range is narrow and a few points below 100% counts.</p>
      <p><b>Complaints upheld by the firm</b> (the share of complaints a firm agreed were justified, which the FCA publishes and the CFPB does not) is not part of the score. Counting a low upheld rate as good would reward a firm for rejecting complaints. It is shown beside a UK institution&apos;s score, labelled as information only, not scored.</p>

      <h2 className="pz-h3" style={h2}>Who gets a score</h2>
      <p>An institution is scored only with at least {MIN_COMPLAINTS} complaints in the period and at least {MIN_INDICATORS} indicators. Otherwise Explore shows “—” with the reason.</p>

      <h2 className="pz-h3" style={h2} id="sample">How many institutions stand behind an average</h2>
      <p>Every average in Explore, for Operational Health and Organisational Health alike, is labelled with how many institutions it describes, in four bands. The bands describe sample size only; they are not confidence levels or a statistical test.</p>
      <ul>
        <li><b>{BAND_LABEL.insufficient}</b>: 1 to {SHOW_MIN - 1}. No average is shown, only the count (for example, “6 institutions — too few for an average”). Too few for a fair average, and too few to be sure no single institution could be picked out.</li>
        <li><b>{BAND_LABEL.limited}</b>: {SHOW_MIN} to {RANK_MIN - 1}. The average is shown, labelled, and drawn lighter on the map. It is not ranked, put in order of highest or lowest, or compared with other groups or with a single institution: one institution can still move it a long way.</li>
        <li><b>{BAND_LABEL.moderate}</b>: {RANK_MIN} to {BROAD_MIN - 1}. The average is shown, ranked and compared. {RANK_MIN} is a practical floor for ranking, chosen so one institution moves a median less; it is not a point of statistical validity.</li>
        <li><b>{BAND_LABEL.broad}</b>: {BROAD_MIN} or more.</li>
      </ul>
      <p>Organisational Health&apos;s financial figures are always anonymous: a group&apos;s figures are medians, and no group of fewer than {SHOW_MIN} shows a figure, so no institution can be identified from them.</p>
      <p>Where a place&apos;s Operational Health is shown, it is the median of the institutions there with a score, and is labelled with that count:</p>
      <ul>{groups.map(([name, c, s]) => { const g = opsGroup(insts, c, s); return <li key={name}>{name}: {g.n} scored of {g.listed} named · {g.hidden ? sampleText(g.n, "scored") : `${BAND_LABEL[bandOf(g.n)]}; ${median(g.n)}: ${g.median}`}.</li>; })}</ul>
      <p>UK coverage is limited: the FCA publishes firm-level figures only for firms above its reporting threshold (500 or more complaints in the six months), so smaller UK firms are not included, and some groups report their firms&apos; complaints together in one return, so a named firm&apos;s figures can include others in its group.</p>
      <p>Colours follow the same continuous scale as Organisational Health: red at 0, amber at 50, green at 100, with no bands or categories.</p>

      <h2 className="pz-h3" style={h2}>Which institutions are named</h2>
      <p><b>United States.</b> A company in the CFPB&apos;s data is shown only when it matches, reliably, a bank or credit union that Explore reads: the same legal name as one FDIC-insured bank of $10bn or more (the CFPB publishes complaints about banks of that size), with its FDIC certificate; or a listed holding company that the FDIC records show has exactly one bank of $10bn or more, with the FDIC&apos;s holding company identifier; or the same name as one NCUA-insured credit union of $10bn or more, with its charter number. Holding companies with more than one such bank are not matched. A holding company&apos;s complaints can include its other businesses. Companies that do not match are not shown.</p>
      <p><b>United Kingdom.</b> Banks and building societies, and insurers (by name, with most of their complaints about insurance or pensions), from the FCA&apos;s firm-level data, which covers firms reporting 500 or more complaints in six months. They are UK legal entities as the FCA names them; none is merged with the European Banking Authority&apos;s list of EU banking groups. Consumer credit complaints, which the FCA publishes separately, are not included.</p>

      <h2 className="pz-h3" style={h2}>The publishers&apos; caveats</h2>
      {OPS_SOURCES.filter((s) => s.used).map((s) => <blockquote key={s.id} style={{ margin: "8px 0", paddingLeft: 12, borderLeft: "3px solid #d99a12" }}>{s.caveat}</blockquote>)}

      <h2 className="pz-h3" style={h2} id="sources">Sources and licences</h2>
      {OPS_SOURCES.map((s) => (
        <div key={s.id} style={{ margin: "10px 0 14px" }}>
          <p style={{ margin: 0 }}><b>{s.publisher}: {s.dataset}</b> · {s.used ? "used" : "not used"}</p>
          <p style={{ margin: "2px 0" }}>Licence: <a className="pz-link-btn" href={s.licenceUrl}>{s.licence}</a> (checked on the publisher&apos;s own pages, {s.checked}). <a className="pz-link-btn" href={s.url}>Source</a></p>
          {s.used ? <p style={{ margin: "2px 0" }}>Attribution: {s.attribution}{s.period ? ` Period: ${s.period}.` : ""}</p> : <p style={{ margin: "2px 0" }}>{s.why}</p>}
        </div>
      ))}
      <p>The size measures for US institutions come from the FDIC (BankFind Suite) and the NCUA (call reports), public US government data, as used throughout Explore.</p>

      <h2 className="pz-h3" style={h2}>Reproducible from the raw files</h2>
      <p>The publishers&apos; files are kept as served, with their SHA-256 fingerprints, and the build reads only them. Tests rebuild several institutions&apos; indicators from those files (the CFPB&apos;s complaint records, and the FCA&apos;s per-product figures) and check them against the publishers&apos; own totals.</p>
      <ul style={{ fontSize: 13 }}>{Object.entries(operational.raw).map(([f, h]) => <li key={f}><code>{f}</code> · <code>{String(h).slice(0, 16)}…</code></li>)}</ul>

      <p className="pz-muted" style={{ marginTop: 24 }}>Pulsus <span style={RED}>Platform</span> · Explore · © 2026 Tumblehill Holdings LLC. Not affiliated with or endorsed by any regulator named here.</p>
    </div></main>
  );
}
