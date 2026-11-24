# Lok Facet glyphs (shared Lok ecosystem icon set)

Original icon art for every Lok product. Reference implementation: 616 Survivor (`artifacts/survivor-616/src/ui/`). Rules: [`docs/LOK_DESIGN_STANDARD.md`](../../docs/LOK_DESIGN_STANDARD.md).

## Why
No emoji, no system symbols, no stock icon packs. Anything that looks pulled off a phone or by an AI is out. Facet is the house style: 24x24 grid, straight edges only, 30/45/60 degree angles, solid shards split by a thin slit.

## Files
- `build-lok-glyphs.py` -- the art. Edit shapes here, run `python3 build-lok-glyphs.py [output.ts]` (needs `pip install shapely`).
- `lokGlyphs.generated.ts` -- generated paths (one string per glyph). Do not edit by hand.
- `GameIcon.tsx` -- `GameIcon`, `RankMarks`, `GlyphText` for React. Unknown names fall back to plain text.
- `lokGlyphCanvas.ts` -- `drawGlyph(ctx, key, x, y, size, outline?)` for canvas, same paths.
- `lok-glyph-feedback.css` -- hover, focus, press, disabled and pop feedback. Paste into the app's global CSS. Reduced motion and power-save safe.
- Preview: render the generator's `/tmp/sheet.svg` (written on each run) to see every glyph.

## Using it in an app
1. Copy the four source files into the app's UI folder and add the CSS.
2. Store glyph keys in data (`icon: 'fire'`), never characters. Render with `<GameIcon name={icon} />`.
3. Icon-only buttons need an `aria-label`.
4. Add new glyphs in the script, in the same Facet language, then regenerate. Chess-specific glyphs for Loks Queens N Kings go in the same script so both games share one set.
5. Run `node scripts/check-no-emoji.mjs` in CI or before every commit (it bans emoji and stock symbols; the glyph kit itself is clean).
