"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Sparkles, RefreshCw, Mail, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { AiLabelBadge } from "@/components/ai-label-badge"
import { ProviderIcon } from "@/components/provider-icon"
import { storage } from "@/lib/storage"
import { useToast } from "@/hooks/use-toast"
import type { Email } from "@/types"
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from "@/components/ui/pagination"

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

export function InboxList() {
  const [emails, setEmails] = useState<Email[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [pageTokens, setPageTokens] = useState<(string | undefined)[]>([undefined])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined)
  const { toast } = useToast()

  // Load emails from localStorage on mount
  useEffect(() => {
    setIsLoading(true)
    const loadedEmails = storage.getEmails()
    setEmails(loadedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    setIsLoading(false)
  }, [])

  const handleSyncEmails = async (pageToken?: string) => {
    setIsSyncing(true)
    const accounts = storage.getAccounts()
    const settings = storage.getSettings()

    if (accounts.length === 0) {
      toast({
        title: "No Accounts Connected",
        description: "Please connect a Gmail account in Settings first",
        variant: "destructive",
      })
      setIsSyncing(false)
      return
    }

    try {
      for (const account of accounts) {
        if (account.provider === "gmail" && account.accessToken) {
          // Fetch emails
          const response = await fetch("/api/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: account.accessToken,
              maxResults: 20,
              pageToken,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()

            // Handle specific error cases
            if (errorData.code === "GMAIL_API_DISABLED") {
              throw new Error(
                "Gmail API is not enabled. Please enable it in Google Cloud Console and try again."
              )
            }

            if (errorData.code === "AUTH_EXPIRED") {
              throw new Error(
                "Your Gmail authentication has expired. Please reconnect your account in Settings."
              )
            }

            throw new Error(errorData.message || errorData.error || "Failed to fetch emails")
          }

          const data = await response.json()
          let fetchedEmails: Email[] = data.emails || []
          const newNextPageToken = data.nextPageToken

          // Enrich emails with AI if enabled and API key is available
          if (settings.aiFeatures.autoSummarize && settings.openaiApiKey) {
            fetchedEmails = await Promise.all(
              fetchedEmails.map(async (email) => {
                try {
                  const enrichResponse = await fetch("/api/ai/enrich-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      apiKey: settings.openaiApiKey,
                      email,
                    }),
                  })

                  if (enrichResponse.ok) {
                    const enrichData = await enrichResponse.json()
                    return {
                      ...email,
                      aiSummary: enrichData.summary,
                      aiLabels: enrichData.labels,
                    }
                  }
                } catch (error) {
                  console.error("Error enriching email:", error)
                }
                return email
              })
            )
          }

          // Store next page token
          setNextPageToken(newNextPageToken)

          // Don't add to storage when paginating - just display
          if (!pageToken) {
            storage.addEmails(fetchedEmails)
          }

          // Sort and set emails
          setEmails(fetchedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
        }
      }

      toast({
        title: "Inbox Synced",
        description: `Successfully synced emails from your connected accounts`,
      })
    } catch (error: any) {
      console.error("Error syncing emails:", error)

      // Show specific error message
      const errorMessage = error.message || "Failed to sync emails. Please try again."

      toast({
        title: "Sync Failed",
        description: errorMessage,
        variant: "destructive",
        action: errorMessage.includes("Gmail API") ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://console.developers.google.com/apis/api/gmail.googleapis.com/overview", "_blank")}
          >
            Enable API
          </Button>
        ) : undefined,
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleNextPage = async () => {
    if (nextPageToken) {
      const newPageTokens = [...pageTokens, nextPageToken]
      setPageTokens(newPageTokens)
      setCurrentPage(currentPage + 1)
      await handleSyncEmails(nextPageToken)
    }
  }

  const handlePreviousPage = async () => {
    if (currentPage > 0) {
      const newPage = currentPage - 1
      setCurrentPage(newPage)
      await handleSyncEmails(pageTokens[newPage])
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading emails...</p>
        </div>
      </div>
    )
  }

  if (emails.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No emails yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your Gmail account and sync to see your emails here
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button asChild variant="outline">
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Go to Settings
              </Link>
            </Button>
            <Button onClick={() => handleSyncEmails()} disabled={isSyncing}>
              {isSyncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-5 flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Inbox ({emails.filter((e) => !e.read).length} unread)
        </h2>
        <Button size="sm" variant="outline" onClick={() => handleSyncEmails()} disabled={isSyncing}>
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
      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-border">
          {emails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}`}
              className={cn(
                "flex items-start gap-6 px-6 py-6 transition-colors hover:bg-muted/50",
                !email.read && "bg-muted/30"
              )}
            >
              <Checkbox className="mt-1" />
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={email.from.avatar} alt={email.from.name} />
                <AvatarFallback>
                  {email.from.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="mb-2 flex items-center gap-2.5">
                  <span className={cn("text-sm", !email.read && "font-semibold")}>
                    {email.from.name}
                  </span>
                  <Badge variant="outline" className="h-5 px-1.5">
                    <ProviderIcon provider={email.provider} className="h-3 w-3" />
                  </Badge>
                  {email.aiSummary && <Sparkles className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className={cn("mb-2 text-sm truncate", !email.read ? "font-semibold" : "font-normal")}>
                  {email.subject}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed">{email.bodyPlain}</p>
                {email.aiLabels && email.aiLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {email.aiLabels.map((label) => (
                      <AiLabelBadge key={label} label={label as any} />
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatTimestamp(email.date)}
              </div>
            </Link>
          ))}
        </div>
      </div>
      {(currentPage > 0 || nextPageToken) && (
        <div className="border-t border-border px-6 py-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={(e) => {
                    e.preventDefault()
                    handlePreviousPage()
                  }}
                  className={cn(
                    currentPage === 0 && "pointer-events-none opacity-50",
                    "cursor-pointer"
                  )}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm text-muted-foreground px-4">
                  Page {currentPage + 1}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  onClick={(e) => {
                    e.preventDefault()
                    handleNextPage()
                  }}
                  className={cn(
                    !nextPageToken && "pointer-events-none opacity-50",
                    isSyncing && "pointer-events-none opacity-50",
                    "cursor-pointer"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
