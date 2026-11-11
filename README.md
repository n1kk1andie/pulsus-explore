# Pulsus Explore

A free window on the world's sectors: the health of banks, credit unions,
insurers and government agencies, read from public data. Served at
**explore.pulsus.tech**, installable as an app, and ready to wrap for the
Google Play Store.

Explore is the public front door. Its one way out is **"Connect your
organisation to see yours"**, which leads businesses to Pulsus Platform.
Everyday visitors and business customers never share a space: this app has no
sign-in, no accounts and no customer data.

## What is in this repo, and what is not

- **In:** the Explore screens, the sector catalogue, and the finished,
  anonymous figures in `lib/atlas/data/*.json` (medians, counts and the
  Stable / Steady / Fragile split by country, state and size).
- **Not in, ever:** the Pulsus engine, its method or weights, any institution's
  name or figures, or any Pulsus Platform code. `npm test` checks this.

## Run it

```
npm install
npm run dev        # http://localhost:3000
npm test           # depth, anonymity, and no engine code
npm run build
```

Optional: `NEXT_PUBLIC_PLATFORM_URL` (the Pulsus Platform address) adds a
"Start a 14-day trial" button beside "Talk to us".

## Refreshing the figures (each quarter)

The figures are built from public data in the Pulsus Ops repo
(`scripts/atlas/*`). After a rebuild there, copy them here and commit:

```
npm run sync-data -- ../ops
npm test && npm run build
```

## Deploying

Create a hosting project from this repo (framework: Next.js, no settings
needed) and point **explore.pulsus.tech** at it. Every page is static; there is
no database and no secret.

## The Google Play Store app

Explore is a Progressive Web App (manifest, icons, offline page and service
worker are all here), so it is published as a **Trusted Web Activity**: a thin
Android app that opens explore.pulsus.tech full screen. Updates to the site
reach the app with no new store release.

1. Deploy, and check https://explore.pulsus.tech opens.
2. Build the Android package with **PWABuilder** (pwabuilder.com: enter the
   address, choose Android) or Google's **Bubblewrap** (`npx @bubblewrap/cli init
   --manifest https://explore.pulsus.tech/manifest.webmanifest`).
   Package id suggestion: `tech.pulsus.explore`.
3. Upload the package in the Play Console. Under **App integrity → App
   signing**, copy the **SHA-256 certificate fingerprint**.
4. Add `public/.well-known/assetlinks.json` with that fingerprint and redeploy:

   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": { "namespace": "android_app", "package_name": "tech.pulsus.explore",
                 "sha256_cert_fingerprints": ["AA:BB:…"] }
   }]
   ```

   Without it the app still works, but shows a browser address bar.
5. Store listing: privacy policy URL **https://explore.pulsus.tech/privacy**.
   Data safety: no data collected or shared. No accounts, so no account
   deletion is needed. Icon: `public/icon-512.png` (vector source
   `public/icon.svg`).

© 2026 Tumblehill Holdings LLC.
