# Kinetic Souls — Version Snapshots

Use the commit IDs below to roll back to any version via Replit's checkpoint system.

---

## ✅ STABLE V0.3.0 — Full Feature Build (Syntax Fixed)
**Commit:** `bdbc039`  
**Date:** 2026-03-30  
**Status: STABLE — use this as your safe restore point**  
- All features from passport, story mode, shatter effects, mobile controls, themes, environments, and LoK modifiers working together
- Game loop syntax error fixed (stray brace removed)
- "Welcome back, Sire." menu greeting
- Menu Settings button
- Grid background on menu
- Mobile Controls opt-in toggle
- Version snapshot log (this file)

---

## v0.2.5 — Passport, Story Mode & Shatter Effects
**Commit:** `985697a`  
**Date:** 2026-03-29  
- Reflection Passport screen with badge/achievement system (v0.1.0, v0.2.6, v0.3.5)
- Story Mode toggle in main menu
- Master Shatter click effect with physics shards & inverted echo
- Camera shake on impact
- Glitch boss entity with HP tracking
- Director Score display in HUD

---

## v0.4 — Mobile Touch Controls
**Commit:** `2fb1a69`  
**Date:** 2026-03-29  
- "Enable Mobile Controls" opt-in toggle
- P1 (red) and P2 (blue) on-screen spawn buttons
- Canvas touchstart handler: tap left half → spawn P1, tap right half → spawn P2
- touchAction: none on canvas to prevent scroll interference

---

## v0.3 — Themes, Environments & LoK Modifiers
**Commit:** `5d579e9`  
**Date:** 2026-03-29  
- 6 themes: classic / neon / gameboy / abyss / runesite / gsix
- 3 environments: ice rink / lava floor / black hole
- 3 camera modes: static / dynamic / action cam
- Modifiers: sudden death, titans
- Infection mode & horde mode
- CRT filter, motion trails, arena ads, tactical HUD & minimap
- Hand of God mouse drag
- Object pooling & grid-based spatial collision
- "LoK Game Modifiers" menu
- Live Modifiers panel (M key)

---

## v0.2 — Bug Fix: Module-Scope Render Functions
**Commit:** `1b233a4`  
**Date:** 2026-03-28  
- Fixed `drawGameOver is not defined` runtime error
- Moved `drawMenu`, `drawButton`, `drawGameOver` to module scope outside component

---

## v0.1 — Initial Game (Alpha Spark)
**Commit:** `1236de9`  
**Date:** 2026-03-27  
- Physics-based multi-part pixel art characters (head/arm/leg hitboxes)
- Characters bounce around arena, deal damage on body-part collision
- Ghost and explosion death animations
- HP bars above each fighter
- Scoreboard (timer mode & score-limit mode)
- Bot auto-spawning (PvP and PvB modes)
- Keyboard controls: A=P1 spawn, L=P2 spawn, Q=auto, P=pause, M=menu

---

## v0.0 — Project Bootstrap
**Commit:** `cc03321`  
**Date:** 2026-03-25  
- React + Vite monorepo scaffold
- Express API server
- Initial project structure

---

### How to roll back
In Replit, open the **Checkpoints** panel and select the snapshot matching the commit ID above, then click **Restore**.
