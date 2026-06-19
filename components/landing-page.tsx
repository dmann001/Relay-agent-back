"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Instrument_Serif } from "next/font/google"
import {
  ArrowRight,
  Bot,
  CheckSquare,
  Inbox,
  Mail,
  Menu,
  Minus,
  NotebookTabs,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ProductMockup,
  featureMockupScenes,
} from "@/components/landing-mockups"
import { cn } from "@/lib/utils"
import { ThemeToggleIcon } from "@/components/theme-toggle"
import { useEffectiveTheme } from "@/components/theme-provider"
import marbleNeural from "@/asset_images/1.png"
import cathedralLight from "@/asset_images/2.png"
import cosmicPhilosophers from "@/asset_images/4.png"
import goldenSphere from "@/asset_images/5.png"
import dreamingLandscape from "@/asset_images/8.png"

const landingSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
})

const features = [
  {
    icon: Inbox,
    title: "Unified inbox",
    description:
      "Connect Gmail and Outlook. Read, compose, and organize mail from one calm workspace.",
    prompt: "Show me what actually needs a reply today",
  },
  {
    icon: Sparkles,
    title: "Inbox brief",
    description:
      "Start each session with a concise overview — what needs a reply, what is due, what matters.",
    prompt: "Summarize my morning inbox in six decisions",
  },
  {
    icon: Mail,
    title: "Thread assistant",
    description:
      "Summarize long threads, draft replies in your voice, extract tasks, and ask questions in context.",
    prompt: "Draft a reply that confirms Friday delivery",
  },
  {
    icon: CheckSquare,
    title: "Commitments",
    description:
      "Turn email obligations into tracked tasks with due dates, snooze, and follow-up monitoring.",
    prompt: "Track everything I promised to send this week",
  },
  {
    icon: NotebookTabs,
    title: "Meeting briefs",
    description:
      "Generate preparation notes from related threads so you walk into meetings informed.",
    prompt: "Prep me for the board sync from related threads",
  },
  {
    icon: Bot,
    title: "Agent activity",
    description:
      "Background agents log their work and wait for your approval before taking action.",
    prompt: "Archive promos but keep receipts and legal mail",
  },
]

const faqs = [
  {
    question: "What is Relay?",
    answer:
      "Relay is an AI-assisted email workspace that unifies Gmail and Outlook. It helps you read less, decide faster, and follow through on what matters — without replacing your existing mail providers.",
  },
  {
    question: "Which email providers are supported?",
    answer:
      "Relay supports Gmail and Microsoft Outlook. Connect one or both accounts in Settings after signing up. Your mail stays with your provider; Relay syncs and assists on top.",
  },
  {
    question: "How does Relay use AI?",
    answer:
      "Relay offers an inbox brief, thread-level summaries and drafts, task extraction, meeting briefs, and background commitment monitoring. AI features are optional and configurable per account in Settings.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Relay stores OAuth tokens encrypted on the server and authenticates API requests with Supabase. Email content is processed to provide AI features when enabled. We do not sell your data.",
  },
  {
    question: "Is Relay free?",
    answer:
      "Relay is currently in private beta. Create an account to get started — pricing will be announced before any paid plans launch.",
  },
  {
    question: "How do I get started?",
    answer:
      "Sign up with your email, confirm your account, then connect Gmail or Outlook in Settings. Your inbox syncs automatically and AI features become available once an account is connected.",
  },
]

const NAV_SCROLL_RANGE = 80

/** Smooth 0→1 easing for scroll-linked nav morph */
function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount
}

