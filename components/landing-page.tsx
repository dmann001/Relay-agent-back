"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRight,
  Mail,
  Menu,
  Minus,
  Plus,
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
  type MockupScene,
} from "@/components/landing-mockups"
import { ThemeToggleIcon } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"
import cathedralLight from "@/asset_images/2.png"
import cosmicPhilosophers from "@/asset_images/4.png"

const features: Array<{
  title: string
  eyebrow: string
  description: string
  scene: MockupScene
}> = [
  {
    title: "Make inbox operations self-driving",
    eyebrow: "1.0 Intake",
    description:
      "Unify Gmail and Outlook, classify what needs attention, and keep the reading pane in place while Relay prepares the next move.",
    scene: "inbox",
  },
  {
    title: "Start every session with signal",
    eyebrow: "2.0 Brief",
    description:
      "Relay condenses unread mail, deadlines, and reply obligations into a compact brief so the first decision is obvious.",
    scene: "brief",
  },
  {
    title: "Draft replies inside the thread",
    eyebrow: "3.0 Compose",
    description:
      "Ask questions in context, summarize long conversations, and turn a thread into a polished reply without leaving the workspace.",
    scene: "thread",
  },
  {
    title: "Track promises until they close",
    eyebrow: "4.0 Follow through",
    description:
      "Extract commitments, monitor follow-ups, and connect important promises to due dates, reminders, and calendar events.",
    scene: "commitments",
  },
  {
    title: "Prepare for meetings from mail",
    eyebrow: "5.0 Prepare",
    description:
      "Generate meeting briefs from related threads so every agenda starts with the facts, blockers, and open questions.",
    scene: "meetings",
  },
  {
    title: "Understand agent work at scale",
    eyebrow: "6.0 Monitor",
    description:
      "Review what Relay agents changed, approve risky actions, and inspect every background step before it touches your mail.",
    scene: "activity",
  },
]

const faqs = [
  {
    question: "What is Relay?",
    answer:
      "Relay is an AI-assisted email workspace for Gmail and Outlook. It helps you triage, draft, track commitments, and prepare for meetings from one focused interface.",
  },
  {
    question: "Which email providers are supported?",
    answer:
      "Relay supports Gmail and Microsoft Outlook. You can connect either provider, or both, from Settings after signing in.",
  },
  {
    question: "How does Relay use AI?",
    answer:
      "Relay uses AI for inbox briefs, thread summaries, reply drafts, commitment extraction, meeting briefs, and supervised background agent activity.",
  },
  {
    question: "Is Relay free?",
    answer:
      "Relay is currently in private beta. Pricing will be announced before paid plans launch.",
  },
]

function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px", ...options },
    )

    observer.observe(node)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { ref, isVisible }
}

function Reveal({
  children,
  className,
  delayClass,
}: {
  children: ReactNode
  className?: string
  delayClass?: string
}) {
  const { ref, isVisible } = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn("landing-reveal", delayClass, isVisible && "is-visible", className)}
    >
      {children}
    </div>
  )
}

function FigFlow({ className }: { className?: string }) {
  const { ref, isVisible } = useInView<SVGSVGElement>()

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 140"
      className={cn("landing-fig mx-auto h-32 w-full max-w-[220px]", isVisible && "is-visible", className)}
      aria-hidden
    >
      <g className="landing-fig-idle">
        {/* base platform */}
        <polygon className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-1" points="24,88 100,48 176,88 100,128" />
        <polygon className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-2" points="36,78 100,44 164,78 100,112" />
        <polygon className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-3" points="48,68 100,40 152,68 100,96" />
        <polygon className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-4" points="60,58 100,36 140,58 100,80" />
        {/* top disc with horizon lines */}
        <polygon className="landing-fig-fill landing-fig-accent landing-fig-stroke landing-fig-stroke-delay-5" points="72,48 100,34 128,48 100,62" />
        <ellipse className="landing-fig-detail" cx="100" cy="48" rx="18" ry="8" />
        <line className="landing-fig-detail" x1="86" y1="48" x2="114" y2="48" />
        <line className="landing-fig-detail" x1="88" y1="44" x2="112" y2="44" />
        <line className="landing-fig-detail" x1="90" y1="52" x2="110" y2="52" />
        {/* spine + node */}
        <line className="landing-fig-stroke landing-fig-stroke-delay-5" x1="100" y1="34" x2="100" y2="14" />
        <circle className="landing-fig-node" cx="100" cy="12" r="3.5" />
        {/* inner grid on layers */}
        <line className="landing-fig-detail" x1="60" y1="78" x2="140" y2="78" />
        <line className="landing-fig-detail" x1="72" y1="68" x2="128" y2="68" />
        <line className="landing-fig-scan" x1="40" y1="72" x2="160" y2="72" />
      </g>
    </svg>
  )
}

