"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarClock, FileText, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { emailApi, type MeetingBrief } from "@/lib/email-api"

const date = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "short",
}).format(new Date(value))

export function MeetingBriefsContent() {
  const [briefs, setBriefs] = useState<MeetingBrief[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setError(null)
      setBriefs(await emailApi.listMeetingBriefs())
    } catch (caught: any) {
      setError(caught.message || "Could not load meeting briefs.")
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  return <div className="h-full overflow-y-auto bg-background">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur">
      <div><h1 className="text-xl font-semibold">Meeting Briefs</h1><p className="mt-1 text-sm text-muted-foreground">Evidence-grounded preparation generated from tracked email threads.</p></div>
      <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </header>
    <div className="mx-auto max-w-4xl space-y-4 p-5">
      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}
      {loading ? <div className="py-24 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading briefs…</div>
        : !briefs.length ? <div className="rounded-2xl border border-dashed p-10 text-center"><FileText className="mx-auto h-10 w-10 text-brand" /><h2 className="mt-3 font-medium">No meeting briefs yet</h2><p className="mt-2 text-sm text-muted-foreground">Use “Prepare brief” on a dated commitment that came from an email thread.</p></div>
        : briefs.map((brief) => <article key={brief.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{brief.title}</h2><span className="text-xs text-muted-foreground"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{date(brief.meetingAt)}</span></div>
          <p className="mt-3 text-sm leading-6">{brief.overview}</p>
          <BriefList title="Objectives" items={brief.objectives} />
          <BriefList title="Context" items={brief.contextPoints} />
          <BriefList title="Open questions" items={brief.openQuestions} />
          <BriefList title="Suggested talking points" items={brief.suggestedTalkingPoints} />
        </article>)}
    </div>
  </div>
}

function BriefList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return <section className="mt-5"><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3><ul className="mt-2 space-y-2 text-sm">{items.map((item, index) => <li key={index} className="flex gap-2"><span className="text-brand">•</span><span>{item}</span></li>)}</ul></section>
}
