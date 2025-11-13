"use client"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/provider-icon"

const drafts = [
  {
    id: "d1",
    recipient: "team@acme.com",
    subject: "Weekly Status Update",
    preview: "Hi team, Here's the weekly update for the design system project...",
    lastEdited: "10m ago",
    provider: "gmail" as const,
  },
  {
    id: "d2",
    recipient: "john@client.com",
    subject: "Re: Project Timeline Discussion",
    preview: "Thanks for your patience. I wanted to follow up on the timeline we discussed...",
    lastEdited: "2h ago",
    provider: "outlook" as const,
  },
  {
    id: "d3",
    recipient: "sarah@startup.co",
    subject: "Design Feedback",
    preview: "I reviewed the latest mockups and have some thoughts...",
    lastEdited: "1d ago",
    provider: "gmail" as const,
  },
]

export function DraftsList() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold">Drafts</h1>
        <p className="text-sm text-muted-foreground">Unfinished emails saved for later</p>
      </div>
      <div className="divide-y divide-border">
        {drafts.map((draft) => (
          <div key={draft.id} className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/50">
            <Checkbox className="mt-1" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium">To: {draft.recipient}</span>
                <Badge variant="outline" className="h-5 px-1.5">
                  <ProviderIcon provider={draft.provider} className="h-3 w-3" />
                </Badge>
                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                  <Clock className="mr-1 h-3 w-3" />
                  Draft
                </Badge>
              </div>
              <div className="mb-1 text-sm font-medium">{draft.subject}</div>
              <p className="line-clamp-1 text-sm text-muted-foreground">{draft.preview}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-muted-foreground">{draft.lastEdited}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
