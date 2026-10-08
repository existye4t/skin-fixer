import JSZip from "jszip";

import { buildModpkg } from "./modpkg";
import type { FixerOptions, FixReport, ImportReport, LogLine, WadEntry, WadKind } from "./types";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(input: string) {
  let hash = FNV_OFFSET;
  const data = new TextEncoder().encode(input.toLowerCase());
  for (const byte of data) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

const CHAR_RE = /(?:^|\/)characters\/([a-z0-9_]+)\/skins\/skin(\d+)/i;
const WAD_RE = /(?:^|\/)([a-z0-9_]+)\.wad(?:\.client)?(?:\/|$)/i;
const BIN_RE = /(?:^|\/)([a-z0-9_]+)_skin(\d+)\.bin$/i;

function extensionOf(path: string) {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

function kindOf(name: string): WadKind {
  const lower = name.toLowerCase();
  if (lower.endsWith(".fantome")) return "fantome";
  if (lower.endsWith(".wad.client") || lower.endsWith(".wad")) return "archive";
  if (lower.endsWith(".zip")) return "zip";
  return "folder";
}

function characterFromName(name: string) {
  return name.toLowerCase().match(/^([a-z0-9_]+)\.wad/)?.[1] ?? null;
}

function tally(scores: Map<string, number>, name: string | undefined, weight: number) {
  if (!name || name.length < 2) return;
  const key = name.toLowerCase();
  scores.set(key, (scores.get(key) ?? 0) + weight);
}

export async function inspectSkin(file: File): Promise<ImportReport> {
  const kind = kindOf(file.name);
  const entries: WadEntry[] = [];
  const zip = await JSZip.loadAsync(file);
  zip.forEach((path, entry) => {
    if (entry.dir) return;
    entries.push({
      path: path.replaceAll("\\", "/"),
      hash: fnv1a(path.replaceAll("\\", "/")),
      size: (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data
        ?.uncompressedSize ?? 0,
      extension: extensionOf(path),
    });
  });

  const bins = entries.filter((entry) => entry.extension === "bin").map((entry) => entry.path);
  const hashTables = entries
    .filter((entry) => /hash|files\.txt$/i.test(entry.path))
    .map((entry) => entry.path);

  const scores = new Map<string, number>();
  const skinNumbers = new Set<number>();
  tally(scores, characterFromName(file.name) ?? undefined, 2);
  for (const entry of entries) {
    tally(scores, entry.path.match(WAD_RE)?.[1], 5);
    const match = entry.path.match(CHAR_RE);
    if (match) {
      tally(scores, match[1], 3);
      skinNumbers.add(Number(match[2]));
    }
    const bin = entry.path.match(BIN_RE);
    if (bin) {
      tally(scores, bin[1], 4);
      skinNumbers.add(Number(bin[2]));
    }
  }
  const infoPath = entries.find((entry) => /meta\/info\.json$/i.test(entry.path))?.path;
  let title = file.name.replace(/\.(fantome|zip|wad|client)$/gi, "");
  let author = "";
  let version = "0.0.0";
  let description = "";
  if (infoPath) {
    try {
      const info = JSON.parse(await zip.file(infoPath)!.async("string")) as Record<string, unknown>;
      const named = info.Champion ?? info.champion ?? info.Character ?? info.character;
      if (typeof named === "string") tally(scores, named, 6);
      if (typeof info.Name === "string" && info.Name.trim()) title = info.Name.trim();
      if (typeof info.Author === "string") author = info.Author;
      if (typeof info.Version === "string" && info.Version.trim()) version = info.Version.trim();
      if (typeof info.Description === "string") description = info.Description;
    } catch {
      /* info.json is optional */
    }
  }
  const character = [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    name: file.name,
    kind,
    bytes: file.size,
    character,
    skinNumbers: [...skinNumbers].sort((a, b) => a - b),
    entries,
    bins,
    hashTables,
    hasMeta: entries.some((entry) => entry.path.toUpperCase().startsWith("META/")),
    hasWad: entries.some((entry) => entry.path.toUpperCase().startsWith("WAD/")),
    title,
    author,
    version,
    description,
  };
}

const DROP_STATIC = /staticmaterials?|staticmaterialdef/i;
const SFX = /sfx_events\.bnk$/i;
const UI = /(^|\/)ui\.wad(\.client)?$/i;
const SOUND = /\.(bnk|wpk)$/i;
const ANIM = /\.(anm|skl)$/i;

function shouldDrop(path: string, options: FixerOptions) {
  if (!options.keepSfx && SFX.test(path)) return "sfx_events";
  if (options.killStatic && DROP_STATIC.test(path)) return "static material";
  if (options.sound === "exclude" && SOUND.test(path)) return "sound";
  if (options.animation === "exclude" && ANIM.test(path)) return "animation";
  return null;
}

function repath(path: string, options: FixerOptions, character: string) {
  if (!options.affix || !options.repathInFile) return path;
  return path.replace(
    new RegExp(`assets/characters/${character}/`, "i"),
    `assets/characters/${character}${options.affix}/`,
  );
}

export async function fixSkin(
  file: File,
  report: ImportReport,
  options: FixerOptions,
  onLog: (line: Omit<LogLine, "id">) => void,
): Promise<{ blob: Blob; result: FixReport }> {
  const character = report.character ?? "champion";
  const skinNo = options.allAvailable ? (report.skinNumbers[0] ?? options.skinNo) : options.skinNo;
  onLog({ tone: "act", text: `[SCAN] ${report.entries.length} entries in ${report.name}` });
  onLog({
    tone: "mod",
    text: `[CHAR] ${character} · skin ${skinNo}${options.allAvailable ? " · all available bins" : ""}`,
  });

  if (report.hashTables.length) {
    onLog({ tone: "good", text: `[HASH] loaded ${report.hashTables.length} hash table(s)` });
  } else {
    onLog({ tone: "warn", text: "[HASH] no hash table — paths hashed with FNV-1a only" });
  }

  const zip = await JSZip.loadAsync(file);
  const files: { path: string; data: Uint8Array }[] = [];
  const missing: string[] = [];
  let kept = 0;
  let dropped = 0;
  let repaths = 0;

  if (!options.binless) {
    onLog({ tone: "act", text: `[BIN] rewriting ${report.bins.length} bin path(s)` });
  } else {
    onLog({ tone: "warn", text: "[BIN] binless — assets verified, bin logic left untouched" });
  }

  for (const entry of report.entries) {
    const reason = shouldDrop(entry.path, options);
    if (reason) {
      dropped += 1;
      onLog({ tone: "warn", text: `[DROP] ${reason} · ${entry.path}` });
      continue;
    }
    if (UI.test(entry.path) && !options.keepUi) {
      dropped += 1;
      continue;
    }
    const nextPath = options.binless ? entry.path : repath(entry.path, options, character);
    if (nextPath !== entry.path) repaths += 1;
    const data = await zip.file(entry.path)?.async("uint8array");
    if (!data) {
      missing.push(entry.path);
      continue;
    }
    files.push({ path: nextPath, data });
    kept += 1;
  }

  if (options.smallMod) {
    onLog({ tone: "act", text: "[MOD] small mod — missing base assets were not pulled" });
  }
  if (!report.bins.length) {
    missing.push("skins.bin");
    onLog({ tone: "err", text: "[BIN] skins.bin was not inside the import" });
  }

  const outputName = file.name.replace(/\.(zip|wad|client)$/i, ".modpkg").replace(/\.fantome$/i, ".modpkg");
  const hashLines = report.entries.map((entry) => `${entry.hash.toString(16).padStart(8, "0")} ${entry.path}`);
  const hashPath = files.some((item) => /meta\/hashes\/game\.hashes\.txt$/i.test(item.path))
    ? "META/hashes/game.harvested.txt"
    : "META/hashes/game.hashes.txt";
  files.push({ path: hashPath, data: new TextEncoder().encode(hashLines.join("\n")) });
  onLog({ tone: "good", text: `[OUT] ${outputName} · ${report.title} · ${kept} kept · ${dropped} dropped` });
  const blob = await buildModpkg(report, `${character}.wad.client`, files);
  return {
    blob,
    result: {
      character,
      skinNo,
      scanned: report.entries.length,
      bins: report.bins.length,
      repaths,
      kept,
      dropped,
      missing,
      outputName,
    },
  };
}