function FigContext({ className }: { className?: string }) {
  const { ref, isVisible } = useInView<SVGSVGElement>()

  const cube = (cx: number, cy: number, delay: string) => (
    <g key={`${cx}-${cy}`}>
      <polygon className={cn("landing-fig-fill landing-fig-stroke", delay)} points={`${cx - 16},${cy + 8} ${cx},${cy} ${cx + 16},${cy + 8} ${cx},${cy + 16}`} />
      <polygon className={cn("landing-fig-fill landing-fig-stroke", delay)} points={`${cx},${cy + 16} ${cx + 16},${cy + 8} ${cx + 16},${cy + 24} ${cx},${cy + 32}`} />
      <polygon className={cn("landing-fig-fill landing-fig-stroke", delay)} points={`${cx - 16},${cy + 8} ${cx},${cy + 16} ${cx},${cy + 32} ${cx - 16},${cy + 24}`} />
      <circle className="landing-fig-node" cx={cx} cy={cy + 4} r="2" />
    </g>
  )

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 140"
      className={cn("landing-fig mx-auto h-32 w-full max-w-[220px]", isVisible && "is-visible", className)}
      aria-hidden
    >
      <g className="landing-fig-idle">
        {cube(52, 52, "landing-fig-stroke-delay-1")}
        {cube(100, 36, "landing-fig-stroke-delay-2")}
        {cube(148, 52, "landing-fig-stroke-delay-3")}
        {cube(76, 78, "landing-fig-stroke-delay-4")}
        {cube(124, 78, "landing-fig-stroke-delay-5")}
        {/* connection graph */}
        <polyline className="landing-fig-detail landing-fig-stroke-delay-3" points="68,60 100,44 132,60" />
        <polyline className="landing-fig-detail landing-fig-stroke-delay-4" points="60,68 88,86 124,86 148,68" />
        <line className="landing-fig-detail" x1="100" y1="44" x2="88" y2="86" />
        <line className="landing-fig-detail" x1="100" y1="44" x2="124" y2="86" />
        <line className="landing-fig-scan" x1="44" y1="96" x2="156" y2="96" />
      </g>
    </svg>
  )
}

function FigControl({ className }: { className?: string }) {
  const { ref, isVisible } = useInView<SVGSVGElement>()

  const slab = (x: number, y: number, w: number, h: number, delay: string) => (
    <g key={`${x}-${y}`}>
      <polygon className={cn("landing-fig-fill landing-fig-stroke", delay)} points={`${x},${y + h} ${x + w},${y + h} ${x + w + 10},${y + h - 8} ${x + 10},${y + h - 8}`} />
      <polygon className={cn("landing-fig-fill landing-fig-stroke", delay)} points={`${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`} />
      <polygon className={cn("landing-fig-fill landing-fig-accent landing-fig-stroke", delay)} points={`${x + w},${y} ${x + w + 10},${y - 8} ${x + w + 10},${y + h - 8} ${x + w},${y + h}`} />
    </g>
  )

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 140"
      className={cn("landing-fig mx-auto h-32 w-full max-w-[220px]", isVisible && "is-visible", className)}
      aria-hidden
    >
      <g className="landing-fig-idle">
        {slab(28, 92, 22, 28, "landing-fig-stroke-delay-1")}
        {slab(54, 76, 22, 44, "landing-fig-stroke-delay-2")}
        {slab(80, 58, 22, 62, "landing-fig-stroke-delay-3")}
        {slab(106, 38, 22, 82, "landing-fig-stroke-delay-4")}
        {slab(132, 22, 22, 98, "landing-fig-stroke-delay-5")}
        {/* back panel */}
        <rect className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-1" x="22" y="18" width="156" height="8" rx="1" />
        <line className="landing-fig-detail" x1="22" y1="118" x2="178" y2="118" />
        <line className="landing-fig-detail" x1="22" y1="118" x2="22" y2="18" />
        <circle className="landing-fig-node" cx="143" cy="26" r="2.5" />
        <line className="landing-fig-scan" x1="30" y1="30" x2="170" y2="30" />
      </g>
    </svg>
  )
}

