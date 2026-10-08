# System patterns

## Layout

- `src/pages/Home.tsx` — landing, steps, scroll-driven About.
- `src/pages/Fix.tsx` — import, pass options, log, download, reset.
- `src/App.tsx` — theme, motion, i18n, route fade.
- `src/components/ui/topo-field.tsx` — full-bleed WebGL contour background in a sandboxed iframe. Mode follows `documentElement.dataset.theme`.
- `src/lib/i18n.tsx` — all visible copy, `tr` and `en`. Add strings here, not inline.
- `src/lib/theme.tsx`, `src/lib/motion.tsx` — localStorage keys `skin-fixer-theme` and `skin-fixer-motion`.

## Fix pipeline

`inspectSkin` reads the zip with JSZip and returns an `ImportReport`. `fixSkin` filters entries, repaths when an affix is set, and calls `buildModpkg`.

`buildModpkg` (`src/lib/fixer/modpkg.ts`) writes the cslol-go package:

- magic `_modpkg_`, version 1, little-endian
- one layer, `base`, priority 0
- null-terminated path table and wad name table, padded to 8 bytes
- 61-byte chunk descriptors, then payloads
- meta chunk `_meta_/info.msgpack` is uncompressed and has no layer and no wad (`0xffffffff`)
- other chunks are zstd when the compressed size is smaller
- path hash is XXH64 of the lowercased path, seed 0, stored as a little-endian u64 from the hex digest
- compressed and uncompressed checksums are the same XXH64

`scripts/check.mts` builds a fake Ahri fantome and checks champion, skin number, title, author, and magic.

## UI rules

- No native checkboxes or selects for the pass. Use `OptionRow` and `Segmented`.
- Primary actions use the `glow` class: slight scale and a soft shadow. Cursor is pointer.
- Page reset clears the import. Options reset restores `DEFAULT_OPTIONS` but keeps the detected skin number.
- Visual style is black or paper, thin borders, Outfit, light weight. Do not add gradient cards, emoji, or generic SaaS sections.
