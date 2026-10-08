# Progress

## Done

- Home and fix pages, light and dark, TR and EN.
- Topo background, theme toggle, language pill, settings with reduced motion.
- GitHub source link with icon and arrow nudge.
- Import of zip-based `.fantome` and extracted mods.
- Champion and skin detection, pass options, log, `.modpkg` download.
- Original `info.json` identity preserved.
- zstd compression that does not OOM on a real skin.
- Scroll-driven About with a wide Discord profile. Header Discord stays a modal.
- Reset for the page and for the pass options.
- Glow hover on the main actions and the About profile.
- README, MIT license, Pages workflow.
- `scripts/check.mts` covers detection and metadata.

## Not done

- Raw `.wad.client` binaries. JSZip cannot open them.
- Pulling missing base assets from a League install.
- Shader hash tables and patch manifests from `cslol-tools`.
- A live size comparison against a desktop export of the user's own skin.

## Known constraints

Repo must be served under `/skin-fixer/` unless `base` and the router basename change. Pages source is GitHub Actions, not the branch file picker.
