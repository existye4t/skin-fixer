// Port of names.js – hash -> name resolution and fuzzy search.
import { hashPath } from "./hash";

const extCompat = (t: string, p: string) => p === t || (t === ".sco" && p === ".scb") || (t === ".dds" && p === ".tex") || (t === ".tex" && p === ".dds");
const extOf = (s: string) => { const f = s.slice(s.lastIndexOf("/") + 1); const i = f.lastIndexOf("."); return i >= 0 && i < f.length - 1 ? f.slice(i).toLowerCase() : ""; };
const baseName = (path: string) => { const f = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1); const d = f.indexOf("."); return (d >= 0 ? f.slice(0, d) : f).toLowerCase(); };

function dataRelative(path: string, percent: number) {
  const m = /data[\\\/]/i.exec(path);
  const rel = m ? path.slice(m.index + 5) : path;
  if (!rel) return "";
  const x = rel.length * (percent / 100);
  let cut = Math.floor(x); const frac = x - cut;
  if (frac > 0.5 || (frac === 0.5 && cut % 2 === 1)) cut++;
  cut = Math.max(0, Math.min(rel.length, cut));
  return rel.slice(0, cut).replace(/\\/g, "/").toLowerCase();
}

export class NameDB {
  temp = new Map<bigint, string>();
  text = "";
  byHash: Map<bigint, number> | null = null;

  addTemporary(paths: string[]) { for (const p of paths) if (p && p.trim()) this.temp.set(hashPath(p.trim()), p.trim()); }
  get hasBigList() { return this.text.length > 0; }

  loadGameHashes(parts: string[]) {
    this.text = parts.join("\n");
    this.byHash = new Map();
    let pos = 0; const t = this.text;
    while (pos < t.length) {
      let e = t.indexOf("\n", pos); if (e < 0) e = t.length;
      if (e - pos > 17 && t.charCodeAt(pos + 16) === 32) this.byHash.set(BigInt("0x" + t.slice(pos, pos + 16)), pos);
      pos = e + 1;
    }
  }

  resolve(hash: bigint): string | null {
    const a = this.temp.get(hash); if (a) return a;
    if (!this.byHash) return null;
    const p = this.byHash.get(hash); if (p === undefined) return null;
    let e = this.text.indexOf("\n", p); if (e < 0) e = this.text.length;
    return this.text.slice(p + 17, e);
  }

  findMatches(targets: { original: string; hashes: string[] }[], useBaseName = true, percent = 100) {
    const specs = targets.map(t => {
      t.hashes = [];
      if (!t.original) return ["", ""];
      return [useBaseName ? baseName(t.original) : dataRelative(t.original, percent), extOf(t.original)];
    });
    if (this.text) {
      const T = this.text;
      specs.forEach(([term, ext], i) => {
        if (!term) return;
        let from = 0;
        for (;;) {
          const idx = T.indexOf(term, from); if (idx < 0) break;
          const ls = T.lastIndexOf("\n", idx) + 1;
          let le = T.indexOf("\n", idx); if (le < 0) le = T.length;
          if (idx >= ls + 17) { const path = T.slice(ls + 17, le); if (extCompat(ext, extOf(path))) targets[i].hashes.push(path); }
          from = le + 1;
        }
      });
    }
    for (const path of this.temp.values()) {
      const lp = path.toLowerCase();
      specs.forEach(([term, ext], i) => { if (term && lp.includes(term) && extCompat(ext, extOf(path))) targets[i].hashes.push(path); });
    }
    if (!useBaseName) for (const t of targets) if (t.hashes.length > 1) t.hashes.sort((a, b) => b.length - a.length);
    return targets;
  }
}
