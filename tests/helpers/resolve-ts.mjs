// Test-only module resolution for the TypeScript sources the Next build bundles:
// "@/x" → <repo>/x, and extensionless relative / package imports tried as
// .ts, .tsx, .js, /index.ts. Registered by tests that load modules with runtime
// (not type-only) imports: `register("./helpers/resolve-ts.mjs", import.meta.url)`.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TRY = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.js"];

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = pathToFileURL(path.join(ROOT, spec.slice(2))).href;
  let lastErr;
  for (const ext of TRY) {
    try {
      return await next(spec + ext, context);
    } catch (e) {
      lastErr = e;
      if (e?.code !== "ERR_MODULE_NOT_FOUND" && e?.code !== "ERR_UNSUPPORTED_DIR_IMPORT" && e?.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw e;
    }
  }
  throw lastErr;
}
