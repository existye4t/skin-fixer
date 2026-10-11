// Port of bin.js – Ritobin types as used by cslol-go fixer.
import { fnv1a } from "./hash";

export const T = {
  None: 0, Bool: 1, I8: 2, U8: 3, I16: 4, U16: 5, I32: 6, U32: 7, I64: 8, U64: 9, F32: 10,
  Vec2: 11, Vec3: 12, Vec4: 13, Mtx44: 14, Rgba: 15, String: 16, Hash: 17, File: 18,
  List: 0x80, List2: 0x81, Pointer: 0x82, Embed: 0x83, Link: 0x84, Option: 0x85, Map: 0x86, Flag: 0x87,
} as const;

export type FnvRef = { h: number; s: string | null };
export type XxhRef = { h: bigint; s: string | null };

export const FNV = (h: number, s: string | null = null): FnvRef => ({ h: h >>> 0, s });
export const FNVs = (str: string): FnvRef => ({ h: fnv1a(str), s: str });
export const XXH = (h: bigint, s: string | null = null): XxhRef => ({ h: BigInt.asUintN(64, h), s });

export class Bin { sections = new Map<string, BinValue>(); }

export class BinValue { t: number; v: unknown; constructor(t: number, v: unknown) { this.t = t; this.v = v; } }
export const mk = (t: number, v: unknown) => new BinValue(t, v);

export class BinList  { t = T.List;    vt: number; items: BinValue[] = []; constructor(vt: number) { this.vt = vt; } }
export class BinList2 { t = T.List2;   vt: number; items: BinValue[] = []; constructor(vt: number) { this.vt = vt; } }
export class BinPointer { t = T.Pointer; name: FnvRef; items: BinField[] = []; constructor(name: FnvRef) { this.name = name; } }
export class BinEmbed   { t = T.Embed;   name: FnvRef; items: BinField[] = []; constructor(name: FnvRef) { this.name = name; } }
export class BinOption  { t = T.Option;  vt: number; items: BinValue[] = []; constructor(vt: number) { this.vt = vt; } }
export class BinMap     { t = T.Map; kt: number; vt: number; items: { k: BinValue; v: BinValue }[] = [];
  constructor(kt: number, vt: number) { this.kt = kt; this.vt = vt; } }
export class BinField   { key: FnvRef; value: BinValue; constructor(key: FnvRef, value: BinValue) { this.key = key; this.value = value; } }

export const BinString  = (s: string)  => mk(T.String, s);
export const BinHash    = (fnv: FnvRef)  => mk(T.Hash, fnv);
export const BinFile    = (xxh: XxhRef)  => mk(T.File, xxh);
export const BinLink    = (fnv: FnvRef)  => mk(T.Link, fnv);
export const BinU8      = (n: number)  => mk(T.U8, n);
export const BinF32     = (n: number)  => mk(T.F32, n);
export const BinVec3    = (a: number[]) => mk(T.Vec3, a);

const dec = new TextDecoder("utf-8");
const enc2 = new TextEncoder();

