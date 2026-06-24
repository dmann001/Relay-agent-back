"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from "react"
import { CalendarDays, Check, ChevronDown, Clipboard, FileText, Globe2, Loader2, Mail, Plus, Save, Send, Square, Upload, Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AiChatMarkdown } from "@/components/ai-chat-markdown"
import { useAiChatAttachmentsOptional, type AiChatFileAttachment } from "@/components/ai-chat-attachments-provider"
import { AiChatEmailPickerDialog } from "@/components/ai-chat-email-picker-dialog"
import { AI_CHAT_MAX_FILE_BYTES, AI_CHAT_MAX_FILES, formatFileSize, isAllowedChatFile, readFileAsBase64 } from "@/lib/ai-chat-files"
import { emailApi, EmailApiError, type AiGeneratedImage, type AiModelOption, type AiModelSettings, type AiToolKey, type CalendarConnection, type CalendarMeetingDraft, type ContactSuggestion, WIRED_AI_TOOLS } from "@/lib/email-api"
import { cn } from "@/lib/utils"

export interface AiChatMessage {
  role: "user" | "assistant"
  content: string
  draft?: AiChatDraft
  calendarDraft?: AiChatCalendarDraft
  images?: AiGeneratedImage[]
  computerUse?: {
    driver: string
    stepCount: number
    truncated: boolean
  }
}

export interface AiChatCalendarDraft extends CalendarMeetingDraft {
  status?: "idle" | "creating" | "created" | "failed"
  error?: string
}

export interface AiChatDraft {
  accountId?: string
  to: string[]
  cc: string[]
  subject: string
  body: string
  generatedDraft?: string
  generatedDraftId?: string
  attachments?: AiChatDraftAttachment[]
  draftId?: string
  status?: "idle" | "saving" | "saved" | "sending" | "sent" | "failed"
  error?: string
}

