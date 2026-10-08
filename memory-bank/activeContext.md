# Active context

Working tree: `skin-fixer/skin-fixer`. The repo root is this inner folder.

Published with GitHub Pages. `vite.config.ts` sets `base: "/skin-fixer/"`. `BrowserRouter` uses `basename="/skin-fixer"`. If the GitHub repo is renamed, both must change. Deploy workflow: `.github/workflows/pages.yml`. Pages source must be GitHub Actions.

Site URL shape: `https://<user>.github.io/skin-fixer/`.

Recent decisions:

- Output metadata comes from the imported `META/info.json`. Do not write "Skin Fixer" as the author.
- Output filename keeps the import name with a `.modpkg` extension.
- Chunks are zstd level 3 via `@bokuweb/zstd-wasm`. `zstd-codec` was removed because its wasm heap is fixed at 16 MB and aborted with OOM, which surfaced as "not a zip-based fantome".
- `xxhashjs` must be fed an `ArrayBuffer`, not a `Uint8Array`. A Uint8Array makes it call Node `Buffer` and throw "Buffer is not defined".
- Champion detection scores `WAD/<name>.wad.client`, `characters/<name>/skins/skinN`, `*_skinN.bin`, and `info.json`.
- Language pill is absolutely positioned, fixed width `w-[calc(50%-4px)]`, translated by `translate-x-full`. A grid child pill stretches and fills the TR side.
- Motion is short (about 0.2–0.3s). Settings can reduce it through `html[data-motion="reduced"]`.
- Discord id `772232490445176842`, Lanyard API. Header uses a modal. About uses `DiscordProfile`, which is always visible and has the `glow` hover.

Check script: `npx vite-node scripts/check.mts`. Typecheck: `npx tsc -b --pretty false`.
