import type { Metadata } from "next";
import React from "react";
import { ALL_LAYERS } from "../../lib/atlas/serve";
import { LAYERS, SECTORS } from "../../lib/atlas/catalog";
import { factsOf, periodLabel } from "../../lib/atlas/facts";
import { BAND_LABEL, BROAD_MIN, RANK_MIN, SHOW_MIN } from "../../lib/atlas/bands";
import ThemeSwitch from "../../components/ThemeSwitch";
import Globe, { type GlobePlace } from "../../components/Globe";
import "./technology.css";

// How Pulsus Explore works: the public account of its data, score, checks and
// privacy. Every figure on it is worked out from the layers at build time
// (lib/atlas/facts.ts), so it stays true when the data is refreshed.
export const dynamic = "force-static";

const TITLE = "How Pulsus Explore works";
const DESCRIPTION = "Where Pulsus Explore's figures come from, how the Pulsus Organisational Health Score is formed, how the figures are checked, and what Explore does with your visit.";

export const metadata: Metadata = {
  metadataBase: new URL("https://explore.pulsus.tech"),
  title: `${TITLE} · Pulsus Explore`,
  description: DESCRIPTION,
  alternates: { canonical: "/technology" },
  openGraph: { type: "article", url: "/technology", siteName: "Pulsus Explore", title: TITLE, description: DESCRIPTION, locale: "en_GB" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const ABOUT = "https://about.pulsus.tech";
// The EBA's 2025 EU-wide transparency exercise covers 119 banks (its own page and
// list of institutions). Not every one publishes every indicator Explore needs.
const EBA_BANKS = 119;
const EBA_P3DH = "https://www.eba.europa.eu/risk-and-data-analysis/pillar-3-data-hub";
const n0 = (x: number) => x.toLocaleString("en-US");
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const word = (n: number) => WORDS[n] ?? n0(n);
const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] || "");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const SECTIONS = [
  ["what", "What Explore is"],
  ["data", "The data"],
  ["score", "The score"],
  ["checked", "How it’s checked"],
  ["privacy", "Privacy and design"],
  ["fits", "Where it fits"],
] as const;

