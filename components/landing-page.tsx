"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { Mail, ArrowRight, Play, Menu, X, Zap, Lock, Sparkles, Layers, Globe, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

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

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#FAFAF9] selection:bg-[#E8DCC4]/20 overflow-x-hidden">
      {/* Noise Texture Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015] z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Ambient Gradient Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[150px] opacity-20"
          style={{
            background: 'radial-gradient(circle, #E8DCC4 0%, transparent 70%)',
            top: '-20%',
            left: '-10%',
            transform: `translateY(${scrollY * 0.1}px)`,
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-10"
          style={{
            background: 'radial-gradient(circle, #C4A052 0%, transparent 70%)',
            bottom: '-10%',
            right: '-5%',
            transform: `translateY(${scrollY * -0.05}px)`,
          }}
        />
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
              {['How it works', 'Features', 'Pricing'].map((item) => (
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
              {['How it works', 'Features', 'Pricing'].map((item) => (
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

      {/* Hero Section */}
      <section ref={heroRef} className="relative h-screen flex items-center justify-center px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Private Beta Badge */}
          <div
            className={`inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06] mb-10 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8DCC4] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E8DCC4]" />
            </span>
            <span className="text-xs font-medium tracking-[0.2em] text-[#8A8A8A] uppercase">
              Private Beta
            </span>
          </div>

          {/* Main Headline - Editorial Typography */}
          <h1
            className={`text-[clamp(3rem,10vw,7rem)] font-light tracking-[-0.04em] leading-[0.9] mb-6 transition-all duration-1000 delay-150 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
          >
            <span className="block">Email without</span>
            <span className="block relative">
              the{' '}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-[#E8DCC4] via-[#F5EDD8] to-[#C4A052] bg-clip-text text-transparent font-normal">
                  inbox
                </span>
                <span className="absolute -bottom-2 left-0 right-0 h-[3px] bg-gradient-to-r from-[#E8DCC4] via-[#F5EDD8] to-[#C4A052] opacity-60" />
              </span>
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className={`text-lg md:text-xl text-[#8A8A8A] max-w-xl mx-auto mb-10 leading-relaxed font-light transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
          >
            Your AI agent reads, prioritizes, drafts, and acts on every email.
            <br className="hidden md:block" />
            You just have a conversation.
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
              }`}
          >
            <Button
              className="relative group bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] font-medium rounded-xl px-8 h-14 text-base shadow-2xl shadow-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                Request access
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Button>
            <Button
              variant="ghost"
              className="text-[#FAFAF9] hover:text-[#FAFAF9] hover:bg-white/[0.03] rounded-xl px-8 h-14 text-base border border-white/[0.08] group"
            >
              <span className="flex items-center gap-3">
                Watch demo
                <div className="relative h-8 w-8 rounded-lg bg-white/[0.06] flex items-center justify-center border border-white/[0.08] group-hover:bg-white/[0.1] transition-colors">
                  <Play className="h-3 w-3 fill-[#FAFAF9] ml-0.5" />
                </div>
              </span>
            </Button>
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
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative min-h-screen flex items-center py-20 px-6 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-medium tracking-[0.3em] text-[#C4A052] uppercase mb-4">
              Features
            </span>
            <h2 className="text-3xl md:text-5xl font-light tracking-[-0.03em] mb-4">
              Built for the
              <br />
              <span className="text-[#5A5A5A]">post-inbox era</span>
            </h2>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <Layers className="h-5 w-5" />,
                title: "Zero inbox interface",
                description: "No folders. No labels. No sorting. Just tell your agent what you need.",
                gradient: "from-[#E8DCC4] to-[#C4A052]"
              },
              {
                icon: <Zap className="h-5 w-5" />,
                title: "Autonomous actions",
                description: "Drafts responses, schedules meetings, unsubscribes—all with your approval.",
                gradient: "from-[#FEBC2E] to-[#FF9500]"
              },
              {
                icon: <Lock className="h-5 w-5" />,
                title: "Privacy-first",
                description: "Your emails never leave your device for training. You own your data.",
                gradient: "from-[#28C840] to-[#1E9432]"
              },
              {
                icon: <Sparkles className="h-5 w-5" />,
                title: "Learns your style",
                description: "Adapts to your tone, priorities, and preferences over time.",
                gradient: "from-[#FF6B6B] to-[#EE5A5A]"
              },
              {
                icon: <Globe className="h-5 w-5" />,
                title: "Universal integration",
                description: "Works with Gmail, Outlook, and any IMAP provider seamlessly.",
                gradient: "from-[#7B68EE] to-[#6B5ACE]"
              },
              {
                icon: <Clock className="h-5 w-5" />,
                title: "24/7 processing",
                description: "Your agent works around the clock. Important emails surface instantly.",
                gradient: "from-[#00CED1] to-[#00A0A0]"
              }
            ].map((feature, i) => (
              <div
                key={i}
                className="group relative p-[1px] rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent hover:from-white/[0.12] transition-all duration-300"
              >
                <div className="relative h-full p-6 rounded-2xl bg-[#0A0A0B] overflow-hidden">
                  {/* Hover gradient */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`}
                  />

                  <div className="relative">
                    <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4`}>
                      <div className="text-[#0A0A0B]">
                        {feature.icon}
                      </div>
                    </div>
                    <h3 className="text-lg font-medium mb-3 text-[#FAFAF9]">{feature.title}</h3>
                    <p className="text-sm text-[#8A8A8A] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative min-h-screen flex items-center py-20 px-6 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-8">
            <span className="inline-block text-xs font-medium tracking-[0.3em] text-[#C4A052] uppercase mb-4">
              Pricing
            </span>
            <h2 className="text-3xl md:text-5xl font-light tracking-[-0.03em] mb-4">
              Simple pricing.
              <br />
              <span className="text-[#5A5A5A]">No surprises.</span>
            </h2>
          </div>

          {/* Coming Soon Card */}
          <div className="relative group">
            {/* Ambient glow */}
            <div
              className="absolute -inset-4 rounded-[32px] opacity-20 blur-2xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(232,220,196,0.15) 0%, transparent 70%)',
              }}
            />

            <div className="relative p-[1px] rounded-[32px] bg-gradient-to-b from-white/[0.1] to-white/[0.02]">
              <div
                className="relative rounded-[31px] py-20 px-10 md:py-24 md:px-16 text-center overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)',
                  backdropFilter: 'blur(40px)',
                }}
              >
                {/* Inner glow */}
                <div className="absolute inset-0 rounded-[23px] overflow-hidden">
                  <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[#E8DCC4]/[0.03] blur-3xl" />
                </div>

                <div className="relative">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E8DCC4]/[0.08] border border-[#E8DCC4]/[0.15] mb-6">
                    <Sparkles className="h-4 w-4 text-[#E8DCC4]" />
                    <span className="text-sm font-medium text-[#E8DCC4]">Coming Soon</span>
                  </div>
                  <h3 className="text-3xl md:text-5xl font-light text-[#FAFAF9] mb-6">
                    Pricing to be announced
                  </h3>
                  <p className="text-[#8A8A8A] text-lg max-w-lg mx-auto mb-10">
                    We&apos;re finalizing our pricing plans. Join the waitlist to be the first to know when we launch.
                  </p>
                  <Button
                    className="bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] font-medium rounded-xl px-8 h-12 text-base transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Join waitlist
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative min-h-screen flex items-center py-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* CTA Card with Liquid Glass */}
          <div className="relative">
            {/* Ambient glow */}
            <div
              className="absolute -inset-8 rounded-[48px] opacity-40 blur-3xl"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(232,220,196,0.2) 0%, transparent 70%)',
              }}
            />

            <div className="relative p-[1px] rounded-[32px] bg-gradient-to-b from-white/[0.15] to-white/[0.02]">
              <div
                className="relative rounded-[31px] py-20 px-10 md:py-24 md:px-16 text-center overflow-hidden"
                style={{
                  background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)',
                  backdropFilter: 'blur(40px)',
                }}
              >
                {/* Inner glow */}
                <div className="absolute inset-0 rounded-[31px] overflow-hidden">
                  <div className="absolute top-0 left-1/4 w-1/2 h-1/2 bg-[#E8DCC4]/[0.04] blur-3xl" />
                </div>

                <div className="relative">
                  <h2 className="text-3xl md:text-5xl font-light tracking-[-0.03em] mb-6">
                    Ready for the future
                    <br />
                    <span className="text-[#5A5A5A]">of email?</span>
                  </h2>
                  <p className="text-[#8A8A8A] text-lg mb-10">Join the waitlist for early access.</p>
                  <Button
                    className="bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] font-medium rounded-xl px-10 h-14 text-base shadow-2xl shadow-white/10 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Get early access
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
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
    </div>
  )
}
