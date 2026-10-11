// Port of wad.js – WAD v3 reading/writing + ModSource.
import { decompress as fzstdDecompress } from "fzstd";
import { gunzipSync } from "fflate";
import { xxh64, hashPath } from "./hash";

const isZstd = (d: Uint8Array) => d.length >= 4 && d[0] === 0x28 && d[1] === 0xb5 && d[2] === 0x2f && d[3] === 0xfd;
const isGzip = (d: Uint8Array) => d.length >= 2 && d[0] === 0x1f && d[1] === 0x8b;

export function inflateEntry(raw: Uint8Array, type: number): Uint8Array {
  if (isZstd(raw) || type === 3) { try { return fzstdDecompress(raw); } catch { return raw; } }
  if (isGzip(raw) || type === 1) return gunzipSync(raw);
  return raw;
}

export class RangeReader {
  src: Uint8Array | File | Blob; size: number;
  constructor(src: Uint8Array | File | Blob) { this.src = src; this.size = (src as Uint8Array).byteLength ?? (src as File).size; }
  async read(offset: number, length: number): Promise<Uint8Array> {
    if (this.src instanceof Uint8Array) return this.src.subarray(offset, offset + length);
    return new Uint8Array(await (this.src as File).slice(offset, offset + length).arrayBuffer());
  }
}

export type TocEntry = { hash: bigint; offset: number; csize: number; usize: number; type: number };

export async function readToc(reader: RangeReader): Promise<TocEntry[] | null> {
  if (reader.size < 272) return null;
  const head = await reader.read(0, 272);
  if (head[0] !== 0x52 || head[1] !== 0x57) return null;
  const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
  const count = dv.getUint32(268, true);
  const tocBytes = await reader.read(272, count * 32);
  const tdv = new DataView(tocBytes.buffer, tocBytes.byteOffset, tocBytes.byteLength);
  const n = Math.min(count, Math.floor(tocBytes.length / 32));
  const entries: TocEntry[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 32;
    entries[i] = { hash: tdv.getBigUint64(o, true), offset: tdv.getUint32(o + 8, true), csize: tdv.getUint32(o + 12, true), usize: tdv.getUint32(o + 16, true), type: tocBytes[o + 20] & 0x0f };
  }
  return entries;
}

export async function readEntry(reader: RangeReader, e: TocEntry): Promise<Uint8Array> {
  const raw = await reader.read(e.offset, e.csize);
  return inflateEntry(raw, e.type);
}

export function buildWad(files: { hash: bigint; data: Uint8Array }[], compress: ((d: Uint8Array) => Uint8Array) | null = null): Uint8Array {
  const list = files.map((f) => {
    let data = f.data; let type = 0;
    if (compress && data.length >= 64) { const c = compress(data); if (c && c.length < data.length) { data = c; type = 3; } }
    return { hash: f.hash, data, usize: f.data.length, type, sum: xxh64(data) };
  });
  list.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  let toc = 0n; for (const e of list) toc ^= e.sum;
  const headerSize = 272 + list.length * 32;
  let total = headerSize; for (const e of list) total += e.data.length;
  const out = new Uint8Array(total); const dv = new DataView(out.buffer);
  out[0] = 0x52; out[1] = 0x57; out[2] = 3; out[3] = 4;
  dv.setBigUint64(260, toc, true); dv.setUint32(268, list.length, true);
  let dataOff = headerSize;
  list.forEach((e, i) => {
    const o = 272 + i * 32; dv.setBigUint64(o, e.hash, true); dv.setUint32(o + 8, dataOff, true);
    dv.setUint32(o + 12, e.data.length, true); dv.setUint32(o + 16, e.usize, true);
    out[o + 20] = e.type; out[o + 21] = 0; dv.setUint16(o + 22, 0, true);
    dv.setBigUint64(o + 24, e.sum, true); out.set(e.data, dataOff); dataOff += e.data.length;
  });
  return out;
}

export function parseNameList(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim(); if (!t) continue;
    const m = /^(?:0x)?[0-9a-fA-F]{8,16}\s+(.+)$/.exec(t);
    out.push(m ? m[1] : t);
  }
  return out;
}

const HEX_NAME = /^([0-9a-fA-F]{16})(\.[^/]*)?$/;

export function looseHash(relPath: string): bigint {
  const p = relPath.replace(/\\/g, "/");
  if (!p.includes("/")) { const m = HEX_NAME.exec(p); if (m) return BigInt("0x" + m[1]); }
  return hashPath(p);
}

type WadContainer = { name: string; reader: RangeReader; kind: "wad" };
type LooseContainer = { name: string; kind: "loose" };
type WadRef = { c: WadContainer; e: TocEntry } | { c: LooseContainer; data: Uint8Array };

export class ModSource {
  map = new Map<bigint, WadRef>();
  containers: (WadContainer | LooseContainer)[] = [];
  names: string[] = [];
  looseNames: string[] = [];

  async addWad(name: string, bytes: Uint8Array) {
    const reader = new RangeReader(bytes);
    const toc = await readToc(reader);
    if (!toc) throw new Error(`${name}: not a valid WAD`);
    const c: WadContainer = { name, reader, kind: "wad" };
    this.containers.push(c);
    this.names.push(name);
    for (const e of toc) if (!this.map.has(e.hash)) this.map.set(e.hash, { c, e });
  }

  addLoose(name: string, files: Map<string, Uint8Array>) {
    const c: LooseContainer = { name, kind: "loose" };
    this.containers.push(c);
    this.names.push(name);
    for (const [rel, data] of files) {
      const h = looseHash(rel);
      if (!this.map.has(h)) this.map.set(h, { c, data });
      const norm = rel.replace(/\\/g, "/");
      if (!norm.includes("/") && /^hashes\..*\.txt$/i.test(norm)) this.looseNames.push(...parseNameList(new TextDecoder().decode(data)));
      else if (!HEX_NAME.test(norm)) this.looseNames.push(norm);
    }
  }

  has(hash: bigint) { return this.map.has(hash); }
  async read(hash: bigint): Promise<Uint8Array | null> {
    const r = this.map.get(hash);
    if (!r) return null;
    if ("data" in r) return r.data;
    return readEntry(r.c.reader, r.e);
  }
  hashes() { return this.map.keys(); }
}
