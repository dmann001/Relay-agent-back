"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  CalendarDays,
  Check,
  CheckSquare,
  Inbox,
  Mail,
  NotebookTabs,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

/** Scaled-up sizes for landing mockups (readable at a glance) */
const mock = {
  chrome: {
    bar: "h-10",
    barInset: "2.5rem",
    dot: "h-2 w-2",
    title: "text-xs",
  },
  sidebar: {
    width: "w-[26%]",
    widthCompact: "w-[22%]",
    pad: "px-2 py-2.5",
    padCompact: "px-1.5 py-2",
    logo: "h-6 w-6",
    logoIcon: "h-3.5 w-3.5",
    brand: "text-xs",
    nav: "text-[11px]",
    navIcon: "h-3.5 w-3.5",
    navPad: "px-1.5 py-1",
    badge: "text-[10px] px-1",
  },
  t: {
    micro: "text-[8px]",
    xs: "text-[10px]",
    sm: "text-[11px]",
    base: "text-xs",
    lg: "text-sm",
  },
  pad: {
    header: "px-3 py-2",
    row: "px-2.5 py-2",
    card: "p-2",
    section: "p-2.5",
    btn: "px-2 py-1.5",
  },
  icon: {
    xs: "h-2.5 w-2.5",
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
    avatar: "h-5 w-5",
    avatarText: "text-[8px]",
    ai: "h-4 w-4",
    aiInner: "h-2.5 w-2.5",
  },
  cursor: { w: 22, h: 24, ring: "h-7 w-7" },
} as const

export type MockupScene =
  | "inbox"
  | "brief"
  | "thread"
  | "commitments"
  | "meetings"
  | "activity"

type HeroView = "list" | "thread"
type HeroPhase =
  | "enter"
  | "to-email"
  | "click-email"
  | "thread-open"
  | "to-draft"
  | "click-draft"
  | "hold"

const HERO_SEQUENCE: Array<{
  phase: HeroPhase
  delay: number
  view: HeroView
  draftVisible: boolean
  target: "start" | "email" | "draft"
  clicking: boolean
  selectedEmail: boolean
}> = [
  {
    phase: "enter",
    delay: 700,
    view: "list",
    draftVisible: false,
    target: "start",
    clicking: false,
    selectedEmail: false,
  },
  {
    phase: "to-email",
    delay: 1100,
    view: "list",
    draftVisible: false,
    target: "email",
    clicking: false,
    selectedEmail: false,
  },
  {
    phase: "click-email",
    delay: 350,
    view: "list",
    draftVisible: false,
    target: "email",
    clicking: true,
    selectedEmail: true,
  },
  {
    phase: "thread-open",
    delay: 1600,
    view: "thread",
    draftVisible: false,
    target: "email",
    clicking: false,
    selectedEmail: true,
  },
  {
    phase: "to-draft",
    delay: 900,
    view: "thread",
    draftVisible: false,
    target: "draft",
    clicking: false,
    selectedEmail: true,
  },
  {
    phase: "click-draft",
    delay: 350,
    view: "thread",
    draftVisible: true,
    target: "draft",
    clicking: true,
    selectedEmail: true,
  },
  {
    phase: "hold",
    delay: 2200,
    view: "thread",
    draftVisible: true,
    target: "draft",
    clicking: false,
    selectedEmail: true,
  },
]

type CursorPoint = { x: number; y: number }

function MacCursor({
  x,
  y,
  clicking = false,
  visible = true,
}: {
  x: number
  y: number
  clicking?: boolean
  visible?: boolean
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-40 transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    >
      <div
        className="absolute transition-all duration-500 ease-out"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transform: clicking ? "translate(-1px, -1px) scale(0.88)" : "translate(-1px, -1px)",
        }}
      >
        <svg
          width={mock.cursor.w}
          height={mock.cursor.h}
          viewBox="0 0 14 16"
          fill="none"
          className="landing-mockup-cursor"
        >
          <path
            d="M1 1L1 13.5L4.5 10.5L7 15.5L9 14.5L6.5 9.5L11 9.5L1 1Z"
            fill="white"
            stroke="#0a0a0a"
            strokeWidth="0.75"
          />
        </svg>
        <span
          className={cn(
            "absolute -left-1 -top-1 rounded-full border-2 border-white/40 transition-all duration-300",
            mock.cursor.ring,
            clicking ? "scale-150 opacity-50" : "scale-50 opacity-0",
          )}
        />
      </div>
    </div>
  )
}

function useAnimatedCursor(
  containerRef: React.RefObject<HTMLElement | null>,
  sequence: Array<{
    delay: number
    target: string
    clicking?: boolean
  }>,
  targetRefs: Record<string, React.RefObject<HTMLElement | null>>,
  fallback: Record<string, CursorPoint>,
) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const [positions, setPositions] = useState(fallback)

  const measureAll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const next: Record<string, CursorPoint> = { ...fallback }
    for (const [key, ref] of Object.entries(targetRefs)) {
      next[key] = measureTarget(container, ref.current, 0.4, 0.5)
    }
    setPositions(next)
  }, [containerRef, fallback, targetRefs])

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    measureAll()
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(measureAll)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, measureAll, step])

  const current = sequence[step % sequence.length]

  useEffect(() => {
    const timer = setTimeout(() => {
      setStep((value) => (value + 1) % sequence.length)
    }, current.delay)
    return () => clearTimeout(timer)
  }, [step, current.delay, sequence.length])

  const cursorPos = positions[current.target] ?? fallback.start

  return { visible, cursorPos, clicking: current.clicking ?? false }
}

