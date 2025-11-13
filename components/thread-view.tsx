"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { AgentBanner } from "@/components/agent-banner"
import { Sparkles, Reply, Forward, Archive, Trash2, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock thread data
const thread = {
  id: "1",
  subject: "Q4 Product Roadmap Review",
  messages: [
    {
      id: "m1",
      sender: "Sarah Chen",
      senderEmail: "sarah@acme.com",
      timestamp: "2 hours ago",
      content: `Hi team,

I wanted to share the updated roadmap for Q4. Please review the attached document and provide feedback by EOD Friday.

Key highlights:
• New dashboard redesign launching in October
• Mobile app beta testing begins in November
• API v3 release scheduled for December

Looking forward to your thoughts!

Best,
Sarah`,
      avatar: "/diverse-woman-portrait.png",
    },
    {
      id: "m2",
      sender: "You",
      senderEmail: "you@company.com",
      timestamp: "1 hour ago",
      content: `Thanks Sarah! This looks great. I have a few questions about the mobile app timeline. Can we schedule a quick call to discuss?`,
      avatar: "/abstract-geometric-shapes.png",
    },
  ],
}

const aiSummary = `This thread discusses the Q4 product roadmap. Sarah Chen shared key deliverables including a dashboard redesign (October), mobile app beta (November), and API v3 release (December). You responded with questions about the mobile app timeline and requested a call.`

const suggestedActions = [
  'Draft a "thank you" reply',
  "Ask for next steps",
  "Schedule a meeting",
  "Request more details",
]

export function ThreadView({ threadId }: { threadId: string }) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Agent Banner */}
      <AgentBanner />

      {/* Thread Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">{thread.subject}</h1>
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
          <Card className="mb-6 border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">AI Summary</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{aiSummary}</p>
          </Card>

          {/* Messages */}
          <div className="space-y-6">
            {thread.messages.map((message, index) => (
              <div
                key={message.id}
                className={cn("rounded-lg border border-border p-4", index % 2 === 0 ? "bg-card" : "bg-muted/30")}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={message.avatar || "/placeholder.svg"} alt={message.sender} />
                      <AvatarFallback>
                        {message.sender
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold">{message.sender}</div>
                      <div className="text-xs text-muted-foreground">{message.senderEmail}</div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
              </div>
            ))}
          </div>

          {/* Reply Section */}
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">AI-Powered Draft Assistance</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestedActions.map((action) => (
                <Badge key={action} variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                  {action}
                </Badge>
              ))}
            </div>
            <Textarea placeholder="Type your reply..." className="min-h-32 resize-none" />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="outline">Save Draft</Button>
              <Button>Send Reply</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
