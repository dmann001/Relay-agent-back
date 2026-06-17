"use client"

import { useEffect, useState, type KeyboardEvent } from "react"
import { Bot, ChevronDown, Globe2, Loader2, Plus, Send, Sparkles, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { emailApi, EmailApiError, type AiModelOption, type AiModelSettings, type AiToolKey } from "@/lib/email-api"

interface AiInboxChatProps {
  accountId?: string
  messageId?: string
  subject?: string
  onClose: () => void
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const toolLabels: Record<AiToolKey, { label: string; description: string; icon: typeof Wrench }> = {
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

export function AiInboxChat({ accountId, messageId, subject, onClose }: AiInboxChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<AiModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [toolSettings, setToolSettings] = useState<AiModelSettings["tools"]>(defaultTools)
  const [selectedTools, setSelectedTools] = useState<AiToolKey[]>([])
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)

  useEffect(() => {
    setMessages([])
    setPrompt("")
    setError(null)
    setSelectedTools([])
    setIsToolMenuOpen(false)
  }, [accountId, messageId])

  useEffect(() => {
    let cancelled = false
    void emailApi.getAiModelSettings().then((response) => {
      if (cancelled) return
      setModels(response.models)
      setSelectedModel(response.settings.defaultModel)
      setToolSettings({ ...defaultTools, ...response.settings.tools })
    }).catch(() => {
      if (!cancelled) {
        setModels([])
        setToolSettings(defaultTools)
      }
    })
    return () => { cancelled = true }
  }, [])

  const enabledToolKeys = (Object.keys(toolSettings) as AiToolKey[]).filter((key) => toolSettings[key])

  const ask = async () => {
    const question = prompt.trim()
    if (!question || isLoading) return

    setMessages((current) => [...current, { role: "user", content: question }])
    setPrompt("")
    setError(null)
    setIsLoading(true)

    try {
      if (messageId) {
        const response = await emailApi.runThreadAi({
          messageId,
          accountId,
          action: "ask",
          prompt: question,
          model: selectedModel || undefined,
          tools: selectedTools,
        })
        setMessages((current) => [...current, { role: "assistant", content: response.result.kind === "answer" ? response.result.answer : "Relay could not answer this request." }])
      } else {
        const response = await emailApi.runComposeAi({
          accountId,
          prompt: question,
          model: selectedModel || undefined,
          tools: selectedTools,
        })
        setMessages((current) => [...current, { role: "assistant", content: response.result.answer || response.result.body || "Relay could not answer this request." }])
      }
    } catch (requestError: any) {
      setError(requestError instanceof EmailApiError && requestError.code === "AI_NOT_CONFIGURED"
        ? "Relay AI needs an OPENAI_API_KEY before it can answer."
        : requestError.message || "Relay AI could not answer.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void ask()
  }

  const toggleTool = (tool: AiToolKey) => {
    setSelectedTools((current) =>
      current.includes(tool)
        ? current.filter((item) => item !== tool)
        : [...current, tool],
    )
    setIsToolMenuOpen(false)
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
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
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close AI chat">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card">
                <Bot className="h-6 w-6 text-brand" />
              </div>
              <h2 className="mt-4 text-base font-medium text-foreground">Ask Relay anything</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {messageId
                  ? "Ask about the open email, request a summary, or get help deciding how to reply."
                  : "Ask for writing help or quick inbox guidance. Open an email to ask with message context."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={message.role === "user"
                    ? "max-w-[85%] whitespace-pre-wrap rounded-3xl bg-surface-subtle px-4 py-2.5 text-sm leading-6 text-foreground"
                    : "max-w-[95%] whitespace-pre-wrap px-1 py-1 text-sm leading-6 text-foreground"}
                >
                  {message.content}
                </div>
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
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      <form
        className="border-t border-border bg-background p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void ask()
        }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-3xl border border-border bg-card p-2 shadow-sm">
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-surface-subtle"
              onClick={() => setIsToolMenuOpen((current) => !current)}
              aria-label="Add AI tool"
              disabled={!enabledToolKeys.length}
            >
              <Plus className="h-5 w-5" />
            </Button>
            {isToolMenuOpen && (
              <div className="absolute bottom-11 left-0 z-20 w-64 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
                {enabledToolKeys.map((tool) => {
                  const Icon = toolLabels[tool].icon
                  const selected = selectedTools.includes(tool)
                  return (
                    <button
                      key={tool}
                      type="button"
                      onClick={() => toggleTool(tool)}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-hover"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">{toolLabels[tool].label}</span>
                        <span className="block text-xs leading-4 text-muted-foreground">
                          {selected ? "Selected for this prompt" : toolLabels[tool].description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={handlePromptKeyDown}
            placeholder={messageId ? "Ask about this email..." : "Ask Relay..."}
            className="min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
            disabled={isLoading}
            maxLength={2000}
          />
          {models.length > 0 && (
            <label className="mb-1 flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground">
              <span className="sr-only">OpenAI model</span>
              <select
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
                className="max-w-28 bg-transparent text-xs outline-none"
                aria-label="OpenAI model"
              >
                {models.map((model) => (
                  <option key={model.id} value={model.id}>{model.label}</option>
                ))}
              </select>
              <ChevronDown className="h-3 w-3" />
            </label>
          )}
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-full" disabled={!prompt.trim() || isLoading} aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {selectedTools.length > 0 && (
          <div className="mx-auto mt-2 flex w-full max-w-3xl flex-wrap gap-2 px-2">
            {selectedTools.map((tool) => {
              const Icon = toolLabels[tool].icon
              return (
                <button
                  key={tool}
                  type="button"
                  onClick={() => setSelectedTools((current) => current.filter((item) => item !== tool))}
                  className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                  aria-label={`Remove ${toolLabels[tool].label}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {toolLabels[tool].label}
                  <X className="hidden h-3.5 w-3.5 group-hover:block" />
                </button>
              )
            })}
          </div>
        )}
      </form>
    </div>
  )
}