export class BinReader {
  d: Uint8Array; dv: DataView; o = 0;
  constructor(data: Uint8Array) { this.d = data; this.dv = new DataView(data.buffer, data.byteOffset, data.byteLength); }
  read() {
    const bin = new Bin();
    let magic = this.ascii(4);
    let isPatch = false;
    if (magic === "PTCH") { this.u64(); magic = this.ascii(4); bin.sections.set("type", BinString("PTCH")); isPatch = true; }
    else bin.sections.set("type", BinString("PROP"));
    if (magic !== "PROP") throw new Error(`Invalid magic '${magic}'`);
    const version = this.u32(); bin.sections.set("version", mk(T.U32, version));
    if (version >= 2) {
      const list = new BinList(T.String); const n = this.u32();
      for (let i = 0; i < n; i++) list.items.push(BinString(this.str()));
      bin.sections.set("linked", list as unknown as BinValue);
    }
    this.readEntries(bin);
    if (isPatch) this.readPatches(bin);
    return bin;
  }
  readEntries(bin: Bin) {
    const count = this.u32(); const names: number[] = [];
    for (let i = 0; i < count; i++) names.push(this.u32());
    const map = new BinMap(T.Hash, T.Embed);
    for (const hash of names) {
      const key = BinHash(FNV(0)); const entry = new BinEmbed(FNV(hash));
      const length = this.u32(); const start = this.o;
      (key.v as FnvRef) = FNV(this.u32());
      const n = this.u16();
      for (let i = 0; i < n; i++) { const name = FNV(this.u32()); const type = this.u8(); entry.items.push(new BinField(name, this.value(type))); }
      if (this.o !== start + length) throw new Error("Entry length mismatch");
      map.items.push({ k: key, v: entry as unknown as BinValue });
    }
    bin.sections.set("entries", map as unknown as BinValue);
  }
  readPatches(bin: Bin) {
    const count = this.u32(); const map = new BinMap(T.Hash, T.Embed);
    for (let i = 0; i < count; i++) {
      const key = BinHash(FNV(this.u32())); const entry = new BinEmbed(FNVs("patch"));
      const length = this.u32(); const start = this.o;
      const type = this.u8(); const name = this.str(); const value = this.value(type);
      if (this.o !== start + length) throw new Error("Patch length mismatch");
      entry.items.push(new BinField(FNVs("path"), BinString(name)));
      entry.items.push(new BinField(FNVs("value"), value));
      map.items.push({ k: key, v: entry as unknown as BinValue });
    }
    bin.sections.set("patches", map as unknown as BinValue);
  }
  value(type: number): BinValue {
    switch (type) {
      case T.None: return mk(T.None, null);
      case T.Bool: return mk(T.Bool, this.u8() !== 0);
      case T.I8: return mk(T.I8, this.dv.getInt8(this.o++));
      case T.U8: return mk(T.U8, this.u8());
      case T.I16: { const v = this.dv.getInt16(this.o, true); this.o += 2; return mk(T.I16, v); }
      case T.U16: return mk(T.U16, this.u16());
      case T.I32: { const v = this.dv.getInt32(this.o, true); this.o += 4; return mk(T.I32, v); }
      case T.U32: return mk(T.U32, this.u32());
      case T.I64: { const v = this.dv.getBigInt64(this.o, true); this.o += 8; return mk(T.I64, v); }
      case T.U64: return mk(T.U64, this.u64());
      case T.F32: return mk(T.F32, this.f32());
      case T.Vec2: return mk(T.Vec2, [this.f32(), this.f32()]);
      case T.Vec3: return mk(T.Vec3, [this.f32(), this.f32(), this.f32()]);
      case T.Vec4: return mk(T.Vec4, [this.f32(), this.f32(), this.f32(), this.f32()]);
      case T.Mtx44: { const a: number[] = []; for (let i = 0; i < 16; i++) a.push(this.f32()); return mk(T.Mtx44, a); }
      case T.Rgba: return mk(T.Rgba, [this.u8(), this.u8(), this.u8(), this.u8()]);
      case T.String: return mk(T.String, this.str());
      case T.Hash: return mk(T.Hash, FNV(this.u32()));
      case T.File: return mk(T.File, XXH(this.u64()));
      case T.List: case T.List2: {
        const vt = this.u8(); const size = this.u32(); const start = this.o; const count = this.u32();
        const list = type === T.List ? new BinList(vt) : new BinList2(vt);
        for (let i = 0; i < count; i++) list.items.push(this.value(vt));
        if (this.o !== start + size) throw new Error("List size mismatch");
        return list as unknown as BinValue;
      }
      case T.Pointer: {
        const name = FNV(this.u32()); const ptr = new BinPointer(name);
        if (name.h === 0) return ptr as unknown as BinValue;
        const size = this.u32(); const start = this.o; const count = this.u16();
        for (let i = 0; i < count; i++) { const fname = FNV(this.u32()); const ftype = this.u8(); ptr.items.push(new BinField(fname, this.value(ftype))); }
        if (this.o !== start + size) throw new Error("Pointer size mismatch");
        return ptr as unknown as BinValue;
      }
      case T.Embed: {
        const name = FNV(this.u32()); const size = this.u32(); const start = this.o; const count = this.u16();
        const e = new BinEmbed(name);
        for (let i = 0; i < count; i++) { const fname = FNV(this.u32()); const ftype = this.u8(); e.items.push(new BinField(fname, this.value(ftype))); }
        if (this.o !== start + size) throw new Error("Embed size mismatch");
        return e as unknown as BinValue;
      }
      case T.Link: return mk(T.Link, FNV(this.u32()));
      case T.Option: { const vt = this.u8(); const count = this.u8(); const opt = new BinOption(vt); if (count !== 0) opt.items.push(this.value(vt)); return opt as unknown as BinValue; }
      case T.Map: {
        const kt = this.u8(); const vt = this.u8(); const size = this.u32(); const start = this.o; const count = this.u32();
        const map = new BinMap(kt, vt);
        for (let i = 0; i < count; i++) { const k = this.value(kt); const v = this.value(vt); map.items.push({ k, v }); }
        if (this.o !== start + size) throw new Error("Map size mismatch");
        return map as unknown as BinValue;
      }
      case T.Flag: return mk(T.Flag, this.u8() !== 0);
      default: throw new Error(`Unknown type: ${type}`);
    }
  }
  u8()  { return this.d[this.o++]; }
  u16() { const v = this.dv.getUint16(this.o, true); this.o += 2; return v; }
  u32() { const v = this.dv.getUint32(this.o, true); this.o += 4; return v; }
  u64() { const v = this.dv.getBigUint64(this.o, true); this.o += 8; return v; }
  f32() { const v = this.dv.getFloat32(this.o, true); this.o += 4; return v; }
  ascii(n: number) { let s = ""; for (let i = 0; i < n; i++) s += String.fromCharCode(this.d[this.o++]); return s; }
  str()  { const len = this.u16(); const s = dec.decode(this.d.subarray(this.o, this.o + len)); this.o += len; return s; }
}

