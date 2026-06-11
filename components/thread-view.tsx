"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AgentBanner } from "@/components/agent-banner"
import { Sparkles, Reply, Forward, Archive, Trash2, MoreHorizontal, Loader2, Wand2, Paperclip, Download, MessageSquare, ListTodo, Calendar, TrendingUp, Smile, Frown, Meh, AlertTriangle, Send, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { api } from "@/lib/api"
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [replySuggestions, setReplySuggestions] = useState<Array<{ type: 'short' | 'medium' | 'detailed'; content: string; tone: string }>>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [extractedTasks, setExtractedTasks] = useState<Array<{ title: string; deadline?: string; priority: 'low' | 'medium' | 'high' }>>([])
  const [isExtractingTasks, setIsExtractingTasks] = useState(false)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const summariesEnabled = storage.getSettings().aiFeatures.autoSummarize

  // The email list is served from the Relay DB metadata cache, but the full
  // body is fetched LIVE from Gmail when the email is opened.
  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingEmail(true)
      setLoadError(null)

      // Show cached metadata instantly while the body loads.
      const cached = storage.getEmails().find((e) => e.id === threadId)
      if (cached) setEmail(cached)

      try {
        const fullEmail = await emailApi.getEmail(threadId)
        if (cancelled) return

        // Preserve any locally cached AI enrichments.
        setEmail((prev) => prev ? {
          ...fullEmail,
          aiSummary: prev.aiSummary || fullEmail.aiSummary,
          aiLabels: prev.aiLabels?.length ? prev.aiLabels : fullEmail.aiLabels,
          sentiment: prev.sentiment || fullEmail.sentiment,
          priorityScore: prev.priorityScore ?? fullEmail.priorityScore,
          read: true,
        } : { ...fullEmail, read: true })

        // Mark as read in Gmail + DB cache (fire and forget).
        if (!fullEmail.read) {
          void emailApi.modifyEmail(threadId, "markRead").catch(() => {})
        }
        storage.updateEmail(threadId, { read: true, lastInteraction: new Date().toISOString() })
      } catch (error: any) {
        if (cancelled) return
        if (!cached) {
          setLoadError(error?.message || "Could not load this email from Gmail")
        } else {
          toast({
            title: "Showing cached preview",
            description: "Could not fetch the full email from Gmail",
            variant: "destructive",
          })
        }
      } finally {
        if (!cancelled) setIsLoadingEmail(false)
      }
    }

    void load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Auto-generation disabled: drafts are only generated on user request.

  const handleGenerateDraft = async (instruction?: string) => {
    if (!email) return

    const settings = storage.getSettings()
    if (!settings.openaiApiKey) {
      toast({
        title: "API Key Required",
        description: "Please add your OpenAI API key in Settings to use AI features",
        variant: "destructive",
      })
      return
    }

    const userContext = (settings.userContext || '').trim()
    setIsGenerating(true)
    try {
      const draft = await api.ai.draftReply(email, instruction, userContext)
      setDraftContent(draft)

      // Only show toast if manually triggered (not auto-generated)
      if (instruction) {
        toast({
          title: "Draft Regenerated",
          description: "AI has generated a new reply based on your request.",
        })
      }
    } catch (error: any) {
      console.error("Error generating draft:", error)
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate draft. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSummarize = async () => {
    if (!email) return

    const settings = storage.getSettings()
    if (!settings.aiFeatures.autoSummarize) {
      toast({ title: "AI Summaries Disabled", description: "Enable AI summaries in Settings to use this feature." })
      return
    }
    if (email.aiSummary) {
      toast({ title: "Summary Cached", description: "This thread already has a summary." })
      return
    }

    try {
      toast({ title: "Generating Summary", description: "Please wait..." })
      const summary = await api.ai.summarizeThread([email]) // In real app, pass full thread

      // Update local state to show summary immediately
      setEmail(prev => prev ? { ...prev, aiSummary: summary } : null)
      storage.updateEmail(email.id, { aiSummary: summary })
      storage.incrementUsageStat('emailsSummarized', 1, 0.5)

      toast({ title: "Summary Generated", description: "Thread summary has been updated" })
    } catch (error) {
      console.error("Error summarizing:", error)
      toast({
        title: "Summarization Failed",
        description: "Failed to generate summary",
        variant: "destructive"
      })
    }
  }

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

  // Load smart reply suggestions
  const handleLoadSuggestions = async () => {
    if (!email) return

    const settings = storage.getSettings()
    if (!settings.aiFeatures.smartReplies) {
      toast({ title: "Smart Replies Disabled", description: "Enable Smart Replies in Settings to use this feature." })
      return
    }
    if (!settings.openaiApiKey) {
      toast({
        title: "API Key Required",
        description: "Please add your OpenAI API key in Settings to use AI features",
        variant: "destructive",
      })
      return
    }
    // Check cache first
    const cached = storage.getReplySuggestions(email.id)
    if (cached) {
      setReplySuggestions(cached.suggestions)
      toast({ title: "Loaded Cached Suggestions", description: "Using previously generated suggestions" })
      return
    }

    setIsLoadingSuggestions(true)
    try {
      const suggestions = await api.ai.suggestReplies(email, settings.userContext)
      setReplySuggestions(suggestions)

      // Cache the suggestions
      storage.saveReplySuggestions(email.id, {
        id: `suggestion_${email.id}`,
        emailId: email.id,
        suggestions,
        generatedAt: new Date().toISOString(),
        cached: true,
      })

      toast({ title: "Suggestions Ready", description: "AI generated 3 reply options" })
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate suggestions", variant: "destructive" })
    } finally {
      setIsLoadingSuggestions(false)
    }
  }

  // Extract tasks from email
  const handleExtractTasks = async () => {
    if (!email) return

    setIsExtractingTasks(true)
    try {
      const tasks = await api.ai.extractTasks(email)
      setExtractedTasks(tasks)

      // Save tasks to storage
      for (const task of tasks) {
        storage.addTask({
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: task.title,
          deadline: task.deadline,
          priority: task.priority,
          sourceEmailId: email.id,
          createdAt: new Date().toISOString(),
          completed: false,
        })
      }

      if (tasks.length > 0) {
        toast({ title: "Tasks Extracted", description: `Found ${tasks.length} action items` })
      } else {
        toast({ title: "No Tasks Found", description: "No action items detected in this email" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to extract tasks", variant: "destructive" })
    } finally {
      setIsExtractingTasks(false)
    }
  }

  // Archive email - removes the INBOX label in Gmail, then updates the cache.
  const handleArchive = async () => {
    if (!email) return
    try {
      await emailApi.modifyEmail(email.id, "archive")
      storage.incrementUsageStat('emailsArchived', 1, 0.5)
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

  if (!email && isLoadingEmail) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#E8DCC4]" />
          <p className="mt-2 text-sm text-[#8A8A8A]">Fetching email from Gmail...</p>
        </div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <p className="text-[#8A8A8A]">{loadError || "Email not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col bg-[#0A0A0B]">
      {/* Agent Banner */}
      <AgentBanner />

      {/* Thread Header */}
      <div className="border-b border-white/[0.04] px-6 py-4" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-medium text-[#FAFAF9]">{email.subject}</h1>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              onClick={handleSummarize}
              title="Summarize Thread"
              disabled={!summariesEnabled}
              className="text-[#8A8A8A] hover:text-[#E8DCC4] hover:bg-white/[0.03] border-0"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={handleLoadSuggestions} disabled={isLoadingSuggestions} title="Smart Reply Suggestions" className="text-[#8A8A8A] hover:text-[#E8DCC4] hover:bg-white/[0.03] border-0">
              {isLoadingSuggestions ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
            <Button size="icon" onClick={handleExtractTasks} disabled={isExtractingTasks} title="Extract Tasks" className="text-[#8A8A8A] hover:text-[#E8DCC4] hover:bg-white/[0.03] border-0">
              {isExtractingTasks ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTodo className="h-4 w-4" />}
            </Button>
            <Button size="icon" className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03] border-0">
              <Reply className="h-4 w-4" />
            </Button>
            <Button size="icon" className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03] border-0">
              <Forward className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={handleArchive} title="Archive" className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03] border-0">
              <Archive className="h-4 w-4" />
            </Button>
            <Button size="icon" onClick={handleTrash} title="Move to Trash" className="text-[#8A8A8A] hover:text-red-400 hover:bg-red-500/10 border-0">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button size="icon" className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03] border-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Thread Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-6">
          {/* Email Insights Row */}
          <div className="mb-6 grid gap-4 grid-cols-1 md:grid-cols-3">
            {/* Sentiment Card */}
            {email.sentiment && (
              <Card className="border border-white/[0.06] bg-white/[0.02] p-4 rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(10,10,11,0.95) 100%)', backdropFilter: 'blur(40px)' }}>
                <div className="mb-2 flex items-center gap-2">
                  {email.sentiment.sentiment === 'positive' && <Smile className="h-4 w-4 text-green-400" />}
                  {email.sentiment.sentiment === 'negative' && <Frown className="h-4 w-4 text-red-400" />}
                  {email.sentiment.sentiment === 'neutral' && <Meh className="h-4 w-4 text-[#8A8A8A]" />}
                  <span className="text-sm font-medium text-[#FAFAF9]">Sentiment</span>
                </div>
                <p className="text-sm capitalize text-[#FAFAF9]">{email.sentiment.sentiment}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-[#8A8A8A]">Urgency:</span>
                  <Badge className={cn("text-xs border-0", email.sentiment.urgency === 'critical' ? 'bg-red-500/20 text-red-400' : email.sentiment.urgency === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/[0.06] text-[#8A8A8A]')}>
                    {email.sentiment.urgency}
                  </Badge>
                </div>
              </Card>
            )}

            {/* Priority Card */}
            {email.priorityScore !== undefined && (
              <Card className="border border-white/[0.06] bg-white/[0.02] p-4 rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(10,10,11,0.95) 100%)', backdropFilter: 'blur(40px)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#E8DCC4]" />
                  <span className="text-sm font-medium text-[#FAFAF9]">Priority Score</span>
                </div>
                <p className="text-2xl font-bold text-[#E8DCC4]">{email.priorityScore}</p>
                <p className="text-xs text-[#8A8A8A]">
                  {email.priorityScore >= 70 ? 'High priority' : email.priorityScore >= 40 ? 'Medium priority' : 'Low priority'}
                </p>
              </Card>
            )}

            {/* Meeting Detection Card */}
            {email.meetingRequest?.detected && (
              <Card className="border border-white/[0.06] bg-white/[0.02] p-4 rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(10,10,11,0.95) 100%)', backdropFilter: 'blur(40px)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#C4A052]" />
                  <span className="text-sm font-medium text-[#FAFAF9]">Meeting Request</span>
                </div>
                <p className="text-sm text-[#FAFAF9]">{email.meetingRequest.subject || 'Meeting detected'}</p>
                {email.meetingRequest.proposedTimes && email.meetingRequest.proposedTimes.length > 0 && (
                  <p className="text-xs text-[#8A8A8A] mt-1">
                    Times: {email.meetingRequest.proposedTimes.slice(0, 2).join(', ')}
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* AI Summary Card */}
          {email.aiSummary && (
            <Card className="mb-6 border border-[#E8DCC4]/20 bg-[#E8DCC4]/[0.03] p-4 rounded-2xl" style={{ backdropFilter: 'blur(40px)' }}>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#E8DCC4]" />
                <span className="text-sm font-medium text-[#FAFAF9]">AI Summary</span>
              </div>
              <p className="text-sm leading-relaxed text-[#FAFAF9]/90">{email.aiSummary}</p>
            </Card>
          )}

          {/* Reply Suggestions */}
          {replySuggestions.length > 0 && (
            <Card className="mb-6 border border-white/[0.06] bg-white/[0.02] p-4 rounded-2xl" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(10,10,11,0.95) 100%)', backdropFilter: 'blur(40px)' }}>
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#E8DCC4]" />
                <span className="text-sm font-medium text-[#FAFAF9]">Smart Reply Suggestions</span>
              </div>
              <div className="space-y-2">
                {replySuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-colors"
                    onClick={() => setDraftContent(suggestion.content)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="text-xs capitalize bg-[#E8DCC4]/20 text-[#E8DCC4] border-0">{suggestion.type}</Badge>
                      <span className="text-xs text-[#8A8A8A] capitalize">{suggestion.tone} tone</span>
                    </div>
                    <p className="text-sm text-[#FAFAF9]">{suggestion.content}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#5A5A5A] mt-2">Click a suggestion to use it as your reply</p>
            </Card>
          )}

          {/* Extracted Tasks */}
          {extractedTasks.length > 0 && (
            <Card className="mb-6 border border-[#FEBC2E]/20 bg-[#FEBC2E]/[0.03] p-4 rounded-2xl" style={{ backdropFilter: 'blur(40px)' }}>
              <div className="mb-3 flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-[#FEBC2E]" />
                <span className="text-sm font-medium text-[#FAFAF9]">Extracted Tasks</span>
              </div>
              <div className="space-y-2">
                {extractedTasks.map((task, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <Badge
                      className={cn(
                        "text-xs border-0",
                        task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                          task.priority === 'medium' ? 'bg-[#FEBC2E]/20 text-[#FEBC2E]' :
                            'bg-white/[0.06] text-[#8A8A8A]'
                      )}
                    >
                      {task.priority}
                    </Badge>
                    <span className="text-sm flex-1 text-[#FAFAF9]">{task.title}</span>
                    {task.deadline && (
                      <span className="text-xs text-[#8A8A8A]">Due: {task.deadline}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#5A5A5A] mt-2">Tasks have been saved to your task list</p>
            </Card>
          )}

          {/* Email Message */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(10,10,11,0.95) 100%)', backdropFilter: 'blur(40px)' }}>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-white/[0.08]">
                    <AvatarImage src={email.from.avatar} alt={email.from.name} />
                    <AvatarFallback className="bg-gradient-to-br from-[#E8DCC4] to-[#C4A052] text-[#0A0A0B]">
                      {email.from.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium text-[#FAFAF9]">{email.from.name}</div>
                    <div className="text-xs text-[#8A8A8A]">{email.from.email}</div>
                  </div>
                </div>
                <span className="text-xs text-[#5A5A5A]">{formatTimestamp(email.date)}</span>
              </div>

              {/* Email Body - fetched live from Gmail */}
              {isLoadingEmail && !email.body ? (
                <div className="flex items-center gap-2 py-6 text-sm text-[#8A8A8A]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#E8DCC4]" />
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
                    <p className="text-sm text-[#8A8A8A] italic py-4">
                      This email has no body content.
                    </p>
                  );
                }

                if (isHtml) {
                  return (
                    <div className="email-content-wrapper">
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
                          color: inherit;
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
                        
                        /* Tables - minimal styling, no borders by default */
                        .email-html-content table {
                          border-collapse: collapse;
                          border: none !important;
                          background: transparent !important;
                        }
                        .email-html-content td,
                        .email-html-content th {
                          padding: 4px 8px;
                          border: none !important;
                          background: transparent !important;
                          vertical-align: top;
                        }
                        .email-html-content tr {
                          border: none !important;
                          background: transparent !important;
                        }
                        .email-html-content tbody,
                        .email-html-content thead,
                        .email-html-content tfoot {
                          border: none !important;
                          background: transparent !important;
                        }
                        
                        /* Remove all borders from divs/spans */
                        .email-html-content div,
                        .email-html-content span,
                        .email-html-content center {
                          border: none !important;
                          outline: none !important;
                          box-shadow: none !important;
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
                        .email-html-content div:empty,
                        .email-html-content span:empty,
                        .email-html-content p:empty,
                        .email-html-content td:empty,
                        .email-html-content tr:empty,
                        .email-html-content table:empty {
                          display: none !important;
                        }
                        
                        /* Force remove any inline borders/outlines */
                        .email-html-content * {
                          border-color: transparent !important;
                          outline: none !important;
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
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {html}
                    </div>
                  );
                }
              })()}

              {/* Attachments */}
              {email.attachments && email.attachments.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-4">
                    <Paperclip className="h-4 w-4 text-[#8A8A8A]" />
                    <span className="text-sm font-medium text-[#FAFAF9]">
                      {email.attachments.length} {email.attachments.length === 1 ? 'Attachment' : 'Attachments'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {email.attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="group relative flex items-start gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <Paperclip className="h-5 w-5 text-[#E8DCC4]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#FAFAF9] truncate pr-6">
                            {attachment.filename || 'Untitled'}
                          </div>
                          {attachment.size && (
                            <div className="text-xs text-[#8A8A8A]">
                              {formatFileSize(attachment.size)}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-[#8A8A8A] hover:text-[#E8DCC4] hover:bg-white/[0.03]"
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
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#E8DCC4]" />
                <span className="text-sm font-medium text-[#FAFAF9]">
                  {isGenerating ? "Generating Your Reply..." : "AI-Powered Draft"}
                </span>
              </div>
              <Button
                size="sm"
                onClick={() => handleGenerateDraft("Regenerate a professional reply")}
                disabled={isGenerating}
                className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-3 w-3" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>

            {isGenerating && !draftContent && (
              <Card className="mb-3 border border-[#E8DCC4]/20 bg-[#E8DCC4]/[0.03] p-4 rounded-2xl" style={{ backdropFilter: 'blur(40px)' }}>
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-[#E8DCC4]" />
                  <div>
                    <p className="text-sm font-medium text-[#FAFAF9]">Preparing your AI-generated reply...</p>
                    <p className="text-xs text-[#8A8A8A]">
                      GPT is analyzing the email and composing a professional response
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!isGenerating && draftContent && (
              <div className="mb-3 flex items-center gap-2 text-sm text-[#8A8A8A]">
                <Sparkles className="h-3.5 w-3.5 text-[#E8DCC4]" />
                <span>AI draft ready - Review, edit, and send when ready</span>
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              <Badge
                className={cn(
                  "cursor-pointer bg-white/[0.03] border border-white/[0.08] text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Write a professional thank you reply")}
              >
                Draft a "thank you" reply
              </Badge>
              <Badge
                className={cn(
                  "cursor-pointer bg-white/[0.03] border border-white/[0.08] text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Ask about next steps")}
              >
                Ask for next steps
              </Badge>
              <Badge
                className={cn(
                  "cursor-pointer bg-white/[0.03] border border-white/[0.08] text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Request to schedule a meeting")}
              >
                Schedule a meeting
              </Badge>
              <Badge
                className={cn(
                  "cursor-pointer bg-white/[0.03] border border-white/[0.08] text-[#8A8A8A] hover:text-[#E8DCC4] hover:border-[#E8DCC4]/40",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Ask for more details")}
              >
                Request more details
              </Badge>
            </div>
            <Textarea
              placeholder={
                isGenerating
                  ? "Generating your AI-powered reply..."
                  : draftContent
                    ? "Review and edit your AI-generated draft..."
                    : "AI draft will appear here, or type your own reply..."
              }
              className="min-h-32 resize-none bg-white/[0.03] border-white/[0.08] text-[#FAFAF9] placeholder:text-[#5A5A5A] rounded-xl focus:border-[#E8DCC4]/30 focus:ring-1 focus:ring-[#E8DCC4]/20"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              disabled={isGenerating}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                onClick={handleSaveDraft}
                disabled={!draftContent.trim() || isGenerating || isSendingReply}
                className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-xl"
              >
                Save Draft
              </Button>
              <Button
                onClick={handleSendReply}
                disabled={!draftContent.trim() || isGenerating || isSendingReply}
                className="bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl"
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
