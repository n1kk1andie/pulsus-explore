// IndexNow: the key file answers at https://explore.pulsus.tech/<key>.txt so
// Bing, Yandex and the other IndexNow engines accept URL submissions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const KEY = "6589a70edefc060c8df79e5dc92e2882";

test("public/<key>.txt holds exactly the 32-hex key", () => {
  assert.match(KEY, /^[0-9a-f]{32}$/);
  assert.equal(readFileSync(new URL(`../public/${KEY}.txt`, import.meta.url), "utf8"), KEY);
});

test("nothing intercepts the key path (no middleware or proxy)", () => {
  for (const f of ["middleware.ts", "middleware.js", "proxy.ts", "proxy.js"]) assert.ok(!existsSync(new URL(`../${f}`, import.meta.url)), f);
});
