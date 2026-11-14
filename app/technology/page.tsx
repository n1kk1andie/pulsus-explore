import type { Metadata } from "next";
import { ALL_LAYERS } from "../../lib/atlas/serve";
import { LAYERS, SECTORS } from "../../lib/atlas/catalog";
import { factsOf, periodLabel } from "../../lib/atlas/facts";
import ThemeSwitch from "../../components/ThemeSwitch";
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
    { h: "The map", p: "Only places and sectors reach Explore. No institution is named.", d: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" },
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
      <p className="tk-flow-note">Steps 1 to 4 are built by Pulsus, away from this app. Explore receives only the finished, anonymous medians and counts.</p>
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
  const usBanks = src("us-banks"), usCU = src("us-credit-unions"), usHosp = src("us-hospitals"), eu = src("eu-banks"), gov = src("us-government");
  const withContext = f.sources.filter((s) => s.indicators.some((i) => i.context));
  const quarterly = f.sources.filter((s) => s.cadence === "quarterly" && s.id !== "eu-banks"), yearly = f.sources.filter((s) => s.cadence === "yearly");
  const ex = f.exceptions[0];

  return (
    <div className="tk">
      <a className="tk-skip" href="#main">Skip to content</a>
      <header className="tk-top">
        <a className="tk-logo" href="/" aria-label="Pulsus Explore: open the map">
          <img className="tk-logo-day" src="/pulsus-explore-logo.png" alt="Pulsus Explore" width={588} height={160} />
          <img className="tk-logo-night" src="/pulsus-explore-logo-night.png" alt="Pulsus Explore" width={588} height={160} />
        </a>
        <nav className="tk-top-nav" aria-label="Explore">
          <a className="tk-btn ghost" href="/">Open Explore</a>
          <ThemeSwitch className="tk-btn ghost tk-theme" />
        </nav>
      </header>

      <main id="main">
        <section className="tk-hero">
          <p className="tk-eyebrow">Technology</p>
          <h1>How Pulsus Explore works</h1>
          <p className="tk-deck">Explore is a free map of organisational health across sectors and places, read from the figures regulators and governments publish. This page sets out where the data comes from, how the score is formed, how the figures are checked, and what Explore does with your visit.</p>
          <dl className="tk-stats">
            <div><dt>Organisations read</dt><dd>{n0(f.organisations)}</dd></div>
            <div><dt>Sectors</dt><dd>{f.sectorsLive}</dd></div>
            <div><dt>Public datasets</dt><dd>{f.sources.length}</dd></div>
            <div><dt>Minimum per place</dt><dd>{f.minGroup}</dd></div>
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
              <p>Every figure is read from public regulatory and government data. Explore names no institution. It shows places and sectors only, as the median of the organisations in each place, and hides any group too small to keep anonymous.</p>
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
                      <div><dt>Organisations</dt><dd>{n0(s.n)}</dd></div>
                      <div><dt>Latest</dt><dd>{periodLabel(s.cadence, s.to)}</dd></div>
                      <div><dt>History</dt><dd>{s.points} {s.cadence === "yearly" ? "years" : "quarters"}, from {periodLabel(s.cadence, s.from)}</dd></div>
                      <div><dt>Places</dt><dd>{s.places}</dd></div>
                    </dl>
                    <p className="tk-src-raw">{s.source}</p>
                  </li>
                ))}
              </ul>

              <h3>Who is included</h3>
              <p>
                {usBanks && <>US banks are every FDIC-insured bank with all {usBanks.points} quarters of data; </>}
                {usCU && <>US credit unions, every federally insured credit union with all {usCU.points} quarters; </>}
                {usHosp && <>US hospitals, general short-term acute-care hospitals, so that like is compared with like; </>}
                {eu && <>Europe’s banks, the largest banks in the European Banking Authority’s EU-wide transparency exercise; </>}
                {src("co-banks") && <>Colombia’s banks and insurers, from the supervisory accounts they file with the Superintendencia Financiera de Colombia; </>}
                {gov && <>and US federal agencies, from their published budget, reporting and FOIA figures.</>}
              </p>

              <h3>Small groups stay hidden</h3>
              <p>A place appears on its own only when it has at least {f.minGroup} organisations in that sector. Smaller groups are counted in the totals but not shown, so no group can stand in for an identifiable institution and one organisation cannot swing a place’s median.</p>
              {ex && <p>{ex.title}, {n0(ex.n)} banks across {ex.countries} countries, use a minimum of {ex.minGroup}: {word(ex.alone)} countries meet it on their own, and the rest are read together as {list(ex.areas)}.</p>}
              <p>The lists of improving and declining places, and the areas to watch, include only places with at least {f.insightMin} organisations.</p>

              <h3>How often it is refreshed</h3>
              <p>The figures are rebuilt from the sources each quarter. {quarterly.length > 0 && <>Quarterly sources ({list(quarterly.map((s) => s.title))}) add a quarter at a time; </>}{yearly.length > 0 && <>{list(yearly.map((s) => s.title))} are published by fiscal year and move a year at a time.</>}{eu && <> {eu.title} come from the European Banking Authority’s yearly transparency exercise, which covers the {word(eu.points)} quarters to {periodLabel(eu.cadence, eu.to)}.</>} Each card in Explore names its source and the period it describes.{built && <> The current figures were built on {longDate(built)}.</>}</p>
            </section>

            <section id="score" aria-labelledby="score-h">
              <p className="tk-num">03</p>
              <h2 id="score-h">The score</h2>
              <p className="tk-lede">The Pulsus Organisational Health Score is an assessment of financial condition, out of 100.</p>
              <p>Each organisation is scored from regulatory indicators taken or calculated from its source’s published figures. The figure Explore shows for a place is the median of the scores of its organisations.</p>
              <p>Each indicator is compared with a range from weak to strong. For some, higher is stronger, such as return on assets and capital; for others, lower is stronger, such as costs, problem loans and charge-offs. The Pulsus engine combines them into one score, calculated the same way for every place.</p>
              <ul className="tk-props">
                <li><b>Out of 100</b><span>One scale for every sector and place.</span></li>
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
              <p>Explore also lists a second Pulsus measure, Operational Health, as a dash. Public data does not hold enough operational detail to calculate it; that takes an organisation’s own data. In the All sectors view, a place’s figure is each sector’s median weighted by how many organisations it has.</p>
              <p className="tk-small">Pulsus assessments are independent and are not official regulatory ratings.</p>
            </section>

            <section id="checked" aria-labelledby="checked-h">
              <p className="tk-num">04</p>
              <h2 id="checked-h">How it’s checked</h2>
              <p>Every reading can be traced. A place’s card in Explore shows, beside its score, the median of each indicator the score was built from, with the source and the period, so a figure can be set against the regulator’s own publication.</p>
              <p>Explore’s automated tests, run before each release, check that:</p>
              <ul className="tk-checks">
                <li>every dataset in the catalogue is present, with its date;</li>
                <li>no institution’s name or regulatory identifier appears in the data sent to a browser;</li>
                <li>every place shown has at least its dataset’s minimum number of organisations;</li>
                <li>the improving, declining and areas-to-watch lists use only places with at least {f.insightMin} organisations;</li>
                <li>none of the scoring engine or its method is in Explore’s code: the app receives finished aggregates only.</li>
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