function Arrow({ up }: { up: boolean }) {
  return (
    <svg className="tk-dir-ic" width="14" height="14" viewBox="0 0 12 12" aria-hidden="true">
      <path d={up ? "M6 10V2M2.5 5.5 6 2l3.5 3.5" : "M6 2v8M2.5 6.5 6 10l3.5-3.5"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The path a figure takes, from a regulator's filing to the map. */
function Flow() {
  const steps: { h: string; p: string; d: string }[] = [
    { h: "Public filings", p: "Regulators and governments publish each organisation’s returns.", d: "M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" },
    { h: "Indicators", p: "Ratios such as return on assets, capital and problem loans, each with a stronger direction.", d: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
    { h: "Score", p: "The Pulsus engine combines an organisation’s indicators into one score out of 100.", d: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM12 7v5l3 2" },
    { h: "Median by place", p: "Organisations are grouped by place; the median is kept and small groups are hidden.", d: "M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
    { h: "The map", p: "Financial figures reach Explore as places and sectors only; no institution is named in them. Operational Health names institutions from complaints data their regulators publish by name under an open licence.", d: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" },
  ];
  return (
    <figure className="tk-flow">
      <figcaption className="tk-label">From public filings to the map</figcaption>
      <ol>
        {steps.map((s, i) => (
          <li key={s.h} className={i === 4 ? "is-explore" : undefined}>
            <span className="tk-flow-ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={s.d} /></svg></span>
            <span className="tk-flow-t"><b><span className="tk-flow-n">{i + 1}</span>{s.h}</b><span>{s.p}</span></span>
            {i < 4 && <svg className="tk-flow-arrow" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </li>
        ))}
      </ol>
      <p className="tk-flow-note">Steps 1 to 4 are built by Pulsus, away from this app. For financial figures, Explore receives only the finished medians and counts, with no institution named.</p>
    </figure>
  );
}

/** The colour scale: continuous, red at 0 through amber to green at 100. No bands. */
function Scale() {
  return (
    <figure className="tk-scale">
      <svg viewBox="0 0 400 44" width="100%" height="44" preserveAspectRatio="none" role="img" aria-labelledby="tk-scale-t">
        <title id="tk-scale-t">The colour scale: red at 0, amber at 50, green at 100, with no bands or cut-offs.</title>
        <defs>
          <linearGradient id="tk-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" className="tk-stop-bad" /><stop offset="0.5" className="tk-stop-watch" /><stop offset="1" className="tk-stop-good" />
          </linearGradient>
        </defs>
        <rect x="0" y="6" width="400" height="18" rx="9" fill="url(#tk-grad)" />
      </svg>
      <figcaption><span>0</span><span>50</span><span>100</span></figcaption>
      <p className="tk-small">The colour moves smoothly with the score. Explore does not sort scores into bands or categories.</p>
    </figure>
  );
}

export default function Technology() {
  const f = factsOf(ALL_LAYERS, LAYERS, SECTORS);
  const src = (id: string) => f.sources.find((s) => s.id === id);
  const sectorLabel = (id: string) => SECTORS.find((s) => s.id === id)?.label ?? id;
  const built = ALL_LAYERS.map((l) => (l as unknown as { built?: string }).built).filter((x): x is string => !!x).sort().pop();
  const NOUN: Record<string, string> = { banks: "banks", "credit-unions": "credit unions", insurance: "insurers", hospitals: "hospitals", government: "government agencies" };
  const liveSectors = SECTORS.filter((s) => s.status === "live").map((s) => NOUN[s.id] ?? lower(s.label));
  const nextSectors = f.sectorsNext.map((s) => `${lower(s.label)} (${s.where})`);
  const brBanks = src("br-banks"), licensed = f.sources.filter((s) => s.licence);
  const usBanks = src("us-banks"), usCU = src("us-credit-unions"), usHosp = src("us-hospitals"), eu = src("eu-banks"), gov = src("us-government");
  const withContext = f.sources.filter((s) => s.indicators.some((i) => i.context));
  const quarterly = f.sources.filter((s) => s.cadence === "quarterly" && s.id !== "eu-banks"), yearly = f.sources.filter((s) => s.cadence === "yearly");
  const ex = f.exceptions[0];
  const totals = f.sources.filter((s) => s.totals);

  // The globe's places: each country a layer covers on its own, Europe as one, and the UK for Operational Health.
  const globePlaces: GlobePlace[] = (() => {
    const by = new Map<string, { label: string; isos: Set<string>; n: number; sectors: Set<string> }>();
    for (const l of ALL_LAYERS) {
      const one = l.countries.length === 1;
      const id = one ? l.countries[0] : "europe";
      const label = one ? (l.countries[0] === "840" ? "United States" : l.countries[0] === "170" ? "Colombia" : l.scope.split(" (")[0]) : "Europe";
      const e = by.get(id) || { label, isos: new Set<string>(), n: 0, sectors: new Set<string>() };
      // A country-totals layer (EIOPA) counts countries, not organisations: it adds none to the count.
      l.countries.forEach((c) => e.isos.add(c)); if (l.kind !== "country-totals") e.n += l.national.n; e.sectors.add(NOUN[l.sector] ?? l.sector);
      by.set(id, e);
    }
    const out: GlobePlace[] = [...by.entries()].map(([id, e]) => ({ id, label: e.label, isos: [...e.isos], sub: `${n0(e.n)} organisations · ${[...e.sectors].join(", ")}` }));
    if (!by.has("826")) out.push({ id: "826", label: "United Kingdom", left: true, isos: ["826"], sub: "Operational Health: named banks, credit unions and insurers, from FCA complaints data" });
    return out;
  })();

  return (
    <div className="tk">
      <a className="tk-skip" href="#main">Skip to content</a>
      <header className="tk-top">
        <a className="tk-logo" href="/" aria-label="Pulsus Explore: open the map">
          <img className="tk-logo-day" src="/pulsus-explore-lockup.png" alt="Pulsus Explore — Live. Signal. Clarity." width={777} height={242} />
          <img className="tk-logo-night" src="/pulsus-explore-lockup-night.png" alt="Pulsus Explore — Live. Signal. Clarity." width={777} height={242} />
        </a>
        <nav className="tk-top-nav" aria-label="Explore">
          <a className="tk-btn ghost" href="/">Open Explore</a>
          <ThemeSwitch className="tk-btn ghost tk-theme" />
        </nav>
      </header>

      <main id="main">
        <section className="tk-hero">
          <div className="tk-hero-globe"><Globe places={globePlaces} /></div>
          <p className="tk-eyebrow">Technology</p>
          <h1>How Pulsus Explore works</h1>
          <p className="tk-deck">Explore is a free map of organisational health across sectors and places, read from the figures regulators and governments publish. This page sets out where the data comes from, how the score is formed, how the figures are checked, and what Explore does with your visit.</p>
          <dl className="tk-stats">
            <div><dt>Organisations read</dt><dd>{n0(f.organisations)}</dd></div>
            <div><dt>Sectors</dt><dd>{f.sectorsLive}</dd></div>
            <div><dt>Public data streams (sources)</dt><dd>{f.sources.length}</dd></div>
            <div><dt>Fewest behind a median</dt><dd>{SHOW_MIN}</dd></div>
          </dl>
        </section>

        <div className="tk-body">
          <nav className="tk-toc" aria-label="On this page">
            <p className="tk-label">On this page</p>
            <ol>{SECTIONS.map(([id, h], i) => <li key={id}><a href={`#${id}`}><span>{String(i + 1).padStart(2, "0")}</span>{h}</a></li>)}</ol>
          </nav>

          <div className="tk-content">
            <section id="what" aria-labelledby="what-h">
              <p className="tk-num">01</p>
              <h2 id="what-h">What Explore is</h2>
              <p>Pulsus Explore shows the financial condition of whole sectors: {list(liveSectors)}, country by country and, in the United States, state by state. {nextSectors.length > 0 && <>Next: {list(nextSectors)}.</>}</p>
              <p>Every figure is read from public regulatory and government data. The financial figures name no institution. They show places and sectors only, as the median of the organisations in each place, and hide any group of fewer than {SHOW_MIN}.{totals.length > 0 && <> European insurance is the one exception: its publisher releases only each country&apos;s totals, so each country is a <a href="#totals">country-level reading</a> of those totals, labelled as such.</>} Operational Health is different: in the United States and the United Kingdom it names banks, credit unions and insurers, from complaints data their regulators publish by firm.</p>
              <p>It is free and needs no account. You can read it on the map, in the directory of places, or through the lists of improving and declining places and areas to watch.</p>
              <Flow />
            </section>

            <section id="data" aria-labelledby="data-h">
              <p className="tk-num">02</p>
              <h2 id="data-h">The data</h2>
              <p>Each sector is read from the body that publishes it, organisation by organisation. Explore holds {n0(f.organisations)} organisations from {word(f.sources.length)} public datasets, across {f.countries} countries.</p>
              <ul className="tk-sources">
                {f.sources.map((s) => (
                  <li key={s.id}>
                    <p className="tk-src-sector">{sectorLabel(s.sector)}</p>
                    <h3>{s.title}</h3>
                    <p className="tk-src-pub">{s.publisher}</p>
                    <dl>
                      {s.totals ? <>
                        <div><dt>Countries</dt><dd>{n0(s.n)}</dd></div>
                        {s.totals.undertakings ? <div><dt>Undertakings in the totals</dt><dd>{n0(s.totals.undertakings)}</dd></div> : null}
                      </> : <div><dt>Organisations</dt><dd>{n0(s.n)}</dd></div>}
                      <div><dt>Latest</dt><dd>{periodLabel(s.cadence, s.to)}</dd></div>
                      <div><dt>History</dt><dd>{s.points} {s.cadence === "yearly" ? "years" : "quarters"}, from {periodLabel(s.cadence, s.from)}</dd></div>
                      <div><dt>Places</dt><dd>{s.places}</dd></div>
                    </dl>
                    <p className="tk-src-raw">{s.source}</p>
                    {s.licence && <p className="tk-src-raw">{s.licence.attribution} Licence: <a href={s.licence.url}>Open Database License (ODbL) 1.0</a>.</p>}
                    {s.totals && <p className="tk-src-raw">Country-level reading from country totals, not a median of institutions. <a href="#totals">What that means →</a></p>}
                  </li>
                ))}
              </ul>

              <h3>Who is included</h3>
              <p>
                {usBanks && <>US banks are every FDIC-insured institution, as the FDIC counts them (insured by its Deposit Insurance Fund at the latest quarter, so no uninsured trust companies and no US branches of foreign banks), that has a report in each of the {usBanks.points} quarters, with every indicator for the latest, so the total is a little below the FDIC’s own count of insured institutions; </>}
                {usCU && <>US credit unions, every credit union that files the NCUA’s quarterly call report with all {usCU.points} quarters: almost all are federally insured, and about 2% are state-chartered credit unions insured privately; </>}
                {usHosp && <>US hospitals, general short-term acute-care hospitals, so that like is compared with like; </>}
                {eu && <>Europe’s banks, the {n0(eu.n)} of the {EBA_BANKS} banks in the European Banking Authority’s 2025 EU-wide transparency exercise that publish every indicator needed (the rest publish no profit or cost figures, or only half-yearly ones); </>}
                {src("co-banks") && <>Colombia’s banks and insurers, from the supervisory accounts they file with the Superintendencia Financiera de Colombia; </>}
                {brBanks && <>Brazil’s banks (commercial, multiple, investment and development banks, each banking group read once, as its capital is supervised) and its single credit cooperatives, from the Banco Central do Brasil’s IF.data, read from {periodLabel(brBanks.cadence, brBanks.from)}, the first quarter after the accounting change of Resolução CMN nº 4.966; the card for each also gives the medians by the state of each institution’s head office; </>}
                {totals.length > 0 && <>European insurance, as country totals: every insurance and reinsurance undertaking that reports quarterly under Solvency II, summed by EIOPA country by country; </>}
                {gov && <>and US federal agencies, from their published budget, reporting and FOIA figures.</>}
              </p>

              {licensed.length > 0 && (
                <>
                  <h3 id="licences">Open-database licences</h3>
                  {licensed.map((s) => <p key={s.id}>{s.title}: {s.licence!.attribution}</p>)}
                  <p>The Brazil layer data published by Explore is made available under the <a href="https://opendatacommons.org/licenses/odbl/1-0/">Open Database License (ODbL) 1.0</a>, and can be <a href="/data/brazil">downloaded in full</a>, with how it is derived.</p>
                </>
              )}

              {totals.map((s) => (
                <React.Fragment key={s.id}>
                  <h3 id="totals">Country-level readings: European insurance</h3>
                  <p>Everywhere else in Explore, a place&apos;s figure is the median of its institutions&apos; scores. For European insurance, the European Insurance and Occupational Pensions Authority (EIOPA) publishes each country&apos;s totals (the sums over all its reporting insurance and reinsurance undertakings, and its own ratios of them), not each insurer&apos;s figures. So each country is read from its totals as if it were one institution, through the same engine and against fixed levels in line with Colombia&apos;s insurers: {list(s.indicators.map((i) => `${i.label.toLowerCase()} (${i.better} is stronger)`))}. Because one country&apos;s totals are a single reading, not a median of many, the engine&apos;s score moves more from quarter to quarter, so every figure shown (the latest, the trend and the map&apos;s colour) is the <b>average of the last four quarters</b> (of fewer for the first three quarters of the series), and no year-on-year arrow is shown. The result is a <b>country-level reading</b>, from {periodLabel(s.cadence, s.from)} to {periodLabel(s.cadence, s.to)}{s.totals?.undertakings ? `, covering ${n0(s.n)} countries and ${n0(s.totals.undertakings)} undertakings at the latest quarter` : ""}.</p>
                  <p>It is a different kind of figure, and Explore keeps it apart. It is drawn dashed and tagged &ldquo;country totals&rdquo; on the Pulse grid and the map, and its count is countries and undertakings, not institutions. It is never part of a sector&apos;s or region&apos;s median, the All sectors and All regions totals, the headline figure, the shape of each sector, the improving and declining lists, the areas to watch, the &ldquo;highest&rdquo; and &ldquo;lowest&rdquo; orderings or any comparison, and the sample bands below do not apply to it.</p>
                  <p>Its limits: totals are dominated by a country&apos;s largest undertakings, and say nothing about the spread between strong and weak insurers, so a country can read well while many of its insurers are weak. The ratios are aggregates (total eligible own funds over total requirements), not any insurer&apos;s own ratio. Quarterly totals leave out undertakings exempted from quarterly reporting. EIOPA publishes the non-life figures year to date; Explore reads them over the trailing four quarters (this year to date, plus the last full year, less the year to date a year before), so they do not swing with the season. Where a country&apos;s figure is not comparable, the indicator is left out for it and its card says why: the Netherlands&apos; non-life expense ratio, as its non-life totals are dominated by compulsory basic health insurance. EIOPA revises its history with each release.</p>
                  {s.totals?.terms && (
                    <>
                      <p>{s.totals.terms.acknowledgement}</p>
                      <p>{s.totals.terms.disclaimer}</p>
                      <p>{s.totals.terms.free} <a href={s.totals.terms.data}>EIOPA insurance statistics</a> · <a href={s.totals.terms.url}>EIOPA legal notice</a>.</p>
                    </>
                  )}
                </React.Fragment>
              ))}

              <h3 id="sample">How many organisations stand behind a median</h3>
              <p>Every median in Explore says how many organisations it describes, in four bands. (In the All sectors view, a place’s figure is its sectors’ medians weighted by size, labelled with their total count.)</p>
              <ul>
                <li><b>{BAND_LABEL.insufficient}</b>, 1 to {SHOW_MIN - 1}: no median, only the count. Too few for a fair median, and too few to be sure no single institution could be picked out. They are still counted in the totals.</li>
                <li><b>{BAND_LABEL.limited}</b>, {SHOW_MIN} to {RANK_MIN - 1}: the median is shown, labelled, and drawn lighter on the map, but never ranked or compared, because one organisation can still move it a long way.</li>
                <li><b>{BAND_LABEL.moderate}</b>, {RANK_MIN} to {BROAD_MIN - 1}, and <b>{BAND_LABEL.broad.toLowerCase()}</b>, {BROAD_MIN} or more: shown, ranked and compared. {RANK_MIN} is a practical floor for ranking, not a point of statistical validity.</li>
              </ul>
              {f.minGroup > SHOW_MIN && <p>Most datasets are built with a floor of {f.minGroup}, so their places with {SHOW_MIN} to {f.minGroup - 1} organisations show the count only.</p>}
              {ex && <p>{ex.title}, {n0(ex.n)} banks across {ex.countries} countries: {word(ex.alone)} countries have at least {SHOW_MIN} on their own, and the rest are read together as {list(ex.areas)}.</p>}
              <p>A floor of {SHOW_MIN} lowers the risk that one institution’s figures can be worked out. It does not guarantee anonymity: many of these institutions are well known, and their regulators publish their figures by name.</p>
              <p>The lists of improving and declining places, the areas to watch, the “highest” and “lowest” orderings and every comparison include only places with at least {f.insightMin} organisations.</p>

              <h3>How often it is refreshed</h3>
              <p>The figures are rebuilt from the sources each quarter. {quarterly.length > 0 && <>Quarterly sources ({list(quarterly.map((s) => s.title))}) add a quarter at a time; </>}{yearly.length > 0 && <>{list(yearly.map((s) => s.title))} are published by fiscal year and move a year at a time.</>}{eu && <> {eu.title} come from the European Banking Authority’s 2025 transparency exercise, which covers the {word(eu.points)} quarters to {periodLabel(eu.cadence, eu.to)}. The EBA has since discontinued the exercise, so this is the latest; future updates will come from its <a href={EBA_P3DH}>Pillar 3 Data Hub</a>.</>} Each card in Explore names its source and the period it describes.{built && <> The current figures were built on {longDate(built)}.</>}</p>
            </section>

            <section id="score" aria-labelledby="score-h">
              <p className="tk-num">03</p>
              <h2 id="score-h">The score</h2>
              <p className="tk-lede">Each institution is scored out of 100 from the figures its regulator publishes. Each indicator is measured against its own fixed levels, over up to three years.</p>
              <p>Each organisation is scored from regulatory indicators taken or calculated from its source’s published figures. The figure Explore shows for a place is the median of the scores of its organisations.</p>
              <p>Each indicator is compared with its own fixed range from weak to strong, the same for every organisation. For some, higher is stronger, such as return on assets and capital; for others, lower is stronger, such as costs, problem loans and charge-offs. The Pulsus engine combines them into one score, calculated the same way for every place.</p>
              <ul className="tk-props">
                <li><b>Out of 100</b><span>A common 0 to 100 range. Each sector is read against its own indicators and fixed levels, so comparisons across sectors are indicative.</span></li>
                <li><b>Median per place</b><span>The middle organisation’s score, not an average that a few outliers can pull.</span></li>
                <li><b>Not banded</b><span>No grades, bands or categories are applied.</span></li>
                <li><b>Same inputs, same score</b><span>Fixed rules: identical inputs and settings give identical results.</span></li>
                <li><b>Weighting proprietary</b><span>How the indicators are weighted is not published (patent pending).</span></li>
              </ul>
              <Scale />

              <h3>The indicators, by dataset</h3>
              <p className="tk-small tk-key"><span><Arrow up />Higher is stronger</span><span><Arrow up={false} />Lower is stronger</span></p>
              <div className="tk-inds">
                {f.sources.map((s) => (
                  <div key={s.id} className="tk-ind">
                    <h4>{s.title}</h4>
                    <ul>
                      {s.indicators.filter((i) => !i.context).map((i) => <li key={i.label}><Arrow up={i.better === "higher"} /><span>{i.label}</span><span className="tk-sr">{i.better === "higher" ? " (higher is stronger)" : " (lower is stronger)"}</span></li>)}
                    </ul>
                    {s.indicators.some((i) => i.context) && (
                      <>
                        <p className="tk-ind-ctx">Shown for context, not part of the score</p>
                        <ul className="is-ctx">
                          {s.indicators.filter((i) => i.context).map((i) => <li key={i.label}><Arrow up={i.better === "higher"} /><span>{i.label}</span><span className="tk-sr">{i.better === "higher" ? " (higher is stronger)" : " (lower is stronger)"}</span></li>)}
                        </ul>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {withContext.map((s) => (
                <p key={s.id}>For {s.title}, {list(s.indicators.filter((i) => i.context).map((i) => lower(i.label)))} are shown beside the score. They describe funding, interest-rate and liquidity risk, which the score itself does not measure. Pulsus calculates them from the same filings; they do not change the score.</p>
              ))}
              {gov && <p>For US federal agencies, the indicators are a few published operational measures rather than financial ratios: how budgets are committed, reporting accuracy and FOIA request handling. They are part of the operational picture, not all of it.</p>}
              <p>In the All sectors view, a place’s figure is not the median of all its organisations. It is each sector’s median, weighted by how many organisations that sector has there.</p>
              <p>Explore also shows a second Pulsus measure, Operational Health, for named banks, credit unions and insurers in the United States and the United Kingdom. It is read from complaints data the CFPB and the FCA publish by firm, and kept separate from the financial score. Pulsus <span className="tk-red">Platform</span>’s Operational Health goes further: it reads an organisation’s own operational data, which public data does not hold. <a href="/methodology">Explore’s Operational Health method, in full →</a></p>
              <p className="tk-small">Scores are calculated by Pulsus from published regulatory data. They are not official regulatory ratings.</p>
            </section>

            <section id="checked" aria-labelledby="checked-h">
              <p className="tk-num">04</p>
              <h2 id="checked-h">How it’s checked</h2>
              <p>Every reading can be traced. A place’s card in Explore shows, beside its score, the median of each indicator the score was built from, with the source and the period, so a figure can be set against the regulator’s own publication.</p>
              <p>Explore’s automated tests, run before each release, check that:</p>
              <ul className="tk-checks">
                <li>every dataset in the catalogue is present, with its date;</li>
                <li>no institution’s name or regulatory identifier appears in the financial figures sent to a browser;</li>
                <li>every place shown has at least its dataset’s minimum number of organisations;</li>
                <li>the improving, declining and areas-to-watch lists use only places with at least {f.insightMin} organisations;</li>
                <li>none of the Organisational Health scoring engine or its method is in Explore’s code: the app receives finished aggregates only.</li>
              </ul>
            </section>

            <section id="privacy" aria-labelledby="privacy-h">
              <p className="tk-num">05</p>
              <h2 id="privacy-h">Privacy and design</h2>
              <div className="tk-two">
                <div>
                  <h3>Privacy</h3>
                  <ul className="tk-checks">
                    <li>No sign-in or account to browse.</li>
                    <li>No advertising, analytics or tracking. The app’s security policy allows scripts only from Explore itself.</li>
                    <li>Stored on your device only: your day or night choice, whether you dismissed or answered the updates invitation, and an offline copy of the app and its public figures.</li>
                    <li>If you subscribe for updates, your email address is the only thing collected. It goes to Pulsus <span className="tk-red">Platform</span> and is used only to send updates.</li>
                    <li>The typefaces load from Google Fonts. Like any website, the hosting provider receives standard request information.</li>
                  </ul>
                  <p><a href="/privacy">Read the privacy policy →</a></p>
                </div>
                <div>
                  <h3>Design</h3>
                  <ul className="tk-checks">
                    <li>One app for phone, tablet and desktop, installable from the browser.</li>
                    <li>Works offline once opened, with the latest figures it has seen.</li>
                    <li>Day and night themes, following your device until you choose.</li>
                    <li>Respects a reduced-motion setting.</li>
                    <li>WCAG 2.2 AA is the accessibility target: contrast in both themes, labelled controls, visible keyboard focus and layouts that reflow to a phone’s width.</li>
                  </ul>
                </div>
              </div>
            </section>

            <section id="fits" aria-labelledby="fits-h">
              <p className="tk-num">06</p>
              <h2 id="fits-h">Where it fits</h2>
              <p>Explore is the free window: whole sectors, read from public data. Pulsus <span className="tk-red">Platform</span> reads an organisation from its own systems. Pulse shows its health and what needs attention today; Executive Intelligence adds the diagnosis, treatments, recovery and where it stands among these peers; Oversight Intelligence watches over many organisations at once.</p>
              <div className="tk-cta">
                <a className="tk-btn" href={`${ABOUT}/demo/?from=explore`}>Take a peek</a>
                <a className="tk-btn ghost" href="/">Open Explore</a>
              </div>
              <p className="tk-small">Take a peek: Pulsus <span className="tk-red">Platform</span> with a fictional organisation, no sign-up needed.</p>
            </section>
          </div>
        </div>
      </main>

      <footer className="tk-foot">
        <p className="tk-foot-name">Pulsus <span className="tk-red">Explore</span> · Part of the Pulsus Intelligence Suite</p>
        <p>A product of Tumblehill Labs, a product studio of Tumblehill Holdings LLC.</p>
        <p className="tk-foot-links"><a href="/">Explore</a><a href="/privacy">Privacy</a><a href="https://executive.pulsus.tech/legal/terms">Terms of Use</a></p>
      </footer>
    </div>
  );
}
