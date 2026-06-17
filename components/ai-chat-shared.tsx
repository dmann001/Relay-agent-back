"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { ChevronDown, Globe2, Loader2, Mail, Plus, Send, Square, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AiChatMarkdown } from "@/components/ai-chat-markdown"
import { useAiChatAttachmentsOptional } from "@/components/ai-chat-attachments-provider"
import { emailApi, EmailApiError, type AiModelOption, type AiModelSettings, type AiToolKey } from "@/lib/email-api"
import { cn } from "@/lib/utils"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
}

export const aiToolLabels: Record<AiToolKey, { label: string; description: string; icon: typeof Wrench }> = {
  webSearch: { label: "Web search", description: "Look something up on the web", icon: Globe2 },
  fileSearch: { label: "File search", description: "Search connected file indexes", icon: Wrench },
  codeInterpreter: { label: "Code interpreter", description: "Analyze with code", icon: Wrench },
  imageGeneration: { label: "Create image", description: "Generate an image", icon: Wrench },
  computerUse: { label: "Computer use", description: "Use a browser or desktop", icon: Wrench },
  mcpConnectors: { label: "MCP and connectors", description: "Use connected tools", icon: Wrench },
  toolSearch: { label: "Tool search", description: "Find available tools", icon: Wrench },
}

const defaultTools: Record<AiToolKey, boolean> = {
  webSearch: false,
  fileSearch: false,
  codeInterpreter: false,
  imageGeneration: false,
  computerUse: false,
  mcpConnectors: false,
  toolSearch: false,
}

interface UseAiChatOptions {
  accountId?: string
  messageId?: string
  initialSessionId?: string
  onSessionId?: (sessionId: string) => void
}

