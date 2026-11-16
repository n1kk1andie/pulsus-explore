// Operational Health: rebuilt from the publishers' raw files, checked against
// the publishers' own published figures, and scored by the published formula.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { register } from "node:module";
register("./helpers/resolve-ts.mjs", import.meta.url);

const { INDICATORS, OPS_SOURCES, OPS_MIN_GROUP, MIN_COMPLAINTS, scoreOf, opsGroup, subScore, cfpbIndicators, fcaIndicators } = await import("../lib/atlas/operational.ts");
const { readXlsx } = await import("../scripts/operational/xlsx.mjs");
const root = new URL("../", import.meta.url);
const RAW = new URL("data/operational/raw/", root);
const ops = JSON.parse(readFileSync(new URL("lib/atlas/data/operational.json", root), "utf8"));
const byName = (n) => { const i = ops.institutions.find((x) => x.listedAs.includes(n) || x.name === n); assert.ok(i, n); return i; };

test("the raw files are the ones the data was built from (SHA-256)", () => {
  for (const [f, h] of Object.entries(ops.raw)) assert.equal(createHash("sha256").update(readFileSync(new URL(f, RAW))).digest("hex"), h, f);
});

// ── United States: the CFPB's complaint records, counted again ─────────────────
const csv = (text) => {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else f += c; }
  const [h, ...rest] = rows; return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
};
const aggs = JSON.parse(readFileSync(new URL("cfpb-aggregates.json", RAW), "utf8"));
const fixtures = readdirSync(new URL("cfpb-records/", RAW)).filter((f) => f.endsWith(".csv"));

test("CFPB: complaint records counted from raw match the CFPB's own counts, and the indicators built from them", () => {
  assert.ok(fixtures.length >= 4);
  for (const f of fixtures) {
    const recs = csv(readFileSync(new URL(`cfpb-records/${f}`, RAW), "utf8"));
    const company = recs[0].company;
    const inWindow = recs.filter((r) => r.date_received.slice(0, 10) >= ops.cfpbWindow[0] && r.date_received.slice(0, 10) <= ops.cfpbWindow[1]);
    assert.equal(inWindow.length, recs.length, `${company}: every record is in the period`);
    assert.equal(new Set(recs.map((r) => r.complaint_id)).size, recs.length, `${company}: no record twice`);
    const pub = aggs.companies[company];
    // The publisher's published figures: total, timely Yes/No and each company response.
    assert.equal(recs.length, pub.total, `${company} total`);
    for (const k of ["Yes", "No"]) assert.equal(recs.filter((r) => r.timely === k).length, pub.timely[k] || 0, `${company} timely ${k}`);
    for (const [k, n] of Object.entries(pub.company_response)) assert.equal(recs.filter((r) => r.company_response === k).length, n, `${company} ${k}`);
    // Our indicators, from the records alone, equal the built data.
    const i = byName(company);
    const raw = cfpbIndicators({ total: recs.length, timelyYes: recs.filter((r) => r.timely === "Yes").length, timelyNo: recs.filter((r) => r.timely === "No").length }, i.size.value);
    assert.equal(i.complaints, recs.length);
    assert.equal(i.ind.timely, raw.timely, `${company} timely %`);
    assert.equal(i.ind.rate, raw.rate, `${company} rate`);
  }
});

test("CFPB: worked examples (Hancock Whitney Bank, Bank OZK, Global Credit Union)", () => {
  const hw = byName("HANCOCK WHITNEY BANK"); assert.equal(hw.complaints, 97); assert.equal(hw.ind.timely, 97.9); assert.equal(hw.id, "12441");
  const ozk = byName("BANK OZK"); assert.equal(ozk.complaints, 60); assert.equal(ozk.ind.timely, 100); assert.equal(ozk.idKind, "FDIC certificate");
  const gcu = byName("GLOBAL CREDIT UNION"); assert.equal(gcu.complaints, 84); assert.equal(gcu.idKind, "NCUA charter");
  // Busey Bank: fewer than MIN_COMPLAINTS, so no score, with the reason.
  const b = scoreOf(byName("BUSEY BANK")); assert.equal(b.score, null); assert.match(b.reason, /Fewer than 50 complaints/);
});

