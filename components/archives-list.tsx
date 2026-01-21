"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Archive, Undo2 } from "lucide-react"
import { ProviderIcon } from "@/components/provider-icon"
import { storage } from "@/lib/storage"
import type { Email } from "@/types"

function formatTimestamp(date: string): string {
  const emailDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - emailDate.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffDays < 1) return "Today"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  return emailDate.toLocaleDateString()
}

export function ArchivesList() {
  const [emails, setEmails] = useState<Email[]>([])

  useEffect(() => {
    const refreshEmails = () => setEmails(storage.getArchivedEmails())
    refreshEmails()
    window.addEventListener("relay-storage-updated", refreshEmails)
    return () => window.removeEventListener("relay-storage-updated", refreshEmails)
  }, [])

  const sortedEmails = useMemo(
    () => [...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [emails]
  )

  const handleUnarchive = (emailId: string) => {
    storage.unarchiveEmail(emailId)
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-2xl font-semibold">Archives</h1>
        <p className="text-sm text-muted-foreground">Emails you've archived for reference</p>
      </div>
      {sortedEmails.length === 0 ? (
        <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
          No archived emails.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sortedEmails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}`}
              className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-muted/50"
            >
              <Checkbox className="mt-1" />
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={email.from.avatar || "/placeholder.svg"} alt={email.from.name} />
                <AvatarFallback>
                  {email.from.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium">{email.from.name}</span>
                  <Badge variant="outline" className="h-5 px-1.5">
                    <ProviderIcon provider={email.provider} className="h-3 w-3" />
                  </Badge>
                  <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                    <Archive className="mr-1 h-3 w-3" />
                    Archived
                  </Badge>
                </div>
                <div className="mb-1 text-sm font-normal">{email.subject}</div>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {(email.bodyPlain || email.body || "")
                    .replace(/<[^>]*>/g, "")
                    .replace(/\s+/g, " ")
                    .trim()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatTimestamp(email.date)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    handleUnarchive(email.id)
                  }}
                  title="Unarchive"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
