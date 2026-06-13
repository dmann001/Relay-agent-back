"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Archive,
  CheckCheck,
  Inbox as InboxIcon,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ComposeDialog } from "@/components/compose-dialog"
import { SearchBar } from "@/components/search-bar"
import { ThreadView } from "@/components/thread-view"
import { AiInboxBrief } from "@/components/ai-inbox-brief"
import { cn } from "@/lib/utils"
import { emailApi, EmailApiError, type EmailAction } from "@/lib/email-api"
import { useToast } from "@/hooks/use-toast"
import type { Email } from "@/types"

const PAGE_SIZE = 50
const GMAIL_CATEGORIES = [
  { value: "primary", label: "Primary" },
  { value: "updates", label: "Updates" },
  { value: "promotions", label: "Promotions" },
  { value: "social", label: "Social" },
  { value: "forums", label: "Forums" },
] as const

type GmailCategory = (typeof GMAIL_CATEGORIES)[number]["value"]
const CATEGORY_VALUES = new Set<string>(GMAIL_CATEGORIES.map(({ value }) => value))

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday"

  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays < 7) return date.toLocaleDateString([], { weekday: "short" })
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  })
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?"
}

function cleanSnippet(email: Email): string {
  return (email.snippet || email.bodyPlain || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function InboxList() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const categoryParam = searchParams.get("category")
  const selectedCategory: GmailCategory = CATEGORY_VALUES.has(categoryParam || "")
    ? categoryParam as GmailCategory
    : "primary"
  const selectedEmailId = searchParams.get("message")
  const showInboxBrief = searchParams.get("assistant") === "brief"

  const [emails, setEmails] = useState<Email[]>([])
  const [totalEmails, setTotalEmails] = useState(0)
  const [hasMoreFromGmail, setHasMoreFromGmail] = useState(false)
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<EmailAction | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const requestVersion = useRef(0)

  const updateQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value)
      else params.delete(key)
    })
    const query = params.toString()
    router.replace(query ? `/inbox?${query}` : "/inbox", { scroll: false })
  }, [router, searchParams])

  const loadEmails = useCallback(async (category: GmailCategory, append = false) => {
    const version = append ? requestVersion.current : ++requestVersion.current
    const offset = append ? emails.length : 0
    const result = await emailApi.listEmails("inbox", { limit: PAGE_SIZE, offset, category })
    if (version !== requestVersion.current) return

    setEmails((current) => {
      if (!append) return result.emails
      const existing = new Set(current.map(({ id }) => id))
      return [...current, ...result.emails.filter(({ id }) => !existing.has(id))]
    })
    setTotalEmails(result.total)
    setHasMoreFromGmail(result.hasMore ?? false)
  }, [emails.length])

  const syncInbox = useCallback(async (silent = false, force = false, category = selectedCategory) => {
    if (!silent) setIsSyncing(true)
    try {
      const { results } = await emailApi.sync(undefined, { force })
      await loadEmails(category)
      const failed = results.find(({ error }) => error)
      const synced = results.reduce((sum, result) => sum + result.synced, 0)
      if (failed?.error?.toLowerCase().includes("invalid_grant")) {
        toast({ title: "Session expired", description: `Reconnect ${failed.email} in Settings.`, variant: "destructive" })
      } else if (failed?.error && !silent) {
        toast({ title: "Sync failed", description: failed.error, variant: "destructive" })
      } else if (!silent) {
        toast({ title: "Inbox updated", description: synced ? `Synced ${synced} email${synced === 1 ? "" : "s"}.` : "You're up to date." })
      }
    } catch (error: any) {
      if (!silent) toast({ title: "Sync failed", description: error.message || "Could not sync email.", variant: "destructive" })
    } finally {
      setIsSyncing(false)
    }
  }, [loadEmails, selectedCategory, toast])

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      setIsLoading(true)
      setSelectedIds(new Set())
      try {
        const accounts = await emailApi.listAccounts()
        if (cancelled) return
        setHasAccounts(accounts.length > 0)
        await loadEmails(selectedCategory)
        if (cancelled) return
        setIsLoading(false)
        if (accounts.length > 0) void syncInbox(true, false, selectedCategory)
      } catch (error) {
        if (!cancelled) {
          setIsLoading(false)
          if (error instanceof EmailApiError && error.code === "NO_SESSION") return
          setHasAccounts(false)
        }
      }
    }
    void initialize()
    return () => { cancelled = true }
    // load when the URL-backed quick view changes; callbacks intentionally use current category.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  useEffect(() => {
    if (!hasAccounts) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncInbox(true)
    }, 5 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [hasAccounts, syncInbox])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [searchQuery])

  const filteredEmails = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return emails
    return emails.filter((email) =>
      email.subject.toLowerCase().includes(query) ||
      email.from.name.toLowerCase().includes(query) ||
      email.from.email.toLowerCase().includes(query) ||
      cleanSnippet(email).toLowerCase().includes(query)
    )
  }, [emails, searchQuery])

  const canLoadMore = emails.length < totalEmails || hasMoreFromGmail
  const loadMore = useCallback(async () => {
    if (isLoadingMore || isLoading || !canLoadMore) return
    setIsLoadingMore(true)
    try {
      if (emails.length >= totalEmails && hasMoreFromGmail) {
        await emailApi.sync("inbox", { loadMore: true, force: true, category: selectedCategory })
      }
      await loadEmails(selectedCategory, true)
    } catch (error: any) {
      toast({ title: "Could not load more mail", description: error.message || "Try again.", variant: "destructive" })
    } finally {
      setIsLoadingMore(false)
    }
  }, [canLoadMore, emails.length, hasMoreFromGmail, isLoading, isLoadingMore, loadEmails, selectedCategory, toast, totalEmails])

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || !canLoadMore) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void loadMore()
    }, { rootMargin: "300px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [canLoadMore, loadMore])

  const removeEmails = useCallback((ids: Set<string>) => {
    setEmails((current) => current.filter(({ id }) => !ids.has(id)))
    setTotalEmails((current) => Math.max(0, current - ids.size))
    setSelectedIds(new Set())
    if (selectedEmailId && ids.has(selectedEmailId)) updateQuery({ message: null })
  }, [selectedEmailId, updateQuery])

  const updateReadState = useCallback((ids: Set<string>, read: boolean) => {
    setEmails((current) => current.map((email) => ids.has(email.id) ? { ...email, read } : email))
  }, [])

  const runBulkAction = async (action: "archive" | "trash" | "markRead" | "markUnread") => {
    const ids = new Set(selectedIds)
    if (!ids.size || bulkAction) return
    const snapshot = emails
    setBulkAction(action)
    if (action === "archive" || action === "trash") removeEmails(ids)
    else updateReadState(ids, action === "markRead")

    const results = await Promise.allSettled([...ids].map((id) => emailApi.modifyEmail(id, action)))
    const failedIds = [...ids].filter((_, index) => results[index].status === "rejected")
    if (failedIds.length) {
      setEmails(snapshot)
      setTotalEmails((current) => action === "archive" || action === "trash" ? current + ids.size : current)
      toast({
        title: failedIds.length === ids.size ? "Bulk action failed" : "Some emails could not be updated",
        description: `${failedIds.length} of ${ids.size} email${ids.size === 1 ? "" : "s"} failed. The list was refreshed.`,
        variant: "destructive",
      })
      await loadEmails(selectedCategory)
    } else {
      setSelectedIds(new Set())
      toast({
        title: action === "archive" ? "Emails archived" : action === "trash" ? "Moved to Trash" : action === "markRead" ? "Marked as read" : "Marked as unread",
        description: `${ids.size} email${ids.size === 1 ? "" : "s"} updated.`,
      })
    }
    setBulkAction(null)
  }

  const runSingleAction = async (event: React.MouseEvent, email: Email, action: "archive" | "trash" | "markRead" | "markUnread") => {
    event.preventDefault()
    event.stopPropagation()
    const ids = new Set([email.id])
    const snapshot = emails
    if (action === "archive" || action === "trash") removeEmails(ids)
    else updateReadState(ids, action === "markRead")
    try {
      await emailApi.modifyEmail(email.id, action)
    } catch (error: any) {
      setEmails(snapshot)
      setTotalEmails((current) => action === "archive" || action === "trash" ? current + 1 : current)
      toast({ title: "Action failed", description: error.message || "Could not update this email.", variant: "destructive" })
    }
  }

  const allVisibleSelected = filteredEmails.length > 0 && filteredEmails.every(({ id }) => selectedIds.has(id))
  const toggleAllVisible = () => setSelectedIds((current) => {
    const next = new Set(current)
    if (allVisibleSelected) filteredEmails.forEach(({ id }) => next.delete(id))
    else filteredEmails.forEach(({ id }) => next.add(id))
    return next
  })

  const toggleSelected = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const handleThreadRemoved = useCallback((id: string) => {
    setEmails((current) => current.filter((email) => email.id !== id))
    setTotalEmails((current) => Math.max(0, current - 1))
    setSelectedIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])
  const handleThreadRead = useCallback((id: string) => updateReadState(new Set([id]), true), [updateReadState])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof Element && target.matches("input, textarea, select, [contenteditable='true']")) return
      if (event.key === "Escape") {
        if (selectedIds.size) setSelectedIds(new Set())
        else if (selectedEmailId) updateQuery({ message: null })
        return
      }
      if ((event.key !== "j" && event.key !== "k") || !filteredEmails.length) return

      event.preventDefault()
      const currentIndex = filteredEmails.findIndex(({ id }) => id === selectedEmailId)
      const nextIndex = event.key === "j"
        ? Math.min(currentIndex + 1, filteredEmails.length - 1)
        : Math.max(currentIndex < 0 ? filteredEmails.length - 1 : currentIndex - 1, 0)
      updateQuery({ message: filteredEmails[nextIndex].id })
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [filteredEmails, selectedEmailId, selectedIds.size, updateQuery])

  const selectedCategoryLabel = GMAIL_CATEGORIES.find(({ value }) => value === selectedCategory)?.label || "Primary"

  return (
    <div className="flex h-full min-h-0 bg-background">
      <section className={cn(
        "min-w-0 flex-1 flex-col border-r border-border bg-background md:flex md:w-[min(43%,30rem)] md:flex-none",
        selectedEmailId || showInboxBrief ? "hidden" : "flex",
      )} aria-label="Inbox message list">
        <header className="shrink-0 border-b border-border bg-surface-subtle/95 px-3 py-3 backdrop-blur sm:px-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1"><SearchBar onSearch={setSearchQuery} /></div>
            <Button onClick={() => setShowCompose(true)} className="shrink-0 rounded-xl bg-brand text-brand-foreground hover:bg-brand-strong" aria-label="Compose email">
              <PenSquare className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Compose</span>
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Checkbox
                checked={allVisibleSelected ? true : selectedIds.size ? "indeterminate" : false}
                onCheckedChange={toggleAllVisible}
                aria-label={allVisibleSelected ? "Clear visible selection" : "Select visible emails"}
                disabled={!filteredEmails.length}
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">Inbox</div>
                <div className="text-[11px] text-muted-foreground">
                  {totalEmails} {selectedCategoryLabel.toLowerCase()} email{totalEmails === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => updateQuery({ assistant: "brief", message: null })} title="Create inbox brief" className="h-8 px-2 text-xs"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Brief</Button>
              <Button variant="ghost" size="icon" onClick={() => void syncInbox(false, true)} disabled={isSyncing} title="Sync inbox" aria-label="Sync inbox" className="h-8 w-8">
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              </Button>
            </div>
          </div>

          <nav className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="Inbox categories">
            {GMAIL_CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                aria-current={selectedCategory === category.value ? "page" : undefined}
                onClick={() => updateQuery({ category: category.value === "primary" ? null : category.value, message: null })}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedCategory === category.value
                    ? "bg-brand-soft text-brand-strong"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {category.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex h-11 shrink-0 items-center border-b border-border bg-card px-3 sm:px-4" aria-live="polite">
          {selectedIds.size ? (
            <div className="flex w-full items-center gap-1">
              <span className="mr-auto text-xs font-medium text-foreground">{selectedIds.size} selected</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void runBulkAction("markRead")} disabled={Boolean(bulkAction)} title="Mark selected as read"><MailOpen className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void runBulkAction("markUnread")} disabled={Boolean(bulkAction)} title="Mark selected as unread"><Mail className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void runBulkAction("archive")} disabled={Boolean(bulkAction)} title="Archive selected"><Archive className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => void runBulkAction("trash")} disabled={Boolean(bulkAction)} title="Move selected to Trash"><Trash2 className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedIds(new Set())} title="Clear selection"><X className="h-4 w-4" /></Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
              <span>{searchQuery ? `${filteredEmails.length} loaded match${filteredEmails.length === 1 ? "" : "es"}` : `${emails.length} of ${totalEmails} loaded`}</span>
              {isSyncing && <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Syncing</span>}
            </div>
          )}
        </div>

        <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="flex h-full items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-brand" /><span className="ml-2 text-sm text-muted-foreground">Loading mail…</span></div>
          ) : filteredEmails.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft"><InboxIcon className="h-6 w-6 text-brand-strong" /></div>
                <h2 className="mt-4 text-base font-semibold">{searchQuery ? "No loaded emails match" : `No ${selectedCategoryLabel} emails`}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{searchQuery ? "Try another search or clear the query." : hasAccounts ? "This quick view is empty." : "Connect Gmail to start receiving email."}</p>
                {!hasAccounts && <Button asChild className="mt-4"><Link href="/settings"><Settings className="mr-2 h-4 w-4" />Connect Gmail</Link></Button>}
              </div>
            </div>
          ) : (
            <div role="list" aria-label={`${selectedCategoryLabel} emails`}>
              {filteredEmails.map((email) => {
                const selected = selectedEmailId === email.id
                const checked = selectedIds.has(email.id)
                return (
                  <div
                    key={email.id}
                    role="listitem"
                    className={cn(
                      "group relative flex min-h-[76px] cursor-pointer items-start gap-2 border-b border-border px-3 py-2.5 transition-colors sm:px-4",
                      selected ? "bg-brand-soft/70" : !email.read ? "bg-brand-soft/25" : "bg-background",
                      "hover:bg-surface-hover",
                    )}
                    onClick={() => updateQuery({ message: email.id })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        updateQuery({ message: email.id })
                      }
                    }}
                    tabIndex={0}
                    aria-current={selected ? "true" : undefined}
                  >
                    <div className="flex w-5 shrink-0 justify-center pt-2" onClick={(event) => event.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleSelected(email.id)} aria-label={`Select email from ${email.from.name}`} />
                    </div>
                    <Avatar className="mt-0.5 h-8 w-8 shrink-0 border border-border">
                      <AvatarImage src={email.from.avatar} alt="" />
                      <AvatarFallback className="text-[10px]">{initials(email.from.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={cn("min-w-0 flex-1 truncate text-sm", !email.read ? "font-semibold text-foreground" : "font-medium text-foreground")}>{email.from.name}</span>
                        <time className={cn("shrink-0 text-[11px]", !email.read ? "font-medium text-brand-strong" : "text-muted-foreground")}>{formatTimestamp(email.date)}</time>
                      </div>
                      <div className={cn("mt-0.5 truncate text-sm", !email.read ? "font-semibold text-foreground" : "text-foreground")}>{email.subject}</div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {email.hasAttachments && <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />}
                        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{cleanSnippet(email) || "No preview available"}</p>
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-3 hidden items-center rounded-lg border border-border bg-card p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => void runSingleAction(event, email, email.read ? "markUnread" : "markRead")} title={email.read ? "Mark unread" : "Mark read"}>{email.read ? <Mail className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}</Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(event) => void runSingleAction(event, email, "archive")} title="Archive"><Archive className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(event) => void runSingleAction(event, email, "trash")} title="Move to Trash"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )
              })}
              <div ref={loadMoreRef} className="flex min-h-16 items-center justify-center p-3">
                {isLoadingMore ? <span className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading more mail…</span> : canLoadMore ? <Button variant="ghost" size="sm" onClick={() => void loadMore()}>Load more</Button> : <span className="text-xs text-muted-foreground">You’re all caught up</span>}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className={cn("min-w-0 flex-1 bg-surface-subtle/40", selectedEmailId || showInboxBrief ? "flex" : "hidden md:flex")} aria-label="Email reading pane">
        {showInboxBrief ? (
          <AiInboxBrief onClose={() => updateQuery({ assistant: null })} onOpenMessage={(messageId) => updateQuery({ assistant: null, message: messageId })} />
        ) : selectedEmailId ? (
          <div className="h-full min-h-0 w-full">
            <ThreadView threadId={selectedEmailId} embedded onClose={() => updateQuery({ message: null })} onRemoved={handleThreadRemoved} onRead={handleThreadRead} />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm"><MailOpen className="h-7 w-7 text-brand" /></div>
              <h2 className="mt-4 text-lg font-medium text-foreground">Select an email to read</h2>
              <p className="mt-2 text-sm text-muted-foreground">Your inbox stays in place while you move through messages.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
