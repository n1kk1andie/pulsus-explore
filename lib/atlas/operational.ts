// Operational Health in Explore: a transparent score, out of 100, for named
// institutions, from complaints data their regulators publish by name. Unlike
// Organisational Health (financial condition, read through the Pulsus engine),
// every step here is public: the indicators, where each comes from, the fixed
// ranges each is read against, and the weights. Scores compare institutions
// within the same country only: the US and UK sources measure different things
// over different periods, so a US score and a UK score are never ranked together.
// Pure, so the build
// (scripts/operational), the tests and the app all use this one definition.

import { RANK_MIN, SHOW_MIN } from "./bands";

/** The measures the score can use. Each is read against a fixed range, the same for every institution. */
export type IndicatorId = "rate" | "timely" | "scam";

export interface IndicatorDef {
  id: IndicatorId;
  label: string;
  weight: number;            // out of 100, before reweighting over the indicators an institution has
  better: "higher" | "lower";
  /** How the value becomes 0–100, in words (shown in the app). */
  reads: string;
}

/** The weights: complaint rate 50, timeliness 37.5, scam reimbursement 12.5 (not used yet).
 *  "Complaints upheld by the firm" was removed from the score: a firm that rejects more
 *  complaints would score higher for it. Its 20 was shared among the other three in
 *  proportion to their earlier weights (40 : 30 : 10), so complaint rate and timeliness
 *  keep the same 4 : 3 balance. The upheld rate is still shown, for information only
 *  (OpsInstitution.upheld). */
export const INDICATORS: IndicatorDef[] = [
  { id: "rate", label: "Complaints received, relative to size", weight: 50, better: "lower",
    reads: "On a log scale: 100 at the low end of the range, 50 ten times higher, 0 a hundred times higher. US: 1, 10 and 100 complaints a year per $1bn of total assets. UK: 0.5, 5 and 50 complaints per 1,000 accounts or policies, per half-year." },
  { id: "timely", label: "Complaints handled in time", weight: 37.5, better: "higher",
    reads: "A straight line. US (share of complaints with a timely company response): 95% scores 0, 100% scores 100, a range set from the spread of US institutions' own rates (reviewed each year). UK (share of complaints closed within 8 weeks): 50% scores 0, 100% scores 100." },
  { id: "scam", label: "Scam losses reimbursed", weight: 12.5, better: "higher",
    reads: "Not used yet: no per-firm source is free to reuse (see Sources). Its weight is shared among the others." },
];

/** The fewest complaints in the period for an institution to be scored. */
export const MIN_COMPLAINTS = 50;
/** The fewest indicators an institution needs to be scored. */
export const MIN_INDICATORS = 2;
/** The fewest scored institutions a group needs for a peer comparison (as for every ranking in Explore).
 *  A median is shown from SHOW_MIN, with its sample band (lib/atlas/bands.ts). */
export const OPS_MIN_GROUP = RANK_MIN;

/** US timeliness range: the share of complaints with a timely company response that
 *  reads 0, and the share that reads 100. A documented judgment, checked against the
 *  data: from the scored US institutions (50 or more complaints) in the CFPB complaints
 *  received 1 July 2025 to 30 June 2026, the 5th percentile of the timely-response rate
 *  was 96.9% and the 95th 100.0% (82 institutions; the build prints both). Setting the
 *  low end at that spread (95%) would make one point below 100% cost 20 points; the
 *  range is kept wider, from 90%, so one point costs 10 and the whole observed spread
 *  sits inside it. Fixed, so every institution is read against the same range, and
 *  reviewed once a year, when the period moves on. */
export const US_TIMELY_RANGE = { zero: 90, full: 100 } as const;
/** The percentiles US_TIMELY_RANGE is derived from, for the yearly review. */
export const US_TIMELY_PERCENTILES = [5, 95] as const;

/** Fixed ranges, per source. */
export const RANGES = {
  cfpb: { rate: { best: 1, unit: "complaints a year per $1bn of total assets" }, timely: US_TIMELY_RANGE },
  fca: { rate: { best: 0.5, unit: "complaints per 1,000 accounts or policies, per half-year" }, timely: { zero: 50, full: 100 } },
} as const;
export type SourceId = keyof typeof RANGES;

const clamp = (x: number) => Math.max(0, Math.min(100, x));
const r1 = (x: number) => Math.round(x * 10) / 10;

/** One indicator's value read as 0–100 against its fixed range. */
export function subScore(source: SourceId, id: IndicatorId, v: number): number {
  if (id === "rate") return clamp(100 - 50 * Math.log10(Math.max(v, 1e-9) / RANGES[source].rate.best));
  if (id === "timely") { const t = RANGES[source].timely; return clamp(((v - t.zero) / (t.full - t.zero)) * 100); }
  return clamp(v); // scam: share reimbursed, %
}

