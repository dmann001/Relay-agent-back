"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  CheckSquare,
  Inbox,
  Mail,
  Menu,
  NotebookTabs,
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

const features = [
  {
    icon: Inbox,
    title: "Unified inbox",
    description:
      "Connect Gmail and Outlook. Read, compose, and organize mail from one calm workspace.",
  },
  {
    icon: Sparkles,
    title: "Inbox brief",
    description:
      "Start each session with a concise overview — what needs a reply, what is due, what matters.",
  },
  {
    icon: Mail,
    title: "Thread assistant",
    description:
      "Summarize long threads, draft replies in your voice, extract tasks, and ask questions in context.",
  },
  {
    icon: CheckSquare,
    title: "Commitments",
    description:
      "Turn email obligations into tracked tasks with due dates, snooze, and follow-up monitoring.",
  },
  {
    icon: NotebookTabs,
    title: "Meeting briefs",
    description:
      "Generate preparation notes from related threads so you walk into meetings informed.",
  },
  {
    icon: Bot,
    title: "Agent activity",
    description:
      "Background agents log their work and wait for your approval before taking action.",
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

function ProductMockup({ variant }: { variant: "hero" | "feature" }) {
  return (
    <div
      className={
        variant === "hero"
          ? "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm"
          : "relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50"
      }
    >
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-100 via-white to-neutral-100" />
      <div className="absolute inset-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-neutral-300" />
          <div className="h-2 w-2 rounded-full bg-neutral-300" />
          <div className="h-2 w-2 rounded-full bg-neutral-300" />
        </div>
        <div className="flex flex-1 gap-3">
          <div className="hidden w-1/4 space-y-2 sm:block">
            <div className="h-2 w-full rounded bg-neutral-200" />
            <div className="h-2 w-3/4 rounded bg-neutral-200" />
            <div className="h-2 w-5/6 rounded bg-neutral-200" />
            <div className="mt-4 h-2 w-full rounded bg-neutral-300" />
            <div className="h-2 w-2/3 rounded bg-neutral-200" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-3 w-1/3 rounded bg-neutral-300" />
            <div className="flex-1 rounded-md border border-neutral-200 bg-white p-3">
              <div className="space-y-2">
                <div className="h-2 w-full rounded bg-neutral-100" />
                <div className="h-2 w-5/6 rounded bg-neutral-100" />
                <div className="h-2 w-4/6 rounded bg-neutral-100" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="light relative min-h-screen bg-[#fafafa] text-[#0a0a0a] selection:bg-neutral-200">
      <header className="sticky top-0 z-50 border-b border-neutral-200/80 bg-[#fafafa]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900">
              <Mail className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-medium tracking-tight">Relay</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#product"
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Product
            </Link>
            <Link
              href="#faq"
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              FAQ
            </Link>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login?tab=signup">Sign up</Link>
            </Button>
          </div>

          <button
            type="button"
            className="md:hidden"
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

        {mobileMenuOpen && (
          <div className="border-t border-neutral-200 bg-[#fafafa] px-6 py-4 md:hidden">
            <nav className="flex flex-col gap-4">
              <Link
                href="#product"
                className="text-sm text-neutral-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                Product
              </Link>
              <Link
                href="#faq"
                className="text-sm text-neutral-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                FAQ
              </Link>
              <div className="flex flex-col gap-2 pt-2">
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

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <div
              className={`space-y-6 transition-all duration-700 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              <p className="text-sm text-neutral-500">AI email workspace</p>
              <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] font-light leading-[1.05] tracking-[-0.03em] text-neutral-900">
                Email, distilled
                <br />
                to what matters.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-neutral-500">
                Relay unifies Gmail and Outlook with quiet AI — briefs, drafts,
                commitments, and meeting prep in one minimal workspace.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button asChild>
                  <Link href="/login?tab=signup">
                    Get started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="#product">See the product</Link>
                </Button>
              </div>
            </div>

            <div
              className={`transition-all duration-700 delay-150 ${isLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              <ProductMockup variant="hero" />
            </div>
          </div>
        </section>

        <section id="product" className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-24 md:py-32">
            <div className="mb-16 max-w-lg">
              <p className="mb-3 text-sm text-neutral-500">Product</p>
              <h2 className="text-2xl font-light tracking-tight text-neutral-900 md:text-3xl">
                Everything you need to stay on top of mail — nothing you do not.
              </h2>
            </div>

            <div className="grid gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 md:grid-cols-2">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.title}
                    className="flex flex-col gap-4 bg-white p-8 md:p-10"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
                      <Icon className="h-4 w-4 text-neutral-700" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-medium text-neutral-900">
                        {feature.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-neutral-500">
                        {feature.description}
                      </p>
                    </div>
                    <ProductMockup variant="feature" />
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-neutral-200">
          <div className="mx-auto max-w-2xl px-6 py-24 md:py-32">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm text-neutral-500">FAQ</p>
              <h2 className="text-2xl font-light tracking-tight text-neutral-900 md:text-3xl">
                Common questions
              </h2>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`item-${index}`}>
                  <AccordionTrigger className="text-neutral-900 hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
            <h2 className="text-2xl font-light tracking-tight text-neutral-900 md:text-3xl">
              Ready to simplify your inbox?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-neutral-500">
              Create a free account and connect your mail in minutes.
            </p>
            <Button className="mt-8" asChild>
              <Link href="/login?tab=signup">
                Sign up
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 px-6 py-10 md:flex-row md:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-neutral-900">
              <Mail className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm text-neutral-500">Relay</span>
          </div>

          <nav className="flex flex-wrap items-center gap-6">
            <Link
              href="#product"
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Product
            </Link>
            <Link
              href="#faq"
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              FAQ
            </Link>
            <Link
              href="/login"
              className="text-sm text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Sign in
            </Link>
          </nav>

          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <Link href="#" className="hover:text-neutral-600">
              Privacy
            </Link>
            <Link href="#" className="hover:text-neutral-600">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
