"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Send, Sparkles, X, Paperclip, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { storage } from "@/lib/storage"
import { api } from "@/lib/api"
import type { Draft } from "@/types"

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
  draft?: Draft
}

export function ComposeDialog({ open, onOpenChange, replyTo, draft }: ComposeDialogProps) {
  const [to, setTo] = useState("")
  const [cc, setCc] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)
  const [showCc, setShowCc] = useState(false)
  const [attachments, setAttachments] = useState<Array<{ filename: string; mimeType: string; data: string; size: number }>>([])
  const isEditingDraft = Boolean(draft?.id)

  const { toast } = useToast()
  const defaultProvider = useMemo(() => {
    if (draft?.provider) return draft.provider
    const accounts = storage.getAccounts()
    return accounts[0]?.provider || "gmail"
  }, [draft?.provider])

  useEffect(() => {
    if (!open) return

    if (draft) {
      setTo(draft.to.join(", "))
      setCc(draft.cc?.join(", ") || "")
      setSubject(draft.subject)
      setBody(draft.body)
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

  // Reset form when dialog closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTo("")
      setCc("")
      setSubject("")
      setBody("")
      setShowCc(false)
      setAttachments([])
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

    const accounts = storage.getAccounts()
    const gmailAccount = accounts.find(a => a.provider === 'gmail')

    if (!gmailAccount?.accessToken) {
      toast({ title: "No Gmail account", description: "Please connect a Gmail account in Settings", variant: "destructive" })
      return
    }

    setIsSending(true)
    try {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: gmailAccount.accessToken,
          refreshToken: gmailAccount.refreshToken,
          expiryDate: gmailAccount.expiryDate,
          to: to.split(",").map(e => e.trim()).filter(Boolean),
          cc: cc ? cc.split(",").map(e => e.trim()).filter(Boolean) : undefined,
          subject,
          body,
          threadId: replyTo?.threadId,
          inReplyToMessageId: replyTo?.messageId,
          attachments: attachments.map((file) => ({
            filename: file.filename,
            mimeType: file.mimeType,
            data: file.data,
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to send email")
      }

      const result = await response.json()
      if (result.auth?.accessToken || result.auth?.expiryDate) {
        const updates: { accessToken?: string; expiryDate?: number } = {}
        if (result.auth.accessToken) updates.accessToken = result.auth.accessToken
        if (result.auth.expiryDate) updates.expiryDate = result.auth.expiryDate
        storage.updateAccount(gmailAccount.id, updates)
      }

      toast({ title: "Email sent!", description: `Your email to ${to} has been sent successfully.` })
      if (draft?.id) {
        storage.removeDraft(draft.id)
      }
      handleOpenChange(false)
    } catch (error: any) {
      console.error("Send email error:", error)
      toast({ title: "Failed to send", description: error.message || "Could not send email", variant: "destructive" })
    } finally {
      setIsSending(false)
    }
  }

  const handleSaveDraft = () => {
    if (!to.trim() && !subject.trim() && !body.trim()) {
      toast({ title: "Nothing to save", description: "Add recipients, subject, or message first." })
      return
    }

    const now = new Date().toISOString()
    const draftPayload: Draft = {
      id: draft?.id || `draft_${Date.now()}`,
      to: to.split(",").map((email) => email.trim()).filter(Boolean),
      cc: cc ? cc.split(",").map((email) => email.trim()).filter(Boolean) : undefined,
      subject: subject.trim() || "(No Subject)",
      body,
      inReplyTo: replyTo?.messageId || draft?.inReplyTo,
      threadId: replyTo?.threadId || draft?.threadId,
      provider: defaultProvider,
      lastEdited: now,
      aiGenerated: Boolean(replyTo?.originalBody),
    }

    if (draft?.id) {
      storage.updateDraft(draft.id, draftPayload)
    } else {
      storage.addDraft(draftPayload)
    }

    toast({
      title: "Draft saved",
      description: isEditingDraft ? "Your draft has been updated." : "Your draft has been saved.",
    })
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
    } catch (error) {
      toast({ title: "Attachment failed", description: "Could not read one of the files.", variant: "destructive" })
    }
  }

  const handleGenerateDraft = async () => {
    if (!replyTo?.originalBody) {
      toast({ title: "No context", description: "AI draft generation requires the original email context", variant: "destructive" })
      return
    }

    const settings = storage.getSettings()
    if (!settings.openaiApiKey) {
      toast({ title: "API Key Required", description: "Please add your OpenAI API key in Settings", variant: "destructive" })
      return
    }

    setIsGeneratingDraft(true)
    try {
      const draft = await api.ai.generateDraft(
        replyTo.originalBody,
        subject,
        "professional"
      )
      setBody(draft)
      toast({ title: "Draft generated!", description: "AI has created a draft response for you" })
    } catch (error: any) {
      console.error("Generate draft error:", error)
      toast({ title: "Failed to generate draft", description: error.message || "Could not generate draft", variant: "destructive" })
    } finally {
      setIsGeneratingDraft(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto border border-white/[0.06] bg-[#0A0A0B] text-[#FAFAF9] rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.98) 0%, rgba(10,10,11,1) 100%)', backdropFilter: 'blur(40px)' }}>
        <DialogHeader>
          <DialogTitle className="text-[#FAFAF9]">{replyTo ? "Reply" : "New Email"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* To field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="to" className="text-[#FAFAF9]">To</Label>
              {!showCc && (
                <Button size="sm" onClick={() => setShowCc(true)} className="bg-transparent text-[#8A8A8A] hover:text-[#E8DCC4] hover:bg-white/[0.03]">
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
              className="bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
            />
          </div>

          {/* Cc field (optional) */}
          {showCc && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="cc" className="text-[#FAFAF9]">Cc</Label>
                <Button size="sm" onClick={() => { setShowCc(false); setCc("") }} className="bg-transparent text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]">
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
                className="bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
              />
            </div>
          )}

          {/* Subject field */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-[#FAFAF9]">Subject</Label>
            <Input
              id="subject"
              placeholder="Email subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
              className="bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
            />
          </div>

          {/* Body field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body" className="text-[#FAFAF9]">Message</Label>
              {replyTo?.originalBody && (
                <Button
                  size="sm"
                  onClick={handleGenerateDraft}
                  disabled={isGeneratingDraft || isSending}
                  className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-lg"
                >
                  {isGeneratingDraft ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3 text-[#E8DCC4]" />
                  )}
                  AI Draft
                </Button>
              )}
            </div>
            <Textarea
              id="body"
              placeholder="Write your message here..."
              className="min-h-[200px] resize-none bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isSending}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-medium text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40 transition-colors">
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
                <span className="text-xs text-[#8A8A8A]">{attachments.length} file(s) attached</span>
              )}
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
                {attachments.map((file, index) => (
                  <div key={`${file.filename}-${index}`} className="flex items-center justify-between text-xs">
                    <span className="truncate text-[#FAFAF9]">{file.filename}</span>
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-[#8A8A8A] hover:text-red-400"
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
          <Button onClick={() => handleOpenChange(false)} disabled={isSending} className="border border-white/[0.08] bg-transparent text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03] rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSaveDraft}
            disabled={isSending || isGeneratingDraft}
            className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-xl"
          >
            Save Draft
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to.trim() || !subject.trim() || !body.trim()} className="bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl">
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

