"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, SendHorizontal } from "lucide-react"
import { emailApi } from "@/lib/email-api"
import type { Email } from "@/types"

function formatTimestamp(date: string): string {
  const emailDate = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - emailDate.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return emailDate.toLocaleDateString()
}

export function SentList() {
  const [emails, setEmails] = useState<Email[]>([])
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const loadSent = async () => {
    try {
      const { emails: loaded } = await emailApi.listEmails("sent", { limit: 100 })
      setEmails(loaded)
    } catch (error) {
      console.error("[Sent] Failed to load:", error)
    }
  }

  useEffect(() => {
    const init = async () => {
      await loadSent()
      setIsLoading(false)
    }
    void init()

    const onUpdate = () => void loadSent()
    window.addEventListener("relay-emails-updated", onUpdate)
    return () => window.removeEventListener("relay-emails-updated", onUpdate)
  }, [])

  const sortedEmails = useMemo(
    () => [...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [emails]
  )

  const handleSync = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      await emailApi.sync("sent")
      await loadSent()
    } catch (error) {
      console.error("[Sent] Sync failed:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-[#0A0A0B]">
      <div className="border-b border-white/[0.04] px-6 py-5 flex items-center justify-between" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
        <div>
          <h1 className="text-2xl font-light tracking-tight text-[#FAFAF9]">Sent</h1>
          <p className="text-sm text-[#8A8A8A]">Emails you have sent</p>
        </div>
        <Button
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-xl"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-3 w-3" />
              Sync
            </>
          )}
        </Button>
      </div>
      {isLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-[#E8DCC4]" />
        </div>
      ) : sortedEmails.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
            <SendHorizontal className="h-8 w-8 text-[#E8DCC4]" />
          </div>
          <h3 className="text-xl font-light text-[#FAFAF9]">No sent emails</h3>
          <p className="mt-2 text-sm text-[#8A8A8A]">Emails you send will appear here</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {sortedEmails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}`}
              className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-white/[0.02]"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={email.from.avatar} alt={email.from.name} />
                <AvatarFallback className="bg-white/[0.06] text-[#FAFAF9]">
                  {email.from.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-[#FAFAF9]">
                    To: {email.to.map((t) => t.email).join(", ")}
                  </span>
                  <Badge className="h-5 px-2 text-[10px] bg-[#28C840]/10 text-[#28C840] border-0">
                    <SendHorizontal className="mr-1 h-3 w-3" />
                    Sent
                  </Badge>
                </div>
                <div className="mb-1 text-sm font-normal text-[#FAFAF9]">{email.subject}</div>
                <p className="line-clamp-1 text-sm text-[#8A8A8A]">
                  {(email.snippet || email.bodyPlain || "").replace(/<[^>]*>/g, "").slice(0, 120)}
                </p>
              </div>
              <div className="shrink-0 text-xs text-[#5A5A5A]">{formatTimestamp(email.date)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
