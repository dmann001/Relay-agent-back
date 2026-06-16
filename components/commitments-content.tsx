"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Loader2,
  Radar,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react"
import { AccountScopeSelect } from "@/components/account-scope-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProviderIcon } from "@/components/provider-icon"
import { emailApi, type CalendarConnection, type Commitment, type CommitmentCalendarEvent, type CommitmentMonitor } from "@/lib/email-api"
import { cn } from "@/lib/utils"

const typeLabels = {
  my_task: "My task",
  waiting_for_reply: "Waiting for reply",
  waiting_for_artifact: "Waiting for artifact",
  follow_up: "Follow up",
} as const

function formatDate(value: string | null) {
  if (!value) return "No due date"
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value))
}

function isOverdue(commitment: Commitment) {
  return commitment.status === "active" && Boolean(commitment.dueAt)
    && new Date(commitment.dueAt as string).getTime() <= Date.now()
    && (!commitment.snoozedUntil || new Date(commitment.snoozedUntil).getTime() <= Date.now())
}

export function CommitmentsContent() {
  const [commitments, setCommitments] = useState<Commitment[]>([])
  const [accountId, setAccountId] = useState("")
  const [view, setView] = useState<"open" | "completed" | "dismissed">("open")
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

  const visible = useMemo(() => commitments.filter(({ status }) => {
    if (view === "completed") return status === "satisfied"
    if (view === "dismissed") return status === "dismissed" || status === "expired"
    return status === "active" || status === "needs_review"
  }), [commitments, view])

  const sections = useMemo(() => {
    if (view !== "open") return [{ title: view === "completed" ? "Completed" : "Dismissed", items: visible }]
    return [
      { title: "Needs attention", items: visible.filter((item) => item.status === "needs_review" || isOverdue(item)) },
      { title: "Upcoming", items: visible.filter((item) => item.status === "active" && !isOverdue(item) && item.dueAt) },
      { title: "No due date", items: visible.filter((item) => item.status === "active" && !item.dueAt) },
    ]
  }, [view, visible])

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

  return <div className="h-full overflow-y-auto bg-background">
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-xl font-semibold tracking-tight text-foreground">Commitments</h1><p className="mt-1 text-sm text-muted-foreground">Track obligations grounded in Gmail and Outlook conversations.</p></div>
        <div className="flex items-center gap-2"><AccountScopeSelect value={accountId} onChange={setAccountId} /><Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}><RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />Refresh</Button></div>
      </div>
      <div className="mx-auto mt-4 flex max-w-5xl gap-1">
        {(["open", "completed", "dismissed"] as const).map((item) => <button key={item} onClick={() => setView(item)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium capitalize", view === item ? "bg-brand-soft text-brand-strong" : "text-muted-foreground hover:bg-surface-hover")}>{item}</button>)}
      </div>
    </header>

    <div className="mx-auto max-w-5xl space-y-8 p-5">
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {isLoading && !commitments.length ? <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading commitments…</div> : !visible.length ? <div className="rounded-2xl border border-dashed border-border p-10 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-brand" /><h2 className="mt-4 text-lg font-medium">No {view} commitments</h2><p className="mt-2 text-sm text-muted-foreground">{view === "open" ? "Open an email, ask Relay to extract tasks, and track one that matters." : "Commitments will move here as you update them."}</p></div> : sections.map((section) => section.items.length ? <section key={section.title}>
        <div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-semibold">{section.title}</h2><Badge variant="secondary">{section.items.length}</Badge></div>
        <div className="space-y-3">{section.items.map((commitment) => {
          const overdue = isOverdue(commitment)
          const calendarEvent = calendarEvents.find((item) => item.commitmentId === commitment.id)
          const calendarConnected = calendarConnections.some((item) => item.accountId === commitment.accountId && item.status === "connected")
          const monitor = monitors.find((item) => item.commitmentId === commitment.id && item.status === "active")
          const sourceHref = commitment.providerMessageId && commitment.accountId
            ? `/thread/${encodeURIComponent(commitment.providerMessageId)}?account=${encodeURIComponent(commitment.accountId)}`
            : null
          return <article key={commitment.id} className={cn("rounded-2xl border bg-card p-4", overdue ? "border-destructive/30" : "border-border")}>
            <div className="flex items-start gap-3">
              <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", overdue ? "bg-destructive/10 text-destructive" : commitment.status === "needs_review" ? "bg-amber-500/10 text-amber-600" : "bg-brand-soft text-brand-strong")}>{overdue || commitment.status === "needs_review" ? <AlertCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-foreground">{commitment.title}</h3><Badge variant="outline" className="text-[10px]">{typeLabels[commitment.type]}</Badge>{overdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {commitment.provider && <span className="flex items-center gap-1.5"><ProviderIcon provider={commitment.provider} className="h-3.5 w-3.5" />{commitment.accountEmail}</span>}
                  <span><Clock3 className="mr-1 inline h-3.5 w-3.5" />{formatDate(commitment.dueAt)}</span>
                  {commitment.ownerName && <span>Owner: {commitment.ownerName}</span>}
                </div>
                {commitment.evidence && <p className="mt-3 border-l-2 border-border pl-3 text-xs leading-5 text-muted-foreground">{commitment.evidence}</p>}
                {commitment.snoozedUntil && new Date(commitment.snoozedUntil).getTime() > Date.now() && <p className="mt-2 text-xs text-brand-strong">Snoozed until {formatDate(commitment.snoozedUntil)}</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              {sourceHref && <Button asChild variant="outline" size="sm"><Link href={sourceHref}><ExternalLink className="mr-2 h-3.5 w-3.5" />Open email</Link></Button>}
              {(commitment.status === "active" || commitment.status === "needs_review") && <><Button size="sm" onClick={() => void update(commitment, "complete")} disabled={pendingId === commitment.id}><CheckCircle2 className="mr-2 h-3.5 w-3.5" />Complete</Button><Button variant="outline" size="sm" onClick={() => void update(commitment, "snooze")} disabled={pendingId === commitment.id}><CalendarClock className="mr-2 h-3.5 w-3.5" />Snooze 1 day</Button><Button variant="ghost" size="sm" onClick={() => void update(commitment, "dismiss")} disabled={pendingId === commitment.id}><XCircle className="mr-2 h-3.5 w-3.5" />Dismiss</Button></>}
              {(commitment.status === "active" || commitment.status === "needs_review") && commitment.dueAt && (calendarEvent
                ? <Button variant="outline" size="sm" onClick={() => void removeFromCalendar(calendarEvent)} disabled={pendingId === commitment.id}><CalendarX className="mr-2 h-3.5 w-3.5" />Remove reminder</Button>
                : calendarConnected
                  ? <Button variant="outline" size="sm" onClick={() => setCalendarPreview(commitment)} disabled={pendingId === commitment.id}><CalendarPlus className="mr-2 h-3.5 w-3.5" />Add to calendar</Button>
                  : <Button asChild variant="outline" size="sm"><Link href="/settings"><CalendarPlus className="mr-2 h-3.5 w-3.5" />Connect calendar</Link></Button>)}
              {(commitment.status === "active" || commitment.status === "needs_review") && <Button variant="outline" size="sm" onClick={() => void toggleMonitor(commitment, !monitor)} disabled={pendingId === commitment.id}><Radar className="mr-2 h-3.5 w-3.5" />{monitor ? "Stop monitoring" : "Monitor thread"}</Button>}
              {(commitment.status === "active" || commitment.status === "needs_review") && commitment.dueAt && commitment.providerMessageId && <Button variant="outline" size="sm" onClick={() => void prepareBrief(commitment)} disabled={pendingId === commitment.id}><FileText className="mr-2 h-3.5 w-3.5" />Prepare brief</Button>}
              {(commitment.status === "satisfied" || commitment.status === "dismissed") && <Button variant="outline" size="sm" onClick={() => void update(commitment, "reopen")} disabled={pendingId === commitment.id}><RotateCcw className="mr-2 h-3.5 w-3.5" />Reopen</Button>}
            </div>
          </article>
        })}</div>
      </section> : null)}
    </div>
    <Dialog open={Boolean(calendarPreview)} onOpenChange={(open) => !open && setCalendarPreview(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve calendar reminder</DialogTitle>
          <DialogDescription>Review the exact external action Relay will perform. No attendees will be invited.</DialogDescription>
        </DialogHeader>
        {calendarPreview && <div className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4 text-sm">
          <div><span className="text-muted-foreground">Event</span><p className="font-medium">{calendarPreview.title}</p></div>
          <div><span className="text-muted-foreground">Starts</span><p>{formatDate(calendarPreview.dueAt)}</p></div>
          <div><span className="text-muted-foreground">Calendar</span><p>{calendarPreview.accountEmail}</p></div>
          <div><span className="text-muted-foreground">Reminder</span><p>30 minutes before</p></div>
        </div>}
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
}
