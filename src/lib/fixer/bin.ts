const text = new TextEncoder();
const read = new TextDecoder();

type Field = { key: number; type: number; value: Value };
type Value =
  | { kind: "raw"; type: number; bytes: Uint8Array }
  | { kind: "string"; value: string }
  | { kind: "list"; type: number; items: Value[] }
  | { kind: "embed"; hash: number; fields: Field[] }
  | { kind: "map"; key: number; value: number; items: [Value, Value][] }
  | { kind: "option"; type: number; item: Value | null };

class Reader {
  offset = 0;
  private readonly data: Uint8Array;
  constructor(data: Uint8Array) { this.data = data; }
  get view() {
    return new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
  u8() { return this.data[this.offset++]; }
  u16() { const value = this.view.getUint16(this.offset, true); this.offset += 2; return value; }
  u32() { const value = this.view.getUint32(this.offset, true); this.offset += 4; return value; }
  bytes(count: number) { const out = this.data.slice(this.offset, this.offset + count); this.offset += count; return out; }
  string() { return read.decode(this.bytes(this.u16())); }

  value(type: number): Value {
    if (type === 0) return { kind: "raw", type, bytes: new Uint8Array() };
    if (type === 2) return { kind: "raw", type, bytes: this.bytes(1) };
    if (type === 16) return { kind: "string", value: this.string() };
    if (type === 128 || type === 129) {
      const itemType = this.u8();
      const size = this.u32();
      const start = this.offset;
      const count = this.u32();
      const items = Array.from({ length: count }, () => this.value(itemType));
      if (this.offset !== start + size) throw new Error("list size");
      return { kind: "list", type: itemType, items };
    }
    if (type === 130) {
      const hash = this.u32();
      // Pointer/Embed: hash(4) then if non-zero: size(4) → count(2) → fields
      return { kind: "embed", hash, fields: hash === 0 ? [] : this.embedBlock() };
    }
    if (type === 131) {
      // Embed: always has size(4) → count(2) → fields
      return { kind: "embed", hash: this.u32(), fields: this.embedBlock() };
    }
    if (type === 132) return { kind: "raw", type, bytes: this.bytes(4) };
    if (type === 133) {
      const itemType = this.u8();
      const count = this.u8();
      return { kind: "option", type: itemType, item: count ? this.value(itemType) : null };
    }
    if (type === 134) {
      const key = this.u8();
      const valueType = this.u8();
      const size = this.u32();
      const start = this.offset;
      const count = this.u32();
      const items = Array.from({ length: count }, () => [this.value(key), this.value(valueType)] as [Value, Value]);
      if (this.offset !== start + size) throw new Error("map size");
      return { kind: "map", key, value: valueType, items };
    }
    const widths: Record<number, number> = {
      1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 4, 7: 4, 8: 8, 9: 8, 10: 4,
      11: 8, 12: 12, 13: 16, 14: 64, 15: 4, 17: 4, 18: 8, 132: 4, 135: 1,
    };
    const width = widths[type];
    if (width === undefined) throw new Error(`bin type ${type}`);
    return { kind: "raw", type, bytes: this.bytes(width) };
  }

  // Top-level entry block: size(4) → [key(4) + count(2) + fields]
  // size covers everything after itself: key, count, and fields.
  // Matches C# ReadEntry: length = ReadU32(); startPos = _offset; key = ReadFNV1a(); count = ReadU16(); ...
  block() {
    const size = this.u32();
    const start = this.offset;
    const key = this.u32();
    const count = this.u16();
    const fields = Array.from({ length: count }, () => {
      const fkey = this.u32();
      const type = this.u8();
      return { key: fkey, type, value: this.value(type) };
    });
    if (this.offset !== start + size) throw new Error("block size");
    return { key, fields };
  }

  // Embedded block (types 130/131): size(4) → [count(2) + fields]  — no entry key
  // Matches C# Pointer/Embed case: size = ReadU32(); startPos = _offset; count = ReadU16(); ...
  embedBlock() {
    const size = this.u32();
    const start = this.offset;
    const count = this.u16();
    const fields = Array.from({ length: count }, () => {
      const key = this.u32();
      const type = this.u8();
      return { key, type, value: this.value(type) };
    });
    if (this.offset !== start + size) throw new Error("embed size");
    return fields;
  }
}

class Writer {
  private parts: Uint8Array[] = [];
  u8(value: number) { this.parts.push(new Uint8Array([value])); }
  u16(value: number) { const out = new Uint8Array(2); new DataView(out.buffer).setUint16(0, value, true); this.parts.push(out); }
  u32(value: number) { const out = new Uint8Array(4); new DataView(out.buffer).setUint32(0, value, true); this.parts.push(out); }
  bytes(value: Uint8Array) { this.parts.push(value); }
  string(value: string) { const encoded = text.encode(value); this.u16(encoded.length); this.bytes(encoded); }
  value(node: Value) {
    if (node.kind === "raw") return this.bytes(node.bytes);
    if (node.kind === "string") return this.string(node.value);
    if (node.kind === "list") {
      this.u8(node.type);
      this.sized(() => { this.u32(node.items.length); node.items.forEach((item) => this.value(item)); });
      return;
    }
    if (node.kind === "embed") {
      // Write: hash(4) then if non-zero: size(4) → count(2) → fields
      // size covers count+fields (NOT hash), matching embedBlock() reader
      this.u32(node.hash);
      if (node.hash === 0 && !node.fields.length) return;
      this.sized(() => this.fields(node.fields));
      return;
    }
    if (node.kind === "option") {
      this.u8(node.type);
      this.u8(node.item ? 1 : 0);
      if (node.item) this.value(node.item);
      return;
    }
    this.u8(node.key);
    this.u8(node.value);
    this.sized(() => { this.u32(node.items.length); node.items.forEach(([key, value]) => { this.value(key); this.value(value); }); });
  }
  fields(fields: Field[]) { this.u16(fields.length); fields.forEach((field) => { this.u32(field.key); this.u8(field.type); this.value(field.value); }); }
  sized(body: () => void) {
    const marker = this.parts.length;
    this.u32(0);
    const before = this.parts.length;
    body();
    const inner = concat(this.parts.slice(before));
    const size = new Uint8Array(4);
    new DataView(size.buffer).setUint32(0, inner.length, true);
    this.parts[marker] = size;
  }
  finish() { return concat(this.parts); }
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

function visit(node: Value, prefix: string) {
  if (node.kind === "string" && /^(assets|data)\//i.test(node.value)) node.value = repath(node.value, prefix);
  if (node.kind === "list") node.items.forEach((item) => visit(item, prefix));
  if (node.kind === "embed") node.fields.forEach((field) => visit(field.value, prefix));
  if (node.kind === "map") node.items.forEach(([key, value]) => { visit(key, prefix); visit(value, prefix); });
  if (node.kind === "option" && node.item) visit(node.item, prefix);
}

function repath(path: string, prefix: string) {
  const parts = path.split("/");
  const folder = parts[1] ?? "";
  if (parts.length < 2 || !folder.startsWith(".") || folder.includes(prefix)) return path;
  const rest = parts.slice(2).join("/");
  return `${parts[0].toUpperCase()}/${prefix}${folder.slice(1).toLowerCase()}${rest ? `/${rest}` : ""}`;
}

const failures = new WeakMap<Uint8Array, string>();

export function binFailure(data: Uint8Array) {
  return failures.get(data);
}

export function retargetBin(data: Uint8Array, prefix: string) {
  try {
    const reader = new Reader(data);
    const magic = read.decode(reader.bytes(4));
    const patch = magic === "PTCH";
    if (patch) { reader.bytes(8); reader.bytes(4); }
    const version = reader.u32();
    const linked = version >= 2 ? Array.from({ length: reader.u32() }, () => reader.string()) : [];
    const count = reader.u32();
    const names = Array.from({ length: count }, () => reader.u32());
    const entries = names.map(() => reader.block());
    entries.forEach((entry) => entry.fields.forEach((field) => visit(field.value, prefix)));
    const writer = new Writer();
    writer.bytes(text.encode("PROP"));
    writer.u32(version);
    if (version >= 2) { writer.u32(linked.length); linked.forEach((item) => writer.string(item)); }
    writer.u32(entries.length);
    names.forEach((hash) => writer.u32(hash));
    // Write each entry: size(4) → [key(4) + fields]
    // size covers key+fields, matching block() reader
    entries.forEach((entry) => {
      writer.sized(() => {
        writer.u32(entry.key);
        writer.fields(entry.fields);
      });
    });
    return writer.finish();
  } catch (error) {
    const failed = data.slice();
    failures.set(failed, error instanceof Error ? error.message : "unreadable bin");
    return failed;
  }
}
