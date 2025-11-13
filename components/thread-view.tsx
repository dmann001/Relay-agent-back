"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AgentBanner } from "@/components/agent-banner"
import { Sparkles, Reply, Forward, Archive, Trash2, MoreHorizontal, Loader2, Wand2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { storage } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"
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
  const [draftContent, setDraftContent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [autoGenerateAttempted, setAutoGenerateAttempted] = useState(false)
  const { toast } = useToast()

  // Load email from storage
  useEffect(() => {
    const emails = storage.getEmails()
    const foundEmail = emails.find((e) => e.id === threadId)
    if (foundEmail) {
      setEmail(foundEmail)
    }
  }, [threadId])

  // Auto-generate draft when email loads
  useEffect(() => {
    if (email && !autoGenerateAttempted && !draftContent) {
      const settings = storage.getSettings()

      // Only auto-generate if API key exists and smart replies are enabled
      if (settings.openaiApiKey && settings.aiFeatures.smartReplies) {
        setAutoGenerateAttempted(true)
        handleGenerateDraft()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, autoGenerateAttempted, draftContent])

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

    setIsGenerating(true)
    try {
      const response = await fetch("/api/ai/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.openaiApiKey,
          email,
          instructions: instruction,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate draft")
      }

      const data = await response.json()
      setDraftContent(data.draft)

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

  const handleSaveDraft = () => {
    if (!email || !draftContent.trim()) return

    const draft = {
      id: `draft_${Date.now()}`,
      to: [email.from.email],
      subject: `Re: ${email.subject}`,
      body: draftContent,
      inReplyTo: email.id,
      threadId: email.threadId,
      provider: email.provider,
      lastEdited: new Date().toISOString(),
      aiGenerated: true,
    }

    storage.addDraft(draft as any)
    toast({
      title: "Draft Saved",
      description: "Your draft has been saved successfully",
    })
  }

  if (!email) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Email not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Agent Banner */}
      <AgentBanner />

      {/* Thread Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{email.subject}</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon">
              <Reply className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Forward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Archive className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Thread Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-6">
          {/* AI Summary Card */}
          {email.aiSummary && (
            <Card className="mb-6 border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">AI Summary</span>
              </div>
              <p className="text-sm leading-relaxed text-foreground/90">{email.aiSummary}</p>
            </Card>
          )}

          {/* Email Message */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border p-4 bg-card">
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={email.from.avatar} alt={email.from.name} />
                    <AvatarFallback>
                      {email.from.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">{email.from.name}</div>
                    <div className="text-xs text-muted-foreground">{email.from.email}</div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{formatTimestamp(email.date)}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{email.bodyPlain || email.body}</div>
            </div>
          </div>

          {/* Reply Section */}
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {isGenerating ? "Generating Your Reply..." : "AI-Powered Draft"}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerateDraft("Regenerate a professional reply")}
                disabled={isGenerating}
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
              <Card className="mb-3 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium">Preparing your AI-generated reply...</p>
                    <p className="text-xs text-muted-foreground">
                      GPT is analyzing the email and composing a professional response
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {!isGenerating && draftContent && (
              <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>AI draft ready - Review, edit, and send when ready</span>
              </div>
            )}

            <div className="mb-3 flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer hover:bg-secondary/80",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Write a professional thank you reply")}
              >
                Draft a "thank you" reply
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer hover:bg-secondary/80",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Ask about next steps")}
              >
                Ask for next steps
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer hover:bg-secondary/80",
                  isGenerating && "opacity-50 cursor-not-allowed pointer-events-none"
                )}
                onClick={() => !isGenerating && handleGenerateDraft("Request to schedule a meeting")}
              >
                Schedule a meeting
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "cursor-pointer hover:bg-secondary/80",
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
              className="min-h-32 resize-none"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              disabled={isGenerating}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={!draftContent.trim() || isGenerating}>
                Save Draft
              </Button>
              <Button disabled={!draftContent.trim() || isGenerating}>Send Reply</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
