"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Mail, ArrowRight, Play, Menu, X, Zap, Lock, Sparkles, Layers, Globe, Clock, Search, Inbox, PenLine, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"

const TAG_STYLES: Record<string, string> = {
  critical: "bg-[#FF5F57]/10 text-[#FF5F57] border border-[#FF5F57]/20",
  high: "bg-[#FEBC2E]/10 text-[#FEBC2E] border border-[#FEBC2E]/20",
  auto: "bg-[#28C840]/10 text-[#28C840] border border-[#28C840]/20",
  info: "bg-[#C4A052]/10 text-[#C4A052] border border-[#C4A052]/20",
  neutral: "bg-white/[0.04] text-[#8A8A8A] border border-white/[0.06]"
}

const PREVIEW_MODES = [
  {
    id: "briefing",
    label: "Morning Brief",
    icon: Sparkles,
    summary: "Summaries that collapse 147 emails into 6 decisions.",
    prompt: "Show only revenue-impacting threads",
    status: "Syncing Gmail - 12s to complete",
    progress: 72,
    signals: [
      { label: "Threads scanned", value: "412" },
      { label: "Decisions", value: "6 queued" },
      { label: "Drafts", value: "4 ready" }
    ],
    messages: [
      { role: "agent", text: "Morning brief is ready. 6 decisions need your eyes.", meta: "Briefing" },
      { role: "user", text: "Prioritize anything from Acme or Stripe.", meta: "Request" },
      { role: "agent", text: "2 items flagged. Drafts prepared and queued.", meta: "Action" }
    ],
    chips: ["Approve 4 drafts", "Snooze promos", "View timeline"],
    panel: {
      type: "decisions",
      title: "Decision queue",
      footer: "3 auto-executed, 2 waiting approval",
      items: [
        { title: "Stripe dispute - Acme Corp", meta: "Draft reply ready in 11s", tag: "Critical", tone: "critical" },
        { title: "Board deck review", meta: "Due today 5:00 PM", tag: "High", tone: "high" },
        { title: "Vendor renewal notice", meta: "Auto-archived 28 promos", tag: "Auto", tone: "auto" }
      ]
    }
  },
  {
    id: "search",
    label: "Semantic Search",
    icon: Search,
    summary: "Search by meaning across Gmail.",
    prompt: "Find the clause about renewal windows",
    status: "Vector index updated 2m ago",
    progress: 91,
    signals: [
      { label: "Matches", value: "12 threads" },
      { label: "Account", value: "1 connected" },
      { label: "Recall", value: "97%" }
    ],
    messages: [
      { role: "user", text: "Find the email where Alex mentioned Project Titan scope change.", meta: "Query" },
      { role: "agent", text: "Found 12 threads. The scope change appears in 3.", meta: "Result" },
      { role: "agent", text: "Top hit is Nov 12, subject: \"Titan scope update\".", meta: "Top match" }
    ],
    chips: ["Open top thread", "Summarize results", "Draft follow-up"],
    panel: {
      type: "search",
      query: "Project Titan scope change",
      results: [
        { title: "Alex Rivera - Titan scope update", meta: "Nov 12, 2:14 PM", highlight: "scope changed to include data migration" },
        { title: "Legal - Titan contract redlines", meta: "Nov 10, 9:03 AM", highlight: "renewal window shortened to 30 days" },
        { title: "Ops - Migration timeline", meta: "Nov 08, 6:41 PM", highlight: "timeline moved to May 18" }
      ]
    }
  },
  {
    id: "draft",
    label: "Draft Studio",
    icon: PenLine,
    summary: "Drafts in your voice, ready to send.",
    prompt: "Draft a calm response about the delay",
    status: "Tone model: You v4.2",
    progress: 64,
    signals: [
      { label: "Drafts", value: "5 ready" },
      { label: "Sentiment", value: "Confident" },
      { label: "Length", value: "118 words" }
    ],
    messages: [
      { role: "agent", text: "I drafted a response in your voice. Want it shorter?", meta: "Draft" },
      { role: "user", text: "Keep it concise and include the new timeline.", meta: "Edit" },
      { role: "agent", text: "Updated. Highlighted the May 18 date and next steps.", meta: "Ready" }
    ],
    chips: ["Send now", "Schedule", "Edit details"],
    panel: {
      type: "draft",
      subject: "Updated timeline for Q2 rollout",
      body: "Thanks for the patience. We are moving the launch to May 18. The data migration is underway, and we will share a detailed checklist this week.",
      suggestions: ["Shorten opening", "Add availability", "Attach timeline PDF"],
      stats: [
        { label: "Read time", value: "34s" },
        { label: "Tone", value: "Calm, direct" },
        { label: "CTA", value: "Book a call" }
      ]
    }
  },
  {
    id: "autopilot",
    label: "Autopilot Rules",
    icon: Inbox,
    summary: "Low-risk tasks done in the background.",
    prompt: "Auto-archive newsletters under 2% open rate",
    status: "Rules active: 14",
    progress: 83,
    signals: [
      { label: "Automations", value: "14 live" },
      { label: "Time saved", value: "2h 14m" },
      { label: "Auto-archived", value: "28 today" }
    ],
    messages: [
      { role: "agent", text: "Muted 3 newsletters and archived 28 promo emails.", meta: "Automation" },
      { role: "user", text: "Keep receipts and anything from legal.", meta: "Guardrails" },
      { role: "agent", text: "Pinned receipts and legal. Everything else filtered.", meta: "Confirmed" }
    ],
    chips: ["Edit rules", "View logs", "Pause automation"],
    panel: {
      type: "rules",
      rules: [
        { title: "Auto-unsubscribe low engagement", meta: "Last run 8m ago", state: "On" },
        { title: "Mark receipts as Finance", meta: "Triggered 5 times today", state: "On" },
        { title: "Snooze social updates", meta: "Resumes on Friday", state: "Scheduled" }
      ],
      footer: "No critical items skipped in 14 days"
    }
  }
] as const

