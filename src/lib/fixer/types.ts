export type WadKind = "archive" | "folder" | "fantome" | "zip";

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

export type FixerOptions = {
  skinNo: number;
  allAvailable: boolean;
  binless: boolean;
  noSkin: boolean;
  keepSfx: boolean;
  killStatic: boolean;
  keepIcons: boolean;
  keepUi: boolean;
  smallMod: boolean;
  sound: "auto" | "include" | "exclude";
  animation: "auto" | "include" | "exclude";
  affix: string;
  repathInFile: boolean;
};

export type LogLine = {
  id: number;
  tone: "act" | "warn" | "good" | "err" | "mod";
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

export const DEFAULT_OPTIONS: FixerOptions = {
  skinNo: 0,
  allAvailable: true,
  binless: false,
  noSkin: true,
  keepSfx: false,
  killStatic: false,
  keepIcons: true,
  keepUi: true,
  smallMod: true,
  sound: "auto",
  animation: "auto",
  affix: "",
  repathInFile: true,
};