function measureTarget(
  container: HTMLElement,
  element: HTMLElement | null,
  anchorX = 0.5,
  anchorY = 0.5,
): CursorPoint {
  if (!element) return { x: 50, y: 50 }
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return {
    x:
      ((elementRect.left - containerRect.left + elementRect.width * anchorX) /
        containerRect.width) *
      100,
    y:
      ((elementRect.top - containerRect.top + elementRect.height * anchorY) /
        containerRect.height) *
      100,
  }
}

function MockupFrame({
  children,
  variant,
  className,
}: {
  children: React.ReactNode
  variant: "hero" | "feature"
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        variant === "hero"
          ? "aspect-[16/9] min-h-[320px] rounded-xl sm:min-h-[380px] md:min-h-[440px]"
          : "h-full min-h-[280px] rounded-xl md:min-h-[300px]",
        variant === "feature"
          ? "border border-white/10 bg-[#0b0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_40px_-20px_rgba(0,0,0,0.85)]"
          : "border border-white/10 bg-[#0b0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b px-3",
          variant === "feature" ? "border-white/10 bg-[#090909]" : "border-neutral-100 bg-neutral-50",
          mock.chrome.bar,
        )}
      >
        <div className={cn("rounded-full bg-[#FF5F57]", mock.chrome.dot)} />
        <div className={cn("rounded-full bg-[#FEBC2E]", mock.chrome.dot)} />
        <div className={cn("rounded-full bg-[#28C840]", mock.chrome.dot)} />
        <span className={cn("ml-1 truncate", mock.chrome.title, variant === "feature" ? "text-neutral-500" : "text-neutral-400")}>
          Relay — Inbox
        </span>
      </div>
      <div
        className="relative flex min-h-0"
        style={{ height: `calc(100% - ${mock.chrome.barInset})` }}
      >
        {children}
      </div>
    </div>
  )
}

