"use client"

import Link from "next/link"
import { Bot, History, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AiChatComposer, AiChatContextAttachments, AiChatMessages, useAiChat } from "@/components/ai-chat-shared"
import { cn } from "@/lib/utils"

interface AiInboxChatProps {
  accountId?: string
  messageId?: string
  subject?: string
  sessionId?: string
  edge?: "start" | "end"
  onClose: () => void
  onSessionChange?: (sessionId: string | null) => void
}

export function AiInboxChat({
  accountId,
  messageId,
  subject,
  sessionId: initialSessionId,
  edge = "start",
  onClose,
  onSessionChange,
}: AiInboxChatProps) {
  const chat = useAiChat({
    accountId,
    messageId,
    initialSessionId,
    onSessionId: (sessionId) => onSessionChange?.(sessionId),
  })

  return (
    <div className={cn(
      "flex h-full min-h-0 w-full flex-col bg-background",
      edge === "end" ? "border-l border-border" : "border-r border-border",
    )}>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-foreground">Relay AI</h1>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {messageId ? `Current email${subject ? ` · ${subject}` : ""}` : "Ask about your inbox or draft a message"}
          </p>
        </div>
        <Button variant="ghost" size="icon" asChild aria-label="Chat history">
          <Link href="/ai-chat">
            <History className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => {
          chat.startNewChat()
          onSessionChange?.(null)
        }}>
          New chat
        </Button>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close AI chat">
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
            <Bot className="h-6 w-6 text-brand" />
          </div>
          <h2 className="mt-4 text-base font-medium text-foreground">Ask Relay anything</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {messageId
              ? "Ask about the open email, request a summary, or get help deciding how to reply."
              : "Ask for writing help or quick inbox guidance. Open an email to ask with message context."}
          </p>
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
          onSaveDraft={(index) => void chat.saveDraftFromChat(index)}
          onSendDraft={(index) => void chat.sendDraftFromChat(index)}
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