class ByteWriter {
  buf = new Uint8Array(1 << 16); dv = new DataView(new Uint8Array(1 << 16).buffer); o = 0;
  constructor() { this.dv = new DataView(this.buf.buffer); }
  ensure(n: number) {
    if (this.o + n <= this.buf.length) return;
    let cap = this.buf.length * 2; while (cap < this.o + n) cap *= 2;
    const nb = new Uint8Array(cap); nb.set(this.buf); this.buf = nb; this.dv = new DataView(nb.buffer);
  }
  u8(v: number)  { this.ensure(1); this.buf[this.o++] = v & 0xff; }
  u16(v: number) { this.ensure(2); this.dv.setUint16(this.o, v, true); this.o += 2; }
  u32(v: number) { this.ensure(4); this.dv.setUint32(this.o, v >>> 0, true); this.o += 4; }
  i8(v: number)  { this.ensure(1); this.dv.setInt8(this.o++, v); }
  i16(v: number) { this.ensure(2); this.dv.setInt16(this.o, v, true); this.o += 2; }
  i32(v: number) { this.ensure(4); this.dv.setInt32(this.o, v | 0, true); this.o += 4; }
  u64(v: bigint) { this.ensure(8); this.dv.setBigUint64(this.o, BigInt.asUintN(64, BigInt(v)), true); this.o += 8; }
  i64(v: bigint) { this.ensure(8); this.dv.setBigInt64(this.o, BigInt.asIntN(64, BigInt(v)), true); this.o += 8; }
  f32(v: number) { this.ensure(4); this.dv.setFloat32(this.o, v, true); this.o += 4; }
  bytes(a: Uint8Array) { this.ensure(a.length); this.buf.set(a, this.o); this.o += a.length; }
  patch32(pos: number, v: number) { this.dv.setUint32(pos, v >>> 0, true); }
  str(s: string)  { const b = enc2.encode(s); this.u16(b.length); this.bytes(b); }
  result() { return this.buf.slice(0, this.o); }
}

