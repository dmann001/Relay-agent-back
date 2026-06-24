"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Archive,
  Trash2,
  Loader2,
  Paperclip,
  Download,
  Eye,
  Send,
  RefreshCw,
  ArrowLeft,
  Reply,
} from "lucide-react";
import { emailApi } from "@/lib/email-api";
import { useToast } from "@/hooks/use-toast";
import {
  formatEmailContent,
  formatFileSize,
  formatMailboxTimestamp,
} from "@/lib/email-utils";
import {
  AiActionStrip,
  AiThreadAssistant,
} from "@/components/ai-thread-assistant";
import { useEmailContextMenuOptional } from "@/components/email-context-menu-provider";
import { TrackCommitmentDialog, type CommitmentCandidate } from "@/components/track-commitment-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Email } from "@/types";

interface ThreadViewProps {
  threadId: string;
  accountId?: string;
  embedded?: boolean;
  onClose?: () => void;
  onRemoved?: (messageId: string, accountId?: string) => void;
  onRead?: (messageId: string, accountId?: string) => void;
}

type EmailAttachment = NonNullable<Email["attachments"]>[number];

interface AttachmentPreview {
  attachment: EmailAttachment;
  dataUrl?: string;
  error?: string;
  isLoading: boolean;
}

const normalizeBase64 = (data: string) => {
  const cleaned = data.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = cleaned.length % 4;
  return padding ? `${cleaned}${"=".repeat(4 - padding)}` : cleaned;
};

const attachmentDataUrl = (attachment: EmailAttachment, data: string) =>
  `data:${attachment.mimeType || "application/octet-stream"};base64,${normalizeBase64(data)}`;

const attachmentName = (attachment: EmailAttachment) =>
  attachment.filename || "attachment";

const isPdfAttachment = (attachment: EmailAttachment) =>
  attachment.mimeType.toLowerCase() === "application/pdf" ||
  attachmentName(attachment).toLowerCase().endsWith(".pdf");

const isImageAttachment = (attachment: EmailAttachment) =>
  attachment.mimeType.toLowerCase().startsWith("image/");

const canPreviewAttachment = (attachment: EmailAttachment) =>
  isImageAttachment(attachment) || isPdfAttachment(attachment);

