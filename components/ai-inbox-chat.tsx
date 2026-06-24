"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Bot,
  Box,
  CalendarDays,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ComposeDialog } from "@/components/compose-dialog"
import { AiChatComposer, AiChatContextAttachments, AiChatMessages, useAiChat } from "@/components/ai-chat-shared"
import type { AiChatDraft } from "@/components/ai-chat-shared"
import { emailApi, type AiChatSessionSummary } from "@/lib/email-api"
import { cn } from "@/lib/utils"

interface AiInboxChatProps {
  accountId?: string
  messageId?: string
  subject?: string
  sessionId?: string
  pageContext?: string
  edge?: "start" | "end"
  variant?: "split" | "floating"
  maximized?: boolean
  onClose: () => void
  onToggleMaximize?: () => void
  onSessionChange?: (sessionId: string | null) => void
}

const starterPrompts = [
  { label: "Create a draft", prompt: "Draft a concise reply to the current email.", icon: Box },
  { label: "Schedule a meeting", prompt: "Schedule a 30 minute meeting from this email context.", icon: CalendarDays },
  { label: "Research a topic", prompt: "Research this topic and summarize what matters.", icon: Search },
  { label: "Summarize inbox", prompt: "Summarize what needs attention in my inbox.", icon: Zap },
]

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(value).toLocaleDateString()
}

