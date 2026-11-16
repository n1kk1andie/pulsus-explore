// robots.txt: search engines welcome on every page, nobody on /api/, and the
// crawlers that collect material to train AI models nowhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const robots = readFileSync(new URL("../app/robots.txt", import.meta.url), "utf8");

test("AI training crawlers are refused everywhere", () => {
  const training = robots.slice(0, robots.indexOf("User-agent: *"));
  for (const ua of ["GPTBot", "CCBot", "ClaudeBot", "Google-Extended", "Applebot-Extended", "Bytespider", "meta-externalagent"])
    assert.ok(training.includes(`User-agent: ${ua}\n`), ua);
  assert.match(training, /Disallow: \/\n/);
});

test("search engines may crawl every page, only not the API", () => {
  const everyone = robots.slice(robots.indexOf("User-agent: *"));
  assert.match(everyone, /^User-agent: \*\nAllow: \/\nDisallow: \/api\/\n?$/);
  for (const ua of ["Googlebot", "Bingbot", "OAI-SearchBot", "PerplexityBot"]) assert.ok(!robots.includes(`User-agent: ${ua}`), ua);
});
