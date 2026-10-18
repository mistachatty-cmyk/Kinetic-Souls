# Kinetic Souls page arena

`main.ts` is a small, standalone Kinetic Souls mode for fighting over a live webpage. Build it with `pnpm --filter @workspace/kinetic-souls build:page-overlay`; Demo Day copies the resulting `kinetic-page.js` into its deployment.

The host DOM is measured to create page targets but is never rewritten. A full-resolution damage layer covers broken target rectangles, and a separate quarter-resolution canvas draws crisp fighters, shots, enemies, and effects above the live page. Removing the Shadow DOM root restores the original view. This follows the layered pixel rendering technique described in [Sprite Fusion's rendering article](https://www.spritefusion.com/blog/pixel-art-rendering-trick-for-a-90s-look) without copying its code or artwork.

Controls: A/D or arrows move, W/Space jumps, Shift dashes, click or J/K fires, wheel scrolls the host page, Esc pauses. The original Kinetic Souls arena and match modes remain in `src/pages/KineticSouls.tsx`; this page mode adapts the game's momentum combat to DOM targets and can grow independently.
