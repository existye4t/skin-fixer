import { readFileSync, writeFileSync } from "node:fs";
import { decode } from "@msgpack/msgpack";
import JSZip from "jszip";

import { retargetBin } from "../src/lib/fixer/bin.ts";
import { inspectSkin, fixSkin } from "../src/lib/fixer/pipeline.ts";

function binBytes() {
  const parts: number[] = [];
  const push = (...values: number[]) => parts.push(...values);
  const u16 = (value: number) => push(value & 255, value >> 8);
  const u32 = (value: number) => push(value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >> 24) & 255);
  push(...new TextEncoder().encode("PROP"));
  u32(3);
  u32(0);
  u32(1);
  u32(0x12345678);
  const path = [...new TextEncoder().encode("ASSETS/.Zed0_Characters/Zed/HUD/ZedQ.dds")];
  const body = [1, 0, 0x22, 0, 0, 0, 131, 0x33, 0, 0, 0];
  const nested = [1, 0, 0x44, 0, 0, 0, 16, path.length & 255, path.length >> 8, ...path];
  body.push(nested.length & 255, (nested.length >> 8) & 255, (nested.length >> 16) & 255, nested.length >> 24, ...nested);
  u32(0xabcdef);
  u32(body.length);
  push(...body);
  return new Uint8Array(parts);
}
const fixedBin = retargetBin(binBytes(), "@Zed0_");
const decoded = new TextDecoder().decode(fixedBin);
if (!decoded.includes("@Zed0_")) throw new Error(`dotted path was not moved: ${decoded.replace(/[^\x20-\x7e]/g, ".")}`);
if (decoded.includes("ASSETS/.Zed0_")) throw new Error("old dotted prefix survived");
if (retargetBin(fixedBin, "@Zed0_") === fixedBin) throw new Error("rewritten bin is not readable");
const zip = new JSZip();
zip.file("META/info.json", JSON.stringify({ Name: "Midnight Ahri", Author: "atelier", Version: "1.0", Description: "kept" }));
zip.file(
  "WAD/ahri.wad.client/data/characters/ahri/skins/skin11/ahri_skin11.bin",
  new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
);
zip.file(
  "WAD/ahri.wad.client/assets/characters/ahri/skins/skin11/ahri_skin11.bin",
  new Uint8Array([9, 9, 9, 9]),
);
const texture = new Uint8Array(200_000);
for (let i = 0; i < texture.length; i += 1) texture[i] = i % 17;
zip.file("WAD/ahri.wad.client/assets/characters/ahri/skins/skin11/ahri_skin11.dds", texture);
const bytes = await zip.generateAsync({ type: "nodebuffer" });
const file = new File([bytes], "Midnight Ahri.fantome");

const report = await inspectSkin(file);
if (report.character !== "ahri" || !report.skinNumbers.includes(11)) {
  throw new Error(`detect failed: ${report.character} ${report.skinNumbers.join(",")}`);
}

const fixed = await fixSkin(file, report, {
  skinNo: 11,
  allAvailable: true,
  binless: false,
  noSkin: false,
  keepSfx: false,
  killStatic: false,
  keepIcons: true,
  keepUi: true,
  smallMod: true,
  sound: "auto",
  animation: "auto",
  affix: "",
  repathInFile: true,
}, () => undefined);

const out = Buffer.from(await fixed.blob.arrayBuffer());
if (!out.subarray(0, 8).toString("ascii").startsWith("_modpkg")) {
  throw new Error(`bad magic ${out.subarray(0, 8).toString("hex")}`);
}
writeFileSync(new URL("./sample.modpkg", import.meta.url), out);
const flag = out[out.indexOf(texture.subarray(0, 4)) === -1 ? 0 : 0];
if (report.title !== "Midnight Ahri" || report.author !== "atelier" || !fixed.result.outputName.endsWith(".modpkg")) {
  throw new Error(`meta lost ${report.title} ${report.author} ${fixed.result.outputName}`);
}
const text = new TextDecoder().decode(out);
if (!text.includes("Midnight Ahri") || !text.includes("atelier")) throw new Error("metadata overwritten");
if (report.version !== "1.0.0") throw new Error(`version not padded: ${report.version}`);
const key = Buffer.from("schema_version");
const at = out.indexOf(key);
const start = out.lastIndexOf(Buffer.from([0x89]), at);
const meta = decode(out.subarray(start, start + 197)) as { version: string };
if (meta.version !== "1.0.0") throw new Error(`msgpack version ${JSON.stringify(meta)}`);
const textOut = new TextDecoder().decode(out);
const lower = textOut.toLowerCase();
for (const path of ["data/ahri_skin11_concat.bin", "data/ahri_skin11_staticmat.bin", "data/characters/ahri/skins/skin11.bin"]) {
  if (!lower.includes(path)) throw new Error(`missing ${path}`);
}
const wadAt = out.indexOf(Buffer.from("ahri.wad.client\0"));
if (wadAt < 0) throw new Error("wad name missing");
if (lower.includes("wad/ahri.wad.client/data/ahri_skin11_concat.bin")) throw new Error("concat path still prefixed");
if (text.includes("Skin Fixer")) throw new Error("fixer name leaked into metadata");
console.log(`ok ${report.title} by ${report.author} -> ${fixed.result.outputName}`);
void readFileSync;
