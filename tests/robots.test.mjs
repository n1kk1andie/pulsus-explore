// robots.txt: Explore is public, so search engines and AI assistants may read
// every page and describe it correctly. Bulk scrapers are refused, nobody is let
// onto /api/, and the sitemap lists every public page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const robots = readFileSync(new URL("../app/robots.txt", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../app/sitemap.xml", import.meta.url), "utf8");

function groups(text) {
  const out = [];
  let cur = null;
  for (const line of text.split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean)) {
    const [k, ...v] = line.split(":");
    const key = k.trim().toLowerCase(), val = v.join(":").trim();
    if (key === "user-agent") {
      if (!cur || cur.rules.length) out.push((cur = { agents: [], rules: [] }));
      cur.agents.push(val.toLowerCase());
    } else if (key === "allow" || key === "disallow") cur.rules.push([key, val]);
  }
  return out;
}
const g = groups(robots);
const rulesFor = (ua) => g.find((x) => x.agents.includes(ua.toLowerCase()))?.rules;

test("bulk scrapers are refused everywhere", () => {
  for (const ua of ["CCBot", "Bytespider"]) assert.deepEqual(rulesFor(ua), [["disallow", "/"]], ua);
});

test("search engines and AI assistants may read every page, never the API", () => {
  const welcome = ["Googlebot", "Bingbot", "Google-Extended", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Applebot", "Applebot-Extended", "DuckAssistBot", "meta-externalagent", "*"];
  for (const ua of welcome) assert.deepEqual(rulesFor(ua), [["allow", "/"], ["disallow", "/api/"]], ua);
});

test("the sitemap is named and lists every public page", () => {
  assert.ok(robots.includes("Sitemap: https://explore.pulsus.tech/sitemap.xml"));
  const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ["/", "/technology", "/methodology", "/privacy"].map((p) => `https://explore.pulsus.tech${p}`));
});
