import JSZip from "jszip";
import { unzipSync, zipSync } from "fflate";
import { decompress as zstdDecompress } from "fzstd";
import { decode as msgpackDecode } from "@msgpack/msgpack";

import { buildModpkg } from "./modpkg";
import type { FixerOptions, FixReport, ImportReport, LogLine, WadEntry, WadKind } from "./types";
import { ModSource, buildWad } from "./engine/wad";
import { GameIndex, filesFromDirHandle, filesFromFileList } from "./engine/game";
import { NameDB } from "./engine/names";
import { hashPath } from "./engine/hash";
import { Fixer } from "./engine/fixer";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(input: string) {
  let hash = FNV_OFFSET;
  const data = new TextEncoder().encode(input.toLowerCase());
  for (const byte of data) { hash ^= byte; hash = Math.imul(hash, FNV_PRIME) >>> 0; }
  return hash >>> 0;
}

const CHAR_RE = /(?:^|\/)characters\/([a-z0-9_]+)\/skins\/skin(\d+)/i;
const WAD_RE = /(?:^|\/)([a-z0-9_]+)\.wad(?:\.client)?(?:\/|$)/i;
const BIN_RE = /(?:^|\/)([a-z0-9_]+)_skin(\d+)\.bin$/i;

function extensionOf(path: string) { const dot = path.lastIndexOf("."); return dot === -1 ? "" : path.slice(dot + 1).toLowerCase(); }
function kindOf(name: string): WadKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".fantome")) return "fantome";
  if (lower.endsWith(".modpkg")) return "modpkg";
  if (lower.endsWith(".wad.client") || lower.endsWith(".wad")) return "archive";
  if (lower.endsWith(".zip")) return "zip";
  return "folder";
}
function padInfoVersion(data: Uint8Array) {
  try { const info = JSON.parse(new TextDecoder().decode(data)) as Record<string, unknown>; if (typeof info.Version === "string") info.Version = semver(info.Version); return new TextEncoder().encode(JSON.stringify(info)); } catch { return data; }
}
export function semver(value: string) {
  const parts = value.trim().replace(/^v/i, "").split(".").filter(Boolean);
  while (parts.length < 3) parts.push("0");
  return parts.slice(0, 3).join(".");
}
function characterFromName(name: string) { return name.toLowerCase().match(/^([a-z0-9_]+)\.wad/)?.[1] ?? null; }
function tally(scores: Map<string, number>, name: string | undefined, weight: number) {
  if (!name || name.length < 2) return; const key = name.toLowerCase(); scores.set(key, (scores.get(key) ?? 0) + weight);
}

export async function inspectSkin(file: File): Promise<ImportReport> {
  const kind = kindOf(file.name);

  // .modpkg: binary format — read without JSZip
  if (kind === "modpkg") return inspectModpkg(file);

  const entries: WadEntry[] = [];
  const zip = await JSZip.loadAsync(file);
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    entries.push({ path: path.replaceAll("\\", "/"), hash: fnv1a(path.replaceAll("\\", "/")), size: (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0, extension: extensionOf(path) });
  });
  const bins = entries.filter(e => e.extension === "bin").map(e => e.path);
  const hashTables = entries.filter(e => /hash|files\.txt$/i.test(e.path)).map(e => e.path);
  const scores = new Map<string, number>(); const skinNumbers = new Set<number>();
  tally(scores, characterFromName(file.name) ?? undefined, 2);
  for (const entry of entries) {
    tally(scores, entry.path.match(WAD_RE)?.[1], 5);
    const match = entry.path.match(CHAR_RE); if (match) { tally(scores, match[1], 3); skinNumbers.add(Number(match[2])); }
    const bin = entry.path.match(BIN_RE); if (bin) { tally(scores, bin[1], 4); skinNumbers.add(Number(bin[2])); }
  }
  const infoPath = entries.find(e => /meta\/info\.json$/i.test(e.path))?.path;
  let title = file.name.replace(/\.(fantome|zip|wad|client)$/gi, ""), author = "", version = "0.0.0", description = "";
  if (infoPath) {
    try {
      const info = JSON.parse(await zip.file(infoPath)!.async("string")) as Record<string, unknown>;
      const named = info.Champion ?? info.champion ?? info.Character ?? info.character;
      if (typeof named === "string") tally(scores, named, 6);
      if (typeof info.Name === "string" && info.Name.trim()) title = info.Name.trim();
      if (typeof info.Author === "string") author = info.Author;
      if (typeof info.Version === "string" && info.Version.trim()) version = semver(info.Version);
      if (typeof info.Description === "string") description = info.Description;
    } catch { /* info.json optional */ }
  }
  const character = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { name: file.name, kind, bytes: file.size, character, skinNumbers: [...skinNumbers].sort((a, b) => a - b), entries, bins, hashTables, hasMeta: entries.some(e => e.path.toUpperCase().startsWith("META/")), hasWad: entries.some(e => e.path.toUpperCase().startsWith("WAD/")), title, author, version, description };
}

