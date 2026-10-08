import type { ImportReport } from "./types";
import { compress, init } from "@bokuweb/zstd-wasm";
import { encode } from "@msgpack/msgpack";
import xxhash from "xxhashjs";

const zstd = init();

type Hash64 = { update: (data: ArrayBuffer | string) => Hash64; digest: () => { toString: (radix: number) => string } };

const MAGIC = new TextEncoder().encode("_modpkg_");
const NO_INDEX = 0xffffffff;

function xxh64(data: Uint8Array | string) {
  const input =
    typeof data === "string"
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const hex = (xxhash.h64(0) as Hash64).update(input as ArrayBuffer).digest().toString(16).padStart(16, "0");
  return BigInt(`0x${hex}`);
}

function u32(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value >>> 0, true);
  return out;
}

function u64(value: bigint) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, true);
  return out;
}

function i32(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, true);
  return out;
}

function bytes(value: string) {
  return new TextEncoder().encode(value);
}

function cstr(value: string) {
  return new Uint8Array([...bytes(value), 0]);
}

function splitWad(path: string, fallback: string) {
  const normalized = path.replaceAll("\\", "/");
  const marker = normalized.toLowerCase().indexOf(".wad.client");
  if (marker === -1) return { wad: fallback, path: normalized.replace(/^wad\//i, "") };
  return {
    wad: normalized.slice(normalized.lastIndexOf("/", marker) + 1, marker + ".wad.client".length),
    path: normalized.slice(marker + ".wad.client/".length),
  };
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export type ModpkgFile = { path: string; data: Uint8Array };

export async function buildModpkg(report: ImportReport, wadName: string, files: ModpkgFile[]) {
  await zstd;
  const meta = encode({
    schema_version: 1,
    name: report.title,
    display_name: report.title,
    description: report.description || null,
    version: report.version,
    distributor: null,
    authors: report.author ? [{ name: report.author, role: null }] : [],
    license: { type: "none" },
    layers: [{ name: "base", priority: 0, description: null }],
  });
  const chunks = files.map((file) => splitWad(file.path, wadName));
  const wads = [...new Set(chunks.map((chunk) => chunk.wad).filter((name): name is string => Boolean(name)))];
  const paths = ["_meta_/info.msgpack", ...chunks.map((chunk) => chunk.path)];
  const payloads = [meta, ...files.map((file) => file.data)];
  const layerName = bytes("base");
  const header = concat([
    MAGIC,
    u32(1),
    u32(0),
    u32(payloads.length),
    u32(1),
    u32(layerName.length),
    layerName,
    i32(0),
    u32(paths.length),
    ...paths.map(cstr),
    u32(wads.length),
    ...wads.map(cstr),
  ]);
  const pad = (8 - (header.length % 8)) % 8;
  const stored = payloads.map((data, index) => {
    if (index === 0 || data.length < 64) return { bytes: data, compressed: false };
    const packed = compress(data, 3);
    if (!packed || packed.length >= data.length) return { bytes: data, compressed: false };
    return { bytes: packed, compressed: true };
  });
  let cursor = header.length + pad + stored.length * 61;
  const descriptors = stored.map((item, index) => {
    const raw = payloads[index];
    const descriptor = concat([
      u64(xxh64(bytes(paths[index].toLowerCase()))),
      u64(BigInt(cursor)),
      new Uint8Array([item.compressed ? 1 : 0]),
      u64(BigInt(item.bytes.length)),
      u64(BigInt(raw.length)),
      u64(xxh64(item.bytes)),
      u64(xxh64(raw)),
      u32(index),
      u32(index === 0 ? NO_INDEX : 0),
      u32(index === 0 ? NO_INDEX : wads.indexOf(chunks[index - 1].wad ?? "")),
    ]);
    cursor += item.bytes.length;
    return descriptor;
  });
  return new Blob([concat([header, new Uint8Array(pad), ...descriptors, ...stored.map((item) => item.bytes)])], {
    type: "application/octet-stream",
  });
}
