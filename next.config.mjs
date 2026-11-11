/** @type {import('next').NextConfig} */
import { fileURLToPath } from "url";
import { dirname } from "path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// Explore is a public, read-only window: no sign-in, no forms, no third-party
// scripts. Fonts come from Google Fonts; everything else is same-origin.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self' https://*.pulsus.tech",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${(process.env.NEXT_PUBLIC_PLATFORM_URL || "https://executive.pulsus.tech").replace(/\/+$/, "")}`,
  "worker-src 'self'",
  "manifest-src 'self'",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  async headers() {
    return [
      { source: "/:path*", headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
      ] },
      // The service worker must be able to control the whole app.
      { source: "/sw.js", headers: [{ key: "Service-Worker-Allowed", value: "/" }, { key: "Cache-Control", value: "no-cache" }] },
      // Android's app link check (Play Store app): served as JSON.
      { source: "/.well-known/assetlinks.json", headers: [{ key: "Content-Type", value: "application/json" }] },
    ];
  },
};

export default nextConfig;
