"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { api } from "@/lib/api"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  CheckCircle2,
  HelpCircle,
  Calendar,
  ListTodo,
  Bell,
  Heart,
  Loader2,
  Terminal,
  Activity,
  Layers,
  User,
  ShieldAlert,
  Inbox,
  Star,
} from "lucide-react"

import type { AgentMemory, Email, EmailIntent } from "@/types"
import { CommandInput } from "./command-input"
import { IntentGrid } from "./intent-grid"
import { PriorityFeed } from "./priority-feed"
import { AmbientIndicators } from "./ambient-indicators"

const intentConfig: Record<EmailIntent, { label: string; icon: typeof CheckCircle2; color: string; bgColor: string }> = {
  decision: {
    label: "Decisions Needed",
    icon: CheckCircle2,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  info_request: {
    label: "Information Requests",
    icon: HelpCircle,
    color: "text-[#E8DCC4]",
    bgColor: "bg-[#E8DCC4]/10",
  },
  meeting: {
    label: "Meeting Coordination",
    icon: Calendar,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  action_item: {
    label: "Action Items",
    icon: ListTodo,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  update: {
    label: "Updates Only",
    icon: Bell,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  relationship: {
    label: "Relationship Maintenance",
    icon: Heart,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
  },
  unknown: {
    label: "Uncategorized",
    icon: HelpCircle,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
}

interface Message {
  id: string
  type: "user" | "ai"
  content: string
  timestamp: Date
  data?: any
}

export function RelayedHub() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [emails, setEmails] = useState<Email[]>([])
  const [userContext, setUserContext] = useState("")
  const [agentMemory, setAgentMemory] = useState<AgentMemory>(storage.getAgentMemory())
  const [lastSync, setLastSync] = useState<string | undefined>(storage.getData()?.lastSync)
  const [intentCounts, setIntentCounts] = useState<Record<EmailIntent, number>>({
    decision: 0,
    info_request: 0,
    meeting: 0,
    action_item: 0,
    update: 0,
    relationship: 0,
    unknown: 0,
  })
  const [activeView, setActiveView] = useState<"command" | "intents" | "priority">("command")
  const isClassifyingRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const refreshEmails = () => {
    const loadedEmails = storage.getNonArchivedEmails()
    setEmails(loadedEmails)
    setLastSync(storage.getData()?.lastSync)

    const counts: Record<EmailIntent, number> = {
      decision: 0,
      info_request: 0,
      meeting: 0,
      action_item: 0,
      update: 0,
      relationship: 0,
      unknown: 0,
    }

    loadedEmails.forEach((email) => {
      const intent = email.intent || "unknown"
      counts[intent] = (counts[intent] || 0) + 1
    })

    setIntentCounts(counts)
    return loadedEmails
  }

  useEffect(() => {
    const loadedEmails = refreshEmails()
    const settings = storage.getSettings()
    setUserContext(settings.userContext || "")
    if (!storage.getAgentMemory().summary && settings.userContext) {
      storage.updateAgentMemory({ summary: settings.userContext })
    }
    setAgentMemory(storage.getAgentMemory())

    setMessages([
      {
        id: "welcome",
        type: "ai",
        content: `Relayed is online. ${loadedEmails.length} messages indexed. Ask for priorities, decisions, or a clean sweep.`,
        timestamp: new Date(),
      },
    ])
  }, [])

  useEffect(() => {
    const onStorageUpdate = () => {
      refreshEmails()
      const settings = storage.getSettings()
      setUserContext(settings.userContext || "")
      setAgentMemory(storage.getAgentMemory())
      setLastSync(storage.getData()?.lastSync)
    }
    window.addEventListener("relay-storage-updated", onStorageUpdate)
    return () => window.removeEventListener("relay-storage-updated", onStorageUpdate)
  }, [])

  useEffect(() => {
    const settings = storage.getSettings()
    const missingIntents = emails.filter((email) => !email.intent)
    if (missingIntents.length === 0 || !settings.openaiApiKey || isClassifyingRef.current) return

    isClassifyingRef.current = true
    const runClassification = async () => {
      try {
        const results = await api.ai.batchClassifyIntents(missingIntents, settings.openaiApiKey)
        const intentMap = new Map(results.map((r) => [r.emailId, r.intent]))
        missingIntents.forEach((email) => {
          const intent = intentMap.get(email.id)
          if (!intent) return
          const requiresResponse = ["decision", "info_request", "meeting", "action_item"].includes(intent)
          storage.updateEmail(email.id, { intent, requiresResponse })
        })
        refreshEmails()
      } catch (error) {
        console.error("[Relayed] Intent classification failed:", error)
      } finally {
        isClassifyingRef.current = false
      }
    }

    runClassification()
  }, [emails])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleCommand = async (command: string) => {
    if (!command.trim() || isProcessing) return

    storage.recordAgentCommand(command)
    setAgentMemory(storage.getAgentMemory())

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: "user",
      content: command,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsProcessing(true)

    if (!storage.getSettings().openaiApiKey) {
      return {
        content: "Add your OpenAI API key in Settings to unlock contextual responses.",
      }
    }

    try {
      const response = await processCommand(command)
      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        type: "ai",
        content: response.content,
        timestamp: new Date(),
        data: response.data,
      }
      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error("Command processing error:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          type: "ai",
          content: "Something interrupted the flow. Try that command again.",
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsProcessing(false)
    }
  }

  const processCommand = async (command: string): Promise<{ content: string; data?: any }> => {
    const lowerCommand = command.toLowerCase()
    const settings = storage.getSettings()
    const memory = storage.getAgentMemory()

    if (lowerCommand.includes("attention") || lowerCommand.includes("important") || lowerCommand.includes("urgent")) {
      const priorityEmails = emails
        .filter((e) => (e.priorityScore || 0) >= 70 || e.sentiment?.urgency === "high" || e.sentiment?.urgency === "critical")
        .slice(0, 5)

      if (priorityEmails.length === 0) {
        return { content: "All clear. No urgent items are spiking right now." }
      }

      return {
        content: `These need focus next:\n- ${priorityEmails.map((e) => `${e.from.name}: ${e.subject}`).join("\n- ")}`,
        data: { emails: priorityEmails },
      }
    }

    if (lowerCommand.includes("decision")) {
      const decisionEmails = storage.getEmailsByIntent("decision")
      if (decisionEmails.length === 0) {
        return { content: "No pending decisions detected." }
      }
      return {
        content: `Decisions waiting:\n- ${decisionEmails.slice(0, 5).map((e) => `${e.from.name}: ${e.subject}`).join("\n- ")}`,
        data: { emails: decisionEmails.slice(0, 5) },
      }
    }

    if (lowerCommand.includes("summar")) {
      const unreadCount = emails.filter((e) => !e.read).length
      const vipCount = storage.getVipEmails().length
      const requiresResponse = emails.filter((e) => e.requiresResponse).length
      return {
        content: `Snapshot:\n- ${emails.length} total messages\n- ${unreadCount} unread\n- ${vipCount} VIP threads\n- ${requiresResponse} need replies\n\nIntent spread:\n- ${Object.entries(intentCounts)
          .filter(([_, count]) => count > 0)
          .map(([intent, count]) => `${intentConfig[intent as EmailIntent]?.label || intent}: ${count}`)
          .join("\n- ")}`,
      }
    }

    if (lowerCommand.includes("vip")) {
      const vipEmails = storage.getVipEmails()
      if (vipEmails.length === 0) return { content: "No VIP messages right now." }
      return {
        content: `VIP threads:\n- ${vipEmails.slice(0, 5).map((e) => `${e.from.name}: ${e.subject}`).join("\n- ")}`,
        data: { emails: vipEmails.slice(0, 5) },
      }
    }

    if (lowerCommand.includes("search") || lowerCommand.includes("find")) {
      const searchTerm = command.replace(/search|find|emails?|about|for/gi, "").trim()
      if (!searchTerm) {
        return { content: "Tell me what to search for. Example: 'Find emails about Q3 budget'." }
      }

      try {
        const results = await api.ai.searchEmails(searchTerm, 5)
        if (results.length === 0) {
          return { content: `No matches for "${searchTerm}".` }
        }
        const localEmails = storage.getEmails()
        const mapped = results
          .map((r: any) => localEmails.find((e) => e.id === r.id))
          .filter((e): e is Email => !!e)
        return {
          content: `Matches for "${searchTerm}":\n- ${mapped.map((e) => `${e.from.name}: ${e.subject}`).join("\n- ")}`,
          data: { emails: mapped },
        }
      } catch {
        return { content: "Search is offline right now. Try again later." }
      }
    }

    if (lowerCommand.includes("draft") || lowerCommand.includes("reply")) {
      return {
        content: "Open a thread and tap Reply to draft with context. I can build a response there.",
      }
    }

    if (lowerCommand.includes("unread")) {
      const unread = emails.filter((e) => !e.read)
      if (unread.length === 0) return { content: "Inbox zero. Nothing unread." }
      return {
        content: `Unread right now:\n- ${unread.slice(0, 5).map((e) => `${e.from.name}: ${e.subject}`).join("\n- ")}`,
        data: { emails: unread.slice(0, 5) },
      }
    }

    if (lowerCommand.includes("meeting")) {
      const meetingEmails = emails.filter((e) => e.meetingRequest?.detected)
      if (meetingEmails.length === 0) return { content: "No meeting requests flagged." }
      return {
        content: `Meeting threads:\n- ${meetingEmails.slice(0, 5).map((e) => `${e.from.name}: ${e.subject}`).join("\n- ")}`,
        data: { emails: meetingEmails.slice(0, 5) },
      }
    }

    if (lowerCommand.includes("mark read") || lowerCommand.includes("clear unread")) {
      const unread = emails.filter((e) => !e.read)
      if (unread.length === 0) return { content: "No unread messages to clear." }
      storage.bulkMarkRead(unread.map((e) => e.id), true)
      refreshEmails()
      return { content: `Marked ${unread.length} as read.` }
    }

    if (lowerCommand.includes("archive") || lowerCommand.includes("clean up")) {
      try {
        const candidates = await api.ai.suggestArchive(emails)
        if (candidates.length === 0) return { content: "Nothing safe to archive right now." }
        storage.bulkArchiveEmails(candidates)
        refreshEmails()
        return { content: `Archived ${candidates.length} threads.` }
      } catch {
        return { content: "Auto-archive is unavailable right now." }
      }
    }

    try {
      const intentSummary = Object.entries(intentCounts).reduce((acc, [intent, count]) => {
        if (count > 0) acc[intent] = count
        return acc
      }, {} as Record<string, number>)

      const topEmails = [...emails]
        .map((email) => {
          const urgencyBoost = email.sentiment?.urgency === "critical" ? 30 : email.sentiment?.urgency === "high" ? 20 : 0
          const score = (email.priorityScore || 0) + (email.requiresResponse ? 15 : 0) + (!email.read ? 10 : 0) + urgencyBoost
          return { email, score }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(({ email }) => ({
          id: email.id,
          subject: email.subject,
          from: email.from.name || email.from.email,
          date: new Date(email.date).toISOString(),
          intent: email.intent,
          priority: email.priorityScore,
          snippet: (email.bodyPlain || email.body || "").replace(/<[^>]*>/g, "").slice(0, 160),
        }))

      const aiResponse = await api.ai.processCommand(command, emails, settings.userContext, settings.openaiApiKey, {
        memorySummary: memory.summary || settings.userContext || "",
        recentCommands: memory.recentCommands,
        inboxSnapshot: {
          total: emails.length,
          unread: emails.filter((e) => !e.read).length,
          requiresResponse: emails.filter((e) => e.requiresResponse).length,
          vipCount: storage.getVipEmails().length,
          intents: intentSummary,
          lastSync,
        },
        topEmails,
      })
      return { content: aiResponse.response }
    } catch (error) {
      return {
        content:
          "Try: \n- What needs my attention?\n- Summarize my inbox\n- Find emails about [topic]\n- Show decisions needed\n- Show meetings",
      }
    }
  }

  const renderMessageContent = (content: string) => {
    const cleaned = content
      .replace(/```/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
    const lines = cleaned.split("\n")
    const blocks: Array<{ type: "p" | "list" | "hr"; value: string[] }> = []
    let currentList: string[] = []

    const flushList = () => {
      if (currentList.length > 0) {
        blocks.push({ type: "list", value: currentList })
        currentList = []
      }
    }

    lines.forEach((raw) => {
      const line = raw.trim()
      if (!line) {
        flushList()
        return
      }
      if (line === "---" || line === "----") {
        flushList()
        blocks.push({ type: "hr", value: [] })
        return
      }
      if (line.startsWith("- ") || line.startsWith("• ") || /^\d+\.\s/.test(line)) {
        currentList.push(line.replace(/^(- |• |\d+\.\s)/, ""))
        return
      }
      flushList()
      blocks.push({ type: "p", value: [line] })
    })
    flushList()

    return (
      <div className="space-y-3 text-foreground">
        {blocks.map((block, idx) => {
          if (block.type === "hr") {
            return <div key={`hr_${idx}`} className="h-px bg-white/10" />
          }
          if (block.type === "list") {
            return (
              <ul key={`list_${idx}`} className="space-y-1 text-sm text-foreground/80">
                {block.value.map((item, itemIdx) => (
                  <li key={`li_${idx}_${itemIdx}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )
          }
          return (
            <p key={`p_${idx}`} className="text-sm leading-relaxed text-foreground/80">
              {block.value.join(" ")}
            </p>
          )
        })}
      </div>
    )
  }

  const quickSuggestions = useMemo(() => {
    const unread = emails.filter((e) => !e.read).length
    const vip = storage.getVipEmails().length
    return [
      unread > 0 ? `Show ${Math.min(unread, 5)} unread emails` : "Summarize my inbox",
      vip > 0 ? "Show VIP messages" : "What needs my attention?",
      "Show decisions needed",
      "Show meeting requests",
      "Find emails about budgets",
    ]
  }, [emails])

  const focusEmails = useMemo(() => {
    return [...emails]
      .filter((email) => !email.isArchived)
      .map((email) => {
        const urgencyBoost = email.sentiment?.urgency === "critical" ? 30 : email.sentiment?.urgency === "high" ? 20 : 0
        const score = (email.priorityScore || 0) + (email.requiresResponse ? 15 : 0) + (!email.read ? 10 : 0) + urgencyBoost
        return { email, score }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ email }) => email)
  }, [emails])

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0A0A0B] text-[#FAFAF9] selection:bg-[#E8DCC4]/20 relative"
      style={{
        backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='32' height='32' fill='none' stroke='rgba(255, 255, 255, 0.02)'%3e%3cpath d='M0 .5H31.5V32'/%3e%3c/svg%3e\")",
      }}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0A0A0B]/80 via-transparent to-[#0A0A0B]/80" />

      {/* Terminal Header */}
      <div className="relative z-10 px-6 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] shadow-[0_0_15px_rgba(232,220,196,0.2)]">
            <Terminal className="h-4 w-4 text-[#0A0A0B]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#E8DCC4] font-bold">Relay Terminal</span>
            <span className="text-[10px] font-mono text-[#5A5A5A]">v2.4.0 <span className="text-[#28C840]">BETA</span></span>
          </div>
        </div>

        {/* View Switcher - Floating Center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex gap-1 bg-[#0A0A0B]/80 backdrop-blur-md p-1 rounded-full border border-white/[0.04]">
          {[
            { id: "command", label: "TERMINAL", icon: Terminal },
            { id: "intents", label: "INTENTS", icon: Layers },
            { id: "priority", label: "PRIORITY", icon: Activity },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-mono font-medium transition-all flex items-center gap-1.5",
                activeView === view.id
                  ? "bg-white/[0.06] text-[#E8DCC4]"
                  : "text-[#5A5A5A] hover:text-[#FAFAF9]"
              )}
            >
              {view.label}
            </button>
          ))}
        </div>

        {/* System Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0A0B]/80 border border-white/[0.08] backdrop-blur-sm shadow-sm">
          <div className="h-1.5 w-1.5 rounded-full bg-[#28C840] animate-pulse shadow-[0_0_8px_#28C840]" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#5A5A5A]">System Online</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,_rgba(232,220,196,0.06),_transparent_55%),radial-gradient(circle_at_20%_20%,_rgba(196,160,82,0.05),_transparent_45%)]" />

        {activeView === "command" && (
          <div className="flex h-full min-h-0 flex-col">
            <AmbientIndicators emails={emails} />

            <div className="border-b border-white/[0.04] bg-white/[0.02] px-4 py-3">
              <div className="mx-auto max-w-5xl grid gap-3 md:grid-cols-3">
                <div className="border border-white/[0.06] bg-[#0A0A0B] p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8A8A8A]">
                    <User className="h-3 w-3" />
                    Memory Profile
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-[#8A8A8A] line-clamp-2">
                    {agentMemory.summary || userContext || "Add your context in Settings to personalize responses."}
                  </p>
                  <Link
                    href="/settings"
                    className="mt-2 inline-flex text-[10px] uppercase tracking-wider text-[#E8DCC4] hover:text-[#F5EDD8]"
                  >
                    Update profile
                  </Link>
                </div>
                <div className="border border-white/[0.06] bg-[#0A0A0B] p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8A8A8A]">
                    <Inbox className="h-3 w-3" />
                    Inbox Snapshot
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#8A8A8A]">
                    <div>
                      Unread: <span className="text-[#FAFAF9]">{emails.filter((e) => !e.read).length}</span>
                    </div>
                    <div>
                      Needs reply:{" "}
                      <span className="text-[#FAFAF9]">{emails.filter((e) => e.requiresResponse).length}</span>
                    </div>
                    <div>
                      VIP: <span className="text-[#FAFAF9]">{storage.getVipEmails().length}</span>
                    </div>
                    <div>
                      Last sync:{" "}
                      <span className="text-[#FAFAF9]">{lastSync ? new Date(lastSync).toLocaleDateString() : "unknown"}</span>
                    </div>
                  </div>
                </div>
                <div className="border border-white/[0.06] bg-[#0A0A0B] p-3 rounded-xl">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#8A8A8A]">
                    <ShieldAlert className="h-3 w-3" />
                    Focus Queue
                  </div>
                  <div className="mt-2 space-y-2 text-xs text-[#8A8A8A]">
                    {focusEmails.length === 0 ? (
                      <div className="text-[#5A5A5A]">No urgent items.</div>
                    ) : (
                      focusEmails.map((email) => (
                        <Link
                          key={email.id}
                          href={`/thread/${email.id}`}
                          className="flex items-center justify-between gap-2 hover:text-[#E8DCC4]"
                        >
                          <span className="truncate">{email.subject}</span>
                          {email.priorityScore && email.priorityScore >= 70 && (
                            <Star className="h-3 w-3 text-[#E8DCC4]" />
                          )}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0 px-4 py-6 scrollbar-none">
              <div className="mx-auto max-w-5xl space-y-6 pb-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn("flex gap-4 animate-fade-in-up", message.type === "user" ? "justify-end" : "justify-start")}
                  >
                    <div className={cn("shrink-0 mt-1", message.type === "user" && "order-2")}>
                      {message.type === "ai" ? (
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                          <Terminal className="h-4 w-4 text-[#0A0A0B]" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.06]">
                          <div className="h-4 w-4 rounded-full bg-gradient-to-br from-[#5A5A5A] to-[#3A3A3A]" />
                        </div>
                      )}
                    </div>

                    <div className={cn("space-y-3 max-w-3xl", message.type === "user" ? "order-1" : "")}>
                      <div
                        className={cn(
                          "rounded-2xl border px-4 py-3",
                          message.type === "ai"
                            ? "rounded-2xl rounded-tl-sm border-white/[0.06] bg-[#0A0A0B] text-[#FAFAF9] font-mono text-sm leading-relaxed shadow-lg"
                            : "rounded-2xl rounded-tr-sm border-transparent bg-[#FAFAF9] text-[#0A0A0B] font-medium"
                        )}
                      >
                        {message.type === "ai" && (
                          <p className="text-[#E8DCC4] text-[11px] font-semibold tracking-[0.3em] uppercase mb-2">
                            Relayed
                          </p>
                        )}
                        {renderMessageContent(message.content)}
                        <span className="mt-3 block text-[10px] uppercase tracking-[0.2em] text-[#5A5A5A]">
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {message.data?.emails && (
                        <div className="grid gap-3 md:grid-cols-2">
                          {message.data.emails.slice(0, 4).map((email: Email, i: number) => (
                            <div
                              key={email.id}
                              className="border border-white/[0.06] bg-white/[0.02] rounded-xl p-3 hover:border-[#E8DCC4]/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[#E8DCC4] text-[10px] font-semibold">
                                      #{String(i + 1).padStart(2, "0")}
                                    </span>
                                    <span className="text-sm font-medium text-[#FAFAF9] line-clamp-1">{email.subject}</span>
                                  </div>
                                  <p className="mt-1 text-xs text-[#8A8A8A]">
                                    {email.from.name} • {new Date(email.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#8A8A8A]">
                                <Link href={`/thread/${email.id}`} className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]">
                                  Open
                                </Link>
                                <button
                                  onClick={() => {
                                    storage.archiveEmail(email.id)
                                    refreshEmails()
                                  }}
                                  className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                                >
                                  Archive
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isProcessing && (
                  <div className="flex gap-4 animate-fade-in-up">
                    <div className="shrink-0 mt-1">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#E8DCC4] to-[#C4A052]">
                        <Terminal className="h-4 w-4 text-[#0A0A0B]" />
                      </div>
                    </div>
                    <div className="space-y-2 max-w-3xl">
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <p className="text-[#E8DCC4] text-[11px] font-semibold tracking-[0.3em] uppercase mb-2">
                          Relayed
                        </p>
                        <div className="flex items-center gap-2 text-[#8A8A8A] text-sm">
                          <Loader2 className="h-4 w-4 animate-spin text-[#E8DCC4]" />
                          <span className="animate-pulse">Processing signal stream...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-white/[0.04] bg-[#0A0A0B] p-4">
              <div className="mx-auto max-w-5xl">
                <CommandInput onSubmit={handleCommand} isProcessing={isProcessing} suggestions={quickSuggestions} />
              </div>
            </div>
          </div>
        )}

        {activeView === "intents" && (
          <div className="p-6 h-full overflow-y-auto bg-[#0A0A0B]">
            <IntentGrid emails={emails} intentConfig={intentConfig} />
          </div>
        )}

        {activeView === "priority" && (
          <div className="p-6 h-full overflow-y-auto bg-[#0A0A0B]">
            <PriorityFeed emails={emails} />
          </div>
        )}
      </div>
    </div>
  )
}