function Nav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header className={cn("landing-nav-shell", scrolled && "is-scrolled")}>
      <div className="landing-nav-bar border-b landing-hairline md:border-b-0">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-5 md:h-16 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-950">
              <Mail className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold text-white">Relay</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-7 text-sm text-neutral-400 md:flex">
            <Link href="#product" className="transition-colors hover:text-white">Product</Link>
            <Link href="#features" className="transition-colors hover:text-white">Features</Link>
            <Link href="#faq" className="transition-colors hover:text-white">FAQ</Link>
            <span className="h-5 w-px bg-white/10" />
            <ThemeToggleIcon inverted />
            <Link href="/login" className="transition-colors hover:text-white">Log in</Link>
            <Button asChild className="h-9 rounded-full bg-white px-5 text-neutral-950 hover:bg-neutral-200">
              <Link href="/login?tab=signup">Sign up</Link>
            </Button>
          </nav>

          <button
            type="button"
            className="ml-auto text-white md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t landing-hairline px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-4 text-sm text-neutral-300">
              <Link href="#product" onClick={() => setMobileMenuOpen(false)}>Product</Link>
              <Link href="#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
              <Link href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
              <Link href="/login">Log in</Link>
              <Button asChild className="rounded-full bg-white text-neutral-950 hover:bg-neutral-200">
                <Link href="/login?tab=signup">Sign up</Link>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}

