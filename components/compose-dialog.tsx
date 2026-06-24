"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, CloudOff, Loader2, Send, X, Paperclip, Trash2, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { emailApi, type ConnectedAccount, type RemoteDraft } from "@/lib/email-api"

interface ComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  replyTo?: {
    to: string
    subject: string
    threadId?: string
    messageId?: string
    originalBody?: string
    accountId?: string
  }
  draft?: RemoteDraft
  defaultAccountId?: string
  initialDraft?: {
    accountId?: string
    to?: string[]
    cc?: string[]
    subject?: string
    body?: string
    generatedDraft?: string
    generatedDraftId?: string
  }
}

type DraftStatus = "idle" | "saving" | "saved" | "failed"

const AUTOSAVE_DELAY_MS = 2500

export function ComposeDialog({ open, onOpenChange, replyTo, draft, defaultAccountId, initialDraft }: ComposeDialogProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([])
  const [accountId, setAccountId] = useState("")
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiAnswer, setAiAnswer] = useState("")
  const [aiSubject, setAiSubject] = useState("")
  const [aiBody, setAiBody] = useState("")
  const [generatedDraft, setGeneratedDraft] = useState<{ body: string; id?: string } | null>(null)
  const [showCc, setShowCc] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ filename: string; mimeType: string; data: string; size: number }>>([])

  // Draft autosave state: drafts are saved to Gmail; the Relay DB keeps only
  // the gmailDraftId + a small preview.
  const [draftId, setDraftId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle")
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextAutosave = useRef(true)

  const isEditingDraft = Boolean(draft?.id)
  const { toast } = useToast()

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void emailApi.listAccounts().then((loaded) => {
      if (cancelled) return
      setAccounts(loaded)
      const requested = draft?.accountId || initialDraft?.accountId || replyTo?.accountId || defaultAccountId
      setAccountId(requested && loaded.some(({ id }) => id === requested) ? requested : loaded[0]?.id || "")
    }).catch(() => setAccounts([]))

    skipNextAutosave.current = true
    setDraftStatus(draft ? "saved" : "idle")
    setDraftId(draft?.id || null)

    const resetAiState = () => {
      setIsAiOpen(false)
      setAiPrompt("")
      setAiAnswer("")
      setAiSubject("")
      setAiBody("")
      setGeneratedDraft(null)
    }

    if (draft) {
      setTo(draft.to.join(", "))
      setCc(draft.cc?.join(", ") || "")
      setSubject(draft.subject)
      setBody(draft.body || draft.snippet || "")
      setShowCc(Boolean(draft.cc?.length))
      setAttachments([])
      resetAiState()
      setGeneratedDraft(null)
      return
    }

    if (initialDraft) {
      setTo((initialDraft.to || []).join(", "))
      setCc((initialDraft.cc || []).join(", "))
      setSubject(initialDraft.subject || "")
      setBody(initialDraft.body || "")
      setShowCc(Boolean(initialDraft.cc?.length))
      setAttachments([])
      resetAiState()
      setGeneratedDraft(initialDraft.generatedDraft ? { body: initialDraft.generatedDraft, id: initialDraft.generatedDraftId } : null)
      return
    }

    if (replyTo) {
      setTo(replyTo.to)
      setCc("")
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`)
      setBody("")
      setShowCc(false)
      setAttachments([])
      resetAiState()
      setGeneratedDraft(null)
      return
    }

    setTo("")
    setCc("")
    setSubject("")
    setBody("")
    setShowCc(false)
    setAttachments([])
    resetAiState()
    setGeneratedDraft(null)
    return () => { cancelled = true }
  }, [open, draft, replyTo, defaultAccountId, initialDraft])

  const parseRecipients = (value: string) =>
    value.split(",").map((e) => e.trim()).filter(Boolean)

  const saveDraft = async (silent: boolean = true): Promise<string | null> => {
    if (!to.trim() && !subject.trim() && !body.trim()) {
      if (!silent) {
        toast({ title: "Nothing to save", description: "Add recipients, subject, or message first." })
      }
      return null
    }

    setDraftStatus("saving")
    try {
      if (!accountId) throw new Error("Choose a sending account")
      const result = await emailApi.saveDraft({
        accountId,
        draftId: draftId || undefined,
        to: parseRecipients(to),
        cc: cc ? parseRecipients(cc) : undefined,
        subject: subject.trim(),
        body,
        threadId: replyTo?.threadId,
        inReplyToMessageId: replyTo?.messageId,
      })
      setDraftId(result.draftId)
      setDraftStatus("saved")
      if (!silent) {
        toast({
          title: "Draft saved",
          description: "Saved to Gmail Drafts.",
        })
      }
      return result.draftId
    } catch (error: any) {
      setDraftStatus("failed")
      if (!silent) {
        toast({
          title: "Draft save failed",
          description: error.message || "Could not save draft to Gmail",
          variant: "destructive",
        })
      }
      return null
    }
  }

  // Autosave to Gmail while typing (debounced).
  useEffect(() => {
    if (!open || isSending) return
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    if (!to.trim() && !subject.trim() && !body.trim()) return

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      void saveDraft(true)
    }, AUTOSAVE_DELAY_MS)

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, subject, body, accountId, open])

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      if (!isSending && (to.trim() || subject.trim() || body.trim())) void saveDraft(true)
      setTo("")
      setCc("")
      setSubject("")
      setBody("")
      setShowCc(false)
      setAttachments([])
      setDraftId(null)
      setDraftStatus("idle")
      setIsAiOpen(false)
      setAiPrompt("")
      setAiAnswer("")
      setAiSubject("")
      setAiBody("")
    }
    onOpenChange(isOpen)
  }

  const handleRunAi = async () => {
    if (isAiLoading || !accountId) return
    const prompt = aiPrompt.trim() || (body.trim() ? "Improve this draft." : "Draft this email.")
    setIsAiLoading(true)
    setAiAnswer("")
    setAiSubject("")
    setAiBody("")
    try {
      const response = await emailApi.runComposeAi({
        accountId: accountId || undefined,
        prompt,
        to,
        cc,
        subject,
        body,
        contactEmail: parseRecipients(to)[0],
      })
      setAiAnswer(response.result.answer)
      setAiSubject(response.result.subject)
      setAiBody(response.result.body)
    } catch (error: any) {
      toast({
        title: "Relay AI failed",
        description: error.message || "Could not generate writing help.",
        variant: "destructive",
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  const handleAiPromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return
  }

  const handleSend = async () => {
    if (!accountId) {
      toast({ title: "Choose a From account", description: "Select which connected account should send this email.", variant: "destructive" })
      return
    }
    if (!to.trim()) {
      toast({ title: "Missing recipient", description: "Please enter a recipient email", variant: "destructive" })
      return
    }
    if (!subject.trim()) {
      toast({ title: "Missing subject", description: "Please enter a subject", variant: "destructive" })
      return
    }
    if (!body.trim()) {
      toast({ title: "Missing message", description: "Please enter a message", variant: "destructive" })
      return
    }

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setIsSending(true)
    try {
      await emailApi.sendEmail({
        accountId,
        to: parseRecipients(to),
        cc: cc ? parseRecipients(cc) : undefined,
        subject,
        body,
        threadId: replyTo?.threadId,
        inReplyToMessageId: replyTo?.messageId,
        attachments: attachments.map((file) => ({
          filename: file.filename,
          mimeType: file.mimeType,
          data: file.data,
        })),
        // Sending a saved draft removes it from Gmail Drafts + the Relay DB.
        draftId: draftId || undefined,
        generatedDraft: generatedDraft?.body,
        generatedDraftId: generatedDraft?.id,
      })

      toast({ title: "Email sent!", description: `Your email to ${to} has been sent successfully.` })
      handleOpenChange(false)
    } catch (error: any) {
      console.error("Send email error:", error)
      toast({ title: "Failed to send", description: error.message || "Could not send email", variant: "destructive" })
    } finally {
      setIsSending(false)
    }
  }

  const handleAddAttachment = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const fileList = Array.from(files)
    const readFile = (file: File) =>
      new Promise<{ filename: string; mimeType: string; data: string; size: number }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = typeof reader.result === "string" ? reader.result : ""
          const base64 = result.split(",")[1] || ""
          resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", data: base64, size: file.size })
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })

    try {
      const newFiles = await Promise.all(fileList.map(readFile))
      setAttachments((prev) => [...prev, ...newFiles])
    } catch {
      toast({ title: "Attachment failed", description: "Could not read one of the files.", variant: "destructive" })
    }
  }

  const draftStatusIndicator = () => {
    switch (draftStatus) {
      case "saving":
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving draft...
          </span>
        )
      case "saved":
        return (
          <span className="flex items-center gap-1.5 text-xs text-[#28C840]">
            <Check className="h-3 w-3" />
            Draft saved to Gmail
          </span>
        )
      case "failed":
        return (
          <span className="flex items-center gap-1.5 text-xs text-red-400">
            <CloudOff className="h-3 w-3" />
            Draft save failed
          </span>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <div><DialogTitle className="text-foreground">{replyTo ? "Reply" : isEditingDraft ? "Edit Draft" : "New Email"}</DialogTitle><DialogDescription className="sr-only">Choose a sending account, recipients, subject, and message.</DialogDescription></div>
            {draftStatusIndicator()}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="from-account" className="text-foreground">From</Label>
            <select id="from-account" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={isSending || Boolean(replyTo?.accountId) || Boolean(draft?.accountId)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              {!accounts.length && <option value="">No connected account</option>}
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.email}</option>)}
            </select>
            {replyTo?.accountId && <p className="text-xs text-muted-foreground">Replies use the account that received this conversation.</p>}
          </div>

          {/* To field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to" className="text-foreground">To</Label>
              {!showCc && (
                <Button size="sm" onClick={() => setShowCc(true)} className="bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-brand">
                  Add Cc
                </Button>
              )}
            </div>
            <Input
              id="to"
              type="email"
              placeholder="recipient@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={isSending}
              className="rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Cc field (optional) */}
          {showCc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cc" className="text-foreground">Cc</Label>
                <Button size="sm" onClick={() => { setShowCc(false); setCc("") }} className="bg-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                id="cc"
                type="email"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                disabled={isSending}
                className="rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
          )}

          {/* Subject field */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-foreground">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              className="rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          {/* Body field */}
          <div className="space-y-2">
            <Label htmlFor="body" className="text-foreground">Message</Label>
            <Textarea
              id="body"
              placeholder="Write your message here..."
              className="min-h-[200px] resize-none rounded-xl border-input bg-background text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isSending}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAiOpen((current) => !current)}
                className="h-9 rounded-lg border-brand/30 bg-brand-soft/40 text-xs text-brand-strong hover:bg-brand-soft"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                AI
              </Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-subtle px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand">
                <Paperclip className="h-3.5 w-3.5" />
                Add attachment
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => handleAddAttachment(e.target.files)}
                  multiple
                />
              </label>
              {attachments.length > 0 && (
                <span className="text-xs text-muted-foreground">{attachments.length} file(s) attached</span>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-surface-subtle p-3">
                {attachments.map((file, index) => (
                  <div key={`${file.filename}-${index}`} className="flex items-center justify-between text-xs">
                    <span className="truncate text-foreground">{file.filename}</span>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-muted-foreground hover:text-destructive"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {isAiOpen && (
              <div className="space-y-3 rounded-xl border border-brand/20 bg-brand-soft/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Relay AI</div>
                    <p className="text-xs text-muted-foreground">Ask for a draft, rewrite, shorter version, or tone adjustment.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setIsAiOpen(false)}
                    aria-label="Close compose AI"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  onKeyDown={handleAiPromptKeyDown}
                  placeholder="Ask Relay to draft, polish, shorten, or make this warmer..."
                  className="min-h-20 resize-none rounded-lg bg-background"
                  disabled={isAiLoading}
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void handleRunAi()} disabled={isAiLoading || !accountId} size="sm">
                    {isAiLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Thinking...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Ask AI
                      </>
                    )}
                  </Button>
                </div>
                {(aiAnswer || aiSubject || aiBody) && (
                  <div className="space-y-3 rounded-lg border border-border bg-card p-3">
                    {aiAnswer && <p className="text-sm leading-6 text-foreground">{aiAnswer}</p>}
                    {aiSubject && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Suggested subject</div>
                        <p className="mt-1 text-sm text-foreground">{aiSubject}</p>
                      </div>
                    )}
                    {aiBody && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground">Suggested body</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">{aiBody}</div>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      {aiSubject && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setSubject(aiSubject)}>
                          Use subject
                        </Button>
                      )}
                      {aiBody && (
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          setBody(aiBody)
                          setGeneratedDraft({ body: aiBody })
                        }}>
                          Use body
                        </Button>
                      )}
                      {(aiSubject || aiBody) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (aiSubject) setSubject(aiSubject)
                            if (aiBody) {
                              setBody(aiBody)
                              setGeneratedDraft({ body: aiBody })
                            }
                          }}
                        >
                          Insert draft
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => handleOpenChange(false)} disabled={isSending} variant="outline" className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={() => void saveDraft(false)}
            disabled={isSending || draftStatus === "saving"}
            className="rounded-xl border border-border bg-surface-subtle text-foreground hover:bg-surface-hover"
          >
            Save Draft
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to.trim() || !subject.trim() || !body.trim()} className="rounded-xl bg-brand font-medium text-brand-foreground hover:bg-brand-strong">
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
