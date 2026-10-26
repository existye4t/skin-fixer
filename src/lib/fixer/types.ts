export type WadKind = "archive" | "folder" | "fantome" | "zip" | "modpkg";

export type WadEntry = {
  path: string;
  hash: number;
  size: number;
  extension: string;
};

export type ImportReport = {
  name: string;
  kind: WadKind;
  bytes: number;
  character: string | null;
  skinNumbers: number[];
  entries: WadEntry[];
  bins: string[];
  hashTables: string[];
  hasMeta: boolean;
  hasWad: boolean;
  title: string;
  author: string;
  version: string;
  description: string;
};

export type TriState = "auto" | "include" | "exclude";

export type ManifestChoice = {
  version: string;
  link: string;
};

/** Which desktop fixer the page is matching. */
export type FixerEngine = "cslol" | "celestial";

/** Celestial Quick Fix / import-repair toggles. Names follow QuickRepairOptions. */
export type CelestialOptions = {
  /** quick vs the full deep-repair step list. */
  mode: "quick" | "full";
  stripMipmaps: boolean;
  fixTexDimensions: boolean;
  nukeMaterials: boolean;
  nukeGearSkinData: boolean;
  restoreSco: boolean;
  fixHpBar: boolean;
  textures: boolean;
  voiceover: boolean;
  gearSkin: boolean;
  missingVfx: boolean;
};

/** Topaz Mod Fixer controls. Names follow FixerMenu.xaml. */
export type FixerOptions = {
  engine: FixerEngine;
  character: string;
  skinNo: number;
  allAvailable: boolean;
  binless: boolean;
  smallMod: boolean;
  noSkin: boolean;
  sound: TriState;
  animation: TriState;
  repathInFile: boolean;
  keepSfx: boolean;
  keepIcons: boolean;
  keepUi: boolean;
  keepBonus: boolean;
  killStatic: boolean;
  affix: string;
  manifest: boolean;
  manifestVersion: string;
  useGameIndex: boolean;
  celestial: CelestialOptions;
};

export const TRISTATE: Record<TriState, number> = { auto: 0, include: 1, exclude: 2 };

/** State for the optional game folder (DATA/FINAL directory) */
export type GameIndexState = {
  status: "idle" | "loading" | "ready" | "error";
  wadCount: number;
  fileCount: number;
  message: string;
};

export type LogLine = {
  id: number;
  tone: "act" | "warn" | "good" | "err" | "mod" | "head";
  text: string;
};

export type FixReport = {
  character: string;
  skinNo: number;
  scanned: number;
  bins: number;
  repaths: number;
  kept: number;
  dropped: number;
  missing: string[];
  outputName: string;
};

export const DEFAULT_CELESTIAL: CelestialOptions = {
  mode: "quick",
  stripMipmaps: true,
  fixTexDimensions: true,
  nukeMaterials: false,
  nukeGearSkinData: true,
  restoreSco: true,
  fixHpBar: true,
  textures: true,
  voiceover: true,
  gearSkin: true,
  missingVfx: true,
};

export const DEFAULT_OPTIONS: FixerOptions = {
  engine: "cslol",
  character: "",
  skinNo: 0,
  allAvailable: true,
  binless: false,
  smallMod: true,
  noSkin: true,
  sound: "auto",
  animation: "auto",
  repathInFile: true,
  keepSfx: false,
  keepIcons: true,
  keepUi: true,
  keepBonus: true,
  killStatic: false,
  affix: "",
  manifest: false,
  manifestVersion: "",
  useGameIndex: false,
  celestial: DEFAULT_CELESTIAL,
};
