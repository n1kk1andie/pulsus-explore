// Copy the finished Explore layers from a Pulsus Ops checkout (where they are
// built from public data each quarter) into this app. Only the anonymous
// aggregates are copied: never the engine or its method.
//   npm run sync-data -- ../ops
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const from = process.argv[2] || "../ops";
const LAYERS = ["us-banks", "eu-banks", "co-banks", "us-credit-unions", "co-insurers", "us-government", "us-hospitals"];
for (const id of LAYERS) {
  const src = join(from, "lib/atlas", `${id}.json`);
  if (!existsSync(src)) { console.error(`missing: ${src}`); process.exit(1); }
  copyFileSync(src, join("lib/atlas/data", `${id}.json`));
  console.log(`copied ${id}`);
}