function LandingBackdrop() {
  return (
    <div aria-hidden className="landing-backdrop pointer-events-none fixed inset-0 overflow-hidden">
      <div className="landing-backdrop-grain absolute inset-0" />
      <svg
        className="absolute -left-[10%] top-[8%] h-[520px] w-[820px] text-neutral-300/50 dark:text-neutral-700/35"
        viewBox="0 0 820 520"
        fill="none"
      >
        <path
          d="M0 420C180 260 320 120 520 80C660 50 760 90 820 140"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M40 500C220 340 380 220 580 180C700 155 780 190 820 240"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.6"
        />
      </svg>
      <svg
        className="absolute -right-[8%] top-[32%] h-[640px] w-[900px] text-neutral-300/40 dark:text-neutral-700/30"
        viewBox="0 0 900 640"
        fill="none"
      >
        <path
          d="M900 80C720 220 560 360 380 420C240 470 120 450 20 380"
          stroke="currentColor"
          strokeWidth="1"
        />
        <path
          d="M900 180C740 300 580 440 400 500C260 545 140 530 40 470"
          stroke="currentColor"
          strokeWidth="0.75"
          opacity="0.55"
        />
      </svg>
    </div>
  )
}

function LandingArtAccents() {
  return (
    <>
      <div className="landing-art-orb pointer-events-none absolute -left-28 top-24 hidden h-64 w-64 overflow-hidden rounded-full border border-white/40 shadow-[0_32px_80px_-24px_rgba(0,0,0,0.35)] dark:border-white/10 lg:block xl:-left-16 xl:top-28 xl:h-80 xl:w-80">
        <Image
          src={goldenSphere}
          alt=""
          fill
          priority
          sizes="320px"
          className="object-cover object-center"
        />
      </div>

      <div className="landing-art-orb landing-art-orb-delay pointer-events-none absolute -right-24 top-[520px] hidden h-56 w-56 overflow-hidden rounded-full border border-white/35 shadow-[0_28px_70px_-22px_rgba(0,0,0,0.3)] lg:block xl:-right-12 xl:top-[560px] xl:h-72 xl:w-72">
        <Image
          src={marbleNeural}
          alt=""
          fill
          sizes="288px"
          className="object-cover object-[center_20%]"
        />
      </div>
    </>
  )
}

const liveSignals = [
  "Brief updated",
  "3 replies ready",
  "2 commitments tracked",
  "Meeting prep synced",
]

function LandingLiveVisuals() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
    >
      <div className="landing-live-scan absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-neutral-900/20 to-transparent dark:via-white/20" />

      <div className="landing-live-thread landing-live-thread-a absolute left-[8%] top-[18%] hidden h-24 w-px bg-gradient-to-b from-transparent via-neutral-900/20 to-transparent dark:via-white/20 lg:block" />
      <div className="landing-live-thread landing-live-thread-b absolute right-[12%] top-[44%] hidden h-32 w-px bg-gradient-to-b from-transparent via-neutral-900/20 to-transparent dark:via-white/20 lg:block" />
      <div className="landing-live-thread landing-live-thread-c absolute left-[18%] bottom-[18%] hidden h-20 w-px bg-gradient-to-b from-transparent via-neutral-900/20 to-transparent dark:via-white/20 lg:block" />

      <div className="landing-live-pulse absolute left-[10%] top-[28%] hidden h-2 w-2 rounded-full bg-neutral-900/40 dark:bg-white/50 lg:block" />
      <div className="landing-live-pulse landing-live-delay-1 absolute right-[18%] top-[36%] hidden h-2 w-2 rounded-full bg-neutral-900/40 dark:bg-white/50 lg:block" />
      <div className="landing-live-pulse landing-live-delay-2 absolute left-[24%] bottom-[22%] hidden h-2 w-2 rounded-full bg-neutral-900/40 dark:bg-white/50 lg:block" />
    </div>
  )
}

function HeroLiveOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
    >
      <div className="landing-mockup-light absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent dark:via-white/10" />

      <div className="landing-live-card absolute -right-3 top-8 hidden rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-left shadow-[0_18px_50px_-22px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/70 md:block">
        <div className="mb-1 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">
            Live
          </span>
        </div>
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          Inbox syncing
        </p>
      </div>

      <div className="landing-live-card landing-live-card-delay absolute -left-4 bottom-10 hidden rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-neutral-950/70 sm:block">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-neutral-700 dark:text-neutral-200" />
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Draft ready
          </span>
        </div>
      </div>
    </div>
  )
}

