import { readFileSync, writeFileSync } from "node:fs";
import JSZip from "jszip";

import { inspectSkin, fixSkin } from "../src/lib/fixer/pipeline.ts";

const zip = new JSZip();
zip.file("META/info.json", JSON.stringify({ Name: "Midnight Ahri", Author: "atelier", Version: "1.4.2", Description: "kept" }));
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
if (text.includes("Skin Fixer")) throw new Error("fixer name leaked into metadata");
console.log(`ok ${report.title} by ${report.author} -> ${fixed.result.outputName}`);
void readFileSync;
