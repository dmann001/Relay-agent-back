"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Bot,
  Box,
  CalendarDays,
  History,
  Maximize2,
  Minimize2,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { ComposeDialog } from "@/components/compose-dialog"
import { AiChatComposer, AiChatContextAttachments, AiChatMessages, useAiChat } from "@/components/ai-chat-shared"
import type { AiChatDraft } from "@/components/ai-chat-shared"
import { cn } from "@/lib/utils"

interface AiInboxChatProps {
  accountId?: string
  messageId?: string
  subject?: string
  sessionId?: string
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

export function AiInboxChat({
  accountId,
  messageId,
  subject,
  sessionId: initialSessionId,
  edge = "start",
  variant = "split",
  maximized = false,
  onClose,
  onToggleMaximize,
  onSessionChange,
}: AiInboxChatProps) {
  const [composeDraft, setComposeDraft] = useState<AiChatDraft | null>(null)
  const chat = useAiChat({
    accountId,
    messageId,
    initialSessionId,
    onSessionId: (sessionId) => onSessionChange?.(sessionId),
  })

  return (
    <div className={cn(
      "flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
      variant === "split" && (edge === "end" ? "border-l border-border" : "border-r border-border"),
      variant === "floating" && "rounded-xl border border-border shadow-2xl",
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
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">New chat</h1>
          {messageId && (
            <p className="truncate text-xs text-muted-foreground">
              Current email{subject ? ` · ${subject}` : ""}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" asChild aria-label="Chat history">
          <Link href="/ai-chat">
            <History className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
          chat.startNewChat()
          onSessionChange?.(null)
        }} aria-label="Start new chat" title="Start new chat">
          <Sparkles className="h-4 w-4" />
        </Button>
        {onToggleMaximize && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={onToggleMaximize}
            aria-label={maximized ? "Restore chat size" : "Maximize chat"}
            title={maximized ? "Restore chat size" : "Maximize chat"}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={onClose} aria-label="Close AI chat">
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <h2 className="mt-2 text-base font-medium text-foreground">Welcome to Relay</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
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
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <div><kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-xs">@</kbd> to mention any issue, email, or document</div>
            <div><kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-xs">Tab</kbd> to add current view to context</div>
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
      />
    </div>
  )
}
