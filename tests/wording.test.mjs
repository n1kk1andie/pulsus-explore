// Explore's scores are calculated from published figures by fixed rules: no
// user-facing text calls them an "assessment". The not-official-ratings
// point stays wherever the scores are explained.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "data") walk(p); } else if (/\.(tsx?|mjs|js|json|webmanifest|html|txt|md)$/.test(f)) files.push(p); } };
for (const d of ["app", "components", "lib", "public"]) walk(join(root, d));
// The one exception: the FCA's own caveat, quoted word for word ("…to assess a firm's overall performance").
const QUOTED = "Complaints data should not be used on its own to assess a firm’s overall performance.";

test("no user-facing text in Explore says \"assessment\"", () => {
  assert.ok(files.length > 10);
  for (const f of files) {
    const src = readFileSync(f, "utf8").replace(QUOTED, "");
    assert.doesNotMatch(src, /assess/i, f.slice(root.length));
  }
});

test("the scores are still said not to be official regulatory ratings", () => {
  for (const f of ["components/MapApp.tsx", "components/Ops.tsx", "app/technology/page.tsx", "app/methodology/page.tsx"]) {
    assert.match(readFileSync(join(root, f), "utf8"), /They are not official regulatory ratings\./, f);
  }
});
