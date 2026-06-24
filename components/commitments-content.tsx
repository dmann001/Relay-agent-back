"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Radar,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  XCircle,
} from "lucide-react"
import { AccountScopeSelect } from "@/components/account-scope-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProviderIcon } from "@/components/provider-icon"
import { emailApi, type CalendarConnection, type Commitment, type CommitmentCalendarEvent, type CommitmentMonitor } from "@/lib/email-api"
import { cn } from "@/lib/utils"

type CommitmentView = "open" | "attention" | "upcoming" | "done"

const typeLabels = {
  my_task: "My task",
  waiting_for_reply: "Waiting for reply",
  waiting_for_artifact: "Waiting for artifact",
  follow_up: "Follow up",
} as const

function formatDate(value: string | null) {
  if (!value) return "No due date"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function isOverdue(commitment: Commitment) {
  return commitment.status === "active" && Boolean(commitment.dueAt)
    && new Date(commitment.dueAt as string).getTime() <= Date.now()
    && (!commitment.snoozedUntil || new Date(commitment.snoozedUntil).getTime() <= Date.now())
}

function needsAttention(commitment: Commitment) {
  return commitment.status === "needs_review" || isOverdue(commitment)
}

export function CommitmentsContent() {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState("")
  const [view, setView] = useState<CommitmentView>("open")
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CommitmentCalendarEvent[]>([])
  const [calendarPreview, setCalendarPreview] = useState<Commitment | null>(null)
  const [monitors, setMonitors] = useState<CommitmentMonitor[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setError(null)
      const [result, connections, events, activeMonitors] = await Promise.all([
        emailApi.listCommitments({ accountId: accountId || undefined }),
        emailApi.listCalendarConnections().catch(() => []),
        emailApi.listCommitmentCalendarEvents().catch(() => []),
        emailApi.listCommitmentMonitors().catch(() => []),
      ])
      setCommitments(result.commitments)
      setCalendarConnections(connections)
      setCalendarEvents(events)
      setMonitors(activeMonitors)
      setSelectedId((current) => current && result.commitments.some(({ id }) => id === current) ? current : null)
    } catch (caught: any) {
      setError(caught.message || "Could not load commitments.")
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    void load()
    const onUpdate = () => void load()
    window.addEventListener("relay-commitments-updated", onUpdate)
    return () => window.removeEventListener("relay-commitments-updated", onUpdate)
  }, [load])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return commitments.filter((commitment) => {
      const open = commitment.status === "active" || commitment.status === "needs_review"
      if (view === "open" && !open) return false
      if (view === "attention" && !needsAttention(commitment)) return false
      if (view === "upcoming" && !(commitment.status === "active" && commitment.dueAt && !isOverdue(commitment))) return false
      if (view === "done" && !["satisfied", "dismissed", "expired"].includes(commitment.status)) return false
      if (!needle) return true
      return [
        commitment.title,
        commitment.description,
        commitment.expectedOutcome,
        commitment.evidence,
        commitment.ownerName,
        commitment.accountEmail,
      ].join(" ").toLowerCase().includes(needle)
    })
  }, [commitments, query, view])

  const selected = visible.find(({ id }) => id === selectedId) || visible[0] || null

  const counts = {
    open: commitments.filter(({ status }) => status === "active" || status === "needs_review").length,
    attention: commitments.filter(needsAttention).length,
    upcoming: commitments.filter((item) => item.status === "active" && item.dueAt && !isOverdue(item)).length,
    done: commitments.filter(({ status }) => ["satisfied", "dismissed", "expired"].includes(status)).length,
  }

  const update = async (commitment: Commitment, action: "complete" | "reopen" | "dismiss" | "snooze") => {
    setPendingId(commitment.id)
    setError(null)
    try {
      const payload = action === "snooze"
        ? { action, until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() } as const
        : { action } as const
      const updated = await emailApi.updateCommitment(commitment.id, payload)
      setCommitments((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (caught: any) {
      setError(caught.message || "Could not update the commitment.")
    } finally {
      setPendingId(null)
    }
  }

  const addToCalendar = async (commitment: Commitment) => {
    setPendingId(commitment.id)
    setError(null)
    try {
      const event = await emailApi.createCommitmentCalendarEvent(commitment.id)
      setCalendarEvents((current) => [...current.filter((item) => item.commitmentId !== commitment.id), event])
      setCalendarPreview(null)
    } catch (caught: any) {
      setError(caught.message || "Could not create the calendar reminder.")
    } finally {
      setPendingId(null)
    }
  }

  const removeFromCalendar = async (event: CommitmentCalendarEvent) => {
    setPendingId(event.commitmentId)
    setError(null)
    try {
      await emailApi.deleteCommitmentCalendarEvent(event.id)
      setCalendarEvents((current) => current.filter((item) => item.id !== event.id))
    } catch (caught: any) {
      setError(caught.message || "Could not remove the calendar reminder.")
    } finally {
      setPendingId(null)
    }
  }

  const toggleMonitor = async (commitment: Commitment, enabled: boolean) => {
    setPendingId(commitment.id)
    setError(null)
    try {
      if (enabled) {
        const monitor = await emailApi.enableCommitmentMonitor(commitment.id)
        setMonitors((current) => [...current.filter((item) => item.commitmentId !== commitment.id), monitor])
      } else {
        await emailApi.disableCommitmentMonitor(commitment.id)
        setMonitors((current) => current.filter((item) => item.commitmentId !== commitment.id))
      }
    } catch (caught: any) {
      setError(caught.message || "Could not update automatic monitoring.")
    } finally {
      setPendingId(null)
    }
  }

  const prepareBrief = async (commitment: Commitment) => {
    setPendingId(commitment.id)
    setError(null)
    try {
      await emailApi.prepareMeetingBrief(commitment.id)
      window.location.href = "/briefs"
    } catch (caught: any) {
      setError(caught.message || "Could not prepare the meeting brief.")
      setPendingId(null)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Commitments</h1>
            <p className="mt-1 text-sm text-muted-foreground">Obligations extracted from email, calendarized, and monitored.</p>
          </div>
          <div className="flex items-center gap-2">
            <AccountScopeSelect value={accountId} onChange={setAccountId} />
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Metric label="Open" value={counts.open} />
          <Metric label="Needs attention" value={counts.attention} tone={counts.attention ? "danger" : "normal"} />
          <Metric label="Upcoming" value={counts.upcoming} />
          <Metric label="Done" value={counts.done} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-3">
            <div className="relative min-w-56 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search commitments"
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {(["open", "attention", "upcoming", "done"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setView(item)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize",
                    view === item ? "bg-surface-hover text-foreground" : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
            ) : isLoading && !commitments.length ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading commitments...
              </div>
            ) : !visible.length ? (
              <div className="m-4 rounded-lg border border-dashed border-border p-8 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-muted-foreground" />
                <h2 className="mt-3 text-sm font-medium text-foreground">No commitments in this view</h2>
                <p className="mt-1 text-sm text-muted-foreground">Track follow-ups from an email thread and they will appear here.</p>
              </div>
            ) : visible.map((commitment) => (
              <CommitmentRow
                key={commitment.id}
                commitment={commitment}
                selected={selected?.id === commitment.id}
                calendarEvent={calendarEvents.find((item) => item.commitmentId === commitment.id)}
                monitor={monitors.find((item) => item.commitmentId === commitment.id && item.status === "active")}
                onSelect={() => setSelectedId(commitment.id)}
              />
            ))}
          </div>
        </section>

        <CommitmentDetail
          commitment={selected}
          pendingId={pendingId}
          calendarEvent={selected ? calendarEvents.find((item) => item.commitmentId === selected.id) : undefined}
          calendarConnected={selected ? calendarConnections.some((item) => item.accountId === selected.accountId && item.status === "connected") : false}
          monitor={selected ? monitors.find((item) => item.commitmentId === selected.id && item.status === "active") : undefined}
          onComplete={(commitment) => void update(commitment, "complete")}
          onDismiss={(commitment) => void update(commitment, "dismiss")}
          onSnooze={(commitment) => void update(commitment, "snooze")}
          onReopen={(commitment) => void update(commitment, "reopen")}
          onAddCalendar={(commitment) => setCalendarPreview(commitment)}
          onRemoveCalendar={(event) => void removeFromCalendar(event)}
          onToggleMonitor={(commitment, enabled) => void toggleMonitor(commitment, enabled)}
          onPrepareBrief={(commitment) => void prepareBrief(commitment)}
          onClose={() => setSelectedId(null)}
        />
      </div>

      <Dialog open={Boolean(calendarPreview)} onOpenChange={(open) => !open && setCalendarPreview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve calendar reminder</DialogTitle>
            <DialogDescription>Review the external calendar action. No attendees will be invited.</DialogDescription>
          </DialogHeader>
          {calendarPreview ? (
            <div className="space-y-3 rounded-lg border border-border bg-surface-subtle p-4 text-sm">
              <Field label="Event" value={calendarPreview.title} />
              <Field label="Starts" value={formatDate(calendarPreview.dueAt)} />
              <Field label="Calendar" value={calendarPreview.accountEmail || "Connected account"} />
              <Field label="Reminder" value="30 minutes before" />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCalendarPreview(null)}>Cancel</Button>
            <Button onClick={() => calendarPreview && void addToCalendar(calendarPreview)} disabled={!calendarPreview || pendingId === calendarPreview.id}>
              {calendarPreview && pendingId === calendarPreview.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
              Create reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Metric({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "danger" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold", tone === "danger" && "text-destructive")}>{value}</span>
    </div>
  )
}

function CommitmentRow({
  commitment,
  selected,
  calendarEvent,
  monitor,
  onSelect,
}: {
  commitment: Commitment
  selected: boolean
  calendarEvent?: CommitmentCalendarEvent
  monitor?: CommitmentMonitor
  onSelect: () => void
}) {
  const overdue = isOverdue(commitment)
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[auto_1fr_auto] gap-3 border-b border-border px-4 py-3 text-left hover:bg-surface-subtle",
        selected && "bg-surface-subtle",
      )}
    >
      <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", overdue ? "bg-destructive" : commitment.status === "needs_review" ? "bg-amber-500" : commitment.status === "satisfied" ? "bg-emerald-500" : "bg-muted-foreground")} />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{commitment.title}</span>
          <Badge variant="outline" className="text-[10px]">{typeLabels[commitment.type]}</Badge>
          {overdue ? <Badge variant="destructive" className="text-[10px]">Overdue</Badge> : null}
        </span>
        <span className="mt-1 line-clamp-1 text-sm text-muted-foreground">{commitment.description || commitment.evidence || commitment.expectedOutcome || "No description"}</span>
        <span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {commitment.provider ? <span className="flex items-center gap-1.5"><ProviderIcon provider={commitment.provider} className="h-3.5 w-3.5" />{commitment.accountEmail}</span> : null}
          <span><Clock3 className="mr-1 inline h-3 w-3" />{formatDate(commitment.dueAt)}</span>
          {calendarEvent ? <span>Calendar</span> : null}
          {monitor ? <span>Monitored</span> : null}
        </span>
      </span>
      <span className="hidden text-right text-xs text-muted-foreground sm:block">{commitment.ownerName || "No owner"}</span>
    </button>
  )
}

function CommitmentDetail({
  commitment,
  pendingId,
  calendarEvent,
  calendarConnected,
  monitor,
  onComplete,
  onDismiss,
  onSnooze,
  onReopen,
  onAddCalendar,
  onRemoveCalendar,
  onToggleMonitor,
  onPrepareBrief,
  onClose,
}: {
  commitment: Commitment | null
  pendingId: string | null
  calendarEvent?: CommitmentCalendarEvent
  calendarConnected: boolean
  monitor?: CommitmentMonitor
  onComplete: (commitment: Commitment) => void
  onDismiss: (commitment: Commitment) => void
  onSnooze: (commitment: Commitment) => void
  onReopen: (commitment: Commitment) => void
  onAddCalendar: (commitment: Commitment) => void
  onRemoveCalendar: (event: CommitmentCalendarEvent) => void
  onToggleMonitor: (commitment: Commitment, enabled: boolean) => void
  onPrepareBrief: (commitment: Commitment) => void
  onClose: () => void
}) {
  if (!commitment) {
    return (
      <aside className="hidden w-[25rem] shrink-0 border-l border-border bg-card xl:block">
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Select a commitment to view actions.
        </div>
      </aside>
    )
  }

  const open = commitment.status === "active" || commitment.status === "needs_review"
  const sourceHref = commitment.providerMessageId && commitment.accountId
    ? `/thread/${encodeURIComponent(commitment.providerMessageId)}?account=${encodeURIComponent(commitment.accountId)}`
    : null

  return (
    <aside className="fixed inset-0 z-50 flex justify-end bg-black/20 xl:static xl:z-auto xl:w-[25rem] xl:shrink-0 xl:bg-transparent">
      <div className="flex h-full w-full max-w-[28rem] flex-col border-l border-border bg-card shadow-2xl xl:shadow-none">
      <div className="border-b border-border p-4">
        <div className="flex items-start gap-3">
          <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", isOverdue(commitment) ? "bg-destructive" : commitment.status === "needs_review" ? "bg-amber-500" : "bg-emerald-500")} />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">{commitment.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{typeLabels[commitment.type]} · {formatDate(commitment.dueAt)}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 xl:hidden" onClick={onClose} aria-label="Close commitment details">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-3 rounded-lg border border-border bg-background p-3 text-sm">
          <Field label="Expected outcome" value={commitment.expectedOutcome || "Not specified"} />
          <Field label="Owner" value={commitment.ownerEmail || commitment.ownerName || "Not assigned"} />
          <Field label="Account" value={commitment.accountEmail || "Unknown account"} />
        </div>
        {commitment.evidence ? (
          <blockquote className="mt-4 border-l-2 border-border pl-3 text-sm leading-6 text-muted-foreground">{commitment.evidence}</blockquote>
        ) : null}
        {commitment.snoozedUntil && new Date(commitment.snoozedUntil).getTime() > Date.now() ? (
          <div className="mt-4 rounded-lg border border-border bg-surface-subtle p-3 text-sm text-muted-foreground">Snoozed until {formatDate(commitment.snoozedUntil)}</div>
        ) : null}
      </div>
      <footer className="grid gap-2 border-t border-border p-3">
        {sourceHref ? (
          <Button asChild variant="outline">
            <Link href={sourceHref}><ExternalLink className="mr-2 h-4 w-4" />Open email</Link>
          </Button>
        ) : null}
        {open ? (
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onComplete(commitment)} disabled={pendingId === commitment.id}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button>
            <Button variant="outline" onClick={() => onSnooze(commitment)} disabled={pendingId === commitment.id}><CalendarClock className="mr-2 h-4 w-4" />Snooze</Button>
            <Button variant="outline" onClick={() => onDismiss(commitment)} disabled={pendingId === commitment.id}><XCircle className="mr-2 h-4 w-4" />Dismiss</Button>
            {calendarEvent ? (
              <Button variant="outline" onClick={() => onRemoveCalendar(calendarEvent)} disabled={pendingId === commitment.id}><CalendarX className="mr-2 h-4 w-4" />Uncalendar</Button>
            ) : commitment.dueAt && calendarConnected ? (
              <Button variant="outline" onClick={() => onAddCalendar(commitment)} disabled={pendingId === commitment.id}><CalendarPlus className="mr-2 h-4 w-4" />Calendar</Button>
            ) : commitment.dueAt ? (
              <Button asChild variant="outline"><Link href="/settings/connections"><CalendarPlus className="mr-2 h-4 w-4" />Connect</Link></Button>
            ) : null}
            <Button variant="outline" onClick={() => onToggleMonitor(commitment, !monitor)} disabled={pendingId === commitment.id}><Radar className="mr-2 h-4 w-4" />{monitor ? "Stop monitor" : "Monitor"}</Button>
            {commitment.dueAt && commitment.providerMessageId ? (
              <Button variant="outline" onClick={() => onPrepareBrief(commitment)} disabled={pendingId === commitment.id}><FileText className="mr-2 h-4 w-4" />Brief</Button>
            ) : null}
          </div>
        ) : (
          <Button variant="outline" onClick={() => onReopen(commitment)} disabled={pendingId === commitment.id}><RotateCcw className="mr-2 h-4 w-4" />Reopen</Button>
        )}
      </footer>
      </div>
    </aside>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  )
}
