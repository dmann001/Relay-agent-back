"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, CheckCircle2, FileText, Loader2, RefreshCw, Search, TriangleAlert } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { emailApi, type MeetingBrief } from "@/lib/email-api"
import { cn } from "@/lib/utils"

const date = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value))

const relativeMeeting = (value: string) => {
  const start = new Date(value).getTime()
  const diffHours = Math.round((start - Date.now()) / 3_600_000)
  if (Number.isNaN(diffHours)) return "No date"
  if (diffHours < -24) return "Past"
  if (diffHours < 0) return "Recently passed"
  if (diffHours < 24) return "Today"
  if (diffHours < 72) return "Soon"
  return "Upcoming"
}

type BriefFilter = "all" | "ready" | "failed" | "upcoming"

export function MeetingBriefsContent() {
  const [briefs, setBriefs] = useState<MeetingBrief[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<BriefFilter>("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setError(null)
      const next = await emailApi.listMeetingBriefs()
      setBriefs(next)
      setSelectedId((current) => current && next.some(({ id }) => id === current) ? current : next[0]?.id || null)
    } catch (caught: any) {
      setError(caught.message || "Could not load meeting briefs.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const onUpdate = () => void load()
    window.addEventListener("relay-agent-activity-updated", onUpdate)
    return () => window.removeEventListener("relay-agent-activity-updated", onUpdate)
  }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return briefs.filter((brief) => {
      if (filter === "ready" && brief.status !== "ready") return false
      if (filter === "failed" && brief.status !== "failed") return false
      if (filter === "upcoming" && new Date(brief.meetingAt).getTime() < Date.now()) return false
      if (!needle) return true
      return [
        brief.title,
        brief.overview,
        ...brief.objectives,
        ...brief.contextPoints,
        ...brief.openQuestions,
        ...brief.suggestedTalkingPoints,
      ].join(" ").toLowerCase().includes(needle)
    }).sort((a, b) => new Date(a.meetingAt).getTime() - new Date(b.meetingAt).getTime())
  }, [briefs, filter, query])

  const selected = filtered.find(({ id }) => id === selectedId) || filtered[0] || null
  const readyCount = briefs.filter(({ status }) => status === "ready").length
  const upcomingCount = briefs.filter(({ meetingAt }) => new Date(meetingAt).getTime() >= Date.now()).length
  const failedCount = briefs.filter(({ status }) => status === "failed").length

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Meeting briefs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Preparation packets generated from tracked email commitments.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Metric label="Ready" value={readyCount} icon={CheckCircle2} />
          <Metric label="Upcoming" value={upcomingCount} icon={CalendarClock} />
          <Metric label="Needs retry" value={failedCount} icon={TriangleAlert} tone={failedCount ? "danger" : "normal"} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex w-full min-w-0 flex-col border-r border-border bg-card md:w-[22rem] md:shrink-0">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search briefs"
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto">
              {(["all", "upcoming", "ready", "failed"] as const).map((item) => (
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
              <div className="m-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
            ) : loading && !briefs.length ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading briefs...
              </div>
            ) : !filtered.length ? (
              <div className="m-3 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No briefs match this view.
              </div>
            ) : filtered.map((brief) => (
              <button
                key={brief.id}
                type="button"
                onClick={() => setSelectedId(brief.id)}
                className={cn(
                  "flex w-full gap-3 border-b border-border px-3 py-3 text-left hover:bg-surface-subtle",
                  selected?.id === brief.id && "bg-surface-subtle",
                )}
              >
                <span className={cn("mt-1 h-2 w-2 rounded-full", brief.status === "ready" ? "bg-emerald-500" : "bg-destructive")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{brief.title}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{relativeMeeting(brief.meetingAt)} · {date(brief.meetingAt)}</span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{brief.overview || brief.errorMessage || "No summary available."}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <main className="hidden min-w-0 flex-1 overflow-y-auto md:block">
          {selected ? (
            <article className="mx-auto max-w-4xl px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{selected.title}</h2>
                    <Badge variant={selected.status === "ready" ? "secondary" : "destructive"}>{selected.status}</Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                    {date(selected.meetingAt)}
                  </p>
                </div>
              </div>

              {selected.errorMessage ? (
                <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{selected.errorMessage}</div>
              ) : null}
              <p className="mt-5 text-sm leading-6 text-foreground">{selected.overview || "No overview was generated."}</p>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <BriefList title="Objectives" items={selected.objectives} />
                <BriefList title="Context" items={selected.contextPoints} />
                <BriefList title="Open Questions" items={selected.openQuestions} />
                <BriefList title="Suggested Talking Points" items={selected.suggestedTalkingPoints} />
              </div>
            </article>
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 font-medium">Select a brief</h2>
                <p className="mt-2 text-sm text-muted-foreground">Brief details will appear here.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Metric({ label, value, icon: Icon, tone = "normal" }: { label: string; value: number; icon: typeof FileText; tone?: "normal" | "danger" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("flex items-center gap-2 text-sm font-semibold", tone === "danger" && "text-destructive")}>
        <Icon className="h-4 w-4" />
        {value}
      </div>
    </div>
  )
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Nothing captured.</p>
      )}
    </section>
  )
}
