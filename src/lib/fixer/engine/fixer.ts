// Port of fixer.js + fixer-load.js – full cslol-go Repatheruwu fixer pipeline.
import { T, FNV, XXH, BinField, BinEmbed, BinPointer, BinMap, BinList, BinValue, BinFile, BinU8, BinF32, BinVec3, BinString, readBin, writeBin, makeBin } from "./bin-types";
import type { FnvRef, XxhRef } from "./bin-types";
import { hashPath, fnv1a, hex16 } from "./hash";
import { PathFixer } from "./pathfixer";
import { BinConverter, ConvertedStringsTracker } from "./converter";
import { NameDB } from "./names";
import { ModSource } from "./wad";
import { GameIndex } from "./game";
import RULES from "./convert-rules";
import { CHARACTER_CASES } from "./character-cases";

export type LogFn = (msg: string, kind?: string) => void;
export type FixerSettings = {
  character: string; skinNo: number; allSkins: boolean; prefix: string;
  apply1617: boolean; convertBeforeCollect: boolean; healthbarStyle: number;
  verifyHpBar: boolean; in_file_path: boolean; cls_assets: boolean; keepIcons: boolean;
  killStaticMat: boolean; binless: boolean; smallMod: boolean; sfxEvents: boolean;
  noskinni: boolean; repath_path_path?: string;
};
export const FIXER_DEFAULTS: FixerSettings = {
  character: "", skinNo: 0, allSkins: false, prefix: "", apply1617: true, convertBeforeCollect: true,
  healthbarStyle: 12, verifyHpBar: true, in_file_path: true, cls_assets: true, keepIcons: true,
  killStaticMat: false, binless: false, smallMod: true, sfxEvents: false, noskinni: true,
};
const lc = (s: string) => s.toLowerCase();
const extOf = (s: string) => { const f = s.slice(s.lastIndexOf("/") + 1); const i = f.lastIndexOf("."); return i >= 0 && i < f.length - 1 ? f.slice(i) : ""; };
const splitN = (s: string, sep: string, n: number) => {
  const out: string[] = []; let rest = s;
  while (out.length < n - 1) { const i = rest.indexOf(sep); if (i < 0) break; out.push(rest.slice(0, i)); rest = rest.slice(i + 1); }
  out.push(rest); return out;
};
const getF = (e: BinEmbed, h: number) => e.items.find(f => f.key.h === h);
const val = (e: BinEmbed, h: number) => getF(e, h)?.value;
const itemsOf = (v: BinValue | undefined): BinField[] | null => v && (v.t === T.Embed || v.t === T.Pointer) ? (v as unknown as BinEmbed).items : null;
const BLACKLIST = ["viegowraith"];
const BLACKLIST_LUX = ["luxair","luxdark","luxfire","luxice","luxmagma","luxmystic","luxnature","luxstorm","luxwater"];
const LUX_FORMS = BLACKLIST_LUX;
function shouldSkipFile(path: string) {
  const parts = path.replace(/\\/g, "/").split("/");
  if (parts.length < 4) return false;
  const file = parts[parts.length - 1], folder = parts[parts.length - 2], parent = parts[parts.length - 3], gp = parts[parts.length - 4];
  if (lc(parent) !== "characters" || lc(gp) !== "data") return false;
  const dot = file.lastIndexOf("."); return lc(folder) === lc(dot > 0 ? file.slice(0, dot) : file);
}
function validate(dict: Map<number, unknown>, names: number[]) { for (const k of [...dict.keys()]) if (!names.includes(k)) dict.delete(k); }
function analyzeNested(root: BinValue, st: { flags?: boolean; keep?: boolean; rot?: boolean }, rotation: boolean) {
  const data = itemsOf(root); if (!data) return;
  for (const td of data) {
    if (td.key.h !== 0xa7084719 || td.value.t !== T.List) continue;
    for (const it of (td.value as unknown as BinList).items) {
      const small = itemsOf(it); if (!small) continue;
      for (const sm of small) {
        if (sm.key.h !== 0xe44b7382 || sm.value.t !== T.List || (sm.value as unknown as BinList).items.length < 2) continue;
        const a = (sm.value as unknown as BinList).items[0], b = (sm.value as unknown as BinList).items[1];
        const d0 = a.t === T.F32 ? a.v as number : -999, d1 = b.t === T.F32 ? b.v as number : -999;
        if (rotation) { if (d0 === 0 && d1 > 1) st.rot = true; }
        else if (d0 === 0 && d1 >= 1) st.flags = true;
        else if (d0 === -1 && d1 === 1) st.keep = true;
      }
    }
  }
}
function fixShapes(vfx: Map<number, { v: BinValue }>) {
  for (const { v: vfxEmbed } of vfx.values()) {
    if (vfxEmbed.t !== T.Embed) continue;
    const ve = vfxEmbed as unknown as BinEmbed;
    for (const listField of ve.items.filter(f => f.key.h === 0x6781e762 || f.key.h === 0x868eb76a)) {
      if (listField.value.t !== T.List) continue;
      for (const emitter of (listField.value as unknown as BinList).items) {
        if (emitter.t !== T.Pointer) continue;
        const ep = emitter as unknown as BinPointer;
        const shapeField = getF(ep as unknown as BinEmbed, 0x9dc3d926); if (!shapeField) continue;
        const shapeItems = itemsOf(shapeField.value); if (!shapeItems || !shapeItems.length) continue;
        let rotKV = false, axes = false, radius = 0, height = 0;
        const flagSt = { flags: false, keep: false }, rotSt = { rot: false };
        for (const ins of shapeItems) {
          if (ins.key.h === 0xff7d0e41) {
            const inner = itemsOf(ins.value);
            const v3 = inner?.find(f => f.key.h === 0xb4b427aa && f.value.t === T.Vec3);
            if (v3) {
              const birth = new BinEmbed(FNV(0x68dc32b6));
              birth.items.push(new BinField(v3.key, BinVec3((v3.value.v as number[]).slice())));
              ep.items.push(new BinField(FNV(0x563d4a22), birth as unknown as BinValue));
              ins.value = new BinEmbed(FNV(0)) as unknown as BinValue;
            }
          } else if (ins.key.h === 0xe5f268dd) {
            for (const it of itemsOf(ins.value) || []) {
              if (it.key.h === 0xb4b427aa && it.value.t === T.Vec3) { radius = (it.value.v as number[])[0]; height = (it.value.v as number[])[1]; }
              else if (it.key.h === 0xbc037de7) analyzeNested(it.value, flagSt, false);
            }
          } else if (ins.key.h === 0x07f41838) {
            for (const vf of itemsOf(ins.value) || []) for (const st of itemsOf(vf.value) || []) if (st.key.h === 0xbc037de7) { analyzeNested(st.value, rotSt, true); }
            rotKV = rotKV || rotSt.rot;
          } else if (ins.key.h === 0xd1789c65) {
            const l = ins.value as unknown as BinList;
            if (l.t === T.List && l.items.length === 2 && l.items[0].t === T.Vec3 && l.items[1].t === T.Vec3 &&
                Math.trunc((l.items[0].v as number[])[1]) === 1 && Math.trunc((l.items[1].v as number[])[2]) === 1) axes = true;
          }
        }
        rotKV = rotSt.rot;
        if (!flagSt.keep && rotKV && axes) {
          const np = new BinPointer(FNV(0x3dbe415d));
          np.items.push(new BinField(FNV(0x0dba4cb3), BinF32(radius)));
          if (height !== 0) np.items.push(new BinField(FNV(0xd5bdbb42), BinF32(height)));
          if (flagSt.flags) np.items.push(new BinField(FNV(0x9c677a2c), BinU8(1)));
          shapeField.key = FNV(0x3bf0b4ed); shapeField.value = np as unknown as BinValue;
        } else {
          let simple: BinValue | null = null;
          if (shapeItems.length === 1 && shapeItems[0].key.h === 0xe5f268dd) {
            const inner = itemsOf(shapeItems[0].value);
            if (inner && inner.length > 0 && inner[0].value.t === T.Vec3) simple = inner[0].value;
          }
          if (simple) {
            const ne = new BinEmbed(FNV(0xee39916f));
            ne.items.push(new BinField(FNV(0xe5f268dd), BinVec3((simple.v as number[]).slice())));
            shapeField.value = ne as unknown as BinValue;
          } else if (shapeField.value.t === T.Embed || shapeField.value.t === T.Pointer) {
            (shapeField.value as unknown as BinEmbed).name = FNV(0x4f4e2ed7);
          }
        }
      }
    }
  }
}
class Target {
  binStrings: BinValue[] = []; binFiles: BinValue[] = []; original = ""; hashes: string[] = []; to = "out"; outStr = "";
  constructor(o: Partial<Target>) { Object.assign(this, o); }
}
export type FixResult = { files: Map<string, Uint8Array>; names: Map<string, string>; missing: string[]; missingLinked: string[]; hashTable: string[] };