function PrincipleGrid() {
  const items = [
    {
      fig: "FIG 0.1",
      title: "Built for flow",
      text: "Relay keeps mail, drafts, briefs, and commitments in one continuous workspace.",
      Figure: FigFlow,
    },
    {
      fig: "FIG 0.2",
      title: "Powered by context",
      text: "The AI chat knows the active page and selected email, then uses that context before answering.",
      Figure: FigContext,
    },
    {
      fig: "FIG 0.3",
      title: "Designed for control",
      text: "Agents summarize and prepare work, while approvals keep important actions explicit.",
      Figure: FigControl,
    },
  ]

  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24 md:py-28">
      <Reveal>
        <h2 className="max-w-5xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-white">
          A new species of email workspace.{" "}
          <span className="text-neutral-500">
            Purpose-built for modern teams with AI workflows at its core.
          </span>
        </h2>
      </Reveal>

      <div className="mt-20 grid gap-px overflow-hidden border-y landing-hairline bg-white/10 md:grid-cols-3">
        {items.map(({ fig, title, text, Figure }, index) => (
          <Reveal key={title} delayClass={index === 1 ? "landing-reveal-delay-1" : index === 2 ? "landing-reveal-delay-2" : undefined}>
            <div className="min-h-[340px] bg-[#080808] p-8">
              <div className="landing-label">{fig}</div>
              <div className="mt-12 flex h-36 items-center justify-center">
                <Figure />
              </div>
              <h3 className="mt-14 text-base font-semibold text-white">{title}</h3>
              <p className="landing-body mt-3 max-w-sm text-sm">{text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function FeatureShowcase({ feature }: { feature: (typeof features)[number] }) {
  const { ref, isVisible } = useInView<HTMLElement>()

  return (
    <section ref={ref} className="border-t landing-hairline px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className={cn("landing-reveal", isVisible && "is-visible")}>
          <Link
            href="#features"
            className="group mb-10 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-white"
          >
            <span>{feature.eyebrow}</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
            <h3 className="landing-section-title max-w-xl">{feature.title}</h3>
            <p className="landing-body max-w-md lg:pt-1">{feature.description}</p>
          </div>
        </div>

        <div
          className={cn(
            "landing-reveal landing-reveal-delay-2 mt-14 overflow-hidden rounded-xl landing-panel p-3 md:p-4",
            isVisible && "is-visible",
          )}
        >
          <div
            className={cn(
              "h-[380px] overflow-hidden rounded-lg md:h-[520px]",
              isVisible && "landing-animate-active",
            )}
          >
            <ProductMockup variant="feature" scene={feature.scene} />
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPage() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 60)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="landing-page relative min-h-screen overflow-x-hidden selection:bg-white/20">
      <div className="landing-backdrop" aria-hidden>
        <div className="landing-backdrop-glow landing-backdrop-glow-hero" />
        <div className="landing-backdrop-glow landing-backdrop-glow-principles" />
        <div className="landing-backdrop-glow landing-backdrop-glow-features" />
        <div className="landing-backdrop-grain" />
      </div>

      <Nav />

      <main className="relative z-10">
        <section id="product" className="mx-auto max-w-7xl px-6 pb-20 pt-32 md:pb-28 md:pt-40">
          <div className={cn("transition-all duration-700", loaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
            <div className="grid items-end gap-10 lg:grid-cols-[1fr_0.42fr]">
              <div>
                <h1 className="landing-hero-title max-w-5xl">
                  The inbox system for teams and agents
                </h1>
                <p className="landing-body mt-8 max-w-2xl">
                  Relay unifies Gmail and Outlook with contextual AI for briefs, drafts, commitments, meeting prep, and supervised agent work.
                </p>
              </div>
              <div className="flex flex-col items-start gap-5 lg:items-end">
                <Link href="#features" className="group inline-flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white">
                  <span className="rounded-full bg-white px-2 py-1 text-xs text-neutral-950">New</span>
                  Relay page-aware chat
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Button asChild className="h-11 rounded-full bg-white px-5 text-neutral-950 hover:bg-neutral-200">
                  <Link href="/login?tab=signup">Start with Relay</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className={cn("mt-16 transition-all delay-150 duration-700", loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
            <div className="overflow-hidden rounded-xl landing-panel p-3 md:p-4">
              <ProductMockup variant="hero" scene="inbox" />
            </div>
          </div>
        </section>

        <PrincipleGrid />

        <section className="relative min-h-[420px] overflow-hidden border-y landing-hairline">
          <Image
            src={cathedralLight}
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-[32%_42%] opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080808] via-[#080808]/88 to-[#080808]/30" />
          <div className="relative mx-auto flex min-h-[420px] max-w-7xl items-center px-6 py-20">
            <Reveal className="max-w-2xl">
              <p className="landing-label mb-6">0.4 Philosophy</p>
              <h2 className="landing-section-title">
                Quiet intelligence for a loud inbox.
              </h2>
              <p className="landing-body mt-6 max-w-xl">
                Relay turns mail into decisions without burying people in dashboards, modes, or disconnected AI panels.
              </p>
            </Reveal>
          </div>
        </section>

        <div id="features">
          {features.map((feature) => (
            <FeatureShowcase key={feature.title} feature={feature} />
          ))}
        </div>

        <section id="faq" className="border-t landing-hairline px-6 py-24 md:py-32">
          <div className="mx-auto max-w-4xl">
            <Reveal>
              <p className="landing-label mb-6 text-center">Support</p>
              <h2 className="landing-section-title text-center">FAQ</h2>
            </Reveal>
            <Accordion type="single" collapsible className="mt-14 space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`item-${index}`}
                  className="overflow-hidden rounded-xl landing-panel px-5 border-b-0"
                >
                  <AccordionTrigger className="group gap-4 py-5 text-left hover:no-underline [&>svg.lucide-chevron-down]:hidden">
                    <span className="flex-1 text-base font-medium text-white md:text-lg">{faq.question}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border landing-hairline bg-white/[0.03] text-neutral-400">
                      <Plus className="h-4 w-4 group-data-[state=open]:hidden" />
                      <Minus className="hidden h-4 w-4 group-data-[state=open]:block" />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="landing-body text-sm md:text-base">
                    <div className="pb-5">{faq.answer}</div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-6 pb-16">
          <Reveal>
            <div className="relative mx-auto min-h-[360px] max-w-7xl overflow-hidden rounded-xl landing-panel">
              <Image
                src={cosmicPhilosophers}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 1280px"
                className="object-cover object-[center_36%] opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080808]/90 via-[#080808]/55 to-[#080808]/35" />
              <div className="relative flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
                <p className="landing-label mb-6">7.0 Start</p>
                <h2 className="landing-section-title max-w-3xl">
                  Browse mail with intelligence
                </h2>
                <p className="landing-body mt-5 max-w-xl">
                  Create an account and connect Gmail or Outlook in minutes.
                </p>
                <Button asChild className="mt-8 h-11 rounded-full bg-white px-6 text-neutral-950 hover:bg-neutral-200">
                  <Link href="/login?tab=signup">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t landing-hairline px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
            <div>
              <div className="flex items-center gap-2 text-white">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-neutral-950">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                Relay
              </div>
              <p className="landing-body mt-4 max-w-xs text-sm">
                The inbox system for teams and agents.
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Product</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-500">
                <Link href="#product" className="hover:text-white">Overview</Link>
                <Link href="#features" className="hover:text-white">Features</Link>
                <Link href="#faq" className="hover:text-white">FAQ</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Account</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-500">
                <Link href="/login" className="hover:text-white">Log in</Link>
                <Link href="/login?tab=signup" className="hover:text-white">Sign up</Link>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Connect</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-500">
                <span>Gmail</span>
                <span>Outlook</span>
              </div>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t landing-hairline pt-6 text-sm text-neutral-500">
            <span>© {new Date().getFullYear()} Relay</span>
            <div className="flex gap-6">
              <Link href="#product" className="hover:text-white">Product</Link>
              <Link href="#features" className="hover:text-white">Features</Link>
              <Link href="#faq" className="hover:text-white">FAQ</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