// ---- Singleton game index (shared across runs) ----
let _gameIndex: GameIndex | null = null;
export function getGameIndex() { return _gameIndex; }
export async function loadGameDir(handle: FileSystemDirectoryHandle, onProgress?: (i: number, n: number) => void): Promise<GameIndex> {
  const g = new GameIndex();
  const files = await filesFromDirHandle(handle);
  await g.load(files, onProgress);
  _gameIndex = g;
  return g;
}
export async function loadGameFileList(list: FileList, onProgress?: (i: number, n: number) => void): Promise<GameIndex> {
  const g = new GameIndex();
  await g.load(filesFromFileList(list), onProgress);
  _gameIndex = g;
  return g;
}

// ---- Name hash DB (optional, shared) ----
const _names = new NameDB();
export function getNamesDB() { return _names; }
const NAME_URLS = [
  "https://raw.githubusercontent.com/CommunityDragon/Data/master/hashes/lol/hashes.game.txt.0",
  "https://raw.githubusercontent.com/CommunityDragon/Data/master/hashes/lol/hashes.game.txt.1",
];
export async function isNamesCached(): Promise<boolean> {
  try {
    const cache = await caches.open("skinfixer-names-v1");
    const r = await cache.match(NAME_URLS[0]);
    return r !== undefined;
  } catch {
    return false;
  }
}

export async function loadHashNames(onProgress?: (msg: string) => void): Promise<void> {
  const cache = await caches.open("skinfixer-names-v1");
  const parts: string[] = [];
  for (let i = 0; i < NAME_URLS.length; i++) {
    onProgress?.(`Downloading ${i + 1}/${NAME_URLS.length}...`);
    let r = await cache.match(NAME_URLS[i]);
    if (!r) { r = await fetch(NAME_URLS[i]); if (!r.ok) throw new Error("HTTP " + r.status); await cache.put(NAME_URLS[i], r.clone()); }
    parts.push(await r.text());
  }
  onProgress?.("Indexing...");
  await new Promise(r => setTimeout(r, 0));
  _names.loadGameHashes(parts);
  onProgress?.(`Ready (${_names.byHash!.size.toLocaleString()} names).`);
}

// ---- .modpkg reader ----
const MODPKG_MAGIC = "_modpkg_";