export function useAiChat({ accountId, messageId, initialSessionId, onSessionId }: UseAiChatOptions) {
  const attachmentsContext = useAiChatAttachmentsOptional()
  const attachments = attachmentsContext?.attachments
  const chatAttachments = useMemo(() => attachments ?? [], [attachments])
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<AiModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [toolSettings, setToolSettings] = useState<AiModelSettings["tools"]>(defaultTools)
  const [selectedTools, setSelectedTools] = useState<AiToolKey[]>([])
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const abortRef = useRef<AbortController | null>(null)
  const activeChatRef = useRef(0)
  const contextKeyRef = useRef(`${accountId ?? ""}:${messageId ?? ""}`)
  const loadedSessionRef = useRef<string | undefined>(undefined)

  const enabledToolKeys = (Object.keys(toolSettings) as AiToolKey[]).filter((key) => toolSettings[key])

  useEffect(() => {
    let cancelled = false
    void emailApi.getAiModelSettings().then((response) => {
      if (cancelled) return
      setModels(response.models)
      setSelectedModel(response.settings.defaultModel)
      setToolSettings({ ...defaultTools, ...response.settings.tools })
    }).catch(() => {
      if (!cancelled) setToolSettings(defaultTools)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const nextContextKey = `${accountId ?? ""}:${messageId ?? ""}`
    if (contextKeyRef.current !== nextContextKey) {
      contextKeyRef.current = nextContextKey
      activeChatRef.current += 1
      abortRef.current?.abort()
      abortRef.current = null
      setMessages([])
      setPrompt("")
      setError(null)
      setSessionId(undefined)
      setIsLoading(false)
      loadedSessionRef.current = undefined
    }
  }, [accountId, messageId])

  useEffect(() => {
    if (!initialSessionId) {
      loadedSessionRef.current = undefined
      return
    }
    if (loadedSessionRef.current === initialSessionId) return
    if (sessionId === initialSessionId && messages.length > 0) {
      loadedSessionRef.current = initialSessionId
      return
    }

    loadedSessionRef.current = initialSessionId
    activeChatRef.current += 1
    setSessionId(initialSessionId)
    setError(null)
    let cancelled = false
    void emailApi.getAiChatSession(initialSessionId).then(({ session }) => {
      if (cancelled) return
      setMessages(session.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })))
    }).catch(() => {
      if (!cancelled) setMessages([])
    })
    return () => { cancelled = true }
  }, [initialSessionId, messages.length, sessionId])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsLoading(false)
  }, [])

  const toggleTool = useCallback((tool: AiToolKey) => {
    setSelectedTools((current) =>
      current.includes(tool)
        ? current.filter((item) => item !== tool)
        : [...current, tool],
    )
    setIsToolMenuOpen(false)
  }, [])

  const send = useCallback(async () => {
    const question = prompt.trim()
    if (!question || isLoading) return

    const chatId = activeChatRef.current
    const priorHistory = messages
    setMessages((current) => [...current, { role: "user", content: question }])
    setPrompt("")
    setError(null)
    setIsLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = priorHistory.map((message) => ({
        role: message.role,
        content: message.content,
      }))
      const shouldCreateSession = !sessionId
      const contextMessageIds = chatAttachments.map((attachment) => ({
        messageId: attachment.messageId,
        accountId: attachment.accountId,
      }))
      const sharedPayload = {
        accountId,
        prompt: question,
        model: selectedModel || undefined,
        tools: selectedTools,
        history,
        sessionId,
        createSession: shouldCreateSession,
        contextMessageIds: contextMessageIds.length ? contextMessageIds : undefined,
        signal: controller.signal,
      }

      if (messageId) {
        const response = await emailApi.runThreadAi({
          messageId,
          action: "ask",
          ...sharedPayload,
        })
        if (chatId !== activeChatRef.current) return
        const answer = response.result.kind === "answer"
          ? response.result.answer
          : "Relay could not answer this request."
        setMessages((current) => [...current, { role: "assistant", content: answer }])
        if (response.sessionId) {
          setSessionId(response.sessionId)
          loadedSessionRef.current = response.sessionId
          onSessionId?.(response.sessionId)
        }
      } else {
        const response = await emailApi.runComposeAi(sharedPayload)
        if (chatId !== activeChatRef.current) return
        const answer = response.result.answer || response.result.body || "Relay could not answer this request."
        setMessages((current) => [...current, { role: "assistant", content: answer }])
        if (response.sessionId) {
          setSessionId(response.sessionId)
          loadedSessionRef.current = response.sessionId
          onSessionId?.(response.sessionId)
        }
      }
    } catch (requestError: any) {
      if (chatId !== activeChatRef.current) return
      if (requestError instanceof EmailApiError && requestError.code === "AI_ABORTED") {
        setMessages((current) => {
          const last = current[current.length - 1]
          if (last?.role === "user" && last.content === question) {
            return current.slice(0, -1)
          }
          return current
        })
        setPrompt(question)
        return
      }
      setMessages((current) => {
        const last = current[current.length - 1]
        if (last?.role === "user" && last.content === question) {
          return current.slice(0, -1)
        }
        return current
      })
      setPrompt(question)
      setError(requestError instanceof EmailApiError && requestError.code === "AI_NOT_CONFIGURED"
        ? "Relay AI needs an OPENAI_API_KEY before it can answer."
        : requestError.message || "Relay AI could not answer.")
    } finally {
      if (chatId === activeChatRef.current && abortRef.current === controller) {
        abortRef.current = null
        setIsLoading(false)
      }
    }
  }, [
    accountId,
    isLoading,
    messageId,
    messages,
    onSessionId,
    prompt,
    selectedModel,
    selectedTools,
    sessionId,
    chatAttachments,
  ])

  const handlePromptKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }, [send])

  const startNewChat = useCallback(() => {
    activeChatRef.current += 1
    abortRef.current = null
    setMessages([])
    setPrompt("")
    setError(null)
    setSessionId(undefined)
    setIsLoading(false)
    loadedSessionRef.current = undefined
  }, [])

  return {
    messages,
    prompt,
    setPrompt,
    isLoading,
    error,
    models,
    selectedModel,
    setSelectedModel,
    enabledToolKeys,
    selectedTools,
    setSelectedTools,
    isToolMenuOpen,
    setIsToolMenuOpen,
    toggleTool,
    send,
    stop,
    handlePromptKeyDown,
    sessionId,
    startNewChat,
    chatAttachments,
    removeChatAttachment: attachmentsContext?.removeAttachment,
  }
}

