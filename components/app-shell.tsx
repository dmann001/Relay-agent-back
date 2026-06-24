"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Send } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { AiInboxChat } from "@/components/ai-inbox-chat"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMaximized, setChatMaximized] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)

  const pageContext = useMemo(() => {
    if (pathname === "/inbox") return "Inbox page. Help triage unread mail, summarize inbox state, draft replies, and explain the selected email when one is open."
    if (pathname === "/sent") return "Sent page. Help search sent mail, summarize sent conversations, draft follow-ups, and reason about previous replies."
    if (pathname === "/drafts") return "Drafts page. Help review, improve, finish, and send saved draft emails."
    if (pathname === "/archives") return "Archives page. Help find archived mail and recover context from older conversations."
    if (pathname === "/trash") return "Trash page. Help inspect deleted mail and decide what should be restored or ignored."
    if (pathname === "/calendar") return "Calendar page. Help schedule meetings, prepare agendas, and connect email commitments to calendar events."
    if (pathname === "/commitments") return "Commitments page. Help track promises, due dates, follow-ups, and unresolved obligations from email."
    if (pathname === "/briefs") return "Meeting briefs page. Help prepare for meetings using related email and calendar context."
    if (pathname === "/activity") return "Agent activity page. Help explain background agent work, approvals, failures, and next actions."
    if (pathname.startsWith("/settings")) return "Settings page. Help configure connected accounts, AI preferences, model settings, and personalization."
    if (pathname.startsWith("/thread/")) return "Email thread page. Help summarize the current thread, draft replies, extract tasks, and answer questions about this conversation."
    if (pathname === "/ai-chat") return "AI chat history page. Help resume, compare, or clean up previous Relay conversations."
    return "Relay workspace page. Help the user based on the current page and any selected email context."
  }, [pathname])

  const selectedMessageId = searchParams.get("message") || (pathname.startsWith("/thread/") ? pathname.split("/").pop() || null : null)
  const accountId = searchParams.get("messageAccount") || searchParams.get("account") || undefined

  useEffect(() => {
    const openChat = () => setChatOpen(true)
    window.addEventListener("relay-open-ai-chat", openChat)
    return () => window.removeEventListener("relay-open-ai-chat", openChat)
  }, [])

  useEffect(() => {
    if (searchParams.get("assistant") !== "chat") return
    setChatOpen(true)
    setChatSessionId(searchParams.get("chatSession"))
    setChatMaximized(searchParams.get("chatSize") === "max")
  }, [searchParams])

  return (
    <div className="flex h-screen min-h-0 bg-background text-foreground">
      <div className="hidden h-full shrink-0 lg:flex">
        <AppSidebar />
      </div>
      <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        {children}
      </div>
      {chatOpen ? (
        <div
          className={cn(
            "fixed z-50",
            chatMaximized
              ? "inset-x-3 bottom-3 top-3 lg:left-[calc(240px+0.75rem)]"
              : "bottom-3 right-3 h-[min(46rem,calc(100vh-1.5rem))] w-[min(31rem,calc(100vw-1.5rem))]",
          )}
        >
          <AiInboxChat
            accountId={accountId}
            messageId={selectedMessageId || undefined}
            sessionId={chatSessionId || undefined}
            pageContext={pageContext}
            variant="floating"
            maximized={chatMaximized}
            onToggleMaximize={() => setChatMaximized((maximized) => !maximized)}
            onClose={() => setChatOpen(false)}
            onSessionChange={setChatSessionId}
          />
        </div>
      ) : (
        <div className="fixed bottom-20 right-3 z-40 lg:bottom-3">
          <Button
            onClick={() => setChatOpen(true)}
            className="h-10 rounded-lg border border-white/10 bg-neutral-950 px-3 text-white shadow-xl shadow-black/20 hover:bg-neutral-900 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100"
          >
            <Send className="h-4 w-4" />
            Ask Relay
          </Button>
        </div>
      )}
      <MobileBottomNav />
    </div>
  )
}
