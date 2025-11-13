"use client"

import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Archive } from "lucide-react"
import { ProviderIcon } from "@/components/provider-icon"

const archives = [
  {
    id: "a1",
    sender: "Newsletter Team",
    senderEmail: "news@techweekly.com",
    subject: "This Week in Tech - AI Breakthroughs",
    preview: "Discover the latest developments in artificial intelligence and machine learning...",
    timestamp: "2 weeks ago",
    provider: "gmail" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "a2",
    sender: "HR Department",
    senderEmail: "hr@company.com",
    subject: "Q3 Benefits Enrollment Reminder",
    preview: "This is a reminder that Q3 benefits enrollment closes on September 30th...",
    timestamp: "3 weeks ago",
    provider: "outlook" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "a3",
    sender: "Project Manager",
    senderEmail: "pm@agency.com",
    subject: "Project Kickoff Meeting Notes",
    preview: "Thank you all for attending the kickoff meeting. Here are the key points discussed...",
    timestamp: "1 month ago",
    provider: "gmail" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  },
]

export function ArchivesList() {
  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold">Archives</h1>
        <p className="text-sm text-muted-foreground">Emails you've archived for reference</p>
      </div>
      <div className="divide-y divide-border">
        {archives.map((email) => (
          <Link
            key={email.id}
            href={`/thread/${email.id}`}
            className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
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
                <span className="text-sm font-medium">{email.sender}</span>
                <Badge variant="outline" className="h-5 px-1.5">
                  <ProviderIcon provider={email.provider} className="h-3 w-3" />
                </Badge>
                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                  <Archive className="mr-1 h-3 w-3" />
                  Archived
                </Badge>
              </div>
              <div className="mb-1 text-sm font-normal">{email.subject}</div>
              <p className="line-clamp-1 text-sm text-muted-foreground">{email.preview}</p>
            </div>
            <div className="shrink-0 text-xs text-muted-foreground">{email.timestamp}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
