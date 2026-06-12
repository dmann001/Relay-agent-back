"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, Mail, Settings, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, PenSquare, Archive, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProviderIcon } from "@/components/provider-icon"
import { SearchBar } from "@/components/search-bar"
import { ComposeDialog } from "@/components/compose-dialog"
import { emailApi, EmailApiError } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"
import type { Email } from "@/types"

const ITEMS_PER_PAGE = 50

/** Page numbers to render, with ellipsis for long lists. */
function getVisiblePages(current: number, total: number): Array<number | "ellipsis"> {
  if (total <= 1) return [1]
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: Array<number | "ellipsis"> = [1]
  const windowStart = Math.max(2, current - 1)
  const windowEnd = Math.min(total - 1, current + 1)

  if (windowStart > 2) pages.push("ellipsis")
  for (let page = windowStart; page <= windowEnd; page++) pages.push(page)
  if (windowEnd < total - 1) pages.push("ellipsis")
  if (total > 1) pages.push(total)

  return pages
}

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
  const [totalEmails, setTotalEmails] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isPaging, setIsPaging] = useState(false)
  const [hasMoreFromGmail, setHasMoreFromGmail] = useState(false)

  const [showCompose, setShowCompose] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // OAuth callback params (tokens are stored server-side by the callback route)
  const gmailAuthSuccess = searchParams.get("gmail_auth")
  const gmailEmail = searchParams.get("gmail_email")

  const { toast } = useToast()

  // Step 1 of the sync flow: show cached emails from the Relay DB immediately.
  const loadPage = useCallback(async (page: number) => {
    try {
      const { emails: loaded, total, hasMore } = await emailApi.listEmails("inbox", {
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
        category: "primary",
      })
      setEmails(loaded)
      setTotalEmails(total)
      setHasMoreFromGmail(hasMore ?? false)
    } catch (error: any) {
      if (error instanceof EmailApiError && error.code === "NO_SESSION") return
      console.error("[Inbox] Failed to load cached emails:", error)
    }
  }, [])

  // Step 2: in the background, ask Gmail for changes, then refresh the UI.
  const handleSync = useCallback(async (silent: boolean = false, force: boolean = false) => {
    if (!silent) setIsSyncing(true)
    try {
      const { results } = await emailApi.sync(undefined, { force })
      await loadPage(1)
      setCurrentPage(1)

      const synced = results.reduce((sum, r) => sum + r.synced, 0)
      const failed = results.find((r) => r.error)
      if (failed?.error?.toLowerCase().includes("invalid_grant")) {
        toast({
          title: "Session Expired",
          description: `Please reconnect ${failed.email} in Settings`,
          variant: "destructive",
        })
      } else if (failed?.error) {
        if (!silent || emails.length === 0) {
          toast({
            title: "Sync Failed",
            description: failed.error,
            variant: "destructive",
          })
        }
      } else if (!silent && synced > 0) {
        toast({
          title: "Inbox Updated",
          description: `Synced ${synced} email${synced > 1 ? "s" : ""}`,
        })
      }
    } catch (error: any) {
      if (error instanceof EmailApiError && error.code === "AUTH_EXPIRED") {
        toast({
          title: "Session Expired",
          description: "Please reconnect your Gmail account in Settings",
          variant: "destructive",
        })
      } else if (!silent) {
        console.error("[Inbox] Sync failed:", error)
        toast({
          title: "Sync Failed",
          description: error.message || "Failed to sync emails",
          variant: "destructive",
        })
      }
    } finally {
      setIsSyncing(false)
    }
  }, [emails.length, loadPage, toast])

  // Handle OAuth callback redirect - tokens are already stored server-side.
  useEffect(() => {
    if (gmailAuthSuccess === "success") {
      router.replace("/inbox")
      toast({
        title: "Gmail Connected",
        description: `Connected ${gmailEmail || "your account"}. Syncing emails...`,
      })
      setHasAccounts(true)
      setIsSyncing(true)
      void handleSync(true, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailAuthSuccess, gmailEmail])

  // Mount: cached emails first (fast), then background sync.
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const accounts = await emailApi.listAccounts()
        if (cancelled) return
        setHasAccounts(accounts.length > 0)
        await loadPage(1)
        if (cancelled) return
        setIsLoading(false)
        if (accounts.length > 0 && gmailAuthSuccess !== "success") {
          await handleSync(true)
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false)
          setHasAccounts(false)
        }
      }
    }
    void init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Periodic background refresh while the inbox tab is visible (every 5 min).
  useEffect(() => {
    if (!hasAccounts) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void handleSync(true)
      }
    }, 5 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void handleSync(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [hasAccounts, handleSync])

  const applyFilters = (source: Email[]) => {
    let filtered = source.filter((e) => !e.isArchived && !e.isTrashed)

    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase()
      filtered = filtered.filter((e) =>
        e.subject.toLowerCase().includes(lower) ||
        e.from.name.toLowerCase().includes(lower) ||
        e.from.email.toLowerCase().includes(lower) ||
        (e.snippet || e.bodyPlain || "").toLowerCase().includes(lower)
      )
    }

    return filtered
  }

  const filteredEmails = applyFilters(emails)
  const totalPages = Math.max(1, Math.ceil(totalEmails / ITEMS_PER_PAGE))
  const canGoNext = currentPage < totalPages || hasMoreFromGmail
  const canGoPrev = currentPage > 1
  const visiblePages = getVisiblePages(currentPage, Math.max(totalPages, hasMoreFromGmail ? currentPage + 1 : totalPages))
  const paginationDisabled = isPaging || isSyncing

  const refreshInboxTotals = async () => {
    const { total, hasMore } = await emailApi.listEmails("inbox", {
      limit: 1,
      offset: 0,
      category: "primary",
    })
    setTotalEmails(total)
    setHasMoreFromGmail(hasMore ?? false)
    return { total, hasMore: hasMore ?? false }
  }

  const fetchMoreFromGmail = async (): Promise<{ total: number; hasMore: boolean }> => {
    await emailApi.sync("inbox", { loadMore: true, force: true })
    return refreshInboxTotals()
  }

  const ensureEmailsForPage = async (page: number) => {
    const required = page * ITEMS_PER_PAGE
    let { total, hasMore } = await refreshInboxTotals()

    while (total < required && hasMore) {
      ;({ total, hasMore } = await fetchMoreFromGmail())
    }

    return { total, hasMore }
  }

  const handleGoToPage = async (page: number) => {
    if (page < 1 || page === currentPage || paginationDisabled) return
    setIsPaging(true)
    try {
      const { total, hasMore } = await ensureEmailsForPage(page)
      setTotalEmails(total)
      setHasMoreFromGmail(hasMore)
      const targetPage = Math.min(page, Math.max(1, Math.ceil(total / ITEMS_PER_PAGE)))
      await loadPage(targetPage)
      setCurrentPage(targetPage)
    } finally {
      setIsPaging(false)
    }
  }

  const handleNextPage = () => handleGoToPage(currentPage + 1)
  const handlePrevPage = () => handleGoToPage(currentPage - 1)
  const handleFirstPage = () => handleGoToPage(1)
  const handleLastPage = async () => {
    if (paginationDisabled) return
    setIsPaging(true)
    try {
      let { total, hasMore } = await refreshInboxTotals()
      while (hasMore) {
        ;({ total, hasMore } = await fetchMoreFromGmail())
      }
      const lastPage = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
      await loadPage(lastPage)
      setCurrentPage(lastPage)
    } finally {
      setIsPaging(false)
    }
  }

  const renderPagination = (compact = false) => (
    <div className={cn("flex items-center gap-1", compact ? "" : "gap-2")}>
      <Button
        variant="ghost"
        size="icon"
        disabled={!canGoPrev || paginationDisabled}
        onClick={handleFirstPage}
        title="First page"
        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={!canGoPrev || paginationDisabled}
        onClick={handlePrevPage}
        title="Previous page"
        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-0.5">
        {visiblePages.map((page, index) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={page}
              variant="ghost"
              size="sm"
              disabled={paginationDisabled}
              onClick={() => handleGoToPage(page)}
              className={cn(
                "min-w-8 h-8 px-2 text-sm rounded-lg",
                page === currentPage
                  ? "bg-brand-soft text-brand-strong hover:bg-brand-soft"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
              )}
            >
              {page}
            </Button>
          )
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        disabled={!canGoNext || paginationDisabled}
        onClick={handleNextPage}
        title="Next page"
        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        disabled={!canGoNext || paginationDisabled}
        onClick={handleLastPage}
        title="Last page"
        className="text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>

      {!compact && (
        <span className="ml-1 whitespace-nowrap text-xs text-muted-foreground">
          {totalEmails} total
        </span>
      )}
    </div>
  )

  // Quick actions from the list (archive / trash) - Gmail first, then cache.
  const handleQuickAction = async (event: React.MouseEvent, emailId: string, action: "archive" | "trash") => {
    event.preventDefault()
    event.stopPropagation()
    // Optimistic UI: remove from the list immediately.
    setEmails((prev) => prev.filter((e) => e.id !== emailId))
    try {
      await emailApi.modifyEmail(emailId, action)
      toast({
        title: action === "archive" ? "Email Archived" : "Moved to Trash",
        description: action === "archive" ? "Removed from Inbox in Gmail too" : "You can restore it from Trash",
      })
    } catch (error: any) {
      toast({
        title: "Action Failed",
        description: error.message || "Could not update the email",
        variant: "destructive",
      })
      await loadPage(currentPage)
    }
  }

  // Infinite scroll - pre-fetch next page when user scrolls near bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && canGoNext && !paginationDisabled) {
          void handleNextPage()
        }
      },
      { threshold: 0.1 }
    )
    if (loadMoreRef.current) observer.observe(loadMoreRef.current)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGoNext, paginationDisabled, currentPage])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="mt-2 text-sm text-muted-foreground">Loading emails...</p>
        </div>
      </div>
    )
  }

  if (filteredEmails.length === 0 && !isSyncing) {
    const hasAnyEmails = emails.length > 0
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <Mail className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-light text-foreground">
            {hasAnyEmails ? "No primary emails match your search" : "No primary emails yet"}
          </h3>
          <p className="mt-3 text-sm text-muted-foreground">
            {hasAnyEmails
              ? "Try a different search or sync to fetch more."
              : "Connect your Gmail account and sync to see your emails here"}
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Go to Settings
              </Link>
            </Button>
            <Button
              onClick={() => handleSync(false, true)}
              disabled={isSyncing}
              className="rounded-xl bg-brand text-brand-foreground hover:bg-brand-strong"
            >
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
    <div className="flex h-full flex-col bg-background">
      <div className="space-y-4 border-b border-border bg-surface-subtle px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <SearchBar onSearch={setSearchQuery} />
          <Button
            onClick={() => setShowCompose(true)}
            className="shrink-0 rounded-xl border-0 bg-brand font-medium text-brand-foreground shadow-sm hover:bg-brand-strong"
          >
            <PenSquare className="mr-2 h-4 w-4" />
            Compose
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-foreground">
            Inbox <span className="text-muted-foreground">({filteredEmails.filter((e) => !e.read).length} unread)</span>
          </h2>
          <div className="flex items-center gap-2">
            {(totalPages > 1 || hasMoreFromGmail) && renderPagination(true)}
            <Button
              size="sm"
              onClick={() => handleSync(false, true)}
              disabled={isSyncing}
              className="rounded-lg border border-border bg-surface-raised text-foreground hover:bg-surface-hover"
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
        </div>
      </div>

      {/* Compose Dialog */}
      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />

      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-border">
          {filteredEmails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}`}
              className={cn(
                "group flex items-start gap-6 px-6 py-5 transition-all hover:bg-surface-hover",
                !email.read && "bg-brand-soft/35"
              )}
            >
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
                  <span className={cn("text-sm text-foreground", !email.read && "font-semibold")}>
                    {email.from.name}
                  </span>
                  <Badge className="h-5 border border-border bg-surface-raised px-1.5 text-foreground">
                    <ProviderIcon className="h-3 w-3" />
                  </Badge>
                  {email.gmailCategory && (
                    <Badge className="h-5 border-0 bg-brand-soft px-2 text-[10px] capitalize text-brand-strong">
                      {email.gmailCategory}
                    </Badge>
                  )}
                </div>
                <div className={cn("mb-2 truncate text-sm text-foreground", !email.read ? "font-semibold" : "font-normal")}>
                  {email.subject}
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {(email.snippet || email.bodyPlain || '')
                    .replace(/<[^>]*>/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 200)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs text-muted-foreground">{formatTimestamp(email.date)}</span>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:bg-surface-hover hover:text-brand"
                    title="Archive"
                    onClick={(e) => handleQuickAction(e, email.id, "archive")}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-[#8A8A8A] hover:text-red-400 hover:bg-red-500/10"
                    title="Move to Trash"
                    onClick={(e) => handleQuickAction(e, email.id, "trash")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div ref={loadMoreRef} />
        {filteredEmails.length > 0 && (totalPages > 1 || hasMoreFromGmail) && (
          <div className="flex flex-col items-center gap-2 border-t border-border p-4">
            {renderPagination()}
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {hasMoreFromGmail ? `${totalPages}+` : totalPages}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
