import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Download, FileUp, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { DiscordCard } from "@/components/DiscordCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { SettingsButton } from "@/components/SettingsButton";
import { SourceLink } from "@/components/SourceLink";
import { OptionRow, Segmented } from "@/components/OptionRow";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import { Button } from "@/components/ui/button";
import { SpotlightPanel } from "@/components/ui/spotlight";
import TopoField from "@/components/ui/topo-field";
import { fixSkin, inspectSkin, isNamesCached, loadGameDir, loadGameFileList, loadHashNames } from "@/lib/fixer/pipeline";
import type { FixerOptions, FixReport, GameIndexState, ImportReport, LogLine } from "@/lib/fixer/types";
import { DEFAULT_OPTIONS } from "@/lib/fixer/types";
import { getSetting, useSettings } from "@/lib/settings";
import { saveGameDirHandle, loadGameDirHandle } from "@/lib/game-dir-store";

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
  }
}
import { useI18n } from "@/lib/i18n";
import { useMotionSetting } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];
const staggerContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const staggerItem = { hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } } };
const staggerItemFast = { hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE } } };

const TONES: Record<string, string> = {
  act: "text-sky-500", warn: "text-amber-500", good: "text-emerald-500",
  err: "text-red-500", mod: "text-violet-400", head: "font-bold text-white",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Fix() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { reduced } = useMotionSetting();
  const dark = theme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const gameFolderRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [options, setOptions] = useState<FixerOptions>(DEFAULT_OPTIONS);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FixReport | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [pageKey, setPageKey] = useState(0);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [gameState, setGameState] = useState<GameIndexState>({ status: "idle", wadCount: 0, fileCount: 0, message: "" });
    const [namesStatus, setNamesStatus] = useState("");
    const [namesLoading, setNamesLoading] = useState(false);
    const { settings, setSetting } = useSettings();
    const rememberFolder = settings.rememberGameFolder;

  // On mount: auto-load cached names + restore game dir handle
  useEffect(() => {
    // Names: if already cached, load silently
    isNamesCached().then(cached => {
      if (!cached) return;
      setNamesStatus(t.namesCached);
      loadHashNames(msg => setNamesStatus(msg)).catch(() => {});
    });

    // Game dir: if rememberGameFolder is on, try to restore handle
    if (!getSetting("rememberGameFolder")) return;
    loadGameDirHandle().then(async handle => {
      if (!handle) return;
      try {
        const perm = await (handle as FileSystemDirectoryHandle & { queryPermission: (o: { mode: string }) => Promise<string> }).queryPermission({ mode: "read" });
        if (perm !== "granted") {
          const req = await (handle as FileSystemDirectoryHandle & { requestPermission: (o: { mode: string }) => Promise<string> }).requestPermission({ mode: "read" });
          if (req !== "granted") return;
        }
        setGameState({ status: "loading", wadCount: 0, fileCount: 0, message: t.readingWads });
        const g = await loadGameDir(handle, (i, n) => setGameState(s => ({ ...s, message: `${t.readingWads} ${i}/${n}` })));
        setGameState({ status: g.ready ? "ready" : "error", wadCount: g.wads.length, fileCount: g.map.size, message: g.ready ? `${g.wads.length} ${t.wadsDone} · ${g.map.size.toLocaleString()}` : t.noWadFound });
        setOptions(cur => ({ ...cur, useGameIndex: g.ready }));
      } catch { /* silently skip if permission denied */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetPage() {
    setFile(null); setReport(null); setLogs([]); setBusy(false);
    setResult(null); setBlob(null); setError(""); setDone(false);
    if (inputRef.current) inputRef.current.value = "";
    setPageKey(k => k + 1);
  }

  async function onFile(next: File | null) {
    setResult(null); setBlob(null); setLogs([]); setError(""); setFile(next);
    if (!next) return setReport(null);
    try {
      const inspected = await inspectSkin(next);
      setReport(inspected);
      setOptions(cur => ({
        ...cur,
        skinNo: inspected.skinNumbers[0] ?? 0,
      }));
    } catch {
      setReport(null); setError(t.badFile);
    }
  }

  const loadGame = useCallback(async () => {
      if (!window.showDirectoryPicker) {
        gameFolderRef.current?.click();
        return;
      }
      setGameState({ status: "loading", wadCount: 0, fileCount: 0, message: t.readingWads });
      try {
        const h = await window.showDirectoryPicker!({ mode: "read" });
        const g = await loadGameDir(h, (i, n) => setGameState(s => ({ ...s, message: `${t.readingWads} ${i}/${n}` })));
                setGameState({ status: g.ready ? "ready" : "error", wadCount: g.wads.length, fileCount: g.map.size, message: g.ready ? `${g.wads.length} ${t.wadsDone} · ${g.map.size.toLocaleString()}` : t.noWadFound });
                setOptions(cur => ({ ...cur, useGameIndex: g.ready }));
                if (g.ready && getSetting("rememberGameFolder")) saveGameDirHandle(h).catch(() => {});
      } catch (e: unknown) {
        if ((e as Error).name !== "AbortError") setGameState({ status: "error", wadCount: 0, fileCount: 0, message: (e as Error).message });
        else setGameState({ status: "idle", wadCount: 0, fileCount: 0, message: "" });
      }
    }, [t]);

  async function onGameFileList(list: FileList) {
    setGameState({ status: "loading", wadCount: 0, fileCount: 0, message: t.readingWads });
        try {
          const g = await loadGameFileList(list, (i, n) => setGameState(s => ({ ...s, message: `${t.readingWads} ${i}/${n}` })));
          setGameState({ status: g.ready ? "ready" : "error", wadCount: g.wads.length, fileCount: g.map.size, message: g.ready ? `${g.wads.length} ${t.wadsDone} · ${g.map.size.toLocaleString()}` : t.noWadFound });
          setOptions(cur => ({ ...cur, useGameIndex: g.ready }));
        } catch (e) { setGameState({ status: "error", wadCount: 0, fileCount: 0, message: (e as Error).message }); }
  }

  async function loadNames() {
    setNamesLoading(true); setNamesStatus(t.namesDownloading);
        try {
          await loadHashNames(msg => setNamesStatus(msg));
        } catch (e) { setNamesStatus(`${t.namesFailed} ${(e as Error).message}`); }
    finally { setNamesLoading(false); }
  }

  async function run() {
    if (!file || !report) return;
    setBusy(true); setResult(null); setBlob(null); setLogs([]);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      const fixed = await fixSkin(file, report, options, line =>
        setLogs(cur => [...cur, { ...line, id: cur.length + 1 }])
      );
      setBlob(fixed.blob); setResult(fixed.result); setDone(true); chime();
      window.setTimeout(() => setDone(false), 2400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.badFile);
    } finally { setBusy(false); }
  }

  function download() {
    if (!blob || !result) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = result.outputName; a.click();
    URL.revokeObjectURL(url);
  }

  const panel = cn("rounded-3xl border backdrop-blur-xl", dark ? "border-white/10 bg-black/55" : "border-black/10 bg-white/75");
  const field = cn("w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none", dark ? "border-white/15" : "border-black/10");
  const facts = useMemo(
    () => report ? [
      [t.champion, report.character ?? t.unknown],
      [t.kind, report.kind],
      [t.entries, String(report.entries.length)],
      [t.size, formatBytes(report.bytes)],
      [t.bins, String(report.bins.length)],
      [t.skins, report.skinNumbers.join(", ") || "—"],
    ] : [],
    [report, t],
  );

  const gameStatusColor = gameState.status === "ready" ? "text-emerald-500" : gameState.status === "error" ? "text-red-500" : gameState.status === "loading" ? "text-sky-500" : "text-neutral-500";

  return (
    <div className={cn("relative min-h-screen", dark ? "bg-[#09090b] text-white" : "bg-paper text-[#12141a]")}>
      <TopoField mode={theme} className="pointer-events-none fixed inset-0 opacity-60" density={0.7} />
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={15} /> {t.back}
          </Link>
          <div className="flex items-center gap-2">
            <div className={cn("flex items-center overflow-hidden rounded-full border [&>*]:rounded-none [&>*]:border-0", dark ? "border-white/15" : "border-black/10")}>
              <SpotlightPanel dark={dark} radius={80} className="flex items-center">
                <SourceLink />
                <span className={cn("hidden sm:block w-px self-stretch", dark ? "bg-white/10" : "bg-black/10")} />
                <DiscordCard />
                <span className={cn("w-px self-stretch", dark ? "bg-white/10" : "bg-black/10")} />
                <SettingsButton />
                <span className={cn("w-px self-stretch", dark ? "bg-white/10" : "bg-black/10")} />
                <LanguageSwitch />
              </SpotlightPanel>
            </div>
            <AnimatedThemeToggle />
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <SpotlightPanel dark={dark} className={cn(panel, "overflow-hidden")}>
          <motion.section key={pageKey} layout className="p-6 sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.importKicker}</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight">{t.dropTitle}</h1>

            {/* Drop zone */}
            <motion.button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={e => { e.preventDefault(); setDragOver(false); }}
              onDrop={e => { e.preventDefault(); setDragOver(false); void onFile(e.dataTransfer.files[0] ?? null); }}
              animate={{ scale: dragOver ? 1.012 : 1, opacity: dragOver ? 1 : undefined }}
              transition={{ duration: 0.18, ease: EASE }}
              className={cn(
                "mt-6 flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-16 transition-colors",
                dark ? dragOver ? "border-white/40 bg-white/5" : "border-white/15 hover:bg-white/5"
                     : dragOver ? "border-black/25 bg-black/[0.03]" : "border-black/15 hover:bg-black/[0.03]",
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {file ? (
                  <motion.span key="check" initial={reduced ? false : { opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? {} : { opacity: 0, scale: 0.7 }} transition={{ duration: 0.2, ease: EASE }}>
                    <CheckCircle size={20} strokeWidth={1.5} />
                  </motion.span>
                ) : (
                  <motion.span key="upload" initial={reduced ? false : { opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? {} : { opacity: 0, scale: 0.7 }} transition={{ duration: 0.2, ease: EASE }}>
                    <FileUp size={20} strokeWidth={1.5} />
                  </motion.span>
                )}
              </AnimatePresence>
              <span className="mt-3 text-sm">{file?.name ?? t.dropIdle}</span>
              <span className="mt-1 text-xs text-neutral-500">{t.dropHint}</span>
            </motion.button>
            <input ref={inputRef} hidden type="file" accept=".zip,.fantome" onChange={e => void onFile(e.target.files?.[0] ?? null)} />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

            {/* Mod info facts */}
            <AnimatePresence>
              {report && (
                <motion.dl initial="hidden" animate="visible" variants={reduced ? {} : staggerContainer} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {facts.map(([label, value]) => (
                    <motion.div key={label} variants={reduced ? {} : staggerItem} className={cn("rounded-2xl border px-3 py-3", dark ? "border-white/10" : "border-black/10")}>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{label}</dt>
                      <dd className="mt-1 truncate font-light">{value}</dd>
                    </motion.div>
                  ))}
                </motion.dl>
              )}
            </AnimatePresence>

            {/* Game folder section */}
            <div className={cn("mt-6 rounded-2xl border px-4 py-4", dark ? "border-white/10" : "border-black/10")}>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.gameFolder}</p>
                            <p className={cn("mt-1 text-xs font-medium", dark ? "text-neutral-300" : "text-neutral-600")}>{t.gameFolderHint}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                            <Button variant="ghost" size="pill-sm" onClick={loadGame} className="gap-1.5 text-xs">
                                              <FolderOpen size={13} /> {t.selectFolder}
                                            </Button>
                                            <input ref={gameFolderRef} hidden type="file" {...({ webkitdirectory: "true", multiple: true } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={e => e.target.files && void onGameFileList(e.target.files)} />
                              {gameState.status !== "idle" && (
                                <span className={cn("text-xs", gameStatusColor)}>{gameState.message}</span>
                              )}
                            </div>
                            {gameState.status === "ready" && (
                                                          <div className="mt-2 flex items-center gap-2">
                                                            <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-500">
                                                              <input type="checkbox" checked={options.useGameIndex} onChange={e => setOptions(o => ({ ...o, useGameIndex: e.target.checked }))} />
                                                              {t.useGameIndex}
                                                            </label>
                                                          </div>
                                                        )}
                                                        <label className="mt-3 flex cursor-pointer items-center justify-between text-xs">
                                                          <span className={dark ? "text-neutral-400" : "text-neutral-500"}>{t.rememberGameFolder}</span>
                                                          <span className={cn(
                                                            "inline-flex h-5 w-9 items-center rounded-full transition-colors",
                                                            rememberFolder ? "bg-emerald-500" : dark ? "bg-white/15" : "bg-black/15",
                                                          )}>
                                                            <span className={cn(
                                                              "h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                                                              rememberFolder ? "translate-x-[18px]" : "translate-x-[3px]",
                                                            )} />
                                                          </span>
                                                          <input type="checkbox" className="sr-only" checked={rememberFolder} onChange={e => setSetting("rememberGameFolder", e.target.checked)} />
                                                        </label>
                                        </div>

            {/* Hash names section */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
                          <Button variant="ghost" size="pill-sm" onClick={loadNames} disabled={namesLoading} className="text-xs">
                            {t.loadNames}
                          </Button>
                          {namesStatus && <span className="text-xs text-neutral-500">{namesStatus}</span>}
                        </div>
                        <p className={cn("mt-1 text-xs font-medium", dark ? "text-neutral-300" : "text-neutral-600")}>{t.namesLoadOnce}</p>

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap gap-3">
              <motion.div whileTap={reduced ? {} : { scale: 0.96 }}>
                <Button variant={dark ? "default" : "paper"} size="pill-sm" disabled={!report || busy} onClick={() => void run()} className="glow">
                  {busy ? t.fixing : t.fix}
                </Button>
              </motion.div>
              {blob && (
                <Button variant="currentOutline" size="pill-sm" onClick={download} className="glow gap-2">
                  <Download size={15} /> {t.download}
                </Button>
              )}
              {(file || result) && (
                <Button variant="subtle" size="pill-sm" onClick={resetPage}>{t.resetPage}</Button>
              )}
            </div>

            {/* Log */}
            {logs.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-red-500">{logs.filter(l => l.tone === "err").length} {t.logErrors}</span>
                  <button type="button" className="text-neutral-500 hover:text-current" onClick={() => {
                    const codes = [...new Set(logs.flatMap(l => l.text.match(/bin type \d+/g) ?? []))];
                    void navigator.clipboard.writeText(`${logs.map(l => l.text).join("\n")}${codes.length ? `\n\n${codes.join(", ")}` : ""}`);
                    setCopied(true); window.setTimeout(() => setCopied(false), 1200);
                  }}>
                    {copied ? t.copied : t.copyLog}
                  </button>
                </div>
                <ol className={cn("max-h-64 overflow-auto rounded-2xl border p-4 font-mono text-xs leading-6", dark ? "border-white/10" : "border-black/10")}>
                  <AnimatePresence initial={false}>
                    {logs.map(line => (
                      <motion.li key={line.id} initial={reduced ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15, ease: "easeOut" }} className={TONES[line.tone]}>
                        {line.text}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ol>
              </div>
            )}

            {result && (
              <p className="mt-4 text-sm text-neutral-500">
                {result.kept} {t.kept} · {result.dropped} {t.dropped} · {result.repaths} {t.repaths}
                {result.missing.length ? ` · ${t.missing} ${result.missing.join(", ")}` : ""}
              </p>
            )}
          </motion.section>
          </SpotlightPanel>

          {/* Options sidebar */}
          <aside className={cn(panel, "overflow-hidden")}>
          <SpotlightPanel dark={dark} className="p-5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.pass}</p>
              <button type="button" onClick={() => setOptions({ ...DEFAULT_OPTIONS, skinNo: report?.skinNumbers[0] ?? 0 })} className="text-xs text-neutral-500 hover:text-current">
                {t.reset}
              </button>
            </div>
            <label className="mt-4 block text-sm">
              <span className="text-neutral-500">{t.skinNo}</span>
              <input className={cn(field, "mt-1.5")} type="number" min={0} value={options.skinNo} onChange={e => setOptions({ ...options, skinNo: Number(e.target.value) })} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-neutral-500">{t.affix}</span>
              <input className={cn(field, "mt-1.5")} value={options.affix} placeholder={t.affixHint} onChange={e => setOptions({ ...options, affix: e.target.value })} />
            </label>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.optionsContent}</p>
            <motion.div initial="hidden" animate="visible" variants={reduced ? {} : { ...staggerContainer, visible: { transition: { staggerChildren: 0.03 } } }} className={cn("mt-2 divide-y", dark ? "divide-white/10" : "divide-black/8")}>
              {([
                ["allAvailable", t.allAvailable],
                ["binless", t.binless],
                ["noSkin", t.noSkin],
                ["keepIcons", t.keepIcons],
                ["keepSfx", t.keepSfx],
                ["killStatic", t.killStatic],
                ["keepUi", t.keepUi],
                ["smallMod", t.smallMod],
                ["repathInFile", t.repathInFile],
                ["apply1617", t.apply1617],
                                ["convertBeforeCollect", t.convertBeforeCollect],
              ] as const).map(([key, label]) => (
                <motion.div key={key} variants={reduced ? {} : staggerItemFast}>
                  <OptionRow label={label} checked={options[key]} onLabel={t.on} offLabel={t.off} onChange={checked => setOptions({ ...options, [key]: checked })} />
                </motion.div>
              ))}
            </motion.div>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.optionsAudio}</p>
            <div className="mt-2">
              <Segmented label={t.sound} value={options.sound} options={[{ value: "auto", label: t.auto }, { value: "include", label: t.include }, { value: "exclude", label: t.exclude }]} onChange={sound => setOptions({ ...options, sound })} />
              <Segmented label={t.animation} value={options.animation} options={[{ value: "auto", label: t.auto }, { value: "include", label: t.include }, { value: "exclude", label: t.exclude }]} onChange={animation => setOptions({ ...options, animation })} />
            </div>
          </SpotlightPanel>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}
            className={cn("fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur-xl",
              dark ? "border-emerald-400/30 bg-black/75 text-white" : "border-emerald-500/25 bg-white/85 text-[#12141a]")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <motion.path d="M2.5 7L5.5 10L11.5 4" stroke="rgb(52 211 153)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                transition={reduced ? { duration: 0 } : { pathLength: { duration: 0.35, delay: 0.05, ease: "easeOut" }, opacity: { duration: 0.1 } }} />
            </svg>
            {t.done}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function chime() {
  const audio = new AudioContext(); const now = audio.currentTime;
  const master = audio.createGain(); master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
  master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  master.connect(audio.destination);
  [523.25, 783.99].forEach((frequency, index) => {
    const tone = audio.createOscillator(); tone.type = "sine"; tone.frequency.value = frequency;
    tone.connect(master); tone.start(now + index * 0.06); tone.stop(now + 0.44);
  });
  window.setTimeout(() => void audio.close(), 700);
}