export interface OpsInstitution {
  key: string;               // "us-bank-628", "uk-fca-…"
  name: string;              // the institution's official name
  listedAs: string[];        // the name(s) it is published under by the source
  match: string;             // how the published name was matched to the institution
  country: "840" | "826";
  sector: "banks" | "credit-unions" | "insurance";
  idKind: string; id: string; // FDIC certificate, NCUA charter, FCA firm reference number…
  group?: string;            // its group, as the source gives it
  source: SourceId;
  period: string;            // the period the figures cover, in words
  complaints: number;        // complaints received (US) or opened (UK) in the period
  size?: { label: string; value: number; unit: string; source: string };
  /** The indicators' values, as percentages or rates, before they are read against the ranges. */
  ind: Partial<Record<IndicatorId, number>>;
  /** Share of complaints the firm upheld, %, where the source publishes it (the FCA does,
   *  the CFPB does not). Shown beside the score for information only: not part of it. */
  upheld?: number;
  /** Shown beside the score, not part of it. */
  context?: { label: string; value: string }[];
}

export interface OpsScore { score: number | null; reason?: string; parts: { id: IndicatorId; value: number; sub: number; weight: number }[] }

/** The Operational Health score: the weighted mean of the indicators an institution has,
 *  their weights rescaled to add up to 100. Fewer than MIN_COMPLAINTS complaints, or fewer
 *  than MIN_INDICATORS indicators, gives no score, with the reason. */
export function scoreOf(i: Pick<OpsInstitution, "source" | "complaints" | "ind">): OpsScore {
  const parts = INDICATORS.filter((d) => Number.isFinite(i.ind[d.id])).map((d) => {
    const value = i.ind[d.id] as number;
    return { id: d.id, value, sub: r1(subScore(i.source, d.id, value)), weight: d.weight };
  });
  const total = parts.reduce((t, p) => t + p.weight, 0);
  for (const p of parts) p.weight = r1((p.weight / (total || 1)) * 100);
  if (i.complaints < MIN_COMPLAINTS) return { score: null, reason: `Fewer than ${MIN_COMPLAINTS} complaints in the period (${i.complaints}), too few to calculate.`, parts };
  if (parts.length < MIN_INDICATORS) return { score: null, reason: `Only ${parts.length} of the operational measures is published for it; at least ${MIN_INDICATORS} are needed.`, parts };
  const s = parts.reduce((t, p) => t + p.sub * p.weight, 0) / parts.reduce((t, p) => t + p.weight, 0);
  return { score: Math.round(s), parts };
}

const medianOf = (xs: number[]) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b); const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null;
};

export interface OpsGroup { n: number; listed: number; hidden: boolean; median?: number; ind?: Partial<Record<IndicatorId, number>>; /** Median upheld rate, %, for information only (not scored). */ upheld?: number }

/** A group's Operational Health: the median of its scored institutions, only with at least SHOW_MIN of them
 *  (10–19: a limited sample, never compared; lib/atlas/bands.ts). */
export function opsGroup(all: OpsInstitution[], country: string | null, sector: string | null): OpsGroup {
  // Never across countries: a group with no country is only ever one country's (see the header).
  if (!country && new Set(all.map((i) => i.country)).size > 1) throw new Error("opsGroup: scores compare institutions within one country only");
  const rows = all.filter((i) => (!country || i.country === country) && (!sector || sector === "all" || i.sector === sector));
  const scored = rows.map((i) => ({ i, s: scoreOf(i) })).filter((x) => x.s.score !== null);
  if (scored.length < SHOW_MIN) return { n: scored.length, listed: rows.length, hidden: true };
  // One source per group: medians of indicators read on different scales are not mixed.
  const sources = new Set(scored.map((x) => x.i.source));
  const ind: Partial<Record<IndicatorId, number>> = {};
  if (sources.size === 1) for (const d of INDICATORS) { const m = medianOf(scored.map((x) => x.i.ind[d.id] as number)); if (m !== null) ind[d.id] = r1(m); }
  const up = sources.size === 1 ? medianOf(scored.map((x) => x.i.upheld as number)) : null;
  return { n: scored.length, listed: rows.length, hidden: false, median: Math.round(medianOf(scored.map((x) => x.s.score as number))!), ind, ...(up !== null ? { upheld: r1(up) } : {}) };
}

// ── the building blocks the build uses, kept here so the tests rebuild from raw the same way ──

/** CFPB: from a company's complaints in the period (records, or the publisher's own counts). */
export function cfpbIndicators(c: { total: number; timelyYes: number; timelyNo: number }, assetsUsdMillions: number | undefined) {
  const answered = c.timelyYes + c.timelyNo;
  return {
    rate: assetsUsdMillions ? r1(c.total / (assetsUsdMillions / 1000)) : undefined,
    timely: answered ? r1((c.timelyYes / answered) * 100) : undefined,
  };
}