function LiveSignalRail() {
  return (
    <div
      aria-hidden
      className="pointer-events-none mx-auto mt-8 flex max-w-4xl overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]"
    >
      <div className="landing-signal-marquee flex min-w-max gap-3 pr-3">
        {[...liveSignals, ...liveSignals].map((signal, index) => (
          <span
            key={`${signal}-${index}`}
            className="flex items-center gap-2 rounded-full border border-neutral-200/70 bg-white/55 px-3 py-1.5 text-xs text-neutral-500 shadow-sm backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/55 dark:text-neutral-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {signal}
          </span>
        ))}
      </div>
    </div>
  )
}

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [navProgress, setNavProgress] = useState(0)
  const effectiveTheme = useEffectiveTheme()
  const isDark = effectiveTheme === "dark"

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let frame = 0

    const update = () => {
      frame = 0
      const raw = Math.min(1, Math.max(0, window.scrollY / NAV_SCROLL_RANGE))
      setNavProgress(smoothstep(raw))
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const navFloating = navProgress > 0.5
  const navTopInset = lerp(0, 12, navProgress)
  const headerBorderOpacity = lerp(0.8, 0, navProgress)
  const headerBgOpacity = lerp(0.88, 0, navProgress)
  const barShadowOpacity = navProgress

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--landing-bg)] text-[var(--landing-fg)] selection:bg-neutral-200 dark:selection:bg-neutral-800">
      <LandingBackdrop />
      <LandingLiveVisuals />
      <header
        className={cn(
          "landing-nav-shell fixed inset-x-0 top-0 z-50",
          navFloating ? "flex justify-center px-2" : "px-4",
        )}
        style={{
          paddingTop: navTopInset,
          backgroundColor: navFloating
            ? "transparent"
            : `rgba(${isDark ? "10, 10, 10" : "247, 246, 243"}, ${headerBgOpacity})`,
          borderBottom: navFloating
            ? "none"
            : `1px solid rgba(${isDark ? "46, 46, 46" : "229, 229, 229"}, ${headerBorderOpacity})`,
          backdropFilter: navFloating ? "none" : `blur(${lerp(12, 0, navProgress)}px)`,
          WebkitBackdropFilter: navFloating
            ? "none"
            : `blur(${lerp(12, 0, navProgress)}px)`,
        }}
      >
        <div
          className={cn(
            "landing-nav-bar relative flex items-center overflow-hidden transition-[box-shadow,background-color,border-color,border-radius,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            navFloating
              ? "h-11 w-max max-w-[calc(100%-1rem)] items-center gap-0.5 rounded-full border-0 px-2 shadow-lg shadow-neutral-900/25"
              : "mx-auto h-14 w-full max-w-6xl gap-8 px-6",
          )}
          style={
            navFloating
              ? undefined
              : {
                  boxShadow:
                    barShadowOpacity > 0.05
                      ? `0 ${10 * barShadowOpacity}px ${24 * barShadowOpacity}px ${-6 * barShadowOpacity}px rgba(10, 10, 10, ${(isDark ? 0.35 : 0.06) * barShadowOpacity})`
                      : "none",
                  borderRadius: lerp(0, 10, navProgress),
                  backgroundColor: `rgba(${isDark ? "20, 20, 20" : "255, 255, 255"}, ${lerp(0, 0.5, navProgress)})`,
                  border: `1px solid rgba(${isDark ? "46, 46, 46" : "229, 229, 229"}, ${lerp(0, 0.4, navProgress)})`,
                }
          }
        >
          {navFloating && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <Image
                src={cosmicPhilosophers}
                alt=""
                fill
                sizes="480px"
                className="scale-[1.18] object-cover object-[center_40%]"
              />
              <div className="absolute inset-0 bg-neutral-950/68" />
            </div>
          )}

          <Link
            href="/"
            className={cn(
              "relative z-10 flex shrink-0 items-center gap-2",
              navFloating && "pl-1",
            )}
          >
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                navFloating ? "bg-white/15" : "bg-neutral-900 dark:bg-neutral-100",
              )}
            >
              <Mail className={cn("h-3.5 w-3.5", navFloating ? "text-white" : "text-white dark:text-neutral-900")} />
            </div>
            <span
              className={cn(
                "text-sm font-medium tracking-tight",
                navFloating ? "text-white" : "text-neutral-900 dark:text-neutral-100",
              )}
            >
              Relay
            </span>
          </Link>

          <nav
            className={cn(
              "relative z-10 hidden items-center md:flex",
              navFloating ? "gap-0.5" : "gap-6",
            )}
          >
            <Link
              href="#product"
              className={cn(
                "text-sm transition-colors",
                navFloating
                  ? "rounded-full px-2.5 py-1 text-white/85 hover:bg-white/10 hover:text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
              )}
            >
              Product
            </Link>
            <Link
              href="#faq"
              className={cn(
                "text-sm transition-colors",
                navFloating
                  ? "rounded-full px-2.5 py-1 text-white/85 hover:bg-white/10 hover:text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100",
              )}
            >
              FAQ
            </Link>
          </nav>

          {!navFloating && <div aria-hidden className="hidden min-w-0 flex-1 md:block" />}

          <div
            className={cn(
              "relative z-10 hidden items-center md:flex",
              navFloating ? "gap-1" : "ml-auto gap-2",
            )}
          >
            <ThemeToggleIcon inverted={navFloating} />
            <Button
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "rounded-full text-sm",
                navFloating
                  ? "h-8 px-2.5 text-white/90 hover:bg-white/10 hover:text-white"
                  : "h-9 px-4 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:hover:text-white",
              )}
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              size="sm"
              asChild
              className={cn(
                "rounded-full",
                navFloating
                  ? "h-8 bg-white/95 px-3 text-sm text-neutral-950 hover:bg-white"
                  : "h-9 bg-neutral-900 px-4 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white",
              )}
            >
              <Link href="/login?tab=signup">Sign up</Link>
            </Button>
          </div>

          <div className={cn("relative z-10 flex items-center gap-1 md:hidden", !navFloating && "ml-auto")}>
            {!navFloating && <ThemeToggleIcon />}
            {navFloating && <ThemeToggleIcon inverted />}
            <button
              type="button"
              className={cn(
                navFloating ? "text-white" : "text-neutral-900 dark:text-neutral-100",
              )}
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div
            className={cn(
              "border border-neutral-200 bg-white px-6 py-4 dark:border-neutral-800 dark:bg-neutral-900 md:hidden",
              navFloating
                ? "mx-auto mt-2 w-fit min-w-[min(100%,20rem)] rounded-2xl shadow-lg"
                : "mt-0 border-t border-x-0",
            )}
          >
            <nav className="flex flex-col gap-3">
              <Link
                href="#product"
                className="text-sm text-neutral-600 dark:text-neutral-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                Product
              </Link>
              <Link
                href="#faq"
                className="text-sm text-neutral-600 dark:text-neutral-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </Link>
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="outline" asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link href="/login?tab=signup">Sign up</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10 pt-14">
        <section className="relative mx-auto max-w-6xl overflow-visible px-6 pb-16 pt-16 text-center md:pb-24 md:pt-24">
          <LandingArtAccents />
          <div
            className={`mx-auto max-w-3xl space-y-6 transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          >
            <p className="text-sm tracking-wide text-neutral-500 dark:text-neutral-400">
              An AI workspace for Gmail & Outlook
            </p>
            <h1
              className={cn(
                landingSerif.className,
                "text-[clamp(2.75rem,6vw,4.75rem)] font-normal leading-[1.02] tracking-tight text-neutral-900 dark:text-neutral-50",
              )}
            >
              The inbox that
              <br />
              works for you
            </h1>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-neutral-500 dark:text-neutral-400 md:text-xl">
              Relay unifies your mail with quiet AI — briefs, drafts,
              commitments, and meeting prep in one calm workspace.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                size="lg"
                asChild
                className="h-12 rounded-full bg-neutral-900 px-6 text-base hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white"
              >
                <Link href="/login?tab=signup">
                  Get started
                  <span className="ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-12 rounded-full border-neutral-300 bg-white/50 px-6 text-base backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-100"
              >
                <Link href="#product">See the product</Link>
              </Button>
            </div>
          </div>

          <div
            className={`relative mx-auto mt-14 max-w-4xl transition-all duration-700 delay-150 md:mt-16 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          >
            <ProductMockup variant="hero" scene="inbox" />
            <HeroLiveOverlay />
            <LiveSignalRail />
          </div>
        </section>

        <section className="relative mx-auto max-w-6xl px-6 pb-8 md:pb-12">
          <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] md:min-h-[460px] lg:min-h-[540px] xl:min-h-[600px]">
            <Image
              src={cathedralLight}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 1152px"
              className="object-cover object-[32%_42%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/20" />
            <div className="absolute inset-0 flex items-center p-8 md:p-12 lg:p-16 xl:p-20">
              <div className="max-w-lg space-y-3 md:max-w-xl md:space-y-4 lg:max-w-2xl lg:space-y-5">
                <p
                  className={cn(
                    landingSerif.className,
                    "text-left text-[clamp(1.75rem,3.5vw,3.25rem)] leading-[1.08] text-white",
                  )}
                >
                  Quiet intelligence for a loud inbox.
                </p>
                <p className="max-w-md text-left text-sm leading-relaxed text-white/75 md:max-w-lg md:text-base lg:text-lg lg:leading-relaxed">
                  Relay distills signal from noise — so you can think clearly and
                  act with intention.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="relative px-6 py-20 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-14 max-w-3xl text-center md:mb-16">
              <h2
                className={cn(
                  landingSerif.className,
                  "text-4xl font-normal tracking-tight text-neutral-900 dark:text-neutral-50 md:text-5xl lg:text-6xl",
                )}
              >
                Do anything with Relay
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-500 dark:text-neutral-400 md:text-lg">
                Browse smarter, decide faster, and follow through — from wrangling
                inboxes to drafting replies and tracking what you owe.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 md:gap-6">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex min-h-[440px] flex-col overflow-hidden rounded-[1.75rem] bg-[var(--landing-feature-bg)] p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.12)] dark:shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45)] md:min-h-[480px] md:p-6"
                >
                  <h3 className="text-base font-medium text-neutral-800 dark:text-neutral-100 md:text-lg">
                    {feature.title}
                  </h3>
                  <div className="mt-4 min-h-[280px] flex-1 md:min-h-[300px]">
                    <ProductMockup
                      variant="feature"
                      scene={featureMockupScenes[feature.title] ?? "inbox"}
                    />
                  </div>
                  <div className="mt-5 rounded-full border border-white/80 bg-white/75 px-4 py-3 text-left text-sm leading-relaxed text-neutral-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_-16px_rgba(0,0,0,0.08)] backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-300 dark:shadow-none md:px-5 md:py-3.5">
                    {feature.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="relative overflow-hidden px-6 py-28 md:py-36">
          <div className="pointer-events-none absolute -right-16 top-1/2 hidden h-80 w-80 -translate-y-1/2 overflow-hidden rounded-full opacity-[0.14] blur-[1px] lg:block xl:-right-8 xl:h-96 xl:w-96">
            <Image
              src={dreamingLandscape}
              alt=""
              fill
              sizes="384px"
              className="object-cover"
            />
          </div>

          <div className="relative mx-auto max-w-5xl">
            <h2
              className={cn(
                landingSerif.className,
                "mb-14 text-center text-5xl font-normal tracking-tight text-neutral-900 dark:text-neutral-50 md:mb-16 md:text-6xl lg:text-7xl",
              )}
            >
              FAQ
            </h2>

            <Accordion type="single" collapsible className="w-full space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`item-${index}`}
                  className="overflow-hidden rounded-2xl border border-neutral-200/60 bg-[var(--landing-faq-bg)] px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:border-neutral-800 dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] dark:hover:shadow-[0_12px_40px_rgb(0,0,0,0.35)] md:px-8 border-b-0"
                >
                  <AccordionTrigger className="group gap-4 py-6 text-left hover:no-underline md:py-7 [&>svg.lucide-chevron-down]:hidden">
                    <span className="flex-1 text-lg font-medium leading-snug text-neutral-900 dark:text-neutral-100 md:text-xl">
                      {faq.question}
                    </span>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-900 md:h-11 md:w-11">
                      <Plus className="h-4 w-4 text-neutral-600 dark:text-neutral-300 group-data-[state=open]:hidden md:h-5 md:w-5" />
                      <Minus className="hidden h-4 w-4 text-neutral-600 dark:text-neutral-300 group-data-[state=open]:block md:h-5 md:w-5" />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-base leading-relaxed text-neutral-600 dark:text-neutral-300">
                    <div className="pb-6 pt-0 md:pb-7 md:text-lg md:leading-relaxed">
                      {faq.answer}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-6 pb-14 pt-6 md:pb-20 md:pt-8">
          <div className="relative mx-auto max-w-6xl min-h-[300px] overflow-hidden rounded-[2rem] text-center text-white md:min-h-[380px] lg:min-h-[440px] xl:min-h-[480px]">
            <Image
              src={cosmicPhilosophers}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 1152px"
              className="object-cover object-[center_36%]"
            />
            <div className="absolute inset-0 bg-neutral-950/68" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 py-10 md:px-10 md:py-12 lg:px-12 lg:py-14">
              <div className="mx-auto max-w-2xl space-y-3 md:max-w-3xl md:space-y-4">
                <h2
                  className={cn(
                    landingSerif.className,
                    "text-[clamp(1.875rem,3.8vw,3.5rem)] font-normal leading-[1.08] tracking-tight",
                  )}
                >
                  Browse mail with intelligence
                </h2>
                <p className="mx-auto max-w-lg text-sm leading-relaxed text-neutral-200 md:max-w-xl md:text-base lg:text-lg">
                  Create a free account and connect Gmail or Outlook in minutes.
                </p>
                <Button
                  size="lg"
                  asChild
                  className="mt-1 h-11 rounded-full bg-white px-6 text-sm text-neutral-950 hover:bg-neutral-100 md:mt-2 md:h-12 md:text-base"
                >
                  <Link href="/login?tab=signup">
                    Get started
                    <span className="ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-950/10 md:h-7 md:w-7">
                      <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </span>
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200/80 bg-[var(--landing-bg)] dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-10 md:flex-row md:items-center md:py-12">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 dark:bg-neutral-100">
                <Mail className="h-3.5 w-3.5 text-white dark:text-neutral-900" />
              </div>
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Relay</span>
            </div>
            <p className="text-xs uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
              © {new Date().getFullYear()} Relay
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link
              href="#product"
              className="text-xs uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Product
            </Link>
            <Link
              href="#faq"
              className="text-xs uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              FAQ
            </Link>
            <Link
              href="/login"
              className="text-xs uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Sign in
            </Link>
            <Link
              href="#"
              className="text-xs uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-xs uppercase tracking-[0.16em] text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