async function readModpkgRaw(file: File): Promise<{
  paths: string[];
  wads: string[];
  files: Map<string, Uint8Array>; // fullPath → data
  meta: Record<string, unknown> | null;
}> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 0;

  const magic = new TextDecoder().decode(buf.slice(0, 8));
  if (magic !== MODPKG_MAGIC) throw new Error("Not a valid .modpkg file (bad magic)");
  pos = 8;

  /* version */ dv.getUint32(pos, true); pos += 4;
  /* reserved */ dv.getUint32(pos, true); pos += 4;
  const fileCount = dv.getUint32(pos, true); pos += 4;
  /* layerCount */ dv.getUint32(pos, true); pos += 4;
  const layerNameLen = dv.getUint32(pos, true); pos += 4;
  pos += layerNameLen; // layer name bytes
  pos += 4; // priority i32

  const pathCount = dv.getUint32(pos, true); pos += 4;
  const paths: string[] = [];
  for (let i = 0; i < pathCount; i++) {
    let end = pos; while (buf[end] !== 0) end++;
    paths.push(new TextDecoder().decode(buf.slice(pos, end)));
    pos = end + 1;
  }

  const wadCount = dv.getUint32(pos, true); pos += 4;
  const wads: string[] = [];
  for (let i = 0; i < wadCount; i++) {
    let end = pos; while (buf[end] !== 0) end++;
    wads.push(new TextDecoder().decode(buf.slice(pos, end)));
    pos = end + 1;
  }

  // pad to 8-byte alignment (same as builder)
  pos += (8 - (pos % 8)) % 8;

  // descriptors: 61 bytes each
  const descs: { offset: number; compressed: boolean; compressedSize: number; rawSize: number; fileIndex: number; wadIndex: number }[] = [];
  for (let i = 0; i < fileCount; i++) {
    pos += 8; // path hash
    const offset = Number(dv.getBigUint64(pos, true)); pos += 8;
    const compressed = buf[pos] === 1; pos += 1;
    const compressedSize = Number(dv.getBigUint64(pos, true)); pos += 8;
    const rawSize = Number(dv.getBigUint64(pos, true)); pos += 8;
    pos += 8; // compressed hash
    pos += 8; // raw hash
    const fileIndex = dv.getUint32(pos, true); pos += 4;
    pos += 4; // layer index
    const wadIndex = dv.getUint32(pos, true); pos += 4;
    descs.push({ offset, compressed, compressedSize, rawSize, fileIndex, wadIndex });
  }

  const result = new Map<string, Uint8Array>();
    let meta: Record<string, unknown> | null = null;

    for (const desc of descs) {
      const chunk = buf.slice(desc.offset, desc.offset + desc.compressedSize);
      const data: Uint8Array = desc.compressed ? zstdDecompress(chunk) : chunk;

      const filePath = paths[desc.fileIndex];
      if (filePath === "_meta_/info.msgpack") {
        try { meta = msgpackDecode(data) as Record<string, unknown>; } catch { /* ignore */ }
        continue;
      }
      const wadName = desc.wadIndex < wads.length ? wads[desc.wadIndex] : null;
      const fullPath = wadName ? `WAD/${wadName}/${filePath}` : filePath;
      result.set(fullPath, data);
    }

    return { paths, wads, files: result, meta };
}