export function ThreadView({
  threadId,
  accountId,
  embedded = false,
  onClose,
  onRemoved,
  onRead,
}: ThreadViewProps) {
  const [email, setEmail] = useState<Email | null>(null);
  const [threadMessages, setThreadMessages] = useState<Email[]>([]);
  const [isLoadingEmail, setIsLoadingEmail] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [manualCommitment, setManualCommitment] = useState<CommitmentCandidate | null>(null);
  const [attachmentPreview, setAttachmentPreview] =
    useState<AttachmentPreview | null>(null);
  const [aiAction, setAiAction] = useState<
    "summary" | "draft" | "tasks" | "ask" | undefined
  >();
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const { toast } = useToast();
  const emailContextMenu = useEmailContextMenuOptional();

  // The email list is served from the Relay DB metadata cache, but the full
  // body is fetched LIVE from Gmail when the email is opened.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoadingEmail(true);
      setLoadError(null);
      setAttachmentPreview(null);

      try {
        const thread = await emailApi.getThread(threadId, accountId);
        if (cancelled) return;
        const selected =
          thread.messages.find(({ id }) => id === threadId) ||
          thread.messages.at(-1);
        if (!selected) throw new Error("Email not found");
        const fullEmail = {
          ...selected,
          accountId: thread.accountId,
          accountEmail: thread.accountEmail,
        };
        setThreadMessages(thread.messages);
        setEmail({ ...fullEmail, read: thread.readUpdateError ? fullEmail.read : true });

        if (thread.readUpdateError) {
          toast({
            title: "Could not mark as read",
            description: thread.readUpdateError,
            variant: "destructive",
          });
        } else if (!fullEmail.read) {
          onRead?.(threadId, fullEmail.accountId);
        }
      } catch (error: any) {
        if (cancelled) return;
        setLoadError(error?.message || "Could not load this email from Gmail");
      } finally {
        if (!cancelled) setIsLoadingEmail(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accountId, onRead, threadId, toast]);

  const handleSaveDraft = async () => {
    if (!email || !draftContent.trim()) return;

    try {
      await emailApi.saveDraft({
        accountId: email.accountId,
        to: [email.from.email],
        subject: email.subject.startsWith("Re:")
          ? email.subject
          : `Re: ${email.subject}`,
        body: draftContent,
        threadId: email.threadId,
        inReplyToMessageId: email.messageId || email.id,
      });
      toast({
        title: "Draft Saved",
        description: "Saved to Gmail Drafts",
      });
    } catch (error: any) {
      toast({
        title: "Draft save failed",
        description: error.message || "Could not save draft to Gmail",
        variant: "destructive",
      });
    }
  };

  const handleSendReply = async () => {
    if (!email || !draftContent.trim()) return;

    setIsSendingReply(true);
    try {
      await emailApi.sendEmail({
        accountId: email.accountId,
        to: [email.from.email],
        subject: email.subject.startsWith("Re:")
          ? email.subject
          : `Re: ${email.subject}`,
        body: draftContent,
        threadId: email.threadId,
        inReplyToMessageId: email.messageId || email.id,
      });

      toast({
        title: "Reply sent!",
        description: `Your reply to ${email.from.name} has been sent.`,
      });
      setDraftContent("");
    } catch (error: any) {
      console.error("Send reply error:", error);
      toast({
        title: "Failed to send",
        description: error.message || "Could not send reply",
        variant: "destructive",
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleDownloadAttachment = async (
    attachment: EmailAttachment,
  ) => {
    if (!email) return;
    if (attachment.data) {
      const link = document.createElement("a");
      link.href = attachmentDataUrl(attachment, attachment.data);
      link.download = attachmentName(attachment);
      link.click();
      return;
    }

    if (!attachment.attachmentId) return;

    try {
      const data = await emailApi.getAttachment(
        email.id,
        attachment.attachmentId,
      );
      const link = document.createElement("a");
      link.href = attachmentDataUrl(attachment, data);
      link.download = attachmentName(attachment);
      link.click();
    } catch (error: any) {
      toast({
        title: "Attachment failed",
        description: error.message || "Could not download attachment",
        variant: "destructive",
      });
    }
  };

  const handlePreviewAttachment = async (attachment: EmailAttachment) => {
    if (!email || !canPreviewAttachment(attachment)) return;

    setAttachmentPreview({ attachment, isLoading: true });

    try {
      if (attachment.data) {
        setAttachmentPreview({
          attachment,
          dataUrl: attachmentDataUrl(attachment, attachment.data),
          isLoading: false,
        });
        return;
      }

      if (!attachment.attachmentId) {
        throw new Error("This attachment cannot be previewed.");
      }

      const data = await emailApi.getAttachment(email.id, attachment.attachmentId);
      setAttachmentPreview({
        attachment,
        dataUrl: attachmentDataUrl(attachment, data),
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.message || "Could not preview attachment";
      setAttachmentPreview({
        attachment,
        error: message,
        isLoading: false,
      });
      toast({
        title: "Preview failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Archive email - removes the INBOX label in Gmail, then updates the cache.
  const handleArchive = async () => {
    if (!email) return;
    try {
      await emailApi.modifyEmail(email.id, "archive", email.accountId);
      toast({
        title: "Email Archived",
        description: "Removed from Inbox in Gmail too",
      });
      onRemoved?.(email.id, email.accountId);
      if (embedded && !onRemoved) onClose?.();
      else if (!embedded) router.push("/inbox");
    } catch (error: any) {
      toast({
        title: "Archive failed",
        description: error.message || "Could not archive this email",
        variant: "destructive",
      });
    }
  };

  // Delete email - moves it to Gmail Trash (no permanent delete).
  const handleTrash = async () => {
    if (!email) return;
    try {
      await emailApi.modifyEmail(email.id, "trash", email.accountId);
      toast({
        title: "Moved to Trash",
        description: "You can restore it from Trash",
      });
      onRemoved?.(email.id, email.accountId);
      if (embedded && !onRemoved) onClose?.();
      else if (!embedded) router.push("/inbox");
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not move this email to Trash",
        variant: "destructive",
      });
    }
  };

  const handleReplyClick = () => {
    replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => replyRef.current?.focus());
  };

  const handleAiAction = (action: "summary" | "draft" | "tasks" | "ask") => {
    setAiAction(action);
    setIsAiOpen(true);
  };

  const handleInsertAiDraft = (draft: string) => {
    setDraftContent(draft);
    setIsAiOpen(false);
    window.requestAnimationFrame(() => {
      replyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      replyRef.current?.focus();
    });
  };

  if (!email && isLoadingEmail) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="mt-2 text-sm text-muted-foreground">
            Fetching email from Gmail...
          </p>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">
            {loadError || "Email not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden bg-background"
      onContextMenu={emailContextMenu ? (event) => emailContextMenu.openEmailContextMenu(event, email) : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Thread Header */}
        <div className="shrink-0 border-b border-border bg-surface-subtle px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => (embedded ? onClose?.() : router.push("/inbox"))}
                title={embedded ? "Close email" : "Back to Inbox"}
                aria-label={embedded ? "Close email" : "Back to Inbox"}
                className="shrink-0 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1
                className={
                  embedded
                    ? "truncate text-base font-medium text-foreground sm:text-lg"
                    : "truncate text-lg font-medium text-foreground sm:text-xl"
                }
              >
                {email.subject}
              </h1>
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

        <div className="shrink-0 border-b border-border bg-card px-4 py-2.5 sm:px-6">
          <AiActionStrip onAction={handleAiAction} onTrack={() => setManualCommitment({
            title: `Follow up: ${email.subject}`,
            owner: email.from.name || email.from.email,
            dueDate: "",
            evidence: `Follow up on “${email.subject}”.`,
          })} />
        </div>

        {/* Thread Content */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-5xl p-4 sm:p-6">
            {/* Email conversation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {threadMessages.length} message
                  {threadMessages.length === 1 ? "" : "s"} in this conversation
                </span>
                <span>{email.accountEmail}</span>
              </div>
              {threadMessages
                .filter(({ id }) => id !== email.id)
                .map((message) => (
                  <details
                    key={message.id}
                    className="rounded-xl border border-border bg-card"
                  >
                    <summary className="cursor-pointer list-none px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">
                            {message.from.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {message.bodyPlain ||
                              message.snippet ||
                              "No preview"}
                          </div>
                        </div>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {formatMailboxTimestamp(message.date)}
                        </time>
                      </div>
                    </summary>
                    <div className="border-t border-border px-4 py-4 whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {message.bodyPlain ||
                        message.snippet ||
                        "No message body."}
                    </div>
                  </details>
                ))}
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage
                        src={email.from.avatar}
                        alt={email.from.name}
                      />
                      <AvatarFallback className="bg-brand-soft text-brand-foreground">
                        {email.from.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-foreground">
                        {email.from.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {email.from.email}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatMailboxTimestamp(email.date)}
                  </span>
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
                    email.bodyPlain || email.snippet,
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
                        <style
                          dangerouslySetInnerHTML={{
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
                        `,
                          }}
                        />
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
                        {email.attachments.length}{" "}
                        {email.attachments.length === 1
                          ? "Attachment"
                          : "Attachments"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {email.attachments.map((attachment, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle p-3 transition-colors hover:bg-surface-hover"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised">
                            <Paperclip className="h-5 w-5 text-brand" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-foreground">
                              {attachment.filename || "Untitled"}
                            </div>
                            {attachment.size && (
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(attachment.size)}
                              </div>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {canPreviewAttachment(attachment) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 border-border bg-card text-xs"
                                  onClick={() => handlePreviewAttachment(attachment)}
                                  aria-label={`Preview ${attachmentName(attachment)}`}
                                >
                                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                                  Preview
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 border-border bg-card text-xs"
                                onClick={() => handleDownloadAttachment(attachment)}
                                aria-label={`Download ${attachmentName(attachment)}`}
                              >
                                <Download className="mr-1.5 h-3.5 w-3.5" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reply Section */}
            <div id="reply-composer" className="mt-8 scroll-mt-6 pb-6">
              <div className="mb-3 text-sm font-medium text-foreground">
                Reply
              </div>
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
      <AiThreadAssistant
        messageId={email.id}
        accountId={email.accountId}
        subject={email.subject}
        open={isAiOpen}
        initialAction={aiAction}
        onOpenChange={setIsAiOpen}
        onInsertDraft={handleInsertAiDraft}
      />
      <TrackCommitmentDialog
        candidate={manualCommitment}
        accountId={email.accountId}
        providerMessageId={email.id}
        open={Boolean(manualCommitment)}
        onOpenChange={(open) => { if (!open) setManualCommitment(null) }}
        onTracked={() => {
          toast({ title: "Commitment tracked", description: "You can manage it from Commitments." })
        }}
      />
      <Dialog
        open={Boolean(attachmentPreview)}
        onOpenChange={(open) => {
          if (!open) setAttachmentPreview(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
          {attachmentPreview && (
            <div className="flex max-h-[90vh] flex-col">
              <DialogHeader className="border-b border-border px-5 py-4">
                <DialogTitle className="truncate pr-8 text-base">
                  {attachmentName(attachmentPreview.attachment)}
                </DialogTitle>
                <DialogDescription>
                  {isPdfAttachment(attachmentPreview.attachment)
                    ? "PDF attachment preview"
                    : "Image attachment preview"}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-auto bg-surface-subtle p-4">
                {attachmentPreview.isLoading ? (
                  <div className="flex min-h-[24rem] items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand" />
                    Loading attachment preview...
                  </div>
                ) : attachmentPreview.error ? (
                  <div className="flex min-h-[24rem] items-center justify-center text-sm text-destructive">
                    {attachmentPreview.error}
                  </div>
                ) : attachmentPreview.dataUrl &&
                  isImageAttachment(attachmentPreview.attachment) ? (
                  <div className="flex min-h-[24rem] items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Attachment previews use data URLs that next/image cannot optimize. */}
                    <img
                      src={attachmentPreview.dataUrl}
                      alt={attachmentName(attachmentPreview.attachment)}
                      className="max-h-[70vh] max-w-full rounded-lg border border-border bg-background object-contain"
                    />
                  </div>
                ) : attachmentPreview.dataUrl ? (
                  <iframe
                    src={attachmentPreview.dataUrl}
                    title={`Preview ${attachmentName(attachmentPreview.attachment)}`}
                    className="h-[70vh] w-full rounded-lg border border-border bg-background"
                  />
                ) : null}
              </div>
              <div className="flex justify-end border-t border-border bg-background px-5 py-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    handleDownloadAttachment(attachmentPreview.attachment)
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
