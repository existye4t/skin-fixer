# Tech context

React 19, TypeScript 6, Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`). Path alias `@` → `src`.

Runtime libraries: `jszip`, `@msgpack/msgpack`, `@bokuweb/zstd-wasm`, `xxhashjs`, `framer-motion`, `react-router-dom`, `lucide-react`.

Scripts:

- `npm run dev`
- `npm run build` — `tsc -b` then `vite build`, output `dist/`
- `npm run lint` — oxlint
- `npx vite-node scripts/check.mts`

GitHub Pages: workflow `.github/workflows/pages.yml` on push to `main`. Node 22, `npm ci`, upload `dist`.

Fonts load from Google Fonts in `index.html`: Outfit and IBM Plex Mono. Favicon is `public/favicon.svg`.

`xxhashjs` has no real types; `src/xxhashjs.d.ts` covers the slice we call. Do not switch checksums to a hand-rolled hash without a known test vector.
