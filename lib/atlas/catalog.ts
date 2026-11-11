// The Atlas: whole sectors read anonymously from public data, through the same
// engine an organisation's own readings go through, with the organisation
// placed among its peers. This file lists what is live and what is next.
//
// Live layers are built offline (scripts/atlas/*.mjs) into anonymous totals:
// by region and by size, never an institution's identity, its own figures, or
// the method's workings. Groups smaller than the layer's minGroup are hidden.

export type LayerStatus = "live" | "next";
export type SectorId = "banks" | "credit-unions" | "insurance" | "government" | "hospitals" | "universities";

export interface SectorDef { id: SectorId; label: string; status: LayerStatus; where: string }
export const SECTORS: SectorDef[] = [
  { id: "banks", label: "Banks", status: "live", where: "US, Europe, Colombia" },
  { id: "credit-unions", label: "Credit unions", status: "live", where: "United States" },
  { id: "insurance", label: "Insurance", status: "live", where: "Colombia" },
  { id: "government", label: "Government", status: "live", where: "US federal agencies" },
  { id: "hospitals", label: "Hospitals", status: "next", where: "United States" },
  { id: "universities", label: "Universities", status: "next", where: "US and UK" },
];

/** The live layers, each a file in lib/atlas built by scripts/atlas. */
/** How deep the evidence behind a reading goes. Public data gives financial
 *  ratios or a handful of operational measures; only an organisation's own
 *  systems give an operational assessment. */
export type Evidence = "financial" | "operational-limited" | "operational-full";
export const EVIDENCE: { id: Evidence; label: string; text: string }[] = [
  { id: "financial", label: "Financial indicators", text: "Public financial ratios only: profitability, capital, loan quality and costs. They show financial condition, not how operations actually run." },
  { id: "operational-limited", label: "Limited operational indicators", text: "A few published operational measures, such as how budgets are committed, reporting accuracy and request backlogs. Part of the operational picture, not all of it." },
  { id: "operational-full", label: "Operational assessment", text: "An organisation's own systems, read continuously across its operations, with causes, treatments and recovery. Available only from the organisation's own data." },
];
export const evidenceOf = (e: Evidence) => EVIDENCE.find((x) => x.id === e)!;

export interface LayerDef { id: string; sector: SectorId; title: string; publisher: string; asOf: string; evidence: Evidence }
export const LAYERS: LayerDef[] = [
  { id: "us-banks", sector: "banks", title: "US banks", publisher: "FDIC (US bank regulator)", asOf: "2026-06", evidence: "financial" },
  { id: "eu-banks", sector: "banks", title: "Europe's largest banks", publisher: "European Banking Authority", asOf: "2025-06", evidence: "financial" },
  { id: "co-banks", sector: "banks", title: "Colombian banks", publisher: "Superintendencia Financiera de Colombia", asOf: "2026-06", evidence: "financial" },
  { id: "us-credit-unions", sector: "credit-unions", title: "US credit unions", publisher: "NCUA (US credit union regulator)", asOf: "2026-06", evidence: "financial" },
  { id: "co-insurers", sector: "insurance", title: "Colombian insurers", publisher: "Superintendencia Financiera de Colombia", asOf: "2026-06", evidence: "financial" },
  { id: "us-government", sector: "government", title: "US federal agencies", publisher: "USAspending.gov (US Treasury) and FOIA.gov (US Justice Department)", asOf: "2025-09", evidence: "operational-limited" },
];

/** Where public institution-level data has been identified as the next to add
 *  (ISO 3166 numeric). Live countries come from the layers themselves. */
export const NEXT: Record<string, string> = {
  "124": "Next: banks and credit unions, from the national regulators' institution-level returns.",
  "036": "Next: banks and credit unions, from the prudential regulator's institution-level statistics.",
  "076": "Next: banks, from the central bank's institution-level data (its service is unavailable at the moment).",
  "356": "Next: banks, from the central bank's bank-wise statistics.",
  "826": "Next: the largest banks and insurers, from published regulatory disclosures; universities.",
  "484": "Next: banks, from the banking supervisor's published institution data.",
  "152": "Next: banks, from the financial market commission's institution data.",
  "604": "Next: banks, from the banking supervisor's institution data.",
};
export const ELSEWHERE = "No public institution-level data is available here yet. Organisations here are read from their own data, and placed among the nearest peers.";