async function inspectModpkg(file: File): Promise<ImportReport> {
  const kind: WadKind = "modpkg";
  const { files, meta } = await readModpkgRaw(file);
  const entries: WadEntry[] = [];
  const scores = new Map<string, number>();
  const skinNumbers = new Set<number>();

  for (const [fullPath] of files) {
    const path = fullPath.replace(/^WAD\/[^/]+\//i, "");
    const ext = extensionOf(path);
    entries.push({ path, hash: fnv1a(path), size: 0, extension: ext });
    tally(scores, path.match(WAD_RE)?.[1], 5);
    const cm = path.match(CHAR_RE); if (cm) { tally(scores, cm[1], 3); skinNumbers.add(Number(cm[2])); }
    const bm = path.match(BIN_RE); if (bm) { tally(scores, bm[1], 4); skinNumbers.add(Number(bm[2])); }
  }

  tally(scores, characterFromName(file.name) ?? undefined, 2);
  if (meta) {
    const named = (meta.name ?? meta.display_name) as string | undefined;
    if (named) tally(scores, named, 6);
  }

  const character = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const bins = entries.filter(e => e.extension === "bin").map(e => e.path);
  const title = (meta?.name as string | undefined)?.trim() || file.name.replace(/\.modpkg$/i, "");
  const author = (meta?.authors as Array<{ name: string }> | undefined)?.[0]?.name ?? "";
  const version = semver((meta?.version as string | undefined) ?? "0.0.0");
  const description = (meta?.description as string | undefined) ?? "";

  return {
    name: file.name, kind, bytes: file.size, character,
    skinNumbers: [...skinNumbers].sort((a, b) => a - b),
    entries, bins, hashTables: [],
    hasMeta: true, hasWad: [...files.keys()].some(p => /WAD\//i.test(p)),
    title, author, version, description,
  };
}

// ---- Build ModSource from zip or modpkg file ----
async function buildModSource(file: File): Promise<ModSource> {
  const mod = new ModSource();
  const buf = new Uint8Array(await file.arrayBuffer());

  // .modpkg: read extracted files and add as loose
  if (kindOf(file.name) === "modpkg") {
    const { files } = await readModpkgRaw(file);
    const byWad = new Map<string, Map<string, Uint8Array>>();
    for (const [fullPath, data] of files) {
      const m = /^WAD\/([^/]+)\/(.+)$/i.exec(fullPath);
      if (!m) continue;
      const [, wadName, inner] = m;
      if (!byWad.has(wadName)) byWad.set(wadName, new Map());
      byWad.get(wadName)!.set(inner, data);
    }
    for (const [wadName, filesMap] of [...byWad].reverse()) mod.addLoose(wadName, filesMap);
    return mod;
  }

  if (/\.wad(\.client)?$/i.test(file.name)) {
    await mod.addWad(file.name, buf);
  } else {
    const z = unzipSync(buf);
    const wadFiles: [string, Uint8Array][] = [];
    const loose = new Map<string, Map<string, Uint8Array>>();
    for (const [name, data] of Object.entries(z)) {
      const m = /^WAD\/([^/]+?\.wad(?:\.client)?)(?:\/(.+))?$/i.exec(name);
      if (!m || (!data.length && name.endsWith("/"))) continue;
      if (m[2]) { if (!loose.has(m[1])) loose.set(m[1], new Map()); loose.get(m[1])!.set(m[2], data); }
      else wadFiles.push([m[1], data]);
    }
    for (const [n, d] of wadFiles.reverse()) await mod.addWad(n, d);
    for (const [n, filesMap] of [...loose].reverse()) mod.addLoose(n, filesMap);
  }
  return mod;
}

const RELATED: Record<string, string[]> = {
  zed: ["zedshadow"], annie: ["annietibbers"], shaco: ["shacobox"], ivern: ["ivernminion"],
  elise: ["elisespiderling"], heimerdinger: ["heimertblue", "heimertyellow"], malzahar: ["malzaharvoidling"],
  yorick: ["yorickghoulmelee"], zyra: ["zyraseed"], naafiri: ["naafiripackmate"], belveth: ["belvethvoidling"], azir: ["azirsoldier"],
};

const SFX = /sfx_events\.bnk$/i;
const UI = /(^|\/)ui\.wad(\.client)?$/i;
const SOUND = /\.(bnk|wpk)$/i;
const ANIM = /\.(anm|skl)$/i;
const DROP_STATIC = /staticmaterials?|staticmaterialdef/i;

function shouldDrop(path: string, options: FixerOptions): string | null {
  if (!options.keepSfx && SFX.test(path)) return "sfx_events";
  if (options.killStatic && DROP_STATIC.test(path)) return "static material";
  if (options.sound === "exclude" && SOUND.test(path)) return "sound";
  if (options.animation === "exclude" && ANIM.test(path)) return "animation";
  return null;
}

function prefixFor(character: string, skinNo: number) { return `@${character.slice(0, 4)}${skinNo}_`; }

function repathAsset(path: string, prefix: string) {
  const parts = path.replaceAll("\\", "/").split("/").filter(Boolean);
  if (parts.length < 2) return path;
  const assetIdx = parts.findIndex(p => /^(assets|data)$/i.test(p));
  if (assetIdx === -1 || assetIdx + 1 >= parts.length) return path;
  const folder = parts[assetIdx + 1];
  if (!folder.startsWith(".")) return path;
  const prefixNoAt = prefix.slice(1);
  if (!folder.toLowerCase().startsWith("." + prefixNoAt.toLowerCase())) return path;
  const suffix = folder.slice(1 + prefixNoAt.length).toLowerCase();
  const rest = parts.slice(assetIdx + 2).join("/");
  const newAssetPart = `${parts[assetIdx].toUpperCase()}/@${prefixNoAt}${suffix}${rest ? `/${rest}` : ""}`;
  return [...parts.slice(0, assetIdx), newAssetPart].join("/");
}

import { binFailure, retargetBin } from "./bin";

export async function fixSkin(
  file: File,
  report: ImportReport,
  options: FixerOptions,
  onLog: (line: Omit<LogLine, "id">) => void,
): Promise<{ blob: Blob; result: FixReport }> {
  const character = report.character ?? "champion";
  const skinNo = options.allAvailable ? (report.skinNumbers[0] ?? options.skinNo) : options.skinNo;

  onLog({ tone: "act", text: `[SCAN] ${report.entries.length} entries in ${report.name}` });
  onLog({ tone: "mod", text: `[CHAR] ${character} · skin ${skinNo}${options.allAvailable ? " · all available bins" : ""}` });

  const game = options.useGameIndex ? _gameIndex : null;
  if (game?.ready) onLog({ tone: "good", text: `[GAME] ${game.wads.length} WADs, ${game.map.size.toLocaleString()} files indexed` });
  else if (options.useGameIndex) onLog({ tone: "warn", text: "[GAME] no game index loaded – running without it" });

  // Build mod source from the zip
  let mod: ModSource;
  try {
    mod = await buildModSource(file);
    onLog({ tone: "act", text: `[MOD] ${mod.containers.length} WADs, ${mod.map.size} entries loaded` });
  } catch (e) {
    // Fallback: legacy path-rewrite pipeline
    onLog({ tone: "warn", text: `[MOD] engine load failed, using legacy pipeline: ${(e as Error).message}` });
    return legacyFixSkin(file, report, options, onLog);
  }

  const fixer = new Fixer(
    { mod, game, names: _names, log: (msg, kind) => onLog({ tone: (kind as LogLine["tone"]) ?? "act", text: msg }) },
    {
      character,
      skinNo,
      allSkins: options.allAvailable,
      prefix: options.affix,
      apply1617: options.apply1617,
      convertBeforeCollect: options.convertBeforeCollect,
      binless: options.binless,
      smallMod: options.smallMod,
      noskinni: options.noSkin,
      killStaticMat: options.killStatic,
      keepIcons: options.keepIcons,
      in_file_path: options.repathInFile,
      cls_assets: true,
      sfxEvents: options.keepSfx,
      verifyHpBar: true,
      healthbarStyle: 12,
    }
  );

  let fixResult;
  try {
    fixResult = await fixer.run();
  } catch (e) {
    // Fallback on engine failure
    onLog({ tone: "warn", text: `[FIXER] full engine failed: ${(e as Error).message} — falling back to legacy` });
    return legacyFixSkin(file, report, options, onLog);
  }

  const outputName = file.name
        .replace(/\.(zip|wad|client)$/i, ".fantome")
        .replace(/\.fantome$/i, "_fixed.fantome")
        .replace(/\.modpkg$/i, "_fixed.modpkg");
      const files: { path: string; data: Uint8Array }[] = [];

    for (const [path, data] of fixResult.files) {
      files.push({ path, data });
    }

    // Add META/hashes if we have it
    const index = files.map(f => f.path).filter(p => !p.toUpperCase().startsWith("META/"));
    files.push({ path: "META/hashes.game.txt", data: new TextEncoder().encode(index.join("\n") + "\n") });

    const missing = fixResult.missing;
    const kept = files.length;
    const repaths = fixResult.hashTable.length;

    onLog({ tone: "good", text: `[OUT] ${outputName} · ${kept} files · ${missing.length} missing` });

    let blob: Blob;
    if (kindOf(file.name) === "modpkg") {
      blob = await buildModpkg(report, `${character}.wad.client`, files);
    } else {
        // Build a fantome zip: WAD/<character>.wad.client contains the WAD binary
        // Matches cslol-go output format exactly
        const wadFiles: { hash: bigint; data: Uint8Array }[] = [];
        const metaFiles: { path: string; data: Uint8Array }[] = [];
        for (const f of files) {
          if (f.path.toUpperCase().startsWith("META/")) {
            metaFiles.push(f);
          } else {
            wadFiles.push({ hash: hashPath(f.path), data: f.data });
          }
        }
        const wadBin = buildWad(wadFiles);
        const zipEntries: Record<string, Uint8Array> = {};
        zipEntries[`WAD/${character}.wad.client`] = wadBin;

        // Pass through original META/info.json — preserve all original fields
                // Only add missing META files (hashes etc), never overwrite info.json
                const hasInfoJson = metaFiles.some(m => /meta\/info\.json$/i.test(m.path));
                if (!hasInfoJson) {
                  // Read original info.json bytes directly from input zip (unzipSync is already imported)
                  let infoData: Uint8Array | null = null;
                  try {
                    const origBuf = new Uint8Array(await file.arrayBuffer());
                    const origEntries = unzipSync(origBuf);
                    const key = Object.keys(origEntries).find(k => /meta\/info\.json$/i.test(k));
                    if (key) infoData = origEntries[key];
                  } catch { /* ignore */ }
                  if (!infoData) {
                    const info = { Name: report.title || outputName.replace(/_fixed\.fantome$/, ""), Author: report.author || "Exist", Version: report.version || "1.0", Description: report.description || "" };
                    infoData = new TextEncoder().encode(JSON.stringify(info, null, 2));
                  }
                  zipEntries["META/info.json"] = infoData;
                }
        for (const m of metaFiles) zipEntries[m.path] = m.data;

        blob = new Blob([zipSync(zipEntries, { level: 0 })], { type: "application/octet-stream" });
      }
  return {
    blob,
    result: { character, skinNo, scanned: report.entries.length, bins: report.bins.length, repaths, kept, dropped: 0, missing, outputName },
  };
}

/** Legacy zip-based path-rewrite pipeline (fallback for files without binary WADs) */
async function legacyFixSkin(
  file: File,
  report: ImportReport,
  options: FixerOptions,
  onLog: (line: Omit<LogLine, "id">) => void,
): Promise<{ blob: Blob; result: FixReport }> {
  const character = report.character ?? "champion";
  const skinNo = options.allAvailable ? (report.skinNumbers[0] ?? options.skinNo) : options.skinNo;
  const zip = await JSZip.loadAsync(file);
  const files: { path: string; data: Uint8Array }[] = [];
  const missing: string[] = [];
  let kept = 0, dropped = 0, repaths = 0;

  if (!options.binless) onLog({ tone: "act", text: `[BIN] rewriting ${report.bins.length} bin path(s)` });
  else onLog({ tone: "warn", text: "[BIN] binless — bin logic untouched" });

  for (const entry of report.entries) {
    const reason = shouldDrop(entry.path, options);
    if (reason) { dropped++; onLog({ tone: "warn", text: `[DROP] ${reason} · ${entry.path}` }); continue; }
    if (UI.test(entry.path) && !options.keepUi) { dropped++; continue; }
    const prefix = prefixFor(character, skinNo);
    const nextPath = options.binless || !options.repathInFile ? entry.path : repathAsset(entry.path, prefix);
    if (nextPath !== entry.path) repaths++;
    const data = await zip.file(entry.path)?.async("uint8array");
    if (!data) { missing.push(entry.path); continue; }
    let payload = /meta\/info\.json$/i.test(entry.path) ? padInfoVersion(data) : data;
    if (!options.binless && options.repathInFile && entry.extension === "bin") {
      payload = retargetBin(payload, prefix);
      const failure = binFailure(payload);
      if (failure) onLog({ tone: "err", text: `[BIN] ${entry.path} was not rewritten: ${failure}` });
    }
    files.push({ path: nextPath, data: payload }); kept++;
  }
  if (!options.binless) {
    const skins = options.allAvailable && report.skinNumbers.length ? report.skinNumbers : [skinNo];
    const names = new Set<string>([character, ...(RELATED[character] ?? [])]);
    for (const entry of report.entries) { const related = entry.path.match(BIN_RE)?.[1]; if (related) names.add(related.toLowerCase()); }
    for (const name of names) for (const skin of skins) {
      const source = files.find(item => new RegExp(`${name}_skin${skin}\\.bin$`, "i").test(item.path) && !/_concat\.bin$/i.test(item.path));
      if (!source) continue;
      for (const suffix of ["concat", "StaticMat"]) { const binPath = `data/${name}_skin${skin}_${suffix}.bin`; if (files.some(item => item.path.toLowerCase() === binPath.toLowerCase())) continue; files.push({ path: binPath, data: source.data }); onLog({ tone: "good", text: `[BIN] wrote ${binPath}` }); }
      const skinPath = `data/characters/${name}/skins/skin${skin}.bin`;
      if (!files.some(item => item.path.toLowerCase() === skinPath)) { files.push({ path: skinPath, data: source.data }); onLog({ tone: "good", text: `[BIN] wrote ${skinPath}` }); }
    }
  }
  if (!report.bins.length) { missing.push("skins.bin"); onLog({ tone: "err", text: "[BIN] skins.bin was not inside the import" }); }
  const outputName = file.name
      .replace(/\.(zip|wad|client)$/i, ".fantome")
      .replace(/\.fantome$/i, "_fixed.fantome")
      .replace(/\.modpkg$/i, "_fixed.modpkg");
    const index = [...new Set(files.map(item => item.path).filter(p => !p.toUpperCase().startsWith("META/")))];
  files.push({ path: "META/hashes.game.txt", data: new TextEncoder().encode(`${index.join("\n")}\n`) });
  onLog({ tone: "good", text: `[HASH] indexed ${index.length} game file(s)` });
  onLog({ tone: "good", text: `[OUT] ${outputName} · ${report.title} · ${kept} kept · ${dropped} dropped` });
  const blob = await buildModpkg(report, `${character}.wad.client`, files);
  return { blob, result: { character, skinNo, scanned: report.entries.length, bins: report.bins.length, repaths, kept, dropped, missing, outputName } };
}
