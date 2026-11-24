# Kinetic Souls as an app

- Installable PWA: `public/manifest.webmanifest`, `public/sw.js`, icons in `public/icons/` (original art, source `ks-icon.svg`).
- Android/desktop Chrome: INSTALL APP button appears; opens full screen, landscape.
- iPhone: Share, then Add to Home Screen (iOS has no install prompt and no browser Fullscreen API; the installed app is full screen).
- Offline after first load. Bump `VERSION` in `public/sw.js` each release.
- Lok standards: no emoji (run `node scripts/check-no-emoji.mjs artifacts/kinetic-souls/src`), icons are canvas paths in `drawIcon`, Lok tokens (#0A0A0C, teal #2DD4BF, gold #E8B64C), safe-area insets respected.
- Art: icons are the shared Lok Facet set copied to `src/ui/lok-facet/` (canvas `drawGlyph`). 12 new Facet glyphs were drawn for this game in that folder's `build-lok-glyphs.py` (timer, trophy, infinity, horde, infection, pvp, bot, ffa, play, pause, settings, book). TODO for the next AI: upstream them into `Lok-EcoSystsem/components/lok-facet-glyphs/` so every game shares them.
- UI behavior layer: DOM controls (app buttons, Live Mods panel, spawn buttons, Touch controls switch) use Vercel ui-sdk `@ui-sdk/react` pinned to `0.1.0-beta.16`. beta.17 was blocked by the repo's pnpm release-age policy; the policy was left alone. Canvas menus and gameplay stay on canvas (baseline says ui-sdk is not for canvas rendering).
- Not done: real Lok Passport login. The account backend is still design-only (`docs/ACCOUNT_IMPLEMENTATION_STATUS.md` in Lok-EcoSystsem, blocked on R-1), so "Connect LoK Passport (demo)" stays a stub. The canvas menus are not keyboard or agent operable (canvas cannot expose ui-sdk parts).
- Checked: desktop and landscape phone in headless Chrome, typecheck, build, no-emoji script. Not checked: a real iPhone (install, safe areas, audio), ui-sdk `@ui-sdk/core/testing` suite, the skill install step.