function MiniSidebar({ compact }: { compact?: boolean }) {
  const items = [
    { icon: Inbox, label: "Inbox", active: true, badge: "12" },
    { icon: Mail, label: "Sent" },
    { icon: CheckSquare, label: "Tasks" },
    { icon: NotebookTabs, label: "Briefs" },
    { icon: Bot, label: "Activity" },
  ]

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-neutral-100 bg-neutral-50/80",
        compact ? mock.sidebar.widthCompact : mock.sidebar.width,
        compact ? mock.sidebar.padCompact : mock.sidebar.pad,
      )}
    >
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md bg-neutral-900",
            mock.sidebar.logo,
          )}
        >
          <Mail className={cn("text-white", mock.sidebar.logoIcon)} />
        </div>
        {!compact && (
          <span
            className={cn(
              "truncate font-medium text-neutral-800",
              mock.sidebar.brand,
            )}
          >
            Relay
          </span>
        )}
      </div>
      <div className="space-y-1">
        {items.map(({ icon: Icon, label, active, badge }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-md",
              mock.sidebar.navPad,
              active ? "bg-white shadow-sm" : "text-neutral-400",
            )}
          >
            <Icon className={cn("shrink-0", mock.sidebar.navIcon)} />
            {!compact && (
              <>
                <span className={cn("truncate", mock.sidebar.nav)}>{label}</span>
                {badge && (
                  <span
                    className={cn(
                      "ml-auto rounded-md bg-neutral-900 text-white",
                      mock.sidebar.badge,
                      active && "landing-badge-pulse",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}

function HeroInteractiveMockup() {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLDivElement>(null)
  const draftBtnRef = useRef<HTMLDivElement>(null)
  const [cursorTargets, setCursorTargets] = useState<{
    start: CursorPoint
    email: CursorPoint
    draft: CursorPoint
  }>({
    start: { x: 70, y: 18 },
    email: { x: 55, y: 35 },
    draft: { x: 78, y: 58 },
  })
  const current = HERO_SEQUENCE[step % HERO_SEQUENCE.length]

  const measureCursorTargets = useCallback((view: HeroView) => {
    const container = containerRef.current
    if (!container) return

    const email = measureTarget(container, emailRef.current, 0.35, 0.5)
    const draft =
      view === "thread"
        ? measureTarget(container, draftBtnRef.current, 0.5, 0.5)
        : null

    setCursorTargets((prev) => ({
      start: {
        x: Math.min(email.x + 14, 92),
        y: Math.max(email.y - 16, 8),
      },
      email,
      draft: draft ?? prev.draft,
    }))
  }, [])

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(enterTimer)
  }, [])

  useEffect(() => {
    measureCursorTargets(current.view)
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() =>
      measureCursorTargets(current.view),
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [measureCursorTargets, current.view])

  useEffect(() => {
    const timer = setTimeout(() => {
      setStep((value) => (value + 1) % HERO_SEQUENCE.length)
    }, current.delay)
    return () => clearTimeout(timer)
  }, [step, current.delay])

  useEffect(() => {
    const frame = requestAnimationFrame(() => measureCursorTargets(current.view))
    return () => cancelAnimationFrame(frame)
  }, [step, current.view, measureCursorTargets])

  useEffect(() => {
    if (current.view !== "thread") return
    const timer = setTimeout(() => measureCursorTargets("thread"), 520)
    return () => clearTimeout(timer)
  }, [current.view, measureCursorTargets])

  const resetList = current.phase === "enter" && step > 0
  const cursorPos = cursorTargets[current.target]

  return (
    <MockupFrame variant="hero">
      <div
        ref={containerRef}
        className="relative flex min-h-0 min-w-0 flex-1"
      >
        <MiniSidebar />
        <div className="relative flex min-w-0 flex-1 flex-col bg-[#fafafa]">
          <div className={cn("flex items-center justify-between border-b border-neutral-100", mock.pad.header)}>
            <span className={cn("font-medium text-neutral-800", mock.t.base)}>
              Inbox
            </span>
            <div className={cn("flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white", mock.pad.btn)}>
              <Sparkles className={cn("text-neutral-600", mock.icon.sm)} />
              <span className={cn("text-neutral-500", mock.t.xs)}>Brief</span>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div
              className={cn(
                "absolute inset-0 flex flex-col p-2 transition-opacity duration-500 ease-out",
                current.view === "list"
                  ? "z-10 opacity-100"
                  : "pointer-events-none z-0 opacity-0",
                resetList && "duration-300",
              )}
            >
              <HeroEmailRow
                ref={emailRef}
                from="Sarah Chen"
                subject="Q2 budget review"
                snippet="Can you send the updated figures by Friday?"
                time="9:14 AM"
                unread
                selected={current.selectedEmail}
              />
            <HeroEmailRow
              from="Stripe"
              subject="Invoice #2041"
              snippet="Your payment receipt is ready"
              time="8:02 AM"
              unread
            />
            <HeroEmailRow
              from="Alex Rivera"
              subject="Project kickoff notes"
              snippet="Attached the timeline we discussed…"
              time="Yesterday"
            />
          </div>

          <div
            className={cn(
              "absolute inset-0 flex transition-opacity duration-500 ease-out",
              current.view === "thread"
                ? "z-10 opacity-100"
                : "pointer-events-none z-0 opacity-0",
            )}
          >
            <div className="flex min-w-0 flex-[3] flex-col border-r border-neutral-100 bg-white">
              <div className={cn("border-b border-neutral-100", mock.pad.header)}>
                <p className={cn("truncate font-medium text-neutral-900", mock.t.sm)}>
                  Re: Q2 budget review
                </p>
              </div>
              <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
                <div className={cn("rounded-md border border-neutral-100 bg-neutral-50", mock.pad.card)}>
                  <p className={cn("font-medium text-neutral-700", mock.t.xs)}>
                    Sarah Chen
                  </p>
                  <p className={cn("mt-1 leading-relaxed text-neutral-500", mock.t.xs)}>
                    Hi — can you send the updated Q2 figures by end of week?
                    Finance needs them for the board deck.
                  </p>
                </div>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    current.draftVisible
                      ? "max-h-36 opacity-100"
                      : "max-h-0 opacity-0",
                  )}
                >
                  <div className={cn("rounded-md border border-neutral-900/15 bg-neutral-50", mock.pad.card)}>
                    <p className={cn("font-medium text-neutral-500", mock.t.micro)}>
                      Draft reply
                    </p>
                    <p
                      className={cn(
                        "mt-1 leading-relaxed text-neutral-700",
                        mock.t.xs,
                        current.draftVisible && "landing-hero-typewriter",
                      )}
                    >
                      Thanks Sarah — I&apos;ll send the updated Q2 figures by
                      Friday EOD for the board deck.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-[2] flex-col bg-[#fafafa]">
              <div className={cn("flex items-center gap-1.5 border-b border-neutral-100", mock.pad.header)}>
                <div className={cn("flex items-center justify-center rounded-full bg-neutral-900", mock.icon.ai)}>
                  <Sparkles className={cn("text-white", mock.icon.aiInner)} />
                </div>
                <span className={cn("font-semibold text-neutral-800", mock.t.sm)}>
                  Relay AI
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
                <div className={cn("rounded-md bg-neutral-100", mock.pad.card)}>
                  <p className={cn("leading-relaxed text-neutral-600", mock.t.xs)}>
                    Sarah needs Q2 figures by Friday. Want me to draft a reply?
                  </p>
                </div>
                <div className="mt-auto shrink-0 pt-2">
                  <div
                    ref={draftBtnRef}
                    className={cn(
                      "flex w-full items-center justify-center gap-1.5 rounded-md border text-center transition-all duration-200",
                      mock.pad.btn,
                      current.draftVisible
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-neutral-900 bg-neutral-900 text-white shadow-sm",
                      current.phase === "to-draft" &&
                        !current.draftVisible &&
                        "landing-hero-btn-glow ring-2 ring-neutral-900/15",
                      current.phase === "click-draft" &&
                        current.clicking &&
                        "scale-[0.98]",
                    )}
                  >
                    {current.draftVisible ? (
                      <>
                        <Check className={mock.icon.sm} />
                        <span className={cn("font-medium", mock.t.xs)}>
                          Draft inserted
                        </span>
                      </>
                    ) : (
                      <span className={cn("font-medium", mock.t.xs)}>
                        Insert draft
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        <div
          className={cn(
            "pointer-events-none absolute inset-0 z-30 transition-opacity duration-300",
            visible ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        >
          <MacCursor x={cursorPos.x} y={cursorPos.y} clicking={current.clicking} visible={visible} />
        </div>
      </div>
    </MockupFrame>
  )
}

const HeroEmailRow = forwardRef<
  HTMLDivElement,
  {
    from: string
    subject: string
    snippet: string
    time: string
    unread?: boolean
    selected?: boolean
  }
>(function HeroEmailRow(
  { from, subject, snippet, time, unread, selected },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "mb-0.5 rounded-md border transition-all duration-200",
        mock.pad.row,
        selected
          ? "border-neutral-900/25 bg-white shadow-sm ring-1 ring-neutral-900/10"
          : "border-transparent bg-white/60",
        unread && !selected && "border-l-[3px] border-l-neutral-900",
      )}
    >
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "mt-0.5 flex shrink-0 items-center justify-center rounded-full bg-neutral-200 font-medium text-neutral-600",
            mock.icon.avatar,
            mock.icon.avatarText,
          )}
        >
          {from
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span
              className={cn(
                "truncate",
                mock.t.sm,
                unread ? "font-semibold text-neutral-900" : "text-neutral-600",
              )}
            >
              {from}
            </span>
            <span className={cn("shrink-0 text-neutral-400", mock.t.xs)}>
              {time}
            </span>
          </div>
          <p
            className={cn(
              "truncate",
              mock.t.sm,
              unread ? "font-medium text-neutral-800" : "text-neutral-600",
            )}
          >
            {subject}
          </p>
          <p className={cn("truncate text-neutral-400", mock.t.xs)}>
            {snippet}
          </p>
        </div>
      </div>
    </div>
  )
})

function DarkMiniSidebar({ compact }: { compact?: boolean }) {
  const items = [
    { icon: Inbox, label: "Inbox", active: true, badge: "12" },
    { icon: Mail, label: "Sent" },
    { icon: CheckSquare, label: "Tasks" },
    { icon: NotebookTabs, label: "Briefs" },
    { icon: Bot, label: "Activity" },
  ]

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-white/10 bg-[#090909]",
        compact ? mock.sidebar.widthCompact : mock.sidebar.width,
        compact ? mock.sidebar.padCompact : mock.sidebar.pad,
      )}
    >
      <div className="mb-2.5 flex items-center gap-1.5 px-0.5">
        <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-white", mock.sidebar.logo)}>
          <Mail className={cn("text-neutral-950", mock.sidebar.logoIcon)} />
        </div>
        {!compact && (
          <span className={cn("truncate font-medium text-white", mock.sidebar.brand)}>Relay</span>
        )}
      </div>
      <div className="space-y-1">
        {items.map(({ icon: Icon, label, active, badge }) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-1.5 rounded-md",
              mock.sidebar.navPad,
              active ? "bg-white/10 text-white" : "text-neutral-500",
            )}
          >
            <Icon className={cn("shrink-0", mock.sidebar.navIcon)} />
            {!compact && (
              <>
                <span className={cn("truncate", mock.sidebar.nav)}>{label}</span>
                {badge && (
                  <span className={cn("ml-auto rounded-md bg-white text-neutral-950", mock.sidebar.badge, active && "landing-badge-pulse")}>
                    {badge}
                  </span>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}

const HERO_CURSOR_SEQUENCE = [
  { delay: 900, target: "start" },
  { delay: 1100, target: "email" },
  { delay: 280, target: "email", clicking: true },
  { delay: 1200, target: "brief" },
  { delay: 280, target: "brief", clicking: true },
  { delay: 1000, target: "ask" },
  { delay: 280, target: "ask", clicking: true },
  { delay: 1800, target: "start" },
]

function HeroInboxDashboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const emailRef = useRef<HTMLDivElement>(null)
  const briefRef = useRef<HTMLButtonElement>(null)
  const askRef = useRef<HTMLButtonElement>(null)

  const targetRefs = useRef({
    email: emailRef,
    brief: briefRef,
    ask: askRef,
  }).current

  const fallback = useRef({
    start: { x: 72, y: 14 },
    email: { x: 48, y: 42 },
    brief: { x: 52, y: 22 },
    ask: { x: 82, y: 78 },
  }).current

  const { visible, cursorPos, clicking } = useAnimatedCursor(
    containerRef,
    HERO_CURSOR_SEQUENCE,
    targetRefs,
    fallback,
  )

  const messages = [
    { initials: "DH", from: "Dhruv", subject: "[Relay-agent-back] Run failed: lint", snippet: "Build output attached for review", time: "10:28 AM", tone: "bg-amber-400", active: true },
    { initials: "TP", from: "Tushar Gupta", subject: "Why State Governments' Cash Transfers Do...", snippet: "Strip away the cash-transfer details...", time: "9:51 AM", tone: "bg-pink-300" },
    { initials: "SU", from: "Substack", subject: "Richard Hanania posted...", snippet: "A new essay is ready for your reading list", time: "8:24 AM", tone: "bg-orange-400" },
    { initials: "MS", from: "Major League Soccer", subject: "Canada makes history ahead of Switzerland", snippet: "Plus Canada's goalscoring record", time: "8:10 AM", tone: "bg-cyan-300" },
    { initials: "GH", from: "GitHub", subject: "Pull request merged: landing polish", snippet: "Your PR #42 was merged into main", time: "Yesterday", tone: "bg-neutral-400" },
  ]

  return (
    <div
      ref={containerRef}
      className="landing-hero-product relative aspect-[16/9] min-h-[420px] overflow-hidden rounded-lg border border-white/10 bg-[#0b0b0c] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_28px_90px_-40px_rgba(0,0,0,0.9)] landing-animate-active"
    >
      <div className="landing-hero-glow landing-hero-glow-top" />
      <div className="landing-hero-glow landing-hero-glow-right" />
      <div className="landing-hero-glow landing-hero-glow-center" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.1),transparent_38%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,rgba(255,255,255,0.04),transparent_50%)]" />

      <div className="relative flex h-full min-h-0">
        <aside className="hidden w-[17%] min-w-[180px] border-r border-white/10 bg-[#090909] p-4 text-neutral-400 md:block">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[11px] font-bold text-neutral-950">DH</div>
            Dhruv Mann
          </div>
          <div className="mt-6 space-y-1.5 text-sm">
            {[
              { label: "Inbox", count: "83", icon: Inbox, active: true },
              { label: "Sent", count: "52", icon: Send },
              { label: "Drafts", count: "45", icon: Mail },
            ].map(({ label, count, icon: Icon, active }) => (
              <div key={label} className={cn("flex items-center gap-2 rounded-md px-2 py-2", active ? "bg-white/10 text-white" : "text-neutral-400")}>
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                <span className="ml-auto text-xs text-neutral-500">{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-xs text-neutral-500">Workspace</div>
          <div className="mt-2 space-y-1.5 text-sm">
            {[
              { label: "Calendar", icon: CalendarDays },
              { label: "Commitments", icon: CheckSquare },
              { label: "Meeting briefs", icon: NotebookTabs },
              { label: "Activity", icon: Bot },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2 rounded-md px-2 py-2 text-neutral-400">
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </div>
        </aside>

        <section className="flex w-[38%] min-w-[330px] flex-col border-r border-white/10 bg-[#101010]">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-neutral-500">
                <Search className="h-4 w-4" />
                Search emails...
              </div>
              <button className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-neutral-950">
                <Mail className="h-4 w-4" />
                Compose
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">All accounts</div>
                <div className="text-xs text-neutral-500">83 unread · 370 total</div>
              </div>
              <div className="flex items-center gap-3 text-neutral-400">
                <button ref={briefRef} type="button" className="landing-feature-glow-dark flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1">
                  <Sparkles className="h-4 w-4 text-white" />
                  <span className="text-xs font-medium text-white">Brief</span>
                </button>
                <Bot className="h-4 w-4" />
                <RefreshCw className="h-4 w-4 landing-spin-slow" />
              </div>
            </div>
            <div className="mt-4 flex gap-1 text-xs font-medium text-neutral-500">
              {["All", "Primary", "Updates", "Promotions"].map((tab) => (
                <span key={tab} className={cn("rounded-md px-3 py-1.5", tab === "All" ? "bg-white/10 text-white" : "")}>{tab}</span>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {messages.map((message, index) => (
              <div
                key={message.subject}
                ref={index === 0 ? emailRef : undefined}
                className={cn(
                  "flex gap-3 border-b border-white/10 px-4 py-3 transition-colors",
                  message.active ? "landing-feature-row-pulse-dark bg-white/[0.06]" : "bg-transparent",
                )}
              >
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-neutral-950", message.tone)}>{message.initials}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">{message.from}</span>
                    <span className="ml-auto shrink-0 text-xs text-neutral-500">{message.time}</span>
                  </div>
                  <div className="truncate text-sm font-medium text-white">{message.subject}</div>
                  <div className="truncate text-xs text-neutral-500">{message.snippet}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative hidden min-w-0 flex-1 flex-col bg-[#080808] lg:flex">
          <div className="flex h-full items-center justify-center p-8 text-center">
            <div>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <h3 className="mt-5 text-xl font-semibold text-white">Select an email to read</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">Your inbox stays in place while you move through messages.</p>
            </div>
          </div>
          <div className="absolute bottom-5 right-5">
            <button ref={askRef} type="button" className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-neutral-950 shadow-lg shadow-black/40">
              <Send className="h-4 w-4" />
              Ask Relay
            </button>
          </div>
        </section>
      </div>

      <MacCursor x={cursorPos.x} y={cursorPos.y} clicking={clicking} visible={visible} />
    </div>
  )
}

function FeatureSceneShell({
  children,
  sequence,
  targetRefs,
  fallback,
}: {
  children: React.ReactNode
  sequence: Array<{ delay: number; target: string; clicking?: boolean }>
  targetRefs: Record<string, React.RefObject<HTMLElement | null>>
  fallback: Record<string, CursorPoint>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { visible, cursorPos, clicking } = useAnimatedCursor(
    containerRef,
    sequence,
    targetRefs,
    fallback,
  )

  return (
    <div ref={containerRef} className="relative flex min-h-0 min-w-0 flex-1 landing-animate-active">
      {children}
      <MacCursor x={cursorPos.x} y={cursorPos.y} clicking={clicking} visible={visible} />
    </div>
  )
}

function InboxScene({ compact }: { compact?: boolean }) {
  const emailRef = useRef<HTMLDivElement>(null)
  const briefRef = useRef<HTMLButtonElement>(null)
  const targetRefs = useRef({ email: emailRef, brief: briefRef }).current
  const fallback = useRef({
    start: { x: 68, y: 18 },
    email: { x: 52, y: 38 },
    brief: { x: 78, y: 14 },
  }).current
  const sequence = [
    { delay: 800, target: "start" },
    { delay: 1000, target: "email" },
    { delay: 260, target: "email", clicking: true },
    { delay: 900, target: "brief" },
    { delay: 260, target: "brief", clicking: true },
    { delay: 1400, target: "start" },
  ]

  return (
    <FeatureSceneShell sequence={sequence} targetRefs={targetRefs} fallback={fallback}>
      <DarkMiniSidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#101010]">
        <div className={cn("flex items-center justify-between border-b border-white/10", mock.pad.header)}>
          <span className={cn("font-medium text-white", mock.t.base)}>Inbox</span>
          <button ref={briefRef} type="button" className={cn("landing-feature-glow-dark flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04]", mock.pad.btn)}>
            <Sparkles className={cn("text-white", mock.icon.sm)} />
            <span className={cn("text-neutral-300", mock.t.xs)}>Brief</span>
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-hidden p-2">
          <div ref={emailRef} className={cn("landing-feature-row-pulse-dark rounded-md border border-white/10 bg-white/[0.06]", mock.pad.row)}>
            <div className="flex items-start gap-2">
              <div className={cn("mt-0.5 flex items-center justify-center rounded-full bg-amber-400 font-medium text-neutral-950", mock.icon.avatar, mock.icon.avatarText)}>SC</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className={cn("font-semibold text-white", mock.t.sm)}>Sarah Chen</span>
                  <span className={cn("text-neutral-500", mock.t.xs)}>9:14 AM</span>
                </div>
                <p className={cn("font-medium text-white", mock.t.sm)}>Q2 budget review</p>
                <p className={cn("truncate text-neutral-500", mock.t.xs)}>Can you send updated figures by Friday?</p>
              </div>
            </div>
          </div>
          {[
            { from: "Stripe", subject: "Invoice #2041", time: "8:02 AM", tone: "bg-neutral-500" },
            { from: "Alex Rivera", subject: "Project kickoff notes", time: "Yesterday", tone: "bg-cyan-400" },
          ].map((row) => (
            <div key={row.subject} className={cn("rounded-md border border-transparent bg-white/[0.03]", mock.pad.row)}>
              <div className="flex items-start gap-2">
                <div className={cn("mt-0.5 rounded-full", mock.icon.avatar, row.tone)} />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <span className={cn("text-neutral-400", mock.t.sm)}>{row.from}</span>
                    <span className={cn("text-neutral-600", mock.t.xs)}>{row.time}</span>
                  </div>
                  <p className={cn("text-neutral-300", mock.t.sm)}>{row.subject}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeatureSceneShell>
  )
}

function BriefScene({ compact }: { compact?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const targetRefs = useRef({ card: cardRef }).current
  const fallback = useRef({ start: { x: 62, y: 20 }, card: { x: 48, y: 42 } }).current
  const sequence = [
    { delay: 800, target: "start" },
    { delay: 1100, target: "card" },
    { delay: 280, target: "card", clicking: true },
    { delay: 1600, target: "start" },
  ]

  return (
    <FeatureSceneShell sequence={sequence} targetRefs={targetRefs} fallback={fallback}>
      <DarkMiniSidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#101010]">
        <div className={cn("flex items-center gap-1.5 border-b border-white/10", mock.pad.header)}>
          <Sparkles className={cn("text-white", mock.icon.md)} />
          <span className={cn("font-semibold text-white", mock.t.base)}>Inbox brief</span>
          <span className={cn("ml-auto rounded-full bg-white/10 px-2 py-0.5 text-neutral-400", mock.t.xs)}>Live</span>
        </div>
        <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
          <div ref={cardRef} className={cn("landing-feature-glow-dark rounded-lg border border-white/10 bg-white/[0.04]", mock.pad.section)}>
            <p className={cn("font-semibold text-white", mock.t.sm)}>Today at a glance</p>
            <p className={cn("mt-1 leading-relaxed text-neutral-400", mock.t.xs)}>3 threads need replies · 1 deadline today · 2 meetings</p>
            <div className="mt-2 flex gap-2">
              {["Reply", "Deadline", "Meeting"].map((tag) => (
                <span key={tag} className={cn("rounded-md bg-white/10 px-1.5 py-0.5 text-neutral-300", mock.t.micro)}>{tag}</span>
              ))}
            </div>
          </div>
          <div className="landing-feature-stagger-1">
            <p className={cn("mb-1 font-semibold text-neutral-400", mock.t.xs)}>Needs a reply</p>
            <div className={cn("rounded-md border border-white/10 bg-white/[0.03]", mock.pad.card)}>
              <p className={cn("font-medium text-white", mock.t.sm)}>Q2 budget review</p>
              <p className={cn("text-neutral-500", mock.t.xs)}>Sarah asked for updated figures</p>
            </div>
          </div>
          {!compact && (
            <div className="landing-feature-stagger-2">
              <p className={cn("mb-1 font-semibold text-neutral-400", mock.t.xs)}>Deadlines</p>
              <div className={cn("rounded-md border border-white/10 bg-white/[0.03]", mock.pad.card)}>
                <p className={cn("text-neutral-200", mock.t.sm)}>Board deck review</p>
                <p className={cn("text-amber-400/90", mock.t.xs)}>Due today, 5:00 PM</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </FeatureSceneShell>
  )
}

function ThreadScene({ compact }: { compact?: boolean }) {
  const draftRef = useRef<HTMLButtonElement>(null)
  const targetRefs = useRef({ draft: draftRef }).current
  const fallback = useRef({ start: { x: 70, y: 22 }, draft: { x: 78, y: 72 } }).current
  const sequence = [
    { delay: 800, target: "start" },
    { delay: 1100, target: "draft" },
    { delay: 280, target: "draft", clicking: true },
    { delay: 1600, target: "start" },
  ]

  return (
    <FeatureSceneShell sequence={sequence} targetRefs={targetRefs} fallback={fallback}>
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-[3] flex-col border-r border-white/10 bg-[#0d0d0d]">
          <div className={cn("border-b border-white/10", mock.pad.header)}>
            <p className={cn("truncate font-medium text-white", mock.t.sm)}>Re: Q2 budget review</p>
            <p className={cn("text-neutral-500", mock.t.xs)}>Sarah Chen · 3 messages</p>
          </div>
          <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
            <div className={cn("rounded-md border border-white/10 bg-white/[0.03]", mock.pad.card)}>
              <p className={cn("font-medium text-neutral-300", mock.t.xs)}>Sarah Chen</p>
              <p className={cn("mt-1 leading-relaxed text-neutral-500", mock.t.xs)}>Can you send the updated Q2 figures by end of week?</p>
            </div>
            <div className={cn("rounded-md border border-white/10 bg-white/[0.02] opacity-70", mock.pad.card)}>
              <p className={cn("font-medium text-neutral-400", mock.t.xs)}>You</p>
              <p className={cn("mt-1 text-neutral-600", mock.t.xs)}>Reviewing numbers now…</p>
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-[2] flex-col bg-[#101010]">
          <div className={cn("flex items-center gap-1.5 border-b border-white/10", mock.pad.header)}>
            <div className={cn("flex items-center justify-center rounded-full bg-white", mock.icon.ai)}>
              <Sparkles className={cn("text-neutral-950", mock.icon.aiInner)} />
            </div>
            <span className={cn("font-semibold text-white", mock.t.sm)}>Relay AI</span>
          </div>
          <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", mock.pad.card)}>
            <div className={cn("landing-feature-slide-in rounded-md border border-white/10 bg-white/[0.04]", mock.pad.card)}>
              <p className={cn("text-neutral-300", mock.t.xs)}>Sarah needs Q2 figures by Friday. Want me to draft a reply?</p>
            </div>
            <div className="landing-feature-typing flex items-center gap-1 px-2 py-1.5">
              <span className={cn("landing-typing-dot rounded-full bg-neutral-500", mock.icon.xs)} />
              <span className={cn("landing-typing-dot rounded-full bg-neutral-500", mock.icon.xs)} />
              <span className={cn("landing-typing-dot rounded-full bg-neutral-500", mock.icon.xs)} />
            </div>
            {!compact && (
              <div className="mt-auto shrink-0 pt-2">
                <button ref={draftRef} type="button" className={cn("landing-hero-btn-glow flex w-full items-center justify-center rounded-md border border-white bg-white text-center", mock.pad.btn)}>
                  <span className={cn("font-medium text-neutral-950", mock.t.xs)}>Insert draft</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </FeatureSceneShell>
  )
}

function CommitmentsScene({ compact }: { compact?: boolean }) {
  const checkRef = useRef<HTMLDivElement>(null)
  const targetRefs = useRef({ check: checkRef }).current
  const fallback = useRef({ start: { x: 58, y: 24 }, check: { x: 42, y: 46 } }).current
  const sequence = [
    { delay: 800, target: "start" },
    { delay: 1000, target: "check" },
    { delay: 280, target: "check", clicking: true },
    { delay: 1600, target: "start" },
  ]

  const items = [
    { title: "Send Q2 budget to Sarah", due: "Fri, Jun 20" },
    { title: "Follow up on contract redlines", due: "Mon, Jun 23" },
    { title: "Waiting for Alex — timeline PDF", due: "No due date" },
  ]

  return (
    <FeatureSceneShell sequence={sequence} targetRefs={targetRefs} fallback={fallback}>
      <DarkMiniSidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#101010]">
        <div className={cn("flex items-center justify-between border-b border-white/10", mock.pad.header)}>
          <span className={cn("font-semibold text-white", mock.t.base)}>Commitments</span>
          <span className={cn("rounded-full bg-white/10 text-neutral-400", mock.t.xs, "px-2 py-0.5")}>3 open</span>
        </div>
        <div className={cn("flex-1 space-y-1.5 overflow-hidden", mock.pad.section)}>
          {items.map((item, index) => (
            <div key={item.title} className={cn("flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.03]", mock.pad.card)}>
              <div
                ref={index === 0 ? checkRef : undefined}
                className={cn(
                  "mt-0.5 flex shrink-0 items-center justify-center rounded border border-white/20 bg-transparent",
                  mock.icon.sm,
                  index === 0 && "landing-feature-check",
                )}
              >
                {index === 0 && (
                  <CheckSquare className={cn("text-neutral-950 opacity-0 landing-feature-check-icon", mock.icon.xs)} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium text-white", mock.t.sm, index === 0 && "landing-feature-check-text")}>{item.title}</p>
                {!compact && <span className={cn("text-neutral-500", mock.t.xs)}>{item.due}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </FeatureSceneShell>
  )
}

function MeetingsScene({ compact }: { compact?: boolean }) {
  const briefRef = useRef<HTMLDivElement>(null)
  const targetRefs = useRef({ brief: briefRef }).current
  const fallback = useRef({ start: { x: 60, y: 20 }, brief: { x: 50, y: 55 } }).current
  const sequence = [
    { delay: 800, target: "start" },
    { delay: 1100, target: "brief" },
    { delay: 280, target: "brief", clicking: true },
    { delay: 1600, target: "start" },
  ]

  return (
    <FeatureSceneShell sequence={sequence} targetRefs={targetRefs} fallback={fallback}>
      <DarkMiniSidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#101010]">
        <div className={cn("flex items-center gap-1.5 border-b border-white/10", mock.pad.header)}>
          <NotebookTabs className={cn("text-white", mock.icon.md)} />
          <span className={cn("font-semibold text-white", mock.t.base)}>Meeting brief</span>
        </div>
        <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
          <div className={cn("rounded-md border border-white/10 bg-white/[0.04]", mock.pad.card)}>
            <p className={cn("font-semibold text-white", mock.t.sm)}>Board sync — Today 2:00 PM</p>
            <p className={cn("text-neutral-500", mock.t.xs)}>4 attendees · 45 min · Zoom</p>
          </div>
          <div ref={briefRef} className={cn("landing-feature-reveal space-y-1 rounded-md border border-white/10 bg-white/[0.03]", mock.pad.card)}>
            <p className={cn("text-neutral-300 landing-feature-reveal-line", mock.t.xs)}>• Q2 budget figures due before meeting</p>
            <p className={cn("text-neutral-300 landing-feature-reveal-line", mock.t.xs)}>• Contract redlines pending legal review</p>
            {!compact && (
              <p className={cn("text-neutral-500 landing-feature-reveal-line", mock.t.xs)}>Open with budget timeline, flag vendor blocker.</p>
            )}
          </div>
        </div>
      </div>
    </FeatureSceneShell>
  )
}

function ActivityScene({ compact }: { compact?: boolean }) {
  const approveRef = useRef<HTMLButtonElement>(null)
  const targetRefs = useRef({ approve: approveRef }).current
  const fallback = useRef({ start: { x: 64, y: 18 }, approve: { x: 52, y: 62 } }).current
  const sequence = [
    { delay: 800, target: "start" },
    { delay: 1100, target: "approve" },
    { delay: 280, target: "approve", clicking: true },
    { delay: 1600, target: "start" },
  ]

  return (
    <FeatureSceneShell sequence={sequence} targetRefs={targetRefs} fallback={fallback}>
      <DarkMiniSidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#101010]">
        <div className={cn("flex items-center gap-1.5 border-b border-white/10", mock.pad.header)}>
          <Bot className={cn("text-white", mock.icon.md)} />
          <span className={cn("font-semibold text-white", mock.t.base)}>Agent activity</span>
        </div>
        <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
          <div className={cn("rounded-md border border-white/10 bg-white/[0.02] opacity-70", mock.pad.card)}>
            <p className={cn("text-neutral-500", mock.t.xs)}>Completed · 2m ago</p>
            <p className={cn("text-neutral-300", mock.t.xs)}>Archived 12 promotional newsletters</p>
          </div>
          <div className={cn("landing-feature-approval rounded-md border border-amber-500/30 bg-amber-500/[0.06]", mock.pad.card)}>
            <div className="flex items-center gap-1.5">
              <div className={cn("animate-pulse rounded-full bg-amber-400", mock.icon.xs)} />
              <span className={cn("text-amber-300/90", mock.t.xs)}>Awaiting approval</span>
            </div>
            <p className={cn("mt-1 text-neutral-200", mock.t.xs)}>Draft reply to Sarah — Q2 budget review</p>
            <div className="mt-2 flex gap-1">
              <button ref={approveRef} type="button" className={cn("landing-feature-approve-btn flex-1 rounded-md bg-white text-center", mock.pad.btn)}>
                <span className={cn("font-medium text-neutral-950", mock.t.xs)}>Approve</span>
              </button>
              <div className={cn("flex-1 rounded-md border border-white/10 bg-white/[0.03] text-center", mock.pad.btn)}>
                <span className={cn("text-neutral-400", mock.t.xs)}>Edit</span>
              </div>
            </div>
          </div>
          {!compact && (
            <div className={cn("rounded-md border border-white/10 bg-white/[0.02] opacity-50", mock.pad.card)}>
              <p className={cn("text-neutral-500", mock.t.xs)}>Extracted task: Send Q2 budget to Sarah</p>
            </div>
          )}
        </div>
      </div>
    </FeatureSceneShell>
  )
}

function SceneContent({
  scene,
  compact,
}: {
  scene: MockupScene
  compact?: boolean
}) {
  switch (scene) {
    case "inbox":
      return <InboxScene compact={compact} />
    case "brief":
      return <BriefScene compact={compact} />
    case "thread":
      return <ThreadScene compact={compact} />
    case "commitments":
      return <CommitmentsScene compact={compact} />
    case "meetings":
      return <MeetingsScene compact={compact} />
    case "activity":
      return <ActivityScene compact={compact} />
  }
}

export function ProductMockup({
  variant,
  scene = "inbox",
  animate = false,
}: {
  variant: "hero" | "feature"
  scene?: MockupScene
  animate?: boolean
}) {
  if (variant === "hero") {
    return scene === "activity" ? <HeroInteractiveMockup /> : <HeroInboxDashboard />
  }

  return (
    <div className={cn("h-full", animate && "landing-animate-active")}>
      <MockupFrame
        variant="feature"
        className={cn(`landing-feature-${scene}`, "h-full")}
      >
        <SceneContent scene={scene} compact={false} />
      </MockupFrame>
    </div>
  )
}

export const featureMockupScenes: Record<string, MockupScene> = {
  "Unified inbox": "inbox",
  "Inbox brief": "brief",
  "Thread assistant": "thread",
  Commitments: "commitments",
  "Meeting briefs": "meetings",
  "Agent activity": "activity",
}
