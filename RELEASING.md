# Releasing

GitHub Actions is manual-only to keep costs near zero. This repository has no
workflows; Vercel builds every push. Run these before merging to `main`:

```sh
npm ci
npm test
npm run build   # also type-checks
```

This repository has no automated accessibility check; look over changed
screens by hand (keyboard, zoom, phone width).
