"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(value).toLocaleDateString()
}
import { Bot, Loader2, MessageSquarePlus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { emailApi, type AiChatSessionSummary } from "@/lib/email-api"

export function AiChatHistoryContent() {
  const [sessions, setSessions] = useState<AiChatSessionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadSessions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await emailApi.listAiChatSessions()
      setSessions(response.sessions)
    } catch (requestError: any) {
      setError(requestError.message || "Could not load chat history.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSessions()
  }, [loadSessions])

  const deleteSession = async (sessionId: string) => {
    setDeletingId(sessionId)
    try {
      await emailApi.deleteAiChatSession(sessionId)
      setSessions((current) => current.filter((session) => session.id !== sessionId))
    } catch (requestError: any) {
      setError(requestError.message || "Could not delete this chat.")
    } finally {
      setDeletingId(null)
    }
  }

  const resumeHref = (session: AiChatSessionSummary) => {
    const params = new URLSearchParams({ assistant: "chat", chatSession: session.id })
    if (session.messageId) {
      params.set("message", session.messageId)
      if (session.accountId) params.set("messageAccount", session.accountId)
    } else if (session.accountId) {
      params.set("account", session.accountId)
    }
    return `/inbox?${params.toString()}`
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand" />
              <h1 className="text-xl font-semibold text-foreground">AI chat history</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Resume a previous Relay AI conversation or start a new one.
            </p>
          </div>
          <Button asChild className="bg-brand text-brand-foreground hover:bg-brand-strong">
            <Link href="/inbox?assistant=chat">
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              New chat
            </Link>
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading chats...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bot className="h-10 w-10 text-brand" />
            <p className="mt-4 text-sm font-medium text-foreground">No chats yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Start a conversation from the inbox AI panel. Your chats will appear here automatically.
            </p>
            <Button asChild className="mt-4">
              <Link href="/inbox?assistant=chat">Open Relay AI</Link>
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-surface-subtle/60"
              >
                <Link href={resumeHref(session)} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{session.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {session.preview || "No preview available"}
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {formatRelativeTime(session.updatedAt)}
                    {session.messageId ? " · Email context" : " · Inbox chat"}
                  </div>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${session.title}`}
                  disabled={deletingId === session.id}
                  onClick={() => void deleteSession(session.id)}
                >
                  {deletingId === session.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