/** FCA: one firm's row of the firm-level file (products: per-product values; total: the Grand Total column). */
export interface FcaRow { opened: Record<string, number>; closed: Record<string, number>; within3: Record<string, number>; after3within8: Record<string, number>; upheld: Record<string, number>; per1000: Record<string, number> }
/** Closed within 8 weeks = closed within 3 days + closed after 3 days but within 8 weeks (the FCA publishes both).
 *  `upheld` is returned for information only: the build keeps it out of `ind`, so it is not scored. */
export function fcaIndicators(f: { totalOpened: number; within3: number | null; after3within8: number | null; upheld: number | null; per1000: Record<string, number>; opened: Record<string, number> }) {
  // Complaints per 1,000 accounts across the firm's products: each product's accounts are
  // backed out of its own rate (opened ÷ rate × 1,000), then all opened ÷ all accounts × 1,000.
  let o = 0, acc = 0;
  for (const [p, rate] of Object.entries(f.per1000)) { const op = f.opened[p]; if (rate > 0 && op > 0) { o += op; acc += (op / rate) * 1000; } }
  const w8 = f.within3 === null && f.after3within8 === null ? undefined : ((f.within3 ?? 0) + (f.after3within8 ?? 0)) * 100;
  return {
    rate: acc ? Math.round((o / acc) * 1000 * 100) / 100 : undefined,
    timely: w8 === undefined ? undefined : r1(Math.min(100, w8)),
    upheld: f.upheld === null ? undefined : r1(f.upheld * 100),
  };
}

// ── sources: each publisher's licence and attribution, as checked on its own pages ──

export interface OpsSource {
  id: string; publisher: string; dataset: string; url: string;
  used: boolean; licence: string; licenceUrl?: string; attribution: string;
  caveat: string; period?: string; checked: string; why?: string;
}
export const OPS_SOURCES: OpsSource[] = [
  { id: "cfpb", publisher: "Consumer Financial Protection Bureau (US)", dataset: "Consumer Complaint Database", url: "https://www.consumerfinance.gov/data-research/consumer-complaints/",
    used: true, licence: "Public domain (US government work; the complaint API states CC0)", licenceUrl: "https://www.consumerfinance.gov/privacy/website-privacy-policy/",
    attribution: "Source: Consumer Financial Protection Bureau, Consumer Complaint Database. Pulsus is not affiliated with or endorsed by the CFPB.",
    caveat: "This database is not a statistical sample of consumers’ experiences in the marketplace, therefore these complaints are not representative of all consumers’ experiences with a financial product or company. When looking at complaint volume about a company or product, consider company size and market share. (CFPB)",
    period: "Complaints received 1 July 2025 to 30 June 2026", checked: "2026-11-16" },
  { id: "fca", publisher: "Financial Conduct Authority (UK)", dataset: "Firm-level complaints data, 2026 H1", url: "https://www.fca.org.uk/data/complaints-data/firm-level",
    used: true, licence: "Open Government Licence v3.0", licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    attribution: "Contains public sector information licensed under the Open Government Licence v3.0. Source: Financial Conduct Authority, firm-level complaints data. Use of the data does not imply endorsement by the FCA.",
    caveat: "Complaints data should not be used on its own to assess a firm’s overall performance. The figures are based on data reported by firms; reporting inaccuracies or inconsistencies may remain between firms. (FCA)",
    period: "Each firm’s six-month reporting period ending in the first half of 2026", checked: "2026-11-16" },
  { id: "fos", publisher: "Financial Ombudsman Service (UK)", dataset: "Half-yearly business complaints data", url: "https://www.financial-ombudsman.org.uk/businesses/resolving-complaint/our-insight",
    used: false, licence: "Not openly licensed: its legal notice reserves copyright and requires prior permission to reproduce material on another website", licenceUrl: "https://www.financial-ombudsman.org.uk/legal-policy",
    attribution: "", caveat: "", checked: "2026-11-16",
    why: "No open licence is stated on the data page, the file or the legal notice, so it is not free to reuse commercially. Not used; it could be added with the Ombudsman’s written permission." },
  { id: "psr", publisher: "Payment Systems Regulator (UK)", dataset: "APP fraud performance data", url: "https://www.psr.org.uk/information-for-consumers/app-fraud-performance-data/",
    used: false, licence: "Personal or in-firm use only; its copyright terms forbid using the data to feed a comparison table or website", licenceUrl: "https://www.psr.org.uk/copyright/",
    attribution: "", caveat: "", checked: "2026-11-16",
    why: "Not free to reuse, and the per-firm figures end in October 2024 (published as PDF); the newer reimbursement dashboard is market-wide, not per firm. Not used, so the scam-reimbursement measure is empty." },
];
