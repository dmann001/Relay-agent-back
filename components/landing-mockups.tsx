"use client"

import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import {
  Bot,
  Check,
  CheckSquare,
  Inbox,
  Mail,
  NotebookTabs,
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
        "relative w-full overflow-hidden border border-neutral-200/70 bg-white shadow-[0_12px_40px_-20px_rgba(0,0,0,0.08)]",
        variant === "hero"
          ? "aspect-[4/3] min-h-[320px] rounded-2xl sm:min-h-[380px] md:min-h-[440px]"
          : "h-full min-h-[280px] rounded-2xl md:min-h-[300px]",
        className,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-3",
          mock.chrome.bar,
        )}
      >
        <div className={cn("rounded-full bg-[#FF5F57]", mock.chrome.dot)} />
        <div className={cn("rounded-full bg-[#FEBC2E]", mock.chrome.dot)} />
        <div className={cn("rounded-full bg-[#28C840]", mock.chrome.dot)} />
        <span className={cn("ml-1 truncate text-neutral-400", mock.chrome.title)}>
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
          <div
            className="absolute transition-all duration-500 ease-out"
            style={{
              left: `${cursorPos.x}%`,
              top: `${cursorPos.y}%`,
              transform: current.clicking
                ? "translate(-1px, -1px) scale(0.9)"
                : "translate(-1px, -1px)",
            }}
          >
            <svg
              width={mock.cursor.w}
              height={mock.cursor.h}
              viewBox="0 0 14 16"
              fill="none"
              className="drop-shadow-md"
            >
              <path
                d="M1 1L1 13.5L4.5 10.5L7 15.5L9 14.5L6.5 9.5L11 9.5L1 1Z"
                fill="#0a0a0a"
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className={cn(
                "absolute -left-1 -top-1 rounded-full border-2 border-neutral-900/30 transition-all duration-300",
                mock.cursor.ring,
                current.clicking
                  ? "scale-150 opacity-60"
                  : "scale-50 opacity-0",
              )}
            />
          </div>
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
function InboxScene({ compact }: { compact?: boolean }) {
  return (
    <>
      <MiniSidebar compact={compact} />
      <div className="flex min-w-0 flex-1 flex-col bg-[#fafafa]">
        <div className={cn("flex items-center justify-between border-b border-neutral-100", mock.pad.header)}>
          <span className={cn("font-medium text-neutral-800", mock.t.base)}>Inbox</span>
          <div className={cn("landing-feature-shimmer flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white", mock.pad.btn)}>
            <Sparkles className={cn("text-neutral-600", mock.icon.sm)} />
            <span className={cn("text-neutral-500", mock.t.xs)}>Brief</span>
          </div>
        </div>
        <div className="flex-1 space-y-0.5 overflow-hidden p-2">
          <div className={cn("landing-feature-row-pulse rounded-md border border-transparent bg-white/60", mock.pad.row)}>
            <div className="flex items-start gap-2">
              <div className={cn("mt-0.5 rounded-full bg-neutral-200", mock.icon.avatar)} />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="h-2 w-2/3 rounded bg-neutral-800/80" />
                <div className="h-1.5 w-full rounded bg-neutral-300" />
                <div className="h-1.5 w-4/5 rounded bg-neutral-200" />
              </div>
            </div>
          </div>
          {[0, 1].map((index) => (
            <div
              key={index}
              className={cn("rounded-md border border-transparent bg-white/60", mock.pad.row)}
              style={{ opacity: 0.55 - index * 0.1 }}
            >
              <div className="flex items-start gap-2">
                <div className={cn("mt-0.5 rounded-full bg-neutral-200", mock.icon.avatar)} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="h-2 w-1/2 rounded bg-neutral-400" />
                  <div className="h-1.5 w-5/6 rounded bg-neutral-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function BriefScene({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className={cn("flex items-center gap-1.5 border-b border-neutral-100", mock.pad.header)}>
        <Sparkles className={cn("text-neutral-700", mock.icon.md)} />
        <span className={cn("font-semibold text-neutral-900", mock.t.base)}>
          Inbox brief
        </span>
      </div>
      <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
        <div className={cn("landing-feature-glow rounded-lg border border-neutral-200 bg-neutral-50", mock.pad.section)}>
          <p className={cn("font-semibold text-neutral-800", mock.t.sm)}>
            Today at a glance
          </p>
          <p className={cn("mt-1 leading-relaxed text-neutral-500", mock.t.xs)}>
            3 threads need replies. 1 deadline today.
          </p>
        </div>
        <div className="landing-feature-stagger-1">
          <p className={cn("mb-1 font-semibold text-neutral-700", mock.t.xs)}>
            Needs a reply
          </p>
          <div className={cn("rounded-md border border-neutral-200 bg-white", mock.pad.card)}>
            <p className={cn("font-medium text-neutral-900", mock.t.sm)}>
              Q2 budget review
            </p>
            <p className={cn("text-neutral-400", mock.t.xs)}>
              Sarah asked for updated figures
            </p>
          </div>
        </div>
        {!compact && (
          <div className="landing-feature-stagger-2">
            <p className={cn("mb-1 font-semibold text-neutral-700", mock.t.xs)}>
              Deadlines
            </p>
            <div className={cn("rounded-md border border-neutral-100 bg-white/80", mock.pad.card)}>
              <p className={cn("text-neutral-700", mock.t.sm)}>Board deck review</p>
              <p className={cn("text-red-500", mock.t.xs)}>Due today, 5:00 PM</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ThreadScene({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-[3] flex-col border-r border-neutral-100 bg-white">
        <div className={cn("border-b border-neutral-100", mock.pad.header)}>
          <p className={cn("truncate font-medium text-neutral-900", mock.t.sm)}>
            Re: Q2 budget review
          </p>
        </div>
        <div className={mock.pad.section}>
          <div className={cn("rounded-md border border-neutral-100 bg-neutral-50", mock.pad.card)}>
            <p className={cn("font-medium text-neutral-700", mock.t.xs)}>Sarah Chen</p>
            <p className={cn("mt-1 leading-relaxed text-neutral-500", mock.t.xs)}>
              Can you send the updated Q2 figures by end of week?
            </p>
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
        <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.card)}>
          <div className={cn("landing-feature-slide-in rounded-md bg-neutral-100", mock.pad.card)}>
            <p className={cn("text-neutral-600", mock.t.xs)}>
              Want me to draft a concise reply?
            </p>
          </div>
          <div className="landing-feature-typing flex items-center gap-1 px-2 py-1.5">
            <span className={cn("landing-typing-dot rounded-full bg-neutral-400", mock.icon.xs)} />
            <span className={cn("landing-typing-dot rounded-full bg-neutral-400", mock.icon.xs)} />
            <span className={cn("landing-typing-dot rounded-full bg-neutral-400", mock.icon.xs)} />
          </div>
          {!compact && (
            <div className={cn("rounded-md bg-neutral-900 text-center opacity-40", mock.pad.btn)}>
              <span className={cn("font-medium text-white", mock.t.xs)}>
                Insert draft
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommitmentsScene({ compact }: { compact?: boolean }) {
  const items = [
    { title: "Send Q2 budget to Sarah", due: "Fri, Jun 20" },
    { title: "Follow up on contract redlines", due: "Mon, Jun 23" },
    { title: "Waiting for Alex — timeline PDF", due: "No due date" },
  ]

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className={cn("flex items-center justify-between border-b border-neutral-100", mock.pad.header)}>
        <span className={cn("font-semibold text-neutral-900", mock.t.base)}>
          Commitments
        </span>
        <span className={cn("rounded-full bg-neutral-100 text-neutral-500", mock.t.xs, "px-2 py-0.5")}>
          3 open
        </span>
      </div>
      <div className={cn("flex-1 space-y-1.5 overflow-hidden", mock.pad.section)}>
        {items.map((item, index) => (
          <div
            key={item.title}
            className={cn("flex items-start gap-2 rounded-md border border-neutral-100 bg-white", mock.pad.card)}
          >
            <div
              className={cn(
                "mt-0.5 flex shrink-0 items-center justify-center rounded border border-neutral-300 bg-white",
                mock.icon.sm,
                index === 0 && "landing-feature-check",
              )}
            >
              {index === 0 && (
                <CheckSquare className={cn("text-white opacity-0 landing-feature-check-icon", mock.icon.xs)} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-medium text-neutral-900",
                  mock.t.sm,
                  index === 0 && "landing-feature-check-text",
                )}
              >
                {item.title}
              </p>
              {!compact && (
                <span className={cn("text-neutral-400", mock.t.xs)}>{item.due}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MeetingsScene({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className={cn("flex items-center gap-1.5 border-b border-neutral-100", mock.pad.header)}>
        <NotebookTabs className={cn("text-neutral-700", mock.icon.md)} />
        <span className={cn("font-semibold text-neutral-900", mock.t.base)}>
          Meeting brief
        </span>
      </div>
      <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
        <div className={cn("rounded-md border border-neutral-200 bg-neutral-50", mock.pad.card)}>
          <p className={cn("font-semibold text-neutral-900", mock.t.sm)}>
            Board sync — Today 2:00 PM
          </p>
          <p className={cn("text-neutral-400", mock.t.xs)}>4 attendees · 45 min</p>
        </div>
        <div className={cn("landing-feature-reveal space-y-1 rounded-md border border-neutral-100 bg-white", mock.pad.card)}>
          <p className={cn("text-neutral-600 landing-feature-reveal-line", mock.t.xs)}>
            • Q2 budget figures due before meeting
          </p>
          <p className={cn("text-neutral-600 landing-feature-reveal-line", mock.t.xs)}>
            • Contract redlines pending legal review
          </p>
          {!compact && (
            <p className={cn("text-neutral-500 landing-feature-reveal-line", mock.t.xs)}>
              Open with budget timeline, flag vendor blocker.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityScene({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col bg-white">
      <div className={cn("flex items-center gap-1.5 border-b border-neutral-100", mock.pad.header)}>
        <Bot className={cn("text-neutral-700", mock.icon.md)} />
        <span className={cn("font-semibold text-neutral-900", mock.t.base)}>
          Agent activity
        </span>
      </div>
      <div className={cn("flex-1 space-y-2 overflow-hidden", mock.pad.section)}>
        <div className={cn("rounded-md border border-neutral-100 bg-neutral-50 opacity-70", mock.pad.card)}>
          <p className={cn("text-neutral-500", mock.t.xs)}>Completed · 2m ago</p>
          <p className={cn("text-neutral-700", mock.t.xs)}>
            Archived 12 promotional newsletters
          </p>
        </div>
        <div className={cn("landing-feature-approval rounded-md border border-amber-200/60 bg-amber-50/50", mock.pad.card)}>
          <div className="flex items-center gap-1.5">
            <div className={cn("animate-pulse rounded-full bg-amber-500", mock.icon.xs)} />
            <span className={cn("text-amber-700", mock.t.xs)}>Awaiting approval</span>
          </div>
          <p className={cn("mt-1 text-neutral-700", mock.t.xs)}>
            Draft reply to Sarah — Q2 budget review
          </p>
          <div className="mt-2 flex gap-1">
            <div className={cn("landing-feature-approve-btn flex-1 rounded-md bg-neutral-900 text-center", mock.pad.btn)}>
              <span className={cn("font-medium text-white", mock.t.xs)}>Approve</span>
            </div>
            <div className={cn("flex-1 rounded-md border border-neutral-200 bg-white text-center", mock.pad.btn)}>
              <span className={cn("text-neutral-500", mock.t.xs)}>Edit</span>
            </div>
          </div>
        </div>
        {!compact && (
          <div className={cn("rounded-md border border-neutral-100 bg-white opacity-50", mock.pad.card)}>
            <p className={cn("text-neutral-500", mock.t.xs)}>
              Extracted task: Send Q2 budget to Sarah
            </p>
          </div>
        )}
      </div>
    </div>
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
}: {
  variant: "hero" | "feature"
  scene?: MockupScene
}) {
  if (variant === "hero") {
    return <HeroInteractiveMockup />
  }

  return (
    <div className="h-full">
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