export class Fixer {
  mod: ModSource; game: GameIndex | null; names: NameDB; logfn: LogFn;
  s: FixerSettings & { repath_path_path: string };
  out = new Map<string, Uint8Array>(); outNames = new Map<string, string>(); input = new Map<string, Uint8Array>();
  pf: PathFixer; conv: BinConverter; hashTable: string[] = []; missing: string[] = []; missingLinked: string[] = [];
  private _repathSet = false;
  constructor(ctx: { mod: ModSource; game: GameIndex | null; names: NameDB; log: LogFn }, settings: Partial<FixerSettings>) {
    this.mod = ctx.mod; this.game = ctx.game; this.names = ctx.names; this.logfn = ctx.log || (() => {});
    this.s = { ...FIXER_DEFAULTS, ...settings, repath_path_path: settings.repath_path_path ?? "" } as FixerSettings & { repath_path_path: string };
    this.pf = new PathFixer({ cls_assets: this.s.cls_assets, in_file_path: this.s.in_file_path, repath_path_path: this.s.repath_path_path });
    if (this.mod.looseNames?.length) this.names.addTemporary(this.mod.looseNames);
    this.conv = new BinConverter(); this.conv.loadRules(RULES);
  }
  log(m: string, k = "info") { this.logfn(m, k); }
  put(map: Map<string, Uint8Array>, path: string, data: Uint8Array) { const k = lc(path); this.outNames.set(k, path); map.set(k, data); }
  async readFrom(src: ModSource | GameIndex | null, hash: bigint): Promise<Uint8Array | null> { return src && src.has(hash) ? src.read(hash) : null; }
  async loadBinBytes(path: string): Promise<Uint8Array | null> { const h = hashPath(path); return (await this.readFrom(this.mod, h)) || (await this.readFrom(this.game, h)); }
  async checkLinked(paths: string[]): Promise<string[] | null> {
    const missing: string[] = []; const tg: { path: string; hshs: string[] }[] = [];
    for (const path of paths) {
      const hshs = [path]; const count = (path.match(/\//g) || []).length;
      if (count === 1 && path.includes("_")) { const fname = path.split("/")[1]; const parts = splitN(fname, "_", 2); hshs.push(`DATA/Characters/${fname.split("_")[0]}/${parts[0]}_Multi_${parts[1]}`); }
      else if (count === 3 && lc(path).includes("_multi_")) { const fname = path.slice(path.lastIndexOf("/") + 1); const parts = splitN(fname, "_", 3); if (parts.length >= 3) hshs.push(`DATA/${parts[0]}_${parts[2]}`); }
      tg.push({ path, hshs });
    }
    for (const t of tg) {
      let bytes: Uint8Array | null = null;
      for (const p of t.hshs) { bytes = await this.loadBinBytes(p); if (bytes) { this.input.set(lc(t.path), bytes); break; } }
      if (!bytes && this.names.hasBigList) { const cand = [{ original: t.path, hashes: [] as string[] }]; this.names.findMatches(cand, false, 100); for (const p of cand[0].hashes) { bytes = await this.loadBinBytes(p); if (bytes) { this.input.set(lc(t.path), bytes); break; } } }
      if (!bytes) missing.push(t.path);
    }
    return missing.length ? missing : null;
  }
  loadBin(path: string) { const b = this.input.get(lc(path)); return b ? readBin(b) : null; }
  static variants(s: string): string[] {
    const hs = [s]; const l = lc(s);
    if (l.endsWith(".tex")) hs.push(s.slice(0, -4) + ".dds"); else if (l.endsWith(".dds")) hs.push(s.slice(0, -4) + ".tex");
    else if (l.endsWith(".sco")) hs.push(s.slice(0, -4) + ".scb"); else if (l.endsWith(".scb")) hs.push(s.slice(0, -4) + ".sco");
    if (l === "assets/characters/taliyah/skins/base/taliyah_base_tx_cm.dds") hs.push("assets/characters/taliyah/skins/base/taliyah_base_tx_cm.tex");
    return hs;
  }
  findExisting(targets: Target[], s: string) {
    const l = lc(s); const ext = lc(extOf(s)); const stem = s.slice(0, s.length - ext.length);
    return targets.find(t => { const to = lc(t.original); if (to === l) return true; if (ext === ".dds" || ext === ".tex") return to === lc(stem + (ext === ".dds" ? ".tex" : ".dds")); if (ext === ".sco") return to === lc(stem + ".scb"); return false; });
  }
  scan(value: BinValue, targets: Target[], files: { node: BinValue; hash: bigint }[]) {
    switch (value.t) {
      case T.String: { const s = value.v as string; if (!s.trim() || !s.includes(".") || !s.includes("/")) return; const f = this.findExisting(targets, s); if (f) f.binStrings.push(value); else targets.push(new Target({ binStrings: [value], original: s, hashes: Fixer.variants(s), outStr: this.s.binless ? s : this.pf.fixPath(s) })); break; }
      case T.File: { const fv = value.v as XxhRef; if (fv.h !== 0n) files.push({ node: value, hash: fv.h }); break; }
      case T.Embed: case T.Pointer: for (const f of (value as unknown as BinEmbed).items) this.scan(f.value, targets, files); break;
      case T.List: case T.List2: case T.Option: for (const it of (value as unknown as BinList).items) this.scan(it, targets, files); break;
      case T.Map: for (const { k, v } of (value as unknown as BinMap).items) { this.scan(k, targets, files); this.scan(v, targets, files); } break;
    }
  }
  mergeFiles(targets: Target[], files: { node: BinValue; hash: bigint }[]) {
    const byHash = new Map<bigint, { hash: bigint; nodes: BinValue[] }>();
    for (const f of files) { const a = byHash.get(f.hash); if (a) a.nodes.push(f.node); else byHash.set(f.hash, { hash: f.hash, nodes: [f.node] }); }
    for (const { hash, nodes } of byHash.values()) {
      const path = this.names.resolve(hash);
      if (path) { const ex = this.findExisting(targets, path); if (ex) ex.binFiles.push(...nodes); else targets.push(new Target({ binFiles: nodes, original: path, hashes: Fixer.variants(path), outStr: this.s.binless ? path : this.pf.fixPath(path) })); }
      else { const hx = hex16(hash); const ex = targets.find(t => lc(t.original) === hx); if (ex) ex.binFiles.push(...nodes); else targets.push(new Target({ binFiles: nodes, original: hx, hashes: [hx], outStr: hx })); }
    }
  }
  apply(t: Target, finalOut: string) {
    for (const s of t.binStrings) s.v = finalOut;
    for (const f of t.binFiles) { const fv = f.v as XxhRef; fv.h = XXH(hashPath(finalOut), finalOut).h; }
  }
  async extractAndSwap(src: ModSource | GameIndex | null, targets: Target[], tag: string): Promise<Target[]> {
    if (!src || !targets.length) return targets; const remaining: Target[] = [];
    for (const t of targets) {
      let hit: { h: string; hh: bigint } | null = null;
      for (const h of t.hashes) { const hh = hashPath(h); if (src.has(hh)) { hit = { h, hh }; break; } }
      if (!hit) { remaining.push(t); continue; }
      const data = await src.read(hit.hh); if (!data) { remaining.push(t); continue; }
      let fin = t.outStr; const ext = extOf(hit.h);
      if (ext && !this.s.binless && lc(extOf(fin)) !== lc(ext) && lc(ext) !== ".sco") fin = fin.slice(0, fin.length - extOf(fin).length) + ext;
      if (t.to === "out") this.put(this.out, fin, data); else if (t.to === "input") this.put(this.input, fin, data);
      this.apply(t, fin); this.log(`[${tag}] ${t.original}`, "good");
    }
    return remaining;
  }
  async findAndSwap(src: ModSource | GameIndex | null, targets: Target[], tag: string): Promise<Target[]> {
    if (!src || !targets.length) return targets; const remaining: Target[] = [];
    for (const t of targets) {
      const found = t.hashes.find(h => src.has(hashPath(h)));
      if (!found) { remaining.push(t); continue; }
      for (const s of t.binStrings) s.v = found;
      for (const f of t.binFiles) { const fv = f.v as XxhRef; fv.h = XXH(hashPath(found)).h; }
      this.log(`[${tag}] ${found}`, "good");
    }
    return remaining;
  }
  async process(targets: Target[]) {
    const s = this.s; let processing = targets; const toCheckup: Target[] = []; const missingFinal: Target[] = [];
    const take = (pred: (t: Target) => boolean) => { const a = processing.filter(pred); processing = processing.filter(t => !pred(t)); return a; };
    if (!s.sfxEvents) toCheckup.push(...take(t => lc(t.original).endsWith("_sfx_events.bnk")));
    if (!s.binless) {
      processing = await this.extractAndSwap(this.mod, processing, "MOD");
      toCheckup.push(...take(t => /\.(wpk|bnk|anm)$/i.test(t.original)));
      if (s.smallMod) processing = await this.findAndSwap(this.game, processing, "GAME");
      else processing = await this.extractAndSwap(this.game, processing, "GAME-COPY");
    } else processing = await this.extractAndSwap(this.mod, processing, "MOD");
    if (processing.length) {
      this.names.findMatches(processing, true);
      missingFinal.push(...processing.filter(t => !t.hashes.length)); processing = processing.filter(t => t.hashes.length);
      processing = await this.extractAndSwap(this.mod, processing, "MOD*");
      if (!s.binless) { if (s.smallMod) processing = await this.findAndSwap(this.game, processing, "GAME*"); else processing = await this.extractAndSwap(this.game, processing, "GAME-COPY*"); }
    }
    missingFinal.push(...processing);
    let checkup = toCheckup;
    if (checkup.length) {
      checkup = await this.findAndSwap(this.game, checkup, "CHECK");
      if (checkup.length) { this.names.findMatches(checkup, true); missingFinal.push(...checkup.filter(t => !t.hashes.length)); checkup = checkup.filter(t => t.hashes.length); checkup = await this.findAndSwap(this.game, checkup, "CHECK*"); }
      missingFinal.push(...checkup);
    }
    for (const t of missingFinal) { this.missing.push(t.original); this.log(`[MISSING] ${t.original}`, "warn"); }
  }
  async repathIcons(charBinPath: string) {
    if (await this.checkLinked([charBinPath])) return;
    const bin = this.loadBin(charBinPath); if (!bin) return;
    const entries = bin.sections.get("entries") as unknown as BinMap | undefined; if (!entries) return;
    const targets: Target[] = []; const files: { node: BinValue; hash: bigint }[] = [];
    for (const { k, v } of entries.items) if ((k.v as FnvRef).h !== 0) this.scan(v, targets, files);
    this.mergeFiles(targets, files);
    const icons = targets.filter(t => lc(t.original).includes("icons2d"));
    for (const t of icons) { t.outStr = t.original; t.binStrings = []; t.binFiles = []; t.to = "out"; }
    await this.extractAndSwap(this.mod, icons, "ICON");
  }
  async loadAllBins(rootBinPath: string, char: string, skinNo: number, hp: boolean, extraQueue: { char: string; skin: number; hp: boolean; main: boolean }[]) {
    const s = this.s;
    const D = () => new Map<number, { k: BinValue; v: BinValue }>();
    const dicts: Record<string, Map<number, { k: BinValue; v: BinValue }>> = { skin: D(), vfx: D(), cac: D(), rr: D(), gear: D(), smat: D(), anim: D(), game: D(), other: D() };
    const hn = (n: string) => fnv1a(n); const classMap: Record<number, string> = {};
    const cls: Record<string, string> = { SkinCharacterDataProperties: "skin", VfxSystemDefinitionData: "vfx", ContextualActionData: "cac", ResourceResolver: "rr", GearSkinUpgrade: "gear", StaticMaterialDef: "smat", AnimationGraphData: "anim" };
    for (const [n, k] of Object.entries(cls)) classMap[hn(n)] = k;
    for (const n of ["AbilityObject","CharacterRecord","SpellObject","RecSpellRankUpInfolist","ItemRecommendationContextList","JunglePathRecommendation","ItemRecommendationOverrideSet","StatStoneSet","StatStoneData"]) classMap[hn(n)] = "game";
    const loaded = new Set<string>(), loadedLinked = new Set([lc(rootBinPath)]);
    const queue = [rootBinPath]; const keptLinked: string[] = [], missingLinked: string[] = [];
    while (queue.length) {
      const path = queue.shift()!;
      if (loaded.has(lc(path))) continue; loaded.add(lc(path));
      this.log(`[READ] ${path.length > 100 ? "..." + path.slice(-99) : path}`, "act");
      let bin; try { bin = this.loadBin(path); } catch (e) { this.log(`[FAIL] ${path}: ${(e as Error).message}`, "bad"); this.missing.push(`[Read Error] ${path}`); continue; }
      if (!bin) continue;
      const toCheck: string[] = [];
      const linked = bin.sections.get("linked") as unknown as BinList | undefined;
      if (linked && linked.t === T.List) {
        for (const item of linked.items) {
          if (item.t !== T.String) continue;
          if (loadedLinked.has(lc(item.v as string))) continue; loadedLinked.add(lc(item.v as string));
          if (!shouldSkipFile(item.v as string)) { queue.push(item.v as string); toCheck.push(item.v as string); }
          else { this.log(`[SKIP] ${item.v}`, "warn"); if (s.keepIcons) await this.repathIcons(item.v as string); keptLinked.push(item.v as string); }
        }
      }
      if (toCheck.length) { const nf = await this.checkLinked(toCheck); if (nf) for (const l of nf) { missingLinked.push(l); this.missingLinked.push(l); } }
      const entries = bin.sections.get("entries") as unknown as BinMap | undefined;
      if (entries && entries.t === T.Map) { for (const kvp of entries.items) { const h = (kvp.v as unknown as BinEmbed).name.h; if (h === 0) continue; const d = dicts[classMap[h] || "other"]; if (!d.has(h)) d.set(h, kvp as unknown as { k: BinValue; v: BinValue }); } }
    }
    const C = char;
    if (dicts.skin.size > 1) validate(dicts.skin as unknown as Map<number, unknown>, [fnv1a(`Characters/${C}/Skins/Skin${skinNo}`)]);
    if (dicts.skin.size === 0) { this.log("[MISS] SkinCharacterDataProperties", "bad"); return null; }
    const main = [...dicts.skin.values()][0].v as unknown as BinEmbed;
    const skinKey = [...dicts.skin.values()][0].k;
    const props = val(main, 0x45ff5904);
    if (props && props.t === T.Embed) {
      const ov = val(props as unknown as BinEmbed, 0x24725910);
      if (ov && (ov.t === T.List || ov.t === T.List2)) {
        for (const item of (ov as unknown as BinList).items) {
          const fields = itemsOf(item); if (!fields) continue;
          for (const f of fields) {
            const v = f.value;
            if (v.t === T.String) { if ((v.v as string).includes("/")) { f.key = FNV(0x3c6468f4, "texture"); this.names.addTemporary([v.v as string]); this.hashTable.push(v.v as string); f.value = BinFile(XXH(hashPath(v.v as string), v.v as string)); } else f.key = FNV(0xaad7612c, "Submesh"); }
            else if (v.t === T.Hash) { f.key = FNV(0x3c6468f4, "texture"); f.value = BinFile(XXH(BigInt((v.v as FnvRef).h), (v.v as FnvRef).s)); }
            else if (v.t === T.File) f.key = FNV(0x3c6468f4, "texture");
          }
        }
      }
    }
    const cacName = val(main, 0xd8f64a0d)?.t === T.Link ? (val(main, 0xd8f64a0d)!.v as FnvRef).h : 0;
    const rrName = fnv1a(`Characters/${C}/Skins/Skin${skinNo}/Resources`);
    const rrLink = val(main, 0x62286e7e); const rrLinkRef = rrLink && rrLink.t === T.Link ? rrLink : null;
    if (rrLinkRef) (rrLinkRef.v as FnvRef).h = FNV(rrName).h;
    const gearUpgrades: number[] = []; let anmName = 0;
    const sub = val(main, 0x426d89a3);
    if (sub && sub.t === T.Embed) { const l = val(sub as unknown as BinEmbed, 0xf5fb07c7); if (l && l.t === T.Link) anmName = (l.v as FnvRef).h; }
    const matEmbed = val(main, 0x68f2b69c);
    if (matEmbed && matEmbed.t === T.Embed) { const ml = val(matEmbed as unknown as BinEmbed, 0xcb522723); if (ml && ml.t === T.List) for (const it of (ml as unknown as BinList).items) if (it.t === T.Link) gearUpgrades.push((it.v as FnvRef).h); }
    const extraChars: string[] = []; const tags = val(main, 0x660c8b4e);
    if (tags && tags.t === T.List) for (const it of (tags as unknown as BinList).items) if (it.t === T.String) extraChars.push(it.v as string);
    if (s.verifyHpBar && hp) {
      const tf = getF(main, 0x51c83af8);
      if (tf && tf.value.t === T.Embed) { const u8 = getF(tf.value as unknown as BinEmbed, 0x3fcb5693); if (u8 && u8.value.t === T.U8) { if ((u8.value.v as number) !== (s.healthbarStyle & 255)) u8.value.v = s.healthbarStyle & 255; } else (tf.value as unknown as BinEmbed).items.push(new BinField(FNV(0x3fcb5693), BinU8(s.healthbarStyle & 255))); }
      else { const ne = new BinEmbed(FNV(0x11b71b5e)); ne.items.push(new BinField(FNV(0x4d5ff2d7), BinString("Buffbone_Cstm_Healthbar"))); ne.items.push(new BinField(FNV(0x3fcb5693), BinU8(s.healthbarStyle & 255))); main.items.push(new BinField(FNV(0x51c83af8), ne as unknown as BinValue)); }
    }
    if (dicts.rr.size > 1) validate(dicts.rr as unknown as Map<number, unknown>, [rrName]);
    if (dicts.cac.size > 1) validate(dicts.cac as unknown as Map<number, unknown>, [cacName]);
    if (dicts.anim.size > 1) validate(dicts.anim as unknown as Map<number, unknown>, [anmName]);
    if (s.verifyHpBar) { if (!dicts.rr.size) this.log("[MISS] Resource Resolver", "bad"); if (!dicts.cac.size) this.log("[MISS] Contextual Action Data", "bad"); if (!dicts.anim.size) this.log("[MISS] Animations Definitions", "bad"); }
    validate(dicts.gear as unknown as Map<number, unknown>, gearUpgrades);
    const rrValues: number[] = [];
    if (dicts.rr.size) { const rrEntry = [...dicts.rr.values()][0].v as unknown as BinEmbed; const mf = val(rrEntry, 0xd2f58721); if (mf && mf.t === T.Map) for (const { v } of (mf as unknown as BinMap).items) if (v.t === T.Link && (v.v as FnvRef).h !== 0) rrValues.push((v.v as FnvRef).h); }
    for (const { v } of dicts.gear.values()) {
      if (v.t !== T.Embed) continue;
      const p1 = val(v as unknown as BinEmbed, 0x639b0013);
      if (p1 && p1.t === T.Pointer) { const p2 = val(p1 as unknown as BinEmbed, 0x5f8284a2); if (p2 && p2.t === T.Pointer) { const m = val(p2 as unknown as BinEmbed, 0xd2f58721); if (m && m.t === T.Map) for (const e of (m as unknown as BinMap).items) if (e.v.t === T.Link) rrValues.push((e.v.v as FnvRef).h); } }
    }
    validate(dicts.vfx as unknown as Map<number, unknown>, rrValues);
    for (const { v: m } of dicts.smat.values()) {
      if (m.t !== T.Embed) continue; const me = m as unknown as BinEmbed;
      const lf = me.items.find(f => f.key.h === 0x0a6f0eb5 || f.key.h === 0xf3d3de85);
      const list = lf && (lf.value.t === T.List || lf.value.t === T.List2) ? (lf.value as unknown as BinList).items : null;
      if (list) for (const li of list) {
        if (li.t !== T.Embed) continue;
        for (const f of (li as unknown as BinEmbed).items) {
          const fv = f.value;
          if (fv.t === T.String) { if ((fv.v as string).includes("/")) { f.key = FNV(0xf0a363e3, "TexturePath"); f.value = BinFile(XXH(hashPath(fv.v as string))); this.names.addTemporary([fv.v as string]); this.hashTable.push(fv.v as string); } else f.key = FNV(0xb311d4ef, "TextureName"); }
          else if (fv.t === T.File) f.key = FNV(0xf0a363e3, "TexturePath");
          else if (fv.t === T.Hash) { f.key = FNV(0xf0a363e3, "TexturePath"); f.value = BinFile(XXH(BigInt((fv.v as FnvRef).h), (fv.v as FnvRef).s)); }
        }
      }
    }
    fixShapes(dicts.vfx as unknown as Map<number, { v: BinValue }>);
    const mkMap = () => new BinMap(T.Hash, T.Embed);
    const finalMap = mkMap(), finalMap2 = mkMap(), finalMap3 = mkMap();
    const into = (m: BinMap, d: Map<number, { k: BinValue; v: BinValue }>) => { for (const kvp of d.values()) m.items.push(kvp); };
    into(finalMap, dicts.skin); into(finalMap, dicts.rr);
    into(finalMap2, dicts.gear); into(finalMap2, dicts.vfx); into(finalMap2, dicts.cac); into(finalMap2, dicts.anim); into(finalMap2, dicts.other);
    into(finalMap3, dicts.smat);
    if (s.apply1617 && s.convertBeforeCollect) {
      const tr = new ConvertedStringsTracker();
      for (const m of [finalMap, finalMap2, finalMap3]) this.conv.convertBinMap(m, tr);
      this.hashTable.push(...tr.gameFiles); this.names.addTemporary(tr.gameFiles);
      this.log(`[1617] ${tr.gameFiles.length} paths, ${tr.binEntries.length} bin names converted`, "act");
    }
    const targets: Target[] = []; const files: { node: BinValue; hash: bigint }[] = [];
    for (const d of ["skin","rr","gear","smat","vfx","cac","anim","other"]) for (const { v } of dicts[d].values()) this.scan(v, targets, files);
    this.mergeFiles(targets, files);
    for (const c of extraChars) {
      if (BLACKLIST_LUX.includes(lc(c)) && skinNo !== 7) continue;
      if (!BLACKLIST.includes(lc(c))) extraQueue.push({ char: c, skin: skinNo, hp: false, main: false });
    }
    return { entries: finalMap, concat: finalMap2, staticMat: finalMap3, targets, files, linked: [] as string[], keptLinked, missingLinked, refs: { skinKey, rrLink: rrLinkRef, rrKey: [...dicts.rr.values()][0]?.k } };
  }
  async run(): Promise<FixResult> {
    const s = this.s;
    if (!s.character) throw new Error("No character selected.");
    if (this.game?.ready) this.game.reorder(s.character);
    const queue: { char: string; skin: number; hp: boolean; main: boolean }[] = [];
    if (s.allSkins) {
      const found: number[] = [];
      for (let i = 0; i < 100; i++) if (this.mod.has(hashPath(`data/characters/${lc(s.character)}/skins/skin${i}.bin`))) found.push(i);
      if (!found.length) found.push(s.skinNo || 0);
      for (const n of found) queue.push({ char: s.character, skin: n, hp: true, main: true });
    } else queue.push({ char: s.character, skin: s.skinNo, hp: true, main: true });
    const seen = new Set<string>();
    while (queue.length) {
      const job = queue.shift()!; const key = lc(job.char) + ":" + job.skin;
      if (seen.has(key)) continue; seen.add(key);
      this.log(`=== ${job.char} skin${job.skin} ===`, "head");
      const ok = await this.fixSkin(job, queue);
      if (!ok && job.main) throw new Error("Skin bin not found; processing stopped.");
    }
    return { files: this.out, names: this.outNames, missing: this.missing, missingLinked: this.missingLinked, hashTable: [...new Set(this.hashTable)] };
  }
  async fixSkin(job: { char: string; skin: number; hp: boolean; main: boolean }, queue: { char: string; skin: number; hp: boolean; main: boolean }[]): Promise<boolean> {
    const s = this.s; const char = job.char, skinNo = job.skin;
    const binPath = `data/characters/${lc(char)}/skins/skin${skinNo}.bin`;
    const miss = await this.checkLinked([binPath]);
    if (miss) { this.log(`[FAIL] ${binPath} not found in mod or game`, "bad"); return false; }
    if (!this._repathSet) { this.s.repath_path_path = s.prefix || `@${char.slice(0, 4)}${skinNo}`; this._repathSet = true; this.pf.s = this.s; }
    const ld = await this.loadAllBins(binPath, char, skinNo, job.hp, queue);
    if (!ld) return false;
    const { entries, concat, staticMat, targets, linked, keptLinked, missingLinked, refs } = ld;
    if (s.apply1617 && !s.convertBeforeCollect) {
      const tracker = new ConvertedStringsTracker();
      for (const m of [entries, concat, staticMat]) this.conv.convertBinMap(m, tracker);
      this.hashTable.push(...tracker.gameFiles); this.names.addTemporary(tracker.gameFiles);
    }
    await this.process(targets);
    const caseKey = Object.keys(CHARACTER_CASES).find(k => k.toLowerCase() === char.toLowerCase());
    if (caseKey) for (const name of CHARACTER_CASES[caseKey]) queue.push({ char: name, skin: skinNo, hp: false, main: false });
    if (char.toLowerCase() === "lux" && skinNo === 7) for (const l of LUX_FORMS) queue.push({ char: l, skin: 7, hp: true, main: false });
    const concatPath = `data/${lc(char)}_skin${skinNo}_concat.bin`;
    const smPath = `data/${lc(char)}_skin${skinNo}_staticmat.bin`;
    this.put(this.out, concatPath, writeBin(makeBin([], concat)));
    linked.push(concatPath);
    if (staticMat.items.length && !s.killStaticMat) { this.put(this.out, smPath, writeBin(makeBin([], staticMat))); linked.push(smPath); }
    const linkedStrings = [...keptLinked, ...missingLinked, ...linked];
    this.put(this.out, binPath, writeBin(makeBin(linkedStrings, entries)));
    this.log(`[OK] ${binPath}`, "good");
    if (s.noskinni && skinNo === 0 && this.game?.ready && refs.skinKey) {
      const nums = this.game.skinNumbers(lc(char), `${char}.wad.client`).slice(1);
      for (const i of nums) {
        const nsh = fnv1a(`Characters/${char}/Skins/Skin${i}`);
        const rrn = `Characters/${char}/Skins/Skin${i}/Resources`;
        (refs.skinKey.v as FnvRef).h = FNV(nsh).h;
        if (refs.rrLink) (refs.rrLink.v as FnvRef).h = FNV(fnv1a(rrn)).h;
        if (refs.rrKey) (refs.rrKey.v as FnvRef).h = FNV(fnv1a(rrn)).h;
        this.put(this.out, `data/characters/${lc(char)}/skins/skin${i}.bin`, writeBin(makeBin(linkedStrings, entries)));
        this.log(`[NOSKIN] skin${i}`, "good");
      }
    }
    return true;
  }
}
