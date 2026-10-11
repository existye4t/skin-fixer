// Port of converter.js – BinFieldConverter + BinTypeConverter.
import { T, FNV, XXH, BinFile, BinHash, BinPointer, BinEmbed, BinMap, BinList, BinList2, BinValue, BinField, mk } from "./bin-types";
import type { FnvRef, XxhRef } from "./bin-types";
import { fnv1a, xxh64 } from "./hash";
import type { ConvertRule } from "./convert-rules";

const enc = new TextEncoder();
const parseHashOrName = (tok: string) => (/^0x/i.test(tok) ? parseInt(tok.slice(2), 16) >>> 0 : fnv1a(tok));
const cpath = (p: string) => xxh64(enc.encode(p.replace(/\\/g, "/").toLowerCase().trim()));

export const convertStringToBinFile = (path: string) => BinFile(XXH(cpath(path), path));
export const convertStringToBinHash = (text: string) => BinHash(FNV(fnv1a(text.trim()), text));

const TYPE_NAMES: Record<string, number> = {
  i8: T.I8, u8: T.U8, i16: T.I16, u16: T.U16, i32: T.I32, int: T.I32, u32: T.U32, uint: T.U32,
  i64: T.I64, u64: T.U64, f32: T.F32, float: T.F32, vec2: T.Vec2, vec3: T.Vec3, vec4: T.Vec4,
  mtx44: T.Mtx44, mat44: T.Mtx44, rgba: T.Rgba, color: T.Rgba,
};
const parseBinType = (n?: string) => TYPE_NAMES[(n || "").toLowerCase()] ?? T.None;
const VT: Record<string, number> = { File: T.File, Hash: T.Hash };

const INT_KINDS = new Set<number>([T.I8, T.U8, T.I16, T.U16, T.I32, T.U32, T.I64, T.U64]);

function asBigInt(src: BinValue): bigint | null {
  switch (src.t) {
    case T.Bool: return (src.v as boolean) ? 1n : 0n;
    case T.F32: { const f = src.v as number; if (Number.isNaN(f)) return 0n; return BigInt(Math.trunc(Math.max(Math.min(f, 1.8446744073709552e19), -9.2233720368547758e18))); }
    case T.String: { const s = String(src.v).trim(); return /^[+-]?\d+$/.test(s) ? BigInt(s) : null; }
    default: return INT_KINDS.has(src.t) ? BigInt(src.v as number) : null;
  }
}

function toFloat(src: BinValue): number {
  if (src.t === T.F32) return src.v as number;
  if (INT_KINDS.has(src.t)) return Number(src.v);
  if (src.t === T.Bool) return (src.v as boolean) ? 1 : 0;
  const t = src.t;
  if (t === T.Vec2 || t === T.Vec3 || t === T.Vec4) return (src.v as number[])[0];
  if (t === T.Rgba) return (src.v as number[])[0];
  if (src.t === T.String) { const f = parseFloat(src.v as string); return Number.isNaN(f) ? 0 : f; }
  return 0;
}

const f32 = Math.fround;

function toVec(src: BinValue, n: number): number[] {
  const z = new Array<number>(n).fill(0);
  const v = src.v as number[];
  const t = src.t;
  if (t === T.Vec2 || t === T.Vec3 || t === T.Vec4) { const r = z.slice(); for (let i = 0; i < n; i++) r[i] = i < v.length ? v[i] : 0; return r; }
  if (t === T.Mtx44) return z.map((_, i) => v[i] ?? 0);
  if (t === T.F32) return n === 4 || n === 3 || n === 2 ? new Array(n).fill(v) : z;
  if (t === T.I32) return new Array(n).fill(v);
  if (t === T.Rgba) return n === 4 ? v.map(c => c / 255) : z;
  return z;
}

const clampByte = (x: number) => Math.max(0, Math.min(255, Math.trunc(x)));

