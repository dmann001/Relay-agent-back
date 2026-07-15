"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Image, { type StaticImageData } from "next/image"
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
import { cn } from "@/lib/utils"
import relayStation from "@/asset_images/image 1.png"
import relayStation2 from "@/asset_images/im1.png"
import semaphoreTower from "@/asset_images/image 2-semaphore.png"
import semaphoreTower2 from "@/asset_images/im2.png"
import scriptoriumImage from "@/asset_images/im4.png"
import composeStillLife from "@/asset_images/im5.png"
import beaconTower from "@/asset_images/im6.png"
import footerImage from "@/asset_images/image3-last.png"

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

function Cross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={cn("landing-cross", className)} aria-hidden>
      <line x1="6" y1="0" x2="6" y2="12" />
      <line x1="0" y1="6" x2="12" y2="6" />
    </svg>
  )
}

function CrosshairCorners({ className }: { className?: string }) {
  return (
    <>
      <Cross className={cn("absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2", className)} />
      <Cross className={cn("absolute right-0 top-0 translate-x-1/2 -translate-y-1/2", className)} />
      <Cross className={cn("absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2", className)} />
      <Cross className={cn("absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2", className)} />
    </>
  )
}

function FigFlow({ className }: { className?: string }) {
  const { ref, isVisible } = useInView<SVGSVGElement>()

  const layer = (
    topY: number,
    label: string,
    delay: string,
    detailLines: [number, number][],
  ) => (
    <g key={label}>
      <polygon
        className={cn("landing-fig-fill landing-fig-stroke", delay)}
        points={`44,${topY + 18} 100,${topY} 156,${topY + 18} 100,${topY + 36}`}
      />
      {detailLines.map(([x1, x2], index) => (
        <line
          key={`${label}-${index}`}
          className="landing-fig-detail"
          x1={x1}
          y1={topY + 18}
          x2={x2}
          y2={topY + 18}
        />
      ))}
      <text className="landing-fig-label" x="100" y={topY + 22} textAnchor="middle">
        {label}
      </text>
    </g>
  )

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 132"
      className={cn("landing-fig mx-auto h-32 w-full max-w-[220px]", isVisible && "is-visible", className)}
      aria-hidden
    >
      <defs>
        <clipPath id="fig-flow-clip">
          <rect x="0" y="0" width="200" height="128" />
        </clipPath>
      </defs>
      <g className="landing-fig-idle" clipPath="url(#fig-flow-clip)">
        {layer(78, "Mail", "landing-fig-stroke-delay-1", [[58, 142]])}
        {layer(62, "Draft", "landing-fig-stroke-delay-2", [[64, 136]])}
        {layer(46, "Brief", "landing-fig-stroke-delay-3", [[70, 130]])}
        {layer(30, "Task", "landing-fig-stroke-delay-4", [[76, 124]])}
        <line className="landing-fig-stroke landing-fig-stroke-delay-5" x1="100" y1="30" x2="100" y2="10" />
        <circle className="landing-fig-node" cx="100" cy="8" r="3.5" />
        <line className="landing-fig-link landing-fig-stroke landing-fig-stroke-delay-5" x1="100" y1="66" x2="100" y2="34" />
        <circle className="landing-fig-flow-dot" cx="100" cy="72" r="2" />
        <circle className="landing-fig-flow-dot landing-fig-flow-dot-delay" cx="100" cy="78" r="1.5" />
        <line className="landing-fig-scan" x1="48" y1="58" x2="152" y2="58" />
      </g>
    </svg>
  )
}

