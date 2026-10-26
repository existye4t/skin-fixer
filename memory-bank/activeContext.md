# Active context

Working tree: `skin-fixer/skin-fixer`. The repo root is this inner folder.

Published with GitHub Pages. `vite.config.ts` sets `base: "/skin-fixer/"`. `BrowserRouter` uses `basename="/skin-fixer"`. If the GitHub repo is renamed, both must change. Deploy workflow: `.github/workflows/pages.yml`. Pages source must be GitHub Actions.

Site URL shape: `https://<user>.github.io/skin-fixer/`.

Recent decisions:

- Output metadata comes from the imported `META/info.json`. Do not write "Skin Fixer" as the author.
- Output filename keeps the import name with a `.modpkg` extension.
- Chunks are zstd level 3 via `@bokuweb/zstd-wasm`. `zstd-codec` was removed because its wasm heap is fixed at 16 MB and aborted with OOM, which surfaced as "not a zip-based fantome".
- `xxhashjs` must be fed an `ArrayBuffer`, not a `Uint8Array`. A Uint8Array makes it call Node `Buffer` and throw "Buffer is not defined".
- The fix page has two engines. `cslol` follows Topaz in `Aurecueil/Cs-lol-go` (`FixerMenu.xaml` + `Repatheruwu`). Sound and animation are auto/include/exclude. "Apply to all skins" is off when binless or all-available is on. 16.17 conversion always runs.
- `celestial` follows Celestial 2.4.2 Mac (`celestial` arm64, sha256 `692c3e62ac06659f077375f7acf57e09eacc22bb34d861841e8879ca948f049d`). QuickRepairOptions fields: stripMipmaps, fixTexDimensions, nukeMaterials, nukeGearSkinData, restoreSco, fixHpBar, plus import toggles textures, voiceover, gearSkin, missingVfx. Full mode logs the deep-repair step list from `src/repair/deep_repair/mod.rs`. Texture decode is `ltk_texture` in the app; the browser pulls the matching game file instead. There is no public source. Windows 2.4.1 is an NSIS installer and does not contain the repair strings.
- Shader names come from CommunityDragon `hashes.game.txt` lines containing `shader`. The bin link is FNV1a of the path, which is what `GetShaderOrFallback` compares.
- Manifest versions are the same `Tools/manifests.json` list. The browser does not download the wad.
- Language pill is absolutely positioned, fixed width `w-[calc(50%-4px)]`, translated by `translate-x-full`. A grid child pill stretches and fills the TR side.
- Motion is short (about 0.2–0.3s). Settings can reduce it through `html[data-motion="reduced"]`.
- Discord id `772232490445176842`, Lanyard API. Header uses a modal. About uses `DiscordProfile`, which is always visible and has the `glow` hover.

Check script: `npx vite-node scripts/check.mts`. Typecheck: `npx tsc -b --pretty false`.
