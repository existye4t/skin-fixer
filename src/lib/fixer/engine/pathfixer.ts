// Port of pathfixer.js – repath prefix logic.
const ROOTS = ["assets", "data"];
const CATEGORIES = ["characters", "items", "loadouts", "maps", "particles", "perks", "rewards", "shared", "sounds", "spells", "ux"];

const getExt = (name: string) => { const i = name.lastIndexOf("."); return i >= 0 && i < name.length - 1 ? name.slice(i) : ""; };
const lastSeg = (p: string) => p.slice(p.lastIndexOf("/") + 1);

function cleanRootPath(path: string) {
  let parts = path.replace(/\\/g, "/").split("/").filter(s => s.length);
  let rootIndex = -1;
  for (let i = 0; i < parts.length && rootIndex === -1; i++) {
    const pl = parts[i].toLowerCase();
    for (const r of ROOTS) if (pl === r || pl.includes(r)) { rootIndex = i; break; }
  }
  if (rootIndex === -1) {
    const ext = parts.length ? getExt(parts[parts.length - 1]).toLowerCase() : "";
    parts = [ext === ".bin" || ext === "" ? "DATA" : "ASSETS", ...parts];
  } else {
    parts = parts.slice(rootIndex);
  }
  if (parts.length <= 1) return parts.join("/");
  let categoryIndex = -1; let matched = "";
  for (let i = 1; i < parts.length && categoryIndex === -1; i++) {
    const sl = parts[i].toLowerCase();
    for (const cat of CATEGORIES) if (sl === cat || sl.includes(cat)) { categoryIndex = i; matched = cat; break; }
  }
  if (categoryIndex !== -1) {
    parts[categoryIndex] = matched;
    if (categoryIndex > 1) parts = [parts[0], ...parts.slice(categoryIndex)];
  }
  return parts.join("/");
}

export type PathFixerSettings = {
  cls_assets: boolean;
  in_file_path: boolean;
  repath_path_path: string;
};

export class PathFixer {
  s: PathFixerSettings;
  seen = new Set<string>();
  seenPre = new Set<string>();
  constructor(settings: PathFixerSettings) { this.s = settings; }

  fixPath(finalPath: string): string {
    const og = finalPath;
    finalPath = this.fixLocal(finalPath);
    if (!this.seen.has(finalPath)) { this.seen.add(finalPath); this.seenPre.add(og); return finalPath; }
    if (this.seenPre.has(og)) return finalPath;
    this.seenPre.add(og);
    const slash = finalPath.lastIndexOf("/");
    const dir = slash >= 0 ? finalPath.slice(0, slash) : "";
    const file = lastSeg(finalPath);
    const ext = getExt(file);
    const name = ext ? file.slice(0, file.length - ext.length) : file;
    let i = 1; let cand: string;
    do { cand = (dir ? dir + "/" : "") + `${name}_${i}${ext}`; i++; } while (this.seen.has(cand) || (this.seen.add(cand), false));
    return cand;
  }

  fixLocal(finalPath: string): string {
    if (this.s.cls_assets) finalPath = cleanRootPath(finalPath);
    const parts = finalPath.replace(/\\/g, "/").split("/").filter(s => s.length);
    const firstFolder = parts.length ? parts[0].toLowerCase() : "";
    const ext = parts.length ? getExt(parts[parts.length - 1]).toLowerCase() : "";
    let repath = this.s.repath_path_path;
    const inFile = this.s.in_file_path;
    if (inFile && !repath.endsWith("_")) repath = repath + "_";
    if (firstFolder === "data" || firstFolder === "assets") {
      const root = firstFolder === "data" ? "DATA" : "ASSETS";
      if (inFile) {
        const prefix = `${root}/${repath}${parts.length > 1 ? parts[1] : ""}`;
        const rest = parts.length > 2 ? parts.slice(2).join("/") : "";
        return rest.length > 0 ? `${prefix}/${rest}` : prefix;
      }
      parts[0] = `${root}/${repath}`;
      return parts.join("/");
    }
    if (parts.length === 1) return `ASSETS/${repath}/${parts[0]}`;
    const prefixRoot = ext === ".bin" || ext === "" ? "DATA" : "ASSETS";
    if (inFile) return `${prefixRoot}/${repath}${parts[0]}/` + parts.slice(1).join("/");
    return `${prefixRoot}/${repath}/` + parts.join("/");
  }
}
