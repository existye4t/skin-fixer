
import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import { Link } from "react-router-dom";

import { DiscordCard, DiscordProfile } from "@/components/DiscordCard";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { SettingsButton } from "@/components/SettingsButton";
import { SourceLink } from "@/components/SourceLink";
import { AnimatedThemeToggle } from "@/components/ui/animated-theme-toggle";
import TopoField from "@/components/ui/topo-field";
import { Button } from "@/components/ui/button";
import { SpotlightPanel } from "@/components/ui/spotlight";
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

  // Subtle parallax on TopoField: moves at ~28% of scroll speed
  const { scrollY } = useScroll();
  const rawParallax = useTransform(scrollY, [0, 1200], [0, -340]);
  const parallaxY = useSpring(rawParallax, { stiffness: 60, damping: 20 });
  const steps = [
    ["01", t.step1t, t.step1b],
    ["02", t.step2t, t.step2b],
    ["03", t.step3t, t.step3b],
  ];

  return (
    <div className={cn("relative min-h-screen overflow-hidden", dark ? "text-white" : "text-[#12141a]")}>
      <motion.div
        className="pointer-events-none fixed inset-0"
        style={reduced ? {} : { y: parallaxY }}
      >
        <TopoField mode={theme} className="absolute inset-0" density={0.9} />
      </motion.div>
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
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.24, ease }}
            whileTap={reduced ? {} : { scale: 0.96 }}
            className="mt-10 inline-flex"
          >
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
          </motion.div>
        </main>

        <section className="grid gap-3 pb-16 sm:grid-cols-3">
          {steps.map(([index, title, body], order) => (
            <StepCard
              key={index}
              index={index as string}
              title={title as string}
              body={body as string}
              order={order}
              dark={dark}
              reduced={reduced}
              ease={ease}
            />
          ))}
        </section>
      </div>

      <About />
    </div>
  );
}

// ─── StepCard ────────────────────────────────────────────────────────────────

const TILT_SPRING = { stiffness: 150, damping: 15 };

interface StepCardProps {
  index: string;
  title: string;
  body: string;
  order: number;
  dark: boolean;
  reduced: boolean;
  ease: readonly [number, number, number, number];
}

function StepCard({ index, title, body, order, dark, reduced, ease }: StepCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rawRX = useMotionValue(0);
  const rawRY = useMotionValue(0);
  const rotateX = useSpring(rawRX, TILT_SPRING);
  const rotateY = useSpring(rawRY, TILT_SPRING);
  const liftY = useSpring(useMotionValue(0), { stiffness: 200, damping: 20 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    rawRY.set(dx * 4);
    rawRX.set(-dy * 4);
  }

  function handleMouseEnter() {
    if (!reduced) liftY.set(-3);
  }

  function handleMouseLeave() {
    rawRX.set(0);
    rawRY.set(0);
    liftY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay: 0.1 + order * 0.04, ease }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={reduced ? {} : { rotateX, rotateY, y: liftY, transformPerspective: 1000 }}
      className="group"
    >
      <SpotlightPanel
        dark={dark}
        radius={200}
        className={cn(
          "overflow-hidden border backdrop-blur-md transition-colors duration-200",
          dark
            ? "border-white/10 bg-black/40 hover:border-white/25 hover:bg-black/55"
            : "border-black/10 bg-white/55 hover:border-black/20 hover:bg-white/75",
        )}
      >
        <div className="p-6 text-left">
          {/* Number kicker — animates to full opacity + scale on hover */}
          <p
            className={cn(
              "font-mono text-[11px] text-neutral-500 transition-all duration-200 origin-left",
              "group-hover:text-current group-hover:scale-x-[1.08]",
              dark ? "group-hover:text-white" : "group-hover:text-[#12141a]",
            )}
          >
            {index}
          </p>
          <h2 className="mt-3 text-lg font-light">{title}</h2>
          {/* Underline reveal: scaleX 0→1 on hover */}
          <div
            className={cn(
              "h-px origin-left scale-x-0 transition-transform duration-[250ms] group-hover:scale-x-100",
              dark ? "bg-white/20" : "bg-black/15",
            )}
          />
          <p className={cn("mt-2 text-sm leading-relaxed", dark ? "text-neutral-400" : "text-neutral-600")}>{body}</p>
        </div>
      </SpotlightPanel>
    </motion.div>
  );
}

// ─── About ───────────────────────────────────────────────────────────────────

const aboutEase = [0.22, 1, 0.36, 1] as const;

const aboutContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const aboutItem = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: aboutEase } },
};

function About() {
  const { t } = useI18n();
  const { reduced } = useMotionSetting();
  const dark = useTheme().theme === "dark";

  return (
    <section className="relative z-10 mx-auto min-h-[80vh] max-w-3xl px-6 py-28">
      <motion.div
        initial={reduced ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-15%" }}
        variants={reduced ? {} : aboutContainer}
      >
        <motion.p
          variants={reduced ? {} : aboutItem}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-500"
        >
          {t.about}
        </motion.p>
        <motion.h2
          variants={reduced ? {} : aboutItem}
          className="mt-3 text-4xl font-light tracking-tight sm:text-5xl"
        >
          {t.aboutTitle}
        </motion.h2>
        <motion.p
          variants={reduced ? {} : aboutItem}
          className={cn("mt-6 text-base font-light leading-relaxed", dark ? "text-neutral-300" : "text-neutral-700")}
        >
          {t.aboutHow}
        </motion.p>
        <motion.p
          variants={reduced ? {} : aboutItem}
          className={cn("mt-4 text-base font-light leading-relaxed", dark ? "text-neutral-300" : "text-neutral-700")}
        >
          {t.aboutWho}
        </motion.p>
        <motion.div variants={reduced ? {} : aboutItem} className="mt-8">
          <DiscordProfile />
        </motion.div>
      </motion.div>
    </section>
  );
}