// ── United Kingdom: the FCA's file, per product, rebuilt to its Grand Totals ────
const X = readXlsx(new URL("fca-firm-level-complaints-data-2026-h1.xlsx", RAW).pathname);
const sheet = (n) => { const [h, ...rows] = X[n]; return { h, by: new Map(rows.filter((r) => r[0]).map((r) => [String(r[0]).trim(), r])) }; };
const PRODUCTS = ["Banking and credit cards", "Decumulation & pensions", "Home finance", "Insurance & pure protection", "Investments"];
const S = { opened: sheet("Opened"), closed: sheet("Closed"), w3: sheet("Percentage within 3 days"), w8: sheet("Percentage after 3 days, within"), up: sheet("Percentage upheld"), prov: sheet("Context - Provision") };
const cell = (s, firm, col) => { const r = s.by.get(firm); const v = r?.[s.h.indexOf(col)]; return typeof v === "number" ? v : null; };
const FIRMS = ["Nationwide Building Society", "MONZO BANK LIMITED", "Aviva Insurance Limited", "Lloyds Bank PLC", "Santander UK Plc"];

test("FCA: each firm's Grand Totals rebuild from its per-product figures (to the FCA's rounding)", () => {
  for (const firm of FIRMS) {
    assert.equal(PRODUCTS.reduce((t, p) => t + (cell(S.opened, firm, p) ?? 0), 0), cell(S.opened, firm, "Grand Total"), `${firm} opened`);
    for (const k of ["w3", "w8", "up"]) {
      let num = 0, den = 0;
      for (const p of PRODUCTS) { const v = cell(S[k], firm, p), c = cell(S.closed, firm, p); if (v !== null && c !== null) { num += v * c; den += c; } }
      assert.ok(Math.abs(num / den - cell(S[k], firm, "Grand Total")) < 0.0015, `${firm} ${k}: ${num / den} vs ${cell(S[k], firm, "Grand Total")}`);
    }
  }
});

test("FCA: the indicators rebuild from the raw file and equal the built data", () => {
  for (const firm of FIRMS) {
    const opened = Object.fromEntries(PRODUCTS.map((p) => [p, cell(S.opened, firm, p) ?? 0]));
    const per1000 = Object.fromEntries(PRODUCTS.map((p) => [p, cell(S.prov, firm, p)]).filter(([, v]) => v !== null && v > 0));
    const { upheld, ...raw } = fcaIndicators({ totalOpened: cell(S.opened, firm, "Grand Total"), within3: cell(S.w3, firm, "Grand Total"), after3within8: cell(S.w8, firm, "Grand Total"), upheld: cell(S.up, firm, "Grand Total"), per1000, opened });
    const i = byName(firm);
    assert.deepEqual(i.ind, Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined)), firm);
    assert.equal(i.upheld, upheld, `${firm}: the upheld rate, kept beside the score`);
    assert.equal(i.complaints, cell(S.opened, firm, "Grand Total"));
  }
  // Worked by hand from the FCA's published Grand Totals: Nationwide closed 52.98% within 3 days and
  // 46.47% after 3 days but within 8 weeks, so 99.45%, shown 99.5%; it upheld 55.20%.
  const n = byName("Nationwide Building Society");
  assert.equal(n.ind.timely, 99.5); assert.equal(n.upheld, 55.2);
  // A single-product firm's rate is the FCA's own context figure: Revolut Bank UK, 0.31 per 1,000.
  assert.equal(byName("Revolut Bank UK Ltd").ind.rate, 0.31);
});

// ── the method ─────────────────────────────────────────────────────────────────
test("the score: weights add to 100, readings follow the fixed ranges, worked examples", () => {
  assert.equal(INDICATORS.reduce((t, d) => t + d.weight, 0), 100);
  assert.equal(subScore("cfpb", "rate", 1), 100); assert.equal(subScore("cfpb", "rate", 10), 50); assert.equal(subScore("cfpb", "rate", 100), 0);
  assert.equal(subScore("fca", "rate", 5), 50); assert.equal(subScore("fca", "timely", 75), 50);
  // US timeliness: 90% reads 0, 95% 50, 100% 100 (US_TIMELY_RANGE, checked against the data).
  assert.equal(subScore("cfpb", "timely", 90), 0); assert.equal(subScore("cfpb", "timely", 95), 50); assert.equal(subScore("cfpb", "timely", 100), 100);
  assert.equal(subScore("cfpb", "timely", 85), 0);
  // US: rate 10 (50) and timely 100% (100), weights 50:37.5 → (50×50 + 100×37.5) / 87.5 = 71.4 → 71.
  assert.equal(scoreOf({ source: "cfpb", complaints: 100, ind: { rate: 10, timely: 100 } }).score, 71);
  // UK: every reading 50 → 50; the same two parts as the US, in the same 57 : 43 balance.
  assert.equal(scoreOf({ source: "fca", complaints: 600, ind: { rate: 5, timely: 75 } }).score, 50);
  assert.deepEqual(scoreOf({ source: "fca", complaints: 600, ind: { rate: 5, timely: 75 } }).parts.map((p) => [p.id, p.weight]), [["rate", 57.1], ["timely", 42.9]]);
  assert.deepEqual(scoreOf({ source: "cfpb", complaints: 600, ind: { rate: 5, timely: 99 } }).parts.map((p) => [p.id, p.weight]), [["rate", 57.1], ["timely", 42.9]]);
  assert.equal(scoreOf({ source: "cfpb", complaints: MIN_COMPLAINTS - 1, ind: { rate: 1, timely: 100 } }).score, null);
});