export function AiChatContextAttachments({
  attachments,
  onRemove,
  className,
}: {
  attachments: Array<{ messageId: string; accountId?: string; subject: string; fromName?: string }>
  onRemove?: (messageId: string, accountId?: string) => void
  className?: string
}) {
  if (!attachments.length) return null

  return (
    <div className={cn("border-b border-border bg-surface-subtle/40 px-4 py-2", className)}>
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Email context
        </span>
        {attachments.map((attachment) => (
          <span
            key={`${attachment.accountId || "default"}:${attachment.messageId}`}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
            title={attachment.subject}
          >
            <Mail className="h-3 w-3 shrink-0 text-brand" />
            <span className="truncate">{attachment.subject || "Email"}</span>
            {onRemove && (
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${attachment.subject} from chat context`}
                onClick={() => onRemove(attachment.messageId, attachment.accountId)}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

interface AiChatComposerProps {
  prompt: string
  onPromptChange: (value: string) => void
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  isLoading: boolean
  models: AiModelOption[]
  selectedModel: string
  onModelChange: (model: string) => void
  enabledToolKeys: AiToolKey[]
  selectedTools: AiToolKey[]
  onToggleTool: (tool: AiToolKey) => void
  onRemoveTool: (tool: AiToolKey) => void
  isToolMenuOpen: boolean
  onToolMenuOpenChange: (open: boolean) => void
  onSend: () => void
  onStop: () => void
  className?: string
}

export function AiChatComposer({
  prompt,
  onPromptChange,
  onPromptKeyDown,
  placeholder,
  isLoading,
  models,
  selectedModel,
  onModelChange,
  enabledToolKeys,
  selectedTools,
  onToggleTool,
  onRemoveTool,
  isToolMenuOpen,
  onToolMenuOpenChange,
  onSend,
  onStop,
  className,
}: AiChatComposerProps) {
  const selectedModelLabel = models.find((model) => model.id === selectedModel)?.label

  return (
    <div className={cn("border-t border-border bg-background p-3", className)}>
      {models.length > 0 && (
        <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-end px-2">
          <label className="flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Model</span>
            <select
              value={selectedModel}
              onChange={(event) => onModelChange(event.target.value)}
              className="max-w-[9rem] cursor-pointer appearance-none bg-transparent pr-4 text-xs font-medium text-foreground outline-none"
              aria-label="OpenAI model"
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none -ml-3 h-3 w-3 shrink-0" aria-hidden="true" />
          </label>
          {selectedModelLabel && (
            <span className="sr-only">Selected model: {selectedModelLabel}</span>
          )}
        </div>
      )}
      <form
        className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault()
          if (isLoading) onStop()
          else onSend()
        }}
      >
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-surface-subtle"
            onClick={() => onToolMenuOpenChange(!isToolMenuOpen)}
            aria-label="Add AI tool"
            disabled={!enabledToolKeys.length}
          >
            <Plus className="h-5 w-5" />
          </Button>
          {isToolMenuOpen && (
            <div className="absolute bottom-11 left-0 z-20 w-72 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
              {enabledToolKeys.length ? enabledToolKeys.map((tool) => {
                const Icon = aiToolLabels[tool].icon
                const selected = selectedTools.includes(tool)
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => onToggleTool(tool)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-hover"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block font-medium text-foreground">{aiToolLabels[tool].label}</span>
                      <span className="block text-xs leading-4 text-muted-foreground">
                        {selected ? "Active for this chat" : aiToolLabels[tool].description}
                      </span>
                    </span>
                  </button>
                )
              }) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Enable tools in Settings → AI models to use them here.
                </p>
              )}
            </div>
          )}
        </div>
        <Textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onPromptKeyDown}
          placeholder={placeholder}
          className="min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
          maxLength={2000}
        />
        {isLoading ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={onStop}
            aria-label="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            disabled={!prompt.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
      {selectedTools.length > 0 && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl flex-wrap gap-2 px-2">
          {selectedTools.map((tool) => {
            const Icon = aiToolLabels[tool].icon
            return (
              <button
                key={tool}
                type="button"
                onClick={() => onRemoveTool(tool)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                aria-label={`Remove ${aiToolLabels[tool].label}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {aiToolLabels[tool].label}
                <X className="hidden h-3.5 w-3.5 group-hover:block" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface AiChatMessagesProps {
  messages: AiChatMessage[]
  isLoading: boolean
  emptyTitle: string
  emptyDescription: string
  error?: string | null
}

export function AiChatMessages({ messages, isLoading, emptyTitle, emptyDescription, error }: AiChatMessagesProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
      {messages.length === 0 ? (
        <div className="flex h-full items-center justify-center text-center">
          <div className="max-w-sm">
            <h2 className="text-base font-medium text-foreground">{emptyTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyDescription}</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          {messages.map((message, index) => (
            <div
              key={index}
              className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              {message.role === "user" ? (
                <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-surface-subtle px-4 py-2.5 text-sm leading-6 text-foreground">
                  {message.content}
                </div>
              ) : (
                <div className="max-w-[95%] rounded-2xl px-1 py-1">
                  <AiChatMarkdown content={message.content} />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center px-1 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Relay is thinking...
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mx-auto mt-4 max-w-3xl rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
