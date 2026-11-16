// Operational Health for Explore: named institutions, from complaints data their
// regulators publish by name and license for reuse (lib/atlas/operational.ts has
// the method and the sources' licences). Built here, not in Pulsus Ops: the score
// is a public, documented formula with no engine in it.
//
//   node --experimental-strip-types scripts/operational/build.mjs ../ops [--fetch]
//
// --fetch downloads what is missing into data/operational/raw (each file kept as
// the publisher serves it, or the publisher's API answer, trimmed to the fields
// used). Without it, the build reads only what is already there, so the same raw
// files always give the same output. ../ops is a Pulsus Ops checkout: its named
// tables (atlas-institutions/*.json.gz) are the banks and credit unions Explore
// reads, with their official identifiers and total assets; only those used as
// the size measure of a matched institution are copied out.
import { register } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { readXlsx } from "./xlsx.mjs";
register("../../tests/helpers/resolve-ts.mjs", import.meta.url);
const { cfpbIndicators, fcaIndicators, scoreOf, opsGroup, MIN_COMPLAINTS } = await import("../../lib/atlas/operational.ts");

const ROOT = new URL("../../", import.meta.url).pathname;
const RAW = join(ROOT, "data/operational/raw");
const ops = process.argv.slice(2).find((a) => !a.startsWith("--")) || "../ops";
const FETCH = process.argv.includes("--fetch");
mkdirSync(join(RAW, "cfpb-records"), { recursive: true });

// The periods: CFPB complaints received over the twelve months to the end of
// Explore's latest quarter; the FCA's latest half-year.
export const CFPB_FROM = "2025-07-01", CFPB_TO = "2026-06-30";   // both inclusive in the CFPB API
const FCA_FILE = "fca-firm-level-complaints-data-2026-h1.xlsx";
const FCA_URL = "https://www.fca.org.uk/publication/data/firm-level-complaints-data-2026-h1.xlsx";
const CFPB_API = "https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/";
const FDIC_API = "https://api.fdic.gov/banks/institutions";

const curl = (url, out, args = []) => execFileSync("curl", ["-sSfL", "-m", "300", ...args, "-o", out, url]);
const getJson = (url) => JSON.parse(execFileSync("curl", ["-sSfL", "-m", "300", url], { maxBuffer: 64 << 20 }).toString("utf8"));
const need = (file, what) => { if (!existsSync(file)) { console.error(`missing ${file}: run with --fetch (${what})`); process.exit(1); } };
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const q = (o) => new URLSearchParams(o).toString();

// ── raw files ──────────────────────────────────────────────────────────────
const fcaPath = join(RAW, FCA_FILE);
if (FETCH && !existsSync(fcaPath)) curl(FCA_URL, fcaPath);
need(fcaPath, "FCA firm-level complaints data");

const fdicPath = join(RAW, "fdic-banks-10bn.json");
if (FETCH && !existsSync(fdicPath)) {
  const fields = "CERT,NAME,NAMEHCR,RSSDHCR,ASSET,STALP,REPDTE";
  const d = getJson(`${FDIC_API}?${q({ filters: "ACTIVE:1 AND ASSET:[10000000 TO *]", fields, limit: "1000", sort_by: "CERT" })}`);
  writeFileSync(fdicPath, JSON.stringify({ source: "FDIC BankFind Suite API, active institutions with total assets of $10bn or more", query: `${FDIC_API}?filters=ACTIVE:1 AND ASSET:[10000000 TO *]&fields=${fields}`,
    retrieved: new Date().toISOString().slice(0, 10), columns: fields.split(","), rows: d.data.map((x) => fields.split(",").map((k) => x.data[k])) }));
}
need(fdicPath, "FDIC list of $10bn+ banks");

const window = { date_received_min: CFPB_FROM, date_received_max: CFPB_TO };
const listPath = join(RAW, "cfpb-companies.json");
if (FETCH && !existsSync(listPath)) {
  const d = getJson(`${CFPB_API}?${q({ ...window, size: "0" })}`);
  writeFileSync(listPath, JSON.stringify({ source: "CFPB Consumer Complaint Database API: complaints received in the period, by company (the publisher's own counts)",
    query: `${CFPB_API}?${q({ ...window, size: "0" })}`, retrieved: new Date().toISOString().slice(0, 10), meta: { license: d._meta.license, last_updated: d._meta.last_updated },
    total: d.hits.total.value, companies: d.aggregations.company.company.buckets.map((b) => [b.key, b.doc_count]) }));
}
need(listPath, "CFPB company list");