function FigContext({ className }: { className?: string }) {
  const { ref, isVisible } = useInView<SVGSVGElement>()

  const card = (x: number, y: number, w: number, h: number, delay: string, label: string) => (
    <g key={label}>
      <rect className={cn("landing-fig-fill landing-fig-stroke", delay)} x={x} y={y} width={w} height={h} rx="2" />
      <line className="landing-fig-detail" x1={x + 8} y1={y + 10} x2={x + w - 8} y2={y + 10} />
      <line className="landing-fig-detail" x1={x + 8} y1={y + 18} x2={x + w - 16} y2={y + 18} />
      <line className="landing-fig-detail" x1={x + 8} y1={y + 26} x2={x + w - 24} y2={y + 26} />
      <text className="landing-fig-label" x={x + 8} y={y + h - 6}>
        {label}
      </text>
      <circle className="landing-fig-node" cx={x + w - 10} cy={y + 10} r="2" />
    </g>
  )

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 132"
      className={cn("landing-fig mx-auto h-32 w-full max-w-[220px]", isVisible && "is-visible", className)}
      aria-hidden
    >
      <g className="landing-fig-idle">
        {card(24, 34, 48, 40, "landing-fig-stroke-delay-1", "Email")}
        {card(128, 34, 48, 40, "landing-fig-stroke-delay-2", "Page")}
        <rect className="landing-fig-fill landing-fig-accent landing-fig-stroke landing-fig-stroke-delay-3" x="72" y="18" width="56" height="34" rx="3" />
        <line className="landing-fig-detail" x1="80" y1="28" x2="120" y2="28" />
        <line className="landing-fig-detail" x1="80" y1="36" x2="112" y2="36" />
        <line className="landing-fig-detail" x1="80" y1="44" x2="116" y2="44" />
        <text className="landing-fig-label" x="100" y="58" textAnchor="middle">
          Chat
        </text>
        <circle className="landing-fig-node" cx="100" cy="24" r="2.5" />
        <line className="landing-fig-link landing-fig-stroke landing-fig-stroke-delay-4" x1="72" y1="52" x2="48" y2="54" />
        <line className="landing-fig-link landing-fig-stroke landing-fig-stroke-delay-4" x1="128" y1="52" x2="152" y2="54" />
        <line className="landing-fig-link landing-fig-stroke landing-fig-stroke-delay-5" x1="100" y1="52" x2="100" y2="78" />
        <rect className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-5" x="68" y="78" width="64" height="28" rx="2" />
        <line className="landing-fig-detail" x1="76" y1="88" x2="124" y2="88" />
        <line className="landing-fig-detail" x1="76" y1="96" x2="116" y2="96" />
        <text className="landing-fig-label" x="100" y="112" textAnchor="middle">
          Context
        </text>
        <circle className="landing-fig-flow-dot" cx="86" cy="52" r="1.75" />
        <circle className="landing-fig-flow-dot landing-fig-flow-dot-delay" cx="114" cy="52" r="1.75" />
        <line className="landing-fig-scan" x1="44" y1="68" x2="156" y2="68" />
      </g>
    </svg>
  )
}