export class BinWriter {
  private w!: ByteWriter;
  write(bin: Bin) {
    const w = (this.w = new ByteWriter());
    const type = bin.sections.get("type");
    if (!type || type.t !== T.String) throw new Error("Missing type section");
    if (type.v === "PTCH") { for (const c of "PTCH") w.u8(c.charCodeAt(0)); w.u64(1n); }
    for (const c of "PROP") w.u8(c.charCodeAt(0));
    const ver = bin.sections.get("version");
    if (!ver || ver.t !== T.U32) throw new Error("Missing version section");
    w.u32(ver.v as number);
    if ((ver.v as number) >= 2) this.linked(bin);
    this.entries(bin);
    if ((ver.v as number) >= 3 && type.v === "PTCH") this.patches(bin);
    return w.result();
  }
  linked(bin: Bin) {
    const w = this.w; const l = bin.sections.get("linked") as unknown as BinList | undefined;
    if (!l) { w.u32(0); return; }
    w.u32(l.items.length);
    for (const it of l.items) w.str(it.v as string);
  }
  entries(bin: Bin) {
    const w = this.w; const m = bin.sections.get("entries") as unknown as BinMap | undefined;
    if (!m) { w.u32(0); return; }
    w.u32(m.items.length);
    const hashesOffset = w.o;
    for (let i = 0; i < m.items.length; i++) w.u32(0);
    const hashes: number[] = [];
    for (const { k, v } of m.items) {
      const kv = k.v as FnvRef; const ve = v as unknown as BinEmbed;
      hashes.push(ve.name.h);
      const start = w.o;
      w.u32(0); w.u32(kv.h); w.u16(ve.items.length);
      for (const f of ve.items) { w.u32(f.key.h); w.u8(f.value.t); this.val(f.value); }
      w.patch32(start, w.o - start - 4);
    }
    hashes.forEach((h, i) => w.patch32(hashesOffset + i * 4, h));
  }
  patches(bin: Bin) {
    const w = this.w; const m = bin.sections.get("patches") as unknown as BinMap | undefined;
    if (!m) { w.u32(0); return; }
    w.u32(m.items.length);
    const kp = fnv1a("path"), kv = fnv1a("value");
    for (const { k, v } of m.items) {
      w.u32((k.v as FnvRef).h);
      const start = w.o; w.u32(0);
      const ve = v as unknown as BinEmbed;
      const pf = ve.items.find(f => f.key.h === kp); const vf = ve.items.find(f => f.key.h === kv);
      if (!pf || !vf) throw new Error("Invalid patch structure");
      w.u8(vf.value.t); w.str(pf.value.v as string); this.val(vf.value);
      w.patch32(start, w.o - start - 4);
    }
  }
  val(x: BinValue) {
    const w = this.w;
    switch (x.t) {
      case T.None: break;
      case T.Bool: w.u8((x.v as boolean) ? 1 : 0); break;
      case T.I8: w.i8(x.v as number); break;
      case T.U8: w.u8(x.v as number); break;
      case T.I16: w.i16(x.v as number); break;
      case T.U16: w.u16(x.v as number); break;
      case T.I32: w.i32(x.v as number); break;
      case T.U32: w.u32(x.v as number); break;
      case T.I64: w.i64(x.v as bigint); break;
      case T.U64: w.u64(x.v as bigint); break;
      case T.F32: w.f32(x.v as number); break;
      case T.Vec2: case T.Vec3: case T.Vec4: case T.Mtx44: for (const n of x.v as number[]) w.f32(n); break;
      case T.Rgba: for (const n of x.v as number[]) w.u8(n); break;
      case T.String: w.str(x.v as string); break;
      case T.Hash: w.u32((x.v as FnvRef).h); break;
      case T.File: w.u64((x.v as XxhRef).h); break;
      case T.List: case T.List2: {
        const xl = x as unknown as BinList;
        w.u8(xl.vt); const s = w.o; w.u32(0); w.u32(xl.items.length);
        for (const it of xl.items) this.val(it);
        w.patch32(s, w.o - s - 4); break;
      }
      case T.Pointer: {
        const xp = x as unknown as BinPointer;
        w.u32(xp.name.h); if (xp.name.h === 0) break;
        const s = w.o; w.u32(0); w.u16(xp.items.length);
        for (const f of xp.items) { w.u32(f.key.h); w.u8(f.value.t); this.val(f.value); }
        w.patch32(s, w.o - s - 4); break;
      }
      case T.Embed: {
        const xe = x as unknown as BinEmbed;
        w.u32(xe.name.h);
        const s = w.o; w.u32(0); w.u16(xe.items.length);
        for (const f of xe.items) { w.u32(f.key.h); w.u8(f.value.t); this.val(f.value); }
        w.patch32(s, w.o - s - 4); break;
      }
      case T.Link: w.u32((x.v as FnvRef).h); break;
      case T.Option: {
        const xo = x as unknown as BinOption;
        w.u8(xo.vt); w.u8(xo.items.length); if (xo.items.length) this.val(xo.items[0]); break;
      }
      case T.Map: {
        const xm = x as unknown as BinMap;
        w.u8(xm.kt); w.u8(xm.vt); const s = w.o; w.u32(0); w.u32(xm.items.length);
        for (const { k, v } of xm.items) { this.val(k); this.val(v); }
        w.patch32(s, w.o - s - 4); break;
      }
      case T.Flag: w.u8((x.v as boolean) ? 1 : 0); break;
      default: throw new Error("Unknown value type: " + x.t);
    }
  }
}

export const readBin  = (bytes: Uint8Array) => new BinReader(bytes).read();
export const writeBin = (bin: Bin) => new BinWriter().write(bin);

export function makeBin(linkedStrings: string[], entriesMap: BinMap): Bin {
  const bin = new Bin();
  bin.sections.set("type", BinString("PROP"));
  bin.sections.set("version", mk(T.U32, 3));
  const l = new BinList(T.String);
  for (const s of linkedStrings) l.items.push(BinString(s));
  bin.sections.set("linked", l as unknown as BinValue);
  bin.sections.set("entries", entriesMap as unknown as BinValue);
  return bin;
}
