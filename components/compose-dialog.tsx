"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Check, CloudOff, Loader2, Send, X, Paperclip, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { emailApi, type RemoteDraft } from "@/lib/email-api"

interface ComposeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  replyTo?: {
    to: string
    subject: string
    threadId?: string
    messageId?: string
    originalBody?: string
  }
  draft?: RemoteDraft
}

type DraftStatus = "idle" | "saving" | "saved" | "failed"

const AUTOSAVE_DELAY_MS = 2500

export function ComposeDialog({ open, onOpenChange, replyTo, draft }: ComposeDialogProps) {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
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

    skipNextAutosave.current = true
    setDraftStatus(draft ? "saved" : "idle")
    setDraftId(draft?.id || null)

    if (draft) {
      setTo(draft.to.join(", "))
      setCc(draft.cc?.join(", ") || "")
      setSubject(draft.subject)
      setBody(draft.body || draft.snippet || "")
      setShowCc(Boolean(draft.cc?.length))
      setAttachments([])
      return
    }

    if (replyTo) {
      setTo(replyTo.to)
      setCc("")
      setSubject(replyTo.subject.startsWith("Re:") ? replyTo.subject : `Re: ${replyTo.subject}`)
      setBody("")
      setShowCc(false)
      setAttachments([])
      return
    }

    setTo("")
    setCc("")
    setSubject("")
    setBody("")
    setShowCc(false)
    setAttachments([])
  }, [open, draft, replyTo])

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
      const result = await emailApi.saveDraft({
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
  }, [to, cc, subject, body, open])

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      setTo("")
      setCc("")
      setSubject("")
      setBody("")
      setShowCc(false)
      setAttachments([])
      setDraftId(null)
      setDraftStatus("idle")
    }
    onOpenChange(isOpen)
  }

  const handleSend = async () => {
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
            <DialogTitle className="text-foreground">
              {replyTo ? "Reply" : isEditingDraft ? "Edit Draft" : "New Email"}
            </DialogTitle>
            {draftStatusIndicator()}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
