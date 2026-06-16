"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  StopCircle,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProviderIcon } from "@/components/provider-icon"
import {
  emailApi,
  type AgentActivity,
  type AgentActivityEvent,
  type AgentActivityStatus,
} from "@/lib/email-api"
import { cn } from "@/lib/utils"

const groups: Array<{
  title: string
  statuses: AgentActivityStatus[]
  empty: string
}> = [
  { title: "Needs your attention", statuses: ["awaiting_approval", "needs_input", "partially_completed", "failed"], empty: "Nothing needs your attention." },
  { title: "Running", statuses: ["running", "queued"], empty: "No agent actions are running." },
  { title: "Scheduled", statuses: ["scheduled"], empty: "No agent actions are scheduled." },
  { title: "Recently completed", statuses: ["completed"], empty: "Completed agent actions will appear here." },
  { title: "Cancelled", statuses: ["cancelled"], empty: "No cancelled actions." },
]

const statusLabels: Record<AgentActivityStatus, string> = {
  draft: "Draft",
  awaiting_approval: "Awaiting approval",
  scheduled: "Scheduled",
  queued: "Queued",
  running: "Running",
  needs_input: "Needs input",
  completed: "Completed",
  partially_completed: "Partially completed",
  failed: "Failed",
  cancelled: "Cancelled",
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value))
}

function StatusIcon({ status }: { status: AgentActivityStatus }) {
  if (status === "running" || status === "queued") return <Loader2 className={cn("h-4 w-4 text-brand", status === "running" && "animate-spin")} />
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  if (status === "failed" || status === "partially_completed") return <AlertCircle className="h-4 w-4 text-destructive" />
  if (status === "cancelled") return <StopCircle className="h-4 w-4 text-muted-foreground" />
  if (status === "scheduled") return <CalendarClock className="h-4 w-4 text-brand" />
  if (status === "needs_input" || status === "awaiting_approval") return <PauseCircle className="h-4 w-4 text-amber-500" />
  return <Circle className="h-4 w-4 text-muted-foreground" />
}

