"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Mail, Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { emailApi } from "@/lib/email-api"
import type { Email } from "@/types"
import { cn } from "@/lib/utils"

interface AiChatEmailPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  accountId?: string
  excludeMessageIds?: string[]
  onSelect: (email: Email) => void
}

export function AiChatEmailPickerDialog({
  open,
  onOpenChange,
  accountId,
  excludeMessageIds = [],
  onSelect,
}: AiChatEmailPickerDialogProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const excluded = useMemo(() => new Set(excludeMessageIds), [excludeMessageIds])

  const loadEmails = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [inbox, archive] = await Promise.all([
        emailApi.listEmails("inbox", { limit: 40, accountId }),
        emailApi.listEmails("archive", { limit: 40, accountId }),
      ])
      const merged = [...inbox.emails, ...archive.emails]
      const seen = new Set<string>()
      const unique = merged.filter((email) => {
        const key = `${email.accountId || "default"}:${email.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setEmails(unique)
    } catch (loadError: any) {
      setError(loadError.message || "Could not load emails.")
      setEmails([])
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    if (!open) return
    void loadEmails()
  }, [loadEmails, open])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return emails
      .filter((email) => !excluded.has(email.id))
      .filter((email) => {
        if (!needle) return true
        return [
          email.subject,
          email.from.name,
          email.from.email,
          email.snippet,
        ].join(" ").toLowerCase().includes(needle)
      })
      .slice(0, 30)
  }, [emails, excluded, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add email context</DialogTitle>
          <DialogDescription>
            Attach another email so Relay can read it alongside your question. You can also right-click any email and choose Add to chat.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search subject, sender, or snippet..."
            className="pl-9"
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading emails...
            </div>
          ) : error ? (
            <p className="px-4 py-6 text-sm text-destructive">{error}</p>
          ) : filtered.length ? filtered.map((email) => (
            <button
              key={`${email.accountId || "default"}:${email.id}`}
              type="button"
              className={cn(
                "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-surface-hover",
              )}
              onClick={() => {
                onSelect(email)
                onOpenChange(false)
                setQuery("")
              }}
            >
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">
                  {email.subject || "(No subject)"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {email.from.name || email.from.email}
                </span>
                <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {email.snippet}
                </span>
              </span>
            </button>
          )) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">No matching emails found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