export interface AiChatDraftAttachment {
  filename: string
  mimeType: string
  data: string
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

const emailDraftIntentPattern = /\b(email|e-mail|mail|reply|respond|draft|compose|send|save\s+as\s+draft|follow[-\s]?up)\b/i
const calendarIntentPattern = /\b(calendar|cal|schedule|meeting|meet|invite|event|appointment|reminder|remind|don't forget|dont forget|call|zoom|teams|google meet)\b/i
const emailAddressPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const emailMentionPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const trailingMentionPattern = /(^|\s)@([A-Za-z0-9._ -]{0,40})$/

function uniqueContextRefs(refs: Array<{ messageId: string; accountId?: string }>) {
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = `${ref.accountId || "default"}:${ref.messageId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function hasValidRecipient(draft: AiChatDraft) {
  return draft.to.some((recipient) => emailAddressPattern.test(recipient))
}

function firstEmailMention(value: string) {
  return value.match(emailMentionPattern)?.[0]
}

const localDateTimeValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const isoToLocalInput = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : localDateTimeValue(date)
}

const localInputToIso = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString()
}

const parseCalendarAttendees = (value: string) =>
  value.split(/[,\n;]/).map((item) => item.trim()).filter(Boolean)

const formatCalendarDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Missing time"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function hasCreateableCalendarDraft(draft: AiChatCalendarDraft) {
  return Boolean(
    draft.accountId &&
    draft.title.trim() &&
    draft.startsAt &&
    draft.endsAt &&
    new Date(draft.endsAt).getTime() > new Date(draft.startsAt).getTime(),
  )
}

const relayMetadataPattern = /\n*\s*<!--\s*relay-chat:([A-Za-z0-9_-]+)\s*-->\s*$/m
const legacyImagePattern = /!\[[^\]]*]\(data:(image\/[^;]+);base64,([^)]+)\)/g

function imageFilename(image: AiGeneratedImage, index: number) {
  const extension = image.mimeType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "png"
  return `generated-image-${index + 1}.${extension}`
}

function imagesToAttachments(images: AiGeneratedImage[] = []): AiChatDraftAttachment[] {
  return images.map((image, index) => ({
    filename: imageFilename(image, index),
    mimeType: image.mimeType,
    data: image.data,
  }))
}

function parseRelayMessage(rawContent: string): Pick<AiChatMessage, "content" | "draft" | "images" | "computerUse"> {
  let content = rawContent
  let draft: AiChatDraft | undefined
  let images: AiGeneratedImage[] = []
  let computerUse: AiChatMessage["computerUse"]
  const marker = content.match(relayMetadataPattern)
  if (marker) {
    content = content.replace(relayMetadataPattern, "").trim()
    try {
      const metadata = JSON.parse(atob(marker[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(marker[1].length / 4) * 4, "=")))
      if (Array.isArray(metadata?.images)) images = metadata.images
      if (metadata?.computerUse && typeof metadata.computerUse === "object") {
        computerUse = {
          driver: String(metadata.computerUse.driver || "unknown"),
          stepCount: Number(metadata.computerUse.stepCount || 0),
          truncated: Boolean(metadata.computerUse.truncated),
        }
      }
      if (metadata?.draft) {
        draft = {
          accountId: metadata.draft.accountId,
          to: Array.isArray(metadata.draft.to) ? metadata.draft.to : [],
          cc: Array.isArray(metadata.draft.cc) ? metadata.draft.cc : [],
          subject: typeof metadata.draft.subject === "string" ? metadata.draft.subject : "",
          body: typeof metadata.draft.body === "string" ? metadata.draft.body : "",
          generatedDraft: typeof metadata.draft.generatedDraft === "string" ? metadata.draft.generatedDraft : undefined,
          generatedDraftId: typeof metadata.draft.generatedDraftId === "string" ? metadata.draft.generatedDraftId : undefined,
          attachments: Array.isArray(metadata.draft.attachments) ? metadata.draft.attachments : imagesToAttachments(images),
          status: "idle",
        }
      }
    } catch {
      // Ignore malformed saved metadata and show the plain message.
    }
  }

  const legacyImages: AiGeneratedImage[] = []
  content = content.replace(legacyImagePattern, (_match, mimeType: string, data: string) => {
    legacyImages.push({ mimeType, data })
    return ""
  }).trim()
  if (legacyImages.length) images = [...images, ...legacyImages]

  return { content, draft, images, computerUse }
}

function historyContent(message: AiChatMessage) {
  return message.content.replace(relayMetadataPattern, "").replace(legacyImagePattern, "[generated image]").trim().slice(0, 8000)
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
  const contextFileAttachments = attachmentsContext?.fileAttachments
  const fileAttachments = useMemo(
    () => contextFileAttachments ?? [],
    [contextFileAttachments],
  )
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [models, setModels] = useState<AiModelOption[]>([])
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [toolSettings, setToolSettings] = useState<AiModelSettings["tools"]>(defaultTools)
  const [selectedTools, setSelectedTools] = useState<AiToolKey[]>([])
  const [isToolMenuOpen, setIsToolMenuOpen] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId)
  const abortRef = useRef<AbortController | null>(null)
  const activeChatRef = useRef(0)
  const contextKeyRef = useRef(`${accountId ?? ""}:${messageId ?? ""}`)
  const loadedSessionRef = useRef<string | undefined>(undefined)

  const enabledToolKeys = (Object.keys(toolSettings) as AiToolKey[])
    .filter((key) => toolSettings[key] && WIRED_AI_TOOLS.includes(key))

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
    let cancelled = false
    void emailApi.listCalendarConnections()
      .then((connections) => {
        if (!cancelled) setCalendarConnections(connections.filter((connection) => connection.status === "connected"))
      })
      .catch(() => {
        if (!cancelled) setCalendarConnections([])
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
    if (
      loadedSessionRef.current === initialSessionId &&
      sessionId === initialSessionId &&
      messages.length > 0
    ) {
      return
    }
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
        ...parseRelayMessage(message.content),
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
    const trimmedPrompt = prompt.trim()
    const hasFiles = fileAttachments.length > 0
    if ((!trimmedPrompt && !hasFiles) || isLoading) return

    const question = trimmedPrompt || "Analyze the attached file(s)."

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
        content: historyContent(message),
      })).filter((message) => message.content.length > 0)
      const shouldCreateSession = !sessionId
      const attachedContextMessageIds = chatAttachments.map((attachment) => ({
        messageId: attachment.messageId,
        accountId: attachment.accountId,
      }))
      const composeContextMessageIds = uniqueContextRefs([
        ...(messageId ? [{ messageId, accountId }] : []),
        ...attachedContextMessageIds,
      ])
      const contextFiles = fileAttachments.map((file) => ({
        filename: file.filename,
        mimeType: file.mimeType,
        data: file.data,
      }))
      const sharedPayload = {
        accountId,
        prompt: question,
        model: selectedModel || undefined,
        tools: selectedTools,
        history,
        sessionId,
        createSession: shouldCreateSession,
        contextMessageIds: attachedContextMessageIds.length ? attachedContextMessageIds : undefined,
        contextFiles: contextFiles.length ? contextFiles : undefined,
        signal: controller.signal,
      }

      if (calendarIntentPattern.test(question) && !emailDraftIntentPattern.test(question)) {
        const { draft } = await emailApi.draftCalendarMeeting({
          prompt: question,
          accountId,
          messageId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        })
        if (chatId !== activeChatRef.current) return
        const missing = draft.missing.length
          ? ` Missing: ${draft.missing.join(", ")}.`
          : draft.needsAccountSelection
            ? " Choose a calendar account before creating it."
            : ""
        setMessages((current) => [...current, {
          role: "assistant",
          content: `I drafted a calendar invite.${missing} Review it before creating.`,
          calendarDraft: { ...draft, status: "idle" },
        }])
      } else if (messageId && !emailDraftIntentPattern.test(question)) {
        const response = await emailApi.runThreadAi({
          messageId,
          action: "ask",
          ...sharedPayload,
        })
        if (chatId !== activeChatRef.current) return
        const answer = response.result.kind === "answer"
          ? response.result.answer
          : "Relay could not answer this request."
        setMessages((current) => [...current, {
          role: "assistant",
          content: answer,
          images: response.images || [],
          computerUse: response.computerUse ? {
            driver: response.computerUse.driver,
            stepCount: response.computerUse.stepCount,
            truncated: response.computerUse.truncated,
          } : undefined,
        }])
        if (response.sessionId) {
          setSessionId(response.sessionId)
          loadedSessionRef.current = response.sessionId
          onSessionId?.(response.sessionId)
        }
      } else {
        const response = await emailApi.runComposeAi({
          ...sharedPayload,
          contactEmail: firstEmailMention(question),
          contextMessageIds: composeContextMessageIds.length ? composeContextMessageIds : undefined,
          generatedAttachments: imagesToAttachments(priorHistory.flatMap((message) => message.images || [])),
        })
        if (chatId !== activeChatRef.current) return
        const hasDraft = Boolean(response.result.subject || response.result.body || response.result.to.length || response.result.cc.length)
        const answer = response.result.answer || (hasDraft ? "I drafted an email. Review it before sending." : "Relay could not answer this request.")
        const generatedAttachments = imagesToAttachments([
          ...priorHistory.flatMap((message) => message.images || []),
          ...(response.images || []),
        ])
        setMessages((current) => [...current, {
          role: "assistant",
          content: answer,
          images: response.images || [],
          computerUse: response.computerUse ? {
            driver: response.computerUse.driver,
            stepCount: response.computerUse.stepCount,
            truncated: response.computerUse.truncated,
          } : undefined,
          draft: hasDraft ? {
            accountId: response.context.accountId,
            to: response.result.to,
            cc: response.result.cc,
            subject: response.result.subject,
            body: response.result.body,
            generatedDraft: response.result.body,
            generatedDraftId: response.responseId,
            attachments: generatedAttachments,
            status: "idle",
          } : undefined,
        }])
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
    fileAttachments,
  ])

  const handlePromptKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
  }, [])

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

  const updateDraftAt = useCallback((messageIndex: number, draft: Partial<AiChatDraft>) => {
    setMessages((current) => current.map((message, index) => (
      index === messageIndex && message.draft
        ? { ...message, draft: { ...message.draft, ...draft } }
        : message
    )))
  }, [])

  const updateCalendarDraftAt = useCallback((messageIndex: number, draft: Partial<AiChatCalendarDraft>) => {
    setMessages((current) => current.map((message, index) => (
      index === messageIndex && message.calendarDraft
        ? { ...message, calendarDraft: { ...message.calendarDraft, ...draft } }
        : message
    )))
  }, [])

  const saveDraftFromChat = useCallback(async (messageIndex: number) => {
    const draft = messages[messageIndex]?.draft
    if (!draft || (!draft.to.length && !draft.subject.trim() && !draft.body.trim())) return
    updateDraftAt(messageIndex, { status: "saving", error: undefined })
    try {
      const result = await emailApi.saveDraft({
        accountId: draft.accountId || accountId,
        draftId: draft.draftId,
        to: draft.to,
        cc: draft.cc.length ? draft.cc : undefined,
        subject: draft.subject,
        body: draft.body,
        attachments: draft.attachments,
      })
      updateDraftAt(messageIndex, { status: "saved", draftId: result.draftId })
    } catch (error: any) {
      updateDraftAt(messageIndex, { status: "failed", error: error.message || "Could not save draft." })
    }
  }, [accountId, messages, updateDraftAt])

  const sendDraftFromChat = useCallback(async (messageIndex: number) => {
    const draft = messages[messageIndex]?.draft
    if (!draft || !hasValidRecipient(draft) || !draft.subject.trim() || !draft.body.trim()) return
    updateDraftAt(messageIndex, { status: "sending", error: undefined })
    try {
      await emailApi.sendEmail({
        accountId: draft.accountId || accountId,
        to: draft.to.filter((recipient) => emailAddressPattern.test(recipient)),
        cc: draft.cc.length ? draft.cc : undefined,
        subject: draft.subject,
        body: draft.body,
        attachments: draft.attachments,
        draftId: draft.draftId,
        generatedDraft: draft.generatedDraft,
        generatedDraftId: draft.generatedDraftId,
      })
      updateDraftAt(messageIndex, { status: "sent" })
    } catch (error: any) {
      updateDraftAt(messageIndex, { status: "failed", error: error.message || "Could not send email." })
    }
  }, [accountId, messages, updateDraftAt])

  const createCalendarDraftFromChat = useCallback(async (messageIndex: number) => {
    const draft = messages[messageIndex]?.calendarDraft
    if (!draft || !hasCreateableCalendarDraft(draft)) return
    updateCalendarDraftAt(messageIndex, { status: "creating", error: undefined })
    try {
      await emailApi.createCalendarMeeting({
        accountId: draft.accountId,
        title: draft.title,
        description: draft.description || undefined,
        startsAt: localInputToIso(isoToLocalInput(draft.startsAt) || draft.startsAt),
        endsAt: localInputToIso(isoToLocalInput(draft.endsAt) || draft.endsAt),
        timezone: draft.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        attendees: draft.attendees,
        location: draft.location || undefined,
        reminderMinutes: draft.reminderMinutes,
        createConference: draft.createConference,
        sourceMessageId: messageId,
      })
      updateCalendarDraftAt(messageIndex, { status: "created" })
    } catch (error: any) {
      updateCalendarDraftAt(messageIndex, { status: "failed", error: error.message || "Could not create calendar invite." })
    }
  }, [messageId, messages, updateCalendarDraftAt])

  const copyMessage = useCallback(async (content: string) => {
    if (!navigator?.clipboard) return
    await navigator.clipboard.writeText(content)
  }, [])

  return {
    messages,
    prompt,
    setPrompt,
    isLoading,
    error,
    models,
    calendarConnections,
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
    fileAttachments,
    removeFileAttachment: attachmentsContext?.removeFileAttachment,
    addChatAttachment: attachmentsContext?.addAttachment,
    addFileAttachment: attachmentsContext?.addFileAttachment,
    updateDraftAt,
    saveDraftFromChat,
    sendDraftFromChat,
    updateCalendarDraftAt,
    createCalendarDraftFromChat,
    copyMessage,
  }
}

export function AiChatContextAttachments({
  attachments,
  fileAttachments = [],
  onRemove,
  onRemoveFile,
  className,
}: {
  attachments: Array<{ messageId: string; accountId?: string; subject: string; fromName?: string }>
  fileAttachments?: AiChatFileAttachment[]
  onRemove?: (messageId: string, accountId?: string) => void
  onRemoveFile?: (id: string) => void
  className?: string
}) {
  if (!attachments.length && !fileAttachments.length) return null

  return (
    <div className={cn("border-b border-border bg-surface-subtle/40 px-4 py-2", className)}>
      <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
        {attachments.length > 0 && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Email context
          </span>
        )}
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
        {fileAttachments.length > 0 && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Files
          </span>
        )}
        {fileAttachments.map((file) => (
          <span
            key={file.id}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground"
            title={`${file.filename} (${formatFileSize(file.size)})`}
          >
            <FileText className="h-3 w-3 shrink-0 text-brand" />
            <span className="truncate">{file.filename}</span>
            {onRemoveFile && (
              <button
                type="button"
                className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${file.filename} from chat`}
                onClick={() => onRemoveFile(file.id)}
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
  accountId?: string
  messageId?: string
  fileAttachmentCount?: number
  className?: string
}

async function ingestChatFiles(
  files: FileList | File[],
  options: {
    currentCount: number
    addFileAttachment: (attachment: AiChatFileAttachment) => boolean
  },
): Promise<string | null> {
  const queue = Array.from(files)
  if (!queue.length) return null
  if (options.currentCount >= AI_CHAT_MAX_FILES) {
    return `You can attach up to ${AI_CHAT_MAX_FILES} files.`
  }

  let added = 0
  for (const file of queue) {
    if (options.currentCount + added >= AI_CHAT_MAX_FILES) break
    if (!isAllowedChatFile(file)) {
      return `${file.name} is not supported. Use PDF, image, or text files.`
    }
    if (file.size > AI_CHAT_MAX_FILE_BYTES) {
      return `${file.name} is too large (max ${formatFileSize(AI_CHAT_MAX_FILE_BYTES)}).`
    }
    const data = await readFileAsBase64(file)
    const attachment: AiChatFileAttachment = {
      id: `${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 8)}`,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      data,
      size: file.size,
    }
    if (options.addFileAttachment(attachment)) added += 1
  }
  return added ? null : "Could not attach file."
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
  accountId,
  messageId,
  fileAttachmentCount = 0,
  className,
}: AiChatComposerProps) {
  const attachmentsContext = useAiChatAttachmentsOptional()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isEmailPickerOpen, setIsEmailPickerOpen] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [contactSuggestions, setContactSuggestions] = useState<ContactSuggestion[]>([])
  const [isContactMenuOpen, setIsContactMenuOpen] = useState(false)
  const selectedModelLabel = models.find((model) => model.id === selectedModel)?.label
  const canSend = Boolean(prompt.trim()) || fileAttachmentCount > 0

  const mentionMatch = prompt.match(trailingMentionPattern)
  const mentionText = mentionMatch?.[0] || ""
  const mentionQuery = mentionMatch?.[2]?.trim() || ""

  useEffect(() => {
    if (!mentionText) {
      setIsContactMenuOpen(false)
      setContactSuggestions([])
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void emailApi.searchContacts({ q: mentionQuery, accountId, limit: 8 })
        .then((contacts) => {
          if (cancelled) return
          setContactSuggestions(contacts)
          setIsContactMenuOpen(contacts.length > 0)
        })
        .catch(() => {
          if (!cancelled) {
            setContactSuggestions([])
            setIsContactMenuOpen(false)
          }
        })
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [accountId, mentionText, mentionQuery])

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!attachmentsContext?.addFileAttachment) {
      setAttachError("File attachments are unavailable in this view.")
      return
    }
    setAttachError(null)
    const error = await ingestChatFiles(files, {
      currentCount: fileAttachmentCount,
      addFileAttachment: attachmentsContext.addFileAttachment,
    })
    if (error) setAttachError(error)
    else onToolMenuOpenChange(false)
  }, [attachmentsContext, fileAttachmentCount, onToolMenuOpenChange])

  const handleDragOver = useCallback((event: DragEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((event: DragEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    if (event.dataTransfer.files?.length) {
      void handleFiles(event.dataTransfer.files)
    }
  }, [handleFiles])

  const excludeMessageIds = messageId ? [messageId] : []

  const handlePromptChange = (value: string) => {
    onPromptChange(value)
    if (!trailingMentionPattern.test(value)) {
      setIsContactMenuOpen(false)
    }
  }

  const insertContactMention = (contact: ContactSuggestion) => {
    const match = prompt.match(trailingMentionPattern)
    if (!match) return
    const start = prompt.length - match[0].length
    const prefix = prompt.slice(0, start) + (match[1] || "")
    const label = contact.displayName || contact.email
    onPromptChange(`${prefix}@${label} <${contact.email}> `)
    setIsContactMenuOpen(false)
    setContactSuggestions([])
  }

  return (
    <div className={cn("border-t border-border bg-background p-2", className)}>
      {attachError && (
        <div className="mx-auto mb-2 w-full max-w-3xl rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {attachError}
        </div>
      )}
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
        className={cn(
          "relative mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-none transition-colors",
          isDragOver && "border-brand bg-brand/5",
        )}
        onSubmit={(event) => {
          event.preventDefault()
          if (isLoading) onStop()
          else onSend()
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.csv,.md,.json,.png,.jpg,.jpeg,.gif,.webp"
          multiple
          onChange={(event) => {
            if (event.target.files?.length) void handleFiles(event.target.files)
            event.target.value = ""
          }}
        />
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl bg-surface-subtle"
            onClick={() => onToolMenuOpenChange(!isToolMenuOpen)}
            aria-label="Attach context or tools"
          >
            <Plus className="h-5 w-5" />
          </Button>
          {isToolMenuOpen && (
            <div className="absolute bottom-11 left-0 z-20 w-80 max-h-96 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Attach
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-hover"
              >
                <Upload className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">Upload file</span>
                  <span className="block text-xs leading-4 text-muted-foreground">
                    PDF, image, or text up to {formatFileSize(AI_CHAT_MAX_FILE_BYTES)}. Drop files on the composer too.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEmailPickerOpen(true)
                  onToolMenuOpenChange(false)
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-surface-hover"
              >
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground">Add email context</span>
                  <span className="block text-xs leading-4 text-muted-foreground">
                    Include another email from your inbox in this chat.
                  </span>
                </span>
              </button>
              {enabledToolKeys.length > 0 && (
                <>
                  <p className="mt-1 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    AI tools
                  </p>
                  {enabledToolKeys.map((tool) => {
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
                  })}
                </>
              )}
              {enabledToolKeys.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Enable AI tools in Settings → AI models.
                </p>
              )}
              <p className="mt-1 border-t border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                PDF analysis works best with Code interpreter enabled. Computer use is for browser tasks, not local file editing.
              </p>
            </div>
          )}
        </div>
        <Textarea
          value={prompt}
          onChange={(event) => handlePromptChange(event.target.value)}
          onKeyDown={onPromptKeyDown}
          placeholder={isDragOver ? "Drop file to attach..." : placeholder}
          className="min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
          maxLength={2000}
        />
        {isLoading ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-9 w-9 shrink-0 rounded-xl"
            onClick={onStop}
            aria-label="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            disabled={!canSend}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
      {isContactMenuOpen && contactSuggestions.length > 0 && (
        <div className="mx-auto mt-1 w-full max-w-3xl px-2">
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            {contactSuggestions.map((contact) => (
              <button
                key={contact.email}
                type="button"
                onClick={() => insertContactMention(contact)}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-hover"
              >
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">
                    {contact.displayName || contact.email}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {contact.email}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
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
      <AiChatEmailPickerDialog
        open={isEmailPickerOpen}
        onOpenChange={setIsEmailPickerOpen}
        accountId={accountId}
        excludeMessageIds={excludeMessageIds}
        onSelect={(email) => {
          if (!attachmentsContext?.addAttachment) {
            setAttachError("Email context is unavailable in this view.")
            return
          }
          attachmentsContext.addAttachment({
            messageId: email.id,
            accountId: email.accountId,
            subject: email.subject || "(No subject)",
            fromName: email.from.name || email.from.email,
          })
        }}
      />
    </div>
  )
}

interface AiChatMessagesProps {
  messages: AiChatMessage[]
  isLoading: boolean
  emptyTitle: string
  emptyDescription: string
  error?: string | null
  onCopyMessage?: (content: string) => void
  onUpdateDraft?: (messageIndex: number, draft: Partial<AiChatDraft>) => void
  onSaveDraft?: (messageIndex: number) => void
  onSendDraft?: (messageIndex: number) => void
  onOpenDraftInCompose?: (draft: AiChatDraft) => void
  onUpdateCalendarDraft?: (messageIndex: number, draft: Partial<AiChatCalendarDraft>) => void
  onCreateCalendarDraft?: (messageIndex: number) => void
  calendarConnections?: CalendarConnection[]
}

export function AiChatMessages({
  messages,
  isLoading,
  emptyTitle,
  emptyDescription,
  error,
  onCopyMessage,
  onUpdateDraft,
  onSaveDraft,
  onSendDraft,
  onOpenDraftInCompose,
  onUpdateCalendarDraft,
  onCreateCalendarDraft,
  calendarConnections = [],
}: AiChatMessagesProps) {
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
                <div className="group max-w-[95%] rounded-2xl px-1 py-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <AiChatMarkdown content={message.content} />
                      {message.computerUse ? (
                        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-2.5 py-1 text-xs text-muted-foreground">
                          <Wrench className="h-3.5 w-3.5" />
                          Computer use · {message.computerUse.driver} · {message.computerUse.stepCount} step{message.computerUse.stepCount === 1 ? "" : "s"}
                          {message.computerUse.truncated ? " · step limit reached" : ""}
                        </div>
                      ) : null}
                      {message.images?.length ? (
                        <div className="mt-3 grid gap-3">
                          {message.images.map((image, imageIndex) => (
                            <figure key={imageIndex}>
                              {/* Generated data URLs cannot be optimized by next/image. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`data:${image.mimeType};base64,${image.data}`}
                                alt={`Generated image ${imageIndex + 1}`}
                                className="max-h-[28rem] max-w-full rounded-lg border border-border object-contain"
                              />
                            </figure>
                          ))}
                        </div>
                      ) : null}
                      {message.draft && (
                        <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3 text-sm">
                          <div className="grid gap-3">
                            <label className="block text-xs font-medium text-muted-foreground">
                              To
                              <input
                                value={message.draft.to.join(", ")}
                                disabled={message.draft.status === "sending" || message.draft.status === "sent"}
                                onChange={(event) => onUpdateDraft?.(index, { to: parseCalendarAttendees(event.target.value) })}
                                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                                placeholder="recipient@example.com"
                              />
                            </label>
                            <label className="block text-xs font-medium text-muted-foreground">
                              Cc
                              <input
                                value={message.draft.cc.join(", ")}
                                disabled={message.draft.status === "sending" || message.draft.status === "sent"}
                                onChange={(event) => onUpdateDraft?.(index, { cc: parseCalendarAttendees(event.target.value) })}
                                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                                placeholder="optional"
                              />
                            </label>
                            <label className="block text-xs font-medium text-muted-foreground">
                              Subject
                              <input
                                value={message.draft.subject}
                                disabled={message.draft.status === "sending" || message.draft.status === "sent"}
                                onChange={(event) => onUpdateDraft?.(index, { subject: event.target.value })}
                                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Subject"
                              />
                            </label>
                            <label className="block text-xs font-medium text-muted-foreground">
                              Body
                              <textarea
                                value={message.draft.body}
                                disabled={message.draft.status === "sending" || message.draft.status === "sent"}
                                onChange={(event) => onUpdateDraft?.(index, { body: event.target.value })}
                                className="mt-1 min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Email body"
                              />
                            </label>
                          </div>
                          {message.draft.attachments?.length ? (
                            <div className="rounded-lg border border-border bg-surface-subtle p-2 text-xs text-muted-foreground">
                              {message.draft.attachments.length} generated image attachment{message.draft.attachments.length === 1 ? "" : "s"} will be included.
                            </div>
                          ) : null}
                          {message.draft.error && (
                            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                              {message.draft.error}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              {!hasValidRecipient(message.draft)
                                ? "Add a valid recipient before sending."
                                : message.draft.status === "sent"
                                  ? "Email sent."
                                  : message.draft.status === "saved"
                                    ? "Draft saved."
                                    : "Review before sending."}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenDraftInCompose?.(message.draft!)}
                                disabled={message.draft.status === "sending" || message.draft.status === "sent"}
                              >
                                <Mail className="mr-1.5 h-3.5 w-3.5" />
                                Open in compose
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onSaveDraft?.(index)}
                                disabled={message.draft.status === "saving" || message.draft.status === "sending" || message.draft.status === "sent"}
                              >
                                {message.draft.status === "saving" ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                Save draft
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => onSendDraft?.(index)}
                                disabled={
                                  !hasValidRecipient(message.draft) ||
                                  !message.draft.subject.trim() ||
                                  !message.draft.body.trim() ||
                                  message.draft.status === "sending" ||
                                  message.draft.status === "sent"
                                }
                              >
                                {message.draft.status === "sending" ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : message.draft.status === "sent" ? (
                                  <Check className="mr-1.5 h-3.5 w-3.5" />
                                ) : (
                                  <Send className="mr-1.5 h-3.5 w-3.5" />
                                )}
                                {message.draft.status === "sent" ? "Sent" : "Send"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                      {message.calendarDraft && (
                        <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 font-medium text-foreground">
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                Calendar invite
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {message.calendarDraft.startsAt
                                  ? formatCalendarDateTime(message.calendarDraft.startsAt)
                                  : "Time not set"}
                              </p>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={message.calendarDraft.createConference}
                                disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                                onChange={(event) => onUpdateCalendarDraft?.(index, { createConference: event.target.checked })}
                                className="h-4 w-4 rounded border-input"
                              />
                              Video link
                            </label>
                          </div>
                          {(calendarConnections.length > 1 || !message.calendarDraft.accountId) && (
                            <label className="block text-xs font-medium text-muted-foreground">
                              Calendar account
                              <select
                                value={message.calendarDraft.accountId || ""}
                                disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                                onChange={(event) => onUpdateCalendarDraft?.(index, { accountId: event.target.value, needsAccountSelection: !event.target.value })}
                                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                              >
                                <option value="">Choose account</option>
                                {calendarConnections.map((connection) => (
                                  <option key={connection.accountId} value={connection.accountId}>
                                    {connection.accountEmail || "Connected account"} ({connection.provider === "outlook" ? "Outlook" : "Google"})
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          {calendarConnections.length === 1 && message.calendarDraft.accountId && (
                            <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
                              Calendar: {calendarConnections[0].accountEmail || "Connected account"}
                            </div>
                          )}
                          <label className="block text-xs font-medium text-muted-foreground">
                            Title
                            <input
                              value={message.calendarDraft.title}
                              disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                              onChange={(event) => onUpdateCalendarDraft?.(index, { title: event.target.value })}
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-medium text-muted-foreground">
                              Starts
                              <input
                                type="datetime-local"
                                value={isoToLocalInput(message.calendarDraft.startsAt)}
                                disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                                onChange={(event) => onUpdateCalendarDraft?.(index, { startsAt: localInputToIso(event.target.value) })}
                                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                              />
                            </label>
                            <label className="block text-xs font-medium text-muted-foreground">
                              Ends
                              <input
                                type="datetime-local"
                                value={isoToLocalInput(message.calendarDraft.endsAt)}
                                disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                                onChange={(event) => onUpdateCalendarDraft?.(index, { endsAt: localInputToIso(event.target.value) })}
                                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                              />
                            </label>
                          </div>
                          <label className="block text-xs font-medium text-muted-foreground">
                            Attendees
                            <textarea
                              value={message.calendarDraft.attendees.join(", ")}
                              disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                              onChange={(event) => onUpdateCalendarDraft?.(index, { attendees: parseCalendarAttendees(event.target.value) })}
                              placeholder="name@example.com, teammate@example.com"
                              className="mt-1 min-h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                            />
                          </label>
                          <label className="block text-xs font-medium text-muted-foreground">
                            Location
                            <input
                              value={message.calendarDraft.location}
                              disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                              onChange={(event) => onUpdateCalendarDraft?.(index, { location: event.target.value })}
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none"
                            />
                          </label>
                          <label className="block text-xs font-medium text-muted-foreground">
                            Notes
                            <textarea
                              value={message.calendarDraft.description}
                              disabled={message.calendarDraft.status === "creating" || message.calendarDraft.status === "created"}
                              onChange={(event) => onUpdateCalendarDraft?.(index, { description: event.target.value })}
                              className="mt-1 min-h-16 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none"
                            />
                          </label>
                          {message.calendarDraft.error && (
                            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-xs text-destructive">
                              {message.calendarDraft.error}
                            </div>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              {message.calendarDraft.status === "created"
                                ? "Invite created."
                                : hasCreateableCalendarDraft(message.calendarDraft)
                                  ? "Review before creating."
                                  : "Fill the missing title, time, or calendar account."}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => onCreateCalendarDraft?.(index)}
                              disabled={
                                !hasCreateableCalendarDraft(message.calendarDraft) ||
                                message.calendarDraft.status === "creating" ||
                                message.calendarDraft.status === "created"
                              }
                            >
                              {message.calendarDraft.status === "creating" ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : message.calendarDraft.status === "created" ? (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {message.calendarDraft.status === "created" ? "Created" : "Create invite"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    {onCopyMessage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => onCopyMessage(message.content)}
                        aria-label="Copy response"
                      >
                        <Clipboard className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
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
