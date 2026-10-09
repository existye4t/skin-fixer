import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Link } from "react-router-dom";

import { DiscordCard, DiscordProfile } from "@/components/DiscordCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { SettingsButton } from "@/components/SettingsButton";
import { SourceLink } from "@/components/SourceLink";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import TopoField from "@/components/ui/topo-field";
import { Button } from "@/components/ui/button";
import { MagneticWrapper } from "@/components/ui/magnetic-button";
import { useI18n } from "@/lib/i18n";
import { useMotionSetting } from "@/lib/motion";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function Home() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const { reduced } = useMotionSetting();
  const dark = theme === "dark";
  const steps = [
    ["01", t.step1t, t.step1b],
    ["02", t.step2t, t.step2b],
    ["03", t.step3t, t.step3b],
  ];

  return (
    <div className={cn("relative min-h-screen overflow-hidden", dark ? "text-white" : "text-[#12141a]")}>
      <TopoField mode={theme} className="pointer-events-none fixed inset-0" density={0.9} />
      <div
        className={cn(
          "pointer-events-none fixed inset-0",
          dark
            ? "bg-[radial-gradient(circle_at_center,transparent_0%,#000_78%)]"
            : "bg-[radial-gradient(circle_at_center,transparent_0%,#eef1f6_78%)]",
        )}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        <header className="flex items-center justify-between py-6">
          <span className="text-sm tracking-tight">{t.brand}</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className={cn(
                "flex items-center overflow-hidden rounded-full border [&>*]:rounded-none [&>*]:border-0",
                dark ? "border-white/15" : "border-black/10",
              )}
            >
              <SourceLink />
              <span className={cn("hidden sm:block w-px self-stretch", dark ? "bg-white/10" : "bg-black/10")} />
              <DiscordCard />
              <span className={cn("w-px self-stretch", dark ? "bg-white/10" : "bg-black/10")} />
              <SettingsButton />
              <span className={cn("w-px self-stretch", dark ? "bg-white/10" : "bg-black/10")} />
              <LanguageSwitch />
            </div>
            <AnimatedThemeToggle />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center pb-16 text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease }}
            className={cn(
              "mb-8 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em]",
              dark ? "border-white/10 bg-white/5 text-neutral-300" : "border-black/10 bg-white/60 text-neutral-600",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", dark ? "bg-white" : "bg-[#12141a]")} />
            {t.local}
          </motion.p>
          <motion.h1
            initial="hidden"
            animate="visible"
            variants={reduced ? {} : {
              hidden: {},
              visible: { transition: { staggerChildren: 0.04, delayChildren: 0.03 } },
            }}
            className="max-w-4xl text-5xl font-light tracking-tight sm:text-7xl"
          >
            {t.heroA.split(" ").map((word, i) => (
              <motion.span
                key={`a-${i}`}
                variants={reduced ? {} : {
                  hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
                  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.36, ease } },
                }}
                style={reduced ? {} : undefined}
                className="inline-block mr-[0.25em]"
              >
                {word}
              </motion.span>
            ))}
            <br />
            <span className={dark ? "text-neutral-500" : "text-neutral-400"}>
              {t.heroB.split(" ").map((word, i) => (
                <motion.span
                  key={`b-${i}`}
                  variants={reduced ? {} : {
                    hidden: { opacity: 0, y: 12, filter: "blur(6px)" },
                    visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.36, ease } },
                  }}
                  className="inline-block mr-[0.25em]"
                >
                  {word}
                </motion.span>
              ))}
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, delay: 0.06 }}
            className={cn("mt-6 max-w-xl text-base font-light leading-relaxed sm:text-lg", dark ? "text-neutral-400" : "text-neutral-600")}
          >
            {t.lead}
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.24, ease }}>
            <MagneticWrapper className="mt-10 inline-flex">
              <Button
                asChild
                variant={dark ? "default" : "paper"}
                size="pill"
                className="glow group gap-2"
              >
                <Link to="/fix">
                  {t.cta}
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </MagneticWrapper>
          </motion.div>
        </main>

        <section className="grid gap-3 pb-16 sm:grid-cols-3">
          {steps.map(([index, title, body], order) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.26, delay: 0.1 + order * 0.04, ease }}
              className={cn("border p-6 text-left backdrop-blur-md", dark ? "border-white/10 bg-black/40" : "border-black/10 bg-white/55")}
            >
              <p className="font-mono text-[11px] text-neutral-500">{index}</p>
              <h2 className="mt-3 text-lg font-light">{title}</h2>
              <p className={cn("mt-2 text-sm leading-relaxed", dark ? "text-neutral-400" : "text-neutral-600")}>{body}</p>
            </motion.article>
          ))}
        </section>
      </div>

      <About />
    </div>
  );
}

function About() {
  const { t } = useI18n();
  const dark = useTheme().theme === "dark";
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 0.35"] });
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [48, 0]);

  return (
    <section ref={ref} className="relative z-10 mx-auto min-h-[80vh] max-w-3xl px-6 py-28">
      <motion.div style={{ opacity, y }}>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500">{t.about}</p>
        <h2 className="mt-3 text-4xl font-light tracking-tight sm:text-5xl">{t.aboutTitle}</h2>
        <p className={cn("mt-6 text-base font-light leading-relaxed", dark ? "text-neutral-300" : "text-neutral-700")}>{t.aboutHow}</p>
        <p className={cn("mt-4 text-base font-light leading-relaxed", dark ? "text-neutral-300" : "text-neutral-700")}>{t.aboutWho}</p>
        <div className="mt-8">
          <DiscordProfile />
        </div>
      </motion.div>
    </section>
  );
}
