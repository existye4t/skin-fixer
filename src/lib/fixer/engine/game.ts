// Port of game.js – index of installed game's WAD files.
import { RangeReader, readToc, readEntry } from "./wad";
import type { TocEntry } from "./wad";
import { hashPath } from "./hash";

type WadEntry = { name: string; path: string; reader: RangeReader; toc: TocEntry[]; set?: Set<bigint> };

export class GameIndex {
  wads: WadEntry[] = [];
  map = new Map<bigint, { w: WadEntry; e: TocEntry }>();
  character = "";

  async load(files: { name: string; path: string; file: File | Blob }[], onProgress?: (i: number, n: number) => void) {
    const wads = files.filter(f => /\.wad\.client$/i.test(f.name));
    let i = 0;
    for (const f of wads) {
      const reader = new RangeReader(f.file);
      const toc = await readToc(reader).catch(() => null);
      if (toc) this.wads.push({ name: f.name, path: f.path, reader, toc });
      onProgress?.(++i, wads.length);
    }
    this.reorder("");
  }

  reorder(character: string) {
    this.character = character;
    const tok = character.toLowerCase();
    this.wads.sort((a, b) => {
      const pa = tok && a.name.toLowerCase().includes(tok) ? 0 : 1;
      const pb = tok && b.name.toLowerCase().includes(tok) ? 0 : 1;
      return pa - pb || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    });
    this.map = new Map();
    for (const w of this.wads) for (const e of w.toc) if (!this.map.has(e.hash)) this.map.set(e.hash, { w, e });
  }

  get ready() { return this.wads.length > 0; }
  has(hash: bigint) { return this.map.has(hash); }
  async read(hash: bigint): Promise<Uint8Array | null> {
    const r = this.map.get(hash);
    return r ? readEntry(r.w.reader, r.e) : null;
  }

  skinNumbers(character: string, wadName = ""): number[] {
    const tok = wadName.toLowerCase();
    const wads = this.wads.filter(w => !tok || w.name.toLowerCase().includes(tok) || w.path.toLowerCase().includes(tok));
    const sets = wads.map(w => (w.set ??= new Set(w.toc.map(e => e.hash))));
    const found: number[] = [];
    for (let i = 0; i < 100; i++) { const h = hashPath(`data/characters/${character}/skins/skin${i}.bin`); if (sets.some(s => s.has(h))) found.push(i); }
    return found;
  }
}

export async function filesFromDirHandle(handle: FileSystemDirectoryHandle, prefix = ""): Promise<{ name: string; path: string; file: File }[]> {
  const out: { name: string; path: string; file: File }[] = [];
  for await (const [name, h] of (handle as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
    if ((h as FileSystemDirectoryHandle).kind === "directory") out.push(...(await filesFromDirHandle(h as FileSystemDirectoryHandle, prefix + name + "/")));
    else if (/\.wad\.client$/i.test(name)) out.push({ name, path: prefix + name, file: await (h as FileSystemFileHandle).getFile() });
  }
  return out;
}

export function filesFromFileList(list: FileList): { name: string; path: string; file: File }[] {
  return [...list].filter(f => /\.wad\.client$/i.test(f.name)).map(f => ({ name: f.name, path: f.webkitRelativePath || f.name, file: f }));
}
