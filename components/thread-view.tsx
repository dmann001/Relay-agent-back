"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Archive, Trash2, Loader2, Paperclip, Download, Send, RefreshCw, ArrowLeft, Reply } from "lucide-react"
import { emailApi } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"
import { formatEmailContent, formatFileSize } from "@/lib/email-utils"
import type { Email } from "@/types"

function formatTimestamp(date: string): string {
  const emailDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - emailDate.getTime()
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours} hours ago`
  return emailDate.toLocaleDateString()
}

export function ThreadView({ threadId }: { threadId: string }) {
  const [email, setEmail] = useState<Email | null>(null)
  const [isLoadingEmail, setIsLoadingEmail] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState("")
  const [isSendingReply, setIsSendingReply] = useState(false)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  // The email list is served from the Relay DB metadata cache, but the full
  // body is fetched LIVE from Gmail when the email is opened.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingEmail(true)
      setLoadError(null)

      try {
        const fullEmail = await emailApi.getEmail(threadId)
        if (cancelled) return
        setEmail({ ...fullEmail, read: true })

        // Mark as read in Gmail + DB cache (fire and forget).
        if (!fullEmail.read) {
          void emailApi.modifyEmail(threadId, "markRead").catch(() => {})
        }
      } catch (error: any) {
        if (cancelled) return
        setLoadError(error?.message || "Could not load this email from Gmail")
      } finally {
        if (!cancelled) setIsLoadingEmail(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [threadId])

  const handleSaveDraft = async () => {
    if (!email || !draftContent.trim()) return

    try {
      await emailApi.saveDraft({
        to: [email.from.email],
        subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
        body: draftContent,
        threadId: email.threadId,
        inReplyToMessageId: email.messageId || email.id,
      })
      toast({
        title: "Draft Saved",
        description: "Saved to Gmail Drafts",
      })
    } catch (error: any) {
      toast({
        title: "Draft save failed",
        description: error.message || "Could not save draft to Gmail",
        variant: "destructive",
      })
    }
  }

  const handleSendReply = async () => {
    if (!email || !draftContent.trim()) return

    setIsSendingReply(true)
    try {
      await emailApi.sendEmail({
        to: [email.from.email],
        subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
        body: draftContent,
        threadId: email.threadId,
        inReplyToMessageId: email.messageId || email.id,
      })

      toast({
        title: "Reply sent!",
        description: `Your reply to ${email.from.name} has been sent.`,
      })
      setDraftContent("")
    } catch (error: any) {
      console.error("Send reply error:", error)
      toast({
        title: "Failed to send",
        description: error.message || "Could not send reply",
        variant: "destructive",
      })
    } finally {
      setIsSendingReply(false)
    }
  }

  const handleDownloadAttachment = async (attachment: NonNullable<Email["attachments"]>[number]) => {
    if (!email) return
    if (attachment.data) {
      const link = document.createElement('a');
      link.href = `data:${attachment.mimeType};base64,${attachment.data}`;
      link.download = attachment.filename || 'attachment';
      link.click();
      return
    }

    if (!attachment.attachmentId) return

    try {
      const data = await emailApi.getAttachment(email.id, attachment.attachmentId)
      const link = document.createElement('a');
      link.href = `data:${attachment.mimeType};base64,${data}`;
      link.download = attachment.filename || 'attachment';
      link.click();
    } catch (error: any) {
      toast({
        title: "Attachment failed",
        description: error.message || "Could not download attachment",
        variant: "destructive",
      })
    }
  }

  // Archive email - removes the INBOX label in Gmail, then updates the cache.
  const handleArchive = async () => {
    if (!email) return
    try {
      await emailApi.modifyEmail(email.id, "archive")
      toast({ title: "Email Archived", description: "Removed from Inbox in Gmail too" })
      router.push("/inbox")
    } catch (error: any) {
      toast({
        title: "Archive failed",
        description: error.message || "Could not archive this email",
        variant: "destructive",
      })
    }
  }

  // Delete email - moves it to Gmail Trash (no permanent delete).
  const handleTrash = async () => {
    if (!email) return
    try {
      await emailApi.modifyEmail(email.id, "trash")
      toast({ title: "Moved to Trash", description: "You can restore it from Trash" })
      router.push("/inbox")
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not move this email to Trash",
        variant: "destructive",
      })
    }
  }

  const handleReplyClick = () => {
    replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    window.requestAnimationFrame(() => replyRef.current?.focus())
  }

  if (!email && isLoadingEmail) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="mt-2 text-sm text-muted-foreground">Fetching email from Gmail...</p>
        </div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">{loadError || "Email not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Thread Header */}
      <div className="shrink-0 border-b border-border bg-surface-subtle px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/inbox")}
              title="Back to Inbox"
              aria-label="Back to Inbox"
              className="shrink-0 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="truncate text-lg font-medium text-foreground sm:text-xl">{email.subject}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              onClick={handleReplyClick}
              className="rounded-lg bg-brand text-brand-foreground hover:bg-brand-strong"
            >
              <Reply className="mr-2 h-4 w-4" />
              Reply
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleArchive}
              title="Archive"
              aria-label="Archive"
              className="border-border bg-card text-muted-foreground hover:bg-brand-soft hover:text-brand-strong"
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleTrash}
              title="Move to Trash"
              aria-label="Move to Trash"
              className="border-destructive/40 bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Thread Content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-5xl p-4 sm:p-6">
          {/* Email Message */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={email.from.avatar} alt={email.from.name} />
                    <AvatarFallback className="bg-brand-soft text-brand-foreground">
                      {email.from.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-foreground">{email.from.name}</div>
                    <div className="text-xs text-muted-foreground">{email.from.email}</div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{formatTimestamp(email.date)}</span>
              </div>

              {/* Email Body - fetched live from Gmail */}
              {isLoadingEmail && !email.body ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  Loading full email from Gmail...
                </div>
              ) : null}
              {(() => {
                const { html, isHtml } = formatEmailContent(
                  email.body,
                  email.bodyPlain || email.snippet
                );

                if (!html.trim() && !isLoadingEmail) {
                  return (
                    <p className="py-4 text-sm italic text-muted-foreground">
                      This email has no body content.
                    </p>
                  );
                }

                if (isHtml) {
                  return (
                    <div className="email-content-wrapper overflow-x-auto rounded-xl border border-border bg-white">
                      <div
                        className="email-html-content"
                        dangerouslySetInnerHTML={{ __html: html }}
                      />
                      <style dangerouslySetInnerHTML={{
                        __html: `
                        .email-html-content {
                          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #202124;
                          background: #ffffff;
                          padding: 24px;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                        }
                        
                        /* Clean text styling */
                        .email-html-content p {
                          margin: 0.75em 0;
                        }
                        .email-html-content p:first-child {
                          margin-top: 0;
                        }
                        .email-html-content p:last-child {
                          margin-bottom: 0;
                        }
                        
                        /* Links */
                        .email-html-content a {
                          color: hsl(var(--primary));
                          text-decoration: none;
                        }
                        .email-html-content a:hover {
                          text-decoration: underline;
                        }
                        
                        /* Images - clean, no boxes */
                        .email-html-content img {
                          max-width: 100%;
                          height: auto;
                          display: inline-block;
                          border: none !important;
                          outline: none !important;
                        }
                        
                        /* Keep responsive HTML email layouts without overriding sender styles. */
                        .email-html-content table {
                          border-collapse: collapse;
                          max-width: 100%;
                        }
                        .email-html-content td,
                        .email-html-content th {
                          vertical-align: top;
                        }
                        
                        /* Lists */
                        .email-html-content ul,
                        .email-html-content ol {
                          margin: 0.75em 0;
                          padding-left: 1.5em;
                        }
                        .email-html-content li {
                          margin: 0.25em 0;
                        }
                        
                        /* Blockquotes - subtle left border only */
                        .email-html-content blockquote {
                          margin: 0.75em 0;
                          padding-left: 1em;
                          border-left: 3px solid rgba(128, 128, 128, 0.2);
                          color: inherit;
                          opacity: 0.85;
                        }
                        
                        /* Headings */
                        .email-html-content h1,
                        .email-html-content h2,
                        .email-html-content h3,
                        .email-html-content h4,
                        .email-html-content h5,
                        .email-html-content h6 {
                          margin: 1em 0 0.5em 0;
                          font-weight: 600;
                          line-height: 1.3;
                        }
                        .email-html-content h1 { font-size: 1.5em; }
                        .email-html-content h2 { font-size: 1.3em; }
                        .email-html-content h3 { font-size: 1.15em; }
                        
                        /* Code */
                        .email-html-content pre {
                          background: rgba(128, 128, 128, 0.08);
                          padding: 0.75em;
                          border-radius: 6px;
                          overflow-x: auto;
                          font-size: 0.9em;
                        }
                        .email-html-content code {
                          background: rgba(128, 128, 128, 0.08);
                          padding: 0.15em 0.3em;
                          border-radius: 3px;
                          font-size: 0.9em;
                        }
                        
                        /* Hide empty elements completely */
                        .email-html-content p:empty {
                          display: none !important;
                        }
                        
                        /* Horizontal rules */
                        .email-html-content hr {
                          border: none;
                          border-top: 1px solid rgba(128, 128, 128, 0.15);
                          margin: 1em 0;
                        }
                        `
                      }} />
                    </div>
                  );
                } else {
                  return (
                    <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface-subtle p-5 text-sm leading-relaxed text-foreground">
                      {html}
                    </div>
                  );
                }
              })()}

              {/* Attachments */}
              {email.attachments && email.attachments.length > 0 && (
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {email.attachments.length} {email.attachments.length === 1 ? 'Attachment' : 'Attachments'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {email.attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="group relative flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3 transition-colors hover:bg-surface-hover"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised">
                          <Paperclip className="h-5 w-5 text-brand" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate pr-6 text-sm font-medium text-foreground">
                            {attachment.filename || 'Untitled'}
                          </div>
                          {attachment.size && (
                            <div className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.size)}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-hover hover:text-brand"
                          onClick={() => handleDownloadAttachment(attachment)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reply Section */}
          <div id="reply-composer" className="mt-8 scroll-mt-6 pb-6">
            <div className="mb-3 text-sm font-medium text-foreground">Reply</div>
            <Textarea
              ref={replyRef}
              placeholder="Write your reply..."
              className="min-h-32 resize-none rounded-xl border-input bg-card text-foreground placeholder:text-muted-foreground focus:border-brand focus:ring-2 focus:ring-brand/20"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                onClick={handleSaveDraft}
                disabled={!draftContent.trim() || isSendingReply}
                className="rounded-xl border border-border bg-surface-raised text-foreground hover:bg-surface-hover"
              >
                Save Draft
              </Button>
              <Button
                onClick={handleSendReply}
                disabled={!draftContent.trim() || isSendingReply}
                className="rounded-xl bg-brand font-medium text-brand-foreground hover:bg-brand-strong"
              >
                {isSendingReply ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Reply
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
