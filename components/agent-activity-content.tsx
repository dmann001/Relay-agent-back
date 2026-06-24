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
  Search,
  StopCircle,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProviderIcon } from "@/components/provider-icon"
import {
  emailApi,
  type AgentActivity,
  type AgentActivityEvent,
  type AgentActivityStatus,
} from "@/lib/email-api"
import { cn } from "@/lib/utils"

type ActivityFilter = "all" | "attention" | "running" | "done"

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

const attentionStatuses: AgentActivityStatus[] = ["awaiting_approval", "needs_input", "partially_completed", "failed"]
const runningStatuses: AgentActivityStatus[] = ["running", "queued", "scheduled"]
const doneStatuses: AgentActivityStatus[] = ["completed", "cancelled"]

function formatDate(value: string | null) {
  if (!value) return "No time"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
  const [filter, setFilter] = useState<ActivityFilter>("all")
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return activities.filter((activity) => {
      if (filter === "attention" && !attentionStatuses.includes(activity.status)) return false
      if (filter === "running" && !runningStatuses.includes(activity.status)) return false
      if (filter === "done" && !doneStatuses.includes(activity.status)) return false
      if (!needle) return true
      return [activity.title, activity.summary, activity.currentStage, activity.accountEmail].join(" ").toLowerCase().includes(needle)
    })
  }, [activities, filter, query])

  const counts = {
    attention: activities.filter(({ status }) => attentionStatuses.includes(status)).length,
    running: activities.filter(({ status }) => runningStatuses.includes(status)).length,
    done: activities.filter(({ status }) => doneStatuses.includes(status)).length,
  }

  return (
    <div className="flex h-full min-h-0 bg-background">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Activity</h1>
              <p className="mt-1 text-sm text-muted-foreground">Relay operations, retries, and progress in one queue.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Metric label="Needs attention" value={counts.attention} tone={counts.attention ? "danger" : "normal"} />
            <Metric label="Running or scheduled" value={counts.running} />
            <Metric label="Finished" value={counts.done} />
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
                  placeholder="Search activity"
                  className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto">
                {(["all", "attention", "running", "done"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={cn(
                      "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium capitalize",
                      filter === item ? "bg-surface-hover text-foreground" : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
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
              ) : isLoading && !activities.length ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading activity...
                </div>
              ) : !visible.length ? (
                <div className="m-4 rounded-lg border border-dashed border-border p-8 text-center">
                  <Bot className="mx-auto h-9 w-9 text-muted-foreground" />
                  <h2 className="mt-3 text-sm font-medium text-foreground">No activity in this view</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Background actions appear here when Relay works on commitments, calendar events, and briefs.</p>
                </div>
              ) : visible.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => void openDetail(activity)}
                  className={cn(
                    "grid w-full grid-cols-[auto_1fr_auto] gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-subtle",
                    selected?.id === activity.id && "bg-surface-subtle",
                  )}
                >
                  <div className="mt-0.5"><StatusIcon status={activity.status} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{activity.title}</span>
                      <Badge variant="outline" className="text-[10px]">{statusLabels[activity.status]}</Badge>
                    </div>
                    {activity.summary ? <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{activity.summary}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {activity.provider && <span className="flex items-center gap-1.5"><ProviderIcon provider={activity.provider} className="h-3.5 w-3.5" />{activity.accountEmail}</span>}
                      {activity.currentStage && <span>{activity.currentStage}</span>}
                    </div>
                    {activity.progressTotal && runningStatuses.includes(activity.status) ? (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (activity.progressCurrent / activity.progressTotal) * 100)}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    <Clock3 className="mr-1 inline h-3 w-3" />
                    {formatDate(activity.scheduledFor || activity.updatedAt)}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <ActivityDetail
            selected={selected}
            events={events}
            isDetailLoading={isDetailLoading}
            actionPending={actionPending}
            onClose={() => setSelected(null)}
            onControl={(action) => void control(action)}
          />
        </div>
      </main>
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

function ActivityDetail({
  selected,
  events,
  isDetailLoading,
  actionPending,
  onClose,
  onControl,
}: {
  selected: AgentActivity | null
  events: AgentActivityEvent[]
  isDetailLoading: boolean
  actionPending: boolean
  onClose: () => void
  onControl: (action: "cancel" | "retry") => void
}) {
  if (!selected) {
    return (
      <aside className="hidden w-[25rem] shrink-0 border-l border-border bg-card xl:block">
        <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Select an activity to inspect its timeline.
        </div>
      </aside>
    )
  }

  return (
    <aside className="fixed inset-0 z-50 flex justify-end bg-black/20 xl:static xl:z-auto xl:w-[25rem] xl:shrink-0 xl:bg-transparent">
      <div className="flex h-full w-full max-w-[28rem] flex-col border-l border-border bg-background shadow-2xl xl:shadow-none">
        <header className="flex items-start gap-3 border-b border-border p-4">
          <div className="mt-0.5"><StatusIcon status={selected.status} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">{selected.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{statusLabels[selected.status]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close activity details">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {selected.summary ? <p className="text-sm leading-6 text-foreground">{selected.summary}</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 text-xs">
            <Field label="Account" value={selected.accountEmail || "Relay"} />
            <Field label="Updated" value={formatDate(selected.updatedAt)} />
            <Field label="Attempt" value={`${selected.attemptCount + 1} of ${selected.maxAttempts}`} />
            <Field label="Stage" value={selected.currentStage || "-"} />
          </div>
          {selected.errorMessage ? <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{selected.errorMessage}</div> : null}
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h3>
          {isDetailLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Loading timeline...
            </div>
          ) : events.length ? (
            <ol className="mt-4 space-y-4">
              {events.map((event, index) => (
                <li key={event.id} className="relative flex gap-3">
                  {index < events.length - 1 && <span className="absolute left-[7px] top-5 h-[calc(100%+0.25rem)] w-px bg-border" />}
                  <CheckCircle2 className="relative mt-0.5 h-4 w-4 shrink-0 text-brand" />
                  <div>
                    <p className="text-sm text-foreground">{event.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)}{event.stage ? ` · ${event.stage}` : ""}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No timeline events were recorded.</p>
          )}
        </div>
        <footer className="flex gap-2 border-t border-border p-3">
          {(["draft", "awaiting_approval", "scheduled", "queued", "running", "needs_input"] as AgentActivityStatus[]).includes(selected.status) ? (
            <Button variant="outline" className="flex-1" disabled={actionPending} onClick={() => onControl("cancel")}>
              <StopCircle className="mr-2 h-4 w-4" />
              Stop
            </Button>
          ) : null}
          {(["failed", "partially_completed", "cancelled"] as AgentActivityStatus[]).includes(selected.status) && selected.attemptCount < selected.maxAttempts ? (
            <Button className="flex-1" disabled={actionPending} onClick={() => onControl("retry")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          ) : null}
        </footer>
      </div>
    </aside>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  )
}