export function AiInboxChat({
  accountId,
  messageId,
  subject,
  sessionId: initialSessionId,
  pageContext,
  edge = "start",
  variant = "split",
  maximized = false,
  onClose,
  onToggleMaximize,
  onSessionChange,
}: AiInboxChatProps) {
  const [composeDraft, setComposeDraft] = useState<AiChatDraft | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sessions, setSessions] = useState<AiChatSessionSummary[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const chat = useAiChat({
    accountId,
    messageId,
    pageContext,
    initialSessionId,
    onSessionId: (sessionId) => onSessionChange?.(sessionId),
  })

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const response = await emailApi.listAiChatSessions(20)
      setSessions(response.sessions)
    } catch (error: any) {
      setHistoryError(error.message || "Could not load chat history.")
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (historyOpen) void loadHistory()
  }, [historyOpen, loadHistory])

  const deleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId)
    try {
      await emailApi.deleteAiChatSession(sessionId)
      setSessions((current) => current.filter((session) => session.id !== sessionId))
      if (initialSessionId === sessionId) {
        chat.startNewChat()
        onSessionChange?.(null)
      }
    } catch (error: any) {
      setHistoryError(error.message || "Could not delete this chat.")
    } finally {
      setDeletingSessionId(null)
    }
  }

  return (
    <div className={cn(
      "dark flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
      variant === "split" && (edge === "end" ? "border-l border-border" : "border-r border-border"),
      variant === "floating" && "rounded-xl border border-white/10 bg-[#111111] text-neutral-100 shadow-2xl shadow-black/50",
    )}>
      <ComposeDialog
        open={Boolean(composeDraft)}
        onOpenChange={(open) => {
          if (!open) setComposeDraft(null)
        }}
        defaultAccountId={composeDraft?.accountId || accountId}
        initialDraft={composeDraft ? {
          accountId: composeDraft.accountId || accountId,
          to: composeDraft.to,
          cc: composeDraft.cc,
          subject: composeDraft.subject,
          body: composeDraft.body,
          generatedDraft: composeDraft.generatedDraft,
          generatedDraftId: composeDraft.generatedDraftId,
        } : undefined}
      />
      <header className="relative flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-[#111111] px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-neutral-100">New chat</h1>
          <p className="truncate text-xs text-neutral-500">
            {messageId
              ? `Current email${subject ? ` · ${subject}` : ""}`
              : pageContext || "Current Relay page"}
          </p>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 text-neutral-400 hover:bg-white/5 hover:text-neutral-100",
              historyOpen && "bg-white/5 text-neutral-100",
            )}
            onClick={() => setHistoryOpen((open) => !open)}
            aria-label="Chat history"
            title="Chat history"
          >
            <History className="h-4 w-4" />
          </Button>
          {historyOpen && (
            <div className="absolute right-0 top-10 z-30 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#151515] text-neutral-100 shadow-2xl shadow-black/50">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                <span className="text-xs font-medium text-neutral-300">Chat history</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-neutral-500 hover:bg-white/5 hover:text-neutral-100"
                  onClick={() => setHistoryOpen(false)}
                  aria-label="Close history"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="max-h-80 overflow-y-auto p-1.5">
                {historyLoading ? (
                  <div className="flex items-center justify-center px-3 py-8 text-xs text-neutral-500">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Loading chats...
                  </div>
                ) : historyError ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                    {historyError}
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="px-3 py-8 text-center text-xs text-neutral-500">No chats yet.</div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        "group flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/5",
                        initialSessionId === session.id && "bg-white/5",
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          onSessionChange?.(session.id)
                          setHistoryOpen(false)
                        }}
                      >
                        <div className="truncate text-xs font-medium text-neutral-200">{session.title}</div>
                        <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-neutral-500">
                          {session.preview || "No preview available"}
                        </div>
                        <div className="mt-1 text-[10px] text-neutral-600">
                          {formatRelativeTime(session.updatedAt)}
                          {session.messageId ? " · Email context" : " · Page chat"}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-neutral-600 opacity-0 hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100"
                        disabled={deletingSessionId === session.id}
                        onClick={() => void deleteSession(session.id)}
                        aria-label={`Delete ${session.title}`}
                      >
                        {deletingSessionId === session.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:bg-white/5 hover:text-neutral-100" onClick={() => {
          chat.startNewChat()
          onSessionChange?.(null)
        }} aria-label="Start new chat" title="Start new chat">
          <Plus className="h-4 w-4" />
        </Button>
        {onToggleMaximize && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
            onClick={onToggleMaximize}
            aria-label={maximized ? "Restore chat size" : "Maximize chat"}
            title={maximized ? "Restore chat size" : "Maximize chat"}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:bg-white/5 hover:text-neutral-100" onClick={onClose} aria-label="Close AI chat">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <AiChatContextAttachments
        attachments={chat.chatAttachments}
        fileAttachments={chat.fileAttachments}
        onRemove={chat.removeChatAttachment}
        onRemoveFile={chat.removeFileAttachment}
      />

      {chat.messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[#111111] px-5 py-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
            <Bot className="h-5 w-5 text-neutral-400" />
          </div>
          <h2 className="mt-3 text-base font-medium text-neutral-100">Welcome to Relay</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
            Ask anything or tell Relay what you need.
          </p>
          <div className={cn(
            "mt-5 flex max-w-xl flex-wrap justify-center gap-2",
            !maximized && "max-w-sm",
          )}>
            {starterPrompts.map(({ label, prompt, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => chat.setPrompt(prompt)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-neutral-100"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2 text-sm text-neutral-500">
            <div><kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-xs text-neutral-300">@</kbd> to mention any issue, email, or document</div>
            <div><kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-xs text-neutral-300">Enter</kbd> to send · <kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-xs text-neutral-300">Shift</kbd> + <kbd className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-xs text-neutral-300">Enter</kbd> for a new line</div>
          </div>
          {chat.error && (
            <div className="mt-4 max-w-sm rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              {chat.error}
            </div>
          )}
        </div>
      ) : (
        <AiChatMessages
          messages={chat.messages}
          isLoading={chat.isLoading}
          emptyTitle=""
          emptyDescription=""
          error={chat.error}
          onCopyMessage={(content) => void chat.copyMessage(content)}
          onUpdateDraft={(index, draft) => chat.updateDraftAt(index, draft)}
          onSaveDraft={(index) => void chat.saveDraftFromChat(index)}
          onSendDraft={(index) => void chat.sendDraftFromChat(index)}
          onOpenDraftInCompose={setComposeDraft}
          onUpdateCalendarDraft={(index, draft) => chat.updateCalendarDraftAt(index, draft)}
          onCreateCalendarDraft={(index) => void chat.createCalendarDraftFromChat(index)}
          calendarConnections={chat.calendarConnections}
        />
      )}

      <AiChatComposer
        prompt={chat.prompt}
        onPromptChange={chat.setPrompt}
        onPromptKeyDown={chat.handlePromptKeyDown}
        placeholder={messageId ? "Ask about this email..." : "Ask Relay..."}
        isLoading={chat.isLoading}
        models={chat.models}
        selectedModel={chat.selectedModel}
        onModelChange={chat.setSelectedModel}
        enabledToolKeys={chat.enabledToolKeys}
        selectedTools={chat.selectedTools}
        onToggleTool={chat.toggleTool}
        onRemoveTool={(tool) => chat.setSelectedTools((current) => current.filter((item) => item !== tool))}
        isToolMenuOpen={chat.isToolMenuOpen}
        onToolMenuOpenChange={chat.setIsToolMenuOpen}
        onSend={() => void chat.send()}
        onStop={chat.stop}
        accountId={accountId}
        messageId={messageId}
        fileAttachmentCount={chat.fileAttachments.length}
        className="border-white/10 bg-[#111111]"
      />
    </div>
  )
}