export function convertValue(src: BinValue, target: number): BinValue {
  if (src.t === target) return src;
  const wrap = (bits: number, signed: boolean) => { const b = asBigInt(src); return b === null ? 0n : (signed ? BigInt.asIntN(bits, b) : BigInt.asUintN(bits, b)); };
  switch (target) {
    case T.I8: return mk(T.I8, Number(wrap(8, true)));
    case T.U8: return mk(T.U8, Number(wrap(8, false)));
    case T.I16: return mk(T.I16, Number(wrap(16, true)));
    case T.U16: return mk(T.U16, Number(wrap(16, false)));
    case T.I32: return mk(T.I32, Number(wrap(32, true)));
    case T.U32: return mk(T.U32, Number(wrap(32, false)));
    case T.I64: return mk(T.I64, wrap(64, true));
    case T.U64: return mk(T.U64, wrap(64, false));
    case T.F32: return mk(T.F32, f32(toFloat(src)));
    case T.Vec2: return mk(T.Vec2, toVec(src, 2).map(f32));
    case T.Vec3: return mk(T.Vec3, toVec(src, 3).map(f32));
    case T.Vec4: return mk(T.Vec4, toVec(src, 4).map(f32));
    case T.Mtx44: return mk(T.Mtx44, src.t === T.Mtx44 ? src.v : src.t === T.Vec4 ? [...(src.v as number[]), ...new Array(12).fill(0)] : [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
    case T.Rgba:
      if (src.t === T.Rgba) return mk(T.Rgba, (src.v as number[]).slice());
      if (src.t === T.Vec4) return mk(T.Rgba, (src.v as number[]).map(c => clampByte(c * 255)));
      if (src.t === T.I32) { const i = src.v as number; return mk(T.Rgba, [(i >> 24) & 255, (i >> 16) & 255, (i >> 8) & 255, i & 255]); }
      return mk(T.Rgba, [0, 0, 0, 255]);
    default: throw new Error(`Conversion from ${src.t} to ${target} not supported.`);
  }
}

export class ConvertedStringsTracker {
  gameFiles: string[] = [];
  binEntries: string[] = [];
  unconverted: string[] = [];
}

function collectRawStrings(val: BinValue, bag?: string[]) {
  if (!bag) return;
  switch (val.t) {
    case T.String: if ((val.v as string).trim()) bag.push((val.v as string).trim()); break;
    case T.Hash: { const h = val.v as FnvRef; if (h.s?.trim()) bag.push(h.s.trim()); break; }
    case T.File: { const f = val.v as XxhRef; if (f.s?.trim()) bag.push(f.s.trim()); break; }
    case T.Embed: case T.Pointer: for (const f of (val as unknown as { items: BinField[] }).items) collectRawStrings(f.value, bag); break;
    case T.List: case T.List2: case T.Option: for (const it of (val as unknown as { items: BinValue[] }).items) collectRawStrings(it, bag); break;
    case T.Map: for (const { k, v } of (val as unknown as { items: { k: BinValue; v: BinValue }[] }).items) { collectRawStrings(k, bag); collectRawStrings(v, bag); } break;
  }
}

export class BinConverter {
  transformers = new Map<string, ConvertRule>();

  loadRules(rules: ConvertRule[]) {
    for (const rule of rules) {
      const key = `${parseHashOrName(rule.class)}:${parseHashOrName(rule.field)}`;
      this.transformers.set(key, rule);
    }
  }

  convertBinMap(map: BinMap, tracker: ConvertedStringsTracker) {
    for (const { v } of map.items) if (v.t === T.Embed) this.transformEmbed(v as unknown as BinEmbed, tracker);
  }

  transformEmbed(node: BinEmbed, tracker: ConvertedStringsTracker) {
    const cls = node.name.h;
    for (const field of node.items) {
      const rule = this.transformers.get(`${cls}:${field.key.h}`);
      if (rule) this.apply(field, rule, tracker);
      else collectRawStrings(field.value, tracker?.unconverted);
      this.nested(field.value, tracker);
    }
  }

  nested(val: BinValue, tracker: ConvertedStringsTracker) {
    switch (val.t) {
      case T.Embed: case T.Pointer: this.transformEmbed(val as unknown as BinEmbed, tracker); break;
      case T.List: case T.List2: case T.Option: for (const it of (val as unknown as { items: BinValue[] }).items) this.nested(it, tracker); break;
      case T.Map: for (const { k, v } of (val as unknown as { items: { k: BinValue; v: BinValue }[] }).items) { this.nested(k, tracker); this.nested(v, tracker); } break;
    }
  }

  apply(field: BinField, rule: ConvertRule, tracker: ConvertedStringsTracker) {
    const from = rule.from.type, to = rule.to.type;
    const v = field.value;
    if (from === "String") {
      if (to === "File" && v.t === T.String) { if ((v.v as string).trim()) tracker?.gameFiles.push((v.v as string).trim()); field.value = convertStringToBinFile(v.v as string); return; }
      if (to === "Hash" && v.t === T.String) { if ((v.v as string).trim()) tracker?.binEntries.push((v.v as string).trim()); field.value = convertStringToBinHash(v.v as string); return; }
    }
    if (from === "Hash" && to === "File") {
      if (v.t === T.Hash) { const vv = v.v as FnvRef; if (vv.s?.trim()) tracker?.gameFiles.push(vv.s.trim()); field.value = BinFile(XXH(BigInt(vv.h), vv.s)); }
      return;
    }
    if (from === "Embed" && to === "Pointer") {
      if (v.t === T.Embed) { const p = new BinPointer((v as unknown as BinEmbed).name); p.items.push(...(v as unknown as BinEmbed).items); field.value = p as unknown as BinValue; }
      return;
    }
    const ft = parseBinType(from), tt = parseBinType(to);
    if (ft !== T.None && tt !== T.None) {
      try { field.value = convertValue(v, tt); } catch { /* keep value */ }
      return;
    }
    const containerFrom = from === "List" || from === "List2" || from === "Container" || from === "UnorderedContainer";
    if (containerFrom && v.t === T.List) { this.listConv(v as unknown as BinList, rule.to.value, tracker, true); return; }
    if (containerFrom && v.t === T.List2) {
      this.listConv(v as unknown as BinList2, rule.to.value, tracker, true);
      if (rule.to.value === "Embed" && rule.to.class) {
        const nh = parseHashOrName(rule.to.class);
        for (const it of (v as unknown as BinList2).items) if (it.t === T.Embed) (it as unknown as BinEmbed).name = FNV(nh);
      }
      return;
    }
    if ((from === "Option" || from === "Optional") && v.t === T.Option) { this.listConv(v as unknown as BinList, rule.to.value, tracker, true); return; }
    if (from === "Map" && v.t === T.Map) { this.mapConv(v as unknown as BinMap, rule.to, tracker); }
  }

  listConv(list: BinList | BinList2, tv: string | undefined, tracker: ConvertedStringsTracker, setType: boolean) {
    if (setType && tv && VT[tv] !== undefined) list.vt = VT[tv];
    const items = list.items;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.t === T.String) {
        if ((it.v as string).trim()) { if (tv === "File") tracker?.gameFiles.push((it.v as string).trim()); else if (tv === "Hash") tracker?.binEntries.push((it.v as string).trim()); }
        if (tv === "File") items[i] = convertStringToBinFile(it.v as string);
        else if (tv === "Hash") items[i] = convertStringToBinHash(it.v as string);
      } else if (it.t === T.Hash && tv === "File") {
        const iv = it.v as FnvRef; if (iv.s?.trim()) tracker?.gameFiles.push(iv.s.trim());
        items[i] = BinFile(XXH(BigInt(iv.h), iv.s));
      }
    }
  }

  mapConv(map: BinMap, to: ConvertRule["to"], tracker: ConvertedStringsTracker) {
    const tk = to.key, tv = to.value;
    if (tk && VT[tk] !== undefined) map.kt = VT[tk];
    if (tv && VT[tv] !== undefined) map.vt = VT[tv];
    for (let i = 0; i < map.items.length; i++) {
      let { k, v } = map.items[i];
      if (tk === "File" && k.t === T.String) { if ((k.v as string).trim()) tracker?.gameFiles.push((k.v as string).trim()); k = convertStringToBinFile(k.v as string); }
      else if (tk === "Hash" && k.t === T.String) { if ((k.v as string).trim()) tracker?.binEntries.push((k.v as string).trim()); k = convertStringToBinHash(k.v as string); }
      if (tv === "File" && v.t === T.String) { if ((v.v as string).trim()) tracker?.gameFiles.push((v.v as string).trim()); v = convertStringToBinFile(v.v as string); }
      else if (tv === "Hash" && v.t === T.String) { if ((v.v as string).trim()) tracker?.binEntries.push((v.v as string).trim()); v = convertStringToBinHash(v.v as string); }
      map.items[i] = { k, v };
    }
  }
}