export function AgentActivityContent() {
  const [activities, setActivities] = useState<AgentActivity[]>([])
  const [selected, setSelected] = useState<AgentActivity | null>(null)
  const [events, setEvents] = useState<AgentActivityEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const result = await emailApi.listAgentActivity()
      setActivities(result.activities)
      setSelected((current) => current
        ? result.activities.find(({ id }) => id === current.id) ?? current
        : null)
    } catch (caught: any) {
      setError(caught.message || "Could not load agent activity.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(), 15_000)
    const onUpdate = () => void load()
    window.addEventListener("relay-agent-activity-updated", onUpdate)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("relay-agent-activity-updated", onUpdate)
    }
  }, [load])

  const openDetail = async (activity: AgentActivity) => {
    setSelected(activity)
    setEvents([])
    setIsDetailLoading(true)
    try {
      const detail = await emailApi.getAgentActivity(activity.id)
      setSelected(detail.activity)
      setEvents(detail.events)
    } catch (caught: any) {
      setError(caught.message || "Could not load this activity.")
    } finally {
      setIsDetailLoading(false)
    }
  }

  const control = async (action: "cancel" | "retry") => {
    if (!selected) return
    setActionPending(true)
    try {
      const updated = await emailApi.controlAgentActivity(selected.id, action)
      setSelected(updated)
      const detail = await emailApi.getAgentActivity(selected.id)
      setEvents(detail.events)
      await load()
    } catch (caught: any) {
      setError(caught.message || `Could not ${action} this activity.`)
    } finally {
      setActionPending(false)
    }
  }

  const grouped = useMemo(() => groups.map((group) => ({
    ...group,
    activities: activities.filter(({ status }) => group.statuses.includes(status)),
  })), [activities])

  return (
    <div className="flex h-full min-h-0 bg-background">
      <main className="min-w-0 flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Agent Activity</h1>
            <p className="mt-1 text-sm text-muted-foreground">See what Relay is doing, inspect progress, and control background actions.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />Refresh
          </Button>
        </header>

        <div className="mx-auto max-w-4xl space-y-8 p-5">
          {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
          {isLoading && !activities.length ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading agent activity…</div>
          ) : !activities.length ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft"><Bot className="h-7 w-7 text-brand-strong" /></div>
              <h2 className="mt-4 text-lg font-medium text-foreground">No agent activity yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">When Relay tracks commitments, creates calendar reminders, or prepares meeting briefings, the work and its progress will appear here.</p>
            </div>
          ) : grouped.map((group) => (
            <section key={group.title}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{group.title}</h2>
                {!!group.activities.length && <Badge variant="secondary">{group.activities.length}</Badge>}
              </div>
              {group.activities.length ? <div className="space-y-2">{group.activities.map((activity) => (
                <button key={activity.id} onClick={() => void openDetail(activity)} className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-surface-hover">
                  <div className="mt-0.5"><StatusIcon status={activity.status} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{activity.title}</span>
                      <Badge variant="outline" className="text-[10px]">{statusLabels[activity.status]}</Badge>
                    </div>
                    {activity.summary && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{activity.summary}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {activity.provider && <span className="flex items-center gap-1.5"><ProviderIcon provider={activity.provider} className="h-3.5 w-3.5" />{activity.accountEmail}</span>}
                      {activity.currentStage && <span>{activity.currentStage}</span>}
                      <span><Clock3 className="mr-1 inline h-3 w-3" />{formatDate(activity.scheduledFor || activity.updatedAt)}</span>
                    </div>
                    {activity.progressTotal && activity.status === "running" && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (activity.progressCurrent / activity.progressTotal) * 100)}%` }} /></div>}
                  </div>
                </button>
              ))}</div> : <p className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">{group.empty}</p>}
            </section>
          ))}
        </div>
      </main>

      {selected && <aside className="fixed inset-0 z-50 flex justify-end bg-black/20 md:static md:z-auto md:w-[25rem] md:shrink-0 md:bg-transparent">
        <div className="flex h-full w-full max-w-[28rem] flex-col border-l border-border bg-background shadow-2xl md:shadow-none">
          <header className="flex items-start gap-3 border-b border-border p-4">
            <div className="mt-0.5"><StatusIcon status={selected.status} /></div>
            <div className="min-w-0 flex-1"><h2 className="font-semibold text-foreground">{selected.title}</h2><p className="mt-1 text-xs text-muted-foreground">{statusLabels[selected.status]}</p></div>
            <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Close activity details"><X className="h-4 w-4" /></Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {selected.summary && <p className="text-sm leading-6 text-foreground">{selected.summary}</p>}
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-3 text-xs">
              <div><div className="text-muted-foreground">Account</div><div className="mt-1 text-foreground">{selected.accountEmail || "Relay"}</div></div>
              <div><div className="text-muted-foreground">Updated</div><div className="mt-1 text-foreground">{formatDate(selected.updatedAt)}</div></div>
              <div><div className="text-muted-foreground">Attempt</div><div className="mt-1 text-foreground">{selected.attemptCount + 1} of {selected.maxAttempts}</div></div>
              <div><div className="text-muted-foreground">Stage</div><div className="mt-1 text-foreground">{selected.currentStage || "—"}</div></div>
            </div>
            {selected.errorMessage && <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{selected.errorMessage}</div>}
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
            {isDetailLoading ? <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading timeline…</div> : events.length ? <ol className="mt-4 space-y-4">{events.map((event, index) => (
              <li key={event.id} className="relative flex gap-3">
                {index < events.length - 1 && <span className="absolute left-[7px] top-5 h-[calc(100%+0.25rem)] w-px bg-border" />}
                <CheckCircle2 className="relative mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div><p className="text-sm text-foreground">{event.message}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}{event.stage ? ` · ${event.stage}` : ""}</p></div>
              </li>
            ))}</ol> : <p className="mt-3 text-sm text-muted-foreground">No timeline events were recorded.</p>}
          </div>
          <footer className="flex gap-2 border-t border-border p-3">
            {["draft", "awaiting_approval", "scheduled", "queued", "running", "needs_input"].includes(selected.status) && <Button variant="outline" className="flex-1" disabled={actionPending} onClick={() => void control("cancel")}><StopCircle className="mr-2 h-4 w-4" />Stop</Button>}
            {["failed", "partially_completed", "cancelled"].includes(selected.status) && selected.attemptCount < selected.maxAttempts && <Button className="flex-1" disabled={actionPending} onClick={() => void control("retry")}><RotateCcw className="mr-2 h-4 w-4" />Retry</Button>}
          </footer>
        </div>
      </aside>}
    </div>
  )
}
