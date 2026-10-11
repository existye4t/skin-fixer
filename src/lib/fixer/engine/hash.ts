// Port of hash.js – XXH64 (seed 0) + FNV1a + LoL path hashing.
const M64 = (1n << 64n) - 1n;
const P1 = 11400714785074694791n;
const P2 = 14029467366897019727n;
const P3 = 1609587929392839161n;
const P4 = 9650029242287828579n;
const P5 = 2870177450012600261n;

const rotl = (x: bigint, r: number) => ((x << BigInt(r)) | (x >> (64n - BigInt(r)))) & M64;
const round = (acc: bigint, input: bigint) => (rotl((acc + input * P2) & M64, 31) * P1) & M64;
const mergeRound = (acc: bigint, val: bigint) => ((((acc ^ round(0n, val)) & M64) * P1) + P4) & M64;

export function xxh64(data: Uint8Array, seed = 0n): bigint {
  const len = data.length;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let p = 0; let h: bigint;
  if (len >= 32) {
    let v1 = (seed + P1 + P2) & M64, v2 = (seed + P2) & M64, v3 = seed & M64, v4 = (seed - P1) & M64;
    const limit = len - 32;
    do {
      v1 = round(v1, dv.getBigUint64(p, true)); p += 8;
      v2 = round(v2, dv.getBigUint64(p, true)); p += 8;
      v3 = round(v3, dv.getBigUint64(p, true)); p += 8;
      v4 = round(v4, dv.getBigUint64(p, true)); p += 8;
    } while (p <= limit);
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) & M64;
    h = mergeRound(h, v1); h = mergeRound(h, v2); h = mergeRound(h, v3); h = mergeRound(h, v4);
  } else {
    h = (seed + P5) & M64;
  }
  h = (h + BigInt(len)) & M64;
  while (p + 8 <= len) {
    const k1 = round(0n, dv.getBigUint64(p, true));
    h = ((rotl(h ^ k1, 27) * P1) + P4) & M64; p += 8;
  }
  if (p + 4 <= len) {
    h = ((rotl(h ^ ((BigInt(dv.getUint32(p, true)) * P1) & M64), 23) * P2) + P3) & M64; p += 4;
  }
  while (p < len) {
    h = (rotl(h ^ ((BigInt(data[p]) * P5) & M64), 11) * P1) & M64; p++;
  }
  h ^= h >> 33n; h = (h * P2) & M64;
  h ^= h >> 29n; h = (h * P3) & M64;
  h ^= h >> 32n;
  return h;
}

const enc = new TextEncoder();
const HEX16 = /^[0-9a-fA-F]{16}$/;

export function hashPath(path: string): bigint {
  if (path.length === 16 && HEX16.test(path)) return BigInt("0x" + path);
  let s = "";
  for (let i = 0; i < path.length; i++) {
    let c = path[i];
    if (c === "\\") c = "/";
    else if (c >= "A" && c <= "Z") c = c.toLowerCase();
    s += c;
  }
  return xxh64(enc.encode(s));
}

export const hex16 = (h: bigint) => h.toString(16).padStart(16, "0");

export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  const s = text.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    hash = (hash ^ (s.charCodeAt(i) & 0xff)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
