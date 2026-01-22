"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, SendHorizontal } from "lucide-react"
import { storage } from "@/lib/storage"
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

  const refreshSent = () => {
    setEmails(storage.getSentEmails())
  }

  useEffect(() => {
    refreshSent()
    const onStorage = () => refreshSent()
    window.addEventListener("relay-storage-updated", onStorage)
    return () => window.removeEventListener("relay-storage-updated", onStorage)
  }, [])

  const sortedEmails = useMemo(
    () => [...emails].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [emails]
  )

  const handleSync = async () => {
    if (isSyncing) return
    const accounts = storage.getAccounts().filter((a) => a.provider === "gmail")
    if (accounts.length === 0) return

    setIsSyncing(true)
    try {
      for (const account of accounts) {
        const response = await fetch("/api/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: account.accessToken,
            refreshToken: account.refreshToken,
            expiryDate: account.expiryDate,
            maxResults: 50,
            mailbox: "sent",
          }),
        })

        if (!response.ok) continue
        const result = await response.json()
        if (result.auth?.accessToken || result.auth?.expiryDate) {
          const updates: { accessToken?: string; expiryDate?: number } = {}
          if (result.auth.accessToken) updates.accessToken = result.auth.accessToken
          if (result.auth.expiryDate) updates.expiryDate = result.auth.expiryDate
          storage.updateAccount(account.id, updates)
        }
        if (Array.isArray(result.emails) && result.emails.length > 0) {
          storage.addEmails(result.emails)
        }
      }
      refreshSent()
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
      {sortedEmails.length === 0 ? (
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
                  {(email.bodyPlain || email.body || "").replace(/<[^>]*>/g, "").slice(0, 120)}
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
