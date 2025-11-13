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
  const { toast } = useToast()

  useEffect(() => {
    const emails = storage.getEmails()
    const foundEmail = emails.find((e) => e.id === threadId)
    if (foundEmail) {
      setEmail(foundEmail)
    }
  }, [threadId])

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
      toast({
        title: "Draft Generated",
        description: "AI has generated a reply for you. Review and edit as needed.",
      })
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
                <span className="text-sm font-semibold">AI-Powered Draft Assistance</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerateDraft()}
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
                    Generate Draft
                  </>
                )}
              </Button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => handleGenerateDraft("Write a professional thank you reply")}
              >
                Draft a "thank you" reply
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => handleGenerateDraft("Ask about next steps")}
              >
                Ask for next steps
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => handleGenerateDraft("Request to schedule a meeting")}
              >
                Schedule a meeting
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => handleGenerateDraft("Ask for more details")}
              >
                Request more details
              </Badge>
            </div>
            <Textarea
              placeholder="Click 'Generate Draft' or type your reply..."
              className="min-h-32 resize-none"
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={!draftContent.trim()}>
                Save Draft
              </Button>
              <Button disabled={!draftContent.trim()}>Send Reply</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