// ── matching: CFPB companies to the banks and credit unions Explore reads ──────
const named = (id) => { const f = join(ops, "atlas-institutions", `${id}.json.gz`); need(f, `Pulsus Ops named table ${id}`); return JSON.parse(gunzipSync(readFileSync(f)).toString("utf8")); };
const banks = named("us-banks"), cus = named("us-credit-unions");
const byCert = new Map(banks.rows.map((r) => [String(r[0]), r]));
const fdic = JSON.parse(readFileSync(fdicPath, "utf8"));
const F = (r) => Object.fromEntries(fdic.columns.map((k, i) => [k, r[i]]));
const big = fdic.rows.map(F);

export const norm = (s) => s.toUpperCase().replace(/&/g, " AND ").replace(/[’'`.,()/-]/g, " ").replace(/\bTHE\b/g, " ")
  .replace(/\bNATIONAL ASSOCIATION\b/g, "NA").replace(/\bN A\b/g, "NA").replace(/\s+/g, " ").trim();
const normCu = (s) => norm(s).replace(/\b(FEDERAL CREDIT UNION|CREDIT UNION|FCU|INC)\b/g, " ").replace(/\s+/g, " ").trim();

// Holding companies the CFPB names, each with the FDIC's identifier (RSSD) for that
// holding company. Kept only when the FDIC shows exactly one active bank of $10bn or
// more under it (the CFPB publishes complaints about banks of that size), and its
// name shares the holding company's first word in the FDIC's records.
export const HOLDING = {
  "JPMORGAN CHASE & CO.": "1039502", "WELLS FARGO & COMPANY": "1120754", "CAPITAL ONE FINANCIAL CORPORATION": "2277860",
  "U.S. BANCORP": "1119794", "SYNCHRONY FINANCIAL": "4504654", "ALLY FINANCIAL INC.": "1562859", "TRUIST FINANCIAL CORPORATION": "1074156",
  "CITIZENS FINANCIAL GROUP, INC.": "1132449", "FIFTH THIRD FINANCIAL CORPORATION": "1070345", "M&T BANK CORPORATION": "1037003",
  "REGIONS FINANCIAL CORPORATION": "3242838", "PINNACLE FINANCIAL PARTNERS, INC.": "6073350", "AXOS FINANCIAL, INC.": "3814310",
  "FIRST CITIZENS BANCSHARES, INC.": "1075612", "CULLEN/FROST BANKERS, INC.": "1102367", "ARVEST BANK GROUP, INC.": "1095674",
  "AMERICAN EXPRESS COMPANY": "1275216", "SANTANDER HOLDINGS USA, INC.": "1239254", "SOFI TECHNOLOGIES, INC.": "5586871",
  "UNITED SERVICES AUTOMOBILE ASSOCIATION": "1447376", "KEYCORP": "1068025", "HSBC NORTH AMERICA HOLDINGS INC.": "1857108",
  "ASSOCIATED BANC-CORP": "1199563", "OLD NATIONAL BANCORP": "1098303", "UMB FINANCIAL CORPORATION": "1049828", "AMERIS BANCORP": "1082067",
  "WSFS FINANCIAL CORPORATION": "3844269", "SOUTHSTATE BANK CORPORATION": "1133437", "TRUSTMARK CORPORATION": "1079562",
  "VALLEY NATIONAL BANCORP": "1048773", "FULTON FINANCIAL CORPORATION": "1117129", "COLUMBIA BANKING SYSTEM, INC.": "2078816",
  "OFG BANCORP": "2490575", "SIMMONS FIRST NATIONAL CORPORATION": "1094828", "BOK FINANCIAL CORP": "1883693", "NORTHWEST BANCSHARES INC": "4122722",
  "Atlantic Union Bankshares, Inc.": "1971693", "BANK OF HAWAII CORPORATION": "1025309", "FIRST INTERSTATE BANCSYSTEM, INC.": "1123670",
  "PROSPERITY BANCSHARES, INC.": "1109599", "RENASANT CORPORATION": "1098844", "NBT BANCORP INC.": "1139279", "TEXAS CAPITAL BANCSHARES, INC.": "2706735",
  "CENTRAL BANCOMPANY, INC": "1094314", "FIRST COMMONWEALTH FINANCIAL CORPORATION": "1071306", "FIRST HAWAIIAN, INC.": "1025608",
  "UNITED BANKSHARES, INC.": "1076217", "FIRST MERCHANTS CORPORATION": "1208559", "BEACON FINANCIAL CORPORATION": "2333663",
  "EASTERN BANKSHARES INC": "1427239", "Glacier Bancorp Inc.": "2003975", "BANNER CORPORATION": "2126977", "INDEPENDENT BANK CORP.": "1136803",
  "FIRST FINANCIAL BANCORP": "1071276", "HOPE BANCORP, INC.": "2961879", "SEACOAST BANKING CORPORATION OF FLORIDA": "1085013",
  "HOME BANCSHARES, INC.": "1491409", "WESTERN ALLIANCE BANCORPORATION": "2349815", "CUSTOMERS BANCORP, INC": "4284536",
  // Two or more $10bn banks under one holding company: not matched (the rule below drops them).
  "BANK OF NEW YORK MELLON CORPORATION, THE": "3587146", "TD BANK US HOLDING COMPANY": "1238565", "CHARLES SCHWAB CORPORATION, THE": "1026632",
};
/** Names the CFPB uses for a bank itself, differing from its FDIC legal name by more than punctuation. */
export const SAME_BANK = { "ZIONS BANCORPORATION": { cert: "2270", why: "the bank's legal name, Zions Bancorporation, N.A., without “N.A.”" } };

const cfpbList = JSON.parse(readFileSync(listPath, "utf8"));
const matches = new Map();   // key → { kind, id, listedAs[], match }
const addMatch = (key, m, company) => { const x = matches.get(key); if (x) x.listedAs.push(company); else matches.set(key, { ...m, listedAs: [company] }); };
const rejected = [];
const joinInitials = (s) => s.replace(/\b(\w) (?=\w\b)/g, "$1");   // "U S BCORP" → "US BCORP"
const firstWord = (s) => joinInitials(norm(s)).split(" ").find((w) => w.length > 1) || "";
for (const [company] of cfpbList.companies) {
  const n = norm(company);
  // A bank, by its own legal name: unique among the FDIC's $10bn+ banks, and read by Explore.
  const same = big.filter((b) => norm(b.NAME) === n);
  if (same.length === 1 && byCert.has(String(same[0].CERT))) { addMatch(`us-bank-${same[0].CERT}`, { kind: "bank", id: String(same[0].CERT), match: "Same legal name as the FDIC-insured bank" }, company); continue; }
  if (SAME_BANK[company] && byCert.has(SAME_BANK[company].cert)) { addMatch(`us-bank-${SAME_BANK[company].cert}`, { kind: "bank", id: SAME_BANK[company].cert, match: `Published under ${SAME_BANK[company].why}` }, company); continue; }
  if (HOLDING[company]) {
    const under = big.filter((b) => String(b.RSSDHCR) === HOLDING[company]);
    const word = firstWord(company);
    if (under.length !== 1) { rejected.push([company, `${under.length} banks of $10bn or more under the holding company`]); continue; }
    if (!` ${joinInitials(norm(under[0].NAMEHCR))} `.includes(` ${word} `)) { rejected.push([company, `holding company name does not match the FDIC's (${under[0].NAMEHCR})`]); continue; }
    if (!byCert.has(String(under[0].CERT))) { rejected.push([company, "bank not read by Explore"]); continue; }
    addMatch(`us-bank-${under[0].CERT}`, { kind: "bank", id: String(under[0].CERT), match: `Published under its holding company, ${under[0].NAMEHCR} (FDIC holding company RSSD ${HOLDING[company]}), whose only bank of $10bn or more this is` }, company);
    continue;
  }
  // A credit union, by name: unique among the NCUA's credit unions of $10bn or more that Explore reads.
  if (/CREDIT UNION/i.test(company)) {
    const c = normCu(company);
    const hit = cus.rows.filter((r) => r[5] >= 10000 && normCu(r[1]) === c);
    if (hit.length === 1) addMatch(`us-cu-${hit[0][0]}`, { kind: "cu", id: String(hit[0][0]), match: "Same name as the NCUA-insured credit union" }, company);
  }
}
for (const [company, why] of rejected) console.log(`  not matched: ${company} (${why})`);

// ── each matched company's counts, from the CFPB (cached) ───────────────────────
const aggPath = join(RAW, "cfpb-aggregates.json");
const aggs = existsSync(aggPath) ? JSON.parse(readFileSync(aggPath, "utf8")) : { source: "CFPB Consumer Complaint Database API: each matched company's complaints in the period, counted by the publisher", window, retrieved: null, companies: {} };
const wanted = [...matches.values()].flatMap((m) => m.listedAs);
for (const company of wanted) {
  if (aggs.companies[company]) continue;
  if (!FETCH) { console.error(`missing CFPB counts for ${company}: run with --fetch`); process.exit(1); }
  const d = getJson(`${CFPB_API}?${q({ ...window, company, size: "0" })}`);
  const b = (k) => Object.fromEntries(d.aggregations[k][k].buckets.map((x) => [x.key, x.doc_count]));
  aggs.companies[company] = { total: d.hits.total.value, timely: b("timely"), company_response: b("company_response") };
  aggs.retrieved = new Date().toISOString().slice(0, 10);
}
writeFileSync(aggPath, JSON.stringify(aggs, null, 0));

// A few companies' complaint records themselves, so the tests can count them again
// from the records and check the publisher's totals (tests/operational.test.mjs).
export const RECORD_FIXTURES = ["HANCOCK WHITNEY BANK", "BANK OZK", "GLOBAL CREDIT UNION", "BUSEY BANK"];
const FIELDS = ["complaint_id", "date_received", "company", "product", "timely", "company_response", "submitted_via"];
for (const company of RECORD_FIXTURES) {
  const f = join(RAW, "cfpb-records", `${company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`);
  if (existsSync(f) || !FETCH) continue;
  const d = getJson(`${CFPB_API}?${q({ ...window, company, size: "1000", sort: "created_date_desc", no_aggs: "true" })}`);
  if (d.hits.hits.length !== d.hits.total.value) throw new Error(`${company}: ${d.hits.hits.length} of ${d.hits.total.value} records`);
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  writeFileSync(f, [FIELDS.join(","), ...d.hits.hits.map((h) => FIELDS.map((k) => esc(h._source[k])).join(","))].join("\n") + "\n");
}

// ── US institutions ────────────────────────────────────────────────────────────
const period = "Complaints received 1 July 2025 to 30 June 2026";
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const institutions = [];
for (const [key, m] of matches) {
  const row = m.kind === "bank" ? byCert.get(m.id) : cus.rows.find((r) => String(r[0]) === m.id);
  const c = { total: 0, timelyYes: 0, timelyNo: 0, relief: 0, inProgress: 0 };
  for (const name of m.listedAs) {
    const a = aggs.companies[name];
    c.total += a.total; c.timelyYes += a.timely.Yes || 0; c.timelyNo += a.timely.No || 0;
    c.relief += (a.company_response["Closed with monetary relief"] || 0) + (a.company_response["Closed with non-monetary relief"] || 0);
    c.inProgress += a.company_response["In progress"] || 0;
  }
  const assets = row[5];
  const ind = cfpbIndicators(c, assets);
  institutions.push({
    // A credit union by the full name the CFPB publishes (the NCUA tables shorten it: "PENTAGON").
    key, name: (m.kind === "cu" ? m.listedAs[0] : String(row[1])).replace(/\s+/g, " ").trim(), listedAs: m.listedAs, match: m.match, country: "840",
    sector: m.kind === "bank" ? "banks" : "credit-unions", idKind: m.kind === "bank" ? "FDIC certificate" : "NCUA charter", id: m.id,
    source: "cfpb", period, complaints: c.total,
    size: { label: "Total assets", value: Math.round(assets), unit: "USD millions", source: `${m.kind === "bank" ? "FDIC" : "NCUA"}, ${banks.asOf}` },
    ind: Object.fromEntries(Object.entries(ind).filter(([, v]) => v !== undefined)),
    context: [
      { label: "Complaints received", value: c.total.toLocaleString("en-US") },
      { label: "Closed with relief (monetary or other)", value: pct(c.relief, c.total) },
      ...(c.inProgress ? [{ label: "Still in progress", value: c.inProgress.toLocaleString("en-US") }] : []),
    ],
  });
}

// ── UK institutions: the FCA's firm-level file ─────────────────────────────────
const X = readXlsx(fcaPath);
const sheet = (name) => { const [h, ...rows] = X[name]; return { h, by: new Map(rows.filter((r) => r[0]).map((r) => [String(r[0]).trim(), r])) }; };
const opened = sheet("Opened"), closed = sheet("Closed"), w3 = sheet("Percentage within 3 days"), w8 = sheet("Percentage after 3 days, within"), up = sheet("Percentage upheld"), prov = sheet("Context - Provision");
const PRODUCTS = ["Banking and credit cards", "Decumulation & pensions", "Home finance", "Insurance & pure protection", "Investments"];
const at = (s, firm, colName) => { const r = s.by.get(firm); if (!r) return null; const i = s.h.indexOf(colName); const v = r[i]; return typeof v === "number" ? v : null; };
const frn = new Map(X["Trading Names"].slice(1).filter((r) => r[0]).map((r) => [String(r[0]).trim().toUpperCase(), r[1]]));
// Which firms are banks and which insurers: by name, and for insurers by where their complaints are.
const BANK = /\bbank\b|building society|\bbanking\b/i;
const BANK_ALSO = ["Santander UK Plc", "Coutts & Company"];   // banks whose names do not say so
const INSURER = /insurance|assurance|underwriting|\blife\b|friendly society/i;
for (const [firm, r] of opened.by) {
  const o = Object.fromEntries(PRODUCTS.map((p) => [p, at(opened, firm, p) ?? 0]));
  const total = at(opened, firm, "Grand Total") ?? 0;
  const insShare = total ? ((o["Insurance & pure protection"] || 0) + (o["Decumulation & pensions"] || 0)) / total : 0;
  const sector = INSURER.test(firm) && insShare >= 0.5 ? "insurance" : (BANK.test(firm) || BANK_ALSO.includes(firm)) && !INSURER.test(firm) ? "banks" : null;
  if (!sector) continue;
  const per1000 = Object.fromEntries(PRODUCTS.map((p) => [p, at(prov, firm, p)]).filter(([, v]) => v !== null && v > 0));
  const ind = fcaIndicators({ totalOpened: total, within3: at(w3, firm, "Grand Total"), after3within8: at(w8, firm, "Grand Total"), upheld: at(up, firm, "Grand Total"), per1000, opened: o });
  const id = frn.get(firm.toUpperCase());
  const closedN = at(closed, firm, "Grand Total");
  const w3v = at(w3, firm, "Grand Total");
  institutions.push({
    key: `uk-fca-${id ?? firm.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: firm, listedAs: [firm], match: "Named by the FCA (its firm-level data)", country: "826", sector,
    idKind: id ? "FCA firm reference number" : "FCA firm-level data", id: id ? String(id) : "", group: r[1] && r[1] !== "NO GROUP" ? String(r[1]) : undefined,
    source: "fca", period: `Reporting period ${String(r[3]).replace(" to ", " to ")}`, complaints: total,
    ...(Object.keys(per1000).length ? { size: { label: "accounts or policies, as implied by the FCA’s context data", value: Math.round((Object.entries(per1000).reduce((t, [p, v]) => t + (o[p] / v) * 1000, 0))), unit: "accounts", source: "FCA, 2026 H1" } } : {}),
    ind: Object.fromEntries(Object.entries(ind).filter(([, v]) => v !== undefined)),
    context: [
      { label: "Complaints opened", value: total.toLocaleString("en-US") },
      ...(closedN !== null ? [{ label: "Complaints closed", value: closedN.toLocaleString("en-US") }] : []),
      ...(w3v !== null ? [{ label: "Closed within 3 days", value: `${(w3v * 100).toFixed(1)}%` }] : []),
    ],
  });
}
institutions.sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));

// ── write ──────────────────────────────────────────────────────────────────────
const raw = {};
for (const f of [FCA_FILE, "fdic-banks-10bn.json", "cfpb-companies.json", "cfpb-aggregates.json"]) raw[f] = sha(join(RAW, f));
const out = { built: new Date().toISOString().slice(0, 10), cfpbWindow: [CFPB_FROM, CFPB_TO], cfpbLicenceInApi: cfpbList.meta.license, raw, institutions,
  notShown: { cfpbCompanies: cfpbList.companies.length - wanted.length, note: "Companies in the CFPB data not matched to a bank or credit union Explore reads, and FCA firms that are not banks or insurers, are not shown." } };
writeFileSync(join(ROOT, "lib/atlas/data/operational.json"), JSON.stringify(out));
const scored = institutions.filter((i) => scoreOf(i).score !== null);
console.log(`operational: ${institutions.length} institutions (${scored.length} scored; fewer than ${MIN_COMPLAINTS} complaints or 2 measures leave the rest unscored) · ${(JSON.stringify(out).length / 1024).toFixed(0)} KB`);
for (const [c, s] of [["840", "banks"], ["840", "credit-unions"], ["826", "banks"], ["826", "insurance"], ["840", null], ["826", null]]) {
  const g = opsGroup(institutions, c, s); console.log(`  ${c} ${s ?? "all"}: ${g.n} scored of ${g.listed}${g.hidden ? " (fewer than 20: no median)" : ` · median ${g.median}`}`);
}
