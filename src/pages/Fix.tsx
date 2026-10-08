import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Download, FileUp } from "lucide-react";
import { Link } from "react-router-dom";

import { DiscordCard } from "@/components/DiscordCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { SettingsButton } from "@/components/SettingsButton";
import { SourceLink } from "@/components/SourceLink";
import { OptionRow, Segmented } from "@/components/OptionRow";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import TopoField from "@/components/ui/topo-field";
import { fixSkin, inspectSkin } from "@/lib/fixer/pipeline";
import { DEFAULT_OPTIONS, type FixerOptions, type FixReport, type ImportReport, type LogLine } from "@/lib/fixer/types";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const TONES = {
  act: "text-sky-500",
  warn: "text-amber-500",
  good: "text-emerald-500",
  err: "text-red-500",
  mod: "text-violet-400",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Fix() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const dark = theme === "dark";
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [options, setOptions] = useState<FixerOptions>(DEFAULT_OPTIONS);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FixReport | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  const [pageKey, setPageKey] = useState(0);

  function resetPage() {
    setFile(null);
    setReport(null);
    setLogs([]);
    setBusy(false);
    setResult(null);
    setBlob(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    setPageKey((key) => key + 1);
  }

  async function onFile(next: File | null) {
    setResult(null);
    setBlob(null);
    setLogs([]);
    setError("");
    setFile(next);
    if (!next) return setReport(null);
    try {
      const inspected = await inspectSkin(next);
      setReport(inspected);
      setOptions((current) => ({ ...current, skinNo: inspected.skinNumbers[0] ?? 0 }));
    } catch {
      setReport(null);
      setError(t.badFile);
    }
  }

  async function run() {
    if (!file || !report) return;
    setBusy(true);
    setResult(null);
    setBlob(null);
    setLogs([]);
    try {
      const fixed = await fixSkin(file, report, options, (line) =>
        setLogs((current) => [...current, { ...line, id: current.length + 1 }]),
      );
      setBlob(fixed.blob);
      setResult(fixed.result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.badFile);
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!blob || !result) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.outputName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const panel = cn("rounded-3xl border backdrop-blur-xl", dark ? "border-white/10 bg-black/55" : "border-black/10 bg-white/75");
  const field = cn("w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none", dark ? "border-white/15" : "border-black/10");
  const facts = report
    ? [
        [t.champion, report.character ?? t.unknown],
        [t.kind, report.kind],
        [t.entries, String(report.entries.length)],
        [t.size, formatBytes(report.bytes)],
        [t.bins, String(report.bins.length)],
        [t.skins, report.skinNumbers.join(", ") || "—"],
      ]
    : [];

  return (
    <div className={cn("relative", dark ? "text-white" : "text-[#12141a]")}>
      <TopoField mode={theme} className="pointer-events-none fixed inset-0 opacity-60" density={0.7} />
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-6">
        <header className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm">
            <ArrowLeft size={15} /> {t.back}
          </Link>
          <div className="flex items-center gap-2">
            <SourceLink />
            <DiscordCard />
            <SettingsButton />
            <LanguageSwitch />
            <AnimatedThemeToggle />
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <motion.section key={pageKey} layout className={cn(panel, "p-6 sm:p-8")}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.importKicker}</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight">{t.dropTitle}</h1>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void onFile(event.dataTransfer.files[0] ?? null);
              }}
              className={cn(
                "mt-6 flex w-full flex-col items-center rounded-2xl border border-dashed px-6 py-16 transition-colors",
                dark ? "border-white/15 hover:bg-white/5" : "border-black/15 hover:bg-black/[0.03]",
              )}
            >
              <FileUp size={20} strokeWidth={1.5} />
              <span className="mt-3 text-sm">{file?.name ?? t.dropIdle}</span>
              <span className="mt-1 text-xs text-neutral-500">{t.dropHint}</span>
            </button>
            <input ref={inputRef} hidden type="file" accept=".zip,.fantome" onChange={(event) => void onFile(event.target.files?.[0] ?? null)} />
            {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

            <AnimatePresence>
              {report && (
                <motion.dl initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {facts.map(([label, value]) => (
                    <div key={label} className={cn("rounded-2xl border px-3 py-3", dark ? "border-white/10" : "border-black/10")}>
                      <dt className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">{label}</dt>
                      <dd className="mt-1 truncate font-light">{value}</dd>
                    </div>
                  ))}
                </motion.dl>
              )}
            </AnimatePresence>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={!report || busy}
                onClick={() => void run()}
                className={cn("glow rounded-full px-5 py-2.5 text-sm disabled:opacity-40", dark ? "bg-white text-black" : "bg-[#12141a] text-white")}
              >
                {busy ? t.fixing : t.fix}
              </button>
              {blob && (
                <button type="button" onClick={download} className="glow inline-flex items-center gap-2 rounded-full border border-current/15 px-5 py-2.5 text-sm">
                  <Download size={15} /> {t.download}
                </button>
              )}
              {(file || result) && (
                <button type="button" onClick={resetPage} className="rounded-full px-5 py-2.5 text-sm text-neutral-500 hover:text-current">
                  {t.resetPage}
                </button>
              )}
            </div>
            {logs.length > 0 && (
              <ol className={cn("mt-6 max-h-64 overflow-auto rounded-2xl border p-4 font-mono text-xs leading-6", dark ? "border-white/10" : "border-black/10")}>
                {logs.map((line) => (
                  <li key={line.id} className={TONES[line.tone]}>{line.text}</li>
                ))}
              </ol>
            )}
            {result && (
              <p className="mt-4 text-sm text-neutral-500">
                {result.kept} {t.kept} · {result.dropped} {t.dropped} · {result.repaths} {t.repaths}
                {result.missing.length ? ` · ${t.missing} ${result.missing.join(", ")}` : ""}
              </p>
            )}
          </motion.section>

          <aside className={cn(panel, "p-5")}>
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.pass}</p>
              <button
                type="button"
                onClick={() => setOptions({ ...DEFAULT_OPTIONS, skinNo: report?.skinNumbers[0] ?? 0 })}
                className="text-xs text-neutral-500 hover:text-current"
              >
                {t.reset}
              </button>
            </div>
            <label className="mt-4 block text-sm">
              <span className="text-neutral-500">{t.skinNo}</span>
              <input className={cn(field, "mt-1.5")} type="number" min={0} value={options.skinNo} onChange={(event) => setOptions({ ...options, skinNo: Number(event.target.value) })} />
            </label>
            <label className="mt-3 block text-sm">
              <span className="text-neutral-500">{t.affix}</span>
              <input className={cn(field, "mt-1.5")} value={options.affix} placeholder={t.affixHint} onChange={(event) => setOptions({ ...options, affix: event.target.value })} />
            </label>
            <div className={cn("mt-3 divide-y", dark ? "divide-white/10" : "divide-black/8")}>
              {(
                [
                  ["allAvailable", t.allAvailable],
                  ["binless", t.binless],
                  ["noSkin", t.noSkin],
                  ["keepIcons", t.keepIcons],
                  ["keepSfx", t.keepSfx],
                  ["killStatic", t.killStatic],
                  ["keepUi", t.keepUi],
                  ["smallMod", t.smallMod],
                  ["repathInFile", t.repathInFile],
                ] as const
              ).map(([key, label]) => (
                <OptionRow key={key} label={label} checked={options[key]} onLabel={t.on} offLabel={t.off} onChange={(checked) => setOptions({ ...options, [key]: checked })} />
              ))}
            </div>
            <Segmented
              label={t.sound}
              value={options.sound}
              options={[{ value: "auto", label: t.auto }, { value: "include", label: t.include }, { value: "exclude", label: t.exclude }]}
              onChange={(sound) => setOptions({ ...options, sound })}
            />
            <Segmented
              label={t.animation}
              value={options.animation}
              options={[{ value: "auto", label: t.auto }, { value: "include", label: t.include }, { value: "exclude", label: t.exclude }]}
              onChange={(animation) => setOptions({ ...options, animation })}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
