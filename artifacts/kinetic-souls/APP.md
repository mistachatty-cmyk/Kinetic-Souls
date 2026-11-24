# Kinetic Souls as an app

- Installable PWA: `public/manifest.webmanifest`, `public/sw.js`, icons in `public/icons/` (original art, source `ks-icon.svg`).
- Android/desktop Chrome: INSTALL APP button appears; opens full screen, landscape.
- iPhone: Share, then Add to Home Screen (iOS has no install prompt and no browser Fullscreen API; the installed app is full screen).
- Offline after first load. Bump `VERSION` in `public/sw.js` each release.
- Lok standards: no emoji (run `node scripts/check-no-emoji.mjs artifacts/kinetic-souls/src`), icons are canvas paths in `drawIcon`, Lok tokens (#0A0A0C, teal #2DD4BF, gold #E8B64C), safe-area insets respected.
- Not done yet: ui-sdk behavior layer (baseline says not for canvas rendering; only the DOM overlay buttons qualify), real Lok Passport login (current one is a demo stub), Lok Facet art for the icons.