function FigControl({ className }: { className?: string }) {
  const { ref, isVisible } = useInView<SVGSVGElement>()

  const step = (x: number, y: number, h: number, delay: string, label: string) => (
    <g key={label}>
      <rect className={cn("landing-fig-fill landing-fig-stroke", delay)} x={x} y={y} width="18" height={h} rx="1" />
      <polygon
        className={cn("landing-fig-fill landing-fig-stroke", delay)}
        points={`${x + 18},${y} ${x + 26},${y - 6} ${x + 26},${y + h - 6} ${x + 18},${y + h}`}
      />
      <text className="landing-fig-label" x={x + 9} y={y + h + 12} textAnchor="middle">
        {label}
      </text>
    </g>
  )

  return (
    <svg
      ref={ref}
      viewBox="0 0 200 132"
      className={cn("landing-fig mx-auto h-32 w-full max-w-[220px]", isVisible && "is-visible", className)}
      aria-hidden
    >
      <defs>
        <clipPath id="fig-control-clip">
          <rect x="0" y="0" width="200" height="124" />
        </clipPath>
      </defs>
      <g className="landing-fig-idle" clipPath="url(#fig-control-clip)">
        <rect className="landing-fig-fill landing-fig-stroke landing-fig-stroke-delay-1" x="22" y="16" width="156" height="10" rx="1" />
        <line className="landing-fig-detail" x1="30" y1="21" x2="170" y2="21" />
        {step(34, 88, 22, "landing-fig-stroke-delay-1", "Read")}
        {step(58, 76, 34, "landing-fig-stroke-delay-2", "Draft")}
        {step(82, 62, 48, "landing-fig-stroke-delay-3", "Prep")}
        <rect className="landing-fig-fill landing-fig-accent landing-fig-gate landing-fig-stroke landing-fig-stroke-delay-4" x="108" y="44" width="24" height="66" rx="2" />
        <line className="landing-fig-stroke landing-fig-stroke-delay-4" x1="114" y1="54" x2="126" y2="66" />
        <line className="landing-fig-stroke landing-fig-stroke-delay-4" x1="126" y1="54" x2="114" y2="66" />
        <text className="landing-fig-label" x="120" y="118" textAnchor="middle">
          Approve
        </text>
        {step(140, 52, 58, "landing-fig-stroke-delay-5", "Send")}
        <circle className="landing-fig-node" cx="120" cy="60" r="2.5" />
        <line className="landing-fig-link landing-fig-stroke landing-fig-stroke-delay-3" x1="52" y1="99" x2="108" y2="77" />
        <line className="landing-fig-link landing-fig-stroke landing-fig-stroke-delay-4" x1="132" y1="77" x2="140" y2="81" />
        <line className="landing-fig-scan" x1="30" y1="36" x2="170" y2="36" />
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

const principleItems = [
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

function LandingImageHeader({
  src,
  imageClassName,
  sectionClassName,
  children,
}: {
  src: StaticImageData
  imageClassName?: string
  sectionClassName?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        "relative mx-auto flex max-w-7xl flex-col justify-start overflow-hidden px-6 py-24 md:py-32",
        sectionClassName,
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-black" aria-hidden>
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 1280px"
          className={cn("object-contain opacity-80", imageClassName)}
        />
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black via-black/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-[14%] bg-gradient-to-r from-black to-transparent" />
        <div className="absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-black to-transparent" />
      </div>
      <Reveal>
        <div className="relative z-10">{children}</div>
      </Reveal>
    </section>
  )
}

function PrincipleGrid() {
  return (
    <LandingImageHeader
      src={semaphoreTower2}
      imageClassName="object-[58%_58%]"
      sectionClassName="min-h-[min(92vw,620px)] md:min-h-[min(74vw,720px)] lg:min-h-[min(70vw,780px)]"
    >
      <h2 className="max-w-5xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_24px_rgb(0_0_0/0.9)]">
        A new species of email workspace.{" "}
        <span className="text-neutral-400">
          Purpose-built for modern teams with AI workflows at its core.
        </span>
      </h2>
    </LandingImageHeader>
  )
}

function ArchiveBridge() {
  return (
    <LandingImageHeader
      src={scriptoriumImage}
      imageClassName="object-[44%_52%]"
      sectionClassName="min-h-[min(88vw,580px)] md:min-h-[min(72vw,680px)] lg:min-h-[min(68vw,740px)]"
    >
      <h2 className="max-w-5xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_24px_rgb(0_0_0/0.9)]">
        Correspondence, refined for the age of agents.{" "}
        <span className="text-neutral-400">
          From the scriptorium to the inbox - written words endure.
        </span>
      </h2>
    </LandingImageHeader>
  )
}

function ComposeImageHeader() {
  return (
    <LandingImageHeader
      src={composeStillLife}
      imageClassName="object-[52%_50%]"
      sectionClassName="min-h-[min(78vw,480px)] md:min-h-[min(60vw,540px)] lg:min-h-[min(56vw,580px)]"
    >
      <h2 className="max-w-5xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_24px_rgb(0_0_0/0.9)]">
        The craft of the reply.{" "}
        <span className="text-neutral-400">
          Thread context in, polished draft out.
        </span>
      </h2>
    </LandingImageHeader>
  )
}

function MonitorImageHeader() {
  return (
    <LandingImageHeader
      src={beaconTower}
      imageClassName="object-[50%_64%]"
      sectionClassName="min-h-[min(90vw,620px)] md:min-h-[min(74vw,720px)] lg:min-h-[min(70vw,780px)]"
    >
      <h2 className="max-w-5xl text-[clamp(2rem,4.5vw,3.75rem)] font-semibold leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_24px_rgb(0_0_0/0.9)]">
        See every signal. Approve every action.{" "}
        <span className="text-neutral-400">
          Supervised agents, visible at every step.
        </span>
      </h2>
    </LandingImageHeader>
  )
}

function PrincipleFigureGrid() {
  return (
    <section className="relative border-y landing-hairline px-6 py-0">
      <div className="mx-auto max-w-7xl">
        <div className="relative grid overflow-hidden border-x landing-hairline bg-black/35 md:grid-cols-3 md:divide-x md:divide-white/[0.08]">
          <CrosshairCorners />
          {principleItems.map(({ fig, title, text, Figure }, index) => (
            <Reveal
              key={title}
              className="h-full"
              delayClass={index === 1 ? "landing-reveal-delay-1" : index === 2 ? "landing-reveal-delay-2" : undefined}
            >
              <div className="landing-principle-cell h-full min-h-[340px] bg-black/70 p-8 backdrop-blur-[1px]">
                <div className="landing-mono-label">{fig}</div>
                <div className="landing-fig-stage relative mt-12 flex h-36 items-center justify-center">
                  <div className="landing-fig-vignette" aria-hidden />
                  <Figure />
                </div>
                <h3 className="mt-14 text-base font-semibold text-white">{title}</h3>
                <p className="landing-body mt-3 max-w-sm text-sm">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureShowcase({ feature }: { feature: (typeof features)[number] }) {
  const { ref, isVisible } = useInView<HTMLElement>()

  return (
    <section ref={ref} className="relative border-t landing-hairline px-6 py-20 md:py-28">
      <Cross className="absolute left-6 top-0 -translate-x-1/2 -translate-y-1/2" />
      <div className="mx-auto max-w-7xl">
        <div className={cn("landing-reveal", isVisible && "is-visible")}>
          <Link
            href="#features"
            className="group mb-10 inline-flex items-center gap-2 landing-mono-label transition-colors hover:text-white"
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

function renderFeatureSections() {
  const sections: ReactNode[] = []

  features.forEach((feature) => {
    if (feature.eyebrow === "3.0 Compose") {
      sections.push(<ComposeImageHeader key="compose-image-header" />)
    }
    if (feature.eyebrow === "6.0 Monitor") {
      sections.push(<MonitorImageHeader key="monitor-image-header" />)
    }
    sections.push(<FeatureShowcase key={feature.title} feature={feature} />)
  })

  return sections
}

function RecentlyShipped() {
  const { ref, isVisible } = useInView<HTMLElement>()

  const cards = [
    {
      title: "Page-aware chat",
      description:
        "Relay chat reads the active page and selected email before answering, so every reply starts with the right context.",
      visual: (
        <div className="relative flex h-40 items-center justify-center overflow-hidden rounded-lg border landing-hairline landing-dotgrid">
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />
          <div className="relative rounded-lg border landing-hairline bg-black/80 px-4 py-3 text-left shadow-[0_0_40px_rgb(255_255_255/0.04)]">
            <p className="landing-mono-label mb-2">Context</p>
            <p className="text-sm text-white">@ Selected thread</p>
            <p className="mt-2 text-xs text-neutral-500">Ask about this email...</p>
          </div>
        </div>
      ),
    },
    {
      title: "Supervised agents",
      description:
        "Background agents classify, draft, and prepare work — then wait for explicit approval before anything sends.",
      visual: (
        <div className="relative flex h-40 flex-col justify-center gap-3 overflow-hidden rounded-lg border landing-hairline bg-black/40 px-5">
          {[
            { label: "classify()", ms: "120ms", width: "38%" },
            { label: "draft()", ms: "240ms", width: "62%" },
            { label: "approve()", ms: "80ms", width: "28%" },
          ].map(({ label, ms, width }, index) => (
            <div key={label} className="space-y-1.5">
              <div className="flex items-center justify-between landing-mono-label text-[10px]">
                <span>{label}</span>
                <span>{ms}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={cn(
                    "landing-bar h-full rounded-full",
                    index === 1 && "landing-bar-delay-1",
                    index === 2 && "landing-bar-delay-2",
                  )}
                  style={{ width }}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <section ref={ref} className="border-t landing-hairline px-6 py-24 md:py-32">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="landing-mono-label mb-6">What&apos;s new</p>
          <h2 className="landing-section-title max-w-2xl">Recently shipped</h2>
        </Reveal>

        <div
          className={cn(
            "relative mt-14 grid gap-px overflow-hidden border landing-hairline bg-white/[0.06] md:grid-cols-2",
            isVisible && "landing-animate-active",
          )}
        >
          <CrosshairCorners />
          {cards.map(({ title, description, visual }, index) => (
            <Reveal
              key={title}
              delayClass={index === 1 ? "landing-reveal-delay-1" : undefined}
              className="bg-black p-8 md:p-10"
            >
              {visual}
              <h3 className="mt-8 text-base font-semibold text-white">{title}</h3>
              <p className="landing-body mt-3 max-w-md text-sm">{description}</p>
            </Reveal>
          ))}
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
        <section id="product" className="relative isolate overflow-hidden px-6 pb-20 pt-32 md:pb-28 md:pt-40">
          <div
            className="pointer-events-none absolute right-4 top-24 z-0 h-[330px] w-[76vw] max-w-[960px] overflow-hidden md:right-8 md:top-24 md:h-[370px] md:w-[66vw] lg:right-12 lg:top-24 lg:h-[390px] lg:w-[58vw]"
            aria-hidden
          >
            <Image
              src={relayStation2}
              alt=""
              fill
              priority
              sizes="(max-width: 768px) 76vw, (max-width: 1024px) 66vw, 58vw"
              className="object-cover object-[48%_42%]"
            />
            <div className="absolute inset-y-0 left-0 w-[14%] bg-gradient-to-r from-black to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[10%] bg-gradient-to-l from-black to-transparent" />
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black to-transparent" />
          </div>
          <div className="absolute inset-x-0 bottom-0 z-[1] h-[42%] bg-black" aria-hidden />
          <div className="absolute inset-x-0 bottom-[40%] z-[1] h-28 bg-gradient-to-b from-transparent to-black" aria-hidden />
          <div className="relative z-10 mx-auto max-w-7xl">
            <div className={cn("transition-all duration-700", loaded ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0")}>
              <div className="grid items-end gap-10 lg:grid-cols-[1fr_0.42fr]">
                <div>
                  <h1 className="landing-hero-title max-w-5xl">
                    The inbox system for teams and agents
                  </h1>
                  <p className="landing-body mt-8 max-w-xl">
                    Relay unifies Gmail and Outlook with contextual AI for briefs, drafts, commitments, meeting prep, and supervised agent work.
                  </p>
                </div>
                <div className="flex flex-col items-start gap-5 lg:items-end">
                  <Link href="#features" className="group inline-flex items-center gap-2 text-sm font-medium text-neutral-100 drop-shadow-[0_2px_10px_rgb(0_0_0/0.9)] hover:text-white">
                    <span className="rounded-full bg-white px-2 py-1 text-xs text-neutral-950">New</span>
                    Relay page-aware chat
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Button asChild className="h-11 rounded-full bg-white px-5 text-neutral-950 hover:bg-neutral-200">
                    <Link href="/login?tab=signup">Start with Relay</Link>
                </Button>
                <div className="mt-2 hidden text-right leading-relaxed lg:block">
                  <p className="landing-mono-label text-neutral-300 drop-shadow-[0_2px_8px_rgb(0_0_0/0.95)]">Unified Gmail + Outlook</p>
                  <p className="landing-mono-label mt-1 text-neutral-300 drop-shadow-[0_2px_8px_rgb(0_0_0/0.95)]">Contextual AI briefs</p>
                  <p className="landing-mono-label mt-1 text-neutral-300 drop-shadow-[0_2px_8px_rgb(0_0_0/0.95)]">Supervised agent work</p>
                </div>
              </div>
              </div>
            </div>

            <div className={cn("relative mt-16 transition-all delay-200 duration-700", loaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")}>
              <div className="landing-hero-bloom" aria-hidden />
              <div className="relative overflow-hidden rounded-xl landing-panel p-3 md:p-4">
                <ProductMockup variant="hero" scene="inbox" />
              </div>
            </div>
          </div>
        </section>

        <PrincipleGrid />
        <PrincipleFigureGrid />
        <ArchiveBridge />

        <div id="features">
          {renderFeatureSections()}
        </div>

        <RecentlyShipped />

        <section id="faq" className="border-t landing-hairline px-6 py-24 md:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 md:grid-cols-[1fr_1.4fr] md:gap-16">
              <Reveal className="md:sticky md:top-28 md:self-start">
                <p className="landing-mono-label mb-6">Support</p>
                <h2 className="landing-section-title">Frequently asked questions</h2>
              </Reveal>
              <Accordion type="single" collapsible className="border-t landing-hairline">
                {faqs.map((faq, index) => (
                  <AccordionItem
                    key={faq.question}
                    value={`item-${index}`}
                    className="border-b landing-hairline px-0"
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
          </div>
        </section>

        <section className="px-6 pb-6">
          <Reveal>
            <div className="relative mx-auto min-h-[400px] max-w-7xl overflow-hidden rounded-xl landing-panel md:min-h-[440px] lg:min-h-[480px]">
              <CrosshairCorners />
              <Image
                src={footerImage}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 1280px"
                className="object-cover object-[50%_42%] opacity-80 scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />
              <div className="relative flex min-h-[400px] flex-col items-center justify-center px-6 py-10 text-center md:min-h-[440px] lg:min-h-[480px]">
                <p className="landing-mono-label mb-4 text-neutral-300">7.0 Start</p>
                <h2 className="landing-section-title max-w-3xl">
                  Put the next reply in motion.
                </h2>
                <p className="landing-body mt-5 max-w-xl">
                  Connect your mailbox and let Relay organize briefs, drafts, and follow-ups from one workspace.
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

      <footer className="relative z-10 border-t landing-hairline px-6 py-10">
        <Cross className="absolute left-6 top-0 -translate-x-1/2 -translate-y-1/2" />
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-[1.2fr_repeat(3,1fr)]">
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
              <p className="landing-mono-label">Product</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-500">
                <Link href="#product" className="hover:text-white">Overview</Link>
                <Link href="#features" className="inline-flex items-center gap-2 hover:text-white">
                  Features
                  <span className="rounded border landing-hairline px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-neutral-400">
                    New
                  </span>
                </Link>
                <Link href="#faq" className="hover:text-white">FAQ</Link>
              </div>
            </div>
            <div>
              <p className="landing-mono-label">Account</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-500">
                <Link href="/login" className="hover:text-white">Log in</Link>
                <Link href="/login?tab=signup" className="hover:text-white">Sign up</Link>
              </div>
            </div>
            <div>
              <p className="landing-mono-label">Connect</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-neutral-500">
                <span>Gmail</span>
                <span>Outlook</span>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t landing-hairline pt-5 text-sm text-neutral-500">
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
