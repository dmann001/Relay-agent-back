"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Sparkles, RefreshCw, Mail, Settings, ChevronLeft, ChevronRight, AlertTriangle, TrendingUp, Smile, Frown, Meh, Calendar, PenSquare, Filter, Tag, Users, MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { AiLabelBadge } from "@/components/ai-label-badge"
import { ProviderIcon } from "@/components/provider-icon"
import { SearchBar } from "@/components/search-bar"
import { ComposeDialog } from "@/components/compose-dialog"
import { storage } from "@/lib/storage"
import { api } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import type { Email } from "@/types"

// Gmail category filter type
interface CategoryFilter {
  primary: boolean;
  promotions: boolean;
  social: boolean;
  updates: boolean;
  forums: boolean;
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
  const [isLoading, setIsLoading] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 20

  // Store next page tokens for each account: { accountId: token }
  const [accountTokens, setAccountTokens] = useState<Record<string, string | undefined>>({})

  // Category filter state - default to Primary only (excludes promotions, social, etc.)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>({
    primary: true,
    promotions: false,
    social: false,
    updates: false,
    forums: false,
  })
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)

  // Compose dialog state
  const [showCompose, setShowCompose] = useState(false)
  const searchParams = useSearchParams()
  const providerFilter = searchParams.get("provider") as Email["provider"] | null

  const { toast } = useToast()
  const filterByProvider = useMemo(() => providerFilter, [providerFilter])

  const applyUpdatedAuth = (accountId: string, auth?: { accessToken?: string; expiryDate?: number }) => {
    if (!auth || (!auth.accessToken && !auth.expiryDate)) return
    const updates: { accessToken?: string; expiryDate?: number } = {}
    if (auth.accessToken) updates.accessToken = auth.accessToken
    if (auth.expiryDate) updates.expiryDate = auth.expiryDate
    storage.updateAccount(accountId, updates)
  }

  const applyFilters = (source: Email[]) => {
    const filtered = source.filter((e) => !e.isArchived)
    const byProvider = filterByProvider
      ? filtered.filter((e) => e.provider === filterByProvider)
      : filtered

    return byProvider.filter((email) => {
      if (email.provider !== "gmail") {
        return categoryFilter.primary
      }
      const category = email.gmailCategory || "primary"
      return categoryFilter[category]
    })
  }

  // Quick sync - only fetch new emails since last sync (faster)
  const handleQuickSync = async () => {
    setIsSyncing(true)
    const accounts = storage.getAccounts().filter(a => !filterByProvider || a.provider === filterByProvider)
    const data = storage.getData()
    const lastSync = data?.lastSync
    const settings = storage.getSettings()

    if (accounts.length === 0) {
      setIsSyncing(false)
      return
    }

    try {
      let newEmailCount = 0

      for (const account of accounts) {
        if (account.provider === "gmail" && account.accessToken) {
          console.log(`[QuickSync] Checking for new emails since ${lastSync || 'beginning'}`)

          const response = await fetch("/api/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: account.accessToken,
              refreshToken: account.refreshToken,
              expiryDate: account.expiryDate,
              quickSync: true,
              lastSyncTime: lastSync,
              categoryFilter, // Pass category filter to API
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            if (errorData.code === 'AUTH_EXPIRED') {
              toast({
                title: "Session Expired",
                description: "Please reconnect your Gmail account in Settings",
                variant: "destructive",
              })
            }
            continue
          }

          const result = await response.json()
          const fetchedEmails = result.emails || []
          applyUpdatedAuth(account.id, result.auth)

          if (fetchedEmails.length > 0) {
            // Only add truly new emails (check against existing)
            const existingIds = new Set(storage.getEmails().map(e => e.id))
            const newEmails = fetchedEmails.filter((e: any) => !existingIds.has(e.id))

            if (newEmails.length > 0) {
              // Classify intents for Relayed Mode (batch)
              if (settings.openaiApiKey) {
                try {
                  const intentResults = await api.ai.batchClassifyIntents(newEmails, settings.openaiApiKey)
                  const intentMap = new Map(intentResults.map(r => [r.emailId, r.intent]))
                  newEmails.forEach(email => {
                    const intent = intentMap.get(email.id)
                    if (intent) {
                      email.intent = intent
                      email.requiresResponse = ['decision', 'info_request', 'meeting', 'action_item'].includes(intent)
                    }
                  })
                } catch (error) {
                  console.error("[QuickSync] Intent classification failed:", error)
                }
              }

              storage.addEmails(newEmails)
              try {
                await api.ai.indexEmails(newEmails)
              } catch (error) {
                console.error("[QuickSync] Indexing failed:", error)
              }
              newEmailCount += newEmails.length
            }
          }
        }
      }

      // Refresh the display
      const allEmails = storage.getEmails().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setEmails(allEmails)

      if (newEmailCount > 0) {
        toast({
          title: "New Emails",
          description: `Found ${newEmailCount} new email${newEmailCount > 1 ? 's' : ''}`,
        })
      }

    } catch (error: any) {
      console.error("[QuickSync] Error:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Load emails from localStorage on mount
  useEffect(() => {
    setIsLoading(true)
    const loadedEmails = storage.getEmails()
    setEmails(loadedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))

    // Load persisted pagination tokens
    const persistedTokens = storage.getPaginationTokens()
    setAccountTokens(persistedTokens)

    setIsLoading(false)

    // Only auto-sync if we have accounts connected (avoid error on first visit)
    const accounts = storage.getAccounts().filter(a => !filterByProvider || a.provider === filterByProvider)
    if (accounts.length > 0) {
      handleQuickSync() // Use quick sync for faster initial load
    }
  }, [filterByProvider])

  useEffect(() => {
    setCurrentPage(1)
  }, [filterByProvider, categoryFilter, searchQuery])

  // Full sync - fetch all emails with pagination support
  const handleSyncEmails = async (isInitial: boolean = true) => {
    setIsSyncing(true)
    const accounts = storage.getAccounts().filter(a => !filterByProvider || a.provider === filterByProvider)
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
      let totalNewEmails = 0
      let updatedTokens = { ...accountTokens }

      for (const account of accounts) {
        if (account.provider === "gmail" && account.accessToken) {
          // Determine which token to use
          const pageToken = isInitial ? undefined : accountTokens[account.id]

          // If loading more but no more pages, skip
          if (!isInitial && !pageToken) {
            continue
          }

          // Get existing email IDs to skip re-fetching
          const existingEmails = storage.getEmails()
          const existingIds = existingEmails.map(e => e.id)

          console.log(`[Sync] Fetching for ${account.email}. Page: ${pageToken || 'initial'}. Existing: ${existingIds.length}`)

          const response = await fetch("/api/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accessToken: account.accessToken,
              refreshToken: account.refreshToken,
              expiryDate: account.expiryDate,
              maxResults: isInitial ? 50 : 20,
              pageToken,
              existingIds: isInitial ? existingIds : undefined, // Only skip on initial sync
              categoryFilter, // Pass category filter to API
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error(`[Sync] Error for ${account.email}:`, errorData)

            if (errorData.code === 'AUTH_EXPIRED') {
              toast({
                title: "Session Expired",
                description: "Please reconnect your Gmail account in Settings",
                variant: "destructive",
              })
            }
            continue
          }

          const data = await response.json()
          applyUpdatedAuth(account.id, data.auth)
          let fetchedEmails: Email[] = Array.isArray(data.emails) ? data.emails : []

          console.log(`[Sync] Fetched ${fetchedEmails.length} emails (${data.newCount || fetchedEmails.length} new)`)

          // Enrich emails with AI if enabled (only NEW emails that don't have labels)
          if (settings.aiFeatures.autoLabel && settings.openaiApiKey && fetchedEmails.length > 0) {
            const existingEmailsMap = new Map(existingEmails.map(e => [e.id, e]))

            // Only enrich emails that are truly new and don't have labels
            const emailsToEnrich = fetchedEmails.filter(e => {
              const existing = existingEmailsMap.get(e.id)
              return !existing?.aiLabels || existing.aiLabels.length === 0
            })

            if (emailsToEnrich.length > 0) {
              console.log(`[Sync] AI enriching ${emailsToEnrich.length} new emails`)

              // Process in small batches to avoid overwhelming the API
              for (const email of emailsToEnrich.slice(0, 10)) { // Limit to 10 per sync
                try {
                  const category = await api.ai.classifyEmail(email)
                  const idx = fetchedEmails.findIndex(e => e.id === email.id)
                  if (idx !== -1) {
                    fetchedEmails[idx] = { ...fetchedEmails[idx], aiLabels: [category] }
                  }
                  storage.incrementUsageStat('emailsCategorized', 1, 0.5)
                } catch (error) {
                  console.error(`[Sync] Error enriching email ${email.id}:`, error)
                }
              }
            }

            // Preserve existing enrichments for emails we already have
            fetchedEmails = fetchedEmails.map(email => {
              const existing = existingEmailsMap.get(email.id)
              if (existing?.aiLabels && existing.aiLabels.length > 0) {
                return {
                  ...email,
                  aiSummary: existing.aiSummary,
                  aiLabels: existing.aiLabels,
                  sentiment: existing.sentiment,
                  priorityScore: existing.priorityScore,
                  intent: existing.intent,
                  requiresResponse: existing.requiresResponse,
                }
              }
              return email
            })
          }

          // Classify intents for Relayed Mode (only for emails without intent)
          if (settings.openaiApiKey && fetchedEmails.length > 0) {
            const existingEmailsMap = new Map(existingEmails.map(e => [e.id, e]))
            const emailsToClassify = fetchedEmails.filter(e => !existingEmailsMap.get(e.id)?.intent)
            if (emailsToClassify.length > 0) {
              try {
                const intentResults = await api.ai.batchClassifyIntents(emailsToClassify, settings.openaiApiKey)
                const intentMap = new Map(intentResults.map(r => [r.emailId, r.intent]))
                fetchedEmails = fetchedEmails.map(email => {
                  const intent = intentMap.get(email.id)
                  if (!intent) return email
                  return {
                    ...email,
                    intent,
                    requiresResponse: ['decision', 'info_request', 'meeting', 'action_item'].includes(intent),
                  }
                })
              } catch (error) {
                console.error("[Sync] Intent classification failed:", error)
              }
            }
          }

          if (fetchedEmails.length > 0) {
            const existingEmailIds = new Set(existingEmails.map(e => e.id))
            const newEmails = fetchedEmails.filter(e => !existingEmailIds.has(e.id))
            storage.addEmails(fetchedEmails)
            if (newEmails.length > 0) {
              try {
                await api.ai.indexEmails(newEmails)
              } catch (error) {
                console.error("[Sync] Indexing failed:", error)
              }
            }
            totalNewEmails += data.newCount || fetchedEmails.length
          }

          // Update pagination token
          updatedTokens[account.id] = data.nextPageToken || undefined
        }
      }

      // Refresh the display
      const allEmails = storage.getEmails().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setEmails(allEmails)

      setAccountTokens(updatedTokens)
      storage.setPaginationTokens(updatedTokens)

      if (isInitial) {
        toast({
          title: "Inbox Synced",
          description: totalNewEmails > 0
            ? `Synced ${totalNewEmails} new email${totalNewEmails > 1 ? 's' : ''}`
            : "Your inbox is up to date",
        })
        setCurrentPage(1)
      }

    } catch (error: any) {
      console.error("[Sync] Error:", error)
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync emails",
        variant: "destructive",
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Pagination Logic
  const filteredEmails = applyFilters(emails)
  const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE)
  const displayedEmails = filteredEmails.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

  // Can go next if we have more pages in memory OR if we have tokens to fetch more
  const canGoNext = currentPage < totalPages || Object.values(accountTokens).some(t => !!t)
  const canGoPrev = currentPage > 1

  const handleNextPage = async () => {
    if (currentPage < totalPages) {
      // We have data in memory, just advance
      setCurrentPage(p => p + 1)
    } else {
      // We need to fetch more data
      // Check if we have tokens to fetch more
      const hasMorePages = Object.values(accountTokens).some(t => !!t)
      if (hasMorePages) {
        await handleSyncEmails(false)
        // After fetching, update the page (emails state will be updated by handleSyncEmails)
        const updatedEmails = storage.getEmails()
        const newTotalPages = Math.ceil(updatedEmails.length / ITEMS_PER_PAGE)
        if (currentPage < newTotalPages) {
          setCurrentPage(p => p + 1)
        }
      }
    }
  }

  const handlePrevPage = () => {
    if (canGoPrev) {
      setCurrentPage(p => p - 1)
    }
  }

  // Clear cached emails and do a fresh sync
  const handleClearAndResync = async () => {
    if (isSyncing) return

    // Clear all cached emails
    storage.clearEmails()
    setEmails([])
    setAccountTokens({})
    setCurrentPage(1)

    toast({
      title: "Cache Cleared",
      description: "Fetching fresh emails from Gmail...",
    })

    // Do a fresh sync
    await handleSyncEmails(true)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0A0A0B]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#E8DCC4]" />
          <p className="mt-2 text-sm text-[#8A8A8A]">Loading emails...</p>
        </div>
      </div>
    )
  }

  if (filteredEmails.length === 0 && !isSyncing) {
    const hasAnyEmails = emails.length > 0
    return (
      <div className="flex h-full items-center justify-center bg-[#0A0A0B]">
        <div className="max-w-md text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-6">
            <Mail className="h-8 w-8 text-[#E8DCC4]" />
          </div>
          <h3 className="text-xl font-light text-[#FAFAF9]">
            {hasAnyEmails ? "No emails match your filters" : "No emails yet"}
          </h3>
          <p className="mt-3 text-sm text-[#8A8A8A]">
            {hasAnyEmails
              ? "Try changing the category filter or sync to fetch more."
              : "Connect your Gmail account and sync to see your emails here"}
          </p>
          <div className="mt-8 flex gap-3 justify-center">
            <Button asChild className="bg-white/[0.03] border border-white/[0.08] text-[#FAFAF9] hover:bg-white/[0.06] rounded-xl">
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Go to Settings
              </Link>
            </Button>
            <Button
              onClick={() => handleSyncEmails(true)}
              disabled={isSyncing}
              className="bg-gradient-to-b from-[#FAFAF9] to-[#E8E8E6] hover:from-[#FFFFFF] hover:to-[#F5F5F3] text-[#0A0A0B] rounded-xl"
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

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      // Reset to local storage emails (non-archived)
      const loadedEmails = storage.getEmails()
      setEmails(loadedEmails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      return
    }

    const localEmails = storage.getEmails()
    const lower = query.toLowerCase()
    const filtered = localEmails.filter((e) =>
      e.subject.toLowerCase().includes(lower) ||
      e.from.name.toLowerCase().includes(lower) ||
      e.from.email.toLowerCase().includes(lower) ||
      (e.bodyPlain || e.body || "").toLowerCase().includes(lower)
    )
    setEmails(filtered)
  }

  // Toggle a category in the filter
  const toggleCategory = (category: keyof CategoryFilter) => {
    setCategoryFilter(prev => ({ ...prev, [category]: !prev[category] }))
  }

  // Get active category count
  const activeCategoryCount = Object.values(categoryFilter).filter(v => v).length

  return (
    <div className="flex h-full flex-col bg-[#0A0A0B]">
      <div className="border-b border-white/[0.04] px-6 py-5 space-y-4" style={{ background: 'linear-gradient(180deg, rgba(20,20,22,0.95) 0%, rgba(10,10,11,0.98) 100%)' }}>
        <div className="flex items-center justify-between gap-4">
          <SearchBar onSearch={handleSearch} />
          <Button
            onClick={() => setShowCompose(true)}
            className="shrink-0 bg-gradient-to-b from-[#E8DCC4] to-[#C4A052] hover:from-[#F5EDD8] hover:to-[#D4B062] text-[#0A0A0B] font-medium rounded-xl border-0"
          >
            <PenSquare className="mr-2 h-4 w-4" />
            Compose
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-medium text-[#FAFAF9]">
              Inbox <span className="text-[#8A8A8A]">({filteredEmails.filter((e) => !e.read).length} unread)</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              className={cn("border-white/[0.08] text-[#FAFAF9] hover:bg-white/[0.03] rounded-lg", showCategoryFilter && "bg-white/[0.06]")}
            >
              <Filter className="mr-2 h-3 w-3" />
              Filter
              {activeCategoryCount < 5 && (
                <Badge className="ml-2 bg-[#E8DCC4]/20 text-[#E8DCC4] border-0">{activeCategoryCount}</Badge>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canGoPrev || isSyncing}
              onClick={handlePrevPage}
              className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[3rem] text-center text-[#FAFAF9]">
              Page {currentPage}
            </span>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canGoNext || isSyncing}
              onClick={handleNextPage}
              className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => handleSyncEmails(true)}
              disabled={isSyncing}
              className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-lg"
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
            <Button
              size="sm"
              onClick={handleClearAndResync}
              disabled={isSyncing}
              title="Clear cached emails and fetch fresh"
              className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
            >
              Fresh Sync
            </Button>
          </div>
        </div>

        {/* Category Filter Panel */}
        {showCategoryFilter && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.04]">
            <span className="text-sm text-[#8A8A8A] mr-2">Show:</span>
            <Button
              size="sm"
              onClick={() => toggleCategory('primary')}
              className={cn("rounded-lg", categoryFilter.primary ? "bg-[#E8DCC4] text-[#0A0A0B] hover:bg-[#F5EDD8]" : "border border-white/[0.08] bg-transparent text-[#FAFAF9] hover:bg-white/[0.03]")}
            >
              <Mail className="mr-2 h-3 w-3" />
              Primary
            </Button>
            <Button
              size="sm"
              onClick={() => toggleCategory('promotions')}
              className={cn("rounded-lg", categoryFilter.promotions ? "bg-[#E8DCC4] text-[#0A0A0B] hover:bg-[#F5EDD8]" : "border border-white/[0.08] bg-transparent text-[#FAFAF9] hover:bg-white/[0.03]")}
            >
              <Tag className="mr-2 h-3 w-3" />
              Promotions
            </Button>
            <Button
              size="sm"
              onClick={() => toggleCategory('social')}
              className={cn("rounded-lg", categoryFilter.social ? "bg-[#E8DCC4] text-[#0A0A0B] hover:bg-[#F5EDD8]" : "border border-white/[0.08] bg-transparent text-[#FAFAF9] hover:bg-white/[0.03]")}
            >
              <Users className="mr-2 h-3 w-3" />
              Social
            </Button>
            <Button
              size="sm"
              onClick={() => toggleCategory('updates')}
              className={cn("rounded-lg", categoryFilter.updates ? "bg-[#E8DCC4] text-[#0A0A0B] hover:bg-[#F5EDD8]" : "border border-white/[0.08] bg-transparent text-[#FAFAF9] hover:bg-white/[0.03]")}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Updates
            </Button>
            <Button
              size="sm"
              onClick={() => toggleCategory('forums')}
              className={cn("rounded-lg", categoryFilter.forums ? "bg-[#E8DCC4] text-[#0A0A0B] hover:bg-[#F5EDD8]" : "border border-white/[0.08] bg-transparent text-[#FAFAF9] hover:bg-white/[0.03]")}
            >
              <MessageCircle className="mr-2 h-3 w-3" />
              Forums
            </Button>
            <div className="border-l border-white/[0.08] h-6 mx-2" />
            <Button
              size="sm"
              onClick={() => setCategoryFilter({ primary: true, promotions: true, social: true, updates: true, forums: true })}
              className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
            >
              Select All
            </Button>
            <Button
              size="sm"
              onClick={() => setCategoryFilter({ primary: true, promotions: false, social: false, updates: false, forums: false })}
              className="text-[#8A8A8A] hover:text-[#FAFAF9] hover:bg-white/[0.03]"
            >
              Primary Only
            </Button>
            <p className="text-xs text-[#5A5A5A] ml-2">
              (Change filters and click Sync to fetch)
            </p>
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />

      <div className="flex-1 overflow-auto">
        <div className="divide-y divide-white/[0.04]">
          {displayedEmails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}`}
              className={cn(
                "flex items-start gap-6 px-6 py-5 transition-all hover:bg-white/[0.02]",
                !email.read && "bg-[#E8DCC4]/[0.03]"
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
                  <span className={cn("text-sm text-[#FAFAF9]", !email.read && "font-semibold")}>
                    {email.from.name}
                  </span>
                  <Badge className="h-5 px-1.5 bg-white/[0.03] border border-white/[0.08]">
                    <ProviderIcon provider={email.provider} className="h-3 w-3" />
                  </Badge>
                  {email.provider === "gmail" && email.gmailCategory && (
                    <Badge className="h-5 px-2 text-[10px] capitalize bg-[#E8DCC4]/10 text-[#E8DCC4] border-0">
                      {email.gmailCategory}
                    </Badge>
                  )}
                  {email.aiSummary && <Sparkles className="h-3.5 w-3.5 text-[#E8DCC4]" />}
                  {/* Sentiment indicator */}
                  {email.sentiment && (
                    <span title={`Sentiment: ${email.sentiment.sentiment}`}>
                      {email.sentiment.sentiment === 'positive' && <Smile className="h-3.5 w-3.5 text-green-500" />}
                      {email.sentiment.sentiment === 'negative' && <Frown className="h-3.5 w-3.5 text-red-500" />}
                      {email.sentiment.sentiment === 'neutral' && <Meh className="h-3.5 w-3.5 text-gray-400" />}
                    </span>
                  )}
                  {/* Urgency indicator */}
                  {email.sentiment?.urgency === 'critical' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" title="Critical urgency" />
                  )}
                  {email.sentiment?.urgency === 'high' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500" title="High urgency" />
                  )}
                  {/* Priority indicator */}
                  {email.priorityScore !== undefined && email.priorityScore >= 70 && (
                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" title={`Priority: ${email.priorityScore}`} />
                  )}
                  {/* Meeting indicator */}
                  {email.meetingRequest?.detected && (
                    <Calendar className="h-3.5 w-3.5 text-purple-500" title="Meeting request detected" />
                  )}
                </div>
                <div className={cn("mb-2 text-sm truncate text-[#FAFAF9]", !email.read ? "font-semibold" : "font-normal")}>
                  {email.subject}
                </div>
                <p className="line-clamp-2 text-sm text-[#8A8A8A] leading-relaxed">
                  {(email.bodyPlain || email.body || '')
                    .replace(/<[^>]*>/g, '') // Strip any HTML tags
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 200)}
                </p>
                {email.aiLabels && email.aiLabels.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {email.aiLabels.map((label) => (
                      <AiLabelBadge key={label} label={label as any} />
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-xs text-[#5A5A5A]">
                {formatTimestamp(email.date)}
              </div>
            </Link>
          ))}
        </div>
        {filteredEmails.length > 0 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-white/[0.04]">
            <Button
              size="sm"
              disabled={!canGoPrev || isSyncing}
              onClick={handlePrevPage}
              className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-lg"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm font-medium text-[#FAFAF9]">
              Page {currentPage}
            </span>
            <Button
              size="sm"
              disabled={!canGoNext || isSyncing}
              onClick={handleNextPage}
              className="border border-white/[0.08] bg-white/[0.03] text-[#FAFAF9] hover:bg-white/[0.06] rounded-lg"
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