export function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrollY, setScrollY] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsLoaded(true), 100)

    const handleScroll = () => {
      setScrollY(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(timer)
    }
  }, [])

  // Text Generate Effect Logic
  const [displayedText, setDisplayedText] = useState("")
  const fullText = "I've analyzed your morning stream. 3 critical items require attention. Shall I draft responses?"

  useEffect(() => {
    if (isLoaded) {
      let i = 0
      const typingInterval = setInterval(() => {
        if (i < fullText.length) {
          setDisplayedText(fullText.substring(0, i + 1))
          i++
        } else {
          clearInterval(typingInterval)
        }
      }, 30) // Speed of typing
      return () => clearInterval(typingInterval)
    }
  }, [isLoaded])

  // Animated Placeholders Logic
  const placeholders = [
    "Draft reply to Sarah about the merger...",
    "Schedule deep work session for Tuesday...",
    "Summarize Q3 financial report...",
    "Find email from Alex about 'Project Titan'..."
  ]
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [fadePlaceholder, setFadePlaceholder] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setFadePlaceholder(true)
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % placeholders.length)
        setFadePlaceholder(false)
      }, 500) // Wait for fade out
    }, 4000) // Change every 4 seconds
    return () => clearInterval(interval)
  }, [placeholders.length])

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  // Telemetry Logic
  const [latency, setLatency] = useState(34)
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const change = Math.floor(Math.random() * 5) - 2
        return Math.min(50, Math.max(20, prev + change))
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const [activePreview, setActivePreview] = useState(0)
  const [isPreviewHovered, setIsPreviewHovered] = useState(false)

  useEffect(() => {
    if (isPreviewHovered) {
      return
    }
    const interval = setInterval(() => {
      setActivePreview((prev) => (prev + 1) % PREVIEW_MODES.length)
    }, 7000)
    return () => clearInterval(interval)
  }, [isPreviewHovered])

  const activePreviewMode = PREVIEW_MODES[activePreview]
  const activePreviewPanel = activePreviewMode.panel
  const confidenceScore = Math.min(99, activePreviewMode.progress + 6)
  const recallScore = Math.min(99, activePreviewMode.progress + 3)
  const automationScore = Math.min(99, activePreviewMode.progress + 9)
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#FAFAF9] selection:bg-[#E8DCC4]/20 overflow-x-hidden">
      {/* Living Void Background: Deep Noir with Gold Mesh */}
      <div className="fixed inset-0 bg-[#030303] overflow-hidden pointer-events-none">
        {/* Cinematic Grain Overlay handled by globals.css .bg-grain */}
        <div className="bg-grain" />

        {/* Primary Ambient Glow - Golden Hour in the Void */}
        <div
          className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #C4A052, transparent 60%)',
            transform: `translateY(${scrollY * 0.2}px)`,
            willChange: 'transform'
          }}
        />

        {/* Secondary Deep Purple/Blue fill for contrast (Obsidian feel) */}
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[1200px] h-[1200px] opacity-10 blur-[150px]"
          style={{
            background: 'radial-gradient(circle at 50% 50%, #2A2A35, transparent 70%)',
            transform: `translateY(${scrollY * -0.1}px)`,
            willChange: 'transform'
          }}
        />

        {/* Floating Particles/Dust */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundSize: '4px 4px', backgroundImage: 'radial-gradient(#C4A052 1px, transparent 0)' }} />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-40 transition-all duration-500 ${scrollY > 50 ? 'py-4' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div
            className={`flex items-center justify-between px-6 py-3 rounded-2xl transition-all duration-500 ${scrollY > 50
              ? 'bg-[#0A0A0B]/60 backdrop-blur-2xl border border-white/[0.04] shadow-2xl shadow-black/20'
              : 'bg-transparent'
              }`}
          >
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-[#E8DCC4] blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                  <Mail className="h-5 w-5 text-[#0A0A0B]" />
                </div>
              </div>
              <span className="text-xl font-semibold tracking-tight">Relay</span>
            </Link>

            <div className="hidden md:flex items-center justify-center gap-1 absolute left-1/2 -translate-x-1/2">
              {['How it works', 'Preview', 'Features', 'Pricing'].map((item) => (
                <Link
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className="px-5 py-2 text-sm text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors duration-200 rounded-lg hover:bg-white/[0.03]"
                >
                  {item}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="hidden sm:block text-sm text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors"
              >
                Sign in
              </Link>
              <Button
                className="bg-[#FAFAF9] hover:bg-[#E8DCC4] text-[#0A0A0B] font-medium rounded-xl px-5 h-10 text-sm transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                Get early access
              </Button>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full px-6 pt-4">
            <div className="bg-[#141416]/95 backdrop-blur-2xl border border-white/[0.04] rounded-2xl p-6 space-y-4">
              <Link
                href="/login"
                className="block text-[#FAFAF9] transition-colors py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Sign in
              </Link>
              {['How it works', 'Preview', 'Features', 'Pricing'].map((item) => (
                <Link
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                  className="block text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors py-2"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Cinematic Reveal */}
      <section ref={heroRef} className="relative h-screen flex items-center justify-center px-6 overflow-hidden">
        <div className="max-w-[1400px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Typography Content */}
          <div className="lg:col-span-7 flex flex-col justify-center text-left z-10 pt-20">
            {/* Precision Badge */}
            <div
              className={`inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.08] mb-12 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#C4A052] animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#C4A052] uppercase">
                System v1.0 // Private Beta
              </span>
            </div>

            {/* Main Headline - Noir Gold */}
            <h1 className="relative">
              <span className={`block text-[clamp(3.5rem,6vw,5.5rem)] font-light tracking-[-0.04em] leading-[0.95] text-[#FAFAF9] transition-all duration-1000 delay-100 ${isLoaded ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-12 blur-lg'}`}>
                Email without
              </span>
              <span className={`block text-[clamp(3.5rem,6vw,5.5rem)] font-normal tracking-[-0.04em] leading-[0.95] text-[#FAFAF9] transition-all duration-1000 delay-200 ${isLoaded ? 'opacity-100 translate-y-0 filter-none' : 'opacity-0 translate-y-12 blur-lg'}`}>
                the <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C4A052] via-[#E8DCC4] to-[#C4A052] animate-shimmer bg-[length:200%_auto]">inbox.</span>
              </span>
            </h1>

            {/* Subheadline & Description */}
            <p
              className={`mt-8 text-lg text-[#8A8A8A] max-w-xl font-light leading-relaxed transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              Your AI agent reads, acts, and evolves.
              <br />
              <span className="text-[#5A5A5A]">Stop managing email. Start managing decisions.</span>
            </p>

            {/* Magnetic CTA Buttons */}
            <div
              className={`flex flex-wrap items-center gap-5 mt-12 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <Button
                className="group relative h-14 px-8 rounded-full bg-[#FAFAF9] hover:bg-[#E8DCC4] text-[#0A0A0B] text-base font-medium overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Request Access <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:animate-shimmer" />
              </Button>

              <Link href="/demo">
                <Button
                  variant="ghost"
                  className="group h-14 px-8 rounded-full border border-[#FAFAF9]/10 text-[#FAFAF9] hover:bg-[#FAFAF9]/5 hover:text-[#FAFAF9] transition-all duration-300"
                >
                  <span className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FAFAF9]/10 flex items-center justify-center border border-[#FAFAF9]/10 group-hover:bg-[#C4A052] group-hover:text-[#0A0A0B] transition-colors">
                      <Play className="w-3 h-3 ml-0.5 fill-current" />
                    </div>
                    System Demo
                  </span>
                </Button>
              </Link>
            </div>

            {/* Live System Telemetry Strip - Technical Proof instead of Social Proof */}
            <div className={`mt-20 w-full transition-all duration-1000 delay-700 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 py-4 border-y border-[#FAFAF9]/[0.05] bg-[#FAFAF9]/[0.01] backdrop-blur-sm">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#28C840] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#28C840]" />
                  </div>
                  <span className="text-xs font-mono text-[#FAFAF9]/80 tracking-widest uppercase">
                    System Operational
                  </span>
                </div>

                {/* Divider - only visible on larger screens */}
                <div className="hidden sm:block w-px h-4 bg-[#FAFAF9]/10" />

                {/* Latency Metric */}
                <div className="flex items-center gap-3">
                  <Zap className="w-3 h-3 text-[#C4A052]" />
                  <span className="text-xs font-mono text-[#FAFAF9]/80 tracking-widest uppercase">
                    Global Latency: <span className="text-[#C4A052]">{latency}ms</span>
                  </span>
                </div>

                {/* Divider */}
                <div className="hidden sm:block w-px h-4 bg-[#FAFAF9]/10" />

                {/* Encryption Metric */}
                <div className="flex items-center gap-3">
                  <Lock className="w-3 h-3 text-[#FAFAF9]/50" />
                  <span className="text-xs font-mono text-[#FAFAF9]/80 tracking-widest uppercase">
                    AES-256 <span className="text-[#5A5A5A]">::</span> E2EE Active
                  </span>
                </div>

                {/* Uptime (fill space) */}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#5A5A5A]">UPTIME 99.99%</span>
                </div>
              </div>

            </div>
          </div>

          {/* Hero Visual - Abstract Floating Element with 3D Scroll Tilt */}
          <div
            className={`hidden lg:block lg:col-span-5 relative transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
            style={{
              perspective: '1000px'
            }}
          >
            <div
              className="relative w-full aspect-square"
              style={{
                transform: `rotateX(${scrollY * 0.02}deg) rotateY(${scrollY * -0.02}deg) scale(${Math.max(0.9, 1 - scrollY * 0.0005)})`,
                transition: 'transform 0.1s ease-out'
              }}
            >
              {/* Back Glow - Pulse Effect */}
              <div className="absolute inset-0 bg-[#C4A052] opacity-10 blur-[100px] rounded-full animate-pulse-slow" />

              {/* Main Crystal/Obsidian Object - using CSS3D representation */}
              <div className="relative w-full h-full rounded-[3rem] border border-[#FAFAF9]/10 bg-gradient-to-b from-[#FAFAF9]/[0.05] to-transparent backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#FAFAF9]/[0.02] to-transparent" />

                {/* Internal UI Mockup - Active Agent Interface */}
                <div className="absolute inset-4 rounded-[2.5rem] bg-[#0A0A0B]/90 border border-[#FAFAF9]/[0.05] flex flex-col overflow-hidden">

                  {/* Glass Header */}
                  <div className="h-14 border-b border-[#FAFAF9]/[0.05] flex items-center justify-between px-6 bg-[#FAFAF9]/[0.02]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57] shadow-[0_0_8px_rgba(255,95,87,0.3)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E] shadow-[0_0_8px_rgba(254,188,46,0.3)]" />
                      <div className="w-2.5 h-2.5 rounded-full bg-[#28C840] shadow-[0_0_8px_rgba(40,200,64,0.3)]" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.05]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#28C840] animate-pulse" />
                      <span className="text-[10px] font-mono text-[#FAFAF9]/50 uppercase tracking-wider">System Online</span>
                    </div>
                  </div>

                  {/* Active Content Area */}
                  <div className="flex-1 p-6 flex flex-col gap-6 relative">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#FAFAF9 1px, transparent 1px), linear-gradient(90deg, #FAFAF9 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

                    {/* Agent Message Bubble with Text Generate Effect */}
                    <div className="flex gap-4 items-start relative z-10">
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(196,160,82,0.2)] transition-all duration-500 ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                        <Sparkles className="w-4 h-4 text-[#0A0A0B]" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className={`p-4 rounded-2xl rounded-tl-sm bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.05] backdrop-blur-sm transition-all duration-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                          <p className="text-sm text-[#FAFAF9] leading-relaxed font-mono">
                            {displayedText}
                            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#C4A052] animate-pulse" />
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Item Card */}
                    <div className="ml-12 relative z-10 animate-fade-in-up delay-200">
                      <div className="group p-4 rounded-xl bg-[#0F0F11] border border-[#FAFAF9]/[0.08] hover:border-[#C4A052]/30 transition-colors duration-300">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-[#FAFAF9]/[0.05] text-[#FAFAF9]">
                              <Mail className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-[#FAFAF9] group-hover:text-[#C4A052] transition-colors">Stripe Invoice #2024-001</h4>
                              <p className="text-xs text-[#5A5A5A]">$2,400.00 • Payment Failed</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#FF5F57]/10 text-[#FF5F57] border border-[#FF5F57]/20">High Priority</span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-2">
                          <button className="flex-1 py-1.5 rounded-lg bg-[#FAFAF9] text-[#0A0A0B] text-xs font-medium hover:bg-[#E8DCC4] transition-colors">
                            Update Payment Method
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* User Reply Input Mock with Animated Placeholders */}
                    <div className="mt-auto relative z-10 animate-fade-in-up delay-300">
                      <div className="relative group/input">
                        <input
                          disabled
                          className="w-full h-10 bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.05] rounded-lg pl-3 pr-10 text-xs text-[#FAFAF9] placeholder:text-transparent transition-colors group-hover/input:border-[#FAFAF9]/10"
                        />

                        {/* Animated Placeholder Overlay */}
                        <div className={`absolute left-3 top-0 h-full flex items-center pointer-events-none transition-opacity duration-500 ${fadePlaceholder ? 'opacity-0' : 'opacity-100'}`}>
                          <span className="text-xs text-[#5A5A5A] italic">{placeholders[placeholderIndex]}</span>
                        </div>

                        <div className="absolute right-2 top-2 p-1 rounded bg-[#C4A052]/20 group-hover/input:bg-[#C4A052] transition-colors duration-300">
                          <ArrowRight className="w-3 h-3 text-[#C4A052] group-hover/input:text-[#0A0A0B] transition-colors duration-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Agent Showcase Section */}
      <section id="how-it-works" className="relative min-h-screen flex items-center py-20 px-6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-medium tracking-[0.3em] text-[#C4A052] uppercase mb-4">
              How it works
            </span>
            <h2 className="text-3xl md:text-5xl font-light tracking-[-0.03em] mb-4">
              Talk to your agent.
              <br />
              <span className="text-[#5A5A5A]">Not your inbox.</span>
            </h2>
            <p className="text-[#8A8A8A] text-base max-w-xl mx-auto font-light">
              Your AI agent understands context, takes action, and learns your preferences over time.
            </p>
          </div>

          {/* Interactive Demo Window - Liquid Glass Design */}
          <div className="relative group">
            {/* Ambient glow behind window */}
            <div
              className="absolute -inset-8 rounded-[48px] opacity-30 blur-3xl transition-opacity duration-700 group-hover:opacity-50"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(232,220,196,0.15) 0%, transparent 70%)',
              }}
            />

            {/* Main Window */}
            <div className="relative p-[1px] rounded-[24px] bg-gradient-to-b from-white/[0.15] to-white/[0.02] overflow-hidden">
              <div
                className="relative rounded-[23px] overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)',
                  backdropFilter: 'blur(40px)',
                }}
              >
                {/* Window Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                      <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <span className="ml-4 text-xs font-mono text-[#5A5A5A]">relay-agent-v1.0.0</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-[#28C840] animate-pulse" />
                    <span className="text-xs text-[#5A5A5A]">Agent active</span>
                  </div>
                </div>

                {/* Chat Content */}
                <div className="p-4 md:p-6 flex flex-col gap-4">
                  {/* Agent Message */}
                  <div className="flex gap-4 max-w-2xl animate-fade-in-up">
                    <div className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] flex items-center justify-center">
                      <span className="font-semibold text-[#0A0A0B]">R</span>
                    </div>
                    <div className="flex-1 p-4 rounded-2xl rounded-tl-md bg-white/[0.03] border border-white/[0.04]">
                      <p className="text-[#FAFAF9] mb-3 font-medium text-sm">Good morning. You have 47 new emails overnight. Here&apos;s what matters:</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[#FF5F57]" />
                          <p className="text-[#C4C4C4]"><span className="text-[#FAFAF9] font-medium">Urgent (2):</span> Board meeting moved to tomorrow 2PM, and Stripe flagged a payment dispute.</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[#FEBC2E]" />
                          <p className="text-[#C4C4C4]"><span className="text-[#FAFAF9] font-medium">Needs response (5):</span> Client proposals waiting, team standup reschedule.</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-[#28C840]" />
                          <p className="text-[#C4C4C4]"><span className="text-[#FAFAF9] font-medium">FYI (12):</span> Newsletter, updates, shipping notifications.</p>
                        </div>
                        <p className="mt-3 text-xs text-[#5A5A5A]">The rest I&apos;ve already handled—unsubscribed from 3 lists, archived 28 promotional emails.</p>
                      </div>
                    </div>
                  </div>

                  {/* User Message */}
                  <div className="flex gap-3 max-w-lg ml-auto flex-row-reverse animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
                      <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#5A5A5A] to-[#3A3A3A]" />
                    </div>
                    <div className="p-3 px-4 rounded-2xl rounded-tr-md bg-[#FAFAF9] text-[#0A0A0B]">
                      <p className="font-medium text-sm">Tell me more about the payment dispute</p>
                    </div>
                  </div>

                  {/* Agent Response with Action */}
                  <div className="flex gap-3 max-w-2xl animate-fade-in-up" style={{ animationDelay: '400ms' }}>
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] flex items-center justify-center">
                      <span className="font-semibold text-[#0A0A0B] text-sm">R</span>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="p-4 rounded-2xl rounded-tl-md bg-white/[0.03] border border-white/[0.04]">
                        <p className="text-[#FAFAF9] mb-2 text-sm">The Stripe dispute is from <span className="font-medium">Acme Corp</span> for $2,400 (Invoice #INV-2024-0847).</p>
                        <p className="text-xs text-[#8A8A8A]">Disputed on Jan 12, reason: &quot;Product not received&quot;</p>
                      </div>

                      {/* Action Card */}
                      <div className="p-3 rounded-lg bg-[#E8DCC4]/[0.06] border border-[#E8DCC4]/[0.12]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Zap className="h-4 w-4 text-[#E8DCC4]" />
                            <span className="text-sm text-[#FAFAF9]">Draft dispute response with tracking info?</span>
                          </div>
                          <div className="flex gap-2">
                            <button className="px-3 py-1.5 text-xs font-medium text-[#0A0A0B] bg-[#E8DCC4] rounded-lg hover:bg-[#F5EDD8] transition-colors">
                              Yes
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium text-[#8A8A8A] hover:text-[#FAFAF9] transition-colors">
                              Skip
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-white/[0.04]">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ask your agent anything..."
                      className="w-full h-12 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 pr-12 text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:outline-none focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20 transition-all text-sm"
                    />
                    <button className="absolute right-2 top-2 h-8 w-8 rounded-lg bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] flex items-center justify-center hover:opacity-90 transition-opacity">
                      <ArrowRight className="h-4 w-4 text-[#0A0A0B]" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="liquid-card rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Action runway</span>
                    <span className="text-xs text-[#C4A052]">ETA 14s</span>
                  </div>
                  <div className="mt-4">
                    <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-[65%] bg-gradient-to-r from-[#C4A052] via-[#E8DCC4] to-[#C4A052] animate-gradient-shift" />
                      <div className="absolute inset-y-0 left-0 w-10 bg-white/[0.5] blur-md animate-scan-line" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-[#5A5A5A]">
                      <span>Queued</span>
                      <span>Drafting</span>
                      <span>Ready</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activePreviewMode.chips.map((chip) => (
                      <button
                        key={chip}
                        className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-[#8A8A8A] hover:text-[#FAFAF9] hover:border-[#C4A052]/40 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="liquid-card rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Guardrails</span>
                    <span className="text-xs text-[#8A8A8A]">Risk: Low</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      { label: "Auto-archive promos", state: activePreviewMode.id === "draft" ? "Paused" : "On" },
                      { label: "Pin receipts + legal", state: "On" },
                      { label: "Approval required > $1k", state: "On" }
                    ].map((rule) => {
                      const stateClass = rule.state === "On"
                        ? "bg-[#28C840]/10 text-[#28C840] border border-[#28C840]/20"
                        : "bg-[#C4A052]/10 text-[#C4A052] border border-[#C4A052]/20"
                      return (
                        <div
                          key={rule.label}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-[#0A0A0B] p-3"
                        >
                          <span className="text-xs text-[#FAFAF9]">{rule.label}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${stateClass}`}>
                            {rule.state}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: "Confidence", value: `${confidenceScore}%` },
                      { label: "Recall", value: `${recallScore}%` },
                      { label: "Auto ops", value: `${automationScore}%` }
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg bg-[#0A0A0B] border border-white/[0.04] p-3">
                        <p className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">{stat.label}</p>
                        <p className="text-sm text-[#FAFAF9]">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Preview Section - Interactive App Tour */}
      <section
        id="preview"
        className="relative py-32 px-6 overflow-hidden scroll-mt-20"
        onMouseEnter={() => setIsPreviewHovered(true)}
        onMouseLeave={() => setIsPreviewHovered(false)}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 right-0 w-[720px] h-[720px] bg-gradient-to-br from-[#C4A052]/10 to-transparent blur-[160px]" />
          <div className="absolute -bottom-40 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-[#FAFAF9]/5 to-transparent blur-[140px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C4A052]/20 bg-[#C4A052]/5 mb-6">
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C4A052] font-semibold">Preview</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
              Preview the agent <span className="text-[#8A8A8A]">in motion.</span>
            </h2>
            <p className="text-[#8A8A8A] text-lg font-light leading-relaxed">
              Switch modes to see briefings, search, drafting, and autopilot in the same interface.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-6">
              <div className="liquid-panel liquid-interactive rounded-3xl p-6 group">
                <div className="flex items-center justify-between mb-5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Mode switcher</span>
                  <div className="flex items-center gap-2 text-xs text-[#8A8A8A]">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#C4A052] animate-pulse" />
                    Auto-cycling
                  </div>
                </div>

                <div className="space-y-3">
                  {PREVIEW_MODES.map((mode, index) => {
                    const Icon = mode.icon
                    const isActive = activePreview === index
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setActivePreview(index)}
                        className={`group relative w-full text-left rounded-2xl p-4 border transition-all duration-300 overflow-hidden hover:-translate-y-0.5 ${isActive
                          ? 'bg-[#0F0F11] border-[#C4A052]/30 shadow-[0_0_25px_rgba(196,160,82,0.2)]'
                          : 'bg-[#0A0A0B]/60 border-white/[0.05] hover:border-white/[0.14]'
                          }`}
                        aria-pressed={isActive}
                      >
                        <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 ${isActive ? 'opacity-100' : 'group-hover:opacity-100'}`}>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(196,160,82,0.2),transparent_60%)]" />
                          <div className="absolute inset-y-0 -left-1/3 w-1/2 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent animate-scan-line" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div
                                className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors ${isActive
                                  ? 'bg-[#C4A052] text-[#0A0A0B]'
                                  : 'bg-white/[0.05] text-[#FAFAF9] group-hover:bg-white/[0.08]'
                                  }`}
                              >
                                <Icon className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#FAFAF9]">{mode.label}</p>
                                <p className="text-xs text-[#8A8A8A] leading-relaxed">{mode.summary}</p>
                              </div>
                            </div>
                            <span className={`text-[10px] uppercase tracking-wider ${isActive ? 'text-[#C4A052]' : 'text-[#5A5A5A]'}`}>
                              {isActive ? 'Active' : 'Preview'}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-[#5A5A5A]">
                            <span>{mode.status}</span>
                            <div className="flex items-center gap-2">
                              <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-[#C4A052] animate-pulse' : 'bg-[#333]'}`} />
                              <span className="text-[10px] uppercase tracking-widest">{mode.progress}%</span>
                            </div>
                          </div>
                          <div className="mt-3 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                            <div
                              className={`h-full transition-all duration-700 ${isActive
                                ? 'bg-gradient-to-r from-[#C4A052] via-[#E8DCC4] to-[#C4A052] animate-gradient-shift'
                                : 'bg-white/[0.08]'
                                }`}
                              style={{ width: `${mode.progress}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="liquid-card liquid-interactive rounded-3xl p-6 group">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Live signals</span>
                  <span className="text-xs text-[#C4A052]">{activePreviewMode.status}</span>
                </div>
                <div className="mt-5 flex flex-col sm:flex-row gap-5">
                  <div className="relative h-20 w-20 shrink-0">
                    <div className="absolute -inset-2 rounded-full border border-[#C4A052]/20 animate-halo" />
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(#C4A052 ${activePreviewMode.progress * 3.6}deg, rgba(255,255,255,0.08) 0deg)`
                      }}
                    />
                    <div className="absolute inset-2 rounded-full bg-[#0A0A0B] border border-white/[0.06]" />
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-[#FAFAF9]">
                      {activePreviewMode.progress}%
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 flex-1">
                    {activePreviewMode.signals.map((signal) => (
                      <div
                        key={signal.label}
                        className="rounded-lg bg-[#0A0A0B] border border-white/[0.04] p-3 transition-colors duration-300 hover:border-[#C4A052]/30"
                      >
                        <p className="text-sm text-[#FAFAF9]">{signal.value}</p>
                        <p className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">{signal.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs text-[#5A5A5A]">
                    <span>Indexing stream</span>
                    <span className="text-[#FAFAF9]">{activePreviewMode.progress}%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/[0.04] overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-[#C4A052] via-[#E8DCC4] to-[#C4A052] animate-gradient-shift transition-all duration-700"
                      style={{ width: `${activePreviewMode.progress}%` }}
                    />
                    <div className="absolute inset-y-0 left-0 w-12 bg-white/[0.5] blur-md animate-scan-line" />
                  </div>
                </div>
              </div>

            </div>

            <div className="lg:col-span-7 space-y-6">
            <div className="liquid-panel liquid-interactive rounded-3xl p-[1px] group">
                <div className="relative rounded-[calc(1.5rem-1px)] bg-[#0A0A0B]/90 border border-white/[0.04] overflow-hidden">
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-24 right-[-10%] w-[280px] h-[280px] bg-gradient-to-br from-[#C4A052]/20 to-transparent blur-[90px] animate-subtle-float" />
                    <div className="absolute -bottom-28 left-[20%] w-[260px] h-[260px] bg-gradient-to-tr from-[#C4A052]/15 to-transparent blur-[100px] opacity-0 transition-opacity duration-700 group-hover:opacity-100 animate-halo" />
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.08] to-transparent" />
                    <div className="absolute inset-0 bg-grid-white/[0.03] opacity-30" />
                  </div>
                  <div className="relative">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05] bg-[#0F0F11]/60">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                        </div>
                        <span className="text-xs font-mono text-[#5A5A5A]">preview.relay.ai</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#C4A052] animate-pulse" />
                        <span className="text-xs text-[#8A8A8A]">
                          Mode: <span className="text-[#FAFAF9]">{activePreviewMode.label}</span>
                        </span>
                      </div>
                    </div>

                    <div className="px-6 py-2 border-b border-white/[0.04]">
                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-[0.25em] text-[#5A5A5A]">
                        <span className="text-[#C4A052]">Pulse</span>
                        <div className="relative h-1 w-32 bg-white/[0.04] rounded-full overflow-hidden">
                          <div className="absolute inset-y-0 left-0 w-[70%] bg-gradient-to-r from-[#C4A052] via-[#E8DCC4] to-[#C4A052] animate-gradient-shift" />
                          <div className="absolute inset-y-0 left-0 w-10 bg-white/[0.5] blur-md animate-scan-line" />
                        </div>
                        <span>IDX {activePreviewMode.progress}%</span>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
                        <div className="liquid-card liquid-interactive rounded-2xl p-5 flex flex-col gap-4 group">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Agent dialog</span>
                            <span className="text-xs text-[#8A8A8A]">{activePreviewMode.status}</span>
                          </div>

                          <div className="space-y-3">
                            {activePreviewMode.messages.map((message, index) => (
                              <div
                                key={`${message.meta}-${index}`}
                                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse text-right" : ""}`}
                              >
                                <div
                                  className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${message.role === "user"
                                    ? "bg-white/[0.06] border border-white/[0.08]"
                                    : "bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]"
                                    }`}
                                >
                                  {message.role === "user" ? (
                                    <div className="h-3 w-3 rounded-full bg-[#5A5A5A]" />
                                  ) : (
                                    <span className="text-[#0A0A0B] text-xs font-semibold">R</span>
                                  )}
                                </div>
                                <div
                                  className={`max-w-[80%] p-3 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_15px_35px_rgba(196,160,82,0.18)] ${message.role === "user"
                                    ? "bg-[#FAFAF9] text-[#0A0A0B] rounded-tr-md"
                                    : "bg-white/[0.03] border border-white/[0.04] text-[#FAFAF9] rounded-tl-md"
                                    }`}
                                >
                                  <p className={`text-sm ${message.role === "user" ? "font-medium" : ""}`}>{message.text}</p>
                                  <span
                                    className={`mt-2 inline-flex text-[10px] uppercase tracking-wider ${message.role === "user"
                                      ? "text-[#5A5A5A]"
                                      : "text-[#8A8A8A]"
                                      }`}
                                  >
                                    {message.meta}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center justify-between text-xs text-[#5A5A5A]">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#C4A052]/80 animate-typing" />
                                <span className="h-1.5 w-1.5 rounded-full bg-[#C4A052]/60 animate-typing delay-100" />
                                <span className="h-1.5 w-1.5 rounded-full bg-[#C4A052]/40 animate-typing delay-200" />
                              </div>
                              Drafting in your voice
                            </div>
                            <span className="text-[#C4A052]">{confidenceScore}% confidence</span>
                          </div>

                          <div className="mt-auto pt-4 border-t border-white/[0.04]">
                            <div className="relative">
                              <input
                                type="text"
                                disabled
                                placeholder={activePreviewMode.prompt}
                                className="w-full h-11 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 pr-12 text-sm text-[#FAFAF9] placeholder:text-[#5A5A5A] focus:outline-none"
                              />
                              <button className="absolute right-2 top-2 h-7 w-7 rounded-lg bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] flex items-center justify-center hover:opacity-90 transition-opacity">
                                <ArrowRight className="h-3 w-3 text-[#0A0A0B]" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="liquid-card liquid-interactive rounded-2xl p-5 group">
                          {activePreviewPanel.type === "decisions" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">{activePreviewPanel.title}</span>
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#5A5A5A]">
                                  <CheckCircle2 className="h-3 w-3 text-[#28C840]" />
                                  Auto-approve ready
                                </div>
                              </div>
                              <div className="space-y-3">
                                {activePreviewPanel.items.map((item) => (
                                  <div
                                    key={item.title}
                                    className="group rounded-xl border border-white/[0.05] bg-[#0A0A0B] p-3 transition-colors duration-300 hover:border-[#C4A052]/30"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm text-[#FAFAF9]">{item.title}</p>
                                        <p className="text-xs text-[#5A5A5A]">{item.meta}</p>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${TAG_STYLES[item.tone] ?? TAG_STYLES.neutral}`}>
                                        {item.tag}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-[#5A5A5A]">{activePreviewPanel.footer}</p>
                            </div>
                          )}

                          {activePreviewPanel.type === "search" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Semantic search</span>
                                <span className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">Top matches</span>
                              </div>
                              <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-[#5A5A5A]" />
                                <input
                                  type="text"
                                  value={activePreviewPanel.query}
                                  readOnly
                                  className="w-full h-10 bg-white/[0.03] border border-white/[0.06] rounded-xl pl-10 pr-4 text-sm text-[#FAFAF9]"
                                />
                              </div>
                              <div className="space-y-3">
                                {activePreviewPanel.results.map((result) => (
                                  <div
                                    key={result.title}
                                    className="rounded-xl border border-white/[0.05] bg-[#0A0A0B] p-3 transition-colors duration-300 hover:border-[#C4A052]/30"
                                  >
                                    <p className="text-sm text-[#FAFAF9]">{result.title}</p>
                                    <p className="text-xs text-[#5A5A5A]">{result.meta}</p>
                                    <p className="text-xs text-[#8A8A8A] mt-2">
                                      <span className="text-[#C4A052]">"{result.highlight}"</span>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {activePreviewPanel.type === "draft" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Draft preview</span>
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#5A5A5A]">
                                  <CheckCircle2 className="h-3 w-3 text-[#28C840]" />
                                  Ready to send
                                </div>
                              </div>
                              <div className="rounded-xl border border-white/[0.05] bg-[#0A0A0B] p-3 space-y-3">
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">Subject</p>
                                  <p className="text-sm text-[#FAFAF9]">{activePreviewPanel.subject}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">Body</p>
                                  <p className="text-xs text-[#8A8A8A] leading-relaxed">{activePreviewPanel.body}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {activePreviewPanel.suggestions.map((suggestion) => (
                                  <button
                                    key={suggestion}
                                    className="px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-[#8A8A8A] hover:text-[#FAFAF9] hover:border-[#C4A052]/40 transition-all hover:-translate-y-0.5"
                                  >
                                    {suggestion}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                {activePreviewPanel.stats.map((stat) => (
                                  <div
                                    key={stat.label}
                                    className="rounded-lg bg-[#0A0A0B] border border-white/[0.04] p-3"
                                  >
                                    <p className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">{stat.label}</p>
                                    <p className="text-sm text-[#FAFAF9]">{stat.value}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {activePreviewPanel.type === "rules" && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase tracking-wider text-[#5A5A5A]">Automation rules</span>
                                <span className="text-[10px] uppercase tracking-wider text-[#5A5A5A]">Guardrails</span>
                              </div>
                              <div className="space-y-3">
                                {activePreviewPanel.rules.map((rule) => {
                                  const ruleStateClass = rule.state === "On"
                                    ? "bg-[#28C840]/10 text-[#28C840] border border-[#28C840]/20"
                                    : "bg-[#C4A052]/10 text-[#C4A052] border border-[#C4A052]/20"
                                  return (
                                    <div
                                      key={rule.title}
                                      className="rounded-xl border border-white/[0.05] bg-[#0A0A0B] p-3 flex items-center justify-between gap-3"
                                    >
                                      <div>
                                        <p className="text-sm text-[#FAFAF9]">{rule.title}</p>
                                        <p className="text-xs text-[#5A5A5A]">{rule.meta}</p>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${ruleStateClass}`}>
                                        {rule.state}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                              <p className="text-xs text-[#5A5A5A]">{activePreviewPanel.footer}</p>
                            </div>
                          )}
                        </div>
                      </div>


                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Obsidian Cards with Spotlight Grid */}
      <section
        id="features"
        className="relative py-32 px-6 overflow-hidden"
        onMouseMove={handleMouseMove}
      >
        {/* Spotlight Grid Background */}
        <div
          className="absolute inset-0 pointer-events-none bg-grid-white/[0.02]"
          style={{
            maskImage: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
            WebkitMaskImage: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, black, transparent)`,
          }}
        />

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#C4A052]/20 bg-[#C4A052]/5 mb-6">
              <Sparkles className="w-3 h-3 text-[#C4A052]" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#C4A052] font-semibold">Capabilities</span>
            </div>

            <h2 className="text-4xl md:text-6xl font-normal tracking-tight mb-6">
              <span className="text-[#FAFAF9]">Power in</span> <span className="text-[#8A8A8A] font-light italic">every pixel.</span>
            </h2>
            <p className="text-[#8A8A8A] max-w-2xl mx-auto text-lg font-light leading-relaxed">
              Designed not just to function, but to feel. Every interaction is a statement of precision.
            </p>
          </div>

          {/* Obsidian Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <Layers className="h-6 w-6" />,
                title: "Zero Inbox",
                description: "No folders. No labels. Just a stream of decisions handled by intelligence.",
                meta: "AUTO-SORT v2.1"
              },
              {
                icon: <Zap className="h-6 w-6" />,
                title: "Autonomous Actions",
                description: "Drafts, schedules, and unsubscribes. You approve, it executes.",
                meta: "LATENCY < 50ms"
              },
              {
                icon: <Lock className="h-6 w-6" />,
                title: "Encrypted Core",
                description: "Your data stays on device. Training happens locally, never in the cloud.",
                meta: "AES-256 GCM"
              },
              {
                icon: <Sparkles className="h-6 w-6" />,
                title: "Adaptive Style",
                description: "Learns your tone of voice. Writes exactly how you would, but faster.",
                meta: "LLM-FT-7B"
              },
              {
                icon: <Globe className="h-6 w-6" />,
                title: "Gmail Sync",
                description: "Connect your Gmail account and work from one focused email agent.",
                meta: "GMAIL API"
              },
              {
                icon: <Clock className="h-6 w-6" />,
                title: "Active Sleep",
                description: "Processing continues while you sleep. Wake up to a prioritized summary.",
                meta: "bg-background-worker"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative h-[300px] rounded-3xl bg-[#0F0F11] border border-[#FAFAF9]/[0.05] overflow-hidden transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl hover:shadow-[#C4A052]/10"
              >
                {/* Obsidian Surface Texture */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-[0.03]" />

                {/* Rim Light Gradient - Animates on Hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                  <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] animate-spin-slow opacity-20 mix-blend-overlay" />
                </div>

                {/* Inner Glow (Spotlight effect substitute) */}
                <div className="absolute -inset-[100px] bg-gradient-to-r from-transparent via-[#FAFAF9]/5 to-transparent rotate-45 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-in-out" />

                <div className="relative h-full p-8 flex flex-col justify-between z-10">
                  <div>
                    <div className="inline-flex p-3 rounded-2xl bg-[#FAFAF9]/[0.03] border border-[#FAFAF9]/[0.05] mb-6 group-hover:bg-[#C4A052] group-hover:text-[#0A0A0B] transition-colors duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-xl font-medium text-[#FAFAF9] mb-3 group-hover:translate-x-1 transition-transform duration-300">{feature.title}</h3>
                    <p className="text-[#8A8A8A] text-sm leading-relaxed font-light">
                      {feature.description}
                    </p>
                  </div>

                  {/* Tech Meta Data */}
                  <div className="flex items-center justify-between pt-6 border-t border-[#FAFAF9]/[0.03]">
                    <span className="text-[10px] font-mono text-[#5A5A5A] uppercase tracking-wider">{feature.meta}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#333] group-hover:bg-[#C4A052] transition-colors duration-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Obsidian Monolith */}
      <section id="pricing" className="relative py-32 px-6 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#C4A052]/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          {/* Section Header */}
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-mono tracking-[0.3em] text-[#C4A052] uppercase mb-4">
              {"// Access"}
            </span>
            <h2 className="text-4xl md:text-5xl font-light tracking-[-0.03em] mb-4 text-[#FAFAF9]">
              Fair pricing. <span className="text-[#8A8A8A]">Unlimited power.</span>
            </h2>
          </div>

          {/* Coming Soon Card - Obsidian Style */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-b from-[#C4A052]/20 to-transparent opacity-20 blur-lg transition-opacity duration-500 group-hover:opacity-40" />

            <div className="relative rounded-[32px] bg-[#0F0F11] border border-[#FAFAF9]/[0.05] overflow-hidden p-1">
              <div className="relative rounded-[28px] py-20 px-10 md:py-24 md:px-16 text-center overflow-hidden bg-[#0A0A0B]">
                {/* Noise Texture */}
                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-repeat opacity-[0.04]" />

                {/* Inner Spotlight */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-gradient-to-b from-[#FAFAF9]/[0.03] to-transparent blur-3xl pointer-events-none" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#C4A052]/10 border border-[#C4A052]/20 mb-8">
                    <Sparkles className="h-3 w-3 text-[#C4A052]" />
                    <span className="text-xs font-medium text-[#C4A052] uppercase tracking-wider">Early Access Phase</span>
                  </div>

                  <h3 className="text-3xl md:text-4xl font-light text-[#FAFAF9] mb-6 tracking-tight">
                    Pricing revealed at launch.
                  </h3>
                  <p className="text-[#8A8A8A] text-lg max-w-lg mx-auto mb-10 font-light leading-relaxed">
                    We are currently onboarding founding members. Join the waitlist to secure your spot and legacy pricing.
                  </p>

                  <Button
                    className="relative group bg-[#FAFAF9] hover:bg-[#E8DCC4] text-[#0A0A0B] font-medium rounded-full px-10 h-14 text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      Join waitlist
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/80 to-transparent translate-x-[-100%] group-hover:animate-shimmer" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section - The Void Calls */}
      <section className="relative py-40 px-6 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-t from-[#C4A052]/10 to-transparent blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-5xl md:text-7xl font-light tracking-[-0.04em] mb-8 text-[#FAFAF9]">
            Ready to <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FAFAF9] to-[#8A8A8A]">ascend?</span>
          </h2>
          <p className="text-[#8A8A8A] text-xl mb-12 font-light max-w-xl mx-auto">
            The future of communication is silent, intelligent, and instantaneous.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Button
              className="relative group bg-[#FAFAF9] hover:bg-[#E8DCC4] text-[#0A0A0B] font-medium rounded-full px-12 h-16 text-lg shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(196,160,82,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="relative z-10 flex items-center gap-3">
                Get Early Access
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                <Mail className="h-4 w-4 text-[#0A0A0B]" />
              </div>
              <span className="text-lg font-semibold tracking-tight">Relay</span>
            </Link>

            {/* Links */}
            <div className="flex items-center gap-8">
              {['Privacy', 'Terms', 'Security', 'Blog'].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="text-sm text-[#5A5A5A] hover:text-[#FAFAF9] transition-colors"
                >
                  {item}
                </Link>
              ))}
            </div>

            {/* Social */}
            <div className="flex items-center gap-3">
              {['twitter', 'github', 'linkedin'].map((social) => (
                <Link
                  key={social}
                  href="#"
                  className="h-9 w-9 rounded-lg bg-white/[0.03] border border-white/[0.04] flex items-center justify-center text-[#5A5A5A] hover:text-[#FAFAF9] hover:bg-white/[0.06] transition-all"
                >
                  {social === 'twitter' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  )}
                  {social === 'github' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                    </svg>
                  )}
                  {social === 'linkedin' && (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12 pt-8 border-t border-white/[0.04] text-center">
            <p className="text-xs text-[#5A5A5A]">
              &copy; {new Date().getFullYear()} Relay. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Tracing Beam - The Thread */}
      <div className="fixed left-6 top-0 bottom-0 w-[1px] hidden xl:block pointer-events-none z-50">
        <div className="absolute top-0 bottom-0 w-full bg-[#FAFAF9]/[0.05]" />
        <div
          className="absolute top-0 w-full bg-gradient-to-b from-[#C4A052] to-transparent transition-all duration-100 ease-out overflow-hidden"
          style={{ height: `${Math.min(100, (scrollY / 3000) * 100)}%` }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#C4A052] rounded-full shadow-[0_0_10px_#C4A052]" />

          {/* Active Data Packet */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[2px] h-8 bg-gradient-to-b from-transparent to-[#C4A052] animate-beam-flow" />
        </div>
      </div>
    </div>
  )
}
