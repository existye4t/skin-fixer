import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { useI18n } from "@/lib/i18n";
import { useMotionSetting } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ID = "772232490445176842";

type Activity = {
  name?: string;
  type?: number;
  state?: string;
  details?: string;
  assets?: { large_image?: string; large_text?: string };
};

type Lanyard = {
  discord_user: { username: string; global_name: string | null; avatar: string | null; discriminator: string };
  discord_status: "online" | "idle" | "dnd" | "offline";
  activities: Activity[];
  listening_to_spotify: boolean;
  spotify: { song: string; artist: string; album_art_url: string } | null;
};

const DOT = { online: "bg-emerald-400", idle: "bg-amber-300", dnd: "bg-red-400", offline: "bg-neutral-500" };

export function DiscordProfile() {
  const profile = useDiscord();
  const dark = useTheme().theme === "dark";
  const { name, handle, avatar, status, statusLabel, game, spotify, t } = profile;

  return (
    <article
      className={cn(
        "glow w-full rounded-3xl border p-6 sm:p-8",
        dark ? "border-white/10 bg-black/45" : "border-black/10 bg-white/70",
      )}
    >
      <div className="flex items-center gap-5">
        <span className="relative shrink-0">
          {avatar ? (
            <img src={avatar} alt="" className="h-20 w-20 rounded-3xl object-cover" />
          ) : (
            <span className={cn("block h-20 w-20 rounded-3xl", dark ? "bg-white/10" : "bg-black/5")} />
          )}
          <span className={cn("absolute -right-1 -bottom-1 h-4 w-4 rounded-full ring-4", DOT[status], dark ? "ring-black" : "ring-white")} />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.discord}</p>
          <h3 className="mt-1 truncate text-2xl font-light tracking-tight">{name}</h3>
          <p className={cn("truncate text-sm", dark ? "text-neutral-400" : "text-neutral-500")}>
            {handle} · {statusLabel}
          </p>
        </div>
      </div>
      {game && (
        <p className={cn("mt-6 text-sm", dark ? "text-neutral-300" : "text-neutral-700")}>
          <span className="text-neutral-500">{t.playing}</span> {game.name}
          {game.details ? ` — ${game.details}` : ""}
        </p>
      )}
      {spotify && (
        <div className={cn("mt-4 flex items-center gap-4 rounded-2xl border p-3", dark ? "border-white/10" : "border-black/10")}>
          <img src={spotify.album_art_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t.listening}</p>
            <p className="truncate">{spotify.song}</p>
            <p className="truncate text-sm text-neutral-500">{spotify.artist}</p>
          </div>
        </div>
      )}
    </article>
  );
}

function useDiscord() {
  const { t } = useI18n();
  const [data, setData] = useState<Lanyard | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${ID}`);
        const json = (await response.json()) as { data?: Lanyard };
        if (!stop && json.data) setData(json.data);
      } catch {
        if (!stop) setData(null);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, []);

  const status = data?.discord_status ?? "offline";
  return {
    t,
    status,
    statusLabel: { online: t.online, idle: t.idle, dnd: t.dnd, offline: t.offline }[status],
    name: data?.discord_user.global_name || data?.discord_user.username || "Discord",
    handle: data?.discord_user.username ? `@${data.discord_user.username}` : "—",
    avatar: data?.discord_user.avatar
      ? `https://cdn.discordapp.com/avatars/${ID}/${data.discord_user.avatar}.png?size=256`
      : null,
    game: data?.activities.find((activity) => activity.type === 0),
    spotify: data?.listening_to_spotify ? data.spotify : null,
  };
}

export function DiscordCard() {
  const { t } = useI18n();
  const dark = useTheme().theme === "dark";
  const { reduced } = useMotionSetting();
  const [open, setOpen] = useState(false);
  const profile = useDiscord();
  const { status, statusLabel, name, handle, avatar, game, spotify } = profile;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm",
          dark ? "border-white/15 bg-white/5 hover:bg-white/10" : "border-black/10 bg-white/70 hover:bg-white",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status])} />
        {t.discord}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button type="button" className="absolute inset-0 bg-black/50" aria-label={t.close} onClick={() => setOpen(false)} />
            <motion.article
              role="dialog"
              initial={{ y: 16, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 10, opacity: 0, scale: 0.97 }}
              transition={reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 300, damping: 28, opacity: { duration: 0.15 } }
              }
              className={cn(
                "relative w-full max-w-sm overflow-hidden rounded-3xl border p-5 shadow-2xl",
                dark ? "border-white/10 bg-[#0b0b0b] text-white" : "border-black/10 bg-[#f7f8fb] text-[#12141a]",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="relative">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  ) : (
                    <span className={cn("block h-14 w-14 rounded-2xl", dark ? "bg-white/10" : "bg-black/5")} />
                  )}
                  <span className={cn("absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full ring-2", DOT[status], dark ? "ring-[#0b0b0b]" : "ring-[#f7f8fb]")} />
                </span>
                <div>
                  <h2 className="text-lg font-light tracking-tight">{name}</h2>
                  <p className={cn("text-sm", dark ? "text-neutral-400" : "text-neutral-500")}>
                    {handle} · {statusLabel}
                  </p>
                </div>
              </div>
              {game && (
                <p className={cn("mt-5 text-sm", dark ? "text-neutral-300" : "text-neutral-700")}>
                  <span className="text-neutral-500">{t.playing}</span> {game.name}
                  {game.details ? ` — ${game.details}` : ""}
                </p>
              )}
              {spotify && (
                <div className={cn("mt-4 flex items-center gap-3 rounded-2xl border p-3", dark ? "border-white/10" : "border-black/10")}>
                  <img src={spotify.album_art_url} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{t.listening}</p>
                    <p className="truncate text-sm">{spotify.song}</p>
                    <p className="truncate text-xs text-neutral-500">{spotify.artist}</p>
                  </div>
                </div>
              )}
              <button type="button" onClick={() => setOpen(false)} className="mt-5 text-sm text-neutral-500 hover:text-current">
                {t.close}
              </button>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
