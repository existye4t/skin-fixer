# Skin Fixer

A browser page for the Skin Fixer inside [cslol-go](https://github.com/Aurecueil/Cs-lol-go).

Drop a `.fantome` or an extracted mod zip, run the pass, and download a `.modpkg`. The file stays on your machine. Nothing is uploaded.

The downloaded package keeps the original name, author, version, description, and cover from `META/info.json`. Chunks are zstd compressed, the same way cslol-go writes them, so the size stays close to a desktop export.

The desktop tool can also read raw Riot `.wad` files, shader hash tables, and patch manifests. Those steps need a League install and `cslol-tools`. This page works on the archive you already have.

Made by Umut, A.K.A. Exist.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` writes a static site to `dist/`.

## Stack

React, TypeScript, Vite, Tailwind CSS. English and Turkish. Light and dark.
