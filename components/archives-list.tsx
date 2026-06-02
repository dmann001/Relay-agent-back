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
    <div className="flex-1 overflow-auto bg-[#0A0A0B]">
      <div className="border-b border-white/[0.04] px-6 py-5" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
        <h1 className="text-2xl font-light tracking-tight text-[#FAFAF9]">Archives</h1>
        <p className="text-sm text-[#8A8A8A]">Emails you've archived for reference</p>
      </div>
      {sortedEmails.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
            <Archive className="h-8 w-8 text-[#E8DCC4]" />
          </div>
          <h3 className="text-xl font-light text-[#FAFAF9]">No archived emails</h3>
          <p className="mt-2 text-sm text-[#8A8A8A]">Emails you archive will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {sortedEmails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}`}
              className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]"
            >
              <Checkbox className="mt-1 border-white/[0.15] data-[state=checked]:bg-[#E8DCC4] data-[state=checked]:text-[#0A0A0B]" />
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={email.from.avatar || "/placeholder.svg"} alt={email.from.name} />
                <AvatarFallback className="bg-white/[0.06] text-[#FAFAF9]">
                  {email.from.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-[#FAFAF9]">{email.from.name}</span>
                  <Badge variant="outline" className="h-5 px-1.5 border-white/[0.08] bg-transparent">
                    <ProviderIcon className="h-3 w-3" />
                  </Badge>
                  <Badge className="h-5 px-2 text-[10px] bg-[#E8DCC4]/10 text-[#E8DCC4] border-0">
                    <Archive className="mr-1 h-3 w-3" />
                    Archived
                  </Badge>
                </div>
                <div className="mb-1 text-sm font-normal text-[#FAFAF9]">{email.subject}</div>
                <p className="line-clamp-1 text-sm text-[#8A8A8A]">
                  {(email.bodyPlain || email.body || "")
                    .replace(/<[^>]*>/g, "")
                    .replace(/\s+/g, " ")
                    .trim()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-[#5A5A5A]">{formatTimestamp(email.date)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
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