test("complaints upheld is not scored: it is shown beside the score, for information only", () => {
  assert.ok(!INDICATORS.some((d) => d.id === "upheld"));
  // A firm that upholds fewer complaints scores no higher than one that upholds more.
  const a = { source: "fca", complaints: 600, ind: { rate: 2, timely: 95 } };
  assert.equal(scoreOf({ ...a, upheld: 5 }).score, scoreOf({ ...a, upheld: 90 }).score);
  for (const i of ops.institutions) assert.equal(i.ind.upheld, undefined, i.name);
  assert.ok(ops.institutions.filter((i) => i.source === "fca" && Number.isFinite(i.upheld)).length > 50);
  const app = readFileSync(new URL("components/Ops.tsx", root), "utf8");
  assert.match(app, /Shown for information, not scored/);
});

test("scores compare institutions within the same country only", () => {
  assert.throws(() => opsGroup(ops.institutions, null, null), /one country only/);
  for (const f of ["components/Ops.tsx", "app/methodology/page.tsx"]) assert.match(readFileSync(new URL(f, root), "utf8"), /Scores compare institutions within the same country only\./, f);
  // The directory's score orderings group by country before sorting by score.
  assert.match(readFileSync(new URL("components/MapApp.tsx", root), "utf8"), /byCountry\(a, b\) \|\| by\(a, b\)/);
});

test("every built score is the formula applied to the built indicators, and each institution is traceable", () => {
  for (const i of ops.institutions) {
    assert.ok(i.name && i.listedAs.length && i.match && i.source && i.period, i.key);
    if (i.country === "840") assert.match(i.id, /^\d+$/, `${i.name}: an FDIC certificate or NCUA charter`);
    const s = scoreOf(i);
    if (s.score !== null) { assert.ok(s.score >= 0 && s.score <= 100); assert.ok(s.parts.length >= 2); }
  }
});

test("group medians need at least 10 scored institutions, peer comparisons at least 20 (lib/atlas/bands.ts)", () => {
  assert.equal(OPS_MIN_GROUP, 20);
  for (const [c, s] of [["840", "banks"], ["840", "credit-unions"], ["826", "banks"], ["826", "insurance"], ["840", null], ["826", null]]) {
    const g = opsGroup(ops.institutions, c, s);
    if (g.n < 10) { assert.equal(g.hidden, true); assert.equal(g.median, undefined); } else assert.ok(Number.isFinite(g.median));
  }
  // US credit unions: 19 scored, so a limited sample, now with its median.
  const cu = opsGroup(ops.institutions, "840", "credit-unions");
  if (cu.n >= 10 && cu.n < 20) assert.equal(cu.hidden, false);
});

test("sources: each used one is free to reuse, with its licence and attribution; the others say why not", () => {
  for (const s of OPS_SOURCES) {
    assert.ok(s.licence && s.licenceUrl && s.url && s.checked, s.id);
    if (s.used) { assert.ok(s.attribution.length > 20 && s.caveat.length > 20, s.id); } else assert.ok(s.why && s.why.length > 20, s.id);
  }
  assert.match(OPS_SOURCES.find((s) => s.id === "fca").attribution, /Open Government Licence v3\.0/);
  assert.equal(ops.cfpbLicenceInApi, "CC0");
  assert.deepEqual(OPS_SOURCES.filter((s) => s.used).map((s) => s.id).sort(), ["cfpb", "fca"]);
});

test("neutral wording: complaints received, never accusations", () => {
  const files = ["lib/atlas/operational.ts", "components/Ops.tsx", "app/methodology/page.tsx"];
  for (const f of files) assert.doesNotMatch(readFileSync(new URL(f, root), "utf8"), /\b(worst|bad actor|failing|fraudulent|misconduct|guilty|offender)\b/i, f);
});
