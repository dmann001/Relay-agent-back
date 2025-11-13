"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { AiLabelBadge } from "@/components/ai-label-badge"
import { ProviderIcon } from "@/components/provider-icon"

// Mock data
const emails = [
  {
    id: "1",
    sender: "Sarah Chen",
    senderEmail: "sarah@acme.com",
    subject: "Q4 Product Roadmap Review",
    preview:
      "Hi team, I wanted to share the updated roadmap for Q4. Please review the attached document and provide feedback by EOD Friday...",
    timestamp: "2m ago",
    unread: true,
    hasAiSummary: true,
    provider: "gmail" as const,
    avatar: "/diverse-woman-portrait.png",
    aiLabels: ["urgent" as const, "action" as const],
  },
  {
    id: "2",
    sender: "Marcus Johnson",
    senderEmail: "marcus@techcorp.io",
    subject: "Re: API Integration Questions",
    preview:
      "Thanks for reaching out. The authentication flow you mentioned should work fine. Here are some additional considerations...",
    timestamp: "15m ago",
    unread: true,
    hasAiSummary: false,
    provider: "outlook" as const,
    avatar: "/man.jpg",
    aiLabels: ["followup" as const],
  },
  {
    id: "3",
    sender: "Emily Rodriguez",
    senderEmail: "emily@startup.co",
    subject: "Meeting Notes - Design System Discussion",
    preview:
      "Great meeting today! Here are the key takeaways: 1. We will adopt the new component library 2. Migration timeline is 6 weeks...",
    timestamp: "1h ago",
    unread: false,
    hasAiSummary: true,
    provider: "gmail" as const,
    avatar: "/professional-woman.png",
    aiLabels: ["meeting" as const, "important" as const],
  },
  {
    id: "4",
    sender: "David Park",
    senderEmail: "david@enterprise.com",
    subject: "Budget Approval Request",
    preview:
      "I am submitting the budget request for the new infrastructure project. The total estimated cost is $45,000 for the next quarter...",
    timestamp: "3h ago",
    unread: false,
    hasAiSummary: false,
    provider: "outlook" as const,
    avatar: "/man-business.jpg",
    aiLabels: ["financial" as const, "action" as const],
  },
  {
    id: "5",
    sender: "Lisa Thompson",
    senderEmail: "lisa@agency.design",
    subject: "Client Feedback on Latest Mockups",
    preview:
      "The client loved the direction we are taking! They had a few minor notes about the color palette and want to see one more iteration...",
    timestamp: "5h ago",
    unread: false,
    hasAiSummary: true,
    provider: "gmail" as const,
    avatar: "/woman-designer.jpg",
    aiLabels: ["followup" as const],
  },
]

export function InboxList() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="divide-y divide-border">
        {emails.map((email) => (
          <Link
            key={email.id}
            href={`/thread/${email.id}`}
            className={cn(
              "flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/50",
              email.unread && "bg-muted/30",
            )}
          >
            <Checkbox className="mt-1" />
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage src={email.avatar || "/placeholder.svg"} alt={email.sender} />
              <AvatarFallback>
                {email.sender
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn("text-sm", email.unread && "font-semibold")}>{email.sender}</span>
                <Badge variant="outline" className="h-5 px-1.5">
                  <ProviderIcon provider={email.provider} className="h-3 w-3" />
                </Badge>
                {email.hasAiSummary && <Sparkles className="h-3.5 w-3.5 text-primary" />}
              </div>
              <div className={cn("mb-1 text-sm", email.unread ? "font-semibold" : "font-normal")}>{email.subject}</div>
              <p className="line-clamp-1 text-sm text-muted-foreground">{email.preview}</p>
              {email.aiLabels && email.aiLabels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {email.aiLabels.map((label) => (
                    <AiLabelBadge key={label} label={label} />
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">{email.timestamp}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
